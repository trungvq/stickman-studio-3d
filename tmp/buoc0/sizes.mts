// Cỡ tay (k, long) của mọi nhân vật repo video: cladHand như người 3D dựng
import fs from "node:fs";
import { parseCharacter, limbWidths } from "../../packages/rig/src/core/schema";
import { bones3, cladHand } from "../../packages/rig/src/core/act3";
const dir = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto/characters";
const rows: any[] = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const r = parseCharacter(JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8")));
  if (!r.success) { rows.push({ f, err: r.error.message.slice(0, 80) }); continue; }
  const c = r.data as any;
  if (!c.palette.clad) { rows.push({ f, clad: false }); continue; }
  const w = limbWidths(c.palette);
  const B = bones3(c.rig.height);
  const h = cladHand(w.sleeve, c.rig.stroke, B.foreArm * 100);
  rows.push({ f, k: +h.k.toFixed(4), long: +h.long.toFixed(4), height: c.rig.height, sleeve: w.sleeve, stroke: c.rig.stroke });
}
rows.sort((a, b) => (a.k ?? 0) - (b.k ?? 0));
console.table(rows);
fs.writeFileSync(new URL("./sizes.json", import.meta.url), JSON.stringify(rows, null, 1));
