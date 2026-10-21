import { GRIP_GROUPS } from "../../../packages/rig/src/core/graspGroups";
import { graspFrame } from "../../../packages/rig/src/core/graspSolve";
import { HAND_POSES } from "../../../packages/rig/src/core/hand";
import { handSkin, skinHand } from "../../../packages/rig/src/core/handMesh";
import { heldOppose } from "../../../packages/rig/src/core/heldAudit";
import { heldFit, skinBulge, skinDepth, skinPieces } from "../../../packages/rig/src/core/heldFit";
import { handDims, itemGeom } from "../../../packages/rig/src/core/heldGeom";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
const spec = parseHeldItem(chen).data!;
const geom = itemGeom(spec);
const P = HAND_POSES.cupPinch as any;
const sizes = (process.env.SIZES ?? "1.75,1.545").split(";").map((x) => x.split(",").map(Number));
function run(k: number, long: number, side: number) {
  const g = graspFrame(spec, geom, { group: "bowl", along: Number(process.env.ALONG ?? 0.25) }, side, handDims(k, long), k, long);
  const skin = handSkin(side, k, long);
  const fit = heldFit({ v: g.pose, side, k, long, shape: spec.shape!, G: g.G, roles: g.roles, bulge: skinBulge(skin, g.pose), curl: (GRIP_GROUPS.bowl.variants as any)[g.choice.variant!]?.curl });
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, [...g.pose, ...fit], pos);
  const sd = skinDepth(pos, skinPieces(skin), g.G, spec.shape!);
  const op = heldOppose(spec.shape!, sd.at, sd.gaps, g.roles);
  const th = (q: any) => Math.atan2(q[2], q[0]) * 180 / Math.PI;
  const T = sd.at.thumb!, I = sd.at.index!;
  let sep = Math.abs(th(T) - th(I)); if (sep > 180) sep = 360 - sep;
  return { gaps: sd.gaps, fit, op: op?.angle ?? 0, sep, dy: T[1] - I[1], ty: T[1], sink: Math.max(0, -Math.min(...Object.values(sd.gaps))) };
}
const out: [number, string][] = [];
const G = JSON.parse(process.env.GRID ?? "[[65,75,85],[75,90],[-20,0,15],[0,20],[45,55,65,75],[10,25,40]]");
for (const abd of G[0]) for (const opp of G[1]) for (const tb of G[2]) for (const tt of G[3])
  for (const ib of G[4]) for (const it of G[5]) for (const fb of G[6] ?? [null]) for (const ft of G[7] ?? [null]) {
    P.thumb = [abd, opp, tb, tt]; P.index = [ib, it]; P.fingers = [fb ?? ib, ft ?? it];
    let score = 0; const notes: string[] = [];
    for (const [k, long] of sizes) {
      const r = run(k, long, -1);
      const g = r.gaps;
      score += -r.sep / 30 + Math.abs(r.dy) / 1.5 + Math.max(0, r.ty - 3.5) + Math.max(0, g.thumb - 0.5) * 2 + Math.max(0, g.index - 0.5) * 2 + Math.max(0, g.middle - 1) + Math.max(0, 1.5 - g.palm) * 2 + Math.max(0, r.sink - 0.4) * 4 + r.fit.reduce((a, x) => a + Math.abs(x), 0) / 60;
      notes.push(`sep ${r.sep.toFixed(0)} dy ${r.dy.toFixed(1)} ty ${r.ty.toFixed(1)} op ${r.op.toFixed(0)} palm ${g.palm.toFixed(1)} T ${g.thumb.toFixed(1)} I ${g.index.toFixed(1)} M ${g.middle.toFixed(1)} R ${g.ring.toFixed(1)} sink ${r.sink.toFixed(1)} fit ${r.fit.slice(0, 6).map((x) => x.toFixed(0))}`);
    }
    out.push([score, `[${abd},${opp},${tb},${tt}] [${ib},${it}] [${fb ?? ib},${ft ?? it}] ${notes.join(" | ")}`]);
  }
out.sort((a, b) => a[0] - b[0]);
for (const [s, t] of out.slice(0, 20)) console.log(s.toFixed(2), t);
