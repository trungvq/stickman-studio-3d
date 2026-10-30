// Phân tích dump của harness: node analyze.cjs <dir> [regex file] → bảng sự kiện theo loại
const fs = require("fs");
const path = require("path");
const dir = process.argv[2];
const re = new RegExp(process.argv[3] ?? ".");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsv") && re.test(f));
const rows = [];
const tally = {};
const add = (k, n = 1) => (tally[k] = (tally[k] ?? 0) + n);
const pathOf = (r) => (r.placed ? "placed" : r.hold ? "hold" : r.lock > 0 ? "lock" : r.aim ? "aim" : r.drive);
for (const f of files) {
  const L = fs.readFileSync(path.join(dir, f), "utf8").trim().split("\n");
  const H = L[0].split("\t");
  const R = L.slice(1).map((l) => {
    const v = l.split("\t");
    const o = {};
    H.forEach((h, i) => (o[h] = ["drive"].includes(h) ? v[i] : +v[i]));
    return o;
  });
  const id = f.replace(/^dump-/, "").replace(/\.tsv$/, "");
  const ev = [];
  const fps = Math.round(1 / (R[1].t - R[0].t));
  // khung của tay theo đích / món
  const tgt = R.filter((r) => r.drive !== "fk").length;
  add("trackFrames", R.length);
  add("targetFrames", tgt);
  // 1. lật: một khung xoắn > 30°, hay 0,1 s cộng > 60°; cổ tay lệch/xoay nhảy
  const win = Math.round(fps / 10);
  for (let i = 1; i < R.length; i++) {
    const r = R[i], p = R[i - 1];
    if (r.relW > 25) continue; // cổ tay nhảy cả khúc: cắt cảnh / mốc null, không tính
    let cum = 0;
    for (let j = Math.max(1, i - win + 1); j <= i; j++) cum += R[j].sw;
    if (Math.abs(r.sw) > 30 || Math.abs(cum) > 60)
      ev.push({ kind: "flip", t: r.t, v: Math.abs(r.sw) > 30 ? r.sw : cum, px: r.pxE, on: r.on, path: pathOf(r), ratio: r.ratio });
    const dDev = Math.abs(r.dev - p.dev), dTurn = Math.abs(r.turn - p.turn), dBend = Math.abs(r.bend - p.bend);
    if ((dDev > 35 || dTurn > 60 || dBend > 60) && r.relW < 3)
      ev.push({ kind: "wristflip", t: r.t, v: Math.max(dDev, dTurn, dBend), px: r.pxE, on: r.on, path: pathOf(r), detail: `turn ${p.turn}→${r.turn} bend ${p.bend}→${r.bend} dev ${p.dev}→${r.dev}` });
  }
  // 2. giật: cửa sổ 0,5 s, ≥3 lần đổi dấu xoắn (mỗi bên ≥ 0,5°), không có khung > 25°, net < nửa tổng
  const W = Math.round(fps / 2);
  for (let i = W; i < R.length; i++) {
    const w = R.slice(i - W + 1, i + 1);
    let rev = 0, abs = 0, net = 0, max = 0, px = 0, relW = 0;
    for (let j = 1; j < w.length; j++) {
      const [a, b] = [w[j - 1].sw, w[j].sw];
      if (Math.abs(a) >= 0.5 && Math.abs(b) >= 0.5 && Math.sign(a) !== Math.sign(b)) rev++;
      abs += Math.abs(b);
      net += b;
      max = Math.max(max, Math.abs(b));
      px += Number.isFinite(w[j].pxE) ? w[j].pxE : 0;
      relW += w[j].relW;
    }
    if (rev >= 3 && max <= 25 && Math.abs(net) < 0.5 * abs && abs > 4)
      ev.push({ kind: "jitter", t: w[w.length - 1].t, v: rev, abs, px: px / (W - 1), relW: relW / (W - 1), on: w[w.length - 1].on, path: pathOf(w[w.length - 1]), ratio: w[w.length - 1].ratio });
  }
  // micro: đổi dấu ở mức 0,05–0,5° (lượng tử refineMin) — đếm khung
  let micro = 0;
  for (let i = 1; i < R.length; i++) {
    const [a, b] = [R[i - 1].sw, R[i].sw];
    if (Math.abs(a) >= 0.05 && Math.abs(b) >= 0.05 && Math.sign(a) !== Math.sign(b) && Math.max(Math.abs(a), Math.abs(b)) < 0.5) micro++;
  }
  add("microRev", micro);
  // 3. khuỷu ngược
  for (const r of R) {
    if (r.drive === "fk") continue;
    if (r.inward > 0.3) ev.push({ kind: "inward", t: r.t, v: r.inward, on: r.on, path: pathOf(r) });
    if (r.ratio > 0.97) ev.push({ kind: "straight", t: r.t, v: r.ratio, on: r.on, path: pathOf(r) });
    if (r.ratio < 0.35) ev.push({ kind: "close", t: r.t, v: r.ratio, on: r.on, path: pathOf(r) });
    if (r.body > 0.5) ev.push({ kind: "body", t: r.t, v: r.body, on: r.on, path: pathOf(r) });
  }
  // gộp thành quãng theo loại
  const byKind = {};
  for (const e of ev) (byKind[e.kind] ??= []).push(e);
  for (const [kind, es] of Object.entries(byKind)) {
    es.sort((a, b) => a.t - b.t);
    let cur;
    const gap = kind === "jitter" ? 0.1 : 3 / fps;
    for (const e of es) {
      if (cur && e.t - cur.to <= gap + 1e-6) {
        cur.to = e.t;
        cur.n++;
        cur.on = Math.max(cur.on, e.on);
        if (Math.abs(e.v) > Math.abs(cur.peak)) Object.assign(cur, { peak: e.v, at: e });
      } else {
        cur && rows.push(cur);
        cur = { id, kind, from: kind === "jitter" ? +(e.t - 0.5).toFixed(3) : e.t, to: e.t, n: 1, peak: e.v, at: e, on: e.on };
      }
    }
    cur && rows.push(cur);
  }
}
for (const r of rows) {
  add(`${r.kind}:spans`);
  add(`${r.kind}:${r.at.path}`);
  if (r.on) add(`${r.kind}:onScreen`);
}
const json = process.argv.includes("--json");
if (json) console.log(JSON.stringify({ rows, tally }));
else {
  for (const r of rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id) || a.from - b.from))
    console.log([r.kind, r.id, `${r.from}-${r.to}`, typeof r.peak === "number" ? r.peak.toFixed(2) : r.peak, r.at.path, `on=${r.on}`, r.at.px !== undefined ? `px=${(+r.at.px).toFixed(1)}` : "", r.at.ratio !== undefined ? `ratio=${(+r.at.ratio).toFixed(2)}` : "", r.at.detail ?? ""].join("\t"));
  console.log(tally);
}
