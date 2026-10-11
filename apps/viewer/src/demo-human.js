import { act, addItem, Batch, body3, box, dress, fromCharacter, GLASSES_PRESETS, parseAction, parseCharacter, parseScene, resolveScene, sceneAt, SCULPT_PRESETS } from '@stickman3d/rig';
import { ACTIONS } from './demos.js';
import { SAMPLE_ITEMS } from './demo-hold.js';

// Người 3D mặc đồ (`?demo=human`, `human-row`, `human-faces`): JSON nhân vật bật `palette.clad` và `head.form: "human"`,
// qua `parseCharacter` rồi `fromCharacter` như repo video. `?stick` bỏ hai cờ ấy: cùng cảnh, người que như cũ.

const STICK = new URLSearchParams(location.search).has('stick');

/** JSON nhân vật mẫu; `palette` và `head` đè lên phần chung */
function character(name, { palette, garment, hair, hairColor, skirt, glasses, hipHalf = 14 }) {
  const json = {
    name,
    rig: { stroke: 6, height: 1, shoulderHalf: 46, shoulderDrop: 20, hipHalf },
    head: { form: 'human' },
    palette: { skin: '#f8e3c8', line: '#1c1c1e', sleeveWidth: 19, trouserWidth: 22, clad: true, ...palette },
    pieces: {
      torso: { src: 'sculpt', garment },
      hair: { src: 'sculpt', color: hairColor, sculpt: SCULPT_PRESETS[hair].sculpt },
      ...(skirt ? { hem: { src: 'sculpt', color: skirt.color, skirt: skirt.shape } } : {}),
      ...(glasses ? { faceAcc: { src: 'sculpt', color: '#3a2a22', glasses: GLASSES_PRESETS[glasses].glasses } } : {}),
    },
  };
  if (STICK) {
    delete json.head;
    delete json.palette.clad;
    Object.assign(json.palette, { sleeveWidth: 8, trouserWidth: 9 });
  }
  const r = parseCharacter(json);
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  return r.data;
}

/** Năm người mẫu; dựng lúc gọi cảnh, không lúc nạp app */
const models = () => ({
  /** Nam sơ mi dài tay, quần âu */
  LONG: character('dai-tay', {
    palette: { garment: '#3aa89c', sleeve: '#3aa89c', trouser: '#3b4252', shoe: '#3a2a20', bicep: 0.35 },
    garment: { style: 'shirt' }, hair: 'short', hairColor: '#2a1c15',
  }),
  /** Nam áo phông ngắn tay, quần bò */
  SHORT: character('ngan-tay', {
    palette: { garment: '#c8663a', sleeve: '#c8663a', sleeveLength: 0.24, trouser: '#41587a', bicep: 0.35 },
    garment: { style: 'tshirt' }, hair: 'anime', hairColor: '#33333a',
  }),
  /** Nữ blouse tay lỡ, váy xếp ly, chân trần, giày đỏ nâu */
  GIRL: character('vay', {
    palette: { garment: '#7893ae', sleeve: '#7893ae', sleeveLength: 0.45, trouserLength: 0, shoe: '#7a3b2e', trouserWidth: 20 },
    garment: { style: 'blouse', hem: -18 }, hair: 'bob', hairColor: '#3b3038', hipHalf: 15,
    skirt: { color: '#3a3f4a', shape: { rise: 27, waist: 31, length: 52, flare: 22, pleats: 8 } },
  }),
  /** Nam len cổ tròn, đeo kính, tóc gọn */
  GLASSES: character('kinh', {
    palette: { garment: '#9a5fa8', sleeve: '#9a5fa8', trouser: '#2f3a33', bicep: 0.35 },
    garment: { style: 'sweater' }, hair: 'neat', hairColor: '#5b3a26', glasses: 'round',
  }),
  /** Nữ tóc đuôi ngựa, áo len, quần dài */
  PONY: character('duoi-ngua', {
    palette: { garment: '#e0b23a', sleeve: '#e0b23a', trouser: '#34466e', trouserWidth: 20 },
    garment: { style: 'sweater', hem: -10 }, hair: 'ponyLow', hairColor: '#3b2a22', hipHalf: 15,
  }),
});

const keyAction = (name, mask, keys, extra = {}) => {
  const r = parseAction({ schemaVersion: 14, name, duration: 0.6, end: 'hold', mask, keys, events: [], ...extra });
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  return r.data;
};
const own = () => ({
  // tay gần giơ lên khi nói: cẳng tay dựng trước ngực, bàn tay ngang vai
  'talk-raise-3d': keyAction('talk-raise-3d', ['armNear'], [
    { t: 0, pose: { armNear: [0, 0, 0] }, ease: 'smooth' },
    { t: 1, pose: { armNear: [35, 95, 0, 10] }, ease: 'linear' },
  ], { authoredAt: 'side' }),
  'hold-mug': keyAction('hold-mug', ['armNear'], [{ t: 0, pose: {}, reach: { armNear: { at: [38, -62, 14], elbow: [-0.4, 1, 0.4] } }, ease: 'linear' }], { authoredAt: 'side' }),
  'chin-rest-3d': keyAction('chin-rest-3d', ['armNear'], [{ t: 0, pose: {}, reach: { armNear: { at: [45, -131, 6], elbow: [0.3, 1, 0.1] } }, ease: 'linear' }], { authoredAt: 'side' }),
  'face-wry': keyAction('face-wry', ['face'], [{ t: 0, pose: {}, face: { mouth: 'wryOpen', brow: 'skeptical', eyes: 'open' }, ease: 'linear' }]),
});

const LENS = { eye: [0, -200, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 };
const clip = (action, start = 0, extra = {}) => ({ action, start, ...extra });
const track = (...clips) => ({ clips });

/** Mặt ghế đẩu cao bằng gối người `height = 1` */
const SEAT = 87.5;

/** Bàn và ghế đẩu ở chiều sâu `z` cho người cao `h` (`rig.height`): ghế cao bằng gối, mặt bàn cao hơn hông ngồi ~51·h như `arms-on-table-3d` */
function desk(x0, stool, z, h) {
  const b = new Batch();
  const wood = { top: '#c9a679', lit: '#a98559' }, metal = { top: '#77736e', lit: '#5f5b57' };
  const top = SEAT * h + 55 * h, seat = SEAT * h;
  addItem(b, { at: { at: [0, 0, z] }, parts: [
    { v: box(x0, x0 + 90, -top, -top + 6, -66, 66), tone: wood },
    ...[[x0 + 5, -60], [x0 + 85, -60], [x0 + 5, 60], [x0 + 85, 60]].map(([x, z]) => ({ v: box(x - 3, x + 3, -top + 6, 0, z - 3, z + 3), tone: metal })),
    { v: box(stool - 30, stool + 30, -seat, -seat + 7.5, -30, 30), tone: wood },
    { v: box(stool - 3, stool + 3, -seat + 7.5, 0, -3, 3), tone: metal },
  ] });
  return b.build();
}

const SCENES = {
  // cảnh diễn: nói giơ tay, đi bộ, ngồi bàn chống cằm, cầm cốc, nữ đi
  human: ({ LONG, SHORT, GIRL, GLASSES }) => ({
    cast: [
      { id: 'noi', c: LONG, world: { at: [-330, 0, 0], yaw: 60 }, tracks: [track(clip('stand-3d')), track(clip('talk-raise-3d', 0.3)), track(clip('face-delighted')), track(clip('talk-lips', 0.4))] },
      { id: 'di', c: SHORT, world: { path: [{ t: 0, at: [-300, 0, 220], yaw: 10 }, { t: 4, at: [260, 0, 160], yaw: 10 }] }, tracks: [track(clip('walk')), track(clip('face-calm'))] },
      { id: 'ngoi', c: GIRL, world: { at: [-20, -SEAT * GIRL.rig.height, -150], yaw: 0, sit: true, floor: 0 }, tracks: [track(clip('sit-3d')), track(clip('arms-on-table-3d')), track(clip('chin-rest-3d', 0.3)), track(clip('face-sad'))] },
      { id: 'coc', c: GLASSES, world: { at: [330, 0, -40], yaw: 120 }, tracks: [track(clip('stand-3d')), track(clip('hold-mug')), track(clip('face-calm'))], equip: { handNear: 'mug' } },
      { id: 'nu-di', c: GIRL, world: { path: [{ t: 0, at: [380, 0, -330], yaw: 170 }, { t: 4, at: [-200, 0, -330], yaw: 170 }] }, tracks: [track(clip('walk')), track(clip('face-calm'))] },
    ],
    props: [desk(40 * GIRL.rig.height, -20, -150, GIRL.rig.height)],
  }),
  // hàng đứng nhìn ống kính: soi các góc
  'human-row': ({ LONG, SHORT, GIRL, GLASSES, PONY }) => ({
    cast: [LONG, SHORT, GIRL, GLASSES, PONY].map((c, i) => ({ id: `r${i}`, c, world: { at: [(i - 2) * 150, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('face-calm'))] })),
  }),
  // cận mặt: cười, buồn, nói, méo há
  'human-faces': ({ LONG, GIRL, GLASSES, PONY }) => ({
    cast: [[LONG, 'face-delighted'], [GIRL, 'face-sad'], [GLASSES, 'talk-lips'], [PONY, 'face-wry']].map(([c, f], i) => ({
      id: `m${i}`, c, world: { at: [(i - 1.5) * 150, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip(f, f === 'talk-lips' ? 0.2 : 0))],
    })),
  }),
};

/** Dựng cảnh `name` của người 3D mặc đồ; không có thì `null` */
export function humanDemo(name) {
  const make = SCENES[name];
  if (!make) return null;
  const { cast, props = [] } = make(models());
  const scene = parseScene({ name: `demo-${name}`, lens: LENS, cast: cast.map((m) => ({ id: m.id, character: `${m.id}.json`, world: m.world, tracks: m.tracks })) });
  if (!scene.success) throw new Error(scene.error.message);
  const bodies = Object.fromEntries(cast.map((m) => [m.id, body3(m.c)]));
  const heights = Object.fromEntries(cast.map((m) => [m.id, m.c.rig.height]));
  const rt = resolveScene(scene.data, { ...ACTIONS, ...own() }, {}, {}, heights, bodies);
  const people = cast.map((m, i) => ({
    ...m,
    fig: fromCharacter(m.c, { seed: i, items: SAMPLE_ITEMS, seated: !!m.world.sit, skirt: m.c.pieces.hem?.src === 'sculpt' ? m.c.pieces.hem.skirt : undefined }),
  }));
  return {
    objects: [...people.map((p) => p.fig.root), ...props],
    animate(t) {
      for (const p of people) {
        const sp = sceneAt(rt, p.id, t, heights[p.id], bodies[p.id]);
        act(p.fig, sp, t);
        if (p.equip) dress(p.fig, p.equip, !!sp.world?.flip);
      }
    },
  };
}
