import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AA, createStage, npr, PALETTES, setPalette, skyDome, stickman } from '@stickman3d/rig';
import { GRADES, lightDemo } from './demo-light.js';
import { BOY, demo, GIRL } from './demos.js';
import { holdDemo } from './demo-hold.js';
import { roomDemo } from './demo-room.js';
import { stagesDemo } from './demo-stages.js';
import { decalDemo, policeDemo } from './demo-decal.js';
import { humanDemo } from './demo-human.js';
import { handAimDemo } from './demo-hand-aim.js';
import { carryDemo } from './demo-carry.js';
import { elbowsDemo } from './demo-elbows.js';
import { createMarks } from './marks.js';

const AA_LABEL = { off: 'Tắt', 'ss1.5': '1,5×', ss2: '2×' };
const q = new URLSearchParams(location.search);

const host = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, 1, 0.5, 160);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.1, 0);
controls.enableDamping = true;
controls.minDistance = 3;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * 0.55;
const view = new THREE.Spherical(14, Math.PI / 2 - (8 * Math.PI) / 180, (20 * Math.PI) / 180);

const sky = skyDome();
scene.add(sky);
const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 64).rotateX(-Math.PI / 2), npr({ color: '#d9d2c3', stipple: 0.06, stippleScale: 1.4, soft: 1 }));
scene.add(ground);

const shot = setupDemo(q.get('demo'));
// phông, ảnh của decal nạp xong trước khung đầu
await shot?.ready?.();
const animate = shot?.animate ?? setupCast();
const stage = createStage({
  renderer, scene, camera, size: { w: host.clientWidth, h: host.clientHeight },
  update: (t, st) => animate(t, st),
});
const marks = shot?.marks && createMarks(host, shot.marks, [scene]);

/** Hai người que đứng nói chuyện: một áo sơ mi, một áo blouse váy xếp ly. Trả hàm hoạt cảnh theo `t`. */
function setupCast() {
  const boy = stickman({ ...BOY, face: { brow: 'worried' } });
  const girl = stickman(GIRL);
  boy.root.position.set(-1.1, 0, 0);
  boy.root.rotation.y = 0.55;
  girl.root.position.set(1.1, 0, 0);
  girl.root.rotation.y = -0.55;
  scene.add(boy.root, girl.root);

  return (t) => {
    const talkA = pulse(t, 7, 0.2, 3.2), talkG = pulse(t, 7, 3.6, 3.0);
    for (const [p, talk, ph] of [[boy, talkA, 0], [girl, talkG, 1.3]]) {
      // thở, nói thì tay phải khoát, đầu nghiêng theo nhịp
      p.spine.rotation.x = Math.sin(t * 1.6 + ph) * 0.012;
      p.spine.rotation.z = Math.sin(t * 0.8 + ph) * 0.02;
      p.head.rotation.x = -0.06 + Math.sin(t * 1.6 + ph) * 0.02 + Math.sin(t * 2.4) * 0.04 * talk;
      p.head.rotation.z = talk * Math.sin(t * 2) * 0.08;
      const r = p.arms[1], l = p.arms[-1];
      r.shoulder.rotation.set(-0.35 * talk - 0.05, 0, 0.2 + talk * 0.25);
      r.elbow.rotation.set(-0.25 - talk * (1.3 + Math.sin(t * 5.5) * 0.25), 0, 0);
      l.shoulder.rotation.set(-0.05, 0, -0.2);
      l.elbow.rotation.set(-0.2, 0, 0);
      for (const s of [-1, 1]) p.legs[s].hip.rotation.set(0, 0, s * 0.03);
    }
    boy.head.rotation.y = 0.15 - talkG * 0.1;
    girl.head.rotation.y = -0.15 + talkA * 0.1;
    // chớp mắt, nhép miệng khi nói
    for (const [who, off, talk] of [[boy, 1.7, talkA], [girl, 0, talkG]]) {
      const shut = pulse(t + off, 4.3, 0, 0.16) > 0;
      const mouth = talk > 0.05 ? MOUTHS[Math.floor(t / 0.13) % MOUTHS.length] : 'closed';
      who.face.set({ ...who.face.state, eyes: shut ? 'shut' : 'open', mouth });
    }
  };
}

const MOUTHS = ['talkA', 'talkTeeth', 'talkB', 'talkTeeth', 'talkA', 'o'];

/** Cảnh diễn hành động `?demo=`; không có cảnh ấy thì trả `undefined` */
function setupDemo(name) {
  const own = { hold: holdDemo, light: lightDemo, room: roomDemo, stages: () => stagesDemo(host), decal: decalDemo, police: policeDemo, 'hand-aim': handAimDemo, carry: carryDemo, elbows: elbowsDemo };
  for (const k of ['human', 'human-row', 'human-faces', 'human-bench', 'human-wrap', 'human-wrap-act', 'human-coat', 'human-coat-act', 'human-extra', 'human-extra-act', 'human-extra-move', 'human-extra-equip']) own[k] = () => humanDemo(k);
  const d = own[name] ? own[name](q) : name && demo(name);
  if (['light', 'room', 'decal', 'police'].includes(name)) ground.visible = false;
  if (!d) return undefined;
  if (d.objects.length) scene.add(...d.objects);
  return d;
}

const state = { outline: true, shade: 'paint', pixel: false, time: 'day', paused: false, aa: devicePixelRatio >= 2 ? 'off' : 'ss2' };

function palette(name) {
  state.time = name;
  setPalette(name, { scene, sky });
}

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  stage.setSize(w, h, { aa: state.aa, pixel: state.pixel });
}
new ResizeObserver(resize).observe(host);

const pulse = (t, period, at, len) => {
  const u = ((t % period) + period) % period - at;
  return u < 0 || u > len ? 0 : Math.sin((u / len) * Math.PI);
};

let t = 0, last = performance.now();

// đo thời gian GPU mỗi khung bằng timer query, trung bình trượt
const gpu = (() => {
  const gl = renderer.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const pending = [];
  let avg = 0, q = null;
  const out = document.getElementById('gpu');
  return {
    begin() {
      if (!ext || q) return;
      q = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    },
    end() {
      if (!q) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(q);
      q = null;
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const p = pending.shift();
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) avg = avg ? avg * 0.95 + (gl.getQueryParameter(p, gl.QUERY_RESULT) / 1e6) * 0.05 : gl.getQueryParameter(p, gl.QUERY_RESULT) / 1e6;
        gl.deleteQuery(p);
      }
      if (out) out.textContent = ext ? `GPU ${avg.toFixed(2)} ms` : 'GPU ?';
    },
  };
})();
// số khung đã vẽ: tools/shots.mjs chờ nó trước khi chụp
window.__frames = 0;

function frame() {
  gpu.begin();
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!state.paused) t += dt;
  controls.update();
  drawAt(t);
  gpu.end();
  window.__frames++;
  requestAnimationFrame(frame);
}

/** Một khung ở giây `t`: cảnh có ống kính riêng thì camera theo `view(t)`, không thì theo góc máy xoay tay */
function drawAt(t) {
  stage.draw(t, { ...shot?.view?.(t), render: { outline: state.outline, shade: state.shade, t, grade: GRADES[q.get('grade')] } });
  marks?.(stage);
}
// tools/bench.mjs vẽ từng khung đồng bộ qua đây
window.__drawAt = drawAt;
window.__stage = stage;

function bindHud() {
  const btn = (id, on) => document.getElementById(id).classList.toggle('on', on);
  const sync = () => {
    btn('b-ink', state.outline);
    btn('b-cel', state.shade === 'cel');
    btn('b-manga', state.shade === 'manga');
    btn('b-pixel', state.pixel);
    btn('b-day', state.time === 'day');
    btn('b-eve', state.time === 'evening');
    btn('b-pause', state.paused);
    document.getElementById('b-aa').textContent = `AA: ${AA_LABEL[state.aa]} · A`;
    btn('b-aa', state.aa !== 'off');
  };
  const act = {
    ink: () => (state.outline = !state.outline),
    cel: () => (state.shade = state.shade === 'cel' ? 'paint' : 'cel'),
    manga: () => (state.shade = state.shade === 'manga' ? 'paint' : 'manga'),
    pixel: () => ((state.pixel = !state.pixel), resize()),
    day: () => palette('day'),
    eve: () => palette('evening'),
    pause: () => (state.paused = !state.paused),
    aa: () => {
      const ks = Object.keys(AA);
      state.aa = ks[(ks.indexOf(state.aa) + 1) % ks.length];
      resize();
    },
  };
  for (const k of Object.keys(act))
    document.getElementById(`b-${k}`).addEventListener('click', () => {
      act[k]();
      sync();
    });
  addEventListener('keydown', (e) => {
    const k = { KeyO: 'ink', KeyC: 'cel', KeyM: 'manga', KeyP: 'pixel', Space: 'pause', KeyA: 'aa' }[e.code];
    if (k) act[k]();
    if (e.code === 'KeyT') palette(state.time === 'day' ? 'evening' : 'day');
    if (e.code === 'KeyH') document.getElementById('hud').classList.toggle('hide');
    sync();
  });
  sync();
}

palette(q.get('time') in PALETTES ? q.get('time') : 'day');
if (q.get('aa') in AA) state.aa = q.get('aa');
if (q.has('pixel')) state.pixel = true;
if (q.has('noink')) state.outline = false;
if (['cel', 'manga'].includes(q.get('shade'))) state.shade = q.get('shade');
if (q.has('nohud')) document.getElementById('hud').classList.add('hide');
if (shot?.view) controls.enabled = false;
if (q.has('look')) controls.target.set(...q.get('look').split(',').map(Number));
// `focus=<người>:<khớp>`: máy nhìn vào khớp ấy ở giây `t` (cảnh có `focus`, như `hand-aim`)
if (q.has('focus') && shot?.focus) controls.target.copy(shot.focus(...q.get('focus').split(':'), Number(q.get('t') ?? 0)));
if (q.has('az')) view.theta = (Number(q.get('az')) * Math.PI) / 180;
if (q.has('el')) view.phi = Math.PI / 2 - (Number(q.get('el')) * Math.PI) / 180;
if (q.has('dist')) {
  view.radius = Number(q.get('dist'));
  // khung cận bàn tay: cho máy lại gần hơn giới hạn kéo tay
  controls.minDistance = Math.min(controls.minDistance, view.radius);
}
camera.position.setFromSpherical(view).add(controls.target);
if (q.has('t')) {
  t = Number(q.get('t'));
  state.paused = true;
}
bindHud();
resize();
frame();
