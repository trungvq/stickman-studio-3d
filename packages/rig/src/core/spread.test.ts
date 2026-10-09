import { describe, expect, it } from "vitest";

import {
  actionDelta,
  actionStride,
  actJoints,
  composePose,
  D,
  defaultCharacter,
  deltaPose,
  facing,
  feet,
  figure3d,
  orbit,
  parseAction,
  POSES,
  RIG,
  type Pose,
  type V3,
  type World,
} from "./index";

const c = defaultCharacter();
const lens = orbit({ target: [0, -120, 0], dist: 750, yaw: 45 * D, pitch: 16 * D, f: 800 });
const hip: V3 = [0, -200, 0];
const LIFT = { af: true, an: true, lf: true, ln: true };
const stand: Pose = {
  ...POSES.idle,
  af: [0, 0, 0],
  an: [0, 0, 0],
  lf: [0, 0],
  ln: [0, 0],
  torso: 0,
  head: [0, 0, 0],
  lift: LIFT,
};

const worldOf = (yaw: number): World => {
  const f = facing(lens, hip, yaw);
  return { lens, hip, yaw: f.yaw, s: 1, flip: f.flip, theta: f.theta };
};
/** Phía phải của người trong thế giới rig */
const right = (w: World): V3 => [-Math.sin(w.yaw), 0, -Math.cos(w.yaw)];
const lateral = (p: V3, w: World) => {
  const R = right(w);
  return (p[0] - hip[0]) * R[0] + (p[2] - hip[2]) * R[2];
};

describe("dang tay chân và nghiêng thân của người 3D", () => {
  for (const yaw of [-20 * D, 160 * D]) {
    const w = worldOf(yaw);
    const near = w.flip ? -1 : 1;
    const joints = (P: Pose) => actJoints(c, { pose: P, world: w })!;
    const joints3 = (P: Pose) => figure3d(c, P, w).joints;

    it(`dang dương đưa cổ tay và bàn chân ra ngoài, bàn chân lên theo cos (${w.flip ? "lật" : "không lật"})`, () => {
      const P = { ...stand, an: [0, 0, 0, 60], ln: [0, 0, 30] } as Pose;
      const wr = w.flip ? "wristL" : "wristR";
      const ft = w.flip ? "footL" : "footR";
      expect(near * lateral(joints(P)[wr], w)).toBeGreaterThan(
        near * lateral(joints(stand)[wr], w) + 40,
      );
      expect(near * lateral(joints(P)[ft], w)).toBeGreaterThan(
        near * lateral(joints(stand)[ft], w) + 40,
      );
      expect(near * lateral(joints3(P).wristNear, w)).toBeGreaterThan(
        near * lateral(joints3(stand).wristNear, w) + 40,
      );
      expect(near * lateral(joints3(P).footNear, w)).toBeGreaterThan(
        near * lateral(joints3(stand).footNear, w) + 40,
      );
      const leg = (RIG.thigh + RIG.shin) * c.rig.height;
      expect(feet(P, c.rig.height, RIG, true)[1][1]).toBeCloseTo(leg * Math.cos(30 * D), 6);
      expect(feet(P, c.rig.height)[1][1]).toBeCloseTo(leg, 6);
      expect(joints3(P).footNear[1] - hip[1]).toBeCloseTo(leg * Math.cos(30 * D), 6);
    });

    it(`dang của kênh giữ 2D không đổi khớp người 3D (${w.flip ? "lật" : "không lật"})`, () => {
      const P = { ...stand, an: [0, 0, 0, 60], lift: { ...LIFT, an: false } } as Pose;
      expect(joints(P)).toEqual(joints({ ...stand, lift: P.lift }));
    });

    it(`nghiêng thân dương về cùng phía với nghiêng đầu dương (${w.flip ? "lật" : "không lật"})`, () => {
      const lean = lateral(joints({ ...stand, lean: 20 }).neck, w);
      const tilt =
        lateral(joints({ ...stand, head: [20, 0, 0] }).head, w) - lateral(joints(stand).head, w);
      expect(Math.abs(lean)).toBeGreaterThan(20);
      expect(Math.sign(lean)).toBe(Math.sign(tilt));
      // phía tay xa
      expect(Math.sign(lean)).toBe(-near);
      // người SVG đo cổ ở đầu đoạn cổ, three ở gốc cổ: cùng phía, lệch nhau bằng đoạn cổ
      const lean3 = lateral(joints3({ ...stand, lean: 20 }).neck, w);
      expect(Math.sign(lean3)).toBe(Math.sign(lean));
      expect(Math.abs(lean3 / lean - 1)).toBeLessThan(0.1);
    });
  }

  it("thân `[cúi, nghiêng]` nội suy chung với thân một số; tay ba số với bốn số", () => {
    const r = parseAction({
      name: "x",
      duration: 1,
      end: "hold",
      authoredAt: "side",
      keys: [
        { t: 0, pose: { torso: 10, armNear: [0, 0, 0] } },
        { t: 1, pose: { torso: [20, 30], armNear: [0, 0, 0, 90] } },
      ],
    });
    if (!r.success) throw new Error(r.error.message);
    const d = actionDelta(r.data, 0.5);
    expect(d.torso).toEqual([15, 15]);
    expect(d.armNear).toEqual([0, 0, 0, 45]);
    const p = deltaPose(d);
    expect([p.torso, p.lean]).toEqual([15, 15]);
  });

  it("chân đang bước dang ra không bị tính là chân trụ: hành động `side` đo quãng trôi có tính dang", () => {
    const json = (authoredAt?: "side") => ({
      name: "x",
      duration: 1,
      end: "hold",
      ...(authoredAt && { authoredAt }),
      keys: [
        { t: 0, pose: { legNear: [0, 0], legFar: [0, 0] }, ease: "smooth" },
        { t: 0.4, pose: { legNear: [0, 0, 40], legFar: [0, 0] }, ease: "smooth" },
        { t: 1, pose: { legNear: [8, 0, 40], legFar: [0, 0] } },
      ],
    });
    const side = parseAction(json("side"));
    const flat = parseAction(json());
    if (!side.success || !flat.success) throw new Error("parse");
    expect(Math.abs(actionStride(side.data))).toBeLessThan(1);
    expect(Math.abs(actionStride(flat.data))).toBeGreaterThan(5);
  });

  it("lớp trên ghi thân mà không nghiêng là thân thẳng", () => {
    const leaned = composePose(stand, deltaPose({ torso: [5, 20] }));
    expect(leaned.lean).toBe(20);
    expect(composePose(leaned, deltaPose({ torso: 8 })).lean).toBe(0);
    expect(composePose(leaned, deltaPose({ armNear: [10, 0, 0] })).lean).toBe(20);
  });
});
