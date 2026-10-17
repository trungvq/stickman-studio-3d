import {
  HAND_BONES,
  HAND_DOF,
  HAND_FINGERS,
  HAND_FIT,
  handFrames,
  type HandFinger,
  type HandFrame,
  type HandVec,
} from "./hand";
import { HELD_FINGERS, type GripFrame, type HeldFinger, type HeldShape } from "./heldItem";
import { matVec, type V3 } from "./lens";

/**
 * Ngón ôm theo đồ: hình va chạm của món (`held/<món>.json` `shape`, hợp hộp, trụ, cầu) là một hàm khoảng cách có dấu; mỗi
 * khung, từ dáng của kiểu cầm, từng ngón gỡ khỏi mặt món khi lún vào và ngón khai `wrap` cuộn thêm từng đốt (gốc rồi
 * ngọn) tới khi chạm. Thuần, tất định theo đúng một khung: chỉ đọc chỗ món trong khung bàn tay và cỡ bàn tay.
 * docs/01-rig.md#ngón-ôm-theo-đồ
 */

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Trụ côn đáy phẳng `a → b`, bán kính `ra` ở `a`, `rb` ở `b` (Quilez, sdCappedCone) */
function cone(p: V3, a: V3, b: V3, ra: number, rb: number): number {
  const ba = sub(b, a);
  const pa = sub(p, a);
  const rba = rb - ra;
  const baba = dot(ba, ba);
  const paba = dot(pa, ba) / baba;
  const x = Math.sqrt(Math.max(0, dot(pa, pa) - paba * paba * baba));
  const cax = Math.max(0, x - (paba < 0.5 ? ra : rb));
  const cay = Math.abs(paba - 0.5) - 0.5;
  const k = rba * rba + baba;
  const f = clamp((rba * (x - ra) + paba * baba) / k, 0, 1);
  const cbx = x - ra - f * rba;
  const cby = paba - f;
  const s = cbx < 0 && cay < 0 ? -1 : 1;
  return s * Math.sqrt(Math.min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba));
}

/** Khoảng cách có dấu từ `p` (khung món, đơn vị rig) tới một khối: dương ở ngoài, âm ở trong */
export function shapeDistance(b: HeldShape, p: V3): number {
  if ("box" in b) {
    const c = (b.at ?? [0, 0, 0]) as V3;
    const r = b.round ?? 0;
    const q = [0, 1, 2].map((i) => Math.abs(p[i] - c[i]) - b.box[i] / 2 + r);
    const out = Math.hypot(...q.map((x) => Math.max(x, 0)));
    return out + Math.min(Math.max(q[0], q[1], q[2]), 0) - r;
  }
  if ("ball" in b) {
    const c = (b.at ?? [0, 0, 0]) as V3;
    return Math.hypot(...sub(p, c)) - b.ball;
  }
  const a = b.from as V3;
  const e = b.to as V3;
  const [ra, rb] = [b.cyl, b.r2 ?? b.cyl];
  const d = cone(p, a, e, ra, rb);
  if (b.wall === undefined) return d;
  // ống rỗng: trừ lõi côn đồng trục, lõi kéo dài quá hai đầu nên ống hở hai đầu
  const ax = sub(e, a);
  const L = Math.hypot(...ax);
  const w = b.wall;
  const k = (L + w + 1) / L;
  const a2: V3 = [a[0] - ax[0] * k, a[1] - ax[1] * k, a[2] - ax[2] * k];
  const e2: V3 = [e[0] + ax[0] * k, e[1] + ax[1] * k, e[2] + ax[2] * k];
  const slope = (rb - ra) / L;
  const inner = cone(
    p,
    a2,
    e2,
    Math.max(0.01, ra - w - slope * (L + w + 1)),
    Math.max(0.01, rb - w + slope * (L + w + 1)),
  );
  return Math.max(d, -inner);
}

/** Cầu bao của một khối: tâm, bán kính */
function bound(b: HeldShape): [V3, number] {
  if ("box" in b) return [(b.at ?? [0, 0, 0]) as V3, Math.hypot(...b.box) / 2];
  if ("ball" in b) return [(b.at ?? [0, 0, 0]) as V3, b.ball];
  const [a, e] = [b.from as V3, b.to as V3];
  const c: V3 = [(a[0] + e[0]) / 2, (a[1] + e[1]) / 2, (a[2] + e[2]) / 2];
  return [c, Math.hypot(...sub(e, a)) / 2 + Math.max(b.cyl, b.r2 ?? b.cyl)];
}
const bounds = new WeakMap<readonly HeldShape[], [V3, number][]>();

/** Khoảng cách có dấu từ `p` (khung món, đơn vị rig) tới hình va chạm: hợp các khối (bỏ khối có cầu bao xa hơn khe đã có) */
export function heldDistance(shape: readonly HeldShape[], p: V3): number {
  let B = bounds.get(shape);
  if (!B) bounds.set(shape, (B = shape.map(bound)));
  let d = Infinity;
  for (let i = 0; i < shape.length; i++) {
    const [c, r] = B[i];
    if (Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r >= d) continue;
    d = Math.min(d, shapeDistance(shape[i], p));
  }
  return d;
}

/** Điểm khung bàn tay (three) ra khung món (đơn vị rig) qua liên kết `G` (món trong khung bàn tay): `Rᵀ · (x − p) / u` */
export function toItem(G: GripFrame, x: V3): V3 {
  const d = sub(x, G.p);
  const R = G.R;
  return [
    (R[0] * d[0] + R[3] * d[1] + R[6] * d[2]) / G.u,
    (R[1] * d[0] + R[4] * d[1] + R[7] * d[2]) / G.u,
    (R[2] * d[0] + R[5] * d[1] + R[8] * d[2]) / G.u,
  ];
}

/** Số điểm lấy dọc trục một đốt khi đo khe tới món; quanh điểm gần nhất thì chia vàng thêm `REFINE` lượt */
const SAMPLES = 9;
const REFINE = 8;
const GOLD = (Math.sqrt(5) - 1) / 2;

/**
 * Khe nhỏ nhất từ viên nang `a b` bán kính `r` (khung bàn tay, three) tới hình va chạm của món đặt bởi `G`, đơn vị rig:
 * `gap` dương là hở, âm là da lún; `core` trục nang vào trong món sâu nhất (dương là trục ở trong — tấm mỏng bị ngón cắt
 * qua cũng ra dương); `root` khe ở đầu `a` (gốc đốt)
 */
export function capsuleClearance(
  shape: readonly HeldShape[],
  G: GripFrame,
  a: V3,
  b: V3,
  r: number,
): { gap: number; core: number; root: number } {
  const at = (u: number) =>
    heldDistance(
      shape,
      toItem(G, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]),
    );
  const d: number[] = [];
  let i0 = 0;
  for (let i = 0; i < SAMPLES; i++) {
    d.push(at(i / (SAMPLES - 1)));
    if (d[i] < d[i0]) i0 = i;
  }
  let m = d[i0];
  // điểm gần nhất nằm giữa hai mẫu bên cạnh: chia vàng (tấm mỏng hơn bước mẫu vẫn bắt được)
  let [lo, hi] = [
    Math.max(0, i0 - 1) / (SAMPLES - 1),
    Math.min(SAMPLES - 1, i0 + 1) / (SAMPLES - 1),
  ];
  let x1 = hi - GOLD * (hi - lo);
  let x2 = lo + GOLD * (hi - lo);
  let [f1, f2] = [at(x1), at(x2)];
  for (let k = 0; k < REFINE; k++) {
    if (f1 < f2) {
      [hi, x2, f2] = [x2, x1, f1];
      x1 = hi - GOLD * (hi - lo);
      f1 = at(x1);
    } else {
      [lo, x1, f1] = [x1, x2, f2];
      x2 = lo + GOLD * (hi - lo);
      f2 = at(x2);
    }
  }
  m = Math.min(m, f1, f2);
  const rr = r / G.u;
  return { gap: m - rr, core: -m, root: d[0] - rr };
}

/** Ngưỡng của ngón ôm theo đồ, đơn vị rig, góc độ */
export const HELD_FIT = {
  /** Khe da tới mặt món mà ngón ôm cuộn tới: da vừa chạm, ép nhẹ */
  touch: -0.15,
  /** Da lún quá ngần này thì gỡ ngón */
  sink: 0.25,
  /** Bước dò góc, độ */
  step: 5,
  /** Ngón ôm cuộn thêm nhiều nhất ngần này độ ở mỗi đốt; không chạm trong tầm thì giữ dáng */
  curl: 75,
  /** Ngón gỡ khỏi món mở ra nhiều nhất ngần này độ ở mỗi đốt */
  open: 80,
} as const;

/** Tầm gập tuyệt đối của mỗi đốt, độ: `[duỗi ngược, gập hết]` */
const LIMITS: Record<HeldFinger, readonly [readonly [number, number], readonly [number, number]]> =
  {
    thumb: [
      [-25, 70],
      [-20, 90],
    ],
    index: [
      [-15, 100],
      [-10, 110],
    ],
    middle: [
      [-15, 100],
      [-10, 110],
    ],
    ring: [
      [-15, 100],
      [-10, 110],
    ],
    pinky: [
      [-15, 100],
      [-10, 110],
    ],
  };

/** Vị trí góc gập gốc của mỗi ngón trong `HAND_DOF` (ba ngón giữa–út dùng chung `fingersBase`, cộng `curl` riêng) */
const BASE_DOF: Record<HeldFinger, number> = { thumb: 4, index: 6, middle: 8, ring: 8, pinky: 8 };

/** Bán kính nang của một đốt (cỡ `k`, cỡ dọc `long`), như `handCapsules` khi chưa phồng */
function pieceRadius(f: HeldFinger, seg: 0 | 1, k: number, long: number) {
  const kr = Math.min(k, 1.3 * long);
  const r =
    f === "thumb"
      ? HAND_BONES.thumb.r
      : f === "index"
        ? HAND_BONES.index.r
        : HAND_FINGERS[f as HandFinger].r;
  return r * kr * (seg === 0 ? 1 : 0.95);
}

const tipOf = (F: HandFrame): V3 => {
  const d = matVec(F.R, [0, -F.len, 0]);
  return [F.o[0] + d[0], F.o[1] + d[1], F.o[2] + d[2]];
};

export interface HeldFitInput {
  /** Số bàn tay của dáng kiểu cầm (`HAND_DOF`) */
  v: HandVec;
  side: number;
  k: number;
  long: number;
  shape: readonly HeldShape[];
  /** Món trong khung bàn tay (`gripFrame`, hay đo từ ma trận thế giới); `u` là đơn vị three của một đơn vị rig */
  G: GripFrame;
  /** Ngón ôm món: cuộn tới khi chạm; ngón khác chỉ gỡ khi lún */
  wrap?: readonly HeldFinger[];
}

/** Khe từng đốt của các ngón ở số bàn tay `v` (đã cộng độ gập thêm), đơn vị rig */
export function fingerClearance(
  inp: Omit<HeldFitInput, "wrap">,
  v: HandVec,
): Record<HeldFinger, [number, number]> {
  const F = handFrames(v, inp.side, inp.k, inp.long);
  const out = {} as Record<HeldFinger, [number, number]>;
  for (const f of HELD_FINGERS) {
    const g = [0, 1].map((s) => {
      const P = F[`${f}${s as 0 | 1}`];
      return capsuleClearance(
        inp.shape,
        inp.G,
        P.o,
        tipOf(P),
        pieceRadius(f, s as 0 | 1, inp.k, inp.long),
      ).gap;
    });
    out[f] = [g[0], g[1]];
  }
  return out;
}

/**
 * Độ gập thêm của mười đốt (`HAND_FIT`, độ) cho bàn tay giữ dáng `v` ôm món: mỗi ngón độc lập. Ngón khai `wrap` mà còn hở
 * thì cuộn cả hai đốt cùng lúc tới khi một đốt chạm (`HELD_FIT.touch`), rồi cuộn riêng đốt ngọn tới khi nó chạm; không
 * chạm trong tầm `HELD_FIT.curl` thì giữ dáng. Rồi mọi ngón: đốt gốc lún quá `HELD_FIT.sink` thì mở (hay gập, phía nào gần
 * hơn) tới vừa chạm, đốt ngọn cũng thế. Cuối cùng đốt ngọn của ngón ôm còn hở thì cuộn tiếp tới mặt kế
 */
export function heldFit(inp: HeldFitInput): number[] {
  const n = HAND_DOF.length;
  const out = new Array<number>(HAND_FIT.length).fill(0);
  const wrap = new Set(inp.wrap ?? []);
  const { touch, sink, step, curl, open } = HELD_FIT;
  HELD_FINGERS.forEach((f, j) => {
    const base = inp.v[BASE_DOF[f]] ?? 0;
    const tip = inp.v[BASE_DOF[f] + 1] ?? 0;
    const lim = LIMITS[f];
    // góc tuyệt đối của mỗi đốt cộng phần `curl` riêng của ngón (giữa–út)
    const extra = f === "thumb" || f === "index" ? 0 : HAND_FINGERS[f as HandFinger].curl;
    const lo = (s: 0 | 1) => lim[s][0] - (s ? tip : base) - extra;
    const hi = (s: 0 | 1) => lim[s][1] - (s ? tip : base) - extra;
    let d0 = 0;
    let d1 = 0;
    const vec = (a: number, b: number) => {
      const v = [...inp.v.slice(0, n)];
      while (v.length < n) v.push(0);
      const fit = new Array<number>(HAND_FIT.length).fill(0);
      fit[2 * j] = a;
      fit[2 * j + 1] = b;
      return [...v, ...fit];
    };
    /** Khe hai đốt; `root` khe ở gốc mỗi đốt — gập đốt ấy không đổi được nó */
    const probe = (a: number, b: number) => {
      const F = handFrames(vec(a, b), inp.side, inp.k, inp.long);
      return [0, 1].map((s) => {
        const P = F[`${f}${s as 0 | 1}`];
        return capsuleClearance(
          inp.shape,
          inp.G,
          P.o,
          tipOf(P),
          pieceRadius(f, s as 0 | 1, inp.k, inp.long),
        );
      });
    };
    const gap = (a: number, b: number) => probe(a, b).map((c) => c.gap) as [number, number];
    /** Dò `x` từ `from` theo `dir` tới `to` (bước `step`) cho tới khi `ok(x)`; chia đôi về biên. Không gặp thì `undefined` */
    const seek = (from: number, to: number, ok: (x: number) => boolean) => {
      const dir = Math.sign(to - from);
      if (!dir) return undefined;
      let prev = from;
      for (let x = from + dir * step; dir > 0 ? x <= to + 1e-9 : x >= to - 1e-9; x += dir * step) {
        const xs = dir > 0 ? Math.min(x, to) : Math.max(x, to);
        if (ok(xs)) {
          let [a, b] = [prev, xs];
          for (let i = 0; i < 6; i++) {
            const m = (a + b) / 2;
            if (ok(m)) b = m;
            else a = m;
          }
          return b;
        }
        prev = xs;
        if (xs === to) break;
      }
      return undefined;
    };
    if (wrap.has(f)) {
      const g = gap(0, 0);
      if (Math.min(...g) > touch) {
        const top = Math.min(curl, hi(0), hi(1));
        const s = seek(
          0,
          top,
          (x) => Math.min(...gap(Math.min(x, hi(0)), Math.min(x, hi(1)))) <= touch,
        );
        if (s !== undefined) {
          d0 = Math.min(s, hi(0));
          d1 = Math.min(s, hi(1));
          if (gap(d0, d1)[1] > touch) {
            const t = seek(d1, Math.min(d1 + curl, hi(1)), (x) => gap(d0, x)[1] <= touch);
            if (t !== undefined) d1 = t;
          }
        }
      }
    }
    // gỡ đốt lún: phía nào tới chỗ vừa chạm gần hơn (gốc đốt đã lún thì chỉ cần không lún hơn gốc); không phía nào thoát thì giữ
    const free = (s: 0 | 1) => {
      const cur = s ? d1 : d0;
      const at = (x: number) => (s ? gap(d0, x)[1] : gap(x, d1)[0]);
      const floor = Math.min(touch, probe(d0, d1)[s].root) - 0.1;
      const now = at(cur);
      if (now >= floor - sink) return;
      const ok = (x: number) => at(x) >= floor;
      const [x0, x1] = [Math.max(cur - open, lo(s)), Math.min(cur + open, hi(s))];
      const a = seek(cur, x0, ok);
      const b = seek(cur, x1, ok);
      let best =
        a === undefined ? b : b === undefined ? a : Math.abs(a - cur) <= Math.abs(b - cur) ? a : b;
      if (best === undefined) {
        // không góc nào tới chỗ vừa chạm: góc lún ít nhất trong tầm, khi đỡ hẳn
        let [bx, bg] = [cur, now];
        for (let x = x0; x <= x1 + 1e-9; x += step) {
          const g = at(x);
          if (g > bg + 1e-9) [bx, bg] = [x, g];
        }
        if (bg - now > 2 * sink) best = bx;
      }
      if (best === undefined) return;
      if (s) d1 = best;
      else d0 = best;
    };
    free(0);
    free(1);
    // ngón ôm: đốt gốc đã gỡ ra áp mặt món thì đốt ngọn cuộn tiếp tới mặt kế (vòng qua cạnh món dày)
    if (wrap.has(f) && gap(d0, d1)[1] > touch) {
      const t = seek(d1, Math.min(d1 + curl, hi(1)), (x) => gap(d0, x)[1] <= touch);
      if (t !== undefined) d1 = t;
    }
    out[2 * j] = d0;
    out[2 * j + 1] = d1;
  });
  return out;
}
