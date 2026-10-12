import * as THREE from 'three';
import { newCanvas, path2D } from './canvas';
import { DEFAULT_FACE } from './core/constants';
import { blushLevel, blushMarks, browMarks, CHIBI, chibiShape, eyeMarks, eyeShine, mouthMark, wrinkleMarks, type FaceInk, type FaceMark, type WrinkleSpec } from './core/face';
import { humanSkull } from './core/humanHead';
import type { FaceState } from './core/types';

// Nét mặt của `core/face.ts` vẽ lên canvas rồi dán lên mặt trước của sọ theo phép chiếu thẳng — điểm lệch `x` px khỏi
// giữa mặt nằm ở kinh độ `asin(x / nửa rộng đầu)`, như nét mặt của đầu tóc dựng khối bên sketch.

/** `face.wrinkle` của JSON nhân vật */
export type Wrinkle = WrinkleSpec;
/** `face` của JSON nhân vật, px của đầu cao 130; `blush` là má ửng nền `0..1` */
export interface FaceShape { offsetY: number; eyeGap: number; mouthGap: number; wrinkle?: Wrinkle; blush?: number }

const SHAPE: FaceShape = { offsetY: 0, eyeGap: 26, mouthGap: 34 };

const HEAD_R = 65;
/** Vùng mặt trên canvas, px đầu quanh tâm đầu: đủ cho nếp trán `deep` tới khẩu hình `wryOpen` */
const BOX = { x0: -48, y0: -54, w: 96, h: 112 };
const TEXEL = 8;

type Ctx = CanvasRenderingContext2D;

function shape(m: FaceMark): Path2D {
  if ('path' in m) return path2D(m.path);
  const p = path2D();
  if ('line' in m) { p.moveTo(m.line[0], m.line[1]); p.lineTo(m.line[2], m.line[3]); }
  else if ('ellipse' in m) p.ellipse(m.ellipse[0], m.ellipse[1], m.ellipse[2], m.ellipse[3], 0, 0, Math.PI * 2);
  else if ('rect' in m) p.rect(...m.rect);
  return p;
}

/** Vẽ `marks` phóng `k` lần quanh `(cx, cy)`, bề dày nét phóng theo */
function paintAt(g: Ctx, marks: FaceMark[], k: number, cx: number, cy: number) {
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  g.translate(-cx, -cy);
  paint(g, marks);
  g.restore();
}

/** Vẽ các nét như SVG: tô rồi viền, mặc định tô đen, đầu nét `butt`, góc `miter`; `{ clip }` cắt các nét `clipped` theo sau */
function paint(g: Ctx, marks: FaceMark[], up: FaceInk = {}) {
  let clip: Path2D | undefined;
  for (const m of marks) {
    if ('clip' in m) { clip = path2D(m.clip); continue; }
    const ink: FaceInk = {
      fill: m.fill ?? up.fill, stroke: m.stroke ?? up.stroke, strokeWidth: m.strokeWidth ?? up.strokeWidth,
      strokeLinecap: m.strokeLinecap ?? up.strokeLinecap, strokeLinejoin: m.strokeLinejoin ?? up.strokeLinejoin,
    };
    g.save();
    if (m.clipped && clip) g.clip(clip);
    if ('group' in m) paint(g, m.group, ink);
    else {
      const p = shape(m), fill = ink.fill ?? '#000';
      if (fill !== 'none' && !('line' in m)) { g.fillStyle = fill; g.fill(p); }
      if (ink.stroke && ink.stroke !== 'none') {
        g.strokeStyle = ink.stroke;
        g.lineWidth = ink.strokeWidth ?? 1;
        g.lineCap = ink.strokeLinecap ?? 'butt';
        g.lineJoin = ink.strokeLinejoin ?? 'miter';
        g.stroke(p);
      }
    }
    g.restore();
  }
}

/** Nét mặt dán trên sọ: `mesh` treo vào nhóm đầu, `set` vẽ lại canvas khi kiểu nét hay mức ửng (`blushLevel`) đổi. */
export interface FaceRig {
  mesh: THREE.Mesh;
  state: FaceState;
  set(state: FaceState): void;
}

/**
 * Lớp nét mặt cho sọ bán kính `r` (three), cùng tỉ lệ `scale` với khối sọ. Mặt hướng +z, `y` lên; px đầu đổi ra
 * three theo `r / 65`. Lưới dời lên khỏi mặt sọ một chút để khỏi lẫn độ sâu. `human`: dán trên đầu `humanSkull`, nét
 * mặt chibi (`CHIBI`): mắt to có đốm sáng. Má ửng `shape.blush` cộng `state.blush`, màu suy từ da `skin`.
 */
export function faceRig(r: number, scale: THREE.Vector3, shape: Partial<FaceShape> = {}, state: FaceState = DEFAULT_FACE, human = false, skin = '#f0d9b8'): FaceRig {
  const sh = human ? chibiShape({ ...SHAPE, ...shape }) : { ...SHAPE, ...shape };
  const canvas = newCanvas(BOX.w * TEXEL, BOX.h * TEXEL);
  const g = canvas.getContext('2d') as Ctx;
  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(faceCap(r * 1.004, scale, human), mat);
  mesh.userData.noShadow = true;
  mesh.userData.noCollide = true;
  mesh.renderOrder = 1;
  const level = (s: FaceState) => blushLevel(sh.blush, s.blush);
  const draw = (s: FaceState) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(TEXEL, 0, 0, TEXEL, -BOX.x0 * TEXEL, -BOX.y0 * TEXEL);
    const mouthCy = sh.offsetY + sh.mouthGap;
    const wrinkle = sh.wrinkle && wrinkleMarks(sh.wrinkle, 0, sh.offsetY, sh.eyeGap, mouthCy);
    if (wrinkle) paint(g, [wrinkle]);
    paint(g, [blushMarks(0, sh.offsetY, sh.eyeGap, skin, level(s))]);
    if (human) {
      paintAt(g, [mouthMark(s.mouth, 0, mouthCy)], CHIBI.mouth, 0, mouthCy);
      for (const side of [-1, 1] as const) {
        const o = { only: side, squash: CHIBI.squash };
        paintAt(g, [eyeMarks(s.eyes, 0, sh.offsetY, sh.eyeGap, o), eyeShine(s.eyes, 0, sh.offsetY, sh.eyeGap, o)], CHIBI.eye, (side * sh.eyeGap) / 2, sh.offsetY);
      }
      paint(g, [browMarks(s.brow, 0, sh.offsetY - CHIBI.brow, sh.eyeGap)]);
    } else paint(g, [mouthMark(s.mouth, 0, mouthCy), eyeMarks(s.eyes, 0, sh.offsetY, sh.eyeGap), browMarks(s.brow, 0, sh.offsetY, sh.eyeGap)]);
    tex.needsUpdate = true;
  };
  const rig: FaceRig = {
    mesh,
    state,
    set(s) {
      if (s.mouth === rig.state.mouth && s.brow === rig.state.brow && s.eyes === rig.state.eyes && level(s) === level(rig.state)) return;
      rig.state = { ...s };
      draw(rig.state);
    },
  };
  draw(state);
  return rig;
}

/**
 * Lưới phủ vùng `BOX` trên mặt trước sọ: UV là toạ độ px đầu, điểm nằm trên mặt cầu theo phép chiếu thẳng; `human`
 * thì điểm mặt cầu ấy đi tiếp qua `humanSkull`, nét mặt nằm trên má và cằm như da.
 */
function faceCap(r: number, scale: THREE.Vector3, human: boolean) {
  const N = 40, k = r / HEAD_R;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const px = BOX.x0 + (BOX.w * i) / N, py = BOX.y0 + (BOX.h * j) / N;
      let x = px * k, y = -py * k;
      const d = Math.hypot(x, y), lim = r * 0.995;
      if (d > lim) [x, y] = [(x * lim) / d, (y * lim) / d];
      let z = Math.sqrt(Math.max(r * r - x * x - y * y, 0));
      if (human) [x, y, z] = humanSkull([x / r, y / r, z / r]).map((v) => v * r);
      pos.push(x * scale.x, y * scale.y, z * scale.z);
      uv.push(i / N, 1 - j / N);
    }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
