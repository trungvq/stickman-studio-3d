// Như run.mjs, thêm một plugin esbuild sửa act3.ts LÚC GÓI (file trên đĩa không đổi): xuất các hàm nội bộ cho prototype
// J và mở công tắc `globalThis.__J` { fast, noSwivel, noAlts } cho bước A / B.
// Dùng: node tmp/buoc0/j-run.mjs tmp/buoc0/<script>.mts [args]
import { build } from "/home/trungvq/Work/Dev/stickman-studio-3d/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";
const src = path.resolve(process.argv[2]);
const out = src.replace(/\.mts$/, ".bundle.mjs");
const EDITS = [
  ["const r = solveAim(aimW, nb, A, h);", "const r = solveAim(aimW, nb, A, h, !!globalThis.__J?.fast);"],
  ["const r = solveAim(aimB, nb, A, h);", "const r = solveAim(aimB, nb, A, h, !!globalThis.__J?.fast);"],
  ["if (wantsFingers && elbow0) {", "if (wantsFingers && elbow0 && !(globalThis.__J?.noSwivel === true || globalThis.__J?.noSwivel === side)) {"],
  ["for (let i = 0; i < AIM_ITER; i++) {", "for (let i = 0; i < (globalThis.__J?.iter ?? AIM_ITER); i++) {"],
  ["rep.hold.err > HOLD_ALT", "rep.hold.err > (globalThis.__J?.noAlts ? Infinity : HOLD_ALT)"],
  [
    "...(main.label && { toward: main.label }),",
    "...(main.label && { toward: main.label }), axisErr: sol.axisErr, hasRoll: !!(second && dR0),",
  ],
];
const patch = {
  name: "j-act3",
  setup(b) {
    b.onLoad({ filter: /core[\\/]act3\.ts$/ }, (a) => {
      let s = fs.readFileSync(a.path, "utf8");
      for (const [x, y] of EDITS) {
        if (s.split(x).length !== 2) throw new Error(`j-run: không thấy đúng một chỗ \`${x}\``);
        s = s.replace(x, y);
      }
      s += "\nexport { solveActing, trunk3, arm3, markShape, markAt };\n";
      return { contents: s, loader: "ts" };
    });
  },
};
await build({
  entryPoints: [src], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "warning",
  loader: { ".json": "json" }, plugins: [patch],
});
process.argv.splice(2, 1);
await import(pathToFileURL(out).href);
