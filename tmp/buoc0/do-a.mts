// Bước 0, phần 1: số đo bàn tay mới, fixture GripFrame, δ lồi da, baseline heldFit.
// Nhập thẳng mã nguồn lõi (packages/rig/src/core/*.ts), gói bằng esbuild (run.mjs). Chạy: node tmp/buoc0/run.mjs tmp/buoc0/do-a.mts
import fs from "node:fs";
import {
  HAND_BONES,
  HAND_FINGERS,
  HAND_PIECES,
  HAND_REST,
  fingerVec,
  handFrames,
  handVec,
  HAND_POSES,
  type HandFrame,
  type HandPiece,
  type HandPose,
} from "../../packages/rig/src/core/hand";
import {
  handSkin,
  skinHand,
  handCapsules,
  fitCapsules,
  HAND_CAPSULE_PIECES,
} from "../../packages/rig/src/core/handMesh";
import {
  gripFrame,
  gripHand,
  gripAxes,
  gripCenter,
  heldPoint,
  parseHeldItem,
  isCarry,
  type GripFrame,
  type GripHand,
  type HeldItemSpec,
  type HeldFinger,
  HELD_FINGERS,
} from "../../packages/rig/src/core/heldItem";
import {
  heldFit,
  heldDistance,
  toItem,
  capsuleClearance,
  fingerClearance,
  HELD_FIT,
} from "../../packages/rig/src/core/heldFit";
import { bones3, cladHand } from "../../packages/rig/src/core/act3";
import { parseCharacter, limbWidths } from "../../packages/rig/src/core/schema";
import type { V3 } from "../../packages/rig/src/core/lens";

const VIDEO = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto";
const OUT = new URL("./", import.meta.url).pathname;

// ---------- cỡ tay ----------
const charHand = (f: string) => {
  const c = parseCharacter(JSON.parse(fs.readFileSync(`${VIDEO}/characters/${f}.json`, "utf8")));
  if (!c.success) throw new Error(f);
  const d = c.data as any;
  const w = limbWidths(d.palette);
  const h = cladHand(w.sleeve, d.rig.stroke, bones3(d.rig.height).foreArm * 100);
  return { k: h.k, long: h.long, height: d.rig.height };
};
const sak = charHand("t01-sakura");
const kur = charHand("kuroiwa");
const SIZES = [
  { key: "1", k: 1, long: 1, note: "long = k" },
  { key: "1.61", k: 1.61, long: 1.61, note: "long = k" },
  { key: "2.16", k: 2.16, long: 2.16, note: "long = k" },
  { key: "t01-sakura", k: sak.k, long: sak.long, note: `người thật, k·height = ${(sak.k * sak.height).toFixed(3)}` },
  { key: "kuroiwa", k: kur.k, long: kur.long, note: `người thật, k·height = ${(kur.k * kur.height).toFixed(3)}` },
];

// ---------- tiện ích ----------
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const tipOf = (F: HandFrame): V3 => {
  const d: V3 = [F.R[1] * -F.len, F.R[4] * -F.len, F.R[7] * -F.len];
  return [F.o[0] + d[0], F.o[1] + d[1], F.o[2] + d[2]];
};
const segDist = (p: V3, a: V3, b: V3) => {
  const d = sub(b, a);
  const w = sub(p, a);
  const dd = dot(d, d);
  const t = dd > 0 ? clamp(dot(w, d) / dd, 0, 1) : 0;
  return len([w[0] - t * d[0], w[1] - t * d[1], w[2] - t * d[2]]);
};
const r3 = (x: number, n = 3) => +x.toFixed(n);
const rv = (v: readonly number[], n = 5) => v.map((x) => r3(x, n));
const pctl = (a: number[], q: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
};

/** Bán kính nang chưa phình của một đốt — chép đúng `pieceRadius` (heldFit.ts, không export) */
function pieceRadius(n: HandPiece, k: number, long: number) {
  const kr = Math.min(k, 1.3 * long);
  const f = n.slice(0, -1);
  const r =
    f === "thumb" ? HAND_BONES.thumb.r : f === "index" ? HAND_BONES.index.r : HAND_FINGERS[f as keyof typeof HAND_FINGERS].r;
  return r * kr * (n.endsWith("0") ? 1 : 0.95);
}

/** Đốt trọng số lớn nhất của từng đỉnh da */
const domCache = new Map<string, Int8Array>();
function dominant(side: number, k: number, long: number) {
  const key = `${side}|${k}|${long}`;
  let d = domCache.get(key);
  if (d) return d;
  const s = handSkin(side, k, long);
  const n = s.pos.length / 3;
  const NB = HAND_PIECES.length;
  d = new Int8Array(n);
  for (let v = 0; v < n; v++) {
    let best = 0;
    for (let b = 1; b < NB; b++) if (s.weights[v * NB + b] > s.weights[v * NB + best]) best = b;
    d[v] = best;
  }
  domCache.set(key, d);
  return d;
}
function skinAt(side: number, k: number, long: number, v: readonly number[]) {
  const s = handSkin(side, k, long);
  const out = new Float32Array(s.pos.length);
  skinHand(s, v, out);
  return out;
}
const vert = (P: ArrayLike<number>, i: number): V3 => [P[3 * i], P[3 * i + 1], P[3 * i + 2]];

// ---------- 1. W, A, L, P ----------
const dims: Record<string, unknown> = {};
for (const S of SIZES) {
  const { k, long } = S;
  const W = 2 * HAND_BONES.palm.half[1] * k * 100;
  const Fo = handFrames(handVec("open"), -1, k, long);
  const tt = tipOf(Fo.thumb1);
  const ti = tipOf(Fo.index1);
  const Acentre = len(sub(tt, ti)) * 100;
  const Acaps = Acentre - (pieceRadius("thumb1", k, long) + pieceRadius("index1", k, long)) * 100;
  // khe da: khoảng nhỏ nhất giữa đỉnh da đốt ngọn ngón cái và đỉnh da đốt ngọn ngón trỏ, ở nửa ngoài của mỗi đốt
  const P = skinAt(-1, k, long, handVec("open"));
  const dom = dominant(-1, k, long);
  const ti1 = HAND_PIECES.indexOf("thumb1");
  const ii1 = HAND_PIECES.indexOf("index1");
  const tipV = (piece: number, F: HandFrame) => {
    const ids: number[] = [];
    for (let i = 0; i < dom.length; i++) {
      if (dom[i] !== piece) continue;
      const p = vert(P, i);
      const ax = unit(sub(tipOf(F), F.o));
      if (dot(sub(p, F.o), ax) > 0.5 * F.len) ids.push(i);
    }
    return ids;
  };
  const tv = tipV(ti1, Fo.thumb1);
  const iv = tipV(ii1, Fo.index1);
  let Askin = Infinity;
  for (const a of tv) for (const b of iv) Askin = Math.min(Askin, len(sub(vert(P, a), vert(P, b))));
  // đầu ngón trên da: đỉnh xa nhất dọc trục đốt ngọn
  const farTip = (ids: number[], F: HandFrame) => {
    const ax = unit(sub(tipOf(F), F.o));
    let best = ids[0];
    for (const i of ids) if (dot(sub(vert(P, i), F.o), ax) > dot(sub(vert(P, best), F.o), ax)) best = i;
    return vert(P, best);
  };
  const AskinTips = len(sub(farTip(tv, Fo.thumb1), farTip(iv, Fo.index1))) * 100;
  const Fr = handFrames(HAND_REST, -1, k, long);
  const Lc = len(tipOf(Fr.index1)) * 100;
  const Pr = skinAt(-1, k, long, HAND_REST);
  let Ls = 0;
  for (let i = 0; i < dom.length; i++) if (dom[i] === ii1) Ls = Math.max(Ls, len(vert(Pr, i)) * 100);
  const Pl = HAND_BONES.palm.len * long * 100;
  dims[S.key] = {
    k, long, note: S.note,
    W: r3(W), W_k: r3(W / k),
    A_centre: r3(Acentre), A_centre_k: r3(Acentre / k),
    A_caps: r3(Acaps), A_caps_k: r3(Acaps / k),
    A_skin_min: r3(Askin * 100), A_skin_min_k: r3((Askin * 100) / k),
    A_skin_tips: r3(AskinTips), A_skin_tips_k: r3(AskinTips / k),
    L_centre: r3(Lc), L_centre_long: r3(Lc / long),
    L_skin: r3(Ls), L_skin_long: r3(Ls / long),
    P: r3(Pl), P_long: r3(Pl / long),
  };
}

// ---------- món, fixture ----------
const item = (n: string): HeldItemSpec => {
  const r = parseHeldItem(JSON.parse(fs.readFileSync(`${VIDEO}/held/${n}.json`, "utf8")));
  if (!r.success) throw new Error(`${n}: ${r.error.message}`);
  return r.data;
};
const FIX = [
  "bang-gia#doc", "phieu-lien#cam", "thuc-don#khoe", "tom-hum#nhac", "the-phong#kep", "but#viet", "dua#cam",
  "chai-dia#co", "chen#kep", "tui#xach", "dien-thoai#doc", "khay#bung", "phieu#do", "bo-da#bung", "bao#doc",
];
const missing: string[] = [];
type HandFix = { side: number; role: "one" | "lead" | "other"; h: GripHand };
function handsOf(spec: HeldItemSpec, grip: string): HandFix[] | undefined {
  const g = spec.grips[grip];
  if (!g || isCarry(g)) return undefined;
  if (g.both) {
    const lead = g.both.lead === "right" ? -1 : 1;
    return [
      { side: lead, role: "lead", h: gripHand(g, lead) },
      { side: -lead, role: "other", h: g.both.other },
    ].sort((a, b) => a.side - b.side) as HandFix[];
  }
  return [
    { side: -1, role: "one", h: gripHand(g, -1) },
    { side: 1, role: "one", h: gripHand(g, 1) },
  ];
}
const sideName = (s: number) => (s < 0 ? "right" : "left");

const fixtures: Record<string, any> = {};
const baseline: Record<string, any> = {};
const bulgeRows: any[] = [];
const sheetD: Record<string, any> = {};
let palmCoef: any;

/** Khe từ nang (đã nới cho ôm da, như `handCaps` của check) tới hình món, đơn vị rig */
function auditCaps(spec: HeldItemSpec, G: GripFrame, vfull: number[], side: number, k: number, long: number, pos: Float32Array) {
  const caps = fitCapsules(handCapsules(vfull, side, k, long), pos);
  const GROUP: Record<string, string> = { palm: "palm", thenar: "palm", thumb0: "thumb", thumb1: "thumb", index0: "index", index1: "index" };
  const gaps: Record<string, number> = { thumb: Infinity, index: Infinity, fingers: Infinity, palm: Infinity };
  const fingers: Record<string, number> = {};
  let pierce = { core: -Infinity, depth: 0, piece: "" };
  caps.forEach(([a, b, r], i) => {
    const piece = HAND_CAPSULE_PIECES[i];
    const c = capsuleClearance(spec.shape!, G, a, b, r);
    const g = GROUP[piece] ?? "fingers";
    gaps[g] = Math.min(gaps[g], c.gap);
    if (piece !== "palm" && piece !== "thenar") {
      const f = piece.slice(0, -1);
      fingers[f] = Math.min(fingers[f] ?? Infinity, c.gap);
    }
    if (c.core > pierce.core) pierce = { core: c.core, depth: -c.gap, piece };
  });
  return {
    gaps: Object.fromEntries(Object.entries(gaps).map(([a, b]) => [a, r3(b)])),
    fingers: Object.fromEntries(Object.entries(fingers).map(([a, b]) => [a, r3(b)])),
    pierce: { core: r3(pierce.core), depth: r3(pierce.depth), piece: pierce.piece },
  };
}
/** Lún đo trên đỉnh da (mục 7 bản mới): sâu nhất và khe nhỏ nhất từng đốt */
function skinDepth(spec: HeldItemSpec, G: GripFrame, pos: Float32Array, dom: Int8Array) {
  const gap: Record<string, number> = {};
  let depth = -Infinity;
  let at = "";
  for (let i = 0; i < dom.length; i++) {
    const d = heldDistance(spec.shape!, toItem(G, vert(pos, i)));
    const p = HAND_PIECES[dom[i]];
    gap[p] = Math.min(gap[p] ?? Infinity, d);
    if (-d > depth) [depth, at] = [-d, p];
  }
  return { depth: r3(depth), piece: at, gaps: Object.fromEntries(HAND_PIECES.map((p) => [p, r3(gap[p] ?? Infinity)])) };
}

/** δ lồi da từng đốt ở số bàn tay `v`: đỉnh trọng số lớn nhất ở đốt → mặt nang chưa phình của đốt */
function bulge(v: number[], side: number, k: number, long: number) {
  const P = skinAt(side, k, long, v);
  const dom = dominant(side, k, long);
  const F = handFrames(v, side, k, long);
  const caps = handCapsules(v, side, k, long);
  const tx = HAND_BONES.palm.half[0] * k;
  const rt = HAND_BONES.thumb.r * Math.min(k, 1.3 * long);
  // dải lòng tay và gò ngón cái của handCapsules, bán kính chưa phình
  const palmCaps = caps.slice(0, 6).map(([a, b], i) => [a, b, i < 5 ? tx : 0.85 * rt] as const);
  const per: Record<string, number[]> = {};
  const tt: Record<string, number[]> = {};
  const pal: Record<string, number[]> = {};
  for (let i = 0; i < dom.length; i++) {
    const n = HAND_PIECES[dom[i]];
    const p = vert(P, i);
    let d: number;
    let t: number;
    if (n === "palm") {
      d = Math.min(...palmCaps.map(([a, b, r]) => segDist(p, a as V3, b as V3) - r));
      t = -p[1] / F.palm.len;
    } else {
      d = segDist(p, F[n].o, tipOf(F[n])) - pieceRadius(n, k, long);
      const ax = sub(tipOf(F[n]), F[n].o);
      t = dot(sub(p, F[n].o), ax) / dot(ax, ax);
    }
    // phía lòng tay: lệch khỏi trục theo cột x của khung đốt, nhân p = −side
    const R = F[n === "palm" ? "palm" : n].R;
    const radial = dot(sub(p, F[n].o), [R[0], R[3], R[6]]) * -side;
    (per[n] ??= []).push(d * 100);
    (tt[n] ??= []).push(t);
    (pal[n] ??= []).push(radial > 0 ? d * 100 : -Infinity);
  }
  return Object.fromEntries(
    HAND_PIECES.map((n) => {
      const i = per[n].indexOf(Math.max(...per[n]));
      return [n, { max: r3(Math.max(...per[n])), p95: r3(pctl(per[n], 0.95)), palmar: r3(Math.max(...pal[n])), tAtMax: r3(tt[n][i], 2), n: per[n].length }];
    }),
  );
}

const timeIt = (f: () => unknown, n = 15) => {
  for (let i = 0; i < 3; i++) f();
  const t: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = performance.now();
    f();
    t.push(performance.now() - a);
  }
  return pctl(t, 0.5);
};

for (const key of FIX) {
  const [name, grip] = key.split("#");
  if (!fs.existsSync(`${VIDEO}/held/${name}.json`)) {
    missing.push(`${key}: không có held/${name}.json`);
    continue;
  }
  const spec = item(name);
  const hs = handsOf(spec, grip);
  if (!hs) {
    missing.push(`${key}: không có kiểu cầm bằng tay \`${grip}\` (có: ${Object.keys(spec.grips).join(", ")})`);
    continue;
  }
  const g = spec.grips[grip] as any;
  fixtures[key] = { size: spec.size, hands: g.both ? "both" : "one", ...(g.both && { lead: g.both.lead }), shape: spec.shape?.length ?? 0 };
  baseline[key] = {};
  for (const S of SIZES) {
    const { k, long } = S;
    const row: any = {};
    const base: any = {};
    for (const H of hs) {
      const s = H.side;
      const G = gripFrame(spec, H.h, s, k, long);
      const ax = gripAxes(spec, H.h);
      row[sideName(s)] = {
        R: rv(G.R, 6), p: rv(G.p, 6), u: G.u,
        pose: H.h.pose, role: H.role, wrap: H.h.wrap ?? [],
        centre: { hand: rv(gripCenter(H.h.pose, s, k, long), 6), item: rv(heldPoint(spec, H.h.at), 4) },
        palm: rv(ax.palm, 5), fingers: rv(ax.fingers, 5),
      };
      // baseline heldFit
      const v = [0, 0, ...fingerVec(HAND_POSES[H.h.pose as HandPose])];
      const inp = { v, side: s, k, long, shape: spec.shape!, G, wrap: H.h.wrap };
      const fit = spec.shape ? heldFit(inp) : new Array(10).fill(0);
      const ms = spec.shape ? timeIt(() => heldFit(inp)) : 0;
      const vfull = [...v, ...fit];
      const pos = skinAt(s, k, long, vfull);
      const dom = dominant(s, k, long);
      const fc = spec.shape ? fingerClearance({ v, side: s, k, long, shape: spec.shape, G }, vfull) : undefined;
      base[sideName(s)] = {
        pose: H.h.pose, role: H.role, wrap: H.h.wrap ?? [], ms: r3(ms, 2),
        fit: fit.map((x) => r3(x, 2)),
        capsGap: fc && Object.fromEntries(Object.entries(fc).map(([f, [a, b]]) => [f, [r3(a), r3(b)]])),
        audit: spec.shape && auditCaps(spec, G, vfull, s, k, long, pos),
        skin: spec.shape && skinDepth(spec, G, pos, dom),
      };
      // δ ở dáng gốc (không cộng độ gập thêm)
      bulgeRows.push({ key, size: S.key, side: sideName(s), pose: H.h.pose, d: bulge(v, s, k, long) });
    }
    row.pose = { right: row.right?.pose, left: row.left?.pose };
    row.centre = { right: row.right?.centre, left: row.left?.centre };
    row.k = k;
    row.long = long;
    fixtures[key][S.key] = row;
    baseline[key][S.key] = base;
  }
}

// ---------- 2. sheet: độ thụt d của bang-gia#doc ----------
{
  const spec = item("bang-gia");
  const g = spec.grips.doc as any;
  for (const S of SIZES) {
    const { k, long } = S;
    const res: any = {};
    for (const s of [-1, 1]) {
      const h = gripHand(g, s);
      const G = gripFrame(spec, h, s, k, long);
      const edge = s < 0 ? { x: 22, m: [1, 0, 0] as V3 } : { x: -22, m: [-1, 0, 0] as V3 };
      const v = [0, 0, ...fingerVec(HAND_POSES.sheet)];
      const fit = heldFit({ v, side: s, k, long, shape: spec.shape!, G, wrap: h.wrap });
      const pos = skinAt(s, k, long, [...v, ...fit]);
      const dom = dominant(s, k, long);
      const at = heldPoint(spec, h.at);
      const depthOf = (q: V3) => -(q[0] - edge.x) * edge.m[0];
      const groups: Record<string, { d: number[]; y: number[]; q: V3[] }> = { thumb: { d: [], y: [], q: [] }, fingers: { d: [], y: [], q: [] }, palm: { d: [], y: [], q: [] } };
      for (let i = 0; i < dom.length; i++) {
        const q = toItem(G, vert(pos, i));
        const dist = heldDistance(spec.shape!, q);
        if (dist > 0.3) continue;
        const p = HAND_PIECES[dom[i]];
        const gname = p.startsWith("thumb") ? "thumb" : p === "palm" ? "palm" : "fingers";
        groups[gname].d.push(depthOf(q));
        groups[gname].y.push(q[1]);
      }
      const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
      const stat = (o: { d: number[]; y: number[] }) =>
        o.d.length
          ? { n: o.d.length, max: r3(Math.max(...o.d), 2), mean: r3(sum(o.d) / o.d.length, 2), min: r3(Math.min(...o.d), 2), yMean: r3(sum(o.y) / o.y.length, 2) }
          : { n: 0 };
      // tâm nắm của dáng đã hoà (đúng tâm nắm GripFrame dùng: điểm `at`)
      const W = 2 * HAND_BONES.palm.half[1] * k * 100;
      const st = { thumb: stat(groups.thumb), fingers: stat(groups.fingers), palm: stat(groups.palm) };
      const both = [...groups.thumb.d, ...groups.fingers.d];
      const dContact = both.length ? Math.max(...both) : NaN;
      // chỗ gần tấm nhất của từng ngón (trên da) và đầu đốt ngọn (trục nang): độ sâu từ mép, khe
      const Ff = handFrames([...v, ...fit], s, k, long);
      const nearest: Record<string, { gap: number; depth: number; y: number }> = {};
      for (let i = 0; i < dom.length; i++) {
        const p = HAND_PIECES[dom[i]];
        const f = p === "palm" ? "palm" : p.slice(0, -1);
        const q = toItem(G, vert(pos, i));
        const dist = heldDistance(spec.shape!, q);
        if (!nearest[f] || dist < nearest[f].gap) nearest[f] = { gap: r3(dist, 2), depth: r3(depthOf(q), 2), y: r3(q[1], 2) };
      }
      const tips = Object.fromEntries(
        HELD_FINGERS.map((f) => {
          const q = toItem(G, tipOf(Ff[`${f}1` as HandPiece]));
          return [f, { depth: r3(depthOf(q), 2), y: r3(q[1], 2) }];
        }),
      );
      const roots = Object.fromEntries(
        HELD_FINGERS.map((f) => {
          const q = toItem(G, Ff[`${f}0` as HandPiece].o);
          return [f, { depth: r3(depthOf(q), 2), y: r3(q[1], 2) }];
        }),
      );
      res[sideName(s)] = {
        nearest,
        tips,
        roots,
        gripCentreDepth: r3(depthOf(at), 2),
        contact: st,
        dContactMax: r3(dContact, 2),
        dContactMax_W: r3(dContact / W, 3),
        dThumbMax_W: r3(Math.max(...groups.thumb.d) / W, 3),
        dFingersMax_W: r3(Math.max(...groups.fingers.d) / W, 3),
        W: r3(W, 2),
      };
    }
    sheetD[S.key] = res;
  }
  // ---------- 3. hệ số lòng tay ----------
  const rows: any = {};
  for (const s of [-1, 1]) {
    const h = gripHand(g, s);
    const { palm: n, fingers } = gripAxes(spec, h);
    const F: V3 = [0, 1, 0]; // mặt `front`
    const fp = unit(sub(fingers, mul(F, dot(fingers, F))));
    const a = dot(n, F);
    const b = dot(n, fp);
    const res = sub(n, [a * F[0] + b * fp[0], a * F[1] + b * fp[1], a * F[2] + b * fp[2]]);
    const m: V3 = s < 0 ? [1, 0, 0] : [-1, 0, 0];
    // slant: góc từ −m tới fp quanh pháp tuyến mặt F
    const into = mul(m, -1);
    const crossY = into[2] * fp[0] - into[0] * fp[2];
    const slant = (Math.atan2(crossY, dot(into, fp)) * 180) / Math.PI;
    rows[sideName(s)] = {
      n: rv(n, 4), fingers: rv(fingers, 4), f_proj: rv(fp, 4), F, a: r3(a, 4), b: r3(b, 4),
      residual: r3(len(res), 4), a2b2: r3(a * a + b * b, 4), sheetToPalmDeg: r3((Math.acos(Math.abs(a)) * 180) / Math.PI, 2),
      slantDeg: r3(slant, 2),
    };
  }
  // ngón cái đè mặt nào: y trung bình đỉnh da ngón cái chạm tấm
  rows.thumbFace = Object.fromEntries(
    SIZES.map((S) => [S.key, Object.fromEntries(["right", "left"].map((sd) => [sd, sheetD[S.key][sd].contact.thumb.yMean]))]),
  );
  palmCoef = rows;
}

// ---------- 4. bảng δ ----------
const bulgeTable: Record<string, any> = {};
for (const S of SIZES) {
  const rows = bulgeRows.filter((r) => r.size === S.key);
  bulgeTable[S.key] = Object.fromEntries(
    HAND_PIECES.map((n) => {
      const xs = rows.map((r) => r.d[n].max);
      const ps = rows.map((r) => r.d[n].p95);
      const pm = rows.map((r) => r.d[n].palmar);
      const ts = rows.map((r) => r.d[n].tAtMax);
      const byPose: Record<string, number> = {};
      for (const r of rows) byPose[r.pose] = Math.max(byPose[r.pose] ?? -Infinity, r.d[n].max);
      return [n, { min: r3(Math.min(...xs)), max: r3(Math.max(...xs)), palmarMin: r3(Math.min(...pm)), palmarMax: r3(Math.max(...pm)), tAtMax: [r3(Math.min(...ts), 2), r3(Math.max(...ts), 2)], p95min: r3(Math.min(...ps)), p95max: r3(Math.max(...ps)), byPose }];
    }),
  );
}

const result = {
  generated: new Date().toISOString(),
  source: "packages/rig/src/core/*.ts (mã nguồn, gói esbuild)",
  sizes: SIZES,
  dims,
  sheetD,
  palmCoef,
  bulge: bulgeTable,
  bulgeRows,
  baseline,
  missing,
  HELD_FIT,
};
fs.writeFileSync(`${OUT}/do-a.json`, JSON.stringify(result, null, 1));
fs.writeFileSync(`${OUT}/fixtures.json`, JSON.stringify(fixtures, null, 1));
console.log(JSON.stringify({ dims, sheetD, palmCoef, missing }, null, 1));
