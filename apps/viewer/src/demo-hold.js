import * as THREE from 'three';
import { parseAction, parseScene, resolveScene, sceneAt } from '@stickman/rig';
import { act, addItem, addLathe, Batch, box, collide, colliders, dress, freeze, npr, stickman } from '@stickman3d/rig';
import { ACTIONS, BOY, GIRL } from './demos.js';

// `?demo=hold`: người cầm đồ, đội đồ và người nền rẻ. Đồ ở đây là đồ mẫu chung của app xem thử (khay, cốc, giấy, mũ,
// kính râm, thẻ ngực); đồ của tập phim do repo video tự dựng và đưa vào `items`.

const tone = (top, lit = top) => ({ top, lit });

/** Dựng một món khối thành nhóm three, gốc ở `(0,0,0)` của món */
function solid(item) {
  const b = new Batch();
  addItem(b, { at: { at: [0, 0, 0] }, ...item });
  return b.build();
}

/** Khay hai tay: mặt khay ngang tầm mút tay, hai tay nắm hai mép trái phải */
function tray() {
  const b = new Batch();
  const T = tone('#c98c4a', '#a8713a');
  addItem(b, { at: { at: [0, 0, 0] }, parts: [
    { v: box(-27, 27, -1, 2, -17, 17), tone: T },
    { v: box(-27, 27, -4, -1, -17, -15.5), tone: T },
    { v: box(-27, 27, -4, -1, 15.5, 17), tone: T },
    { v: box(-27, -25.5, -4, -1, -17, 17), tone: T },
    { v: box(25.5, 27, -4, -1, -17, 17), tone: T },
  ] });
  const bowl = { rings: [[-1, 0], [-1, 4], [-6, 7.5], [-8, 8], [-8, 0]], tone: tone('#f2ede2', '#d9d2c3') };
  addLathe(b, bowl, { at: [-12, 0, 5] });
  addLathe(b, { ...bowl, rings: [[-1, 0], [-1, 5], [-5, 9], [-7, 9.5], [-7, 0]], tone: [tone('#2d3b52'), tone('#2d3b52'), tone('#2d3b52'), tone('#e8d36a')] }, { at: [10, 0, 4] });
  addLathe(b, { rings: [[-1, 0], [-1, 3.5], [-9, 4], [-9, 0]], tone: tone('#7fa86a', '#6a8f57') }, { at: [0, 0, -9] });
  return { object: b.build(), hold: { both: true } };
}

/** Cốc cầm một tay, đứng thẳng: thân cốc trước mút tay, quai quay về tay */
function mug() {
  const b = new Batch();
  const W = tone('#f4efe4', '#ddd5c6');
  addLathe(b, { rings: [[0, 0], [0, 8], [-20, 9], [-20, 0]], tone: [W, W, tone('#5b3a24')] }, { at: [0, 0, 0] });
  addItem(b, { at: { at: [0, 0, 0] }, parts: [
    { v: box(-1.5, 1.5, -16, -13, 7, 14), tone: W },
    { v: box(-1.5, 1.5, -6, -3, 7, 14), tone: W },
    { v: box(-1.5, 1.5, -16, -3, 12, 15), tone: W },
  ] });
  return { object: b.build(), hold: { follow: 'level', offset: [0, -0.1, 0.15] } };
}

/** Tờ giấy buông theo tay: kẹp ở mép trên, thả dọc cẳng tay */
function paper() {
  const g = solid({ parts: [{ v: box(-0.4, 0.4, 0, 40, -15, 15), tone: tone('#fbfaf5', '#eeeae0') }] });
  return { object: g, hold: { follow: 'wrist', offset: [0, 0.03, 0.02] } };
}

/** Mũ cảnh sát đặt ở `crown`: vành ôm vừa đầu (kể cả tóc) ngang trên mày, chóp phẳng rộng hơn vành, lưỡi trai đen */
function policeCap({ fig }) {
  const fit = fig.sockets.head;
  const target = fit.eye + 0.24;
  let lo = 0.1, hi = 1.5;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (fit.rest(m) > target) lo = m;
    else hi = m;
  }
  const rb = hi * 100 + 1.5, y0 = (fit.top - fit.rest(hi)) * 100;
  const b = new Batch();
  const NAVY = tone('#27324d', '#1f2840'), BLACK = tone('#1a1a1c', '#141416');
  // hệ món: y xuống, z sâu vào cảnh, nên mặt trước mũ (+z three) là −z món
  addLathe(b, { rings: [[y0, rb], [y0 - 4, rb], [y0 - 13, rb]], tone: [BLACK, NAVY] }, { at: [0, 0, 0] });
  addLathe(b, { rings: [[y0 - 13, rb], [-3, rb + 18], [-8, rb + 18], [-8, 0]], tone: [NAVY, NAVY, NAVY] }, { at: [0, 0, 0] });
  addItem(b, { at: { at: [0, 0, 0] }, parts: [
    { v: [[-rb * 0.75, y0, -rb * 0.6], [rb * 0.75, y0, -rb * 0.6], [rb * 0.8, y0 + 4, -rb - 12], [-rb * 0.8, y0 + 4, -rb - 12],
      [-rb * 0.75, y0 - 1.6, -rb * 0.6], [rb * 0.75, y0 - 1.6, -rb * 0.6], [rb * 0.8, y0 + 2.4, -rb - 12], [-rb * 0.8, y0 + 2.4, -rb - 12]], tone: BLACK },
    { v: box(-4, 4, y0 - 16, y0 - 8, -rb - 3.2, -rb - 1.4), tone: tone('#e2c15a', '#c9a646') },
  ] });
  const g = b.build();
  g.rotation.x = -0.06;
  return { object: g, hideHair: ['spikes'] };
}

/** Kính râm ở `faceAcc`: hai tròng tối ôm theo mặt trước sọ, gọng về tai */
function sunglasses({ fig }) {
  const f = fig.sockets.head, mat = npr({ color: '#141418', stipple: 0 });
  const g = new THREE.Group();
  const surf = (x) => Math.sqrt(Math.max(f.r * f.r - x * x, 0)) - f.r;
  const rod = (a, b, r = 0.012) => {
    const d = b.clone().sub(a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    g.add(m);
  };
  for (const s of [-1, 1]) {
    const x = s * 0.14, lens = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.016, 24), mat);
    lens.rotation.set(Math.PI / 2, 0, 0);
    lens.scale.set(1, 1, 0.72);
    const tilt = new THREE.Group();
    tilt.position.set(x, -0.005, surf(x) + 0.045);
    tilt.rotation.y = Math.asin(x / f.r);
    tilt.add(lens);
    g.add(tilt);
    const edge = new THREE.Vector3(s * 0.24, 0.03, surf(0.24) + 0.04);
    rod(edge, new THREE.Vector3(s * (f.r + 0.015), 0.02, 0.06 - f.front));
  }
  rod(new THREE.Vector3(-0.04, 0.035, 0.048), new THREE.Vector3(0.04, 0.035, 0.048));
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

/** Thẻ ngực trơn ở `chest`: chỗ dán texture chữ của repo video */
function badge() {
  return solid({ parts: [
    { v: box(-8, 8, -3.5, 3.5, -0.8, 0), tone: tone('#fbfaf5') },
    { v: box(-8, 8, -3.5, -2.2, -1.0, -0.6), tone: tone('#c8443a') },
  ] });
}

export const SAMPLE_ITEMS = { tray, mug, paper, cap: policeCap, sunglasses, badge };

/** Hành động mẫu tại chỗ: đích cổ tay hệ thân như `arms-on-table-3d` */
const reachAction = (name, reach) => {
  const r = parseAction({ schemaVersion: 13, name, duration: 1, end: 'hold', authoredAt: 'side', mask: Object.keys(reach), keys: [{ t: 0, pose: {}, reach, ease: 'linear' }], events: [] });
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  return r.data;
};
const HOLD_ACTIONS = {
  ...ACTIONS,
  'carry-tray': reachAction('carry-tray', { armFar: { at: [42, -58, 25], elbow: [-0.4, 1, 0.6] }, armNear: { at: [42, -58, 25], elbow: [-0.4, 1, 0.6] } }),
  'hold-mug': reachAction('hold-mug', { armNear: { at: [38, -62, 14], elbow: [-0.4, 1, 0.4] } }),
};

const LENS = { eye: [0, -200, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 };
const clip = (action, start = 0, extra = {}) => ({ action, start, ...extra });
const track = (...clips) => ({ clips });

/** Bàn dài và ghế đẩu của hàng người nền: mặt bàn cao hơn mặt ghế ~51 như `arms-on-table-3d` giả định */
const TABLE = { z0: 160, z1: 290 };
const SEATS = [-280, -140, 0, 140, 280];
/** Người nền thứ tư ngồi lấn vào mép bàn: cho bảng va chạm có cái để báo */
const CRAMPED = 3;
const seatZ = (i) => (i === CRAMPED ? 288 : 350);

function furniture() {
  const wood = tone('#c9a679', '#a98559'), metal = tone('#77736e', '#5f5b57');
  const { z0, z1 } = TABLE;
  const table = { at: { at: [0, 0, 0] }, parts: [
    { v: box(-350, 350, -143, -137, z0, z1), tone: wood },
    ...[[-340, z0 + 6], [340, z0 + 6], [-340, z1 - 6], [340, z1 - 6]].map(([x, z]) => ({ v: box(x - 3, x + 3, -137, 0, z - 3, z + 3), tone: metal })),
  ] };
  const stools = SEATS.map((x, i) => ({ at: { at: [x, 0, seatZ(i) + 10] }, parts: [
    { v: box(-28, 28, -87.5, -80, -24, 24), tone: wood },
    { v: box(-3, 3, -80, 0, -3, 3), tone: metal },
  ] }));
  const b = new Batch();
  for (const it of [table, ...stools]) addItem(b, it);
  return { group: b.build(), table, stools };
}

/** Số mesh (lượt vẽ mỗi lượt render) và tam giác của một người */
function cost(fig) {
  let meshes = 0, tris = 0;
  fig.root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    meshes++;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { meshes, tris: Math.round(tris) };
}

function reportBox() {
  const el = document.createElement('pre');
  el.style.cssText = 'position:absolute;left:12px;top:12px;margin:0;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.82);font:12px/1.35 ui-monospace,monospace;color:#222;pointer-events:none;white-space:pre';
  document.body.appendChild(el);
  return el;
}

const PART = { head: 'đầu', torso: 'thân', upperArm: 'cánh tay', foreArm: 'cẳng tay', thigh: 'đùi', shin: 'ống chân' };
const sideName = (s) => (s === -1 ? ' phải' : s === 1 ? ' trái' : '');

export function holdDemo() {
  const extra = (i) => ({
    id: `nen${i}`, opts: { ...(i % 2 ? GIRL : BOY), color: ['#8a8f99', '#a39283', '#7f9488'][i % 3], lod: 'low', seated: true, seed: i + 3 },
    world: { at: [SEATS[i], -87.5, seatZ(i)], yaw: 90, sit: true, floor: 0 },
    tracks: [track(clip('sit-3d')), track(clip('arms-on-table-3d')), track(clip('face-calm'))],
  });
  const members = [
    { id: 'khay', opts: { ...BOY, items: SAMPLE_ITEMS },
      world: { path: [{ t: 0, at: [-250, 0, -150], yaw: 0 }, { t: 4.5, at: [200, 0, -150], yaw: 0 }] },
      tracks: [track(clip('walk'), clip('stand-3d', 4.3, { blend: 0.3 })), track(clip('carry-tray')), track(clip('face-calm'))], equip: { handNear: 'tray', chest: 'badge' } },
    { id: 'coc', opts: { ...GIRL, items: SAMPLE_ITEMS }, world: { at: [-430, 0, 20], yaw: 90 },
      tracks: [track(clip('stand-3d')), track(clip('hold-mug')), track(clip('face-calm'))], equip: { crown: 'cap', handNear: 'mug' } },
    { id: 'giay', opts: { ...BOY, hairColor: '#5a3a26', items: SAMPLE_ITEMS }, world: { at: [430, 0, 20], yaw: 110 },
      tracks: [track(clip('stand-3d')), track(clip('face-smug'))], equip: { crown: 'cap', faceAcc: 'sunglasses', handFar: 'paper' } },
    ...SEATS.map((_, i) => extra(i)),
  ];
  const scene = parseScene({ name: 'demo-hold', lens: LENS, cast: members.map((m) => ({ id: m.id, character: `${m.id}.json`, world: m.world, tracks: m.tracks })) });
  if (!scene.success) throw new Error(scene.error.message);
  const bodies = Object.fromEntries(members.map((m) => [m.id, { legHalf: 4.5, hipHalf: m.opts.rig.hipHalf }]));
  // cô cầm cốc thấp hơn: đồ cầm, đồ đội to nhỏ theo `root.scale`
  const heights = Object.fromEntries(members.map((m) => [m.id, m.id === 'coc' ? 0.88 : 1]));
  const rt = resolveScene(scene.data, HOLD_ACTIONS, {}, {}, heights, bodies);
  const people = members.map((m) => ({ id: m.id, equip: m.equip, fig: stickman(m.opts) }));
  const room = furniture();
  const cols = [...colliders(room.table, 'bàn'), ...room.stools.flatMap((s, i) => colliders(s, `ghế ${i}`))];
  const figs = Object.fromEntries(people.map((p) => [p.id, p.fig]));
  // người nền không diễn: đặt dáng một lần rồi đóng băng cả hàng
  const extras = people.filter((p) => p.id.startsWith('nen'));
  for (const p of extras) act(p.fig, sceneAt(rt, p.id, 0, heights[p.id], bodies[p.id]), 0);
  const crowd = freeze(extras.map((p) => p.fig));
  const actors = people.filter((p) => !extras.includes(p));

  const full = cost(stickman({ ...BOY })), low = cost(stickman({ ...BOY, lod: 'low' })), row = cost({ root: crowd });
  const lod = `Một người đầy đủ: ${full.meshes} mesh, ${full.tris} tam giác\nMột người lod low: ${low.meshes} mesh, ${low.tris} tam giác\n${extras.length} người nền đóng băng: ${row.meshes} mesh, ${row.tris} tam giác`;
  const el = new URLSearchParams(location.search).has('noreport') ? null : reportBox();

  return {
    objects: [...actors.map((p) => p.fig.root), crowd, room.group],
    animate(t) {
      for (const p of actors) {
        const sp = sceneAt(rt, p.id, t, heights[p.id], bodies[p.id]);
        act(p.fig, sp, t);
        if (p.equip) dress(p.fig, p.equip, !!sp.world?.flip);
      }
      if (!el) return;
      // ngồi thì đùi nằm trên mặt ghế đúng nửa nét (hông 2D là tâm nét): chỗ chạm ấy không phải lỗi
      const hits = collide(figs, cols, { people: true }).filter((c) => !(c.part === 'thigh' && c.collider.startsWith('ghế') && c.depth < 0.05));
      const lines = hits.slice(0, 8).map((c) => `${c.who} · ${PART[c.part]}${sideName(c.side)} xuyên ${c.collider} ${(c.depth * 100).toFixed(1)} px`);
      el.textContent = `Va chạm ở t=${t.toFixed(2)}: ${hits.length ? '' : 'không có'}\n${lines.join('\n')}${hits.length > 8 ? `\n… ${hits.length - 8} chỗ nữa` : ''}\n\n${lod}`;
    },
  };
}
