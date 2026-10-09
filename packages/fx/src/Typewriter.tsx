import type { TypewriterData } from "./schema";
import { hash } from "./math";

/** Chữ theo từng ký tự người đọc thấy: dấu thanh rời (tổ hợp) đi cùng chữ cái đứng trước */
const glyphs = (s: string): string[] => s.match(/\P{M}\p{M}*/gu) ?? [];

/**
 * Mốc từng lần gõ phím và chữ đã hiện sau lần ấy — tầng tập neo tiếng phím vào đây, cùng một
 * nguồn với chỗ vẽ. `keys` khai thì trả nguyên; không thì mỗi ký tự của `text` (cả dấu cách)
 * là một phím, phím đầu `lead` giây sau `from`, cách nhau `every` lệch `jitter`.
 */
export function typewriterKeys(fx: TypewriterData): { t: number; text: string }[] {
  if (fx.keys) return fx.keys.map((k) => ({ t: k.at, text: k.text }));
  const g = glyphs(fx.text);
  let at = fx.from + fx.lead;
  return g.map((_, i) => {
    if (i) at += fx.every * (1 + fx.jitter * (2 * hash(i, 27.619) - 1));
    return { t: at, text: g.slice(0, i + 1).join("") };
  });
}

// `opacity` trên `tspan` không phải chỗ render nào cũng nhận; tô trong suốt thì chữ vẫn chiếm chỗ
const HIDE = { fillOpacity: 0, strokeOpacity: 0 };

// Nền phủ dư ra ngoài mọi khung, như vạch đất
const SPAN = 1e4;

/**
 * Thẻ chữ gõ dần. Dòng luôn là cả `text`: phần chưa gõ vẫn nằm đó trong suốt nên chữ đã gõ không
 * xô sang khi dài ra, và con trỏ là một ký tự chen giữa hai phần — đứng đúng sau chữ cuối mà
 * không cần đo bề ngang font. Mọi số đo chia `zoom` như `caption`.
 */
export function Typewriter({ fx, t, zoom = 1 }: { fx: TypewriterData; t: number; zoom?: number }) {
  if (t < fx.from || t >= fx.until) return null;
  const keys = typewriterKeys(fx);
  const shown = keys.filter((k) => t >= k.t).pop()?.text ?? "";
  const rest = glyphs(fx.text).slice(glyphs(shown).length).join("");
  const last = keys.length ? keys[keys.length - 1].t : fx.from;
  const lit = t < last + fx.settle || (t - last - fx.settle) % fx.blink < fx.blink / 2;
  const size = fx.size / zoom;
  const line = (fill: string, stroke: string, cursor: boolean) => (
    <text
      fontSize={size}
      fill={fill}
      stroke={stroke}
      strokeWidth={size * 0.13}
      strokeLinejoin="round"
      paintOrder="stroke"
      xmlSpace="preserve"
      style={{ whiteSpace: "pre" }}
    >
      <tspan>{shown}</tspan>
      {fx.cursor && <tspan {...(cursor && lit ? {} : HIDE)}>{fx.cursor}</tspan>}
      <tspan {...HIDE}>{rest}</tspan>
    </text>
  );
  return (
    <g>
      {fx.bg && <rect x={-SPAN} y={-SPAN} width={2 * SPAN} height={2 * SPAN} fill={fx.bg} />}
      <g
        transform={`translate(${fx.x} ${fx.y + size * 0.35})`}
        fontFamily={fx.font}
        fontWeight={900}
        textAnchor={fx.align}
      >
        {fx.shadow && (
          <g transform={`translate(${size * 0.05} ${size * 0.06})`}>
            {line(fx.shadow, fx.shadow, false)}
          </g>
        )}
        {line(fx.fill, fx.stroke, true)}
      </g>
    </g>
  );
}
