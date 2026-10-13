import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { body3 } from './core/figure3d';
import { parseAction } from './core/action';
import { parseScene, resolveScene } from './core/scene';
import { defaultCharacter } from './core/schema';
import type { Figure } from './stickman';
import { buildWorld, combineExtras, plainRoom, type Cast3D, type WorldSpec } from './world';

// Cảnh three dựng chung cho sân khấu Remotion và `stickman check`: người nền, đổi đồ theo `equip`, tắt khi mờ, đồ riêng bám người

const action = (json: unknown) => {
  const r = parseAction(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const actions = {
  still: action({ name: 'still', duration: 1, end: 'hold', authoredAt: 'side', keys: [{ t: 0, pose: {} }] }),
  dress: action({ name: 'dress', duration: 2, end: 'hold', authoredAt: 'side', keys: [{ t: 0, pose: {}, equip: { hem: 'base' } }, { t: 0.5, pose: {}, equip: { hem: 'stand' } }] }),
};
const c = defaultCharacter();
c.palette.clad = true;
c.items = { stand: { hem: { ...c.pieces.hem, src: 'sculpt', skirt: { style: 'wrap', length: 150, flare: 0, pleats: 0 } } as never } };
const characters = { 'a.json': c };
const lens = { eye: [0, -200, -1400] as [number, number, number], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 };

function world(spec: Omit<WorldSpec, 'set'> = {}, fade = false) {
  const sc = parseScene({
    name: 'x', lens, duration: 2, marks: { len: 0.5 },
    cast: [
      { id: 'di', character: 'a.json', world: { at: [-200, 0, 300], yaw: 0 }, ...(fade && { fade: [{ t: 0, v: 1 }, { t: 0.5, v: 0 }] }), tracks: [{ clips: [{ action: 'dress', start: 0 }] }] },
      { id: 'ngoi', character: 'a.json', world: { at: [200, -87.5, 300], yaw: 180, sit: true, floor: 0 }, tracks: [{ clips: [{ action: 'still', start: 0 }] }] },
    ],
  });
  if (!sc.success) throw new Error(sc.error.message);
  const ids = ['di', 'ngoi'];
  const heights = Object.fromEntries(ids.map((id) => [id, 1])), bodies = Object.fromEntries(ids.map((id) => [id, body3(c)]));
  const rt = resolveScene(sc.data, actions, {}, {}, heights, bodies);
  return buildWorld(sc.data, rt, { set: () => plainRoom(), ...spec }, { characters, heights, bodies });
}

describe('cảnh three (`buildWorld`)', () => {
  it('người ngồi mặc định đóng băng vào bối cảnh, người đứng diễn theo `sceneAt`', () => {
    const w = world();
    expect(Object.keys(w.pose(0))).toEqual(['di']);
    // bối cảnh và một bản người đứng
    expect(w.root.children).toHaveLength(2);
    expect(Object.keys(world({ still: [] }).pose(0))).toEqual(['di', 'ngoi']);
  });

  it('`keys[].equip` đổi đồ: bản mới dựng lần đầu cần tới, thêm vào `root`, `wear` chạy cho từng bản, bản cũ ẩn', () => {
    const worn: Figure[] = [];
    const w = world({ wear: (id, f) => id === 'di' && worn.push(f) });
    const a = w.pose(0.5).di;
    expect(a.skirt?.hip).toBeFalsy();
    const b = w.pose(1.5).di;
    expect(b).not.toBe(a);
    expect(b.skirt?.hip).toBe(true);
    expect(w.root.children).toContain(b.root);
    expect([a.root.visible, b.root.visible]).toEqual([false, true]);
    expect(worn).toEqual([a, b]);
    expect(w.pose(0.2).di).toBe(a);
  });

  it('`cast[].fade` mờ quá nửa thì tắt người', () => {
    const w = world({}, true);
    expect(w.pose(0.1).di.root.visible).toBe(true);
    expect(w.pose(0.4).di.root.visible).toBe(false);
  });

  it('đồ riêng nhận mốc và người diễn, đặt lại sau khi người đã đặt dáng; đèn riêng vào bộ đèn của bối cảnh', () => {
    const seen: (number[] | null)[] = [];
    let marks: Record<string, number> = {};
    const w = world({
      extra: (m, cast: Cast3D) => {
        marks = m;
        return combineExtras(
          { group: new THREE.Group(), update: () => void seen.push(cast.at('di', 'wristR')) },
          { group: new THREE.Group(), light: () => ({ ceiling: 0.5, lamps: [] }) },
          { group: new THREE.Group(), light: () => ({ ceiling: 0.5, sun: false }) },
        );
      },
      lens: (t) => (t > 1 ? { ...lens, f: 1200 } : undefined),
    });
    expect(marks.len).toBe(0.5);
    w.pose(0);
    const wrist = seen[0]!;
    // cổ tay phải buông dưới vai, cạnh hông người đứng ở x −200
    expect(Math.abs(wrist[0] + 200)).toBeLessThan(60);
    expect(wrist[1]).toBeLessThan(0);
    const l = w.lights(0);
    expect(l.ceiling?.intensity).toBeCloseTo(0.25);
    expect(l.window).toBeUndefined();
    expect(w.view(0.5).lens).toEqual(lens);
    expect(w.view(1.5).lens?.f).toBe(1200);
  });
});
