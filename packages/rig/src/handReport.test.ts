import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { body3 } from './core/figure3d';
import { parseHeldItem, type HeldItemSpec } from './core/heldItem';
import { handReport, parseScene, resolveScene } from './core/scene';
import { parseCharacter } from './core/schema';
import { heldHands } from './held';
import { buildWorld, plainRoom, type Cast3D } from './world';
import fx from './core/__fixtures__/nguoi-cam-bang.json';
import bangGia from './core/__fixtures__/held-v2/bang-gia.json';
import dienThoai from './core/__fixtures__/held-v2/dien-thoai.json';

// `handReport` của lõi trùng `heldHands` đọc trên cảnh three ở góc cổ tay và phần vượt kẹp (docs/11-nhom-cam.md § Báo tay cho studio)

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

const SHEET = { item: 'bang-gia', group: 'sheet', edge: 'right', along: 0.33, thumb: 'front' };
const bang = (t: number, offset: number[]) => ({
  t, cast: 'nguoi', item: 'bang-gia', to: 'chest', offset,
  face: { axis: 'front', toward: 'holderFace' }, roll: { axis: 'top', toward: 'up' },
});
// theo mốc, hai tay theo mốc, tay dẫn
const HANDS = [
  { t: 0, right: { hold: SHEET } },
  { t: 1.5, right: { hold: { item: 'bang-gia', group: 'sheet', edge: 'left' } }, left: { hold: { item: 'bang-gia', group: 'sheet', edge: 'right' } } },
  { t: 2.5, right: { hold: null }, left: { hold: null } },
  { t: 3, right: { at: [214, -260, 470], point: 'grip', hold: { item: 'dien-thoai', group: 'palmBox', face: { axis: 'screen', toward: { mark: 'head' } } } } },
  { t: 3.6, right: { at: [190, -330, 480], point: 'grip' } },
];
const ITEMS = [bang(0.3, [30, -2.9, 0]), bang(1.2, [38, -14, 8]), bang(1.7, [35, 0, 0]), bang(2.3, [33, -4, 0])];

function world() {
  const sc = parseScene({
    duration: 4,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [{ id: 'nguoi', character: 'nguoi.json', base: { torso: 9, head: [0, 0, -6] }, world: { at: [250, 0, 506], yaw: 270, hands: HANDS } }],
    items: ITEMS,
  });
  if (!sc.success) throw new Error(sc.error.message);
  const rt = resolveScene(sc.data, {}, {}, {}, { nguoi: H }, bodies, HELD);
  const w = buildWorld(sc.data, rt, {
    set: () => plainRoom(),
    extra: (_m, cast: Cast3D) => {
      const g = new THREE.Group();
      for (const item of Object.keys(HELD)) {
        const o = new THREE.Group();
        o.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.01), new THREE.MeshBasicMaterial()));
        g.add(o);
        cast.provide(item, o);
      }
      return { group: g };
    },
  }, { characters: { 'nguoi.json': NGUOI }, heights: { nguoi: H }, bodies });
  return { w, rt };
}

describe('handReport trùng heldHands', () => {
  it('góc cổ tay, phần vượt kẹp, khuỷu ở cả ba chế độ', () => {
    const { w, rt } = world();
    const seen = new Set<string>();
    for (let i = 0; i <= 120; i++) {
      const t = i / 30;
      const fig = w.pose(t).nguoi;
      for (const x of heldHands(fig, 'nguoi')) {
        const g = x.grasp;
        if (!g) continue;
        const side = x.hand === 'R' ? 'right' : 'left';
        const h = handReport(rt, 'nguoi', side, t, { char: fig.body })!;
        seen.add(h.mode);
        const wr = g.mode === 'hand' || g.keyed ? h.wrist.drawn : h.wrist.raw!;
        expect(Math.abs(wr.turn - g.arm.wrist.turn)).toBeLessThan(1e-6);
        expect(Math.abs(wr.bend - g.arm.wrist.bend)).toBeLessThan(1e-6);
        expect(Math.abs(wr.dev - g.arm.wrist.dev)).toBeLessThan(1e-6);
        const o = h.wrist.over;
        expect(Math.abs(Math.max(o.turn, o.bend, o.dev) - g.arm.wrist.over)).toBeLessThan(1e-6);
        // khuỷu vẽ trên hình three
        const E = fig.arms[x.hand === 'R' ? -1 : 1].elbow.getWorldPosition(new THREE.Vector3());
        const e = h.joints.elbow;
        expect(Math.hypot(E.x * 100 - e[0], -E.y * 100 - e[1], -E.z * 100 - e[2])).toBeLessThan(1e-6);
      }
    }
    expect([...seen].sort()).toEqual(['both', 'hand', 'keyed']);
  });
});
