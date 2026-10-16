import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { hold } from './attach';
import { defaultCharacter } from './core/schema';
import { HELD_PIERCE } from './core/heldAudit';
import { heldHands } from './held';
import type { Figure } from './stickman';

// Người que three cần canvas cho nét mặt: một canvas giả đủ để dựng hình, không vẽ gì
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true });
  const g = globalThis as { document?: unknown; Path2D?: unknown };
  g.Path2D ??= class { moveTo() {} lineTo() {} ellipse() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} rect() {} };
  g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
});

/** Đứng, hai tay chĩa ra trước, khuỷu gập; `turn` xoay cẳng tay */
const reach = (turn = 0): Acting => ({
  pose: {
    af: [0, 60, 0, 30], an: [0, 60, 0, 30], lf: [0, 0], ln: [0, 0], torso: 0, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1],
    lift: { af: true, an: true }, hand: { an: [turn, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  },
  world: { hip: [0, -170, 0], yaw: Math.PI / 2, s: 1, flip: false },
  mouth: 'closed', brow: 'neutral', eyes: 'open',
});

async function person(): Promise<Figure> {
  const { fromCharacter } = await import('./stickman');
  const c = defaultCharacter();
  c.palette.clad = true;
  const p = fromCharacter(c as unknown as Parameters<typeof fromCharacter>[0]);
  new THREE.Scene().add(p.root);
  return p;
}

const mesh = (g: THREE.BufferGeometry, name: string) => {
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  m.name = name;
  return m;
};

describe('heldHands: đo đồ cầm trên người 3D', () => {
  it('`hold` ghi món vào `Figure.holding`, `release` xoá', async () => {
    const p = await person();
    act(p, reach());
    const h = hold(p, mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), 'hop'), { hand: -1, pose: 'pinch' });
    expect(p.holding?.[-1]).toMatchObject({ pose: 'pinch', follow: 'wrist', both: false });
    expect(heldHands(p, 'a').map((x) => [x.hand, x.item, x.pose])).toEqual([['R', 'hop', 'pinch']]);
    h.release();
    expect(p.holding?.[-1]).toBeUndefined();
    expect(heldHands(p, 'a')).toEqual([]);
  });

  it('hộp to hơn nắm tay ở tâm nắm: ngón vào trong món; que mảnh trong nắm tay: không quá ngưỡng', async () => {
    const p = await person();
    act(p, reach());
    const big = hold(p, mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), 'hop'), { hand: -1 });
    const [b] = heldHands(p, 'a');
    expect(b.pierce.core).toBeGreaterThan(HELD_PIERCE);
    expect(b.grip).toBeLessThan(0);
    big.release();
    // que dọc theo phía ngón cái (z khung bàn tay) qua tâm nắm, như cán đũa
    hold(p, mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.4).rotateX(Math.PI / 2), 'que'), { hand: -1 });
    const [q] = heldHands(p, 'a');
    expect(q.pierce.core).toBeLessThan(HELD_PIERCE);
    expect(q.pierce.core).toBeGreaterThan(-0.5);
  });

  it('trục ý định: hộp bám cổ tay khai `up` nghiêng theo cổ tay; `level` giữ đứng mà món trôi trong khung bàn tay', async () => {
    const p = await person();
    const box = mesh(new THREE.BoxGeometry(0.03, 0.06, 0.03), 'ly');
    // bám cổ tay: khung món là khung bàn tay, trục phía ngón cái quay theo xoay cẳng tay
    box.userData.hold = { up: [0, 0, 1] };
    act(p, reach(0));
    const w = hold(p, box, { hand: -1 });
    const a = heldHands(p, 'a')[0];
    act(p, reach(80));
    p.root.updateMatrixWorld(true);
    const b = heldHands(p, 'a')[0];
    expect(Math.abs(b.up! - a.up!)).toBeGreaterThan(40);
    expect(b.rel.q.map((x, i) => Math.abs(x - a.rel.q[i])).every((d) => d < 1e-6)).toBe(true);
    w.release();
    box.userData.hold = { up: [0, 1, 0] };
    act(p, reach(0));
    hold(p, box, { hand: -1, follow: 'level' });
    p.root.updateMatrixWorld(true);
    const c = heldHands(p, 'a')[0];
    act(p, reach(80));
    p.root.updateMatrixWorld(true);
    const d = heldHands(p, 'a')[0];
    expect(d.up!).toBeLessThan(1);
    const dq = Math.abs(c.rel.q[0] * d.rel.q[0] + c.rel.q[1] * d.rel.q[1] + c.rel.q[2] * d.rel.q[2] + c.rel.q[3] * d.rel.q[3]);
    expect((2 * Math.acos(Math.min(1, dq)) * 180) / Math.PI).toBeGreaterThan(40);
  });
});
