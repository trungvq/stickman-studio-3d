// Phép tính của dáng ngồi nền theo ghế của cảnh: góc chân cho đế giày nằm trên sàn (hay bệ để chân) đúng cỡ người và độ
// cao mặt ngồi, góc thân theo kiểu lưng (tựa thì vừa chạm lưng ghế), đích tay trên đùi, mặt bàn, tay vịn. `stickman gen sit`
// gọi — docs/01-rig.md#bộ-sinh-chung.
import * as rig from "@stickman3d/rig/core";

const D = Math.PI / 180;
const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Giày người 3D mặc đồ trong khung cổ chân, theo bán kính cổ chân — khớp `SHOE`, `shoeCapsule` của `human.ts` */
const SHOE = { heel: -1.7, toe: 3.3, top: 1.15 };
/** Bàn chân nằm ngang tới khi ống chân lệch khỏi phương đứng quá ngần này (radian), quá thì nghiêng theo phần dư — `FOOT_FREE` của `human.ts` */
const FOOT_FREE = 0.5;

/** Bán kính cổ chân của giày (rig): `0,8` nửa bề dày ống quần như `stickman.ts` */
const ankleR = (c) => 0.8 * rig.limbHalf(c).leg;

/**
 * Viên nang giày trong hệ thân ở góc ống chân `phi` (độ, dương ra trước): hai tâm `[tiến, lên]` so với cổ chân và bán
 * kính, đơn vị rig nhân `s`. Bàn chân tự xoay về nằm ngang, ống chân chúc quá `FOOT_FREE` thì nghiêng theo phần dư
 */
export function shoeAt(c, phi, s = 1) {
  const sole = rig.BONES3.limb * 100;
  const ra = ankleR(c);
  const r = (SHOE.top * ra + sole) / 2;
  const y = r - sole;
  const pitch = -phi * D;
  const th = pitch - clamp(pitch, -FOOT_FREE, FOOT_FREE);
  const end = (z) => [
    s * (y * Math.sin(th) + z * Math.cos(th)),
    s * (y * Math.cos(th) - z * Math.sin(th)),
  ];
  return { heel: end(SHOE.heel * ra + r), toe: end(SHOE.toe * ra - r), r: r * s };
}

/** Đế giày thấp hơn cổ chân ngần này ở góc ống chân `phi` */
export function soleDrop(c, phi, s = 1) {
  const S = shoeAt(c, phi, s);
  return S.r - Math.min(S.heel[1], S.toe[1]);
}

/**
 * Kiểu chân: góc ống chân so với phương đứng (độ, dương ra trước) ưng ý và tầm nới. `bent` co, bàn chân lùi dưới mép ghế,
 * gót nhấc; `square` vuông góc, ống chân đứng; `straight` duỗi, cẳng chân đưa ra trước, gót trên sàn
 */
export const LEG_STYLES = {
  bent: { shin: -34, range: [-44, -18] },
  square: { shin: 0, range: [-10, 10] },
  straight: { shin: 42, range: [30, 58] },
};
/** Góc đùi (độ từ phương đứng xuống, `90` nằm ngang): quá `THIGH_RANGE[1]` là gối cao hơn hông; dưới `THIGH_FLOOR` không còn là ngồi */
export const THIGH_RANGE = [60, 112];
export const THIGH_FLOOR = 40;
/** Đùi chúi xuống tới khi mặt dưới đùi lún vào mép trước mặt ngồi ngần này (rig, nhân `s`) */
export const THIGH_SINK = 4;
export const LEG_KINDS = ["bent", "square", "straight", "staggered"];
/** `floor`: đế giày phải trên mặt đỡ; `free`: chạm được thì chạm, không thì chân `square` thõng (kiểu khác là lỗi) */
export const FEET_KINDS = ["free", "floor"];
/** Chân thõng: bàn chân hở trên mặt đỡ dưới ngần này (rig, nhân `s`) trông như lỗi — thử góc ống chân khác cho hở thêm */
export const DANGLE_MIN = 6;

/**
 * Lún của mặt dưới đùi vào mép trước mặt ngồi khi đùi chúi `beta` (độ dưới phương ngang): mép ở `edge` trước khớp hông,
 * thấp hơn khớp hông `down` (mặc định `r0`); đùi dài `T`, bán kính `r0` ở gốc thon về `rk` ở gối (`CLAD_TAPER.leg`). Âm
 * là hở
 */
export function thighSink({ beta, edge, r0, rk, T, down = r0 }) {
  const d = [Math.cos(beta * D), -Math.sin(beta * D)];
  const q = [edge, -down];
  const u = clamp(q[0] * d[0] + q[1] * d[1], 0, T);
  const e = [q[0] - u * d[0], q[1] - u * d[1]];
  // mép nằm trên trục đùi là đùi đã xuyên qua mặt ngồi
  const above = e[0] * -d[1] + e[1] * d[0] > 0;
  return r0 + ((rk - r0) * u) / T + (above ? 1 : -1) * Math.hypot(e[0], e[1]);
}

/** Góc đùi nhỏ nhất (độ từ phương đứng) cho mặt dưới đùi lún mép trước không quá `sink` — `thighSink` */
export function thighLow({ sink, ...o }) {
  let lo = -20;
  let hi = 90 - THIGH_FLOOR;
  if (thighSink({ beta: lo, ...o }) > sink) return 90 - lo;
  if (thighSink({ beta: hi, ...o }) <= sink) return THIGH_FLOOR;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (thighSink({ beta: m, ...o }) <= sink) lo = m;
    else hi = m;
  }
  return 90 - lo;
}

/**
 * Góc một chân `[đùi, gối]` ở `side` cho đế giày trên mặt thấp hơn hông `drop` (thế giới), đùi `T`, ống chân `S`: thử góc
 * ống chân của kiểu (`shinTries`), lấy góc đầu tiên có góc đùi trong `low`…`THIGH_RANGE[1]` (`low` từ mép trước mặt ngồi,
 * `thighLow`) và, khi có `foot`, mặt đỡ nằm dưới bàn chân (`foot(ankleTiến, phi)` đúng); `out` khi góc ấy ngoài tầm kiểu.
 * Không có thì trả tầm `drop` các góc ấy làm được (`lo`, `hi`, góc ống chân với xa nhất `shin`)
 */
export function solveLeg({ c, s, T, S, drop, style, foot, low = THIGH_RANGE[0] }) {
  const K = LEG_STYLES[style];
  const tries = shinTries(style);
  for (const phi of tries) {
    const lift = soleDrop(c, phi, s);
    const cos = (drop - lift - S * Math.cos(phi * D)) / T;
    if (Math.abs(cos) > 1) continue;
    const a = Math.acos(cos) / D;
    if (a < low || a > THIGH_RANGE[1]) continue;
    const ankle = T * Math.sin(a * D) + S * Math.sin(phi * D);
    if (foot && !foot(ankle, phi)) continue;
    const out = phi < K.range[0] || phi > K.range[1];
    return { ok: true, leg: [r1(a), r1(phi - a)], thigh: a, shin: phi, ankle, lift, out };
  }
  // tầm `drop`: đùi dốc xuống nhất, đùi dốc lên nhất ở mỗi góc ống chân thử
  const at = (a) =>
    tries.map((phi) => T * Math.cos(a * D) + S * Math.cos(phi * D) + soleDrop(c, phi, s));
  const far = at(low);
  const hi = Math.max(...far);
  return { ok: false, lo: Math.min(...at(THIGH_RANGE[1])), hi, shin: tries[far.indexOf(hi)] };
}

/**
 * Góc ống chân thử của kiểu `style`, bước `0,5°`: trong tầm, từ góc ưng ý ra hai đầu; rồi kiểu co, duỗi dựng dần ống chân
 * về phương đứng ngoài tầm, tới biên tầm chân vuông
 */
export function shinTries(style) {
  const K = LEG_STYLES[style];
  const tries = [K.shin];
  for (let d = 0.5; K.shin - d >= K.range[0] || K.shin + d <= K.range[1]; d += 0.5) {
    if (K.shin - d >= K.range[0]) tries.push(K.shin - d);
    if (K.shin + d <= K.range[1]) tries.push(K.shin + d);
  }
  const [lo, hi] = LEG_STYLES.square.range;
  if (K.range[1] < lo) for (let p = K.range[1] + 0.5; p <= lo; p += 0.5) tries.push(p);
  if (K.range[0] > hi) for (let p = K.range[0] - 0.5; p >= hi; p -= 0.5) tries.push(p);
  return tries;
}

/** Ống chân góc `phi` (bán kính `r`) dưới đùi góc `thigh` không cắt mép trước mặt ngồi (`edge` trước, `down` thấp hơn khớp hông) */
export function shinClear({ T, S, thigh, edge, down, r, phi }) {
  if (edge === undefined) return true;
  const knee = [T * Math.sin(thigh * D), -T * Math.cos(thigh * D)];
  const d = [Math.sin(phi * D), -Math.cos(phi * D)];
  const e = [edge - knee[0], -down - knee[1]];
  const u = clamp(e[0] * d[0] + e[1] * d[1], 0, S);
  return Math.hypot(e[0] - u * d[0], e[1] - u * d[1]) >= r;
}

/**
 * Chân thõng (chỉ kiểu `square`): đùi nằm trên mặt ngồi ở góc `thigh`, ống chân đứng; bàn chân hở trên mặt đỡ dưới
 * `DANGLE_MIN` thì thử góc ống chân trong tầm kiểu, lấy góc gần phương đứng nhất cho hở từ `DANGLE_MIN`, không có thì góc hở
 * nhiều nhất. Có mép trước mặt ngồi ở `edge` trước khớp hông, thấp hơn khớp hông `down`, thì ống chân (bán kính `r`) không
 * cắt mép ấy. Trả như `solveLeg` cộng `gap` (đế giày cách mặt đỡ)
 */
export function dangleLeg({ c, s, T, S, drop, thigh, edge, down, r = 0 }) {
  const gapAt = (phi) =>
    drop - soleDrop(c, phi, s) - T * Math.cos(thigh * D) - S * Math.cos(phi * D);
  const ankleAt = (phi) => T * Math.sin(thigh * D) + S * Math.sin(phi * D);
  const tries = shinTries("square").filter((phi) => shinClear({ T, S, thigh, edge, down, r, phi }));
  if (!tries.length) {
    return { ok: false, why: "ống chân không qua mép trước mặt ngồi" };
  }
  let best;
  for (const phi of tries) {
    const g = gapAt(phi);
    if (g >= DANGLE_MIN * s) {
      best = { phi, g };
      break;
    }
    if (!best || g > best.g) best = { phi, g };
  }
  return {
    ok: true,
    dangle: true,
    leg: [r1(thigh), r1(best.phi - thigh)],
    thigh,
    shin: best.phi,
    ankle: ankleAt(best.phi),
    lift: soleDrop(c, best.phi, s),
    gap: best.g,
  };
}

/**
 * Kiểu lưng: góc thân, nhịp thở `+1`; đầu gật bù phần `head` của góc thân cho mặt vẫn nhìn ra trước. `band`: tầm góc thân
 * bộ sinh được dời tới khi đặt khuỷu lên tay vịn (vai ra trước, sau theo góc thân); tựa lưng ghế thì góc thân cố định
 */
export const BACK_STYLES = {
  upright: { torso: 3, head: 0, band: [-3, 9] },
  recline: { torso: -12, head: -0.6, band: [-20, -6] },
  forward: { torso: 16, head: -0.55, band: [10, 24] },
};
export const BACK_KINDS = Object.keys(BACK_STYLES);
/** Tựa lưng ghế: góc thân trong tầm này; lưng cách mặt lưng ghế `BACK_GAP` (rig, nhân `s`) ở góc ngả nhất */
export const RECLINE = [-24, -4];
export const BACK_GAP = 0.5;

export const HAND_KINDS = ["thighs", "table", "armrest", "fold"];
/** Tay trên của `fold`: bàn tay phải hay trái nằm trên */
export const TOP_KINDS = ["right", "left"];
/** Lòng tay úp trên đùi (mốc `thigh` cùng bên): dời về phía gối theo kiểu lưng, ra ngoài một chút */
export const THIGH_REACH = { upright: 24, recline: 6, forward: 32 };
/** Lòng tay ra ngoài mặt đùi ngần này: tựa sau thì cẳng tay đi ngoài bụng */
export const THIGH_OUT = { upright: 6, forward: 6, recline: 20 };
/** Khuỷu thả ra ngoài cho cẳng tay tránh bụng; tựa sau thì lùi thêm (vai ở sau đùi, cẳng tay dốc qua hông) */
const THIGH_ELBOW = { upright: [-0.4, 1, 1.2], forward: [-0.1, 1, 2], recline: [-0.8, 0.4, 2] };
/**
 * Lòng tay áp mặt đùi góc `thigh` (độ từ phương đứng), lệch ra ngoài đỉnh đùi `phi` độ quanh trục đùi: ngược pháp tuyến mặt
 * đùi ở đó, vectơ hệ thân
 */
export const thighPalm = (thigh, phi = 0) => {
  const [c, k] = [Math.cos(phi * D), Math.sin(phi * D)];
  return [r3(-Math.cos(thigh * D) * c), r3(Math.sin(thigh * D) * c), r3(-k)];
};
/**
 * Lòng tay ra ngoài đỉnh đùi tới phần này bán kính đùi: `top` thường (xa hơn là bên hông đùi, ngón chạm mặt ngồi), `side`
 * khi cẳng tay lấn bụng
 */
export const THIGH_SIDE = { top: 0.6, side: 0.95 };
/** Tay trên bàn: khuỷu chùng xuống, hơi ra ngoài; giữa lòng tay ghim trên mặt, lòng úp */
const TABLE_ELBOW = [-0.2, 1, 0.7];
const TABLE_HAND = { pose: "flat", w: 0.6, palm: "down" };
/**
 * Khuỷu trên tay vịn (docs/13 mục 3.4): mặt dưới cẳng tay ở khuỷu lún vào mặt tay vịn `sink` (rig, nhân `s`); khuỷu được
 * lệch vào mép trong tới `edge` bán kính cẳng tay (cẳng tay tì mép trong); khuỷu cách hai đầu đoạn ít nhất `end`; cánh
 * tay trên dốc khỏi phương đứng tới `raise` độ; cẳng tay chìa quá đầu tay vịn (quá `0,3` cẳng tay, đủ ở `0,7`) thì xoay vào
 * trong tới `turn` độ
 */
export const ARMREST = { sink: 0, edge: 0.7, end: 4, raise: 60, turn: 35 };
/** Cẳng tay trên tay vịn: khe mặt dưới cẳng tay tới mặt trong tầm này (âm là lún) */
export const FOREARM_REST = [-4, 2];
/** Bàn tay vượt đầu tay vịn thì buông xuống ngần này (độ) */
export const HAND_DROOP = 35;
/** Hai bàn tay chồng trước bụng: miền tìm tâm lòng tay theo `hs`, dung sai khuỷu, tiếp xúc và lấn thân theo `s`. */
export const FOLD = {
  up: [60, 55, 50, 45, 40, 35, 30, 25, 20, 65, 70, 15, 10, 5, 0],
  front: [-20, 85],
  out: 0.5,
  elbow: 2,
  contact: 2,
  pierce: 2,
};

/** Nút obi sau lưng nổi khỏi mặt đai ngần này (bề dày `plaque` của `wrap.ts`); `taiko` buông xuống dưới hông */
const OBI_KNOT = { taiko: 7, kai: 4, bunko: 9 };

/**
 * Phần nhô sau mặt lưng của thân áo ở độ cao `up` trên hông (rig): đai và nút obi của áo `wrap` — `markShape` chỉ có mặt
 * thân. `0` khi không có
 */
export function backExtra(c, up) {
  const o = c.pieces?.torso?.garment?.wrap?.obi;
  if (!o) return 0;
  const h = c.rig.height;
  const top = (o.y + o.width / 2) * h + 4;
  const bottom = o.knot === "taiko" ? -12 * h : (o.y - o.width / 2) * h;
  if (up > top || up < bottom) return 0;
  return o.lift + (OBI_KNOT[o.knot] ?? 0);
}

/** Thời lượng một nhịp thở, giây; thân và tay nhích ở nửa nhịp như `sit-3d` */
export const SIT_DURATION = 3.4;

/** Điểm ở khung `[tiến, lên, phải]` so với hông người hướng `yaw` (radian) ↔ thế giới rig */
export function frameOf(hip, yaw) {
  const F = rig.dirOf(yaw);
  const R = [-Math.sin(yaw), 0, -Math.cos(yaw)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return {
    F,
    R,
    local: (p) => {
      const d = [p[0] - hip[0], p[1] - hip[1], p[2] - hip[2]];
      return [dot(d, F), -d[1], dot(d, R)];
    },
    world: ([f, up, r]) => [
      hip[0] + F[0] * f + R[0] * r,
      hip[1] - up,
      hip[2] + F[2] * f + R[2] * r,
    ],
  };
}

/**
 * Mốc của dáng ngồi: `legs` `{ right, left }` góc chân, `torso` góc thân, `head` gật bù, `arms` `{ right, left }` đích tay
 * (`reach` của mốc) và `hand` bàn tay (một dáng cho hai tay, hay `{ right, left }`); `arms`, `hand` là cặp `[mốc 0, mốc 0,5]`
 * khi đích đổi theo nhịp thở. Mốc `0,5` thân `+1` (thở), `end: wrap`
 */
export function sitKeys({ legs, torso, head, arms, hand }) {
  const at = (v, i) => (Array.isArray(v) ? v[i] : v);
  const sides = (v) => (v && "right" in v ? v : v && { right: v, left: v });
  const key = (t, tor, i) => {
    const A = at(arms, i);
    const H = sides(at(hand, i));
    return {
      t,
      pose: {
        legLeft: legs.left,
        legRight: legs.right,
        torso: r1(tor),
        ...(head && { head: [null, null, r1(head)] }),
      },
      ...(A && { reach: { armRight: A.right, armLeft: A.left } }),
      ...(H && { hand: { armRight: H.right, armLeft: H.left } }),
      ease: "linear",
    };
  };
  return [key(0, torso, 0), key(0.5, torso + 1, 1)];
}

/**
 * Đích tay theo kiểu tay: `thighs` mốc `thigh` dời `reach` về phía gối, `out` ra ngoài, hạ theo mặt đùi (đùi dốc `thighs`
 * góc đùi `{ right, left }`, mặt cong bán kính `r` rig không nhân `s`, ra ngoài đỉnh đùi tới `side` bán kính), lòng tay theo
 * mặt đùi; `table` giữa lòng tay ở điểm hệ thân `at` của từng tay
 */
export function sitArms(
  hands,
  {
    back,
    at,
    reach = THIGH_REACH[back],
    out = THIGH_OUT[back],
    thighs,
    r = 0,
    side = THIGH_SIDE.top,
  } = {},
) {
  if (hands === "thighs") {
    // lòng tay trên mặt cong của đùi: ra ngoài `o` là lệch `phi` quanh trục, hạ `r · (1 − cos phi)`
    const o = Math.min(out, side * r);
    const phi = r > 0 ? Math.asin(o / r) / D : 0;
    const one = (k) => ({
      to: "thigh",
      offset: [
        reach,
        r1(reach * Math.tan((90 - thighs[k]) * D) + r * (1 - Math.cos(phi * D))),
        r1(o),
      ],
      point: "palm",
      elbow: THIGH_ELBOW[back],
    });
    const hand = (k) => ({ pose: "flat", w: 0.6, palm: thighPalm(thighs[k], phi) });
    return {
      arms: { right: one("right"), left: one("left") },
      hand: { right: hand("right"), left: hand("left") },
    };
  }
  const one = (p) => ({ at: p.map(r1), point: "palm", elbow: TABLE_ELBOW });
  return { arms: { right: one(at.right), left: one(at.left) }, hand: TABLE_HAND };
}

/** Hành động ngồi chưa qua `parseAction` */
export function sitAction({ name, keys, note, preview, head }) {
  return {
    name,
    duration: SIT_DURATION,
    end: "wrap",
    authoredAt: "side",
    mask: [
      "armLeft",
      "armRight",
      "legLeft",
      "legRight",
      "torso",
      "hand",
      ...(head ? ["head"] : []),
    ],
    keys,
    events: [],
    ...(note !== undefined && { note }),
    ...(preview && { preview }),
  };
}
