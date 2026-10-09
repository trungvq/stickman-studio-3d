import type { ReactNode } from "react";
import type { FaceInk, FaceMark } from "@stickman3d/rig/core";

/** Thuộc tính vẽ theo thứ tự cố định, chỉ những cái nét khai */
function ink(m: FaceInk) {
  return {
    fill: m.fill,
    stroke: m.stroke,
    strokeWidth: m.strokeWidth,
    strokeLinecap: m.strokeLinecap,
    strokeLinejoin: m.strokeLinejoin,
  };
}

/** Dựng một nét của `core/face.ts` thành phần tử SVG; `clipId` là id vùng cắt của các nét `clipped` */
export function faceMark(m: FaceMark, clipId = "", key?: number | string): ReactNode {
  if ("clip" in m)
    return (
      <defs key={key}>
        <clipPath id={clipId}>
          <path d={m.clip} />
        </clipPath>
      </defs>
    );
  const paint = { ...ink(m), clipPath: m.clipped ? `url(#${clipId})` : undefined };
  if ("group" in m)
    return (
      <g key={key} {...paint}>
        {m.group.map((c, i) => faceMark(c, clipId, i))}
      </g>
    );
  if ("line" in m) {
    const [x1, y1, x2, y2] = m.line;
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} {...paint} />;
  }
  if ("ellipse" in m) {
    const [cx, cy, rx, ry] = m.ellipse;
    return <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} {...paint} />;
  }
  if ("rect" in m) {
    const [x, y, width, height] = m.rect;
    return <rect key={key} x={x} y={y} width={width} height={height} {...paint} />;
  }
  return <path key={key} d={m.path} {...paint} />;
}
