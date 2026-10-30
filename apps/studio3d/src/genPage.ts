// Trang soi bộ sinh (`?gen=<kiểu>`): đọc, ghi tham số của form trên URL, luật `when`, ô của form — hàm thuần trên bản mô tả
// `GEN_PAGES` của `@stickman3d/cli/gen-pages`. docs/13-vai-tro-do.md mục 9, README.md#bộ-sinh
import type { GenPage, GenParam } from "@stickman3d/cli/gen-pages";

/** Giá trị tham số trong trang: số, `"auto"`, bật / tắt, chữ (`enum`), điểm `x,y,z` */
export type GenValue = number | string | boolean;
export type GenValues = Record<string, GenValue>;

export interface GenView {
  kind: string;
  /** Chỉ tham số khác mặc định */
  values: GenValues;
}

/** Có `gen=`: trang mở chế độ Bộ sinh */
export const isGen = (p: URLSearchParams) => p.has("gen");

/** Giá trị của một chữ trên URL theo kiểu tham số; sai kiểu hay ngoài tầm thì `undefined` (về mặc định) */
export function coerce(x: GenParam, raw: string | null): GenValue | undefined {
  if (raw === null || raw === "") return undefined;
  if (raw === "auto") return x.default === "auto" ? "auto" : undefined;
  if (x.type === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    if ((x.min !== undefined && n < x.min) || (x.max !== undefined && n > x.max)) return undefined;
    return n;
  }
  if (x.type === "enum") return x.values?.includes(raw) ? raw : undefined;
  if (x.type === "bool")
    return raw === "1" || raw === "true"
      ? true
      : raw === "0" || raw === "false"
        ? false
        : undefined;
  const a = raw.split(",");
  return a.length === 3 && a.every((v) => v.trim() !== "" && Number.isFinite(Number(v)))
    ? a.map((v) => String(Number(v))).join(",")
    : undefined;
}

/** Chữ của giá trị trên URL */
const encode = (v: GenValue) => (typeof v === "boolean" ? (v ? "1" : "0") : String(v));

/** Hai giá trị cùng nghĩa (bật / tắt so được với `"1"` / `"0"`) */
const same = (a: GenValue | undefined, b: GenValue | undefined) =>
  a !== undefined && b !== undefined && encode(a) === encode(b);

/** Đọc bộ sinh và tham số từ URL; bộ sinh lạ thì bộ đầu tiên, tham số sai hay bằng mặc định thì bỏ */
export function readGen(p: URLSearchParams, pages: Record<string, GenPage>): GenView {
  const want = p.get("gen") ?? "";
  const kind = Object.hasOwn(pages, want) ? want : Object.keys(pages)[0];
  const values: GenValues = {};
  for (const x of pages[kind].params) {
    const v = coerce(x, p.get(x.key));
    if (v !== undefined && !same(v, x.default)) values[x.key] = v;
  }
  return { kind, values };
}

/** Mọi khoá tham số của mọi trang: ghi URL thì xoá hết trước, đổi trang không sót khoá trang kia */
export const genKeys = (pages: Record<string, GenPage>) => [
  "gen",
  ...new Set(Object.values(pages).flatMap((g) => g.params.map((x) => x.key))),
];

/** Ghi bộ sinh và tham số khác mặc định vào `p` (giữ tham số khác của trang) */
export function writeGen(
  p: URLSearchParams,
  v: GenView,
  pages: Record<string, GenPage>,
): URLSearchParams {
  for (const k of genKeys(pages)) p.delete(k);
  p.set("gen", v.kind);
  for (const x of pages[v.kind].params) {
    const val = v.values[x.key];
    if (val !== undefined && !same(val, x.default)) p.set(x.key, encode(val));
  }
  return p;
}

/** Giá trị đang dùng của tham số `key`: giá trị đặt, không thì mặc định */
export function valueOf(params: readonly GenParam[], values: GenValues, key: string): GenValue {
  const v = values[key];
  return v !== undefined ? v : params.find((x) => x.key === key)!.default;
}

/** Tham số hiện trong form: mọi điều kiện `when` đúng với giá trị đang dùng của tham số kia (danh sách: một trong số ấy) */
export function shown(params: readonly GenParam[], values: GenValues, x: GenParam): boolean {
  return Object.entries(x.when ?? {}).every(([k, want]) =>
    [want].flat().some((w) => same(valueOf(params, values, k), w)),
  );
}

/** Đặt `key` = `v` (bằng mặc định thì bỏ khoá); trả bản mới */
export function setValue(
  params: readonly GenParam[],
  values: GenValues,
  key: string,
  v: GenValue | undefined,
): GenValues {
  const x = params.find((p) => p.key === key);
  const out = { ...values };
  if (!x || v === undefined || same(v, x.default)) delete out[key];
  else out[key] = v;
  return out;
}

/** Ô của form theo thứ tự `params`, chỉ ô đang hiện (`when`) */
export interface GenField {
  param: GenParam;
  value: GenValue;
  /** Đang là `"auto"` */
  auto: boolean;
  /** Khác mặc định */
  changed: boolean;
}

export function fieldsOf(params: readonly GenParam[], values: GenValues): GenField[] {
  return params
    .filter((x) => shown(params, values, x))
    .map((x) => {
      const value = valueOf(params, values, x.key);
      return { param: x, value, auto: value === "auto", changed: values[x.key] !== undefined };
    });
}

/** Tham số gửi `/api/gen` và đưa `stage`: giá trị đặt kèm góc máy */
export function genParams(values: GenValues, angle: string): Record<string, unknown> {
  return { ...values, angle };
}

/** Chữ của một giá trị enum: tên tiếng Việt kèm id */
export const enumText = (x: GenParam, v: string) => (x.names?.[v] ? `${x.names[v]} (${v})` : v);
