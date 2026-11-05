import { describe, expect, it } from 'vitest';
import { bibCovers } from './core/bib';
import { PANEL_LIFT } from './core/panel';
import { BibSchema, defaultCharacter } from './core/schema';
import { torsoMesh } from './torso';

// Yếm (`garment.bib`): mảng ngực, dây vai, vòng cạp dựng thành mảng áo trên thân, che nét và cúc của kiểu

const { rig } = defaultCharacter();
const bib = BibSchema.parse({});
type G = Parameters<typeof torsoMesh>[0];
/** Đỉnh của mảng yếm (nổi từ `PANEL_LIFT.bib`), hệ nhóm thân: `y` xuống, `z` ra trước ngực */
const bibPts = (g: G) => {
  const t = torsoMesh(g, rig);
  return t.fills.filter((f) => (f.decal?.lift ?? 0) >= PANEL_LIFT.bib - 1e-9).flatMap((f) => f.pts);
};

describe('yếm', () => {
  it('không khai thì thân áo y như cũ', () => {
    expect(torsoMesh({ style: 'shirt', bib: undefined } as G, rig)).toEqual(torsoMesh({ style: 'shirt' }, rig));
  });

  it('mảng ngực tới `top`, dây vắt qua vai xuống lưng, vòng cạp quanh khối tới gấu', () => {
    const pts = bibPts({ style: 'shirt', bib: {} } as G);
    expect(pts.length).toBeGreaterThan(0);
    const front = pts.filter((p) => p[2] > 0), back = pts.filter((p) => p[2] < 0);
    // mép trên mảng ngực ở `top`, dây lên cao hơn tới đỉnh vai, cả trước lẫn sau
    const highest = (list: number[][]) => Math.min(...list.map((p) => p[1]));
    expect(highest(front)).toBeLessThan(-bib.top - 20);
    expect(highest(back)).toBeLessThan(-bib.top - 20);
    // vòng cạp: dưới cạp có đỉnh ở cả hai bên sườn và giữa lưng
    const band = pts.filter((p) => p[1] > -bib.waist + 1);
    expect(band.some((p) => p[0] > 30)).toBe(true);
    expect(band.some((p) => p[0] < -30)).toBe(true);
    expect(band.some((p) => p[2] < 0 && Math.abs(p[0]) < 5)).toBe(true);
  });

  it('`band: false` không có vòng cạp; dây sau lưng chéo qua trục hay thẳng hai bên', () => {
    const pts = bibPts({ style: 'shirt', bib: { band: false } } as G);
    expect(pts.filter((p) => p[2] < 0 && p[1] > -bib.waist + 4)).toEqual([]);
    // ở lưng ngang `waist + 10`: dây chéo có đỉnh gần trục hơn dây thẳng
    const nearAxis = (back: 'cross' | 'straight') =>
      Math.min(...bibPts({ style: 'shirt', bib: { back } } as G).filter((p) => p[2] < 0 && Math.abs(p[1] + bib.waist + 10) < 4).map((p) => Math.abs(p[0])));
    expect(nearAxis('cross')).toBeLessThan(nearAxis('straight') - 5);
  });

  it('nét nẹp và cúc của sơ mi dưới yếm bị bỏ, phần trên yếm còn', () => {
    const plain = torsoMesh({ style: 'shirt' }, rig), worn = torsoMesh({ style: 'shirt', bib: {} } as G, rig);
    const under = (ys: number[]) => ys.filter((y) => y > -bib.top && y < 0).length;
    expect(under(plain.dots.map((d) => d.p[1]))).toBeGreaterThan(0);
    expect(under(worn.dots.map((d) => d.p[1]))).toBe(0);
    expect(worn.dots.length).toBeGreaterThan(0);
    const frontLow = (t: typeof plain) => t.lines.flatMap((l) => l.pts).filter((p) => p[2] > 0 && Math.abs(p[0]) < 5 && p[1] > -bib.top + 2 && p[1] < -bib.waist - 1).length;
    expect(frontLow(plain)).toBeGreaterThan(0);
    expect(frontLow(worn)).toBe(0);
  });

  it('`bibCovers`: trong mảng ngực, dưới cạp khi có vòng cạp', () => {
    expect(bibCovers(bib, 0, bib.top - 1)).toBe(true);
    expect(bibCovers(bib, bib.width + 1, bib.top - 1)).toBe(false);
    expect(bibCovers(bib, 0, bib.top + 1)).toBe(false);
    expect(bibCovers(bib, 40, 0)).toBe(true);
    expect(bibCovers({ ...bib, band: false }, 40, 0)).toBe(false);
  });
});
