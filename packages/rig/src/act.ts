import * as THREE from 'three';
import { actAngles, actReach, SPLAY3, type ActFrame } from './core/act3';
import type { V3 } from './core/lens';
import type { BrowKind, EyeKind, MouthKind } from './core/types';
import { toThree, type Vec3 } from './khoi';
import { fitSkirt, R, type Figure, type Side } from './stickman';

// Diễn theo tư thế đã lấy mẫu của @stickman3d/sketch (`sceneAt`, docs/01-rig.md#người-3d): package không đọc JSON hành
// động hay scene. Luật đọc góc (`actAngles`) và IK (`actReach`) ở lõi, `actJoints` của lõi tính lại đúng các khớp này
// cho `check` — đổi khung xương ở đây thì đổi cùng `core/act3.ts`.

/** Đích cổ tay: hệ thân `[tiến, y xuống, ra ngoài]` đơn vị rig trong `pose.reach`, toạ độ thế giới rig trong `world.hands` */
export interface ActReach { at: readonly number[]; elbow?: readonly number[]; w: number }
type Limb = 'af' | 'an' | 'lf' | 'ln';
/** `Pose` của @stickman3d/sketch; góc độ, tay `[vai, khuỷu, cổ tay, dang]`, chân `[hông, gối, dang]`, `head` là `[nghiêng, lắc, gật]` */
export interface ActPose {
  af: readonly number[];
  an: readonly number[];
  lf: readonly number[];
  ln: readonly number[];
  torso: number;
  /** Nghiêng thân sang ngang, độ; dương như nghiêng đầu, về phía tay xa */
  lean?: number;
  head: readonly number[];
  /** `[tay xa ×2, tay gần ×2, chân xa ×2, chân gần ×2]` */
  stretch: readonly number[];
  lift?: Partial<Record<Limb, boolean>>;
  reach?: Partial<Record<'af' | 'an', ActReach>>;
}
/** `World` của @stickman3d/sketch: tâm hông thế giới rig, `yaw` radian (0 mặt về +x, π/2 về −z), `flip` là mặt sang trái khung */
export interface ActWorld {
  hip: readonly number[];
  yaw: number;
  s: number;
  flip: boolean;
  seated?: boolean;
  hands?: { near?: ActReach; far?: ActReach };
}
/** `ScenePose` của @stickman3d/sketch — `sceneAt(rt, id, t, height, body3(c))` truyền thẳng vào được */
export interface Acting {
  pose: ActPose;
  world?: ActWorld;
  mouth: MouthKind;
  brow: BrowKind;
  eyes: EyeKind;
}

const D = Math.PI / 180;
const DOWN = new THREE.Vector3(0, -1, 0);

const num = (v: number | undefined) => (Number.isFinite(v) ? (v as number) : 0);

/** Đoạn chi dài `len · st`: dời khớp con và kéo nét */
function segment(j: THREE.Group, child: THREE.Group | undefined, len: number, st: number) {
  for (const m of j.children) if (m.userData.limb) m.userData.len = len * st;
  if (child) child.position.y = -len * st;
}

/** Xoay `j` cho đoạn rủ −y của nó chĩa từ `from` tới `to` (thế giới) */
function aim(j: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  const q = j.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
  j.quaternion.setFromUnitVectors(DOWN, to.clone().sub(from).normalize().applyQuaternion(q));
  j.updateMatrixWorld(true);
}

const v3 = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];

/** Tay `side` với tới đích hệ thân `rb` rồi đích thế giới `rw` (`actReach` của lõi) */
function reachArm(p: Figure, side: Side, rb: ActReach | undefined, rw: ActReach | undefined) {
  if (!(rb && rb.w > 0) && !(rw && rw.w > 0)) return;
  const { shoulder, elbow, wrist } = p.arms[side];
  const S = shoulder.getWorldPosition(new THREE.Vector3());
  const hq = p.root.getWorldQuaternion(new THREE.Quaternion());
  const frame: ActFrame = {
    point: (v) => v3(p.root.localToWorld(new THREE.Vector3(...v))),
    dir: (v) => v3(new THREE.Vector3(...v).applyQuaternion(hq)),
  };
  const k = p.root.scale.x;
  const chain = [S, elbow.getWorldPosition(new THREE.Vector3()), wrist.getWorldPosition(new THREE.Vector3())].map(v3) as [V3, V3, V3];
  const ik = actReach(frame, side, chain, elbow.position.length() * k, wrist.position.length() * k, rb, rw);
  if (!ik) return;
  const [e, w] = ik.map((q) => new THREE.Vector3(...q));
  aim(shoulder, S, e);
  aim(elbow, e, w);
}

const fract = (x: number) => x - Math.floor(x);
/** Chớp mắt vu vơ: mỗi nhịp ~3,7 s một lần chớp 0,12 s ở chỗ băm từ số nhịp và `seed` */
function blinking(t: number, seed: number) {
  const P = 3.7, u = t + seed * 1.618, n = Math.floor(u / P);
  const at = n * P + 0.4 + fract(Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453) * (P - 1);
  return u >= at && u < at + 0.12;
}

/**
 * Đặt người theo một khung của `sceneAt`: chỗ đứng và hướng (`world`), góc tay chân thân đầu, đích cổ tay, nét
 * mặt. `t` (giây) bật chớp mắt khi mắt đang `open`. Chi gần là bên phải người khi không lật.
 */
export function act(p: Figure, sp: Acting, t?: number) {
  const { pose: P, world: W } = sp;
  const flip = !!W?.flip;
  const near: Side = flip ? 1 : -1;
  const seated = !!W?.seated;
  if (W) {
    p.root.position.copy(toThree(W.hip as Vec3));
    p.root.rotation.set(0, Math.PI / 2 - W.yaw, 0);
    p.root.scale.setScalar(W.s);
    // hông 2D là tâm nét: người đứng nhấc lên nửa bề dày chi cho bàn chân nằm trên sàn
    p.hips.position.set(0, seated ? 0 : R.limb, 0);
  }
  const st = P.stretch;

  for (const side of [near, -near as Side]) {
    const isNear = side === near;
    const { hip, knee } = p.legs[side];
    const [a, b, sp] = actAngles(P, isNear ? 'ln' : 'lf', seated);
    hip.rotation.set(-a * D, 0, side * sp * D, 'ZXY');
    knee.rotation.set(-b * D, 0, 0);
    segment(hip, knee, R.thigh, st[isNear ? 6 : 4] ?? 1);
    segment(knee, undefined, R.shin, st[isNear ? 7 : 5] ?? 1);
  }

  const m = flip ? -1 : 1;
  p.spine.rotation.set(num(P.torso) * D, 0, -m * num(P.lean) * D);
  const [tilt, turn, nod] = P.head;
  // lắc dương là quay mặt xa ống kính (về bên trái người khi không lật), nghiêng dương đưa đỉnh đầu về phía ấy
  p.neck.rotation.set(num(nod) * D, m * num(turn) * D, -m * num(tilt) * D, 'YXZ');

  for (const side of [near, -near as Side]) {
    const ch = side === near ? 'an' : 'af';
    const { shoulder, elbow, wrist } = p.arms[side];
    const [a, b, sp] = actAngles(P, ch, false);
    shoulder.rotation.set(-a * D, 0, side * (SPLAY3 + sp * D), 'ZXY');
    elbow.rotation.set(-b * D, 0, 0);
    segment(shoulder, elbow, R.upperArm, st[side === near ? 2 : 0] ?? 1);
    segment(elbow, wrist, R.foreArm, st[side === near ? 3 : 1] ?? 1);
  }
  p.root.updateMatrixWorld(true);
  fitSkirt(p);
  reachArm(p, near, P.reach?.an, W?.hands?.near);
  reachArm(p, -near as Side, P.reach?.af, W?.hands?.far);

  const blink = t !== undefined && sp.eyes === 'open' && blinking(t, p.seed);
  p.face.set({ mouth: sp.mouth, brow: sp.brow, eyes: blink ? 'shut' : sp.eyes });
}
