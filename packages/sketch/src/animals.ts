import { z } from "zod";
import { INK } from "./constants";
import type { PieceDir } from "./schema";
import type { EyeKind, MouthKind } from "./types";

/** Bump khi đổi hình dạng JSON động vật; `migrateAnimal` phải có nhánh tương ứng. */
export const ANIMAL_VERSION = 6;

/** [trên, dưới] — quy ước góc như chân người, khớp con đo tương đối so với khớp cha */
export type Leg = [number, number];
/** [gốc, ngọn] — đuôi */
export type Tail = [number, number];
/** [gốc, chóp] — cánh: dốc thêm ở vai, gập thêm ở khớp giữa (dương là chóp gập về phía lưng) */
export type Wing = [number, number];

/**
 * Tư thế động vật. `spine` / `neck` / `head` / `tail` / `wing` là **độ dốc cộng thêm** vào độ
 * dốc nghỉ khai trong JSON, dương là ngẩng lên; góc chân thì tuyệt đối so với phương thẳng
 * đứng như chân người. docs/08-dong-vat.md
 */
export interface AnimalPose {
  spine: number;
  neck: number;
  head: number;
  tail: Tail;
  wing: Wing;
  /** Chân trước gần / xa; động vật hai chân không dùng tới */
  fn: Leg;
  ff: Leg;
  /** Chân sau gần / xa; động vật hai chân chỉ có cặp này */
  hn: Leg;
  hf: Leg;
}

/** Nét mặt con vật: mỏ và mắt, cùng bộ tên với người. Chỉ đầu `beak` vẽ `mouth`. */
export interface AnimalFace {
  mouth: MouthKind;
  eyes: EyeKind;
}

export const DEFAULT_ANIMAL_FACE: AnimalFace = { mouth: "closed", eyes: "open" };

/** Kênh khớp: thứ có góc trong `AnimalPose` */
export const ANIMAL_JOINT_CHANNELS = [
  "spine",
  "neck",
  "head",
  "tail",
  "wing",
  "legFrontNear",
  "legFrontFar",
  "legHindNear",
  "legHindFar",
] as const;
export type AnimalJointChannel = (typeof ANIMAL_JOINT_CHANNELS)[number];

/** Kênh mà `mask` gọi tên: chín khớp cộng `face` — mỏ và mắt đổi được mà không đụng góc đầu */
export const ANIMAL_CHANNELS = [...ANIMAL_JOINT_CHANNELS, "face"] as const;
export type AnimalChannel = (typeof ANIMAL_CHANNELS)[number];

/** Bốn kênh chân: trong scene chúng **cắt cứng** ở đầu clip, không hoà — góc chân là kết quả IK */
export const ANIMAL_LEG_CHANNELS = [
  "legFrontNear",
  "legFrontFar",
  "legHindNear",
  "legHindFar",
] as const satisfies readonly AnimalChannel[];

export const ANIMAL_CHANNEL_LABELS: Record<AnimalChannel, string> = {
  spine: "thân",
  neck: "cổ",
  head: "đầu",
  tail: "đuôi",
  wing: "cánh",
  legFrontNear: "chân trước gần",
  legFrontFar: "chân trước xa",
  legHindNear: "chân sau gần",
  legHindFar: "chân sau xa",
  face: "mặt",
};

/** Bốn chân trong `AnimalPose`; thứ tự này cũng là thứ tự `feet` trả về. */
export const ANIMAL_LEGS = ["hn", "hf", "fn", "ff"] as const;
export type AnimalLeg = (typeof ANIMAL_LEGS)[number];

/** Tên kênh trong JSON ↔ khoá trong `AnimalPose`; chỗ duy nhất biết cả hai. */
export const animalChannelKey: Record<AnimalJointChannel, keyof AnimalPose> = {
  spine: "spine",
  neck: "neck",
  head: "head",
  tail: "tail",
  wing: "wing",
  legFrontNear: "fn",
  legFrontFar: "ff",
  legHindNear: "hn",
  legHindFar: "hf",
};

/**
 * Chân hai đoạn, đúng như chân người: rig không vẽ bàn chân và động vật thì không cầm nắm gì,
 * nên không có đoạn thứ ba. Bề dày và màu nét là của cả con, ở `palette`.
 */
const LegSchema = z
  .object({
    upper: z.number().positive().default(112),
    lower: z.number().positive().default(106),
    /**
     * Khớp giữa gập về đâu. Khớp giữa là khớp **lộ dưới bụng**: móng guốc thì chân trước
     * `forward` (đầu gối trước) và chân sau `back` (cổ chân sau — khuỷu và đầu gối sau chìm
     * trong thân, không vẽ); voi gập `forward` cả bốn; chim hai chân gập `back`, chỗ trông
     * như đầu gối ngược ấy là cổ chân.
     */
    knee: z.enum(["forward", "back"]).default("forward"),
  })
  .prefault({});

const PartSchema = z.object({
  len: z.number().min(0).default(0),
  width: z.number().min(0).default(16),
  /** Bỏ trống thì lấy màu mặc định của bộ phận ấy — xem `partColor` */
  color: z.string().optional(),
});

export type AnimalPartData = z.infer<typeof PartSchema>;

/**
 * Một socket ảnh của động vật. Khác socket nhân vật ở chỗ **hộp lấy nguyên từ bộ xương** —
 * dài theo đoạn, rộng theo bề dày đã khai — nên không có `aspect`: bề ngang là một tham
 * số hình dáng thật (`body.depth`, `head.depth`, …), không suy ra từ tỉ lệ tấm ảnh.
 * Ảnh dán vào bị kéo cho vừa hộp, chỉnh bằng chính mấy số ấy cộng `widthScale`.
 */
const AnimalPieceSchema = z.object({
  src: z.enum(["none", "image"]).default("none"),
  file: z.string().optional(),
  /** Nhân vào ảnh mực đen trắng; bỏ trống thì để nguyên ảnh */
  color: z.string().optional(),
  dx: z.number().default(0),
  dy: z.number().default(0),
  scale: z.number().default(1),
  widthScale: z.number().default(1),
  /** Độ, chiều rig; xoay quanh tâm hộp */
  rotate: z.number().default(0),
});

export type AnimalPiece = z.infer<typeof AnimalPieceSchema>;

/** Socket ảnh, và cũng là thư mục ảnh của nó trong `pieces/` */
export const ANIMAL_PIECE_KEYS = ["body", "neck", "head", "ear", "wing", "tail"] as const;
export type AnimalPieceKey = (typeof ANIMAL_PIECE_KEYS)[number];

export const ANIMAL_PIECE_LABELS: Record<AnimalPieceKey, string> = {
  body: "thân",
  neck: "cổ",
  head: "đầu",
  ear: "tai",
  wing: "cánh",
  tail: "đuôi",
};

/** Thư mục ảnh trong `pieces/`; phải khác tên socket của nhân vật (`neck`, `chin`, …) */
export const animalPieceDir = (k: AnimalPieceKey): PieceDir =>
  `animal${k[0].toUpperCase()}${k.slice(1)}` as PieceDir;

export const AnimalSchema = z.object({
  schemaVersion: z
    .literal(ANIMAL_VERSION, {
      error: "JSON động vật thuộc phiên bản schema khác; cần bản @stickman3d/sketch khớp với nó",
    })
    .default(ANIMAL_VERSION),
  name: z.string().default("animal"),
  /** Bốn chân hay hai; động vật hai chân chỉ dùng `legHind` và không vẽ chân trước */
  legs: z.union([z.literal(2), z.literal(4)]).default(4),
  rig: z
    .object({
      stroke: z.number().positive().default(6),
      /** Khớp hông (sau) → khớp vai (trước) */
      body: z.number().positive().default(210),
      /** Độ dốc thân so với phương ngang, dương là vai cao hơn hông */
      pitch: z.number().default(3),
      /** Chiều cao khớp hông so với mặt đất khi đứng; hai chân phải với tới đây */
      hipY: z.number().positive().default(200),
      /** Chân xa dịch về trước bấy nhiêu, để nhìn ngang vẫn thấy đủ bốn chân */
      spread: z.number().default(14),
      /**
       * Chỗ treo chân sau dọc trục thân, `0` là khớp hông, `1` là khớp vai. Thú bốn chân để
       * `0`; động vật hai chân đặt quanh `0.4` cho chân đứng dưới giữa thân thay vì sát đuôi.
       */
      hindAt: z.number().min(0).max(1).default(0),
    })
    .prefault({}),
  /** Thùng thân: một khối bám dọc đoạn hông→vai, dày `depth`, `back` phần nằm trên trục */
  body: z
    .object({
      depth: z.number().positive().default(150),
      /** Phần bề dày nằm **trên** trục sống, phần còn lại là bụng */
      back: z.number().min(0).max(1).default(0.42),
      /** Bề dày ở mông so với giữa thân */
      rump: z.number().min(0).default(0.94),
      /** Bề dày ở ngực so với giữa thân */
      chest: z.number().min(0).default(1),
      /** Thân thò ra sau khớp hông */
      rear: z.number().min(0).default(70),
      /** Thân thò ra trước khớp vai */
      front: z.number().min(0).default(46),
    })
    .prefault({}),
  /** Chân trước; động vật hai chân không có */
  legFront: LegSchema.prefault({ upper: 135, lower: 95, knee: "forward" }),
  legHind: LegSchema.prefault({ upper: 110, lower: 112, knee: "back" }),
  neck: z
    .object({
      len: z.number().min(0).default(120),
      /** Độ dốc nghỉ so với **trục thân**, dương là ngẩng lên */
      pitch: z.number().default(52),
      /** Bề dày ở vai và ở gáy */
      base: z.number().positive().default(80),
      tip: z.number().positive().default(54),
    })
    .prefault({}),
  head: z
    .object({
      kind: z.enum(["muzzle", "blunt", "beak", "round", "tapered"]).default("muzzle"),
      len: z.number().positive().default(112),
      depth: z.number().positive().default(58),
      /** Độ dốc nghỉ so với **trục cổ**, dương là hếch lên; đầu ngựa chúi nên số âm */
      pitch: z.number().default(-96),
      /** Bán kính con mắt */
      eye: z.number().min(0).default(9),
    })
    .prefault({}),
  parts: z
    .object({
      /** Tai: `perk` dựng nhọn, `fan` phe phẩy to bản, `floppy` cụp xuống */
      ear: PartSchema.extend({
        kind: z.enum(["none", "perk", "fan", "floppy", "round"]).default("perk"),
        /** Chỗ mọc dọc đầu, `0` là gáy, `1` là mõm */
        at: z.number().min(0).max(1).default(0.1),
        /** Lệch khỏi trục đầu, tính theo bề dày đầu; dương là về phía đỉnh đầu */
        dx: z.number().default(0.28),
        /**
         * Độ dốc so với **trục đầu**, dương là dựng lên. Tai ngựa vểnh nên số lớn, tai
         * voi rủ ra sau nên số âm — hình cái tai và hướng nó chìa ra là hai chuyện.
         */
        pitch: z.number().default(120),
      }).prefault({ len: 46, width: 22 }),
      /** Vòi: rủ từ mõm xuống, `len: 0` là không có */
      trunk: PartSchema.prefault({ len: 0, width: 30 }),
      /** Ngà hoặc nanh chìa ra từ mõm */
      tusk: PartSchema.prefault({ len: 0, width: 12 }),
      /** Sừng mọc trên đỉnh đầu */
      horn: PartSchema.prefault({ len: 0, width: 12 }),
      /** Mào trên đỉnh đầu; gà, trĩ */
      crest: PartSchema.extend({
        kind: z.enum(["comb", "plume"]).default("comb"),
      }).prefault({ len: 0, width: 26 }),
      /** Bờm dọc cổ hoặc bao quanh đầu; `len: 0` là không có */
      mane: PartSchema.extend({
        kind: z.enum(["ridge", "ruff"]).default("ridge"),
      }).prefault({ len: 0, width: 0 }),
      /**
       * Cánh: mọc trên lưng, xoè **ngược trục thân** về phía mông như đuôi, hai đoạn — đoạn
       * gốc và chóp lông gập ở khớp giữa (`WING_ELBOW`). Vẽ cả hai bên, cánh xa sau thân.
       * Kênh `wing` của tư thế cộng thêm vào `pitch` và `fold`; `len: 0` là không có cánh.
       */
      wing: PartSchema.extend({
        accent: z.string().optional(),
        /** Chỗ mọc dọc thân, `0` là khớp hông, `1` là khớp vai */
        at: z.number().min(0).max(1).default(0.8),
        /** Lệch khỏi trục sống, tính theo bề dày thân; dương là về phía lưng */
        dx: z.number().default(0.2),
        /** Độ dốc nghỉ so với **trục thân**, dương là dựng lên */
        pitch: z.number().default(10),
        /** Gập nghỉ của chóp so với đoạn gốc, độ; dương là chóp gập về phía lưng */
        fold: z.number().default(0),
      }).prefault({ len: 0, width: 60 }),
      tail: PartSchema.extend({
        accent: z.string().optional(),
        kind: z.enum(["none", "tuft", "rope", "fan", "smooth", "ribbon"]).default("tuft"),
        /** Độ dốc nghỉ so với **trục thân**, dương là dựng lên */
        pitch: z.number().default(-26),
      }).prefault({ len: 130, width: 30 }),
    })
    .prefault({}),
  /**
   * Ảnh dán lên bộ xương. Socket nào có ảnh thì **hình code của đúng bộ phận ấy không
   * vẽ nữa**; ảnh đầu thay cả mỏ, mắt, vòi, ngà, sừng và mào của khối đầu code.
   * Ảnh ở `pieces/animalBody/`, `pieces/animalHead/`, … theo `animalPieceDir`.
   */
  pieces: z
    .object({
      body: AnimalPieceSchema.prefault({}),
      neck: AnimalPieceSchema.prefault({}),
      head: AnimalPieceSchema.prefault({}),
      ear: AnimalPieceSchema.prefault({}),
      wing: AnimalPieceSchema.prefault({}),
      tail: AnimalPieceSchema.prefault({}),
    })
    .prefault({}),
  markings: z
    .object({
      kind: z.enum(["none", "stripes"]).default("none"),
      color: z.string().default(INK),
    })
    .prefault({}),
  /**
   * Chỗ ngồi trên lưng — mốc `saddle`, nơi `cast[].mount` đặt hông người cưỡi. `at` dọc trục
   * hông→vai (`0` hông, `1` vai), `dx` lệch về phía lưng theo bề dày thân; bỏ trống là đúng
   * mép lưng (`body.back`). Ngựa ngồi quanh `0.55`, voi ngồi sát vai. docs/08-dong-vat.md
   */
  saddle: z
    .object({
      at: z.number().min(0).max(1).default(0.55),
      dx: z.number().optional(),
    })
    .prefault({}),
  palette: z
    .object({
      line: z.string().default(INK),
      coat: z.string().default("#b08052"),
      /** Bụng và trong chân; bỏ trống là cùng màu lông */
      belly: z.string().optional(),
      /** Cổ và khối đầu; bỏ trống là cùng màu lông */
      head: z.string().optional(),
      /** Nét chân — chi động vật là nét que như của người, mặc định đen */
      leg: z.string().default(INK),
      /** Bề dày nét chân, dùng chung cho cả bốn chân */
      legWidth: z.number().positive().default(10),
      /** Sừng, ngà, mỏ, mào — chất sừng, không phải lông */
      horn: z.string().default("#e6dcc4"),
      /** Bờm và đuôi */
      hair: z.string().default("#4a3728"),
    })
    .prefault({}),
});

export type AnimalData = z.infer<typeof AnimalSchema>;
export type AnimalLegData = z.infer<typeof LegSchema>;

/** Nâng JSON đời cũ lên `ANIMAL_VERSION`. File mới hơn thì trả nguyên để zod báo lỗi. */
export function migrateAnimal(json: unknown): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json;
  const o = structuredClone(json) as Record<string, unknown>;
  const from = typeof o.schemaVersion === "number" ? o.schemaVersion : 0;
  if (from > ANIMAL_VERSION) return o;
  // v4 → v5 cánh bỏ `kind`, thêm `fold` và kênh tư thế: `none` là `len: 0`, hai kiểu cũ đều là cánh
  if (from < 5) {
    const parts = o.parts as { wing?: Record<string, unknown> } | undefined;
    const w = parts?.wing;
    if (w && typeof w === "object") {
      if (w.kind === "none") w.len = 0;
      delete w.kind;
    }
  }
  o.schemaVersion = ANIMAL_VERSION;
  return o;
}

export const parseAnimal = (json: unknown) => AnimalSchema.safeParse(migrateAnimal(json));

export const defaultAnimal = (): AnimalData => AnimalSchema.parse({});

/**
 * Mốc trên con vật mà `animalAnchorAt` trả lời: `root` là điểm chạm đất dưới khớp hông,
 * `saddle` là chỗ ngồi, `dock` gốc đuôi, `tailTip` chóp đuôi, `wingTip` chóp cánh gần;
 * bàn chân theo tên chân.
 */
export const ANIMAL_ANCHOR_NAMES = [
  "root",
  "hip",
  "shoulder",
  "saddle",
  "poll",
  "muzzle",
  "dock",
  "tailTip",
  "wingTip",
  "footHindNear",
  "footHindFar",
  "footFrontNear",
  "footFrontFar",
] as const;
export type AnimalAnchorName = (typeof ANIMAL_ANCHOR_NAMES)[number];

/** Chân của một động vật: hai chân thì chỉ có cặp sau. */
export const animalLegs = (b: AnimalData): AnimalLeg[] =>
  b.legs === 4 ? [...ANIMAL_LEGS] : ["hn", "hf"];

/** Chỗ treo chân dọc trục thân: chân trước ở vai, chân sau ở `rig.hindAt` */
export const legAt = (b: AnimalData, front: boolean): number => (front ? 1 : b.rig.hindAt);

/** Khoảng cách từ khớp gốc của một chân xuống mặt đất khi đứng yên. */
export const legSpan = (b: AnimalData, front: boolean): number =>
  b.rig.hipY + legAt(b, front) * b.rig.body * Math.sin((Math.PI / 180) * b.rig.pitch);

/**
 * Phần chiều dài chân đã dùng hết khi đứng yên. `1` là duỗi thẳng đơ. Đứng thì chân gần
 * thẳng, quanh `0.93`; con chân cột như voi tới `0.96`. Phần còn lại là chỗ để chân doãng
 * ra khi đi — thấp hơn `0.85` là con vật ngồi xổm, trên `0.97` là hết chỗ doãng.
 */
export const legStretch = (b: AnimalData, front: boolean): number => {
  const l = front ? b.legFront : b.legHind;
  return legSpan(b, front) / (l.upper + l.lower);
};

/** Duỗi quá ngần này thì IK hết chỗ; sải chân bị cắt cụt và bàn chân trượt trên đất */
const REACH_MAX = 0.985;

/** Chân với xa nhất được bấy nhiêu tính từ khớp gốc */
export const legReach = (l: AnimalLegData): number => (l.upper + l.lower) * REACH_MAX;

/** Sải chân lớn nhất mà chân với tới được, tính theo `hipY` như `AnimalGaitParams.stride`. */
export function maxStride(b: AnimalData): number {
  const reach = (front: boolean) => {
    const span = legSpan(b, front);
    const arm = legReach(front ? b.legFront : b.legHind);
    return arm > span ? Math.sqrt(arm * arm - span * span) : 0;
  };
  const half = b.legs === 4 ? Math.min(reach(false), reach(true)) : reach(false);
  return (2 * half) / b.rig.hipY;
}

/** Dưới ngần này thì chân gần như không đưa ra trước được, dáng đi thành giậm chân tại chỗ */
const STRIDE_MIN = 0.25;

/**
 * Chỗ sai mà zod không bắt được: chân với không tới đất thì IK duỗi hết cỡ và bàn chân
 * lơ lửng; chân *vừa đủ* tới đất thì đứng được nhưng hết chỗ gập, sải chân bị cắt cụt và
 * bàn chân **trượt** — không có gì báo, hình chỉ sai. `stickman check` là chỗ kêu.
 */
export function animalProblems(b: AnimalData): string[] {
  const out: string[] = [];
  const legs: [boolean, string][] =
    b.legs === 4
      ? [
          [false, "sau"],
          [true, "trước"],
        ]
      : [[false, "sau"]];
  for (const [front, name] of legs) {
    const st = legStretch(b, front);
    if (st > 1)
      out.push(`chân ${name} với không tới đất: cần dài thêm ${Math.ceil((st - 1) * 100)}%`);
  }
  const stride = maxStride(b);
  if (!out.length && stride < STRIDE_MIN)
    out.push(
      `chân duỗi gần hết khi đứng nên sải chân chỉ còn ${stride.toFixed(2)} — kéo dài \`upper\`/\`lower\` hoặc hạ \`hipY\``,
    );
  return out;
}

export type AnimalPartName = keyof AnimalData["parts"];

/** Bộ phận nào ăn theo màu nào khi không khai `color` riêng */
const PART_TINT: Record<AnimalPartName, "coat" | "horn" | "hair"> = {
  ear: "coat",
  trunk: "coat",
  tusk: "horn",
  horn: "horn",
  crest: "horn",
  mane: "hair",
  wing: "coat",
  tail: "hair",
};

/** Màu vẽ của một bộ phận: `color` của chính nó, không thì màu chung của loại ấy. */
export const partColor = (b: AnimalData, k: AnimalPartName): string =>
  b.parts[k].color ?? b.palette[PART_TINT[k]];

/** Tên file ảnh của một socket, hoặc `undefined` nếu socket không dùng ảnh. */
export const animalPieceFile = (p: AnimalPiece): string | undefined =>
  p.src === "image" ? p.file : undefined;

/** Ảnh mà một con vật cần nạp; khoá theo tên file như `PieceUrls` của nhân vật. */
export const animalFiles = (b: AnimalData): string[] => [
  ...new Set(ANIMAL_PIECE_KEYS.flatMap((k) => animalPieceFile(b.pieces[k]) ?? [])),
];
