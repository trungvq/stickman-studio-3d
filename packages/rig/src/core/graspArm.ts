import {
  AIM_BEND,
  AIM_DEV,
  clampRange,
  overRange,
  rangeHalf,
  armFrame,
  BONES3,
  markShape,
  TURN_MAX,
  twoBone3,
  type Trunk3,
} from "./arm3";
import { D, RIG } from "./constants";
import { ARM_SOFT, prefPole, ringClamp, shoulderAngles } from "./elbow";
import { HOLD_SLEW_STEP } from "./heldItem";
import { SKULL3 } from "./humanHead";
import {
  add3,
  cross3,
  dot3,
  matMul,
  matVec,
  rotX,
  rotY,
  rotZ,
  scale3,
  sub3,
  type M3,
  type V3,
} from "./lens";

/**
 * Trọng số giữ khuỷu ở hướng ưu tiên của `E(φ)`: `((Δ / PREF_SPAN)² + ((|Δ| − PREF_FREE)⁺ / PREF_STIFF)²)` — mềm trong
 * `±PREF_FREE` (xoay trục cánh tay trên gánh hướng bàn tay), cứng dần ngoài đó. docs/11-nhom-cam.md § Khuỷu tự nhiên
 */
export const W_PREF = 1;
export const PREF_SPAN = 60;
export const PREF_FREE = 30;
export const PREF_STIFF = 25;
/** Thang xoay, gập, lệch cổ tay của giá thoải mái `½ (xoay/90)² + (gập/50)² + ½ (lệch/20)²`, độ — không phải kẹp */
const TURN_EASE = 90;
const BEND_EASE = 50;
const DEV_EASE = 20;
/** Trọng số xoay trục cánh tay trên `ψ` (`shoulderAngles`): miễn phí trong `PSI_REST ± PSI_FREE`, thang `PSI_EASE` */
export const W_TWIST = 0.5;
export const PSI_REST = 30;
export const PSI_FREE = 45;
const PSI_EASE = 40;
/** Trọng số vai: nâng quá 90°, lùi sau quá 20°, khép ngang quá 30° (RULA, AAOS) */
export const W_SHOULDER = 0.3;
/** Trọng số lấn của tay vào thân, đầu, tay kia */
export const W_BODY = 10;
/** Trọng số liền với mẫu trước của lần cầm */
export const W_CONT = 2;
/**
 * Trọng số khuỷu gập ngược: khuỷu lệch khỏi đường vai → cổ tay vào giữa thân hay lên trên quá `IN_FREE` (phần `l₁`) và
 * quá chính độ lệch ấy của khuỷu ưu tiên; chỉ khi cổ tay thấp hơn vai (bật dần từ `IN_FROM` tới `IN_FULL` phần tầm với)
 */
export const W_IN = 20;
/** `inward` từ đó `W_IN` bắt đầu phạt */
export const IN_FREE = 0;
const IN_FROM = -0.05;
const IN_FULL = 0.15;
/** Phạt phần cổ tay vượt giới hạn */
const W_OVER = 10;
/** Góc (độ, tính từ giữa tầm) mà giá cổ tay thôi tăng: tới điểm đối diện thì phẳng, như `ringClamp` về giữa tầm */
const RING_CAP = 150;
/**
 * Trần mềm của giá cổ tay (thoải mái cộng vượt) trong `E(φ)`: `WRIST_CAP · tanh(giá / WRIST_CAP)`. Bàn tay đòi xa quá thì
 * khuỷu thôi chạy theo, đứng ở chỗ ưu tiên và cổ tay kẹp — khuỷu đúng giải phẫu thắng món đúng hướng
 */
export const WRIST_CAP = 4;
/** Số mẫu dọc mỗi đoạn tay khi đo lấn */
const ARM_N = 12;

const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => scale3(a, 1 / (len(a) || 1));
const perp = (v: V3, n: V3): V3 => sub3(v, scale3(n, dot3(v, n)));
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** Một tay của người ở một tư thế thân, đủ cho `E(φ)`: three, trừ chỗ ghi px (rig, chưa nhân `world.s`) */
export interface ArmInput {
  /** `-1` tay phải */
  side: number;
  /** Vai, độ dài cánh tay trên, cẳng tay (three, đã nhân `world.s` và `stretch`) */
  S: V3;
  l1: number;
  l2: number;
  s: number;
  hips: V3;
  Rs: M3;
  Rr: M3;
  head: V3;
  Rn: M3;
  /** Bán trục sọ, three */
  skull: V3;
  /** Dài thân, px */
  torsoLen: number;
  across: (y: number) => readonly number[];
  front: (y: number) => number;
  /** Bán kính tay ở vai, khuỷu, cổ tay, px */
  r: readonly [number, number, number];
  /** Mẫu lấn bắt đầu từ chỗ này trên cánh tay trên, px */
  skip: number;
  /** Mức nền lấn của bắp tay buông thõng ở mẫu `i / ARM_N` dọc cánh tay trên, px */
  rest: readonly number[];
}

/** Hai đoạn của một cánh tay đã đặt: vai, khuỷu, cổ tay (three) */
export interface ArmSeg {
  S: V3;
  E: V3;
  W: V3;
}

/** Cánh tay đã giải ở một `φ` */
export interface ArmSol {
  /** Độ quanh trục vai → cổ tay, `0` khuỷu ưu tiên (`phiBasis`), dương quay ra ngoài phía tay ấy */
  phi: number;
  phi0: number;
  /** Khuỷu, cổ tay với tới (three), hướng khuỷu `pole` và khung cẳng tay `fore` */
  elbow: V3;
  reach: V3;
  pole: V3;
  fore: M3;
  /** Góc cổ tay của `Rw` trên cẳng tay chưa kẹp (độ, như `wristTurn`), `over` phần vượt giới hạn (`wristOver`) */
  wrist: {
    turn: number;
    bend: number;
    dev: number;
    over: { turn: number; bend: number; dev: number };
  };
  /** Lấn lớn nhất vào thân, đầu, tay kia, px; `bodyRatio` lấn lớn nhất chia bán kính tay ở chỗ ấy, `bodyPart` chỗ ấy */
  body: number;
  bodyRatio: number;
  bodyPart?: string;
  /** Khe từ cổ tay với tới tới `Wp` (ngoài tầm với, soft IK), rig */
  gap: number;
  /** Khuỷu lệch khỏi đường vai → cổ tay về phía giữa thân hay lên trên, phần `l₁` (dương là khuỷu gập ngược, `elbowInward`) */
  inward: number;
  /** Xoay trục cánh tay trên, độ (`shoulderAngles`) */
  psi: number;
  E: number;
  /** `E` với giá cổ tay không trần (`WRIST_CAP`): so các lựa chọn chỗ cầm (`chooseMissing`), không dùng chọn `φ` */
  Efull: number;
  terms: {
    wrist: number;
    over: number;
    pref: number;
    body: number;
    cont: number;
    inward: number;
    twist: number;
    shoulder: number;
  };
  /** Số lần thử `φ` */
  tries: number;
}

/** Tách `wristTurn` (`Ry(−side·turn)·Rz(−side·bend)·Rx(−dev)`) ra xoay, gập, lệch, độ */
export function wristAngles(M: M3, side: number) {
  const beta = Math.asin(Math.max(-1, Math.min(1, M[3])));
  const gamma = Math.atan2(-M[5], M[4]);
  const alpha = Math.atan2(-M[6], M[0]);
  return { turn: (-side * alpha) / D, bend: (-side * beta) / D, dev: -gamma / D };
}

/** Bán kính tay ở phần `t` dọc chi (0 vai, 1 khuỷu, 2 cổ tay), px */
const armR = (r: ArmInput["r"], t: number) =>
  t <= 1 ? r[0] + (r[1] - r[0]) * t : r[1] + (r[2] - r[1]) * (t - 1);

/** Mẫu dọc tay: điểm three, phần `t` của đoạn, `i` của mẫu cánh tay trên */
function armSamples(inp: ArmInput, S0: V3, E: V3, W: V3) {
  const out: { p: V3; r: number; fore: boolean; i: number }[] = [];
  const l1px = (len(sub3(E, S0)) * 100) / inp.s;
  for (let i = 0; i <= ARM_N; i++) {
    const t = i / ARM_N;
    if (t * l1px < inp.skip) continue;
    out.push({ p: add3(S0, scale3(sub3(E, S0), t)), r: armR(inp.r, t), fore: false, i });
  }
  for (let i = 1; i <= ARM_N; i++) {
    const t = i / ARM_N;
    out.push({ p: add3(E, scale3(sub3(W, E), t)), r: armR(inp.r, 1 + t), fore: true, i });
  }
  return out;
}

/** Hai đầu dọc thân (px) mà phần lấn thân nhạt dần về 0: lấn không bật tắt khi một mẫu tay ra khỏi dọc thân */
const TORSO_FADE = 8;

/**
 * Khoảng (px) từ điểm `p` ra mặt thân, âm là trong thân, và phần tính (`1` giữa thân, nhạt dần về `0` trong `TORSO_FADE`
 * ở hai đầu); ngoài dọc thân thì `undefined`
 */
function torsoDist(inp: ArmInput, p: V3) {
  const l = scale3(matVec(tr(inp.Rs), sub3(p, inp.hips)), 100 / inp.s);
  const y = -l[1];
  if (y > 0 || y < -inp.torsoLen) return undefined;
  const [hw, hd] = inp.across(y);
  const hz = l[2] >= 0 ? inp.front(y) : hd;
  const rho = Math.hypot(l[0] / hw, l[2] / hz);
  const d = rho > 1e-6 ? ((rho - 1) * Math.hypot(l[0], l[2])) / rho : -Math.min(hw, hz);
  return { d, k: Math.min(1, -y / TORSO_FADE, (y + inp.torsoLen) / TORSO_FADE) };
}

const segDist = (p: V3, a: V3, b: V3) => {
  const ab = sub3(b, a);
  const t = Math.max(0, Math.min(1, dot3(sub3(p, a), ab) / (dot3(ab, ab) || 1)));
  return { d: len(sub3(p, add3(a, scale3(ab, t)))), t };
};

/** Khoảng (px) từ điểm `p` (three) ra mặt thân (ngoài dọc thân thì `undefined`) và ra mặt sọ, âm là ở trong */
export function bodyGap(inp: ArmInput, p: V3): { torso?: number; head: number } {
  const t = torsoDist(inp, p);
  const lh = matVec(tr(inp.Rn), sub3(p, inp.head));
  const rq = len([lh[0] / inp.skull[0], lh[1] / inp.skull[1], lh[2] / inp.skull[2]]);
  const head =
    rq > 1e-6
      ? (((rq - 1) * len(lh)) / rq) * (100 / inp.s)
      : (-Math.min(...inp.skull) * 100) / inp.s;
  return { ...(t && { torso: t.d }), head };
}

/**
 * Lấn của tay vào thân, đầu, tay kia: lấn lớn nhất (px), Σ (lấn / r_tay)² trên lấn lớn nhất mỗi cặp đoạn × vật. `sum` (giá
 * của `E(φ)`) bỏ phần lấn mà chính cổ tay đã ở trong thân, đầu: cẳng tay được lấn tới mức ấy nhân phần dọc cẳng tay — khuỷu
 * không chạy theo thứ nó không cứu được; `max`, `q`, `part` vẫn là lấn đủ (báo)
 */
function intrusion(inp: ArmInput, S0: V3, E: V3, W: V3, other?: ArmSeg) {
  const best = new Map<string, { d: number; q: number }>();
  const excess = new Map<string, number>();
  const put = (k: string, d: number, r: number, free = 0) => {
    if (d <= 0) return;
    const q = d / r;
    const b = best.get(k);
    if (!b || q > b.q) best.set(k, { d, q });
    const x = (d - free) / r;
    if (x > (excess.get(k) ?? 0)) excess.set(k, x);
  };
  const RnT = tr(inp.Rn);
  const headDist = (p: V3) => {
    const lh = matVec(RnT, sub3(p, inp.head));
    const rq = len([lh[0] / inp.skull[0], lh[1] / inp.skull[1], lh[2] / inp.skull[2]]);
    return rq > 1e-6
      ? (((rq - 1) * len(lh)) / rq) * (100 / inp.s)
      : (-Math.min(...inp.skull) * 100) / inp.s;
  };
  const rW = armR(inp.r, 2);
  const tW = torsoDist(inp, W);
  const inTorso = tW ? Math.max(0, (rW - tW.d) * tW.k) : 0;
  const inHead = Math.max(0, rW - headDist(W));
  for (const x of armSamples(inp, S0, E, W)) {
    const seg = x.fore ? "fore" : "upper";
    const t = x.fore ? x.i / ARM_N : 0;
    const dist = torsoDist(inp, x.p);
    if (dist)
      put(`${seg}.torso`, (x.r - dist.d - (x.fore ? 0 : inp.rest[x.i])) * dist.k, x.r, inTorso * t);
    put(`${seg}.head`, x.r - headDist(x.p), x.r, inHead * t);
    if (other)
      for (const [a, b, t0] of [
        [other.S, other.E, 0],
        [other.E, other.W, 1],
      ] as const) {
        const sd = segDist(x.p, a, b);
        put(`${seg}.other`, x.r + armR(inp.r, t0 + sd.t) - (sd.d * 100) / inp.s, x.r);
      }
  }
  let sum = 0;
  let max = 0;
  let q = 0;
  let part: string | undefined;
  for (const [k, v] of best) {
    max = Math.max(max, v.d);
    if (v.q > q) [q, part] = [v.q, k];
  }
  for (const v of excess.values()) sum += v * v;
  return { sum, max, q, part };
}

/**
 * Đầu vào khuỷu tự nhiên cho tay bên `side` của thân `T`: vai, độ dài chi, hình thân `markShape`, và mức nền lấn của
 * tay buông thõng (góc 0, choãi `roots.splay`) ở tư thế thân này
 */
export function armInput(T: Trunk3, side: number, shape = markShape(T)): ArmInput {
  const st = T.P.stretch;
  const near = side === T.near;
  const s = T.s;
  const S = T.at(T.hips, T.Rs, [side * T.roots.shoulder[0], T.roots.shoulder[1], 0]);
  const room = T.roots.room;
  const r0 = BONES3.limb * 10 * T.w.sleeve;
  const inp: ArmInput = {
    side,
    S,
    l1: T.B.upperArm * (st[near ? 2 : 0] ?? 1) * s,
    l2: T.B.foreArm * (st[near ? 3 : 1] ?? 1) * s,
    s,
    hips: T.hips,
    Rs: T.Rs,
    Rr: T.Rr,
    head: T.out.head,
    Rn: T.Rn,
    skull: scale3(SKULL3, T.B.head * s),
    torsoLen: RIG.torso * shape.h,
    across: shape.across,
    front: shape.front,
    r: room ? [room.r[0], room.r[1], room.r[2]] : [r0, r0, r0],
    skip: (room ? room.cap : r0) * 1.5,
    rest: new Array<number>(ARM_N + 1).fill(0),
  };
  const down = matVec(matMul(T.Rs, rotZ(side * T.roots.splay)), [0, -1, 0]);
  const E = add3(S, scale3(down, inp.l1));
  const W = add3(E, scale3(down, inp.l2));
  const rest = inp.rest as number[];
  for (const x of armSamples(inp, S, E, W)) {
    if (x.fore) continue;
    const dist = torsoDist(inp, x.p);
    if (dist) rest[x.i] = Math.max(0, (x.r - dist.d) * dist.k);
  }
  return inp;
}

/**
 * Khung quanh trục vai → cổ tay: `d0` hướng khuỷu ưu tiên của cổ tay `Wp` (`prefPole`, hàm trơn của cổ tay), `o0` quay
 * từ nó theo chiều ra ngoài phía tay ấy. `φ = 0` là khuỷu ưu tiên
 */
export function phiBasis(inp: ArmInput, Wp: V3) {
  const n = unit(sub3(Wp, inp.S));
  let d0 = perp(prefPole(inp.Rr, inp.side, inp.S, Wp, inp.l1 + inp.l2), n);
  if (len(d0) < 1e-9) d0 = perp(matVec(inp.Rr, [inp.side, 0, 0]), n);
  d0 = unit(d0);
  return { d0, o0: unit(scale3(cross3(n, d0), inp.side)) };
}

/** Gập cổ tay (độ, trị tuyệt đối) mà từ đó `gimbalBlend` dồn dần lệch vào xoay, tới 90° thì dồn hết */
const GIMBAL_FROM = 70;

/**
 * Xoay, gập, lệch cổ tay tách từ một khung bàn tay (`wristAngles`, `aimWrist`) đi liền qua chỗ gập ±90°: ở đó chỉ
 * `xoay − dấu(gập) · lệch` có nghĩa, hai góc riêng lẻ nhảy 180°. Gập từ `GIMBAL_FROM` thì dồn dần lệch vào xoay theo đúng tổng
 * ấy, tới 90° lệch về 0 — hai phía chỗ suy biến gặp nhau. Trong tầm gập (`AIM_BEND`) không đổi gì
 */
export function gimbalBlend([t, b, d]: readonly number[]): [number, number, number] {
  const u = Math.max(0, Math.min(1, (Math.abs(b) - GIMBAL_FROM) / (90 - GIMBAL_FROM)));
  if (!(u > 0)) return [t, b, d];
  const k = u * u * (3 - 2 * u);
  return [t - Math.sign(b) * k * d, b, (1 - k) * d];
}

/** Nửa cung cuối (độ) trước điểm đối diện giữa tầm mà `wristClamp` đưa góc về dần giữa tầm */
export const WRIST_RAMP = 90;

/**
 * Xoay, gập, lệch cổ tay chưa kẹp (đã qua `gimbalBlend`) ra góc người 3D vẽ: kẹp liền trên vòng (`ringClamp`, cung cuối
 * `WRIST_RAMP`), không nhảy mép này sang mép kia
 */
export const wristClamp = ([t, b, d]: readonly number[]): [number, number, number] => [
  ringClamp(t, -TURN_MAX, TURN_MAX, WRIST_RAMP),
  clampRange(b, AIM_BEND),
  ringClamp(d, AIM_DEV[0], AIM_DEV[1], WRIST_RAMP),
];

/** Cổ tay vượt giới hạn bao nhiêu (độ), đo trên vòng như `wristClamp` */
export function wristOver(t: number, b: number, d: number) {
  const ring = (x: number, [lo, hi]: readonly [number, number]) =>
    Math.max(0, Math.abs(wrap(x - (lo + hi) / 2)) - (hi - lo) / 2);
  return {
    turn: ring(t, [-TURN_MAX, TURN_MAX]),
    bend: overRange(b, AIM_BEND),
    dev: ring(d, AIM_DEV),
  };
}

/** Giá bậc hai `((v − free)⁺ / ease)²` cộng phạt vượt `W_OVER · ((v − half)⁺ / half)²` của góc cách giữa tầm `v`, phẳng từ `RING_CAP` */
function ringEase(v: number, free: number, ease: number, half: number, k = 1) {
  const x = Math.min(v, RING_CAP);
  const a = Math.max(0, x - free);
  const b = Math.max(0, x - half);
  const out = { ease: k * (a / ease) ** 2, over: W_OVER * (b / half) ** 2 };
  if (v <= RING_CAP) return out;
  // trơn bậc một tới điểm đối diện: đạo hàm về 0 ở 180
  const u = Math.min(180, v) - RING_CAP;
  const g = u - (u * u) / (2 * (180 - RING_CAP));
  return {
    ease: out.ease + ((2 * k * a) / (ease * ease)) * g,
    over: out.over + ((2 * W_OVER * b) / (half * half)) * g,
  };
}

/** Giá thoải mái của xoay, gập, lệch cổ tay chưa kẹp (`wristAngles`), tách phần vượt giới hạn */
export function wristEase(t: number, b: number, d: number) {
  const T = ringEase(Math.abs(wrap(t)), 0, TURN_EASE, TURN_MAX, 0.5);
  const devC = (AIM_DEV[0] + AIM_DEV[1]) / 2;
  const De = ringEase(Math.abs(wrap(d)), 0, DEV_EASE, Infinity, 0.5);
  const Do = ringEase(Math.abs(wrap(d - devC)), Infinity, 1, (AIM_DEV[1] - AIM_DEV[0]) / 2);
  const bendE = (b / BEND_EASE) ** 2;
  const bendO = W_OVER * (overRange(b, AIM_BEND) / rangeHalf(b, AIM_BEND)) ** 2;
  return { ease: T.ease + De.ease + bendE, over: T.over + Do.over + bendO };
}

/**
 * Khuỷu `El` lệch khỏi đường vai → cổ tay `Wp` (phần vuông góc đường ấy) về phía giữa thân (ngược `Rr·[side, 0, 0]`) hay
 * lên trên, phần `l₁` — lấy phía lệch nhiều hơn. Phía giữa thân nhân sin góc trục với phương đứng (tay buông thõng, cẳng
 * tay ra ngoài là góc tự nhiên) rồi trừ phần khuỷu nằm dưới đường ấy (khuỷu thấp trước ngực khi áp tai, xem điện thoại).
 * Dương là khuỷu gập ngược (nằm phía trong hay chĩa lên, cẳng tay chạy ra ngoài hay xuống tới bàn tay); khuỷu thõng, ra
 * ngoài là âm
 */
export function elbowInward(
  inp: Pick<ArmInput, "S" | "side" | "Rr" | "l1">,
  Wp: V3,
  El: V3,
): number {
  const n = unit(sub3(Wp, inp.S));
  const e = perp(sub3(El, inp.S), n);
  const medial = matVec(inp.Rr, [-inp.side, 0, 0]);
  const tilt = Math.hypot(n[0], n[2]);
  return Math.max(dot3(e, medial) * tilt + Math.min(0, e[1]), e[1]) / inp.l1;
}

/** `φ` (độ) của khuỷu `El` quanh trục vai → `Wp`, cùng gốc với `evalPhi` */
export function phiOf(inp: ArmInput, Wp: V3, El: V3): number {
  const B = phiBasis(inp, Wp);
  const e = sub3(El, inp.S);
  return Math.atan2(dot3(e, B.o0), dot3(e, B.d0)) / D;
}

/**
 * Hướng khuỷu của mốc tay: `body` là hệ thân `[tiến, y, ra ngoài]` của chính tay ấy (như `REACH_ELBOW`), quay theo hông
 * `Rr` lúc dùng; không `body` là thế giới rig. docs/03-scene.md#đích-bàn-tay-thế-giới
 */
export interface ElbowDir {
  v: readonly number[];
  body?: boolean;
}

/** `ElbowDir` ra thế giới rig trên hông `Rr` (three) của tay `side` (`-1` tay phải) */
export function elbowRig(Rr: M3, side: number, e: ElbowDir): V3 {
  if (!e.body) return [e.v[0], e.v[1], e.v[2]];
  const [f, y, o] = e.v;
  const v = matVec(Rr, [side * o, -y, f]);
  return [v[0], -v[1], -v[2]];
}

/** Hướng thế giới rig `d` ra hệ thân `[tiến, y, ra ngoài]` của tay `side` trên hông `Rr` (three): nghịch của `elbowRig` */
export function rigElbowBody(Rr: M3, side: number, d: readonly number[]): V3 {
  const v = matVec(tr(Rr), [d[0], -d[1], -d[2]]);
  return [v[2], -v[1], side * v[0]];
}

/** Hông `Rr` (three) của người 3D quay `yaw` (radian, như `World.yaw`): khung của `ActFrame` */
export const yawFrame = (yaw: number): M3 => rotY(Math.PI / 2 - yaw);

/** `φ` (độ) của hướng khuỷu `elbow` chiếu lên vòng quanh trục vai → `Wp`: `φ₀` của `evalPhi` */
export function phiToward(inp: ArmInput, Wp: V3, elbow: ElbowDir): number {
  const B = phiBasis(inp, Wp);
  const e = elbowRig(inp.Rr, inp.side, elbow);
  const p0: V3 = [e[0], -e[1], -e[2]];
  return Math.atan2(dot3(p0, B.o0), dot3(p0, B.d0)) / D;
}

/**
 * Bàn tay theo ý định ở một cánh tay thử: từ khung cẳng tay `fore`, khuỷu, cổ tay (three) ra xoay, gập, lệch cổ tay chưa
 * kẹp, kèm giá riêng của ý định (`cost`) nếu có
 */
export type HandAim = (
  fore: M3,
  El: V3,
  Wr: V3,
) => { turn: number; bend: number; dev: number; cost?: number };

/**
 * `E(φ)` của tay `inp` với cổ tay `Wp` ở góc khuỷu `phi` (độ, quanh trục vai → cổ tay, `0` là khuỷu ưu tiên): dựng hai
 * đoạn tay (soft IK `ARM_SOFT`), đọc góc cổ tay của khung bàn tay `Rw` (three) trên cẳng tay — hay hỏi `HandAim`. `elbow`
 * là hướng khuỷu của mốc tay, đè hướng ưu tiên. docs/11-nhom-cam.md § Khuỷu tự nhiên
 */
export function evalPhi(
  inp: ArmInput,
  Wp: V3,
  Rw: M3 | HandAim,
  phi: number,
  phiPrev?: number,
  other?: ArmSeg,
  elbow?: ElbowDir,
): ArmSol {
  const { side, S } = inp;
  const B = phiBasis(inp, Wp);
  const soft = ARM_SOFT * (inp.l1 + inp.l2);
  const poleAt = (p: number) => add3(scale3(B.d0, Math.cos(p * D)), scale3(B.o0, Math.sin(p * D)));
  const pole = poleAt(phi);
  const [El, Wr, hinge] = twoBone3(S, Wp, inp.l1, inp.l2, pole, soft);
  const f = armFrame(S, El, Wr, hinge);
  const fore = matMul(f.R, rotX(-f.b));
  const h = typeof Rw === "function" ? Rw(fore, El, Wr) : undefined;
  const a0 = h ?? wristAngles(matMul(tr(fore), Rw as M3), side);
  const [gt, gb, gd] = gimbalBlend([a0.turn, a0.bend, a0.dev]);
  const a = { turn: gt, bend: gb, dev: gd };
  const over = wristOver(a.turn, a.bend, a.dev);
  const ease = wristEase(a.turn, a.bend, a.dev);
  // trần mềm chia lại theo phần của hai số hạng
  const raw = ease.ease + ease.over;
  const capped = raw > 1e-12 ? WRIST_CAP * Math.tanh(raw / WRIST_CAP) : 0;
  const wristE = (raw > 1e-12 ? (ease.ease * capped) / raw : 0) + (h?.cost ?? 0);
  const overE = raw > 1e-12 ? (ease.over * capped) / raw : 0;
  let phi0 = 0;
  if (elbow) {
    const e = elbowRig(inp.Rr, side, elbow);
    const p0: V3 = [e[0], -e[1], -e[2]];
    phi0 = Math.atan2(dot3(p0, B.o0), dot3(p0, B.d0)) / D;
  }
  const dp = Math.abs(wrap(phi - phi0));
  const prefE = W_PREF * ((dp / PREF_SPAN) ** 2 + (Math.max(0, dp - PREF_FREE) / PREF_STIFF) ** 2);
  const body = intrusion(inp, S, El, Wr, other);
  const bodyE = W_BODY * body.sum;
  const cont = phiPrev === undefined ? 0 : W_CONT * (wrap(phi - phiPrev) / 30) ** 2;
  const inward = elbowInward(inp, Wp, El);
  // khuỷu gập ngược chỉ phạt khi cổ tay thấp hơn vai, và chỉ phần vượt độ lệch của chính khuỷu ưu tiên
  const below = -dot3(sub3(Wp, S), matVec(inp.Rr, [0, 1, 0])) / (inp.l1 + inp.l2);
  const gate = Math.max(0, Math.min(1, (below - IN_FROM) / (IN_FULL - IN_FROM)));
  let inE = 0;
  if (gate > 0 && inward > IN_FREE) {
    const [E0] = twoBone3(S, Wp, inp.l1, inp.l2, poleAt(phi0), soft);
    const free = Math.max(IN_FREE, elbowInward(inp, Wp, E0));
    inE = gate * W_IN * Math.max(0, inward - free) ** 2;
  }
  const sh = shoulderAngles(inp.Rr, side, S, El, hinge);
  const twistE =
    W_TWIST * (Math.max(0, Math.abs(wrap(sh.psi - PSI_REST)) - PSI_FREE) / PSI_EASE) ** 2;
  const shoulderE =
    W_SHOULDER *
    ((Math.max(0, sh.raise - 90) / 45) ** 2 +
      (Math.max(0, sh.back - 20) / 30) ** 2 +
      (Math.max(0, sh.across - 30) / 40) ** 2);
  return {
    phi: wrap(phi),
    phi0,
    elbow: El,
    reach: Wr,
    pole,
    fore,
    wrist: { turn: a.turn, bend: a.bend, dev: a.dev, over },
    body: body.max,
    bodyRatio: body.q,
    ...(body.part && { bodyPart: body.part }),
    gap: len(sub3(Wp, Wr)) * 100,
    inward,
    psi: sh.psi,
    E: wristE + overE + prefE + bodyE + cont + inE + twistE + shoulderE,
    Efull: raw + (h?.cost ?? 0) + prefE + bodyE + cont + inE + twistE + shoulderE,
    terms: {
      wrist: wristE,
      over: overE,
      pref: prefE,
      body: bodyE,
      cont,
      inward: inE,
      twist: twistE,
      shoulder: shoulderE,
    },
    tries: 1,
  };
}

/**
 * Đỉnh parabol qua `(x0, y0)`, `(x1, y1)`, `(x2, y2)` (`x0 < x1 < x2`) khi `y1` thấp nhất trong ba và parabol lồi: chỗ `x`
 * trong `[x0, x2]` và giá parabol đoán ở đó `y`; ba điểm phẳng hay không kẹp cực tiểu thì `undefined`
 */
export function parabolaMin(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number } | undefined {
  if (!(x0 < x1 && x1 < x2) || y1 > y0 || y1 > y2) return undefined;
  const d0 = (y1 - y0) / (x1 - x0);
  const c = ((y2 - y1) / (x2 - x1) - d0) / (x2 - x0);
  if (!(c > 0)) return undefined;
  const x = Math.max(x0, Math.min(x2, (x0 + x1) / 2 - d0 / (2 * c)));
  return { x, y: y0 + d0 * (x - x0) + c * (x - x0) * (x - x1) };
}

/** Nấc nhỏ nhất (độ) của bước chia đôi trong `refineMin`: giá gãy khúc thì góc lệch chỗ gãy dưới hai lần ngần này */
export const REFINE_TOL = 1 / 8;
/** Giá thật ở đỉnh parabol lệch giá parabol đoán dưới phần này của mức đoán bớt được thì tin đỉnh, không chia đôi tiếp */
const PARABOLA_TRUST = 0.25;

/**
 * Cực tiểu liên tục của `cost(f(x))` quanh `x` (chỗ tốt nhất của một lần dò lưới, nấc cuối `step`) trong `[l, h]`: đi tiếp
 * từng nấc `step` tới khi hai lân cận không thấp hơn (lân cận ngoài tầm thì lấy mép tầm), rồi đỉnh parabol qua ba điểm
 * ấy. Giá trơn thì đỉnh là xong; giá gãy khúc (giá thật ở đỉnh lệch mức parabol đoán quá `PARABOLA_TRUST`), cực tiểu
 * ở mép hay ba điểm phẳng thì chia đôi tiếp từ `step / 2` tới `REFINE_TOL`. Đích trôi chậm thì góc trôi theo chứ không nhảy từng
 * nấc lưới. `f` nên nhớ kết quả: lân cận thường đã thử ở lượt dò
 */
export function refineMin<T>(
  f: (x: number) => T,
  cost: (c: T) => number,
  x: number,
  step: number,
  l = -Infinity,
  h = Infinity,
): { x: number; c: T } {
  let best = { x, c: f(x) };
  const take = (y: number) => {
    if (y < l || y > h) return;
    const c = f(y);
    if (cost(c) < cost(best.c) - 1e-9) best = { x: y, c };
  };
  let was: typeof best | undefined;
  for (let k = 0; k < 4 && was !== best; k++) {
    was = best;
    take(best.x - step);
    take(best.x + step);
  }
  const x0 = Math.max(l, best.x - step);
  const x2 = Math.min(h, best.x + step);
  const y1 = cost(best.c);
  const v = parabolaMin(x0, cost(f(x0)), best.x, y1, x2, cost(f(x2)));
  if (v && v.x !== best.x) {
    const c = f(v.x);
    if (cost(c) <= y1) best = { x: v.x, c };
    if (Math.abs(cost(c) - v.y) <= PARABOLA_TRUST * (y1 - v.y)) return best;
  }
  for (let s = step / 2; s >= REFINE_TOL; s /= 2) {
    const at = best;
    take(best.x - s);
    if (best === at) take(best.x + s);
  }
  return best;
}

/** Nửa tầm (quanh điểm xuất phát) và nấc lưới cố định của `settlePhi`, độ */
export const SETTLE_HALF = 90;
const SETTLE_GRID = 10;
/** Nhiệt độ của trung bình Gibbs trong `settlePhi`: hai thung lũng chênh nhau dưới chừng `2 · SETTLE_T` thì khuỷu hoà giữa hai */
export const SETTLE_T = 0.3;

/**
 * `φ` ít tốn nhất quanh `start` trong `[lo, hi]` (cắt ở `±SETTLE_HALF`), lấy liền: giá ở các nút `SETTLE_GRID` cố định (bội
 * của nấc, không theo `start`) nội suy Catmull-Rom, rồi trung bình vòng có trọng số `exp(−(E − E_min) / SETTLE_T)` lấy
 * tích phân hình thang trên cửa sổ (nút từng độ cộng hai mép). Kết quả liền theo cả cổ tay lẫn `start` và hai mép: một thung
 * lũng thì ra đúng đáy; hai thung lũng gần bằng nhau thì khuỷu đi dần từ đáy này sang đáy kia, không nhảy như cực tiểu toàn
 * cục. Trả cả lần thử ở `φ` ấy. docs/11-nhom-cam.md § Khuỷu tự nhiên
 */
export function settlePhi<T>(
  f: (phi: number) => T,
  cost: (c: T) => number,
  start: number,
  lo = -Infinity,
  hi = Infinity,
): { x: number; c: T } {
  const a = Math.max(lo, start - SETTLE_HALF);
  const b = Math.min(hi, start + SETTLE_HALF);
  if (!(b - a > 1e-6)) return { x: a, c: f(a) };
  const k0 = Math.floor(a / SETTLE_GRID) - 1;
  const k1 = Math.floor(b / SETTLE_GRID) + 2;
  const E = Array.from({ length: k1 - k0 + 1 }, (_, i) => cost(f((k0 + i) * SETTLE_GRID)));
  const spline = (x: number) => {
    const g = x / SETTLE_GRID;
    const i = Math.min(k1 - 2, Math.floor(g)) - k0;
    const u = g - (i + k0);
    const [p0, p1, p2, p3] = [E[i - 1], E[i], E[i + 1], E[i + 2]];
    return (
      0.5 *
      (2 * p1 +
        (-p0 + p2) * u +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
        (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)
    );
  };
  const xs = [a];
  for (let x = Math.floor(a) + 1; x < b; x++) if (x > a) xs.push(x);
  xs.push(b);
  const es = xs.map(spline);
  const low = Math.min(...es);
  let c = 0;
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    // trọng số hình thang: nút vào cửa sổ ở mép với đoạn dài 0, nên tổng liền theo `a`, `b`
    const dx = ((i > 0 ? xs[i] - xs[i - 1] : 0) + (i < xs.length - 1 ? xs[i + 1] - xs[i] : 0)) / 2;
    const w = dx * Math.exp(-(es[i] - low) / SETTLE_T);
    c += w * Math.cos((xs[i] - start) * D);
    s += w * Math.sin((xs[i] - start) * D);
  }
  const x = Math.max(a, Math.min(b, start + Math.atan2(s, c) / D));
  return { x, c: f(x) };
}

/**
 * `φ` của khuỷu: `E(φ)` ít tốn nhất lấy liền (`settlePhi`) quanh `phiPrev` (mẫu trước của lần cầm) hay quanh hướng khuỷu
 * của mốc tay (`elbow`, không có là khuỷu ưu tiên `0`)
 */
export function solvePhi(
  inp: ArmInput,
  Wp: V3,
  Rw: M3 | HandAim,
  phiPrev?: number,
  other?: ArmSeg,
  elbow?: ElbowDir,
): ArmSol {
  let n = 0;
  const seen = new Map<number, ArmSol>();
  const ev = (p: number) => {
    const k = Math.round(p * 1e9);
    let c = seen.get(k);
    if (!c) seen.set(k, (c = (n++, evalPhi(inp, Wp, Rw, p, phiPrev, other, elbow))));
    return c;
  };
  const start = phiPrev ?? (elbow ? phiToward(inp, Wp, elbow) : 0);
  const best = settlePhi(ev, (c) => c.E, start).c;
  return { ...best, tries: n };
}

/** Hai đoạn của tay đã giải, cho số hạng lấn của tay giải sau */
export const armSeg = (inp: ArmInput, sol: ArmSol): ArmSeg => ({
  S: inp.S,
  E: sol.elbow,
  W: sol.reach,
});

/** Một mẫu của lần cầm: tay ở tư thế thân lúc ấy, cổ tay, khung bàn tay, tay đã đặt, hướng khuỷu của mốc tay */
export interface ArmQuery {
  inp: ArmInput;
  Wp: V3;
  Rw: M3;
  other?: ArmSeg;
  elbow?: ElbowDir;
}

/**
 * Chuỗi `φ` của một lần cầm `t0..t1`: mẫu cách `HOLD_SLEW_STEP` tính từ `t0`, mẫu cuối không trước `t1`; mỗi mẫu lấy
 * `φ_trước` là mẫu liền trước, mẫu đầu lấy `phiPrev` (mẫu cuối của lần cầm trước trên cùng tay)
 */
export function phiChain(
  t0: number,
  t1: number,
  at: (t: number) => ArmQuery,
  phiPrev?: number,
): { t: number; sol: ArmSol }[] {
  const n = Math.max(0, Math.ceil((t1 - t0) / HOLD_SLEW_STEP - 1e-9));
  const out: { t: number; sol: ArmSol }[] = [];
  let prev = phiPrev;
  for (let i = 0; i <= n; i++) {
    const t = t0 + i * HOLD_SLEW_STEP;
    const q = at(t);
    const sol = solvePhi(q.inp, q.Wp, q.Rw, prev, q.other, q.elbow);
    out.push({ t, sol });
    prev = sol.phi;
  }
  return out;
}

/** `φ(t)` hoà giữa hai mẫu kề của chuỗi, theo đường ngắn nhất; ngoài chuỗi thì mẫu đầu, mẫu cuối */
export function phiAt(chain: readonly { t: number; sol: ArmSol }[], t: number): number {
  if (!chain.length) return 0;
  if (t <= chain[0].t) return chain[0].sol.phi;
  const i = Math.min(chain.length - 1, Math.floor((t - chain[0].t) / HOLD_SLEW_STEP));
  const a = chain[i];
  const b = chain[i + 1];
  if (!b) return a.sol.phi;
  const k = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  return wrap(a.sol.phi + wrap(b.sol.phi - a.sol.phi) * k);
}
