// node vid.mjs <thư mục ra> <cảnh.json> <t0> <t1> [fps] [cỡ] [giây,giây…] — chạy trong repo video. Cảnh đưa vào dạng
// dựng tạm (`scenes` của `renderSoi`), cảnh three tra theo `name`. Ống kính: TARGET (thế giới rig), KHUNG (cao khung
// thấy ở tâm), DIR (hướng từ đích tới mắt, y âm là lên), XA
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const V = process.cwd();
const { openSoi, renderSoi } = await import(resolve(V, "tools/soi.mjs"));
const [out, file, a, b, fpsS = "30", sizeS = "720", only] = process.argv.slice(2);
const fps = Number(fpsS);
const size = Number(sizeS);
const RAD = Math.PI / 180;
const add = (p, q) => p.map((v, i) => v + q[i]);
const sub = (p, q) => p.map((v, i) => v - q[i]);
const mul = (p, k) => p.map((v) => v * k);
const norm = (p) => mul(p, 1 / Math.hypot(...p));
const num = (s) => s.split(",").map(Number);
const KHUNG = Number(process.env.KHUNG ?? 160);
const XA = Number(process.env.XA ?? 300);
const T = num(process.env.TARGET ?? "262,-215,640");
const dir = norm(num(process.env.DIR ?? "1,-0.45,0"));
const eye = add(T, mul(dir, XA));
const [dx, dy, dz] = sub(T, eye);
const lens = {
  eye,
  yaw: Math.atan2(dx, dz) / RAD,
  pitch: Math.atan2(dy, Math.hypot(dx, dz)) / RAD,
  f: (720 * XA) / KHUNG,
  cx: 0,
  cy: 0,
};
const scene = JSON.parse(readFileSync(file, "utf8"));
const id = "soi-tam";
const ts = [];
if (only) for (const t of only.split(",")) ts.push(Number(t));
else for (let i = Math.round(Number(a) * fps); i <= Math.round(Number(b) * fps); i++) ts.push(i / fps);
mkdirSync(out, { recursive: true });
const soi = await openSoi([scene.name]);
try {
  await renderSoi(soi, {
    jobs: ts.map((t) => ({ scene: id, t, lens })),
    scenes: { [id]: scene },
    w: size,
    h: size,
    tabs: Number(process.env.TABS ?? 4),
    keep: () => true,
    onJob: (_, png, i) => writeFileSync(resolve(out, `f${String(i).padStart(4, "0")}.png`), png),
  });
} finally {
  await soi.close();
}
console.log("xong", ts.length, JSON.stringify(lens));
