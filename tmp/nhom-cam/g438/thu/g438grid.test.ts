import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { run } from "./g438sweep.test";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";

const item = (json: unknown): HeldItemSpec => { const r = parseHeldItem(json); if (!r.success) throw new Error(r.error.message); return r.data; };
const sheet = (t: number) => item({ schemaVersion: 2, size: [36, t, 52], front: [0, 1, 0], top: [0, 0, -1], anchors: {}, shape: [{ box: [36, t, 52], at: [0, t / 2, 0] }] });
const HANDS: [string, number, number][] = [["S", 1.75, 1.545], ["K", 2, 1.813]];
it("grid", () => {
  const t = Number(process.env.T);
  const variant = process.env.V ?? "pinch";
  const slants = (process.env.SL ?? "-30,0,30").split(",").map(Number);
  const sp = sheet(t);
  const out: unknown[] = [];
  const A = (process.env.GA ?? "-10,0,10,20,30").split(",").map(Number);
  const O = (process.env.GO ?? "0,10,20,30").split(",").map(Number);
  const B = (process.env.GB ?? "-10,0,10,20,30,40,50").split(",").map(Number);
  const T = (process.env.GT ?? "-20,-10,0").split(",").map(Number);
  for (const a of A) for (const o of O) for (const b of B) for (const tp of T) {
    const res = [];
    for (const [, k, long] of HANDS) for (const slant of slants) {
      const r = run(sp, { group: "sheet", variant, edge: "right", thumb: "front", slant }, -1, k, long, [0, 0, -1], [a, o, b, tp]);
      res.push([r.gaps.thumb, r.sink]);
    }
    out.push({ th: [a, o, b, tp], res });
  }
  writeFileSync(`/tmp/g438/grid-${variant}${process.env.TAG ?? ""}-${t}.json`, JSON.stringify(out));
}, 3_600_000);
