// Chống nạnh một hay hai tay. Chạy `node tools/actions/hands-hips.mjs`.
import { emit } from "./emit.mjs";

/** Kênh tay chống: `sides: "anatomical"` nên `armNear` là tay phải */
const ROWS = [
  { name: "hands-hips-right-3d", arms: ["armNear"], sides: true, note: "Tay phải" },
  { name: "hands-hips-left-3d", arms: ["armFar"], sides: true, note: "Tay trái" },
  { name: "hands-hips-both-3d", arms: ["armNear", "armFar"], sides: false, note: "Hai tay" },
];

const REACH = {
  to: "hip",
  point: "palm",
  offset: [-1.6, -24.01, 5.28],
  elbow: [-0.178, -0.136, 0.974],
};
const HAND = { palm: "in", fingers: [0.6, 0.8, 0] };

const side = {
  true: '`sides: "anatomical"`: ở mọi góc máy vẫn là tay ấy, liền qua các cú cắt; tay kia tự do. Bản cùng họ: `hands-hips-right-3d`, `hands-hips-left-3d`, `hands-hips-both-3d`.',
  false: "Bản một tay: `hands-hips-right-3d`, `hands-hips-left-3d`.",
};

await emit(
  ROWS.map((r) => {
    const each = (v) => Object.fromEntries(r.arms.map((c) => [c, v]));
    return {
      name: r.name,
      duration: 1,
      end: "hold",
      authoredAt: "side",
      ...(r.sides && { sides: "anatomical" }),
      mask: [...r.arms, "hand"],
      keys: [{ t: 0, pose: {}, reach: each(REACH), hand: each(HAND), ease: "smooth" }],
      note: `${r.note} chống nạnh: lòng tay áp sườn trên mốc \`hip\` (offset [−1,6, −24, 5,3]), khuỷu chĩa ra ngoài, ngón rủ ra sau-xuống; một mốc, giữ suốt clip, vào bằng blend của clip. Chỉ ghi ${r.arms.map((c) => `\`${c}\``).join(", ")}, \`hand\`. Nền \`stand-3d\`; mốc theo áo nên đúng mọi cỡ người. ${side[r.sides]} Buông bằng clip rỗng blend ~0,4, hay \`world.hands\` của tay ấy đè lên rồi \`null\` để về lại hông. Sinh bằng \`tools/actions/hands-hips.mjs\`.`,
      preview: { stage: "stand" },
    };
  }),
);
