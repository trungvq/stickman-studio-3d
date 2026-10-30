// node iter.mjs <scenesDir> <scene> <id> <hand> <t0> <t1> : so khuỷu/cổ tay giữa bản rig gốc (AIM_ITER 8) và bản vá 9, 31
import { readFileSync } from "node:fs";
import { join } from "node:path";
const [dir, name, id, hand, t0, t1] = process.argv.slice(2);
const STUDIO = process.env.STICKMAN_STUDIO ?? new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const lib = await import(join(STUDIO, "packages/cli/lib.mjs"));
const root = process.env.JP_SUKATTO ?? new URL("../../youtube-video/jp-sukatto", new URL("..", import.meta.url)).pathname.replace(/\/$/, "");
const ctx = await lib.deepContext({ dir: root, names: [], groups: [] });
const held = lib.loadHeld([join(root, "held"), lib.COMMON.held]);
const hands = lib.loadHands([join(root, "hands"), lib.COMMON.hands]);
const raw = readFileSync(join(dir, `${name}.json`), "utf8");
const cores = { 8: join(STUDIO, "packages/rig/dist/core/index.js"), 9: join(STUDIO, "tmp/khuyu/rp9/core.js"), 31: join(STUDIO, "tmp/khuyu/rp31/core.js") };
const out = {};
for (const [k, p] of Object.entries(cores)) {
  const rig = await import(p);
  const scene = rig.parseScene(JSON.parse(raw)).data;
  const played = scene.cast.flatMap((m) => (m.character && ctx.charactersByName[m.character] ? [[m.id, ctx.charactersByName[m.character]]] : []));
  const rt = rig.resolveScene(scene, ctx.actionsByName, ctx.animalsByName, ctx.props, Object.fromEntries(played.map(([i, c]) => [i, c.rig.height])), Object.fromEntries(played.map(([i, c]) => [i, rig.body3(c)])), held, hands);
  rt.chars = Object.fromEntries(played.map(([i, c]) => [i, rig.castCharacter(scene.cast.find((m) => m.id === i), c)]));
  const m = scene.cast.find((x) => x.id === id);
  const c = rig.castCharacter(m, ctx.charactersByName[m.character]);
  const b = rig.body3(c);
  out[k] = [];
  for (let t = +t0; t <= +t1 + 1e-9; t += 1 / 60) {
    const A = rig.actArm(c, rig.sceneAt(rt, id, t, c.rig.height, b), hand === "right" ? -1 : 1);
    out[k].push({ t, E: A.E.map((x) => x * 100), W: A.W.map((x) => x * 100), wrist: A.wrist });
  }
}
const f = (v) => v.map((x) => x.toFixed(1)).join(",");
for (let i = 0; i < out[8].length; i++)
  console.log(out[8][i].t.toFixed(4), "| it8 E", f(out[8][i].E), "W", f(out[8][i].W), "wr", f(out[8][i].wrist), "| it9 E", f(out[9][i].E), "wr", f(out[9][i].wrist), "| it31 E", f(out[31][i].E), "wr", f(out[31][i].wrist));
