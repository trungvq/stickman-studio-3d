// Thiết kế ngón cái trên khung xương (không qua bộ giải): chén đứng dọc trục z bàn tay, chạm đốt ngọn trỏ và giữa;
// chấm ngón cái: đốt ngọn tiếp tuyến thành ở giữa đốt, nằm ngang, cao giữa trỏ và giữa, đối diện, đốt gốc không xuyên.
import { HAND_POSES, THUMB_ROLL, handFrames, HAND_BONES } from "../../../packages/rig/src/core/hand";
import { matVec } from "../../../packages/rig/src/core/lens";
(THUMB_ROLL as any)[0] = -90; (THUMB_ROLL as any)[1] = 120;
type V = [number, number, number];
const P = HAND_POSES.cupPinch as any;
const seg = (f: any): [V, V] => [f.o, matVec(f.R, [0, -f.len, 0]).map((x: number, i: number) => x + f.o[i]) as V];
const d2 = (c: number[], a: V, b: V) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return { d: Math.hypot(a[0] + dx * t - c[0], a[1] + dy * t - c[1]), t };
};
export function evalPose(th: number[], k: number, long: number, Rc = 7.1, verbose = false) {
  const side = -1, p = 1;
  const v = [0, 0, th[0], th[1], th[2], th[3], ...P.index, ...P.fingers, P.spread, th[4]];
  const F = handFrames(v, side, k, long);
  const kr = Math.min(k, 1.3 * long);
  const u = 0.01;
  const R = Rc * u;
  const ri = HAND_BONES.index.r * kr * 0.95, rm = 0.0145 * kr * 0.95, rt = HAND_BONES.thumb.r * kr * 0.95;
  const I = seg(F.index1), M = seg(F.middle1), T1 = seg(F.thumb1), T0 = seg(F.thumb0);
  // tâm chén: chạm trỏ và giữa (Newton 2D từ trước lòng tay)
  const res = (q: number[]) => (d2(q, ...I).d - R - ri) ** 2 + (d2(q, ...M).d - R - rm) ** 2;
  let c = [0.13, -0.16];
  for (let x = 0.06; x <= 0.25; x += 0.005) for (let y = -0.3; y <= -0.05; y += 0.005) if (res([x, y]) < res(c)) c = [x, y];
  for (let i = 0; i < 40; i++) {
    const f = (q: number[]) => [d2(q, ...I).d - R - ri, d2(q, ...M).d - R - rm];
    const f0 = f(c), h = 1e-5;
    const fa = f([c[0] + h, c[1]]), fb = f([c[0], c[1] + h]);
    const j = [[(fa[0] - f0[0]) / h, (fb[0] - f0[0]) / h], [(fa[1] - f0[1]) / h, (fb[1] - f0[1]) / h]];
    const det = j[0][0] * j[1][1] - j[0][1] * j[1][0];
    if (Math.abs(det) < 1e-12) break;
    const ea = (j[1][1] * f0[0] - j[0][1] * f0[1]) / det, eb = (j[0][0] * f0[1] - j[1][0] * f0[0]) / det;
    c = [c[0] - ea, c[1] - eb];
  }
  const ti = d2(c, ...I), tm = d2(c, ...M), tt1 = d2(c, ...T1), tt0 = d2(c, ...T0);
  const zi = I[0][2] + (I[1][2] - I[0][2]) * ti.t, zm = M[0][2] + (M[1][2] - M[0][2]) * tm.t;
  const zt = T1[0][2] + (T1[1][2] - T1[0][2]) * tt1.t;
  const L1 = Math.hypot(T1[1][0] - T1[0][0], T1[1][1] - T1[0][1], T1[1][2] - T1[0][2]);
  const tilt = Math.asin(Math.abs(T1[1][2] - T1[0][2]) / L1) * 180 / Math.PI;
  // vùng dọc đốt ngọn cái trong dải 0,5 (2D): lấy mẫu
  let cov = 0;
  for (let s = 0; s <= 20; s++) {
    const q = T1[0].map((x, i) => x + (T1[1][i] - x) * s / 20);
    if (Math.hypot(q[0] - c[0], q[1] - c[1]) - R - rt <= 0.5 * u) cov += 1 / 21;
  }
  const ang = (q: number[]) => Math.atan2(q[1] - c[1], q[0] - c[0]);
  const at = (S: [V, V], t: number) => S[0].map((x, i) => x + (S[1][i] - x) * t);
  const ai = ang(at(I, ti.t)), am = ang(at(M, tm.t)), atb = ang(at(T1, tt1.t));
  const mid = Math.atan2(Math.sin(ai) + Math.sin(am), Math.cos(ai) + Math.cos(am));
  let op = Math.abs(atb - mid) * 180 / Math.PI; if (op > 180) op = 360 - op;
  const palm = (c[0] * p - HAND_BONES.palm.half[0] * k - R) / u;
  const r = {
    gapT: (tt1.d - R - rt) / u, tmid: tt1.t, cov, pierce0: (tt0.d - R - rt) / u, op, palm, tilt,
    dz: (zt - (zi + zm) / 2) / u, top: (Math.max(T1[0][2], T1[1][2], T0[1][2]) + rt - zi) / u,
  };
  return r;
}
export function cost(r: any) {
  return Math.abs(r.gapT) * 2 + Math.abs(r.tmid - 0.5) * 6 + (1 - r.cov) * 8 + Math.max(0, -r.pierce0) * 3 + Math.max(0, 155 - r.op) / 5
    + Math.max(0, 1.2 - r.palm) * 3 + r.tilt / 10 + Math.abs(r.dz) / 2;
}
if (import.meta.main) {
  const LIM = JSON.parse(process.env.LIM ?? "[-15,45]");
  const H = [[1.75, 1.545], [2, 1.813]];
  const total = (th: number[]) => H.reduce((s, [k, l]) => s + cost(evalPose(th, k, l)), 0);
  let best: number[] = JSON.parse(process.env.START ?? "[65,100,0,-10,0]"), bc = total(best);
  const lo = [0, 0, -25, -20, LIM[0]], hi = [100, 120, 70, 90, LIM[1]];
  let step = 16;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let it = 0; it < 6000; it++) {
    const cand = best.map((x, i) => Math.max(lo[i], Math.min(hi[i], x + (rnd() * 2 - 1) * step)));
    const cc = total(cand);
    if (cc < bc) { best = cand; bc = cc; }
    if (it % 1000 === 999) step = Math.max(1, step / 2);
  }
  console.log(bc.toFixed(2), best.map((x) => x.toFixed(0)).join(","));
  for (const [k, l] of H) console.log(JSON.stringify(evalPose(best, k, l), (_, x) => typeof x === "number" ? +x.toFixed(2) : x));
}
