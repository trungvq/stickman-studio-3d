// Ô của bảng ảnh bước 0: dựng lại ứng viên của do-b (j-cost.mts, trọng bản cuối WSWIVEL=0), tìm khuỷu theo J, rồi
// giải lại đúng cảnh sẽ vẽ (khuỷu khai trong `world.hands[].elbow`, hay bỏ trống) bằng đường act3 thật để đo cổ tay.
// Chạy: node tmp/buoc0/j-run.mjs tmp/buoc0/hinh/cands.mts  → tmp/buoc0/hinh/cells.json
import fs from "node:fs";
import { solveActing, trunk3, arm3, AIM_BEND, AIM_DEV, AIM_SWIVEL, HOLD_ALT, type ActInput } from "../../../packages/rig/src/core/act3";
import { AIM_GAP } from "../../../packages/rig/src/core/palm";
import { parseScene, resolveScene, sceneAt } from "../../../packages/rig/src/core/scene";
import { parseCharacter } from "../../../packages/rig/src/core/schema";
import { parseAction } from "../../../packages/rig/src/core/action";
import { body3 } from "../../../packages/rig/src/core/figure3d";
import { REACH_ELBOW } from "../../../packages/rig/src/core/ik";
import { gripAxes, gripHand, parseHeldItem, type GripSpec, type GripHand, type HeldItemSpec } from "../../../packages/rig/src/core/heldItem";
import { matVec as mv, type V3 } from "../../../packages/rig/src/core/lens";

const VIDEO = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto";
const STUDIO = "/home/trungvq/Work/Dev/stickman-studio-3d";
const OUT = new URL("./", import.meta.url).pathname;
const readJ = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const G = globalThis as any;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const angDeg = (a: V3, b: V3) => (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;
const spin = (v: V3, u: V3, a: number): V3 => {
  const c = Math.cos(a), s = Math.sin(a);
  return add(add(mul(v, c), mul(cross(u, v), s)), mul(u, dot(u, v) * (1 - c)));
};
const r2 = (x: number, n = 2) => +x.toFixed(n);

const char = (f: string) => { const r = parseCharacter(readJ(`${VIDEO}/characters/${f}.json`)); if (!r.success) throw new Error(f); return r.data; };
const held = (n: string): HeldItemSpec => { const r = parseHeldItem(readJ(`${VIDEO}/held/${n}.json`)); if (!r.success) throw new Error(n); return r.data; };
const STAND = parseAction(readJ(`${STUDIO}/apps/studio/public/actions/stand-3d.json`));
if (!STAND.success) throw new Error("stand-3d");
const HOLDER = char("yota");
const OTHER = char("takumi");
const RAW: Record<string, any> = { "bang-gia": readJ(`${VIDEO}/held/bang-gia.json`), "chai-dia": readJ(`${VIDEO}/held/chai-dia.json`) };
const HELD: Record<string, HeldItemSpec> = { "bang-gia": held("bang-gia"), "chai-dia": held("chai-dia") };

// chỗ đứng: do-b dùng [250,0,790] / [250,0,445] (sau quầy sảnh); ảnh dựng ở khoảng trống của sảnh, dời đều cả hai
const AT = (process.env.AT ?? "-95,0,300").split(",").map(Number) as V3;
const AT2: V3 = [AT[0], 0, AT[2] - 345];

function sceneJson(hands: unknown[]) {
  return {
    name: "bang-cam",
    frame: "wide",
    duration: 1,
    camera: [{ t: 0, x: 0, y: 0, zoom: 1 }],
    lens: { eye: [AT[0], -330, AT[2] - 720], yaw: 0, pitch: 4, f: 560, cx: 0, cy: 0 },
    cast: [
      { id: "yota", character: "yota.json", world: { at: AT, yaw: 90, hands }, tracks: [{ name: "than", clips: [{ start: 0, action: "stand-3d" }] }] },
      { id: "khach", character: "takumi.json", world: { at: AT2, yaw: 270 }, tracks: [{ name: "than", clips: [{ start: 0, action: "stand-3d" }] }] },
    ],
  };
}
function runtime(hands: unknown[], heldMap = HELD) {
  const r = parseScene(sceneJson(hands));
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(r.data, { "stand-3d": STAND.data! }, {}, {}, { yota: HOLDER.rig.height, khach: OTHER.rig.height }, { yota: body3(HOLDER), khach: body3(OTHER) }, heldMap);
}
const poseAt = (rt: ReturnType<typeof runtime>, t: number) => sceneAt(rt, "yota", t, HOLDER.rig.height, body3(HOLDER)) as unknown as ActInput;

// ---------- ứng viên (như j-cost.mts) ----------
interface Link { pose: GripHand["pose"]; at: V3; palm: V3; fingers: V3; wrap?: GripHand["wrap"] }
const linkOf = (spec: HeldItemSpec, h: GripHand): Link => { const a = gripAxes(spec, h); return { pose: h.pose, at: a.at, palm: a.palm, fingers: a.fingers, ...(h.wrap && { wrap: h.wrap }) }; };
const rotLink = (L: Link, u: V3, c: V3, a: number): Link => ({ ...L, at: add(c, spin(sub(L.at, c), u, a)), palm: spin(L.palm, u, a), fingers: spin(L.fingers, u, a) });
const BG = HELD["bang-gia"];
const BG_C: V3 = [0, 0.6, 0];
const BG_F: V3 = [0, 1, 0];
const BG_EDGES: Record<string, { m: V3; e: V3; c: V3; L: number }> = {
  edgeR: { m: [1, 0, 0], e: [0, 0, -1], c: [22, 0.6, 0], L: 58 },
  edgeL: { m: [-1, 0, 0], e: [0, 0, -1], c: [-22, 0.6, 0], L: 58 },
  top: { m: [0, 0, -1], e: [1, 0, 0], c: [0, 0.6, -29], L: 44 },
  bottom: { m: [0, 0, 1], e: [1, 0, 0], c: [0, 0.6, 29], L: 44 },
};
function edgeOf(L: Link) {
  let edge = "face", best = 4.5;
  for (const [k, E] of Object.entries(BG_EDGES)) {
    const inset = -dot(sub(L.at, E.c), E.m);
    if (inset > -1 && inset < best && Math.abs(dot(sub(L.at, E.c), E.e)) <= E.L / 2) { best = inset; edge = k; }
  }
  return edge;
}
/** `doc`, `khoe` × {gốc, ~opp} × {gốc, ~flip}, tay phải */
function sheetCand(name: string): Link {
  const side = -1;
  const [g, ...tags] = name.split("~");
  let L = linkOf(BG, gripHand(BG.grips[g] as GripSpec, side));
  if (tags.includes("opp")) L = rotLink(L, BG_F, BG_C, Math.PI);
  if (tags.includes("flip")) {
    const m = BG_EDGES[edgeOf(L)]?.m ?? unit(L.fingers);
    L = rotLink(L, m, [L.at[0], 0.6, L.at[2]], Math.PI);
  }
  return L;
}
const bottleCand = (g: string): Link => linkOf(HELD["chai-dia"], gripHand(HELD["chai-dia"].grips[g] as GripSpec, -1));

/** Liên kết số thành kiểu cầm v1 trong file món: neo có sẵn (`center` / `base`), ý định chép từ kiểu cảnh khai */
function gripJson(item: string, L: Link) {
  const anchor = item === "bang-gia" ? "center" : "base";
  const base = RAW[item].anchors[anchor].at as V3;
  const intentFrom = item === "bang-gia" ? "doc" : "rot-than";
  const r6 = (v: readonly number[]) => v.map((x) => +x.toFixed(6));
  return {
    pose: L.pose,
    at: { anchor, offset: r6(sub(L.at, base)) },
    palm: r6(L.palm),
    fingers: r6(L.fingers),
    ...(L.wrap && { wrap: L.wrap }),
    touch: ["self.hand"],
    intent: RAW[item].grips[intentFrom].intent,
  };
}
function specWith(item: string, gname: string, L: Link): HeldItemSpec {
  const raw = { ...RAW[item], grips: { ...RAW[item].grips, [gname]: gripJson(item, L) } };
  const r = parseHeldItem(raw);
  if (!r.success) throw new Error(`${item}#${gname}: ${r.error.message}`);
  const got = gripAxes(r.data, gripHand(r.data.grips[gname] as GripSpec, -1));
  if (len(sub(got.at, L.at)) > 1e-3 || len(sub(got.palm, L.palm)) > 1e-3 || len(sub(got.fingers, L.fingers)) > 1e-3)
    throw new Error(`${gname}: kiểu cầm v1 không ra lại liên kết`);
  return r.data;
}

// ---------- giải, đo, J (như j-cost.mts, WSWIVEL = 0) ----------
type Mode = "A" | "B" | "E" | "real";
interface Sample { e: number; rho: number; turn: number; bend: number; dev: number; clamps: number; clamped: string[]; gap: number; eps: number; beta: number; swivel: number; sh: V3; wr: V3; elbow0: V3; elbowUsed?: V3 }
const armOf = (A: any) => {
  const l1 = len(sub(A.elbow, A.sh)), l2 = len(sub(A.wr, A.elbow));
  return { eps: len(sub(A.wr, A.sh)) / (l1 + l2), beta: angDeg(sub(A.sh, A.elbow), sub(A.wr, A.elbow)) };
};
/** `sp` là tư thế của cảnh đã khai đúng kiểu cầm (`gname`); `opt.elbow` (hệ three) đè khuỷu tay chính như j-cost chế độ E */
function solve(sp: ActInput, mode: Mode, opt: { elbow?: V3; swivel?: number } = {}): Sample & { elbowRig?: V3 } {
  const lead = -1;
  const T0 = trunk3(HOLDER, sp)!;
  const wk = lead === T0.near ? "near" : "far";
  const H0 = sp.world!.hands!;
  const rw = H0[wk]!;
  const elbowRig = opt.elbow && ([opt.elbow[0], -opt.elbow[1], -opt.elbow[2]] as V3);
  const hands = { ...H0, [wk]: { ...rw, ...(elbowRig && { elbow: elbowRig }) } };
  const e0: V3 = rw.elbow ? [rw.elbow[0], -rw.elbow[1], -rw.elbow[2]] : unit(mv(T0.Rr, [lead * REACH_ELBOW[2], -REACH_ELBOW[1], REACH_ELBOW[0]]));
  const sp2: ActInput = { ...sp, world: { ...sp.world!, hands } };
  G.__J = mode === "A" ? { fast: true, noSwivel: true, noAlts: true } : mode === "E" ? { noSwivel: lead, noAlts: true } : mode === "B" ? { noAlts: true } : undefined;
  const T = trunk3(HOLDER, sp2)!;
  const res = solveActing(T, sp2);
  G.__J = undefined;
  const inp = res.input;
  const A = arm3({ ...T, P: inp.pose, W: inp.world! } as any, inp.pose, inp.world!.hands, lead);
  const rep = res.report.R;
  const hr = rep.hold as any;
  const outHand = inp.world!.hands![wk] as any;
  return {
    e: hr?.err ?? 180,
    rho: hr?.hasRoll ? (hr.axisErr?.[1] ?? 0) : 0,
    turn: A.v[0], bend: A.v[1], dev: A.dev,
    clamps: hr?.clamped?.length ?? 0, clamped: hr?.clamped ?? [],
    gap: rep.reach?.gap ?? 0,
    ...armOf(A),
    swivel: opt.swivel ?? res.wrist.R?.[3] ?? 0,
    sh: A.sh, wr: A.wr, elbow0: e0,
    elbowUsed: outHand?.elbow,
    ...(elbowRig && { elbowRig }),
  };
}
const WT = { roll: 0.3, turn: 0.5, bend: 1, dev: 0.5, clamp: 1, gap: 1, ext: 1, elbow: 1, swivel: 0, body: 4 };
const cWrist = (t: number, b: number, d: number, n: number) => WT.turn * (t / 90) ** 2 + WT.bend * (b / AIM_BEND) ** 2 + WT.dev * (d / AIM_DEV) ** 2 + WT.clamp * n;
const cExt = (eps: number) => WT.ext * Math.max(0, (eps - 0.92) / 0.08) ** 2;
const cElb = (beta: number) => WT.elbow * Math.max(0, (40 - beta) / 40) ** 2;
/** J không có số hạng thân (do-b: thân 0 ở mọi ô vẽ ở đây) và prefer theo along */
function J(s: Sample, prefer: number) {
  const intent = (s.e / HOLD_ALT) ** 2 + WT.roll * (s.rho / HOLD_ALT) ** 2;
  const wrist = cWrist(s.turn, s.bend, s.dev, s.clamps);
  const arm = WT.gap * (s.gap / AIM_GAP) ** 2 + cExt(s.eps);
  const elbow = cElb(s.beta) + WT.swivel * (s.swivel / AIM_SWIVEL) ** 2;
  return { total: intent + wrist + arm + elbow + prefer, intent, wrist, arm, elbow, prefer };
}
/** Khuỷu tay chính dò theo J: lưới 15° trong ±90 quanh hướng khuỷu mặc định, rồi ±7,5, ±3,75 */
function sampleE(sp: ActInput, prefer: number) {
  const a0 = solve(sp, "A");
  const u = unit(sub(a0.wr, a0.sh));
  const at = (a: number) => ({ ...solve(sp, "E", { elbow: spin(a0.elbow0, u, (a * Math.PI) / 180), swivel: a }), a });
  let best = at(0);
  let bj = J(best, prefer).total;
  const tryA = (a: number) => {
    if (Math.abs(a) > AIM_SWIVEL + 1e-9) return;
    const s = at(a);
    const j = J(s, prefer).total;
    if (j < bj - 1e-9) [best, bj] = [s, j];
  };
  for (let a = -AIM_SWIVEL; a <= AIM_SWIVEL; a += 15) if (a) tryA(a);
  for (const st of [7.5, 3.75]) { const b = best.swivel; tryA(b - st); tryA(b + st); }
  return best;
}

// ---------- ô ----------
const SHEET_ROLL = { axis: "top", toward: "up" };
const BOTTLE_FACE = { axis: "mouth", toward: [1, 0, 0.58], tilt: -25 };
interface CellDef { sheet: string; key: string; item: string; cand: string; grip: string; mode: "act3" | "J"; hand: Record<string, unknown>; prefer: number; label: string }
const sheetHand = (offset: number[], face: unknown, grip: string) => ({ to: "chest", offset, point: "grip", hold: { item: "bang-gia", grip, face, roll: SHEET_ROLL } });
const bottleHand = (fwd: number, grip: string) => ({ to: "chest", offset: [fwd, 40, 20], point: "item:base", hold: { item: "chai-dia", grip, face: BOTTLE_FACE } });
const gname = (c: string) => `_b0-${c.replace(/~/g, "-")}`;
// prefer: 0,05·((along − 0,5)/0,5)² (bảng giá: along của do-b; chai: at.y / cao)
const preferAlong = (along: number) => 0.05 * Math.min(1, ((along - 0.5) / 0.5) ** 2);
const DEFS: CellDef[] = [
  { sheet: "bang-gia", key: "A-doc-act3", item: "bang-gia", cand: "doc", grip: gname("doc"), mode: "act3", hand: sheetHand([30, 10, 15], { axis: "front", toward: "holderFace" }, gname("doc")), prefer: 0, label: "A (a) doc · ngón cái trước · khuỷu act3" },
  { sheet: "bang-gia", key: "A-doc-J", item: "bang-gia", cand: "doc", grip: gname("doc"), mode: "J", hand: sheetHand([30, 10, 15], { axis: "front", toward: "holderFace" }, gname("doc")), prefer: 0, label: "A (b) doc · ngón cái trước · khuỷu theo J" },
  { sheet: "bang-gia", key: "A-docflip-J", item: "bang-gia", cand: "doc~flip", grip: gname("doc~flip"), mode: "J", hand: sheetHand([30, 10, 15], { axis: "front", toward: "holderFace" }, gname("doc~flip")), prefer: 0, label: "A (c) doc~flip · ngón cái sau · khuỷu theo J" },
  { sheet: "bang-gia", key: "B-khoeflip-J", item: "bang-gia", cand: "khoe~flip", grip: gname("khoe~flip"), mode: "J", hand: sheetHand([45, 30, 25], { axis: "front", toward: { cast: "khach" } }, gname("khoe~flip")), prefer: 0, label: "B khoe~flip · ngón cái sau · khuỷu theo J" },
  { sheet: "bang-gia", key: "B-khoeopp-J", item: "bang-gia", cand: "khoe~opp", grip: gname("khoe~opp"), mode: "J", hand: sheetHand([45, 30, 25], { axis: "front", toward: { cast: "khach" } }, gname("khoe~opp")), prefer: 0, label: "B khoe~opp · ngón cái trước · khuỷu theo J" },
];
const NEAR = +(process.env.NEAR ?? 30), FAR = +(process.env.FAR ?? 80);
for (const [fwd, row] of [[NEAR, "gần"], [FAR, "xa"]] as const)
  for (const [g, kind] of [["rot", "nắm vai"], ["bung", "nắm thân"]] as const)
    DEFS.push({ sheet: "chai", key: `D${fwd}-${g}`, item: "chai-dia", cand: g, grip: gname(g), mode: "J", hand: bottleHand(fwd, gname(g)), prefer: 0, label: `D ${row} (tiến ${fwd}) · ${g} · ${kind} · khuỷu theo J` });

// along của do-b cho prefer (bảng giá kiểu cũ: `doc`/`khoe` along 0,29 → 0,05·0,18; giữ đúng số do-b bằng cách tính lại)
function alongOf(item: string, L: Link) {
  if (item === "chai-dia") return L.at[1] / HELD["chai-dia"].size[1];
  const E = BG_EDGES[edgeOf(L)];
  return E ? 0.5 + dot(sub(L.at, E.c), E.e) / E.L : 0.5;
}

const fmt = (s: Sample) => ({ e: r2(s.e, 1), rho: r2(s.rho, 1), turn: r2(s.turn, 1), bend: r2(s.bend, 1), dev: r2(s.dev, 1), clamps: s.clamps, clamped: s.clamped, gap: r2(s.gap, 1), eps: r2(s.eps, 3), beta: r2(s.beta, 1), swivel: r2(s.swivel, 2) });
const cells: any[] = [];
const grips: Record<string, Record<string, unknown>> = { "bang-gia": {}, "chai-dia": {} };
for (const d of DEFS) {
  const L = d.item === "bang-gia" ? sheetCand(d.cand) : bottleCand(d.cand);
  const spec = specWith(d.item, d.grip, L);
  grips[d.item][d.grip] = gripJson(d.item, L);
  const heldMap = { ...HELD, [d.item]: spec };
  const prefer = preferAlong(alongOf(d.item, L));
  const sp = poseAt(runtime([{ t: 0, right: d.hand }], heldMap), 0);
  // nghiệm prototype: B (khuỷu act3) hay E (khuỷu theo J)
  const proto = d.mode === "J" ? sampleE(sp, prefer) : solve(sp, "B");
  const handScene: Record<string, unknown> = { ...d.hand };
  let comp: any;
  if (d.mode === "J") {
    const want: V3 = (proto as any).elbowRig;
    handScene.elbow = want.map((v: number) => +v.toFixed(5));
    if (process.env.COMP !== "0") {
      // act3 vẫn dò xoay khuỷu quanh hướng đã khai (giá SWIVEL_COST): tìm hướng khai c (quay quanh trục vai → cổ tay của
      // bước A, tính từ khuỷu mặc định) để khuỷu act3 đặt ra trùng khuỷu J tìm
      const a0 = solve(sp, "A");
      const u = unit(sub(a0.wr, a0.sh));
      const declAt = (c: number): V3 => { const e = spin(a0.elbow0, u, (c * Math.PI) / 180); return [e[0], -e[1], -e[2]]; };
      const miss = (c: number) => {
        const h = { ...d.hand, elbow: declAt(c) };
        const s = solve(poseAt(runtime([{ t: 0, right: h }], heldMap), 0), "real");
        const el = s.elbowUsed as V3 | undefined;
        const de = el ? angDeg(el, want) : 180;
        const dw = Math.abs(s.turn - proto.turn) + Math.abs(s.bend - proto.bend) + Math.abs(s.dev - proto.dev);
        return { c, de, dw, cost: de + 0.2 * dw };
      };
      let best = miss(proto.swivel);
      const base = miss(proto.swivel);
      for (let c = -180; c < 180; c += 7.5) { const m = miss(c); if (m.cost < best.cost) best = m; }
      for (const st of [3.75, 1.875, 0.9375, 0.47]) for (const c of [best.c - st, best.c + st]) { const m = miss(c); if (m.cost < best.cost) best = m; }
      comp = { declaredSwivel: r2(best.c, 2), elbowMissDeg: r2(best.de, 2), wristMissSum: r2(best.dw, 1), noComp: { elbowMissDeg: r2(base.de, 2), wristMissSum: r2(base.dw, 1) } };
      handScene.elbow = declAt(best.c).map((v: number) => +v.toFixed(5));
    }
  }
  // cảnh sẽ vẽ, đường act3 thật (không công tắc)
  const scene = sceneJson([{ t: 0, right: handScene }]);
  const rtR = runtime([{ t: 0, right: handScene }], heldMap);
  const spR = poseAt(rtR, 0);
  const declared = (spR.world!.hands as any)[spR.world!.flip ? "far" : "near"]?.elbow;
  const real = solve(spR, "real");
  const real05 = solve(poseAt(rtR, 0.5), "real");
  cells.push({
    ...d,
    along: r2(alongOf(d.item, L), 3),
    proto: { ...fmt(proto), J: J(proto, prefer) },
    real: { ...fmt(real), J: J(real, prefer), elbowDeclaredInPose: declared },
    real05: { ...fmt(real05), J: J(real05, prefer) },
    elbowScene: handScene.elbow,
    comp,
    scene,
  });
  console.log(d.key, "proto", JSON.stringify({ ...fmt(proto), J: r2(J(proto, prefer).total, 3) }));
  console.log(d.key, "real ", JSON.stringify({ ...fmt(real), J: r2(J(real, prefer).total, 3) }), "comp", JSON.stringify(comp));
  console.log(d.key, "r0.5 ", JSON.stringify({ ...fmt(real05), J: r2(J(real05, prefer).total, 3) }));
}
fs.writeFileSync(`${OUT}cells.json`, JSON.stringify({ at: AT, at2: AT2, cells, grips }, null, 1));
console.log("→", `${OUT}cells.json`);
