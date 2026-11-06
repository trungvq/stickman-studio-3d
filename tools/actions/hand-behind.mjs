// Chắp một tay sau lưng, tay kia tự do. Chạy `node tools/actions/hand-behind.mjs`.
import { emit } from "./emit.mjs";

/** Tay chắp sau lưng */
const ROWS = [
  { name: "hand-behind-right-3d", arm: "armRight", side: "phải", other: "hand-behind-left-3d" },
  { name: "hand-behind-left-3d", arm: "armLeft", side: "trái", other: "hand-behind-right-3d" },
];

/** Tay buông của `stand-3d` */
const DOWN = [-6, 24, 0];
const DOWN_HAND = { pose: "fist", w: 0, palm: "in" };
/** Mu tay áp giữa lưng ngang thắt lưng, sát đường giữa; khuỷu ra sau-ngoài */
const BACK = { to: "back", offset: [-4, 6, 2], point: "back", elbow: [-0.6, 0.6, 1] };
const BACK_HAND = { pose: "fist", w: 0.5, palm: "back" };
/** Giữa đường: tay vòng ra sau hông, ngoài mông, chưa vào lưng — đi thẳng từ tay buông tới lưng thì cẳng tay lấn sườn */
const MID = { to: "hip", offset: [-18, 4, 4], point: "back", elbow: [-0.8, 0.3, 0.6] };
const MID_HAND = { pose: "fist", w: 0.3 };
const MID_T = 0.5;
/** Giây vào dáng */
const IN = 0.5;

const num = (v) => String(v).replace(".", ",");
const tail = (r) =>
  `Chỉ ghi \`${r.arm}\`, \`hand\`; tay kia để cảnh — cầm chai, chìa mời, chỉ bằng track hay \`world.hands\` của tay ấy. Nền \`stand-3d\` hay \`walk\`; mốc \`back\` theo áo (gồm bụng phệ) nên đúng mọi cỡ người. Chồng được cúi chào, đầu, nhún thân và cử chỉ chỉ ghi tay kia (\`talk-forward-3d\`, \`wave-*\`, \`thumbs-up-3d\`; tay kia là tay trái thì \`mirror: true\`); hành động mở từ tay chồng trước bụng (\`invite-*\`: mốc đầu \`otherBack\`) kéo tay kia ra sau lưng tìm mu tay này, đừng chồng. Buông bằng clip rỗng blend ~0,4. Cùng họ: \`${r.other}\` tay kia, \`-hold\` dáng cuối từ giây 0, \`hands-behind-3d\` hai tay. Sinh bằng \`tools/actions/hand-behind.mjs\`.`;
const what = (r) =>
  `Chắp tay ${r.side} sau lưng (dáng bồi bàn, sommelier đứng hầu): mu tay (\`point: back\`) áp mốc \`back\` (giữa lưng ngang thắt lưng, offset [${BACK.offset.map((v) => String(v).replace("-", "−")).join(", ")}]), nắm hờ, lòng tay ra sau, khuỷu chĩa ra sau-ngoài`;

const actions = [];
for (const r of ROWS) {
  const at = (pose, reach, hand) => ({
    pose,
    ...(reach ? { reach: { [r.arm]: reach } } : {}),
    hand: { [r.arm]: hand },
    ease: "smooth",
  });
  actions.push({
    name: r.name,
    duration: IN,
    end: "hold",
    authoredAt: "side",
    mask: [r.arm, "hand"],
    keys: [
      { t: 0, ...at({ [r.arm]: DOWN }, null, DOWN_HAND) },
      { t: MID_T, ...at({}, MID, MID_HAND) },
      { t: 1, ...at({}, BACK, BACK_HAND) },
    ],
    note: `${what(r)}; từ tay buông của \`stand-3d\` vào dáng trong ${num(IN)} s rồi giữ. ${tail(r)}`,
    preview: { stage: "stand" },
  });
  actions.push({
    name: r.name.replace(/-3d$/, "-hold-3d"),
    duration: 1,
    end: "hold",
    authoredAt: "side",
    mask: [r.arm, "hand"],
    keys: [{ t: 0, ...at({}, BACK, BACK_HAND) }],
    note: `${what(r)}; dáng cuối của \`${r.name}\` từ giây 0, vào bằng blend của clip. ${tail(r)}`,
    preview: { stage: "stand" },
  });
}

await emit(actions);
