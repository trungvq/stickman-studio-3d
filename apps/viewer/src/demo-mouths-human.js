import * as THREE from 'three';
import { figureOf, HEAD_Y, headOnly, label, ROWS } from './demo-eyes.js';

// Bảng mồm người (`?demo=mouths-human`): đầu `human` không thân, mỗi hàng một dáng mồm (khai
// `face.mouthShape` cùng tên dáng mắt: nam, nữ, trẻ em, người già), mỗi cột một khẩu hình. `?set=talk` (mặc định) là khẩu hình nói, `?set=expr` là biểu
// cảm và bốn ký hiệu manga; `?turn=độ` xoay từng đầu tại chỗ.

const DX = 0.9;
const DY = 1.05;

/** Cột: nhãn, khẩu hình, mắt, mày */
export const SETS = {
  talk: [
    ['nghỉ', 'closed'],
    ['ん·m talkM', 'talkM'],
    ['あ talkA', 'talkA'],
    ['い talkI', 'talkI'],
    ['う talkU', 'talkU'],
    ['え talkE', 'talkE'],
    ['お talkO', 'talkO'],
    ['あ! talkB', 'talkB'],
    ['talkTeeth', 'talkTeeth'],
    ['talkSadA', 'talkSadA'],
    ['talkSadB', 'talkSadB'],
    ['talkAngryA', 'talkAngryA', 'open', 'angry'],
    ['talkAngryB', 'talkAngryB', 'open', 'angry'],
    ['parted', 'parted', 'open', 'lifted'],
  ],
  expr: [
    ['cười smile', 'smile', 'open', 'neutral'],
    ['lộ răng grin', 'grin', 'happy', 'neutral'],
    ['mím pursed', 'pursed', 'open', 'furrowed'],
    ['bĩu pout', 'pout', 'open', 'sad'],
    ['sốc wide', 'wide', 'wide', 'raised'],
    ['hét shout', 'shout', 'open', 'angry'],
    ['đau grit', 'grit', 'squint', 'furrowed'],
    ['nhếch smirk', 'smirk', 'squint', 'flat'],
    ['frown', 'frown', 'open', 'sad'],
    ['meh', 'meh', 'squint', 'flat'],
    ['wryOpen', 'wryOpen', 'happy', 'sad'],
    ['o', 'o', 'wide', 'lifted'],
    ['pain ✱', 'pain', 'squeezed', 'furrowed'],
    ['puffed ✱', 'puffed', 'open', 'neutral'],
    ['fang ✱', 'fang', 'sly', 'flat'],
    ['wry ✱', 'wry', 'open', 'sad'],
  ],
};

export function mouthsHumanDemo(q) {
  const turn = (Number(q.get('turn') ?? 0) * Math.PI) / 180;
  const cols = SETS[q.get('set') ?? 'talk'] ?? SETS.talk;
  const group = new THREE.Group();
  const x0 = -((cols.length - 1) / 2) * DX;
  ROWS.forEach((row, r) => {
    cols.forEach(([text, mouth, eyes = 'open', brow = 'neutral'], c) => {
      const f = figureOf(row, r * cols.length + c, { mouthShape: row.eyeShape });
      f.root.position.set(x0 + c * DX, -r * DY, 0);
      f.root.rotation.y = turn;
      f.face.set({ mouth, brow, eyes });
      headOnly(f);
      const l = label(text, 0.75);
      l.position.set(x0 + c * DX, HEAD_Y - r * DY + 0.47, 0.3);
      group.add(f.root, l);
    });
    const name = label(row.name, 1.4, 'right');
    name.position.set(x0 - 1.1, HEAD_Y - r * DY, 0);
    group.add(name);
  });
  return { objects: [group], animate() {} };
}
