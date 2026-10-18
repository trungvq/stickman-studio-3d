// Mọi thumbnail trong MỘT lượt bundle: `pnpm thumbnails [tập] [thư mục ra]`
// Composition `<tập>-thumb` và `<tập>-thumb-<khoá>` sinh từ `thumbnail` của `episodes/*.json`;
// bỏ trống tên tập là chụp mọi tập. Bundle chỉ mang các tập ấy và cảnh của chúng (`scope.mjs`). Xem docs/07 § Thumbnail.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { ownBundle } from "./bundle.mjs";
import { bundleScope, thumbIds } from "./scope.mjs";

const [episode, outDir = "out/thumbnails"] = process.argv.slice(2);
const root = process.cwd();
const episodes = episode
  ? [episode]
  : existsSync("episodes")
    ? readdirSync("episodes")
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -5))
    : [];
const ids = episodes.flatMap((e) => thumbIds(root, e));
if (!ids.length) {
  console.error(
    `không có thumbnail nào${episode ? ` của ${episode}` : ""} — khai \`thumbnail\` trong episodes/<tập>.json`,
  );
  process.exit(1);
}

// cảnh 3D (`src/khoi3d/`) vẽ bằng GPU qua Vulkan như `remotion.config.ts`; API renderer không đọc file ấy
const chromiumOptions = { gl: "vulkan" };
const scope = bundleScope(root, ids, { audio: "none" });
const { serveUrl } = await ownBundle(resolve("src/index.ts"), { scope });

mkdirSync(resolve(outDir), { recursive: true });
const browser = await openBrowser("chrome", { chromiumOptions });
const base = { serveUrl, chromiumOptions, puppeteerInstance: browser, inputProps: {} };
try {
  for (const id of ids) {
    const composition = await selectComposition({ ...base, id });
    const output = resolve(outDir, `${composition.id}.png`);
    await renderStill({ ...base, composition, frame: 0, output, imageFormat: "png" });
    console.log(output);
  }
} finally {
  await browser.close({ silent: true }).catch(() => {});
}
