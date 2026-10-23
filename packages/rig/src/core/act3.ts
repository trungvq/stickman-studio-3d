import {
  actAngles,
  AIM_BEND,
  AIM_DEV,
  clampRange,
  overRange,
  rangeMargin,
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
  HAND_BONES,
  HAND_REST,
  handFrames,
  handGrip,
  handPoint,
  wristTurn,
  type HandPiece,
  type HandVec,
} from "./hand";
import type { RoleMap } from "./graspGroups";
import {
  graspReport,
  type GraspBy,
  type GraspChoice,
  type GraspFrame,
  type GraspReport,
  type GraspSolution,
} from "./graspSolve";
import { handDims, type HandDims } from "./heldGeom";
import { holdFrom, holdHand, holdLinkFrame, inheritHold, type HoldLinkHand } from "./holdLink";
import {
  armInput,
  evalPhi,
  refineMin,
  phiOf,
  type ArmInput,
  type ArmSeg,
  type ArmSol,
} from "./graspArm";
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
  gripPoint,
  handAxes,
  HOLD_SLEW_STEP,
  mixGrip,
  mixRotation,
  type GripFrame,
  type GraspHand,
  type HoldAim,
  type HoldGrasp,
  type HoldTarget,
  type ReachHold,
  type WasHand,
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
  torsoSection,
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
import { hermiteN } from "./action";

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
/** Lưới gập cổ tay của bước dò `aimWrist`: bội `15` nằm trong tầm `AIM_BEND` cộng hai biên */
const AIM_BEND_GRID = [
  AIM_BEND[0],
  ...Array.from(
    { length: Math.ceil(AIM_BEND[1] / 15) - Math.floor(AIM_BEND[0] / 15) + 1 },
    (_, i) => (Math.floor(AIM_BEND[0] / 15) + i) * 15,
  ).filter((b) => b > AIM_BEND[0] && b < AIM_BEND[1]),
  AIM_BEND[1],
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
 * thì giữ. Ngoài giới hạn (`−90..90`, `AIM_BEND`, `AIM_DEV`) thì tinh chỉnh trong hộp giới hạn. Trả cả góc lệch còn lại
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
  const clampB = (b: number) => (o.bend !== undefined ? o.bend : clampRange(b, AIM_BEND));
  const clampD = (d: number) => (freeDev ? clampRange(d, AIM_DEV) : (o.fixedDev as number));
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
   * `hold`: đích do món đang cầm — `support` tay phụ với tới chỗ của nó trên món, `item` điểm `item:<mốc>`
   */
  reach?: { to: BodyMark | "at"; point: ReachPoint; gap: number; hold?: "support" | "item" };
  /** Góc lệch còn lại của lòng tay, của ngón so với hướng đã khai, độ */
  palm?: number;
  fingers?: number;
  /** Hai tay cùng bám vào tay kia: tay giải trước dùng chỗ chưa giải của tay kia */
  cycle?: boolean;
  /**
   * Ý định của món đang cầm, trục chính: trục trong khung món, hướng muốn và hướng đạt (thế giới rig, đơn vị), góc lệch
   * còn lại (độ) và các khớp cổ tay đang kẹp ở giới hạn. Món đặt trước: trục là mặt trước (`+z` khung món), muốn theo bàn
   * tay đã giải, đạt theo bàn tay vẽ, lệch là góc quay giữa hai bàn tay ấy; `grasp` là chỗ cầm đã giải
   */
  hold?: {
    axis: V3;
    want: V3;
    got: V3;
    err: number;
    clamped: ("turn" | "bend" | "dev")[];
    /** Đích của trục chính như scene khai (`up`, `camera`, `holderFace`, `<người>.<mốc>`, mốc thân, vectơ) */
    toward?: string;
    grasp?: GraspReport;
  };
}

const hasTerms = (r: ReachIn | undefined) => !!(r && r.w > 0 && r.terms?.length);
/** Đích `r` nhắm mốc trên tay kia, kể cả ở mốc kề của đoạn `auto` (`spline`) */
export const reachesOther = (r: ReachIn | undefined): boolean =>
  !!r &&
  r.w > 0 &&
  [r.terms, ...(r.spline?.keys ?? [])].some((ts) => !!ts?.some((t) => isOtherHand(t.to)));
const usesOther = (r: ReachIn | undefined, a: Aim | undefined) =>
  reachesOther(r) || !!a?.terms.some((t) => isOtherHand(t.palm?.to) || isOtherHand(t.fingers?.to));

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
/** Nấc cuối của bước chia đôi khi dò xoay khuỷu, trước `refineMin` */
const SWIVEL_FINE = SWIVEL_STEP / 8;
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
/** Độ xoay khuỷu (quanh trục vai → đích) tối đa của tay mang món giữa hai mẫu `HOLD_SLEW_STEP` liền nhau */
export const HOLD_SWIVEL_SLEW = 5;

const lerp3 = (a: V3, b: V3, f: number): V3 => add(mul(a, 1 - f), mul(b, f));

/**
 * Liên kết của tay mang món ở khung này và tâm nắm của dáng: chỗ cầm đang có, hoà từ chỗ cầm trước của cùng món
 * (`hold.from`) trong quãng hoà
 */
export function leadGrip(
  h: ReachHold,
  side: number,
  k: number,
  long: number,
  s: number,
): { G: GripFrame; center: V3 } {
  const { G, center } = holdLinkFrame(h, side, k, long, s);
  const p = h.grasp?.mode === "item" && !h.grasp.keyed ? undefined : holdFrom(h);
  if (!p) return { G, center };
  const b = holdLinkFrame(p, side, k, long, s);
  const f = 1 - h.from!.k;
  return { G: mixGrip(b.G, G, f), center: lerp3(b.center, center, f) };
}

/** Bàn tay của lần cầm trước (`hold.from`) cho tay phụ: tay phụ của `both` cũ, hay chỗ cầm cũ của chính nó (đổi tay) */
function supportFrom(
  h: ReachHold,
  side: number,
  lead: number,
  dims: HandDims,
): GraspHand | undefined {
  const p = holdFrom(h);
  if (!p) return undefined;
  const L = holdHand(p, lead, dims);
  if (L?.both) return L.both.lead === lead ? L.both.other : undefined;
  return holdHand(p, side, dims)?.hand;
}

/** Vai trò một bàn tay với món đang cầm: `lead` mang món, `support` với tới mốc của nó trên món tay `lead` mang */
export interface HoldRole {
  hold: ReachHold;
  role: "lead" | "support";
  /** Bàn tay của chỗ cầm cho tay này */
  hand: GraspHand;
  /** Dáng ngón (`HAND_DOF`) của tay này khi cầm */
  pose: HandVec;
  /** Vai trò ngón (chỗ cầm nhóm) */
  roles?: RoleMap;
  /** Tầm cuộn của biến thể (chỗ cầm nhóm) */
  curl?: number;
  /** Bên (`-1` phải) của tay mang món */
  lead: number;
}

/**
 * Vai trò hai bàn tay theo lần cầm của `world.hands` (`near`: bên của tay gần). Cầm hai tay (`both`): món theo tay dẫn,
 * tay kia với tới chỗ của tay phụ (tay ấy không khai `hold` hay khai cùng món). Hai tay cùng khai một món không `both`
 * (đổi tay): tay cầm trước (`since` nhỏ hơn, bằng nhau thì tay phải) mang món, tay kia với tới chỗ cầm của mình.
 * Món đặt trước: mỗi tay khai nó đều theo món
 */
export function holdRoles(
  hands: ActHands | undefined,
  near: number,
  dims: HandDims = handDims(1),
): Partial<Record<number, HoldRole>> {
  const out: Partial<Record<number, HoldRole>> = {};
  // món treo không chiếm bàn tay: không có vai trò, tay ấy cầm hai tay hay làm tay phụ được
  const links: Partial<Record<number, { h: ReachHold; x: HoldLinkHand }>> = {};
  for (const side of [-1, 1]) {
    const h0 = (side === near ? hands?.near : hands?.far)?.hold;
    const h = h0?.released ? undefined : h0;
    const x = h && holdHand(h, side, dims);
    if (x) links[side] = { h: h!, x };
  }
  const own = (side: number) => links[side]?.h;
  for (const side of [-1, 1]) {
    const l = links[side];
    if (!l?.x.both) continue;
    const { h, x } = l;
    const b = x.both!;
    const L = b.lead;
    const free = (y: ReachHold | undefined) => !y || y.item === h.item;
    if (out[L] || out[-L] || !free(own(L)) || !free(own(-L))) continue;
    // món đặt trước: tay phụ cầm theo nghiệm của chính nó (`ReachHold.solve`); chưa có thì tay ấy tự do
    const placed = h.grasp?.mode === "item";
    const sl = placed ? links[-L] : undefined;
    if (placed && sl?.h.grasp?.mode !== "item") continue;
    const sh = sl ? sl.h : h;
    const sb = sl ? { other: sl.x.hand, pose: sl.x.pose, roles: sl.x.roles, curl: sl.x.curl } : b;
    const lx = L === side ? x : holdHand(h, L, dims)!;
    out[L] = {
      hold: h,
      role: "lead",
      hand: lx.hand,
      pose: lx.pose,
      ...(lx.roles && { roles: lx.roles }),
      ...(lx.curl !== undefined && { curl: lx.curl }),
      lead: L,
    };
    out[-L] = {
      hold: sh,
      role: "support",
      hand: sb.other,
      pose: sb.pose,
      ...(sb.roles && { roles: sb.roles }),
      ...(sb.curl !== undefined && { curl: sb.curl }),
      lead: L,
    };
  }
  const right = own(-1);
  const left = own(1);
  const lead =
    right && left && right.item === left.item && right.grasp?.mode !== "item"
      ? left.since < right.since
        ? 1
        : -1
      : 0;
  for (const side of [-1, 1]) {
    const l = links[side];
    if (out[side] || !l) continue;
    const role = lead && side !== lead ? "support" : "lead";
    out[side] = {
      hold: l.h,
      role,
      hand: l.x.hand,
      pose: l.x.pose,
      ...(l.x.roles && { roles: l.x.roles }),
      ...(l.x.curl !== undefined && { curl: l.x.curl }),
      lead: lead || side,
    };
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
const priorWrists = new WeakMap<object, Map<string, Partial<Record<"R" | "L", WristTbd>>>>();

/** Dấu vân của nhân vật: chỗ gọi dựng lại object nhân vật mỗi khung vẫn trúng bộ nhớ của chuỗi */
const prints = new WeakMap<object, string>();
const printOf = (c: ActCharacter) => {
  let p = prints.get(c);
  if (p === undefined) prints.set(c, (p = JSON.stringify(c)));
  return p;
};

/**
 * Giá trị nhớ của `key` cho nhân vật `c`, mỗi dấu vân một ô: người 3D gọi bằng nhân vật rút gọn, lõi bằng JSON đủ, gọi xen
 * nhau thì một ô mỗi khoá là đè nhau và giải lại cả chuỗi
 */
function byPrint<K extends object, V>(
  m: WeakMap<K, Map<string, V>>,
  key: K,
  c: ActCharacter,
  f: () => V,
): V {
  const p = printOf(c);
  let at = m.get(key);
  if (!at) m.set(key, (at = new Map()));
  if (!at.has(p)) at.set(p, f());
  return at.get(p)!;
}

/**
 * Cổ tay bên `tag` ở mẫu trước của lần cầm `h`. Mẫu ấy giải theo mẫu trước nó, tới mốc đầu — một chuỗi chỉ phụ thuộc
 * scene, nên khung nào giải trước cũng ra cùng số
 */
function priorWrist(c: ActCharacter, h: ReachHold, tag: "R" | "L"): WristTbd | undefined {
  // lùi theo chuỗi tới mẫu đã giải rồi giải xuôi: mỗi lần giải chỉ hỏi mẫu ngay trước nó, đã có sẵn
  const p = printOf(c);
  const chain: ActInput[] = [];
  for (let cur: ReachHold | undefined = h; cur?.prior;) {
    const sp = cur.prior.pose() as ActInput;
    if (priorWrists.get(sp)?.has(p)) break;
    chain.push(sp);
    const W = sp.world;
    const near = W && (tag === "R" ? -1 : 1) === (W.flip ? 1 : -1);
    const [own, other] = near ? [W?.hands?.near, W?.hands?.far] : [W?.hands?.far, W?.hands?.near];
    cur = own?.hold ?? other?.hold;
  }
  for (let i = chain.length - 1; i >= 0; i--)
    byPrint(priorWrists, chain[i], c, () => {
      const T = trunk3(c, chain[i]);
      return T ? solveActing(T, chain[i]).wrist : {};
    });
  const sp = h.prior?.pose();
  return sp && priorWrists.get(sp)?.get(p)?.[tag];
}

type PlacedSol = GraspSolution & { t0: number };

/** Nghiệm của tay cầm món đặt trước theo lần cầm của khung và nhân vật */
const placedMemo = new WeakMap<ReachHold, Map<string, PlacedSol | undefined>>();
/** Một object cho mỗi dấu vân nhân vật: bộ nhớ lần cầm của scene nhớ theo object nhân vật */
const canons = new Map<string, ActCharacter>();
const canon = (c: ActCharacter) => {
  const p = printOf(c);
  let x = canons.get(p);
  if (!x) {
    if (canons.size >= 32) canons.delete(canons.keys().next().value!);
    canons.set(p, (x = c));
  }
  return x;
};

/** Bàn tay của lần cầm đang hoà ra (`ReachHold.was`) trên nhân vật của thân `T` */
function wasHand(T: Trunk3, was: NonNullable<ReachHold["was"]>): WasHand | undefined {
  return byPrint(wasMemo, was, T.c, () => was.solve(canon(T.c), T));
}

/**
 * Tay cầm món đặt trước (`ReachHold.solve`) của thân `T`: nghiệm `graspAtTime` theo bên (`-1` phải), và `world.hands` với
 * khung cầm đã giải gắn vào lần cầm (`grasp.frame`); lần cầm cũ theo món còn hoà (`from`) mang khung của nghiệm cũ (`was`)
 */
function placedHolds(T: Trunk3, hands: ActHands | undefined) {
  const sols: Partial<Record<number, PlacedSol>> = {};
  let out = hands;
  for (const wk of ["near", "far"] as const) {
    const r0 = hands?.[wk];
    const h0 = r0?.hold;
    // tay dẫn kế thừa lựa chọn của lần cầm theo mốc liền trước
    const hi = h0 && inheritHold(h0, canon(T.c));
    if (hi && hi !== h0) out = { ...out, [wk]: { ...r0, hold: hi } };
    const r = out?.[wk];
    const h = r?.hold;
    const fg = h?.from?.grasp;
    if (h?.was && fg?.mode === "item" && !fg.frame && !h.released) {
      const old = wasHand(T, h.was);
      if (old && "G" in old.frame) {
        const from = { ...h.from!, grasp: { ...fg, frame: old.frame as GraspFrame } };
        out = { ...out, [wk]: { ...r, hold: { ...h, from } } };
      }
    }
    if (h?.grasp?.mode !== "item" || !h.solve || h.released) continue;
    const sol = byPrint(placedMemo, h0!, T.c, () => h.solve!(canon(T.c), T));
    if (!sol) continue;
    sols[wk === "near" ? T.near : -T.near] = sol;
    const cur = out?.[wk]?.hold ?? h;
    out = { ...out, [wk]: { ...r, hold: { ...cur, grasp: { ...h.grasp, frame: sol.frame } } } };
  }
  return { hands: out, sols };
}

/**
 * Một tay trong lần giải của `solveCore`, cho `actArm`: nghiệm của món đặt trước; hay hướng khuỷu khởi đầu (three) và
 * xoay, gập, lệch cổ tay theo ý định trước giới hạn `HOLD_SLEW`; tâm nắm của dáng chỗ cầm trong khung bàn tay
 */
export interface ArmTrace {
  placed?: PlacedSol;
  elbow0?: V3;
  aim?: readonly number[];
  gripAt?: V3;
}

type Solved = {
  input: ActInput;
  report: Record<"R" | "L", AimReport>;
  /** Xoay, gập, lệch cổ tay của tay mang món theo ý định: cho mẫu sau (`ReachHold.prior`) */
  wrist: Partial<Record<"R" | "L", WristTbd>>;
  trace: Partial<Record<"R" | "L", ArmTrace>>;
};

/** Bàn tay của lần cầm đang hoà ra (`ReachHold.was`) theo khung và nhân vật */
const wasMemo = new WeakMap<object, Map<string, WasHand | undefined>>();

/** Cánh tay vẽ ra để hoà: cổ tay, khung bàn tay, khuỷu (three) và ngón */
type ArmState = { Wp: V3; Rw: M3; El: V3; fingers: readonly number[] };

/**
 * Tay cầm món đặt trước hoà vào và ra trong `HOLD_BLEND` (docs/11-nhom-cam.md § Đổi lần cầm): từ nghiệm cũ — lần cầm món
 * đặt trước trước đó (`was`), hay tay tự do khi vừa cầm (`enter`) — sang nghiệm mới; cổ tay dời thẳng, bàn tay quay theo
 * đường ngắn nhất, `φ` hoà theo đường ngắn nhất, ngón hoà thẳng
 */
function solveActing(T: Trunk3, sp: ActInput): Solved {
  const hands = sp.world?.hands;
  if (!hands || !needsSolve(sp)) return solveCore(T, sp);
  const plan: { wk: "near" | "far"; side: number; f: number; old: WasHand | "free" }[] = [];
  let main: ActHands = hands;
  for (const wk of ["near", "far"] as const) {
    const r = hands[wk];
    const h = r?.hold;
    if (!r || !h) continue;
    const side = wk === "near" ? T.near : -T.near;
    if (h.released) main = { ...main, [wk]: { ...r, hold: undefined } };
    const old = h.was && wasHand(T, h.was);
    if (old) plan.push({ wk, side, f: 1 - h.was!.k, old });
    else if (h.grasp?.mode === "item" && h.solve && h.enter !== undefined && h.enter < 1)
      plan.push({ wk, side, f: h.enter, old: "free" });
  }
  const at = (x: ActHands) => (x === hands ? sp : { ...sp, world: { ...sp.world!, hands: x } });
  const out = solveCore(T, at(main));
  if (!plan.length) return out;
  let free: ActInput | undefined;
  if (plan.some((p) => p.old === "free")) {
    let x = main;
    for (const p of plan)
      if (p.old === "free") x = { ...x, [p.wk]: { ...x[p.wk]!, hold: undefined } };
    free = solveCore(T, at(x)).input;
  }
  let P: PoseIn = out.input.pose;
  const H: ActHands = { ...out.input.world!.hands };
  const drawn = (x: ActInput, side: number): ArmState => {
    const A = arm3(T, x.pose, x.world?.hands, side);
    return { Wp: A.wr, Rw: A.Rw, El: A.elbow, fingers: A.v.slice(2) };
  };
  for (const p of plan) {
    const a: ArmState =
      p.old === "free"
        ? drawn(free!, p.side)
        : { Wp: p.old.Wp, Rw: p.old.Rw, El: p.old.arm.elbow, fingers: p.old.frame.pose.slice(2) };
    const b = drawn(out.input, p.side);
    const inp = armInput(T, p.side);
    const Wp = lerp3(a.Wp, b.Wp, p.f);
    const fa = phiOf(inp, a.Wp, a.El);
    const fb = phiOf(inp, b.Wp, b.El);
    const d = ((((fb - fa + 180) % 360) + 360) % 360) - 180;
    const arm = evalPhi(inp, Wp, mixRotation(a.Rw, b.Rw, p.f), fa + d * p.f);
    // góc cổ tay hoà giữa hai đầu đã kẹp: góc tách từ khung bàn tay nhảy khi xoay vượt ±180
    const qa = wristOf(evalPhi(inp, a.Wp, a.Rw, fa));
    const qb = wristOf(evalPhi(inp, b.Wp, b.Rw, fb));
    const q = qa.map((x, i) => x + (qb[i] - x) * p.f);
    const fingers = b.fingers.map((x, i) => (a.fingers[i] ?? x) + (x - (a.fingers[i] ?? x)) * p.f);
    P = placeArm(P, H, p.side === T.near ? "an" : "af", p.wk, Wp, arm.pole, q, fingers);
  }
  return { ...out, input: { pose: P, world: { ...out.input.world!, hands: H } } };
}

/**
 * Đặt tay kênh `ch` theo cánh tay đã giải `arm` với cổ tay `Wp` (three): đích thế giới có hướng khuỷu, góc cổ tay kẹp ở giới
 * hạn, ngón `fingers`; ghi vào `H`, trả tư thế mới
 */
function placeArm(
  P: PoseIn,
  H: ActHands,
  ch: "an" | "af",
  wk: "near" | "far",
  Wp: V3,
  pole: V3,
  [turn, bend, dev]: readonly number[],
  fingers: readonly number[],
): PoseIn {
  const a = P.lift?.[ch] ? [...P[ch]] : [0, 0, 0, 0, 0];
  a[2] = dev;
  H[wk] = { at: rigOf(Wp), elbow: rigDir(pole), w: 1 };
  return {
    ...P,
    [ch]: a,
    lift: { ...P.lift, [ch]: true },
    hand: { ...P.hand, [ch]: [turn, bend, ...fingers] },
  };
}

/** Báo chỗ cầm kèm độ lấn theo bán kính tay của cánh tay đã vẽ (luật `arm` của `check`) */
const withBody = (r: GraspReport, a: ArmSol): GraspReport => ({
  ...r,
  arm: {
    ...r.arm,
    bodyRatio: a.bodyRatio,
    ...(a.bodyPart && { bodyPart: a.bodyPart }),
    inward: a.inward,
  },
});

/**
 * Báo chỗ cầm của tay dẫn bên `side` (`mode: "hand"`): lựa chọn đã điền của khung cầm, nguồn `scene` / `default`, cánh
 * tay đọc trên tay đã vẽ `A` (khuỷu `φ`, góc cổ tay như vẽ, lấn thân và tay kia `B`)
 */
function handGrasp(
  T: Trunk3,
  side: number,
  g: HoldGrasp,
  fr: Pick<GraspFrame, "choice" | "base">,
  A: ReturnType<typeof arm3>,
  B?: ReturnType<typeof arm3>,
): GraspReport {
  const inp = armInput(T, side);
  const other = B && { S: B.sh, E: B.elbow, W: B.wr };
  const a = evalPhi(inp, A.wr, A.Rw, phiOf(inp, A.wr, A.elbow), undefined, other);
  const said = g.hold as Partial<Record<keyof GraspChoice, unknown>>;
  const by: GraspBy = {};
  const choice = fr.choice;
  for (const k of Object.keys(choice) as (keyof GraspChoice)[])
    if (k !== "featureIndex") by[k] = said[k] !== undefined ? "scene" : "default";
  const [turn, bend, dev] = [A.v[0] ?? 0, A.v[1] ?? 0, A.dev];
  return {
    item: g.hold.item,
    group: g.hold.group,
    mode: "hand",
    t0: g.t0,
    choice,
    ...(fr.base && { base: fr.base }),
    by,
    arm: {
      phi: a.phi,
      wrist: {
        turn,
        bend,
        dev,
        over: Math.max(
          Math.abs(turn) - TURN_MAX,
          overRange(bend, AIM_BEND),
          overRange(dev, AIM_DEV),
          0,
        ),
        off: 0,
      },
      body: a.body,
      bodyRatio: a.bodyRatio,
      ...(a.bodyPart && { bodyPart: a.bodyPart }),
      inward: a.inward,
      gap: a.gap,
    },
  };
}

const clampTo = (v: number, L: number) => Math.max(-L, Math.min(L, v));
/** Xoay, gập, lệch cổ tay của cánh tay đã giải, kẹp ở giới hạn như người 3D vẽ */
const wristOf = ({ wrist: w }: ArmSol): number[] => [
  clampTo(w.turn, TURN_MAX),
  clampRange(w.bend, AIM_BEND),
  clampRange(w.dev, AIM_DEV),
];

function solveCore(T: Trunk3, sp: ActInput): Solved {
  const report = { R: {}, L: {} } as Record<"R" | "L", AimReport>;
  const wrist: Partial<Record<"R" | "L", WristTbd>> = {};
  const trace: Partial<Record<"R" | "L", ArmTrace>> = {};
  if (!needsSolve(sp)) return { input: sp, report, wrist, trace };
  const P0 = sp.pose;
  const W0 = sp.world!;
  let P: PoseIn = { ...P0, reach: { ...P0.reach }, hand: { ...P0.hand }, aim: undefined };
  const hands: ActHands = { ...W0.hands };
  const { near, s } = T;
  const k = T.hand ? T.hand.k * s : 1;
  const long = T.hand ? T.hand.long * s : 1;
  const dims = handDims(k / s, long / s);
  const placed = placedHolds(T, W0.hands);
  const roles = holdRoles(placed.hands, near, dims);
  // món trong khung bàn tay (tay mang món) và tâm nắm của dáng chỗ cầm; người que không bàn tay nắm ở mút nét
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
      ({ G, center } = leadGrip(r.hold, side, k, long, s));
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
    const item = placed.sols[side];
    if (item) {
      // món đặt trước: cổ tay, khung bàn tay và khuỷu là nghiệm `graspAtTime`, không ý định, không đi từ mẫu trước;
      // cổ tay vượt giới hạn thì vẽ theo kẹp, ngoài tầm với thì tay duỗi về `Wp`
      const w = item.arm.wrist;
      const fingers = (role ?? { pose: actHand(P0, ch) }).pose.slice(2);
      P = placeArm(P, hands, ch, wk, item.Wp, item.arm.pole, wristOf(item.arm), fingers);
      const A = arm3(T, P, hands, side);
      const front = (R: M3) => rigDir(unit(mv(R, mv(item.frame.G.R, [0, 0, 1]))));
      const off = mm(tr(item.Rw), A.Rw);
      const clamped = (["turn", "bend", "dev"] as const).filter((x) => w.over[x] > 0);
      report[T.tag(side)] = {
        reach: { to: "at", point: "wrist", gap: (len(sub(A.wr, item.Wp)) * 100) / s },
        hold: {
          axis: [0, 0, 1],
          want: front(item.Rw),
          got: front(A.Rw),
          err: Math.acos(Math.max(-1, Math.min(1, (off[0] + off[4] + off[8] - 1) / 2))) / D,
          clamped,
          grasp: withBody(
            {
              ...graspReport(item, item.t0, "item"),
              ...(W0.hands?.[wk]?.hold?.grasp?.keyed && { keyed: true as const }),
            },
            item.arm,
          ),
        },
      };
      done[side] = state(A, side);
      const gripAt = extras[side]?.gripAt;
      trace[T.tag(side)] = { placed: item, ...(gripAt && { gripAt }) };
      continue;
    }
    let rw = W0.hands?.[wk];
    const lead = role?.role === "support" ? done[role.lead] : undefined;
    let entering = false;
    if (role?.role === "support" && lead?.G && lead.spec) {
      // tay phụ: đích là chỗ cầm của tay này trên món tay kia mang, lòng tay và ngón theo khung món
      let ax = gripAxes(role.hand);
      const h0 = supportFrom(role.hold, side, role.lead, dims);
      if (h0) {
        // đổi chỗ cầm: mốc của tay phụ trên món hoà từ chỗ cũ
        const a0 = gripAxes(h0);
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
      const fade = (ts: readonly ReachTerm[]) => ts.map((t) => ({ ...t, k: t.k * (1 - e) }));
      const grab = (ts: readonly ReachTerm[]) => [...fade(ts), { ...item, k: e }];
      const spline = entering ? rw?.spline : undefined;
      rw = {
        w: entering ? (was ? rw!.w + (1 - rw!.w) * e : e) : 1,
        at,
        ...(rw?.elbow && { elbow: rw.elbow }),
        terms: entering ? [...fade(was ?? []), { ...item, k: was ? e : 1 }] : [item],
        // đoạn `auto`: mỗi mốc của chuỗi hoà cùng phần với chỗ cầm, cổ tay vẫn đi theo `spline`
        ...(spline && {
          spline: {
            ...spline,
            keys: [
              spline.keys[0] && grab(spline.keys[0]),
              grab(spline.keys[1]),
              grab(spline.keys[2]),
              spline.keys[3] && grab(spline.keys[3]),
            ],
          },
        }),
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
    // đang cầm: ngón theo dáng của chỗ cầm, không theo hành động
    const fingersV = role ? role.pose.slice(2) : raw.slice(2);
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
    /** Cổ tay của đích thế giới `r`: đoạn `auto` giải cổ tay từng mốc rồi nội suy bậc ba */
    const worldWrist = (r: ReachIn, R: M3, v: readonly number[]): V3 => {
      const s = r.spline;
      if (!s) return hasTerms(r) ? wristFor(r.terms!, true, R, v) : fromRig(r.at as V3);
      const [a, b, c, d] = s.keys.map((k) => k && wristFor(k, true, R, v));
      return hermiteN(a, b!, c!, d, ...s.h, s.f) as V3;
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
      if (rangeMargin(sol.bend, AIM_BEND) >= -0.05) clamped.push("bend");
      // kênh giữ 2D không có lệch cổ tay: lệch bị giữ ở 0
      if (lifted ? rangeMargin(sol.dev, AIM_DEV) >= -0.05 : err > 1) clamped.push("dev");
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
    // khuỷu khoá (`elbowLock` của `world.hands`): phần ấy của khuỷu nằm đúng `elbow`, không dò, không `HOLD_SWIVEL_SLEW`
    const lock = drive === "world" ? Math.min(1, rw!.elbowLock ?? 0) : 0;
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
        const g = worldWrist(rw, R, v);
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
      if (wantsFingers && elbow0 && lock < 1) {
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
        /** Dò xoay khuỷu trong `[l, h]`: lưới `SWIVEL_STEP`, chia đôi quanh chỗ tốt nhất tới `SWIVEL_FINE`, rồi `refineMin` */
        const search = (l: number, h: number, edges: boolean) => {
          const seen = new Map<number, ReturnType<typeof tryAt>>();
          const at = (a: number) => {
            let c = seen.get(a);
            if (!c) seen.set(a, (c = tryAt(a)));
            return c;
          };
          let best = at(Math.max(l, Math.min(h, 0)));
          const take = (a: number) => {
            if (a < l || a > h) return;
            const c = at(a);
            if (c.cost < best.cost - 1e-9) best = c;
          };
          for (let a = -AIM_SWIVEL; a <= AIM_SWIVEL; a += SWIVEL_STEP) take(a);
          if (edges) [l, h].forEach(take);
          for (let step = SWIVEL_STEP / 2; step >= SWIVEL_FINE; step /= 2)
            [best.a - step, best.a + step].forEach(take);
          return refineMin(at, (c) => c.cost, best.a, SWIVEL_FINE, l, h).c;
        };
        let best = search(-AIM_SWIVEL, AIM_SWIVEL, false);
        // khuỷu mang món nhảy xa mẫu trước: dò lại trong tầm đi được
        if (best.a < lo - 1e-9 || best.a > hi + 1e-9) best = search(lo, hi, true);
        if (lock > 0) {
          swivel = best.a * (1 - lock);
          elbow = spin(elbow0, u, swivel * D);
        } else {
          elbow = best.el;
          swivel = best.a;
        }
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
    const lg = role?.role === "lead" ? role.hold.grasp : undefined;
    const fr = lg?.mode === "hand" && h.G ? holdHand(role!.hold, side, dims)?.frame : undefined;
    if (lg && fr) {
      const grasp = handGrasp(T, side, lg, fr, A, done[-side] && arm3(T, P, hands, -side));
      if (rep.hold) rep.hold = { ...rep.hold, grasp };
      else {
        // không ý định: trục là mặt trước của món, muốn và đạt theo bàn tay vẽ
        const front = rigDir(unit(mv(A.Rw, mv(h.G!.R, [0, 0, 1]))));
        rep.hold = { axis: [0, 0, 1], want: front, got: front, err: 0, clamped: [], grasp };
      }
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
      if (full === rw && rw.spline) gap = Math.min(gap, len(sub(h.at, worldWrist(rw, h.R, h.v))));
      else if (full.terms!.length > 1) {
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
    const gripAt = extras[side]?.gripAt;
    trace[T.tag(side)] = {
      ...(elbow0 && { elbow0 }),
      ...((aimB || aimW) && { aim: solved }),
      ...(gripAt && { gripAt }),
    };
    done[side] = h;
  }
  return {
    input: {
      pose: { ...P, aim: undefined },
      world: { ...W0, ...(W0.hands && { hands }) },
    },
    report,
    wrist,
    trace,
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

/** Bàn tay bên `side` (`-1` phải) người 3D vẽ ở `sp`: cổ tay, khung bàn tay, khuỷu (three) và dáng — cho `ReachHold.was` */
export function actHandAt(c: ActCharacter, sp: ActInput, side: number): WasHand | undefined {
  const T = trunk3(c, sp);
  if (!T) return undefined;
  const x = solveActing(T, sp).input;
  const A = arm3(T, x.pose, x.world?.hands, side);
  return { Wp: A.wr, Rw: A.Rw, arm: { elbow: A.elbow }, frame: { pose: A.v } };
}

/** Tay một bên người 3D vẽ ra (three) kèm cái bộ giải đã dùng cho nó: `actArm` */
export interface ActArm {
  inp: ArmInput;
  /** Vai, khuỷu, cổ tay, khung bàn tay như vẽ */
  S: V3;
  E: V3;
  W: V3;
  Rw: M3;
  /** Xoay, gập, lệch cổ tay như vẽ */
  wrist: [number, number, number];
  /** Tâm nắm như điểm `grip` của đích tay */
  grip: V3;
  /** Tay kia như vẽ */
  other: ArmSeg;
  report: AimReport;
  trace?: ArmTrace;
}

/**
 * Tay bên `side` (`-1` phải) người 3D vẽ ở `sp`, cùng lần giải với `actAim` / `actJoints`: khớp, góc cổ tay, tâm nắm,
 * báo của tay ấy và vết bộ giải (`ArmTrace`) — `handReport` của scene đọc
 */
export function actArm(c: ActCharacter, sp: ActInput, side: number): ActArm | undefined {
  const T = trunk3(c, sp);
  if (!T) return undefined;
  const r = solveActing(T, sp);
  const x = r.input;
  const A = arm3(T, x.pose, x.world?.hands, side);
  const B = arm3(T, x.pose, x.world?.hands, -side);
  const tag = T.tag(side);
  const trace = r.trace[tag];
  const h: HandState = {
    at: A.wr,
    R: A.Rw,
    k: T.hand ? T.hand.k * T.s : 1,
    long: T.hand ? T.hand.long * T.s : 1,
    v: A.v,
    side,
    ...(!T.hand && { stick: mul(A.grip, T.s) }),
    ...(trace?.gripAt && { gripAt: trace.gripAt }),
  };
  return {
    inp: armInput(T, side),
    S: A.sh,
    E: A.elbow,
    W: A.wr,
    Rw: A.Rw,
    wrist: [A.v[0] ?? 0, A.v[1] ?? 0, A.dev],
    grip: handAt(h, "grip"),
    other: { S: B.sh, E: B.elbow, W: B.wr },
    report: r.report[tag],
    ...(trace && { trace }),
  };
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
 * với chỗ cầm gắn món: tay phụ của món cầm hai tay không mang món. Chỉ người 3D có `world`. docs/03-scene.md#đồ-cầm-tay
 */
export function actHeld(c: ActCharacter, sp: ActInput): Partial<Record<"R" | "L", ActHeld>> {
  const p = pose3(c, sp);
  if (!p) return {};
  const T = p.T;
  const dims = T.hand ? handDims(T.hand.k, T.hand.long) : handDims(1 / T.s);
  const placed = placedHolds(T, sp.world?.hands);
  const roles = holdRoles(placed.hands, T.near, dims);
  const out: Partial<Record<"R" | "L", ActHeld>> = {};
  for (const side of [-1, 1]) {
    const r = roles[side];
    if (r?.role !== "lead") continue;
    const tag = T.tag(side);
    // món nằm ở mốc `rest` trong lúc bàn tay tới hay rời: món đứng ở mốc, không theo bàn tay
    const still = r.hold.grasp?.rest ? placed.sols[side]?.still : undefined;
    if (still) {
      const Q = still.R;
      const R3: M3 = [Q[0], Q[1], Q[2], -Q[3], -Q[4], -Q[5], -Q[6], -Q[7], -Q[8]];
      out[tag] = {
        item: r.hold.item,
        grip: r.hold.grip,
        at: [...still.P] as V3,
        R: R3,
        s: still.s,
      };
      continue;
    }
    const W = p.wrists?.[tag];
    const { at, R } = p.frames[tag];
    const k = W?.k ?? 1;
    const long = W?.long ?? 1;
    const lg = leadGrip(r.hold, side, k, long, T.s);
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
