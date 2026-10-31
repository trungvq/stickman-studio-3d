// Hai bước ngắn tiến / lùi rồi khép chân cho người 3D theo `path`. Không lấy `walk` phát ngược: luật chân chịu lực chỉ
// nhận chân mới khi nó ngừng tiến, chu kỳ đi phát ngược ra sải dương. Mỗi bước là chân nhấc, đặt xuống, rồi hai chân
// cùng trụ dồn hông sang. Chạy `node tools/actions/steps.mjs`.
import {
  ACTION_VERSION,
  POSES,
  actionPose,
  actionStride,
  bakeTravel,
  composePose,
  parseAction,
  travelAt,
} from "../../packages/rig/dist/core/index.js";
import { emit, footfalls } from "./emit.mjs";

const num = (v) => String(v).replace(".", ",");

/** Bản lùi `[t, phải [hông, gối], trái [hông, gối], thân]`, hông dương là đùi ra trước; `a` là góc chân lúc hai chân cùng trụ */
const back = (a) => [
  [0, [0, 0], [0, 0], 0],
  [0.12, [30, -70], [3, 0], -1], // chân phải nhấc cao, bàn chân ngay dưới hông; chân trái trụ
  [0.27, [-a, 0], [a, 0], -2], // duỗi ra sau mà hạ: bàn chân đang lùi nên rig nhận là chân trụ
  [0.4, [0, 0], [30, -70], -1], // dồn hông về sau trên chân phải, chân trái nhấc cao
  [0.55, [a, 0], [-a, 0], -2],
  [0.72, [26, -60], [-3, 0], -1], // dồn hông trên chân trái, chân phải nhấc
  [1, [0, 0], [0, 0], 0],
];
/** Bản tiến: chân trụ lật dấu, chân đang nhấc giữ dáng (bàn chân dưới hông rồi duỗi ra trước mà hạ) */
const fwd = (a) =>
  back(a).map(([t, n, f, th]) => [t, n[1] ? n : [-n[0], 0], f[1] ? f : [-f[0], 0], -th]);

const STEPS = [
  { name: "steps-3d", duration: 1.1, keys: fwd(7), dir: "Tiến", other: "steps-back-3d" },
  { name: "steps-back-3d", duration: 1.1, keys: back(11), dir: "Lùi", other: "steps-3d" },
];

function steps({ name, duration, keys, dir, other }) {
  const a = {
    schemaVersion: ACTION_VERSION,
    name,
    duration,
    end: "hold",
    mask: ["legRight", "legLeft", "torso"],
    authoredAt: "side",
    keys: keys.map(([t, n, f, th]) => ({
      t,
      pose: { legRight: n, legLeft: f, torso: th },
      ease: "smooth",
    })),
  };
  const r = parseAction(a);
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  const go = Math.round(actionStride(r.data));
  // hông đi không đều (dồn nhanh lúc hai chân cùng trụ): `path` theo đúng đường hông ở các mốc hai chân cùng trụ
  const lift = { ll: true, lr: true };
  const tb = bakeTravel(
    (u) => ({ ...composePose(POSES.idle, actionPose(r.data, u)), lift }),
    1,
    true,
  );
  const path = keys
    .filter(([, n, f]) => !n[1] && !f[1])
    .map(([t]) => ({
      t: Math.round(t * duration * 1e3) / 1e3,
      at: [Math.round(travelAt(tb, t)), 0],
    }));
  return {
    ...a,
    // chân phải khép về đặt cạnh chân trụ, không dời hông nên luật chân chịu lực không đếm: tiếng bước cuối ở `t` 1
    events: [...footfalls(r.data), { name: "step", t: 1 }],
    note: [
      `${dir} hai bước ngắn rồi khép chân, mặt giữ hướng cũ: chân phải nhấc, đặt ${dir === "Lùi" ? "ra sau" : "ra trước"}, dồn hông, tới chân trái, rồi chân phải khép về; ${num(duration)} s rồi giữ đứng khép, quãng ${Math.abs(go)} đơn vị rig ở \`height\` 1 (\`actionStride\` ${go}).`,
      "Chỉ ghi hai chân, `torso`.",
      `Nền \`stand-3d\`; người có \`world.path\` dời đúng quãng ấy ${dir === "Lùi" ? "ra sau lưng" : "về trước mặt"} trong ${num(duration)} s, \`yaw\` giữ nguyên (\`preview.path\` theo đúng đường hông; hai mốc đều cũng được, rig co giãn nhịp chân).`,
      `Tay để cảnh (\`world.hands\` khi bưng đồ). Vào clip và thả về nền (clip rỗng ngay khi \`path\` dừng) đều blend ~0,1; nối \`${other}\` để về chỗ cũ. Sinh bằng \`tools/actions/steps.mjs\`.`,
    ].join(" "),
    preview: {
      stage: "stand",
      path,
    },
  };
}

await emit(STEPS.map(steps));
