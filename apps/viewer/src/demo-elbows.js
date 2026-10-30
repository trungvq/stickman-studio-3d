import * as THREE from 'three';
import { act, armInput, body3, bodyMarkAt, ELBOW_POSES, fromCharacter, parseCharacter, parseScene, resolveScene, sceneAt, SCULPT_PRESETS, trunk3 } from '@stickman3d/rig';

// Bảng khuỷu (`?demo=elbows&g=1&view=truoc|cheo|ngang`): các tư thế mẫu của khuỷu ưu tiên (`ELBOW_POSES`) trên người nhỏ
// nhất (chibi đầu to) và lớn nhất (cao, vai rộng, bụng phệ) — mỗi nhóm `GROUP` tư thế, mỗi tư thế một cặp người, hai tay
// cùng dáng. Cổ tay đặt bằng mốc `shoulder` cộng `offset` đúng cổ tay của mẫu (phần tầm với), không khai `elbow`: khuỷu là
// của bộ giải. `view` quay người (máy đứng yên) để nhìn trước, chéo 45°, ngang mà không người nào che người nào.

const GROUP = 3;
/** Mỗi người cách nhau, đơn vị rig */
const GAP = 230;
const VIEWS = { truoc: 0, cheo: 45, ngang: 90 };

function person(name, rig, palette, garment, hair) {
  const r = parseCharacter({
    name,
    rig,
    head: { form: 'human' },
    palette: { skin: '#f8e3c8', line: '#1c1c1e', clad: true, ...palette },
    pieces: { torso: { src: 'sculpt', garment }, hair: { src: 'sculpt', color: '#2a1c15', sculpt: SCULPT_PRESETS[hair].sculpt } },
  });
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  return r.data;
}

/** Cùng số đo với người nhỏ nhất và lớn nhất của test khuỷu (`core/__fixtures__/elbowRig.ts`) */
const PEOPLE = () => [
  ['nhỏ', person('nho', { height: 0.8, shoulderHalf: 34, hipHalf: 18 }, { garment: '#e0b23a', sleeve: '#e0b23a', trouser: '#34466e', sleeveWidth: 13, trouserWidth: 14 }, { style: 'sweater', hem: -10 }, 'bob')],
  ['lớn', person('lon', { height: 1.1, shoulderHalf: 44, hipHalf: 26 }, { garment: '#e0623f', sleeve: '#e0623f', sleeveLength: 0.32, trouser: '#e8dccb', sleeveWidth: 17, trouserWidth: 20, bicep: 0.3 }, { style: 'polo', neck: 14, belly: 24, hem: 6 }, 'neat')],
];

const Z3 = [0, 0, 0];
/** Tầm với (rig) và độ cao của mốc `shoulder` trên khớp vai (rig, `y` xuống) của tay `side` người `c` đứng thẳng */
function armOf(c, side) {
  const sp = { pose: { af: Z3, an: Z3, lf: Z3, ln: Z3, torso: 0, head: Z3, stretch: [1, 1, 1, 1, 1, 1, 1, 1] }, world: { hip: Z3, yaw: Math.PI / 2, s: 1, flip: false } };
  const inp = armInput(trunk3(c, sp), side);
  const mark = bodyMarkAt(c, sp, { to: 'shoulder' }, side === -1 ? 'R' : 'L');
  return { L: (inp.l1 + inp.l2) * 100, cap: -inp.S[1] * 100 - mark[1] };
}

/** Cảnh `?demo=elbows&g=<nhóm từ 1>&view=<truoc|cheo|ngang>` */
export function elbowsDemo(q) {
  const g = Math.max(1, Number(q.get('g') ?? 1));
  const poses = ELBOW_POSES.slice((g - 1) * GROUP, g * GROUP);
  if (!poses.length) return null;
  const turn = VIEWS[q.get('view') ?? 'truoc'] ?? 0;
  const people = PEOPLE();
  const cast = [];
  poses.forEach((p, i) =>
    people.forEach(([label, c], j) => {
      const k = i * people.length + j;
      const x = (k - (poses.length * people.length - 1) / 2) * GAP;
      const hand = (side) => {
        const { L, cap } = armOf(c, side);
        const [f, d, o] = p.wrist;
        return { to: 'shoulder', offset: [f * L, d * L + cap, o * L], point: 'wrist' };
      };
      cast.push({ id: `p${p.id}-${j}`, c, label: `#${p.id} ${label}`, world: { at: [x, 0, 0], yaw: 90 + turn, hands: [{ t: 0, right: hand(-1), left: hand(1) }] } });
    }),
  );
  const scene = parseScene({ name: `demo-elbows-${g}`, lens: { eye: [0, -200, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 }, cast: cast.map((m) => ({ id: m.id, character: `${m.id}.json`, world: m.world })) });
  if (!scene.success) throw new Error(scene.error.message);
  const bodies = Object.fromEntries(cast.map((m) => [m.id, body3(m.c)]));
  const heights = Object.fromEntries(cast.map((m) => [m.id, m.c.rig.height]));
  const rt = resolveScene(scene.data, {}, {}, {}, heights, bodies);
  rt.chars = Object.fromEntries(cast.map((m) => [m.id, m.c]));
  const group = new THREE.Group();
  const figs = cast.map((m, i) => ({ ...m, fig: fromCharacter(m.c, { seed: i }) }));
  for (const f of figs) group.add(f.fig.root);
  return {
    objects: [group],
    animate(t) {
      for (const f of figs) act(f.fig, sceneAt(rt, f.id, t, heights[f.id], bodies[f.id]), t);
    },
    marks: figs.map((f) => ({ fig: f.fig, at: 'headTop', text: f.label })),
  };
}
