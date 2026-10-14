import { describe, expect, it } from "vitest";
import { actJoints } from "./act3";
import { parseAction, type ActionData } from "./action";
import { ARM_STRAIGHT, armLine, elbowAngle, sceneArms } from "./armAudit";
import { body3 } from "./figure3d";
import type { V3 } from "./lens";
import type { PalmFrame } from "./palm";
import { parseScene, resolveScene, sceneAt } from "./scene";
import { defaultCharacter } from "./schema";
import standJson from "../../../../apps/studio/public/actions/stand-3d.json";
import onTableJson from "../../../../apps/studio/public/actions/arms-on-table-3d.json";

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
const characterOf = () => clad;

const STAND = parse(standJson);
const ON_TABLE = parse(onTableJson);
/** Hành động hai tay chỉ ghi một mốc */
const arms = (name: string, key: object, mask = ["armFar", "armNear", "hand"]) =>
  parse({ schemaVersion: 13, name, authoredAt: "side", mask, keys: [{ t: 0, pose: {}, ...key }] });
/** Tay buông thẳng như que: khuỷu không gập */
const STICK = arms(
  "stick",
  { pose: { armFar: [3, 0, 0], armNear: [3, 0, 0], legFar: [1, 0], legNear: [-1, 0] } },
  ["armFar", "armNear", "legFar", "legNear"],
);
/** Đích cổ tay ngoài tầm với: với ra trước ngang vai */
const FAR = arms("far", {
  reach: { armNear: { at: [400, -160, 20] }, armFar: { at: [400, -160, 20] } },
});
/** Hai bàn tay trước bụng chụm ngón vào nhau bằng `turn` thô (chữ V ngược) */
const VEE = arms("vee", {
  reach: {
    armNear: { at: [52, -2, 14], elbow: [-0.1, 0.2, 1] },
    armFar: { at: [48, 0, 14], elbow: [-0.1, 0.2, 1] },
  },
  hand: {
    armNear: { pose: "open", turn: 45, bend: -30 },
    armFar: { pose: "open", turn: 45, bend: -30 },
  },
});
/** Như `VEE` nhưng tay xa áp lên mu tay gần: chồng tay cố ý */
const STACK = arms("stack", {
  reach: {
    armNear: { to: "belly", offset: [20, 20, -2], point: "palm", elbow: [-0.15, 0.8, 1] },
    armFar: { to: "otherBack", offset: [1, -3, 0], point: "palm", elbow: [-0.15, 0.8, 1] },
  },
  hand: {
    armNear: { pose: "flat", w: 0.7, palm: "back", fingers: "in" },
    armFar: { pose: "flat", w: 0.7, palm: "back", fingers: "in" },
  },
});
/** Bàn tay thả trước đùi ngang hông, cổ tay gập cho ngón chĩa ra trước, lòng tay ngửa */
const UP = arms("up", {
  reach: {
    armNear: { at: [50, 15, 22], elbow: [-1, 0.3, 0.3] },
    armFar: { at: [50, 15, 22], elbow: [-1, 0.3, 0.3] },
  },
  hand: { armNear: { turn: -90, bend: 80 }, armFar: { turn: -90, bend: 80 } },
});
/** Như `UP` nhưng khai lòng tay ngửa theo ý định */
const UP_MEANT = arms("up-meant", {
  reach: {
    armNear: { at: [50, 15, 22], elbow: [-1, 0.3, 0.3] },
    armFar: { at: [50, 15, 22], elbow: [-1, 0.3, 0.3] },
  },
  hand: { armNear: { palm: "up" }, armFar: { palm: "up" } },
});

type Cast = { id: string; at?: V3; yaw?: number; actions: ActionData[] };
const scene = (cast: Cast[], dur = 2) => {
  const all = cast.flatMap((c) => c.actions);
  const r = parseScene({
    duration: dur * Math.max(...cast.map((c) => c.actions.length)),
    lens: { eye: [0, -300, -900], yaw: 0, pitch: 10, f: 800, cx: 0, cy: 0 },
    cast: cast.map((c) => ({
      id: c.id,
      world: { at: c.at ?? [0, 0, 0], yaw: c.yaw ?? 0 },
      tracks: [
        { clips: [{ action: "stand-3d", start: 0 }] },
        { clips: c.actions.map((a, i) => ({ action: a.name, start: i * dur })) },
      ],
    })),
  });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(r.data, Object.fromEntries([STAND, ...all].map((a) => [a.name, a])));
};
const one = (actions: ActionData[], dur = 2) => scene([{ id: "a", actions }], dur);
const rules = (got: ReturnType<typeof sceneArms>) =>
  got.map((s) => `${s.hand} ${s.rule}${s.kind ? `-${s.kind}` : ""}`).sort();

/** Mặt bàn ngang ở độ cao `top` (y rig) trải trước người, như bàn của `arms-on-table-3d` */
const table =
  (top: number): PalmFrame["surface"] =>
  (_id, at: V3) =>
    Math.abs(at[0]) > 60 && Math.abs(at[0]) < 160 ? { gap: top - at[1], name: "bàn" } : null;

describe("sceneArms: tay sai dáng", () => {
  it("tay buông thẳng như que: khuỷu thẳng kiểu tay buông, gợi ý đổi dáng đứng", () => {
    const got = sceneArms(one([STICK]), { characterOf });
    expect(rules(got)).toEqual(["L straight-hang", "R straight-hang"]);
    expect(got[0].amount).toBeGreaterThanOrEqual(ARM_STRAIGHT);
    expect(armLine(got[0])).toContain("stand-3d");
  });

  it("đích ngoài tầm với: khuỷu thẳng kiểu đích, gợi ý kéo đích về gần vai", () => {
    const got = sceneArms(one([FAR]), { characterOf });
    expect(rules(got)).toEqual(["L straight-reach", "R straight-reach"]);
    expect(armLine(got[0])).toContain("kéo đích về gần vai");
  });

  it("clip `snap` miễn đo khuỷu ở đầu clip, không miễn cả clip", () => {
    const r = parseScene({
      duration: 2,
      lens: { eye: [0, -300, -900], yaw: 0, pitch: 10, f: 800, cx: 0, cy: 0 },
      cast: [
        {
          id: "a",
          world: { at: [0, 0, 0], yaw: 0 },
          tracks: [
            { clips: [{ action: "stand-3d", start: 0 }] },
            { clips: [{ action: "far", start: 0, snap: true }] },
          ],
        },
      ],
    });
    if (!r.success) throw new Error(r.error.message);
    const got = sceneArms(resolveScene(r.data, { "stand-3d": STAND, far: FAR }), { characterOf });
    expect(got.length).toBe(2);
    for (const s of got) expect(s.runs[0][0]).toBeGreaterThan(0.4);
  });

  it("hai bàn tay trước bụng chụm ngón vào nhau: báo; chồng tay bằng `otherBack` thì không", () => {
    const got = sceneArms(one([VEE]), { characterOf }).filter((s) => s.rule === "converge");
    expect(got.length).toBe(1);
    expect(got[0].split![0]).toBeGreaterThan(10);
    expect(got[0].split![1]).toBeGreaterThan(10);
    expect(sceneArms(one([STACK]), { characterOf }).filter((s) => s.rule === "converge")).toEqual(
      [],
    );
  });

  it("bàn tay dưới hông ngửa lên: báo; khai `palm: up` là cố ý, không báo", () => {
    const got = sceneArms(one([UP]), { characterOf }).filter((s) => s.rule === "upturn");
    expect(got.map((s) => s.hand).sort()).toEqual(["L", "R"]);
    for (const s of got) expect(s.face).toBe("up");
    expect(sceneArms(one([UP_MEANT]), { characterOf }).filter((s) => s.rule === "upturn")).toEqual(
      [],
    );
  });

  it("tay đặt bằng đích lơ lửng trên mặt bàn: báo khe; tay chạm mặt bàn thì không", () => {
    const hover = sceneArms(one([ON_TABLE]), {
      characterOf,
      frame: () => ({ surface: table(-210) }),
    }).filter((s) => s.rule === "hover");
    expect(hover.map((s) => s.hand).sort()).toEqual(["L", "R"]);
    for (const s of hover) {
      expect(s.on).toBe("bàn");
      expect(s.amount).toBeGreaterThan(4);
    }
    const touch = sceneArms(one([ON_TABLE]), {
      characterOf,
      frame: () => ({ surface: table(-221) }),
    }).filter((s) => s.rule === "hover");
    expect(touch).toEqual([]);
  });

  it("bàn tay lấn vào đầu người đứng trước mặt: báo tên người bị chạm", () => {
    const poke = arms("poke", {
      reach: { armNear: { at: [150, -330, 0], elbow: [-0.3, 1, 0.3] } },
    });
    const got = sceneArms(
      scene([
        { id: "a", actions: [poke] },
        { id: "b", at: [110, 0, 0], yaw: 180, actions: [STAND] },
      ]),
      { characterOf },
    ).filter((s) => s.rule === "head");
    expect(got.map((s) => `${s.id} ${s.hand} ${s.other}`)).toEqual(["a R b"]);
  });

  it("lướt qua dưới `hold` giây: không báo", () => {
    expect(sceneArms(one([STICK], 0.15), { characterOf })).toEqual([]);
  });
});
