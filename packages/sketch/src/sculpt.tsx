import { useId } from "react";
import type { SculptPaths } from "@stickman3d/rig/core";

/**
 * Tóc dựng khối: nét dưới cùng, ruột tô đè lên nên chỉ còn nửa viền ngoài (0.7 nét người, docs/02); rồi nét ngôi.
 * Lớp `back` bị khoét theo viền đầu nở thêm nửa nét, để nét viền đầu nằm trên nó. Vẽ trong hệ nhóm đầu.
 */
export function SculptHair({
  paths,
  color,
  line,
  stroke,
}: {
  paths: SculptPaths;
  color: string;
  line: string;
  stroke: number;
}) {
  const id = `skull${useId().replace(/:/g, "")}`;
  const clip = paths.back ? `url(#${id})` : undefined;
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {clip && (
        <clipPath id={id}>
          <path d={`M-1e4 -1e4H1e4V1e4H-1e4Z${paths.head(stroke / 2)}`} clipRule="evenodd" />
        </clipPath>
      )}
      <path
        d={paths.backEdge}
        fill="none"
        stroke={line}
        strokeWidth={stroke * 1.4}
        clipPath={clip}
      />
      <path d={paths.capEdge} fill="none" stroke={line} strokeWidth={stroke * 1.4} />
      <path d={paths.back} fill={color} clipPath={clip} />
      <path d={paths.cap} fill={color} />
      {paths.lines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={line} strokeWidth={stroke} />
      ))}
      {paths.knot && (
        <>
          <path d={paths.knotEdge} fill="none" stroke={line} strokeWidth={stroke * 1.4} />
          <path d={paths.knot} fill={color} />
        </>
      )}
    </g>
  );
}
