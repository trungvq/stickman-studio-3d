import * as THREE from 'three';
import { toThree, type Vec3 } from './khoi';
import type { aimCamera } from './lens';
import { R, type Figure, type Side } from './stickman';

/**
 * Mốc trên người 3D. `R`/`L` là tay chân phải/trái của người. `mouth` và `face` theo nét mặt mặc định (`faceShape` không
 * lưu trên `Figure`).
 */
export const LANDMARKS = [
  'root', 'hip', 'chest', 'collar', 'head', 'headTop', 'face', 'mouth',
  'wristR', 'wristL', 'footR', 'footL',
] as const;
export type Landmark = (typeof LANDMARKS)[number];

// px đầu → three như `faceRig`: bán kính sọ 65 px, mồm dưới tâm mắt `mouthGap` 34 px, sọ (1, 1.04, 0.98)
const PX = R.head / 65;
const MOUTH_Y = -34 * PX * 1.04;
const MOUTH_Z = Math.sqrt(R.head * R.head - (34 * PX) ** 2) * 0.98;

const eye = new THREE.Vector3();

/** Toạ độ thế giới three của mốc `name` trên người `p`; `matrixWorld` phải đã cập nhật */
export function landmark(p: Figure, name: Landmark, out = new THREE.Vector3()): THREE.Vector3 {
  const at = (o: THREE.Object3D, x = 0, y = 0, z = 0) => o.localToWorld(out.set(x, y, z));
  const wrist = (s: Side) => at(p.arms[s].wrist).clone();
  const foot = (s: Side) => at(p.legs[s].knee, 0, -p.bones.shin, 0).clone();
  switch (name) {
    case 'root': return at(p.root);
    case 'hip': return at(p.hips);
    case 'chest': return at(p.spine, 0, p.bones.torso * 0.72, 0);
    case 'collar': return at(p.neck);
    case 'head': return at(p.head);
    case 'headTop': return at(p.head, 0, R.head * 1.04, 0);
    case 'face': return at(p.head, 0, 0, R.head * 0.98);
    case 'mouth': return at(p.head, 0, MOUTH_Y, MOUTH_Z);
    case 'wristR': return out.copy(wrist(-1));
    case 'wristL': return out.copy(wrist(1));
    case 'footR': return out.copy(foot(-1));
    case 'footL': return out.copy(foot(1));
  }
}

/** Thứ `screenOf` chiếu qua: camera đã đặt cho khung và cỡ khung px. `Stage` khớp hình này. */
export interface ScreenView {
  camera: THREE.PerspectiveCamera;
  size: { w: number; h: number };
  /** Hộp cắt trên sân khấu mà `aimCamera` trả; có thì `screenOf` trả thêm toạ độ sân khấu */
  rect?: ReturnType<typeof aimCamera>;
}

export interface ScreenPoint {
  /** px trên khung, gốc trên trái */
  x: number;
  y: number;
  /** Toạ độ sân khấu (gốc giữa khung, như `anchorAt` và `cameraAt`): vẽ vào SVG có `viewBox` của `cameraAt` */
  stage?: { x: number; y: number };
  /** Khoảng cách theo trục nhìn, three */
  depth: number;
  /** px khung cho một đơn vị rig ở độ sâu ấy: cỡ bong bóng, mũi tên theo người */
  scale: number;
  /** Nằm sau mặt phẳng gần của camera: `x`, `y` vô nghĩa */
  behind: boolean;
  /** Trước camera và trong khung */
  inFrame: boolean;
  /** Có vật trong `occluders` chắn giữa mắt và điểm; chỉ có khi truyền `occluders` */
  occluded?: boolean;
}

export interface ScreenOptions {
  /** Vật có thể che, thử bằng tia từ mắt. Người hay vật đang được hỏi tự bỏ qua, vỏ ngược của nét viền cũng vậy. */
  occluders?: THREE.Object3D[];
}

type Target = Vec3 | THREE.Vector3 | THREE.Object3D;
const isFigure = (o: unknown): o is Figure => !!o && typeof o === 'object' && 'root' in o && 'head' in o && 'arms' in o;
const ray = new THREE.Raycaster();
const v = new THREE.Vector3();

/**
 * Chiếu một điểm ra khung đang vẽ, để chữ, bong bóng, mũi tên 2D đè lên canvas bám theo khi camera chạy.
 * `at` là điểm thế giới rig (`Vec3`), điểm three (`Vector3`), gốc một vật (`Object3D`), hay người kèm tên mốc.
 * Gọi sau `stage.pose` hay `stage.draw` của đúng khung ấy.
 */
export function screenOf(view: ScreenView, at: Target, o?: ScreenOptions): ScreenPoint;
export function screenOf(view: ScreenView, fig: Figure, name: Landmark, o?: ScreenOptions): ScreenPoint;
export function screenOf(view: ScreenView, at: Target | Figure, a?: Landmark | ScreenOptions, b?: ScreenOptions): ScreenPoint {
  const { camera, size } = view;
  let p: THREE.Vector3, self: THREE.Object3D | undefined, opt: ScreenOptions | undefined;
  if (isFigure(at)) {
    p = landmark(at, a as Landmark);
    self = at.root;
    opt = b;
  } else {
    opt = a as ScreenOptions | undefined;
    if (Array.isArray(at)) p = toThree(at);
    else if ((at as THREE.Object3D).isObject3D) {
      self = at as THREE.Object3D;
      p = self.getWorldPosition(new THREE.Vector3());
    } else p = (at as THREE.Vector3).clone();
  }
  const depth = -v.copy(p).applyMatrix4(camera.matrixWorldInverse).z;
  v.copy(p).project(camera);
  const x = ((v.x + 1) / 2) * size.w, y = ((1 - v.y) / 2) * size.h;
  const behind = depth <= camera.near;
  const out: ScreenPoint = {
    x, y, depth, behind,
    scale: (camera.projectionMatrix.elements[5] * size.h) / 2 / Math.max(depth, camera.near) / 100,
    inFrame: !behind && x >= 0 && x <= size.w && y >= 0 && y <= size.h,
  };
  const r = view.rect;
  if (r) out.stage = { x: r.x - r.full[0] / 2 + (x / size.w) * r.w, y: r.y - r.full[1] / 2 + (y / size.h) * r.h };
  if (opt?.occluders && !behind) {
    camera.getWorldPosition(eye);
    ray.set(eye, v.copy(p).sub(eye).normalize());
    ray.far = eye.distanceTo(p) - 0.02;
    out.occluded = ray.intersectObjects(opt.occluders, true).some(({ object: h }) => {
      const m = (h as THREE.Mesh).material as THREE.Material | undefined;
      if (m && (m.side === THREE.BackSide || !m.visible)) return false;
      for (let q: THREE.Object3D | null = h; q; q = q.parent) if (q === self || !q.visible) return false;
      return true;
    });
  }
  return out;
}
