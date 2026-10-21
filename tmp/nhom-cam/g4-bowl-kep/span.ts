import { GRIP_GROUPS } from "../../../packages/rig/src/core/graspGroups";
import { graspFrame } from "../../../packages/rig/src/core/graspSolve";
import { HAND_POSES, HAND_PIECES } from "../../../packages/rig/src/core/hand";
import { handSkin, skinHand } from "../../../packages/rig/src/core/handMesh";
import { heldOppose } from "../../../packages/rig/src/core/heldAudit";
import { heldDistance, heldFit, skinBulge, skinPieces, toItem } from "../../../packages/rig/src/core/heldFit";
import { handDims, itemGeom } from "../../../packages/rig/src/core/heldGeom";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
if (process.env.POSE) Object.assign((HAND_POSES as any).cupPinch, JSON.parse(process.env.POSE));
if (process.env.ROLES) Object.assign((GRIP_GROUPS.bowl.variants as any).pinch.roles, JSON.parse(process.env.ROLES));
if (process.env.CURL) (GRIP_GROUPS.bowl.variants as any).pinch.curl = Number(process.env.CURL);
const spec = parseHeldItem(chen).data!;
const geom = itemGeom(spec);
const TH = Number(process.env.TH ?? 0.5);
const picks = JSON.parse(process.argv[2] ?? '[{"group":"bowl"}]');
for (const [name, k, long] of [["sakura", 1.75, 1.545], ["kuroiwa", 2, 1.813]] as const)
  for (const side of [-1, 1])
    for (const pick of picks) {
      const g = graspFrame(spec, geom, pick, side, handDims(k, long), k, long);
      const skin = handSkin(side, k, long);
      const fit = heldFit({ v: g.pose, side, k, long, shape: spec.shape!, G: g.G, roles: g.roles, bulge: skinBulge(skin, g.pose), curl: (GRIP_GROUPS.bowl.variants as any)[g.choice.variant!]?.curl });
      const pos = new Float32Array(skin.pos.length);
      skinHand(skin, [...g.pose, ...fit], pos);
      const dom = skinPieces(skin);
      const pts: Record<string, number[][]> = {}; const gaps: Record<string, number> = {};
      const near: Record<string, any[]> = {};
      for (let i = 0; i < dom.length; i++) {
        const n = HAND_PIECES[dom[i]]; const o = n === "palm" ? "palm" : n.slice(0, -1);
        const q = toItem(g.G, [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]]);
        const d = heldDistance(spec.shape!, q);
        gaps[o] = Math.min(gaps[o] ?? Infinity, d);
        if (d <= TH) { (pts[o] ??= []).push(q); (near[o] ??= []).push(q); }
      }
      const span = (P?: number[][]) => { let m = 0; for (const a of P ?? []) for (const b of P ?? []) m = Math.max(m, Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2])); return m; };
      const op = heldOppose(spec.shape!, near as any, gaps as any, g.roles);
      console.log(`${name} ${JSON.stringify(pick)} ${g.choice.variant} | ${["thumb","index","middle","ring","palm"].map((f) => `${f} gap ${gaps[f].toFixed(1)} span ${span(pts[f]).toFixed(1)}`).join(" | ")} | đối ${op?.angle.toFixed(0)} | fit ${fit.map((x)=>x.toFixed(0)).join(",")}`);
    }
