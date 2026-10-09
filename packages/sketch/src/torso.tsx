import { D, REAR_YAW, RIG, TORSO_DEPTH, TORSO_TILT } from "./constants";
import { GarmentSchema, type CharacterData, type Garment, type GarmentStyle } from "./schema";
import { mix } from "./geometry";
import { localProject, type LocalLens } from "./lens";
import { chain, weld } from "./sculpt";
import { lonOf, turnPoint, type Vec3 } from "./sphere";
import type { View } from "./types";

type Dims = Required<Omit<Garment, "style">>;
type P2 = [number, number];

/** Điểm trên mặt khối: kinh độ, độ (`0` giữa ngực, dương về `+x`, `180` giữa lưng), và `y` của nhóm thân */
type SP = [lon: number, y: number];

/** Màu tô của mảng: màu áo, màu nét, màu nhấn (`accent` của mảnh, bỏ trống là màu áo tối đi) hay một mã màu cố định */
export type MarkFill = "color" | "line" | "accent" | `#${string}`;

/**
 * Một đặc điểm trên mặt khối. `pts` không `fill` là nét, `closed` thì khép vòng; có `fill` là mảng
 * kín tô màu, viền nét `k` (`0` là không viền). `dot` là một chấm ở điểm đầu
 */
type Mark = {
  k: number;
  fill?: MarkFill;
  graze?: number;
  pts: SP[];
  closed?: boolean;
  dot?: boolean;
};

/** Mặt khối của một bộ số đã đủ, để kiểu áo đặt đặc điểm theo số đo */
interface Surface {
  g: Garment & Dims;
  /** Mép trên, vành vai, gấu */
  yC: number;
  yS: number;
  yH: number;
  /** Nửa rộng khối ở độ cao `y` */
  a: (y: number) => number;
  /** Chỗ viền cổ nở rộng `grow` chạm mặt vát hai bên */
  top: (grow?: number) => number;
  /** Điểm cách trục `x` px ở độ cao `y`, mặt trước hay mặt sau; quá bề ngang thì dồn về cạnh */
  at: (x: number, y: number, back?: boolean) => SP;
  /** Điểm trên viền cổ nở rộng và hạ `grow` px, ở góc `phi` quanh trục cổ: `0` giữa trước, `±180` giữa sau */
  neck: (phi: number, grow?: number) => SP;
  /** `y` ở phân số `t` từ vành vai (`0`) xuống khớp hông (`1`) */
  t: (t: number) => number;
}

/**
 * Cổ bẻ nổi khối: chân cổ dựng quanh viền cổ, lá cổ gập từ đỉnh chân cổ xuống. Mép ngoài quanh lưng
 * là dải rộng `band` px, phía trước đi thẳng từ bên cổ qua `flap` về giữa ngực
 */
interface Collar {
  /** Chân cổ cao bấy nhiêu px ở nửa sau, thấp dần về `0` ở giữa ngực */
  stand: number;
  /** Lá cổ rộng bấy nhiêu px trên mặt khối giữa lưng, và ở hai bên cổ */
  band: number;
  side: number;
  flap: [x: number, y: number][];
  /** Lá cổ nổi khỏi mặt khối bấy nhiêu px ở nếp gập và ở mép ngoài */
  lift: [fold: number, edge: number];
  /** Mép ngoài vểnh thêm bấy nhiêu px ở mũi cổ, điểm `flap[tipAt]` (bỏ trống là điểm cuối) */
  tip: number;
  tipAt?: number;
  /** Màu tô, bỏ trống là màu áo */
  fill?: MarkFill;
}

/** Viền cổ gân nổi khối: vòng vải có bề dày quanh viền cổ, từ mép cổ xuống viền cổ nở rộng `width` */
interface Rib {
  width: number;
  /** Mép cổ dựng lên bấy nhiêu px ở nửa sau, thấp dần về `0` ở giữa ngực */
  stand: number;
  /** Vòng nổi khỏi mặt khối bấy nhiêu px ở mép cổ và ở mép dưới, nửa sau; phía trước nhạt về `RIB_FRONT` lần */
  lift: [inner: number, outer: number];
  /** Nét viền, lần nét thân */
  line: number;
  /** Vạch gân trên vòng, mỗi `step` độ quanh trục cổ, nét `k` */
  ticks?: { step: number; k: number };
}

/**
 * Mũ trùm nổi khối: hai vạt vải từ viền cổ xuống mép dưới trải trên vai và lưng, liền nhau ở giữa
 * lưng, phồng thành đống sau gáy. Mép dưới thấp hơn chỗ viền cổ chạm mặt vát `drop` px, nút
 * `[phi, px]` từ giữa trước (`0`) tới giữa sau (`180`), đối xứng hai bên
 */
interface Hood {
  drop: [phi: number, px: number][];
  /** Đuôi vạt vắt qua giữa ngực bấy nhiêu độ quanh trục cổ */
  tuck: number;
  /** Tấm nổi khỏi mặt khối bấy nhiêu px ở mép cổ và ở mép dưới, như `Rib.lift` */
  lift: [inner: number, outer: number];
  /** Đống vải phồng thêm bấy nhiêu px ở giữa trước và giữa sau, đỉnh giữa bề rộng tấm, chỗ lưng dựng đứng */
  pile: [front: number, back: number];
  line: number;
  /** Nét đường may giữa lưng */
  seam: number;
}

interface GarmentStyleDef {
  label: string;
  dims: Dims;
  /** Cổ trước võng chữ U theo hình cos, hay chữ V thẳng từ hai bên xuống giữa */
  neckline: "round" | "v" | "square";
  marks: (s: Surface) => Mark[];
  collar?: (s: Surface) => Collar;
  rib?: Rib;
  hood?: Hood;
}

/** Nét trên mặt khối chỉ vẽ ở chỗ quay ra người xem ít nhất bấy nhiêu, không dồn sát viền bóng */
const GRAZE = 0.5;
/** Nét viền cổ bẻ nổi khối, lần nét thân */
const COLLAR_LINE = 0.6;
/** Nửa sau cổ bẻ nổi khối cao lên bấy nhiêu px mỗi px lùi sau trục thân, vuốt mềm quanh trục */
const COLLAR_LEAN = 0.35;
/** Viền cổ gân nổi khối ở giữa ngực chỉ nổi bấy nhiêu lần độ nổi nửa sau, để mép cổ trước không bị đầu che */
const RIB_FRONT = 0.3;
/** Đỉnh khối hẹp hơn miệng cổ áo bấy nhiêu lần, để viền cổ nằm hẳn trên mặt vát */
const NECK_TOP = 0.8;

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

const curve = <T,>(n: number, f: (u: number) => T) =>
  Array.from({ length: n + 1 }, (_, i) => f(i / n));

const bezier = (u: number, a: number, b: number, c: number) =>
  (1 - u) ** 2 * a + 2 * u * (1 - u) * b + u * u * c;

const SIDES = [-1, 1] as const;

/** Catmull–Rom qua các nút `[x, y]` tăng dần theo `x`, giữ nguyên hai đầu */
const spline = (nodes: [number, number][], x: number) => {
  const n = nodes.length;
  let i = 0;
  while (i < n - 2 && x > nodes[i + 1][0]) i++;
  const [p0, p1, p2, p3] = [
    nodes[Math.max(0, i - 1)],
    nodes[i],
    nodes[i + 1],
    nodes[Math.min(n - 1, i + 2)],
  ];
  const u = Math.max(0, Math.min(1, (x - p1[0]) / (p2[0] - p1[0])));
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0])) * (p2[0] - p1[0]);
  const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0])) * (p2[0] - p1[0]);
  return (
    (2 * u ** 3 - 3 * u ** 2 + 1) * p1[1] +
    (u ** 3 - 2 * u ** 2 + u) * m1 +
    (-2 * u ** 3 + 3 * u ** 2) * p2[1] +
    (u ** 3 - u ** 2) * m2
  );
};

/**
 * Mép ngoài phía trước của cổ bẻ trên hình phẳng, nửa `x ≥ 0`: thẳng từ bên cổ (thấp hơn mép cổ
 * `drop`) qua các điểm `flap` về đáy cổ giữa ngực, lấy mẫu dày
 */
const lipOf = (s: Surface, drop: number, flap: [x: number, y: number][]): P2[] => {
  const ySide = s.top() + drop;
  const edge: P2[] = [[s.a(ySide), ySide], ...flap, [0, s.top() + s.g.neckFront]];
  // Lấy mẫu dày trên hình phẳng: chèn điểm theo kinh độ thì đoạn sát bên cổ phồng ra ngoài mặt khối
  return [
    edge[0],
    ...edge.slice(1).flatMap(([x, y], i) => {
      const [px, py] = edge[i];
      const n = Math.max(2, Math.ceil(Math.hypot(x - px, y - py) / 1.5));
      return curve(n, (u): P2 => [px + (x - px) * u, py + (y - py) * u]).slice(1);
    }),
  ];
};

/** Phần polygon trên hình phẳng nằm trong miệng cổ chữ V */
const inV = (s: Surface, poly: P2[]) =>
  SIDES.reduce((pts, d) => {
    const inside = ([x, y]: P2) => s.g.neck * (1 - (y - s.top()) / s.g.neckFront) - d * x;
    return pts.flatMap((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const [a, b] = [inside(p), inside(q)];
      const out: P2[] = a >= 0 ? [p] : [];
      if (a >= 0 !== b >= 0)
        out.push([lerp(p[0], q[0], a / (a - b)), lerp(p[1], q[1], a / (a - b))]);
      return out;
    });
  }, poly);

/** Cung elip tâm `(cx, cy)` từ góc `a0` tới `a1`, độ, trên hình phẳng */
const oval = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number) =>
  curve(16, (u): P2 => {
    const t = (a0 + (a1 - a0) * u) * D;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  });

/** Số của áo phông: các áo khác theo cùng dáng, đè vài số */
const TEE: Dims = {
  ease: 11,
  fit: 0.7,
  waist: 4,
  hem: 1,
  rise: 6,
  neck: 20,
  neckFront: 7,
  neckBack: 0,
  slope: 0.6,
  round: 16,
  hemRound: 8,
};

/** Đường quanh khối ở độ cao `y` */
const around = (y: number, k: number): Mark => ({
  pts: curve(72, (u): SP => [-180 + 360 * u, y]),
  k,
  graze: 0.05,
});

/** Nét dọc từ `y0` tới `y1` ở mỗi kinh độ cách nhau `step` độ */
const ticks = (y0: number, y1: number, step: number, k: number): Mark[] =>
  Array.from({ length: Math.round(360 / step) }, (_, i) => ({
    pts: [
      [-180 + step * i, y0],
      [-180 + step * i, y1],
    ],
    k,
    graze: 0.3,
  }));

/** Độ cao dọc nẹp áo, từ đáy cổ giữa ngực (`0`) tới gấu (`1`) */
const placket = (s: Surface, us: number[]) => {
  const yA = s.top() + s.g.neckFront;
  return us.map((u) => yA + (s.yH - yA) * u);
};

const COLLAR_CREAM = "#f6efe4";

/** Bảng của từng kiểu thân áo; JSON chọn tên kiểu và đè vài số. docs/02-trang-phuc.md#thân-áo-dựng-khối */
export const GARMENT_STYLES: Record<GarmentStyle, GarmentStyleDef> = {
  bare: {
    label: "Ngực trần dựng khối",
    dims: {
      ease: 0,
      fit: 0.55,
      waist: 8,
      hem: -4,
      rise: -5,
      neck: 15,
      neckFront: 0,
      neckBack: 0,
      slope: 0.85,
      round: 12,
      hemRound: 10,
    },
    neckline: "round",
    marks: (s) => [
      ...SIDES.map((d) => ({
        pts: curve(8, (u): SP => [
          d * (5 + 48 * u),
          s.t(0.15 + 0.05 * Math.sin(Math.PI * u) - 0.05 * u),
        ]),
        k: 0.89,
      })),
      {
        pts: [
          [0, s.t(0.26)],
          [0, s.t(0.43)],
        ],
        k: 0.89,
      },
      { pts: [[0, s.t(0.66)]], k: 0.6, dot: true },
      {
        pts: [
          [180, s.t(0.05)],
          [180, s.t(0.68)],
        ],
        k: 0.89,
      },
      ...SIDES.map((d) => ({
        pts: curve(8, (u): SP => [180 + d * (35 - 24 * u), s.t(bezier(u, 0.14, 0.33, 0.2))]),
        k: 0.89,
      })),
    ],
  },
  tshirt: {
    label: "Áo phông dựng khối",
    dims: {
      ease: 11,
      fit: 0.7,
      waist: 4,
      hem: 1,
      rise: 6,
      neck: 20,
      neckFront: 7,
      neckBack: 0,
      slope: 0.6,
      round: 16,
      hemRound: 8,
    },
    neckline: "round",
    marks: () => [],
    rib: { width: 6, stand: 2, lift: [3, 0.3], line: 0.8 },
  },
  shirt: {
    label: "Sơ mi dựng khối",
    dims: { ...TEE, hem: 5, neckFront: 10 },
    neckline: "v",
    marks: (s) => {
      const [yA, ...buttons] = placket(s, [0, 0.2, 0.52, 0.84]);
      return [
        { pts: [s.at(-1.5, yA), s.at(-1.5, s.yH - 1)], k: 0.45 },
        ...buttons.map((y) => ({ pts: [s.at(1.5, y)], k: 0.9, dot: true })),
      ];
    },
    collar: (s) => ({
      stand: 6,
      band: 9,
      side: 6,
      flap: [[17, s.top() + s.g.neckFront + 11]],
      lift: [5, 2],
      tip: 9,
    }),
  },
  polo: {
    label: "Áo polo dựng khối",
    dims: { ...TEE, hem: 3.5, neckFront: 9 },
    neckline: "v",
    marks: (s) => {
      const yA = s.top() + s.g.neckFront;
      const yB = yA + 30;
      return [
        { pts: [s.at(-5, yA), s.at(-5, yB), s.at(5, yB), s.at(5, yA)], k: 0.45 },
        { pts: [s.at(0, yA + 16)], k: 0.9, dot: true },
      ];
    },
    collar: (s) => ({
      stand: 6,
      band: 8,
      side: 6,
      flap: [[16, s.top() + s.g.neckFront + 9]],
      lift: [5, 2],
      tip: 8,
    }),
  },
  sweater: {
    label: "Áo len dựng khối",
    dims: { ...TEE, hem: 2, neckFront: 12 },
    neckline: "round",
    rib: { width: 8, stand: 4, lift: [4.5, 0.4], line: 0.78, ticks: { step: 15, k: 0.56 } },
    marks: (s) => [around(s.yH - 13, 0.78), ...ticks(s.yH - 12, s.yH - 1, 12, 0.56)],
  },
  suit: {
    label: "Vest dựng khối",
    dims: { ...TEE, hem: 10, fit: 0.8, neckFront: 76 },
    neckline: "v",
    marks: (s) => {
      const top = s.top();
      const [yA, ...buttons] = placket(s, [0, 0.26, 0.6]);
      return [
        // Cà vạt dài quá đáy cổ, cắt theo chữ V: đuôi luồn dưới vạt áo
        {
          pts: inV(s, [
            [-5.5, top + 1],
            [5.5, top + 1],
            [3, top + 11],
            [8, top + 60],
            [8.5, top + 92],
            [0, top + 102],
            [-8.5, top + 92],
            [-8, top + 60],
            [-3, top + 11],
          ]).map(([x, y]) => s.at(x, y)),
          fill: "line",
          k: 0,
        },
        { pts: [s.at(0, yA), s.at(-1, yA + 20), s.at(0, s.yH - 9)], k: 0.45 },
        // Hai vạt trước bo tròn ở gấu
        ...SIDES.map((d) => ({
          pts: curve(6, (u): [number, number] => [
            d * 9 * (1 - Math.cos((u * Math.PI) / 2)),
            s.yH - 9 + 8 * Math.sin((u * Math.PI) / 2),
          ]).map(([x, y]) => s.at(x, y)),
          k: 0.45,
        })),
        ...buttons.map((y) => ({ pts: [s.at(3.5, y)], k: 0.9, dot: true })),
      ];
    },
    // Ve áo: mép ngoài qua đỉnh ve rồi về cúc trên, vểnh ở đỉnh ve
    collar: (s) => ({
      stand: 6,
      band: 7,
      side: 6,
      flap: [
        [27, s.top() + 38],
        [8, s.top() + s.g.neckFront - 8],
      ],
      lift: [7, 1.5],
      tip: 4,
      tipAt: 0,
    }),
  },
  hoodie: {
    label: "Hoodie dựng khối",
    dims: { ...TEE, hem: 5.5, slope: 0.7, neckFront: 8, neckBack: 8 },
    neckline: "v",
    hood: {
      drop: [
        [0, 16],
        [35, 13],
        [70, 9],
        [100, 10],
        [125, 22],
        [150, 40],
        [180, 50],
      ],
      tuck: 30,
      lift: [4, 0.3],
      pile: [2, 12],
      line: 1,
      seam: 0.67,
    },
    marks: (s) => {
      const top = s.top();
      const yP = s.t(0.6);
      const yB = s.yH - 12;
      return [
        {
          pts: [
            s.at(-19, yP),
            s.at(19, yP),
            s.at(24, yP + 8),
            s.at(33, yP + 26),
            s.at(34, yB),
            s.at(-34, yB),
            s.at(-33, yP + 26),
            s.at(-24, yP + 8),
          ],
          fill: "color",
          k: 0.67,
        },
        ...SIDES.map((d) => ({
          pts: [s.at(d * 14, yP), s.at(d * 21, yP + 14), s.at(d * 30, yB - 2)],
          k: 0.67,
        })),
        around(yB, 1),
        ...SIDES.flatMap((d): Mark[] => [
          { pts: [s.at(d * 10, top + 13), s.at(d * 10, top + 42)], k: 0.67 },
          {
            pts: [
              s.at(d * 10 - 2.5, top + 42),
              s.at(d * 10 + 2.5, top + 42),
              s.at(d * 10 + 2.5, top + 50),
              s.at(d * 10 - 2.5, top + 50),
            ],
            fill: "color",
            k: 0.67,
          },
        ]),
      ];
    },
  },
  blazer: {
    label: "Blazer nữ dựng khối",
    dims: { ...TEE, ease: 8, waist: 11, fit: 0.85, hem: 0, neckFront: 73 },
    neckline: "v",
    marks: (s) => {
      const top = s.top();
      return [
        {
          pts: inV(s, [
            [-17, top + 13],
            [0, top + 17],
            [17, top + 13],
            [0, top + s.g.neckFront],
          ]).map(([x, y]) => s.at(x, y)),
          fill: "accent",
          k: 0.45,
        },
        ...placket(s, [0.38, 0.75]).map((y) => ({ pts: [s.at(18, y)], dot: true, k: 1.05 })),
        ...SIDES.map((d) => ({
          pts: [s.at(d * 25, placket(s, [0.62])[0]), s.at(d * 37, placket(s, [0.54])[0])],
          k: 0.5,
        })),
      ];
    },
    collar: (s) => ({
      stand: 4,
      band: 7,
      side: 5,
      flap: [
        [25, s.top() + 22],
        [19, s.top() + 28],
        [29, s.top() + 33],
        [9, s.top() + s.g.neckFront - 4],
      ],
      lift: [5, 1.5],
      tip: 4,
      tipAt: 2,
    }),
  },
  cardigan: {
    label: "Cardigan cổ V dựng khối",
    dims: { ...TEE, ease: 12, waist: 3, hem: 6, neckFront: 52 },
    neckline: "v",
    rib: { width: 5, stand: 2, lift: [2, 0.5], line: 0.55 },
    marks: (s) => [
      {
        pts: inV(s, [
          [-22, s.top() + 12],
          [22, s.top() + 12],
          [0, s.top() + s.g.neckFront],
        ]).map(([x, y]) => s.at(x, y)),
        fill: "accent",
        k: 0.45,
      },
      { pts: [s.at(-3, s.top() + s.g.neckFront), s.at(-3, s.yH - 2)], k: 0.45 },
      ...placket(s, [0.2, 0.5, 0.8]).map((y) => ({ pts: [s.at(3, y)], dot: true, k: 0.85 })),
      around(s.yH - 9, 0.5),
      ...ticks(s.yH - 8, s.yH - 2, 22, 0.35),
    ],
  },
  bowShirt: {
    label: "Sơ mi cổ nơ dựng khối",
    dims: { ...TEE, ease: 8, waist: 5, hem: 3, neckFront: 17 },
    neckline: "v",
    marks: (s) => {
      const y = s.top() + s.g.neckFront + 2;
      return [
        { pts: [s.at(0, y + 30), s.at(0, s.yH - 2)], k: 0.4 },
        ...SIDES.flatMap((d): Mark[] => [
          {
            pts: [
              [0, y],
              [d * 17, y - 5],
              [d * 19, y + 7],
              [d * 7, y + 8],
            ].map(([x, yy]) => s.at(x, yy)),
            fill: "accent",
            k: 0.45,
          },
          {
            pts: [
              [d * 2, y + 3],
              [d * 7, y + 4],
              [d * 14, y + 34],
              [d * 5, y + 29],
            ].map(([x, yy]) => s.at(x, yy)),
            fill: "accent",
            k: 0.4,
          },
        ]),
        { pts: oval(0, y + 2, 3, 4, 0, 360).map(([x, yy]) => s.at(x, yy)), fill: "accent", k: 0.5 },
      ];
    },
    collar: (s) => ({
      stand: 4,
      band: 5,
      side: 4,
      flap: [[12, s.top() + 22]],
      lift: [3, 1],
      tip: 3,
    }),
  },
  squareNeck: {
    label: "Áo cổ vuông eo cao dựng khối",
    dims: { ...TEE, ease: 9, waist: 10, fit: 1, hem: 9, neck: 23, neckFront: 19 },
    neckline: "square",
    rib: { width: 3, stand: 1, lift: [1, 0.3], line: 0.5 },
    marks: (s) => [
      around(s.t(0.58), 0.5),
      ...[-55, 0, 55, 125, 180, -125].map((lon) => ({
        pts: [
          [lon, s.t(0.66)],
          [lon, s.yH - 3],
        ] as SP[],
        k: 0.35,
        graze: 0.3,
      })),
    ],
  },
  blouse: {
    label: "Blouse cổ lá sen dựng khối",
    dims: { ...TEE, ease: 9, fit: 1, waist: 10, hem: 8, neck: 19, neckFront: 8 },
    neckline: "round",
    marks: (s) => {
      const top = s.top();
      const seam = s.t(0.7);
      const yb = top + 42;
      const onFront = (pts: [number, number][]) => pts.map(([x, y]) => s.at(x, y));
      return [
        around(seam, 0.5),
        ...[0, 38, -38, 76, -76, 114, -114, 152, -152].map((lon) => ({
          pts: [
            [lon, seam + 5],
            [lon, s.yH - 1],
          ] as SP[],
          k: 0.4,
          graze: 0.3,
        })),
        ...SIDES.map((d) => ({
          pts: onFront([
            [d * 1.5, yb + 2],
            [d * 9, yb + 17],
            [d * 4, yb + 19],
            [0, yb + 4],
          ]),
          fill: "accent" as const,
          k: 0.4,
        })),
        ...SIDES.map((d) => ({
          pts: onFront(oval(d * 8.5, yb, 7.5, 6.5, 0, 360)),
          fill: "accent" as const,
          k: 0.45,
        })),
        { pts: onFront(oval(0, yb, 3.5, 4.5, 0, 360)), fill: "accent", k: 0.45 },
      ];
    },
    // Lá sen ba cánh: mỗi bên một cánh ở bên cổ và nửa cánh giữa, hai nửa gặp nhau ở trục giữa
    collar: (s) => {
      const top = s.top();
      return {
        stand: 2,
        band: 6,
        side: 3,
        flap: [...oval(14.5, top + 8, 6.5, 6, -45, 165), ...oval(0, top + 11, 8, 7, -35, 90)],
        lift: [3, 2],
        tip: 2,
        tipAt: 10,
        fill: COLLAR_CREAM,
      };
    },
  },
};

/** Bộ số đã đủ: trường bỏ trống lấy số của kiểu */
export function garmentOf(raw: Partial<Garment> | undefined): Garment & Dims {
  const g = GarmentSchema.parse(raw ?? {});
  const dims = { ...GARMENT_STYLES[g.style].dims };
  for (const k of Object.keys(dims) as (keyof Dims)[]) if (g[k] !== undefined) dims[k] = g[k];
  return { ...g, ...dims };
}

/** Góc nghỉ của nấc `quarter`, độ: độ lệch tĩnh `face.turn` đổi ra góc trên sọ, như nét mặt */
export const restYaw = (c: CharacterData) => lonOf(c.face.turn, (RIG.headH / 2) * c.head.scaleX);

/**
 * Góc quay của khối thân theo nấc: `front` 0, `quarter` góc nghỉ `rest`, `side` 90, `rear`
 * `REAR_YAW`, `back` 180. Không cộng lắc của hành động: thân không ngó theo đầu
 */
export const torsoYaw = (view: View, rest: number) =>
  view === "front"
    ? 0
    : view === "quarter"
      ? rest
      : view === "side"
        ? 90
        : view === "rear"
          ? REAR_YAW
          : 180;

type Rig = CharacterData["rig"];

/**
 * Mặt cắt dọc của khối: nửa rộng `a` theo `y` (toạ độ nhóm thân, gốc ở hông), từ khớp cổ vát xuống
 * vành vai, bo góc, thon và thắt eo xuống gấu, bo góc gấu
 */
function profile(g: Dims, rig: Rig, inset: number) {
  const torso = RIG.torso * rig.height;
  const yC = -(torso + RIG.neck * rig.height) - g.rise;
  const yS = -torso + rig.shoulderDrop;
  const yH = Math.max(yS + 1, g.hem * rig.height);
  const aS = rig.shoulderHalf + g.ease - inset;
  const aH = rig.hipHalf + g.fit * (rig.shoulderHalf - rig.hipHalf) + g.ease - inset;
  const aT = Math.min(aS, Math.max(1, g.neck * NECK_TOP - inset));
  const yR = Math.min(yS, yC + (aS - aT) * g.slope);
  const P0: P2 = [aT, yC];
  const P1: P2 = [aS, yR];
  const P3: P2 = [aH, yH];
  const toward = (p: P2, q: P2, r: number): P2 => {
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const k = Math.min(r, l * 0.8) / l;
    return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  };
  const A = toward(P1, P0, g.round);
  const B = toward(P1, P3, g.round);
  const C = toward(P3, P1, g.hemRound);
  const E: P2 = [Math.max(0, aH - g.hemRound), yH];
  const pts: P2[] = [P0, A];
  const arc = (from: P2, ctrl: P2, to: P2, n: number) => {
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      pts.push([bezier(u, from[0], ctrl[0], to[0]), bezier(u, from[1], ctrl[1], to[1])]);
    }
  };
  arc(A, P1, B, 12);
  for (let i = 1; i <= 16; i++)
    pts.push([B[0] + ((C[0] - B[0]) * i) / 16, B[1] + ((C[1] - B[1]) * i) / 16]);
  const hemFrom = pts.length;
  arc(C, P3, E, 8);
  // Eo: dưới vành vai co vào theo một vòm, sâu nhất giữa vành vai và gấu
  for (const p of pts)
    if (p[1] > yR) p[0] -= g.waist * Math.sin((Math.PI * (p[1] - yR)) / (yH - yR));
  // Nhánh trên, từ khớp cổ tới chỗ rộng nhất: nửa rộng tăng dần, tra ngược được ra `y`
  let apex = 0;
  for (let i = 1; i < 14; i++) if (pts[i][0] > pts[apex][0]) apex = i;
  return {
    pts,
    yC,
    yS,
    yH,
    aH: pts[pts.length - 1][0],
    upper: pts.slice(0, apex + 1),
    hemFrom,
  };
}

const lerpAt = (pts: P2[], v: number, from: 0 | 1, to: 0 | 1) => {
  if (v <= pts[0][from]) return pts[0][to];
  for (let i = 1; i < pts.length; i++)
    if (v <= pts[i][from]) {
      const [p, q] = [pts[i - 1], pts[i]];
      const u = (v - p[from]) / (q[from] - p[from] || 1);
      return p[to] + (q[to] - p[to]) * u;
    }
  return pts[pts.length - 1][to];
};

/**
 * Nửa rộng vành vai nơi đặt gốc tay: tâm nét viền ở độ cao khớp vai — bề ngang áo lùi vào nửa nét,
 * để tay mọc ra đúng từ viền thân
 */
export function shoulderRoot(c: CharacterData) {
  const pr = profile(garmentOf(c.pieces.torso.garment), c.rig, 0);
  return Math.max(0, lerpAt(pr.pts, pr.yS, 1, 0) - c.rig.stroke / 2);
}

/**
 * Nửa khoảng cách chiếu của hai gốc chi trên một vành nửa rộng `half`: hai điểm kinh độ `±90`
 * quay theo góc `yaw`. Gốc gần có `z ≥ 0`, gốc xa `z ≤ 0`; quay quá `90` thì gốc gần sang `+x`
 */
export const limbSpread = (half: number, yaw: number) => Math.abs(half * Math.cos(yaw * D));

export interface TorsoPaths {
  /** Hình bao của khối, đã co vào nửa nét: viền vẽ dày gấp đôi bên dưới ruột */
  body: string;
  /** Đặc điểm trên mặt khối theo thứ tự vẽ, đã bỏ phần quay ra sau: có `fill` là mảng tô không viền, không thì là nét */
  lines: { d: string; k: number; fill?: MarkFill }[];
  /**
   * Cổ bẻ nổi khối, từng tấm theo thứ tự vẽ (chân cổ rồi lá cổ): `under` là phần sau viền bóng của
   * thân, vẽ trước ruột thân để thân che; `over` vẽ sau các đặc điểm. `edge` là nét viền vẽ dưới ruột.
   * Viền cổ gân nổi khối và mũ trùm nổi khối cũng là tấm như thế
   */
  collar: Record<
    "under" | "over",
    {
      fill: string;
      edge: string;
      color: MarkFill;
      /** Nét viền, lần nét thân */
      line: number;
      /** Nét vẽ đè lên ruột */
      detail: { d: string; k: number }[];
    }[]
  >;
  /** Hộp bao cả viền, trong hệ nhóm thân */
  box: { x: number; y: number; w: number; h: number };
}

const f = (n: number) => String(Math.round(n * 10) / 10);

/**
 * Bao lồi phía trên (`side` `1`) hay phía dưới (`-1`) trên hình chiếu (`y` xuống) của một đám điểm,
 * từ trái sang phải
 */
function hullChain(pts: Vec3[], side: 1 | -1): Vec3[] {
  const s = [...pts].sort((p, q) => p[0] - q[0]);
  const h: Vec3[] = [];
  for (const p of s) {
    while (h.length > 1) {
      const [o, q] = [h[h.length - 2], h[h.length - 1]];
      if (side * ((q[0] - o[0]) * (p[1] - o[1]) - (q[1] - o[1]) * (p[0] - o[0])) > 0) break;
      h.pop();
    }
    h.push(p);
  }
  return h;
}

const cache = new Map<string, TorsoPaths>();
const CACHE_SIZE = 128;

/**
 * Chiếu thân áo dựng khối quay `yaw` độ quanh trục dọc, ra toạ độ nhóm thân (gốc ở hông). Người 3D
 * truyền `lens` — ống kính thật trong hệ thân — thay cho `yaw`. Nhớ kết quả theo đầu vào: dáng người
 * không đổi thì mọi khung dùng lại.
 */
export function torsoPaths(
  c: CharacterData,
  yaw: number,
  stroke: number,
  lens?: LocalLens,
): TorsoPaths {
  const { rig } = c;
  const raw = c.pieces.torso.garment;
  const key = JSON.stringify([
    raw,
    yaw,
    rig.height,
    rig.shoulderHalf,
    rig.shoulderDrop,
    rig.hipHalf,
    stroke,
    lens,
  ]);
  let p = cache.get(key);
  if (!p) {
    p = buildTorso(c, yaw, stroke, lens);
    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(key, p);
  }
  return p;
}

function buildTorso(c: CharacterData, yaw: number, stroke: number, lens?: LocalLens): TorsoPaths {
  const { rig } = c;
  const g = garmentOf(c.pieces.torso.garment);
  const def = GARMENT_STYLES[g.style];
  const inset = stroke / 2;
  const pr = profile(g, rig, inset);
  const t = { yaw, pitch: 0 };
  const cy = Math.cos(yaw * D);
  const sy = Math.sin(yaw * D);
  const aAt = (y: number) => lerpAt(pr.pts, y, 1, 0);
  /** Người 2D nhìn từ hơi cao hơn tầm mắt: điểm càng quay ra người xem càng thấp xuống */
  const view = lens
    ? (p: Vec3): Vec3 => {
        const [x, y, d] = localProject(lens, p);
        return [x, y, -d];
      }
    : (p: Vec3): Vec3 => {
        const [x, y, z] = turnPoint(t, p);
        return [x, y + TORSO_TILT * z, z];
      };
  /**
   * Độ quay ra người xem của điểm `p` trên mặt khối, dương là quay ra. Người 2D: pháp tuyến ngang của
   * vành đồng dạng sau khi quay; người 3D: pháp tuyến đủ, cả độ vát của mặt cắt dọc, với tia tới mắt
   */
  const facing = ([x, y, z]: Vec3) => {
    const nx = x;
    const nz = z / TORSO_DEPTH ** 2;
    if (!lens) return (-nx * sy + nz * cy) / (Math.hypot(nx, nz) || 1);
    const ny = (-aAt(y) * (aAt(y + 4) - aAt(y - 4))) / 8;
    const e = [lens.eye[0] - x, lens.eye[1] - y, lens.eye[2] - z];
    return (nx * e[0] + ny * e[1] + nz * e[2]) / (Math.hypot(nx, ny, nz) * Math.hypot(...e) || 1);
  };
  const ring = (a: number, y: number, phi: number) =>
    view([a * Math.sin(phi), y, TORSO_DEPTH * a * Math.cos(phi)]);
  let outline: Vec3[];
  if (lens) {
    // Chiếu thật: mép hai bên là điểm xa trục nhất của từng tiết diện; đỉnh là bao trên các tiết diện
    // từ mép trên tới vành vai, đáy là bao dưới các tiết diện bo góc gấu
    const rings = pr.pts.map(([a, y]) => curve(179, (u) => ring(a, y, 2 * Math.PI * u)));
    const apex = pr.upper.length - 1;
    const most = (r: Vec3[], s: number) => r.reduce((m, p) => (s * p[0] > s * m[0] ? p : m));
    const top = hullChain(rings.slice(0, apex + 1).flat(), 1);
    const hem = hullChain(rings.slice(pr.hemFrom - 1).flat(), -1).reverse();
    const sides = rings.slice(apex + 1, pr.hemFrom - 1);
    outline = [
      ...top,
      ...sides.map((r) => most(r, 1)),
      ...hem,
      ...sides.map((r) => most(r, -1)).reverse(),
    ];
  } else {
    // Mỗi tiết diện ngang là ellipse đồng dạng, mép phải của hình chiếu ở cùng một kinh độ `edge`
    const edge = Math.atan2(cy, TORSO_DEPTH * sy);
    const right = pr.pts.map(([a, y]) => ring(a, y, edge));
    const left = pr.pts.map(([a, y]) => ring(a, y, edge + Math.PI));
    // Gấu: bao dưới của nửa quay ra người xem của các tiết diện bo góc gấu, từ mép phải sang mép trái
    const mid = edge - Math.PI / 2;
    const dir = facing([Math.sin(mid), 0, TORSO_DEPTH * Math.cos(mid)]) > 0 ? -1 : 1;
    const cloud = pr.pts
      .slice(pr.hemFrom - 1)
      .flatMap(([a, y]) => curve(36, (u) => ring(a, y, edge + dir * Math.PI * u)))
      .sort((p, q) => q[0] - p[0]);
    const hem: Vec3[] = [];
    for (const p of cloud) {
      while (hem.length > 1) {
        const [o, q] = [hem[hem.length - 2], hem[hem.length - 1]];
        if ((q[0] - o[0]) * (p[1] - o[1]) - (q[1] - o[1]) * (p[0] - o[0]) > 0) break;
        hem.pop();
      }
      hem.push(p);
    }
    outline = [
      ...right.slice(0, pr.hemFrom - 1),
      ...hem,
      ...left.slice(0, pr.hemFrom - 1).reverse(),
    ];
  }
  const body = `M${outline.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}Z`;

  const yOf = (a: number) => lerpAt(pr.upper, a, 0, 1);
  const at = (x: number, y: number, back = false): SP => {
    const lon = Math.asin(Math.max(-1, Math.min(1, x / Math.max(aAt(y), 1e-6)))) / D;
    return [back ? 180 - lon : lon, y];
  };
  const top = (grow = 0) => yOf(g.neck + grow);
  const surf: Surface = {
    g,
    yC: pr.yC,
    yS: pr.yS,
    yH: pr.yH,
    a: aAt,
    top,
    at,
    neck: (phi, grow = 0) => {
      // Chạm mặt vát hai bên cách trục `neck`, võng `neckFront` phía trước và `neckBack` phía sau
      const x = (g.neck + grow) * Math.sin(phi * D);
      const c = Math.cos(phi * D);
      const dip =
        c < 0
          ? (g.neckBack + grow) * -c
          : def.neckline === "v"
            ? (g.neckFront + grow) * (1 - Math.abs(Math.sin(phi * D)))
            : def.neckline === "square"
              ? (g.neckFront + grow) * Math.min(1, c * 3)
              : (g.neckFront + grow) * c;
      const [lon, y] = at(x, top(grow) + dip, c < 0);
      return [lon + 360 * Math.round((phi - lon) / 360), y];
    },
    t: (tt) => pr.yS * (1 - tt),
  };

  type Pt = { p: Vec3; v: number };
  const onTorso = ([lon, y]: SP): Pt => {
    const a = aAt(y);
    const x = a * Math.sin(lon * D);
    const z = TORSO_DEPTH * a * Math.cos(lon * D);
    return { p: view([x, y, z]), v: facing([x, y, z]) };
  };
  /** Chèn điểm giữa để mỗi đoạn không quá 3 độ kinh, 3 px dọc */
  const dense = (pts: SP[], closed = false) => {
    const out: SP[] = [];
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const [p, q] = [pts[i], pts[(i + 1) % pts.length]];
      const m = Math.max(1, Math.ceil(Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) / 3));
      for (let j = 0; j < m; j++)
        out.push([p[0] + ((q[0] - p[0]) * j) / m, p[1] + ((q[1] - p[1]) * j) / m]);
    }
    out.push(closed ? pts[0] : pts[pts.length - 1]);
    return out;
  };
  const path = (pts: Vec3[] | P2[]) => `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L")}`;

  const lines: TorsoPaths["lines"] = [];
  /** Cắt đường ở chỗ quay ra sau, giữ các đoạn phía trước */
  const trace = (sps: SP[], k: number, min = GRAZE) => {
    if (!(k > 0)) return;
    const pts = sps.map(onTorso);
    let run: Vec3[] = [];
    const flush = () => {
      if (run.length > 1) lines.push({ d: path(run), k });
      run = [];
    };
    pts.forEach((q, i) => {
      const prev = pts[i - 1];
      if (prev && prev.v > min !== q.v > min) {
        const u = (prev.v - min) / (prev.v - q.v);
        run.push(prev.p.map((c, d) => c + (q.p[d] - c) * u) as Vec3);
        if (q.v <= min) flush();
      }
      if (q.v > min) run.push(q.p);
    });
    flush();
  };
  // Nửa mặt quay ra người xem là dải kinh độ `lonC ± 90`: hướng ngang của pháp tuyến chỉ theo kinh độ
  const lonC = Math.atan2(-sy, cy / TORSO_DEPTH) / D;
  /** Cắt polygon theo một mép kinh độ `L`, giữ phía `s · (lon − L) ≥ 0` */
  const keep = (poly: SP[], L: number, s: number) => {
    const out: SP[] = [];
    poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length];
      const [dp, dq] = [s * (p[0] - L), s * (q[0] - L)];
      if (dp >= 0) out.push(p);
      if (dp >= 0 !== dq >= 0) out.push([L, p[1] + ((q[1] - p[1]) * dp) / (dp - dq)]);
    });
    return out;
  };
  /** Người 3D: cắt polygon theo đường quay ra người xem `0`, nội suy trên từng cạnh */
  const facingPart = (poly: SP[]) => {
    const v = poly.map((p) => onTorso(p).v);
    const out: SP[] = [];
    poly.forEach((p, i) => {
      const j = (i + 1) % poly.length;
      const q = poly[j];
      if (v[i] >= 0) out.push(p);
      if (v[i] >= 0 !== v[j] >= 0) {
        const u = v[i] / (v[i] - v[j]);
        out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]);
      }
    });
    return out;
  };
  const fillPoly = (poly: SP[], fill: MarkFill) => {
    if (lens) {
      const vis = facingPart(poly);
      if (vis.length > 2) lines.push({ d: `${path(vis.map((q) => onTorso(q).p))}Z`, k: 0, fill });
      return;
    }
    for (const shift of [-360, 0, 360]) {
      const moved = poly.map(([l, y]): SP => [l + shift, y]);
      const vis = keep(keep(moved, lonC - 90, 1), lonC + 90, -1);
      if (vis.length > 2) lines.push({ d: `${path(vis.map((q) => onTorso(q).p))}Z`, k: 0, fill });
    }
  };

  for (const m of def.marks(surf)) {
    if (m.dot) {
      const q = onTorso(m.pts[0]);
      if (q.v > 0.3) lines.push({ d: `M${f(q.p[0])} ${f(q.p[1])}h0.01`, k: m.k });
      continue;
    }
    const pts = dense(m.pts, m.closed || !!m.fill);
    if (m.fill) fillPoly(pts, m.fill);
    trace(pts, m.k, m.graze ?? (m.fill ? 0 : GRAZE));
  }

  const collar: TorsoPaths["collar"] = { under: [], over: [] };
  /** Điểm cổ áo vẽ ra, vào hộp bao */
  const drawn: Vec3[] = [];
  /** Điểm trên mặt khối chưa quay và pháp tuyến đơn vị ở đó */
  const solid = ([lon, y]: SP): [Vec3, Vec3] => {
    const a = aAt(y);
    const p: Vec3 = [a * Math.sin(lon * D), y, TORSO_DEPTH * a * Math.cos(lon * D)];
    // Mặt cắt dọc là đường gấp khúc: đạo hàm lấy trên khoảng rộng để pháp tuyến không nhảy bậc
    const n: Vec3 = [p[0], (-a * (aAt(y + 4) - aAt(y - 4))) / 8, p[2] / TORSO_DEPTH ** 2];
    const l = Math.hypot(...n) || 1;
    return [p, n.map((v) => v / l) as Vec3];
  };
  /** Điểm nổi `lift` px theo pháp tuyến rồi dựng lên `h` px; nửa sau nâng lên `lean` như cổ đổ về trước */
  const raise = (sp: SP, lift: number, h: number, lean = COLLAR_LEAN): Vec3 => {
    const [p, n] = solid(sp);
    const [x, y, z] = [p[0] + n[0] * lift, p[1] + n[1] * lift - h, p[2] + n[2] * lift];
    return [x, y - lean * ((Math.hypot(z, 8) - z) / 2), z];
  };
  const NU = 144;
  const NV = 6;
  /**
   * Tấm lưới cột `i` quanh trục cổ, hàng `j`: ruột và nét các hàng `rims` chia theo phía viền bóng của
   * thân. Hàng `seam` ở nửa quay ra người xem là nét giữa đè lên ruột, không bị đầu che mất nửa dưới.
   * `fold` vẽ thêm nét viền ở chỗ tấm gập quay đi trên hình chiếu. `open` là dải hở hai đầu, không quấn kín quanh cổ; bấy nhiêu cột đầu dải
   * khuất dưới cuối dải, không có nét mép cổ và nét gập
   */
  const sheet = (
    g: Vec3[][],
    rims: number[],
    color: MarkFill,
    line: number,
    {
      cull = false,
      column = false,
      seam,
      ticks,
      fold = false,
      open,
    }: {
      cull?: boolean;
      column?: boolean;
      seam?: number;
      ticks?: { d: Vec3[][]; k: number };
      fold?: boolean;
      open?: number;
    } = {},
  ) => {
    const top: Vec3[][] = [];
    const tick = { d: "", k: ticks?.k ?? 0 };
    const layers = {
      under: { fill: [] as Vec3[][], edge: [] as Vec3[][] },
      over: { fill: [] as Vec3[][], edge: [] as Vec3[][] },
    };
    const rows = g[0].length - 1;
    const cols = g.length - 1;
    const scrOf = g.map((col) => col.map(view));
    const overAt = (i: number, j: number) => {
      const q = [g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]];
      // Chia theo cả cột thì vết chia cắt thẳng ngang tấm, không thành bậc thang ở chỗ tấm chạy dọc viền bóng
      const mid = (column ? [g[i][0], g[i + 1][0], g[i + 1][rows], g[i][rows]] : q).reduce(
        (m, p): Vec3 => [m[0] + p[0] / 4, m[1] + p[1] / 4, m[2] + p[2] / 4],
        [0, 0, 0],
      );
      return facing(mid) > 0;
    };
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const over = overAt(i, j);
        // Lá cổ trước ngực mà khuất thì bỏ: nhìn nghiêng mũi cổ xa vểnh ra ngoài ngực, chồng lên mũi gần
        if (cull && !over && Math.cos(((i + 0.5) * 360 * D) / cols) > 0) continue;
        const L = layers[over ? "over" : "under"];
        const scr = [scrOf[i][j], scrOf[i + 1][j], scrOf[i + 1][j + 1], scrOf[i][j + 1]];
        drawn.push(...scr);
        const area = scr.reduce((A, p, k) => {
          const r = scr[(k + 1) % 4];
          return A + p[0] * r[1] - r[0] * p[1];
        }, 0);
        // `weld` lật cho mọi ô quấn cùng một chiều, không thì tô `nonzero` khoét lỗ chỗ lá cổ chồng lên nhau
        if (Math.abs(area) > 1e-3) L.fill.push(scr);
        for (const [r, a, b] of [
          [j, 0, 1],
          [j + 1, 3, 2],
        ])
          if (r === seam && over && (!fold || area > 0) && !(i < (open ?? 0)))
            top.push([scr[a], scr[b]]);
          else if (rims.includes(r)) L.edge.push([scr[a], scr[b]]);
      }
    if (fold) {
      // Chiều quấn của tấm trên hình chiếu ở từng nút; nét gập là đường đồng mức 0 của nó
      const wind = scrOf.map((col, i) =>
        col.map((_, j) => {
          const [a, b] =
            open !== undefined
              ? [scrOf[Math.max(0, i - 1)][j], scrOf[Math.min(cols, i + 1)][j]]
              : [scrOf[i ? i - 1 : cols - 1][j], scrOf[i < cols ? i + 1 : 1][j]];
          const [c, d] = [col[Math.max(0, j - 1)], col[Math.min(rows, j + 1)]];
          return (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
        }),
      );
      for (let i = open ?? 0; i < cols; i++)
        for (let j = 0; j < rows; j++) {
          const ring: [number, number][] = [
            [i, j],
            [i + 1, j],
            [i + 1, j + 1],
            [i, j + 1],
          ];
          const cut: Vec3[] = [];
          ring.forEach(([a, b], k) => {
            const [c, d] = ring[(k + 1) % 4];
            const [w0, w1] = [wind[a][b], wind[c][d]];
            if (w0 > 0 === w1 > 0) return;
            const u = w0 / (w0 - w1);
            cut.push(scrOf[a][b].map((x, n) => x + (scrOf[c][d][n] - x) * u) as Vec3);
          });
          const L = layers[overAt(i, j) ? "over" : "under"];
          for (let k = 0; k + 1 < cut.length; k += 2) L.edge.push([cut[k], cut[k + 1]]);
        }
    }
    // Vạch trên tấm chỉ vẽ ở chỗ quay ra người xem rõ: sát viền bóng thì vòng chỉ còn một dải mỏng
    for (const d of ticks?.d ?? []) {
      if (facing(d[Math.floor(d.length / 2)]) > GRAZE) tick.d += path(d.map(view));
    }
    const detail = { under: [], over: [{ d: chain(top), k: line }, tick] };
    for (const k of ["under", "over"] as const)
      if (layers[k].fill.length)
        collar[k].push({
          fill: weld(layers[k].fill),
          edge: chain(layers[k].edge),
          color,
          line,
          detail: detail[k].filter((l) => l.d),
        });
  };

  const rib = def.rib;
  if (rib) {
    const [liftIn, liftOut] = rib.lift;
    /** Điểm trên vòng gân ở góc `phi` quanh trục cổ, `v` từ mép cổ (`0`) xuống mép dưới (`1`) */
    const ribAt = (phi: number, v: number) => {
      const [i, o] = [surf.neck(phi), surf.neck(phi, rib.width)];
      const back = Math.cos(phi * D) <= 0 ? 1 : Math.sin(phi * D) ** 2;
      return raise(
        [lerp(i[0], o[0], v), lerp(i[1], o[1], v)],
        lerp(liftIn, liftOut, v) * lerp(RIB_FRONT, 1, back),
        rib.stand * back * (1 - v) ** 2,
      );
    };
    const ticks = rib.ticks && {
      d: curve(Math.round(360 / rib.ticks.step) - 1, (u) => 360 * u).map((phi) =>
        curve(4, (v) => ribAt(phi, 0.2 + 0.6 * v)),
      ),
      k: rib.ticks.k,
    };
    sheet(
      curve(NU, (u) => curve(NV, (v) => ribAt(360 * u, v))),
      [0, NV],
      "color",
      rib.line,
      { column: true, seam: 0, ticks },
    );
  }

  const hood = def.hood;
  if (hood) {
    const drop = hood.drop;
    const nodes: [number, number][] = [
      ...drop
        .slice(1)
        .map(([p, y]): [number, number] => [-p, y])
        .reverse(),
      ...drop,
      ...drop
        .slice(0, -1)
        .map(([p, y]): [number, number] => [360 - p, y])
        .reverse(),
    ];
    /**
     * Mép cổ của vạt bên `d` ở góc `a` quanh trục cổ tính từ giữa trước về phía vạt. `a < 0` là đuôi
     * vạt vắt qua giữa ngực: mép chữ V đi tiếp xuống, hai vạt chéo nhau
     */
    const collarOf = (a: number, d: number): SP => {
      const [sn, c] = [Math.sin(a * D), Math.cos(a * D)];
      const dip = c < 0 ? g.neckBack * -c : g.neckFront * (1 - sn);
      return at(d * g.neck * sn, top() + dip, c < 0);
    };
    /** Điểm trên vạt bên `d`, `v` từ mép cổ (`0`) xuống mép dưới (`1`); mép dưới của đuôi vạt trùng vạt kia */
    const hoodAt = (a: number, d: number, v: number) => {
      const i = collarOf(a, d);
      const [lon] = collarOf(Math.abs(a), a < 0 ? -d : d);
      const o: SP = [lon, top() + spline(nodes, Math.abs(a))];
      const phi = d > 0 ? a : 360 - a;
      const wrap = (l: number) => l + 360 * Math.round((phi - l) / 360);
      const pile = lerp(hood.pile[0], hood.pile[1], Math.sin((a * D) / 2) ** 4);
      return raise(
        [lerp(wrap(i[0]), wrap(o[0]), v), lerp(i[1], o[1], v)],
        lerp(hood.lift[0], hood.lift[1], v) *
          lerp(RIB_FRONT, 1, Math.cos(a * D) <= 0 ? 1 : Math.sin(a * D) ** 2) +
          pile * 16 * v ** 2 * (1 - v) ** 2,
        0,
        0,
      );
    };
    const HV = 12;
    // Một dải từ đuôi vạt `+x` vòng qua lưng tới đuôi vạt `−x`: vạt `−x` vẽ sau, đè lên đuôi vạt `+x`
    const span = 360 + 2 * hood.tuck;
    const n = Math.round(span / 2.5);
    sheet(
      curve(n, (u) => {
        const phi = span * u - hood.tuck;
        return curve(HV, (v) => (phi <= 180 ? hoodAt(phi, 1, v) : hoodAt(360 - phi, -1, v)));
      }),
      [0, HV],
      "color",
      hood.line,
      {
        column: true,
        seam: 0,
        fold: true,
        open: Math.round((n * hood.tuck) / span),
        ticks: { d: [curve(8, (v) => hoodAt(180, 1, 0.05 + 0.85 * v))], k: hood.seam },
      },
    );
  }

  const spec = def.collar?.(surf);
  if (spec) {
    const lip = lipOf(surf, spec.side, spec.flap);
    const lens = lip.map((q, i) =>
      i ? Math.hypot(q[0] - lip[i - 1][0], q[1] - lip[i - 1][1]) : 0,
    );
    for (let i = 1; i < lens.length; i++) lens[i] += lens[i - 1];
    /** Điểm ở phân số `t` độ dài mép ngoài phía trước, từ bên cổ về giữa ngực */
    const along = (t: number): P2 => {
      const d = t * lens[lens.length - 1];
      let i = 1;
      while (i < lens.length - 1 && lens[i] < d) i++;
      const u = (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
      return [lerp(lip[i - 1][0], lip[i][0], u), lerp(lip[i - 1][1], lip[i][1], u)];
    };
    /** Phân số trên mép ngoài phía trước ở góc `phi`, nửa sau thì `undefined` */
    const frontAt = (phi: number) =>
      Math.cos(phi * D) > 0
        ? 1 - Math.asin(Math.abs(Math.sin(phi * D))) / (Math.PI / 2)
        : undefined;
    const [fx, fy] = spec.flap[spec.tipAt ?? spec.flap.length - 1];
    const tipT =
      lens[lip.findIndex(([x, y]) => Math.hypot(x - fx, y - fy) < 1e-6)] / lens[lens.length - 1];
    const onAxis = lens[lip.findIndex(([x]) => x < 1e-6)] / lens[lens.length - 1];
    /** Độ vểnh thêm ở mép ngoài: đỉnh ở mũi cổ, nhạt dần về bên cổ và về đáy cổ */
    const tipLift = (phi: number) => {
      const t = frontAt(phi);
      return t === undefined ? 0 : spec.tip * Math.exp(-(((t - tipT) / 0.25) ** 2));
    };
    /** Mép ngoài lá cổ ở góc `phi` quanh trục cổ, kinh độ quấn gần `phi` */
    const outer = (phi: number): SP => {
      const t = frontAt(phi);
      if (t === undefined) {
        const c = Math.cos(phi * D);
        const [l, y] = surf.neck(phi);
        return [l, y + spec.side + (spec.band - spec.side) * c * c];
      }
      const sn = Math.sin(phi * D);
      // Mép ngoài chạm trục giữa trước đáy cổ (cánh giữa của lá sen): dừng ở đó, hai nửa gặp nhau không nét
      const [x, y] = along(Math.min(t, onAxis));
      const [l] = at(Math.sign(sn) * x, y);
      return [l + 360 * Math.round((phi - l) / 360), y];
    };
    const [liftFold, liftEdge] = spec.lift;
    const stand: Vec3[][] = [];
    const leaf: Vec3[][] = [];
    for (let i = 0; i <= NU; i++) {
      const phi = (360 * i) / NU;
      const h = spec.stand * (Math.cos(phi * D) <= 0 ? 1 : Math.abs(Math.sin(phi * D)));
      const inner = surf.neck(phi);
      const out = outer(phi);
      stand.push([0, 1].map((w) => raise(inner, liftFold * w, h * w)));
      leaf.push(
        curve(NV, (v) =>
          raise(
            [lerp(inner[0], out[0], v), lerp(inner[1], out[1], v)],
            lerp(liftFold, liftEdge + tipLift(phi), v),
            h * (1 - v) ** 2,
          ),
        ),
      );
    }
    // Chân cổ không nét: chân nằm dưới lá cổ, đỉnh là nếp gập của lá
    sheet(stand, [], spec.fill ?? "color", COLLAR_LINE, { cull: true });
    sheet(leaf, [0, NV], spec.fill ?? "color", COLLAR_LINE, { cull: true });
  }

  const xs = [...outline, ...drawn].map((p) => p[0]);
  const ys = [...outline, ...drawn].map((p) => p[1]);
  const pad = inset * 2;
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  return {
    body,
    lines,
    collar,
    box: { x: x0, y: y0, w: Math.max(...xs) + pad - x0, h: Math.max(...ys) + pad - y0 },
  };
}

/**
 * Thân áo dựng khối: viền dày gấp đôi dưới cùng, ruột thân tô đè nên chỉ còn nửa ngoài; rồi các nét
 * trên mặt khối. Vẽ trong hệ nhóm thân.
 */
export function SculptTorso({
  paths,
  color,
  accent,
  line,
  stroke,
}: {
  paths: TorsoPaths;
  color: string;
  accent?: string;
  line: string;
  stroke: number;
}) {
  const fillOf = (m: MarkFill) =>
    m === "color"
      ? color
      : m === "line"
        ? line
        : m === "accent"
          ? (accent ?? mix(color, "#000000", 0.3))
          : m;
  const collar = (k: "under" | "over") =>
    paths.collar[k].map((c, i) => (
      <g key={`${k}${i}`}>
        <path d={c.edge} fill="none" stroke={line} strokeWidth={stroke * 2 * c.line} />
        <path d={c.fill} fill={fillOf(c.color)} />
        {c.detail.map((l, j) => (
          <path key={j} d={l.d} fill="none" stroke={line} strokeWidth={stroke * l.k} />
        ))}
      </g>
    ));
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {collar("under")}
      <path d={paths.body} fill="none" stroke={line} strokeWidth={stroke * 2} />
      <path d={paths.body} fill={color} />
      {paths.lines.map((l, i) =>
        l.fill ? (
          <path key={i} d={l.d} fill={fillOf(l.fill)} />
        ) : (
          <path key={i} d={l.d} fill="none" stroke={line} strokeWidth={stroke * l.k} />
        ),
      )}
      {collar("over")}
    </g>
  );
}
