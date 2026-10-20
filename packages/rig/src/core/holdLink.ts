import {
  GRIP_GROUPS,
  groupNeeds,
  holdDefaults,
  longEdges,
  supportFaces,
  type RoleMap,
} from "./graspGroups";
import { CONTACTS, edgeOk, graspFrame, type GraspChoice, type GraspFrame } from "./graspSolve";
import { fingerVec, HAND_POSES, type HandVec } from "./hand";
import { handDims, itemGeom, type FaceFeature, type Feature, type HandDims } from "./heldGeom";
import {
  gripCenter,
  gripFrame,
  gripHand,
  gripOf,
  gripSpec,
  isCarry,
  isHeldV2,
  leadSide,
  type GraspHand,
  type GripFrame,
  type GroupId,
  type HeldItemSpec,
  type HoldGrasp,
  type ReachHold,
} from "./heldItem";
import { dot3, sub3, type V3 } from "./lens";

/**
 * Lớp liên kết tay ↔ món: chỗ duy nhất rẽ kiểu cầm của món v1 (`món#kiểu`) và chỗ cầm nhóm (`món@nhóm`, `ReachHold.grasp`)
 * cho bàn tay. docs/11-nhom-cam.md mục 4–6
 */

/** Bàn tay của một lần cầm cho tay bên `side` */
export interface HoldLinkHand {
  /** Điểm nắm, lòng tay, ngón trong khung món */
  hand: GraspHand;
  /** Dáng (`HAND_DOF`, xoay và gập `0`): dáng tên của kiểu cầm (v1), dáng gốc đã hoà của `graspFrame` (v2) */
  pose: HandVec;
  /** Vai trò ngón (v2) cho `heldFit` */
  roles?: RoleMap;
  /** Tầm cuộn của biến thể (v2, `VariantSpec.curl`) cho `heldFit` */
  curl?: number;
  /** Cầm hai tay: bên tay mang món và bàn tay của tay kia */
  both?: { lead: number; other: GraspHand; pose: HandVec; roles?: RoleMap; curl?: number };
  /** Khung cầm (v2) */
  frame?: GraspFrame;
}

const namedPose = (h: GraspHand): number[] => [0, 0, ...fingerVec(HAND_POSES[h.pose])];

/** `curl` của biến thể khung `fr` trong nhóm `group`, không khai thì không có trường */
const curlOf = (group: GroupId, fr: GraspFrame) => {
  const curl = GRIP_GROUPS[group].variants[fr.choice.variant ?? ""]?.curl;
  return curl === undefined ? {} : { curl };
};

/** Lần cầm là chỗ cầm nhóm: món v2 dù cảnh chưa gắn `grasp` */
const isGroupHold = (h: ReachHold) => !!h.grasp || isHeldV2(h.spec);

/** Lần cầm treo trên cánh tay (không chiếm bàn tay): kiểu treo của món v1, nhóm `carry` */
export const isCarryHold = (
  spec: HeldItemSpec | undefined,
  h: Pick<ReachHold, "grip"> & { grasp?: Pick<HoldGrasp, "hold"> },
): boolean => (h.grasp ? h.grasp.hold.group === "carry" : isCarry(spec?.grips?.[h.grip]));

const FIELDS = [
  "part",
  "edge",
  "along",
  "thumb",
  "variant",
  "slant",
  "around",
  "tilt",
  "psi",
  "inset",
] as const;

/** Cạnh mặc định của tấm cho tay dẫn: tấm đứng `bottom`, tấm nằm và mặt đỡ cạnh phía tay ấy (docs/11 mục 5) */
function leadEdge(f: Feature, side: number, dims: HandDims): GraspChoice["edge"] {
  if (f.kind === "face") {
    const l = side < 0 ? "right" : "left";
    return f.edges.find((e) => e.name === l)?.name ?? f.edges[0]?.name;
  }
  if (f.kind !== "slab" && f.kind !== "disc") return undefined;
  const l = f.lying ? (side < 0 ? "right" : "left") : "bottom";
  if (f.kind === "disc") return Math.max(0, 90 * f.rim.indexOf(l));
  const vals = (longEdges(f, dims).length ? longEdges(f, dims) : f.edges).map((e) => e.name);
  return (vals.includes(l) ? l : vals[0]) as GraspChoice["edge"];
}

/** Lựa chọn đủ để dựng khung: trường của `grasp.choice`, trường thiếu lấy mặc định của nhóm trên khối hình của chỗ cầm */
function fillChoice(
  spec: HeldItemSpec,
  group: GroupId,
  given: GraspChoice,
  side: number,
  dims: HandDims,
): GraspChoice & { group: GroupId } {
  const geom = itemGeom(spec);
  const gs = GRIP_GROUPS[group];
  const kinds = new Set<string>(gs.needs.flatMap((n) => n.kinds));
  const ok = (f: Feature) =>
    kinds.has(f.kind) &&
    (given.part === undefined || f.part === given.part) &&
    (given.feature === undefined || f.kind === given.feature) &&
    edgeOk(f, given.edge);
  const fits = groupNeeds(geom, gs, dims, spec.anchors).filter(ok);
  // mặt đỡ của tay dẫn: gần `−top`, hoà thì gần `−front`
  const faces =
    group === "platform"
      ? supportFaces(
          fits.filter((x): x is FaceFeature => x.kind === "face"),
          geom.U.map((v) => -v) as V3,
          geom.F.map((v) => -v) as V3,
        )
      : [];
  const f =
    given.featureIndex !== undefined
      ? geom.features[given.featureIndex]
      : (faces[0] ?? fits[0] ?? geom.features.find(ok));
  // không có khối hình: `graspFrame` ném lỗi có tên
  if (!f) return { ...given, group };
  const c: Record<string, unknown> = { ...given };
  const defs = holdDefaults(gs, geom, { feature: f, side: side < 0 ? -1 : 1 });
  for (const k of FIELDS) if (c[k] === undefined && defs[k] !== undefined) c[k] = defs[k];
  if (c.edge === undefined && gs.choices.edge) c.edge = leadEdge(f, side, dims);
  return {
    ...(c as GraspChoice),
    group,
    part: f.part,
    feature: f.kind,
    featureIndex: geom.features.indexOf(f),
  };
}

const frames = new WeakMap<HeldItemSpec, Map<string, GraspFrame>>();

/** `graspFrame` nhớ theo món và tham số */
function frameOf(
  spec: HeldItemSpec,
  c: GraspChoice & { group: GroupId },
  side: number,
  dims: HandDims,
  k: number,
  long: number,
  s: number,
): GraspFrame {
  let m = frames.get(spec);
  if (!m) frames.set(spec, (m = new Map()));
  const key = JSON.stringify([c, side, dims, k, long, s]);
  let fr = m.get(key);
  if (!fr) m.set(key, (fr = graspFrame(spec, itemGeom(spec), c, side, dims, k, long, s)));
  return fr;
}

const OPPOSITE: Record<string, string> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
  front: "back",
  back: "front",
};

/** Cạnh đối diện cạnh của khung `fr` trên cùng khối hình */
function oppositeEdge(fr: GraspFrame): GraspChoice["edge"] {
  const e = fr.choice.edge;
  if (e === undefined) return undefined;
  const f = fr.feature;
  if (typeof e === "number") return (((e + 180) % 360) + 360) % 360;
  if (f.kind === "slab") {
    const own = f.edges.find((x) => x.name === e);
    if (!own) return OPPOSITE[e] as GraspChoice["edge"];
    const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return f.edges.reduce((a, b) => (dot(b.m, own.m) < dot(a.m, own.m) ? b : a)).name;
  }
  if (f.kind === "disc") return f.rim[(f.rim.indexOf(e as never) + 2) % 4];
  return OPPOSITE[e] as GraspChoice["edge"];
}

/**
 * Chỗ của tay phụ khác nhóm (`support.place`) trên mặt hộp có pháp tuyến `−top` (`bottom`) hay `−front` (`back`), xa nhất
 * theo hướng ấy, ở phần cầm được: ngón theo `top` chiếu lên mặt (mặt vuông `top` thì theo `front`), tay tới từ cạnh sau
 * ngón (`psi` 0), tâm nắm giữa mặt; tay dẫn nằm trên mặt ấy thì tâm nắm dời theo ngón tới khi gót lòng qua bàn tay dẫn.
 * Không có mặt thì mặc định của nhóm
 */
function placeChoice(
  spec: HeldItemSpec,
  place: "bottom" | "back",
  lead: V3,
  dims: HandDims,
): GraspChoice {
  const geom = itemGeom(spec);
  const d = (place === "bottom" ? geom.U : geom.F).map((v) => -v) as V3;
  const off = new Set(geom.parts.filter((p) => !p.grip).map((p) => p.name));
  const area = (f: FaceFeature) => f.half[0] * f.half[1];
  let best: FaceFeature | undefined;
  for (const x of geom.features) {
    if (x.kind !== "face" || !x.edges.length || off.has(x.part) || dot3(x.n, d) < 1 - 1e-6)
      continue;
    const k = best ? dot3(x.c, d) - dot3(best.c, d) : 1;
    if (k > 1e-6 || (k > -1e-6 && area(x) > area(best!) + 1e-6)) best = x;
  }
  if (!best) return {};
  const f = best;
  const flat = (v: V3) => sub3(v, f.n.map((q) => q * dot3(v, f.n)) as V3);
  const u = flat(geom.U);
  const g = Math.hypot(...u) > 0.5 ? u : flat(geom.F);
  const ed = f.edges.reduce((a, b) => (dot3(b.inward, g) > dot3(a.inward, g) ? b : a));
  let s = dot3(sub3(f.c, ed.at), ed.inward);
  if (Math.abs(dot3(sub3(lead, f.c), f.n)) <= dims.W)
    s = Math.max(s, dot3(sub3(lead, ed.at), ed.inward) + (dims.W + dims.P) / 2);
  return {
    part: f.part,
    feature: "face",
    featureIndex: geom.features.indexOf(f),
    edge: ed.name,
    psi: 0,
    inset: s,
    along: 0.5,
  };
}

/**
 * Tay phụ của `both` (v2): chỗ mặc định của nhóm (`support` của `GRIP_GROUPS`) — cùng nhóm thì giữ `keep` của tay dẫn
 * và cạnh theo `edge`, khác nhóm thì mặt theo `place` (`placeChoice`) — rồi object của cảnh đè từng phần. Nhóm chưa có chỗ
 * tiếp xúc, hay khác nhóm tay dẫn mà không có `place`, thì không có tay phụ
 */
function supportOf(
  spec: HeldItemSpec,
  g: HoldGrasp,
  lead: GraspFrame,
  side: number,
  dims: HandDims,
  k: number,
  long: number,
  s: number,
): HoldLinkHand["both"] {
  const sup = GRIP_GROUPS[g.hold.group].support;
  const o = g.hold.both === true ? {} : (g.hold.both ?? {});
  const group = o.group ?? sup?.group;
  if (!group || !CONTACTS[group]) return undefined;
  const same = group === g.hold.group;
  const place = !same && sup?.group === group ? sup.place : undefined;
  if (!same && !place) return undefined;
  const c: Record<string, unknown> = place
    ? { ...placeChoice(spec, place, lead.hand.at as V3, dims) }
    : {};
  // cảnh đổi phần hay cạnh: cạnh, thụt, chỗ dọc cạnh và hướng ngón lại theo mặc định của nhóm
  if (place && o.part !== undefined && o.part !== c.part) delete c.edge;
  if (place && (o.edge !== undefined || c.edge === undefined))
    for (const key of ["psi", "inset", "along"]) delete c[key];
  if (same) {
    const lc = lead.choice as Record<string, unknown>;
    Object.assign(c, { part: lc.part, feature: lc.feature, featureIndex: lc.featureIndex });
    for (const key of sup?.group === group ? (sup.keep ?? []) : [])
      if (lc[key] !== undefined) c[key] = lc[key];
    if (sup?.edge === "opposite") c.edge = oppositeEdge(lead);
    else if (sup?.edge === "same") c.edge = lead.choice.edge;
  }
  for (const key of FIELDS) {
    const v = (o as Record<string, unknown>)[key];
    if (v !== undefined) c[key] = v;
  }
  if (o.part !== undefined && o.part !== c.part) delete c.featureIndex;
  const fr = frameOf(
    spec,
    fillChoice(spec, group, c as GraspChoice, -side, dims),
    -side,
    dims,
    k,
    long,
    s,
  );
  return { lead: side, other: fr.hand, pose: fr.pose, roles: fr.roles, ...curlOf(group, fr) };
}

/** Bàn tay v2 và khung của nó */
function groupHand(
  h: ReachHold,
  side: number,
  dims: HandDims,
  k: number,
  long: number,
  s: number,
): HoldLinkHand | undefined {
  const g = h.grasp;
  if (!g || g.hold.group === "carry") return undefined;
  const fr =
    g.frame ??
    frameOf(h.spec, fillChoice(h.spec, g.hold.group, g.choice, side, dims), side, dims, k, long, s);
  const both = g.hold.both ? supportOf(h.spec, g, fr, side, dims, k, long, s) : undefined;
  return {
    hand: fr.hand,
    pose: fr.pose,
    roles: fr.roles,
    ...curlOf(g.hold.group, fr),
    frame: fr,
    ...(both && { both }),
  };
}

/**
 * Bàn tay của lần cầm `h` cho tay bên `side` (`-1` phải), cỡ tay `dims` (đơn vị món): v1 `gripHand` của kiểu cầm, v2 khung
 * cầm `graspFrame` trên lựa chọn của cảnh cộng mặc định của nhóm, món đặt trước khung đã giải (`grasp.frame`). `undefined`
 * khi lần cầm không chiếm bàn tay (kiểu treo, kiểu cầm không có)
 */
export function holdHand(
  h: ReachHold,
  side: number,
  dims: HandDims = handDims(1),
): HoldLinkHand | undefined {
  if (isGroupHold(h)) return groupHand(h, side, dims, 1, 1, 1);
  const g = gripOf(h.spec, h.grip);
  if (!g) return undefined;
  const hand = gripHand(g, side);
  return {
    hand,
    pose: namedPose(hand),
    ...(g.both && {
      both: { lead: leadSide(g.both.lead), other: g.both.other, pose: namedPose(g.both.other) },
    }),
  };
}

/**
 * Liên kết cứng của tay mang món (`GripFrame`) và tâm nắm của dáng, khung bàn tay bên `side` cỡ `k`, cỡ dọc `long`, cỡ
 * người `s` (như `gripFrame`): v1 từ `hand` (bỏ trống là `gripHand` của kiểu cầm), v2 từ `graspFrame` (bỏ qua `hand`)
 */
export function holdLinkFrame(
  h: ReachHold,
  side: number,
  k = 1,
  long = k,
  s = 1,
  hand?: GraspHand,
): { G: GripFrame; center: V3 } {
  if (isGroupHold(h)) {
    const x = groupHand(h, side, handDims(k / s, long / s), k, long, s);
    if (!x?.frame) throw new Error(`\`${h.item}\`: lần cầm \`${h.grip}\` không cầm bằng bàn tay`);
    return { G: x.frame.G, center: gripCenter(x.frame.hand.pose, side, k, long) };
  }
  const hh = hand ?? gripHand(gripSpec(h.spec, h.grip, h.item), side);
  return {
    G: gripFrame(h.spec, hh, side, k, long, s),
    center: gripCenter(hh.pose, side, k, long),
  };
}

/** Lần cầm trước của cùng món (`h.from`) còn đang hoà, dạng `ReachHold`; kiểu cũ không chiếm bàn tay thì không có */
export function holdFrom(h: ReachHold): ReachHold | undefined {
  const f = h.from;
  if (!f || f.k <= 0) return undefined;
  const p: ReachHold = { ...h, grip: f.grip, from: undefined, grasp: f.grasp };
  if (isGroupHold(p)) return f.grasp && f.grasp.hold.group !== "carry" ? p : undefined;
  return gripOf(h.spec, f.grip) ? p : undefined;
}
