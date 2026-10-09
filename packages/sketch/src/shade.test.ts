import { describe, expect, it } from "vitest";

import { SHADE_GAIN, SHADE_RIM } from "./constants";
import { litTransform, shadeBands } from "./shade";

/** Nửa rộng đầu ở cỡ chuẩn */
const HW = 65;
const RIM = SHADE_RIM * HW;
/** Độ trôi nét mặt của `face.turn` mặc định */
const TURN = 12;

describe("bề dày bóng ở hai mép", () => {
  it("nhìn thẳng thì hai bên bằng nhau, đúng một viền mỏng", () => {
    const [gay, mat] = shadeBands(HW, 0);
    expect(gay).toBeCloseTo(RIM, 12);
    expect(mat).toBeCloseTo(RIM, 12);
    expect(RIM).toBeCloseTo(3.9, 12);
  });

  it("quay mặt thì dồn hết về phía gáy", () => {
    const [gay, mat] = shadeBands(HW, TURN);
    expect(gay).toBeCloseTo(RIM + TURN, 12);
    expect(mat).toBe(0);
  });

  it("không âm với mọi độ trôi", () => {
    for (let dx = -200; dx <= 200; dx += 0.5) {
      const [gay, mat] = shadeBands(HW, dx);
      expect(gay).toBeGreaterThanOrEqual(0);
      expect(mat).toBeGreaterThanOrEqual(0);
    }
  });

  it("liên tục và đơn điệu khi liếc qua chính diện", () => {
    let truoc = shadeBands(HW, -30);
    for (let dx = -29; dx <= 30; dx += 1) {
      const nay = shadeBands(HW, dx);
      expect(nay[0]).toBeGreaterThanOrEqual(truoc[0]);
      expect(nay[1]).toBeLessThanOrEqual(truoc[1]);
      expect(Math.abs(nay[0] - truoc[0])).toBeLessThanOrEqual(SHADE_GAIN + 1e-9);
      expect(Math.abs(nay[1] - truoc[1])).toBeLessThanOrEqual(SHADE_GAIN + 1e-9);
      truoc = nay;
    }
  });
});

describe("transform của vùng sáng", () => {
  it("bóp ngang quanh tâm rồi dịch theo mặt", () => {
    const t = litTransform(HW, TURN);
    expect(t).toContain(`scale(${1 - SHADE_RIM} 1)`);
    expect(t).toContain("scale(0.94 1)");
    expect(t.startsWith("translate(77 0)")).toBe(true);
    expect(t).toContain(`translate(${-HW} 0)`);
  });

  it("nhìn thẳng thì tâm bóp đứng yên", () => {
    expect(litTransform(HW, 0)).toBe(`translate(65 0) scale(0.94 1) translate(-65 0)`);
  });
});
