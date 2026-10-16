import { fingerVec, HAND_POSES, HAND_RELAXED, type HandPose, type HandVec } from "./hand";
import { depthAt, project, type V3 } from "./lens";
import { handClips, PALM_HAND_LABELS, type PalmHand } from "./palm";
import { cameraAt, type SceneRuntime } from "./scene";

/**
 * Đo đồ cầm tay của người 3D mặc đồ: dáng tay vẽ so với dáng khai, ngón lún vào món, ngón ôm món, món xoay đúng ý,
 * tâm nắm và lòng tay tới món, món trôi trong bàn tay suốt một lần cầm. Phần hình học ở đây thuần (mảng tam giác,
 * điểm ba số); cảnh three đưa số đo từng khung qua `HeldHand` (`heldHands` của người 3D). docs/03-scene.md#đồ-cầm-tay
 */

/** Nhịp lấy mẫu, giây */
export const HELD_EVERY = 0.1;
/** Chỉ báo quãng kéo dài từ ngần này giây (lỗi trôi báo ở mọi độ dài) */
export const HELD_HOLD = 0.3;
/**
 * Dáng hành động khai (dáng có tên gần góc ngón của nó nhất, `nearestHandPose`) khác dáng `hold` đang vẽ, và góc ngón
 * (trung bình bình phương, độ) lệch quá ngần này: hai dáng gần nhau nhất của bảng (`cup`, `flat`) cách `8`, `grip` và
 * `pinch` cách `17`. Hành động không khai dáng (gần dáng nghỉ nhất) thì không so
 */
export const HELD_POSE = 6;
/**
 * Trục nang ngón hay lòng tay (xương ngón) vào trong lưới hiện hình của món quá ngần này (đơn vị rig) là ngón xuyên đồ.
 * Đo trục chứ không đo da: nang bàn tay mập (bán kính 2,5–7) nên da chạm món là đã lún vài đơn vị, còn trục chỉ vào trong
 * món được tới nửa bề dày của nó — đũa, cán mảnh nằm trong nắm tay đóng không quá `1,1`, ngón lọt vào máy, vào ống nghe
 * từ `1,5`
 */
export const HELD_PIERCE = 1.25;
/** Nang cách mặt món không quá ngần này (đơn vị rig, âm là lún) là chạm món */
export const HELD_TOUCH = 1;
/** Tâm nắm ngoài mặt món quá ngần này (đơn vị rig) là món không nằm trong tay; dáng kẹp đầu ngón dùng `HELD_GRIP_PINCH` */
export const HELD_GRIP = 3;
export const HELD_GRIP_PINCH = 5;
/** Trục `up` của món lệch hướng lên của thế giới quá ngần này độ */
export const HELD_UP = 30;
/**
 * Trục `face` của món lệch hướng tới mặt người cầm hay ống kính quá ngần này độ: máy cầm bấm trước ngực, màn ngửa chếch
 * lên, lệch hướng tới mặt người cầm chừng `55`
 */
export const HELD_FACE = 65;
/** Món dời trong khung bàn tay quá ngần này (đơn vị rig) hay xoay quá `HELD_TURN` độ so với lúc bắt đầu cầm là trôi */
export const HELD_DRIFT = 3;
export const HELD_TURN = 20;
/** Số vòng (winding number) của điểm so với lưới món từ ngần này là điểm ở trong món: lưới ghép nhiều mảnh hở vẫn đúng */
export const HELD_WIND = 0.75;

/** Dáng kẹp bằng đầu ngón: món ngồi giữa ngón cái và ngón đối diện, lòng tay không áp */
export const HELD_PINCHES: readonly HandPose[] = ["pinch", "edge", "span", "hook"];

/** Nhóm ngón khi đo độ ôm */
export type HeldGroup = "thumb" | "index" | "fingers" | "palm";
export const HELD_GROUP_LABELS: Record<HeldGroup, string> = {
  thumb: "cái",
  index: "trỏ",
  fingers: "giữa–út",
  palm: "lòng",
};

/** Hướng mặt món (`face`) phải quay về: mặt người cầm hay ống kính */
export type HeldToward = "holderFace" | "camera";

/** Ý định của món khai ở `userData.hold` của vật cầm (trục trong khung món, three: y lên) */
export interface HeldIntent {
  up?: V3;
  face?: V3;
  faceToward?: HeldToward;
}

/** Số đo một bàn tay đang cầm một món ở một giây — `heldHands` của người 3D đưa ra. Đơn vị rig, góc độ */
export interface HeldHand {
  id: string;
  hand: PalmHand;
  /** Tên món */
  item: string;
  /** Một lần cầm: đổi khi cầm món khác, đổi dáng, đổi cách bám hay đổi `offset` / `rotate` */
  key: string;
  /** Dáng `hold` đang vẽ và cách bám */
  pose: HandPose;
  follow: string;
  /** Số bàn tay hành động đặt (`HAND_DOF`), trước khi `hold` đè ngón */
  acted: readonly number[];
  /**
   * Nang có trục vào trong món sâu nhất: `core` trục vào trong mặt món bấy nhiêu (âm là trục còn ngoài), `depth` da lún qua
   * mặt món (âm là khe), tên đốt
   */
  pierce: { depth: number; core: number; piece: string };
  /** Khe nhỏ nhất từ từng nhóm ngón tới mặt món (âm là lún) */
  gaps: Record<HeldGroup, number>;
  /** Tâm nắm của dáng đang vẽ tới mặt món: dương ở ngoài, âm ở trong món */
  grip: number;
  /** Giữa lòng tay tới mặt món, góc giữa pháp tuyến lòng tay và hướng tới chỗ gần nhất của món */
  palm: { gap: number; angle: number };
  /** Góc lệch của trục ý định, nếu món khai */
  up?: number;
  face?: { angle: number; toward: HeldToward };
  /** Món trong khung bàn tay: gốc (đơn vị rig) và quaternion `[x, y, z, w]` */
  rel: { p: V3; q: readonly [number, number, number, number] };
  /** Tâm nắm, thế giới rig: để bỏ bàn tay ngoài khung camera */
  at: V3;
}

// ── Hình học thuần trên mảng tam giác (9 số một tam giác) ───────────────────────────────────────────────────────────

/** Lưới tam giác của món: một hay nhiều mảng 9 số mỗi tam giác, cùng một hệ toạ độ */
export type HeldMesh = readonly ArrayLike<number>[];

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const deg = (c: number) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;

/** Góc giữa hai hướng, độ */
export const angleBetween = (a: V3, b: V3) => {
  const n = len(a) * len(b);
  return n > 1e-12 ? deg(dot(a, b) / n) : 0;
};

/** Điểm gần `p` nhất trên tam giác `a b c` (Ericson, Real-Time Collision Detection 5.1.5) */
export function triClosest(p: V3, a: V3, b: V3, c: V3): V3 {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v];
  }
  const cp = sub(p, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w];
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w];
  }
  const den = 1 / (va + vb + vc);
  const v = vb * den;
  const w = vc * den;
  return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}

/** Khoảng cách hai đoạn thẳng `p1 q1`, `p2 q2` */
export function segSegDistance(p1: V3, q1: V3, p2: V3, q2: V3): number {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  let s = 0;
  let t = 0;
  if (a < 1e-18 && e < 1e-18) return len(r);
  if (a < 1e-18) t = clamp01(f / e);
  else {
    const c = dot(d1, r);
    if (e < 1e-18) s = clamp01(-c / a);
    else {
      const b = dot(d1, d2);
      const den = a * e - b * b;
      s = den > 1e-18 ? clamp01((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  return len([
    p1[0] + d1[0] * s - p2[0] - d2[0] * t,
    p1[1] + d1[1] * s - p2[1] - d2[1] * t,
    p1[2] + d1[2] * s - p2[2] - d2[2] * t,
  ]);
}

const at3 = (t: ArrayLike<number>, i: number): V3 => [t[i], t[i + 1], t[i + 2]];

/** Đoạn `a b` cắt qua tam giác `A B C` */
function segHitsTri(a: V3, b: V3, A: V3, B: V3, C: V3): boolean {
  const n: V3 = [
    (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]),
    (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]),
    (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]),
  ];
  const da = dot(n, sub(a, A));
  const db = dot(n, sub(b, A));
  if (da * db > 0 || da === db) return false;
  const u = da / (da - db);
  const p: V3 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  const side = (x: V3, y: V3) => {
    const e = sub(y, x);
    const q = sub(p, x);
    return dot(n, [
      e[1] * q[2] - e[2] * q[1],
      e[2] * q[0] - e[0] * q[2],
      e[0] * q[1] - e[1] * q[0],
    ]);
  };
  const s1 = side(A, B);
  const s2 = side(B, C);
  const s3 = side(C, A);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

/** Hộp bao của lưới: `[minX, minY, minZ, maxX, maxY, maxZ]` */
export function meshBox(mesh: HeldMesh): number[] {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const t of mesh)
    for (let i = 0; i + 2 < t.length; i += 3)
      for (let k = 0; k < 3; k++) {
        const v = t[i + k];
        if (v < b[k]) b[k] = v;
        if (v > b[3 + k]) b[3 + k] = v;
      }
  return b;
}

/** Khoảng cách từ `p` tới hộp `box` (`meshBox`), `0` khi ở trong */
export function boxDistance(box: readonly number[], p: V3): number {
  let s = 0;
  for (let k = 0; k < 3; k++) {
    const d = Math.max(box[k] - p[k], 0, p[k] - box[3 + k]);
    s += d * d;
  }
  return Math.sqrt(s);
}

/**
 * Số vòng của lưới quanh `p` (tổng góc khối các tam giác chia `4π`, Van Oosterom–Strackee): `±1` trong món kín, `0`
 * ngoài, ở giữa khi lưới hở; lấy trị tuyệt đối nên chiều quấn tam giác không quan trọng
 */
export function meshWinding(mesh: HeldMesh, p: V3): number {
  let sum = 0;
  for (const t of mesh)
    for (let i = 0; i + 8 < t.length; i += 9) {
      const ax = t[i] - p[0];
      const ay = t[i + 1] - p[1];
      const az = t[i + 2] - p[2];
      const bx = t[i + 3] - p[0];
      const by = t[i + 4] - p[1];
      const bz = t[i + 5] - p[2];
      const cx = t[i + 6] - p[0];
      const cy = t[i + 7] - p[1];
      const cz = t[i + 8] - p[2];
      const la = Math.hypot(ax, ay, az);
      const lb = Math.hypot(bx, by, bz);
      const lc = Math.hypot(cx, cy, cz);
      const det = ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
      const den =
        la * lb * lc +
        (ax * bx + ay * by + az * bz) * lc +
        (ax * cx + ay * cy + az * cz) * lb +
        (bx * cx + by * cy + bz * cz) * la;
      sum += 2 * Math.atan2(det, den);
    }
  return Math.abs(sum / (4 * Math.PI));
}

/** Chỗ gần `p` nhất trên mặt lưới và khoảng cách tới nó */
export function meshClosest(mesh: HeldMesh, p: V3): { d: number; q: V3 } {
  let best = Infinity;
  let q: V3 = p;
  for (const t of mesh)
    for (let i = 0; i + 8 < t.length; i += 9) {
      const c = triClosest(p, at3(t, i), at3(t, i + 3), at3(t, i + 6));
      const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
      if (d < best) {
        best = d;
        q = c;
      }
    }
  return { d: Math.sqrt(best), q };
}

/** `p` ở trong món: hộp bao rồi số vòng từ `HELD_WIND` */
export const meshInside = (mesh: HeldMesh, p: V3, box = meshBox(mesh)) =>
  boxDistance(box, p) === 0 && meshWinding(mesh, p) >= HELD_WIND;

/** Khoảng cách có dấu từ `p` tới món: dương ở ngoài, âm ở trong; kèm chỗ gần nhất trên mặt */
export function meshSigned(mesh: HeldMesh, p: V3, box = meshBox(mesh)): { d: number; q: V3 } {
  const c = meshClosest(mesh, p);
  return meshInside(mesh, p, box) ? { d: -c.d, q: c.q } : c;
}

/** Khoảng cách đoạn `a b` tới mặt lưới (`0` khi cắt qua); bỏ tam giác có hộp xa hơn `cut` */
export function segMeshDistance(mesh: HeldMesh, a: V3, b: V3, cut = Infinity): number {
  let best = cut;
  const lo = [0, 1, 2].map((k) => Math.min(a[k], b[k]) - cut);
  const hi = [0, 1, 2].map((k) => Math.max(a[k], b[k]) + cut);
  for (const t of mesh)
    for (let i = 0; i + 8 < t.length; i += 9) {
      let out = false;
      for (let k = 0; k < 3 && !out; k++) {
        const m0 = Math.min(t[i + k], t[i + 3 + k], t[i + 6 + k]);
        const m1 = Math.max(t[i + k], t[i + 3 + k], t[i + 6 + k]);
        out = m1 < lo[k] || m0 > hi[k];
      }
      if (out) continue;
      const A = at3(t, i);
      const B = at3(t, i + 3);
      const C = at3(t, i + 6);
      if (segHitsTri(a, b, A, B, C)) return 0;
      const d = Math.min(
        len(sub(triClosest(a, A, B, C), a)),
        len(sub(triClosest(b, A, B, C), b)),
        segSegDistance(a, b, A, B),
        segSegDistance(a, b, B, C),
        segSegDistance(a, b, C, A),
      );
      if (d < best) best = d;
    }
  return best;
}

/**
 * Độ lún của viên nang `a b` bán kính `r` vào món: dương là da lún qua mặt món bấy nhiêu, âm là khe tới mặt. Trục nang
 * có điểm ở trong món thì lún là `r` cộng độ sâu của điểm ấy; trục ngoài món mà cắt qua mặt (tấm mỏng) thì lún `r`.
 * `reach` là khe xa nhất cần đo đúng: xa hơn thì trả khe tới hộp bao
 */
export function capsuleDepth(
  mesh: HeldMesh,
  a: V3,
  b: V3,
  r: number,
  reach: number,
  box = meshBox(mesh),
): number {
  const L = len(sub(b, a));
  const far = Math.min(boxDistance(box, a), boxDistance(box, b));
  if (far - L > r + reach) return r - (far - L);
  const n = Math.max(2, Math.min(12, Math.ceil(L / Math.max(r * 0.5, 1e-9)))) + 1;
  let inside = 0;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const p: V3 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    if (meshInside(mesh, p, box)) inside = Math.max(inside, meshClosest(mesh, p).d);
  }
  if (inside > 0) return r + inside;
  return r - segMeshDistance(mesh, a, b, r + reach);
}

// ── Dáng tay ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Góc ngón (trung bình bình phương trên chín góc ngón, độ) giữa số bàn tay `v` (`HAND_DOF`) và dáng `pose` */
export function handPoseOff(v: HandVec, pose: HandPose | "rest"): number {
  const ref = fingerVec(pose === "rest" ? HAND_RELAXED : HAND_POSES[pose]);
  const f = v.slice(2);
  return Math.sqrt(ref.reduce((s, r, i) => s + (r - (f[i] ?? 0)) ** 2, 0) / ref.length);
}

/** Dáng có tên gần số bàn tay `v` nhất (kể cả dáng nghỉ) và góc lệch tới nó */
export function nearestHandPose(v: HandVec): { pose: HandPose | "rest"; off: number } {
  let best: { pose: HandPose | "rest"; off: number } = {
    pose: "rest",
    off: handPoseOff(v, "rest"),
  };
  for (const pose of Object.keys(HAND_POSES) as HandPose[]) {
    const off = handPoseOff(v, pose);
    if (off < best.off) best = { pose, off };
  }
  return best;
}

/** Góc giữa hai quaternion `[x, y, z, w]`, độ */
export function quatAngle(a: readonly number[], b: readonly number[]): number {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return (2 * Math.acos(Math.min(1, d)) * 180) / Math.PI;
}

// ── Luật trên cả cảnh ──────────────────────────────────────────────────────────────────────────────────────────────

export type HeldRule = "pose" | "pierce" | "loose" | "grip" | "up" | "face" | "drift";

export interface HeldOptions {
  /** Số đo các bàn tay đang cầm đồ ở giây `t` (`heldHands` của người 3D trên cảnh three) */
  frame: (t: number) => readonly HeldHand[] | null | undefined;
  /** Ngưỡng, mặc định các hằng `HELD_*`; giây, mặc định `HELD_HOLD`, `HELD_EVERY` */
  pose?: number;
  pierce?: number;
  touch?: number;
  grip?: number;
  up?: number;
  face?: number;
  drift?: number;
  turn?: number;
  hold?: number;
  every?: number;
}

export interface HeldIssue {
  id: string;
  hand: PalmHand;
  item: string;
  rule: HeldRule;
  /** Giây tệ nhất và số đo ở giây ấy */
  t: number;
  /** Độ nặng để chọn giây tệ nhất và sắp dòng: lún, góc, khe, độ trôi */
  worst: number;
  sample: HeldHand;
  /** Dáng hành động khai (dáng gần nhất của `acted`) */
  declared: { pose: HandPose | "rest"; off: number };
  /** Trôi: dời (rig) và xoay (độ) so với lúc bắt đầu cầm */
  drift?: { move: number; turn: number; from: number };
  runs: [number, number][];
  clips: string[];
}

/** Bao nhiêu nhóm ngón (cái, trỏ, giữa–út) chạm món, và nhóm nào */
export function heldWrap(s: Pick<HeldHand, "gaps">, touch = HELD_TOUCH): HeldGroup[] {
  return (["thumb", "index", "fingers", "palm"] as const).filter((g) => s.gaps[g] <= touch);
}

/** Các luật một bàn tay phạm ở một giây (trừ `drift`, đo trên cả lần cầm) */
export function heldHits(
  s: HeldHand,
  o: Omit<HeldOptions, "frame"> = {},
): { rule: HeldRule; worst: number }[] {
  const out: { rule: HeldRule; worst: number }[] = [];
  const decl = nearestHandPose(s.acted);
  const off = handPoseOff(s.acted, s.pose);
  if (decl.pose !== "rest" && decl.pose !== s.pose && off > (o.pose ?? HELD_POSE))
    out.push({ rule: "pose", worst: off });
  if (s.pierce.core > (o.pierce ?? HELD_PIERCE)) out.push({ rule: "pierce", worst: s.pierce.core });
  const wrap = heldWrap(s, o.touch);
  if (!wrap.length) out.push({ rule: "loose", worst: Math.min(...Object.values(s.gaps)) });
  const pinch = HELD_PINCHES.includes(s.pose);
  if (s.grip > (pinch ? HELD_GRIP_PINCH : (o.grip ?? HELD_GRIP)))
    out.push({ rule: "grip", worst: s.grip });
  if (s.up !== undefined && s.up > (o.up ?? HELD_UP)) out.push({ rule: "up", worst: s.up });
  if (s.face && s.face.angle > (o.face ?? HELD_FACE))
    out.push({ rule: "face", worst: s.face.angle });
  return out;
}

/**
 * Đồ cầm tay sai trên cả cảnh: lấy mẫu mỗi `every` giây số đo của `frame`, báo quãng từ `hold` giây trở lên mà một bàn tay
 * phạm một luật (`heldHits`), và lần cầm nào món trôi trong khung bàn tay quá `drift` / `turn`. Bỏ bàn tay ngoài khung
 * camera. Mỗi người, mỗi tay, mỗi món, mỗi luật một mục. docs/03-scene.md#đồ-cầm-tay
 */
export function sceneHeld(rt: SceneRuntime, o: HeldOptions): HeldIssue[] {
  const every = o.every ?? HELD_EVERY;
  const hold = o.hold ?? HELD_HOLD;
  const n = Math.floor(rt.duration / every + 1e-6);
  const times = Array.from({ length: n + 1 }, (_, i) => +(i * every).toFixed(4));
  type Run = {
    rule: HeldRule;
    s: HeldHand;
    t: number;
    worst: number;
    from: number;
    to: number;
    last: number;
    drift?: HeldIssue["drift"];
  };
  const open = new Map<string, Run>();
  const done: Run[] = [];
  const close = (k: string) => {
    const r = open.get(k)!;
    open.delete(k);
    if (r.rule === "drift" || r.to - r.from + every >= hold - 1e-9) done.push(r);
  };
  // lần cầm đang chạy của từng bàn tay: khoá, món trong khung bàn tay lúc đầu
  const grips = new Map<string, { key: string; s: HeldHand; t: number }>();
  const hit = (k: string, i: number, t: number, run: Omit<Run, "from" | "to" | "last">) => {
    const r = open.get(k);
    if (r && r.last === i - 1) {
      r.to = t;
      r.last = i;
      if (run.worst > r.worst) Object.assign(r, run);
    } else {
      if (r) close(k);
      open.set(k, { ...run, from: t, to: t, last: i });
    }
  };
  times.forEach((t, i) => {
    const view = rt.lens && cameraAt(rt, t).view;
    const seen = new Set<string>();
    const held = new Set<string>();
    for (const s of o.frame(t) ?? []) {
      const who = `${s.id}|${s.hand}`;
      held.add(who);
      const g = grips.get(who);
      if (!g || g.key !== s.key) grips.set(who, { key: s.key, s, t });
      if (rt.lens && view) {
        if (depthAt(rt.lens, s.at) <= 0) continue;
        const [x, y] = project(rt.lens, s.at);
        if (x < view.x || x > view.x + view.w || y < view.y || y > view.y + view.h) continue;
      }
      const base = `${who}|${s.item}`;
      for (const h of heldHits(s, o)) {
        const k = `${base}|${h.rule}`;
        seen.add(k);
        hit(k, i, t, { rule: h.rule, s, t, worst: h.worst });
      }
      const g0 = grips.get(who)!;
      const move = len(sub(s.rel.p, g0.s.rel.p));
      const turn = quatAngle(s.rel.q, g0.s.rel.q);
      if (move > (o.drift ?? HELD_DRIFT) || turn > (o.turn ?? HELD_TURN)) {
        const k = `${base}|drift`;
        seen.add(k);
        const worst = Math.max(move / (o.drift ?? HELD_DRIFT), turn / (o.turn ?? HELD_TURN));
        hit(k, i, t, { rule: "drift", s, t, worst, drift: { move, turn, from: g0.t } });
      }
    }
    for (const who of [...grips.keys()]) if (!held.has(who)) grips.delete(who);
    for (const k of [...open.keys()]) if (!seen.has(k)) close(k);
  });
  for (const k of [...open.keys()]) close(k);
  const merged = new Map<string, HeldIssue>();
  for (const r of done.sort((a, b) => a.from - b.from)) {
    const k = `${r.s.id}|${r.s.hand}|${r.s.item}|${r.rule}`;
    const prev = merged.get(k);
    if (prev) {
      prev.runs.push([r.from, r.to]);
      if (r.worst <= prev.worst) continue;
    }
    const m = rt.cast.find((x) => x.id === r.s.id);
    merged.set(k, {
      id: r.s.id,
      hand: r.s.hand,
      item: r.s.item,
      rule: r.rule,
      t: r.t,
      worst: r.worst,
      sample: r.s,
      declared: nearestHandPose(r.s.acted),
      ...(r.drift && { drift: r.drift }),
      runs: prev ? prev.runs : [[r.from, r.to]],
      clips: m ? handClips(m, r.t) : [],
    });
  }
  const order: HeldRule[] = ["pierce", "pose", "grip", "loose", "face", "up", "drift"];
  return [...merged.values()].sort(
    (a, b) => order.indexOf(a.rule) - order.indexOf(b.rule) || b.worst - a.worst,
  );
}

const sec = (t: number) => t.toFixed(2);
const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const PIECE_LABELS: Record<string, string> = {
  palm: "lòng bàn tay",
  thenar: "gò ngón cái",
  thumb0: "đốt gốc ngón cái",
  thumb1: "đầu ngón cái",
  index0: "đốt gốc ngón trỏ",
  index1: "đầu ngón trỏ",
  middle0: "đốt gốc ngón giữa",
  middle1: "đầu ngón giữa",
  ring0: "đốt gốc ngón áp út",
  ring1: "đầu ngón áp út",
  pinky0: "đốt gốc ngón út",
  pinky1: "đầu ngón út",
};
export const heldPieceLabel = (p: string) => PIECE_LABELS[p] ?? p;

/** Các số đo chính của một giây, một dòng: dáng, lún, ôm, tâm nắm, lòng tay, trục */
export function heldSummary(s: HeldHand, touch = HELD_TOUCH): string {
  const wrap = heldWrap(s, touch);
  const parts = [
    `dáng ${s.pose} (${s.follow})`,
    s.pierce.core > 0
      ? `xương ${heldPieceLabel(s.pierce.piece)} vào trong món ${r1(s.pierce.core)}`
      : s.pierce.depth > 0
        ? `da lún ${r1(s.pierce.depth)} ở ${heldPieceLabel(s.pierce.piece)}`
        : `khe ${r1(-s.pierce.depth)}`,
    `ôm ${wrap.filter((g) => g !== "palm").length}/3${wrap.length ? ` (${wrap.map((g) => HELD_GROUP_LABELS[g]).join(", ")})` : ""}`,
    `tâm nắm ${s.grip < 0 ? `trong món ${r1(-s.grip)}` : `cách món ${r1(s.grip)}`}`,
    `lòng tay cách ${r1(s.palm.gap)}${s.palm.gap > 0.05 ? ` góc ${Math.round(s.palm.angle)}°` : ""}`,
  ];
  if (s.up !== undefined) parts.push(`trục lên lệch ${Math.round(s.up)}°`);
  if (s.face)
    parts.push(
      `mặt lệch ${Math.round(s.face.angle)}° khỏi ${s.face.toward === "camera" ? "ống kính" : "mặt người cầm"}`,
    );
  return parts.join(" · ");
}

/** Dòng báo của một mục đồ cầm sai, như `check` in */
export function heldLine(s: HeldIssue): string {
  const runs = s.runs
    .slice(0, 4)
    .map(([a, b]) => (a === b ? sec(a) : `${sec(a)}–${sec(b)}`))
    .join(", ");
  const more = s.runs.length > 4 ? `, +${s.runs.length - 4} quãng` : "";
  const who = `\`${s.id}\` ${PALM_HAND_LABELS[s.hand]} cầm ${s.item}`;
  const x = s.sample;
  const head: Record<HeldRule, () => string> = {
    pose: () =>
      `dáng tay cầm khác dáng khai — ${who}: hành động khai \`${s.declared.pose}\` mà \`hold\` vẽ \`${x.pose}\` (ngón lệch ${Math.round(s.worst)}°); truyền dáng ấy vào \`HoldOptions.pose\` hay sửa dáng khai`,
    pierce: () =>
      `ngón xuyên đồ — ${who}: trục ${heldPieceLabel(x.pierce.piece)} vào trong món ${r1(x.pierce.core)} (da lún ${r1(x.pierce.depth)}); dời món (\`offset\`, \`rotate\`) hay đổi dáng`,
    loose: () =>
      `món không chạm bàn tay — ${who}: không ngón nào, lòng tay cũng không chạm (khe nhỏ nhất ${r1(s.worst)})`,
    grip: () =>
      `món không nằm trong tay — ${who}: tâm nắm của dáng \`${x.pose}\` cách mặt món ${r1(x.grip)}`,
    up: () =>
      `món nghiêng — ${who}: trục lên của món lệch ${Math.round(x.up ?? 0)}° khỏi hướng lên`,
    face: () =>
      `mặt món quay sai — ${who}: mặt món lệch ${Math.round(x.face?.angle ?? 0)}° khỏi ${x.face?.toward === "camera" ? "ống kính" : "mặt người cầm"}`,
    drift: () =>
      `món trôi trong bàn tay — ${who} (\`follow: ${x.follow}\`): so với giây ${sec(s.drift!.from)} món dời ${r1(s.drift!.move)}, xoay ${Math.round(s.drift!.turn)}° trong khung bàn tay; cổ tay xoay mà món đứng theo người — bám cổ tay (\`follow: "wrist"\`) hay giữ cổ tay yên`,
  };
  const clips = s.clips.length ? `. Clip đang chạy: ${s.clips.join(", ")}` : "";
  return `${head[s.rule]()} ở giây ${sec(s.t)} · giây ${runs}${more}. Lúc ấy: ${heldSummary(x)}${clips} (docs/03-scene.md#đồ-cầm-tay)`;
}

/** `sceneHeld` ra dòng báo. docs/03-scene.md#đồ-cầm-tay */
export const sceneHeldProblems = (rt: SceneRuntime, o: HeldOptions): string[] =>
  sceneHeld(rt, o).map(heldLine);
