// Cúi chào chỉ bằng thân và đầu. Chạy `node tools/actions/bow.mjs`.
import { emit } from "./emit.mjs";

/** Thân cúi, đầu gật thêm, giây cúi xuống, giữ ở đáy, đứng lên */
const LEVELS = {
  15: { torso: 15, head: 6, down: 0.3, hold: 0.4, up: 0.3 },
  30: { torso: 30, head: 5, down: 0.4, hold: 0.5, up: 0.5 },
  45: { torso: 45, head: 3, down: 0.55, hold: 1.2, up: 0.7 },
};
/** Cúi vội: xuống nhanh, đầu gập sâu hơn, giữ ngắn */
const QUICK = {
  15: { torso: 15, head: 10, down: 0.15, hold: 0.15, up: 0.25 },
  30: { torso: 30, head: 9, down: 0.2, hold: 0.2, up: 0.35 },
};
/** Gập ngay: tới đáy quá đà `over` độ ở 0,14 s, nảy về đáy ở 0,3 s rồi giữ */
const SNAP = { over: 5, at: 0.14, settle: 0.3, duration: 1 };

const num = (v) => String(Math.round(v * 100) / 100).replace(".", ",");
const pose = (torso, head) => ({ torso, head: [0, 0, head] });
/** Đích tay hệ thân (`reach.at`) đứng yên khi thân cúi: thân cúi sâu đổ lên cẳng tay bưng sát eo */
const OVER = {
  15: "chồng được lên tay bưng khay, cầm món sát eo (đích cổ tay ~40 ra trước)",
  30: "chồng lên tay bưng khay, cầm món thì đích cổ tay phải ra trước ~65 trở lên, sát eo hơn thì thân đổ lên cẳng tay",
  45: "không chồng lên tay bưng khay, cầm món trước bụng: thân đổ lên cẳng tay — dùng góc 15° hay 30°",
};
const tail = (deg) =>
  `Chỉ ghi \`torso\`, \`head\`. Nền \`stand-3d\`. Đích tay hệ thân (\`reach.at\`) không theo thân cúi nên món giữ ngang; ${OVER[deg]}. Tay chắp trước bụng theo thân cúi thì dùng \`bow-hands-front-*\`.`;
const family =
  "Cùng họ: `bow-15-3d`, `bow-30-3d`, `bow-45-3d`, `-quick` cúi vội, `-snap` gập ngay rồi nảy, `-hold` giữ ở đáy. Sinh bằng `tools/actions/bow.mjs`.";

/** Cúi xuống, giữ, đứng lên rồi giữ đứng */
function full(name, deg, l, what) {
  const d = l.down + l.hold + l.up;
  const r = (s) => Math.round((s / d) * 1e4) / 1e4;
  return {
    name,
    duration: Math.round(d * 100) / 100,
    end: "hold",
    authoredAt: "side",
    mask: ["torso", "head"],
    keys: [
      { t: 0, pose: pose(0, 0), ease: "smooth" },
      { t: r(l.down), pose: pose(l.torso, l.head), ease: "smooth" },
      { t: r(l.down + l.hold), pose: pose(l.torso, l.head), ease: "smooth" },
      { t: 1, pose: pose(0, 0) },
    ],
    note: `${what} ${l.torso}° một lần: thân cúi ${l.torso}°, đầu gật thêm ${l.head}°, xuống trong ${num(l.down)} s, giữ ${num(l.hold)} s, đứng thẳng lên lúc ${num(d)} s rồi giữ đứng. ${tail(deg)} ${family}`,
    preview: { stage: "stand" },
  };
}

const actions = [];
for (const [deg, l] of Object.entries(LEVELS)) {
  actions.push(full(`bow-${deg}-3d`, deg, l, "Cúi chào"));
  actions.push({
    name: `bow-${deg}-hold-3d`,
    duration: 1,
    end: "hold",
    authoredAt: "side",
    mask: ["torso", "head"],
    keys: [
      { t: 0, pose: pose(l.torso, l.head) },
      { t: 1, pose: pose(l.torso, l.head) },
    ],
    note: `Giữ ở đáy cái cúi chào ${deg}° từ giây 0: thân ${l.torso}°, đầu gật thêm ${l.head}°, như đáy của \`bow-${deg}-3d\` — cho người nền, ảnh tĩnh, cảnh cắt vào giữa cái cúi; đứng lên bằng clip rỗng blend ~0,5. ${tail(deg)} ${family}`,
    preview: { stage: "stand" },
  });
}
for (const [deg, l] of Object.entries(QUICK))
  actions.push(full(`bow-${deg}-quick-3d`, deg, l, "Cúi vội, gật nhanh"));
for (const deg of [30, 45]) {
  const l = LEVELS[deg];
  actions.push({
    name: `bow-${deg}-snap-3d`,
    duration: SNAP.duration,
    end: "hold",
    authoredAt: "side",
    snap: true,
    mask: ["torso", "head"],
    keys: [
      { t: 0, pose: pose(0, 0), ease: "smooth" },
      { t: SNAP.at, pose: pose(l.torso + SNAP.over, l.head + 2), ease: "linear" },
      { t: SNAP.settle, pose: pose(l.torso, l.head), ease: "smooth" },
      { t: 1, pose: pose(l.torso, l.head) },
    ],
    note: `Gập người xin lỗi hoảng hốt: thân gập ngay tới ${l.torso + SNAP.over}° trong ${num(SNAP.at)} s (đầu gật thêm ${l.head + 2}°), nảy về ${l.torso}° lúc ${num(SNAP.settle)} s rồi giữ ở đáy; khai \`snap\` vì cố ý giật. ${tail(deg)} Đứng lên bằng clip rỗng blend ~0,5. ${family}`,
    preview: { stage: "stand" },
  });
}

await emit(actions);
