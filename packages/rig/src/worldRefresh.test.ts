import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { body3 } from './core/figure3d';
import { parseAction } from './core/action';
import { parseHeldItem, type HeldItemSpec } from './core/heldItem';
import { parseScene, resolveScene, type SceneData } from './core/scene';
import { defaultCharacter } from './core/schema';
import { buildWorld, plainRoom, type World3D } from './world';
import tuiJson from '../../../apps/studio/public/held/tui.json';
import cocJson from '../../../apps/studio/public/held/coc.json';
import bangGia from './core/__fixtures__/held-v2/bang-gia.json';

// `World3D.refresh`: đổi mốc tay, mốc món mà không dựng lại lưới — vẽ ra như cảnh dựng mới (docs/03-scene.md#làm-mới-runtime)

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
const HELD = { tui: spec(tuiJson), coc: spec(cocJson), 'bang-gia': spec(bangGia) };
const still = parseAction({ name: 'still', duration: 1, end: 'hold', authoredAt: 'side', keys: [{ t: 0, pose: {} }] }).data!;
const c = defaultCharacter();
c.palette.clad = true;
const lens = { eye: [0, -250, -1400] as [number, number, number], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 };
const heights = { a: 1, b: 1 }, bodies = { a: body3(c), b: body3(c) };
const SHEET = { item: 'bang-gia', group: 'sheet', edge: 'right', along: 0.33, thumb: 'front' };

/** Túi khoác khuỷu rồi cầm bảng theo mốc ở tay phải, cốc tay dẫn `auto` ở tay trái; `b` là người nền */
function json(o: { elbow?: number[]; cup?: number[]; mark?: number[]; b?: number[]; noCup?: boolean; along?: number; cups?: readonly [string, string]; seat?: number[] } = {}) {
  const [cup0, cup1] = o.cups ?? ['coc', 'coc'];
  return {
    name: 'x', lens, duration: 4,
    cast: [
      {
        id: 'a', character: 'a.json', tracks: [{ clips: [{ action: 'still', start: 0 }] }],
        world: {
          at: [0, 0, 0], yaw: 90,
          hands: [
            {
              t: 0,
              right: { to: 'shoulder', offset: [36, 30, 0], point: 'wrist', elbow: o.elbow ?? [0.2, 1, 0.7], hold: { item: 'tui', group: 'carry', on: 'elbow' } },
              left: { at: [40, -250, -40], point: 'grip', ...(!o.noCup && { hold: `${cup0}@cylinder` }) },
            },
            { t: 1, left: { at: o.cup ?? [50, -270, -30], point: 'grip', ease: 'auto' } },
            { t: 1.5, left: { at: [45, -280, -20], point: 'grip', ease: 'auto', ...(o.cups && { hold: `${cup1}@cylinder` }) } },
            { t: 2, right: { hold: { ...SHEET, ...(o.along !== undefined && { along: o.along }) }, elbow: [-0.4, 1, 0.3], elbowLock: true } },
            { t: 3.5, right: { hold: null } },
          ],
        },
      },
      {
        id: 'b', character: 'a.json', tracks: [{ clips: [{ action: 'still', start: 0 }] }],
        world: { at: [200, 0, 100], yaw: 270, hands: [{ t: 0, right: o.seat ? { hold: 'coc:3@cylinder' } : { at: o.b ?? [160, -250, 100], point: 'grip' } }] },
      },
    ],
    items: [
      ...(o.seat ? [{ t: 0, cast: 'b', item: 'coc:3', at: o.seat }] : []),
      { t: 2, cast: 'a', item: 'bang-gia', to: 'chest', offset: [30, -2.9, 0], face: { axis: 'front', toward: 'holderFace' }, roll: { axis: 'top', toward: 'up' } },
      { t: 3, cast: 'a', item: 'bang-gia', to: 'chest', offset: o.mark ?? [38, -14, 8], ease: 'auto', face: { axis: 'front', toward: 'holderFace' }, roll: { axis: 'top', toward: 'up' } },
    ],
  };
}
const scene = (j: unknown): SceneData => {
  const r = parseScene(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

function world(sc: SceneData): World3D {
  const rt = resolveScene(sc, { still }, {}, {}, heights, bodies, HELD);
  return buildWorld(sc, rt, {
    set: () => plainRoom(),
    still: ['b'],
    extra: (_m, k) => {
      const g = new THREE.Group();
      const add = (name: string, geo: THREE.BufferGeometry, at: number[]) => {
        const o = new THREE.Group();
        o.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial()));
        o.position.set(at[0], at[1], at[2]);
        g.add(o);
        k.provide(name, o);
      };
      add('tui', new THREE.BoxGeometry(0.3, 0.26, 0.1).translate(0, 0.13, 0), [2, 0, 1]);
      add('coc', new THREE.CylinderGeometry(0.08, 0.08, 0.2), [-2, 0, 1]);
      add('coc:2', new THREE.CylinderGeometry(0.06, 0.06, 0.16), [-2.5, 0, 1]);
      add('bang-gia', new THREE.BoxGeometry(0.28, 0.2, 0.01), [0, 0, 2]);
      return { group: g };
    },
  }, { characters: { 'a.json': c }, heights, bodies });
}

/** Ma trận thế giới mọi lưới đang hiện ở `t`, xếp theo số: cùng ảnh là cùng tập */
function drawn(w: World3D, t: number) {
  const figs = w.pose(t);
  w.root.updateMatrixWorld(true);
  const out: string[] = [];
  const shown = (o: THREE.Object3D): boolean => o.visible && (!o.parent || shown(o.parent));
  w.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && shown(o)) out.push(o.matrixWorld.elements.join());
  });
  const held = Object.values(figs).map((f) => [Object.keys(f.holding ?? {}), Object.keys(f.carrying ?? {})]);
  return { meshes: out.sort(), held };
}

const TS = [0.2, 0.9, 1.4, 2.1, 2.6, 3.2, 3.8];

describe('`World3D.refresh`', () => {
  it('đổi mốc tay và mốc món: lưới giữ nguyên, vẽ ra trùng từng số với cảnh dựng mới', { timeout: 30_000 }, () => {
    const w = world(scene(json()));
    const meshes = new Set<THREE.Object3D>();
    const each = (f: (m: THREE.Mesh) => void) => w.root.traverse((o) => (o as THREE.Mesh).isMesh && f(o as THREE.Mesh));
    each((m) => meshes.add(m));
    for (const t of [2.6, 0.9, 3.2]) drawn(w, t);
    const next = scene(json({ elbow: [0.4, 1, 0.6], cup: [56, -262, -36], mark: [34, -6, 4] }));
    expect(w.refresh!(next)).toBe(true);
    expect(w.cast.scene).toBe(next);
    const fresh = world(next);
    for (const t of TS) expect(drawn(w, t)).toEqual(drawn(fresh, t));
    // các mốc đã đổi thật sự đổi hình
    const old = world(scene(json()));
    for (const t of [0.5, 1.4, 3.2]) expect(drawn(old, t).meshes).not.toEqual(drawn(fresh, t).meshes);
    // không lưới nào dựng thêm (nhóm gắn món thì gắn lại)
    each((m) => expect(meshes.has(m)).toBe(true));
  });

  it('đổi mốc tay của người nền, đổi món một người cầm hay chỗ khác mốc: trả `false`, cảnh vẽ như cũ', { timeout: 30_000 }, () => {
    const w = world(scene(json()));
    const want = TS.map((t) => drawn(w, t));
    expect(w.refresh!(scene(json({ b: [150, -240, 110] })))).toBe(false);
    expect(w.refresh!(scene(json({ noCup: true })))).toBe(false);
    expect(w.refresh!(scene({ ...json(), duration: 5 }))).toBe(false);
    expect(TS.map((t) => drawn(w, t))).toEqual(want);
    const seated = world(scene(json({ seat: [160, -250, 100] })));
    expect(seated.refresh!(scene(json({ seat: [160, -240, 110] })))).toBe(false);
  });

  it('đổi trường số của chỗ cầm (`rt.held` mới) và đổi lượt món bản sao trong tay (gỡ, gắn lại): vẽ như cảnh dựng mới', { timeout: 30_000 }, () => {
    for (const [a, b] of [
      [{}, { along: 0.6 }],
      [{ cups: ['coc', 'coc:2'] }, { cups: ['coc:2', 'coc'] }],
    ] as const) {
      const w = world(scene(json(a)));
      for (const t of [0.2, 1.8, 2.6]) drawn(w, t);
      const next = scene(json(b));
      expect(w.refresh!(next)).toBe(true);
      const fresh = world(next);
      for (const t of TS) expect(drawn(w, t)).toEqual(drawn(fresh, t));
      const old = world(scene(json(a)));
      expect(TS.some((t) => JSON.stringify(drawn(old, t)) !== JSON.stringify(drawn(fresh, t)))).toBe(true);
    }
  });
});
