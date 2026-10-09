import { GLASSES_PRESETS, parseCharacter, SCULPT_PRESETS } from '@stickman3d/rig';
import * as THREE from 'three';
import { fromCharacter, GARMENT_STYLES, npr } from '@stickman3d/rig';

// Bộ sưu tập kiểu (`?demo=styles`): một hàng người mẫu, người thứ `i` đội mẫu tóc thứ `i` của SCULPT_PRESETS (cuối
// cùng là đầu trọc) và mặc kiểu áo thứ `i` của GARMENT_STYLES, rải kính, nếp nhăn và váy. JSON nhân vật dựng tại chỗ
// rồi qua `parseCharacter` như ở repo video. `?turn=độ` xoay từng người tại chỗ, `?cast=url,…` dựng JSON nhân vật bất kỳ thay cho người mẫu để soi.

const SPACING = 1.45;
const COLORS = ['#3aa89c', '#c8663a', '#34466e', '#9a5fa8', '#e0b23a', '#5a9a4a', '#7a2e2e', '#9aa7c7', '#2f4a3e', '#b9854a', '#a9cde6', '#5f7a8c'];
const HAIRS = ['#33333a', '#2a1c15', '#5b3a26', '#8a8e92', '#3b3038'];
const SKIRT_PLEATED = { rise: 27, waist: 40, length: 52, flare: 30, pleats: 8 };
const SKIRT_PLAIN = { rise: 27, waist: 40, length: 60, flare: 22, pleats: 0 };
const LONG = ['bang', 'bob', 'shoulder', 'center', 'ponyHigh', 'ponyLow', 'bun'];

/** Kính và nếp nhăn rải theo mẫu tóc */
const EXTRA = {
  short: { glasses: 'rect' },
  quiff: { glasses: 'sun' },
  bald: { wrinkle: 'light' },
  baldFront: { wrinkle: 'deep', glasses: 'bold' },
  curly: { glasses: 'round' },
  afro: { glasses: 'round' },
  bun: { glasses: 'round', wrinkle: 'light' },
};

/** Danh sách người mẫu: tên mẫu tóc, kiểu áo, JSON nhân vật chưa parse */
export function samples() {
  const hairs = [...Object.keys(SCULPT_PRESETS), 'none'];
  const garments = Object.keys(GARMENT_STYLES);
  return hairs.map((h, i) => {
    const style = garments[i % garments.length];
    const long = LONG.includes(h);
    const extra = EXTRA[h] ?? {};
    const json = {
      name: `${h}-${style}`,
      rig: { stroke: 6, height: 1, shoulderHalf: 40, shoulderDrop: 20, hipHalf: long ? 22 : 26 },
      palette: { garment: COLORS[i % COLORS.length], skin: '#f8e3c8', line: '#1c1c1e', sleeveWidth: 8, trouserWidth: 9 },
      face: extra.wrinkle ? { wrinkle: { kind: extra.wrinkle } } : {},
      pieces: {
        torso: { src: 'sculpt', garment: { style, ...(long ? { hem: -18 } : {}) } },
        hair: h === 'none' ? { src: 'none' } : { src: 'sculpt', color: HAIRS[i % HAIRS.length], sculpt: SCULPT_PRESETS[h].sculpt },
        ...(long ? { hem: { src: 'sculpt', color: '#3a3f4a', skirt: i % 2 ? SKIRT_PLAIN : SKIRT_PLEATED } } : {}),
        ...(extra.glasses ? { faceAcc: { src: 'sculpt', color: extra.glasses === 'sun' ? '#2b2f36' : '#3a2a22', glasses: GLASSES_PRESETS[extra.glasses].glasses } } : {}),
      },
    };
    return { hair: h, style, json };
  });
}

function figureOf(json, seed) {
  const r = parseCharacter(json);
  if (!r.success) throw new Error(`${json.name}: ${r.error.message}`);
  const c = r.data;
  return fromCharacter(c, { seed, skirt: c.pieces.hem?.src === 'sculpt' ? c.pieces.hem.skirt : undefined });
}

/** Người thứ `i` đứng ở x này (three) */
export const slotX = (i, n) => (i - (n - 1) / 2) * SPACING;

export function styles(q) {
  const extra = (q.get('cast') ?? '').split(',').filter(Boolean);
  const list = extra.length ? [] : samples();
  const n = list.length + extra.length;
  const figs = list.map((s, i) => figureOf(s.json, i));
  const place = (f, i) => {
    f.root.position.set(slotX(i, n), 0, 0);
    f.root.rotation.y = (Number(q.get('turn') ?? 14) * Math.PI) / 180;
    f.face.set({ mouth: 'closed', brow: 'neutral', eyes: 'open' });
    for (const s of [-1, 1]) f.legs[s].hip.rotation.set(0, 0, s * 0.03);
  };
  figs.forEach(place);
  const group = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(n * SPACING + 4, 8).rotateX(-Math.PI / 2), npr({ color: '#d9d2c3', stipple: 0.06, stippleScale: 1.4, soft: 1 }));
  floor.position.y = -0.004;
  group.add(floor, ...figs.map((f) => f.root));
  extra.forEach(async (url, k) => {
    const f = figureOf(await (await fetch(url)).json(), list.length + k);
    place(f, list.length + k);
    group.add(f.root);
  });
  return { objects: [group], animate() {} };
}

const MOUTHS = ['closed', 'parted', 'talkTeeth', 'talkA', 'talkB', 'talkO', 'talkSadA', 'talkSadB', 'talkAngryA', 'talkAngryB', 'smile', 'frown', 'pain', 'o', 'wide', 'grit', 'grin', 'wry', 'wryOpen'];
const EYES = ['open', 'shut', 'wide', 'squint', 'happy', 'squeezed', 'droopy', 'wink'];
const BROWS = ['neutral', 'flat', 'lifted', 'furrowed', 'angry', 'sad', 'raised', 'worried', 'skeptical'];

/**
 * Bảng nét mặt (`?demo=mouths`): mỗi khẩu hình của Mouth.tsx một người, ba hàng trên ba bậc, trái sang phải rồi lên
 * trên theo thứ tự `MOUTHS`; người thứ `i` mang kiểu mắt `i % 8` và kiểu mày `i % 9` để đủ mọi kiểu của Eyes.tsx, Brow.tsx.
 */
export function mouths() {
  const group = new THREE.Group();
  const riser = npr({ color: '#cfc6b4', stipple: 0.05, stippleScale: 1.4, soft: 1 });
  let i = 0;
  [7, 6, 6].forEach((n, r) => {
    if (r) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(n * SPACING + 0.6, 1.5 * r, 1.4), riser);
      step.position.set(0, 0.75 * r - 0.004, -1.5 * r);
      group.add(step);
    }
    for (let k = 0; k < n; k++, i++) {
      const json = { name: `mat-${i}`, palette: { garment: COLORS[i % COLORS.length], skin: '#f8e3c8' }, pieces: { torso: { src: 'sculpt', garment: { style: 'shirt' } }, hair: { src: 'sculpt', color: HAIRS[i % HAIRS.length], sculpt: SCULPT_PRESETS.short.sculpt } } };
      const f = figureOf(json, i);
      f.root.position.set(slotX(k, n), 1.5 * r, -1.5 * r);
      f.face.set({ mouth: MOUTHS[i], eyes: EYES[i % EYES.length], brow: BROWS[i % BROWS.length] });
      group.add(f.root);
    }
  });
  return { objects: [group], animate() {} };
}
