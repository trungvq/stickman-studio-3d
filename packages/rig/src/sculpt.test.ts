import { describe, expect, it } from 'vitest';
import type { Sculpt } from './core/schema';
import { SCULPT_PRESETS, SCULPT_STYLES } from './core/sculpt';
import { sculptMesh } from './sculpt';

/** Đổi mọi số của một trường; trường chữ hay cờ thì bỏ hẳn */
const nudge = (v: unknown): unknown => (typeof v === 'number' ? v * 1.5 + 0.1 : Array.isArray(v) ? v.map(nudge) : undefined);

describe('sculptMesh', () => {
  const presets: Partial<Sculpt>[] = Object.values(SCULPT_PRESETS).map((p) => p.sculpt);
  for (const [style, def] of Object.entries(SCULPT_STYLES) as unknown as [Sculpt['style'], Record<string, unknown>][]) {
    const sculpt = presets.find((p) => p.style === style) ?? { style };
    for (const key of Object.keys(def).filter((k) => !(Array.isArray(def[k]) && !(def[k] as unknown[]).length)))
      it(`${style}: đọc \`${key}\` của bảng kiểu`, () => {
        const before = JSON.stringify(sculptMesh(sculpt));
        const saved = def[key];
        def[key] = nudge(saved);
        try {
          expect(JSON.stringify(sculptMesh(sculpt))).not.toBe(before);
        } finally {
          def[key] = saved;
        }
      });
  }
});

describe('tóc anime', () => {
  const s = SCULPT_PRESETS.anime.sculpt;
  /** Điểm thấp nhất của lọn trước mặt, `y` của sọ đơn vị */
  const low = (sculpt: Partial<Sculpt>) => Math.min(...sculptMesh(sculpt).spikes.flat().filter(([x, , z]) => z > 0.6 && Math.abs(x) < 0.4).map(([, y]) => y));
  it('lọn mái rủ đè xuống trán dưới chân tóc, dài theo `spike`', () => {
    expect(low(s)).toBeLessThan(Math.sin((s.front * Math.PI) / 180) - 0.2);
    expect(low({ ...s, spike: 1.3 })).toBeLessThan(low(s));
    expect(sculptMesh({ ...s, spike: 0 }).spikes).toEqual([]);
  });
});

describe('lọn dẹt', () => {
  it('đổi dấu `part` thì lọn lật gương', () => {
    for (const k of ['neat', 'quiff', 'slick'] as const) {
      const s = SCULPT_PRESETS[k].sculpt;
      const mirror = sculptMesh({ ...s, part: -s.part }).spikes.flat();
      const far = sculptMesh(s)
        .spikes.flat()
        .filter((_, i) => i % 7 === 0)
        .map(([x, y, z]) => Math.min(...mirror.map(([u, v, w]) => Math.hypot(x + u, y - v, z - w))));
      expect(Math.max(...far)).toBeLessThan(1e-9);
    }
  });
});

describe('tóc vuốt ngược', () => {
  const m = sculptMesh(SCULPT_PRESETS.slick.sculpt);
  it('nhìn nghiêng mái vát ra sau, không dựng vách', () => {
    /** Mặt trước của vỏ ở dải giữa đầu quanh độ cao `y` */
    const ahead = (y: number) => Math.max(...m.shell.flat().filter(([x, v, z]) => Math.abs(x) < 0.08 && z > 0 && Math.abs(v - y) < 0.03).map(([, , z]) => z));
    expect(ahead(1)).toBeLessThan(ahead(0.85) - 0.08);
    expect(ahead(1.15)).toBeLessThan(ahead(1) - 0.08);
  });
  it('lọn dừng trên đỉnh và hai bên, sau gáy là vỏ liền', () => {
    expect(m.spikes.length).toBeGreaterThan(0);
    expect(Math.min(...m.spikes.flat().map(([, , z]) => z))).toBeGreaterThan(-0.5);
    expect(m.lines).toEqual([]);
  });
});
