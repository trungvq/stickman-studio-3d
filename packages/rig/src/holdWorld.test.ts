import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { body3 } from './core/figure3d';
import { parseAction } from './core/action';
import { gripCenter, parseHeldItem, type HeldItemSpec } from './core/heldItem';
import { parseScene, resolveScene } from './core/scene';
import { defaultCharacter } from './core/schema';
import { sceneHeld, type HeldItemPose } from './core/heldAudit';
import { hold } from './attach';
import { heldHands, legacyHolds } from './held';
import { U } from './khoi';
import { buildWorld, plainRoom, type Cast3D } from './world';
import cocJson from '../../../common/held/coc.json';
import khay from './core/__fixtures__/held-v2/khay.json';

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
const COC = spec(cocJson);
const HELD = { coc: COC, khay: spec(khay) };
/** Cốc cầm thân, miệng cốc lên */
const COC_UP = { item: 'coc', group: 'cylinder', up: 'rim' };

const still = parseAction({ name: 'still', duration: 1, end: 'hold', authoredAt: 'side', keys: [{ t: 0, pose: {} }] }).data!;
const c = defaultCharacter();
c.palette.clad = true;
const characters = { 'a.json': c };
const lens = { eye: [0, -250, -1400] as [number, number, number], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 };

function world(hands: unknown[], provide: (cast: Cast3D, g: THREE.Group) => void, out?: { rt?: ReturnType<typeof resolveScene> }) {
  const sc = parseScene({
    name: 'x', lens, duration: 3,
    cast: [{ id: 'a', character: 'a.json', world: { at: [0, 0, 0], yaw: 90, hands }, tracks: [{ clips: [{ action: 'still', start: 0 }] }] }],
  });
  if (!sc.success) throw new Error(sc.error.message);
  const heights = { a: 1 }, bodies = { a: body3(c) };
  const rt = resolveScene(sc.data, { still }, heights, bodies, HELD);
  if (out) out.rt = rt;
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
    { t: 0, right: { at: [-30, -270, -60], point: 'grip', hold: COC_UP } },
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
    const held = fig.holding![-1]!;
    expect(held).toMatchObject({ item: 'coc', grip: '@cylinder////', pose: held.hand!.pose });
    const H = fig.hands![-1];
    const want = fig.arms[-1].wrist.localToWorld(new THREE.Vector3(...gripCenter(held.pose, -1, H.scale, H.long)));
    const got = o.localToWorld(new THREE.Vector3(...held.hand!.at.map((v) => v * 0.01)));
    expect(got.distanceTo(want)).toBeLessThan(1e-6);
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
    const w = world([{ t: 0, right: { at: [-30, -260, -80], point: 'grip', hold: { item: 'khay', group: 'platform', both: true } } }], (k, g) => {
      g.add(o);
      k.provide('khay', o);
      expect(() => k.provide('khay', new THREE.Group())).toThrow(/đã đăng ký/);
    });
    const fig = w.pose(0.2).a;
    expect(fig.holding?.[-1]).toMatchObject({ item: 'khay', both: true });
    expect(fig.holding?.[1]).toMatchObject({ item: 'khay', both: true });
    expect(fig.holding![-1]!.object).toBe(fig.holding![1]!.object);
    expect(fig.hands![1].held).toBe(fig.holding![1]!.pose);
  });
});

describe('số đo cho `check`', () => {
  const HANDS = [
    { t: 0.5, right: { at: [-30, -270, -60], point: 'grip', hold: COC_UP } },
    { t: 1.5, right: { hold: null } },
  ];
  const mesh = () => {
    const o = cup();
    o.position.set(1, 0.5, 2);
    return o;
  };

  it('`heldHands`: chỗ cầm, vật, ý định bộ giải nhắm; `provided` kể món; `legacyHolds` chỉ kể đường cũ', () => {
    const o = mesh();
    let cast!: Cast3D;
    const w = world(HANDS, (k, g) => {
      cast = k;
      g.add(o);
      k.provide('coc', o, 'a');
    });
    const fig = w.pose(1).a;
    w.root.updateMatrixWorld(true);
    const [h] = heldHands(fig, 'a');
    expect(h).toMatchObject({ item: 'coc', hold: 'coc@cylinder////', obj: o.id, intent: { rule: 'up', toward: 'up' } });
    expect(h.intent!.err).toBeLessThan(30);
    expect(cast.provided()).toEqual([{ item: 'coc', object: o, owner: 'a' }]);
    expect(legacyHolds(fig, 'a')).toEqual([]);
    const other = cup();
    fig.root.add(other);
    hold(fig, other, { hand: 1, follow: 'level' });
    expect(legacyHolds(fig, 'a')).toEqual([{ id: 'a', hand: 'L', item: 'coc', follow: 'level', both: false }]);
  });

  it('món nằm xa tay lúc gắn và về chỗ cũ lúc thả: `jump` ở cả hai mốc', () => {
    const o = mesh();
    let cast!: Cast3D;
    const out: { rt?: ReturnType<typeof resolveScene> } = {};
    const w = world(HANDS, (k, g) => {
      cast = k;
      g.add(o);
      k.provide('coc', o);
    }, out);
    const frame = (t: number) => {
      const posed = w.pose(t);
      w.root.updateMatrixWorld(true);
      return Object.entries(posed).flatMap(([id, f]) => heldHands(f, id));
    };
    const items = (t: number): HeldItemPose[] => {
      w.pose(t);
      w.root.updateMatrixWorld(true);
      const p = o.getWorldPosition(new THREE.Vector3());
      const q = o.getWorldQuaternion(new THREE.Quaternion());
      const h = cast.holder('coc', t);
      return [{ obj: o.id, item: 'coc', p: [p.x / U, -p.y / U, -p.z / U], q: [q.x, q.y, q.z, q.w], shown: true, ...(h && { holder: { id: h.id, hand: h.side < 0 ? 'R' as const : 'L' as const } }) }];
    };
    const issues = sceneHeld(out.rt!, { frame, items });
    const jump = issues.find((i) => i.rule === 'jump')!;
    expect(jump.runs).toEqual([[0.5, 0.5], [1.5, 1.5]]);
    expect(jump.jump!.move).toBeGreaterThan(50);
    expect(issues.some((i) => i.rule === 'drift' || i.rule === 'pose')).toBe(false);
  });
});
