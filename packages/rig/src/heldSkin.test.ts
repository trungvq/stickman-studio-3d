import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { body3 } from './core/figure3d';
import { parseHeldItem, type HeldItemSpec } from './core/heldItem';
import { parseScene, resolveScene } from './core/scene';
import { parseCharacter } from './core/schema';
import { heldHands } from './held';
import { buildWorld, plainRoom, type Cast3D } from './world';
import fx from './core/__fixtures__/nguoi-cam-bang.json';
import bangGia from './core/__fixtures__/held-v2/bang-gia.json';

// Số đo lún của `heldHands` đo trên đỉnh da đang vẽ (`skinDepth`) và mang chỗ cầm nhóm đã giải (`grasp`)

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true });
  const g = globalThis as { document?: unknown; Path2D?: unknown };
  g.Path2D ??= class { moveTo() {} lineTo() {} ellipse() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} rect() {} };
  g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
});

const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const HELD = { 'bang-gia': spec(bangGia) };
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error('nguoi');
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const bodies = { nguoi: body3(NGUOI) };

function world(hands: unknown[], items: unknown[] = []) {
  const sc = parseScene({
    duration: 4,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [{ id: 'nguoi', character: 'nguoi.json', base: { torso: 9, head: [0, 0, -6] }, world: { at: [250, 0, 506], yaw: 270, hands } }],
    items,
  });
  if (!sc.success) throw new Error(sc.error.message);
  const rt = resolveScene(sc.data, {}, { nguoi: H }, bodies, HELD);
  const objects: Record<string, THREE.Object3D> = {};
  const w = buildWorld(sc.data, rt, {
    set: () => plainRoom(),
    extra: (_m, cast: Cast3D) => {
      const g = new THREE.Group();
      for (const item of Object.keys(HELD)) {
        const o = new THREE.Group();
        o.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.01), new THREE.MeshBasicMaterial()));
        g.add(o);
        cast.provide(item, (objects[item] = o));
      }
      return { group: g };
    },
  }, { characters: { 'nguoi.json': NGUOI }, heights: { nguoi: H }, bodies });
  return { w, rt, objects };
}

const mark = (t: number, offset: number[] = [30, -2.9, 0]) => ({
  t, cast: 'nguoi', item: 'bang-gia', to: 'chest', offset,
  face: { axis: 'front', toward: 'holderFace' },
  roll: { axis: 'top', toward: 'up' },
});
const SHEET = { item: 'bang-gia', group: 'sheet', edge: 'right', along: 0.33, thumb: 'front' };


describe('heldHands: lún đo trên da', () => {
  const read = () => {
    const { w } = world([{ t: 0, right: { hold: SHEET } }], [mark(0)]);
    return heldHands(w.pose(0.5).nguoi, 'nguoi');
  };

  it('`bang-gia` dáng `sheet` pinch: da lún 0,48 ± 0,1, không đọc nang bao ngoài', () => {
    const [x] = read();
    const sink = -Math.min(...Object.values(x.fingers!), x.gaps.palm);
    expect(sink).toBeGreaterThan(0.38);
    expect(sink).toBeLessThan(0.58);
    // nang bao ngoài của dải lòng tay phình ở khớp gốc ngón: lún của nó là 3,27
    expect(-x.gaps.palm).toBeLessThan(1);
    expect(x.pierce.core).toBeLessThan(0);
  });

  it('khe theo nhóm là cực tiểu của các ngón trong nhóm', () => {
    const [x] = read();
    const f = x.fingers!;
    expect(x.gaps.thumb).toBe(f.thumb);
    expect(x.gaps.index).toBe(f.index);
    expect(x.gaps.fingers).toBe(Math.min(f.middle, f.ring, f.pinky));
  });

  it('mang chỗ cầm nhóm đã giải của lần cầm', () => {
    const [x] = read();
    expect(x.grasp).toMatchObject({ item: 'bang-gia', group: 'sheet', mode: 'item', choice: { variant: 'pinch', edge: 'right' } });
  });
});
