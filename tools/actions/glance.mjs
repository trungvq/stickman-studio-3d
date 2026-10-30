// Liếc một bên. Chạy `node tools/actions/glance.mjs`.
import { emit } from "./emit.mjs";

/** Lắc dương là quay mặt về phía xa ống kính; nghiêng ngược chiều quay, gật âm là ngửa */
const SIDES = [
  { side: "near", sign: -1, label: "phía ống kính" },
  { side: "far", sign: 1, label: "phía xa ống kính" },
];

const DOWN = { turn: 30, nod: 14 };
const UP = { over: [9, 32, -7], hold: [8, 30, -6] };

const rows = [];
for (const s of SIDES) {
  const other = s.side === "near" ? "far" : "near";
  rows.push({
    name: `glance-${s.side}-3d`,
    duration: 1.4,
    end: "hold",
    authoredAt: "side",
    mask: ["head"],
    keys: [
      { t: 0, pose: { head: [null, 0, 0] }, ease: "smooth" },
      { t: 0.18, pose: { head: [null, s.sign * DOWN.turn, DOWN.nod] }, ease: "linear" },
      { t: 0.64, pose: { head: [null, s.sign * DOWN.turn, DOWN.nod] }, ease: "smooth" },
      { t: 1, pose: { head: [null, 0, 0] } },
    ],
    note: `Liếc xuống ${s.label} một cái rồi về: đầu lắc ${DOWN.turn}°, gật ${DOWN.nod}° ở 0,18, giữ tới 0,64, về thẳng ở 1; lượt 1,4 s, giữ dáng thẳng ở cuối. Chỉ ghi lắc và gật của \`head\`, nghiêng để trống. Nền \`stand-3d\`, ngồi thì \`sit-3d\`. Chồng lên mọi track thân, tay; chiều kia là \`glance-${other}-3d\`, liếc lên là \`glance-up-${s.side}-3d\`. Sinh bằng \`tools/actions/glance.mjs\`.`,
    preview: { stage: "stand" },
  });
  const head = ([tilt, turn, nod]) => ({ head: [-s.sign * tilt, s.sign * turn, nod] });
  rows.push({
    name: `glance-up-${s.side}-3d`,
    duration: 0.5,
    end: "hold",
    authoredAt: "side",
    mask: ["head"],
    keys: [
      { t: 0, pose: head([0, 0, 0]), ease: "smooth" },
      { t: 0.7, pose: head(UP.over), ease: "smooth" },
      { t: 1, pose: head(UP.hold), ease: "smooth" },
    ],
    note: `Liếc lên ${s.label} rồi giữ, làm duyên: đầu lắc ${UP.over[1]}°, ngửa ${-UP.over[2]}°, nghiêng ${UP.over[0]}° ngược chiều quay ở 0,7, lùi về ${UP.hold[1]}°, ${-UP.hold[2]}°, ${UP.hold[0]}° ở 1; lượt 0,5 s, giữ. Ghi đủ ba góc của \`head\`. Nền \`stand-3d\`, ngồi thì \`sit-3d\` liếc lên người đứng cạnh bàn. Chồng lên mọi track thân, tay; chiều kia là \`glance-up-${other}-3d\`, buông bằng clip rỗng blend ~0,4. Sinh bằng \`tools/actions/glance.mjs\`.`,
    preview: { stage: "stand" },
  });
}

await emit(rows);
