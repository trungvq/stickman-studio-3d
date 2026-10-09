import { useId } from "react";
import { STUBBLE_OPACITY, type BeardPaths } from "@stickman3d/rig/core";

/**
 * Râu dựng khối: nét của chính hình vẽ dưới, ruột đè lên nên chỉ còn nửa viền ngoài theo đường bao,
 * không nét nào trong lòng râu. Phần sau mặt
 * phẳng giữa bị khoét theo viền đầu nở nửa nét. Lún phún thì chỉ một lớp màu mờ. Vẽ trong hệ nhóm đầu;
 * vẽ trong nhóm nét mặt đã gật thì `skull` đưa viền đầu từ nhóm đầu vào nhóm ấy.
 */
export function SculptBeard({
  paths,
  color,
  line,
  stroke,
  skull,
}: {
  paths: BeardPaths;
  color: string;
  line: string;
  stroke: number;
  skull?: string;
}) {
  const id = `beard${useId().replace(/:/g, "")}`;
  const clip = paths.back ? `url(#${id})` : undefined;
  if (paths.stubble)
    return <path d={paths.front} fill={color} fillOpacity={STUBBLE_OPACITY} stroke="none" />;
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {clip && (
        <clipPath id={id}>
          <path
            d={`M-1e4 -1e4H1e4V1e4H-1e4Z${paths.head(stroke / 2)}`}
            clipRule="evenodd"
            transform={skull}
          />
        </clipPath>
      )}
      <path d={paths.back} fill="none" stroke={line} strokeWidth={stroke * 1.4} clipPath={clip} />
      <path d={paths.front} fill="none" stroke={line} strokeWidth={stroke * 1.4} />
      <path d={paths.back} fill={color} clipPath={clip} />
      <path d={paths.front} fill={color} />
    </g>
  );
}
