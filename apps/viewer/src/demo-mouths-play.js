import { ACTION_VERSION, actionFace, blinkAt, composeFace, parseAction } from '@stickman3d/rig';
import * as THREE from 'three';
import { figureOf, HEAD_Y, headOnly, ROWS } from './demo-eyes.js';
import { textPlane } from './demo-eyes-play.js';
import { SETS } from './demo-mouths-human.js';

// Mồm người diễn theo `t` (`?demo=mouths-play`): bốn dáng mồm nhìn thẳng và quay 3/4 nói 「こんにちは、みなさん。げんきですか？」
// theo nguyên âm (あ talkA, い talkI, う talkU, え talkE, お talkO, ん và âm môi talkM, tiếng nhấn talkB), rồi lần lượt
// qua các biểu cảm. Khẩu hình đi qua một hành động thật (`actionFace`), nên chỗ đổi khẩu hình có các nấc chuyển
// `MOUTH_MIX`. Khung ống kính: `az=0&el=0&look=-0.25,3.2,0&dist=5.6`.

const DX = 1;
const DY = 1.05;
const TURN = 35;
const MORA = 0.13;
/** Âm của mora → khẩu hình; `N` cuối câu là ngậm nghỉ */
const VOWEL = { a: 'talkA', A: 'talkB', i: 'talkI', u: 'talkU', e: 'talkE', o: 'talkO', N: 'talkM' };
/** Câu: `[giây bắt đầu, các mora [chữ, âm, âm môi?]]` */
const LINES = [
  [1.0, [['こ', 'o'], ['ん', 'N'], ['に', 'i'], ['ち', 'i'], ['は', 'A']]],
  [2.05, [['み', 'i', true], ['な', 'a'], ['さ', 'A'], ['ん', 'R']]],
  [2.95, [['げ', 'e'], ['ん', 'N'], ['き', 'i'], ['で', 'e'], ['す', 'u'], ['か', 'A']]],
];
const SENTENCE = 'こんにちは、みなさん。げんきですか？';
const EXPR_AT = 4.4;
const EXPR = 0.9;
export const LENGTH = EXPR_AT + SETS.expr.length * EXPR + 0.8;

/** Mốc hành động (giây) và nhãn từng đoạn */
function script() {
  const keys = [{ s: 0, face: { mouth: 'closed', eyes: 'open', brow: 'neutral' } }];
  const marks = [];
  for (const [t0, mora] of LINES) {
    mora.forEach(([ch, v, lips], i) => {
      const s = t0 + i * MORA;
      const mouth = v === 'R' ? 'closed' : VOWEL[v];
      if (lips) keys.push({ s, face: { mouth: 'talkM' } }, { s: s + 0.07, face: { mouth } });
      else keys.push({ s, face: { mouth } });
      marks.push([s, `${ch} · ${lips ? 'talkM → ' : ''}${mouth}`]);
    });
    const end = t0 + mora.length * MORA + 0.05;
    keys.push({ s: end, face: { mouth: 'closed' } });
    marks.push([end, '· closed']);
  }
  SETS.expr.forEach(([text, mouth, eyes = 'open', brow = 'neutral'], i) => {
    const s = EXPR_AT + i * EXPR;
    keys.push({ s, face: { mouth, eyes, brow } });
    marks.push([s, `${text}${text.includes(mouth) ? '' : ` (${mouth})`}`]);
  });
  const end = EXPR_AT + SETS.expr.length * EXPR;
  keys.push({ s: end, face: { mouth: 'closed', eyes: 'open', brow: 'neutral' } });
  marks.push([end, 'nghỉ']);
  const r = parseAction({
    schemaVersion: ACTION_VERSION,
    name: 'mouths-play',
    duration: LENGTH,
    end: 'hold',
    mask: ['face'],
    keys: keys.map((k) => ({ t: k.s / LENGTH, pose: {}, face: k.face, ease: 'linear' })),
  });
  if (!r.success) throw new Error(r.error.message);
  return { action: r.data, marks };
}

export function mouthsPlayDemo() {
  const { action, marks } = script();
  const group = new THREE.Group();
  const x0 = -((ROWS.length - 1) / 2) * DX;
  const heads = [];
  for (const [r, turn] of [[0, 0], [1, TURN]])
    ROWS.forEach((row, c) => {
      const f = figureOf(row, c, { mouthShape: row.eyeShape });
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
    const at = marks.filter(([s]) => s <= t).at(-1);
    title.set(t < EXPR_AT ? `${SENTENCE}   ${at ? at[1] : ''}` : (at?.[1] ?? ''));
    clock.set(`${t.toFixed(2).replace('.', ',')} s`);
    const face = composeFace(actionFace(action, t / LENGTH, LENGTH));
    for (const { f, c } of heads) f.face.set(face, blinkAt(t, c));
  };
  animate(0);
  return { objects: [group], animate };
}
