import { z } from "zod";
import { POSE_LAYERS, POSE_NAMES, POSES } from "./poses";
import { ARM_LAYERS, DEFAULT_FACE, DEFAULT_LAYERS } from "./constants";
import { BROW_KINDS, EYE_KINDS, MOUTH_KINDS } from "./face";
import type {
  Arm,
  ArmLayers,
  FaceState,
  HeadPose,
  IdleParams,
  Limb,
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
  type Lift,
  type Reach,
  type ReachMap,
} from "./types";
import { REACH_ELBOW, reachAngles } from "./ik";
import {
  BASE_ITEM,
  EquipSchema,
  composeEquip,
  equipSteps,
  type Equip,
  type EquipMap,
  type EquipStep,
  type PieceKey,
} from "./schema";
import { DEFAULT_IDLE, idlePose } from "./idle";
import { DEFAULT_WALK, WALK_CYCLE_SECONDS, walkPose } from "./walk";
import {
  ANIMAL_CHANNELS,
  ANIMAL_JOINT_CHANNELS,
  animalChannelKey,
  type AnimalChannel,
  type AnimalData,
  type AnimalFace,
  type AnimalPose,
} from "./animals";
import {
  ANIMAL_FLY,
  ANIMAL_FLY_SECONDS,
  ANIMAL_IDLE,
  ANIMAL_IDLE_SECONDS,
  ANIMAL_RUN,
  ANIMAL_RUN_SECONDS,
  ANIMAL_WALK,
  ANIMAL_WALK_SECONDS,
  animalFlyPose,
  animalIdlePose,
  animalRunPose,
  animalWalkPose,
  type AnimalFlyParams,
  type AnimalGaitParams,
  type AnimalIdleParams,
} from "./animalGait";

/** Bump khi đổi hình dạng JSON hành động; `migrateAction` phải có nhánh tương ứng. */
export const ACTION_VERSION = 14;

/** Kênh khớp: thứ có số trong `Pose`; `stretch` là hệ số dài chi, không phải góc */
export const JOINT_CHANNELS = [
  "armFar",
  "armNear",
  "legFar",
  "legNear",
  "torso",
  "head",
  "stretch",
] as const;
export type JointChannel = (typeof JOINT_CHANNELS)[number];

/** Kênh mà `mask` gọi tên: sáu khớp cộng `face` — nét mặt đổi được mà không đụng góc đầu */
export const CHANNELS = [...JOINT_CHANNELS, "face"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Bộ sinh chưa cái nào chạm tới đầu, nên mặc định chúng không ghi kênh `head` */
export const GEN_CHANNELS = JOINT_CHANNELS.filter((c) => c !== "head");

/** Hình dạng đường hoà và của `ease: "smooth"`. Một chỗ duy nhất, để studio và Remotion không lệch nhau. */
export const smoothstep = (u: number) => u * u * (3 - 2 * u);

/** Đường đi từ một mốc tới mốc sau; `smooth` chậm vào chậm ra, không vọt qua mốc. docs/01-rig.md#hành-động */
export const EASE_NAMES = ["linear", "spring", "smooth"] as const;

/** Hai kênh có lớp vẽ riêng cho cẳng tay */
export const ARM_CHANNELS = ["armFar", "armNear"] as const satisfies readonly Channel[];

export const CHANNEL_LABELS: Record<Channel, string> = {
  armFar: "tay xa",
  armNear: "tay gần",
  legFar: "chân xa",
  legNear: "chân gần",
  torso: "thân",
  head: "đầu",
  stretch: "vươn",
  face: "mặt",
};

const limb = z.tuple([z.number(), z.number()]);
/** Tay có ba số vì cổ tay xoay được đồ cầm; chân chỉ hai — rig không vẽ bàn chân */
const arm = z.tuple([z.number(), z.number(), z.number()]);
/** `null` là thành phần hành động không ghi: track dưới giữ nguyên góc ấy. docs/01-rig.md#đầu-và-nét-mặt */
const headPart = z.number().nullable();
const headAngles = z.tuple([headPart, headPart, headPart]);
const factor = z.number().positive();
/**
 * Hệ số dài chi, `1` là chuẩn: bốn số `[tay xa, tay gần, chân xa, chân gần]` cho cả hai đoạn, hoặc
 * tám số từng đoạn, đoạn gốc trước. docs/01-rig.md#vươn-chi
 */
const stretch = z.union([
  z.tuple([factor, factor, factor, factor]),
  z.tuple([factor, factor, factor, factor, factor, factor, factor, factor]),
]);

/**
 * Tư thế một phần: khớp nào không nhắc tới thì hành động này không ghi. `strictObject` vì
 * mốc động vật đi chung một ô `pose`: khoá lạ phải rơi sang schema kia chứ không bị lặng lẽ bỏ.
 */
export const PoseDeltaSchema = z.strictObject({
  armFar: arm.optional(),
  armNear: arm.optional(),
  legFar: limb.optional(),
  legNear: limb.optional(),
  torso: z.number().optional(),
  head: headAngles.optional(),
  stretch: stretch.optional(),
});

export type PoseDelta = z.infer<typeof PoseDeltaSchema>;

/**
 * Tư thế một phần của động vật, tên kênh như `ANIMAL_JOINT_CHANNELS`. `spine` / `neck` /
 * `head` / `tail` / `wing` là độ dốc cộng thêm vào dốc nghỉ của con vật; chân là góc tuyệt đối.
 */
export const AnimalPoseDeltaSchema = z.strictObject({
  spine: z.number().optional(),
  neck: z.number().optional(),
  head: z.number().optional(),
  tail: limb.optional(),
  wing: limb.optional(),
  legFrontNear: limb.optional(),
  legFrontFar: limb.optional(),
  legHindNear: limb.optional(),
  legHindFar: limb.optional(),
});

export type AnimalPoseDelta = z.infer<typeof AnimalPoseDeltaSchema>;

/** Mọi tên kênh mà `mask` nhận, của cả người lẫn động vật; bộ nào hợp lệ thì tuỳ ai diễn */
export const MASK_CHANNELS = [
  ...CHANNELS,
  ...ANIMAL_JOINT_CHANNELS.filter((c) => c !== "head"),
] as unknown as readonly [Channel | AnimalChannel, ...(Channel | AnimalChannel)[]];
export type MaskChannel = Channel | AnimalChannel;

/** Tên kênh trong JSON ↔ khoá trong `Pose`; chỗ duy nhất biết cả hai. */
export const poseDelta = (p: Pose): Required<PoseDelta> => ({
  armFar: p.af,
  armNear: p.an,
  legFar: p.lf,
  legNear: p.ln,
  torso: p.torso,
  head: p.head,
  stretch: stretchJson(p.stretch),
});

const toDelta = poseDelta;

/** Chiều ngược của `poseDelta`; scene cần nó để hoà trong không gian `Pose`. */
export const deltaPose = (d: PoseDelta): Partial<Pose> => {
  const o: Partial<Pose> = {};
  if (d.armFar) o.af = d.armFar;
  if (d.armNear) o.an = d.armNear;
  if (d.legFar) o.lf = d.legFar;
  if (d.legNear) o.ln = d.legNear;
  if (d.torso !== undefined) o.torso = d.torso;
  if (d.head) o.head = d.head.map((v) => v ?? NaN) as HeadPose;
  if (d.stretch) o.stretch = stretchSegs(d.stretch);
  return o;
};

/** Lớp cẳng tay; mốc không nhắc tới thì giữ lớp của mốc trước đó. */
const LayerSchema = z.object({
  armFar: z.enum(ARM_LAYERS).optional(),
  armNear: z.enum(ARM_LAYERS).optional(),
});

/** Nét mặt kể từ mốc này; đi cùng kênh `head`, không nội suy */
const FaceSchema = z.object({
  mouth: z.enum(MOUTH_KINDS).optional(),
  brow: z.enum(BROW_KINDS).optional(),
  eyes: z.enum(EYE_KINDS).optional(),
});

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
 * Đích cổ tay hệ thân: `at` `[tiến, y, ra ngoài]` đơn vị rig ở `height = 1`, gốc tâm hông, `y` xuống
 * là dương, `ra ngoài` dương về phía chính tay ấy; `elbow` hướng khuỷu cùng hệ. docs/01-rig.md#đích-bàn-tay
 */
export const ReachSchema = z.object({ at: v3, elbow: v3.optional() });

const KeySchema = z.object({
  /** Tỉ lệ chu kỳ, không phải giây */
  t: z.number().min(0).max(1),
  /** Tên pose hay góc của người; hành động của động vật (`actor: "animal"`) ghi góc động vật */
  pose: z.union([z.enum(POSE_NAMES), PoseDeltaSchema, AnimalPoseDeltaSchema]),
  /**
   * Đích cổ tay của kênh tay (thay cho góc tay ở người 3D): rig giải IK hai đoạn. Người 2D vẽ góc dự
   * phòng suy từ đích trong mặt phẳng dọc, trừ khi `pose` ghi góc kênh ấy. docs/01-rig.md#đích-bàn-tay
   */
  reach: z.object({ armFar: ReachSchema.optional(), armNear: ReachSchema.optional() }).optional(),
  /** Áp cho đoạn từ mốc này tới mốc sau */
  ease: z.enum(EASE_NAMES).default("linear"),
  /** Đổi lớp vẽ kể từ mốc này; không nội suy */
  layer: LayerSchema.optional(),
  /** Đổi nét mặt kể từ mốc này; không nội suy, chỉ ăn khi `face` nằm trong mặt nạ */
  face: FaceSchema.optional(),
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

/**
 * Bộ sinh dáng động vật. Khác `Generator` ở chỗ nó **nhận cả con vật**: sải chân và độ nhấc
 * chân khai theo chiều cao hông, nên một file `animal-walk.json` đúng cho cả ngựa lẫn
 * voi. docs/08-dong-vat.md
 */
export interface AnimalGenerator {
  label: string;
  params: GenParam[];
  /** Nhịp mặc định của một lượt, giây */
  duration: number;
  /** Không bàn chân nào chạm đất: scene treo con vật ở hông, trôi ngang bằng `path` */
  airborne?: boolean;
  pose: (t: number, p: Record<string, number>, b: AnimalData) => AnimalPose;
}

const gaitParams = (d: AnimalGaitParams): GenParam[] => [
  { key: "stride", label: "Sải chân", min: 0.2, max: 2.4, step: 0.05, def: d.stride },
  { key: "lift", label: "Nhấc chân", min: 0, max: 0.8, step: 0.02, def: d.lift },
  { key: "duty", label: "Nhịp đạp", min: 0.3, max: 0.9, step: 0.01, def: d.duty },
  { key: "bob", label: "Nhún thân", min: 0, max: 0.3, step: 0.01, def: d.bob },
  { key: "sway", label: "Chồm thân", min: 0, max: 20, step: 0.5, def: d.sway },
  { key: "nod", label: "Gật cổ", min: 0, max: 25, def: d.nod },
  { key: "swish", label: "Vẫy đuôi", min: 0, max: 30, def: d.swish },
];

export const ANIMAL_GENERATORS: Record<string, AnimalGenerator> = {
  animalWalk: {
    label: "Động vật đi",
    params: gaitParams(ANIMAL_WALK),
    duration: ANIMAL_WALK_SECONDS,
    pose: (t, p, b) => animalWalkPose(t, { ...ANIMAL_WALK, ...p } as AnimalGaitParams, b),
  },
  animalRun: {
    label: "Động vật chạy",
    params: gaitParams(ANIMAL_RUN),
    duration: ANIMAL_RUN_SECONDS,
    pose: (t, p, b) => animalRunPose(t, { ...ANIMAL_RUN, ...p } as AnimalGaitParams, b),
  },
  animalFly: {
    label: "Động vật bay",
    params: [
      { key: "flap", label: "Biên độ vỗ", min: 0, max: 90, def: ANIMAL_FLY.flap },
      { key: "raise", label: "Dốc cánh", min: -60, max: 120, def: ANIMAL_FLY.raise },
      { key: "lag", label: "Chóp trễ", min: 0, max: 80, def: ANIMAL_FLY.lag },
      { key: "sway", label: "Chồm thân", min: 0, max: 20, step: 0.5, def: ANIMAL_FLY.sway },
      { key: "tuck", label: "Xếp chân", min: -120, max: 30, def: ANIMAL_FLY.tuck },
      { key: "curl", label: "Gập gối", min: -60, max: 200, def: ANIMAL_FLY.curl },
      { key: "swish", label: "Vẫy đuôi", min: 0, max: 30, def: ANIMAL_FLY.swish },
    ],
    duration: ANIMAL_FLY_SECONDS,
    airborne: true,
    pose: (t, p, b) => animalFlyPose(t, { ...ANIMAL_FLY, ...p } as AnimalFlyParams, b),
  },
  animalIdle: {
    label: "Động vật đứng thở",
    params: [
      { key: "breath", label: "Nhịp thở", min: 0, max: 6, step: 0.5, def: ANIMAL_IDLE.breath },
      { key: "nod", label: "Gật cổ", min: 0, max: 25, def: ANIMAL_IDLE.nod },
      { key: "swish", label: "Vẫy đuôi", min: 0, max: 30, def: ANIMAL_IDLE.swish },
      { key: "wing", label: "Nhích cánh", min: 0, max: 30, def: ANIMAL_IDLE.wing },
    ],
    duration: ANIMAL_IDLE_SECONDS,
    pose: (t, p, b) => animalIdlePose(t, { ...ANIMAL_IDLE, ...p } as AnimalIdleParams, b),
  },
};

/**
 * Ai diễn được hành động này. Có bộ sinh thì suy từ tên nó — một cái tên chỉ nằm trong đúng
 * một bảng; hành động mốc thì `actor` nói, bỏ trống là của người.
 */
export const actionKind = (a: Pick<ActionData, "gen" | "actor">): "character" | "animal" =>
  a.gen ? (ANIMAL_GENERATORS[a.gen] ? "animal" : "character") : (a.actor ?? "character");

/** Không bàn chân nào chạm đất suốt hành động: `airborne` của file, không thì của bộ sinh. */
export const actionAirborne = (a: ActionData): boolean =>
  actionKind(a) === "animal" &&
  (a.airborne ?? (a.gen ? (ANIMAL_GENERATORS[a.gen]?.airborne ?? false) : false));

export const genDefaults = (gen: string): Record<string, number> =>
  Object.fromEntries(
    (GENERATORS[gen]?.params ?? ANIMAL_GENERATORS[gen]?.params ?? []).map((p) => [p.key, p.def]),
  );

/** Hành động dùng chung cho mọi nhân vật; scene ghép tên nhân vật + tên hành động. docs/01-rig.md */
export const ActionSchema = z
  .object({
    schemaVersion: z
      .literal(ACTION_VERSION, {
        error: "JSON hành động thuộc phiên bản schema khác; cần bản @stickman3d/sketch khớp với nó",
      })
      .default(ACTION_VERSION),
    name: z.string().default("action"),
    /** Giây cho một lượt `t: 0 → 1`; chỉ là nhịp mặc định, scene đè được */
    duration: z.number().positive().default(WALK_CYCLE_SECONDS),
    /** Lấy mẫu qua mốc cuối: `wrap` vòng về mốc đầu, `hold` giữ nguyên mốc cuối */
    end: z.enum(["wrap", "hold"]).default("wrap"),
    /** Khớp mà hành động này ghi, tên theo bộ kênh của ai diễn; bỏ trống thì suy ra từ các mốc */
    mask: z.array(z.enum(MASK_CHANNELS)).optional(),
    /**
     * Ai diễn hành động mốc: `animal` thì `keys[].pose` ghi góc động vật, `mask` gọi tên kênh
     * động vật. Chỉ đi với `keys` — có `gen` thì bộ sinh đã nói. docs/08-dong-vat.md
     */
    actor: z.enum(["character", "animal"]).optional(),
    /**
     * Động vật không bàn chân nào chạm đất suốt hành động: scene treo nó ở hông và trôi ngang
     * bằng `path`. Bỏ trống thì lấy của bộ sinh (`animalFly` là bay), hành động mốc là `false`.
     */
    airborne: z.boolean().optional(),
    gen: z.string().optional(),
    params: z.record(z.string(), z.number()).optional(),
    /**
     * Góc nhìn mà hành động được soạn để xem. `side`: người 3D (`cast[].world`) đọc góc tay chân
     * như nằm trong mặt phẳng dọc của thân và chiếu thật; bỏ trống là giữ 2D. Người 2D không đọc.
     * docs/01-rig.md#người-3d
     */
    authoredAt: z.enum(["side"]).optional(),
    keys: z.array(KeySchema).min(1).optional(),
    /** Pha va chạm, đặt tên; `sceneEvents` đổi ra giây scene. docs/01-rig.md */
    events: z.array(EventSchema).default([]),
    /** Ghi chú cách dùng cho người soạn cảnh; rig không đọc, giữ nguyên khi xuất */
    note: z.string().optional(),
  })
  .superRefine((a, ctx) => {
    if (!a.gen === !a.keys)
      ctx.addIssue({ code: "custom", message: "Cần đúng một trong `gen` hoặc `keys`" });
    if (a.gen && !GENERATORS[a.gen] && !ANIMAL_GENERATORS[a.gen])
      ctx.addIssue({ code: "custom", message: `Không có bộ sinh \`${a.gen}\``, path: ["gen"] });
    if (a.gen && a.actor)
      ctx.addIssue({
        code: "custom",
        message: "`actor` chỉ đi với `keys`; có `gen` thì tên bộ sinh đã nói ai diễn",
        path: ["actor"],
      });
    const kind = actionKind(a);
    const channels: readonly string[] = kind === "animal" ? ANIMAL_CHANNELS : CHANNELS;
    a.mask?.forEach((c, i) => {
      if (!channels.includes(c))
        ctx.addIssue({
          code: "custom",
          message: `\`${c}\` không phải kênh của ${kind === "animal" ? "động vật" : "người"}`,
          path: ["mask", i],
        });
    });
    if (a.airborne !== undefined && kind !== "animal")
      ctx.addIssue({
        code: "custom",
        message: "`airborne` chỉ có ở hành động của động vật",
        path: ["airborne"],
      });
    a.keys?.forEach((k, i) => {
      if (i > 0 && k.t <= a.keys![i - 1].t)
        ctx.addIssue({ code: "custom", message: "`t` phải tăng dần", path: ["keys", i, "t"] });
      if (kind !== "animal") {
        if (typeof k.pose !== "string" && !PoseDeltaSchema.safeParse(k.pose).success)
          ctx.addIssue({
            code: "custom",
            message: 'mốc ghi kênh động vật trong hành động của người; khai `actor: "animal"`',
            path: ["keys", i, "pose"],
          });
        return;
      }
      if (typeof k.pose === "string" || !AnimalPoseDeltaSchema.safeParse(k.pose).success)
        ctx.addIssue({
          code: "custom",
          message:
            "mốc của động vật ghi góc theo `ANIMAL_JOINT_CHANNELS`, không gọi tên pose người",
          path: ["keys", i, "pose"],
        });
      if (k.layer || k.equip || k.reach)
        ctx.addIssue({
          code: "custom",
          message: "động vật không có lớp cẳng tay, đích cổ tay hay đồ mang theo",
          path: ["keys", i],
        });
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
  // v2 → v3 thêm `keys[].layer`; thiếu nó là lấy `DEFAULT_LAYERS`, không phải viết gì
  // v3 → v4 thêm kênh `head` và `keys[].face`; thiếu thì đầu đứng yên, nét mặt do scene quyết
  // v5 → v6 thêm `keys[].show`; v6 → v7 nó thành `keys[].equip`, tắt socket là gán `null`
  // v7 → v8 thêm `events[]`; thiếu nó là hành động không đặt tên pha nào, không phải viết gì
  // v8 → v9 tách kênh `face` khỏi `head`: mốc đổi nét mặt xưa ăn theo `head` trong mặt nạ
  // v9 → v10 thêm `actor`, `airborne`, mốc và `mask` của động vật; thiếu là hành động của người như cũ
  // v10 → v11 thêm kênh `stretch`; thiếu là chi dài chuẩn, không phải viết gì
  // v11 → v12 `stretch` nhận thêm tám số từng đoạn; bốn số cũ vẫn hợp lệ, không phải đổi
  // v12 → v13 thêm `keys[].reach`; thiếu là tay theo góc như cũ
  // v13 → v14 thêm `ease: "smooth"` và thành phần `null` của `head`; file cũ không dùng, không phải viết gì
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
  o.schemaVersion = ACTION_VERSION;
  return o;
}

export const defaultAction = (): ActionData =>
  ActionSchema.parse({ name: "walk", gen: "walkCycle", params: genDefaults("walkCycle") });

/** Hành động động vật mới: một bộ sinh với tham số mặc định và nhịp của chính nó */
export const defaultAnimalAction = (gen = "animalWalk"): ActionData =>
  ActionSchema.parse({
    name: gen.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
    duration: ANIMAL_GENERATORS[gen].duration,
    gen,
    params: genDefaults(gen),
  });

/** Hành động mốc của động vật, một mốc trống ở `t: 0`; studio bật kênh nào thì mốc ghi kênh ấy */
export const defaultAnimalKeysAction = (): ActionData =>
  ActionSchema.parse({
    name: "hanh-dong-moi",
    actor: "animal",
    duration: 1,
    end: "hold",
    keys: [{ t: 0, pose: {} }],
  });

export const parseAction = (json: unknown) => ActionSchema.safeParse(migrateAction(json));

/** Góc mà một mốc ghi; mốc gọi tên pose thì trải ra đủ mọi kênh. */
export const keyDelta = (k: ActionKey): PoseDelta =>
  typeof k.pose === "string" ? toDelta(POSES[k.pose]) : (k.pose as PoseDelta);

/** Góc động vật mà một mốc ghi; mốc gọi tên pose người thì không ghi gì. */
export const keyAnimalDelta = (k: ActionKey): AnimalPoseDelta =>
  typeof k.pose === "string" ? {} : (k.pose as AnimalPoseDelta);

/** Lớp mà một mốc ghi; mốc gọi tên pose thì lấy luôn lớp của pose đó. */
export const keyLayer = (k: ActionKey): Partial<ArmLayers> =>
  typeof k.pose === "string" ? { ...POSE_LAYERS[k.pose], ...k.layer } : (k.layer ?? {});

/** Nét mặt mà một mốc ghi; pose trong thư viện không mang nét mặt nào. */
export const keyFace = (k: ActionKey): Partial<FaceState> => k.face ?? {};

/** Đồ mà một mốc đổi; pose trong thư viện không đụng tới mảnh nào. */
export const keyEquip = (k: ActionKey): Equip | undefined => k.equip;

/** Khớp mà hành động ghi: `mask` nếu có, không thì hợp của các khớp được nhắc tới. */
export function actionMask(a: ActionData): Channel[] {
  // Kênh của động vật không nằm trong `CHANNELS`; hành động của động vật không ghi khớp người nào cả
  if (actionKind(a) === "animal") return [];
  if (a.mask) return a.mask as Channel[];
  if (!a.keys) return GEN_CHANNELS;
  const seen = new Set<Channel>();
  for (const k of a.keys) {
    for (const c of Object.keys(keyDelta(k)) as Channel[]) seen.add(c);
    for (const c of Object.keys(k.reach ?? {}) as Channel[]) seen.add(c);
  }
  // Mốc đổi nét mặt ghi vào `face`, không đụng góc đầu: hành động nhép miệng không cần khai `mask`
  if (a.keys.some((k) => Object.keys(keyFace(k)).length)) seen.add("face");
  return CHANNELS.filter((c) => seen.has(c));
}

/** Kênh động vật mà hành động ghi; bộ sinh ghi đủ mọi khớp, hành động của người không ghi gì. */
export function animalActionMask(a: ActionData): AnimalChannel[] {
  if (actionKind(a) !== "animal") return [];
  if (a.mask) return a.mask as AnimalChannel[];
  if (!a.keys) return [...ANIMAL_JOINT_CHANNELS];
  const seen = new Set<AnimalChannel>();
  for (const k of a.keys)
    for (const c of Object.keys(keyAnimalDelta(k)) as AnimalChannel[]) seen.add(c);
  if (a.keys.some((k) => Object.keys(keyFace(k)).length)) seen.add("face");
  return ANIMAL_CHANNELS.filter((c) => seen.has(c));
}

const spring = (u: number) => 1 - Math.exp(-6 * u) * Math.cos(9 * u);

const EASES: Record<ActionKey["ease"], (u: number) => number> = {
  linear: (u) => u,
  // Chuẩn hoá để vẫn chạm đúng mốc sau ở u = 1
  spring: (u) => spring(u) / spring(1),
  smooth: smoothstep,
};

type Angles = number | Limb | Arm | HeadPose | Stretch;

const mix = (a: Angles, b: Angles, f: number): Angles =>
  typeof a === "number" || typeof b === "number"
    ? (a as number) + ((b as number) - (a as number)) * f
    : (a.map((v, i) => v + ((b as number[])[i] - v) * f) as Limb | Arm | HeadPose | Stretch);

/** Pha `[0, 1]` để lấy mẫu: `wrap` vòng lại, `hold` kẹp ở mốc cuối thay vì nhảy về mốc đầu. */
export const phaseOf = (a: ActionData, t: number): number =>
  a.end === "hold" ? Math.min(1, Math.max(0, t)) : t - Math.floor(t);

/** Nội suy một kênh giữa hai mốc gần nhất *có nhắc tới nó*, không phải hai mốc kề nhau. */
const sampleChannel = (a: ActionData, pick: (k: ActionKey) => Angles | undefined, u: number) =>
  sampleWith(a, pick, u, mix);

function sampleWith<T>(
  a: ActionData,
  pick: (k: ActionKey) => T | undefined,
  u: number,
  mix: (a: T, b: T, f: number) => T,
): T | undefined {
  const s: { t: number; v: T; ease: ActionKey["ease"] }[] = [];
  for (const k of a.keys!) {
    const v = pick(k);
    if (v !== undefined) s.push({ t: k.t, v, ease: k.ease });
  }
  if (!s.length) return undefined;
  if (s.length === 1) return s[0].v;

  const last = s[s.length - 1];
  let from = s[0];
  let to = s[1];
  let span = to.t - from.t;
  let at = u - from.t;
  if (u < s[0].t || u >= last.t) {
    if (a.end === "hold") return u < s[0].t ? s[0].v : last.v;
    from = last;
    to = s[0];
    span = to.t + 1 - last.t;
    at = u < s[0].t ? u + 1 - last.t : u - last.t;
  } else {
    for (let i = 0; i < s.length - 1; i++)
      if (s[i].t <= u && u < s[i + 1].t) {
        from = s[i];
        to = s[i + 1];
        span = to.t - from.t;
        at = u - from.t;
      }
  }
  return mix(from.v, to.v, span > 0 ? EASES[from.ease](at / span) : 0);
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

/** Lớp cẳng tay mà hành động ghi tại pha `t`; kênh ngoài mặt nạ thì bỏ trống. */
export function actionLayers(a: ActionData, t: number): Partial<ArmLayers> {
  if (!a.keys) return {};
  const u = phaseOf(a, t);
  const mask = actionMask(a);
  const o: Partial<ArmLayers> = {};
  for (const c of ARM_CHANNELS) {
    if (!mask.includes(c)) continue;
    const v = sampleStep(a, (k) => keyLayer(k)[c], u);
    if (v) o[c] = v;
  }
  return o;
}

/** Ghép lớp như `composePose`: hành động sau đè hành động trước ở kênh nó ghi. */
export const composeLayers = (...parts: Partial<ArmLayers>[]): ArmLayers =>
  Object.assign({}, DEFAULT_LAYERS, ...parts) as ArmLayers;

/** Nét mặt mà hành động ghi tại pha `t`; kênh `face`, ngoài mặt nạ thì bỏ trống. */
export function actionFace(a: ActionData, t: number): Partial<FaceState> {
  if (!a.keys || !actionMask(a).includes("face")) return {};
  const u = phaseOf(a, t);
  const o: Partial<FaceState> = {};
  for (const f of ["mouth", "brow", "eyes"] as const) {
    const v = sampleStep(a, (k) => keyFace(k)[f], u);
    if (v !== undefined) Object.assign(o, { [f]: v });
  }
  return o;
}

/** Mỏ và mắt mà hành động của động vật ghi tại pha `t`; kênh `face`, ngoài mặt nạ thì bỏ trống. */
export function animalActionFace(a: ActionData, t: number): Partial<AnimalFace> {
  if (!a.keys || !animalActionMask(a).includes("face")) return {};
  const u = phaseOf(a, t);
  const o: Partial<AnimalFace> = {};
  for (const f of ["mouth", "eyes"] as const) {
    const v = sampleStep(a, (k) => keyFace(k)[f], u);
    if (v !== undefined) Object.assign(o, { [f]: v });
  }
  return o;
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
  if (actionKind(a) === "animal") return [];
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
  const dropped = new Map<MaskChannel, number[]>();
  const note = (c: MaskChannel, t: number) => {
    if (mask.includes(c)) return;
    if (!dropped.has(c)) dropped.set(c, []);
    dropped.get(c)?.push(t);
  };
  for (const k of a.keys) {
    if (typeof k.pose !== "string")
      for (const c of Object.keys(k.pose) as MaskChannel[]) note(c, k.t);
    if (Object.keys(keyFace(k)).length) note("face", k.t);
    for (const c of Object.keys(k.layer ?? {}) as Channel[]) note(c, k.t);
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
        const r = (c === "armFar" || c === "armNear") && k.reach?.[c];
        // Mốc chỉ khai đích tay thì góc cúi thân lấy từ các mốc khác của kênh `torso` tại pha ấy
        const lean = () =>
          d.torso ?? (sampleChannel(a, (q) => keyDelta(q).torso, k.t) as number | undefined);
        return (x ?? (r ? reachAngles(r, lean()) : undefined)) as Angles | undefined;
      },
      u,
    );
    if (v !== undefined) Object.assign(d, { [c]: c === "stretch" ? stretchJson(v as Stretch) : v });
  }
  return d;
}

const REACH_OF = { af: "armFar", an: "armNear" } as const;

type ReachSample = { w: number; at: Reach["at"]; elbow: NonNullable<Reach["elbow"]> };

/** Hoà hai đích: phần `w` nội suy thẳng; bên không có đích (`w` 0) mượn chỗ của bên kia */
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
  return {
    w,
    at: lerp(p.at, q.at),
    elbow: lerp(p.elbow ?? REACH_ELBOW, q.elbow ?? REACH_ELBOW),
  };
}

/**
 * Đích cổ tay hệ thân mà hành động ghi tại pha `t`, theo kênh trong mặt nạ. Mốc nhắc kênh tay bằng góc
 * mà không có đích là `w` 0: đi từ mốc có đích sang mốc góc thì đích nhạt dần, rig hoà vị trí.
 */
export function actionReach(a: ActionData, t: number): ReachMap {
  if (!a.keys || actionKind(a) === "animal") return {};
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
        if (r) return { w: 1, at: r.at, elbow: r.elbow ?? REACH_ELBOW };
        return keyDelta(k)[c] ? { w: 0, at: [0, 0, 0], elbow: REACH_ELBOW } : undefined;
      },
      u,
      (x, y, f) => mixReach(x, y, f) ?? { w: 0, at: x.at, elbow: x.elbow },
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
  return p;
}

/** Tên kênh JSON → khoá `AnimalPose`; chiều ngược của `animalPoseDelta`. */
export const animalDeltaPose = (d: AnimalPoseDelta): Partial<AnimalPose> => {
  const o: Partial<AnimalPose> = {};
  for (const c of ANIMAL_JOINT_CHANNELS)
    if (d[c] !== undefined) Object.assign(o, { [animalChannelKey[c]]: d[c] });
  return o;
};

export const animalPoseDelta = (p: AnimalPose): Required<AnimalPoseDelta> =>
  Object.fromEntries(
    ANIMAL_JOINT_CHANNELS.map((c) => [c, p[animalChannelKey[c]]]),
  ) as Required<AnimalPoseDelta>;

/**
 * Góc động vật mà hành động ghi tại pha `t`, trong mặt nạ. Bộ sinh **nhận cả con vật** vì
 * sải chân kẹp theo chân nó; hành động không phải của động vật thì không ghi gì.
 */
export function animalActionDelta(a: ActionData, t: number, b: AnimalData): AnimalPoseDelta {
  if (actionKind(a) !== "animal") return {};
  const u = phaseOf(a, t);
  const mask = animalActionMask(a);
  const joints = ANIMAL_JOINT_CHANNELS.filter((c) => mask.includes(c));
  if (a.gen) {
    const g = ANIMAL_GENERATORS[a.gen];
    if (!g) return {};
    const full = animalPoseDelta(g.pose(u, { ...genDefaults(a.gen), ...a.params }, b));
    return Object.fromEntries(joints.map((c) => [c, full[c]]));
  }
  const d: AnimalPoseDelta = {};
  for (const c of joints) {
    const v = sampleChannel(a, (k) => keyAnimalDelta(k)[c], u);
    if (v !== undefined) Object.assign(d, { [c]: v });
  }
  return d;
}

/**
 * Tư thế động vật tại pha `t`, chỉ các kênh hành động ghi — ghép lên `animalStand` hay tư thế
 * track dưới bằng `composeAnimalPose`. Hành động của người thì trả `null` để chỗ gọi rơi về
 * tư thế đứng.
 */
export function animalActionPose(
  a: ActionData,
  t: number,
  b: AnimalData,
): Partial<AnimalPose> | null {
  if (actionKind(a) !== "animal") return null;
  return animalDeltaPose(animalActionDelta(a, t, b));
}

/** Khoá `Pose` của bốn chi, theo thứ tự cặp số trong `Stretch` */
const STRETCH_LIMBS = ["af", "an", "lf", "ln"] as const;

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
 * nghiêng đầu khi nói không xoá cái lắc của `look-camera` ở track dưới.
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
    // Kênh `p` ghi mà không mang cờ nâng là giữ 2D, dù lớp dưới đã nâng
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
    return out;
  }, base);

/** Thay mốc gọi tên pose bằng số, trong phạm vi mặt nạ. Xuất ra file thì đóng băng. */
export function freezeAction(a: ActionData): ActionData {
  if (!a.keys || actionKind(a) === "animal") return a;
  const mask = actionMask(a);
  const joints = JOINT_CHANNELS.filter((c) => mask.includes(c));
  return {
    ...a,
    keys: a.keys.map((k) => {
      if (typeof k.pose !== "string") return k;
      const layer = keyLayer(k);
      return {
        ...k,
        pose: Object.fromEntries(joints.map((c) => [c, keyDelta(k)[c]])) as PoseDelta,
        ...(Object.keys(layer).length ? { layer } : {}),
      };
    }),
  };
}
