import * as THREE from 'three';
import { addItem, addLathe, Batch, bar, body3, box, buildWorld, parseCharacter, parseHeldItem, parseScene, resolveScene, SCULPT_PRESETS } from '@stickman3d/rig';
import { ACTIONS } from './demos.js';
import tuiJson from '../../studio/public/held/tui.json';
import cocJson from '../../studio/public/held/coc.json';

// `?demo=carry`: món treo trên cánh tay (kiểu treo, `held/tui.json` của bộ chung) qua `world.hands[].hold` và
// `cast.provide` như repo video. Trái: túi đeo vai phải, tay luồn ngoài quai, tay trái cầm cốc. Phải: túi khoác khuỷu
// trái gập chữ V, váy, tay phải cầm cốc.

const tone = (top, lit = top) => ({ top, lit });

function character(name, { palette, garment, hair, hairColor, skirt }) {
  const r = parseCharacter({
    name,
    head: { form: 'human' },
    palette: { skin: '#f8e3c8', line: '#1c1c1e', clad: true, ...palette },
    pieces: {
      torso: { src: 'sculpt', garment },
      hair: { src: 'sculpt', color: hairColor, sculpt: SCULPT_PRESETS[hair].sculpt },
      ...(skirt && { hem: { src: 'sculpt', color: skirt, skirt: {} } }),
    },
  });
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  return r.data;
}

const held = (j) => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

/**
 * Túi theo `held/tui.json`: khung món y lên, +z mặt trước; `Batch` dựng ở hệ rig (y xuống, z vào cảnh) nên đảo y, z. Thân
 * hộp 30 × 26 × 10, hai quai chữ nhật trước sau, mép dưới thanh ngang của quai ở mốc `quai` (y 74)
 */
function bag(color) {
  const b = new Batch();
  const C = tone(color, color), H = tone('#3a2a22', '#2b1f19'), G = tone('#d8b25a', '#b8933f');
  const parts = [{ v: box(-15, 15, -26, 0, -5, 5), tone: C }, { v: box(-4, 4, -18, -14, -5.6, -5), tone: G }];
  for (const z of [-3, 3])
    for (const x of [-12, 12]) parts.push({ v: bar([x, -26, z], [x, -74, z], 1, 1), tone: H });
  for (const z of [-3, 3]) parts.push({ v: box(-13, 13, -76, -74, z - 1, z + 1), tone: H });
  addItem(b, { at: { at: [0, 0, 0] }, name: 'tui', parts });
  return b.build();
}

/** Cốc theo `held/coc.json`: thân cao 20 bán kính 8,5, quai sau lưng (−z của món) */
function mug() {
  const b = new Batch();
  const W = tone('#f4efe4', '#ddd5c6');
  addLathe(b, { rings: [[0, 0], [0, 8], [-20, 8.5], [-20, 0]], tone: [W, W, tone('#5b3a24')] }, { at: [0, 0, 0] });
  addItem(b, { at: { at: [0, 0, 0] }, name: 'coc', parts: [
    { v: box(-1.5, 1.5, -16, -13, 7, 14), tone: W },
    { v: box(-1.5, 1.5, -6, -3, 7, 14), tone: W },
    { v: box(-1.5, 1.5, -16, -3, 12, 15), tone: W },
  ] });
  return b.build();
}

/** Cảnh `?demo=carry` */
export function carryDemo() {
  const people = {
    a: character('vai', { palette: { garment: '#e8d9c0', sleeve: '#e8d9c0', trouser: '#2f3a4a', shoe: '#3a2a20' }, garment: { style: 'blouse' }, hair: 'bob', hairColor: '#3b3038' }),
    b: character('khuyu', { palette: { garment: '#b8434e', sleeve: '#b8434e', sleeveLength: 0.45, trouserLength: 0, shoe: '#2a2a2a' }, garment: { style: 'blouse', hem: -18 }, hair: 'shoulder', hairColor: '#2a1c15', skirt: '#2b2b33' }),
  };
  const HANDS = {
    a: [{ t: 0,
      right: { at: [-200, -185, -10], point: 'wrist', elbow: [-0.6, 1, 0], hold: 'tui#vai' },
      left: { to: 'chest', offset: [55, 40, 22], point: 'grip', elbow: [0, 1, 0.4], hold: 'coc#quai' } }],
    b: [{ t: 0,
      left: { to: 'shoulder', offset: [36, 30, 0], point: 'wrist', elbow: [0.7, 1, -0.2], hold: 'tui#khuyu' },
      right: { to: 'chest', offset: [55, 40, 22], point: 'grip', elbow: [0, 1, 0.4], hold: 'coc#quai' } }],
  };
  const sc = parseScene({
    name: 'demo-carry', duration: 3,
    lens: { eye: [0, -250, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 },
    cast: ['a', 'b'].map((id, i) => ({
      id, character: `${id}.json`, world: { at: [i ? 110 : -110, 0, 0], yaw: 90, hands: HANDS[id] },
      tracks: [{ clips: [{ action: 'stand-3d', start: 0 }] }],
    })),
  });
  if (!sc.success) throw new Error(sc.error.message);
  const heights = { a: 1, b: 1 };
  const bodies = { a: body3(people.a), b: body3(people.b) };
  const rt = resolveScene(sc.data, ACTIONS, {}, {}, heights, bodies, { tui: held(tuiJson), coc: held(cocJson) });
  const group = new THREE.Group();
  const set = { group, room: { cull() {} }, palette: 'day', lights: () => ({}) };
  const world = buildWorld(sc.data, rt, {
    set: () => set,
    extra: (_m, cast) => {
      const g = new THREE.Group();
      for (const [id, color] of [['a', '#8a5a3a'], ['b', '#e3c27a']]) {
        const t = bag(color), c = mug();
        g.add(t, c);
        cast.provide('tui', t, id);
        cast.provide('coc', c, id);
      }
      return { group: g };
    },
  }, { characters: { 'a.json': people.a, 'b.json': people.b }, heights, bodies }, set);
  return {
    objects: [world.root],
    animate: (t) => world.pose(t),
  };
}
