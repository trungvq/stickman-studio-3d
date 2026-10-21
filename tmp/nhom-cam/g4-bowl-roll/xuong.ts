// Khớp ngón (khung món chén): góc quanh trục θ, bán kính ρ, cao y; hướng đệm ngón cái so pháp tuyến vào trong
import { graspFrame } from "../../../packages/rig/src/core/graspSolve";
import { HAND_POSES, handFrames } from "../../../packages/rig/src/core/hand";
import { toItem } from "../../../packages/rig/src/core/heldFit";
import { handDims, itemGeom } from "../../../packages/rig/src/core/heldGeom";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import { matVec } from "../../../packages/rig/src/core/lens";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
import { THUMB_ROLL } from "../../../packages/rig/src/core/hand";
(THUMB_ROLL as any)[0] = -90; (THUMB_ROLL as any)[1] = 120;
if (process.env.POSE) Object.assign(HAND_POSES.cupPinch as any, JSON.parse(process.env.POSE));
const spec = parseHeldItem(chen).data!;
const geom = itemGeom(spec);
const [k, long] = process.env.KURO ? [2, 1.813] : [1.75, 1.545];
const side = Number(process.env.SIDE ?? -1);
const along = Number(process.env.ALONG ?? 0.275);
const g = graspFrame(spec, geom, { group: "bowl", along }, side, handDims(k, long), k, long);
const F = handFrames(g.pose, side, k, long);
const P = (h: number[]) => { const q = toItem(g.G, h as any); return `θ${(Math.atan2(q[2], q[0]) * 180 / Math.PI).toFixed(0)} ρ${Math.hypot(q[0], q[2]).toFixed(1)} y${q[1].toFixed(1)}`; };
const D = (h: number[]) => { const q = toItem(g.G, h as any), o = toItem(g.G, [0, 0, 0]); return [q[0] - o[0], q[1] - o[1], q[2] - o[2]].map((x) => (x * g.G.u).toFixed(2)).join(","); };
console.log("pose", g.pose.slice(2).join(","));
console.log("palm n", D([-side, 0, 0]), "fingers", D([0, -1, 0]), "z", D([0, 0, 1]), "wrist", P([0, 0, 0]));
for (const n of ["thumb0", "thumb1", "index0", "index1", "middle0", "middle1"] as const) {
  const f = F[n];
  const tip = matVec(f.R, [0, -f.len, 0]).map((x, i) => x + f.o[i]);
  console.log(n, "gốc", P(f.o), "ngọn", P(tip), "đệm", D(matVec(f.R, [-side, 0, 0])));
}
console.log("G.p (rig)", g.G.p.map((x) => (x * 100).toFixed(1)).join(","), "u", g.G.u, "trục y món trong khung tay", [g.G.R[1], g.G.R[4], g.G.R[7]].map((x) => x.toFixed(2)).join(","));
