// Kiểm ca.json bằng đường act3 thật: mốc tay `at` = cổ tay, `elbow` đã xuất, bàn tay [turn, bend] + lệch ở kênh nâng
// → actJoints / actPalms phải ra đúng khuỷu, cổ tay, lòng tay, ngón như ca.json.
// Chạy: node tmp/nhom-cam/b0/run.mjs tmp/nhom-cam/b0/verify.mts
import fs from "node:fs";
import { actJoints, actPalms } from "../../../packages/rig/src/core/act3";
import { HAND_REST } from "../../../packages/rig/src/core/hand";
import { parseScene, resolveScene, sceneAt } from "../../../packages/rig/src/core/scene";
import { parseCharacter } from "../../../packages/rig/src/core/schema";
import { parseAction } from "../../../packages/rig/src/core/action";
import { body3 } from "../../../packages/rig/src/core/figure3d";
import { gripFrame, parseHeldItem } from "../../../packages/rig/src/core/heldItem";
const CA = JSON.parse(fs.readFileSync(new URL("./ca.json", import.meta.url), "utf8"));
const VIDEO = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam";
const STUDIO = new URL("../../../", import.meta.url).pathname;
const readJ = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const listJ = (d: string) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".json")) : []);
const actions: any = {};
for (const dir of [`${STUDIO}apps/studio/public/actions`, `${VIDEO}/actions`])
  for (const f of listJ(dir)) { const p = parseAction(readJ(`${dir}/${f}`)); if (p.success) actions[f.replace(/\.json$/, "")] = p.data; }
const sc = parseScene(readJ(`${VIDEO}/scenes/${CA.holder.scene}.json`)).data!;
const chars: any = {};
for (const m of sc.cast as any[]) chars[m.id] = parseCharacter(readJ(`${VIDEO}/characters/${m.character}`)).data;
const held: any = {};
for (const f of listJ(`${VIDEO}/held`)) { const p = parseHeldItem(readJ(`${VIDEO}/held/${f}`)); if (p.success) held[f.replace(/\.json$/, "")] = p.data; }
const ids = Object.keys(chars);
const rt = resolveScene(sc, actions, {}, {}, Object.fromEntries(ids.map((i) => [i, chars[i].rig.height])), Object.fromEntries(ids.map((i) => [i, body3(chars[i])])), held);
const CH = chars[CA.holder.cast];
const SP: any = sceneAt(rt, CA.holder.cast, CA.holder.t, CH.rig.height, body3(CH));
const d = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const ang = (a: number[], b: number[]) => {
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return (Math.atan2(Math.hypot(c[0], c[1], c[2]), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * 180) / Math.PI;
};
const recs: any[] = [];
for (const c of CA.cases) for (const s of c.samples ?? [{ hands: c.hands, t: undefined }]) for (const h of s.hands) recs.push({ id: c.id, t: s.t, h });
let worst = { el: 0, wr: 0, palm: 0, fing: 0 };
for (const { id, t, h } of recs) {
  if (t !== undefined && t !== 0 && Math.abs(t - 0.6) > 1e-6) continue;
  const near = !SP.world.flip ? "right" : "left";
  const key = h.hand === near ? "near" : "far";
  const ch = h.hand === near ? "an" : "af";
  const v = [...HAND_REST];
  v[0] = h.wristAngles.turn; v[1] = h.wristAngles.bend;
  const arm = [0, 0, h.wristAngles.dev, 0, 0];
  const sp = {
    ...SP,
    pose: { ...SP.pose, [ch]: arm, lift: { ...SP.pose.lift, [ch]: true }, hand: { ...SP.pose.hand, [ch]: v }, reach: {} },
    world: { ...SP.world, hands: { [key]: { at: h.wrist, elbow: h.elbow, w: 1 } } },
  };
  const J: any = actJoints(CH, sp);
  const P: any = actPalms(CH, sp);
  const tag = h.hand === "right" ? "R" : "L";
  const e = { el: d(J[`elbow${tag}`], h.elbowAt), wr: d(J[`wrist${tag}`], h.wristReached), palm: ang(P[tag].palm, h.handAxes.palm), fing: ang(P[tag].finger, h.handAxes.fingers) };
  for (const k of Object.keys(worst) as (keyof typeof worst)[]) worst[k] = Math.max(worst[k], e[k]);
  console.log(id, t ?? "", h.hand, Object.fromEntries(Object.entries(e).map(([k, x]) => [k, +x.toFixed(3)])));
}
console.log("worst", worst);
// GripSpec xuất ra nạp lại được qua parseHeldItem và cho đúng GripFrame đã dùng
let gWorst = 0, nG = 0;
for (const { id, h } of recs) {
  const base = id === "c5" ? CA.items["_b0-can"] : readJ(`${VIDEO}/held/bang-gia.json`);
  const raw = { ...base, grips: { ...base.grips, [h.gripSpec.name]: h.gripSpec.spec } };
  const p = parseHeldItem(raw);
  if (!p.success) throw new Error(`${h.gripSpec.name}: ${p.error.message}`);
  const side = h.hand === "right" ? -1 : 1;
  const G = gripFrame(p.data, p.data.grips[h.gripSpec.name] as any, side, CA.holder.handK * CA.holder.s, CA.holder.handLong * CA.holder.s, CA.holder.s);
  const e = Math.max(...G.R.map((x: number, i: number) => Math.abs(x - h.gripFrame.R[i])), ...G.p.map((x: number, i: number) => Math.abs(x - h.gripFrame.p[i]) * 100));
  gWorst = Math.max(gWorst, e);
  nG++;
}
console.log("gripSpec parse+gripFrame", nG, "max lệch (R, p rig)", gWorst);
