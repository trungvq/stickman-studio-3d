import * as THREE from 'three';
import type { FaceState } from './core/types';
import { act, type Acting } from './act';
import { setLights, setPalette } from './lighting';
import type { PaletteName } from './npr';
import type { AaMode } from './pipeline';
import { createStage } from './stage';
import { fromCharacter, R, type CharacterJson, type StickmanOptions } from './stickman';

// Ảnh chân dung người 3D cho lớp 2D (đầu trong bong bóng, icon trên slide, mặt dán lên đồ): dựng một người riêng trên sân
// khấu trống, ống kính tự ôm đầu (và vai), chụp ra canvas. Chụp lúc chạy từ JSON nhân vật: sửa nhân vật thì ảnh đi theo.

export interface PortraitOptions {
  /** `head` ôm đầu kể cả tóc, kính; `bust` thêm vai và một khúc thân áo tới `BUST_CUT` thân */
  frame?: 'head' | 'bust';
  /** Cỡ ảnh, px */
  w?: number;
  h?: number;
  /** Góc mặt lệch khỏi ống kính, độ: `0` nhìn thẳng, dương là nhìn sang phải khung */
  yaw?: number;
  /** Ống kính cao hơn tầm mắt, độ */
  pitch?: number;
  /** Lề quanh phần ôm, theo phần cao của nó; `bust` không có lề dưới */
  pad?: number;
  /** Nét mặt; `acting` có thì lấy của `acting` */
  face?: Partial<FaceState>;
  /** Một khung của `sceneAt`: dáng đầu, thân và nét mặt lúc ấy (chỗ đứng không ảnh hưởng khung ảnh) */
  acting?: Acting;
  /** Màu nền; `null` là nền trong suốt, viền nét mực mềm theo alpha */
  background?: string | null;
  palette?: PaletteName;
  aa?: AaMode;
  /** Thêm cho `fromCharacter`: hàm dựng đồ (`items`), đồ đang mặc (`equip`) */
  figure?: Partial<StickmanOptions>;
  /** Vẽ trên renderer có sẵn thay vì mở context WebGL mới mỗi ảnh; không có trong khoá cache */
  renderer?: THREE.WebGLRenderer;
}

/** Mép dưới khung `bust`: phần cao thân tính từ hông */
export const BUST_CUT = 0.55;
const DIST = 15;
const D = Math.PI / 180;
const cache = new Map<string, Promise<HTMLCanvasElement>>();

/**
 * Chân dung của `character` (đã qua `parseCharacter`). Cùng tham số thì trả cùng một canvas: đọc, chép, đừng vẽ đè.
 * Nền trong suốt chụp hai lần trên nền đen và trắng rồi tách alpha.
 */
export function portrait(character: CharacterJson, o: PortraitOptions = {}): Promise<HTMLCanvasElement> {
  const k = JSON.stringify([character, { ...o, renderer: undefined }]);
  let p = cache.get(k);
  if (!p) {
    p = Promise.resolve().then(() => shoot(character, o));
    p.catch(() => cache.delete(k));
    cache.set(k, p);
  }
  return p;
}

function shoot(character: CharacterJson, o: PortraitOptions): HTMLCanvasElement {
  const { frame = 'head', w = 512, h = w, yaw = 0, pitch = 0, pad = 0.08, background = null, palette = 'day', aa = 'ss2' } = o;
  const fig = fromCharacter(character, { ...o.figure, face: { ...o.figure?.face, ...o.face } });
  if (o.acting) act(fig, o.acting);
  fig.root.updateMatrixWorld(true);

  const target = fig.head.getWorldPosition(new THREE.Vector3());
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(fig.root.getWorldQuaternion(new THREE.Quaternion()));
  fwd.y = 0;
  fwd.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw * D).multiplyScalar(Math.cos(pitch * D));
  fwd.y = Math.sin(pitch * D);
  const camera = new THREE.PerspectiveCamera(10, w / h, DIST / 4, DIST * 4);
  camera.position.copy(target).addScaledVector(fwd, DIST);
  camera.lookAt(target);
  camera.updateMatrixWorld();

  const pts: number[] = [];
  const v = new THREE.Vector3(), toCam = camera.matrixWorldInverse;
  const push = (p: THREE.Vector3) => (p.applyMatrix4(toCam), pts.push(p.x / -p.z, p.y / -p.z));
  meshPoints(fig.head, (p) => push(p));
  let floor: number | undefined;
  if (frame === 'bust') {
    const cut = R.torso * BUST_CUT, toSpine = fig.spine.matrixWorld.clone().invert();
    floor = Infinity;
    meshPoints(fig.spine.children[0], (p) => {
      v.copy(p).applyMatrix4(toSpine);
      if (v.y < cut) return;
      push(p);
      // chiếu xuống mặt cắt cho mép dưới đúng ở chỗ cắt dù lưới thưa
      v.y = cut;
      push(v.applyMatrix4(fig.spine.matrixWorld));
      floor = Math.min(floor!, pts[pts.length - 1]);
    });
  }
  const box = fitBox(pts, w / h, pad, floor);
  const T = Math.max(Math.abs(box.y0), Math.abs(box.y1), Math.abs(box.x0) / camera.aspect, Math.abs(box.x1) / camera.aspect);
  camera.fov = 2 * Math.atan(T) / D;
  const H = 1000, W = H * camera.aspect;
  camera.setViewOffset(W, H, (box.x0 / (T * camera.aspect) + 1) / 2 * W, (1 - box.y1 / T) / 2 * H, (box.x1 - box.x0) / (2 * T * camera.aspect) * W, (box.y1 - box.y0) / (2 * T) * H);

  const stage = createStage({ size: { w, h }, aa, camera, renderer: o.renderer, light: () => (setPalette(palette), setLights({})) });
  stage.scene.add(fig.root);
  try {
    const shot = (bg: string) => {
      stage.scene.background = new THREE.Color(bg);
      return stage.still(0, { render: { paper: false } }) as HTMLCanvasElement;
    };
    if (background !== null) return shot(background);
    const black = shot('#000000'), white = shot('#ffffff');
    const ctx = black.getContext('2d')!, img = ctx.getImageData(0, 0, black.width, black.height);
    unmatte(img.data, white.getContext('2d')!.getImageData(0, 0, white.width, white.height).data);
    ctx.putImageData(img, 0, 0);
    return black;
  } finally {
    stage.scene.remove(fig.root);
    stage.dispose();
  }
}

/** Mọi đỉnh lưới hiện của `o` và con, toạ độ thế giới */
function meshPoints(o: THREE.Object3D, f: (p: THREE.Vector3) => void) {
  o.traverseVisible((m) => {
    const pos = (m as THREE.Mesh).isMesh && (m as THREE.Mesh).geometry.attributes.position;
    if (pos) for (let i = 0; i < pos.count; i++) f(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
  });
}

/**
 * Khung ôm các điểm `[x, y, …]` (tan góc nhìn, y lên) với lề `pad` theo phần cao, nới cho đúng tỉ lệ `aspect` quanh tâm.
 * Có `floor` thì mép dưới đúng ở đó, không lề, và phần nới dọc dồn xuống dưới (thêm thân áo).
 */
export function fitBox(pts: readonly number[], aspect: number, pad: number, floor?: number) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
  }
  if (floor !== undefined) y0 = floor;
  const m = (y1 - y0) * pad;
  x0 -= m; x1 += m; y1 += m;
  if (floor === undefined) y0 -= m;
  const bw = x1 - x0, bh = y1 - y0;
  if (bw / bh < aspect) {
    const d = (bh * aspect - bw) / 2;
    x0 -= d; x1 += d;
  } else if (floor === undefined) {
    const d = (bw / aspect - bh) / 2;
    y0 -= d; y1 += d;
  } else y0 = y1 - bw / aspect;
  return { x0, x1, y0, y1 };
}

/**
 * Tách alpha từ hai lần chụp cùng khung trên nền đen (`black`, ghi đè thành RGBA thẳng) và nền trắng: hiệu hai lần là
 * phần nền lọt qua. Đúng khi màu mỗi điểm ảnh chỉ trộn tuyến tính với nền (`paper: false`).
 */
export function unmatte(black: Uint8ClampedArray, white: Uint8ClampedArray) {
  for (let i = 0; i < black.length; i += 4) {
    const a = 1 - (white[i] - black[i] + white[i + 1] - black[i + 1] + white[i + 2] - black[i + 2]) / 765;
    const k = a > 1 / 255 ? 1 / a : 0;
    for (let c = 0; c < 3; c++) black[i + c] = black[i + c] * k;
    black[i + 3] = a * 255;
  }
}
