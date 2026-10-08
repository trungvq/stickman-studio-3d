import { addItem, Batch, box, G, put, setLights, stickman } from '@stickman3d/rig';
import { BOY, GIRL } from './demos.js';

// Phòng thử đèn (`?demo=light`): hộp phòng ba vách, cửa sổ tường trái, hai đèn trần, bàn có đèn bàn sát tường phải.
// Toạ độ rig (px, y xuống, z sâu vào cảnh); sàn y 0, trần y −780.

const ROOM = { x0: -800, x1: 800, z0: -700, z1: 600, h: 780, wall: 20 };
const WIN = { z: 0, y: -450, w: 500, h: 360 };
const DESK = { x0: 540, x1: 760, z0: 30, z1: 270, top: 137 };

/** Hậu kỳ toàn khung theo `grade=` */
export const GRADES = {
  flashback: { desaturate: 0.65, blur: 0.45 },
  dim: { darken: 0.55 },
  vhs: { vhs: 1, desaturate: 0.2 },
};

const tone = (top, lit = top) => ({ top, lit });
const WALL = tone('#b4b8bb'), CEIL = tone('#c9ccce'), FLOOR = tone('#74787c');
const WOOD = tone('#8d5b43', '#6e4430'), METAL = tone('#2e2e30'), CHAIR = tone('#3a3d41');
const FRAME = tone('#e3e6e9', '#d3d7db'), SHELF = tone('#5a4a3e', '#4a3c32'), BOOKS = [tone('#4fb3d4'), tone('#f2b233'), tone('#c46a3e')];

function shell() {
  const { x0, x1, z0, z1, h, wall: d } = ROOM;
  const wy0 = WIN.y - WIN.h / 2, wy1 = WIN.y + WIN.h / 2, wz0 = WIN.z - WIN.w / 2, wz1 = WIN.z + WIN.w / 2;
  return [
    { v: box(x0, x1, 0, d, z0, z1), tone: FLOOR },
    { v: box(x0, x1, -h - d, -h, z0, z1), tone: CEIL },
    { v: box(x0, x1, -h, 0, z1, z1 + d), tone: WALL },
    { v: box(x1, x1 + d, -h, 0, z0, z1 + d), tone: WALL },
    // tường trái chừa lỗ cửa sổ
    { v: box(x0 - d, x0, wy1, 0, z0, z1 + d), tone: WALL },
    { v: box(x0 - d, x0, -h, wy0, z0, z1 + d), tone: WALL },
    { v: box(x0 - d, x0, wy0, wy1, z0, wz0), tone: WALL },
    { v: box(x0 - d, x0, wy0, wy1, wz1, z1 + d), tone: WALL },
    { v: box(x0 - d, x0, wy0, wy1, WIN.z - 3, WIN.z + 3), tone: FRAME },
    { v: box(x0 - d, x0, WIN.y - 3, WIN.y + 3, wz0, wz1), tone: FRAME },
    { v: box(x0 - d, x0 + 8, wy1, wy1 + 8, wz0 - 10, wz1 + 10), tone: FRAME },
  ];
}

function furniture() {
  const { x0, x1, z0, z1, top } = DESK;
  const legs = [[x0 + 8, z0 + 8], [x1 - 8, z0 + 8], [x0 + 8, z1 - 8], [x1 - 8, z1 - 8]];
  const shelf = [-400, -270, -140].map((y) => ({ v: box(-650, -350, y - 6, y, 520, 600), tone: SHELF }));
  return [
    { v: box(x0, x1, -top - 6, -top, z0, z1), tone: WOOD },
    ...legs.map(([x, z]) => ({ v: box(x - 4, x + 4, -top, 0, z - 4, z + 4), tone: METAL })),
    // ghế đẩu dưới hông người ngồi
    { v: box(440, 500, -87.5, -80, 120, 180), tone: CHAIR },
    { v: box(466, 474, -80, 0, 146, 154), tone: METAL },
    { v: box(-650, -350, -400, 0, 590, 600), tone: SHELF },
    { v: box(-650, -644, -400, 0, 520, 600), tone: SHELF },
    { v: box(-356, -350, -400, 0, 520, 600), tone: SHELF },
    ...shelf,
    ...[-400, -270].flatMap((y, j) => [0, 1, 2].map((i) => ({ v: box(-630 + i * 70 + j * 30, -585 + i * 70 + j * 30, y + 6, y + 120, 530, 590), tone: BOOKS[(i + j) % 3] }))),
    // chân và cần đèn bàn
    { v: box(700, 740, -149, -143, 210, 250), tone: METAL },
    { v: box(716, 724, -330, -149, 226, 234), tone: METAL },
    { v: box(660, 724, -336, -328, 186, 234), tone: METAL },
  ];
}

/** Chao đèn bàn và tấm đèn trần: không đổ bóng (chao bọc bóng đèn). */
function fixtures() {
  const b = new Batch();
  addItem(b, { at: { at: [0, 0, 0] }, parts: [{ v: box(632, 688, -350, -318, 160, 212), tone: tone('#2f5d50', '#264c42') }] });
  for (const x of [-300, 300]) addItem(b, { at: { at: [0, 0, 0] }, parts: [{ v: box(x - 130, x + 130, -780, -774, -140, 140), tone: { top: '#fbfaf4', lit: '#fbfaf4', glow: true } }] });
  return b.build({ shadow: false });
}

/** `q`: `spot` bật đèn rọi sân khấu quét từ người đứng sang người ngồi, `lamp=0|1` đèn bàn (mặc định bật khi không phải ngày, chiều). */
export function lightDemo(q) {
  const b = new Batch();
  addItem(b, { at: { at: [0, 0, 0] }, parts: [...shell(), ...furniture()] });
  const room = b.build();
  const fx = fixtures();
  const panels = fx.children.filter((m) => m.material.uniforms.uEmissive.value > 0);

  const boy = stickman({ ...BOY, face: { brow: 'worried' } });
  const girl = stickman({ ...GIRL, seated: true });
  put(boy, [-650, 0, 60], 40);
  put(girl, [470, -87.5, 150], 0, true);
  boy.arms[1].shoulder.rotation.set(-0.05, 0, 0.18);
  boy.arms[-1].shoulder.rotation.set(-0.05, 0, -0.18);
  for (const s of [-1, 1]) {
    girl.arms[s].shoulder.rotation.set(-0.9, 0, s * 0.1);
    girl.arms[s].elbow.rotation.set(-0.7, 0, 0);
  }

  const time = q.get('time') ?? 'day';
  const lampOn = q.has('lamp') ? q.get('lamp') !== '0' : !['day', 'evening'].includes(time);
  const spot = q.has('spot');
  const lerp = (a, c, u) => a.map((v, i) => v + (c[i] - v) * u);
  const smooth = (a, c, x) => {
    const u = Math.min(1, Math.max(0, (x - a) / (c - a)));
    return u * u * (3 - 2 * u);
  };

  return {
    objects: [room, fx, boy.root, girl.root],
    animate(t) {
      const lamps = [], on = spot ? smooth(0, 0.3, t) : 0;
      if (spot) {
        const u = smooth(1, 2.5, t);
        lamps.push({ at: [0, -770, -100], target: lerp([-650, -230, 60], [470, -200, 150], u), angle: 12, penumbra: 0.12, color: '#fff1c4', intensity: 1.6 * on, range: 1100 });
      }
      lamps.push({ at: [660, -322, 186], target: [600, -137, 140], angle: 34, penumbra: 0.3, color: '#ffc77a', intensity: lampOn ? 1.5 : 0, range: 320 });
      setLights({
        // đèn rọi bật thì phòng tối bớt
        ceiling: { y: -ROOM.h, intensity: 1 - 0.4 * on },
        window: { at: [ROOM.x0, WIN.y, WIN.z], normal: [1, 0, 0], width: WIN.w, height: WIN.h, bars: [2, 2] },
        lamps,
        bounds: { min: [ROOM.x0 - ROOM.wall, -ROOM.h - ROOM.wall, ROOM.z0], max: [ROOM.x1 + ROOM.wall, ROOM.wall, ROOM.z1 + ROOM.wall] },
      });
      for (const m of panels) m.material.uniforms.uEmissive.value = G.uKey.value;
      boy.spine.rotation.x = Math.sin(t * 1.6) * 0.012;
      girl.head.rotation.x = 0.12 + Math.sin(t * 1.3) * 0.02;
    },
  };
}
