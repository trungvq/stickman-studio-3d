// node quet2.mjs <core trước> <core sau> — như quet.mjs trên fixture `nguoi-cam-bang` + `dien-thoai` của holdKeyed.test.ts
import { readFileSync } from "node:fs";
const F = new URL("../../../packages/rig/src/core/__fixtures__/", import.meta.url).pathname;
const fx = JSON.parse(readFileSync(`${F}nguoi-cam-bang.json`, "utf8"));
const phone = JSON.parse(readFileSync(`${F}held-v2/dien-thoai.json`, "utf8"));
const tr = (R) => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const PHONE = { item: "dien-thoai", group: "palmBox" };
const hands = [
  { t: 0, right: { hold: PHONE } },
  { t: 1.6, right: { to: "chest", offset: [34, 20, 18], point: "grip", hold: { ...PHONE, regrip: true } } },
  { t: 2.8, right: { hold: { ...PHONE, regrip: true } } },
];
const mk = (t, to, offset) => ({ t, cast: "nguoi", item: "dien-thoai", to, offset });
async function rig(path) {
  const core = await import(path);
  const C = core.parseCharacter(fx.character).data;
  const S = core.parseHeldItem(phone).data;
  const H = C.rig.height;
  const D = core.body3(C);
  const rot = (A, B) => {
    const M = core.matMul(tr(A), B);
    return (Math.acos(Math.max(-1, Math.min(1, (M[0] + M[4] + M[8] - 1) / 2))) * 180) / Math.PI;
  };
  return (last) => {
    const sc = core.parseScene({
      duration: 5,
      lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
      cast: [{ id: "nguoi", base: { torso: 9, head: [0, 0, -6] }, world: { at: [250, 0, 506], yaw: 270, hands } }],
      items: [mk(0.5, "chest", [40, -6, 6]), mk(1.2, "chest", [34, 0, 10]), last],
    });
    const rt = core.resolveScene(sc.data, {}, {}, {}, { nguoi: H }, { nguoi: D }, { "dien-thoai": S });
    const W = core.sceneAt(rt, "nguoi", 2.79, H, D).world;
    let x = (W.flip ? W.hands.far : W.hands.near).hold;
    if (core.inheritHold) x = core.inheritHold(x, C);
    const lead = core.holdLinkFrame(x, -1).G.R;
    const b = core.graspAtTime(rt, "nguoi", "right", 3.4, { chars: { nguoi: C } });
    return { deg: rot(b.frame.G.R, lead), thumb: b.choice.thumb, over: b.arm.wrist.over };
  };
}
const a = await rig(process.argv[2]);
const b = await rig(process.argv[3]);
for (const to of ["eye", "chest"])
  for (const f of [30, 40])
    for (const y of to === "eye" ? [0, 4, 8, 12, 16] : [-40, -20, 0])
      for (const z of [-15, -5, 4, 14]) {
        const p = a(mk(3.3, to, [f, y, z]));
        const q = b(mk(3.3, to, [f, y, z]));
        if (process.env.ALL || Math.abs(p.deg - q.deg) > 0.5)
          console.log(to, f, y, z, `${p.deg.toFixed(1)}° ${p.thumb} → ${q.deg.toFixed(1)}° ${q.thumb}`, JSON.stringify(q.over));
      }
console.log("xong");
