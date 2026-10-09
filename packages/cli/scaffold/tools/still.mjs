// Nhiều khung trong MỘT lượt bundle: `pnpm frames <cảnh> 316,317,349,350`
// `remotion still` bundle lại mỗi lượt (20–30 giây), mà soi chỗ nối clip thì luôn cần vài
// khung rời nhau. Khoảng liền thì viết `316-320`. Xem docs/03 § Remotion.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "./webpack.mjs";

const [id, spec, outDir = "tmp"] = process.argv.slice(2);
if (!id || !spec) {
  console.error("dùng: node tools/still.mjs <cảnh> <khung[,khung|a-b]> [thư mục ra]");
  process.exit(1);
}

/** "316,317,349-351" → [316, 317, 349, 350, 351] */
const frames = [
  ...new Set(
    spec.split(",").flatMap((part) => {
      const m = part.trim().match(/^(\d+)(?:-(\d+))$/);
      if (m) {
        const [a, b] = [Number(m[1]), Number(m[2])];
        return Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i);
      }
      const n = Number(part.trim());
      if (!Number.isInteger(n) || n < 0) throw new Error(`khung không hợp lệ: ${part}`);
      return [n];
    }),
  ),
].sort((a, b) => a - b);

mkdirSync(resolve(outDir), { recursive: true });

const serveUrl = await bundle({
  entryPoint: resolve("src/index.ts"),
  webpackOverride,
});
// cảnh 3D (`src/khoi3d/`) vẽ bằng GPU qua Vulkan như `remotion.config.ts`; API renderer không đọc file ấy
const chromiumOptions = { gl: "vulkan" };
// biến `REMOTION_*` của shell (`REMOTION_FLAT`, `REMOTION_QUALITY`) vào trang như `remotion still`
const envVariables = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => k.startsWith("REMOTION_")),
);
const composition = await selectComposition({ serveUrl, id, chromiumOptions, envVariables });

// Lệch một khung ở cuối thì `renderStill` ném, và cả lượt bundle 20–30 giây đi tong. Cắt
// phần ngoài tầm rồi báo, còn những khung xin đúng vẫn ra ảnh.
const last = composition.durationInFrames - 1;
const outside = frames.filter((f) => f > last);
const inside = frames.filter((f) => f <= last);
if (outside.length)
  console.error(
    `bỏ khung ${outside.join(",")} — ${id} dài ${composition.durationInFrames} khung (0-${last})`,
  );
if (!inside.length) {
  console.error(`không khung nào nằm trong tầm ${id}`);
  process.exit(1);
}

for (const frame of inside) {
  const output = resolve(outDir, `${id}-${String(frame).padStart(5, "0")}.png`);
  await renderStill({
    serveUrl,
    composition,
    frame,
    output,
    imageFormat: "png",
    chromiumOptions,
    envVariables,
  });
  console.log(output);
}
