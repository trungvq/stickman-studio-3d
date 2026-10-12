import { actJoints, BONES3, type ActInput, type ActJoint } from "./act3";
import { TORSO_DEPTH } from "./constants";
import { limbWidths, type CharacterData } from "./schema";
import { garmentOf, lerpAt, profile } from "./torso";
import type { V3 } from "./lens";

/** Đoạn tay của người 3D: cánh tay, cẳng tay, bên gần hay xa ống kính như `BODY_PARTS` */
export type ArmPart = "armNear" | "forearmNear" | "armFar" | "forearmFar";

/**
 * Quãng đầu đoạn tay bỏ đi khi đo tay xuyên thân mình: cánh tay bỏ phía vai (khớp vai nằm trong thân
 * áo ở mọi tư thế), cẳng tay bỏ phía cổ tay (tay đặt lên ngực, chống hông chỉ chạm ở cổ tay)
 */
export const PIERCE_TRIM: Record<ArmPart, { root: number; tip: number }> = {
  armNear: { root: 0.3, tip: 0 },
  armFar: { root: 0.3, tip: 0 },
  forearmNear: { root: 0, tip: 0.2 },
  forearmFar: { root: 0, tip: 0.2 },
};
/** Bề dày tay giữ lại khi đo, phần của bán kính thật: tay áp sát mặt áo không tính, tay xuyên qua thì có */
export const PIERCE_CORE = 0.5;
/**
 * Ngưỡng lấn mặc định của tay vào thân mình: tay áp sát mặt áo (khoanh tay, ôm ngực) đã lấn vài đơn vị,
 * tay xuyên thật lấn hàng chục
 */
export const PIERCE_TOL = 4;
/** Số điểm đo dọc trục mỗi đoạn tay */
const STEPS = 16;

/** Một đoạn tay lấn vào thân áo của chính người ấy */
export interface ArmPierce {
  part: ArmPart;
  /** Sâu nhất bao nhiêu đơn vị thế giới: lõi tay vào trong mặt áo */
  depth: number;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Đoạn tay người 3D xuyên vào thân áo của chính người ấy ở tư thế `sp`, đúng như three vẽ: tay là khớp
 * của `actJoints` (cùng khung xương, cùng IK), thân là khối tròn xoay dẹt của `torsoMesh` — nửa rộng
 * theo `profile` của áo, tiết diện ngang ellipse dẹt `TORSO_DEPTH`, gắn ở hông, dựng theo trục hông →
 * cổ. Đo trên đoạn tay đã bỏ hai đầu (`PIERCE_TRIM`) với lõi tay bằng `PIERCE_CORE` bán kính. Trả các
 * đoạn lấn quá `tol`, sâu trước. docs/10-lop-ve-code.md#tay-xuyên-thân
 */
export function armPierce(
  c: Pick<CharacterData, "rig" | "pieces" | "palette">,
  sp: ActInput,
  { tol = 0 }: { tol?: number } = {},
): ArmPierce[] {
  const j = actJoints(c, sp);
  const W = sp.world;
  if (!j || !W) return [];
  const s = W.s;
  const pr = profile(garmentOf(c.pieces.torso.garment, c.palette.clad), c.rig, c.rig.stroke / 2);
  const [yTop, yBot] = [pr.pts[0][1], pr.pts[pr.pts.length - 1][1]];
  // hệ thân: trục lên từ hông tới cổ, trục ngang qua hai vai; tiết diện đối xứng nên chiều tiến tuỳ dấu
  const hip = j.hip;
  const up = unit(sub(j.neck, hip));
  const across = sub(j.shoulderL, j.shoulderR);
  const side = unit(sub(across, up.map((u) => u * dot(across, up)) as V3));
  const fwd: V3 = [
    up[1] * side[2] - up[2] * side[1],
    up[2] * side[0] - up[0] * side[2],
    up[0] * side[1] - up[1] * side[0],
  ];
  const r = ((BONES3.limb * 100 * limbWidths(c.palette).sleeve) / 10) * s * PIERCE_CORE;
  /** Lõi tay ở `p` vào trong mặt áo bao nhiêu (âm là còn cách) */
  const depthAt = (p: V3) => {
    const d = sub(p, hip);
    const y = -dot(d, up) / s;
    if (y < yTop || y > yBot) return -Infinity;
    const a = lerpAt(pr.pts, y, 1, 0);
    if (!(a > 0)) return -Infinity;
    const [x, z] = [dot(d, side) / s, dot(d, fwd) / s];
    const q = Math.hypot(x / a, z / (TORSO_DEPTH * a));
    // quãng tới mặt áo dọc bán kính elip, quy về trục ngắn: đủ để xếp nặng nhẹ, không cần đúng tuyệt đối
    return (1 - q) * TORSO_DEPTH * a * s + r;
  };
  const [near, far] = W.flip ? ["L", "R"] : ["R", "L"];
  const segs: [ArmPart, ActJoint, ActJoint][] = [
    ["armNear", `shoulder${near}` as ActJoint, `elbow${near}` as ActJoint],
    ["forearmNear", `elbow${near}` as ActJoint, `wrist${near}` as ActJoint],
    ["armFar", `shoulder${far}` as ActJoint, `elbow${far}` as ActJoint],
    ["forearmFar", `elbow${far}` as ActJoint, `wrist${far}` as ActJoint],
  ];
  const out: ArmPierce[] = [];
  for (const [part, A, B] of segs) {
    const { root, tip } = PIERCE_TRIM[part];
    const [a, b] = [j[A], j[B]];
    let depth = -Infinity;
    for (let i = 0; i <= STEPS; i++) {
      const k = root + ((1 - root - tip) * i) / STEPS;
      depth = Math.max(depth, depthAt([0, 1, 2].map((m) => a[m] + (b[m] - a[m]) * k) as V3));
    }
    if (depth > tol) out.push({ part, depth });
  }
  return out.sort((x, y) => y.depth - x.depth);
}
