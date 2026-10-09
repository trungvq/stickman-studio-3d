import { z } from "zod";
import { RIG } from "./constants";
import { StretchPieceSchema } from "./schema";
import { PARTS } from "./parts";

/** Bump khi đổi hình dạng JSON đạo cụ; `migrateProp` phải có nhánh tương ứng. */
export const PROP_VERSION = 2;

/** Hộp thân đạo cụ ở `scale: 1`, đơn vị rig — cao bằng nửa người, bề ngang theo `aspect` */
export const PROP_BODY = 200;

/** Hông người ngồi, đơn vị rig, so với điểm bánh sau chạm đất; `y` âm là trên mặt đất */
const SeatSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(-120),
});

const WheelSchema = z.object({
  /** Điểm chạm đất so với bánh sau, đơn vị rig */
  x: z.number().default(0),
  r: z.number().positive().default(44),
});

/**
 * Đạo cụ: một thân thay được và bánh vẽ code; bánh sau tuỳ, bánh trước chỉ có khi có bánh
 * sau. Gốc toạ độ là **điểm bánh sau chạm đất**; thân treo vào trục bánh sau nên bánh to
 * lên là xe tự nâng, điểm chạm đất không đổi. Không bánh (khúc gỗ, hòn đá) thì trục ấy
 * nằm ngay mặt đất: đáy thân đặt lên đất. docs/06-dao-cu.md
 */
export const PropSchema = z
  .object({
    schemaVersion: z
      .literal(PROP_VERSION, {
        error: "JSON đạo cụ thuộc phiên bản schema khác; cần bản @stickman3d/sketch khớp với nó",
      })
      .default(PROP_VERSION),
    name: z.string().default("prop"),
    line: z.string().default("#1a1a1a"),
    /** Hộp `PROP_BODY` cao, đáy đặt lên trục bánh sau rồi dịch `dx/dy`; `rotate` quanh trục ấy */
    body: StretchPieceSchema.prefault({}),
    wheel: z
      .object({
        /** `"none"` là ruột trong suốt: thấy thân xe qua nan hoa */
        fill: z.string().default("#ffffff"),
        /** `0` là đĩa đặc — quay cũng không thấy quay */
        spokes: z.number().int().min(0).default(8),
        stroke: z.number().positive().default(RIG.stroke),
      })
      .prefault({}),
    /** Bỏ trống là đạo cụ không bánh: đáy thân nằm trên đất */
    rear: WheelSchema.omit({ x: true }).optional(),
    /** Không khai là xe hai bánh (hay không bánh, nếu cũng không có `rear`) */
    front: WheelSchema.optional(),
    /**
     * Chỗ ngồi cho `cast[].sit`. Bỏ trống thì lấy của bộ phận thân (`PARTS[].seat`), thân
     * ảnh không khai là không ngồi được. `propSeat` là chỗ duy nhất trả lời. docs/06-dao-cu.md
     */
    seat: SeatSchema.optional(),
  })
  .superRefine((p, ctx) => {
    if (p.front && !p.rear)
      ctx.addIssue({
        code: "custom",
        message: "Bánh trước cần bánh sau — `front` mà không có `rear`",
        path: ["front"],
      });
  });

export type PropData = z.infer<typeof PropSchema>;

/** Nâng JSON đời cũ lên `PROP_VERSION`. File mới hơn thì trả nguyên để zod báo lỗi. */
export function migrateProp(json: unknown): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json;
  const o = structuredClone(json) as Record<string, unknown>;
  const from = typeof o.schemaVersion === "number" ? o.schemaVersion : 0;
  if (from > PROP_VERSION) return o;
  // v1 → v2 `rear` thành tuỳ chọn; file cũ không khai là xe có bánh sau mặc định, giữ nguyên nghĩa ấy
  if (from < 2 && o.rear === undefined) o.rear = {};
  o.schemaVersion = PROP_VERSION;
  return o;
}

export const parseProp = (json: unknown) => PropSchema.safeParse(migrateProp(json));

/**
 * Hộp thân đúng như `<Prop>` vẽ, trong hệ đạo cụ: gốc trên trái, cỡ, trục bánh sau và tên
 * bộ phận (nếu thân vẽ code). `aspect` của thân ảnh phải đo xong rồi mới hỏi.
 */
export function propBox(p: PropData) {
  const b = p.body;
  const part = b.src === "part" && b.part && PARTS[b.part] ? b.part : undefined;
  const aspect = part ? PARTS[part].aspect : b.aspect;
  const h = PROP_BODY * b.scale;
  const w = h * aspect * b.widthScale;
  // Không bánh thì trục ở ngay mặt đất: đáy thân chạm đất
  const axleY = -(p.rear?.r ?? 0);
  return { x: -w / 2 + b.dx, y: axleY - h + b.dy, w, h, axleY, part };
}

/**
 * Chỗ ngồi của đạo cụ trong hệ của nó: `seat` trong JSON, không có thì của bộ phận thân
 * (tỉ lệ hộp, nên đổi `scale`/`dx`/`dy` vẫn đúng chỗ). `undefined` là không ngồi được.
 * Không xoay theo `body.rotate`.
 */
export function propSeat(p: PropData): { x: number; y: number } | undefined {
  if (p.seat) return p.seat;
  const box = propBox(p);
  const s = box.part ? PARTS[box.part].seat : undefined;
  return s ? { x: box.x + box.w * s.x, y: box.y + box.h * s.y } : undefined;
}

/** Đạo cụ mới trong studio là một cái xe: có bánh sau để còn thấy nó lăn */
export const defaultProp = (): PropData => PropSchema.parse({ rear: {} });
