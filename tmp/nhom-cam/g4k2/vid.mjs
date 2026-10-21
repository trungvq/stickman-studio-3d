// node /tmp/a816/vid.mjs <thư mục ra> <t0> <t1> [fps] [size] [giây,giây…] — chạy trong repo video
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const V = process.cwd();
const { openSoi, renderSoi } = await import(resolve(V, "tools/soi.mjs"));
const [out, a, b, fpsS = "30", sizeS = "720", only] = process.argv.slice(2);
const fps = Number(fpsS);
const size = Number(sizeS);
const RAD = Math.PI / 180;
const add = (p, q) => p.map((v, i) => v + q[i]);
const sub = (p, q) => p.map((v, i) => v - q[i]);
const mul = (p, k) => p.map((v) => v * k);
const norm = (p) => mul(p, 1 / Math.hypot(...p));
const KHUNG = Number(process.env.KHUNG ?? 230);
const XA = 300;
const T = (process.env.TARGET ?? "-28,-285,175").split(",").map(Number);
const dir = norm(add(norm([-1, 0, -1]), [0, -0.35, 0]));
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
const ts = [];
if (only) for (const t of only.split(",")) ts.push(Number(t));
else for (let i = Math.round(Number(a) * fps); i <= Math.round(Number(b) * fps); i++) ts.push(i / fps);
mkdirSync(out, { recursive: true });
const soi = await openSoi(["thu-nhom-cam"]);
try {
  await renderSoi(soi, {
    jobs: ts.map((t) => ({ scene: "thu-nhom-cam", t, lens })),
    w: size,
    h: size,
    tabs: 4,
    onJob: (_, png, i) => writeFileSync(resolve(out, `f${String(i).padStart(4, "0")}.png`), png),
  });
} finally {
  await soi.close();
}
console.log("xong", ts.length, JSON.stringify(lens));
