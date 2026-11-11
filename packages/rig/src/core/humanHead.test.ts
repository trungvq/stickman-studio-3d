import { describe, expect, it } from "vitest";
import { chibiShape, CHIBI, eyeShine } from "./face";
import { FACES, HEAD_SHAPE_DEFAULT, headShape, humanEar, humanHair, humanSkull, setHeadShape, withHeadShape } from "./humanHead";
import { parseCharacter } from "./schema";

const unit = (x: number, y: number, z: number): [number, number, number] => {
  const r = Math.hypot(x, y, z);
  return [x / r, y / r, z / r];
};

describe("đầu human", () => {
  const mid = (y: number) => humanSkull(unit(0, y, Math.sqrt(1 - y * y)));

  it("nửa trên giữ cao độ của mặt cầu: tóc và kính dựng khối ôm như đầu chibi", () => {
    for (const p of [unit(1, 0.3, 0.2), unit(0, 1, 0), unit(-0.4, 0.05, -0.9), unit(0.2, 0.6, 0.7)])
      expect(humanSkull(p)[1]).toBeCloseTo(p[1], 2);
  });

  it("đổi trơn qua xích đạo: vỏ viền không gãy ở chỗ nối", () => {
    const h = 1e-4;
    for (const [x, z] of [
      [1, 0],
      [0.6, 0.8],
      [-0.7, -0.7],
    ]) {
      // độ dốc trên và dưới xích đạo bằng nhau: không có góc gãy
      const [a, o, b] = [h, 0, -h].map((y) => humanSkull(unit(x, y, z)));
      for (let i = 0; i < 3; i++) expect(Math.abs((a[i] - o[i]) / h - (o[i] - b[i]) / h)).toBeLessThan(0.01);
    }
  });

  it("người thật: đường nghiêng mặt không phẳng, quai hàm chéo lên góc hàm, gáy có tóc tới cổ", () => {
    for (const face of ["western", "asian"] as const)
    for (const jaw of ["v", "square"] as const) {
      const old = setHeadShape({ face, jaw });
      if (face === "western") {
        // gờ mày nhô hơn hốc mắt, môi nhô hơn rãnh dưới môi, cằm nhô lại
        expect(mid(0.15)[2] - mid(-0.04)[2]).toBeGreaterThan(0.04);
        expect(mid(-0.58)[2] - mid(-0.66)[2]).toBeGreaterThan(0.03);
        expect(mid(-0.73)[2] - mid(-0.66)[2]).toBeGreaterThan(0.03);
      }
      // đáy cằm thấp hơn đáy cầu một chút; dưới tai (góc hàm) cao hơn đáy cằm nhiều
      const chin = Array.from({ length: 41 }, (_, i) => mid(-0.6 - i / 100)).reduce((a, b) => (b[1] < a[1] ? b : a));
      expect(chin[1]).toBeGreaterThan(-1.1);
      expect(chin[1]).toBeLessThan(-0.95);
      expect(humanSkull(unit(0.6, -0.8, -0.05))[1] - chin[1]).toBeGreaterThan(0.3);
      // chân tóc gáy (vĩ độ −22° phía sau) xuống tới ống cổ, gáy thu vào
      const nape = humanSkull(unit(0, -Math.sin((22 * Math.PI) / 180), -Math.cos((22 * Math.PI) / 180)));
      expect(nape[1]).toBeLessThan(-0.5);
      expect(nape[2]).toBeGreaterThan(-0.75);
      // nhìn ngang không dài như trứng nằm: tai ngay sau đường giữa đầu
      const [front, back] = [mid(0.15)[2], humanSkull([0, 0, -1])[2]];
      expect(back).toBeGreaterThan(-0.92);
      const ear = humanEar(1)[2];
      expect(ear).toBeLessThan((front + back) / 2);
      expect(ear).toBeGreaterThan((front + back) / 2 - 0.2);
      setHeadShape(old);
    }
  });

  it("kiểu mặt: mặc định `asian`; `asian` giữa mặt phẳng, cằm lùi sau môi nhiều hơn `western`", () => {
    expect(HEAD_SHAPE_DEFAULT.face).toBe("asian");
    expect(headShape().face).toBe("asian");
    expect(FACES.western).toEqual({});
    const lip = (y0: number, y1: number) => Math.max(...Array.from({ length: 21 }, (_, i) => mid(y0 + ((y1 - y0) * i) / 20)[2]));
    for (const jaw of ["v", "square"] as const) {
      // đỉnh môi (môi trên, môi dưới) và gò cằm, nhìn ngang
      const a = withHeadShape({ face: "asian", jaw }, () => ({ lip: lip(-0.62, -0.46), chin: lip(-0.82, -0.7), brow: mid(0.15)[2] - mid(-0.04)[2] }));
      const w = withHeadShape({ face: "western", jaw }, () => ({ lip: lip(-0.62, -0.46), chin: lip(-0.82, -0.7), brow: mid(0.15)[2] - mid(-0.04)[2] }));
      // gò cằm lùi sau đỉnh môi ở `asian` rõ hơn hẳn `western`
      expect(a.lip - a.chin).toBeGreaterThan(w.lip - w.chin + 0.02);
      expect(a.brow).toBeLessThan(w.brow / 2);
      // cằm nhìn thẳng rộng hơn: bề ngang ở đáy cằm
      const wide = () => humanSkull(unit(0.25, -0.95, 0.2))[0];
      expect(withHeadShape({ face: "asian", jaw }, wide)).toBeGreaterThan(withHeadShape({ face: "western", jaw }, wide));
    }
    // hàm `v` vẫn thon hơn `square` ở mặt `asian`
    const at = (jaw: "v" | "square") => withHeadShape({ face: "asian", jaw }, () => humanSkull(unit(0.5, -0.85, 0.2))[0]);
    expect(at("v")).toBeLessThan(at("square"));
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
    expect(r[0]).toBeLessThan(-0.85);
    expect(r[2]).toBeLessThan(0);
  });
});

describe("nét mặt chibi", () => {
  it("dời mắt xuống, giãn hai mắt, mồm gần mắt; giữ trường khác", () => {
    const s = chibiShape({ offsetY: 2, eyeGap: 26, mouthGap: 34, blush: 0 });
    expect(s).toEqual({
      offsetY: 2 + CHIBI.shift.offsetY,
      eyeGap: 26 + CHIBI.shift.eyeGap,
      mouthGap: 34 + CHIBI.shift.mouthGap,
      blush: 0,
    });
  });

  it("đốm sáng chỉ trên con ngươi đang mở, theo bên `only`", () => {
    const n = (m: ReturnType<typeof eyeShine>) => ("group" in m ? m.group.length : 0);
    expect(n(eyeShine("open", 0, 0, 40))).toBe(2);
    expect(n(eyeShine("open", 0, 0, 40, { only: -1 }))).toBe(1);
    expect(n(eyeShine("wink", 0, 0, 40))).toBe(1);
    expect(n(eyeShine("wink", 0, 0, 40, { only: -1 }))).toBe(0);
    expect(n(eyeShine("happy", 0, 0, 40))).toBe(0);
    expect(n(eyeShine("bulge", 0, 0, 40))).toBe(2);
    expect(n(eyeShine("wide", 0, 0, 40))).toBe(0);
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
