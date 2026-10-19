// Như tmp/buoc0/run.mjs, thêm: lúc gói, nối `export { trunk3, markShape, markAt }` vào act3.ts (không sửa file nguồn).
// Dùng: node tmp/nhom-cam/b0/run.mjs tmp/nhom-cam/b0/<script>.mts [args]
import { build } from "../../../node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";
const src = path.resolve(process.argv[2]);
const out = src.replace(/\.mts$/, ".bundle.mjs");
const expose = {
  name: "expose",
  setup(b) {
    b.onLoad({ filter: /core[\\/]act3\.ts$/ }, (a) => ({
      contents: fs.readFileSync(a.path, "utf8") + "\nexport { trunk3, markShape, markAt };\n",
      loader: "ts",
    }));
  },
};
await build({ entryPoints: [src], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "warning", loader: { ".json": "json" }, plugins: [expose] });
process.argv.splice(2, 1);
await import(pathToFileURL(out).href);
