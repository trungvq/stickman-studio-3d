// Tối ưu toạ độ: ngón cái (5 số) và độ gập thêm gốc/ngọn trỏ–út ở dáng đóng/mở của `bowl` `pinch`
import { run, fmt } from "./do";
import { score } from "./tim";
import { GRIP_GROUPS, PINCH_ALONG } from "../../../packages/rig/src/core/graspGroups";
import { HAND_POSES, THUMB_ROLL } from "../../../packages/rig/src/core/hand";
(PINCH_ALONG as any)[1] = 0.7;
const LIM = JSON.parse(process.env.LIM ?? "[-15,45]");
(THUMB_ROLL as any)[0] = LIM[0]; (THUMB_ROLL as any)[1] = LIM[1];
const P = HAND_POSES.cupPinch as any;
const S = (GRIP_GROUPS.bowl.variants as any).pinch.pose;
const CASES: number[][] = JSON.parse(process.env.CASES ?? "[[1.75,1.545,-1,0.4],[1.75,1.545,-1,0.5],[2,1.813,-1,0.4],[2,1.813,-1,0.5]]");
const names = ["abd", "opp", "tb", "tt", "roll", "ib", "it", "fb", "ft", "kc", "tc", "ko", "to"];
const lo = [30, 60, -20, -20, LIM[0], 0, 0, 0, 0, -30, -30, -60, -40];
const hi = [90, 120, 40, 60, LIM[1], 60, 60, 70, 60, 60, 40, 30, 40];
function apply(x: number[]) {
  P.thumb = [x[0], x[1], x[2], x[3]]; P.thumbRoll = x[4]; P.index = [x[5], x[6]]; P.fingers = [x[7], x[8]];
  S.closed = { pose: "cupPinch", knuckle: x[9], tip: x[10] }; S.open = { pose: "cupPinch", knuckle: x[11], tip: x[12] };
}
function total(x: number[], show = false) {
  apply(x); let s = 0;
  for (const [k, l, side, a] of CASES) {
    let r; try { r = run(k, l, side, a); } catch { s += 100; continue; }
    s += score(r); if (show) console.log(`  ${k} ${a} | ${fmt(r)}`);
  }
  return s;
}
let x: number[] = JSON.parse(process.env.START ?? "[65,100,0,-10,45,20,15,30,15,0,0,-15,0]");
let best = total(x);
console.log("start", best.toFixed(2));
function cd(x0: number[], b0: number) {
  let [xx, bb] = [x0, b0];
  for (const step of [10, 5, 2]) {
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < xx.length; i++) for (const d of [step, -step]) {
        const y = [...xx]; y[i] = Math.max(lo[i], Math.min(hi[i], y[i] + d));
        if (y[i] === xx[i]) continue;
        const s = total(y);
        if (s < bb - 1e-6) { bb = s; xx = y; improved = true; }
      }
    }
  }
  return [xx, bb] as const;
}
[x, best] = cd(x, best) as any;
console.log("cd", best.toFixed(2), JSON.stringify(x));
let seed = Number(process.env.SEED ?? 11); const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let round = 0; round < Number(process.env.ROUNDS ?? 12); round++) {
  const y = [...x];
  for (let j = 0; j < 3; j++) { const i = Math.floor(rnd() * y.length); y[i] = Math.max(lo[i], Math.min(hi[i], y[i] + (rnd() < 0.5 ? -1 : 1) * (10 + Math.floor(rnd() * 3) * 5))); }
  const [z, bz] = cd(y, total(y));
  console.log("round", round, bz.toFixed(2), JSON.stringify(z));
  if (bz < best) { best = bz; x = [...z]; }
}
console.log("BEST", best.toFixed(2), JSON.stringify(x));
total(x, true);
