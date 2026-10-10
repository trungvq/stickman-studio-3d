import { describe, expect, it } from 'vitest';
import { TORSO_DEPTH } from './core/constants';
import { defaultCharacter } from './core/schema';
import { GARMENT_STYLES, lerpAt } from './core/torso';
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
