// Ngó sang một bên rồi về. Chạy `node tools/actions/look-around.mjs`.
import { emit } from "./emit.mjs";

/** Lắc dương là quay mặt về phía tay trái */
const ROWS = [
  { name: "look-around-right-3d", sign: -1, side: "phía tay phải", other: "look-around-left-3d" },
  { name: "look-around-left-3d", sign: 1, side: "phía tay trái", other: "look-around-right-3d" },
];

const TURN = 28;
const NOD = 3;

await emit(
  ROWS.map((r) => ({
    name: r.name,
    duration: 2.4,
    end: "hold",
    authoredAt: "side",
    mask: ["head"],
    keys: [
      { t: 0, pose: { head: [null, 0, 0] }, ease: "smooth" },
      { t: 0.3, pose: { head: [null, r.sign * TURN, NOD] }, ease: "linear" },
      { t: 0.7, pose: { head: [null, r.sign * TURN, NOD] }, ease: "smooth" },
      { t: 1, pose: { head: [null, 0, 0] } },
    ],
    note: `Ngó sang ${r.side} một cái rồi về: đầu lắc ${TURN}°, gật ${NOD}° ở 0,3, giữ tới 0,7, về thẳng ở 1; lượt 2,4 s, giữ dáng thẳng ở cuối. Chỉ ghi lắc và gật của \`head\`, nghiêng để trống. Nền \`stand-3d\`, ngồi thì \`sit-3d\`. Chồng lên mọi track thân, tay; cho người nền thì đổi \`cycle\` để mỗi người ngó một nhịp; chiều kia là \`${r.other}\`. Sinh bằng \`tools/actions/look-around.mjs\`.`,
    preview: { stage: "stand" },
  })),
);
