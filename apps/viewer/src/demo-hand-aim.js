import * as THREE from 'three';
import { act, addItem, addLathe, Batch, body3, box, dress, fromCharacter, parseCharacter, parseScene, resolveScene, sceneAt, SCULPT_PRESETS } from '@stickman3d/rig';
import { ACTIONS } from './demos.js';

// Bàn tay theo mốc thân và theo ý định (`?demo=hand-aim&act=…`): ba cỡ người — số đo mặc định, bụng phệ thấp, chibi đầu
// to — cùng diễn một hành động đặt bàn tay bằng mốc (`reach.to`), lòng tay bằng `palm`, dáng tay mới. `focus=<id>:<khớp>`
// của main.js đặt máy vào bàn tay để soi cận.

/** Mặt ghế cao bằng gối người `height = 1` */
const SEAT = 87.5;

function character(name, { rig, palette, garment, hair, hairColor }) {
  const r = parseCharacter({
    name,
    ...(rig && { rig }),
    head: { form: 'human' },
    palette: { skin: '#f8e3c8', line: '#1c1c1e', clad: true, ...palette },
    pieces: {
      torso: { src: 'sculpt', garment },
      hair: { src: 'sculpt', color: hairColor, sculpt: SCULPT_PRESETS[hair].sculpt },
    },
  });
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  return r.data;
}

/** Ba cỡ người: mặc định, bụng phệ thấp vai rộng tay to, chibi đầu to */
const models = () => [
  character('vua', { palette: { garment: '#3aa89c', sleeve: '#3aa89c', trouser: '#3b4252' }, garment: { style: 'shirt' }, hair: 'short', hairColor: '#2a1c15' }),
  character('bung', {
    rig: { height: 0.94, shoulderHalf: 42, hipHalf: 23 },
    palette: { garment: '#e0623f', sleeve: '#e0623f', sleeveLength: 0.32, trouser: '#e8dccb', sleeveWidth: 17, trouserWidth: 20, bicep: 0.3 },
    garment: { style: 'polo', neck: 14, belly: 24, hem: 6 }, hair: 'neat', hairColor: '#2a1c15',
  }),
  character('chibi', {
    rig: { height: 0.8, shoulderHalf: 34, hipHalf: 18 },
    palette: { garment: '#e0b23a', sleeve: '#e0b23a', trouser: '#34466e', sleeveWidth: 13, trouserWidth: 14 },
    garment: { style: 'sweater', hem: -10 }, hair: 'bob', hairColor: '#3b2a22',
  }),
];

const tone = (top, lit = top) => ({ top, lit });

/** Điện thoại áp tai: chiều dài máy dọc bàn tay (+y của món là về đầu ngón), mặt màn hình quay về lòng tay, tay khum ôm lưng máy */
function phone() {
  const b = new Batch();
  addItem(b, { at: { at: [0, 0, 0] }, parts: [{ v: box(-1, 1, -14, 14, -6, 6), tone: tone('#2b2f38', '#1e2128') }] });
  // nằm chéo lòng bàn tay như cầm thật: đầu loa ở đầu ngón (áp tai), đầu mic xoay 35° về phía ngón cái và dời về cổ tay,
  // thò khỏi gót bàn tay về phía mồm
  return { object: b.build(), hold: { pose: 'cup', rotate: [-35, 0, 0], offset: [0, 0.07, -0.05] } };
}
/** Điện thoại ngang hai tay, kẹp hai đầu: màn hình về người cầm */
function phoneWide() {
  const b = new Batch();
  addItem(b, { at: { at: [0, 0, 0] }, parts: [
    { v: box(-18, 18, -8.5, 8.5, -1, 1), tone: tone('#2b2f38', '#1e2128') },
    { v: box(-16.5, 16.5, -7.5, 7.5, 1, 1.2), tone: tone('#7fb2d9', '#6a9cc2') },
  ] });
  return { object: b.build(), hold: { both: true, follow: 'tilt', pose: 'edge' } };
}
/** Chén sake nhỏ, đứng thẳng, kẹp bằng đầu ngón */
function sake() {
  const b = new Batch();
  const W = tone('#f4efe4', '#ddd5c6');
  addLathe(b, { rings: [[3, 0], [3, 2.6], [2, 3.4], [-3.5, 4.8], [-3.5, 0]], tone: [W, W, W, tone('#c9a44a')] }, { at: [0, 0, 0] });
  return { object: b.build(), hold: { follow: 'level', pose: 'pinch' } };
}
const ITEMS = { phone, phoneWide, sake };

/** Nửa khoảng hai tay vịn cho người `c`: ngoài vai, bụng phệ thì rộng thêm */
const armHalf = (c) => c.rig.shoulderHalf - 4 + 0.5 * (c.pieces.torso.garment?.belly ?? 0);

/** Ghế bành ở gốc, mặt hướng −z (người `yaw` 90): mặt ngồi cao bằng gối người cao `h`, tay vịn cách giữa `w`, cao hơn mặt ngồi `arm` */
function armchair(h, w, arm) {
  const b = new Batch();
  const wood = tone('#8a5a3a', '#6e4630'), cloth = tone('#5d7a8c', '#4a6372');
  const seat = SEAT * h, top = seat + arm;
  addItem(b, { at: { at: [0, 0, 0] }, parts: [
    { v: box(-w, w, -seat, -seat + 8, -32, 30), tone: cloth },
    { v: box(-w, w, -seat - 70, -seat, 26, 32), tone: cloth },
    ...[-1, 1].flatMap((s) => [
      { v: box(s * w - 5, s * w + 5, -top, -top + 5, -30, 28), tone: wood },
      { v: box(s * w - 3, s * w + 3, -top + 5, 0, -26, -20), tone: wood },
      { v: box(s * w - 3, s * w + 3, -top + 5, 0, 20, 26), tone: wood },
    ]),
  ] });
  return b.build();
}
function stool(h) {
  const b = new Batch();
  addItem(b, { at: { at: [0, 0, 0] }, parts: [
    { v: box(-30, 30, -SEAT * h, -SEAT * h + 7.5, -30, 30), tone: tone('#c9a679', '#a98559') },
    { v: box(-3, 3, -SEAT * h + 7.5, 0, -3, 3), tone: tone('#77736e', '#5f5b57') },
  ] });
  return b.build();
}

/** Người quay `YAW`: lệch khỏi nhìn thẳng ống kính cho mọi người cùng một tay gần */
const YAW = 75;
const TURN = ((YAW - 90) * Math.PI) / 180;
/** Điểm `[x, y, z]` hệ của đồ đặt cho người `yaw` 90 ra thế giới, quanh chỗ người ở độ sâu `z0` */
const place = ([x, y, z], z0) => [x * Math.cos(TURN) + z * Math.sin(TURN), y, -x * Math.sin(TURN) + z * Math.cos(TURN) + z0];
/** Đồ dựng cho người `yaw` 90 quay theo người, đặt ở độ sâu `z0` */
function turned(obj, z0) {
  const g = new THREE.Group();
  g.add(obj);
  g.rotation.y = -TURN;
  g.position.set(0, 0, -z0 / 100);
  return g;
}

const clip = (action, start = 0, extra = {}) => ({ action, start, ...extra });
const track = (...clips) => ({ clips });
/** Ba người xếp theo chiều sâu, cùng thẳng trục ống kính: cùng một tay là tay gần */
const Z = [-600, 0, 600];
/** Mặt tay vịn cao hơn mặt ngồi */
const ARM = 24;

/** Từng cảnh: một hành động cho cả ba người; `sit` ngồi ghế đẩu, `chair` ngồi ghế bành */
const ACTS = {
  cover: { tracks: [track(clip('stand-3d')), track(clip('cover-mouth-3d'))] },
  ear: { tracks: [track(clip('stand-3d')), track(clip('phone-ear-3d'))], equip: { handNear: 'phone' } },
  'ear-sit': { sit: true, tracks: [track(clip('sit-3d')), track(clip('phone-ear-3d'))], equip: { handNear: 'phone' } },
  clap: { tracks: [track(clip('stand-3d')), track(clip('clap-3d', 0, { cycle: 0.42 }))] },
  behind: { tracks: [track(clip('stand-3d')), track(clip('hands-behind-3d'))] },
  armrest: { chair: true, tracks: [track(clip('sit-3d')), track(clip('hands-flat-3d'))] },
  sake: { sit: true, tracks: [track(clip('sit-3d')), track(clip('raise-cup-3d'))], equip: { handNear: 'sake' } },
  phone2: { tracks: [track(clip('stand-3d')), track(clip('phone-landscape-3d'))], equip: { handNear: 'phoneWide' } },
};

/** Đích bàn tay trên tay vịn (thế giới): lòng tay úp trên mặt tay vịn, giữa vịn */
function armrestHands(z0, h, w) {
  const top = -(SEAT * h + ARM);
  const at = (s) => ({ at: place([s * w, top, -6], z0), point: 'palm', palm: 'down', fingers: 'forward', elbow: [s * 0.6, 0.4, 0.6] });
  return [{ t: 0, right: at(-1), left: at(1) }];
}

/** Cảnh `?demo=hand-aim&act=…`; `act` thiếu là che miệng */
export function handAimDemo(q) {
  const name = q.get('act') ?? 'cover';
  const spec = ACTS[name];
  if (!spec) return null;
  const cs = models();
  const cast = cs.map((c, i) => {
    const h = c.rig.height;
    const seated = spec.sit || spec.chair;
    const world = seated ? { at: [0, -SEAT * h, Z[i]], yaw: YAW, sit: true, floor: 0 } : { at: [0, 0, Z[i]], yaw: YAW };
    if (spec.chair) world.hands = armrestHands(Z[i], h, armHalf(c));
    return { id: ['a', 'b', 'c'][i], c, world, tracks: spec.tracks, equip: spec.equip };
  });
  const scene = parseScene({ name: `demo-hand-aim-${name}`, lens: { eye: [0, -200, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 }, cast: cast.map((m) => ({ id: m.id, character: `${m.id}.json`, world: m.world, tracks: m.tracks })) });
  if (!scene.success) throw new Error(scene.error.message);
  const bodies = Object.fromEntries(cast.map((m) => [m.id, body3(m.c)]));
  const heights = Object.fromEntries(cast.map((m) => [m.id, m.c.rig.height]));
  const rt = resolveScene(scene.data, ACTIONS, heights, bodies);
  const group = new THREE.Group();
  const people = cast.map((m, i) => ({ ...m, fig: fromCharacter(m.c, { seed: i, items: ITEMS, seated: !!m.world.sit }) }));
  for (const p of people) group.add(p.fig.root);
  const props = cast.flatMap((m, i) => (spec.chair ? [turned(armchair(m.c.rig.height, armHalf(m.c), ARM), Z[i])] : spec.sit ? [turned(stool(m.c.rig.height), Z[i])] : []));
  const animate = (t) => {
    for (const p of people) {
      const sp = sceneAt(rt, p.id, t, heights[p.id], bodies[p.id]);
      act(p.fig, sp, t);
      if (p.equip) dress(p.fig, p.equip, !!sp.world?.flip);
    }
  };
  return {
    objects: [group, ...props],
    animate,
    /** Chỗ của `joint` (`near`, `far` tâm nắm tay gần, xa; `hands` giữa hai tay; `head`) người `id` ở giây `t`, three */
    focus(id, joint, t) {
      animate(t);
      const p = people.find((m) => m.id === id);
      const f = p.fig;
      f.root.updateMatrixWorld(true);
      const w = (o) => o.getWorldPosition(new THREE.Vector3());
      const near = sceneAt(rt, id, t, heights[id], bodies[id]).world?.flip ? 1 : -1;
      if (joint === 'head') return w(f.head);
      if (joint === 'near') return w(f.sockets.hand[near]);
      if (joint === 'far') return w(f.sockets.hand[-near]);
      return w(f.sockets.hand[-1]).add(w(f.sockets.hand[1])).multiplyScalar(0.5);
    },
  };
}
