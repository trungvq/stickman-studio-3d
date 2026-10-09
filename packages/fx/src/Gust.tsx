import type { GustData, LeafData } from "./schema";
import { arcAt, chord, hash, type Pt } from "./math";

const WIND_W = 2.8;
const WIND_O = 0.6;
/** Vệt đuôi lá và vệt gió rời dài bao nhiêu phần đường, và lấy mấy mẫu */
const TRAIL = 0.055;
const STREAK = 0.16;
const SAMPLES = 10;
const D = 180 / Math.PI;

/** Cung có nhấp nhô: số sóng làm tròn theo từng cung để hai đầu luôn ở pha 0, vào vòng không giật */
const bow = (g: GustData, a: Pt, b: Pt, arc: number, s: number): Pt => {
  const p = arcAt(a, b, arc, s);
  const k = Math.max(1, Math.round((g.waves * chord(a, b)) / 1000));
  return { x: p.x, y: p.y + g.bob * Math.sin(2 * Math.PI * k * s) };
};

/**
 * Điểm trên đường gió ở phần `u` (0→1), lệch dọc `dy`. Ba đoạn nối liền: cung vào, một vòng
 * tròn bán kính `r` phía trên điểm lượn (vào ở đáy đang đi sang trái, tiếp tuyến hai đầu
 * trùng nhau), cung ra. `u` chia theo độ dài từng đoạn nên tốc độ đều. `loop: false` bỏ
 * vòng — cho vệt gió, vì gió thổi thẳng, cái vòng là của chiếc lá.
 */
export function gustAt(g: GustData, u: number, dy = 0, loop = true): Pt {
  const a = { x: g.x0, y: g.y0 };
  const l = { x: g.lx, y: g.ly };
  const b = { x: g.x1, y: g.y1 };
  const la = chord(a, l);
  const ll = loop ? 2 * Math.PI * g.r : 0;
  const lb = chord(l, b);
  const L = la + ll + lb;
  const fa = la / L;
  const fl = ll / L;
  let p: Pt;
  if (u < fa) p = bow(g, a, l, g.arcIn, u / fa);
  else if (u < fa + fl) {
    const th = Math.PI / 2 + (2 * Math.PI * (u - fa)) / fl;
    p = { x: g.lx + g.r * Math.cos(th), y: g.ly - g.r + g.r * Math.sin(th) };
  } else p = bow(g, l, b, g.arcOut, (u - fa - fl) / (1 - fa - fl));
  return { x: p.x, y: p.y + dy };
}

/** Một đoạn đường gió vẽ thành chuỗi nét ngắn đậm dần về phía đầu — SVG không tô gradient dọc đường cong */
function Streak({
  g,
  ua,
  ub,
  dy,
  opacity,
  width,
  loop,
}: {
  g: GustData;
  ua: number;
  ub: number;
  dy: number;
  opacity: number;
  width: number;
  loop: boolean;
}) {
  const segs = [];
  for (let k = 0; k < SAMPLES; k++) {
    const a = gustAt(g, ua + ((ub - ua) * k) / SAMPLES, dy, loop);
    const b = gustAt(g, ua + ((ub - ua) * (k + 1)) / SAMPLES, dy, loop);
    segs.push(
      <line
        key={k}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={g.line}
        strokeWidth={width}
        strokeLinecap="round"
        opacity={opacity * ((k + 1) / SAMPLES)}
      />,
    );
  }
  return <g>{segs}</g>;
}

/** Bầu dục nhọn hai đầu, hơi lệch, cuống ngắn, gân giữa; trục dài theo +x */
function Leaf({ s, fill, line }: { s: number; fill: string; line: string }) {
  return (
    <g>
      <path
        d={`M ${-s} 0 Q ${-s * 0.3} ${-s * 0.6} ${s * 0.15} ${-s * 0.5} Q ${s * 0.85} ${-s * 0.35} ${s} 0 Q ${s * 0.85} ${s * 0.35} ${s * 0.15} ${s * 0.5} Q ${-s * 0.3} ${s * 0.6} ${-s} 0 Z`}
        fill={fill}
        stroke={line}
        strokeWidth={Math.max(1.8, s * 0.13)}
        strokeLinejoin="round"
      />
      <path
        d={`M ${-s * 0.8} 0 Q ${s * 0.05} ${-s * 0.08} ${s * 0.85} 0`}
        fill="none"
        stroke={line}
        strokeWidth={Math.max(1.2, s * 0.08)}
        strokeLinecap="round"
        opacity={0.75}
      />
      <path
        d={`M ${-s} 0 q ${-s * 0.15} ${-s * 0.12} ${-s * 0.32} ${-s * 0.08}`}
        fill="none"
        stroke={line}
        strokeWidth={Math.max(1.6, s * 0.11)}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Gió và lá bay: lá không tự xoay, mũi lá theo tiếp tuyến — cái vòng là của đường bay */
export function Gust({ fx, t }: { fx: GustData; t: number }) {
  const tt = t - fx.from;
  if (tt < 0 || tt > fx.span + 1.5) return null;
  const streaks = [];
  for (let j = 0; j < fx.streaks; j++) {
    const start = (fx.span - fx.sweep) * ((j + 0.3 * hash(j, 39.347)) / fx.streaks);
    const head = (tt - start) / fx.sweep;
    if (head <= 0 || head - STREAK >= 1) continue;
    streaks.push(
      <Streak
        key={`streak-${j}`}
        g={fx}
        ua={Math.max(0, head - STREAK)}
        ub={Math.min(1, head)}
        dy={(hash(j + 7, 39.347) - 0.5) * 2 * fx.spread}
        opacity={WIND_O * (0.7 + 0.3 * hash(j + 19, 39.347))}
        width={WIND_W}
        loop={false}
      />,
    );
  }
  const leaves = fx.leaves.map((leaf: LeafData, i) => {
    const tau = tt - leaf.delay;
    if (tau < 0 || tau > leaf.dur) return null;
    const u = tau / leaf.dur;
    const p = gustAt(fx, u, leaf.dy);
    const q = gustAt(fx, u + 0.003, leaf.dy);
    const heading = Math.atan2(q.y - p.y, q.x - p.x) * D;
    const wob = Math.sin(2 * Math.PI * leaf.flutter * tau + i * 2.1);
    const sy = 0.5 + 0.5 * Math.abs(Math.cos(Math.PI * leaf.flutter * tau + i));
    return (
      <g key={`leaf-${i}`}>
        {u > TRAIL * 0.3 && (
          <g>
            <Streak
              g={fx}
              ua={u - TRAIL}
              ub={u - 0.008}
              dy={leaf.dy - leaf.size * 0.7}
              opacity={WIND_O * 0.8}
              width={WIND_W * 0.8}
              loop
            />
            <Streak
              g={fx}
              ua={u - TRAIL * 0.8}
              ub={u - 0.012}
              dy={leaf.dy + leaf.size * 0.75}
              opacity={WIND_O * 0.6}
              width={WIND_W * 0.7}
              loop
            />
          </g>
        )}
        <g transform={`translate(${p.x} ${p.y}) rotate(${heading + 18 * wob}) scale(1 ${sy})`}>
          <Leaf s={leaf.size} fill={leaf.fill} line={fx.line} />
        </g>
      </g>
    );
  });
  return (
    <g>
      {streaks}
      {leaves}
    </g>
  );
}
