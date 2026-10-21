import { GRIP_GROUPS } from "../../../packages/rig/src/core/graspGroups";
import { graspFrame } from "../../../packages/rig/src/core/graspSolve";
import { handFrames, HAND_PIECES, HAND_POSES } from "../../../packages/rig/src/core/hand";
import { handSkin, skinHand } from "../../../packages/rig/src/core/handMesh";
import { heldOppose } from "../../../packages/rig/src/core/heldAudit";
import { capsuleClearance, heldFit, skinBulge, skinDepth, skinPieces } from "../../../packages/rig/src/core/heldFit";
import { handDims, itemGeom } from "../../../packages/rig/src/core/heldGeom";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import { matVec } from "../../../packages/rig/src/core/lens";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
(globalThis as any).DBG = !!process.env.DBG;
if (process.env.POSE) Object.assign((HAND_POSES as any).cupPinch, JSON.parse(process.env.POSE));
const spec = parseHeldItem(chen).data!;
const geom = itemGeom(spec);
const picks = JSON.parse(process.argv[2] ?? '[{"group":"bowl"},{"group":"bowl","around":120},{"group":"bowl","along":0.5},{"group":"bowl","variant":"side"}]');
const f1 = (x: number) => (Math.abs(x) < 0.05 ? "0.0" : x.toFixed(1));
for (const [name, k, long] of [["sakura", 1.75, 1.545], ["kuroiwa", 2, 1.813]] as const)
  for (const side of [-1, 1])
    for (const pick of picks) {
      const g = graspFrame(spec, geom, pick, side, handDims(k, long), k, long);
      const skin = handSkin(side, k, long);
      const fit = heldFit({ v: g.pose, side, k, long, shape: spec.shape!, G: g.G, roles: g.roles, bulge: skinBulge(skin, g.pose), curl: (GRIP_GROUPS.bowl.variants as any)[g.choice.variant!]?.curl });
      const v = [...g.pose, ...fit];
      const pos = new Float32Array(skin.pos.length);
      skinHand(skin, v, pos);
      const sd = skinDepth(pos, skinPieces(skin), g.G, spec.shape!);
      const F = handFrames(v, side, k, long);
      const pierce = Math.max(...HAND_PIECES.filter((n) => n !== "palm").map((n) => {
        const d = matVec(F[n].R, [0, -F[n].len, 0]);
        return capsuleClearance(spec.shape!, g.G, F[n].o, [F[n].o[0] + d[0], F[n].o[1] + d[1], F[n].o[2] + d[2]], 0).core;
      }));
      const op = heldOppose(spec.shape!, sd.near, sd.gaps, g.roles);
      const ats = Object.fromEntries(Object.entries(Object.fromEntries(Object.entries(sd.near).map(([k, v]) => [k, v![0]]))).filter(([p]) => ["thumb","index","middle","palm"].includes(p)).map(([p, q]) => [p, `θ${(Math.atan2(q![2], q![0]) * 180 / Math.PI).toFixed(0)} ρ${Math.hypot(q![0], q![2]).toFixed(1)} y${q![1].toFixed(1)}`]));
      console.log(`${name} ${side < 0 ? "P" : "T"} ${JSON.stringify(pick)} → ${g.choice.variant} along ${g.choice.along} | lún ${f1(Math.max(0, -Math.min(...Object.values(sd.gaps))))} xuyên ${f1(pierce)} | ${Object.entries(sd.gaps).map(([p, d]) => `${p} ${f1(d)}`).join(" ")} | đối ${op ? `${op.angle.toFixed(0)}° ${op.part}` : "-"} | fit ${fit.map((x) => x.toFixed(0)).join(",")}`);
      if (process.env.AT) console.log("   ", JSON.stringify(ats));
    }
