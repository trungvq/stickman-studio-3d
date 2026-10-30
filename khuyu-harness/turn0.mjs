// Kiểm `turn = 0` có phải sấp/ngửa trung tính (lòng tay quay vào trục bản lề phía giữa thân, ngón cái về phía gập khuỷu)
// và chiều dương của `turn`, trên hình học tay của rig: tay trái (`side` 1), người nhìn +z, x ra ngoài, y lên
import { POSES } from './poses29.mjs';
const m = await import('../packages/rig/dist/core/index.js');
const { twoBone3, armFrame, wristTurn, handFrames, HAND_REST } = m;
const mv = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
const mm = (A, B) => { const o = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return o; };
const rx = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const perp = (v, n) => sub(v, n.map((x) => x * dot(v, n)));
const ang = (a, b) => (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;
const side = 1, l1 = 0.62, l2 = 0.58, L = l1 + l2;
const hf = handFrames(HAND_REST, side, 1, 1);
const thumbLocal = unit(hf.thumb1.o);
console.log('gốc ngón cái trong khung bàn tay', hf.thumb1.o.map((v) => v.toFixed(3)).join(','));
for (const id of [1, 20, 19, 9]) {
  const [, name, [f, dn, o], e] = POSES.find((p) => p[0] === id);
  const S = [0, 0, 0], W = [o * L, -dn * L, f * L], pole = [e[2], -e[1], e[0]];
  const [E, Wr, X] = twoBone3(S, W, l1, l2, pole);
  const { R, b } = armFrame(S, E, Wr, X);
  const Re = mm(R, rx(-b));
  const fore = unit(sub(Wr, E));
  const flex = unit(perp(sub(S, E), fore)); // phía gập: từ cẳng tay về phía cánh tay trên
  const medial = [-side, 0, 0];
  const out = [];
  for (const t of [0, 45, -45]) {
    const Rw = mm(Re, wristTurn(t, 0, 0, side));
    const palm = mv(Rw, [-side, 0, 0]);
    const thumb = mv(Rw, thumbLocal);
    out.push(`turn ${t}: lòng tay·bản lề ${dot(palm, unit(X)).toFixed(2)}, lòng tay lệch vào giữa ${ang(perp(palm, fore), perp(medial, fore)).toFixed(0)}°, ngón cái lệch phía gập ${ang(perp(thumb, fore), flex).toFixed(0)}°, lòng tay lên ${palm[1].toFixed(2)}`);
  }
  console.log(`#${id} ${name}: gập ${(b * 180 / Math.PI).toFixed(0)}°\n  ` + out.join('\n  '));
}
