import { describe, expect, it } from 'vitest';
import { fitBox, unmatte } from './portrait';

describe('fitBox', () => {
  const pts = [-1, -1, 1, 1];
  it('nới ngang quanh tâm cho đúng tỉ lệ', () => {
    const b = fitBox(pts, 2, 0);
    expect([b.x0, b.x1, b.y0, b.y1]).toEqual([-2, 2, -1, 1]);
  });
  it('lề theo phần cao, nới dọc quanh tâm', () => {
    const b = fitBox(pts, 0.5, 0.1);
    expect(b.x0).toBeCloseTo(-1.2);
    expect(b.y1 - b.y0).toBeCloseTo(4.8);
    expect(b.y0 + b.y1).toBeCloseTo(0);
  });
  it('có sàn thì mép dưới không lề, nới dọc dồn xuống', () => {
    const b = fitBox(pts, 1, 0.1, -0.5);
    expect(b.y1).toBeCloseTo(1.15);
    expect(b.y0).toBeCloseTo(1.15 - 2.3);
    expect(fitBox(pts, 4, 0.1, -0.5).y0).toBeCloseTo(-0.5);
  });
});

describe('unmatte', () => {
  it('tách alpha và màu thẳng từ nền đen và trắng', () => {
    // nét mực #201828 phủ 60% điểm ảnh, điểm thứ hai là nền trống, điểm thứ ba đục hẳn
    const ink = [0x20, 0x18, 0x28], a = 0.6;
    const black = new Uint8ClampedArray([...ink.map((c) => c * a), 255, 0, 0, 0, 255, 200, 100, 50, 255]);
    const white = new Uint8ClampedArray([...ink.map((c) => c * a + 255 * (1 - a)), 255, 255, 255, 255, 255, 200, 100, 50, 255]);
    unmatte(black, white);
    expect(black[3]).toBeCloseTo(a * 255, -1);
    ink.forEach((c, i) => expect(Math.abs(black[i] - c)).toBeLessThanOrEqual(1));
    expect(black[7]).toBe(0);
    expect([...black.slice(8)]).toEqual([200, 100, 50, 255]);
  });
});
