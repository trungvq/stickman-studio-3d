import { describe, expect, it } from "vitest";

import { SCULPT_PRESETS, chain, sculptPresetOf } from "./index";
import type { Vec3 } from "./index";

const points = (d: string) =>
  [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);

describe("tóc dựng khối", () => {
  it("nối nét: đoạn chung đỉnh thành một polyline, đoạn trùng vẽ một lần", () => {
    const at = (x: number, y: number): Vec3 => [x, y, 0];
    const d = chain([
      [at(0, 0), at(1, 0)],
      [at(2, 0), at(1, 0)],
      [at(1, 0), at(0, 0)],
      [at(2, 0), at(2, 1), at(3, 1)],
    ]);
    expect(d.split("M").length - 1).toBe(1);
    expect(points(d)).toHaveLength(5);
  });

  it("nhận ra mẫu từ bộ số", () => {
    expect(sculptPresetOf(undefined)).toBe("short");
    expect(sculptPresetOf(SCULPT_PRESETS.spiky.sculpt)).toBe("spiky");
    expect(sculptPresetOf({ ...SCULPT_PRESETS.spiky.sculpt, spike: 1.3 })).toBeUndefined();
  });
});
