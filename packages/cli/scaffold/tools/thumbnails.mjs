// Mọi thumbnail trong MỘT lượt bundle: `pnpm thumbnails [tập] [thư mục ra]`
// Composition `<tập>-thumb` và `<tập>-thumb-<khoá>` sinh từ `thumbnail` của `episodes/*.json`;
// bỏ trống tên tập là chụp mọi tập. Xem docs/07 § Thumbnail.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { webpackOverride } from "./webpack.mjs";

const [episode, outDir = "out/thumbnails"] = process.argv.slice(2);
const isThumb = (id) =>
  episode
    ? id === `${episode}-thumb` || id.startsWith(`${episode}-thumb-`)
    : /-thumb(-|$)/.test(id);

// cảnh 3D (`src/khoi3d/`) vẽ bằng GPU qua Vulkan như `remotion.config.ts`; API renderer không đọc file ấy
const chromiumOptions = { gl: "vulkan" };
const serveUrl = await bundle({ entryPoint: resolve("src/index.ts"), webpackOverride });
const thumbs = (await getCompositions(serveUrl, { chromiumOptions })).filter((c) => isThumb(c.id));
if (!thumbs.length) {
  console.error(
    `không có thumbnail nào${episode ? ` của ${episode}` : ""} — khai \`thumbnail\` trong episodes/<tập>.json`,
  );
  process.exit(1);
}

mkdirSync(resolve(outDir), { recursive: true });
for (const composition of thumbs) {
  const output = resolve(outDir, `${composition.id}.png`);
  await renderStill({
    serveUrl,
    composition,
    frame: 0,
    output,
    imageFormat: "png",
    chromiumOptions,
  });
  console.log(output);
}
