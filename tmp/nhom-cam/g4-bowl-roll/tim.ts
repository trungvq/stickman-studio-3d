// Quét dáng ngón cái `cupPinch` (dạng, đối, gập gốc, gập ngọn, xoay) chấm theo tiêu chí kẹp chén
import { run, fmt, PEOPLE } from "./do";
import { PINCH_ALONG } from "../../../packages/rig/src/core/graspGroups";
(PINCH_ALONG as any)[1] = 0.7;
import { HAND_POSES, THUMB_ROLL } from "../../../packages/rig/src/core/hand";
(THUMB_ROLL as any)[0] = -90; (THUMB_ROLL as any)[1] = 120;
const P = HAND_POSES.cupPinch as any;
const G = JSON.parse(process.env.GRID ?? "{}");
const CASES: [number, number, number, number][] = JSON.parse(process.env.CASES ?? "[[1.75,1.545,-1,0.275]]");
export function score(r: any) {
  let s = 0;
  for (const f of ["thumb", "index", "middle"]) {
    s += Math.max(0, r[f].gap - 0.5) * 3 + Math.max(0, r[f].d1 - r[f].span) / 2;
  }
  s += Math.max(0, 150 - r.op) / 10 + Math.max(0, 1 - r.palm) * 3 + Math.max(0, r.sink - 0.5) * 4 + Math.max(0, r.topNear + 0.3) * 2;
  s += Math.max(0, r.pad - 50) / 10;
  s += r.fit.reduce((a: number, x: number) => a + Math.abs(x), 0) / 200;
  return s;
}
const out: [number, string][] = [];
const keys = Object.keys(G);
if (import.meta.main) {
const combos = keys.reduce((acc: any[], k) => acc.flatMap((c) => G[k].map((v: number) => ({ ...c, [k]: v }))), [{}]);
for (const c of combos) {
  P.thumb = [c.abd, c.opp, c.tb, c.tt];
  P.thumbRoll = c.roll ?? 0;
  if (c.ib !== undefined) P.index = [c.ib, c.it ?? 15];
  if (c.fb !== undefined) P.fingers = [c.fb, c.ft ?? 15];
  let s = 0; const notes: string[] = [];
  for (const [k, long, side, a] of CASES) {
    let r; try { r = run(k, long, side, a); } catch (e) { s += 100; continue; }
    s += score(r); notes.push(fmt(r));
  }
  out.push([s, `${JSON.stringify(c)} | ${notes.join(" || ")}`]);
}
out.sort((a, b) => a[0] - b[0]);
for (const [s, t] of out.slice(0, Number(process.env.TOP ?? 12))) console.log(s.toFixed(2), t);
}
