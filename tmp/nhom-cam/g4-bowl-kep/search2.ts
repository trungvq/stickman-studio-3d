import { handFrames, HAND_BONES, HAND_FINGERS } from "../../../packages/rig/src/core/hand";
import { add3, matVec, scale3, sub3, type V3 } from "../../../packages/rig/src/core/lens";
const [k, long] = [Number(process.argv[3] ?? 1.75), Number(process.argv[4] ?? 1.545)];
const side = -1, p = 1;
const R = Number(process.argv[2] ?? 7.5);
const RAD = { thumb: HAND_BONES.thumb.r, index: HAND_BONES.index.r, middle: HAND_FINGERS.middle.r, ring: HAND_FINGERS.ring.r, pinky: HAND_FINGERS.pinky.r };
const h = (a: V3): V3 => [a[0] * 100 * p, a[1] * 100, a[2] * 100];
function eval_(v: number[]) {
  const F = handFrames(v, side, k, long);
  const pad = (f: keyof typeof RAD) => {
    const s = F[`${f}1` as const];
    const dir = matVec(s.R, [p, 0, 0]);
    return h(add3(add3(s.o, matVec(s.R, [0, -s.len * 0.75, 0])), scale3(dir, RAD[f] * k)));
  };
  const segs: [V3, V3, number][] = [];
  for (const f of ["index", "middle", "ring", "pinky", "thumb"] as const)
    for (const j of [0, 1] as const) {
      const s = F[`${f}${j}` as const];
      segs.push([h(s.o), h(add3(s.o, matVec(s.R, [0, -s.len, 0]))), RAD[f] * k * 100]);
    }
  return { T: pad("thumb"), I: pad("index"), M: pad("middle"), segs };
}
// 2D circle center through two points with radius R, choose larger x
function center(a: V3, b: V3, r: number): [number, number] | undefined {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  if (d > 2 * r) return undefined;
  const hh = Math.sqrt(r * r - (d / 2) ** 2);
  const nx = -dy / d, ny = dx / d;
  const c1: [number, number] = [mx + nx * hh, my + ny * hh], c2: [number, number] = [mx - nx * hh, my - ny * hh];
  return c1[0] > c2[0] ? c1 : c2;
}
const segDist2D = (c: [number, number], a: V3, b: V3) => {
  const ax = a[0] - c[0], ay = a[1] - c[1], bx = b[0] - a[0], by = b[1] - a[1];
  const t = Math.max(0, Math.min(1, -(ax * bx + ay * by) / (bx * bx + by * by || 1)));
  return Math.hypot(ax + bx * t, ay + by * t);
};
const out: [number, string][] = [];
const ang = (c: [number, number], a: V3, b: V3) => {
  const u = [a[0] - c[0], a[1] - c[1]], w = [b[0] - c[0], b[1] - c[1]];
  return (Math.acos((u[0] * w[0] + u[1] * w[1]) / Math.hypot(...u) / Math.hypot(...w)) * 180) / Math.PI;
};
for (let abd = 0; abd <= Number(process.env.AMAX ?? 90); abd += 10)
  for (let opp = 0; opp <= 90; opp += 10)
    for (let tb = -40; tb <= 40; tb += 10)
      for (let tt = -20; tt <= 40; tt += 10)
        for (let ib = 20; ib <= 90; ib += 10)
          for (let it = 0; it <= 80; it += 10) {
            const v = [0, 0, abd, opp, tb, tt, ib, it, ib, it, 0];
            const { T, I, M, segs } = eval_(v);
            const c = center(T, I, R + 0.3);
            if (!c) continue;
            const a = ang(c, T, I), am = ang(c, T, M);
            const palmClear = c[0] - R - 4.55 * (k / 1.75);
            // base finger segments and proximal thumb (only those overlapping cup height roughly)
            let segClear = Infinity;
            for (const [s0, s1, rr] of segs) segClear = Math.min(segClear, segDist2D(c, s0, s1) - rr - R);
            const score = (180 - a) / 30 + Math.max(0, 1.5 - palmClear) * 2 + Math.max(0, -segClear) + Math.abs(T[2] - I[2]) / 4;
            out.push([score, `[${abd},${opp},${tb},${tt}] [${ib},${it}] ang ${a.toFixed(0)} angM ${am.toFixed(0)} palm ${palmClear.toFixed(1)} seg ${segClear.toFixed(1)} c ${c.map((x) => x.toFixed(1))} Tz ${T[2].toFixed(1)} Iz ${I[2].toFixed(1)} Mz ${M[2].toFixed(1)}`]);
          }
out.sort((x, y) => x[0] - y[0]);
for (const [s, t] of out.slice(0, 30)) console.log(s.toFixed(2), t);
