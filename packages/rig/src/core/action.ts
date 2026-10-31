import { z } from "zod";
import { POSE_NAMES, POSES } from "./poses";
import { DEFAULT_FACE } from "./constants";
import { BROW_KINDS, EYE_KINDS, MOUTH_KINDS } from "./face";
import type {
  FaceState,
  HeadPose,
  IdleParams,
  Pose,
  Stretch,
  StretchJson,
  WalkParams,
} from "./types";
import {
  LIFT_CHANNELS,
  REACH_CHANNELS,
  stretchJson,
  stretchSegs,
  type AimMap,
  type HandMap,
  type Lift,
  type Reach,
  type ReachMap,
} from "./types";
import { reachAngles } from "./ik";
import { HAND_POSE_KINDS, HAND_POSES, mixHand, type HandKey } from "./hand";
import { HAND_SHAPE_NAME, handKeyVec, type HandShapes } from "./handLibrary";
import {
  aimDir,
  AimDirSchema,
  BODY_MARKS,
  HAND_POINTS,
  mixTerms,
  type Aim,
  type ReachTerm,
} from "./bodyMark";
import { reachEstimate } from "./act3";
import { SceneHoldSchema } from "./heldItem";
import {
  BASE_ITEM,
  EquipSchema,
  composeEquip,
  dropGoneEquip,
  renameSideEquip,
  renameSideKeys,
  renameSideList,
  equipSteps,
  type Equip,
  type EquipMap,
  type EquipStep,
  type PieceKey,
} from "./schema";
import { DEFAULT_IDLE, idlePose } from "./idle";
import { DEFAULT_WALK, WALK_CYCLE_SECONDS, walkPose } from "./walk";
/** Bump khi đổi hình dạng JSON hành động; `migrateAction` phải có nhánh tương ứng. */
export const ACTION_VERSION = 21;

/** Kênh khớp: thứ có số trong `Pose`; `stretch` là hệ số dài chi, không phải góc */
export const JOINT_CHANNELS = [
  "armLeft",
  "armRight",
  "legLeft",
  "legRight",
  "torso",
  "head",
  "stretch",
] as const;
export type JointChannel = (typeof JOINT_CHANNELS)[number];

/**
 * Kênh mà `mask` gọi tên: sáu khớp cộng `face` — nét mặt đổi được mà không đụng góc đầu — và `hand`: bàn tay của
 * người 3D (xoay cẳng tay, gập cổ tay, ngón), đổi được mà không đụng góc tay
 */
export const CHANNELS = [...JOINT_CHANNELS, "face", "hand"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Bộ sinh chưa cái nào chạm tới đầu, nên mặc định chúng không ghi kênh `head` */
export const GEN_CHANNELS = JOINT_CHANNELS.filter((c) => c !== "head");

/** Hình dạng đường hoà và của `ease: "smooth"`. Một chỗ duy nhất, để studio và Remotion không lệch nhau. */
export const smoothstep = (u: number) => u * u * (3 - 2 * u);

/**
 * Đường đi từ một mốc tới mốc sau; `smooth` chậm vào chậm ra, `auto` bậc ba đơn điệu liền vận tốc qua chuỗi mốc `auto`,
 * `bezier` theo `keys[].bezier`. docs/01-rig.md#hành-động
 */
export const EASE_NAMES = ["linear", "spring", "smooth", "auto", "bezier"] as const;

/**
 * Bối cảnh Studio 3D dựng khi xem thử hành động: đứng, ghế, sàn, ngồi xuống, đứng lên, quầy, ghế bành, ghế kèm bàn.
 * docs/01-rig.md#hành-động
 */
export const PREVIEW_STAGES = [
  "stand",
  "chair",
  "floor",
  "sit-down",
  "stand-up",
  "counter",
  "armchair",
  "desk",
] as const;

/**
 * Mốc chỗ người diễn của cảnh xem thử theo giây của clip: `at` là `[trước, cao]` so với chỗ đứng ban đầu theo hướng mặt,
 * đơn vị rig ở `height = 1`; `sit` thì `cao` là mặt ngồi dưới khớp hông như `world.path[].sit`. docs/01-rig.md#hành-động
 */
const PreviewKeySchema = z.strictObject({
  t: z.number().min(0),
  at: z.tuple([z.number(), z.number()]),
  sit: z.boolean().optional(),
  ease: z.boolean().optional(),
});

/** Món mẫu cầm từ giây 0 của cảnh xem thử, theo tay giải phẫu, cùng dạng `world.hands[].hold` */
const PreviewHoldSchema = z.strictObject({
  right: SceneHoldSchema.optional(),
  left: SceneHoldSchema.optional(),
});

/**
 * Người thứ hai của cảnh xem thử: `at` là `[trước, phải]` so với hông người diễn theo hướng mặt, đơn vị rig ở `height = 1`
 * (mặc định `[220, 0]`, đứng đối diện tầm bắt tay); `yaw` lệch thêm, độ, so với hướng nhìn vào người diễn; `action` là
 * hành động người ấy diễn trên nền `stand-3d`; `hold` là món người ấy cầm từ giây 0, cùng dạng `preview.hold`
 */
export const PreviewPartnerSchema = z.strictObject({
  at: z.tuple([z.number(), z.number()]).optional(),
  yaw: z.number().optional(),
  action: z.string().min(1).optional(),
  hold: PreviewHoldSchema.optional(),
});

/** Đường `cubic-bezier` của CSS khi `bezier` bỏ trống */
export const BEZIER_DEFAULT = [0.42, 0, 0.58, 1] as const;

/** Hai kênh có lớp vẽ riêng cho cẳng tay */
export const ARM_CHANNELS = ["armLeft", "armRight"] as const satisfies readonly Channel[];

export const CHANNEL_LABELS: Record<Channel, string> = {
  armLeft: "tay trái",
  armRight: "tay phải",
  legLeft: "chân trái",
  legRight: "chân phải",
  torso: "thân",
  head: "đầu",
  stretch: "vươn",
  face: "mặt",
  hand: "bàn tay",
};

/**
 * Tên từng số của kênh góc trong `keys[].pose`, theo thứ tự; khớp với schema dưới.
 * docs/01-rig.md#hành-động
 */
export const CHANNEL_PARTS = {
  armLeft: ["vai", "khuỷu", "cổ tay", "dang", "xoắn vai"],
  armRight: ["vai", "khuỷu", "cổ tay", "dang", "xoắn vai"],
  legLeft: ["hông", "gối", "dang"],
  legRight: ["hông", "gối", "dang"],
  torso: ["cúi", "nghiêng"],
  head: ["nghiêng", "lắc", "gật"],
} as const satisfies Partial<Record<JointChannel, readonly string[]>>;

const limb = z.tuple([z.number(), z.number()]);
/**
 * Chân `[hông, gối, dang]`, tay `[vai, khuỷu, cổ tay, dang, xoắn vai]`: cổ tay xoay đồ cầm, rig không vẽ
 * bàn chân; số dang và xoắn vai tuỳ chọn, chỉ người 3D đọc. docs/01-rig.md#dang-và-nghiêng-ngang
 */
const leg = z.union([limb, z.tuple([z.number(), z.number(), z.number()])]);
const arm = z.union([
  z.tuple([z.number(), z.number(), z.number()]),
  z.tuple([z.number(), z.number(), z.number(), z.number()]),
  z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]),
]);
/** Thân `cúi` hay `[cúi, nghiêng ngang]`; nghiêng chỉ người 3D đọc */
const torso = z.union([z.number(), z.tuple([z.number(), z.number()])]);
/** `null` là thành phần hành động không ghi: track dưới giữ nguyên góc ấy. docs/01-rig.md#đầu-và-nét-mặt */
const headPart = z.number().nullable();
const headAngles = z.tuple([headPart, headPart, headPart]);
const factor = z.number().positive();
/**
 * Hệ số dài chi, `1` là chuẩn: bốn số `[tay trái, tay phải, chân trái, chân phải]` cho cả hai đoạn, hoặc
 * tám số từng đoạn, đoạn gốc trước. docs/01-rig.md#vươn-chi
 */
const stretch = z.union([
  z.tuple([factor, factor, factor, factor]),
  z.tuple([factor, factor, factor, factor, factor, factor, factor, factor]),
]);

/**
 * Tư thế một phần: khớp nào không nhắc tới thì hành động này không ghi. `strictObject`: khoá lạ
 * là lỗi chứ không bị lặng lẽ bỏ.
 */
export const PoseDeltaSchema = z.strictObject({
  armLeft: arm.optional(),
  armRight: arm.optional(),
  legLeft: leg.optional(),
  legRight: leg.optional(),
  torso: torso.optional(),
  head: headAngles.optional(),
  stretch: stretch.optional(),
});

export type PoseDelta = z.infer<typeof PoseDeltaSchema>;

/** Tên kênh trong JSON ↔ khoá trong `Pose`; chỗ duy nhất biết cả hai. */
export const poseDelta = (p: Pose): Required<PoseDelta> => ({
  armLeft: p.al,
  armRight: p.ar,
  legLeft: p.ll,
  legRight: p.lr,
  torso: p.lean ? [p.torso, p.lean] : p.torso,
  head: p.head,
  stretch: stretchJson(p.stretch),
});

/** Góc cúi của kênh `torso` trong JSON, bỏ nghiêng ngang */
export const torsoBend = (v: number | readonly number[]): number =>
  typeof v === "number" ? v : (v[0] ?? 0);

const toDelta = poseDelta;

/** Chiều ngược của `poseDelta`; scene cần nó để hoà trong không gian `Pose`. */
export const deltaPose = (d: PoseDelta): Partial<Pose> => {
  const o: Partial<Pose> = {};
  if (d.armLeft) o.al = d.armLeft;
  if (d.armRight) o.ar = d.armRight;
  if (d.legLeft) o.ll = d.legLeft;
  if (d.legRight) o.lr = d.legRight;
  if (d.torso !== undefined) {
    o.torso = torsoBend(d.torso);
    o.lean = typeof d.torso === "number" ? 0 : d.torso[1];
  }
  if (d.head) o.head = d.head.map((v) => v ?? NaN) as HeadPose;
  if (d.stretch) o.stretch = stretchSegs(d.stretch);
  return o;
};

/** Nét mặt kể từ mốc này, kênh `face`: kiểu nét không nội suy, `blush` nội suy như góc */
const FaceSchema = z.object({
  mouth: z.enum(MOUTH_KINDS).optional(),
  brow: z.enum(BROW_KINDS).optional(),
  eyes: z.enum(EYE_KINDS).optional(),
  /** Má ửng `0..1` cộng vào `face.blush` của nhân vật, kẹp ở `1` */
  blush: z.number().min(0).max(1).optional(),
});

/** Tên dáng tay: có sẵn (`HAND_POSE_KINDS`) hay tên file `hands/<tên>.json` của thư viện, `resolveScene` tra */
const HandShapeRefSchema = z.union([
  z.enum(HAND_POSE_KINDS),
  z.string().regex(HAND_SHAPE_NAME, {
    error: () => "tên dáng tay: dáng có sẵn của rig hay tên file `hands/<tên>.json` (`[a-z0-9-]`)",
  }),
]);

/**
 * Bàn tay của một kênh tay kể từ mốc này: tên dáng (`HAND_POSE_KINDS` hay của thư viện `hands/`), hay
 * `{ pose, w, turn, bend }` — dáng hoà từ dáng nghỉ theo `w`, bỏ trống `pose` là dáng nghỉ; xoay cẳng tay `turn` (dương
 * sấp) và gập cổ tay `bend` (dương về lòng tay) trong `±90`. Nội suy như góc. `palm` / `fingers` khai lòng tay, ngón quay
 * về đâu: người 3D tự giải xoay và gập cổ tay, `turn` bị bỏ qua, `bend` khai kèm thì giữ cố định.
 * docs/01-rig.md#bàn-tay, docs/01-rig.md#hướng-lòng-tay-theo-ý
 */
const HandKeySchema = z.union([
  HandShapeRefSchema,
  z.strictObject({
    pose: HandShapeRefSchema.optional(),
    w: z.number().min(0).max(1).optional(),
    turn: z.number().min(-90).max(90).optional(),
    bend: z.number().min(-90).max(90).optional(),
    palm: AimDirSchema.optional(),
    fingers: AimDirSchema.optional(),
  }),
]);

/**
 * Một mốc sự kiện: pha mà *việc* xảy ra — lưỡi rìu chạm gỗ, bàn chân chạm đất. Không ghi
 * khớp nào, chỉ đặt tên cho một con số mà trước đây mỗi repo video phải tự đo lại.
 */
const EventSchema = z.object({
  name: z.string().min(1),
  t: z.number().min(0).max(1).describe("Tỉ lệ chu kỳ như `keys[].t`, không phải giây"),
});

export type ActionEvent = z.infer<typeof EventSchema>;

const v3 = z.tuple([z.number(), z.number(), z.number()]);

/**
 * Đích bàn tay: toạ độ `at` hệ thân `[tiến, y, ra ngoài]` đơn vị rig ở `height = 1`, gốc tâm hông, `y` xuống là dương,
 * `ra ngoài` dương về phía chính tay ấy — hay mốc thân `to` (`BODY_MARKS`) trên chính người ấy, `side` chọn bên mốc,
 * `offset` dời khỏi mốc theo khung phần người mang mốc (rig, không nhân `height`). `point` là điểm bàn tay đặt vào đích:
 * thiếu là cổ tay với `at`, giữa lòng tay với `to`. `elbow` hướng khuỷu hệ thân. docs/01-rig.md#đích-bàn-tay,
 * docs/01-rig.md#đích-theo-mốc
 */
export const ReachSchema = z
  .object({
    at: v3.optional(),
    to: z.enum(BODY_MARKS).optional(),
    side: z.enum(["same", "other"]).optional(),
    offset: v3.optional(),
    point: z.enum(HAND_POINTS).optional(),
    elbow: v3.optional(),
  })
  .refine((r) => !!r.at !== !!r.to, {
    message: "đích bàn tay cần đúng một trong `at` (toạ độ hệ thân) hay `to` (mốc thân)",
  })
  .refine((r) => !!r.to || (r.side === undefined && r.offset === undefined), {
    message: "`side`, `offset` chỉ đi với `to`",
  });

export type ReachJson = z.infer<typeof ReachSchema>;

/** Số hạng của một đích JSON: toạ độ thô với điểm khác cổ tay, hay mốc thân; toạ độ cổ tay thì không có */
export const reachTerm = (
  r: Omit<ReachJson, "point"> & { point?: ReachTerm["point"] },
): ReachTerm | undefined =>
  r.to
    ? {
        k: 1,
        to: r.to,
        ...(r.side && { side: r.side }),
        ...(r.offset && { offset: [...r.offset] as [number, number, number] }),
        ...(r.point && { point: r.point }),
      }
    : r.point && r.point !== "wrist"
      ? { k: 1, at: [...r.at!] as [number, number, number], point: r.point }
      : undefined;

const unit = z.number().min(0).max(1);
/** `[x1, y1, x2, y2]` của `ease: "bezier"`, bốn số trong `[0, 1]`; bỏ trống là `BEZIER_DEFAULT` */
export const BezierSchema = z.tuple([unit, unit, unit, unit]);

const KeySchema = z.object({
  /** Tỉ lệ chu kỳ, không phải giây */
  t: z.number().min(0).max(1),
  /** Tên pose hay góc của người */
  pose: z.union([z.enum(POSE_NAMES), PoseDeltaSchema]),
  /**
   * Đích cổ tay của kênh tay (thay cho góc tay ở người 3D): rig giải IK hai đoạn. `pose` không ghi góc kênh ấy thì
   * kênh nhận góc suy từ đích trong mặt phẳng dọc (`reachAngles`). docs/01-rig.md#đích-bàn-tay
   */
  reach: z.object({ armLeft: ReachSchema.optional(), armRight: ReachSchema.optional() }).optional(),
  /** Áp cho đoạn từ mốc này tới mốc sau */
  ease: z.enum(EASE_NAMES).default("linear"),
  bezier: BezierSchema.optional(),
  /** Đổi nét mặt kể từ mốc này; không nội suy, chỉ ăn khi `face` nằm trong mặt nạ */
  face: FaceSchema.optional(),
  /** Bàn tay người 3D theo kênh tay, nội suy; chỉ ăn khi `hand` nằm trong mặt nạ */
  hand: z
    .object({ armLeft: HandKeySchema.optional(), armRight: HandKeySchema.optional() })
    .optional(),
  /** Đổi đồ kể từ mốc này; công tắc, không nội suy và không đi qua mặt nạ. docs/01-rig.md */
  equip: EquipSchema.optional(),
});

export type ActionKey = z.infer<typeof KeySchema>;

export interface GenParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  def: number;
}

export interface Generator {
  label: string;
  params: GenParam[];
  pose: (t: number, p: Record<string, number>) => Pose;
}

/** Bộ sinh dựng sẵn: studio đọc `params` để tự dựng slider, JSON chỉ chứa giá trị. */
export const GENERATORS: Record<string, Generator> = {
  walkCycle: {
    label: "Chu kỳ đi",
    params: [
      { key: "hip", label: "Sải chân", min: 0, max: 45, def: DEFAULT_WALK.hip },
      { key: "knee", label: "Gập gối", min: 0, max: 110, def: DEFAULT_WALK.knee },
      {
        key: "stance",
        label: "Thời gian trụ",
        min: 0.3,
        max: 0.8,
        step: 0.01,
        def: DEFAULT_WALK.stance,
      },
      { key: "arm", label: "Vung tay", min: 0, max: 60, def: DEFAULT_WALK.arm },
      { key: "elbow", label: "Gập khuỷu", min: 0, max: 110, def: DEFAULT_WALK.elbow },
      { key: "lean", label: "Ngả người", min: -10, max: 15, def: DEFAULT_WALK.lean },
      { key: "crouch", label: "Khom người", min: 0, max: 45, def: DEFAULT_WALK.crouch },
      { key: "clear", label: "Nhấc chân", min: 0, max: 30, def: DEFAULT_WALK.clear },
      { key: "dip", label: "Cúi theo bước", min: 0, max: 8, step: 0.1, def: DEFAULT_WALK.dip },
    ],
    pose: (t, p) => walkPose(t, { ...DEFAULT_WALK, ...p } as WalkParams),
  },
  idleSway: {
    label: "Đứng thở",
    params: [
      { key: "breath", label: "Nhịp thở", min: 0, max: 8, step: 0.5, def: DEFAULT_IDLE.breath },
      { key: "arm", label: "Tay nhích", min: 0, max: 12, def: DEFAULT_IDLE.arm },
      { key: "lean", label: "Ngả người", min: -10, max: 15, def: DEFAULT_IDLE.lean },
    ],
    pose: (t, p) => idlePose(t, { ...DEFAULT_IDLE, ...p } as IdleParams),
  },
};

export const genDefaults = (gen: string): Record<string, number> =>
  Object.fromEntries((GENERATORS[gen]?.params ?? []).map((p) => [p.key, p.def]));

/** Hành động dùng chung cho mọi nhân vật; scene ghép tên nhân vật + tên hành động. docs/01-rig.md */
export const ActionSchema = z
  .object({
    schemaVersion: z
      .literal(ACTION_VERSION, {
        error: "JSON hành động thuộc phiên bản schema khác; cần bản @stickman3d/rig khớp với nó",
      })
      .default(ACTION_VERSION),
    name: z.string().default("action"),
    /** Giây cho một lượt `t: 0 → 1`; chỉ là nhịp mặc định, scene đè được */
    duration: z.number().positive().default(WALK_CYCLE_SECONDS),
    /** Lấy mẫu qua mốc cuối: `wrap` vòng về mốc đầu, `hold` giữ nguyên mốc cuối */
    end: z.enum(["wrap", "hold"]).default("wrap"),
    /** Khớp mà hành động này ghi; bỏ trống thì suy ra từ các mốc */
    mask: z.array(z.enum(CHANNELS)).optional(),
    gen: z.string().optional(),
    params: z.record(z.string(), z.number()).optional(),
    /**
     * Góc nhìn mà hành động được soạn để xem. `side`: người 3D (`cast[].world`) đọc góc tay chân
     * như nằm trong mặt phẳng dọc của thân và chiếu thật; bỏ trống là kênh không nâng, người 3D vẽ tay chân ở dáng nghỉ.
     * docs/01-rig.md#người-3d
     */
    authoredAt: z.enum(["side"]).optional(),
    /**
     * Cố ý giật (giật mình, đập bàn): `check` không đo giật tay chân ở kênh hành động này ghi suốt lúc
     * clip của nó chạy, kể cả đoạn hoà vào và ra. docs/03-scene.md#giật-trên-hình
     */
    snap: z.boolean().optional(),
    keys: z.array(KeySchema).min(1).optional(),
    /** Pha va chạm, đặt tên; `sceneEvents` đổi ra giây scene. docs/01-rig.md */
    events: z.array(EventSchema).default([]),
    /** Ghi chú cách dùng cho người soạn cảnh; rig không đọc, giữ nguyên khi xuất */
    note: z.string().optional(),
    /**
     * Cách Studio 3D xem thử, rig không đọc: `base` là hành động nền chồng dưới, bỏ trống thì suy theo `stage`; `hold` là
     * món mẫu cầm trong tay phải / trái giải phẫu từ giây 0 (như `world.hands[].hold`); `partner` là người thứ hai đứng ở
     * chỗ hành động vươn tới; `path` là chỗ người diễn theo giây của clip, cho hành động dời hông (nhổm, đứng dậy từ sàn).
     * docs/01-rig.md#hành-động
     */
    preview: z
      .object({
        base: z.string().optional(),
        stage: z.enum(PREVIEW_STAGES).optional(),
        hold: PreviewHoldSchema.optional(),
        partner: PreviewPartnerSchema.optional(),
        path: z.array(PreviewKeySchema).min(2).optional(),
      })
      .optional(),
  })
  .superRefine((a, ctx) => {
    a.preview?.path?.forEach((k, i, ks) => {
      if (i && k.t <= ks[i - 1].t)
        ctx.addIssue({
          code: "custom",
          message: "`preview.path[].t` phải tăng dần",
          path: ["preview", "path", i, "t"],
        });
    });
    if (!a.gen === !a.keys)
      ctx.addIssue({ code: "custom", message: "Cần đúng một trong `gen` hoặc `keys`" });
    if (a.gen && !GENERATORS[a.gen])
      ctx.addIssue({ code: "custom", message: `Không có bộ sinh \`${a.gen}\``, path: ["gen"] });
    a.keys?.forEach((k, i) => {
      if (i > 0 && k.t <= a.keys![i - 1].t)
        ctx.addIssue({ code: "custom", message: "`t` phải tăng dần", path: ["keys", i, "t"] });
    });
  });

export type ActionData = z.infer<typeof ActionSchema>;

/** Nâng JSON đời cũ lên `ACTION_VERSION`. File mới hơn thì trả nguyên để zod báo lỗi. */
export function migrateAction(json: unknown): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json;
  const o = structuredClone(json) as Record<string, unknown>;
  const from = typeof o.schemaVersion === "number" ? o.schemaVersion : 0;
  if (from > ACTION_VERSION) return o;
  // v1 chỉ mô tả được chu kỳ đi, và đo nhịp bằng `rate` thay vì giây; nhận ra nó qua hai trường đó
  if (from < 2 && (o.walk !== undefined || o.rate !== undefined)) {
    const rate = typeof o.rate === "number" && o.rate > 0 ? o.rate : 100;
    o.gen = "walkCycle";
    o.params = { ...genDefaults("walkCycle"), ...((o.walk as object) ?? {}) };
    o.duration = +((WALK_CYCLE_SECONDS * 100) / rate).toFixed(4);
    o.end = "wrap";
    delete o.walk;
    delete o.rate;
  }
  // v20 → v21 kênh tay chân theo phải / trái của người (`armNear` → `armRight`, `armFar` → `armLeft`, chân như thế), bỏ
  // `sides`: kênh không còn đổi theo ống kính
  if (from < 21) {
    o.mask = renameSideList(o.mask);
    if (o.mask === undefined) delete o.mask;
    delete o.sides;
    for (const k of (o.keys ?? []) as Record<string, unknown>[]) {
      if (!k || typeof k !== "object") continue;
      for (const f of ["pose", "reach", "hand"]) renameSideKeys(k[f]);
    }
  }
  // v3 → v4 thêm kênh `head` và `keys[].face`; thiếu thì đầu đứng yên, nét mặt do scene quyết
  // v5 → v6 thêm `keys[].show`; v6 → v7 nó thành `keys[].equip`, tắt socket là gán `null`
  // v7 → v8 thêm `events[]`; thiếu nó là hành động không đặt tên pha nào, không phải viết gì
  // v8 → v9 tách kênh `face` khỏi `head`: mốc đổi nét mặt xưa ăn theo `head` trong mặt nạ
  // v9 → v10 thêm `actor`, `airborne`, mốc và `mask` của động vật; thiếu là hành động của người như cũ
  // v10 → v11 thêm kênh `stretch`; thiếu là chi dài chuẩn, không phải viết gì
  // v11 → v12 `stretch` nhận thêm tám số từng đoạn; bốn số cũ vẫn hợp lệ, không phải đổi
  // v12 → v13 thêm `keys[].reach`; thiếu là tay theo góc như cũ
  // v13 → v14 thêm `ease: "smooth"` và thành phần `null` của `head`; file cũ không dùng, không phải viết gì
  // v14 → v15 thêm `snap`; thiếu là chuyển động không cố ý giật, `check` đo như mọi hành động
  // v15 → v16 thêm số dang của tay chân và `torso: [cúi, nghiêng]`; thiếu là `0`, không phải viết gì
  // v16 → v17 thêm `keys[].face.blush`; thiếu là má không ửng thêm, không phải viết gì
  // v17 → v18 thêm số xoắn vai của tay, `keys[].hand` và kênh `hand`; thiếu là `0` và bàn tay thả lỏng, không phải viết gì
  // v18 → v19 `keys[].reach` nhận mốc thân (`to`) và điểm bàn tay (`point`), `keys[].hand` nhận `palm` / `fingers`, sáu dáng tay mới; file cũ không dùng, không phải viết gì
  // v19 → v20 thêm `ease: "auto"`, `ease: "bezier"` và `keys[].bezier`; file cũ không dùng, không phải viết gì
  // v4 → v5 tay thành ba số; file cũ cầm đồ thẳng trục cẳng tay, tức cổ tay 0
  if (from < 5)
    for (const k of (o.keys ?? []) as Record<string, unknown>[]) {
      const pose = k?.pose;
      if (!pose || typeof pose !== "object") continue;
      for (const c of ARM_CHANNELS) {
        const v = (pose as Record<string, unknown>)[c];
        if (Array.isArray(v) && v.length === 2) v.push(0);
      }
    }
  if (
    from < 9 &&
    Array.isArray(o.mask) &&
    o.mask.includes("head") &&
    !o.mask.includes("face") &&
    ((o.keys ?? []) as Record<string, unknown>[]).some((k) => k?.face)
  )
    o.mask = [...o.mask, "face"];
  if (from < 7)
    for (const k of (o.keys ?? []) as Record<string, unknown>[]) {
      const show = k?.show;
      if (!show || typeof show !== "object") continue;
      k.equip = Object.fromEntries(
        Object.entries(show as Record<string, boolean>).map(([sock, on]) => [
          sock,
          on ? BASE_ITEM : null,
        ]),
      );
      delete k.show;
    }
  for (const k of (o.keys ?? []) as Record<string, unknown>[]) {
    if (from < 21) renameSideEquip(k?.equip);
    dropGoneEquip(k?.equip);
  }
  o.schemaVersion = ACTION_VERSION;
  return o;
}

export const defaultAction = (): ActionData =>
  ActionSchema.parse({ name: "walk", gen: "walkCycle", params: genDefaults("walkCycle") });

export const parseAction = (json: unknown) => ActionSchema.safeParse(migrateAction(json));

/** Góc mà một mốc ghi; mốc gọi tên pose thì trải ra đủ mọi kênh. */
export const keyDelta = (k: ActionKey): PoseDelta =>
  typeof k.pose === "string" ? toDelta(POSES[k.pose]) : (k.pose as PoseDelta);

/** Nét mặt mà một mốc ghi; pose trong thư viện không mang nét mặt nào. */
export const keyFace = (k: ActionKey): Partial<FaceState> => k.face ?? {};

/** Bàn tay mà một mốc ghi theo kênh tay; pose trong thư viện không mang bàn tay nào. */
export const keyHand = (
  k: ActionKey,
): Partial<Record<(typeof ARM_CHANNELS)[number], string | HandKey>> => k.hand ?? {};

/** Tên dáng tay của thư viện `hands/` mà các mốc `keys[].hand` gọi (không kể dáng có sẵn), mỗi tên một lần */
export function actionHandShapes(a: ActionData): string[] {
  const out = new Set<string>();
  for (const k of a.keys ?? [])
    for (const h of Object.values(keyHand(k))) {
      const name = typeof h === "string" ? h : h?.pose;
      if (name !== undefined && !(name in HAND_POSES)) out.add(name);
    }
  return [...out];
}

/** Dáng tay của thư viện mà hành động gọi nhưng `lib` không có, mỗi dáng một câu */
export const actionHandShapeProblems = (a: ActionData, lib: HandShapes): string[] =>
  actionHandShapes(a)
    .filter((n) => !(n in lib))
    .map(
      (n) =>
        `\`keys[].hand\` gọi dáng tay \`${n}\` — không phải dáng có sẵn của rig (\`HAND_POSES\`), không có \`hands/${n}.json\` (docs/01-rig.md#dáng-tay-có-tên)`,
    );

/** Đồ mà một mốc đổi; pose trong thư viện không đụng tới mảnh nào. */
export const keyEquip = (k: ActionKey): Equip | undefined => k.equip;

/** Khớp mà hành động ghi: `mask` nếu có, không thì hợp của các khớp được nhắc tới. */
export function actionMask(a: ActionData): Channel[] {
  if (a.mask) return a.mask;
  if (!a.keys) return GEN_CHANNELS;
  const seen = new Set<Channel>();
  for (const k of a.keys) {
    for (const c of Object.keys(keyDelta(k)) as Channel[]) seen.add(c);
    for (const c of Object.keys(k.reach ?? {}) as Channel[]) seen.add(c);
  }
  // Mốc đổi nét mặt ghi vào `face`, không đụng góc đầu: hành động nhép miệng không cần khai `mask`
  if (a.keys.some((k) => Object.keys(keyFace(k)).length)) seen.add("face");
  if (a.keys.some((k) => Object.keys(keyHand(k)).length)) seen.add("hand");
  return CHANNELS.filter((c) => seen.has(c));
}

const spring = (u: number) => 1 - Math.exp(-6 * u) * Math.cos(9 * u);

/** `cubic-bezier(x1, y1, x2, y2)` của CSS: giải `x(s) = u` bằng Newton, chia đôi khi Newton không hội tụ, trả `y(s)` */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (p1: number, p2: number, s: number) =>
    3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s;
  const slope = (p1: number, p2: number, s: number) =>
    3 * (1 - s) * (1 - s) * p1 + 6 * (1 - s) * s * (p2 - p1) + 3 * s * s * (1 - p2);
  return (u: number): number => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let s = u;
    for (let i = 0; i < 8; i++) {
      const e = at(x1, x2, s) - u;
      if (Math.abs(e) < 1e-7) return at(y1, y2, s);
      const d = slope(x1, x2, s);
      if (Math.abs(d) < 1e-6) break;
      s -= e / d;
    }
    let lo = 0;
    let hi = 1;
    s = u;
    for (let i = 0; i < 40; i++) {
      if (at(x1, x2, s) < u) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return at(y1, y2, s);
  };
}

const EASES: Record<Exclude<ActionKey["ease"], "bezier">, (u: number) => number> = {
  linear: (u) => u,
  // Chuẩn hoá để vẫn chạm đúng mốc sau ở u = 1
  spring: (u) => spring(u) / spring(1),
  smooth: smoothstep,
  // Kiểu không nội suy bằng số thì `auto` lùi về smoothstep — đúng `auto` của hai mốc đơn lẻ
  auto: smoothstep,
};

/** Phần hoà ở `u` 0–1 theo `ease` của mốc; `bezier` thiếu điểm điều khiển thì lấy `BEZIER_DEFAULT` */
export function easeAt(k: Pick<ActionKey, "ease" | "bezier">, u: number) {
  if (k.ease !== "bezier") return EASES[k.ease](u);
  const [x1, y1, x2, y2] = k.bezier ?? BEZIER_DEFAULT;
  return cubicBezier(x1, y1, x2, y2)(u);
}

/** Tiếp tuyến PCHIP ở một mốc giữa hai độ dốc kề: trung bình điều hoà theo độ dài đoạn, trái dấu thì `0` */
export const pchipSlope = (d0: number, d1: number, h0: number, h1: number) => {
  if (!(d0 * d1 > 0)) return 0;
  const w1 = 2 * h1 + h0;
  const w2 = h1 + 2 * h0;
  return (w1 + w2) / (w1 / d0 + w2 / d1);
};

/** Hermite đơn điệu đoạn `p1 → p2` dài `h`; `p0` / `p3` vắng là đầu chuỗi, tiếp tuyến `0` */
export function hermite(
  p0: number | undefined,
  p1: number,
  p2: number,
  p3: number | undefined,
  h0: number,
  h: number,
  h2: number,
  f: number,
) {
  const d = (p2 - p1) / h;
  const m1 = p0 === undefined ? 0 : pchipSlope((p1 - p0) / h0, d, h0, h);
  const m2 = p3 === undefined ? 0 : pchipSlope(d, (p3 - p2) / h2, h, h2);
  const f2 = f * f;
  const f3 = f2 * f;
  return (
    (2 * f3 - 3 * f2 + 1) * p1 +
    (f3 - 2 * f2 + f) * h * m1 +
    (3 * f2 - 2 * f3) * p2 +
    (f3 - f2) * h * m2
  );
}

/** `hermite` từng thành phần; `p0` / `p3` vắng là đầu chuỗi */
export const hermiteN = (
  p0: readonly number[] | undefined,
  p1: readonly number[],
  p2: readonly number[],
  p3: readonly number[] | undefined,
  h0: number,
  h: number,
  h2: number,
  f: number,
): number[] => p1.map((v, i) => hermite(p0?.[i], v, p2[i], p3?.[i], h0, h, h2, f));

/** Bốn mốc quanh đoạn đang lấy mẫu cho `ease: "auto"`; mốc ngoài vắng khi chuỗi `auto` dừng ở đó */
type Cubic<T> = (
  p0: T | undefined,
  p1: T,
  p2: T,
  p3: T | undefined,
  h0: number,
  h: number,
  h2: number,
  f: number,
) => T;

/** `auto` cho số và dãy, từng thành phần; phần thiếu là `0` như `mixAngles` */
const cubicAngles: Cubic<Angles> = (p0, p1, p2, p3, h0, h, h2, f) => {
  if (typeof p1 === "number" && typeof p2 === "number")
    return hermite(
      p0 === undefined ? undefined : typeof p0 === "number" ? p0 : (p0[0] ?? 0),
      p1,
      p2,
      p3 === undefined ? undefined : typeof p3 === "number" ? p3 : (p3[0] ?? 0),
      h0,
      h,
      h2,
      f,
    );
  const arr = (v: Angles) => (typeof v === "number" ? [v] : v);
  const [w, x, y, z] = [p0 && arr(p0), arr(p1), arr(p2), p3 && arr(p3)];
  return Array.from({ length: Math.max(x.length, y.length) }, (_, i) =>
    hermite(w && (w[i] ?? 0), x[i] ?? 0, y[i] ?? 0, z && (z[i] ?? 0), h0, h, h2, f),
  );
};

type Angles = number | readonly number[];

/** Số và dãy nội suy chung được: số là dãy một phần tử, phần thiếu (dang, nghiêng ngang) là `0` */
export function mixAngles(a: number, b: number, f: number): number;
export function mixAngles(a: Angles, b: Angles, f: number): Angles;
export function mixAngles(a: Angles, b: Angles, f: number): Angles {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * f;
  const x = typeof a === "number" ? [a] : a;
  const y = typeof b === "number" ? [b] : b;
  return Array.from({ length: Math.max(x.length, y.length) }, (_, i) => {
    const p = x[i] ?? 0;
    return p + ((y[i] ?? 0) - p) * f;
  });
}
const mix = mixAngles;

/** Pha `[0, 1]` để lấy mẫu: `wrap` vòng lại, `hold` kẹp ở mốc cuối thay vì nhảy về mốc đầu. */
export const phaseOf = (a: ActionData, t: number): number =>
  a.end === "hold" ? Math.min(1, Math.max(0, t)) : t - Math.floor(t);

/** Nội suy một kênh giữa hai mốc gần nhất *có nhắc tới nó*, không phải hai mốc kề nhau. */
const sampleChannel = (a: ActionData, pick: (k: ActionKey) => Angles | undefined, u: number) =>
  sampleWith(a, pick, u, mix, cubicAngles);

/**
 * `cubic` cho `ease: "auto"` trên kiểu số; thiếu nó thì `auto` là smoothstep. Chuỗi `auto` gồm các mốc *có nhắc tới
 * kênh*, nối qua đường vòng khi `end: "wrap"`; mốc trùng pha qua đường vòng (`t: 1` với `t: 0`) tính là một.
 */
function sampleWith<T>(
  a: ActionData,
  pick: (k: ActionKey) => T | undefined,
  u: number,
  mix: (a: T, b: T, f: number) => T,
  cubic?: Cubic<T>,
): T | undefined {
  const s: { t: number; v: T; key: ActionKey }[] = [];
  for (const k of a.keys!) {
    const v = pick(k);
    if (v !== undefined) s.push({ t: k.t, v, key: k });
  }
  if (!s.length) return undefined;
  if (s.length === 1) return s[0].v;

  const n = s.length;
  const wrap = a.end !== "hold";
  let i = n - 1;
  if (u < s[0].t || u >= s[n - 1].t) {
    if (!wrap) return u < s[0].t ? s[0].v : s[n - 1].v;
  } else for (let k = 0; k < n - 1; k++) if (s[k].t <= u) i = k;
  const j = (i + 1) % n;
  const gap = (x: number, y: number) => s[y].t - s[x].t + (y <= x ? 1 : 0);
  const span = gap(i, j);
  const f = span > 0 ? (u - s[i].t + (u < s[i].t ? 1 : 0)) / span : 0;
  if (s[i].key.ease !== "auto" || !cubic || !(span > 0))
    return mix(s[i].v, s[j].v, span > 0 ? easeAt(s[i].key, f) : 0);

  // Mốc kề có đoạn dài hơn 0 về một phía; `ease` là của mốc mở đoạn ấy
  const step = (x: number, dir: 1 | -1) => {
    for (let y = x, m = 0; m < n; m++) {
      const z = y + dir;
      if (!wrap && (z < 0 || z >= n)) return undefined;
      const w = (z + n) % n;
      const h = dir > 0 ? gap(x, w) : gap(w, x);
      if (h > 0 && w !== x) return { w, h, ease: s[dir > 0 ? y : w].key.ease };
      y = w;
    }
    return undefined;
  };
  const prev = step(i, -1);
  const next = step(j, 1);
  const p0 = prev?.ease === "auto" ? prev : undefined;
  const p3 = next?.ease === "auto" ? next : undefined;
  return cubic(p0 && s[p0.w].v, s[i].v, s[j].v, p3 && s[p3.w].v, p0?.h ?? 1, span, p3?.h ?? 1, f);
}

/** Giá trị không nội suy được tại pha `u`: mốc gần nhất *trước* `u` có nhắc tới nó. */
function sampleStep<T>(
  a: ActionData,
  pick: (k: ActionKey) => T | undefined,
  u: number,
): T | undefined {
  const s = a.keys!.flatMap((k) => {
    const v = pick(k);
    return v === undefined ? [] : [{ t: k.t, v }];
  });
  if (!s.length) return undefined;
  // Trước mốc đầu: `wrap` vòng về mốc cuối, `hold` giữ mốc đầu
  let cur = a.end === "hold" ? s[0] : s[s.length - 1];
  for (const e of s) if (e.t <= u) cur = e;
  return cur.v;
}

/** Nét mặt mà hành động ghi tại pha `t`; kênh `face`, ngoài mặt nạ thì bỏ trống. Kiểu nét bậc thang, `blush` nội suy. */
export function actionFace(a: ActionData, t: number): Partial<FaceState> {
  if (!a.keys || !actionMask(a).includes("face")) return {};
  const u = phaseOf(a, t);
  const o: Partial<FaceState> = {};
  for (const f of ["mouth", "brow", "eyes"] as const) {
    const v = sampleStep(a, (k) => keyFace(k)[f], u);
    if (v !== undefined) Object.assign(o, { [f]: v });
  }
  const blush = sampleWith(
    a,
    (k) => keyFace(k).blush,
    u,
    (x, y, f) => x + (y - x) * f,
    hermite,
  );
  if (blush !== undefined) o.blush = blush;
  return o;
}

/**
 * Bàn tay mà hành động ghi tại pha `t` theo kênh tay (số theo `HAND_DOF`, dáng của thư viện `lib` kèm `HAND_FIT`), kênh
 * `hand`: mỗi mốc ra số của nó (`handKeyVec`) rồi nội suy như góc, theo `ease`. Ngoài mặt nạ thì bỏ trống.
 */
export function actionHand(a: ActionData, t: number, lib: HandShapes = {}): HandMap {
  if (!a.keys || !actionMask(a).includes("hand")) return {};
  const u = phaseOf(a, t);
  const o: HandMap = {};
  for (const ch of REACH_CHANNELS) {
    const c = REACH_OF[ch];
    const v = sampleWith<readonly number[]>(
      a,
      (k) => {
        const h = keyHand(k)[c];
        return h === undefined ? undefined : handKeyVec(h, lib);
      },
      u,
      mixHand,
      cubicAngles as Cubic<readonly number[]>,
    );
    if (v) o[ch] = v;
  }
  return o;
}

/**
 * Mốc bàn tay của hành động có hiệu lực ở pha `t` theo kênh tay, nguyên như file (tên dáng hay `{ pose, w, turn, bend,
 * palm, fingers }`): mốc gần nhất không sau pha ấy có nhắc kênh ấy. Ngoài mặt nạ hay kênh không có mốc thì `undefined`
 */
export function actionHandKey(
  a: ActionData,
  t: number,
  ch: (typeof REACH_CHANNELS)[number],
): string | HandKey | undefined {
  if (!a.keys || !actionMask(a).includes("hand")) return undefined;
  return sampleStep(a, (k) => keyHand(k)[REACH_OF[ch]], phaseOf(a, t));
}

/**
 * Đồ mà hành động đổi tính tới pha `t`. **Không đi qua `mask`** — mặc gì không phải khớp,
 * nên thu hẹp `mask` ở scene vẫn giữ nguyên phần đổi đồ. Trả về cả chuỗi bước chứ không
 * gộp sẵn: tên bộ đồ chỉ trải ra được khi đã biết ai diễn.
 */
export function actionEquip(a: ActionData, t: number): EquipStep[] {
  if (!a.keys) return [];
  const u = phaseOf(a, t);
  const s = a.keys.flatMap((k) => (k.equip === undefined ? [] : [{ t: k.t, v: k.equip }]));
  if (!s.length) return [];
  const done = s.filter((e) => e.t <= u);
  // `wrap`: mốc sau `u` là của lượt trước nên đứng đầu; `hold` chưa tới mốc nào thì giữ mốc đầu
  const prior = a.end === "hold" ? (done.length ? [] : [s[0]]) : s.filter((e) => e.t > u);
  return composeEquip(...[...prior, ...done].map((e) => e.v));
}

/** Socket → vật đang chiếm lúc pha `t`, đã gộp; bước gọi tên bộ đồ thì phải có nhân vật mới trải. */
const equipAt = (a: ActionData, t: number): EquipMap =>
  Object.assign({}, ...actionEquip(a, t).filter((s) => typeof s !== "string")) as EquipMap;

/**
 * Socket mà `keys[].equip` nhắc tới nhưng **trạng thái không đổi frame nào**. `end` giữ
 * mốc cuối sang lượt sau, nên một mốc `{ handFar: null }` ở `t: 0.45` là mảnh tắt sẵn từ
 * đầu chu kỳ — không hiện ra ở đâu cả. Mốc duy nhất ở `t: 0` thì không tính: đó là hành
 * động một mốc đặt đồ cố định (`mask: []`), một cách viết có chủ ý. docs/03-scene.md
 */
export function equipSwitchProblems(a: ActionData): string[] {
  const keys = (a.keys ?? []).filter((k) => k.equip !== undefined);
  // Bước gọi tên bộ đồ chỉ trải ra socket khi có JSON nhân vật, mà ở đây thì chưa có
  if (!keys.length || keys.some((k) => equipSteps(k.equip).some((s) => typeof s === "string")))
    return [];
  const socks = new Set<PieceKey>();
  for (const k of keys)
    for (const step of equipSteps(k.equip))
      for (const s of Object.keys(step as EquipMap)) socks.add(s as PieceKey);
  // Hàm bậc thang chỉ đổi ở mốc, nên lấy mẫu ở `0` và ở từng mốc là đủ thấy hết trạng thái
  const states = [equipAt(a, 0), ...keys.map((k) => equipAt(a, k.t))];
  const bad: string[] = [];
  for (const k of socks) {
    if (states.some((s) => s[k] !== states[0][k])) continue;
    if (!keys.some((key) => key.t > 0 && equipSteps(key.equip).some((s) => k in (s as EquipMap))))
      continue;
    const v = states[0][k];
    bad.push(
      `\`${k}\` giữ nguyên \`${v === null ? "null" : v}\` suốt chu kỳ — công tắc một chiều, \`end: "${a.end}"\` đã đặt sẵn giá trị ấy từ lượt trước; thiếu mốc ngược lại ở \`t: 0\``,
    );
  }
  return bad;
}

/**
 * Tay giơ quá ngang (`|vai| > 120`) mà khuỷu ngược dấu vai: cẳng tay quay ngược chiều vai
 * vừa quét lên, khuỷu gập ra ngoài. Dấu vai là chiều quét (slider tới `±270°` là vì thế), nên
 * cùng dấu là cẳng tay cuộn tiếp về phía đầu. Kênh ngoài `mask` không vẽ ra, không soi.
 * docs/00-bat-bien.md#dấu-góc-và-hình-học
 */
export function armFoldProblems(a: ActionData): string[] {
  const mask = actionMask(a);
  const bad: string[] = [];
  for (const k of a.keys ?? []) {
    const d = keyDelta(k);
    for (const c of ARM_CHANNELS) {
      const v = d[c];
      if (!v || !mask.includes(c)) continue;
      const [shoulder, elbow] = v;
      if (Math.abs(shoulder) <= 120 || elbow === 0 || Math.sign(elbow) === Math.sign(shoulder))
        continue;
      bad.push(
        `mốc \`t: ${k.t}\`: \`${c}\` [${v.join(", ")}] — vai giơ quá 120° mà khuỷu ngược dấu vai, cẳng tay gập ra ngoài; khuỷu cùng dấu vai mới cuộn về phía đầu`,
      );
    }
  }
  return bad;
}

/**
 * Kênh mà mốc ghi nhưng `mask` không gọi tên: giá trị bị vứt im lặng — nụ cười khai ở
 * `keys[].face` mà `mask` thiếu `face` thì không bao giờ hiện. `mask` bỏ trống thì suy từ
 * chính các mốc, không rơi gì; mốc gọi tên pose thì đủ mọi kênh và `mask` cắt là cố ý.
 */
export function maskProblems(a: ActionData): string[] {
  const mask = a.mask;
  if (!mask || !a.keys) return [];
  const dropped = new Map<Channel, number[]>();
  const note = (c: Channel, t: number) => {
    if (mask.includes(c)) return;
    if (!dropped.has(c)) dropped.set(c, []);
    dropped.get(c)?.push(t);
  };
  for (const k of a.keys) {
    if (typeof k.pose !== "string") for (const c of Object.keys(k.pose) as Channel[]) note(c, k.t);
    if (Object.keys(keyFace(k)).length) note("face", k.t);
    if (Object.keys(keyHand(k)).length) note("hand", k.t);
    for (const c of Object.keys(k.reach ?? {}) as Channel[]) note(c, k.t);
  }
  return [...dropped].map(
    ([c, ts]) =>
      `\`${c}\` ghi ở mốc t: ${ts.join(", ")} mà không nằm trong \`mask\` — giá trị bị bỏ im lặng; thêm \`${c}\` vào \`mask\` hoặc xoá khỏi mốc`,
  );
}

/** Socket mà `keys[].equip` của hành động này ghi vào; bước gọi tên bộ đồ không đếm được. */
export function equipSockets(a: ActionData): PieceKey[] {
  const socks = new Set<PieceKey>();
  for (const k of a.keys ?? [])
    for (const step of equipSteps(k.equip))
      if (typeof step !== "string") for (const s of Object.keys(step)) socks.add(s as PieceKey);
  return [...socks];
}

/** Mốc sự kiện, sắp theo pha; `sceneEvents` đổi chúng ra giây scene. */
export const actionEvents = (a: ActionData): ActionEvent[] =>
  [...a.events].sort((x, y) => x.t - y.t);

/** Ghép nét mặt như `composePose`; hành động không ghi thì để `DEFAULT_FACE`. */
export const composeFace = (...parts: Partial<FaceState>[]): FaceState =>
  Object.assign({}, DEFAULT_FACE, ...parts) as FaceState;

/** Như `actionPose` nhưng giữ tên kênh của JSON. */
export function actionDelta(a: ActionData, t: number): PoseDelta {
  const u = phaseOf(a, t);
  const mask = actionMask(a);
  const joints = JOINT_CHANNELS.filter((c) => mask.includes(c));
  if (a.gen) {
    const g = GENERATORS[a.gen];
    if (!g) return {};
    const full = toDelta(g.pose(u, { ...genDefaults(a.gen), ...a.params }));
    return Object.fromEntries(joints.map((c) => [c, full[c]]));
  }
  const d: PoseDelta = {};
  for (const c of joints) {
    // Mỗi góc đầu nội suy riêng giữa các mốc có ghi nó: mốc ghi `null` là bỏ qua góc ấy
    if (c === "head") {
      const h = [0, 1, 2].map(
        (i) => sampleChannel(a, (k) => keyDelta(k).head?.[i] ?? undefined, u) as number | undefined,
      );
      if (h.some((v) => v !== undefined)) d.head = h.map((v) => v ?? null) as PoseDelta["head"];
      continue;
    }
    // Mốc bốn số và mốc tám số nội suy chung được: trải hết ra tám số
    const v = sampleChannel(
      a,
      (k) => {
        const d = keyDelta(k);
        const x = d[c];
        if (c === "stretch" && x) return stretchSegs(x as StretchJson);
        const r = (c === "armLeft" || c === "armRight") && k.reach?.[c];
        // Mốc chỉ khai đích tay thì góc cúi thân lấy từ các mốc khác của kênh `torso` tại pha ấy
        const lean = () => {
          const v = d.torso ?? sampleChannel(a, (q) => keyDelta(q).torso, k.t);
          return v === undefined ? undefined : torsoBend(v);
        };
        if (x !== undefined || !r) return x as Angles | undefined;
        return reachAngles({ at: reachEstimate(r, lean()), elbow: r.elbow }, lean());
      },
      u,
    );
    if (v !== undefined) Object.assign(d, { [c]: c === "stretch" ? stretchJson(v as Stretch) : v });
  }
  return d;
}

const REACH_OF = { al: "armLeft", ar: "armRight" } as const;

type ReachSample = {
  w: number;
  at: Reach["at"];
  elbow?: Reach["elbow"];
  elbowW?: number;
  terms?: ReachTerm[];
};

/** Số hạng của một đích: đích chỉ có toạ độ cổ tay là một số hạng thô */
const termsOf = (r: Pick<Reach, "at" | "terms">): ReachTerm[] =>
  r.terms ?? [{ k: 1, at: [...r.at] as [number, number, number] }];

/**
 * Hoà hai đích: phần `w` nội suy thẳng; bên không có đích (`w` 0) mượn chỗ của bên kia. Có số hạng (mốc thân, điểm bàn
 * tay) thì hoà trên số hạng (`mixTerms`): người 3D giải từng số hạng rồi cộng theo phần, cổ tay đi liền
 */
export function mixReach<T extends Reach | ReachSample>(
  a: T | undefined,
  b: T | undefined,
  f: number,
) {
  const wa = a?.w ?? 0;
  const wb = b?.w ?? 0;
  const w = wa + (wb - wa) * f;
  if (!(w > 0) || (!a && !b)) return undefined;
  const p = wa > 0 ? a! : b!;
  const q = wb > 0 ? b! : a!;
  const lerp = (x: readonly number[], y: readonly number[]) =>
    x.map((v, i) => v + (y[i] - v) * f) as [number, number, number];
  // một bên không khai hướng khuỷu: hướng của bên kia, phần `elbowW` nhạt dần về khuỷu ưu tiên của cổ tay
  const ea = p.elbow ?? q.elbow;
  const eb = q.elbow ?? p.elbow;
  const part = (r: T) => (r.elbow ? (r.elbowW ?? 1) : 0);
  const ew = part(p) + (part(q) - part(p)) * f;
  return {
    w,
    at: lerp(p.at, q.at),
    ...(ea && eb && { elbow: lerp(ea, eb), ...(ew < 1 && { elbowW: ew }) }),
    ...((p.terms || q.terms) && { terms: mixTerms(termsOf(p), termsOf(q), f) }),
  };
}

/**
 * Đích cổ tay hệ thân mà hành động ghi tại pha `t`, theo kênh trong mặt nạ. Mốc nhắc kênh tay bằng góc
 * mà không có đích là `w` 0: đi từ mốc có đích sang mốc góc thì đích nhạt dần, rig hoà vị trí.
 */
export function actionReach(a: ActionData, t: number): ReachMap {
  if (!a.keys) return {};
  const u = phaseOf(a, t);
  const mask = actionMask(a);
  const o: ReachMap = {};
  for (const ch of REACH_CHANNELS) {
    const c = REACH_OF[ch];
    if (!mask.includes(c) || !a.keys.some((k) => k.reach?.[c])) continue;
    const v = sampleWith<ReachSample>(
      a,
      (k) => {
        const r = k.reach?.[c];
        if (r) {
          const term = reachTerm(r);
          return {
            w: 1,
            at: reachEstimate(r),
            ...(r.elbow && { elbow: r.elbow }),
            ...(term && { terms: [term] }),
          };
        }
        return keyDelta(k)[c] ? { w: 0, at: [0, 0, 0] } : undefined;
      },
      u,
      (x, y, f) =>
        mixReach(x, y, f) ?? {
          w: 0,
          at: x.at,
          ...(x.elbow && { elbow: x.elbow, ...(x.elbowW !== undefined && { elbowW: x.elbowW }) }),
        },
    );
    if (v && v.w > 0) o[ch] = v;
  }
  return o;
}

/** Tư thế của hành động tại pha `t` (`0 → 1` là một lượt); chỉ trả về các khớp nó ghi. */
export function actionPose(a: ActionData, t: number): Partial<Pose> {
  const p = deltaPose(actionDelta(a, t));
  const reach = actionReach(a, t);
  if (Object.keys(reach).length) p.reach = reach;
  const hand = actionHand(a, t);
  if (Object.keys(hand).length) p.hand = hand;
  const aim = actionAim(a, t);
  if (Object.keys(aim).length) p.aim = aim;
  return p;
}

/** Bàn tay theo ý định của số bàn tay thô: một số hạng `raw` (xoay, gập cổ tay) */
export const rawAim = (v: readonly number[]): Aim => ({
  terms: [{ k: 1, raw: [v[0] ?? 0, v[1] ?? 0] }],
});

/** Hoà hai bàn tay theo ý định trên số hạng: người 3D giải từng ý định rồi cộng góc theo phần */
export const mixAim = (a: Aim, b: Aim, f: number): Aim => ({
  terms: mixTerms(a.terms, b.terms, f),
});

/** Bàn tay theo ý định của một mốc: `palm` / `fingers` là một số hạng ý định, không thì xoay và gập thô */
export function keyAim(h: string | HandKey): Aim {
  if (typeof h === "string") return rawAim([0, 0]);
  if (!h.palm && !h.fingers) return rawAim([h.turn ?? 0, h.bend ?? 0]);
  return {
    terms: [
      {
        k: 1,
        ...(h.palm && { palm: aimDir(h.palm) }),
        ...(h.fingers && { fingers: aimDir(h.fingers) }),
        ...(h.bend !== undefined && { bend: h.bend }),
      },
    ],
  };
}

/**
 * Lòng tay theo ý định mà hành động ghi tại pha `t`, theo kênh tay: chỉ kênh có mốc khai `palm` / `fingers`; mốc khác của
 * kênh ấy là số hạng thô, nên đi từ mốc thô sang mốc ý định là cổ tay xoay dần. Ngoài mặt nạ thì bỏ trống.
 */
export function actionAim(a: ActionData, t: number): AimMap {
  if (!a.keys || !actionMask(a).includes("hand")) return {};
  const u = phaseOf(a, t);
  const o: AimMap = {};
  for (const ch of REACH_CHANNELS) {
    const c = REACH_OF[ch];
    const keyed = a.keys.some((k) => {
      const h = keyHand(k)[c];
      return typeof h === "object" && !!(h.palm || h.fingers);
    });
    if (!keyed) continue;
    const v = sampleWith<Aim>(
      a,
      (k) => {
        const h = keyHand(k)[c];
        return h === undefined ? undefined : keyAim(h);
      },
      u,
      mixAim,
    );
    if (v) o[ch] = v;
  }
  return o;
}

/** Mốc bàn tay khai cả `turn` lẫn `palm` / `fingers`: `turn` bị bỏ qua — `validate` và `check` kêu */
export function aimProblems(a: ActionData): string[] {
  const out: string[] = [];
  for (const k of a.keys ?? [])
    for (const [c, h] of Object.entries(keyHand(k)))
      if (typeof h === "object" && (h.palm || h.fingers) && h.turn !== undefined)
        out.push(
          `\`keys[t: ${k.t}].hand.${c}\` khai cả \`turn\` lẫn \`${h.palm ? "palm" : "fingers"}\`: rig tự giải xoay cẳng tay theo hướng đã khai, \`turn\` bị bỏ qua — xoá \`turn\` (docs/01-rig.md#hướng-lòng-tay-theo-ý)`,
        );
  return out;
}

/** Khoá `Pose` của bốn chi, theo thứ tự cặp số trong `Stretch` */
const STRETCH_LIMBS = ["al", "ar", "ll", "lr"] as const;

/**
 * Hệ số `stretch` của chi thứ `i` trong `p` có hiệu lực không: `p` ghi cả chi ấy, hoặc `p` không
 * ghi chi nào — hành động chỉ vươn thì phủ cả bốn chi. docs/01-rig.md#vươn-chi
 */
export const stretchOwns = (p: Partial<Pose>, i: number): boolean =>
  !!p.stretch &&
  (p[STRETCH_LIMBS[i]] !== undefined || STRETCH_LIMBS.every((k) => p[k] === undefined));

/** `stretch` của `base` đè bằng của `p` ở những chi `p` ghi */
export function stretchOver(base: Stretch, p: Partial<Pose>): Stretch {
  if (!p.stretch) return base;
  const s = p.stretch;
  return base.map((v, j) => (stretchOwns(p, j >> 1) ? s[j] : v)) as Stretch;
}

/**
 * `head` của `base` đè bằng của `p` ở những góc `p` ghi. `deltaPose` đổi `null` của JSON thành `NaN`:
 * nghiêng đầu khi nói không xoá cái lắc của `turn-head-*` ở track dưới.
 */
export function headOver(base: HeadPose, p: Partial<Pose>): HeadPose {
  if (!p.head) return base;
  return p.head.map((v, i) => (Number.isNaN(v) ? base[i] : v)) as HeadPose;
}

/**
 * Ghép lên tư thế nền: hành động sau đè hành động trước ở đúng khớp nó ghi. `stretch` đè theo từng
 * chi, như `stretchOver`: tay gõ phím vươn tay mà không xoá hệ số chân của hành động ngồi; `head`
 * đè theo từng góc, như `headOver`.
 */
export const composePose = (base: Pose, ...parts: Partial<Pose>[]): Pose =>
  parts.reduce<Pose>((o, p) => {
    const out = { ...o, ...p, stretch: stretchOver(o.stretch, p), head: headOver(o.head, p) };
    // Nghiêng ngang đi cùng kênh `torso`: lớp trên ghi thân mà không nghiêng là thân thẳng
    if (p.torso !== undefined) out.lean = p.lean ?? 0;
    // Kênh `p` ghi mà không mang cờ nâng là kênh không nâng, dù lớp dưới đã nâng
    if (o.lift || p.lift) {
      const lift: Lift = { ...o.lift };
      for (const k of LIFT_CHANNELS) if (p[k]) lift[k] = !!p.lift?.[k];
      out.lift = lift;
    }
    // Đích cổ tay đi theo kênh tay: lớp trên ghi tay bằng góc là xoá đích của lớp dưới
    if (o.reach || p.reach) {
      const reach: ReachMap = {};
      for (const k of REACH_CHANNELS) {
        const r = p[k] ? p.reach?.[k] : o.reach?.[k];
        if (r) reach[k] = r;
      }
      if (Object.keys(reach).length) out.reach = reach;
      else delete out.reach;
    }
    // Thứ tự giải hai tay theo lớp trên cùng ghi tay
    if (p.ar || p.al) {
      if (p.mirror) out.mirror = true;
      else delete out.mirror;
    }
    // Bàn tay đè theo từng kênh tay: track chỉ ghi tay phải không xoá bàn tay trái của track dưới
    if (o.hand || p.hand) out.hand = { ...o.hand, ...p.hand };
    // Lòng tay theo ý định đi theo bàn tay: lớp trên ghi bàn tay thô là xoá ý định của lớp dưới
    if (o.aim || p.aim) {
      const aim: AimMap = {};
      for (const k of REACH_CHANNELS) {
        const a = p.hand?.[k] ? p.aim?.[k] : o.aim?.[k];
        if (a) aim[k] = a;
      }
      if (Object.keys(aim).length) out.aim = aim;
      else delete out.aim;
    }
    return out;
  }, base);

/** Thay mốc gọi tên pose bằng số, trong phạm vi mặt nạ. Xuất ra file thì đóng băng. */
export function freezeAction(a: ActionData): ActionData {
  if (!a.keys) return a;
  const mask = actionMask(a);
  const joints = JOINT_CHANNELS.filter((c) => mask.includes(c));
  return {
    ...a,
    keys: a.keys.map((k) => {
      if (typeof k.pose !== "string") return k;
      return {
        ...k,
        pose: Object.fromEntries(joints.map((c) => [c, keyDelta(k)[c]])) as PoseDelta,
      };
    }),
  };
}
