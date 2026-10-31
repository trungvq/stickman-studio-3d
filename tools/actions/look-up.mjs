// Ngẩng nhìn người đứng cao rồi giữ. Chạy `node tools/actions/look-up.mjs`.
import { emit } from "./emit.mjs";

/** Lắc dương là quay mặt về phía tay trái; gật âm là ngửa */
const SIDES = [
  { side: "right", sign: -1, label: "phía tay phải" },
  { side: "left", sign: 1, label: "phía tay trái" },
];

const TURN = 40;
const UP = 14;

await emit(
  SIDES.map((s) => ({
    name: `look-up-${s.side}-3d`,
    duration: 0.5,
    end: "hold",
    authoredAt: "side",
    mask: ["head"],
    keys: [
      { t: 0, pose: { head: [null, 0, 0] }, ease: "smooth" },
      { t: 1, pose: { head: [null, s.sign * TURN, -UP] } },
    ],
    note: `Ngẩng nhìn người đứng cao chếch về ${s.label}: đầu lắc ${TURN}°, ngửa ${UP}° trong 0,5 s rồi giữ. Chỉ ghi lắc và gật của \`head\`, nghiêng để trống. Nền \`stand-3d\` hay \`sit-3d\` nhìn lên người đứng cạnh. Chồng \`tilt-head-*\` lên trên vẫn giữ hướng nhìn; chiều kia là \`look-up-${s.side === "right" ? "left" : "right"}-3d\`, buông bằng clip rỗng blend ~0,4. Sinh bằng \`tools/actions/look-up.mjs\`.`,
    preview: { stage: "stand" },
  })),
);
