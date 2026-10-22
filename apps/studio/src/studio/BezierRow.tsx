import { Hint, SliderRow } from "@/components/controls";
import { BEZIER_DEFAULT } from "@stickman3d/sketch";

type Bezier = [number, number, number, number];

const LABELS = ["x1", "y1", "x2", "y2"];

/** Bốn số `cubic-bezier` của `ease: "bezier"`, kẹp trong `[0, 1]` */
export function BezierRow({
  value,
  onChange,
}: {
  value: readonly number[] | undefined;
  onChange: (b: Bezier) => void;
}) {
  const b = (value ?? BEZIER_DEFAULT) as readonly number[];
  return (
    <>
      {LABELS.map((label, i) => (
        <SliderRow
          key={label}
          label={label}
          value={b[i]}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => {
            const next = [...b] as Bezier;
            next[i] = Math.min(1, Math.max(0, v));
            onChange(next);
          }}
        />
      ))}
      <Hint>Đường thời gian của đoạn tới mốc sau, như cubic-bezier của CSS.</Hint>
    </>
  );
}
