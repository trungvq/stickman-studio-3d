import { D, RIG } from "./constants";
import { add3, dot3, scale3, sub3, type V3 } from "./lens";
import type { Arm, Reach } from "./types";

/** Hướng khuỷu mặc định của đích cổ tay, hệ thân `[tiến, y, ra ngoài]`: xuống, lùi và ra ngoài một chút */
export const REACH_ELBOW: V3 = [-0.4, 1, 0.5];

const norm = (v: V3): number => Math.hypot(v[0], v[1], v[2]);

/** Thành phần của `v` vuông góc với trục đơn vị `n` */
const across = (v: V3, n: V3): V3 => sub3(v, scale3(n, dot3(v, n)));

/**
 * IK hai đoạn: ba khớp `[gốc, khớp giữa, đầu]` với đoạn `l1`, `l2` giữ nguyên độ dài, đầu ở `target`
 * khi với tới. Khớp giữa nằm trong mặt phẳng qua trục gốc → đích và hướng `pole`, về phía `pole`.
 * Đích xa quá tầm thì chi duỗi thẳng về phía nó; gần quá thì gập hết cỡ trên cùng trục.
 * docs/01-rig.md#đích-bàn-tay
 */
export function solveTwoBone(root: V3, target: V3, l1: number, l2: number, pole: V3): [V3, V3, V3] {
  const d = sub3(target, root);
  const dist = norm(d);
  const n: V3 = dist > 1e-9 ? scale3(d, 1 / dist) : [0, 1, 0];
  let u = across(pole, n);
  if (norm(u) < 1e-9) {
    // hướng khuỷu trùng trục: lấy một hướng vuông góc bất kỳ, ưu tiên xuống dưới
    u = across([0, 1, 0], n);
    if (norm(u) < 1e-9) u = across([1, 0, 0], n);
  }
  u = scale3(u, 1 / norm(u));
  const reach = Math.min(Math.max(dist, Math.abs(l1 - l2)), l1 + l2);
  const a = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach || 1);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mid = add3(add3(root, scale3(n, a)), scale3(u, h));
  const end = add3(root, scale3(n, reach));
  return [root, mid, end];
}

/** Pháp tuyến của mặt phẳng chi (hướng khuỷu) suy từ một chuỗi đã có; chuỗi thẳng thì không có */
export function bendOf([a, b, c]: V3[]): V3 | undefined {
  const d = sub3(c, a);
  const l = norm(d);
  if (l < 1e-9) return undefined;
  const u = across(sub3(b, a), scale3(d, 1 / l));
  const m = norm(u);
  return m < 1e-6 * l ? undefined : scale3(u, 1 / m);
}

const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/**
 * Góc tay `[vai, khuỷu, 0]` suy từ đích, cho mốc có đích mà không ghi góc kênh ấy — đoạn hoà sang mốc ghi góc đi
 * từ góc này (`Reach.w`): IK hai đoạn trong mặt phẳng dọc của thân với số đo mặc định ở `height = 1`, bỏ thành phần ngang. `torso` là góc cúi thân
 * của cùng mốc — góc tay đo trong khung thân.
 */
export function reachAngles(r: Pick<Reach, "at" | "elbow">, torso = 0): Arm {
  const lam = torso * D;
  const shY = -RIG.torso + 20;
  const S = [-shY * Math.sin(lam), shY * Math.cos(lam)];
  const df = r.at[0] - S[0];
  const dy = r.at[1] - S[1];
  const inT = (f: number, y: number) => [
    f * Math.cos(lam) + y * Math.sin(lam),
    -f * Math.sin(lam) + y * Math.cos(lam),
  ];
  const [x, y] = inT(df, dy);
  const [px, py] = inT((r.elbow ?? REACH_ELBOW)[0], (r.elbow ?? REACH_ELBOW)[1]);
  const l1 = RIG.upperArm;
  const l2 = RIG.foreArm;
  const dist = Math.min(Math.hypot(x, y), l1 + l2);
  const phi = Math.atan2(x, y) / D;
  const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * Math.max(dist, 1e-9));
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosA))) / D;
  // khuỷu về phía hướng khuỷu: phía `+α` là phía đã quay về trước so với trục vai → cổ tay
  const fwd = px * Math.cos(phi * D) - py * Math.sin(phi * D) > 0;
  const a0 = phi + (fwd ? alpha : -alpha);
  const ex = l1 * Math.sin(a0 * D);
  const ey = l1 * Math.cos(a0 * D);
  const a1 = dist >= l1 + l2 - 1e-9 ? 0 : wrap180(Math.atan2(x - ex, y - ey) / D - a0);
  return [a0, a1, 0];
}
