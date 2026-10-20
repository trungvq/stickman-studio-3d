import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { body3 } from './core/figure3d';
import { parseHeldItem, type HeldItemSpec, type ReachHold } from './core/heldItem';
import { holdLinkFrame } from './core/holdLink';
import { itemAt, parseScene, resolveScene, sceneAt } from './core/scene';
import { defaultCharacter, parseCharacter } from './core/schema';
import { fitHolding } from './attach';
import { heldCarries } from './held';
import { U } from './khoi';
import { buildWorld, plainRoom, type Cast3D } from './world';
import fx from './core/__fixtures__/nguoi-cam-bang.json';
import bangGia from './core/__fixtures__/held-v2/bang-gia.json';
import dienThoai from './core/__fixtures__/held-v2/dien-thoai.json';
import tuiHieu from './core/__fixtures__/held-v2/tui-hieu.json';

// Chỗ cầm nhóm (`món@nhóm`) gắn món three qua `holdLink`: món đặt trước ngồi ở `itemAt`, tay dẫn mang món theo bàn tay

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
const HELD = { 'bang-gia': spec(bangGia), 'dien-thoai': spec(dienThoai) };
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
  const rt = resolveScene(sc.data, {}, {}, {}, { nguoi: H }, bodies, HELD);
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

/** Gốc khung món ra thế giới rig, ba trục khung món ra thế giới rig */
function rigPose(o: THREE.Object3D) {
  o.updateWorldMatrix(true, false);
  const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
  const ax = [0, 1, 2].map((i) => new THREE.Vector3().setFromMatrixColumn(o.matrixWorld, i).normalize());
  return { P: [p.x / U, -p.y / U, -p.z / U], axes: ax.map((a) => [a.x, -a.y, -a.z]) };
}
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const col = (R: readonly number[], i: number) => [R[i], R[3 + i], R[6 + i]];

/** Món trong khung cổ tay */
function inWrist(o: THREE.Object3D, wrist: THREE.Object3D) {
  o.updateWorldMatrix(true, false);
  const m = wrist.matrixWorld.clone().invert().multiply(o.matrixWorld);
  const p = new THREE.Vector3(), q = new THREE.Quaternion();
  m.decompose(p, q, new THREE.Vector3());
  return { p, q };
}

describe('món đặt trước (`mode: "item"`)', () => {
  it('món ngồi đúng `itemAt` của cảnh (≤ 0,01 đv rig), cả khi tay không với tới', () => {
    const { w, rt, objects } = world([{ t: 0, right: { hold: SHEET } }], [mark(0), mark(1, [34, -8, 4]), mark(2, [140, -8, 4])]);
    const o = objects['bang-gia'];
    for (const t of [0, 0.4, 1.2, 2.5]) {
      const fig = w.pose(t).nguoi;
      expect(fig.holding?.[-1]?.object).toBe(o);
      const want = itemAt(rt, 'bang-gia', t, { chars: { nguoi: fig.body } })!;
      const got = rigPose(o);
      expect(dist(got.P, want.P)).toBeLessThanOrEqual(0.01);
      for (const i of [0, 1, 2]) expect(dist(got.axes[i], col(want.R, i))).toBeLessThan(1e-6);
    }
    // ngoài tầm: bàn tay hở khỏi món, món vẫn ở chỗ khai
    const fig = w.pose(2.5).nguoi;
    expect(fig.aim?.R.hold?.grasp?.arm.gap ?? 0).toBeGreaterThan(1);
  });

  it('hai tay trên một món đặt trước: món gắn một lần, cả hai tay ghi lần cầm của mình', () => {
    const { w, rt, objects } = world(
      [{ t: 0, right: { hold: { ...SHEET, edge: 'left', along: 0.5 } }, left: { hold: { ...SHEET, edge: 'right', along: 0.5 } } }],
      [mark(0, [35, 0, 0])],
    );
    const fig = w.pose(0.5).nguoi;
    const o = objects['bang-gia'];
    expect(fig.holding?.[-1]?.object).toBe(o);
    expect(fig.holding?.[1]?.object).toBe(o);
    expect(fig.holding?.[1]?.grip).not.toBe(fig.holding?.[-1]?.grip);
    const want = itemAt(rt, 'bang-gia', 0.5, { chars: { nguoi: fig.body } })!;
    expect(dist(rigPose(o).P, want.P)).toBeLessThanOrEqual(0.01);
    expect(fig.hands![1].fit).toHaveLength(10);
  });

  it('bàn tay giữ dáng hoà và vai trò ngón của nhóm, ngón ôm theo hình', () => {
    const { w } = world([{ t: 0, right: { hold: SHEET } }], [mark(0)]);
    const fig = w.pose(0.5).nguoi;
    const e = fig.holding![-1]!;
    expect(e.roles).toBeDefined();
    expect(fig.hands![-1].heldV).toHaveLength(fig.hands![-1].acted.length);
    expect(fig.hands![-1].fit).toHaveLength(10);
  });
});

describe('tay dẫn (`mode: "hand"`)', () => {
  const HANDS = [
    { t: 0, right: { to: 'chest', offset: [30, 20, -20], point: 'grip', hold: 'dien-thoai@palmBox' } },
    { t: 1, right: { to: 'chest', offset: [45, -25, 10], point: 'grip' } },
  ];

  it('món theo bàn tay qua `GripFrame` của `holdLinkFrame`: đổi tư thế tay thì món đi theo', () => {
    const { w, rt, objects } = world(HANDS);
    const o = objects['dien-thoai'];
    const seen: { P: number[]; p: THREE.Vector3; q: THREE.Quaternion }[] = [];
    for (const t of [0.1, 1.5]) {
      const fig = w.pose(t).nguoi;
      const sp = sceneAt(rt, 'nguoi', t, H, bodies.nguoi);
      const W = sp.world!;
      const hold = (W.flip ? W.hands!.far : W.hands!.near)!.hold as ReachHold;
      expect(hold.grasp?.mode).toBe('hand');
      const h = fig.hands![-1];
      const { G } = holdLinkFrame(hold, -1, h.scale, h.long, 1);
      const rel = inWrist(o, fig.arms[-1].wrist);
      expect(rel.p.distanceTo(new THREE.Vector3(...G.p))).toBeLessThan(1e-6);
      const R = new THREE.Matrix4().set(G.R[0], G.R[1], G.R[2], 0, G.R[3], G.R[4], G.R[5], 0, G.R[6], G.R[7], G.R[8], 0, 0, 0, 0, 1);
      expect(rel.q.angleTo(new THREE.Quaternion().setFromRotationMatrix(R))).toBeLessThan(1e-6);
      seen.push({ P: rigPose(o).P, ...rel });
    }
    expect(dist(seen[0].P, seen[1].P)).toBeGreaterThan(10);
  });

  it('`fitHolding` nhớ theo lần cầm: cùng lần cầm trả cùng object ngón ôm', () => {
    const { w } = world(HANDS);
    const fig = w.pose(0.1).nguoi;
    const h = fig.hands![-1];
    const a = h.fit;
    expect(a).toHaveLength(10);
    fitHolding(fig);
    expect(h.fit).toBe(a);
    w.pose(1.5);
    expect(h.fit).toBe(a);
  });
});

describe('treo (`món@carry`)', () => {
  // `touch` của túi khai ở cảnh `on: shoulder`; bản v1 cùng thân, cùng mốc, chỗ treo là kiểu treo của `grips`
  const { touch, ...bare } = tuiHieu;
  const V2 = spec(bare);
  const V1 = spec({
    size: bare.size, anchors: bare.anchors, shape: bare.shape,
    grips: { khuyu: { on: 'elbow', at: 'treoKhuyu' }, vai: { on: 'shoulder', at: 'quai', touch } },
  });
  const c = defaultCharacter();
  c.palette.clad = true;
  const ELBOW = { to: 'shoulder', offset: [36, 30, 0], point: 'wrist', elbow: [-0.7, 1, -0.2] };
  const OUT = { at: [-90, -185, -10], point: 'wrist', elbow: [-0.6, 1, 0] };

  function carryWorld(item: HeldItemSpec, hands: unknown[]) {
    const sc = parseScene({
      name: 'x', duration: 3,
      lens: { eye: [0, -250, -1400], yaw: 0, pitch: 0, f: 800 },
      cast: [{ id: 'a', character: 'a.json', world: { at: [0, 0, 0], yaw: 90, hands } }],
    });
    if (!sc.success) throw new Error(sc.error.message);
    const heights = { a: 1 }, bodies = { a: body3(c) };
    const rt = resolveScene(sc.data, {}, {}, {}, heights, bodies, { 'tui-hieu': item });
    const bag = new THREE.Group();
    bag.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.2).translate(0, 0.25, 0), new THREE.MeshBasicMaterial()));
    const w = buildWorld(sc.data, rt, {
      set: () => plainRoom(),
      extra: (_m, k) => {
        const g = new THREE.Group();
        g.add(bag);
        k.provide('tui-hieu', bag);
        return { group: g };
      },
    }, { characters: { 'a.json': c }, heights, bodies });
    return { w, bag };
  }
  const at = (x: ReturnType<typeof carryWorld>, t: number) => {
    const fig = x.w.pose(t).a;
    x.w.root.updateMatrixWorld(true);
    return fig;
  };
  const v2 = (h: object) => ({ hold: { item: 'tui-hieu', group: 'carry', ...h } });

  const PAIRS = [
    { name: 'khuỷu', v1: { ...ELBOW, hold: 'tui-hieu#khuyu' }, v2: { ...ELBOW, ...v2({ on: 'elbow' }) }, on: 'elbow' },
    { name: 'vai', v1: { ...OUT, hold: 'tui-hieu#vai' }, v2: { ...OUT, ...v2({ on: 'shoulder', touch }) }, on: 'shoulder' },
  ];
  for (const P of PAIRS)
    it(`\`on: ${P.on}\` treo y như kiểu treo ${P.name} v1: cùng khung món (≤ 1e-9), cùng \`heldCarries\``, () => {
      const a = carryWorld(V1, [{ t: 0, right: P.v1 }]);
      const b = carryWorld(V2, [{ t: 0, right: P.v2 }]);
      for (const t of [0.2, 1.5]) {
        const fa = at(a, t), fb = at(b, t);
        const ea = fa.carrying![-1]!, eb = fb.carrying![-1]!;
        expect(eb.carry.on).toBe(P.on);
        expect(fb.holding?.[-1]).toBeUndefined();
        a.bag.matrixWorld.elements.forEach((x, i) => expect(Math.abs(x - b.bag.matrixWorld.elements[i])).toBeLessThanOrEqual(1e-9));
        expect(Math.abs(ea.fit!.swing - eb.fit!.swing)).toBeLessThanOrEqual(1e-9);
        const [ca] = heldCarries(fa, 'a'), [cb] = heldCarries(fb, 'a');
        expect(cb.hold).toBe('tui-hieu@carry');
        expect(cb.key).toBe(`${b.bag.id}|tui-hieu@carry|${P.on}`);
        expect(Math.abs(ca.seat - cb.seat)).toBeLessThanOrEqual(1e-9);
        expect(Math.abs(ca.swing - cb.swing)).toBeLessThanOrEqual(1e-9);
        expect(Math.abs(ca.body.gap - cb.body.gap)).toBeLessThanOrEqual(1e-9);
        expect(cb.body.part).toBe(ca.body.part);
        expect(cb.body.allow).toBe(ca.body.allow);
        expect(cb.bend).toBe(ca.bend);
        expect(cb.rise).toBe(ca.rise);
      }
    });

  it('đổi `on` giữa hai mốc: món treo lại ở chỗ mới', () => {
    const x = carryWorld(V2, [{ t: 0, right: { ...ELBOW, ...v2({ on: 'elbow' }) } }, { t: 1, right: { ...OUT, ...v2({ on: 'shoulder', touch }) } }]);
    expect(at(x, 0.5).carrying![-1]!.carry.on).toBe('elbow');
    expect(at(x, 2).carrying![-1]!.carry.on).toBe('shoulder');
  });
});
