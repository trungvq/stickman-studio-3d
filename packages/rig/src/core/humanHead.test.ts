import { describe, expect, it } from "vitest";
import { HUMAN_HEAD, humanEar, humanHair, humanSkull, noseY } from "./humanHead";
import { parseCharacter } from "./schema";

const unit = (x: number, y: number, z: number): [number, number, number] => {
  const r = Math.hypot(x, y, z);
  return [x / r, y / r, z / r];
};

describe("đầu human", () => {
  it("nửa trên ngoài sống mũi trùng mặt cầu: tóc và kính dựng khối khỏi làm lại", () => {
    for (const p of [unit(1, 0.3, 0.2), unit(0, 1, 0), unit(-0.4, 0.05, -0.9), unit(0.2, 0.6, 0.7)])
      humanSkull(p).forEach((v, i) => expect(v).toBeCloseTo(p[i], 12));
  });

  it("đổi trơn qua xích đạo: vỏ viền không gãy ở chỗ nối", () => {
    for (const [x, z] of [
      [1, 0],
      [0.6, 0.8],
      [-0.7, -0.7],
    ]) {
      // dưới xích đạo một đoạn ε thì độ dời cỡ ε²: không có góc gãy
      const p = unit(x, -1e-4, z);
      humanSkull(p).forEach((v, i) => expect(Math.abs(v - p[i])).toBeLessThan(1e-6));
    }
  });

  it("nửa dưới thon vào quai hàm, dài hơn cầu, cằm ra trước, gáy thu vào", () => {
    const chin = humanSkull([0, -1, 0]);
    expect(chin[1]).toBeLessThan(-1.05);
    expect(chin[2]).toBeGreaterThan(0.1);
    const jaw = humanSkull(unit(1, -1, 0));
    expect(jaw[0]).toBeLessThan(Math.SQRT1_2 * 0.95);
    const nape = humanSkull(unit(0, -1, -1));
    expect(nape[2]).toBeGreaterThan(-Math.SQRT1_2 * 0.8);
  });

  it("gờ mũi nhô ở đúng cao độ chóp mũi, không lan ra má", () => {
    const y = noseY(0, 34);
    const tip = humanSkull(unit(0, y, Math.sqrt(1 - y * y)), y);
    const plain = Math.sqrt(1 - y * y);
    expect(tip[2] - plain).toBeGreaterThan(HUMAN_HEAD.nose.h * 0.8);
    const cheek = unit(0.5, y, Math.sqrt(1 - 0.25 - y * y));
    expect(humanSkull(cheek, y)[2]).toBeCloseTo(humanSkull(cheek, 5)[2], 6);
  });

  it("tóc dời theo sọ bên dưới, giữ bề dày", () => {
    for (const d of [unit(0.3, -0.6, -0.7), unit(0.8, -0.3, 0.2), unit(0, 0.9, 0.3)]) {
      const hair = humanHair([d[0] * 1.08, d[1] * 1.08, d[2] * 1.08]);
      const skull = humanSkull(d);
      hair.forEach((v, i) => expect(v - skull[i]).toBeCloseTo(0.08 * d[i], 12));
    }
  });

  it("tai hai bên đối xứng, nằm trên má sau tâm sọ", () => {
    const [r, l] = [humanEar(-1), humanEar(1)];
    expect(r[0]).toBeCloseTo(-l[0], 12);
    expect(r[0]).toBeLessThan(-0.9);
    expect(r[2]).toBeLessThan(0);
  });
});

describe("schema", () => {
  it("dáng đầu có mặc định: không khai là người que như cũ", () => {
    const r = parseCharacter({});
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.head.form).toBe("sphere");
    expect(r.data.palette.clad).toBe(false);
  });
});
