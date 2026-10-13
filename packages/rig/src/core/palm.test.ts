import { describe, expect, it } from "vitest";
import { actPalms } from "./act3";
import { parseAction, type ActionData } from "./action";
import { body3 } from "./figure3d";
import { handFrames, handVec } from "./hand";
import { matVec, type V3 } from "./lens";
import { palmFace, scenePalms, type PalmFrame } from "./palm";
import { parseScene, resolveScene, sceneAt } from "./scene";
import { defaultCharacter } from "./schema";
import onTableJson from "../../../../apps/studio/public/actions/arms-on-table-3d.json";
import standJson from "../../../../apps/studio/public/actions/stand-3d.json";
import talkJson from "../../../../apps/studio/public/actions/talk-forward-3d.json";

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

/** Mặt bàn ngang ở độ cao `top` (y rig) trải trước người, như bàn của `arms-on-table-3d` */
const table =
  (top: number): PalmFrame["surface"] =>
  (_id, at: V3) =>
    Math.abs(at[0]) > 60 && Math.abs(at[0]) < 160 ? { gap: top - at[1], name: "bàn" } : null;

const ON_TABLE = parse(sample("arms-on-table-3d"));
const STAND = parse(sample("stand-3d"));
const TALK = parse(sample("talk-forward-3d"));
/** `arms-on-table-3d` mà khuỷu chĩa xuống, cẳng tay trung tính: lòng tay dựng đứng như chặt tay */
const CHOP = parse({
  ...sample("arms-on-table-3d"),
  name: "chop-table",
  keys: [
    {
      t: 0,
      pose: { torso: 5 },
      reach: {
        armFar: { at: [100, -56, 22], elbow: [0, 1, 0] },
        armNear: { at: [100, -56, 22], elbow: [0, 1, 0] },
      },
      hand: { armFar: { turn: 0 }, armNear: { turn: 0 } },
    },
  ],
});
/** Tay buông mà cẳng tay ngửa hết: lòng tay ra trước */
const HANG_UP = parse({
  ...sample("stand-3d"),
  name: "hang-up",
  mask: [...(sample("stand-3d").mask ?? []), "hand"],
  keys: sample("stand-3d").keys.map((k: object) => ({
    ...k,
    hand: { armFar: { turn: -90 }, armNear: { turn: -90 } },
  })),
});

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

describe("scenePalms: lòng bàn tay quay sai", () => {
  const characterOf = () => clad;
  const at = (actions: ActionData[], surface = table(-221), yaw = 0) =>
    scenePalms(scene(actions, yaw), { characterOf, frame: () => ({ surface }) });

  it("tay úp trên bàn rồi buông: không báo", () => {
    expect(at([ON_TABLE, STAND])).toEqual([]);
  });

  it("tay ngửa giữa không trung trên mặt bàn thấp: không báo", () => {
    expect(at([STAND, TALK], table(-150))).toEqual([]);
  });

  for (const yaw of [0, 180])
    it(`lòng tay dựng đứng trên mặt bàn: báo cả hai tay, gợi ý \`turn\` và hướng khuỷu (yaw ${yaw})`, () => {
      const got = at([CHOP], table(-221), yaw);
      expect(got.map((s) => s.hand).sort()).toEqual(["L", "R"]);
      for (const s of got) {
        expect(s.rule).toBe("rest");
        expect(s.angle).toBeGreaterThan(60);
        expect(s.ik).toBe(true);
        expect(s.on).toBe("bàn");
        expect(s.runs).toEqual([[0, 2]]);
        expect(s.fix.angle).toBeLessThan(s.angle);
      }
    });

  it("bàn tay xa mặt bàn: không phải đặt trên bàn, không báo", () => {
    expect(at([CHOP], table(-150))).toEqual([]);
  });

  it("không có cảnh three: không đo tay đặt trên mặt ngang", () => {
    expect(scenePalms(scene([CHOP]), { characterOf })).toEqual([]);
  });

  it("tay buông mà lòng tay ra trước: báo luật tay buông", () => {
    const got = at([HANG_UP]);
    expect(got.map((s) => `${s.hand} ${s.rule}`).sort()).toEqual(["L hang", "R hang"]);
    for (const s of got) expect(s.fix.turn).toBeGreaterThan(-45);
  });

  it("lướt qua dưới `hold` giây: không báo", () => {
    const got = scenePalms(scene([CHOP], 0, 0.15), {
      characterOf,
      frame: () => ({ surface: table(-221) }),
    });
    expect(got).toEqual([]);
  });

  it("tay đang cầm đồ: không báo", () => {
    const got = scenePalms(scene([CHOP]), {
      characterOf,
      frame: () => ({ surface: table(-221), held: () => true }),
    });
    expect(got).toEqual([]);
  });
});
