// Cúi chào trọn người, hai tay chồng trước bụng. Chạy `node tools/actions/bow-hands-front.mjs`.
import { emit } from "./emit.mjs";

/** Thân cúi, đầu gật thêm, giây cúi xuống, giữ ở đáy, đứng lên — như `tools/actions/bow.mjs` */
const LEVELS = {
  15: { torso: 15, head: 6, down: 0.3, hold: 0.4, up: 0.3 },
  30: { torso: 30, head: 5, down: 0.4, hold: 0.5, up: 0.5 },
  45: { torso: 45, head: 3, down: 0.55, hold: 1.2, up: 0.7 },
};
/** `offset` của bàn tay gần so với mốc `belly` — như `tools/actions/hands-front.mjs` */
const STYLES = [
  {
    suffix: "",
    offset: [5, 28, -2],
    base: "hands-front-3d",
    note: "ngang bụng dưới, sát thân — áo, quần gọn",
  },
  {
    suffix: "-robe",
    offset: [20, 20, -2],
    base: "hands-front-robe-3d",
    note: "cao hơn, ra trước hơn, nằm trên vạt áo ngay dưới đai — kimono, tạp dề, áo thụng",
  },
];

const ELBOW = [0, 0.4, 1.4];
const HAND = { pose: "flat", w: 0.7, palm: "back", fingers: "in" };
const num = (v) => String(Math.round(v * 100) / 100).replace(".", ",");

const arms = (s) => ({
  reach: {
    armNear: { to: "belly", offset: s.offset, point: "palm", elbow: ELBOW },
    armFar: { to: "otherBack", offset: [1, -3, 0], point: "palm", elbow: ELBOW },
  },
  hand: { armNear: HAND, armFar: HAND },
});
const key = (t, s, torso, head, ease) => ({
  t,
  pose: { torso, head: [0, 0, head] },
  ...arms(s),
  ...(ease && { ease }),
});

const hands = (s) =>
  `Hai tay chồng như \`${s.base}\`: tay gần áp lòng tay vào mốc \`belly\` (offset [${s.offset.join(", ")}], ${s.note}), tay xa áp lòng lên mu tay gần (\`otherBack\`), \`flat\` hờ, ngón chĩa vào đường giữa; mốc theo thân nên tay đi theo cái cúi.`;
const tail =
  "Ghi `armNear`, `armFar`, `hand`, `torso`, `head`. Nền `stand-3d`; người bụng phệ thì cánh tay lấn vào bụng. Chồng được nét mặt; tay đang cầm món thì dùng `bow-*` chỉ ghi thân, đầu.";
const family =
  "Cùng họ: `bow-hands-front-15-3d`, `-30-`, `-45-`, `-robe` cho vạt áo, `-hold` giữ ở đáy. Sinh bằng `tools/actions/bow-hands-front.mjs`.";

const actions = [];
for (const [deg, l] of Object.entries(LEVELS))
  for (const s of STYLES) {
    const d = l.down + l.hold + l.up;
    const r = (sec) => Math.round((sec / d) * 1e4) / 1e4;
    actions.push({
      name: `bow-hands-front-${deg}${s.suffix}-3d`,
      duration: Math.round(d * 100) / 100,
      end: "hold",
      authoredAt: "side",
      mask: ["armFar", "armNear", "hand", "torso", "head"],
      keys: [
        key(0, s, 0, 0, "smooth"),
        key(r(l.down), s, l.torso, l.head, "smooth"),
        key(r(l.down + l.hold), s, l.torso, l.head, "smooth"),
        key(1, s, 0, 0),
      ],
      note: `Cúi chào ${deg}° trọn người, tay chồng trước bụng: thân cúi ${l.torso}°, đầu gật thêm ${l.head}°, xuống trong ${num(l.down)} s, giữ ${num(l.hold)} s, đứng thẳng lên lúc ${num(d)} s rồi giữ đứng tay chồng. ${hands(s)} ${tail} Buông tay bằng clip rỗng blend ~0,4. ${family}`,
      preview: { stage: "stand" },
    });
    actions.push({
      name: `bow-hands-front-${deg}${s.suffix}-hold-3d`,
      duration: 1,
      end: "hold",
      authoredAt: "side",
      mask: ["armFar", "armNear", "hand", "torso", "head"],
      keys: [key(0, s, l.torso, l.head), key(1, s, l.torso, l.head)],
      note: `Giữ ở đáy cái cúi chào ${deg}° tay chồng trước bụng từ giây 0: thân ${l.torso}°, đầu gật thêm ${l.head}° — cho người nền, ảnh tĩnh, cảnh cắt vào giữa cái cúi; đứng lên bằng \`${s.base}\` blend ~0,5. ${hands(s)} ${tail} ${family}`,
      preview: { stage: "stand" },
    });
  }

await emit(actions);
