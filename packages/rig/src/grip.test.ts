import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { hold } from './attach';
import { handDims } from './core/heldGeom';
import { gripCenter, parseHeldItem, type GroupId, type HeldItemSpec } from './core/heldItem';
import { holdHand } from './core/holdLink';
import { defaultCharacter } from './core/schema';
import type { Figure, Side } from './stickman';
import type { HoldGrip } from './attach';
import dienThoai from './core/__fixtures__/held-v2/dien-thoai.json';

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true });
  const g = globalThis as { document?: unknown; Path2D?: unknown };
  g.Path2D ??= class { moveTo() {} lineTo() {} ellipse() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} rect() {} };
  g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
});

/** Đứng, hai tay chĩa ra trước, khuỷu gập; `turn`, `bend` của cổ tay */
const reach = (turn = 0, bend = 0): Acting => ({
  pose: {
    af: [0, 60, 0, 30], an: [0, 60, 0, 30], lf: [0, 0], ln: [0, 0], torso: 0, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1],
    lift: { af: true, an: true },
    hand: { an: [turn, bend, 0, 0, 0, 0, 0, 0, 0, 0, 0], af: [turn, bend, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  },
  world: { hip: [0, -170, 0], yaw: Math.PI / 2, s: 1.2, flip: false },
  mouth: 'closed', brow: 'neutral', eyes: 'open',
});

async function person(sleeve?: number): Promise<Figure> {
  const { fromCharacter } = await import('./stickman');
  const c = defaultCharacter();
  c.palette.clad = true;
  if (sleeve) c.palette.sleeveWidth = sleeve;
  const p = fromCharacter(c as unknown as Parameters<typeof fromCharacter>[0]);
  new THREE.Scene().add(p.root);
  return p;
}

const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

const PHONE = spec(dienThoai);

/** Điện thoại có nhóm con `chum` treo theo trọng lực */
const KEYS = spec({ ...dienThoai, hang: ['chum'] });

/** Chỗ cầm nhóm của tay dẫn (`món@nhóm`, trường thiếu lấy mặc định của nhóm) */
const lead = (item: string, s: HeldItemSpec, group: GroupId): HoldGrip => {
  const grip = `@${group}////`;
  return { item, spec: s, grip, hold: { item, grip, spec: s, since: 0, grasp: { hold: { item, group }, mode: 'hand', choice: {}, t0: 0 } } };
};
const PB = lead('dien-thoai', PHONE, 'palmBox');

const phone = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.36, 0.035), new THREE.MeshBasicMaterial()));
  g.name = 'dien-thoai';
  return g;
};
const world = (o: THREE.Object3D, p: readonly number[]) => o.localToWorld(new THREE.Vector3(p[0], p[1], p[2]));

describe('hold({ grip }): món cứng theo bàn tay', () => {
  it('điểm nắm của món trùng tâm nắm của dáng, hai tay, hai cỡ tay; `holding` ghi món và chỗ cầm', async () => {
    for (const sleeve of [undefined, 30]) {
      const p = await person(sleeve);
      act(p, reach(30, 20));
      for (const side of [-1, 1] as Side[]) {
        const o = phone();
        const H = p.hands![side];
        const x = holdHand(PB.hold!, side, handDims(H.scale, H.long ?? H.scale))!;
        const h = hold(p, o, { hand: side, grip: PB });
        p.root.updateMatrixWorld(true);
        const want = world(p.arms[side].wrist, gripCenter(x.hand.pose, side, H.scale, H.long));
        const got = world(o, x.hand.at.map((v) => v * 0.01));
        expect(got.distanceTo(want)).toBeLessThan(1e-6);
        expect(p.holding?.[side]).toMatchObject({ item: 'dien-thoai', grip: '@palmBox////', pose: x.hand.pose, follow: 'wrist', both: false });
        expect(H.held).toBe(x.hand.pose);
        // món không soi gương: khung món vẫn là phép quay thật
        expect(o.matrixWorld.determinant()).toBeGreaterThan(0);
        h.release();
        expect(p.holding?.[side]).toBeUndefined();
        expect(H.held).toBeUndefined();
      }
    }
  });

  it('món đi cứng theo cổ tay: xoay cẳng tay thì món trong khung bàn tay không đổi', async () => {
    const p = await person();
    const o = phone();
    act(p, reach(0, 0));
    hold(p, o, { hand: -1, grip: PB });
    const rel = () => {
      p.root.updateMatrixWorld(true);
      return new THREE.Matrix4().copy(p.arms[-1].wrist.matrixWorld).invert().multiply(o.matrixWorld);
    };
    const a = rel();
    act(p, reach(70, -40));
    const b = rel();
    a.elements.forEach((x, i) => expect(b.elements[i]).toBeCloseTo(x, 9));
  });

  it('không đi cùng tham số đường cũ; chỗ cầm một tay không cầm hai tay được; thiếu chỗ cầm nhóm là lỗi', async () => {
    const p = await person();
    act(p, reach());
    expect(() => hold(p, phone(), { hand: -1, grip: PB, follow: 'level' })).toThrow(/không đi cùng/);
    expect(() => hold(p, phone(), { hand: 'both', grip: PB })).toThrow(/hai tay/);
    expect(() => hold(p, phone(), { hand: -1, grip: { item: 'dien-thoai', spec: PHONE, grip: 'nope' } })).toThrow(/không cầm bằng bàn tay/);
  });

  it('nhóm `hang` thõng thẳng đứng dù cổ tay xoay; buông thì về như cũ', async () => {
    const p = await person();
    const o = new THREE.Group();
    const chum = new THREE.Group();
    chum.name = 'chum';
    o.add(chum);
    act(p, reach(60, 50));
    const h = hold(p, o, { hand: 1, grip: lead('chia', KEYS, 'palmBox') });
    p.root.updateMatrixWorld(true);
    const up = new THREE.Vector3(0, 1, 0).transformDirection(chum.matrixWorld);
    expect(up.y).toBeCloseTo(1, 6);
    // ra ngoài `check`: tính ma trận bằng `updateWorldMatrix` cũng thõng đúng
    act(p, reach(-60, -30));
    chum.updateWorldMatrix(true, false);
    expect(new THREE.Vector3(0, 1, 0).transformDirection(chum.matrixWorld).y).toBeCloseTo(1, 6);
    h.release();
    expect(chum.quaternion.equals(new THREE.Quaternion())).toBe(true);
  });
});

/** Gậy đứng bán kính 2,5 (cán), có hình va chạm */
const ROD = spec({
  schemaVersion: 2,
  size: [5, 30, 5],
  anchors: { mid: { at: [0, 0, 0] } },
  shape: [{ cyl: 2.5, from: [0, -15, 0], to: [0, 15, 0] }],
});
const rod = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 24), new THREE.MeshBasicMaterial()));
  g.name = 'gay';
  return g;
};

describe('ngón ôm theo đồ: món có hình va chạm', () => {
  it('cầm thì từng đốt gập thêm (`Hand.fit`), hai tay, hai cỡ tay; không ngón nào lún, ngón vai trò buộc chạm thì chạm; buông thì về dáng hành động', async () => {
    const { heldHands } = await import('./held');
    const { HELD_PIERCE_FIT, heldRoleOpen } = await import('./core/heldAudit');
    for (const sleeve of [undefined, 30]) {
      const p = await person(sleeve);
      act(p, reach(20, 10));
      for (const side of [-1, 1] as Side[]) {
        const h = hold(p, rod(), { hand: side, grip: lead('gay', ROD, 'cylinder') });
        const H = p.hands![side];
        expect(H.fit).toHaveLength(10);
        expect(H.shown).toHaveLength(19);
        p.root.updateMatrixWorld(true);
        const [m] = heldHands(p, 'a').filter((x) => x.hand === (side < 0 ? 'R' : 'L'));
        expect(m.roles).toBeDefined();
        expect(m.pierce.core).toBeLessThan(HELD_PIERCE_FIT);
        expect(heldRoleOpen(m)).toEqual([]);
        h.release();
        expect(H.fit).toBeUndefined();
        expect(H.shown).toHaveLength(9);
      }
    }
  });
});
