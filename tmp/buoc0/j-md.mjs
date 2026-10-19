// Dựng bảng của do-b.md từ j-cost.json (và j-d-mouth.md). Chạy: node tmp/buoc0/j-md.mjs > tmp/buoc0/j-tables.md
import fs from "node:fs";
const D = new URL("./", import.meta.url).pathname;
const R = JSON.parse(fs.readFileSync(`${D}${process.argv[3] ?? "j-cost.json"}`, "utf8"));
// ca A–C lấy từ file thứ hai nếu có (vd. j-cost-sw0.json: số hạng xoay khuỷu tắt khi cảnh không khai `elbow`)
const S = process.argv[2] ? JSON.parse(fs.readFileSync(`${D}${process.argv[2]}`, "utf8")) : R;
const f = (x, n = 2) => (x === undefined || x === null ? "" : (+x).toFixed(n).replace(".", ","));
const out = [];
const log = (s = "") => out.push(s);

const CASE = {
  A: "A — đọc, offset spec `chest + [30, 10, 15]`, `front → holderFace`; kỳ vọng front",
  A2: "A2 — đọc, tay hạ `chest + [30, 50, 15]`; kỳ vọng front",
  B: "B — giơ một tay, `chest + [45, 30, 25]`, `front → {cast: khach}`; kỳ vọng back",
  C: "C — giơ hai tay, `chest + [45, 30, 10]`, tay phụ trái; kỳ vọng back/back",
};
for (const id of ["A", "A2", "B", "C"]) {
  const blk = S[`sheet-${id}`];
  const rows = [...blk["E-slant"].rows].sort((a, b) => a.cost.total - b.cost.total);
  const two = id === "C";
  log(`### ${CASE[id]}`);
  log();
  log("Bước B, khuỷu dò theo J, slant giải. `up` là nhóm `platform`, in ra nhưng không dự chọn.");
  log();
  log(`| Ứng viên | cạnh | cái | slant | J | ý định | cổ tay | tay | khuỷu | ${two ? "tay phụ | " : ""}thân | prefer | turn / bend / dev | kẹp | e° / ρ° | swivel |`);
  log(`|---|---|---|---|---|---|---|---|---|${two ? "---|" : ""}---|---|---|---|---|---|`);
  for (const r of rows) {
    const c = r.cost, s = r.s;
    log(`| \`${r.name}\` | ${r.edge} | ${r.thumb} | ${f(r.slant, 0)} | **${f(c.total)}** | ${f(c.intent)} | ${f(c.wrist)} | ${f(c.arm)} | ${f(c.elbow)} | ${two ? f(c.support) + " | " : ""}${f(c.body)} | ${f(c.prefer, 3)} | ${f(s.turn, 0)} / ${f(s.bend, 0)} / ${f(s.dev, 0)} | ${s.clamps}${s.sup ? "/" + s.sup.clamps : ""} | ${f(s.e, 0)} / ${f(s.rho, 0)} | ${f(s.swivel, 0)} |`);
  }
  log();
  log("| Bước B | slant | thắng (WIN 0,2 / 0,25 / 0,3 cùng kết quả) | J | phương án kế (bậc khác) | Δ |");
  log("|---|---|---|---|---|---|");
  for (const k of ["B-fixed", "B-slant", "E-fixed", "E-slant"]) {
    const b = S[`sheet-${id}`][k];
    const w = b.win[1];
    const same = b.win.every((x) => x.win === w.win);
    const st = w.steps[0] ?? "";
    const m = st.match(/^bậc \d+: (\S+) ([\d.]+) vs (\S+) ([\d.]+) → Δ (-?[\d.]+)/);
    const J = b.rows.find((r) => r.name === w.win)?.cost.total;
    const other = m ? (m[1] === w.win ? `\`${m[3]}\` ${f(+m[4])}` : `\`${m[1]}\` ${f(+m[2])}`) : "";
    log(`| ${k.startsWith("B") ? "khuỷu act3" : "khuỷu theo J"} | ${k.endsWith("slant") ? "giải" : "0"} | \`${w.win}\` s${f(w.slant, 0)}${same ? "" : " (đổi theo WIN)"} | ${f(J)} | ${other} | ${m ? f(Math.abs(+m[5])) : ""} |`);
  }
  log();
}

// lưới
log("### Lưới kiểu spec: 4 cạnh × 2 ngón cái × {pinch, flat, rim} × along {0,25; 0,5; 0,75}, 4 mẫu (t 0; 0,5; 1; 1,5)");
log();
log("Bước B lấy ứng viên tốt nhất của 8 tổ hợp rời đứng đầu sau A, cộng tổ hợp ưu tiên tốt nhất. \"Bậc\": thắng theo từng bậc như spec; \"cộng\": J + WIN · (số lựa chọn rời khác ưu tiên).");
log();
log("| Ca | khuỷu B | slant | thắng, bậc WIN 0,25 | J | bậc WIN 0,3 | cộng WIN 0,25 | J + phạt | ms A | ms B | ms tổng |");
log("|---|---|---|---|---|---|---|---|---|---|---|");
const off = (n) => {
  const [, thumb, variant] = n.split("/");
  return (thumb !== "front" ? 1 : 0) + (variant !== "pinch" ? 1 : 0);
};
const GRID = {};
for (const [k, v] of Object.entries(R.timing)) {
  const [id, mode, sl] = k.split("-");
  const add = v.topB.map((t) => ({ ...t, Jp: t.J + 0.25 * off(t.name) })).sort((a, b) => a.Jp - b.Jp)[0];
  GRID[k] = { add: add.name, addSlant: add.slant, addJ: add.Jp };
  log(`| ${id} | ${mode === "B" ? "act3" : "theo J"} | ${sl === "slant" ? "giải" : "0"} | \`${v.win}\` s${v.winSlant} | ${f(v.winJ)} | \`${v.win30}\` s${v.win30Slant} | \`${add.name}\` s${add.slant} | ${f(add.Jp)} | ${f(v.msA, 0)} | ${f(v.msB, 0)} | ${f(v.msTotal, 0)} |`);
}
log();

// D
log("### D — chai rót, neo `item:base` ở `chest + [tiến, 40, 20]`, `face: mouth → [1, 0, 0,58]`, `tilt −25`, một tay");
log();
for (const item of ["chai-dia"]) {
  for (const fwd of [10, 40, 70]) {
    const rows = [...R.D[`${item}-E`].find((x) => x.fwd === fwd).rows].sort((a, b) => a.cost.total - b.cost.total);
    log(`\`${item}\`, tiến ${fwd}, khuỷu theo J:`);
    log();
    log("| Ứng viên | along | J | ý định | cổ tay | tay | khuỷu | thân | turn / bend / dev | kẹp | e° | gap | ε | β° |");
    log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const r of rows) {
      const c = r.cost, s = r.s;
      log(`| \`${r.name}\` | ${f(r.along)} | **${f(c.total)}** | ${f(c.intent)} | ${f(c.wrist)} | ${f(c.arm)} | ${f(c.elbow)} | ${f(c.body)} | ${f(s.turn, 0)} / ${f(s.bend, 0)} / ${f(s.dev, 0)} | ${s.clamps} | ${f(s.e, 0)} | ${f(s.gap, 1)} | ${f(s.eps)} | ${f(s.beta, 0)} |`);
    }
    log();
  }
}
log("Quét khoảng tiến (thắng; J `co` / `rot` / `rot-than` / `bung`; `xem` trùng `co` — xoay quanh trục chai, ý định không có `roll`):");
log();
log("| Món | khuỷu | " + R.D["chai-dia-E"].map((x) => `tiến ${x.fwd}`).join(" | ") + " |");
log("|---|---|" + R.D["chai-dia-E"].map(() => "---").join("|") + "|");
for (const item of ["chai-dia", "chai-dac-tuyen"])
  for (const mode of ["B", "E"]) {
    const cells = R.D[`${item}-${mode}`].map((x) => {
      const best = [...x.rows].sort((a, b) => a.cost.total - b.cost.total)[0];
      const J = (n) => f(x.rows.find((r) => r.name === n).cost.total, 1);
      return `**${best.name}** ${J("co")}/${J("rot")}/${J("rot-than")}/${J("bung")}`;
    });
    log(`| \`${item}\` | ${mode === "B" ? "act3" : "theo J"} | ${cells.join(" | ")} |`);
  }
log();
fs.writeFileSync(`${D}j-grid-add.json`, JSON.stringify(GRID, null, 1));
console.log(out.join("\n"));
