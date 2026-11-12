import { fromCharacter, parseCharacter, SCULPT_PRESETS } from '@stickman3d/rig';
import * as THREE from 'three';

// Bảng mắt người (`?demo=eyes`): đầu `human` không thân, mỗi hàng một dáng mắt (`face.eyeShape`: nam, nữ, trẻ em, người
// già), mỗi cột một kiểu mắt — ba nấc chớp giữa chừng, mi xiên theo mày giận và buồn, `squeezed`, `sly` giữ nét manga.
// `?turn=độ` xoay từng đầu tại chỗ (mặc định 0, nhìn thẳng ống kính).

const DX = 0.9;
const DY = 1.05;
/** Tâm đầu hàng trên cùng (three): đầu người cao 1 đứng thẳng */
export const HEAD_Y = 3.45;

export const ROWS = [
  { name: 'nam', eyeShape: 'male', hair: 'short', hairColor: '#2a1c15' },
  { name: 'nữ', eyeShape: 'female', hair: 'bob', hairColor: '#3b3038', blush: 0.3 },
  { name: 'trẻ em', eyeShape: 'child', hair: 'anime', hairColor: '#33333a', blush: 0.4 },
  { name: 'người già', eyeShape: 'elder', hair: 'baldLight', hairColor: '#8a8378', wrinkle: 'light' },
];

/** Cột: nhãn, kiểu mắt, mày, khẩu hình, độ nhắm chớp mắt */
const COLS = [
  ['open', 'open', 'neutral', 'closed', 0],
  ['chớp 3/8', 'open', 'neutral', 'closed', 0.375],
  ['chớp 5/8', 'open', 'neutral', 'closed', 0.625],
  ['chớp 7/8', 'open', 'neutral', 'closed', 0.875],
  ['shut', 'shut', 'neutral', 'closed', 0],
  ['wide', 'wide', 'lifted', 'o', 0],
  ['bulge', 'bulge', 'raised', 'wide', 0],
  ['squint', 'squint', 'furrowed', 'meh', 0],
  ['happy', 'happy', 'neutral', 'grin', 0],
  ['droopy', 'droopy', 'flat', 'closed', 0],
  ['wink', 'wink', 'neutral', 'smile', 0],
  ['giận', 'open', 'angry', 'frown', 0],
  ['buồn', 'open', 'sad', 'frown', 0],
  ['lo', 'open', 'worried', 'parted', 0],
  ['squeezed', 'squeezed', 'furrowed', 'grit', 0],
  ['sly', 'sly', 'flat', 'smirk', 0],
];

export function figureOf(row, seed) {
  const r = parseCharacter({
    name: `mat-${row.eyeShape}`,
    head: { form: 'human' },
    palette: { skin: '#f8e3c8', line: '#1c1c1e' },
    face: { eyeShape: row.eyeShape, ...(row.blush && { blush: row.blush }), ...(row.wrinkle && { wrinkle: { kind: row.wrinkle } }) },
    pieces: {
      hair: { src: 'sculpt', color: row.hairColor, sculpt: SCULPT_PRESETS[row.hair].sculpt },
    },
  });
  if (!r.success) throw new Error(`${row.name}: ${r.error.message}`);
  return fromCharacter(r.data, { seed });
}

/** Chỉ giữ nét dưới nhóm đầu */
export function headOnly(f) {
  f.root.updateMatrixWorld(true);
  f.root.traverse((o) => {
    if (!o.isMesh && !o.isLine) return;
    let p = o;
    while (p && p !== f.head) p = p.parent;
    if (!p) o.visible = false;
  });
}

/** Nhãn chữ trên một tấm phẳng rộng `w` (three), chữ đen trên nền trong suốt */
export function label(text, w, align = 'center') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.font = '56px sans-serif';
  g.fillStyle = '#1c1c1e';
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(text, align === 'right' ? 500 : 256, 48);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, (w * 96) / 512), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.userData.noShadow = true;
  m.userData.noCollide = true;
  return m;
}

export function eyesDemo(q) {
  const turn = (Number(q.get('turn') ?? 0) * Math.PI) / 180;
  const group = new THREE.Group();
  const x0 = -((COLS.length - 1) / 2) * DX;
  ROWS.forEach((row, r) => {
    COLS.forEach(([text, eyes, brow, mouth, blink], c) => {
      const f = figureOf(row, r * COLS.length + c);
      f.root.position.set(x0 + c * DX, -r * DY, 0);
      f.root.rotation.y = turn;
      f.face.set({ mouth, brow, eyes }, blink);
      headOnly(f);
      const l = label(text, 0.6);
      l.position.set(x0 + c * DX, HEAD_Y - r * DY + 0.47, 0.3);
      group.add(f.root, l);
    });
    const name = label(row.name, 1.4, 'right');
    name.position.set(x0 - 1.1, HEAD_Y - r * DY, 0);
    group.add(name);
  });
  return { objects: [group], animate() {} };
}
