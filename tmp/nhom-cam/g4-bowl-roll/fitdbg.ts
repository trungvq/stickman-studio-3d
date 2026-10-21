import { GRIP_GROUPS, PINCH_ALONG } from "../../../packages/rig/src/core/graspGroups";
import { graspFrame } from "../../../packages/rig/src/core/graspSolve";
import { HAND_POSES, THUMB_ROLL, handFrames, HAND_BONES } from "../../../packages/rig/src/core/hand";
import { handSkin } from "../../../packages/rig/src/core/handMesh";
import { capsuleClearance, skinBulge } from "../../../packages/rig/src/core/heldFit";
import { handDims, itemGeom } from "../../../packages/rig/src/core/heldGeom";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import { matVec } from "../../../packages/rig/src/core/lens";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
(THUMB_ROLL as any)[1] = 120; (PINCH_ALONG as any)[1] = 0.7;
if (process.env.POSE) Object.assign(HAND_POSES.cupPinch as any, JSON.parse(process.env.POSE));
const spec = parseHeldItem(chen).data!; const geom = itemGeom(spec);
const [k, long, side] = [1.75, 1.545, -1];
const g = graspFrame(spec, geom, { group: "bowl", along: 0.45 }, side, handDims(k, long), k, long);
const b = skinBulge(handSkin(side, k, long), g.pose);
for (const tb of [-20, -10, 0, 10, 20]) {
  const v = [...g.pose]; v[4] += tb;
  const F = handFrames(v, side, k, long);
  const out = (["thumb0", "thumb1"] as const).map((n) => {
    const f = F[n]; const t = matVec(f.R, [0, -f.len, 0]).map((x, i) => x + f.o[i]) as any;
    const r = HAND_BONES.thumb.r * Math.min(k, 1.3 * long) * (n === "thumb0" ? 1 : 0.95);
    const c = capsuleClearance(spec.shape!, g.G, f.o, t, r + (b[n] ?? 0));
    return `${n} gap ${c.gap.toFixed(2)} root ${c.root.toFixed(2)} bulge ${(b[n] * 100).toFixed(2)}`;
  });
  console.log("tb+", tb, out.join(" | "));
}
