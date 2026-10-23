import { HAND_DOF, HAND_FIT, type HandPose, type HandVec } from "./hand";
import {
  graspLink,
  gripCenter,
  handAxes,
  type AuthoredGrasp,
  type GraspHand,
  type GripFrame,
  type GroupId,
  type HeldItemSpec,
} from "./heldItem";
import {
  cross3,
  dot3,
  fromColumns,
  matMul,
  matVec,
  scale3,
  sub3,
  add3,
  type M3,
  type V3,
} from "./lens";

/**
 * Kiểu cầm soạn tay (`authored` của món, `AuthoredGraspSchema`): đổi bản soạn ra bàn tay cầm trong khung món cho từng bên
 * tay và cỡ tay, dời theo chỗ tiếp xúc khi cảnh cầm ở lựa chọn khác lúc soạn, và dựng bản soạn từ khung cầm studio đang
 * thấy. `graspFrame` dùng bản soạn thay chỗ tiếp xúc của nhóm. docs/11-nhom-cam.md § Kiểu cầm soạn tay
 */

/** Tầm `heldFit` cuộn thêm từ dáng soạn khi bản soạn không khai `curl`, độ: chỉ khép khe nhỏ ở tay cỡ khác */
export const AUTHORED_CURL = 10;

/** Bản soạn tay của món × nhóm × biến thể, nếu có */
export const authoredOf = (
  spec: HeldItemSpec,
  group: GroupId,
  variant: string,
): AuthoredGrasp | undefined => spec.authored?.[group]?.[variant];

const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];
const unit = (a: V3): V3 => scale3(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

/** Ma trận quay (hàng trước, như `matVec`) của quaternion `[x, y, z, w]` */
export function quatM3(q: readonly number[]): M3 {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  const [x, y, z, w] = q.map((v) => v / n);
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

/** Quaternion `[x, y, z, w]` của ma trận quay `R` (hàng trước), `w ≥ 0` */
export function m3Quat(R: M3): [number, number, number, number] {
  const [a, b, c, d, e, f, g, h, i] = R;
  const tr0 = a + e + i;
  let q: [number, number, number, number];
  if (tr0 > 0) {
    const s = 0.5 / Math.sqrt(tr0 + 1);
    q = [(h - f) * s, (c - g) * s, (d - b) * s, 0.25 / s];
  } else if (a > e && a > i) {
    const s = 2 * Math.sqrt(1 + a - e - i);
    q = [0.25 * s, (b + d) / s, (c + g) / s, (h - f) / s];
  } else if (e > i) {
    const s = 2 * Math.sqrt(1 + e - a - i);
    q = [(b + d) / s, 0.25 * s, (f + h) / s, (c - g) / s];
  } else {
    const s = 2 * Math.sqrt(1 + i - a - e);
    q = [(c + g) / s, (f + h) / s, 0.25 * s, (d - b) / s];
  }
  const n = Math.hypot(...q);
  return q.map((v) => (q[3] < 0 ? -v : v) / n) as [number, number, number, number];
}

/** Bàn tay cầm trong khung món: tâm nắm, lòng tay, ngón (đơn vị, trực giao với lòng tay) */
export type HandPlace = Pick<GraspHand, "at" | "palm" | "fingers">;

/**
 * Bàn tay soạn đổi ra bàn tay cầm trong khung món cho tay bên `side`, ở chỗ tiếp xúc lúc soạn: tâm nắm là điểm món nằm ở
 * tâm nắm dáng `anchor` của tay phải cỡ 1. Tay trái soi gương theo khung của biến thể (docs/11 mục 3, "Tay trái không soi
 * gương món"): `nf` giữ lòng tay và ngón (ngón cái sang phía kia), `nt` giữ lòng tay và phía ngón cái (ngón đổi chiều) —
 * đường dự phòng khi không dựng được chỗ tiếp xúc lúc soạn; thường tay trái đi `mirrorHand`
 */
export function authoredHand(a: AuthoredGrasp, side: number, frame: "nf" | "nt"): HandPlace {
  const Rt = tr(quatM3(a.item.q));
  const c = gripCenter(a.anchor, -1, 1, 1);
  const at = scale3(matVec(Rt, sub3(c, a.item.p as V3)), 100);
  const palm = matVec(Rt, [1, 0, 0]);
  const f = matVec(Rt, [0, -1, 0]);
  return { at, palm, fingers: side > 0 && frame === "nt" ? neg(f) : f };
}

/**
 * Bàn tay cầm (khung món, đơn vị rig) của khung cầm `G` ở tay bên `side` cỡ `k`, `long`: điểm món nằm ở tâm nắm dáng
 * `anchor`, lòng tay, ngón. Nghịch của `graspLink`
 */
export function gripHand(G: GripFrame, anchor: HandPose, side: number, k = 1, long = k): HandPlace {
  const Rt = tr(G.R);
  const { n, f } = handAxes(side);
  return {
    at: scale3(matVec(Rt, sub3(gripCenter(anchor, side, k, long), G.p)), 1 / G.u),
    palm: matVec(Rt, n),
    fingers: matVec(Rt, f),
  };
}

/** Khung trực giao (cột: lòng tay, ngón, lòng tay × ngón) của một bàn tay cầm */
function basis(h: HandPlace): M3 {
  const n = unit(h.palm);
  const f = unit(sub3(h.fingers, scale3(n, dot3(h.fingers, n))));
  return fromColumns(n, f, cross3(n, f));
}

/**
 * Dời bàn tay `h` (khung món) đi cùng chỗ tiếp xúc từ `from` (lựa chọn lúc soạn) sang `to` (lựa chọn ở cảnh): giữ nguyên
 * bàn tay trong khung của chỗ tiếp xúc. Cùng lựa chọn thì `h` không đổi
 */
export function slideHand(h: HandPlace, from: HandPlace, to: HandPlace): HandPlace {
  const M = matMul(basis(to), tr(basis(from)));
  return {
    at: add3(to.at, matVec(M, sub3(h.at, from.at))),
    palm: matVec(M, h.palm),
    fingers: matVec(M, h.fingers),
  };
}

/** Gương trái ↔ phải trong toạ độ của chỗ tiếp xúc (lòng tay, ngón, lòng tay × ngón): khung bàn tay lật `x` (`handFrames`) */
const MIRROR: M3 = [1, 0, 0, 0, 1, 0, 0, 0, -1];

/**
 * Bàn tay soạn `h` của tay phải (khung món) đổi sang tay trái qua chỗ tiếp xúc của bộ giải ở cùng lựa chọn: `right`, `left`
 * là chỗ tiếp xúc của tay phải, tay trái. Độ lệch của `h` so với `right` (trong khung của `right`) soi gương rồi đặt lên
 * `left`, nên bản soạn trùng bộ giải thì tay trái trùng bộ giải, và lệch bao nhiêu thì tay trái lệch gương bấy nhiêu.
 * Phép gương tự nghịch: `mirrorHand(mirrorHand(h, right, left), left, right)` là `h`
 */
export function mirrorHand(h: HandPlace, right: HandPlace, left: HandPlace): HandPlace {
  const Br = basis(right);
  const Bl = basis(left);
  const Q = matMul(MIRROR, matMul(matMul(tr(Br), basis(h)), MIRROR));
  const d = matVec(MIRROR, matVec(tr(Br), sub3(h.at, right.at)));
  const B = matMul(Bl, Q);
  return {
    at: add3(left.at, matVec(Bl, d)),
    palm: [B[0], B[3], B[6]],
    fingers: [B[1], B[4], B[7]],
  };
}

const r5 = (x: number) => Math.round(x * 1e5) / 1e5 || 0;

/** Trường của lựa chọn cầm mà bản soạn ghi (`AuthoredGraspSchema.choice`): `feature`, `variant` đã nằm ở khoá bản soạn */
const CHOICE_KEYS = [
  "part",
  "featureIndex",
  "edge",
  "along",
  "thumb",
  "slant",
  "tilt",
  "around",
  "psi",
  "inset",
  "high",
] as const;

/** Lựa chọn lúc soạn từ lựa chọn đã điền của khung cầm (`GraspFrame.choice`) và đầu cao của cạnh: chỉ các trường bản soạn ghi */
export function authoredChoice(c: object, high?: readonly number[]): AuthoredGrasp["choice"] {
  const src = { ...c, ...(high && { high: [...high] }) } as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of CHOICE_KEYS)
    if (src[k] !== undefined) out[k] = typeof src[k] === "number" ? r5(src[k] as number) : src[k];
  return out as AuthoredGrasp["choice"];
}

/**
 * Bản soạn từ khung cầm của tay **phải** cỡ `k`, `long` mà người đang thấy: `G` món trong khung bàn tay (đơn vị `G.u` của
 * người cỡ `G.u / 0,01`), dáng `v` (`HAND_DOF`, có thể kèm `HAND_FIT`), tâm nắm neo `anchor`. Đổi về tay cỡ 1 quanh tâm nắm
 * ấy, nên rig dựng lại đúng khung này ở cỡ `k`, `long`
 */
export function authoredFrom(
  G: GripFrame,
  anchor: HandPose,
  k: number,
  long: number,
  v: HandVec,
  choice?: AuthoredGrasp["choice"],
  curl?: number,
): AuthoredGrasp {
  const hand: GraspHand = { pose: anchor, ...gripHand(G, anchor, -1, k, long) };
  const G1 = graspLink(hand, -1, 1, 1, 1);
  const n = HAND_DOF.length;
  const fit = Array.from({ length: HAND_FIT.length }, (_, i) => r5(v[n + i] ?? 0));
  return {
    item: { p: G1.p.map(r5) as V3, q: m3Quat(G1.R).map(r5) as AuthoredGrasp["item"]["q"] },
    anchor,
    fingers: Array.from({ length: n - 2 }, (_, i) =>
      r5(v[2 + i] ?? 0),
    ) as unknown as AuthoredGrasp["fingers"],
    ...(fit.some((x) => x !== 0) && { fit: fit as unknown as AuthoredGrasp["fingers"] }),
    ...(curl !== undefined && { curl }),
    ...(choice && Object.keys(choice).length && { choice: authoredChoice(choice) }),
  };
}

/** Dáng gốc của bản soạn (`HAND_DOF` rồi `HAND_FIT` nếu có): cổ tay thẳng, cảnh giải cổ tay */
export const authoredPose = (a: AuthoredGrasp): number[] => [
  0,
  0,
  ...a.fingers,
  ...(a.fit?.some((x) => x !== 0) ? a.fit : []),
];
