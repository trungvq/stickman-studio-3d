import type { V3 } from "./lens";

/**
 * Số đo của `head.form: "human"` trong sọ đơn vị (bán kính 1, y lên, z ra trước mặt): đầu chibi. Nửa trên giữ mặt
 * cầu nên tóc và kính dựng khối ôm như đầu cầu; nửa dưới nở ngang về phía đáy và vạt đáy thành cằm chữ U rộng, thu
 * gáy vào cổ. docs/01-rig.md#người-3d-mặc-đồ
 */
export const HUMAN_HEAD = {
  /** Bề ngang nở ra về phía đáy, phần: má phính, quai hàm tròn */
  jaw: 0.3,
  /** Đáy kéo xuống, phần: cằm chạm cổ áo */
  drop: 0.14,
  /** Đáy cằm vạt phẳng, phần: cằm chữ U rộng thay vì nhọn */
  flat: 0.1,
  /** Nửa dưới dời ra trước ở đáy */
  chin: 0.06,
  /** Gáy thu vào cổ */
  nape: 0.55,
  /** Tai: cao độ tâm, lệch sau tâm sọ, nửa cao, nửa rộng, độ chìa khỏi má */
  ear: { y: -0.14, z: -0.08, h: 0.21, w: 0.13, out: 0.07 },
} as const;

/** Mức min mềm của `max(−v, 0)`: gáy thu vào trơn, không gãy ở hai bên má */
const back = (v: number) => (Math.sqrt(v * v + 0.04) - v) / 2;

/**
 * Điểm trên đầu `human` ứng với điểm `p` của mặt cầu đơn vị. Đổi trơn từ xích đạo xuống (đạo hàm `0` ở `y = 0`), nên
 * nửa trên trùng mặt cầu và vỏ viền không gãy.
 */
export function humanSkull([x, y, z]: V3): V3 {
  const H = HUMAN_HEAD;
  const s = Math.max(0, -y);
  const s2 = s * s;
  return [
    x * (1 + H.jaw * s2),
    y * (1 + H.drop * s2) * (1 - H.flat * s2 * s2 * s2),
    z + s2 * (H.chin + H.nape * back(z)),
  ];
}

/**
 * Điểm `p` của lớp bám sọ (tóc dựng khối, sọ đơn vị) dời theo đúng độ dời của điểm sọ bên dưới nó: tóc giữ bề dày
 * trên đầu `human`, gáy thu vào thì tóc gáy thu theo.
 */
export function humanHair([x, y, z]: V3): V3 {
  const r = Math.hypot(x, y, z) || 1;
  const d: V3 = [x / r, y / r, z / r];
  const h = humanSkull(d);
  return [x + h[0] - d[0], y + h[1] - d[1], z + h[2] - d[2]];
}

/** Tâm tai bên `side` (`-1` bên phải người, −x) trên đầu `human`, sọ đơn vị */
export function humanEar(side: -1 | 1): V3 {
  const { y, z } = HUMAN_HEAD.ear;
  const x = Math.sqrt(Math.max(0, 1 - y * y - z * z));
  return humanSkull([side * x, y, z]);
}
