// Chu kỳ đi `walkCycle` cho người 3D, khác `walk` chỉ ở `params` của bộ sinh. Chạy `node tools/actions/walk.mjs`.
import { ACTION_VERSION, actionStride, parseAction } from "../../packages/rig/dist/core/index.js";
import { emit, footfalls } from "./emit.mjs";

const num = (v) => String(v).replace(".", ",");

const WALKS = [
  {
    name: "walk-short",
    duration: 1,
    params: { hip: 14, knee: 40, stance: 0.65, arm: 10, elbow: 18, lean: 1, crouch: 0, dip: 0.5 },
    what: "Đi sải ngắn cho người mặc vạt dài quấn, váy dài ôm: đùi vung nửa tầm",
    tail: "sải `28°` của `walk` làm vạt căng thành khối nêm giữa hai cổ chân (docs/12 § Vạt dài quấn)",
  },
  {
    name: "run-3d",
    duration: 0.38,
    params: { hip: 26, knee: 90, stance: 0.58, arm: 34, elbow: 110, lean: 16, crouch: 0, dip: 1.5 },
    what: "Chạy vội: đùi vung nửa tầm",
    tail: "đùi vung quá `26°` hay `stance` dưới `0,55` (có pha bay) thì mũi giày người 3D lún sàn lúc chạm đất, nên chạy nhanh bằng nhịp ngắn và luôn có chân trụ",
  },
];

function walk({ name, duration, params, what, tail }) {
  const a = {
    schemaVersion: ACTION_VERSION,
    name,
    duration,
    end: "wrap",
    gen: "walkCycle",
    authoredAt: "side",
    params,
  };
  const r = parseAction(a);
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  const stride = Math.round(actionStride(r.data));
  const p = params;
  return {
    ...a,
    events: footfalls(r.data),
    note: [
      `${what} ${p.hip}°, gối gập ${p.knee}°, mỗi chân chạm đất ${num(p.stance)} chu kỳ, tay đánh ${p.arm}° khuỷu ${p.elbow}°, thân ngả ${p.lean}° nhún ${num(p.dip)}°; chu kỳ ${num(duration)} s, lặp, một chu kỳ đi ${stride} đơn vị rig ở \`height\` 1 (\`actionStride\`) — ${tail}.`,
      "Bộ sinh ghi hai tay, hai chân, thân; không ghi bàn tay.",
      `Đặt ở track thân trên \`world.path\` (nền \`stand-3d\` trước và sau đoạn đi): tốc độ \`path\` tự nhiên ${Math.round(stride / duration)} · \`height\` đơn vị/s, rig co giãn nhịp chân theo \`path\`.`,
      `Người bưng đồ đặt cổ tay bằng \`world.hands\`; dừng thì nối \`stand-3d\` blend ~0,3 ngay trước mốc dừng. Cùng họ: \`walk\`, ${WALKS.filter(
        (w) => w.name !== name,
      )
        .map((w) => `\`${w.name}\``)
        .join(", ")}. Sinh bằng \`tools/actions/walk.mjs\`.`,
    ].join(" "),
    preview: { stage: "stand" },
  };
}

await emit(WALKS.map(walk));
