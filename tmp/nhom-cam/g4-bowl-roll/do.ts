// Đo `bowl` `pinch` trên chén fixture: khe, vùng da chạm (≤ 0,5) từng ngón, phủ dọc đốt ngọn, lực đối, lòng tay, lún, đỉnh ngón cái so miệng
import { GRIP_GROUPS, PINCH_ALONG } from "../../../packages/rig/src/core/graspGroups";
import { graspFrame } from "../../../packages/rig/src/core/graspSolve";
import { HAND_PIECES, HAND_POSES, handFrames } from "../../../packages/rig/src/core/hand";
import { handSkin, skinHand } from "../../../packages/rig/src/core/handMesh";
import { heldOppose } from "../../../packages/rig/src/core/heldAudit";
import { heldDistance, heldFit, heldNormal, skinBulge, skinPieces, toItem } from "../../../packages/rig/src/core/heldFit";
import { matVec } from "../../../packages/rig/src/core/lens";
import { handDims, itemGeom } from "../../../packages/rig/src/core/heldGeom";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
import chen from "../../../packages/rig/src/core/__fixtures__/held-v2/chen.json";
const V = (GRIP_GROUPS.bowl.variants as any).pinch;
if (process.env.AMAX) (PINCH_ALONG as any)[1] = Number(process.env.AMAX);
if (process.env.AMIN) (PINCH_ALONG as any)[0] = Number(process.env.AMIN);
import { THUMB_ROLL } from "../../../packages/rig/src/core/hand";
(THUMB_ROLL as any)[0] = -90; (THUMB_ROLL as any)[1] = 120;
if (process.env.POSE) Object.assign(HAND_POSES.cupPinch as any, JSON.parse(process.env.POSE));
if (process.env.CURL) V.curl = Number(process.env.CURL);
if (process.env.ROLES) Object.assign(V.roles, JSON.parse(process.env.ROLES));
const spec = parseHeldItem(chen).data!;
const geom = itemGeom(spec);
const MOUTH = 4.5;
const TH = 0.5;
export const PEOPLE = [["sakura", 1.75, 1.545], ["kuroiwa", 2, 1.813]] as const;
export function run(k: number, long: number, side: number, along: number, nofit = false) {
  const g = graspFrame(spec, geom, { group: "bowl", along }, side, handDims(k, long), k, long);
  const skin = handSkin(side, k, long);
  const fit = heldFit({ v: g.pose, side, k, long, shape: spec.shape!, G: g.G, roles: g.roles, bulge: skinBulge(skin, g.pose), curl: V.curl });
  const v = nofit ? [...g.pose] : [...g.pose, ...fit];
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, v, pos);
  const dom = skinPieces(skin);
  const F = handFrames(v, side, k, long);
  const gaps: Record<string, number> = {};
  const near: Record<string, number[][]> = {};
  const cover: Record<string, [number, number]> = {};
  let top = -Infinity, topNear = -Infinity, top1 = -Infinity;
  for (let i = 0; i < dom.length; i++) {
    const n = HAND_PIECES[dom[i]];
    const o = n === "palm" ? "palm" : n.slice(0, -1);
    const h: [number, number, number] = [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
    const q = toItem(g.G, h);
    const d = heldDistance(spec.shape!, q);
    gaps[o] = Math.min(gaps[o] ?? Infinity, d);
    if (d <= TH) (near[o] ??= []).push(q);
    if (o === "thumb") top = Math.max(top, q[1]);
    if (o === "thumb" && Math.hypot(q[0], q[2]) < 8 + 3) topNear = Math.max(topNear, q[1]);
    if (n === "thumb1") top1 = Math.max(top1, q[1]);
    if (d <= TH && n.endsWith("1")) {
      const f = F[n as "thumb1"];
      const r = [h[0] - f.o[0], h[1] - f.o[1], h[2] - f.o[2]];
      const t = -(r[0] * f.R[1] + r[1] * f.R[4] + r[2] * f.R[7]) / f.len;
      const c = (cover[o] ??= [Infinity, -Infinity]);
      c[0] = Math.min(c[0], t);
      c[1] = Math.max(c[1], t);
    }
  }
  const span = (Q?: number[][]) => {
    let m = 0;
    for (const a of Q ?? []) for (const b of Q ?? []) m = Math.max(m, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    return m;
  };
  const op = heldOppose(spec.shape!, near as any, gaps as any, g.roles)?.angle ?? 0;
  const sink = Math.max(0, -Math.min(...Object.values(gaps)));
  // đệm đốt ngọn ngón cái (phía gập) so pháp tuyến vào trong ở đỉnh da đốt ngọn gần thành nhất
  let best = Infinity, pad = NaN;
  const ph = matVec(F.thumb1.R, [-side, 0, 0]);
  const R = g.G.R;
  const pi = [R[0] * ph[0] + R[3] * ph[1] + R[6] * ph[2], R[1] * ph[0] + R[4] * ph[1] + R[7] * ph[2], R[2] * ph[0] + R[5] * ph[1] + R[8] * ph[2]];
  for (let i = 0; i < dom.length; i++) {
    if (HAND_PIECES[dom[i]] !== "thumb1") continue;
    const q = toItem(g.G, [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]]);
    const d = heldDistance(spec.shape!, q);
    if (d < best) { best = d; const n = heldNormal(spec.shape!, q); pad = Math.acos(Math.max(-1, Math.min(1, -(n[0] * pi[0] + n[1] * pi[1] + n[2] * pi[2])))) * 180 / Math.PI; }
  }
  const L1 = { thumb: F.thumb1.len, index: F.index1.len, middle: F.middle1.len };
  const res: any = { pad, op, sink, palm: gaps.palm, top: top - MOUTH, topNear: topNear - MOUTH, top1: top1 - MOUTH, fit, choice: g.choice, u: g.G.u };
  for (const f of ["thumb", "index", "middle"] as const) {
    const c = cover[f];
    res[f] = { gap: gaps[f], span: span(near[f]), d1: (L1[f] / g.G.u), cov: c ? Math.min(1, c[1]) - Math.max(0, c[0]) : 0 };
  }
  return res;
}
const f1 = (x: number) => x.toFixed(1);
export const fmt = (r: any) =>
  `đệm ${r.pad.toFixed(0)}° đối ${r.op.toFixed(0)} lòng ${f1(r.palm)} lún ${f1(r.sink)} đỉnh-cái ${f1(r.top)}/gần ${f1(r.topNear)}/ngọn ${f1(r.top1)} | ` +
  (["thumb", "index", "middle"] as const).map((f) => `${f[0].toUpperCase()} khe ${f1(r[f].gap)} vùng ${f1(r[f].span)}/${f1(r[f].d1)} phủ ${r[f].cov.toFixed(2)}`).join(" | ");
if (import.meta.main) {
  const ALONGS = JSON.parse(process.env.ALONGS ?? "[0.2,0.275,0.35]");
  const SIDES = JSON.parse(process.env.SIDES ?? "[-1,1]");
  for (const [name, k, long] of PEOPLE) for (const side of SIDES) for (const a of ALONGS) {
    const r = run(k, long, side, a);
    console.log(`${name} ${side < 0 ? "P" : "T"} along ${a} | ${fmt(r)} | fit ${r.fit.map((x: number) => x.toFixed(0)).join(",")}`);
  }
}
