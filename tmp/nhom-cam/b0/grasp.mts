// Bước 0 (job B0a) — bàn tay từ món + khuỷu tự nhiên, trên rig hiện có, không đổi schema. docs/11-nhom-cam.md mục 3–5, 9.
// Chạy: node tmp/nhom-cam/b0/run.mjs tmp/nhom-cam/b0/grasp.mts [--w-down 0.3] [--w-body 10] [--w-cont 0.2]
//        [--t 1.0] [--c <d/W>] [--slant 0] [--out tmp/nhom-cam/b0/ca.json]
// Ra: ca.json (năm ca × tay × mẫu), in bảng số và kiểm fixture.
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import {
  trunk3,
  markShape,
  markAt,
  twoBone3,
  armFrame,
  AIM_BEND,
  AIM_DEV,
  BONES3,
  aimWrist,
} from "../../../packages/rig/src/core/act3";
import { REACH_ELBOW } from "../../../packages/rig/src/core/ik";
import { HAND_BONES, HAND_GRIPS, handFrames, handPoint, handVec, wristTurn, type HandPose } from "../../../packages/rig/src/core/hand";
import {
  gripFrame,
  parseHeldItem,
  HOLD_SLEW_STEP,
  type GripFrame,
  type GripHand,
  type HeldItemSpec,
} from "../../../packages/rig/src/core/heldItem";
import { AIM_GAP } from "../../../packages/rig/src/core/palm";
import { PALM_DIRS } from "../../../packages/rig/src/core/bodyMark";
import { SKULL3 } from "../../../packages/rig/src/core/humanHead";
import { RIG } from "../../../packages/rig/src/core/constants";
import { fromColumns, matMul as mm, matVec as mv, rotX as rx, rotZ as rz, type M3, type V3 } from "../../../packages/rig/src/core/lens";
import { parseScene, resolveScene, sceneAt } from "../../../packages/rig/src/core/scene";
import { parseCharacter } from "../../../packages/rig/src/core/schema";
import { parseAction } from "../../../packages/rig/src/core/action";
import { body3 } from "../../../packages/rig/src/core/figure3d";

// ───────────────────────────── tham số
const argv = process.argv.slice(2);
const arg = (k: string, d: number) => {
  const i = argv.indexOf(k);
  return i >= 0 ? Number(argv[i + 1]) : d;
};
const argS = (k: string, d: string) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : d;
};
const W_DOWN = arg("--w-down", 0.3);
const W_BODY = arg("--w-body", 10);
let W_CONT = arg("--w-cont", 2);
const T_POSE = arg("--t", 1.0);
const SLANT = arg("--slant", 0);
const OUT = argS("--out", new URL("./ca.json", import.meta.url).pathname);
/** Giới hạn xoay cẳng tay: `clampT` của `aimWrist` (act3.ts) giữ −90..90, không có hằng số xuất */
const TURN_MAX = 90;

const VIDEO = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam";
const STUDIO = new URL("../../../", import.meta.url).pathname;
const SCENE = "t02-s023-bang-gia";
const HOLDER = "takumi";

// ───────────────────────────── véc tơ
const D2R = Math.PI / 180;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: readonly number[], s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const perp = (v: V3, n: V3): V3 => sub(v, mul(n, dot(v, n)));
const angDeg = (a: V3, b: V3) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / D2R;
const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const r = (x: number, n = 2) => +x.toFixed(n);
const rv = (v: readonly number[], n = 3) => v.map((x) => r(x, n));
/** three → thế giới rig: điểm ×100, đảo y, z; hướng chỉ đảo */
const rigP = (p: V3): V3 => [p[0] * 100, -p[1] * 100, -p[2] * 100];
const rigD = (d: V3): V3 => [d[0], -d[1], -d[2]];
/** Góc quay giữa hai ma trận quay, độ */
const spin = (v: V3, u: V3, a: number): V3 => {
  const c = Math.cos(a), sn = Math.sin(a);
  return add(add(mul(v, c), mul(cross(u, v), sn)), mul(u, dot(u, v) * (1 - c)));
};
const rotDiff = (A: M3, B: M3) => {
  const D = mm(tr(A), B);
  return Math.acos(Math.max(-1, Math.min(1, (D[0] + D[4] + D[8] - 1) / 2))) / D2R;
};

// ───────────────────────────── nạp cảnh, người
const readJ = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const listJ = (d: string) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".json")) : []);
const actions: Record<string, any> = {};
for (const dir of [`${STUDIO}apps/studio/public/actions`, `${VIDEO}/actions`])
  for (const f of listJ(dir)) {
    const p = parseAction(readJ(`${dir}/${f}`));
    if (p.success) actions[f.replace(/\.json$/, "")] = p.data;
  }
const sceneRaw = parseScene(readJ(`${VIDEO}/scenes/${SCENE}.json`));
if (!sceneRaw.success) throw new Error("scene");
const chars: Record<string, any> = {};
for (const m of sceneRaw.data.cast as any[]) {
  const f = m.character as string;
  const p = parseCharacter(readJ(`${VIDEO}/characters/${f}`));
  if (!p.success) throw new Error(f);
  chars[m.id] = p.data;
}
const heldAll: Record<string, HeldItemSpec> = {};
for (const f of listJ(`${VIDEO}/held`)) {
  const p = parseHeldItem(readJ(`${VIDEO}/held/${f}`));
  if (p.success) heldAll[f.replace(/\.json$/, "")] = p.data;
}
const ids = Object.keys(chars);
const rt = resolveScene(
  sceneRaw.data,
  actions,
  {},
  {},
  Object.fromEntries(ids.map((i) => [i, chars[i].rig.height])),
  Object.fromEntries(ids.map((i) => [i, body3(chars[i])])),
  heldAll,
);
const CH = chars[HOLDER];
const poseAt = (t: number) => sceneAt(rt, HOLDER, t, CH.rig.height, body3(CH)) as any;
const SP = poseAt(T_POSE);
// tư thế thân có đứng yên quanh T_POSE không
const still = [0, 0.5, 1, 2, 4, 8].map((t) => {
  const p = poseAt(t);
  return { t, torso: r(p.pose.torso ?? 0), lean: r(p.pose.lean ?? 0), head: rv(p.pose.head, 2), hip: rv(p.world.hip, 1) };
});
const T: any = trunk3(CH, SP);
const S: any = markShape(T);
const s = T.s as number;
const kH = T.hand.k as number;
const longH = T.hand.long as number;
/** Cỡ tay (mục 3): bề ngang lòng bàn tay, đơn vị rig của món */
const W_HAND = 2 * HAND_BONES.palm.half[1] * 100 * kH;

// ───────────────────────────── món
const BANG: HeldItemSpec = heldAll["bang-gia"];
/** Cán tạm (`rod` dài 120, r 2,5): along 0 ở `luoi` (đầu trên của nhóm trụ), along 1 ở `duoi` */
const ROD_JSON = {
  schemaVersion: 1,
  size: [5, 120, 5],
  anchors: {
    luoi: { at: [0, 120, 0], dir: [0, 1, 0] },
    duoi: { at: [0, 0, 0], dir: [0, -1, 0] },
    center: { at: [0, 60, 0] },
  },
  grips: { tam: { pose: "fist", at: "center", palm: [0, 0, 1], fingers: [1, 0, 0] } },
  shape: [{ cyl: 2.5, from: [0, 0, 0], to: [0, 120, 0] }],
};
const ROD_P = parseHeldItem(ROD_JSON);
if (!ROD_P.success) throw new Error("rod");
const ROD = ROD_P.data;

// ───────────────────────────── sheet `pinch` (frame nf)
/** Hệ số lòng tay `sheet pinch` đo trên bàn tay mới (tmp/buoc0/do-a.json `palmCoef`) */
const DOA = readJ(`${STUDIO}tmp/buoc0/do-a.json`);
const PC = { a: DOA.palmCoef.right.a as number, b: DOA.palmCoef.right.b as number };

type Slab = { c: V3; half: V3; thick: number };
const slabOf = (it: HeldItemSpec): Slab => {
  const b = (it.shape ?? []).find((x: any) => "box" in x) as any;
  const half = mul(b.box, 0.5);
  const thick = half.indexOf(Math.min(...half));
  return { c: (b.at ?? [0, 0, 0]) as V3, half, thick };
};
const EDGE_ANCHOR: Record<string, string> = { right: "edgeR", left: "edgeL", top: "top", bottom: "bottom" };
const THUMB_ANCHOR: Record<string, string> = { front: "front", back: "back" };

type SheetVariant = "pinch" | "flat" | "rim";
interface SheetHold {
  edge: "right" | "left" | "top" | "bottom";
  along: number;
  thumb: "front" | "back";
  slant: number;
  d: number;
  variant: SheetVariant;
}
/** Dáng của từng biến thể (spec mục 3 nhóm 1: `pinch` dáng `sheet`, `flat` và `rim` dáng `edge`) */
const SHEET_POSE: Record<SheetVariant, HandPose> = { pinch: "sheet", flat: "edge", rim: "edge" };
/** Khung một biến thể trong khung cạnh (`m`, `e`, `F`), hướng khung món: lòng tay `n`, ngón `f` */
function sheetAxes(v: SheetVariant, m: V3, e: V3, F: V3, slant: number, side: number) {
  const sl = slant * D2R;
  if (v === "rim") {
    // frame nt: n = −m, t = F, f₀ = side·(t × n); ngón chúc `slant` quanh m về phía −F
    const n = mul(m, -1);
    const f0 = unit(mul(cross(F, n), side));
    return { n, f: unit(add(mul(f0, Math.cos(sl)), mul(F, -Math.sin(sl)))) };
  }
  const f = unit(add(mul(m, -Math.cos(sl)), mul(e, Math.sin(sl))));
  if (v === "flat") return { n: F, f };
  return { n: unit(add(mul(F, PC.a), mul(f, PC.b))), f };
}
/**
 * `graspFrame` sheet trong khung món: cạnh (`m` pháp tuyến ngoài của cạnh trong mặt tấm, `e` dọc cạnh về đầu cao), `F` mặt
 * có ngón cái; hướng theo `sheetAxes`; tâm nắm ở `along` từ đầu thấp, thụt `d` vào trong, giữa bề dày. `eHigh` là hướng đầu
 * cao trong khung món (suy theo tư thế món, `edgeHigh`)
 */
function sheetContact(it: HeldItemSpec, h: SheetHold, eHigh: V3, side: number) {
  const L = slabOf(it);
  const m = unit(it.anchors[EDGE_ANCHOR[h.edge]].dir as V3);
  const F = unit(it.anchors[THUMB_ANCHOR[h.thumb]].dir as V3);
  const e = unit(perp(perp(eHigh, m), F));
  // nửa dài cạnh: theo trục của e
  const ax = e.map(Math.abs).indexOf(Math.max(...e.map(Math.abs)));
  const halfLen = L.half[ax];
  const mAx = m.map(Math.abs).indexOf(Math.max(...m.map(Math.abs)));
  const edgeMid = add(L.c, mul(m, L.half[mAx]));
  const at = add(add(edgeMid, mul(e, (h.along - 0.5) * 2 * halfLen)), mul(m, -h.d));
  const { n, f } = sheetAxes(h.variant, m, e, F, h.slant, side);
  return { at, n, f, m, e, F, pose: SHEET_POSE[h.variant] };
}

// ───────────────────────────── cylinder `wrap` (frame nt)
/** δ lồi da lòng tay ở dáng `grip`, ÷ k (tmp/buoc0/do-a.json `bulge`, cỡ `1`) */
const PALM_BULGE = DOA.bulge["1"].palm.byPose.grip as number;
interface CylHold {
  along: number;
  around: number;
  thumb: "up" | "down";
}
/** Trụ của món: trục từ `top` (along 0) tới `bot` (along 1), bán kính, hướng gốc của `around` */
const rodAxis = (it: HeldItemSpec) => {
  const top = it.anchors.luoi.at as V3;
  const bot = it.anchors.duoi.at as V3;
  const c = (it.shape ?? []).find((x: any) => "cyl" in x) as any;
  return { top, bot, a: unit(sub(top, bot)), r: c.cyl as number, rho0: [0, 0, 1] as V3 };
};
/**
 * `graspFrame` tạm cho cylinder `wrap`: điểm trên trục ở `along`, `ρ(θ)` quay quanh trục từ `rho0`; lòng tay `n = −ρ`, ngón
 * cái `t = ±a` (`up` về đầu trên), `f = side·(t × n)`; tâm nắm dời ra theo `ρ` cho da lòng tay vừa chạm mặt trụ:
 * khoảng trục → tâm nắm `= r + (half[0] + δ)·k − cx(dáng)·k`
 */
function cylContact(it: HeldItemSpec, h: CylHold, side: number) {
  const R = rodAxis(it);
  const W = W_HAND;
  const pose: HandPose = R.r > 0.5 * W ? "grip" : "fist";
  const th = h.around * D2R;
  const b0 = unit(perp(R.rho0, R.a));
  const rho = unit(add(mul(b0, Math.cos(th)), mul(cross(R.a, b0), Math.sin(th))));
  const n = mul(rho, -1);
  const t = h.thumb === "up" ? R.a : mul(R.a, -1);
  const f = unit(mul(cross(t, n), side));
  const skin = (HAND_BONES.palm.half[0] * 100 + PALM_BULGE) * kH;
  const cx = HAND_GRIPS[pose][0] * 100 * kH;
  const axisPt = add(R.top, mul(sub(R.bot, R.top), h.along));
  const at = add(axisPt, mul(rho, R.r + skin - cx));
  return { at, n, f, t, rho, pose, axisPt, D: R.r + skin - cx };
}

/** GripHand (kiểu cầm cũ) từ chỗ tiếp xúc: `at` theo mốc `center` của món */
const gripHandOf = (it: HeldItemSpec, c: { at: V3; n: V3; f: V3; pose: HandPose }): GripHand => ({
  pose: c.pose,
  at: { anchor: "center", offset: rv(sub(c.at, it.anchors.center.at as V3), 4) as V3 },
  palm: rv(c.n, 5) as V3,
  fingers: rv(c.f, 5) as V3,
  wrap: ["thumb", "index", "middle", "ring", "pinky"],
});

// ───────────────────────────── món trong thế giới (mục 4)
type Toward = string | readonly number[];
interface ItemMark {
  to: "chest" | "eye" | "shoulder" | "belly" | "hip";
  offset: V3;
  point?: string;
  face?: { axis: string | V3; toward: Toward; tilt?: number };
  up?: string;
  roll?: { axis: string | V3; toward: Toward };
}
const RIGHT = -1;
const LEFT = 1;
/** Hướng hệ thân `[tiến, y, ngang]` (ngang dương về phía tay phải người cầm) ra three, như `bodyDir` của act3 */
const bodyDirR = (v: readonly number[]): V3 => unit(mv(T.Rr, [RIGHT * v[2], -v[1], v[0]]));
const eyeMid = (): V3 => mul(add(markAt(T, { to: "eye" }, RIGHT, undefined), markAt(T, { to: "eye" }, LEFT, undefined)), 0.5);
/** Chỗ mốc thân cộng `offset` [tiến, y, ngang phải]; `eye` là giữa hai mắt */
function markPoint(to: ItemMark["to"], offset: V3): V3 {
  const base = to === "eye" ? eyeMid() : markAt(T, { to }, RIGHT, undefined);
  const ref = markAt(T, { to }, RIGHT, undefined);
  const withOff = markAt(T, { to, offset }, RIGHT, undefined);
  return add(base, sub(withOff, ref));
}
const itemAxis = (it: HeldItemSpec, a: string | V3): V3 =>
  typeof a === "string" ? unit(it.anchors[a].dir as V3) : unit(a);
/** Món trong thế giới three: `Ri` (khung món → thế giới), gốc `Pi`; `u` three của một đơn vị rig */
function itemPose(it: HeldItemSpec, mk: ItemMark) {
  const u = 0.01 * s;
  const ptItem: V3 = mk.point ? (it.anchors[mk.point].at as V3) : (it.anchors.center.at as V3);
  const target = markPoint(mk.to, mk.offset);
  const dirTo = (tw: Toward): V3 => {
    if (tw === "holderFace") return unit(sub(eyeMid(), target));
    if (typeof tw === "string") return bodyDirR((PALM_DIRS as any)[tw]);
    return bodyDirR(tw);
  };
  const face = mk.face ?? (mk.up ? { axis: mk.up, toward: "up" } : undefined);
  if (!face || !mk.roll) throw new Error("mốc món cần đủ trục chính và trục phụ");
  const aH = itemAxis(it, face.axis);
  let dM = dirTo(face.toward);
  // `tilt` như `holdSolve` của act3: quay đích quanh `d × up`, dương là ngẩng lên
  const tu = cross(dM, [0, 1, 0]);
  const tilt = (face as { tilt?: number }).tilt;
  if (tilt && len(tu) > 1e-6) dM = spin(dM, unit(tu), tilt * D2R);
  if (Math.abs(dot(dirTo(mk.roll.toward), dM)) > 0.95) throw new Error("trục phụ gần trùng trục chính: hướng món suy biến");
  const ru = unit(perp(itemAxis(it, mk.roll.axis), aH));
  const du = unit(perp(dirTo(mk.roll.toward), dM));
  const Ri = mm(fromColumns(dM, du, cross(dM, du)), tr(fromColumns(aH, ru, cross(aH, ru))));
  const Pi = sub(target, mul(mv(Ri, ptItem), u));
  return { Ri, Pi, u, target };
}
/** Đầu cao của một cạnh (khung món): cạnh dốc ≥ 30° thì đầu cao là đầu trên; cạnh gần ngang thì đầu thấp là phía của tay ấy */
function edgeHigh(it: HeldItemSpec, Ri: M3, edge: string, thumb: string, side: number): V3 {
  const m = unit(it.anchors[EDGE_ANCHOR[edge]].dir as V3);
  const F = unit(it.anchors[THUMB_ANCHOR[thumb]].dir as V3);
  const e0 = unit(cross(m, F));
  const w = mv(Ri, e0);
  if (Math.abs(w[1]) >= 0.5) return w[1] > 0 ? e0 : mul(e0, -1);
  const out = mv(T.Rr, [side, 0, 0]);
  return dot(w, out) < 0 ? e0 : mul(e0, -1);
}

// ───────────────────────────── tay (mục 5)
const D_ = (side: number) => (side === T.near ? { l: 2, f: 3 } : { l: 0, f: 1 });
function shoulderOf(side: number): { S: V3; l1: number; l2: number } {
  const st = T.P.stretch;
  const ix = D_(side);
  const S: V3 = T.at(T.hips, T.Rs, [side * T.roots.shoulder[0], T.roots.shoulder[1], 0]);
  return { S, l1: T.B.upperArm * (st[ix.l] ?? 1) * s, l2: T.B.foreArm * (st[ix.f] ?? 1) * s };
}
/** Bàn tay = món · GripFrame⁻¹: cổ tay `Wp`, khung bàn tay `Rw` (three) */
function handFromItem(Ri: M3, Pi: V3, G: GripFrame): { Wp: V3; Rw: M3 } {
  const Rw = mm(Ri, tr(G.R));
  return { Rw, Wp: sub(Pi, mv(Rw, G.p)) };
}
/** Tách `wristTurn` (Euler YZX: Ry(−side·turn)·Rz(−side·bend)·Rx(−dev)) ra xoay, gập, lệch, độ */
function wristAngles(M: M3, side: number) {
  const beta = Math.asin(Math.max(-1, Math.min(1, M[3])));
  const gamma = Math.atan2(-M[5], M[4]);
  const alpha = Math.atan2(-M[6], M[0]);
  return { turn: (-side * alpha) / D2R, bend: (-side * beta) / D2R, dev: -gamma / D2R };
}
/** Bán kính tay ở phần `t` dọc chi (0 vai, 1 khuỷu, 2 cổ tay), px */
const armR = (t: number) => {
  const room = T.roots.room;
  if (!room) return BONES3.limb * 10 * T.w.sleeve;
  const [a, b, c] = room.r;
  return t <= 1 ? a + (b - a) * t : b + (c - b) * (t - 1);
};
const SKIP_ROOT = () => (T.roots.room ? T.roots.room.cap : armR(0)) * 1.5;
const torsoLen = RIG.torso * CH.rig.height;
/** Mẫu dọc tay: điểm three, bán kính px, nhãn đoạn */
function armSamples(S0: V3, E: V3, Wr: V3) {
  const out: { p: V3; r: number; seg: "upper" | "fore"; t: number }[] = [];
  const N = 12;
  const l1px = (len(sub(E, S0)) * 100) / s;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    if (t * l1px < SKIP_ROOT()) continue;
    out.push({ p: add(S0, mul(sub(E, S0), t)), r: armR(t), seg: "upper", t });
  }
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    out.push({ p: add(E, mul(sub(Wr, E), t)), r: armR(1 + t), seg: "fore", t });
  }
  return out;
}
/** Khoảng điểm–đoạn */
const segDist = (p: V3, a: V3, b: V3) => {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return { d: len(sub(p, add(a, mul(ab, t)))), t };
};
type ArmSeg = { S: V3; E: V3; W: V3 };
/**
 * Bắp tay buông của chính rig đã lấn sườn áo (sườn áo chỉ lùi theo mép trong khuỷu, `armSide`): lấn của bắp tay vào thân
 * trừ đi mức của tay buông ở cùng phần dọc bắp tay (đo một lần, `restCheck`)
 */
let REST_ALLOW: Map<number, number> | undefined;
const REST_PROBE = new Map<number, number>();
/** Lấn của tay vào thân (`across`/`front` của `markShape`), đầu, tay kia: max mỗi cặp đoạn × vật, px; và Σ (lấn/r)² */
function intrusion(S0: V3, E: V3, Wr: V3, other?: ArmSeg) {
  const RsT = tr(T.Rs);
  const head = T.out.head as V3;
  const rH: V3 = mul(SKULL3, T.B.head * s);
  const RnT = tr(T.Rn);
  const best: Record<string, { d: number; q: number }> = {};
  const put = (k: string, d: number, rr: number) => {
    if (d <= 0) return;
    const q = d / rr;
    if (!best[k] || q > best[k].q) best[k] = { d, q };
  };
  for (const x of armSamples(S0, E, Wr)) {
    const l = mul(mv(RsT, sub(x.p, T.hips)), 100 / s);
    const y = -l[1];
    if (y <= 0 && y >= -torsoLen) {
      const [hw, hd] = S.across(y);
      const hz = l[2] >= 0 ? S.front(y) : hd;
      const rho = Math.hypot(l[0] / hw, l[2] / hz);
      const rad = Math.hypot(l[0], l[2]);
      const dist = rho > 1e-6 ? ((rho - 1) * rad) / rho : -Math.min(hw, hz);
      const allow = x.seg === "upper" && REST_ALLOW ? (REST_ALLOW.get(r(x.t, 3)) ?? 0) : 0;
      if (REST_ALLOW === undefined && x.seg === "upper") REST_PROBE.set(r(x.t, 3), Math.max(REST_PROBE.get(r(x.t, 3)) ?? 0, x.r - dist));
      put(`${x.seg}.torso`, x.r - dist - allow, x.r);
    }
    const lh = mv(RnT, sub(x.p, head));
    const q: V3 = [lh[0] / rH[0], lh[1] / rH[1], lh[2] / rH[2]];
    const rq = len(q);
    const distH = rq > 1e-6 ? (((rq - 1) * len(lh)) / rq) * (100 / s) : -T.B.head * 100;
    put(`${x.seg}.head`, x.r - distH, x.r);
    if (other)
      for (const [a, b, r0, r1] of [
        [other.S, other.E, armR(0), armR(1)],
        [other.E, other.W, armR(1), armR(2)],
      ] as [V3, V3, number, number][]) {
        const sd = segDist(x.p, a, b);
        put(`${x.seg}.otherArm`, x.r + r0 + (r1 - r0) * sd.t - (sd.d * 100) / s, x.r);
      }
  }
  let sum = 0;
  for (const v of Object.values(best)) sum += v.q * v.q;
  const max = Object.entries(best).reduce((m, [k, v]) => (v.d > m.d ? { k, d: v.d } : m), { k: "-", d: 0 });
  return { sum, max, parts: Object.fromEntries(Object.entries(best).map(([k, v]) => [k, r(v.d)])) };
}

interface ArmSol {
  phi: number;
  phi0: number;
  E: number;
  terms: { wrist: number; over: number; down: number; body: number; cont: number };
  turn: number;
  bend: number;
  dev: number;
  over: string[];
  body: ReturnType<typeof intrusion>;
  gap: number;
  S: V3;
  El: V3;
  Wr: V3;
  pole: V3;
  evals: number;
}
/** Khung quanh trục vai → cổ tay: `d0` hướng thõng, `o0` ra ngoài phía tay ấy; φ dương là khuỷu ra ngoài */
function phiBasis(S0: V3, Wp: V3, side: number) {
  const nAx = unit(sub(Wp, S0));
  let d0 = perp([0, -1, 0], nAx);
  if (len(d0) < 1e-6) d0 = perp(mv(T.Rr, [0, 0, -1]), nAx);
  d0 = unit(d0);
  const o0 = unit(mul(cross(nAx, d0), side));
  return { nAx, d0, o0 };
}
/** E(φ) đúng như mục 5; một lần thử chỉ dựng hai đoạn tay và đọc góc cổ tay */
function evalPhi(side: number, Wp: V3, Rw: M3, phi: number, phiPrev: number | undefined, other?: ArmSeg) {
  const { S: S0, l1, l2 } = shoulderOf(side);
  const B = phiBasis(S0, Wp, side);
  const pole = add(mul(B.d0, Math.cos(phi * D2R)), mul(B.o0, Math.sin(phi * D2R)));
  const [El, Wr, hinge] = twoBone3(S0, Wp, l1, l2, pole);
  const f = armFrame(S0, El, Wr, hinge);
  const Re = mm(f.R, rx(-f.b));
  const a = wristAngles(mm(tr(Re), Rw), side);
  const lim: [string, number, number][] = [
    ["turn", a.turn, TURN_MAX],
    ["bend", a.bend, AIM_BEND],
    ["dev", a.dev, AIM_DEV],
  ];
  const wristE = 0.5 * (a.turn / 90) ** 2 + (a.bend / AIM_BEND) ** 2 + 0.5 * (a.dev / AIM_DEV) ** 2;
  let overE = 0;
  const over: string[] = [];
  for (const [k, v, L] of lim) {
    const x = Math.max(0, Math.abs(v) - L);
    if (x > 0) over.push(k);
    overE += 10 * (x / L) ** 2;
  }
  const pole0 = mv(T.Rr, [side * REACH_ELBOW[2], -REACH_ELBOW[1], REACH_ELBOW[0]]);
  const phi0 = Math.atan2(dot(pole0, B.o0), dot(pole0, B.d0)) / D2R;
  const down = (W_DOWN * (1 - Math.cos((phi - phi0) * D2R))) / 2;
  const body = intrusion(S0, El, Wr, other);
  const bodyE = W_BODY * body.sum;
  const cont = phiPrev === undefined ? 0 : W_CONT * (wrap(phi - phiPrev) / 30) ** 2;
  const gap = Math.max(0, (len(sub(Wp, S0)) - (l1 + l2)) * 100);
  return {
    phi: wrap(phi),
    phi0,
    E: wristE + overE + down + bodyE + cont,
    terms: { wrist: wristE, over: overE, down, body: bodyE, cont },
    ...a,
    over,
    body,
    gap,
    S: S0,
    El,
    Wr,
    pole,
    evals: 0,
  };
}
/** Lưới 10° cả vòng, rồi chia đôi ±5°, ±2,5° */
function solvePhi(side: number, Wp: V3, Rw: M3, phiPrev?: number, other?: ArmSeg): ArmSol {
  let n = 0;
  const ev = (p: number) => (n++, evalPhi(side, Wp, Rw, p, phiPrev, other));
  let best = ev(-180);
  for (let p = -170; p < 180; p += 10) {
    const c = ev(p);
    if (c.E < best.E - 1e-12) best = c;
  }
  for (const step of [5, 2.5]) {
    const c0 = best.phi;
    for (const p of [c0 - step, c0 + step]) {
      const c = ev(p);
      if (c.E < best.E - 1e-12) best = c;
    }
  }
  return { ...best, evals: n };
}

// ───────────────────────────── một tay trên món
type Hold = { group: "sheet"; h: SheetHold } | { group: "cylinder"; h: CylHold };
function graspFrame(it: HeldItemSpec, Ri: M3, hold: Hold, side: number) {
  if (hold.group === "sheet") {
    const eH = edgeHigh(it, Ri, hold.h.edge, hold.h.thumb, side);
    const c = sheetContact(it, hold.h, eH, side);
    const gh = gripHandOf(it, c);
    return { gh, contact: c, G: gripFrame(it, gh, side, kH * s, longH * s, s) };
  }
  const c = cylContact(it, hold.h, side);
  const gh = gripHandOf(it, c);
  return { gh, contact: c, G: gripFrame(it, gh, side, kH * s, longH * s, s) };
}
function solveHand(it: HeldItemSpec, ip: ReturnType<typeof itemPose>, hold: Hold, side: number, phiPrev?: number, other?: ArmSeg) {
  const g = graspFrame(it, ip.Ri, hold, side);
  const { Wp, Rw } = handFromItem(ip.Ri, ip.Pi, g.G);
  const sol = solvePhi(side, Wp, Rw, phiPrev, other);
  return { ...g, Wp, Rw, sol };
}
type HandOut = ReturnType<typeof solveHand>;
const segOf = (h: HandOut): ArmSeg => ({ S: h.sol.S, E: h.sol.El, W: h.sol.Wr });

/** Bản ghi một tay cho ca.json */
function record(it: HeldItemSpec, ip: ReturnType<typeof itemPose>, hand: HandOut, side: number, hold: Hold, name: string) {
  const x = hand.sol;
  const Rw = hand.Rw;
  const nHand: V3 = [-side, 0, 0];
  return {
    hand: side < 0 ? "right" : "left",
    hold: { group: hold.group, ...hold.h },
    item: {
      origin: rv(rigP(ip.Pi), 2),
      axes: { x: rv(rigD(mv(ip.Ri, [1, 0, 0]))), y: rv(rigD(mv(ip.Ri, [0, 1, 0]))), z: rv(rigD(mv(ip.Ri, [0, 0, 1]))) },
      placed: rv(rigP(ip.target), 2),
    },
    wrist: rv(rigP(hand.Wp), 2),
    handAxes: {
      palm: rv(rigD(mv(Rw, nHand))),
      fingers: rv(rigD(mv(Rw, [0, -1, 0]))),
      thumbSide: rv(rigD(mv(Rw, [0, 0, 1]))),
    },
    gripCenter: rv(rigP(add(hand.Wp, mv(Rw, mul(HAND_GRIPS[hand.gh.pose as HandPose].map((v, i) => (i === 0 ? -side * v * kH : i === 1 ? v * longH : v * kH)), s)))), 2),
    contactItem: rv(hand.contact.at, 3),
    shoulder: rv(rigP(x.S), 2),
    elbowAt: rv(rigP(x.El), 2),
    wristReached: rv(rigP(x.Wr), 2),
    phi: r(x.phi, 1),
    phi0: r(x.phi0, 1),
    /** `elbow` của mốc tay `world.hands` (`at` thế giới, `point: "wrist"`): hướng thế giới rig, act3 `actReach` đọc `[x, −y, −z]` */
    elbow: rv(rigD(x.pole), 4),
    wristAngles: { turn: r(x.turn, 1), bend: r(x.bend, 1), dev: r(x.dev, 1), over: x.over },
    /** Xoay cẳng tay vượt ±90: rig hiện kẹp ở 90 (`aimWrist`) nên render lệch khuỷu/cổ tay so với bảng này */
    turnOver90: Math.abs(x.turn) > TURN_MAX,
    E: r(x.E, 3),
    terms: Object.fromEntries(Object.entries(x.terms).map(([k, v]) => [k, r(v, 3)])),
    body: { max: r(x.body.max.d), at: x.body.max.k, parts: x.body.parts },
    reachGap: r(x.gap, 2),
    reachGapOverAimGap: r(x.gap / (AIM_GAP * s), 2),
    gripFrame: { R: rv(hand.G.R, 6), p: rv(hand.G.p, 6), u: hand.G.u },
    gripSpec: { name, spec: { ...hand.gh, touch: ["self.hand"] } },
  };
}

// ───────────────────────────── kiểm fixture
const FIX = readJ(`${STUDIO}tmp/buoc0/fixtures.json`);
function fixtureCheck() {
  const out: any[] = [];
  const fx = FIX["bang-gia#doc"];
  const L = slabOf(BANG);
  // fixture: `at` = edgeR + [−2,5, 0, 12], tức along từ đáy (đầu thấp khi bảng đứng, top lên) = (29 − 12)/58
  const along = (L.half[2] - 12) / (2 * L.half[2]);
  const slant = Math.abs(DOA.palmCoef.right.slantDeg as number);
  const eHigh = unit(BANG.anchors.top.dir as V3);
  const cRef = 2.5 / W_HAND;
  for (const key of ["1", "1.61", "2.16", "t01-sakura", "kuroiwa"]) {
    const F = fx[key];
    const Wk = 2 * HAND_BONES.palm.half[1] * 100 * F.k;
    for (const [side, edge, tag] of [
      [-1, "right", "right"],
      [1, "left", "left"],
    ] as const) {
      const row: any = { size: key, hand: tag, W: r(Wk) };
      for (const [dk, d] of [
        ["d=2.5", 2.5],
        ["d=c·W", cRef * Wk],
      ] as const) {
        const c = sheetContact(BANG, { edge, along, thumb: "front", slant, d, variant: "pinch" }, eHigh, side);
        const G = gripFrame(BANG, gripHandOf(BANG, c), side, F.k, F.long, 1);
        const fG = F[tag];
        const dR = rotDiff(G.R, fG.R as M3);
        // lệch vị trí của món trong khung bàn tay, đơn vị rig: so điểm tâm món
        const q = BANG.anchors.center.at as V3;
        const pa = add(mv(G.R, mul(q, G.u)), G.p);
        const pb = add(mv(fG.R as M3, mul(q, fG.u)), fG.p as V3);
        row[dk] = { d: r(d), rotDeg: r(dR), posRig: r(len(sub(pa, pb)) / G.u, 2) };
      }
      out.push(row);
    }
  }
  // trụ: khung chuẩn rút từ chai-dia#co (cỡ 1, tay phải)
  const cy = FIX["chai-dia#co"]["1"].right;
  const a: V3 = [0, 1, 0];
  const centre = cy.centre.item as V3;
  const axisPt: V3 = [0, centre[1], 0];
  const rho = unit(sub(centre, axisPt));
  const t = unit(mul(cross(cy.palm as V3, cy.fingers as V3), -1));
  const chai = heldAll["chai-dia"];
  const rAt = (y: number) => {
    for (const c of chai.shape as any[]) if ("cyl" in c && y >= c.from[1] && y <= c.to[1]) return c.cyl + ((c.r2 ?? c.cyl) - c.cyl) * ((y - c.from[1]) / (c.to[1] - c.from[1]));
    return NaN;
  };
  const rS = rAt(centre[1]);
  const D1 = rS + (HAND_BONES.palm.half[0] * 100 + PALM_BULGE) * 1 - HAND_GRIPS.grip[0] * 100 * 1;
  const cyl = {
    fixture: "chai-dia#co",
    axis: a,
    rho: rv(rho),
    palmVsMinusRho: r(angDeg(cy.palm, mul(rho, -1)), 1),
    thumbVsAxis: r(angDeg(t, a), 1),
    fingersVsAxis: r(angDeg(cy.fingers, a), 1),
    centreToAxis: r(len(sub(centre, axisPt)), 2),
    rAtCentre: r(rS, 2),
    modelCentreToAxisK1: r(D1, 2),
    note: "khung chuẩn dùng: n = −ρ, t = +a (thumb up), f = side·(t×n); fixture nghiêng lòng tay xuống theo vai chai",
  };
  return { sheet: out, cRef: r(cRef, 4), slantFixture: r(slant, 2), alongFixture: r(along, 4), cylinder: cyl };
}

// tay buông của act (góc 0, choãi `roots.splay`): lấn trước và sau khi trừ mức cho phép của bắp tay
const restArms = () => {
  const o: any = {};
  for (const side of [RIGHT, LEFT]) {
    const { S: S0, l1, l2 } = shoulderOf(side);
    const Rsh = mm(T.Rs, rz(side * T.roots.splay));
    const E = add(S0, mul(mv(Rsh, [0, -1, 0]), l1));
    const W = add(E, mul(mv(Rsh, [0, -1, 0]), l2));
    const b = intrusion(S0, E, W);
    o[side < 0 ? "right" : "left"] = { max: r(b.max.d), at: b.max.k };
  }
  return o;
};
const restBefore = restArms();
REST_ALLOW = new Map([...REST_PROBE].map(([k, v]) => [k, Math.max(0, v)]));
const restCheck = { before: restBefore, after: restArms(), allowMax: r(Math.max(0, ...REST_ALLOW.values())) };


// ───────────────────────────── năm ca
const dDefault = arg("--c", NaN);
const C_D = Number.isFinite(dDefault) ? dDefault : 2.5 / W_HAND;
const D_SHEET = C_D * W_HAND;
/** Thụt của từng biến thể, đơn vị món: fixture cố định ở mọi cỡ (pinch `bang-gia#doc` 2,5; flat `phieu-lien#cam`/`thuc-don#khoe` 5; rim `tom-hum#nhac` 0,9, `bo-da#bung` 1) */
const D_VAR: Record<SheetVariant, number> = { pinch: D_SHEET, flat: 5, rim: 1 };
const sheet = (edge: SheetHold["edge"], along = 0.5, thumb: SheetHold["thumb"] = "front", slant = SLANT, variant: SheetVariant = "pinch"): Hold => ({
  group: "sheet",
  h: { edge, along, thumb, slant, d: D_VAR[variant], variant },
});
const UPROLL = { axis: "top", toward: "up" } as const;
/**
 * Ca 1: `holderFace` từ ngực+30 lên giữa hai mắt ngẩng ~84° và hơi ra trước (đầu chibi to, mặt nhô trước ngực), nên mặt
 * bảng gần ngửa hẳn, `roll` suy biến. Đề muốn mặt bảng về người đọc ~45°: khai thẳng hướng hệ thân `[−1, −1, 0]` (lùi, lên)
 */
const C1_TARGET = markPoint("chest", [30, 5, 0]);
const C1_HF = unit(sub(eyeMid(), C1_TARGET));
const C1_ELEV0 = Math.asin(C1_HF[1]) / D2R;
const C1_HF_FWD = dot(C1_HF, mv(T.Rr, [0, 0, 1]));
const C1_WHY = `holderFace từ ngực+30 ngẩng ${r(C1_ELEV0, 1)}° và hơi ra trước (thành phần tiến ${r(C1_HF_FWD, 3)}): mặt bảng gần ngửa, roll top→up suy biến; khai thẳng face toward [−1, −1, 0] hệ thân (lùi, lên 45°) theo đề "mặt về mặt người đọc ~45°"`;
/** Ca 1 (vòng 2): nâng bảng tới khi tâm bảng ngang giữa vai và rốn (`shoulder`, `belly`), giữ tiến 30, ngang 0 */
const C1_YMID = (markAt(T, { to: "shoulder" }, RIGHT, undefined)[1] + markAt(T, { to: "belly" }, RIGHT, undefined)[1]) / 2;
const C1_OFF: V3 = [30, 5, 0];
for (let i = 0; i < 8; i++) C1_OFF[1] += ((markPoint("chest", C1_OFF)[1] - C1_YMID) * 100) / s;
/** Khe nhỏ nhất từ bảng (lưới điểm hai mặt) tới da đầu (`onSkull` của `markShape`), rig */
function boardToSkin(mk: ItemMark) {
  const ip = itemPose(BANG, mk);
  const L = slabOf(BANG);
  const RnT = tr(T.Rn);
  let min = Infinity;
  for (let i = 0; i <= 10; i++)
    for (let j = 0; j <= 12; j++)
      for (const sy of [-1, 1]) {
        const q: V3 = [L.c[0] + L.half[0] * (i / 5 - 1), L.c[1] + sy * L.half[1], L.c[2] + L.half[2] * (j / 6 - 1)];
        const p = add(ip.Pi, mul(mv(ip.Ri, q), ip.u));
        const l = mul(mv(RnT, sub(p, T.out.head)), 1 / s);
        min = Math.min(min, (len(l) - len(S.onSkull(l))) * 100);
      }
  return min;
}
/** Ca 2 (vòng 2): đẩy bảng ra xa mặt tới khi khe bảng – da mặt ≥ 8 */
const C2_OFF: V3 = [32, 0, 0];
const c2mk = () => ({ to: "eye", offset: C2_OFF, face: { axis: "front", toward: "back" }, roll: UPROLL }) as ItemMark;
const C2_GAP0 = boardToSkin(c2mk());
while (boardToSkin(c2mk()) < 8) C2_OFF[0] += 1;
const C2_GAP = boardToSkin(c2mk());
const MARKS: Record<string, ItemMark> = {
  c1: { to: "chest", offset: [30, r(C1_OFF[1], 1), 0], face: { axis: "front", toward: [-1, -1, 0] }, roll: UPROLL },
  c2: c2mk(),
  c3: { to: "chest", offset: [35, 0, 0], face: { axis: "front", toward: "forward" }, roll: UPROLL },
  // cầm như chổi/cuốc trước người: đuôi trước hông phải, cán chéo lên, ra trước, về trái người cầm
  c5: { to: "hip", offset: [15, 0, 5], point: "duoi", face: { axis: "luoi", toward: [1, -1, -0.8] }, roll: { axis: [0, 0, 1], toward: "forward" } },
};
/** Ca 5: trục cán so với đầu (khe tới bán kính đầu + 10) và thân (`across`/`front` của `markShape`, trừ bán kính cán) */
const c5Clear = (() => {
  const ip = itemPose(ROD, MARKS.c5);
  const R = rodAxis(ROD);
  const headR = T.B.head * Math.max(...SKULL3) * 100 * s;
  const RsT = tr(T.Rs);
  let head = Infinity, torso = Infinity;
  for (let i = 0; i <= 40; i++) {
    const q = add(R.bot, mul(sub(R.top, R.bot), i / 40));
    const p = add(ip.Pi, mul(mv(ip.Ri, q), ip.u));
    head = Math.min(head, (len(sub(p, T.out.head)) * 100) / s - headR - 10);
    const l = mul(mv(RsT, sub(p, T.hips)), 100 / s);
    const y = -l[1];
    if (y <= 0 && y >= -torsoLen) {
      const [hw, hd] = S.across(y);
      const hz = l[2] >= 0 ? S.front(y) : hd;
      const rho = Math.hypot(l[0] / hw, l[2] / hz);
      torso = Math.min(torso, ((rho - 1) * Math.hypot(l[0], l[2])) / rho - R.r);
    }
  }
  const ends = { duoi: rv(rigP(add(ip.Pi, mul(mv(ip.Ri, R.bot), ip.u))), 1), luoi: rv(rigP(add(ip.Pi, mul(mv(ip.Ri, R.top), ip.u))), 1) };
  return { headMarginOverRplus10: r(head), headR: r(headR, 1), torsoGap: r(torso), ends };
})();

// ───────────────────────────── lựa chọn cảnh không khai (mục 5)
type SheetGiven = Partial<Pick<SheetHold, "edge" | "along" | "thumb" | "slant" | "variant">>;
/** Miền theo thứ tự khai (hoà thì lấy cái liệt kê trước); rời trước, liên tục sau, tăng dần */
const DOM = {
  edge: ["top", "bottom", "left", "right"],
  thumb: ["front", "back"],
  variant: ["pinch", "flat", "rim"],
  along: [0.25, 0.5, 0.75],
  slant: [-30, 0, 30],
} as const;
/** slant 3 điểm: nửa miền của từng biến thể (pinch [−60, 60], flat [−90, 90], rim [−45, 45]) */
const SLANTS: Record<SheetVariant, number[]> = { pinch: [-30, 0, 30], flat: [-45, 0, 45], rim: [-22.5, 0, 22.5] };
/** Mặc định nhóm `sheet` (in đậm ở mục 3); `edge` không có mặc định; slant `in` = 0 */
const DEF: Record<string, string | number> = { thumb: "front", variant: "pinch", along: 0.5, slant: 0 };
const DEV_MAX = 0.05;
function timeIt(fn: () => void, n: number) {
  for (let i = 0; i < 2; i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  return (performance.now() - t0) / n;
}
/** Tích ứng viên của các trường thiếu; giá = min_φ E + (khe/AIM_GAP)² + 0,05 · phần trường lệch mặc định */
function chooseSheet(ip: ReturnType<typeof itemPose>, side: number, given: SheetGiven, other?: ArmSeg) {
  const keys = (Object.keys(DOM) as (keyof typeof DOM)[]).filter((k) => given[k] === undefined);
  const withDef = keys.filter((k) => k in DEF);
  let combos: Record<string, any>[] = [{}];
  for (const k of keys)
    combos = combos.flatMap((c) =>
      (k === "slant" ? SLANTS[(c.variant ?? given.variant ?? "pinch") as SheetVariant] : (DOM[k] as readonly any[])).map((v) => ({ ...c, [k]: v })),
    );
  const cands: any[] = [];
  let best: any;
  for (const c of combos) {
    const ch = { ...given, ...c } as SheetHold;
    const hold = sheet(ch.edge, ch.along ?? 0.5, ch.thumb ?? "front", ch.slant ?? 0, ch.variant ?? "pinch");
    const h = solveHand(BANG, ip, hold, side, undefined, other);
    const dv = withDef.length ? (DEV_MAX * withDef.filter((k) => c[k] !== DEF[k]).length) / withDef.length : 0;
    const cost = h.sol.E + (h.sol.gap / (AIM_GAP * s)) ** 2 + dv;
    const x = { c, cost, h, hold };
    cands.push(x);
    if (!best || cost < best.cost - 1e-12) best = x;
  }
  const by: Record<string, string> = {};
  for (const k of Object.keys(DOM)) by[k] = given[k as keyof SheetGiven] !== undefined ? "scene" : "rig";
  const top = [...cands]
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 6)
    .map((x) => ({ ...x.c, cost: r(x.cost, 3), phi: r(x.h.sol.phi, 1), turn: r(x.h.sol.turn, 1), bend: r(x.h.sol.bend, 1), dev: r(x.h.sol.dev, 1), lan: r(x.h.sol.body.max.d), gap: r(x.h.sol.gap) }));
  return { best, by, n: combos.length, top, missing: keys };
}

// ───────────────────────────── bảng
const cases: any[] = [];
const table: any[] = [];
const choiceStr = (rec: any) =>
  Object.entries(rec.choice)
    .map(([k, v]) => `${k}=${v}${rec.by[k] === "rig" ? "*" : ""}`)
    .join(" ");
const row = (ca: string, rec: any, tt?: number) =>
  table.push({
    ca,
    tay: rec.hand === "right" ? "P" : "T",
    ...(tt !== undefined && { t: tt }),
    var: rec.choice.variant,
    choice: choiceStr(rec),
    t90: rec.turnOver90 ? "!" : "",
    phi: rec.phi,
    phi0: rec.phi0,
    turn: rec.wristAngles.turn,
    bend: rec.wristAngles.bend,
    dev: rec.wristAngles.dev,
    over: rec.wristAngles.over.join(",") || "-",
    lan: rec.body.max,
    lanAt: rec.body.at,
    khe: rec.reachGap,
    E: rec.E,
  });

function staticCase(id: string, label: string, mk: ItemMark, holds: { side: number; given: SheetGiven }[], why?: string) {
  const ip = itemPose(BANG, mk);
  const hands: any[] = [];
  let right: HandOut | undefined;
  for (const { side, given } of holds) {
    const other = side > 0 && right ? segOf(right) : undefined;
    const ch = chooseSheet(ip, side, given, other);
    const ms = timeIt(() => chooseSheet(ip, side, given, other), 3);
    const h: HandOut = ch.best.h;
    if (side < 0) right = h;
    const hold = ch.best.hold as Hold & { group: "sheet" };
    const rec: any = record(BANG, ip, h, side, hold, `_b0-${id}-${side < 0 ? "P" : "T"}`);
    rec.choice = { variant: hold.h.variant, edge: hold.h.edge, thumb: hold.h.thumb, along: hold.h.along, slant: hold.h.slant };
    rec.by = ch.by;
    rec.choiceSolve = { candidates: ch.n, ms: r(ms, 2), missing: ch.missing, top: ch.top };
    hands.push(rec);
    row(id, rec);
  }
  const front = rigD(mv(ip.Ri, itemAxis(BANG, mk.face?.axis ?? mk.up!)));
  cases.push({
    id,
    label,
    item: "bang-gia",
    mark: mk,
    ...(why && { markNote: why }),
    variantNote: "variant ∈ pinch, flat, rim (rim chỉ dựng khung theo fixture, chưa đo ngón)",
    mainAxisWorld: rv(front),
    mainAxisElevDeg: r(Math.asin(-front[1]) / D2R, 1),
    hands,
  });
}

staticCase("c1", "đọc ngang ngực, mặt về người đọc ~45°; tay phải edge right, along 0,33, thumb front", MARKS.c1, [
  { side: RIGHT, given: { edge: "right", along: 0.33, thumb: "front" } },
], C1_WHY);
staticCase("c2", "đọc ngang mặt, song song mặt; tay phải edge bottom", MARKS.c2, [{ side: RIGHT, given: { edge: "bottom" } }]);
staticCase("c3", "khoe hai tay hai cạnh bên, mặt bảng ra trước; phải edge left, trái edge right", MARKS.c3, [
  { side: RIGHT, given: { edge: "left" } },
  { side: LEFT, given: { edge: "right" } },
]);
staticCase("c4", "khoe; phải edge bottom, trái edge top along 0,3", MARKS.c3, [
  { side: RIGHT, given: { edge: "bottom" } },
  { side: LEFT, given: { edge: "top", along: 0.3 } },
]);

// ca 5: cán tạm, `around` của mỗi tay giải một lần ở đầu lần cầm (12 ứng viên), rồi trượt
const AROUND = Array.from({ length: 12 }, (_, i) => i * 30);
const smooth = (x: number) => x * x * (3 - 2 * x);
const C5_BY = { part: "scene", along: "scene", around: "rig", thumb: "default", variant: "default" };
function runC5(addRows: boolean) {
  const ip = itemPose(ROD, MARKS.c5);
  const pick = (side: number, along: number, other?: ArmSeg) => {
    let best: { around: number; h: HandOut; cost: number } | undefined;
    const all: any[] = [];
    for (const around of AROUND) {
      const h = solveHand(ROD, ip, { group: "cylinder", h: { along, around, thumb: "up" } }, side, undefined, other);
      const cost = h.sol.E + (h.sol.gap / (AIM_GAP * s)) ** 2;
      all.push({ around, cost: r(cost, 3), phi: r(h.sol.phi, 1) });
      if (!best || cost < best.cost - 1e-12) best = { around, h, cost };
    }
    return { ...best!, all };
  };
  const pR = pick(RIGHT, 0.95);
  const pL = pick(LEFT, 0.55, segOf(pR.h));
  const N = Math.round(0.6 / HOLD_SLEW_STEP);
  const samples: any[] = [];
  let prevR: number | undefined, prevL: number | undefined;
  for (let i = 0; i <= N; i++) {
    const tt = i * HOLD_SLEW_STEP;
    const alongL = 0.55 + (0.25 - 0.55) * smooth(Math.min(1, tt / 0.6));
    const holdR: Hold = { group: "cylinder", h: { along: 0.95, around: pR.around, thumb: "up" } };
    const holdL: Hold = { group: "cylinder", h: { along: alongL, around: pL.around, thumb: "up" } };
    const hR = solveHand(ROD, ip, holdR, RIGHT, prevR);
    const hL = solveHand(ROD, ip, holdL, LEFT, prevL, segOf(hR));
    prevR = hR.sol.phi;
    prevL = hL.sol.phi;
    const recs = [record(ROD, ip, hR, RIGHT, holdR, `_b0-c5-P`), record(ROD, ip, hL, LEFT, holdL, `_b0-c5-T-${i}`)] as any[];
    for (const [rec, hd] of [[recs[0], holdR], [recs[1], holdL]] as const) {
      rec.choice = { variant: "wrap", part: "can", along: r((hd.h as CylHold).along, 4), around: (hd.h as CylHold).around, thumb: "up" };
      rec.by = C5_BY;
    }
    samples.push({ i, t: r(tt, 4), alongL: r(alongL, 4), hands: recs });
    if (addRows && (i === 0 || i === N || i % 3 === 0)) for (const rec of recs) row("c5", rec, r(tt, 3));
  }
  return {
    id: "c5",
    label: "thanh trượt: cán tạm, tay phải along 0,95, tay trái along 0,55 → 0,25 trong 0,6 s (smoothstep), mẫu mỗi HOLD_SLEW_STEP",
    item: "_b0-can",
    mark: MARKS.c5,
    byNote: "thumb không giải (giữ `up` như đề: ca 5 như cũ); around giải một lần mỗi tay ở t = 0",
    markNote: "vòng 2: cầm như chổi/cuốc trước người — mốc `hip` (phải) + [15, 0, 5], point `duoi`, trục `luoi` về hệ thân [1, −1, −0,8] (tiến, lên, về trái)",
    clearance: c5Clear,
    maxJumpDeg: (() => {
      const j = (k: number) => {
        let m = 0, at = 0;
        for (let i = 1; i < samples.length; i++) {
          const d = Math.abs(wrap(samples[i].hands[k].phi - samples[i - 1].hands[k].phi));
          if (d > m) [m, at] = [d, i];
        }
        return { deg: m, at };
      };
      return { right: j(0), left: j(1) };
    })(),
    around: { right: pR.around, left: pL.around, candidatesRight: pR.all, candidatesLeft: pL.all },
    samples,
  };
}
cases.push(runC5(true));

// ca 5 theo w_cont (chỉ số)
const W_CONT0 = W_CONT;
const wcont: any[] = [];
for (const wc of [0.2, 2, 5]) {
  W_CONT = wc;
  const c = runC5(false);
  const seq = (k: 0 | 1) =>
    c.samples.map((x: any) => {
      const h = x.hands[k];
      return { i: x.i, t: x.t, along: h.choice.along, phi: h.phi, turn: h.wristAngles.turn, bend: h.wristAngles.bend, dev: h.wristAngles.dev, over: h.wristAngles.over.join(",") || "-", lan: h.body.max, E: h.E, cont: h.terms.cont };
    });
  const L = seq(1);
  let jump = 0, at = 0;
  for (let i = 1; i < L.length; i++) {
    const d = Math.abs(wrap(L[i].phi - L[i - 1].phi));
    if (d > jump) [jump, at] = [d, i];
  }
  wcont.push({
    w_cont: wc,
    around: { right: c.around.right, left: c.around.left },
    left: { maxJumpDeg: jump, maxJumpAt: at, maxAbsTurn: Math.max(...L.map((x: any) => Math.abs(x.turn))), maxLan: Math.max(...L.map((x: any) => x.lan)), sumE: r(L.reduce((a: number, x: any) => a + x.E, 0), 3) },
    samplesLeft: L,
    samplesRight: seq(0),
  });
}
W_CONT = W_CONT0;

// ───────────────────────────── kiểm khung `sheet` (ca 2, ca 4: mọi edge × thumb × tay)
const SHEET_V = handVec("sheet");
/** Dấu hình học của một liên kết trong khung cạnh: điểm bàn tay (khung món) đo theo F (mặt ngón cái), −m (vào trong tấm) */
function signature(it: HeldItemSpec, G: GripFrame, side: number, at: V3, m: V3, F: V3, k: number, long: number) {
  const toItem = (p: V3): V3 => mul(mv(tr(G.R), sub(p, G.p)), 1 / G.u);
  const fr = handFrames(SHEET_V, side, k, long);
  const tip = (n: keyof typeof fr) => toItem(add(fr[n].o, mv(fr[n].R, [0, -fr[n].len, 0])));
  const pt = {
    wrist: toItem([0, 0, 0]),
    palm: toItem(handPoint("palm", SHEET_V, side, k, long)),
    thumb: tip("thumb1"),
    index: tip("index1"),
    middle: tip("middle1"),
  };
  const onF = (q: V3) => dot(sub(q, at), F);
  const inward = (q: V3) => dot(sub(q, at), mul(m, -1));
  const Rt = tr(G.R);
  const n = mv(Rt, [-side, 0, 0]);
  const f = mv(Rt, [0, -1, 0]);
  const det =
    G.R[0] * (G.R[4] * G.R[8] - G.R[5] * G.R[7]) - G.R[1] * (G.R[3] * G.R[8] - G.R[5] * G.R[6]) + G.R[2] * (G.R[3] * G.R[7] - G.R[4] * G.R[6]);
  const sig = {
    det: r(det, 4),
    thumbF: r(onF(pt.thumb)),
    indexF: r(onF(pt.index)),
    middleF: r(onF(pt.middle)),
    palmF: r(onF(pt.palm)),
    wristF: r(onF(pt.wrist)),
    wristIn: r(inward(pt.wrist)),
    nF: r(dot(n, F), 3),
    fIn: r(dot(f, mul(m, -1)), 3),
    fF: r(dot(f, F), 3),
  };
  const ok = sig.det > 0.999 && sig.thumbF > 0 && sig.indexF < 0 && sig.middleF < 0 && sig.fIn > 0 && sig.wristIn < 0;
  return { ...sig, ok };
}
const frameCheck = (() => {
  const rows: any[] = [];
  // tham chiếu: fixture bang-gia#doc cỡ 1 (khung món, tay phải cạnh phải, tay trái cạnh trái, F = front)
  const fx = FIX["bang-gia#doc"]["1"];
  for (const [side, tag, ea] of [[RIGHT, "right", "edgeR"], [LEFT, "left", "edgeL"]] as const) {
    const G = { R: fx[tag].R as M3, p: fx[tag].p as V3, u: fx[tag].u as number };
    rows.push({ ca: "fixture", edge: ea, thumb: "front", hand: tag, worldThumb: "-", ...signature(BANG, G, side, fx[tag].centre.item as V3, unit(BANG.anchors[ea].dir as V3), [0, 1, 0], 1, 1) });
  }
  for (const [ca, mk] of [["c2", MARKS.c2], ["c4", MARKS.c3]] as const) {
    const ip = itemPose(BANG, mk);
    const holderDir = mv(T.Rr, [0, 0, -1]);
    for (const edge of DOM.edge)
      for (const thumb of DOM.thumb)
        for (const [side, tag] of [[RIGHT, "right"], [LEFT, "left"]] as const) {
          const g = graspFrame(BANG, ip.Ri, sheet(edge, 0.5, thumb, 0), side);
          const c = g.contact as ReturnType<typeof sheetContact>;
          const Fw = mv(ip.Ri, c.F);
          rows.push({
            ca,
            edge,
            thumb,
            hand: tag,
            worldThumb: dot(Fw, holderDir) > 0 ? "về người cầm" : "ra xa",
            ...signature(BANG, g.G, side, c.at, c.m, c.F, kH * s, longH * s),
          });
        }
  }
  return rows;
})();

// ───────────────────────────── góc cổ tay: so với `aimWrist` của act3 (cùng dấu, cùng gốc 0) khi trong giới hạn
const forearm = (side: number, Wp: V3, pole: V3): M3 => {
  const { S: S0, l1, l2 } = shoulderOf(side);
  const [El, Wr, hinge] = twoBone3(S0, Wp, l1, l2, pole);
  const f = armFrame(S0, El, Wr, hinge);
  return mm(f.R, rx(-f.b));
};
const wristConvention = (() => {
  let n = 0, worst = 0, skipped = 0;
  const check = (it: HeldItemSpec, ip: any, hold: Hold, side: number) => {
    const h = solveHand(it, ip, hold, side);
    if (h.sol.over.length) return skipped++;
    const Re = forearm(side, h.Wp, h.sol.pole);
    const a = aimWrist(Re, side, mv(h.Rw, [-side, 0, 0]), mv(h.Rw, [0, -1, 0]));
    worst = Math.max(worst, Math.abs(a.turn - h.sol.turn), Math.abs(a.bend - h.sol.bend), Math.abs(a.dev - h.sol.dev));
    n++;
  };
  for (const mk of [MARKS.c1, MARKS.c2, MARKS.c3]) {
    const ip = itemPose(BANG, mk);
    for (const edge of DOM.edge) for (const thumb of DOM.thumb) for (const variant of DOM.variant) for (const slant of SLANTS[variant]) for (const side of [RIGHT, LEFT]) check(BANG, ip, sheet(edge, 0.5, thumb, slant, variant), side);
  }
  return { compared: n, skippedOverLimit: skipped, maxAbsDiffDeg: r(worst, 4), note: "aimWrist(Re, side, palm, fingers) của act3 trên cùng cẳng tay; khác biệt chỉ khi ngoài giới hạn (aimWrist kẹp)" };
})();

// ───────────────────────────── kiểm tách góc cổ tay: dựng lại Rw từ (Re, turn, bend, dev)
const ip1 = itemPose(BANG, MARKS.c1);
const g1 = graspFrame(BANG, ip1.Ri, sheet("right", 0.33, "front"), RIGHT);
const hw1 = handFromItem(ip1.Ri, ip1.Pi, g1.G);
const selfCheck = (() => {
  const x = solveHand(BANG, ip1, sheet("right", 0.33, "front"), RIGHT);
  const R2 = mm(forearm(RIGHT, x.Wp, x.sol.pole), wristTurn(x.sol.turn, x.sol.bend, x.sol.dev, RIGHT));
  return { rebuildDeg: r(rotDiff(R2, x.Rw), 4) };
})();
const msPhi = timeIt(() => solvePhi(RIGHT, hw1.Wp, hw1.Rw), 200);
const msEval = timeIt(() => evalPhi(RIGHT, hw1.Wp, hw1.Rw, 30, undefined), 2000);

const fixtures = fixtureCheck();
/** Khung flat/rim dựng lại fixture (cỡ 1): slant suy từ ngón của fixture, dư phép quay; vị trí theo thụt `D_VAR` */
const variantFixtures = (() => {
  const rows: any[] = [];
  const list: [string, SheetVariant, string, string, string, string, V3][] = [
    ["phieu-lien#cam", "flat", "phieu-lien", "edgeR", "edgeL", "front", [0, 0, -1]],
    ["thuc-don#khoe", "flat", "thuc-don", "edgeL", "edgeR", "front", [0, 0, -1]],
    ["tom-hum#nhac", "rim", "tom-hum", "rimL", "rimR", "top", [0, 0, 1]],
    ["bo-da#bung", "rim", "bo-da", "rimL", "rimR", "top", [0, 0, 1]],
    ["bao#doc", "rim", "bao", "edgeR", "edgeL", "front", [0, 1, 0]],
  ];
  for (const [key, v, itemName, eaR, eaL, Fa, e] of list) {
    const it = heldAll[itemName];
    const fx = FIX[key]["1"];
    for (const [side, tag, ea] of [[RIGHT, "right", eaR], [LEFT, "left", eaL]] as const) {
      const F0 = fx[tag];
      const m = unit(it.anchors[ea].dir as V3);
      const F = unit(it.anchors[Fa].dir as V3);
      const ee = unit(perp(perp(e, m), F));
      const f = unit(F0.fingers as V3);
      let slant: number;
      if (v === "flat") slant = Math.atan2(dot(f, ee), dot(f, mul(m, -1))) / D2R;
      else {
        const f0 = unit(mul(cross(F, mul(m, -1)), side));
        slant = Math.atan2(-dot(f, F), dot(f, f0)) / D2R;
      }
      const centre = F0.centre.item as V3;
      const G = (sl: number) => {
        const ax = sheetAxes(v, m, ee, F, sl, side);
        return gripFrame(it, { pose: "edge", at: { anchor: ea, offset: sub(centre, it.anchors[ea].at as V3) }, palm: ax.n, fingers: ax.f }, side, 1, 1, 1);
      };
      const rel = sub(centre, it.anchors[ea].at as V3);
      const dFix = dot(rel, mul(m, -1));
      rows.push({
        fixture: key,
        variant: v,
        hand: tag,
        slant: r(slant, 1),
        rotDeg: r(rotDiff(G(slant).R, F0.R as M3), 2),
        rotDegSlant0: r(rotDiff(G(0).R, F0.R as M3), 1),
        palmVsModel: r(angDeg(F0.palm as V3, v === "flat" ? F : mul(m, -1)), 2),
        dFixture: r(dFix, 2),
        offF: r(dot(rel, F), 2),
        posResidual: r(Math.hypot(dFix - D_VAR[v], dot(rel, F)), 2),
      });
    }
  }
  return { rows, d: { flat: D_VAR.flat, rim: D_VAR.rim, note: "vị trí: thụt `d` vào trong từ mép, giữa bề dày; dư = lệch thụt + lệch khỏi mặt giữa" } };
})();
const out = {
  generated: new Date().toISOString(),
  source: "tmp/nhom-cam/b0/grasp.mts (gói esbuild từ packages/rig/src/core, xuất thêm trunk3/markShape/markAt lúc gói)",
  params: {
    w_down: W_DOWN,
    w_body: W_BODY,
    w_cont: W_CONT,
    turnMax: TURN_MAX,
    AIM_BEND,
    AIM_DEV,
    AIM_GAP,
    HOLD_SLEW_STEP,
    REACH_ELBOW,
    sheetPalm: PC,
    cylPalmBulgeOverK: PALM_BULGE,
    choice: { domains: DOM, defaults: DEF, devMax: DEV_MAX, note: "slant 3 điểm −30/0/30 (low/in/high), dương về đầu cao; along từ đầu thấp; giá lệch mặc định = 0,05 · phần trường thiếu khác mặc định" },
    phi: "góc khuỷu quanh trục vai → cổ tay; 0 = thõng (chiếu của −y three), +90 = ra ngoài phía tay ấy",
    elbow: "mốc tay `world.hands`: `at` = wrist (rig), `point: \"wrist\"`, `elbow` = véc tơ này (thế giới rig); act3 `actReach` dùng [x, −y, −z] làm pole",
  },
  holder: {
    cast: HOLDER,
    scene: SCENE,
    t: T_POSE,
    s: r(s, 4),
    flip: !!T.W.flip,
    height: CH.rig.height,
    handK: r(kH, 4),
    handLong: r(longH, 4),
    W: r(W_HAND, 3),
    c1Offset: { offset: MARKS.c1.offset, note: "nâng y tới khi tâm bảng ngang giữa vai và rốn (shoulder, belly)" },
    c2Offset: { offset: MARKS.c2.offset, gapBefore: r(C2_GAP0, 2), gapAfter: r(C2_GAP, 2), note: "đẩy tiến tới khi khe bảng – da đầu (onSkull của markShape) ≥ 8" },
    c1HolderFace: { elevDeg: r(C1_ELEV0, 1), forwardComp: r(C1_HF_FWD, 3), used: "face toward [−1, −1, 0] hệ thân (lùi, lên 45°)" },
    d: { c: r(C_D, 4), d: r(D_SHEET, 3), note: "d = c·W; c mặc định = 2,5 / W của người cầm (ra lại bang-gia#doc ở cỡ tay này)" },
    stillness: still,
    shoulders: { right: rv(rigP(shoulderOf(RIGHT).S), 2), left: rv(rigP(shoulderOf(LEFT).S), 2) },
    armLen: { l1: r(shoulderOf(RIGHT).l1 * 100, 2), l2: r(shoulderOf(RIGHT).l2 * 100, 2) },
    restArmIntrusion: restCheck,
  },
  items: { "_b0-can": ROD_JSON },
  fixtures,
  variantFixtures,
  frameCheck,
  wristConvention,
  selfCheck,
  cost: { msEvalPhi: r(msEval, 4), msSolvePhi: r(msPhi, 3), evalsPerSolve: solvePhi(RIGHT, hw1.Wp, hw1.Rw).evals },
  table,
  cases,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
const OUTW = OUT.replace(/ca\.json$/, "ca-wcont.json");
if (OUTW !== OUT) fs.writeFileSync(OUTW, JSON.stringify({ generated: out.generated, params: { w_down: W_DOWN, w_body: W_BODY }, runs: wcont }, null, 1));
console.log(JSON.stringify({ selfCheck, wristConvention, cost: out.cost }, null, 1));
console.table(variantFixtures.rows);
console.log("c1", MARKS.c1.offset, "c2", MARKS.c2.offset, r(C2_GAP0, 2), "→", r(C2_GAP, 2), "c5", JSON.stringify(c5Clear), JSON.stringify(cases.find((c) => c.id === "c5").maxJumpDeg));
for (const c of cases) for (const h of c.hands ?? []) console.log(c.id, h.hand, "choice", h.choiceSolve.candidates, "ms", h.choiceSolve.ms, JSON.stringify(h.choiceSolve.top.slice(0, 3)));
console.table(table);
console.table(wcont.map((w) => ({ w_cont: w.w_cont, ...w.left })));
console.log("→", OUT, OUTW);
