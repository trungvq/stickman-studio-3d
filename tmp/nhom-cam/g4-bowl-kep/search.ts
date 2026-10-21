import { handFrames, HAND_BONES } from "../../../packages/rig/src/core/hand";
import { add3, matVec, scale3, sub3, dot3, type V3 } from "../../../packages/rig/src/core/lens";
const [k, long] = [1.75, 1.545];
const side = -1, p = 1;
const D = Number(process.argv[2] ?? 15);
const pads = (v: number[]) => {
  const F = handFrames(v, side, k, long);
  const o: Record<string, { pos: V3; dir: V3 }> = {};
  for (const f of ["thumb", "index", "middle"] as const) {
    const s = F[`${f}1` as const];
    const r = (f === "thumb" ? HAND_BONES.thumb.r : HAND_BONES.index.r) * k;
    const dir = matVec(s.R, [p, 0, 0]);
    const tip = add3(s.o, matVec(s.R, [0, -s.len * 0.7, 0]));
    const pos = add3(tip, scale3(dir, r));
    o[f] = { pos: [pos[0] * 100 * p, pos[1] * 100, pos[2] * 100], dir: [dir[0] * p, dir[1], dir[2]] };
  }
  return o;
};
const res: [number, string][] = [];
for (let abd = 0; abd <= 90; abd += 15)
  for (let opp = 0; opp <= 90; opp += 15)
    for (let tb = -30; tb <= 45; tb += 15)
      for (let tt = -10; tt <= 40; tt += 10)
        for (let ib = 0; ib <= 80; ib += 10)
          for (let it = 0; it <= 80; it += 10) {
            const v = [0, 0, abd, opp, tb, tt, ib, it, ib, it, 0];
            const P = pads(v);
            const T = P.thumb, I = P.index, M = P.middle;
            const im = scale3(add3(I.pos, M.pos), 0.5);
            const d = sub3(im, T.pos);
            const L = Math.hypot(...d);
            const u = scale3(d, 1 / L);
            const a = dot3(T.dir, u), b = -dot3(I.dir, u), c = -dot3(M.dir, u);
            const mid = scale3(add3(im, T.pos), 0.5);
            const score = Math.abs(L - D) / 3 + (1 - a) * 3 + (1 - b) * 3 + (1 - c) * 2 + (mid[0] < 4.55 + D / 2 + 0.5 ? (4.55 + D / 2 + 0.5 - mid[0]) / 2 : 0);
            res.push([score, `abd ${abd} opp ${opp} tb ${tb} tt ${tt} | ib ${ib} it ${it} | L ${L.toFixed(1)} a ${a.toFixed(2)} b ${b.toFixed(2)} c ${c.toFixed(2)} mid ${mid.map((x) => x.toFixed(1))} u ${u.map((x) => x.toFixed(2))}`]);
          }
res.sort((x, y) => x[0] - y[0]);
for (const [s, t] of res.slice(0, 25)) console.log(s.toFixed(2), t);
