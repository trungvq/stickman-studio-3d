// Quay đầu về một bên rồi giữ. Chạy `node tools/actions/turn-head.mjs`.
import { emit } from "./emit.mjs";

/** Góc lắc giữ, độ vượt, nghiêng lúc vượt / lúc giữ, `duration`; bản `snap` tới góc trong 0,1 s */
const ANGLES = [
  {
    turn: 35,
    over: 2,
    tilt: [3, 2],
    duration: 0.45,
    use: "nhìn người ngồi cạnh, đầu dẫn trước thân",
  },
  { turn: 70, over: 2, tilt: [4, 3], duration: 0.55, use: "quay hẳn sang nhìn một người" },
  {
    turn: 100,
    over: 4,
    tilt: [4, 3],
    duration: 0.7,
    use: "ngoảnh qua vai nhìn người phía sau, mặt vẫn lộ",
  },
];
const SNAP = { at: 0.1667, peak: 0.3, over: 6, duration: 0.6 };
const SIDES = [
  { side: "near", sign: -1, label: "phía ống kính" },
  { side: "far", sign: 1, label: "phía xa ống kính" },
];

const head = (s, tilt, turn) => ({ head: [-s * tilt, s * turn, null] });
const deg = (x) => String(x).replace(".", ",");

const rows = [];
for (const a of ANGLES)
  for (const snap of a.turn === 35 ? [false] : [false, true])
    for (const s of SIDES) {
      const name = `turn-head-${a.turn}${snap ? "-snap" : ""}-${s.side}-3d`;
      const other = `turn-head-${a.turn}${snap ? "-snap" : ""}-${s.side === "near" ? "far" : "near"}-3d`;
      const keys = snap
        ? [
            { t: 0, pose: head(s.sign, 0, 0), ease: "smooth" },
            { t: SNAP.at, pose: head(s.sign, a.tilt[1], a.turn), ease: "smooth" },
            { t: SNAP.peak, pose: head(s.sign, a.tilt[0], a.turn + SNAP.over), ease: "smooth" },
            { t: 1, pose: head(s.sign, a.tilt[1], a.turn), ease: "smooth" },
          ]
        : [
            { t: 0, pose: head(s.sign, 0, 0), ease: "smooth" },
            { t: 0.7, pose: head(s.sign, a.tilt[0], a.turn + a.over), ease: "smooth" },
            { t: 1, pose: head(s.sign, a.tilt[1], a.turn), ease: "smooth" },
          ];
      const move = snap
        ? `quay ngoắt ${a.turn}° về ${s.label} trong 0,1 s, vượt tới ${a.turn + SNAP.over}° rồi về ${a.turn}°, nghiêng ${a.tilt[1]}° ngược chiều quay; lượt ${deg(SNAP.duration)} s, giữ — quát, giật mình quay lại`
        : `quay đầu ${a.turn}° về ${s.label} (${a.use}), vượt ${a.turn + a.over}° ở 0,7 rồi giữ ${a.turn}°, nghiêng ${a.tilt[1]}° ngược chiều quay; lượt ${deg(a.duration)} s, giữ`;
      rows.push({
        name,
        duration: snap ? SNAP.duration : a.duration,
        end: "hold",
        authoredAt: "side",
        mask: ["head"],
        ...(snap ? { snap: true } : {}),
        keys,
        note: `${move[0].toUpperCase()}${move.slice(1)}. Chỉ ghi nghiêng và lắc của \`head\`, gật để trống. Nền \`stand-3d\`, ngồi thì \`sit-3d\`, quỳ thì \`seiza-3d\`${a.turn === 100 ? "; quay sâu hơn thì đổi `yaw` của người trong cảnh" : ""}. Chồng \`nod-*\` hay đầu cúi lên trên vẫn giữ hướng quay; chiều kia là \`${other}\`, buông bằng clip rỗng blend ~0,4. Sinh bằng \`tools/actions/turn-head.mjs\`.`,
        preview: { stage: "stand" },
      });
    }

await emit(rows);
