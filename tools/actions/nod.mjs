// Gật hai nhịp. Chạy `node tools/actions/nod.mjs`; bản một cú `nod-once-3d` soạn tay.
import { emit } from "./emit.mjs";

/** Góc gật ở nhịp một, giữa hai nhịp, nhịp hai; mốc ở 0,25 / 0,5 / 0,7 */
const ROWS = [
  {
    name: "nod-soft-3d",
    nods: [9, 1, 6],
    duration: 1.1,
    use: "đồng tình ngầm, người nghe, người nền",
  },
  { name: "nod-3d", nods: [14, 2, 10], duration: 1, use: '"vâng", "đúng rồi"' },
  { name: "nod-big-3d", nods: [22, 2, 16], duration: 1, use: '"vâng!" dứt khoát, hiểu ra' },
];

const nod = (x) => ({ head: [null, null, x] });

await emit(
  ROWS.map((r) => ({
    name: r.name,
    duration: r.duration,
    end: "hold",
    authoredAt: "side",
    mask: ["head"],
    keys: [
      { t: 0, pose: nod(0), ease: "smooth" },
      { t: 0.25, pose: nod(r.nods[0]), ease: "smooth" },
      { t: 0.5, pose: nod(r.nods[1]), ease: "smooth" },
      { t: 0.7, pose: nod(r.nods[2]), ease: "smooth" },
      { t: 1, pose: nod(0) },
    ],
    note: `Gật hai nhịp rồi về (${r.use}): ${r.nods[0]}° ở 0,25, còn ${r.nods[1]}° ở 0,5, ${r.nods[2]}° ở 0,7, về 0 ở 1; lượt ${String(r.duration).replace(".", ",")} s, giữ. Chỉ ghi góc gật của \`head\`, nghiêng và lắc để trống. Nền \`stand-3d\`, ngồi thì \`sit-3d\`. Chồng lên \`turn-head-*\`, \`look-around-*\` vẫn giữ hướng quay; cùng họ: \`nod-soft-3d\`, \`nod-3d\`, \`nod-big-3d\`, một cú khi nói \`nod-once-3d\`. Sinh bằng \`tools/actions/nod.mjs\`.`,
    preview: { stage: "stand" },
  })),
);
