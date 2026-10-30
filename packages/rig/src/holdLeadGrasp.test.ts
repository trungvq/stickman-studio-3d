import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { body3 } from './core/figure3d';
import { parseHeldItem, type HeldItemSpec } from './core/heldItem';
import { parseScene, resolveScene } from './core/scene';
import { parseCharacter } from './core/schema';
import { heldHands } from './held';
import { buildWorld, plainRoom, type Cast3D } from './world';
import fx from './core/__fixtures__/nguoi-cam-bang.json';
import dienThoai from './core/__fixtures__/held-v2/dien-thoai.json';

// Tay dẫn cầm món v2 (`mode: "hand"`) mang báo chỗ cầm `AimReport.hold.grasp` như món đặt trước

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true });
  const g = globalThis as { document?: unknown; Path2D?: unknown };
  g.Path2D ??= class { moveTo() {} lineTo() {} ellipse() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} rect() {} };
  g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
});

const r = parseHeldItem(dienThoai);
if (!r.success) throw new Error(r.error.message);
const HELD: Record<string, HeldItemSpec> = { 'dien-thoai': r.data };
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error('nguoi');
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const bodies = { nguoi: body3(NGUOI) };

function world(hands: unknown[]) {
  const sc = parseScene({
    duration: 4,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [{ id: 'nguoi', character: 'nguoi.json', base: { torso: 9, head: [0, 0, -6] }, world: { at: [250, 0, 506], yaw: 270, hands } }],
  });
  if (!sc.success) throw new Error(sc.error.message);
  const rt = resolveScene(sc.data, {}, { nguoi: H }, bodies, HELD);
  return buildWorld(sc.data, rt, {
    set: () => plainRoom(),
    extra: (_m, cast: Cast3D) => {
      const g = new THREE.Group();
      const o = new THREE.Group();
      o.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.01), new THREE.MeshBasicMaterial()));
      g.add(o);
      cast.provide('dien-thoai', o);
      return { group: g };
    },
  }, { characters: { 'nguoi.json': NGUOI }, heights: { nguoi: H }, bodies });
}

const finite = (x: number) => Number.isFinite(x);

describe('tay dẫn v2: `AimReport.hold.grasp`', () => {
  it('không ý định: `mode: "hand"`, lựa chọn đủ, nguồn chỉ `scene` / `default`, cánh tay đọc trên tay đã vẽ', () => {
    const w = world([{ t: 0, right: { to: 'chest', offset: [30, 20, -20], point: 'grip', hold: 'dien-thoai@palmBox' } }]);
    const fig = w.pose(1).nguoi;
    const g = fig.aim?.R.hold?.grasp;
    expect(g).toMatchObject({ item: 'dien-thoai', group: 'palmBox', mode: 'hand', t0: 0 });
    expect(g!.choice.featureIndex).toBeTypeOf('number');
    expect(g!.choice.feature).toBeDefined();
    expect(Object.values(g!.by).every((b) => b === 'default')).toBe(true);
    expect(Object.keys(g!.by)).toContain('feature');
    const a = g!.arm;
    for (const x of [a.phi, a.wrist.turn, a.wrist.bend, a.wrist.dev, a.body, a.gap]) expect(finite(x)).toBe(true);
    expect(a.wrist.off).toBe(0);
    const held = heldHands(fig, 'nguoi').find((h) => h.hand === 'R');
    expect(held?.grasp).toEqual(g);
  });

  it('trường cảnh khai là `scene`, có ý định thì báo ý định giữ nguyên', () => {
    const w = world([{
      t: 0,
      right: {
        to: 'chest', offset: [30, 20, -20], point: 'grip',
        hold: { item: 'dien-thoai', group: 'palmBox', tilt: 10, face: { axis: 'screen', toward: 'camera' } },
      },
    }]);
    const fig = w.pose(1).nguoi;
    const h = fig.aim?.R.hold;
    expect(h?.toward).toBe('camera');
    expect(h?.grasp?.mode).toBe('hand');
    expect(h?.grasp?.choice.tilt).toBe(10);
    expect(h?.grasp?.by.tilt).toBe('scene');
    expect(Object.values(h!.grasp!.by)).not.toContain('rig');
  });
});
