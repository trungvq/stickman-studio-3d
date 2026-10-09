import { Part, PARTS } from "@stickman3d/sketch";

/** Hộp vật có tâm tại gốc, ảnh giữ tỉ lệ như bộ phận SVG. */
export function Piece({ part, url, w, h }: { part?: string; url?: string; w: number; h: number }) {
  if (part) {
    const aspect = PARTS[part]?.aspect;
    if (!aspect) return null;
    const height = Math.min(h, w / aspect);
    const width = height * aspect;
    return (
      <g transform={`translate(${-width / 2} ${-height / 2})`}>
        <Part name={part} w={width} h={height} color="#ffffff" line="#1a1a1a" stroke={6} />
      </g>
    );
  }
  return url ? <image href={url} x={-w / 2} y={-h / 2} width={w} height={h} /> : null;
}
