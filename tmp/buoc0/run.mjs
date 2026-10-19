// Chạy một script .mts nhập thẳng mã nguồn lõi (packages/rig/src/core/*.ts): esbuild gói rồi node chạy.
// Dùng: node tmp/buoc0/run.mjs tmp/buoc0/<script>.mts [args]
import { build } from "/home/trungvq/Work/Dev/stickman-studio-3d/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js";
import { pathToFileURL } from "node:url";
import path from "node:path";
const src = path.resolve(process.argv[2]);
const out = src.replace(/\.mts$/, ".bundle.mjs");
await build({ entryPoints: [src], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "warning", loader: { ".json": "json" } });
process.argv.splice(2, 1);
await import(pathToFileURL(out).href);
