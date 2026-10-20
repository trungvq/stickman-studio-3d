import * as THREE from 'three';
import { R, type Figure, type Side } from './stickman';
import { RIG } from './core/constants';
import { gripShift, type HandPose } from './core/hand';
import { type CarrySpec, type GraspHand, type GripFrame, type HeldItemSpec, type ReachHold } from './core/heldItem';
import { holdHand, holdLinkFrame, isCarryHold } from './core/holdLink';
import { handDims } from './core/heldGeom';
import { carryFrame, carrySpecOf, elbowSeat, type CarryBody } from './core/heldCarry';
import { bodyCapsules } from './collide';
import type { V3 } from './core/lens';
import { heldFit, skinBulge, type FingerRoles } from './core/heldFit';
import { fingerVec, HAND_POSES } from './core/hand';
import type { Vec3 } from './khoi';
import { poseHand, type Hand } from './human';

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

/**
 * Kiểu cầm cứng: món `item` (`held/<món>.json` đã qua `parseHeldItem`), kiểu `grip` của nó. `hold` là lần cầm của cảnh
 * (`world.hands[].hold`): chỗ cầm nhóm (`món@nhóm`) chỉ gắn được qua nó, `grip` là khoá lần cầm
 */
export interface HoldGrip {
  item: string;
  spec: HeldItemSpec;
  grip: string;
  hold?: ReachHold;
}

/**
 * Cách cầm. `grip`: món cứng theo bàn tay bằng liên kết của chỗ cầm nhóm (`holdLinkFrame` của lõi) — dáng ngón, chỗ và
 * hướng món đều do chỗ cầm; không đi cùng `follow`, `offset`, `rotate`, `pose`. Không có `grip` là đường cũ: `wrist` đi cứng theo cổ
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
 * và đo đồ cầm (docs/03-scene.md#đồ-cầm-tay); món khai ý định ở `object.userData.hold` (`HeldIntent` của lõi). Cầm
 * cứng ghi `item`, `grip`
 */
export interface Holding {
  object: THREE.Object3D;
  item?: string;
  grip?: string;
  /** Cầm cứng: JSON món và bàn tay của chỗ cầm cho tay này (tay phụ là `both.other`) — ngón ôm theo đồ đọc */
  spec?: HeldItemSpec;
  hand?: GraspHand;
  pose: HandPose;
  /** Chỗ cầm nhóm: vai trò ngón, tầm cuộn của biến thể cho `heldFit` */
  roles?: FingerRoles;
  curl?: number;
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
  /** Kiểu cầm cứng: liên kết nhóm mang món dựng theo và tâm nắm của dáng (`holdLinkFrame`), tay mang món */
  link?: { G: GripFrame; center: V3; side: Side };
  /** Kiểu cầm cứng: đặt lại `userData.touch` theo mốc `hold` đang hiệu lực (cùng lần cầm, mốc sau khai `touch` khác) */
  retouch?(hold: ReachHold): void;
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
 * đặt; `v` là số bàn tay của dáng hoà (chỗ cầm nhóm), đè dáng tên. Người que không có bàn tay thì không làm gì
 */
export function grip(fig: Figure, side: Side, pose: HandPose | undefined, v?: readonly number[]) {
  const h = fig.hands?.[side];
  if (!h) return;
  h.held = pose;
  h.heldV = pose ? v : undefined;
  h.fit = undefined;
  poseHand(h);
}

const _w = new THREE.Matrix4(), _rel = new THREE.Matrix4(), _p = new THREE.Vector3(), _rq = new THREE.Quaternion(), _s = new THREE.Vector3(), _r3 = new THREE.Matrix3();

/** Ngón ôm đã tính theo bàn tay: khoá là lần cầm, cỡ tay và chỗ món trong khung bàn tay đã lượng tử hoá */
const fits = new WeakMap<Hand, Map<string, readonly number[]>>();
const bulges = new WeakMap<Hand, Map<string, ReturnType<typeof skinBulge>>>();
const FIT_KEEP = 8;
/** Lượng tử của chỗ món trong khung bàn tay: ngón ôm tính trên số đã lượng tử, nên cùng khoá là cùng kết quả dù khung nào tính trước */
const FIT_Q = 1e5;

function remember<T>(memo: WeakMap<Hand, Map<string, T>>, h: Hand, key: string, make: () => T): T {
  let m = memo.get(h);
  if (!m) memo.set(h, (m = new Map()));
  let x = m.get(key);
  if (x === undefined) {
    if (m.size >= FIT_KEEP) m.delete(m.keys().next().value!);
    m.set(key, (x = make()));
  }
  return x;
}

/**
 * Ngón ôm theo đồ (`heldFit` của lõi) cho các bàn tay đang cầm cứng một món có hình va chạm (`shape`): đo chỗ món trong
 * khung bàn tay từ ma trận thế giới rồi đặt độ gập thêm từng đốt lên dáng của lần cầm (chỗ cầm nhóm: theo vai trò ngón).
 * Nhớ theo bàn tay, lần cầm và chỗ món trong khung bàn tay: tay mang món giữ liên kết cố định thì chỉ tính một lần mỗi lần
 * cầm. Gọi sau khi người, món đã đặt xong ở khung đang vẽ; tất định theo khung ấy. docs/01-rig.md#ngón-ôm-theo-đồ
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
    const q = [...R, _p.x, _p.y, _p.z, 0.01 * _s.x].map((x) => Math.round(x * FIT_Q));
    const v = h.heldV ?? [0, 0, ...fingerVec(HAND_POSES[h.held])];
    const key = `${e.item}|${e.grip}|${h.held}|${h.heldV ? v.join() : ''}|${e.curl ?? ''}|${q.join()}`;
    h.fit = remember(fits, h, key, () => {
      const n = q.map((x) => x / FIT_Q);
      const G = { R: n.slice(0, 9) as [number, number, number, number, number, number, number, number, number], p: n.slice(9, 12) as [number, number, number], u: n[12] };
      const roles = e.roles && { roles: e.roles, bulge: remember(bulges, h, v.join(), () => skinBulge(h.skin, v)) };
      return heldFit({ v, side, k: h.scale, long: h.long, shape: e.spec!.shape!, G, wrap: e.hand!.wrap, ...roles, ...(e.curl !== undefined && { curl: e.curl }) });
    });
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

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _y = new THREE.Vector3();

/**
 * Nhóm mang món của lần cầm cứng: tĩnh trong khung chỗ treo, chỉ xoay các nhóm con `hang` của món theo trọng lực mỗi lần
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
 * Cầm cứng theo chỗ cầm nhóm `g`: món treo vào chỗ treo của bàn tay chính bằng liên kết của lần cầm (`holdLinkFrame`), tính
 * theo cỡ bàn tay của người (người que không có bàn tay thì điểm nắm ở mút nét). Cầm hai tay (`both`): món theo tay dẫn, tay
 * kia giữ dáng của nó trên món — chỗ của tay ấy là việc của bộ giải (`world.hands[].hold`)
 */
function holdGrip(fig: Figure, object: THREE.Object3D, hand: Side | 'both', g: HoldGrip, o: HoldOptions): Held {
  const rh: ReachHold = g.hold ?? { item: g.item, grip: g.grip, spec: g.spec, since: 0 };
  const name = rh.grasp ? `${g.item}@${rh.grasp.hold.group}` : `${g.item}${g.grip}`;
  if (o.follow || o.offset || o.rotate || o.pose)
    throw new Error(`\`hold\`: chỗ cầm \`${name}\` không đi cùng \`follow\`, \`offset\`, \`rotate\`, \`pose\``);
  if (isCarryHold(rh)) {
    if (hand === 'both') throw new Error(`\`hold\`: \`${name}\` là món treo, treo trên một tay`);
    return carry(fig, object, { hand, grip: g });
  }
  const dims = (s: Side) => {
    const h = fig.hands?.[s];
    return handDims(h?.scale ?? 1, h?.long ?? h?.scale ?? 1);
  };
  const first: Side = hand === 'both' ? -1 : hand;
  let x = holdHand(rh, first, dims(first));
  if (!x) throw new Error(`\`hold\`: \`${name}\` không cầm bằng bàn tay`);
  if (hand === 'both' && !x.both) throw new Error(`\`hold\`: \`${name}\` không cầm hai tay (\`both\`)`);
  const lead = (x.both ? x.both.lead : first) as Side;
  if (lead !== first) x = holdHand(rh, lead, dims(lead))!;
  const other = -lead as Side;
  const h = fig.hands?.[lead];
  const link = holdLinkFrame(rh, lead, h?.scale ?? 1, h?.long ?? h?.scale ?? 1, 1);
  const G = link.G;
  const socket = fig.sockets.hand[lead];
  // khung chỗ treo dời khỏi cổ tay bấy nhiêu; người que không có bàn tay thì điểm nắm của món đặt ngay chỗ treo
  const p = new THREE.Vector3(...G.p).sub(h ? socket.position : new THREE.Vector3(...link.center));
  const hang = (g.spec.hang ?? []).flatMap((n) => {
    const node = object.getObjectByName(n);
    return node ? [{ node, rest: node.quaternion.clone() }] : [];
  });
  const carrier = new Carrier(hang);
  carrier.position.copy(p);
  _m4.set(G.R[0], G.R[1], G.R[2], 0, G.R[3], G.R[4], G.R[5], 0, G.R[6], G.R[7], G.R[8], 0, 0, 0, 0, 1);
  carrier.quaternion.setFromRotationMatrix(_m4);
  const sides: Side[] = x.both ? [lead, other] : [lead];
  const retouch = (h: ReachHold) => {
    carrier.userData.touch = [...sides.flatMap((s) => [forearm(s), palm(s)]), ...(g.spec.touch ?? []), ...(h.grasp?.hold.touch ?? [])];
  };
  retouch(rh);
  carrier.add(object);
  socket.add(carrier);
  const entries = new Map<Side, Holding>();
  for (const s of sides) {
    const hd = s === lead ? x.hand : x.both!.other;
    const v = s === lead ? x.pose : x.both!.pose;
    const roles = s === lead ? x.roles : x.both!.roles;
    const curl = s === lead ? x.curl : x.both!.curl;
    const entry: Holding = { object, item: g.item, grip: g.grip, spec: g.spec, hand: hd, pose: hd.pose, follow: 'wrist', both: !!x.both, ...(roles && { roles }), ...(curl !== undefined && { curl }) };
    entries.set(s, entry);
    grip(fig, s, hd.pose, v);
    (fig.holding ??= {})[s] = entry;
  }
  if (g.spec.shape) fitHolding(fig);
  return {
    object, span: 0,
    link: { ...link, side: lead },
    retouch,
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

/** Món treo trên một cánh tay (`Figure.carrying[side]`): `carry` ghi, `release` xoá; `check` đo nó (`heldCarries`) */
export interface Carrying {
  object: THREE.Object3D;
  item: string;
  /** Khoá lần cầm `@carry/…` */
  grip: string;
  spec: HeldItemSpec;
  carry: CarrySpec;
  /** Lần đặt gần nhất: góc đẩy khỏi phương đứng (độ), khe thân món tới thân, đùi (đơn vị rig thế giới, âm là lồng) */
  fit?: { swing: number; gap: number; part?: string };
}

/** Chỗ treo của món treo trên người đã đặt dáng, thế giới three: điểm, thanh quai vắt qua, hướng từ thân ra; khuỷu kèm góc */
export interface CarrySeat {
  pivot: THREE.Vector3;
  bar: THREE.Vector3;
  away: THREE.Vector3;
  /** Khuỷu: góc giữa cánh tay trên và cẳng tay (độ, `180` thẳng), cẳng tay ngóc khỏi phương ngang (độ) */
  bend?: number;
  rise?: number;
}

const tag = (s: Side) => (s < 0 ? 'R' : 'L');
const limbR = (j: THREE.Object3D) => ((j.children.find((c) => c.userData.limb) as THREE.Mesh | undefined)?.userData.r as number | undefined) ?? 0;
const shoulderMemo = new WeakMap<Figure, Partial<Record<Side, THREE.Vector3>>>();

/**
 * Điểm đặt quai trên đỉnh vai, hệ thân (`spine`): phía trong khớp vai hơn nửa bán kính cánh tay, trên mặt thân áo (tia
 * dọi từ trên xuống); thân không có lưới thì trên khớp vai một bán kính tay. Đứng yên trong hệ thân nên tính một lần
 */
function shoulderTop(fig: Figure, side: Side): THREE.Vector3 {
  const memo = shoulderMemo.get(fig) ?? {};
  shoulderMemo.set(fig, memo);
  const hit = memo[side];
  if (hit) return hit;
  const sh = fig.arms[side].shoulder, r = limbR(sh);
  const x = sh.position.x - side * r * 0.6, z = sh.position.z;
  let y = sh.position.y + r;
  const shells = fig.spine.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && !c.userData.noShadow && !c.userData.limb);
  const probe = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  let top = -Infinity;
  for (const mesh of shells) {
    const inv = mesh.matrix.clone().invert();
    const o = new THREE.Vector3(x, y + 5, z).applyMatrix4(inv), d = new THREE.Vector3(0, -1, 0).transformDirection(inv);
    probe.geometry = mesh.geometry;
    const h = new THREE.Raycaster(o, d).intersectObject(probe)[0];
    if (h) top = Math.max(top, h.point.applyMatrix4(mesh.matrix).y);
  }
  if (top > -Infinity) y = top;
  return (memo[side] = new THREE.Vector3(x, y, z));
}

/**
 * Chỗ treo `on` trên tay `side` của người ở dáng đang đặt (thế giới three; gọi sau khi ma trận thế giới của
 * người đã tính). Khuỷu: mặt trong chỗ gập (`elbowSeat` của lõi). Vai: đỉnh vai phía trong khớp vai, thanh quai là trục vai
 * ra ngoài. `away` từ trục thân (hông → cổ) ra chỗ treo
 */
export function carrySeat(fig: Figure, side: Side, on: CarrySpec['on']): CarrySeat {
  const w = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
  const k = fig.root.getWorldScale(new THREE.Vector3()).x;
  let seat: CarrySeat;
  if (on === 'elbow') {
    const a = fig.arms[side];
    const v = (o: THREE.Object3D): V3 => w(o).toArray() as V3;
    const e = elbowSeat(v(a.shoulder), v(a.elbow), v(a.wrist), limbR(a.elbow) * k);
    seat = { pivot: new THREE.Vector3(...e.pivot), bar: new THREE.Vector3(...e.bar), away: new THREE.Vector3(), bend: e.bend, rise: e.rise };
  } else {
    seat = {
      pivot: fig.spine.localToWorld(shoulderTop(fig, side).clone()),
      bar: new THREE.Vector3(side, 0, 0).transformDirection(fig.spine.matrixWorld),
      away: new THREE.Vector3(),
    };
  }
  const h = w(fig.hips), n = w(fig.neck), ax = n.clone().sub(h);
  const f = Math.max(0, Math.min(1, seat.pivot.clone().sub(h).dot(ax) / Math.max(1e-9, ax.lengthSq())));
  seat.away.copy(seat.pivot).sub(h.addScaledVector(ax, f));
  if (seat.away.x ** 2 + seat.away.z ** 2 < 1e-10) seat.away.copy(seat.bar);
  return seat;
}

const front = (o: THREE.Object3D): o is THREE.Mesh => {
  const m = o as THREE.Mesh;
  return !!m.isMesh && !m.userData.noShadow && !(Array.isArray(m.material) ? m.material : [m.material]).every((x) => x.side === THREE.BackSide);
};

/** Đám điểm mặt thân áo, khối hông và váy (thế giới three): sát hơn nang dựng từ hộp thân, eo hẹp hơn vai */
function torsoCloud(fig: Figure): number[] {
  const out: number[] = [];
  const v = new THREE.Vector3();
  const take = (m: THREE.Mesh) => {
    const a = m.geometry.attributes.position;
    if (!a) return;
    m.updateWorldMatrix(true, false);
    for (let i = 0; i < a.count; i++) {
      v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld);
      out.push(v.x, v.y, v.z);
    }
  };
  const torso = fig.spine.children.find((c) => c.userData.torso);
  if (torso && front(torso)) take(torso);
  for (const g of [fig.hips.children.find((c) => c.userData.pelvis), fig.skirt?.group])
    g?.traverse((o) => {
      if (front(o) && o.visible) take(o);
    });
  return out;
}

/**
 * Các phần người mà món treo đo tới, thế giới three: mặt thân áo, hông, váy (`torso`, đám điểm) và nang các chi (`thighR`,
 * `upperArmL`…, như `bodyCapsules`); `parts` lọc theo tên phần không kể bên
 */
export function carryBody(fig: Figure, parts?: readonly string[]): CarryBody[] {
  const want = (p: string) => !parts || parts.includes(p);
  const out: CarryBody[] = [];
  if (want('torso')) out.push({ pts: torsoCloud(fig), part: 'torso' });
  const limbs = (['head', 'upperArm', 'foreArm', 'thigh', 'shin', 'hand'] as const).filter(want);
  if (limbs.length)
    for (const c of bodyCapsules(fig, limbs))
      out.push({ a: c.a.toArray() as V3, b: c.b.toArray() as V3, r: c.r, part: `${c.part}${c.side ? tag(c.side) : ''}` });
  return out;
}

/** Nhóm mang món treo: mỗi lần three tính ma trận thì đặt lại theo chỗ treo, trọng lực và thân, đùi của người */
class CarryRig extends THREE.Group {
  private busy = false;
  constructor(private place: (g: THREE.Group) => void) {
    super();
  }
  private run() {
    if (this.busy || !this.parent) return;
    this.busy = true;
    try {
      this.place(this);
    } finally {
      this.busy = false;
    }
  }
  override updateMatrixWorld(force?: boolean) {
    this.run();
    super.updateMatrixWorld(force);
  }
  override updateWorldMatrix(updateParents: boolean, updateChildren: boolean) {
    if (updateParents) this.parent?.updateWorldMatrix(true, false);
    this.run();
    super.updateWorldMatrix(false, updateChildren);
  }
}

const _cm = new THREE.Matrix4(), _ci = new THREE.Matrix4();

/**
 * Treo `object` trên cánh tay theo `món@carry` (`carrySpecOf`, `on: elbow | shoulder`): đỉnh quai (`at`) ở chỗ treo (`carrySeat`), thân
 * món thõng theo trọng lực, đẩy khỏi thân và đùi (`carryFrame` của lõi) — đặt lại mỗi lần three tính ma trận. Bàn tay của tay
 * ấy không đổi dáng, `Figure.holding` không đổi; `Figure.carrying[side]` ghi lần treo. Vật dựng ở gốc khung món như món
 * cầm. docs/11-nhom-cam.md mục 3
 */
export function carry(fig: Figure, object: THREE.Object3D, o: { hand: Side; grip: HoldGrip }): Held {
  const side = o.hand, g = o.grip, grasp = g.hold?.grasp;
  const name = grasp ? `${g.item}@${grasp.hold.group}` : `${g.item}${g.grip}`;
  const spec = grasp && carrySpecOf(g.spec, g.hold!);
  if (!spec) throw new Error(`\`carry\`: \`${name}\` không phải \`món@carry\` — cầm bằng bàn tay thì dùng \`hold\``);
  if (!g.spec.shape) throw new Error(`\`carry\`: \`${g.item}\` cần \`shape\` cho món treo`);
  const entry: Carrying = { object, item: g.item, grip: g.grip, spec: g.spec, carry: spec };
  const rig = new CarryRig((c) => {
    const root = fig.root;
    // ma trận thế giới của cả người (nhóm này đang bận nên không tự đặt lại giữa chừng)
    root.updateWorldMatrix(true, true);
    const k = root.getWorldScale(new THREE.Vector3()).x;
    const seat = carrySeat(fig, side, spec.on);
    const fit = carryFrame({
      item: g.spec, grip: spec, pivot: seat.pivot.toArray() as V3, bar: seat.bar.toArray() as V3, away: seat.away.toArray() as V3,
      u: 0.01 * k, body: carryBody(fig, ['torso', 'thigh']),
      // tay luồn ngoài túi đeo vai: cánh tay trên cùng bên ép túi vào thân
      ...(spec.on === 'shoulder' && { outer: carryBody(fig, ['upperArm']).filter((b) => b.part === `upperArm${tag(side)}`) }),
    });
    const { R, p } = fit.G;
    _cm.set(R[0] * k, R[1] * k, R[2] * k, p[0], R[3] * k, R[4] * k, R[5] * k, p[1], R[6] * k, R[7] * k, R[8] * k, p[2], 0, 0, 0, 1);
    _ci.copy(root.matrixWorld).invert().multiply(_cm).decompose(c.position, c.quaternion, c.scale);
    entry.fit = { swing: fit.swing, gap: fit.gap * k, ...(fit.part && { part: fit.part }) };
  });
  const t = tag(side);
  rig.userData.touch = [`self.upperArm${t}`, `self.foreArm${t}`, ...(spec.on === 'shoulder' ? ['self.torso'] : []), ...(spec.touch ?? [])];
  rig.add(object);
  fig.root.add(rig);
  (fig.carrying ??= {})[side] = entry;
  return {
    object, span: 0,
    release: () => {
      rig.removeFromParent();
      if (fig.carrying?.[side] === entry) delete fig.carrying[side];
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
 * Vật gọi tên trong `items` của JSON nhân vật dựng ra; `hold` bỏ trống thì đồ tay cầm cứng theo cổ tay. `hold.grip` là chỗ
 * cầm nhóm (`HoldGrip`): cầm hai tay thì món theo tay dẫn của lần cầm dù cắm ở socket tay nào
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
