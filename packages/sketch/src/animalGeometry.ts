import {
  animalLegs,
  legAt,
  type AnimalAnchorName,
  type AnimalData,
  type AnimalLeg,
  type AnimalLegData,
  type AnimalPose,
  type Leg,
} from "./animals";
import { D } from "./constants";
import { tip } from "./geometry";
import type { Pt } from "./types";

/**
 * Độ dốc đổi ra góc rig. `0` là nằm ngang chỉ về `+x`, dương là **ngẩng lên**. Cả bốn
 * đoạn dọc thân đều đo bằng độ dốc chứ không bằng góc rig: một con vật nhìn ngang thì
 * "dốc so với mặt đất" mới là thứ đọc được, còn "lệch bao nhiêu so với phương thẳng
 * đứng" thì không.
 */
export const pitchDeg = (pitch: number) => 90 + pitch;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Hai đoạn từ `root` với tới `target`. `bend` là phía khớp giữa chìa ra: `1` về `−x`
 * (ra sau), `−1` về `+x` (ra trước). Với không tới thì duỗi thẳng — không có gì báo, nên
 * `animalProblems` là chỗ kêu. Trả `[góc đoạn trên, góc đoạn dưới tương đối]`, độ, chiều rig.
 */
export function ik2(root: Pt, target: Pt, l1: number, l2: number, bend: 1 | -1): [number, number] {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d = clamp(Math.hypot(dx, dy), 1e-6, (l1 + l2) * 0.999);
  const aim = Math.atan2(dx, dy);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const up = aim - bend * a;
  const knee = tip(root[0], root[1], l1, up / D);
  const lo = Math.atan2(target[0] - knee[0], target[1] - knee[1]);
  return [up / D, (lo - up) / D];
}

/** Góc hai đoạn của một chân đặt bàn chân vào `foot`. */
export const legTo = (spec: AnimalLegData, root: Pt, foot: Pt): Leg =>
  ik2(root, foot, spec.upper, spec.lower, spec.knee === "back" ? 1 : -1);

/** `[gốc, khớp giữa, bàn chân]` */
export const legChain = (spec: AnimalLegData, root: Pt, a: Leg): Pt[] => {
  const p1 = tip(root[0], root[1], spec.upper, a[0]);
  return [root, p1, tip(p1[0], p1[1], spec.lower, a[0] + a[1])];
};

export const isFront = (k: AnimalLeg) => k === "fn" || k === "ff";
export const isFar = (k: AnimalLeg) => k === "hf" || k === "ff";
export const legSpec = (b: AnimalData, k: AnimalLeg): AnimalLegData =>
  isFront(k) ? b.legFront : b.legHind;

/**
 * Khớp gốc của một chân, gốc toạ độ ở khớp hông: chân trước ở vai, chân sau ở `rig.hindAt`
 * dọc đoạn hông→vai; chân xa dịch về trước `spread`.
 */
export function legRoot(b: AnimalData, k: AnimalLeg, shoulder: Pt): Pt {
  const dx = isFar(k) ? b.rig.spread : 0;
  const at = legAt(b, isFront(k));
  return [at * shoulder[0] + dx, at * shoulder[1]];
}

/** Khớp giữa của cánh nằm ở phần này của `wing.len` tính từ gốc; phần còn lại là chóp lông */
export const WING_ELBOW = 0.45;

export interface AnimalFigure {
  /** Góc rig đã cộng đủ chuỗi cha: thân, rồi cổ theo thân, rồi đầu theo cổ */
  spineDeg: number;
  neckDeg: number;
  headDeg: number;
  /** Góc rig của đoạn gốc và của chóp cánh gần; cánh xa dựng cao hơn 14° */
  wingDeg: number;
  wingTipDeg: number;
  hip: Pt;
  shoulder: Pt;
  /** Gáy — gốc của khối đầu */
  poll: Pt;
  muzzle: Pt;
  /** `[gốc, giữa, ngọn]` */
  tail: Pt[];
  /** `[gốc, khớp giữa, chóp]` của cánh gần; không có cánh thì ba điểm trùng gốc */
  wing: Pt[];
  /** Chỗ ngồi trên lưng, theo `saddle` của con vật */
  saddle: Pt;
  /** `[gốc, khớp giữa, bàn chân]`; động vật hai chân không có `fn` / `ff` */
  legs: Partial<Record<AnimalLeg, Pt[]>>;
  /** Bàn chân, theo thứ tự `animalLegs(b)` */
  feet: Pt[];
  /** y của bàn chân thấp nhất, tính từ khớp hông */
  lowest: number;
}

/** Toàn bộ hình học của một tư thế, gốc ở **khớp hông**. */
export function computeAnimalFigure(b: AnimalData, P: AnimalPose): AnimalFigure {
  const spineDeg = pitchDeg(b.rig.pitch + P.spine);
  const hip: Pt = [0, 0];
  const shoulder = tip(0, 0, b.rig.body, spineDeg);
  const neckDeg = spineDeg + b.neck.pitch + P.neck;
  const poll = tip(shoulder[0], shoulder[1], b.neck.len, neckDeg);
  const headDeg = neckDeg + b.head.pitch + P.head;
  const muzzle = tip(poll[0], poll[1], b.head.len, headDeg);

  // Đuôi mọc **ngược** trục thân, nên dốc dương là vểnh lên: cộng vào góc rig là hạ xuống
  const tailDeg = spineDeg + 180 - (b.parts.tail.pitch + P.tail[0]);
  // Gốc đuôi ở **mút sau thùng thân**, không ở khớp hông: khớp hông nằm sâu trong thân,
  // treo đuôi vào đó là cái đuôi mọc ra từ giữa lưng
  const dock = tip(0, 0, -b.body.rear * 0.9, spineDeg);
  const half = b.parts.tail.len / 2;
  const t1 = tip(dock[0], dock[1], half, tailDeg);
  const tail: Pt[] = [dock, t1, tip(t1[0], t1[1], half, tailDeg + P.tail[1])];

  // Cánh cũng mọc **ngược** trục thân như đuôi; chóp gập về phía lưng là bớt góc rig đi
  const wg = b.parts.wing;
  const wingRoot = bodyPt(b, spineDeg, wg.at, wg.dx);
  const wingDeg = spineDeg + 180 - (wg.pitch + P.wing[0]);
  const wingTipDeg = wingDeg - (wg.fold + P.wing[1]);
  const elbow = tip(wingRoot[0], wingRoot[1], wg.len * WING_ELBOW, wingDeg);
  const wing: Pt[] = [
    wingRoot,
    elbow,
    tip(elbow[0], elbow[1], wg.len * (1 - WING_ELBOW), wingTipDeg),
  ];

  const legs: Partial<Record<AnimalLeg, Pt[]>> = {};
  const feet: Pt[] = [];
  for (const k of animalLegs(b)) {
    const chain = legChain(legSpec(b, k), legRoot(b, k, shoulder), P[k]);
    legs[k] = chain;
    feet.push(chain[2]);
  }

  return {
    spineDeg,
    neckDeg,
    headDeg,
    wingDeg,
    wingTipDeg,
    hip,
    shoulder,
    poll,
    muzzle,
    tail,
    wing,
    saddle: bodyPt(b, spineDeg, b.saddle.at, b.saddle.dx ?? b.body.back),
    legs,
    feet,
    lowest: Math.max(...feet.map((f) => f[1])),
  };
}

/**
 * Một điểm trong hệ thân: `at` dọc trục hông→vai, `dx` lệch về phía lưng theo bề dày thân.
 * Cùng quy ước với chỗ mọc cánh — trong nhóm thân `+y` là hông→vai, `+x` là về phía lưng.
 */
export function bodyPt(b: AnimalData, spineDeg: number, at: number, dx: number): Pt {
  const [x, y] = tip(0, 0, b.rig.body * at, spineDeg);
  const a = spineDeg * D;
  return [x + Math.cos(a) * b.body.depth * dx, y - Math.sin(a) * b.body.depth * dx];
}

/** Mốc trên con vật trong hệ khớp hông: điểm, góc rig của đoạn mang nó, và hộp (chỉ `saddle` có bề ngang). */
export function animalAnchorOf(
  b: AnimalData,
  F: AnimalFigure,
  name: AnimalAnchorName,
): { x: number; y: number; deg: number; w: number; h: number } {
  const at = (p: Pt, deg = 0, w = 0, h = 0) => ({ x: p[0], y: p[1], deg, w, h });
  switch (name) {
    case "root":
      return at([0, F.lowest]);
    case "hip":
      return at(F.hip, F.spineDeg);
    case "shoulder":
      return at(F.shoulder, F.spineDeg);
    case "saddle":
      return at(F.saddle, F.spineDeg, b.body.depth, 0);
    case "poll":
      return at(F.poll, F.headDeg);
    case "muzzle":
      return at(F.muzzle, F.headDeg);
    case "dock":
      return at(F.tail[0]);
    case "tailTip":
      return at(F.tail[2]);
    case "wingTip":
      return at(F.wing[2], F.wingTipDeg);
    case "footHindNear":
      return at(F.legs.hn?.[2] ?? F.hip);
    case "footHindFar":
      return at(F.legs.hf?.[2] ?? F.hip);
    case "footFrontNear":
      return at(F.legs.fn?.[2] ?? F.shoulder);
    case "footFrontFar":
      return at(F.legs.ff?.[2] ?? F.shoulder);
  }
}

/** Bàn chân của một tư thế, cho `bakeFeetTravel`. */
export const animalFeet = (b: AnimalData, P: AnimalPose): Pt[] => computeAnimalFigure(b, P).feet;

/** Ghép lên tư thế nền: hành động sau đè hành động trước ở đúng kênh nó ghi. */
export const composeAnimalPose = (base: AnimalPose, ...parts: Partial<AnimalPose>[]): AnimalPose =>
  Object.assign({}, base, ...parts) as AnimalPose;

/** Bàn chân đứng nghỉ: sau hơi lùi, trước hơi tiến, cho dáng đứng không chụm bốn chân. */
const STANCE = { hind: -18, front: 12 };

/** Bàn chân đứng nghỉ của một chân, trong hệ khớp hông; `animalStand` và bộ sinh đứng thở đặt chân vào đây. */
export function standFoot(b: AnimalData, k: AnimalLeg): Pt {
  const shoulder = tip(0, 0, b.rig.body, pitchDeg(b.rig.pitch));
  const root = legRoot(b, k, shoulder);
  return [root[0] + (isFront(k) ? STANCE.front : STANCE.hind), b.rig.hipY];
}

/** Bị xách hay bị ôm: chân buông thẳng xuống, không bàn chân nào chạm đất. */
export const animalHang = (b: AnimalData): AnimalPose => ({
  ...animalStand(b),
  hn: [4, 0],
  hf: [-4, 0],
  fn: [6, 0],
  ff: [-6, 0],
});

/** Tư thế đứng, suy từ chính kích thước con vật — bốn bàn chân đặt lên mặt đất. */
export function animalStand(b: AnimalData): AnimalPose {
  const spineDeg = pitchDeg(b.rig.pitch);
  const shoulder = tip(0, 0, b.rig.body, spineDeg);
  const leg = (k: AnimalLeg): Leg => legTo(legSpec(b, k), legRoot(b, k, shoulder), standFoot(b, k));
  return {
    spine: 0,
    neck: 0,
    head: 0,
    tail: [0, 0],
    wing: [0, 0],
    hn: leg("hn"),
    hf: leg("hf"),
    fn: leg("fn"),
    ff: leg("ff"),
  };
}
