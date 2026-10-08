import { parseCharacter, parseScene, resolveScene, sceneAt } from '@stickman/rig';
import { act, addItem, Batch, box, characterOptions, room, seatCrowd, setLights, stickman } from '@stickman3d/rig';
import { ACTIONS, BOY } from './demos.js';
import { samples } from './demo-styles.js';

// Phòng dựng bằng bộ dựng phòng (`?demo=room`): văn phòng có dải cửa sổ tường trái (rèm lá kéo xuống 30%), cửa sổ nhỏ tường sau, cửa ra
// hành lang tường phải, tủ treo tường sau, đèn tấm trên trần, hai đảo bàn bốn chỗ có người nền đóng băng (JSON nhân vật mẫu qua `characterOptions`),
// một người đi về phía cửa.

const SEAT_Y = -87.5, TOP = 137;
const tone = (top, lit = top) => ({ top, lit });
const WOOD = tone('#8d5b43', '#6e4430'), METAL = tone('#2e2e30'), CHAIR = tone('#3a3d41'), PART = tone('#c9ccce', '#a2a6aa');
const SCREEN = tone('#1f2226'), LAMP = tone('#2f5d50', '#264c42');

/** Đảo bàn: hai dãy quay mặt vào nhau qua vách ở `x`, mỗi dãy bàn tâm `zs`; trả khối và chỗ ngồi */
function island(x, zs) {
  const parts = [], seats = [];
  for (const [sd, yaw] of [[-1, 0], [1, 180]])
    for (const z of zs) {
      const xa = x + sd * 140, [u0, u1] = sd < 0 ? [xa, x] : [x, xa];
      parts.push({ v: box(u0, u1, -TOP - 6, -TOP, z - 88, z + 88), tone: WOOD });
      for (const [lx, lz] of [[xa - sd * 8, z - 80], [xa - sd * 8, z + 80]]) parts.push({ v: box(lx - 4, lx + 4, -TOP, 0, lz - 4, lz + 4), tone: METAL });
      // màn hình quay về người ngồi
      parts.push({ v: box(x + sd * 34, x + sd * 30, -TOP - 110, -TOP - 30, z - 45, z + 45), tone: SCREEN });
      parts.push({ v: box(x + sd * 26, x + sd * 22, -TOP - 30, -TOP - 6, z - 6, z + 6), tone: METAL });
      // ghế: mặt ngồi dưới hông, tựa sau lưng
      const hx = xa + sd * 50;
      parts.push({ v: box(hx - 30, hx + 30, SEAT_Y, SEAT_Y + 8, z - 30, z + 30), tone: CHAIR });
      parts.push({ v: box(hx + sd * 30, hx + sd * 37, -270, SEAT_Y, z - 28, z + 28), tone: CHAIR });
      parts.push({ v: box(hx - 4, hx + 4, SEAT_Y + 8, -10, z - 4, z + 4), tone: METAL });
      parts.push({ v: box(hx - 28, hx + 28, -10, 0, z - 4, z + 4), tone: METAL });
      seats.push({ at: [hx, SEAT_Y, z], yaw });
    }
  parts.push({ v: box(x - 3, x + 3, -TOP - 120, -TOP, zs[0] - 88, zs[zs.length - 1] + 88), tone: PART });
  return { parts, seats };
}

const COATS = ['#4a4e55', '#5b6680', '#33363c', '#8a5a44', '#7893ae', '#3f55a0'];
/** JSON nhân vật mẫu cho người nền, như repo video đọc từ `characters/` */
const CAST = samples().filter((_, i) => i % 3 === 0).map(({ json }) => parseCharacter(json).data);

/** `q`: `time` giờ trong ngày (đèn bàn bật khi không phải ngày, chiều), `door=0..1` độ mở cửa cố định thay cho mở theo `t`. */
export function roomDemo(q) {
  const office = room({
    x: [-1100, 1100], z: [-800, 900], height: 780,
    floor: { grout: '#5f6367', size: 160 },
    windows: [
      { wall: 'left', u: 850, width: 1200, height: 380, sill: 250, panes: [5, 2], blind: 0.3 },
      { wall: 'back', u: 1750, width: 420, height: 300, sill: 300 },
    ],
    doors: [{ wall: 'right', u: 1200, hinge: 'left', sign: true }],
  });

  const a = island(-300, [-10, 170]), b = island(450, [-10, 170]);
  const fb = new Batch();
  addItem(fb, { at: { at: [0, 0, 0] }, parts: [...a.parts, ...b.parts,
    // tủ treo tường sau nhô 70: tường dưới nó chỉ tối một dải ngắn sát đáy tủ
    { v: box(-700, -200, -560, -400, 830, 900), tone: tone('#9c6a50', '#74472f') },
    // đèn bàn ở bàn trước bên trái đảo hai
    { v: box(510, 540, -TOP - 6, -TOP - 2, 140, 170), tone: METAL },
    { v: box(522, 528, -TOP - 170, -TOP - 6, 152, 158), tone: METAL },
  ] });
  const furniture = fb.build();
  const shade = new Batch();
  addItem(shade, { at: { at: [0, 0, 0] }, parts: [{ v: box(500, 560, -TOP - 200, -TOP - 170, 110, 160), tone: LAMP }] });
  const lampShade = shade.build({ shadow: false });

  // chỗ trống: một ở đảo một cho người đi ngang, một ở đảo hai cạnh đèn bàn
  const seats = [...a.seats, ...b.seats].filter((_, i) => i !== 1 && i !== 6);
  const crowd = seatCrowd(seats, (i) => characterOptions(CAST[i % CAST.length], { color: COATS[i % COATS.length] }));

  const LENS = { eye: [0, -200, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 };
  const sc = parseScene({
    name: 'demo-room', lens: LENS,
    cast: [{
      id: 'di', character: 'di.json',
      world: { path: [{ t: 0, at: [-800, 0, -480], yaw: -3 }, { t: 5, at: [850, 0, -400], yaw: -3 }] },
      tracks: [{ clips: [{ action: 'walk', start: 0 }, { action: 'stand-3d', start: 4.75, blend: 0.3 }] }, { clips: [{ action: 'face-calm', start: 0 }] }],
    }],
  });
  if (!sc.success) throw new Error(sc.error.message);
  const bodies = { di: { legHalf: 4.5, hipHalf: BOY.rig.hipHalf } };
  const rt = resolveScene(sc.data, ACTIONS, {}, {}, { di: 1 }, bodies);
  const walker = stickman({ ...BOY, color: '#3aa89c', face: { brow: 'worried' } });

  const time = q.get('time') ?? 'day';
  const lampOn = !['day', 'evening'].includes(time);
  const door = office.doors[0];
  const fixed = q.has('door') ? Number(q.get('door')) : null;
  const smooth = (x) => x * x * (3 - 2 * x);

  return {
    objects: [office.group, furniture, lampShade, crowd, walker.root],
    room: office,
    animate(t, stage) {
      if (stage) office.cull(stage.camera);
      door.set(fixed ?? 0.9 * smooth(Math.min(1, Math.max(0, (t - 2.5) / 1.5))));
      setLights(office.lights({
        lamps: [{ at: [530, -TOP - 180, 135], target: [470, -TOP, 90], angle: 36, penumbra: 0.3, color: '#ffc77a', intensity: lampOn ? 1.5 : 0, range: 340 }],
      }));
      act(walker, sceneAt(rt, 'di', t, 1, bodies.di), t);
    },
  };
}
