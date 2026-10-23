// Trước khi publish thì gói docs, prompt, bộ mẫu, studio 2D đã build và mã nguồn Studio 3D vào chính package — `init`,
// `studio2d`, `studio` lấy từ đó.
// `--clean` gỡ chúng ra: để sót thì `SOURCES` ưu tiên bản đã gói, và `init` chạy từ
// source sẽ chép docs cũ. Chạy ở `postpack`.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const SKIP = new Set(["tmp", "index.json"]);
// Bộ mẫu trong dist đã có ở `template`, và `stickman studio2d` đè workspace lên các đường ấy
const SKIP_IN_STUDIO = new Set([
  "characters",
  "actions",
  "scenes",
  "props",
  "animals",
  "held",
  "hands",
  "episodes",
  "pieces",
]);
const BAKED = ["docs", "prompts", "template", "studio", "studio3d", "versions.json"];

if (process.argv.includes("--clean")) {
  for (const f of BAKED) rmSync(join(HERE, f), { recursive: true, force: true });
  console.log(
    "postpack: đã gỡ docs, prompts, template, studio, studio3d và versions.json khỏi @stickman3d/cli",
  );
  process.exit(0);
}

if (!existsSync(join(REPO, "apps/studio/dist/index.html")))
  throw new Error("apps/studio/dist chưa build — pnpm build trước khi publish");

for (const [from, to] of [
  ["docs", "docs"],
  ["assets/sheets/prompts", "prompts"],
  ["apps/studio/public", "template"],
  ["apps/studio/dist", "studio"],
]) {
  const dst = join(HERE, to);
  rmSync(dst, { recursive: true, force: true });
  cpSync(join(REPO, from), dst, {
    recursive: true,
    filter: (src) =>
      !SKIP.has(src.split("/").pop()) &&
      !src.endsWith(".bak") &&
      !(to === "studio" && SKIP_IN_STUDIO.has(relative(join(REPO, from), src))),
  });
}
// Studio 3D: Vite chạy thẳng mã nguồn của app (`studio3d.mjs`); tsconfig riêng vì bản của app `extends` gốc monorepo
const app3d = join(HERE, "studio3d");
rmSync(app3d, { recursive: true, force: true });
for (const f of ["index.html", "src"])
  cpSync(join(REPO, "apps/studio3d", f), join(app3d, f), { recursive: true });
writeFileSync(
  join(app3d, "tsconfig.json"),
  `${JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", useDefineForClassFields: true } }, null, 2)}\n`,
);
// Version cả bộ, đóng vào gói: `init` pin đúng số này vào package.json của repo video
const versions = {};
for (const k of ["rig", "sketch", "fx", "render", "mcp", "cli"])
  versions[k] = JSON.parse(readFileSync(join(REPO, "packages", k, "package.json"), "utf8")).version;
writeFileSync(join(HERE, "versions.json"), `${JSON.stringify(versions, null, 2)}\n`);

console.log(
  "prepack: docs, prompts, template, studio, studio3d và versions.json đã gói vào @stickman3d/cli",
);
