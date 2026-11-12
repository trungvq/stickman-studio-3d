import { describe, expect, it } from "vitest";
import { parseCharacter, PiecePaletteSchema } from "./schema";
import {
  DEFAULT_SHOE,
  SHOE_CLEAR,
  SHOE_KINDS,
  shoeCapsule,
  shoeFit,
  shoeForm,
  shoeToes,
  shoeTuck,
} from "./shoe";
import { LIMB3 } from "./stature";

describe("giày ở lõi", () => {
  it("`palette.shoeStyle` lấy khoá của `SHOE_STYLES`, mặc định giày thường; `palette.sole` tuỳ chọn; áo mặc đè được", () => {
    const r = parseCharacter({ name: "a" });
    expect(r.success && r.data.palette.shoeStyle).toBe(DEFAULT_SHOE);
    expect(r.success && r.data.palette.sole).toBeUndefined();
    expect(parseCharacter({ name: "a", palette: { shoeStyle: "giay-la" } }).success).toBe(false);
    for (const k of SHOE_KINDS)
      expect(PiecePaletteSchema.parse({ shoeStyle: k, sole: "#fff" }).shoeStyle).toBe(k);
  });

  for (const kind of SHOE_KINDS)
    it(`${kind}: đế cách cổ chân đúng \`LIMB3\`, lưng gót sau ống chân đúng \`SHOE_CLEAR\`, hai đầu khép`, () => {
      for (const leg of [7, 11.5, 15]) {
        const F = shoeForm(kind, leg),
          { shin, shaft } = shoeFit(kind, leg);
        expect(F.floor).toBeCloseTo(-LIMB3 * 100, 12);
        expect(-F.back).toBeCloseTo((shaft || shin) + SHOE_CLEAR, 12);
        expect(F.at(F.back).half).toBeCloseTo(0, 9);
        expect(F.at(F.tip).half).toBeCloseTo(0, 9);
        expect(F.at(F.tip).top - F.at(F.tip).bottom).toBeCloseTo(0, 9);
        for (let z = F.back; z <= F.tip; z += 0.5) {
          const s = F.at(z);
          expect(s.top).toBeGreaterThanOrEqual(s.bottom - 1e-9);
          expect(s.bottom).toBeGreaterThanOrEqual(F.floor - 1e-9);
        }
        const [z0, z1, y, r] = shoeCapsule(kind, leg);
        expect(y - r).toBeCloseTo(F.floor, 12);
        expect(z0).toBeLessThan(z1);
        // ống chân dồn vào trên mặt đế, trong lưng gót
        const T = shoeTuck(kind, leg);
        expect(T.bottom).toBeGreaterThan(F.floor);
        expect(T.back).toBeGreaterThan(F.back);
      }
    });

  it("ngón chân chỉ có ở dép hở, năm ngón, hai bên đối xứng gương", () => {
    for (const kind of SHOE_KINDS) {
      const toes = shoeToes(kind, 11.5, -1);
      expect(toes.length).toBe(shoeFit(kind, 11.5).S.open ? 5 : 0);
      shoeToes(kind, 11.5, 1).forEach((t, i) => expect(t[0]).toBeCloseTo(-toes[i][0], 12));
    }
  });
});
