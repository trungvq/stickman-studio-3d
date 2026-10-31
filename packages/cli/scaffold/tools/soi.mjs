// Phần chung của `tools/still.mjs` và `tools/can-tay.mjs`: một lượt bundle `tools/soi.tsx`, một Chrome, việc chia thành
// dải liền nhau theo cảnh và mỗi dải một tab chạy song song. `renderStill` mở trang mới cho từng ảnh — nạp lại bundle,
// ảnh, phông và dựng lại cả cảnh 3D (~7 s một ảnh); một tab của `renderFrames` dựng cảnh một lần rồi chỉ tua. Bundle
// xoá khi xong (`bundle.mjs`). Xem docs/03 § Remotion.
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { openBrowser, renderFrames, selectComposition } from "@remotion/renderer";
import { ownBundle } from "./bundle.mjs";
import { bundleScope } from "./scope.mjs";

// cảnh 3D (`src/khoi3d/`) vẽ bằng GPU qua Vulkan như `remotion.config.ts`; API renderer không đọc file ấy
export const chromiumOptions = { gl: process.platform === "darwin" ? "angle" : "vulkan" };
// biến `REMOTION_*` của shell vào trang như `remotion still`
export const envVariables = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => k.startsWith("REMOTION_")),
);

/** Số tab mặc định: nửa số nhân — mỗi tab giữ một cảnh 3D trên GPU, nhiều hơn thì giành nhau chứ không nhanh hơn */
export const defaultTabs = () => Math.max(1, Math.floor(availableParallelism() / 2));

/**
 * Bundle `tools/soi.tsx`, mở Chrome. Gọi `close()` khi xong — nó xoá luôn bundle. `ids`: cảnh, tập, thumbnail sẽ soi —
 * khoá phạm vi của `scope.mjs` (cảnh kéo theo cảnh cùng thư mục); bỏ trống là cả workspace. Ảnh tĩnh nên không mang tiếng.
 */
export async function openSoi(ids = ["*"]) {
  const scope = bundleScope(process.cwd(), ids, { audio: "none" });
  const { serveUrl, drop } = await ownBundle(fileURLToPath(new URL("./soi.tsx", import.meta.url)), {
    scope,
  });
  let browser;
  try {
    browser = await openBrowser("chrome", { chromiumOptions });
  } catch (e) {
    drop();
    throw e;
  }
  const base = { serveUrl, chromiumOptions, envVariables, puppeteerInstance: browser };
  return {
    base,
    /** Composition `id` của app (`Root`) — tập, thumbnail; mỗi trang dựng lại cả cảnh, nên cảnh thì đi `renderSoi` */
    composition: (id) => selectComposition({ ...base, id, inputProps: {} }),
    close: async () => {
      await browser.close({ silent: true }).catch(() => {});
      drop();
    },
  };
}

/** `n` việc thành tối đa `tabs` dải liền nhau gần bằng nhau */
const strips = (n, tabs) => {
  const out = [];
  for (let i = 0, start = 0; i < tabs && start < n; i++) {
    const end = start + Math.ceil((n - start) / (tabs - i));
    out.push(Array.from({ length: end - start }, (_, k) => start + k));
    start = end;
  }
  return out;
};

/** Khung `frames` của `composition`, mỗi dải một tab; `onFrame(frame, png)` */
async function renderStrips(base, composition, inputProps, frames, tabs, onFrame) {
  await Promise.all(
    strips(frames.length, Math.min(tabs, frames.length)).map((idx) =>
      renderFrames({
        ...base,
        composition,
        inputProps,
        frames: idx.map((i) => frames[i]),
        concurrency: 1,
        imageFormat: "png",
        outputDir: null,
        onFrameBuffer: onFrame,
        onStart: () => {},
        onFrameUpdate: () => {},
        logLevel: "error",
      }),
    ),
  );
}

/**
 * Việc `soi` của `tools/soi.tsx` trên khung `w`×`h`. Xếp việc cùng cảnh liền nhau trước khi gọi: mỗi dải chỉ dựng lại
 * cảnh khi sang cảnh khác. `keep(job, frames)` lọc việc trước khi vẽ, `frames` là số khung của từng cảnh (`0`: không có
 * cảnh ấy). `scenes`: cảnh dựng tạm theo id (JSON scene, không nằm trong `scenes/`); `preview`: cảnh nào trong đó là cảnh
 * xem thử của `previewScene` (`SoiProps.preview` của `soi.tsx`). `onJob(job, png, i)`.
 */
export async function renderSoi(
  soi,
  { jobs, w, h, tabs = defaultTabs(), keep, onJob, scenes, preview },
) {
  const inputProps = { soi: jobs, w, h, ...(scenes && { scenes }), ...(preview && { preview }) };
  const composition = await selectComposition({ ...soi.base, id: "soi", inputProps });
  const frames = composition.props.frames;
  const idx = jobs
    .map((_, i) => i)
    .filter((i) => (keep ? keep(jobs[i], frames) : frames[jobs[i].scene] > 0));
  if (!idx.length) return;
  await renderStrips(soi.base, composition, inputProps, idx, tabs, (png, i) =>
    onJob(jobs[i], png, i),
  );
}

/** Khung `frames` của một composition bất kỳ của app (tập, thumbnail); `onFrame(frame, png)` */
export async function renderComposition(
  soi,
  composition,
  frames,
  { tabs = defaultTabs(), onFrame },
) {
  await renderStrips(soi.base, composition, {}, frames, tabs, onFrame);
}
