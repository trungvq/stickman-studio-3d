import { run } from "./do";
import { HAND_POSES } from "../../../packages/rig/src/core/hand";
const P = HAND_POSES.cupPinch as any;
let t = performance.now();
for (let i = 0; i < 10; i++) { P.thumb = [65, 100 - i, 0, -10]; run(1.75, 1.545, -1, 0.275); }
console.log((performance.now() - t) / 10, "ms");
