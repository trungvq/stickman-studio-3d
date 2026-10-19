import {
  actAngles,
  AIM_BEND,
  AIM_DEV,
  armFrame,
  BONES3,
  handAt,
  markAt,
  TURN_MAX,
  trunk3,
  twoBone3,
  type ActCharacter,
  type ActHands,
  type ActInput,
  type ActJoint,
  type HandState,
  type HoldState,
  type PoseIn,
  type ReachIn,
  type Trunk3,
  type ActFrame,
} from "./arm3";
import { D } from "./constants";
import {
  fingerVec,
  HAND_BONES,
  HAND_POSES,
  HAND_REST,
  handFrames,
  handGrip,
  handPoint,
  wristTurn,
  type HandPiece,
} from "./hand";
import { REACH_ELBOW } from "./ik";
import {
  fromColumns,
  matMul as mm,
  matVec as mv,
  rotX as rx,
  rotY as ry,
  rotZ as rz,
  type M3,
  type V3,
} from "./lens";
import {
  isOtherHand,
  type Aim,
  type AimTerm,
  type AimDir,
  type HandPoint,
  type BodyMark,
  type ReachPoint,
  type ReachTerm,
} from "./bodyMark";
import {
  gripAxes,
  gripCenter,
  gripFrame,
  gripHand,
  gripOf,
  gripPoint,
  handAxes,
  HOLD_SLEW_STEP,
  leadSide,
  mixGrip,
  type GripFrame,
  type GripHand,
  type HoldAim,
  type HoldTarget,
  type ReachHold,
} from "./heldItem";
import { defaultCharacter, type CharacterData } from "./schema";

export {
  actAngles,
  AIM_BEND,
  AIM_DEV,
  armFrame,
  armInner,
  armSide,
  bones3,
  BONES3,
  CLAD_DEPTH,
  CLAD_GAP,
  CLAD_TAPER,
  cladArm,
  cladHand,
  cladProfile,
  cladThigh,
  handScale,
  head3,
  HUMAN_NECK,
  markAt,
  markShape,
  openLength,
  roots3,
  SLEEVE_EASE,
  sleeveGrow,
  SPLAY3,
  THIGH_CLEAR,
  THIGH_RAMP,
  THIGH_REACH,
  THIGH_ROOT,
  trunk3,
  TURN_MAX,
  twoBone3,
  type ActCharacter,
  type ActFrame,
  type ActHands,
  type ActInput,
  type ActJoint,
  type ArmRoom,
  type Bones3,
  type Build3,
  type Limb3,
  type PoseIn,
  type ReachIn,
  type Trunk3,
} from "./arm3";

/**
 * Xoắn vai và lệch cổ tay (độ) người 3D vẽ cho một kênh tay: số thứ năm và thứ ba của tuple ở kênh nâng; kênh giữ 2D
 * ở dáng nghỉ nên là `0`. Xoắn vai dương là xoay ngoài: khuỷu gập ra trước thì cẳng tay quay ra phía chính tay ấy
 */
export function actTwist(P: Pick<PoseIn, "af" | "an" | "lift">, ch: "af" | "an"): [number, number] {
  const v = P[ch];
  return P.lift?.[ch] ? [num(v[4]), num(v[2])] : [0, 0];
}

/** Bàn tay của một kênh tay (`HAND_DOF`): `pose.hand`, không ghi là `HAND_REST`; không cần cờ nâng */
export const actHand = (P: Pick<PoseIn, "hand">, ch: "af" | "an"): readonly number[] =>
  P.hand?.[ch] ?? HAND_REST;

const num = (v: number | undefined) => (Number.isFinite(v) ? (v as number) : 0);
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * Tay bên `side` (`-1` tay phải) với tới đích hệ thân `rb` rồi đích thế giới rig `rw`, hoà trên vị trí
 * cổ tay theo `w`: `S`, `E`, `T` là vai, khuỷu, cổ tay của chuỗi góc trong three, `hinge` trục bản lề khuỷu của chuỗi
 * ấy (cột x của vai). Trả khuỷu, cổ tay và trục bản lề mới, không có đích thì `undefined`. Chuỗi góc duỗi thẳng thì
 * phía khuỷu suy từ `hinge`, nên ở phần đích nhỏ bản lề IK trùng bản lề góc: cẳng tay không xoay giật lúc đích bắt
 * đầu kéo. Đích hệ thân soạn ở `height = 1`, nhân `height` như `reachToWorld`. `act` và `actJoints` cùng gọi.
 */
export function actReach(
  frame: ActFrame,
  side: number,
  [S, E, T0]: readonly [V3, V3, V3],
  l1: number,
  l2: number,
  rb: ReachIn | undefined,
  rw: ReachIn | undefined,
  height = 1,
  hinge?: V3,
): [V3, V3, V3] | undefined {
  if (!(rb && rb.w > 0) && !(rw && rw.w > 0)) return undefined;
  const body = ([f, y, o]: readonly number[]): V3 => [side * o, -y, f];
  let T = T0;
  const axis = unit(sub(T, S));
  const bend = sub(sub(E, S), mul(axis, dot(sub(E, S), axis)));
  const straight: V3 = hinge ? cross(hinge, axis) : [0, 0, 0];
  let pole =
    dot(bend, bend) > 1e-10
      ? unit(bend)
      : dot(straight, straight) > 1e-10
        ? unit(straight)
        : unit(frame.dir(body(REACH_ELBOW)));
  const toward = (r: typeof rb, target: () => V3, el: V3) => {
    if (!r || !(r.w > 0)) return;
    const k = Math.min(1, r.w);
    T = add(T, mul(sub(target(), T), k));
    pole = add(mul(pole, 1 - k), mul(unit(el), k));
  };
  toward(
    rb,
    () => frame.point(mul(body(rb!.at), 0.01 * height)),
    frame.dir(body(rb?.elbow ?? REACH_ELBOW)),
  );
  toward(
    rw,
    () => [rw!.at[0] * 0.01, -rw!.at[1] * 0.01, -rw!.at[2] * 0.01],
    rw?.elbow ? [rw.elbow[0], -rw.elbow[1], -rw.elbow[2]] : frame.dir(body(REACH_ELBOW)),
  );
  return twoBone3(S, T, l1, l2, pole);
}

/** Khung bàn tay three của một bên: cổ tay, hướng `Rw` (cột x, y, z của khung bàn tay `handFrames`), cỡ bàn tay */
interface Wrist3 {
  at: V3;
  R: M3;
  k: number;
  long: number;
  v: readonly number[];
}

/** Tay bên `side` của thân `T` ở tư thế `P` với đích thế giới `hands`: vai, khuỷu, cổ tay, khung bàn tay */
function arm3(T: Trunk3, P: PoseIn, hands: ActHands | undefined, side: number) {
  const { B, roots, near, s, at, frame } = T;
  const st = P.stretch;
  const isNear = side === near;
  const ch = isNear ? "an" : "af";
  const [a, b, sp] = actAngles(P, ch, false);
  const [twist, dev] = actTwist(P, ch);
  const sh = at(T.hips, T.Rs, [side * roots.shoulder[0], roots.shoulder[1], 0]);
  // Euler 'ZXY' của vai: dang · gập · xoắn quanh chính cánh tay
  const Rsh = mm(T.Rs, mm(mm(rz(side * (roots.splay + sp * D)), rx(-a * D)), ry(side * twist * D)));
  const l1 = B.upperArm * (st[isNear ? 2 : 0] ?? 1);
  const l2 = B.foreArm * (st[isNear ? 3 : 1] ?? 1);
  const el = at(sh, Rsh, [0, -l1, 0]);
  let Re = mm(Rsh, rx(-b * D));
  let wr = at(el, Re, [0, -l2, 0]);
  const ik = actReach(
    frame,
    side,
    [sh, el, wr],
    l1 * s,
    l2 * s,
    P.reach?.[ch],
    isNear ? hands?.near : hands?.far,
    B.height,
    mv(Rsh, [1, 0, 0]),
  );
  let elbow = el;
  if (ik) {
    const f = armFrame(sh, ik[0], ik[1], ik[2]);
    [elbow, wr] = ik;
    Re = mm(f.R, rx(-f.b));
  }
  const v = actHand(P, ch);
  const Rw = mm(Re, wristTurn(v[0], v[1], dev, side));
  const grip: V3 = T.hand
    ? handGrip(side, T.hand.k, T.hand.long)
    : [0, -(BONES3.limb * T.w.sleeve) / 10, 0];
  return { ch, sh, elbow, wr, Re, Rw, dev, grip, v };
}

/** `pose3` theo từng mẫu `sp`: `actJoints` và `actPalms` hỏi cùng một mẫu nhiều lần */
const pose3Memo = new WeakMap<ActInput, { c: ActCharacter; p: ReturnType<typeof solvePose3> }>();

/** Khớp three (chưa đổi sang rig), khung bàn tay hai bên và hướng hông `Rr` của một người 3D; đích theo mốc đã giải */
function pose3(c: ActCharacter, sp0: ActInput) {
  const hit = pose3Memo.get(sp0);
  if (hit?.c === c) return hit.p;
  const p = solvePose3(c, sp0);
  pose3Memo.set(sp0, { c, p });
  return p;
}

function solvePose3(c: ActCharacter, sp0: ActInput) {
  const T0 = trunk3(c, sp0);
  if (!T0) return undefined;
  const sp = solveActing(T0, sp0).input;
  const T = sp === sp0 ? T0 : { ...T0, P: sp.pose, W: sp.world! };
  const out = T.out;
  const wrists: Partial<Record<"R" | "L", Wrist3>> = {};
  const frames = {} as Record<"R" | "L", { at: V3; R: M3 }>;
  for (const side of [T.near, -T.near]) {
    const A = arm3(T, sp.pose, sp.world?.hands, side);
    const tag = T.tag(side);
    frames[tag] = { at: A.wr, R: A.Rw };
    out[`shoulder${tag}` as ActJoint] = A.sh;
    out[`elbow${tag}` as ActJoint] = A.elbow;
    out[`wrist${tag}` as ActJoint] = A.wr;
    out[`hand${tag}` as ActJoint] = T.at(A.wr, A.Rw, A.grip);
    if (T.hand)
      wrists[tag] = { at: A.wr, R: A.Rw, k: T.hand.k * T.s, long: T.hand.long * T.s, v: A.v };
  }
  return {
    joints: out,
    wrists: T.hand ? (wrists as Record<"R" | "L", Wrist3>) : undefined,
    Rr: T.Rr,
    Rs: T.Rs,
    T,
    frames,
  };
}

/** Lặp giải đích theo điểm bàn tay và hướng lòng tay: chỗ bàn tay và hướng cổ tay phụ thuộc nhau, hội tụ trong vài vòng */
const AIM_ITER = 8;
/** Lưới gập cổ tay của bước dò `aimWrist`: bội `15` nằm trong `±AIM_BEND` cộng hai biên */
const AIM_BEND_N = Math.ceil(AIM_BEND / 15);
const AIM_BEND_GRID = [
  -AIM_BEND,
  ...Array.from({ length: 2 * AIM_BEND_N - 1 }, (_, i) => (i + 1 - AIM_BEND_N) * 15),
  AIM_BEND,
];

const ZERO3: V3 = [0, 0, 0];
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const ang = (a: V3, b: V3) =>
  (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;

/** Hướng hệ thân `[tiến, y, ra ngoài]` của tay bên `hand` ra three */
const bodyDir = (T: Trunk3, hand: number, [f, y, o]: readonly number[]): V3 =>
  unit(mv(T.Rr, [hand * o, -y, f]));

/**
 * Xoay cẳng tay `turn`, gập cổ tay `bend` và lệch cổ tay `dev` (độ) cho khung cẳng tay `Re` của tay bên `side`: lòng tay
 * quay về `palm`, ngón chĩa về `fingers` (three). Lòng tay chỉ phụ thuộc xoay và gập (khung bàn tay: lòng tay `−side · x`
 * không đổi theo lệch), nên giải đúng hai góc ấy rồi lấy lệch cho ngón; `dev` thiếu là lệch cố định ở số ấy. `bend` khai
 * thì giữ. Ngoài giới hạn (`−90..90`, `±AIM_BEND`, `±AIM_DEV`) thì tinh chỉnh trong hộp giới hạn. Trả cả góc lệch còn lại
 */
export function aimWrist(
  Re: M3,
  side: number,
  palm: V3 | undefined,
  fingers: V3 | undefined,
  o: {
    bend?: number;
    dev?: number;
    fixedDev?: number;
    fast?: boolean;
    /** Trục khung bàn tay `h` quay về hướng thế giới `d`, phần `w`: thay giá của lòng tay, ngón (ý định của món cầm) */
    axes?: readonly { h: V3; d: V3; w: number }[];
  } = {},
): {
  turn: number;
  bend: number;
  dev: number;
  palmErr?: number;
  fingerErr?: number;
  axisErr?: number[];
} {
  const Ri = tr(Re);
  const ax = o.axes?.map((a) => ({ h: a.h, d: mv(Ri, unit(a.d)), w: a.w }));
  const dp = palm && mv(Ri, unit(palm));
  const df = fingers && mv(Ri, unit(fingers));
  const freeDev = o.fixedDev === undefined;
  const R = (t: number, b: number, d: number) => wristTurn(t, b, d, side);
  const n = (t: number, b: number) => mv(R(t, b, 0), [-side, 0, 0]);
  const fi = (t: number, b: number, d: number) => mv(R(t, b, d), [0, -1, 0]);
  const clampT = (t: number) => Math.max(-TURN_MAX, Math.min(TURN_MAX, t));
  const clampB = (b: number) =>
    o.bend !== undefined ? o.bend : Math.max(-AIM_BEND, Math.min(AIM_BEND, b));
  const clampD = (d: number) =>
    freeDev ? Math.max(-AIM_DEV, Math.min(AIM_DEV, d)) : (o.fixedDev as number);
  /** Lệch cổ tay tốt nhất cho ngón ở xoay, gập đã chọn */
  const bestDev = (t: number, b: number) => {
    if (!df || !freeDev) return clampD(o.dev ?? 0);
    const M = R(t, b, 0);
    const c1 = dot(mv(M, [0, 1, 0]), df);
    const c2 = dot(mv(M, [0, 0, 1]), df);
    return clampD((Math.atan2(c2, -c1) * 180) / Math.PI);
  };
  const cost = (t: number, b: number, d: number) =>
    ax
      ? ax.reduce((c, a) => c + a.w * (1 - dot(mv(R(t, b, d), a.h), a.d)), 0) + 1e-4 * (b / 90) ** 2
      : costPF(t, b, d);
  const costPF = (t: number, b: number, d: number) =>
    (dp ? 1 - dot(n(t, b), dp) : 0) +
    (df ? (dp ? 0.6 : 1) * (1 - dot(fi(t, b, d), df)) : 0) +
    1e-4 * (b / 90) ** 2;
  let best: [number, number, number] = [0, clampB(0), clampD(o.dev ?? 0)];
  if (dp) {
    const b = o.bend ?? (Math.asin(Math.max(-1, Math.min(1, dp[1]))) * 180) / Math.PI;
    const t = (Math.atan2(-dp[2], -side * dp[0]) * 180) / Math.PI;
    best = [clampT(t), clampB(b), 0];
    best[2] = bestDev(best[0], best[1]);
  } else if (df) {
    let c = Infinity;
    for (let t = -TURN_MAX; t <= TURN_MAX; t += 15)
      for (const b of AIM_BEND_GRID) {
        const bb = clampB(b);
        const d = bestDev(t, bb);
        const v = cost(t, bb, d);
        if (v < c - 1e-12) [c, best] = [v, [t, bb, d]];
        if (o.bend !== undefined) break;
      }
  }
  if ((dp || df) && !o.fast) {
    // tinh chỉnh trong hộp giới hạn: đúng cả khi lời giải đúng nằm ngoài giới hạn
    let c = cost(...best);
    for (let step = 8; step > 0.02; step /= 2)
      for (let moved = true; moved;) {
        moved = false;
        for (const [i, dx] of [
          [0, step],
          [0, -step],
          [1, step],
          [1, -step],
          [2, step],
          [2, -step],
        ]) {
          const q: [number, number, number] = [...best];
          q[i] += dx;
          q[0] = clampT(q[0]);
          q[1] = clampB(q[1]);
          q[2] = clampD(q[2]);
          const v = cost(...q);
          if (v < c - 1e-12) [c, best, moved] = [v, q, true];
        }
      }
  }
  const [t, b, d] = best;
  return {
    turn: t,
    bend: b,
    dev: d,
    ...(dp && { palmErr: ang(n(t, b), dp) }),
    ...(df && { fingerErr: ang(fi(t, b, d), df) }),
    ...(ax && { axisErr: ax.map((a) => ang(mv(R(t, b, d), a.h), a.d)) }),
  };
}

/** Một tay đã giải: đích đã quy về số, số bàn tay, và độ lệch còn lại so với cái đã khai */
export interface AimReport {
  /**
   * Mốc của đích (`at` là toạ độ thô với điểm khác cổ tay) và khe từ điểm bàn tay tới đích, rig; chỉ khi phần đích đủ `1`.
   * `hold`: đích do món đang cầm — `support` tay phụ với tới mốc kiểu cầm của nó trên món, `item` điểm `item:<mốc>`
   */
  reach?: { to: BodyMark | "at"; point: ReachPoint; gap: number; hold?: "support" | "item" };
  /** Góc lệch còn lại của lòng tay, của ngón so với hướng đã khai, độ */
  palm?: number;
  fingers?: number;
  /** Hai tay cùng bám vào tay kia: tay giải trước dùng chỗ chưa giải của tay kia */
  cycle?: boolean;
  /**
   * Ý định của món đang cầm, trục chính: trục trong khung món, hướng muốn và hướng đạt (thế giới rig, đơn vị), góc lệch
   * còn lại (độ) và các khớp cổ tay đang kẹp ở giới hạn
   */
  hold?: {
    axis: V3;
    want: V3;
    got: V3;
    err: number;
    clamped: ("turn" | "bend" | "dev")[];
    /** Đích của trục chính như scene khai (`up`, `camera`, `holderFace`, `<người>.<mốc>`, mốc thân, vectơ) */
    toward?: string;
    /**
     * Lệch còn quá `HOLD_ALT`: các kiểu cầm khác của cùng món (cùng một tay hay cùng hai tay) với cùng ý định, cánh tay giữ
     * nguyên, lệch còn lại (độ), ít trước
     */
    alts?: { grip: string; err: number }[];
  };
}

const hasTerms = (r: ReachIn | undefined) => !!(r && r.w > 0 && r.terms?.length);
const usesOther = (r: ReachIn | undefined, a: Aim | undefined) =>
  !!(
    (r && r.w > 0 && r.terms?.some((t) => isOtherHand(t.to))) ||
    a?.terms.some((t) => isOtherHand(t.palm?.to) || isOtherHand(t.fingers?.to))
  );

/** Có gì phải giải: đích có số hạng, bàn tay theo ý định */
export function needsSolve(sp: ActInput): boolean {
  const P = sp.pose;
  const h = sp.world?.hands;
  return !!(
    hasTerms(P.reach?.af) ||
    hasTerms(P.reach?.an) ||
    P.aim?.af ||
    P.aim?.an ||
    hasTerms(h?.near) ||
    hasTerms(h?.far) ||
    h?.near?.aim ||
    h?.far?.aim ||
    h?.near?.hold ||
    h?.far?.hold
  );
}

/** Bỏ phần theo mốc và ý định, giữ số ước lượng: cho chỗ không giải được (không có `world`, không biết nhân vật) */
export function plainActing<T extends ActInput>(sp: T): T {
  if (!needsSolve(sp)) return sp;
  const strip = (r: ReachIn | undefined) =>
    r && ({ at: r.at, ...(r.elbow && { elbow: r.elbow }), w: r.w } as ReachIn);
  const P = sp.pose;
  const reach = P.reach && { af: strip(P.reach.af), an: strip(P.reach.an) };
  const h0 = sp.world?.hands;
  // đích thế giới theo mốc không có chỗ ước lượng: bỏ
  const marked = (r: ReachIn | undefined) => (r?.terms?.some((t) => t.to) ? undefined : r);
  const h = h0 && { near: marked(h0.near), far: marked(h0.far) };
  return {
    ...sp,
    pose: { ...P, ...(reach && { reach }), aim: undefined },
    ...(sp.world && {
      world: { ...sp.world, ...(h && { hands: { near: strip(h.near), far: strip(h.far) } }) },
    }),
  };
}

/** Khuỷu được xoay quanh trục vai → cổ tay tới ngần này độ khi hành động khai hướng ngón, để ngón theo được hướng ấy */
export const AIM_SWIVEL = 90;
const SWIVEL_STEP = 15;
/** Giá mỗi độ xoay khuỷu khỏi hướng đã khai, quy ra độ lệch của lòng tay */
const SWIVEL_COST = 0.08;
/**
 * Món đang cầm: giá xoay khuỷu tăng theo bình phương, bằng giá thẳng ở ngần này độ — ý định nhích khuỷu từ từ quanh
 * hướng đã khai, không nhảy sang nghiệm xa chỉ để bớt vài độ lệch của món
 */
const HOLD_SWIVEL = 10;

/** Quay `v` quanh trục đơn vị `u` một góc `a` (radian) */
const spin = (v: V3, u: V3, a: number): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return add(add(mul(v, c), mul(cross(u, v), s)), mul(u, dot(u, v) * (1 - c)));
};

/** Độ xoay, gập, lệch cổ tay tối đa của tay mang món giữa hai mẫu `HOLD_SLEW_STEP` liền nhau */
export const HOLD_SLEW = 15;
/** Ý định của món còn lệch quá ngần này độ thì bộ giải thử các kiểu cầm khác của cùng món (`AimReport.hold.alts`) */
export const HOLD_ALT = 30;
/** Độ xoay khuỷu (quanh trục vai → đích) tối đa của tay mang món giữa hai mẫu `HOLD_SLEW_STEP` liền nhau */
export const HOLD_SWIVEL_SLEW = 5;

const lerp3 = (a: V3, b: V3, f: number): V3 => add(mul(a, 1 - f), mul(b, f));

/**
 * Liên kết của tay mang món ở khung này và tâm nắm của dáng: kiểu cầm đang có, hoà từ kiểu cầm trước của cùng món
 * (`hold.from`) trong quãng hoà
 */
export function leadGrip(
  h: ReachHold,
  hand: GripHand,
  side: number,
  k: number,
  long: number,
  s: number,
): { G: GripFrame; center: V3 } {
  const G = gripFrame(h.spec, hand, side, k, long, s);
  const center = gripCenter(hand.pose, side, k, long);
  const g0 = h.from && h.from.k > 0 ? gripOf(h.spec, h.from.grip) : undefined;
  if (!g0) return { G, center };
  const h0 = gripHand(g0, side);
  const f = 1 - h.from!.k;
  return {
    G: mixGrip(gripFrame(h.spec, h0, side, k, long, s), G, f),
    center: lerp3(gripCenter(h0.pose, side, k, long), center, f),
  };
}

/** Bàn tay của kiểu cầm trước (`hold.from`) cho tay phụ: tay kia của kiểu hai tay cũ, hay kiểu cũ của chính nó (đổi tay) */
function supportFrom(h: ReachHold, side: number, lead: number): GripHand | undefined {
  const g0 = h.from && h.from.k > 0 ? gripOf(h.spec, h.from.grip) : undefined;
  if (!g0) return undefined;
  if (g0.both) return leadSide(g0.both.lead) === lead ? g0.both.other : undefined;
  return gripHand(g0, side);
}

/** Vai trò một bàn tay với món đang cầm: `lead` mang món, `support` với tới mốc của nó trên món tay `lead` mang */
export interface HoldRole {
  hold: ReachHold;
  role: "lead" | "support";
  /** Bàn tay của kiểu cầm cho tay này */
  hand: GripHand;
  /** Bên (`-1` phải) của tay mang món */
  lead: number;
}

/**
 * Vai trò hai bàn tay theo lần cầm của `world.hands` (`near`: bên của tay gần). Kiểu cầm hai tay (`both`): món theo
 * `both.lead`, tay kia với tới `both.other` (tay ấy không khai `hold` hay khai cùng món). Hai tay cùng khai một món kiểu
 * một tay (đổi tay): tay cầm trước (`since` nhỏ hơn, bằng nhau thì tay phải) mang món, tay kia với tới mốc kiểu cầm của mình
 */
export function holdRoles(
  hands: ActHands | undefined,
  near: number,
): Partial<Record<number, HoldRole>> {
  const out: Partial<Record<number, HoldRole>> = {};
  // kiểu treo không chiếm bàn tay: không có vai trò, tay ấy cầm kiểu hai tay hay làm tay phụ được
  const own = (side: number) => {
    const h = (side === near ? hands?.near : hands?.far)?.hold;
    return h && gripOf(h.spec, h.grip) ? h : undefined;
  };
  for (const side of [-1, 1]) {
    const h = own(side);
    const g = h && gripOf(h.spec, h.grip);
    if (!h || !g?.both) continue;
    const L = leadSide(g.both.lead);
    const free = (x: ReachHold | undefined) => !x || x.item === h.item;
    if (out[L] || out[-L] || !free(own(L)) || !free(own(-L))) continue;
    out[L] = { hold: h, role: "lead", hand: gripHand(g, L), lead: L };
    out[-L] = { hold: h, role: "support", hand: g.both.other, lead: L };
  }
  const right = own(-1);
  const left = own(1);
  const lead = right && left && right.item === left.item ? (left.since < right.since ? 1 : -1) : 0;
  for (const side of [-1, 1]) {
    const h = own(side);
    const g = h && gripOf(h.spec, h.grip);
    if (out[side] || !h || !g) continue;
    const role = lead && side !== lead ? "support" : "lead";
    out[side] = { hold: h, role, hand: gripHand(g, side), lead: lead || side };
  }
  return out;
}

/** Phép quay đưa hướng đơn vị `a` về `b` theo đường ngắn nhất */
function turnTo(a: V3, b: V3): M3 {
  const c = Math.max(-1, Math.min(1, dot(a, b)));
  let u = cross(a, b);
  if (len(u) < 1e-9) {
    if (c > 0) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    u = cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
  }
  const n = unit(u);
  const g = Math.acos(c);
  return fromColumns(spin([1, 0, 0], n, g), spin([0, 1, 0], n, g), spin([0, 0, 1], n, g));
}

const UP3: V3 = [0, 1, 0];

/** Xoay, gập, lệch cổ tay và góc xoay khuỷu quanh trục vai → đích (độ) */
type WristTbd = [number, number, number, number];

/** Xoay, gập, lệch cổ tay đã giải hai bên ở tư thế mẫu trước (`ReachHold.prior`), theo bên giải phẫu */
const priorWrists = new WeakMap<
  object,
  { c: ActCharacter; wrist: Partial<Record<"R" | "L", WristTbd>> }
>();

/** Dấu vân của nhân vật: chỗ gọi dựng lại object nhân vật mỗi khung vẫn trúng bộ nhớ của chuỗi */
const prints = new WeakMap<object, string>();
const sameC = (a: ActCharacter | undefined, b: ActCharacter) =>
  a === b || (!!a && printOf(a) === printOf(b));
const printOf = (c: ActCharacter) => {
  let p = prints.get(c);
  if (p === undefined) prints.set(c, (p = JSON.stringify(c)));
  return p;
};

/**
 * Cổ tay bên `tag` ở mẫu trước của lần cầm `h`. Mẫu ấy giải theo mẫu trước nó, tới mốc đầu — một chuỗi chỉ phụ thuộc
 * scene, nên khung nào giải trước cũng ra cùng số
 */
function priorWrist(c: ActCharacter, h: ReachHold, tag: "R" | "L"): WristTbd | undefined {
  // lùi theo chuỗi tới mẫu đã giải rồi giải xuôi: mỗi lần giải chỉ hỏi mẫu ngay trước nó, đã có sẵn
  const chain: ActInput[] = [];
  for (let cur: ReachHold | undefined = h; cur?.prior;) {
    const sp = cur.prior.pose() as ActInput;
    if (sameC(priorWrists.get(sp)?.c, c)) break;
    chain.push(sp);
    const W = sp.world;
    const near = W && (tag === "R" ? -1 : 1) === (W.flip ? 1 : -1);
    const [own, other] = near ? [W?.hands?.near, W?.hands?.far] : [W?.hands?.far, W?.hands?.near];
    cur = own?.hold ?? other?.hold;
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    const T = trunk3(c, chain[i]);
    priorWrists.set(chain[i], { c, wrist: T ? solveActing(T, chain[i]).wrist : {} });
  }
  const sp = h.prior?.pose();
  const hit = sp && priorWrists.get(sp);
  return hit && sameC(hit.c, c) ? hit.wrist[tag] : undefined;
}

function solveActing(
  T: Trunk3,
  sp: ActInput,
): {
  input: ActInput;
  report: Record<"R" | "L", AimReport>;
  /** Xoay, gập, lệch cổ tay của tay mang món theo ý định: cho mẫu sau (`ReachHold.prior`) */
  wrist: Partial<Record<"R" | "L", WristTbd>>;
} {
  const report = { R: {}, L: {} } as Record<"R" | "L", AimReport>;
  const wrist: Partial<Record<"R" | "L", WristTbd>> = {};
  if (!needsSolve(sp)) return { input: sp, report, wrist };
  const P0 = sp.pose;
  const W0 = sp.world!;
  let P: PoseIn = { ...P0, reach: { ...P0.reach }, hand: { ...P0.hand }, aim: undefined };
  const hands: ActHands = { ...W0.hands };
  const { near, s } = T;
  const k = T.hand ? T.hand.k * s : 1;
  const long = T.hand ? T.hand.long * s : 1;
  const roles = holdRoles(W0.hands, near);
  // món trong khung bàn tay (tay mang món) và tâm nắm của dáng kiểu cầm; người que không bàn tay nắm ở mút nét
  const extras: Partial<Record<number, HoldState>> = {};
  for (const side of [-1, 1]) {
    const r = roles[side];
    if (!r) continue;
    const stick: V3 | undefined = T.hand
      ? undefined
      : [0, (-(BONES3.limb * T.w.sleeve) / 10) * s, 0];
    let center = gripCenter(r.hand.pose, side, k, long);
    let G: GripFrame | undefined;
    if (r.role === "lead") {
      ({ G, center } = leadGrip(r.hold, r.hand, side, k, long, s));
      if (stick) G = { ...G, p: add(sub(G.p, center), stick) };
    }
    extras[side] = { gripAt: stick ?? center, ...(G && { G, spec: r.hold.spec }) };
  }
  const state = (A: ReturnType<typeof arm3>, side: number): HandState => ({
    at: A.wr,
    R: A.Rw,
    k,
    long,
    v: A.v,
    side,
    ...(!T.hand && { stick: mul(A.grip, s) }),
    ...extras[side],
  });
  const sides = [near, -near];
  const dep = (side: number) => {
    const rw = side === near ? W0.hands?.near : W0.hands?.far;
    const ch = side === near ? "an" : "af";
    return (
      usesOther(P0.reach?.[ch], P0.aim?.[ch]) ||
      usesOther(rw, rw?.aim) ||
      roles[side]?.role === "support"
    );
  };
  // tay bám vào tay kia giải sau tay kia
  if (dep(near) && !dep(-near)) sides.reverse();
  const cycle = dep(near) && dep(-near);
  const done: Partial<Record<number, HandState>> = {};
  const fromRig = (p: readonly number[]): V3 => [p[0] * 0.01, -p[1] * 0.01, -p[2] * 0.01];
  for (const side of sides) {
    const ch = side === near ? "an" : "af";
    const wk = side === near ? "near" : "far";
    const rb = P0.reach?.[ch];
    const role = roles[side];
    let rw = W0.hands?.[wk];
    const lead = role?.role === "support" ? done[role.lead] : undefined;
    let entering = false;
    if (role?.role === "support" && lead?.G && lead.spec) {
      // tay phụ: đích là mốc kiểu cầm của tay này trên món tay kia mang, lòng tay và ngón theo khung món
      let ax = gripAxes(lead.spec, role.hand);
      const h0 = supportFrom(role.hold, side, role.lead);
      if (h0) {
        // đổi kiểu cầm: mốc của tay phụ trên món hoà từ kiểu cũ
        const a0 = gripAxes(lead.spec, h0);
        const f = 1 - role.hold.from!.k;
        ax = {
          at: lerp3(a0.at, ax.at, f),
          palm: unit(lerp3(a0.palm, ax.palm, f)),
          fingers: unit(lerp3(a0.fingers, ax.fingers, f)),
        };
      }
      const toW = (v: V3) => mv(lead.R, mv(lead.G!.R, v));
      const at = rigOf(add(lead.at, mv(lead.R, gripPoint(lead.G, ax.at))));
      const item: ReachTerm = { k: 1, at, point: "grip" };
      const held: AimTerm = {
        k: 1,
        palm: { abs: toW(ax.palm) },
        fingers: { abs: toW(ax.fingers) },
      };
      // vừa cầm: tay phụ hoà từ chỗ nó đang ở (đích của nó, hay hành động) tới mốc trên món
      const own = rw?.hold?.item === role.hold.item ? rw.hold : role.hold;
      const e = own.enter ?? 1;
      entering = e < 0.999;
      const was: readonly ReachTerm[] | undefined =
        rw && rw.w > 0
          ? hasTerms(rw)
            ? rw.terms
            : [{ k: 1, at: [...rw.at] as V3, point: "wrist" }]
          : undefined;
      rw = {
        w: entering ? (was ? rw!.w + (1 - rw!.w) * e : e) : 1,
        at,
        ...(rw?.elbow && { elbow: rw.elbow }),
        terms: entering
          ? [...(was ?? []).map((t) => ({ ...t, k: t.k * (1 - e) })), { ...item, k: was ? e : 1 }]
          : [item],
        aim: {
          terms: entering
            ? [
                { ...held, k: e },
                ...(rw?.aim?.terms ?? [{ k: 1, keep: true }]).map((t) => ({
                  ...t,
                  k: t.k * (1 - e),
                })),
              ]
            : [held],
        },
        ...(rw?.hold && { hold: rw.hold }),
      };
    }
    const aimB = P0.aim?.[ch];
    const aimW = rw && (rw.w > 0 || rw.hold) ? rw.aim : undefined;
    if (!hasTerms(rb) && !hasTerms(rw) && !aimB && !aimW && !role) continue;
    const other = done[-side] ?? state(arm3(T, P, hands, side * -1), -side);
    const rep: AimReport = cycle ? { cycle: true } : {};
    const raw = actHand(P0, ch);
    // đang cầm: ngón theo dáng của kiểu cầm, không theo hành động
    const fingersV = role ? fingerVec(HAND_POSES[role.hand.pose]) : raw.slice(2);
    const body = (v: readonly number[]): V3 => [side * v[2], -v[1], v[0]];
    /** Điểm đích (three) của một số hạng và điểm bàn tay đặt vào đó */
    const goal = (t: ReachTerm, world: boolean): [V3, ReachPoint] => [
      t.to
        ? markAt(T, { to: t.to, side: t.side, offset: t.offset }, side, other)
        : world
          ? fromRig(t.at!)
          : T.frame.point(mul(body(t.at!), 0.01 * T.B.height)),
      t.point ?? (t.to ? "palm" : "wrist"),
    ];
    /** Cổ tay (three) đưa các điểm bàn tay vào đích khi khung bàn tay là `R`, góc ngón `v` */
    const wristFor = (terms: readonly ReachTerm[], world: boolean, R: M3, v: readonly number[]) => {
      let acc: V3 = ZERO3;
      let sum = 0;
      for (const t of terms) {
        const [p, pt] = goal(t, world);
        const h: HandState = {
          at: ZERO3,
          R,
          k,
          long,
          v,
          side,
          ...(!T.hand && { stick: [0, (-(BONES3.limb * T.w.sleeve) / 10) * s, 0] as V3 }),
          ...extras[side],
        };
        acc = add(acc, mul(sub(p, handAt(h, pt)), t.k));
        sum += t.k;
      }
      return mul(acc, 1 / (sum || 1));
    };
    const toBody = (p: V3): [number, number, number] => {
      const v = mul(mv(tr(T.Rr), sub(p, T.root)), 1 / (s * 0.01 * T.B.height));
      return [v[2], -v[1], side * v[0]];
    };
    const dirOf = (d: AimDir | undefined, h: HandState, from: HandPoint) =>
      d &&
      (d.abs
        ? d.abs
        : d.to
          ? sub(
              markAt(T, { to: d.to, side: d.side, offset: d.offset }, side, other),
              handAt(h, from),
            )
          : bodyDir(T, side, d.v!));
    const eye = W0.eye ?? W0.lens?.eye;
    /** Ý định của món tay này mang: trục chính (và trục phụ) quay về đích, giải qua `aimWrist`; `undefined` là giữ bàn tay */
    const holdSolve = (
      ha: HoldAim,
      base: [number, number, number],
      A: ReturnType<typeof arm3>,
      h: HandState,
      fast: boolean,
    ) => {
      const G = h.G;
      const main = ha.face ?? ha.roll;
      if (role?.role !== "lead" || !G || !main) return undefined;
      if (
        rw?.hold?.item !== ha.item ||
        (rw.hold.grip !== ha.grip && rw.hold.from?.grip !== ha.grip)
      )
        return undefined;
      const origin = add(h.at, mv(h.R, G.p));
      const dirTo = (t: HoldTarget): V3 | undefined => {
        if ("name" in t) {
          if (t.name === "camera") return eye && sub(fromRig(eye), origin);
          const a = markAt(T, { to: "eye" }, side, other);
          const b = markAt(T, { to: "eye", side: "other" }, side, other);
          return sub(mul(add(a, b), 0.5), origin);
        }
        if ("v" in t) return bodyDir(T, side, t.v);
        if ("to" in t)
          return sub(markAt(T, { to: t.to, side: t.side, offset: t.offset }, side, other), origin);
        return sub(fromRig(t.at), origin);
      };
      const want = (x: NonNullable<HoldAim["face"]>) => {
        const d0 = dirTo(x.target);
        if (!d0 || len(d0) < 1e-9) return undefined;
        let d = unit(d0);
        const u = cross(d, UP3);
        if (x.tilt && len(u) > 1e-6) d = spin(d, unit(u), x.tilt * D);
        return d;
      };
      const aH = unit(mv(G.R, main.axis));
      const dMain = want(main);
      if (!dMain) return undefined;
      const { n, f } = handAxes(side);
      const R0 = handR(A, base);
      const axes = [{ h: aH, d: dMain, w: 1 }];
      let Rt: M3 | undefined;
      const second = ha.face && ha.roll;
      const dR0 = second && want(second);
      if (second && dR0) {
        const r0 = mv(G.R, second.axis);
        const rH = sub(r0, mul(aH, dot(r0, aH)));
        const dR = sub(dR0, mul(dMain, dot(dR0, dMain)));
        if (len(rH) > 1e-3 && len(dR) > 1e-3) {
          const [ru, du] = [unit(rH), unit(dR)];
          Rt = mm(fromColumns(dMain, du, cross(dMain, du)), tr(fromColumns(aH, ru, cross(aH, ru))));
          axes.push({ h: ru, d: du, w: 0.3 });
        }
      }
      if (!Rt) {
        // một trục: quay ít nhất từ bàn tay đang có; trục phụ yếu giữ độ lăn ấy
        Rt = mm(turnTo(unit(mv(R0, aH)), dMain), R0);
        const bH = Math.abs(dot(n, aH)) < Math.abs(dot(f, aH)) ? n : f;
        axes.push({ h: bH, d: mv(Rt, bH), w: 0.15 });
      }
      const sol = aimWrist(A.Re, side, mv(Rt, n), mv(Rt, f), {
        dev: base[2],
        ...(!lifted && { fixedDev: 0 }),
        fast,
        axes,
      });
      const err = sol.axisErr?.[0] ?? 0;
      const clamped: ("turn" | "bend" | "dev")[] = [];
      if (Math.abs(sol.turn) >= 90 - 0.05) clamped.push("turn");
      if (Math.abs(sol.bend) >= AIM_BEND - 0.05) clamped.push("bend");
      // kênh giữ 2D không có lệch cổ tay: lệch bị giữ ở 0
      if (lifted ? Math.abs(sol.dev) >= AIM_DEV - 0.05 : err > 1) clamped.push("dev");
      const got = mv(mm(A.Re, wristTurn(sol.turn, sol.bend, sol.dev, side)), aH);
      return {
        sol,
        err,
        report: {
          axis: [...main.axis] as V3,
          want: rigDir(dMain),
          got: rigDir(unit(got)),
          err,
          clamped,
          ...(main.label && { toward: main.label }),
        },
      };
    };
    // lệch cổ tay chỉ đọc ở kênh nâng: kênh giữ 2D thì rig không lấy nó cho ngón
    const lifted = !!P0.lift?.[ch];
    const dev0 = lifted ? num(P0[ch][2]) : 0;
    /** Xoay, gập, lệch cổ tay của các số hạng ý định cộng theo phần; `fast` bỏ bước tinh chỉnh (thử hướng khuỷu) */
    const solveAim = (
      aim: Aim,
      base: [number, number, number],
      A: ReturnType<typeof arm3>,
      h: HandState,
      fast = false,
    ) => {
      const out: [number, number, number] = [0, 0, 0];
      let cost = 0;
      const err = { palm: 0, fingers: 0, wp: 0, wf: 0 };
      let held: { k: number; report: NonNullable<AimReport["hold"]> } | undefined;
      for (const a of aim.terms) {
        if (a.hold) {
          const r = holdSolve(a.hold, base, A, h, fast);
          const q = r ? [r.sol.turn, r.sol.bend, r.sol.dev] : base;
          for (let i = 0; i < 3; i++) out[i] += a.k * q[i];
          if (r) {
            cost += a.k * r.err;
            if (!held || a.k > held.k) held = { k: a.k, report: r.report };
          }
          continue;
        }
        if (a.raw || a.keep || (!a.palm && !a.fingers)) {
          const r = a.raw ? [a.raw[0], a.raw[1], base[2]] : base;
          for (let i = 0; i < 3; i++) out[i] += a.k * r[i];
          continue;
        }
        const sol = aimWrist(A.Re, side, dirOf(a.palm, h, "palm"), dirOf(a.fingers, h, "wrist"), {
          bend: a.bend,
          dev: base[2],
          ...(!lifted && { fixedDev: 0 }),
          fast,
        });
        out[0] += a.k * sol.turn;
        out[1] += a.k * sol.bend;
        out[2] += a.k * sol.dev;
        cost += a.k * ((sol.palmErr ?? 0) + 0.6 * (sol.fingerErr ?? 0));
        if (sol.palmErr !== undefined)
          [err.palm, err.wp] = [err.palm + a.k * sol.palmErr, err.wp + a.k];
        if (sol.fingerErr !== undefined)
          [err.fingers, err.wf] = [err.fingers + a.k * sol.fingerErr, err.wf + a.k];
      }
      return {
        tbd: out,
        cost,
        palm: err.wp > 0.5 ? err.palm / err.wp : undefined,
        fingers: err.wf > 0.5 ? err.fingers / err.wf : undefined,
        hold: held?.report,
      };
    };
    // nguồn đích đang lái tay: đích thế giới đè đích hệ thân
    const drive = rw && rw.w > 0 ? "world" : rb && rb.w > 0 ? "body" : undefined;
    const elbow0: V3 | undefined =
      drive === "world"
        ? rw!.elbow
          ? ([rw!.elbow[0], -rw!.elbow[1], -rw!.elbow[2]] as V3)
          : T.frame.dir(body(REACH_ELBOW))
        : drive === "body"
          ? T.frame.dir(body(rb!.elbow ?? REACH_ELBOW))
          : undefined;
    // hướng ngón khai trong ý định: khuỷu được xoay quanh trục vai → cổ tay để ngón theo kịp
    const wantsFingers =
      !!elbow0 &&
      [aimB, aimW].some((a) => a?.terms.some((t) => (t.fingers || t.hold) && t.k > 0.01));
    // tay đang cầm món, mang hay đỡ: khuỷu theo giá của món cầm
    const holding =
      role?.role === "support" ||
      [aimB, aimW].some((a) => a?.terms.some((t) => t.hold && t.k > 0.01));
    let tbd: [number, number, number] = [raw[0] ?? 0, raw[1] ?? 0, dev0];
    let elbow = elbow0;
    /** Đặt đích, hướng khuỷu, bàn tay và lệch cổ tay vào tư thế đang giải */
    const place = (R: M3, q: readonly number[], el: V3 | undefined) => {
      const v = [q[0], q[1], ...fingersV];
      if (hasTerms(rb)) {
        const at = toBody(wristFor(rb!.terms!, false, R, v));
        const e = drive === "body" && el ? toBodyDir(T, side, el) : rb!.elbow;
        P = { ...P, reach: { ...P.reach, [ch]: { at, ...(e && { elbow: e }), w: rb!.w } } };
      } else if (drive === "body" && el && wantsFingers)
        P = { ...P, reach: { ...P.reach, [ch]: { ...rb!, elbow: toBodyDir(T, side, el) } } };
      if (rw) {
        const g = hasTerms(rw) ? wristFor(rw.terms!, true, R, v) : fromRig(rw.at);
        const e =
          drive === "world" && el && (wantsFingers || rw.elbow)
            ? [el[0], -el[1], -el[2]]
            : rw.elbow;
        hands[wk] = { at: [g[0] * 100, -g[1] * 100, -g[2] * 100], ...(e && { elbow: e }), w: rw.w };
      }
      const arm = [...P[ch]];
      if (lifted) arm[2] = q[2];
      P = { ...P, [ch]: arm, hand: { ...P.hand, [ch]: v } };
    };
    const handR = (A: ReturnType<typeof arm3>, q: readonly number[]) =>
      mm(A.Re, wristTurn(q[0], q[1], q[2], side));
    // tay mang món theo ý định, tay đỡ món: cổ tay, khuỷu đi từ nghiệm của mẫu trước, mỗi mẫu tối đa `HOLD_SLEW`,
    // `HOLD_SWIVEL_SLEW`
    const slew =
      role?.role === "support" ||
      (role?.role === "lead" && !!aimW?.terms.some((t) => t.hold && t.k > 0.01))
        ? (priorWrist(T.c, role.hold, T.tag(side)) ?? null)
        : undefined;
    // phần của một mẫu đã trôi từ mẫu trước: tốc độ đều cả khi khung dày hơn mẫu
    const part = Math.min(1, (role?.hold.prior?.dt ?? HOLD_SLEW_STEP) / HOLD_SLEW_STEP);
    const lo = slew ? Math.max(-AIM_SWIVEL, slew[3] - HOLD_SWIVEL_SLEW * part) : -AIM_SWIVEL;
    const hi = slew ? Math.min(AIM_SWIVEL, slew[3] + HOLD_SWIVEL_SLEW * part) : AIM_SWIVEL;
    let swivel = 0;
    let A = arm3(T, P, hands, side);
    let last: V3 | undefined;
    for (let i = 0; i < AIM_ITER; i++) {
      const R = handR(A, tbd);
      if (wantsFingers && elbow0) {
        // thử xoay khuỷu quanh trục vai → đích: chọn góc cho ngón lệch ít nhất, ưu tiên gần hướng khuỷu đã khai
        place(R, tbd, elbow0);
        const S = arm3(T, P, hands, side).sh;
        const goalW =
          drive === "world"
            ? fromRig(hands[wk]!.at)
            : T.frame.point(mul(body(P.reach![ch]!.at), 0.01 * T.B.height));
        const u = unit(sub(goalW, S));
        const tryAt = (a: number) => {
          const el = spin(elbow0, u, a * D);
          place(R, tbd, el);
          const B = arm3(T, P, hands, side);
          const h = state(B, side);
          let cost = SWIVEL_COST * (holding ? (a * a) / HOLD_SWIVEL : Math.abs(a));
          for (const aim of [aimB, aimW]) if (aim) cost += solveAim(aim, tbd, B, h, true).cost;
          return { cost, a, el };
        };
        /** Dò xoay khuỷu trong `[l, h]`: lưới `SWIVEL_STEP` rồi chia đôi quanh chỗ tốt nhất */
        const search = (l: number, h: number, edges: boolean) => {
          let best = tryAt(Math.max(l, Math.min(h, 0)));
          for (let a = -AIM_SWIVEL; a <= AIM_SWIVEL; a += SWIVEL_STEP) {
            if (a < l || a > h) continue;
            const c = tryAt(a);
            if (c.cost < best.cost - 1e-9) best = c;
          }
          if (edges)
            for (const a of [l, h]) {
              const c = tryAt(a);
              if (c.cost < best.cost - 1e-9) best = c;
            }
          for (let step = SWIVEL_STEP / 2; step >= 1; step /= 2)
            for (const a of [best.a - step, best.a + step])
              if (a >= l && a <= h) {
                const c = tryAt(a);
                if (c.cost < best.cost - 1e-9) best = c;
              }
          return best;
        };
        let best = search(-AIM_SWIVEL, AIM_SWIVEL, false);
        // khuỷu mang món nhảy xa mẫu trước: dò lại trong tầm đi được
        if (best.a < lo - 1e-9 || best.a > hi + 1e-9) best = search(lo, hi, true);
        elbow = best.el;
        swivel = best.a;
      }
      place(R, tbd, elbow);
      A = arm3(T, P, hands, side);
      const h = state(A, side);
      let nb: [number, number, number] = [raw[0] ?? 0, raw[1] ?? 0, dev0];
      if (aimB) {
        const r = solveAim(aimB, nb, A, h);
        nb = r.tbd;
        [rep.palm, rep.fingers] = [r.palm, r.fingers];
      }
      if (aimW) {
        const r = solveAim(aimW, nb, A, h);
        const ww = rw!.hold ? 1 : Math.min(1, rw!.w);
        nb = nb.map((x, j) => x + (r.tbd[j] - x) * ww) as [number, number, number];
        if (ww >= 0.999) [rep.palm, rep.fingers, rep.hold] = [r.palm, r.fingers, r.hold];
      }
      tbd = nb;
      const moved = last ? len(sub(A.wr, last)) : Infinity;
      last = A.wr;
      if (moved < 1e-5 && i > 0) break;
    }
    const solved = tbd;
    if (slew !== undefined) {
      // ý định đổi nhánh cổ tay (xoay quá tầm, gập gần 90): cổ tay đi dần tới nghiệm mới
      if (slew)
        tbd = tbd.map(
          (x, j) => slew[j] + Math.max(-HOLD_SLEW * part, Math.min(HOLD_SLEW * part, x - slew[j])),
        ) as typeof tbd;
      wrist[T.tag(side)] = [...tbd, swivel];
    }
    place(handR(A, tbd), tbd, elbow);
    A = arm3(T, P, hands, side);
    const h = state(A, side);
    if (rep.hold && h.G && tbd !== solved && tbd.some((x, j) => Math.abs(x - solved[j]) > 1e-9)) {
      // cổ tay còn đang đi tới nghiệm: lệch của món đo ở bàn tay đã vẽ
      const got = rigDir(unit(mv(handR(A, tbd), unit(mv(h.G.R, rep.hold.axis)))));
      rep.hold = { ...rep.hold, got, err: ang(got, rep.hold.want) };
    }
    const hm = aimW?.terms.reduce<AimTerm | undefined>(
      (a, t) => (t.hold && (!a || t.k > a.k) ? t : a),
      undefined,
    )?.hold;
    if (role?.role === "lead" && rep.hold && rep.hold.err > HOLD_ALT && T.hand && hm) {
      // ý định không với tới: kiểu cầm khác của cùng món có với tới không — chỉ giải lại cổ tay với liên kết ấy
      const spec = role.hold.spec;
      const two = !!gripOf(spec, role.hold.grip)?.both;
      const alts: { grip: string; err: number }[] = [];
      for (const g of Object.keys(spec.grips ?? {})) {
        const gs = gripOf(spec, g);
        if (!gs || g === role.hold.grip || !!gs.both !== two) continue;
        if (gs.both && leadSide(gs.both.lead) !== side) continue;
        const G = gripFrame(spec, gripHand(gs, side), side, k, long, s);
        const r = holdSolve(hm, [raw[0] ?? 0, raw[1] ?? 0, dev0], A, { ...h, G }, false);
        if (r) alts.push({ grip: g, err: r.err });
      }
      if (alts.length) rep.hold = { ...rep.hold, alts: alts.sort((a, b) => a.err - b.err) };
    }
    const full =
      rw && rw.w >= 0.999 && hasTerms(rw) && !entering
        ? rw
        : rb && rb.w >= 0.999 && hasTerms(rb) && !(rw && rw.w > 0)
          ? rb
          : undefined;
    if (full) {
      const main = full.terms!.reduce((a, b) => (b.k > a.k ? b : a));
      const [want, pt] = goal(main, full === rw);
      let gap = len(sub(handAt(h, pt), want));
      if (full.terms!.length > 1) {
        // đang hoà giữa hai đích: đo tới đích đã hoà (đúng chỗ bộ giải nhắm), không tới đích của số hạng nặng nhất
        let acc: V3 = ZERO3;
        let sum = 0;
        for (const t of full.terms!) {
          const [p, q] = goal(t, full === rw);
          acc = add(acc, mul(sub(handAt(h, q), p), t.k));
          sum += t.k;
        }
        gap = Math.min(gap, len(acc) / (sum || 1));
      }
      rep.reach = {
        to: main.to ?? "at",
        point: pt,
        gap: (gap * 100) / s,
        ...(role?.role === "support" && full === rw
          ? { hold: "support" as const }
          : role && pt.startsWith("item:") && { hold: "item" as const }),
      };
    }
    report[T.tag(side)] = rep;
    done[side] = h;
  }
  return {
    input: {
      pose: { ...P, aim: undefined },
      world: { ...W0, ...(W0.hands && { hands }) },
    },
    report,
    wrist,
  };
}

/** Hướng three ra hệ thân `[tiến, y, ra ngoài]` của tay bên `side` */
const toBodyDir = (T: Trunk3, side: number, d: V3): [number, number, number] => {
  const v = mv(tr(T.Rr), d);
  return [v[2], -v[1], side * v[0]];
};

/**
 * Đích theo mốc (`Reach.terms`) và bàn tay theo ý định (`Pose.aim`, `aim` của `world.hands`) của một người 3D quy về số
 * mà `act` và `actJoints` đọc: đích cổ tay hệ thân, thế giới và `turn` / `bend` của bàn tay. Mốc tính trên đúng nhân vật
 * `c` ở tư thế ấy; tay bám vào tay kia giải sau tay kia. Không có gì phải giải thì trả nguyên `sp`.
 * docs/01-rig.md#đích-theo-mốc
 */
export function resolveActing<T extends ActInput>(c: ActCharacter, sp: T): T {
  if (!needsSolve(sp)) return sp;
  const T0 = trunk3(c, sp);
  if (!T0) return plainActing(sp);
  const r = solveActing(T0, sp).input;
  return { ...sp, pose: r.pose, world: r.world } as T;
}

/** Như `resolveActing`, kèm độ lệch còn lại từng tay (`AimReport`): `check`, `scene_probe` đọc */
export function actAim(
  c: ActCharacter,
  sp: ActInput,
): { input: ActInput; report: Record<"R" | "L", AimReport> } | undefined {
  const T0 = trunk3(c, sp);
  return T0 && solveActing(T0, sp);
}

const rigOf = (p: V3): V3 => [p[0] * 100, -p[1] * 100, -p[2] * 100];
const rigDir = (p: V3): V3 => [p[0], -p[1], -p[2]];

/**
 * Khớp của người 3D đúng như `act` đặt người que three: cùng khung xương (`bones3`, `roots3`), cùng
 * luật đọc góc (`actAngles`, `actTwist`, `actHand`) và cùng IK (`actReach`, `armFrame`), trả trong toạ độ thế giới
 * rig; `hand` là chỗ treo đồ cầm (`handGrip`, người que ở mút nét). Không có `world` thì không có gì. `check` đo giật
 * tay chân trên các khớp này. docs/01-rig.md#khớp-người-3d-vẽ-ra
 */
export function actJoints(
  c: Pick<CharacterData, "rig" | "pieces" | "palette" | "head">,
  sp: ActInput,
): Record<ActJoint, V3> | undefined {
  const p = pose3(c, sp);
  if (!p) return undefined;
  const out = {} as Record<ActJoint, V3>;
  for (const k of Object.keys(p.joints) as ActJoint[]) out[k] = rigOf(p.joints[k]);
  return out;
}

/**
 * Bàn tay người 3D vẽ ra, toạ độ thế giới rig: `at` tâm lòng bàn tay, `palm` pháp tuyến lòng bàn tay (hướng lòng tay
 * quay về, phía các ngón gập vào), `finger` hướng dọc bàn tay từ cổ tay ra đầu ngón; hai vectơ đơn vị. `forward` là
 * hướng mặt người nằm ngang, `out` hướng ngang từ thân ra phía tay ấy. `skin`: các điểm ngoài cùng của bàn tay theo dáng
 * đang vẽ — giữa lòng tay, giữa mu tay, hai mép lòng bàn tay, đầu ngón cái, trỏ, giữa, út (trên trục đốt)
 */
export interface ActPalm {
  at: V3;
  palm: V3;
  finger: V3;
  forward: V3;
  out: V3;
  skin: V3[];
}

/**
 * Bàn tay hai bên (`R` phải, `L` trái người) đúng như `act` đặt: cùng khung `Rw = Re · wristTurn` của `actJoints`.
 * Khung bàn tay `handFrames`: lòng tay quay về `−side · x`, ngón mọc theo −y. Chỉ người mặc đồ (`palette.clad`) có bàn
 * tay; người que hay không có `world` thì không có gì. docs/01-rig.md#hướng-lòng-bàn-tay
 */
export function actPalms(
  c: Pick<CharacterData, "rig" | "pieces" | "palette" | "head">,
  sp: ActInput,
): Record<"R" | "L", ActPalm> | undefined {
  const p = pose3(c, sp);
  if (!p?.wrists) return undefined;
  const forward = rigDir(mv(p.Rr, [0, 0, 1]));
  const out = {} as Record<"R" | "L", ActPalm>;
  for (const k of ["R", "L"] as const) {
    const side = k === "R" ? -1 : 1;
    const { at, R, k: size, long, v } = p.wrists[k];
    const world = (l: V3) => rigOf(add(at, mv(R, l)));
    const mid = (-HAND_BONES.palm.len * long) / 2;
    const [thick, half] = HAND_BONES.palm.half.map((h) => h * size);
    const f = handFrames(v, side, size, long);
    const tip = (n: HandPiece) => world(add(f[n].o, mv(f[n].R, [0, -f[n].len, 0])));
    out[k] = {
      at: world([0, mid, 0]),
      palm: rigDir(unit(mv(R, [-side, 0, 0]))),
      finger: rigDir(unit(mv(R, [0, -1, 0]))),
      forward,
      out: rigDir(mv(p.Rr, [side, 0, 0])),
      skin: [
        world([-side * thick, mid, 0]),
        world([side * thick, mid, 0]),
        world([0, mid, half]),
        world([0, mid, -half]),
        tip("thumb1"),
        tip("index1"),
        tip("middle1"),
        tip("pinky1"),
      ],
    };
  }
  return out;
}

/** Món một bàn tay đang mang (`world.hands[].hold`), thế giới rig: gốc khung món `at`, ba trục khung món (three, y lên) */
export interface ActHeld {
  item: string;
  grip: string;
  /** Gốc khung món, toạ độ thế giới rig */
  at: V3;
  /** Trục x, y, z của khung món trong thế giới three (y lên, z ra trước); món to theo `s` */
  R: M3;
  s: number;
}

/**
 * Món hai bàn tay đang mang theo `world.hands[].hold` (`R` phải, `L` trái người), đúng như `act` đặt tay và như `hold`
 * với kiểu cầm gắn món: tay phụ của món cầm hai tay không mang món. Chỉ người 3D có `world`. docs/03-scene.md#đồ-cầm-tay
 */
export function actHeld(c: ActCharacter, sp: ActInput): Partial<Record<"R" | "L", ActHeld>> {
  const p = pose3(c, sp);
  if (!p) return {};
  const T = p.T;
  const roles = holdRoles(sp.world?.hands, T.near);
  const out: Partial<Record<"R" | "L", ActHeld>> = {};
  for (const side of [-1, 1]) {
    const r = roles[side];
    if (r?.role !== "lead") continue;
    const tag = T.tag(side);
    const W = p.wrists?.[tag];
    const { at, R } = p.frames[tag];
    const k = W?.k ?? 1;
    const long = W?.long ?? 1;
    const lg = leadGrip(r.hold, r.hand, side, k, long, T.s);
    const center = lg.center;
    let G = lg.G;
    if (!W) {
      const stick: V3 = [0, (-(BONES3.limb * T.w.sleeve) / 10) * T.s, 0];
      G = { ...G, p: add(sub(G.p, center), stick) };
    }
    out[tag] = {
      item: r.hold.item,
      grip: r.hold.grip,
      at: rigOf(add(at, mv(R, G.p))),
      R: mm(R, G.R),
      s: T.s,
    };
  }
  return out;
}

/** Người mẫu cho `reachEstimate`: người mặc đồ đầu `human` số đo mặc định */
let sample: ActCharacter | undefined;

/**
 * Cổ tay hệ thân `[tiến, y, ra ngoài]` (rig, `height = 1`) ước lượng cho một đích JSON trên người mẫu đứng thẳng, thân cúi
 * `torso`: `at` của mẫu đích theo mốc (`Reach.at`), góc dự phòng của người 2D (`reachAngles`). Người 3D không đọc số này
 */
export function reachEstimate(
  r: {
    at?: readonly number[];
    to?: BodyMark;
    side?: "same" | "other";
    offset?: readonly number[];
    point?: HandPoint;
  },
  torso = 0,
): [number, number, number] {
  if (r.at && (!r.point || r.point === "wrist")) return [r.at[0], r.at[1], r.at[2]];
  if (!sample) {
    const c = defaultCharacter();
    c.palette.clad = true;
    c.head.form = "human";
    sample = c;
  }
  const z3 = [0, 0, 0];
  const T = trunk3(sample, {
    pose: { af: z3, an: z3, lf: z3, ln: z3, torso, head: z3, stretch: [1, 1, 1, 1, 1, 1, 1, 1] },
    world: { hip: z3, yaw: Math.PI / 2, s: 1, flip: false },
  })!;
  const side = -1;
  const k = T.hand ? T.hand.k : 1;
  const long = T.hand ? T.hand.long : 1;
  const p = r.to
    ? markAt(T, { to: r.to, side: r.side, offset: r.offset }, side, undefined)
    : T.frame.point(mul([side * r.at![2], -r.at![1], r.at![0]], 0.01));
  // bàn tay dựng đứng, lòng tay vào thân: điểm khác cổ tay lùi về cổ tay dọc trục ấy
  const pt = handPoint(r.point ?? (r.to ? "palm" : "wrist"), HAND_REST, side, k, long);
  const w = sub(p, pt);
  return [w[2] * 100, -w[1] * 100, side * w[0] * 100];
}

/**
 * Chỗ của mốc thân `to` (toạ độ thế giới rig) trên người `c` ở khung `sp`, cho tay bên `hand` (`R` / `L`): đúng điểm mà
 * đích theo mốc nhắm tới, gồm `offset`. Mốc trên tay kia đọc tay kia như đang vẽ. docs/01-rig.md#đích-theo-mốc
 */
export function bodyMarkAt(
  c: ActCharacter,
  sp: ActInput,
  ref: { to: BodyMark; side?: "same" | "other"; offset?: readonly number[] },
  hand: "R" | "L" = "R",
): V3 | undefined {
  const T = trunk3(c, sp);
  if (!T) return undefined;
  const side = hand === "R" ? -1 : 1;
  const r = solveActing(T, sp).input;
  const T2 = { ...T, P: r.pose, W: r.world! };
  const A = arm3(T2, r.pose, r.world?.hands, -side);
  const other: HandState = {
    at: A.wr,
    R: A.Rw,
    k: T.hand ? T.hand.k * T.s : 1,
    long: T.hand ? T.hand.long * T.s : 1,
    v: A.v,
    side: -side,
    ...(!T.hand && { stick: mul(A.grip, T.s) }),
  };
  return rigOf(markAt(T, ref, side, other));
}
