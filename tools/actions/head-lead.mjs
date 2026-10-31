// Đầu dẫn trước khi thân quay. Chạy `node tools/actions/head-lead.mjs`.
import { emit } from "./emit.mjs";

/** Lắc dương là quay mặt về phía tay trái; nghiêng ngược chiều quay */
const SIDES = [
  { side: "right", sign: -1, label: "phía tay phải" },
  { side: "left", sign: 1, label: "phía tay trái" },
];

const TURN = 35;
const TILT = 2;

await emit(
  SIDES.map((s) => {
    const other = s.side === "right" ? "left" : "right";
    const head = (tilt, turn) => ({ head: [-s.sign * tilt, s.sign * turn, null] });
    return {
      name: `head-lead-${s.side}-3d`,
      duration: 0.9,
      end: "hold",
      authoredAt: "side",
      mask: ["head"],
      keys: [
        { t: 0, pose: head(0, 0), ease: "smooth" },
        { t: 0.35, pose: head(TILT, TURN), ease: "linear" },
        { t: 0.55, pose: head(TILT, TURN), ease: "smooth" },
        { t: 1, pose: head(0, 0) },
      ],
      note: `Đầu dẫn trước khi thân quay về ${s.label}: lắc ${TURN}° ở 0,35, nghiêng ${TILT}° ngược chiều quay, giữ tới 0,55, về thẳng ở 1 khi thân quay theo kịp; lượt 0,9 s, giữ. Chỉ ghi nghiêng và lắc của \`head\`, gật để trống. Nền \`stand-3d\` hay đi theo \`path\`; đặt clip ~0,2 s trước lúc thân bắt đầu quay, \`cycle\` bằng quãng quay. Chồng \`nod-*\` lên trên vẫn giữ gật; chiều kia là \`head-lead-${other}-3d\`. Sinh bằng \`tools/actions/head-lead.mjs\`.`,
      preview: { stage: "stand" },
    };
  }),
);
