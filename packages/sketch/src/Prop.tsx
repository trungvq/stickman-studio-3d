import { useId, type ReactNode } from "react";
import { SHADOW } from "./constants";
import { propBox, type PropData } from "./props";
import { rgb01 } from "./geometry";
import { Part, PartBehind, PARTS } from "./Parts";

export interface PropProps {
  prop: PropData;
  /** Ảnh thân, nếu `body.src` là `image` */
  url?: string;
  x?: number;
  /** Đường đất; bánh chạm đường này */
  groundY?: number;
  scale?: number;
  flip?: boolean;
  /**
   * Quãng đã lăn trên màn hình, đơn vị scene, dương là sang phải. Bánh quay
   * `roll / (r · scale)` rad — góc quay là hệ quả của chỗ đứng, không phải tham số.
   */
  roll?: number;
  /** Đậm của bóng dưới bánh; 0 = tắt */
  shadow?: number;
  /**
   * Chỉ vẽ một nửa: `back` là bóng và lớp sau của thân (`drawBehind`), `front` là thân và
   * bánh. `sceneOrder` tách ra hai nửa để kẹp người ngồi (`cast[].sit`) vào giữa; bỏ trống là vẽ cả.
   */
  part?: "back" | "front";
}

export function Prop({
  prop: p,
  url,
  x = 0,
  groundY = 0,
  scale = 1,
  flip = false,
  roll = 0,
  shadow = SHADOW,
  part,
}: PropProps) {
  const uid = useId();
  const tintId = `tintprop${uid.replace(/:/g, "")}`;
  const shadowId = `shadowprop${uid.replace(/:/g, "")}`;
  const b = p.body;
  const { x: bx, y: by, w, h, axleY, part: partName } = propBox(p);
  const hasBody = b.src === "image" ? !!url : !!partName;
  const back = part !== "front";
  const front = part !== "back";
  const tint = url && b.color ? `url(#${tintId})` : undefined;
  const [tr, tg, tb] = b.color ? rgb01(b.color) : [1, 1, 1];
  const dir = flip ? -1 : 1;

  const wheel = (cx: number, r: number) => {
    const { fill, spokes, stroke } = p.wheel;
    // rotate() của SVG dương là thuận kim đồng hồ trên màn hình, đúng chiều lăn sang phải
    const deg = ((dir * roll) / (r * scale)) * (180 / Math.PI);
    const cy = -r;
    const hub = Math.max(r * 0.16, stroke);
    return (
      <g transform={`rotate(${deg} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke={p.line} strokeWidth={stroke} />
        {Array.from({ length: spokes }, (_, i) => {
          const a = (i / spokes) * 2 * Math.PI;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * hub}
              y1={cy + Math.sin(a) * hub}
              x2={cx + Math.cos(a) * r}
              y2={cy + Math.sin(a) * r}
              stroke={p.line}
              strokeWidth={stroke * 0.55}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={cx} cy={cy} r={hub} fill={p.line} />
      </g>
    );
  };

  const rotated = (el: ReactNode) =>
    // Góc rig ngược dấu với rotate() của SVG; xoay quanh trục bánh sau, không quanh tâm hộp
    b.rotate ? <g transform={`rotate(${-b.rotate} 0 ${axleY})`}>{el}</g> : el;

  const behind = () => {
    const draw = partName ? PARTS[partName].drawBehind : undefined;
    if (!draw) return null;
    return rotated(
      <g transform={`translate(${bx} ${by})`}>
        <PartBehind
          draw={draw}
          w={w}
          h={h}
          color={b.color ?? "#ffffff"}
          accent={b.accent}
          line={p.line}
          stroke={p.wheel.stroke}
        />
      </g>,
    );
  };

  const body = () => {
    if (!hasBody) return null;
    const el = url ? (
      <image
        href={url}
        x={bx}
        y={by}
        width={w}
        height={h}
        preserveAspectRatio="none"
        filter={tint}
      />
    ) : (
      <g transform={`translate(${bx} ${by})`}>
        <Part
          name={partName as string}
          w={w}
          h={h}
          color={b.color ?? "#ffffff"}
          accent={b.accent}
          line={p.line}
          stroke={p.wheel.stroke}
        />
      </g>
    );
    return rotated(el);
  };

  return (
    <g transform={`translate(${x} ${groundY}) scale(${scale}) scale(${dir} 1)`}>
      <defs>
        {tint && (
          <filter id={tintId} colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values={`${tr} 0 0 0 0  0 ${tg} 0 0 0  0 0 ${tb} 0 0  0 0 0 1 0`}
            />
          </filter>
        )}
        {shadow > 0 && (
          <radialGradient id={shadowId}>
            <stop offset="0.45" stopColor={p.line} stopOpacity={shadow} />
            <stop offset="1" stopColor={p.line} stopOpacity={0} />
          </radialGradient>
        )}
      </defs>
      {back &&
        shadow > 0 &&
        (p.rear
          ? [[0, p.rear.r], ...(p.front ? [[p.front.x, p.front.r]] : [])]
          : [[bx + w / 2, w / 2]]
        ).map(([cx, r]) => (
          <ellipse key={cx} cx={cx} cy={0} rx={r} ry={r * 0.22} fill={`url(#${shadowId})`} />
        ))}
      {back && behind()}
      {front && body()}
      {front && p.front && wheel(p.front.x, p.front.r)}
      {front && p.rear && wheel(0, p.rear.r)}
    </g>
  );
}
