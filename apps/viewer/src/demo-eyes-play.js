import { BLINK } from '@stickman3d/rig';
import * as THREE from 'three';
import { figureOf, HEAD_Y, headOnly, ROWS } from './demo-eyes.js';

// Mắt diễn theo `t` (`?demo=eyes-play`): bốn dáng mắt (nam, nữ, trẻ em, người già) nhìn thẳng và quay 3/4, chạy
// một lượt 16 s — nghỉ có chớp mắt, liếc trái phải lên xuống, đảo mắt một vòng, từng kiểu mắt và mi xiên theo mày, rồi
// chớp mắt ở tốc độ thật. Nhãn trên cùng là trạng thái lúc ấy, góc trái trên là giây. Khung ống kính:
// `az=0&el=0&look=-0.25,3.2,0&dist=5.6`.

const DX = 1;
const DY = 1.05;
const TURN = 35;
export const LENGTH = 16;

/** Chỗ chuyển hướng nhìn: liếc là nhảy nhanh (saccade) */
const SACCADE = 0.1;

const NEUTRAL = { eyes: 'open', brow: 'neutral', mouth: 'closed' };

/** Đoạn: `[từ, tới, nhãn, nét mặt, hướng nhìn]`; hướng nhìn là hàm của giây trong đoạn hay một cặp số */
const SPANS = [
  [0, 2.2, 'Nghỉ · mắt mở, chớp mắt tự nhiên', NEUTRAL, [0, 0]],
  [2.2, 3.0, 'look [1, 0] · liếc sang trái nhân vật', NEUTRAL, [1, 0]],
  [3.0, 3.8, 'look [−1, 0] · liếc sang phải nhân vật', NEUTRAL, [-1, 0]],
  [3.8, 4.6, 'look [0, −1] · nhìn lên (mi trên mở thêm)', NEUTRAL, [0, -1]],
  [4.6, 5.4, 'look [0, 1] · nhìn xuống (mi trên sụp nhẹ)', NEUTRAL, [0, 1]],
  [5.4, 6.0, 'look [0,7, 0,4] · liếc chéo xuống trái', NEUTRAL, [0.7, 0.4]],
  [6.0, 7.4, 'Đảo mắt một vòng', NEUTRAL, (u) => (u < 0.1 || u > 1.3 ? [0, 0] : roll((u - 0.1) / 1.2))],
  [7.4, 8.2, 'wide · mở to, ngạc nhiên', { eyes: 'wide', brow: 'lifted', mouth: 'o' }, [0, 0]],
  [8.2, 9.0, 'bulge · trố mắt, sốc', { eyes: 'bulge', brow: 'raised', mouth: 'wide' }, [0, 0]],
  [9.0, 9.8, 'squint · nheo mắt, nghi ngờ', { eyes: 'squint', brow: 'furrowed', mouth: 'meh' }, [0.5, 0]],
  [9.8, 10.6, 'happy · cười tít', { eyes: 'happy', brow: 'neutral', mouth: 'grin' }, [0, 0]],
  [10.6, 11.4, 'droopy · lờ đờ, chán', { eyes: 'droopy', brow: 'flat', mouth: 'closed' }, [0, 0.3]],
  [11.4, 12.2, 'wink · nháy mắt', { eyes: 'wink', brow: 'neutral', mouth: 'smile' }, [0, 0]],
  [12.2, 13.0, 'shut · nhắm mắt', { eyes: 'shut', brow: 'neutral', mouth: 'closed' }, [0, 0]],
  [13.0, 13.8, 'mày angry · mi trên hạ phía trong (giận)', { eyes: 'open', brow: 'angry', mouth: 'frown' }, [0, 0]],
  [13.8, 14.6, 'mày sad · mi trên hạ phía ngoài (buồn)', { eyes: 'open', brow: 'sad', mouth: 'frown' }, [0, 0.2]],
  [14.6, LENGTH, 'Chớp mắt tốc độ thật (60 fps: 2 khung nhắm, 1 giữ, 4 mở)', NEUTRAL, [0, 0]],
];

/** Giây bắt đầu các cái chớp; cột sau chớp muộn hơn một chút như người thật không chớp cùng lúc */
const BLINKS = [0.7, 1.75, 6.3, 14.85, 15.15, 15.7];
const LAG = [0, 0.07, 0.03, 0.11];

/** Độ nhắm của một cái chớp bắt đầu ở `d = 0`: cùng nhịp và nấc với `blinkAt` của lõi */
function blinkShape(d) {
  const B = BLINK;
  const v = d < 0 ? 0 : d < B.close ? d / B.close : d < B.close + B.hold ? 1 : 1 - (d - B.close - B.hold) / B.open;
  return Math.round(Math.min(1, Math.max(0, v)) * B.steps) / B.steps;
}
const blinkOf = (t, col) => Math.max(0, ...BLINKS.map((b) => blinkShape(t - b - LAG[col])));

/** Đảo mắt: một vòng theo chiều kim đồng hồ trên hình, bắt đầu từ bên trái nhân vật */
const roll = (u) => [Math.cos(u * Math.PI * 2), Math.sin(u * Math.PI * 2)];

const smooth = (u) => u * u * (3 - 2 * u);
const spanAt = (t) => SPANS.find(([a, b]) => t >= a && t < b) ?? SPANS.at(-1);
const lookOf = (s, t) => (typeof s[4] === 'function' ? s[4](t - s[0]) : s[4]);

/** Hướng nhìn lúc `t`: giữ hướng của đoạn, liếc sang đoạn mới trong `SACCADE` giây */
function lookAt(t) {
  const i = SPANS.indexOf(spanAt(t));
  const s = SPANS[i], to = lookOf(s, t);
  if (i === 0 || typeof s[4] === 'function') return to;
  const u = (t - s[0]) / SACCADE;
  if (u >= 1) return to;
  const p = SPANS[i - 1], from = lookOf(p, s[0]);
  const f = smooth(Math.max(0, u));
  return [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f];
}

/** Tấm chữ đổi được rộng `w`, cao `h` (three): canvas vẽ lại khi chữ đổi, chữ thu nhỏ cho vừa bề ngang */
export function textPlane(w, h, align = 'center', color = '#1c1c1e') {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = Math.round((2048 * h) / w);
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.userData.noShadow = true;
  mesh.userData.noCollide = true;
  let last;
  const set = (text) => {
    if (text === last) return;
    last = text;
    g.clearRect(0, 0, c.width, c.height);
    const px = Math.min(0.7 * c.height, (0.7 * c.height * c.width * 0.98) / measure(g, text, 0.7 * c.height));
    g.font = `600 ${px}px sans-serif`;
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillText(text, align === 'left' ? 8 : align === 'right' ? c.width - 8 : c.width / 2, c.height / 2);
    tex.needsUpdate = true;
  };
  return { mesh, set };
}

function measure(g, text, px) {
  g.font = `600 ${px}px sans-serif`;
  return g.measureText(text).width;
}

export function eyesPlayDemo() {
  const group = new THREE.Group();
  const x0 = -((ROWS.length - 1) / 2) * DX;
  const heads = [];
  for (const [r, turn] of [[0, 0], [1, TURN]])
    ROWS.forEach((row, c) => {
      const f = figureOf(row, c);
      f.root.position.set(x0 + c * DX, -r * DY, 0);
      f.root.rotation.y = (turn * Math.PI) / 180;
      headOnly(f);
      heads.push({ f, c });
      group.add(f.root);
    });
  ROWS.forEach((row, c) => {
    const l = textPlane(0.9, 0.12);
    l.set(row.name);
    l.mesh.position.set(x0 + c * DX, HEAD_Y + 0.55, 0.3);
    group.add(l.mesh);
  });
  for (const [r, text] of [[0, 'nhìn thẳng'], [1, 'quay 3/4']]) {
    const l = textPlane(0.6, 0.09, 'right', '#5a5650');
    l.set(text);
    l.mesh.position.set(x0 - 0.75, HEAD_Y - r * DY, 0);
    group.add(l.mesh);
  }
  const title = textPlane(3.4, 0.2);
  title.mesh.position.set(0, HEAD_Y + 0.84, 0.3);
  const clock = textPlane(0.6, 0.09, 'right', '#5a5650');
  clock.mesh.position.set(x0 - 0.75, HEAD_Y + 0.84, 0.3);
  group.add(title.mesh, clock.mesh);

  const animate = (t0) => {
    const t = ((t0 % LENGTH) + LENGTH) % LENGTH;
    const s = spanAt(t);
    title.set(s[2]);
    clock.set(`${t.toFixed(2).replace('.', ',')} s`);
    const look = lookAt(t);
    for (const { f, c } of heads) f.face.set({ ...s[3], look }, blinkOf(t, c));
  };
  animate(0);
  return { objects: [group], animate };
}
