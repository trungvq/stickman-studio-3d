import { D } from "./constants";
import type { Garment, PrintFont, PrintShape } from "./schema";
import type { Vec3 } from "./sphere";
import { curve } from "./torso";
import type { WrapBody } from "./wrap";

/** Hình in nổi khỏi mặt khối bấy nhiêu px: trên mảng tô và áo trong lộ giữa vạt mở */
export const PRINT_LIFT = 0.8;

/** Nội dung vẽ lên hình in: chữ, path SVG trong hộp `0…100`, hay mặt thẻ tên */
export type PrintArt =
  | { kind: "text"; text: string; color: string; font: PrintFont; vertical: boolean }
  | { kind: "path"; d: string; color: string }
  | {
      kind: "badge";
      color: string;
      edge: string;
      text: string;
      textColor: string;
      wakaba: boolean;
      round: number;
    };

/** Một hình in trên mặt khối thân áo */
export interface PrintPart {
  /** Lưới cột × hàng: cột từ trái sang phải khi nhìn thẳng vào hình, mỗi cột từ trên xuống; hệ thân `y` xuống */
  grid: Vec3[][];
  /** Bề ngang, bề cao của hình, px */
  w: number;
  h: number;
  art: PrintArt;
}

const f = (n: number) => String(Math.round(n * 10) / 10);
const svg = (pts: [number, number][]) =>
  "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L") + "Z";

/** Lá phong năm thuỳ có cuống, thuỳ nhọn mép răng cưa, trong hộp `0…100` */
function maple() {
  const R = 47;
  const P = (a: number, r: number): [number, number] => [
    50 + r * R * Math.sin(a * D),
    50 - r * R * Math.cos(a * D),
  ];
  const lobes: [number, number][] = [
    [-122, 0.66],
    [-62, 0.9],
    [0, 1],
    [62, 0.9],
    [122, 0.66],
  ];
  const valleys: [number, number][] = [
    [-160, 0.18],
    [-92, 0.3],
    [-31, 0.34],
    [31, 0.34],
    [92, 0.3],
    [160, 0.18],
  ];
  const pts: [number, number][] = [P(...valleys[0])];
  /** Mép thuỳ từ `a` tới `b`, phồng ra ngoài `0.12` lần bề dài, ba răng cưa */
  const edge = ([ax, ay]: [number, number], [bx, by]: [number, number]) => {
    const L = Math.hypot(bx - ax, by - ay);
    const [nx, ny] = [(by - ay) / L, -(bx - ax) / L];
    for (let j = 1; j < 12; j++) {
      const t = j / 12;
      const k = 0.12 * Math.sin(Math.PI * t ** 0.8) + (j % 3 ? 0 : 0.045 * (1 - t / 2));
      pts.push([ax + (bx - ax) * t + nx * k * L, ay + (by - ay) * t + ny * k * L]);
    }
  };
  lobes.forEach(([a, len], i) => {
    const tip = P(a, len);
    const next = P(...valleys[i + 1]);
    edge(pts[pts.length - 1], tip);
    pts.push(tip);
    edge(tip, next);
    pts.push(next);
  });
  pts.push([53, 62], [56, 90], [53, 91], [48.5, 62]);
  return svg(pts);
}

/** Hình in có tên: path SVG trong hộp `0…100` (`y` xuống), tô evenodd. docs/12-trang-phuc-3d.md#hình-in-trên-áo */
export const PRINT_SHAPES: Record<PrintShape, string> = {
  maple: maple(),
  circle: "M50 2A48 48 0 1 1 50 98A48 48 0 1 1 50 2Z",
  ring: "M50 2A48 48 0 1 1 50 98A48 48 0 1 1 50 2ZM50 22A28 28 0 1 0 50 78A28 28 0 1 0 50 22Z",
  diamond: "M50 2L98 50L50 98L2 50Z",
};

/** Dấu lá non 若葉マーク trong hộp `0…100`: nửa trái, nửa phải khi nhìn thẳng, và màu của chúng */
export const WAKABA = {
  left: svg([
    [50, 30],
    [14, 4],
    [14, 66],
    [50, 96],
  ]),
  right: svg([
    [50, 30],
    [86, 4],
    [86, 66],
    [50, 96],
  ]),
  colors: ["#f2c200", "#1e9a48"] as const,
};

/**
 * Hình in (`garment.prints`) và thẻ tên (`garment.badge`) trên khối thân `b`: lưới bám mặt khối, chiếu thẳng từ trước hay
 * sau nên nhìn thẳng thì không méo
 */
export function printParts(b: WrapBody, g: Garment): PrintPart[] {
  const { s } = b;
  const h = b.height;
  /** Lưới khung `w`×`hh` tâm `(x0, yc)` trên mặt trước hay sau, xoay `rot` độ theo chiều kim đồng hồ khi nhìn thẳng */
  const onBody = (
    back: boolean,
    x0: number,
    yc: number,
    w: number,
    hh: number,
    rot: number,
    lift: number,
  ) => {
    const [cs, sn] = [Math.cos(rot * D), Math.sin(rot * D)];
    return curve(Math.max(2, Math.ceil(w / 2)), (u) =>
      curve(Math.max(2, Math.ceil(hh / 2)), (v) => {
        const [lu, lv] = [(u - 0.5) * w, (v - 0.5) * hh];
        const [ru, rv] = [lu * cs - lv * sn, lu * sn + lv * cs];
        // nhìn từ sau lưng, bên phải người xem là `−x`
        return b.raise(s.at(x0 + (back ? -ru : ru), yc + rv, back), lift);
      }),
    );
  };
  const out: PrintPart[] = [];
  for (const p of g.prints ?? []) {
    const chars = p.text === undefined ? [] : Array.from(p.text);
    const [w, hh] = !chars.length
      ? [p.size, p.size]
      : p.vertical
        ? [p.size, chars.length * p.size]
        : [chars.length * p.size, p.size];
    out.push({
      grid: onBody(p.side === "back", p.x, -p.y * h, w, hh, p.rotate, PRINT_LIFT),
      w,
      h: hh,
      art: chars.length
        ? { kind: "text", text: p.text!, color: p.color, font: p.font, vertical: p.vertical }
        : { kind: "path", d: p.path ?? PRINT_SHAPES[p.shape], color: p.color },
    });
  }
  const t = g.badge;
  if (t)
    out.push({
      grid: onBody(false, t.x, -t.y * h, t.width, t.height, 0, t.lift),
      w: t.width,
      h: t.height,
      art: {
        kind: "badge",
        color: t.color,
        edge: t.edge,
        text: t.text,
        textColor: t.textColor,
        wakaba: t.wakaba,
        round: t.round,
      },
    });
  return out;
}
