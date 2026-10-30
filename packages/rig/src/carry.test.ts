import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { body3 } from './core/figure3d';
import { parseAction } from './core/action';
import { heldPoint, parseHeldItem, type HeldItemSpec } from './core/heldItem';
import { parseScene, resolveScene } from './core/scene';
import { defaultCharacter } from './core/schema';
import { heldLine, sceneHeld, type HeldCarry, type HeldItemPose } from './core/heldAudit';
import { CARRY } from './core/heldCarry';
import { carrySeat } from './attach';
import { heldCarries, heldHands } from './held';
import { U } from './khoi';
import { buildWorld, plainRoom, type Cast3D } from './world';
import tuiJson from '../../../common/held/tui.json';
import cocJson from '../../../common/held/coc.json';

// Món treo (`món@carry`): túi khoác khuỷu, đeo vai — rig treo món trên cánh tay theo `world.hands[].hold`, `check` đo chỗ treo và thân món

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
const TUI = spec(tuiJson);
const HELD = { tui: TUI, coc: spec(cocJson) };

const still = parseAction({ name: 'still', duration: 1, end: 'hold', authoredAt: 'side', keys: [{ t: 0, pose: {} }] }).data!;
const c = defaultCharacter();
c.palette.clad = true;
const lens = { eye: [0, -250, -1400] as [number, number, number], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 };

/** Khuỷu gập chữ V: cổ tay trước vai, khuỷu chĩa xuống ra ngoài */
const ELBOW = { to: 'shoulder', offset: [36, 30, 0], point: 'wrist', elbow: [0.2, 1, 0.7] };
/** Tay phải dang ngoài túi đeo vai */
const OUT = { to: 'shoulder', offset: [0, 95, 65], point: 'wrist', elbow: [0, 1, 1] };
/** Túi khoác khuỷu, đeo vai */
const KHUYU = { item: 'tui', group: 'carry', on: 'elbow' };
const VAI = { item: 'tui', group: 'carry', on: 'shoulder' };

function world(hands: unknown[], out?: { rt?: ReturnType<typeof resolveScene> }) {
  const sc = parseScene({
    name: 'x', lens, duration: 3,
    cast: [{ id: 'a', character: 'a.json', world: { at: [0, 0, 0], yaw: 90, hands }, tracks: [{ clips: [{ action: 'still', start: 0 }] }] }],
  });
  if (!sc.success) throw new Error(sc.error.message);
  const heights = { a: 1 }, bodies = { a: body3(c) };
  const rt = resolveScene(sc.data, { still }, heights, bodies, HELD);
  if (out) out.rt = rt;
  const bag = new THREE.Group();
  bag.name = 'tui';
  bag.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.1).translate(0, 0.13, 0), new THREE.MeshBasicMaterial()));
  bag.position.set(2, 0, 1);
  const cup = new THREE.Group();
  cup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2), new THREE.MeshBasicMaterial()));
  let cast!: Cast3D;
  const w = buildWorld(sc.data, rt, {
    set: () => plainRoom(),
    extra: (_m, k) => {
      cast = k;
      const g = new THREE.Group();
      g.add(bag, cup);
      k.provide('tui', bag);
      k.provide('coc', cup);
      return { group: g };
    },
  }, { characters: { 'a.json': c }, heights, bodies });
  return { w, bag, cup, cast };
}

const posed = (w: ReturnType<typeof world>['w'], t: number) => {
  const fig = w.pose(t).a;
  w.root.updateMatrixWorld(true);
  return fig;
};
const frame = (w: ReturnType<typeof world>['w']) => (t: number) => {
  const f = posed(w, t);
  return [...heldHands(f, 'a'), ...heldCarries(f, 'a')];
};

describe('món treo: rig treo món trên cánh tay', () => {
  it('khoác khuỷu: đỉnh quai ở chỗ gập, thân món thõng đứng; bàn tay tự do, tay kia cầm cốc', () => {
    const { w, bag, cast } = world([{ t: 0, right: { ...ELBOW, hold: KHUYU }, left: { at: [40, -250, -40], point: 'grip', hold: 'coc@cylinder' } }]);
    const fig = posed(w, 0.5);
    expect(fig.carrying?.[-1]).toMatchObject({ item: 'tui', grip: '@carry////' });
    expect(fig.holding?.[-1]).toBeUndefined();
    expect(fig.hands![-1].held).toBeUndefined();
    expect(fig.holding?.[1]).toMatchObject({ item: 'coc', grip: '@cylinder////' });
    expect(cast.holder('tui', 0.5)).toEqual({ id: 'a', side: -1 });
    const seat = carrySeat(fig, -1, 'elbow');
    const top = bag.localToWorld(new THREE.Vector3(...heldPoint(TUI, 'quai').map((v) => v * 0.01)));
    expect(top.distanceTo(seat.pivot)).toBeLessThan(1e-6);
    expect(seat.bend!).toBeLessThan(CARRY.bend);
    const [m] = heldCarries(fig, 'a');
    expect(m).toMatchObject({ hold: 'tui@carry', on: 'elbow', hand: 'R', obj: bag.id });
    expect(m.body.gap).toBeGreaterThan(-CARRY.body);
    // thân món thẳng đứng, không đẩy khỏi thân
    const up = new THREE.Vector3(0, 1, 0).transformDirection(bag.matrixWorld);
    expect(up.y).toBeCloseTo(1, 6);
  });

  it('đeo vai: đỉnh quai trên đầu vai ngoài khớp vai, tay dang ngoài túi thì không lồng', () => {
    const { w, bag } = world([{ t: 0, right: { ...OUT, hold: VAI } }]);
    const fig = posed(w, 0.5);
    const seat = carrySeat(fig, -1, 'shoulder');
    const sh = fig.arms[-1].shoulder.getWorldPosition(new THREE.Vector3());
    // ngoài khớp vai (tay phải ở −x), cao hơn khớp
    expect(seat.pivot.x).toBeLessThan(sh.x);
    expect(seat.pivot.y).toBeGreaterThan(sh.y);
    const top = bag.localToWorld(new THREE.Vector3(...heldPoint(TUI, 'quai').map((v) => v * 0.01)));
    expect(top.distanceTo(seat.pivot)).toBeLessThan(1e-6);
    const [m] = heldCarries(fig, 'a');
    expect(m.on).toBe('shoulder');
    expect(m.body.gap + (m.body.allow ?? 0)).toBeGreaterThan(-CARRY.body);
    // thân túi ở dưới vai
    const mid = bag.localToWorld(new THREE.Vector3(0, 0.13, 0));
    expect(mid.y).toBeLessThan(sh.y);
  });

  it('`hold: null` gỡ món về chỗ cũ; vẽ nhảy cóc ra cùng chỗ', () => {
    const { w, bag, cast } = world([{ t: 0, right: { ...ELBOW, hold: KHUYU } }, { t: 1, right: { hold: null } }]);
    posed(w, 0.5);
    const at = bag.getWorldPosition(new THREE.Vector3());
    posed(w, 2);
    expect(bag.position.toArray()).toEqual([2, 0, 1]);
    expect(cast.holder('tui', 2)).toBeUndefined();
    const fig = posed(w, 0.5);
    expect(fig.carrying?.[-1]).toBeDefined();
    expect(bag.getWorldPosition(new THREE.Vector3()).distanceTo(at)).toBeLessThan(1e-9);
    posed(w, 2);
    expect(fig.carrying?.[-1]).toBeUndefined();
  });
});

describe('món treo: nhớ lời giải theo dáng người', () => {
  /** Khuỷu gập đổi dần theo giây */
  const MOVING = [{ t: 0, right: { ...ELBOW, hold: KHUYU } }, { t: 1, right: { ...ELBOW, offset: [30, 10, 24], hold: KHUYU } }];
  const meshes = (root: THREE.Object3D) => {
    const m: number[] = [];
    root.updateMatrixWorld();
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) m.push(...o.matrixWorld.elements);
    });
    return m;
  };

  it('cùng dáng thì không giải lại dù tính ma trận nhiều lần hay `pose` lại cùng giây; giây khác, khớp xoay tay thì giải lại', () => {
    const { w, bag } = world(MOVING);
    const fig = posed(w, 0.3);
    const fit = () => fig.carrying![-1]!.fit;
    const a = fit();
    const at = bag.getWorldPosition(new THREE.Vector3());
    expect(a).toBeDefined();
    w.root.updateMatrixWorld(true);
    w.root.updateMatrixWorld(true);
    expect(fit()).toBe(a);
    expect(posed(w, 0.3)).toBe(fig);
    expect(fit()).toBe(a);
    posed(w, 0.6);
    const b = fit();
    expect(b).not.toBe(a);
    expect(bag.getWorldPosition(new THREE.Vector3()).distanceTo(at)).toBeGreaterThan(0.01);
    // dáng đổi ở cùng giây (cảnh sửa tại chỗ): không giữ lời giải cũ
    fig.arms[-1].elbow.rotation.x += 0.2;
    w.root.updateMatrixWorld(true);
    expect(fit()).not.toBe(b);
  });

  it('lời giải nhớ trùng từng số với cảnh dựng mới ở từng giây, đi tới đi lui', { timeout: 30_000 }, () => {
    const { w } = world(MOVING);
    for (const t of [0.2, 0.7, 0.7, 0.2, 1.5, 0.7]) {
      posed(w, t);
      w.root.updateMatrixWorld(true);
      const fresh = world(MOVING).w;
      posed(fresh, t);
      const [x, y] = [meshes(w.root), meshes(fresh.root)];
      expect(x.length).toBe(y.length);
      expect(Math.max(...x.map((v, i) => Math.abs(v - y[i])))).toBe(0);
    }
  });
});

describe('món treo: luật `held`', () => {
  it('tay buông thẳng mà khai khoác khuỷu: `seat` (khuỷu không gập giữ quai)', () => {
    const out: { rt?: ReturnType<typeof resolveScene> } = {};
    const { w } = world([{ t: 0, right: { at: [-40, -150, 0], point: 'wrist', hold: KHUYU } }], out);
    const issues = sceneHeld(out.rt!, { frame: frame(w) });
    const seat = issues.find((i) => i.rule === 'seat')!;
    expect(seat).toBeDefined();
    expect((seat.sample as HeldCarry).bend!).toBeGreaterThan(CARRY.bend);
    expect(heldLine(seat)).toMatch(/quai không nằm trên chỗ treo — `a` tay phải treo tui \(`tui@carry`, khuỷu\): khuỷu mở/);
  });

  it('tay buông sát người mà đeo vai: `body` (cánh tay lồng vào túi); dang tay ra thì hết', () => {
    const out: { rt?: ReturnType<typeof resolveScene> } = {};
    const { w } = world([{ t: 0, right: { at: [-42, -165, 0], point: 'wrist', hold: VAI } }], out);
    const issues = sceneHeld(out.rt!, { frame: frame(w) });
    const body = issues.find((i) => i.rule === 'body')!;
    expect(body).toBeDefined();
    expect((body.sample as HeldCarry).body.part).toMatch(/^(upperArmR|foreArmR|torso)$/);
    expect(heldLine(body)).toMatch(/món treo lồng vào người/);
    const ok: { rt?: ReturnType<typeof resolveScene> } = {};
    const good = world([{ t: 0, right: { ...OUT, hold: VAI } }], ok);
    expect(sceneHeld(ok.rt!, { frame: frame(good.w) }).filter((i) => i.rule === 'body' || i.rule === 'seat')).toEqual([]);
  }, 20000);

  it('món nằm xa lúc treo: `jump` lúc gắn', () => {
    const out: { rt?: ReturnType<typeof resolveScene> } = {};
    const { w, bag, cast } = world([{ t: 0.5, right: { ...ELBOW, hold: KHUYU } }], out);
    const items = (t: number): HeldItemPose[] => {
      posed(w, t);
      const p = bag.getWorldPosition(new THREE.Vector3());
      const q = bag.getWorldQuaternion(new THREE.Quaternion());
      const h = cast.holder('tui', t);
      return [{ obj: bag.id, item: 'tui', p: [p.x / U, -p.y / U, -p.z / U], q: [q.x, q.y, q.z, q.w], shown: true, ...(h && { holder: { id: h.id, hand: h.side < 0 ? 'R' as const : 'L' as const } }) }];
    };
    const jump = sceneHeld(out.rt!, { frame: frame(w), items }).find((i) => i.rule === 'jump')!;
    expect(jump.jump!.kind).toBe('take');
    expect(heldLine(jump)).toMatch(/món nhảy lúc gắn vào tay — `a` tay phải treo tui/);
  });
});
