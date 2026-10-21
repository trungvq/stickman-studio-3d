// node do-s012.mjs <dist/core/index.js> <cảnh.json> [giây,…] — lựa chọn, cổ tay, khe tầm với của thẻ phòng s012 (yota trái, takumi phải)
import { readFileSync, readdirSync, existsSync } from "node:fs";
const core = await import(process.argv[2]);
const V = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam";
const j = (p) => JSON.parse(readFileSync(p, "utf8"));
const scene = core.parseScene(j(process.argv[3]));
if (!scene.success) throw new Error(scene.error.message);
const acts = {};
for (const dir of [new URL("../../../apps/studio/public/actions", import.meta.url).pathname, `${V}/actions`])
  if (existsSync(dir))
    for (const f of readdirSync(dir, { recursive: true }))
      if (String(f).endsWith(".json")) {
        const a = core.parseAction(j(`${dir}/${f}`));
        if (a.success) acts[String(f).split("/").pop().slice(0, -5)] = a.data;
      }
const chars = {}, H = {}, D = {};
for (const m of scene.data.cast) {
  const c = core.parseCharacter(j(`${V}/characters/${m.character ?? `${m.id}.json`}`));
  chars[m.id] = c.data;
  H[m.id] = c.data.rig.height;
  D[m.id] = core.body3(c.data);
}
const held = {};
for (const f of readdirSync(`${V}/held`)) if (f.endsWith(".json")) held[f.slice(0, -5)] = core.parseHeldItem(j(`${V}/held/${f}`)).data;
const rt = core.resolveScene(scene.data, acts, {}, {}, H, D, held);
const ts = (process.argv[4] ?? "5.3,5.45,5.6,5.8,6.0,6.02,6.06,6.4,6.6,6.7,6.8,7.0,7.2,7.4").split(",").map(Number);
const r1 = (v) => Math.round(v * 10) / 10;
for (const [id, side] of [["yota", "left"], ["takumi", "right"]])
  for (const t of ts) {
    const s = core.graspAtTime(rt, id, side, t, { chars });
    if (!s) continue;
    const w = s.arm.wrist;
    const it = core.itemAt(rt, "the-phong", t, { chars });
    console.log(
      id, t, JSON.stringify(Object.fromEntries(["edge", "thumb", "variant", "along", "slant", "tilt"].map((k) => [k, s.choice[k]]))),
      `cổ tay t${r1(w.turn)} b${r1(w.bend)} d${r1(w.dev)} vượt ${r1(Math.max(w.over.turn, w.over.bend, w.over.dev))}`,
      `khe ${r1(s.arm.gap)} φ ${r1(s.arm.phi)}${s.still ? " (nằm)" : ""}`,
      it ? `món ${it.P.map(r1)}` : "",
    );
  }
