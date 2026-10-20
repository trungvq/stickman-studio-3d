import {
  AIM_BEND,
  AIM_DEV,
  armFrame,
  BONES3,
  markShape,
  TURN_MAX,
  twoBone3,
  type Trunk3,
} from "./arm3";
import { D, RIG } from "./constants";
import { HOLD_SLEW_STEP } from "./heldItem";
import { SKULL3 } from "./humanHead";
import { REACH_ELBOW } from "./ik";
import {
  add3,
  cross3,
  dot3,
  matMul,
  matVec,
  rotX,
  rotZ,
  scale3,
  sub3,
  type M3,
  type V3,
} from "./lens";

/** Trọng số khuỷu thõng của `E(φ)`, docs/11-nhom-cam.md § Khuỷu tự nhiên */
export const W_DOWN = 0.3;
/** Trọng số lấn của tay vào thân, đầu, tay kia */
export const W_BODY = 10;
/** Trọng số liền với mẫu trước của lần cầm */
export const W_CONT = 2;
/** Dải `|xuống⊥|` (sin góc trục vai → cổ tay với phương đứng) mà gốc `φ` hoà từ `−tiến` sang hình chiếu hướng xuống */
export const PHI_DOWN = [0.1, 0.3] as const;
/** Phạt phần cổ tay vượt giới hạn */
const W_OVER = 10;
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
  /** Độ, `0` khuỷu thõng, dương ra ngoài phía tay ấy */
  phi: number;
  phi0: number;
  /** Khuỷu, cổ tay với tới (three), hướng khuỷu `pole` và khung cẳng tay `fore` */
  elbow: V3;
  reach: V3;
  pole: V3;
  fore: M3;
  /** Góc cổ tay của `Rw` trên cẳng tay (độ, như `wristTurn`), `over` phần vượt giới hạn */
  wrist: {
    turn: number;
    bend: number;
    dev: number;
    over: { turn: number; bend: number; dev: number };
  };
  /** Lấn lớn nhất vào thân, đầu, tay kia, px */
  body: number;
  /** Khe từ cổ tay với tới tới `Wp` khi ngoài tầm với, rig */
  gap: number;
  E: number;
  terms: { wrist: number; over: number; down: number; body: number; cont: number };
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

/** Khoảng (px) từ điểm `p` ra mặt thân, âm là trong thân; ngoài dọc thân thì `undefined` */
function torsoDist(inp: ArmInput, p: V3) {
  const l = scale3(matVec(tr(inp.Rs), sub3(p, inp.hips)), 100 / inp.s);
  const y = -l[1];
  if (y > 0 || y < -inp.torsoLen) return undefined;
  const [hw, hd] = inp.across(y);
  const hz = l[2] >= 0 ? inp.front(y) : hd;
  const rho = Math.hypot(l[0] / hw, l[2] / hz);
  return rho > 1e-6 ? ((rho - 1) * Math.hypot(l[0], l[2])) / rho : -Math.min(hw, hz);
}

const segDist = (p: V3, a: V3, b: V3) => {
  const ab = sub3(b, a);
  const t = Math.max(0, Math.min(1, dot3(sub3(p, a), ab) / (dot3(ab, ab) || 1)));
  return { d: len(sub3(p, add3(a, scale3(ab, t)))), t };
};

/** Lấn của tay vào thân, đầu, tay kia: lấn lớn nhất (px) và Σ (lấn / r_tay)² trên lấn lớn nhất mỗi cặp đoạn × vật */
function intrusion(inp: ArmInput, S0: V3, E: V3, W: V3, other?: ArmSeg) {
  const best = new Map<string, { d: number; q: number }>();
  const put = (k: string, d: number, r: number) => {
    if (d <= 0) return;
    const q = d / r;
    const b = best.get(k);
    if (!b || q > b.q) best.set(k, { d, q });
  };
  const RnT = tr(inp.Rn);
  for (const x of armSamples(inp, S0, E, W)) {
    const seg = x.fore ? "fore" : "upper";
    const dist = torsoDist(inp, x.p);
    if (dist !== undefined) put(`${seg}.torso`, x.r - dist - (x.fore ? 0 : inp.rest[x.i]), x.r);
    const lh = matVec(RnT, sub3(x.p, inp.head));
    const rq = len([lh[0] / inp.skull[0], lh[1] / inp.skull[1], lh[2] / inp.skull[2]]);
    const dh =
      rq > 1e-6
        ? (((rq - 1) * len(lh)) / rq) * (100 / inp.s)
        : (-Math.min(...inp.skull) * 100) / inp.s;
    put(`${seg}.head`, x.r - dh, x.r);
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
  for (const v of best.values()) {
    sum += v.q * v.q;
    max = Math.max(max, v.d);
  }
  return { sum, max };
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
    if (dist !== undefined) rest[x.i] = Math.max(0, x.r - dist);
  }
  return inp;
}

/**
 * Khung quanh trục vai → cổ tay: `d0` hình chiếu của hướng xuống, trục gần đứng (`|xuống⊥|` từ `PHI_DOWN[1]` về
 * `PHI_DOWN[0]`) hoà dần sang `−tiến`; `o0` ra ngoài phía tay ấy
 */
function phiBasis(inp: ArmInput, Wp: V3) {
  const n = unit(sub3(Wp, inp.S));
  const down: V3 = [0, -1, 0];
  const [lo, hi] = PHI_DOWN;
  const k = Math.max(0, Math.min(1, (len(perp(down, n)) - lo) / (hi - lo)));
  const back = matVec(inp.Rr, [0, 0, -1]);
  let d0 = perp(add3(scale3(down, k), scale3(back, 1 - k)), n);
  if (len(d0) < 1e-9) d0 = perp(matVec(inp.Rr, [inp.side, 0, 0]), n);
  d0 = unit(d0);
  return { d0, o0: unit(scale3(cross3(n, d0), inp.side)) };
}

/** `φ` (độ) của khuỷu `El` quanh trục vai → `Wp`, cùng gốc với `evalPhi` */
export function phiOf(inp: ArmInput, Wp: V3, El: V3): number {
  const B = phiBasis(inp, Wp);
  const e = sub3(El, inp.S);
  return Math.atan2(dot3(e, B.o0), dot3(e, B.d0)) / D;
}

/**
 * `E(φ)` của tay `inp` với cổ tay `Wp`, khung bàn tay `Rw` (three) ở góc khuỷu `phi` (độ): dựng hai đoạn tay, đọc góc
 * cổ tay. `elbow` là hướng khuỷu của mốc tay (thế giới rig), thiếu thì `REACH_ELBOW`
 */
export function evalPhi(
  inp: ArmInput,
  Wp: V3,
  Rw: M3,
  phi: number,
  phiPrev?: number,
  other?: ArmSeg,
  elbow?: readonly number[],
): ArmSol {
  const { side, S } = inp;
  const B = phiBasis(inp, Wp);
  const pole = add3(scale3(B.d0, Math.cos(phi * D)), scale3(B.o0, Math.sin(phi * D)));
  const [El, Wr, hinge] = twoBone3(S, Wp, inp.l1, inp.l2, pole);
  const f = armFrame(S, El, Wr, hinge);
  const fore = matMul(f.R, rotX(-f.b));
  const a = wristAngles(matMul(tr(fore), Rw), side);
  const lim = (v: number, L: number) => Math.max(0, Math.abs(v) - L);
  const over = {
    turn: lim(a.turn, TURN_MAX),
    bend: lim(a.bend, AIM_BEND),
    dev: lim(a.dev, AIM_DEV),
  };
  const wristE =
    0.5 * (a.turn / TURN_MAX) ** 2 + (a.bend / AIM_BEND) ** 2 + 0.5 * (a.dev / AIM_DEV) ** 2;
  const overE =
    W_OVER *
    ((over.turn / TURN_MAX) ** 2 + (over.bend / AIM_BEND) ** 2 + (over.dev / AIM_DEV) ** 2);
  const e = elbow ?? REACH_ELBOW;
  const p0: V3 = elbow ? [e[0], -e[1], -e[2]] : matVec(inp.Rr, [side * e[2], -e[1], e[0]]);
  const phi0 = Math.atan2(dot3(p0, B.o0), dot3(p0, B.d0)) / D;
  const down = (W_DOWN * (1 - Math.cos((phi - phi0) * D))) / 2;
  const body = intrusion(inp, S, El, Wr, other);
  const bodyE = W_BODY * body.sum;
  const cont = phiPrev === undefined ? 0 : W_CONT * (wrap(phi - phiPrev) / 30) ** 2;
  return {
    phi: wrap(phi),
    phi0,
    elbow: El,
    reach: Wr,
    pole,
    fore,
    wrist: { ...a, over },
    body: body.max,
    gap: Math.max(0, (len(sub3(Wp, S)) - (inp.l1 + inp.l2)) * 100),
    E: wristE + overE + down + bodyE + cont,
    terms: { wrist: wristE, over: overE, down, body: bodyE, cont },
    tries: 1,
  };
}

/** `φ` tốt nhất: lưới 10° cả vòng, rồi chia đôi `±5°`, `±2,5°` (40 lần thử); hoà thì lấy lần thử trước */
export function solvePhi(
  inp: ArmInput,
  Wp: V3,
  Rw: M3,
  phiPrev?: number,
  other?: ArmSeg,
  elbow?: readonly number[],
): ArmSol {
  let n = 0;
  const ev = (p: number) => (n++, evalPhi(inp, Wp, Rw, p, phiPrev, other, elbow));
  let best = ev(-180);
  const take = (c: ArmSol) => {
    if (c.E < best.E - 1e-12) best = c;
  };
  for (let p = -170; p < 180; p += 10) take(ev(p));
  for (const step of [5, 2.5]) {
    const c0 = best.phi;
    take(ev(c0 - step));
    take(ev(c0 + step));
  }
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
  elbow?: readonly number[];
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
