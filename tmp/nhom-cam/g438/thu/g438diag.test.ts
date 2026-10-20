import { it } from "vitest";
import { graspFrame } from "./graspSolve";
import { HAND_DOF, handFrames } from "./hand";
import { handSkin } from "./handMesh";
import { capsuleClearance, heldFit, skinBulge, toItem } from "./heldFit";
import { handDims, itemGeom } from "./heldGeom";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
import { matVec, type V3 } from "./lens";

const item = (json: unknown): HeldItemSpec => { const r = parseHeldItem(json); if (!r.success) throw new Error(r.error.message); return r.data; };
const sheet = (t: number) => item({ schemaVersion: 2, size: [36, t, 52], front: [0, 1, 0], top: [0, 0, -1], anchors: {}, shape: [{ box: [36, t, 52], at: [0, t / 2, 0] }] });
const TH = HAND_DOF.indexOf("thumbAbd");
it("diag", () => {
  const t = Number(process.env.T ?? 1), slant = Number(process.env.SL ?? 0);
  const [k, long] = process.env.K === "K" ? [2, 1.813] : [1.75, 1.545];
  const variant = process.env.V ?? "pinch";
  const sp = sheet(t);
  const g = graspFrame(sp, itemGeom(sp), { group: "sheet", variant, edge: "right", thumb: "front", slant }, -1, handDims(k, long), k, long, 1, [0, 0, -1]);
  const v = [...g.pose];
  if (process.env.TH) process.env.TH.split(",").map(Number).forEach((a, i) => (v[TH + i] = a));
  const skin = handSkin(-1, k, long);
  const bulge = skinBulge(skin, v);
  console.log("bulge", ["thumb0","thumb1","index0","index1","palm"].map((n) => `${n} ${(bulge as any)[n] / g.G.u}`).join(" "), "u", g.G.u);
  for (const [a, b] of [[0, 0], [-10, 0], [-20, 0], [10, 0], [20, 0], [0, 20], [0, -20], [20, 20]]) {
    const fit = new Array(10).fill(0); fit[0] = a; fit[1] = b;
    const F = handFrames([...v, ...fit], -1, k, long);
    const rows = [0, 1].map((s) => {
      const P = F[`thumb${s}` as "thumb0"];
      const tip = matVec(P.R, [0, -P.len, 0]); const e: V3 = [P.o[0] + tip[0], P.o[1] + tip[1], P.o[2] + tip[2]];
      const o = toItem(g.G, P.o), q = toItem(g.G, e);
      const c = capsuleClearance(sp.shape!, g.G, P.o, e, 0);
      return `seg${s} o[x ${o[0].toFixed(1)} y ${o[1].toFixed(1)}] e[x ${q[0].toFixed(1)} y ${q[1].toFixed(1)}] axisgap ${c.gap.toFixed(2)}`;
    });
    console.log(`fit ${a},${b}: ${rows.join(" | ")}`);
  }
  const fit = heldFit({ v, side: -1, k, long, shape: sp.shape!, G: g.G, roles: g.roles, bulge });
  console.log("heldFit thumb", fit.slice(0, 2), "edge x=18, F face y=", t, "back y=0");
}, 60000);
