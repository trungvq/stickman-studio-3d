import { describe, expect, it } from "vitest";
import { chibiShape, CHIBI, eyeShine } from "./face";
import { humanEar, humanHair, humanSkull } from "./humanHead";
import { parseCharacter } from "./schema";

const unit = (x: number, y: number, z: number): [number, number, number] => {
  const r = Math.hypot(x, y, z);
  return [x / r, y / r, z / r];
};

describe("đầu human", () => {
  it("nửa trên trùng mặt cầu: tóc và kính dựng khối khỏi làm lại", () => {
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

  it("chibi: má phồng ngang miệng, cằm chữ U rộng vừa chạm cổ áo, gáy thu vào", () => {
    const cheek = humanSkull(unit(Math.sqrt(0.75), -0.5, 0));
    expect(cheek[0]).toBeGreaterThan(Math.sqrt(0.75) * 1.05);
    // cằm thấp hơn đáy cầu một chút: cao hơn thì lộ khúc cổ trên cổ áo
    const chin = humanSkull([0, -1, 0]);
    expect(chin[1]).toBeGreaterThan(-1.06);
    expect(chin[1]).toBeLessThan(-1.01);
    expect(chin[2]).toBeLessThan(0.15);
    // đáy cằm phẳng: cách giữa cằm một phần tư bề ngang mà gần như cùng cao độ
    const side = humanSkull(unit(0.31, -0.95, 0));
    expect(side[0]).toBeGreaterThan(0.2);
    expect(side[1] - chin[1]).toBeLessThan(0.05);
    const nape = humanSkull(unit(0, -1, -1));
    expect(nape[2]).toBeGreaterThan(-Math.SQRT1_2 * 0.8);
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

describe("nét mặt chibi", () => {
  it("dời mắt xuống, giãn hai mắt, mồm gần mắt; giữ trường khác", () => {
    const s = chibiShape({ offsetY: 2, eyeGap: 26, mouthGap: 34, turn: 12 });
    expect(s).toEqual({
      offsetY: 2 + CHIBI.shift.offsetY,
      eyeGap: 26 + CHIBI.shift.eyeGap,
      mouthGap: 34 + CHIBI.shift.mouthGap,
      turn: 12,
    });
  });

  it("đốm sáng chỉ trên con ngươi đang mở, theo bên `only`", () => {
    const n = (m: ReturnType<typeof eyeShine>) => ("group" in m ? m.group.length : 0);
    expect(n(eyeShine("open", 0, 0, 40))).toBe(2);
    expect(n(eyeShine("open", 0, 0, 40, { only: -1 }))).toBe(1);
    expect(n(eyeShine("wink", 0, 0, 40))).toBe(1);
    expect(n(eyeShine("wink", 0, 0, 40, { only: -1 }))).toBe(0);
    expect(n(eyeShine("happy", 0, 0, 40))).toBe(0);
  });
});

describe("schema", () => {
  it("trường của người 3D mặc đồ có mặc định: không khai là người que như cũ", () => {
    const r = parseCharacter({});
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.head.form).toBe("sphere");
    expect(r.data.palette.clad).toBe(false);
    expect(r.data.palette.sleeveLength).toBe(1);
    expect(r.data.palette.trouserLength).toBe(1);
    expect(r.data.palette.shoe).toMatch(/^#/);
  });
});
