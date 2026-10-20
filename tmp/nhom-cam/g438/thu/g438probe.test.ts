import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { graspFrame, type GraspChoice } from "./graspSolve";
import { handSkin, skinHand } from "./handMesh";
import { heldFit, skinBulge, skinDepth, skinPieces } from "./heldFit";
import { edgeFrame, handDims, itemGeom, type DiscFeature, type SlabFeature } from "./heldGeom";
import { parseHeldItem, type GroupId, type HeldItemSpec } from "./heldItem";
import type { V3 } from "./lens";

const VID = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam/held/";
const BEFORE = process.env.G438_BEFORE ?? "/home/trungvq/Work/Dev/stickman-studio-3d-nhom-cam/tmp/nhom-cam/g4-sheet/do.json";
const OUT = process.env.G438_OUT ?? "/tmp/g438/probe.json";
const ROWS = new Set(["mac-dinh", "doc-mat", "pinch-cai-truoc", "bien-the-rim", "bien-the-flat", "bien-the-pinch"]);
const PEOPLE: Record<string, [number, number]> = { "t01-sakura": [1.75, 1.545], kuroiwa: [2, 1.813] };

const specs: Record<string, HeldItemSpec> = {};
const spec = (n: string) => {
  if (!specs[n]) {
    const r = parseHeldItem(JSON.parse(readFileSync(`${VID}${n}.json`, "utf8")));
    if (!r.success) throw new Error(r.error.message);
    specs[n] = r.data;
  }
  return specs[n];
};

function measure(sp: HeldItemSpec, choice: GraspChoice & { group: GroupId }, side: number, k: number, long: number, high: V3) {
  const g = graspFrame(sp, itemGeom(sp), choice, side, handDims(k, long), k, long, 1, high);
  const skin = handSkin(side, k, long);
  const fit = heldFit({ v: g.pose, side, k, long, shape: sp.shape!, G: g.G, roles: g.roles, bulge: skinBulge(skin, g.pose) });
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, [...g.pose, ...fit], pos);
  const { gaps } = skinDepth(pos, skinPieces(skin), g.G, sp.shape!);
  return { gaps, sink: Math.max(0, -Math.min(...Object.values(gaps))) };
}

it("probe", () => {
  const d = JSON.parse(readFileSync(BEFORE, "utf8"));
  const out: unknown[] = [];
  const f2 = (x: number) => x.toFixed(2).padStart(6);
  for (const c of d.cells) {
    if (!ROWS.has(c.ma)) continue;
    for (const h of c.hands) {
      const r = h.raw;
      const ch = r?.grasp?.choice;
      if (!ch || r.grasp.group !== "sheet") continue;
      const sp = spec(c.item);
      const [k, long] = PEOPLE[c.person];
      const side = h.hand === "R" ? -1 : 1;
      const geom = itemGeom(sp);
      const f = geom.features[ch.featureIndex] as SlabFeature | DiscFeature;
      const e = edgeFrame(f, ch.edge, ch.thumb, undefined).e;
      let best: { gaps: Record<string, number>; sink: number; hi: number } | undefined;
      for (const hi of [1, -1]) {
        const m = measure(sp, { ...ch, group: "sheet" }, side, k, long, e.map((x) => x * hi) as V3);
        const err = Math.abs(m.gaps.thumb - r.gaps.thumb) + Math.abs(m.sink - r.sink);
        const berr = best ? Math.abs(best.gaps.thumb - r.gaps.thumb) + Math.abs(best.sink - r.sink) : Infinity;
        if (process.env.G438_DBG && c.item.includes(process.env.G438_DBG)) console.log('  hi', hi, m.gaps.thumb.toFixed(2), m.sink.toFixed(2));
        if (err < berr) best = { ...m, hi };
      }
      const b = best!;
      out.push({ item: c.item, ma: c.ma, person: c.person, hand: h.hand, choice: ch, hi: b.hi, gaps: b.gaps, sink: b.sink, before: { thumb: r.gaps.thumb, sink: r.sink } });
      console.log(
        `${c.item.slice(4).padEnd(10)} ${c.ma.padEnd(16)} ${c.person.slice(0, 5)} ${h.hand} ${ch.variant.padEnd(5)} ${String(ch.edge).padEnd(6)} ${ch.thumb.padEnd(6)} t=${f.t.toFixed(2)} | was cai ${f2(r.gaps.thumb)} lun ${f2(r.sink)} | now cai ${f2(b.gaps.thumb)} lun ${f2(b.sink)} | ${["index", "middle", "ring", "pinky", "palm"].map((x) => f2(b.gaps[x])).join("")}`,
      );
    }
  }
  writeFileSync(OUT, JSON.stringify(out));
}, 600_000);
