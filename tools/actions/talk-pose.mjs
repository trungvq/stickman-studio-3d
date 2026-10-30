// Bộ dáng thoại: thân, đầu đổi theo cụm từ khi nói, cú gật ở chữ nhấn. Chạy `node tools/actions/talk-pose.mjs`.
//
// Tên `talk-pose-<bộ>-<tính>-<n>[-soft|-big][-nod]-3d` và `talk-pose-<bộ>-<tính>-chin-<n>-3d`. Bộ theo dáng nền: `upright`
// đứng thẳng, `lean` ngả tới, `reach` vói qua quầy, `bent` cúi nhìn mặt bàn; tính: `polite` lễ phép, `bossy` hống hách.
// Mỗi dáng `n` có `-nod` (đầu gật thêm `nod`°), `-big` (độ lệch khỏi dáng nền ×`BIG`, có trần `CAP`, cho đầu nhỏ trên
// hình) và `-soft` (×`SOFT`, cho cận mặt). `chin`: thân giữ dáng nền, chỉ đổi cằm, cho máy cao nhìn xuống người đang chồm.
import { emit } from "./emit.mjs";

const BIG = 1.7;
const SOFT = 0.6;
/** Trần độ lệch khỏi dáng nền của `-big`: thân cúi, thân nghiêng, đầu nghiêng, đầu gật */
const CAP = [8, 5, 6, 10];
/** Nhịp thở của `stand-3d`: thân thêm ngần này độ ở nửa lượt */
const BREATH = 1.5;

// base: [thân [cúi, nghiêng], đầu [nghiêng, gật]]; poses: [thân, đầu, tả]; chin: [thân nghiêng, đầu [nghiêng, gật], tả]
const SETS = {
  "upright-polite": {
    nod: 5,
    base: [
      [0, 0],
      [0, 0],
    ],
    stage: "stand",
    what: "đứng thẳng (thân 0°, đầu 0°), tính lễ phép: biên độ nhỏ, đầu bù ~0,8° mỗi độ thân cho cằm ngang, mắt vẫn trên người nghe",
    poses: [
      [[3, 2], [3, -2.5], "chồm nhẹ 3°, nghiêng thân 2° và đầu 3° cùng phía, ngẩng bù"],
      [[-2, -2.5], [-3, 1], "ngả lại 2°, nghiêng thân −2,5° và đầu −3° phía kia, cúi bù 1°"],
      [[5, 1.5], [2, -4], "cúi nhẹ 5° như giải thích lễ phép, ngẩng bù 4° cho cằm ngang"],
      [[1.5, -3], [-3.5, -1], "gần thẳng, nghiêng thân −3° và đầu −3,5°"],
      [[-2.5, 2.5], [3, 1.5], "ngả lại 2,5°, nghiêng thân 2,5° và đầu 3° phía tay xa"],
      [[4, -2], [-2.5, -3], "chồm 4°, nghiêng thân −2° và đầu −2,5° phía tay gần, ngẩng bù"],
    ],
  },
  "upright-bossy": {
    nod: 7,
    base: [
      [0, 0],
      [0, 0],
    ],
    stage: "stand",
    what: "đứng thẳng (thân 0°, đầu 0°), tính hống hách: biên độ lớn, hất cằm, ngửa đầu nhìn xuống người nghe",
    poses: [
      [[-4, 2], [0, -6], "ngả lại 4°, hất cằm 6° nhìn xuống người nghe, nghiêng thân 2°"],
      [[6, -2], [0, -7], "chồm tới 6° ép người nghe, ngẩng 7° cho mắt vẫn nhìn thẳng"],
      [[-2, -2], [0, -10], "ngửa đầu khinh khỉnh: thân ngả 2°, cằm hất 10°"],
      [[3, 2], [0, -4], "chồm nhẹ 3°, nghiêng thân 2°, hơi hếch cằm"],
      [[-4, -2], [0, -8], "ngả lại 4° phía tay gần, hất cằm 8°"],
      [[5, 2], [0, -6], "chồm 5° phía tay xa, ngẩng 6°"],
    ],
  },
  "bent-polite": {
    nod: 3,
    base: [
      [26, 0],
      [4, 12],
    ],
    stage: "counter",
    what: "cúi nhìn mặt bàn (thân ~26°, đầu nghiêng 4° gật 12°, gần `bend-place-3d`), tính lễ phép: mắt vẫn trên mặt bàn, sổ, thực đơn",
    poses: [
      [[28, 2], [3, 12], "cúi thêm 2°, nghiêng thân 2° và đầu 3° cùng phía"],
      [[23, -3], [-2, 13], "nhổm lên 3°, nghiêng thân và đầu phía kia, gật bù giữ mắt trên bàn"],
      [[29, 1.5], [4, 15], "cúi sát hơn, gật 15° như dò dòng chữ"],
      [[25, -3], [-3, 11], "gần dáng nền, nghiêng thân −3° và đầu −3°"],
      [[23, 2.5], [3, 13], "nhổm lên 3°, nghiêng thân 2,5° và đầu 3° phía tay xa"],
      [[28, -2.5], [-2, 14], "cúi thêm 2°, nghiêng thân −2,5° và đầu −2° phía tay gần"],
    ],
    chin: [
      [1, [3, 5], "ngẩng lên nhìn người nghe: gật còn 5°"],
      [-1, [-2, 8], "ngẩng nửa chừng, nghiêng đầu phía kia"],
      [1, [4, 3], "ngẩng hẳn: gật còn 3°"],
      [-1, [-3, 6], "ngẩng, nghiêng đầu −3°"],
    ],
  },
  "reach-bossy": {
    nod: 7,
    base: [
      [20, 0],
      [0, -12],
    ],
    stage: "counter",
    what: "vói qua quầy (thân ~20°, đầu ngửa −12°, gần `reach-over-20-3d`), tính hống hách: chồm sát người nghe, cằm hất",
    poses: [
      [[22, 2], [0, -13], "chồm thêm 2°, nghiêng thân 2°, ngẩng bù"],
      [[17, -2], [0, -12], "nhổm lại 3°, hất cằm 2° quá mức bù, nghiêng thân 2° phía kia"],
      [[21, -2], [0, -16], "hất cằm nhìn xuống: thân 21°, đầu ngửa 16°"],
      [[18, 2], [0, -10], "nhổm lại 2°, nghiêng thân 2°"],
      [[17, 2], [0, -14], "nhổm lại 3° phía tay xa, hất cằm"],
      [[22, -2], [0, -12], "chồm thêm 2° phía tay gần"],
    ],
    chin: [
      [1, [0, -17], "hất cằm 5° quá dáng nền"],
      [-1, [0, -9], "hạ cằm 3° như ghé sát"],
      [1, [0, -20], "hất cằm hẳn 8° nhìn xuống người nghe"],
      [-1, [0, -14], "hơi hất cằm"],
    ],
  },
  "lean-bossy": {
    nod: 7,
    base: [
      [14, 0],
      [0, -8],
    ],
    stage: "stand",
    what: "ngả tới (thân ~14°, đầu ngửa bù −8°, giữa `lean-in-3d` và `lean-in-firm-3d`), tính hống hách: đầu ngửa bù ~0,6° mỗi độ thân, dáng hất cằm ngửa quá mức bù để nhìn xuống người nghe; chồm thêm tối đa 3° vì người ngả tới thường đã sát quầy, bàn",
    poses: [
      [[17, 2], [0, -10], "chồm thêm 3°, nghiêng thân 2°, ngẩng bù"],
      [[10, -2], [0, -9], "ngả lại về 10°, hất cằm 3° quá mức bù, nghiêng thân 2° phía kia"],
      [[15, -2], [0, -14], "hất cằm nhìn xuống: thân 15°, đầu ngửa 14° (quá bù 5°)"],
      [[12, 2], [0, -12], "ngả lại 12°, hất cằm đắc ý, nghiêng thân 2°"],
      [[11, 2], [0, -11], "ngả lại về 11° phía tay xa, hất cằm 3° quá bù"],
      [[16, -2], [0, -11], "chồm thêm 2° phía tay gần, ngẩng bù"],
    ],
    chin: [
      [1, [0, -13], "hất cằm 5° quá dáng nền"],
      [-1, [0, -5], "hạ cằm 3° như ghé sát"],
      [1, [0, -16], "hất cằm hẳn 8° nhìn xuống người nghe"],
      [-1, [0, -10], "hơi hất cằm"],
    ],
  },
};

const r1 = (x) => Math.round(x * 10) / 10;
const num = (v) => String(v).replace(".", ",").replace("-", "−");
const clamp = (x, m) => Math.max(-m, Math.min(m, x));
const COMMON = `Lặp 3,2 s, giữ nhịp thở của \`stand-3d\` (thân +${num(BREATH)}° ở nửa lượt); clip đặt \`phase\` bằng phần lẻ của giây bắt đầu chia 3,2 để khớp pha với nền. Chỉ ghi \`torso\` (cúi, nghiêng) và nghiêng, gật của \`head\`; lắc để trống nên hướng nhìn của track dưới giữ nguyên. Nghiêng dương là về phía tay xa ống kính.`;
const LAYER =
  "Đặt trên track tư thế, dưới track cử chỉ (cúi chào, quay đầu), mỗi cụm từ một dáng, đổi blend ~0,25 s; hết lượt nói thì clip rỗng để về lớp dưới.";
const made = "Sinh bằng `tools/actions/talk-pose.mjs`.";
const base = (stage) =>
  stage === "counter"
    ? "Nền `stand-3d` sau quầy, bàn trước mặt."
    : "Nền `stand-3d`, ngồi thì `sit-3d`.";

const action = (name, stage, torso, head, note) => ({
  name,
  duration: 3.2,
  end: "wrap",
  authoredAt: "side",
  mask: ["torso", "head"],
  keys: [
    {
      t: 0,
      pose: { torso: torso.map(r1), head: [r1(head[0]), null, r1(head[1])] },
      ease: "linear",
    },
    {
      t: 0.5,
      pose: {
        torso: [r1(torso[0] + BREATH), r1(torso[1])],
        head: [r1(head[0]), null, r1(head[1])],
      },
      ease: "linear",
    },
  ],
  note,
  preview: { stage },
});

const out = [];
for (const [set, { nod, base: b, stage, what, poses, chin }] of Object.entries(SETS)) {
  const [[b0, b1], [h0, h1]] = b;
  const fam = `talk-pose-${set}`;
  const scale = (torso, head, k, cap) => [
    [b0 + clamp((torso[0] - b0) * k, cap[0]), b1 + clamp((torso[1] - b1) * k, cap[1])],
    [h0 + clamp((head[0] - h0) * k, cap[2]), h1 + clamp((head[1] - h1) * k, cap[3])],
  ];
  poses.forEach(([torso, head, how], i) => {
    const n = i + 1;
    const name = `${fam}-${n}-3d`;
    const tail = `${COMMON} ${base(stage)} ${LAYER} Cùng dáng: \`${name}\`, \`${fam}-${n}-nod-3d\`, \`${fam}-${n}-soft-3d\`, \`${fam}-${n}-big-3d\`. ${made}`;
    out.push(
      action(
        name,
        stage,
        torso,
        head,
        `Dáng thoại ${n}/${poses.length} của bộ \`${fam}\` — nền ${what}: ${how}. ${tail}`,
      ),
      action(
        `${fam}-${n}-nod-3d`,
        stage,
        torso,
        [head[0], head[1] + nod],
        `Cú gật nhấn của \`${name}\`: cùng thân, đầu gật thêm ${nod}°. Đặt ~0,1 s ở chữ nhấn rồi trả về \`${name}\`, đầu gật xuống rồi về trong ~0,3 s. ${tail}`,
      ),
      action(
        `${fam}-${n}-soft-3d`,
        stage,
        ...scale(torso, head, SOFT, [Infinity, Infinity, Infinity, Infinity]),
        `Dáng thoại ${n} của bộ \`${fam}\`, độ lệch khỏi dáng nền ×${num(SOFT)} cho cận mặt (đầu to trên hình, dáng thường làm đầu trượt như lắc) — nền ${what}: ${how}. ${tail}`,
      ),
      action(
        `${fam}-${n}-big-3d`,
        stage,
        ...scale(torso, head, BIG, CAP),
        `Dáng thoại ${n} của bộ \`${fam}\`, độ lệch khỏi dáng nền ×${num(BIG)} (trần thân ${CAP[0]}° / ${CAP[1]}°, đầu ${CAP[2]}° / ${CAP[3]}°) cho đầu nhỏ trên hình (khung trung, rộng) — nền ${what}: ${how}. ${tail}`,
      ),
    );
  });
  (chin ?? []).forEach(([lean, head, how], i) => {
    out.push(
      action(
        `${fam}-chin-${i + 1}-3d`,
        stage,
        [b0, lean],
        head,
        `Dáng thoại ${i + 1}/${chin.length} của bộ \`${fam}\` cho máy cao nhìn xuống: thân giữ dáng nền ${b0}°, chỉ đổi cằm (đổi độ chồm ở góc ấy làm đầu trượt sang mặt người cạnh) — nền ${what}: ${how}. ${COMMON} ${base(stage)} ${LAYER} ${made}`,
      ),
    );
  });
}
await emit(out);
