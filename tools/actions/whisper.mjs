// Ghé sang người bên cạnh thì thầm về một phía. Chạy `node tools/actions/whisper.mjs`.
import { emit } from "./emit.mjs";

/** `s` là dấu của nghiêng thân, nghiêng và lắc đầu: âm về phía tay gần */
const ROWS = [
  { name: "whisper-near-3d", arm: "armNear", s: -1, side: "gần", mirror: "whisper-far-3d" },
  { name: "whisper-far-3d", arm: "armFar", s: 1, side: "xa", mirror: "whisper-near-3d" },
];

/** Người nghe đứng ngang hàng phía tay ấy, hai hông cách `APART` ở `height = 1`; xem thử thì người ấy xoay `TOWARD` độ về người nói */
const APART = 195;
const TOWARD = 20;
const REST = [-6, 24, 0];
const ELBOW = [0, 0.8, 1];
const CUP = { pose: "cup", palm: [0.6, 0, -1], fingers: [0.15, -1, -0.1] };
const CHIN = { to: "chin", offset: [14, 8, 16], elbow: ELBOW };
const MOUTH = { to: "mouth", offset: [10, 11, 21], elbow: ELBOW };
const LEAN = 12;
const TURN = 28;

await emit(
  ROWS.map((r) => {
    const torso = (bow, lean) => [bow, r.s * lean];
    const head = (tilt, turn, nod) => [r.s * tilt, r.s * turn, nod];
    return {
      name: r.name,
      duration: 1,
      end: "hold",
      authoredAt: "side",
      mask: [r.arm, "hand", "torso", "head"],
      keys: [
        {
          t: 0,
          pose: { [r.arm]: REST, torso: torso(0, 0), head: head(0, 0, 0) },
          hand: { [r.arm]: { w: 0.3, turn: 0, bend: 0 } },
          ease: "smooth",
        },
        {
          t: 0.25,
          pose: { torso: torso(3, LEAN / 2) },
          reach: { [r.arm]: CHIN },
          hand: { [r.arm]: { ...CUP, w: 0.5 } },
          ease: "smooth",
        },
        {
          t: 0.5,
          pose: { torso: torso(6, LEAN), head: head(12, TURN, 6) },
          reach: { [r.arm]: MOUTH },
          hand: { [r.arm]: { ...CUP, w: 0.65 } },
          ease: "smooth",
        },
        {
          t: 1,
          pose: { torso: torso(6, LEAN), head: head(12, TURN, 6) },
          reach: { [r.arm]: MOUTH },
          hand: { [r.arm]: { ...CUP, w: 0.65 } },
          ease: "linear",
        },
      ],
      note: `Ghé sang người đứng ngang hàng phía tay ${r.side} thì thầm: thân cúi 6°, nghiêng ${LEAN}° về phía ấy, đầu nghiêng 12°, quay ${TURN}° về phía ấy, gật 6°; tay ${r.side} qua dưới cằm lên khum cạnh khoé miệng phía ấy (mốc \`mouth\`, offset [${MOUTH.offset.join(", ")}]), \`cup\` lòng tay quay vào và ra trước. Tới lúc 0,5 s rồi giữ. Chỉ ghi tay ${r.side}, \`hand\`, \`torso\`, \`head\`. Nền \`stand-3d\` hay \`seiza-3d\`; người nghe đứng phía tay ${r.side}, hai hông cách ~${APART} ở \`height\` 1 (gần hơn thì hai đầu chibi lồng nhau khi nghiêng), quay về người nói (\`turn-head-35-*\` hay xoay người). Người nghe phía kia thì \`${r.mirror}\`; buông bằng clip nền mask [${r.arm}, torso, head] blend ~0,4. Sinh bằng \`tools/actions/whisper.mjs\`.`,
      preview: {
        stage: "stand",
        partner: {
          at: [0, -r.s * APART],
          yaw: -r.s * (90 - TOWARD),
        },
      },
    };
  }),
);
