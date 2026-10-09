import { describe, expect, it } from "vitest";

import { parseAction, type ActionData } from "./action";
import { hipHoldShift, placeAnchor } from "./anchor";
import { feet } from "./geometry";
import { POSES } from "./poses";
import { defaultCharacter } from "./schema";
import { legShare, parseScene, resolveScene } from "./scene";
import type { Pose } from "./types";

const action = (json: unknown): ActionData => {
  const r = parseAction(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

const ACTIONS = {
  sit: action({
    name: "sit",
    duration: 1,
    keys: [{ t: 0, pose: { legFar: [76, -76], legNear: [76, -76] } }],
  }),
  wave: action({
    name: "wave",
    duration: 1,
    keys: [{ t: 0, pose: { armNear: [-140, -8, 0] } }],
  }),
  kneel: action({
    name: "kneel",
    duration: 1,
    keys: [{ t: 0, pose: { legFar: [-8, -82], legNear: [-18, -72] } }],
  }),
};

const lowest = (P: Pose, legs?: { thigh: number; shin: number }) =>
  Math.max(...feet(P, 1, legs).map((f) => f[1]));

function run(cast: unknown[]) {
  const r = parseScene({ cast });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(r.data, ACTIONS);
}

const seated = (name: string) => name.startsWith("sit");

describe("`feet` với độ dài chân khác", () => {
  it("mặc định là chân của rig", () => {
    expect(feet(POSES.sit, 1)).toStrictEqual(feet(POSES.sit, 1, { thigh: 78, shin: 92 }));
  });

  it("chân `82 / 78` ngồi `[60, −60]` cho hông cách sàn đúng `119`", () => {
    const P = { ...POSES.idle, lf: [60, -60], ln: [60, -60] } as Pose;
    expect(lowest(P, { thigh: 82, shin: 78 })).toBeCloseTo(119, 9);
  });

  it("nhân `height` và `stretch` như chân của rig", () => {
    const P = { ...POSES.idle, ln: [20, -20], stretch: [1, 1, 1, 1, 0.75, 1.4, 0.75, 1.4] } as Pose;
    const [, near] = feet(P, 0.9, { thigh: 82, shin: 78 });
    expect(near[1]).toBeCloseTo(0.9 * (82 * 0.75 * Math.cos((20 * Math.PI) / 180) + 78 * 1.4), 9);
  });
});

describe("`hipHoldShift` giữ hông đứng yên", () => {
  const c = defaultCharacter();
  const low = (P: Pose) => lowest(P);
  for (const spot of [
    { x: 40, groundY: 280, scale: 0.8, flip: false, rotate: 0 },
    { x: 92, groundY: 70.7, scale: 1, flip: false, rotate: 84 },
    { x: -170, groundY: 285, scale: 1.3, flip: true, rotate: 45 },
  ])
    it(`scale ${spot.scale}, xoay ${spot.rotate}, lật ${spot.flip}`, () => {
      const a = POSES.idle;
      const b = POSES.sit;
      const s = hipHoldShift(spot, low(b) - low(a));
      const before = placeAnchor(c, a, "hip", spot);
      const after = placeAnchor(c, b, "hip", {
        ...spot,
        x: spot.x + s.x,
        groundY: spot.groundY + s.y,
      });
      expect(after.x).toBeCloseTo(before.x, 9);
      expect(after.y).toBeCloseTo(before.y, 9);
    });
});

describe("`legShare`: phần chân đến từ clip ngồi", () => {
  it("clip ngồi từ giây 0 là `1` suốt, clip tay đè lên không đổi gì", () => {
    const rt = run([
      {
        id: "a",
        tracks: [
          { clips: [{ action: "sit", start: 0 }] },
          { clips: [{ action: "wave", start: 0.5 }] },
        ],
      },
    ]);
    for (const t of [0, 0.4, 0.6, 3]) expect(legShare(rt, "a", t, seated)).toBe(1);
  });

  it("nhả clip ngồi thì hoà về nền theo smoothstep", () => {
    const rt = run([
      {
        id: "a",
        tracks: [
          {
            clips: [
              { action: "sit", start: 0 },
              { start: 2, blend: 0.5 },
            ],
          },
        ],
      },
    ]);
    expect(legShare(rt, "a", 1.9, seated)).toBe(1);
    expect(legShare(rt, "a", 2.25, seated)).toBeCloseTo(0.5, 9);
    expect(legShare(rt, "a", 2.5, seated)).toBe(0);
    expect(legShare(rt, "a", 2.5, seated, 1)).toBe(1);
  });

  it("hành động chân không phải ngồi đè lên nền ngồi", () => {
    const rt = run([{ id: "a", tracks: [{ clips: [{ action: "kneel", start: 0 }] }] }]);
    expect(legShare(rt, "a", 1, seated, 1)).toBe(0);
  });

  it("`mask` bỏ chân thì clip ngồi không ghi gì", () => {
    const rt = run([
      { id: "a", tracks: [{ clips: [{ action: "sit", start: 0, mask: ["armNear"] }] }] },
    ]);
    expect(legShare(rt, "a", 1, seated)).toBe(0);
  });
});
