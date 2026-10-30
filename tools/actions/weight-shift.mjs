// Nhún thân một nhịp của người đứng chờ. Chạy `node tools/actions/weight-shift.mjs`.
import { emit } from "./emit.mjs";

/** Thân cúi và đầu ngửa bù ở đỉnh nhịp (`t` 0,4) */
const ROWS = [
  { name: "weight-shift-3d", torso: 4, head: -2 },
  { name: "weight-shift-soft-3d", torso: 2, head: -1 },
];

const fmt = (v) => String(v).replace("-", "−");

await emit(
  ROWS.map((r) => ({
    name: r.name,
    duration: 2,
    end: "hold",
    authoredAt: "side",
    mask: ["torso", "head"],
    keys: [
      { t: 0, pose: { torso: 0, head: [0, 0, 0] }, ease: "smooth" },
      { t: 0.4, pose: { torso: r.torso, head: [0, 0, r.head] }, ease: "smooth" },
      { t: 1, pose: { torso: 0, head: [0, 0, 0] } },
    ],
    note: `Dồn trọng tâm, nhún thân một nhịp chậm rồi về, cho người đứng chờ lâu: thân cúi ${r.torso}° lúc 0,8 s, đầu ngửa bù ${fmt(r.head)}°, về 0 lúc 2 s rồi giữ. Chỉ ghi \`torso\`, \`head\`. Nền \`stand-3d\`. Chồng được lên tay chắp, chống nạnh, cầm món; gọi lại cách quãng cho người nền, buông bằng clip rỗng blend ~0,3 để thân về nhịp thở của nền. Bản nhẹ \`weight-shift-soft-3d\`, bản rõ \`weight-shift-3d\`. Sinh bằng \`tools/actions/weight-shift.mjs\`.`,
    preview: { stage: "stand" },
  })),
);
