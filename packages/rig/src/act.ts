import * as THREE from 'three';
import type { BrowKind, EyeKind, MouthKind } from './face';
import { toThree, type Vec3 } from './khoi';
import { R, type Figure, type Side } from './stickman';

// Diễn theo tư thế đã lấy mẫu của @stickman3d/sketch (`sceneAt`, docs/01-rig.md#người-3d): package không đọc JSON hành
// động hay scene. Chỉ kênh tay chân soạn ở `side` (`pose.lift`) và đích cổ tay được đọc — góc trong mặt phẳng dọc
// thân, `0` thẳng xuống, dương ra trước, khớp con tương đối khớp cha. Kênh tay chân soạn trên mặt khung 2D thì
// người đứng nghỉ (ngồi thì đùi ngang).

/** Đích cổ tay: hệ thân `[tiến, y xuống, ra ngoài]` đơn vị rig trong `pose.reach`, toạ độ thế giới rig trong `world.hands` */
export interface ActReach { at: readonly number[]; elbow?: readonly number[]; w: number }
type Limb = 'af' | 'an' | 'lf' | 'ln';
/** `Pose` của @stickman3d/sketch; góc độ, `head` là `[nghiêng, lắc, gật]` */
export interface ActPose {
  af: readonly number[];
  an: readonly number[];
  lf: readonly number[];
  ln: readonly number[];
  torso: number;
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
/** `REACH_ELBOW` của @stickman3d/sketch: khuỷu xuống, lùi, ra ngoài */
const REACH_ELBOW: Vec3 = [-0.4, 1, 0.5];
/** Tay choãi khỏi thân áo một chút; đích cổ tay thì không */
const SPLAY = 0.08;

const num = (v: number | undefined) => (Number.isFinite(v) ? (v as number) : 0);

/** Đoạn chi dài `len · st`: dời khớp con và kéo nét */
function segment(j: THREE.Group, child: THREE.Group | undefined, len: number, st: number) {
  for (const m of j.children) if (m.userData.limb) m.userData.len = len * st;
  if (child) child.position.y = -len * st;
}

/** IK hai đoạn của @stickman3d/sketch (`solveTwoBone`): khớp giữa trong mặt phẳng qua trục gốc → đích và `pole` */
function twoBone(S: THREE.Vector3, T: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3) {
  const d = T.clone().sub(S), dist = d.length();
  const n = dist > 1e-9 ? d.divideScalar(dist) : new THREE.Vector3(0, -1, 0);
  const across = (v: THREE.Vector3) => v.clone().addScaledVector(n, -v.dot(n));
  let u = across(pole);
  if (u.lengthSq() < 1e-18) u = across(DOWN);
  if (u.lengthSq() < 1e-18) u = across(new THREE.Vector3(1, 0, 0));
  u.normalize();
  const reach = Math.min(Math.max(dist, Math.abs(l1 - l2)), l1 + l2);
  const a = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach || 1);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return [S.clone().addScaledVector(n, a).addScaledVector(u, h), S.clone().addScaledVector(n, reach)];
}

/** Xoay `j` cho đoạn rủ −y của nó chĩa từ `from` tới `to` (thế giới) */
function aim(j: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  const q = j.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
  j.quaternion.setFromUnitVectors(DOWN, to.clone().sub(from).normalize().applyQuaternion(q));
  j.updateMatrixWorld(true);
}

/** Tay `side` với tới đích hệ thân `rb` (gốc là tâm hông 2D, tức `root`) rồi đích thế giới `rw`, hoà trên vị trí cổ tay theo `w` như rig */
function reachArm(p: Figure, side: Side, rb: ActReach | undefined, rw: ActReach | undefined) {
  if (!(rb && rb.w > 0) && !(rw && rw.w > 0)) return;
  const { shoulder, elbow, wrist } = p.arms[side];
  const S = shoulder.getWorldPosition(new THREE.Vector3());
  const E = elbow.getWorldPosition(new THREE.Vector3());
  let T = wrist.getWorldPosition(new THREE.Vector3());
  const hq = p.root.getWorldQuaternion(new THREE.Quaternion());
  const body = ([f, y, o]: readonly number[]) => new THREE.Vector3(side * o, -y, f);
  const axis = T.clone().sub(S).normalize();
  const bend = E.clone().sub(S).addScaledVector(axis, -E.clone().sub(S).dot(axis));
  let pole = bend.lengthSq() > 1e-10 ? bend.normalize() : body(REACH_ELBOW).applyQuaternion(hq).normalize();
  const toward = (r: ActReach | undefined, target: () => THREE.Vector3, el: THREE.Vector3) => {
    if (!r || !(r.w > 0)) return;
    const k = Math.min(1, r.w);
    T = T.clone().lerp(target(), k);
    pole = pole.multiplyScalar(1 - k).addScaledVector(el.normalize(), k);
  };
  toward(rb, () => p.root.localToWorld(body(rb!.at).multiplyScalar(0.01)), body(rb?.elbow ?? REACH_ELBOW).applyQuaternion(hq));
  toward(rw, () => toThree(rw!.at as Vec3), rw?.elbow ? new THREE.Vector3(rw.elbow[0], -rw.elbow[1], -rw.elbow[2]) : body(REACH_ELBOW).applyQuaternion(hq));
  const k = p.root.scale.x;
  const l1 = elbow.position.length() * k, l2 = wrist.position.length() * k;
  const [e, w] = twoBone(S, T, l1, l2, pole);
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
  const angles = (ch: Limb, rest: readonly number[]) => (P.lift?.[ch] ? P[ch] : rest);

  for (const side of [near, -near as Side]) {
    const isNear = side === near;
    const { hip, knee } = p.legs[side];
    const [a, b] = angles(isNear ? 'ln' : 'lf', seated ? [90, -90] : [0, 0]);
    hip.rotation.set(-num(a) * D, 0, 0);
    knee.rotation.set(-num(b) * D, 0, 0);
    segment(hip, knee, R.thigh, st[isNear ? 6 : 4] ?? 1);
    segment(knee, undefined, R.shin, st[isNear ? 7 : 5] ?? 1);
  }

  p.spine.rotation.set(num(P.torso) * D, 0, 0);
  const m = flip ? -1 : 1;
  const [tilt, turn, nod] = P.head;
  // lắc dương là quay mặt xa ống kính (về bên trái người khi không lật), nghiêng dương đưa đỉnh đầu về phía ấy
  p.neck.rotation.set(num(nod) * D, m * num(turn) * D, -m * num(tilt) * D, 'YXZ');

  for (const side of [near, -near as Side]) {
    const ch = side === near ? 'an' : 'af';
    const { shoulder, elbow, wrist } = p.arms[side];
    const [a, b] = angles(ch, [0, 0]);
    shoulder.rotation.set(-num(a) * D, 0, side * SPLAY, 'ZXY');
    elbow.rotation.set(-num(b) * D, 0, 0);
    segment(shoulder, elbow, R.upperArm, st[side === near ? 2 : 0] ?? 1);
    segment(elbow, wrist, R.foreArm, st[side === near ? 3 : 1] ?? 1);
  }
  p.root.updateMatrixWorld(true);
  reachArm(p, near, P.reach?.an, W?.hands?.near);
  reachArm(p, -near as Side, P.reach?.af, W?.hands?.far);

  const blink = t !== undefined && sp.eyes === 'open' && blinking(t, p.seed);
  p.face.set({ mouth: sp.mouth, brow: sp.brow, eyes: blink ? 'shut' : sp.eyes });
}
