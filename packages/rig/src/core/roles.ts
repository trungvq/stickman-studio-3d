import { z } from "zod";
import { cross3, place3, scale3, sub3, type M3, type Place3, type V3 } from "./lens";

/**
 * Vai trò của đồ: món làm được gì trong một động tác (vật rót, vật đựng, mặt ngồi, tay vịn, lưng ghế, để chân, mặt bàn)
 * kèm số đo bắt buộc, viết trong khung của vật mang nó. Bảng `ROLES` là nguồn của trường, nghĩa (`describe`), vật mang và
 * luật zod. docs/13-vai-tro-do.md
 */

/** Vật mang vai trò: món cầm tay (`held/<món>.json`), đồ của cảnh (`Item.roles`, `withRoles`) */
export const ROLE_CARRIERS = ["held", "scene"] as const;
export type RoleCarrier = (typeof ROLE_CARRIERS)[number];

/** Kiểu hình học của một trường (docs/13 mục 2) */
export type RoleFieldKind = "Point" | "Dir" | "Rect" | "Segment" | "Poly" | "number" | "object";

export interface RoleField {
  kind: RoleFieldKind;
  required: boolean;
  /** Nghĩa của trường: dòng báo của zod, form của trang soi và MCP đọc chung */
  describe: string;
}

export interface RoleDef {
  /** Nghĩa của vai trò */
  describe: string;
  carriers: readonly RoleCarrier[];
  /** Trường theo đường dẫn (`mouth.r`); `at`, `size`, `front` của `Rect`, `from`, `to`, `width` của `Segment` tách riêng */
  fields: Record<string, RoleField>;
  /** Phần rig suy từ hình (món cầm tay) */
  infer?: string;
}

const f = (kind: RoleFieldKind, required: boolean, describe: string): RoleField => ({
  kind,
  required,
  describe,
});

/** Bảy vai trò của bản đầu (docs/13 mục 3) */
export const ROLES = {
  pourer: {
    describe: "vật rót",
    carriers: ["held"],
    fields: {
      lip: f("Point", true, "điểm rót: mốc hay điểm khung món"),
      spout: f("Dir", false, "hướng rót; bỏ trống là hướng từ trục món tới `lip`"),
    },
    infer: "`spout` từ `lip` lệch trục",
  },
  vessel: {
    describe: "vật đựng",
    carriers: ["held", "scene"],
    fields: {
      mouth: f("object", true, "miệng: `at`, `r`, `dir`"),
      "mouth.at": f("Point", true, "tâm miệng"),
      "mouth.r": f("number", true, "bán kính trong của miệng"),
      "mouth.dir": f("Dir", false, "hướng ra của miệng; bỏ trống là `top` của món (món khối: lên)"),
    },
    infer: "cả mục, từ `lathe` có `wall`",
  },
  seat: {
    describe: "mặt ngồi",
    carriers: ["scene"],
    fields: {
      at: f("Rect", true, "tâm mặt trên chỗ ngồi"),
      size: f("Rect", true, "`[sâu, rộng]` của mặt ngồi"),
      front: f("Rect", false, "hướng người ngồi nhìn, nằm ngang; bỏ trống là +x của vật"),
    },
  },
  armrest: {
    describe: "tay vịn",
    carriers: ["scene"],
    fields: {
      from: f("Segment", true, "đầu sau đường giữa mặt trên tay vịn"),
      to: f("Segment", true, "đầu trước đường giữa mặt trên tay vịn"),
      width: f("Segment", true, "bề rộng mặt trên tay vịn"),
    },
  },
  backrest: {
    describe: "lưng ghế",
    carriers: ["scene"],
    fields: {
      from: f("Segment", true, "giữa mép dưới mặt trước lưng ghế"),
      to: f("Segment", true, "giữa mép trên mặt trước lưng ghế"),
      width: f("Segment", true, "bề rộng lưng ghế"),
      front: f(
        "Dir",
        false,
        "phía người tựa, nằm ngang; bỏ trống là `front` của mặt ngồi cùng vật, không có thì +x của vật",
      ),
    },
  },
  footrest: {
    describe: "để chân",
    carriers: ["scene"],
    fields: {
      at: f("Rect", true, "tâm mặt đỡ bàn chân"),
      size: f("Rect", true, "`[sâu, rộng]` của mặt đỡ bàn chân"),
      front: f("Rect", false, "hướng người ngồi nhìn, nằm ngang; bỏ trống là +x của vật"),
    },
  },
  tabletop: {
    describe: "mặt bàn",
    carriers: ["scene"],
    fields: {
      y: f("Poly", true, "độ cao mặt trên bàn"),
      poly: f("Poly", true, "đỉnh `[x, z]` của mặt trên: đa giác lồi, xếp vòng"),
      thick: f("number", true, "bề dày tấm mặt bàn"),
    },
  },
} as const satisfies Record<string, RoleDef>;

export type RoleId = keyof typeof ROLES;
export const ROLE_IDS = Object.keys(ROLES) as RoleId[];

/** Nghĩa của trường `path` của vai trò `role` */
export const roleField = (role: RoleId, path: string): RoleField | undefined =>
  (ROLES[role].fields as Record<string, RoleField>)[path];

const v3 = z.tuple([z.number(), z.number(), z.number()]);
const NAME = /^[a-z0-9-]+$/;

/** Lời báo của trường thiếu hay sai kiểu */
function fieldError(role: RoleId, path: string, shape: string) {
  const what = `\`${path}\` (${roleField(role, path)?.describe ?? path})`;
  return {
    error: (iss: { code?: string; input?: unknown; keys?: string[] }) =>
      iss.code === "unrecognized_keys"
        ? `\`${role}\`: trường lạ ${iss.keys!.map((k) => `\`${path}.${k}\``).join(", ")}`
        : iss.input === undefined
          ? `vai trò \`${role}\` cần ${what}`
          : `\`${role}\`: ${what} cần ${shape}`,
  };
}

const POINT = "điểm `[x, y, z]`";
const HELD_POINT = "điểm `[x, y, z]`, tên mốc hay `{ anchor, offset }`";
const HELD_DIR = "vectơ `[x, y, z]` hay tên mốc có `dir`";

/** Nghĩa của trường cho `describe` của zod (JSON schema của MCP, form của trang soi) */
const meaning = (role: RoleId, path: string) => roleField(role, path)?.describe ?? path;

/** `Point` của vật mang được cả món cầm tay: điểm khung, tên mốc, mốc cộng `offset` */
const heldPoint = (role: RoleId, path: string) =>
  z
    .union(
      [v3, z.string().min(1), z.strictObject({ anchor: z.string().min(1), offset: v3.optional() })],
      fieldError(role, path, HELD_POINT),
    )
    .describe(meaning(role, path));
const heldDir = (role: RoleId, path: string) =>
  z.union([v3, z.string().min(1)], fieldError(role, path, HELD_DIR)).describe(meaning(role, path));
const point = (role: RoleId, path: string) =>
  z
    .tuple([z.number(), z.number(), z.number()], fieldError(role, path, POINT))
    .describe(meaning(role, path));
const len = (role: RoleId, path: string) =>
  z
    .number(fieldError(role, path, "số > 0"))
    .positive(fieldError(role, path, "số > 0"))
    .describe(meaning(role, path));
const name = z
  .string()
  .regex(NAME, { error: "`name` chỉ gồm a–z, 0–9, `-`" })
  .optional()
  .describe("tên mục: phân biệt hai mục cùng vai trò trên một vật, cờ CLI gọi `vật#tên`");

/** Thông báo trường lạ của một mục */
const entry = (role: RoleId) => ({
  error: (iss: { code?: string; keys?: string[] }) =>
    iss.code === "unrecognized_keys"
      ? `\`${role}\`: trường lạ ${iss.keys!.map((k) => `\`${k}\``).join(", ")} (có: ${["name", ...Object.keys(ROLES[role].fields).filter((k) => !k.includes("."))].join(", ")})`
      : undefined,
});

const D2R = Math.PI / 180;
const norm = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => scale3(a, 1 / (norm(a) || 1));
const isV3 = (x: unknown): x is V3 => Array.isArray(x);
const fmt = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");

/** Tay vịn dốc tối đa so với mặt ngang, độ */
export const ARMREST_SLOPE = 10;

type Ctx = z.RefinementCtx;
const issue = (ctx: Ctx, path: (string | number)[], message: string) =>
  ctx.addIssue({ code: "custom", path, message });

/** `front` của `Rect`, `backrest`: vectơ ngang khác không */
function horizontal(ctx: Ctx, role: RoleId, d: V3 | undefined, path: string) {
  if (!d) return;
  if (norm(d) < 1e-9) issue(ctx, [path], `\`${role}\`: \`${path}\` là vectơ không`);
  else if (Math.abs(d[1]) > 1e-6 * norm(d))
    issue(ctx, [path], `\`${role}\`: \`${path}\` phải nằm ngang (y = 0)`);
}

function segment(ctx: Ctx, role: RoleId, from: V3, to: V3) {
  const d = sub3(to, from);
  if (norm(d) < 1e-6) {
    issue(ctx, [], `\`${role}\` có \`from\` trùng \`to\``);
    return;
  }
  if (role !== "armrest") return;
  const slope = Math.atan2(Math.abs(d[1]), Math.hypot(d[0], d[2])) / D2R;
  if (slope > ARMREST_SLOPE)
    issue(
      ctx,
      [],
      `\`armrest\` dốc ${fmt(slope)}° (quá ${ARMREST_SLOPE}°): bản đầu chỉ có tay vịn gần ngang`,
    );
}

/** Lỗi của đa giác mặt bàn: ít nhất ba đỉnh, không trùng đỉnh, lồi (mọi đỉnh cùng một phía của mọi cạnh, đỉnh thẳng hàng được) */
export function polyProblems(poly: readonly (readonly [number, number])[]): string[] {
  if (poly.length < 3) return [`\`poly\` cần ít nhất ba đỉnh, có ${poly.length}`];
  const n = poly.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (Math.hypot(poly[i][0] - poly[j][0], poly[i][1] - poly[j][1]) < 1e-6)
        return [`\`poly\` có đỉnh ${i} trùng đỉnh ${j}`];
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const [a, b] = [poly[i], poly[(i + 1) % n]];
    const e = [b[0] - a[0], b[1] - a[1]];
    for (const c of poly) {
      const d = [c[0] - a[0], c[1] - a[1]];
      const cr = e[0] * d[1] - e[1] * d[0];
      if (Math.abs(cr) <= 1e-9 * Math.hypot(e[0], e[1]) * Math.hypot(d[0], d[1])) continue;
      if (sign && Math.sign(cr) !== sign) return ["`poly` không lồi (hay đỉnh không xếp vòng)"];
      sign = Math.sign(cr);
    }
  }
  return sign ? [] : ["`poly` có mọi đỉnh thẳng hàng"];
}

const PourerSchema = z
  .strictObject(
    {
      role: z.literal("pourer"),
      name,
      lip: heldPoint("pourer", "lip"),
      spout: heldDir("pourer", "spout").optional(),
    },
    entry("pourer"),
  )
  .describe(ROLES.pourer.describe)
  .superRefine((r, ctx) => {
    if (isV3(r.spout) && norm(r.spout) < 1e-9)
      issue(ctx, ["spout"], "`pourer`: `spout` là vectơ không");
  });

const VesselSchema = z
  .strictObject(
    {
      role: z.literal("vessel"),
      name,
      mouth: z
        .strictObject(
          {
            at: heldPoint("vessel", "mouth.at"),
            r: len("vessel", "mouth.r"),
            dir: heldDir("vessel", "mouth.dir").optional(),
          },
          fieldError("vessel", "mouth", "object `{ at, r, dir? }`"),
        )
        .describe(meaning("vessel", "mouth")),
    },
    entry("vessel"),
  )
  .describe(ROLES.vessel.describe)
  .superRefine((r, ctx) => {
    if (isV3(r.mouth.dir) && norm(r.mouth.dir) < 1e-9)
      issue(ctx, ["mouth", "dir"], "`vessel`: `mouth.dir` là vectơ không");
  });

const rect = <R extends "seat" | "footrest">(role: R) =>
  z
    .strictObject(
      {
        role: z.literal(role),
        name,
        at: point(role, "at"),
        size: z
          .tuple(
            [len(role, "size"), len(role, "size")],
            fieldError(role, "size", "`[sâu, rộng]` số > 0"),
          )
          .describe(meaning(role, "size")),
        front: point(role, "front").optional(),
      },
      entry(role),
    )
    .describe(ROLES[role].describe)
    .superRefine((r, ctx) => horizontal(ctx, role, r.front as V3 | undefined, "front"));

const SeatSchema = rect("seat");
const FootrestSchema = rect("footrest");

const ArmrestSchema = z
  .strictObject(
    {
      role: z.literal("armrest"),
      name,
      from: point("armrest", "from"),
      to: point("armrest", "to"),
      width: len("armrest", "width"),
    },
    entry("armrest"),
  )
  .describe(ROLES.armrest.describe)
  .superRefine((r, ctx) => segment(ctx, "armrest", r.from as V3, r.to as V3));

const BackrestSchema = z
  .strictObject(
    {
      role: z.literal("backrest"),
      name,
      from: point("backrest", "from"),
      to: point("backrest", "to"),
      width: len("backrest", "width"),
      front: point("backrest", "front").optional(),
    },
    entry("backrest"),
  )
  .describe(ROLES.backrest.describe)
  .superRefine((r, ctx) => {
    segment(ctx, "backrest", r.from as V3, r.to as V3);
    horizontal(ctx, "backrest", r.front as V3 | undefined, "front");
  });

const TabletopSchema = z
  .strictObject(
    {
      role: z.literal("tabletop"),
      name,
      y: z.number(fieldError("tabletop", "y", "số")).describe(meaning("tabletop", "y")),
      poly: z
        .array(
          z.tuple([z.number(), z.number()], fieldError("tabletop", "poly", "đỉnh `[x, z]`")),
          fieldError("tabletop", "poly", "mảng đỉnh `[x, z]`"),
        )
        .describe(meaning("tabletop", "poly")),
      thick: len("tabletop", "thick"),
    },
    entry("tabletop"),
  )
  .describe(ROLES.tabletop.describe)
  .superRefine((r, ctx) => {
    for (const m of polyProblems(r.poly)) issue(ctx, ["poly"], `\`tabletop\`: ${m}`);
  });

/** Lời báo khi `role` không phải vai trò nào */
function unknownRole(input: unknown): string {
  const all = ROLE_IDS.join(", ");
  if (!input || typeof input !== "object" || Array.isArray(input))
    return `mục vai trò cần object \`{ role, … }\`; vai trò có: ${all}`;
  const r = (input as { role?: unknown }).role;
  return r === undefined
    ? `mục vai trò cần \`role\`; có: ${all}`
    : `vai trò lạ \`${String(r)}\`; có: ${all}`;
}

/** Một mục vai trò (`role` là khoá của `ROLES`); trường lạ là lỗi */
export const RoleSchema = z.discriminatedUnion(
  "role",
  [
    PourerSchema,
    VesselSchema,
    SeatSchema,
    ArmrestSchema,
    BackrestSchema,
    FootrestSchema,
    TabletopSchema,
  ],
  {
    error: (iss) =>
      iss.code === "invalid_union" || iss.code === "invalid_type"
        ? unknownRole(iss.input)
        : undefined,
  },
);
export type Role = z.infer<typeof RoleSchema>;
export type RoleInput = z.input<typeof RoleSchema>;
export type RoleOf<R extends RoleId> = Extract<Role, { role: R }>;

/** Mảng mục vai trò của một vật, chưa xét vật mang */
export const RolesSchema = z.array(RoleSchema);

/** `Point`: điểm khung; ở món cầm tay thêm tên mốc hay `{ anchor, offset }` */
export type Point = V3 | string | { anchor: string; offset?: V3 };
/** `Dir`: vectơ khung (chuẩn hoá khi đọc); ở món cầm tay thêm tên mốc có `dir` */
export type Dir = V3 | string;
/** Hình chữ nhật nằm ngang: tâm `at` trên mặt, `size` `[sâu, rộng]`, cạnh sâu dọc `front` */
export interface Rect {
  at: V3;
  size: [number, number];
  front?: V3;
}
/** Đoạn trên một mặt kèm bề rộng mặt ấy */
export interface Segment {
  from: V3;
  to: V3;
  width: number;
}
/** Đa giác lồi nằm ngang ở độ cao `y`, đỉnh `[x, z]` xếp vòng */
export interface Poly {
  y: number;
  poly: [number, number][];
}

const carriesOn = (role: RoleId, c: RoleCarrier) =>
  (ROLES[role].carriers as readonly RoleCarrier[]).includes(c);
const CARRIER_NAME: Record<RoleCarrier, string> = { held: "món cầm tay", scene: "đồ của cảnh" };

/** Luật của cả mảng trên một vật mang: vai trò mang được, mục trùng, `name` trùng; đường dẫn tính từ `base` */
export function carrierIssues(
  roles: readonly Role[],
  carrier: RoleCarrier,
  ctx: Ctx,
  base: (string | number)[],
) {
  const first = new Map<string, number>();
  const names = new Map<string, number>();
  roles.forEach((r, i) => {
    const at = [...base, i];
    if (!carriesOn(r.role, carrier)) {
      const other = ROLE_CARRIERS.find((c) => carriesOn(r.role, c))!;
      issue(ctx, at, `vai trò \`${r.role}\` chỉ khai ở ${CARRIER_NAME[other]}`);
      return;
    }
    if (r.name !== undefined) {
      const j = names.get(r.name);
      if (j !== undefined)
        issue(ctx, [...at, "name"], `\`name\` \`${r.name}\` trùng mục roles[${j}]`);
      else names.set(r.name, i);
    }
    const j = first.get(r.role);
    if (j === undefined) first.set(r.role, i);
    else if (carrier === "held")
      issue(ctx, at, `món cầm tay khai một mục \`${r.role}\`; roles[${j}] đã khai`);
    else if (r.name === undefined || roles[j].name === undefined)
      issue(
        ctx,
        roles[j].name === undefined ? [...base, j] : at,
        `vai trò \`${r.role}\` có nhiều mục trên một vật: mỗi mục cần \`name\` khác nhau`,
      );
    if (carrier === "scene" && r.role === "vessel") {
      if (!isV3(r.mouth.at))
        issue(
          ctx,
          [...at, "mouth", "at"],
          "`vessel`: đồ của cảnh không có mốc, `mouth.at` là điểm `[x, y, z]`",
        );
      if (r.mouth.dir !== undefined && !isV3(r.mouth.dir))
        issue(
          ctx,
          [...at, "mouth", "dir"],
          "`vessel`: đồ của cảnh không có mốc, `mouth.dir` là vectơ `[x, y, z]`",
        );
    }
  });
}

/** `RolesSchema` cộng luật của đồ của cảnh (`Item.roles`, `withRoles`) */
export const SceneRolesSchema = RolesSchema.superRefine((roles, ctx) =>
  carrierIssues(roles, "scene", ctx, []),
);

/** Mục vai trò của đồ của cảnh qua zod: `{ success, data }` hay `{ success: false, error }` */
export const parseRoles = (json: unknown) => SceneRolesSchema.safeParse(json);

/**
 * Dòng báo của một lỗi zod trong mảng vai trò: `roles[2].width: …`. Lỗi đã nêu tên trường (trường thiếu, vai trò lạ, luật
 * của cả mục) dừng đường dẫn ở mục. `path` tính từ mảng hay từ gốc món (`["roles", 2, …]`)
 */
export function roleIssueLine(iss: { path: readonly PropertyKey[]; message: string }): string {
  const p = iss.path[0] === "roles" ? iss.path.slice(1) : iss.path;
  if (typeof p[0] !== "number") return `roles: ${iss.message}`;
  const named = /^vai trò |^mục vai trò /.test(iss.message);
  const rest = named
    ? []
    : p.slice(1).map((k) => (typeof k === "number" ? `[${k}]` : `.${String(k)}`));
  return `roles[${p[0]}]${rest.join("")}: ${iss.message}`;
}

/** Mọi dòng báo của một lần parse vai trò hỏng */
export const roleIssueLines = (error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}) => error.issues.map(roleIssueLine);

// ———————————————————————————————— khung

/** Khung món cầm tay (y lên, +z mặt trước) → khung `Item` (y xuống, +x hướng mặt): `[z, −y, x]`, một phép quay */
export const heldToItem = (v: readonly number[]): V3 => [v[2], -v[1], v[0]];
/** Khung `Item` → khung món cầm tay; nghịch của `heldToItem` (cùng công thức) */
export const itemToHeld = (v: readonly number[]): V3 => [v[2], -v[1], v[0]];

/** Lên trong khung `Item` (y xuống) */
export const ITEM_UP: V3 = [0, -1, 0];
const ITEM_FRONT: V3 = [1, 0, 0];

/** Phép đặt ngoài giới hạn của vai trò (cỡ không dương), hay `undefined` */
export function placeProblem(p: Place3): string | undefined {
  const s = p.s ?? 1;
  if (!Number.isFinite(s) || s <= 0) return `phép đặt có cỡ ${s}: chỉ nhận cỡ đồng đều dương`;
  if (!p.at.every(Number.isFinite) || !Number.isFinite(p.yaw ?? 0))
    return "phép đặt có số không hữu hạn";
  return undefined;
}

/** Hai phép đặt nối nhau: `place3(composePlace(a, b), p)` = `place3(a, place3(b, p))` */
export function composePlace(a: Place3, b: Place3): Place3 {
  return {
    at: place3(a, b.at as V3),
    yaw: (a.yaw ?? 0) + (b.yaw ?? 0),
    s: (a.s ?? 1) * (b.s ?? 1),
  };
}

/** Sai số của phép đặt: lệch mỗi phần tử của ma trận (chia cỡ) so với phép quay quanh trục đứng; điểm cách gốc `d` lệch tới `1e-6 · d` */
export const PLACE_TOL = 1e-6;

/**
 * Phép đặt (thế giới rig) từ phần tuyến tính `L` (hàng trước) và dời `t` của một phép biến đổi trong hệ rig: chỉ nhận quay
 * quanh trục đứng và cỡ đồng đều dương, so đủ chín phần tử với `PLACE_TOL`; nghiêng, xiên, cỡ không đều, lật là lỗi (docs/13
 * mục 2)
 */
export function placeOfLinear(L: M3, t: V3): { place: Place3 } | { error: string } {
  const det =
    L[0] * (L[4] * L[8] - L[5] * L[7]) -
    L[1] * (L[3] * L[8] - L[5] * L[6]) +
    L[2] * (L[3] * L[7] - L[4] * L[6]);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return { error: "phép đặt suy biến (cỡ 0)" };
  if (det < 0) return { error: "phép đặt lật (soi gương): vai trò chỉ nhận quay quanh trục đứng" };
  const cols = [0, 1, 2].map((k) => Math.hypot(L[k], L[3 + k], L[6 + k]));
  const s = Math.cbrt(det);
  if (cols.some((c) => Math.abs(c / s - 1) > PLACE_TOL))
    return {
      error: `phép đặt cỡ không đều (${cols.map((c) => fmt(c)).join(", ")}): vai trò chỉ nhận cỡ đồng đều`,
    };
  const R = L.map((x) => x / s);
  const yaw = Math.atan2(R[2], R[0]);
  const [c, n] = [Math.cos(yaw), Math.sin(yaw)];
  const want = [c, 0, n, 0, 1, 0, -n, 0, c];
  if (R.some((x, i) => Math.abs(x - want[i]) > PLACE_TOL)) {
    const tilt = Math.acos(Math.max(-1, Math.min(1, R[4]))) / D2R;
    return {
      error: `phép đặt ${tilt < 0.05 ? "xiên hay nghiêng dưới 0,1°" : `nghiêng ${fmt(tilt)}°`}: vai trò chỉ nhận quay quanh trục đứng`,
    };
  }
  return { place: { at: [...t] as V3, yaw, s } };
}

/** Vai trò của đồ của cảnh với mặc định đã điền, mọi điểm, hướng, độ dài là số */
export type PlacedRole =
  | { role: "vessel"; name?: string; mouth: { at: V3; r: number; dir: V3 } }
  | { role: "seat" | "footrest"; name?: string; at: V3; size: [number, number]; front: V3 }
  | { role: "armrest"; name?: string; from: V3; to: V3; width: number }
  | { role: "backrest"; name?: string; from: V3; to: V3; width: number; front: V3 }
  | { role: "tabletop"; name?: string; y: number; poly: [number, number][]; thick: number };

const flat = (d: V3): V3 => unit([d[0], 0, d[2]]);

/**
 * Mục vai trò của đồ của cảnh (đã qua `parseRoles`) với mặc định điền trong khung vật: `front` của `Rect` là +x, `front` của
 * `backrest` là `front` của mặt ngồi cùng vật (không có thì +x), `mouth.dir` là lên
 */
export function resolveRoles(roles: readonly Role[]): PlacedRole[] {
  const seat = roles.find((r): r is RoleOf<"seat"> => r.role === "seat");
  const seatFront = seat?.front ? flat(seat.front as V3) : ITEM_FRONT;
  return roles.flatMap((r): PlacedRole[] => {
    const nm = r.name !== undefined ? { name: r.name } : {};
    switch (r.role) {
      case "vessel":
        return [
          {
            role: "vessel",
            ...nm,
            mouth: {
              at: [...(r.mouth.at as V3)],
              r: r.mouth.r,
              dir: r.mouth.dir ? unit([...(r.mouth.dir as V3)]) : ITEM_UP,
            },
          },
        ];
      case "seat":
      case "footrest":
        return [
          {
            role: r.role,
            ...nm,
            at: [...r.at] as V3,
            size: [...r.size],
            front: r.front ? flat(r.front as V3) : ITEM_FRONT,
          },
        ];
      case "armrest":
        return [
          { role: "armrest", ...nm, from: [...r.from] as V3, to: [...r.to] as V3, width: r.width },
        ];
      case "backrest":
        return [
          {
            role: "backrest",
            ...nm,
            from: [...r.from] as V3,
            to: [...r.to] as V3,
            width: r.width,
            front: r.front ? flat(r.front as V3) : seatFront,
          },
        ];
      case "tabletop":
        return [
          {
            role: "tabletop",
            ...nm,
            y: r.y,
            poly: r.poly.map((v) => [v[0], v[1]]),
            thick: r.thick,
          },
        ];
      default:
        return [];
    }
  });
}

/** Mục đã điền mặc định đổi qua phép đặt `p`: điểm qua cả phép đặt, hướng chỉ quay, độ dài nhân cỡ */
export function placeRoles(roles: readonly PlacedRole[], p: Place3): PlacedRole[] {
  const s = p.s ?? 1;
  const P = (v: V3) => place3(p, v);
  const T = (v: V3) => place3({ at: [0, 0, 0], yaw: p.yaw }, v);
  return roles.map((r): PlacedRole => {
    switch (r.role) {
      case "vessel":
        return { ...r, mouth: { at: P(r.mouth.at), r: r.mouth.r * s, dir: T(r.mouth.dir) } };
      case "seat":
      case "footrest":
        return { ...r, at: P(r.at), size: [r.size[0] * s, r.size[1] * s], front: T(r.front) };
      case "armrest":
        return { ...r, from: P(r.from), to: P(r.to), width: r.width * s };
      case "backrest":
        return { ...r, from: P(r.from), to: P(r.to), width: r.width * s, front: T(r.front) };
      case "tabletop": {
        const y = P([0, r.y, 0])[1];
        return {
          ...r,
          y,
          poly: r.poly.map(([x, z]) => {
            const w = P([x, r.y, z]);
            return [w[0], w[2]];
          }),
          thick: r.thick * s,
        };
      }
    }
  });
}

/** Bốn góc `[x, z]` của một `Rect` đã giải (ngang), xếp vòng */
export function rectCorners(r: { at: V3; size: [number, number]; front: V3 }): [number, number][] {
  const F = flat(r.front);
  const S = cross3(F, ITEM_UP);
  const [d, w] = [r.size[0] / 2, r.size[1] / 2];
  return [
    [d, w],
    [-d, w],
    [-d, -w],
    [d, -w],
  ].map(([a, b]) => [r.at[0] + F[0] * a + S[0] * b, r.at[2] + F[2] * a + S[2] * b]);
}
