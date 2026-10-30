// Kiểm dấu công thức Parger (KHUYU-NGHIEN-CUU.md §3.1) trên 29 tư thế: hệ tay trái x ra ngoài, y lên, z tiến
import { POSES } from './poses29.mjs';
const sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, k) => a.map((v) => v * k), add = (a, b) => a.map((v, i) => v + b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(...a), unit = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const perp = (v, n) => sub(v, mul(n, dot(v, n)));
const D = Math.PI / 180;
const pos = (x) => Math.max(0, x);
// Parger đã đổi quy ước (0 thõng, dương ra ngoài)
const parger = (x, y, z) => 45 + 60 * y - 260 * pos(0.6 - z) * pos(y) + 100 * pos(0.6 - z) * pos(-y) + 50 * pos(0.1 - x);
// gốc: d0 hình chiếu của `ref` (xuống, hay hoà sang lùi khi trục gần đứng như PHI_DOWN)
const basis = (n, mode) => {
  const down = [0, -1, 0], back = [0, 0, -1];
  let r = down;
  if (mode === 'phidown') { const k = Math.max(0, Math.min(1, (len(perp(down, n)) - 0.1) / 0.2)); r = add(mul(down, k), mul(back, 1 - k)); }
  if (mode === 'downback') r = add(down, mul(back, 0.5));
  let d0 = perp(r, n); if (len(d0) < 1e-9) d0 = perp([1, 0, 0], n); d0 = unit(d0);
  return { d0, o0: unit(cross(n, d0)) };
};
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / D;
for (const mode of ['down', 'phidown', 'downback']) {
  for (const sign of [1, -1]) {
    let ok = 0, rows = [];
    for (const [i, name, [f, dn, o], e] of POSES) {
      if (!e) continue;
      const w = [o, -dn, f], n = unit(w);
      const ex = unit(perp([e[2], -e[1], e[0]], n));
      const B = basis(n, mode);
      const phiE = Math.atan2(dot(ex, B.o0), dot(ex, B.d0)) / D;
      const phiP = sign * parger(o, -dn, f);
      const P = add(mul(B.d0, Math.cos(phiP * D)), mul(B.o0, Math.sin(phiP * D)));
      const err = ang(P, ex);
      if (err < 20) ok++;
      rows.push(`#${i} φkỳ vọng ${phiE.toFixed(0)} φParger ${phiP.toFixed(0)} lệch ${err.toFixed(0)}`);
    }
    console.log(`gốc ${mode}, dấu ${sign}: đạt ${ok}/28`);
    if (mode === 'down' && sign === 1 || process.argv[2] === 'all') console.log(rows.join('\n'));
  }
}
