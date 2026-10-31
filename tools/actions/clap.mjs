// Vỗ tay lặp. Chạy `node tools/actions/clap.mjs`.
import { emit } from "./emit.mjs";

/** Tay phải trước ngực (mốc `chest`, `at` [tiến, y, ra ngoài]), mở `open` → chạm `shut`; tay trái cách `gap` lúc mở */
const ROWS = [
  {
    name: "clap-3d",
    duration: 0.42,
    at: [36, -6],
    open: 12,
    shut: 2,
    gap: 24,
    what: "Vỗ tay lặp",
  },
  {
    name: "clap-soft-3d",
    duration: 0.55,
    at: [36, 6],
    open: 6,
    shut: 2,
    gap: 10,
    what: "Vỗ tay khẽ, lịch sự",
  },
  {
    name: "clap-big-3d",
    duration: 0.36,
    at: [44, -30],
    open: 30,
    shut: 2,
    gap: 60,
    what: "Vỗ tay to, nhiệt liệt",
  },
];

const ELBOW = [-0.3, 1, 0.8];
const HAND = { pose: "flat", palm: "in", fingers: [1, -1, 0] };
const num = (v) => String(v).replace(".", ",");

await emit(
  ROWS.map((r) => {
    const near = (z) => ({ to: "chest", offset: [...r.at, z], elbow: ELBOW });
    const key = (t, z, gap, ease) => ({
      t,
      pose: {},
      reach: {
        armRight: near(z),
        armLeft: { to: "otherPalm", ...(gap && { offset: [0, 0, gap] }), elbow: ELBOW },
      },
      hand: { armRight: HAND, armLeft: HAND },
      ease,
    });
    return {
      name: r.name,
      duration: r.duration,
      end: "wrap",
      authoredAt: "side",
      snap: true,
      mask: ["armRight", "armLeft", "hand"],
      keys: [
        key(0, r.open, r.gap, "smooth"),
        key(0.45, r.shut, 0, "linear"),
        key(0.55, r.shut, 0, "smooth"),
        key(1, r.open, r.gap, "smooth"),
      ],
      events: [{ name: "clap", t: 0.5 }],
      note: `${r.what}: tay phải trước ngực (mốc \`chest\`, offset [${r.at.map(num).join(", ")}, ${r.open}] mở → ${r.shut} chạm), tay trái áp lòng tay vào lòng tay phải (\`otherPalm\`, cách ${r.gap} lúc mở), ${num(r.duration)} s một lượt, lặp; dáng \`flat\`, hai lòng tay \`in\` đối nhau, sự kiện \`clap\` lúc chạm, \`snap\` vì cú khép nhanh cố ý. Chỉ ghi \`armRight\`, \`armLeft\`, \`hand\`. Nền \`stand-3d\`, \`sit-3d\` hay \`seiza-3d\`; mốc theo mặt áo nên người bụng phệ tay tự ra trước bụng. Vào blend ~0,25, thôi bằng clip lớp dưới blend ~0,35; nhịp khác thì đặt \`cycle\`. Cùng họ: \`clap-soft-3d\` khẽ, \`clap-3d\`, \`clap-big-3d\` to. Sinh bằng \`tools/actions/clap.mjs\`.`,
      preview: { stage: "stand" },
    };
  }),
);
