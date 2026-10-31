import { actArm, type ActInput, type ReachIn } from "../act3";
import { armInput, bodyGap, solvePhi, type ArmInput } from "../graspArm";
import { fromColumns, type M3, type V3 } from "../lens";
import { parseCharacter, type CharacterData } from "../schema";
import { trunk3 } from "../arm3";
import type { Aim } from "../bodyMark";

/** Người nhỏ nhất (chibi đầu to, áo len) và lớn nhất (cao, vai rộng, bụng phệ, tay áo dày) của bảng khuỷu */
function person(name: string, extra: Record<string, unknown>): CharacterData {
  const r = parseCharacter({
    name,
    head: { form: "human" },
    ...extra,
    palette: { skin: "#f8e3c8", line: "#1c1c1e", clad: true, ...(extra.palette as object) },
  });
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  return r.data;
}

export const SMALL = person("nho", {
  rig: { height: 0.8, shoulderHalf: 34, hipHalf: 18 },
  palette: {
    garment: "#e0b23a",
    sleeve: "#e0b23a",
    trouser: "#34466e",
    sleeveWidth: 13,
    trouserWidth: 14,
  },
  pieces: { torso: { src: "sculpt", garment: { style: "sweater", hem: -10 } } },
});
export const LARGE = person("lon", {
  rig: { height: 1.1, shoulderHalf: 44, hipHalf: 26 },
  palette: {
    garment: "#e0623f",
    sleeve: "#e0623f",
    sleeveLength: 0.32,
    trouser: "#e8dccb",
    sleeveWidth: 17,
    trouserWidth: 20,
    bicep: 0.3,
  },
  pieces: { torso: { src: "sculpt", garment: { style: "polo", neck: 14, belly: 24, hem: 6 } } },
});
export const PEOPLE = [
  ["nhỏ", SMALL],
  ["lớn", LARGE],
] as const;

const Z = [0, 0, 0];
/** Người đứng thẳng nhìn +z three (`yaw` 90°), hông ở gốc; `hands` theo bên giải phẫu */
export function stand(hands: Partial<Record<-1 | 1, ReachIn>> = {}): ActInput {
  return {
    pose: { al: Z, ar: Z, ll: Z, lr: Z, torso: 0, head: Z, stretch: [1, 1, 1, 1, 1, 1, 1, 1] },
    world: {
      hip: Z,
      yaw: Math.PI / 2,
      s: 1,
      hands: { right: hands[-1], left: hands[1] },
    },
  };
}

/** Vai (three) và tầm với `l₁ + l₂` của tay bên `side` (`-1` phải) */
export function shoulderOf(c: CharacterData, side: -1 | 1) {
  const T = trunk3(c, stand())!;
  const inp = armInput(T, side);
  return { S: inp.S, L: inp.l1 + inp.l2, inp, T };
}

/** Điểm hệ thân `[tiến, xuống, ra ngoài]` của tay `side`, phần tầm với, so với vai, ra three */
export const bodyPoint = (S: V3, L: number, side: number, w: readonly number[]): V3 => [
  S[0] + side * w[2] * L,
  S[1] - w[1] * L,
  S[2] + w[0] * L,
];
/** Hướng hệ thân `[tiến, xuống, ra ngoài]` ra three của tay `side` (người nhìn +z) */
export const bodyVec = (side: number, v: readonly number[]): V3 => [side * v[2], -v[1], v[0]];
export const toRig = (p: V3): V3 => [p[0] * 100, -p[1] * 100, -p[2] * 100];

/** Tay bên `side` với cổ tay đặt ở `w` (hệ thân, phần tầm với) qua `world.hands`; `aim` là ý định lòng tay */
export function armAt(
  c: CharacterData,
  side: -1 | 1,
  w: readonly number[],
  o: { aim?: Aim; solve?: boolean; elbow?: V3 } = {},
) {
  const { S, L } = shoulderOf(c, side);
  const at = toRig(bodyPoint(S, L, side, w));
  const aim = o.aim ?? (o.solve ? { terms: [{ k: 1, keep: true }] } : undefined);
  const r: ReachIn = { at, w: 1, ...(aim && { aim }), ...(o.elbow && { elbow: o.elbow }) };
  return actArm(c, stand({ [side]: r }), side)!;
}

/** Khung bàn tay three của tay `side`: lòng tay quay về `palm`, ngón về `fingers` (vuông góc) */
export const handFrame = (side: number, palm: V3, fingers: V3): M3 => {
  const x: V3 = [-side * palm[0], -side * palm[1], -side * palm[2]];
  const y: V3 = [-fingers[0], -fingers[1], -fingers[2]];
  const z: V3 = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return fromColumns(x, y, z);
};

/** Tay cầm món đặt trước: cổ tay ở `w`, khung bàn tay `Rw` cố định; `E(φ)` từ khuỷu ưu tiên */
export function placedAt(c: CharacterData, side: -1 | 1, w: readonly number[], Rw: M3) {
  const { S, L, inp } = shoulderOf(c, side);
  return solvePhi(inp, bodyPoint(S, L, side, w), Rw);
}

/**
 * Cổ tay `w` (hệ thân, phần tầm với) đẩy ra khỏi thân và sọ của người ấy (cách mặt một bán kính cổ tay cộng `gap` px): bộ tư
 * thế soạn cho người số đo thường, người bụng to hay đầu to thì bàn tay đặt trên mặt thân như người dựng cảnh đặt
 */
export function clearWrist(inp: ArmInput, w: readonly number[], side: number, gap = 2): number[] {
  const L = inp.l1 + inp.l2;
  const r = inp.r[2] + gap;
  let p = bodyPoint(inp.S, L, side, w);
  const hips = inp.hips;
  for (let i = 0; i < 200; i++) {
    const g = bodyGap(inp, p);
    let d: V3 | undefined;
    if (g.torso !== undefined && g.torso < r) d = [p[0] - hips[0], 0, p[2] - hips[2]];
    else if (g.head < r) d = [p[0] - inp.head[0], p[1] - inp.head[1], p[2] - inp.head[2]];
    if (!d) break;
    const n = Math.hypot(...d) || 1;
    p = [
      p[0] + (d[0] / n) * 0.005 * inp.s,
      p[1] + (d[1] / n) * 0.005 * inp.s,
      p[2] + (d[2] / n) * 0.005 * inp.s,
    ];
  }
  return [(p[2] - inp.S[2]) / L, -(p[1] - inp.S[1]) / L, (side * (p[0] - inp.S[0])) / L];
}
