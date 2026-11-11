import { describe, expect, it } from "vitest";
import { bones3 } from "./arm3";
import { parseCharacter } from "./schema";
import { HEAD_ASPECT, HEADS, headDims, heightOfStature, NECK_OF_HEAD } from "./stature";
import { HUMAN_NECK_ROWS, humanNeckWidth } from "./torso";

const human = (o: { heads?: number; aspect?: number; jaw?: "v" | "square" } = {}) => ({
  form: "human" as const,
  ...o,
});

describe("chiều cao và cỡ đầu", () => {
  it("`stature` → `height` → đúng chiều cao, đúng số đầu, ở mọi số đầu và hình hàm", () => {
    for (const st of [1.5, 1.6, 1.7, 1.8])
      for (const heads of [5.5, 6, 7])
        for (const jaw of ["v", "square"] as const) {
          const h = heightOfStature(st, human({ heads, jaw }));
          const d = headDims(h, human({ heads, jaw }));
          expect(d.stature).toBeCloseTo(st, 9);
          expect((d.height * heads) / 2.5).toBeCloseTo(st, 9);
        }
  });

  it("đầu cầu giữ cỡ gốc; `stature` vẫn đặt đúng chiều cao", () => {
    const d = headDims(1);
    expect(d.k).toEqual([1, 1, 1]);
    expect(d.up).toBeCloseTo(0.08 + 0.09 + 0.384 * 1.04, 12);
    expect(headDims(heightOfStature(1.65), {}).stature).toBeCloseTo(1.65, 9);
  });

  it("số đầu, tỉ lệ ngang kẹp trong khoảng", () => {
    expect(headDims(1, human({ heads: 3 })).height).toBe(
      headDims(1, human({ heads: HEADS.min })).height,
    );
    expect(headDims(1, human({ heads: 12 })).height).toBe(
      headDims(1, human({ heads: HEADS.max })).height,
    );
    const w = (aspect: number) => headDims(1, human({ aspect }));
    expect(w(0.5).width / w(0.5).height).toBeCloseTo(HEAD_ASPECT.min, 12);
    expect(w(1.2).width / w(1.2).height).toBeCloseTo(HEAD_ASPECT.max, 12);
  });

  it("cổ theo bề ngang đầu: chỗ thon nhất bằng `NECK_OF_HEAD` bề ngang đầu", () => {
    const d = headDims(1.1, human());
    const thin = Math.min(...HUMAN_NECK_ROWS.map((r) => r[1]));
    expect(2 * thin * humanNeckWidth(d.width)).toBeCloseTo(NECK_OF_HEAD * d.width, 12);
  });

  it("`parseCharacter`: `rig.stature` đè `rig.height`; khung xương mang cỡ đầu", () => {
    const r = parseCharacter({
      rig: { stature: 1.8, height: 1 },
      head: { form: "human", heads: 7 },
    });
    expect(r.success).toBe(true);
    const c = r.data!;
    expect(c.rig.height).toBeCloseTo(heightOfStature(1.8, human({ heads: 7 })), 12);
    const B = bones3(c.rig.height, c.head);
    expect(B.headUp).toBe(headDims(c.rig.height, c.head).up);
    expect(B.headK[1]).toBeLessThan(1);
    expect(parseCharacter({ rig: { height: 1.08 } }).data!.rig.height).toBe(1.08);
  });
});
