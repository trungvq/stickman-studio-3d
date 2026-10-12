import { D, RIG } from "./constants";
import { lengths } from "./geometry";
import { REACH_ELBOW } from "./ik";
import type { V3 } from "./lens";
import { limbWidths, type CharacterData, type Garment } from "./schema";
import { garmentShoulder, garmentSocket, type P2, type Rig } from "./torso";

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

/**
 * Gốc vai `[ngang, cao trên hông]`, nửa khoảng hai gốc chân của người 3D, đơn vị three, và góc tay choãi. `arm` (px,
 * `cladArm`) có thì gốc vai ở `garmentSocket`: nắp ống tay ôm góc vai áo, `bicep` nở nó ra ngoài sườn áo; tay buông choãi
 * `SPLAY3` như người que, dưới nách sườn áo lùi tới cách mép trong khuỷu một `CLAD_GAP` (`room`). Ngang hông, mép trong
 * cẳng tay cách mép ngoài gốc đùi `thigh` ít nhất một `CLAD_GAP`: hông rộng hơn thì tay choãi thêm. Không thì gốc vai trên
 * viền thân ở độ cao `shoulderDrop`
 */
export const roots3 = (
  garment: Partial<Garment> | undefined,
  rig: Rig,
  arm?: number,
  bicep = 0,
  thigh = 0,
) => {
  const hip = rig.hipHalf / 100;
  if (!arm)
    return {
      shoulder: [
        garmentShoulder(garment, rig) / 100,
        (RIG.torso * rig.height - rig.shoulderDrop) / 100,
      ] as readonly [number, number],
      hip,
      splay: SPLAY3,
    };
  const cap = arm * (1 + bicep);
  const at = garmentSocket(garment, rig, arm, cap);
  const len = [RIG.upperArm * rig.height, RIG.foreArm * rig.height] as const;
  const k = arm / CLAD_TAPER.arm[0];
  const r = [cap, k * CLAD_TAPER.arm[1], k * CLAD_TAPER.arm[2]] as const;
  const hipEdge = rig.hipHalf + thigh;
  const fits = (splay: number) => armInner({ at, cap, splay, r, len }, 0) >= hipEdge;
  let splay = SPLAY3;
  if (!fits(splay)) {
    let [lo, hi] = [SPLAY3, 1.2];
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    splay = hi;
  }
  const side = armInner({ at, cap, splay, r, len }, at[1] + len[0] * Math.cos(splay));
  return {
    shoulder: [at[0] / 100, -at[1] / 100] as readonly [number, number],
    hip,
    splay,
    room: { at, cap, splay, r, len, side } satisfies ArmRoom,
  };
};

export type Limb3 = "af" | "an" | "lf" | "ln";

/** Đích cổ tay như `Reach` của lõi, nhận cả mảng chỉ đọc */
export interface ReachIn {
  at: readonly number[];
  elbow?: readonly number[];
  w: number;
}

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

/** Hệ three, y lên: khớp giữa khi rủ thẳng, phương dự phòng của IK */
const DOWN3: V3 = [0, -1, 0];

/** IK hai đoạn trong hệ three: khớp giữa trong mặt phẳng qua trục gốc → đích và `pole`, về phía `pole` */
export function twoBone3(S: V3, T: V3, l1: number, l2: number, pole: V3): [V3, V3] {
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
  return [add(add(S, mul(n, a)), mul(u, h)), add(S, mul(n, reach))];
}

/** Hệ thân của một người 3D trong three: điểm và hướng hệ thân (đã đổi trục, chưa nhân 0,01) ra thế giới */
export interface ActFrame {
  point: (v: V3) => V3;
  dir: (v: V3) => V3;
}

/**
 * Tay bên `side` (`-1` tay phải) với tới đích hệ thân `rb` rồi đích thế giới rig `rw`, hoà trên vị trí
 * cổ tay theo `w`: `S`, `E`, `T` là vai, khuỷu, cổ tay của chuỗi góc trong three. Trả khuỷu và cổ tay
 * mới, không có đích thì `undefined`. Đích hệ thân soạn ở `height = 1`, nhân `height` như `reachToWorld`. `act` và
 * `actJoints` cùng gọi.
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
): [V3, V3] | undefined {
  if (!(rb && rb.w > 0) && !(rw && rw.w > 0)) return undefined;
  const body = ([f, y, o]: readonly number[]): V3 => [side * o, -y, f];
  let T = T0;
  const axis = unit(sub(T, S));
  const bend = sub(sub(E, S), mul(axis, dot(sub(E, S), axis)));
  let pole = dot(bend, bend) > 1e-10 ? unit(bend) : unit(frame.dir(body(REACH_ELBOW)));
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

type M3 = [number, number, number, number, number, number, number, number, number];
const rx = (a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
};
const ry = (a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
};
const rz = (a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};
const mm = (a: M3, b: M3): M3 => {
  const o = new Array(9).fill(0) as M3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return o;
};
const mv = (m: M3, v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

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
    hands?: { near?: ReachIn; far?: ReachIn };
  };
}

/**
 * Khớp của người 3D đúng như `act` đặt người que three: cùng khung xương (`bones3`, `roots3`), cùng
 * luật đọc góc (`actAngles`) và cùng IK (`actReach`), trả trong toạ độ thế giới rig. Không có `world`
 * thì không có gì. `check` đo giật tay chân trên các khớp này. docs/01-rig.md#khớp-người-3d-vẽ-ra
 */
export function actJoints(
  c: Pick<CharacterData, "rig" | "pieces" | "palette" | "head">,
  sp: ActInput,
): Record<ActJoint, V3> | undefined {
  const W = sp.world;
  if (!W) return undefined;
  const P = sp.pose;
  const B = bones3(c.rig.height);
  const pal = c.palette;
  const w = limbWidths(pal);
  const arm = pal.clad ? cladArm(w.sleeve, c.rig.stroke) : undefined;
  const roots = roots3(
    c.pieces.torso.garment,
    c.rig,
    arm,
    pal.bicep,
    cladThigh(w.trouser, c.rig.stroke),
  );
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
  const tag = (side: number) => (side === -1 ? "R" : "L");

  for (const side of [near, -near]) {
    const isNear = side === near;
    const [a, b, sp] = actAngles(P, isNear ? "ln" : "lf", seated);
    const hipJ = at(hips, Rr, [side * roots.hip, 0, 0]);
    // Euler 'ZXY' của three: Rz · Rx · Ry, quay quanh y bằng 0
    const Rh = mm(Rr, mm(rz(side * sp * D), rx(-a * D)));
    const knee = at(hipJ, Rh, [0, -B.thigh * (st[isNear ? 6 : 4] ?? 1), 0]);
    const Rk = mm(Rh, rx(-b * D));
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

  const frame: ActFrame = { point: (v) => at(root, Rr, v), dir: (v) => mv(Rr, v) };
  for (const side of [near, -near]) {
    const isNear = side === near;
    const ch = isNear ? "an" : "af";
    const [a, b, sp] = actAngles(P, ch, false);
    const sh = at(hips, Rs, [side * roots.shoulder[0], roots.shoulder[1], 0]);
    const Rsh = mm(Rs, mm(rz(side * (roots.splay + sp * D)), rx(-a * D)));
    const l1 = B.upperArm * (st[isNear ? 2 : 0] ?? 1);
    const l2 = B.foreArm * (st[isNear ? 3 : 1] ?? 1);
    const el = at(sh, Rsh, [0, -l1, 0]);
    const wr = at(el, mm(Rsh, rx(-b * D)), [0, -l2, 0]);
    const ik = actReach(
      frame,
      side,
      [sh, el, wr],
      l1 * s,
      l2 * s,
      P.reach?.[ch],
      isNear ? W.hands?.near : W.hands?.far,
      B.height,
    );
    out[`shoulder${tag(side)}` as ActJoint] = sh;
    out[`elbow${tag(side)}` as ActJoint] = ik ? ik[0] : el;
    out[`wrist${tag(side)}` as ActJoint] = ik ? ik[1] : wr;
  }
  out.hip = hips;
  const rigOf = (p: V3): V3 => [p[0] * 100, -p[1] * 100, -p[2] * 100];
  for (const k of Object.keys(out) as ActJoint[]) out[k] = rigOf(out[k]);
  return out;
}
