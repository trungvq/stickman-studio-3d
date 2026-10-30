import { cross3, dot3, matVec, scale3, sub3, add3, type M3, type V3 } from "./lens";

/**
 * Một tư thế mẫu của khuỷu ưu tiên: cổ tay so với vai, chia tầm với `l₁ + l₂`, và hướng khuỷu, cả hai trong hệ thân của
 * tay ấy `[tiến, xuống, ra ngoài]` (như `REACH_ELBOW`). Mẫu không có `elbow` chỉ để soi (ngoài tầm với)
 */
export interface ElbowPose {
  id: number;
  name: string;
  wrist: V3;
  elbow?: V3;
}

/** Bộ tư thế mẫu của `elbowPref`. docs/01-rig.md#khuỷu-ưu-tiên */
export const ELBOW_POSES: readonly ElbowPose[] = [
  { id: 1, name: "buông thõng", wrist: [0, 0.99, 0.06], elbow: [-0.6, 1, 0.4] },
  { id: 2, name: "xách túi quai", wrist: [0, 0.97, 0.1], elbow: [-0.5, 1, 0.5] },
  { id: 3, name: "tay chồng trước đùi", wrist: [0.18, 0.82, -0.3], elbow: [-0.3, 1, 0.5] },
  { id: 4, name: "tay trước bụng", wrist: [0.32, 0.58, -0.33], elbow: [-0.2, 1, 0.6] },
  { id: 5, name: "tay lên ngực", wrist: [0.28, 0.22, -0.38], elbow: [0, 1, 0.8] },
  { id: 6, name: "ôm món sát ngực", wrist: [0.18, 0.2, -0.2], elbow: [0, 0.8, 1] },
  { id: 7, name: "bưng khay ngang eo", wrist: [0.45, 0.45, -0.05], elbow: [-0.4, 1, 0.3] },
  { id: 8, name: "khay ngang ngực", wrist: [0.55, 0.18, -0.05], elbow: [-0.3, 1, 0.5] },
  { id: 9, name: "đọc điện thoại", wrist: [0.38, 0.32, -0.25], elbow: [-0.2, 1, 0.4] },
  { id: 10, name: "bấm điện thoại", wrist: [0.38, 0.32, -0.25], elbow: [-0.2, 1, 0.5] },
  { id: 11, name: "áp điện thoại vào tai", wrist: [0.05, -0.75, 0.25], elbow: [0.3, 0.3, 1] },
  { id: 12, name: "chén kề môi", wrist: [0.45, -0.45, -0.3], elbow: [0.2, 1, 0.6] },
  { id: 13, name: "chống cằm", wrist: [0.4, -0.4, -0.3], elbow: [0.3, 1, 0.3] },
  { id: 14, name: "chỉ thẳng trước", wrist: [0.98, -0.05, 0], elbow: [0, 1, 0.3] },
  { id: 15, name: "chỉ sang ngang", wrist: [0.05, 0, 0.98], elbow: [-1, 0.4, 0] },
  { id: 16, name: "giơ tay", wrist: [0.1, -0.93, 0.12], elbow: [0.2, 0, 1] },
  { id: 17, name: "vẫy tay cạnh đầu", wrist: [0.12, -0.62, 0.45], elbow: [0, 0.6, 1] },
  { id: 18, name: "che mắt nhìn xa", wrist: [0.38, -0.72, 0.02], elbow: [0.3, 0.2, 1] },
  { id: 19, name: "gãi sau đầu", wrist: [-0.05, -0.85, 0.2], elbow: [0.4, -0.3, 1] },
  { id: 20, name: "chống nạnh", wrist: [-0.08, 0.62, 0.05], elbow: [-0.3, 0.3, 1] },
  { id: 21, name: "chắp tay sau lưng", wrist: [-0.28, 0.72, -0.25], elbow: [-1, 0.6, 0.5] },
  { id: 22, name: "với chéo sang bên kia", wrist: [0.42, 0.1, -0.62], elbow: [0, 1, 0.5] },
  { id: 23, name: "đưa món qua quầy", wrist: [0.75, 0.35, -0.1], elbow: [-0.3, 1, 0.2] },
  { id: 24, name: "viết trên quầy", wrist: [0.55, 0.58, -0.15], elbow: [-0.3, 1, 0.6] },
  { id: 25, name: "bấm máy tính tiền", wrist: [0.6, 0.5, -0.08], elbow: [-0.3, 1, 0.5] },
  { id: 26, name: "khoác túi khuỷu", wrist: [0.48, 0.52, 0], elbow: [-0.7, 1, 0.3] },
  { id: 27, name: "kéo cửa lùa", wrist: [0.3, 0.3, 0.62], elbow: [-0.6, 1, 0.2] },
  { id: 28, name: "với kệ cao", wrist: [0.3, -0.85, 0.1], elbow: [0.3, 0.2, 1] },
  { id: 29, name: "đồ ngoài tầm", wrist: [1.05, 0, 0] },
];

/** Bề rộng nhân Gauss của nội suy khuỷu ưu tiên, phần tầm với */
export const ELBOW_SIGMA = 0.4;
/** Độ làm trơn của nội suy (cộng vào đường chéo): mẫu lệch nhau thì lấy trung bình, không bám từng mẫu */
export const ELBOW_SMOOTH = 0.1;
/** Soft IK của tay: còn `ARM_SOFT · (l₁ + l₂)` tới duỗi hết thì cổ tay bắt đầu hụt dần, không bao giờ duỗi thẳng đuột */
export const ARM_SOFT = 0.04;

const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => scale3(a, 1 / (len(a) || 1));
const perp = (v: V3, n: V3): V3 => sub3(v, scale3(n, dot3(v, n)));

/** Hệ thân `[tiến, xuống, ra ngoài]` ra hệ phải `[ra ngoài, lên, tiến]` (như three của tay trái) và ngược lại */
const toQ = (v: readonly number[]): V3 => [v[2], -v[1], v[0]];
const fromQ = (q: V3): V3 => [q[2], -q[1], q[0]];

/** Trục gốc của khung chở: cổ tay thẳng trước vai, khuỷu thõng; điểm suy biến là thẳng sau lưng ngang vai (ngoài tầm) */
const N0: V3 = [0, 0, 1];
const D0: V3 = [0, -1, 0];

/** Phép quay ngắn nhất từ hướng đơn vị `a` sang `b` áp lên `v` (Rodrigues); `b = −a` không xác định */
function carry(a: V3, b: V3, v: V3): V3 {
  const c = dot3(a, b);
  const k = cross3(a, b);
  return add3(add3(scale3(v, c), cross3(k, v)), scale3(k, dot3(k, v) / Math.max(1e-9, 1 + c)));
}

/** Khung quanh hướng `n` (hệ `[ra ngoài, lên, tiến]`): `d0` chở từ khuỷu thõng của tay chỉ thẳng trước, `o0` ra ngoài */
function frameQ(n: V3) {
  const d0 = unit(perp(carry(N0, n, D0), n));
  return { d0, o0: cross3(n, d0) };
}

/** Giải hệ tuyến tính vuông bằng khử Gauss chọn trụ */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
    [M[i], M[p]] = [M[p], M[i]];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const f = M[j][i] / M[i][i];
      for (let k = i; k <= n; k++) M[j][k] -= f * M[i][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

interface PrefField {
  at: V3[];
  mean: [number, number];
  w: [number[], number[]];
}

/** Nội suy Gauss của hướng khuỷu mẫu: mỗi mẫu là `(cos, sin)` góc khuỷu trong khung chở quanh hướng cổ tay */
function prefField(poses: readonly ElbowPose[]): PrefField {
  const ps = poses.filter((p) => p.elbow);
  const at = ps.map((p) => toQ(p.wrist));
  const v = ps.map((p, i) => {
    const n = unit(at[i]);
    const F = frameQ(n);
    const e = perp(toQ(p.elbow!), n);
    const c = [dot3(e, F.d0), dot3(e, F.o0)];
    const r = Math.hypot(c[0], c[1]) || 1;
    return [c[0] / r, c[1] / r];
  });
  const m = [v.reduce((a, x) => a + x[0], 0), v.reduce((a, x) => a + x[1], 0)];
  const mr = Math.hypot(m[0], m[1]) || 1;
  const mean: [number, number] = [m[0] / mr, m[1] / mr];
  const K = at.map((a, i) => at.map((b, j) => gauss(a, b) + (i === j ? ELBOW_SMOOTH : 0)));
  const w: [number[], number[]] = [
    solveLinear(
      K,
      v.map((x) => x[0] - mean[0]),
    ),
    solveLinear(
      K,
      v.map((x) => x[1] - mean[1]),
    ),
  ];
  return { at, mean, w };
}

const gauss = (a: V3, b: V3) => {
  const d = sub3(a, b);
  return Math.exp(-dot3(d, d) / (ELBOW_SIGMA * ELBOW_SIGMA));
};

const FIELD = prefField(ELBOW_POSES);

/**
 * Hướng khuỷu ưu tiên (đơn vị, vuông góc hướng vai → cổ tay) cho cổ tay `w` so với vai, chia tầm với, cả hai trong hệ
 * thân của tay ấy `[tiến, xuống, ra ngoài]`: nội suy Gauss của `ELBOW_POSES` trên góc khuỷu quanh hướng cổ tay, đo trong
 * khung chở theo cung ngắn nhất từ tay chỉ thẳng trước. Hàm trơn của `w`; điểm suy biến là cổ tay thẳng sau lưng ngang
 * vai. docs/01-rig.md#khuỷu-ưu-tiên
 */
export function elbowPref(w: readonly number[]): V3 {
  const q = toQ(w);
  const r = len(q);
  if (r < 1e-9) return fromQ(unit(toQ([-0.4, 1, 0.5])));
  const n = scale3(q, 1 / r);
  const F = frameQ(n);
  let c = FIELD.mean[0];
  let s = FIELD.mean[1];
  for (let i = 0; i < FIELD.at.length; i++) {
    const g = gauss(q, FIELD.at[i]);
    c += FIELD.w[0][i] * g;
    s += FIELD.w[1][i] * g;
  }
  return fromQ(unit(add3(scale3(F.d0, c), scale3(F.o0, s))));
}

/**
 * Hướng khuỷu ưu tiên trong three cho tay bên `side` (`-1` phải) vai `S`, cổ tay `W`, tầm với `L` (three): hệ thân là
 * hông `Rr` (cột: ngang phải người, lên, tiến)
 */
export function prefPole(Rr: M3, side: number, S: V3, W: V3, L: number): V3 {
  const d = sub3(W, S);
  const l: V3 = [
    Rr[0] * d[0] + Rr[3] * d[1] + Rr[6] * d[2],
    Rr[1] * d[0] + Rr[4] * d[1] + Rr[7] * d[2],
    Rr[2] * d[0] + Rr[5] * d[1] + Rr[8] * d[2],
  ];
  const k = 1 / (L || 1);
  const [f, y, o] = elbowPref([l[2] * k, -l[1] * k, side * l[0] * k]);
  return matVec(Rr, [side * o, -y, f]);
}

/** Khoảng vai → cổ tay `d` sau soft IK của tay tầm với `L`, khoảng làm mềm `soft` (cùng đơn vị) */
export function softReach(d: number, L: number, soft: number): number {
  if (!(soft > 0) || d <= L - soft) return Math.min(d, L);
  return L - soft * Math.exp(-(d - L + soft) / soft);
}

const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/**
 * Góc `x` (độ, trên vòng) kẹp vào `[lo, hi]` liền trên cả vòng: ra ngoài thì đứng ở mép gần, tới gần điểm đối diện giữa
 * tầm (`ramp` độ cuối) thì về dần giữa tầm — hai phía gặp nhau ở điểm ấy nên góc không nhảy từ mép này sang mép kia
 */
export function ringClamp(x: number, lo: number, hi: number, ramp = 30): number {
  const c = (lo + hi) / 2;
  const h = (hi - lo) / 2;
  const u = wrap(x - c);
  const a = Math.abs(u);
  if (a <= h) return c + u;
  const k = a >= 180 - ramp ? (180 - a) / ramp : 1;
  return c + Math.sign(u) * h * k;
}

/** Hướng tham chiếu của cánh tay trên khi đo xoay trục: trước, xuống 45° (điểm suy biến sau lưng, chếch lên) */
const ARM_REF: V3 = unit([0, -1, 1]);
const DOWN_Q: V3 = [0, -1, 0];
/** Bản lề khuỷu nghỉ (tay buông, cẳng tay ra trước: bản lề chỉ ra ngoài) chở tới `ARM_REF` */
const HINGE_REF: V3 = unit(carry(DOWN_Q, ARM_REF, [1, 0, 0]));

/**
 * Góc vai của cánh tay trên `S → E` với bản lề khuỷu `hinge` (three), tay bên `side` trên hông `Rr`, độ: `psi` xoay trục
 * cánh tay trên (dương là xoay trong; bản lề nghỉ chở theo cung ngắn nhất từ `ARM_REF`), `raise` nâng khỏi buông thõng,
 * `back` lùi sau mặt phẳng trán, `across` khép qua mặt phẳng giữa
 */
export function shoulderAngles(Rr: M3, side: number, S: V3, E: V3, hinge: V3) {
  const loc = (v: V3): V3 => {
    const l: V3 = [
      Rr[0] * v[0] + Rr[3] * v[1] + Rr[6] * v[2],
      Rr[1] * v[0] + Rr[4] * v[1] + Rr[7] * v[2],
      Rr[2] * v[0] + Rr[5] * v[1] + Rr[8] * v[2],
    ];
    return [side * l[0], l[1], l[2]];
  };
  const a = unit(loc(sub3(E, S)));
  // bản lề là vectơ trục: soi gương sang tay trái thì đổi dấu
  const x = unit(perp(scale3(loc(hinge), side), a));
  const h = unit(perp(carry(ARM_REF, a, HINGE_REF), a));
  const D = Math.PI / 180;
  return {
    psi: Math.atan2(dot3(cross3(h, x), a), dot3(h, x)) / D,
    raise: Math.acos(Math.max(-1, Math.min(1, -a[1]))) / D,
    back: Math.asin(Math.max(0, Math.min(1, -a[2]))) / D,
    across: Math.asin(Math.max(0, Math.min(1, -a[0]))) / D,
  };
}
