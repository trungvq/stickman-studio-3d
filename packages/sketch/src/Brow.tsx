import { BROW_ABOVE } from "./constants";
import type { BrowKind } from "./types";

const INK = "#22201d";

/** `lift` hạ cả hai nét xuống, `tilt` nhấc đầu trong lên, `arch` uốn cung */
type BrowShape = { lift: number; tilt: number; arch: number };
const BROWS: Record<BrowKind, BrowShape & { far?: BrowShape }> = {
  neutral: { lift: 0, tilt: 2, arch: 0 },
  flat: { lift: 0, tilt: 0, arch: 0 },
  lifted: { lift: -3, tilt: 0, arch: -1 },
  furrowed: { lift: 1, tilt: -4, arch: -1 },
  angry: { lift: 3, tilt: -7, arch: -2 },
  sad: { lift: -1, tilt: 7, arch: 2 },
  raised: { lift: -8, tilt: 2, arch: -4 },
  worried: { lift: 1, tilt: 3, arch: 1, far: { lift: 0, tilt: 2, arch: -1 } },
  skeptical: { lift: -4, tilt: 1, arch: -7, far: { lift: 3, tilt: -2, arch: 0 } },
};

/** Hai nét rời hẳn khỏi mắt; độ nghiêng của chúng làm gần hết biểu cảm */
export function Brow({
  kind,
  cx,
  cy,
  gap,
  only,
  squash = 1,
}: {
  kind: BrowKind;
  cx: number;
  cy: number;
  gap: number;
  /** Đầu `side`: chỉ vẽ nét bên này */
  only?: 1 | -1;
  /** Bóp ngang nét mày khi đầu quay */
  squash?: number;
}) {
  return (
    <g fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round">
      {([-1, 1] as const)
        .filter((s) => !only || s === only)
        .map((s) => {
          const shape = BROWS[kind];
          const { lift, tilt, arch } = s === 1 && shape.far ? shape.far : shape;
          const y = cy - BROW_ABOVE + lift;
          const ex = cx + (s * gap) / 2;
          return (
            <path
              key={s}
              d={`M ${ex + s * 8 * squash} ${y + tilt} Q ${ex} ${y + arch} ${ex - s * 8 * squash} ${y - tilt}`}
            />
          );
        })}
    </g>
  );
}
