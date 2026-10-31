// Vẫy chào bằng tay phải, lặp. Chạy `node tools/actions/wave.mjs`.
import { emit } from "./emit.mjs";

/** Cổ tay đi qua lại giữa `from` và `to` (hệ thân), một lượt `duration` giây; `stretch` vươn tay phải cho người đầu to */
const ROWS = [
  {
    name: "wave-soft-3d",
    duration: 0.44,
    from: [35, -140, 92],
    to: [35, -140, 112],
    note: "vẫy khẽ: bàn tay ngang vai, trước vai, cẳng tay lắc ít",
  },
  {
    name: "wave-3d",
    duration: 0.5,
    from: [22, -185, 100],
    to: [22, -178, 120],
    note: "bàn tay ngang tai, ra ngoài đầu, cẳng tay dựng, lắc qua lại",
  },
  {
    name: "wave-big-3d",
    duration: 0.8,
    from: [15, -250, 110],
    to: [20, -215, 165],
    stretch: 1.2,
    note: "vẫy to: cả cánh tay giơ cao quá đầu (tay phải vươn 1,2 lần), quét rộng",
  },
];

const ELBOW = [0, 1, 0.6];
const HAND = { pose: "open", palm: "forward", fingers: "up" };

await emit(
  ROWS.map((r) => {
    const key = (t, at) => ({
      t,
      pose: r.stretch ? { stretch: [1, r.stretch, 1, 1] } : {},
      reach: { armRight: { at, elbow: ELBOW } },
      hand: { armRight: HAND },
      ease: "smooth",
    });
    return {
      name: r.name,
      duration: r.duration,
      end: "wrap",
      authoredAt: "side",
      mask: ["armRight", "hand", ...(r.stretch ? ["stretch"] : [])],
      keys: [key(0, r.from), key(0.5, r.to), key(1, r.from)],
      note: `Vẫy chào bằng tay phải, ${r.note}: cổ tay đi qua lại giữa đích hệ thân [${r.from.join(", ")}] và [${r.to.join(", ")}], một lượt ${String(r.duration).replace(".", ",")} s, lặp; bàn tay \`open\`, lòng ra trước, ngón dựng. Chỉ ghi \`armRight\`, \`hand\`${r.stretch ? ", `stretch`" : ""}. Nền \`stand-3d\`, \`sit-3d\`. Vào và buông bằng blend của clip ~0,3. Bản cùng họ: \`wave-soft-3d\`, \`wave-3d\`, \`wave-big-3d\`. Sinh bằng \`tools/actions/wave.mjs\`.`,
      preview: { stage: "stand" },
    };
  }),
);
