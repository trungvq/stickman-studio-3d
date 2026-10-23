// Thao tác kéo của Dáng tay trên JSON thô: tay nắm (dời / xoay bàn tay hay món quanh tâm nắm), vòng khuỷu (khoá `elbow`),
// bỏ khoá. Có mốc ở giây đang xem thì sửa mốc ấy; không có thì chèn mốc như ＋ (`plus.ts`) rồi sửa. Chỗ mới đo lại trên
// cảnh dựng lại và bù trường chỗ (`at`, `offset`) tới khi điểm kéo nằm đúng chỗ thả. README.md § Dáng tay.
import {
  handReport,
  heldBase,
  itemAt,
  itemCentre,
  matMul,
  matVec,
  type ActCharacter,
  type CharacterData,
  type HandSide,
  type M3,
  type SceneRuntime,
} from "@stickman3d/rig/core";
import { charAt, drawnHand, palmAt, trunkAt } from "./drawn";
import { movePoint, ringDir, toBody, turnBody, wrapDeg } from "./grab";
import {
  editKey,
  handsOf,
  holdAt,
  intentHold,
  keyValue,
  marksOf,
  timeOf,
  touch,
  type Json,
  type KeyRef,
  type V3,
} from "./keys";
import { fitPoint, plusHand, plusItem, PLUS_TOL, type PlusOptions } from "./plus";

/** Dời `d` rồi quay `R` quanh tâm nắm, thế giới rig */
export interface Move {
  d: V3;
  R?: M3;
}

export interface DragResult {
  raw: Json;
  key: KeyRef;
  /** Mốc vừa chèn (không có mốc ở giây ấy) */
  added: boolean;
  notes: string[];
  /** Điểm kéo (tâm nắm, tâm món) còn lệch chỗ thả, đơn vị rig */
  gap: number;
  /** Vòng khuỷu: `φ` muốn và `φ` vẽ ra sau khi khoá */
  phi?: { want: number; got: number };
}

/** Hai giây cách nhau dưới chừng này là cùng một mốc */
const SAME = 5e-4;
/** Lệch `φ` chấp nhận sau khi khoá (độ), số lần thử tìm góc khoá */
const PHI_TOL = 0.25;
const PHI_TRIES = 8;

const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const r2 = (x: number) => Math.round(x * 100) / 100 + 0;
const r4 = (x: number) => Math.round(x * 1e4) / 1e4 + 0;
const add = (a: readonly number[], b: readonly number[]): V3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
const sub = (a: readonly number[], b: readonly number[]): V3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(...sub(a, b));
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const fail = (m: string): never => {
  throw new Error(m);
};
const outOf = (side: HandSide) => (side === "right" ? -1 : 1);

const D = 180 / Math.PI;
/** Góc quay của phép quay `R`, độ */
const turnOf = (R: M3) => Math.acos(Math.max(-1, Math.min(1, (R[0] + R[4] + R[8] - 1) / 2))) * D;
const cross = (a: readonly number[], b: readonly number[]): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
/** Khung bàn tay (cột: lòng tay, ngón, tích), thế giới rig */
const handFrame = (p: { palm: V3; finger: V3 }): M3 => {
  const c = cross(p.palm, p.finger);
  return [p.palm[0], p.finger[0], c[0], p.palm[1], p.finger[1], c[1], p.palm[2], p.finger[2], c[2]];
};
const transpose = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const WRIST_NAME = { turn: "xoay", bend: "gập", dev: "lệch" } as const;

/**
 * Bàn tay xoay chưa tới: khung bàn tay sau khi áp (`after`) lệch khung muốn (`R` áp lên khung trước `before`) quá 2° và quá
 * một phần mười góc muốn — cổ tay kẹp (`clamped`) hay món vượt kẹp. Trả dòng báo, tới thì `undefined`
 */
export function turnShort(
  R: M3,
  before: { palm: V3; finger: V3 },
  after: { palm: V3; finger: V3 },
  clamped: readonly ("turn" | "bend" | "dev")[],
): string | undefined {
  const want = turnOf(R);
  const miss = turnOf(matMul(handFrame(after), transpose(matMul(R, handFrame(before)))));
  if (miss <= Math.max(2, want * 0.1)) return undefined;
  const why = clamped.length
    ? `cổ tay kẹp ${clamped.map((k) => WRIST_NAME[k]).join(", ")}`
    : "cổ tay hết miền khớp";
  return `bàn tay chỉ xoay được ~${Math.max(0, want - miss).toFixed(0)}° / ${want.toFixed(0)}° (lệch ${miss.toFixed(0)}°), ${why}`;
}

/** Xoay chưa tới sau khi áp `raw`: so bàn tay trước (`rt0`) và sau, đọc khớp kẹp ở cảnh mới */
function turnNote(
  R: M3 | undefined,
  rt0: SceneRuntime,
  raw: Json,
  id: string,
  side: HandSide,
  t: number,
  o: PlusOptions,
): string | undefined {
  if (!R) return undefined;
  const before = palmAt(rt0, id, side, t, o.char);
  const rt1 = o.rebuild(raw);
  const after = palmAt(rt1, id, side, t, o.char);
  const rep = handReport(rt1, id, side, t, o);
  if (!before || !after || !rep) return undefined;
  const over = (["turn", "bend", "dev"] as const).filter((k) => rep.wrist.over[k] > 0.05);
  return turnShort(R, before, after, [...new Set([...rep.wrist.clamped, ...over])]);
}

/** Mốc tay `side` của `id` ở đúng giây `t` */
export function handKeyAt(raw: Json, id: string, side: HandSide, t: number): KeyRef | undefined {
  const marks = marksOf(raw);
  const i = (handsOf(raw, id) ?? []).findIndex(
    (k) => k[side] !== undefined && Math.abs(timeOf(k.t, marks) - t) < SAME,
  );
  return i >= 0 ? { kind: "hand", id, side, index: i } : undefined;
}

/** Mốc món `item` ở đúng giây `t` */
export function itemKeyAt(raw: Json, item: string, t: number): KeyRef | undefined {
  const marks = marksOf(raw);
  const i = ((raw.items as Json[] | undefined) ?? []).findIndex(
    (k) => k.item === item && Math.abs(timeOf(k.t, marks) - t) < SAME,
  );
  return i >= 0 ? { kind: "item", index: i } : undefined;
}

interface Base {
  raw: Json;
  rt: SceneRuntime;
  key: KeyRef;
  added: boolean;
  notes: string[];
}

/** Mốc tay ở `t`: mốc sẵn có, không thì chèn như ＋ (giữ hình hết mức có thể — thao tác kéo sửa tiếp) */
function handBase(
  raw: Json,
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  t: number,
  o: PlusOptions,
): Base {
  const key = handKeyAt(raw, id, side, t);
  if (key) return { raw, rt, key, added: false, notes: [] };
  const r = plusHand(raw, rt, id, side, t, { ...o, tol: Infinity });
  return { raw: r.raw, rt: o.rebuild(r.raw), key: r.key, added: true, notes: r.notes };
}

/**
 * Bù trường chỗ của mốc `key` để `measure` ra `want`. Trường là `at` (mốc có `at`, hay chưa có chỗ) hay `offset` (mốc
 * theo mốc thân `to`); `x` là điểm thế giới rig, trường đổi theo `x − x0` (`offset` qua hệ thân `Rr`, chia `s`), rồi Broyden
 */
function fitPlace(
  raw: Json,
  key: KeyRef,
  x0: V3,
  want: V3,
  measure: (raw: Json) => V3 | undefined,
  basis: { Rr: M3; s: number; out: number },
  start: (m: Json) => void,
): { raw: Json; gap: number } {
  const m0 = keyValue(raw, key);
  const v0: Json = isObj(m0) ? m0 : {};
  const field = v0.at === undefined && v0.to !== undefined ? "offset" : "at";
  const fresh = v0.at === undefined && v0.to === undefined;
  const at0 = (v0[field] as number[] | undefined) ?? (fresh ? x0 : [0, 0, 0]);
  const value = (x: V3): V3 => {
    const d = sub(x, x0);
    if (field === "at") return add(at0, d).map(r2) as V3;
    const b = toBody(d, basis.Rr, basis.out);
    return add(
      at0,
      b.map((v) => v / (basis.s || 1)),
    ).map(r2) as V3;
  };
  const edit = (x: V3) =>
    editKey(raw, key, (m) => {
      const o = m ?? {};
      if (fresh) start(o);
      o[field] = value(x);
      touch(o);
      return o;
    });
  const got = (x: V3) => {
    try {
      return measure(edit(x));
    } catch {
      return undefined;
    }
  };
  const x = fitPoint(want, want, got, { tol: 0.02, steps: 8 });
  const out = edit(x);
  const p = measure(out);
  return { raw: out, gap: p ? dist(p, want) : Infinity };
}

/**
 * Tay nắm trên bàn tay đồ theo tay hay tay tự do: dời tâm nắm `d`, xoay bàn tay `R` quanh tâm nắm. Xoay ghi ý định món
 * (`hold.face`, `hold.roll` vectơ hệ thân) cho đồ theo tay, `palm` + `fingers` cho tay tự do (bỏ `bend`). Chỗ: `at` hay
 * `offset` bù tới khi tâm nắm ở chỗ thả
 */
export function dragHand(
  raw: Json,
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  t: number,
  mv: Move,
  o: PlusOptions,
): DragResult {
  const d0 = drawnHand(rt, id, side, t, o) ?? fail(`\`${id}\` không có \`world\``);
  if (d0.support) fail("tay phụ của `both` theo tay dẫn: kéo ở tay dẫn");
  if (d0.mode === "keyed" || d0.mode === "both") fail("tay theo đồ: kéo món");
  const want = add(d0.grip, mv.d);
  const b = handBase(raw, rt, id, side, t, o);
  let cur = b.raw;
  const notes = [...b.notes];
  const out = outOf(side);
  const tk = trunkAt(b.rt, id, t, o.char) ?? fail(`không có nhân vật của \`${id}\``);
  const d1 = drawnHand(b.rt, id, side, t, o)!;
  if (mv.R) {
    const R = mv.R;
    if (d1.mode === "hand") {
      const axes = d1.axes ?? fail("không đọc được hướng món đang vẽ");
      const hold = holdAt(cur, id, side, t) ?? fail("không thấy `hold` có hiệu lực");
      const face = turnBody(axes.face, R, tk.Rr, out);
      const roll = turnBody(axes.roll, R, tk.Rr, out);
      cur = editKey(cur, b.key, (m) => {
        const x = m ?? {};
        x.hold = intentHold(hold, { face, roll });
        return x;
      });
    } else {
      const p = palmAt(b.rt, id, side, t, o.char) ?? fail("không đọc được lòng tay đang vẽ");
      cur = editKey(cur, b.key, (m) => {
        const x = m ?? {};
        x.palm = toBody(matVec(R, p.palm), tk.Rr, out).map(r4);
        x.fingers = toBody(matVec(R, p.finger), tk.Rr, out).map(r4);
        if (x.bend !== undefined) {
          delete x.bend;
          notes.push("bỏ `bend` của mốc: `palm` + `fingers` khai cả hướng bàn tay");
        }
        return x;
      });
    }
  }
  const measure = (r: Json) => drawnHand(o.rebuild(r), id, side, t, o)?.grip;
  const fit = fitPlace(cur, b.key, d1.grip, want, measure, { Rr: tk.Rr, s: tk.s, out }, (m) => {
    if (m.point === undefined) m.point = "grip";
  });
  if (fit.gap > PLUS_TOL && d1.blending)
    fail(
      `không sửa ở ${t.toFixed(2)} s: tay đang hoà sang lần cầm mới (\`HOLD_BLEND\`), đích ở giây này chưa đổi được hình — tua ra sau quãng hoà`,
    );
  if (fit.gap > PLUS_TOL)
    notes.push(`tâm nắm còn lệch chỗ thả ${fit.gap.toFixed(1)} px (ngoài tầm với hay cổ tay kẹp)`);
  const short = turnNote(mv.R, b.rt, fit.raw, id, side, t, o);
  if (short) notes.push(short);
  return { raw: fit.raw, key: b.key, added: b.added, notes, gap: fit.gap };
}

/** Món đặt trước `item` ở `t` theo `items[]`: tâm hộp bao và khung món (thế giới rig) */
function itemPose(rt: SceneRuntime, item: string, t: number, id: string, c: ActCharacter) {
  const spec = rt.held[item] ?? rt.held[heldBase(item)];
  const p = itemAt(rt, item, t, { chars: { [id]: c as CharacterData } });
  if (!p || !spec) return undefined;
  const q = itemCentre(spec);
  return { R: p.R, at: add(p.P, matVec(p.R, [q[0] * p.s, q[1] * p.s, q[2] * p.s])) };
}

/**
 * Tay nắm trên bàn tay theo đồ: dời `d`, xoay `R` **món** quanh tâm nắm, ghi vào mốc `items[]` ở `t` (chèn như ＋ nếu
 * chưa có). Xoay ghi `face`, `roll` trục khung món về vectơ hệ thân người cầm (bỏ `up`); chỗ (`at`, `offset`) bù tới khi
 * tâm món ở chỗ mới
 */
export function dragItem(
  raw: Json,
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  t: number,
  mv: Move,
  o: PlusOptions,
): DragResult {
  const rep = handReport(rt, id, side, t, o) ?? fail(`\`${id}\` không có \`world\``);
  const run = rep.run;
  if (!run || run.mode === "hand") fail("tay không theo đồ ở giây này");
  if (run!.lead) fail("tay phụ của `both`: kéo món ở tay dẫn");
  const item = run!.item;
  let key = itemKeyAt(raw, item, t);
  let base = raw;
  let brt = rt;
  if (!key) {
    const r = plusItem(raw, rt, id, side, item, t, { ...o, tol: Infinity });
    [base, key, brt] = [r.raw, r.key, o.rebuild(r.raw)];
  }
  const added = !itemKeyAt(raw, item, t);
  const c = charAt(brt, id, t, o.char) ?? fail(`không có nhân vật của \`${id}\``);
  const tk = trunkAt(brt, id, t, c)!;
  const p0 = itemPose(brt, item, t, id, c) ?? fail(`không thấy ${item} ở ${t.toFixed(2)} s`);
  const grip = drawnHand(brt, id, side, t, o)!.grip;
  const R = mv.R ?? I3;
  const want = movePoint(p0.at, grip, R, mv.d);
  let cur = base;
  if (mv.R) {
    const R1 = matMul(R, p0.R);
    const face = toBody(matVec(R1, [0, 0, 1]), tk.Rr, -1).map(r4);
    const roll = toBody(matVec(R1, [0, 1, 0]), tk.Rr, -1).map(r4);
    cur = editKey(cur, key, (m) => {
      m!.face = { axis: [0, 0, 1], toward: face };
      m!.roll = { axis: [0, 1, 0], toward: roll };
      delete m!.up;
    });
  }
  const measure = (r: Json) => itemPose(o.rebuild(r), item, t, id, c)?.at;
  const fit = fitPlace(cur, key, p0.at, want, measure, { Rr: tk.Rr, s: tk.s, out: -1 }, (m) => {
    delete m.point;
    delete m.rest;
  });
  const notes: string[] = [];
  if (fit.gap > PLUS_TOL) notes.push(`tâm món còn lệch chỗ thả ${fit.gap.toFixed(1)} px`);
  const short = turnNote(mv.R, brt, fit.raw, id, side, t, o);
  if (short) notes.push(short);
  return { raw: fit.raw, key, added, notes, gap: fit.gap };
}

/**
 * Vòng khuỷu: khoá khuỷu ở góc `phi` (độ) — `elbow` là hướng thế giới rig trên vòng, `elbowLock: true` — ở mốc tay `t`
 * (chèn như ＋ nếu chưa có). Tay không theo món đặt trước cần `at` / `to` ở mốc khoá: mốc chưa có thì ghi `at` ở tâm nắm
 * đang vẽ. Hướng chỉnh lại theo vòng của cảnh mới tới khi `φ` vẽ ra lệch dưới `PHI_TOL`
 */
export function lockElbow(
  raw: Json,
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  t: number,
  phi: number,
  o: PlusOptions,
): DragResult {
  const d0 = drawnHand(rt, id, side, t, o) ?? fail(`\`${id}\` không có \`world\``);
  if (d0.support) fail("tay phụ của `both` không khoá khuỷu");
  const b = handBase(raw, rt, id, side, t, o);
  const notes = [...b.notes];
  let cur = b.raw;
  let rep = handReport(b.rt, id, side, t, o)!;
  const placed = rep.mode === "keyed" || rep.mode === "both";
  const v = keyValue(cur, b.key);
  if (!placed && !(isObj(v) && (v.at !== undefined || v.to !== undefined))) {
    const tk = trunkAt(b.rt, id, t, o.char)!;
    const fit = fitPlace(
      cur,
      b.key,
      rep.grip,
      [...d0.grip] as V3,
      (r) => drawnHand(o.rebuild(r), id, side, t, o)?.grip,
      { Rr: tk.Rr, s: tk.s, out: outOf(side) },
      (m) => {
        if (m.point === undefined) m.point = "grip";
      },
    );
    cur = fit.raw;
    notes.push("thêm `at` ở tâm nắm đang vẽ: khoá khuỷu cần đích ở mốc");
  }
  const base = cur;
  // `φ` của khoá đo trên vòng của cảnh mới: cổ tay dời theo khuỷu (tâm nắm giữ chỗ) nên vòng cũng dời. Tìm góc `a` trên
  // vòng gốc cho `φ` vẽ ra bằng `phi` (cát tuyến, độ dốc kẹp), giữ lần thử lệch ít nhất
  const ring = rep.ring;
  const tryAt = (a: number) => {
    const e = ringDir(ring, a).map(r4);
    const raw2 = editKey(base, b.key, (m) => {
      const x = m ?? {};
      x.elbow = e;
      x.elbowLock = true;
      touch(x);
      return x;
    });
    const r = handReport(o.rebuild(raw2), id, side, t, o)!;
    return { a, raw: raw2, rep: r, err: wrapDeg(phi - r.phi) };
  };
  let prev = tryAt(phi);
  let best = prev;
  let slope = 1;
  for (let i = 0; i < PHI_TRIES && Math.abs(best.err) >= PHI_TOL; i++) {
    const step = Math.max(-60, Math.min(60, prev.err / slope));
    const next = tryAt(prev.a + step);
    const da = wrapDeg(next.a - prev.a);
    const s = Math.abs(da) > 1e-6 ? wrapDeg(prev.err - next.err) / da : slope;
    slope = Math.max(0.2, Math.min(5, Number.isFinite(s) && s > 0 ? s : slope));
    if (Math.abs(next.err) < Math.abs(best.err)) best = next;
    prev = next;
  }
  cur = best.raw;
  rep = best.rep;
  const got = rep.phi;
  if (!rep.elbowLock)
    fail(
      `không khoá khuỷu ở ${t.toFixed(2)} s: khoá không có tác dụng ở giây này (tay đang hoà giữa hai lần cầm hay theo hành động) — không áp`,
    );
  if (Math.abs(wrapDeg(phi - got)) > 0.5)
    notes.push(`khuỷu vẽ ra lệch chỗ thả ${Math.abs(wrapDeg(phi - got)).toFixed(1)}°`);
  return {
    raw: cur,
    key: b.key,
    added: b.added,
    notes,
    gap: 0,
    phi: { want: phi, got },
  };
}

/** Nhấp đúp lên vòng khuỷu: bỏ khoá ở mốc tay `t` (`elbowLock` và `elbow`), về khuỷu tự nhiên */
export function unlockElbow(
  raw: Json,
  id: string,
  side: HandSide,
  t: number,
): { raw: Json; key: KeyRef } {
  const key = handKeyAt(raw, id, side, t);
  const v = key && keyValue(raw, key);
  if (!key || !isObj(v) || v.elbowLock !== true) fail("không có mốc khoá khuỷu ở giây này");
  return {
    raw: editKey(raw, key!, (m) => {
      delete m!.elbowLock;
      delete m!.elbow;
      touch(m);
    }),
    key: key!,
  };
}
