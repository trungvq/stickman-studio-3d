import { describe, expect, it } from "vitest";

import { GLASSES_PRESETS, glassesPresetOf } from "./index";

describe("kính dựng khối", () => {
  it("nhận ra mẫu", () => {
    expect(glassesPresetOf(undefined)).toBe("round");
    expect(glassesPresetOf(GLASSES_PRESETS.bold.glasses)).toBe("bold");
    expect(glassesPresetOf({ ...GLASSES_PRESETS.sun.glasses, size: 0.3 })).toBeUndefined();
  });
});
