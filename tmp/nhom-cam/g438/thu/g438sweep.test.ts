import { it } from "vitest";
import { graspFrame, type GraspChoice } from "./graspSolve";
import { HAND_DOF } from "./hand";
import { handSkin, skinHand } from "./handMesh";
import { heldFit, skinBulge, skinDepth, skinPieces } from "./heldFit";
import { handDims, itemGeom } from "./heldGeom";
import { parseHeldItem, type GroupId, type HeldItemSpec } from "./heldItem";
import type { V3 } from "./lens";

const item = (json: unknown): HeldItemSpec => {
  const r = parseHeldItem(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const sheet = (t: number) =>
  item({ schemaVersion: 2, size: [36, t, 52], front: [0, 1, 0], top: [0, 0, -1], anchors: {}, shape: [{ box: [36, t, 52], at: [0, t / 2, 0] }] });
const HANDS: [string, number, number][] = [
  ["S", 1.75, 1.545],
  ["K", 2, 1.813],
];
const TH = HAND_DOF.indexOf("thumbAbd");

export function run(sp: HeldItemSpec, ch: GraspChoice & { group: GroupId }, side: number, k: number, long: number, high: V3, thumb?: number[]) {
  const g = graspFrame(sp, itemGeom(sp), ch, side, handDims(k, long), k, long, 1, high);
  const v = [...g.pose];
  if (thumb) thumb.forEach((a, i) => (v[TH + i] = a));
  const skin = handSkin(side, k, long);
  const fit = heldFit({ v, side, k, long, shape: sp.shape!, G: g.G, roles: g.roles, bulge: skinBulge(skin, v) });
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, [...v, ...fit], pos);
  const { gaps } = skinDepth(pos, skinPieces(skin), g.G, sp.shape!);
  return { gaps, sink: Math.max(0, -Math.min(...Object.values(gaps))), fit: fit.slice(0, 2), fitAll: fit, thumb: v.slice(TH, TH + 4) };
}

const f2 = (x: number) => x.toFixed(2).padStart(6);
it("sweep", () => {
  const variant = process.env.V ?? "pinch";
  const slants = (process.env.SL ?? "-30,0,30").split(",").map(Number);
  const ts = (process.env.T ?? "0.24,0.6,1,1.4,2,2.88,3.9").split(",").map(Number);
  const thumb = process.env.TH ? process.env.TH.split(",").map(Number) : undefined;
  for (const t of ts)
    for (const [n, k, long] of HANDS)
      for (const slant of slants) {
        const sp = sheet(t);
        const tb = process.env.TB ? process.env.TB.split(",").map(Number) : undefined;
        const th = tb ? [tb[2] ?? 0, tb[3] ?? 10, tb[0] + tb[1] * (t - 1), tb[4] ?? -20] : thumb;
        const r = run(sp, { group: "sheet", variant, edge: "right", thumb: "front", slant }, -1, k, long, [0, 0, -1], th);
        if (process.env.FULL) console.log("fit", r.fitAll.map((x: number) => x.toFixed(0)).join(","));
        console.log(
          `t ${t.toFixed(2)} ${n} sl ${String(slant).padStart(4)} | cai ${f2(r.gaps.thumb)} lun ${f2(r.sink)} | ${["index", "middle", "ring", "pinky", "palm"].map((x) => f2(r.gaps[x])).join("")} | fit ${r.fit.map((x) => x.toFixed(0)).join(",")} th ${r.thumb.map((x) => x.toFixed(0)).join(",")}`,
        );
      }
}, 600_000);
