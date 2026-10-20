// node probe.mjs <scene.json> t1,t2,... -> per-time wrist over/off for both hands, body overlap
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const V = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam";
const S = "/home/trungvq/Work/Dev/stickman-studio-3d-nhom-cam";
const rig = await import(join(S, "packages/sketch/dist/index.js"));
const { loadHeld, castChars } = await import(join(S, "packages/cli/lib.mjs"));
const rd = (p) => JSON.parse(readFileSync(p, "utf8"));
const actions = {};
for (const d of [join(S, "apps/studio/public/actions"), join(V, "actions")])
  for (const f of readdirSync(d).filter((f) => f.endsWith(".json"))) {
    const r = rig.parseAction(rd(join(d, f))); if (r.success) actions[f.replace(/\.json$/, "")] = r.data;
  }
const held = loadHeld([join(V, "held"), join(S, "apps/studio/public/held")]);
const chars = {};
for (const d of [join(S, "apps/studio/public/characters"), join(V, "characters")])
  for (const f of readdirSync(d).filter((f) => f.endsWith(".json"))) {
    const r = rig.parseCharacter(rd(join(d, f))); if (r.success) chars[f] = r.data;
  }
export function probe(sceneJson, times) {
  const r = rig.parseScene(sceneJson); if (!r.success) return { err: r.error.message.slice(0, 300) };
  const sc = r.data;
  const c = chars[sc.cast[0].character];
  let rt; try { rt = rig.resolveScene(sc, actions, {}, {}, { takumi: c.rig.height }, { takumi: rig.body3(c) }, held); } catch (e) { return { err: e.message.slice(0, 200) }; }
  const ch = castChars(sc, chars);
  const out = [];
  for (const t of times) {
    const row = { t };
    for (const side of ["right", "left"]) {
      try {
        const g = rig.graspAtTime(rt, "takumi", side, t, { chars: ch });
        if (g) { const a = g.arm ?? g; const w = a.wrist ?? {}; row[side] = { over: +Math.max(...Object.values(w.over).map(Math.abs)).toFixed(1), turn: Math.round(w.turn), bend: Math.round(w.bend), dev: Math.round(w.dev), body: +(a.body ?? 0).toFixed(1), gap: +(a.gap ?? 0).toFixed(1), ch: g.choice && [g.choice.edge, g.choice.thumb, g.choice.variant, g.choice.along, g.choice.slant].join(" ") }; }
      } catch (e) { row[side] = { err: e.message.slice(0, 120) }; }
    }
    out.push(row);
  }
  return { out };
}
if (process.argv[1].endsWith("probe.mjs") && process.argv[2]) {
  const res = probe(rd(process.argv[2]), process.argv[3].split(",").map(Number));
  if (res.err) console.log("ERR", res.err);
  else for (const d of res.out) console.log(d.t, ["right", "left"].filter((k) => d[k]).map((k) => { const v = d[k]; return v.err ? k[0] + ":" + v.err : `${k[0]}:o${v.over} b${v.body} g${v.gap} [${v.turn},${v.bend},${v.dev}] ${v.ch}`; }).join("  |  "));
}
