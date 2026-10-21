// Tay dẫn kẹp chén: phía ngón cái (ρ(around)) trong thế giới so hướng về mặt người cầm; báo cổ tay
import { actAim, actHeld, type ActInput } from "../../../packages/rig/src/core/act3";
import { body3 } from "../../../packages/rig/src/core/figure3d";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import { axialAt, itemGeom } from "../../../packages/rig/src/core/heldGeom";
import { matVec } from "../../../packages/rig/src/core/lens";
import { parseScene, resolveScene, sceneAt } from "../../../packages/rig/src/core/scene";
import { CharacterSchema } from "../../../packages/rig/src/core/schema";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
const C = CharacterSchema.parse({ head: { form: "human" }, palette: { clad: true } });
const CHEN = parseHeldItem(chen).data!;
const geom = itemGeom(CHEN);
const f = geom.features.find((x) => x.kind === "lathe")! as any;
const targets = JSON.parse(process.env.T ?? '[[-25,-250,-70],[-40,-260,-90],[-10,-300,-60]]');
for (const side of ["right", "left"] as const) for (const T of targets) {
  const at = side === "right" ? T : [-T[0], T[1], T[2]];
  const hold = { item: "chen", group: "bowl", ...(process.env.AROUND ? { around: Number(process.env.AROUND) } : {}) };
  const sc = parseScene({ name: "x", lens: { eye: [0, -250, -1400], yaw: 0, pitch: 0, f: 800 }, cast: [{ id: "a", world: { at: [0, 0, 0], yaw: 90, hands: [{ t: 0, [side]: { at, point: "grip", hold } }] }, tracks: [] }] }).data!;
  const rt = resolveScene(sc, {}, {}, {}, { a: 1 }, { a: body3(C) }, { chen: CHEN });
  const sp = sceneAt(rt, "a", 0, 1, body3(C)) as ActInput;
  const tag = side === "right" ? "R" : "L";
  const held = actHeld(C, sp)[tag]!;
  const rep = actAim(C, sp)!.report[tag];
  const rho = axialAt(geom, f, 0.5, Number(process.env.AROUND ?? 0)).rho;
  const v = matVec(held.R, rho);
  const thumbW = [v[0], -v[1], -v[2]];
  const up = matVec(held.R, [0, 1, 0]);
  // người nhìn theo yaw 90: hướng ra trước của người trong thế giới rig
  // người quay yaw 90: thân ở gốc; "về thân dọc hướng mặt" = trục tiến của người, chiều về gốc
  const fwdW = [Math.cos(Math.PI / 2), 0, -Math.sin(Math.PI / 2)];
  const s = (0 - held.at[0]) * fwdW[0] + (0 - held.at[2]) * fwdW[2] < 0 ? -1 : 1;
  const toHead = fwdW.map((x) => x * s);
  const ang = (a: number[], b: number[]) => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[2] * b[2]) / Math.hypot(a[0], a[2]) / Math.hypot(b[0], b[2])))) * 180 / Math.PI;
  console.log(side, JSON.stringify(at), "cái↔về thân (ngang)", ang(thumbW, toHead).toFixed(0), "°", "miệng lên", (-up[1]).toFixed(2) === "-1.00" ? "?" : (up[1]).toFixed(2), "cổ tay", JSON.stringify(rep.hold ?? {}).slice(0, 160), "wrist", JSON.stringify((rep as any).wrist ?? (rep as any).limit ?? "").slice(0, 80));
}
