import { AIM_BEND, AIM_DEV, markShape, TURN_MAX, type Trunk3 } from "./arm3";
import { AIM_GAP } from "./constants";
import { armInput, solvePhi, type ArmInput, type ArmSeg, type ArmSol } from "./graspArm";
import {
  acrossMiss,
  acrossOf,
  GRIP_GROUPS,
  groupNeeds,
  PINCH_ALONG,
  holdDefaults,
  longEdges,
  SHEET_INSET,
  spanAt,
  supportFaces,
  THUMB_TOWARD_SPAN,
  THUMB_TOWARD_STEP,
  tooThick,
  UPRIGHT_W,
  type ChoiceKey,
  type GroupSpec,
  type PoseRef,
  type PoseSpec,
  type RangeChoice,
  type RoleMap,
} from "./graspGroups";
import {
  HAND_BONES,
  HAND_DOF,
  HAND_PIECES,
  HAND_POSES,
  handVec,
  mixHand,
  wristTurn,
  type HandPose,
  type HandVec,
} from "./hand";
import { handSkin, skinHand, type HandSkin } from "./handMesh";
import {
  HELD_FIT,
  heldDistance,
  heldFit,
  skinBulge,
  skinDepth,
  skinPieces,
  skinUnder,
} from "./heldFit";
import {
  alongFrac,
  aroundOf,
  axialAt,
  bulgeToward,
  edgeFrame,
  edgePoint,
  faceRho,
  ownAlong,
  handDims,
  itemGeom,
  type AlongName,
  type BoxFeature,
  type DiscFeature,
  type FaceFeature,
  type Feature,
  type FeatureKind,
  type HandDims,
  type ItemGeom,
  type LatheFeature,
  type RodFeature,
  type SideName,
  type SlabFeature,
} from "./heldGeom";
import {
  gripCenter,
  graspLink,
  gripPoint,
  groupHold,
  handAxes,
  heldBase,
  HELD_FINGERS,
  type GraspHand,
  type GripFrame,
  type GroupId,
  type HeldItemSpec,
  type HeldShape,
  type SceneHold,
} from "./heldItem";
import { add3, cross3, dot3, matMul, matVec, scale3, sub3, type M3, type V3 } from "./lens";
import type { ItemPose } from "./scene";

/**
 * Chỗ tiếp xúc của nhóm cầm trên khối hình (`CONTACTS`) và khung cầm dựng từ nó (`graspFrame`): món trong khung bàn tay,
 * bàn tay tổng hợp, dáng gốc, vai trò ngón. Món không bao giờ lật gương. docs/11-nhom-cam.md mục 3, 5
 */

/** Lựa chọn của một chỗ cầm (docs/11 mục 4); `graspFrame` trả bản đã điền mặc định, `along` và `slant` là số */
export interface GraspChoice {
  part?: string;
  feature?: FeatureKind;
  /** Chỉ số khối hình trong `itemGeom(spec).features`: định danh khối khi một phần có nhiều khối cùng loại */
  featureIndex?: number;
  edge?: SideName | number;
  along?: AlongName | number;
  thumb?: SideName | "up" | "down";
  variant?: string;
  slant?: "in" | "low" | "high" | number;
  around?: number;
  tilt?: number;
  psi?: number;
  inset?: number;
}

/** Đầu vào của một chỗ tiếp xúc: lựa chọn đã điền mặc định, `slant` và `tilt` theo độ */
export interface ContactInput {
  geom: ItemGeom;
  feature: Feature;
  side: number;
  dims: HandDims;
  edge?: SideName | number;
  along: AlongName | number;
  thumb?: string;
  slant: number;
  tilt: number;
  /** Độ quanh trục trụ, thanh (`axialAt`) */
  around?: number;
  /** Độ, hướng ngón đo từ pháp tuyến trong của cạnh (`platform`) */
  psi?: number;
  /** Cạnh tới tâm nắm theo pháp tuyến trong (`platform`) */
  inset?: number;
  /** Đầu cao của cạnh, khung món (`edgeHigh`); bỏ trống là `m × F` */
  high?: V3;
  /** Hình va chạm của món, khung món */
  shape?: readonly HeldShape[];
  /** Mốc `tip` của món, khung món */
  tip?: V3;
  /**
   * Đỉnh da lòng tay ở dáng gốc tính từ tâm nắm, đơn vị món, toạ độ theo `palm`, `fingers`, `palm × fingers`; `at` là số đo
   * ở chỗ tiếp xúc như `GraspContact`
   */
  palmSkin?: (
    at?: Pick<GraspContact, "thick" | "radius" | "thumbRadius" | "width">,
  ) => readonly V3[];
  /** Đỉnh da đốt ngọn của ngón cái, trỏ hay giữa ở dáng gốc, như `palmSkin` */
  fingerSkin?: (
    finger: SkinFinger,
    at?: Pick<GraspContact, "thick" | "radius" | "thumbRadius" | "width">,
  ) => readonly V3[];
}

export type SkinFinger = "thumb" | "index" | "middle";

/** Tâm nắm `at`, lòng tay `palm` và ngón `fingers` (trực giao với lòng tay) trong khung món; `along` là tỉ lệ đã giải */
export interface GraspContact {
  at: V3;
  palm: V3;
  fingers: V3;
  along: number;
  /** Bề dày đo ở chỗ ngón ôm, thay bề dày khối hình khi hoà dáng (`by: "thick"`) */
  thick?: number;
  /** Bán kính trụ tiện ở chỗ cầm (`axialAt`), thay `rMax` khi hoà dáng (`by: "radius"`) */
  radius?: number;
  /** Bán kính tra bảng ngón cái (`PoseSpec.thumb`); bỏ trống là `radius` */
  thumbRadius?: number;
  /** Bề rộng được kẹp ở chỗ cầm, thay số đo khối hình khi hoà dáng (`by: "width"`) */
  width?: number;
}

export type ContactFn = (x: ContactInput) => GraspContact;

export interface GraspFrame {
  G: GripFrame;
  hand: GraspHand;
  /** Dáng gốc (`HAND_DOF`): dáng đóng hoà sang dáng mở theo số đo món */
  pose: HandVec;
  roles: RoleMap;
  feature: Feature;
  choice: GraspChoice;
}

const D2R = Math.PI / 180;
const EPS = 1e-6;
const AXES: V3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => scale3(a, 1 / (len3(a) || 1));
const perp = (v: V3, n: V3): V3 => sub3(v, scale3(n, dot3(v, n)));
const mix2 = (a: V3, ca: number, b: V3, cb: number): V3 => add3(scale3(a, ca), scale3(b, cb));

/** `sheet` `pinch`: `n = a · F + b · f` (fixture `bang-gia#doc`) */
const PINCH_PALM: readonly [number, number] = [0.7654, 0.6436];
/** `pinch`: tâm nắm cách mặt bốn ngón (mặt kia của `F`) ngần này, mọi bề dày (giữa bề dày của `bang-gia#doc`, dày 1) */
const PINCH_BACK = 0.5;
/** `pinch`: tấm dày hơn `2 · PINCH_BACK` thì tâm nắm lùi ra mép ngần này lần phần dày thêm (mép lọt sâu vào kẽ cái–trỏ) */
const PINCH_OUT = 1.3;
/** `rim`: thụt bớt ngần này lần bề dày, không dưới `RIM_MIN` (tấm mỏng lọt sâu vào kẽ cái–trỏ, mép dày tì gốc ngón) */
const RIM_OUT = 0.8;
const RIM_MIN = 1;
/** `rim`: tâm nắm cách mặt ngón cái `F` ngần này, tấm mỏng hơn hai lần thì giữa bề dày (fixture `tom-hum#nhac`) */
const RIM_TOP = 1.9;
/** `rim`: dáng hoà theo bề dày thật của tấm ở ngần này vào trong tâm nắm (vành đĩa mỏng hơn hộp bao), đo `RIM_STEPS` điểm */
const RIM_PROBE = 1;
const RIM_STEPS = 24;
/**
 * `palmBox` (fixture `dien-thoai#doc`), `cylinder` `flat`: ngón chếch về đầu trên trong mặt máy, độ; tâm nắm lệch về cạnh đầu
 * ngón và sau mặt sau, đơn vị món
 */
export const BOX_RISE = 20;
const BOX_SHIFT = 2;
const BOX_GAP = 2.8;
const SLOPE = Math.sin(30 * D2R);
/** `wrap`: lòng tay ngả ngần này lần góc dốc mặt món trên `±WRAP_HALF · W` dọc trục (fixture `chai-dia#co`), tối đa 45° */
const WRAP_GAIN = 1.6;
const WRAP_HALF = 0.3;
const WRAP_STEPS = 5;
const WRAP_TILT_MAX = 45;
/** `wrap`: da lòng tay cách mặt món ngần này, đơn vị món (fixture `chai-dia#co` hở lòng 0,6–0,9) */
const WRAP_GAP = 0.7;
/** `wrap`: ngón cái tra bảng theo bán kính nhỏ hơn của chỗ cầm và chỗ cách ngần này lần `W` về phía ngón cái (vai chai thắt) */
const WRAP_THUMB_AHEAD = 0.5;
/** `wrap`: độ chếch (`slant`) có hiệu lực đủ từ số đo ngón cái `WRAP_BIG[1] · W`, hoà từ `WRAP_BIG[0]`; trụ mảnh hơn không chếch */
const WRAP_BIG = [0.36, 0.42] as const;
/** `bowl` `side`: lòng tay ngả theo dốc thành tối đa ngần này độ (fixture `chen#kep` lòng song song trục) */
const BOWL_TILT_MAX = 4;
/** `bowl` `side`: da lòng tay cách thành ngần này, đơn vị món (âm là áp lún nhẹ; fixture `chen#kep` lún 2) */
const BOWL_GAP = -0.6;
/** `bowl` `pinch`: da ngón cái và da trỏ – giữa ở dáng gốc cách thành ngần này, đơn vị món (âm là ép nhẹ); số vòng dò */
const PINCH_GAP = -0.2;
const PINCH_ITER = 6;
/** `pinch` trên hình: số vòng Newton, sai số khe, bước sai phân, bước dời lớn nhất — đơn vị món */
const PINCH_NEWTON = 12;
const PINCH_ROUNDS = 2;
/** `pinch`: trục chén nghiêng khỏi trục `n × f` của bàn tay tối đa ngần này độ để chỗ chạm ngón cái, ngón trỏ ngang nhau */
const PINCH_TILT_MAX = 25;
const PINCH_TOL = 0.02;
const PINCH_STEP = 0.1;
const PINCH_MOVE = 2;
/** `pinch`: da lòng tay cách thành ít nhất ngần này, đơn vị món */
const CUP_PALM_MIN = 1;
/**
 * `card` `lateral` (dáng `card`), khung bàn tay (lòng, ngón, phía ngón cái): pháp tuyến thẻ từ mặt sườn ngón trỏ sang mặt
 * đệm ngón cái (ngược hướng gập của đốt ngọn ngón cái), và hướng thẻ chạy ra khỏi chỗ kẹp — ra ngoài nắm tay
 */
export const CARD_NORMAL: V3 = [0.111, -0.687, 0.718];
export const CARD_OUT: V3 = [0.546, 0.646, 0.533];
/** `lateral`: chỗ kẹp (`HAND_GRIPS.card`) thụt vào trong mép ngần này lần `W` */
export const CARD_INSET = 0.12;
/** `edges`: đầu ngón thấp nhất cách mặt dưới tấm (mặt bàn) ngần này, đơn vị món; bề dày đo ở ngần này vào trong mép */
export const EDGES_LIFT = 0.1;
const EDGES_PROBE = 0.5;
const EDGES_ITER = 4;
/**
 * `chopsticks` (fixture `dua#cam`): lòng tay `n = CHOP_PALM[0] · b + CHOP_PALM[1] · c`, tâm nắm cách đường giữa hai que
 * `CHOP_OFF` về phía `b` (trên que kề ngón cái), đơn vị món
 */
const CHOP_PALM: readonly [number, number] = [-0.5, -Math.sqrt(3) / 2];
const CHOP_OFF = 2.4;
/**
 * `pen` (fixture `but#viet`): lòng tay, ngón và tâm nắm (lần `W`, tính từ điểm trục ở `along`) theo `d` trục từ ngòi về đuôi,
 * `ρ` (`around` 0), `σ = d × ρ` của tay phải (tay trái soi gương qua mặt `d`, `ρ`)
 */
const PEN_PALM: V3 = [-0.7739, 0.4869, -0.4049];
const PEN_FINGERS: V3 = [-0.4092, -0.8725, -0.2671];
const PEN_OFF: V3 = [-0.11, 0.1852, -0.1555];
/** `platform`: da lòng tay cách mặt đỡ ngần này, đơn vị món */
const PLATFORM_GAP = 0.15;
/** Dò mặt hình: coi là chạm khi cách dưới ngần này, đơn vị món */
const TOUCH = 0.01;

/** Hướng trục `v` lấy dấu theo tham chiếu đầu tiên không vuông góc với nó */
const signed = (v: V3, refs: V3[]): V3 => {
  for (const r of refs) {
    const s = dot3(v, r);
    if (Math.abs(s) > EPS) return s < 0 ? neg(v) : v;
  }
  return v;
};

function sheetEdge(x: ContactInput, inset: number) {
  const fr = edgeFrame(
    x.feature as SlabFeature | DiscFeature,
    x.edge as SideName | number,
    x.thumb as SideName,
    x.high,
  );
  const along = alongFrac(x.along, fr.len, x.dims.W);
  return { ...fr, along, at: sub3(edgePoint(fr, along), scale3(fr.m, inset)) };
}

/** Ngón vào trong tấm (`−m`) quay `slant` về đầu cao trong mặt tấm */
const inward = (m: V3, e: V3, slant: number): V3 =>
  mix2(neg(m), Math.cos(slant * D2R), e, Math.sin(slant * D2R));

/** Đoạn vật liệu dọc `F` ở `inset` vào trong mép, tính từ mặt giữa khối hình: hai mút và bề dày; không có hình thì hộp bao */
function sheetSpan(x: ContactInput, inset: number) {
  const t0 = (x.feature as SlabFeature | DiscFeature).t;
  const { F, at } = sheetEdge(x, inset);
  const [lo, hi] = (x.shape && spanAt(x.shape, at, F, t0)) ?? [-t0 / 2, t0 / 2];
  return { lo, hi, t: hi - lo };
}

const pinch: ContactFn = (x) => {
  const { lo, t } = sheetSpan(x, SHEET_INSET.pinch);
  const d = Math.max(0, SHEET_INSET.pinch - PINCH_OUT * (t - 2 * PINCH_BACK));
  const { m, e, F, at: mid, along } = sheetEdge(x, d);
  const f = inward(m, e, x.slant);
  const [a, b] = PINCH_PALM;
  const at = add3(mid, scale3(F, lo + PINCH_BACK));
  return { at, along, palm: unit(mix2(F, a, f, b)), fingers: unit(mix2(f, a, F, -b)), thick: t };
};

const flat: ContactFn = (x) => {
  const { lo, hi, t } = sheetSpan(x, SHEET_INSET.flat);
  const { m, e, F, at: mid, along } = sheetEdge(x, SHEET_INSET.flat);
  const at = add3(mid, scale3(F, (lo + hi) / 2));
  return { at, along, palm: F, fingers: unit(inward(m, e, x.slant)), thick: t };
};

/**
 * Kẹp bên (Feix #16): đệm ngón cái một mặt thẻ (`F`), mặt kia tựa sườn ngón trỏ; chỗ kẹp giữa bề dày thật, thụt
 * `CARD_INSET · W` vào trong mép; thẻ chạy vào trong (`−m` quay `slant`) theo `CARD_OUT`
 */
const lateral: ContactFn = (x) => {
  const { m, e, F, at: mid, along } = sheetEdge(x, CARD_INSET * x.dims.W);
  const { lo, hi, t } = sheetSpan(x, CARD_INSET * x.dims.W);
  const d = unit(inward(m, e, x.slant));
  // khung bàn tay của `HandFrame` → lòng, ngón, `lòng × ngón` (phía ngón cái nhân `side`)
  const toHand = (v: V3): V3 => [v[0], v[1], x.side * v[2]];
  const N = unit(toHand(CARD_NORMAL));
  const D = unit(perp(toHand(CARD_OUT), N));
  const C = cross3(N, D);
  const Fd = cross3(F, d);
  // quay khung bàn tay về khung món: `N` → `F`, `D` → `d`
  const map = (v: V3): V3 =>
    add3(add3(scale3(F, dot3(v, N)), scale3(d, dot3(v, D))), scale3(Fd, dot3(v, C)));
  return {
    at: add3(mid, scale3(F, (lo + hi) / 2)),
    along,
    palm: map([1, 0, 0]),
    fingers: map([0, 1, 0]),
    thick: t,
  };
};

/**
 * `card` `edges`: bàn tay úp phía mặt `F`, da đốt ngọn ngón cái tì cạnh `edge`, da đốt ngọn trỏ tì cạnh đối diện;
 * đường kẹp chạy ngang tấm (`−m` quay `slant` về đầu cao), quay `tilt` quanh chính nó (dương: phía ngón cái nâng lên).
 * Đầu ngón thấp nhất cách mặt dưới tấm `EDGES_LIFT`; khe da – mép hai bên chia đều. Bề rộng kẹp ra `width` cho dáng
 */
const cardEdges: ContactFn = (x) => {
  const f = x.feature as SlabFeature;
  const { m, e, F, at: mid, along } = sheetEdge(x, 0);
  const { lo, hi } = sheetSpan(x, EDGES_PROBE);
  const sl = x.slant * D2R;
  const D = unit(mix2(neg(m), Math.cos(sl), e, Math.sin(sl)));
  const w0 = acrossOf(f, x.edge as SideName) ?? 2 * f.half[1];
  const width = w0 / Math.cos(sl);
  const T0 = x.fingerSkin?.("thumb", { width }) ?? [];
  const O0 = x.fingerSkin?.("index", { width }) ?? [];
  const fallback = { at: add3(mid, scale3(m, -w0 / 2)), along, palm: neg(F), fingers: D, width };
  if (!T0.length || !O0.length) return fallback;
  // đường kẹp trong hệ bàn tay: điểm da ngón cái xa nhất về phía trỏ – giữa và ngược lại
  const mean = (P: readonly V3[]) =>
    scale3(
      P.reduce((a, v) => add3(a, v), [0, 0, 0] as V3),
      1 / P.length,
    );
  const far = (P: readonly V3[], d: V3) => P.reduce((a, v) => (dot3(v, d) > dot3(a, d) ? v : a));
  let Dh = unit(sub3(mean(O0), mean(T0)));
  for (let i = 0; i < 2; i++) Dh = unit(sub3(far(O0, neg(Dh)), far(T0, Dh)));
  // hệ bàn tay → hệ món: `Dh` → `D`, lòng tay (phần vuông góc `Dh`) → `−F`
  const nh = unit(perp([1, 0, 0], Dh));
  const bh = cross3(Dh, nh);
  let A = D;
  let B = neg(F);
  const map = (v: V3): V3 =>
    add3(add3(scale3(A, dot3(v, Dh)), scale3(B, dot3(v, nh))), scale3(cross3(A, B), dot3(v, bh)));
  // phía ngón cái là `+z` của khung bàn tay, tức `side · (n × f)`: toạ độ thứ ba của hệ da nhân `side`
  const up = dot3(cross3(A, map([0, 0, x.side])), F) < 0 ? -1 : 1;
  B = rotAround(B, A, x.tilt * D2R * up);
  const low = (P: readonly V3[]) => Math.min(...P.map((v) => dot3(map(v), F)));
  // nghiêng đường kẹp quanh trục vuông góc nó và lòng tay cho đầu ngón cái và trỏ – giữa cùng tầm
  for (let i = 0; i < EDGES_ITER; i++) {
    const span = dot3(sub3(map(far(O0, neg(Dh))), map(far(T0, Dh))), A) || 1;
    const d = low(T0) - low(O0);
    if (Math.abs(d) < PINCH_TOL) break;
    const ax = unit(cross3(A, B));
    const u = Math.atan2(d, span) * (dot3(cross3(ax, A), F) < 0 ? -1 : 1);
    [A, B] = [rotAround(A, ax, u), rotAround(B, ax, u)];
  }
  // tầm: đầu ngón thấp nhất ở mặt dưới tấm cộng `EDGES_LIFT`; da dưới mặt trên chạm mép
  const hF = lo + EDGES_LIFT - Math.min(low(T0), low(O0));
  const band = (P: readonly V3[]) => {
    const q = P.map(map).filter((v) => dot3(v, F) + hF <= hi);
    return q.length ? q : P.map(map);
  };
  const Tq = band(T0);
  const Oq = band(O0);
  const tIn = Tq.reduce((a, v) => (dot3(v, m) < dot3(a, m) ? v : a));
  const oIn = Oq.reduce((a, v) => (dot3(v, m) > dot3(a, m) ? v : a));
  // khe hai bên bằng nhau: ngón cái ở `+m` của cạnh, trỏ – giữa ở `−m` của cạnh đối
  const hm = -(dot3(tIn, m) + dot3(oIn, m) + w0) / 2;
  // dọc cạnh: giữa hai chỗ chạm ở `along` (đường kẹp xiên thì chỗ chạm trỏ – giữa lệch `w · tan slant`)
  const he = -(dot3(tIn, e) + dot3(oIn, e) - w0 * Math.tan(sl)) / 2;
  const at = add3(add3(mid, scale3(F, hF)), add3(scale3(m, hm), scale3(e, he)));
  return { at, along, palm: map([1, 0, 0]), fingers: map([0, 1, 0]), width };
};

/** Khung `nt`: `n = −m`, ngón cái về `F`, ngón dọc mép `side · (F × n)` chúc `slant` về phía `−F` */
const rim: ContactFn = (x) => {
  const t = (x.feature as SlabFeature | DiscFeature).t;
  const d = Math.max(RIM_MIN, SHEET_INSET.rim - RIM_OUT * t);
  const { m, F, at: mid, along } = sheetEdge(x, d);
  const at = add3(mid, scale3(F, Math.max(0, t / 2 - RIM_TOP)));
  const n = neg(m);
  const f0 = unit(scale3(cross3(F, n), x.side));
  const sl = x.slant * D2R;
  return {
    at,
    along,
    palm: n,
    fingers: unit(mix2(f0, Math.cos(sl), F, -Math.sin(sl))),
    ...(x.shape && { thick: thickAt(x.shape, sub3(mid, scale3(m, RIM_PROBE)), F, t) }),
  };
};

/** Bề dày vật liệu trên đoạn dài `t` qua `c` theo `F` (khung món), lấy mẫu `RIM_STEPS` điểm */
function thickAt(shape: readonly HeldShape[], c: V3, F: V3, t: number): number {
  let n = 0;
  for (let i = 0; i < RIM_STEPS; i++)
    if (heldDistance(shape, add3(c, scale3(F, ((i + 0.5) / RIM_STEPS - 0.5) * t))) < 0) n++;
  return (n / RIM_STEPS) * t;
}

/** Trục mỏng, trục dài của hộp (chỉ số), trục dài lấy dấu về `top` */
function boxAxes(b: BoxFeature, g: Pick<ItemGeom, "U" | "F" | "R">) {
  const [it, , il] = [0, 1, 2].sort((i, j) => b.half[i] - b.half[j] || i - j);
  return { it, il, e: signed(AXES[il], [g.U, g.F, g.R]) };
}

/** Lòng tay áp mặt sau, ngón cái dọc cạnh dài `thumb`, ngón sang cạnh kia; lòng tay chếch `tilt` quanh trục dọc máy */
const palmBox: ContactFn = (x) => {
  const b = x.feature as BoxFeature;
  const { U, F, R } = x.geom;
  const { it, il, e: e0 } = boxAxes(b, x.geom);
  const front = signed(AXES[it], [F, U, R]);
  const e = x.high && dot3(e0, x.high) < 0 ? neg(e0) : e0;
  const right = unit(cross3(e, front));
  const g = x.thumb === "left" ? right : neg(right);
  const along = alongFrac(x.along, 2 * b.half[il], x.dims.W);
  const at = add3(
    add3(b.c, scale3(e, (along - 0.5) * 2 * b.half[il])),
    add3(scale3(g, BOX_SHIFT), scale3(front, -(b.half[it] + BOX_GAP))),
  );
  const tl = x.tilt * D2R;
  const palm = unit(mix2(front, Math.cos(tl), g, Math.sin(tl)));
  const raw = mix2(g, Math.cos(BOX_RISE * D2R), e, Math.sin(BOX_RISE * D2R));
  return { at, along, palm, fingers: unit(perp(raw, palm)) };
};

/** Khoảng bao của các phần món (cả phần `grip: false`): đường dò từ ngoài vào bắt đầu xa ngần này */
const reachOf = (g: ItemGeom) => Math.max(1, ...g.parts.map((p) => len3(sub3(p.max, p.min)))) * 2;

/** Từ `o` theo `dir`, chỗ xa nhất còn chạm hình (dò cầu từ `far` vào); không gặp vật liệu thì `undefined` */
function outerAt(shape: readonly HeldShape[], o: V3, dir: V3, far: number): number | undefined {
  let t = far;
  for (let i = 0; i < 96 && t > -EPS; i++) {
    const d = heldDistance(shape, add3(o, scale3(dir, t)));
    if (d < TOUCH) return t;
    t -= d;
  }
  return undefined;
}

/** Tâm nắm ở `o + u · S` với các điểm da `pts` (khung món, tính từ tâm nắm): `S` lớn nhất mà da còn cách hình `gap` */
function skinTouch(
  shape: readonly HeldShape[],
  o: V3,
  u: V3,
  pts: readonly V3[],
  far: number,
  gap = WRAP_GAP,
) {
  let S = far;
  for (let i = 0; i < 96; i++) {
    const c = add3(o, scale3(u, S));
    let d = Infinity;
    for (const q of pts) d = Math.min(d, heldDistance(shape, add3(c, q)));
    if (d < gap + TOUCH) return S;
    S -= d - gap;
    if (S < -far) break;
  }
  return undefined;
}

/**
 * Góc dốc mặt món (độ, dương khi mặt thu vào về `+a`): bán kính ngoài theo `rho` đo ở `WRAP_STEPS` điểm trên
 * `±WRAP_HALF · W` dọc trục quanh `at`; không có hình thì `0`
 */
function slopeAt(x: ContactInput, at: V3, a: V3, rho: V3, far: number): number {
  if (!x.shape) return 0;
  const h = WRAP_HALF * x.dims.W;
  const rs = Array.from({ length: WRAP_STEPS }, (_, i) => h * ((2 * i) / (WRAP_STEPS - 1) - 1))
    .map((w) => [w, outerAt(x.shape!, add3(at, scale3(a, w)), rho, far)] as const)
    .filter((q): q is readonly [number, number] => q[1] !== undefined);
  if (rs.length < 2) return 0;
  return Math.atan((rs[0][1] - rs[rs.length - 1][1]) / (rs[rs.length - 1][0] - rs[0][0])) / D2R;
}

/**
 * `cylinder` `wrap` (khung `nt`): lòng tay áp mặt trụ ở `along` của đoạn bám liền, phía `ρ(around)` (thanh hộp: mặt gần
 * nhất), ngón cái về `±a`. `along` kẹp cho tâm nắm cách phần `grip: false` `clear · W` (`alongRoom`).
 * Lòng tay ngả theo dốc mặt món (`WRAP_GAIN`); tâm nắm dời ra theo `ρ` tới khi da lòng tay (`palmSkin`) còn cách hình
 * `WRAP_GAP`
 */
const wrap: ContactFn = (x) => {
  const f = x.feature as RodFeature | LatheFeature;
  const clear = (GRIP_GROUPS.cylinder.clear ?? 0) * x.dims.W;
  const p0 = axialAt(x.geom, f, alongFrac(x.along, 1, x.dims.W), x.around ?? 0, { clear });
  const along = p0.along;
  const p = { ...p0, rho: faceRho(f, p0.rho) };
  const far = reachOf(x.geom);
  const slope = slopeAt(x, p.at, p.a, p.rho, far);
  const b = Math.max(-WRAP_TILT_MAX, Math.min(WRAP_TILT_MAX, WRAP_GAIN * slope));
  const palm = neg(mix2(p.rho, Math.cos(b * D2R), p.a, Math.sin(b * D2R)));
  const radius = f.kind === "lathe" ? p.r : undefined;
  const ahead = along + ((x.thumb === "down" ? -1 : 1) * WRAP_THUMB_AHEAD * x.dims.W) / p.seg.len;
  const thumbRadius =
    radius === undefined
      ? undefined
      : Math.min(radius, axialAt(x.geom, f, Math.min(1, Math.max(0, ahead)), x.around ?? 0).r);
  const t = unit(perp(scale3(p.a, x.thumb === "down" ? -1 : 1), palm));
  const f0 = unit(scale3(cross3(t, palm), x.side));
  const big =
    ((thumbRadius ?? (f.kind === "rod" ? f.R : p.r)) / x.dims.W - WRAP_BIG[0]) /
    (WRAP_BIG[1] - WRAP_BIG[0]);
  const sl = x.slant * Math.min(1, Math.max(0, big)) * D2R;
  const fingers = unit(mix2(f0, Math.cos(sl), t, Math.sin(sl)));
  const z = cross3(palm, fingers);
  const pts = (x.palmSkin?.({ radius, thumbRadius }) ?? []).map((c) =>
    add3(add3(scale3(palm, c[0]), scale3(fingers, c[1])), scale3(z, c[2])),
  );
  const S = (x.shape && pts.length && skinTouch(x.shape, p.at, p.rho, pts, far)) || p.r;
  return { at: add3(p.at, scale3(p.rho, S)), along, palm, fingers, radius, thumbRadius };
};

/**
 * `cylinder` `flat` (thanh hộp mặt rộng hơn lòng tay, cầm như điện thoại): lòng tay áp mặt gần `ρ(around)`, ngón cái dọc
 * một cạnh về phía `thumb` (`up` là `+a`), ngón ngang thân sang cạnh kia, chếch `BOX_RISE` về phía ngón cái; `along` như
 * `wrap`, tâm nắm lệch `BOX_SHIFT` về cạnh đầu ngón, dời ra tới khi da lòng tay còn cách hình `WRAP_GAP`
 */
const flatRod: ContactFn = (x) => {
  const f = x.feature as RodFeature;
  const clear = (GRIP_GROUPS.cylinder.clear ?? 0) * x.dims.W;
  const p0 = axialAt(x.geom, f, alongFrac(x.along, 1, x.dims.W), x.around ?? 0, { clear });
  const rho = faceRho(f, p0.rho);
  const palm = neg(rho);
  const t = unit(perp(scale3(p0.a, x.thumb === "down" ? -1 : 1), palm));
  const f0 = unit(scale3(cross3(t, palm), x.side));
  const fingers = unit(mix2(f0, Math.cos(BOX_RISE * D2R), t, Math.sin(BOX_RISE * D2R)));
  const z = cross3(palm, fingers);
  const pts = (x.palmSkin?.({}) ?? []).map((c) =>
    add3(add3(scale3(palm, c[0]), scale3(fingers, c[1])), scale3(z, c[2])),
  );
  const o = add3(p0.at, scale3(f0, BOX_SHIFT));
  const S = (x.shape && pts.length && skinTouch(x.shape, o, rho, pts, reachOf(x.geom))) || p0.r;
  return { at: add3(o, scale3(rho, S)), along: p0.along, palm, fingers };
};

/**
 * `bowl` `side` (khung `nt`): lòng tay áp thành chén ở `along` (từ đáy), phía `ρ(around)`, ngón cái về miệng; lòng tay
 * ngả theo dốc thành tối đa `BOWL_TILT_MAX`, tâm nắm dời ra theo `ρ` tới khi da lòng tay cách hình `BOWL_GAP`
 */
const bowlSide: ContactFn = (x) => {
  const f = x.feature as LatheFeature;
  const p = axialAt(x.geom, f, alongFrac(x.along, 1, x.dims.W), x.around ?? 0);
  const up = f.mouth === "lo" ? neg(p.a) : p.a;
  const far = reachOf(x.geom);
  const slope = slopeAt(x, p.at, up, p.rho, far);
  const b = Math.max(-BOWL_TILT_MAX, Math.min(BOWL_TILT_MAX, slope));
  const palm = neg(mix2(p.rho, Math.cos(b * D2R), up, Math.sin(b * D2R)));
  const t = unit(perp(up, palm));
  const fingers = unit(scale3(cross3(t, palm), x.side));
  const z = cross3(palm, fingers);
  const pts = (x.palmSkin?.({ radius: p.r }) ?? []).map((c) =>
    add3(add3(scale3(palm, c[0]), scale3(fingers, c[1])), scale3(z, c[2])),
  );
  const S = (x.shape && pts.length && skinTouch(x.shape, p.at, p.rho, pts, far, BOWL_GAP)) || p.r;
  return { at: add3(p.at, scale3(p.rho, S)), along: p.along, palm, fingers, radius: p.r };
};

/**
 * `bowl` `pinch` (khung `nt`, ngón cái về miệng): da ngón cái một phía thành, da trỏ – giữa phía đối diện, ở `along` tính
 * từ miệng, dáng gốc; trục chén ở phía xa lòng tay — lòng tay không chạm chén. Dựng với lòng tay `−ρ(around)` rồi quay quanh
 * trục chén cho phía ngón cái nằm ở `ρ(around)`
 */
const bowlPinch: ContactFn = (x) => {
  const f = x.feature as LatheFeature;
  const along = Math.min(PINCH_ALONG[1], Math.max(PINCH_ALONG[0], alongFrac(x.along, 1, x.dims.W)));
  const p = axialAt(x.geom, f, f.mouth === "lo" ? along : 1 - along, x.around ?? 0);
  const up = f.mouth === "lo" ? neg(p.a) : p.a;
  const A = neg(p.rho);
  const B = cross3(up, A);
  const fingers0 = unit(scale3(B, x.side));
  const T0 = x.fingerSkin?.("thumb", { radius: p.r }) ?? [];
  const I0 = x.fingerSkin?.("index", { radius: p.r }) ?? [];
  const M0 = x.fingerSkin?.("middle", { radius: p.r }) ?? [];
  if (!T0.length || !I0.length)
    return { at: add3(p.at, scale3(p.rho, p.r)), along, palm: A, fingers: fingers0, radius: p.r };
  // hệ bàn tay (lòng, ngón, `n × f`) → hệ món: lòng tay chiếu vuông góc trục `u` về `−ρ`, `u` về miệng
  const zs = dot3(cross3(A, fingers0), up) < 0 ? -1 : 1;
  let u: V3 = [0, 0, zs];
  let c: V3 = [0, 0, 0];
  const basis = (w: V3) => {
    const a = unit(perp([1, 0, 0], w));
    return { a, b: cross3(w, a), w };
  };
  const toItem = (h: ReturnType<typeof basis>, v: V3): V3 =>
    add3(add3(scale3(A, dot3(v, h.a)), scale3(B, dot3(v, h.b))), scale3(up, dot3(v, h.w)));
  const dist2 = (h: ReturnType<typeof basis>, v: V3, q: V3) =>
    Math.hypot(dot3(sub3(v, q), h.a), dot3(sub3(v, q), h.b));
  const near = (h: ReturnType<typeof basis>, P: readonly V3[], q: V3) =>
    P.reduce((m, v) => (dist2(h, v, q) < dist2(h, m, q) ? v : m));
  const O0 = [...I0, ...M0];
  const R = p.r + PINCH_GAP;
  const mean = (P: readonly V3[]) =>
    scale3(
      P.reduce((m, v) => add3(m, v), [0, 0, 0] as V3),
      1 / P.length,
    );
  for (let round = 0; round < PINCH_ROUNDS; round++) {
    const h = basis(u);
    // mặt cắt vuông góc trục chén: trục cách đỉnh da gần nhất của đốt ngọn ngón cái và của trỏ – giữa đúng `r + PINCH_GAP`,
    // phía xa lòng tay
    if (round === 0) c = add3(scale3(add3(mean(T0), mean(O0)), 0.5), scale3(h.a, R));
    for (let i = 0; i < PINCH_ITER; i++) {
      const t = near(h, T0, c);
      const o = near(h, O0, c);
      const d3 = sub3(o, t);
      const da = dot3(d3, h.a);
      const db = dot3(d3, h.b);
      const d = Math.hypot(da, db) || 1;
      const k = Math.sqrt(Math.max(0, R * R - (d / 2) ** 2)) / d;
      const m = scale3(add3(t, o), 0.5);
      // pháp tuyến dây cung trong mặt cắt, chiều ra xa lòng tay (`+a`)
      const s = -db >= 0 ? k : -k;
      c = add3(
        sub3(m, scale3(h.w, dot3(sub3(m, c), h.w))),
        add3(scale3(h.a, -db * s), scale3(h.b, da * s)),
      );
    }
    // trên hình thật (thành thuôn, miệng): Newton hai ẩn cho khe da đúng `PINCH_GAP` cả hai phía
    if (x.shape) {
      const shape = x.shape;
      const touch = (P: readonly V3[], q: V3): [number, V3] => {
        let best: [number, V3] = [Infinity, P[0]];
        for (const v of P) {
          const g = heldDistance(shape, add3(p.at, toItem(h, sub3(v, q))));
          if (g < best[0]) best = [g, v];
        }
        return best;
      };
      const F = (q: V3) => [touch(T0, q)[0] - PINCH_GAP, touch(O0, q)[0] - PINCH_GAP];
      for (let i = 0; i < PINCH_NEWTON; i++) {
        const f0 = F(c);
        if (Math.abs(f0[0]) < PINCH_TOL && Math.abs(f0[1]) < PINCH_TOL) break;
        const fa = F(add3(c, scale3(h.a, PINCH_STEP)));
        const fb = F(add3(c, scale3(h.b, PINCH_STEP)));
        const [j00, j10] = [(fa[0] - f0[0]) / PINCH_STEP, (fa[1] - f0[1]) / PINCH_STEP];
        const [j01, j11] = [(fb[0] - f0[0]) / PINCH_STEP, (fb[1] - f0[1]) / PINCH_STEP];
        const det = j00 * j11 - j01 * j10;
        if (Math.abs(det) < EPS) break;
        let ea = (j11 * f0[0] - j01 * f0[1]) / det;
        let eb = (j00 * f0[1] - j10 * f0[0]) / det;
        const n = Math.hypot(ea, eb);
        if (n > PINCH_MOVE) [ea, eb] = [(ea * PINCH_MOVE) / n, (eb * PINCH_MOVE) / n];
        c = sub3(c, add3(scale3(h.a, ea), scale3(h.b, eb)));
      }
      // tầm: giữa chỗ chạm thật của ngón cái và của trỏ – giữa; trục chén nghiêng trong bàn tay cho hai chỗ ấy ngang nhau
      const t = touch(T0, c)[1];
      const i1 = M0.length ? scale3(add3(touch(I0, c)[1], touch(M0, c)[1]), 0.5) : touch(I0, c)[1];
      c = add3(c, scale3(h.w, dot3(sub3(scale3(add3(t, i1), 0.5), c), h.w)));
      const D = unit(sub3(i1, t));
      const tilted = unit(perp(u, D));
      const lim = Math.cos(PINCH_TILT_MAX * D2R);
      u =
        zs * tilted[2] >= lim
          ? tilted
          : unit(mix2([0, 0, zs], lim, unit([tilted[0], tilted[1], 0]), Math.sqrt(1 - lim * lim)));
    } else break;
  }
  const h = basis(u);
  // lòng tay không chạm chén: còn sát thì đẩy trục chén ra xa lòng tay, rồi lùi khỏi ngón cái nếu da cái lún quá `PINCH_GAP`
  const P0 = x.palmSkin?.({ radius: p.r }) ?? [];
  if (x.shape && P0.length) {
    const shape = x.shape;
    const nearest = (P: readonly V3[], q: V3): [number, V3] => {
      let best: [number, V3] = [Infinity, P[0]];
      for (const v of P) {
        const g = heldDistance(shape, add3(p.at, toItem(h, sub3(v, q))));
        if (g < best[0]) best = [g, v];
      }
      return best;
    };
    for (let i = 0; i < PINCH_ITER; i++) {
      const m = nearest(P0, c)[0];
      if (m < CUP_PALM_MIN - PINCH_TOL) c = add3(c, scale3(h.a, CUP_PALM_MIN - m));
      const [g, v] = nearest(T0, c);
      if (g < PINCH_GAP - PINCH_TOL) {
        const away = sub3(c, v);
        const w = unit(sub3(away, scale3(h.w, dot3(away, h.w))));
        c = add3(c, scale3(w, PINCH_GAP - g));
      } else if (m >= CUP_PALM_MIN - PINCH_TOL) break;
    }
  }
  let at = scale3(toItem(h, c), -1);
  let palm = toItem(h, [1, 0, 0]);
  let fingers = toItem(h, [0, 1, 0]);
  // quay cả chỗ cầm quanh trục chén (trụ tiện tròn xoay) cho phía ngón cái — chỗ chạm cái trừ trung điểm chỗ chạm trỏ – giữa —
  // nằm đúng `ρ(around)`
  if (x.shape) {
    const shape = x.shape;
    const nearest = (P: readonly V3[]) => {
      let best: [number, V3] = [Infinity, P[0]];
      for (const v of P) {
        const q = add3(p.at, toItem(h, sub3(v, c)));
        const g = heldDistance(shape, q);
        if (g < best[0]) best = [g, q];
      }
      return best[1];
    };
    const o = M0.length ? scale3(add3(nearest(I0), nearest(M0)), 0.5) : nearest(I0);
    const g = perp(sub3(nearest(T0), o), up);
    if (len3(g) > EPS) {
      const ang = Math.atan2(dot3(cross3(g, p.rho), up), dot3(g, p.rho));
      const turn = (v: V3) => rotAround(v, up, ang);
      [at, palm, fingers] = [turn(at), turn(palm), turn(fingers)];
    }
  }
  return { at: add3(p.at, at), along, palm, fingers, radius: p.r };
};

/** `v` quay góc `a` (radian) quanh trục đơn vị `u` (Rodrigues) */
function rotAround(v: V3, u: V3, a: number): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return add3(add3(scale3(v, c), scale3(cross3(u, v), s)), scale3(u, dot3(u, v) * (1 - c)));
}

/** Thụt mặc định của `platform`: bàn tay nằm trọn trong mặt, `½ · (W · |sin ψ| + P · |cos ψ|)` */
export const platformInset = (psi: number, dims: HandDims) =>
  0.5 * (dims.W * Math.abs(Math.sin(psi * D2R)) + dims.P * Math.abs(Math.cos(psi * D2R)));

/**
 * `platform` `palm`: lòng tay ngửa áp mặt `face` (`n = −face.n`), tay tới từ cạnh `edge`, tâm nắm thụt `inset` (mặc định
 * `platformInset`) theo pháp tuyến trong của cạnh, ở `along` (kẹp cho bàn tay nằm trong cạnh); ngón quay `psi` từ pháp
 * tuyến trong về đầu cao của cạnh.
 * Tâm nắm hạ xuống tới khi da lòng tay còn cách hình `PLATFORM_GAP`
 */
const platformPalm: ContactFn = (x) => {
  const f = x.feature as FaceFeature;
  const ed = f.edges.find((e) => e.name === x.edge);
  if (!ed)
    throw new Error(
      `mặt \`${f.name}\` của \`${f.part}\` không có cạnh \`${x.edge}\`; cạnh: ${f.edges.map((e) => e.name).join(", ") || "không"}`,
    );
  const e0 = unit(cross3(neg(ed.inward), f.n));
  // không có hướng món trong thế giới: đầu cao về `−front`, cạnh vuông góc `front` thì về `top`
  const ref = x.high ?? (Math.abs(dot3(e0, x.geom.F)) > EPS ? neg(x.geom.F) : x.geom.U);
  const e = dot3(e0, ref) < 0 ? neg(e0) : e0;
  const psi = x.psi ?? 0;
  const inset = x.inset ?? platformInset(psi, x.dims);
  // dọc cạnh: bàn tay (gót lòng `P` sau tâm nắm, đầu ngón `L − P` trước, ngang `W`) nằm trong cạnh; cạnh ngắn quá thì giữa
  const { W, L, P } = x.dims;
  const sn = Math.sin(psi * D2R);
  const half = (Math.abs(Math.cos(psi * D2R)) * W) / 2;
  const back = Math.max(sn * P, -sn * (L - P)) + half;
  const ahead = Math.max(sn * (L - P), -sn * P) + half;
  const s0 = alongFrac(x.along, ed.len, W) * ed.len;
  const along =
    (back <= ed.len - ahead ? Math.min(ed.len - ahead, Math.max(back, s0)) : ed.len / 2) / ed.len;
  const o = add3(add3(ed.at, scale3(e, (along - 0.5) * ed.len)), scale3(ed.inward, inset));
  const palm = neg(f.n);
  const fingers = unit(mix2(ed.inward, Math.cos(psi * D2R), e, Math.sin(psi * D2R)));
  const z = cross3(palm, fingers);
  const pts = (x.palmSkin?.({}) ?? []).map((c) =>
    add3(add3(scale3(palm, c[0]), scale3(fingers, c[1])), scale3(z, c[2])),
  );
  const S =
    (x.shape && pts.length && skinTouch(x.shape, o, f.n, pts, reachOf(x.geom), PLATFORM_GAP)) || 0;
  return { at: add3(o, scale3(f.n, S)), along, palm, fingers };
};

/**
 * `chopsticks`: hai que mảnh cùng phần, `along` từ đầu cầm (xa mốc `tip`) dọc cả hai que. Khung fixture dời theo đường giữa
 * hai que: ngón dọc que về ngọn (`d`), `b` từ que này sang que kia (tay phải về `R` của món), `c` hoàn chỉnh theo bên tay
 */
const chopGrip: ContactFn = (x) => {
  const f = x.feature as RodFeature;
  const pair = x.geom.features
    .filter(
      (o): o is RodFeature =>
        o !== f &&
        o.kind === "rod" &&
        o.part === f.part &&
        Math.abs(dot3(o.a, f.a)) >= Math.cos(15 * D2R),
    )
    .sort((a, b) => len3(sub3(a.c, f.c)) - len3(sub3(b.c, f.c)))[0];
  const tip = x.tip ?? f.lo;
  const along = alongFrac(x.along, f.len, x.dims.W);
  const axis = (r: RodFeature) => {
    const hi = add3(r.lo, scale3(r.a, r.len));
    const [from, to] = len3(sub3(hi, tip)) >= len3(sub3(r.lo, tip)) ? [hi, r.lo] : [r.lo, hi];
    return { at: add3(from, scale3(sub3(to, from), along)), d: sub3(to, from) };
  };
  const p = axis(f);
  const q = pair ? axis(pair) : p;
  const d = unit(add3(p.d, q.d));
  const mid = scale3(add3(p.at, q.at), 0.5);
  const b0 = len3(perp(sub3(q.at, p.at), d)) > EPS ? unit(perp(sub3(q.at, p.at), d)) : x.geom.R;
  const b = scale3(signed(b0, [x.geom.R, x.geom.U, x.geom.F]), -x.side);
  const c = scale3(cross3(d, b), -x.side);
  const palm = mix2(b, CHOP_PALM[0], c, CHOP_PALM[1]);
  return { at: add3(mid, scale3(b, CHOP_OFF)), along, palm, fingers: d };
};

/**
 * `pen`: kẹp ba điểm cách ngòi `along` đoạn bám (tính từ đầu gần mốc `tip`), thân ngả về khe cái–trỏ; lăn quanh trục cố định
 * `around` 0. Khung fixture theo `d`, `ρ`, `σ` (`PEN_PALM`)
 */
const penGrip: ContactFn = (x) => {
  const f = x.feature as RodFeature | LatheFeature;
  const { seg } = axialAt(x.geom, f, 0, 0);
  const tip = x.tip ?? seg.lo;
  const low = len3(sub3(seg.lo, tip)) <= len3(sub3(seg.hi, tip));
  const u = alongFrac(x.along, seg.len, x.dims.W);
  const p = axialAt(x.geom, f, low ? u : 1 - u, 0);
  const d = low ? p.a : neg(p.a);
  const sigma = scale3(cross3(d, p.rho), -x.side);
  const loc = (c: V3) => add3(add3(scale3(d, c[0]), scale3(p.rho, c[1])), scale3(sigma, c[2]));
  const palm = unit(loc(PEN_PALM));
  return {
    at: add3(p.at, scale3(loc(PEN_OFF), x.dims.W)),
    along: low ? p.along : 1 - p.along,
    palm,
    fingers: unit(perp(loc(PEN_FINGERS), palm)),
  };
};

/**
 * `handle` `hook` (khung `nf`, fixture `tui#xach`): tâm nắm dáng `hook` trên trục thanh ở `along`, ngón vuông góc thanh về
 * phía `−top` (món treo dưới tay) luồn qua khe sau thanh, lòng tay về `ρ(0)` (`front` chiếu lên mặt vuông góc trục)
 */
const hook: ContactFn = (x) => {
  const f = x.feature as RodFeature;
  const p = axialAt(x.geom, f, alongFrac(x.along, 1, x.dims.W), 0);
  const down = perp(neg(x.geom.U), p.a);
  const fingers = len3(down) > EPS ? unit(down) : unit(cross3(p.a, p.rho));
  const n = perp(p.rho, fingers);
  return {
    at: p.at,
    along: p.along,
    palm: len3(n) > EPS ? unit(n) : unit(cross3(p.a, fingers)),
    fingers,
  };
};

/** Chỗ tiếp xúc theo nhóm và biến thể; nhóm chưa có ở đây thì `graspFrame` báo lỗi */
export const CONTACTS: Partial<Record<GroupId, Record<string, ContactFn>>> = {
  sheet: { pinch, flat, rim },
  card: { lateral, edges: cardEdges },
  palmBox: { default: palmBox },
  cylinder: { wrap, flat: flatRod },
  platform: { palm: platformPalm },
  chopsticks: { grip: chopGrip },
  pen: { grip: penGrip },
  handle: { hook },
  bowl: { side: bowlSide, pinch: bowlPinch },
};

/**
 * Đầu cao của cạnh có hướng `e` (khung món) khi món quay `R` (khung món → thế giới, `up` là hướng lên): cạnh dốc ≥ 30° so
 * với mặt ngang thì đầu trên; gần ngang mà chạy ngang thân hơn chạy trước–sau thì đầu thấp về phía tay `side` theo
 * `across` (ngang hệ thân, dương về tay phải người cầm), không thì đầu thấp về phía người cầm (`−tiến`). Trả `±e`.
 * docs/11-nhom-cam.md#chỗ-cầm-castworldhandshold
 */
export function edgeHigh(e: V3, R: M3, side: number, across: V3, up: V3 = [0, -1, 0]): V3 {
  const w = matVec(R, e);
  const rise = dot3(w, up) / (len3(w) || 1);
  if (Math.abs(rise) >= SLOPE - 1e-9) return rise > 0 ? e : neg(e);
  const a = dot3(w, across);
  const f = dot3(w, cross3(up, across));
  if (Math.abs(a) >= Math.abs(f)) return a * side < 0 ? neg(e) : e;
  return f > 0 ? e : neg(e);
}

/** Khối hình `f` có cạnh `edge`: tấm theo tên, đĩa theo tên vành hay góc */
export const edgeOk = (f: Feature, edge: GraspChoice["edge"]) =>
  edge === undefined ||
  (f.kind === "slab" || f.kind === "face"
    ? f.edges.some((x) => x.name === edge)
    : f.kind === "disc"
      ? typeof edge === "number" || f.rim.includes(edge)
      : true);
const faceOk = (f: Feature, thumb: GraspChoice["thumb"]) =>
  thumb === undefined ||
  (f.kind === "slab" || f.kind === "disc" ? f.faces.some((x) => x.name === thumb) : true);

/**
 * Khối hình của chỗ cầm: `featureIndex` nếu khai, không thì ưu tiên khối đạt `needs` ở cỡ tay này (`platform`: mặt đỡ),
 * không có thì khối cùng loại đầu tiên
 */
function pickFeature(
  spec: HeldItemSpec,
  geom: ItemGeom,
  group: GroupSpec,
  dims: HandDims,
  c: GraspChoice,
): Feature {
  const kinds = new Set<string>(group.needs.flatMap((n) => n.kinds));
  if (c.featureIndex !== undefined) {
    const f = geom.features[c.featureIndex];
    if (!f) throw new Error(`món không có khối hình số ${c.featureIndex}`);
    if (!kinds.has(f.kind) || (c.part !== undefined && f.part !== c.part))
      throw new Error(
        `khối hình số ${c.featureIndex} (\`${f.kind}\` ở phần \`${f.part}\`) không hợp chỗ cầm nhóm \`${group.id}\``,
      );
    return f;
  }
  const ok = (f: Feature) =>
    kinds.has(f.kind) &&
    (c.part === undefined || f.part === c.part) &&
    (c.feature === undefined || f.kind === c.feature) &&
    edgeOk(f, c.edge) &&
    faceOk(f, c.thumb);
  const fits = groupNeeds(geom, group, dims, spec.anchors).filter(ok);
  // mặt đỡ mặc định: gần `−top`, hoà thì gần `−front`
  const faces =
    group.id === "platform"
      ? supportFaces(
          fits.filter((x): x is FaceFeature => x.kind === "face"),
          neg(geom.U),
          neg(geom.F),
        )
      : [];
  const f = faces[0] ?? fits[0] ?? geom.features.find(ok);
  if (!f)
    throw new Error(
      `món không có khối hình cho nhóm \`${group.id}\`${c.part ? ` ở phần \`${c.part}\`` : ""}`,
    );
  return f;
}

const BASE = [HAND_DOF.indexOf("indexBase"), HAND_DOF.indexOf("fingersBase")];
const PALM = HAND_PIECES.indexOf("palm");
const THUMB = HAND_DOF.indexOf("thumbAbd");

function poseVec(r: PoseRef): number[] {
  if (!(r.pose in HAND_POSES)) throw new Error(`dáng \`${r.pose}\` chưa soạn`);
  const v = handVec(r.pose as HandPose);
  for (const i of BASE) {
    v[i] += r.knuckle ?? 0;
    v[i + 1] += r.tip ?? 0;
  }
  r.thumb?.forEach((a, i) => (v[THUMB + i] = a));
  return v;
}

function measure(f: Feature, by: PoseSpec["by"]): number {
  if (by === "thick") return f.kind === "slab" || f.kind === "disc" ? f.t : NaN;
  if (by === "radius")
    return f.kind === "rod"
      ? f.R
      : f.kind === "lathe"
        ? f.rMax
        : f.kind === "disc"
          ? f.radius
          : NaN;
  return f.kind === "box" || f.kind === "slab" ? 2 * [...f.half].sort((a, b) => a - b)[1] : NaN;
}

/**
 * Dáng gốc: dáng đóng ở `range[0]`, dáng mở ở `range[1]` (số đo món theo `A` hay `W`; `thick`, `radius` của chỗ tiếp xúc
 * nếu có), hoà góc ở giữa
 */
function basePose(
  ps: PoseSpec,
  f: Feature,
  dims: HandDims,
  at: Pick<GraspContact, "thick" | "radius" | "thumbRadius" | "width"> = {},
): number[] {
  const local = ps.by === "thick" ? at.thick : ps.by === "radius" ? at.radius : at.width;
  const x = (local ?? measure(f, ps.by)) / dims[ps.unit];
  const [lo, hi] = ps.range;
  const w = Number.isFinite(x) ? Math.min(1, Math.max(0, (x - lo) / (hi - lo))) : 0;
  const v = mixHand(poseVec(ps.closed), poseVec(ps.open), w);
  if (ps.thumb?.length) {
    const xt =
      ps.by === "radius" && at.thumbRadius !== undefined ? at.thumbRadius / dims[ps.unit] : x;
    thumbAt(ps.thumb, Number.isFinite(xt) ? xt : lo).forEach((a, i) => (v[THUMB + i] = a));
  }
  return v;
}

/** Góc ngón cái của bảng `PoseSpec.thumb` ở số đo `x`: nội suy tuyến tính, ngoài bảng lấy đầu gần */
function thumbAt(tab: NonNullable<PoseSpec["thumb"]>, x: number): readonly number[] {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    const [x1, b] = tab[i];
    if (x > x1) continue;
    const [x0, a] = tab[i - 1];
    return mixHand(a, b, (x - x0) / (x1 - x0));
  }
  return tab[tab.length - 1][1];
}

const skins = new Map<string, V3[]>();

/**
 * Đỉnh da của các đốt `pieces` (chỉ số `HAND_PIECES`, đốt trọng số lớn nhất của đỉnh) của bàn tay bên `side` cỡ `k`, cỡ dọc
 * `long` ở dáng `v`, tính từ tâm nắm của dáng `pose`: toạ độ theo pháp tuyến lòng tay, hướng ngón, `n × f` của khung bàn
 * tay (`handAxes`), đơn vị rig
 */
function skinPoints(
  side: number,
  k: number,
  long: number,
  v: HandVec,
  pose: HandPose,
  pieces: readonly number[],
): V3[] {
  const key = [side, k, long, ...v].map((x) => x.toFixed(4)).join() + pose + pieces.join();
  let out = skins.get(key);
  if (out) return out;
  const skin = handSkin(side, k, long);
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, v, pos);
  const dom = skinPieces(skin);
  const c = gripCenter(pose, side, k, long);
  const { n, f } = handAxes(side);
  const z = cross3(n, f);
  out = [];
  for (let i = 0; i < dom.length; i++) {
    if (!pieces.includes(dom[i])) continue;
    const d = sub3([pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]], c);
    out.push([dot3(d, n) * 100, dot3(d, f) * 100, dot3(d, z) * 100]);
  }
  skins.set(key, out);
  return out;
}

const PIECES_OF: Record<SkinFinger, number[]> = {
  thumb: [HAND_PIECES.indexOf("thumb1")],
  index: [HAND_PIECES.indexOf("index1")],
  middle: [HAND_PIECES.indexOf("middle1")],
};

/**
 * Khung cầm của chỗ cầm `choice` (nhóm `group`) trên món `spec` (`geom = itemGeom(spec)`) cho tay bên `side`: chỗ tiếp xúc
 * của nhóm, bàn tay tổng hợp có điểm nắm là toạ độ khung món, `G` như `graspLink` (`k`, `long`, `s` như ở đó), dáng gốc
 * theo `dims` (cỡ tay, đơn vị món). Trường thiếu lấy mặc định của nhóm; `eHigh` là đầu cao của cạnh (`edgeHigh`)
 */
export function graspFrame(
  spec: HeldItemSpec,
  geom: ItemGeom,
  choice: GraspChoice & { group: GroupId },
  side: number,
  dims: HandDims,
  k = 1,
  long = k,
  s = 1,
  eHigh?: V3,
): GraspFrame {
  const group = GRIP_GROUPS[choice.group];
  const byVariant = CONTACTS[choice.group];
  if (!byVariant)
    throw new Error(
      `nhóm \`${choice.group}\` chưa có chỗ tiếp xúc (có: ${Object.keys(CONTACTS).join(", ")})`,
    );
  const feature = pickFeature(spec, geom, group, dims, choice);
  const def = holdDefaults(group, geom, { feature, side: side < 0 ? -1 : 1 });
  const variant =
    choice.variant ??
    (def.variant as string | undefined) ??
    group.variantOf?.(feature, geom, choice.around ?? (def.around as number | undefined), dims) ??
    Object.keys(group.variants)[0];
  const vs = group.variants[variant];
  const contact = byVariant[variant];
  if (!vs || !contact)
    throw new Error(
      `biến thể \`${variant}\` không có ở nhóm \`${group.id}\` (${Object.keys(byVariant).join(", ")})`,
    );
  if (!vs.pose) throw new Error(`biến thể \`${variant}\` của nhóm \`${group.id}\` chưa có dáng`);
  const edge = choice.edge;
  if (
    (feature.kind === "slab" || feature.kind === "disc" || feature.kind === "face") &&
    group.choices.edge &&
    edge === undefined
  )
    throw new Error(`nhóm \`${group.id}\` cần \`edge\``);
  const thumb = choice.thumb ?? (def.thumb as string | undefined);
  const slantC = group.choices.slant;
  const half =
    slantC?.kind === "range"
      ? (slantC.byVariant?.[variant] ?? [slantC.min, slantC.max]).map((v) => v / 2)
      : [0, 0];
  const sl = choice.slant ?? (def.slant as number | undefined) ?? 0;
  const slant = typeof sl === "number" ? sl : sl === "low" ? half[0] : sl === "high" ? half[1] : 0;
  const tilt = choice.tilt ?? (def.tilt as number | undefined) ?? 0;
  const along = choice.along ?? (def.along as number | undefined) ?? 0.5;
  const around = choice.around ?? (def.around as number | undefined);
  const psi = choice.psi ?? (def.psi as number | undefined);
  const inset = choice.inset ?? (def.inset as number | undefined);
  const skinOf = (
    at: Pick<GraspContact, "thick" | "radius" | "thumbRadius" | "width"> | undefined,
    pieces: readonly number[],
  ) =>
    skinPoints(
      side,
      dims.W / (200 * HAND_BONES.palm.half[1]),
      dims.P / (100 * HAND_BONES.palm.len),
      basePose(vs.pose!, feature, dims, at),
      vs.pose!.closed.pose as HandPose,
      pieces,
    );
  const ct = contact({
    geom,
    feature,
    side,
    dims,
    edge,
    along,
    thumb,
    slant,
    tilt,
    around,
    psi,
    inset,
    high: eHigh,
    shape: spec.shape,
    tip: spec.anchors?.tip?.at,
    palmSkin: (at) => skinOf(at, [PALM]),
    fingerSkin: (finger, at) => skinOf(at, PIECES_OF[finger]),
  });
  const name = vs.pose.closed.pose as HandPose;
  const hand: GraspHand = {
    pose: name,
    at: ct.at,
    palm: ct.palm,
    fingers: ct.fingers,
    wrap: HELD_FINGERS.filter((f) => vs.roles[f] !== "free" && vs.roles[f] !== "extend"),
  };
  return {
    G: graspLink(hand, side, k, long, s),
    hand,
    pose: basePose(vs.pose, feature, dims, ct),
    roles: vs.roles,
    feature,
    choice: {
      part: feature.part,
      feature: feature.kind,
      featureIndex: geom.features.indexOf(feature),
      ...(edge !== undefined && { edge }),
      along: ct.along,
      ...(thumb !== undefined && { thumb: thumb as GraspChoice["thumb"] }),
      variant,
      ...(group.choices.slant && { slant }),
      ...(group.choices.tilt && { tilt }),
      ...(group.choices.around && around !== undefined && { around }),
      ...(group.choices.psi && psi !== undefined && { psi }),
      ...(group.choices.inset && inset !== undefined && { inset }),
    },
  };
}

/** Người cầm của `graspAt` ở một tư thế thân */
export interface GraspCtx {
  /** Tay phải (`-1`), tay trái (`1`) */
  arms: Record<number, ArmInput>;
  /** Cỡ tay, đơn vị món (`handDims(k, long)`) */
  dims: HandDims;
  /** Cỡ bàn tay, cỡ dọc (chưa nhân cỡ người) */
  k: number;
  long: number;
  /** Cỡ người (`world.s`) */
  s: number;
  /** Ngang hệ thân, thế giới rig, dương về tay phải người cầm (`edgeHigh`) */
  across: V3;
  /** Đầu người cầm, thế giới rig: mặc định `thumb` của tấm là mặt quay về đây */
  face: V3;
  held: Record<string, HeldItemSpec>;
}

/** Người cầm từ thân `T` (`trunk3`): hai tay (`armInput`), cỡ bàn tay áo, ngang hệ thân, đầu */
export function graspCtx(
  T: Trunk3,
  held: Record<string, HeldItemSpec>,
  shape = markShape(T),
): GraspCtx {
  const k = T.hand ? T.hand.k : 1;
  const long = T.hand ? T.hand.long : k;
  const a = matVec(T.Rr, [-1, 0, 0]);
  const h = T.out.head;
  return {
    arms: { [-1]: armInput(T, -1, shape), [1]: armInput(T, 1, shape) },
    dims: handDims(k, long),
    k,
    long,
    s: T.s,
    across: [a[0], -a[1], -a[2]],
    face: [h[0] * 100, -h[1] * 100, -h[2] * 100],
    held,
  };
}

const FLIP: M3 = [1, 0, 0, 0, -1, 0, 0, 0, -1];
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];

/**
 * Bàn tay = món · `G⁻¹`: món quay `R` (khung món → thế giới rig), gốc `P` (thế giới rig), cỡ `s` (điểm món `q` ở
 * `P + R·q·s`, như `itemAt`) ra cổ tay `Wp` và khung bàn tay `Rw` (three). `G` phải dựng với cùng `s`
 */
export function handFromItem(R: M3, P: V3, s: number, G: GripFrame): { Wp: V3; Rw: M3 } {
  if (Math.abs(G.u - 0.01 * s) > 1e-9)
    throw new Error(`khung cầm dựng với cỡ ${G.u * 100}, món cỡ ${s}`);
  const Rw = matMul(matMul(FLIP, R), tr(G.R));
  return { Rw, Wp: sub3(scale3(matVec(FLIP, P), 0.01), matVec(Rw, G.p)) };
}

export type GraspBy = Partial<Record<keyof GraspChoice, "scene" | "rig" | "default">>;

/** Bàn tay đã giải trên món: lựa chọn, nguồn của từng trường, khung cầm, cổ tay, khung bàn tay, cánh tay */
export interface GraspSolution {
  item: string;
  group: GroupId;
  side: number;
  choice: GraspChoice;
  by: GraspBy;
  frame: GraspFrame;
  /** Đầu cao của cạnh (khung món), xét ở mốc bắt đầu lần cầm */
  high?: V3;
  Wp: V3;
  Rw: M3;
  arm: ArmSol;
  /** Giá của lựa chọn (mục 5) và số ứng viên đã thử */
  cost: number;
  candidates: number;
  /**
   * Lần cầm theo mốc trước mốc món đầu hay sau mốc món cuối khi mốc ấy là mốc món nằm (`rest`): món vẽ đứng ở mốc ấy, không
   * theo bàn tay (bàn tay đang tới hay vừa rời món)
   */
  still?: ItemPose;
}

/** Báo của một chỗ cầm (`AimReport.hold.grasp`): `wrist.over` độ vượt kẹp, `wrist.off` lệch bàn tay vẽ (rig) */
export interface GraspReport {
  item: string;
  group: GroupId;
  mode: "item" | "hand";
  /** Lần cầm một tay theo mốc: món theo bàn tay đã vẽ */
  keyed?: true;
  t0: number;
  choice: GraspChoice;
  by: GraspBy;
  arm: {
    phi: number;
    wrist: { turn: number; bend: number; dev: number; over: number; off: number };
    body: number;
    /** Lấn chia bán kính tay ở chỗ lấn và chỗ ấy (`ArmSol.bodyRatio`, `bodyPart`): `act` điền khi tay vẽ theo nghiệm */
    bodyRatio?: number;
    bodyPart?: string;
    /** Khuỷu lệch vào phía giữa thân, phần `l₁` (`ArmSol.inward`); `act` điền như `bodyRatio` */
    inward?: number;
    gap: number;
  };
}

/**
 * Mốc món sau mốc bắt đầu của lần cầm; `ctx` là người cầm lúc ấy, thiếu thì người lúc bắt đầu. Mốc khác `cast` hay cỡ với
 * mốc bắt đầu bị bỏ
 */
export interface GraspLater {
  t: number;
  pose: ItemPose;
  ctx?: GraspCtx;
  /** Tay đã đặt lúc ấy (số hạng lấn) */
  other?: ArmSeg;
}

export interface GraspOpts {
  /** Tay đã đặt (số hạng lấn) */
  other?: ArmSeg;
  /** Hướng khuỷu của mốc tay, thế giới rig */
  elbow?: readonly number[];
  /** `φ` mẫu cuối của lần cầm trước trên cùng tay */
  phiPrev?: number;
  /** Giây bắt đầu lần cầm */
  t0?: number;
  /** Mốc món sau `t0`: giá cộng ở các mốc trong `span` giây, tối đa `laterMax`, trọng số `LATER_W` */
  later?: readonly GraspLater[];
  /** Giây sau `t0` còn xét mốc món, mặc định `LATER_SPAN`; số mốc tối đa, mặc định `LATER_MAX` */
  span?: number;
  laterMax?: number;
  /** Đầu cao của cạnh đã xét ở mốc bắt đầu lần cầm; nhóm có `edge` thì cảnh phải khai `edge` */
  high?: V3;
  /** `false`: không giải, trường thiếu lấy mặc định của nhóm (tay dẫn); `edge` của tấm: đứng `bottom`, nằm cạnh phía tay */
  solve?: boolean;
  /**
   * Lựa chọn của lần cầm liền trước cùng món, cùng nhóm, cùng tay (và đầu cao của nó): ứng viên khác nó ở trường rời
   * cộng `KEEP_COST`, chỉ khác trường liên tục cộng `KEEP_SLIDE`. docs/11-nhom-cam.md § Lựa chọn cảnh không khai
   */
  keep?: { choice: GraspChoice; high?: V3 };
}

/** Giá đổi trường rời (`part`, khối hình, `edge`, `thumb`, `variant`) khỏi lựa chọn đang giữ (`GraspOpts.keep`) */
export const KEEP_COST = 2;
/** Giá đổi trường liên tục khỏi lựa chọn đang giữ khi trường rời giữ nguyên */
export const KEEP_SLIDE = 1;

/** Giá lệch mặc định: `DEV_COST · (số trường lệch) / (số trường thiếu có mặc định)` */
const DEV_COST = 0.05;
/** Giá thêm khi rig chọn biến thể khác `variant.default` của nhóm */
const VARIANT_COST = 0.5;
/** Mốc món sau mốc bắt đầu lần cầm cộng vào giá của lựa chọn trong ngần này giây */
export const LATER_SPAN = 1.5;
const LATER_MAX = 4;
const LATER_W = 0.5;
/**
 * Nhóm có giá lún da trong `chooseMissing`: gò ngón cái ép cạnh hộp theo khung bàn tay (`palmBox`), ngón cái áp thân trụ
 * đâm vào khối `grip: false` nhô ra (`cylinder`); ngón ôm không gỡ được
 */
const SINK_GROUPS: ReadonlySet<GroupId> = new Set(["palmBox", "cylinder"]);
/** Giá lún `SINK_W · (lún / SINK_REF)²`; `SINK_REF` là ngưỡng luật `sink` (`HELD_SINK` của `heldAudit.ts`) */
const SINK_W = 1;
const SINK_REF = Math.abs(HELD_FIT.touch) + 0.5;
/**
 * Giá mặt đỡ `REST_W · (da dưới mặt / REST_REF)²` ở mốc món nằm; `REST_REF` là ngưỡng luật `rest` (`HELD_REST` của
 * `heldAudit.ts`). docs/11-nhom-cam.md § Mặt đỡ
 */
const REST_W = 1;
export const REST_REF = 0.65;
/** `thumbToward`: hướng ngoài miền quanh thân chỉ thắng khi cổ tay vượt ít hơn ngần này độ */
const THUMB_OVER = 1;
/** Trụ: `around` mà phần `grip: false` kề đoạn bám nhô khỏi mặt quá ngần này lần `W` về phía lòng tay thì rig không chọn */
const BULGE = 0.1;
/** Vành đĩa giải trên lưới góc bước này, độ (`0` ở `front`, hay `top` với đĩa đứng, về `right`) */
const DISC_STEP = 30;
/** `rim` không khai `thumb`, món không khai `top`: ngón cái ở mặt hướng lên quá ngần này (cos 45°: tấm nằm trong thế giới) */
const RIM_UP = Math.SQRT1_2;
const KIND_ORDER: FeatureKind[] = ["slab", "disc", "rod", "lathe", "box", "face"];
const DISCRETE = ["edge", "thumb", "variant"] as const;
const CONTINUOUS = ["along", "slant", "around", "tilt", "psi"] as const;
type Field = (typeof DISCRETE)[number] | (typeof CONTINUOUS)[number];
const FIELDS = ["part", "feature", ...DISCRETE, ...CONTINUOUS, "inset"] as const;

const geoms = new WeakMap<HeldItemSpec, ItemGeom>();
const geomOf = (spec: HeldItemSpec): ItemGeom => {
  let g = geoms.get(spec);
  if (!g) geoms.set(spec, (g = itemGeom(spec)));
  return g;
};

const sinks = new WeakMap<HeldItemSpec, Map<string, number>>();

/**
 * Da lún sâu nhất vào món (đơn vị món, như luật `sink`) khi bàn tay ở đúng khung cầm `f` và ngón ôm theo vai trò
 * (`heldFit`, tầm cuộn `curl` của biến thể); bàn tay cỡ `k`, `long` của người cỡ `s`. Nhớ theo món, bàn tay, khung và dáng
 */
function frameSink(
  spec: HeldItemSpec,
  f: GraspFrame,
  side: number,
  k: number,
  long: number,
  s: number,
  curl?: number,
) {
  if (!spec.shape?.length) return 0;
  const G = { R: f.G.R, p: scale3(f.G.p, 1 / s), u: f.G.u / s };
  const key = [side, k, long, ...G.R, ...G.p, G.u, ...f.pose]
    .map((x) => x.toFixed(6))
    .concat(JSON.stringify(f.roles), String(curl))
    .join();
  let m = sinks.get(spec);
  if (!m) sinks.set(spec, (m = new Map()));
  let d = m.get(key);
  if (d === undefined) {
    const { pos, skin } = fittedSkin(spec, f, G, side, k, long, key, curl);
    const { gaps } = skinDepth(pos, skinPieces(skin), G, spec.shape);
    d = Math.max(0, -Math.min(...Object.values(gaps)));
    m.set(key, d);
  }
  return d;
}

/** Da bàn tay đã ôm theo vai trò ở khung cầm, nhớ theo món và khoá của `frameSink`; giữ `SKIN_KEEP` bàn tay mỗi món */
const fitSkins = new WeakMap<HeldItemSpec, Map<string, { pos: Float32Array; skin: HandSkin }>>();
const SKIN_KEEP = 64;

function fittedSkin(
  spec: HeldItemSpec,
  f: GraspFrame,
  G: GripFrame,
  side: number,
  k: number,
  long: number,
  key: string,
  curl?: number,
) {
  let m = fitSkins.get(spec);
  if (!m) fitSkins.set(spec, (m = new Map()));
  const hit = m.get(key);
  if (hit) return hit;
  const skin = handSkin(side, k, long);
  const fit = heldFit({
    v: f.pose,
    side,
    k,
    long,
    shape: spec.shape!,
    G,
    roles: f.roles,
    bulge: skinBulge(skin, f.pose),
    ...(curl !== undefined && { curl }),
  });
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, [...f.pose, ...fit], pos);
  if (m.size >= SKIN_KEEP) m.delete(m.keys().next().value!);
  const out = { pos, skin };
  m.set(key, out);
  return out;
}

/**
 * Da dưới mặt đỡ của món nằm ở `pose` (`ItemPose.rest`): đơn vị rig thế giới, `0` khi cả bàn tay ở trên mặt. Bàn tay ở đúng
 * khung cầm `f`, ngón ôm theo vai trò như `frameSink`. docs/11-nhom-cam.md § Mặt đỡ
 */
export function restUnder(
  spec: HeldItemSpec,
  f: GraspFrame,
  side: number,
  k: number,
  long: number,
  s: number,
  pose: Pick<ItemPose, "R" | "s">,
  curl?: number,
): number {
  if (!spec.shape?.length) return 0;
  const G = { R: f.G.R, p: scale3(f.G.p, 1 / s), u: f.G.u / s };
  const key = [side, k, long, ...G.R, ...G.p, G.u, ...f.pose]
    .map((x) => x.toFixed(6))
    .concat(JSON.stringify(f.roles), String(curl))
    .join();
  const { pos } = fittedSkin(spec, f, G, side, k, long, key, curl);
  // hướng xuống thế giới (y rig) trong khung món: hàng giữa của `R`
  const R = pose.R;
  const down = unit([R[3], R[4], R[5]]);
  return Math.max(0, skinUnder(pos, G, spec.shape, down)) * pose.s;
}

function specOf(ctx: GraspCtx, item: string): HeldItemSpec {
  const s = ctx.held[item] ?? ctx.held[heldBase(item)];
  if (!s) throw new Error(`không có món \`${item}\``);
  return s;
}

/** Lưới của trường liên tục (`RangeChoice.grid` nếu nhóm khai): `along` 3 điểm giữa miền, `slant` ½ miền hai phía và 0, `around` 12, `tilt` 6, `psi` 5 điểm đều gồm hai đầu */
function grid(key: Field, c: RangeChoice, variant: string): number[] {
  return [...new Set(gridOf(key, c, variant))];
}
function gridOf(key: Field, c: RangeChoice, variant: string): number[] {
  const own = c.gridByVariant?.[variant];
  if (own) return [...own];
  if (c.grid) return [...c.grid];
  const [lo, hi] = c.byVariant?.[variant] ?? [c.min, c.max];
  const ring = (n: number) => Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / n);
  if (key === "along") return [0.25, 0.5, 0.75].map((x) => lo + (hi - lo) * x);
  if (key === "slant") return [lo / 2, 0, hi / 2];
  if (key === "around") return ring(12);
  if (key === "psi") return ring(4).concat(hi);
  if (key === "tilt") return ring(5).concat(hi);
  return [lo, hi];
}

/** Đầu cao của cạnh `edge` (mặt ngón cái `thumb`) hay trục dài của hộp, khi món quay `R` */
function highOf(
  geom: ItemGeom,
  f: Feature,
  c: GraspChoice,
  R: M3,
  side: number,
  across: V3,
): V3 | undefined {
  let e: V3;
  if (f.kind === "slab" || f.kind === "disc") {
    if (c.edge === undefined || c.thumb === undefined) return undefined;
    e = edgeFrame(f, c.edge, c.thumb as SideName).e;
  } else if (f.kind === "box") e = boxAxes(f, geom).e;
  else if (f.kind === "face") {
    const ed = f.edges.find((x) => x.name === c.edge);
    if (!ed) return undefined;
    e = cross3(neg(ed.inward), f.n);
  } else return undefined;
  return edgeHigh(e, R, side, across);
}

interface Cand {
  choice: GraspChoice;
  feature: Feature;
  frame: GraspFrame;
  high?: V3;
  Wp: V3;
  Rw: M3;
  arm: ArmSol;
  cost: number;
  /** Trùng trường rời của lựa chọn đang giữ mà lấy đầu cao của chính nó, khác đầu cao đang giữ */
  own?: boolean;
}

/**
 * Lựa chọn cảnh không khai của chỗ cầm `hold` trên món đứng yên ở `pose` (docs/11-nhom-cam.md § Lựa chọn cảnh không khai):
 * giải rời (`part`, khối hình, `edge`, `thumb`, `variant`) với trường liên tục ở mặc định, rồi lưới liên tục quanh nghiệm
 * rời tốt nhất và nghiệm rời tốt nhất của biến thể mặc định. Giá `min_φ E + (khe / AIM_GAP)²` ở mốc bắt đầu cộng `LATER_W`
 * lần ở các mốc sau, cộng giá lệch mặc định và `VARIANT_COST` cho biến thể khác mặc định; hoà thì ứng viên trước theo thứ
 * tự trường. `by`: `scene` cảnh khai, `rig` giải trên miền nhiều giá trị, `default`
 */
export function chooseMissing(
  ctx: GraspCtx,
  hold: SceneHold,
  pose: ItemPose,
  side: number,
  opts: GraspOpts = {},
): GraspSolution {
  const h = groupHold(hold);
  const spec = specOf(ctx, h.item);
  const geom = geomOf(spec);
  const group = GRIP_GROUPS[h.group];
  const byVariant = CONTACTS[h.group];
  if (!byVariant)
    throw new Error(
      `nhóm \`${h.group}\` chưa có chỗ tiếp xúc (có: ${Object.keys(CONTACTS).join(", ")})`,
    );
  const sd = side < 0 ? -1 : 1;
  const arm = ctx.arms[sd];
  const given: GraspChoice = {};
  for (const k of FIELDS) {
    const v = (h as Record<string, unknown>)[k];
    if (v !== undefined) (given as Record<string, unknown>)[k] = v;
  }
  // khối hình đã định (tay phụ của `both`): chỉ số trong `itemGeom(spec).features`
  const fixed = (h as GraspChoice).featureIndex;
  if (fixed !== undefined) given.featureIndex = fixed;
  if (opts.high && group.choices.edge && given.edge === undefined)
    throw new Error(
      `\`${h.item}@${h.group}\`: \`high\` là đầu cao của một cạnh, cần \`edge\` khai`,
    );
  const solve = opts.solve !== false;
  const t0 = opts.t0 ?? 0;
  const later = (opts.later ?? [])
    .filter(
      (x) =>
        x.t > t0 &&
        x.t <= t0 + (opts.span ?? LATER_SPAN) + 1e-9 &&
        x.pose.cast === pose.cast &&
        Math.abs(x.pose.s - pose.s) < 1e-9,
    )
    .slice(0, opts.laterMax ?? LATER_MAX);
  const missing = Object.keys(group.choices).filter(
    (k) => (FIELDS as readonly string[]).includes(k) && given[k as Field] === undefined,
  );
  const toHolder = (c: V3) =>
    matVec(tr(pose.R), sub3(ctx.face, add3(pose.P, scale3(matVec(pose.R, c), pose.s))));

  const kinds = new Set<string>(group.needs.flatMap((n) => n.kinds));
  const fit = (f: Feature) =>
    kinds.has(f.kind) &&
    (given.part === undefined || f.part === given.part) &&
    (given.feature === undefined || f.kind === given.feature) &&
    (fixed === undefined || geom.features.indexOf(f) === fixed) &&
    edgeOk(f, given.edge);
  let feats = groupNeeds(geom, group, ctx.dims, spec.anchors).filter(fit);
  if (!feats.length) feats = geom.features.filter(fit);
  // mặt đỡ: món đặt trước mặt chúc xuống nhất ở mốc bắt đầu, tay dẫn mặt gần `−top`; hoà thì gần `−front`
  if (h.group === "platform" && given.featureIndex === undefined) {
    const down = solve ? matVec(tr(pose.R), [0, 1, 0]) : neg(geom.U);
    const faces = supportFaces(
      feats.filter((f): f is FaceFeature => f.kind === "face"),
      down,
      neg(geom.F),
    );
    if (faces.length) feats = faces;
  }
  if (!feats.length)
    throw new Error(
      `món không có khối hình cho nhóm \`${group.id}\`${given.part ? ` ở phần \`${given.part}\`` : ""}`,
    );
  // `part` mặc định theo khối (`from: "longest"`, trụ): cảnh không khai `part` thì rig chỉ cầm phần ấy (thân chai)
  const pch = group.choices.part;
  if (given.part === undefined && pch?.kind === "names" && pch.from === "longest") {
    const lp = holdDefaults(group, geom).part;
    if (feats.some((f) => f.part === lp)) feats = feats.filter((f) => f.part === lp);
  }
  const partIx = (p: string) => geom.parts.findIndex((x) => x.name === p);
  feats = [...feats].sort(
    (a, b) =>
      partIx(a.part) - partIx(b.part) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
  if (!solve) feats = feats.slice(0, 1);
  const variants = (
    (group.choices.variant?.kind === "names" && group.choices.variant.values) ||
    Object.keys(group.variants)
  ).filter((v) => byVariant[v] && group.variants[v]?.pose);
  // nhóm suy biến thể từ khối hình và `around` (`variantOf`): để `graspFrame` chọn theo từng ứng viên
  const auto = !!group.variantOf && given.variant === undefined && !group.choices.variant;

  const sizes: Partial<Record<keyof GraspChoice, number>> = {
    part: new Set(feats.map((f) => f.part)).size,
    feature: feats.length,
  };
  const seen = (k: keyof GraspChoice, n: number) => (sizes[k] = Math.max(sizes[k] ?? 0, n));
  let tried = 0;

  // lựa chọn đang giữ: chỉ trường cảnh không khai
  const keep = solve ? opts.keep : undefined;
  const kc = keep?.choice;
  const keepCont: GraspChoice = {};
  for (const k of CONTINUOUS)
    if (kc?.[k] !== undefined && missing.includes(k))
      (keepCont as Record<string, unknown>)[k] = kc[k];
  /** `0` trùng lựa chọn đang giữ, `1` chỉ khác trường liên tục, `2` khác trường rời */
  const keepRel = (f: Feature, c: GraspChoice): number => {
    if (!kc) return 0;
    if (given.part === undefined && fixed === undefined) {
      if (kc.featureIndex !== undefined) {
        if (geom.features.indexOf(f) !== kc.featureIndex) return 2;
      } else if (
        (kc.part !== undefined && f.part !== kc.part) ||
        (kc.feature !== undefined && f.kind !== kc.feature)
      )
        return 2;
    }
    for (const k of DISCRETE)
      if (missing.includes(k) && kc[k] !== undefined && c[k] !== kc[k]) return 2;
    for (const k of CONTINUOUS)
      if (keepCont[k] !== undefined && Math.abs((c[k] as number) - (keepCont[k] as number)) > 1e-6)
        return 1;
    return 0;
  };

  const run = (
    f: Feature,
    c: GraspChoice,
    defs: Partial<Record<string, string | number>>,
    own = false,
  ): Cand => {
    tried++;
    const rel = own ? 2 : keepRel(f, c);
    const high =
      opts.high ?? (rel < 2 ? keep?.high : undefined) ?? highOf(geom, f, c, pose.R, sd, ctx.across);
    const choice = {
      ...c,
      group: h.group,
      part: f.part,
      feature: f.kind,
      featureIndex: geom.features.indexOf(f),
    };
    const frame = graspFrame(
      spec,
      geom,
      choice,
      sd,
      ctx.dims,
      ctx.k * ctx.s,
      ctx.long * ctx.s,
      pose.s,
      high,
    );
    const { Wp, Rw } = handFromItem(pose.R, pose.P, pose.s, frame.G);
    const sol = solvePhi(arm, Wp, Rw, opts.phiPrev, opts.other, opts.elbow);
    const gapCost = (s: ArmSol, ps: number) => (s.gap / (AIM_GAP * ps)) ** 2;
    let cost = sol.E + gapCost(sol, pose.s);
    for (const x of later) {
      const q = handFromItem(x.pose.R, x.pose.P, x.pose.s, frame.G);
      const s = solvePhi((x.ctx ?? ctx).arms[sd], q.Wp, q.Rw, undefined, x.other, opts.elbow);
      cost += LATER_W * (s.E + gapCost(s, x.pose.s));
    }
    const withDef = missing.filter((k) => defs[k] !== undefined);
    const off = withDef.filter((k) => choice[k as Field] !== defs[k]).length;
    if (withDef.length) cost += (DEV_COST * off) / withDef.length;
    if (missing.includes("variant") && defs.variant !== undefined && c.variant !== defs.variant)
      cost += VARIANT_COST;
    for (const k of missing) {
      const ch = group.choices[k as ChoiceKey];
      if (ch?.cost && defs[k] !== undefined && choice[k as Field] !== defs[k]) cost += ch.cost;
    }
    if (rel) cost += rel === 2 ? KEEP_COST : KEEP_SLIDE;
    // thân món nên ở trên bàn tay: `u` là sin góc ngẩng của hướng tâm nắm → tâm khối hình (y rig hướng xuống)
    if (group.variants[frame.choice.variant ?? ""]?.upright && "c" in f) {
      const u = -unit(matVec(pose.R, sub3(f.c, frame.hand.at)))[1];
      cost += UPRIGHT_W * ((1 - u) / 2) ** 2;
    }
    // giá lún không âm: ứng viên đã đắt hơn ứng viên tốt nhất thì không cần đo
    const vs = group.variants[frame.choice.variant ?? ""];
    if (solve && (SINK_GROUPS.has(h.group) || vs?.sink) && (!best || cost <= best.cost + 1e-12)) {
      const curl = vs?.curl;
      const sink = frameSink(spec, frame, sd, ctx.k, ctx.long, ctx.s, curl) * pose.s;
      cost += SINK_W * (sink / SINK_REF) ** 2;
    }
    // món nằm trên một mặt (`ItemPose.rest`): da dưới mặt ngang qua điểm thấp nhất của món là lún vào mặt đỡ
    const rests = [
      ...(pose.rest ? [{ p: pose, w: 1 }] : []),
      ...later.filter((x) => x.pose.rest).map((x) => ({ p: x.pose, w: LATER_W })),
    ];
    if (solve && rests.length && (!best || cost <= best.cost + 1e-12))
      for (const r of rests) {
        const under = restUnder(spec, frame, sd, ctx.k, ctx.long, ctx.s, r.p, vs?.curl);
        cost += r.w * REST_W * (under / REST_REF) ** 2;
      }
    return {
      choice: frame.choice,
      feature: f,
      frame,
      high,
      Wp,
      Rw,
      arm: sol,
      cost,
      ...(own && { own }),
    };
  };

  type Defs = Partial<Record<string, string | number>>;
  let best: Cand | undefined;
  let bestDefs: Defs = {};
  // ứng viên rời tốt nhất của biến thể mặc định: lưới liên tục chạy cả quanh nó
  let home: [Cand, Defs] | undefined;
  // `platform`: hướng ngón gắn với cạnh, lưới liên tục chạy quanh ứng viên rời tốt nhất của từng cạnh
  const byEdge = new Map<GraspChoice["edge"], [Cand, Defs]>();
  // ứng viên rời tốt nhất trùng trường rời của lựa chọn đang giữ: lưới liên tục chạy cả quanh nó
  let kept: [Cand, Defs] | undefined;
  // ứng viên rời tốt nhất giữ mọi trường có giá lệch (`NamesChoice.cost`) ở mặc định: lưới liên tục chạy cả quanh nó
  let plain: [Cand, Defs] | undefined;
  const costed = missing.filter((k) => !!group.choices[k as ChoiceKey]?.cost);
  const take = (x: Cand, defs: Defs) => {
    if (
      costed.length &&
      costed.every((k) => defs[k] === undefined || x.choice[k as Field] === defs[k]) &&
      (!plain || x.cost < plain[0].cost - 1e-12)
    )
      plain = [x, defs];
    if (
      kc &&
      !x.own &&
      keepRel(x.feature, x.choice) < 2 &&
      (!kept || x.cost < kept[0].cost - 1e-12)
    )
      kept = [x, defs];
    if (h.group === "platform") {
      const e = byEdge.get(x.choice.edge);
      if (!e || x.cost < e[0].cost - 1e-12) byEdge.set(x.choice.edge, [x, defs]);
    }
    if (!best || x.cost < best.cost - 1e-12) {
      best = x;
      bestDefs = defs;
    }
    if (
      missing.includes("variant") &&
      x.choice.variant === defs.variant &&
      (!home || x.cost < home[0].cost - 1e-12)
    )
      home = [x, defs];
  };
  const lead =
    !solve && (h.group === "sheet" || h.group === "card")
      ? (f: Feature) => {
          if (f.kind !== "slab" && f.kind !== "disc") return undefined;
          const l = f.lying ? (sd < 0 ? "right" : "left") : "bottom";
          return f.kind === "disc" ? 90 * f.rim.indexOf(l) : l;
        }
      : !solve && h.group === "platform"
        ? () => (sd < 0 ? "right" : "left")
        : undefined;
  // món khai `top` và tấm nằm: mặt `top`; không thì mặt hướng lên trong thế giới (y rig hướng xuống) khi tấm nằm
  const upFace = (f: Feature) => {
    if (f.kind !== "slab" && f.kind !== "disc") return undefined;
    if (spec.top !== undefined && f.lying) return "top";
    const up = f.faces.map((x) => -matVec(pose.R, x.n)[1]);
    const i = up[1] > up[0] ? 1 : 0;
    return up[i] > RIM_UP ? f.faces[i].name : undefined;
  };

  // nhóm có `clear`: bỏ `around` mà phần `grip: false` nhô ra phía lòng tay, trừ khi mọi `around` của lưới đều thế
  const aroundOk = (f: Feature): ((v: number) => boolean) => {
    const ch = group.choices.around;
    if (!group.clear || ch?.kind !== "range" || (f.kind !== "rod" && f.kind !== "lathe"))
      return () => true;
    const ok = (v: number) => !bulgeToward(geom, f, v, BULGE * ctx.dims.W).length;
    return grid("around", ch, "").some(ok) ? ok : () => true;
  };

  // nhóm có `clear` (trụ), rig giải: `along` cảnh không khai kẹp vào chính khối hình của ứng viên (`ownAlong`; thân chai
  // không trượt sang vai, cổ cùng đoạn bám)
  const alongIn = (f: Feature, v: number) => {
    if (!solve || !group.clear || (f.kind !== "rod" && f.kind !== "lathe")) return v;
    const [lo, hi] = ownAlong(geom, f, { clear: group.clear * ctx.dims.W });
    return Math.min(hi, Math.max(lo, v));
  };

  // biến thể có `thumbToward`: `around` cho phía ngón cái về thân người cầm, rig chỉ thử quanh đó
  const thumbAround = (f: Feature, variant: string | undefined): number | undefined => {
    if (!group.variants[variant ?? ""]?.thumbToward || given.around !== undefined) return undefined;
    if (f.kind !== "lathe" && f.kind !== "rod") return undefined;
    // về thân người cầm dọc hướng mặt người (ngang, vuông góc `across`), khung món
    const ahead = unit(cross3(ctx.across, [0, 1, 0]));
    const toBody = sub3(ctx.face, add3(pose.P, scale3(matVec(pose.R, f.c), pose.s)));
    const back = scale3(ahead, dot3(toBody, ahead) < 0 ? -1 : 1);
    return aroundOf(geom, f, matVec(tr(pose.R), back));
  };
  const thumbGrid = (a0: number) =>
    Array.from(
      { length: (2 * THUMB_TOWARD_SPAN) / THUMB_TOWARD_STEP + 1 },
      (_, i) => (((a0 - THUMB_TOWARD_SPAN + i * THUMB_TOWARD_STEP) % 360) + 360) % 360,
    );

  for (const f of feats) {
    const okAround = aroundOk(f);
    const defs = holdDefaults(group, geom, {
      feature: f,
      side: sd,
      toHolder: toHolder("c" in f ? f.c : [0, 0, 0]),
    });
    const dom = (k: (typeof DISCRETE)[number]): (string | number | undefined)[] => {
      if (given[k] !== undefined) return [given[k]];
      const ch = group.choices[k];
      if (!ch) return [undefined];
      let vals: (string | number)[] = [];
      if (k === "variant") vals = variants;
      else if (ch.kind === "names" && ch.values) vals = [...ch.values];
      else if (k === "edge" && f.kind === "slab") {
        const long = longEdges(f, ctx.dims);
        vals = (long.length ? long : f.edges).map((e) => e.name);
      } else if (k === "edge" && f.kind === "disc")
        vals = Array.from({ length: 360 / DISC_STEP }, (_, i) => i * DISC_STEP);
      else if (k === "edge" && f.kind === "face") vals = f.edges.map((e) => e.name);
      else if (k === "thumb" && (f.kind === "slab" || f.kind === "disc"))
        vals = f.faces.map((x) => x.name);
      if (!solve || !vals.length) {
        const l = k === "edge" ? lead?.(f) : undefined;
        return [defs[k] ?? (l !== undefined && vals.includes(l) ? l : vals[0])];
      }
      return vals;
    };
    const cont = (variant: string): GraspChoice => {
      const o: Record<string, unknown> = {};
      for (const k of CONTINUOUS) {
        const ch = group.choices[k];
        if (!ch) continue;
        const v =
          given[k] ??
          (k === "around"
            ? thumbAround(
                f,
                variant || (auto ? group.variantOf?.(f, geom, undefined, ctx.dims) : ""),
              )
            : undefined) ??
          defs[k] ??
          (ch.kind === "range"
            ? grid(k, ch, variant).filter((x) => k !== "around" || okAround(x))[0]
            : undefined);
        if (v !== undefined)
          o[k] = k === "along" && given.along === undefined ? alongIn(f, v as number) : v;
      }
      return o as GraspChoice;
    };
    const edges = dom("edge");
    const thumbs = dom("thumb");
    const vars = dom("variant");
    seen("edge", edges.length);
    seen("thumb", thumbs.length);
    seen("variant", vars.length);
    const up = solve && given.thumb === undefined ? upFace(f) : undefined;
    for (const edge of edges)
      for (const thumb of thumbs)
        for (const variant of vars) {
          const v =
            (variant as string | undefined) ??
            (defs.variant as string | undefined) ??
            (auto ? undefined : variants[0]);
          if (v === "rim" && up !== undefined && thumb !== up) continue;
          if (
            v !== undefined &&
            given.variant === undefined &&
            tooThick(group, v, f, edge as SideName | number | undefined, ctx.dims, spec.shape) !==
              undefined
          )
            continue;
          // biến thể kẹp qua hai mép: bỏ cạnh mà bề rộng tấm ngoài tầm, trừ khi cảnh khai cả biến thể lẫn cạnh
          if (
            v !== undefined &&
            (given.variant === undefined || given.edge === undefined) &&
            acrossMiss(group, v, f, edge as SideName | number | undefined, ctx.dims) !== undefined
          )
            continue;
          const c = {
            ...given,
            ...cont(v ?? ""),
            ...(edge !== undefined && { edge }),
            ...(thumb !== undefined && { thumb }),
            ...(v !== undefined && { variant: v }),
          } as GraspChoice;
          if (keepRel(f, c) < 2) {
            // trùng trường rời của lựa chọn đang giữ: trường liên tục của nó; đầu cao khác đầu cao đang giữ là cách cầm khác
            take(run(f, { ...c, ...keepCont }, defs), defs);
            const oh = keep?.high && !opts.high && highOf(geom, f, c, pose.R, sd, ctx.across);
            if (oh && dot3(oh, keep!.high!) < 1 - 1e-6) take(run(f, c, defs, true), defs);
          } else take(run(f, c, defs), defs);
        }
  }
  if (!best) throw new Error(`\`${h.item}@${h.group}\`: không có ứng viên`);

  const rough: Cand = best;
  const overOf = (x: Cand) =>
    Math.max(...(["turn", "bend", "dev"] as const).map((k) => Math.abs(x.arm.wrist.over[k])));
  const free = solve ? CONTINUOUS.filter((k) => missing.includes(k)) : [];
  const roots: [Cand, Defs][] = [[rough, bestDefs]];
  if (home && home[0] !== rough) roots.push(home);
  if (kept && kept[0] !== rough) roots.push(kept);
  if (plain && plain[0] !== rough && plain[0] !== home?.[0]) roots.push(plain);
  for (const r of byEdge.values()) if (r[0] !== rough) roots.push(r);
  // hoà thì giá trị liên tục nhỏ hơn trước, theo thứ tự trường (docs/11 mục 5)
  const before = (a: GraspChoice, b: GraspChoice) => {
    for (const k of free) if (a[k] !== b[k]) return (a[k] as number) < (b[k] as number);
    return false;
  };
  for (const [root, defs] of free.length ? roots : []) {
    const okAround = aroundOk(root.feature);
    const a0 = thumbAround(root.feature, root.choice.variant);
    const combosOf = (window: boolean) => {
      let out: GraspChoice[] = [{}];
      for (const k of free) {
        const ch = group.choices[k] as RangeChoice;
        const vals =
          k === "around" && window && a0 !== undefined
            ? thumbGrid(a0)
            : k === "along"
              ? grid(k, ch, root.choice.variant ?? "").map((x) => alongIn(root.feature, x))
              : grid(k, ch, root.choice.variant ?? "").filter((x) => k !== "around" || okAround(x));
        seen(k, vals.length);
        out = out.flatMap((c) => vals.map((v) => ({ ...c, [k]: v })));
      }
      if (
        kc &&
        !root.own &&
        free.every((k) => keepCont[k] !== undefined) &&
        keepRel(root.feature, root.choice) < 2
      )
        out.push(Object.fromEntries(free.map((k) => [k, keepCont[k]])) as GraspChoice);
      return out;
    };
    const base: GraspChoice = {
      ...given,
      edge: root.choice.edge,
      thumb: root.choice.thumb,
      ...(!auto && { variant: root.choice.variant }),
    };
    for (const c of combosOf(true)) {
      const x = run(root.feature, { ...base, ...c }, defs, root.own);
      if (
        x.cost < best.cost - 1e-12 ||
        (x.cost <= best.cost + 1e-12 && before(x.choice, best.choice))
      )
        best = x;
    }
    // hướng ngón cái về thân vượt cổ tay mà cả vòng `around` có hướng vượt ít hơn hẳn: lấy hướng ấy
    if (a0 !== undefined && overOf(best) > 0) {
      let alt: Cand | undefined;
      for (const c of combosOf(false)) {
        const x = run(root.feature, { ...base, ...c }, defs, root.own);
        if (overOf(x) < overOf(best) - THUMB_OVER && (!alt || x.cost < alt.cost - 1e-12)) alt = x;
      }
      if (alt) best = alt;
    }
  }
  const win: Cand = best;
  const by: GraspBy = {};
  for (const k of Object.keys(win.choice) as (keyof GraspChoice)[])
    if (k !== "featureIndex")
      by[k] =
        given[k] !== undefined
          ? "scene"
          : solve && (sizes[k] ?? 0) > 1 && (k === "feature" || missing.includes(k))
            ? "rig"
            : "default";
  return {
    item: h.item,
    group: h.group,
    side: sd,
    choice: win.choice,
    by,
    frame: win.frame,
    ...(win.high && { high: win.high }),
    Wp: win.Wp,
    Rw: win.Rw,
    arm: win.arm,
    cost: win.cost,
    candidates: tried,
  };
}

/**
 * Bàn tay bên `side` cầm món đặt trước ở `pose` theo chỗ cầm `hold`: trường thiếu giải bằng `chooseMissing` (hay lấy mặc
 * định khi `solve: false`), khung cầm `graspFrame`, bàn tay `handFromItem`, khuỷu `solvePhi`. docs/11-nhom-cam.md mục 5
 */
export const graspAt = (
  ctx: GraspCtx,
  hold: SceneHold,
  pose: ItemPose,
  side: number,
  other?: ArmSeg,
  opts: Omit<GraspOpts, "other"> = {},
): GraspSolution => chooseMissing(ctx, hold, pose, side, { ...opts, other });

/** Báo của nghiệm `sol` cho lần cầm bắt đầu ở `t0` */
export function graspReport(
  sol: GraspSolution,
  t0: number,
  mode: "item" | "hand" = "item",
): GraspReport {
  const w = sol.arm.wrist;
  const over = Math.max(w.over.turn, w.over.bend, w.over.dev);
  let off = 0;
  if (over > 0) {
    const cl = (v: number, L: number) => Math.max(-L, Math.min(L, v));
    const drawn = matMul(
      sol.arm.fore,
      wristTurn(cl(w.turn, TURN_MAX), cl(w.bend, AIM_BEND), cl(w.dev, AIM_DEV), sol.side),
    );
    const c = gripPoint(sol.frame.G, sol.frame.hand.at);
    off = Math.hypot(...sub3(matVec(sol.Rw, c), matVec(drawn, c))) * 100;
  }
  return {
    item: sol.item,
    group: sol.group,
    mode,
    t0,
    choice: sol.choice,
    by: sol.by,
    arm: {
      phi: sol.arm.phi,
      wrist: { turn: w.turn, bend: w.bend, dev: w.dev, over, off },
      body: sol.arm.body,
      inward: sol.arm.inward,
      gap: sol.arm.gap,
    },
  };
}
