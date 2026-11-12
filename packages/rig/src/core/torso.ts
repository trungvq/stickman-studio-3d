import { D, RIG } from "./constants";
import {
  GarmentSchema,
  type CharacterData,
  type Garment,
  type GarmentStyle,
  type Tie,
} from "./schema";
import type { Vec3 } from "./sphere";
import { NECK_OF_HEAD } from "./stature";

export type Dims = Required<
  Omit<
    Garment,
    | "style"
    | "wrap"
    | "prints"
    | "badge"
    | "collarUp"
    | "belly"
    | "bellySide"
    | "bust"
    | "neckline"
    | "marks"
    | "panels"
    | "inner"
    | "bib"
    | "lapel"
  >
>;
export type P2 = [number, number];

/** Điểm trên mặt khối: kinh độ, độ (`0` giữa ngực, dương về `+x`, `180` giữa lưng), và `y` của nhóm thân */
export type SP = [lon: number, y: number];

/** Màu tô của mảng: màu áo, màu nét, màu nhấn (`accent` của mảnh, bỏ trống là màu áo tối đi), màu da (chỉ người 3D) hay một mã màu cố định */
export type MarkFill = "color" | "line" | "accent" | "skin" | `#${string}`;

/**
 * Một đặc điểm trên mặt khối. `pts` không `fill` là nét, `closed` thì khép vòng; có `fill` là mảng
 * kín tô màu, viền nét `k` (`0` là không viền), nổi `lift` px ở người 3D (bỏ trống `0.3`). `dot` là một chấm ở điểm đầu.
 * `ink`: độ đậm của nét, chấm — `1` (bỏ trống) màu nét, nhỏ hơn thì nhạt về màu thân
 */
export type Mark = {
  k: number;
  ink?: number;
  fill?: MarkFill;
  lift?: number;
  graze?: number;
  pts: SP[];
  closed?: boolean;
  dot?: boolean;
};

/** Mặt khối của một bộ số đã đủ, để kiểu áo đặt đặc điểm theo số đo */
export interface Surface {
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
  /** Nửa bề sâu khối ở độ cao `y`, nửa trước hay nửa sau; chỉ người 3D */
  depth?: (y: number, back?: boolean) => number;
  /** Điểm trên viền cổ nở rộng và hạ `grow` px, ở góc `phi` quanh trục cổ: `0` giữa trước, `±180` giữa sau */
  neck: (phi: number, grow?: number) => SP;
  /** `y` ở phân số `t` từ vành vai (`0`) xuống khớp hông (`1`) */
  t: (t: number) => number;
  /** THỬ (feat/real-head-proto): miệng cổ sơ mi `inner.collar` không hẹp hơn ngần này px thay cho `NECK_MIN` (đầu `human`) */
  neckMin?: number;
}

/**
 * Cổ bẻ nổi khối: chân cổ dựng quanh viền cổ, lá cổ gập từ đỉnh chân cổ xuống. Mép ngoài quanh lưng
 * là dải rộng `band` px, phía trước đi thẳng từ bên cổ qua `flap` về giữa ngực
 */
export interface Collar {
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
  /** Chân cổ giữa ngực cao bằng bấy nhiêu phần `stand` (cổ cài kín); bỏ trống là `0`, cổ mở */
  closed?: number;
  /** Nét viền mép lá cổ, lần nét thân; bỏ trống là `COLLAR_LINE`, `0` là không viền */
  line?: number;
  /** Màu nét viền: `1` màu nét (bỏ trống), `0` màu lá cổ, giữa là pha hai màu */
  ink?: number;
}

/** Viền cổ gân nổi khối: vòng vải có bề dày quanh viền cổ, từ mép cổ xuống viền cổ nở rộng `width` */
interface Rib {
  width: number;
  /** Mép cổ dựng lên bấy nhiêu px ở nửa sau, thấp dần về `0` ở giữa ngực */
  stand: number;
  /** Vòng nổi khỏi mặt khối bấy nhiêu px ở mép cổ và ở mép dưới, nửa sau; phía trước nhạt về `RIB_FRONT` lần */
  lift: [inner: number, outer: number];
  /** Nét viền, lần nét thân; màu nét pha `COLLAR_INK` */
  line: number;
  /** Nửa sau nâng lên bấy nhiêu px mỗi px lùi sau trục thân; bỏ trống là `COLLAR_LEAN` */
  lean?: number;
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
  /** Cổ chéo `garment.wrap`: dải cổ, đai, nút đai — chỉ người 3D dựng (`wrapParts`) */
  wrap?: boolean;
  /** Áo khoác cổ V: miệng cổ và ve đo ở vai chuẩn, co giãn theo vai người mặc (`garmentOf` có `rig`) */
  shoulderFit?: boolean;
  /** Nửa rộng ve ở đỉnh ve mặc định, px ở vai chuẩn; `collar` đọc `g.lapel` đã co giãn */
  lapel?: number;
}

/**
 * Nét viền cổ bẻ, ve, dải cổ chéo, viền cổ gân nổi khối, lần nét thân, và độ đậm màu nét (`1` màu nét, `0` màu áo): mảnh
 * và pha về màu áo cho áo sáng khỏi viền đen dày, áo tối gần như không đổi
 */
export const COLLAR_LINE = 0.25;
export const COLLAR_INK = 0.4;
/** Nét nẹp, đường may, gấu (dải dán nhạt, `Mark.ink`): `k` lần nét thân, độ đậm màu nét */
export const TRIM = { k: 0.4, ink: 0.6 } as const;
/** Vạch gân gấu, nếp xếp: mảnh và nhạt hơn `TRIM` */
export const TRIM_FINE = { k: 0.3, ink: 0.5 } as const;
/** Viền của mảng tô (nơ, dải nơ): nét `k` lần nét thân, pha màu nét về màu áo */
export const OUTLINE = { k: 0.35, ink: 0.5 } as const;
/** Nửa sau cổ bẻ nổi khối cao lên bấy nhiêu px mỗi px lùi sau trục thân, vuốt mềm quanh trục */
export const COLLAR_LEAN = 0.35;
/** Viền cổ gân nổi khối ở giữa ngực chỉ nổi bấy nhiêu lần độ nổi nửa sau, để mép cổ trước không bị đầu che */
export const RIB_FRONT = 0.3;
/** Đỉnh khối hẹp hơn miệng cổ áo bấy nhiêu lần, để viền cổ nằm hẳn trên mặt vát */
const NECK_TOP = 0.8;
/** Vai chuẩn của áo khoác cổ V (`shoulderFit`): `rig.shoulderHalf` mặc định; vải lấy `ease` mặc định của kiểu */
export const SHOULDER_REF = 40;
/** Bụng phệ: đỉnh bụng cao hơn hông bấy nhiêu phần thân, nhạt theo hình chuông rộng bấy nhiêu phần thân; ra hai bên bấy nhiêu lần ra trước khi `garment.bellySide` bỏ trống */
export const BELLY = { at: 0.3, spread: 0.3, side: 0.45 } as const;

/** Phần của `belly` ở độ cao `y` (hệ thân, px): `1` ở đỉnh bụng */
export const bellyAt = (y: number, height: number) =>
  Math.exp(-(((y + BELLY.at * RIG.torso * height) / (BELLY.spread * RIG.torso * height)) ** 2));

/**
 * Ngực nhìn nghiêng của khối 3D: nửa trước đầy nhất cao hơn hông `at` phần thân, nửa sau đầy sau `back` quãng từ mép trên
 * xuống ngang ngực; trong quãng ấy hàng mặt cắt cách nhau không quá `step` px
 */
export const CHEST = { at: 0.7, back: 0.6, step: 3 } as const;
/** Ống cổ người 3D (`neckGeometry`): bán kính trên, độ loe ở chân và quãng lùi sau trục, đơn vị three */
export const NECK_TUBE = { r: 0.135, flare: 1.08, back: 0.03 } as const;
/** Miệng cổ áo khoác cổ V co theo vai không hẹp hơn chân ống cổ cộng ngần này px, để còn viền da quanh cổ */
export const NECK_MIN = 100 * NECK_TUBE.r * NECK_TUBE.flare + 1.5;
/**
 * THỬ (feat/real-head-proto): cổ của đầu `human` (`neckGeometry`), đơn vị three, hệ khớp cổ (y lên, z ra trước): hàng
 * `[y, nửa rộng, mép sau, mép trước]` từ chân ống trong thân áo lên dưới đáy sọ, giữa các hàng nối trơn. Mặt cắt dẹt
 * (rộng hơn sâu). Chân cổ loe ngang thành dốc vai, nằm gọn trong mặt vát và miệng cổ áo (mép sau trong `NAPE`, mép trước
 * trong ngực trên); lên trên mép trước chúi ra trước về dưới hàm, mép sau lùi dần vào gáy sọ. Nửa rộng nhân
 * `humanNeckWidth`; trên hàng cuối giữ như hàng cuối
 */
export const HUMAN_NECK_ROWS: readonly (readonly [number, number, number, number])[] = [
  [-0.02, 0.215, -0.15, 0.1],
  [0.07, 0.232, -0.165, 0.115],
  [0.13, 0.215, -0.172, 0.122],
  [0.22, 0.208, -0.186, 0.138],
  [0.3, 0.212, -0.198, 0.15],
  [0.38, 0.222, -0.205, 0.155],
];
/** Nửa rộng chỗ thon nhất của `HUMAN_NECK_ROWS` */
const NECK_THIN = Math.min(...HUMAN_NECK_ROWS.map((r) => r[1]));
/** Nửa rộng cổ `human` nhân bấy nhiêu cho đầu rộng `headWidth` (three): chỗ thon nhất bằng `NECK_OF_HEAD` bề ngang đầu */
export const humanNeckWidth = (headWidth: number) => (NECK_OF_HEAD * headWidth) / (2 * NECK_THIN);
/** Hàng cổ `human` ở độ cao `y` (hệ khớp cổ, three): `[nửa rộng, mép sau, mép trước]`, nửa rộng đã nhân `k` */
export function humanNeckAt(y: number, k = 1): [number, number, number] {
  const R = HUMAN_NECK_ROWS;
  let i = 1;
  while (i < R.length - 1 && R[i][0] < y) i++;
  const [p, q] = [R[i - 1], R[i]];
  const u = Math.max(0, Math.min(1, (y - p[0]) / (q[0] - p[0])));
  const s = u * u * (3 - 2 * u);
  return [(p[1] + (q[1] - p[1]) * s) * k, p[2] + (q[2] - p[2]) * s, p[3] + (q[3] - p[3]) * s];
}
/**
 * Miệng cổ áo (`g.neck`, px) tối thiểu của người đầu `human`: nửa rộng chỗ loe nhất của chân cổ cộng ngần này px. Thân áo
 * giữ mặt cắt (vai, gốc tay) theo `g.neck` gốc; chỉ viền cổ, cổ áo, áo trong nới ra (`torsoMesh`)
 */
export const HUMAN_RING_CLEAR = 1.5;
/** Hàng cổ `human` cao từ ngần này (three, hệ khớp cổ) đã ở trên mọi viền cổ áo: không tính vào miệng cổ tối thiểu */
const HUMAN_RING_UP = 0.2;
/** Miệng cổ áo tối thiểu (px) của cổ `human` nửa rộng nhân `k` (`humanNeckWidth`) */
export const humanNeckMin = (k: number) =>
  100 * Math.max(...HUMAN_NECK_ROWS.filter((r) => r[0] < HUMAN_RING_UP).map((r) => r[1])) * k +
  HUMAN_RING_CLEAR;
/**
 * Ống cổ uốn (`bendNeck`): dưới mép cổ áo áo phông (cao hơn khớp cổ `bones.neck + collar`) ống đứng theo thân, lên thêm
 * `span` thì theo trọn khớp cổ, giữa hai mức chuyển êm; `rows` đoạn dọc. Đơn vị three
 */
export const NECK_BEND = { collar: 0.06, span: 0.2, rows: 8 } as const;
/**
 * Nửa sau thân không mỏng hơn mép sau ống cổ cộng ngần này px (ở hàng mà bề sâu theo bề rộng đã tới đó): lưng phẳng
 * không kéo viền cổ áo sau gáy lọt vào trong ống cổ
 */
export const NAPE_CLEAR = 1;
/** Nửa bề sâu nửa sau tối thiểu quanh lỗ cổ, px */
export const NAPE = 100 * (NECK_TUBE.back + NECK_TUBE.r * NECK_TUBE.flare) + NAPE_CLEAR;
/** Ngực nở (`garment.bust`): đỉnh ở ngang ngực, nhạt theo hình chuông rộng `up` phần thân phía trên, `down` phía dưới */
export const BUST = { up: 0.25, down: 0.15 } as const;

/** Phần của `bust` ở độ cao `y` (hệ thân, px): `1` ở ngang ngực */
export const bustAt = (y: number, height: number) => {
  const t = RIG.torso * height;
  const u = (y + CHEST.at * t) / ((y < -CHEST.at * t ? BUST.up : BUST.down) * t);
  return Math.exp(-u * u);
};

/**
 * Nửa bề sâu nửa sau (`back`) và nửa trước (`front`) từng hàng của mặt cắt `pts`, từ nửa bề sâu `depth` theo bề rộng
 * (`TORSO_DEPTH` hay `cladProfile`): dưới ngang ngực giữ `depth`; trên đó nửa trước đi từ bề sâu mép trên tới bề sâu ngang
 * ngực theo một dốc dài, đứng dần ở ngang ngực, nửa sau tới sớm hơn (`CHEST.back`) nên lưng phẳng hơn ngực — vai rộng mà
 * mỏng, nhưng không mỏng hơn `NAPE` cho gáy khỏi thò qua cổ áo. Không sâu hơn `depth`. Nửa trước cộng bụng phệ và ngực
 * nở. Hàng thêm trong quãng dốc và quãng ngực nở đi kèm `pts` trả ra
 */
export function chestDepth(
  pts: readonly P2[],
  depth: readonly number[],
  g: { belly?: number; bust?: number },
  height: number,
): { pts: P2[]; back: number[]; front: number[] } {
  const t = RIG.torso * height;
  const yC = pts[0][1];
  const yB = Math.max(yC + 1, -CHEST.at * t);
  const yK = yC + (yB - yC) * CHEST.back;
  const end = g.bust ? yB + 2 * BUST.down * t : yB;
  const rows: P2[] = [pts[0]];
  const flat = [depth[0]];
  for (let i = 1; i < pts.length; i++) {
    const [[a0, y0], [a1, y1]] = [pts[i - 1], pts[i]];
    const n = y0 < end ? Math.ceil((y1 - y0) / CHEST.step) : 1;
    for (let k = 1; k <= n; k++) {
      rows.push([lerp(a0, a1, k / n), lerp(y0, y1, k / n)]);
      flat.push(lerp(depth[i - 1], depth[i], k / n));
    }
  }
  const deep = rows.map(([, y], i): P2 => [flat[i], y]);
  // dốc Hermite từ mép trên (tiếp tuyến bằng dốc trung bình) tới đích (tiếp tuyến đứng)
  const ramp = (to: number) => {
    const d = lerpAt(deep, to, 1, 0);
    return (y: number) => {
      const u = Math.max(0, Math.min(1, (y - yC) / (to - yC)));
      return flat[0] + (d - flat[0]) * (u + u * u - u ** 3);
    };
  };
  const [rb, rf] = [ramp(yK), ramp(yB)];
  const back = rows.map(([, y], i) =>
    y < yK ? Math.max(Math.min(flat[i], rb(y)), Math.min(flat[i], NAPE)) : flat[i],
  );
  const front = rows.map(
    ([, y], i) =>
      (y < yB ? Math.min(flat[i], rf(y)) : flat[i]) +
      (g.belly ?? 0) * bellyAt(y, height) +
      (g.bust ?? 0) * bustAt(y, height),
  );
  return { pts: rows, back, front };
}

export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export const curve = <T>(n: number, f: (u: number) => T) =>
  Array.from({ length: n + 1 }, (_, i) => f(i / n));

const bezier = (u: number, a: number, b: number, c: number) =>
  (1 - u) ** 2 * a + 2 * u * (1 - u) * b + u * u * c;

const SIDES = [-1, 1] as const;

/** Catmull–Rom qua các nút `[x, y]` tăng dần theo `x`, giữ nguyên hai đầu */
export const spline = (nodes: [number, number][], x: number) => {
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
export const lipOf = (s: Surface, drop: number, flap: [x: number, y: number][]): P2[] => {
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

/** THỬ: lá cổ sơ mi — bề rộng sau gáy, độ hạ hai bên, mũi cổ, nét viền (lần nét thân) và độ đậm màu nét */
export const SHIRT_COLLAR = { band: 6, side: 2, tipX: 11, tipY: 8, line: 0.15, ink: 0.2 };

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
  cladSlope: 0.4,
  round: 16,
  hemRound: 8,
};

/** Vải áo dày thêm bấy nhiêu px mỗi bên ngoài thân người (`BODY`) */
export const CLOTH = 2;

/**
 * Dáng thân người của mọi kiểu ở cùng `rig`: thân trần là chính nó, áo phông là nó nở thêm `CLOTH`. Mép trên ngang mép
 * trên áo phông nên cổ lộ ra bằng nhau; miệng cổ hẹp hơn cổ người 3D để cổ mọc liền từ mặt vát
 */
const BODY: Dims = { ...TEE, ease: TEE.ease - CLOTH, hem: -4, neck: 17, neckFront: 0 };

/** Đường quanh khối ở độ cao `y` */
const around = (y: number, { k, ink }: { k: number; ink?: number }): Mark => ({
  pts: curve(72, (u): SP => [-180 + 360 * u, y]),
  k,
  ink,
  graze: 0.05,
});

/** Nét dọc từ `y0` tới `y1` ở mỗi kinh độ cách nhau `step` độ */
const ticks = (
  y0: number,
  y1: number,
  step: number,
  { k, ink }: { k: number; ink?: number },
): Mark[] =>
  Array.from({ length: Math.round(360 / step) }, (_, i) => ({
    pts: [
      [-180 + step * i, y0],
      [-180 + step * i, y1],
    ],
    k,
    ink,
    graze: 0.3,
  }));

/** Độ cao dọc nẹp áo, từ đáy cổ giữa ngực (`0`) tới gấu (`1`) */
const placket = (s: Surface, us: number[]) => {
  const yA = s.top() + s.g.neckFront;
  return us.map((u) => yA + (s.yH - yA) * u);
};

/** Polygon trên hình phẳng ra mặt khối, cạnh chia nhỏ trên hình phẳng: cạnh thẳng ở mặt trước vẫn thẳng khi nhìn thẳng */
const onPlane = (s: Surface, poly: P2[]): SP[] =>
  poly.flatMap(([x, y], i) => {
    const [qx, qy] = poly[(i + 1) % poly.length];
    const n = Math.max(1, Math.ceil(Math.hypot(qx - x, qy - y) / 2));
    return curve(n, (u): SP => s.at(x + (qx - x) * u, y + (qy - y) * u)).slice(0, -1);
  });

/**
 * Cà vạt mặc định: nút từ `y0` (bỏ trống là sát viền cổ), bản rộng dần, mũi thấp hơn chỗ viền cổ chạm mặt vát `length`
 * px dù nút ở đâu
 */
const tiePoly = (s: Surface, t: Tie, y0 = s.top()): P2[] => {
  const k = (t.length - (y0 - s.top()) - 11) / 91;
  return (
    [
      [-5.5, 1],
      [5.5, 1],
      [3, 11],
      [8, 11 + 49 * k],
      [8.5, 11 + 81 * k],
      [0, 11 + 91 * k],
      [-8.5, 11 + 81 * k],
      [-8, 11 + 49 * k],
      [-3, 11],
    ] as P2[]
  ).map(([x, y]) => [x * t.width, y0 + y]);
};

/**
 * Cổ sơ mi dưới áo khoác cổ V (`inner.collar`). Miệng cổ chữ V `front` px ôm chân ống cổ; chân cổ cao `stand` px ở nửa
 * sau, còn `closed` phần ở giữa ngực; lá cổ gập từ đỉnh chân cổ — nửa sau rủ `fall` px dọc chân cổ, phía trước xuống mép qua
 * mũi cổ `point` (`[x, y]`, `y` dưới đáy chữ V) về đáy chữ V. Lá cổ nổi `lift` px ở nếp gập và mép, mũi vểnh thêm `tip`.
 * Có cà vạt (`tie`): cổ cài kín quanh họng, nút cà vạt bắt đầu `knot` px trên đáy chữ V, luồn dưới hai lá cổ. Không cà vạt
 * (`open`): cúc trên mở, chữ V sâu lộ da, mũi cổ cao hơn đáy chữ V
 */
export const INNER_COLLAR = {
  stand: 8.5,
  fall: 5,
  lift: [2.2, 1.4],
  tip: 1,
  knot: 2,
  /** Miệng cổ sơ mi hẹp hơn miệng cổ áo khoác ít nhất bấy nhiêu px: chân cổ sơ mi nằm trong chân cổ áo khoác */
  inset: 2.5,
  tie: { front: 6, closed: 0.8, point: [12.5, 13] },
  open: { front: 16, closed: 0, point: [13.5, -6] },
} as const;

/** Cà vạt của áo trong: `inner.tie`, bỏ trống thì `suit` có, kiểu khác không */
export const innerTie = (g: Garment): Partial<Tie> | undefined =>
  g.inner?.tie === false ? undefined : (g.inner?.tie ?? (g.style === "suit" ? {} : undefined));

/** Dáng cổ sơ mi `inner.collar` theo có cà vạt hay không */
export const innerCollarShape = (g: Garment) =>
  innerTie(g) ? INNER_COLLAR.tie : INNER_COLLAR.open;

/**
 * Điểm trên viền cổ dáng `shape`, nở rộng và hạ `grow` px, ở góc `phi` quanh trục cổ (`0` giữa trước, `±180` giữa sau);
 * kinh độ cuộn về gần `phi` cho vòng liền
 */
export function neckRing(
  s: Pick<Surface, "g" | "top" | "at">,
  shape: GarmentStyleDef["neckline"],
  phi: number,
  grow = 0,
): SP {
  const g = s.g;
  const x = (g.neck + grow) * Math.sin(phi * D);
  const c = Math.cos(phi * D);
  const dip =
    c < 0
      ? (g.neckBack + grow) * -c
      : shape === "v"
        ? (g.neckFront + grow) * (1 - Math.abs(Math.sin(phi * D)))
        : shape === "square"
          ? (g.neckFront + grow) * Math.min(1, c * 3)
          : (g.neckFront + grow) * c;
  const [lon, y] = s.at(x, s.top(grow) + dip, c < 0);
  return [lon + 360 * Math.round((phi - lon) / 360), y];
}

/** Mặt khối với miệng cổ của cổ sơ mi `inner.collar`: cùng khối, miệng cổ hẹp chữ V */
export const innerNeckOf = (s: Surface): Surface => {
  const neck = Math.min(s.neckMin ?? NECK_MIN, s.g.neck - INNER_COLLAR.inset);
  const grow = neck - s.g.neck;
  const shirt: Surface = {
    ...s,
    g: { ...s.g, neck, neckFront: innerCollarShape(s.g).front, neckBack: 0, neckline: "v" },
    top: (more = 0) => s.top(grow + more),
    neck: (phi, more = 0) => neckRing(shirt, "v", phi, more),
  };
  return shirt;
};

/** Áo trong nổi bấy nhiêu px ở người 3D: vỏ viền cổ người cắm xiên qua mặt vát, áo trong nổi thấp thì vỏ ấy lòi qua thành chấm mực */
const INNER_LIFT = 1;

/**
 * Áo trong lộ giữa hai vạt cổ chữ V (`garment.inner`): phủ cả miệng cổ từ mép trên khối tới đáy chữ V, liền viền cổ;
 * cà vạt cắt theo chữ V như luồn dưới vạt. `fill`, `tie` là mặc định của kiểu khi `inner` không khai
 */
function innerMarks(s: Surface, fill?: MarkFill): Mark[] {
  const inner = s.g.inner;
  const out: Mark[] = [];
  const color = inner?.color ?? fill;
  // có cổ sơ mi thì áo trong khoét theo miệng cổ sơ mi: trong miệng cổ là da
  const shirt = inner?.collar ? innerNeckOf(s) : undefined;
  if (color) {
    const w = 3 * s.g.neck;
    const cut: P2[] = shirt
      ? [
          [-shirt.g.neck, s.yC],
          [-shirt.g.neck, shirt.top()],
          [0, shirt.top() + shirt.g.neckFront],
          [shirt.g.neck, shirt.top()],
          [shirt.g.neck, s.yC],
        ]
      : [];
    out.push({
      pts: onPlane(s, inV(s, [[-w, s.yC], ...cut, [w, s.yC], [0, s.top() + s.g.neckFront]])),
      fill: color,
      k: inner?.line ?? 0,
      lift: INNER_LIFT,
    });
  }
  const t = innerTie(s.g);
  if (t) {
    const spec = { width: 1, length: 102, line: 0, ...t };
    const y0 = shirt && shirt.top() + shirt.g.neckFront - INNER_COLLAR.knot;
    out.push({
      pts: onPlane(s, inV(s, tiePoly(s, spec, y0))),
      fill: spec.color ?? "line",
      k: spec.line,
      lift: INNER_LIFT + 0.05,
    });
  }
  return out;
}

const COLLAR_CREAM = "#f6efe4";

/** Miệng cổ của áo khoác cổ V và nửa rộng ve ở đỉnh ve, px ở vai chuẩn (`SHOULDER_REF`) */
const SUIT_NECK = 18;
const SUIT_LAPEL = 21;
const BLAZER_LAPEL = 25;

/** Nét ngực, lưng của thân trần: mảnh và nhạt, chỉ gợi khối */
const BARE_LINE = 0.5;
const BARE_INK = 0.3;

/** Bảng của từng kiểu thân áo; JSON chọn tên kiểu và đè vài số. docs/12-trang-phuc-3d.md#thân-áo-dựng-khối */
export const GARMENT_STYLES: Record<GarmentStyle, GarmentStyleDef> = {
  bare: {
    label: "Ngực trần dựng khối",
    dims: BODY,
    neckline: "round",
    marks: (s) => [
      ...SIDES.map((d) => ({
        pts: curve(8, (u): SP => [
          d * (5 + 48 * u),
          s.t(0.15 + 0.05 * Math.sin(Math.PI * u) - 0.05 * u),
        ]),
        k: BARE_LINE,
        ink: BARE_INK,
      })),
      {
        pts: [
          [0, s.t(0.26)],
          [0, s.t(0.43)],
        ],
        k: BARE_LINE,
        ink: BARE_INK,
      },
      { pts: [[0, s.t(0.66)]], k: 0.45, ink: BARE_INK, dot: true },
      {
        pts: [
          [180, s.t(0.36)],
          [180, s.t(0.64)],
        ],
        k: BARE_LINE,
        ink: BARE_INK,
      },
      ...SIDES.map((d) => ({
        pts: curve(8, (u): SP => [180 + d * (35 - 24 * u), s.t(bezier(u, 0.14, 0.33, 0.2))]),
        k: BARE_LINE,
        ink: BARE_INK,
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
      cladSlope: 0.4,
      round: 16,
      hemRound: 8,
    },
    neckline: "round",
    marks: () => [],
    rib: { width: 6, stand: 0, lift: [1.2, 0.3], line: 0.3, lean: 0 },
  },
  shirt: {
    label: "Sơ mi dựng khối",
    dims: { ...TEE, hem: 5, neck: 17, neckFront: 10 },
    neckline: "v",
    marks: (s) => {
      const [yA, ...buttons] = placket(s, [0, 0.2, 0.52, 0.84]);
      return [
        { pts: [s.at(-1.5, yA), s.at(-1.5, s.yH - 1)], ...TRIM },
        ...buttons.map((y) => ({ pts: [s.at(1.5, y)], k: 0.9, dot: true })),
      ];
    },
    // Lá cổ ôm sát cổ: `side` là độ hạ theo mặt vát vai thoải, mỗi px hạ ra ngang ~2,5 px, `6` cũ trải lá cổ tới mép vai
    collar: (s) => ({
      stand: 5,
      band: SHIRT_COLLAR.band,
      side: SHIRT_COLLAR.side,
      flap: [[SHIRT_COLLAR.tipX, s.top() + s.g.neckFront + SHIRT_COLLAR.tipY]],
      lift: [3.5, 1.5],
      tip: 5,
      line: SHIRT_COLLAR.line,
      ink: SHIRT_COLLAR.ink,
    }),
  },
  polo: {
    label: "Áo polo dựng khối",
    dims: { ...TEE, hem: 3.5, neck: 17, neckFront: 9 },
    neckline: "v",
    marks: (s) => {
      const yA = s.top() + s.g.neckFront;
      const yB = yA + 30;
      return [
        { pts: [s.at(-5, yA), s.at(-5, yB), s.at(5, yB), s.at(5, yA)], ...TRIM },
        { pts: [s.at(0, yA + 16)], k: 0.9, dot: true },
      ];
    },
    // như cổ sơ mi: lá cổ ôm sát cổ, `side` nhỏ vì vai thoải trải độ hạ ra ngang
    collar: (s) => ({
      stand: 5,
      band: 6,
      side: 2,
      flap: [[11, s.top() + s.g.neckFront + 7]],
      lift: [3.5, 1.5],
      tip: 5,
    }),
  },
  sweater: {
    label: "Áo len dựng khối",
    dims: { ...TEE, hem: 2, neckFront: 12 },
    neckline: "round",
    rib: { width: 8, stand: 4, lift: [4.5, 0.4], line: 0.3, ticks: { step: 15, k: 0.56 } },
    marks: (s) => [around(s.yH - 13, TRIM), ...ticks(s.yH - 12, s.yH - 1, 12, TRIM_FINE)],
  },
  suit: {
    label: "Vest dựng khối",
    dims: { ...TEE, hem: 10, fit: 0.8, neck: SUIT_NECK, neckFront: 76 },
    neckline: "v",
    shoulderFit: true,
    lapel: SUIT_LAPEL,
    marks: (s) => {
      const [yA, ...buttons] = placket(s, [0, 0.26, 0.6]);
      return [
        ...innerMarks(s),
        { pts: [s.at(0, yA), s.at(-1, yA + 20), s.at(0, s.yH - 9)], ...TRIM },
        // Hai vạt trước bo tròn ở gấu
        ...SIDES.map((d) => ({
          pts: curve(6, (u): [number, number] => [
            d * 9 * (1 - Math.cos((u * Math.PI) / 2)),
            s.yH - 9 + 8 * Math.sin((u * Math.PI) / 2),
          ]).map(([x, y]) => s.at(x, y)),
          ...TRIM,
        })),
        ...buttons.map((y) => ({ pts: [s.at(3.5, y)], k: 0.9, dot: true })),
      ];
    },
    // Ve áo: mép ngoài qua đỉnh ve rồi về cúc trên, vểnh ở đỉnh ve
    collar: (s) => ({
      stand: 6,
      band: 7,
      side: 3,
      flap: [
        [s.g.lapel ?? SUIT_LAPEL, s.top() + 38],
        [0.3 * (s.g.lapel ?? SUIT_LAPEL), s.top() + s.g.neckFront - 8],
      ],
      lift: [7, 1.5],
      tip: 4,
      tipAt: 0,
    }),
  },
  hoodie: {
    label: "Hoodie dựng khối",
    dims: { ...TEE, hem: 5.5, slope: 0.7, cladSlope: 0.5, neckFront: 8, neckBack: 8 },
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
        around(yB, { k: 1 }),
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
    dims: { ...TEE, ease: 8, waist: 11, fit: 0.85, hem: 0, neck: SUIT_NECK, neckFront: 73 },
    neckline: "v",
    shoulderFit: true,
    lapel: BLAZER_LAPEL,
    marks: (s) => [
      ...innerMarks(s, "accent"),
      ...placket(s, [0.38, 0.75]).map((y) => ({ pts: [s.at(18, y)], dot: true, k: 1.05 })),
      ...SIDES.map((d) => ({
        pts: [s.at(d * 25, placket(s, [0.62])[0]), s.at(d * 37, placket(s, [0.54])[0])],
        ...TRIM,
      })),
    ],
    collar: (s) => {
      const w = (s.g.lapel ?? BLAZER_LAPEL) / 29;
      return {
        stand: 4,
        band: 7,
        side: 3,
        flap: [
          [25 * w, s.top() + 22],
          [19 * w, s.top() + 28],
          [29 * w, s.top() + 33],
          [9 * w, s.top() + s.g.neckFront - 4],
        ],
        lift: [5, 1.5],
        tip: 4,
        tipAt: 2,
      };
    },
  },
  cardigan: {
    label: "Cardigan cổ V dựng khối",
    dims: { ...TEE, ease: 12, waist: 3, hem: 6, neck: SUIT_NECK, neckFront: 52 },
    neckline: "v",
    shoulderFit: true,
    rib: { width: 5, stand: 2, lift: [2, 0.5], line: 0.25 },
    marks: (s) => [
      ...innerMarks(s, "accent"),
      { pts: [s.at(-3, s.top() + s.g.neckFront), s.at(-3, s.yH - 2)], ...TRIM },
      ...placket(s, [0.2, 0.5, 0.8]).map((y) => ({ pts: [s.at(3, y)], dot: true, k: 0.85 })),
      around(s.yH - 9, TRIM),
      ...ticks(s.yH - 8, s.yH - 2, 22, TRIM_FINE),
    ],
  },
  bowShirt: {
    label: "Sơ mi cổ nơ dựng khối",
    dims: { ...TEE, ease: 8, waist: 5, hem: 3, neck: 17, neckFront: 17 },
    neckline: "v",
    marks: (s) => {
      const y = s.top() + s.g.neckFront + 2;
      return [
        { pts: [s.at(0, y + 30), s.at(0, s.yH - 2)], ...TRIM },
        ...SIDES.flatMap((d): Mark[] => [
          {
            pts: [
              [0, y],
              [d * 17, y - 5],
              [d * 19, y + 7],
              [d * 7, y + 8],
            ].map(([x, yy]) => s.at(x, yy)),
            fill: "accent",
            ...OUTLINE,
          },
          {
            pts: [
              [d * 2, y + 3],
              [d * 7, y + 4],
              [d * 14, y + 34],
              [d * 5, y + 29],
            ].map(([x, yy]) => s.at(x, yy)),
            fill: "accent",
            ...OUTLINE,
          },
        ]),
        {
          pts: oval(0, y + 2, 3, 4, 0, 360).map(([x, yy]) => s.at(x, yy)),
          fill: "accent",
          ...OUTLINE,
        },
      ];
    },
    collar: (s) => ({
      stand: 4,
      band: 5,
      side: 2,
      flap: [[10, s.top() + 20]],
      lift: [3, 1],
      tip: 3,
    }),
  },
  squareNeck: {
    label: "Áo cổ vuông eo cao dựng khối",
    dims: { ...TEE, ease: 9, waist: 10, fit: 1, hem: 9, neck: 23, neckFront: 19 },
    neckline: "square",
    rib: { width: 3, stand: 1, lift: [1, 0.3], line: 0.25 },
    marks: (s) => [
      around(s.t(0.58), TRIM),
      ...[-55, 0, 55, 125, 180, -125].map((lon) => ({
        pts: [
          [lon, s.t(0.66)],
          [lon, s.yH - 3],
        ] as SP[],
        ...TRIM_FINE,
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
        around(seam, TRIM),
        ...[0, 38, -38, 76, -76, 114, -114, 152, -152].map((lon) => ({
          pts: [
            [lon, seam + 5],
            [lon, s.yH - 1],
          ] as SP[],
          ...TRIM_FINE,
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
          ...OUTLINE,
        })),
        ...SIDES.map((d) => ({
          pts: onFront(oval(d * 8.5, yb, 7.5, 6.5, 0, 360)),
          fill: "accent" as const,
          ...OUTLINE,
        })),
        { pts: onFront(oval(0, yb, 3.5, 4.5, 0, 360)), fill: "accent", ...OUTLINE },
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
  wrap: {
    label: "Áo cổ chéo dựng khối",
    dims: { ...TEE, ease: 10, fit: 0.85, waist: 2, hem: 5, neck: 18, neckFront: 30, hemRound: 6 },
    neckline: "v",
    marks: () => [],
    wrap: true,
  },
};

/**
 * Bộ số đã đủ: trường bỏ trống lấy số của kiểu; `clad` (`palette.clad`) thì `slope` là `cladSlope`. Có `rig` thì áo
 * khoác cổ V (`shoulderFit`) co giãn `neck` và `lapel` theo nửa rộng vai áo (`shoulderHalf + ease`) so với vai chuẩn
 */
export function garmentOf(
  raw: Partial<Garment> | undefined,
  clad = false,
  rig?: Pick<Rig, "shoulderHalf">,
): Garment & Dims {
  const g = GarmentSchema.parse(raw ?? {});
  const def = GARMENT_STYLES[g.style];
  const dims = { ...def.dims };
  for (const k of Object.keys(dims) as (keyof Dims)[]) if (g[k] !== undefined) dims[k] = g[k];
  if (clad) dims.slope = dims.cladSlope;
  if (!def.shoulderFit) return { ...g, ...dims };
  const k = rig ? (rig.shoulderHalf + dims.ease) / (SHOULDER_REF + def.dims.ease) : 1;
  dims.neck = Math.max(Math.min(NECK_MIN, dims.neck), dims.neck * k);
  const lapel = g.lapel ?? def.lapel;
  return { ...g, ...dims, ...(lapel !== undefined && { lapel: lapel * k }) };
}

/** Số đo của rig mà khối thân đọc */
export type Rig = Pick<
  CharacterData["rig"],
  "height" | "shoulderHalf" | "shoulderDrop" | "hipHalf" | "stroke"
>;

/**
 * Mặt cắt dọc của khối: nửa rộng `a` theo `y` (toạ độ nhóm thân, gốc ở hông), từ khớp cổ vát xuống
 * vành vai, bo góc, thon và thắt eo xuống gấu, bo góc gấu; `belly` nở hai bên quanh bụng
 */
export function profile(g: Dims & { belly?: number; bellySide?: number }, rig: Rig, inset: number) {
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
  if (g.belly)
    for (const p of pts) p[0] += (g.bellySide ?? BELLY.side) * g.belly * bellyAt(p[1], rig.height);
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

/** Gấu thấp hơn hông chưa tới bấy nhiêu px thì nửa trước người ngồi không trải vạt lên đùi mà bo vào chỗ gập (`lapFold`) */
export const LAP_FLAP = 20;

/** Vạt áo của người ngồi (`lapFold`), px hệ thân, y xuống: mặt ghế; `fold` là chỗ gập và hướng đùi `[y, z]` */
export interface Lap {
  seat: number;
  fold?: { top: number; dir: P2 };
}

/**
 * Thân áo người ngồi (`profile` / `depth` của khối, hệ thân px, y xuống, z ra trước ngực): dưới `fold.top`, gấu thấp hơn
 * hông từ `LAP_FLAP` thì nửa trước gập theo đùi — vành xa chỗ gập bao nhiêu thì nửa sâu thêm bấy nhiêu dọc đùi, các vành
 * lồng nhau thành vạt nửa ellipse, mép trơn; gấu ngắn hơn thì nửa trước giữ chỗ cũ rồi dừng ở đường gập, bụng bo xuống
 * đùi — còn nửa sau và hai sườn buông tới `seat`; nửa trước không thấp
 * hơn đường qua chỗ gập theo hướng đùi, nên thân ngả trước thì bụng dừng trên đùi. Không có `fold` thì mọi điểm dưới `seat`
 * chỉ dồn lên `seat`. Điểm nổi khỏi mặt khối (nét, mảng) giữ khoảng nổi ấy.
 */
export function lapFold(
  pr: readonly P2[],
  depth: readonly number[],
  { seat, fold }: Lap,
  front: readonly number[] = depth,
) {
  /** Hàng đầu tiên của `pr` không cao hơn `y` */
  const row = (y: number) => {
    let [lo, hi] = [0, pr.length];
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (pr[m][1] < y) lo = m + 1;
      else hi = m;
    }
    return lo;
  };
  const at = (y: number, i = row(y), dep = depth): P2 => {
    if (i <= 0) return [pr[0][0], dep[0]];
    if (i >= pr.length) return [pr[pr.length - 1][0], dep[dep.length - 1]];
    const u = (y - pr[i - 1][1]) / (pr[i][1] - pr[i - 1][1] || 1);
    return [lerp(pr[i - 1][0], pr[i][0], u), lerp(dep[i - 1], dep[i], u)];
  };
  if (!fold) return ([x, y, z]: Vec3): Vec3 => [x, Math.min(y, seat), z];
  const { top } = fold;
  const dt = at(top, undefined, front)[1];
  const l = Math.hypot(...fold.dir) || 1;
  const [dy, dz] = [fold.dir[0] / l, fold.dir[1] / l];
  const slope = dz > 0.1 ? dy / dz : 0;
  const flap = pr[pr.length - 1][1] >= LAP_FLAP;
  // vạt không hẹp lại dọc đùi: góc bo của gấu hẹp dần mà vạt dài thêm thì các vành cắt nhau, dải lật úp lòi vỏ viền
  const wide: number[] = [];
  pr.forEach(([pa, py], i) => wide.push(Math.max(wide[i - 1] ?? 0, py > top ? pa : 0)));
  return ([x, y, z]: Vec3): Vec3 => {
    const h = y - top;
    if (h <= 0 && (z <= 0 || y < top + z * slope - 12)) return [x, y, z];
    const i = row(y);
    const [a, d] = at(y, i, z > 0 ? front : depth);
    const rho = Math.hypot(x / Math.max(a, 1e-6), z / Math.max(d, 1e-6));
    // tâm nắp gấu buông tới ghế: nắp chéo dưới vạt, không nằm sát mặt vạt mà giành độ sâu với nó
    if (rho < 1e-6) return [x, Math.min(y, seat), z];
    const [s, c] = [x / (a * rho), z / (d * rho)];
    // nổi khỏi mặt khối dọc tia từ trục: nửa trước gập thì khoảng nổi chĩa lên
    const e = (rho - 1) * Math.hypot(a * s, d * c);
    const k = Math.min(1, Math.max(0, c / 0.3));
    const w = k * k * (3 - 2 * k);
    const [x1, y1, z1] =
      h > 0 && flap
        ? [
            lerp(x, x * (Math.max(a, wide[i - 1] ?? 0) / a), w),
            lerp(Math.min(y, seat), top + h * c * dy - e * dz, w),
            lerp(z, (dt + h * dz) * c + e * dy, w),
          ]
        : [x, h > 0 ? Math.min(y, seat) : y, z];
    return [x1, lerp(y1, Math.min(y1, top + z1 * slope - Math.max(0, e)), w), z1];
  };
}

export const lerpAt = (pts: P2[], v: number, from: 0 | 1, to: 0 | 1) => {
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
export function garmentShoulder(raw: Partial<Garment> | undefined, rig: Rig, clad = false) {
  const pr = profile(garmentOf(raw, clad, rig), rig, 0);
  return Math.max(0, lerpAt(pr.pts, pr.yS, 1, 0) - rig.stroke / 2);
}

export const shoulderRoot = (c: CharacterData) =>
  garmentShoulder(c.pieces.torso.garment, c.rig, c.palette.clad);

/**
 * Tâm gốc ống cánh tay ở góc vai của mặt khối 3D (mặt cắt lùi nửa nét như `torsoMesh`), `[x, y]` px của nhóm thân, y
 * xuống. Vòng tròn bán kính `r` nội tiếp góc, tiếp xúc vát vai và sườn áo; `grow` lớn hơn `r` thì vòng ấy nở từ đúng
 * điểm tiếp xúc vát vai, lồi ra ngoài sườn áo. Nắp ống tay bán kính `grow` ở đây thì viền vai đi liền vào tay. Chỉ người
 * `clad` có ống tay: vát vai là `cladSlope`
 */
export function garmentSocket(
  raw: Partial<Garment> | undefined,
  rig: Rig,
  r: number,
  grow = r,
): P2 {
  const pr = profile(garmentOf(raw, true, rig), rig, rig.stroke / 2);
  // vát vai: khớp cổ → đầu cung bo; sườn: cuối cung bo (`B`) xuôi vài điểm, đã thắt eo
  const [P0, A, B, S] = [pr.pts[0], pr.pts[1], pr.pts[13], pr.pts[17]];
  const unit = (x: number, y: number): P2 => {
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  const u1 = unit(P0[0] - A[0], P0[1] - A[1]);
  const u2 = unit(S[0] - B[0], S[1] - B[1]);
  // góc vai: giao của hai đường
  const den = u1[0] * u2[1] - u1[1] * u2[0];
  const t = ((B[0] - A[0]) * u2[1] - (B[1] - A[1]) * u2[0]) / (den || 1e-9);
  const X: P2 = [A[0] + u1[0] * t, A[1] + u1[1] * t];
  const b = unit(u1[0] + u2[0], u1[1] + u2[1]);
  const sin = Math.abs(u1[0] * b[1] - u1[1] * b[0]) || 1;
  const C: P2 = [X[0] + (b[0] * r) / sin, X[1] + (b[1] * r) / sin];
  // pháp tuyến vát vai hướng vào tâm: tâm trượt theo nó, điểm tiếp xúc giữ nguyên
  const side = Math.sign(u1[0] * b[1] - u1[1] * b[0]);
  const n: P2 = [-u1[1] * side, u1[0] * side];
  return [C[0] + n[0] * (grow - r), C[1] + n[1] * (grow - r)];
}

/**
 * Nửa khoảng cách chiếu của hai gốc chi trên một vành nửa rộng `half`: hai điểm kinh độ `±90`
 * quay theo góc `yaw`. Gốc gần có `z ≥ 0`, gốc xa `z ≤ 0`; quay quá `90` thì gốc gần sang `+x`
 */
export const limbSpread = (half: number, yaw: number) => Math.abs(half * Math.cos(yaw * D));
