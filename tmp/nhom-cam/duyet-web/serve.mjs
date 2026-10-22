import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const DB = join(HERE, 'nhan-xet.json');
const MD = join(HERE, 'nhan-xet.md');
const PORT = Number(process.env.PORT || 4791);
const TYPE = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const STATUS = { ok: 'Duyệt', sua: 'Cần sửa', hoi: 'Hỏi lại' };

const load = async () => JSON.parse(await readFile(DB, 'utf8').catch(() => '{}'));

async function toMd(db) {
  const items = JSON.parse(await readFile(join(HERE, 'data.json'), 'utf8'));
  const out = ['# Nhận xét duyệt nhóm cầm', ''];
  for (const it of items) {
    const c = db[it.id];
    if (!c || (!c.status && !c.text && !Object.values(c.frames || {}).some(Boolean))) continue;
    const head = it.kind === 'shot' ? `#${it.n} ${it.scene} · ${it.cast} · tay ${it.side} · ${it.old} → ${it.item}@${it.group}` : `G4 ${it.title}`;
    out.push(`## ${head}`, '', `- Trạng thái: ${STATUS[c.status] || '—'}`);
    if (c.text) out.push(`- Nhận xét: ${c.text.replace(/\n/g, '\n  ')}`);
    for (const [k, v] of Object.entries(c.frames || {})) if (v) out.push(`- ${k}: ${v.replace(/\n/g, '\n  ')}`);
    out.push('');
  }
  return out.join('\n');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/nhan-xet') {
      if (req.method === 'POST') {
        let body = '';
        for await (const ch of req) body += ch;
        const db = JSON.parse(body);
        await writeFile(DB, JSON.stringify(db, null, 1));
        await writeFile(MD, await toMd(db));
        res.writeHead(200, { 'content-type': TYPE['.json'] }).end('{"ok":true}');
      } else res.writeHead(200, { 'content-type': TYPE['.json'] }).end(JSON.stringify(await load()));
      return;
    }
    const rel = url.pathname === '/' ? 'duyet-web/index.html' : decodeURIComponent(url.pathname).slice(1);
    const file = normalize(join(ROOT, rel));
    const st = await stat(file);
    if (!file.startsWith(ROOT) || !st.isFile()) throw 0;
    const type = TYPE[extname(file)] || 'application/octet-stream';
    const cache = /\.(png|jpg)$/.test(file) ? 'max-age=3600' : 'no-cache';
    // video: trình duyệt tua bằng `Range`
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      const size = st.size;
      let a = range[1] ? Number(range[1]) : size - Number(range[2]);
      let b = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      a = Math.max(0, a);
      if (a > b || a >= size) {
        res.writeHead(416, { 'content-range': `bytes */${size}` }).end();
        return;
      }
      res.writeHead(206, { 'content-type': type, 'cache-control': cache, 'accept-ranges': 'bytes', 'content-range': `bytes ${a}-${b}/${size}`, 'content-length': b - a + 1 });
      createReadStream(file, { start: a, end: b }).pipe(res);
      return;
    }
    res.writeHead(200, { 'content-type': type, 'cache-control': cache, 'accept-ranges': 'bytes', 'content-length': st.size });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end('không có');
  }
});
const HOSTS = (process.env.HOST || '127.0.0.1').split(',');
for (const h of HOSTS) createServer(server.listeners('request')[0]).listen(PORT, h, () => console.log(`http://${h}:${PORT}/`));
