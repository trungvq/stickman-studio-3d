// Phép đổi của tay nắm, vòng khuỷu, nón cổ tay (Dáng tay): hàm thuần trên lõi rig, không `three`. Phép quay thế giới three ↔
// rig, vectơ hệ thân của ý định, điểm và `φ` trên vòng khuỷu, thang màu `E(φ)`, hướng bàn tay trên cẳng tay. README.md
// § Dáng tay.
import {
  AIM_BEND,
  AIM_DEV,
  matMul,
  matVec,
  wristTurn,
  type HandReport,
  type M3,
  type V3,
} from "@stickman3d/rig/core";

const F: M3 = [1, 0, 0, 0, -1, 0, 0, 0, -1];
const tr = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: readonly number[]): V3 => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};

/** Phép quay thế giới three → cùng phép quay trong thế giới rig (đảo y, z hai phía) */
export const rigRotation = (R3: M3): M3 => matMul(matMul(F, R3), F);

/** Phép quay quanh trục `axis` (thế giới rig) góc `deg` độ (Rodrigues) */
export function axisRotation(axis: readonly number[], deg: number): M3 {
  const [x, y, z] = unit(axis);
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const k = 1 - c;
  return [
    c + x * x * k,
    x * y * k - z * s,
    x * z * k + y * s,
    y * x * k + z * s,
    c + y * y * k,
    y * z * k - x * s,
    z * x * k - y * s,
    z * y * k + x * s,
    c + z * z * k,
  ];
}

/**
 * Vectơ thế giới rig → vectơ hệ thân `[tiến, y xuống, ngang]` của thân `Rr` (three, như `holderTrunk`): `out` `-1` ngang
 * phải người, `1` ngang trái — ý định của `hold`, `palm`, `fingers` lấy phía tay ấy (`-1` tay phải), mốc món lấy `-1`
 */
export function toBody(v: readonly number[], Rr: M3, out: number): V3 {
  const l = matVec(tr(Rr), [v[0], -v[1], -v[2]]);
  return [l[2], -l[1], out * l[0]];
}

/** Chiều ngược của `toBody` */
export function fromBody(b: readonly number[], Rr: M3, out: number): V3 {
  const w = matVec(Rr, [out * b[2], -b[1], b[0]]);
  return [w[0], -w[1], -w[2]];
}

/** Vectơ hệ thân `b` quay theo phép quay thế giới rig `R` */
export const turnBody = (b: readonly number[], R: M3, Rr: M3, out: number): V3 =>
  toBody(matVec(R, fromBody(b, Rr, out)), Rr, out);

/** Điểm `p` quay quanh `pivot` theo `R` rồi dời `d` (thế giới rig) */
export function movePoint(p: readonly number[], pivot: readonly number[], R: M3, d: V3): V3 {
  const q = matVec(R, [p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]]);
  return [pivot[0] + q[0] + d[0], pivot[1] + q[1] + d[1], pivot[2] + q[2] + d[2]];
}

type Ring = HandReport["ring"];

/** Hướng khuỷu đơn vị (thế giới rig, vuông góc trục vai → cổ tay) ở góc `phi` độ trên vòng: `elbow` của mốc khoá */
export const ringDir = (ring: Ring, phi: number): V3 => {
  const a = (phi * Math.PI) / 180;
  return unit(ring.d0.map((d, i) => Math.cos(a) * d + Math.sin(a) * ring.o0[i]));
};

/** Khuỷu ở góc `phi` độ trên vòng (thế giới rig) */
export const ringPoint = (ring: Ring, phi: number): V3 => {
  const e = ringDir(ring, phi);
  return [0, 1, 2].map((i) => ring.center[i] + ring.radius * e[i]) as V3;
};

/** Góc `φ` (độ, `−180..180`) của điểm `p` chiếu lên mặt phẳng vòng, cùng gốc với `handReport.phi` */
export function ringPhi(ring: Ring, p: readonly number[]): number {
  const e = [0, 1, 2].map((i) => p[i] - ring.center[i]);
  return (Math.atan2(dot(e, ring.o0), dot(e, ring.d0)) * 180) / Math.PI;
}

/** Hiệu hai góc độ về `−180..180` */
export const wrapDeg = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** Thang `E(φ)` của vòng khuỷu: `0` ở chỗ rẻ nhất, `1` từ `E_min + COST_SPAN` trở lên */
export const COST_SPAN = 3;
export function costRamp(E: readonly number[]): number[] {
  const lo = Math.min(...E);
  return E.map((e) => Math.min(1, Math.sqrt(Math.max(0, e - lo) / COST_SPAN)));
}

/** `E(φ)` hoà thẳng giữa hai mẫu kề của lưới 10° (`cost` của `handReport`) */
export function costAt(cost: { phi: number[]; E: number[] }, phi: number): number {
  const n = cost.phi.length;
  const x = (wrapDeg(phi - cost.phi[0]) + 360) % 360;
  const step = 360 / n;
  const i = Math.floor(x / step) % n;
  const f = x / step - Math.floor(x / step);
  return cost.E[i] * (1 - f) + cost.E[(i + 1) % n] * f;
}

/** Hướng bàn tay (ngón, `−y` của khung bàn tay) trên khung cẳng tay ở góc cổ tay `turn`, `bend`, `dev` độ — three */
export const wristDir = (turn: number, bend: number, dev: number, side: number): V3 =>
  matVec(wristTurn(turn, bend, dev, side), [0, -1, 0]);

/**
 * Mép nón cổ tay trên khung cẳng tay (three) ở xoay cẳng tay `turn`: viền miền `AIM_BEND × AIM_DEV`, đi một vòng, `n` điểm
 * mỗi cạnh
 */
export function coneRim(turn: number, side: number, n = 8): V3[] {
  const [b0, b1] = AIM_BEND;
  const [d0, d1] = AIM_DEV;
  const out: V3[] = [];
  const edge = (a: [number, number], b: [number, number]) => {
    for (let i = 0; i < n; i++) {
      const k = i / n;
      out.push(wristDir(turn, a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, side));
    }
  };
  edge([b0, d0], [b1, d0]);
  edge([b1, d0], [b1, d1]);
  edge([b1, d1], [b0, d1]);
  edge([b0, d1], [b0, d0]);
  return out;
}
