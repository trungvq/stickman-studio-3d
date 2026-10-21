// node quet.mjs <core trước> <core sau> — quét chỗ mốc món cuối của cảnh đổi đường, in biến thể mà xoay món ở 2,8 s khác nhau
import { readFileSync } from "node:fs";
const V = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam";
const j = (p) => JSON.parse(readFileSync(`${V}/${p}`, "utf8"));
const base = JSON.parse(readFileSync(new URL("../g4k2/thu-nhom-cam-doi-duong.json", import.meta.url), "utf8"));
const A = new URL("../../../apps/studio/public/actions", import.meta.url).pathname;
const tr = (R) => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
async function rig(path) {
  const core = await import(path);
  const C = core.parseCharacter(j("characters/takumi.json")).data;
  const h = core.parseHeldItem(j("held/thu-dien-thoai.json")).data;
  const acts = {};
  for (const n of ["stand-3d", "face-kind"])
    acts[n] = core.parseAction(JSON.parse(readFileSync(`${A}/${n}.json`, "utf8"))).data;
  const H = C.rig.height;
  const D = core.body3(C);
  const rot = (A, B) => {
    const M = core.matMul(tr(A), B);
    return (Math.acos(Math.max(-1, Math.min(1, (M[0] + M[4] + M[8] - 1) / 2))) * 180) / Math.PI;
  };
  return (scene) => {
    const rt = core.resolveScene(core.parseScene(scene).data, acts, {}, {}, { takumi: H }, { takumi: D }, { "thu-dien-thoai": h });
    const W = core.sceneAt(rt, "takumi", 2.79, H, D).world;
    let x = (W.flip ? W.hands.far : W.hands.near).hold;
    if (core.inheritHold) x = core.inheritHold(x, C);
    const lead = core.holdLinkFrame(x, -1).G.R;
    const b = core.graspAtTime(rt, "takumi", "right", 3.4, { chars: { takumi: C } });
    return { deg: rot(b.frame.G.R, lead), thumb: b.choice.thumb, over: b.arm.wrist.over };
  };
}
const a = await rig(process.argv[2]);
const b = await rig(process.argv[3]);
for (const to of ["eye", "chest"])
  for (const f of [30, 40, 50])
    for (const y of to === "eye" ? [0, 6, 12, 15, 18] : [-40, -20, 0, 20])
      for (const z of [-15, -5, 4, 14, 24]) {
        const d = structuredClone(base);
        Object.assign(d.items[2], { to, offset: [f, y, z] });
        const p = a(d);
        const q = b(d);
        if (Math.abs(p.deg - q.deg) > 0.5)
          console.log(to, f, y, z, `${p.deg.toFixed(1)}° ${p.thumb} → ${q.deg.toFixed(1)}° ${q.thumb}`, JSON.stringify(q.over));
      }
console.log("xong");
