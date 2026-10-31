// Rụt người sợ: giật một cái rồi lùi về co mình. Chạy `node tools/actions/flinch.mjs`.
import { emit } from "./emit.mjs";

/**
 * Thân cúi, đầu gục ở đỉnh giật và lúc giữ; `hands` là `offset` của bàn tay so với mốc `belly` (ra ngoài về phía chính tay
 * ấy) ở đỉnh và lúc giữ; `peak` là giây tới đỉnh
 */
const ROWS = [
  {
    name: "flinch-3d",
    torso: [14, 11],
    head: [24, 20],
    hands: [
      [27, -14, 13],
      [27, -10, 13],
    ],
    peak: 0.16,
    what: "Rụt người sợ",
  },
  {
    name: "flinch-soft-3d",
    torso: [5, 4],
    head: [11, 9],
    hands: [
      [22, -4, 13],
      [22, -2, 13],
    ],
    peak: 0.2,
    what: "Rụt người khẽ",
  },
];

const DURATION = 0.6;
const STAND_ARMS = [-6, 24, 0];
const ELBOW = [-0.3, 1, 0.55];
const REST = { w: 0.3, turn: 0, bend: 0 };
const GRIP = { pose: "grip", w: 0.6, palm: "in" };
const num = (v) => String(v).replace(".", ",");
const r4 = (v) => Math.round(v * 1e4) / 1e4;

const reach = (offset) => ({
  armRight: { to: "belly", offset, point: "grip", elbow: ELBOW },
  armLeft: { to: "belly", offset, point: "grip", elbow: ELBOW },
});
const both = (h) => ({ armRight: h, armLeft: h });

const actions = ROWS.map((r) => ({
  name: r.name,
  duration: DURATION,
  end: "hold",
  authoredAt: "side",
  mask: ["armRight", "armLeft", "hand", "torso", "head"],
  snap: true,
  keys: [
    {
      t: 0,
      pose: { armRight: STAND_ARMS, armLeft: STAND_ARMS, torso: 0, head: [null, null, 0] },
      hand: both(REST),
      ease: "smooth",
    },
    {
      t: r4(r.peak / DURATION),
      pose: { torso: r.torso[0], head: [null, null, r.head[0]] },
      reach: reach(r.hands[0]),
      hand: both(GRIP),
      ease: "smooth",
    },
    {
      t: 0.5,
      pose: { torso: r.torso[1], head: [null, null, r.head[1]] },
      reach: reach(r.hands[1]),
      hand: both(GRIP),
      ease: "smooth",
    },
    {
      t: 1,
      pose: { torso: r.torso[1], head: [null, null, r.head[1]] },
      reach: reach(r.hands[1]),
      hand: both(GRIP),
    },
  ],
  note: `${r.what}: trong ${num(r.peak)} s thân cúi ${r.torso[0]}°, đầu gục ${r.head[0]}°, hai tay khép trước bụng nắm hờ (mốc \`belly\`, khuỷu khép sát sườn), rồi lùi về thân ${r.torso[1]}°, đầu ${r.head[1]}° lúc ${num(DURATION / 2)} s và giữ; khai \`snap\`. Ghi \`armRight\`, \`armLeft\`, \`hand\`, \`torso\` và gật của \`head\`. Nền \`stand-3d\`, vào blend ~0,06. Chồng được nét mặt, \`turn-head-*\`; buông về \`stand-3d\` blend ~0,4. Cùng họ: \`flinch-3d\` giật rõ, \`flinch-soft-3d\` khẽ; che chắn trước ngực thì \`cower-3d\`. Sinh bằng \`tools/actions/flinch.mjs\`.`,
  preview: { stage: "stand" },
}));

await emit(actions);
