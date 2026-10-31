// Nghiêng đầu rồi giữ. Chạy `node tools/actions/tilt-head.mjs`.
import { emit } from "./emit.mjs";

/** Nghiêng dương đưa đỉnh đầu về phía tay trái */
const SIDES = [
  { side: "right", sign: -1, label: "phía tay phải" },
  { side: "left", sign: 1, label: "phía tay trái" },
];

const TILT = 10;

await emit(
  SIDES.map((s) => ({
    name: `tilt-head-${s.side}-3d`,
    duration: 0.45,
    end: "hold",
    authoredAt: "side",
    mask: ["head"],
    keys: [
      { t: 0, pose: { head: [0, null, null] }, ease: "smooth" },
      { t: 1, pose: { head: [s.sign * TILT, null, null] }, ease: "smooth" },
    ],
    note: `Nghiêng đầu ${TILT}° về ${s.label} rồi giữ (khựng nghe, câu hỏi, làm duyên); lượt 0,45 s. Chỉ ghi nghiêng của \`head\`, lắc và gật để trống. Nền \`stand-3d\`, ngồi thì \`sit-3d\`. Chồng lên \`turn-head-*\`, \`look-up-*\`, \`nod-*\` vẫn giữ hướng nhìn và cái gật; chiều kia là \`tilt-head-${s.side === "right" ? "left" : "right"}-3d\`, buông bằng clip rỗng blend ~0,4. Sinh bằng \`tools/actions/tilt-head.mjs\`.`,
    preview: { stage: "stand" },
  })),
);
