// Sinh tmp/buoc0/do-a.md từ do-a.json. Chạy: node tmp/buoc0/do-a-md.mjs
import fs from "node:fs";
const dir = new URL("./", import.meta.url).pathname;
const j = JSON.parse(fs.readFileSync(`${dir}/do-a.json`, "utf8"));
const S = j.sizes.map((s) => s.key);
const f = (x, n = 2) => (x === null || x === undefined || !isFinite(x) ? "—" : (+x).toFixed(n).replace(".", ","));
const L = [];
const row = (...c) => L.push(`| ${c.join(" | ")} |`);
const head = (...c) => {
  row(...c);
  row(...c.map(() => "---"));
};

L.push("# Bước 0 — đo A: bàn tay mới (ngón cái giai đoạn 1)", "");
L.push(`Nguồn: \`packages/rig/src/core/*.ts\` (mã nguồn, gói esbuild — không có \`tsx\`), \`held/\` của \`jp-sukatto\` (\`auto/t02-build\`). Đơn vị rig, cỡ người \`s = 1\`. Số đủ ở \`do-a.json\`, fixture ở \`fixtures.json\`.`, "");
L.push("## Cỡ", "");
head("Khoá", "k", "long", "ghi chú");
for (const s of j.sizes) row(`\`${s.key}\``, f(s.k, 4), f(s.long, 4), s.note);
L.push("");

L.push("## 1. W, A, L, P", "");
head("Cỡ", "W", "W/k", "A tâm–tâm", "A/k (spec 9,76)", "A mặt nang", "A da (min)", "L tâm", "L/long (spec 17,9)", "L da/long", "P/long (spec 10,1)");
for (const k of S) {
  const d = j.dims[k];
  row(`\`${k}\``, f(d.W), f(d.W_k), f(d.A_centre), f(d.A_centre_k, 3), f(d.A_caps), f(d.A_skin_min), f(d.L_centre), f(d.L_centre_long, 3), f(d.L_skin_long, 3), f(d.P_long));
}
L.push("", "A tâm–tâm: tâm đầu đốt ngọn ngón cái ↔ ngón trỏ (`handFrames`, dáng `open`); mặt nang: trừ hai `pieceRadius`; da: đỉnh da gần nhau nhất của nửa ngoài hai đốt ngọn. L da: đỉnh da `index1` xa cổ tay nhất, dáng nghỉ.", "");

L.push("## 2. `sheet`: độ thụt của `bang-gia#doc` (tay phải; tay trái trùng)", "");
head("Cỡ", "W", "Tâm nắm (= `at`)", "÷ W", "Ngón cái: khe da", "sâu", "Đầu ngón cái", "Đầu trỏ", "Đầu giữa", "Gốc trỏ", "Ngón chạm: sâu nhất", "trung bình", "÷ W");
for (const k of S) {
  const d = j.sheetD[k].right;
  const ft = d.contact.fingers;
  row(`\`${k}\``, f(d.W), f(d.gripCentreDepth), f(d.gripCentreDepth / d.W, 3), f(d.nearest.thumb.gap), f(d.nearest.thumb.depth), f(d.tips.thumb.depth), f(d.tips.index.depth), f(d.tips.middle.depth), f(d.roots.index.depth), f(ft.max), f(ft.mean), f(ft.max / d.W, 3));
}
L.push("", "Sâu = khoảng từ mép `edgeR` vào trong tấm (âm là ngoài mép). Ngón chạm: đỉnh da trỏ–út cách tấm ≤ 0,3, sau `heldFit`. Ngón cái không có đỉnh da nào ≤ 0,3 ở mọi cỡ trừ `t01-sakura` (1 đỉnh).", "");

L.push("## 3. Hệ số lòng tay `sheet pinch` từ `bang-gia#doc`", "");
const pc = j.palmCoef;
head("Tay", "n (khung món)", "F", "f chiếu lên mặt tấm", "a", "b", "dư", "góc tấm–lòng tay", "slant (từ −m)");
for (const sd of ["right", "left"]) {
  const p = pc[sd];
  row(sd === "right" ? "phải" : "trái", `[${p.n.map((x) => f(x, 4)).join("; ")}]`, "[0; 1; 0] (`front`)", `[${p.f_proj.map((x) => f(x, 4)).join("; ")}]`, f(p.a, 4), f(p.b, 4), f(p.residual, 4), `${f(p.sheetToPalmDeg, 1)}°`, `${f(p.slantDeg, 1)}°`);
}
L.push("", "Không phụ thuộc cỡ tay: phép quay của `GripFrame` chỉ đọc `palm`, `fingers` của JSON.", "");

L.push("## 4. δ lồi da từng đốt ở dáng gốc", "");
L.push("Đỉnh da có trọng số lớn nhất ở đốt → mặt nang chưa phình (`pieceRadius`; lòng tay: năm dải + gò ngón cái của `handCapsules` với bán kính chưa phình). Lấy max mỗi dáng, rồi min–max qua 9 dáng của các fixture (`sheet edge pinch cup grip clasp hook span flat`), hai tay.", "");
head("Đốt", ...S.map((k) => `\`${k}\``), "max ÷ k (`2.16`)", "phía lòng tay, max (`2.16`)", "t ở max");
for (const p of Object.keys(j.bulge["1"])) {
  const c = S.map((k) => `${f(j.bulge[k][p].min)}–${f(j.bulge[k][p].max)}`);
  const b = j.bulge["2.16"][p];
  row(`\`${p}\``, ...c, f(b.max / 2.16), f(b.palmarMax), `${f(b.tAtMax[0])}–${f(b.tAtMax[1])}`);
}
L.push("", "t: vị trí dọc đốt của đỉnh lồi nhất (0 gốc, 1 ngọn; lòng tay: từ cổ tay tới hàng khớp gốc ngón).", "");

L.push("## 5. Baseline `heldFit` hiện có", "");
L.push("`heldFit` một lần với dáng của kiểu cầm, rồi đo: lún trên da (mục 7 bản mới, đỉnh da sâu nhất trong hình), khe nang đã nới (`fitCapsules`, như `check` nay) nhỏ nhất theo nhóm, `pierce` (trục nang vào hình, `core`). ms: trung vị 15 lần, một bàn tay. Cột theo cỡ `1.61` / `t01-sakura` / `kuroiwa`.", "");
head("Kiểu", "Tay", "Dáng", "Vai", "Lún da (đốt) 1,61", "sakura", "kuroiwa", "Nang nới min (nhóm) 1,61", "pierce core 1,61", "ms 1,61", "ms sakura", "ms kuroiwa");
for (const [key, b] of Object.entries(j.baseline))
  for (const sd of ["right", "left"]) {
    const h = b["1.61"][sd];
    if (!h) continue;
    const sk = (k) => (b[k][sd].skin ? `${f(b[k][sd].skin.depth)} (${b[k][sd].skin.piece})` : "—");
    const g = h.audit ? Object.entries(h.audit.gaps).sort((a, c) => a[1] - c[1])[0] : undefined;
    row(`\`${key}\``, sd === "right" ? "P" : "T", h.pose, h.role, sk("1.61"), sk("t01-sakura"), sk("kuroiwa"), g ? `${f(g[1])} (${g[0]})` : "—", h.audit ? f(h.audit.pierce.core) : "—", f(h.ms), f(b["t01-sakura"][sd].ms), f(b.kuroiwa[sd].ms));
  }
L.push("", "Lún da dương là da trong hình; âm là khe (không đỉnh nào chạm). `pierce` dương là trục nang vào trong hình (ngưỡng `HELD_PIERCE_FIT` 0,5).", "");

L.push("## Fixture", "");
L.push(`\`fixtures.json\`: ${Object.keys(j.baseline).length} kiểu, mỗi kiểu \`size\`, \`hands\` (\`one\`/\`both\`, \`lead\`), và theo từng khoá cỡ \`{ right, left: GripFrame + pose, role, wrap, centre { hand, item }, palm, fingers }, pose, centre, k, long }\`. Kiểu hai tay: tay \`lead\` là \`gripHand\`, tay kia \`both.other\` (đích của bộ giải, món theo tay \`lead\`). Thiếu: ${j.missing.length ? j.missing.join("; ") : "không"}.`, "");
L.push("## Lệch so với spec", "");
L.push(
  "- `1,61`, `2,16` của spec là `k · height` (cách `bang-cam` xếp người), không phải cỡ tay: người thật là `t01-sakura` `k 1,75, long 1,545` và `kuroiwa` `k 2, long 1,813`. Món và bàn tay cùng nhân `s`, chiều cao không nhân bàn tay, nên so với món `W` là 14,7 / 16,8, không phải 13,5 / 18,1.",
  "- `A` lẫn bề ngang (`k`) và dọc (`long`): `9,76 · k` chỉ đúng khi `long = k`; tay thật ra 8,71 · k và 8,93 · k.",
  "- `bang-gia#doc` đặt tâm nắm cố định 2,5 từ mép ở mọi cỡ (`d / W` = 0,30 → 0,14), không tỉ lệ `W`. Không định nghĩa nào trong bảng 2 ra lại 3 / 5,75 / 6,25; gần nhất là sâu của đầu ngón cái (3,75 / 4,16 sakura / 4,52 kuroiwa).",
  "- Ngón cái không chạm tấm ở `bang-gia#doc`: khe da 0,30–1,28, `heldFit` (thumb trong `wrap`) không tìm được góc cuộn chạm trong 75°. Khung nang nới (`check` nay) vẫn báo ngón cái lún tới 0,2 ở cỡ `1` và sakura.",
  "- `but#viet` tay trái (không có `left`): bút xuyên lòng tay, da lún 0,9–1,3, `pierce` core 0,2–0,7.",
  "- `chen#kep`: lòng tay lún 1,5–3,5 trên da ở mọi cỡ. `chai-dia#co`: `thumb1` lún 0,36–1,44. `khay#bung`: lòng tay lún 1,4–1,5.",
  "- δ lớn nhất ở `thumb0` (gò ngón cái, 1,3–1,85 · k) và lòng tay (0,9–1,3 · k, ở hàng khớp gốc ngón); đốt ngọn gần 0 ở dáng duỗi, tới 0,7 · k ở `pinch`. δ không tỉ lệ đều theo `k` khi `long < k`.",
  "- `heldFit` chậm nhất `tui#xach` 11–12 ms (10 khối hình), `chai-dia#co` 5,6–5,8, `tom-hum#nhac` 4,2–4,5 — cao hơn số 1,75–4,16 của spec mục 6.6.",
  "",
);
fs.writeFileSync(`${dir}/do-a.md`, L.join("\n") + "\n");
console.log(L.join("\n"));
