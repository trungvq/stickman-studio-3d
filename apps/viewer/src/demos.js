import { act, addItem, Batch, box, cameraAt, cladThigh, limbWidths, parseAction, parseScene, resolveScene, sceneAt, stickman } from '@stickman3d/rig';
import { actDemos } from './demo-acts.js';
import { mouths, styles } from './demo-styles.js';

// Cảnh diễn hành động (`?demo=`): scene JSON dựng tại chỗ, @stickman3d/rig lấy mẫu từng khung bằng `sceneAt`,
// người 3D diễn theo bằng `act`. Hành động là bộ chung của studio (`apps/studio/public/actions/`), cộng `actions/` của app
// cho hành động chỉ dùng ở đây; trùng tên thì bản của app đè.

const HUMAN = new URLSearchParams(location.search).has('human');
/** `?human`: mọi cảnh mẫu dựng người mặc đồ — tay chân màu, bàn tay, giày, đầu `human`; bề dày chi mặc định của người `clad` */
function dressed(o, extra) {
  if (!HUMAN) return o;
  const out = { ...o, clad: true, headForm: 'human', sleeveColor: o.color, ...extra };
  delete out.sleeveWidth;
  delete out.trouserWidth;
  return out;
}
export const BOY = dressed({
  rig: { stroke: 6, height: 1, shoulderHalf: 40, shoulderDrop: 20, hipHalf: 28 },
  garment: { style: 'shirt' }, color: '#3aa89c', skin: '#f8e3c8', sleeveWidth: 8, trouserWidth: 9,
  hair: { style: 'anime', front: 46, nape: -14, ear: 10, sideburn: 8, part: 0, fringe: 0, volume: 0.16 },
  hairColor: '#33333a',
}, { trouserColor: '#3b4252' });
export const GIRL = dressed({
  rig: { stroke: 6, height: 1, shoulderHalf: 40, shoulderDrop: 20, hipHalf: 22 },
  garment: { style: 'blouse', hem: -18 }, color: '#7893ae', accent: '#544456',
  skirt: { rise: 27, waist: 40, length: 52, flare: 12, pleats: 8 },
  hair: { style: 'bob', front: 48, nape: -22, ear: 16, sideburn: 0, part: 35, fringe: 0, volume: 0.07, bang: 16, bangTo: -55, bangThick: 0.1, length: 0.91 },
  hairColor: '#3b3038',
}, { sleeveLength: 0.45, trouserLength: 0, shoeColor: '#7a3b2e' });
/** Nửa bề dày chân cho `sceneAt` như `body3` của lõi: người mặc đồ ngồi trên gốc đùi `cladThigh` */
export const legHalf = (o) => (o.clad ? cladThigh(limbWidths(o).trouser, o.rig.stroke) : 4.5);

export const ACTIONS = Object.fromEntries(
  Object.entries({
    ...import.meta.glob(['../../studio/public/actions/*.json', '!**/index.json'], { eager: true, import: 'default' }),
    ...import.meta.glob('../actions/*.json', { eager: true, import: 'default' }),
  }).map(([f, j]) => {
    const r = parseAction(j);
    if (!r.success) throw new Error(`${f}: ${r.error.message}`);
    return [f.match(/([^/]+)\.json$/)[1], r.data];
  }),
);

/** Ống kính của scene chỉ để rig biết người quay mặt sang trái hay phải khung: đặt ở chỗ camera mặc định của app */
const LENS = { eye: [0, -200, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 };

const clip = (action, start = 0, extra = {}) => ({ action, start, ...extra });
const track = (...clips) => ({ clips });

/** Người trong scene: `opts` cho `stickman`, `world` và `tracks` như `cast[]` của scene JSON */
function member(id, opts, world, tracks, seed) {
  return { id, opts: { ...opts, seated: !!(world.sit || world.path?.some((k) => k.sit)), seed }, cast: { id, character: `${id}.json`, world, tracks } };
}

const DEMOS = {
  walk: () => [
    member('di', BOY, { path: [{ t: 0, at: [-280, 0, 110], yaw: 17 }, { t: 4, at: [240, 0, -50], yaw: 17 }] },
      [track(clip('walk'), clip('stand-3d', 3.75, { blend: 0.3 })), track(clip('face-calm'))], 0),
    member('nhin', GIRL, { at: [180, 0, 260], yaw: 125 }, [track(clip('stand-3d')), track(clip('face-smug'))], 1),
  ],
  sit: () => [
    member('ngoi', GIRL, { at: [-60, -87.5, 0], yaw: 0, sit: true, floor: 0 },
      [track(clip('sit-3d')), track(clip('arms-on-table-3d')), track(clip('face-worried')), track(clip('talk-lips', 0.4))], 0),
    member('chao', BOY, { at: [330, 0, 0], yaw: 180 }, [track(clip('bow-3d')), track(clip('face-calm'))], 1),
  ],
  faces: () =>
    ['face-calm', 'face-delighted', 'face-sad', 'face-angry', 'face-surprised', 'face-shocked'].map((f, i) =>
      member(`m${i}`, i % 2 ? GIRL : BOY, { at: [-375 + i * 150, 0, 0], yaw: 90 },
        [track(clip('stand-3d')), track(clip(f)), ...(i === 3 ? [track(clip('talk-lips', 0.2))] : [])], i)),
  camera: () => [
    member('di', BOY, { path: [{ t: 0, at: [-280, 0, 110], yaw: 17 }, { t: 4, at: [240, 0, -50], yaw: 17 }] },
      [track(clip('walk'), clip('stand-3d', 3.75, { blend: 0.3 })), track(clip('face-calm'))], 0),
    member('nhin', GIRL, { at: [420, 0, 240], yaw: 150 }, [track(clip('stand-3d')), track(clip('face-smug')), track(clip('talk-lips', 0.3))], 1),
  ],
  look: () => [
    member('thang', BOY, { at: [-110, 0, 0], yaw: 45 }, [track(clip('stand-3d')), track(clip('face-calm'))], 0),
    member('nhin', BOY, { at: [110, 0, 0], yaw: 45 }, [track(clip('stand-3d')), track(clip('face-calm')), track(clip('look-camera')), track(clip('talk-tilt', 0.5))], 1),
  ],
};

/**
 * Cảnh có ống kính và khung cắt riêng (`lens`, `camera[]` của scene): app đặt camera theo `cameraAt` thay cho góc máy
 * xoay tay. `marks` là chữ 2D bám mốc trên người qua `screenOf`.
 */
const SHOTS = {
  camera: {
    lens: { eye: [0, -330, -1500], yaw: 0, pitch: 3, f: 1270, cx: 0, cy: 0 },
    camera: [
      { t: 0, x: 0, y: 0, zoom: 1 },
      { t: 1.2, x: -100, y: -70, zoom: 1.9, move: 'ease' },
      { t: 2.8, x: 70, y: -70, zoom: 1.9, move: 'linear' },
      { t: 4.2, x: 0, y: 0, zoom: 1, move: 'ease' },
    ],
    marks: [{ id: 'di', at: 'headTop', text: 'Đang đi' }, { id: 'nhin', at: 'mouth', text: 'Chào!', bubble: true }],
  },
};
const ACTS = actDemos({ member, track, clip, BOY, GIRL });

/** Bàn và ghế đẩu cho cảnh ngồi: mặt bàn cao hơn hông ngồi ~51 như `arms-on-table-3d` giả định */
function furniture() {
  const b = new Batch();
  const wood = { top: '#c9a679', lit: '#a98559' }, metal = { top: '#77736e', lit: '#5f5b57' };
  addItem(b, { at: { at: [0, 0, 0] }, parts: [
    { v: box(0, 130, -143, -137, -90, 90), tone: wood },
    ...[[6, -84], [124, -84], [6, 84], [124, 84]].map(([x, z]) => ({ v: box(x - 3, x + 3, -137, 0, z - 3, z + 3), tone: metal })),
    { v: box(-90, -30, -87.5, -80, -30, 30), tone: wood },
    { v: box(-63, -57, -80, 0, -3, 3), tone: metal },
  ] });
  return b.build();
}

/**
 * Dựng cảnh `name`; trả nhóm cần thêm vào scene và hàm diễn theo `t`, hay `null` nếu không có cảnh ấy. Cảnh trong
 * `SHOTS` trả thêm `view(t)` (ống kính và khung cắt cho `stage.draw`) và `marks`.
 */
export function demo(name) {
  if (name === 'styles') return styles(new URLSearchParams(location.search));
  if (name === 'mouths') return mouths();
  const make = DEMOS[name] ?? ACTS[name]?.cast;
  if (!make) return null;
  const members = make();
  const shot = SHOTS[name];
  const scene = parseScene({ name: `demo-${name}`, lens: shot?.lens ?? LENS, camera: shot?.camera ?? [], cast: members.map((m) => m.cast) });
  if (!scene.success) throw new Error(scene.error.message);
  const bodies = Object.fromEntries(members.map((m) => [m.id, { legHalf: legHalf(m.opts), hipHalf: m.opts.rig.hipHalf }]));
  const heights = Object.fromEntries(members.map((m) => [m.id, 1]));
  const rt = resolveScene(scene.data, ACTIONS, {}, {}, heights, bodies);
  const people = members.map((m) => ({ id: m.id, fig: stickman(m.opts) }));
  const props = name === 'sit' ? [furniture()] : (ACTS[name]?.props?.() ?? []);
  const figOf = Object.fromEntries(people.map((p) => [p.id, p.fig]));
  return {
    objects: [...people.map((p) => p.fig.root), ...props],
    animate(t) {
      for (const p of people) act(p.fig, sceneAt(rt, p.id, t, 1, bodies[p.id]), t);
    },
    ...(shot && {
      view: (t) => ({ lens: shot.lens, crop: cameraAt(rt, t) }),
      marks: shot.marks.map((m) => ({ ...m, fig: figOf[m.id] })),
    }),
  };
}
