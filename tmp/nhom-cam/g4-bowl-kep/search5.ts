import { GRIP_GROUPS } from "../../../packages/rig/src/core/graspGroups";
import { graspFrame } from "../../../packages/rig/src/core/graspSolve";
import { HAND_POSES, HAND_PIECES } from "../../../packages/rig/src/core/hand";
import { handSkin, skinHand } from "../../../packages/rig/src/core/handMesh";
import { heldOppose } from "../../../packages/rig/src/core/heldAudit";
import { heldDistance, heldFit, skinBulge, skinPieces, toItem } from "../../../packages/rig/src/core/heldFit";
import { handDims, itemGeom } from "../../../packages/rig/src/core/heldGeom";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
const V = (GRIP_GROUPS.bowl.variants as any).pinch;
if (process.env.ROLES) Object.assign(V.roles, JSON.parse(process.env.ROLES));
if (process.env.CURL) V.curl = Number(process.env.CURL);
const P = HAND_POSES.cupPinch as any;
const spec = parseHeldItem(chen).data!;
const geom = itemGeom(spec);
const along = Number(process.env.ALONG ?? 0.25);
function run(k: number, long: number, side: number) {
  const g = graspFrame(spec, geom, { group: "bowl", along }, side, handDims(k, long), k, long);
  const skin = handSkin(side, k, long);
  const fit = heldFit({ v: g.pose, side, k, long, shape: spec.shape!, G: g.G, roles: g.roles, bulge: skinBulge(skin, g.pose), curl: V.curl });
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, [...g.pose, ...fit], pos);
  const dom = skinPieces(skin);
  const gaps: Record<string, number> = {}; const near: Record<string, any[]> = {};
  for (let i = 0; i < dom.length; i++) {
    const n = HAND_PIECES[dom[i]]; const o = n === "palm" ? "palm" : n.slice(0, -1);
    const q = toItem(g.G, [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]]);
    const d = heldDistance(spec.shape!, q);
    gaps[o] = Math.min(gaps[o] ?? Infinity, d);
    if (d <= 0.5) (near[o] ??= []).push(q);
  }
  const span = (Q?: number[][]) => { let m = 0; for (const a of Q ?? []) for (const b of Q ?? []) m = Math.max(m, Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2])); return m; };
  const op = heldOppose(spec.shape!, near as any, gaps as any, g.roles)?.angle ?? 0;
  const sink = Math.max(0, -Math.min(...Object.values(gaps)));
  return { gaps, op, sink, sp: { t: span(near.thumb), i: span(near.index), m: span(near.middle) }, fit };
}
const G = JSON.parse(process.env.GRID!);
const PPs = JSON.parse(process.env.PPS ?? "[2]");
const out: [number, string][] = [];
for (const pp of PPs) { (globalThis as any).PP = pp;
for (const abd of G[0]) for (const opp of G[1]) for (const tb of G[2]) for (const tt of G[3]) for (const ib of G[4]) for (const it of G[5]) {
  P.thumb = [abd, opp, tb, tt]; P.index = [ib, it]; P.fingers = [ib + (Number(process.env.FOFF ?? 0)), it];
  let score = 0; const notes: string[] = [];
  for (const [k, long] of [[1.75, 1.545], [2, 1.813]]) {
    const r = run(k, long, -1); const g = r.gaps;
    score += Math.max(0, g.thumb - 0.3) * 3 + Math.max(0, 5 - r.sp.t) + Math.max(0, 5 - r.sp.i) + Math.max(0, 4 - r.sp.m) * 0.5 + Math.max(0, 130 - r.op) / 10 + Math.max(0, 1 - g.palm) * 3 + Math.max(0, r.sink - 0.5) * 4 + r.fit.reduce((a, x) => a + Math.abs(x), 0) / 100;
    notes.push(`op ${r.op.toFixed(0)} palm ${g.palm.toFixed(1)} T ${g.thumb.toFixed(1)}/${r.sp.t.toFixed(1)} I ${g.index.toFixed(1)}/${r.sp.i.toFixed(1)} M ${g.middle.toFixed(1)}/${r.sp.m.toFixed(1)} sink ${r.sink.toFixed(1)} fit ${r.fit.slice(0,6).map((x)=>x.toFixed(0))}`);
  }
  out.push([score, `pp ${pp} [${abd},${opp},${tb},${tt}] [${ib},${it}] ${notes.join(" | ")}`]);
}}
out.sort((a, b) => a[0] - b[0]);
for (const [s, t] of out.slice(0, 12)) console.log(s.toFixed(2), t);
