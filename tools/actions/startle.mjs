// Giật mình: thân bật ra sau, hai tay vụt lên trước ngực; bản `-step-back` rụt một chân ra sau tại chỗ. Chạy
// `node tools/actions/startle.mjs`.
import { RIG } from "../../packages/rig/dist/core/index.js";
import { emit } from "./emit.mjs";

/** Bàn chân phải đặt sau chỗ cũ chừng này, đơn vị rig ở `height = 1`; hông đứng yên trên bàn chân trái */
const BACK = 42;
const BACK_DEG = -Math.round((Math.asin(BACK / (RIG.thigh + RIG.shin)) * 180) / Math.PI);
/** Chân phải `[giây, góc]`: nhấc gần thẳng đứng (gối gập, đùi ra trước giữ cổ chân dưới hông), lùi trên cao, đặt xuống */
const LIFT = [
  [0.1, [10, -22]],
  [0.24, [10, -38]],
];
const PLANT = 0.36;
const STAND_LEGS = { legLeft: [1, 0], legRight: [-1, 0] };

/** Mốc thân trên: giây, thân, gật đầu, đích cổ tay hệ thân của hai tay, độ xoè */
const UPPER = [
  { t: 0.12, torso: -9, head: -14, hands: [52, -102, 46], w: 1 },
  { t: 0.5, torso: -5, head: -6, hands: [48, -86, 48], w: 0.7 },
];
const STAND_ARMS = [-6, 24, 0];
const REST = { w: 0.3, turn: 0, bend: 0 };
const ELBOW = [-0.3, 1, 0.9];

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const num = (v) => String(v).replace(".", ",");

const upperKey = (dur, u, last) => ({
  t: r4(u.t / dur),
  pose: { torso: u.torso, head: [null, null, u.head] },
  reach: {
    armRight: { at: u.hands, elbow: ELBOW },
    armLeft: { at: u.hands, elbow: ELBOW },
  },
  hand: {
    armRight: { pose: "open", w: u.w, palm: "forward", fingers: [0.3, -1, 0.3] },
    armLeft: { pose: "open", w: u.w, palm: "forward", fingers: [0.3, -1, 0.3] },
  },
  ...(!last && { ease: "smooth" }),
});

function startle(name, dur, step) {
  const first = {
    t: 0,
    pose: { armRight: STAND_ARMS, armLeft: STAND_ARMS, torso: 0, head: [null, null, 0] },
    hand: { armRight: REST, armLeft: REST },
    ease: "smooth",
  };
  const upper = UPPER.map((u, i) => upperKey(dur, u, i === UPPER.length - 1));
  const hold = { ...upper.at(-1), t: 1 };
  upper.at(-1).ease = "smooth";
  const keys = [first, ...upper, hold];
  if (step) {
    Object.assign(first.pose, STAND_LEGS);
    Object.assign(hold.pose, { legLeft: STAND_LEGS.legLeft, legRight: [BACK_DEG, 0] });
    keys.push(
      ...LIFT.map(([sec, legRight]) => ({
        t: r4(sec / dur),
        pose: { legLeft: STAND_LEGS.legLeft, legRight },
        ease: "auto",
      })),
      {
        t: r4(PLANT / dur),
        pose: { legLeft: STAND_LEGS.legLeft, legRight: [BACK_DEG, 0] },
        ease: "smooth",
      },
    );
    keys.sort((a, b) => a.t - b.t);
  }
  const [peak, settle] = UPPER;
  return {
    name,
    duration: dur,
    end: "hold",
    authoredAt: "side",
    mask: [
      "armRight",
      "armLeft",
      "hand",
      "torso",
      "head",
      ...(step ? ["legRight", "legLeft"] : []),
    ],
    snap: true,
    keys,
    note: [
      `Giật mình${step ? " lùi một bước" : ""}: trong ${num(peak.t)} s thân bật ra sau ${-peak.torso}°, đầu ngửa ${-peak.head}°, hai tay vụt lên trước ngực (đích cổ tay hệ thân [${peak.hands.join(", ")}]), bàn tay xoè, lòng tay ra trước; lúc ${num(settle.t)} s về thân ${settle.torso}°, đầu ${settle.head}°, tay hạ một chút, giữ. Khai \`snap\`.`,
      step
        ? `Chân phải nhấc lên, đặt ra sau ${BACK} (đùi ${BACK_DEG}°) lúc ${num(PLANT)} s, hông đứng yên trên chân trái. Ghi hai tay, \`hand\`, \`torso\`, gật của \`head\`, hai chân.`
        : "Ghi hai tay, `hand`, `torso` và gật của `head`.",
      step
        ? "Nền `stand-3d`, người đứng một chỗ (`world.at`), hông không dời; lùi hẳn ra sau thì nối hành động bước lùi trên `world.path`."
        : "Nền `stand-3d`, ngồi thì `sit-3d`.",
      `Chồng nét mặt \`face-shocked\`, \`face-surprised\`; buông về nền blend ~0,4. Cùng họ: \`startle-3d\` tại chỗ, \`startle-step-back-3d\` lùi một bước. Sinh bằng \`tools/actions/startle.mjs\`.`,
    ].join(" "),
    preview: { stage: "stand" },
  };
}

await emit([startle("startle-3d", 0.7, false), startle("startle-step-back-3d", 0.7, true)]);
