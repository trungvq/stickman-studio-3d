import { D } from "./constants";
import { BODY3, dirOf, legs3World, type Body3 } from "./figure3d";
import { feet } from "./geometry";
import { segSegDistance } from "./heldAudit";
import type { V3 } from "./lens";
import {
  sceneAt,
  STEER_AHEAD,
  TRACK_ALONG,
  TURN_WALK,
  walkerTable,
  type SceneRuntime,
  type WalkerTable,
} from "./scene";
import { nextBearing, standing } from "./travel";

/** Nhãn một mẫu của `gaitTrace`, ưu tiên theo thứ tự này khi chồng nhau. docs/14-di-muot.md#31-lấy-mẫu-và-nhãn */
export const GAIT_LABELS = ["sit", "launch", "stop", "turn", "cruise", "still"] as const;
export type GaitLabel = (typeof GAIT_LABELS)[number];

export interface GaitSample {
  t: number;
  hip: V3;
  /** Yaw thân thật và yaw thân nhắm tới, độ, liền */
  yaw: number;
  yaw0: number;
  /** Nhịp cuối của đồng hồ chân (sau sải và phần bù) */
  rate: number;
  /** Pha không cuộn và phần sải của clip đi */
  phase?: number;
  stride: number;
  /** Bàn chân chịu lực theo bên giải phẫu: `0` phải, `1` trái */
  bearing: number[];
  /** Cổ chân, gối `[phải, trái]` */
  feet: [V3, V3];
  knees: [V3, V3];
  /** Điểm `path`; tiếp tuyến sàn và tốc độ `path` là sai phân lùi một bước, cùng khoảng với `Δ hip` của M1 */
  P: [number, number];
  T: [number, number];
  vRef: number;
  /** Clip chủ `track:clip` */
  clip?: string;
  leg: number;
  label: GaitLabel;
  /** Chỉ số lượt: mẫu liền cùng nhãn, cùng clip chủ; `cruise` còn tách ở mốc giữa đường khi hai đoạn khác tốc */
  run: number;
  /** Mẫu đo trượt chân trụ: `launch` của quay rồi đi chỉ từ mốc cuối cú quay */
  slip: boolean;
}

/** Góc mềm (một mốc giữa đường rẽ) hay cung (chuỗi mốc rẽ cùng chiều): giây, góc rẽ tổng, cửa sổ của mục 4 */
export interface GaitBend {
  kind: "corner" | "arc";
  t: number;
  t1: number;
  theta: number;
  from: number;
  to: number;
}

export interface GaitTrace {
  id: string;
  /** Khoảng đo yêu cầu; mẫu ngoài nó (`0,1 s` mỗi bên) chỉ làm sai phân */
  from: number;
  to: number;
  height: number;
  s: number;
  step: number;
  /** Bề dày nửa cẳng chân của người (`Body3.legHalf`) */
  legHalf: number;
  /** Sải mỗi chu kỳ của clip đi (đơn vị rig, `height` 1) theo `track:clip` */
  strides: Record<string, number>;
  bends: GaitBend[];
  /** Mốc `path`: giây, điểm sàn */
  path: { t: number; at: [number, number] }[];
  samples: GaitSample[];
}

const SPLIT_SPEED = 0.01;

const xzOf = (k: { at: readonly number[] }): [number, number] => [k.at[0], k.at[2]];
const same = (p: [number, number], q: [number, number]) => p[0] === q[0] && p[1] === q[1];
const heading = (dx: number, dz: number) => Math.atan2(-dz, dx) / D;
const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const inside = (spans: [number, number][], t: number) =>
  spans.some(([a, b]) => t >= a - 1e-9 && t <= b + 1e-9);

/** Tốc độ `path` của đoạn `i → i + 1` (đơn vị thế giới mỗi giây), không kể `ease` */
function legSpeed(w: WalkerTable, i: number): number {
  const [a, b] = [w.keys[i], w.keys[i + 1]];
  if (!b) return 0;
  return Math.hypot(b.at[0] - a.at[0], b.at[2] - a.at[2]) / (b.t - a.t);
}

/** Mốc giữa đường rẽ khi đang đi: góc mềm, chuỗi mốc rẽ cùng chiều mỗi mốc tới `45°` là cung */
function bendsOf(w: WalkerTable): GaitBend[] {
  const k = w.keys;
  const turns: { i: number; theta: number }[] = [];
  for (let i = 1; i + 1 < k.length; i++) {
    const [a, b, c] = [xzOf(k[i - 1]), xzOf(k[i]), xzOf(k[i + 1])];
    if (k[i - 1].sit || k[i].sit || k[i + 1].sit || same(a, b) || same(b, c)) continue;
    const theta = wrap180(heading(c[0] - b[0], c[1] - b[1]) - heading(b[0] - a[0], b[1] - a[1]));
    if (Math.abs(theta) > 0.5) turns.push({ i, theta });
  }
  const out: GaitBend[] = [];
  for (let n = 0; n < turns.length;) {
    let e = n;
    const arcy = (p: { theta: number }) => Math.abs(p.theta) <= 45;
    while (
      e + 1 < turns.length &&
      turns[e + 1].i === turns[e].i + 1 &&
      Math.sign(turns[e + 1].theta) === Math.sign(turns[n].theta) &&
      arcy(turns[e + 1]) &&
      arcy(turns[n])
    )
      e++;
    if (e > n) {
      const [ta, tb] = [k[turns[n].i].t, k[turns[e].i].t];
      const theta = turns.slice(n, e + 1).reduce((s, p) => s + p.theta, 0);
      out.push({ kind: "arc", t: ta, t1: tb, theta, from: ta - 0.6, to: tb + 0.6 });
    } else {
      const { i, theta } = turns[n];
      const t = k[i].t;
      out.push({
        kind: "corner",
        t,
        t1: t,
        theta,
        from: t - STEER_AHEAD - 0.25,
        to: t + Math.abs(theta) / TURN_WALK + TRACK_ALONG,
      });
    }
    n = e + 1;
  }
  return out;
}

/**
 * Mẫu đi của người `id` mỗi bước của bảng `Walker` trên `[from; to]` cộng `0,1 s` hai bên: hông, yaw, nhịp chân, pha,
 * sải, bàn chân chịu lực, `path`, clip chủ, đoạn và nhãn. Số đọc từ chính bảng `Walker` và `sceneAt`. Người không đi
 * `path` thì `undefined`. docs/14-di-muot.md#31-lấy-mẫu-và-nhãn
 */
export function gaitTrace(
  rt: SceneRuntime,
  id: string,
  height = rt.heights[id] ?? 1,
  body: Body3 = rt.bodies[id] ?? BODY3,
  from = 0,
  to = rt.duration,
): GaitTrace | undefined {
  const w = walkerTable(rt, id, height, body);
  if (!w) return;
  const m = rt.cast.find((c) => c.id === id)!;
  const s = m.world?.s ?? 1;
  const keys = w.keys;
  const n = w.x.length - 1;
  const launch: [number, number][] = w.joins.map((j) => [j.from, j.at + 0.5]);
  const slipFrom = new Map(w.joins.map((j) => [j.from, j.at]));
  for (let i = 1; i + 1 < keys.length; i++) {
    const [p, a, b] = [xzOf(keys[i - 1]), xzOf(keys[i]), xzOf(keys[i + 1])];
    if (keys[i].sit || keys[i + 1].sit || !same(p, a) || same(a, b)) continue;
    if (w.joins.some((j) => Math.abs(j.at - keys[i].t) < 1e-9)) continue;
    launch.push([keys[i].t, keys[i].t + 0.5]);
  }
  const stops: [number, number][] = w.stops.map((x) => [x.from, x.done]);
  const turns: [number, number][] = [];
  for (let i = 0; i + 1 < keys.length; i++) if (w.turnAt(i)) turns.push([keys[i].t, keys[i + 1].t]);
  const strides: Record<string, number> = {};
  const samples: GaitSample[] = [];
  let bearing: number[] = [];
  let prevFwd: number[] = [];
  let run = -1;
  const k0 = Math.max(0, Math.ceil((from - 0.1) / w.step - 1e-9));
  const k1 = Math.min(n, Math.floor((to + 0.1) / w.step + 1e-9));
  for (let k = k0; k <= k1; k++) {
    const t = k * w.step;
    const sp = sceneAt(rt, id, t, height, body);
    const wd = sp.world;
    const [left, right] = legs3World(sp.pose, wd, height, body.hipHalf);
    const legs = [right, left];
    const ft = feet(sp.pose, height, true);
    const ys = [ft[1], ft[0]].map((p) => p[1] / height);
    const F = dirOf(wd.yaw);
    const fwd = legs.map((l) => (l[2][0] - wd.hip[0]) * F[0] + (l[2][2] - wd.hip[2]) * F[2]);
    bearing =
      k === k0
        ? standing(ys)
        : nextBearing(
            bearing,
            ys,
            fwd.map((x, i) => x - prevFwd[i]),
          );
    prevFwd = fwd;
    const leg = w.legAt(t);
    const P = w.pathAt(t);
    const P0 = w.pathAt(t - w.step);
    const len = Math.hypot(P[0] - P0[0], P[1] - P0[1]);
    const T: [number, number] =
      len > 1e-9 ? [(P[0] - P0[0]) / len, (P[1] - P0[1]) / len] : [F[0], F[2]];
    const vRef = len > 1e-9 ? len / w.step : 0;
    const c = w.clipAt(t);
    const clip = c && `${c.track}:${c.clip}`;
    if (c) strides[clip!] = c.stride;
    const label: GaitLabel = leg.sit
      ? "sit"
      : inside(launch, t)
        ? "launch"
        : inside(stops, t)
          ? "stop"
          : inside(turns, t)
            ? "turn"
            : c
              ? "cruise"
              : "still";
    const prev = samples[samples.length - 1];
    const split =
      !prev ||
      prev.label !== label ||
      prev.clip !== clip ||
      (label === "cruise" &&
        prev.leg !== leg.i &&
        Math.abs(legSpeed(w, leg.i) - legSpeed(w, prev.leg)) >
          SPLIT_SPEED * Math.max(legSpeed(w, prev.leg), 1e-9));
    if (split) run++;
    const joinAt = [...slipFrom].find(([a, b]) => t >= a - 1e-9 && t <= b + 0.5 + 1e-9)?.[1];
    samples.push({
      t,
      hip: wd.hip,
      yaw: w.yaw[k],
      yaw0: w.yaw0[k],
      rate: (w.clock[Math.max(k, 1)] - w.clock[Math.max(k, 1) - 1]) / w.step,
      ...(c && { phase: c.phase }),
      stride: w.stride[k],
      bearing,
      feet: [legs[0][2], legs[1][2]],
      knees: [legs[0][1], legs[1][1]],
      P,
      T,
      vRef,
      ...(clip && { clip }),
      leg: leg.i,
      label,
      run,
      slip: label !== "launch" || joinAt === undefined || t >= joinAt - 1e-9,
    });
  }
  const path = keys.map((k) => ({ t: k.t, at: xzOf(k) }));
  return {
    id,
    from,
    to,
    height,
    s,
    step: w.step,
    legHalf: body.legHalf,
    strides,
    bends: bendsOf(w),
    path,
    samples,
  };
}

/** Ngưỡng của `gaitMetrics`, cùng khoá với `stickman.gait`; độ dài nhân `world.s`, `false` là không đo */
export interface GaitLimits {
  dip: number | false;
  surge: number | false;
  accel: number | false;
  lag: number | false;
  alpha: number | false;
  slip: number | false;
  slipJoin: number | false;
  slipFrame: number | false;
  rateJump: number | false;
  ratePeak: number | false;
  devStraight: number | false;
  devCorner: number | false;
  devArc: number | false;
  facing: number | false;
  feet: boolean;
  stopSwing: number | false;
}

/** Ngưỡng đề xuất tạm. docs/14-di-muot.md#32-bảng-số-đo */
export const GAIT_LIMITS: GaitLimits = {
  dip: 0.1,
  surge: 0.15,
  accel: 1,
  lag: 40,
  alpha: 1200,
  slip: 2,
  slipJoin: 3,
  slipFrame: 0.5,
  rateJump: 1.5,
  ratePeak: 1.6,
  devStraight: 5,
  devCorner: 50,
  devArc: 20,
  facing: 45,
  feet: true,
  stopSwing: 1.1,
};

/** Tốc quay thân của `cruise`, `stop` (trần rig) và của `turn`, `launch` (`TURN_JERK` của `check`), độ mỗi giây */
const OMEGA_WALK = TURN_WALK * 1.02;
const OMEGA_TURN = 300;
/** M1 bỏ cửa sổ có tốc `path` trung bình dưới ngần này (đơn vị rig mỗi giây, nhân `height · s`) */
const DIP_VREF_MIN = 60;
/** Sai phân của M2, M3 mỗi khung và dời cửa sổ M1 (giây); khoảng hai phía của nhảy nhịp M4 */
const DIFF = 1 / 60;
const RATE_SPAN = 0.05;
/** M8 bỏ mẫu hông chậm hơn ngần này phần tốc `path` */
const FACING_SLOW = 0.3;

export const GAIT_KEYS = [
  "dip",
  "surge",
  "accel",
  "lag",
  "omega",
  "omegaTurn",
  "alpha",
  "slip",
  "slipJoin",
  "slipFrame",
  "rateJump",
  "ratePeak",
  "devStraight",
  "devCorner",
  "devArc",
  "facing",
  "feetCross",
  "feetGap",
  "stopSpeed",
  "stopLift",
] as const;
export type GaitKey = (typeof GAIT_KEYS)[number];

/** Một số đo: giá trị tệ nhất, giây của nó, ngưỡng (đã nhân `s`); `n` là số mẫu hay cửa sổ đã đo, `0` là không có gì để đo */
export interface GaitRow {
  key: GaitKey;
  value: number;
  t: number;
  limit: number;
  ok: boolean;
  n: number;
  /** Sự kiện không đo được vì thiếu dữ liệu (M10: không có trọn một chu kỳ `cruise` cùng clip ngay trước); có thì không đạt */
  missing?: number;
  label?: GaitLabel;
  /** Chẩn đoán (M8–M10): không chặn */
  diag?: true;
  /** `false` ở `GaitLimits` */
  off?: true;
}

const DIAG: GaitKey[] = ["facing", "feetCross", "feetGap", "stopSpeed", "stopLift"];
/** Số đo đạt khi giá trị ≥ ngưỡng thay vì ≤ */
const AT_LEAST: GaitKey[] = ["feetCross", "feetGap"];
/** Số đo có dấu, đạt khi trị tuyệt đối ≤ ngưỡng */
const ABS: GaitKey[] = ["lag"];

/** Tốt nhất tới đâu: giữ mẫu tệ nhất theo `score` */
class Worst {
  value = 0;
  score = -Infinity;
  t = 0;
  n = 0;
  missing = 0;
  label?: GaitLabel;
  limit?: number;
  add(value: number, t: number, label?: GaitLabel, score = value, limit?: number) {
    this.n++;
    if (score > this.score)
      [this.score, this.value, this.t, this.label, this.limit] = [score, value, t, label, limit];
  }
}

const segDist = (p: [number, number], a: [number, number], b: [number, number]) => {
  const d = [b[0] - a[0], b[1] - a[1]];
  const l2 = d[0] * d[0] + d[1] * d[1];
  const u = l2 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - u * d[0], p[1] - a[1] - u * d[1]);
};

/** Hông cách nhánh `path` gần theo thời gian: các đoạn có quãng giây giao `[t − 1; t + 1]` */
function devAt(tr: GaitTrace, t: number, p: [number, number]): number {
  const k = tr.path;
  let best = Infinity;
  for (let i = 0; i < k.length; i++) {
    const b = k[i + 1];
    if (b ? b.t < t - 1 || k[i].t > t + 1 : k[i].t > t + 1) continue;
    best = Math.min(best, segDist(p, k[i].at, b ? b.at : k[i].at));
  }
  return Number.isFinite(best) ? best : segDist(p, k[k.length - 1].at, k[k.length - 1].at);
}

/**
 * Số đo M1–M4, M6, M8–M10 trên một `gaitTrace`: mỗi khoá một dòng, giá trị tệ nhất và giây của nó, chỉ lấy ở mẫu trong
 * `[from; to]` của trace. Mọi sai phân, cửa sổ chỉ lấy trong một lượt. M5 là `sceneSnaps`, M7 là luật `move` có sẵn.
 * docs/14-di-muot.md#32-bảng-số-đo
 */
export function gaitMetrics(tr: GaitTrace, limits: Partial<GaitLimits> = {}): GaitRow[] {
  const L = { ...GAIT_LIMITS, ...limits };
  const S = tr.samples;
  const { s, step } = tr;
  const unit = tr.height * s;
  const h = Math.max(1, Math.round(DIFF / step));
  const same = (i: number, j: number) => j >= 0 && j < S.length && S[i].run === S[j].run;
  const inWin = (t: number) => t >= tr.from - 1e-9 && t <= tr.to + 1e-9;
  const xz = (p: V3): [number, number] => [p[0], p[2]];
  const W = Object.fromEntries(GAIT_KEYS.map((k) => [k, new Worst()])) as Record<GaitKey, Worst>;

  // lượt: chỉ số đầu, cuối
  const runs: { a: number; b: number; label: GaitLabel }[] = [];
  S.forEach((x, i) => {
    const r = runs[runs.length - 1];
    if (r && S[r.a].run === x.run) r.b = i;
    else runs.push({ a: i, b: i, label: x.label });
  });
  const speed = (i: number) =>
    Math.hypot(S[i].hip[0] - S[i - 1].hip[0], S[i].hip[2] - S[i - 1].hip[2]) / step;

  for (const r of runs) {
    if (r.label !== "cruise") continue;
    // M1: cửa sổ dài một bước ở tốc `path`; mẫu đầu lượt có sai phân qua mẫu trước lượt nên bỏ
    const vs = S.slice(r.a + 1, r.b + 1)
      .map((x) => x.vRef)
      .filter((v) => v > 0)
      .sort((p, q) => p - q);
    const stride = Math.abs(tr.strides[S[r.a].clip ?? ""] ?? 0);
    if (vs.length && stride) {
      const vMed = vs[vs.length >> 1];
      const len = Math.max(2, Math.round((stride * unit) / (2 * vMed) / step));
      let last: { rho: number; i: number } | undefined;
      for (let i = r.a + 1; i + len - 1 <= r.b; i += h) {
        let sv = 0;
        let sr = 0;
        for (let j = i; j < i + len; j++) [sv, sr] = [sv + speed(j), sr + S[j].vRef];
        const mid = S[i + (len >> 1)];
        if (sr / len < DIP_VREF_MIN * unit) {
          last = undefined;
          continue;
        }
        const rho = sv / sr;
        if (inWin(mid.t)) {
          W.dip.add(1 - rho, mid.t, "cruise");
          W.surge.add(rho - 1, mid.t, "cruise");
          if (last && last.i === i - h)
            W.accel.add(Math.abs(rho - last.rho) / (h * step), mid.t, "cruise");
        }
        last = { rho, i };
      }
      // M8: hướng thân so hướng vận tốc hông trung bình một bước
      const half = len >> 1;
      for (let i = r.a + half; i + half <= r.b; i++) {
        if (!inWin(S[i].t)) continue;
        const [p, q] = [S[i - half].hip, S[i + half].hip];
        const v = [(q[0] - p[0]) / (2 * half * step), (q[2] - p[2]) / (2 * half * step)];
        if (Math.hypot(v[0], v[1]) < FACING_SLOW * S[i].vRef || S[i].vRef <= 0) continue;
        W.facing.add(Math.abs(wrap180(S[i].yaw - heading(v[0], v[1]))), S[i].t, "cruise");
      }
    }
    // M4: nhịp chân; `rate` của mẫu đầu lượt là sai phân qua mẫu trước lượt nên bỏ
    const span = Math.max(1, Math.round(RATE_SPAN / step));
    for (let i = r.a + 1; i <= r.b; i++) {
      if (!inWin(S[i].t)) continue;
      W.ratePeak.add(S[i].rate, S[i].t, "cruise");
      if (i - span > r.a && i + span <= r.b)
        W.rateJump.add(
          Math.abs(S[i + span].rate - S[i - span].rate) / (2 * span * step),
          S[i].t,
          "cruise",
        );
    }
  }

  // từng mẫu: trễ, quay thân, bám đường, hai chân
  for (let i = 0; i < S.length; i++) {
    const x = S[i];
    if (!inWin(x.t)) continue;
    if ((x.label === "cruise" || x.label === "launch") && x.vRef > 0) {
      const lag = (x.P[0] - x.hip[0]) * x.T[0] + (x.P[1] - x.hip[2]) * x.T[1];
      W.lag.add(lag, x.t, x.label, Math.abs(lag));
    }
    if (x.label !== "still" && x.label !== "sit" && same(i, i - h) && same(i, i + h)) {
      const omega = (j: number) => (S[j + h].yaw - S[j - h].yaw) / (2 * h * step);
      const w0 = omega(i);
      if (x.label === "cruise" || x.label === "stop") W.omega.add(Math.abs(w0), x.t, x.label);
      else W.omegaTurn.add(Math.abs(w0), x.t, x.label);
      if (x.label !== "turn" && same(i, i - 2 * h) && same(i, i + 2 * h)) {
        const a = (omega(i + h) - omega(i - h)) / (2 * h * step);
        W.alpha.add(Math.abs(a), x.t, x.label);
      }
    }
    if (x.label === "cruise") {
      const dev = devAt(tr, x.t, xz(x.hip));
      const bend = tr.bends.find((b) => x.t >= b.from && x.t <= b.to);
      if (!bend) W.devStraight.add(dev, x.t, "cruise");
      else if (bend.kind === "arc") W.devArc.add(dev, x.t, "cruise");
      else if (L.devCorner !== false) {
        const lim = (L.devCorner * s * Math.sin((Math.abs(bend.theta) / 2) * D)) / Math.sin(45 * D);
        W.devCorner.add(dev, x.t, "cruise", dev / Math.max(lim, 1e-6), lim);
      }
    }
    if (x.label !== "sit") {
      const R = dirOf((x.yaw + 90) * D);
      const lat = (x.feet[0][0] - x.feet[1][0]) * R[0] + (x.feet[0][2] - x.feet[1][2]) * R[2];
      W.feetCross.add(lat, x.t, x.label, -lat);
      const gap = segSegDistance(x.knees[0], x.feet[0], x.knees[1], x.feet[1]);
      W.feetGap.add(gap, x.t, x.label, -gap);
    }
  }

  // M3: trượt chân trụ, pha trụ đơn trong một lượt
  let t0 = -1;
  for (let i = 0; i < S.length; i++) {
    const x = S[i];
    const on =
      x.slip &&
      (x.label === "cruise" || x.label === "stop" || x.label === "launch") &&
      x.bearing.length === 1;
    if (!on) {
      t0 = -1;
      continue;
    }
    const f = x.bearing[0];
    if (
      t0 < 0 ||
      !same(i, t0) ||
      S[i - 1].bearing.length !== 1 ||
      S[i - 1].bearing[0] !== f ||
      !S[i - 1].slip
    ) {
      t0 = i;
      continue;
    }
    if (!inWin(x.t)) continue;
    const p = x.feet[f];
    const q = S[t0].feet[f];
    const dev = Math.hypot(p[0] - q[0], p[2] - q[2]);
    (x.label === "cruise" ? W.slip : W.slipJoin).add(dev, x.t, x.label);
    if (i - h >= t0) {
      const r = S[i - h].feet[f];
      W.slipFrame.add(Math.hypot(p[0] - r[0], p[2] - r[2]), x.t, x.label);
    }
  }

  // M10: bàn chân bay trong một lần dừng (chuỗi mẫu `stop` liền) so với chính chân ấy trên trọn một chu kỳ `cruise`
  // cùng clip ngay trước; độ nhấc tính từ bàn chân thấp hơn lúc ấy
  const swing = (a: number, b: number, f: number, keep: (i: number) => boolean) => {
    const v = { value: 0, t: 0 };
    const lift = { value: 0, t: 0 };
    for (let i = Math.max(a + h, h); i <= b; i++) {
      if (S[i].bearing.includes(f) || !keep(i)) continue;
      const [p, q] = [S[i].feet[f], S[i - h].feet[f]];
      const vi = Math.hypot(p[0] - q[0], p[2] - q[2]) / (h * step);
      const li = Math.max(S[i].feet[0][1], S[i].feet[1][1]) - p[1];
      if (vi > v.value) [v.value, v.t] = [vi, S[i].t];
      if (li > lift.value) [lift.value, lift.t] = [li, S[i].t];
    }
    return { v, lift };
  };
  for (let a = 0; a < S.length; a++) {
    if (S[a].label !== "stop" || (a > 0 && S[a - 1].label === "stop")) continue;
    let b = a;
    while (b + 1 < S.length && S[b + 1].label === "stop") b++;
    if (!S.slice(a, b + 1).some((x) => inWin(x.t))) continue;
    const clip = S[a].clip;
    const ph = (i: number) => S[i].phase ?? 0;
    const prior = (i: number) => i >= 0 && S[i].label === "cruise" && S[i].clip === clip;
    let c = a - 1;
    while (prior(c - 1) && ph(a - 1) - ph(c) < 1 - 1e-9) c--;
    if (clip === undefined || !prior(a - 1) || ph(a - 1) - ph(c) < 1 - 1e-9) {
      W.stopSpeed.missing++;
      W.stopLift.missing++;
      continue;
    }
    for (const f of [0, 1]) {
      const base = swing(c, a - 1, f, () => true);
      if (!base.v.value || !base.lift.value) {
        W.stopSpeed.missing++;
        W.stopLift.missing++;
        continue;
      }
      const st = swing(a, b, f, (i) => inWin(S[i].t));
      W.stopSpeed.add(st.v.value / base.v.value, st.v.t, "stop");
      W.stopLift.add(st.lift.value / base.lift.value, st.lift.t, "stop");
    }
  }

  const limitOf = (k: GaitKey): number | false => {
    switch (k) {
      case "omega":
        return OMEGA_WALK;
      case "omegaTurn":
        return OMEGA_TURN;
      case "lag":
      case "slip":
      case "slipJoin":
      case "slipFrame":
      case "devStraight":
      case "devArc":
        return L[k] === false ? false : (L[k] as number) * s;
      case "devCorner":
        return L.devCorner === false ? false : (W.devCorner.limit ?? L.devCorner * s);
      case "feetCross":
        return L.feet ? 0 : false;
      case "feetGap":
        return L.feet ? 2 * tr.legHalf * unit : false;
      case "stopSpeed":
      case "stopLift":
        return L.stopSwing;
      default:
        return L[k] as number | false;
    }
  };
  return GAIT_KEYS.map((key) => {
    const w = W[key];
    const lim = limitOf(key);
    const value = w.n ? w.value : 0;
    const v = ABS.includes(key) ? Math.abs(value) : value;
    const ok =
      lim === false ||
      ((!w.n || (AT_LEAST.includes(key) ? v >= lim - 1e-9 : v <= lim + 1e-9)) && !w.missing);
    return {
      key,
      value,
      t: w.t,
      limit: lim === false ? 0 : lim,
      ok,
      n: w.n,
      ...(w.missing && { missing: w.missing }),
      ...(w.label && { label: w.label }),
      ...(DIAG.includes(key) && { diag: true as const }),
      ...(lim === false && { off: true as const }),
    };
  });
}

const GAIT_WHAT: Partial<Record<GaitKey, string>> = {
  dip: "hông chậm hơn tốc độ `path`",
  surge: "hông nhanh hơn tốc độ `path`",
  accel: "tốc hông đổi gấp",
  lag: "hông trễ dọc đường",
  omega: "thân quay nhanh quá trần đi",
  omegaTurn: "thân quay nhanh quá",
  alpha: "thân quay tăng tốc gắt",
  slip: "chân trụ trượt",
  slipJoin: "chân trụ trượt ở chỗ nối",
  slipFrame: "chân trụ trượt trong một khung",
  rateJump: "nhịp chân nhảy",
  ratePeak: "nhịp chân quá nhanh",
  devStraight: "hông lệch đường thẳng",
  devCorner: "hông cắt góc",
  devArc: "hông lệch cung",
};

const fmt = (k: GaitKey, v: number) =>
  k === "dip" || k === "surge" ? `${Math.round(v * 100)}%` : v.toFixed(v < 10 ? 2 : 0);

/**
 * Số đo đi (M1–M4, M6) vượt ngưỡng của mọi người đi `path`, mỗi số đo một dòng ở giây tệ nhất — chẩn đoán, `check`
 * không gọi nó. `heights`, `bodies` lấy từ runtime. docs/14-di-muot.md#33-chỗ-hiện
 */
export function sceneGaitProblems(rt: SceneRuntime, limits: Partial<GaitLimits> = {}): string[] {
  const out: string[] = [];
  for (const m of rt.cast) {
    const tr = m.world?.path && rt.lens ? gaitTrace(rt, m.id) : undefined;
    if (!tr) continue;
    for (const r of gaitMetrics(tr, limits))
      if (!r.ok && !r.diag && GAIT_WHAT[r.key])
        out.push(
          `\`${m.id}\` giây ${r.t.toFixed(2)}: ${GAIT_WHAT[r.key]} ${fmt(r.key, r.value)} (${r.label}) — ngưỡng ${fmt(r.key, r.limit)}`,
        );
  }
  return out;
}
