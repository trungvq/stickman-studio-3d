import { describe, expect, it } from "vitest";
import { RIG } from "./constants";
import { reachAngles } from "./ik";

const D = Math.PI / 180;
/** Cổ tay FK trong mặt phẳng dọc của thân thẳng từ góc `[vai, khuỷu]` */
const wrist = ([a0, a1]: readonly number[]) => {
  const shY = -RIG.torso + 20;
  const e = [RIG.upperArm * Math.sin(a0 * D), shY + RIG.upperArm * Math.cos(a0 * D)];
  return [
    e[0] + RIG.foreArm * Math.sin((a0 + a1) * D),
    e[1] + RIG.foreArm * Math.cos((a0 + a1) * D),
  ];
};

// Góc tay suy từ đích là nền FK của đoạn hoà từ dáng buông (`stand-3d`, vai ~−5): góc vai ghi theo phía giơ về trước,
// không thì đoạn hoà tuyến tính kéo tay vòng ra sau lưng (gãi đầu: đích sau-trên tai cho −215 thay vì 145).
describe("reachAngles", () => {
  it("đích trên đầu hơi lùi sau: góc vai ghi phía trước", () => {
    const [a0] = reachAngles({ at: [-8, -165, 4], elbow: [0.2, -0.2, 1] });
    expect(a0).toBeGreaterThan(90);
    expect(a0).toBeLessThan(240);
    // nửa đường hoà từ dáng buông giơ về trước, không vòng ra sau
    expect((-5 + a0) / 2).toBeGreaterThan(0);
  });

  it("mọi đích trong tầm: vai trong [−120, 240), cổ tay FK vẫn tới đích", () => {
    for (const f of [-40, -10, 0, 20, 50])
      for (const y of [-190, -150, -125, -60, -20])
        for (const elbow of [
          undefined,
          [0.2, -0.2, 1] as [number, number, number],
          [-0.3, 0.5, 1] as [number, number, number],
        ]) {
          const a = reachAngles({ at: [f, y, 0], elbow });
          expect(a[0]).toBeGreaterThanOrEqual(-120);
          expect(a[0]).toBeLessThan(240);
          const [x, z] = wrist(a);
          expect(Math.hypot(x - f, z - y)).toBeLessThan(1e-6);
        }
  });
});
