import { SculptSchema, type Sculpt, type SculptStyle } from "./schema";
import { D, SCULPT_BANG_TIP, SCULPT_DEPTH } from "./constants";
import { onSkull, type Vec3 } from "./sphere";

/** Lưới vỏ tóc: số cột kinh độ quanh sọ, số hàng từ chân tóc lên đỉnh */
export const NT = 120;
export const NJ = 20;

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const bump = (v: number, c: number, w: number) => Math.exp(-(((v - c) / w) ** 2));

export const step = (a: number, b: number, v: number) => {
  const u = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/** Độ kinh từ ngôi sang phía mái tới `lon`, quấn trong `[-180, 180)` */
export const fromPart = (s: Sculpt, lon: number) =>
  (((((s.part - lon) * Math.sign(s.part || 1) + 180) % 360) + 360) % 360) - 180;

/**
 * Vĩ độ chân tóc ở kinh độ `lon`: ngang trán tới thái dương, hạ xuống vành trên tai, rồi xuống
 * gáy; tóc mai là một dải hẹp trước tai. docs/12-trang-phuc-3d.md#tóc-dựng-khối
 */
export function hairline(s: Sculpt, lon: number): number {
  const a = Math.abs(lon);
  let h = s.front + (s.ear - s.front) * step(60, 92, a) + (s.nape - s.ear) * step(96, 140, a);
  const { jag, fringe, reach = 55 } = SCULPT_STYLES[s.style];
  if (fringe !== "flat") h += 5 * bump(a, 50, 9);
  h += (s.sideburn - h) * bump(a, 82, 5);
  if (jag) {
    // Mái răng cưa: mỗi lọn một mũi nhọn chĩa xuống sâu `fringe` × `depth`, hai lọn kề nhau gặp
    // nhau thành vòm cong lên
    let cut = 0;
    for (const [c, w, depth] of jag)
      cut = Math.max(cut, depth * Math.max(0, 1 - Math.abs(lon - c) / w) ** 2);
    h -= s.fringe * cut;
  } else if (fringe === "flat") {
    h -= s.fringe * (1 - step(55, 80, a));
  } else if (fringe === "split") {
    // Mái rẽ đều từ ngôi xuống hai bên thái dương, nhọn ở ngôi
    const u = Math.min(1, Math.abs(fromPart(s, lon)) / reach);
    h = Math.min(h, s.front - s.fringe * (1 - (1 - u) ** 2));
  } else {
    // Mái quét từ ngôi sang tới thái dương bên kia, gặp mảng tóc bên tai thành góc
    const u = fromPart(s, lon);
    h = Math.min(h, s.front - s.fringe * step(0, reach, u));
    // Lọn bên ngôi rủ xuống, mép tròn ra tới tai
    h = Math.min(h, s.front - (SCULPT_STYLES[s.style].lock ?? 0) * step(4, 45, -u));
    h += (SCULPT_STYLES[s.style].partRise ?? 4) * bump(lon, s.part, 4);
  }
  const scallop = SCULPT_STYLES[s.style].scallop;
  if (scallop) {
    const x = 2 * ((((lon / scallop[0]) % 1) + 1) % 1) - 1;
    h -= scallop[1] * Math.sqrt(1 - x * x);
  }
  const cut = SCULPT_STYLES[s.style].cut;
  if (cut) {
    const [at, depth, width] = cut;
    const u = fromPart(s, lon);
    h += (u > at ? -depth : depth / 2) * bump(u, at, width);
  }
  return h + recession(s, lon);
}

/**
 * Chân tóc lùi lên ở kinh độ `lon` vì hói hai bên trán (chữ M), độ: từ giữa trán lùi dần như chữ V thành mũi nhọn, sâu nhất
 * ở `recedeAt`, rồi về lại chân tóc thường trước tai
 */
export function recession(s: Sculpt, lon: number) {
  if (!s.recede) return 0;
  const a = Math.abs(lon);
  const c = Math.max(1, Math.abs(s.recedeAt));
  return s.recede * (a <= c ? Math.sin(((Math.PI / 2) * a) / c) : 1 - step(c, c * 2.1, a));
}

/**
 * Vĩ độ chân lọn `lat` ở kinh độ `lon` dời lên theo chân tóc lùi: sát chân tóc dời đủ, lên tới đỉnh thì không dời,
 * nên lọn của bảng kiểu không mọc trên chỗ hói
 */
export function recededLat(s: Sculpt, lon: number, lat: number) {
  const r = recession(s, lon);
  if (!r) return lat;
  const h = hairline(s, lon) - r;
  return lat + r * Math.max(0, Math.min(1, (90 - lat) / Math.max(1, 90 - h)));
}

/**
 * Một lọn gai: kinh độ, vĩ độ chân; dài (lần bán kính, tính từ vỏ); hướng ngả trên mặt sọ (độ, `0`
 * lên đỉnh, `90` về `+kinh độ`, `180` xuống chân tóc); ngả khỏi pháp tuyến bấy nhiêu độ; bề rộng chân
 */
export type Spike = [
  lon: number,
  lat: number,
  length: number,
  heading: number,
  bend: number,
  width: number,
];

/**
 * Lọn dẹt ôm sọ, đo từ ngôi như lọn vuốt: độ kinh từ ngôi về phía mái, vĩ độ chân; dài (độ cung trên sọ, nhân
 * `spike`); hướng đi trên mặt sọ (`0` lên đỉnh, `90` về phía mái, `180` xuống chân tóc); ngọn hất khỏi vỏ bấy nhiêu
 * lần bán kính; nửa bề rộng chân; hướng đi xoay thêm bấy nhiêu độ tới ngọn; chân chìm trồi lên hết vỏ trong bấy nhiêu
 * phần chiều dài đầu, mặc định 0.35; ngọn chìm lại dưới vỏ trong bấy nhiêu phần chiều dài cuối, mặc định 0
 */
export type Lock = [
  u: number,
  lat: number,
  length: number,
  heading: number,
  lift: number,
  width: number,
  turn: number,
  rise?: number,
  sink?: number,
];

interface SculptStyleDef {
  spikes: Spike[];
  /** Lọn vuốt: như gai, nhưng kinh độ và hướng ngả đo từ ngôi về phía mái. */
  swept?: Spike[];
  /** Lọn dẹt ôm sọ, tô chung lưới với lọn gai */
  locks?: Lock[];
  /** Độ nhô của điểm điều khiển lọn vuốt, phần chiều dài lọn; mặc định 0.55. */
  sweptArch?: number;
  /**
   * Nếp ngôi: vỏ lõm còn `1 − depth` phần dọc mặt phẳng ngôi, nửa bề rộng `width` (lần bán kính);
   * mặt phẳng ngôi xa dần giữa đầu về sau theo `lean`. Có nếp thì hai bên ngôi là hai khối và
   * đường ngôi chạy qua đỉnh
   */
  crease?: [depth: number, width: number, lean: number];
  /** Chân tóc bên kia ngôi rủ xuống bấy nhiêu độ: lọn bên ngôi */
  lock?: number;
  /**
   * Bướu phồng thêm: tâm ở `u` độ kinh tính từ ngôi sang phía mái (âm là phía bên kia ngôi, nên
   * lật theo dấu `part`) và vĩ độ `lat`; bán kính góc (độ); cao (lần bán kính)
   */
  puff?: [u: number, lat: number, radius: number, lift: number][];
  /** Răng cưa mái: tâm, nửa bề rộng mỗi lọn (độ kinh) và độ sâu, nhân `fringe` */
  jag?: [center: number, halfWidth: number, depth: number][];
  /**
   * Mép mái: `sweep` quét từ ngôi sang một bên (mặc định), `split` rẽ đều hai bên ngôi, `flat`
   * bằng ngang trán, không ngôi
   */
  fringe?: "sweep" | "split" | "flat";
  /** Mái hạ hết `fringe` sau bấy nhiêu độ kinh tính từ ngôi; mặc định 55 */
  reach?: number;
  /** Gờ chân tóc tại ngôi, độ; mặc định 4. */
  partRise?: number;
  /** Khấc mép mái và nét hất lên; docs/12-trang-phuc-3d.md#bob-và-ngang-vai-mái-lệch */
  cut?: [u: number, depth: number, width: number, rise?: number];
  /** Bề dày vỏ ở chân tóc, phần của `volume`; mặc định 0.3 */
  rim?: number;
  /** Vỏ dày dần từ chân tóc tới đủ `volume` trong bấy nhiêu phần số hàng; mặc định 0.25. Dài thì mép trán vát ra sau */
  ease?: number;
  /** Đuôi tóc rủ xoè ra khỏi trục dọc bấy nhiêu lần bán kính; mặc định `SCULPT_FLARE` */
  flare?: number;
  /** Đuôi chia lọn: rộng theo độ kinh, độ ngắn giữa lọn; `rounded` cho mép tròn */
  tips?: [width: number, depth: number, rounded?: boolean, jitter?: number];
  /** Kinh độ mép trước mảng rủ; mặc định `SCULPT_HANG_FROM` */
  hangFrom?: number;
  /** Chân tóc hạ xuống chỗ rời sọ trong bấy nhiêu độ kinh trước `hangFrom`; mặc định 15 */
  hangEase?: number;
  /** Uốn từ phần `from` tới `bend` ở 85% chiều dài, rồi uốn trở lại `turn`; âm là cụp vào */
  curl?: [from: number, bend: number, turn?: number];
  /** Sóng mặt rủ: bề rộng theo độ kinh, biên độ theo bán kính sọ */
  wave?: [width: number, depth: number];
  /** Búp xoăn rải đều quanh sọ: bán kính góc (độ), cao (lần bán kính), số búp trên cả mặt cầu */
  curls?: [radius: number, height: number, count: number];
  /**
   * Nét khe mỗi búp: cung quanh tâm búp ở `at` lần bán kính búp, từ góc `from` tới `to` (độ, `0`
   * về `+kinh độ`, `90` lên)
   */
  curlArc?: [at: number, from: number, to: number];
  /** Chân tóc thành vỏ sò quanh đầu: bề rộng mỗi múi (độ kinh, chia hết 360), độ sâu (độ) */
  scallop?: [width: number, depth: number];
  /** Đỉnh hói: vỏ chỉ là vành tóc theo `crownSide` … `crownEase` của JSON */
  crown?: true;
  /**
   * Đuôi ngựa buộc ở vĩ độ `tie` sau gáy, rủ `tail` theo trọng lực: bán kính lớn nhất, độ vồng khỏi
   * gáy (lần bán kính sọ), tiết diện dẹt còn `flat` phần theo chiều trước–sau của đuôi
   */
  pony?: [width: number, arch: number, flat: number];
  /** Búi ở vĩ độ `tie` sau gáy: bán kính, chiều cao theo pháp tuyến bằng `squash` phần bán kính */
  bun?: [radius: number, squash: number];
}

/** Bảng hình của từng kiểu; JSON chỉ chọn tên kiểu và vài số nhỏ. docs/12-trang-phuc-3d.md#tóc-gai */
export const SCULPT_STYLES: Record<SculptStyle, SculptStyleDef> = {
  plain: { spikes: [] },
  neat: {
    spikes: [],
    crease: [0.85, 0.07, 0.4],
    lock: 12,
    // Khối bên mái to và cao, khối bên ngôi nhỏ và thấp hơn
    puff: [
      [45, 62, 40, 0.2],
      [-40, 50, 30, 0.1],
    ],
    locks: [
      [2, 46, 48, 84, 0, 0.17, 10, 0.35, 0.35],
      [2, 56, 58, 70, 0, 0.17, 12, 0.35, 0.35],
      [2, 66, 66, 60, 0, 0.17, 12, 0.35, 0.35],
      [2, 76, 72, 52, 0, 0.16, 10, 0.35, 0.35],
      [-2, 52, 46, 270, 0, 0.15, -10, 0.35, 0.35],
      [-2, 66, 52, 265, 0, 0.15, -10, 0.35, 0.35],
    ],
  },
  round: {
    spikes: [],
    fringe: "flat",
    cut: [26, 5, 14],
    rim: 0.8,
    // Nếp gấp trên đỉnh tách khối bên mái cao hơn khỏi khối bên kia
    crease: [0.5, 0.06, 0.3],
    puff: [
      [35, 62, 45, 0.16],
      [-45, 58, 35, 0.08],
    ],
  },
  center: {
    spikes: [],
    fringe: "split",
    reach: 70,
    puff: [[0, 90, 50, 0.06]],
    flare: 0.14,
    tips: [30, 0.25],
  },
  bob: {
    spikes: [],
    hangFrom: 60,
    hangEase: 35,
    flare: 0.03,
    curl: [0.35, -0.08],
  },
  shoulder: {
    spikes: [],
    crease: [0.65, 0.055, 0.3],
    puff: [[35, 62, 42, 0.24]],
    lock: 28,
    hangFrom: 66,
    flare: 0.04,
    curl: [0.25, 0.2, 0.12],
    wave: [60, 0.035],
    tips: [60, 0.1, true],
    fringe: "sweep",
    cut: [38, 3, 8, 4],
  },
  slick: {
    spikes: [],
    fringe: "sweep",
    reach: 95,
    partRise: 0,
    rim: 0.3,
    ease: 0.7,
    puff: [
      [25, 80, 45, 0.12],
      [-85, 62, 35, 0.06],
    ],
    sweptArch: 0.12,
    swept: [
      [45, 80, 0.4, 20, 94, 0.2],
      [68, 72, 0.4, 35, 92, 0.19],
    ],
    locks: [
      [-20, 70, 42, 350, 0, 0.17, -10, 0.4, 0.6],
      [5, 70, 46, 0, 0, 0.18, 0, 0.4, 0.6],
      [30, 68, 46, 10, 0, 0.18, 8, 0.4, 0.6],
      [55, 66, 46, 22, 0, 0.18, 14, 0.4, 0.6],
      [100, 56, 30, 80, 0, 0.13, 6, 0.4, 0.6],
      [-48, 58, 30, 280, 0, 0.13, -6, 0.4, 0.6],
    ],
  },
  curly: {
    spikes: [],
    fringe: "flat",
    rim: 0.9,
    curls: [16, 0.24, 60],
    curlArc: [0.75, 190, 300],
    scallop: [30, 8],
  },
  bald: {
    spikes: [],
    rim: 0.5,
    crown: true,
  },
  afro: {
    spikes: [],
    fringe: "flat",
    rim: 0.25,
    curls: [20, 0.28, 50],
    curlArc: [0.7, 210, 270],
    scallop: [24, 6],
  },
  buzz: { spikes: [], fringe: "flat", rim: 1 },
  crop: {
    spikes: [],
    fringe: "flat",
    rim: 0.6,
    // Lọn xoáy chúc xuống chân tóc trán thành một mũi, khối bên kia phồng cao hơn
    jag: [
      [-12, 7, 1.5],
      [-58, 32, 1],
      [58, 32, 1],
    ],
    puff: [
      [0, 75, 55, 0.05],
      [-35, 68, 35, 0.07],
    ],
    locks: [
      [-12, 88, 54, 180, 0, 0.18, -14],
      [14, 88, 38, 186, 0, 0.19, 8],
      [38, 84, 36, 194, 0, 0.19, 8],
      [-38, 84, 38, 168, 0, 0.19, -8],
      [64, 78, 34, 196, 0, 0.2, 6],
      [-64, 78, 34, 164, 0, 0.2, -6],
      [94, 76, 50, 186, 0, 0.2, 4, 0.35, 0.35],
      [-94, 76, 50, 174, 0, 0.2, -4, 0.35, 0.35],
    ],
  },
  quiff: {
    spikes: [],
    fringe: "flat",
    rim: 0.3,
    ease: 0.7,
    puff: [
      [10, 80, 46, 0.1],
      [0, 85, 60, 0.02],
    ],
    locks: [
      [-40, 48, 72, 20, 0.02, 0.17, 24, 0.25, 0.6],
      [-14, 48, 76, 22, 0.02, 0.18, 24, 0.25, 0.6],
      [12, 48, 76, 26, 0.02, 0.18, 22, 0.25, 0.6],
      [38, 48, 72, 30, 0.02, 0.17, 20, 0.25, 0.6],
    ],
  },
  pony: { spikes: [], pony: [0.3, 0.4, 0.75] },
  bun: { spikes: [], bun: [0.34, 0.8] },
  messy: {
    // Vài lọn vểnh trên đỉnh, mái răng cưa không đều, đuôi so le hất ra
    spikes: [
      [25, 78, 0.16, 150, 65, 0.1],
      [-45, 68, 0.14, -160, 60, 0.09],
      [160, 62, 0.14, 175, 55, 0.09],
      [95, 40, 0.12, 170, 70, 0.08],
      [-100, 45, 0.12, -170, 70, 0.08],
      [-150, 55, 0.13, -175, 60, 0.09],
    ],
    jag: [
      [-48, 10, 0.8],
      [-29, 10, 1.1],
      [-10, 10, 0.7],
      [10, 10, 1.2],
      [29, 10, 0.85],
      [48, 10, 1],
    ],
    puff: [[0, 75, 55, 0.08]],
    hangFrom: 66,
    hangEase: 25,
    flare: 0.12,
    curl: [0.55, 0.1],
    wave: [30, 0.06],
    tips: [18, 0.2, false, 0.2],
  },
  spiky: {
    // Lọn toả ra từ đỉnh, cong xoáy nhẹ; mỗi kinh độ có lọn để viền nào cũng lởm chởm
    spikes: [
      [6, 82, 0.3, 80, 25, 0.19],
      [-58, 64, 0.26, -150, 40, 0.18],
      [58, 64, 0.28, 145, 40, 0.18],
      [-2, 58, 0.22, 175, 45, 0.17],
      [-120, 64, 0.26, -160, 35, 0.18],
      [120, 64, 0.26, 165, 35, 0.18],
      [180, 70, 0.28, 175, 30, 0.19],
      [-92, 36, 0.22, -165, 55, 0.16],
      [92, 36, 0.24, 165, 55, 0.16],
      [-150, 40, 0.26, -165, 45, 0.17],
      [150, 40, 0.26, 170, 45, 0.17],
    ],
    jag: [
      [-78, 14, 1.2],
      [-57, 13, 1.1],
      [-33, 12, 1],
      [-10, 12, 1.2],
      [14, 12, 1],
      [38, 12, 1.1],
      [60, 13, 1],
      [80, 14, 1.3],
    ],
  },
  anime: {
    // Lọn dẹt chảy từ đỉnh: mái rủ so le, sườn và gáy hai lớp lọn chồng, lọn đỉnh nằm sát chảy ra trước
    spikes: [],
    fringe: "flat",
    puff: [[180, 20, 55, 0.08]],
    locks: [
      [40, 80, 56, 172, 0.03, 0.24, -18],
      [14, 82, 62, 180, 0.04, 0.26, 8],
      [-12, 80, 58, 186, 0.03, 0.25, 16],
      [-36, 76, 50, 194, 0.05, 0.22, 20],
      [2, 70, 44, 174, 0.04, 0.15, -10],
      [-26, 68, 40, 190, 0.04, 0.14, 12],
      [-58, 68, 42, 202, 0.1, 0.2, 16],
      [62, 70, 46, 164, 0.1, 0.2, -18],
      [-80, 70, 70, 184, 0.08, 0.22, 8],
      [80, 70, 70, 176, 0.08, 0.22, -8],
      [-100, 64, 66, 178, 0.12, 0.22, -6],
      [100, 64, 66, 182, 0.12, 0.22, 6],
      [-118, 56, 56, 162, 0.2, 0.2, -14],
      [118, 56, 56, 198, 0.2, 0.2, 14],
      [-168, 80, 62, 342, 0.02, 0.2, -10],
      [168, 80, 62, 18, 0.02, 0.2, 10],
      [-150, 78, 64, 310, 0.02, 0.2, -14],
      [150, 78, 64, 50, 0.02, 0.2, 14],
      [-180, 82, 66, 0, 0.02, 0.2, 0],
      [-172, 72, 40, 345, 0.34, 0.12, -35],
    ],
  },
};

const FEMALE = {
  front: 48,
  part: 35,
  fringe: 0,
  volume: 0.1,
  bang: 34,
  bangTo: -45,
  bangThick: 0.14,
};

/** Bộ số mẫu của tóc dựng khối; áp là thay cả `sculpt`, trường không khai lấy mặc định */
export const SCULPT_PRESETS = {
  short: { label: "Tóc nam ngắn", sculpt: {} },
  buzz: {
    label: "Đầu đinh",
    sculpt: { style: "buzz", front: 36, ear: 12, sideburn: 4, nape: -24, fringe: 0, volume: 0.04 },
  },
  crop: {
    label: "Tròn ngắn",
    sculpt: { style: "crop", part: 0, front: 46, fringe: 10, ear: 8, sideburn: 2, volume: 0.11 },
  },
  quiff: {
    label: "Mái dựng vuốt ngược",
    sculpt: {
      style: "quiff",
      part: -20,
      front: 40,
      fringe: 0,
      ear: 18,
      sideburn: -10,
      volume: 0.1,
    },
  },
  spiky: {
    label: "Rối gai",
    sculpt: { style: "spiky", front: 40, ear: 10, sideburn: 16, fringe: 13, volume: 0.1 },
  },
  neat: {
    label: "Rẽ ngôi chải gọn",
    sculpt: { style: "neat", part: 20, fringe: 9, volume: 0.1 },
  },
  round: {
    label: "Mái bằng tròn",
    sculpt: { style: "round", front: 44, part: 15, ear: 4, sideburn: 12, fringe: 0, volume: 0.16 },
  },
  slick: {
    label: "Vuốt ngược",
    sculpt: { style: "slick", front: 58, part: -30, fringe: 10, ear: 20, sideburn: 8, volume: 0.1 },
  },
  curly: {
    label: "Xoăn búp",
    sculpt: { style: "curly", front: 46, ear: 20, sideburn: 14, fringe: 0, volume: 0.14 },
  },
  bald: {
    label: "Hói đỉnh",
    sculpt: { style: "bald", ear: 6, nape: -24, sideburn: -8, fringe: 0, volume: 0.08 },
  },
  baldLight: {
    label: "Hói nhẹ",
    sculpt: {
      style: "bald",
      ear: 6,
      nape: -24,
      sideburn: -8,
      fringe: 0,
      volume: 0.08,
      crownSide: 52,
      crownBack: 60,
      crownFrom: 45,
      crownEase: 22,
    },
  },
  baldFront: {
    label: "Hói trán",
    sculpt: {
      style: "bald",
      ear: 6,
      nape: -24,
      sideburn: -8,
      fringe: 0,
      volume: 0.08,
      crownSide: 64,
      crownBack: 70,
      crownFrom: 30,
      crownEase: 25,
    },
  },
  afro: {
    label: "Xoăn bồng",
    sculpt: {
      style: "afro",
      front: 52,
      ear: -35,
      nape: -50,
      sideburn: -35,
      fringe: 0,
      volume: 0.45,
    },
  },
  ponyHigh: {
    label: "Đuôi ngựa buộc cao",
    sculpt: { style: "pony", front: 50, part: 20, fringe: 12, volume: 0.08, tie: 62, tail: 1.4 },
  },
  ponyLow: {
    label: "Đuôi ngựa buộc thấp",
    sculpt: { style: "pony", front: 52, part: 0, fringe: 0, volume: 0.07, tie: 15, tail: 0.65 },
  },
  bun: {
    label: "Búi cao",
    sculpt: { style: "bun", front: 52, part: 0, fringe: 0, volume: 0.07, tie: 72 },
  },
  messy: {
    label: "Ngắn xù",
    sculpt: { style: "messy", front: 50, fringe: 16, volume: 0.12, length: 1.05 },
  },
  bang: { label: "Mái lệch", sculpt: FEMALE },
  bob: {
    label: "Bob ngang cằm",
    sculpt: {
      style: "bob",
      front: 48,
      part: 35,
      fringe: 0,
      bang: 16,
      bangTo: -55,
      volume: 0.07,
      length: 0.91,
    },
  },
  shoulder: {
    label: "Ngang vai, mái lệch",
    sculpt: { style: "shoulder", front: 60, part: -28, fringe: 14, volume: 0.12, length: 1.35 },
  },
  center: {
    label: "Ngôi giữa dài",
    sculpt: { style: "center", part: 0, front: 57, fringe: 50, volume: 0.12, length: 1.55 },
  },
  anime: {
    label: "Anime lởm chởm",
    sculpt: {
      style: "anime",
      front: 46,
      ear: 10,
      sideburn: 8,
      nape: -14,
      part: 0,
      fringe: 0,
      volume: 0.16,
    },
  },
} as const satisfies Record<string, { label: string; sculpt: Partial<Sculpt> }>;

export type SculptPreset = keyof typeof SCULPT_PRESETS;

/** Mẫu mà bộ số `raw` đang đúng bằng, không thì `undefined` (đã chỉnh tay) */
export function sculptPresetOf(raw: Partial<Sculpt> | undefined): SculptPreset | undefined {
  const s = SculptSchema.parse(raw ?? {});
  return (Object.keys(SCULPT_PRESETS) as SculptPreset[]).find((k) => {
    const q = SculptSchema.parse(SCULPT_PRESETS[k].sculpt);
    return (Object.keys(s) as (keyof Sculpt)[]).every((f) => s[f] === q[f]);
  });
}

/**
 * Màu phụ (`pieces.hair.accent`) phủ vỏ ở kinh độ `lon` từ chân tóc lên bấy nhiêu phần chiều cao vỏ: đủ `accentTo` từ
 * `accentFrom` ra sau, mỏng dần về `0` trong `ACCENT_EASE` độ trước đó
 */
export function accentAt(s: Sculpt, lon: number) {
  const a = Math.abs(lon);
  return (
    Math.max(0, Math.min(0.95, s.accentTo)) * step(s.accentFrom - ACCENT_EASE, s.accentFrom, a)
  );
}
export const ACCENT_EASE = 25;

/** Hướng ngang qua chỗ buộc trên mặt sọ, lấy làm trục tiết diện khối buộc */
export const knotEast = (s: Sculpt): Vec3 => [-Math.cos(s.tieLon * D), 0, Math.sin(s.tieLon * D)];

/**
 * Khối buộc của đuôi ngựa, búi trong hệ sọ đơn vị, đầu thẳng: pháp tuyến sọ ở chỗ buộc, tâm khối, bán kính, nửa chiều
 * cao theo pháp tuyến. Đuôi ngựa thì tâm ở chỗ buộc trên vỏ, bán kính là chỗ thắt
 */
export function knotFrame(s: Sculpt): { n: Vec3; center: Vec3; radius: number; h: number } {
  const def = SCULPT_STYLES[s.style];
  const n = onSkull(s.tieLon, s.tie);
  if (def.bun) {
    const radius = def.bun[0] * s.knotSize;
    const h = radius * def.bun[1];
    return { n, center: onSkull(s.tieLon, s.tie, s.volume + h * 0.35), radius, h };
  }
  const radius = (def.pony?.[0] ?? 0.1) * s.knotSize * 0.3;
  return { n, center: onSkull(s.tieLon, s.tie, s.volume), radius, h: radius };
}

/** Người 3D: vòng tiết diện khối buộc dày hơn để bóng búi to không thành đa giác khi cận */
export const KNOT_RING_3D = 28;
export const PONY_SEG = 24;
export const BUN_SEG = 12;

/** Số giả ngẫu nhiên `0…1` theo số nguyên `n`, cố định giữa các lần chạy */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Chân tóc hạ dần xuống chỗ rời sọ trong bấy nhiêu độ trước `hangFrom`, kiểu không khai `hangEase` */
export const HANG_EASE = 15;
/** Số hàng mặt rủ */
export const NK = 24;

/**
 * Mái lệch ở kinh độ `lon`: `[rủ, dày]`, mỗi số `0…1`. Mép mái chéo từ đường ngôi xuống `bangTo`,
 * quá đó đi ngang ra sau tới chân tóc bên tai; bề dày mỏng dần trong `SCULPT_BANG_TIP` độ.
 */
export function bangAt(s: Sculpt, lon: number): [number, number] {
  if (!(s.bang > 0) || s.part === s.bangTo) return [0, 0];
  const u = (s.part - lon) / (s.part - s.bangTo);
  if (u <= 0) return [0, 0];
  if (u > 1) return [1, 1 - step(0, SCULPT_BANG_TIP, Math.abs(lon - s.bangTo))];
  const v = u * u * (3 - 2 * u) * 0.35 + u * 0.65;
  return [v, v];
}

/** Chân tóc kể cả mái lệch, chưa tính mảng rủ */
export function rootLat(s: Sculpt, lon: number) {
  const drop = bangAt(s, lon)[0];
  const h = hairline(s, lon);
  return drop > 0 ? Math.min(h, s.front - s.bang * drop) : h;
}

/** Hàng `j` của vỏ kiểu `style` đã phồng đủ chưa: `0` ở chân tóc, `1` từ `ease` phần số hàng (mặc định một phần tư) */
export const rowEase = (j: number, style: SculptStyle) =>
  step(0, NJ * (SCULPT_STYLES[style].ease ?? 0.25), j);

/** Vành hói phồng đủ khi cách cả mép dưới lẫn mép trên bấy nhiêu độ */
export const CROWN_EASE = 10;

/** Mép trên của vỏ ở kinh độ `lon`, chân tóc ở `low`: `90` trừ kiểu hói; không cao hơn `low` là trọc */
export function crownLat(s: Sculpt, lon: number, low: number) {
  if (!SCULPT_STYLES[s.style].crown) return 90;
  const a = Math.abs(lon);
  const top = s.crownSide + (s.crownBack - s.crownSide) * step(90, 180, a);
  return low + (top - low) * step(s.crownFrom, s.crownFrom + Math.max(1e-3, s.crownEase), a);
}

/**
 * Ngôi là mặt phẳng dọc qua chân tóc ở kinh độ `part`, về sau thì xa dần mặt phẳng giữa đầu theo
 * `lean`: đường ngôi chạy về sau chứ không chụm vào đỉnh như kinh tuyến. Ra pháp tuyến đơn vị `n`
 * và `c`: điểm `p` cách mặt phẳng `n·p − c`, âm là phía mái
 */
export function partPlane(s: Sculpt): [n: Vec3, c: number] {
  const lean = SCULPT_STYLES[s.style].crease?.[2] ?? 0;
  const side = Math.sign(s.part || 1);
  const k = Math.hypot(1, lean);
  const n: Vec3 = [side / k, 0, lean / k];
  return [n, dot(n, onSkull(s.part, s.front))];
}

const curlCache = new Map<number, Vec3[]>();
/** Tâm búp xoăn: `count` điểm rải đều trên mặt cầu theo xoắn Fibonacci */
export function curlCenters(count: number): Vec3[] {
  let c = curlCache.get(count);
  if (!c) {
    c = Array.from({ length: count }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / count;
      const r = Math.sqrt(1 - y * y);
      const a = i * Math.PI * (3 - Math.sqrt(5));
      return [r * Math.sin(a), y, r * Math.cos(a)] as Vec3;
    });
    curlCache.set(count, c);
  }
  return c;
}

/**
 * Vỏ ở `(lon, lat)`, đã phồng `e` phần (`0` ở mép, `1` phồng đủ): từ bề dày `base` lên tới `volume`,
 * cộng bướu của kiểu, lõm theo nếp ngôi
 */
export function shellLift(s: Sculpt, lon: number, lat: number, e: number, base: number) {
  const def = SCULPT_STYLES[s.style];
  // Đo bằng góc trên mặt cầu, không theo kinh độ: ở đỉnh mọi kinh độ gặp nhau
  const at = onSkull(lon, lat);
  let add = 0;
  for (const [u, l, r, h] of def.puff ?? []) {
    const c = onSkull(s.part - Math.sign(s.part || 1) * u, l);
    add += h * bump(Math.acos(Math.min(1, dot(at, c))) / D, 0, r);
  }
  if (def.curls) {
    // Lấy búp cao nhất chứ không cộng: giữa hai búp thành khe. Mũ 0.5 dựng sườn đứng, lưới thưa ra gai
    const [r, h, count] = def.curls;
    let top = 0;
    for (const c of curlCenters(count)) {
      const k = dot(at, c);
      if (k <= Math.cos(r * D)) continue;
      const d = Math.acos(Math.min(1, k)) / D / r;
      top = Math.max(top, h * (1 - d * d) ** 0.7);
    }
    add += top;
  }
  // Nếp tắt dần sau đỉnh, tới xoáy tóc
  const [depth, width] = def.crease ?? [0, 1];
  const [n, c] = partPlane(s);
  const dent = 1 - depth * bump(dot(n, at) - c, 0, width) * step(-0.6, -0.2, at[2]);
  // Tóc rủ: sau gáy phồng ít hơn hai bên, chính diện không đổi mà nhìn nghiêng bớt dày
  const back = s.length > 0 ? 1 - (1 - SCULPT_DEPTH) * Math.max(0, -at[2]) : 1;
  return (base + (s.volume - base + add) * e) * dent * back;
}

/** Lọn gai: số đỉnh mỗi vòng tiết diện, số đoạn từ chân tới mũi */
export const RING = 8;
const SEG = 5;

/**
 * Lọn gai là ống thon dẹt cong theo Bézier bậc hai: rời chân theo pháp tuyến, ngọn ngả `bend`
 * về `heading`. Ra các vòng tiết diện từ chân lên, phần tử cuối là mũi.
 */
export function spikeRings(
  s: Sculpt,
  [lon, lat, len, heading, bend, width]: Spike,
  base = s.volume,
  arch = 0.55,
): Vec3[][] {
  const n = onSkull(lon, lat);
  const east: Vec3 = [Math.cos(lon * D), 0, -Math.sin(lon * D)];
  const lean = cross(n, east).map(
    (v, d) => v * Math.cos(heading * D) + east[d] * Math.sin(heading * D),
  ) as Vec3;
  const out = n.map((v, d) => v * Math.cos(bend * D) + lean[d] * Math.sin(bend * D));
  // Chân chìm dưới mặt vỏ để vòng tiết diện đầu không lòi ra khỏi vỏ
  const sink = width * 0.4;
  const p0 = onSkull(lon, lat, base - sink);
  const L = len * s.spike + sink;
  const p1 = p0.map((v, d) => v + n[d] * L * arch) as Vec3;
  const tip = p0.map((v, d) => v + out[d] * L) as Vec3;
  // Rộng theo phương ngang với hướng ngả, mỏng theo phương còn lại
  const side = cross(lean, n);
  const rings: Vec3[][] = [];
  for (let m = 0; m < SEG; m++) {
    const v = m / SEG;
    const c = p0.map((a, d) => (1 - v) ** 2 * a + 2 * (1 - v) * v * p1[d] + v * v * tip[d]);
    const tan = p0.map((a, d) => (1 - v) * (p1[d] - a) + v * (tip[d] - p1[d])) as Vec3;
    const up = cross(side, tan);
    const k = Math.hypot(...up) || 1;
    const r = width * (1 - v) ** 0.8;
    rings.push(
      Array.from({ length: RING }, (_, i) => {
        const a = (i / RING) * 2 * Math.PI;
        const [u, w] = [Math.cos(a) * r, (Math.sin(a) * r * 0.6) / k];
        return c.map((x, d) => x + side[d] * u + up[d] * w) as Vec3;
      }),
    );
  }
  rings.push([tip]);
  return rings;
}

/**
 * Lọn gai và lọn vuốt của kiểu kèm bề dày vỏ dưới chân và độ nhô điểm điều khiển, cho `spikeRings`; kinh độ, hướng
 * ngả của lọn vuốt đã lật theo ngôi. `spike` bằng 0 thì rỗng
 */
export function sculptSpikes(s: Sculpt): [Spike, number, number][] {
  if (!(s.spike > 0)) return [];
  const def = SCULPT_STYLES[s.style];
  const rim = def.rim ?? 0.3;
  return [
    ...def.spikes.map(
      ([lon, lat, ...rest]) =>
        [[lon, recededLat(s, lon, lat), ...rest] as Spike, s.volume, 0.55] as [
          Spike,
          number,
          number,
        ],
    ),
    ...(def.swept ?? []).map(([u, lat0, len, heading, bend, width]): [Spike, number, number] => {
      const side = Math.sign(s.part || 1);
      const lon = s.part - side * u;
      const lat = recededLat(s, lon, lat0);
      const low = rootLat(s, lon);
      const j = ((lat - low) / (90 - low)) * NJ;
      return [
        [lon, lat, len, -side * heading, bend, width],
        shellLift(s, lon, lat, rowEase(j, s.style), rim * s.volume),
        def.sweptArch ?? 0.55,
      ];
    }),
  ];
}

/** Lọn vểnh: số đoạn từ chân tới mũi; kinh độ, vĩ độ chân lọn giữa; các lọn toả ra bấy nhiêu độ hướng */
const AHOGE_SEG = 10;
export const AHOGE_ROOT = [180, 80] as const;
const AHOGE_FAN = 32;
/** Nửa bề rộng lọn vểnh ở chỗ rộng nhất, lần bán kính sọ */
const AHOGE_WIDTH = 0.06;

/**
 * Lọn vểnh trên đỉnh: `ahoge` lọn dẹt mọc từ xoáy (`AHOGE_ROOT`), rời vỏ theo pháp tuyến rồi cong dần về
 * `ahogeHeading`, ngọn ngả `ahogeBend` độ khỏi phương dựng đứng. Bản rộng nằm ngang với mặt phẳng cong. Ra các vòng
 * tiết diện như `spikeRings`, mỗi lọn một danh sách
 */
export function ahogeRings(s: Sculpt): Vec3[][][] {
  const n = Math.max(0, Math.floor(s.ahoge));
  const out: Vec3[][][] = [];
  for (let i = 0; i < n; i++) {
    const k = i - (n - 1) / 2;
    const heading = s.ahogeHeading + AHOGE_FAN * k;
    const lon = AHOGE_ROOT[0] + 9 * k;
    const lat = AHOGE_ROOT[1] - 2 * Math.abs(k);
    const len = s.ahogeLength * (1 - 0.2 * Math.abs(k));
    const nrm = onSkull(lon, lat);
    // Hướng cong trên mặt sọ: `0` về phía mặt (`+z`), `90` về `+x`
    const want: Vec3 = [Math.sin(heading * D), 0, Math.cos(heading * D)];
    const tang = want.map((v, d) => v - dot(want, nrm) * nrm[d]) as Vec3;
    const tl = Math.hypot(...tang) || 1;
    const h = tang.map((v) => v / tl) as Vec3;
    const side = cross(nrm, h);
    const low = rootLat(s, lon);
    const lift = SCULPT_STYLES[s.style].crown
      ? 0
      : shellLift(
          s,
          lon,
          lat,
          rowEase(((lat - low) / (90 - low)) * NJ, s.style),
          (SCULPT_STYLES[s.style].rim ?? 0.3) * s.volume,
        );
    const sink = AHOGE_WIDTH * 0.5;
    let p = onSkull(lon, lat, lift - sink);
    const rings: Vec3[][] = [];
    for (let m = 0; m <= AHOGE_SEG; m++) {
      const v = m / AHOGE_SEG;
      const a = s.ahogeBend * D * v ** 1.4;
      const dir = nrm.map((x, d) => x * Math.cos(a) + h[d] * Math.sin(a)) as Vec3;
      // Pháp tuyến của trục trong mặt phẳng cong: tiết diện mỏng theo nó
      const up = cross(side, dir);
      if (m === AHOGE_SEG) rings.push([p]);
      else {
        const r = AHOGE_WIDTH * (0.55 + 0.45 * step(0, 0.4, v)) * (1 - v ** 1.6);
        rings.push(
          Array.from({ length: RING }, (_, j) => {
            const b = (j / RING) * 2 * Math.PI;
            const [u, w] = [Math.cos(b) * r, Math.sin(b) * r * 0.45];
            return p.map((x, d) => x + side[d] * u + up[d] * w) as Vec3;
          }),
        );
      }
      const ds = (len + sink) / AHOGE_SEG;
      p = p.map((x, d) => x + dir[d] * ds) as Vec3;
    }
    out.push(rings);
  }
  return out;
}

/** Lọn dẹt: số đoạn từ chân tới mũi */
const LOCK_SEG = 12;

/**
 * Lọn dẹt đi theo cung lớn trên sọ từ chân, hướng xoay dần `turn` độ; trục nằm trên vỏ (kinh độ, vĩ
 * độ ngoài chân tóc thì trên da) rồi hất lên `lift` theo bình phương chiều dài. Tiết diện dẹt theo
 * pháp tuyến sọ, rộng giữ đầy tới gần ngọn rồi thon nhọn. Ra các vòng tiết diện như `spikeRings`.
 */
export function lockRings(
  s: Sculpt,
  [u, lat0, length, toward, lift, width, twist, rise = 0.35, sink = 0]: Lock,
): Vec3[][] {
  const flip = Math.sign(s.part || 1);
  const lon = s.part - flip * u;
  const lat = recededLat(s, lon, lat0);
  const heading = -flip * toward;
  const turn = -flip * twist;
  const len = length * s.spike;
  const rim = (SCULPT_STYLES[s.style].rim ?? 0.3) * s.volume;
  const shell = (p: Vec3) => {
    const lo = Math.atan2(p[0], p[2]) / D;
    const la = Math.asin(Math.max(-1, Math.min(1, p[1]))) / D;
    const low = rootLat(s, lo);
    if (la < low) return rim * step(low - 6, low, la);
    return shellLift(s, lo, la, rowEase(((la - low) / (90 - low)) * NJ, s.style), rim);
  };
  let p = onSkull(lon, lat);
  const east: Vec3 = [Math.cos(lon * D), 0, -Math.sin(lon * D)];
  const north = cross(p, east);
  let t = north.map((v, d) => v * Math.cos(heading * D) + east[d] * Math.sin(heading * D)) as Vec3;
  const ds = (len * D) / LOCK_SEG;
  const rings: Vec3[][] = [];
  for (let m = 0; m <= LOCK_SEG; m++) {
    const v = m / LOCK_SEG;
    const r = width * Math.cos((Math.PI / 2) * v ** 1.6) ** 0.8;
    const thick = r * 0.3;
    // Chân chìm dưới mặt vỏ để vòng đầu không lòi ra
    const up =
      1 +
      shell(p) +
      thick * 0.5 +
      lift * v * v -
      thick * 1.5 * (1 - step(0, rise, v)) -
      (sink > 0 ? width * 0.45 * step(1 - sink, 1, v) : 0);
    const side = cross(t, p);
    if (m === LOCK_SEG) rings.push([p.map((a) => a * up) as Vec3]);
    else
      rings.push(
        Array.from({ length: RING }, (_, i) => {
          const a = (i / RING) * 2 * Math.PI;
          const [u, w] = [Math.cos(a) * r, Math.sin(a) * thick];
          return p.map((x, d) => x * (up + w) + side[d] * u) as Vec3;
        }),
      );
    // Bước trên cung lớn theo `t`, rồi xoay `t` quanh pháp tuyến mới
    const q = p.map((x, d) => x * Math.cos(ds) + t[d] * Math.sin(ds)) as Vec3;
    t = t.map((x, d) => x * Math.cos(ds) - p[d] * Math.sin(ds)) as Vec3;
    p = q;
    const k = ((turn * D) / LOCK_SEG) * -1;
    const b = cross(p, t);
    t = t.map((x, d) => x * Math.cos(k) + b[d] * Math.sin(k)) as Vec3;
  }
  return rings;
}

/** Làm tròn đối xứng quanh 0 như `toFixed(1)`, nhanh hơn nhiều */
export const f = (n: number) => String((Math.sign(n) * Math.round(Math.abs(n) * 10)) / 10);
const area = (q: Vec3[]) =>
  q.reduce((a, [x, y], k) => a + x * q[(k + 1) % q.length][1] - q[(k + 1) % q.length][0] * y, 0);
/** Số đỉnh theo toạ độ đã làm tròn như `f`: đỉnh chung của hai ô trùng số dù tính ở hai nơi */
function vertexIds() {
  const id = new Map<number, number>();
  const name: string[] = [];
  const at = (p: Vec3) => {
    const kx = tenth(p[0]);
    const ky = tenth(p[1]);
    const key = (kx + SPAN / 2) * SPAN + ky + SPAN / 2;
    let i = id.get(key);
    if (i === undefined) id.set(key, (i = name.push(`${kx / 10} ${ky / 10}`) - 1));
    return i;
  };
  return { name, at };
}
const tenth = (v: number) => (v < 0 ? -Math.round(-v * 10) : Math.round(v * 10));
/** Khoá số của cặp đỉnh hay của toạ độ ×10: đủ chỗ mà tích vẫn là số nguyên chính xác */
const SPAN = 2 ** 22;

/** Nối các nét chung đỉnh thành polyline, bỏ đoạn trùng; nét đầu tròn khớp tròn nên phủ y như cũ */
export function chain(edges: Vec3[][]): string {
  const { name, at } = vertexIds();
  const adj: number[][] = [];
  const seen = new Set<number>();
  for (const line of edges) {
    const pts = line.map(at);
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      const k = Math.min(a, b) * SPAN + Math.max(a, b);
      if (a === b || seen.has(k)) continue;
      seen.add(k);
      (adj[a] ??= []).push(b);
      (adj[b] ??= []).push(a);
    }
  }
  const walk = (v: number) => {
    let line = `M${name[v]}`;
    for (let b = adj[v].pop(); b !== undefined; b = adj[v].pop()) {
      adj[b].splice(adj[b].lastIndexOf(v), 1);
      line += `L${name[b]}`;
      v = b;
    }
    return line;
  };
  let d = "";
  // Đầu mút trước để polyline dài nhất có thể, rồi tới các vòng kín còn lại
  for (const odd of [true, false])
    adj.forEach((list, v) => {
      while (list.length && (!odd || list.length % 2)) d += walk(v);
    });
  return d;
}

/**
 * Chiều quấn của ô bốn đỉnh đã chiếu; `0` khi ô xoắn thành hình nơ hay suy biến. Ngưỡng để ô gần
 * suy biến đi cùng một đường ở hai bên gương, sai số dấu phẩy động không lật được
 */
export const winding = ([a, b, c, d]: Vec3[]) => {
  const t = [area([a, b, c]), area([a, c, d]), area([a, b, d]), area([b, c, d])];
  return t.every((v) => v > 1e-3) ? 1 : t.every((v) => v < -1e-3) ? -1 : 0;
};

/** Quạt tam giác quanh tâm: ô xoắn thành hình nơ vẫn tô kín, lật ngôi vẫn đối xứng gương */
export const fanOf = (q: Vec3[]) => {
  const center = [0, 1, 2].map((d) => q.reduce((sum, p) => sum + p[d], 0) / q.length) as Vec3;
  return q.map((p, i) => [center, p, q[(i + 1) % q.length]]);
};

/** Một lớp tóc: ruột để tô, nét để vẽ viền dày bên dưới */
export interface Layer {
  fill: Vec3[][];
  edge: Vec3[][];
}

/**
 * Lưới ô đã chiếu `columns[i][k]`: ô `k + 1` nối trên ô `k`, cột `i + 1` nối phải cột `i`, mỗi ô
 * `[dưới trái, dưới phải, trên phải, trên trái]`. Ô cùng chiều quấn, cùng phía mặt phẳng giữa liền
 * nhau trong cột gộp thành một dải: tô `nonzero` vẫn đúng hợp các ô mà path ngắn đi nhiều lần.
 * Cạnh chung của hai ô cùng khoá nằm hẳn trong lòng lớp, nét viền của nó luôn bị ruột che, nên chỉ
 * vẽ nét các cạnh còn lại. Ô xoắn (chỗ gấp ở viền bóng) tô quạt quanh tâm, nét chỉ ở cạnh không
 * có ô thường bên kia: ô thường khác khoá đã tự vẽ cạnh chung. Ô cắt mặt phẳng giữa đi `each`, tự
 * lo cả ruột lẫn nét
 */
export function grid(
  columns: (Vec3[][] | undefined)[],
  wrap: boolean,
  front: Layer,
  rear: Layer,
  each: (q: Vec3[], i: number, k: number) => void,
  hung?: (i: number) => boolean,
  seam?: Layer,
) {
  const sides = columns.map((cells) =>
    cells?.map((q) => (q.every((p) => p[2] >= 0) ? 1 : q.every((p) => p[2] <= 0) ? -1 : 0)),
  );
  const keys = columns.map((cells, i) =>
    cells?.map((q, k) => {
      const w = winding(q);
      return sides[i]![k] && w ? sides[i]![k] * 2 + w : 0;
    }),
  );
  const n = columns.length;
  const keyAt = (i: number, k: number) => keys[wrap ? (i + n) % n : i]?.[k];
  /**
   * Mép dưới nối vào mặt rủ: đường khâu giữa hai mặt liền nhau. Nét ở đó vẽ ở lớp `seam` (sau thân
   * và đầu), để ruột hai bên che, chỉ còn phần nhô ra ngoài bóng làm viền
   */
  const joined = (i: number, k: number, e: number) => e === 0 && k === 0 && !!hung?.(i);
  columns.forEach((cells, i) => {
    if (!cells) return;
    let left: Vec3[] = [];
    let right: Vec3[] = [];
    let key = 0;
    const flush = () => {
      if (left.length) (key > 0 ? front : rear).fill.push([...left, ...right.reverse()]);
      left = [];
      right = [];
    };
    cells.forEach((q, k) => {
      const own = keys[i]![k];
      const edges = [
        [q[0], q[1], i, k - 1],
        [q[3], q[2], i, k + 1],
        [q[0], q[3], i - 1, k],
        [q[1], q[2], i + 1, k],
      ] as const;
      const side = sides[i]![k];
      if (!own) flush();
      if (!own && !side) each(q, i, k);
      else if (!own) {
        const layer = side > 0 ? front : rear;
        for (const r of fanOf(q)) layer.fill.push(r);
        edges.forEach(([a, b, ni, nk], e) => {
          if (!keyAt(ni, nk)) (joined(i, k, e) ? seam! : layer).edge.push([a, b]);
        });
      }
      if (!own) return;
      if (left.length && own !== key) flush();
      if (!left.length) {
        left = [q[0]];
        right = [q[1]];
        key = own;
      }
      left.push(q[3]);
      right.push(q[2]);
      edges.forEach(([a, b, ni, nk], e) => {
        if (keyAt(ni, nk) !== own && (a[0] !== b[0] || a[1] !== b[1]))
          (joined(i, k, e) ? seam! : own > 0 ? front : rear).edge.push([a, b]);
      });
    });
    flush();
  });
}
