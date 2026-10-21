import { evalPose } from "./hinh2";
import { handFrames, HAND_BONES } from "../../../packages/rig/src/core/hand";
const [k, long] = [1.75, 1.545];
const x = [51, 67, 31, -8, 0, 13, 9, 8, 30];
const c = JSON.parse(process.env.C ?? '[11.0,-19.5]');
const kr = Math.min(k, 1.3 * long);
const Rp = 7.1 + 1.7 * kr * 0.95;
const B = [HAND_BONES.thumb.at[0] * k * 100, HAND_BONES.thumb.at[1] * long * 100];
const L0 = HAND_BONES.thumb.len[0] * long * 100, L1 = HAND_BONES.thumb.len[1] * long * 100;
console.log("c", c, "R'", Rp.toFixed(1), "B", B, "L0", L0.toFixed(1), "L1", L1.toFixed(1));
for (let phi = -180; phi < 180; phi += 15) {
  const f = phi * Math.PI / 180;
  const M = [c[0] + Rp * Math.cos(f), c[1] + Rp * Math.sin(f)];
  for (const s of [1, -1]) {
    const d = [-Math.sin(f) * s, Math.cos(f) * s];
    const b1 = [M[0] - d[0] * L1 / 2, M[1] - d[1] * L1 / 2];
    const dist = Math.hypot(b1[0] - B[0], b1[1] - B[1]);
    const d0 = [(b1[0] - B[0]) / dist, (b1[1] - B[1]) / dist];
    const ip = Math.acos(d0[0] * d[0] + d0[1] * d[1]) * 180 / Math.PI;
    if (Math.abs(dist - L0) < 2.5) console.log(`φ ${phi} dir ${s} base1 ${b1.map((v) => v.toFixed(1))} |B-base1| ${dist.toFixed(1)} IP ${ip.toFixed(0)}`);
  }
}
