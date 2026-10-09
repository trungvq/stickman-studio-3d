import type { ReactNode } from "react";
import { GARMENTS, GARMENT_BOX, type GarmentShape } from "./garments";
import { HAIRSTYLES } from "./hairstyles";
import { HEADWEAR } from "./headwear";
import { ACCESSORIES } from "./accessories";
import { HANDHELD } from "./handheld";
import type { TracedDef } from "./traced";
import { PROP_ART } from "./prop-art";
import { TREES } from "./trees";
import { D, SIDE_EYE_OVAL, SIDE_GLASSES_ARM, TORSO_DEPTH } from "./constants";
import { mix } from "./geometry";
import { PIECE_KEYS, type PieceCatalog, type PieceConfig, type PieceKey } from "./schema";
import { DEFAULT_VIEW, isProfile, type View } from "./types";
import { VIEW_FRAME, isViewSocket, viewArt, type ViewArt } from "./views";

/** Chỗ cắm được bộ phận: socket nhân vật, hoặc thân đạo cụ (`prop`) */
export type PartSocket = PieceKey | "prop";

/** Hộp mà bộ phận vẽ vào — đúng hộp mảnh ảnh sẽ chiếm, gốc ở góc trên trái */
export interface PartBox {
  w: number;
  h: number;
  color: string;
  accent: string;
  line: string;
  stroke: number;
  /** Góc quay của khối thân, độ (`torsoYaw`): chỉ mảnh treo trên thân nhận */
  yaw?: number;
}

export interface PartDef {
  label: string;
  sockets: readonly PartSocket[];
  /** Tỉ lệ khung của hộp; thay cho `aspect` đo từ ảnh */
  aspect: number;
  /** Số căn gợi ý lúc chọn; studio ghi vào JSON rồi người dùng chỉnh tiếp */
  preset?: {
    dx?: number;
    scale?: number;
    dy?: number;
    widthScale?: number;
    rotate?: number;
    clip?: boolean;
    clipGrow?: number;
    hideLegs?: boolean;
    layer?: "front" | "under";
  };
  draw: (b: PartBox) => ReactNode;
  /** Hình ở góc `side` vẽ trong chính hộp chính diện, mặt nhìn về `+x` */
  drawSide?: (b: PartBox) => ReactNode;
  /** Chỉ hình bao ngoài, bỏ chi tiết: thân áo và mái tóc nhìn từ sau khi không có hình `back` riêng */
  outline?: (b: PartBox) => ReactNode;
  /** Thân đạo cụ: lớp vẽ **sau** người ngồi (ruột xe, vách xa); `draw` là vách gần, có lỗ cho người lộ ra */
  drawBehind?: (b: PartBox) => ReactNode;
  /** Thân đạo cụ: hông người ngồi, tỉ lệ hộp (`0..1`), `propSeat` đổi ra hệ đạo cụ */
  seat?: { x: number; y: number };
}

/** Cạp bóp theo nửa rộng khối thân ở góc `yaw` — nghiêng thì thân chỉ sâu `TORSO_DEPTH` lần bề ngang */
const flaredSkirt: PartDef["draw"] = ({ w, h, color, line, stroke, yaw = 0 }) => {
  const waist = 0.21 * Math.hypot(Math.cos(yaw * D), TORSO_DEPTH * Math.sin(yaw * D));
  const x = (u: number) => w * (0.5 + u);
  return (
    <g stroke={line} strokeLinejoin="round" strokeLinecap="round">
      <path
        d={`M ${x(-waist)} 0 Q ${x(0)} ${h * 0.045} ${x(waist)} 0 C ${x(waist + 0.03)} ${h * 0.3} ${w * 0.81} ${h * 0.7} ${w * 0.86} ${h * 0.9} Q ${x(0)} ${h * 1.08} ${w * 0.14} ${h * 0.9} C ${w * 0.19} ${h * 0.7} ${x(-waist - 0.03)} ${h * 0.3} ${x(-waist)} 0 Z`}
        fill={color}
        strokeWidth={stroke}
      />
      <path
        d={`M ${x(-waist - 0.01)} ${h * 0.09} Q ${x(0)} ${h * 0.14} ${x(waist + 0.01)} ${h * 0.09} M ${x(-waist * 0.57)} ${h * 0.17} Q ${w * 0.35} ${h * 0.55} ${w * 0.32} ${h * 0.87} M ${x(waist * 0.57)} ${h * 0.17} Q ${w * 0.65} ${h * 0.55} ${w * 0.68} ${h * 0.87}`}
        fill="none"
        strokeWidth={stroke * 0.45}
      />
    </g>
  );
};

const CAP = { strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

/**
 * Ba kiểu kính chung một khung: cao hộp là đường kính ngoài mắt kính (`scale`),
 * bề ngang hộp là khoảng cách hai mắt kính (`bề ngang`) — hai thứ chỉnh rời nhau
 * để trùm vừa mắt. Hộp treo ở đỉnh đầu nên `dy` phải tụt xuống nửa đầu.
 */
const GLASSES = { aspect: 3.4, preset: { scale: 0.19, dy: 53 } } as const;

/** Chỉ vẽ gọng bên gần (`−x`); gọng xa khuất sau khối đầu. `tinted` là kính râm. */
const glasses =
  (shape: "round" | "rect", tinted: boolean): PartDef["draw"] =>
  ({ w, h, color, line, stroke }) => {
    const fw = stroke * 0.34; // gọng mảnh hơn nét chi, cỡ nét vẽ mắt
    const r = h / 2 - fw / 2;
    const cy = h / 2;
    const hinge = cy - h * 0.15;
    const gap = w * 0.36;
    const x1 = w / 2 - gap / 2;
    const x2 = w / 2 + gap / 2;
    const half = shape === "round" ? r : gap * 0.4;
    const lens = (cx: number) =>
      shape === "round" ? (
        <circle cx={cx} cy={cy} r={r} />
      ) : (
        <rect x={cx - half} y={cy - h * 0.37} width={half * 2} height={h * 0.74} rx={h * 0.09} />
      );
    return (
      <g
        stroke={tinted ? line : color}
        strokeWidth={fw}
        fill={tinted ? color : "none"}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {lens(x1)}
        {lens(x2)}
        <path
          d={`M ${x1 + half} ${hinge} Q ${w / 2} ${hinge - h * 0.1} ${x2 - half} ${hinge}`}
          fill="none"
        />
        <path d={`M ${x1 - half} ${hinge} L 0 ${hinge}`} fill="none" />
      </g>
    );
  };

/** Kính `side`: một mắt kính bóp oval ở tâm hộp (tâm hộp trùng mắt), càng chạy ngang về tai */
const glassesSide =
  (shape: "round" | "rect", tinted: boolean): PartDef["draw"] =>
  ({ w, h, color, line, stroke }) => {
    const fw = stroke * 0.34;
    const cx = w / 2;
    const cy = h / 2;
    const ry = shape === "round" ? h / 2 - fw / 2 : h * 0.37;
    const rx = (shape === "round" ? ry : w * 0.144) * SIDE_EYE_OVAL;
    // Tai nằm ngay sau tâm đầu: `SIDE_EYE` nửa trục đầu tính từ mắt, đổi ra bề ngang hộp `preset`
    const ear = cx - w * SIDE_GLASSES_ARM;
    const top = cy - ry * 0.35;
    return (
      <g
        stroke={tinted ? line : color}
        strokeWidth={fw}
        fill={tinted ? color : "none"}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {shape === "round" ? (
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
        ) : (
          // Mép trong xa người xem hơn mép ngoài nên thấp hơn một chút
          <path
            d={`M ${cx - rx} ${cy - ry} L ${cx + rx} ${cy - ry * 0.86} L ${cx + rx} ${cy + ry * 0.86} L ${cx - rx} ${cy + ry} Z`}
          />
        )}
        {/* Cầu kính vẽ dư về trước; `<Character>` cắt nó ở lòng viền đầu */}
        <path
          d={`M ${cx + rx} ${cy - ry * 0.5} Q ${cx + rx + w * 0.04} ${cy - ry * 0.95} ${cx + rx + w * 0.1} ${cy - ry * 0.95} L ${cx + w} ${cy - ry * 0.95}`}
          fill="none"
        />
        <path
          d={`M ${cx - rx} ${top} L ${ear} ${top} Q ${ear - h * 0.22} ${top} ${ear - h * 0.3} ${top + h * 0.42}`}
          fill="none"
        />
      </g>
    );
  };

/** Số hoá `d` của áo từ `GARMENT_BOX` vào hộp thật; toạ độ trong `d` đi theo cặp x y */
const fitPath =
  (w: number, h: number, box: { w: number; h: number } = GARMENT_BOX) =>
  (d: string) => {
    let i = 0;
    return d.replace(/-?[\d.]+/g, (n) => (+n * (i++ % 2 ? h / box.h : w / box.w)).toFixed(2));
  };

/** Viền ngoài dùng hình đầu với nét đầy: hình bao vẽ lại từ ảnh khai `k: 0` vì nét đã nằm ở đường riêng */
const silhouette = (shapes: readonly GarmentShape[]) => [{ ...shapes[0], k: 1 }];

const drawShapes =
  (shapes: readonly GarmentShape[], box?: { w: number; h: number }): PartDef["draw"] =>
  ({ w, h, color, line, stroke }) => {
    const fit = fitPath(w, h, box);
    return (
      <g stroke={line} strokeLinecap="round" strokeLinejoin="round">
        {shapes.map((s, i) => (
          <path
            key={i}
            d={fit(s.d)}
            fill={s.fill === "none" ? "none" : s.fill === "line" ? line : color}
            strokeWidth={stroke * (s.k ?? 1)}
          />
        ))}
      </g>
    );
  };

/** Các áo của `GARMENTS`, mỗi áo mang bộ số căn và danh sách hình riêng */
const garmentParts = (): Record<string, PartDef> =>
  Object.fromEntries(
    Object.entries(GARMENTS).map(([name, g]): [string, PartDef] => [
      name,
      {
        label: g.label,
        sockets: ["torso"],
        aspect: (g.box ?? GARMENT_BOX).w / (g.box ?? GARMENT_BOX).h,
        preset: g.preset,
        draw: drawShapes(g.shapes, g.box ?? GARMENT_BOX),
        outline: drawShapes(silhouette(g.shapes), g.box ?? GARMENT_BOX),
      },
    ]),
  );

/** Tóc, mũ, râu, tà và đồ đeo vẽ lại từ ảnh; `fill: "line"` là khối mực đặc */
const tracedParts = (table: Record<string, TracedDef>): Record<string, PartDef> =>
  Object.fromEntries(
    Object.entries(table).map(([name, t]): [string, PartDef] => [
      name,
      {
        label: t.label,
        sockets: [t.socket],
        aspect: t.box.w / t.box.h,
        preset: t.preset,
        draw: drawShapes(t.shapes, t.box),
        outline: drawShapes(silhouette(t.shapes), t.box),
      },
    ]),
  );

/** Kiểu tóc: hình chính diện lớp `over`, trong khung tâm sọ như mọi góc khác */
const hairstyleParts = (): Record<string, PartDef> =>
  Object.fromEntries(
    Object.entries(HAIRSTYLES).map(([name, s]): [string, PartDef] => [
      name,
      {
        label: s.label,
        sockets: ["hair"],
        aspect: VIEW_FRAME.hair.w / VIEW_FRAME.hair.h,
        draw: drawShapes(s.over, VIEW_FRAME.hair),
        outline: drawShapes(silhouette(s.over), VIEW_FRAME.hair),
      },
    ]),
  );

/**
 * Bộ phận vẽ bằng code, cắm vào socket qua `src: "part"`. Viết thẳng `draw` thì chỉ
 * 3–5 hình cơ bản; dài hơn thì là áo vẽ lại, path để ở `garments.ts` — docs/02-trang-phuc.md
 */
export const PARTS: Record<string, PartDef> = {
  ...hairstyleParts(),
  ...tracedParts(HEADWEAR),
  ...tracedParts(ACCESSORIES),
  ...HANDHELD,
  ...PROP_ART,
  ...TREES,
  sleeve: {
    label: "tay áo",
    sockets: ["sleeveNear", "sleeveFar"],
    aspect: 0.5,
    draw: ({ w, h, color, accent, line, stroke }) => (
      <g>
        <rect width={w} height={h} rx={w / 2} fill={color} stroke={line} strokeWidth={stroke} />
        <rect x={0} y={h - w * 0.55} width={w} height={w * 0.3} fill={accent} />
      </g>
    ),
  },
  puff: {
    label: "tay bồng",
    sockets: ["sleeveNear", "sleeveFar"],
    aspect: 0.7,
    draw: ({ w, h, color, line, stroke }) => (
      <g>
        <ellipse
          cx={w / 2}
          cy={h * 0.45}
          rx={w / 2}
          ry={h * 0.45}
          fill={color}
          stroke={line}
          strokeWidth={stroke}
        />
        <rect
          x={w * 0.25}
          y={h * 0.78}
          width={w * 0.5}
          height={h * 0.22}
          rx={w * 0.12}
          fill={color}
          stroke={line}
          strokeWidth={stroke}
        />
      </g>
    ),
  },
  nonla: {
    label: "nón lá",
    sockets: ["crown"],
    aspect: 2.6,
    preset: { scale: 0.62, dy: -34 },
    draw: ({ w, h, color, accent, line, stroke }) => (
      <g>
        <path
          d={`M ${w / 2} 0 L ${w} ${h * 0.88} Q ${w / 2} ${h * 1.12} 0 ${h * 0.88} Z`}
          fill={color}
          stroke={line}
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        <path
          d={`M ${w * 0.25} ${h * 0.44} L ${w * 0.75} ${h * 0.44}`}
          stroke={accent}
          strokeWidth={stroke * 0.7}
          {...CAP}
        />
      </g>
    ),
  },
  cap: {
    label: "mũ chỏm",
    sockets: ["crown"],
    aspect: 2.4,
    preset: { scale: 0.42, dy: -6 },
    draw: ({ w, h, color, line, stroke }) => (
      <path
        d={`M 0 ${h} Q ${w / 2} ${-h * 0.35} ${w} ${h} Z`}
        fill={color}
        stroke={line}
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
    ),
  },
  khan: {
    label: "khăn vấn",
    sockets: ["crown"],
    aspect: 2.9,
    preset: { scale: 0.37, dy: 4 },
    draw: ({ w, h, color, accent, line, stroke }) => (
      <g>
        <path
          d={`M 0 ${h} Q ${w / 2} ${-h * 0.25} ${w} ${h} Q ${w / 2} ${h * 0.55} 0 ${h} Z`}
          fill={color}
          stroke={line}
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        <path
          d={`M ${w * 0.2} ${h * 0.55} Q ${w / 2} ${h * 0.25} ${w * 0.8} ${h * 0.55}`}
          stroke={accent}
          strokeWidth={stroke * 0.8}
          {...CAP}
        />
      </g>
    ),
  },
  kinh: {
    label: "kính tròn",
    sockets: ["faceAcc"],
    aspect: GLASSES.aspect,
    preset: GLASSES.preset,
    draw: glasses("round", false),
    drawSide: glassesSide("round", false),
  },
  kinhcn: {
    label: "kính chữ nhật",
    sockets: ["faceAcc"],
    aspect: GLASSES.aspect,
    preset: GLASSES.preset,
    draw: glasses("rect", false),
    drawSide: glassesSide("rect", false),
  },
  kinhram: {
    label: "kính râm",
    sockets: ["faceAcc"],
    aspect: GLASSES.aspect,
    preset: GLASSES.preset,
    draw: glasses("round", true),
    drawSide: glassesSide("round", true),
  },
  sung: {
    label: "sừng",
    sockets: ["headAcc"],
    aspect: 1.7,
    // Nhô hẳn lên trên đỉnh sọ; chân sừng cắm vào nửa trên khối đầu
    preset: { scale: 0.4, dy: -30 },
    draw: ({ w, h, color, line, stroke }) => (
      <g fill={color} stroke={line} strokeWidth={stroke} strokeLinejoin="round">
        <path
          d={`M ${w * 0.26} ${h} Q ${w * 0.14} ${h * 0.6} ${w * 0.14} ${h * 0.06} Q ${w * 0.34} ${h * 0.46} ${w * 0.44} ${h} Z`}
        />
        <path
          d={`M ${w * 0.74} ${h} Q ${w * 0.86} ${h * 0.6} ${w * 0.86} ${h * 0.06} Q ${w * 0.66} ${h * 0.46} ${w * 0.56} ${h} Z`}
        />
      </g>
    ),
  },
  khanco: {
    label: "khăn quàng cổ",
    sockets: ["neck"],
    aspect: 1,
    preset: { scale: 0.9 },
    draw: ({ w, h, color, accent, line, stroke }) => (
      <g>
        <path
          d={`M ${w * 0.58} ${h * 0.16} L ${w * 0.84} ${h * 0.16} L ${w * 0.78} ${h} L ${w * 0.64} ${h} Z`}
          fill={color}
          stroke={line}
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        <rect
          x={w * 0.16}
          y={0}
          width={w * 0.68}
          height={h * 0.22}
          rx={h * 0.11}
          fill={color}
          stroke={line}
          strokeWidth={stroke}
        />
        <line
          x1={w * 0.64}
          y1={h * 0.86}
          x2={w * 0.78}
          y2={h * 0.86}
          stroke={accent}
          strokeWidth={stroke * 1.4}
          strokeLinecap="round"
        />
      </g>
    ),
  },
  "skirt-flared": {
    label: "Váy ngắn xòe nhẹ",
    sockets: ["hem"],
    aspect: 19 / 6,
    preset: { scale: 0.396, dy: -9, layer: "under", hideLegs: false },
    draw: flaredSkirt,
    drawSide: flaredSkirt,
  },
  skirt: {
    label: "váy",
    sockets: ["hem"],
    aspect: 0.7,
    draw: ({ w, h, color, accent, line, stroke }) => (
      <g>
        <path
          d={`M ${w * 0.28} 0 L ${w * 0.72} 0 L ${w} ${h} L 0 ${h} Z`}
          fill={color}
          stroke={line}
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        <rect x={0} y={h * 0.88} width={w} height={h * 0.12} fill={accent} />
      </g>
    ),
  },
  ta: {
    label: "tà áo dài",
    sockets: ["hem"],
    aspect: 0.62,
    draw: ({ w, h, color, line, stroke }) => (
      <g>
        <path
          d={`M ${w * 0.3} 0 L ${w * 0.7} 0 L ${w * 0.9} ${h} L ${w * 0.1} ${h} Z`}
          fill={color}
          stroke={line}
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        <line
          x1={w / 2}
          y1={h * 0.1}
          x2={w / 2}
          y2={h}
          stroke={line}
          strokeWidth={stroke * 0.8}
          strokeLinecap="round"
        />
      </g>
    ),
  },
  thung: {
    label: "thùng xe kéo tay",
    sockets: ["prop"],
    aspect: 2.2,
    // Thùng ở nửa phải, càng chìa sang trái; đáy hộp là trục bánh sau nên chân thùng đứng lên đó
    draw: ({ w, h, color, line, stroke }) => (
      <g>
        <path
          d={`M ${w * 0.36} ${h * 0.22} L ${w} ${h * 0.22} L ${w * 0.96} ${h * 0.72} L ${w * 0.4} ${h * 0.72} Z`}
          fill={color}
          stroke={line}
          strokeWidth={stroke}
          strokeLinejoin="round"
        />
        <line
          x1={w * 0.4}
          y1={h * 0.42}
          x2={w * 0.03}
          y2={h * 0.27}
          stroke={line}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={`M ${w * 0.56} ${h * 0.72} L ${w * 0.5} ${h} M ${w * 0.72} ${h * 0.72} L ${w * 0.78} ${h}`}
          stroke={line}
          strokeWidth={stroke * 0.8}
          {...CAP}
        />
      </g>
    ),
  },
  xengua: {
    label: "thùng xe ngựa",
    sockets: ["prop"],
    aspect: 1.5,
    seat: { x: 0.2, y: 0.725 },
    // Thùng chiếm 0.63 bề ngang, càng chìa sang phải tới ngựa; trụ gầm ở 0.15 và 0.483 nên bánh trước `x` = 0.333 × bề ngang hộp
    drawBehind: ({ w, h, accent, line, stroke }) => (
      <g>
        <rect x={w * 0.023} y={h * 0.09} width={w * 0.587} height={h * 0.74} fill={accent} />
        <rect x={w * 0.067} y={h * 0.725} width={w * 0.3} height={h * 0.04} fill={line} />
        <line
          x1={w * 0.633}
          y1={h * 0.59}
          x2={w}
          y2={h * 0.5275}
          stroke={line}
          strokeWidth={stroke * 0.55}
          strokeLinecap="round"
        />
      </g>
    ),
    draw: ({ w, h, color, accent, line, stroke }) => (
      <g stroke={line} strokeLinecap="round" strokeLinejoin="round">
        <path
          fillRule="evenodd"
          fill={color}
          strokeWidth={stroke}
          d={`M 0 ${h * 0.1} Q 0 ${h * 0.055} ${w * 0.03} ${h * 0.055} L ${w * 0.603} ${h * 0.055} Q ${w * 0.633} ${h * 0.055} ${w * 0.633} ${h * 0.1} L ${w * 0.633} ${h * 0.825} L 0 ${h * 0.825} Z
            M ${w * 0.067} ${h * 0.1125} L ${w * 0.242} ${h * 0.1125} L ${w * 0.242} ${h * 0.4875} L ${w * 0.067} ${h * 0.4875} Z
            M ${w * 0.358} ${h * 0.1125} L ${w * 0.533} ${h * 0.1125} L ${w * 0.533} ${h * 0.4875} L ${w * 0.358} ${h * 0.4875} Z`}
        />
        <rect
          x={w * 0.325}
          y={h * 0.0875}
          width={w * 0.242}
          height={h * 0.7125}
          fill="none"
          strokeWidth={stroke * 0.6}
        />
        <rect
          x={w * 0.537}
          y={h * 0.5375}
          width={w * 0.023}
          height={h * 0.075}
          rx={w * 0.008}
          fill={line}
          stroke="none"
        />
        <path
          d={`M ${-w * 0.02} ${h * 0.06} Q ${w * 0.317} ${-h * 0.035} ${w * 0.653} ${h * 0.06} Z`}
          fill={accent}
          strokeWidth={stroke}
        />
        <rect
          x={0}
          y={h * 0.825}
          width={w * 0.633}
          height={h * 0.04}
          fill={accent}
          strokeWidth={stroke * 0.6}
        />
        <path
          d={`M ${w * 0.15} ${h * 0.865} L ${w * 0.15} ${h} M ${w * 0.483} ${h * 0.865} L ${w * 0.483} ${h} M ${w * 0.1} ${h * 0.95} L ${w * 0.533} ${h * 0.95}`}
          fill="none"
          strokeWidth={stroke}
        />
        <rect
          x={w * 0.383}
          y={h * 0.895}
          width={w * 0.117}
          height={h * 0.035}
          rx={h * 0.01}
          fill={accent}
          strokeWidth={stroke * 0.5}
        />
        <line x1={w * 0.633} y1={h * 0.625} x2={w} y2={h * 0.5625} strokeWidth={stroke} />
      </g>
    ),
  },
  kieu: {
    label: "kiệu khiêng",
    sockets: ["prop"],
    aspect: 1.9,
    seat: { x: 0.464, y: 0.852 },
    // Đáy hộp là mặt dưới đòn gần: `props[].y` nâng cả kiệu lên vai người khiêng
    drawBehind: ({ w, h, accent, line, stroke }) => (
      <g>
        <line
          x1={0}
          y1={h * 0.957}
          x2={w}
          y2={h * 0.957}
          stroke={line}
          strokeWidth={stroke * 0.8}
          strokeLinecap="round"
        />
        <rect x={w * 0.321} y={h * 0.205} width={w * 0.358} height={h * 0.704} fill={accent} />
        <rect x={w * 0.345} y={h * 0.84} width={w * 0.238} height={h * 0.037} fill={line} />
      </g>
    ),
    draw: ({ w, h, color, accent, line, stroke }) => (
      <g stroke={line} strokeLinecap="round" strokeLinejoin="round">
        <path
          fillRule="evenodd"
          fill={color}
          strokeWidth={stroke}
          d={`M ${w * 0.31} ${h * 0.18} L ${w * 0.69} ${h * 0.18} L ${w * 0.69} ${h * 0.91} L ${w * 0.31} ${h * 0.91} Z
            M ${w * 0.369} ${h * 0.273} L ${w * 0.631} ${h * 0.273} L ${w * 0.631} ${h * 0.682} L ${w * 0.369} ${h * 0.682} Z`}
        />
        <path
          d={`M ${w * 0.369} ${h * 0.273} L ${w * 0.631} ${h * 0.273} L ${w * 0.631} ${h * 0.364} Q ${w * 0.571} ${h * 0.409} ${w * 0.5} ${h * 0.364} Q ${w * 0.429} ${h * 0.409} ${w * 0.369} ${h * 0.364} Z`}
          fill={accent}
          strokeWidth={stroke * 0.6}
        />
        <path
          d={`M ${w * 0.262} ${h * 0.18} Q ${w * 0.428} ${h * 0.068} ${w * 0.5} 0 Q ${w * 0.571} ${h * 0.068} ${w * 0.738} ${h * 0.18} Z`}
          fill={accent}
          strokeWidth={stroke}
        />
        <rect
          x={w * 0.28}
          y={h * 0.909}
          width={w * 0.44}
          height={h * 0.05}
          fill={accent}
          strokeWidth={stroke * 0.6}
        />
        <line x1={0} y1={h * 0.984} x2={w} y2={h * 0.984} strokeWidth={stroke * 1.2} />
      </g>
    ),
  },
  ...garmentParts(),
};

const BUILTIN = new Set(Object.keys(PARTS));
let repoParts: string[] = [];

/**
 * Đặt bộ phận vẽ code của repo video (`CODE_PARTS` ở entry `stickman.parts`), thay cả bộ đăng
 * ký lần trước. Trùng tên bộ phận của rig thì báo lỗi: hình `side` / `back` trong `views.ts`
 * tra theo tên, đè lên là góc nghiêng vẽ hình của bộ phận khác — docs/02-trang-phuc.md
 */
export function registerParts(parts: Record<string, PartDef> | undefined) {
  const entries = Object.entries(parts ?? {});
  for (const [name, def] of entries) {
    if (BUILTIN.has(name))
      throw new Error(`bộ phận "${name}" đã có trong rig — đổi tên, hay xoá khỏi CODE_PARTS`);
    const bad = partProblem(def);
    if (bad) throw new Error(`bộ phận "${name}": ${bad}`);
  }
  for (const n of repoParts) delete PARTS[n];
  Object.assign(PARTS, Object.fromEntries(entries));
  repoParts = entries.map(([n]) => n);
  return repoParts;
}

function partProblem(def: PartDef) {
  if (!def || typeof def !== "object") return "không phải object";
  if (typeof def.label !== "string") return "thiếu `label`";
  if (!Array.isArray(def.sockets) || !def.sockets.length) return "thiếu `sockets`";
  const odd = def.sockets.find((s) => s !== "prop" && !PIECE_KEYS.includes(s as PieceKey));
  if (odd) return `socket lạ "${odd}"`;
  if (!(def.aspect > 0)) return "`aspect` phải là số dương";
  if (typeof def.draw !== "function") return "thiếu `draw`";
  return null;
}

/** Lớp sau của thân đạo cụ, cùng cách suy `accent` như `Part`. */
export function PartBehind({
  draw,
  w,
  h,
  color,
  accent,
  line,
  stroke,
}: {
  draw: NonNullable<PartDef["drawBehind"]>;
  w: number;
  h: number;
  color: string;
  accent?: string;
  line: string;
  stroke: number;
}) {
  return <>{draw({ w, h, color, accent: accent ?? mix(color, "#000000", 0.3), line, stroke })}</>;
}

/** Tên các bộ phận cắm được vào socket `k`. */
export const partsFor = (k: PartSocket) =>
  Object.keys(PARTS).filter((n) => PARTS[n].sockets.includes(k));

/** Cấu hình lúc cắm bộ phận `name`: mục `parts` của danh mục đè lên `preset` của nó. */
export const partConfig = (name: string, catalog?: PieceCatalog): PieceConfig => ({
  ...PARTS[name]?.preset,
  ...catalog?.parts[name],
});

/** Vẽ một bộ phận vào hộp; `accent` bỏ trống thì lấy màu chính tối đi. */
export function Part({
  name,
  view = DEFAULT_VIEW,
  outline = false,
  art: suppliedArt,
  w,
  h,
  color,
  accent,
  line,
  stroke,
  yaw,
}: {
  name: string;
  /** Góc nhìn: có hình `side` / `rear` / `back` trong `views.ts` thì vẽ nó, hộp là hộp `VIEW_FRAME` */
  view?: View;
  outline?: boolean;
  art?: ViewArt;
  w: number;
  h: number;
  color: string;
  accent?: string;
  line: string;
  stroke: number;
  yaw?: number;
}) {
  const def = PARTS[name];
  if (!def) return null;
  const art = suppliedArt ?? viewArt(name, view);
  const socket = def.sockets[0];
  const draw =
    art && isViewSocket(socket)
      ? drawShapes(art.shapes, VIEW_FRAME[art.frame ?? socket])
      : (outline && def.outline) || (isProfile(view) && def.drawSide) || def.draw;
  return (
    <>{draw({ w, h, color, accent: accent ?? mix(color, "#000000", 0.3), line, stroke, yaw })}</>
  );
}
