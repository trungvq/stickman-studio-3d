import fs from "node:fs";
const [dir, checkFile] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(dir + "/lan-cam.json"));
const issues = fs.readFileSync(checkFile, "utf8").split("\n").filter((l) => /^(lỗi|cảnh báo)/.test(l));
const by = new Map();
for (const r of rows) { const s = by.get(r.scene) ?? { scene: r.scene, holds: 0, shots: 0 }; s.holds++; s.shots += r.secs.length; by.set(r.scene, s); }
const sc = [...by.values()]; // đã theo thứ tự tên
const total = sc.reduce((a, s) => a + s.shots, 0);
const los = Array.from({ length: 5 }, (_, i) => ({ lo: i + 1, scenes: [], holds: 0, shots: 0 }));
let acc = 0, k = 0;
for (const s of sc) {
  // chuyển lô khi cộng thêm cảnh này làm lệch xa mục tiêu hơn
  const target = (total * (k + 1)) / 5;
  if (k < 4 && acc + s.shots / 2 > target) k++;
  los[k].scenes.push(s.scene); los[k].holds += s.holds; los[k].shots += s.shots; acc += s.shots;
}
fs.writeFileSync(dir + "/lo.json", JSON.stringify(los, null, 1));
const sceneFiles = fs.readdirSync("/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam/scenes").filter((f) => /^t02-/.test(f)).map((f) => f.replace(/\.json$/, ""));
const free = sceneFiles.filter((s) => !by.has(s) && issues.some((l) => l.includes(`scenes/${s}.json`) && /tay|cổ tay|khuỷu|va chạm|chạm|cầm/.test(l)));
let md = "# Lần cầm tập 02\n\n| cảnh | người | tay | món@nhóm | t0–t1 | giây chụp | check |\n|---|---|---|---|---|---|---|\n";
for (const r of rows) md += `| ${r.scene} | ${r.cast} | ${r.side} | ${r.item}@${r.group}${r.part ? ":" + r.part : ""} | ${r.t0}–${r.t1} | ${r.secs.join(", ")} | ${r.issues.length ? r.issues.map((l) => l.split(":")[0] + ": " + (l.split("—")[0].split(".json:")[1] ?? "").trim()).join("; ") : ""} |\n`;
md += "\n## Lô\n\n| lô | số cảnh | lần cầm | khung chụp | cảnh |\n|---|---|---|---|---|\n";
for (const l of los) md += `| ${l.lo} | ${l.scenes.length} | ${l.holds} | ${l.shots} | ${l.scenes[0]} … ${l.scenes.at(-1)} |\n`;
md += `\n## Cảnh không có lần cầm nhưng check báo lỗi tay/cổ tay/va chạm\n\n${free.length ? free.map((s) => "- " + s).join("\n") : "Không có."}\n`;
fs.writeFileSync(dir + "/lan-cam.md", md);
console.log(JSON.stringify(los.map((l) => [l.lo, l.scenes.length, l.holds, l.shots])), "free", free);
