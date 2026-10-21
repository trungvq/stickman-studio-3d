// node do.mjs <dist/core/index.js của rig> [cảnh] — xoay món trong tay (liên kết G) ở hai ranh giới theo mốc ↔ tay dẫn, takumi
import { readFileSync } from "node:fs";
const core = await import(process.argv[2]);
const V = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam";
const j = (p) => JSON.parse(readFileSync(`${V}/${p}`, "utf8"));
const c = core.parseCharacter(j("characters/takumi.json"));
if (!c.success) throw new Error("char");
const C = c.data;
const h = core.parseHeldItem(j("held/thu-dien-thoai.json"));
if (!h.success) throw new Error(h.error.message);
const scene = JSON.parse(
  readFileSync(process.argv[3] ?? new URL("../g4k2/thu-nhom-cam-doi-duong.json", import.meta.url), "utf8"),
);
const s = core.parseScene(scene);
if (!s.success) throw new Error(s.error.message);
const H = C.rig.height;
const D = core.body3(C);
const A = new URL("../../../apps/studio/public/actions", import.meta.url).pathname;
const acts = {};
for (const n of ["stand-3d", "face-kind"]) {
  const a = core.parseAction(JSON.parse(readFileSync(`${A}/${n}.json`, "utf8")));
  if (!a.success) throw new Error(n);
  acts[n] = a.data;
}
const rt = core.resolveScene(s.data, acts, {}, {}, { takumi: H }, { takumi: D }, { "thu-dien-thoai": h.data });
const chars = { takumi: C };
const right = (t) => {
  const W = core.sceneAt(rt, "takumi", t, H, D).world;
  return (W.flip ? W.hands.far : W.hands.near).hold;
};
const tr = (R) => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const rot = (A, B) => {
  const M = core.matMul(tr(A), B);
  return (Math.acos(Math.max(-1, Math.min(1, (M[0] + M[4] + M[8] - 1) / 2))) * 180) / Math.PI;
};
const keyed = core.graspAtTime(rt, "takumi", "right", 1.6 - 1e-4, { chars });
const lead = (t) => {
  let x = right(t);
  if (core.inheritHold) x = core.inheritHold(x, C);
  return core.holdLinkFrame(x, -1).G.R;
};
console.log("theo mốc trước 1,6", JSON.stringify(keyed.choice));
for (const t of [1.6 + 1e-4, 1.95, 2.5])
  console.log(`t=${t} theo mốc → tay dẫn: xoay món trong tay ${rot(keyed.frame.G.R, lead(t)).toFixed(2)}°`);
const back = core.graspAtTime(rt, "takumi", "right", 3.2, { chars });
console.log("theo mốc sau 2,8", JSON.stringify(back.choice));
console.log(`2.8 tay dẫn → theo mốc: ${rot(back.frame.G.R, lead(2.79)).toFixed(2)}°`);
