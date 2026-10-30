// Cầm điện thoại xem, tay kia gõ màn, lặp. Chạy `node tools/actions/phone-use.mjs`.
import { emit } from "./emit.mjs";

/** `hold` kênh tay cầm máy (`sides: "anatomical"`: `armNear` là tay phải), `at` tâm nắm của tay ấy, hệ thân */
const ROWS = [
  {
    name: "phone-use-3d",
    hold: "armNear",
    at: [90, -92, 32],
    what: "trước ngực, tay phải cầm máy",
  },
  {
    name: "phone-use-left-3d",
    hold: "armFar",
    at: [90, -92, 32],
    what: "trước ngực, tay trái cầm máy",
  },
  {
    name: "phone-use-high-3d",
    hold: "armNear",
    at: [100, -120, 16],
    what: "giơ cao ngang ngực trên, tay phải cầm máy",
  },
  {
    name: "phone-use-high-left-3d",
    hold: "armFar",
    at: [100, -120, 16],
    what: "giơ cao ngang ngực trên, tay trái cầm máy",
  },
];

/** Đầu ngón tay gõ so với tâm nắm tay cầm máy: nhấc trên màn, chạm màn */
const TAP_UP = [4, -17, 2];
const TAP_DOWN = [4, -14, 2];
/** Giây (phần lượt) chạm màn: hai cú gần nhau, nghỉ, một cú */
const TAPS = [0, 0.15, 0.3, 0.42, 0.55, 0.8, 0.92, 1];
const DOWN = new Set([0.15, 0.42, 0.92]);
const num = (v) => String(v).replace(".", ",");

await emit(
  ROWS.map((r) => {
    const tap = r.hold === "armNear" ? "armFar" : "armNear";
    const right = r.hold === "armNear";
    const hold = { at: r.at, elbow: [-0.6, 1, 0.4], point: "grip" };
    const hand = {
      [r.hold]: { pose: "span", w: 1, palm: { toward: "mouth" } },
      [tap]: { pose: "point", w: 1, palm: "down", fingers: [0.6, 0.75, -0.3] },
    };
    return {
      name: r.name,
      duration: 1.4,
      end: "wrap",
      authoredAt: "side",
      sides: "anatomical",
      mask: ["armNear", "armFar", "hand"],
      keys: TAPS.map((t) => ({
        t,
        pose: {},
        reach: {
          [r.hold]: hold,
          [tap]: {
            to: "otherGrip",
            offset: DOWN.has(t) ? TAP_DOWN : TAP_UP,
            point: "tip",
            elbow: [-0.3, 0.7, 1],
          },
        },
        hand,
        ease: "smooth",
      })),
      note: `Cầm điện thoại xem và gõ, ${r.what}: tâm nắm tay cầm ở hệ thân [${r.at.map(num).join(", ")}], tay kia giơ ngón trỏ trên màn (mốc \`otherGrip\`) và gõ ba cú mỗi lượt 1,4 s, lặp. Ghi hai tay, \`hand\`; \`sides: "anatomical"\`. Nền \`stand-3d\` hay \`sit-3d\`; món ở \`world.hands[].hold\` của tay cầm, như \`dien-thoai@palmBox\` với \`roll\` đầu máy ra trước. Chồng \`look-down-*\` cho đầu cúi nhìn máy; cùng họ: \`phone-use-3d\`, \`-left\`, \`-high\`, \`-high-left\`. Sinh bằng \`tools/actions/phone-use.mjs\`.`,
      preview: {
        stage: "stand",
        hold: {
          [right ? "right" : "left"]: {
            item: "dien-thoai",
            group: "palmBox",
            roll: { axis: "top", toward: "forward" },
          },
        },
      },
    };
  }),
);
