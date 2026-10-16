import * as THREE from 'three';
import { faded, handCaps, meshTris } from './collide';
import { handGripOf, handPoint } from './core/hand';
import { HAND_CAPSULE_PIECES } from './core/handMesh';
import { angleBetween, capsuleDepth, meshBox, meshSigned, type HeldGroup, type HeldHand, type HeldIntent } from './core/heldAudit';
import type { V3 } from './core/lens';
import { U } from './khoi';
import type { Figure, Side } from './stickman';

// Số đo đồ cầm của người 3D ở tư thế hiện tại (`HeldHand` của lõi), đọc trên chính cảnh three: món trong `fig.holding`,
// lưới hiện hình của món, nang bàn tay theo dáng đang vẽ. Thuần: không đổi gì trên người hay đồ. docs/03-scene.md#đồ-cầm-tay

/** Khe xa nhất (đơn vị rig) đo đúng tới mặt món; xa hơn chỉ là khe tới hộp bao */
const REACH = 6;

const shown = (o: THREE.Object3D | null) => {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
};

/** Tam giác thế giới của các lưới hiện hình của món: bỏ vỏ nét ngược, vật đã mờ, nhánh ẩn */
function itemMesh(object: THREE.Object3D): Float32Array[] {
  const out: Float32Array[] = [];
  object.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.body || faded(m)) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (mats.every((x) => x.side === THREE.BackSide)) return;
    const c = meshTris(m, '');
    if (c?.tris) out.push(c.tris);
  });
  return out;
}

const nameOf = (o: THREE.Object3D) => {
  let n = o.name;
  if (!n) o.traverse((c) => void (n ||= c.name));
  return n || 'món';
};

const GROUP: Record<string, HeldGroup> = { palm: 'palm', thenar: 'palm', thumb0: 'thumb', thumb1: 'thumb', index0: 'index', index1: 'index' };

/**
 * Số đo từng bàn tay của người `fig` (tên `id`) đang cầm một món hiện trên hình: lún và khe của từng nang bàn tay tới lưới
 * món, tâm nắm và lòng tay tới món, trục ý định của món (`userData.hold`: `up`, `face`, `faceToward`), món trong khung bàn
 * tay. Chỉ người `clad` (có bàn tay). `U` là đơn vị three của một đơn vị rig, `eye` mắt ống kính (thế giới three) cho
 * `faceToward: "camera"`. Gọi sau `act` và sau khi đồ riêng của cảnh đã cập nhật.
 */
export function heldHands(fig: Figure, id: string, o: { U?: number; eye?: THREE.Vector3 | readonly [number, number, number] } = {}): HeldHand[] {
  const u = o.U ?? U;
  const out: HeldHand[] = [];
  if (!fig.hands || !fig.holding || !shown(fig.root)) return out;
  fig.root.updateWorldMatrix(true, true);
  const k = fig.root.getWorldScale(new THREE.Vector3()).x;
  for (const side of [-1, 1] as Side[]) {
    const entry = fig.holding[side], h = fig.hands[side];
    if (!entry || !h || !shown(entry.object)) continue;
    const mesh = itemMesh(entry.object);
    if (!mesh.length) continue;
    const box = meshBox(mesh);
    const W = fig.arms[side].wrist.matrixWorld;
    const world = (p: readonly number[]): V3 => {
      const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(W);
      return [v.x, v.y, v.z];
    };
    const v = [0, 0, ...h.shown];
    // nang bàn tay theo dáng đang vẽ, thế giới three
    const gaps: Record<HeldGroup, number> = { thumb: Infinity, index: Infinity, fingers: Infinity, palm: Infinity };
    let pierce = { depth: -Infinity, core: -Infinity, piece: 'palm' };
    handCaps(h).forEach(([a, b, r], i) => {
      const piece = HAND_CAPSULE_PIECES[i];
      const d = capsuleDepth(mesh, world(a), world(b), r * k, REACH * u, box) / u;
      const g = GROUP[piece] ?? 'fingers';
      gaps[g] = Math.min(gaps[g], -d);
      const core = d - (r * k) / u;
      if (core > pierce.core) pierce = { depth: d, core, piece };
    });
    const G = world(handGripOf(v, side, h.scale, h.long));
    const P = world(handPoint('palm', v, side, h.scale, h.long));
    const n = new THREE.Vector3(-side, 0, 0).transformDirection(W);
    const grip = meshSigned(mesh, G, box).d / u;
    const pc = meshSigned(mesh, P, box);
    const toward: V3 = [pc.q[0] - P[0], pc.q[1] - P[1], pc.q[2] - P[2]];
    const palm = { gap: pc.d / u, angle: pc.d > 0.05 * u ? angleBetween([n.x, n.y, n.z], toward) : 0 };
    // trục ý định của món
    const intent = entry.object.userData.hold as HeldIntent | undefined;
    const axis = (a: V3) => {
      const d = new THREE.Vector3(...a).transformDirection(entry.object.matrixWorld);
      return [d.x, d.y, d.z] as V3;
    };
    const up = intent?.up && angleBetween(axis(intent.up), [0, 1, 0]);
    let face: HeldHand['face'];
    if (intent?.face && intent.faceToward) {
      const c: V3 = [(box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2];
      const eye = o.eye && (o.eye instanceof THREE.Vector3 ? o.eye : new THREE.Vector3(...o.eye));
      const target = intent.faceToward === 'camera' ? eye : fig.sockets.face.getWorldPosition(new THREE.Vector3());
      if (target) face = { angle: angleBetween(axis(intent.face), [target.x - c[0], target.y - c[1], target.z - c[2]]), toward: intent.faceToward };
    }
    // món trong khung bàn tay
    const rel = new THREE.Matrix4().copy(W).invert().multiply(entry.object.matrixWorld);
    const rp = new THREE.Vector3(), rq = new THREE.Quaternion(), rs = new THREE.Vector3();
    rel.decompose(rp, rq, rs);
    out.push({
      id, hand: side < 0 ? 'R' : 'L',
      item: nameOf(entry.object),
      key: `${entry.object.id}|${entry.pose}|${entry.follow}|${entry.offset ?? ''}|${entry.rotate ?? ''}`,
      pose: h.held ?? entry.pose,
      follow: entry.follow,
      acted: h.acted,
      pierce, gaps, grip, palm,
      ...(up !== undefined && { up }),
      ...(face && { face }),
      rel: { p: [(rp.x * k) / u, (rp.y * k) / u, (rp.z * k) / u], q: [rq.x, rq.y, rq.z, rq.w] },
      at: [G[0] / u, -G[1] / u, -G[2] / u],
    });
  }
  return out;
}
