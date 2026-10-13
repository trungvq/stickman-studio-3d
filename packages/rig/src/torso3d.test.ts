import { describe, expect, it } from 'vitest';
import { TORSO_DEPTH } from './core/constants';
import { BadgeSchema, defaultCharacter, LettersSchema, OBI_KNOTS, ObiSchema, OpenSchema, PRINT_SHAPE_NAMES, PrintSchema, WrapSchema } from './core/schema';
import { GARMENT_STYLES, garmentOf, lerpAt, type Surface } from './core/torso';
import { signedVolume, wrapEdge } from './core/wrap';
import { PRINT_SHAPES, WAKABA } from './core/print';
import { torsoMesh } from './torso';

describe('thân áo dựng khối', () => {
  it('mảng tô nằm trên mặt khối, không tam giác nào cắt vào ruột', () => {
    const { rig } = defaultCharacter();
    for (const style of Object.keys(GARMENT_STYLES)) {
      const t = torsoMesh({ style } as Parameters<typeof torsoMesh>[0], rig);
      const depth = ([x, y, z]: number[]) => {
        const a = lerpAt(t.profile, y, 1, 0);
        return (Math.hypot(x / a, z / (TORSO_DEPTH * a)) - 1) * a;
      };
      for (const f of t.fills)
        for (let i = 0; i < f.tris.length; i += 3) {
          const [A, B, C] = [0, 1, 2].map((k) => f.pts[f.tris[i + k]]);
          for (const [u, v] of [[1 / 3, 1 / 3], [0.5, 0], [0, 0.5], [0.5, 0.5]])
            expect(depth([0, 1, 2].map((d) => A[d] + (B[d] - A[d]) * u + (C[d] - A[d]) * v)), style).toBeGreaterThan(-0.05);
        }
    }
  });
});

describe('áo cổ chéo dựng khối', () => {
  const { rig } = defaultCharacter();
  const full = { band: 6, under: 3, obi: { cord: 3, clasp: 6, knot: 'taiko' as const } };
  const mesh = (wrap: Record<string, unknown> = full, extra: Record<string, unknown> = {}) =>
    torsoMesh({ style: 'wrap', wrap, ...extra } as Parameters<typeof torsoMesh>[0], rig);
  const surface = (t: ReturnType<typeof mesh>) => ([x, y, z]: number[]) => {
    const a = lerpAt(t.profile, y, 1, 0);
    return (Math.hypot(x / a, z / (TORSO_DEPTH * a)) - 1) * a;
  };

  it('mép vạt trên đi từ bên cổ +x qua giữa ngực xuống −overlap rồi thẳng đứng', () => {
    const t = torsoMesh({ style: 'wrap' }, rig);
    const g = garmentOf({ style: 'wrap' });
    const s = { g, top: () => -120, a: () => 60 } as unknown as Surface;
    const e = wrapEdge(s, 22);
    expect(e.x(e.top)).toBeCloseTo(g.neck, 6);
    expect(Math.abs(e.x(e.cross))).toBeLessThan(1e-6);
    let prev = Infinity;
    for (let y = e.top; y < 200; y += 1) {
      expect(e.x(y)).toBeLessThanOrEqual(prev + 1e-9);
      expect(e.x(y)).toBeGreaterThanOrEqual(-22 - 1e-9);
      prev = e.x(y);
    }
    expect(e.x(200)).toBeCloseTo(-22, 6);
    expect(t.sheets.length).toBeGreaterThan(0);
  });

  it('dải cổ, cổ lót, da trong miệng cổ nằm ngoài mặt khối', () => {
    for (const hem of [-36, 5, 40]) {
      const t = mesh(full, { hem });
      for (const s of t.sheets) for (const col of s.grid) for (const p of col) expect(surface(t)(p), `${hem} ${s.color}`).toBeGreaterThan(-0.05);
    }
  });

  it('khối đai, dây, khoá, nút kín và quấn ra ngoài', () => {
    for (const knot of OBI_KNOTS) {
      const t = mesh({ ...full, obi: { ...full.obi, knot } });
      expect(t.solids.length, knot).toBe(3 + (knot === 'none' ? 0 : knot === 'bunko' ? 3 : 1));
      for (const s of t.solids) {
        expect(signedVolume(s.pts, s.tris), knot).toBeGreaterThan(0);
        const edges = new Map<string, number>();
        for (let i = 0; i < s.tris.length; i += 3)
          for (let k = 0; k < 3; k++) {
            const [a, b] = [s.tris[i + k], s.tris[i + ((k + 1) % 3)]];
            const key = a < b ? `${a} ${b}` : `${b} ${a}`;
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        expect([...edges.values()].every((n) => n === 2), knot).toBe(true);
      }
    }
    expect(mesh({}).solids).toHaveLength(0);
  });

  it('nút đai sau lưng, khoá đai trước bụng, cao ngang đai', () => {
    const t = mesh();
    const yc = -ObiSchema.parse({}).y * rig.height;
    const mid = (pts: number[][]) => pts.reduce((m, p) => m.map((v, i) => v + p[i] / pts.length), [0, 0, 0]);
    const [clasp, taiko] = t.solids.slice(-2).map((s) => mid(s.pts));
    expect(clasp[2]).toBeGreaterThan(0);
    expect(Math.abs(clasp[1] - yc)).toBeLessThan(1);
    expect(taiko[2]).toBeLessThan(0);
    expect(Math.min(...t.solids[t.solids.length - 1].pts.map((p) => p[1]))).toBeLessThan(yc - ObiSchema.parse({}).width / 2);
  });

  const nudge = (v: unknown, k: string): unknown =>
    typeof v === 'number' ? v * 1.5 + 0.7 : k === 'knot' ? 'bunko' : typeof v === 'string' || v === undefined ? '#123456' : v;
  const sample = { overlap: 22, band: 6, bandColor: '#aa0000', under: 3, underColor: '#ffeedd' };
  const obi = { color: '#00aa00', y: 52, width: 30, lift: 4, cord: 3, cordColor: '#0000aa', clasp: 6, claspColor: '#aaaa00', knot: 'kai', knotColor: '#00aaaa', knotX: 5 };
  for (const key of Object.keys(WrapSchema.shape).filter((k) => !['obi', 'open', 'letters'].includes(k)))
    it(`đọc \`wrap.${key}\``, () => {
      const w = { ...sample, obi };
      expect(JSON.stringify(mesh({ ...w, [key]: nudge(w[key as keyof typeof w], key) }))).not.toBe(JSON.stringify(mesh(w)));
    });
  for (const key of Object.keys(ObiSchema.shape))
    it(`đọc \`wrap.obi.${key}\``, () => {
      const o = { ...obi, [key]: nudge(obi[key as keyof typeof obi], key) };
      expect(JSON.stringify(mesh({ ...sample, obi: o }))).not.toBe(JSON.stringify(mesh({ ...sample, obi })));
    });
});

/** Khối kín: mỗi cạnh đúng hai tam giác, quấn ra ngoài */
const closedSolid = (s: { pts: number[][]; tris: number[] }) => {
  const edges = new Map<string, number>();
  for (let i = 0; i < s.tris.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const [a, b] = [s.tris[i + k], s.tris[i + ((k + 1) % 3)]];
      const key = a < b ? `${a} ${b}` : `${b} ${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  return [...edges.values()].every((n) => n === 2) && signedVolume(s.pts as never, s.tris) > 0;
};

describe('áo khoác vạt mở dựng khối', () => {
  const { rig } = defaultCharacter();
  const mesh = (wrap: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    torsoMesh({ style: 'wrap', wrap, ...extra } as Parameters<typeof torsoMesh>[0], rig);
  const surface = (t: ReturnType<typeof mesh>) => ([x, y, z]: number[]) => {
    const a = lerpAt(t.profile, y, 1, 0);
    return (Math.hypot(x / a, z / (TORSO_DEPTH * a)) - 1) * a;
  };
  const coat = { band: 8, bandColor: '#3a2a22', open: { gap: 10 } };

  it('dải cổ chạy suốt hai mép vạt, đối xứng, không chéo nhau: khe giữa rộng `gap` ở gấu', () => {
    const t = mesh(coat);
    const band = t.sheets.find((s) => s.color === '#3a2a22')!;
    const front = band.grid.map((col) => col[0]).filter((p) => p[2] > 0 && p[1] > -60);
    const left = front.filter((p) => p[0] > 0), right = front.filter((p) => p[0] < 0);
    expect(left.length).toBeGreaterThan(10);
    expect(right.length).toBe(left.length);
    for (const p of front) expect(Math.abs(p[0])).toBeGreaterThan(4.5);
    const low = (ps: number[][]) => ps.reduce((m, p) => (p[1] > m[1] ? p : m));
    expect(low(left)[0]).toBeCloseTo(5, 0);
    expect(low(right)[0]).toBeCloseTo(-5, 0);
    expect(low(left)[1]).toBeGreaterThan(-5);
  });

  it('dải cổ, áo trong, da, cổ lót áo trong nằm ngoài mặt khối', () => {
    for (const hem of [5, 12, 40])
      for (const open of [{ gap: 10 }, { gap: 18, cross: 24 }]) {
        const t = mesh({ band: 7, under: 3, open }, { hem });
        for (const s of t.sheets) for (const col of s.grid) for (const p of col) expect(surface(t)(p), `${hem} ${s.color}`).toBeGreaterThan(-0.05);
      }
  });

  it('áo trong màu nhấn phủ khe giữa hai mép vạt từ miệng cổ tới gấu', () => {
    const t = mesh(coat);
    const fill = t.sheets.find((s) => s.color === 'accent')!;
    const pts = fill.grid.flat();
    expect(Math.max(...pts.map((p) => p[1]))).toBeGreaterThan(-5);
    for (const p of pts.filter((q) => q[1] > -60)) expect(Math.abs(p[0])).toBeLessThan(6.5);
    expect(Math.max(...pts.map((p) => Math.abs(p[0])))).toBeGreaterThan(15);
  });

  it('áo trong cổ chéo: cổ lót lộ trong khe, không ra ngoài mép vạt', () => {
    const t = mesh({ band: 7, under: 3, underColor: '#fff8ec', open: { gap: 18, cross: 24 } });
    const under = t.sheets.filter((s) => s.color === '#fff8ec');
    expect(under).toHaveLength(2);
    const E = wrapEdge({ g: garmentOf({ style: 'wrap' }), top: () => t.profile[0][1], a: () => 60 } as unknown as Surface, -9);
    expect(E.x(0)).toBeGreaterThan(8.9);
    for (const s of under) for (const col of s.grid) for (const p of col) if (p[2] > 0 && p[1] > -80) expect(Math.abs(p[0])).toBeLessThan(10.6);
  });

  it('đai chỉ là cung giữa khe, khối kín; dây buộc trước ngực hai ống và một nút; không nút đai sau lưng', () => {
    const t = mesh({ band: 7, open: { gap: 18, tie: 2 }, obi: { cord: 3, clasp: 6, knot: 'taiko' } });
    expect(t.solids).toHaveLength(6);
    for (const s of t.solids) {
      expect(closedSolid(s)).toBe(true);
      expect(Math.min(...s.pts.map((p) => p[2]))).toBeGreaterThan(0);
    }
    const tie = t.solids.slice(0, 3).flatMap((s) => s.pts);
    expect(Math.min(...tie.map((p) => p[1]))).toBeLessThan(-80 + 3);
    expect(Math.max(...tie.map((p) => p[1]))).toBeGreaterThan(-80 - 3);
  });

  it('chữ dọc trên dải cổ: bên trái người mặc ở `+x`, cao quanh `letters.y`', () => {
    const t = mesh({ ...coat, letters: { left: '楓荘', right: '旅', y: 70 } });
    expect(t.prints).toHaveLength(2);
    const [l, r] = t.prints;
    const mid = (g: number[][][]) => g.flat().reduce((m, p) => m.map((v, i) => v + p[i] / g.flat().length), [0, 0, 0]);
    expect(mid(l.grid)[0]).toBeGreaterThan(5);
    expect(mid(r.grid)[0]).toBeLessThan(-5);
    expect(mid(l.grid)[1]).toBeCloseTo(-70, 0);
    expect(l.h).toBeCloseTo(2 * 0.8 * 8, 6);
    // cột đầu là bên trái người xem: mép vạt của dải bên trái người mặc, mép ngoài của dải bên phải
    expect(l.grid[0][0][0]).toBeLessThan(l.grid[l.grid.length - 1][0][0]);
    expect(r.grid[0][0][0]).toBeLessThan(r.grid[r.grid.length - 1][0][0]);
    expect(l.art).toMatchObject({ kind: 'text', text: '楓荘', vertical: true });
    expect(mesh({ band: 6, letters: { left: '楓' } }).prints).toHaveLength(1);
  });
});

describe('hình in và thẻ tên', () => {
  const { rig } = defaultCharacter();
  const mid = (g: number[][][]) => g.flat().reduce((m, p) => m.map((v, i) => v + p[i] / g.flat().length), [0, 0, 0]);

  it('hình sau lưng ở `z < 0`, trước ngực ở `z > 0`, cột đầu bên trái người xem', () => {
    for (const style of ['tshirt', 'shirt', 'wrap'] as const) {
      const t = torsoMesh({ style, prints: [PrintSchema.parse({ shape: 'maple', size: 50 }), PrintSchema.parse({ side: 'front', text: '祭り', size: 10, x: -10, y: 80 })] }, rig);
      const [back, front] = t.prints;
      expect(mid(back.grid)[2], style).toBeLessThan(0);
      expect(mid(front.grid)[2], style).toBeGreaterThan(0);
      expect(mid(front.grid)[0]).toBeCloseTo(-10, 0);
      expect(mid(front.grid)[1]).toBeCloseTo(-80, 0);
      expect([front.w, front.h]).toEqual([10, 20]);
      // nhìn từ sau, bên trái người xem là `+x`; từ trước là `−x`
      expect(back.grid[0][0][0]).toBeGreaterThan(back.grid[back.grid.length - 1][0][0]);
      expect(front.grid[0][0][0]).toBeLessThan(front.grid[front.grid.length - 1][0][0]);
      expect(back.art).toEqual({ kind: 'path', d: PRINT_SHAPES.maple, color: '#fff8ec' });
    }
  });

  it('thẻ tên trên ngực trái người mặc, mọi kiểu thân áo', () => {
    for (const style of Object.keys(GARMENT_STYLES) as (keyof typeof GARMENT_STYLES)[]) {
      const t = torsoMesh({ style, badge: BadgeSchema.parse({ wakaba: true, text: '陽太' }) }, rig);
      const b = t.prints[t.prints.length - 1];
      const c = mid(b.grid);
      expect(c[0], style).toBeGreaterThan(10);
      expect(c[2], style).toBeGreaterThan(0);
      expect(c[1], style).toBeCloseTo(-86, 0);
      expect(b.art).toMatchObject({ kind: 'badge', wakaba: true, text: '陽太' });
    }
  });

  it('hình có tên và dấu lá non là path khép kín trong hộp 0…100', () => {
    for (const d of [...PRINT_SHAPE_NAMES.map((k) => PRINT_SHAPES[k]), WAKABA.left, WAKABA.right]) {
      expect(d).toMatch(/^M[\d. ]+(?:[LA][\d. ]+)*Z/);
      for (const n of d.match(/-?[\d.]+/g)!.map(Number)) expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  const nudge = (v: unknown): unknown =>
    typeof v === 'number' ? v * 1.5 + 0.7 : typeof v === 'boolean' ? !v : typeof v === 'string' && v.startsWith('#') ? '#123456' : v === 'back' ? 'front' : v === 'serif' ? 'sans' : v === 'circle' ? 'ring' : v === undefined ? undefined : 'x';
  const print = { side: 'back', x: 3, y: 70, size: 30, color: '#ffffff', text: '祭', font: 'serif', vertical: true, path: 'M0 0L100 0L50 100Z', shape: 'circle', rotate: 0 };
  const badge = { x: 19, y: 86, width: 12, height: 6, round: 1.2, lift: 0.8, color: '#fff8ec', edge: '#3a2a22', text: '陽太', textColor: '#1c1c1e', wakaba: false };
  const shown = (g: Record<string, unknown>) => JSON.stringify(torsoMesh({ style: 'tshirt', ...g } as Parameters<typeof torsoMesh>[0], rig).prints);
  for (const key of Object.keys(PrintSchema.shape))
    it(`đọc \`prints[].${key}\``, () => {
      // `text` che `path`, `path` che `shape`: bỏ cái che để đo cái bị che
      const base = { ...print, ...(key === 'path' ? { text: undefined } : key === 'shape' ? { text: undefined, path: undefined } : {}) };
      const v = key === 'text' ? '祭り' : key === 'path' ? 'M0 0L100 100Z' : key === 'vertical' ? false : nudge(base[key as keyof typeof base]);
      expect(shown({ prints: [{ ...base, [key]: v }] })).not.toBe(shown({ prints: [base] }));
    });
  for (const key of Object.keys(BadgeSchema.shape))
    it(`đọc \`badge.${key}\``, () => {
      const v = key === 'text' ? '佐藤' : nudge(badge[key as keyof typeof badge]);
      expect(shown({ badge: { ...badge, [key]: v } })).not.toBe(shown({ badge }));
    });

  const wrapShown = (w: Record<string, unknown>) => JSON.stringify(torsoMesh({ style: 'wrap', wrap: w } as Parameters<typeof torsoMesh>[0], rig));
  const open = { gap: 12, cross: 20, tie: 2, tieY: 80, tieColor: '#ffffff' };
  for (const key of Object.keys(OpenSchema.shape))
    it(`đọc \`wrap.open.${key}\``, () => {
      const w = { band: 7, under: 3, open };
      expect(wrapShown({ ...w, open: { ...open, [key]: nudge(open[key as keyof typeof open]) } })).not.toBe(wrapShown(w));
    });
  const letters = { left: '楓荘', right: '旅館', color: '#ffffff', size: 6, y: 66, font: 'serif' };
  for (const key of Object.keys(LettersSchema.shape))
    it(`đọc \`wrap.letters.${key}\``, () => {
      const w = { band: 7, open: { gap: 10 }, letters };
      const v = key === 'left' || key === 'right' ? '祭' : nudge(letters[key as keyof typeof letters]);
      expect(wrapShown({ ...w, letters: { ...letters, [key]: v } })).not.toBe(wrapShown(w));
    });
});
