// Đo ms/khung của app xem thử ở 1920×1080 trên GPU thật: `pnpm bench [--scene cast,walk] [--aa off,ss2] [--gl vulkan,angle]
// [--frames 120] [--total 41000]`. Mỗi khung vẽ đồng bộ qua `window.__drawAt` rồi đọc một pixel để chờ GPU xong; cột
// `chụp` là `Page.captureScreenshot` JPEG như Remotion chụp mỗi khung. `--gl` dùng đúng cờ Chromium mà Remotion đặt cho
// `chromiumOptions.gl` (bản 4.0.x); `CHROME=` để chạy trình duyệt khác, như chrome-headless-shell của Remotion.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const ROOT = resolve(import.meta.dirname, '..');
const SCENES = { cast: '', walk: 'demo=walk&az=0&el=4&look=-0.4,1.8,0', sit: 'demo=sit', camera: 'demo=camera' };
/** Cờ của `getOpenGlRenderer` trong @remotion/renderer */
const GL = {
  vulkan: { args: ['--use-angle=vulkan', '--use-vulkan=native', '--disable-vulkan-fallback-to-gl-for-testing', '--disable-vulkan-surface', '--ignore-gpu-blocklist', '--enable-gpu'], features: ['Vulkan', 'UseSkiaRenderer'] },
  angle: { args: ['--use-gl=angle'] },
  'angle-egl': { args: ['--use-gl=angle', '--use-angle=gl-egl'], features: ['VaapiVideoDecoder'] },
  egl: { args: ['--use-gl=egl'] },
  swangle: { args: ['--use-gl=angle', '--use-angle=swiftshader'] },
};

const { values: o } = parseArgs({
  options: {
    scene: { type: 'string', default: 'cast,walk,camera' },
    aa: { type: 'string', default: 'off,ss1.5,ss2' },
    gl: { type: 'string', default: 'vulkan' },
    frames: { type: 'string', default: '120' },
    total: { type: 'string', default: '41000' },
  },
});
const N = Number(o.frames), TOTAL = Number(o.total);
const chrome = process.env.CHROME ?? ['/usr/bin/chromium', '/usr/bin/google-chrome-stable'].find(existsSync);

const server = await createServer({ root: join(ROOT, 'apps/viewer'), logLevel: 'error', server: { port: 0 } });
await server.listen();
const url = server.resolvedUrls.local[0];
const rows = [];
try {
  for (const gl of o.gl.split(',')) {
    const g = GL[gl];
    if (!g) throw new Error(`--gl không có ${gl}: ${Object.keys(GL).join(', ')}`);
    const browser = await puppeteer.launch({
      executablePath: chrome,
      headless: /headless-shell/.test(chrome) ? 'shell' : true,
      args: [...g.args, `--enable-features=${['NetworkService', 'NetworkServiceInProcess', 'CanvasDrawElement', ...(g.features ?? [])].join(',')}`],
    });
    try {
      const page = await browser.newPage();
      let fail;
      page.on('pageerror', (e) => (fail ??= e.message));
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
      for (const scene of o.scene.split(',')) {
        for (const aa of o.aa.split(',')) {
          await page.goto(`${url}?nohud&aa=${aa}&t=0.5&${SCENES[scene] ?? `demo=${scene}`}`, { waitUntil: 'load' });
          await page.waitForFunction(() => window.__frames >= 4, { timeout: 60000 }).catch((e) => (fail ??= e.message));
          if (fail) throw new Error(fail);
          const r = await page.evaluate((n) => {
            const gl = window.__stage.renderer.getContext();
            const info = gl.getExtension('WEBGL_debug_renderer_info');
            const px = new Uint8Array(4);
            const one = (t) => {
              const a = performance.now();
              window.__drawAt(t);
              gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
              return performance.now() - a;
            };
            for (let i = 0; i < 20; i++) one(i / 60);
            const ms = Array.from({ length: n }, (_, i) => one(0.5 + i / 60)).sort((a, b) => a - b);
            return { gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '?', mean: ms.reduce((a, b) => a + b, 0) / n, p95: ms[Math.floor(n * 0.95)] };
          }, N);
          let shot = 0;
          for (let i = 0; i < 10; i++) {
            const a = performance.now();
            await page.screenshot({ type: 'jpeg', quality: 80 });
            shot += (performance.now() - a) / 10;
          }
          rows.push({ gl, scene, aa, ...r, shot });
          console.log(`${gl} ${scene} ${aa}: ${r.mean.toFixed(2)} ms (p95 ${r.p95.toFixed(2)}), chụp ${shot.toFixed(1)} ms — ${r.gpu}`);
        }
      }
    } catch (e) {
      rows.push({ gl, error: e.message.split('\n')[0] });
      console.log(`${gl}: ${e.message.split('\n')[0]}`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}

const min = (ms) => ((TOTAL * ms) / 60000).toFixed(1);
console.log(`\n| gl | cảnh | aa | ms/khung | p95 | chụp ms | ${TOTAL} khung, chỉ vẽ (phút) | kèm chụp, 1 tab (phút) |`);
console.log('|---|---|---|---:|---:|---:|---:|---:|');
for (const r of rows)
  if (r.error) console.log(`| ${r.gl} | — | — | ${r.error} | | | | |`);
  else console.log(`| ${r.gl} | ${r.scene} | ${r.aa} | ${r.mean.toFixed(2)} | ${r.p95.toFixed(2)} | ${r.shot.toFixed(1)} | ${min(r.mean)} | ${min(r.mean + r.shot)} |`);
console.log(`\nGPU: ${[...new Set(rows.filter((r) => r.gpu).map((r) => r.gpu))].join(' · ')}`);
