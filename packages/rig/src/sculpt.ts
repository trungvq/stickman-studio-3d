// Tóc dựng khối theo @stickman3d/sketch (packages/rig/src/sculpt.tsx, 2b05c7a): bảng kiểu và các hàm dựng vỏ,
// chân tóc, mái lệch, lọn gai giữ nguyên; `sculptMesh` ở cuối dựng như `buildSculpt` nhưng giữ lưới 3D
// thay vì chiếu ra path SVG. Sửa bảng kiểu bên rig thì chép lại.

type Vec3 = [number, number, number];
type SculptStyle = string;
const D = Math.PI / 180;
const SCULPT_HANG_FROM = 75;
const SCULPT_FLARE = 0.08;
const SCULPT_DEPTH = 0.4;
const SCULPT_TUCK = 0.7;
const SCULPT_TEMPLE = 0.45;
const SCULPT_BANG_TIP = 22;

/** Trường của `SculptSchema` cùng mặc định của nó */
export interface Sculpt {
  style: string; front: number; nape: number; ear: number; sideburn: number; part: number; fringe: number;
  volume: number; bang: number; bangTo: number; bangThick: number; length: number; spike: number;
  crownSide: number; crownBack: number; crownFrom: number; crownEase: number; tie: number; tail: number;
}
const DEFAULTS: Sculpt = {
  style: "plain", front: 42, nape: -22, ear: 16, sideburn: 0, part: 35, fringe: 15, volume: 0.07, bang: 0,
  bangTo: -50, bangThick: 0.1, length: 0, spike: 1, crownSide: 22, crownBack: 32, crownFrom: 80, crownEase: 12,
  tie: 55, tail: 1.3,
};

function onSkull(lon: number, lat: number, lift = 0): Vec3 {
  const c = Math.cos(lat * D) * (1 + lift);
  return [c * Math.sin(lon * D), Math.sin(lat * D) * (1 + lift), c * Math.cos(lon * D)];
}

/** Đuôi ngựa và búi: số đỉnh mỗi vòng, số đoạn */
const KNOT_RING = 14;
const PONY_SEG = 24;
const BUN_SEG = 12;

/** Lưới vỏ tóc: số cột kinh độ quanh sọ, số hàng từ chân tóc lên đỉnh */
const NT = 120;
const NJ = 20;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
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
const fromPart = (s: Sculpt, lon: number) =>
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
type Spike = [
  lon: number,
  lat: number,
  length: number,
  heading: number,
  bend: number,
  width: number,
];

/** Nếp chải: vị trí dọc ngôi, phía mái (`1` dài, `−1` ngắn), cung ôm vòm và độ vuốt ra sau. */
type Stroke = [root: number, side: number, arc: number, sweep: number];

interface SculptStyleDef {
  spikes: Spike[];
  /** Lọn vuốt: như gai, nhưng kinh độ và hướng ngả đo từ ngôi về phía mái. */
  swept?: Spike[];
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
};

/** Số giả ngẫu nhiên `0…1` theo số nguyên `n`, cố định giữa các lần chạy */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Chân tóc hạ dần xuống chỗ rời sọ trong bấy nhiêu độ trước `hangFrom`, kiểu không khai `hangEase` */
const HANG_EASE = 15;
/** Số hàng mặt rủ */
const NK = 24;

/**
 * Mái lệch ở kinh độ `lon`: `[rủ, dày]`, mỗi số `0…1`. Mép mái chéo từ đường ngôi xuống `bangTo`,
 * quá đó đi ngang ra sau tới chân tóc bên tai; bề dày mỏng dần trong `SCULPT_BANG_TIP` độ.
 */
function bangAt(s: Sculpt, lon: number): [number, number] {
  if (!(s.bang > 0) || s.part === s.bangTo) return [0, 0];
  const u = (s.part - lon) / (s.part - s.bangTo);
  if (u <= 0) return [0, 0];
  if (u > 1) return [1, 1 - step(0, SCULPT_BANG_TIP, Math.abs(lon - s.bangTo))];
  const v = u * u * (3 - 2 * u) * 0.35 + u * 0.65;
  return [v, v];
}

/** Chân tóc kể cả mái lệch, chưa tính mảng rủ */
function rootLat(s: Sculpt, lon: number) {
  const drop = bangAt(s, lon)[0];
  const h = hairline(s, lon);
  return drop > 0 ? Math.min(h, s.front - s.bang * drop) : h;
}

/** Hàng `j` của vỏ đã phồng đủ chưa: `0` ở chân tóc, `1` từ một phần tư số hàng */
const rowEase = (j: number) => step(0, NJ / 4, j);

/** Vành hói phồng đủ khi cách cả mép dưới lẫn mép trên bấy nhiêu độ */
const CROWN_EASE = 10;

/** Mép trên của vỏ ở kinh độ `lon`, chân tóc ở `low`: `90` trừ kiểu hói; không cao hơn `low` là trọc */
function crownLat(s: Sculpt, lon: number, low: number) {
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
function partPlane(s: Sculpt): [n: Vec3, c: number] {
  const lean = SCULPT_STYLES[s.style].crease?.[2] ?? 0;
  const side = Math.sign(s.part || 1);
  const k = Math.hypot(1, lean);
  const n: Vec3 = [side / k, 0, lean / k];
  return [n, dot(n, onSkull(s.part, s.front))];
}

const curlCache = new Map<number, Vec3[]>();
/** Tâm búp xoăn: `count` điểm rải đều trên mặt cầu theo xoắn Fibonacci */
function curlCenters(count: number): Vec3[] {
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
function shellLift(s: Sculpt, lon: number, lat: number, e: number, base: number) {
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
const RING = 8;
const SEG = 5;

/**
 * Lọn gai là ống thon dẹt cong theo Bézier bậc hai: rời chân theo pháp tuyến, ngọn ngả `bend`
 * về `heading`. Ra các vòng tiết diện từ chân lên, phần tử cuối là mũi.
 */
function spikeRings(
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

/** Làm tròn đối xứng quanh 0 như `toFixed(1)`, nhanh hơn nhiều */

/** Nét trên mặt vỏ như `buildSculpt`: đường ngôi, nét cắt, các cung chải, đường cong và khe búp xoăn; mẩu ngắn hơn một phần tư bị bỏ */
function hairLines(s: Sculpt, lines: Vec3[][]) {
  const def = SCULPT_STYLES[s.style];
  const rim = def.rim ?? 0.3;
  const trace = (pts: (Vec3 | undefined)[]) => {
    const least = Math.max(2, Math.ceil(pts.length / 4));
    let run: Vec3[] = [];
    const flush = () => {
      if (run.length >= least) lines.push(run);
      run = [];
    };
    for (const q of pts) if (q) run.push(q); else flush();
    flush();
  };
  const onShell = (lon: number, lat: number) => {
    const low = rootLat(s, lon);
    const j = ((lat - low) / (90 - low)) * NJ;
    return onSkull(lon, lat, shellLift(s, lon, lat, rowEase(j), rim * s.volume));
  };
  const lift = ([x, y, z]: Vec3) => onShell(Math.atan2(x, z) / D, Math.asin(y) / D);
  const side = Math.sign(s.part || 1);
  const from = hairline(s, s.part) - 2;
  const [n, c] = partPlane(s);
  const r0 = Math.sqrt(1 - c * c);
  const vert: Vec3 = [0, 1, 0];
  const ahead: Vec3 = [-n[2] * side, 0, Math.abs(n[0])];
  if (def.crease && !def.fringe) {
    const a0 = Math.asin(Math.sin(from * D) / r0) / D;
    trace(Array.from({ length: 17 }, (_, k) => {
      const a = (a0 + ((100 - a0) * k) / 16) * D;
      return lift(n.map((v, d) => v * c + r0 * (ahead[d] * Math.cos(a) + vert[d] * Math.sin(a))) as Vec3);
    }));
  } else if (!def.jag && !def.fringe && !def.crease && !def.crown && !def.pony && !def.bun)
    trace(Array.from({ length: 9 }, (_, k) => onShell(s.part - side * 3 * (k / 8), from + ((62 - from) * k) / 8)));
  if (def.cut) {
    const [at, , , rise = 12] = def.cut;
    const lon = s.part - side * (at + 1);
    const low = hairline(s, lon);
    trace(Array.from({ length: 9 }, (_, k) => {
      const v = k / 8;
      return onShell(lon - side * 7 * (1 - (1 - v) ** 2), low + 1 + rise * v);
    }));
  }
  const margin = def.crease?.[1] ?? 0;
  for (const [root, direction, arc, sweep] of def.strokes ?? [])
    trace(Array.from({ length: 49 }, (_, k) => {
      const v = k / 48;
      const b = Math.asin(c) - direction * (arc * D * v);
      const a = (root + sweep * v * v) * D;
      const p = n.map((value, d) => value * Math.sin(b) + Math.cos(b) * (ahead[d] * Math.cos(a) + vert[d] * Math.sin(a))) as Vec3;
      const lon = Math.atan2(p[0], p[2]) / D;
      const lat = Math.asin(p[1]) / D;
      const inside = (c - dot(n, p)) * direction > margin;
      return lat > rootLat(s, lon) + 4 && inside ? lift(p) : undefined;
    }));
  for (const curve of def.curves ?? []) {
    const control = curve.map(([u, lat]) => onSkull(s.part - side * u, lat));
    trace(Array.from({ length: 49 }, (_, k) => {
      const v = k / 48;
      let row = control;
      while (row.length > 1) row = row.slice(1).map((p, i) => p.map((a, d) => row[i][d] * (1 - v) + a * v) as Vec3);
      const r = Math.hypot(...row[0]);
      const p = row[0].map((a) => a / r) as Vec3;
      const lon = Math.atan2(p[0], p[2]) / D;
      return Math.asin(p[1]) / D >= rootLat(s, lon) ? lift(p) : undefined;
    }));
  }
  if (def.curls && def.curlArc) {
    const [r, , count] = def.curls;
    const [at, a0, a1] = def.curlArc;
    const rho = at * r * D;
    for (const cc of curlCenters(count)) {
      const e = Math.atan2(cc[0], cc[2]);
      const east: Vec3 = [Math.cos(e), 0, -Math.sin(e)];
      const north = cross(cc, east);
      trace(Array.from({ length: 13 }, (_, k) => {
        const a = (a0 + ((a1 - a0) * k) / 12) * D;
        const p = cc.map((v, d) => v * Math.cos(rho) + (east[d] * Math.cos(a) + north[d] * Math.sin(a)) * Math.sin(rho)) as Vec3;
        const lon = Math.atan2(p[0], p[2]) / D;
        return Math.asin(p[1]) / D >= rootLat(s, lon) + 3 ? lift(p) : undefined;
      }));
    }
  }
}

/**
 * Lưới tóc trong hệ sọ đơn vị (y lên, z ra trước mặt), đầu thẳng: `shell` vỏ và vách chân tóc, `spikes` lọn gai,
 * đuôi ngựa và búi, `hang` mặt rủ, mỗi phần là dãy tam giác; `lines` nét trên mặt vỏ (ngôi, nét chải, khe búp xoăn).
 */
export interface SculptMesh {
  shell: Vec3[][];
  spikes: Vec3[][];
  hang: Vec3[][];
  lines: Vec3[][];
}

export function sculptMesh(raw: Partial<Sculpt>): SculptMesh {
  const s: Sculpt = { ...DEFAULTS, ...raw };
  const def = SCULPT_STYLES[s.style];
  const rim = def.rim ?? 0.3;
  const hanging = s.length > 0;
  const hangFrom = def.hangFrom ?? SCULPT_HANG_FROM;
  const g: Vec3 = [0, -1, 0];
  const up = -1;
  const out: SculptMesh = { shell: [], spikes: [], hang: [], lines: [] };
  /** Tam giác quay mặt ra xa `ref` (mặc định tâm sọ): viền vỏ ngược và bóng cần pháp tuyến ra ngoài */
  const tri = (to: Vec3[][], t: Vec3[], ref: Vec3 = [0, 0, 0]) => {
    const [a, b, c] = t;
    const n = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
    const m: Vec3 = [(a[0] + b[0] + c[0]) / 3 - ref[0], (a[1] + b[1] + c[1]) / 3 - ref[1], (a[2] + b[2] + c[2]) / 3 - ref[2]];
    to.push(dot(n, m) < 0 ? [a, c, b] : t);
  };
  const quad = (to: Vec3[][], [a, b, c, d]: Vec3[], ref?: Vec3) => (tri(to, [a, b, c], ref), tri(to, [a, c, d], ref));
  const mid = (r: Vec3[]) => r.reduce((m, p) => [m[0] + p[0] / r.length, m[1] + p[1] / r.length, m[2] + p[2] / r.length], [0, 0, 0] as Vec3);
  const temple = (p: Vec3, lat: number): Vec3 =>
    hanging && p[2] > 0 ? [p[0], p[1], p[2] * (1 - SCULPT_TEMPLE * (1 - step(0, 40, lat)))] : p;

  const cols = Array.from({ length: NT + 1 }, (_, i) => {
    const lon = -180 + (i * 360) / NT;
    const a = Math.abs(lon);
    const hang = hanging && a >= hangFrom - 1e-6;
    const ease = def.hangEase ?? HANG_EASE;
    const w = hanging ? step(hangFrom - ease, hangFrom, a) : 0;
    const fall = hanging ? Math.max(0, Math.min(1, (a - hangFrom + ease) / ease)) ** 3 : 0;
    const h = rootLat(s, lon);
    const leave = w > 0 ? Math.atan2(dot(onSkull(lon, 0), g), -up) / D : h;
    const low = h + (leave - h) * fall;
    const thick = bangAt(s, lon)[1];
    const base = Math.max(rim * s.volume, s.bangThick * thick) * (1 - w) + s.volume * w;
    const high = crownLat(s, lon, low);
    const rowE = (lat: number, j: number) =>
      def.crown ? step(0, CROWN_EASE, lat - low) * step(0, CROWN_EASE, high - lat) : rowEase(j);
    const shell: Vec3[] = [];
    for (let j = 0; j <= NJ; j++) {
      const lat = low + ((high - low) * j) / NJ;
      shell.push(temple(onSkull(lon, lat, shellLift(s, lon, lat, rowE(lat, j), base)), lat));
    }
    return { lon, hang, bare: high - low < 0.5, shell, skin: temple(onSkull(lon, low, 0), low), top: onSkull(lon, high, 0) };
  });
  const clad = (i: number) => !cols[i].bare && !cols[i + 1].bare;

  for (let i = 0; i < NT; i++) {
    const [A, B] = [cols[i], cols[i + 1]];
    if (!clad(i)) continue;
    for (let j = 0; j < NJ; j++) quad(out.shell, [A.shell[j], B.shell[j], B.shell[j + 1], A.shell[j + 1]]);
    if (!(A.hang && B.hang)) quad(out.shell, [A.skin, A.shell[0], B.shell[0], B.skin]);
    if (def.crown) quad(out.shell, [A.top, A.shell[NJ], B.shell[NJ], B.top]);
  }

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
      const rings = spikeRings(s, k, base, arch);
      const tip = rings[rings.length - 1][0];
      for (let r = 1; r + 1 < RING; r++) tri(out.spikes, [rings[0][0], rings[0][r], rings[0][r + 1]], tip);
      for (let m = 0; m + 1 < rings.length; m++) {
        const c = mid(rings[m]);
        for (let r = 0; r < RING; r++) {
          const [a, b] = [rings[m][r], rings[m][(r + 1) % RING]];
          const next = rings[m + 1];
          if (next.length === 1) tri(out.spikes, [a, b, next[0]], c);
          else quad(out.spikes, [a, b, next[(r + 1) % RING], next[r]], c);
        }
      }
    }

  if (hanging) {
    const fwd: Vec3 = [0, 0, 1];
    const sheet = (root: Vec3, lon: number): Vec3[] => {
      const [tw, td, rounded = false, jitter = 0] = def.tips ?? [1, 0];
      const k0 = fromPart(s, lon) / tw;
      const scallop = rounded ? Math.sin(Math.PI * k0) ** 2 : Math.abs(2 * (k0 - Math.round(k0))) ** 0.7;
      const len = s.length - td * scallop - jitter * hash(Math.round(k0)) * (1 - scallop);
      const along = dot(root, g);
      const radial = root.map((v, d) => v - along * g[d]) as Vec3;
      const n = Math.hypot(...radial) || 1;
      const outward = radial.map((v, d) => v - (1 - SCULPT_DEPTH) * dot(radial, fwd) * fwd[d]);
      return Array.from({ length: NK + 1 }, (_, k) => {
        const v = k / NK;
        const d = (len - along) * v;
        const [start, bend, turn = 0] = def.curl ?? [0, 0];
        const [width, depth] = def.wave ?? [360, 0];
        const wave = depth * Math.sin(2 * Math.PI * v) * Math.cos((fromPart(s, lon) * 2 * Math.PI) / width);
        const fl = ((def.flare ?? SCULPT_FLARE) * v * v + bend * step(start, 0.85, v) - turn * step(0.85, 1, v) + wave) / n;
        const m = g.map((gd, i) => gd * d + outward[i] * fl) as Vec3;
        const ahead = dot(root, fwd) + dot(m, fwd);
        const tuck = ahead > 0 ? -ahead * SCULPT_TUCK * (1 - (1 - v) ** 2) : 0;
        return root.map((r, i) => r + m[i] + fwd[i] * tuck) as Vec3;
      });
    };
    const hung = cols.map((c) => (c.hang ? { outer: sheet(c.shell[0], c.lon), inner: sheet(c.skin, c.lon) } : undefined));
    for (let i = 0; i < NT; i++) {
      const [A, B] = [hung[i], hung[i + 1]];
      if (A && B) {
        for (let k = 0; k < NK; k++) {
          const axis: Vec3 = [0, A.outer[k][1], 0];
          quad(out.hang, [A.outer[k], B.outer[k], B.outer[k + 1], A.outer[k + 1]], axis);
          quad(out.hang, [A.inner[k], B.inner[k], B.inner[k + 1], A.inner[k + 1]], axis);
        }
        quad(out.hang, [A.outer[NK], B.outer[NK], B.inner[NK], A.inner[NK]], [0, 0, 0]);
      }
      const E = A && !B ? A : B && !A ? B : undefined;
      if (E) for (let k = 0; k < NK; k++) quad(out.hang, [E.inner[k], E.outer[k], E.outer[k + 1], E.inner[k + 1]]);
    }
  }

  hairLines(s, out.lines);

  if (def.pony || def.bun) {
    const n = onSkull(180, s.tie);
    const east: Vec3 = [1, 0, 0];
    const unit = (v: Vec3, alt: Vec3) => {
      const k = Math.hypot(...v);
      return k > 1e-3 ? (v.map((a) => a / k) as Vec3) : alt;
    };
    const rings: Vec3[][] = [];
    const ring = (c: Vec3, u: Vec3, w: Vec3, r: number, flat = 1) =>
      rings.push(Array.from({ length: KNOT_RING }, (_, i) => {
        const a = (i / KNOT_RING) * 2 * Math.PI;
        return c.map((v, d) => v + (u[d] * Math.cos(a) + w[d] * Math.sin(a) * flat) * r) as Vec3;
      }));
    if (def.pony) {
      const [width, arch, flat] = def.pony;
      const anchor = onSkull(180, s.tie, 0);
      const at = (a: number, b: number): Vec3 => anchor.map((v, d) => v + n[d] * arch * a + g[d] * s.tail * b) as Vec3;
      const P = [anchor, at(1, 0), at(1.1, 0.45), at(0.8, 1)];
      const b = unit(cross(n, g), east);
      const radius = (v: number) => width * (0.3 + 0.7 * step(0, 0.3, v)) * (1 - v ** 3);
      // trục lọt vào trong đầu thì đẩy ra theo bán kính như softplus: đuôi ôm gáy chứ không xuyên sọ
      const centers = Array.from({ length: PONY_SEG + 1 }, (_, k) => {
        const v = k / PONY_SEG;
        const c = P[0].map((_, d) => (1 - v) ** 3 * P[0][d] + 3 * (1 - v) ** 2 * v * P[1][d] + 3 * (1 - v) * v * v * P[2][d] + v ** 3 * P[3][d]) as Vec3;
        const len = Math.hypot(...c);
        const clear = 1 + s.volume + radius(v) * 0.9;
        const soft = clear + 0.05 * Math.log1p(Math.exp((len - clear) / 0.05));
        const k0 = 1 + (soft / len - 1) * step(0.04, 0.2, v);
        return c.map((a) => a * k0) as Vec3;
      });
      centers.forEach((c, k) => {
        const tan = centers[Math.min(k + 1, PONY_SEG)].map((a, d) => a - centers[Math.max(k - 1, 0)][d]) as Vec3;
        ring(c, b, unit(cross(b, tan), n), radius(k / PONY_SEG), flat);
      });
    } else {
      const [radius, squash] = def.bun!;
      const h = radius * squash;
      const anchor = onSkull(180, s.tie, s.volume + h * 0.35);
      const b = unit(cross(n, east), east);
      const m = cross(n, b);
      for (let k = 0; k <= BUN_SEG; k++) {
        const u = -1 + (2 * k) / BUN_SEG;
        ring(anchor.map((v, d) => v + n[d] * u * h) as Vec3, b, m, radius * Math.sqrt(Math.max(0, 1 - u * u)));
      }
    }
    for (let k = 0; k + 1 < rings.length; k++) {
      const c = mid([...rings[k], ...rings[k + 1]]);
      for (let r = 0; r < KNOT_RING; r++) {
        const r1 = (r + 1) % KNOT_RING;
        quad(out.spikes, [rings[k][r], rings[k][r1], rings[k + 1][r1], rings[k + 1][r]], c);
      }
    }
    for (const end of [rings[0], rings[rings.length - 1]]) {
      const c = mid(end);
      for (let r = 0; r < KNOT_RING; r++) tri(out.spikes, [c, end[r], end[(r + 1) % KNOT_RING]], mid(rings[Math.floor(rings.length / 2)]));
    }
  }
  return out;
}
