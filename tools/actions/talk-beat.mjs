// Cú nhịp thân khi nói, đứng và ngồi. Chạy `node tools/actions/talk-beat.mjs`.
import { emit } from "./emit.mjs";

/** `torso` cúi tới, `nod` góc gật của đầu lúc đỉnh (âm là ngửa bù cho mắt giữ hướng) */
const ROWS = [
  {
    name: "talk-beat-3d",
    duration: 0.45,
    torso: 5,
    nod: -3,
    base: "stand-3d",
    stage: "stand",
    mirror: "talk-beat-seated-3d",
  },
  {
    name: "talk-beat-seated-3d",
    duration: 0.5,
    torso: 8,
    nod: -6,
    base: "sit-3d",
    stage: "chair",
    mirror: "talk-beat-3d",
  },
];

const deg = (n) => String(n).replace(".", ",");

await emit(
  ROWS.map((r) => ({
    name: r.name,
    duration: r.duration,
    end: "hold",
    authoredAt: "side",
    mask: ["torso", "head"],
    keys: [
      { t: 0, pose: { torso: 0, head: [null, null, 0] }, ease: "smooth" },
      { t: 1, pose: { torso: r.torso, head: [null, null, r.nod] }, ease: "linear" },
    ],
    note: `Cú nhịp thân ở chữ nhấn: thân cúi tới ${deg(r.torso)}° trong ${deg(r.duration)} s, đầu ngửa bù ${deg(-r.nod)}° nên mặt gần như giữ hướng, rồi giữ. Chỉ ghi \`torso\` và gật của \`head\`; nghiêng, lắc để track khác. Nền \`${r.base}\`. Đặt ở track nhịp riêng trên track tay, buông bằng clip rỗng blend ~0,4; ${r.stage === "chair" ? "đứng" : "ngồi"} thì \`${r.mirror}\`. Sinh bằng \`tools/actions/talk-beat.mjs\`.`,
    preview: { stage: r.stage },
  })),
);
