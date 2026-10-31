import { describe, expect, it } from "vitest";
import {
  actAim,
  actJoints,
  actPalms,
  AIM_BEND,
  AIM_DEV,
  aimWrist,
  bodyMarkAt,
  needsSolve,
  resolveActing,
  type ActInput,
} from "./act3";
import {
  actionPose,
  actionReach,
  aimProblems,
  composePose,
  parseAction,
  type ActionData,
} from "./action";
import { blendPose } from "./blend";
import { AIM_GAP } from "./constants";
import { body3 } from "./figure3d";
import {
  gripShift,
  HAND_GRIPS,
  HAND_POSE_KINDS,
  handGripOf,
  handVec,
  wristTurn,
  type HandPose,
} from "./hand";
import { matMul, matVec, rotX, rotY, rotZ, type M3, type V3 } from "./lens";
import { POSES } from "./poses";
import { parseScene, resolveScene, sceneAt } from "./scene";
import { CharacterSchema, type CharacterData } from "./schema";
import type { Pose } from "./types";

/** Ba cỡ người: số đo mặc định, bụng phệ thấp vai rộng tay to, chibi đầu to */
const PEOPLE: [string, CharacterData][] = [
  ["vừa", CharacterSchema.parse({ head: { form: "human" }, palette: { clad: true } })],
  [
    "bụng",
    CharacterSchema.parse({
      rig: { height: 0.94, shoulderHalf: 42, hipHalf: 23 },
      head: { form: "human" },
      palette: { clad: true, sleeveWidth: 17, trouserWidth: 20, bicep: 0.3 },
      pieces: { torso: { src: "sculpt", garment: { style: "polo", belly: 24, hem: 6 } } },
    }),
  ],
  [
    "chibi",
    CharacterSchema.parse({
      rig: { height: 0.8, shoulderHalf: 34, hipHalf: 18 },
      head: { form: "human" },
      palette: { clad: true, sleeveWidth: 13, trouserWidth: 14 },
    }),
  ],
];

const act = (json: object): ActionData => {
  const r = parseAction({ authoredAt: "side", end: "hold", ...json });
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

/** Tư thế nền theo dáng thân: đứng, ngồi ghế, cúi chào, ngồi quỳ */
const BASES: Record<string, { pose: Pose; seated: boolean }> = {
  đứng: { pose: POSES.idle, seated: false },
  ngồi: { pose: POSES.sit, seated: true },
  cúi: { pose: { ...POSES.idle, torso: 40 }, seated: false },
  quỳ: { pose: { ...POSES.idle, ll: [-10, -150], lr: [-10, -150], torso: 10 }, seated: true },
};

/** Một khung: hành động `a` ở pha `u` chồng lên tư thế nền, như scene ghép, kênh tay chân nâng */
function frame(a: ActionData, base: keyof typeof BASES, u = 1, yaw = 0.4): ActInput {
  const B = BASES[base];
  const pose = composePose(B.pose, actionPose(a, u));
  return {
    pose: { ...pose, lift: { al: true, ar: true, ll: true, lr: true } },
    world: { hip: [30, -140, 20], yaw, s: 1, seated: B.seated },
  };
}

const sub = (a: readonly number[], b: readonly number[]) => a.map((v, i) => v - b[i]);
const len = (a: readonly number[]) => Math.hypot(...a);
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const deg = (a: readonly number[], b: readonly number[]) =>
  (Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b))))) * 180) / Math.PI;

describe("đích theo mốc thân", () => {
  const cover = act({
    mask: ["armRight", "hand"],
    keys: [
      {
        t: 0,
        pose: {},
        reach: { armRight: { to: "mouth", offset: [3, 0, 0] } },
        hand: { armRight: { pose: "cup", palm: { toward: "mouth" } } },
      },
    ],
  });

  it("lòng tay tới đúng mồm ở mọi cỡ người và mọi dáng thân: đứng, ngồi, cúi, quỳ", () => {
    for (const [, c] of PEOPLE)
      for (const base of Object.keys(BASES)) {
        const r = actAim(c, frame(cover, base))!;
        expect(r.report.R.reach?.to).toBe("mouth");
        expect(r.report.R.reach!.gap).toBeLessThan(0.5);
        expect(r.report.R.palm!).toBeLessThan(5);
      }
  });

  it("mốc tính theo hình của chính nhân vật: người thấp mồm thấp, cúi thì mồm ra trước và xuống, bàn tay theo", () => {
    const at = (c: CharacterData, base: keyof typeof BASES) =>
      actPalms(c, frame(cover, base))!.R.skin[0];
    const [tall, , short] = PEOPLE.map(([, c]) => at(c, "đứng"));
    expect(short[1] - tall[1]).toBeGreaterThan(20);
    const c = PEOPLE[0][1];
    const mouth = (base: keyof typeof BASES) =>
      bodyMarkAt(c, frame(cover, base), { to: "mouth", offset: [3, 0, 0] })!;
    // cúi: mồm xuống và ra trước theo hướng mặt; lòng tay bám đúng chỗ mới
    const fwd = [Math.cos(0.4), 0, -Math.sin(0.4)];
    const moved = sub(mouth("cúi"), mouth("đứng"));
    expect(moved[1]).toBeGreaterThan(20);
    expect(dot(moved, fwd)).toBeGreaterThan(20);
    for (const base of Object.keys(BASES) as (keyof typeof BASES)[])
      expect(len(sub(at(c, base), mouth(base)))).toBeLessThan(0.5);
  });

  it("má, mắt, tai, cằm, ngực, bụng, lưng, hông, đùi, gối, vai bên kia đều với tới trên cả ba người; với không tới thì báo khe", () => {
    for (const [to, side, point, base] of [
      ["cheek", "same", "palm", "đứng"],
      ["ear", "same", "palm", "đứng"],
      ["eye", "same", "tip", "đứng"],
      ["chin", "same", "back", "đứng"],
      ["chest", "same", "palm", "đứng"],
      ["belly", "same", "palm", "đứng"],
      ["back", "same", "back", "đứng"],
      ["hip", "same", "palm", "đứng"],
      ["shoulder", "other", "palm", "đứng"],
      ["thigh", "same", "palm", "ngồi"],
      ["thigh", "other", "palm", "ngồi"],
      ["knee", "same", "palm", "ngồi"],
    ] as const) {
      const a = act({
        mask: ["armRight"],
        keys: [{ t: 0, pose: {}, reach: { armRight: { to, side, point } } }],
      });
      for (const [name, c] of PEOPLE) {
        const gap = actAim(c, frame(a, base))!.report.R.reach!.gap;
        expect(gap, `${to}/${side} ${name}`).toBeLessThan(0.5);
      }
    }
    // chibi tay ngắn đầu to: má bên kia ngoài tầm, khe báo ra chứ không im lặng
    const far = act({
      mask: ["armRight"],
      keys: [{ t: 0, pose: {}, reach: { armRight: { to: "cheek", side: "other" } } }],
    });
    expect(actAim(PEOPLE[2][1], frame(far, "đứng"))!.report.R.reach!.gap).toBeGreaterThan(2);
  });

  it("đích toạ độ cũ không đổi gì: không có số hạng, `resolveActing` trả nguyên khung", () => {
    const a = act({
      mask: ["armRight", "hand"],
      keys: [
        {
          t: 0,
          pose: {},
          reach: { armRight: { at: [60, -80, 20] } },
          hand: { armRight: { turn: 20 } },
        },
      ],
    });
    const sp = frame(a, "đứng");
    expect(sp.pose.reach?.ar?.terms).toBeUndefined();
    expect(sp.pose.aim).toBeUndefined();
    expect(needsSolve(sp)).toBe(false);
    expect(resolveActing(PEOPLE[0][1], sp)).toBe(sp);
  });

  it("hoà toạ độ thô sang mốc: cổ tay đi liền, đầu mút đúng hai đích", () => {
    const a = act({
      mask: ["armRight"],
      keys: [
        { t: 0, pose: {}, reach: { armRight: { at: [40, -40, 30] } }, ease: "linear" },
        { t: 1, pose: {}, reach: { armRight: { to: "mouth" } } },
      ],
    });
    const c = PEOPLE[1][1];
    let last: V3 | undefined;
    let step = 0;
    for (let i = 0; i <= 50; i++) {
      const w = actJoints(c, frame(a, "đứng", i / 50))!.wristR;
      if (last) step = Math.max(step, len(sub(w, last)));
      last = w;
    }
    expect(step).toBeLessThan(6);
    const start = actAim(c, frame(a, "đứng", 0))!;
    expect(start.input.pose.reach!.ar!.at.map((v) => +v.toFixed(6))).toEqual([40, -40, 30]);
    expect(actAim(c, frame(a, "đứng", 1))!.report.R.reach!.gap).toBeLessThan(0.5);
  });

  it("hoà hai clip có mốc thân (`blendPose`) cũng hoà trên số hạng", () => {
    const a = actionPose(
      act({
        mask: ["armRight"],
        keys: [{ t: 0, pose: {}, reach: { armRight: { to: "chest", offset: [30, 0, 0] } } }],
      }),
      0,
    );
    const b = actionPose(
      act({ mask: ["armRight"], keys: [{ t: 0, pose: {}, reach: { armRight: { to: "mouth" } } }] }),
      0,
    );
    const mid = blendPose(POSES.idle, a, b, 0.5);
    expect(mid.reach!.ar!.terms!.map((t) => t.to).sort()).toEqual(["chest", "mouth"]);
    expect(mid.reach!.ar!.terms!.reduce((s, t) => s + t.k, 0)).toBeCloseTo(1, 9);
  });

  it("schema: đúng một trong `at` hay `to`; `side`, `offset` chỉ đi với `to`", () => {
    const k = (r: object) => ({ keys: [{ t: 0, pose: {}, reach: { armRight: r } }] });
    expect(parseAction(k({ to: "mouth" })).success).toBe(true);
    expect(parseAction(k({ at: [1, 2, 3], point: "palm" })).success).toBe(true);
    expect(parseAction(k({})).success).toBe(false);
    expect(parseAction(k({ at: [1, 2, 3], to: "mouth" })).success).toBe(false);
    expect(parseAction(k({ at: [1, 2, 3], offset: [1, 0, 0] })).success).toBe(false);
    expect(parseAction(k({ to: "nose" })).success).toBe(false);
    // đích theo mốc vẫn có góc suy từ đích
    const a = act({
      mask: ["armRight"],
      keys: [{ t: 0, pose: {}, reach: { armRight: { to: "mouth" } } }],
    });
    expect(actionPose(a, 0).ar?.every(Number.isFinite)).toBe(true);
    expect(actionReach(a, 0).ar!.at.every(Number.isFinite)).toBe(true);
  });
});

describe("hai tay ràng buộc nhau", () => {
  const clap = act({
    mask: ["armRight", "armLeft", "hand"],
    keys: [
      {
        t: 0,
        pose: {},
        reach: {
          armRight: { to: "chest", offset: [36, -6, 2] },
          armLeft: { to: "otherPalm" },
        },
        hand: {
          armRight: { pose: "flat", palm: "in", fingers: [1, -1, 0] },
          armLeft: { pose: "flat", palm: "in", fingers: [1, -1, 0] },
        },
      },
    ],
  });

  it("vỗ tay: lòng áp lòng, hai pháp tuyến đối nhau, mu tay kia nằm hẳn phía trước lòng tay này — không xuyên", () => {
    for (const [name, c] of PEOPLE)
      for (const base of ["đứng", "ngồi"] as const) {
        const sp = frame(clap, base);
        const r = actAim(c, sp)!;
        expect(r.report.L.reach!.gap, name).toBeLessThan(0.5);
        const P = actPalms(c, sp)!;
        expect(len(sub(P.R.skin[0], P.L.skin[0])), name).toBeLessThan(0.5);
        expect(dot(P.R.palm, P.L.palm), name).toBeLessThan(-0.95);
        // mu tay trái ở phía lòng tay phải, cách mặt lòng tay ít nhất bề dày bàn tay
        const back = dot(sub(P.L.skin[1], P.R.skin[0]), P.R.palm);
        expect(back, name).toBeGreaterThan(3);
        for (const q of P.L.skin.slice(4))
          expect(dot(sub(q, P.R.skin[0]), P.R.palm)).toBeGreaterThan(-1.5);
      }
  });

  it("tay bám vào tay kia giải sau tay kia, dù đó là tay gần; hai tay cùng bám nhau thì báo `cycle`", () => {
    const swap = act({
      mask: ["armRight", "armLeft"],
      keys: [
        {
          t: 0,
          pose: {},
          reach: {
            armRight: { to: "otherWrist", point: "grip" },
            armLeft: { to: "back", point: "back" },
          },
        },
      ],
    });
    const r = actAim(PEOPLE[1][1], frame(swap, "đứng"))!;
    expect(r.report.R.reach!.gap).toBeLessThan(0.5);
    expect(r.report.R.cycle).toBeUndefined();
    const both = act({
      mask: ["armRight", "armLeft"],
      keys: [
        { t: 0, pose: {}, reach: { armRight: { to: "otherPalm" }, armLeft: { to: "otherPalm" } } },
      ],
    });
    expect(actAim(PEOPLE[0][1], frame(both, "đứng"))!.report.R.cycle).toBe(true);
  });

  it("chắp tay sau lưng: tâm nắm tay xa ôm đúng cổ tay tay gần, cả người bụng phệ", () => {
    const behind = act({
      mask: ["armRight", "armLeft", "hand"],
      keys: [
        {
          t: 0,
          pose: {},
          reach: {
            armRight: { to: "back", offset: [-4, 6, 2], point: "back", elbow: [-0.6, 0.6, 1] },
            armLeft: { to: "otherWrist", point: "grip", elbow: [-0.6, 0.6, 1] },
          },
          hand: { armLeft: { pose: "clasp", palm: "up" } },
        },
      ],
    });
    for (const [name, c] of PEOPLE) {
      const sp = frame(behind, "đứng");
      const J = actJoints(c, sp)!;
      const r = actAim(c, sp)!;
      expect(r.report.L.reach!.gap, name).toBeLessThan(0.5);
      // cổ tay gần sau lưng: lùi sau hông theo hướng mặt
      const fwd = [Math.cos(0.4), 0, -Math.sin(0.4)];
      expect(dot(sub(J.wristR, J.hip), fwd), name).toBeLessThan(0);
    }
  });
});

describe("hướng lòng tay theo ý định", () => {
  const rnd = (seed: number) => {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  };

  it("`aimWrist` giải ngược đúng lòng tay trong tầm khớp: sai số dưới 0,5°, cả hai bên tay", () => {
    const r = rnd(3);
    for (let i = 0; i < 300; i++) {
      const Re: M3 = matMul(
        matMul(rotY((r() * 2 - 1) * Math.PI), rotX((r() * 2 - 1) * Math.PI)),
        rotZ((r() * 2 - 1) * Math.PI),
      );
      const side = r() < 0.5 ? -1 : 1;
      const [t, b, d] = [
        (r() * 2 - 1) * 85,
        AIM_BEND[0] + 5 + r() * (AIM_BEND[1] - AIM_BEND[0] - 10),
        AIM_DEV[0] + 5 + r() * (AIM_DEV[1] - AIM_DEV[0] - 10),
      ];
      const want = matVec(matMul(Re, wristTurn(t, b, d, side)), [-side, 0, 0]);
      const fing = matVec(matMul(Re, wristTurn(t, b, d, side)), [0, -1, 0]);
      const sol = aimWrist(Re, side, want, undefined);
      expect(sol.palmErr!).toBeLessThan(0.5);
      const both = aimWrist(Re, side, want, fing);
      expect(both.palmErr!).toBeLessThan(0.5);
      expect(both.fingerErr!).toBeLessThan(0.5);
    }
  });

  it("ngoài tầm thì kẹp trong giới hạn, báo góc còn lệch, không lật dấu giữa hai khung liền nhau", () => {
    const side = -1;
    let last: number | undefined;
    let jump = 0;
    for (let a = -170; a <= 170; a += 2) {
      // lòng tay quay vòng quanh trục cẳng tay: quá ±90 là ngoài tầm xoay
      const want = matVec(rotY((a * Math.PI) / 180), [1, 0, 0]) as V3;
      const s = aimWrist(rotX(0.3), side, want, undefined);
      expect(Math.abs(s.turn)).toBeLessThanOrEqual(90);
      if (last !== undefined && Math.abs(a) < 88) jump = Math.max(jump, Math.abs(s.turn - last));
      last = s.turn;
    }
    expect(jump).toBeLessThan(5);
    const out = aimWrist(rotX(0.3), side, [-1, 0, 0], undefined);
    expect(out.palmErr!).toBeGreaterThan(45);
  });

  it("mốc thô sang mốc `palm`: xoay cẳng tay đổi dần, không nhảy; đạt úp ở mốc cuối", () => {
    const a = act({
      mask: ["armRight", "hand"],
      keys: [
        {
          t: 0,
          pose: {},
          reach: { armRight: { at: [90, -60, 20] } },
          hand: { armRight: { turn: -40 } },
          ease: "linear",
        },
        {
          t: 1,
          pose: {},
          reach: { armRight: { at: [90, -60, 20] } },
          hand: { armRight: { pose: "flat", palm: "down" } },
        },
      ],
    });
    const c = PEOPLE[0][1];
    let last: number | undefined;
    let jump = 0;
    for (let i = 0; i <= 40; i++) {
      const turn = resolveActing(c, frame(a, "ngồi", i / 40)).pose.hand!.ar![0];
      if (last !== undefined) jump = Math.max(jump, Math.abs(turn - last));
      last = turn;
    }
    expect(jump).toBeLessThan(8);
    const end = actPalms(c, frame(a, "ngồi", 1))!.R;
    expect(deg(end.palm, [0, 1, 0])).toBeLessThan(3);
  });

  it("`palm` thắng `turn`: `turn` khai kèm bị bỏ qua và `aimProblems` kêu", () => {
    const a = act({
      mask: ["armRight", "hand"],
      keys: [
        {
          t: 0,
          pose: {},
          reach: { armRight: { at: [90, -60, 20] } },
          hand: { armRight: { turn: -80, palm: "down" } },
        },
      ],
    });
    expect(aimProblems(a).join()).toMatch(/turn/);
    const P = actPalms(PEOPLE[0][1], frame(a, "ngồi"))!.R;
    expect(deg(P.palm, [0, 1, 0])).toBeLessThan(5);
  });
});

describe("dáng tay mới và tâm nắm", () => {
  it("tâm nắm theo góc ngón: đúng bảng ở từng dáng, `grip` không dời đồ cầm", () => {
    for (const p of HAND_POSE_KINDS) {
      const g = handGripOf(handVec(p), -1);
      HAND_GRIPS[p].forEach((v, i) => expect(Math.abs(g[i] - v)).toBeLessThan(2e-3));
    }
    gripShift("grip", -1).forEach((v) => expect(Math.abs(v)).toBe(0));
    expect(len(gripShift("pinch", -1, 1.5, 1.4))).toBeGreaterThan(0.02);
  });

  it("tâm nắm đổi liền khi dáng hoà", () => {
    const from = handVec("grip");
    const to = handVec("pinch");
    let last: V3 | undefined;
    let jump = 0;
    for (let i = 0; i <= 50; i++) {
      const v = from.map((x, j) => x + (to[j] - x) * (i / 50));
      const g = handGripOf(v, -1);
      if (last) jump = Math.max(jump, len(sub(g, last)));
      last = g;
    }
    expect(jump).toBeLessThan(0.01);
  });

  it("kẹp: chén ngồi giữa đầu ngón cái và ngón trỏ; móc: tâm trong lòng các ngón cong", () => {
    const pinch = HAND_GRIPS.pinch;
    expect(pinch[0]).toBeGreaterThan(HAND_GRIPS.grip[0]);
    expect(pinch[2]).toBeGreaterThan(0.04);
    const hook = HAND_GRIPS.hook;
    expect(hook[1]).toBeLessThan(HAND_GRIPS.grip[1]);
    for (const p of ["cup", "flat", "hook", "edge", "clasp", "pinch"] as HandPose[])
      expect(parseAction({ keys: [{ t: 0, pose: {}, hand: { armRight: p } }] }).success).toBe(true);
  });
});

describe("đích thế giới theo mốc và lòng tay trong scene", () => {
  const scene = (hands: unknown[]) => {
    const r = parseScene({
      name: "x",
      lens: { eye: [0, -200, -1400], yaw: 0, pitch: 0, f: 800 },
      cast: [{ id: "a", world: { at: [0, -87.5, 0], yaw: 90, sit: true, hands }, tracks: [] }],
    });
    if (!r.success) throw new Error(r.error.message);
    return r.data;
  };

  it("`world.hands` nhận `point: palm` và `palm`: lòng tay úp đúng trên điểm thế giới", () => {
    const c = PEOPLE[1][1];
    // tay đủ xa thân cho cẳng tay gần ngang: lòng tay úp trong tầm gập `±AIM_BEND`
    const at = [-48, -112, -16];
    const rt = resolveScene(
      scene([{ t: 0, right: { at, point: "palm", palm: "down" } }]),
      {},
      { a: c.rig.height },
      { a: body3(c) },
    );
    const sp = sceneAt(rt, "a", 0, c.rig.height, body3(c));
    const P = actPalms(c, sp)!.R;
    expect(len(sub(P.skin[0], at))).toBeLessThan(0.5);
    expect(deg(P.palm, [0, 1, 0])).toBeLessThan(5);
  });

  it("mốc ngoài tầm: `AimReport.reach` báo khe tới mốc", () => {
    const c = PEOPLE[2][1];
    const rt = resolveScene(
      scene([{ t: 0, right: { to: "knee", side: "other", offset: [160, 0, 0], palm: "up" } }]),
      {},
      { a: c.rig.height },
      { a: body3(c) },
    );
    const sp = sceneAt(rt, "a", 0.5, c.rig.height, body3(c));
    const reach = actAim(c, sp)!.report.R.reach!;
    expect(reach.to).toBe("knee");
    expect(reach.gap).toBeGreaterThan(AIM_GAP * sp.world!.s);
    expect(
      parseScene({
        name: "y",
        lens: { eye: [0, 0, -1], yaw: 0, pitch: 0, f: 1 },
        cast: [
          {
            id: "a",
            world: { at: [0, 0, 0], hands: [{ t: 0, right: { to: "mouth", at: [0, 0, 0] } }] },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
