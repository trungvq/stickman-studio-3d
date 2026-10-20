import { D, RIG, TORSO_DEPTH } from "./constants";
import { chibiShape } from "./face";
import { lengths } from "./geometry";
import { handPoint } from "./hand";
import { faceSurface, HUMAN_HEAD, humanEar, humanSkull, SKULL3 } from "./humanHead";
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
  type Aim,
  type HandPoint,
  type BodyMark,
  type ReachPoint,
  type ReachTerm,
} from "./bodyMark";
import {
  gripPoint,
  heldPoint,
  type GripFrame,
  type HeldItemSpec,
  type ReachHold,
} from "./heldItem";
import { limbWidths, wornPalette, type CharacterData, type Garment, type Skirt } from "./schema";
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
 * Khung xương, thân, hai đoạn tay và mốc thân của người 3D, không phụ thuộc phần giải đích (`act3.ts`): `graspArm` và
 * `graspSolve` đọc từ đây
 */

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
 * như đùi với ống chân. Cổ tay `0,53`: bề ngang cổ tay chừng `0,75` bề ngang lòng bàn tay (`cladHand`), dày hơn lòng tay
 * chừng `1,2` lần
 */
export const CLAD_TAPER = {
  arm: [1.12, 0.88, 0.53],
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
  /** Gốc đùi: tâm cách trục, bán kính, px (`cladThigh`) */
  thigh?: readonly [number, number];
}

/** Mút gốc đùi người mặc đồ dẹt bấy nhiêu lần bán kính, nhô lên trên khớp hông */
export const THIGH_ROOT = 0.35;
/**
 * Sườn áo người mặc đồ rộng hơn mép ngoài gốc đùi ít nhất bấy nhiêu px từ khớp hông xuống gấu: tay buông sát hông thì
 * sườn áo lùi tới đúng mép đùi, mặt đùi tiếp xúc mặt thân lòi qua góc bo gấu thành chấm mực
 */
export const THIGH_CLEAR = 1;
/** Sườn áo nở dần tới mép gốc đùi cộng `THIGH_CLEAR` trong bấy nhiêu px trên khớp hông, phủ cả mút gốc đùi */
export const THIGH_RAMP = 12;
/** Sườn áo ở độ cao gấu hẹp hơn mép gốc đùi cộng `THIGH_CLEAR` quá bấy nhiêu px thì giữ dáng áo, đùi lòi ra dưới gấu */
export const THIGH_REACH = 3;

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
 * mỏng, ngực và lưng phẳng một mạch, nhìn ngang không gù. Từ khớp hông (gấu cao hơn thì từ gấu) xuống gấu sườn áo không
 * hẹp hơn mép ngoài gốc đùi (`room.thigh`) ở độ cao ấy cộng `THIGH_CLEAR`, kể cả ở góc bo gấu; nở dần trong `THIGH_RAMP` px
 * phía trên
 */
export function cladProfile(pts: readonly P2[], room: ArmRoom): { pts: P2[]; depth: number[] } {
  const side = ([a, y]: P2): P2 => {
    const u = Math.max(0, Math.min(1, (y - room.at[1]) / room.cap));
    const lim = armSide(room, y);
    return [a > lim ? a + (lim - a) * u * u * (3 - 2 * u) : a, y];
  };
  // gấu cao hơn khớp hông thì chỉ phải phủ mút gốc đùi ở độ cao gấu
  const low = Math.min(0, pts[pts.length - 1][1]);
  const v0 = room.thigh ? low / (THIGH_ROOT * room.thigh[1]) : -1;
  const edge =
    room.thigh && v0 > -1
      ? room.thigh[0] + room.thigh[1] * Math.sqrt(1 - v0 * v0) + THIGH_CLEAR
      : undefined;
  // áo hẹp hẳn hơn hông (chỗ rộng nhất quanh hông, trước góc bo gấu) thì đùi lòi ra rõ dưới gấu như quần rộng hơn áo,
  // không phải chấm: giữ dáng áo
  const sides = pts.map(side);
  const near =
    edge !== undefined &&
    edge - Math.max(...sides.filter(([, y]) => y >= low - THIGH_RAMP).map(([b]) => b)) <=
      THIGH_REACH &&
    sides.some(([b, y]) => y >= low - THIGH_RAMP && b < edge);
  // hàng mặt cắt thưa: thêm hàng trong quãng nở để sườn áo cong êm, vỏ viền không lòi qua chỗ gãy lõm
  const rows = [...pts];
  if (near)
    for (let ye = low - THIGH_RAMP; ye <= low; ye += 2) {
      const i = rows.findIndex(([, y]) => y > ye);
      if (i <= 0 || rows[i - 1][1] >= ye - 0.3 || rows[i][1] <= ye + 0.3) continue;
      const [[a0, y0], [a1, y1]] = [rows[i - 1], rows[i]];
      rows.splice(i, 0, [a0 + ((a1 - a0) * (ye - y0)) / (y1 - y0), ye]);
    }
  const out = rows.map((p): P2 => {
    const [b, y] = side(p);
    if (!near || b >= edge!) return [b, y];
    const v = Math.max(0, Math.min(1, 1 + (y - low) / THIGH_RAMP));
    // tay buông vẫn cách sườn áo ít nhất `CLAD_GAP - THIGH_CLEAR`
    return [
      Math.max(b, Math.min(b + (edge! - b) * v * v * (3 - 2 * v), armSide(room, y) + THIGH_CLEAR)),
      y,
    ];
  });
  return { pts: out, depth: out.map(([a, y]) => CLAD_DEPTH * Math.min(a, armSide(room, y))) };
}

/** Bàn tay xoè cỡ `1` dài chừng này, đơn vị three; xoè không dài quá `OPEN_REACH` cẳng tay */
const OPEN_LEN = 0.19;
const OPEN_REACH = 0.55;

/**
 * Cỡ bàn tay người mặc đồ theo `rw` (three) — `0,8` nửa bề dày tay (`cladHand`), không theo ống cổ tay `CLAD_TAPER`: nhân vào
 * bề ngang `HAND_BONES` (`handFrames`, `handRig`)
 */
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
    // cạp liền mặt thân áo như `sculptSkirt` nhận `body`
    const torso = profile(garmentOf(garment), rig, inset).pts;
    const [aW, dW] = profileAt(
      torso,
      torso.map(([a]) => TORSO_DEPTH * a),
      -skirt.rise * h,
    );
    const leg = b.trouser / 2;
    const side = skirtSide(skirt, h, aW, dW, rig.hipHalf, leg, leg, inset);
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
    const room = { at, cap, splay, r, len, thigh: [rig.hipHalf, thigh] as const };
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
  /** Món đang cầm (`world.hands[].hold`): dáng ngón, điểm `item:<mốc>` và ý định theo chỗ cầm */
  hold?: ReachHold;
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
    /** Ống kính của scene: mắt (thế giới rig) cho ý định quay món về ống kính */
    lens?: { eye: readonly number[] };
    /** Mắt ống kính ở khung này (thế giới rig), đè `lens.eye` khi ống kính chạy theo `t` */
    eye?: readonly number[];
  };
}

/** Phần JSON nhân vật mà người 3D đọc cho khớp, bàn tay và mốc thân (`face` cho mốc trên mặt) */
export type ActCharacter = Pick<CharacterData, "rig" | "pieces" | "palette" | "head"> & {
  face?: Partial<Pick<CharacterData["face"], "offsetY" | "eyeGap" | "mouthGap">>;
};

/** Thân người 3D ở một tư thế, chưa có tay: khớp chân, thân, cổ, đầu, khung từng phần, mọi số đo tay cần (three) */
export function trunk3(c: ActCharacter, sp: ActInput) {
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

export type Trunk3 = NonNullable<ReturnType<typeof trunk3>>;

/**
 * Giới hạn gập cổ tay khi rig tự giải lòng tay (độ); xoay cẳng tay giữ `−90..90` như JSON. Quá chừng `50°` cổ tay khối
 * của người que trông gãy: ý định vượt thì món lệch thật và `check` báo khớp kẹp
 */
export const AIM_BEND = 50;
/** Giới hạn lệch cổ tay (số thứ ba của tay) khi rig tự giải hướng ngón, độ; cùng lý do với `AIM_BEND` */
export const AIM_DEV = 20;
/** Giới hạn xoay cẳng tay khi rig tự giải cổ tay, độ: `−TURN_MAX..TURN_MAX` như JSON */
export const TURN_MAX = 90;

/** Bàn tay một bên đang ở đâu: cổ tay, khung `Rw`, cỡ (đã nhân `world.s`), số bàn tay — mốc `other…` đọc nó */
export interface HandState extends HoldState {
  at: V3;
  R: M3;
  k: number;
  long: number;
  v: readonly number[];
  side: number;
  stick?: V3;
}

/** Phần cầm đồ của một bàn tay: tâm nắm của dáng chỗ cầm, và (tay mang món) món trong khung bàn tay */
export interface HoldState {
  gripAt?: V3;
  G?: GripFrame;
  spec?: HeldItemSpec;
}

/** Điểm `point` của bàn tay đang ở `h`, three: `item:<mốc>` là mốc của món tay ấy mang, tay không mang món thì là tâm nắm */
export function handAt(h: HandState, point: ReachPoint): V3 {
  if (point === "wrist") return h.at;
  if (point.startsWith("item:")) {
    if (h.G && h.spec) return add(h.at, mv(h.R, gripPoint(h.G, heldPoint(h.spec, point.slice(5)))));
    point = "grip";
  }
  if (point === "grip" && h.gripAt) return add(h.at, mv(h.R, h.gripAt));
  if (h.stick) return add(h.at, mv(h.R, h.stick));
  return add(h.at, mv(h.R, handPoint(point as HandPoint, h.v, h.side, h.k, h.long)));
}

/** Số đo đầu, thân, đùi cho mốc; tính một lần mỗi thân */
export function markShape(T: Trunk3) {
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
export function markAt(
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
    case "head":
      p = H;
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
