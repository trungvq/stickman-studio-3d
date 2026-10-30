// Vỗ vai người đứng cạnh về một phía. Chạy `node tools/actions/pat-shoulder.mjs`.
import { emit } from "./emit.mjs";

/** `s` là dấu của nghiêng thân: âm về phía tay gần */
const ROWS = [
  {
    name: "pat-shoulder-near-3d",
    arm: "armNear",
    s: -1,
    side: "gần",
    mirror: "pat-shoulder-far-3d",
  },
  { name: "pat-shoulder-far-3d", arm: "armFar", s: 1, side: "xa", mirror: "pat-shoulder-near-3d" },
];

/**
 * Người được vỗ đứng phía tay ấy, trước `AHEAD`, ngang `BESIDE` so với hông ở `height = 1`, mặt cùng hướng; xem thử thì người
 * ấy xoay `TOWARD` độ về người vỗ
 */
const AHEAD = 30;
const TOWARD = 20;
const BESIDE = 165;
const DURATION = 1.7;
const REST = [-6, 24, 0];
const ELBOW = [-0.3, 1, 0.2];
/** Lòng tay áp mặt ngoài vai người kia, dưới nắp vai: nắp vai nằm dưới đầu chibi, tay lên đó thì cẳng tay lồng vào đầu */
const ON = [34, -110, 100];
/** Nhấc ra về phía mình giữa hai nhịp, không nhấc lên: khuỷu lên quá vai thì cánh tay vào đầu người kia */
const LIFT = [36, -108, 90];
const UP = [44, -102, 84];
const AWAY = [44, -100, 84];
const DOWN = [52, -40, 64];
/** Chỉ khai lòng tay: khai cả ngón thì rig xoay khuỷu lên cao */
const PALM = { pose: "open", palm: [0, 0.5, 1] };
const DOWN_HAND = { w: 0.6, turn: 0, bend: 0 };
const REST_HAND = { w: 0.3, turn: 0, bend: 0 };

await emit(
  ROWS.map((r) => {
    const key = (s, torso, reach, hand) => ({
      t: +(s / DURATION).toFixed(4),
      pose: { ...(!reach && { [r.arm]: REST }), torso: [torso[0], r.s * torso[1]] },
      ...(reach && { reach: { [r.arm]: reach } }),
      hand: { [r.arm]: hand },
      ease: "smooth",
    });
    const at = (p, elbow = ELBOW) => ({ at: p, point: "palm", elbow });
    const on = { ...PALM, w: 1, bend: 10 };
    return {
      name: r.name,
      duration: DURATION,
      end: "hold",
      authoredAt: "side",
      snap: true,
      mask: [r.arm, "hand", "torso"],
      keys: [
        key(0, [0, 0], undefined, REST_HAND),
        key(0.3, [2, 3], at(UP), { ...PALM, w: 1 }),
        key(0.42, [2, 4], at(ON), on),
        key(0.58, [2, 4], at(LIFT), { ...PALM, w: 1, bend: -10 }),
        key(0.7, [2, 4], at(ON), on),
        key(1.05, [2, 4], at(ON), on),
        key(1.22, [1, 3], at(AWAY), { ...PALM, w: 0.8 }),
        key(1.4, [1, 1], at(DOWN, [-0.4, 1, 0.6]), DOWN_HAND),
        key(DURATION, [0, 0], undefined, REST_HAND),
      ],
      note: `Vỗ vai người đứng cạnh phía tay ${r.side} hai nhịp rồi buông: tay ${r.side} đưa lên (0,3 s), áp lòng tay lên mặt ngoài vai người kia ngay dưới nắp vai (đích hệ thân [${ON.join(", ")}], \`point: "palm"\`, lòng tay úp-ra, 0,42 s), nhấc ra về phía mình rồi vỗ lại (0,7 s), giữ tới 1,05 s, rút về rồi hạ về tay buông của \`stand-3d\` lúc 1,7 s; thân cúi 2°, nghiêng 4° về phía ấy; \`snap\`. Chỉ ghi tay ${r.side}, \`hand\`, \`torso\`. Nền \`stand-3d\`; người được vỗ cùng cao, đứng phía tay ${r.side}, hông trước ${AHEAD}, ngang ${BESIDE} ở \`height\` 1, mặt cùng hướng hay xoay về người vỗ — gần hơn thì hai đầu chibi chạm nhau; đứng chỗ khác hay cao thấp khác thì đặt \`world.hands\` tới vai đo bằng \`scene_probe\`. Người phía kia thì \`${r.mirror}\`. Sinh bằng \`tools/actions/pat-shoulder.mjs\`.`,
      preview: {
        stage: "stand",
        partner: {
          at: [AHEAD, -r.s * BESIDE],
          yaw: -r.s * (105 - TOWARD),
        },
      },
    };
  }),
);
