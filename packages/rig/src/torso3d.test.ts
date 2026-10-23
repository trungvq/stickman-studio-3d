import { describe, expect, it } from 'vitest';
import { BadgeSchema, defaultCharacter, GarmentSchema, LettersSchema, OBI_KNOTS, ObiSchema, OpenSchema, PanelSchema, PatternSchema, PRINT_SHAPE_NAMES, PrintSchema, WrapSchema } from './core/schema';
import { flattenPath, PANEL_LIFT } from './core/panel';
import { TORSO_DEPTH } from './core/constants';
import { CHEST, CLOTH, GARMENT_STYLES, garmentOf, lerpAt, profile, torsoPaths, type Surface } from './core/torso';
import { cladProfile, cladThigh, roots3, THIGH_CLEAR } from './core/act3';
import { signedVolume, wrapEdge } from './core/wrap';
import { PRINT_SHAPES, WAKABA } from './core/print';
import { torsoMesh, type TorsoMesh } from './torso';

/** Mặt khối cách điểm bao nhiêu, quy về nửa rộng (âm là trong ruột): nửa trước bề sâu `front`, nửa sau `depth` */
const surfaceOf = (t: TorsoMesh) => ([x, y, z]: number[]) => {
  const a = lerpAt(t.profile, y, 1, 0);
  const d = lerpAt(t.profile.map(([, py], i) => [(z > 0 ? t.front : t.depth)[i], py]), y, 1, 0);
  return (Math.hypot(x / a, z / d) - 1) * a;
};

describe('thân áo dựng khối', () => {
  it('mảng tô nằm trên mặt khối, không tam giác nào cắt vào ruột', () => {
    const { rig } = defaultCharacter();
    for (const style of Object.keys(GARMENT_STYLES)) {
      const t = torsoMesh({ style } as Parameters<typeof torsoMesh>[0], rig);
      const depth = surfaceOf(t);
      for (const f of t.fills)
        for (let i = 0; i < f.tris.length; i += 3) {
          const [A, B, C] = [0, 1, 2].map((k) => f.pts[f.tris[i + k]]);
          for (const [u, v] of [[1 / 3, 1 / 3], [0.5, 0], [0, 0.5], [0.5, 0.5]])
            expect(depth([0, 1, 2].map((d) => A[d] + (B[d] - A[d]) * u + (C[d] - A[d]) * v)), style).toBeGreaterThan(-0.05);
        }
    }
  });

  it('nhìn nghiêng: ngực dốc liền từ mép trên tới ngang ngực, lưng đầy sớm hơn, vai mỏng; dưới ngang ngực theo bề rộng', () => {
    const { rig } = defaultCharacter();
    const yB = -CHEST.at * 120 * rig.height;
    for (const style of Object.keys(GARMENT_STYLES))
      for (const clad of [false, true]) {
        const g = { style } as Parameters<typeof torsoMesh>[0];
        const room = clad ? roots3(g, rig, { clad: true, sleeve: 15, trouser: 17 }).room : undefined;
        const t = torsoMesh(g, rig, room);
        const flat = clad
          ? cladProfile(profile(garmentOf(g, true), rig, rig.stroke / 2).pts, room!)
          : { pts: t.profile, depth: t.profile.map(([a]) => TORSO_DEPTH * a) };
        const flatAt = (y: number) => lerpAt(flat.pts.map(([, py], i) => [flat.depth[i], py]), y, 1, 0);
        const yS = t.profile.reduce((m, p) => (p[0] > m[0] ? p : m))[1];
        t.profile.forEach(([a, y], i) => {
          const at = `${style} ${clad} y ${y.toFixed(1)}`;
          if (y >= yB) {
            expect(t.front[i], at).toBeCloseTo(flatAt(y), 6);
            expect(t.depth[i], at).toBeCloseTo(flatAt(y), 6);
            return;
          }
          expect(t.profile[i + 1][1] - y, at).toBeLessThanOrEqual(CHEST.step + 1e-9);
          expect(t.front[i], at).toBeLessThanOrEqual(flatAt(y) + 1e-9);
          expect(t.depth[i], at).toBeGreaterThanOrEqual(t.front[i] - 1e-9);
          // mặt trước không gãy: không lùi quá dốc của bề rộng, không vát ra trước quá một px mỗi px xuống
          const dy = t.profile[i + 1][1] - y;
          const lean = (flatAt(t.profile[i + 1][1]) - flatAt(y)) / dy;
          expect((t.front[i + 1] - t.front[i]) / dy, at).toBeGreaterThanOrEqual(Math.min(0, lean) - 1e-6);
          expect((t.front[i + 1] - t.front[i]) / dy, at).toBeLessThan(1);
          if (Math.abs(y - yS) < 1e-9) expect(t.front[i] / a, at).toBeLessThan(0.75);
        });
      }
  });
});

describe('áo cổ chéo dựng khối', () => {
  const { rig } = defaultCharacter();
  const full = { band: 6, under: 3, obi: { cord: 3, clasp: 6, knot: 'taiko' as const } };
  const mesh = (wrap: Record<string, unknown> = full, extra: Record<string, unknown> = {}) =>
    torsoMesh({ style: 'wrap', wrap, ...extra } as Parameters<typeof torsoMesh>[0], rig);
  const surface = surfaceOf;

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
  const surface = surfaceOf;
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

describe('mảng áo, hoạ tiết, áo trong', () => {
  const { rig } = defaultCharacter();
  const mesh = (g: Record<string, unknown>) => torsoMesh(GarmentSchema.parse(g), rig);
  const depth = surfaceOf;

  it('JSON không khai trường mới ra y hệt; mảng chỉ là lưới decal thêm vào', () => {
    for (const style of Object.keys(GARMENT_STYLES)) {
      const plain = torsoMesh({ style } as Parameters<typeof torsoMesh>[0], rig);
      // hình in của kiểu chỉ là nét nhạt (`ink`)
      expect(plain.fills.every((f) => !f.decal || f.ink !== undefined), style).toBe(true);
      const withPanel = mesh({ style, panels: [{ fill: '#ff0000', pts: [[-10, 80], [10, 80], [10, 60], [-10, 60]] }] });
      expect(withPanel.fills.length, style).toBe(plain.fills.length + 1);
      expect(withPanel.fills.at(-1)!.decal, style).toBeDefined();
    }
  });

  it('sọc cả thân nằm trên mặt khối, nhiều sọc gộp một lưới', () => {
    const t = mesh({ style: 'tshirt', panels: [{ pattern: { width: 5, gap: 5 } }] });
    const decals = t.fills.filter((f) => f.decal);
    expect(decals).toHaveLength(1);
    const ys = decals[0].pts.map((p) => p[1]);
    expect(ys.reduce((a, b) => Math.max(a, b)) - ys.reduce((a, b) => Math.min(a, b))).toBeGreaterThan(100);
    // lưới gọn: cả thân sọc dưới hai vạn đỉnh
    expect(decals[0].pts.length).toBeLessThan(20000);
    for (const p of decals[0].pts) expect(depth(t)(p)).toBeGreaterThan(0.2);
    // quanh cả khối: có điểm ở lưng
    expect(decals[0].pts.some((p) => p[2] < -10)).toBe(true);
  });

  it('kẻ ô có ô chéo màu riêng, chấm bi là nhiều mảnh tròn', () => {
    const check = mesh({ style: 'shirt', panels: [{ pattern: { kind: 'check', color: '#c23b3b', cross: '#7a1f1f' } }] });
    expect(new Set(check.fills.filter((f) => f.decal).map((f) => f.fill))).toEqual(new Set(['#c23b3b', '#7a1f1f']));
    const dots = mesh({ style: 'tshirt', panels: [{ side: 'front', pts: [[-20, 100], [20, 100], [20, 40], [-20, 40]], pattern: { kind: 'dots', width: 4, gap: 4 } }] });
    const tris = dots.fills.find((f) => f.decal)!.tris.length / 3;
    expect(tris).toBeGreaterThan(12 * 20);
  });

  it('`clip: "neck"` chỉ giữ miệng cổ, `body` chỉ giữ dưới viền cổ', () => {
    const g = { style: 'tshirt', neckline: 'v', neckFront: 40 };
    const neck = mesh({ ...g, panels: [{ fill: 'skin', clip: 'neck' }] }).fills.find((f) => f.decal)!;
    const body = mesh({ ...g, panels: [{ fill: '#ff0000', clip: 'body' }] }).fills.find((f) => f.decal)!;
    const top = Math.min(...neck.pts.map((p) => p[1]));
    expect(Math.max(...neck.pts.filter((p) => p[2] > 0).map((p) => p[1])) - top).toBeGreaterThan(30);
    expect(Math.max(...neck.pts.map((p) => p[1])) - top).toBeLessThan(50);
    // đáy chữ V: dưới đó chỉ còn mảng `body`
    expect(Math.min(...body.pts.filter((p) => Math.abs(p[0]) < 2 && p[2] > 0).map((p) => p[1])) - top).toBeGreaterThan(30);
  });

  it('mảng da nổi cao hơn vỏ viền cổ, nét viền không chạy dọc mép khối', () => {
    const skin = mesh({ style: 'tshirt', panels: [{ fill: 'skin', side: 'both', mirror: true, from: 'neck', line: 0.6, pts: [[25, -14], [80, -14], [80, 46], [42, 44], [33, 30], [27, 12], [25, 0]] }] });
    const f = skin.fills.find((x) => x.decal)!;
    expect(f.decal!.lift).toBeGreaterThanOrEqual(PANEL_LIFT.skin);
    expect(skin.lines.length).toBeGreaterThan(0);
    const whole = mesh({ style: 'tshirt', panels: [{ fill: '#ff0000', line: 0.6 }] });
    expect(whole.lines).toHaveLength(mesh({ style: 'tshirt' }).lines.length);
    const cut = mesh({ style: 'tshirt', panels: [{ fill: '#ff0000', line: 0.6, clip: 'body' }] });
    expect(cut.lines.length).toBeGreaterThan(whole.lines.length);
  });

  it('áo trong blazer, cardigan liền từ mép trên khối; viền tắt mặc định', () => {
    for (const style of ['blazer', 'cardigan'] as const) {
      const t = mesh({ style });
      const inner = t.fills.find((f) => f.fill === 'accent')!;
      expect(Math.min(...inner.pts.map((p) => p[1])), style).toBeLessThan(t.profile[0][1] + 1);
      expect(t.lines.length, style).toBe(mesh({ style, inner: { line: 0 } }).lines.length);
      expect(mesh({ style, inner: { line: 0.45 } }).lines.length, style).toBe(t.lines.length + 1);
    }
  });

  it('`inner` đổi màu áo trong, thêm và bỏ cà vạt', () => {
    const police = mesh({ style: 'blazer', inner: { color: '#A9C8E8', tie: { color: '#1A2236' } } });
    expect(police.fills.map((f) => f.fill)).toEqual(expect.arrayContaining(['#A9C8E8', '#1A2236']));
    expect(mesh({ style: 'suit' }).fills.map((f) => f.fill)).toEqual(['line']);
    expect(mesh({ style: 'suit', inner: { color: '#ffffff' } }).fills.map((f) => f.fill)).toEqual(['#ffffff', 'line']);
    expect(mesh({ style: 'suit', inner: { tie: false } }).fills).toHaveLength(0);
    const tie = (t: Record<string, unknown>) => mesh({ style: 'suit', inner: { tie: t } }).fills[0].pts;
    const width = (pts: number[][]) => Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    expect(width(tie({ width: 1.5 }))).toBeGreaterThan(width(tie({})) * 1.3);
  });

  it('`neckline` đè dáng cổ của kiểu, `marks: false` bỏ đặc điểm dán', () => {
    const v = mesh({ style: 'tshirt', neckline: 'v', neckFront: 30 });
    const u = mesh({ style: 'tshirt', neckFront: 30 });
    expect(JSON.stringify(v.sheets)).not.toBe(JSON.stringify(u.sheets));
    const bare = mesh({ style: 'shirt', marks: false });
    expect([bare.lines.length, bare.dots.length, bare.fills.length]).toEqual([0, 0, 0]);
    expect(bare.sheets.length).toBe(mesh({ style: 'shirt' }).sheets.length);
  });

  const nudge = (v: unknown): unknown =>
    typeof v === 'number' ? v * 1.5 + 0.7 : typeof v === 'boolean' ? !v : typeof v === 'string' && v.startsWith('#') ? '#123456' : v;
  const panel = { fill: '#ff0000', side: 'front', pts: [[-10, 80], [12, 84], [8, 50]], path: 'M10 10L90 20L50 90Z', x: 3, y: 70, size: 30, width: 20, height: 24, rotate: 10, from: 'hip', mirror: false, clip: 'none', line: 0.5, pattern: { width: 3, gap: 3 }, layer: 'over' };
  const other: Record<string, unknown> = { side: 'back', pts: [[-10, 80], [20, 84], [8, 40]], path: 'M0 0L100 0L50 100Z', from: 'neck', clip: 'neck', pattern: { width: 3, gap: 3, angle: 90 }, layer: 'under', mirror: true };
  const shown = (p: Record<string, unknown>) => JSON.stringify(mesh({ style: 'tshirt', panels: [p] }));
  for (const key of Object.keys(PanelSchema.shape))
    it(`đọc \`panels[].${key}\``, () => {
      // `path` che `pts`: đo `pts` thì bỏ `path`
      const base = key === 'pts' ? { ...panel, path: undefined } : key === 'size' ? { ...panel, width: undefined, height: undefined } : key === 'clip' ? { ...panel, y: 130 } : panel;
      const v = key in other ? other[key] : nudge(base[key as keyof typeof base]);
      expect(shown({ ...base, [key]: v })).not.toBe(shown(base));
    });
  const pattern = { kind: 'stripes', color: '#ffffff', width: 4, gap: 5, angle: 20, offset: 1, cross: '#000000' };
  for (const key of Object.keys(PatternSchema.shape))
    it(`đọc \`panels[].pattern.${key}\``, () => {
      const base = { ...pattern, ...(key === 'cross' ? { kind: 'check' } : {}) };
      const v = key === 'kind' ? 'dots' : nudge(base[key as keyof typeof base]);
      const p = (pt: unknown) => ({ side: 'front', pts: [[-20, 100], [20, 100], [20, 40], [-20, 40]], pattern: pt });
      expect(shown(p({ ...base, [key]: v }))).not.toBe(shown(p(base)));
    });

  it('path SVG: lệnh tuyệt đối, tương đối, cong', () => {
    expect(flattenPath('M0 0H10V10H0Z')).toEqual([[[0, 0], [10, 0], [10, 10], [0, 10]]]);
    expect(flattenPath('m5 5 l10 0 l0 10z M50 50 L60 50 L60 60')).toEqual([[[5, 5], [15, 5], [15, 15]], [[50, 50], [60, 50], [60, 60]]]);
    const q = flattenPath('M0 0Q50 100 100 0Z')[0];
    expect(q.at(-1)).toEqual([100, 0]);
    expect(Math.max(...q.map((p) => p[1]))).toBeCloseTo(50, 0);
  });

  it('2D bỏ qua mảng áo, không ném lỗi', () => {
    const c = defaultCharacter();
    const at = (garment: Record<string, unknown>) => {
      const d = structuredClone(c);
      d.pieces.torso = { ...d.pieces.torso, src: 'sculpt', garment: GarmentSchema.parse(garment) };
      return torsoPaths(d, 20, 6).lines;
    };
    expect(at({ style: 'shirt', panels: [{ fill: 'skin', clip: 'neck', pattern: { kind: 'dots' } }] })).toEqual(at({ style: 'shirt' }));
  });

  it('màu tô chỉ nhận từ khoá hay mã màu', () => {
    expect(PanelSchema.safeParse({ fill: 'red' }).success).toBe(false);
    expect(PanelSchema.safeParse({ fill: '#A9C8E8' }).success).toBe(true);
    expect(PanelSchema.safeParse({ path: 'M0 0A1 1 0 0 1 5 5Z' }).success).toBe(false);
  });
});

describe('dáng thân chung của thân trần và áo', () => {
  const base = defaultCharacter().rig;
  const rigs = [base, { ...base, height: 1.06, shoulderHalf: 40, hipHalf: 21 }, { ...base, height: 0.9, shoulderHalf: 36, hipHalf: 22 }];
  const limbs = [[15, 17], [17, 19]] as const;
  const build = (style: 'bare' | 'tshirt', rig: typeof base, [sleeve, trouser]: readonly [number, number]) => {
    const g = GarmentSchema.parse({ style });
    const r = roots3(g, rig, { clad: true, sleeve, trouser });
    return { r, t: torsoMesh(g, rig, r.room) };
  };
  for (const rig of rigs)
    for (const w of limbs)
      it(`rig ${rig.height}/${rig.shoulderHalf}/${rig.hipHalf}, tay chân ${w}: bề ngang, gốc vai, cổ lộ ra như áo phông`, () => {
        const [bare, tee] = [build('bare', rig, w), build('tshirt', rig, w)];
        expect(Math.abs(bare.r.shoulder[0] - tee.r.shoulder[0]) * 100).toBeLessThanOrEqual(CLOTH + 0.5);
        expect(Math.abs(bare.r.shoulder[1] - tee.r.shoulder[1]) * 100).toBeLessThan(1);
        // mép trên cùng độ cao, miệng cổ nằm trong cổ người 3D: cổ lộ ra bằng nhau
        expect(bare.t.profile[0][1]).toBeCloseTo(tee.t.profile[0][1], 6);
        expect(bare.t.profile[0][0]).toBeLessThan(13.5);
        for (let y = bare.t.profile[0][1] + 4; y < -5; y += 6) {
          const d = lerpAt(tee.t.profile, y, 1, 0) - lerpAt(bare.t.profile, y, 1, 0);
          expect(d, `y ${y}`).toBeGreaterThanOrEqual(-0.5);
          expect(d, `y ${y}`).toBeLessThanOrEqual(CLOTH + 0.5);
        }
      });

  it('mảng da người mặc đồ là lưới kín ghi độ sâu, quấn ra ngoài; người que vẫn là hình in', () => {
    const g = GarmentSchema.parse({ style: 'bare', marks: false, panels: [{ fill: 'skin', side: 'both', mirror: true, from: 'neck', pts: [[28, -16], [90, -16], [90, 50], [40, 44], [29, 16]] }] });
    const r = roots3(g, base, { clad: true, sleeve: 15, trouser: 17 });
    const clad = torsoMesh(g, base, r.room).fills.filter((f) => f.fill === 'skin');
    expect(clad.length).toBeGreaterThan(0);
    for (const f of clad) {
      expect(f.skin).toBe(true);
      expect(f.decal).toBeUndefined();
      for (let i = 0; i < f.tris.length; i += 3) {
        const [A, B, C] = [f.pts[f.tris[i]], f.pts[f.tris[i + 1]], f.pts[f.tris[i + 2]]];
        const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
        expect((u[1] * v[2] - u[2] * v[1]) * A[0] + (u[0] * v[1] - u[1] * v[0]) * A[2]).toBeLessThanOrEqual(1e-9);
      }
    }
    expect(torsoMesh(g, base).fills.filter((f) => f.fill === 'skin').every((f) => f.decal && !f.skin)).toBe(true);
  });

  it('mảng mặt trước đo dọc mặt khối: quá nửa rộng ngang ngực vẫn còn bề ngang, không dồn về sườn', () => {
    const g = GarmentSchema.parse({ style: 'tshirt', panels: [{ fill: '#ff0000', pts: [[-36, 90], [-26, 90], [-26, 80], [-36, 80]] }] });
    const r = roots3(g, base, { clad: true, sleeve: 15, trouser: 17 });
    const t = torsoMesh(g, base, r.room);
    const f = t.fills.find((x) => x.fill === '#ff0000')!;
    const a = lerpAt(t.profile, -85, 1, 0);
    expect(a).toBeLessThan(36);
    const deep = t.profile.map(([, y], i): [number, number] => [t.front[i], y]);
    const lon = f.pts.map(([x, y, z]) => (Math.atan2(x / lerpAt(t.profile, y, 1, 0), z / lerpAt(deep, y, 1, 0)) * 180) / Math.PI);
    expect(Math.min(...lon)).toBeGreaterThan(-89);
    expect(Math.max(...lon) - Math.min(...lon)).toBeGreaterThan(10);
  });

  it('nét ngực, lưng của thân trần là hình in nhạt, không phải ống nét đen', () => {
    for (const r of [undefined, roots3(GarmentSchema.parse({ style: 'bare' }), base, { clad: true, sleeve: 15, trouser: 17 }).room]) {
      const t = torsoMesh({ style: 'bare' }, base, r);
      expect([t.lines.length, t.dots.length]).toEqual([0, 0]);
      const faint = t.fills.filter((f) => f.ink !== undefined);
      expect(faint).toHaveLength(7);
      for (const f of faint) {
        expect(f.ink).toBeLessThan(0.5);
        expect(f.decal).toBeDefined();
        expect(f.tris.length).toBeGreaterThan(0);
      }
    }
    // người que: nét có độ mờ
    const c = defaultCharacter();
    c.pieces.torso = { ...c.pieces.torso, src: 'sculpt', garment: GarmentSchema.parse({ style: 'bare' }) };
    const lines = torsoPaths(c, 20, 6).lines.filter((l) => !l.fill);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.ink).toBeLessThan(0.5);
  });

  it('sườn áo phủ gốc đùi từ khớp hông tới gấu; áo hẹp hẳn hơn hông giữ dáng', () => {
    const [sleeve, trouser] = [15, 17];
    const th = cladThigh(trouser, base.stroke);
    for (const style of ['tshirt', 'shirt', 'polo', 'suit', 'blazer', 'wrap', 'hoodie'] as const) {
      const g = GarmentSchema.parse({ style });
      const t = torsoMesh(g, base, roots3(g, base, { clad: true, sleeve, trouser }).room);
      const bottom = t.profile[t.profile.length - 1][1];
      for (let y = 0; y <= bottom; y += 0.25)
        expect(lerpAt(t.profile, y, 1, 0), `${style} y ${y}`).toBeGreaterThanOrEqual(base.hipHalf + th + THIGH_CLEAR - 0.3);
    }
    const tank = GarmentSchema.parse({ style: 'tshirt', ease: 3 });
    const r = roots3(tank, base, { clad: true, sleeve, trouser }).room!;
    const free = { ...r, thigh: undefined };
    expect(torsoMesh(tank, base, r).profile).toEqual(torsoMesh(tank, base, free).profile);
  });
});

