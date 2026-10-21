// Khả thi hình học: chén trụ đứng (trục z bàn tay) bán kính Rc tiếp tuyến giữa đốt ngọn trỏ, giữa và cái; mọi đốt gốc,
// lòng tay không xuyên; đối ≥ 150°. Biến: ngón cái 5 số, trỏ 2, giữa–út 2.
import { THUMB_ROLL, handFrames, HAND_BONES } from "../../../packages/rig/src/core/hand";
import { matVec } from "../../../packages/rig/src/core/lens";
(THUMB_ROLL as any)[0] = -90; (THUMB_ROLL as any)[1] = 120;
type V = number[];
const seg = (f: any): [V, V] => [f.o.map((x: number) => x * 100), matVec(f.R, [0, -f.len, 0]).map((x: number, i: number) => (x + f.o[i]) * 100)];
const near = (c: V, [a, b]: [V, V]) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return { d: Math.hypot(a[0] + dx * t - c[0], a[1] + dy * t - c[1]), t, z: a[2] + (b[2] - a[2]) * t, p: [a[0] + dx * t, a[1] + dy * t] };
};
const cov = (c: V, [a, b]: [V, V], R: number) => {
  let n = 0;
  for (let s = 0; s <= 20; s++) { const q = [a[0] + (b[0] - a[0]) * s / 20, a[1] + (b[1] - a[1]) * s / 20]; if (Math.hypot(q[0] - c[0], q[1] - c[1]) - R <= 0.5) n++; }
  return n / 21;
};
export function evalPose(x: number[], k: number, long: number, Rc: number) {
  const [abd, opp, tb, tt, roll, ib, it, fb, ft] = x;
  const v = [0, 0, abd, opp, tb, tt, ib, it, fb, ft, 0, roll];
  const F = handFrames(v, -1, k, long);
  const kr = Math.min(k, 1.3 * long);
  const rt = 1.7 * kr, ri = 1.5 * kr, rm = 1.45 * kr;
  const S = Object.fromEntries((["thumb0", "thumb1", "index0", "index1", "middle0", "middle1"] as const).map((n) => [n, seg(F[n])]));
  const tx = HAND_BONES.palm.half[0] * k * 100, L = HAND_BONES.palm.len * long * 100;
  const palm: [V, V] = [[tx, 0, 0], [tx, -L, 0]];
  // tâm chén theo trỏ và giữa
  const res = (q: V) => (near(q, S.index1).d - Rc - ri * 0.95) ** 2 + (near(q, S.middle1).d - Rc - rm * 0.95) ** 2;
  let c = [12, -18];
  for (let X = 0; X <= 30; X += 0.5) for (let Y = -35; Y <= -5; Y += 0.5) if (res([X, Y]) < res(c)) c = [X, Y];
  for (let s = 0.25; s > 0.001; s /= 2) for (let i = 0; i < 20; i++) for (const d of [[s, 0], [-s, 0], [0, s], [0, -s]]) { const q = [c[0] + d[0], c[1] + d[1]]; if (res(q) < res(c)) c = q; }
  const nI = near(c, S.index1), nM = near(c, S.middle1), nT = near(c, S.thumb1);
  const ang = (p: V) => Math.atan2(p[1] - c[1], p[0] - c[0]);
  const ai = ang(nI.p), am = ang(nM.p), at = ang(nT.p);
  const mid = Math.atan2(Math.sin(ai) + Math.sin(am), Math.cos(ai) + Math.cos(am));
  let op = Math.abs(at - mid) * 180 / Math.PI; if (op > 180) op = 360 - op;
  return {
    res: Math.sqrt(res(c)), c,
    gT: nT.d - Rc - rt * 0.95, tT: nT.t, tI: nI.t, tM: nM.t,
    covT: cov(c, S.thumb1, Rc + rt * 0.95), covI: cov(c, S.index1, Rc + ri * 0.95), covM: cov(c, S.middle1, Rc + rm * 0.95),
    pen: Math.min(near(c, S.thumb0).d - Rc - rt, near(c, S.index0).d - Rc - ri, near(c, S.middle0).d - Rc - rm),
    palm: near(c, palm).d - Rc, op,
    dz: nT.z - (nI.z + nM.z) / 2, tilt: Math.abs(S.thumb1[1][2] - S.thumb1[0][2]),
  };
}
const cost0 = (r: any) => r.res * 3 + Math.abs(r.gT) * 2 + (1 - r.covT) * 8 + (1 - r.covI) * 4 + (1 - r.covM) * 4 + Math.max(0, -r.pen) * 3
  + Math.max(0, 1.5 - r.palm) * 3 + Math.max(0, 152 - r.op) / 4 + Math.abs(r.dz) / 2 + r.tilt / 3;
const MODE = process.env.MODE;
const cost = (r: any) => MODE === "op"
  ? -r.op / 10 + r.res * 5 + Math.abs(r.gT) * 5 + Math.max(0, 0.9 - r.covT) * 40 + Math.max(0, 0.8 - r.covI) * 40 + Math.max(0, 0.7 - r.covM) * 40 + Math.max(0, -r.pen) * 10 + Math.max(0, 1.2 - r.palm) * 10 + Math.max(0, Math.abs(r.dz) - 2) * 3
  : cost0(r);
if (import.meta.main) {
  const LIM = JSON.parse(process.env.LIM ?? "[-15,45]");
  const H = [[1.75, 1.545, 7.1], [2, 1.813, 7.1]];
  const total = (x: number[]) => H.reduce((s, [k, l, R]) => s + cost(evalPose(x, k, l, R)), 0);
  const lo = [0, 0, -25, -20, LIM[0], -10, -10, -10, -10], hi = [100, 120, 70, 90, LIM[1], 90, 90, 90, 90];
  let gb: number[] = [], gc = Infinity;
  for (let rs = 0; rs < Number(process.env.RESTARTS ?? 6); rs++) {
    let seed = 7 + rs * 101; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let best = rs === 0 ? [65, 100, 0, -10, 0, 20, 15, 30, 15] : lo.map((l, i) => l + rnd() * (hi[i] - l));
    let bc = total(best), step = 20;
    for (let it = 0; it < 3000; it++) {
      const cand = best.map((x, i) => Math.max(lo[i], Math.min(hi[i], x + (rnd() * 2 - 1) * step * (rnd() < 0.4 ? 1 : 0))));
      const cc = total(cand);
      if (cc < bc) { best = cand; bc = cc; }
      if (it % 500 === 499) step = Math.max(1, step / 2);
    }
    if (bc < gc) { gc = bc; gb = best; }
    console.log("restart", rs, bc.toFixed(2), best.map((x) => x.toFixed(0)).join(","));
  }
  console.log("BEST", gc.toFixed(2), gb.map((x) => x.toFixed(0)).join(","));
  for (const [k, l, R] of H) console.log(JSON.stringify(evalPose(gb, k, l, R), (_, x) => typeof x === "number" ? +x.toFixed(2) : x));
}
