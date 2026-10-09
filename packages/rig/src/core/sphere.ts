import { D, FACE_TRUE, REAR_EYE, REAR_YAW, SIDE_EYE } from "./constants";
import type { View } from "./types";

/** Hướng khối đầu, độ: `yaw` dương đưa mặt về `+x`, `pitch` dương là cúi */
export interface HeadTurn {
  yaw: number;
  pitch: number;
  /** Người 3D: ống kính nhìn xuống bấy nhiêu độ, quay quanh trục ngang của ảnh sau cái lắc */
  look?: number;
}

export type Vec3 = [number, number, number];

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/** Vĩ độ trên sọ đơn vị của một điểm cao `dy` px dưới tâm đầu, nửa trục dọc `r` */
export const latOf = (dy: number, r: number) => -Math.asin(clamp1(dy / r)) / D;
/** Kinh độ của một điểm lệch `dx` px khỏi trục giữa mặt, nửa trục ngang `r` */
export const lonOf = (dx: number, r: number) => Math.asin(clamp1(dx / r)) / D;

/**
 * Điểm trên sọ đơn vị: kinh độ `lon` (0 = giữa mặt, dương về `+x`), vĩ độ `lat` (dương lên),
 * đẩy ra ngoài `lift` lần bán kính. `z` hướng ra người xem.
 */
export function onSkull(lon: number, lat: number, lift = 0): Vec3 {
  const c = Math.cos(lat * D) * (1 + lift);
  return [c * Math.sin(lon * D), Math.sin(lat * D) * (1 + lift), c * Math.cos(lon * D)];
}

/** Gật quanh trục ngang của đầu trước, rồi lắc quanh trục dọc, rồi nhìn xuống `look` quanh trục ngang của ảnh */
export function turnPoint(t: HeadTurn, [x, y, z]: Vec3): Vec3 {
  const cp = Math.cos(t.pitch * D);
  const sp = Math.sin(t.pitch * D);
  const y1 = y * cp - z * sp;
  const z1 = y * sp + z * cp;
  const cy = Math.cos(t.yaw * D);
  const sy = Math.sin(t.yaw * D);
  const z2 = -x * sy + z1 * cy;
  if (!t.look) return [x * cy + z1 * sy, y1, z2];
  const cl = Math.cos(t.look * D);
  const sl = Math.sin(t.look * D);
  return [x * cy + z1 * sy, y1 * cl - z2 * sl, y1 * sl + z2 * cl];
}

/**
 * Điểm trên ảnh đầu đang ở hướng `t` nhưng chưa gật, đem gật `t.pitch`: `(u, v)` lần nửa trục,
 * `v` dương xuống. Điểm nhấc lên sọ ở nửa có mặt, nên mặt vẽ lệch viền vẫn đi đúng cung của nó.
 */
export function nodImage(t: HeadTurn, u: number, v: number): [number, number] {
  const cy = Math.cos(t.yaw * D);
  const sy = Math.sin(t.yaw * D);
  const z = Math.sqrt(Math.max(0, 1 - u * u - v * v)) * (cy < 0 ? -1 : 1);
  const [x1, y1] = turnPoint(t, [u * cy - z * sy, -v, u * sy + z * cy]);
  return [x1, -y1];
}

const VIEW_YAW: Record<Exclude<View, "front" | "quarter">, number> = {
  side: 90,
  rear: REAR_YAW,
  back: 180,
};

/**
 * Hướng đầu mà nét mặt và tóc dựng khối cùng chiếu theo. `quarter`: `face.turn` là độ lệch tĩnh
 * tính bằng px, đổi ra góc rồi cộng `lắc`; `front` là chính diện thật, chỉ còn `lắc`; góc khác
 * đứng ở góc của nó. `lắc` / `gật` là góc thật. docs/01-rig.md#đầu-và-nét-mặt
 */
export function headTurn(view: View, faceTurn: number, rx: number, turn: number, nod: number) {
  if (view !== "front" && view !== "quarter") return { yaw: VIEW_YAW[view], pitch: nod };
  const rest = view === "quarter" ? lonOf(faceTurn, rx) : 0;
  return { yaw: Math.max(-90, Math.min(90, rest + turn)), pitch: nod };
}

/** Hermite giữ đơn điệu qua các mốc `[x, y]` tăng dần (Fritsch–Carlson); `m0` ép độ dốc ở mốc đầu */
function monotone(pts: [number, number][], x: number, m0: number): number {
  const n = pts.length;
  const d = pts.slice(1).map(([x1, y1], i) => (y1 - pts[i][1]) / (x1 - pts[i][0]));
  const m = pts.map((_, i) =>
    i === 0
      ? Math.min(m0, 3 * d[0])
      : i === n - 1
        ? d[n - 2]
        : d[i - 1] * d[i] <= 0
          ? 0
          : (d[i - 1] + d[i]) / 2,
  );
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) m[i] = m[i + 1] = 0;
    else {
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        m[i] = (3 * a * d[i]) / Math.sqrt(s);
        m[i + 1] = (3 * b * d[i]) / Math.sqrt(s);
      }
    }
  }
  if (x >= pts[n - 1][0]) return pts[n - 1][1] + (x - pts[n - 1][0]) * m[n - 1];
  let i = 0;
  while (x > pts[i + 1][0]) i++;
  const [x0, y0] = pts[i];
  const [x1, y1] = pts[i + 1];
  const h = x1 - x0;
  const t = (x - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * y0 +
    (t3 - 2 * t2 + t) * h * m[i] +
    (-2 * t3 + 3 * t2) * y1 +
    (t3 - t2) * h * m[i + 1]
  );
}

/**
 * Góc quay mà nét mặt chiếu theo khi đầu quay `yaw`: thật tới `FACE_TRUE`, rồi chậm lại để mắt gần
 * đúng chỗ ghim của đầu `side` ở 90° và `rear` ở `REAR_YAW`, rồi trôi qua mép sọ trước khi quay lưng hẳn
 */
export function faceYaw(yaw: number, eyeLon: number, eyeLat: number): number {
  if (yaw <= FACE_TRUE) return yaw;
  const pin = (k: number) => eyeLon + Math.asin(clamp1(k / Math.cos(eyeLat * D))) / D;
  return monotone(
    [
      [FACE_TRUE, FACE_TRUE],
      [90, pin(SIDE_EYE)],
      [REAR_YAW, pin(REAR_EYE)],
      [165, eyeLon + 105],
      [180, eyeLon + 120],
    ],
    yaw,
    1,
  );
}

/**
 * Như `turnPoint` của điểm `(lon, lat)` trên sọ, nhưng điểm đã quay quá mép trôi tiếp ra ngoài viền
 * thay vì vòng ra sau: nét mặt đi khuất sau mép đầu theo một chiều, không giật ngược vào trong
 */
export function facePoint(t: HeadTurn, lon: number, lat: number): Vec3 {
  const over = t.yaw + lon - 90;
  if (over <= 0) return turnPoint(t, onSkull(lon, lat));
  const [x, y, z] = turnPoint({ ...t, yaw: 90 - lon }, onSkull(lon, lat));
  return [x + over * D * Math.cos(lat * D), y, z];
}
