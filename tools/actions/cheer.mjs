// Hò reo, nắm đấm giơ nảy nhịp. Chạy `node tools/actions/cheer.mjs`.
import { emit } from "./emit.mjs";

const ROWS = [
  { name: "cheer-3d", arms: ["armRight"], what: "Hò reo một tay: tay phải" },
  { name: "cheer-both-3d", arms: ["armRight", "armLeft"], what: "Hò reo hai tay: hai tay" },
];

/** Tay `[vai, khuỷu, cổ tay, dang, xoắn vai]`: lên là chếch ngoài đầu thành chữ V, xuống là nắm đấm ngang đỉnh đầu, khuỷu chếch trên vai */
const UP = { arm: [10, 10, 0, 122, 90], legs: [-1, 1, 0, 0], torso: -3, head: -12 };
const DOWN = { arm: [10, 40, 0, 112, 90], legs: [10, 12, -20, -22], torso: 2, head: -6 };
const FIST = { pose: "fist", w: 1, turn: 0, bend: 0 };

const pose = (p, arms) => ({
  legRight: [p.legs[0], p.legs[2]],
  legLeft: [p.legs[1], p.legs[3]],
  torso: p.torso,
  head: [0, 0, p.head],
  ...Object.fromEntries(arms.map((c) => [c, p.arm])),
});

await emit(
  ROWS.map((r) => {
    const key = (t, p) => ({
      t,
      pose: pose(p, r.arms),
      hand: Object.fromEntries(r.arms.map((c) => [c, FIST])),
      ease: "smooth",
    });
    const free = r.arms.length === 1 ? " Tay trái để trống cho nền." : "";
    return {
      name: r.name,
      duration: 0.5,
      end: "wrap",
      authoredAt: "side",
      mask: [...r.arms, "legRight", "legLeft", "torso", "head", "hand"],
      keys: [key(0, UP), key(0.5, DOWN), key(1, UP)],
      note: `${r.what} giơ nắm đấm nảy nhịp 0,5 s một lượt, lặp: lên chếch ngoài đầu thành chữ V (dang 122°) ↔ xuống nắm đấm ngang đỉnh đầu, khuỷu chếch trên vai; gối nhún 20° ở nhịp xuống, thân −3 ↔ 2°, đầu ngửa 12 ↔ 6°; bàn tay \`fist\`. Ghi ${r.arms.map((c) => `\`${c}\``).join(", ")}, hai chân, \`torso\`, \`head\`, \`hand\`.${free} Nền \`stand-3d\`; góc tay, không đích, nên vào blend ~0,25, ra blend ~0,45 về \`stand-3d\` không lật khuỷu. Nhịp khác thì đặt \`cycle\` 0,45–0,6; hai người hò reo cạnh nhau đứng cách ≥ 260. Cùng họ: \`cheer-3d\` một tay, \`cheer-both-3d\` hai tay. Sinh bằng \`tools/actions/cheer.mjs\`.`,
      preview: { stage: "stand" },
    };
  }),
);
