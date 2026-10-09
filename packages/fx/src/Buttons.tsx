import type { ButtonsData, PressData } from "./schema";
import { clamp01, easeOutCubic } from "./math";

/** Phóng vọt ra ở nửa đầu, mờ dần ở nửa sau */
const beat = (u: number) => ({
  k: u < 0.18 ? 0.6 + 0.55 * (u / 0.18) : 1.15 - 0.15 * clamp01((u - 0.18) / 0.22),
  o: u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45,
});

/** Mũi tên con trỏ, gốc ở đầu nhọn; vẽ phẳng như mọi thứ ở lớp UI */
export function Cursor({ size: S, line, fill }: { size: number; line: string; fill: string }) {
  return (
    <path
      d={`M 0 0 L 0 ${S * 1.25} L ${S * 0.32} ${S * 0.98} L ${S * 0.55} ${S * 1.42} L ${S * 0.72} ${S * 1.33} L ${S * 0.5} ${S * 0.9} L ${S * 0.9} ${S * 0.9} Z`}
      fill={fill}
      stroke={line}
      strokeWidth={4}
      strokeLinejoin="round"
    />
  );
}

function Press({ at, fx, t }: { at: PressData; fx: ButtonsData; t: number }) {
  const u = (t - at.t) / fx.life;
  if (u < 0 || u >= 1) return null;
  const { k, o } = beat(u);
  const s = fx.r * 0.46;
  return (
    <g transform={`translate(${at.x} ${at.y}) scale(${k})`} opacity={o}>
      <circle cx={0} cy={0} r={fx.r} fill={fx.fill} stroke={fx.line} strokeWidth={5} />
      {at.icon === "pause" ? (
        <>
          <rect x={-s * 0.62} y={-s} width={s * 0.44} height={s * 2} fill={fx.line} rx={2} />
          <rect x={s * 0.18} y={-s} width={s * 0.44} height={s * 2} fill={fx.line} rx={2} />
        </>
      ) : (
        <path d={`M ${-s * 0.42} ${-s} L ${s * 0.72} 0 L ${-s * 0.42} ${s} Z`} fill={fx.line} />
      )}
    </g>
  );
}

/** Con trỏ hiện `lead` giây trước, trượt tới chỗ bấm với đà giảm dần, nhún một cái đúng giây bấm, rồi mờ */
function Pointer({ at, fx, t }: { at: PressData; fx: ButtonsData; t: number }) {
  const c = at.cursor;
  if (!c) return null;
  const t0 = at.t - c.lead;
  const linger = 0.45;
  if (t < t0 || t > at.t + linger) return null;
  const arrive = at.t - 0.12;
  const u = easeOutCubic(clamp01((t - t0) / (arrive - t0)));
  const x = c.x + (at.x - c.x) * u;
  const y = c.y + (at.y - c.y) * u;
  const dc = t - at.t;
  const k =
    dc < 0
      ? 1
      : dc < 0.08
        ? 1 - 0.12 * (dc / 0.08)
        : dc < 0.16
          ? 0.88 + 0.12 * ((dc - 0.08) / 0.08)
          : 1;
  const o = dc < 0.2 ? 1 : 1 - clamp01((dc - 0.2) / (linger - 0.2));
  return (
    <g transform={`translate(${x} ${y})`} opacity={o}>
      <Cursor size={30 * k} line={fx.line} fill={fx.fill} />
    </g>
  );
}

/**
 * Nút PAUSE / PLAY và con trỏ: là UI, không thuộc thế giới truyện, nên vẽ phẳng — không nét
 * mực, không đổ bóng — và chỉ loé lên rồi tắt; trạng thái "đang dừng" do cảnh đứng im nói hộ.
 */
export function Buttons({ fx, t }: { fx: ButtonsData; t: number }) {
  return (
    <g>
      {fx.presses.map((p, i) => (
        <Press key={`p${i}`} at={p} fx={fx} t={t} />
      ))}
      {fx.presses.map((p, i) => (
        <Pointer key={`c${i}`} at={p} fx={fx} t={t} />
      ))}
    </g>
  );
}
