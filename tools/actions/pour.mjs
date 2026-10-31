// Rót: một tay (`pour-3d`) và rót mời khách hai tay (`pour-serve-*`). Chạy `node tools/actions/pour.mjs`. Phép tính ở
// `packages/cli/gen-pour.mjs`, cùng chỗ với `stickman gen pour` của repo video.
import {
  BINH,
  POUR_TIMING,
  SERVE,
  SINGLE,
  measuredLink,
  pourAction,
  pourHold,
  pourHoldNote,
} from "../../packages/cli/gen-pour.mjs";
import { emit } from "./emit.mjs";

const ROWS = [
  {
    name: "pour-3d",
    stage: "stand",
    k: SINGLE,
    note: `Rót một tay (nước, bia, rượu): tay phải nắm thân bình trước ngực lệch phải (mốc \`chest\`), vòi quay vào giữa thân; ${POUR_TIMING}. Cẳng tay sấp dần, khuỷu nhấc dần ra ngoài, bình nghiêng ${SINGLE.tilt[0]} → ${SINGLE.tilt[1]}°; thân cúi ${SINGLE.torso[0]} → ${SINGLE.torso[1]}°. Ghi tay phải, \`hand\`, \`torso\`; tay trái để cho nền. Nền \`stand-3d\`, \`sit-3d\`; món ở \`world.hands[].hold\` tay phải, ${pourHoldNote(SINGLE)}. Miệng cốc hứng ở trước bụng gần giữa thân, thấp hơn mốc \`chest\` ~${SINGLE.lip[1] + 4}. Rót mời khách hai tay là \`pour-serve-3d\`. Sinh bằng \`tools/actions/pour.mjs\`.`,
  },
  {
    name: "pour-serve-3d",
    stage: "stand",
    k: SERVE,
    partner: true,
    note: `Rót mời khách bằng hai tay: tay phải nắm thân bình trước ngực (mốc \`chest\`), tay trái đỡ dưới đáy, vòi về trước-phải; ${POUR_TIMING}. Cẳng tay phải ngửa dần, khuỷu khép dần vào, bình nghiêng ${SERVE.tilt[0]} → ${SERVE.tilt[1]}°; thân cúi ${SERVE.torso[0]} → ${SERVE.torso[1]}°. Ghi hai tay, \`hand\`, \`torso\`. Nền \`stand-3d\`; món ở \`world.hands[].hold\` tay phải, ${pourHoldNote(SERVE)}, và \`both: { group: "platform", psi: -90 }\`: lòng tay trái ngửa đỡ đáy theo bình suốt lượt; mốc tay trái của hành động chỉ cho hướng khuỷu. Người nhận chìa chén bằng \`offer-cup-3d\` ở trước-phải, miệng chén ngay dưới miệng bình. Quỳ seiza là \`pour-serve-kneel-3d\`, rót một tay là \`pour-3d\`. Sinh bằng \`tools/actions/pour.mjs\`.`,
  },
  {
    name: "pour-serve-kneel-3d",
    stage: "floor",
    k: SERVE,
    note: `Rót mời khách bằng hai tay khi quỳ seiza: như \`pour-serve-3d\` — tay phải nắm thân bình trước ngực (mốc \`chest\`), tay trái đỡ dưới đáy, vòi về trước-phải; ${POUR_TIMING}. Ghi hai tay, \`hand\`, \`torso\`. Nền \`seiza-3d\` trên đệm sàn; món ở \`world.hands[].hold\` tay phải như \`pour-serve-3d\` (\`keep\`, \`slant: 0\`, \`along: ${BINH.along}\`, \`around: ${SERVE.around}\`, \`both: { group: "platform", psi: -90 }\`). Người nhận quỳ chìa chén ở trước-phải, miệng chén ngay dưới miệng bình. Sinh bằng \`tools/actions/pour.mjs\`.`,
  },
];

await emit(
  ROWS.map((r) =>
    pourAction(r.k, measuredLink({ ...BINH, around: r.k.around }), {
      name: r.name,
      note: r.note,
      preview: {
        stage: r.stage,
        hold: { right: pourHold(r.k) },
        ...(r.partner && {
          partner: {
            at: [170, 100],
            yaw: -50,
            action: "offer-cup-3d",
            hold: { right: "chen@bowl" },
          },
        }),
      },
    }),
  ),
);
