import { describe, expect, it } from 'vitest';
import { TORSO_DEPTH } from './core/constants';
import { defaultCharacter, OBI_KNOTS, ObiSchema, WrapSchema } from './core/schema';
import { GARMENT_STYLES, garmentOf, lerpAt, type Surface } from './core/torso';
import { signedVolume, wrapEdge } from './core/wrap';
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
  for (const key of Object.keys(WrapSchema.shape).filter((k) => k !== 'obi'))
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
