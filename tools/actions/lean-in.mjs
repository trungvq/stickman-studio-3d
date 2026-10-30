// Ngả thân tới về phía người đối diện. Chạy `node tools/actions/lean-in.mjs`.
import { emit } from "./emit.mjs";

/** Thân ngả tới, đầu ngửa bù để mắt giữ ngang, giây vào dáng */
const ROWS = [
  {
    name: "lean-in-soft-3d",
    torso: 7,
    head: -5,
    in: 0.5,
    what: "Ngả tới nhẹ, chậm (giảng giải, chán ngán)",
  },
  {
    name: "lean-in-3d",
    torso: 11,
    head: -7,
    in: 0.4,
    what: "Ngả tới (chú ý, dồn ép người đối diện)",
  },
  {
    name: "lean-in-firm-3d",
    torso: 16,
    head: -10,
    in: 0.3,
    snap: true,
    what: "Ngả tới dứt khoát (tức, áp đảo)",
  },
];

const num = (v) =>
  String(Math.round(v * 100) / 100)
    .replace(".", ",")
    .replace("-", "−");
const family = ROWS.map((r) => `\`${r.name}\` ${r.torso}°`).join(", ");
const pose = (torso, head) => ({ torso, head: [null, null, head] });

await emit(
  ROWS.map((r) => ({
    name: r.name,
    duration: r.in,
    end: "hold",
    authoredAt: "side",
    ...(r.snap && { snap: true }),
    mask: ["torso", "head"],
    keys: [
      { t: 0, pose: pose(0, 0), ease: r.snap ? "linear" : "smooth" },
      { t: 1, pose: pose(r.torso, r.head) },
    ],
    note: `${r.what}: thân ngả ${r.torso}° trong ${num(r.in)} s, đầu ngửa bù ${num(r.head)}° để mắt vẫn nhìn người đối diện; giữ.${r.snap ? " Cố ý nhanh, khai `snap`." : ""} Chỉ ghi \`torso\` và gật của \`head\`, nghiêng, lắc để trống; tay để cảnh. Nền \`stand-3d\`, ngồi thì \`sit-3d\`. Chồng được lên tay chống quầy, chắp, chỉ trỏ và \`turn-head-*\`; buông bằng clip rỗng blend ~0,4. Cùng họ: ${family}. Sinh bằng \`tools/actions/lean-in.mjs\`.`,
    preview: { stage: "stand" },
  })),
);
