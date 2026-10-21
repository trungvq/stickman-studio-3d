// Hướng trục cầm (tiếp điểm cái − trung điểm trỏ–giữa) trong mặt phẳng ngang của chén theo `around`
import { graspFrame } from "../../../packages/rig/src/core/graspSolve";
import { handFrames } from "../../../packages/rig/src/core/hand";
import { toItem } from "../../../packages/rig/src/core/heldFit";
import { handDims, itemGeom } from "../../../packages/rig/src/core/heldGeom";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import { matVec } from "../../../packages/rig/src/core/lens";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
const spec = parseHeldItem(chen).data!; const geom = itemGeom(spec);
console.log("F", geom.F, "U", geom.U);
const mid = (f: any) => matVec(f.R, [0, -f.len / 2, 0]).map((x: number, i: number) => x + f.o[i]) as any;
for (const [k, l] of [[1.75, 1.545], [2, 1.813]]) for (const side of [-1, 1]) for (const around of [0, 30, 90]) {
  const g = graspFrame(spec, geom, { group: "bowl", around, along: 0.45 }, side, handDims(k, l), k, l);
  const F = handFrames(g.pose, side, k, l);
  const t = toItem(g.G, mid(F.thumb1)), i = toItem(g.G, mid(F.index1)), m = toItem(g.G, mid(F.middle1));
  const gx = t[0] - (i[0] + m[0]) / 2, gz = t[2] - (i[2] + m[2]) / 2;
  const palm = matVec([g.G.R[0], g.G.R[3], g.G.R[6], g.G.R[1], g.G.R[4], g.G.R[7], g.G.R[2], g.G.R[5], g.G.R[8]] as any, [-side, 0, 0]);
  console.log(k, side, around, "trục cầm θ", (Math.atan2(gz, gx) * 180 / Math.PI).toFixed(1), "lòng θ", (Math.atan2(palm[2], palm[0]) * 180 / Math.PI).toFixed(1));
}
