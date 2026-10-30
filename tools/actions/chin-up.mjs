// Hất hàm hỏi, thẳng hay về một phía. Chạy `node tools/actions/chin-up.mjs`.
import { emit } from "./emit.mjs";

/** Lắc dương là quay mặt về phía xa ống kính; gật âm là ngửa. Mốc đỉnh ở `peak`, lùi về `hold` ở 1 */
const ROWS = [
  { name: "chin-up-3d", sign: 0, peak: { t: 0.25, turn: 0, up: 12 }, hold: { turn: 0, up: 5 } },
  {
    name: "chin-up-side-near-3d",
    sign: -1,
    label: "phía ống kính",
    peak: { t: 0.35, turn: 15, up: 16 },
    hold: { turn: 10, up: 7 },
  },
  {
    name: "chin-up-side-far-3d",
    sign: 1,
    label: "phía xa ống kính",
    peak: { t: 0.35, turn: 15, up: 16 },
    hold: { turn: 10, up: 7 },
  },
];

const t = (x) => String(x).replace(".", ",");

await emit(
  ROWS.map((r) => {
    const head = (turn, up) => ({ head: [null, r.sign ? r.sign * turn : null, -up] });
    const side = r.sign !== 0;
    const move = side
      ? `Hất cằm về ${r.label}: đầu lắc ${r.peak.turn}°, ngửa ${r.peak.up}° ở ${t(r.peak.t)}, lùi về lắc ${r.hold.turn}°, ngửa ${r.hold.up}° ở 1 (mặt vẫn đọc được); lượt 0,6 s, giữ`
      : `Hất hàm hỏi: đầu ngửa ${r.peak.up}° ở ${t(r.peak.t)} rồi lùi về ${r.hold.up}° ở 1; lượt 0,6 s, giữ`;
    const others = side
      ? `chiều kia là \`chin-up-side-${r.sign < 0 ? "far" : "near"}-3d\`, hất thẳng là \`chin-up-3d\``
      : "hất về một phía là `chin-up-side-near-3d`, `chin-up-side-far-3d`";
    return {
      name: r.name,
      duration: 0.6,
      end: "hold",
      authoredAt: "side",
      mask: ["head"],
      keys: [
        { t: 0, pose: head(0, 0), ease: "smooth" },
        { t: r.peak.t, pose: head(r.peak.turn, r.peak.up), ease: "smooth" },
        { t: 1, pose: head(r.hold.turn, r.hold.up) },
      ],
      note: `${move}. Chỉ ghi ${side ? "lắc và gật" : "gật"} của \`head\`, ${side ? "nghiêng" : "nghiêng và lắc"} để trống. Nền \`stand-3d\`, ngồi thì \`sit-3d\`. Chồng ${side ? "`tilt-head-*`" : "`turn-head-*`, `tilt-head-*`"} vẫn giữ góc của track kia; ${others}, buông bằng clip rỗng blend ~0,4. Sinh bằng \`tools/actions/chin-up.mjs\`.`,
      preview: { stage: "stand" },
    };
  }),
);
