// Ngả thân ra sau, cằm hất. Chạy `node tools/actions/lean-back.mjs`.
import { emit } from "./emit.mjs";

/** Thân ngả sau (âm), đầu ngửa thêm cho cằm hất */
const ROWS = [
  {
    name: "lean-back-3d",
    torso: -7,
    head: -7,
    what: "Ưỡn ngực, ngả ra sau, cằm hất lên (ra oai, bề trên)",
    base: "Nền `stand-3d`",
    stage: "stand",
  },
  {
    name: "lean-back-seated-3d",
    torso: -6,
    head: -6,
    what: "Ngồi ngả ra sau, cằm hếch (sốt ruột, bề trên)",
    base: "Nền `sit-3d` với `world.sit`, ghế có lưng tựa",
    stage: "chair",
  },
];
const DURATION = 0.5;

const num = (v) => String(v).replace(".", ",").replace("-", "−");
const pose = (torso, head) => ({ torso, head: [null, null, head] });

await emit(
  ROWS.map((r) => ({
    name: r.name,
    duration: DURATION,
    end: "hold",
    authoredAt: "side",
    mask: ["torso", "head"],
    keys: [
      { t: 0, pose: pose(0, 0), ease: "smooth" },
      { t: 1, pose: pose(r.torso, r.head) },
    ],
    note: `${r.what}: thân ${num(r.torso)}°, đầu gật ${num(r.head)}° trong ${num(DURATION)} s; giữ. Chỉ ghi \`torso\` và gật của \`head\`, nghiêng, lắc để trống; tay để cảnh. ${r.base}. Chồng được lên tay chống nạnh, chắp sau lưng, khoanh trên ghế và \`turn-head-*\`; buông bằng clip rỗng blend ~0,4. Đứng là \`lean-back-3d\`, ngồi là \`lean-back-seated-3d\`. Sinh bằng \`tools/actions/lean-back.mjs\`.`,
    preview: { stage: r.stage },
  })),
);
