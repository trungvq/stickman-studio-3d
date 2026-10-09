import type { CaptionData } from "./schema";
import { clamp01, pop } from "./math";

/** Quãng bật vào và quãng tắt dần */
const IN = 0.14;
const OUT = 0.2;

/**
 * Chữ diễn burn lên hình, nằm trong `viewBox` nên bám nhân vật khi máy quay đổi cỡ — vì
 * thế mọi số đo chia cho `zoom`. Ruột tô đè viền (`paint-order: stroke`): viền đối xứng
 * giữ chữ nổi trên mọi mảng nền mà không ngoạm vào nét, dấu tiếng Việt không bị nuốt.
 */
export function Caption({ fx, t, zoom = 1 }: { fx: CaptionData; t: number; zoom?: number }) {
  const size = fx.size / zoom;
  const gap = size * 1.4;
  const first = fx.lines[0].at;
  const end = fx.blow ? fx.blow.at + fx.blow.dur : fx.until;
  if (t < first || t > end) return null;
  const b = fx.blow;
  const blown = b && t > b.at ? clamp01((t - b.at) / b.dur) : 0;
  const dx = b ? (b.dx / zoom) * blown * blown : 0;
  const dy = b ? (b.dy / zoom) * blown * blown : 0;
  const tilt = fx.tilt + blown * 22;
  const opacity = b ? 1 - blown * blown : clamp01((fx.until - t) / OUT);
  const scale = pop(clamp01((t - first) / IN));
  return (
    <g
      transform={`translate(${fx.x + dx} ${fx.y + dy}) rotate(${tilt}) scale(${scale})`}
      opacity={opacity}
      fontFamily={fx.font}
      fontWeight={900}
      textAnchor={fx.align}
      stroke={fx.stroke}
      // Chỉ nửa bề dày lộ ra ngoài nét chữ vì ruột tô đè lên
      strokeWidth={size * 0.16}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {fx.lines.map((l, i) =>
        t < l.at ? null : (
          <g key={i} transform={`translate(0 ${i * gap}) scale(${pop(clamp01((t - l.at) / IN))})`}>
            <text fontSize={size} fill={fx.fill}>
              {l.text}
            </text>
          </g>
        ),
      )}
    </g>
  );
}
