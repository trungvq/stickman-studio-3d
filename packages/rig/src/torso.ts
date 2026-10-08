// Thân áo dựng khối theo @stickman/rig (packages/rig/src/torso.tsx, 2b05c7a): bảng kiểu áo, mặt cắt dọc
// `profile` và cách đặt đặc điểm, cổ bẻ, viền gân, mũ trùm lên mặt khối giữ nguyên; `torsoMesh` ở cuối
// dựng như `buildTorso` nhưng giữ khối, nét và tấm ở 3D thay vì chiếu ra path SVG. Sửa bên rig thì chép lại.

type Vec3 = [number, number, number];
type GarmentStyle = string;
export interface Garment {
  style: string; ease?: number; fit?: number; waist?: number; hem?: number; rise?: number; neck?: number;
  neckFront?: number; neckBack?: number; slope?: number; round?: number; hemRound?: number;
}
export interface Rig { height: number; shoulderHalf: number; shoulderDrop: number; hipHalf: number; stroke: number }
const D = Math.PI / 180;
const RIG = { torso: 120, neck: 8 };
export const TORSO_DEPTH = 0.78;

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

/** Bộ số đã đủ: trường bỏ trống lấy số của kiểu */
export function garmentOf(raw: Partial<Garment> | undefined): Garment & Dims {
  const g = { style: "tshirt", ...raw } as Garment;
  const dims = { ...GARMENT_STYLES[g.style].dims };
  for (const k of Object.keys(dims) as (keyof Dims)[]) if (g[k] !== undefined) dims[k] = g[k]!;
  return { ...g, ...dims };
}

/** Nửa rộng vành vai nơi đặt gốc tay, như `shoulderRoot` của rig */
export function shoulderRoot(raw: Partial<Garment> | undefined, rig: Rig) {
  const pr = profile(garmentOf(raw), rig, 0);
  return Math.max(0, lerpAt(pr.pts, pr.yS, 1, 0) - rig.stroke / 2);
}

/** Thân áo dựng khối ở 3D, hệ nhóm thân của rig (px, gốc ở hông, `y` xuống, `z` ra trước ngực). */
export interface TorsoMesh {
  /** Mặt cắt dọc `[nửa rộng, y]` từ mép trên xuống gấu; tiết diện ngang là ellipse dẹt `TORSO_DEPTH` */
  profile: P2[];
  /** Nét trên mặt khối, `k` lần nét thân */
  lines: { pts: Vec3[]; k: number }[];
  /** Mảng tô trên mặt khối: polygon ở toạ độ mặt `(kinh độ, y)` để tam giác hoá, và điểm 3D tương ứng */
  fills: { sp: P2[]; pts: Vec3[]; fill: MarkFill }[];
  dots: { p: Vec3; k: number }[];
  /** Tấm nổi khối (cổ bẻ, viền gân, mũ trùm): lưới cột × hàng, hàng `rims` có nét viền */
  sheets: { grid: Vec3[][]; rims: number[]; color: MarkFill; line: number }[];
}

export function torsoMesh(raw: Partial<Garment> | undefined, rig: Rig): TorsoMesh {
  const g = garmentOf(raw);
  const def = GARMENT_STYLES[g.style];
  const pr = profile(g, rig, rig.stroke / 2);
  const aAt = (y: number) => lerpAt(pr.pts, y, 1, 0);
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
  const solid = ([lon, y]: SP): [Vec3, Vec3] => {
    const a = aAt(y);
    const p: Vec3 = [a * Math.sin(lon * D), y, TORSO_DEPTH * a * Math.cos(lon * D)];
    const n: Vec3 = [p[0], (-a * (aAt(y + 4) - aAt(y - 4))) / 8, p[2] / TORSO_DEPTH ** 2];
    const l = Math.hypot(...n) || 1;
    return [p, n.map((v) => v / l) as Vec3];
  };
  const raise = (sp: SP, lift: number, h: number, lean = COLLAR_LEAN): Vec3 => {
    const [p, n] = solid(sp);
    const [x, y, z] = [p[0] + n[0] * lift, p[1] + n[1] * lift - h, p[2] + n[2] * lift];
    return [x, y - lean * ((Math.hypot(z, 8) - z) / 2), z];
  };
  /** Nét và mảng nổi khỏi mặt khối một chút cho khỏi chìm vào ruột */
  const onTorso = (sp: SP, lift = 0.5) => raise(sp, lift, 0, 0);
  const dense = (pts: SP[], closed = false) => {
    const out: SP[] = [];
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const [p, q] = [pts[i], pts[(i + 1) % pts.length]];
      const m = Math.max(1, Math.ceil(Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) / 3));
      for (let j = 0; j < m; j++) out.push([p[0] + ((q[0] - p[0]) * j) / m, p[1] + ((q[1] - p[1]) * j) / m]);
    }
    out.push(closed ? pts[0] : pts[pts.length - 1]);
    return out;
  };

  const out: TorsoMesh = { profile: pr.pts, lines: [], fills: [], dots: [], sheets: [] };
  for (const m of def.marks(surf)) {
    if (m.dot) {
      out.dots.push({ p: onTorso(m.pts[0], 0), k: m.k });
      continue;
    }
    const pts = dense(m.pts, m.closed || !!m.fill);
    if (m.fill) out.fills.push({ sp: pts, pts: pts.map((p) => onTorso(p, 0.3)), fill: m.fill });
    if (m.k > 0) out.lines.push({ pts: pts.map((p) => onTorso(p)), k: m.k });
  }

  const NU = 144;
  const NV = 6;
  const sheet = (grid: Vec3[][], rims: number[], color: MarkFill, line: number) =>
    out.sheets.push({ grid, rims, color, line });

  const rib = def.rib;
  if (rib) {
    const [liftIn, liftOut] = rib.lift;
    const ribAt = (phi: number, v: number) => {
      const [i, o] = [surf.neck(phi), surf.neck(phi, rib.width)];
      const back = Math.cos(phi * D) <= 0 ? 1 : Math.sin(phi * D) ** 2;
      return raise(
        [lerp(i[0], o[0], v), lerp(i[1], o[1], v)],
        lerp(liftIn, liftOut, v) * lerp(RIB_FRONT, 1, back),
        rib.stand * back * (1 - v) ** 2,
      );
    };
    sheet(curve(NU, (u) => curve(NV, (v) => ribAt(360 * u, v))), [0, NV], "color", rib.line);
  }

  const hood = def.hood;
  if (hood) {
    const drop = hood.drop;
    const nodes: [number, number][] = [
      ...drop.slice(1).map(([p, y]): [number, number] => [-p, y]).reverse(),
      ...drop,
      ...drop.slice(0, -1).map(([p, y]): [number, number] => [360 - p, y]).reverse(),
    ];
    const collarOf = (a: number, d: number): SP => {
      const [sn, c] = [Math.sin(a * D), Math.cos(a * D)];
      const dip = c < 0 ? g.neckBack * -c : g.neckFront * (1 - sn);
      return at(d * g.neck * sn, top() + dip, c < 0);
    };
    const hoodAt = (a: number, d: number, v: number) => {
      const i = collarOf(a, d);
      const [lon] = collarOf(Math.abs(a), a < 0 ? -d : d);
      const o: SP = [lon, top() + spline(nodes, Math.abs(a))];
      const phi = d > 0 ? a : 360 - a;
      const wrap = (l: number) => l + 360 * Math.round((phi - l) / 360);
      const pile = lerp(hood.pile[0], hood.pile[1], Math.sin((a * D) / 2) ** 4);
      return raise(
        [lerp(wrap(i[0]), wrap(o[0]), v), lerp(i[1], o[1], v)],
        lerp(hood.lift[0], hood.lift[1], v) * lerp(RIB_FRONT, 1, Math.cos(a * D) <= 0 ? 1 : Math.sin(a * D) ** 2) +
          pile * 16 * v ** 2 * (1 - v) ** 2,
        0,
        0,
      );
    };
    const HV = 12;
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
    );
  }

  const spec = def.collar?.(surf);
  if (spec) {
    const lip = lipOf(surf, spec.side, spec.flap);
    const lens = lip.map((q, i) => (i ? Math.hypot(q[0] - lip[i - 1][0], q[1] - lip[i - 1][1]) : 0));
    for (let i = 1; i < lens.length; i++) lens[i] += lens[i - 1];
    const along = (t: number): P2 => {
      const d = t * lens[lens.length - 1];
      let i = 1;
      while (i < lens.length - 1 && lens[i] < d) i++;
      const u = (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
      return [lerp(lip[i - 1][0], lip[i][0], u), lerp(lip[i - 1][1], lip[i][1], u)];
    };
    const frontAt = (phi: number) =>
      Math.cos(phi * D) > 0 ? 1 - Math.asin(Math.abs(Math.sin(phi * D))) / (Math.PI / 2) : undefined;
    const [fx, fy] = spec.flap[spec.tipAt ?? spec.flap.length - 1];
    const tipT = lens[lip.findIndex(([x, y]) => Math.hypot(x - fx, y - fy) < 1e-6)] / lens[lens.length - 1];
    const onAxis = lens[lip.findIndex(([x]) => x < 1e-6)] / lens[lens.length - 1];
    const tipLift = (phi: number) => {
      const t = frontAt(phi);
      return t === undefined ? 0 : spec.tip * Math.exp(-(((t - tipT) / 0.25) ** 2));
    };
    const outer = (phi: number): SP => {
      const t = frontAt(phi);
      if (t === undefined) {
        const c = Math.cos(phi * D);
        const [l, y] = surf.neck(phi);
        return [l, y + spec.side + (spec.band - spec.side) * c * c];
      }
      const sn = Math.sin(phi * D);
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
      const o = outer(phi);
      stand.push([0, 1].map((w) => raise(inner, liftFold * w, h * w)));
      leaf.push(
        curve(NV, (v) =>
          raise([lerp(inner[0], o[0], v), lerp(inner[1], o[1], v)], lerp(liftFold, liftEdge + tipLift(phi), v), h * (1 - v) ** 2),
        ),
      );
    }
    sheet(stand, [], spec.fill ?? "color", COLLAR_LINE);
    sheet(leaf, [0, NV], spec.fill ?? "color", COLLAR_LINE);
  }
  return out;
}

/** Váy dựng khối (`SkirtSchema` của rig): nón cụt tiết diện ellipse treo ở hông */
export interface Skirt { rise: number; waist: number; length: number; flare: number; pleats: number }
export const SKIRT_EASE = 4;
export const SKIRT_REACH = 0.7;
export const SKIRT_FALL = 0.5;
export function skirtCover(g: Skirt, height: number, angle: number, lt: number) {
  const len = g.length * height;
  const stand = Math.max(0, len - g.rise * height);
  return Math.min(stand / Math.max(Math.cos(angle), 0.05), len, lt * SKIRT_REACH);
}
export const skirtFall = (g: Skirt, mean: number) => g.flare * (1 - Math.max(0, Math.cos(mean))) * SKIRT_FALL;
