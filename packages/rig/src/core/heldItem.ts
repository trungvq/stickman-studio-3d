import { z } from "zod";
import { BODY_MARKS, PALM_DIR_NAMES, type BodyMark, type PalmDir } from "./bodyMark";
import { HAND_GRIPS, type HandPose } from "./hand";
import type { ActCharacter, Trunk3 } from "./arm3";
import type { GraspChoice, GraspFrame, GraspSolution } from "./graspSolve";
import { topProblems } from "./heldGeom";
import { fromColumns, matMul, matVec, type M3, type V3 } from "./lens";

/**
 * Món cầm tay (`held/<món>.json`): hộp bao, mốc ngữ nghĩa (điểm và pháp tuyến ra ngoài), hình va chạm có nhãn phần, mặt
 * trước, đầu trên, chỗ treo. Chỗ cầm khai ở cảnh theo nhóm cầm (`món@nhóm`). Khung món: trục three (y lên, +z mặt trước
 * món), đơn vị rig (`× 0,01` ra three của người cao 4,3). docs/11-nhom-cam.md mục 2
 */

/** Bản schema món rig hiểu; món không khai `schemaVersion` là bản 1, zod báo lỗi kèm cách chuyển */
export const HELD_VERSION = 2;

const v3 = z.tuple([z.number(), z.number(), z.number()]);

/** Một điểm của món: tên mốc, hay mốc cộng `offset` (đơn vị rig, khung món) */
export type AnchorRef = string | { anchor: string; offset?: V3 };

/** Ngón của bàn tay khi ôm theo đồ: cái, trỏ, giữa, áp út, út */
export const HELD_FINGERS = ["thumb", "index", "middle", "ring", "pinky"] as const;
export type HeldFinger = (typeof HELD_FINGERS)[number];

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

const TouchSchema = z.union([z.string(), z.strictObject({ part: z.string(), max: z.number() })]);

/** Chỗ treo món trên cánh tay của nhóm `carry`: khuỷu gập (quai vắt ở mặt trong khuỷu), đầu vai (quai trên vai, tay ngoài quai) */
export const CARRY_ON = ["elbow", "shoulder"] as const;
export type CarryOn = (typeof CARRY_ON)[number];

/**
 * Lần treo của nhóm `carry` đã quy: món không nằm trong bàn tay mà treo ở `on` — mốc `at` của món (đỉnh quai, `seats[on]`)
 * đặt vào chỗ treo, thân món thõng theo trọng lực mỗi khung, đẩy khỏi thân và đùi theo hình va chạm. Bàn tay của tay ấy
 * theo hành động. `yaw` quay thân món quanh phương đứng (độ), `touch` là phần người được lấn. docs/11-nhom-cam.md mục 3
 */
export interface CarrySpec {
  on: CarryOn;
  at: AnchorRef;
  yaw?: number;
  touch?: z.infer<typeof TouchSchema>[];
}

const AnchorSchema = z.strictObject({ at: v3, dir: v3.optional() });

const pos = z.number().positive();

/** Nhãn phần (`part`) và khối chi tiết (`detail`) của một khối */
const shapeTag = { part: z.string().min(1).optional(), detail: z.literal(true).optional() };

/** Mặt trước, đầu trên: tên mốc có `dir` hay vectơ khung món */
const FrameDirSchema = z.union([z.string().min(1), v3]);

/** Loại khối hình ép cho một phần khi rig suy sai */
export const PART_AS = ["slab", "disc", "rod", "lathe", "box"] as const;

/**
 * Thuộc tính một phần: `grip: false` không được cầm; `as` (+ `axis`) ép loại khối hình, `rod` cần `axis`; `strap: true` là
 * quai của món treo — không tính vào thân món, rig nâng món tới khi quai tựa lên tay, vai
 */
export const HeldPartSchema = z.strictObject({
  grip: z.boolean().optional(),
  strap: z.literal(true).optional(),
  as: z.enum(PART_AS).optional(),
  axis: FrameDirSchema.optional(),
});
export type HeldPart = z.infer<typeof HeldPartSchema>;

/** Chỗ treo của nhóm `carry`: tên mốc đỉnh quai, mặt trong khuỷu / đầu vai */
export const HeldSeatsSchema = z.strictObject({
  elbow: z.string().min(1).optional(),
  shoulder: z.string().min(1).optional(),
});
export type HeldSeats = z.infer<typeof HeldSeatsSchema>;

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

export const HeldItemSchema = z
  .object({
    schemaVersion: z
      .literal(HELD_VERSION, {
        error: (iss) =>
          iss.input === 1
            ? "món cầm bản 1 (kiểu cầm khai theo món) không còn nạp: chuyển món và cảnh bằng `stickman migrate-held` (docs/11-nhom-cam.md mục 8)"
            : "JSON món cầm thuộc phiên bản schema khác; cần bản @stickman3d/rig khớp với nó",
      })
      .default(HELD_VERSION),
    /** Hộp bao, đơn vị rig */
    size: v3,
    anchors: z.record(z.string(), AnchorSchema),
    /** Mặt trước (mốc có `dir` hay vectơ); bỏ trống là `+z` */
    front: FrameDirSchema.optional(),
    /** Đầu trên (mốc có `dir` hay vectơ); bỏ trống là `+y` hay hướng miệng */
    top: FrameDirSchema.optional(),
    /** Thuộc tính phần, khoá là nhãn `part` của khối `shape` */
    parts: z.record(z.string().min(1), HeldPartSchema).optional(),
    /** Chỗ treo của nhóm `carry` */
    seats: HeldSeatsSchema.optional(),
    /** Phần người được lấn vào món khi cầm */
    touch: z.array(TouchSchema).optional(),
    /** Tên nhóm con của món treo theo trọng lực (chùm chìa thõng, dòng rượu rót) */
    hang: z.array(z.string().min(1)).optional(),
    /** Hình va chạm: hợp các khối (`HeldShapeSchema`) — ngón ôm theo đồ, nhóm cầm và luật `held` đo trên nó */
    shape: z.array(HeldShapeSchema).min(1).optional(),
  })
  .superRefine((m, ctx) => {
    const bad = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    m.shape?.forEach((b, i) => {
      if ("box" in b && b.round !== undefined && 2 * b.round > Math.min(...b.box))
        bad(["shape", i, "round"], "bo cạnh quá nửa cạnh ngắn nhất của hộp");
      if ("cyl" in b && Math.hypot(...sub(b.to as V3, b.from as V3)) < 1e-6)
        bad(["shape", i], "trụ có `from` trùng `to`");
      if ("cyl" in b && b.wall !== undefined && b.wall >= Math.min(b.cyl, b.r2 ?? b.cyl))
        bad(["shape", i, "wall"], "thành ống dày hơn bán kính");
    });
    if (!m.shape) bad(["shape"], "món cần `shape` (hình va chạm)");
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
  });
export type HeldItemSpec = z.infer<typeof HeldItemSchema>;

/** Thiếu `schemaVersion` thì là bản 1 (zod báo lỗi kèm cách chuyển); số đã khai giữ nguyên */
export function migrateHeldItem(json: unknown): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json;
  const o = structuredClone(json) as Record<string, unknown>;
  if (typeof o.schemaVersion !== "number") o.schemaVersion = 1;
  return o;
}

export const parseHeldItem = (json: unknown) => HeldItemSchema.safeParse(migrateHeldItem(json));

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

/** Điểm của món (đơn vị rig, khung món): mốc, mốc cộng `offset`, hay toạ độ khung món */
export function heldPoint(item: HeldItemSpec, ref: AnchorRef | V3): V3 {
  if (typeof ref === "string") return [...anchorOf(item, ref).at] as V3;
  if (Array.isArray(ref)) return [...ref] as V3;
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

/** Bàn tay cầm trong khung món: dáng, điểm nắm, lòng tay, ngón; `wrap` là các ngón ôm món (`heldFit`) */
export interface GraspHand {
  pose: HandPose;
  at: V3;
  palm: V3;
  fingers: V3;
  wrap?: HeldFinger[];
}

/** Lòng tay (`palm`) và ngón (`fingers`, trực giao hoá theo lòng tay) của một bàn tay cầm, khung món, đơn vị */
export function gripAxes(h: GraspHand): { palm: V3; fingers: V3; at: V3 } {
  const palm = unit(h.palm);
  const f0 = unit(h.fingers);
  const f = sub(f0, mul(palm, dot(f0, palm)));
  if (Math.hypot(...f) < 1e-3) throw new Error("`palm` và `fingers` song song");
  return { palm, fingers: unit(f), at: [...h.at] };
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
 * Liên kết cứng của bàn tay cầm `h` cho bàn tay bên `side` cỡ `k`, cỡ dọc `long` (đã nhân cỡ người nếu khung bàn tay đo
 * trong thế giới): phép quay đưa `palm` → lòng tay, `fingers` → ngón, rồi dời cho điểm `at` trùng tâm nắm của dáng `pose`.
 * `s` là cỡ người (`world.s`) nhân vào đơn vị của món. Không bao giờ soi gương
 */
export function graspLink(h: GraspHand, side: number, k = 1, long = k, s = 1): GripFrame {
  const { palm, fingers, at } = gripAxes(h);
  const { n, f } = handAxes(side);
  const Mo = fromColumns(palm, fingers, cross(palm, fingers));
  const Mh = fromColumns(n, f, cross(n, f));
  const R = matMul(Mh, tr(Mo));
  const u = 0.01 * s;
  return { R, p: sub(gripCenter(h.pose, side, k, long), mul(matVec(R, at), u)), u };
}

/** Điểm `q` của món (đơn vị rig, khung món) ra khung bàn tay */
export const gripPoint = (G: GripFrame, q: V3): V3 => add(matVec(G.R, mul(q, G.u)), G.p);

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
 * Lần cầm của một bàn tay ở một khung (`Reach.hold` của `world.hands`): món, khoá lần cầm, JSON món, giây bắt đầu cầm. Trong
 * `HOLD_BLEND` giây đầu của lần cầm: `from` là lần cầm trước đó của cùng món trên tay này và phần còn lại của nó (liên kết
 * hoà dần từ chỗ cầm cũ sang chỗ mới), `enter` là phần đã vào của lần cầm (tay phụ hoà dần tới mốc của nó trên món). `prior`
 * là mẫu trước của tay ấy (`HOLD_SLEW_STEP`): cách bao nhiêu giây và tư thế của người ở đó — cổ tay mang món đi từ nghiệm
 * ở đó với tốc độ có hạn. `grasp` là chỗ cầm nhóm (`món@nhóm`); `from.grasp` của lần cầm trước. `solve`: món đặt trước,
 * bàn tay của khung này giải trên nhân vật `c` (thân `T` đã dựng) — `graspAtTime` của scene. `was`: lần cầm liền trước trên
 * tay này còn hoà ra (`HOLD_BLEND`) — món đặt trước, hay tay dẫn của cùng món khi lần cầm mới theo món —, phần còn lại `k`
 * và bàn tay đã vẽ của nó ngay trước ranh giới. `released`: tay đã
 * buông, lần cầm chỉ mang `was` — không vai trò, không món, không dáng ngón
 */
export interface ReachHold {
  item: string;
  grip: string;
  spec: HeldItemSpec;
  since: number;
  from?: { grip: string; k: number; grasp?: HoldGrasp };
  enter?: number;
  prior?: { dt: number; pose: () => object };
  grasp?: HoldGrasp;
  solve?: PlacedSolve;
  was?: { k: number; solve: WasSolve };
  released?: true;
}

/** Bàn tay đã vẽ của lần cầm đang hoà ra, đứng yên ở ngay trước ranh giới: cổ tay, khung bàn tay, khuỷu (three), dáng */
export interface WasHand {
  Wp: V3;
  Rw: M3;
  arm: { elbow: V3 };
  frame: { pose: readonly number[] };
}

/** Bàn tay của lần cầm đang hoà ra (`ReachHold.was`), dựng trên nhân vật `c` */
export type WasSolve = (c: ActCharacter, T?: Trunk3) => WasHand | undefined;

/** Bàn tay cầm món đặt trước ở một khung, giải trên nhân vật `c` (thân `T` đã dựng) */
export type PlacedSolve = (
  c: ActCharacter,
  T?: Trunk3,
) => (GraspSolution & { t0: number }) | undefined;

/**
 * Chỗ cầm nhóm (`món@nhóm`) của một lần cầm ở một khung: `hold` là mốc tay gần nhất dạng object, trường số đã hoà tới khung
 * này; `mode` `item` khi món có mốc ở `items` (bàn tay suy từ món), `hand` khi tay dẫn; `choice` là trường cảnh khai, tay dẫn
 * cộng mặc định của nhóm; lựa chọn rig giải cho món đặt trước ở `graspAtTime`. docs/11-nhom-cam.md mục 4, 5
 */
export interface HoldGrasp {
  hold: SceneHoldGroup;
  mode: "item" | "hand";
  choice: GraspChoice;
  t0: number;
  /** Khung cầm đã giải của món đặt trước (`ReachHold.solve`) */
  frame?: GraspFrame;
  /** Lần cầm một tay theo mốc: bàn tay giải ở từng mốc món, hoà trong hệ thân; món vẽ theo bàn tay đã vẽ */
  keyed?: true;
  /** Lần cầm theo mốc trước mốc nằm đầu hay sau mốc nằm cuối (`rest`): món đứng ở mốc ấy (`GraspSolution.still`), không theo tay */
  rest?: true;
}

/** Tên file của món cho tên thể hiện `món:<tên>` (`vali:2` → `vali`); tên không có `:` là chính nó */
export const heldBase = (item: string): string => {
  const i = item.indexOf(":");
  return i > 0 ? item.slice(0, i) : item;
};

/** Giây hoà khi một tay bắt đầu cầm (tay phụ với tới món) hay đổi chỗ cầm cùng món (liên kết cũ → mới) */
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

const HOLD_STRING = /^[^#@]+@[a-zA-Z]+$/;
const HoldString = z
  .string()
  .refine((s) => HOLD_STRING.test(s) && (GROUP_IDS as readonly string[]).includes(groupOf(s)), {
    error: (iss) => holdFormError({ input: iss.input }),
  });
const HoldObject = z.strictObject({
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

const MIGRATE_HINT = "chuyển cảnh cũ bằng `stickman migrate-held` (docs/11-nhom-cam.md mục 8)";

/** Lời báo của `SceneHoldSchema` khi không nhánh nào khớp: nêu đúng dạng người viết đang khai */
function holdFormError(iss: {
  input?: unknown;
  errors?: { path: PropertyKey[]; message: string }[][];
}): string {
  const x = iss.input;
  if (typeof x === "string") {
    if (x.includes("#"))
      return `\`${x}\`: chỗ cầm khai \`món@nhóm\`, dạng \`món#kiểu\` không còn — ${MIGRATE_HINT}`;
    if (x.includes("@")) {
      const g = groupOf(x);
      return HOLD_STRING.test(x) && !(GROUP_IDS as readonly string[]).includes(g)
        ? `\`${x}\`: ${groupName(g)}`
        : `\`${x}\`: cần dạng \`món@nhóm\``;
    }
    return `\`${x}\`: cần dạng \`món@nhóm\``;
  }
  if (x && typeof x === "object" && !Array.isArray(x)) {
    const o = x as Record<string, unknown>;
    if ("grip" in o && !("group" in o))
      return `\`hold\` khai \`{ item, group, … }\`, dạng \`{ item, grip, … }\` không còn — ${MIGRATE_HINT}`;
    const detail = (iss.errors?.[1] ?? [])
      .map((e) => (e.path.length ? `${e.path.join(".")}: ${e.message}` : e.message))
      .join("; ");
    return `\`hold\` dạng object \`{ item, group, … }\` sai${detail ? `: ${detail}` : ""}`;
  }
  return "`hold` cần chuỗi `món@nhóm` hay object `{ item, group, … }`";
}

/** Chỗ cầm của mốc `hold` trong scene: `món@nhóm` hay `{ item, group, … }` (docs/11-nhom-cam.md mục 4) */
export const SceneHoldSchema = z.union([HoldString, HoldObject], {
  error: (iss) => (iss.code === "invalid_union" ? holdFormError(iss as never) : undefined),
});
export type SceneHold = z.infer<typeof SceneHoldSchema>;
export type SceneHoldGroup = z.infer<typeof HoldObject>;

/** Chỗ cầm dạng object: chuỗi `món@nhóm` đổi ra `{ item, group }` */
export function groupHold(h: SceneHold): SceneHoldGroup {
  if (typeof h === "object") return h;
  const i = h.indexOf("@");
  if (i <= 0 || i === h.length - 1 || h.includes("#"))
    throw new Error(`\`${h}\`: cần dạng \`món@nhóm\``);
  const group = h.slice(i + 1);
  if (!(GROUP_IDS as readonly string[]).includes(group))
    throw new Error(`\`${h}\`: ${groupName(group)}`);
  return { item: h.slice(0, i), group: group as GroupId };
}

/** Khoá lần cầm: `@nhóm/biến thể/phần/cạnh/ngón cái` (trường thiếu để trống); trường số trượt không vào khoá */
const groupKey = (g: SceneHoldGroup): string =>
  `@${g.group}/${[g.variant, g.part, g.edge, g.thumb].map((v) => v ?? "").join("/")}`;

/** Món và khoá lần cầm của một mốc `hold` */
export function sceneHoldRef(h: SceneHold): { item: string; grip: string } {
  const g = groupHold(h);
  return { item: g.item, grip: groupKey(g) };
}

/** Khoá để nối các mốc `hold` liền nhau thành một lần cầm: món và khoá lần cầm (`regrip` do bên gọi xét) */
export const holdRunKey = (h: SceneHold): string => {
  const { item, grip } = sceneHoldRef(h);
  return `${item}${grip}`;
};
