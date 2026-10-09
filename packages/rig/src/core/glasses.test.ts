import { describe, expect, it } from "vitest";

import { GLASSES_PRESETS, glassesPaths, glassesPresetOf } from "./index";
import { onSkull, turnPoint } from "./index";

const R = 65;
const EYE: [number, number] = [11.5, 0];
const points = (d: string) =>
  [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);

describe("kính dựng khối", () => {
  it("nhìn thẳng thì đối xứng qua trục giữa mặt, sau sọ chỉ còn móc càng ở hai bên tai", () => {
    const p = glassesPaths({}, { yaw: 0, pitch: 0 }, EYE, "round", 0, 0, R, R);
    const xs = points(p.rim).map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs), 0);
    expect(p.backFill).toBe("");
    for (const [x] of points(p.back)) expect(Math.abs(x)).toBeGreaterThan(R * 0.9);
  });

  it("mắt kính ôm đúng mắt chiếu từ sọ khi lắc gật", () => {
    const t = { yaw: 40, pitch: 20 };
    const p = glassesPaths({}, t, EYE, "round", 0, 0, R, R);
    const near = turnPoint(t, onSkull(-EYE[0], EYE[1]));
    expect(p.eyes[0][0]).toBeCloseTo(R * near[0], 6);
    expect(p.eyes[0][1]).toBeCloseTo(-R * near[1], 6);
  });

  it("lắc mạnh thì mắt kính xa quay ra sau sọ", () => {
    const p = glassesPaths({}, { yaw: 85, pitch: 0 }, EYE, "round", 0, 0, R, R);
    expect(p.back).not.toBe("");
    expect(glassesPaths({}, { yaw: 0, pitch: 0 }, EYE, "round", 0, 0, R, R).backFill).toBe("");
  });

  it("nét mặt phẳng: mắt kính dời tới chỗ mắt vẽ, đuôi càng vẫn bám sọ", () => {
    const t = { yaw: 30, pitch: 0 };
    const own = glassesPaths({}, t, EYE, "round", 0, 0, R, R);
    const fit = { x: own.eyes[0][0] / 2 + own.eyes[1][0] / 2 - 10, y: 5, profile: false };
    const moved = glassesPaths({}, t, EYE, "round", 0, 0, R, R, fit);
    expect(moved.eyes[0][0]).toBeCloseTo(own.eyes[0][0] - 10, 6);
    expect(moved.eyes[0][1]).toBeCloseTo(5, 6);
    const tail = (d: string) => points(d).at(-1)!;
    expect(tail(moved.back)).toEqual(tail(own.back));
  });

  it("3/4 sau: mắt kính vẽ như nghiêng, đuôi càng theo tai ở góc thật của sọ", () => {
    const fit = { x: R * 0.74, y: 0, profile: true, yaw: 90 };
    const at = (yaw: number) => glassesPaths({}, { yaw, pitch: 0 }, EYE, "round", 0, 0, R, R, fit);
    const side = at(90);
    const rear = at(120);
    expect(rear.eyes[0][0]).toBeCloseTo(side.eyes[0][0], 6);
    const tail = (d: string) => points(d).at(-1)![0];
    expect(tail(side.arms)).toBeLessThan(0);
    expect(tail(rear.arms) - tail(side.arms)).toBeGreaterThan(R * 0.4);
  });

  it("`place`: mắt kính dựng ở gật 0 rồi đi theo nét mặt, đuôi càng ở góc gật thật", () => {
    const fit = { x: R * 0.86, y: 0, profile: true, yaw: 90 };
    const shift = ([x, y]: [number, number]): [number, number] => [x - 7, y + 11];
    const flat = glassesPaths({}, { yaw: 120, pitch: 0 }, EYE, "round", 0, 0, R, R, fit);
    const t = { yaw: 120, pitch: 25 };
    const nod = glassesPaths({}, t, EYE, "round", 0, 0, R, R, { ...fit, place: shift });
    expect(nod.eyes[0]).toEqual(shift(flat.eyes[0]));
    const skull = glassesPaths({}, t, EYE, "round", 0, 0, R, R, fit);
    const tail = (d: string) => points(d).at(-1)!;
    expect(tail(nod.arms)).toEqual(tail(skull.arms));
  });

  it("nhận ra mẫu", () => {
    expect(glassesPresetOf(undefined)).toBe("round");
    expect(glassesPresetOf(GLASSES_PRESETS.bold.glasses)).toBe("bold");
    expect(glassesPresetOf({ ...GLASSES_PRESETS.sun.glasses, size: 0.3 })).toBeUndefined();
  });
});
