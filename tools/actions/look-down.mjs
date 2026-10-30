// Cúi nhìn vật trong tay rồi giữ. Chạy `node tools/actions/look-down.mjs`.
import { emit } from "./emit.mjs";

/** Góc gật giữ; bản `hold` cúi sẵn từ giây 0 */
const ANGLES = [
  { nod: 12, use: "liếc xuống món cầm trước bụng, điện thoại" },
  { nod: 20, use: "đọc sổ, nhìn kẹp hồ sơ, món cầm trước ngực" },
];

const nod = (x) => ({ head: [null, null, x] });

const rows = [];
for (const a of ANGLES)
  for (const hold of [false, true]) {
    const name = `look-down-${a.nod}${hold ? "-hold" : ""}-3d`;
    const twin = `look-down-${a.nod}${hold ? "" : "-hold"}-3d`;
    const other = `look-down-${a.nod === 12 ? 20 : 12}-3d`;
    rows.push({
      name,
      duration: 0.5,
      end: "hold",
      authoredAt: "side",
      mask: ["head"],
      keys: hold
        ? [
            { t: 0, pose: nod(a.nod), ease: "smooth" },
            { t: 1, pose: nod(a.nod) },
          ]
        : [
            { t: 0, pose: nod(0), ease: "smooth" },
            { t: 1, pose: nod(a.nod) },
          ],
      note: `Cúi nhìn vật trong tay (${a.use}): gật ${hold ? `${a.nod}° ngay từ giây 0` : `từ 0 tới ${a.nod}° trong 0,5 s`} rồi giữ. Chỉ ghi gật của \`head\`, nghiêng và lắc để trống. Nền \`stand-3d\`, ngồi thì \`sit-3d\`; tay cầm món là track riêng. Chồng lên \`turn-head-*\` vẫn giữ hướng quay; ${hold ? `vào dần là \`${twin}\`` : `cắt vào giữa động tác hay người nền thì \`${twin}\``}, cúi ${a.nod === 12 ? "sâu hơn" : "nhẹ hơn"} là \`${other}\`, buông bằng clip rỗng blend ~0,4. Sinh bằng \`tools/actions/look-down.mjs\`.`,
      preview: { stage: "stand" },
    });
  }

await emit(rows);
