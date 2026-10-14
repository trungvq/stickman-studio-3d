import * as THREE from 'three';
import { act, addItem, Batch, body3, box, dress, fromCharacter, wardrobe, GLASSES_PRESETS, parseAction, parseCharacter, parseScene, resolveScene, sceneAt, SCULPT_PRESETS } from '@stickman3d/rig';
import { ACTIONS } from './demos.js';
import { SAMPLE_ITEMS } from './demo-hold.js';

// Người 3D mặc đồ (`?demo=human`, `human-row`, `human-faces`): JSON nhân vật bật `palette.clad` và `head.form: "human"`,
// qua `parseCharacter` rồi `fromCharacter` như repo video. `?stick` bỏ hai cờ ấy: cùng cảnh, người que như cũ.

const STICK = new URLSearchParams(location.search).has('stick');

/** JSON nhân vật mẫu: số đo để trống lấy mặc định của schema, `rig` và `palette` đè lên */
function character(name, { rig, palette, face, garment, accent, hair, hairColor, skirt, glasses, neck, items }) {
  const json = {
    name,
    ...(rig && { rig }),
    head: { form: 'human' },
    palette: { skin: '#f8e3c8', line: '#1c1c1e', clad: true, ...palette },
    ...(face && { face }),
    pieces: {
      torso: { src: 'sculpt', garment, ...(accent && { accent }) },
      hair: { src: 'sculpt', color: hairColor, sculpt: SCULPT_PRESETS[hair].sculpt },
      ...(skirt ? { hem: { src: 'sculpt', color: skirt.color, skirt: skirt.shape } } : {}),
      ...(glasses ? { faceAcc: { src: 'sculpt', color: '#3a2a22', glasses: GLASSES_PRESETS[glasses].glasses } } : {}),
      ...(neck ? { neck: { src: 'sculpt', ...neck } } : {}),
    },
    ...(items && { items }),
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

/** Năm người mẫu, dựng lúc gọi cảnh; hai người đầu số đo mặc định, ba người sau chỉnh dáng */
const models = () => ({
  /** Nam sơ mi dài tay, quần âu */
  LONG: character('dai-tay', {
    palette: { garment: '#3aa89c', sleeve: '#3aa89c', trouser: '#3b4252', shoe: '#3a2a20' },
    garment: { style: 'shirt' }, hair: 'short', hairColor: '#2a1c15',
  }),
  /** Nam áo phông ngắn tay, quần bò */
  SHORT: character('ngan-tay', {
    palette: { garment: '#c8663a', sleeve: '#c8663a', sleeveLength: 0.24, trouser: '#41587a' },
    garment: { style: 'tshirt' }, hair: 'anime', hairColor: '#33333a',
  }),
  /** Nữ blouse tay lỡ, váy xếp ly, chân trần, giày đỏ nâu, má ửng; dáng quả lê: đùi đầy, hông rộng hơn vai */
  GIRL: character('vay', {
    palette: { garment: '#7893ae', sleeve: '#7893ae', sleeveLength: 0.45, trouserLength: 0, shoe: '#7a3b2e', trouserWidth: 21 },
    face: { blush: 0.5 },
    garment: { style: 'blouse', hem: -18 }, hair: 'bob', hairColor: '#3b3038',
    skirt: { color: '#3a3f4a', shape: {} },
  }),
  /** Nam len cổ tròn, đeo kính, tóc gọn; vạm vỡ: vai rộng, tay chân to, bắp tay nở */
  GLASSES: character('kinh', {
    rig: { shoulderHalf: 46 },
    palette: { garment: '#9a5fa8', sleeve: '#9a5fa8', trouser: '#2f3a33', sleeveWidth: 19, trouserWidth: 22, bicep: 0.35 },
    garment: { style: 'sweater' }, hair: 'neat', hairColor: '#5b3a26', glasses: 'round',
  }),
  /** Nữ tóc đuôi ngựa, áo len, quần dài, da nâu, má ửng; mảnh: thấp hơn, vai và hông hẹp, tay chân thon */
  PONY: character('duoi-ngua', {
    rig: { height: 0.94, shoulderHalf: 34, hipHalf: 18 },
    palette: { skin: '#9a6648', garment: '#e0b23a', sleeve: '#e0b23a', trouser: '#34466e', sleeveWidth: 12, trouserWidth: 14 },
    face: { blush: 0.6 },
    garment: { style: 'sweater', hem: -10 }, hair: 'ponyLow', hairColor: '#3b2a22',
  }),
  /** Nữ áo len, váy, chân trần cùng màu da với tay */
  KNIT: character('len-vay', {
    palette: { garment: '#d8692f', sleeve: '#d8692f', trouserLength: 0, shoe: '#4a2c20', trouserWidth: 17 },
    garment: { style: 'sweater' }, hair: 'bob', hairColor: '#3b2a22',
    skirt: { color: '#4a3530', shape: {} },
  }),
  /** Nữ áo cổ chéo thân trên cổ lót kem, đai cao bản rộng có dây, khoá và nút hộp sau lưng, cổ sau hạ; váy thẳng dài thay vạt dưới */
  KIMONO: character('co-cheo-nu', {
    rig: { shoulderHalf: 36, hipHalf: 22 },
    palette: { garment: '#2b3a67', sleeve: '#2b3a67', sleeveWidth: 17, trouser: '#2b3a67', shoe: '#fff8ec', trouserWidth: 17 },
    garment: { style: 'wrap', hem: -36, neckBack: 8, wrap: { band: 5, under: 3, underColor: '#fff8ec', obi: { color: '#efe4cf', y: 56, width: 34, cord: 3, cordColor: '#d9573b', clasp: 7, claspColor: '#d9573b', knot: 'taiko' } } },
    hair: 'bun', hairColor: '#2e2420',
    skirt: { color: '#2b3a67', shape: { rise: 46, length: 190, flare: 4, pleats: 0 } },
  }),
  /** Nam áo cổ chéo tới đùi, viền cổ khác màu, đai thấp bản hẹp nút dẹt lệch bên; ống chân cùng màu vải */
  ROBE: character('co-cheo-nam', {
    palette: { garment: '#efe4cf', sleeve: '#efe4cf', sleeveWidth: 17, trouser: '#efe4cf', shoe: '#9c5a3c' },
    garment: { style: 'wrap', hem: 40, wrap: { band: 6, bandColor: '#2b3a67', obi: { color: '#9c5a3c', y: 14, width: 14, lift: 3, knot: 'kai' } } },
    hair: 'short', hairColor: '#2a1c15',
  }),
  /** Áo làm việc cổ chéo tới hông, không đai, quần cùng màu */
  WORK: character('co-cheo-lam', {
    rig: { height: 0.95, shoulderHalf: 36, hipHalf: 21 },
    palette: { garment: '#e39a9a', sleeve: '#e39a9a', trouser: '#e39a9a', shoe: '#5e3f2c' },
    garment: { style: 'wrap', hem: 6 }, hair: 'curly', hairColor: '#3b2a22',
  }),
  /** Áo bếp cổ chéo tới hông cùng màu cổ, tay xắn tới khuỷu, quần nâu */
  CHEF: character('co-cheo-bep', {
    rig: { height: 1.08, shoulderHalf: 44 },
    palette: { garment: '#f3ebdd', sleeve: '#f3ebdd', sleeveLength: 0.5, trouser: '#5e3f2c', shoe: '#2a2420', sleeveWidth: 18, trouserWidth: 19 },
    garment: { style: 'wrap', hem: 8 }, hair: 'buzz', hairColor: '#4a4440',
  }),
  /** Áo khoác vạt mở tới hông: dải cổ nâu chữ dọc bên trái, lá phong sau lưng, áo trong kem cổ tròn, thẻ tên có dấu lá non */
  HAPPI: character('vat-mo-ngan', {
    palette: { garment: '#2e6b4f', sleeve: '#2e6b4f', sleeveWidth: 15, trouser: '#3a2a22', shoe: '#2a2420' },
    accent: '#f3ebdd',
    garment: {
      style: 'wrap', hem: 12, ease: 12,
      wrap: { band: 7, bandColor: '#3a2a22', open: { gap: 8 }, letters: { left: '楓荘', color: '#ffffff' } },
      prints: [{ side: 'back', shape: 'maple', size: 66, y: 70, color: '#fff8ec' }],
      badge: { text: '陽太', wakaba: true },
    },
    hair: 'neat', hairColor: '#2a1c15',
  }),
  /** Như trên, chữ dọc bên phải, chữ to sau lưng, thẻ tên không dấu */
  HAPPI_B: character('vat-mo-chu', {
    rig: { height: 0.95, shoulderHalf: 36, hipHalf: 21 },
    palette: { garment: '#2b3a67', sleeve: '#2b3a67', sleeveWidth: 14, trouser: '#2b3a67', shoe: '#5e3f2c' },
    accent: '#fff8ec',
    garment: {
      style: 'wrap', hem: 8, ease: 12,
      wrap: { band: 7, bandColor: '#fff8ec', open: { gap: 6 }, letters: { right: '旅館', color: '#2b3a67', font: 'sans' } },
      prints: [{ side: 'back', text: '祭', size: 44, y: 76, color: '#fff8ec' }, { side: 'front', shape: 'ring', size: 9, x: -22, y: 92, color: '#fff8ec' }],
      badge: { text: '佐藤' },
    },
    hair: 'bob', hairColor: '#3b2a22',
  }),
  /** Áo khoác vạt mở tới giữa đùi khoác ngoài áo cổ chéo: cổ lót kem giao trong khe, đai lộ giữa khe, dây buộc trước ngực; váy thẳng từ dưới gấu áo khoác */
  HAORI: character('vat-mo-dai', {
    rig: { height: 0.92, shoulderHalf: 36, hipHalf: 22 },
    palette: { garment: '#7a4e33', sleeve: '#7a4e33', sleeveWidth: 18, trouser: '#5b2a4a', shoe: '#fff8ec', trouserWidth: 17 },
    accent: '#5b2a4a',
    garment: {
      style: 'wrap', hem: 36, ease: 13, neckFront: 44,
      wrap: { band: 7, under: 3, underColor: '#fff8ec', open: { gap: 18, cross: 24, tie: 1.8, tieY: 86 }, obi: { color: '#c9a227', y: 56, width: 30, lift: 1.5 } },
    },
    hair: 'bun', hairColor: '#d8cfc4',
    skirt: { color: '#5b2a4a', shape: { rise: -28, length: 140, flare: 3, pleats: 0 } },
  }),
  /** Sơ mi và áo cổ chéo khép mang thẻ tên, chữ dọc trên dải cổ áo cổ chéo */
  SHIRT_TAG: character('so-mi-the', {
    palette: { garment: '#3aa89c', sleeve: '#3aa89c', trouser: '#3b4252', shoe: '#3a2a20' },
    garment: { style: 'shirt', badge: { text: '田辺', color: '#ffffff', edge: '#2b3a67' } }, hair: 'short', hairColor: '#2a1c15',
  }),
  WRAP_TAG: character('co-cheo-the', {
    rig: { height: 0.95, shoulderHalf: 36, hipHalf: 21 },
    palette: { garment: '#e39a9a', sleeve: '#e39a9a', trouser: '#e39a9a', shoe: '#5e3f2c' },
    garment: { style: 'wrap', hem: 6, wrap: { band: 7, bandColor: '#7a2e3a', letters: { left: '楓荘' } }, badge: { wakaba: true, text: 'よし江' } },
    hair: 'curly', hairColor: '#3b2a22',
  }),
  /** Nam bụng phệ, polo đỏ thẫm cổ dựng ngắn tay, quần kem */
  POLO: character('polo-bung', {
    rig: { shoulderHalf: 44, hipHalf: 24 },
    palette: { garment: '#d7263d', sleeve: '#d7263d', sleeveLength: 0.28, trouser: '#efe4cf', shoe: '#3a2a20', sleeveWidth: 17, trouserWidth: 21 },
    garment: { style: 'polo', collarUp: 1, belly: 22 }, hair: 'slick', hairColor: '#2a1c15',
    neck: { shades: {} },
  }),
  /** Nam yukata kem tay loe tới cổ tay, viền cổ chàm, đai thấp nút dẹt, vạt dài tới bắp chân */
  YUKATA: character('yukata-loe', {
    palette: { garment: '#efe4cf', sleeve: '#efe4cf', sleeveFlare: 12, trouser: '#efe4cf', shoe: '#9c5a3c' },
    garment: { style: 'wrap', hem: 5, wrap: { band: 6, bandColor: '#2b3a67', obi: { color: '#2b3a67', y: 30, width: 16, lift: 3, knot: 'kai' } } },
    hair: 'short', hairColor: '#2a1c15',
    skirt: { color: '#efe4cf', shape: { style: 'wrap', length: 150, flare: 0, pleats: 0 } },
  }),
  /** Áo bếp cổ chéo kem, tay xắn, khăn chàm vắt vai trái */
  CHEF_TOWEL: character('khan-chef', {
    rig: { height: 1.08, shoulderHalf: 44 },
    palette: { garment: '#f3ebdd', sleeve: '#f3ebdd', sleeveLength: 0.5, trouser: '#5e3f2c', shoe: '#2a2420', sleeveWidth: 18, trouserWidth: 19 },
    garment: { style: 'wrap', hem: 8 }, hair: 'buzz', hairColor: '#4a4440',
    neck: { color: '#2b3a67', drape: { side: 'left', width: 16, front: 90, back: 70 } },
  }),
  /** Nam yukata chàm tay loe, khăn tắm kem vắt vai phải */
  BATH: character('khan-tam', {
    palette: { garment: '#2b3a67', sleeve: '#2b3a67', sleeveFlare: 10, trouser: '#2b3a67', shoe: '#9c5a3c' },
    garment: { style: 'wrap', hem: 5, wrap: { band: 6, bandColor: '#1e2a4a', obi: { color: '#efe4cf', y: 30, width: 16, lift: 3, knot: 'kai' } } },
    hair: 'baldLight', hairColor: '#6a5a50',
    skirt: { color: '#2b3a67', shape: { style: 'wrap', length: 150, flare: 0, pleats: 0 } },
    neck: { color: '#efe4cf', drape: { side: 'right', width: 22, front: 100, back: 80, thick: 3.5 } },
  }),
  /** Nam yukata kem tới đùi (bản ngồi), đồ thay: vạt dài bản đứng, polo đỏ thẫm cổ dựng bụng phệ, kính gài nẹp */
  WARDROBE: character('tu-do', {
    palette: { garment: '#efe4cf', sleeve: '#efe4cf', sleeveFlare: 10, trouser: '#efe4cf', shoe: '#9c5a3c' },
    garment: { style: 'wrap', hem: 40, wrap: { band: 6, bandColor: '#2b3a67', obi: { color: '#2b3a67', y: 30, width: 16, lift: 3, knot: 'kai' } } },
    hair: 'short', hairColor: '#2a1c15',
    items: {
      stand: { hem: { src: 'sculpt', color: '#efe4cf', skirt: { style: 'wrap', length: 150, flare: 0, pleats: 0 } } },
      polo: { torso: { src: 'sculpt', color: '#d7263d', garment: { style: 'polo', collarUp: 1, belly: 18 } } },
      shades: { neck: { src: 'sculpt', shades: {} } },
    },
  }),
  /** Nam áo cổ chéo tới đùi trên bụng phệ, đai thấp dưới bụng */
  ROBE_BELLY: character('co-cheo-bung', {
    rig: { shoulderHalf: 42, hipHalf: 24 },
    palette: { garment: '#efe4cf', sleeve: '#efe4cf', sleeveWidth: 17, trouser: '#efe4cf', shoe: '#9c5a3c', trouserWidth: 20 },
    garment: { style: 'wrap', hem: 40, belly: 22, wrap: { band: 6, bandColor: '#2b3a67', obi: { color: '#9c5a3c', y: 14, width: 14, lift: 3, knot: 'kai' } } },
    hair: 'baldLight', hairColor: '#5a4a40',
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
  'chin-rest-3d': keyAction('chin-rest-3d', ['armNear'], [{ t: 0, pose: {}, reach: { armNear: { at: [45, -141, 6], elbow: [0.3, 1, 0.1] } }, ease: 'linear' }], { authoredAt: 'side' }),
  // hai bàn tay úp trên gối người ngồi
  'hands-knees-3d': keyAction('hands-knees-3d', ['armNear', 'armFar'], [{ t: 0, pose: {}, reach: { armNear: { at: [64, -20, 16], elbow: [0, 1, 0.6] }, armFar: { at: [64, -20, 16], elbow: [0, 1, 0.6] } }, ease: 'linear' }], { authoredAt: 'side' }),
  // ngồi quỳ trên gót: đùi ngang ra trước, ống chân gập hẳn ra sau dưới đùi
  'seiza-3d': keyAction('seiza-3d', ['legNear', 'legFar', 'torso'], [{ t: 0, pose: { legNear: [90, -172], legFar: [90, -172], torso: 2 }, ease: 'linear' }], { authoredAt: 'side' }),
  'hands-lap-3d': keyAction('hands-lap-3d', ['armNear', 'armFar'], [{ t: 0, pose: {}, reach: { armNear: { at: [44, -16, 12], elbow: [0, 1, 0.6] }, armFar: { at: [44, -16, 12], elbow: [0, 1, 0.6] } }, ease: 'linear' }], { authoredAt: 'side' }),
  // cúi chào sâu 45°, hai tay giơ thẳng ra trước
  'bow45-3d': keyAction('bow45-3d', ['torso'], [{ t: 0, pose: { torso: 45 }, ease: 'linear' }], { authoredAt: 'side' }),
  'reach-3d': keyAction('reach-3d', ['armNear', 'armFar'], [{ t: 0, pose: { armNear: [84, 6, 0], armFar: [84, 6, 0] }, ease: 'linear' }], { authoredAt: 'side' }),
  // giơ tay gần ra trước ngang ngực, bàn tay xoè
  'reach-out-3d': keyAction('reach-out-3d', ['armNear'], [{ t: 0, pose: {}, reach: { armNear: { at: [78, -92, 8], elbow: [0, 1, 0.5] } }, hand: { armNear: 'open' }, ease: 'linear' }], { authoredAt: 'side', schemaVersion: 18 }),
  // chắp hai tay trước bụng
  'hands-front-3d': keyAction('hands-front-3d', ['armNear', 'armFar'], [{ t: 0, pose: {}, reach: { armNear: { at: [34, -50, -6], elbow: [-0.2, 1, 0.5] }, armFar: { at: [36, -46, -9], elbow: [-0.2, 1, 0.5] } }, ease: 'linear' }], { authoredAt: 'side', schemaVersion: 18 }),
  // khoanh tay trước ngực: hai cẳng tay chéo ngang, khuỷu chĩa ra ngoài
  'arms-fold-3d': keyAction('arms-fold-3d', ['armNear', 'armFar'], [{ t: 0, pose: {}, reach: { armNear: { at: [66, -84, -24], elbow: [0, 0.6, 1] }, armFar: { at: [58, -76, -26], elbow: [0, 0.6, 1] } }, hand: { armNear: 'fist', armFar: 'fist' }, ease: 'linear' }], { authoredAt: 'side', schemaVersion: 18 }),
  'face-wry': keyAction('face-wry', ['face'], [{ t: 0, pose: {}, face: { mouth: 'wryOpen', brow: 'skeptical', eyes: 'open' }, ease: 'linear' }]),
});

const LENS = { eye: [0, -200, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 };
const clip = (action, start = 0, extra = {}) => ({ action, start, ...extra });
const track = (...clips) => ({ clips });

/** Mặt ghế đẩu cao bằng gối người `height = 1` */
const SEAT = 87.5;
/** Ngồi quỳ trên gót: hông cao hơn sàn bấy nhiêu */
const SEIZA = 30;

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
  // ghế băng: nam sơ mi cầm cốc, nữ áo len váy chân trần tay úp gối — vạt áo, váy, tay trên đùi khi ngồi
  'human-bench': ({ LONG, KNIT }) => ({
    cast: [
      { id: 'b0', c: KNIT, world: { at: [-80, -SEAT, 0], yaw: 90, sit: true, floor: 0 }, tracks: [track(clip('sit-3d')), track(clip('hands-knees-3d')), track(clip('face-calm'))] },
      { id: 'b1', c: LONG, world: { at: [80, -SEAT, 0], yaw: 90, sit: true, floor: 0 }, tracks: [track(clip('sit-3d')), track(clip('hold-mug')), track(clip('face-calm'))], equip: { handNear: 'mug' } },
    ],
    props: [bench(0, 0, 320)],
  }),
  // hàng đứng nhìn ống kính: soi các góc
  'human-row': ({ LONG, SHORT, GIRL, GLASSES, PONY }) => ({
    cast: [LONG, SHORT, GIRL, GLASSES, PONY].map((c, i) => ({ id: `r${i}`, c, world: { at: [(i - 2) * 150, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('face-calm'))] })),
  }),
  // áo cổ chéo: hàng đứng nhìn ống kính
  'human-wrap': ({ KIMONO, ROBE, WORK, CHEF }) => ({
    cast: [KIMONO, ROBE, WORK, CHEF].map((c, i) => ({ id: `w${i}`, c, world: { at: [(i - 1.5) * 150, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('face-calm'))] })),
  }),
  // áo cổ chéo: cúi chào 38° và 16°, ngồi ghế, ngồi quỳ trên gót; phía sau hai người đi
  'human-wrap-act': ({ KIMONO, ROBE, WORK, CHEF }) => ({
    cast: [
      { id: 'a0', c: KIMONO, world: { at: [-300, 0, 0], yaw: 90 }, tracks: [track(clip('bow-3d')), track(clip('face-calm'))] },
      { id: 'a1', c: WORK, world: { at: [-150, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('eshaku-3d', 0.2)), track(clip('face-calm'))] },
      { id: 'a2', c: CHEF, world: { at: [0, 0, 0], yaw: 90 }, tracks: [track(clip('bow-3d')), track(clip('face-calm'))] },
      { id: 'a3', c: ROBE, world: { at: [150, -SEAT, 0], yaw: 90, sit: true, floor: 0 }, tracks: [track(clip('sit-3d')), track(clip('hands-knees-3d')), track(clip('face-calm'))] },
      { id: 'a4', c: ROBE, world: { at: [320, -SEIZA, 0], yaw: 90, sit: true, floor: 0 }, tracks: [track(clip('seiza-3d')), track(clip('hands-lap-3d')), track(clip('face-calm'))] },
      { id: 'a5', c: ROBE, world: { path: [{ t: 0, at: [-200, 0, -300], yaw: 10 }, { t: 4, at: [300, 0, -300], yaw: 10 }] }, tracks: [track(clip('walk')), track(clip('face-calm'))] },
      { id: 'a6', c: WORK, world: { path: [{ t: 0, at: [-400, 0, -300], yaw: 10 }, { t: 4, at: [100, 0, -300], yaw: 10 }] }, tracks: [track(clip('walk')), track(clip('face-calm'))] },
    ],
    props: [stool(150, 0)],
  }),
  // đồ thêm: polo cổ dựng trên bụng phệ, yukata tay loe, cổ chéo đai trên bụng phệ, áo bếp khăn vắt vai, yukata khăn tắm — hàng đứng nhìn ống kính
  'human-extra': ({ POLO, YUKATA, ROBE_BELLY, CHEF_TOWEL, BATH }) => ({
    cast: [POLO, YUKATA, ROBE_BELLY, CHEF_TOWEL, BATH].map((c, i) => ({ id: `e${i}`, c, world: { at: i === 4 ? [-300, 0, 250] : [(i - 1) * 150, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('face-calm'))] })),
  }),
  // đồ thêm diễn: polo ngồi ghế; yukata giơ tay, chắp tay, cầm cốc; cổ chéo bụng phệ và áo bếp khoanh tay
  'human-extra-act': ({ POLO, YUKATA, ROBE_BELLY, CHEF_TOWEL }) => ({
    cast: [
      { id: 'x0', c: POLO, world: { at: [-300, -SEAT, 0], yaw: 90, sit: true, floor: 0 }, tracks: [track(clip('sit-3d')), track(clip('hands-knees-3d')), track(clip('face-calm'))] },
      { id: 'x1', c: YUKATA, world: { at: [-150, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('reach-out-3d')), track(clip('face-calm'))] },
      { id: 'x2', c: YUKATA, world: { at: [0, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('hands-front-3d')), track(clip('face-calm'))] },
      { id: 'x3', c: YUKATA, world: { at: [150, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('hold-mug')), track(clip('face-calm'))], equip: { handNear: 'mug' } },
      { id: 'x4', c: ROBE_BELLY, world: { at: [300, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('arms-fold-3d')), track(clip('face-calm'))] },
      { id: 'x7', c: CHEF_TOWEL, world: { at: [450, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('arms-fold-3d')), track(clip('face-calm'))] },
    ],
    props: [stool(-300, 0)],
  }),
  // đồ thêm đi và cúi: polo, yukata khăn tắm đi sang phải; áo bếp khăn vắt vai, yukata tay loe cúi chào
  'human-extra-move': ({ POLO, YUKATA, CHEF_TOWEL, BATH }) => ({
    cast: [
      { id: 'm0', c: POLO, world: { path: [{ t: 0, at: [-450, 0, 0], yaw: 0 }, { t: 4, at: [50, 0, 0], yaw: 0 }] }, tracks: [track(clip('walk')), track(clip('face-calm'))] },
      { id: 'm1', c: BATH, world: { path: [{ t: 0, at: [-250, 0, 250], yaw: 0 }, { t: 4, at: [250, 0, 250], yaw: 0 }] }, tracks: [track(clip('walk')), track(clip('face-calm'))] },
      { id: 'm2', c: CHEF_TOWEL, world: { at: [250, 0, 0], yaw: 90 }, tracks: [track(clip('bow-3d')), track(clip('face-calm'))] },
      { id: 'm3', c: YUKATA, world: { at: [500, 0, 0], yaw: 90 }, tracks: [track(clip('bow-3d')), track(clip('face-calm'))] },
    ],
  }),
  // đổi đồ theo `equip`: yukata bản đứng (`cast[].equip`), bản ngồi (mảnh nền), và người thay polo, gài kính ở giây 1
  'human-extra-equip': ({ WARDROBE }) => ({
    cast: [
      { id: 'q0', c: WARDROBE, world: { at: [-150, 0, 0], yaw: 90 }, equip: { hem: 'stand' }, tracks: [track(clip('stand-3d')), track(clip('face-calm'))] },
      { id: 'q1', c: WARDROBE, world: { at: [0, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('face-calm'))] },
      { id: 'q2', c: WARDROBE, world: { at: [150, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('face-calm', 0), clip('face-calm', 1, { equip: { torso: 'polo', neck: 'shades' } }))] },
    ],
  }),
  // cận mặt: ngượng đỏ mặt dần (`blush` của hành động), buồn, nói, méo há
  // áo khoác vạt mở và thẻ tên: hàng đứng nhìn ống kính
  'human-coat': ({ HAPPI, HAPPI_B, HAORI, SHIRT_TAG, WRAP_TAG }) => ({
    cast: [HAPPI, HAPPI_B, HAORI, SHIRT_TAG, WRAP_TAG].map((c, i) => ({ id: `c${i}`, c, world: { at: [(i - 2) * 150, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('face-calm'))] })),
  }),
  // áo khoác vạt mở: cúi chào 38° và 45°, giơ tay ra trước, ngồi ghế, ngồi quỳ trên gót; phía sau hai người đi
  'human-coat-act': ({ HAPPI, HAPPI_B, HAORI }) => ({
    cast: [
      { id: 'b0', c: HAPPI, world: { at: [-300, 0, 0], yaw: 90 }, tracks: [track(clip('bow-3d')), track(clip('face-calm'))] },
      { id: 'b1', c: HAPPI_B, world: { at: [-150, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('bow45-3d')), track(clip('face-calm'))] },
      { id: 'b2', c: HAPPI, world: { at: [0, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip('reach-3d')), track(clip('face-calm'))] },
      { id: 'b3', c: HAORI, world: { at: [150, -SEAT, 0], yaw: 90, sit: true, floor: 0 }, tracks: [track(clip('sit-3d')), track(clip('hands-knees-3d')), track(clip('face-calm'))] },
      { id: 'b4', c: HAPPI, world: { at: [320, -SEIZA, 0], yaw: 90, sit: true, floor: 0 }, tracks: [track(clip('seiza-3d')), track(clip('hands-lap-3d')), track(clip('face-calm'))] },
      { id: 'b5', c: HAPPI, world: { path: [{ t: 0, at: [-200, 0, -300], yaw: 10 }, { t: 4, at: [300, 0, -300], yaw: 10 }] }, tracks: [track(clip('walk')), track(clip('face-calm'))] },
      { id: 'b6', c: HAORI, world: { path: [{ t: 0, at: [-400, 0, -300], yaw: 10 }, { t: 4, at: [100, 0, -300], yaw: 10 }] }, tracks: [track(clip('walk')), track(clip('face-calm'))] },
    ],
    props: [stool(150, 0)],
  }),
  'human-faces': ({ LONG, SHORT, GIRL, GLASSES, PONY }) => ({
    cast: [[LONG, 'face-shy'], [GIRL, 'face-sad'], [SHORT, 'face-shocked'], [GLASSES, 'talk-lips'], [PONY, 'face-wry']].map(([c, f], i) => ({
      id: `m${i}`, c, world: { at: [(i - 2) * 150, 0, 0], yaw: 90 }, tracks: [track(clip('stand-3d')), track(clip(f, f === 'talk-lips' ? 0.2 : 0))],
    })),
  }),
};

/** Ghế đẩu tròn cao `SEAT` ở `x`, `z` */
function stool(x, z) {
  const b = new Batch();
  addItem(b, { at: { at: [0, 0, z] }, parts: [
    { v: box(x - 30, x + 30, -SEAT, -SEAT + 7.5, -30, 30), tone: { top: '#c9a679', lit: '#a98559' } },
    { v: box(x - 3, x + 3, -SEAT + 7.5, 0, -3, 3), tone: { top: '#77736e', lit: '#5f5b57' } },
  ] });
  return b.build();
}

/** Ghế băng dài `w` ngang trục x, tựa ở +z, mặt ngồi cao bằng gối người `height = 1`, giữa ở `x`, `z` */
function bench(x, z, w) {
  const b = new Batch();
  const seat = { top: '#4f6f80', lit: '#3d5866' }, metal = { top: '#8a9299', lit: '#6b7278' };
  addItem(b, { at: { at: [0, 0, z] }, parts: [
    { v: box(x - w / 2, x + w / 2, -SEAT, -SEAT + 8, -42, 44), tone: seat },
    { v: box(x - w / 2, x + w / 2, -SEAT - 90, -SEAT - 20, 40, 46), tone: seat },
    ...[x - w / 2 + 20, x + w / 2 - 20].flatMap((lx) => [{ v: box(lx - 3, lx + 3, -SEAT + 8, 0, -3, 3), tone: metal }, { v: box(lx - 3, lx + 3, -SEAT - 20, -SEAT, 41, 44), tone: metal }]),
  ] });
  return b.build();
}

/** Dựng cảnh `name` của người 3D mặc đồ; không có thì `null` */
export function humanDemo(name) {
  const make = SCENES[name];
  if (!make) return null;
  const { cast, props = [] } = make(models());
  const scene = parseScene({ name: `demo-${name}`, lens: LENS, cast: cast.map((m) => ({ id: m.id, character: `${m.id}.json`, world: m.world, tracks: m.tracks, ...(m.equip && { equip: m.equip }) })) });
  if (!scene.success) throw new Error(scene.error.message);
  const bodies = Object.fromEntries(cast.map((m) => [m.id, body3(m.c)]));
  const heights = Object.fromEntries(cast.map((m) => [m.id, m.c.rig.height]));
  const rt = resolveScene(scene.data, { ...ACTIONS, ...own() }, {}, {}, heights, bodies);
  // mỗi người một tủ đồ (`wardrobe`): đổi mảnh dựng khối theo `equip` là hiện bản khác
  const group = new THREE.Group();
  const people = cast.map((m, i) => ({
    ...m,
    w: wardrobe(m.c, (worn, seated) => fromCharacter(worn, { seed: i, items: SAMPLE_ITEMS, seated, skirt: worn.pieces.hem?.src === 'sculpt' ? worn.pieces.hem.skirt : undefined })),
  }));
  for (const p of people) group.add(p.w.get(sceneAt(rt, p.id, 0, heights[p.id], bodies[p.id]).equip, !!p.world.sit).fig.root);
  return {
    objects: [group, ...props],
    animate(t) {
      for (const p of people) {
        const sp = sceneAt(rt, p.id, t, heights[p.id], bodies[p.id]);
        const { fig, fresh } = p.w.get(sp.equip, !!p.world.sit);
        if (fresh) group.add(fig.root);
        for (const f of p.w.figures.values()) f.root.visible = f === fig;
        act(fig, sp, t);
        if (p.equip) dress(fig, p.equip, !!sp.world?.flip);
      }
    },
  };
}
