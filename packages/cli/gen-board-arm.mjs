// Tay của `stickman gen board` do bộ sinh tính: khung lòng tay đặt lên mặt người (đùi, vạt áo) hay mặt ngồi → cổ tay → chọn
// khuỷu cho cả chuỗi mốc → góc tay `[vai, khuỷu, lệch cổ tay, dang, xoắn vai]` và `turn` / `bend` của bàn tay, đúng phép
// dựng của người 3D (`arm3` của lõi rig: `Rsh = Rs · rz(dang) · rx(−vai) · ry(xoắn)`, khuỷu `rx(−khuỷu)`, bàn tay
// `wristTurn`). Rig chỉ vẽ lại góc ấy, không tự chọn gì — docs/05-repo-video.md.
import * as rig from "@stickman3d/rig/core";

const D = Math.PI / 180;

/**
 * Chọn khuỷu (độ, quanh trục vai → cổ tay, tính từ khuỷu ưu tiên `prefPole` của rig): lưới `step`; giá mỗi mốc là `pref` ×
 * (lệch / 90)² cộng giá cổ tay (xoay, gập, lệch chia nửa tầm, bình phương) cộng phạt `over` × (độ vượt tầm / 10)² và phạt
 * `over` × (phần gập ngược vượt `ARM_INWARD − inward`)² × 100. Bàn tay được xoay quanh pháp tuyến lòng tay trong `±yaw`
 * (lưới `yawStep`) khỏi hướng ngón ưu tiên, giá `yawW` × (xoay / 45)², và nghiêng quanh trục ngang lòng tay trong `±tilt`
 * (lưới `tiltStep`, gót hay đầu ngón tì, mặt đo lại độ nâng), giá `tiltW` × (nghiêng / 45)²; mỗi góc khuỷu giữ cặp rẻ nhất
 * — dò trên lưới thô `coarse` (xoay, nghiêng) đo độ nâng thật, rồi chỉnh mịn quanh ô thô rẻ nhất với độ nâng nội suy.
 * Giữa hai mốc `smooth` × ((độ khuỷu/s)² + (độ xoay/s)² + (độ nghiêng/s)²) × dt, đổi nhanh hơn `rate` độ/s thì cấm (chuỗi luôn liền, thà cổ tay chạm giới
 * hạn còn hơn khuỷu lật trong một mốc) — chọn cả chuỗi một lượt (`pickChain`), xong lọc liền `refine` lần (`refineChain`)
 */
export const BOARD_ARM = {
  step: 5,
  pref: 0.3,
  over: 1e3,
  inward: 0.05,
  smooth: 2e-5,
  refine: 3,
  yaw: 90,
  yawStep: 10,
  yawW: 0.5,
  tilt: 40,
  tiltStep: 10,
  tiltW: 0.5,
  coarse: [30, 20],
  rate: 360,
};

export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const unit3 = (a) => {
  const n = Math.hypot(a[0], a[1], a[2]);
  return n > 1e-12 ? mul3(a, 1 / n) : null;
};
/** Phần của `d` vuông góc `u` (đơn vị), chuẩn hoá */
export const perp3 = (d, u) => unit3(sub3(d, mul3(u, dot3(d, u))));
/** Ma trận 3×3 của rig (theo hàng) nhân vector */
export const mv3 = (R, v) => [
  R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
  R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
  R[6] * v[0] + R[7] * v[1] + R[8] * v[2],
];
export const tr3 = (R) => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

/**
 * Khung bàn tay (cột x, y, z như `Rw` của rig) tay bên `side` có lòng tay quay về `palm` và ngón chĩa về `fingers` (three):
 * lòng tay là `−side · x`, ngón là `−y` của khung bàn tay. `fingers` không vuông góc `palm` thì lấy phần vuông góc
 */
export function handFrame(side, palm, fingers) {
  const x = mul3(unit3(palm), -side);
  const f = perp3(fingers, x) ?? perp3([0, -1, 0], x) ?? perp3([1, 0, 0], x);
  const y = mul3(f, -1);
  return rig.fromColumns(x, y, cross3(x, y));
}

/** Quaternion `[x, y, z, w]` của ma trận quay theo hàng */
function quatOf(R) {
  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = R;
  const tr = m11 + m22 + m33;
  let q;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    q = [(m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s];
  } else if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    q = [0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s];
  } else if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    q = [(m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s];
  } else {
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
    q = [(m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s];
  }
  return q;
}

function matOf([x, y, z, w]) {
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y),
  ];
}

/** Khung quay hoà từ `A` sang `B` theo phần `k` (slerp) */
export function slerpFrame(A, B, k) {
  if (k <= 0) return A;
  if (k >= 1) return B;
  const a = quatOf(A);
  let b = quatOf(B);
  let c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (c < 0) {
    b = b.map((v) => -v);
    c = -c;
  }
  if (c > 0.9995) return matOf(unitQ(a.map((v, i) => v + (b[i] - v) * k)));
  const th = Math.acos(c);
  const [wa, wb] = [Math.sin((1 - k) * th) / Math.sin(th), Math.sin(k * th) / Math.sin(th)];
  return matOf(a.map((v, i) => v * wa + b[i] * wb));
}
const unitQ = (q) => {
  const n = Math.hypot(...q);
  return q.map((v) => v / n);
};

/** Euler `ZXY` của three (`R = Rz · Rx · Ry`): `[x, y, z]` radian, nhánh `x ∈ [−90°, 90°]` */
function eulerZXY(R) {
  const x = Math.asin(clamp1(R[7]));
  if (Math.abs(R[7]) < 0.9999999) return [x, Math.atan2(-R[6], R[8]), Math.atan2(-R[1], R[4])];
  return [x, 0, Math.atan2(R[3], R[0])];
}

/** Euler `YZX` của three (`R = Ry · Rz · Rx`): `[x, y, z]` radian */
function eulerYZX(R) {
  const z = Math.asin(clamp1(R[3]));
  if (Math.abs(R[3]) < 0.9999999) return [Math.atan2(-R[5], R[4]), Math.atan2(-R[6], R[0]), z];
  return [0, Math.atan2(R[2], R[8]), z];
}
const wrapRad = (v) => ((((v + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

/** Vai, độ dài hai đoạn tay (three, đã nhân `s`) của tay bên `side` trên thân `T` (`trunk3`) — như `arm3` của lõi */
export function shoulderOf(T, side) {
  const st = T.P.stretch ?? [];
  const right = side === -1;
  return {
    S: T.at(T.hips, T.Rs, [side * T.roots.shoulder[0], T.roots.shoulder[1], 0]),
    l1: T.B.upperArm * (st[right ? 2 : 0] ?? 1) * T.s,
    l2: T.B.foreArm * (st[right ? 3 : 1] ?? 1) * T.s,
  };
}

/** Xoay, gập, lệch cổ tay (độ) cho khung cẳng tay `Re` tới khung bàn tay `Rw` — nghịch `wristTurn` */
function wristOf(Re, Rw, side) {
  const [x, y, z] = eulerYZX(rig.matMul(tr3(Re), Rw));
  return { turn: (-side * y) / D, bend: (-side * z) / D, dev: -x / D };
}

const over = (v, lo, hi) => Math.max(0, lo - v, v - hi);

/**
 * Khuỷu ở góc `deg` (độ, quanh trục vai → cổ tay, từ khuỷu ưu tiên `prefPole` của rig) của tay bên `side` trên thân `T`,
 * cổ tay `W`, khung bàn tay `Rw` (three): khuỷu, khung cánh tay (`armFrame`), góc cổ tay, gập ngược, giá; `miss` là cổ tay
 * hụt đích khi tay không với tới
 */
export function elbowAt(T, side, W, Rw, deg) {
  const { S, l1, l2 } = shoulderOf(T, side);
  const n = unit3(sub3(W, S)) ?? [0, -1, 0];
  const pref = rig.prefPole(T.Rr, side, S, W, l1 + l2);
  const p = perp3(pref, n) ?? perp3([0, -1, 0], n) ?? perp3([1, 0, 0], n);
  const ph = deg * D;
  const pole = add3(mul3(p, Math.cos(ph)), mul3(cross3(n, p), Math.sin(ph)));
  const [E, Wr, X] = rig.twoBone3(S, W, l1, l2, pole);
  const f = rig.armFrame(S, E, Wr, X);
  const w = wristOf(rig.matMul(f.R, rig.rotX(-f.b)), Rw, side);
  const inward = rig.elbowInward({ S, side, Rr: T.Rr, l1 }, Wr, E);
  const wOver =
    over(w.turn, -rig.TURN_MAX, rig.TURN_MAX) +
    over(w.bend, rig.AIM_BEND[0], rig.AIM_BEND[1]) +
    over(w.dev, rig.AIM_DEV[0], rig.AIM_DEV[1]);
  const inOver = Math.max(0, inward - (rig.ARM_INWARD - BOARD_ARM.inward));
  const half = (v, [lo, hi]) => v / (v < 0 ? -lo : hi);
  const cost =
    BOARD_ARM.pref * (deg / 90) ** 2 +
    (w.turn / rig.TURN_MAX) ** 2 +
    half(w.bend, rig.AIM_BEND) ** 2 +
    half(w.dev, rig.AIM_DEV) ** 2 +
    BOARD_ARM.over * (wOver / 10) ** 2 +
    BOARD_ARM.over * 100 * inOver ** 2;
  return { deg, S, E, W: Wr, f, w, inward, wOver, inOver, cost, miss: Math.hypot(...sub3(Wr, W)) };
}

/**
 * Góc cổ tay của `e` (`elbowAt`) kẹp vào tầm rig (lùi `margin` độ khỏi biên) khi còn vượt: khung bàn tay `Rw` rig vẽ được
 * (three), góc cổ tay đã kẹp và độ lệch khỏi khung đích `R` (độ) — lòng tay nghiêng đi chừng ấy thay vì cổ tay vượt tầm
 */
export function clampWrist(e, R, side, margin = 0.5) {
  if (!(e.wOver > 0)) return { Rw: R, w: e.w, off: 0 };
  const cl = (v, lo, hi) => Math.max(lo + margin, Math.min(hi - margin, v));
  const w = {
    turn: cl(e.w.turn, -rig.TURN_MAX, rig.TURN_MAX),
    bend: cl(e.w.bend, rig.AIM_BEND[0], rig.AIM_BEND[1]),
    dev: cl(e.w.dev, rig.AIM_DEV[0], rig.AIM_DEV[1]),
  };
  const Re = rig.matMul(e.f.R, rig.rotX(-e.f.b));
  const Rw = rig.matMul(Re, rig.wristTurn(w.turn, w.bend, w.dev, side));
  const M = rig.matMul(tr3(R), Rw);
  const off = Math.acos(clamp1((M[0] + M[4] + M[8] - 1) / 2)) / D;
  return { Rw, w, off };
}

/** Góc khuỷu `E` (three) theo cách đo của `elbowAt` (độ, quanh trục vai → cổ tay `W`, từ `prefPole`) — nghịch `elbowAt` */
export function poleDeg(T, side, W, E) {
  const { S, l1, l2 } = shoulderOf(T, side);
  const n = unit3(sub3(W, S)) ?? [0, -1, 0];
  const pref = rig.prefPole(T.Rr, side, S, W, l1 + l2);
  const p = perp3(pref, n) ?? perp3([0, -1, 0], n) ?? perp3([1, 0, 0], n);
  const v = perp3(sub3(E, S), n);
  return v ? Math.atan2(dot3(v, cross3(n, p)), dot3(v, p)) / D : 0;
}

/** Khung `R` quay quanh trục `n` (đơn vị, three) một góc `deg` độ */
export function turnFrame(R, n, deg) {
  const a = deg * D;
  const [c, s, t] = [Math.cos(a), Math.sin(a), 1 - Math.cos(a)];
  const [x, y, z] = n;
  const M = [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ];
  return rig.matMul(M, R);
}

const turnDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

/**
 * Chọn một trạng thái mỗi mốc cho cả chuỗi: `rows[i].states` là các `{ deg, yaw, cost }` (khuỷu, xoay bàn tay quanh pháp
 * tuyến lòng tay, độ), `rows[i].t` giây; tổng giá từng mốc cộng `smooth` × ((độ khuỷu/s)² + (độ xoay/s)²) × dt giữa hai mốc
 * kề nhỏ nhất. Trả chỉ số trạng thái từng mốc
 */
export function pickChain(rows) {
  if (!rows.length) return [];
  const acc = rows.map((r) => r.states.map(() => ({ total: Infinity, from: -1 })));
  rows[0].states.forEach((c, j) => (acc[0][j] = { total: c.cost, from: -1 }));
  for (let i = 1; i < rows.length; i++) {
    const dt = Math.max(1e-3, Math.abs(rows[i].t - rows[i - 1].t));
    const prev = rows[i - 1].states;
    rows[i].states.forEach((c, j) => {
      for (let q = 0; q < prev.length; q++) {
        const a = turnDiff(c.deg, prev[q].deg) / dt;
        const b = Math.abs(c.yaw - prev[q].yaw) / dt;
        const g = Math.abs((c.tilt ?? 0) - (prev[q].tilt ?? 0)) / dt;
        // bậc lưới luôn đi được: một bậc mỗi mốc không tính là quá nhanh
        const fast =
          Math.max(0, a - Math.max(BOARD_ARM.rate, BOARD_ARM.step / dt)) +
          Math.max(0, b - Math.max(BOARD_ARM.rate, BOARD_ARM.yawStep / dt)) +
          Math.max(0, g - Math.max(BOARD_ARM.rate, BOARD_ARM.tiltStep / dt));
        const total =
          acc[i - 1][q].total +
          BOARD_ARM.smooth * (a * a + b * b + g * g) * dt +
          c.cost +
          1e6 * fast;
        if (total < acc[i][j].total) acc[i][j] = { total, from: q };
      }
    });
  }
  const last = acc.length - 1;
  let pick = acc[last].reduce((b, a, j, all) => (a.total < all[b].total ? j : b), 0);
  const out = [];
  for (let i = last; i >= 0; i--) {
    out[i] = pick;
    pick = acc[i][pick].from;
  }
  return out;
}

/**
 * Trạng thái cuối của chuỗi: khuỷu, xoay bàn tay đã chọn (`pickChain`) trải liền (khuỷu không quấn ±180°), lọc `[1, 2, 1]`
 * `BOARD_ARM.refine` lần cho hết bậc lưới, rồi tính lại bằng `evalAt(row, deg, yaw, tilt)`; mốc nào bản lọc làm vượt giới hạn cổ
 * tay, gập ngược mà bản lưới không vượt thì giữ bản lưới; mốc ghim (`row.pin`) giữ bản lưới
 */
export function refineChain(rows, pick, evalAt) {
  const grid = rows.map((r, i) => r.states[pick[i]]);
  const F = grid.map((c) => c.deg);
  for (let i = 1; i < F.length; i++) F[i] = F[i - 1] + (((F[i] - F[i - 1] + 540) % 360) - 180);
  let G = F;
  let Y = grid.map((c) => c.yaw);
  // mốc ghim (`row.pin`, như dáng ngồi nối sau) giữ nguyên
  const keep = (A, B) => A.map((v, i) => (rows[i].pin ? B[i] : v));
  const Y0 = grid.map((c) => c.yaw);
  const L0 = grid.map((c) => c.tilt ?? 0);
  let L = L0;
  for (let r = 0; r < BOARD_ARM.refine; r++) {
    L = keep(
      L.map((f, i) => ((L[i - 1] ?? f) + 2 * f + (L[i + 1] ?? f)) / 4),
      L0,
    );
    G = keep(
      G.map((f, i) => ((G[i - 1] ?? f) + 2 * f + (G[i + 1] ?? f)) / 4),
      F,
    );
    Y = keep(
      Y.map((f, i) => ((Y[i - 1] ?? f) + 2 * f + (Y[i + 1] ?? f)) / 4),
      Y0,
    );
  }
  return rows.map((r, i) => {
    if (r.pin) return grid[i];
    const e = evalAt(r, ((((G[i] + 180) % 360) + 360) % 360) - 180, Y[i], L[i]);
    const g = grid[i];
    return e.wOver > g.wOver + 0.5 || e.inOver > g.inOver + 1e-3 ? g : e;
  });
}

/**
 * Góc tay `[vai, khuỷu, lệch cổ tay, dang, xoắn vai]` (độ) cho khung cánh tay `f` (`armFrame`) trên thân `T`, tay bên
 * `side` — nghịch `Rsh = Rs · rz(side · (roots.splay + dang)) · rx(−vai) · ry(side · xoắn)`; hai nhánh Euler cho cùng khung,
 * lấy nhánh gần `ref` (`[vai, dang]` của mốc trước)
 */
export function armAngles(T, side, f, dev, ref = [0, 0]) {
  const [x, y, z] = eulerZXY(rig.matMul(tr3(T.Rs), f.R));
  const branch = ([bx, by, bz]) => ({
    a: -bx / D,
    sp: (side * bz - T.roots.splay) / D,
    twist: (side * by) / D,
  });
  const A = branch([x, y, z]);
  const B = branch([wrapRad(Math.PI - x), wrapRad(y + Math.PI), wrapRad(z + Math.PI)]);
  const far = (o) => Math.abs(o.a - ref[0]) + Math.abs(o.sp - ref[1]);
  const o = far(B) < far(A) ? B : A;
  return [o.a, f.b / D, dev, o.sp, o.twist];
}
