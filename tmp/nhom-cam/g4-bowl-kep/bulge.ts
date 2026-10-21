import { graspFrame } from "../../../packages/rig/src/core/graspSolve";
import { handFrames } from "../../../packages/rig/src/core/hand";
import { handSkin } from "../../../packages/rig/src/core/handMesh";
import { capsuleClearance, skinBulge } from "../../../packages/rig/src/core/heldFit";
import { handDims, itemGeom } from "../../../packages/rig/src/core/heldGeom";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import { matVec } from "../../../packages/rig/src/core/lens";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
const pieceRadius = (f: string, s: number, k: number, long: number) => (f === "thumb" ? 0.017 * Math.min(k, 1.3 * long) : 0.015 * k) * (s ? 0.92 : 1);
const spec = parseHeldItem(chen).data!;
const [k, long, side] = [1.75, 1.545, -1];
const g = graspFrame(spec, itemGeom(spec), { group: "bowl" }, side, handDims(k, long), k, long);
const b = skinBulge(handSkin(side, k, long), g.pose);
console.log("bulge", Object.fromEntries(Object.entries(b).map(([a, x]) => [a, +(x * 100).toFixed(2)])));
const F = handFrames(g.pose, side, k, long);
for (const n of ["thumb0", "thumb1", "index0", "index1", "middle1"] as const) {
  const f = n.slice(0, -1) as any, s = +n.slice(-1) as 0 | 1;
  const d = matVec(F[n].R, [0, -F[n].len, 0]);
  const tip = [F[n].o[0] + d[0], F[n].o[1] + d[1], F[n].o[2] + d[2]] as any;
  const c0 = capsuleClearance(spec.shape!, g.G, F[n].o, tip, pieceRadius(f, s, k, long));
  const c1 = capsuleClearance(spec.shape!, g.G, F[n].o, tip, pieceRadius(f, s, k, long) + b[n]);
  console.log(n, "cap", c0.gap.toFixed(2), "cap+bulge", c1.gap.toFixed(2), "root", c1.root.toFixed(2));
}
