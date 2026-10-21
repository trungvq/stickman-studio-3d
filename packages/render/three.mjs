// Vẽ cảnh three thật (người 3D dựng khối, vật liệu NPR, bóng, phòng, đồ riêng của cảnh) bằng Chromium headless:
// trang `three-page.mjs` gói cùng rig và `stickman.world` của repo video, puppeteer-core lấy từng khung ra PNG.
// docs/04-mcp.md#ảnh-three-thật
import { existsSync } from "node:fs";
import { platform } from "node:os";
import * as rig from "@stickman3d/sketch";
import { bundleThreePage } from "./layers.mjs";

const CHROMES = {
  linux: [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/snap/bin/chromium",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
};

/** Chromium để vẽ: biến `CHROME`, không thì chỗ cài thường gặp; không có thì `null` */
export function findChrome() {
  if (process.env.CHROME) return existsSync(process.env.CHROME) ? process.env.CHROME : null;
  return (CHROMES[platform()] ?? []).find(existsSync) ?? null;
}

/** Cờ Chromium: GPU qua Vulkan trên Linux như `pnpm shots`; `software` là SwiftShader */
const chromeArgs = (software) =>
  software
    ? ["--enable-unsafe-swiftshader"]
    : platform() === "linux"
      ? ["--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist"]
      : ["--ignore-gpu-blocklist"];

/** `"1280x720"` hay `"1280"` ra cỡ khung pixel cùng tỉ lệ khung sân khấu `frame`; lệch tỉ lệ thì ném */
export function threeSize(spec, frame) {
  const aspect = frame.w / frame.h;
  if (spec === undefined || spec === null || spec === "") spec = "1280";
  const m = String(spec).match(/^(\d+)(?:x(\d+))?$/);
  if (!m) throw new Error(`size lạ: ${spec} — viết 1280x720 hay 1280`);
  const w = Number(m[1]);
  const h = m[2] ? Number(m[2]) : Math.round(w / aspect);
  if (w < 16 || h < 16 || w > 4096 || h > 4096) throw new Error(`size ngoài 16–4096: ${spec}`);
  if (Math.abs(w / h / aspect - 1) > 0.01)
    throw new Error(
      `size ${w}x${h} khác tỉ lệ khung cảnh ${frame.w}x${frame.h} — vệt và ống kính sẽ lệch; dùng ${w}x${Math.round(w / aspect)}`,
    );
  return { w, h };
}

/**
 * Dữ liệu cho trang: JSON đã parse (nhân vật theo tên file, hành động, động vật, đạo cụ, món cầm tay) kèm
 * `heights` và `bodies` của `cast` — đúng `ctx` mà `worldOf` nhận ở `check`
 */
export function threeData(
  scene,
  { characters, actions = {}, animals = {}, props = {}, held = {} },
) {
  const heights = {};
  const bodies = {};
  for (const m of scene.cast) {
    const c = m.character && characters[m.character];
    if (c) [heights[m.id], bodies[m.id]] = [c.rig.height, rig.body3(c)];
  }
  return { characters, actions, animals, props, held, heights, bodies };
}

async function launch(software) {
  let puppeteer;
  try {
    puppeteer = (await import("puppeteer-core")).default;
  } catch {
    throw new Error("ảnh three cần gói puppeteer-core — cài cùng @stickman3d/render");
  }
  const chrome = findChrome();
  if (!chrome)
    throw new Error(
      process.env.CHROME
        ? `ảnh three cần Chromium hay Chrome: CHROME=${process.env.CHROME} không có file`
        : "ảnh three cần Chromium hay Chrome: không thấy ở chỗ cài thường gặp — đặt biến CHROME=<đường dẫn>",
    );
  try {
    return await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      args: chromeArgs(software),
    });
  } catch (e) {
    throw new Error(`không mở được Chromium ${chrome}: ${e.message}`);
  }
}

/**
 * Chạy các lượt vẽ trong một Chromium: mỗi `job` là `{ id, scene, data, times, plain?, furniture? }` — `scene` đã
 * parse, `data` của `threeData`, `plain` bỏ qua `worldOf` của repo, `furniture` là `Item` của rig thêm vào bối cảnh.
 * Trả `{ gpu, boot, jobs: [{ from, warnings, frames: [{ t, png, ms }] }] }`: `from` là `world` (cảnh của repo) hay
 * `plain` (`plainRoom()`), `png` là Buffer, `ms` thời gian vẽ khung trong trang, `boot` ms gói trang và mở Chromium
 */
export async function threeShots({ root = process.cwd(), jobs, size, software = false }) {
  const t0 = performance.now();
  const code = await bundleThreePage(root);
  const browser = await launch(software);
  try {
    const page = await browser.newPage();
    let fail;
    const failed = new Promise((_, reject) => (fail = reject));
    failed.catch(() => undefined);
    page.on("pageerror", (e) => fail(new Error(`trang three ném lỗi lúc nạp: ${e.message}`)));
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 1 });
    await page.setContent("<!doctype html><html><body style='margin:0'></body></html>");
    await page.addScriptTag({ content: code, type: "module" });
    await Promise.race([
      page.waitForFunction(() => globalThis.__three, { timeout: 60000 }),
      failed,
    ]);
    const boot = performance.now() - t0;
    const out = [];
    let gpu;
    for (const job of jobs) {
      const r = await page.evaluate((o) => globalThis.__three.setup(o), { ...job, size, software });
      gpu = r.gpu;
      const frames = [];
      for (const [i, t] of job.times.entries()) {
        const { png, ms } = await page.evaluate((i) => globalThis.__three.shot(i), i);
        frames.push({ t, png: Buffer.from(png, "base64"), ms });
      }
      out.push({ from: r.from, warnings: r.warnings, provided: r.provided, frames });
    }
    await page.evaluate(() => globalThis.__three.dispose());
    return { gpu, boot, jobs: out };
  } finally {
    await browser.close();
  }
}
