import { capsuleClearance, heldDistance, toItem } from "./heldFit";
import {
  CARRY_ON,
  heldPoint,
  rotAxis,
  type CarrySpec,
  type GripFrame,
  type HeldItemSpec,
  type HeldShape,
  type HoldGrasp,
} from "./heldItem";
import { fromColumns, matMul, matVec, type V3 } from "./lens";

/**
 * Nhóm `carry` (`on` là `elbow` / `shoulder`): chỗ treo trên cánh tay và món thõng theo trọng lực quanh nó, đẩy
 * khỏi thân và đùi. Thuần: điểm và nang trong một hệ bất kỳ có y lên (thế giới three), người 3D đưa vào. Một khung chỉ phụ
 * thuộc tư thế ở khung ấy. docs/11-nhom-cam.md mục 3
 */

/** Ngưỡng của món treo, góc độ, đơn vị rig */
export const CARRY = {
  /** Góc lệch xa nhất khỏi phương đứng mà thân món được đẩy ra khi lồng vào thân, đùi */
  swing: 80,
  /** Khuỷu mở quá ngần này (góc giữa cánh tay trên và cẳng tay, `180` là thẳng) thì không còn chỗ gập giữ quai */
  bend: 150,
  /** Cẳng tay chúc xuống quá ngần này (độ dưới phương ngang, tính từ khuỷu) thì quai tuột về cổ tay */
  rise: -10,
  /** Đỉnh quai (`at`) cách chỗ treo quá ngần này là quai không nằm trên chỗ treo */
  seat: 3,
  /** Thân món lồng vào người quá ngần này */
  body: 1.5,
} as const;

/** Thân và quai của món treo: khối `shape` thuộc phần `strap: true` là quai, còn lại là thân */
const splitMemo = new WeakMap<HeldItemSpec, { body: HeldShape[]; strap: HeldShape[] }>();
export function carryShape(item: HeldItemSpec): { body: HeldShape[]; strap: HeldShape[] } {
  const hit = splitMemo.get(item);
  if (hit) return hit;
  const isStrap = (b: HeldShape) => b.part !== undefined && item.parts?.[b.part]?.strap === true;
  const shape = item.shape ?? [];
  const out = { body: shape.filter((b) => !isStrap(b)), strap: shape.filter(isStrap) };
  splitMemo.set(item, out);
  return out;
}

/** Lần cầm: chỗ cầm nhóm của cảnh (`grasp.hold`) */
export type CarryRef = { grasp?: Pick<HoldGrasp, "hold"> };

/**
 * Spec treo của lần cầm `h` trên món `spec` (`món@carry`): `at` là `seats[on]` của món, `yaw` của cảnh, `touch` của món cộng
 * của cảnh. Lần cầm không treo thì `undefined`; `carry` thiếu `on` hay món không có `seats[on]` thì ném lỗi có tên
 */
export function carrySpecOf(spec: HeldItemSpec, h: CarryRef): CarrySpec | undefined {
  const g = h.grasp?.hold;
  if (!g || g.group !== "carry") return undefined;
  const where = `\`${g.item}@carry\``;
  if (!g.on) throw new Error(`${where}: thiếu \`on\` (${CARRY_ON.join(", ")})`);
  const at = spec.seats?.[g.on];
  if (!at) throw new Error(`${where}: món không có chỗ treo \`seats.${g.on}\``);
  const touch = [...(spec.touch ?? []), ...(g.touch ?? [])];
  return {
    on: g.on,
    at,
    ...(g.yaw !== undefined && { yaw: g.yaw }),
    ...(touch.length > 0 && { touch }),
  };
}

/** Một viên nang của người: hai đầu trục, bán kính, tên phần (`torso`, `thighR`…) */
export interface CarryCapsule {
  a: V3;
  b: V3;
  r: number;
  part: string;
}

/** Đám điểm trên mặt một phần người (thân áo, hông, váy): mảng phẳng `x y z …`, tên phần */
export interface CarryCloud {
  pts: ArrayLike<number>;
  part: string;
}

/** Một phần người mà thân món đẩy khỏi: viên nang (chi) hay đám điểm trên mặt (thân áo — sát hơn nang dựng từ hộp thân) */
export type CarryBody = CarryCapsule | CarryCloud;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const flat = (a: V3): V3 => [a[0], 0, a[2]];
const DEG = 180 / Math.PI;
const UP: V3 = [0, 1, 0];

/**
 * Chỗ treo ở khuỷu: điểm trên mặt trong chỗ gập (khớp khuỷu dời theo phân giác hai đoạn tay một bán kính tay), thanh quai
 * vắt qua là cẳng tay. `bend` góc giữa cánh tay trên và cẳng tay (độ, `180` thẳng), `rise` cẳng tay ngóc khỏi phương ngang
 * (độ, âm là chúc xuống). Tay gần thẳng thì mặt trong lấy theo phía trên của cẳng tay
 */
export function elbowSeat(
  shoulder: V3,
  elbow: V3,
  wrist: V3,
  r: number,
): { pivot: V3; bar: V3; bend: number; rise: number } {
  const a = unit(sub(shoulder, elbow));
  const b = unit(sub(wrist, elbow));
  let n = add(a, b);
  if (len(n) < 0.2) {
    const up = sub(UP, mul(b, dot(UP, b)));
    n = len(up) > 1e-6 ? up : n;
  }
  const bend = Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * DEG;
  const rise = Math.asin(Math.max(-1, Math.min(1, b[1]))) * DEG;
  return { pivot: add(elbow, mul(unit(n), r)), bar: b, bend, rise };
}

/** Một viên dọc quai: tâm (khung món, đơn vị rig), bán kính */
export interface StrapBall {
  c: V3;
  r: number;
}

/**
 * Quai thành chuỗi viên: trụ dọc trục cách nhau nửa bán kính, hộp lưới trên hai cạnh dài cách nhau cạnh ngắn (bán kính nửa
 * cạnh ngắn), cầu là chính nó
 */
const ballMemo = new WeakMap<readonly HeldShape[], StrapBall[]>();
export function strapBalls(strap: readonly HeldShape[]): StrapBall[] {
  const hit = ballMemo.get(strap);
  if (hit) return hit;
  const out: StrapBall[] = [];
  for (const b of strap) {
    if ("ball" in b) out.push({ c: (b.at ?? [0, 0, 0]) as V3, r: b.ball });
    else if ("cyl" in b) {
      const [f, t] = [b.from as V3, b.to as V3];
      const r2 = b.r2 ?? b.cyl;
      const n = Math.max(1, Math.ceil(len(sub(t, f)) / (0.5 * Math.min(b.cyl, r2))));
      for (let i = 0; i <= n; i++)
        out.push({ c: add(f, mul(sub(t, f), i / n)), r: b.cyl + ((r2 - b.cyl) * i) / n });
    } else {
      const c = (b.at ?? [0, 0, 0]) as V3;
      const k = [0, 1, 2].sort((i, j) => b.box[i] - b.box[j]);
      const r = b.box[k[0]] / 2;
      const steps = (L: number) => {
        const n = Math.max(0, Math.ceil((L - 2 * r) / (2 * r)));
        return Array.from({ length: n + 1 }, (_, i) =>
          n ? -(L / 2 - r) + ((L - 2 * r) * i) / n : 0,
        );
      };
      for (const a of steps(b.box[k[1]]))
        for (const d of steps(b.box[k[2]])) {
          const p: V3 = [...c];
          p[k[1]] += a;
          p[k[2]] += d;
          out.push({ c: p, r });
        }
    }
  }
  ballMemo.set(strap, out);
  return out;
}

/** Khoảng cách từ `p` tới đoạn `a`–`b` */
function segDist(p: V3, a: V3, b: V3): number {
  const ab = sub(b, a);
  const f = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return len(sub(p, add(a, mul(ab, f))));
}

/** Đoạn dời theo `dir` (đơn vị) để viên tâm `p` bán kính `r` ra khỏi nang `c`; không chạm là 0 */
export function capsuleExit(c: CarryCapsule, p: V3, r: number, dir: V3): number {
  const R = c.r + r;
  const d = (t: number) => segDist(add(p, mul(dir, t)), c.a, c.b);
  if (d(0) >= R) return 0;
  // khe tới đoạn lồi theo t nên phần còn lồng là một khoảng chứa 0: chia đôi lấy đầu trên
  let hi = R;
  while (d(hi) < R) hi *= 2;
  let lo = 0;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (d(m) < R) lo = m;
    else hi = m;
  }
  return hi;
}

/** Luật tựa của quai: viên tâm `p` bán kính `r` (hệ của chỗ treo) phải dời theo `dir` (đơn vị) ngần `need(p, r)` để ra khỏi người */
export interface CarryRest {
  dir: V3;
  need: (p: V3, r: number) => number;
}

/** Cầu bao của hình va chạm (khung món, đơn vị rig): tâm hộp bao các khối, bán kính tới khối xa nhất */
const boundMemo = new WeakMap<readonly HeldShape[], [V3, number]>();
export function shapeBound(shape: readonly HeldShape[]): [V3, number] {
  const hit = boundMemo.get(shape);
  if (hit) return hit;
  const lo: V3 = [Infinity, Infinity, Infinity];
  const hi: V3 = [-Infinity, -Infinity, -Infinity];
  const grow = (p: V3, r: number) => {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], p[i] - r);
      hi[i] = Math.max(hi[i], p[i] + r);
    }
  };
  for (const b of shape) {
    if ("box" in b) {
      const c = (b.at ?? [0, 0, 0]) as V3;
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          for (const sz of [-1, 1])
            grow(
              [c[0] + (sx * b.box[0]) / 2, c[1] + (sy * b.box[1]) / 2, c[2] + (sz * b.box[2]) / 2],
              0,
            );
    } else if ("ball" in b) grow((b.at ?? [0, 0, 0]) as V3, b.ball);
    else {
      const r = Math.max(b.cyl, b.r2 ?? b.cyl);
      grow(b.from as V3, r);
      grow(b.to as V3, r);
    }
  }
  const c: V3 = mul(add(lo, hi), 0.5);
  const out: [V3, number] = [c, len(sub(hi, c))];
  boundMemo.set(shape, out);
  return out;
}

/**
 * Khe nhỏ nhất từ đám điểm `pts` (hệ của `G`) tới hình va chạm của món đặt bởi `G`, đơn vị rig của món (âm là điểm ở trong
 * món); điểm ngoài cầu bao xa hơn khe đã có thì bỏ
 */
export function cloudClearance(
  shape: readonly HeldShape[],
  G: GripFrame,
  pts: ArrayLike<number>,
  best = Infinity,
): number {
  const [c0, r0] = shapeBound(shape);
  const c = add(matVec(G.R, mul(c0, G.u)), G.p);
  let gap = best;
  for (let i = 0; i + 2 < pts.length; i += 3) {
    const p: V3 = [pts[i], pts[i + 1], pts[i + 2]];
    if (len(sub(p, c)) / G.u - r0 >= gap) continue;
    gap = Math.min(gap, heldDistance(shape, toItem(G, p)));
  }
  return gap;
}

/** Khe từ thân món đặt bởi `G` tới một phần người, đơn vị rig của món (âm là lồng) */
export function carryClearance(shape: readonly HeldShape[], G: GripFrame, b: CarryBody): number {
  return "pts" in b
    ? cloudClearance(shape, G, b.pts)
    : capsuleClearance(shape, G, b.a, b.b, b.r).gap;
}

/** Khung món treo, `R · q · u + p` ra hệ của chỗ treo (như `GripFrame`), góc đẩy khỏi phương đứng, khe thân món tới người */
export interface CarryFit {
  G: GripFrame;
  /** Món dời khỏi chỗ treo để quai tựa lên người (hệ của chỗ treo, đơn vị rig của món) */
  shift: V3;
  /** Độ lệch thân món khỏi phương đứng (độ) để không lồng vào thân, đùi */
  swing: number;
  /** Khe nhỏ nhất từ thân món tới các nang đẩy, đơn vị rig của món (âm là lồng); phần gần nhất */
  gap: number;
  part?: string;
}

/**
 * Món treo theo spec treo `grip` ở chỗ treo `pivot`: đỉnh quai (`grip.at`) trùng `pivot`, trục y của món về phương đứng,
 * mặt trước (+z) theo hướng nằm ngang của thanh quai vắt qua (`bar`: cẳng tay ở khuỷu, hướng ra ngoài vai ở vai), quay thêm
 * `grip.yaw` quanh phương đứng. Thân món (hình va chạm `shape`) lồng vào các nang `body` thì đẩy ra quanh `pivot` về phía
 * `away` (nằm ngang, từ thân ra), lấy góc nhỏ nhất vừa hết lồng, tới `CARRY.swing`. `outer` là phần người ở phía ngoài
 * món (cánh tay buông ngoài túi đeo vai): góc ấy mà món lồng vào chúng thì lùi về chỗ hai bên lồng bằng nhau — món kẹp giữa. `u` là đơn vị của một đơn vị rig của
 * món ở hệ ấy. Món có quai (phần `strap`) và `rest` thì dời món theo từng luật tựa tới khi mọi viên quai ra khỏi người
 */
export function carryFrame(o: {
  item: HeldItemSpec;
  grip: CarrySpec;
  pivot: V3;
  bar: V3;
  away: V3;
  u: number;
  body: readonly CarryBody[];
  outer?: readonly CarryBody[];
  rest?: readonly CarryRest[];
}): CarryFit {
  let z = flat(o.bar);
  if (len(z) < 0.2) z = flat(o.away);
  z = len(z) < 1e-6 ? [0, 0, 1] : unit(z);
  if (o.grip.yaw) z = matVec(rotAxis(UP, o.grip.yaw / DEG), z);
  const R0 = fromColumns(cross(UP, z), UP, z);
  const top = heldPoint(o.item, o.grip.at);
  let w = flat(o.away);
  w = len(w) < 1e-6 ? z : unit(w);
  const k = cross(w, UP);
  const { body: shape, strap } = carryShape(o.item);
  const balls = o.rest && strap.length ? strapBalls(strap) : [];
  /** Đoạn dời để mọi viên quai của khung `G` ra khỏi người: lần lượt từng luật, dò lại vì dời theo luật này có thể chạm luật kia */
  const settle = (G: GripFrame): V3 => {
    let off: V3 = [0, 0, 0];
    const at = balls.map((b) => ({ p: add(matVec(G.R, mul(b.c, G.u)), G.p), r: b.r * G.u }));
    for (let i = 0; i < 6; i++) {
      let moved = false;
      for (const rule of o.rest!) {
        let need = 0;
        for (const b of at) need = Math.max(need, rule.need(add(b.p, off), b.r));
        if (need < 1e-9) continue;
        off = add(off, mul(rule.dir, need));
        moved = true;
      }
      if (!moved) break;
    }
    return off;
  };
  const clear = (G: GripFrame, list: readonly CarryBody[]) => {
    let gap = Infinity;
    let part: string | undefined;
    if (shape.length)
      for (const c of list) {
        const g = carryClearance(shape, G, c);
        if (g < gap) [gap, part] = [g, c.part];
      }
    return { gap, part };
  };
  const solve = (pivot: V3): Omit<CarryFit, "shift"> => {
    const frame = (th: number): GripFrame => {
      const R = th ? matMul(rotAxis(k, th / DEG), R0) : R0;
      return { R, p: sub(pivot, mul(matVec(R, top), o.u)), u: o.u };
    };
    const at = (th: number) => {
      const G = frame(th);
      return { G, swing: th, ...clear(G, o.body) };
    };
    /** Góc nhỏ nhất thân món hết lồng vào `body`; không có thì góc lồng ít nhất */
    const push = () => {
      const rest = at(0);
      if (rest.gap >= 0 || !o.body.length) return rest;
      // dò thô từng bước, rồi chia đôi giữa bước cuối còn lồng và bước đầu hết lồng
      const N = 16;
      let lo = rest;
      let best = rest;
      for (let i = 1; i <= N; i++) {
        const hi = at((CARRY.swing * i) / N);
        if (hi.gap > best.gap) best = hi;
        if (hi.gap < 0) {
          lo = hi;
          continue;
        }
        let [a, b] = [lo, hi];
        for (let j = 0; j < 10; j++) {
          const m = at((a.swing + b.swing) / 2);
          if (m.gap < 0) a = m;
          else b = m;
        }
        return b;
      }
      return best;
    };
    const fit = push();
    if (!o.outer?.length) return fit;
    const out = (f: { G: GripFrame }) => clear(f.G, o.outer!);
    const o1 = out(fit);
    if (o1.gap >= Math.min(0, fit.gap) || fit.swing <= 0)
      return o1.gap < fit.gap ? { ...fit, ...o1 } : fit;
    // phía ngoài lồng sâu hơn: lùi về chỗ hai bên lồng bằng nhau (thân lồng tăng, ngoài lồng giảm khi góc nhỏ đi)
    let [a, b] = [0, fit.swing];
    for (let j = 0; j < 12; j++) {
      const m = (a + b) / 2;
      const f = at(m);
      if (f.gap < out(f).gap) a = m;
      else b = m;
    }
    const f = at(b);
    const g = out(f);
    return g.gap < f.gap ? { ...f, ...g } : f;
  };
  if (!balls.length) return { ...solve(o.pivot), shift: [0, 0, 0] };
  // quai tựa: dời ở dáng thõng, đẩy thân món, rồi dời thêm nếu góc đẩy đưa quai vào người
  let shift: V3 = [0, 0, 0];
  let fit = solve(o.pivot);
  for (let i = 0; i < 3; i++) {
    const more = settle(fit.G);
    if (len(more) < 1e-6) break;
    shift = add(shift, more);
    fit = solve(add(o.pivot, shift));
  }
  return { ...fit, shift: mul(shift, 1 / o.u) };
}
