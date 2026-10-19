import { z } from "zod";
import { BODY_MARKS, PALM_DIR_NAMES, type BodyMark, type PalmDir } from "./bodyMark";
import { HAND_GRIPS, HAND_POSE_KINDS, type HandPose } from "./hand";
import { topProblems } from "./heldGeom";
import { fromColumns, matMul, matVec, type M3, type V3 } from "./lens";

/**
 * Món cầm tay có khung và mốc (`held/<món>.json`): hộp bao, mốc ngữ nghĩa (điểm và pháp tuyến ra ngoài) và các kiểu cầm.
 * Kiểu cầm là một liên kết cứng giữa bàn tay và món, tính từ mốc (`gripFrame`): dáng ngón, điểm của món trùng tâm nắm,
 * hướng lòng tay và hướng ngón trong khung món. Khung món: trục three (y lên, +z mặt trước món), đơn vị rig (`× 0,01` ra
 * three của người cao 4,3). docs/01-rig.md#kiểu-cầm
 */

/** Bản schema mới nhất rig hiểu (2: nhóm cầm); `HELD_MIN` là bản cũ nhất còn nạp (1: `grips`) */
export const HELD_VERSION = 2;
export const HELD_MIN = 1;

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
  on: z.literal("hand").optional(),
  touch: z.array(TouchSchema).optional(),
  intent: HoldIntentSchema.optional(),
  left: GripHandSchema.partial().optional(),
  both: z.strictObject({ lead: z.enum(["right", "left"]), other: GripHandSchema }).optional(),
});
export type GripSpec = z.infer<typeof GripSpecSchema>;

/** Chỗ treo món trên cánh tay của kiểu treo: khuỷu gập (quai vắt ở mặt trong khuỷu), đầu vai (quai trên vai, tay ngoài quai) */
export const CARRY_ON = ["elbow", "shoulder"] as const;
export type CarryOn = (typeof CARRY_ON)[number];

/**
 * Kiểu treo: món không nằm trong bàn tay mà treo ở `on` — mốc `at` của món (đỉnh quai) đặt vào chỗ treo, thân món thõng
 * theo trọng lực mỗi khung, đẩy khỏi thân và đùi theo hình va chạm (`shape`, bắt buộc). Bàn tay của tay ấy theo hành
 * động. `yaw` quay thân món quanh phương đứng (độ), `touch` như kiểu cầm. docs/01-rig.md#kiểu-treo
 */
export const CarrySpecSchema = z.strictObject({
  on: z.enum(CARRY_ON),
  at: AnchorRefSchema,
  yaw: z.number().min(-180).max(180).optional(),
  touch: z.array(TouchSchema).optional(),
});
export type CarrySpec = z.infer<typeof CarrySpecSchema>;

/** Một mục của `grips`: kiểu cầm bằng bàn tay hay kiểu treo trên cánh tay */
export type HeldGripSpec = GripSpec | CarrySpec;

/** Kiểu treo (`on` là `elbow` / `shoulder`), không phải kiểu cầm bằng bàn tay */
export const isCarry = (g: HeldGripSpec | undefined): g is CarrySpec =>
  !!g && g.on !== undefined && g.on !== "hand";

/** Mục `grips`, phân theo `on`: không khai hay `hand` là kiểu cầm bằng bàn tay, chỗ treo trên cánh tay là kiểu treo */
const GripEntrySchema = z.discriminatedUnion("on", [CarrySpecSchema, GripSpecSchema]);

const AnchorSchema = z.strictObject({ at: v3, dir: v3.optional() });

const pos = z.number().positive();

/** Nhãn phần (`part`) và khối chi tiết (`detail`) của món v2 */
const shapeTag = { part: z.string().min(1).optional(), detail: z.literal(true).optional() };

/** Mặt trước, đầu trên: tên mốc có `dir` hay vectơ khung món (v2) */
const FrameDirSchema = z.union([z.string().min(1), v3]);

/** Loại khối hình ép cho một phần khi rig suy sai (v2) */
export const PART_AS = ["slab", "disc", "rod", "lathe", "box"] as const;

/** Thuộc tính một phần của món v2: `grip: false` không được cầm; `as` (+ `axis`) ép loại khối hình, `rod` cần `axis` */
export const HeldPartSchema = z.strictObject({
  grip: z.boolean().optional(),
  as: z.enum(PART_AS).optional(),
  axis: FrameDirSchema.optional(),
});
export type HeldPart = z.infer<typeof HeldPartSchema>;

/** Chỗ treo của nhóm `carry` (v2): tên mốc đỉnh quai, mặt trong khuỷu / đầu vai */
export const HeldSeatsSchema = z.strictObject({
  elbow: z.string().min(1).optional(),
  shoulder: z.string().min(1).optional(),
});
export type HeldSeats = z.infer<typeof HeldSeatsSchema>;

/** Trường chỉ có ở món v2 */
const V2_ONLY = ["front", "top", "parts", "seats", "touch"] as const;

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
    ...shapeTag,
  }),
  z.strictObject({
    cyl: pos,
    from: v3,
    to: v3,
    r2: z.number().min(0).optional(),
    wall: pos.optional(),
    ...shapeTag,
  }),
  z.strictObject({ ball: pos, at: v3.optional(), ...shapeTag }),
]);
export type HeldShape = z.infer<typeof HeldShapeSchema>;

/** Kiểm riêng của món v2: nằm trong `superRefine`, `bad` báo lỗi theo đường dẫn */
function checkV2(
  m: {
    anchors: Record<string, { at: V3; dir?: V3 | undefined }>;
    shape?: HeldShape[] | undefined;
    grips?: unknown;
    front?: string | V3 | undefined;
    top?: string | V3 | undefined;
    parts?: Record<string, HeldPart> | undefined;
    seats?: HeldSeats | undefined;
  },
  bad: (path: (string | number)[], message: string) => void,
) {
  if (m.grips !== undefined)
    bad(["grips"], "món v2 không có `grips`; chỗ cầm khai ở cảnh: docs/11 mục 4");
  if (!m.shape) bad(["shape"], "món v2 cần `shape` (hình va chạm)");
  const dirOf = (d: string | V3, path: (string | number)[]) => {
    if (typeof d !== "string") {
      if (Math.hypot(...d) < 1e-9) bad(path, "hướng là vectơ không");
    } else if (!(d in m.anchors)) bad(path, `không có mốc \`${d}\``);
    else if (!m.anchors[d].dir) bad(path, `mốc \`${d}\` không có \`dir\``);
  };
  if (m.front !== undefined) dirOf(m.front, ["front"]);
  if (m.top !== undefined) dirOf(m.top, ["top"]);
  for (const k of ["elbow", "shoulder"] as const) {
    const a = m.seats?.[k];
    if (a !== undefined && !(a in m.anchors)) bad(["seats", k], `không có mốc \`${a}\``);
  }
  for (const [name, p] of Object.entries(m.parts ?? {})) {
    if (p.as === "rod" && p.axis === undefined)
      bad(["parts", name], '`as: "rod"` cần `axis` (trục của thanh)');
    if (p.axis !== undefined) dirOf(p.axis, ["parts", name, "axis"]);
  }
  if (
    m.shape?.length &&
    m.shape.every((b) => b.detail || (b.part !== undefined && m.parts?.[b.part]?.grip === false))
  )
    bad(["shape"], "mọi khối đều là `detail` hay thuộc phần `grip: false` — không còn gì để cầm");
  for (const msg of topProblems(m)) bad(["top"], msg);
}

export const HeldItemSchema = z
  .object({
    schemaVersion: z
      .union([z.literal(1), z.literal(2)], {
        error: "JSON món cầm thuộc phiên bản schema khác; cần bản @stickman3d/rig khớp với nó",
      })
      .default(1),
    /** Hộp bao, đơn vị rig */
    size: v3,
    anchors: z.record(z.string(), AnchorSchema),
    /** v1: kiểu cầm của món. v2 không có: chỗ cầm khai ở cảnh */
    grips: z.record(z.string(), GripEntrySchema).optional(),
    /** v2: mặt trước (mốc có `dir` hay vectơ); bỏ trống là `+z` */
    front: FrameDirSchema.optional(),
    /** v2: đầu trên (mốc có `dir` hay vectơ); bỏ trống là `+y` hay hướng miệng */
    top: FrameDirSchema.optional(),
    /** v2: thuộc tính phần, khoá là nhãn `part` của khối `shape` */
    parts: z.record(z.string().min(1), HeldPartSchema).optional(),
    /** v2: chỗ treo của nhóm `carry` */
    seats: HeldSeatsSchema.optional(),
    /** v2: phần người được lấn vào món khi cầm */
    touch: z.array(TouchSchema).optional(),
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
    m.shape?.forEach((b, i) => {
      if ("box" in b && b.round !== undefined && 2 * b.round > Math.min(...b.box))
        bad(["shape", i, "round"], "bo cạnh quá nửa cạnh ngắn nhất của hộp");
      if ("cyl" in b && Math.hypot(...sub(b.to as V3, b.from as V3)) < 1e-6)
        bad(["shape", i], "trụ có `from` trùng `to`");
      if ("cyl" in b && b.wall !== undefined && b.wall >= Math.min(b.cyl, b.r2 ?? b.cyl))
        bad(["shape", i, "wall"], "thành ống dày hơn bán kính");
    });
    if (m.schemaVersion === 2) {
      checkV2(m, bad);
      return;
    }
    for (const f of V2_ONLY)
      if (m[f] !== undefined) bad([f], `\`${f}\` chỉ có ở món v2 (\`schemaVersion: 2\`)`);
    m.shape?.forEach((b, i) => {
      for (const f of ["part", "detail"] as const)
        if (f in b && b[f] !== undefined)
          bad(["shape", i, f], `\`${f}\` chỉ có ở món v2 (\`schemaVersion: 2\`)`);
    });
    if (!m.grips) return bad(["grips"], "món v1 cần `grips`");
    if (!Object.keys(m.grips).length) bad(["grips"], "món cần ít nhất một kiểu cầm");
    for (const [name, g] of Object.entries(m.grips)) {
      const path = ["grips", name];
      if (name.startsWith("@"))
        bad(path, "tên kiểu cầm không được bắt đầu bằng `@` (dành cho `món@nhóm`)");
      if (isCarry(g)) {
        ref(g.at, [...path, "at"]);
        if (!m.shape)
          bad(
            path,
            `kiểu treo \`on: ${g.on}\` cần \`shape\` (thân món): thân món đẩy khỏi người theo hình ấy`,
          );
        continue;
      }
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

/** Thiếu `schemaVersion` thì là 1; số đã khai giữ nguyên (không nâng lên `HELD_VERSION`), số mới hơn để zod báo lỗi. */
export function migrateHeldItem(json: unknown): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json;
  const o = structuredClone(json) as Record<string, unknown>;
  if (typeof o.schemaVersion !== "number") o.schemaVersion = HELD_MIN;
  return o;
}

/** Món v2 (nhóm cầm): không có `grips`, chỗ cầm khai ở cảnh bằng `món@nhóm` */
export const isHeldV2 = (item: { schemaVersion: number }): boolean => item.schemaVersion === 2;

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

const noV2 = (item: HeldItemSpec, name: string) => {
  if (isHeldV2(item)) throw new Error(`\`${name}\`: món v2 không có kiểu cầm, khai \`món@nhóm\``);
};

/** Kiểu cầm `grip` của món, hay ném lỗi có tên */
export function heldGrip(item: HeldItemSpec, grip: string, name = "món"): HeldGripSpec {
  noV2(item, name);
  const g = item.grips?.[grip];
  if (!g) throw new Error(`\`${name}\` không có kiểu cầm \`${grip}\``);
  return g;
}

/** Kiểu cầm bằng bàn tay `grip` của món; không có, hay là kiểu treo, thì ném lỗi có tên */
export function gripSpec(item: HeldItemSpec, grip: string, name = "món"): GripSpec {
  const g = heldGrip(item, grip, name);
  if (isCarry(g))
    throw new Error(`\`${name}#${grip}\` là kiểu treo (\`on: ${g.on}\`), không cầm bằng bàn tay`);
  return g;
}

/** Kiểu cầm bằng bàn tay của món (`undefined` khi không có hay là kiểu treo) */
export const gripOf = (item: HeldItemSpec, grip: string, name = "món"): GripSpec | undefined => {
  noV2(item, name);
  const g = item.grips?.[grip];
  return g && !isCarry(g) ? g : undefined;
};

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
export function rotAxis(u: V3, a: number): M3 {
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

/** Mười bốn nhóm cầm của rig (docs/11-nhom-cam.md mục 3) */
export const GROUP_IDS = [
  "sheet",
  "card",
  "pen",
  "chopsticks",
  "cylinder",
  "round",
  "bowl",
  "handle",
  "palmBox",
  "platform",
  "hug",
  "clamp",
  "carry",
  "soft",
] as const;
export type GroupId = (typeof GROUP_IDS)[number];

const HOLD_EDGES = ["top", "bottom", "left", "right", "front", "back"] as const;
const HOLD_ALONG = ["corner", "low", "mid", "high"] as const;
const HOLD_THUMB = ["front", "back", "top", "bottom", "left", "right", "up", "down"] as const;
const HOLD_SLANT = ["in", "low", "high"] as const;

/** Trường chỗ cầm dùng chung cho `hold` và `both` của tay phụ */
const holdPlace = {
  part: z.string().min(1).optional(),
  edge: z.union([z.enum(HOLD_EDGES), z.number()]).optional(),
  along: z.union([z.enum(HOLD_ALONG), z.number().min(0).max(1)]).optional(),
  thumb: z.enum(HOLD_THUMB).optional(),
  slant: z.union([z.enum(HOLD_SLANT), z.number().min(-90).max(90)]).optional(),
  variant: z.string().min(1).optional(),
  psi: z.number().optional(),
  inset: z.number().optional(),
};

/** Tay phụ của `both`: đè từng phần lên chỗ cầm mặc định của nhóm */
export const SupportOverrideSchema = z.strictObject({
  group: z.enum(GROUP_IDS).optional(),
  ...holdPlace,
});
export type SupportOverride = z.infer<typeof SupportOverrideSchema>;

const groupOf = (s: string): string => s.slice(s.indexOf("@") + 1);
const groupName = (g: string) => `\`${g}\` không phải nhóm cầm (${GROUP_IDS.join(", ")})`;

const HoldStringV1 = z.string().regex(/^[^#@]+#[^#@]+$/, { message: "cần dạng `món#kiểu`" });
const HoldStringV2 = z
  .string()
  .regex(/^[^#@]+@[a-zA-Z]+$/, { message: "cần dạng `món@nhóm`" })
  .refine((s) => (GROUP_IDS as readonly string[]).includes(groupOf(s)), {
    message: "tên nhóm cầm không có trong bảng nhóm",
  });
const HoldObjectV1 = z.strictObject({
  item: z.string().min(1),
  grip: z.string().min(1).regex(/^[^@]/, { message: "tên kiểu cầm không bắt đầu bằng `@`" }),
  face: z.union([AxisIntentSchema, IntentTargetSchema]).optional(),
  up: z.union([z.string().min(1), v3]).optional(),
  roll: AxisIntentSchema.optional(),
});
const HoldObjectV2 = z.strictObject({
  item: z.string().min(1),
  group: z.enum(GROUP_IDS),
  ...holdPlace,
  around: z.number().optional(),
  tilt: z.number().optional(),
  face: z.union([AxisIntentSchema, IntentTargetSchema]).optional(),
  up: z.union([z.string().min(1), v3]).optional(),
  roll: AxisIntentSchema.optional(),
  keep: z.literal(true).optional(),
  both: z.union([z.literal(true), SupportOverrideSchema]).optional(),
  touch: z.array(TouchSchema).optional(),
  regrip: z.literal(true).optional(),
  on: z.enum(CARRY_ON).optional(),
  yaw: z.number().optional(),
});

const HOLD_FORMS =
  "chuỗi `món#kiểu`, chuỗi `món@nhóm`, object `{ item, grip, … }` hay object `{ item, group, … }`";

/** Lời báo của `SceneHoldSchema` khi không nhánh nào khớp: nêu đúng dạng người viết đang khai */
function holdFormError(iss: {
  input?: unknown;
  errors?: { path: PropertyKey[]; message: string }[][];
}): string {
  const x = iss.input;
  if (typeof x === "string") {
    if (x.includes("#") && x.includes("@"))
      return `\`${x}\`: chuỗi chỉ có \`#\` (món#kiểu) hoặc \`@\` (món@nhóm), không cả hai`;
    if (x.includes("#")) return `\`${x}\`: cần dạng \`món#kiểu\``;
    if (x.includes("@")) {
      const g = groupOf(x);
      return /^[^#@]+@[a-zA-Z]+$/.test(x) && !(GROUP_IDS as readonly string[]).includes(g)
        ? `\`${x}\`: ${groupName(g)}`
        : `\`${x}\`: cần dạng \`món@nhóm\``;
    }
    return `\`${x}\`: cần dạng \`món#kiểu\` hay \`món@nhóm\``;
  }
  if (x && typeof x === "object" && !Array.isArray(x)) {
    const o = x as Record<string, unknown>;
    const v2 = "group" in o && !("grip" in o);
    const detail = (iss.errors?.[v2 ? 3 : 2] ?? [])
      .map((e) => (e.path.length ? `${e.path.join(".")}: ${e.message}` : e.message))
      .join("; ");
    return `\`hold\` dạng object ${v2 ? "`{ item, group, … }`" : "`{ item, grip, … }`"} sai${detail ? `: ${detail}` : ""}`;
  }
  return `\`hold\` cần ${HOLD_FORMS}`;
}

/**
 * Chỗ cầm của mốc `hold` trong scene, bốn dạng: `món#kiểu` và `{ item, grip, … }` (kiểu cầm của món v1; object đè `face` /
 * `up` / `roll`), `món@nhóm` và `{ item, group, … }` (nhóm cầm của món v2, docs/11-nhom-cam.md mục 4)
 */
export const SceneHoldSchema = z.union([HoldStringV1, HoldStringV2, HoldObjectV1, HoldObjectV2], {
  error: (iss) => (iss.code === "invalid_union" ? holdFormError(iss as never) : undefined),
});
export type SceneHold = z.infer<typeof SceneHoldSchema>;
export type SceneHoldGroup = z.infer<typeof HoldObjectV2>;

/** `"grip"`: kiểu cầm của món v1; `"group"`: nhóm cầm của món v2 */
export const holdKind = (h: SceneHold): "grip" | "group" =>
  typeof h === "string" ? (h.includes("@") ? "group" : "grip") : "group" in h ? "group" : "grip";

/** Chỗ cầm v2 dạng object: chuỗi `món@nhóm` đổi ra `{ item, group }` */
export function groupHold(h: SceneHold): SceneHoldGroup {
  if (typeof h === "object") {
    if ("group" in h) return h;
    throw new Error(`\`${h.item}#${h.grip}\` là kiểu cầm v1, không có nhóm`);
  }
  const i = h.indexOf("@");
  if (i <= 0 || i === h.length - 1 || h.includes("#"))
    throw new Error(`\`${h}\`: cần dạng \`món@nhóm\``);
  const group = h.slice(i + 1);
  if (!(GROUP_IDS as readonly string[]).includes(group))
    throw new Error(`\`${h}\`: ${groupName(group)}`);
  return { item: h.slice(0, i), group: group as GroupId };
}

/** Khoá lần cầm v2: `@nhóm/biến thể/phần/cạnh/ngón cái` (trường thiếu để trống); trường số trượt không vào khoá */
const groupKey = (g: SceneHoldGroup): string =>
  `@${g.group}/${[g.variant, g.part, g.edge, g.thumb].map((v) => v ?? "").join("/")}`;

/** Món và khoá lần cầm của một mốc `hold`: tên kiểu cầm (v1), hay `@nhóm/biến thể/phần/cạnh/ngón cái` (v2) */
export function sceneHoldRef(h: SceneHold): { item: string; grip: string } {
  if (typeof h === "object" && !("group" in h)) return { item: h.item, grip: h.grip };
  if (typeof h === "string" && !h.includes("@")) return holdRef(h);
  const g = groupHold(h);
  return { item: g.item, grip: groupKey(g) };
}

/** Khoá để nối các mốc `hold` liền nhau thành một lần cầm: món và khoá lần cầm (`regrip` do bên gọi xét) */
export const holdRunKey = (h: SceneHold): string => {
  const { item, grip } = sceneHoldRef(h);
  return grip.startsWith("@") ? `${item}${grip}` : `${item}#${grip}`;
};

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
  const g = heldGrip(item, grip);
  if (isCarry(g)) {
    if (typeof h === "object" && (h.face !== undefined || h.up !== undefined || h.roll))
      throw new Error(
        `\`${grip}\` là kiểu treo: món thõng theo trọng lực, không có ý định \`face\` / \`up\` / \`roll\``,
      );
    return {};
  }
  const d = g.intent;
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
