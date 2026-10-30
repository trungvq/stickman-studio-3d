// node nc.mjs <regex> [fps]: khung mà vòng lặp điểm bất động của solveCore (AIM_ITER) chạy hết mà không hội tụ
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const [re, fpsArg] = process.argv.slice(2);
const FPS = +(fpsArg ?? 30);
const STUDIO = process.env.STICKMAN_STUDIO ?? new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const root = process.env.JP_SUKATTO ?? new URL("../../youtube-video/jp-sukatto", new URL("..", import.meta.url)).pathname.replace(/\/$/, "");
const lib = await import(join(STUDIO, "packages/cli/lib.mjs"));
const rig = await import(join(STUDIO, "tmp/khuyu/rpnc/core.js"));
const ctx = await lib.deepContext({ dir: root, names: [], groups: [] });
const held = lib.loadHeld([join(root, "held"), lib.COMMON.held]);
const hands = lib.loadHands([join(root, "hands"), lib.COMMON.hands]);
const names = readdirSync(join(root, "scenes")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).filter((n) => new RegExp(re).test(n));
for (const name of names) {
  const r = rig.parseScene(JSON.parse(readFileSync(join(root, "scenes", `${name}.json`), "utf8")));
  if (!r.success) continue;
  const scene = r.data;
  const played = scene.cast.flatMap((m) => (m.character && ctx.charactersByName[m.character] ? [[m.id, ctx.charactersByName[m.character]]] : []));
  let rt;
  try {
    rt = rig.resolveScene(scene, ctx.actionsByName, ctx.animalsByName, ctx.props, Object.fromEntries(played.map(([i, c]) => [i, c.rig.height])), Object.fromEntries(played.map(([i, c]) => [i, rig.body3(c)])), held, hands);
  } catch { continue; }
  rt.chars = Object.fromEntries(played.map(([i, c]) => [i, rig.castCharacter(scene.cast.find((m) => m.id === i), c)]));
  const n = Math.floor(rt.duration * FPS + 1e-6);
  for (const m of scene.cast) {
    if (!m.world || !m.character || !ctx.charactersByName[m.character]) continue;
    const c = rig.castCharacter(m, ctx.charactersByName[m.character]);
    const b = rig.body3(c);
    let frames = 0, bad = 0, big = 0, worst = 0, at = 0, spans = [];
    for (let i = 0; i <= n; i++) {
      const t = i / FPS;
      globalThis.__nc = { conv: 0, nc: 0, last: 0 };
      try { rig.actArm(c, rig.sceneAt(rt, m.id, t, c.rig.height, b), -1); } catch { continue; }
      frames++;
      const g = globalThis.__nc;
      if (g.nc > 0) {
        bad++;
        const mv = g.last * 100; // three → rig (≈, chưa chia s)
        if (mv > 1) { big++; const l = spans[spans.length - 1]; if (l && t - l[1] <= 2 / FPS) l[1] = t; else spans.push([t, t]); }
        if (mv > worst) [worst, at] = [mv, t];
      }
    }
    if (bad) console.log([name, m.id, `frames ${frames}`, `nc ${bad}`, `nc>1 ${big}`, `worst ${worst.toFixed(2)} @${at.toFixed(2)}`, spans.slice(0, 6).map(([a, z]) => `${a.toFixed(2)}-${z.toFixed(2)}`).join(" ")].join("\t"));
  }
}
