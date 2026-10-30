import { describe, expect, it } from "vitest";
import { actPalms } from "./act3";
import { parseAction, type ActionData } from "./action";
import { body3 } from "./figure3d";
import { handFrames, handVec } from "./hand";
import { matVec } from "./lens";
import { palmFace } from "./palm";
import { parseScene, resolveScene, sceneAt } from "./scene";
import { defaultCharacter } from "./schema";
import onTableJson from "../../../../common/actions/arms-on-table-3d.json";
import standJson from "../../../../common/actions/stand-3d.json";
import talkJson from "../../../../common/actions/talk-forward-3d.json";

const SAMPLES: Record<string, { mask?: string[]; keys: object[] }> = {
  "arms-on-table-3d": onTableJson,
  "stand-3d": standJson,
  "talk-forward-3d": talkJson,
};
const sample = (n: string) => SAMPLES[n];
const parse = (raw: unknown): ActionData => {
  const r = parseAction(raw);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const d = defaultCharacter();
const clad = {
  ...d,
  palette: { ...d.palette, clad: true },
  pieces: {
    ...d.pieces,
    torso: { ...d.pieces.torso, src: "sculpt" as const, garment: { style: "shirt" as const } },
  },
};

/** Người mặc đồ đứng ở gốc, mặt theo `yaw`, diễn `actions` nối nhau mỗi clip `dur` giây */
const scene = (actions: ActionData[], yaw = 0, dur = 2) => {
  const r = parseScene({
    duration: dur * actions.length,
    lens: { eye: [0, -300, -900], yaw: 0, pitch: 10, f: 800, cx: 0, cy: 0 },
    cast: [
      {
        id: "a",
        world: { at: [0, 0, 0], yaw },
        tracks: [{ clips: actions.map((a, i) => ({ action: a.name, start: i * dur })) }],
      },
    ],
  });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(r.data, Object.fromEntries(actions.map((a) => [a.name, a])));
};
const palmsAt = (actions: ActionData[], t: number, yaw = 0) =>
  actPalms(clad, sceneAt(scene(actions, yaw), "a", t, clad.rig.height, body3(clad)))!;

const ON_TABLE = parse(sample("arms-on-table-3d"));
const STAND = parse(sample("stand-3d"));
const TALK = parse(sample("talk-forward-3d"));
describe("actPalms: hướng lòng bàn tay người 3D", () => {
  it("khung bàn tay: các ngón gập về `−side · x` — đó là pháp tuyến lòng tay", () => {
    for (const side of [-1, 1]) {
      const f = handFrames(handVec("fist"), side);
      const tip = matVec(f.index1.R, [0, -f.index1.len, 0]);
      expect(Math.sign(f.index1.o[0] + tip[0])).toBe(-side);
    }
  });

  for (const yaw of [0, 180]) {
    it(`arms-on-table-3d: lòng tay úp trên mặt bàn (yaw ${yaw})`, () => {
      const p = palmsAt([ON_TABLE], 1.5, yaw);
      for (const k of ["R", "L"] as const) {
        expect(palmFace(p[k]).face).toBe("down");
        expect(palmFace(p[k]).down).toBeLessThan(30);
      }
    });

    it(`stand-3d: tay buông, lòng tay quay vào đùi (yaw ${yaw})`, () => {
      const p = palmsAt([STAND], 1.5, yaw);
      for (const k of ["R", "L"] as const) expect(palmFace(p[k]).face).toBe("in");
    });

    it(`talk-forward-3d: cuối điệu bộ lòng tay ngửa (yaw ${yaw})`, () => {
      const p = palmsAt([TALK], 1.5, yaw);
      const near = yaw === 180 ? "L" : "R";
      expect(palmFace(p[near]).face).toBe("up");
      expect(palmFace(p[near]).down).toBeGreaterThan(120);
    });
  }
});
