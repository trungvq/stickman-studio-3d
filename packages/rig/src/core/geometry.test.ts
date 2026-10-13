import { describe, expect, it } from "vitest";

import sitRearJson from "../../../../apps/studio/public/actions/sit-rear.json";
import {
  ACTION_VERSION,
  actionDelta,
  actionPose,
  composePose,
  deltaPose,
  freezeAction,
  keyDelta,
  parseAction,
  poseDelta,
  stretchOver,
  stretchOwns,
  type ActionData,
} from "./index";
import { blendDuration, blendPose } from "./index";
import { D, NEUTRAL_STRETCH, RIG } from "./index";
import { computeFigure, feet, limbCurves, limbPath, pathOf, tip } from "./index";
import { POSES } from "./index";
import { defaultCharacter } from "./index";
import { stretchJson, stretchSegs, type Pose, type Pt, type Stretch } from "./index";

const C = defaultCharacter();
const KS = [0.25, 0.5, 1];
/** Đỉnh đầu so với tâm hông, ở chiều cao chuẩn */
const HEAD_TOP = -(RIG.torso + RIG.neck + RIG.headH);
const SH_N: Pt = [-C.rig.shoulderHalf, -RIG.torso + C.rig.shoulderDrop];
const SH_F: Pt = [C.rig.shoulderHalf, -RIG.torso + C.rig.shoulderDrop];
const HIP_N: Pt = [-C.rig.hipHalf, 0];
const HIP_F: Pt = [C.rig.hipHalf, 0];

/** Chuỗi ba khớp dựng lại bằng `tip` + `RIG`, không đi qua `computeFigure` */
const oracleChain = (root: Pt, a0: number, a1: number, l1: number, l2: number): Pt[] => {
  const mid = tip(root[0], root[1], l1, a0);
  return [root, mid, tip(mid[0], mid[1], l2, a0 + a1)];
};

const oracleLimbs = (P: Pose) => ({
  armF: oracleChain(SH_F, P.af[0], P.af[1], RIG.upperArm, RIG.foreArm),
  armN: oracleChain(SH_N, P.an[0], P.an[1], RIG.upperArm, RIG.foreArm),
  legF: oracleChain(HIP_F, P.lf[0], P.lf[1], RIG.thigh, RIG.shin),
  legN: oracleChain(HIP_N, P.ln[0], P.ln[1], RIG.thigh, RIG.shin),
});

/** Bốn chi của một pose kèm góc rig của tay, để lặp chung */
const limbsOf = (P: Pose) => {
  const f = computeFigure(C, P);
  return [
    { ten: "armF", pts: f.armF, arm: P.af as readonly number[] | null },
    { ten: "armN", pts: f.armN, arm: P.an as readonly number[] | null },
    { ten: "legF", pts: f.legF, arm: null },
    { ten: "legN", pts: f.legN, arm: null },
  ];
};

const poses = Object.entries(POSES) as [string, Pose][];

const unit = (a: Pt, b: Pt): Pt | null => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  return L < 1e-9 ? null : [dx / L, dy / L];
};

/** Góc rig của vector `a→b`: quay từ trục `+y`, thuận chiều `+x` */
const rigDeg = (a: Pt, b: Pt) => Math.atan2(b[0] - a[0], b[1] - a[1]) / D;

/** Quy về `(−180, 180]` để so với góc pose */
const wrap = (deg: number) => {
  const d = (((deg + 180) % 360) + 360) % 360;
  return d === 0 ? 180 : d - 180;
};

describe("k = 0 ra đúng đường gấp khúc", () => {
  it.each(poses)("%s", (_ten, P) => {
    for (const { pts } of limbsOf(P)) {
      expect(limbPath(pts, 0)).toBe(pathOf(pts));
      expect(limbPath(pts, 0, 0)).toBe(pathOf(pts.slice(0, 2)));
      expect(limbPath(pts, 0, 1)).toBe(pathOf(pts.slice(1)));
    }
  });
});

describe("điểm cuối không đổi theo độ cong", () => {
  it.each(poses)("%s", (_ten, P) => {
    for (const { pts, arm } of limbsOf(P)) {
      for (const k of KS) {
        const [a, b] = limbCurves(pts, k);
        expect(a[0]).toEqual(pts[0]);
        expect(a[3]).toEqual(pts[1]);
        expect(b[0]).toEqual(pts[1]);
        expect(b[3]).toEqual(pts[2]);
      }
      if (!arm) continue;
      const want = oracleChain(pts[0], arm[0], arm[1], RIG.upperArm, RIG.foreArm)[2];
      expect(pts[2][0]).toBeCloseTo(want[0], 10);
      expect(pts[2][1]).toBeCloseTo(want[1], 10);
    }
  });
});

describe("tiếp tuyến hai đầu không đổi", () => {
  it.each(poses)("%s", (_ten, P) => {
    for (const { pts, arm } of limbsOf(P)) {
      const [P0, P1, P2] = pts;
      const uGoc = unit(P0, P1);
      const uNgon = unit(P1, P2);
      for (const k of KS) {
        const [a, b] = limbCurves(pts, k);
        const tGoc = unit(P0, a[1]);
        const tNgon = unit(b[2], P2);
        if (uGoc && tGoc) {
          expect(tGoc[0]).toBeCloseTo(uGoc[0], 10);
          expect(tGoc[1]).toBeCloseTo(uGoc[1], 10);
        }
        if (uNgon && tNgon) {
          expect(tNgon[0]).toBeCloseTo(uNgon[0], 10);
          expect(tNgon[1]).toBeCloseTo(uNgon[1], 10);
        }
        if (!arm) continue;
        if (tGoc) expect(wrap(rigDeg(P0, a[1]))).toBeCloseTo(wrap(arm[0]), 10);
        if (tNgon) expect(wrap(rigDeg(b[2], P2))).toBeCloseTo(wrap(arm[0] + arm[1]), 10);
      }
    }
  });
});

describe("stretch 1 là trung tính", () => {
  it.each(poses)("%s", (_ten, P) => {
    const f = computeFigure(C, P);
    const want = oracleLimbs(P);
    expect(f.armF).toEqual(want.armF);
    expect(f.armN).toEqual(want.armN);
    expect(f.legF).toEqual(want.legF);
    expect(f.legN).toEqual(want.legN);

    const hien: Stretch = [1, 1, 1, 1, 1, 1, 1, 1];
    expect(computeFigure(C, { ...P, stretch: hien })).toEqual(f);

    const g = computeFigure(C, { ...P, stretch: [1, 1, 2, 2, 1, 1, 1, 1] });
    expect(g.armN).not.toEqual(f.armN);
    expect(g.armF).toEqual(f.armF);
    expect(g.legF).toEqual(f.legF);
    expect(g.legN).toEqual(f.legN);
    expect(g.shN).toEqual(f.shN);
    expect(g.shF).toEqual(f.shF);
    expect(g.len).toEqual(f.len);
  });
});

describe("tầm với của tay", () => {
  const toiDinhDau = Math.hypot(HEAD_TOP - SH_N[1], -SH_N[0]);
  const theta = Math.atan2(-SH_N[0], HEAD_TOP - SH_N[1]) / D;

  it("vai gần với không tới đỉnh đầu khi chi dài chuẩn", () => {
    expect(toiDinhDau).toBeCloseTo(163, 0);
    expect(toiDinhDau).toBeGreaterThan(RIG.upperArm + RIG.foreArm);

    const P: Pose = { ...POSES.idle, an: [theta, 0, 0] };
    const f = computeFigure(C, P);
    expect(Math.hypot(f.armN[2][0] - SH_N[0], f.armN[2][1] - SH_N[1])).toBeLessThan(toiDinhDau);
  });

  it("stretch 1.4 vươn qua đỉnh đầu, vẫn trên tia vai→đỉnh đầu", () => {
    expect((RIG.upperArm + RIG.foreArm) * 1.4).toBeGreaterThanOrEqual(toiDinhDau);

    const P: Pose = { ...POSES.idle, an: [theta, 0, 0], stretch: [1, 1, 1.4, 1.4, 1, 1, 1, 1] };
    const w = computeFigure(C, P).armN[2];
    const dx = w[0] - SH_N[0];
    const dy = w[1] - SH_N[1];
    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(toiDinhDau);
    expect(dx * (HEAD_TOP - SH_N[1]) - dy * (0 - SH_N[0])).toBeCloseTo(0, 9);
  });
});

function action(json: unknown): ActionData {
  const r = parseAction(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}

/** Hành động gõ phím nghiêng của repo tập, đời 11: chỉ ghi hai tay, `stretch` bốn số */
const TYPE_SIDE = {
  schemaVersion: 11,
  name: "type-side",
  duration: 1,
  end: "wrap",
  mask: ["armFar", "armNear", "stretch"],
  keys: [
    { t: 0, pose: { armFar: [34, 58, 0], armNear: [38, 54, 0], stretch: [0.9, 1, 1, 1] } },
    { t: 0.5, pose: { armFar: [34, 60, 0], armNear: [38, 52, 0], stretch: [0.9, 1, 1, 1] } },
    { t: 1, pose: { armFar: [34, 58, 0], armNear: [38, 54, 0], stretch: [0.9, 1, 1, 1] } },
  ],
};

const SIT_LEGS: Stretch = [1, 1, 1, 1, 0.75, 1.19, 0.75, 1.19];
const sit: Partial<Pose> = { lf: [82, -82], ln: [82, -82], torso: 3, stretch: SIT_LEGS };
const typing = deltaPose({ armFar: [34, 58, 0], armNear: [38, 54, 0], stretch: [0.9, 1, 1, 1] });

describe("stretch từng đoạn", () => {
  it("bốn số trải ra tám, tám số gọn lại bốn khi hai đoạn của mọi chi bằng nhau", () => {
    expect(NEUTRAL_STRETCH).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(stretchSegs([0.9, 1.2, 0.75, 1.4])).toEqual([0.9, 0.9, 1.2, 1.2, 0.75, 0.75, 1.4, 1.4]);
    expect(stretchSegs(SIT_LEGS)).toEqual(SIT_LEGS);
    expect(stretchJson([0.9, 0.9, 1.2, 1.2, 0.75, 0.75, 1.4, 1.4])).toEqual([0.9, 1.2, 0.75, 1.4]);
    const tach = stretchJson(SIT_LEGS);
    expect(tach).toEqual(SIT_LEGS);
    expect(tach).not.toBe(SIT_LEGS);
  });

  it.each(poses)("%s: stretch bốn số cũ cho kết quả đúng như trước", (_ten, P) => {
    expect(computeFigure(C, composePose(P, deltaPose({ stretch: [1, 1, 1, 1] })))).toEqual(
      computeFigure(C, P),
    );
    const s4: [number, number, number, number] = [1.2, 0.8, 1.1, 0.9];
    const f = computeFigure(C, composePose(P, deltaPose({ stretch: s4 })));
    expect(f).toEqual(computeFigure(C, { ...P, stretch: stretchSegs(s4) }));
    const want = {
      armF: oracleChain(SH_F, P.af[0], P.af[1], RIG.upperArm * 1.2, RIG.foreArm * 1.2),
      armN: oracleChain(SH_N, P.an[0], P.an[1], RIG.upperArm * 0.8, RIG.foreArm * 0.8),
      legF: oracleChain(HIP_F, P.lf[0], P.lf[1], RIG.thigh * 1.1, RIG.shin * 1.1),
      legN: oracleChain(HIP_N, P.ln[0], P.ln[1], RIG.thigh * 0.9, RIG.shin * 0.9),
    };
    for (const k of ["armF", "armN", "legF", "legN"] as const)
      f[k].forEach((q, i) => {
        expect(q[0]).toBeCloseTo(want[k][i][0], 10);
        expect(q[1]).toBeCloseTo(want[k][i][1], 10);
      });
  });

  it.each(poses)("%s: bàn tay ở vai + sU·62·sin(vai) + sL·58·sin(vai + khuỷu)", (_ten, P) => {
    const s: Stretch = [1.3, 0.7, 0.8, 1.5, 1.2, 0.6, 0.9, 1.1];
    const f = computeFigure(C, { ...P, stretch: s });
    const end = (
      root: Pt,
      a: readonly number[],
      l1: number,
      l2: number,
      sU: number,
      sL: number,
    ) => [
      root[0] + sU * l1 * Math.sin(a[0] * D) + sL * l2 * Math.sin((a[0] + a[1]) * D),
      root[1] + sU * l1 * Math.cos(a[0] * D) + sL * l2 * Math.cos((a[0] + a[1]) * D),
    ];
    const cases = [
      [f.armF, end(SH_F, P.af, 62, 58, s[0], s[1]), tip(SH_F[0], SH_F[1], 62 * s[0], P.af[0])],
      [f.armN, end(SH_N, P.an, 62, 58, s[2], s[3]), tip(SH_N[0], SH_N[1], 62 * s[2], P.an[0])],
      [
        f.legF,
        end(HIP_F, P.lf, RIG.thigh, RIG.shin, s[4], s[5]),
        tip(HIP_F[0], HIP_F[1], RIG.thigh * s[4], P.lf[0]),
      ],
      [
        f.legN,
        end(HIP_N, P.ln, RIG.thigh, RIG.shin, s[6], s[7]),
        tip(HIP_N[0], HIP_N[1], RIG.thigh * s[6], P.ln[0]),
      ],
    ] as const;
    for (const [pts, ngon, khop] of cases) {
      expect(pts[1][0]).toBeCloseTo(khop[0], 10);
      expect(pts[1][1]).toBeCloseTo(khop[1], 10);
      expect(pts[2][0]).toBeCloseTo(ngon[0], 10);
      expect(pts[2][1]).toBeCloseTo(ngon[1], 10);
    }
  });

  it.each(poses)("%s: `feet` và `lowest` nhân stretch từng đoạn", (_ten, P) => {
    const Q: Pose = { ...P, stretch: [1, 1, 1, 1, 0.75, 1.4, 1.2, 0.8] };
    const f = computeFigure(C, Q);
    const [xa, gan] = feet(Q, 1);
    expect(xa[0]).toBeCloseTo(f.legF[2][0] - f.legF[0][0], 10);
    expect(xa[1]).toBeCloseTo(f.legF[2][1], 10);
    expect(gan[0]).toBeCloseTo(f.legN[2][0] - f.legN[0][0], 10);
    expect(gan[1]).toBeCloseTo(f.legN[2][1], 10);
    expect(f.lowest).toBe(Math.max(f.legF[2][1], f.legN[2][1]));
  });
});

describe("`note` của JSON hành động", () => {
  it("parse giữ nguyên, đóng băng để xuất cũng giữ", () => {
    const r = parseAction({ name: "x", keys: [{ t: 0, pose: "idle" }], note: "giơ một lần" });
    expect(r.success).toBe(true);
    expect(r.data!.note).toBe("giơ một lần");
    expect(freezeAction(r.data!).note).toBe("giơ một lần");
  });
});

describe("kênh `stretch` trong JSON hành động", () => {
  const withStretch = (stretch: number[]) => ({
    keys: [{ t: 0, pose: { armNear: [0, 0, 0], stretch } }],
  });

  it("bốn hoặc tám số dương; năm số, số âm hay 0 là lỗi", () => {
    expect(ACTION_VERSION).toBe(19);
    expect(parseAction(withStretch([1, 1, 1, 1])).success).toBe(true);
    expect(parseAction(withStretch(SIT_LEGS)).success).toBe(true);
    expect(parseAction(withStretch([1, 1, 1, 1, 1])).success).toBe(false);
    expect(parseAction(withStretch([1, 1, -1, 1])).success).toBe(false);
    expect(parseAction(withStretch([1, 1, 1, 1, 1, 0, 1, 1])).success).toBe(false);
  });

  it("file đời 11 bốn số parse y nguyên, `actionPose` trải ra tám", () => {
    const a = action(TYPE_SIDE);
    expect(a.schemaVersion).toBe(ACTION_VERSION);
    expect(keyDelta(a.keys![0]).stretch).toEqual([0.9, 1, 1, 1]);
    expect(actionPose(a, 0).stretch).toEqual([0.9, 0.9, 1, 1, 1, 1, 1, 1]);
  });

  it("`poseDelta` gọn lại bốn số khi được, `deltaPose` trải ra tám", () => {
    expect(poseDelta(POSES.idle).stretch).toEqual([1, 1, 1, 1]);
    expect(poseDelta({ ...POSES.idle, stretch: SIT_LEGS }).stretch).toEqual(SIT_LEGS);
    expect(deltaPose({ stretch: [0.9, 1, 1, 1] }).stretch).toEqual([0.9, 0.9, 1, 1, 1, 1, 1, 1]);
    expect(deltaPose(poseDelta({ ...POSES.idle, stretch: SIT_LEGS })).stretch).toEqual(SIT_LEGS);
  });

  it("mốc bốn số và mốc tám số nội suy chung được", () => {
    const a = action({
      end: "hold",
      keys: [
        { t: 0, pose: { stretch: [1, 1, 1, 1] } },
        { t: 1, pose: { stretch: [1, 1, 1, 1, 0.5, 1.5, 1, 1] } },
      ],
    });
    expect(actionDelta(a, 0).stretch).toEqual([1, 1, 1, 1]);
    const giua = actionDelta(a, 0.5).stretch!;
    expect(giua).toHaveLength(8);
    [1, 1, 1, 1, 0.75, 1.25, 1, 1].forEach((v, i) => expect(giua[i]).toBeCloseTo(v, 10));
  });
});

describe("ghép `stretch` theo chi", () => {
  it("chi có hiệu lực khi part ghi chính chi ấy, hoặc không ghi chi nào", () => {
    const own = (p: Partial<Pose>) => [0, 1, 2, 3].map((i) => stretchOwns(p, i));
    expect(own(sit)).toEqual([false, false, true, true]);
    expect(own(typing)).toEqual([true, true, false, false]);
    expect(own({ stretch: SIT_LEGS })).toEqual([true, true, true, true]);
    expect(own({ lf: [0, 0] })).toEqual([false, false, false, false]);
    expect(stretchOver(SIT_LEGS, { an: [0, 0, 0] })).toBe(SIT_LEGS);
  });

  it("ngồi rồi gõ phím: tay lấy của gõ phím, chân vẫn của hành động ngồi, thứ tự nào cũng vậy", () => {
    const want = [0.9, 0.9, 1, 1, 0.75, 1.19, 0.75, 1.19];
    expect(composePose(POSES.idle, sit, typing).stretch).toEqual(want);
    expect(composePose(POSES.idle, typing, sit).stretch).toEqual(want);
  });

  it("part chỉ có `stretch` phủ cả bốn chi", () => {
    const hai: Stretch = [2, 2, 2, 2, 2, 2, 2, 2];
    expect(composePose(POSES.idle, sit, typing, { stretch: hai }).stretch).toEqual(hai);
  });

  it("hoà hai clip: hệ số của chi mà clip không ghi lấy của nền", () => {
    const from: Partial<Pose> = { lf: POSES.idle.lf, stretch: [3, 3, 3, 3, 1, 1, 1, 1] };
    const to: Partial<Pose> = { lf: POSES.idle.lf, stretch: NEUTRAL_STRETCH };
    expect(blendPose(POSES.idle, from, to, 0.5).stretch).toEqual(NEUTRAL_STRETCH);
    expect(blendDuration(POSES.idle, from, to)).toBe(
      blendDuration(POSES.idle, { lf: POSES.idle.lf }, { lf: POSES.idle.lf }),
    );
    const s = blendPose(POSES.idle, sit, typing, 0.5).stretch!;
    [0.95, 0.95, 1, 1, 0.875, 1.095, 0.875, 1.095].forEach((v, i) =>
      expect(s[i]).toBeCloseTo(v, 10),
    );
  });

  it("hoà hai clip: kênh bên mới ghi mà không nâng thì bỏ cờ nâng của nền ngay nửa sau", () => {
    const base = { ...POSES.idle, lift: { an: true } };
    const from: Partial<Pose> = { an: [90, 0, 0], lift: { an: true } };
    const to: Partial<Pose> = { an: [90, 0, 0] };
    expect(blendPose(base, from, to, 0.3).lift?.an).toBe(true);
    expect(blendPose(base, from, to, 0.7).lift?.an).toBe(false);
    expect(blendPose(base, {}, to, 0.3).lift?.an).toBe(true);
  });
});

describe('`ease: "smooth"`', () => {
  const a = action({
    end: "hold",
    keys: [
      { t: 0, pose: { torso: 0 }, ease: "smooth" },
      { t: 1, pose: { torso: 10 } },
    ],
  });

  it("đi theo smoothstep: chậm ở hai đầu, qua giữa đúng nửa, không vọt qua mốc sau", () => {
    expect(actionDelta(a, 0.25).torso).toBeCloseTo(10 * 0.15625, 10);
    expect(actionDelta(a, 0.5).torso).toBeCloseTo(5, 10);
    expect(actionDelta(a, 0.05).torso as number).toBeLessThan(0.1);
    const s = Array.from({ length: 101 }, (_, i) => actionDelta(a, i / 100).torso as number);
    s.forEach((v, i) => i && expect(v).toBeGreaterThanOrEqual(s[i - 1]));
    expect(Math.max(...s)).toBe(10);
  });
});

describe("góc đầu `null` không ghi", () => {
  const tilt = action({
    end: "hold",
    mask: ["head"],
    keys: [
      { t: 0, pose: { head: [0, null, 0] } },
      { t: 1, pose: { head: [10, null, 2] } },
    ],
  });
  const look: Partial<Pose> = { head: [0, -29, 0] };

  it("`actionDelta` giữ `null`, mỗi góc nội suy riêng", () => {
    expect(actionDelta(tilt, 0.5).head).toEqual([5, null, 1]);
    const mixed = action({
      end: "hold",
      keys: [
        { t: 0, pose: { head: [0, 0, 0] } },
        { t: 0.5, pose: { head: [null, 20, null] } },
        { t: 1, pose: { head: [10, 0, 4] } },
      ],
    });
    expect(actionDelta(mixed, 0.5).head).toEqual([5, 20, 2]);
  });

  it("ghép lên track dưới: nghiêng và gật của hành động, lắc của track dưới", () => {
    expect(composePose(POSES.idle, look, actionPose(tilt, 1)).head).toEqual([10, -29, 2]);
    expect(composePose(POSES.idle, actionPose(tilt, 1)).head).toEqual([10, 0, 2]);
  });

  it("hoà: góc để trống lấy của nền, không ra `NaN`", () => {
    const base = composePose(POSES.idle, look);
    const h = blendPose(base, {}, actionPose(tilt, 1), 0.5).head!;
    expect(h).toEqual([5, -29, 1]);
    expect(composePose(base, blendPose(base, actionPose(tilt, 1), {}, 0.5)).head).toEqual([
      5, -29, 1,
    ]);
    expect(Number.isFinite(blendDuration(base, {}, actionPose(tilt, 1)))).toBe(true);
  });
});

describe("hành động chung `sit-rear`", () => {
  const a = action(sitRearJson);

  it.each([0, 0.25, 0.5, 0.75])("t = %s: hông cách bàn chân thấp nhất ≈ 118", (t) => {
    const P = composePose(POSES.idle, actionPose(a, t));
    expect(P.stretch).toEqual(SIT_LEGS);
    expect(Math.abs(computeFigure(C, P).lowest - 118)).toBeLessThan(0.5);
  });

  it.each([0, 0.25, 0.5, 0.75])("t = %s: ghép thêm gõ phím vẫn giữ chân ngồi", (t) => {
    const P = composePose(POSES.idle, actionPose(a, t), actionPose(action(TYPE_SIDE), t));
    expect(P.stretch).toEqual([0.9, 0.9, 1, 1, 0.75, 1.19, 0.75, 1.19]);
    expect(Math.abs(computeFigure(C, P).lowest - 118)).toBeLessThan(0.5);
  });
});
