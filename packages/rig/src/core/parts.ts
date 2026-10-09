import { PIECE_KEYS, type PieceCatalog, type PieceConfig, type PieceKey } from "./schema";

/** Chỗ cắm được bộ phận: socket nhân vật, hoặc thân đạo cụ (`prop`) */
export type PartSocket = PieceKey | "prop";

/** Hộp mà bộ phận vẽ vào — đúng hộp mảnh ảnh sẽ chiếm, gốc ở góc trên trái */
export interface PartBox {
  w: number;
  h: number;
  color: string;
  accent: string;
  line: string;
  stroke: number;
  /** Góc quay của khối thân, độ (`torsoYaw`): chỉ mảnh treo trên thân nhận */
  yaw?: number;
}

export interface PartDef<N = unknown> {
  label: string;
  sockets: readonly PartSocket[];
  /** Tỉ lệ khung của hộp; thay cho `aspect` đo từ ảnh */
  aspect: number;
  /** Số căn gợi ý lúc chọn; studio ghi vào JSON rồi người dùng chỉnh tiếp */
  preset?: {
    dx?: number;
    scale?: number;
    dy?: number;
    widthScale?: number;
    rotate?: number;
    clip?: boolean;
    clipGrow?: number;
    hideLegs?: boolean;
    layer?: "front" | "under";
  };
  draw: (b: PartBox) => N;
  /** Hình ở góc `side` vẽ trong chính hộp chính diện, mặt nhìn về `+x` */
  drawSide?: (b: PartBox) => N;
  /** Chỉ hình bao ngoài, bỏ chi tiết: thân áo và mái tóc nhìn từ sau khi không có hình `back` riêng */
  outline?: (b: PartBox) => N;
  /** Thân đạo cụ: lớp vẽ **sau** người ngồi (ruột xe, vách xa); `draw` là vách gần, có lỗ cho người lộ ra */
  drawBehind?: (b: PartBox) => N;
  /** Thân đạo cụ: hông người ngồi, tỉ lệ hộp (`0..1`), `propSeat` đổi ra hệ đạo cụ */
  seat?: { x: number; y: number };
}

/** Bộ phận theo tên: hình vẽ có sẵn do `@stickman3d/sketch` đăng ký lúc nạp, cộng bộ phận của repo video */
export const PARTS: Record<string, PartDef> = {};

const BUILTIN = new Set<string>();
let repoParts: string[] = [];

/**
 * Đặt bộ phận vẽ code của repo video (`CODE_PARTS` ở entry `stickman.parts`), thay cả bộ đăng
 * ký lần trước. Trùng tên bộ phận của rig thì báo lỗi: hình `side` / `back` trong `views.ts`
 * tra theo tên, đè lên là góc nghiêng vẽ hình của bộ phận khác — docs/02-trang-phuc.md
 */
export function registerParts(parts: Record<string, PartDef> | undefined) {
  const entries = Object.entries(parts ?? {});
  for (const [name, def] of entries) {
    if (BUILTIN.has(name))
      throw new Error(`bộ phận "${name}" đã có trong rig — đổi tên, hay xoá khỏi CODE_PARTS`);
    const bad = partProblem(def);
    if (bad) throw new Error(`bộ phận "${name}": ${bad}`);
  }
  for (const n of repoParts) delete PARTS[n];
  Object.assign(PARTS, Object.fromEntries(entries));
  repoParts = entries.map(([n]) => n);
  return repoParts;
}

function partProblem(def: PartDef) {
  if (!def || typeof def !== "object") return "không phải object";
  if (typeof def.label !== "string") return "thiếu `label`";
  if (!Array.isArray(def.sockets) || !def.sockets.length) return "thiếu `sockets`";
  const odd = def.sockets.find((s) => s !== "prop" && !PIECE_KEYS.includes(s as PieceKey));
  if (odd) return `socket lạ "${odd}"`;
  if (!(def.aspect > 0)) return "`aspect` phải là số dương";
  if (typeof def.draw !== "function") return "thiếu `draw`";
  return null;
}

/** Bộ phận có sẵn của rig: `@stickman3d/sketch` gọi một lần lúc nạp, `registerParts` không đè được chúng */
export function definePartsBuiltin(parts: Record<string, PartDef>) {
  Object.assign(PARTS, parts);
  for (const n of Object.keys(parts)) BUILTIN.add(n);
}

/** Tên các bộ phận cắm được vào socket `k`. */
export const partsFor = (k: PartSocket) =>
  Object.keys(PARTS).filter((n) => PARTS[n].sockets.includes(k));

/** Cấu hình lúc cắm bộ phận `name`: mục `parts` của danh mục đè lên `preset` của nó. */
export const partConfig = (name: string, catalog?: PieceCatalog): PieceConfig => ({
  ...PARTS[name]?.preset,
  ...catalog?.parts[name],
});
