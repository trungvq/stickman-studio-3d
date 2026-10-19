// Gộp kết quả ra do-b.json. Chạy: node tmp/buoc0/j-json.mjs
import fs from "node:fs";
const D = new URL("./", import.meta.url).pathname;
const J = (f) => JSON.parse(fs.readFileSync(`${D}${f}`, "utf8"));
const sw1 = J("j-cost.json"), sw0 = J("j-cost-sw0.json");
const rows = (md, re) => fs.readFileSync(`${D}${md}`, "utf8").split("\n").filter((l) => re.test(l));
const strip = (s) => { const { sh, wr, elbow0, ...r } = s ?? {}; return r; };
const cases = (R) => Object.fromEntries(["A", "A2", "B", "C"].map((id) => [id, Object.fromEntries(Object.entries(R[`sheet-${id}`]).map(([k, v]) => [k, {
  win: v.win, rows: v.rows.map((r) => ({ ...r, s: strip(r.s) })).sort((a, b) => a.cost.total - b.cost.total),
}]))]));
const coarse = rows("j-coarse.md", /^\| (A|A2|B|C) \| (act3|theo J) \|/).map((l) => {
  const c = l.split("|").map((x) => x.trim()).filter(Boolean);
  return { case: c[0], elbow: c[1], winTier: c[2], slant: +c[3], J: +c[4], winAdd: c[5], JAdd: +c[7], msA: +c[8], msB: +c[9], msTotal: +c[10] };
});
const mouth = rows("j-d-mouth.md", /^\| chai/).map((l) => l.split("|").map((x) => x.trim()).filter(Boolean));
const out = {
  setup: {
    scene: "tổng hợp: yota (cầm, yota.json) [250,0,790] yaw 90; khach (takumi.json) [250,0,445] yaw 270; stand-3d",
    samples: "ca kiểu cũ: 1 mẫu (một mốc t 0); lưới: 4 mẫu t 0/0,5/1/1,5, trọng 1/0,5/0,5/0,5",
    solve: "solveActing thật, act3.ts vá lúc gói (j-run.mjs): A = aimWrist fast + không thử khuỷu; B act3 = đường đủ; E = khuỷu tay chính dò theo J (17 lần giải/mẫu)",
    weightsSpec: sw1.weights, weightsFinal: sw0.weights, WIN: 0.25,
  },
  final: "khuỷu dò theo J, số hạng xoay khuỷu chỉ khi cảnh khai `elbow` (WSWIVEL=0 ở mọi ca vì không ca nào khai), slant thô ở bước A",
  cases: { swivelOn: cases(sw1), swivelOffNoElbow: cases(sw0) },
  grid: { swivelOn: sw1.timing, swivelOffNoElbow: sw0.timing, coarseSlantSwivelOff: coarse },
  bottle: { base: { swivelOn: sw1.D, swivelOffNoElbow: sw0.D }, mouthAnchorSwivelOn: mouth },
  us: { swivelOn: { ...sw1.us, solveOnly: sw1.usSolveOnly }, swivelOff: { ...sw0.us, solveOnly: sw0.usSolveOnly } },
};
fs.writeFileSync(`${D}do-b.json`, JSON.stringify(out, null, 1));
console.log("do-b.json", (JSON.stringify(out).length / 1024).toFixed(0), "KB", coarse.length, mouth.length);
