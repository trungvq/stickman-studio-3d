import * as THREE from 'three';
import {
  addItem, along, appear, Batch, bounce, box, canvasTexture, decal, deskCalendar, flutter, keyed, loadFonts, monitor, place,
  placeOn, put, setLights, sheet, stickman, strokes, toThree, typeText, wallClock, wear, wearDecal, wobble,
} from '@stickman3d/rig';
import { BOY, GIRL } from './demos.js';
import { SAMPLE_ITEMS } from './demo-hold.js';

// `?demo=decal`: chữ nằm trên vật và món chạy theo `t` — màn hình gõ mail, giấy nhớ đếm 「正」, đồng hồ tua ngược,
// lịch lật trang, thẻ 「研修中」 trên ngực, tờ giấy bay xuống bàn. `?demo=police`: ẩn dụ cảnh sát phân luồng giữa lối đi
// văn phòng. Toạ độ rig (px, y xuống, z sâu vào cảnh); sàn y 0.

const JP = '"Noto Sans CJK JP", "Noto Sans JP", "Hiragino Sans", sans-serif';
const tone = (top, lit = top) => ({ top, lit });
const WALL = tone('#c3c6c4'), FLOOR = tone('#7d8186'), CEIL = tone('#d0d2d0');
const WOOD = tone('#b98d62', '#9c7550'), METAL = tone('#55575c');

const MAIL = '念のため確認です。先ほどの件、提案は3案に絞って、資料は木曜に共有する形で進めます。';
const DAYS = [['9', '28', '月'], ['9', '29', '火'], ['9', '30', '水'], ['10', '1', '木'], ['10', '2', '金'], ['10', '3', '土'], ['10', '4', '日'], ['10', '5', '月']];
/** Năm nét của 「正」 trong ô 100×100 theo thứ tự viết khi đếm */
const SEI = [[14, 16, 86, 16], [50, 16, 50, 88], [50, 52, 78, 52], [24, 50, 24, 88], [10, 88, 90, 88]];

/** Mặt bàn (y rig) */
const TOP = -143;

/** Hộp phòng: sàn, trần, tường sau, hai tường bên */
function shell({ x0, x1, z0, z1, h }) {
  const d = 20;
  return [
    { v: box(x0, x1, 0, d, z0, z1), tone: FLOOR },
    { v: box(x0, x1, -h - d, -h, z0, z1), tone: CEIL },
    { v: box(x0, x1, -h, 0, z1, z1 + d), tone: WALL },
    { v: box(x0 - d, x0, -h, 0, z0, z1 + d), tone: WALL },
    { v: box(x1, x1 + d, -h, 0, z0, z1 + d), tone: WALL },
  ];
}

function desk(x0, x1, z0, z1) {
  const legs = [[x0 + 6, z0 + 6], [x1 - 6, z0 + 6], [x0 + 6, z1 - 6], [x1 - 6, z1 - 6]];
  return [
    { v: box(x0, x1, TOP, TOP + 6, z0, z1), tone: WOOD },
    ...legs.map(([x, z]) => ({ v: box(x - 4, x + 4, TOP + 6, 0, z - 4, z + 4), tone: METAL })),
  ];
}

function solid(parts, o) {
  const b = new Batch();
  addItem(b, { at: { at: [0, 0, 0] }, parts });
  return b.build(o);
}

const ceilingPanels = (xs, zs, h) => solid(xs.flatMap((x) => zs.map((z) => ({ v: box(x - 110, x + 110, -h, -h + 5, z - 90, z + 90), tone: { top: '#fbfaf4', lit: '#fbfaf4', glow: true } }))), { shadow: false });

/** Tờ tài liệu: tiêu đề và các dòng xám, đứng yên */
function docTexture(title) {
  const s = canvasTexture(352, 496, (ctx) => {
    ctx.fillStyle = '#fbfaf5';
    ctx.fillRect(0, 0, 352, 496);
    ctx.fillStyle = '#1d1d22';
    ctx.font = `700 54px ${JP}`;
    ctx.fillText(title, 34, 86);
    ctx.fillStyle = '#c8443a';
    ctx.fillRect(34, 104, 120, 6);
    ctx.fillStyle = '#9a9ca3';
    for (let i = 0; i < 9; i++) ctx.fillRect(34, 150 + i * 36, i % 3 === 2 ? 180 : 284, 9);
  });
  s.update(0);
  return s;
}

const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/** `q`: `spot` tắt bớt đèn trần, đèn rọi quét từ người đứng sang người ngồi */
export function decalDemo(q) {
  const ROOM = { x0: -620, x1: 620, z0: -300, z1: 520, h: 700 };
  const room = solid([
    ...shell(ROOM),
    ...desk(-170, 170, 200, 340),
    // ghế đẩu dưới hông người ngồi
    { v: box(-60, 0, -87.5, -80, 120, 180), tone: METAL },
    { v: box(-34, -26, -80, 0, 146, 154), tone: METAL },
  ]);
  const panels = ceilingPanels([-300, 300], [100], ROOM.h);

  // màn hình: cửa sổ mail gõ dần, con trỏ nhấp nháy
  const typed = (t) => Math.min(MAIL.length, Math.max(0, Math.floor((t - 0.8) * 9)));
  const mail = canvasTexture(1536, 900, (ctx, t) => {
    ctx.fillStyle = '#2f5f7c';
    ctx.fillRect(0, 0, 1536, 900);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(110, 70, 1316, 780);
    ctx.fillStyle = '#e6eaef';
    ctx.fillRect(110, 70, 1316, 86);
    ctx.fillStyle = '#1d1d22';
    ctx.font = `700 46px ${JP}`;
    ctx.fillText('新規メッセージ', 150, 128);
    ctx.font = `400 42px ${JP}`;
    ctx.fillStyle = '#6a6d75';
    ctx.fillText('宛先：', 150, 226);
    ctx.fillText('件名：', 150, 300);
    ctx.fillStyle = '#1d1d22';
    ctx.fillText('リーダー', 290, 226);
    ctx.fillText('先ほどの件（確認）', 290, 300);
    ctx.fillStyle = '#d5d9df';
    ctx.fillRect(150, 250, 1236, 3);
    ctx.fillRect(150, 324, 1236, 3);
    typeText(ctx, MAIL, typed(t), { x: 150, y: 410, maxWidth: 1230, lineHeight: 70, font: `400 48px ${JP}`, cursor: t, cursorColor: '#2f6fd6' });
    ctx.fillStyle = '#2f6fd6';
    ctx.fillRect(1196, 742, 190, 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 40px ${JP}`;
    ctx.fillText('送信', 1250, 792);
  }, { key: (t) => [typed(t), Math.floor(t * 2) % 2] });
  const mon = monitor({ screen: mail });
  mon.group.position.copy(toThree([0, TOP, 305]));

  // giấy nhớ vàng ở góc phải trên màn hình, rộng hai chữ ngay từ đầu; nét k kẻ trong 0,45 s từ 0,3 + 0,6(k−1)
  const seiN = (t) => SEI.concat(SEI).reduce((n, _, k) => n + smooth(0.3 + 0.6 * k, 0.75 + 0.6 * k, t), 0);
  const note = canvasTexture(528, 240, (ctx, t) => {
    ctx.fillStyle = '#f6dc5c';
    ctx.fillRect(0, 0, 528, 240);
    ctx.fillStyle = '#efcf45';
    ctx.fillRect(0, 0, 528, 26);
    ctx.scale(2.4, 2.4);
    const lines = [...SEI, ...SEI.map((l) => l.map((v, i) => (i % 2 ? v : v + 100)))].map((l) => l.map((v, i) => (i % 2 ? v + 2 : v + 10)));
    strokes(ctx, lines, Math.min(8, seiN(t)), { color: '#24232a', width: 5.5 });
  }, { key: (t) => Math.round(Math.min(8, seiN(t)) * 40) });
  const noteSheet = sheet(note, 46, 21, { bend: 0.8, bendAxis: 'y' });
  noteSheet.position.set(0.58, 0.37, 0.006);
  noteSheet.rotation.z = -0.05;
  mon.face.add(noteSheet);

  // đồng hồ tường: 15:00 tua ngược về 8:30 trong 0,8–3,8 s rồi chạy tiếp
  const clock = wallClock({ r: 44, numbers: true, second: true });
  clock.group.position.copy(toThree([-330, -470, 520]));
  const hours = (t) => keyed([{ t: 0.8, v: 15 }, { t: 3.8, v: 8.5, ease: 'inOut' }], t) + Math.max(0, t - 3.8) / 60;

  // lịch bàn lật từ 9/28 tới 10/3 trong 1,5–5 s
  const cal = deskCalendar({
    pages: DAYS.length,
    draw(ctx, i, w, h) {
      const [m, d, wd] = DAYS[i];
      const col = wd === '土' ? '#2f6fd6' : wd === '日' ? '#d0443a' : '#1d1d22';
      ctx.fillStyle = '#fbfaf5';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c8443a';
      ctx.fillRect(0, 0, w, h * 0.2);
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.round(h * 0.13)}px ${JP}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${m}月`, w / 2, h * 0.15);
      ctx.fillStyle = col;
      ctx.font = `700 ${Math.round(h * 0.5)}px ${JP}`;
      ctx.fillText(d, w / 2, h * 0.7);
      ctx.font = `700 ${Math.round(h * 0.16)}px ${JP}`;
      ctx.fillText(`（${wd}）`, w / 2, h * 0.92);
    },
  });
  cal.group.position.copy(toThree([118, TOP, 262]));
  cal.group.rotation.y = -0.3;
  const page = (t) => keyed([{ t: 1.5, v: 0 }, { t: 5, v: 5, ease: 'inOut' }], t);

  const haru = stickman({ ...BOY, seated: true });
  put(haru, [-30, -87.5, 150], -90, true);
  for (const s of [-1, 1]) {
    haru.arms[s].shoulder.rotation.set(-0.95, 0, s * 0.12);
    haru.arms[s].elbow.rotation.set(-0.6, 0, 0);
  }
  const trainee = stickman({ ...GIRL, face: { brow: 'worried' } });
  put(trainee, [330, 0, 120], 115);
  trainee.arms[1].shoulder.rotation.set(-0.05, 0, 0.16);
  trainee.arms[-1].shoulder.rotation.set(-0.05, 0, -0.16);
  const badge = canvasTexture(384, 144, (ctx) => {
    ctx.fillStyle = '#fbfaf5';
    ctx.fillRect(0, 0, 384, 144);
    ctx.fillStyle = '#c8443a';
    ctx.fillRect(0, 0, 384, 26);
    ctx.fillStyle = '#1d1d22';
    ctx.font = `700 80px ${JP}`;
    ctx.textAlign = 'center';
    ctx.fillText('研修中', 192, 116);
  });
  badge.update(0);
  wearDecal(trainee, badge, 30, 11.25, { card: { thick: 0.8 } });

  // tờ giấy bay từ phải trên xuống bàn, nằm ngửa ở 4,4 s rồi rung tắt dần
  const doc = sheet(docTexture('資料'), 44, 62, { bend: 1.5 });
  const LAND = 4.4;
  const flight = [
    { t: 2.4, at: [560, -470, 60], yaw: 60, pitch: -25 },
    { t: 3.4, at: [240, -320, 170], yaw: 80, pitch: -55 },
    { t: LAND, at: [-100, TOP - 1.2, 255], yaw: 90, pitch: -90, ease: 'out' },
  ];

  const spot = q.has('spot');
  return {
    objects: [room, panels, mon.group, clock.group, cal.group, haru.root, trainee.root, doc],
    async ready() {
      await loadFonts([`700 48px ${JP}`, `400 48px ${JP}`], MAIL + '新規メッセージ宛先件名リーダー先ほどの件確認送信資料研修中月火水木金土日');
    },
    animate(t) {
      const on = spot ? smooth(0.2, 0.5, t) : 0;
      setLights({
        ceiling: { y: -ROOM.h, intensity: 1 - 0.55 * on },
        lamps: spot ? [{ at: [0, -690, -100], target: keyed([{ t: 1.5, v: [330, -250, 120] }, { t: 3, v: [-30, -220, 150], ease: 'inOut' }], t), angle: 13, penumbra: 0.15, color: '#fff1c4', intensity: 1.2 * on, range: 1100 }] : [],
        bounds: { min: [ROOM.x0 - 20, -ROOM.h - 20, ROOM.z0], max: [ROOM.x1, 20, ROOM.z1 + 20] },
      });
      mail.update(t);
      note.update(t);
      clock.set(hours(t));
      cal.set(page(t));
      appear(doc, t, { in: 2.4, dur: 0.4, mode: 'fade' });
      const p = along(flight, t);
      p.roll += t < LAND ? flutter(t, { amp: 18, freq: 1.4 }) * (1 - smooth(LAND - 0.4, LAND, t)) : 0;
      p.pitch += wobble(t, LAND, { amp: 5, freq: 3.2, decay: 5 });
      p.at = [p.at[0], p.at[1] - bounce(t, LAND, { height: 3, period: 0.18 }), p.at[2]];
      place(doc, p);
      haru.head.rotation.x = 0.1 + Math.sin(t * 1.3) * 0.02;
    },
  };
}

/** Mũ cảnh sát của app xem thử, đội bằng `wear` */
function cap(fig) {
  const c = SAMPLE_ITEMS.cap({ fig });
  wear(fig, 'crown', c.object);
}

export function policeDemo() {
  const ROOM = { x0: -700, x1: 700, z0: -300, z1: 950, h: 700 };
  const rows = [120, 420, 720];
  const desks = rows.flatMap((z) => [...desk(-460, -190, z, z + 140), ...desk(190, 460, z, z + 140)]);
  const room = solid([...shell(ROOM), ...desks]);
  const panels = ceilingPanels([-320, 320], [250, 650], ROOM.h);

  // băng tên trên mép bàn hai dãy đầu
  const tape = (name) => {
    const s = canvasTexture(320, 96, (ctx) => {
      ctx.fillStyle = '#f2efe6';
      ctx.fillRect(0, 0, 320, 96);
      ctx.fillStyle = '#1d1d22';
      ctx.font = `700 64px ${JP}`;
      ctx.textAlign = 'center';
      ctx.fillText(name, 160, 72);
    });
    s.update(0);
    return s;
  };
  const tapes = [['ハル', 240], ['ノダ', -240]].map(([n, x]) => placeOn(decal(tape(n), 50, 15), { at: [x, TOP, 138], normal: [0, -1, 0], up: [0, 0, 1] }));

  const noda = stickman({ ...GIRL, seed: 2 });
  put(noda, [0, 0, 520], 90);
  cap(noda);
  // tay trái chỉ sang làn bên phải khung, tay phải giơ chặn trước ngực
  noda.arms[1].shoulder.rotation.set(-0.15, 0, 1.45);
  noda.arms[1].elbow.rotation.set(-0.1, 0, 0);
  noda.arms[-1].shoulder.rotation.set(-1.4, 0, -0.15);
  noda.arms[-1].elbow.rotation.set(-1.25, 0, 0);
  const haru = stickman({ ...BOY, seated: true, seed: 1 });
  put(haru, [325, -87.5, 20], -90, true);
  for (const s of [-1, 1]) {
    haru.arms[s].shoulder.rotation.set(-0.95, 0, s * 0.12);
    haru.arms[s].elbow.rotation.set(-0.6, 0, 0);
  }
  const stool = solid([{ v: box(295, 355, -87.5, -80, -10, 50), tone: METAL }, { v: box(321, 329, -80, 0, 16, 24), tone: METAL }]);

  const docs = docTexture('仕事');
  const pile = [0, 1].map((k) => place(sheet(docs, 44, 62), { at: [330, TOP - 0.4 - k * 0.9, 205], yaw: 90 + k * 7, pitch: -90 }));
  // ba tờ việc trôi dọc lối từ cuối phòng; hai tờ đầu rẽ phải xuống bàn ハル, tờ thứ ba dừng giữa lối
  const route = (t0, k) => [
    { t: t0, at: [0, -430, 940] },
    { t: t0 + 1.1, at: [-40, -330, 640] },
    { t: t0 + 1.7, at: [90, -270, 470] },
    { t: t0 + 2.4, at: [230, -190, 300] },
    { t: t0 + 2.9, at: [328, TOP - 1.2 - (k + 2) * 0.9, 205], pitch: -90, yaw: 90 + k * 11, ease: 'out' },
  ];
  const stopped = (t0) => [
    { t: t0, at: [0, -430, 940] },
    { t: t0 + 1.1, at: [-30, -330, 680] },
    { t: t0 + 1.6, at: [40, -300, 420], ease: 'out' },
  ];
  const flights = [[route(0, 0), 0], [route(1.1, 1), 1.1], [stopped(2.2), 2.2]].map(([keys, t0], i) => ({ keys, t0, land: keys[keys.length - 1].t, obj: sheet(docs, 44, 62, { bend: 1.5 }), i }));

  return {
    objects: [room, panels, stool, ...tapes, ...pile, noda.root, haru.root, ...flights.map((f) => f.obj)],
    async ready() {
      await loadFonts([`700 64px ${JP}`], 'ハルノダ仕事');
    },
    animate(t) {
      setLights({
        ceiling: { y: -ROOM.h },
        bounds: { min: [ROOM.x0 - 20, -ROOM.h - 20, ROOM.z0], max: [ROOM.x1, 20, ROOM.z1 + 20] },
      });
      for (const f of flights) {
        appear(f.obj, t, { in: f.t0, dur: 0.3, mode: 'pop' });
        const p = along(f.keys, t, { face: true });
        const landing = f.i < 2;
        const fly = 1 - smooth(f.land - 0.35, f.land, t);
        if (landing) {
          if (t < f.land) p.pitch = -60 * fly - 90 * (1 - fly);
          p.roll += flutter(t, { amp: 22, freq: 1.2, phase: f.i * 2 }) * fly;
          p.pitch += wobble(t, f.land, { amp: 5, freq: 3, decay: 5 });
        } else {
          // dừng giữa lối: lơ lửng, phấp phới nhẹ
          p.pitch = -35 + flutter(t, { amp: 6, freq: 0.7, phase: 1 });
          p.roll += flutter(t, { amp: 12, freq: 0.9, phase: 3 });
          p.at = [p.at[0], p.at[1] + flutter(t, { amp: 6, freq: 0.5 }) * smooth(f.land - 0.3, f.land + 0.3, t), p.at[2]];
        }
        place(f.obj, p);
      }
      noda.head.rotation.y = 0.35 * Math.sin(Math.min(1, t / 2) * Math.PI);
      haru.head.rotation.x = 0.1;
    },
  };
}
