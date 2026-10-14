import { D, RIG, TORSO_DEPTH } from "./constants";
import { chibiShape } from "./face";
import { lengths } from "./geometry";
import {
  HAND_BONES,
  HAND_REST,
  handFrames,
  handGrip,
  handPoint,
  wristTurn,
  type HandPiece,
} from "./hand";
import { faceSurface, HUMAN_HEAD, humanEar, humanSkull, SKULL3 } from "./humanHead";
import { REACH_ELBOW } from "./ik";
import {
  fromColumns,
  matMul as mm,
  matVec as mv,
  rotX as rx,
  rotY as ry,
  rotZ as rz,
  type M3,
  type V3,
} from "./lens";
import {
  isOtherHand,
  type Aim,
  type AimDir,
  type HandPoint,
  type BodyMark,
  type ReachTerm,
} from "./bodyMark";
import {
  defaultCharacter,
  limbWidths,
  wornPalette,
  type CharacterData,
  type Garment,
  type Skirt,
} from "./schema";
import { profileAt, skirtSide, wornSkirt } from "./skirtShape";
import {
  BELLY,
  bellyAt,
  garmentOf,
  garmentShoulder,
  garmentSocket,
  profile,
  type P2,
  type Rig,
} from "./torso";

/**
 * Khung xương của người 3D (`stickman.ts`) ở `rig.height`, đơn vị three: thân, cổ, tay, chân là `lengths(height)` của lõi
 * chia 100 — `world.hip` của `sceneAt` đặt hông theo chính chúng, lệch là chân trượt hay lơ lửng. Đầu, bề dày nét chi không
 * nhân. `act` và `actJoints` đọc cùng bảng này — `act3.test.ts` giữ hai bên trùng nhau. docs/01-rig.md#khớp-người-3d-vẽ-ra
 */
export function bones3(height = 1) {
  const L = lengths(height);
  return {
    height,
    torso: L.torso / 100,
    neck: L.neck / 100,
    head: 0.64,
    upperArm: L.upperArm / 100,
    foreArm: L.foreArm / 100,
    thigh: L.thigh / 100,
    shin: L.shin / 100,
    limb: 0.042,
  };
}

export type Bones3 = ReturnType<typeof bones3>;

/** Khung xương ở `height = 1` */
export const BONES3: Readonly<Bones3> = bones3();

/** Tay choãi khỏi thân áo, radian quanh trục tiến; đích cổ tay thì không. Người mặc đồ tay to: `roots3` */
export const SPLAY3 = 0.08;

/** Khe giữa sườn áo và cánh tay buông của người mặc đồ, px */
export const CLAD_GAP = 2;

/** Cổ lộ ra giữa cằm và cổ áo của đầu `human`, đơn vị three */
export const HUMAN_NECK = 0.1;

/**
 * Đáy sọ trên mép cổ áo: tâm khối đầu cao hơn khớp cổ ngần này, đơn vị three; đầu `human` cao thêm `HUMAN_NECK`. Chỉ
 * đoạn cổ nhân `height`
 */
export const head3 = (B: Bones3, human = false) =>
  B.neck + 0.09 + (human ? HUMAN_NECK : 0) + B.head * 1.04;

/**
 * Bán kính chi người 3D mặc đồ (`palette.clad`) ở gốc, khớp giữa, ngọn, nhân bán kính chi: bắp tay to hơn cẳng tay
 * như đùi với ống chân
 */
export const CLAD_TAPER = {
  arm: [1.12, 0.88, 0.74],
  leg: [1.35, 0.9, 0.74],
} as const;

/** Bán kính gốc ống cánh tay của người mặc đồ, px: `limbHalf` của lõi nhân `CLAD_TAPER` */
export const cladArm = (sleeveWidth: number, stroke: number) =>
  ((sleeveWidth + stroke) / 2) * CLAD_TAPER.arm[0];

/** Bán kính gốc đùi của người mặc đồ, px: `limbHalf` của lõi nhân `CLAD_TAPER`, như `cladArm` */
export const cladThigh = (trouserWidth: number, stroke: number) =>
  ((trouserWidth + stroke) / 2) * CLAD_TAPER.leg[0];

/** Nửa bề sâu thân người mặc đồ, nhân nửa rộng: dày hơn `TORSO_DEPTH` của người que */
export const CLAD_DEPTH = 0.95;

/**
 * Tay buông của người mặc đồ, px của nhóm thân (y xuống): tâm gốc vai `at`, bán kính nắp vai `cap`, góc choãi `splay`
 * (rad), bán kính ống ở vai, khuỷu, cổ tay `r`, độ dài hai đoạn `len`; `side` là nửa rộng sườn áo dưới nách (`armSide` ở
 * khuỷu)
 */
export interface ArmRoom {
  at: readonly [number, number];
  cap: number;
  splay: number;
  r: readonly [number, number, number];
  len: readonly [number, number];
  side: number;
}

/** Mép trong cánh tay buông ở độ cao `y` trừ một `CLAD_GAP`, px; trên vai là `-Infinity` */
export function armInner(room: Omit<ArmRoom, "side">, y: number) {
  const { at, splay, r, len } = room;
  const c = Math.cos(splay);
  const t = (y - at[1]) / c;
  if (t < 0) return -Infinity;
  const rr =
    t < len[0]
      ? r[0] + ((r[1] - r[0]) * t) / len[0]
      : t < len[0] + len[1]
        ? r[1] + ((r[2] - r[1]) * (t - len[0])) / len[1]
        : r[2];
  return at[0] + t * Math.sin(splay) - rr / c - CLAD_GAP;
}

/** Nửa rộng tối đa của thân người mặc đồ ở `y`: `side` tới ngang khuỷu, dưới đó nở theo mép trong cẳng tay */
export const armSide = (room: ArmRoom, y: number) => Math.max(room.side, armInner(room, y));

/**
 * Mặt cắt thân áo của người mặc đồ: dưới tâm gốc vai sườn áo lùi về `armSide`, chuyển êm trong bán kính nắp vai — tay
 * buông theo `roots3` nằm ngoài thân, không lấn vào; dưới khuỷu thân được nở theo tay nên hông rộng thành dáng quả lê.
 * `depth` là nửa bề sâu từng hàng: `CLAD_DEPTH` lần nửa rộng nhưng không quá `CLAD_DEPTH · armSide`, nên vai rộng mà
 * mỏng, ngực và lưng phẳng một mạch, nhìn ngang không gù
 */
export function cladProfile(pts: readonly P2[], room: ArmRoom): { pts: P2[]; depth: number[] } {
  const out = pts.map(([a, y]): P2 => {
    const u = Math.max(0, Math.min(1, (y - room.at[1]) / room.cap));
    const lim = armSide(room, y);
    return [a > lim ? a + (lim - a) * u * u * (3 - 2 * u) : a, y];
  });
  return { pts: out, depth: out.map(([a, y]) => CLAD_DEPTH * Math.min(a, armSide(room, y))) };
}

/** Bàn tay xoè cỡ `1` dài chừng này, đơn vị three; xoè không dài quá `OPEN_REACH` cẳng tay */
const OPEN_LEN = 0.19;
const OPEN_REACH = 0.55;

/** Cỡ bàn tay người mặc đồ theo bán kính cổ tay `rw` (three): nhân vào bề ngang `HAND_BONES` (`handFrames`, `handRig`) */
export const handScale = (rw: number) => Math.max(1, rw / 0.048);

/** Cỡ dọc của bàn tay xoè cỡ `k` trên cẳng tay dài `foreArm` (three): chi to mà ngắn thì găng tròn lại, không dài tới gối */
export const openLength = (k: number, foreArm: number) =>
  Math.min(k, Math.max(1, (OPEN_REACH * foreArm) / OPEN_LEN));

/** Bàn tay của người mặc đồ tay bề dày `sleeve`: cỡ `k`, cỡ dọc khi xoè `long` và độ dài khi xoè, px */
export function cladHand(sleeve: number, stroke: number, foreArm: number) {
  const k = handScale(((sleeve + stroke) / 200) * 0.8);
  const long = openLength(k, foreArm / 100);
  return { k, long, length: OPEN_LEN * long * 100 };
}

/** Người 3D mà `roots3` đặt tay: `palette.clad`, bề dày tay chân (`limbWidths`), `palette.bicep`, váy dựng khối đang mặc */
export interface Build3 {
  clad?: boolean;
  sleeve: number;
  trouser: number;
  bicep?: number;
  skirt?: Skirt;
  /** `palette.sleeveFlare`, `palette.sleeveLength`: tay áo loe phủ ngoài tay */
  flare?: number;
  sleeveLength?: number;
}

/** Ống tay áo loe rộng hơn ống tay bấy nhiêu lần trước khi cộng phần loe */
export const SLEEVE_EASE = 1.1;

/**
 * Tay áo loe (`palette.sleeveFlare`) phủ `f` phần tay từ vai, hai đoạn dài `len`: bán kính cộng thêm ngoài
 * `SLEEVE_EASE` lần ống tay ở khoảng `s` px dọc tay tính từ vai — tăng đều từ `0` ở vai tới `flare` ở miệng tay
 */
export const sleeveGrow = (flare: number, f: number, len: readonly [number, number], s: number) =>
  (flare * Math.min(s, f * (len[0] + len[1]))) / Math.max(1e-6, f * (len[0] + len[1]));

/** Góc choãi nhỏ nhất từ `SPLAY3` mà `fits` nhận, chia đôi tới `1.2` radian */
function widen(fits: (splay: number) => boolean) {
  if (fits(SPLAY3)) return SPLAY3;
  let [lo, hi] = [SPLAY3, 1.2];
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * Cẳng tay và bàn tay buông (dài thêm `hand` px sau cổ tay) nằm ngoài hình bao `side` của váy: mép trong cách mặt váy
 * một `CLAD_GAP` từ ngang khuỷu tới đầu bàn tay. Hai bên đều gãy khúc nên chỉ đo ở các chỗ gãy
 */
function clearsSkirt(
  room: Omit<ArmRoom, "side">,
  hand: number,
  side: { at: (y: number) => number; ys: number[] },
) {
  const c = Math.cos(room.splay);
  const [y0, yR, y1] = [
    room.len[0],
    room.len[0] + room.len[1],
    room.len[0] + room.len[1] + hand,
  ].map((t) => room.at[1] + t * c);
  return [y0, yR, y1, ...side.ys.filter((y) => y > y0 && y < y1)].every(
    (y) => armInner(room, y) >= side.at(y),
  );
}

/**
 * Gốc vai `[ngang, cao trên hông]`, nửa khoảng hai gốc chân của người 3D, đơn vị three, và góc tay choãi. Người mặc đồ
 * (`b.clad`): gốc vai ở `garmentSocket`, nắp ống tay `cladArm` ôm góc vai áo, `bicep` nở nó ra ngoài sườn áo; tay buông
 * choãi `SPLAY3` như người que, dưới nách sườn áo lùi tới cách mép trong khuỷu một `CLAD_GAP` (`room`). Ngang hông, mép
 * trong cẳng tay cách mép ngoài gốc đùi `cladThigh` ít nhất một `CLAD_GAP`: hông rộng hơn thì tay choãi thêm. Người que:
 * gốc vai trên viền thân ở độ cao `shoulderDrop`. Mặc váy dựng khối thì tay choãi thêm tới khi cẳng tay và bàn tay nằm
 * ngoài váy đứng thẳng (`skirtSide`)
 */
export const roots3 = (garment: Partial<Garment> | undefined, rig: Rig, b?: Build3) => {
  const hip = rig.hipHalf / 100;
  // tạp dề là tấm phía trước, tay buông hai bên không chạm
  const skirt = b?.skirt?.style === "apron" ? undefined : b?.skirt;
  const h = rig.height;
  const inset = rig.stroke / 2;
  const len = [RIG.upperArm * h, RIG.foreArm * h] as const;
  if (!b?.clad) {
    const at = [garmentShoulder(garment, rig), -(RIG.torso * h - rig.shoulderDrop)] as const;
    const shoulder = [at[0] / 100, -at[1] / 100] as readonly [number, number];
    if (!skirt || !b) return { shoulder, hip, splay: SPLAY3 };
    // nét tay người que bán kính `BONES3.limb` nhân bề dày, đầu nét tròn
    const limb = BONES3.limb * 10 * b.sleeve;
    const aW = Math.max(1, skirt.waist - inset);
    const leg = b.trouser / 2;
    const side = skirtSide(skirt, h, aW, TORSO_DEPTH * aW, rig.hipHalf, leg, leg, inset);
    const r = [limb, limb, limb] as const;
    return {
      shoulder,
      hip,
      splay: widen((splay) => clearsSkirt({ at, cap: limb, splay, r, len }, limb, side)),
    };
  }
  const arm = cladArm(b.sleeve, rig.stroke);
  const thigh = cladThigh(b.trouser, rig.stroke);
  const cap = arm * (1 + (b.bicep ?? 0));
  const at = garmentSocket(garment, rig, arm, cap);
  const k = arm / CLAD_TAPER.arm[0];
  const flare = b.flare ?? 0;
  const f = b.sleeveLength ?? 1;
  // tay áo loe nằm ngoài tay: mép trong tay buông là mép trong ống tay áo, tới miệng tay
  const r = (
    flare > 0
      ? [
          cap,
          k * CLAD_TAPER.arm[1] * SLEEVE_EASE + sleeveGrow(flare, f, len, len[0]),
          k * CLAD_TAPER.arm[2] * SLEEVE_EASE + sleeveGrow(flare, f, len, len[0] + len[1]),
        ]
      : [cap, k * CLAD_TAPER.arm[1], k * CLAD_TAPER.arm[2]]
  ) as readonly [number, number, number];
  const g = garmentOf(garment, true);
  const hipEdge = rig.hipHalf + thigh;
  const hand = cladHand(b.sleeve, rig.stroke, len[1]).length;
  const torso = skirt && profile(g, rig, inset).pts;
  const yW = skirt ? -skirt.rise * h : 0;
  const knee = (thigh * CLAD_TAPER.leg[1]) / CLAD_TAPER.leg[0];
  const roomAt = (splay: number): ArmRoom => {
    const room = { at, cap, splay, r, len };
    return { ...room, side: armInner(room, at[1] + len[0] * Math.cos(splay)) };
  };
  const fits = (splay: number) => {
    const room = roomAt(splay);
    if (armInner(room, 0) < hipEdge) return false;
    if (!skirt || !torso) return true;
    // cạp liền mặt thân áo đã lùi theo tay; nửa px cạp 3D nhô ra nằm trong `CLAD_GAP`
    const { pts, depth } = cladProfile(torso, room);
    const [aW, dW] = profileAt(pts, depth, yW);
    return clearsSkirt(room, hand, skirtSide(skirt, h, aW, dW, rig.hipHalf, thigh, knee, inset));
  };
  let splay = widen(fits);
  // bụng phệ không bị tay cắt: sườn áo không bụng đã lùi theo tay ở góc `splay`, tay choãi thêm tới khi mép trong
  // cách sườn ấy cộng phần bụng nở hai bên một `CLAD_GAP` — tay tránh phần bụng chứ không tránh cả thân áo chưa lùi
  const side = g.belly ? (g.bellySide ?? BELLY.side) * g.belly : 0;
  if (side > 0) {
    const flat = roomAt(splay);
    const belly = profile({ ...g, belly: 0 }, rig, inset)
      .pts.filter(([, y]) => y > at[1] + cap)
      .map(([a, y]): P2 => [Math.min(a, armSide(flat, y)) + side * bellyAt(y, h), y]);
    splay = widen((s) => fits(s) && belly.every(([a, y]) => armSide(roomAt(s), y) >= a));
  }
  const room = roomAt(splay);
  return {
    shoulder: [at[0] / 100, -at[1] / 100] as readonly [number, number],
    hip,
    splay: room.splay,
    room,
  };
};

export type Limb3 = "af" | "an" | "lf" | "ln";

/** Đích cổ tay như `Reach` của lõi, nhận cả mảng chỉ đọc; `terms` và `aim` (ở `world.hands`) giải bằng `resolveActing` */
export interface ReachIn {
  at: readonly number[];
  elbow?: readonly number[];
  w: number;
  terms?: readonly ReachTerm[];
  aim?: Aim;
}

/** Đích thế giới hai tay của `world.hands`, theo gần / xa */
export type ActHands = { near?: ReachIn; far?: ReachIn };

/** Phần `Pose` mà người 3D đọc */
export interface PoseIn {
  af: readonly number[];
  an: readonly number[];
  lf: readonly number[];
  ln: readonly number[];
  torso: number;
  lean?: number;
  head: readonly number[];
  stretch: readonly number[];
  lift?: Partial<Record<Limb3, boolean>>;
  reach?: Partial<Record<"af" | "an", ReachIn>>;
  hand?: Partial<Record<"af" | "an", readonly number[]>>;
  aim?: Partial<Record<"af" | "an", Aim>>;
}

const num = (v: number | undefined) => (Number.isFinite(v) ? (v as number) : 0);

/**
 * Góc `[gốc, giữa, dang]` (độ) người 3D vẽ cho một kênh tay chân: kênh nâng (`pose.lift`) đọc góc soạn
 * ở `side` và số dang (số thứ tư của tay, thứ ba của chân), kênh giữ 2D về dáng nghỉ — tay buông, chân
 * thẳng, người ngồi thì đùi ngang.
 */
export function actAngles(
  P: Pick<PoseIn, Limb3 | "lift">,
  ch: Limb3,
  seated: boolean,
): [number, number, number] {
  const v = P[ch];
  if (P.lift?.[ch]) return [num(v[0]), num(v[1]), num(v[ch[0] === "a" ? 3 : 2])];
  return ch[0] === "l" && seated ? [90, -90, 0] : [0, 0, 0];
}

/**
 * Xoắn vai và lệch cổ tay (độ) người 3D vẽ cho một kênh tay: số thứ năm và thứ ba của tuple ở kênh nâng; kênh giữ 2D
 * ở dáng nghỉ nên là `0`. Xoắn vai dương là xoay ngoài: khuỷu gập ra trước thì cẳng tay quay ra phía chính tay ấy
 */
export function actTwist(P: Pick<PoseIn, "af" | "an" | "lift">, ch: "af" | "an"): [number, number] {
  const v = P[ch];
  return P.lift?.[ch] ? [num(v[4]), num(v[2])] : [0, 0];
}

/** Bàn tay của một kênh tay (`HAND_DOF`): `pose.hand`, không ghi là `HAND_REST`; không cần cờ nâng */
export const actHand = (P: Pick<PoseIn, "hand">, ch: "af" | "an"): readonly number[] =>
  P.hand?.[ch] ?? HAND_REST;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Hệ three, y lên: khớp giữa khi rủ thẳng, phương dự phòng của IK */
const DOWN3: V3 = [0, -1, 0];

/**
 * IK hai đoạn trong hệ three: khớp giữa trong mặt phẳng qua trục gốc → đích và `pole`, về phía `pole`. Trả khớp giữa,
 * đầu chi và trục bản lề `n × u` (pháp tuyến mặt phẳng gập, `u` là phía khớp giữa): xác định cả khi chi duỗi thẳng
 */
export function twoBone3(S: V3, T: V3, l1: number, l2: number, pole: V3): [V3, V3, V3] {
  const d = sub(T, S);
  const dist = len(d);
  const n = dist > 1e-9 ? mul(d, 1 / dist) : DOWN3;
  const across = (v: V3) => sub(v, mul(n, dot(v, n)));
  let u = across(pole);
  if (dot(u, u) < 1e-18) u = across(DOWN3);
  if (dot(u, u) < 1e-18) u = across([1, 0, 0]);
  u = unit(u);
  const reach = Math.min(Math.max(dist, Math.abs(l1 - l2)), l1 + l2);
  const a = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach || 1);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return [add(add(S, mul(n, a)), mul(u, h)), add(S, mul(n, reach)), unit(cross(n, u))];
}

/**
 * Hướng cánh tay trên (thế giới) của chuỗi IK vai `S` → khuỷu `E` → cổ tay `W` với trục bản lề `X`: cột là trục x
 * (bản lề), y (từ khuỷu về vai), z; và góc gập khuỷu `b` (radian, quanh x như `rx(−b)` của khuỷu). Khuỷu là bản lề
 * thuần nên cẳng tay và bàn tay không xoay giật theo đường ngắn nhất
 */
export function armFrame(S: V3, E: V3, W: V3, X: V3): { R: M3; b: number } {
  const Y = unit(sub(S, E));
  const x = unit(sub(X, mul(Y, dot(X, Y))));
  const Z = cross(x, Y);
  const f = unit(sub(W, E));
  return { R: fromColumns(x, Y, Z), b: Math.atan2(dot(f, Z), -dot(f, Y)) };
}

/** Hệ thân của một người 3D trong three: điểm và hướng hệ thân (đã đổi trục, chưa nhân 0,01) ra thế giới */
export interface ActFrame {
  point: (v: V3) => V3;
  dir: (v: V3) => V3;
}

/**
 * Tay bên `side` (`-1` tay phải) với tới đích hệ thân `rb` rồi đích thế giới rig `rw`, hoà trên vị trí
 * cổ tay theo `w`: `S`, `E`, `T` là vai, khuỷu, cổ tay của chuỗi góc trong three, `hinge` trục bản lề khuỷu của chuỗi
 * ấy (cột x của vai). Trả khuỷu, cổ tay và trục bản lề mới, không có đích thì `undefined`. Chuỗi góc duỗi thẳng thì
 * phía khuỷu suy từ `hinge`, nên ở phần đích nhỏ bản lề IK trùng bản lề góc: cẳng tay không xoay giật lúc đích bắt
 * đầu kéo. Đích hệ thân soạn ở `height = 1`, nhân `height` như `reachToWorld`. `act` và `actJoints` cùng gọi.
 */
export function actReach(
  frame: ActFrame,
  side: number,
  [S, E, T0]: readonly [V3, V3, V3],
  l1: number,
  l2: number,
  rb: ReachIn | undefined,
  rw: ReachIn | undefined,
  height = 1,
  hinge?: V3,
): [V3, V3, V3] | undefined {
  if (!(rb && rb.w > 0) && !(rw && rw.w > 0)) return undefined;
  const body = ([f, y, o]: readonly number[]): V3 => [side * o, -y, f];
  let T = T0;
  const axis = unit(sub(T, S));
  const bend = sub(sub(E, S), mul(axis, dot(sub(E, S), axis)));
  const straight: V3 = hinge ? cross(hinge, axis) : [0, 0, 0];
  let pole =
    dot(bend, bend) > 1e-10
      ? unit(bend)
      : dot(straight, straight) > 1e-10
        ? unit(straight)
        : unit(frame.dir(body(REACH_ELBOW)));
  const toward = (r: typeof rb, target: () => V3, el: V3) => {
    if (!r || !(r.w > 0)) return;
    const k = Math.min(1, r.w);
    T = add(T, mul(sub(target(), T), k));
    pole = add(mul(pole, 1 - k), mul(unit(el), k));
  };
  toward(
    rb,
    () => frame.point(mul(body(rb!.at), 0.01 * height)),
    frame.dir(body(rb?.elbow ?? REACH_ELBOW)),
  );
  toward(
    rw,
    () => [rw!.at[0] * 0.01, -rw!.at[1] * 0.01, -rw!.at[2] * 0.01],
    rw?.elbow ? [rw.elbow[0], -rw.elbow[1], -rw.elbow[2]] : frame.dir(body(REACH_ELBOW)),
  );
  return twoBone3(S, T, l1, l2, pole);
}

/** Khớp người 3D vẽ ra, theo bên giải phẫu: `R` bên phải người, `L` bên trái */
export type ActJoint =
  | "hip"
  | "kneeR"
  | "kneeL"
  | "footR"
  | "footL"
  | "shoulderR"
  | "shoulderL"
  | "elbowR"
  | "elbowL"
  | "wristR"
  | "wristL"
  | "handR"
  | "handL"
  | "neck"
  | "head";

/** Phần `ScenePose` mà người 3D đọc */
export interface ActInput {
  pose: PoseIn;
  world?: {
    hip: readonly number[];
    yaw: number;
    s: number;
    flip: boolean;
    seated?: boolean;
    hands?: ActHands;
  };
}

/** Khung bàn tay three của một bên: cổ tay, hướng `Rw` (cột x, y, z của khung bàn tay `handFrames`), cỡ bàn tay */
interface Wrist3 {
  at: V3;
  R: M3;
  k: number;
  long: number;
  v: readonly number[];
}

/** Phần JSON nhân vật mà người 3D đọc cho khớp, bàn tay và mốc thân (`face` cho mốc trên mặt) */
export type ActCharacter = Pick<CharacterData, "rig" | "pieces" | "palette" | "head"> & {
  face?: Partial<Pick<CharacterData["face"], "offsetY" | "eyeGap" | "mouthGap">>;
};

/** Thân người 3D ở một tư thế, chưa có tay: khớp chân, thân, cổ, đầu, khung từng phần, mọi số đo tay cần (three) */
function trunk3(c: ActCharacter, sp: ActInput) {
  const W = sp.world;
  if (!W) return undefined;
  const P = sp.pose;
  const B = bones3(c.rig.height);
  const pal = wornPalette(c);
  const w = limbWidths(pal);
  const skirt = wornSkirt(c.pieces.hem);
  const roots = roots3(c.pieces.torso.garment, c.rig, {
    clad: pal.clad,
    sleeve: w.sleeve,
    trouser: w.trouser,
    bicep: pal.bicep,
    skirt,
    flare: pal.sleeveFlare,
    sleeveLength: pal.sleeveLength,
  });
  const flip = !!W.flip;
  const near = flip ? 1 : -1;
  const seated = !!W.seated;
  const st = P.stretch;
  const s = W.s;
  const root: V3 = [W.hip[0] * 0.01, -W.hip[1] * 0.01, -W.hip[2] * 0.01];
  const Rr = ry(Math.PI / 2 - W.yaw);
  // con của một khớp: vị trí `local` trong hệ cha (cha ở `at`, hướng `R`), cả người nhân `s`
  const at = (o: V3, R: M3, local: V3): V3 => add(o, mul(mv(R, local), s));
  const hips = at(root, Rr, [0, seated ? 0 : B.limb, 0]);
  const out = {} as Record<ActJoint, V3>;
  const hipJ = {} as Record<"R" | "L", V3>;
  const tag = (side: number) => (side === -1 ? "R" : "L");

  for (const side of [near, -near]) {
    const isNear = side === near;
    const [a, b, sp] = actAngles(P, isNear ? "ln" : "lf", seated);
    const hj = at(hips, Rr, [side * roots.hip, 0, 0]);
    // Euler 'ZXY' của three: Rz · Rx · Ry, quay quanh y bằng 0
    const Rh = mm(Rr, mm(rz(side * sp * D), rx(-a * D)));
    const knee = at(hj, Rh, [0, -B.thigh * (st[isNear ? 6 : 4] ?? 1), 0]);
    const Rk = mm(Rh, rx(-b * D));
    hipJ[tag(side)] = hj;
    out[`knee${tag(side)}` as ActJoint] = knee;
    out[`foot${tag(side)}` as ActJoint] = at(knee, Rk, [0, -B.shin * (st[isNear ? 7 : 5] ?? 1), 0]);
  }

  const m = flip ? -1 : 1;
  // Euler 'XYZ' của three: Rx · Ry · Rz
  const Rs = mm(Rr, mm(rx(num(P.torso) * D), rz(-m * num(P.lean) * D)));
  const [tilt, turn, nod] = P.head;
  // Euler 'YXZ' của three: Ry · Rx · Rz
  const Rn = mm(mm(Rs, ry(m * num(turn) * D)), mm(rx(num(nod) * D), rz(-m * num(tilt) * D)));
  const neck = at(hips, Rs, [0, B.torso, 0]);
  out.neck = neck;
  out.head = at(neck, Rn, [0, head3(B, c.head.form === "human"), 0]);
  out.hip = hips;

  const frame: ActFrame = { point: (v) => at(root, Rr, v), dir: (v) => mv(Rr, v) };
  const hand = pal.clad && cladHand(w.sleeve, c.rig.stroke, B.foreArm * 100);
  return {
    c,
    P,
    W,
    B,
    w,
    pal,
    skirt,
    roots,
    near,
    s,
    root,
    Rr,
    Rs,
    Rn,
    hips,
    hipJ,
    out,
    at,
    frame,
    hand,
    tag,
  };
}

type Trunk3 = NonNullable<ReturnType<typeof trunk3>>;

/** Tay bên `side` của thân `T` ở tư thế `P` với đích thế giới `hands`: vai, khuỷu, cổ tay, khung bàn tay */
function arm3(T: Trunk3, P: PoseIn, hands: ActHands | undefined, side: number) {
  const { B, roots, near, s, at, frame } = T;
  const st = P.stretch;
  const isNear = side === near;
  const ch = isNear ? "an" : "af";
  const [a, b, sp] = actAngles(P, ch, false);
  const [twist, dev] = actTwist(P, ch);
  const sh = at(T.hips, T.Rs, [side * roots.shoulder[0], roots.shoulder[1], 0]);
  // Euler 'ZXY' của vai: dang · gập · xoắn quanh chính cánh tay
  const Rsh = mm(T.Rs, mm(mm(rz(side * (roots.splay + sp * D)), rx(-a * D)), ry(side * twist * D)));
  const l1 = B.upperArm * (st[isNear ? 2 : 0] ?? 1);
  const l2 = B.foreArm * (st[isNear ? 3 : 1] ?? 1);
  const el = at(sh, Rsh, [0, -l1, 0]);
  let Re = mm(Rsh, rx(-b * D));
  let wr = at(el, Re, [0, -l2, 0]);
  const ik = actReach(
    frame,
    side,
    [sh, el, wr],
    l1 * s,
    l2 * s,
    P.reach?.[ch],
    isNear ? hands?.near : hands?.far,
    B.height,
    mv(Rsh, [1, 0, 0]),
  );
  let elbow = el;
  if (ik) {
    const f = armFrame(sh, ik[0], ik[1], ik[2]);
    [elbow, wr] = ik;
    Re = mm(f.R, rx(-f.b));
  }
  const v = actHand(P, ch);
  const Rw = mm(Re, wristTurn(v[0], v[1], dev, side));
  const grip: V3 = T.hand
    ? handGrip(side, T.hand.k, T.hand.long)
    : [0, -(BONES3.limb * T.w.sleeve) / 10, 0];
  return { ch, sh, elbow, wr, Re, Rw, dev, grip, v };
}

/** `pose3` theo từng mẫu `sp`: `actJoints` và `actPalms` hỏi cùng một mẫu nhiều lần */
const pose3Memo = new WeakMap<ActInput, { c: ActCharacter; p: ReturnType<typeof solvePose3> }>();

/** Khớp three (chưa đổi sang rig), khung bàn tay hai bên và hướng hông `Rr` của một người 3D; đích theo mốc đã giải */
function pose3(c: ActCharacter, sp0: ActInput) {
  const hit = pose3Memo.get(sp0);
  if (hit?.c === c) return hit.p;
  const p = solvePose3(c, sp0);
  pose3Memo.set(sp0, { c, p });
  return p;
}

function solvePose3(c: ActCharacter, sp0: ActInput) {
  const T0 = trunk3(c, sp0);
  if (!T0) return undefined;
  const sp = solveActing(T0, sp0).input;
  const T = sp === sp0 ? T0 : { ...T0, P: sp.pose, W: sp.world! };
  const out = T.out;
  const wrists: Partial<Record<"R" | "L", Wrist3>> = {};
  for (const side of [T.near, -T.near]) {
    const A = arm3(T, sp.pose, sp.world?.hands, side);
    const tag = T.tag(side);
    out[`shoulder${tag}` as ActJoint] = A.sh;
    out[`elbow${tag}` as ActJoint] = A.elbow;
    out[`wrist${tag}` as ActJoint] = A.wr;
    out[`hand${tag}` as ActJoint] = T.at(A.wr, A.Rw, A.grip);
    if (T.hand)
      wrists[tag] = { at: A.wr, R: A.Rw, k: T.hand.k * T.s, long: T.hand.long * T.s, v: A.v };
  }
  return {
    joints: out,
    wrists: T.hand ? (wrists as Record<"R" | "L", Wrist3>) : undefined,
    Rr: T.Rr,
    Rs: T.Rs,
  };
}

/** Lặp giải đích theo điểm bàn tay và hướng lòng tay: chỗ bàn tay và hướng cổ tay phụ thuộc nhau, hội tụ trong vài vòng */
const AIM_ITER = 8;
/** Giới hạn gập cổ tay khi rig tự giải lòng tay (độ); xoay cẳng tay giữ `−90..90` như JSON */
export const AIM_BEND = 75;
/** Giới hạn lệch cổ tay (số thứ ba của tay) khi rig tự giải hướng ngón, độ */
export const AIM_DEV = 30;

const ZERO3: V3 = [0, 0, 0];
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const ang = (a: V3, b: V3) =>
  (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;

/** Bàn tay một bên đang ở đâu: cổ tay, khung `Rw`, cỡ (đã nhân `world.s`), số bàn tay — mốc `other…` đọc nó */
interface HandState {
  at: V3;
  R: M3;
  k: number;
  long: number;
  v: readonly number[];
  side: number;
  stick?: V3;
}

/** Điểm `point` của bàn tay đang ở `h`, three */
function handAt(h: HandState, point: HandPoint): V3 {
  if (point === "wrist") return h.at;
  if (h.stick) return add(h.at, mv(h.R, h.stick));
  return add(h.at, mv(h.R, handPoint(point, h.v, h.side, h.k, h.long)));
}

/** Số đo đầu, thân, đùi cho mốc; tính một lần mỗi thân */
function markShape(T: Trunk3) {
  const { c, B } = T;
  const human = c.head.form === "human";
  const f0 = { offsetY: 0, eyeGap: 26, mouthGap: 34, ...c.face };
  const face = human ? chibiShape({ ...f0 }) : f0;
  const r = B.head;
  const sk = (p: V3): V3 => [p[0] * SKULL3[0], p[1] * SKULL3[1], p[2] * SKULL3[2]];
  const onFace = (px: number, py: number) => sk(faceSurface(px, py, r, human));
  const onSkull = (u: V3) => sk(mul(human ? humanSkull(unit(u)) : unit(u), r));
  const g = garmentOf(c.pieces.torso.garment, !!T.pal.clad);
  let { pts } = profile(g, c.rig, c.rig.stroke / 2);
  let depth = pts.map(([a]) => TORSO_DEPTH * a);
  if (T.pal.clad && T.roots.room) ({ pts, depth } = cladProfile(pts, T.roots.room));
  const h = c.rig.height;
  const across = (y: number) => profileAt(pts, depth, y);
  const front = (y: number) => across(y)[1] + (g.belly ?? 0) * bellyAt(y, h);
  // nửa bề dày gốc đùi như `body3` của `figure3d.ts`
  const leg = (T.pal.clad ? cladThigh(T.w.trouser, c.rig.stroke) : T.w.trouser / 2) / 100;
  return { human, face, r, onFace, onSkull, across, front, h, leg };
}

const shapes = new WeakMap<object, ReturnType<typeof markShape>>();

/**
 * Mốc `to` trên người thân `T` (three) cho tay bên `hand`, bên mốc `sel`; `offset` `[tiến, y, ra ngoài]` (rig, nhân
 * `world.s`) theo khung phần người mang mốc, `ra ngoài` dương về phía chính tay ấy. Mốc trên tay kia đọc `other`
 */
function markAt(
  T: Trunk3,
  ref: { to: BodyMark; side?: "same" | "other"; offset?: readonly number[] },
  hand: number,
  other: HandState | undefined,
): V3 {
  let S = shapes.get(T.c);
  if (!S) shapes.set(T.c, (S = markShape(T)));
  const sd = ref.side === "other" ? -hand : hand;
  const { s, at, B } = T;
  const H = T.out.head;
  const torsoLen = RIG.torso * S.h;
  const px = (x: number, y: number, z: number): V3 => [x / 100, -y / 100, z / 100];
  let p: V3;
  let R: M3 = T.Rr;
  switch (ref.to) {
    case "mouth":
      p = at(H, T.Rn, S.onFace(0, S.face.offsetY + S.face.mouthGap));
      R = T.Rn;
      break;
    case "eye":
      p = at(H, T.Rn, S.onFace((sd * S.face.eyeGap) / 2, S.face.offsetY));
      R = T.Rn;
      break;
    case "cheek":
      p = at(
        H,
        T.Rn,
        S.onFace(sd * (S.face.eyeGap / 2 + 6), S.face.offsetY + S.face.mouthGap * 0.55),
      );
      R = T.Rn;
      break;
    case "forehead":
      p = at(H, T.Rn, S.onFace(0, S.face.offsetY - 32));
      R = T.Rn;
      break;
    case "chin":
      p = at(H, T.Rn, S.onSkull([0, -0.8, 0.6]));
      R = T.Rn;
      break;
    case "crown":
      p = at(H, T.Rn, S.onSkull([0, 1, 0]));
      R = T.Rn;
      break;
    case "backHead":
      p = at(H, T.Rn, S.onSkull([0, 0.1, -1]));
      R = T.Rn;
      break;
    case "ear": {
      const E = HUMAN_HEAD.ear;
      const e = S.human ? humanEar(sd as -1 | 1) : unit([sd, E.y, E.z]);
      const out = S.human ? E.out * 1.35 : 0;
      p = at(H, T.Rn, [
        (e[0] + sd * out) * S.r * SKULL3[0],
        e[1] * S.r * SKULL3[1],
        e[2] * S.r * SKULL3[2],
      ]);
      R = T.Rn;
      break;
    }
    case "nape":
      p = at(T.out.neck, T.Rs, [0, B.neck * 0.5, -0.14]);
      R = T.Rs;
      break;
    case "shoulder": {
      const cap = T.roots.room ? T.roots.room.cap / 100 : (BONES3.limb * T.w.sleeve) / 10;
      p = at(T.hips, T.Rs, [sd * T.roots.shoulder[0], T.roots.shoulder[1] + cap, 0]);
      R = T.Rs;
      break;
    }
    case "chest": {
      const y = -0.7 * torsoLen;
      p = at(T.hips, T.Rs, px(0, y, S.front(y)));
      R = T.Rs;
      break;
    }
    case "belly": {
      const y = -BELLY.at * torsoLen;
      p = at(T.hips, T.Rs, px(0, y, S.front(y)));
      R = T.Rs;
      break;
    }
    case "back": {
      const y = -0.3 * torsoLen;
      p = at(T.hips, T.Rs, px(0, y, -S.across(y)[1]));
      R = T.Rs;
      break;
    }
    case "hip": {
      const y = -0.12 * torsoLen;
      p = at(T.hips, T.Rs, px(sd * S.across(y)[0], y, 0));
      R = T.Rs;
      break;
    }
    case "thigh":
    case "knee": {
      const t = T.tag(sd);
      const a = T.hipJ[t];
      const b = T.out[`knee${t}` as ActJoint];
      const d = unit(sub(b, a));
      const n0 = add([0, 1, 0], mv(T.Rr, [0, 0, 1]));
      const n = unit(sub(n0, mul(d, dot(n0, d))));
      const clad = !!T.pal.clad;
      const [u, k] = ref.to === "thigh" ? [0.5, clad ? 0.83 : 1] : [1, clad ? 0.9 / 1.35 : 1];
      p = add(add(a, mul(sub(b, a), u)), mul(n, S.leg * k * s));
      break;
    }
    default: {
      const pt = {
        otherWrist: "wrist",
        otherPalm: "palm",
        otherBack: "back",
        otherGrip: "grip",
      } as const;
      p = other ? handAt(other, pt[ref.to as keyof typeof pt]) : T.out.hip;
    }
  }
  const o = ref.offset;
  return o ? add(p, mul(mv(R, [hand * o[2], -o[1], o[0]]), 0.01 * s)) : p;
}

/** Hướng hệ thân `[tiến, y, ra ngoài]` của tay bên `hand` ra three */
const bodyDir = (T: Trunk3, hand: number, [f, y, o]: readonly number[]): V3 =>
  unit(mv(T.Rr, [hand * o, -y, f]));

/**
 * Xoay cẳng tay `turn`, gập cổ tay `bend` và lệch cổ tay `dev` (độ) cho khung cẳng tay `Re` của tay bên `side`: lòng tay
 * quay về `palm`, ngón chĩa về `fingers` (three). Lòng tay chỉ phụ thuộc xoay và gập (khung bàn tay: lòng tay `−side · x`
 * không đổi theo lệch), nên giải đúng hai góc ấy rồi lấy lệch cho ngón; `dev` thiếu là lệch cố định ở số ấy. `bend` khai
 * thì giữ. Ngoài giới hạn (`−90..90`, `±AIM_BEND`, `±AIM_DEV`) thì tinh chỉnh trong hộp giới hạn. Trả cả góc lệch còn lại
 */
export function aimWrist(
  Re: M3,
  side: number,
  palm: V3 | undefined,
  fingers: V3 | undefined,
  o: { bend?: number; dev?: number; fixedDev?: number; fast?: boolean } = {},
): { turn: number; bend: number; dev: number; palmErr?: number; fingerErr?: number } {
  const Ri = tr(Re);
  const dp = palm && mv(Ri, unit(palm));
  const df = fingers && mv(Ri, unit(fingers));
  const freeDev = o.fixedDev === undefined;
  const R = (t: number, b: number, d: number) => wristTurn(t, b, d, side);
  const n = (t: number, b: number) => mv(R(t, b, 0), [-side, 0, 0]);
  const fi = (t: number, b: number, d: number) => mv(R(t, b, d), [0, -1, 0]);
  const clampT = (t: number) => Math.max(-90, Math.min(90, t));
  const clampB = (b: number) =>
    o.bend !== undefined ? o.bend : Math.max(-AIM_BEND, Math.min(AIM_BEND, b));
  const clampD = (d: number) =>
    freeDev ? Math.max(-AIM_DEV, Math.min(AIM_DEV, d)) : (o.fixedDev as number);
  /** Lệch cổ tay tốt nhất cho ngón ở xoay, gập đã chọn */
  const bestDev = (t: number, b: number) => {
    if (!df || !freeDev) return clampD(o.dev ?? 0);
    const M = R(t, b, 0);
    const c1 = dot(mv(M, [0, 1, 0]), df);
    const c2 = dot(mv(M, [0, 0, 1]), df);
    return clampD((Math.atan2(c2, -c1) * 180) / Math.PI);
  };
  const cost = (t: number, b: number, d: number) =>
    (dp ? 1 - dot(n(t, b), dp) : 0) +
    (df ? (dp ? 0.6 : 1) * (1 - dot(fi(t, b, d), df)) : 0) +
    1e-4 * (b / 90) ** 2;
  let best: [number, number, number] = [0, clampB(0), clampD(o.dev ?? 0)];
  if (dp) {
    const b = o.bend ?? (Math.asin(Math.max(-1, Math.min(1, dp[1]))) * 180) / Math.PI;
    const t = (Math.atan2(-dp[2], -side * dp[0]) * 180) / Math.PI;
    best = [clampT(t), clampB(b), 0];
    best[2] = bestDev(best[0], best[1]);
  } else if (df) {
    let c = Infinity;
    for (let t = -90; t <= 90; t += 15)
      for (let b = -AIM_BEND; b <= AIM_BEND; b += 15) {
        const bb = clampB(b);
        const d = bestDev(t, bb);
        const v = cost(t, bb, d);
        if (v < c - 1e-12) [c, best] = [v, [t, bb, d]];
        if (o.bend !== undefined) break;
      }
  }
  if ((dp || df) && !o.fast) {
    // tinh chỉnh trong hộp giới hạn: đúng cả khi lời giải đúng nằm ngoài giới hạn
    let c = cost(...best);
    for (let step = 8; step > 0.02; step /= 2)
      for (let moved = true; moved;) {
        moved = false;
        for (const [i, dx] of [
          [0, step],
          [0, -step],
          [1, step],
          [1, -step],
          [2, step],
          [2, -step],
        ]) {
          const q: [number, number, number] = [...best];
          q[i] += dx;
          q[0] = clampT(q[0]);
          q[1] = clampB(q[1]);
          q[2] = clampD(q[2]);
          const v = cost(...q);
          if (v < c - 1e-12) [c, best, moved] = [v, q, true];
        }
      }
  }
  const [t, b, d] = best;
  return {
    turn: t,
    bend: b,
    dev: d,
    ...(dp && { palmErr: ang(n(t, b), dp) }),
    ...(df && { fingerErr: ang(fi(t, b, d), df) }),
  };
}

/** Một tay đã giải: đích đã quy về số, số bàn tay, và độ lệch còn lại so với cái đã khai */
export interface AimReport {
  /** Mốc của đích (`at` là toạ độ thô với điểm khác cổ tay) và khe từ điểm bàn tay tới đích, rig; chỉ khi phần đích đủ `1` */
  reach?: { to: BodyMark | "at"; point: HandPoint; gap: number };
  /** Góc lệch còn lại của lòng tay, của ngón so với hướng đã khai, độ */
  palm?: number;
  fingers?: number;
  /** Hai tay cùng bám vào tay kia: tay giải trước dùng chỗ chưa giải của tay kia */
  cycle?: boolean;
}

const hasTerms = (r: ReachIn | undefined) => !!(r && r.w > 0 && r.terms?.length);
const usesOther = (r: ReachIn | undefined, a: Aim | undefined) =>
  !!(
    (r && r.w > 0 && r.terms?.some((t) => isOtherHand(t.to))) ||
    a?.terms.some((t) => isOtherHand(t.palm?.to) || isOtherHand(t.fingers?.to))
  );

/** Có gì phải giải: đích có số hạng, bàn tay theo ý định */
export function needsSolve(sp: ActInput): boolean {
  const P = sp.pose;
  const h = sp.world?.hands;
  return !!(
    hasTerms(P.reach?.af) ||
    hasTerms(P.reach?.an) ||
    P.aim?.af ||
    P.aim?.an ||
    hasTerms(h?.near) ||
    hasTerms(h?.far) ||
    h?.near?.aim ||
    h?.far?.aim
  );
}

/** Bỏ phần theo mốc và ý định, giữ số ước lượng: cho chỗ không giải được (không có `world`, không biết nhân vật) */
export function plainActing<T extends ActInput>(sp: T): T {
  if (!needsSolve(sp)) return sp;
  const strip = (r: ReachIn | undefined) =>
    r && ({ at: r.at, ...(r.elbow && { elbow: r.elbow }), w: r.w } as ReachIn);
  const P = sp.pose;
  const reach = P.reach && { af: strip(P.reach.af), an: strip(P.reach.an) };
  const h0 = sp.world?.hands;
  // đích thế giới theo mốc không có chỗ ước lượng: bỏ
  const marked = (r: ReachIn | undefined) => (r?.terms?.some((t) => t.to) ? undefined : r);
  const h = h0 && { near: marked(h0.near), far: marked(h0.far) };
  return {
    ...sp,
    pose: { ...P, ...(reach && { reach }), aim: undefined },
    ...(sp.world && {
      world: { ...sp.world, ...(h && { hands: { near: strip(h.near), far: strip(h.far) } }) },
    }),
  };
}

/** Khuỷu được xoay quanh trục vai → cổ tay tới ngần này độ khi hành động khai hướng ngón, để ngón theo được hướng ấy */
export const AIM_SWIVEL = 90;
const SWIVEL_STEP = 15;
/** Giá mỗi độ xoay khuỷu khỏi hướng đã khai, quy ra độ lệch của lòng tay */
const SWIVEL_COST = 0.08;

/** Quay `v` quanh trục đơn vị `u` một góc `a` (radian) */
const spin = (v: V3, u: V3, a: number): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return add(add(mul(v, c), mul(cross(u, v), s)), mul(u, dot(u, v) * (1 - c)));
};

function solveActing(
  T: Trunk3,
  sp: ActInput,
): { input: ActInput; report: Record<"R" | "L", AimReport> } {
  const report = { R: {}, L: {} } as Record<"R" | "L", AimReport>;
  if (!needsSolve(sp)) return { input: sp, report };
  const P0 = sp.pose;
  const W0 = sp.world!;
  let P: PoseIn = { ...P0, reach: { ...P0.reach }, hand: { ...P0.hand }, aim: undefined };
  const hands: ActHands = { ...W0.hands };
  const { near, s } = T;
  const k = T.hand ? T.hand.k * s : 1;
  const long = T.hand ? T.hand.long * s : 1;
  const state = (A: ReturnType<typeof arm3>, side: number): HandState => ({
    at: A.wr,
    R: A.Rw,
    k,
    long,
    v: A.v,
    side,
    ...(!T.hand && { stick: mul(A.grip, s) }),
  });
  const sides = [near, -near];
  const dep = (side: number) => {
    const rw = side === near ? W0.hands?.near : W0.hands?.far;
    const ch = side === near ? "an" : "af";
    return usesOther(P0.reach?.[ch], P0.aim?.[ch]) || usesOther(rw, rw?.aim);
  };
  // tay bám vào tay kia giải sau tay kia
  if (dep(near) && !dep(-near)) sides.reverse();
  const cycle = dep(near) && dep(-near);
  const done: Partial<Record<number, HandState>> = {};
  const fromRig = (p: readonly number[]): V3 => [p[0] * 0.01, -p[1] * 0.01, -p[2] * 0.01];
  for (const side of sides) {
    const ch = side === near ? "an" : "af";
    const wk = side === near ? "near" : "far";
    const rb = P0.reach?.[ch];
    const rw = W0.hands?.[wk];
    const aimB = P0.aim?.[ch];
    const aimW = rw && rw.w > 0 ? rw.aim : undefined;
    if (!hasTerms(rb) && !hasTerms(rw) && !aimB && !aimW) continue;
    const other = done[-side] ?? state(arm3(T, P, hands, side * -1), -side);
    const rep: AimReport = cycle ? { cycle: true } : {};
    const raw = actHand(P0, ch);
    const fingersV = raw.slice(2);
    const body = (v: readonly number[]): V3 => [side * v[2], -v[1], v[0]];
    /** Điểm đích (three) của một số hạng và điểm bàn tay đặt vào đó */
    const goal = (t: ReachTerm, world: boolean): [V3, HandPoint] => [
      t.to
        ? markAt(T, { to: t.to, side: t.side, offset: t.offset }, side, other)
        : world
          ? fromRig(t.at!)
          : T.frame.point(mul(body(t.at!), 0.01 * T.B.height)),
      t.point ?? (t.to ? "palm" : "wrist"),
    ];
    /** Cổ tay (three) đưa các điểm bàn tay vào đích khi khung bàn tay là `R`, góc ngón `v` */
    const wristFor = (terms: readonly ReachTerm[], world: boolean, R: M3, v: readonly number[]) => {
      let acc: V3 = ZERO3;
      let sum = 0;
      for (const t of terms) {
        const [p, pt] = goal(t, world);
        const h: HandState = {
          at: ZERO3,
          R,
          k,
          long,
          v,
          side,
          ...(!T.hand && { stick: [0, (-(BONES3.limb * T.w.sleeve) / 10) * s, 0] as V3 }),
        };
        acc = add(acc, mul(sub(p, handAt(h, pt)), t.k));
        sum += t.k;
      }
      return mul(acc, 1 / (sum || 1));
    };
    const toBody = (p: V3): [number, number, number] => {
      const v = mul(mv(tr(T.Rr), sub(p, T.root)), 1 / (s * 0.01 * T.B.height));
      return [v[2], -v[1], side * v[0]];
    };
    const dirOf = (d: AimDir | undefined, h: HandState, from: HandPoint) =>
      d &&
      (d.to
        ? sub(markAt(T, { to: d.to, side: d.side, offset: d.offset }, side, other), handAt(h, from))
        : bodyDir(T, side, d.v!));
    // lệch cổ tay chỉ đọc ở kênh nâng: kênh giữ 2D thì rig không lấy nó cho ngón
    const lifted = !!P0.lift?.[ch];
    const dev0 = lifted ? num(P0[ch][2]) : 0;
    /** Xoay, gập, lệch cổ tay của các số hạng ý định cộng theo phần; `fast` bỏ bước tinh chỉnh (thử hướng khuỷu) */
    const solveAim = (
      aim: Aim,
      base: [number, number, number],
      A: ReturnType<typeof arm3>,
      h: HandState,
      fast = false,
    ) => {
      const out: [number, number, number] = [0, 0, 0];
      let cost = 0;
      const err = { palm: 0, fingers: 0, wp: 0, wf: 0 };
      for (const a of aim.terms) {
        if (a.raw || a.keep || (!a.palm && !a.fingers)) {
          const r = a.raw ? [a.raw[0], a.raw[1], base[2]] : base;
          for (let i = 0; i < 3; i++) out[i] += a.k * r[i];
          continue;
        }
        const sol = aimWrist(A.Re, side, dirOf(a.palm, h, "palm"), dirOf(a.fingers, h, "wrist"), {
          bend: a.bend,
          dev: base[2],
          ...(!lifted && { fixedDev: 0 }),
          fast,
        });
        out[0] += a.k * sol.turn;
        out[1] += a.k * sol.bend;
        out[2] += a.k * sol.dev;
        cost += a.k * ((sol.palmErr ?? 0) + 0.6 * (sol.fingerErr ?? 0));
        if (sol.palmErr !== undefined)
          [err.palm, err.wp] = [err.palm + a.k * sol.palmErr, err.wp + a.k];
        if (sol.fingerErr !== undefined)
          [err.fingers, err.wf] = [err.fingers + a.k * sol.fingerErr, err.wf + a.k];
      }
      return {
        tbd: out,
        cost,
        palm: err.wp > 0.5 ? err.palm / err.wp : undefined,
        fingers: err.wf > 0.5 ? err.fingers / err.wf : undefined,
      };
    };
    // nguồn đích đang lái tay: đích thế giới đè đích hệ thân
    const drive = rw && rw.w > 0 ? "world" : rb && rb.w > 0 ? "body" : undefined;
    const elbow0: V3 | undefined =
      drive === "world"
        ? rw!.elbow
          ? ([rw!.elbow[0], -rw!.elbow[1], -rw!.elbow[2]] as V3)
          : T.frame.dir(body(REACH_ELBOW))
        : drive === "body"
          ? T.frame.dir(body(rb!.elbow ?? REACH_ELBOW))
          : undefined;
    // hướng ngón khai trong ý định: khuỷu được xoay quanh trục vai → cổ tay để ngón theo kịp
    const wantsFingers =
      !!elbow0 && [aimB, aimW].some((a) => a?.terms.some((t) => t.fingers && t.k > 0.01));
    let tbd: [number, number, number] = [raw[0] ?? 0, raw[1] ?? 0, dev0];
    let elbow = elbow0;
    /** Đặt đích, hướng khuỷu, bàn tay và lệch cổ tay vào tư thế đang giải */
    const place = (R: M3, q: readonly number[], el: V3 | undefined) => {
      const v = [q[0], q[1], ...fingersV];
      if (hasTerms(rb)) {
        const at = toBody(wristFor(rb!.terms!, false, R, v));
        const e = drive === "body" && el ? toBodyDir(T, side, el) : rb!.elbow;
        P = { ...P, reach: { ...P.reach, [ch]: { at, ...(e && { elbow: e }), w: rb!.w } } };
      } else if (drive === "body" && el && wantsFingers)
        P = { ...P, reach: { ...P.reach, [ch]: { ...rb!, elbow: toBodyDir(T, side, el) } } };
      if (rw) {
        const g = hasTerms(rw) ? wristFor(rw.terms!, true, R, v) : fromRig(rw.at);
        const e =
          drive === "world" && el && (wantsFingers || rw.elbow)
            ? [el[0], -el[1], -el[2]]
            : rw.elbow;
        hands[wk] = { at: [g[0] * 100, -g[1] * 100, -g[2] * 100], ...(e && { elbow: e }), w: rw.w };
      }
      const arm = [...P[ch]];
      if (lifted) arm[2] = q[2];
      P = { ...P, [ch]: arm, hand: { ...P.hand, [ch]: v } };
    };
    const handR = (A: ReturnType<typeof arm3>, q: readonly number[]) =>
      mm(A.Re, wristTurn(q[0], q[1], q[2], side));
    let A = arm3(T, P, hands, side);
    let last: V3 | undefined;
    for (let i = 0; i < AIM_ITER; i++) {
      const R = handR(A, tbd);
      if (wantsFingers && elbow0) {
        // thử xoay khuỷu quanh trục vai → đích: chọn góc cho ngón lệch ít nhất, ưu tiên gần hướng khuỷu đã khai
        place(R, tbd, elbow0);
        const S = arm3(T, P, hands, side).sh;
        const goalW =
          drive === "world"
            ? fromRig(hands[wk]!.at)
            : T.frame.point(mul(body(P.reach![ch]!.at), 0.01 * T.B.height));
        const u = unit(sub(goalW, S));
        const tryAt = (a: number) => {
          const el = spin(elbow0, u, a * D);
          place(R, tbd, el);
          const B = arm3(T, P, hands, side);
          const h = state(B, side);
          let cost = SWIVEL_COST * Math.abs(a);
          for (const aim of [aimB, aimW]) if (aim) cost += solveAim(aim, tbd, B, h, true).cost;
          return { cost, a, el };
        };
        let best = tryAt(0);
        for (let a = -AIM_SWIVEL; a <= AIM_SWIVEL; a += SWIVEL_STEP) {
          const c = tryAt(a);
          if (c.cost < best.cost - 1e-9) best = c;
        }
        for (let step = SWIVEL_STEP / 2; step >= 1; step /= 2)
          for (const a of [best.a - step, best.a + step])
            if (Math.abs(a) <= AIM_SWIVEL) {
              const c = tryAt(a);
              if (c.cost < best.cost - 1e-9) best = c;
            }
        elbow = best.el;
      }
      place(R, tbd, elbow);
      A = arm3(T, P, hands, side);
      const h = state(A, side);
      let nb: [number, number, number] = [raw[0] ?? 0, raw[1] ?? 0, dev0];
      if (aimB) {
        const r = solveAim(aimB, nb, A, h);
        nb = r.tbd;
        [rep.palm, rep.fingers] = [r.palm, r.fingers];
      }
      if (aimW) {
        const r = solveAim(aimW, nb, A, h);
        const ww = Math.min(1, rw!.w);
        nb = nb.map((x, j) => x + (r.tbd[j] - x) * ww) as [number, number, number];
        if (ww >= 0.999) [rep.palm, rep.fingers] = [r.palm, r.fingers];
      }
      tbd = nb;
      const moved = last ? len(sub(A.wr, last)) : Infinity;
      last = A.wr;
      if (moved < 1e-5 && i > 0) break;
    }
    place(handR(A, tbd), tbd, elbow);
    A = arm3(T, P, hands, side);
    const h = state(A, side);
    const full =
      rw && rw.w >= 0.999 && hasTerms(rw)
        ? rw
        : rb && rb.w >= 0.999 && hasTerms(rb) && !(rw && rw.w > 0)
          ? rb
          : undefined;
    if (full) {
      const main = full.terms!.reduce((a, b) => (b.k > a.k ? b : a));
      const [want, pt] = goal(main, full === rw);
      rep.reach = {
        to: main.to ?? "at",
        point: pt,
        gap: (len(sub(handAt(h, pt), want)) * 100) / s,
      };
    }
    report[T.tag(side)] = rep;
    done[side] = h;
  }
  return {
    input: {
      pose: { ...P, aim: undefined },
      world: { ...W0, ...(W0.hands && { hands }) },
    },
    report,
  };
}

/** Hướng three ra hệ thân `[tiến, y, ra ngoài]` của tay bên `side` */
const toBodyDir = (T: Trunk3, side: number, d: V3): [number, number, number] => {
  const v = mv(tr(T.Rr), d);
  return [v[2], -v[1], side * v[0]];
};

/**
 * Đích theo mốc (`Reach.terms`) và bàn tay theo ý định (`Pose.aim`, `aim` của `world.hands`) của một người 3D quy về số
 * mà `act` và `actJoints` đọc: đích cổ tay hệ thân, thế giới và `turn` / `bend` của bàn tay. Mốc tính trên đúng nhân vật
 * `c` ở tư thế ấy; tay bám vào tay kia giải sau tay kia. Không có gì phải giải thì trả nguyên `sp`.
 * docs/01-rig.md#đích-theo-mốc
 */
export function resolveActing<T extends ActInput>(c: ActCharacter, sp: T): T {
  if (!needsSolve(sp)) return sp;
  const T0 = trunk3(c, sp);
  if (!T0) return plainActing(sp);
  const r = solveActing(T0, sp).input;
  return { ...sp, pose: r.pose, world: r.world } as T;
}

/** Như `resolveActing`, kèm độ lệch còn lại từng tay (`AimReport`): `check`, `scene_probe` đọc */
export function actAim(
  c: ActCharacter,
  sp: ActInput,
): { input: ActInput; report: Record<"R" | "L", AimReport> } | undefined {
  const T0 = trunk3(c, sp);
  return T0 && solveActing(T0, sp);
}

const rigOf = (p: V3): V3 => [p[0] * 100, -p[1] * 100, -p[2] * 100];
const rigDir = (p: V3): V3 => [p[0], -p[1], -p[2]];

/**
 * Khớp của người 3D đúng như `act` đặt người que three: cùng khung xương (`bones3`, `roots3`), cùng
 * luật đọc góc (`actAngles`, `actTwist`, `actHand`) và cùng IK (`actReach`, `armFrame`), trả trong toạ độ thế giới
 * rig; `hand` là chỗ treo đồ cầm (`handGrip`, người que ở mút nét). Không có `world` thì không có gì. `check` đo giật
 * tay chân trên các khớp này. docs/01-rig.md#khớp-người-3d-vẽ-ra
 */
export function actJoints(
  c: Pick<CharacterData, "rig" | "pieces" | "palette" | "head">,
  sp: ActInput,
): Record<ActJoint, V3> | undefined {
  const p = pose3(c, sp);
  if (!p) return undefined;
  const out = {} as Record<ActJoint, V3>;
  for (const k of Object.keys(p.joints) as ActJoint[]) out[k] = rigOf(p.joints[k]);
  return out;
}

/**
 * Bàn tay người 3D vẽ ra, toạ độ thế giới rig: `at` tâm lòng bàn tay, `palm` pháp tuyến lòng bàn tay (hướng lòng tay
 * quay về, phía các ngón gập vào), `finger` hướng dọc bàn tay từ cổ tay ra đầu ngón; hai vectơ đơn vị. `forward` là
 * hướng mặt người nằm ngang, `out` hướng ngang từ thân ra phía tay ấy. `skin`: các điểm ngoài cùng của bàn tay theo dáng
 * đang vẽ — giữa lòng tay, giữa mu tay, hai mép lòng bàn tay, đầu ngón cái, trỏ, giữa, út (trên trục đốt)
 */
export interface ActPalm {
  at: V3;
  palm: V3;
  finger: V3;
  forward: V3;
  out: V3;
  skin: V3[];
}

/**
 * Bàn tay hai bên (`R` phải, `L` trái người) đúng như `act` đặt: cùng khung `Rw = Re · wristTurn` của `actJoints`.
 * Khung bàn tay `handFrames`: lòng tay quay về `−side · x`, ngón mọc theo −y. Chỉ người mặc đồ (`palette.clad`) có bàn
 * tay; người que hay không có `world` thì không có gì. docs/01-rig.md#hướng-lòng-bàn-tay
 */
export function actPalms(
  c: Pick<CharacterData, "rig" | "pieces" | "palette" | "head">,
  sp: ActInput,
): Record<"R" | "L", ActPalm> | undefined {
  const p = pose3(c, sp);
  if (!p?.wrists) return undefined;
  const forward = rigDir(mv(p.Rr, [0, 0, 1]));
  const out = {} as Record<"R" | "L", ActPalm>;
  for (const k of ["R", "L"] as const) {
    const side = k === "R" ? -1 : 1;
    const { at, R, k: size, long, v } = p.wrists[k];
    const world = (l: V3) => rigOf(add(at, mv(R, l)));
    const mid = (-HAND_BONES.palm.len * long) / 2;
    const [thick, half] = HAND_BONES.palm.half.map((h) => h * size);
    const f = handFrames(v, side, size, long);
    const tip = (n: HandPiece) => world(add(f[n].o, mv(f[n].R, [0, -f[n].len, 0])));
    out[k] = {
      at: world([0, mid, 0]),
      palm: rigDir(unit(mv(R, [-side, 0, 0]))),
      finger: rigDir(unit(mv(R, [0, -1, 0]))),
      forward,
      out: rigDir(mv(p.Rr, [side, 0, 0])),
      skin: [
        world([-side * thick, mid, 0]),
        world([side * thick, mid, 0]),
        world([0, mid, half]),
        world([0, mid, -half]),
        tip("thumb1"),
        tip("index1"),
        tip("middle1"),
        tip("pinky1"),
      ],
    };
  }
  return out;
}

/** Người mẫu cho `reachEstimate`: người mặc đồ đầu `human` số đo mặc định */
let sample: ActCharacter | undefined;

/**
 * Cổ tay hệ thân `[tiến, y, ra ngoài]` (rig, `height = 1`) ước lượng cho một đích JSON trên người mẫu đứng thẳng, thân cúi
 * `torso`: `at` của mẫu đích theo mốc (`Reach.at`), góc dự phòng của người 2D (`reachAngles`). Người 3D không đọc số này
 */
export function reachEstimate(
  r: {
    at?: readonly number[];
    to?: BodyMark;
    side?: "same" | "other";
    offset?: readonly number[];
    point?: HandPoint;
  },
  torso = 0,
): [number, number, number] {
  if (r.at && (!r.point || r.point === "wrist")) return [r.at[0], r.at[1], r.at[2]];
  if (!sample) {
    const c = defaultCharacter();
    c.palette.clad = true;
    c.head.form = "human";
    sample = c;
  }
  const z3 = [0, 0, 0];
  const T = trunk3(sample, {
    pose: { af: z3, an: z3, lf: z3, ln: z3, torso, head: z3, stretch: [1, 1, 1, 1, 1, 1, 1, 1] },
    world: { hip: z3, yaw: Math.PI / 2, s: 1, flip: false },
  })!;
  const side = -1;
  const k = T.hand ? T.hand.k : 1;
  const long = T.hand ? T.hand.long : 1;
  const p = r.to
    ? markAt(T, { to: r.to, side: r.side, offset: r.offset }, side, undefined)
    : T.frame.point(mul([side * r.at![2], -r.at![1], r.at![0]], 0.01));
  // bàn tay dựng đứng, lòng tay vào thân: điểm khác cổ tay lùi về cổ tay dọc trục ấy
  const pt = handPoint(r.point ?? (r.to ? "palm" : "wrist"), HAND_REST, side, k, long);
  const w = sub(p, pt);
  return [w[2] * 100, -w[1] * 100, side * w[0] * 100];
}

/**
 * Chỗ của mốc thân `to` (toạ độ thế giới rig) trên người `c` ở khung `sp`, cho tay bên `hand` (`R` / `L`): đúng điểm mà
 * đích theo mốc nhắm tới, gồm `offset`. Mốc trên tay kia đọc tay kia như đang vẽ. docs/01-rig.md#đích-theo-mốc
 */
export function bodyMarkAt(
  c: ActCharacter,
  sp: ActInput,
  ref: { to: BodyMark; side?: "same" | "other"; offset?: readonly number[] },
  hand: "R" | "L" = "R",
): V3 | undefined {
  const T = trunk3(c, sp);
  if (!T) return undefined;
  const side = hand === "R" ? -1 : 1;
  const r = solveActing(T, sp).input;
  const T2 = { ...T, P: r.pose, W: r.world! };
  const A = arm3(T2, r.pose, r.world?.hands, -side);
  const other: HandState = {
    at: A.wr,
    R: A.Rw,
    k: T.hand ? T.hand.k * T.s : 1,
    long: T.hand ? T.hand.long * T.s : 1,
    v: A.v,
    side: -side,
    ...(!T.hand && { stick: mul(A.grip, T.s) }),
  };
  return rigOf(markAt(T, ref, side, other));
}
