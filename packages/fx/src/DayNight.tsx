import type { DayNightData } from "./schema";
import { clamp01, hash } from "./math";

// Màn đêm phủ dư ra ngoài mọi khung: camera lia ra ngoài sân khấu thì nó vẫn phải kín
const SPAN = 1e4;

/**
 * Ngày đêm trôi: mặt trời đi cung trong phần `day` của mỗi vòng, trời sập tối ở chạng vạng,
 * mặt trăng lưỡi liềm và sao đi nửa đêm còn lại rồi sáng. Vòng thứ mấy chỉ là phần nguyên của
 * giây đã trôi chia độ dài vòng — thuần theo `t`.
 */
export function DayNight({ fx, t }: { fx: DayNightData; t: number }) {
  if (t < fx.from || t > fx.to) return null;
  const u = ((t - fx.from) / (fx.to - fx.from)) * fx.days;
  const k = u - Math.floor(u);
  const at = (p: number) => ({
    x: fx.x0 + (fx.x1 - fx.x0) * p,
    y: fx.y0 + (fx.y1 - fx.y0) * p + fx.arc * Math.sin(Math.PI * p),
  });
  const dusk = Math.max(fx.dusk, 1e-3);
  const night =
    k < fx.day ? clamp01((k - (fx.day - dusk)) / dusk) : 1 - clamp01((k - (1 - dusk)) / dusk);
  const vis =
    fx.fade > 0 ? Math.min(clamp01((t - fx.from) / fx.fade), clamp01((fx.to - t) / fx.fade)) : 1;
  const sun = k < fx.day ? at(k / fx.day) : null;
  const moon = k >= fx.day ? at((k - fx.day) / (1 - fx.day)) : null;
  const left = Math.min(fx.x0, fx.x1);
  const w = Math.abs(fx.x1 - fx.x0);
  const top = Math.min(fx.y0, fx.y1) + Math.min(0, fx.arc) - fx.r;
  const h = Math.max(fx.y0, fx.y1) + Math.max(0, fx.arc) - top;
  const s = fx.r / 30;
  return (
    <g opacity={vis}>
      <rect
        x={-SPAN}
        y={-SPAN}
        width={2 * SPAN}
        height={2 * SPAN}
        fill={fx.night}
        opacity={fx.dark * night}
      />
      {night > 0 &&
        Array.from({ length: fx.stars }, (_, i) => (
          <circle
            key={i}
            cx={left + w * hash(i + 1, 17.31)}
            cy={top + h * hash(i + 1, 91.07)}
            r={(2.2 + 1.4 * hash(i + 1, 44.9)) * s}
            fill={fx.moon}
            opacity={night * (0.7 + 0.3 * Math.sin(t * 3 + 6 * hash(i, 5.3)))}
          />
        ))}
      {sun && (
        <circle
          cx={sun.x}
          cy={sun.y}
          r={fx.r}
          fill={fx.sun}
          stroke={fx.sunLine}
          strokeWidth={4 * s}
          opacity={1 - night}
        />
      )}
      {moon && (
        <path
          transform={`translate(${moon.x} ${moon.y}) scale(${s})`}
          d="M8 -30 A30 30 0 1 0 8 30 A24 24 0 1 1 8 -30Z"
          fill={fx.moon}
          stroke={fx.moonLine}
          strokeWidth={3}
          opacity={night}
        />
      )}
    </g>
  );
}
