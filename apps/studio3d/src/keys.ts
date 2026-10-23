// Sửa mốc tay (`cast[].world.hands`) và mốc món (`items`) trên JSON thô của cảnh: hàm thuần, trả bản mới, giữ mọi trường
// lạ và dạng mốc tên `@tên±Δ`. Thanh tua của studio gọi chúng; README.md § Dáng tay.
import {
  BEZIER_DEFAULT,
  markTime,
  parseMarkRef,
  type EASE_NAMES,
  type HandSide,
} from "@stickman3d/rig/core";

export type Json = Record<string, unknown>;
export type Marks = Record<string, number>;
export type Ease = (typeof EASE_NAMES)[number];
export type V3 = [number, number, number];

/** Một mốc trên thanh tua: mốc tay của một tay (`index` vào `hands` của người ấy) hay mốc món (`index` vào `items`) */
export type KeyRef =
  { kind: "hand"; id: string; side: HandSide; index: number } | { kind: "item"; index: number };

const SLIDE = ["along", "slant", "around", "tilt", "psi", "inset"] as const;
const r2 = (x: number) => Math.round(x * 100) / 100 + 0;
const r3 = (x: number) => Math.round(x * 1000) / 1000 + 0;
const r4 = (x: number) => Math.round(x * 1e4) / 1e4 + 0;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const fail = (m: string): never => {
  throw new Error(m);
};

/** Hai giây cách nhau dưới chừng này là cùng một mốc */
const SAME = 5e-4;

export const marksOf = (raw: Json): Marks => (isObj(raw.marks) ? (raw.marks as Marks) : {});
export const timeOf = (ref: unknown, marks: Marks): number =>
  markTime(ref as number | string, marks);

/** Mốc tên có giây gần `t` nhất */
export function nearestMark(t: number, marks: Marks): string | undefined {
  let best: string | undefined;
  for (const [k, v] of Object.entries(marks))
    if (
      typeof v === "number" &&
      (best === undefined || Math.abs(v - t) < Math.abs(marks[best] - t))
    )
      best = k;
  return best;
}

/**
 * Trường thời gian `ref` dời tới giây `t`: mốc tên giữ tên, chỉ đổi phần lệch (`@tra` → `@tra+0.2`); số thì là số `t`.
 * `snap` (Alt) bắt vào mốc tên gần nhất, không lệch
 */
export function retime(ref: unknown, t: number, marks: Marks, snap = false): number | string {
  const at = Math.max(0, t);
  const near = snap ? nearestMark(at, marks) : undefined;
  if (near) return `@${near}`;
  const m = parseMarkRef(ref);
  if (!m || marks[m.name] === undefined) return r3(at);
  const d = r3(at - marks[m.name]);
  return d ? `@${m.name}${d > 0 ? "+" : "-"}${Math.abs(d)}` : `@${m.name}`;
}

/** Giây `t` thành trường thời gian của mốc mới: trùng một mốc tên thì `@tên`, không thì số */
export function refAt(t: number, marks: Marks): number | string {
  const near = nearestMark(t, marks);
  return near && Math.abs(marks[near] - t) < SAME ? `@${near}` : r3(Math.max(0, t));
}

/** Mảng mốc tay của người `id` trong `raw` (chính mảng ấy, không chép) */
export function handsOf(raw: Json, id: string): Json[] | undefined {
  const c = (raw.cast as Json[] | undefined)?.find((m) => isObj(m) && m.id === id);
  const w = c?.world;
  return isObj(w) && Array.isArray(w.hands) ? (w.hands as Json[]) : undefined;
}

const itemsOf = (raw: Json): Json[] | undefined =>
  Array.isArray(raw.items) ? (raw.items as Json[]) : undefined;

/** Chỗ chèn mốc giây `t` vào `list`: sau mọi mốc có giây ≤ `t`, các mốc khác giữ thứ tự */
function slot(list: Json[], t: number, marks: Marks): number {
  let i = 0;
  list.forEach((k, j) => {
    if (timeOf(k.t, marks) <= t + 1e-9) i = j + 1;
  });
  return i;
}

/** Giá trị đang soạn của mốc: tay (`right` / `left` của dòng mốc, có thể `null`) hay mốc món */
export function keyValue(raw: Json, k: KeyRef): unknown {
  if (k.kind === "item") return itemsOf(raw)?.[k.index];
  return handsOf(raw, k.id)?.[k.index]?.[k.side];
}

/** Giây của mốc */
export function keyTime(raw: Json, k: KeyRef): number {
  const list = k.kind === "item" ? itemsOf(raw) : handsOf(raw, k.id);
  const m = list?.[k.index] ?? fail("không có mốc ấy");
  return timeOf(m.t, marksOf(raw));
}

/**
 * Dời mốc tới giây `t` (`retime`). Mốc tay mà dòng mốc còn nhắc tay kia thì tách tay này ra một dòng mới ở giây mới
 * (`snap` của dòng chép theo); dòng đổi chỗ trong mảng theo giây mới, các dòng khác giữ thứ tự. Giây mới trùng một dòng
 * mốc khác (`t` của dòng mốc tay, của mốc cùng món phải tăng hẳn) thì ghi vào dòng ấy; dòng ấy đã có tay này, món này thì lỗi
 */
export function moveKey(raw: Json, k: KeyRef, t: number, snap = false): { raw: Json; key: KeyRef } {
  const out = structuredClone(raw);
  const marks = marksOf(out);
  const list = (k.kind === "item" ? itemsOf(out) : handsOf(out, k.id)) ?? fail("không có mốc ấy");
  const row = list[k.index] ?? fail("không có mốc ấy");
  const ref = retime(row.t, t, marks, snap);
  const at = timeOf(ref, marks);
  const j = list.findIndex(
    (x, i) =>
      i !== k.index &&
      Math.abs(timeOf(x.t, marks) - at) < SAME &&
      (k.kind === "hand" || x.item === row.item),
  );
  if (j >= 0 && k.kind === "item") fail(`món đã có mốc ở ${at.toFixed(3)} s`);
  if (j >= 0 && k.kind === "hand") {
    const other = list[j];
    if (other[k.side] !== undefined) fail(`tay đã có mốc ở ${at.toFixed(3)} s`);
    other[k.side] = row[k.side];
    delete row[k.side];
    if (row.right === undefined && row.left === undefined) list.splice(k.index, 1);
    return { raw: out, key: { ...k, index: list.indexOf(other) } };
  }
  let moved: Json;
  if (k.kind === "hand" && row[k.side === "right" ? "left" : "right"] !== undefined) {
    moved = { t: ref, [k.side]: row[k.side], ...(row.snap !== undefined && { snap: row.snap }) };
    delete row[k.side];
  } else {
    list.splice(k.index, 1);
    moved = row;
    row.t = ref;
  }
  const i = slot(list, at, marks);
  list.splice(i, 0, moved);
  return { raw: out, key: { ...k, index: i } };
}

/**
 * Thêm mốc tay `value` (object hay `null`) cho tay `side` của `id` ở giây `t`. Đã có dòng mốc đúng giây ấy mà chưa nhắc tay
 * này thì ghi vào dòng ấy; tay này đã có mốc ở giây ấy thì lỗi
 */
export function insertHandKey(
  raw: Json,
  id: string,
  side: HandSide,
  t: number,
  value: Json | null,
): { raw: Json; key: KeyRef } {
  const out = structuredClone(raw);
  const marks = marksOf(out);
  const c = (out.cast as Json[] | undefined)?.find((m) => isObj(m) && m.id === id);
  const w = (c?.world as Json | undefined) ?? fail(`\`${id}\` không có \`world\``);
  const list = (w.hands as Json[] | undefined) ?? (w.hands = []);
  const same = list.findIndex((k) => Math.abs(timeOf(k.t, marks) - t) < SAME);
  if (same >= 0) {
    if (list[same][side] !== undefined) fail(`tay đã có mốc ở ${t.toFixed(3)} s`);
    list[same][side] = value;
    return { raw: out, key: { kind: "hand", id, side, index: same } };
  }
  const i = slot(list, t, marks);
  list.splice(i, 0, { t: refAt(t, marks), [side]: value });
  return { raw: out, key: { kind: "hand", id, side, index: i } };
}

/** Thêm mốc món `mark` (chưa có `t`) ở giây `t` */
export function insertItemKey(raw: Json, t: number, mark: Json): { raw: Json; key: KeyRef } {
  const out = structuredClone(raw);
  const marks = marksOf(out);
  const list = (out.items as Json[] | undefined) ?? (out.items = []);
  if (list.some((k) => k.item === mark.item && Math.abs(timeOf(k.t, marks) - t) < SAME))
    fail(`món đã có mốc ở ${t.toFixed(3)} s`);
  const i = slot(list, t, marks);
  list.splice(i, 0, { t: refAt(t, marks), ...mark });
  return { raw: out, key: { kind: "item", index: i } };
}

/**
 * Xoá mốc. Mốc tay: bỏ tay này khỏi dòng mốc, dòng không còn tay nào thì bỏ cả dòng. Người phải còn ít nhất một dòng
 * (`world.hands` không rỗng); hết mốc món thì `items: []`
 */
export function deleteKey(raw: Json, k: KeyRef): Json {
  const out = structuredClone(raw);
  if (k.kind === "item") {
    (itemsOf(out) ?? fail("không có mốc ấy")).splice(k.index, 1);
    return out;
  }
  const list = handsOf(out, k.id) ?? fail("không có mốc ấy");
  const row = list[k.index] ?? fail("không có mốc ấy");
  delete row[k.side];
  if (row.right === undefined && row.left === undefined) {
    if (list.length === 1)
      fail("không xoá được mốc tay cuối cùng của người: `world.hands` phải có ít nhất một mốc");
    list.splice(k.index, 1);
  }
  return out;
}

/**
 * Sửa giá trị của mốc tại chỗ bằng `fn` (mốc tay `null` thì `fn` nhận `null`, trả object mới để thay); mọi trường khác giữ
 * nguyên
 */
export function editKey(raw: Json, k: KeyRef, fn: (m: Json | null) => Json | null | void): Json {
  const out = structuredClone(raw);
  if (k.kind === "item") {
    const m = itemsOf(out)?.[k.index] ?? fail("không có mốc ấy");
    fn(m);
    return out;
  }
  const row = handsOf(out, k.id)?.[k.index] ?? fail("không có mốc ấy");
  const v = row[k.side];
  if (v === undefined) fail("tay này không có mốc ở dòng ấy");
  const r = fn(isObj(v) ? v : null);
  if (r !== undefined) row[k.side] = r;
  return out;
}

/** `ease` của mốc: bỏ trống là xoá (`smooth` mặc định); `bezier` chỉ giữ khi `ease: "bezier"` */
export function setEase(m: Json, ease: Ease | undefined, bezier?: readonly number[]) {
  if (ease) m.ease = ease;
  else delete m.ease;
  if (ease === "bezier")
    m.bezier = [...(bezier ?? (m.bezier as number[] | undefined) ?? BEZIER_DEFAULT)];
  else delete m.bezier;
}

/** Tay ở giây đang xem như người 3D vẽ — đầu vào của `handValueAt` (`drawnHand` của `drawn.ts`) */
export interface DrawnHand {
  mode: "free" | "hand" | "keyed" | "both";
  /** Tay phụ của `both` */
  support: boolean;
  /** Phần đích (`Reach.w`) */
  w: number;
  /** Tâm nắm và cổ tay, thế giới rig */
  grip: V3;
  wrist: V3;
  /** Hướng khuỷu đang vẽ (thế giới rig, vuông góc trục vai → cổ tay) */
  elbow?: V3;
  /** Khuỷu khoá hẳn ở giây ấy (`elbowLockAt` = 1) */
  locked: boolean;
  /** Lựa chọn cầm đang vẽ (`GraspReport.choice`): trường số của chỗ cầm trượt */
  choice?: Record<string, unknown>;
}

/** Mốc của tay `side` quanh `t`: trước (≤ `t`) và sau */
function around(raw: Json, id: string, side: HandSide, t: number) {
  const marks = marksOf(raw);
  const ks = (handsOf(raw, id) ?? [])
    .filter((k) => k[side] !== undefined)
    .map((k) => ({ t: timeOf(k.t, marks), v: k[side] }));
  const prev = ks.filter((k) => k.t <= t + 1e-9).at(-1);
  const next = ks.find((k) => k.t > t + 1e-9);
  // `hold` có hiệu lực ở `t`: bậc thang theo mốc nhắc `hold`
  let hold: unknown;
  for (const k of ks) if (k.t <= t + 1e-9 && isObj(k.v) && k.v.hold !== undefined) hold = k.v.hold;
  return { prev, next, hold };
}

const INTENT = ["face", "up", "roll", "keep"] as const;

/** `hold` của mốc tay đầu tiên sau `t` có khai `hold` (không phải buông) */
function holdAfter(raw: Json, id: string, side: HandSide, t: number): unknown {
  const marks = marksOf(raw);
  for (const k of handsOf(raw, id) ?? []) {
    const v = k[side];
    if (timeOf(k.t, marks) > t + 1e-9 && isObj(v) && v.hold !== undefined)
      return v.hold ?? undefined;
  }
  return undefined;
}

const unit = (v: readonly number[]): V3 => {
  const n = Math.hypot(...v) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};

/**
 * Giá trị mốc tay mới ở `t` để hình không nhảy (nút ＋), `ease: "auto"`; `notes` nêu chỗ chỉ gần đúng:
 * - tay theo đồ (`keyed`, `both`): chỉ `hold` — chép `hold` có hiệu lực, trường số của chỗ cầm trượt lấy lựa chọn đang
 *   vẽ — nên không cắt lần cầm, không thêm đích (mốc tay của lần cầm có mốc món không khai đích);
 * - đồ theo tay, tay tự do: phần đích `0` thì `null`; không thì đích `at` là điểm bàn tay đang vẽ theo `point` của mốc kề
 *   (`grip`, cổ tay; điểm khác thì tâm nắm, `point: "grip"`), không `hold` (lần cầm đi tiếp); tay tự do chép lòng tay
 *   (`palm`, `fingers`, `bend`) của mốc trước; `elbow` theo mốc kề, khuỷu khoá hẳn thì khoá vào hướng đang vẽ. Điểm bàn
 *   tay về đúng chỗ; hướng bàn tay đồ theo tay theo ý định của mốc mới (ý định của `hold` trước nó) và giới hạn tốc độ
 *   `HOLD_SLEW`, nên giữa hai mốc khác ý định thì bàn tay xoay khác.
 */
export function handValueAt(
  raw: Json,
  id: string,
  side: HandSide,
  t: number,
  d: DrawnHand,
): { value: Json | null; notes: string[] } {
  const notes: string[] = [];
  if (d.support) fail("tay phụ của `both` theo tay dẫn: thêm mốc ở tay dẫn");
  const { prev, next, hold } = around(raw, id, side, t);
  if (d.mode === "keyed" || d.mode === "both") {
    if (!hold) fail("tay theo đồ mà không thấy `hold` có hiệu lực");
    let h = structuredClone(hold);
    if (isObj(h)) {
      for (const f of SLIDE) {
        const v = d.choice?.[f];
        if (h[f] !== undefined && typeof v === "number") h[f] = r4(v);
      }
    } else h = hold;
    return { value: { hold: h as Json, ease: "auto" }, notes };
  }
  if (d.mode === "hand") {
    // ý định của món ở mốc lấy theo `hold` có hiệu lực ở mốc: giữa hai mốc khác ý định thì bàn tay đang hoà hai ý định
    const intent = (h: unknown) =>
      JSON.stringify(isObj(h) ? INTENT.map((f) => h[f]) : INTENT.map(() => undefined));
    const later = holdAfter(raw, id, side, t);
    if (later !== undefined && intent(later) !== intent(hold))
      notes.push(
        "ý định món ở mốc mới theo `hold` trước: giữa hai ý định khác nhau, bàn tay xoay khác lúc trước",
      );
  }
  if (d.w < 1e-3) return { value: null, notes };
  if (d.w < 1 - 1e-3)
    notes.push(`tay đang hoà vào đích (phần đích ${d.w.toFixed(2)}): quanh mốc mới hình lệch`);
  const near = [prev?.v, next?.v].find(isObj);
  const p = near?.point;
  const wrist = p === "wrist" || (p === undefined && near?.at !== undefined);
  if (near?.to !== undefined)
    notes.push("mốc kề đặt theo mốc thân (`to`): mốc mới ghi `at` thế giới");
  if (typeof p === "string" && !["grip", "wrist"].includes(p))
    notes.push(`mốc kề đặt điểm \`${p}\`: mốc mới đặt tâm nắm (\`point: "grip"\`)`);
  const value: Json = {
    at: (wrist ? d.wrist : d.grip).map(r2),
    ...(p !== undefined && { point: wrist ? "wrist" : "grip" }),
    ...(p === undefined && !wrist && { point: "grip" }),
  };
  if (d.mode === "free" && isObj(prev?.v))
    for (const f of ["palm", "fingers", "bend"] as const)
      if (prev.v[f] !== undefined) value[f] = structuredClone(prev.v[f]);
  const ea = isObj(prev?.v) ? (prev.v.elbow as number[] | undefined) : undefined;
  const eb = isObj(next?.v) ? (next.v.elbow as number[] | undefined) : undefined;
  if (d.locked && d.elbow) {
    value.elbow = d.elbow.map(r4);
    value.elbowLock = true;
  } else if (ea && eb && prev && next) {
    const u = (t - prev.t) / (next.t - prev.t || 1);
    value.elbow = unit(ea.map((x, i) => x + (eb[i] - x) * u)).map(r4);
    if (JSON.stringify(ea) !== JSON.stringify(eb))
      notes.push("`elbow` lấy nội suy thẳng giữa hai mốc kề");
  } else if (ea ?? eb) value.elbow = [...(ea ?? eb)!];
  value.ease = "auto";
  return { value, notes };
}

/** Mốc món mới (chưa có `t`): tâm hộp bao ở `at`, hướng bằng hai trục khung món về vectơ hệ thân, `ease: "auto"` */
export function itemValueAt(
  cast: string,
  item: string,
  at: readonly number[],
  face: readonly number[],
  roll: readonly number[],
): Json {
  return {
    cast,
    item,
    at: at.map(r2),
    face: { axis: [0, 0, 1], toward: face.map(r4) },
    roll: { axis: [0, 1, 0], toward: roll.map(r4) },
    ease: "auto",
  };
}

/** Chỗ cầm chọn trong thẻ mốc: món, nhóm, biến thể (gốc hay kiểu có tên) */
export interface HoldPick {
  item: string;
  group: string;
  variant?: string;
}

/** Món, nhóm, biến thể của `hold` (chuỗi `món@nhóm/biến thể` hay object); không phải chỗ cầm nhóm thì `undefined` */
export function holdPickOf(hold: unknown): HoldPick | undefined {
  if (typeof hold === "string") {
    const m = /^([^@#/]+)@([a-zA-Z]+)(?:\/([a-z0-9-]+))?$/.exec(hold);
    return m ? { item: m[1], group: m[2], ...(m[3] && { variant: m[3] }) } : undefined;
  }
  if (isObj(hold) && typeof hold.item === "string" && typeof hold.group === "string")
    return {
      item: hold.item,
      group: hold.group,
      ...(typeof hold.variant === "string" && { variant: hold.variant }),
    };
  return undefined;
}

/**
 * Đổi `hold` của mốc tay: `undefined` bỏ khai, `null` buông. Chỗ cầm dạng object giữ mọi trường khác, chỉ đổi `item`,
 * `group`, `variant`; dạng chuỗi (hay chưa có) ghi chuỗi `món@nhóm/biến thể`
 */
export function setHold(m: Json, h: HoldPick | null | undefined) {
  if (h === undefined) delete m.hold;
  else if (h === null) m.hold = null;
  else if (isObj(m.hold)) {
    Object.assign(m.hold, { item: h.item, group: h.group });
    if (h.variant) m.hold.variant = h.variant;
    else delete m.hold.variant;
  } else m.hold = `${h.item}@${h.group}${h.variant ? `/${h.variant}` : ""}`;
}

/** Mốc studio sửa mà chưa khai `ease` thì ghi `auto` (mốc khai `ease` giữ nguyên) */
export function touch(m: Json | null) {
  if (m && m.ease === undefined) m.ease = "auto";
}

/** Ký hiệu mốc tay trên thanh tua: `null` chấm xám, chỉ có `hold` vòng rỗng, còn lại tròn */
export function handShape(v: unknown): "null" | "ring" | "dot" {
  if (!isObj(v)) return "null";
  const placed = ["at", "to", "palm", "fingers"].some((f) => v[f] !== undefined);
  return v.hold !== undefined && !placed ? "ring" : "dot";
}
