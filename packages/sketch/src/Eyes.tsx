import { SIDE_EYE_OVAL } from "./constants";
import type { EyeKind } from "./types";

const INK = "#22201d";
const WHITE = "#f7f2e6";

/** Bán kính con ngươi lúc mở thường; các kiểu khác đo theo nó */
export const EYE_R = 6;
const R = EYE_R;

/** Hai chấm mắt, cách nhau `gap`; `wide` là kiểu duy nhất có lòng trắng */
export function Eyes({
  kind,
  cx,
  cy,
  gap,
  only,
  squash,
}: {
  kind: EyeKind;
  cx: number;
  cy: number;
  gap: number;
  /** Đầu `side`: chỉ vẽ nét bên này */
  only?: 1 | -1;
  /** Bóp ngang hình mắt khi đầu quay; bỏ trống thì `side` bóp `SIDE_EYE_OVAL` */
  squash?: number;
}) {
  // Đầu `side`: hình tròn của mắt bóp ngang thành oval; nét vẽ thì giữ nguyên
  const k = squash ?? (only ? SIDE_EYE_OVAL : 1);
  const stroke = { fill: "none", stroke: INK, strokeWidth: 4, strokeLinecap: "round" } as const;
  return (
    <g>
      {([-1, 1] as const)
        .filter((s) => !only || s === only)
        .map((s) => {
          const x = cx + (s * gap) / 2;
          switch (kind) {
            case "squeezed":
              return (
                <path
                  key={s}
                  d={`M ${x + s * 6} ${cy - 5} L ${x - s * 5} ${cy} L ${x + s * 6} ${cy + 5}`}
                  {...stroke}
                  strokeLinejoin="round"
                />
              );
            case "droopy":
              return (
                <path
                  key={s}
                  d={`M ${x - s * 7} ${cy - 3} Q ${x} ${cy} ${x + s * 7} ${cy + 3} Q ${x} ${cy + 10} ${x - s * 7} ${cy - 3} Z`}
                  fill={INK}
                />
              );
            case "wink":
              return s === -1 ? (
                <path
                  key={s}
                  d={`M ${x - 7} ${cy + 2} Q ${x} ${cy - 3} ${x + 7} ${cy + 2}`}
                  {...stroke}
                />
              ) : (
                <ellipse key={s} cx={x} cy={cy} rx={R * k} ry={R} fill={INK} />
              );
            case "shut":
              return <line key={s} x1={x - 7} y1={cy} x2={x + 7} y2={cy} {...stroke} />;
            case "wide":
              return (
                <g key={s}>
                  <ellipse
                    cx={x}
                    cy={cy}
                    rx={R * 2 * k}
                    ry={R * 2}
                    fill={WHITE}
                    stroke={INK}
                    strokeWidth={3}
                  />
                  <ellipse cx={x} cy={cy} rx={R * 0.85 * k} ry={R * 0.85} fill={INK} />
                </g>
              );
            case "squint":
              // Mi trên sụp xuống: chỉ còn nửa dưới con ngươi
              return (
                <path
                  key={s}
                  d={`M ${x - R * k} ${cy} A ${R * k} ${R} 0 0 0 ${x + R * k} ${cy} Z`}
                  fill={INK}
                />
              );
            case "happy":
              return (
                <path
                  key={s}
                  d={`M ${x - 8} ${cy + 4} Q ${x} ${cy - 7} ${x + 8} ${cy + 4}`}
                  {...stroke}
                />
              );
            default:
              return <ellipse key={s} cx={x} cy={cy} rx={R * k} ry={R} fill={INK} />;
          }
        })}
    </g>
  );
}
