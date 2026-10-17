import { z } from "zod";
import { BODY_MARKS, PALM_DIR_NAMES, type BodyMark, type PalmDir } from "./bodyMark";
import { HAND_GRIPS, HAND_POSE_KINDS, type HandPose } from "./hand";
import { fromColumns, matMul, matVec, type M3, type V3 } from "./lens";

/**
 * Món cầm tay có khung và mốc (`held/<món>.json`): hộp bao, mốc ngữ nghĩa (điểm và pháp tuyến ra ngoài) và các kiểu cầm.
 * Kiểu cầm là một liên kết cứng giữa bàn tay và món, tính từ mốc (`gripFrame`): dáng ngón, điểm của món trùng tâm nắm,
 * hướng lòng tay và hướng ngón trong khung món. Khung món: trục three (y lên, +z mặt trước món), đơn vị rig (`× 0,01` ra
 * three của người cao 4,3). docs/01-rig.md#kiểu-cầm
 */

export const HELD_VERSION = 1;

const v3 = z.tuple([z.number(), z.number(), z.number()]);

/** Một điểm của món: tên mốc, hay mốc cộng `offset` (đơn vị rig, khung món) */
export const AnchorRefSchema = z.union([
  z.string().min(1),
  z.strictObject({ anchor: z.string().min(1), offset: v3.optional() }),
]);
export type AnchorRef = z.infer<typeof AnchorRefSchema>;

/**
 * Hướng trong khung món: vectơ, `into` ngược pháp tuyến mốc (lòng tay úp vào mặt ấy), `along` theo pháp tuyến mốc,
 * `toward` từ điểm nắm (`at`) tới mốc
 */
export const ItemDirSchema = z.union([
  v3,
  z.strictObject({ into: z.string().min(1) }),
  z.strictObject({ along: z.string().min(1) }),
  z.strictObject({ toward: z.string().min(1) }),
]);
export type ItemDir = z.infer<typeof ItemDirSchema>;

/** Ngón của bàn tay khi ôm theo đồ: cái, trỏ, giữa, áp út, út */
export const HELD_FINGERS = ["thumb", "index", "middle", "ring", "pinky"] as const;
export type HeldFinger = (typeof HELD_FINGERS)[number];

/**
 * Một bàn tay của kiểu cầm: dáng ngón, điểm của món trùng tâm nắm của dáng ấy, lòng tay và ngón trong khung món; `wrap`
 * là các ngón ôm món — món có hình va chạm (`shape`) thì ngón ấy cuộn thêm tới khi chạm mặt món (`heldFit`)
 */
export const GripHandSchema = z.strictObject({
  pose: z.enum(HAND_POSE_KINDS),
  at: AnchorRefSchema,
  palm: ItemDirSchema,
  fingers: ItemDirSchema,
  wrap: z.array(z.enum(HELD_FINGERS)).optional(),
});
export type GripHand = z.infer<typeof GripHandSchema>;

/** Hướng gọi tên cho đích ý định: ống kính, mặt người cầm, hay hướng hệ thân (`PALM_DIRS`) */
export const INTENT_TARGETS = ["camera", "holderFace", ...PALM_DIR_NAMES] as const;
export type IntentName = "camera" | "holderFace" | PalmDir;

/**
 * Đích của một trục ý định: tên (`INTENT_TARGETS`), vectơ hệ thân `[tiến, y, ra ngoài]`, mặt (hay mốc `mark`) của người
 * khác trong `cast`, hay mốc thân của chính người cầm
 */
export const IntentTargetSchema = z.union([
  z.enum(INTENT_TARGETS),
  v3,
  z.strictObject({ cast: z.string().min(1), mark: z.enum(BODY_MARKS).optional() }),
  z.strictObject({
    mark: z.enum(BODY_MARKS),
    side: z.enum(["same", "other"]).optional(),
    offset: v3.optional(),
  }),
]);
export type IntentTarget = z.infer<typeof IntentTargetSchema>;

/** Trục của món (tên mốc thì là pháp tuyến của mốc, hay vectơ khung món) quay về đích, nghiêng khỏi đích `tilt` độ */
export const AxisIntentSchema = z.strictObject({
  axis: z.union([z.string().min(1), v3]),
  toward: IntentTargetSchema,
  tilt: z.number().min(-180).max(180).optional(),
});
export type AxisIntent = z.infer<typeof AxisIntentSchema>;

/**
 * Ý định: trục chính `face` (hay `up` — viết tắt của `face` hướng lên, "chén đứng"), trục phụ `roll` chốt độ lăn. Không
 * khai `roll` thì món lăn ít nhất so với bàn tay hành động đang cho
 */
export const HoldIntentSchema = z
  .strictObject({
    face: AxisIntentSchema.optional(),
    up: z.union([z.string().min(1), v3]).optional(),
    roll: AxisIntentSchema.optional(),
  })
  .refine((i) => !(i.face && i.up), {
    message: "`up` là viết tắt của `face` hướng lên — khai một",
  });
export type HoldIntentSpec = z.infer<typeof HoldIntentSchema>;

const TouchSchema = z.union([z.string(), z.strictObject({ part: z.string(), max: z.number() })]);

/**
 * Kiểu cầm: bàn tay chính (dáng, điểm, lòng tay, ngón), phần người được lấn (`touch`, như `userData.touch`), ý định mặc
 * định, bàn tay trái khác hẳn (`left`, bỏ trống là dùng chung — ngón cái tự sang cạnh kia), và cầm hai tay (`both`): món
 * cứng theo tay `lead`, tay kia với tới `other`
 */
export const GripSpecSchema = GripHandSchema.extend({
  touch: z.array(TouchSchema).optional(),
  intent: HoldIntentSchema.optional(),
  left: GripHandSchema.partial().optional(),
  both: z.strictObject({ lead: z.enum(["right", "left"]), other: GripHandSchema }).optional(),
});
export type GripSpec = z.infer<typeof GripSpecSchema>;

const AnchorSchema = z.strictObject({ at: v3, dir: v3.optional() });

const pos = z.number().positive();

/**
 * Một khối của hình va chạm, khung món, đơn vị rig: hộp `box` (cỡ ba cạnh, tâm `at`, bo cạnh `round`), trụ `cyl` (bán kính ở
 * `from`, tới `to`; `r2` là bán kính ở `to` — trụ côn, vai bình; `wall` là ống rỗng thành dày ngần ấy, hở hai đầu — miệng
 * chén, vòng chìa), cầu `ball` (bán kính, tâm `at`). Hình của món là hợp các khối; ngón ôm và luật `held` đo trên nó.
 * docs/01-rig.md#hình-va-chạm-của-món
 */
export const HeldShapeSchema = z.union([
  z.strictObject({
    box: z.tuple([pos, pos, pos]),
    at: v3.optional(),
    round: z.number().min(0).optional(),
  }),
  z.strictObject({
    cyl: pos,
    from: v3,
    to: v3,
    r2: z.number().min(0).optional(),
    wall: pos.optional(),
  }),
  z.strictObject({ ball: pos, at: v3.optional() }),
]);
export type HeldShape = z.infer<typeof HeldShapeSchema>;

export const HeldItemSchema = z
  .object({
    schemaVersion: z
      .literal(HELD_VERSION, {
        error: "JSON món cầm thuộc phiên bản schema khác; cần bản @stickman3d/rig khớp với nó",
      })
      .default(HELD_VERSION),
    /** Hộp bao, đơn vị rig */
    size: v3,
    anchors: z.record(z.string(), AnchorSchema),
    grips: z.record(z.string(), GripSpecSchema),
    /** Tên nhóm con của món treo theo trọng lực (chùm chìa thõng, dòng rượu rót) */
    hang: z.array(z.string().min(1)).optional(),
    /** Hình va chạm: hợp các khối (`HeldShapeSchema`) — ngón ôm theo đồ và luật `held` đo trên nó */
    shape: z.array(HeldShapeSchema).min(1).optional(),
  })
  .superRefine((m, ctx) => {
    let issues = 0;
    const bad = (path: (string | number)[], message: string) => {
      issues++;
      ctx.addIssue({ code: "custom", path, message });
    };
    const has = (a: string) => a in m.anchors;
    const dir = (a: string) => !!m.anchors[a]?.dir;
    const ref = (r: AnchorRef, path: (string | number)[]) => {
      const a = typeof r === "string" ? r : r.anchor;
      if (!has(a)) bad(path, `không có mốc \`${a}\``);
    };
    const itemDir = (d: ItemDir, path: (string | number)[]) => {
      if (Array.isArray(d)) {
        if (Math.hypot(...d) < 1e-9) bad(path, "hướng là vectơ không");
        return;
      }
      const [k, a] = Object.entries(d)[0] as [string, string];
      if (!has(a)) bad(path, `không có mốc \`${a}\``);
      else if (k !== "toward" && !dir(a)) bad(path, `mốc \`${a}\` không có \`dir\` cho \`${k}\``);
    };
    const axis = (a: string | V3, path: (string | number)[]) => {
      if (typeof a === "string" && !(has(a) && dir(a)))
        bad(path, `trục \`${a}\` cần một mốc có \`dir\``);
    };
    /** Báo tham chiếu hỏng của một bàn tay; trả `true` khi mọi mốc nó cần đều có */
    const hand = (h: Partial<GripHand>, path: (string | number)[]) => {
      const n = issues;
      if (h.at !== undefined) ref(h.at, [...path, "at"]);
      if (h.palm !== undefined) itemDir(h.palm, [...path, "palm"]);
      if (h.fingers !== undefined) itemDir(h.fingers, [...path, "fingers"]);
      return issues === n;
    };
    const axes = (h: GripHand, path: (string | number)[]) => {
      try {
        gripAxes(m as HeldItemSpec, h);
      } catch (e) {
        bad(path, (e as Error).message);
      }
    };
    if (!Object.keys(m.grips).length) bad(["grips"], "món cần ít nhất một kiểu cầm");
    m.shape?.forEach((b, i) => {
      if ("box" in b && b.round !== undefined && 2 * b.round > Math.min(...b.box))
        bad(["shape", i, "round"], "bo cạnh quá nửa cạnh ngắn nhất của hộp");
      if ("cyl" in b && Math.hypot(...sub(b.to as V3, b.from as V3)) < 1e-6)
        bad(["shape", i], "trụ có `from` trùng `to`");
      if ("cyl" in b && b.wall !== undefined && b.wall >= Math.min(b.cyl, b.r2 ?? b.cyl))
        bad(["shape", i, "wall"], "thành ống dày hơn bán kính");
    });
    for (const [name, g] of Object.entries(m.grips)) {
      const path = ["grips", name];
      if (hand(g, path)) axes(g, path);
      if (g.left && hand(g.left, [...path, "left"]) && hand(g, path))
        axes({ ...g, ...g.left }, [...path, "left"]);
      if (g.both && hand(g.both.other, [...path, "both", "other"]))
        axes(g.both.other, [...path, "both", "other"]);
      const i = g.intent;
      if (i?.face) axis(i.face.axis, [...path, "intent", "face"]);
      if (i?.up !== undefined) axis(i.up, [...path, "intent", "up"]);
      if (i?.roll) axis(i.roll.axis, [...path, "intent", "roll"]);
    }
  });
export type HeldItemSpec = z.infer<typeof HeldItemSchema>;

/** Nâng JSON đời cũ lên `HELD_VERSION`. File mới hơn thì trả nguyên để zod báo lỗi. */
export function migrateHeldItem(json: unknown): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json;
  const o = structuredClone(json) as Record<string, unknown>;
  const from = typeof o.schemaVersion === "number" ? o.schemaVersion : 0;
  if (from > HELD_VERSION) return o;
  o.schemaVersion = HELD_VERSION;
  return o;
}

export const parseHeldItem = (json: unknown) => HeldItemSchema.safeParse(migrateHeldItem(json));

/** `"món#kiểu"` của scene ra tên món và tên kiểu cầm */
export function holdRef(s: string): { item: string; grip: string } {
  const i = s.indexOf("#");
  if (i <= 0 || i === s.length - 1) throw new Error(`\`${s}\`: cần dạng \`món#kiểu\``);
  return { item: s.slice(0, i), grip: s.slice(i + 1) };
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: V3): V3 => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];

const anchorOf = (item: HeldItemSpec, name: string) => {
  const a = item.anchors[name];
  if (!a) throw new Error(`không có mốc \`${name}\``);
  return a;
};

/** Điểm của món (đơn vị rig, khung món) */
export function heldPoint(item: HeldItemSpec, ref: AnchorRef): V3 {
  if (typeof ref === "string") return [...anchorOf(item, ref).at] as V3;
  const p = anchorOf(item, ref.anchor).at as V3;
  return ref.offset ? add(p, ref.offset as V3) : [...p];
}

/** Trục của món, đơn vị: tên mốc là pháp tuyến của mốc ấy */
export function heldAxis(item: HeldItemSpec, axis: string | readonly number[]): V3 {
  if (typeof axis !== "string") return unit(axis as V3);
  const d = anchorOf(item, axis).dir;
  if (!d) throw new Error(`mốc \`${axis}\` không có \`dir\``);
  return unit(d as V3);
}

/** Hướng `d` trong khung món, đơn vị; `from` là điểm nắm cho `toward` */
export function heldDir(item: HeldItemSpec, d: ItemDir, from: V3): V3 {
  if (Array.isArray(d)) return unit(d as V3);
  if ("into" in d) return mul(heldAxis(item, d.into), -1);
  if ("along" in d) return heldAxis(item, d.along);
  const v = sub(heldPoint(item, d.toward), from);
  if (Math.hypot(...v) < 1e-9) throw new Error(`\`toward: ${d.toward}\` trùng điểm nắm`);
  return unit(v);
}

/** Bàn tay của kiểu cầm cho tay bên `side` (`-1` phải, `1` trái): tay trái lấy phần `left` đè lên */
export const gripHand = (g: GripSpec, side: number): GripHand =>
  side > 0 && g.left ? { ...pickHand(g), ...g.left } : pickHand(g);

const pickHand = (g: GripHand): GripHand => ({
  pose: g.pose,
  at: g.at,
  palm: g.palm,
  fingers: g.fingers,
  ...(g.wrap && { wrap: g.wrap }),
});

/** Lòng tay (`palm`) và ngón (`fingers`, trực giao hoá theo lòng tay) của một bàn tay cầm, khung món, đơn vị */
export function gripAxes(item: HeldItemSpec, h: GripHand): { palm: V3; fingers: V3; at: V3 } {
  const at = heldPoint(item, h.at);
  const palm = heldDir(item, h.palm, at);
  const f0 = heldDir(item, h.fingers, at);
  const f = sub(f0, mul(palm, dot(f0, palm)));
  if (Math.hypot(...f) < 1e-3) throw new Error("`palm` và `fingers` song song");
  return { palm, fingers: unit(f), at };
}

/** Khung bàn tay (`handFrames`) bên `side`: pháp tuyến lòng tay `n` và hướng ngón `f` */
export const handAxes = (side: number): { n: V3; f: V3 } => ({ n: [-side, 0, 0], f: [0, -1, 0] });

/** Tâm nắm của dáng `pose` trong khung bàn tay bên `side` cỡ `k`, cỡ dọc `long` (three) */
export function gripCenter(pose: HandPose, side: number, k = 1, long = k): V3 {
  const [x, y, z] = HAND_GRIPS[pose];
  return [-side * x * k, y * long, z * k];
}

/** Phép đặt cứng: điểm khung món `q` ra khung bàn tay là `R · q · u + p` (`u` đơn vị three của một đơn vị rig) */
export interface GripFrame {
  R: M3;
  p: V3;
  /** Đơn vị three của một đơn vị rig của món */
  u: number;
}

/**
 * Liên kết cứng của kiểu cầm `h` trên món `item` cho bàn tay bên `side` cỡ `k`, cỡ dọc `long` (đã nhân cỡ người nếu
 * khung bàn tay đo trong thế giới): phép quay đưa `palm` → lòng tay, `fingers` → ngón, rồi dời cho điểm `at` trùng tâm
 * nắm của dáng `pose`. `s` là cỡ người (`world.s`) nhân vào đơn vị của món. Không bao giờ soi gương: cùng kiểu cầm, tay
 * trái có ngón cái ở cạnh kia của món
 */
export function gripFrame(
  item: HeldItemSpec,
  h: GripHand,
  side: number,
  k = 1,
  long = k,
  s = 1,
): GripFrame {
  const { palm, fingers, at } = gripAxes(item, h);
  const { n, f } = handAxes(side);
  const Mo = fromColumns(palm, fingers, cross(palm, fingers));
  const Mh = fromColumns(n, f, cross(n, f));
  const R = matMul(Mh, tr(Mo));
  const u = 0.01 * s;
  return { R, p: sub(gripCenter(h.pose, side, k, long), mul(matVec(R, at), u)), u };
}

/** Điểm `q` của món (đơn vị rig, khung món) ra khung bàn tay */
export const gripPoint = (G: GripFrame, q: V3): V3 => add(matVec(G.R, mul(q, G.u)), G.p);

/** Kiểu cầm `grip` của món, hay ném lỗi có tên */
export function heldGrip(item: HeldItemSpec, grip: string, name = "món"): GripSpec {
  const g = item.grips[grip];
  if (!g) throw new Error(`\`${name}\` không có kiểu cầm \`${grip}\``);
  return g;
}

/** Mốc thân của đích ý định `{ cast, mark }` hay `{ mark }`: mặc định là mặt (giữa hai mắt) */
export const intentMark = (t: { mark?: BodyMark }): BodyMark => t.mark ?? "eye";

/** Đích một trục ý định đã quy về dạng bộ giải đọc: tên, vectơ hệ thân, mốc thân của người cầm, hay điểm thế giới rig */
export type HoldTarget =
  | { name: "camera" | "holderFace" }
  | { v: V3 }
  | { to: BodyMark; side?: "same" | "other"; offset?: V3 }
  | { at: V3 };

/** Một trục ý định đã quy: trục trong khung món (đơn vị), đích, độ nghiêng khỏi đích */
export interface HoldAxis {
  axis: V3;
  target: HoldTarget;
  tilt?: number;
  /** Đích như scene khai, để báo: `up`, `camera`, `holderFace`, `<người>.<mốc>`, mốc thân, vectơ */
  label?: string;
}

/**
 * Ý định của món là một số hạng của bàn tay (`AimTerm.hold`): trục chính `face` (cả `up`), trục phụ `roll`; `item`, `grip`
 * là lần cầm sinh ra nó — bộ giải bỏ qua số hạng của lần cầm khác lần đang cầm
 */
export interface HoldAim {
  item: string;
  grip: string;
  face?: HoldAxis;
  roll?: HoldAxis;
}

/**
 * Lần cầm của một bàn tay ở một khung (`Reach.hold` của `world.hands`): món, kiểu cầm, JSON món, giây bắt đầu cầm. Trong
 * `HOLD_BLEND` giây đầu của lần cầm: `from` là kiểu cầm trước đó của cùng món trên tay này và phần còn lại của nó (liên kết
 * hoà dần từ kiểu cũ sang kiểu mới), `enter` là phần đã vào của lần cầm (tay phụ hoà dần tới mốc của nó trên món). `prior`
 * là mẫu trước của tay ấy (`HOLD_SLEW_STEP`): cách bao nhiêu giây và tư thế của người ở đó — cổ tay mang món đi từ nghiệm
 * ở đó với tốc độ có hạn
 */
export interface ReachHold {
  item: string;
  grip: string;
  spec: HeldItemSpec;
  since: number;
  from?: { grip: string; k: number };
  enter?: number;
  prior?: { dt: number; pose: () => object };
}

/** Tên file của món cho tên thể hiện `món:<tên>` (`vali:2` → `vali`); tên không có `:` là chính nó */
export const heldBase = (item: string): string => {
  const i = item.indexOf(":");
  return i > 0 ? item.slice(0, i) : item;
};

/** Giây hoà khi một tay bắt đầu cầm (tay phụ với tới món) hay đổi kiểu cầm cùng món (liên kết cũ → mới) */
export const HOLD_BLEND = 0.3;

/** Giây giữa hai mẫu của chuỗi cổ tay mang món (`ReachHold.prior`), tính từ mốc `world.hands` gần nhất của tay ấy */
export const HOLD_SLEW_STEP = 1 / 30;

/** Phép quay quanh trục đơn vị `u` góc `a` (radian) */
function rotAxis(u: V3, a: number): M3 {
  const [x, y, z] = u;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  return [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ];
}

/** Hoà hai phép quay theo đường ngắn nhất: `f` 0 là `a`, 1 là `b` */
export function mixRotation(a: M3, b: M3, f: number): M3 {
  if (f <= 0) return a;
  if (f >= 1) return b;
  const D = matMul(tr(a), b);
  const c = Math.max(-1, Math.min(1, (D[0] + D[4] + D[8] - 1) / 2));
  const th = Math.acos(c);
  if (th <= 1e-6) return a;
  let u: V3 = [D[7] - D[5], D[2] - D[6], D[3] - D[1]];
  if (Math.hypot(...u) < 1e-6) {
    // quay nửa vòng: trục là cột lớn nhất của `D + I`
    const cols: V3[] = [
      [D[0] + 1, D[3], D[6]],
      [D[1], D[4] + 1, D[7]],
      [D[2], D[5], D[8] + 1],
    ];
    u = cols.reduce((m, v) => (Math.hypot(...v) > Math.hypot(...m) ? v : m));
  }
  return matMul(a, rotAxis(unit(u), th * f));
}

/** Hoà hai liên kết: quay theo đường ngắn nhất từ `a` tới `b`, dời thẳng; `f` 0 là `a`, 1 là `b` */
export const mixGrip = (a: GripFrame, b: GripFrame, f: number): GripFrame =>
  f <= 0
    ? a
    : f >= 1
      ? b
      : {
          R: mixRotation(a.R, b.R, f),
          p: add(mul(a.p, 1 - f), mul(b.p, f)),
          u: a.u + (b.u - a.u) * f,
        };

/** Ý định của mốc `hold` trong scene: tên `món#kiểu`, hay object đè `face` / `up` / `roll` của ý định mặc định */
export const SceneHoldSchema = z.union([
  z.string().regex(/^[^#]+#[^#]+$/, { message: "cần dạng `món#kiểu`" }),
  z.strictObject({
    item: z.string().min(1),
    grip: z.string().min(1),
    face: z.union([AxisIntentSchema, IntentTargetSchema]).optional(),
    up: z.union([z.string().min(1), v3]).optional(),
    roll: AxisIntentSchema.optional(),
  }),
]);
export type SceneHold = z.infer<typeof SceneHoldSchema>;

/** Món và kiểu cầm của một mốc `hold` */
export const sceneHoldRef = (h: SceneHold): { item: string; grip: string } =>
  typeof h === "string" ? holdRef(h) : { item: h.item, grip: h.grip };

/** Bên giải phẫu (`-1` phải) của `both.lead` */
export const leadSide = (lead: "right" | "left") => (lead === "right" ? -1 : 1);

/**
 * Ý định của mốc `hold`: ý định mặc định của kiểu cầm, `face` / `up` (cùng là trục chính) và `roll` của mốc đè lên. `face`
 * khai đích không có trục thì lấy trục chính của ý định mặc định. Trả `face`, `roll` dạng `AxisIntent`
 */
export function holdIntent(
  item: HeldItemSpec,
  h: SceneHold,
): { face?: AxisIntent; roll?: AxisIntent } {
  const { grip } = sceneHoldRef(h);
  const d = heldGrip(item, grip).intent;
  const main = (i: HoldIntentSpec | undefined): AxisIntent | undefined =>
    i?.face ?? (i?.up !== undefined ? { axis: i.up, toward: "up" } : undefined);
  let face = main(d);
  let roll = d?.roll;
  if (typeof h === "object") {
    if (h.up !== undefined) face = { axis: h.up, toward: "up" };
    else if (h.face !== undefined) {
      if (typeof h.face === "object" && !Array.isArray(h.face) && "axis" in h.face) face = h.face;
      else {
        if (!face)
          throw new Error(`\`${grip}\` không có trục ý định mặc định cho \`face\` khai đích trần`);
        face = { axis: face.axis, toward: h.face as IntentTarget };
      }
    }
    if (h.roll) roll = h.roll;
  }
  return { ...(face && { face }), ...(roll && { roll }) };
}
