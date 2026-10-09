import { mix, type MarkFill, type TorsoPaths } from "@stickman3d/rig/core";

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
