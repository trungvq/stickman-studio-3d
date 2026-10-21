// Tâm nắm cỡ 1 của `cupPinch`: điểm trên trục chén ở tầm `along` trong khung bàn tay, chia cỡ
import { graspFrame } from "../../../packages/rig/src/core/graspSolve";
import { HAND_GRIPS } from "../../../packages/rig/src/core/hand";
import { handDims, itemGeom, axialAt } from "../../../packages/rig/src/core/heldGeom";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
const spec = parseHeldItem(chen).data!; const geom = itemGeom(spec);
const acc = [0, 0, 0]; let n = 0;
for (const [k, l] of [[1.75, 1.545], [2, 1.813]]) for (const a of [0.4, 0.45, 0.5]) {
  const g = graspFrame(spec, geom, { group: "bowl", along: a }, -1, handDims(k, l), k, l);
  // điểm trên trục ở tầm 1 − along (y món: miệng 4,5, đáy −4,5)
  const y = 4.5 - 9 * a;
  const R = g.G.R, u = g.G.u;
  const h = [0, 1, 2].map((i) => g.G.p[i] + u * (R[3 * i + 1] * y));
  const c = [h[0] / k, h[1] / l, h[2] / k];
  acc.forEach((_, i) => (acc[i] += c[i])); n++;
  console.log(k, a, c.map((x) => x.toFixed(4)).join(","));
}
console.log("trung bình", acc.map((x) => (x / n).toFixed(3)).join(","), "cũ", HAND_GRIPS.cupPinch.join(","));
