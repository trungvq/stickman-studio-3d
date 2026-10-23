import { describe, expect, it } from "vitest";
import { fingerVec, HAND_DOF, HAND_POSES, HAND_RELAXED } from "./hand";
import {
  handShapeNameProblem,
  parseHandShape,
  shapeFingers,
  type HandShape,
  type HandShapes,
} from "./handLibrary";
import { parseAction } from "./action";
import { parseScene, resolveScene, SCENE_VERSION, sceneAt } from "./scene";

// Dáng tay có tên (`hands/<tên>.json`) và `pose` của mốc tay (docs/01-rig.md#dáng-tay-có-tên)

const N = HAND_DOF.length;
const PEACE: HandShape = {
  schemaVersion: 1,
  note: "chữ V",
  fingers: [37, 78, 29, 31, 0, 0, 90, 100, 8, 0],
  fit: [0, 0, 0, 0, -90, -100, 0, 0, 0, 0],
};
const LIB: HandShapes = { peace: PEACE };

function runtime(hands: unknown[], lib: HandShapes = LIB, clips = false) {
  const r = parseScene({
    duration: 4,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      {
        id: "a",
        ...(clips && { tracks: [{ clips: [{ start: 0, action: "chi" }] }] }),
        world: { at: [0, 0, 500], yaw: 270, hands },
      },
    ],
  });
  if (!r.success) throw new Error(r.error.message);
  const chi = parseAction({
    name: "chi",
    duration: 4,
    end: "hold",
    authoredAt: "side",
    mask: ["armNear", "armFar", "hand"],
    keys: [
      {
        t: 0,
        pose: { armNear: [10, 20, 0], armFar: [10, 20, 0] },
        hand: { armNear: "point", armFar: "point" },
      },
    ],
  });
  if (!chi.success) throw new Error(chi.error.message);
  return resolveScene(r.data, clips ? { chi: chi.data } : {}, {}, {}, {}, {}, {}, lib);
}

/** Số bàn tay phải, trái ở `t`: tay phải là kênh gần khi không lật */
const hands = (rt: ReturnType<typeof runtime>, t: number) => {
  const sp = sceneAt(rt, "a", t);
  const flip = !!sp.world?.flip;
  return { right: sp.pose.hand?.[flip ? "af" : "an"], left: sp.pose.hand?.[flip ? "an" : "af"] };
};
const near = (rt: ReturnType<typeof runtime>, t: number) => hands(rt, t).right;

describe("file dáng tay", () => {
  it("nạp: thiếu `schemaVersion` là bản hiện hành, `fit` tuỳ chọn; bản khác là lỗi phiên bản", () => {
    const r = parseHandShape({ fingers: PEACE.fingers });
    expect(r.success).toBe(true);
    expect(r.data!.schemaVersion).toBe(1);
    expect(r.data!.fit).toBeUndefined();
    expect(parseHandShape({ ...PEACE, schemaVersion: 2 }).error!.message).toMatch(/phiên bản/);
    expect(parseHandShape({ fingers: [1, 2, 3] }).success).toBe(false);
  });

  it("tên: chữ thường, số, gạch nối, không trùng dáng có sẵn", () => {
    expect(handShapeNameProblem("chu-v")).toBeUndefined();
    expect(handShapeNameProblem("Chu V")).toMatch(/chữ thường/);
    expect(handShapeNameProblem("fist")).toMatch(/dáng có sẵn/);
  });

  it("hai mươi số ngón: dáng có sẵn `fit` 0, thư viện kèm `fit`, `w` hoà từ dáng nghỉ cả `fit`", () => {
    expect(shapeFingers("fist")).toEqual([...fingerVec(HAND_POSES.fist), ...Array(10).fill(0)]);
    expect(shapeFingers("peace", LIB)).toEqual([...PEACE.fingers, ...PEACE.fit!]);
    expect(shapeFingers("khong-co", LIB)).toBeUndefined();
    const half = shapeFingers("peace", LIB, 0.5)!;
    const rest = fingerVec(HAND_RELAXED);
    expect(half[0]).toBeCloseTo((rest[0] + PEACE.fingers[0]) / 2);
    expect(half[14]).toBeCloseTo(PEACE.fit![4] / 2);
  });
});

describe("`pose` của mốc tay", () => {
  it("schema: mốc chỉ có `pose`; `pose` không đi với `hold`; mốc chỉ `pose` không kèm hướng; `w` cần `pose`", () => {
    const p = (right: unknown) =>
      parseScene({
        duration: 1,
        lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
        cast: [{ id: "a", world: { at: [0, 0, 500], hands: [{ t: 0, right }] } }],
      });
    expect(p({ pose: "fist" }).success).toBe(true);
    expect(p({ at: [0, -200, 450], pose: "fist", w: 0.5 }).success).toBe(true);
    expect(p({ pose: "fist", hold: null }).error!.message).toMatch(/bỏ `pose`/);
    expect(p({ pose: "fist", palm: "up" }).error!.message).toMatch(/chỉ có `pose`/);
    expect(p({ at: [0, -200, 450], w: 0.5 }).error!.message).toMatch(/`w` chỉ đi với `pose`/);
    expect(p({}).success).toBe(false);
    expect(SCENE_VERSION).toBe(34);
  });

  it("tên không có trong thư viện: `resolveScene` báo rõ", () => {
    expect(() => runtime([{ t: 0, right: { pose: "khong-co" } }])).toThrow(
      /không có dáng tay `khong-co`.*hands\/khong-co\.json/,
    );
    expect(() => runtime([{ t: 0, right: { pose: "peace" } }], {})).toThrow(/peace/);
  });

  it("đè ngón của hành động, giữ xoay và gập cổ tay; tay trái cùng góc", () => {
    const rt = runtime([{ t: 0, right: { pose: "peace" }, left: { pose: "fist" } }]);
    const h = hands(rt, 1);
    expect(h.right).toEqual([0, 0, ...PEACE.fingers, ...PEACE.fit!]);
    expect(h.left?.slice(2, N)).toEqual(fingerVec(HAND_POSES.fist));
  });

  it("giữa hai mốc hoà ngón và `fit`; mốc không khai `pose` là ngón của hành động", () => {
    const rt = runtime(
      [
        { t: 0, right: { pose: "peace" } },
        { t: 2, right: { pose: "fist", ease: "linear" } },
        { t: 3, right: { at: [0, -200, 450], ease: "linear" } },
      ],
      LIB,
      true,
    );
    const mid = near(rt, 1)!;
    expect(mid[2]).toBeCloseTo((PEACE.fingers[0] + HAND_POSES.fist.thumb[0]) / 2);
    expect(mid[N + 4]).toBeCloseTo(PEACE.fit![4] / 2);
    expect(near(rt, 3)!.slice(2, N)).toEqual(fingerVec(HAND_POSES.point));
    expect(near(rt, 3.5)!.slice(2, N)).toEqual(fingerVec(HAND_POSES.point));
  });

  it("mốc chỉ có `pose` không đụng tới đích tay", () => {
    const keys = [
      { t: 0, right: { at: [0, -200, 450] } },
      { t: 2, right: { at: [40, -220, 450] } },
    ];
    const plain = runtime(keys);
    const shaped = runtime([keys[0], { t: 1, right: { pose: "fist" } }, keys[1]]);
    for (const t of [0.5, 1, 1.5])
      expect(sceneAt(shaped, "a", t).world).toStrictEqual(sceneAt(plain, "a", t).world);
    expect(near(shaped, 1)?.slice(2, N)).toEqual(fingerVec(HAND_POSES.fist));
  });
});
