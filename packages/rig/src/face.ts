import * as THREE from 'three';
import { newCanvas, path2D } from './canvas';
import { DEFAULT_FACE } from './core/constants';
import { blushLevel, blushMarks, browMarks, CHIBI, chibiShape, eyeBlink, eyeMarks, eyeShape, faceRest, lookStep, mouthMark, moustacheMark, moustacheTop, wrinkleMarks, type FaceInk, type FaceMark, type FaceRest, type EyeShape, type EyeShapeKind, type Look, type MoustacheSpec, type WrinkleSpec } from './core/face';
import { FACE_R, faceSurface } from './core/humanHead';
import type { FaceState } from './core/types';

// Nét mặt của `core/face.ts` vẽ lên canvas rồi dán lên mặt trước của sọ theo phép chiếu thẳng — điểm lệch `x` px khỏi
// giữa mặt nằm ở kinh độ `asin(x / nửa rộng đầu)`.

/** `face.wrinkle` của JSON nhân vật */
export type Wrinkle = WrinkleSpec;
/** `face` của JSON nhân vật, px của đầu cao 130; `blush` là má ửng nền `0..1`, nét mặt nghỉ theo `FACE_REST`, dáng mắt người `eyeShape` với số đè `eye`; `beard` là râu (đã qua zod) */
export interface FaceShape extends Partial<FaceRest> { offsetY: number; eyeGap: number; mouthGap: number; wrinkle?: Wrinkle; blush?: number; eyeShape?: EyeShapeKind; eye?: Partial<EyeShape>; beard?: { moustache?: MoustacheSpec } }

const SHAPE: FaceShape = { offsetY: 0, eyeGap: 26, mouthGap: 34 };
/** THỬ (feat/real-head-proto): đầu `human` có cho mồm trượt về phía máy (lật gương khi quay quá `TURN`) không */
const HUMAN_MOUTH_CHEAT = false;

type Box = { x0: number; y0: number; w: number; h: number };
/** Vùng mặt trên canvas, px đầu quanh tâm đầu: từ nếp trán `deep` tới cằm */
const BOX: Box = { x0: -48, y0: -54, w: 96, h: 116 };
/** Lớp mồm, px đầu quanh tâm mồm: nửa bề ngang đủ cho mồm trượt sát má, trên / dưới phủ `extent` của mọi khẩu hình trước khi phóng */
export const MOUTH_BOX = { half: 60, top: 22, bottom: 32 };
/** Nửa bề ngang mồm mà chỗ trượt chừa tới vòng sọ, px đầu trước khi phóng; khẩu hình rộng hơn (`shout`) tràn ra mép đầu */
const SLIDE_HALF = 21;
const TEXEL = 8;
/** Camera lệch sang bên phải người quá `TURN` (rad, quanh trục đứng của đầu) thì lật gương khẩu hình; chỉ kiểu lệch (`wry`, `smirk`, `fang`…) đổi hình */
const TURN = 0.15;
/** Mồm lệch khỏi hướng camera quá `CHEEK` (rad) thì trượt theo sọ về phía camera: ở mép mặt mà vẫn còn đọc được */
const CHEEK = 1.15;

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
/** Vẽ `marks` phóng `k` quanh `(cx, cy)`; `wide` nhân thêm bề ngang */
function paintAt(g: Ctx, marks: FaceMark[], k: number, cx: number, cy: number, wide = 1) {
  g.save();
  g.translate(cx, cy);
  g.scale(k * wide, k);
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

/**
 * Nét mặt dán trên sọ: `mesh` treo vào nhóm đầu, lớp mồm là con của nó. `set` vẽ lại canvas mặt khi kiểu mắt, mày, nấc
 * chớp mắt (`blink`, độ nhắm của `blinkAt`), hướng nhìn (`lookStep`) hay mức ửng (`blushLevel`) đổi, canvas mồm khi khẩu hình đổi. Ngay trước khi vẽ, lớp mồm lật gương và trượt theo camera
 * bằng ma trận UV, không vẽ lại: camera lệch sang bên phải người quá `TURN` thì lật gương — chỉ khẩu hình lệch đổi hình —, mồm
 * lệch khỏi camera quá `CHEEK` thì trượt về phía camera.
 */
export interface FaceRig {
  mesh: THREE.Mesh;
  state: FaceState;
  blink: number;
  set(state: FaceState, blink?: number): void;
}

/**
 * Lớp nét mặt cho sọ bán kính `r` (three), cùng tỉ lệ `scale` với khối sọ. Mặt hướng +z, `y` lên; px đầu đổi ra
 * three theo `r / FACE_R`. Lưới dời lên khỏi mặt sọ một chút để khỏi lẫn độ sâu. `human`: dán trên đầu `humanSkull`, nét
 * mặt chibi (`CHIBI`) với mắt người dáng `shape.eyeShape`, cỡ mắt và đốm theo `FACE_REST` của `shape`. Má ửng `shape.blush` cộng `state.blush`, màu suy từ da `skin`.
 * Ria mép `shape.beard.moustache` vẽ trên lớp mồm theo khẩu hình, màu bỏ trống là `hair`.
 */
export function faceRig(r: number, scale: THREE.Vector3, shape: Partial<FaceShape> = {}, state: FaceState = DEFAULT_FACE, human = false, skin = '#f0d9b8', hair = '#2a1c15'): FaceRig {
  const sh = human ? chibiShape({ ...SHAPE, ...shape }) : { ...SHAPE, ...shape };
  const mouthCy = sh.offsetY + sh.mouthGap, mk = human ? CHIBI.mouth : 1;
  const tash = sh.beard?.moustache;
  // ria dày hay mồm há cao thì lớp mồm nới lên cho ria khỏi bị cắt
  const top = Math.max(MOUTH_BOX.top, tash ? -moustacheTop(tash) + 1 : 0);
  const MB: Box = { x0: -MOUTH_BOX.half, y0: mouthCy - top * mk, w: 2 * MOUTH_BOX.half, h: (top + MOUTH_BOX.bottom) * mk };
  const face = layer(r, scale, human, BOX, 1), mouth = layer(r, scale, human, MB, 2);
  const mesh = face.mesh;
  mesh.add(mouth.mesh);
  const level = (s: FaceState) => blushLevel(sh.blush, s.blush);
  const rest = faceRest(sh), look = human ? eyeShape(sh.eyeShape, sh.eye) : undefined;
  const brow = { width: rest.browWidth * (look?.brow ?? 1), tilt: rest.browTilt };
  const drawFace = (s: FaceState, blink: number, gaze: Look) => {
    const g = face.begin();
    const wrinkle = sh.wrinkle && wrinkleMarks(sh.wrinkle, 0, sh.offsetY, sh.eyeGap, mouthCy);
    if (wrinkle) paint(g, [wrinkle]);
    paint(g, [blushMarks(0, sh.offsetY, sh.eyeGap, skin, level(s))]);
    if (human) {
      // THỬ (feat/real-head-proto): mũi là khối riêng (`noseGeometry` của human.ts), không vẽ nét mũi
      for (const side of [-1, 1] as const) {
        const o = { only: side, squash: CHIBI.squash * rest.eyeWidth, lid: rest.lid, shine: rest.shine, shape: look, brow: s.brow, blink, look: gaze };
        paintAt(g, [eyeMarks(s.eyes, 0, sh.offsetY, sh.eyeGap, o)], CHIBI.eye * rest.eyeScale, (side * sh.eyeGap) / 2, sh.offsetY);
      }
      paint(g, [browMarks(s.brow, 0, sh.offsetY - CHIBI.brow, sh.eyeGap, brow)]);
    } else paint(g, [eyeMarks(s.eyes, 0, sh.offsetY, sh.eyeGap, { lid: rest.lid, blink, look: gaze }), browMarks(s.brow, 0, sh.offsetY, sh.eyeGap, brow)]);
    face.tex.needsUpdate = true;
  };
  const drawMouth = (s: FaceState) => {
    const marks = [mouthMark(s.mouth, 0, mouthCy)];
    if (tash) marks.push(moustacheMark(tash, s.mouth, 0, mouthCy, tash.color ?? hair));
    paintAt(mouth.begin(), marks, mk, 0, mouthCy, human ? CHIBI.mouthWide : 1);
    mouth.tex.needsUpdate = true;
  };
  let gaze = lookStep(state.look);
  const rig: FaceRig = {
    mesh,
    state,
    blink: 0,
    set(s, blink = 0) {
      const b = eyeBlink(s.eyes, blink), l = lookStep(s.look);
      const m = s.mouth !== rig.state.mouth, f = s.brow !== rig.state.brow || s.eyes !== rig.state.eyes || b !== rig.blink || l[0] !== gaze[0] || l[1] !== gaze[1] || level(s) !== level(rig.state);
      if (!m && !f) return;
      rig.state = { ...s };
      rig.blink = b;
      gaze = l;
      if (f) drawFace(rig.state, b, gaze);
      if (m) drawMouth(rig.state);
    },
  };
  // vòng ngang của sọ ở cao độ mồm, px đầu; sát vòng thì lưới bị ép lên mép cầu nên mồm dừng trước nó
  const ring = Math.sqrt(Math.max(FACE_R * FACE_R - mouthCy * mouthCy, 0));
  const eye = new THREE.Vector3();
  mouth.tex.matrixAutoUpdate = false;
  mouth.mesh.onBeforeRender = (_r, _s, camera) => {
    // THỬ (feat/real-head-proto): đầu `human` tắt mồm trượt về phía máy, mồm nằm đúng chỗ thật trên mặt
    if (human && !HUMAN_MOUTH_CHEAT) return;
    mouth.mesh.worldToLocal(eye.setFromMatrixPosition(camera.matrixWorld));
    const a = Math.atan2(eye.x, eye.z), over = Math.min(Math.max(Math.abs(a) - CHEEK, 0), Math.PI / 2);
    const x = Math.sign(a) * Math.min(ring * Math.sin(over), Math.max(0.95 * ring - SLIDE_HALF * mk, 0));
    const f = a < -TURN ? -1 : 1;
    // điểm `x` px trên lưới đọc canvas tại `f · (x − trượt)`: lật gương quanh tâm mồm rồi dời
    mouth.tex.matrix.set(f, 0, -MB.x0 / MB.w - (f * (-MB.x0 + x)) / MB.w, 0, 1, 0, 0, 0, 1);
  };
  drawFace(state, 0, gaze);
  drawMouth(state);
  return rig;
}

/** Một lớp canvas phủ vùng `box` px đầu trên mặt trước sọ; `begin` xoá canvas và đặt hệ px đầu */
function layer(r: number, scale: THREE.Vector3, human: boolean, box: Box, order: number) {
  const canvas = newCanvas(box.w * TEXEL, box.h * TEXEL);
  const g = canvas.getContext('2d') as Ctx;
  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(faceCap(r * 1.004, scale, human, box), mat);
  mesh.userData.noShadow = true;
  mesh.userData.noCollide = true;
  mesh.renderOrder = order;
  const begin = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(TEXEL, 0, 0, TEXEL, -box.x0 * TEXEL, -box.y0 * TEXEL);
    return g;
  };
  return { mesh, tex, begin };
}

/**
 * Lưới phủ vùng `box` trên mặt trước sọ: UV là toạ độ px đầu, điểm nằm trên mặt cầu theo phép chiếu thẳng; `human`
 * thì điểm mặt cầu ấy đi tiếp qua `humanSkull`, nét mặt nằm trên má và cằm như da.
 */
function faceCap(r: number, scale: THREE.Vector3, human: boolean, box: Box) {
  const N = 40;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const [x, y, z] = faceSurface(box.x0 + (box.w * i) / N, box.y0 + (box.h * j) / N, r, human);
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
