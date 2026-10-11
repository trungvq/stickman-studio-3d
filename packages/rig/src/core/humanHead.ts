import type { V3 } from "./lens";

/**
 * Số đo của `head.form: "human"` trong sọ đơn vị (bán kính 1, y lên, z ra trước mặt). Nửa trên giữ mặt
 * cầu nên tóc và kính dựng khối ôm như đầu cầu; nửa dưới bóp vào quai hàm, kéo xuống, đẩy cằm ra trước,
 * thu gáy vào cổ. docs/01-rig.md#người-3d-mặc-đồ
 */
export const HUMAN_HEAD = {
  /** Bề ngang bóp lại ở đáy, phần */
  jaw: 0.5,
  /** Má phồng ngang miệng, phần */
  cheek: 0.1,
  /** Đáy kéo xuống, phần */
  drop: 0.15,
  /** Đáy cằm vạt phẳng, phần: cằm rộng chữ U thay vì nhọn */
  flat: 0.06,
  /** Nửa dưới dời ra trước ở đáy */
  chin: 0.2,
  /** Gáy thu vào cổ */
  nape: 0.55,
  /** Gờ mũi: cao độ chóp mặc định, độ nhô, nửa bề ngang, dốc sống mũi lên trên và chân mũi xuống dưới */
  nose: { y: -0.3, h: 0.085, w: 0.075, up: 0.2, down: 0.055 },
  /** Tai: cao độ tâm, lệch sau tâm sọ, nửa cao, nửa rộng, độ chìa khỏi má */
  ear: { y: -0.12, z: -0.08, h: 0.2, w: 0.12, out: 0.07 },
} as const;

/** Mức min mềm của `max(−v, 0)`: gáy thu vào trơn, không gãy ở hai bên má */
const back = (v: number) => (Math.sqrt(v * v + 0.04) - v) / 2;

/** Cao độ chóp mũi trong sọ đơn vị theo `face` của JSON nhân vật (px đầu cao 130): quá nửa đường mắt → mồm */
export const noseY = (offsetY = 0, mouthGap = 34) => -(offsetY + 0.55 * mouthGap) / 65;

/**
 * Điểm trên đầu `human` ứng với điểm `p` của mặt cầu đơn vị; `nose` là cao độ chóp mũi (`noseY`). Đổi
 * trơn từ xích đạo xuống (đạo hàm `0` ở `y = 0`), nên nửa trên trùng mặt cầu và vỏ viền không gãy.
 */
export function humanSkull([x, y, z]: V3, nose: number = HUMAN_HEAD.nose.y): V3 {
  const H = HUMAN_HEAD;
  const s = Math.max(0, -y);
  const s2 = s * s;
  const n = H.nose;
  const ny = y > nose ? (y - nose) / n.up : (nose - y) / n.down;
  const bump = n.h * Math.min(1, Math.max(0, z * 4 - 2)) * Math.exp(-((x / n.w) ** 2) - ny * ny);
  const c = Math.sin(Math.PI * s);
  return [
    x * (1 - H.jaw * s2 + H.cheek * c * c),
    y * (1 + H.drop * s2) * (1 - H.flat * s2 * s2 * s2),
    z + s2 * (H.chin + H.nape * back(z)) + bump,
  ];
}

/**
 * Điểm `p` của lớp bám sọ (tóc dựng khối, sọ đơn vị) dời theo đúng độ dời của điểm sọ bên dưới nó: tóc giữ bề dày
 * trên đầu `human`, gáy thu vào thì tóc gáy thu theo.
 */
export function humanHair([x, y, z]: V3, nose?: number): V3 {
  const r = Math.hypot(x, y, z) || 1;
  const d: V3 = [x / r, y / r, z / r];
  const h = humanSkull(d, nose);
  return [x + h[0] - d[0], y + h[1] - d[1], z + h[2] - d[2]];
}

/** Tâm tai bên `side` (`-1` bên phải người, −x) trên đầu `human`, sọ đơn vị */
export function humanEar(side: -1 | 1): V3 {
  const { y, z } = HUMAN_HEAD.ear;
  const x = Math.sqrt(Math.max(0, 1 - y * y - z * z));
  return humanSkull([side * x, y, z]);
}
