// node link.mjs <gốc cây rig | goc> — trỏ node_modules/@stickman3d/* của repo video sang cây rig; `goc` trả về như cũ
import { readlinkSync, symlinkSync, unlinkSync } from "node:fs";
const V = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam/node_modules/@stickman3d";
const to = process.argv[2];
for (const p of ["cli", "fx", "mcp", "render", "rig", "sketch"]) {
  const l = `${V}/${p}`;
  const dest = to === "goc" ? `../../../../stickman-studio-3d-nhom-cam/packages/${p}` : `${to}/packages/${p}`;
  unlinkSync(l);
  symlinkSync(dest, l);
  console.log(p, "→", readlinkSync(l));
}
