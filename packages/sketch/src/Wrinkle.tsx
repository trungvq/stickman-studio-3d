import type { CharacterData } from "./schema";
import type { WrinkleKind } from "./types";

type Face = CharacterData["face"];

/** Nếp nhăn vẽ bằng code — dấu hiệu tuổi tác, cùng hệ toạ độ với mắt và mồm.
 *  Vẽ trên khối đầu, dưới mắt / mày / mồm; mảnh tóc vẽ sau nên che bớt nếp trán.
 *  `gap` là khoảng mắt chưa hẹp lại, `squeeze` là hệ số hẹp khi lắc — nhân vào
 *  mọi bề ngang, không thì nếp trán thò ra ngoài viền đầu lúc quay mặt. */
export function Wrinkle({
  wrinkle,
  cx,
  cy,
  gap,
  mouthCy,
  r,
  squeeze,
  clip,
}: {
  wrinkle: Face["wrinkle"];
  cx: number;
  cy: number;
  gap: number;
  mouthCy: number;
  r: number;
  squeeze: number;
  /** Cắt theo khối đầu: nếp trán dài hơn nửa bề ngang đầu ở độ cao đó thì thò ra ngoài */
  clip?: string;
}) {
  if (wrinkle.kind === "none") return null;
  const k = r / 65;
  const { color, width, dy } = wrinkle;
  const deep = wrinkle.kind === "deep";
  const y = cy + dy;
  /** Bề ngang tính từ tâm mặt */
  const X = (v: number) => cx + v * squeeze;
  const eye = gap / 2 + 7 * k;

  return (
    <g
      clipPath={clip && `url(#${clip})`}
      fill="none"
      stroke={color}
      strokeWidth={2.6 * k}
      strokeLinecap="round"
    >
      {/* Nếp trán: cung nông vồng lên, giữa lông mày (cy − 18) và đỉnh đầu (cy − 65) */}
      {(deep ? [-32, -46] : [-38]).map((b) => {
        const w = 34 * k * width;
        return (
          <path
            key={b}
            d={`M ${X(-w)} ${y + (b + 3) * k} Q ${cx} ${y + (b - 4) * k} ${X(w)} ${y + (b + 3) * k}`}
          />
        );
      })}
      {([-1, 1] as const).map((s) => (
        <g key={s}>
          {/* Chân chim: nan quạt ngắn từ đuôi mắt, xoè xuống — để ngang thành ria mèo */}
          {(deep ? [-6, 18, 42] : [12, 38]).map((a) => {
            const rad = (a * Math.PI) / 180;
            const len = 8.5 * k;
            return (
              <line
                key={a}
                x1={X(s * eye)}
                y1={y + 2 * k}
                x2={X(s * (eye + len * Math.cos(rad)))}
                y2={y + (2 + 8.5 * Math.sin(rad)) * k}
              />
            );
          })}
          {deep && (
            <>
              {/* Túi dưới mắt */}
              <path
                d={`M ${X(s * (gap / 2 - 8 * k))} ${y + 9 * k} Q ${X((s * gap) / 2)} ${y + 15 * k} ${X(s * (gap / 2 + 8 * k))} ${y + 9 * k}`}
              />
              {/* Pháp lệnh: từ cạnh mũi xoè ra ngoài rồi xuống quá mép mồm */}
              <path
                d={`M ${X(s * 7 * k)} ${y + 16 * k} Q ${X(s * 23 * k)} ${(y + mouthCy) / 2} ${X(s * 20 * k)} ${mouthCy + 6 * k}`}
              />
            </>
          )}
        </g>
      ))}
    </g>
  );
}

export const WRINKLE_KINDS: WrinkleKind[] = ["none", "light", "deep"];
