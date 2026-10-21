import { HAND_POSES, handFrames } from "../../../packages/rig/src/core/hand";
import { handVec } from "../../../packages/rig/src/core/hand";
import { matVec } from "../../../packages/rig/src/core/lens";
const F = handFrames(handVec("cupPinch"), -1, 1.75, 1.545);
for (const n of ["palm","thumb0","thumb1","index0","index1","middle0","middle1"] as const) {
  const f = F[n]; const t = matVec(f.R, [0, -f.len, 0]).map((x, i) => x + f.o[i]);
  console.log(n, f.o.map((x) => (x * 100).toFixed(1)).join(","), "->", t.map((x) => (x * 100).toFixed(1)).join(","));
}
