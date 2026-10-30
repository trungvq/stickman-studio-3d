import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { actJoints, actPalms } from './core/act3';
import { body3 } from './core/figure3d';
import { parseHeldItem } from './core/heldItem';
import { parseScene, resolveScene, sceneAt } from './core/scene';
import { parseCharacter } from './core/schema';
import fx from './core/__fixtures__/nguoi-cam-bang.json';
import bangGia from './core/__fixtures__/held-v2/bang-gia.json';

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true });
  const g = globalThis as { document?: unknown; Path2D?: unknown };
  g.Path2D ??= class { moveTo() {} lineTo() {} ellipse() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} rect() {} };
  g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
});

const rig3 = (p: THREE.Vector3): [number, number, number] => [p.x * 100, -p.y * 100, -p.z * 100];

describe('món đặt trước', () => {
  it('`act` đặt khuỷu, cổ tay, lòng tay đúng như `actJoints`, `actPalms`', async () => {
    const { fromCharacter } = await import('./stickman');
    const c = parseCharacter(fx.character);
    const spec = parseHeldItem(bangGia);
    if (!c.success || !spec.success) throw new Error('fixture');
    const mark = (t: number, offset: number[]) => ({ t, cast: 'nguoi', item: 'bang-gia', to: 'chest', offset, face: { axis: 'front', toward: 'holderFace' }, roll: { axis: 'top', toward: 'up' } });
    const sheet = { item: 'bang-gia', group: 'sheet', edge: 'right', along: 0.33, thumb: 'front' };
    const r = parseScene({
      duration: 2,
      lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
      cast: [{ id: 'nguoi', world: { at: [250, 0, 506], yaw: 270, hands: [{ t: 0, right: { hold: sheet }, left: { hold: { ...sheet, edge: 'left', along: 0.6 } } }] } }],
      items: [mark(0, [26, -2.9, 0]), mark(1, [140, -10, 0])],
    });
    if (!r.success) throw new Error(r.error.message);
    const H = c.data.rig.height;
    const rt = resolveScene(r.data, {}, { nguoi: H }, { nguoi: body3(c.data) }, { 'bang-gia': spec.data });
    const p = fromCharacter(c.data as unknown as Parameters<typeof fromCharacter>[0]);
    for (const t of [0, 0.5, 1]) {
      const sp = sceneAt(rt, 'nguoi', t, H, body3(c.data)) as unknown as Acting;
      act(p, sp);
      const j = actJoints(c.data, sp)!;
      const palms = actPalms(c.data, sp)!;
      for (const side of [-1, 1] as const) {
        const k = side === -1 ? 'R' : 'L';
        const { elbow, wrist } = p.arms[side];
        const e = rig3(elbow.getWorldPosition(new THREE.Vector3()));
        const w = rig3(wrist.getWorldPosition(new THREE.Vector3()));
        for (let i = 0; i < 3; i++) {
          expect(j[`elbow${k}`][i]).toBeCloseTo(e[i], 6);
          expect(j[`wrist${k}`][i]).toBeCloseTo(w[i], 6);
        }
        const d = new THREE.Vector3(-side, 0, 0).applyQuaternion(wrist.getWorldQuaternion(new THREE.Quaternion()));
        for (let i = 0; i < 3; i++) expect(palms[k].palm[i]).toBeCloseTo([d.x, -d.y, -d.z][i], 6);
      }
    }
  }, 30_000);
});
