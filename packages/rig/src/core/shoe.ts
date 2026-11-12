import { CLAD_TAPER, LIMB3 } from "./stature";

/**
 * Giày của người 3D mặc đồ (`palette.clad`), một nguồn cho người 3D (`human.ts`), va chạm (`collide.ts`) và các bộ sinh
 * (`gen sit`, `tools/actions/seat.mjs`). Hệ cổ chân: gốc ở tâm cổ chân, y lên, z ra mũi giày, px rig. Đế luôn thấp hơn
 * cổ chân đúng `LIMB3`: giày không làm người cao lên. docs/12-trang-phuc-3d.md#giày-dép
 */

/** Ống chân lệch khỏi phương đứng dưới góc này thì bàn chân vẫn nằm ngang, quá thì nghiêng theo phần dư (radian) */
export const FOOT_FREE = 0.5;
/** Bán kính cổ chân của giày, phần nửa bề dày ống quần (`limbHalf(c).leg`): mọi số đo dài, rộng, cao của kiểu nhân nó */
export const SHOE_ANKLE = 0.8;
/** Khe giữa mặt ống chân và mặt trong giày, px: vỏ viền ống chân (`1,8`) không lòi qua lưng gót, cổ giày */
export const SHOE_CLEAR = 2.2;

/** Một kiểu giày dép. Dài, rộng, cao nhân bán kính cổ chân (`SHOE_ANKLE`); bề dày đế, gót, độ hếch là px */
export interface ShoeStyle {
  /** Mũi giày trước tâm cổ chân */
  toe: number;
  /** Nửa rộng chỗ bàn chân rộng nhất */
  half: number;
  /** Cao hộp mũi trên sàn, đo ở chỗ rộng nhất */
  toeTop: number;
  /** Cổ giày ở lưng gót, trên tâm cổ chân */
  collar: number;
  /** Hình mũi nhìn từ trên: `0` tròn bầu, `1` nhọn */
  point: number;
  /** Mũi hếch: mặt đế ở mũi cong lên bấy nhiêu px */
  spring: number;
  /** Đế dày bấy nhiêu px, khối riêng màu `palette.sole` */
  sole: number;
  /** Màu đế khi `palette.sole` bỏ trống; không có thì màu giày sẫm lại */
  soleColor?: string;
  /** Gót: lòng giày ở gót cao hơn sàn `lift` px (cổ chân không đổi, mũi chúc xuống), khối gót liền đế lấp kín vòm */
  heel?: { lift: number };
  /** Cổ ủng: ống bám cẳng chân từ cổ chân lên `length` phần ống chân, rộng hơn ống chân và ống quần `ease` px */
  shaft?: { length: number; ease: number };
  /** Miệng giày thấp lộ mu bàn chân: mép giày cao `back` (trên sàn) ở lưng gót, hạ tới `vamp` ở mu, đóng kín từ `at` (trước cổ chân) */
  cut?: { back: number; vamp: number; at: number };
  /** Dép hở: bàn chân màu da (hay màu tất), quai ngang ở các chỗ `straps` (phần dài bàn chân từ gót), quai cổ chân, ngón gợi hình */
  open?: { straps: readonly number[]; ankle: boolean };
}

/**
 * Bảng kiểu giày, nguồn duy nhất: `palette.shoeStyle` chọn một dòng, người 3D dựng khối thẳng từ đây (`shoeMesh` đọc đủ
 * mọi trường — `shoe.test.ts` giữ). Thêm kiểu là thêm một dòng.
 */
export const SHOE_STYLES = {
  /** Giày thường mũi tròn, đế liền màu sẫm */
  plain: { toe: 3.3, half: 1.42, toeTop: 1.0, collar: 1.05, point: 0.15, spring: 1, sole: 1.3 },
  /** Giày thể thao: bầu, cổ cao hơn, đế dày màu sáng */
  sneaker: {
    toe: 3.4,
    half: 1.55,
    toeTop: 1.12,
    collar: 1.2,
    point: 0,
    spring: 1.6,
    sole: 2.6,
    soleColor: "#f2efe8",
  },
  /** Giày da mũi tròn: thon, thấp mũi */
  derby: { toe: 3.45, half: 1.38, toeTop: 0.9, collar: 0.98, point: 0.2, spring: 1.2, sole: 1.2 },
  /** Giày da mũi nhọn: dài, mũi thuôn */
  pointed: {
    toe: 3.95,
    half: 1.32,
    toeTop: 0.78,
    collar: 0.95,
    point: 0.95,
    spring: 1.6,
    sole: 1.1,
  },
  /** Giày búp bê: thấp, miệng giày lộ mu bàn chân, đế mỏng */
  flat: {
    toe: 3.25,
    half: 1.3,
    toeTop: 0.72,
    collar: 0.95,
    point: 0.35,
    spring: 0.6,
    sole: 0.8,
    cut: { back: 0.8, vamp: 0.4, at: 1.4 },
  },
  /** Giày gót thấp: như búp bê mũi thuôn hơn, thêm khối gót */
  pump: {
    toe: 3.45,
    half: 1.26,
    toeTop: 0.72,
    collar: 0.95,
    point: 0.6,
    spring: 0.6,
    sole: 0.8,
    heel: { lift: 3 },
    cut: { back: 0.85, vamp: 0.42, at: 1.5 },
  },
  /** Bốt thấp cổ: cổ bám cẳng chân một đoạn ngắn */
  ankleBoot: {
    toe: 3.35,
    half: 1.45,
    toeTop: 1.05,
    collar: 1,
    point: 0.15,
    spring: 1,
    sole: 1.8,
    shaft: { length: 0.3, ease: 0.8 },
  },
  /** Ủng cao cổ: ống ủng bám cẳng chân tới dưới gối, ống quần chui vào trong */
  boot: {
    toe: 3.35,
    half: 1.45,
    toeTop: 1.05,
    collar: 1,
    point: 0.15,
    spring: 1,
    sole: 1.8,
    shaft: { length: 0.7, ease: 2.2 },
  },
  /** Sandal: bàn chân hở, đế mỏng, hai quai ngang và quai cổ chân */
  sandal: {
    toe: 3.05,
    half: 1.32,
    toeTop: 0.85,
    collar: 0.95,
    point: 0,
    spring: 0,
    sole: 1.6,
    open: { straps: [0.5, 0.74], ankle: true },
  },
} as const satisfies Record<string, ShoeStyle>;

export type ShoeKind = keyof typeof SHOE_STYLES;
export const SHOE_KINDS = Object.keys(SHOE_STYLES) as [ShoeKind, ...ShoeKind[]];
export const DEFAULT_SHOE: ShoeKind = "plain";

/** Kiểu theo tên; tên lạ là kiểu mặc định */
export const shoeStyle = (kind?: string): ShoeStyle =>
  (SHOE_STYLES as Record<string, ShoeStyle>)[kind ?? DEFAULT_SHOE] ?? SHOE_STYLES[DEFAULT_SHOE];

/** Mặt cắt ngang giày ở một chỗ dọc bàn chân: nửa rộng, đáy, đỉnh (px, hệ cổ chân) */
export interface ShoeSection {
  half: number;
  bottom: number;
  top: number;
}

/** Dáng một khối giày (vỏ giày, bàn chân trong dép, đế) dọc bàn chân, px hệ cổ chân */
export interface ShoeForm {
  /** Sàn: đáy đế */
  floor: number;
  /** Lưng gót, mũi (z) */
  back: number;
  tip: number;
  /** Mặt cắt ở `z`: hai đầu khép về một nét đứng ở lưng gót, một điểm ở mũi */
  at(z: number): ShoeSection;
  /** Nửa rộng nhìn từ trên và mặt đế ở `z`, không khép theo chiều cao ở mũi: đế, quai dép bám theo */
  plan(z: number): { half: number; bottom: number };
}

const smooth = (a: number, b: number, v: number) => {
  const u = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** Siêu elip khép đầu: `1` ở `t = 0`, `0` ở `t = 1` */
const close = (t: number, n: number) =>
  Math.pow(1 - Math.pow(Math.min(1, Math.max(0, t)), n), 1 / n);

/**
 * Số đo chung của giày theo nửa bề dày chân `legHalf` (px, `limbHalf(c).leg`): bán kính cổ chân `ra`, bán kính ống chân ở
 * cổ chân `shin` (`CLAD_TAPER`), cổ ủng `shaft` (bán kính ở cổ chân, `0` khi không có) và `base` — nửa rộng ở gót và lưng
 * gót sau tâm cổ chân: ống chân (hay ống ủng) cộng `SHOE_CLEAR`, nên lưng gót gần thẳng hàng mặt sau ống chân
 */
export function shoeFit(kind: string | undefined, legHalf: number) {
  const S = shoeStyle(kind);
  const ra = SHOE_ANKLE * legHalf;
  const shin = CLAD_TAPER.leg[2] * legHalf;
  const shaft = S.shaft ? shin + SHOE_CLEAR + S.shaft.ease : 0;
  const base = (shaft || shin) + SHOE_CLEAR;
  return { S, ra, shin, shaft, base, floor: -LIMB3 * 100 };
}

/**
 * Dáng giày kiểu `kind` theo nửa bề dày chân `legHalf`. `grow` nở đều ra ngoài bấy nhiêu px (vỏ giày ôm bàn chân của
 * giày miệng thấp); `foot` là bàn chân trong dép: mũi lùi lại chỗ gốc ngón, ngón dựng riêng (`shoeToes`).
 */
export function shoeForm(
  kind: string | undefined,
  legHalf: number,
  grow = 0,
  foot = false,
): ShoeForm {
  const { S, ra, base, floor } = shoeFit(kind, legHalf);
  const back = -base - grow;
  const tip = (foot ? S.toe * 0.86 : S.toe) * ra + grow;
  const L = tip - back;
  const heelHalf = base + grow;
  const ball = Math.max(S.half * ra, base * 1.05) + grow;
  const sb = lerp(0.64, 0.5, S.point);
  const sh = heelHalf / L;
  const n = lerp(2.3, 1.15, S.point);
  const lift = S.heel?.lift ?? 0;
  const collar = S.collar * ra + grow;
  // bàn chân trong dép đứng trên đế
  const ground = foot ? floor + S.sole : floor;
  const toeTop = ground + S.toeTop * ra + grow;
  const zBall = back + sb * L;
  const plan = (z: number) => {
    const s = (z - back) / L;
    const t = Math.max(0, (s - sb) / (1 - sb));
    const w = lerp(heelHalf, ball, smooth(sh, sb, s)) * close(1 - s / sh, 2) * close(t, n);
    // lòng giày ở gót nâng `lift`, hạ dần qua vòm tới chỗ rộng nhất; mũi hếch `spring`
    const bottom = ground + lift * (1 - smooth(0.2, sb, s)) + S.spring * t * t;
    return { half: w, bottom, t };
  };
  return {
    floor,
    back,
    tip,
    plan: (z) => {
      const p = plan(z);
      return { half: p.half, bottom: p.bottom };
    },
    at(z) {
      const p = plan(z);
      let top = lerp(collar, toeTop, smooth(0.3 * ra, zBall, z));
      const tipY = p.bottom + 0.4 * (toeTop - p.bottom);
      const g = close(p.t, 3);
      top = tipY + (top - tipY) * g;
      return { half: p.half, bottom: tipY - (tipY - p.bottom) * g, top };
    },
  };
}

/** Mép trên của giày miệng thấp ở `z` (px, hệ cổ chân): cao hơn mọi điểm của vỏ từ `cut.at` ra mũi; không có `cut` là vô cùng */
export function shoeCut(kind: string | undefined, legHalf: number, z: number) {
  const { S, ra, floor } = shoeFit(kind, legHalf);
  if (!S.cut) return Infinity;
  const { back, vamp, at } = S.cut;
  const y = floor + lerp(back, vamp, smooth(-ra, at * ra, z)) * ra;
  return lerp(y, 100, smooth(at * ra - 0.25 * ra, at * ra + 0.25 * ra, z));
}

/**
 * Phần ống chân (và ống phủ trên nó) dưới cổ chân và sau lưng gót phải ép vào trong giày, px hệ cổ chân: dưới `y0` dồn
 * vào khoảng `bottom..y0`; dưới cổ giày `collar` thì mặt sau ống chân không lùi quá `back` (mặt ống chân đứng thẳng), ống
 * phủ to hơn bao nhiêu thì lùi thêm bấy nhiêu
 */
export function shoeTuck(kind: string | undefined, legHalf: number) {
  const { S, ra, shin, floor } = shoeFit(kind, legHalf);
  const bottom = floor + (S.heel?.lift ?? 0) + (S.open ? S.sole : 0) + SHOE_CLEAR;
  const collar = S.collar * ra;
  return { bottom, y0: Math.max(0, bottom + 1), collar, back: -shin };
}

/** Nang va chạm của giày trong hệ cổ chân (px): tâm gót, tâm mũi (z), cao độ trục, bán kính; đáy nang đúng mặt đế */
export function shoeCapsule(
  kind: string | undefined,
  legHalf: number,
): [number, number, number, number] {
  const F = shoeForm(kind, legHalf);
  const { S, ra, floor } = shoeFit(kind, legHalf);
  const r = (S.toeTop * ra) / 2;
  return [F.back + r, F.tip - r, floor + r, r];
}

/**
 * Ngón chân gợi hình của dép hở bên `side` (`-1` chân phải): ống tròn thon dần `[x, y gốc, z gốc, y đầu, z đầu, bán kính
 * gốc, bán kính đầu]` px hệ cổ chân, gốc cắm trong bàn chân, đầu tựa mặt đế; ngón cái phía trong, lùi dần ra ngoài
 */
export function shoeToes(kind: string | undefined, legHalf: number, side: -1 | 1) {
  const { S, ra } = shoeFit(kind, legHalf);
  if (!S.open) return [];
  const F = shoeForm(kind, legHalf, -SHOE_CLEAR, true);
  const sole = F.floor + S.sole;
  const ball = S.half * ra;
  const toes: [number, number, number, number, number, number, number][] = [];
  // từ ngón cái (phía trong, `-side`) ra ngón út: bán kính, dài theo `ball`, mũi lùi dần
  const K = [
    [0.21, 0.42, 0.0],
    [0.145, 0.36, 0.06],
    [0.135, 0.32, 0.14],
    [0.125, 0.28, 0.23],
    [0.115, 0.24, 0.33],
  ];
  const gap = 0.025 * ball;
  const span = K.reduce((a, [r]) => a + 2 * r * ball, 0) + gap * (K.length - 1);
  const tip = S.toe * ra;
  let x = -side * (span / 2);
  for (const [k, l, back] of K) {
    const r0 = k * ball,
      r1 = 0.8 * r0;
    x += side * r0;
    const z1 = tip - back * ball - r1,
      z0 = z1 - l * ball;
    const y0 = Math.min(sole + r0 + 0.3 * l * ball, F.at(z0).top - 0.6 * r0);
    toes.push([x, Math.max(y0, sole + r0), z0, sole + r1, z1, r0, r1]);
    x += side * (r0 + gap);
  }
  return toes;
}
