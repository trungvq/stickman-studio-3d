import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { body3 } from './core/figure3d';
import { parseAction } from './core/action';
import { gripCenter, heldPoint, parseHeldItem, type HeldItemSpec } from './core/heldItem';
import { parseScene, resolveScene } from './core/scene';
import { defaultCharacter } from './core/schema';
import { buildWorld, plainRoom, type Cast3D } from './world';
import cocJson from '../../../apps/studio/public/held/coc.json';

// Rig tự gắn món theo `world.hands[].hold`: repo đăng ký món bằng `cast.provide`, rig gắn, gỡ, trả về chỗ cũ

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
const TRAY = spec({
  size: [54, 4, 34],
  anchors: { top: { at: [0, 2, 0], dir: [0, 1, 0] }, rimR: { at: [27, 0, 0], dir: [1, 0, 0] }, rimL: { at: [-27, 0, 0], dir: [-1, 0, 0] } },
  grips: {
    bung: {
      pose: 'edge', at: 'rimR', palm: { into: 'rimR' }, fingers: [0, 0, -1],
      intent: { up: 'top', roll: { axis: 'rimL', toward: 'in' } },
      both: { lead: 'right', other: { pose: 'edge', at: 'rimL', palm: { into: 'rimL' }, fingers: [0, 0, -1] } },
    },
  },
});
const COC = spec(cocJson);
const HELD = { coc: COC, khay: TRAY };

const still = parseAction({ name: 'still', duration: 1, end: 'hold', authoredAt: 'side', keys: [{ t: 0, pose: {} }] }).data!;
const c = defaultCharacter();
c.palette.clad = true;
const characters = { 'a.json': c };
const lens = { eye: [0, -250, -1400] as [number, number, number], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 };

function world(hands: unknown[], provide: (cast: Cast3D, g: THREE.Group) => void) {
  const sc = parseScene({
    name: 'x', lens, duration: 3,
    cast: [{ id: 'a', character: 'a.json', world: { at: [0, 0, 0], yaw: 90, hands }, tracks: [{ clips: [{ action: 'still', start: 0 }] }] }],
  });
  if (!sc.success) throw new Error(sc.error.message);
  const heights = { a: 1 }, bodies = { a: body3(c) };
  const rt = resolveScene(sc.data, { still }, {}, {}, heights, bodies, HELD);
  return buildWorld(sc.data, rt, {
    set: () => plainRoom(),
    extra: (_m, cast) => {
      const g = new THREE.Group();
      provide(cast, g);
      return { group: g };
    },
  }, { characters, heights, bodies });
}

const cup = () => {
  const o = new THREE.Group();
  o.name = 'coc';
  o.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2), new THREE.MeshBasicMaterial()));
  return o;
};

describe('`Cast3D.provide`: rig gắn món theo `world.hands[].hold`', () => {
  const HANDS = [
    { t: 0, right: { at: [-30, -270, -60], point: 'grip', hold: 'coc#quai' } },
    { t: 1, right: { hold: null } },
  ];

  it('quãng cầm: món vào tay đúng tâm nắm, `holding` ghi món; hết quãng: về chỗ cũ', () => {
    const o = cup();
    o.position.set(1, 0.5, 2);
    let cast!: Cast3D;
    const w = world(HANDS, (k, g) => {
      cast = k;
      g.add(o);
      k.provide('coc', o);
    });
    const home = o.parent;
    const fig = w.pose(0.2).a;
    w.root.updateMatrixWorld(true);
    expect(fig.holding?.[-1]).toMatchObject({ item: 'coc', grip: 'quai', pose: 'grip' });
    const H = fig.hands![-1];
    const want = fig.arms[-1].wrist.localToWorld(new THREE.Vector3(...gripCenter('grip', -1, H.scale, H.long)));
    const got = o.localToWorld(new THREE.Vector3(...heldPoint(COC, 'handle').map((v) => v * 0.01)));
    expect(got.distanceTo(want)).toBeLessThan(1e-6);
    expect(o.userData.hold).toEqual({ up: [0, 1, 0] });
    expect(cast.holder('coc', 0.5)).toEqual({ id: 'a', side: -1 });
    expect(cast.holder('coc', 1.5)).toBeUndefined();
    // cốc đứng (gần mốc thả tay đã buông dần về hành động, cổ tay hết tầm giữ cốc đứng)
    expect(new THREE.Vector3(0, 1, 0).transformDirection(o.matrixWorld).y).toBeGreaterThan(0.99);

    w.pose(1.5);
    expect(o.parent).toBe(home);
    expect(o.position.toArray()).toEqual([1, 0.5, 2]);
    expect(fig.holding?.[-1]).toBeUndefined();
    expect(fig.hands![-1].held).toBeUndefined();
  });

  it('`released`: chỗ món lúc thả, đúng như món trong tay ngay trước mốc thả; vẽ nhảy cóc vẫn ra cùng kết quả', () => {
    const o = cup();
    let cast!: Cast3D;
    const w = world(HANDS, (k, g) => {
      cast = k;
      g.add(o);
      k.provide('coc', o);
    });
    // nhảy cóc: khung sau trước, khung trước sau
    w.pose(2);
    expect(o.parent?.parent).toBeDefined();
    expect(cast.released('coc', 0.5)).toBeUndefined();
    const r = cast.released('coc', 2)!;
    expect(r).toMatchObject({ id: 'a', side: -1, t: 1 });
    w.pose(0.999);
    w.root.updateMatrixWorld(true);
    const a = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    const b = new THREE.Vector3().setFromMatrixPosition(r.matrix);
    expect(a.distanceTo(b)).toBeLessThan(0.01);
    const qa = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(o.matrixWorld));
    const qb = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(r.matrix));
    expect(qa.angleTo(qb)).toBeLessThan(0.02);
  });

  it('hai tay: món theo tay chính, tay phụ giữ dáng của nó; đăng ký trùng là lỗi', () => {
    const o = new THREE.Group();
    const w = world([{ t: 0, right: { at: [-30, -260, -80], point: 'grip', hold: 'khay#bung' } }], (k, g) => {
      g.add(o);
      k.provide('khay', o);
      expect(() => k.provide('khay', new THREE.Group())).toThrow(/đã đăng ký/);
    });
    const fig = w.pose(0.2).a;
    expect(fig.holding?.[-1]).toMatchObject({ item: 'khay', both: true, pose: 'edge' });
    expect(fig.holding?.[1]).toMatchObject({ item: 'khay', both: true, pose: 'edge' });
    expect(fig.hands![1].held).toBe('edge');
  });
});
