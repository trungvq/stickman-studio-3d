// Bước 0, phần 2: prototype hàm chi phí J của bộ chọn phương án (docs/11 §5) trên rig hiện có, không đổi schema.
// Chạy: node tmp/buoc0/j-run.mjs tmp/buoc0/j-cost.mts  (j-run.mjs vá act3.ts lúc gói: xuất solveActing/trunk3/arm3/markShape,
// công tắc globalThis.__J { fast, noSwivel, noAlts })
import fs from "node:fs";
import {
  solveActing,
  trunk3,
  arm3,
  markShape,
  AIM_BEND,
  AIM_DEV,
  AIM_SWIVEL,
  HOLD_ALT,
  type ActInput,
} from "../../packages/rig/src/core/act3";
import { AIM_GAP } from "../../packages/rig/src/core/palm";
import { parseScene, resolveScene, sceneAt } from "../../packages/rig/src/core/scene";
import { parseCharacter } from "../../packages/rig/src/core/schema";
import { parseAction } from "../../packages/rig/src/core/action";
import { body3 } from "../../packages/rig/src/core/figure3d";
import { HAND_BONES } from "../../packages/rig/src/core/hand";
import { RIG } from "../../packages/rig/src/core/constants";
import { REACH_ELBOW } from "../../packages/rig/src/core/ik";
import {
  gripAxes,
  gripFrame,
  gripHand,
  parseHeldItem,
  type GripSpec,
  type GripHand,
  type HeldItemSpec,
} from "../../packages/rig/src/core/heldItem";
import { matVec as mv, type M3, type V3 } from "../../packages/rig/src/core/lens";

const VIDEO = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto";
const STUDIO = "/home/trungvq/Work/Dev/stickman-studio-3d";
const OUT = new URL("./", import.meta.url).pathname;
const readJ = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const G = globalThis as any;

// ---------- vectơ ----------
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const angDeg = (a: V3, b: V3) => (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;
/** Quay `v` quanh trục đơn vị `u` góc `a` (rad) */
const spin = (v: V3, u: V3, a: number): V3 => {
  const c = Math.cos(a), s = Math.sin(a);
  return add(add(mul(v, c), mul(cross(u, v), s)), mul(u, dot(u, v) * (1 - c)));
};
const r2 = (x: number, n = 2) => +x.toFixed(n);

// ---------- dữ liệu ----------
const char = (f: string) => {
  const r = parseCharacter(readJ(`${VIDEO}/characters/${f}.json`));
  if (!r.success) throw new Error(f);
  return r.data;
};
const held = (n: string): HeldItemSpec => {
  const r = parseHeldItem(readJ(`${VIDEO}/held/${n}.json`));
  if (!r.success) throw new Error(`${n}: ${r.error.message}`);
  return r.data;
};
const STAND = parseAction(readJ(`${STUDIO}/apps/studio/public/actions/stand-3d.json`));
if (!STAND.success) throw new Error("stand-3d");
const HOLDER = char("yota");
const OTHER = char("takumi");
const HELD: Record<string, HeldItemSpec> = {
  "bang-gia": held("bang-gia"),
  "chai-dia": held("chai-dia"),
  "chai-dac-tuyen": held("chai-dac-tuyen"),
};

/** Cảnh tối giản: yota (người cầm) ở [250,0,790] quay −z, takumi (`khach`) đối diện cách 345 — như `thu-giay-t02` */
function runtime(hands: unknown[]) {
  const r = parseScene({
    name: "j",
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      { id: "yota", character: "yota.json", world: { at: [250, 0, 790], yaw: 90, hands },
        tracks: [{ name: "than", clips: [{ start: 0, action: "stand-3d" }] }] },
      { id: "khach", character: "takumi.json", world: { at: [250, 0, 445], yaw: 270 },
        tracks: [{ name: "than", clips: [{ start: 0, action: "stand-3d" }] }] },
    ],
  });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(r.data, { "stand-3d": STAND.data! }, {}, {},
    { yota: HOLDER.rig.height, khach: OTHER.rig.height }, { yota: body3(HOLDER), khach: body3(OTHER) }, HELD);
}
const poseAt = (rt: ReturnType<typeof runtime>, t: number) =>
  sceneAt(rt, "yota", t, HOLDER.rig.height, body3(HOLDER)) as unknown as ActInput;

// ---------- ứng viên: GripSpec số (khung món) ----------
interface Link { pose: GripHand["pose"]; at: V3; palm: V3; fingers: V3; wrap?: GripHand["wrap"] }
interface Cand {
  name: string;
  lead: Link;
  support?: Link;
  /** nhãn lựa chọn rời và liên tục */
  edge: string;
  thumb: string;
  variant: string;
  along: number;
  /** `sheet`: trục quay slant (pháp tuyến mặt tấm), điểm quay */
  slantAxis?: V3;
}
const linkOf = (spec: HeldItemSpec, h: GripHand): Link => {
  const a = gripAxes(spec, h);
  return { pose: h.pose, at: a.at, palm: a.palm, fingers: a.fingers, ...(h.wrap && { wrap: h.wrap }) };
};
const rotLink = (L: Link, u: V3, c: V3, a: number): Link => ({
  ...L,
  at: add(c, spin(sub(L.at, c), u, a)),
  palm: spin(L.palm, u, a),
  fingers: spin(L.fingers, u, a),
});
const mirLink = (L: Link, n: V3, c: V3): Link => {
  const m = (p: V3): V3 => sub(p, mul(n, 2 * dot(n, p)));
  return { ...L, at: add(c, m(sub(L.at, c))), palm: m(L.palm), fingers: m(L.fingers) };
};
const gripOfLink = (L: Link): GripHand => ({
  pose: L.pose,
  at: { anchor: "_o", offset: [...L.at] as V3 },
  palm: [...L.palm] as V3,
  fingers: [...L.fingers] as V3,
  ...(L.wrap && { wrap: L.wrap }),
});
const specWith = (spec: HeldItemSpec, name: string, c: Cand): HeldItemSpec => {
  const g: GripSpec = {
    ...gripOfLink(c.lead),
    ...(c.support && { both: { lead: "right" as const, other: gripOfLink(c.support) } }),
  } as GripSpec;
  return { ...spec, anchors: { ...spec.anchors, _o: { at: [0, 0, 0] } }, grips: { ...spec.grips, [name]: g } };
};
const thumbDir = (L: Link, side: number): V3 => mul(cross(unit(L.palm), unit(L.fingers)), side);

// --- bảng giá ---
const BG = HELD["bang-gia"];
const BG_C: V3 = [0, 0.6, 0]; // tâm, giữa bề dày
const BG_F: V3 = [0, 1, 0]; // pháp tuyến mặt `front`
const BG_EDGES: Record<string, { m: V3; e: V3; c: V3; L: number }> = {
  edgeR: { m: [1, 0, 0], e: [0, 0, -1], c: [22, 0.6, 0], L: 58 },
  edgeL: { m: [-1, 0, 0], e: [0, 0, -1], c: [-22, 0.6, 0], L: 58 },
  top: { m: [0, 0, -1], e: [1, 0, 0], c: [0, 0.6, -29], L: 44 },
  bottom: { m: [0, 0, 1], e: [1, 0, 0], c: [0, 0.6, 29], L: 44 },
};
function sheetLabels(L: Link, side: number) {
  const t = thumbDir(L, side);
  // mặt ngón cái F: pinch/flat có n = a·F + b·f (lòng tay nhìn về F qua tấm), rim có t = F
  const nF = dot(unit(L.palm), BG_F);
  const tF = dot(t, BG_F);
  const k = Math.abs(nF) > 0.3 ? nF : tF;
  const thumb = L.pose === "open" ? "–" : k > 0.3 ? "front" : k < -0.3 ? "back" : "side";
  let edge = "face", best = 4.5, along = 0.5;
  for (const [k, E] of Object.entries(BG_EDGES)) {
    const inset = -dot(sub(L.at, E.c), E.m);
    if (inset > -1 && inset < best && Math.abs(dot(sub(L.at, E.c), E.e)) <= E.L / 2) {
      best = inset; edge = k;
      along = 0.5 + dot(sub(L.at, E.c), E.e) / E.L;
    }
  }
  return { thumb, edge, along };
}
/** Pháp tuyến ngoài của cạnh được cầm: cạnh gần nhất; nắm giữa mặt (`up`) thì hướng ngón */
const edgeNormal = (L: Link, edge: string): V3 => (BG_EDGES[edge]?.m ?? unit(L.fingers));
/** Cạnh đối diện, cùng ngón cái, `along` từ đầu thấp giữ nguyên: soi qua mặt phẳng ⊥ m qua tâm rồi quay π quanh m (ra lại tay phải) */
function oldSheetCands(side = -1): Cand[] {
  const out: Cand[] = [];
  for (const [g, variant] of [["doc", "pinch"], ["khoe", "pinch"], ["up", "up"]] as const) {
    const base = linkOf(BG, gripHand(BG.grips[g] as GripSpec, side));
    const lab0 = sheetLabels(base, side);
    const m0 = edgeNormal(base, lab0.edge);
    // cạnh đối diện: quay π quanh pháp tuyến mặt qua tâm (giữ mặt ngón cái, along từ đầu thấp đảo)
    const opp = rotLink(base, BG_F, BG_C, Math.PI);
    for (const [tag, L0] of [["", base], ["~opp", opp]] as const) {
      const lab = sheetLabels(L0, side);
      const m = edgeNormal(L0, lab.edge);
      const pivot: V3 = [L0.at[0], 0.6, L0.at[2]];
      const flip = rotLink(L0, m, pivot, Math.PI);
      for (const [tg2, L] of [["", L0], ["~flip", flip]] as const) {
        const lb = sheetLabels(L, side);
        out.push({ name: `${g}${tag}${tg2}`, lead: L, edge: lb.edge, thumb: lb.thumb, variant, along: r2(lb.along), slantAxis: BG_F });
      }
    }
    void m0;
  }
  return out;
}
/** Tay phụ (trái) của một ứng viên tay phải: soi gương qua mặt phẳng ⊥ m qua tâm (cạnh đối diện, cùng along, cùng ngón cái), hay ⊥ e (cùng cạnh, along đối xứng) */
function withSupport(c: Cand, mode: "opp" | "sym"): Cand {
  const E = BG_EDGES[c.edge];
  const n = E ? (mode === "opp" ? E.m : E.e) : mode === "opp" ? unit(c.lead.fingers) : [1, 0, 0] as V3;
  const s = mirLink(c.lead, n, BG_C);
  return { ...c, name: `${c.name}+${mode}`, support: s };
}
/** Lưới kiểu spec: 4 cạnh × 2 ngón cái × 3 biến thể × 3 along, slant 0 */
function gridSheetCands(side = -1): Cand[] {
  const out: Cand[] = [];
  for (const [ek, E0] of Object.entries(BG_EDGES))
    for (const thumb of ["front", "back"])
      for (const variant of ["pinch", "flat", "rim"])
        for (const along of [0.25, 0.5, 0.75]) {
          // ngón cái mặt sau: quay khung cạnh π quanh m (e → −e, F → −F)
          const F = thumb === "front" ? BG_F : mul(BG_F, -1);
          const e = thumb === "front" ? E0.e : mul(E0.e, -1);
          const m = E0.m;
          const p = add(E0.c, mul(E0.e, (along - 0.5) * E0.L));
          let L: Link;
          if (variant === "pinch") {
            const f = mul(m, -1);
            L = { pose: "sheet", at: sub(p, mul(m, 2.5)), palm: unit(add(mul(F, 0.7654), mul(f, 0.6436))), fingers: f,
              wrap: ["thumb", "index", "middle", "ring", "pinky"] };
          } else if (variant === "flat") {
            L = { pose: "edge", at: sub(p, mul(m, 5)), palm: F, fingers: mul(m, -1), wrap: ["thumb", "index", "middle"] };
          } else {
            const n = mul(m, -1);
            const f = mul(cross(F, n), side);
            L = { pose: "edge", at: sub(p, mul(m, 3)), palm: n, fingers: f, wrap: ["thumb", "index"] };
          }
          void e;
          out.push({ name: `${ek}/${thumb}/${variant}/${along}`, lead: L, edge: ek, thumb, variant, along, slantAxis: variant === "rim" ? m : F });
        }
  return out;
}
const slanted = (c: Cand, deg: number): Cand => {
  if (!deg || !c.slantAxis) return c;
  const piv = c.lead.at;
  const L = rotLink(c.lead, c.slantAxis, piv, (deg * Math.PI) / 180);
  const S = c.support && rotLink(c.support, c.slantAxis, c.support.at, (-deg * Math.PI) / 180);
  return { ...c, lead: L, ...(S && { support: S }) };
};

// --- chai ---
function bottleCands(spec: HeldItemSpec, side = -1): Cand[] {
  const H = spec.size[1];
  return ["co", "rot", "xem", "rot-than", "bung"].map((g) => {
    const L = linkOf(spec, gripHand(spec.grips[g] as GripSpec, side));
    const along = L.at[1] / H;
    const t = thumbDir(L, side);
    return { name: g, lead: L, edge: "-", thumb: t[1] > 0.5 ? "up" : t[1] < -0.5 ? "down" : "side", variant: "wrap", along: r2(along) };
  });
}

// ---------- giải một ứng viên ở một mẫu ----------
/** A: aimWrist nhanh, không thử khuỷu; B: đường act3 đủ (thử khuỷu theo giá ý định của act3); E: khuỷu tay chính đặt từ ngoài (dò theo J), tay phụ như B */
type Mode = "A" | "B" | "E";
interface Sample {
  w: number;
  e: number; rho: number;
  turn: number; bend: number; dev: number; clamps: number;
  gap: number; eps: number; beta: number; swivel: number;
  sup?: { gap: number; turn: number; bend: number; dev: number; clamps: number; eps: number; beta: number };
  depth: number; depthAt: string; W: number;
  sh: V3; wr: V3; elbow0: V3;
}
const shapeCache = new Map<object, ReturnType<typeof markShape>>();
function itemPoints(spec: HeldItemSpec): V3[] {
  const pts: V3[] = [];
  for (const s of spec.shape ?? [{ box: spec.size as V3, at: [0, spec.size[1] / 2, 0] as V3 }]) {
    if ("box" in s) {
      const c = (s.at ?? [0, 0, 0]) as V3;
      const [a, b, d] = s.box;
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 1; j++) for (let k = 0; k <= 10; k++)
        pts.push([c[0] + a * (i / 8 - 0.5), c[1] + b * (j - 0.5), c[2] + d * (k / 10 - 0.5)]);
    } else if ("cyl" in s) {
      const ax = sub(s.to, s.from);
      const u = unit(ax);
      const v = unit(Math.abs(u[0]) < 0.9 ? cross(u, [1, 0, 0]) : cross(u, [0, 1, 0]));
      const w = cross(u, v);
      for (const f of [0, 0.5, 1]) {
        const r = s.cyl + ((s.r2 ?? s.cyl) - s.cyl) * f;
        const o = add(s.from as V3, mul(ax, f));
        pts.push(o);
        for (let q = 0; q < 8; q++) {
          const a = (q * Math.PI) / 4;
          pts.push(add(o, add(mul(v, r * Math.cos(a)), mul(w, r * Math.sin(a)))));
        }
      }
    } else if ("ball" in s) pts.push((s.at ?? [0, 0, 0]) as V3);
  }
  return pts;
}
const ptsCache = new Map<HeldItemSpec, V3[]>();

/** Lồng món vào thân, đầu: điểm mẫu của hình món so với tiết diện thân (elip across/front/back của `markShape`) và cầu đầu; rig */
function bodyDepth(T: any, pts: V3[]): { depth: number; at: string } {
  let S = shapeCache.get(T.c);
  if (!S) shapeCache.set(T.c, (S = markShape(T)));
  const s = T.s;
  const torsoLen = RIG.torso * T.c.rig.height;
  const RsT = tr(T.Rs);
  let best = 0, at = "-";
  const rHead = T.B.head * s;
  for (const p of pts) {
    const l = mul(mv(RsT, sub(p, T.hips)), 100 / s);
    const y = -l[1];
    if (y <= 0 && y >= -torsoLen) {
      const [hw, hd] = S.across(y);
      const hz = l[2] >= 0 ? S.front(y) : hd;
      const r = Math.hypot(l[0] / hw, l[2] / hz);
      if (r < 1) {
        const d = (1 - r) * Math.min(hw, hz);
        if (d > best) [best, at] = [d, "torso"];
      }
    }
    const dh = ((rHead - len(sub(p, T.out.head))) * 100) / s;
    if (dh > best) [best, at] = [dh, "head"];
  }
  return { depth: best, at };
}
const clampsOf = (t: number, b: number, d: number) =>
  (Math.abs(t) >= 90 - 0.05 ? 1 : 0) + (Math.abs(b) >= AIM_BEND - 0.05 ? 1 : 0) + (Math.abs(d) >= AIM_DEV - 0.05 ? 1 : 0);
const armOf = (A: any) => {
  const l1 = len(sub(A.elbow, A.sh)), l2 = len(sub(A.wr, A.elbow));
  return { eps: len(sub(A.wr, A.sh)) / (l1 + l2), beta: angDeg(sub(A.sh, A.elbow), sub(A.wr, A.elbow)) };
};

let solves = 0;
let ITER = 0;
let tSolve = 0;
function solveSample(sp: ActInput, spec: HeldItemSpec, c: Cand, mode: Mode, w: number, lead = -1,
  opt: { elbow?: V3; swivel?: number } = {}): Sample {
  const name = `_cand`;
  const spec2 = specWith(spec, name, c);
  const T0 = trunk3(HOLDER, sp)!;
  const near = T0.near;
  const wk = lead === near ? "near" : "far";
  const H0 = sp.world!.hands!;
  const rw = H0[wk]!;
  const hold = { item: rw.hold!.item, grip: name, spec: spec2, since: rw.hold!.since };
  const aim = rw.aim && {
    terms: rw.aim.terms.map((t) => (t.hold ? { ...t, hold: { ...t.hold, grip: name } } : t)),
  };
  const hands = { ...H0, [wk]: { ...rw, hold, aim, ...(opt.elbow && { elbow: [opt.elbow[0], -opt.elbow[1], -opt.elbow[2]] }) } };
  const e0: V3 = rw.elbow ? [rw.elbow[0], -rw.elbow[1], -rw.elbow[2]] : unit(mv(T0.Rr, [lead * REACH_ELBOW[2], -REACH_ELBOW[1], REACH_ELBOW[0]]));
  const sp2: ActInput = { ...sp, world: { ...sp.world!, hands } };
  G.__J = { ...(mode === "A" ? { fast: true, noSwivel: true, noAlts: true } : mode === "E" ? { noSwivel: lead, noAlts: true } : { noAlts: true }), ...(ITER && { iter: ITER }) };
  const tq = performance.now();
  const T = trunk3(HOLDER, sp2)!;
  const res = solveActing(T, sp2);
  tSolve += performance.now() - tq;
  solves++;
  const inp = res.input;
  const T2 = { ...T, P: inp.pose, W: inp.world! };
  const tag = (x: number) => (x === -1 ? "R" : "L");
  const A = arm3(T2 as any, inp.pose, inp.world!.hands, lead);
  const rep = res.report[tag(lead)];
  const hr = rep.hold as any;
  const k = T.hand ? T.hand.k * T.s : 1, long = T.hand ? T.hand.long * T.s : 1;
  const Gf = gripFrame(spec2, gripHand(spec2.grips[name] as GripSpec, lead), lead, k, long, T.s);
  let pts = ptsCache.get(spec);
  if (!pts) ptsCache.set(spec, (pts = itemPoints(spec)));
  const world = pts.map((q) => add(A.wr, mv(A.Rw, add(mv(Gf.R, mul(q, Gf.u)), Gf.p))));
  const bd = bodyDepth(T2, world);
  const ar = armOf(A);
  const out: Sample = {
    w,
    e: hr?.err ?? 180,
    rho: hr?.hasRoll ? (hr.axisErr?.[1] ?? 0) : 0,
    turn: A.v[0], bend: A.v[1], dev: A.dev,
    clamps: hr?.clamped?.length ?? 0,
    gap: rep.reach?.gap ?? 0,
    ...ar,
    swivel: opt.swivel ?? res.wrist[tag(lead)]?.[3] ?? 0,
    sh: A.sh, wr: A.wr, elbow0: e0,
    depth: bd.depth, depthAt: bd.at,
    W: 2 * HAND_BONES.palm.half[1] * (T.hand?.k ?? 1) * 100,
  };
  if (c.support) {
    const B = arm3(T2 as any, inp.pose, inp.world!.hands, -lead);
    const rs = res.report[tag(-lead)];
    out.sup = { gap: rs.reach?.gap ?? 99, turn: B.v[0], bend: B.v[1], dev: B.dev, clamps: clampsOf(B.v[0], B.v[1], B.dev), ...armOf(B) };
  }
  return out;
}

// ---------- J ----------
const WT = {
  roll: 0.3, turn: 0.5, bend: 1, dev: 0.5, clamp: 1, gap: 1, ext: 1, elbow: 1, swivel: +(process.env.WSWIVEL ?? 1),
  supWrist: 0.5, supArm: 0.5, body: 4, cont: 0.5,
};
type Cost = { total: number; intent: number; wrist: number; arm: number; elbow: number; support: number; body: number; prefer: number };
const cWrist = (t: number, b: number, d: number, n: number) =>
  WT.turn * (t / 90) ** 2 + WT.bend * (b / AIM_BEND) ** 2 + WT.dev * (d / AIM_DEV) ** 2 + WT.clamp * n;
const cExt = (eps: number) => WT.ext * Math.max(0, (eps - 0.92) / 0.08) ** 2;
const cElb = (beta: number) => WT.elbow * Math.max(0, (40 - beta) / 40) ** 2;
function J(samples: Sample[], prefer: number, dTheta = 0): Cost {
  const c: Cost = { total: 0, intent: 0, wrist: 0, arm: 0, elbow: 0, support: 0, body: 0, prefer };
  for (const s of samples) {
    c.intent += s.w * ((s.e / HOLD_ALT) ** 2 + WT.roll * (s.rho / HOLD_ALT) ** 2);
    c.wrist += s.w * cWrist(s.turn, s.bend, s.dev, s.clamps);
    c.arm += s.w * (WT.gap * (s.gap / AIM_GAP) ** 2 + cExt(s.eps));
    c.elbow += s.w * (cElb(s.beta) + WT.swivel * (s.swivel / AIM_SWIVEL) ** 2);
    if (s.sup)
      c.support += s.w * (WT.gap * (s.sup.gap / AIM_GAP) ** 2 + WT.supWrist * cWrist(s.sup.turn, s.sup.bend, s.sup.dev, s.sup.clamps) +
        WT.supArm * (cExt(s.sup.eps) + cElb(s.sup.beta)));
    c.body += s.w * WT.body * (s.depth / s.W) ** 2;
  }
  c.total = c.intent + c.wrist + c.arm + c.elbow + c.support + c.body + WT.cont * (dTheta / 90) ** 2 + prefer;
  for (const k of Object.keys(c) as (keyof Cost)[]) c[k] = +c[k].toFixed(6);
  return c;
}
/** prefer: chỉ lựa chọn liên tục, ≤ 0,05 mỗi lựa chọn: along quanh 0,5 (sheet) / giữa (cylinder), slant quanh 0 */
const preferOf = (c: Cand, slant = 0) =>
  0.05 * Math.min(1, ((c.along - 0.5) / 0.5) ** 2) + (c.slantAxis ? 0.05 * Math.min(1, (slant / 60) ** 2) : 0);

// ---------- một lần chọn ----------
interface Keyed { t: number; w: number; sp: ActInput }
function samplesOf(rt: ReturnType<typeof runtime>, ts: number[]): Keyed[] {
  return ts.map((t, i) => ({ t, w: i ? 0.5 : 1, sp: poseAt(rt, t) }));
}
interface Row { c: Cand; slant: number; cost: Cost; s0: Sample; mode: Mode }
/** Khuỷu tay chính dò theo J của mẫu: lưới 15° trong ±AIM_SWIVEL quanh hướng khuỷu đã khai (trục vai → cổ tay), rồi ±7,5, ±3,75 */
function sampleE(k: Keyed, spec: HeldItemSpec, cs: Cand): Sample {
  const a0 = solveSample(k.sp, spec, cs, "A", k.w);
  const u = unit(sub(a0.wr, a0.sh));
  const at = (a: number) => solveSample(k.sp, spec, cs, "E", k.w, -1, { elbow: spin(a0.elbow0, u, (a * Math.PI) / 180), swivel: a });
  let best = at(0);
  let bj = J([best], 0).total;
  const tryA = (a: number) => {
    if (Math.abs(a) > AIM_SWIVEL + 1e-9) return;
    const s = at(a);
    const j = J([s], 0).total;
    if (j < bj - 1e-9) [best, bj] = [s, j];
  };
  for (let a = -AIM_SWIVEL; a <= AIM_SWIVEL; a += 15) if (a) tryA(a);
  for (const st of [7.5, 3.75]) { const b = best.swivel; tryA(b - st); tryA(b + st); }
  return best;
}
function evalCand(keys: Keyed[], spec: HeldItemSpec, c: Cand, mode: Mode, slant = 0): Row {
  const cs = slanted(c, slant);
  const ss = keys.map((k) => (mode === "E" ? sampleE(k, spec, cs) : solveSample(k.sp, spec, cs, mode, k.w)));
  return { c, slant, cost: J(ss, preferOf(c, slant)), s0: ss[0], mode };
}
/** slant một chiều: chia vàng trên [lo, hi], `n` lần tính J (gồm hai điểm đầu) */
function golden(f: (x: number) => number, lo: number, hi: number, n = 8) {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi;
  let x1 = b - g * (b - a), x2 = a + g * (b - a);
  let f1 = f(x1), f2 = f(x2);
  for (let i = 2; i < n; i++) {
    if (f1 <= f2) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = f(x1); }
    else { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = f(x2); }
  }
  return f1 <= f2 ? { x: x1, f: f1 } : { x: x2, f: f2 };
}
const SLANT_RANGE: Record<string, [number, number]> = { pinch: [-60, 60], flat: [-90, 90], rim: [-45, 45], up: [-60, 60] };
let REFINE: Mode = "B";
function refine(keys: Keyed[], spec: HeldItemSpec, c: Cand, solveSlant: boolean): Row {
  const r0 = evalCand(keys, spec, c, REFINE, 0);
  if (!solveSlant || !c.slantAxis) return r0;
  const [lo, hi] = SLANT_RANGE[c.variant] ?? [-60, 60];
  const cache = new Map<number, Row>();
  const f = (x: number) => { const r = evalCand(keys, spec, c, REFINE, x); cache.set(x, r); return r.cost.total; };
  const best = golden(f, lo, hi, 8);
  const r = cache.get(best.x)!;
  return r.cost.total < r0.cost.total ? r : r0;
}

// ---------- ngưỡng thắng ----------
let WIN = 0.25;
type PrefFn = (c: Cand) => number; // số lựa chọn rời khác ưu tiên
const sheetOff: PrefFn = (c) => (c.thumb !== "front" && c.thumb !== "–" ? 1 : 0) + (c.variant !== "pinch" ? 1 : 0);
/** `up` (lòng tay mở áp mặt tấm) là nhóm `platform`, không phải biến thể của `sheet`: in ra, không dự chọn */
const sheetOnly = (rows: Row[]) => rows.filter((r) => r.c.variant !== "up");
const cylOff: PrefFn = (c) => (c.thumb !== "up" ? 1 : 0);
/** So từng bậc: bậc 0 (mọi lựa chọn rời ở ưu tiên) là chỗ đứng; bậc L chỉ thay khi thắng chỗ đứng ≥ WIN */
function applyWin(rows: Row[], off: PrefFn) {
  const byLevel = new Map<number, Row>();
  for (const r of rows) {
    const L = off(r.c);
    const b = byLevel.get(L);
    if (!b || r.cost.total < b.cost.total - 1e-6) byLevel.set(L, r);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  let cur = byLevel.get(levels[0])!;
  const steps: string[] = [];
  for (const L of levels.slice(1)) {
    const r = byLevel.get(L)!;
    const d = cur.cost.total - r.cost.total;
    steps.push(`bậc ${L}: ${r.c.name} ${r2(r.cost.total, 3)} vs ${cur.c.name} ${r2(cur.cost.total, 3)} → Δ ${r2(d, 3)}`);
    if (d >= WIN) cur = r;
  }
  const best = rows.reduce((a, b) => (b.cost.total < a.cost.total - 1e-6 ? b : a));
  return { win: cur, best, steps };
}

// ---------- in bảng ----------
const md: string[] = [];
const log = (s = "") => { md.push(s); console.log(s); };
function table(title: string, rows: Row[], extra?: (r: Row) => string) {
  log(`\n### ${title}\n`);
  log("| Ứng viên | cạnh | ngón cái | along | slant | J | ý định | cổ tay | tay | khuỷu | tay phụ | thân | prefer | e° | ρ° | turn | bend | dev | kẹp | gap | ε | β° | swivel |" + (extra ? " ghi chú |" : ""));
  log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|" + (extra ? "---|" : ""));
  for (const r of [...rows].sort((a, b) => a.cost.total - b.cost.total)) {
    const s = r.s0, c = r.cost;
    log(`| \`${r.c.name}\` | ${r.c.edge} | ${r.c.thumb} | ${r.c.along} | ${r2(r.slant, 0)} | **${r2(c.total, 3)}** | ${r2(c.intent, 3)} | ${r2(c.wrist, 3)} | ${r2(c.arm, 3)} | ${r2(c.elbow, 3)} | ${r2(c.support, 3)} | ${r2(c.body, 3)} | ${r2(c.prefer, 3)} | ${r2(s.e, 1)} | ${r2(s.rho, 1)} | ${r2(s.turn, 0)} | ${r2(s.bend, 0)} | ${r2(s.dev, 0)} | ${s.clamps}${s.sup ? `/${s.sup.clamps}` : ""} | ${r2(s.gap, 1)}${s.sup ? `/${r2(s.sup.gap, 1)}` : ""} | ${r2(s.eps, 2)} | ${r2(s.beta, 0)} | ${r2(s.swivel, 0)} |` + (extra ? ` ${extra(r)} |` : ""));
  }
}
const supNote = (r: Row) => (r.s0.sup ? `phụ t/b/d ${r2(r.s0.sup.turn, 0)}/${r2(r.s0.sup.bend, 0)}/${r2(r.s0.sup.dev, 0)}, ε ${r2(r.s0.sup.eps, 2)}, β ${r2(r.s0.sup.beta, 0)}` : (r.s0.depth > 0 ? `lún ${r2(r.s0.depth, 1)} (${r.s0.depthAt})` : ""));

// ---------- ca ----------
const RES: Record<string, unknown> = {};
const SHEET_ROLL = { axis: "top", toward: "up" };
const sheetKey = (offset: number[], face: unknown, both = false) => [{
  t: 0,
  right: { to: "chest", offset, point: "grip", hold: { item: "bang-gia", grip: both ? "doc" : "doc", face, roll: SHEET_ROLL } },
}];
const CASES = {
  A: { title: "A — đọc trước ngực, offset spec [30, 10, 15] (`face: front → holderFace`)", hands: sheetKey([30, 10, 15], { axis: "front", toward: "holderFace" }), expect: "front", two: false },
  A2: { title: "A2 — đọc, tay hạ ngang bụng trên, offset [30, 50, 15]", hands: sheetKey([30, 50, 15], { axis: "front", toward: "holderFace" }), expect: "front", two: false },
  B: { title: "B — giơ một tay cho người trước mặt (`face: front → {cast: khach}`)", hands: sheetKey([45, 30, 25], { axis: "front", toward: { cast: "khach" } }), expect: "back", two: false },
  C: { title: "C — giơ hai tay cho người trước mặt", hands: sheetKey([45, 30, 10], { axis: "front", toward: { cast: "khach" } }, true), expect: "back", two: true },
};

function runSheetCase(id: keyof typeof CASES, cands: Cand[], solveSlant: boolean) {
  const K = CASES[id];
  const rt = runtime(K.hands);
  const keys = samplesOf(rt, [0]);
  const list = K.two ? cands.flatMap((c) => [withSupport(c, "opp"), withSupport(c, "sym")]) : cands;
  const rows = list.map((c) => refine(keys, BG, c, solveSlant));
  return { rows, keys, K };
}

const oldC = oldSheetCands();
if (process.env.EXPLORE) {
  // quét chỗ đặt tay: ngón cái trước tốt nhất vs sau tốt nhất trong các kiểu pinch (doc, khoe và biến thể), bước B, slant cố định
  const pinch = oldC.filter((c) => c.variant === "pinch");
  log("| Ca | offset chest | front tốt nhất | J | cổ tay | back tốt nhất | J | cổ tay | rẻ hơn |");
  log("|---|---|---|---|---|---|---|---|---|");
  const t0 = performance.now();
  const faces = { A: { axis: "front", toward: "holderFace" }, B: { axis: "front", toward: { cast: "khach" } } };
  for (const id of ["A", "B"] as const)
    for (const fwd of [25, 45])
      for (const dn of [-20, 10, 40, 70])
        for (const out of [0, 25]) {
          const keys = samplesOf(runtime(sheetKey([fwd, dn, out], faces[id])), [0]);
          const rows = pinch.map((c) => evalCand(keys, BG, c, "B"));
          const bf = rows.filter((r) => r.c.thumb === "front").sort((a, b) => a.cost.total - b.cost.total)[0];
          const bb = rows.filter((r) => r.c.thumb === "back").sort((a, b) => a.cost.total - b.cost.total)[0];
          log(`| ${id} | [${fwd}, ${dn}, ${out}] | \`${bf.c.name}\` | ${r2(bf.cost.total, 2)} | ${r2(bf.cost.wrist, 2)} (${r2(bf.s0.turn, 0)}/${r2(bf.s0.bend, 0)}/${r2(bf.s0.dev, 0)}) | \`${bb.c.name}\` | ${r2(bb.cost.total, 2)} | ${r2(bb.cost.wrist, 2)} (${r2(bb.s0.turn, 0)}/${r2(bb.s0.bend, 0)}/${r2(bb.s0.dev, 0)}) | ${bf.cost.total <= bb.cost.total ? "front" : "back"} |`);
        }
  console.error(`explore ${r2(performance.now() - t0, 0)} ms, ${solves} lần giải`);
  fs.writeFileSync(`${OUT}j-explore.md`, md.join("\n"));
  process.exit(0);
}
if (process.env.D_POINT) {
  // ca D với mốc neo khác (`item:mouth`), khuỷu dò theo J
  for (const item of ["chai-dia", "chai-dac-tuyen"]) {
    const spec = HELD[item];
    const cands = bottleCands(spec);
    const line: string[] = [];
    for (const fwd of (process.env.D_FWD ?? "40,60,80,100,120,140").split(",").map(Number)) {
      const rt = runtime([{ t: 0, right: { to: "chest", offset: [fwd, 40, 20], point: process.env.D_POINT,
        hold: { item, grip: "rot-than", face: { axis: "mouth", toward: [1, 0, 0.58], tilt: -25 } } } }]);
      const keys = samplesOf(rt, [0]);
      const rows = cands.map((c) => evalCand(keys, spec, c, "E"));
      const w = applyWin(rows, cylOff).win;
      const J0 = (n: string) => { const r = rows.find((r) => r.c.name === n)!; return `${r2(r.cost.total, 2)} (ε ${r2(r.s0.eps, 2)}, β ${r2(r.s0.beta, 0)}, gap ${r2(r.s0.gap, 0)})`; };
      line.push(`| ${item} | ${fwd} | **${w.c.name}** | ${J0("co")} | ${J0("rot")} | ${J0("rot-than")} | ${J0("bung")} |`);
    }
    for (const l of line) console.log(l);
  }
  process.exit(0);
}
if (process.env.DEBUG_D) {
  for (const [item, fwd] of [["chai-dac-tuyen", 10], ["chai-dac-tuyen", 40], ["chai-dia", 10], ["chai-dia", 60]] as const) {
    const spec = HELD[item];
    const rt = runtime([{ t: 0, right: { to: "chest", offset: [fwd, 40, 20], point: "item:base",
      hold: { item, grip: "rot-than", face: { axis: "mouth", toward: [1, 0, 0.58], tilt: -25 } } } }]);
    const keys = samplesOf(rt, [0]);
    for (const c of bottleCands(spec).filter((c) => c.name === "co" || c.name === "rot-than"))
      for (const it of [8, 16, 32, 64]) {
        ITER = it;
        const r = evalCand(keys, spec, c, "B");
        console.log(item, fwd, c.name, "iter", it, "J", r2(r.cost.total), "gap", r2(r.s0.gap, 1), "eps", r2(r.s0.eps), "beta", r2(r.s0.beta, 0), "e", r2(r.s0.e, 1), "tbd", r2(r.s0.turn, 0), r2(r.s0.bend, 0), r2(r.s0.dev, 0));
      }
  }
  ITER = 0;
  process.exit(0);
}
console.error("ca A–C, ứng viên từ kiểu cũ");
const SUMMARY: string[] = [];
const winLabel = (r: Row) => `\`${r.c.name}\`${r.c.slantAxis ? ` s${r2(r.slant, 0)}` : ""} (${r.c.thumb}${r.c.support ? "/" + sheetLabels(r.c.support, 1).thumb : ""})`;
for (const id of (process.env.QUICK ? ["A"] : ["A", "A2", "B", "C"]) as (keyof typeof CASES)[]) {
  const K = CASES[id];
  const out: Record<string, unknown> = {};
  for (const mode of ["B", "E"] as const)
    for (const solveSlant of [false, true]) {
      REFINE = mode;
      const run = runSheetCase(id, oldC, solveSlant);
      const tagM = `${mode === "B" ? "khuỷu act3" : "khuỷu dò theo J"}, slant ${solveSlant ? "giải (chia vàng 8)" : "cố định"}`;
      if ((mode === "B" && !solveSlant) || (mode === "E" && solveSlant)) table(`${K.title} — ${tagM}`, run.rows, supNote);
      const wins = [0.2, 0.25, 0.3].map((w) => { WIN = w; return applyWin(sheetOnly(run.rows), sheetOff); });
      WIN = 0.25;
      const w = wins[1];
      if ((mode === "B" && !solveSlant) || (mode === "E" && solveSlant))
        log(`\nThắng (WIN 0,25): ${winLabel(w.win)}; tốt nhất chung ${winLabel(w.best)}; kỳ vọng ${K.expect}. ${w.steps.join("; ")}`);
      SUMMARY.push(`| ${id} | ${mode} | ${solveSlant ? "giải" : "0"} | ${K.expect} | ${wins.map((x) => winLabel(x.win)).join(" | ")} | ${r2(w.win.cost.total, 3)} | ${w.steps.map((x) => x.replace(/^.*Δ /, "Δ ")).join(", ")} |`);
      out[`${mode}-${solveSlant ? "slant" : "fixed"}`] = {
        rows: run.rows.map((r) => ({ name: r.c.name, thumb: r.c.thumb, edge: r.c.edge, slant: r.slant, cost: r.cost, s: { ...r.s0, sh: undefined, wr: undefined, elbow0: undefined } })),
        win: wins.map((x, i) => ({ WIN: [0.2, 0.25, 0.3][i], win: x.win.c.name, slant: x.win.slant, steps: x.steps })),
      };
      console.error(id, mode, solveSlant, w.win.c.name, solves);
    }
  RES[`sheet-${id}`] = out;
}
REFINE = "B";
log("\n### Tóm tắt ca A–C (kiểu cũ)\n");
log("| Ca | khuỷu | slant | kỳ vọng | thắng WIN 0,2 | WIN 0,25 | WIN 0,3 | J thắng | Δ các bậc (0,25) |");
log("|---|---|---|---|---|---|---|---|---|");
for (const l of SUMMARY) log(l);

if (process.env.QUICK || process.env.CASES_ONLY) {
  if (process.env.CASES_ONLY) fs.writeFileSync(`${OUT}${process.env.CASES_ONLY}.json`, JSON.stringify(RES, null, 1));
  console.log("QUICK"); process.exit(0);
}
// ---------- lưới kiểu spec + đo giờ ----------
console.error("lưới 72, đo giờ");
const grid = gridSheetCands();
function holdRun(id: keyof typeof CASES, nKeys: number, solveSlant: boolean, mode: Mode = "B") {
  REFINE = mode;
  const K = CASES[id];
  const rt = runtime(K.hands);
  const keys = samplesOf(rt, [0, 0.5, 1, 1.5].slice(0, nKeys));
  const list = K.two ? grid.flatMap((c) => [withSupport(c, "opp"), withSupport(c, "sym")]) : grid;
  const s0 = solves;
  const t0 = performance.now();
  const A = list.map((c) => evalCand(keys, BG, c, "A"));
  const tA = performance.now() - t0;
  const nA = solves - s0;
  // bước B: 8 tổ hợp rời tốt nhất sau A (ứng viên tốt nhất mỗi tổ hợp), luôn kèm tổ hợp ưu tiên tốt nhất
  const combo = (c: Cand) => `${c.edge}/${c.thumb}/${c.variant}${c.support ? "/" + c.name.split("+")[1] : ""}`;
  const best = new Map<string, Row>();
  for (const r of A) { const k = combo(r.c); const b = best.get(k); if (!b || r.cost.total < b.cost.total) best.set(k, r); }
  const ranked = [...best.values()].sort((a, b) => a.cost.total - b.cost.total);
  const pick = ranked.slice(0, 8);
  const pref = ranked.find((r) => sheetOff(r.c) === 0);
  if (pref && !pick.includes(pref)) pick.push(pref);
  const s1 = solves;
  const t1 = performance.now();
  const B = pick.map((r) => refine(keys, BG, r.c, solveSlant));
  const tB = performance.now() - t1;
  const nB = solves - s1;
  WIN = 0.3;
  const win30 = applyWin(B, sheetOff);
  WIN = 0.25;
  REFINE = "B";
  return { A, B, tA, tB, nA, nB, nCand: list.length, nKeys, win: applyWin(B, sheetOff), win30 };
}
/** slant thô ở bước A ({−⅔, 0, +⅔} miền biến thể), bước B ở slant thô tốt nhất, không chia vàng */
function holdRunCoarse(id: keyof typeof CASES, nKeys: number, mode: Mode) {
  const K = CASES[id];
  const keys = samplesOf(runtime(K.hands), [0, 0.5, 1, 1.5].slice(0, nKeys));
  const list = K.two ? grid.flatMap((c) => [withSupport(c, "opp"), withSupport(c, "sym")]) : grid;
  const t0 = performance.now();
  const A: Row[] = [];
  for (const c of list) {
    const [lo, hi] = SLANT_RANGE[c.variant];
    let best: Row | undefined;
    for (const x of [lo * (2 / 3), 0, hi * (2 / 3)]) {
      const r = evalCand(keys, BG, c, "A", x);
      if (!best || r.cost.total < best.cost.total) best = r;
    }
    A.push(best!);
  }
  const tA = performance.now() - t0;
  const combo = (c: Cand) => `${c.edge}/${c.thumb}/${c.variant}${c.support ? "/" + c.name.split("+")[1] : ""}`;
  const bestC = new Map<string, Row>();
  for (const r of A) { const k = combo(r.c); const b = bestC.get(k); if (!b || r.cost.total < b.cost.total) bestC.set(k, r); }
  const ranked = [...bestC.values()].sort((a, b) => a.cost.total - b.cost.total);
  const pick = ranked.slice(0, 8);
  const pref = ranked.find((r) => sheetOff(r.c) === 0);
  if (pref && !pick.includes(pref)) pick.push(pref);
  const t1 = performance.now();
  const B = pick.map((r) => evalCand(keys, BG, r.c, mode, r.slant));
  const tB = performance.now() - t1;
  const add = [...B].map((r) => ({ r, Jp: r.cost.total + 0.25 * sheetOff(r.c) })).sort((a, b) => a.Jp - b.Jp)[0];
  return { tA, tB, win: applyWin(B, sheetOff).win, add: add.r, addJ: add.Jp };
}
if (process.env.COARSE) {
  log("| Ca | khuỷu B | thắng bậc 0,25 | slant | J | thắng cộng 0,25 | slant | J + phạt | ms A | ms B | ms tổng |");
  log("|---|---|---|---|---|---|---|---|---|---|---|");
  holdRunCoarse("A", 1, "B");
  for (const mode of ["B", "E"] as const)
    for (const id of ["A", "A2", "B", "C"] as const) {
      const r = holdRunCoarse(id, 4, mode);
      log(`| ${id} | ${mode === "B" ? "act3" : "theo J"} | \`${r.win.c.name}\` | ${r2(r.win.slant, 0)} | ${r2(r.win.cost.total, 2)} | \`${r.add.c.name}\` | ${r2(r.add.slant, 0)} | ${r2(r.addJ, 2)} | ${r2(r.tA, 0)} | ${r2(r.tB, 0)} | ${r2(r.tA + r.tB, 0)} |`);
    }
  fs.writeFileSync(`${OUT}j-coarse.md`, md.join("\n"));
  process.exit(0);
}
// khởi động JIT
holdRun("A", 1, false);
const timing: Record<string, unknown> = {};
for (const mode of ["B", "E"] as const)
for (const id of ["A", "A2", "B", "C"] as const)
  for (const solveSlant of [false, true]) {
    const r = holdRun(id, 4, solveSlant, mode);
    const key = `${id}-${mode}-${solveSlant ? "slant" : "fixed"}`;
    timing[key] = {
      cand: r.nCand, keys: r.nKeys, solvesA: r.nA, solvesB: r.nB,
      msA: r2(r.tA, 1), msB: r2(r.tB, 1), msTotal: r2(r.tA + r.tB, 1),
      usPerSolveA: r2((1000 * r.tA) / r.nA, 1), usPerSolveB: r2((1000 * r.tB) / r.nB, 1),
      win: r.win.win.c.name, winSlant: r2(r.win.win.slant, 0), winJ: r.win.win.cost.total, best: r.win.best.c.name, bestJ: r.win.best.cost.total,
      win30: r.win30.win.c.name, win30Slant: r2(r.win30.win.slant, 0),
      steps: r.win.steps,
      topB: [...r.B].sort((a, b) => a.cost.total - b.cost.total).slice(0, 5).map((x) => ({ name: x.c.name, slant: r2(x.slant, 0), J: x.cost.total, cost: x.cost })),
    };
    console.error(key, JSON.stringify(timing[key]).slice(0, 300));
  }
RES.timing = timing;
log("\n### Lưới kiểu spec (72 / 144 ứng viên, 4 mẫu): giờ và người thắng\n");
log("| Ca | khuỷu B | slant | ứng viên | lần giải A | ms A | µs/lần A | lần giải B | ms B | µs/lần B | ms tổng | thắng WIN 0,25 | J | thắng WIN 0,3 | tốt nhất chung | J |");
log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const [k, v] of Object.entries(timing) as [string, any][]) {
  const [id, mode, sl] = k.split("-");
  log(`| ${id} | ${mode} | ${sl} | ${v.cand} | ${v.solvesA} | ${v.msA} | ${v.usPerSolveA} | ${v.solvesB} | ${v.msB} | ${v.usPerSolveB} | ${v.msTotal} | \`${v.win}\` ${v.winSlant} | ${r2(v.winJ, 3)} | \`${v.win30}\` ${v.win30Slant} | \`${v.best}\` | ${r2(v.bestJ, 3)} |`);
}

// ---------- D: chai rót, neo `item:base` ----------
console.error("ca D");
const dRows: Record<string, unknown> = {};
for (const mode of ["B", "E"] as const)
for (const item of ["chai-dia", "chai-dac-tuyen"]) {
  const spec = HELD[item];
  const cands = bottleCands(spec);
  const sweep: { fwd: number; rows: Row[] }[] = [];
  for (const fwd of [0, 10, 20, 30, 40, 50, 60, 70, 80]) {
    const rt = runtime([{ t: 0, right: { to: "chest", offset: [fwd, 40, 20], point: "item:base",
      hold: { item, grip: "rot-than", face: { axis: "mouth", toward: [1, 0, 0.58], tilt: -25 } } } }]);
    const keys = samplesOf(rt, [0]);
    sweep.push({ fwd, rows: cands.map((c) => evalCand(keys, spec, c, mode)) });
  }
  if (mode === "E" && item === "chai-dia")
    for (const fwd of [10, 40, 70]) table(`D — \`${item}\` rót, neo \`item:base\` ở chest + [${fwd}, 40, 20], khuỷu dò theo J`, sweep.find((s) => s.fwd === fwd)!.rows, supNote);
  log(`\nQuét \`${item}\`, khuỷu ${mode} (offset tiến: thắng; J co / rot / rot-than / bung): ` + sweep.map((s) => {
    const w = applyWin(s.rows, cylOff).win;
    const J0 = (n: string) => r2(s.rows.find((r) => r.c.name === n)!.cost.total, 2);
    return `${s.fwd}: **${w.c.name}** (${J0("co")} / ${J0("rot")} / ${J0("rot-than")} / ${J0("bung")})`;
  }).join("; "));
  dRows[`${item}-${mode}`] = sweep.map((s) => ({ fwd: s.fwd, rows: s.rows.map((r) => ({ name: r.c.name, along: r.c.along, thumb: r.c.thumb, cost: r.cost, s: { ...r.s0, sh: undefined, wr: undefined, elbow0: undefined } })) }));
}
RES.D = dRows;

// ---------- đo µs: bước A, B một ứng viên một mẫu ----------
{
  const rt = runtime(CASES.B.hands);
  const sp = poseAt(rt, 0);
  const c = oldC[0];
  const solveOnly: Record<string, number> = {};
  const time = (mode: Mode, n: number) => {
    for (let i = 0; i < 20; i++) solveSample(sp, BG, c, mode, 1);
    const t = performance.now();
    const q = tSolve;
    for (let i = 0; i < n; i++) solveSample(sp, BG, c, mode, 1);
    solveOnly[mode] = (1000 * (tSolve - q)) / n;
    return (1000 * (performance.now() - t)) / n;
  };
  const tA = time("A", 400), tB = time("B", 100);
  RES.usSolveOnly = { A: r2(solveOnly.A, 1), B: r2(solveOnly.B, 1) };
  log(`\nµs riêng trunk3 + solveActing (một tay): A ${r2(solveOnly.A, 0)}, B ${r2(solveOnly.B, 0)}`);
  const two = withSupport(c, "opp");
  const rt2 = runtime(CASES.C.hands);
  const sp2 = poseAt(rt2, 0);
  const t2 = (mode: Mode, n: number) => {
    for (let i = 0; i < 10; i++) solveSample(sp2, BG, two, mode, 1);
    const t = performance.now();
    for (let i = 0; i < n; i++) solveSample(sp2, BG, two, mode, 1);
    return (1000 * (performance.now() - t)) / n;
  };
  const tA2 = t2("A", 200), tB2 = t2("B", 60);
  RES.us = { oneHand: { A: r2(tA, 1), B: r2(tB, 1) }, twoHands: { A: r2(tA2, 1), B: r2(tB2, 1) } };
  log(`\nµs mỗi ứng viên mỗi mẫu (solveActing + đo): một tay A ${r2(tA, 0)}, B ${r2(tB, 0)}; hai tay A ${r2(tA2, 0)}, B ${r2(tB2, 0)}`);
}

RES.weights = WT;
RES.WIN = WIN;
fs.writeFileSync(`${OUT}${process.env.OUTNAME ?? "j-cost"}.json`, JSON.stringify(RES, null, 1));
fs.writeFileSync(`${OUT}${process.env.OUTNAME ?? "j-cost"}.log.md`, md.join("\n"));
console.error("xong");
