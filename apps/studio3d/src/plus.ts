// Nút ＋ của thanh tua: mốc mới ở giây đang xem giữ đúng hình đang vẽ. Giá trị đầu lấy thứ đang vẽ (`handValueAt`,
// `itemValueAt`), rồi dựng lại cảnh với mốc mới, đo và bù `at` (Broyden) tới khi tâm nắm, cổ tay, món ở giây ấy lệch
// không quá `PLUS_TOL`; không bù được thì chặn, kèm giây gần nhất thêm được. README.md § Dáng tay.
import {
  holdBlending,
  type ActCharacter,
  type HandSide,
  type SceneRuntime,
} from "@stickman3d/rig/core";
import { drawnHand, drawnItem } from "./drawn";
import {
  handValueAt,
  insertHandKey,
  insertItemKey,
  itemValueAt,
  type Json,
  type KeyRef,
  type V3,
} from "./keys";

/** Lệch tối đa ở giây của mốc mới (đơn vị rig, px): tâm nắm, cổ tay, tâm món */
export const PLUS_TOL = 0.5;
/** Tìm giây thêm được trong chừng này giây quanh giây đang xem, thử tối đa `PLUS_TRIES` giây */
const PLUS_SEARCH = 1;
const PLUS_TRIES = 6;

export interface PlusOptions {
  /** Runtime của JSON thô (cảnh đã parse, `chars` như cảnh đang xem) */
  rebuild(raw: Json): SceneRuntime;
  char?: ActCharacter;
  eye?: readonly number[];
  /** Lưới khung để tìm giây thêm được */
  fps: number;
  /** Giây cảnh */
  dur: number;
  /** Lệch tối đa, bỏ trống là `PLUS_TOL` */
  tol?: number;
}

export interface PlusResult {
  raw: Json;
  key: KeyRef;
  notes: string[];
  /** Lệch còn lại ở giây ấy: tâm nắm, cổ tay (mốc tay) hay tâm món (mốc món) */
  gap: { grip?: number; wrist?: number; item?: number };
}

const sub = (a: readonly number[], b: readonly number[]): V3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(...sub(a, b));
const r2 = (x: number) => Math.round(x * 100) / 100 + 0;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const fail = (m: string): never => {
  throw new Error(m);
};

/** Nghiệm của `J · x = b` (Cramer); `J` suy biến thì `b` */
function solve3(J: number[][], b: V3): V3 {
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(J);
  if (Math.abs(d) < 1e-9) return b;
  const col = (i: number) => det(J.map((row, r) => row.map((x, c) => (c === i ? b[r] : x))));
  return [col(0) / d, col(1) / d, col(2) / d];
}

/**
 * `x` để `got(x)` ra `want`, bắt đầu từ `x0`: Broyden, Jacobian đầu là đơn vị (đích về đúng chỗ), co lại theo phần hoà khi
 * tay đang hoà. Trả `x` tốt nhất đã thử
 */
export function fitPoint(
  x0: V3,
  want: V3,
  got: (x: V3) => V3 | undefined,
  o: { steps?: number; tol?: number } = {},
): V3 {
  const tol = o.tol ?? 0.02;
  const J = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  let x = x0;
  let f = got(x);
  if (!f) return x0;
  let best = { x, e: dist(f, want) };
  for (let i = 0; i < (o.steps ?? 8) && best.e > tol; i++) {
    const dx = solve3(J, sub(want, f));
    const x1 = [x[0] + dx[0], x[1] + dx[1], x[2] + dx[2]] as V3;
    const f1 = got(x1);
    if (!f1) break;
    const df = sub(f1, f);
    const Jdx = J.map((row) => row[0] * dx[0] + row[1] * dx[1] + row[2] * dx[2]);
    const n = dx[0] ** 2 + dx[1] ** 2 + dx[2] ** 2;
    if (n < 1e-12) break;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) J[r][c] += ((df[r] - Jdx[r]) * dx[c]) / n;
    [x, f] = [x1, f1];
    const e = dist(f, want);
    if (e < best.e) best = { x, e };
  }
  return best.x;
}

const same = (a: number, b: number) => Math.abs(a - b) < 5e-4;

const worst = (g: { grip: number; wrist: number }) => Math.max(g.grip, g.wrist);

/**
 * Mốc tay mới ở `t` lệch ít nhất: thử giá trị của `handValueAt` rồi các bản thay thế (`alts`); bản có `at` thì bù `at` theo
 * điểm đặt (`point`). Tay đã có mốc ở `t` thì lỗi (bên gọi mở thẻ mốc ấy)
 */
function handAt(
  raw: Json,
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  t: number,
  o: PlusOptions,
) {
  const d0 = drawnHand(rt, id, side, t, o) ?? fail(`\`${id}\` không có \`world\``);
  const { value, notes, alts } = handValueAt(raw, id, side, t, d0);
  const measure = (v: Json | null) => {
    const r = insertHandKey(raw, id, side, t, v);
    const d = drawnHand(o.rebuild(r.raw), id, side, t, o);
    return d && { r, d, g: { grip: dist(d.grip, d0.grip), wrist: dist(d.wrist, d0.wrist) } };
  };
  const tries: (Json | null)[] = [value, ...alts];
  let best: (NonNullable<ReturnType<typeof measure>> & { shift: number }) | undefined;
  for (const v of tries) {
    let m = measure(v);
    if (!m) continue;
    let shift = 0;
    if (isObj(v) && Array.isArray(v.at) && worst(m.g) > 0.05) {
      const p = v.point === "wrist" ? "wrist" : "grip";
      const at = fitPoint(v.at as V3, d0[p], (x) => {
        try {
          return measure({ ...v, at: x })?.d[p];
        } catch {
          return undefined;
        }
      }).map(r2) as V3;
      const m2 = measure({ ...v, at });
      if (m2 && worst(m2.g) < worst(m.g)) [m, shift] = [m2, dist(at, v.at as V3)];
    }
    if (!best || worst(m.g) < worst(best.g)) best = { ...m, shift };
    if (worst(best.g) <= 0.05) break;
  }
  if (!best) return fail("không dựng được cảnh với mốc mới");
  if (best.shift > 1)
    notes.push(
      d0.blending
        ? `tay đang hoà sang lần cầm mới (\`HOLD_BLEND\`): đích \`at\` dời ${best.shift.toFixed(1)} px khỏi điểm đang vẽ để bù phần hoà — hết quãng hoà bàn tay tới đúng \`at\` ấy`
        : `đích \`at\` dời ${best.shift.toFixed(1)} px khỏi điểm đang vẽ để bàn tay ở giây này không đổi`,
    );
  return { m: best, g: best.g, notes, d0 };
}

/**
 * Thêm mốc tay `side` của `id` ở `t`, hình ở `t` giữ nguyên (tâm nắm và cổ tay lệch ≤ `PLUS_TOL`). Không giữ được thì ném
 * lỗi nêu lý do và giây gần nhất thêm được
 */
export function plusHand(
  raw: Json,
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  t: number,
  o: PlusOptions,
): PlusResult {
  const { m, g, notes, d0 } = handAt(raw, rt, id, side, t, o);
  const tol = o.tol ?? PLUS_TOL;
  if (worst(g) <= tol) return { raw: m.r.raw, key: m.r.key, notes, gap: g };
  const why = d0.blending
    ? `tay đang hoà sang lần cầm mới (\`HOLD_BLEND\`), bù đích không giữ được hình`
    : "mốc mới không giữ được hình";
  const near = nearestOk(
    t,
    o,
    (c) => worst(handAt(raw, rt, id, side, c, o).g) <= tol,
    (c) => holdBlending(rt, id, side === "right" ? "R" : "L", c) || hasHandKey(rt, id, side, c),
  );
  return fail(
    `không thêm mốc ở ${t.toFixed(2)} s: ${why} (tâm nắm lệch ${g.grip.toFixed(1)} px, cổ tay ${g.wrist.toFixed(1)} px). ${near}`,
  );
}

function hasHandKey(rt: SceneRuntime, id: string, side: HandSide, t: number) {
  const keys = rt.cast.find((m) => m.id === id)?.world?.hands ?? [];
  return keys.some((k) => k[side] !== undefined && same(k.t, t));
}

/** Giây gần `t` nhất trên lưới khung mà `ok`, bỏ qua giây `skip`; lời báo cho bên gọi */
function nearestOk(
  t: number,
  o: PlusOptions,
  ok: (t: number) => boolean,
  skip: (t: number) => boolean,
): string {
  const f0 = Math.round(t * o.fps);
  let tries = 0;
  for (let k = 1; k <= PLUS_SEARCH * o.fps && tries < PLUS_TRIES; k++)
    for (const s of [1, -1]) {
      const c = (f0 + s * k) / o.fps;
      if (c < 0 || c > o.dur + 1e-9 || skip(c)) continue;
      tries++;
      try {
        if (ok(c)) return `Giây gần nhất thêm được: ${c.toFixed(2)} s.`;
      } catch {
        // giây ấy cũng không thêm được
      }
      if (tries >= PLUS_TRIES) break;
    }
  return `Không thấy giây thêm được trong ±${PLUS_SEARCH} s.`;
}

/**
 * Thêm mốc món `item` (lần cầm tay `side` của `id`) ở `t`: tâm hộp bao, hướng như đang vẽ; tâm món lệch quá `PLUS_TOL` thì
 * bù `at`, không được thì ném lỗi
 */
export function plusItem(
  raw: Json,
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  item: string,
  t: number,
  o: PlusOptions,
): PlusResult {
  const p =
    drawnItem(rt, id, side, item, t, o) ?? fail(`không thấy ${item} đang vẽ ở ${t.toFixed(2)} s`);
  const measure = (at: V3) => {
    const r = insertItemKey(raw, t, itemValueAt(id, item, at, p.face, p.roll));
    const q = drawnItem(o.rebuild(r.raw), id, side, item, t, o);
    return q && { r, q };
  };
  let m = measure(p.at) ?? fail("không dựng được cảnh với mốc mới");
  let e = dist(m.q.at, p.at);
  if (e > 0.05) {
    const at = fitPoint(p.at, p.at, (x) => {
      try {
        return measure(x)?.q.at;
      } catch {
        return undefined;
      }
    });
    const m2 = measure(at.map(r2) as V3);
    if (m2 && dist(m2.q.at, p.at) < e) [m, e] = [m2, dist(m2.q.at, p.at)];
  }
  if (e > (o.tol ?? PLUS_TOL))
    fail(`không thêm mốc món ở ${t.toFixed(2)} s: món lệch ${e.toFixed(1)} px so với đang vẽ`);
  return { raw: m.r.raw, key: m.r.key, notes: [], gap: { item: e } };
}
