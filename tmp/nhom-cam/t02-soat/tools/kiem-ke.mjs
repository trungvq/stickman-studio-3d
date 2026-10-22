// Kiểm kê lần cầm của t02-*: node kiem-ke.mjs <thư mục scenes> <check-dau.txt> <ra>
import fs from "node:fs";
import path from "node:path";
const [dir, checkFile, out] = process.argv.slice(2);
const r2 = (x) => Math.round(x * 100) / 100;
const files = fs.readdirSync(dir).filter((f) => /^t02-.*\.json$/.test(f)).sort();
const resolveT = (t, marks) => {
  if (typeof t === "number") return t;
  const m = /^@([^+-]+)([+-][\d.]+)?$/.exec(t);
  if (!m || marks[m[1]] === undefined) return null;
  return marks[m[1]] + (m[2] ? Number(m[2]) : 0);
};
const key = (h) => `${h.item}@${h.group}${h.part ? ":" + h.part : ""}`;
const rows = [];
const scenes = {};
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f)));
  const name = d.name ?? f.replace(/\.json$/, "");
  const dur = d.duration;
  scenes[name] = dur;
  const marks = d.marks ?? {};
  for (const c of d.cast ?? []) {
    const hands = (c.world?.hands ?? [])
      .map((h, i) => ({ ...h, _t: resolveT(h.t, marks), i }))
      .filter((h) => h._t !== null)
      .sort((a, b) => a._t - b._t || a.i - b.i);
    for (const side of ["left", "right"]) {
      let cur = null;
      const close = (t1) => {
        if (!cur) return;
        cur.t1 = Math.min(t1, dur);
        rows.push(cur);
        cur = null;
      };
      for (const h of hands) {
        const s = h[side];
        if (!s || typeof s !== "object" || !("hold" in s)) continue;
        let hold = s.hold;
        if (typeof hold === "string") { const [item, group] = hold.split("@"); hold = { item, group }; }
        if (hold === null) { close(h._t); continue; }
        if (cur && key(cur.hold) === key(hold)) {
          cur.turns.push(h._t);
          cur.hold = hold;
          if (hold.both) cur.both = true;
          continue;
        }
        close(h._t);
        cur = { scene: name, cast: c.id, lead: side, hold, both: !!hold.both, turns: [], t0: h._t, dur };
      }
      close(dur);
    }
  }
  // mốc items theo (cast,item)
  for (const it of d.items ?? []) {
    const t = resolveT(it.t, marks);
    for (const r of rows) if (r.scene === name && r.cast === it.cast && r.hold.item === it.item && t !== null && t > r.t0 && t < r.t1) r.turns.push(t);
  }
}
// hai tay: hợp lần cầm lead có both
const issuesAll = fs.readFileSync(checkFile, "utf8").split("\n").filter((l) => /^(lỗi|cảnh báo)/.test(l));
const out2 = rows.map((r) => {
  const { t0, t1, dur } = r;
  const clamp = (x) => r2(Math.min(Math.max(x, 0), dur));
  const seg = t1 - t0;
  const shots = new Set([clamp(seg > 0.6 ? t0 + 0.3 : t0), clamp(t0 + seg / 2), ...r.turns.map((x) => clamp(x + 0.05 > t1 ? x : x + 0.05))]);
  let secs = [...shots].filter((x) => x >= t0 - 1e-6 && x <= t1 + 1e-6).sort((a, b) => a - b);
  if (secs.length > 4) {
    const keep = [secs[0], secs[secs.length - 1]];
    const mid = secs.slice(1, -1);
    while (keep.length < 4 && mid.length) keep.push(mid.splice(Math.floor(mid.length / 2), 1)[0]);
    secs = keep.sort((a, b) => a - b);
  }
  const side = r.both ? "hai tay" : r.lead === "left" ? "trái" : "phải";
  const sideRe = r.both ? /./ : r.lead === "left" ? /tay trái/ : /tay phải/;
  const issues = issuesAll.filter((l) => l.includes(`scenes/${r.scene}.json`) && l.includes("`" + r.cast + "`") && (r.both || sideRe.test(l) || !/tay (trái|phải)/.test(l)));
  return { scene: r.scene, cast: r.cast, side, lead: r.lead, item: r.hold.item, group: r.hold.group, part: r.hold.part ?? null, t0: r2(t0), t1: r2(t1), secs: secs.map(r2), issues };
});
fs.writeFileSync(path.join(out, "lan-cam.json"), JSON.stringify(out2, null, 1));
fs.writeFileSync(path.join(out, "scenes-dur.json"), JSON.stringify(scenes));
console.log(out2.length, "lần cầm,", new Set(out2.map((r) => r.scene)).size, "cảnh");
