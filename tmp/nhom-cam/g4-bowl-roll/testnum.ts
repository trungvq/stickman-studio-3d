import { run } from "./do";
for (const [k, l] of [[1.75, 1.545], [2, 1.813]]) for (const side of [-1, 1]) for (const a of [0.4, 0.45, 0.5]) {
  const r = run(k, l, side, a);
  console.log(k, side, a, "T", (r.thumb.span / r.thumb.d1).toFixed(2), "I", (r.index.span / r.index.d1).toFixed(2), "M", (r.middle.span / r.middle.d1).toFixed(2), "palm", r.palm.toFixed(2), "op", r.op.toFixed(0), "pad", r.pad.toFixed(0), "topNear", r.topNear.toFixed(2), "sink", r.sink.toFixed(2), "gaps", [r.thumb.gap, r.index.gap, r.middle.gap].map((x: number) => x.toFixed(2)).join(","));
}
