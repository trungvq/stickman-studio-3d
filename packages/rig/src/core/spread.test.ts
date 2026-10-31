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
const LIFT = { al: true, ar: true, ll: true, lr: true };
const stand: Pose = {
  ...POSES.idle,
  al: [0, 0, 0],
  ar: [0, 0, 0],
  ll: [0, 0],
  lr: [0, 0],
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
    const joints = (P: Pose) => actJoints(c, { pose: P, world: w })!;
    const joints3 = (P: Pose) => figure3d(c, P, w).joints;

    it(`dang dương đưa cổ tay và bàn chân ra ngoài, bàn chân lên theo cos (${w.flip ? "lật" : "không lật"})`, () => {
      const P = { ...stand, ar: [0, 0, 0, 60], lr: [0, 0, 30] } as Pose;
      const [wr, ft] = ["wristR", "footR"] as const;
      expect(lateral(joints(P)[wr], w)).toBeGreaterThan(lateral(joints(stand)[wr], w) + 40);
      expect(lateral(joints(P)[ft], w)).toBeGreaterThan(lateral(joints(stand)[ft], w) + 40);
      expect(lateral(joints3(P).wristRight, w)).toBeGreaterThan(
        lateral(joints3(stand).wristRight, w) + 40,
      );
      expect(lateral(joints3(P).footRight, w)).toBeGreaterThan(
        lateral(joints3(stand).footRight, w) + 40,
      );
      const leg = (RIG.thigh + RIG.shin) * c.rig.height;
      expect(feet(P, c.rig.height, true)[1][1]).toBeCloseTo(leg * Math.cos(30 * D), 6);
      expect(feet(P, c.rig.height)[1][1]).toBeCloseTo(leg, 6);
      expect(joints3(P).footRight[1] - hip[1]).toBeCloseTo(leg * Math.cos(30 * D), 6);
    });

    it(`xoắn vai: tay dang ngang, khuỷu gập 90, xoay ngoài 90 là cẳng tay dựng lên — actJoints và figure3d cùng chiều (${w.flip ? "lật" : "không lật"})`, () => {
      const P = { ...stand, ar: [0, 90, 0, 90, 90] } as Pose;
      const [el, wr] = ["elbowR", "wristR"];
      const J = joints(P);
      expect(J[el as "elbowR"][1] - J[wr as "wristR"][1]).toBeGreaterThan(50);
      const J3 = joints3(P);
      expect(J3.elbowRight[1] - J3.wristRight[1]).toBeGreaterThan(50);
      // khuỷu dưới 90 thì cẳng tay ngả ra ngoài, xa đầu: lắc khuỷu là vẫy qua lại
      const out = { ...stand, ar: [0, 60, 0, 90, 90] } as Pose;
      const Jo = joints(out);
      expect(lateral(Jo[wr as "wristR"], w) - lateral(Jo[el as "elbowR"], w)).toBeGreaterThan(20);
      expect(
        lateral(joints3(out).wristRight, w) - lateral(joints3(out).elbowRight, w),
      ).toBeGreaterThan(20);
      // xoay trong: cẳng tay chúc xuống
      const down = { ...stand, ar: [0, 90, 0, 90, -90] } as Pose;
      expect(joints3(down).wristRight[1] - joints3(down).elbowRight[1]).toBeGreaterThan(50);
    });

    it(`dang của kênh không nâng không đổi khớp người 3D (${w.flip ? "lật" : "không lật"})`, () => {
      const P = { ...stand, ar: [0, 0, 0, 60], lift: { ...LIFT, ar: false } } as Pose;
      expect(joints(P)).toEqual(joints({ ...stand, lift: P.lift }));
    });

    it(`nghiêng thân dương về cùng phía với nghiêng đầu dương (${w.flip ? "lật" : "không lật"})`, () => {
      const lean = lateral(joints({ ...stand, lean: 20 }).neck, w);
      const tilt =
        lateral(joints({ ...stand, head: [20, 0, 0] }).head, w) - lateral(joints(stand).head, w);
      expect(Math.abs(lean)).toBeGreaterThan(20);
      expect(Math.sign(lean)).toBe(Math.sign(tilt));
      // về bên trái người
      expect(Math.sign(lean)).toBe(-1);
      // `actJoints` và `figure3d` đo cổ ở hai đầu đoạn cổ: cùng phía, lệch nhau bằng đoạn cổ
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
        { t: 0, pose: { torso: 10, armRight: [0, 0, 0] } },
        { t: 1, pose: { torso: [20, 30], armRight: [0, 0, 0, 90] } },
      ],
    });
    if (!r.success) throw new Error(r.error.message);
    const d = actionDelta(r.data, 0.5);
    expect(d.torso).toEqual([15, 15]);
    expect(d.armRight).toEqual([0, 0, 0, 45]);
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
        { t: 0, pose: { legRight: [0, 0], legLeft: [0, 0] }, ease: "smooth" },
        { t: 0.4, pose: { legRight: [0, 0, 40], legLeft: [0, 0] }, ease: "smooth" },
        { t: 1, pose: { legRight: [8, 0, 40], legLeft: [0, 0] } },
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
    expect(composePose(leaned, deltaPose({ armRight: [10, 0, 0] })).lean).toBe(20);
  });
});
