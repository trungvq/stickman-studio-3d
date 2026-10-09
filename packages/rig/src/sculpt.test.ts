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
