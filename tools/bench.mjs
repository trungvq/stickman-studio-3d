// Đo ms/khung của app xem thử ở 1920×1080 trên GPU thật: `pnpm bench [--scene cast,walk] [--aa off,ss2] [--gl vulkan,angle]
// [--frames 120] [--total 41000]`. Mỗi khung vẽ đồng bộ qua `window.__drawAt` rồi đọc một pixel để chờ GPU xong; cột
// `chụp` là `Page.captureScreenshot` JPEG như Remotion chụp mỗi khung. `--gl` dùng đúng cờ Chromium mà Remotion đặt cho
// `chromiumOptions.gl` (bản 4.0.x); `CHROME=` để chạy trình duyệt khác, như chrome-headless-shell của Remotion.
//
// `pnpm build && node --expose-gc tools/bench.mjs --refresh <repo video> --scene a,b [--at 0.25,0.5,0.9]`: đo trong Node
// (không vẽ GPU) cảnh three của repo video dựng bằng mã nguồn rig của repo này — `resolveScene`, dựng lưới (`worldOf`),
// khung đầu, rồi dời 2 px mốc tay gần nhất trước giây đo và `world.refresh` (docs/03-scene.md#làm-mới-runtime) so với
// dựng lại. `--at` là phần của `duration`. Khung = `pose(t)` + 5 lần `updateMatrixWorld` như `stage.draw`.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
    scene: { type: 'string' },
    aa: { type: 'string', default: 'off,ss1.5,ss2' },
    gl: { type: 'string', default: 'vulkan' },
    frames: { type: 'string', default: '120' },
    total: { type: 'string', default: '41000' },
    refresh: { type: 'string' },
    at: { type: 'string', default: '0.25,0.5,0.9' },
  },
});
if (o.refresh) {
  await refreshBench(resolve(o.refresh));
  process.exit(0);
}
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
      for (const scene of (o.scene ?? 'cast,walk,camera').split(',')) {
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

/** Làm mới so với dựng lại trên cảnh repo video `repo` (mục `--refresh` ở đầu file) */
async function refreshBench(repo) {
  if (!o.scene) throw new Error('--refresh cần --scene <tên cảnh,…>');
  const req = createRequire(join(ROOT, 'packages/render/package.json'));
  const rigReq = createRequire(join(ROOT, 'packages/rig/package.json'));
  const entry = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).stickman?.world;
  if (!entry) throw new Error(`${repo}: package.json không khai stickman.world`);
  const out = join(ROOT, 'tmp/bench/world.mjs');
  const src = (p) => join(ROOT, 'packages', p, 'src/index.ts');
  await req('esbuild').build({
    stdin: { contents: `export * as world from ${JSON.stringify(join(repo, entry))};\nexport * as rig from "@stickman3d/rig";`, resolveDir: ROOT, loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
    resolveExtensions: ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'], loader: { '.css': 'empty', '.png': 'empty', '.jpg': 'empty' },
    plugins: [{
      name: 'rig-src',
      setup(b) {
        b.onResolve({ filter: /^@stickman3d\/rig\/core$/ }, () => ({ path: join(ROOT, 'packages/rig/src/core/index.ts') }));
        b.onResolve({ filter: /^@stickman3d\/(rig|fx)$/ }, (a) => ({ path: src(a.path.split('/')[1]) }));
        b.onResolve({ filter: /^(three|zod)(\/.*)?$/ }, (a) => ({ path: rigReq.resolve(a.path) }));
        b.onResolve({ filter: /^(remotion|@remotion\/[^/]+|react|react-dom)(\/|$)/ }, (a) => ({ path: a.path, namespace: 'hollow' }));
        b.onLoad({ filter: /.*/, namespace: 'hollow' }, () => ({ contents: 'const h=()=>new Proxy(function(){},{get:(_,k)=>k==="toString"||k==="valueOf"?()=>"":typeof k==="symbol"||k==="then"||k==="__esModule"?undefined:h(),getPrototypeOf:()=>h(),apply:()=>h(),construct:()=>h()});module.exports=h();', loader: 'js' }));
      },
    }],
  });
  globalThis.Path2D ??= class { constructor() { return new Proxy(this, { get: (t, k) => (k in t ? t[k] : () => undefined) }); } };
  const { world, rig } = await import(out);
  const { worldData } = await import(join(ROOT, 'packages/cli/lib.mjs'));
  const data = worldData(repo);
  const ms = (f) => { globalThis.gc?.(); const a = performance.now(); const r = f(); return [performance.now() - a, r]; };
  const frame = (w, t) => { w.pose(t); for (let i = 0; i < 5; i++) w.root.updateMatrixWorld(); };
  const parse = (j) => { const r = rig.parseScene(j); if (!r.success) throw new Error(r.error.message); return r.data; };
  const f1 = (x) => x.toFixed(1);
  const rows = [];
  for (const name of o.scene.split(',')) {
    const raw = JSON.parse(readFileSync(join(repo, 'scenes', `${name}.json`), 'utf8'));
    const sc = parse(raw);
    const played = sc.cast.flatMap((m) => (m.character && data.characters[m.character] ? [[m.id, data.characters[m.character]]] : []));
    const heights = Object.fromEntries(played.map(([id, c]) => [id, c.rig.height]));
    const bodies = Object.fromEntries(played.map(([id, c]) => [id, rig.body3(c)]));
    const resolveRt = (s) => rig.resolveScene(s, data.actions, heights, bodies, data.held, data.hands);
    const worldOf = (s, rt) => world.worldOf(name, { ...data, id: name, scene: s, runtime: rt, heights, bodies });
    const tOf = (k) => typeof k.t === 'number' ? k.t : rig.markTime(k.t, raw.marks ?? {});
    for (const at of o.at.split(',').map(Number)) {
      const T = sc.duration * at;
      // mốc tay khai `at`/`offset` gần nhất không sau `T`: dời 2 px
      const j = structuredClone(raw);
      let pick;
      for (const c of j.cast) for (const k of c.world?.hands ?? []) for (const side of ['right', 'left']) {
        const r = k[side];
        if (r && (r.at || r.offset) && tOf(k) <= T && (!pick || tOf(k) >= pick.t)) pick = { t: tOf(k), what: `${c.id} ${side} ${f1(tOf(k))} s`, r };
      }
      if (!pick) { rows.push({ name, T, what: 'không có mốc tay để dời' }); continue; }
      (pick.r.at ?? pick.r.offset)[0] += 2;
      const next = parse(j);
      const [resolveMs, rt] = ms(() => resolveRt(sc));
      const [buildMs, w] = ms(() => worldOf(sc, rt));
      if (!w?.refresh) { rows.push({ name, T, what: 'worldOf không trả World3D có refresh' }); continue; }
      const [firstMs] = ms(() => frame(w, T));
      const [sameMs] = ms(() => frame(w, T));
      const [refreshMs, ok] = ms(() => w.refresh(next));
      const [afterMs] = ms(() => frame(w, T));
      const [nextMs] = ms(() => frame(w, T + 1 / 30));
      rows.push({ name, T, what: pick.what, resolveMs, buildMs, firstMs, sameMs, ok, refreshMs, afterMs, nextMs });
      console.log(`${name} ${f1(T)} s: ${ok ? 'làm mới' : 'phải dựng lại'} ${f1(refreshMs)} + khung ${f1(afterMs)} ms; dựng lại ${f1(resolveMs + buildMs)} + khung ${f1(firstMs)} ms`);
    }
  }
  console.log('\n| cảnh | giây | mốc dời | resolveScene | dựng lưới | khung đầu | khung cùng t | refresh | khung sau refresh | khung kế |');
  console.log('|---|---:|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of rows)
    if (r.resolveMs === undefined) console.log(`| ${r.name} | ${f1(r.T)} | ${r.what} | | | | | | | |`);
    else console.log(`| ${r.name} | ${f1(r.T)} | ${r.what} | ${f1(r.resolveMs)} | ${f1(r.buildMs)} | ${f1(r.firstMs)} | ${f1(r.sameMs)} | ${r.ok ? f1(r.refreshMs) : 'false'} | ${f1(r.afterMs)} | ${f1(r.nextMs)} |`);
}
