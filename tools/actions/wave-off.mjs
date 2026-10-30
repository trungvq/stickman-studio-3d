// Phẩy tay gạt đi bằng một tay. Chạy `node tools/actions/wave-off.mjs`.
import { emit } from "./emit.mjs";

const ROWS = [
  { name: "wave-off-near-3d", arm: "armNear", side: "gần", mirror: "wave-off-far-3d" },
  { name: "wave-off-far-3d", arm: "armFar", side: "xa", mirror: "wave-off-near-3d" },
];

/** Tay buông của `stand-3d`: mốc không có đích thì cổ tay về chuỗi góc này */
const REST = [-6, 24, 0];
const FLICK = { at: [64, -76, 86], elbow: [-0.3, 1, 0.5] };
const UP = { at: [60, -80, 36], elbow: [-0.2, 0.8, 0.9] };
const SETTLE = { at: [60, -72, 78], elbow: FLICK.elbow };
const LIFT = { at: [48, -48, 62], elbow: FLICK.elbow };
const open = (w, turn, bend) => ({ pose: "open", w, turn, bend });

/** [t, đích, bàn tay]; đích `null` là tay buông */
const KEYS = [
  [0, null, open(0.3, 0, 0)],
  [0.18, LIFT, open(0.5, 0, 0)],
  [0.35, UP, open(0.7, -20, 35)],
  [0.5, FLICK, open(0.9, -10, -45)],
  [0.7, SETTLE, open(0.8, 25, -15)],
  [1, SETTLE, open(0.8, 25, -15)],
];

await emit(
  ROWS.map((r) => ({
    name: r.name,
    duration: 1,
    end: "hold",
    authoredAt: "side",
    mask: [r.arm, "hand"],
    keys: KEYS.map(([t, arm, hand]) => ({
      t,
      pose: arm ? {} : { [r.arm]: REST },
      ...(arm && { reach: { [r.arm]: arm } }),
      hand: { [r.arm]: hand },
      ease: "smooth",
    })),
    note: `Phẩy tay ${r.side} gạt đi ("thôi khỏi", "để sau"): từ tay buông, tay nhấc lên trước ngực, cổ tay gập vào (đích hệ thân [${UP.at.join(", ")}], 0,35 s), hất mu bàn tay ra ngoài-trước ([${FLICK.at.join(", ")}], 0,5 s), khựng lại ở ngoài, cẳng tay sấp dần cho lòng tay úp ra ngoài (0,7 s), rồi giữ; bàn tay \`open\`. Chỉ ghi \`${r.arm}\`, \`hand\`. Nền \`stand-3d\` hay \`sit-3d\`. Buông bằng clip rỗng blend ~0,35; phía kia là \`${r.mirror}\`. Sinh bằng \`tools/actions/wave-off.mjs\`.`,
    preview: { stage: "stand" },
  })),
);
