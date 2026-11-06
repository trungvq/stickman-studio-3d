// Đứng cầm ly có chân trước bụng trên (dáng nghỉ ở tiệc đứng). Chạy `node tools/actions/glass-hold.mjs`.
import { emit } from "./emit.mjs";

const SIDES = [
  { arm: "armRight", side: "right", vi: "phải", other: "left" },
  { arm: "armLeft", side: "left", vi: "trái", other: "right" },
];

/** Tay buông của `stand-3d`: mốc không có đích thì cổ tay về chuỗi góc này */
const REST = [-6, 24, 0];
/** Tâm nắm trước bụng trên: khuỷu gập ~90° sát sườn, cẳng tay ra trước, hơi chếch vào giữa thân */
const HOLD = { to: "belly", offset: [22, -12, 15], point: "grip", elbow: [-0.4, 1, 0.5] };
/** Giữa đường lên: cổ tay vòng ra trước bụng thấp hơn đích, món không quệt bụng người bụng phệ */
const MID = { ...HOLD, offset: [30, 6, 17] };
const HAND = { pose: "grip", palm: "in" };
const DURATION = 0.5;

const fmt = (v) => `[${v.map((x) => String(x).replace("-", "−")).join(", ")}]`;

const rows = SIDES.flatMap((s) => {
  const reach = { [s.arm]: HOLD };
  const hand = { [s.arm]: HAND };
  const base = `Chỉ ghi \`${s.arm}\`, \`hand\`. Nền \`stand-3d\`; món ở \`world.hands[].hold\` tay ${s.vi}, ly có chân cầm ở chân ly (nhóm \`cylinder\`, \`slant: 0\`, \`thumb: "up"\`), ý định mặc định của nhóm giữ ly đứng.`;
  const tail = `Chồng được \`turn-head-*\`, \`talk-pose-*\`, nét mặt; uống bằng \`drink-3d\`${s.side === "left" ? " với `mirror: true`" : ""} (blend ~0,3), buông bằng clip rỗng blend ~0,4. Phía kia là \`glass-hold-${s.other}-3d\`. Sinh bằng \`tools/actions/glass-hold.mjs\`.`;
  const where = `tâm nắm đặt vào mốc \`belly\` offset ${fmt(HOLD.offset)} (\`point: "grip"\`), khuỷu gập ~90° sát sườn, chĩa xuống-sau-ngoài`;
  return [
    {
      name: `glass-hold-${s.side}-3d`,
      duration: DURATION,
      end: "hold",
      authoredAt: "side",
      mask: [s.arm, "hand"],
      keys: [
        {
          t: 0,
          pose: { [s.arm]: REST },
          hand: { [s.arm]: { pose: "grip", w: 0.4, palm: "in" } },
          ease: "smooth",
        },
        { t: 0.5, pose: {}, reach: { [s.arm]: MID }, hand, ease: "smooth" },
        { t: 1, pose: {}, reach, hand, ease: "smooth" },
      ],
      note: `Đưa ly lên cầm trước bụng trên rồi giữ (dáng đứng cầm ly ở tiệc): tay ${s.vi} từ tay buông của \`stand-3d\` nhấc lên trong ${String(DURATION).replace(".", ",")} s, vòng qua trước bụng dưới (mốc \`belly\` offset ${fmt(MID.offset)} lúc nửa lượt, món không quệt bụng phệ) rồi ${where}, dáng \`grip\` lòng tay quay vào. ${base} Người nền cầm sẵn từ giây 0 thì dùng \`glass-hold-${s.side}-hold-3d\`. ${tail}`,
      preview: {
        stage: "stand",
        hold: { [s.side]: { item: "coc", group: "cylinder", part: "than", slant: 0 } },
      },
    },
    {
      name: `glass-hold-${s.side}-hold-3d`,
      duration: DURATION,
      end: "hold",
      authoredAt: "side",
      mask: [s.arm, "hand"],
      keys: [{ t: 0, pose: {}, reach, hand, ease: "smooth" }],
      note: `Dáng cuối của \`glass-hold-${s.side}-3d\` từ giây 0, cho người nền đứng cầm ly suốt cảnh: tay ${s.vi} ${where}, dáng \`grip\` lòng tay quay vào. ${base} ${tail}`,
      preview: {
        stage: "stand",
        hold: { [s.side]: { item: "coc", group: "cylinder", part: "than", slant: 0 } },
      },
    },
  ];
});

await emit(rows);
