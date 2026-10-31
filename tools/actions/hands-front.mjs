// Hai tay chồng trước bụng dưới. Chạy `node tools/actions/hands-front.mjs`.
import { emit } from "./emit.mjs";

/** `offset` của bàn tay phải so với mốc `belly` */
const ROWS = [
  {
    name: "hands-front-3d",
    offset: [5, 28, -2],
    note: "bàn tay gần ngang bụng dưới, sát thân — áo, quần gọn",
  },
  {
    name: "hands-front-robe-3d",
    offset: [20, 20, -2],
    note: "bàn tay cao hơn, ra trước hơn bản `hands-front-3d`, nằm trên vạt áo ngay dưới đai, khuỷu mở hơn — kimono, tạp dề, áo thụng",
  },
];

const ELBOW = [0, 0.4, 1.4];
const HAND = { pose: "flat", w: 0.7, palm: "back", fingers: "in" };

await emit(
  ROWS.map((r) => ({
    name: r.name,
    duration: 1,
    end: "hold",
    authoredAt: "side",
    mask: ["armLeft", "armRight", "hand"],
    keys: [
      {
        t: 0,
        pose: {},
        reach: {
          armRight: { to: "belly", offset: r.offset, point: "palm", elbow: ELBOW },
          armLeft: { to: "otherBack", offset: [1, -3, 0], point: "palm", elbow: ELBOW },
        },
        hand: { armRight: HAND, armLeft: HAND },
        ease: "smooth",
      },
    ],
    note: `Hai bàn tay chồng trước bụng dưới, dáng chờ, tiếp khách: tay phải áp lòng tay vào mốc \`belly\` (offset [${r.offset.join(", ")}], ${r.note}), tay trái áp lòng lên mu tay phải (\`otherBack\`), cả hai \`flat\` hờ, ngón chĩa vào đường giữa; khuỷu thả, chĩa ra ngoài; một mốc, giữ suốt clip, vào bằng blend của clip. Chỉ ghi \`armRight\`, \`armLeft\`, \`hand\`. Nền \`stand-3d\`; mốc theo áo nên theo được cỡ người, trừ bụng phệ: cánh tay lấn vào bụng, người ấy dùng \`stand-belly-3d\`. Chồng được cúi chào, đầu, nét mặt; buông bằng clip rỗng blend ~0,4. Sinh bằng \`tools/actions/hands-front.mjs\`.`,
    preview: { stage: "stand" },
  })),
);
