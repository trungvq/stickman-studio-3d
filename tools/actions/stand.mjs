// Biến thể đứng thở của `stand-3d` (soạn tay, không sinh ở đây). Chạy `node tools/actions/stand.mjs`.
import { emit } from "./emit.mjs";

const SRC = "Sinh bằng `tools/actions/stand.mjs`.";

/** Tay `[vai, khuỷu, cổ tay, dang, xoắn vai]` lúc thở ra / hít vào, chân, thân lúc hít vào */
const ROWS = [
  {
    name: "stand-relaxed-3d",
    near: [
      [7, 32, 0, 0, -8],
      [8, 35, 0, 0, -8],
    ],
    far: [
      [6, 30, 0, 0, -20],
      [7, 33, 0, 0, -20],
    ],
    legs: [1, -1],
    breath: 1.5,
    note: "Đứng thở, vai thả: cánh tay hơi ra trước (vai 6–8°), khuỷu gập 30–35°, tay xa xoắn trong nhiều hơn nên cẳng tay hơi chéo vào thân; thân nhích 0 → 1,5° theo nhịp thở, lượt 3,2 s lặp.",
  },
  {
    name: "stand-belly-3d",
    near: [
      [5, 16, 0, 0, -6],
      [6, 19, 0, 0, -6],
    ],
    legs: [1, -1],
    breath: 1.5,
    note: "Đứng thở cho người bụng phệ: cánh tay hơi ra trước (vai 5–6°), khuỷu gập 16–19°, xoắn trong 6° nên cẳng tay ôm theo bụng thay vì buông thẳng; thân nhích 0 → 1,5° theo nhịp thở, lượt 3,2 s lặp.",
  },
  {
    name: "stand-attention-3d",
    near: [
      [0, 6, 0, 3, 0],
      [0, 7, 0, 3, 0],
    ],
    legs: [0, 0],
    breath: 0.8,
    hand: { pose: "flat", palm: "in", fingers: "down" },
    note: "Đứng nghiêm: hai chân khép, tay duỗi dọc thân (khuỷu 6–7°, dang 3°), bàn tay `flat` khép ngón áp đùi, lòng tay vào trong; thân chỉ nhích 0 → 0,8° theo nhịp thở, lượt 3,2 s lặp.",
  },
];

const key = (t, arm, far, legs, torso) => ({
  t,
  pose: { armFar: far, armNear: arm, legFar: [legs[0], 0], legNear: [legs[1], 0], torso },
  ease: "linear",
});

await emit(
  ROWS.map((r) => {
    const far = r.far ?? r.near;
    const hand = r.hand && { hand: { armNear: r.hand, armFar: r.hand } };
    const mask = ["armFar", "armNear", "legFar", "legNear", "torso", ...(r.hand ? ["hand"] : [])];
    return {
      name: r.name,
      duration: 3.2,
      end: "wrap",
      authoredAt: "side",
      mask,
      keys: [
        { ...key(0, r.near[0], far[0], r.legs, 0), ...hand },
        { ...key(0.5, r.near[1], far[1], r.legs, r.breath), ...hand },
      ],
      note: `${r.note} Ghi tay, chân, thân${r.hand ? ", bàn tay" : ""} — thay hẳn \`stand-3d\`, không chồng lên nó. Nền là chính nó; chồng được track chỉ đầu, nét mặt, hay hành động tay ghi \`armNear\` / \`armFar\` riêng. ${SRC}`,
      preview: { stage: "stand" },
    };
  }),
);
