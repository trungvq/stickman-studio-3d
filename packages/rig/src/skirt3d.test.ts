import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { defaultCharacter, SkirtSchema } from './core/schema';

// Người que three cần canvas cho nét mặt: một canvas giả đủ để dựng hình, không vẽ gì
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true });
  const g = globalThis as { document?: unknown; Path2D?: unknown };
  g.Path2D ??= class { moveTo() {} lineTo() {} ellipse() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} rect() {} };
  g.document ??= {
    createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }),
  };
});

/** Điểm `v` (thế giới) nằm trong khối lồi `mesh`: sau mọi mặt */
function inside(mesh: THREE.Mesh, v: THREE.Vector3) {
  const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index!;
  const local = mesh.worldToLocal(v.clone());
  const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i));
    b.fromBufferAttribute(pos, idx.getX(i + 1));
    c.fromBufferAttribute(pos, idx.getX(i + 2));
    const n = new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3());
    if (n.dot(local.clone().sub(a)) > 1e-6) return false;
  }
  return true;
}

describe('váy dựng khối', () => {
  it('ôm mặt trên đùi người ngồi khi thân nghiêng', async () => {
    const { fromCharacter, R } = await import('./stickman');
    const c = defaultCharacter();
    c.pieces.hem = { ...c.pieces.hem, src: 'sculpt', skirt: SkirtSchema.parse({}) };
    const p = fromCharacter(c as unknown as Parameters<typeof fromCharacter>[0], { seated: true });
    for (const torso of [0, 4, 15]) {
      const sp: Acting = {
        pose: { af: [0, 0, 0, 0], an: [0, 0, 0, 0], lf: [90, -90, 0], ln: [90, -90, 0], torso, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1] },
        world: { hip: [0, -100, 0], yaw: 1, s: 1, flip: false, seated: true },
        mouth: 'closed', brow: 'neutral', eyes: 'open',
      };
      act(p, sp);
      const skirt = p.skirt!.group.children[0] as THREE.Mesh;
      for (const side of [-1, 1] as const) {
        const { hip } = p.legs[side];
        // mặt trên đùi, tới gần mút phần váy phủ (váy mặc định phủ 52 của đùi 78)
        for (const k of [0.1, 0.3, 0.5, 0.62]) {
          const top = hip.localToWorld(new THREE.Vector3(0, -R.thigh * k, R.limb));
          expect(inside(skirt, top), `thân ${torso}°, đùi ${side}, ${k}`).toBe(true);
        }
      }
    }
  });
});
