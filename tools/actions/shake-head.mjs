// Lắc đầu "không". Chạy `node tools/actions/shake-head.mjs`.
import { emit } from "./emit.mjs";

/** Lắc về phía ống kính, sang phía kia, về lại phía ống kính; mốc ở 0,2 / 0,5 / 0,8 */
const ROWS = [
  { name: "shake-head-soft-3d", turns: [12, 12, 7], duration: 0.9, use: 'chán, "không phải"' },
  { name: "shake-head-3d", turns: [20, 20, 13], duration: 1, use: '"không"' },
  {
    name: "shake-head-big-3d",
    turns: [30, 30, 20],
    duration: 1.1,
    use: '"không đời nào", từ chối thẳng',
  },
];

const turn = (x) => ({ head: [null, x, null] });

await emit(
  ROWS.map((r) => ({
    name: r.name,
    duration: r.duration,
    end: "hold",
    authoredAt: "side",
    mask: ["head"],
    keys: [
      { t: 0, pose: turn(0), ease: "smooth" },
      { t: 0.2, pose: turn(-r.turns[0]), ease: "smooth" },
      { t: 0.5, pose: turn(r.turns[1]), ease: "smooth" },
      { t: 0.8, pose: turn(-r.turns[2]), ease: "smooth" },
      { t: 1, pose: turn(0) },
    ],
    note: `Lắc đầu (${r.use}): lắc ${r.turns[0]}° về phía ống kính ở 0,2, ${r.turns[1]}° sang phía kia ở 0,5, ${r.turns[2]}° về lại ở 0,8, thẳng ở 1; lượt ${String(r.duration).replace(".", ",")} s, giữ. Chỉ ghi góc lắc của \`head\`, nghiêng và gật để trống. Nền \`stand-3d\`, ngồi thì \`sit-3d\`. Track dưới cúi, ngẩng đầu thì góc gật ấy vẫn giữ; cùng họ: \`shake-head-soft-3d\`, \`shake-head-3d\`, \`shake-head-big-3d\`. Sinh bằng \`tools/actions/shake-head.mjs\`.`,
    preview: { stage: "stand" },
  })),
);
