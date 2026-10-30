// Vai sụp, đầu gục. Chạy `node tools/actions/slump.mjs`.
import { emit } from "./emit.mjs";

/** Thân đổ tới, đầu cúi, giây vào dáng */
const ROWS = [
  {
    name: "slump-3d",
    torso: 7,
    head: 12,
    in: 0.8,
    what: "Vai sụp, đầu gục nhẹ (vừa biết mình thua, thất vọng)",
  },
  { name: "slump-big-3d", torso: 6, head: 32, in: 1, what: "Cúi gằm mặt (bị dẫn giải, xấu hổ)" },
];

const num = (v) => String(v).replace(".", ",");
const pose = (torso, head) => ({ torso, head: [null, null, head] });
const tail =
  "Chỉ ghi `torso` và gật của `head`, nghiêng, lắc để trống; tay để cảnh. Nền `stand-3d`, ngồi thì `sit-3d`. Chồng được lên tay buông, chắp trước bụng (`hands-front-3d`), bị nắm tay dẫn đi; buông bằng clip rỗng blend ~0,5. Cùng họ: `slump-3d` gục nhẹ, `slump-big-3d` cúi gằm, `-hold` giữ dáng từ giây 0. Sinh bằng `tools/actions/slump.mjs`.";

const actions = [];
for (const r of ROWS) {
  actions.push({
    name: r.name,
    duration: r.in,
    end: "hold",
    authoredAt: "side",
    mask: ["torso", "head"],
    keys: [
      { t: 0, pose: pose(0, 0), ease: "smooth" },
      { t: 1, pose: pose(r.torso, r.head) },
    ],
    note: `${r.what}: thân đổ tới ${r.torso}°, đầu cúi ${r.head}° trong ${num(r.in)} s; giữ. ${tail}`,
    preview: { stage: "stand" },
  });
  actions.push({
    name: r.name.replace(/-3d$/, "-hold-3d"),
    duration: 1,
    end: "hold",
    authoredAt: "side",
    mask: ["torso", "head"],
    keys: [
      { t: 0, pose: pose(r.torso, r.head) },
      { t: 1, pose: pose(r.torso, r.head) },
    ],
    note: `Giữ dáng cuối của \`${r.name}\` từ giây 0: thân ${r.torso}°, đầu cúi ${r.head}° — cho người nền, ảnh tĩnh, cảnh cắt vào giữa. ${tail}`,
    preview: { stage: "stand" },
  });
}

await emit(actions);
