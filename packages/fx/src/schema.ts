import { z } from "zod";
import { ANCHOR_NAMES, INK, PAPER, SCENE_Z } from "@stickman3d/rig/core";

/**
 * Lớp vẽ của một hiệu ứng: `back` trước cả cast (nguồn sáng dưới nước, người trồi lên từ
 * trong nó), `front` sau cast (vật đang bay, chữ, lá), `ui` trên tất cả (nút, iris — thứ
 * không thuộc thế giới truyện). Mỗi loại có mặc định riêng. docs/09-hieu-ung.md
 */
export const FX_LAYERS = ["back", "front", "ui"] as const;
export type FxLayer = (typeof FX_LAYERS)[number];

/** Nấc trên trục `z` của cảnh; bỏ trống là băng của `layer` trong `SCENE_Z`. docs/03-scene.md#trục-z */
const zField = z.number().optional();
/** Hệ toạ độ của mục: `stage` là sân khấu; `camera` là gốc ở tâm khung máy quay tại `t`, mục lia theo máy */
const frameField = z.enum(["stage", "camera"]).default("stage");
/** Tên một mục `kind: "clip"` của cùng cảnh; mục này chỉ vẽ trong hình ấy */
const clipField = z.string().min(1).optional();
const layer = (dflt: FxLayer) => z.enum(FX_LAYERS).default(dflt);
const FX_BAND = { back: SCENE_Z.fxBack, front: SCENE_Z.fxFront, ui: SCENE_Z.fxUi } as const;
const sec = z.number().describe("Giây scene");

/** Màu nước mặc định cho vòng sóng, bọt và tóe — cùng một mặt hồ thì cùng một bảng */
export const WATER_LINE = "#5f8496";
export const FOAM = "#f4f9fb";

const GlowSchema = z.object({
  kind: z.literal("glow"),
  layer: layer("back"),
  z: zField,
  frame: frameField,
  clip: clipField,
  x: z.number(),
  y: z.number(),
  from: sec,
  to: sec,
  /** Lên hết cỡ mất bao lâu, và tắt dần trong bao lâu cuối cùng */
  rise: z.number().positive().default(1),
  fall: z.number().positive().default(1),
  /** Bán kính quầng */
  r: z.number().positive(),
  /** `rays`: chiều dài nan tia; `sparkle`: chiều dài cánh sao lớn */
  ray: z.number().nonnegative().default(0),
  /** `rays`: số nan; `sparkle`: số sao nhỏ */
  rays: z.number().int().nonnegative().default(12),
  /** Độ trên giây; ở `sparkle` chỉ còn xoay chậm cả cụm */
  spin: z.number().default(0),
  color: z.string().default("#fff3c4"),
  /** Phần tia dồn lên trên: `0` toả đều, `1` chỉ lên — nguồn sáng dưới mặt nước không chiếu xuống đáy */
  up: z.number().min(0).max(1).default(0),
  /** `rays` là nguồn sáng ở **một chỗ**; `sparkle` là **một vật đang cầm** bắt sáng */
  style: z.enum(["rays", "sparkle"]).default("rays"),
});

const TearsSchema = z.object({
  kind: z.literal("tears"),
  layer: layer("front"),
  z: zField,
  frame: frameField,
  clip: clipField,
  /** `id` trong `cast[]`; giọt bám đúng con mắt qua `anchorAt`, tính lại theo lúc từng giọt sinh ra */
  cast: z.string().min(1),
  from: sec,
  to: sec,
  every: z.number().positive().default(0.24),
  life: z.number().positive().default(0.95),
  /** Điểm bắn lệch so với con mắt, đơn vị nhân vật: `dx` ra đuôi mắt, `dy` xuống mí dưới */
  dx: z.number().default(5),
  dy: z.number().default(2),
  vx: z.number().default(215),
  vy: z.number().default(-150),
  g: z.number().default(760),
  /** Bán kính ngang của giọt, đơn vị nhân vật */
  r: z.number().positive().default(17),
  fill: z.string().default("#e6f4fa"),
  line: z.string().default("#2e6076"),
});

const FizzSchema = z.object({
  kind: z.literal("fizz"),
  layer: layer("front"),
  z: zField,
  frame: frameField,
  clip: clipField,
  x: z.number(),
  y: z.number(),
  /** Âm là bọt đã sủi từ trước khi cảnh mở — frame đầu đã có sẵn một đám đủ tuổi */
  from: sec,
  to: sec,
  every: z.number().positive().default(0.08),
  life: z.number().positive().default(0.5),
  r: z.number().positive().default(6),
  /** Toả ngang bao xa quanh điểm chìm */
  spread: z.number().nonnegative().default(30),
  /** Từ giây này bọt thưa dần cho tới `to`; bỏ trống là không thưa */
  thin: sec.optional(),
  foam: z.string().default(FOAM),
  line: z.string().default(WATER_LINE),
});

const pieceSource = {
  piece: z.string().min(1).optional(),
};
const oneSource = (m: { piece?: string }) => Boolean(m.piece);
const sourceError = { message: "Cần `piece`: file ảnh trong `pieces/`" };

const ThrowSchema = z
  .object({
    kind: z.literal("throw"),
    layer: layer("front"),
    z: zField,
    frame: frameField,
    clip: clipField,
    /** File ảnh trong `pieces/` */
    ...pieceSource,
    /** Giây rời tay — khớp với mốc `equip` tắt socket ấy */
    t0: sec,
    /** Bay bao lâu thì chạm */
    flight: z.number().positive(),
    /** Tâm ảnh lúc rời tay: hỏi `scene_probe` với `anchors: ["handNear"]` */
    x0: z.number(),
    y0: z.number(),
    vx: z.number(),
    vy: z.number(),
    g: z.number().default(1567),
    /** Góc SVG lúc rời tay (`deg` của mốc) và tốc độ xoay, độ trên giây */
    deg0: z.number(),
    spin: z.number().default(0),
    w: z.number().positive(),
    h: z.number().positive(),
    /** Co lại bao nhiêu phần lúc chạm (ra xa) */
    shrink: z.number().min(0).max(1).default(0),
    /** Tóe nước và vòng sóng kéo dài bao lâu sau khi chạm; `0` là không có mặt nước */
    splash: z.number().nonnegative().default(0),
    ripple: z.number().nonnegative().default(0),
    foam: z.string().default(FOAM),
    line: z.string().default(WATER_LINE),
  })
  .refine(oneSource, sourceError);

const FlySchema = z
  .object({
    kind: z.literal("fly"),
    layer: layer("front"),
    z: zField,
    frame: frameField,
    clip: clipField,
    ...pieceSource,
    t0: sec,
    flight: z.number().positive(),
    /** Hai đầu đường bay: hai bàn tay, hỏi `scene_probe` ở hai mốc */
    x0: z.number(),
    y0: z.number(),
    x1: z.number(),
    y1: z.number(),
    /** Vồng lên bao nhiêu ở giữa (âm là lên trời) */
    arc: z.number().default(-150),
    deg0: z.number(),
    deg1: z.number(),
    w0: z.number().positive(),
    h0: z.number().positive(),
    w1: z.number().positive(),
    h1: z.number().positive(),
    /** Bán kính vòng sáng theo nửa chiều cao ảnh lúc ấy */
    r: z.number().positive().default(1.15),
    color: z.string().default("#fff3c4"),
  })
  .refine(oneSource, sourceError);

const PausedThrowSchema = z
  .object({
    kind: z.literal("pausedThrow"),
    layer: layer("front"),
    z: zField,
    frame: frameField,
    clip: clipField,
    ...pieceSource,
    t0: sec,
    /** Giây đồng hồ của chính nó, không tính quãng bị bấm dừng */
    flight: z.number().positive(),
    /** Bấm dừng và bấm chạy; trong quãng này đứng im kể cả xoay */
    hold: z.object({ from: sec, to: sec }),
    x0: z.number(),
    y0: z.number(),
    x1: z.number(),
    y1: z.number(),
    arc: z.number().default(-250),
    deg0: z.number(),
    spin: z.number().default(0),
    w: z.number().positive(),
    h: z.number().positive(),
    /** Tia loé lúc chạm kéo dài bao lâu */
    clang: z.number().nonnegative().default(0.4),
    /** Bật ra khỏi điểm chạm rồi thôi vẽ sau `life`; bỏ trống là nằm lại */
    bounce: z
      .object({ vx: z.number(), vy: z.number(), g: z.number(), spin: z.number(), life: z.number() })
      .optional(),
    line: z.string().default(INK),
  })
  .refine(oneSource, sourceError);

const LeafSchema = z.object({
  /** Vào sau `from` bao lâu, đi hết đường mất bao lâu */
  delay: z.number().nonnegative().default(0),
  dur: z.number().positive().default(3.6),
  /** Nửa chiều dài lá */
  size: z.number().positive().default(20),
  /** Lệch dọc so với đường gió — cả vòng tròn cũng dời theo */
  dy: z.number().default(0),
  /** Lật qua lật lại mấy lần một giây */
  flutter: z.number().default(2.2),
  fill: z.string().default("#d9a94a"),
});

const GustSchema = z.object({
  kind: z.literal("gust"),
  layer: layer("front"),
  z: zField,
  frame: frameField,
  clip: clipField,
  from: sec,
  span: z.number().positive(),
  /** Điểm vào, ngoài mép; điểm lượn vòng bán kính `r` phía trên nó; điểm ra */
  x0: z.number(),
  y0: z.number(),
  lx: z.number(),
  ly: z.number(),
  r: z.number().nonnegative().default(0),
  x1: z.number(),
  y1: z.number(),
  arcIn: z.number().default(-50),
  arcOut: z.number().default(-70),
  /** Nhấp nhô trên hai cung: biên độ và số sóng mỗi 1000 đơn vị đường */
  bob: z.number().default(12),
  waves: z.number().default(2),
  leaves: z.array(LeafSchema).default([]),
  /** Vệt gió rời: mấy vệt, lệch dọc trong ±`spread`, mỗi vệt chạy hết đường trong `sweep` giây */
  streaks: z.number().int().nonnegative().default(5),
  spread: z.number().nonnegative().default(90),
  sweep: z.number().positive().default(1.5),
  line: z.string().default(INK),
});

const CaptionSchema = z.object({
  kind: z.literal("caption"),
  layer: layer("front"),
  z: zField,
  frame: frameField,
  clip: clipField,
  /** Các vế hiện dần, xếp từ trên xuống */
  lines: z.array(z.object({ text: z.string(), at: sec })).min(1),
  /** Neo, toạ độ scene: tâm khi `align: "middle"`, không thì mép trái; `y` là chân chữ */
  x: z.number(),
  y: z.number(),
  align: z.enum(["start", "middle"]).default("start"),
  /** Đơn vị scene ở zoom 1 — chia cho zoom lúc vẽ nên cỡ trên màn hình giữ nguyên khi máy quay phóng */
  size: z.number().positive().default(32),
  tilt: z.number().default(0),
  until: sec,
  /** Thay vì tắt thì bị thổi bay */
  blow: z
    .object({ at: sec, dx: z.number(), dy: z.number(), dur: z.number().positive() })
    .optional(),
  font: z.string().default("'Noto Sans Black', 'Noto Sans', 'Liberation Sans', sans-serif"),
  fill: z.string().default("#ffffff"),
  stroke: z.string().default("#000000"),
});

const PressSchema = z.object({
  t: sec,
  x: z.number(),
  y: z.number(),
  icon: z.enum(["pause", "play"]),
  /** Con trỏ chuột hiện ở đây `lead` giây trước, trượt tới chỗ bấm, click, rồi mờ; bỏ trống là bàn tay trong cảnh bấm */
  cursor: z.object({ x: z.number(), y: z.number(), lead: z.number().positive() }).optional(),
});

const ButtonsSchema = z.object({
  kind: z.literal("buttons"),
  layer: layer("ui"),
  z: zField,
  frame: frameField,
  clip: clipField,
  presses: z.array(PressSchema).min(1),
  r: z.number().positive().default(34),
  /** Nút loé lên rồi tắt trong bấy nhiêu giây */
  life: z.number().positive().default(0.85),
  line: z.string().default(INK),
  fill: z.string().default("#ffffff"),
});

const IrisSchema = z.object({
  kind: z.literal("iris"),
  layer: layer("ui"),
  z: zField,
  frame: frameField,
  clip: clipField,
  x: z.number(),
  y: z.number(),
  /** Thu từ ngoài khung về bán kính `r` trong `from → to`, giữ tới `close`, đóng hẳn trong `shut` giây */
  from: sec,
  to: sec,
  r: z.number().positive(),
  close: sec,
  shut: z.number().positive().default(0.35),
  color: z.string().default("#15120e"),
});

/** Mặc định dùng chung của `bubble` và `<Bubble>` cho lớp vẽ code */
export const BUBBLE = {
  fill: "#fffdf6",
  line: INK,
  width: 5,
  r: 26,
  tail: 70,
  curl: 0.35,
  dots: 2,
  spikes: 20,
  font: "'Noto Sans Black', 'Noto Sans', 'Liberation Sans', sans-serif",
  grawlix: "#%&$¥€@*!?§",
} as const;

const BubbleItemSchema = z
  .object({
    /** Bật ra lúc này; bỏ trống là cùng lúc bong bóng mở */
    at: sec.optional(),
    /** Thôi vẽ từ giây này — đổi ruột giữa chừng mà không đóng hộp */
    until: sec.optional(),
    /** Tâm món, tính từ tâm hộp */
    x: z.number().default(0),
    y: z.number().default(0),
    /** Nguồn hình `piece` cần `w` và `h`; chữ dùng `text` (`\n` xuống dòng) */
    ...pieceSource,
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    deg: z.number().default(0),
    text: z.string().min(1).optional(),
    size: z.number().positive().default(40),
    /** Màu chữ; bỏ trống là màu viền bong bóng */
    fill: z.string().optional(),
  })
  .refine((m) => (m.piece ? !m.text && !!m.w && !!m.h : !!m.text), {
    message: "Món bong bóng là piece kèm w/h, hoặc text — chỉ một nguồn",
  });

const GrawlixSchema = z.object({
  /** Bộ ký tự bốc ra, mỗi ký tự một ô */
  chars: z.string().min(2).default(BUBBLE.grawlix),
  count: z.number().int().positive().default(5),
  /** Giây một lượt đổi mặt ký tự */
  every: z.number().positive().default(0.1),
  size: z.number().positive().default(52),
  /** Khoảng cách tâm hai ô */
  gap: z.number().positive().default(50),
});

const BubbleSchema = z
  .object({
    kind: z.literal("bubble"),
    layer: layer("front"),
    z: zField,
    frame: frameField,
    clip: clipField,
    /** `speech` hộp bo góc + đuôi; `thought` hộp + chuỗi bọt tròn; `shout` viền răng cưa, phập phồng và rung */
    style: z.enum(["speech", "thought", "shout"]).default("speech"),
    /** Thân của `speech` / `thought`: `round` hộp bo góc `r` (`r` ≥ nửa cạnh ngắn là viên thuốc, hộp vuông thành tròn), `oval`, `cloud`; bỏ trống là `round` cho `speech`, `cloud` cho `thought` */
    shape: z.enum(["round", "oval", "cloud"]).optional(),
    /** Mở bằng `pop`, tan dần `fade` giây cuối trước `shut` */
    open: sec,
    shut: sec,
    grow: z.number().positive().optional(),
    fade: z.number().positive().optional(),
    /** Mũi đuôi, toạ độ scene; hay bỏ trống và bám người qua `cast` */
    tip: z.object({ x: z.number(), y: z.number() }).optional(),
    /** `id` trong `cast[]`: mũi đuôi là mốc `anchor` cộng `dx` / `dy` đơn vị nhân vật */
    cast: z.string().min(1).optional(),
    anchor: z.enum(ANCHOR_NAMES).default("head"),
    dx: z.number().default(0),
    dy: z.number().default(0),
    /** Đọc mốc mỗi frame thay vì một lần lúc `open` — bong bóng lắc theo đầu */
    follow: z.boolean().default(false),
    /** Tâm hộp tính từ mũi đuôi, và cỡ hộp; đơn vị scene ở zoom 1 — cả bong bóng chia zoom quanh mũi đuôi */
    box: z.object({
      dx: z.number(),
      dy: z.number(),
      w: z.number().positive(),
      h: z.number().positive(),
    }),
    r: z.number().nonnegative().default(BUBBLE.r),
    /** Bề ngang chân đuôi `speech`, không quá nửa cạnh ngắn của `box`; `0` là không đuôi */
    tail: z.number().nonnegative().default(BUBBLE.tail),
    /** Độ cong đuôi `speech`, phần của chiều dài đuôi; `0` là đuôi thẳng */
    curl: z.number().default(BUBBLE.curl),
    /** Số bọt của `thought`, to nhất sát thân; hộp gần mũi quá thì bớt bọt nhỏ */
    dots: z.number().int().nonnegative().default(BUBBLE.dots),
    /** Số răng của `shout` */
    spikes: z.number().int().min(6).default(BUBBLE.spikes),
    items: z.array(BubbleItemSchema).default([]),
    /** Dãy ký tự chửi đổi liên tục ở giữa hộp */
    grawlix: GrawlixSchema.optional(),
    font: z.string().default(BUBBLE.font),
    fill: z.string().default(BUBBLE.fill),
    line: z.string().default(BUBBLE.line),
    /** Nét viền; `0` là mảng phẳng không viền */
    width: z.number().nonnegative().default(BUBBLE.width),
  })
  .refine((b) => b.tip || b.cast, { message: "bubble cần `tip` hay `cast`" });

const TypewriterSchema = z.object({
  kind: z.literal("typewriter"),
  layer: layer("front"),
  z: zField,
  frame: frameField,
  clip: clipField,
  /** Chữ gõ xong; dòng xếp theo chính chuỗi này nên không xô khi đang gõ */
  text: z.string().min(1),
  /** Thẻ hiện ở `from` với con trỏ đứng; phím đầu sau đó `lead` giây, rồi mỗi phím `every` lệch `jitter` (phần của `every`, băm theo số thứ tự phím) */
  from: sec,
  lead: z.number().nonnegative().default(0.3),
  every: z.number().positive().default(0.14),
  jitter: z.number().min(0).max(1).default(0.2),
  /** Từng phím đích danh: chữ đã hiện sau phím ấy — gõ kiểu Telex `NA` rồi `NĂ`. Có thì bỏ qua `lead` / `every` / `jitter` */
  keys: z.array(z.object({ at: sec, text: z.string() })).optional(),
  until: sec,
  x: z.number().default(0),
  y: z.number().default(0),
  align: z.enum(["start", "middle"]).default("middle"),
  /** Đơn vị scene ở zoom 1, chia cho zoom lúc vẽ như `caption` */
  size: z.number().positive().default(96),
  font: z.string().default("'Noto Sans Black', 'Noto Sans', 'Liberation Sans', sans-serif"),
  fill: z.string().default("#2a2118"),
  stroke: z.string().default(PAPER),
  /** Bóng lệch phải-dưới; bỏ trống là không bóng */
  shadow: z.string().optional(),
  /** Ký tự con trỏ, `""` là không có; đứng yên lúc gõ và `settle` giây sau, rồi nhấp nháy chu kỳ `blink` */
  cursor: z.string().default("|"),
  settle: z.number().nonnegative().default(0.3),
  blink: z.number().positive().default(0.5),
  /** Nền kín khung; bỏ trống là chữ trên cảnh */
  bg: z.string().optional(),
});

const DayNightSchema = z.object({
  kind: z.literal("dayNight"),
  layer: layer("front"),
  z: zField,
  frame: frameField,
  clip: clipField,
  /** `days` vòng ngày đêm trong `from → to`, hai đầu mờ vào / ra `fade` giây */
  from: sec,
  to: sec,
  days: z.number().positive().default(1),
  fade: z.number().nonnegative().default(0.3),
  /** Cung của mặt trời và mặt trăng: mọc ở `(x0, y0)`, lặn ở `(x1, y1)`, vồng `arc` ở giữa (âm là lên trời) */
  x0: z.number(),
  y0: z.number(),
  x1: z.number(),
  y1: z.number(),
  arc: z.number().default(-150),
  /** Phần ngày của một vòng, và phần chạng vạng ở cuối ngày / cuối đêm */
  day: z.number().min(0.05).max(0.95).default(0.6),
  dusk: z.number().min(0).max(0.5).default(0.1),
  r: z.number().positive().default(30),
  /** Màn đêm phủ cả khung: màu và độ đặc lúc tối nhất */
  night: z.string().default("#101a3a"),
  dark: z.number().min(0).max(1).default(0.55),
  /** Số sao, rải trong hộp của cung */
  stars: z.number().int().nonnegative().default(8),
  sun: z.string().default("#f7c948"),
  sunLine: z.string().default("#c98a1b"),
  moon: z.string().default("#fff4c2"),
  moonLine: z.string().default("#c9b26a"),
});

/**
 * Hình cắt dùng chung: các mục khác trỏ `clip` vào `name` của nó — mưa và bão cùng nằm gọn
 * trong một cửa sổ. Không vẽ gì; `layer` / `z` chỉ quyết định chỗ `<clipPath>` được khai
 */
const ClipSchema = z.object({
  kind: z.literal("clip"),
  layer: layer("back"),
  z: zField,
  frame: frameField,
  name: z.string().min(1),
  /** Một trong hai: hộp, hay `d` của một `<path>` */
  rect: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
  path: z.string().min(1).optional(),
});

export const FxSchema = z.discriminatedUnion("kind", [
  ClipSchema,
  GlowSchema,
  TearsSchema,
  FizzSchema,
  ThrowSchema,
  FlySchema,
  PausedThrowSchema,
  GustSchema,
  CaptionSchema,
  ButtonsSchema,
  IrisSchema,
  BubbleSchema,
  TypewriterSchema,
  DayNightSchema,
]);

export const FX_KINDS = [
  "clip",
  "glow",
  "tears",
  "fizz",
  "throw",
  "fly",
  "pausedThrow",
  "gust",
  "caption",
  "buttons",
  "iris",
  "bubble",
  "typewriter",
  "dayNight",
] as const;

export type FxData = z.infer<typeof FxSchema>;
export type FxKind = FxData["kind"];
export type GlowData = z.infer<typeof GlowSchema>;
export type TearsData = z.infer<typeof TearsSchema>;
export type FizzData = z.infer<typeof FizzSchema>;
export type ThrowData = z.infer<typeof ThrowSchema>;
export type FlyData = z.infer<typeof FlySchema>;
export type PausedThrowData = z.infer<typeof PausedThrowSchema>;
export type GustData = z.infer<typeof GustSchema>;
export type LeafData = z.infer<typeof LeafSchema>;
export type CaptionData = z.infer<typeof CaptionSchema>;
export type ButtonsData = z.infer<typeof ButtonsSchema>;
export type PressData = z.infer<typeof PressSchema>;
export type IrisData = z.infer<typeof IrisSchema>;
export type ClipData = z.infer<typeof ClipSchema>;
export type BubbleData = z.infer<typeof BubbleSchema>;
export type BubbleItemData = z.infer<typeof BubbleItemSchema>;
export type GrawlixData = z.infer<typeof GrawlixSchema>;
export type TypewriterData = z.infer<typeof TypewriterSchema>;
export type DayNightData = z.infer<typeof DayNightSchema>;

export const FxListSchema = z.array(FxSchema);

/** `scene.fx` qua zod của gói này; rig chỉ mang danh sách theo, không hiểu nó */
export const parseFx = (list: unknown) => FxListSchema.safeParse(list);

const CACHE = new WeakMap<object, FxData[]>();

/**
 * Danh sách hiệu ứng của một scene (hay `SceneRuntime`) đã parse, cache theo chính mảng
 * `fx` — ba đường render gọi mỗi frame. Sai hình dạng thì ném lỗi có đường dẫn mục.
 */
export function sceneFx(scene: { fx: unknown[] }): FxData[] {
  const hit = CACHE.get(scene.fx);
  if (hit) return hit;
  const r = parseFx(scene.fx);
  if (!r.success)
    throw new Error(
      `scene.fx: ${r.error.issues.map((i) => `${i.path.join(".") || "(gốc)"}: ${i.message}`).join("; ")}`,
    );
  CACHE.set(scene.fx, r.data);
  return r.data;
}

/** Nấc `z` của một mục: khai thẳng, hay băng mặc định của `layer` */
export const fxZ = (f: Pick<FxData, "layer" | "z">): number => f.z ?? FX_BAND[f.layer];

/** File mảnh mà các hiệu ứng vẽ tới (`throw`, `fly`, `pausedThrow`, món của `bubble`) — chỗ nạp ảnh gom `urls` từ đây */
export const fxFiles = (list: FxData[]): string[] => [
  ...new Set(
    list.flatMap((f) =>
      "piece" in f
        ? f.piece
          ? [f.piece]
          : []
        : f.kind === "bubble"
          ? f.items.flatMap((m) => (m.piece ? [m.piece] : []))
          : [],
    ),
  ),
];

/** Mốc trên người mà `tears` bám: hai con mắt, tên như `ANCHOR_NAMES` của rig */
export const EYE_ANCHORS = [
  "eyeNear",
  "eyeFar",
] as const satisfies readonly (typeof ANCHOR_NAMES)[number][];

export { INK, PAPER };
