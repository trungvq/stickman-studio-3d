import type { FizzData } from "./schema";
import { clamp01, easeOut, hash } from "./math";

const SWELL = 0.25;
const POP = 0.75;
const RISE = 6;

/**
 * Sủi tăm. Bong bóng thứ `i` sinh ở `from + i × every`, sống `life` giây. Thưa dần bằng
 * cách bỏ bớt số thứ tự chứ không làm mờ đều tay — bọt lên ngắt quãng rồi mới hết.
 */
export function Fizz({ fx, t }: { fx: FizzData; t: number }) {
  if (t < fx.from) return null;
  const thin = fx.thin ?? fx.to;
  const first = Math.max(0, Math.ceil((t - fx.life - fx.from) / fx.every));
  const last = Math.floor((Math.min(t, fx.to) - fx.from) / fx.every);
  const bubbles = [];
  for (let i = first; i <= last; i++) {
    const born = fx.from + i * fx.every;
    const tau = t - born;
    if (tau < 0 || tau > fx.life) continue;
    const left = born > thin ? clamp01((fx.to - born) / (fx.to - thin)) : 1;
    if (hash(i + 7, 78.233) > left) continue;
    const j = hash(i, 78.233);
    const k = hash(i + 31, 78.233);
    const u = tau / fx.life;
    const swell = u < SWELL ? easeOut(u / SWELL) : 1;
    const pop = u > POP ? (u - POP) / (1 - POP) : 0;
    const r = fx.r * (0.6 + 0.8 * j) * (0.55 + 0.45 * left) * (swell + 0.6 * pop);
    // Dọc bóp lại theo mặt nước nhìn nghiêng, cùng tỉ lệ với vòng sóng
    const dx = (j - 0.5) * 2 * fx.spread;
    const dy = (k - 0.5) * fx.spread * 0.45;
    bubbles.push(
      <circle
        key={i}
        cx={fx.x + dx * (1 + 0.15 * u)}
        cy={fx.y + dy - RISE * u}
        r={r}
        fill={fx.foam}
        fillOpacity={0.55 * (1 - pop)}
        stroke={fx.line}
        strokeWidth={1.5}
        opacity={Math.min(1, tau / 0.06) * (1 - pop)}
      />,
    );
  }
  return <g>{bubbles}</g>;
}
