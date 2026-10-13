import { actJoints, BONES3, cladProfile, roots3, type ActInput, type ActJoint } from "./act3";
import { TORSO_DEPTH } from "./constants";
import { limbWidths, wornPalette, type CharacterData } from "./schema";
import { profileAt, wornSkirt } from "./skirtShape";
import { garmentOf, profile } from "./torso";
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
 * cổ; người mặc đồ (`palette.clad`) thì sườn áo lùi nhường chỗ cho tay và dày `CLAD_DEPTH` như `torsoMesh`
 * (`cladProfile` trên chỗ trống `roots3` cho tay), và cánh tay bỏ thêm quãng trong hai lần bán kính nắp vai quanh khớp
 * vai (tay choãi rộng vì bụng phệ còn nằm trong thân ở đó). Đo trên đoạn tay đã bỏ hai đầu (`PIERCE_TRIM`) với lõi tay bằng `PIERCE_CORE` bán kính. Trả các
 * đoạn lấn quá `tol`, sâu trước. docs/10-lop-ve-code.md#tay-xuyên-thân
 */
export function armPierce(
  c: Pick<CharacterData, "rig" | "pieces" | "palette" | "head">,
  sp: ActInput,
  { tol = 0 }: { tol?: number } = {},
): ArmPierce[] {
  const j = actJoints(c, sp);
  const W = sp.world;
  if (!j || !W) return [];
  const s = W.s;
  const pal = wornPalette(c);
  let pts = profile(garmentOf(c.pieces.torso.garment, pal.clad), c.rig, c.rig.stroke / 2).pts;
  let depths = pts.map(([a]) => TORSO_DEPTH * a);
  /** Người mặc đồ: quanh khớp vai trong bán kính này (px) là nắp vai, cánh tay choãi rộng (bụng phệ) còn nằm trong thân */
  let capZone = 0;
  if (pal.clad) {
    const w = limbWidths(pal);
    const { room } = roots3(c.pieces.torso.garment, c.rig, {
      clad: true,
      sleeve: w.sleeve,
      trouser: w.trouser,
      bicep: pal.bicep,
      skirt: wornSkirt(c.pieces.hem),
      flare: pal.sleeveFlare,
      sleeveLength: pal.sleeveLength,
    });
    if (room) {
      ({ pts, depth: depths } = cladProfile(pts, room));
      capZone = 2 * room.cap;
    }
  }
  const [yTop, yBot] = [pts[0][1], pts[pts.length - 1][1]];
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
    const [a, dz] = profileAt(pts, depths, y);
    if (!(a > 0) || !(dz > 0)) return -Infinity;
    const [x, z] = [dot(d, side) / s, dot(d, fwd) / s];
    const q = Math.hypot(x / a, z / dz);
    // quãng tới mặt áo dọc bán kính elip, quy về trục ngắn: đủ để xếp nặng nhẹ, không cần đúng tuyệt đối
    return (1 - q) * Math.min(a, dz) * s + r;
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
    const upper = part === "armNear" || part === "armFar";
    for (let i = 0; i <= STEPS; i++) {
      const k = root + ((1 - root - tip) * i) / STEPS;
      const p = [0, 1, 2].map((m) => a[m] + (b[m] - a[m]) * k) as V3;
      if (upper && Math.hypot(...sub(p, a)) < capZone * s) continue;
      depth = Math.max(depth, depthAt(p));
    }
    if (depth > tol) out.push({ part, depth });
  }
  return out.sort((x, y) => y.depth - x.depth);
}
