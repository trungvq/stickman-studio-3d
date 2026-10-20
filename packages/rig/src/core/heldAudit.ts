import { AIM_BEND, AIM_DEV } from "./act3";
import { TURN_MAX } from "./arm3";
import type { GraspChoice, GraspReport } from "./graspSolve";
import { GRIP_GROUPS, SIZE_WARN } from "./graspGroups";
import { fingerVec, HAND_POSES, HAND_RELAXED, type HandPose, type HandVec } from "./hand";
import { HELD_FIT, type FingerRoles } from "./heldFit";
import { itemGeom, type HandDims } from "./heldGeom";
import { depthAt, project, type V3 } from "./lens";
import {
  sceneHoldRef,
  type CarryOn,
  type GroupId,
  type HeldFinger,
  type HeldItemSpec,
} from "./heldItem";
import { CARRY } from "./heldCarry";
import { AIM_GAP } from "./constants";
import { handClips, PALM_HAND_LABELS, type PalmHand } from "./palm";
import { cameraAt, holdBlending, type SceneRuntime } from "./scene";

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
/**
 * Món có hình va chạm (`shape`): hình sát mặt món và ngón ôm theo nó, nên trục ngón vào trong hình quá ngần này (đơn vị
 * rig) đã là xuyên — kể cả tấm mỏng (phiếu, kẹp hồ sơ) mà trục ngón cắt qua
 */
export const HELD_PIERCE_FIT = 0.5;
/** Nang cách mặt món không quá ngần này (đơn vị rig, âm là lún) là chạm món */
export const HELD_TOUCH = 1;
/** Ngón kiểu cầm khai ôm (`wrap`) cách hình va chạm của món quá ngần này (đơn vị rig) là ngón hở */
export const HELD_WRAP = 1.5;
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
/**
 * Món dời trong khung bàn tay quá ngần này (đơn vị rig) hay xoay quá `HELD_TURN` độ so với lúc bắt đầu cầm là trôi (đường
 * cũ). Kiểu cầm cứng: món dời quá ngần ấy hay xoay quá `HELD_TURN` độ qua một mốc gắn, thả, đổi tay là nhảy
 */
export const HELD_DRIFT = 3;
export const HELD_TURN = 20;
/** Nửa quãng (giây) hai bên một mốc `hold` khi đo món nhảy */
export const HELD_JUMP_EPS = 1e-3;
/** Số vòng (winding number) của điểm so với lưới món từ ngần này là điểm ở trong món: lưới ghép nhiều mảnh hở vẫn đúng */
export const HELD_WIND = 0.75;

/** Dáng kẹp bằng đầu ngón: món ngồi giữa ngón cái và ngón đối diện, lòng tay không áp */
export const HELD_PINCHES: readonly HandPose[] = ["pinch", "edge", "span", "hook", "sheet"];

/** Chỗ cầm nhóm: da lún quá ngần này (đơn vị rig, đo trên da), `heldFit` đã nhắm khe `HELD_FIT.touch` trên da */
export const HELD_SINK = Math.abs(HELD_FIT.touch) + 0.5;
/** Món đặt trước: cổ tay vượt kẹp là lỗi `wrist`; còn cách giới hạn dưới ngần này độ là cảnh báo */
export const HELD_WRIST = 5;
/** Món đặt trước: bắp tay, cẳng tay lấn thân, đầu, tay kia quá ngần này lần bán kính tay ở chỗ lấn (`arm`) */
export const HELD_ARM = 0.3;

/**
 * Chỗ cầm nhóm: tâm nắm ngoài hình món quá ngần này là món không nằm trong tay — nhóm (hay biến thể) có dáng kẹp đầu ngón
 * (`HELD_PINCHES`) dùng `HELD_GRIP_PINCH`, còn lại `HELD_GRIP`
 */
export function heldGripMax(group: GroupId, variant?: string): number {
  const vs = GRIP_GROUPS[group].variants;
  const list = variant && vs[variant] ? [vs[variant]] : Object.values(vs);
  const pinch = list.some((v) =>
    [v.pose?.open.pose, v.pose?.closed.pose].some(
      (p) => p !== undefined && HELD_PINCHES.includes(p as HandPose),
    ),
  );
  return pinch ? HELD_GRIP_PINCH : HELD_GRIP;
}

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

/** Khớp cổ tay đang kẹp ở giới hạn khi giải ý định của món */
export type HeldClamp = "turn" | "bend" | "dev";

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
  /** Món có hình va chạm (`shape`): khe nhỏ nhất của từng ngón tới hình ấy (âm là lún); `wrap` các ngón kiểu cầm khai ôm */
  fingers?: Record<HeldFinger, number>;
  wrap?: readonly HeldFinger[];
  /** Chỗ cầm nhóm: vai trò ngón và lòng tay của biến thể (docs/11 mục 6) */
  roles?: FingerRoles;
  /** Tâm nắm của dáng đang vẽ tới mặt món (chỗ cầm nhóm: tới hình va chạm): dương ở ngoài, âm ở trong món */
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
  /** `id` của vật three của món: cùng món qua các giây */
  obj?: number;
  /**
   * Kiểu cầm cứng đang cầm, `món#kiểu` như `world.hands[].hold` (`held/<món>.json`), hay khoá lần cầm của chỗ cầm nhóm
   * `món@nhóm/biến thể/phần/cạnh/ngón cái`; không có là đường cũ
   */
  hold?: string;
  /** Cỡ người (`world.s`) */
  s?: number;
  /** Chỗ cầm nhóm có `size`: số đo của khối hình đã chọn, `W` của tay, tỉ lệ (`heldSize`) */
  size?: { of: number; W: number; ratio: number };
  /**
   * Kiểu cầm cứng, tay mang món: ý định trục chính bộ giải nhắm (`AimReport.hold`) — `up` khi đích là hướng lên, `face`
   * với mọi đích khác; góc còn lệch (độ), khớp cổ tay kẹp, đích như scene khai, hướng muốn và hướng đạt (thế giới rig)
   */
  intent?: {
    rule: "up" | "face";
    err: number;
    clamped: readonly HeldClamp[];
    toward?: string;
    want: V3;
    got: V3;
    /** Kiểu cầm khác của cùng món với cùng ý định, lệch còn lại (độ), ít trước (`AimReport.hold.alts`) */
    alts?: readonly { grip: string; err: number }[];
  };
  /** Chỗ cầm nhóm đã giải của lần cầm món đặt trước (`AimReport.hold.grasp`): nhóm, khối hình, cổ tay, khuỷu */
  grasp?: GraspReport;
  /**
   * Kiểu cầm cứng: đích do món đặt cho bàn tay — `support` tay phụ với tới mốc kiểu cầm của nó trên món, `item` điểm
   * `item:<mốc>` vào đích; khe còn lại (rig, đã chia cỡ người `s`)
   */
  reach?: { kind: "support" | "item"; gap: number; s: number; point: string; to: string };
}

/**
 * Số đo một món treo trên cánh tay (kiểu treo) ở một giây — `heldCarries` của người 3D đưa ra. Đơn vị rig thế giới, góc độ
 */
export interface HeldCarry {
  id: string;
  hand: PalmHand;
  item: string;
  /** `id` của vật three của món */
  obj?: number;
  /** `món#kiểu` như `world.hands[].hold` */
  hold: string;
  on: CarryOn;
  key: string;
  /** Chỗ treo, thế giới rig: để bỏ món ngoài khung camera */
  at: V3;
  /** Đỉnh quai (`at` của kiểu treo) cách chỗ treo */
  seat: number;
  /** Khuỷu: góc giữa cánh tay trên và cẳng tay (`180` thẳng), cẳng tay ngóc khỏi phương ngang (âm là chúc xuống) */
  bend?: number;
  rise?: number;
  /** Phần người gần thân món nhất sau khi trừ phần cho lấn (`touch`): khe (âm là lồng), tên phần, độ được lấn */
  body: { gap: number; part: string; allow?: number };
  /** Độ thân món bị đẩy khỏi phương đứng để khỏi lồng vào thân, đùi */
  swing: number;
  /** Cỡ người (`world.s`) */
  s: number;
}

/** Một mẫu của `HeldOptions.frame`: bàn tay đang cầm, hay món treo trên cánh tay */
export type HeldSample = HeldHand | HeldCarry;
export const isHeldCarry = (s: HeldSample): s is HeldCarry => "on" in s;

/** Một món đăng ký (`Cast3D.provide`) ở một giây: chỗ trong thế giới rig, hướng, có hiện không, ai đang mang */
export interface HeldItemPose {
  /** `id` của vật three (khớp `HeldHand.obj`) */
  obj: number;
  item: string;
  owner?: string;
  /** Gốc khung món, thế giới rig; quaternion thế giới `[x, y, z, w]` */
  p: V3;
  q: readonly [number, number, number, number];
  shown: boolean;
  holder?: { id: string; hand: PalmHand };
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

export type HeldRule =
  | "pose"
  | "pierce"
  | "loose"
  | "wrap"
  | "grip"
  | "up"
  | "face"
  | "drift"
  | "jump"
  | "reach"
  | "seat"
  | "body"
  | "wrist"
  | "arm"
  | "role"
  | "sink"
  | "size";

export interface HeldOptions {
  /** Số đo các bàn tay đang cầm đồ, các món treo trên cánh tay ở giây `t` (`heldHands`, `heldCarries` của người 3D) */
  frame: (t: number) => readonly HeldSample[] | null | undefined;
  /** Các món đăng ký (`Cast3D.provide`) ở giây `t`: để đo món nhảy qua mốc `hold`; không có thì không đo */
  items?: (t: number) => readonly HeldItemPose[];
  /** Ngưỡng, mặc định các hằng `HELD_*`; giây, mặc định `HELD_HOLD`, `HELD_EVERY` */
  pose?: number;
  pierce?: number;
  touch?: number;
  /** Khe ngón ôm (`HELD_WRAP`) */
  wrap?: number;
  grip?: number;
  up?: number;
  face?: number;
  drift?: number;
  turn?: number;
  /** Khe tay phụ, điểm `item:` tới đích (rig, nhân cỡ người), mặc định `AIM_GAP` */
  reach?: number;
  /** Kiểu treo: đỉnh quai cách chỗ treo (`CARRY.seat`), thân món lồng vào người (`CARRY.body`) */
  seat?: number;
  body?: number;
  /** Chỗ cầm nhóm: da lún (`HELD_SINK`), sát kẹp cổ tay (`HELD_WRIST`, độ), tay lấn (`HELD_ARM`) */
  sink?: number;
  wrist?: number;
  arm?: number;
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
  /** Lỗi, không chỉ cảnh báo: món đặt trước ngoài tầm với (`reach`), cổ tay vượt kẹp (`wrist`) */
  error?: true;
  sample: HeldSample;
  /** Dáng hành động khai (dáng gần nhất của `acted`); món treo thì `rest` */
  declared: { pose: HandPose | "rest"; off: number };
  /** Trôi: dời (rig) và xoay (độ) so với lúc bắt đầu cầm */
  drift?: { move: number; turn: number; from: number };
  /** Nhảy qua mốc `hold`: dời (rig), xoay (độ), loại mốc */
  jump?: { move: number; turn: number; kind: HeldJumpKind };
  runs: [number, number][];
  clips: string[];
}

/** Loại mốc món nhảy: gắn vào tay, thả khỏi tay, đổi tay (cùng người hay người khác), đổi kiểu cầm trên cùng tay */
export type HeldJumpKind = "take" | "release" | "swap" | "regrip";
const JUMP_LABELS: Record<HeldJumpKind, string> = {
  take: "lúc gắn vào tay",
  release: "lúc thả",
  swap: "lúc đổi tay",
  regrip: "lúc đổi kiểu cầm",
};

/** Bao nhiêu nhóm ngón (cái, trỏ, giữa–út) chạm món, và nhóm nào */
export function heldWrap(s: Pick<HeldHand, "gaps">, touch = HELD_TOUCH): HeldGroup[] {
  return (["thumb", "index", "fingers", "palm"] as const).filter((g) => s.gaps[g] <= touch);
}

/** Ngón kiểu cầm khai ôm (`wrap`) mà còn cách hình va chạm của món quá `max` */
export function heldOpen(s: Pick<HeldHand, "fingers" | "wrap">, max = HELD_WRAP): HeldFinger[] {
  return (s.wrap ?? []).filter((f) => (s.fingers?.[f] ?? -Infinity) > max);
}

/** Chỗ cầm nhóm (`món@nhóm`), không phải kiểu cầm `món#kiểu` */
export const isGroupHeld = (s: Pick<HeldHand, "hold">) => !!s.hold?.includes("@");

/** Ngón, lòng tay mà vai trò buộc chạm món (`press`, `wrap`, `tip`) */
const MUST_TOUCH = new Set(["press", "wrap", "tip"]);
const ROLE_PARTS = ["thumb", "index", "middle", "ring", "pinky", "palm"] as const;
type RolePart = (typeof ROLE_PARTS)[number];

/** Ngón vai trò `press` / `wrap` / `tip` còn cách hình món quá `max` (ngón `free`, `support`, `extend` không xét) */
export function heldRoleOpen(
  s: Pick<HeldHand, "fingers" | "roles">,
  max = HELD_WRAP,
): HeldFinger[] {
  return ROLE_PARTS.filter(
    (f): f is HeldFinger =>
      f !== "palm" && MUST_TOUCH.has(s.roles?.[f] ?? "") && (s.fingers?.[f] ?? -Infinity) > max,
  );
}

/** Cổ tay so với kẹp (`TURN_MAX`, `AIM_BEND`, `AIM_DEV`): độ của khớp sát kẹp nhất, dương là vượt */
export const heldWristMargin = (w: GraspReport["arm"]["wrist"]) =>
  Math.max(Math.abs(w.turn) - TURN_MAX, Math.abs(w.bend) - AIM_BEND, Math.abs(w.dev) - AIM_DEV);

/**
 * Chỗ cầm nhóm có `size` (docs/11 mục 3): số đo của khối hình đã chọn (`choice.featureIndex`) so với `W` của tay `dims`;
 * nhóm không có `size` thì không có
 */
export function heldSize(
  spec: HeldItemSpec,
  g: Pick<GraspReport, "group" | "choice">,
  dims: Pick<HandDims, "W">,
): HeldHand["size"] {
  const size = GRIP_GROUPS[g.group].size;
  const i = g.choice.featureIndex;
  const f = i !== undefined ? itemGeom(spec).features[i] : undefined;
  if (!size || !f) return undefined;
  const of = size.of(f);
  return { of, W: dims.W, ratio: of / dims.W };
}

type Hit = { rule: HeldRule; worst: number; error?: true };

/**
 * Luật của chỗ cầm nhóm (docs/11 mục 7). `blend`: tay còn trong `HOLD_BLEND` của ranh giới lần cầm — đang đi tới món, không
 * xét `grip`, `loose`, `role`
 */
function groupHits(s: HeldHand, o: Omit<HeldOptions, "frame">, blend: boolean): Hit[] {
  const out: Hit[] = [];
  const g = s.grasp;
  const placed = g?.mode === "item";
  const pierce = Math.min(o.pierce ?? HELD_PIERCE, HELD_PIERCE_FIT);
  if (s.pierce.core > pierce) out.push({ rule: "pierce", worst: s.pierce.core });
  const gapOf = (f: RolePart) => (f === "palm" ? s.gaps.palm : (s.fingers?.[f] ?? Infinity));
  const sink = -Math.min(...ROLE_PARTS.map(gapOf));
  if (sink > (o.sink ?? HELD_SINK)) out.push({ rule: "sink", worst: sink });
  if (!blend) {
    const must = ROLE_PARTS.filter((f) => MUST_TOUCH.has(s.roles?.[f] ?? ""));
    const need = must.length ? must : ROLE_PARTS;
    const near = Math.min(...need.map(gapOf));
    if (near > (o.touch ?? HELD_TOUCH)) out.push({ rule: "loose", worst: near });
    else {
      const open = heldRoleOpen(s, o.wrap);
      if (open.length)
        out.push({ rule: "role", worst: Math.max(...open.map((f) => s.fingers![f])) });
    }
    const group = g?.group ?? groupOfKey(s.hold!);
    const variant = g?.choice.variant ?? s.hold!.split("/")[1];
    if (group && s.grip > heldGripMax(group, variant || undefined))
      out.push({ rule: "grip", worst: s.grip });
  }
  if (placed) {
    if (g.arm.gap > (o.reach ?? AIM_GAP) * (s.s ?? 1))
      out.push({ rule: "reach", worst: g.arm.gap, error: true });
    const m = heldWristMargin(g.arm.wrist);
    if (m > -(o.wrist ?? HELD_WRIST))
      out.push({ rule: "wrist", worst: m, ...(m > 0 && { error: true as const }) });
    if ((g.arm.bodyRatio ?? 0) > (o.arm ?? HELD_ARM)) out.push({ rule: "arm", worst: g.arm.body });
  } else {
    const i = s.intent;
    if (i && i.err > (i.rule === "up" ? (o.up ?? HELD_UP) : (o.face ?? HELD_FACE)))
      out.push({ rule: i.rule, worst: i.err });
    if (s.reach && s.reach.gap > (o.reach ?? AIM_GAP) * s.reach.s)
      out.push({ rule: "reach", worst: s.reach.gap });
  }
  if (s.size && s.size.ratio >= SIZE_WARN) out.push({ rule: "size", worst: s.size.ratio });
  return out;
}

/** Nhóm của khoá lần cầm `món@nhóm/…` */
const groupOfKey = (hold: string): GroupId | undefined => {
  const id = hold.slice(hold.indexOf("@") + 1).split("/")[0];
  return id in GRIP_GROUPS ? (id as GroupId) : undefined;
};

/**
 * Các luật một bàn tay phạm ở một giây (trừ `drift`, đo trên cả lần cầm). Chỗ cầm nhóm theo docs/11 mục 7; `blend` là tay
 * còn trong `HOLD_BLEND` của ranh giới lần cầm (`holdBlending`)
 */
export function heldHits(s: HeldHand, o: Omit<HeldOptions, "frame"> = {}, blend = false): Hit[] {
  if (isGroupHeld(s)) return groupHits(s, o, blend);
  const out: Hit[] = [];
  // kiểu cầm cứng: dáng ngón chỉ có ở kiểu cầm, ngón của hành động không vẽ khi đang cầm
  const rigid = s.hold !== undefined;
  const decl = nearestHandPose(s.acted);
  const off = handPoseOff(s.acted, s.pose);
  if (!rigid && decl.pose !== "rest" && decl.pose !== s.pose && off > (o.pose ?? HELD_POSE))
    out.push({ rule: "pose", worst: off });
  const pierce = s.fingers
    ? Math.min(o.pierce ?? HELD_PIERCE, HELD_PIERCE_FIT)
    : (o.pierce ?? HELD_PIERCE);
  if (s.pierce.core > pierce) out.push({ rule: "pierce", worst: s.pierce.core });
  const wrap = heldWrap(s, o.touch);
  if (!wrap.length) out.push({ rule: "loose", worst: Math.min(...Object.values(s.gaps)) });
  else {
    const open = heldOpen(s, o.wrap);
    if (open.length) out.push({ rule: "wrap", worst: Math.max(...open.map((f) => s.fingers![f])) });
  }
  const pinch = HELD_PINCHES.includes(s.pose);
  if (s.grip > (pinch ? HELD_GRIP_PINCH : (o.grip ?? HELD_GRIP)))
    out.push({ rule: "grip", worst: s.grip });
  if (rigid) {
    const i = s.intent;
    if (i && i.err > (i.rule === "up" ? (o.up ?? HELD_UP) : (o.face ?? HELD_FACE)))
      out.push({ rule: i.rule, worst: i.err });
    if (s.reach && s.reach.gap > (o.reach ?? AIM_GAP) * s.reach.s)
      out.push({ rule: "reach", worst: s.reach.gap });
    return out;
  }
  if (s.up !== undefined && s.up > (o.up ?? HELD_UP)) out.push({ rule: "up", worst: s.up });
  if (s.face && s.face.angle > (o.face ?? HELD_FACE))
    out.push({ rule: "face", worst: s.face.angle });
  return out;
}

/**
 * Các luật một món treo phạm ở một giây: `seat` — đỉnh quai rời chỗ treo, khuỷu mở quá `CARRY.bend` hay cẳng tay chúc quá
 * `CARRY.rise` (không còn chỗ gập giữ quai); `body` — thân món lồng vào người quá phần `touch` cho lấn cộng `body`
 */
export function carryHits(
  s: HeldCarry,
  o: Omit<HeldOptions, "frame"> = {},
): { rule: HeldRule; worst: number }[] {
  const out: { rule: HeldRule; worst: number }[] = [];
  const seat = o.seat ?? CARRY.seat;
  const off = Math.max(
    s.seat / seat,
    s.bend !== undefined && s.bend > CARRY.bend ? 1 + (s.bend - CARRY.bend) / 10 : 0,
    s.rise !== undefined && s.rise < CARRY.rise ? 1 + (CARRY.rise - s.rise) / 10 : 0,
  );
  if (off > 1) out.push({ rule: "seat", worst: off });
  const sink = -(s.body.gap + (s.body.allow ?? 0));
  if (sink > (o.body ?? CARRY.body)) out.push({ rule: "body", worst: sink });
  return out;
}

/** Món đăng ký nhảy (dời quá `drift`, xoay quá `turn`) qua một mốc `hold` của scene: so hai bên mốc, `HELD_JUMP_EPS` giây */
function heldJumps(
  rt: SceneRuntime,
  o: HeldOptions,
  items: NonNullable<HeldOptions["items"]>,
  seen: (t: number, at: V3) => boolean,
) {
  const marks = new Set<number>();
  for (const m of rt.cast)
    for (const k of m.world?.hands ?? [])
      if (
        (k.right?.hold !== undefined || k.left?.hold !== undefined) &&
        k.t > 0 &&
        k.t < rt.duration
      )
        marks.add(k.t);
  const drift = o.drift ?? HELD_DRIFT;
  const turnMax = o.turn ?? HELD_TURN;
  const out: {
    rule: HeldRule;
    s: HeldSample;
    t: number;
    worst: number;
    from: number;
    to: number;
    last: number;
    jump: NonNullable<HeldIssue["jump"]>;
  }[] = [];
  for (const tc of [...marks].sort((a, b) => a - b)) {
    const [ta, tb] = [tc - HELD_JUMP_EPS, tc + HELD_JUMP_EPS];
    const before = new Map(items(ta).map((x) => [x.obj, x]));
    for (const b of items(tb)) {
      const a = before.get(b.obj);
      if (!a?.shown || !b.shown || (!a.holder && !b.holder)) continue;
      const move = len(sub(a.p, b.p));
      const turn = quatAngle(a.q, b.q);
      if (move <= drift && turn <= turnMax) continue;
      const [ha, hb] = [a.holder, b.holder];
      const kind: HeldJumpKind = !ha
        ? "take"
        : !hb
          ? "release"
          : ha.id === hb.id && ha.hand === hb.hand
            ? "regrip"
            : "swap";
      const who = (hb ?? ha)!;
      const at = hb ? tb : ta;
      const s = o.frame(at)?.find((h) => h.obj === b.obj && h.id === who.id && h.hand === who.hand);
      if (!s || !seen(at, s.at)) continue;
      const worst = Math.max(move / drift, turn / turnMax);
      out.push({
        rule: "jump",
        s,
        t: tc,
        worst,
        from: tc,
        to: tc,
        last: -1,
        jump: { move, turn, kind },
      });
    }
  }
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
    s: HeldSample;
    t: number;
    worst: number;
    from: number;
    to: number;
    last: number;
    drift?: HeldIssue["drift"];
    jump?: HeldIssue["jump"];
    error?: true;
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
  /** Bàn tay ở `at` (thế giới rig) trong khung camera giây `t` */
  const inView = (t: number, at: V3) => {
    const view = rt.lens && cameraAt(rt, t).view;
    if (!rt.lens || !view) return true;
    if (depthAt(rt.lens, at) <= 0) return false;
    const [x, y] = project(rt.lens, at);
    return !(x < view.x || x > view.x + view.w || y < view.y || y > view.y + view.h);
  };
  times.forEach((t, i) => {
    const seen = new Set<string>();
    const held = new Set<string>();
    for (const s of o.frame(t) ?? []) {
      const who = `${s.id}|${s.hand}`;
      held.add(who);
      const g = grips.get(who);
      if (!isHeldCarry(s) && (!g || g.key !== s.key)) grips.set(who, { key: s.key, s, t });
      if (!inView(t, s.at)) continue;
      const base = `${who}|${s.item}`;
      if (isHeldCarry(s)) {
        // món treo: thõng theo trọng lực mỗi khung, không trôi trong tay
        for (const h of carryHits(s, o)) {
          const k = `${base}|${h.rule}`;
          seen.add(k);
          hit(k, i, t, { rule: h.rule, s, t, worst: h.worst });
        }
        continue;
      }
      const blend = isGroupHeld(s) && holdBlending(rt, s.id, s.hand, t);
      for (const h of heldHits(s, o, blend)) {
        const k = `${base}|${h.rule}`;
        seen.add(k);
        hit(k, i, t, { rule: h.rule, s, t, worst: h.worst, ...(h.error && { error: h.error }) });
      }
      // kiểu cầm cứng: món không trôi trong tay theo cách dựng, chỗ hở là ở mốc gắn, thả, đổi tay (`jump`)
      if (s.hold !== undefined) continue;
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
  if (o.items) done.push(...heldJumps(rt, o, o.items, inView));
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
      ...((r.error || prev?.error) && { error: true as const }),
      sample: r.s,
      declared: isHeldCarry(r.s) ? { pose: "rest", off: 0 } : nearestHandPose(r.s.acted),
      ...(r.drift && { drift: r.drift }),
      ...(r.jump && { jump: r.jump }),
      runs: prev ? prev.runs : [[r.from, r.to]],
      clips: m ? handClips(m, r.t) : [],
    });
  }
  const order: HeldRule[] = [
    "wrist",
    "pierce",
    "sink",
    "pose",
    "grip",
    "loose",
    "wrap",
    "role",
    "reach",
    "arm",
    "size",
    "face",
    "up",
    "drift",
    "seat",
    "body",
    "jump",
  ];
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
const FINGER_LABELS: Record<HeldFinger, string> = {
  thumb: "cái",
  index: "trỏ",
  middle: "giữa",
  ring: "áp út",
  pinky: "út",
};

const CHOICE_KEYS = [
  "part",
  "edge",
  "along",
  "thumb",
  "variant",
  "slant",
  "around",
  "tilt",
  "psi",
] as const satisfies readonly (keyof GraspChoice)[];
const KEY_FIELDS = ["variant", "part", "edge", "thumb"] as const;
const BY_LABELS = { rig: " (rig chọn)", default: " (mặc định)", scene: "" } as const;

/**
 * Chỗ cầm nhóm như cảnh khai: `món@nhóm` và các trường — món đặt trước kèm nguồn của trường (cảnh, rig chọn, mặc định),
 * tay dẫn các trường của khoá lần cầm
 */
export function heldPlace(s: Pick<HeldHand, "item" | "hold" | "grasp">): string {
  const g = s.grasp;
  if (g) {
    const f = CHOICE_KEYS.filter((k) => g.choice[k] !== undefined).map((k) => {
      const v = g.choice[k]!;
      return `${k} ${typeof v === "number" ? Math.round(v * 100) / 100 : v}${BY_LABELS[g.by[k] ?? "scene"]}`;
    });
    return `\`${s.item}@${g.group}\`${f.length ? ` (${f.join(", ")})` : ""}`;
  }
  const [group, ...rest] = (s.hold ?? "").slice((s.hold ?? "").indexOf("@") + 1).split("/");
  const f = KEY_FIELDS.flatMap((k, i) => (rest[i] ? [`${k} ${rest[i]}`] : []));
  return `\`${s.item}@${group}\`${f.length ? ` (${f.join(", ")})` : ""}`;
}

const PART_LABELS: Record<RolePart, string> = { ...FINGER_LABELS, palm: "lòng" };

/** Các số đo chính của một giây, một dòng: dáng, lún, ôm, tâm nắm, lòng tay, trục */
export function heldSummary(s: HeldHand, touch = HELD_TOUCH): string {
  const wrap = heldWrap(s, touch);
  if (isGroupHeld(s)) return groupSummary(s, wrap);
  const parts = [
    s.hold ? `kiểu cầm ${s.hold} (dáng ${s.pose})` : `dáng ${s.pose} (${s.follow})`,
    s.pierce.core > 0
      ? `xương ${heldPieceLabel(s.pierce.piece)} vào trong món ${r1(s.pierce.core)}`
      : s.pierce.depth > 0
        ? `da lún ${r1(s.pierce.depth)} ở ${heldPieceLabel(s.pierce.piece)}`
        : `khe ${r1(-s.pierce.depth)}`,
    `ôm ${wrap.filter((g) => g !== "palm").length}/3${wrap.length ? ` (${wrap.map((g) => HELD_GROUP_LABELS[g]).join(", ")})` : ""}`,
    ...(s.wrap?.length && s.fingers
      ? [`ngón ôm ${s.wrap.map((f) => `${FINGER_LABELS[f]} ${r1(s.fingers![f])}`).join(", ")}`]
      : []),
    `tâm nắm ${s.grip < 0 ? `trong món ${r1(-s.grip)}` : `cách món ${r1(s.grip)}`}`,
    `lòng tay cách ${r1(s.palm.gap)}${s.palm.gap > 0.05 ? ` góc ${Math.round(s.palm.angle)}°` : ""}`,
  ];
  if (s.intent)
    parts.push(
      `ý định ${s.intent.rule === "up" ? "trục lên" : `về ${s.intent.toward ?? "đích"}`} lệch ${Math.round(s.intent.err)}°${s.intent.clamped.length ? ` (kẹp ${s.intent.clamped.join(", ")})` : ""}`,
    );
  else if (s.up !== undefined) parts.push(`trục lên lệch ${Math.round(s.up)}°`);
  if (s.face && !s.hold)
    parts.push(
      `mặt lệch ${Math.round(s.face.angle)}° khỏi ${s.face.toward === "camera" ? "ống kính" : "mặt người cầm"}`,
    );
  return parts.join(" · ");
}

function groupSummary(s: HeldHand, wrap: HeldGroup[]): string {
  const gap = (f: RolePart) => (f === "palm" ? s.gaps.palm : s.fingers?.[f]);
  const parts = [
    `chỗ cầm ${heldPlace(s)} (dáng ${s.pose})`,
    s.pierce.core > 0
      ? `xương ${heldPieceLabel(s.pierce.piece)} vào trong món ${r1(s.pierce.core)}`
      : s.pierce.depth > 0
        ? `da lún ${r1(s.pierce.depth)} ở ${heldPieceLabel(s.pierce.piece)}`
        : `khe ${r1(-s.pierce.depth)}`,
    `ôm ${wrap.filter((g) => g !== "palm").length}/3${wrap.length ? ` (${wrap.map((g) => HELD_GROUP_LABELS[g]).join(", ")})` : ""}`,
    `ngón ${ROLE_PARTS.flatMap((f) => (gap(f) === undefined ? [] : [`${PART_LABELS[f]}${s.roles?.[f] ? ` (${s.roles[f]})` : ""} ${r1(gap(f)!)}`])).join(", ")}`,
    `tâm nắm ${s.grip < 0 ? `trong món ${r1(-s.grip)}` : `cách món ${r1(s.grip)}`}`,
    `lòng tay cách ${r1(s.palm.gap)}${s.palm.gap > 0.05 ? ` góc ${Math.round(s.palm.angle)}°` : ""}`,
  ];
  const a = s.grasp?.mode === "item" ? s.grasp.arm : undefined;
  if (a) {
    const w = a.wrist;
    parts.push(
      `cổ tay xoay ${Math.round(w.turn)}°, gập ${Math.round(w.bend)}°, lệch ${Math.round(w.dev)}°${w.over > 0 ? ` (vượt kẹp ${r1(w.over)}°, bàn tay lệch chỗ cầm ${r1(w.off)})` : ""}`,
      `khuỷu φ ${Math.round(a.phi)}°`,
      ...(a.body > 0
        ? [`tay lấn ${r1(a.body)}${a.bodyPart ? ` (${armPartLabel(a.bodyPart)})` : ""}`]
        : []),
      ...(a.gap > 0 ? [`ngoài tầm với ${r1(a.gap)}`] : []),
    );
  } else if (s.intent)
    parts.push(
      `ý định ${s.intent.rule === "up" ? "trục lên" : `về ${s.intent.toward ?? "đích"}`} lệch ${Math.round(s.intent.err)}°${s.intent.clamped.length ? ` (kẹp ${s.intent.clamped.join(", ")})` : ""}`,
    );
  if (s.size) parts.push(`cỡ ${r1(s.size.of)} = ${s.size.ratio.toFixed(2)} · W`);
  return parts.join(" · ");
}

const ARM_SEG_LABELS: Record<string, string> = { upper: "bắp tay", fore: "cẳng tay" };
const ARM_HIT_LABELS: Record<string, string> = { torso: "thân", head: "đầu", other: "tay kia" };
/** `upper.torso` → "bắp tay vào thân" */
const armPartLabel = (k: string) => {
  const [seg, to] = k.split(".");
  return `${ARM_SEG_LABELS[seg] ?? seg} vào ${ARM_HIT_LABELS[to] ?? to}`;
};

const CARRY_ON_LABELS: Record<CarryOn, string> = { elbow: "khuỷu", shoulder: "vai" };

/** Các số đo chính của một món treo ở một giây, một dòng */
export function carrySummary(s: HeldCarry): string {
  return [
    `kiểu treo ${s.hold} (${CARRY_ON_LABELS[s.on]})`,
    `đỉnh quai cách chỗ treo ${r1(s.seat)}`,
    ...(s.bend !== undefined
      ? [
          `khuỷu ${Math.round(s.bend)}°, cẳng tay ${s.rise! >= 0 ? "ngóc" : "chúc"} ${Math.round(Math.abs(s.rise!))}°`,
        ]
      : []),
    `thân món ${s.body.gap < 0 ? `lồng ${r1(-s.body.gap)} vào` : `cách ${r1(s.body.gap)}`} ${s.body.part}${s.body.allow ? ` (cho lấn ${r1(s.body.allow)})` : ""}`,
    `đẩy khỏi phương đứng ${Math.round(s.swing)}°`,
  ].join(" · ");
}

/** Dòng báo của một mục món treo sai */
function carryLine(s: HeldIssue, x: HeldCarry, when: string): string {
  const who = `\`${s.id}\` ${PALM_HAND_LABELS[s.hand]} treo ${s.item} (\`${x.hold}\`, ${CARRY_ON_LABELS[x.on]})`;
  const head = (): string => {
    if (s.rule === "body")
      return `món treo lồng vào người — ${who}: thân món lồng ${r1(-x.body.gap)} vào \`${x.body.part}\`${x.body.allow ? ` (cho lấn ${r1(x.body.allow)})` : ""}; ${
        /^(upperArm|foreArm|hand)/.test(x.body.part)
          ? "dang tay ra khỏi món (`world.hands` `at` / `elbow` ra ngoài)"
          : "dời tay, chỗ đứng hay dáng cho món có chỗ thõng"
      }, khai \`touch\` ở kiểu treo nếu cố ý ép sát, hay thu \`shape\` ở \`held/${x.hold.split("#")[0]}.json\``;
    if (s.rule === "seat") {
      const why =
        x.bend !== undefined && x.bend > CARRY.bend
          ? `khuỷu mở ${Math.round(x.bend)}° (giữ quai cần dưới ${CARRY.bend}°) — gập khuỷu: cổ tay lên trước vai, khuỷu chĩa xuống`
          : x.rise !== undefined && x.rise < CARRY.rise
            ? `cẳng tay chúc ${Math.round(-x.rise)}° dưới phương ngang, quai tuột về cổ tay — nâng cổ tay cao hơn khuỷu`
            : `đỉnh quai cách chỗ treo ${r1(x.seat)} — \`extra\` đừng đặt món đang treo, hay \`at\` của kiểu treo không phải đỉnh quai`;
      return `quai không nằm trên chỗ treo — ${who}: ${why}`;
    }
    const j = s.jump!;
    return `món nhảy ${JUMP_LABELS[j.kind]} — ${who}: qua mốc giây ${sec(s.t)} món dời ${r1(j.move)}, xoay ${Math.round(j.turn)}°; ${
      j.kind === "take"
        ? "đặt món (`extra`) đúng chỗ nó sẽ treo"
        : j.kind === "release"
          ? "đặt món (`extra`) ở chỗ thả từ mốc thả — `cast.released` không trả chỗ cho món treo"
          : "cho hai mốc trùng chỗ treo, hay chuyển món qua bàn tay"
    }`;
  };
  return `${head()} ${when}. Lúc ấy: ${carrySummary(x)} (docs/03-scene.md#đồ-cầm-tay)`;
}

/** Dòng báo của một mục đồ cầm sai, như `check` in */
export function heldLine(s: HeldIssue): string {
  const runs = s.runs
    .slice(0, 4)
    .map(([a, b]) => (a === b ? sec(a) : `${sec(a)}–${sec(b)}`))
    .join(", ");
  const more = s.runs.length > 4 ? `, +${s.runs.length - 4} quãng` : "";
  if (isHeldCarry(s.sample))
    return carryLine(s, s.sample, `ở giây ${sec(s.t)} · giây ${runs}${more}`);
  const who = `\`${s.id}\` ${PALM_HAND_LABELS[s.hand]} cầm ${s.item}`;
  const x = s.sample;
  if (isGroupHeld(x)) return groupLine(s, x, who, `ở giây ${sec(s.t)} · giây ${runs}${more}`);
  // kiểu cầm cứng: lỗi ở liên kết tay–món sai ở mọi cảnh dùng kiểu cầm ấy
  const fixGrip = x.hold
    ? `sửa kiểu cầm \`${x.hold}\` ở \`held/${x.hold.split("#")[0]}.json\` (\`at\`, \`palm\`, \`fingers\`, \`pose\`) — nó sai ở mọi cảnh dùng nó`
    : undefined;
  const i = x.intent;
  const clamp = (c: HeldClamp) =>
    c === "turn"
      ? "xoay cẳng tay ±90"
      : c === "bend"
        ? `gập cổ tay ±${AIM_BEND}`
        : `lệch cổ tay ±${AIM_DEV}`;
  const intentLine = () => {
    // kiểu cầm khác của cùng món mà ý định với tới (dưới ngưỡng của luật)
    const limit = i!.rule === "up" ? HELD_UP : HELD_FACE;
    const alt = i!.alts?.find((a) => a.err <= limit);
    const regrip = alt
      ? `đổi kiểu cầm: \`${s.item}#${alt.grip}\` với tới (lệch ${Math.round(alt.err)}°)`
      : "đổi kiểu cầm";
    return `${i!.rule === "up" ? "món nghiêng" : "mặt món quay sai"} — ${who}: trục ý định còn lệch ${Math.round(i!.err)}° khỏi \`${i!.toward ?? (i!.rule === "up" ? "up" : "đích")}\`; ${
      i!.clamped.length
        ? `cổ tay kẹp ở ${i!.clamped.map(clamp).join(", ")}`
        : "cổ tay còn tầm mà khuỷu hết xoay"
    } — đổi \`elbow\` (khung cẳng tay quay theo hướng khuỷu), dời chỗ tay, đổi tay hay ${regrip}`;
  };
  const head: Record<
    Exclude<HeldRule, "seat" | "body" | "wrist" | "arm" | "role" | "sink" | "size">,
    () => string
  > = {
    pose: () =>
      `dáng tay cầm khác dáng khai — ${who}: hành động khai \`${s.declared.pose}\` mà \`hold\` vẽ \`${x.pose}\` (ngón lệch ${Math.round(s.worst)}°); truyền dáng ấy vào \`HoldOptions.pose\` hay sửa dáng khai`,
    pierce: () =>
      `ngón xuyên đồ — ${who}: trục ${heldPieceLabel(x.pierce.piece)} vào trong món ${r1(x.pierce.core)} (da lún ${r1(x.pierce.depth)}); ${fixGrip ?? "dời món (`offset`, `rotate`) hay đổi dáng"}`,
    loose: () =>
      `món không chạm bàn tay — ${who}: không ngón nào, lòng tay cũng không chạm (khe nhỏ nhất ${r1(s.worst)})${fixGrip ? `; ${fixGrip}` : ""}`,
    wrap: () =>
      `ngón ôm mà hở — ${who}: ${heldOpen(x)
        .map((f) => `ngón ${FINGER_LABELS[f]} cách món ${r1(x.fingers![f])}`)
        .join(
          ", ",
        )} — ngón cuộn hết tầm vẫn không chạm hình va chạm; sửa kiểu cầm \`${x.hold}\` (\`at\`, \`pose\`, bỏ ngón khỏi \`wrap\`) hay \`shape\` ở \`held/${(x.hold ?? "").split("#")[0]}.json\``,
    grip: () =>
      `món không nằm trong tay — ${who}: tâm nắm của dáng \`${x.pose}\` cách mặt món ${r1(x.grip)}${fixGrip ? `; ${fixGrip}` : ""}`,
    up: () =>
      i
        ? intentLine()
        : `món nghiêng — ${who}: trục lên của món lệch ${Math.round(x.up ?? 0)}° khỏi hướng lên`,
    face: () =>
      i
        ? intentLine()
        : `mặt món quay sai — ${who}: mặt món lệch ${Math.round(x.face?.angle ?? 0)}° khỏi ${x.face?.toward === "camera" ? "ống kính" : "mặt người cầm"}`,
    reach: () =>
      x.reach?.kind === "item"
        ? `món không tới đích — ${who}: \`${x.reach.point}\` còn cách \`${x.reach.to}\` ${r1(s.worst)}; tay không với tới — dời người, chọn đích gần hơn hay nới \`stretch\``
        : `tay phụ không với tới món — ${who}: còn cách mốc kiểu cầm của nó trên món ${r1(s.worst)}; món theo tay chính, không trôi theo tay phụ — dời tay chính, đổi \`elbow\` hay đổi kiểu cầm`,
    jump: () => {
      const j = s.jump!;
      const fix =
        j.kind === "take"
          ? 'đặt món (`extra`) đúng chỗ tay sẽ cầm, hay đưa tay tới chỗ món nằm (`point: "item:<mốc>"` + `at`)'
          : j.kind === "release"
            ? 'giữ món ở chỗ thả bằng `cast.released(món, t)` trong `extra`, hay đặt món xuống (`point: "item:<mốc>"` tới mặt bàn) trước mốc thả'
            : "cho hai tay cùng khai `hold` một món một quãng chồng để tay mới tới đúng mốc trước khi tay cũ buông";
      return `món nhảy ${JUMP_LABELS[j.kind]} — ${who}: qua mốc giây ${sec(s.t)} món dời ${r1(j.move)}, xoay ${Math.round(j.turn)}°; ${fix}`;
    },
    drift: () =>
      `món trôi trong bàn tay — ${who} (\`follow: ${x.follow}\`): so với giây ${sec(s.drift!.from)} món dời ${r1(s.drift!.move)}, xoay ${Math.round(s.drift!.turn)}° trong khung bàn tay; cổ tay xoay mà món đứng theo người — bám cổ tay (\`follow: "wrist"\`) hay giữ cổ tay yên`,
  };
  const clips = s.clips.length ? `. Clip đang chạy: ${s.clips.join(", ")}` : "";
  return `${head[s.rule as keyof typeof head]()} ở giây ${sec(s.t)} · giây ${runs}${more}. Lúc ấy: ${heldSummary(x)}${clips} (docs/03-scene.md#đồ-cầm-tay)`;
}

/** Dòng báo của một mục chỗ cầm nhóm: trỏ về chỗ cầm ở cảnh (`món@nhóm` và trường), docs/11-nhom-cam.md mục 7 */
function groupLine(s: HeldIssue, x: HeldHand, who: string, when: string): string {
  const place = `chỗ cầm ${heldPlace(x)}`;
  const g = x.grasp;
  const a = g?.arm;
  const item = g ? `mốc món \`${x.item}\` ở \`items\`` : "đích tay";
  const head = (): string => {
    switch (s.rule) {
      case "reach":
        return a && g?.mode === "item"
          ? `tay không tới chỗ cầm — ${who}: duỗi hết tay vẫn còn cách ${r1(s.worst)} (${place}); dời ${item} lại gần người hay đổi \`edge\` / \`along\``
          : `tay phụ không với tới món — ${who}: còn cách chỗ của nó trên món ${r1(s.worst)} (${place}); dời tay chính, đổi \`elbow\` hay đổi \`edge\``;
      case "wrist": {
        const w = a!.wrist;
        const over = s.worst > 0;
        return `cổ tay ${over ? "vượt giới hạn" : "sát giới hạn"} — ${who}: xoay ${Math.round(w.turn)}°/±${TURN_MAX}, gập ${Math.round(w.bend)}°/±${AIM_BEND}, lệch ${Math.round(w.dev)}°/±${AIM_DEV}${over ? ` — vượt ${r1(w.over)}°, bàn tay vẽ lệch chỗ cầm ${r1(w.off)}` : ` — còn ${r1(-s.worst)}° tới kẹp`} (${place}); đổi \`edge\` / \`thumb\` hay hướng món (\`face\` / \`roll\` của ${item})`;
      }
      case "arm":
        return `tay lấn người — ${who}: ${a?.bodyPart ? armPartLabel(a.bodyPart) : "tay"} lấn ${r1(s.worst)} (quá ${HELD_ARM} lần bán kính tay) (${place}); dời ${item} ra xa người, đổi \`edge\` hay cầm bằng tay kia`;
      case "role": {
        const open = heldRoleOpen(x);
        return `ngón không chạm món — ${who}: ${open.map((f) => `ngón ${FINGER_LABELS[f]} (\`${x.roles?.[f]}\`) cách món ${r1(x.fingers![f])}`).join(", ")} (${place}); dáng ngón của nhóm chưa khép tới món — đổi \`variant\` hay \`edge\`, không thì là việc của dáng nhóm ở rig`;
      }
      case "loose":
        return `món không chạm bàn tay — ${who}: không ngón, lòng tay nào của vai trò \`press\` / \`wrap\` / \`tip\` chạm món (khe nhỏ nhất ${r1(s.worst)}) (${place})`;
      case "sink":
        return `da lún vào món — ${who}: lún ${r1(s.worst)} (quá ${r1(HELD_SINK)}) (${place}); ngón ôm không gỡ được — đổi \`variant\` / \`slant\`, không thì là việc của dáng nhóm ở rig`;
      case "size":
        return `món quá cỡ tay — ${who}: khối hình đã chọn cỡ ${r1(x.size!.of)} = ${x.size!.ratio.toFixed(2)} · W (W ${r1(x.size!.W)}, từ ${SIZE_WARN} · W nắm không kín) (${place}); khai \`part\` khác hay cầm hai tay (\`both\`)`;
      case "grip":
        return `món không nằm trong tay — ${who}: tâm nắm của dáng \`${x.pose}\` cách hình món ${r1(s.worst)} (${place})`;
      case "pierce":
        return `ngón xuyên đồ — ${who}: trục ${heldPieceLabel(x.pierce.piece)} vào trong món ${r1(x.pierce.core)} (da lún ${r1(x.pierce.depth)}) (${place}); đổi \`variant\` / \`edge\` / \`slant\``;
      case "up":
      case "face":
        return `${s.rule === "up" ? "món nghiêng" : "mặt món quay sai"} — ${who}: trục ý định còn lệch ${Math.round(s.worst)}° khỏi \`${x.intent?.toward ?? (s.rule === "up" ? "up" : "đích")}\` (${place}); đổi \`face\` / \`up\` của mốc tay, \`elbow\`, hay \`edge\` / \`thumb\``;
      case "jump": {
        const j = s.jump!;
        return `món nhảy ${JUMP_LABELS[j.kind]} — ${who}: qua mốc giây ${sec(s.t)} món dời ${r1(j.move)}, xoay ${Math.round(j.turn)}° (${place})`;
      }
      default:
        return `${s.rule} — ${who} (${place})`;
    }
  };
  const clips = s.clips.length ? `. Clip đang chạy: ${s.clips.join(", ")}` : "";
  return `${head()} ${when}. Lúc ấy: ${heldSummary(x)}${clips} (docs/11-nhom-cam.md#7-luật-check-nhóm-held)`;
}

/** `sceneHeld` ra dòng báo. docs/03-scene.md#đồ-cầm-tay */
export const sceneHeldProblems = (rt: SceneRuntime, o: HeldOptions): string[] =>
  sceneHeld(rt, o).map(heldLine);

/**
 * Người khai `world.hands[].hold` một món mà cảnh three không đăng ký món ấy cho người ấy (`Cast3D.provide`, chung hay
 * `owner` là người ấy): tay diễn kiểu cầm mà không có gì trong tay. Mỗi người, mỗi món một mục, kèm giây đầu khai
 */
export function heldUnprovided(
  rt: SceneRuntime,
  provided: readonly { item: string; owner?: string }[],
): { id: string; item: string; t: number }[] {
  const out: { id: string; item: string; t: number }[] = [];
  for (const m of rt.cast)
    for (const k of m.world?.hands ?? [])
      for (const side of ["right", "left"] as const) {
        const h = k[side]?.hold;
        if (!h) continue;
        const { item } = sceneHoldRef(h);
        if (provided.some((p) => p.item === item && (p.owner === undefined || p.owner === m.id)))
          continue;
        if (!out.some((o) => o.id === m.id && o.item === item))
          out.push({ id: m.id, item, t: k.t });
      }
  return out;
}

/** Dòng báo của một món khai `hold` mà không ai đăng ký */
export const heldUnprovidedLine = (u: { id: string; item: string; t: number }): string =>
  `cầm món không có trong cảnh — \`${u.id}\` khai \`hold\` món \`${u.item}\` (từ giây ${sec(u.t)}) mà cảnh three không đăng ký món ấy: gọi \`cast.provide("${u.item}", vật, "${u.id}")\` (hay không \`owner\`) trong \`extra\` — không thì tay diễn kiểu cầm mà trong tay không có gì (docs/03-scene.md#đồ-cầm-tay)`;

/** Dòng báo các lần cầm còn đi đường cũ của một cảnh: một dòng, kể từng người, tay, món */
export function heldLegacyLine(
  list: readonly { id: string; hand: PalmHand; item: string; follow: string }[],
): string {
  const each = list
    .slice(0, 6)
    .map((l) => `\`${l.id}\` ${PALM_HAND_LABELS[l.hand]} cầm ${l.item} (\`${l.follow}\`)`)
    .join(", ");
  const more = list.length > 6 ? `, +${list.length - 6}` : "";
  return `đồ cầm còn đi đường cũ — ${list.length} lần cầm qua \`hold\` không có kiểu cầm (\`follow\`/\`offset\`/\`rotate\`/\`pose\`): ${each}${more}. Chuyển sang \`held/<món>.json\` + \`world.hands[].hold\` + \`cast.provide\`; muốn im thì \`--skip legacy\` (docs/03-scene.md#đồ-cầm-tay)`;
}
