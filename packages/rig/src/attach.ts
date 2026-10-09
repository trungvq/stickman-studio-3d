import * as THREE from 'three';
import { R, type Figure, type Side } from './stickman';

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
 * Khung gắn đồ. `hand[side]` treo ở đầu cẳng tay: −y dọc cẳng tay ra ngoài, gốc ở mút nét tay. `crown` ở đỉnh đầu
 * kể cả tóc, `face` ở mặt trước sọ ngang mắt, `chest` trên mặt áo, +z là pháp tuyến ra ngoài, y lên.
 */
export interface Sockets {
  hand: Record<Side, THREE.Group>;
  crown: THREE.Group;
  face: THREE.Group;
  chest: THREE.Group;
  head: HeadFit;
}

/**
 * Cách cầm. `wrist`: đi cứng theo cổ tay. `level`: đặt ở cổ tay nhưng đứng thẳng, quay theo hướng người (cốc,
 * khay). Hai tay (`hand: 'both'`): gốc ở giữa hai mút tay, x từ tay phải sang tay trái; `level` giữ mặt ngang (khay),
 * `tilt` nghiêng theo chênh cao hai tay (báo, laptop).
 */
export interface HoldOptions {
  hand: Side | 'both';
  follow?: 'wrist' | 'level' | 'tilt';
  /** Dời vật trong khung cầm, đơn vị three của người cao 4,3 */
  offset?: readonly [number, number, number];
  /** Xoay vật trong khung cầm, độ, thứ tự XYZ */
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

const handTip = (fig: Figure, side: Side, out: THREE.Vector3) => {
  const s = fig.sockets.hand[side];
  s.updateWorldMatrix(true, false);
  return fig.root.worldToLocal(s.getWorldPosition(out));
};

/** Vật trong nhóm dời/xoay theo `offset`, `rotate`; trả nhóm ấy */
function gripped(object: THREE.Object3D, o: HoldOptions) {
  const g = new THREE.Group();
  if (o.offset) g.position.set(...o.offset);
  if (o.rotate) g.rotation.set(o.rotate[0] * D, o.rotate[1] * D, o.rotate[2] * D);
  g.add(object);
  return g;
}

/**
 * Cầm `object` bằng một tay hay hai tay. Vật dựng ở gốc khung cầm (xem `HoldOptions`), cỡ theo người cao 4,3; nó
 * nằm trong `root` nên to nhỏ theo `root.scale`. Tự bám theo tư thế mỗi khung, `release()` gỡ ra.
 */
export function hold(fig: Figure, object: THREE.Object3D, o: HoldOptions): Held {
  const grip = gripped(object, o);
  const held: Held = { object, span: 0, release: () => carrier.removeFromParent() };
  let carrier: THREE.Object3D;
  if (o.hand !== 'both' && (o.follow ?? 'wrist') === 'wrist') {
    carrier = grip;
    fig.sockets.hand[o.hand].add(grip);
    return held;
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const side = o.hand;
  carrier = new Follow((g) => {
    if (side !== 'both') {
      g.position.copy(handTip(fig, side, a));
      g.quaternion.identity();
      return;
    }
    handTip(fig, -1, a);
    handTip(fig, 1, b);
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
  carrier.add(grip);
  fig.root.add(carrier);
  return held;
}

/** Gắn `object` vào khung đầu hay ngực (`crown`, `face`, `chest`); vật dựng ở gốc khung, theo đầu và thân. */
export function wear(fig: Figure, slot: 'crown' | 'face' | 'chest', object: THREE.Object3D) {
  fig.sockets[slot].add(object);
  return () => object.removeFromParent();
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

/** Dựng các khung gắn đồ của người vừa dựng; `stickman` gọi */
export function buildSockets(fig: Pick<Figure, 'root' | 'spine' | 'head' | 'arms'>, head: HeadFit, limbR: number, rig: { shoulderHalf: number; shoulderDrop: number }): Sockets {
  const hand = {} as Record<Side, THREE.Group>;
  for (const s of [-1, 1] as const) {
    const g = new THREE.Group();
    g.position.y = -limbR;
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
  const chest = torsoSocket(fig as Figure, (rig.shoulderHalf / 100) * 0.45, (120 - rig.shoulderDrop) / 100 - 0.26);
  return { hand, crown, face, chest, head };
}

/** Vật gọi tên trong `items` của JSON nhân vật dựng ra; `hold` bỏ trống thì đồ tay cầm cứng theo cổ tay */
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
