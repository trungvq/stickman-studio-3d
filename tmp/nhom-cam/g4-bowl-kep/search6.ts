import { GRIP_GROUPS } from "../../../packages/rig/src/core/graspGroups";
import { graspFrame } from "../../../packages/rig/src/core/graspSolve";
import { HAND_POSES, HAND_PIECES, handFrames } from "../../../packages/rig/src/core/hand";
import { handSkin, skinHand } from "../../../packages/rig/src/core/handMesh";
import { heldOppose } from "../../../packages/rig/src/core/heldAudit";
import { heldDistance, heldFit, heldNormal, skinBulge, skinPieces, toItem } from "../../../packages/rig/src/core/heldFit";
import { handDims, itemGeom } from "../../../packages/rig/src/core/heldGeom";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import { matVec } from "../../../packages/rig/src/core/lens";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
const V = (GRIP_GROUPS.bowl.variants as any).pinch;
if (process.env.ROLES) Object.assign(V.roles, JSON.parse(process.env.ROLES));
if (process.env.CURL) V.curl = Number(process.env.CURL);
const P = HAND_POSES.cupPinch as any;
const spec = parseHeldItem(chen).data!;
const geom = itemGeom(spec);
const ALONGS = JSON.parse(process.env.ALONGS ?? "[0.25]");
const SIDES = JSON.parse(process.env.SIDES ?? "[-1]");
export function run(k: number, long: number, side: number, along: number) {
  const g = graspFrame(spec, geom, { group: "bowl", along }, side, handDims(k, long), k, long);
  const skin = handSkin(side, k, long);
  const fit = heldFit({ v: g.pose, side, k, long, shape: spec.shape!, G: g.G, roles: g.roles, bulge: skinBulge(skin, g.pose), curl: V.curl });
  const v = [...g.pose, ...fit];
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, v, pos);
  const dom = skinPieces(skin);
  const gaps: Record<string, number> = {}; const near: Record<string, any[]> = {}; let thumbTop = -Infinity;
  for (let i = 0; i < dom.length; i++) {
    const n = HAND_PIECES[dom[i]]; const o = n === "palm" ? "palm" : n.slice(0, -1);
    const q = toItem(g.G, [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]]);
    const d = heldDistance(spec.shape!, q);
    gaps[o] = Math.min(gaps[o] ?? Infinity, d);
    if (d <= 0.5) (near[o] ??= []).push(q);
    if (o === "thumb") thumbTop = Math.max(thumbTop, q[1]);
  }
  const span = (Q?: number[][]) => { let m = 0; for (const a of Q ?? []) for (const b of Q ?? []) m = Math.max(m, Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2])); return m; };
  const op = heldOppose(spec.shape!, near as any, gaps as any, g.roles)?.angle ?? 0;
  const sink = Math.max(0, -Math.min(...Object.values(gaps)));
  // thumb pad direction vs inward normal at its contact
  const F = handFrames(v, side, k, long);
  const padH = matVec(F.thumb1.R, [-side, 0, 0]);
  const R = g.G.R; const padI = [R[0]*padH[0]+R[3]*padH[1]+R[6]*padH[2], R[1]*padH[0]+R[4]*padH[1]+R[7]*padH[2], R[2]*padH[0]+R[5]*padH[1]+R[8]*padH[2]];
  let padAng = 180;
  for (const q of near.thumb ?? []) { const nn = heldNormal(spec.shape!, q); const c = -(nn[0]*padI[0]+nn[1]*padI[1]+nn[2]*padI[2]); padAng = Math.min(padAng, Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI); }
  return { gaps, op, sink, sp: { t: span(near.thumb), i: span(near.index), m: span(near.middle) }, fit, padAng, thumbTop };
}
const G = JSON.parse(process.env.GRID ?? "null");
const fmt = (r: any) => `op ${r.op.toFixed(0)} palm ${r.gaps.palm.toFixed(1)} T ${r.gaps.thumb.toFixed(1)}/${r.sp.t.toFixed(1)} pad ${r.padAng.toFixed(0)} top ${r.thumbTop.toFixed(1)} I ${r.gaps.index.toFixed(1)}/${r.sp.i.toFixed(1)} M ${r.gaps.middle.toFixed(1)}/${r.sp.m.toFixed(1)} sink ${r.sink.toFixed(1)}`;
if (!G) {
  for (const [k, long] of [[1.75, 1.545], [2, 1.813]]) for (const side of SIDES) for (const a of ALONGS) console.log(k, side, a, fmt(run(k, long, side, a)));
} else {
  const out: [number, string][] = [];
  for (const abd of G[0]) for (const opp of G[1]) for (const tb of G[2]) for (const tt of G[3]) for (const ib of G[4]) for (const it of G[5]) for (const fo of G[6] ?? [0]) {
    P.thumb = [abd, opp, tb, tt]; P.index = [ib, it]; P.fingers = [ib + fo, it];
    let score = 0; const notes: string[] = [];
    for (const [k, long] of [[1.75, 1.545], [2, 1.813]]) for (const a of ALONGS) {
      let r; try { r = run(k, long, -1, a); } catch { score += 100; continue; }
      const d1 = 0.037 * long * 100, dt = 0.04 * long * 100;
      score += Math.max(0, r.gaps.thumb - 0.3) * 3 + Math.max(0, 0.8 * dt - r.sp.t) + Math.max(0, d1 - r.sp.i) + Math.max(0, d1 - r.sp.m) + Math.max(0, 150 - r.op) / 10 + Math.max(0, 1 - r.gaps.palm) * 3 + Math.max(0, r.sink - 0.5) * 4 + Math.max(0, r.padAng - 45) / 15 + Math.max(0, r.thumbTop - 4) * 2 + r.fit.reduce((s: number, x: number) => s + Math.abs(x), 0) / 100;
      notes.push(fmt(r));
    }
    out.push([score, `[${abd},${opp},${tb},${tt}] [${ib},${it}] fo ${fo} | ${notes.join(" | ")}`]);
  }
  out.sort((a, b) => a[0] - b[0]);
  for (const [s, t] of out.slice(0, Number(process.env.TOP ?? 10))) console.log(s.toFixed(2), t);
}
