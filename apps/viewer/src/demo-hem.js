import { act, addItem, Batch, body3, box, fromCharacter, parseAction, parseCharacter, parseScene, resolveScene, sceneAt, SCULPT_PRESETS } from '@stickman3d/rig';
import { ACTIONS } from './demos.js';

// Vạt treo hông (`?demo=hem`): một hàng người 3D mặc áo cổ chéo — nữ kimono vạt dài quấn tới mắt cá, nam yukata vạt tới bắp
// chân, áo làm việc tạp dề kem trên quần nơ son, áo bếp tạp dề chàm dài ống chân. `?act=stand|walk|bow30|bow45|sit|seiza` chọn hành động (mặc định `stand`),
// `?turn=độ` xoay cả hàng tại chỗ (0 nhìn thẳng ống kính).

const SPACING = 150;

function character(name, { rig, palette, garment, hair, hairColor, hem }) {
  const r = parseCharacter({
    name,
    ...(rig && { rig }),
    head: { form: 'human' },
    palette: { skin: '#f8e3c8', line: '#1c1c1e', clad: true, ...palette },
    pieces: {
      torso: { src: 'sculpt', garment },
      hair: { src: 'sculpt', color: hairColor, sculpt: SCULPT_PRESETS[hair].sculpt },
      hem: { src: 'sculpt', layer: 'under', ...hem },
    },
  });
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  return r.data;
}

const models = () => [
  character('vat-dai-nu', {
    palette: { garment: '#2B3A67', sleeve: '#2B3A67', trouser: '#2B3A67', shoe: '#F3EBDD' },
    garment: { style: 'wrap', hem: -36, neckBack: 8, wrap: { band: 5, under: 3, underColor: '#FFF8EC', obi: { color: '#EFE4CF', y: 56, width: 34, cord: 3, cordColor: '#D9573B', clasp: 7, knot: 'taiko' } } },
    hair: 'bun', hairColor: '#2E2420',
    hem: { color: '#2B3A67', skirt: { style: 'wrap', rise: 46, length: 211, flare: -4, pleats: 0 } },
  }),
  character('vat-bap-chan', {
    palette: { garment: '#EFE4CF', sleeve: '#EFE4CF', trouser: '#EFE4CF', shoe: '#6B4A35', sleeveWidth: 19 },
    garment: { style: 'wrap', wrap: { bandColor: '#2B3A67', obi: { color: '#2B3A67', y: 14, width: 14, lift: 3, knot: 'kai' } } },
    hair: 'short', hairColor: '#2a1c15',
    hem: { color: '#EFE4CF', skirt: { style: 'wrap', rise: 16, length: 144, flare: 0, pleats: 0 } },
  }),
  character('tap-de-kem', {
    palette: { garment: '#5C7A6E', sleeve: '#5C7A6E', trouser: '#5C7A6E', shoe: '#3a2a20' },
    garment: { style: 'wrap' }, hair: 'curly', hairColor: '#3b2a22',
    hem: { color: '#F3EBDD', skirt: { style: 'apron', length: 100, apron: { tieColor: '#D9573B' } } },
  }),
  character('tap-de-cham', {
    rig: { height: 1.05 },
    palette: { garment: '#F3EBDD', sleeve: '#F3EBDD', sleeveLength: 0.5, trouser: '#5E3F2C', shoe: '#1e1a18' },
    garment: { style: 'wrap', hem: 8 }, hair: 'buzz', hairColor: '#4a4440',
    hem: { color: '#2B3A67', skirt: { style: 'apron', length: 140 } },
  }),
];

const keyAction = (name, mask, keys, extra = {}) => {
  const r = parseAction({ schemaVersion: 14, name, duration: 0.6, end: 'hold', mask, keys, events: [], authoredAt: 'side', ...extra });
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  return r.data;
};
const bow = (deg) => keyAction(`bow${deg}-3d`, ['armFar', 'armNear', 'legFar', 'legNear', 'torso', 'head'], [
  { t: 0, pose: { armFar: [3, 6, 0], armNear: [3, 6, 0], legFar: [0, 0], legNear: [0, 0], torso: 0, head: [0, 0, 0] }, ease: 'smooth' },
  { t: 0.5, pose: { armFar: [6, 20, 0], armNear: [6, 20, 0], legFar: [0, 0], legNear: [0, 0], torso: deg, head: [0, 0, 6] }, ease: 'linear' },
]);
const own = () => {
  const walk = parseAction({ schemaVersion: 9, name: 'walk-short', duration: 1, end: 'wrap', gen: 'walkCycle', authoredAt: 'side', params: { hip: 14, knee: 40, stance: 0.65, arm: 10, elbow: 18, lean: 1, crouch: 0, dip: 0.5 }, events: [] });
  if (!walk.success) throw new Error(walk.error.message);
  return {
    'walk-short': walk.data,
    bow30: bow(30),
    bow45: bow(45),
    seiza: keyAction('seiza', ['armFar', 'armNear', 'legFar', 'legNear', 'torso'], [
      { t: 0, pose: { armFar: [11, 42, 0], armNear: [11, 42, 0], legFar: [80, -170], legNear: [80, -170], torso: 3 }, ease: 'linear' },
    ]),
  };
};

const LENS = { eye: [0, -200, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 };
const clip = (action, start = 0) => ({ action, start });
const track = (...clips) => ({ clips });
const SEAT = 87.5;
/** Đệm ngồi quỳ: hông cao hơn sàn bấy nhiêu */
const SEIZA = 40;

export function hem(q) {
  const kind = q.get('act') ?? 'stand';
  const turn = Number(q.get('turn') ?? 0);
  const cs = models();
  const actions = { ...ACTIONS, ...own() };
  const n = cs.length;
  const cast = cs.map((c, i) => {
    const x = (i - (n - 1) / 2) * SPACING;
    const yaw = 90 + turn;
    const h = c.rig.height;
    // đi tại chỗ: soi vạt theo chân, không soi trôi
    if (kind === 'walk') return { id: `h${i}`, c, world: { at: [x, 0, 0], yaw }, tracks: [track(clip('walk-short'))] };
    if (kind === 'sit') return { id: `h${i}`, c, world: { at: [x, -SEAT * h, 0], yaw, sit: true, floor: 0 }, tracks: [track(clip('sit-3d'))] };
    if (kind === 'seiza') return { id: `h${i}`, c, world: { at: [x, -SEIZA * h, 0], yaw, sit: true, floor: 0 }, tracks: [track(clip('seiza'))] };
    const body = kind === 'bow30' || kind === 'bow45' ? kind : 'stand-3d';
    return { id: `h${i}`, c, world: { at: [x, 0, 0], yaw }, tracks: [track(clip(body))] };
  });
  const scene = parseScene({ name: 'demo-hem', lens: LENS, cast: cast.map((m) => ({ id: m.id, character: `${m.id}.json`, world: m.world, tracks: m.tracks })) });
  if (!scene.success) throw new Error(scene.error.message);
  const bodies = Object.fromEntries(cast.map((m) => [m.id, body3(m.c)]));
  const heights = Object.fromEntries(cast.map((m) => [m.id, m.c.rig.height]));
  const rt = resolveScene(scene.data, actions, heights, bodies);
  const people = cast.map((m, i) => ({ ...m, fig: fromCharacter(m.c, { seed: i, seated: !!m.world.sit }) }));
  const props = [];
  if (kind === 'sit') {
    const b = new Batch();
    for (const m of cast) {
      const [x] = m.world.at;
      const h = m.c.rig.height;
      addItem(b, { at: { at: [0, 0, 0] }, parts: [{ v: box(x - 30, x + 30, -SEAT * h, -SEAT * h + 7.5, -30, 30), tone: { top: '#c9a679', lit: '#a98559' } }, { v: box(x - 4, x + 4, -SEAT * h + 7.5, 0, -4, 4), tone: { top: '#77736e', lit: '#5f5b57' } }] });
    }
    props.push(b.build());
  }
  return {
    objects: [...people.map((p) => p.fig.root), ...props],
    animate(t) {
      for (const p of people) act(p.fig, sceneAt(rt, p.id, t, heights[p.id], bodies[p.id]), t);
    },
  };
}
