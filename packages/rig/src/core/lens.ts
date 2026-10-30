/**
 * Ống kính 3D của cảnh (`scene.lens`): thế giới trục như SVG — x phải, y xuống (sàn y 0, lên là
 * âm), z sâu vào cảnh. Khác `camera[]` / `cameraAt`: đó là khung cắt 2D (lia, zoom) đặt sau phép
 * chiếu này, zoom 2D không phải dolly. docs/03-scene.md#người-3d
 */
export type V3 = [number, number, number];

/** Mắt, góc quay quanh trục đứng (0 = nhìn theo +z), góc cúi (> 0 nhìn xuống), tiêu cự, điểm ảnh của trục nhìn. Góc theo radian. */
export interface Lens {
  eye: V3;
  yaw: number;
  pitch: number;
  f: number;
  cx: number;
  cy: number;
}

export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Ma trận quay 3×3 theo hàng; `rotX` / `rotY` / `rotZ` cùng chiều với `Euler` của three */
export type M3 = [number, number, number, number, number, number, number, number, number];
export const rotX = (a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
};
export const rotY = (a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
};
export const rotZ = (a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};
export const matMul = (a: M3, b: M3): M3 => {
  const o = new Array(9).fill(0) as M3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return o;
};
export const matVec = (m: M3, v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
/** Ma trận có ba cột `x`, `y`, `z` */
export const fromColumns = (x: V3, y: V3, z: V3): M3 => [
  x[0],
  y[0],
  z[0],
  x[1],
  y[1],
  z[1],
  x[2],
  y[2],
  z[2],
];

const fwd = (yaw: number, pitch: number): V3 => [
  Math.sin(yaw) * Math.cos(pitch),
  Math.sin(pitch),
  Math.cos(yaw) * Math.cos(pitch),
];

/** Toạ độ ống kính của một vectơ thế giới: x phải, y xuống, z sâu */
export function lensView(c: Lens, d: V3): V3 {
  const cy = Math.cos(c.yaw);
  const sy = Math.sin(c.yaw);
  const cp = Math.cos(c.pitch);
  const sp = Math.sin(c.pitch);
  const x = d[0] * cy - d[2] * sy;
  const z = d[0] * sy + d[2] * cy;
  return [x, d[1] * cp - z * sp, d[1] * sp + z * cp];
}

/** Điểm thế giới ra điểm trên khung sân khấu */
export const project = (c: Lens, p: V3): [number, number] => {
  const [x, y, z] = lensView(c, sub3(p, c.eye));
  const k = c.f / Math.max(z, 1);
  return [c.cx + x * k, c.cy + y * k];
};

/** Độ sâu của p theo trục nhìn */
export const depthAt = (c: Lens, p: V3) => lensView(c, sub3(p, c.eye))[2];

/** Cỡ trên khung của một đơn vị thế giới tại p */
export const scaleAt = (c: Lens, p: V3) => c.f / Math.max(depthAt(c, p), 1);

/** Điểm thế giới ở độ sâu `depth` mà điểm khung (x, y) nhìn thấy — chiều ngược của `project` */
export function unproject(c: Lens, [x, y]: [number, number], depth: number): V3 {
  const vx = ((x - c.cx) * depth) / c.f;
  const vy = ((y - c.cy) * depth) / c.f;
  const cy = Math.cos(c.yaw);
  const sy = Math.sin(c.yaw);
  const cp = Math.cos(c.pitch);
  const sp = Math.sin(c.pitch);
  const dy = vy * cp + depth * sp;
  const z1 = -vy * sp + depth * cp;
  return [c.eye[0] + vx * cy + z1 * sy, c.eye[1] + dy, c.eye[2] - vx * sy + z1 * cy];
}

/** Ống kính nhìn vào `target` từ khoảng cách `dist`, trục nhìn rơi vào điểm khung (cx, cy) */
export function orbit({
  target,
  dist,
  yaw,
  pitch,
  f,
  cx = 0,
  cy = 0,
}: {
  target: V3;
  dist: number;
  yaw: number;
  pitch: number;
  f: number;
  cx?: number;
  cy?: number;
}): Lens {
  const w = fwd(yaw, pitch);
  return {
    eye: [target[0] - dist * w[0], target[1] - dist * w[1], target[2] - dist * w[2]],
    yaw,
    pitch,
    f,
    cx,
    cy,
  };
}

/** Điểm trên mặt sàn y = `floor` mà điểm khung (x, y) nhìn thấy */
export function floorAt(c: Lens, [x, y]: [number, number], floor: number): V3 {
  const cy = Math.cos(c.yaw);
  const sy = Math.sin(c.yaw);
  const cp = Math.cos(c.pitch);
  const sp = Math.sin(c.pitch);
  const vx = x - c.cx;
  const vy = y - c.cy;
  const vz = c.f;
  const dy = vy * cp + vz * sp;
  const z1 = -vy * sp + vz * cp;
  const d: V3 = [vx * cy + z1 * sy, dy, -vx * sy + z1 * cy];
  const t = (floor - c.eye[1]) / d[1];
  return [c.eye[0] + d[0] * t, floor, c.eye[2] + d[2] * t];
}

/** Hướng nhìn nằm ngang của ống kính */
export const ahead = (c: Lens): V3 => [Math.sin(c.yaw), 0, Math.cos(c.yaw)];

/** Chỗ đặt một vật: gốc ở `at`, quay `yaw` radian quanh trục đứng (0 = trục +x của vật theo +x thế giới, π/2 theo −z), cỡ `s` */
export interface Place3 {
  at: V3;
  yaw?: number;
  s?: number;
}

/** Điểm toạ độ vật ra thế giới */
export function place3({ at, yaw = 0, s = 1 }: Place3, p: V3): V3 {
  const c = Math.cos(yaw);
  const n = Math.sin(yaw);
  return [at[0] + s * (p[0] * c + p[2] * n), at[1] + s * p[1], at[2] + s * (-p[0] * n + p[2] * c)];
}
