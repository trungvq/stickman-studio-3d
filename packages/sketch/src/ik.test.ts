import { describe, expect, it } from "vitest";

import armsJson from "../../../apps/studio/public/actions/arms-on-table-3d.json";
import typeJson from "../../../apps/studio/public/actions/type-3d.json";

import {
  ACTION_VERSION,
  type ActionData,
  actionMask,
  actionPose,
  blendPose,
  body3,
  composePose,
  computeFigure,
  D,
  defaultCharacter,
  dot3,
  facing,
  figure3d,
  handsOn,
  lengths,
  limbHalf,
  orbit,
  parseAction,
  parseScene,
  type Pose,
  POSES,
  project,
  REACH_ELBOW,
  reachAngles,
  reachToWorld,
  resolveScene,
  sceneAt,
  type SceneRuntime,
  solveTwoBone,
  sub3,
  type V3,
  type World,
  worldToReach,
} from "@stickman3d/rig/core";
import { anchorAt, figureAnchors } from "./anchor";

const c = defaultCharacter();
const len = lengths(c.rig.height);
const dist = (a: V3, b: V3) => Math.hypot(...sub3(a, b));
const lens = orbit({ target: [0, -120, 0], dist: 750, yaw: 45 * D, pitch: 16 * D, f: 800 });

function action(json: unknown): ActionData {
  const r = parseAction(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}

const sitPose: Pose = {
  ...POSES.sit,
  lf: [90, -90],
  ln: [90, -90],
  af: [11, 42, 0],
  an: [11, 42, 0],
  torso: 3,
  lift: { af: true, an: true, lf: true, ln: true },
};
const placed = (hip: V3, yaw: number, extra: Partial<World> = {}): World => {
  const f = facing(lens, hip, yaw);
  return { lens, hip, yaw: f.yaw, s: 1, flip: f.flip, theta: f.theta, ...extra };
};

describe("IK hai đoạn", () => {
  const root: V3 = [0, -200, 0];
  const pole: V3 = [-0.4, 1, 0.5];

  it("đích trong tầm: đầu chi đúng đích, hai đoạn giữ độ dài", () => {
    for (const target of [
      [80, -150, 20],
      [30, -120, -40],
      [10, -210, 60],
    ] as V3[]) {
      const [s, e, w] = solveTwoBone(root, target, 62, 58, pole);
      expect(dist(w, target)).toBeLessThanOrEqual(0.5);
      expect(dist(s, e)).toBeCloseTo(62, 6);
      expect(dist(e, w)).toBeCloseTo(58, 6);
    }
  });

  it("đích ngoài tầm: duỗi thẳng về phía đích, không kéo dài", () => {
    const target: V3 = [300, -100, 40];
    const [s, e, w] = solveTwoBone(root, target, 62, 58, pole);
    expect(dist(s, e)).toBeCloseTo(62, 6);
    expect(dist(e, w)).toBeCloseTo(58, 6);
    expect(dist(s, w)).toBeCloseTo(120, 6);
    const n = sub3(target, root).map((v) => v / dist(target, root));
    const got = sub3(w, s).map((v) => v / 120);
    for (let i = 0; i < 3; i++) expect(got[i]).toBeCloseTo(n[i], 6);
  });

  it("hướng khuỷu được tôn trọng: khuỷu về phía `pole`, đảo `pole` thì khuỷu đổi bên", () => {
    const target: V3 = [70, -150, 0];
    const axis = sub3(target, root).map((v) => v / dist(target, root)) as V3;
    const side = (p: V3) => {
      const e = solveTwoBone(root, target, 62, 58, p)[1];
      const off = sub3(e, root);
      const perp = sub3(off, axis.map((v) => v * dot3(off, axis)) as V3);
      return dot3(perp, p);
    };
    expect(side([0, 1, 0])).toBeGreaterThan(0);
    expect(side([0, -1, 0])).toBeGreaterThan(0);
    expect(side([0, 0, 1])).toBeGreaterThan(0);
    const down = solveTwoBone(root, target, 62, 58, [0, 1, 0])[1];
    const up = solveTwoBone(root, target, 62, 58, [0, -1, 0])[1];
    expect(down[1]).toBeGreaterThan(up[1]);
  });

  it("góc dự phòng trong mặt phẳng dọc đưa cổ tay tới đích ở số đo mặc định", () => {
    const at: V3 = [90, -60, 0];
    const [a0, a1] = reachAngles({ at }, 0);
    const shY = -len.torso + c.rig.shoulderDrop;
    const ex = Math.sin(a0 * D) * len.upperArm;
    const ey = shY + Math.cos(a0 * D) * len.upperArm;
    const wx = ex + Math.sin((a0 + a1) * D) * len.foreArm;
    const wy = ey + Math.cos((a0 + a1) * D) * len.foreArm;
    expect(Math.hypot(wx - at[0], wy - at[1])).toBeLessThanOrEqual(0.5);
    // hướng khuỷu mặc định lùi về sau: khuỷu gập dương như tay đặt lên bàn
    expect(a1).toBeGreaterThan(0);
  });
});

describe("đích cổ tay của người 3D", () => {
  const hip: V3 = [0, -127 - limbHalf(c).leg, 0];

  it("đích hệ thân: cổ tay tới đúng điểm `[tiến, y, ra ngoài]` quanh hông, cả khi `stretch` dài tay", () => {
    const w = placed(hip, 0);
    const reach = {
      an: { at: [100, -55, 22] as V3, w: 1 },
      af: { at: [100, -55, 22] as V3, w: 1 },
    };
    const stretched: Pose = { ...sitPose, stretch: [1, 1, 1.2, 1.1, 1, 1, 1, 1], reach };
    const f3 = figure3d(c, stretched, w);
    const R: V3 = [-Math.sin(w.yaw), 0, -Math.cos(w.yaw)];
    const near = w.flip ? -1 : 1;
    const want = (out: number): V3 => [
      hip[0] + 100 * Math.cos(w.yaw) + 22 * out * R[0],
      hip[1] - 55,
      hip[2] - 100 * Math.sin(w.yaw) + 22 * out * R[2],
    ];
    expect(dist(f3.joints.wristNear, want(near))).toBeLessThanOrEqual(0.5);
    expect(dist(f3.joints.wristFar, want(-near))).toBeLessThanOrEqual(0.5);
    expect(dist(f3.joints.shoulderNear, f3.joints.elbowNear)).toBeCloseTo(len.upperArm * 1.2, 6);
    expect(dist(f3.joints.elbowNear, f3.joints.wristNear)).toBeCloseTo(len.foreArm * 1.1, 6);
  });

  it("nét vẽ: cổ tay đúng chỗ chiếu thật của khớp, mốc `anchorAt` đọc lại đúng nó", () => {
    const w = placed(hip, 0);
    const P: Pose = { ...sitPose, reach: { an: { at: [100, -55, 22], w: 1 } } };
    const fa = figureAnchors(c, P, { body: "rear", head: "rear" }, "closed", w);
    const [wx, wy] = project(lens, fa.fig3!.joints.wristNear);
    const [hx, hy] = project(lens, w.hip);
    const mx = w.flip ? -1 : 1;
    const k = fa.fig3!.k;
    const drawn = fa.fig.armN[2];
    const torso = fa.fig3!.torsoDeg * D;
    // tay vẽ trong khung thân: quay về khung người rồi so
    const x = drawn[0] * Math.cos(torso) - drawn[1] * Math.sin(torso);
    const y = drawn[0] * Math.sin(torso) + drawn[1] * Math.cos(torso);
    expect(x).toBeCloseTo((mx * (wx - hx)) / k, 4);
    expect(y).toBeCloseTo((wy - hy) / k, 4);
  });

  it("hoà giữa góc và đích không giật: cổ tay đi liền, độ dài đoạn giữ nguyên suốt đoạn hoà", () => {
    const w = placed(hip, 0);
    const from: Partial<Pose> = { an: [11, 42, 0], af: [11, 42, 0], lift: { an: true, af: true } };
    const to: Partial<Pose> = {
      an: reachAngles({ at: [100, -55, 22] }, 3),
      af: reachAngles({ at: [100, -55, 22] }, 3),
      lift: { an: true, af: true },
      reach: { an: { at: [100, -55, 22], w: 1 }, af: { at: [100, -55, 22], w: 1 } },
    };
    let prev: V3 | undefined;
    let jump = 0;
    for (let i = 0; i <= 50; i++) {
      const P = composePose(sitPose, blendPose(sitPose, from, to, i / 50));
      const j = figure3d(c, P, w).joints;
      expect(dist(j.shoulderNear, j.elbowNear)).toBeCloseTo(len.upperArm, 6);
      expect(dist(j.elbowNear, j.wristNear)).toBeCloseTo(len.foreArm, 6);
      if (prev) jump = Math.max(jump, dist(prev, j.wristNear));
      prev = j.wristNear;
    }
    // 51 khung qua quãng ~60 đơn vị: không khung nào nhảy quá vài đơn vị
    expect(jump).toBeLessThan(5);
    // hai đầu đúng hai bên
    const a = figure3d(c, composePose(sitPose, blendPose(sitPose, from, to, 0)), w).joints;
    const b = figure3d(c, { ...sitPose, an: [11, 42, 0] }, w).joints;
    expect(dist(a.wristNear, b.wristNear)).toBeLessThan(1e-6);
  });

  it("người 2D không đọc đích: hình như tư thế không có đích", () => {
    const P: Pose = { ...POSES.idle, reach: { an: { at: [100, -55, 22], w: 1 } } };
    const plain = computeFigure(c, { ...POSES.idle });
    expect(computeFigure(c, P)).toStrictEqual(plain);
  });
});

describe("hành động có đích cổ tay", () => {
  const typing = action({
    name: "go",
    duration: 1,
    authoredAt: "side",
    keys: [
      { t: 0, pose: { torso: 8 }, reach: { armNear: { at: [95, -60, 12] } } },
      { t: 0.5, pose: { torso: 8 }, reach: { armNear: { at: [95, -66, 12] } } },
    ],
  });

  it("đời 14; `mask` suy ra gồm kênh tay mà mốc chỉ ghi bằng đích", () => {
    expect(ACTION_VERSION).toBe(14);
    expect(actionMask(typing)).toEqual(["armNear", "torso"]);
  });

  it("đích nội suy giữa hai mốc; người 2D nhận góc dự phòng", () => {
    const p = actionPose(typing, 0.25);
    expect(p.reach?.an?.at[1]).toBeCloseTo(-63, 6);
    expect(p.reach?.an?.w).toBe(1);
    expect(p.reach?.an?.elbow).toEqual(REACH_ELBOW);
    expect(p.an).toBeDefined();
    const a = reachAngles({ at: [95, -60, 12] }, 8);
    expect(actionPose(typing, 0).an).toEqual(a);
  });

  it("động vật không có đích cổ tay", () => {
    const r = parseAction({
      actor: "animal",
      keys: [{ t: 0, pose: {}, reach: { armNear: { at: [1, 2, 3] } } }],
    });
    expect(r.success).toBe(false);
  });
});

describe("đích cổ tay thế giới (`cast[].world.hands`)", () => {
  const SEAT = -94.5;
  const TOP = -150;
  const TABLE: [number, number][] = [
    [-150, -80],
    [150, -80],
    [150, 80],
    [-150, 80],
  ];
  const ACTIONS: Record<string, ActionData> = {
    sit: action({
      name: "sit",
      duration: 3.4,
      authoredAt: "side",
      mask: ["armFar", "armNear", "legFar", "legNear", "torso"],
      keys: [
        {
          t: 0,
          pose: {
            armFar: [11, 42, 0],
            armNear: [11, 42, 0],
            legFar: [90, -90],
            legNear: [90, -90],
            torso: 3,
          },
        },
        {
          t: 0.5,
          pose: {
            armFar: [12, 42, 0],
            armNear: [12, 42, 0],
            legFar: [90, -90],
            legNear: [90, -90],
            torso: 4,
          },
        },
      ],
    }),
  };
  const LENS = { eye: lens.eye, yaw: 45, pitch: 16, f: 800, cx: 0, cy: 0 };
  function scene(world: object): SceneRuntime {
    const r = parseScene({
      lens: LENS,
      duration: 4,
      cast: [{ id: "a", base: "sit", world, tracks: [{ clips: [{ action: "sit", start: 0 }] }] }],
    });
    if (!r.success) throw new Error(r.error.message);
    return resolveScene(r.data, ACTIONS);
  }

  it("tay phải là tay gần khi không lật; cổ tay tới đúng đích; `null` nhả dần về góc", () => {
    const rt = scene({
      at: [-231, SEAT, 0],
      yaw: 0,
      sit: true,
      hands: [
        { t: 0, right: { at: [-131, -154, -30] }, left: { at: [-131, -154, 30] } },
        { t: 2, right: { at: [-131, -154, -30] } },
        { t: 3, right: null },
      ],
    });
    const sp = sceneAt(rt, "a", 1, c.rig.height, body3(c));
    const w = sp.world!;
    const j = figureAnchors(c, sp.pose, { body: sp.view, head: sp.headView }, "closed", w).fig3!
      .joints;
    const [r, l] = w.flip ? [j.wristFar, j.wristNear] : [j.wristNear, j.wristFar];
    expect(dist(r, [-131, -154, -30])).toBeLessThanOrEqual(0.5);
    expect(dist(l, [-131, -154, 30])).toBeLessThanOrEqual(0.5);
    // giữa mốc 2 và mốc thả 3: còn một phần đích
    const mid = sceneAt(rt, "a", 2.5, c.rig.height, body3(c)).world!;
    const h = w.flip ? mid.hands?.far : mid.hands?.near;
    expect(h?.w).toBeCloseTo(0.5, 6);
    // sau mốc thả: tay phải theo góc của hành động, tay trái giữ đích
    const end = sceneAt(rt, "a", 3.5, c.rig.height, body3(c)).world!;
    expect(w.flip ? end.hands?.far : end.hands?.near).toBeUndefined();
    expect(w.flip ? end.hands?.near : end.hands?.far).toBeDefined();
  });

  it("tay trên mặt bàn ở hai khoảng cách ghế: cổ tay chạm mặt, cẳng tay không xuyên mặt", () => {
    for (const gap of [61, 96]) {
      const rt0 = scene({ at: [-150 - gap, SEAT, 0], yaw: 0, sit: true });
      const sp0 = sceneAt(rt0, "a", 0, c.rig.height, body3(c));
      const hands = handsOn(c, sp0.pose, sp0.world!, { y: TOP, poly: TABLE });
      expect(hands.right && hands.left).toBeTruthy();
      const rt = scene({
        at: [-150 - gap, SEAT, 0],
        yaw: 0,
        sit: true,
        hands: [{ t: 0, right: hands.right, left: hands.left }],
      });
      for (const t of [0, 1.7]) {
        const sp = sceneAt(rt, "a", t, c.rig.height, body3(c));
        const f3 = figureAnchors(
          c,
          sp.pose,
          { body: sp.view, head: sp.headView },
          "closed",
          sp.world,
        ).fig3!;
        const half = limbHalf(c).arm;
        for (const side of ["Near", "Far"] as const) {
          const wr = f3.joints[`wrist${side}`];
          // chạm mặt: đáy cẳng tay ở cổ tay nằm đúng trên mặt bàn, trong mép bàn
          expect(wr[1] + half).toBeCloseTo(TOP, 1);
          expect(wr[0]).toBeGreaterThan(-150);
          // không xuyên: phần cẳng tay nằm trên mặt bàn (trong mép) không thấp hơn mặt
          const el = f3.joints[`elbow${side}`];
          for (let u = 0; u <= 1; u += 0.05) {
            const p = el.map((v, n) => v + (wr[n] - v) * u);
            if (p[0] >= -150) expect(p[1] + half).toBeLessThanOrEqual(TOP + 0.5);
          }
        }
      }
    }
  });

  it("anchorAt đọc đúng cổ tay đặt bằng đích thế giới", () => {
    const rt = scene({
      at: [-231, SEAT, 0],
      yaw: 0,
      sit: true,
      hands: [{ t: 0, right: { at: [-131, -154, -30] }, left: { at: [-131, -154, 30] } }],
    });
    const sp = sceneAt(rt, "a", 0, c.rig.height, body3(c));
    const w = sp.world!;
    const a = anchorAt(rt, "a", w.flip ? "wristFar" : "wristNear", 0, c);
    const [x, y] = project(lens, [-131, -154, -30]);
    expect(Math.hypot(a.x - x, a.y - y)).toBeLessThan(0.5);
  });
});

describe("bộ hành động 3D có đích cổ tay", () => {
  // bàn chuẩn của bộ chung: mặt ngồi 94,5, mặt bàn 150 trên sàn
  const TOP = -150;
  const hip: V3 = [0, -94.5 - limbHalf(c).leg, 0];
  const half = limbHalf(c).arm;
  for (const [name, json] of [
    ["arms-on-table-3d", armsJson],
    ["type-3d", typeJson],
  ] as const)
    it(`${name}: khuỷu và cổ tay không dưới mặt bàn chuẩn suốt chu kỳ, mọi hướng`, () => {
      const a = action(json);
      for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI])
        for (let t = 0; t < 1; t += 0.05) {
          const j = figure3d(c, composePose(sitPose, actionPose(a, t)), placed(hip, yaw)).joints;
          for (const k of ["elbowNear", "elbowFar", "wristNear", "wristFar"] as const)
            expect(j[k][1] + half).toBeLessThanOrEqual(TOP + 0.5);
        }
    });
});

describe("đích hệ thân ↔ thế giới", () => {
  it("`worldToReach` là chiều ngược của `reachToWorld`, và IK đặt cổ tay đúng điểm ấy", () => {
    const at: V3 = [80, -60, 25];
    for (const yaw of [0, 1.2, 2.6, -2])
      for (const flip of [false, true]) {
        const w = { ...placed([40, -100, 30], yaw), s: 0.8, flip };
        for (const ch of ["armNear", "armFar"] as const) {
          const p = reachToWorld(w, ch, at, 1.1);
          worldToReach(w, ch, p, 1.1).forEach((v, i) => expect(v).toBeCloseTo(at[i], 9));
          const key = ch === "armNear" ? "an" : "af";
          const P: Pose = { ...sitPose, reach: { [key]: { at, w: 1 } } };
          const j = figure3d({ ...c, rig: { ...c.rig, height: 1.1 } }, P, w).joints;
          expect(dist(j[ch === "armNear" ? "wristNear" : "wristFar"], p)).toBeLessThan(1e-6);
        }
      }
  });
});
