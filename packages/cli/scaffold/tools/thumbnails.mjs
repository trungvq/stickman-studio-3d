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

const serveUrl = await bundle({ entryPoint: resolve("src/index.ts"), webpackOverride });
const thumbs = (await getCompositions(serveUrl)).filter((c) => isThumb(c.id));
if (!thumbs.length) {
  console.error(
    `không có thumbnail nào${episode ? ` của ${episode}` : ""} — khai \`thumbnail\` trong episodes/<tập>.json`,
  );
  process.exit(1);
}

mkdirSync(resolve(outDir), { recursive: true });
for (const composition of thumbs) {
  const output = resolve(outDir, `${composition.id}.png`);
  await renderStill({ serveUrl, composition, frame: 0, output, imageFormat: "png" });
  console.log(output);
}
