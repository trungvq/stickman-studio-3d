// Danh sách của chế độ Thư viện: nhóm hành động theo gốc tên (docs/01-rig.md § Tên và hậu tố), thứ tự người mẫu, trạng
// thái trong URL. Không DOM.
import { PREVIEW_ANGLES, type ActionData, type PreviewAngle } from "@stickman3d/rig/core";

/** Hậu tố mức, phía, pha: bỏ đi là ra gốc; số độ cũng là mức */
const CLOSED = new Set(["soft", "big", "near", "far", "left", "right", "hold", "out"]);
const closed = (w: string) => /^\d+$/.test(w) || CLOSED.has(w);

function stemWords(name: string): string[] {
  const w = name.split("-").filter((x) => x !== "3d");
  while (w.length > 1 && closed(w[w.length - 1])) w.pop();
  return w;
}

/** Tên bỏ đuôi `3d` và hậu tố mức, phía, pha ở cuối: `turn-head-70-near-3d` → `turn-head` */
export const actionStem = (name: string) => stemWords(name).join("-");

/**
 * Gốc của `name`: thân tên (`actionStem`), bỏ tiếp từng từ biến (`robe`, `quick`…) chừng nào phần còn lại là thân tên
 * của hành động khác trong `stems` — `bow-quick-3d` về `bow` khi có `bow-3d`, `pour-serve-kneel-3d` về `pour` qua
 * `pour-serve-3d`, `look-up-3d` giữ gốc `look-up`
 */
export function actionRoot(name: string, stems: ReadonlySet<string>): string {
  let w = stemWords(name);
  while (w.length > 1) {
    const up = actionStem(w.slice(0, -1).join("-"));
    if (!stems.has(up)) break;
    w = up.split("-");
  }
  return w.join("-");
}

export interface ActionGroup {
  root: string;
  names: string[];
}

const cmp = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

/** Nhóm theo gốc, nhóm xếp theo tên gốc; trong nhóm bản đúng gốc (chỉ khác mức, phía, pha) đứng trước */
export function groupActions(names: readonly string[]): ActionGroup[] {
  const stems = new Set(names.map(actionStem));
  const by = new Map<string, string[]>();
  for (const n of names) {
    const r = actionRoot(n, stems);
    by.set(r, [...(by.get(r) ?? []), n]);
  }
  return [...by]
    .map(([root, ns]) => ({
      root,
      names: ns.sort((a, b) => +(actionStem(a) !== root) - +(actionStem(b) !== root) || cmp(a, b)),
    }))
    .sort((a, b) => cmp(a.root, b.root));
}

/** Nhóm chỉ còn tên có mọi từ của `q` (không phân biệt hoa thường), nhóm rỗng thì bỏ */
export function filterGroups(groups: readonly ActionGroup[], q: string): ActionGroup[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...groups];
  return groups
    .map((g) => ({
      root: g.root,
      names: g.names.filter((n) => words.every((w) => n.toLowerCase().includes(w))),
    }))
    .filter((g) => g.names.length);
}

/** Tên cách `name` `by` bước trong danh sách phẳng của `groups`, vòng hai đầu; `name` không có thì tên đầu */
export function stepIn(names: readonly string[], name: string, by: number): string | undefined {
  if (!names.length) return undefined;
  const i = names.indexOf(name);
  if (i < 0) return names[0];
  return names[(((i + by) % names.length) + names.length) % names.length];
}

export const flatNames = (groups: readonly ActionGroup[]) => groups.flatMap((g) => g.names);

/** Biến thể cùng gốc với `name` (kể cả nó) */
export const siblingsOf = (groups: readonly ActionGroup[], name: string) =>
  groups.find((g) => g.names.includes(name))?.names ?? [name];

/**
 * Hành động chỉ nhép miệng (`pnpm lipsync` của repo video): có mốc, chỉ ghi kênh `face`, mọi mốc không có góc, đích, bàn
 * tay, đồ, và nét mặt chỉ đổi `mouth`
 */
export function isMouthOnly(a: ActionData): boolean {
  if (!a.keys?.length) return false;
  if (a.mask && (a.mask.length !== 1 || a.mask[0] !== "face")) return false;
  let mouth = false;
  for (const k of a.keys) {
    if (typeof k.pose !== "object" || Object.values(k.pose).some((v) => v !== undefined))
      return false;
    if (k.reach || k.hand || k.equip) return false;
    for (const [f, v] of Object.entries(k.face ?? {})) {
      if (v === undefined) continue;
      if (f !== "mouth") return false;
      mouth = true;
    }
  }
  return mouth;
}

/** Nhóm bỏ các tên trong `hide` (trừ `keep`), nhóm rỗng thì bỏ */
export function hideNames(
  groups: readonly ActionGroup[],
  hide: ReadonlySet<string>,
  keep?: string,
): ActionGroup[] {
  if (!hide.size) return [...groups];
  return groups
    .map((g) => ({ root: g.root, names: g.names.filter((n) => n === keep || !hide.has(n)) }))
    .filter((g) => g.names.length);
}

/** Một dòng của danh sách: dòng gốc của nhóm nhiều bản (`gốc · n`, bấm để mở / gập) hay một hành động */
export type LibraryRow =
  | { kind: "root"; root: string; names: string[]; open: boolean }
  | { kind: "action"; name: string; inGroup: boolean };

/**
 * Nhóm nhiều bản mở hay gập: `fold` là lựa chọn bấm tay trong phiên; không bấm thì mở khi đang tìm hay nhóm chứa `cur`
 */
export const groupOpen = (
  g: ActionGroup,
  o: { fold: ReadonlyMap<string, boolean>; cur: string; searching: boolean },
) => o.fold.get(g.root) ?? (o.searching || g.names.includes(o.cur));

/** Dòng đang hiện, đúng thứ tự: nhóm một bản là một dòng, nhóm nhiều bản là dòng gốc rồi các bản khi mở */
export function libraryRows(
  groups: readonly ActionGroup[],
  o: { fold: ReadonlyMap<string, boolean>; cur: string; searching: boolean },
): LibraryRow[] {
  return groups.flatMap((g): LibraryRow[] => {
    if (g.names.length === 1) return [{ kind: "action", name: g.names[0], inGroup: false }];
    const open = groupOpen(g, o);
    return [
      { kind: "root", root: g.root, names: g.names, open },
      ...(open ? g.names.map((name) => ({ kind: "action" as const, name, inGroup: true })) : []),
    ];
  });
}

/**
 * Tên mà ↑ ↓ đi qua: mỗi dòng hành động đang hiện; nhóm gập là một bước, đứng cho `cur` khi nó ở trong nhóm, không thì
 * cho bản đầu
 */
export const stepNames = (rows: readonly LibraryRow[], cur: string) =>
  rows.flatMap((r) =>
    r.kind === "action" ? [r.name] : r.open ? [] : [r.names.includes(cur) ? cur : r.names[0]],
  );

/** Bốn người mẫu của lớp chung, đứng đầu danh sách người */
export const SAMPLES = [
  "sample-man.json",
  "sample-woman.json",
  "sample-heavy.json",
  "sample-kimono.json",
] as const;

export interface LibraryEntry {
  name: string;
  layer: "common" | "repo";
}

/** Người mẫu theo thứ tự `SAMPLES`, rồi nhân vật của repo, rồi phần còn lại của lớp chung */
export function orderCharacters<T extends LibraryEntry>(list: readonly T[]): T[] {
  const rank = (c: T) => {
    const s = (SAMPLES as readonly string[]).indexOf(c.name);
    return s >= 0 ? s : c.layer === "repo" ? SAMPLES.length : SAMPLES.length + 1;
  };
  return [...list].sort((a, b) => rank(a) - rank(b) || cmp(a.name, b.name));
}

export const SPEEDS = [0.25, 1] as const;

export interface LibraryView {
  action?: string;
  /** Tên file nhân vật bỏ đuôi `.json` */
  who?: string;
  angle: PreviewAngle;
  speed: number;
  loop: boolean;
  /** Hiện hành động chỉ nhép miệng (`isMouthOnly`) trong danh sách */
  mouth: boolean;
}

const LIB_KEYS = ["library", "action", "who", "angle", "speed", "loop", "mouth"];

/** Có `library=1`: trang mở chế độ Thư viện */
export const isLibrary = (p: URLSearchParams) => p.get("library") === "1";

/** Đọc trạng thái Thư viện; khoá sai thì lấy mặc định (`near`, 1×, lặp, ẩn khẩu hình) */
export function readLibrary(p: URLSearchParams): LibraryView {
  const angle = p.get("angle") as PreviewAngle;
  const speed = Number(p.get("speed"));
  const action = p.get("action");
  const who = p.get("who");
  return {
    ...(action && { action }),
    ...(who && { who }),
    angle: PREVIEW_ANGLES.includes(angle) ? angle : "near",
    speed: (SPEEDS as readonly number[]).includes(speed) ? speed : 1,
    loop: p.get("loop") !== "0",
    mouth: p.get("mouth") === "1",
  };
}

/** Ghi trạng thái Thư viện vào `p` (giữ tham số khác); giá trị mặc định thì bỏ khoá */
export function writeLibrary(p: URLSearchParams, v: LibraryView): URLSearchParams {
  for (const k of LIB_KEYS) p.delete(k);
  p.set("library", "1");
  if (v.action) p.set("action", v.action);
  if (v.who) p.set("who", v.who);
  p.set("angle", v.angle);
  if (v.speed !== 1) p.set("speed", String(v.speed));
  if (!v.loop) p.set("loop", "0");
  if (v.mouth) p.set("mouth", "1");
  return p;
}
