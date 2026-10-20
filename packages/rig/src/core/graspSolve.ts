import { AIM_BEND, AIM_DEV, markShape, TURN_MAX, type Trunk3 } from "./arm3";
import { AIM_GAP } from "./constants";
import { armInput, solvePhi, type ArmInput, type ArmSeg, type ArmSol } from "./graspArm";
import {
  GRIP_GROUPS,
  groupNeeds,
  holdDefaults,
  longEdges,
  SHEET_INSET,
  spanAt,
  tooThick,
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
import { handSkin, skinHand } from "./handMesh";
import { HELD_FIT, heldDistance, heldFit, skinBulge, skinDepth, skinPieces } from "./heldFit";
import {
  alongFrac,
  axialAt,
  bulgeToward,
  edgeFrame,
  edgePoint,
  faceRho,
  handDims,
  itemGeom,
  type AlongName,
  type BoxFeature,
  type DiscFeature,
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
  gripFrame,
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
  /**
   * Đỉnh da lòng tay ở dáng gốc tính từ tâm nắm, đơn vị món, toạ độ theo `palm`, `fingers`, `palm × fingers`; `at` là số đo
   * ở chỗ tiếp xúc như `GraspContact`
   */
  palmSkin?: (at?: Pick<GraspContact, "thick" | "radius" | "thumbRadius">) => readonly V3[];
}

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
/** `palmBox` (fixture `dien-thoai#doc`): ngón chếch về đầu trên trong mặt máy, độ; tâm nắm lệch về cạnh đầu ngón và sau mặt sau, đơn vị món */
const BOX_RISE = 20;
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

/** Tâm nắm ở `o + u · S` với các điểm da `pts` (khung món, tính từ tâm nắm): `S` lớn nhất mà da còn cách hình `WRAP_GAP` */
function skinTouch(shape: readonly HeldShape[], o: V3, u: V3, pts: readonly V3[], far: number) {
  let S = far;
  for (let i = 0; i < 96; i++) {
    const c = add3(o, scale3(u, S));
    let d = Infinity;
    for (const q of pts) d = Math.min(d, heldDistance(shape, add3(c, q)));
    if (d < WRAP_GAP + TOUCH) return S;
    S -= d - WRAP_GAP;
    if (S < -far) break;
  }
  return undefined;
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
  let slope = 0;
  if (x.shape) {
    const h = WRAP_HALF * x.dims.W;
    const rs = Array.from({ length: WRAP_STEPS }, (_, i) => h * ((2 * i) / (WRAP_STEPS - 1) - 1))
      .map((w) => [w, outerAt(x.shape!, add3(p.at, scale3(p.a, w)), p.rho, far)] as const)
      .filter((q): q is readonly [number, number] => q[1] !== undefined);
    if (rs.length > 1)
      slope = (rs[0][1] - rs[rs.length - 1][1]) / (rs[rs.length - 1][0] - rs[0][0]);
  }
  const b = Math.max(-WRAP_TILT_MAX, Math.min(WRAP_TILT_MAX, (WRAP_GAIN * Math.atan(slope)) / D2R));
  const palm = neg(mix2(p.rho, Math.cos(b * D2R), p.a, Math.sin(b * D2R)));
  const t = unit(perp(scale3(p.a, x.thumb === "down" ? -1 : 1), palm));
  const fingers = unit(scale3(cross3(t, palm), x.side));
  const z = cross3(palm, fingers);
  const radius = f.kind === "lathe" ? p.r : undefined;
  const ahead = along + ((x.thumb === "down" ? -1 : 1) * WRAP_THUMB_AHEAD * x.dims.W) / p.seg.len;
  const thumbRadius =
    radius === undefined
      ? undefined
      : Math.min(radius, axialAt(x.geom, f, Math.min(1, Math.max(0, ahead)), x.around ?? 0).r);
  const pts = (x.palmSkin?.({ radius, thumbRadius }) ?? []).map((c) =>
    add3(add3(scale3(palm, c[0]), scale3(fingers, c[1])), scale3(z, c[2])),
  );
  const S = (x.shape && pts.length && skinTouch(x.shape, p.at, p.rho, pts, far)) || p.r;
  return { at: add3(p.at, scale3(p.rho, S)), along, palm, fingers, radius, thumbRadius };
};

/** Chỗ tiếp xúc theo nhóm và biến thể; nhóm chưa có ở đây thì `graspFrame` báo lỗi */
export const CONTACTS: Partial<Record<GroupId, Record<string, ContactFn>>> = {
  sheet: { pinch, flat, rim },
  palmBox: { default: palmBox },
  cylinder: { wrap },
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
  (f.kind === "slab"
    ? f.edges.some((x) => x.name === edge)
    : f.kind === "disc"
      ? typeof edge === "number" || f.rim.includes(edge)
      : true);
const faceOk = (f: Feature, thumb: GraspChoice["thumb"]) =>
  thumb === undefined ||
  (f.kind === "slab" || f.kind === "disc" ? f.faces.some((x) => x.name === thumb) : true);

/**
 * Khối hình của chỗ cầm: `featureIndex` nếu khai, không thì ưu tiên khối đạt `needs` ở cỡ tay này, không có thì khối cùng
 * loại đầu tiên
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
  const f = groupNeeds(geom, group, dims, spec.anchors).find(ok) ?? geom.features.find(ok);
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
  at: Pick<GraspContact, "thick" | "radius" | "thumbRadius"> = {},
): number[] {
  const local = ps.by === "thick" ? at.thick : ps.by === "radius" ? at.radius : undefined;
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

const palms = new Map<string, V3[]>();

/**
 * Đỉnh da lòng tay (đốt trọng số lớn nhất là lòng tay) của bàn tay bên `side` cỡ `k`, cỡ dọc `long` ở dáng `v`, tính từ
 * tâm nắm của dáng `pose`: toạ độ theo pháp tuyến lòng tay, hướng ngón, phía ngón cái của khung bàn tay, đơn vị rig
 */
function palmPoints(side: number, k: number, long: number, v: HandVec, pose: HandPose): V3[] {
  const key = [side, k, long, ...v].map((x) => x.toFixed(4)).join() + pose;
  let out = palms.get(key);
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
    if (dom[i] !== PALM) continue;
    const d = sub3([pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]], c);
    out.push([dot3(d, n) * 100, dot3(d, f) * 100, dot3(d, z) * 100]);
  }
  palms.set(key, out);
  return out;
}

/**
 * Khung cầm của chỗ cầm `choice` (nhóm `group`) trên món `spec` (`geom = itemGeom(spec)`) cho tay bên `side`: chỗ tiếp xúc
 * của nhóm, bàn tay tổng hợp có điểm nắm là toạ độ khung món, `G` như `gripFrame` (`k`, `long`, `s` như ở đó), dáng gốc
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
    choice.variant ?? (def.variant as string | undefined) ?? Object.keys(group.variants)[0];
  const vs = group.variants[variant];
  const contact = byVariant[variant];
  if (!vs || !contact)
    throw new Error(
      `biến thể \`${variant}\` không có ở nhóm \`${group.id}\` (${Object.keys(byVariant).join(", ")})`,
    );
  if (!vs.pose) throw new Error(`biến thể \`${variant}\` của nhóm \`${group.id}\` chưa có dáng`);
  const edge = choice.edge;
  if ((feature.kind === "slab" || feature.kind === "disc") && edge === undefined)
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
    palmSkin: (at) =>
      palmPoints(
        side,
        dims.W / (200 * HAND_BONES.palm.half[1]),
        dims.P / (100 * HAND_BONES.palm.len),
        basePose(vs.pose!, feature, dims, at),
        vs.pose!.closed.pose as HandPose,
      ),
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
    G: gripFrame(spec, hand, side, k, long, s),
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
}

/** Báo của một chỗ cầm (`AimReport.hold.grasp`): `wrist.over` độ vượt kẹp, `wrist.off` lệch bàn tay vẽ (rig) */
export interface GraspReport {
  item: string;
  group: GroupId;
  mode: "item" | "hand";
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
  /** Mốc món sau `t0`: giá cộng ở các mốc trong `LATER_SPAN` giây, tối đa `LATER_MAX`, trọng số `LATER_W` */
  later?: readonly GraspLater[];
  /** Đầu cao của cạnh đã xét ở mốc bắt đầu lần cầm; nhóm có `edge` thì cảnh phải khai `edge` */
  high?: V3;
  /** `false`: không giải, trường thiếu lấy mặc định của nhóm (tay dẫn); `edge` của tấm: đứng `bottom`, nằm cạnh phía tay */
  solve?: boolean;
}

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
 * (`heldFit`); bàn tay cỡ `k`, `long` của người cỡ `s`. Nhớ theo món, bàn tay, khung và dáng
 */
function frameSink(
  spec: HeldItemSpec,
  f: GraspFrame,
  side: number,
  k: number,
  long: number,
  s: number,
) {
  if (!spec.shape?.length) return 0;
  const G = { R: f.G.R, p: scale3(f.G.p, 1 / s), u: f.G.u / s };
  const key = [side, k, long, ...G.R, ...G.p, G.u, ...f.pose]
    .map((x) => x.toFixed(6))
    .concat(JSON.stringify(f.roles))
    .join();
  let m = sinks.get(spec);
  if (!m) sinks.set(spec, (m = new Map()));
  let d = m.get(key);
  if (d === undefined) {
    const skin = handSkin(side, k, long);
    const fit = heldFit({
      v: f.pose,
      side,
      k,
      long,
      shape: spec.shape,
      G,
      roles: f.roles,
      bulge: skinBulge(skin, f.pose),
    });
    const pos = new Float32Array(skin.pos.length);
    skinHand(skin, [...f.pose, ...fit], pos);
    const { gaps } = skinDepth(pos, skinPieces(skin), G, spec.shape);
    d = Math.max(0, -Math.min(...Object.values(gaps)));
    m.set(key, d);
  }
  return d;
}

function specOf(ctx: GraspCtx, item: string): HeldItemSpec {
  const s = ctx.held[item] ?? ctx.held[heldBase(item)];
  if (!s) throw new Error(`không có món \`${item}\``);
  return s;
}

/** Lưới của trường liên tục: `along` 3 điểm, `slant` ½ miền hai phía và 0, `around` 12, `tilt` 6 điểm đều gồm hai đầu, `psi` 8 */
function grid(key: Field, c: RangeChoice, variant: string): number[] {
  const [lo, hi] = c.byVariant?.[variant] ?? [c.min, c.max];
  const ring = (n: number) => Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / n);
  if (key === "along") return [0.25, 0.5, 0.75];
  if (key === "slant") return [lo / 2, 0, hi / 2];
  if (key === "around") return ring(12);
  if (key === "psi") return ring(8);
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
  else return undefined;
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
        x.t <= t0 + LATER_SPAN + 1e-9 &&
        x.pose.cast === pose.cast &&
        Math.abs(x.pose.s - pose.s) < 1e-9,
    )
    .slice(0, LATER_MAX);
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
    edgeOk(f, given.edge);
  let feats = groupNeeds(geom, group, ctx.dims, spec.anchors).filter(fit);
  if (!feats.length) feats = geom.features.filter(fit);
  if (!feats.length)
    throw new Error(
      `món không có khối hình cho nhóm \`${group.id}\`${given.part ? ` ở phần \`${given.part}\`` : ""}`,
    );
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

  const sizes: Partial<Record<keyof GraspChoice, number>> = {
    part: new Set(feats.map((f) => f.part)).size,
    feature: feats.length,
  };
  const seen = (k: keyof GraspChoice, n: number) => (sizes[k] = Math.max(sizes[k] ?? 0, n));
  let tried = 0;

  const run = (
    f: Feature,
    c: GraspChoice,
    defs: Partial<Record<string, string | number>>,
  ): Cand => {
    tried++;
    const high = opts.high ?? highOf(geom, f, c, pose.R, sd, ctx.across);
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
    const off = withDef.filter((k) => c[k as Field] !== defs[k]).length;
    if (withDef.length) cost += (DEV_COST * off) / withDef.length;
    if (missing.includes("variant") && defs.variant !== undefined && c.variant !== defs.variant)
      cost += VARIANT_COST;
    // giá lún không âm: ứng viên đã đắt hơn ứng viên tốt nhất thì không cần đo
    if (solve && SINK_GROUPS.has(h.group) && (!best || cost <= best.cost + 1e-12)) {
      const sink = frameSink(spec, frame, sd, ctx.k, ctx.long, ctx.s) * pose.s;
      cost += SINK_W * (sink / SINK_REF) ** 2;
    }
    return { choice: frame.choice, feature: f, frame, high, Wp, Rw, arm: sol, cost };
  };

  type Defs = Partial<Record<string, string | number>>;
  let best: Cand | undefined;
  let bestDefs: Defs = {};
  // ứng viên rời tốt nhất của biến thể mặc định: lưới liên tục chạy cả quanh nó
  let home: [Cand, Defs] | undefined;
  const take = (x: Cand, defs: Defs) => {
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
    !solve && h.group === "sheet"
      ? (f: Feature) => {
          if (f.kind !== "slab" && f.kind !== "disc") return undefined;
          const l = f.lying ? (sd < 0 ? "right" : "left") : "bottom";
          return f.kind === "disc" ? 90 * f.rim.indexOf(l) : l;
        }
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
          defs[k] ??
          (ch.kind === "range"
            ? grid(k, ch, variant).filter((x) => k !== "around" || okAround(x))[0]
            : undefined);
        if (v !== undefined) o[k] = v;
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
          const v = (variant as string | undefined) ?? (defs.variant as string) ?? variants[0];
          if (v === "rim" && up !== undefined && thumb !== up) continue;
          if (
            given.variant === undefined &&
            tooThick(group, v, f, edge as SideName | number | undefined, ctx.dims, spec.shape) !==
              undefined
          )
            continue;
          const c = {
            ...given,
            ...cont(v),
            ...(edge !== undefined && { edge }),
            ...(thumb !== undefined && { thumb }),
            variant: v,
          } as GraspChoice;
          take(run(f, c, defs), defs);
        }
  }
  if (!best) throw new Error(`\`${h.item}@${h.group}\`: không có ứng viên`);

  const rough: Cand = best;
  const free = solve ? CONTINUOUS.filter((k) => missing.includes(k)) : [];
  const roots: [Cand, Defs][] = [[rough, bestDefs]];
  if (home && home[0] !== rough) roots.push(home);
  // hoà thì giá trị liên tục nhỏ hơn trước, theo thứ tự trường (docs/11 mục 5)
  const before = (a: GraspChoice, b: GraspChoice) => {
    for (const k of free) if (a[k] !== b[k]) return (a[k] as number) < (b[k] as number);
    return false;
  };
  for (const [root, defs] of free.length ? roots : []) {
    const okAround = aroundOk(root.feature);
    let combos: GraspChoice[] = [{}];
    for (const k of free) {
      const ch = group.choices[k] as RangeChoice;
      const vals = grid(k, ch, root.choice.variant ?? "").filter(
        (x) => k !== "around" || okAround(x),
      );
      seen(k, vals.length);
      combos = combos.flatMap((c) => vals.map((v) => ({ ...c, [k]: v })));
    }
    const base: GraspChoice = {
      ...given,
      edge: root.choice.edge,
      thumb: root.choice.thumb,
      variant: root.choice.variant,
    };
    for (const c of combos) {
      const x = run(root.feature, { ...base, ...c }, defs);
      if (
        x.cost < best.cost - 1e-12 ||
        (x.cost <= best.cost + 1e-12 && before(x.choice, best.choice))
      )
        best = x;
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
    const c = gripPoint(sol.frame.G, sol.frame.hand.at as V3);
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
      gap: sol.arm.gap,
    },
  };
}
