import * as THREE from 'three';
import { R, type Figure, type Side } from './stickman';
import { RIG } from './core/constants';
import { gripShift, type HandPose } from './core/hand';
import { gripCenter, gripFrame, gripHand, heldAxis, heldGrip, type GripHand, type GripSpec, type HeldItemSpec } from './core/heldItem';
import { heldFit } from './core/heldFit';
import { fingerVec, HAND_POSES } from './core/hand';
import type { HeldIntent } from './core/heldAudit';
import type { Vec3 } from './khoi';
import { poseHand } from './human';

// Chỗ gắn đồ trên người que: cổ tay, đỉnh đầu, ngang mắt, ngực áo. Đồ cầm bám cổ tay sau `act` mà không cần
// gọi thêm gì: nhóm bám tự đặt lại mỗi lần three cập nhật ma trận (lúc render, hay `root.updateMatrixWorld()`).

/** Socket theo tên của @stickman3d/sketch (`PIECE_KEYS`), cộng `chest` chỉ có ở 3D */
export type SocketName = 'handNear' | 'handFar' | 'crown' | 'headAcc' | 'faceAcc' | 'chest';
export const SOCKET_NAMES: readonly SocketName[] = ['handNear', 'handFar', 'crown', 'headAcc', 'faceAcc', 'chest'];

/** Số đo đầu trong hệ nhóm đầu (three, y lên, z ra trước mặt, gốc ở tâm sọ) */
export interface HeadFit {
  /** Bán kính sọ ngang */
  r: number;
  /** Đỉnh đầu kể cả vỏ tóc */
  top: number;
  /** Cao độ hai mắt */
  eye: number;
  /** Mặt trước sọ ở cao độ mắt */
  front: number;
  /** Cao độ một vành tròn bán kính `radius` đặt trùm xuống đầu thì dừng lại (sọ và vỏ tóc, không tính lọn gai) */
  rest(radius: number): number;
}

/**
 * Khung gắn đồ. `hand[side]` treo ở cổ tay và xoay theo nó: −y dọc bàn tay ra ngoài, gốc ở mút nét tay — người `clad` thì
 * ở tâm nắm của dáng `grip` (`handGrip`). `crown` ở đỉnh đầu
 * kể cả tóc, `face` ở mặt trước sọ ngang mắt, `chest` trên mặt áo, +z là pháp tuyến ra ngoài, y lên.
 */
export interface Sockets {
  hand: Record<Side, THREE.Group>;
  crown: THREE.Group;
  face: THREE.Group;
  chest: THREE.Group;
  head: HeadFit;
}

/** Kiểu cầm cứng: món `item` (`held/<món>.json` đã qua `parseHeldItem`), kiểu `grip` của nó */
export interface HoldGrip {
  item: string;
  spec: HeldItemSpec;
  grip: string;
}

/**
 * Cách cầm. `grip`: món cứng theo bàn tay bằng liên kết của kiểu cầm (`gripFrame` của lõi) — dáng ngón, chỗ và hướng món
 * đều do kiểu cầm; không đi cùng `follow`, `offset`, `rotate`, `pose`. Không có `grip` là đường cũ: `wrist` đi cứng theo cổ
 * tay, `level` đặt ở cổ tay nhưng đứng thẳng, quay theo hướng người (cốc, khay). Hai tay (`hand: 'both'`): gốc ở giữa hai
 * mút tay, x từ tay phải sang tay trái; `level` giữ mặt ngang (khay), `tilt` nghiêng theo chênh cao hai tay (báo, laptop).
 */
export interface HoldOptions {
  hand: Side | 'both';
  grip?: HoldGrip;
  /** @deprecated đường cũ — dùng `grip` */
  follow?: 'wrist' | 'level' | 'tilt';
  /** @deprecated đường cũ — dời vật trong khung cầm, đơn vị three của người cao 4,3 */
  offset?: readonly [number, number, number];
  /** @deprecated đường cũ — xoay vật trong khung cầm, độ, thứ tự XYZ */
  rotate?: readonly [number, number, number];
  /** @deprecated đường cũ — dáng bàn tay cầm của người `clad`, mặc định `grip` */
  pose?: HandPose;
}

/**
 * Lần cầm đang giữ của một bàn tay (`Figure.holding[side]`): `hold` ghi, `release` xoá. `check` đọc nó để tìm món trong tay
 * và đo đồ cầm (docs/03-scene.md#đồ-cầm-tay); món khai ý định ở `object.userData.hold` (`HeldIntent` của lõi). Kiểu cầm
 * cứng ghi `item`, `grip`
 */
export interface Holding {
  object: THREE.Object3D;
  item?: string;
  grip?: string;
  /** Kiểu cầm cứng: JSON món và bàn tay của kiểu cầm cho tay này (tay phụ là `both.other`) — ngón ôm theo đồ đọc */
  spec?: HeldItemSpec;
  hand?: GripHand;
  pose: HandPose;
  follow: 'wrist' | 'level' | 'tilt';
  both: boolean;
  offset?: readonly [number, number, number];
  rotate?: readonly [number, number, number];
}

export interface Held {
  object: THREE.Object3D;
  /** Khoảng cách hai mút tay lúc cập nhật gần nhất (hệ người, chưa nhân `root.scale`); một tay là 0 */
  span: number;
  release(): void;
}

const D = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

/** Nhóm tự đặt lại trước khi three tính ma trận thế giới của nó */
class Follow extends THREE.Group {
  constructor(private place: (g: THREE.Group) => void) {
    super();
  }
  override updateMatrixWorld(force?: boolean) {
    this.place(this);
    super.updateMatrixWorld(force);
  }
  override updateWorldMatrix(updateParents: boolean, updateChildren: boolean) {
    this.place(this);
    super.updateWorldMatrix(updateParents, updateChildren);
  }
}

/** Tâm nắm của tay `side` trong hệ người: chỗ treo đồ (`handGrip`) dời theo dáng đang giữ (`gripShift`) */
const handTip = (fig: Figure, side: Side, out: THREE.Vector3, pose?: HandPose) => {
  const s = fig.sockets.hand[side];
  s.updateWorldMatrix(true, false);
  return fig.root.worldToLocal(s.localToWorld(out.set(...shiftOf(fig, side, pose))));
};

/** Đồ cầm dời khỏi chỗ treo bấy nhiêu khi tay người `clad` giữ dáng `pose`; người que không có bàn tay thì không dời */
const shiftOf = (fig: Figure, side: Side, pose?: HandPose): [number, number, number] => {
  const h = fig.hands?.[side];
  return h && pose ? gripShift(pose, side, h.scale, h.long) : [0, 0, 0];
};

/** Vật trong nhóm dời/xoay theo `offset`, `rotate`; trả nhóm ấy */
function gripped(object: THREE.Object3D, o: HoldOptions) {
  const g = new THREE.Group();
  if (o.offset) g.position.set(...o.offset);
  if (o.rotate) g.rotation.set(o.rotate[0] * D, o.rotate[1] * D, o.rotate[2] * D);
  g.add(object);
  return g;
}

const forearm = (s: Side) => `self.foreArm${s < 0 ? 'R' : 'L'}`;
const palm = (s: Side) => `self.hand${s < 0 ? 'R' : 'L'}`;

/**
 * Bàn tay người `clad` giữ dáng `pose` (thường là `grip`) đè góc ngón của hành động, `undefined` là trả về dáng hành động
 * đặt; người que không có bàn tay thì không làm gì
 */
export function grip(fig: Figure, side: Side, pose: HandPose | undefined) {
  const h = fig.hands?.[side];
  if (!h) return;
  h.held = pose;
  h.fit = undefined;
  poseHand(h);
}

const _w = new THREE.Matrix4(), _rel = new THREE.Matrix4(), _p = new THREE.Vector3(), _rq = new THREE.Quaternion(), _s = new THREE.Vector3(), _r3 = new THREE.Matrix3();

/**
 * Ngón ôm theo đồ (`heldFit` của lõi) cho các bàn tay đang cầm cứng một món có hình va chạm (`shape`): đo chỗ món trong
 * khung bàn tay từ ma trận thế giới rồi đặt độ gập thêm từng đốt lên dáng của kiểu cầm. Gọi sau khi người, món đã đặt
 * xong ở khung đang vẽ; tất định theo khung ấy. docs/01-rig.md#ngón-ôm-theo-đồ
 */
export function fitHolding(fig: Figure) {
  for (const side of [-1, 1] as Side[]) {
    const h = fig.hands?.[side], e = fig.holding?.[side];
    if (!h) continue;
    if (!e?.spec?.shape || !e.hand || !h.held) {
      if (h.fit) {
        h.fit = undefined;
        poseHand(h);
      }
      continue;
    }
    const wrist = fig.arms[side].wrist;
    e.object.updateWorldMatrix(true, false);
    wrist.updateWorldMatrix(true, false);
    _rel.copy(_w.copy(wrist.matrixWorld).invert()).multiply(e.object.matrixWorld);
    _rel.decompose(_p, _rq, _s);
    const R = _r3.setFromMatrix4(_w.makeRotationFromQuaternion(_rq)).transpose().elements;
    const G = { R: [...R] as [number, number, number, number, number, number, number, number, number], p: [_p.x, _p.y, _p.z] as [number, number, number], u: 0.01 * _s.x };
    h.fit = heldFit({ v: [0, 0, ...fingerVec(HAND_POSES[h.held])], side, k: h.scale, long: h.long, shape: e.spec.shape, G, wrap: e.hand.wrap });
    poseHand(h);
  }
}

/**
 * Cầm `object` bằng một tay hay hai tay. Vật dựng ở gốc khung cầm (xem `HoldOptions`), cỡ theo người cao 4,3; nó
 * nằm trong `root` nên to nhỏ theo `root.scale`. Tự bám theo tư thế mỗi khung, `release()` gỡ ra. Nhóm cầm khai
 * `userData.touch` cẳng tay và bàn tay cầm của người cầm: `collide` không báo chúng lún vào vật. Người `clad` giữ dáng `pose`
 * (mặc định `grip`) ở ngón tới khi `release()`.
 */
export function hold(fig: Figure, object: THREE.Object3D, o: HoldOptions): Held {
  if (o.grip) return holdGrip(fig, object, o.hand, o.grip, o);
  const holder = gripped(object, o);
  const sides: Side[] = o.hand === 'both' ? [-1, 1] : [o.hand];
  holder.userData.touch = sides.flatMap((s) => [forearm(s), palm(s)]);
  const pose = o.pose ?? 'grip';
  const entry: Holding = { object, pose, follow: o.follow ?? (o.hand === 'both' ? 'level' : 'wrist'), both: o.hand === 'both', offset: o.offset, rotate: o.rotate };
  for (const s of sides) {
    grip(fig, s, pose);
    (fig.holding ??= {})[s] = entry;
  }
  const held: Held = {
    object, span: 0,
    release: () => {
      carrier.removeFromParent();
      for (const s of sides) {
        grip(fig, s, undefined);
        if (fig.holding?.[s] === entry) delete fig.holding[s];
      }
    },
  };
  let carrier: THREE.Object3D;
  if (o.hand !== 'both' && (o.follow ?? 'wrist') === 'wrist') {
    // đồ ngồi ở tâm nắm của dáng đang giữ: dời trong khung chỗ treo
    carrier = new THREE.Group();
    carrier.position.set(...shiftOf(fig, o.hand, pose));
    carrier.add(holder);
    fig.sockets.hand[o.hand].add(carrier);
    return held;
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const side = o.hand;
  carrier = new Follow((g) => {
    if (side !== 'both') {
      g.position.copy(handTip(fig, side, a, pose));
      g.quaternion.identity();
      return;
    }
    handTip(fig, -1, a, pose);
    handTip(fig, 1, b, pose);
    held.span = a.distanceTo(b);
    x.subVectors(b, a);
    if (o.follow !== 'tilt') x.y = 0;
    if (x.lengthSq() < 1e-10) x.set(1, 0, 0);
    x.normalize();
    y.copy(UP).addScaledVector(x, -x.dot(UP)).normalize();
    z.crossVectors(x, y);
    g.position.addVectors(a, b).multiplyScalar(0.5);
    g.quaternion.setFromRotationMatrix(m.makeBasis(x, y, z));
  });
  carrier.add(holder);
  fig.root.add(carrier);
  return held;
}

/** Bên giải phẫu của `lead` (`right` là tay phải, `-1`) */
const sideOf = (lead: 'right' | 'left'): Side => (lead === 'right' ? -1 : 1);

/** Ý định mặc định của kiểu cầm ra `userData.hold` cho `check` (chỉ phần đo được: `up`, `face` về mặt người cầm hay ống kính) */
export function gripIntent(spec: HeldItemSpec, g: GripSpec): HeldIntent | undefined {
  const i = g.intent;
  if (!i) return undefined;
  const up = i.up ?? (i.face?.toward === 'up' ? i.face.axis : undefined);
  if (up !== undefined) return { up: heldAxis(spec, up) };
  const t = i.face?.toward;
  if (i.face && (t === 'camera' || t === 'holderFace')) return { face: heldAxis(spec, i.face.axis), faceToward: t };
  return undefined;
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _y = new THREE.Vector3();

/**
 * Nhóm mang món của kiểu cầm cứng: tĩnh trong khung chỗ treo, chỉ xoay các nhóm con `hang` của món theo trọng lực mỗi lần
 * three tính ma trận (trục y của nhóm ấy về thẳng đứng, quay ít nhất)
 */
class Carrier extends THREE.Group {
  private busy = false;
  constructor(private hang: { node: THREE.Object3D; rest: THREE.Quaternion }[]) {
    super();
  }
  private level() {
    if (this.busy || !this.hang.length || !this.parent) return;
    this.busy = true;
    this.updateMatrix();
    this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    for (const { node, rest } of this.hang) {
      // ma trận thế giới của cha nhóm treo: nhân dọc đường từ món xuống, không gọi lại `updateWorldMatrix`
      const chain: THREE.Object3D[] = [];
      for (let p = node.parent; p && p !== this; p = p.parent) chain.unshift(p);
      _m4.copy(this.matrixWorld);
      for (const p of chain) {
        p.updateMatrix();
        _m4.multiply(p.matrix);
      }
      _m4.decompose(_y, _q, new THREE.Vector3());
      _q2.multiplyQuaternions(_q, rest);
      _y.set(0, 1, 0).applyQuaternion(_q2);
      const fix = new THREE.Quaternion().setFromUnitVectors(_y.normalize(), new THREE.Vector3(0, 1, 0));
      node.quaternion.copy(_q.invert().multiply(fix.multiply(_q2)));
    }
    this.busy = false;
  }
  override updateMatrixWorld(force?: boolean) {
    this.level();
    super.updateMatrixWorld(force);
  }
  override updateWorldMatrix(updateParents: boolean, updateChildren: boolean) {
    if (updateParents) this.parent?.updateWorldMatrix(true, false);
    this.level();
    super.updateWorldMatrix(false, updateChildren);
  }
}

/**
 * Cầm cứng theo kiểu cầm `g`: món treo vào chỗ treo của bàn tay chính bằng liên kết của kiểu cầm, tính theo cỡ bàn tay của
 * người (người que không có bàn tay thì điểm nắm ở mút nét). Kiểu cầm hai tay (`both`): món theo tay `both.lead`, tay kia
 * giữ dáng `both.other.pose` — chỗ của tay ấy là việc của bộ giải (`world.hands[].hold`)
 */
function holdGrip(fig: Figure, object: THREE.Object3D, hand: Side | 'both', g: HoldGrip, o: HoldOptions): Held {
  if (o.follow || o.offset || o.rotate || o.pose)
    throw new Error(`\`hold\`: kiểu cầm \`${g.item}#${g.grip}\` không đi cùng \`follow\`, \`offset\`, \`rotate\`, \`pose\``);
  const spec = heldGrip(g.spec, g.grip, g.item);
  if (hand === 'both' && !spec.both) throw new Error(`\`hold\`: \`${g.item}#${g.grip}\` không phải kiểu cầm hai tay`);
  const lead: Side = spec.both ? sideOf(spec.both.lead) : (hand as Side);
  const other = -lead as Side;
  const h = fig.hands?.[lead];
  const gh = gripHand(spec, lead);
  const G = gripFrame(g.spec, gh, lead, h?.scale ?? 1, h?.long ?? h?.scale ?? 1);
  const socket = fig.sockets.hand[lead];
  // khung chỗ treo dời khỏi cổ tay bấy nhiêu; người que không có bàn tay thì điểm nắm của món đặt ngay chỗ treo
  const p = new THREE.Vector3(...G.p).sub(h ? socket.position : new THREE.Vector3(...gripCenter(gh.pose, lead)));
  const hang = (g.spec.hang ?? []).flatMap((n) => {
    const node = object.getObjectByName(n);
    return node ? [{ node, rest: node.quaternion.clone() }] : [];
  });
  const carrier = new Carrier(hang);
  carrier.position.copy(p);
  _m4.set(G.R[0], G.R[1], G.R[2], 0, G.R[3], G.R[4], G.R[5], 0, G.R[6], G.R[7], G.R[8], 0, 0, 0, 0, 1);
  carrier.quaternion.setFromRotationMatrix(_m4);
  const sides: Side[] = spec.both ? [lead, other] : [lead];
  carrier.userData.touch = [...sides.flatMap((s) => [forearm(s), palm(s)]), ...(spec.touch ?? [])];
  carrier.add(object);
  socket.add(carrier);
  const intent = gripIntent(g.spec, spec);
  if (intent) object.userData.hold = intent;
  const entries = new Map<Side, Holding>();
  for (const s of sides) {
    const hand = s === lead ? gh : spec.both!.other;
    const pose = hand.pose;
    const entry: Holding = { object, item: g.item, grip: g.grip, spec: g.spec, hand, pose, follow: 'wrist', both: !!spec.both };
    entries.set(s, entry);
    grip(fig, s, pose);
    (fig.holding ??= {})[s] = entry;
  }
  if (g.spec.shape) fitHolding(fig);
  return {
    object, span: 0,
    release: () => {
      carrier.removeFromParent();
      for (const { node, rest } of hang) node.quaternion.copy(rest);
      for (const s of sides) {
        grip(fig, s, undefined);
        if (fig.holding && fig.holding[s] === entries.get(s)) delete fig.holding[s];
      }
    },
  };
}

/**
 * Gắn `object` vào khung đầu hay ngực (`crown`, `face`, `chest`); vật dựng ở gốc khung, theo đầu và thân. Nhóm gắn khai
 * `userData.touch` đầu (hay thân) của người đội: `collide` không báo đầu lún vào mũ.
 */
export function wear(fig: Figure, slot: 'crown' | 'face' | 'chest', object: THREE.Object3D) {
  const g = new THREE.Group();
  g.userData.touch = [slot === 'chest' ? 'self.torso' : 'self.head'];
  fig.sockets[slot].add(g.add(object));
  return () => g.removeFromParent();
}

/** Khung trên mặt áo ở điểm `x`, `y` của hệ nhóm thân (three, y lên từ hông): +z là pháp tuyến ra ngoài, y lên. */
export function torsoSocket(fig: Figure, x: number, y: number) {
  const spine = fig.spine;
  const g = new THREE.Group();
  const shells = spine.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && !c.userData.noShadow && !c.userData.limb);
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1));
  // tia trong hệ thân: các mảnh áo là con trực tiếp của thân nên chỉ cần ma trận cục bộ của chúng
  let best: { p: THREE.Vector3; n: THREE.Vector3 } | undefined;
  for (const mesh of shells) {
    const inv = mesh.matrix.clone().invert();
    const local = new THREE.Ray(ray.ray.origin.clone().applyMatrix4(inv), ray.ray.direction.clone().transformDirection(inv));
    const r = new THREE.Raycaster(local.origin, local.direction);
    const probe = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const hit = r.intersectObject(probe)[0];
    if (!hit?.face) continue;
    const p = hit.point.applyMatrix4(mesh.matrix);
    if (best && p.z <= best.p.z) continue;
    let n = hit.face.normal.clone().transformDirection(mesh.matrix);
    if (n.z < 0) n = n.negate();
    best = { p, n };
  }
  const p = best?.p ?? new THREE.Vector3(x, y, 0.15), n = best?.n ?? new THREE.Vector3(0, 0, 1);
  const xa = new THREE.Vector3().crossVectors(UP, n);
  if (xa.lengthSq() < 1e-8) xa.set(1, 0, 0);
  xa.normalize();
  const ya = new THREE.Vector3().crossVectors(n, xa);
  g.position.copy(p);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, ya, n));
  spine.add(g);
  return g;
}

/** Số đo đầu từ khối sọ elip `skull` (bán trục) và các đỉnh vỏ tóc trong hệ đầu */
export function headFit(skull: THREE.Vector3, hairShell: ArrayLike<number>[], eyeOffset: number): HeadFit {
  const r = skull.x, ry = skull.y;
  const pts: [number, number][] = [];
  let hairTop = -Infinity;
  for (const a of hairShell)
    for (let i = 0; i + 2 < a.length; i += 3) {
      pts.push([Math.hypot(a[i], a[i + 2]), a[i + 1]]);
      hairTop = Math.max(hairTop, a[i + 1]);
    }
  const eye = (-eyeOffset * R.head * (skull.y / R.head)) / 65;
  const ue = eye / ry;
  return {
    r,
    top: Math.max(ry, hairTop),
    eye,
    front: skull.z * Math.sqrt(Math.max(0, 1 - ue * ue)),
    rest(radius) {
      let y = radius < r ? ry * Math.sqrt(1 - (radius / r) ** 2) : 0;
      for (const [d, h] of pts) if (d >= radius && h > y) y = h;
      return y;
    },
  };
}

/** Dựng các khung gắn đồ của người vừa dựng; `grip` là chỗ treo đồ cầm trong khung cổ tay. `stickman` gọi */
export function buildSockets(fig: Pick<Figure, 'root' | 'spine' | 'head' | 'arms'>, head: HeadFit, grip: (s: Side) => Vec3, rig: { height: number; shoulderHalf: number; shoulderDrop: number }): Sockets {
  const hand = {} as Record<Side, THREE.Group>;
  for (const s of [-1, 1] as const) {
    const g = new THREE.Group();
    g.position.set(...grip(s));
    g.name = s < 0 ? 'handRight' : 'handLeft';
    fig.arms[s].wrist.add(g);
    hand[s] = g;
  }
  const crown = new THREE.Group();
  crown.position.y = head.top;
  fig.head.add(crown);
  const face = new THREE.Group();
  face.position.set(0, head.eye, head.front);
  fig.head.add(face);
  fig.root.updateMatrixWorld(true);
  // túi ngực trái: giữa vai và cổ, dưới vai một khoảng bằng chừng ba nét tay
  const chest = torsoSocket(fig as Figure, (rig.shoulderHalf / 100) * 0.45, (RIG.torso * rig.height - rig.shoulderDrop) / 100 - 0.26);
  return { hand, crown, face, chest, head };
}

/**
 * Vật gọi tên trong `items` của JSON nhân vật dựng ra; `hold` bỏ trống thì đồ tay cầm cứng theo cổ tay. `hold.grip` là kiểu
 * cầm cứng (`HoldGrip`): kiểu cầm hai tay thì món theo tay `both.lead` của nó dù cắm ở socket tay nào
 */
export interface ItemBuild {
  object: THREE.Object3D;
  hold?: Omit<HoldOptions, 'hand'> & { both?: boolean };
  /** Phần tóc dựng khối giấu đi khi đang đội (mũ đè lọn gai); người `lod: 'low'` đã gộp tóc nên không giấu được */
  hideHair?: readonly ('shell' | 'spikes' | 'hang')[];
}
export interface ItemContext {
  name: string;
  socket: SocketName;
  /** Cấu hình socket ấy trong `items[name]` của JSON nhân vật, nếu có */
  piece?: unknown;
  fig: Figure;
}
/** Bảng tên vật → hàm dựng, do repo video cấp; package không chứa đồ của tập phim nào */
export type ItemFactory = (ctx: ItemContext) => THREE.Object3D | ItemBuild;
export type ItemFactories = Record<string, ItemFactory>;
/** Socket → tên vật (`equipMap` của @stickman3d/sketch): `null`, `"base"` hay thiếu khoá là để trống */
export type EquipState = Partial<Record<string, string | null | undefined>>;

interface Worn { name: string; side?: Side; release(): void }
export interface Gear {
  items: ItemFactories;
  /** `items` của JSON nhân vật: tên vật → socket → cấu hình */
  specs: Record<string, Partial<Record<string, unknown>>>;
  worn: Map<SocketName, Worn>;
  built: Map<string, ItemBuild>;
}

export const newGear = (items: ItemFactories = {}, specs: Gear['specs'] = {}): Gear => ({ items, specs, worn: new Map(), built: new Map() });

/**
 * Mặc đồ theo `equip` (socket → tên vật, như `equipMap(nhânVật, sceneAt(...).equip)` của @stickman3d/sketch). `flip` của
 * `world` chọn tay: `handNear` là tay phải khi không lật, như `act`. Vật dựng một lần bằng bảng `items` của người
 * rồi giữ lại; tên không có trong bảng thì socket để trống. Gọi mỗi khung được, không đổi gì thì không làm gì.
 */
export function dress(fig: Figure, equip: EquipState, flip = false) {
  const gear = fig.gear;
  const near: Side = flip ? 1 : -1;
  for (const socket of SOCKET_NAMES) {
    const v = equip[socket];
    const name = typeof v === 'string' && v !== 'base' && gear.items[v] ? v : undefined;
    const side = socket === 'handNear' ? near : socket === 'handFar' ? (-near as Side) : undefined;
    const cur = gear.worn.get(socket);
    if (cur && cur.name === name && cur.side === side) continue;
    cur?.release();
    gear.worn.delete(socket);
    if (!name) continue;
    const key = `${name}/${socket}`;
    let b = gear.built.get(key);
    if (!b) {
      const made = gear.items[name]({ name, socket, piece: gear.specs[name]?.[socket], fig });
      b = made instanceof THREE.Object3D ? { object: made } : made;
      gear.built.set(key, b);
    }
    let release: () => void;
    if (side !== undefined) {
      const { both, ...h } = b.hold ?? {};
      release = hold(fig, b.object, { ...h, hand: both ? 'both' : side }).release;
    } else release = wear(fig, socket === 'faceAcc' ? 'face' : socket === 'chest' ? 'chest' : 'crown', b.object);
    if (b.hideHair?.length) {
      const hidden: THREE.Object3D[] = [];
      fig.head.traverse((o) => b!.hideHair!.includes(o.userData.hair) && o.visible && hidden.push(o.parent!));
      for (const o of hidden) o.visible = false;
      const off = release;
      release = () => {
        off();
        for (const o of hidden) o.visible = true;
      };
    }
    gear.worn.set(socket, { name, side, release });
  }
}
