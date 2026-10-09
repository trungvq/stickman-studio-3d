import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

// Phân giải từ `cwd`, không phải từ `import.meta.url`: `remotion.config.ts` bị esbuild gói
// thành cjs, ở đó `import.meta.url` rỗng và `createRequire` nổ trước cả khi bundle.
const require = createRequire(join(process.cwd(), "noop.js"));

// `stickman.tmpdir`: thư mục tạm cho `bundle()` (vài trăm MB mỗi lượt) khi `/tmp` là tmpfs
const tmpdir = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).stickman
  ?.tmpdir;
if (tmpdir) {
  process.env.TMPDIR = tmpdir.replace(/^~(?=\/|$)/, homedir());
  mkdirSync(process.env.TMPDIR, { recursive: true });
}

/** Bộ chung của studio (mảnh, hành động và động vật mẫu) trong @stickman3d/cli: `template/` khi cài từ

 *  registry, `apps/studio/public` khi `link:` sang cây nguồn. `src/data.ts` nạp qua alias này. */
export function commonDir() {
  const cli = dirname(require.resolve("@stickman3d/cli"));
  const dir = [resolve(cli, "template"), resolve(cli, "../../apps/studio/public")].find(existsSync);
  if (!dir) throw new Error("không thấy bộ chung của studio trong @stickman3d/cli");
  return dir;
}

/** Dùng chung cho `remotion.config.ts`, `tools/still.mjs` và `tools/thumbnails.mjs` — mọi đường bundle phải cùng alias */
export const webpackOverride = (c) => ({
  ...c,
  resolve: {
    ...c.resolve,
    alias: { ...c.resolve?.alias, "@stickman-common": commonDir() },
  },
});
