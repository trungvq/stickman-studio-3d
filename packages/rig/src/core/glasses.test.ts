import { describe, expect, it } from "vitest";

import { adultEyeBox, FACE_R, GLASSES_PRESETS, glassesFrame, glassesPresetOf, GlassesSchema, humanHair, onSkull, withHeadShape } from "./index";

describe("kính dựng khối", () => {
  it("nhận ra mẫu", () => {
    expect(glassesPresetOf(undefined)).toBe("round");
    expect(glassesPresetOf(GLASSES_PRESETS.bold.glasses)).toBe("bold");
    expect(glassesPresetOf({ ...GLASSES_PRESETS.sun.glasses, size: 0.3 })).toBeUndefined();
  });

  it("đầu human: mắt kính ôm trọn mắt vẽ, tâm trước đúng chỗ mắt, càng móc xuống sau tai", () => {
    withHeadShape({ face: "anime", jaw: 0.3 }, () => {
      const g = GlassesSchema.parse({ shape: "rect" });
      const b = adultEyeBox({ eyeScale: 0.9, eyeWidth: 1.3 });
      const box = { inner: b.inner / FACE_R, outer: b.outer / FACE_R, up: b.up / FACE_R, down: b.down / FACE_R };
      const eye: [number, number] = [24, -12];
      const ear = { lon: 95, lat: -11.5, top: 0, half: 7 };
      const f = glassesFrame(g, eye, { box, surface: humanHair, ear });
      for (const [i, s] of [-1, 1].entries()) {
        const xs = f.lenses[i].map((p) => p[0] * s);
        const e = humanHair(onSkull(s * eye[0], eye[1]));
        // mép trong, mép ngoài mắt kính ngoài hộp mắt (mắt kính ngả về tai nên mép ngoài co bề ngang chút ít)
        expect(Math.min(...xs)).toBeLessThan(e[0] * s - box.inner);
        expect(Math.max(...xs)).toBeGreaterThan(e[0] * s + box.outer * 0.97);
        // móc cuối càng ở sau tai và thấp hơn đỉnh chân tai
        const tip = f.arms[i].at(-1)!;
        expect(Math.atan2(tip[0] * s, tip[2]) * (180 / Math.PI)).toBeGreaterThan(ear.lon);
        expect(tip[1]).toBeLessThan(Math.sin(ear.lat * (Math.PI / 180)));
      }
    });
  });
});
