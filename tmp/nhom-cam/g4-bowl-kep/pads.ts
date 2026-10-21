import { handFrames, HAND_BONES, HAND_FINGERS } from "../../../packages/rig/src/core/hand";
import { add3, matVec, scale3, type V3 } from "../../../packages/rig/src/core/lens";
const [k, long] = [Number(process.argv[2] ?? 1.75), Number(process.argv[3] ?? 1.545)];
const side = -1;
const pose = JSON.parse(process.argv[4] ?? '{"thumb":[60,60,10,10],"index":[45,25],"fingers":[45,25],"spread":0}');
const v = [0, 0, ...pose.thumb, ...pose.index, ...pose.fingers, pose.spread];
const F = handFrames(v, side, k, long);
const p = -side;
const r = { thumb: HAND_BONES.thumb.r, index: HAND_BONES.index.r, middle: HAND_FINGERS.middle.r, ring: HAND_FINGERS.ring.r, pinky: HAND_FINGERS.pinky.r };
const fmt = (a: V3) => a.map((x) => (x * 100).toFixed(1)).join(", ");
for (const f of ["thumb", "index", "middle", "ring", "pinky"] as const) {
  const s = F[`${f}1` as const];
  const tip = add3(s.o, matVec(s.R, [0, -s.len * 0.7, 0]));
  const padDir = matVec(s.R, [p, 0, 0]);
  const pad = add3(tip, scale3(padDir, r[f] * k));
  // in hand coords: x palm normal (p·x), y along hand (-y fingers), z thumb side
  console.log(f.padEnd(7), "pad", fmt([pad[0] * p, pad[1], pad[2]] as V3), " dir", padDir.map((x, i) => (i === 0 ? x * p : x).toFixed(2)).join(","));
}
