// Giơ một tay lên trên đầu gọi người, và bản hạ tay. Chạy `node tools/actions/call-out.mjs`.
import { emit } from "./emit.mjs";

/** Dáng tay giơ, chung cho hai file: bản `-out` bắt đầu đúng ở dáng cuối của bản giơ */
const UP = { at: [35, -220, 135], elbow: [-0.6, 0.6, 1] };
const SHAKE = { at: [38, -212, 147], elbow: UP.elbow };
/** Tay gần vươn 1,25 lần: người đầu to, tay ngắn không với quá đỉnh đầu */
const LONG = 1.25;
/** Hướng khuỷu xuống-sau ở mốc giữa: khuỷu không lật lúc hoà giữa tay buông và đích */
const RISE = { at: [50, -110, 100], elbow: [-0.6, 1, 0.2] };
const LOWER = { at: [55, -150, 120], elbow: RISE.elbow };
/** Tay buông của `stand-3d`: mốc không có đích thì cổ tay về chuỗi góc này */
const REST = [-6, 24, 0];
const OPEN = { pose: "open", w: 1, palm: "forward", fingers: "up" };
const LOOSE = { pose: "open", w: 0.3, palm: "in" };

const key = (t, arm, hand, stretch = 1) => ({
  t,
  pose: { ...(!arm && { armNear: REST }), stretch: [1, stretch, 1, 1] },
  ...(arm && { reach: { armNear: arm } }),
  hand: { armNear: hand },
  ease: "smooth",
});

await emit([
  {
    name: "call-out-3d",
    duration: 1.2,
    end: "hold",
    authoredAt: "side",
    mask: ["armNear", "hand", "stretch"],
    keys: [
      key(0, null, LOOSE),
      key(0.1667, RISE, { ...OPEN, w: 0.7 }, 1.1),
      key(0.4, UP, OPEN, LONG),
      key(0.53, SHAKE, OPEN, LONG),
      key(0.66, UP, OPEN, LONG),
      key(1, UP, OPEN, LONG),
    ],
    note: `Giơ tay gần lên gọi người ("anh ơi!", gọi phục vụ): từ tay buông của \`stand-3d\`, tay đưa lên qua phía trước-ngoài, tới cổ tay chếch ra ngoài, cao quá đỉnh đầu (đích hệ thân [${UP.at.join(", ")}], tay gần vươn ${String(LONG).replace(".", ",")} lần, cánh tay duỗi) lúc 0,48 s, lắc ra một nhịp lúc 0,64 s rồi giữ; bàn tay \`open\`, lòng ra trước, ngón dựng. Chỉ ghi \`armNear\`, \`hand\`, \`stretch\`. Nền \`stand-3d\`, hay \`sit-3d\`: đích hệ thân theo hông nên ngồi vẫn đúng. Hạ bằng \`call-out-out-3d\` rồi nhả về nền; blend thẳng từ tay giơ về nền thì khuỷu lật giữa đường. Giơ tay lặng lẽ, gần thẳng đứng: \`raise-hand-3d\`. Sinh bằng \`tools/actions/call-out.mjs\`.`,
    preview: { stage: "stand" },
  },
  {
    name: "call-out-out-3d",
    duration: 0.7,
    end: "hold",
    authoredAt: "side",
    mask: ["armNear", "hand", "stretch"],
    keys: [key(0, UP, OPEN, LONG), key(0.5, LOWER, { ...OPEN, w: 0.5 }, 1.1), key(1, null, LOOSE)],
    note: `Hạ tay đang giơ của \`call-out-3d\` về tay buông của \`stand-3d\` trong 0,7 s: qua trước-ngoài vai, khuỷu đổi dần sang xuống-sau nên không lật, độ vươn về 1, rồi giữ. Chỉ ghi \`armNear\`, \`hand\`, \`stretch\`. Nối ngay sau \`call-out-3d\` (blend ~0,2), hạ được cả \`raise-hand-3d\`; nền \`stand-3d\` hay \`sit-3d\`; sau clip này nhả bằng clip rỗng blend ~0,3. Sinh bằng \`tools/actions/call-out.mjs\`.`,
    preview: { stage: "stand" },
  },
]);
