import { readFileSync } from "node:fs";
const { probe } = await import("./probe.mjs");
const base = JSON.parse(readFileSync("/tmp/thu-orig.json", "utf8"));
const tw = (a) => [-Math.cos(a*Math.PI/180), 0, -Math.sin(a*Math.PI/180)].map((x) => +x.toFixed(4));
function mk(side, grip, a, off) {
  const s = structuredClone(base);
  s.items = [{ t: 0, cast: "takumi", item: "thu-bang-gia", to: "chest", offset: off, face: { axis: "front", toward: tw(a) }, roll: { axis: "top", toward: "up" } }];
  const h = { t: 0 }; h[side] = { hold: { item: "thu-bang-gia", group: "sheet", ...grip } };
  s.cast[0].world.hands = [h];
  return s;
}
const sides = process.argv[2].split(","), edges = process.argv[3].split(","), variants = process.argv[4].split(",");
const fwds = [30, 42, 55], lats = [-35, -20, 0, 20, 35];
for (const side of sides) for (const edge of edges) for (const thumb of ["front", "back"]) for (const variant of variants)
  for (const f of fwds) for (const l of lats) {
    const ok = [];
    for (let a = -180; a < 180; a += 15) {
      const r = probe(mk(side, { edge, thumb, variant, along: 0.5, slant: 0 }, a, [f, -2, l]), [0.5]);
      const x = r.out?.[0]?.[side];
      if (x && x.over <= 1 && x.body < 3 && x.gap < 1) ok.push(a);
    }
    console.log(side, edge, thumb, variant, `off[${f},${l}]`, ok.join(" "));
  }
