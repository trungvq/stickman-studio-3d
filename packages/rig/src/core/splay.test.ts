import { describe, expect, it } from "vitest";

import heavy from "../../../../common/characters/sample-heavy.json";
import kimono from "../../../../common/characters/sample-kimono.json";
import man from "../../../../common/characters/sample-man.json";
import woman from "../../../../common/characters/sample-woman.json";
import { roots3 } from "./arm3";
import {
  defaultCharacter,
  limbWidths,
  parseCharacter,
  SkirtSchema,
  wornPalette,
  type CharacterData,
  type Skirt,
} from "./schema";
import { wornSkirt } from "./skirtShape";

const sample = (j: unknown) => {
  const r = parseCharacter(j);
  if (!r.success) throw new Error(String(r.error));
  return r.data;
};

const rootsOf = (c: CharacterData, tweak: { skirt?: Partial<Skirt> } = {}) => {
  const pal = wornPalette(c);
  const w = limbWidths(pal);
  const worn = wornSkirt(c.pieces.hem);
  return roots3(c.pieces.torso.garment, c.rig, {
    clad: pal.clad,
    sleeve: w.sleeve,
    trouser: w.trouser,
    bicep: pal.bicep,
    skirt: worn && { ...worn, ...tweak.skirt },
    flare: pal.sleeveFlare,
    sleeveLength: pal.sleeveLength,
  });
};

// góc tay buông, cũng là góc thân áo lùi theo tay (`room`)
const ANGLES = {
  tay: (c: CharacterData, tweak?: { skirt?: Partial<Skirt> }) => rootsOf(c, tweak).splay,
};

const skirted = (skirt: Partial<Skirt>, clad: boolean) => {
  const c = defaultCharacter();
  c.palette.clad = clad;
  c.pieces.hem = { ...c.pieces.hem, src: "sculpt", skirt: SkirtSchema.parse(skirt) };
  return c;
};

const cases: [string, CharacterData][] = [
  ["sample-man", sample(man)],
  ["sample-woman", sample(woman)],
  ["sample-heavy", sample(heavy)],
  ["sample-kimono", sample(kimono)],
  ...[false, true].flatMap((clad): [string, CharacterData][] => [
    [`váy mặc định${clad ? " mặc đồ" : ""}`, skirted({}, clad)],
    [`váy ngang gối${clad ? " mặc đồ" : ""}`, skirted({ length: 100, flare: 0 }, clad)],
    [`váy xoè 30${clad ? " mặc đồ" : ""}`, skirted({ flare: 30 }, clad)],
  ]),
];

describe("góc tay buông choãi", () => {
  it("liên tục theo số đo: nhích chiều cao, vai, hông, cạp, độ xoè thì góc nhích theo, không nhảy", () => {
    for (const [name, c] of cases)
      for (const [angle, splayOf] of Object.entries(ANGLES)) {
        const s0 = splayOf(c);
        const worn = wornSkirt(c.pieces.hem);
        const moved: [string, number, number][] = [];
        for (const d of [-1, 1]) {
          const rig = (patch: Partial<CharacterData["rig"]>) => ({
            ...c,
            rig: { ...c.rig, ...patch },
          });
          moved.push([
            `cao ×(1${d > 0 ? "+" : "-"}1e-6)`,
            splayOf(rig({ height: c.rig.height * (1 + d * 1e-6) })),
            1e-4,
          ]);
          moved.push([
            `cao ${d * 0.0005}`,
            splayOf(rig({ height: c.rig.height + d * 0.0005 })),
            0.004,
          ]);
          moved.push([
            `vai ${d * 0.05}`,
            splayOf(rig({ shoulderHalf: c.rig.shoulderHalf + d * 0.05 })),
            0.004,
          ]);
          moved.push([
            `hông ${d * 0.05}`,
            splayOf(rig({ hipHalf: c.rig.hipHalf + d * 0.05 })),
            0.004,
          ]);
          if (!worn) continue;
          moved.push([
            `cạp ${d * 0.05}`,
            splayOf(c, { skirt: { rise: worn.rise + d * 0.05 } }),
            0.004,
          ]);
          moved.push([
            `xoè ${d * 0.05}`,
            splayOf(c, { skirt: { flare: worn.flare + d * 0.05 } }),
            0.004,
          ]);
          moved.push([
            `cạp ×(1${d > 0 ? "+" : "-"}1e-6)`,
            splayOf(c, { skirt: { rise: worn.rise * (1 + d * 1e-6) } }),
            1e-4,
          ]);
        }
        for (const [what, s, tol] of moved)
          expect(Math.abs(s - s0), `${name}, ${angle}, ${what}: ${s0} → ${s}`).toBeLessThan(tol);
      }
  });

  it("thân áo lùi đúng theo tay buông: không hở khe giữa tay và sườn áo", () => {
    for (const [name, c] of cases) {
      const r = rootsOf(c);
      expect(r.room?.splay ?? r.splay, name).toBe(r.splay);
    }
  });

  it("quét cạp và độ xoè của váy: góc không có bậc nhảy", () => {
    for (const [name, c] of cases)
      for (const [angle, splayOf] of Object.entries(ANGLES)) {
        const worn = wornSkirt(c.pieces.hem);
        if (!worn) continue;
        for (const [key, from, to] of [
          ["rise", 0, 70],
          ["flare", -8, 30],
        ] as const) {
          const at = (v: number) => splayOf(c, { skirt: { [key]: v } });
          // bước nào đổi nhiều thì chia nhỏ: dốc thì bước nhỏ đổi ít, bậc nhảy thì không
          const jump = (a: number, b: number, sa: number, sb: number): number => {
            if (Math.abs(sb - sa) < 0.002 || b - a < 1e-7) return Math.abs(sb - sa);
            const m = (a + b) / 2;
            const sm = at(m);
            return Math.max(jump(a, m, sa, sm), jump(m, b, sm, sb));
          };
          for (let v = from; v < to; v += 0.5)
            expect(
              jump(v, v + 0.5, at(v), at(v + 0.5)),
              `${name}, ${angle}, ${key} ${v}`,
            ).toBeLessThan(0.002);
        }
      }
  }, 60000);
});
