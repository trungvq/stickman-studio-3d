// Tầng trên `SceneSchema`: bảng thời gian của cả tập. Rig dừng ở một cảnh, còn cái nối
// **thoại ↔ cảnh ↔ tiếng ↔ phụ đề** thì ở đây. Camera và nền thì không — chúng đã vào
// scene, để ba đường render cùng thấy một khung. Xem docs/07-lam-tap.md.
import { z } from "zod";
import { MARK_REF } from "@stickman3d/sketch";

export const EPISODE_VERSION = 1;

/**
 * Giây màn hình tính từ đầu shot, hay `"@mốc+0.4"` — mốc có tên của cảnh shot đang chiếu,
 * đổi ra giây màn hình qua bảng slow-mo của shot (`cueStart` ở `shots.ts`). docs/07-lam-tap.md
 */
const shotTime = z.union([z.number().min(0), z.string().regex(MARK_REF)]);

/** Một đoạn chạy chậm (hay nhanh), khai bằng giây cảnh **kể từ đầu shot** */
const SlowSchema = z.object({
  from: z.number().min(0),
  to: z.number().min(0),
  rate: z.number().positive().describe("Nhỏ hơn 1 là chậm lại; 0.4 là chậm 2,5 lần"),
});

/** Một lượt tiếng trong shot. `text` nằm cùng chỗ với `file` để câu thoại chỉ có một bản */
const CueSchema = z.object({
  file: z.string().min(1).describe("Tên file trong `assets/audio/`"),
  /** Tên để cue khác neo `after` và `shot.marks` trỏ vào; bỏ trống là tên file không đuôi */
  id: z.string().min(1).optional(),
  at: shotTime.default(0).describe("Giây **màn hình** tính từ đầu shot, hay `@mốc` của cảnh"),
  /**
   * Luật đặt `at`: vào `offset` giây sau khi cue `cue` (cùng shot) **dứt**. `stickman retime`
   * đo file rồi ghi số vào `at`; `check` kêu khi số ấy cũ. Chỗ vẽ chỉ đọc `at`.
   */
  after: z.object({ cue: z.string().min(1), offset: z.number().default(0) }).optional(),
  /**
   * Giây cue chiếm trên trục shot; hết là **tháo thẻ `<audio>`**. Bỏ trống thì đo từ chính
   * file (`useAudioDurations`) — chỉ khai tay khi muốn cắt sớm, hoặc khi có `loop`.
   */
  dur: z.number().positive().optional(),
  /**
   * Độ dài một vòng, tính bằng giây: bè nền lặp lại cho tới hết `dur`. Một cue lặp thay cho
   * cả chuỗi cue rời (tiếng vó, tiếng bước chân) và chỉ tốn **một** thẻ `<audio>`.
   * Có `loop` thì phải có `dur`, không thì không biết lặp tới bao giờ.
   */
  loop: z.number().positive().optional(),
  /**
   * Vào và tắt dần, tính bằng giây trên trục của chính cue (`out` đo ngược từ hết `dur`).
   * Cho bè nền: tiếng rè máy chiếu vào cùng lúc hình đứng lại và lịm theo cái iris đang
   * khép — không có nó thì bè cắt phụt ở hai đầu.
   */
  fade: z
    .object({ in: z.number().min(0).default(0), out: z.number().min(0).default(0) })
    .optional(),
  /** Lời trong file; công cụ sinh `.srt` đọc ở đây chứ không gõ lại */
  text: z.string().optional(),
  volume: z.number().min(0).default(1),
});

/**
 * Một shot. `scene` bỏ trống là **shot hiệu ứng** — không có `cast[]` nào nên nó không phải
 * một scene; khi ấy `duration` là bắt buộc. Có `scene` thì độ dài suy từ `from`/`to` và
 * bảng slow-mo, cộng `hold`.
 */
const ShotSchema = z.object({
  id: z.string().min(1),
  scene: z.string().optional().describe("Tên file trong `scenes/`, không đuôi"),
  from: z.number().min(0).default(0).describe("Giây cảnh shot mở màn — cắt vào giữa cảnh dài"),
  to: z.number().min(0).optional().describe("Giây cảnh shot đóng; bỏ trống là hết cảnh"),
  /** Giây màn hình; bắt buộc khi không có `scene`, và đè mọi cách suy khác */
  duration: z.number().positive().optional(),
  hold: z.number().min(0).default(0).describe("Giây đệm thêm ở cuối khi hình cần dài hơn tiếng"),
  slow: z.array(SlowSchema).default([]),
  /**
   * Giây shot này chạy sẵn **sau lưng** shot trước: cú cắt rơi vào giữa một chuyển động
   * đang đà, không phải vào frame đầu của nó. Không kéo dài tập — chỉ mount sớm.
   */
  overlap: z.number().min(0).default(0),
  audio: z.array(CueSchema).default([]),
  /**
   * Luật đặt mốc có tên của cảnh theo tiếng: `{ "nui-dang": { cue: "dan-03", edge: "end",
   * offset: 0.3 } }` là mốc `nui-dang` của `scene` rơi vào 0,3 s sau khi cue `dan-03` dứt.
   * `stickman retime` đo file rồi ghi giây cảnh vào `scenes/<scene>.json` `marks`; `check`
   * kêu khi số ấy cũ. Cảnh vẫn tự đứng được — dải ảnh và MCP chỉ đọc `marks` của cảnh.
   */
  marks: z
    .record(
      z.string().min(1),
      z.object({
        cue: z.string().min(1),
        edge: z.enum(["start", "end"]).default("start"),
        offset: z.number().default(0),
      }),
    )
    .default({}),
});

const FontSchema = z.object({
  family: z.string(),
  file: z.string().describe("Tên file trong `public/fonts/`; bỏ trống là font hệ thống"),
  weight: z.number().int(),
});

/** Móc của một lớp vẽ code — docs/10-lop-ve-code.md */
export const LAYER_HOOKS = ["bg", "back", "front", "shake", "place"] as const;

/**
 * Thumbnail giữ lại gì của cảnh; trường bỏ trống là giữ nguyên. `cast` / `animals` / `props`
 * là danh sách `id` được ở lại (`[]` là bỏ hết), `bg: false` bỏ `scene.bg[]`, `fx: false` bỏ
 * `scene.fx[]`, `layers` là tên lớp vẽ code được ở lại, `hooks` là móc của chúng được chạy.
 */
const KeepSchema = z
  .object({
    cast: z.array(z.string()),
    animals: z.array(z.string()),
    props: z.array(z.string()),
    bg: z.boolean(),
    fx: z.boolean(),
    layers: z.array(z.string()),
    hooks: z.array(z.enum(LAYER_HOOKS)),
  })
  .partial();

const thumbFields = {
  scene: z.string().min(1),
  at: z.number().min(0).describe("Giây cảnh của khung được chụp"),
  zoom: z.number().positive(),
  origin: z.tuple([z.number(), z.number()]),
  shift: z.number(),
  lines: z.array(z.string()).min(1),
  /** Neo chữ theo tỉ lệ khung: mép trái và chân dòng đầu */
  textX: z.number(),
  textY: z.number(),
  size: z.number().positive().describe("Cỡ chữ theo chiều cao khung"),
  tilt: z.number(),
  font: FontSchema.partial(),
  ink: z.string(),
  paper: z.string(),
  shadow: z.string(),
  /** Một ký tự cuối dòng đổi màu — một điểm nhấn, không hơn */
  accent: z.object({ char: z.string().min(1), color: z.string() }),
  keep: KeepSchema,
};

/**
 * Thumbnail đã đủ trường: một khung phim thật ở giây `at` của `scene`, phóng quanh `origin`
 * (tỉ lệ khung, `[0.7, 0.16]` là góc trên phải) và đẩy ngang `shift`, cộng vài dòng hook.
 * docs/07-lam-tap.md
 */
const ThumbnailSchema = z.object({
  ...thumbFields,
  at: thumbFields.at.default(0),
  zoom: thumbFields.zoom.default(1.4),
  origin: thumbFields.origin.default([0.7, 0.16]),
  shift: thumbFields.shift.default(0.03),
  textX: thumbFields.textX.default(0.045),
  textY: thumbFields.textY.default(0.62),
  size: thumbFields.size.default(0.2),
  tilt: thumbFields.tilt.default(-3),
  font: z
    .object({
      family: FontSchema.shape.family.default("sans-serif"),
      file: FontSchema.shape.file.optional(),
      weight: FontSchema.shape.weight.default(800),
    })
    .prefault({}),
  ink: thumbFields.ink.default("#2a2118"),
  paper: thumbFields.paper.default("#f4f1e8"),
  shadow: thumbFields.shadow.default("#c9bb98"),
  accent: thumbFields.accent.optional(),
  keep: KeepSchema.default({}),
});

/** Một phần thumbnail, chưa điền mặc định: phần chung của tập và từng biến thể */
const ThumbnailPartSchema = z.object(thumbFields).partial();
type ThumbnailPart = z.infer<typeof ThumbnailPartSchema>;

const mergeThumb = (base: ThumbnailPart, v: ThumbnailPart = {}): ThumbnailPart => ({
  ...base,
  ...v,
  font: { ...base.font, ...v.font },
  keep: { ...base.keep, ...v.keep },
});

/**
 * `thumbnail` của tập. Không có `variants` thì chính nó là composition `<tập>-thumb`. Có thì
 * nó chỉ là phần chung, mỗi biến thể trộn lên nó thành một composition `<tập>-thumb-<khoá>`.
 */
const ThumbnailSpecSchema = ThumbnailPartSchema.extend({
  variants: z.record(z.string().regex(/^[a-z0-9-]+$/), ThumbnailPartSchema).optional(),
}).superRefine(({ variants, ...base }, ctx) => {
  const all = variants ? Object.entries(variants) : [["", {}] as const];
  for (const [key, v] of all) {
    const r = ThumbnailSchema.safeParse(mergeThumb(base, v));
    if (r.success) continue;
    for (const issue of r.error.issues)
      ctx.addIssue({
        code: "custom",
        path: key ? ["variants", key, ...issue.path] : issue.path,
        message: issue.message,
      });
  }
});

export const EpisodeSchema = z.object({
  schemaVersion: z
    .literal(EPISODE_VERSION, {
      error: "JSON tập thuộc phiên bản schema khác",
    })
    .default(EPISODE_VERSION),
  name: z.string().default("tap"),
  shots: z.array(ShotSchema).min(1),
  /** Nhạc nền chạy suốt tập; `at` tính từ giây 0 của tập */
  audio: z.array(CueSchema).default([]),
  /** Có là thêm composition `<tập>-thumb` một khung, hay một composition cho mỗi biến thể */
  thumbnail: ThumbnailSpecSchema.optional(),
});

export type EpisodeData = z.infer<typeof EpisodeSchema>;
export type ShotData = EpisodeData["shots"][number];
export type SlowData = z.infer<typeof SlowSchema>;
export type CueData = z.infer<typeof CueSchema>;
export type ThumbnailData = z.infer<typeof ThumbnailSchema>;

export const parseEpisode = (json: unknown) => EpisodeSchema.safeParse(json);

/** Composition id → thumbnail đủ trường, cho mọi thumbnail của một tập */
export const episodeThumbnails = (id: string, ep: EpisodeData): Record<string, ThumbnailData> => {
  if (!ep.thumbnail) return {};
  const { variants, ...base } = ep.thumbnail;
  if (!variants) return { [`${id}-thumb`]: ThumbnailSchema.parse(mergeThumb(base)) };
  return Object.fromEntries(
    Object.entries(variants).map(([key, v]) => [
      `${id}-thumb-${key}`,
      ThumbnailSchema.parse(mergeThumb(base, v)),
    ]),
  );
};
