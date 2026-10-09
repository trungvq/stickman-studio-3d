import { headPath, headWarp } from "./head";
import { SculptSchema, type Sculpt, type SculptStyle } from "./schema";
import {
  D,
  SCULPT_BANG_TIP,
  SCULPT_DEPTH,
  SCULPT_FLARE,
  SCULPT_HANG_FROM,
  SCULPT_TEMPLE,
  SCULPT_TUCK,
} from "./constants";
import { onSkull, turnPoint, type HeadTurn, type Vec3 } from "./sphere";
import type { HeadShape } from "./types";
import type { RigQuality } from "./types";

/** Lưới vỏ tóc: số cột kinh độ quanh sọ, số hàng từ chân tóc lên đỉnh */
export const NT = 120;
export const NJ = 20;

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const lerp = (a: Vec3, b: Vec3, m: number) => a.map((v, d) => v + (b[d] - v) * m) as Vec3;
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
 * gáy; tóc mai là một dải hẹp trước tai. docs/02-trang-phuc.md#tóc-dựng-khối
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
  return h;
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
 * Lọn dẹt ôm sọ: kinh độ, vĩ độ chân; dài (độ cung trên sọ, nhân `spike`); hướng đi trên mặt sọ như `Spike`; ngọn
 * hất khỏi vỏ bấy nhiêu lần bán kính; nửa bề rộng chân; hướng đi xoay thêm bấy nhiêu độ tới ngọn
 */
export type Lock = [
  lon: number,
  lat: number,
  length: number,
  heading: number,
  lift: number,
  width: number,
  turn: number,
];

/** Nếp chải: vị trí dọc ngôi, phía mái (`1` dài, `−1` ngắn), cung ôm vòm và độ vuốt ra sau. */
type Stroke = [root: number, side: number, arc: number, sweep: number];

interface SculptStyleDef {
  spikes: Spike[];
  /** Lọn vuốt: như gai, nhưng kinh độ và hướng ngả đo từ ngôi về phía mái. */
  swept?: Spike[];
  /** Lọn dẹt ôm sọ, tô chung lưới với lọn gai */
  locks?: Lock[];
  /** Độ nhô của điểm điều khiển lọn vuốt, phần chiều dài lọn; mặc định 0.55. */
  sweptArch?: number;
  /** Nếp cong Bézier trên vỏ, bốn điểm [độ kinh từ ngôi về phía mái, vĩ độ]. */
  curves?: [number, number][][];
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
  strokes?: Stroke[];
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
  /** Khấc mép mái và nét hất lên; docs/02-trang-phuc.md#bob-và-ngang-vai-mái-lệch */
  cut?: [u: number, depth: number, width: number, rise?: number];
  /** Bề dày vỏ ở chân tóc, phần của `volume`; mặc định 0.3 */
  rim?: number;
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

/** Bảng hình của từng kiểu; JSON chỉ chọn tên kiểu và vài số nhỏ. docs/02-trang-phuc.md#tóc-gai */
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
    strokes: [
      [48, 1, 83, 12],
      [60, 1, 83, 12],
      [72, 1, 83, 12],
      [82, -1, 50, 8],
      [112, -1, 50, 8],
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
    puff: [
      [0, 63, 30, 0.26],
      [-65, 55, 32, 0.12],
    ],
    rim: 0.55,
    sweptArch: 0.12,
    swept: [
      [55, 68, 0.45, 75, 95, 0.22],
      [70, 58, 0.6, 100, 90, 0.24],
    ],
    curves: [
      [
        [50, 55],
        [63, 53],
        [80, 48],
        [100, 43],
      ],
      [
        [110, 50],
        [120, 54],
        [140, 54],
        [155, 45],
      ],
      [
        [-50, 50],
        [-60, 54],
        [-80, 54],
        [-95, 45],
      ],
      [
        [210, 50],
        [200, 30],
        [205, 10],
        [210, -14],
      ],
      [
        [165, 25],
        [165, 10],
        [177, -5],
        [195, -14],
      ],
      [
        [255, 25],
        [255, 10],
        [243, -5],
        [225, -14],
      ],
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
    curves: [
      [
        [12, 38],
        [9, 50],
        [14, 60],
        [26, 62],
      ],
    ],
  },
  quiff: {
    spikes: [],
    fringe: "flat",
    rim: 0.3,
    sweptArch: 0.3,
    swept: [[14, 78, 0.28, 165, 75, 0.26]],
    puff: [
      [10, 74, 42, 0.3],
      [0, 85, 60, 0.08],
    ],
    curves: [
      [
        [-30, 58],
        [-16, 70],
        [14, 75],
        [44, 71],
      ],
      [
        [4, 58],
        [16, 68],
        [40, 72],
        [70, 67],
      ],
      [
        [34, 56],
        [46, 64],
        [66, 67],
        [94, 60],
      ],
      [
        [-58, 52],
        [-64, 64],
        [-84, 68],
        [-112, 62],
      ],
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
      [-40, 80, 56, 188, 0.03, 0.24, 18],
      [-14, 82, 62, 180, 0.04, 0.26, -8],
      [12, 80, 58, 174, 0.03, 0.25, -16],
      [36, 76, 50, 166, 0.05, 0.22, -20],
      [-2, 70, 44, 186, 0.04, 0.15, 10],
      [26, 68, 40, 170, 0.04, 0.14, -12],
      [58, 68, 42, 158, 0.1, 0.2, -16],
      [-62, 70, 46, 196, 0.1, 0.2, 18],
      [80, 70, 70, 176, 0.08, 0.22, -8],
      [-80, 70, 70, 184, 0.08, 0.22, 8],
      [100, 64, 66, 182, 0.12, 0.22, 6],
      [-100, 64, 66, 178, 0.12, 0.22, -6],
      [118, 56, 56, 198, 0.2, 0.2, 14],
      [-118, 56, 56, 162, 0.2, 0.2, -14],
      [180, 78, 90, 180, 0.03, 0.17, 0],
      [164, 78, 88, 186, 0.03, 0.17, 6],
      [-164, 78, 88, 174, 0.03, 0.17, -6],
      [148, 76, 84, 192, 0.04, 0.17, 8],
      [-148, 76, 84, 168, 0.04, 0.17, -8],
      [132, 72, 78, 198, 0.05, 0.17, 10],
      [-132, 72, 78, 162, 0.05, 0.17, -10],
      [172, 62, 68, 182, 0.03, 0.14, 4],
      [-172, 62, 68, 178, 0.03, 0.14, -4],
      [156, 62, 64, 190, 0.03, 0.14, 6],
      [-156, 62, 64, 170, 0.03, 0.14, -6],
      [140, 60, 58, 196, 0.04, 0.14, 8],
      [-140, 60, 58, 164, 0.04, 0.14, -8],
      [168, 80, 62, 18, 0.02, 0.2, 10],
      [-168, 80, 62, 342, 0.02, 0.2, -10],
      [150, 78, 64, 50, 0.02, 0.2, 14],
      [-150, 78, 64, 310, 0.02, 0.2, -14],
      [180, 82, 66, 0, 0.02, 0.2, 0],
      [172, 72, 40, 15, 0.34, 0.12, 35],
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
      front: 56,
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

/** Đuôi ngựa và búi: số đỉnh mỗi vòng tiết diện, số đoạn dọc trục */
export const KNOT_RING = 14;
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

/** Hàng `j` của vỏ đã phồng đủ chưa: `0` ở chân tóc, `1` từ một phần tư số hàng */
export const rowEase = (j: number) => step(0, NJ / 4, j);

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

/** Lọn dẹt: số đoạn từ chân tới mũi */
const LOCK_SEG = 12;

/**
 * Lọn dẹt đi theo cung lớn trên sọ từ chân, hướng xoay dần `turn` độ; trục nằm trên vỏ (kinh độ, vĩ
 * độ ngoài chân tóc thì trên da) rồi hất lên `lift` theo bình phương chiều dài. Tiết diện dẹt theo
 * pháp tuyến sọ, rộng giữ đầy tới gần ngọn rồi thon nhọn. Ra các vòng tiết diện như `spikeRings`.
 */
export function lockRings(
  s: Sculpt,
  [lon, lat, length, heading, lift, width, turn]: Lock,
): Vec3[][] {
  const len = length * s.spike;
  const rim = (SCULPT_STYLES[s.style].rim ?? 0.3) * s.volume;
  const shell = (p: Vec3) => {
    const lo = Math.atan2(p[0], p[2]) / D;
    const la = Math.asin(Math.max(-1, Math.min(1, p[1]))) / D;
    const low = rootLat(s, lo);
    if (la < low) return rim * step(low - 6, low, la);
    return shellLift(s, lo, la, rowEase(((la - low) / (90 - low)) * NJ), rim);
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
    const up = 1 + shell(p) + thick * 0.5 + lift * v * v - thick * 1.5 * (1 - step(0, 0.35, v));
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

/**
 * Hàn các ô lớp tóc thành ít vòng. Ô quấn ngược được lật cho mọi ô cùng chiều, rồi cạnh chung đi
 * ngược chiều nhau triệt tiêu, cạnh còn lại nối thành vòng. Số vòng quấn tại mỗi điểm là tổng của
 * các ô, nên tô `nonzero` ra đúng hợp các ô; ô quấn ngược mà không lật thì khoét lỗ chỗ chồng nhau
 */
export function weld(fill: Vec3[][]): string {
  const { name, at } = vertexIds();
  const open = new Map<number, number>();
  for (const q of fill) {
    const pts = (area(q) > 0 ? [...q].reverse() : q).map(at);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (a === b) continue;
      const n = open.get(b * SPAN + a);
      if (n) open.set(b * SPAN + a, n - 1);
      else open.set(a * SPAN + b, (open.get(a * SPAN + b) ?? 0) + 1);
    }
  }
  const out: number[][] = name.map(() => []);
  for (const [e, n] of open) for (let k = 0; k < n; k++) out[Math.floor(e / SPAN)].push(e % SPAN);
  let d = "";
  out.forEach((list, start) => {
    while (list.length) {
      let loop = `M${name[start]}`;
      for (let v = list.pop()!; v !== start; v = out[v].pop() ?? start) loop += `L${name[v]}`;
      d += `${loop}Z`;
    }
  });
  return d;
}

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

export const depthHalf = (q: Vec3[], side: number) => {
  const clipped: Vec3[] = [];
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length];
    if (side * a[2] >= 0) clipped.push(a);
    if (a[2] < 0 !== b[2] < 0) {
      const u = a[2] / (a[2] - b[2]);
      clipped.push(a.map((v, d) => v + (b[d] - v) * u) as Vec3);
    }
  }
  return clipped;
};

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

/** Lưới chỉ mục tam giác theo hộp bao `x, y`, cho phép hỏi điểm nào bị che */
const BINS = 24;
const binOf = (v: number) => Math.max(0, Math.min(BINS - 1, Math.floor(((v + 2) / 4) * BINS)));

export interface SculptPaths {
  /** Vỏ và lọn gai trước mặt phẳng giữa cùng phần mặt rủ phía trước tâm đầu */
  cap: string;
  /** Vỏ và lọn gai sau mặt phẳng giữa: sọ che, `SculptHair` cắt theo viền đầu */
  back: string;
  /** Cạnh cần vẽ viền của `cap`, `back`, `under`: bỏ cạnh nằm hẳn trong lòng lớp */
  capEdge: string;
  backEdge: string;
  underEdge: string;
  /** Viền đầu nở thêm `grow`, cho `SculptHair` cắt `back` */
  head: (grow: number) => string;
  /** Phần mặt rủ phía sau tâm đầu: vẽ sau cả thân */
  under: string;
  /** Nét trong: đường ngôi và nét chải */
  lines: string[];
  /** Phần đuôi ngựa, búi nằm trước vỏ: vẽ trên cả tóc, có nét riêng */
  knot: string;
  knotEdge: string;
}

const cache = new Map<string, SculptPaths>();
/** Vỏ từng cột trong hệ sọ theo bộ số tóc */
const skulls = new Map<string, { shell: Vec3[]; skin: Vec3; top: Vec3; bare: boolean }[]>();
const CACHE_SIZE = 64;
/** Bậc làm tròn góc đầu cho tóc dựng khối ở `draft`, độ: lệch mép tóc dưới nửa px ở đầu cỡ thường */
const SCULPT_STEP = 0.5;

/**
 * Chiếu vỏ tóc theo hướng đầu `t`, ra toạ độ nhóm đầu quanh tâm `(cx, cy)`. `roll` là góc xoay
 * của nhóm đầu so với khung hình, độ: đuôi tóc rủ thẳng xuống theo khung hình chứ không theo đầu.
 * Nhớ kết quả theo đầu vào: đầu đứng yên thì các khung sau không tính lại. `quality` `draft` làm
 * tròn góc cho khung liền nhau trúng cache, `final` giữ góc thật.
 */
export function sculptPaths(
  raw: Partial<Sculpt> | undefined,
  t: HeadTurn,
  shape: HeadShape,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  roll = 0,
  quality: RigQuality = "draft",
): SculptPaths {
  // Tóc không rủ, không đuôi ngựa thì `roll` không đổi hình, thân lắc lư không làm trượt cache
  const snap = (v: number) =>
    quality === "final"
      ? v
      : Math.sign(v) * Math.round(Math.abs(v) / SCULPT_STEP) * SCULPT_STEP || 0;
  const turn = { yaw: snap(t.yaw), pitch: snap(t.pitch), look: snap(t.look ?? 0) };
  const hangs = (raw?.length ?? 0) > 0 || !!SCULPT_STYLES[raw?.style ?? "plain"].pony;
  const tilt = hangs ? snap(roll) : 0;
  const key = JSON.stringify([raw, turn.yaw, turn.pitch, turn.look, shape, cx, cy, rx, ry, tilt]);
  let p = cache.get(key);
  if (!p) {
    p = buildSculpt(raw, turn, shape, cx, cy, rx, ry, tilt);
    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(key, p);
  }
  return p;
}

function buildSculpt(
  raw: Partial<Sculpt> | undefined,
  t: HeadTurn,
  shape: HeadShape,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  roll: number,
): SculptPaths {
  const s = SculptSchema.parse(raw ?? {});
  const warp = headWarp(shape, rx, ry);
  const px = (p: Vec3): Vec3 => {
    const [x, y] = warp(p[0], p[1]);
    return [cx + x, cy + y, p[2]];
  };
  /** Điểm trên sọ đơn vị đã quay, `y` lên, `z` hướng ra người xem */
  const on = (lon: number, lat: number, lift: number) => turnPoint(t, onSkull(lon, lat, lift));
  // Trọng lực trong hệ nhóm đầu: nhóm xoay `roll` thì hướng xuống khung hình lệch ngược lại
  const g: Vec3 = [Math.sin(roll * D), -Math.cos(roll * D), 0];
  const up = dot(turnPoint(t, [0, 1, 0]), g);
  const hanging = s.length > 0;
  const def = SCULPT_STYLES[s.style];
  const rim = def.rim ?? 0.3;
  const hangFrom = def.hangFrom ?? SCULPT_HANG_FROM;

  /** Tóc rủ: vỏ thấp ở thái dương co về mặt phẳng qua hai tai, nhìn nghiêng mép tóc lùi khỏi mắt */
  const temple = (p: Vec3, lat: number): Vec3 =>
    hanging && p[2] > 0 ? [p[0], p[1], p[2] * (1 - SCULPT_TEMPLE * (1 - step(0, 40, lat)))] : p;
  const sk = JSON.stringify(s);
  let skull = skulls.get(sk);
  if (!skull) {
    skull = [];
    if (skulls.size >= CACHE_SIZE) skulls.delete(skulls.keys().next().value!);
    skulls.set(sk, skull);
  }
  const cols = Array.from({ length: NT + 1 }, (_, i) => {
    const lon = -180 + (i * 360) / NT;
    const a = Math.abs(lon);
    const hang = hanging && a >= hangFrom - 1e-6;
    const ease = def.hangEase ?? HANG_EASE;
    const w = hanging ? step(hangFrom - ease, hangFrom, a) : 0;
    // Chân tóc hạ xuống chỗ rời sọ dốc dần, tới mép trước mảng rủ thì gần như đổ thẳng xuống
    const fall = hanging ? Math.max(0, Math.min(1, (a - hangFrom + ease) / ease)) ** 3 : 0;
    /** Vỏ trong hệ sọ; cột không chạm chỗ rời sọ thì không phụ thuộc hướng đầu, tính một lần */
    const build = (low: number) => {
      const thick = bangAt(s, lon)[1];
      const base = Math.max(rim * s.volume, s.bangThick * thick) * (1 - w) + s.volume * w;
      const high = crownLat(s, lon, low);
      const ease = (lat: number, j: number) =>
        def.crown ? step(0, CROWN_EASE, lat - low) * step(0, CROWN_EASE, high - lat) : rowEase(j);
      const shell: Vec3[] = [];
      for (let j = 0; j <= NJ; j++) {
        const lat = low + ((high - low) * j) / NJ;
        shell.push(temple(onSkull(lon, lat, shellLift(s, lon, lat, ease(lat, j), base)), lat));
      }
      return {
        shell,
        skin: temple(onSkull(lon, low, 0), low),
        top: onSkull(lon, high, 0),
        bare: high - low < 0.5,
      };
    };
    let local = w > 0 ? undefined : skull[i];
    if (!local) {
      const h = rootLat(s, lon);
      // Chỗ rời sọ: vĩ độ mà pháp tuyến vuông góc với trọng lực, sọ phình ra rộng nhất theo phương ngang
      const leave = w > 0 ? Math.atan2(dot(turnPoint(t, onSkull(lon, 0)), g), -up) / D : h;
      local = build(h + (leave - h) * fall);
      if (w === 0) skull[i] = local;
    }
    return {
      lon,
      hang,
      bare: local.bare,
      shell: local.shell.map((p) => turnPoint(t, p)),
      skin: turnPoint(t, local.skin),
      top: turnPoint(t, local.top),
    };
  });

  const surface: Vec3[][] = [];
  const cap: Layer = { fill: [], edge: [] };
  const back: Layer = { fill: [], edge: [] };
  const under: Layer = { fill: [], edge: [] };
  /** Vách có mọi đỉnh sau mặt phẳng giữa mà chiếu vào lòng viền đầu thì sọ che */
  const hidden = (q: Vec3[]) => q.every(([x, y, z]) => z < 0 && x * x + y * y < 1);
  /** Vỏ và gai: sau mặt phẳng giữa thì sọ che theo đúng viền đầu; loại cả ô thì hở khe ở viền */
  const tracked = !!(def.crease || def.strokes || def.curves || def.curlArc);
  const fan = fanOf;
  /** Ô bốn đỉnh không xoắn thì cắt nguyên ô; xoắn thì quạt quanh tâm, lật ngôi vẫn đối xứng gương */
  const split = (q: Vec3[], flat: Vec3[]) =>
    q.length === 3 || (q.length === 4 && winding(flat)) ? [q] : fan(q);
  /** `seam`: ô ngay mối nối vỏ với mặt rủ, nét xuống lớp `under` như đường khâu của `grid` */
  const coat = (q: Vec3[], track = tracked, seam = false): void => {
    for (const r of split(q, q.map(px)))
      for (const side of [1, -1]) {
        const clipped = depthHalf(r, side);
        if (clipped.length < 3) continue;
        const poly = clipped.map(px);
        (side > 0 ? cap : back).fill.push(poly);
        (seam ? under : side > 0 ? cap : back).edge.push([...poly, poly[0]]);
      }
    if (track) surface.push(...(q.length === 3 ? [q] : fan(q)));
  };
  /** Mặt rủ và vách: sau mặt phẳng giữa thì vẽ sau cả thân và đầu, trước thì trên đầu */
  const put = (q: Vec3[], seam = false) => {
    for (const r of split(q, q))
      for (const side of [1, -1]) {
        const clipped = depthHalf(r, side);
        if (clipped.length < 3) continue;
        (side > 0 ? cap : under).fill.push(clipped);
        (seam ? under : side > 0 ? cap : under).edge.push([...clipped, clipped[0]]);
      }
  };
  let walls: Vec3[][] = [];
  const flushWalls = () => {
    grid([walls], false, cap, under, (q) => put(q));
    walls = [];
  };
  /** Cột có mép dưới chạm mảng rủ, kể cả cột ranh giới */
  const hungAt = (i: number) => cols[i].hang || cols[i + 1].hang;
  /** Cột lưới có vỏ: kiểu hói trọc phía trước */
  const clad = (i: number) => !cols[i].bare && !cols[i + 1].bare;
  const shell = Array.from({ length: NT }, (_, i) =>
    Array.from({ length: NJ }, (_, j) => [
      cols[i].shell[j],
      cols[i + 1].shell[j],
      cols[i + 1].shell[j + 1],
      cols[i].shell[j + 1],
    ]),
  );
  if (tracked) for (const q of shell.flat()) surface.push(...fan(q));
  grid(
    shell.map((cells, i) => (clad(i) ? cells.map((q) => q.map(px)) : undefined)),
    true,
    cap,
    back,
    (_, i, k) => coat(shell[i][k], false, k === 0 && hungAt(i)),
    hungAt,
    under,
  );
  for (let i = 0; i < NT; i++) {
    const [A, B] = [cols[i], cols[i + 1]];
    // Mép vỏ ở chân tóc là một vách từ da lên tới vỏ: mép mái lệch thành khối có bề dày. Vách
    // sau mặt phẳng giữa đi cùng lớp với mặt rủ ngay dưới nó, không thì chỗ hai lớp gặp nhau hiện nét
    const wall = [A.skin, A.shell[0], B.shell[0], B.skin];
    const seam = A.hang !== B.hang;
    if (clad(i) && !(A.hang && B.hang) && !seam && !hidden(wall)) walls.push(wall.map(px));
    else flushWalls();
    // Vách ở cột ranh giới mảng rủ nằm ngay mối nối; hai cạnh dọc chân tóc có thể lộ trên mặt nên
    // vẽ nét ở lớp trên, phần trước mặt phẳng giữa
    if (seam && !hidden(wall)) {
      put(wall.map(px), true);
      for (const [a, b] of [
        [A.skin, B.skin],
        [A.shell[0], B.shell[0]],
      ].map((e) => e.map(px))) {
        if (a[2] <= 0 && b[2] <= 0) continue;
        const m = a[2] > 0 && b[2] > 0 ? 1 : a[2] / (a[2] - b[2]);
        const [p, q] = a[2] > 0 ? [a, lerp(a, b, m)] : [b, lerp(a, b, m)];
        cap.edge.push([p, q]);
      }
    }
  }
  flushWalls();
  // Mép trên vành hói cũng là vách từ da lên vỏ
  if (def.crown) {
    for (let i = 0; i < NT; i++) {
      const [A, B] = [cols[i], cols[i + 1]];
      const wall = [A.top, A.shell[NJ], B.shell[NJ], B.top];
      if (clad(i) && !hidden(wall)) walls.push(wall.map(px));
      else flushWalls();
    }
    flushWalls();
  }

  // Lọn gai tô chung path với vỏ nên chỗ gặp không có nét; tam giác, không phải ô bốn đỉnh:
  // ống cong thì ô bốn đỉnh chiếu ra có thể thành hình nơ, tô `nonzero` hở một nửa
  if (s.spike > 0)
    for (const [k, base, arch] of [
      ...def.spikes.map((k) => [k, s.volume, 0.55] as const),
      ...(def.swept ?? []).map(([u, lat, len, heading, bend, width]) => {
        const side = Math.sign(s.part || 1);
        const lon = s.part - side * u;
        const low = rootLat(s, lon);
        const j = ((lat - low) / (90 - low)) * NJ;
        return [
          [lon, lat, len, -side * heading, bend, width] as Spike,
          shellLift(s, lon, lat, rowEase(j), rim * s.volume),
          def.sweptArch ?? 0.55,
        ] as const;
      }),
    ]) {
      const rings = spikeRings(s, k, base, arch).map((r) => r.map((p) => turnPoint(t, p)));
      coat(rings[0]);
      for (let m = 0; m + 1 < rings.length; m++)
        for (let r = 0; r < RING; r++) {
          const [a, b] = [rings[m][r], rings[m][(r + 1) % RING]];
          const next = rings[m + 1];
          if (next.length === 1) coat([a, b, next[0]]);
          else {
            const [c, d] = [next[(r + 1) % RING], next[r]];
            coat([a, b, c]);
            coat([a, c, d]);
          }
        }
    }

  if (hanging) {
    // Mặt rủ: từ chỗ rời sọ buông theo trọng lực tới `length`, lớp ngoài ở vỏ, lớp trong sát sọ;
    // đuôi xoè ra khỏi trục dọc qua tâm đầu
    // Hướng mặt, nằm ngang theo trọng lực
    const face = turnPoint(t, [0, 0, 1]);
    const level = face.map((v, d) => v - dot(face, g) * g[d]);
    const fwd = level.map((v) => v / (Math.hypot(...level) || 1)) as Vec3;
    const sheet = (root: Vec3, lon: number): Vec3[] => {
      const [x0, y0] = px(root);
      const [tw, td, rounded = false, jitter = 0] = def.tips ?? [1, 0];
      const k0 = fromPart(s, lon) / tw;
      const scallop = rounded
        ? Math.sin(Math.PI * k0) ** 2
        : Math.abs(2 * (k0 - Math.round(k0))) ** 0.7;
      // Lọn so le: mỗi lọn ngắn đi một khoảng giả ngẫu nhiên, về 0 ở chỗ giữa hai lọn cho liền mép
      const len = s.length - td * scallop - jitter * hash(Math.round(k0)) * (1 - scallop);
      const along = dot(root, g);
      const radial = root.map((v, d) => v - along * g[d]) as Vec3;
      const n = Math.hypot(...radial) || 1;
      const out = radial.map((v, d) => v - (1 - SCULPT_DEPTH) * dot(radial, fwd) * fwd[d]);
      return Array.from({ length: NK + 1 }, (_, k) => {
        const v = k / NK;
        const d = (len - along) * v;
        const [start, bend, turn = 0] = def.curl ?? [0, 0];
        const [width, depth] = def.wave ?? [360, 0];
        const wave =
          depth * Math.sin(2 * Math.PI * v) * Math.cos((fromPart(s, lon) * 2 * Math.PI) / width);
        const fl =
          ((def.flare ?? SCULPT_FLARE) * v * v +
            bend * step(start, 0.85, v) -
            turn * step(0.85, 1, v) +
            wave) /
          n;
        const m = g.map((gd, i) => gd * d + out[i] * fl);
        // Mép trước vén dần ra sau: phần trước mặt phẳng tai co về nó khi buông xuống
        const ahead = dot(root, fwd) + dot(m as Vec3, fwd);
        const tuck = ahead > 0 ? -ahead * SCULPT_TUCK * (1 - (1 - v) ** 2) : 0;
        return [
          x0 + (m[0] + fwd[0] * tuck) * rx,
          y0 - (m[1] + fwd[1] * tuck) * ry,
          root[2] + m[2] + fwd[2] * tuck,
        ];
      });
    };
    const hung = cols.map((c) =>
      c.hang ? { outer: sheet(c.shell[0], c.lon), inner: sheet(c.skin, c.lon) } : undefined,
    );
    grid(
      hung.slice(0, NT).map((A, i) => {
        const B = hung[i + 1];
        return A && B
          ? Array.from({ length: NK }, (_, k) => [
              A.outer[k],
              B.outer[k],
              B.outer[k + 1],
              A.outer[k + 1],
            ])
          : undefined;
      }),
      true,
      cap,
      under,
      (q, _, k) => put(q, k === 0),
      () => true,
      under,
    );
    for (let i = 0; i < NT; i++) {
      const [A, B] = [hung[i], hung[i + 1]];
      if (A && B) {
        put([A.outer[NK], B.outer[NK], B.inner[NK], A.inner[NK]]);
      }
      // Mép trước mảng rủ: vách từ lớp trong ra lớp ngoài
      const E = A && !B ? A : B && !A ? B : undefined;
      if (E)
        grid(
          [
            Array.from({ length: NK }, (_, k) => [
              E.inner[k],
              E.outer[k],
              E.outer[k + 1],
              E.inner[k + 1],
            ]),
          ],
          false,
          cap,
          under,
          (q, _, k) => put(q, k === 0),
          () => true,
          under,
        );
    }
  }

  const knot: Layer = { fill: [], edge: [] };
  if (def.pony || def.bun) {
    // Đoạn ống có tâm trước mặt cầu bao vỏ thì vẽ trên tóc, sau thì xuống lớp `under` cho đầu và vỏ
    // che. Xếp lớp theo trục từng đoạn chứ không cắt ô theo độ sâu: vạch cắt dọc ống thành nét
    const R = 1 + s.volume;
    const behind = ([x, y, z]: Vec3) => z < Math.sqrt(Math.max(0, R * R - x * x - y * y));
    const within = ([x, y]: Vec3) => x * x + y * y < R * R;
    const n = turnPoint(t, onSkull(180, s.tie));
    const east = turnPoint(t, [1, 0, 0]);
    const unit = (v: Vec3, alt: Vec3) => {
      const k = Math.hypot(...v);
      return k > 1e-3 ? (v.map((a) => a / k) as Vec3) : alt;
    };
    const axis: Vec3[] = [];
    const rings: Vec3[][] = [];
    const ring = (c: Vec3, u: Vec3, w: Vec3, r: number, flat = 1) => {
      axis.push(c);
      rings.push(
        Array.from({ length: KNOT_RING }, (_, i) => {
          const a = (i / KNOT_RING) * 2 * Math.PI;
          return c.map((v, d) => v + (u[d] * Math.cos(a) + w[d] * Math.sin(a) * flat) * r) as Vec3;
        }),
      );
    };
    let anchor: Vec3;
    if (def.pony) {
      // Rời gáy theo pháp tuyến, vồng ra rồi buông thẳng theo trọng lực tới `tail` dưới chỗ buộc
      const [width, arch, flat] = def.pony;
      anchor = turnPoint(t, onSkull(180, s.tie, 0));
      const at = (a: number, b: number): Vec3 =>
        anchor.map((v, d) => v + n[d] * arch * a + g[d] * s.tail * b) as Vec3;
      const P = [anchor, at(1, 0), at(1.1, 0.45), at(0.8, 1)];
      const b = unit(cross(n, g), east);
      // Thắt ở chỗ buộc, phồng ra rồi thon nhọn tới đuôi
      const radius = (v: number) => width * (0.3 + 0.7 * step(0, 0.3, v)) * (1 - v ** 3);
      // Trục lọt vào trong đầu thì đẩy ra theo bán kính, êm như softplus: đuôi ôm gáy chứ không
      // xuyên sọ. Gần chỗ buộc thì chưa đẩy, gốc chìm dưới vỏ
      const centers = Array.from({ length: PONY_SEG + 1 }, (_, k) => {
        const v = k / PONY_SEG;
        const c = P[0].map(
          (_, d) =>
            (1 - v) ** 3 * P[0][d] +
            3 * (1 - v) ** 2 * v * P[1][d] +
            3 * (1 - v) * v * v * P[2][d] +
            v ** 3 * P[3][d],
        ) as Vec3;
        const len = Math.hypot(...c);
        const clear = 1 + s.volume + radius(v) * 0.9;
        const soft = clear + 0.05 * Math.log1p(Math.exp((len - clear) / 0.05));
        const k0 = 1 + (soft / len - 1) * step(0.04, 0.2, v);
        return c.map((a) => a * k0) as Vec3;
      });
      centers.forEach((c, k) => {
        const tan = centers[Math.min(k + 1, PONY_SEG)].map(
          (a, d) => a - centers[Math.max(k - 1, 0)][d],
        ) as Vec3;
        ring(c, b, unit(cross(b, tan), n), radius(k / PONY_SEG), flat);
      });
    } else {
      // Búi là khối dẹt dọc pháp tuyến, chân chìm vào vỏ
      const [radius, squash] = def.bun!;
      const h = radius * squash;
      anchor = turnPoint(t, onSkull(180, s.tie, s.volume + h * 0.35));
      const b = unit(cross(n, east), east);
      const m = cross(n, b);
      for (let k = 0; k <= BUN_SEG; k++) {
        const u = -1 + (2 * k) / BUN_SEG;
        ring(
          anchor.map((v, d) => v + n[d] * u * h) as Vec3,
          b,
          m,
          radius * Math.sqrt(Math.max(0, 1 - u * u)),
        );
      }
    }
    const [x0, y0] = px(anchor);
    const proj = (p: Vec3): Vec3 => [
      x0 + (p[0] - anchor[0]) * rx,
      y0 - (p[1] - anchor[1]) * ry,
      p[2],
    ];
    const P = rings.map((r) => r.map(proj));
    const K = rings.length - 1;
    const front = Array.from({ length: K }, (_, k) => !behind(lerp(axis[k], axis[k + 1], 0.5)));
    const cells = Array.from({ length: K }, (_, k) =>
      Array.from({ length: KNOT_RING }, (_, r) => {
        const r1 = (r + 1) % KNOT_RING;
        return [P[k][r], P[k][r1], P[k + 1][r1], P[k + 1][r]];
      }),
    );
    const wind = cells.map((row) => row.map(winding));
    cells.forEach((row, k) =>
      row.forEach((q, r) => {
        const layer = front[k] ? knot : under;
        const own = wind[k][r];
        if (own) layer.fill.push(q);
        else for (const tri of fanOf(q)) layer.fill.push(tri);
        const edges = [
          [q[0], q[1], k - 1, r],
          [q[3], q[2], k + 1, r],
          [q[0], q[3], k, (r + KNOT_RING - 1) % KNOT_RING],
          [q[1], q[2], k, (r + 1) % KNOT_RING],
        ] as const;
        for (const [a, b, nk, nr] of edges) {
          if (a[0] === b[0] && a[1] === b[1]) continue;
          const path = [a, b];
          if (nk < 0 || nk >= K) layer.edge.push(path);
          else if (front[nk] === front[k]) {
            if (!own || wind[nk][nr] !== own) layer.edge.push(path);
          }
          // Chỗ đổi lớp trong viền đầu là chỗ khối rời tóc, nét hiện; ngoài viền đầu thì giấu
          else (within(axis[Math.max(k, nk)]) ? layer : under).edge.push(path);
        }
      }),
    );
  }

  const lines: string[] = [];
  const bins: Vec3[][][] = Array.from({ length: BINS * BINS }, () => []);
  for (const q of surface) {
    // Nét chỉ vẽ ở `z > 0.3`, tam giác thấp hơn thế không che được nét nào
    if (Math.max(q[0][2], q[1][2], q[2][2]) <= 0.3) continue;
    const xs = q.map((p) => p[0]);
    const ys = q.map((p) => p[1]);
    for (let bx = binOf(Math.min(...xs)); bx <= binOf(Math.max(...xs)); bx++)
      for (let by = binOf(Math.min(...ys)); by <= binOf(Math.max(...ys)); by++)
        bins[bx * BINS + by].push(q);
  }
  // So độ sâu với mặt tóc; phía trước sọ vẫn có thể bị bướu bên ngôi che.
  const occluded = ([x, y, z]: Vec3) =>
    bins[binOf(x) * BINS + binOf(y)].some(([a, b, c]) => {
      if (
        z >= Math.max(a[2], b[2], c[2]) ||
        x < Math.min(a[0], b[0], c[0]) ||
        x > Math.max(a[0], b[0], c[0]) ||
        y < Math.min(a[1], b[1], c[1]) ||
        y > Math.max(a[1], b[1], c[1])
      )
        return false;
      const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(det) < 1e-10) return false;
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det;
      const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det;
      return u >= 0 && v >= 0 && u + v <= 1 && u * a[2] + v * b[2] + (1 - u - v) * c[2] > z + 0.005;
    });
  /**
   * Nét trên mặt vỏ: chỉ phần quay hẳn ra người xem, sát bóng thì các nét dồn thành mảng đen. Mẩu
   * ngắn hơn một phần tư nét bị bỏ: nét chạy dọc mép chỗ bị cắt thì vụn thành gạch
   */
  const trace = (pts: (Vec3 | undefined)[]) => {
    const least = Math.max(2, Math.ceil(pts.length / 4));
    let run: string[] = [];
    const flush = () => {
      if (run.length >= least) lines.push(`M${run.join("L")}`);
      run = [];
    };
    for (const q of pts) {
      if (q && q[2] > 0.3 * Math.hypot(...q) && !occluded(q)) {
        const p = px(q);
        run.push(`${f(p[0])} ${f(p[1])}`);
      } else flush();
    }
    flush();
  };
  /** Điểm trên mặt vỏ ở vĩ độ `lat`, cho nét: vỏ phồng dần từ chân tóc như lưới */
  const onShell = (lon: number, lat: number) => {
    const low = rootLat(s, lon);
    const j = ((lat - low) / (90 - low)) * NJ;
    return on(lon, lat, shellLift(s, lon, lat, rowEase(j), rim * s.volume));
  };
  /** Điểm trên sọ đơn vị ra điểm trên mặt vỏ */
  const lift = ([x, y, z]: Vec3) => onShell(Math.atan2(x, z) / D, Math.asin(y) / D);
  const side = Math.sign(s.part || 1);
  const from = hairline(s, s.part) - 2;
  const [n, c] = partPlane(s);
  const r0 = Math.sqrt(1 - c * c);
  // Trục trên mặt phẳng ngôi: `vert` lên, `ahead` ra trước mặt
  const vert: Vec3 = [0, 1, 0];
  const ahead: Vec3 = [-n[2] * side, 0, Math.abs(n[0])];
  // Có nếp thì đường ngôi đi trên mặt phẳng ngôi qua đỉnh; không thì đi một đoạn theo kinh tuyến
  if (def.crease && !def.fringe) {
    const a0 = Math.asin(Math.sin(from * D) / r0) / D;
    trace(
      Array.from({ length: 17 }, (_, k) => {
        const a = (a0 + ((100 - a0) * k) / 16) * D;
        return lift(
          n.map((v, d) => v * c + r0 * (ahead[d] * Math.cos(a) + vert[d] * Math.sin(a))) as Vec3,
        );
      }),
    );
  } else if (!def.jag && !def.fringe && !def.crease && !def.crown && !def.pony && !def.bun)
    trace(
      Array.from({ length: 9 }, (_, k) =>
        onShell(s.part - side * 3 * (k / 8), from + ((62 - from) * k) / 8),
      ),
    );
  if (def.cut) {
    // Nét cắt rời mũi lọn chéo về phía mái rồi dựng đứng lên
    const [at, , , rise = 12] = def.cut;
    const lon = s.part - side * (at + 1);
    const low = hairline(s, lon);
    trace(
      Array.from({ length: 9 }, (_, k) => {
        const v = k / 8;
        return onShell(lon - side * 7 * (1 - (1 - v) ** 2), low + 1 + rise * v);
      }),
    );
  }
  // Các cung cùng họ đi ngang qua ngôi rồi ôm vòm; vị trí dọc ngôi giữ thứ tự các nếp.
  const margin = def.crease?.[1] ?? 0;
  for (const [root, direction, arc, sweep] of def.strokes ?? [])
    trace(
      Array.from({ length: 49 }, (_, k) => {
        const v = k / 48;
        const b = Math.asin(c) - direction * (arc * D * v);
        const a = (root + sweep * v * v) * D;
        const p = n.map(
          (value, d) =>
            value * Math.sin(b) + Math.cos(b) * (ahead[d] * Math.cos(a) + vert[d] * Math.sin(a)),
        ) as Vec3;
        const lon = Math.atan2(p[0], p[2]) / D;
        const lat = Math.asin(p[1]) / D;
        const inside = (c - dot(n, p)) * direction > margin;
        return lat > rootLat(s, lon) + 4 && inside ? lift(p) : undefined;
      }),
    );
  for (const curve of def.curves ?? []) {
    const control = curve.map(([u, lat]) => onSkull(s.part - side * u, lat));
    trace(
      Array.from({ length: 49 }, (_, k) => {
        const v = k / 48;
        let row = control;
        while (row.length > 1)
          row = row.slice(1).map((p, i) => p.map((a, d) => row[i][d] * (1 - v) + a * v) as Vec3);
        const r = Math.hypot(...row[0]);
        const p = row[0].map((a) => a / r) as Vec3;
        const lon = Math.atan2(p[0], p[2]) / D;
        const lat = Math.asin(p[1]) / D;
        return lat >= rootLat(s, lon) ? lift(p) : undefined;
      }),
    );
  }
  if (def.curls && def.curlArc) {
    const [r, , count] = def.curls;
    const [at, a0, a1] = def.curlArc;
    const rho = at * r * D;
    for (const c of curlCenters(count)) {
      const e = Math.atan2(c[0], c[2]);
      const east: Vec3 = [Math.cos(e), 0, -Math.sin(e)];
      const north = cross(c, east);
      trace(
        Array.from({ length: 13 }, (_, k) => {
          const a = (a0 + ((a1 - a0) * k) / 12) * D;
          const p = c.map(
            (v, d) =>
              v * Math.cos(rho) + (east[d] * Math.cos(a) + north[d] * Math.sin(a)) * Math.sin(rho),
          ) as Vec3;
          const lon = Math.atan2(p[0], p[2]) / D;
          return Math.asin(p[1]) / D >= rootLat(s, lon) + 3 ? lift(p) : undefined;
        }),
      );
    }
  }
  return {
    cap: weld(cap.fill),
    back: weld(back.fill),
    capEdge: chain(cap.edge),
    backEdge: chain(back.edge),
    underEdge: chain(under.edge),
    head: (grow) => headPath(shape, cx, cy, rx + grow, ry + grow),
    under: weld(under.fill),
    lines,
    knot: weld(knot.fill),
    knotEdge: chain(knot.edge),
  };
}
