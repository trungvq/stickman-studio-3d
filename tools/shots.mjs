// Chụp app xem thử ra PNG cho chủ dự án so bằng mắt: `pnpm shots [--out tên] [--vs tên] [--only a,b] [--soft]`.
// Ảnh vào tmp/shots/<tên>/, tên mặc định là commit hiện tại (thêm `-dirty` khi cây có thay đổi), kèm một tờ gộp
// tmp/shots/<tên>.png. `--vs` ghép từng ảnh cạnh ảnh cùng tên của lượt chụp kia vào tmp/shots/<tên>-vs-<kia>/.
// `--soft` vẽ bằng SwiftShader thay GPU — chậm, chỉ dùng khi máy không có GPU.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'tmp/shots');
const SIZE = { width: 1280, height: 720 };
const BASE = 'nohud&aa=ss2';
/** Bộ khung cố định: đủ góc nhìn, giờ trong ngày và chế độ vẽ để thấy một thay đổi của rig hay pipeline. */
const SHOTS = [
  ['dung-yen', 't=0'],
  ['trai-noi', 't=1.8'],
  ['gai-noi', 't=5.1'],
  ['chinh-dien', 't=1.8&az=0&el=0'],
  ['nghieng', 't=1.8&az=60&el=5'],
  ['sau-lung', 't=1.8&az=180&el=10'],
  ['tu-tren', 't=1.8&az=30&el=55&dist=16'],
  ['can-mat', 't=5.1&look=0.9,3.5,0&az=-10&el=4&dist=6'],
  ['chieu', 't=1.8&time=evening'],
  ['khong-net', 't=1.8&noink'],
  ['pixel', 't=1.8&pixel'],
  ['di', 'demo=walk&t=1.2'],
  ['di-nghieng', 'demo=walk&t=1.75&az=0&el=4&look=-0.4,1.8,0'],
  ['ngoi', 'demo=sit&t=0.9&az=60&el=12&look=1.2,1.4,0&dist=12'],
  ['ngoi-nghieng', 'demo=sit&t=1.3&az=0&el=6&look=1.3,1.6,0&dist=12'],
  ['mat', 'demo=faces&t=0.9&az=0&el=3&look=0,3.1,0&dist=12'],
  ['nhin', 'demo=look&t=1.2&az=0&el=4&look=0,3,0&dist=7'],
  ['kieu-1', 'demo=styles&az=0&el=4&look=-11.6,2.5,0&dist=12'],
  ['kieu-2', 'demo=styles&az=0&el=4&look=-2.9,2.5,0&dist=12'],
  ['kieu-3', 'demo=styles&az=0&el=4&look=5.1,2.8,0&dist=12.5'],
  ['kieu-4', 'demo=styles&az=0&el=4&look=12.3,2.5,0&dist=12'],
  ['kieu-nghieng', 'demo=styles&turn=110&az=0&el=6&look=5.8,3.4,0&dist=9'],
  ['kieu-sau', 'demo=styles&turn=200&az=0&el=8&look=9.4,3.2,0&dist=11'],
  ['mieng', 'demo=mouths&az=0&el=8&look=0,4.6,-1.5&dist=15'],
  ['hanh-dong', 'demo=acts&t=2&az=20&el=8&look=0,2.2,0&dist=17'],
  ['hanh-dong-nghieng', 'demo=acts&t=2&az=-25&el=14&look=0,2.2,0&dist=17'],
  ['chao', 'demo=acts&t=0.75&az=-20&el=5&look=-4.8,2.5,0&dist=7.5'],
  ['ban', 'demo=desk&t=2&az=40&el=12&look=0,1.8,0&dist=17'],
  ['ban-nghieng', 'demo=desk&t=2&az=-30&el=15&look=0,1.8,0&dist=17'],
  ['dau-than', 'demo=heads&t=2&az=10&el=4&look=0,2.6,0&dist=13'],
];

const { values: o } = parseArgs({ options: { out: { type: 'string' }, vs: { type: 'string' }, only: { type: 'string' }, soft: { type: 'boolean' } } });
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const name = o.out ?? (() => {
  try {
    return git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain') ? '-dirty' : '');
  } catch {
    return 'chua-commit';
  }
})();
const only = o.only?.split(',');
const shots = SHOTS.filter(([n]) => !only || only.includes(n));
const dir = join(OUT, name);
mkdirSync(dir, { recursive: true });

const server = await createServer({ root: join(ROOT, 'apps/viewer'), logLevel: 'error', server: { port: 0 } });
await server.listen();
const url = server.resolvedUrls.local[0];
const chrome = process.env.CHROME ?? ['/usr/bin/chromium', '/usr/bin/google-chrome-stable'].find(existsSync);
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: o.soft ? ['--enable-unsafe-swiftshader'] : ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ ...SIZE, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('lỗi trang:', e.message));
  for (const [n, q] of shots) {
    await page.goto(`${url}?${BASE}&${q}`, { waitUntil: 'load' });
    // vài khung cho OrbitControls về chỗ
    await page.waitForFunction(() => window.__frames >= 4, { timeout: 60000 });
    const file = join(dir, `${n}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
} finally {
  await browser.close();
  await server.close();
}

const files = shots.map(([n]) => join(dir, `${n}.png`));
const sheet = join(OUT, `${name}.png`);
execFileSync('magick', ['montage', ...shots.flatMap(([n], i) => ['-label', n, files[i]]), '-tile', '2x', '-geometry', '640x360+6+6', '-pointsize', '18', sheet]);
console.log(sheet);

if (o.vs) {
  const other = join(OUT, o.vs);
  const pair = join(OUT, `${name}-vs-${o.vs}`);
  mkdirSync(pair, { recursive: true });
  for (const [n] of shots) {
    const a = join(other, `${n}.png`), b = join(dir, `${n}.png`);
    if (!existsSync(a)) {
      console.warn(`${o.vs} không có ${n}.png`);
      continue;
    }
    execFileSync('magick', ['montage', '-label', o.vs, a, '-label', name, b, '-tile', '2x1', '-geometry', '+6+6', '-pointsize', '22', join(pair, `${n}.png`)]);
  }
  console.log(pair);
}
