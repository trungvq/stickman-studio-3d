import { graspFrame } from "../../../packages/rig/src/core/graspSolve";
import { handDims, itemGeom } from "../../../packages/rig/src/core/heldGeom";
import { gripPoint, parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
const spec = parseHeldItem(chen).data!;
for (const [k, long] of [[1, 1], [1.75, 1.545], [2, 1.813]])
  for (const side of [-1, 1]) {
    const g = graspFrame(spec, itemGeom(spec), { group: "bowl" }, side, handDims(k, long), k, long);
    const q = gripPoint(g.G, [0, 2.25, 0]);
    console.log(k, side, g.choice.variant, "axis@contact in hand/k:", [q[0] / k * -side, q[1] / long, q[2] / k].map((x) => x.toFixed(4)).join(", "));
  }
