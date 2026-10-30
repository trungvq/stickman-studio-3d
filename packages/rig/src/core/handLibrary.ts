import { z } from "zod";
import {
  fingerVec,
  HAND_DOF,
  HAND_FIT,
  HAND_POSES,
  HAND_RELAXED,
  handVec,
  mixHand,
  type HandKey,
  type HandPose,
} from "./hand";

/** Bản schema của file dáng tay (`hands/<tên>.json`) rig hiểu */
export const HAND_SHAPE_VERSION = 1;

const num = z.number();
const ten = z.tuple([num, num, num, num, num, num, num, num, num, num]);

/**
 * Dáng tay có tên của thư viện (`hands/<tên>.json`): `fingers` mười góc ngón (`HAND_DOF` bỏ `turn`, `bend`), `fit` độ gập
 * thêm từng đốt (`HAND_FIT`), cùng nghĩa với kiểu cầm soạn tay. Không phân bên: tay trái dùng cùng góc. Mốc tay của cảnh
 * (`world.hands[].right|left.pose`) và mốc bàn tay của hành động (`keys[].hand`) gọi bằng tên file.
 * docs/01-rig.md#dáng-tay-có-tên
 */
export const HandShapeSchema = z.object({
  schemaVersion: z
    .literal(HAND_SHAPE_VERSION, {
      error: () => "JSON dáng tay thuộc phiên bản schema khác; cần bản @stickman3d/rig khớp với nó",
    })
    .default(HAND_SHAPE_VERSION),
  /** Mô tả cho người và agent đọc */
  note: z.string().min(1).optional(),
  fingers: ten,
  fit: ten.optional(),
});
export type HandShape = z.infer<typeof HandShapeSchema>;

export const parseHandShape = (json: unknown) => HandShapeSchema.safeParse(json);

/** Thư viện dáng tay theo tên không đuôi, do chỗ nạp đưa vào (`resolveScene`) */
export type HandShapes = Record<string, HandShape>;

/** Tên file dáng tay: chữ thường, số, gạch nối */
export const HAND_SHAPE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lý do tên `name` không dùng được cho một dáng của thư viện; được thì `undefined` */
export function handShapeNameProblem(name: string): string | undefined {
  if (!HAND_SHAPE_NAME.test(name)) return "tên chỉ gồm chữ thường, số và gạch nối (`[a-z0-9-]`)";
  if (name in HAND_POSES) return `\`${name}\` là dáng có sẵn của rig (\`HAND_POSES\`)`;
  return undefined;
}

/** Tên dáng có sẵn (`HAND_POSES`) hay của thư viện `lib` */
export const isHandShape = (name: string, lib: HandShapes = {}): boolean =>
  name in HAND_POSES || name in lib;

const FIT0 = HAND_FIT.map(() => 0);

/**
 * Hai mươi số ngón của dáng `name` (dáng có sẵn hay của thư viện `lib`): mười góc ngón rồi mười độ gập thêm (`HAND_FIT`),
 * hoà từ dáng nghỉ theo `w`. Không có dáng ấy thì `undefined`
 */
export function shapeFingers(name: string, lib: HandShapes = {}, w = 1): number[] | undefined {
  const own = name in HAND_POSES ? undefined : lib[name];
  const v = own
    ? [...own.fingers, ...(own.fit ?? FIT0)]
    : name in HAND_POSES
      ? [...fingerVec(HAND_POSES[name as HandPose]), ...FIT0]
      : undefined;
  if (!v) return undefined;
  return w === 1 ? v : mixHand([...fingerVec(HAND_RELAXED), ...FIT0], v, w);
}

/** Số bàn tay (`HAND_DOF` kèm `HAND_FIT`) với xoay, gập cổ tay của `v` và ngón `fingers` (hai mươi số của `shapeFingers`) */
export const withFingers = (v: readonly number[], fingers: readonly number[]): number[] => [
  v[0] ?? 0,
  v[1] ?? 0,
  ...fingers,
];

/**
 * Số bàn tay của một mốc hành động (`keys[].hand`) với thư viện `lib`: dáng của thư viện ra cả mười độ gập thêm, dáng có
 * sẵn như `handVec`. Tên không có ở đâu là dáng nghỉ — `resolveScene` và `check` báo trước khi tới đây
 */
export function handKeyVec(k: string | HandKey, lib: HandShapes = {}): number[] {
  const o: HandKey = typeof k === "string" ? { pose: k } : k;
  const own =
    o.pose !== undefined && !(o.pose in HAND_POSES) && shapeFingers(o.pose, lib, o.w ?? 1);
  return own ? withFingers([o.turn ?? 0, o.bend ?? 0], own) : handVec(o);
}

/** Hai mươi số ngón của số bàn tay `v`: mười góc ngón, mười độ gập thêm (thiếu là `0`) */
export const fingersOf = (v: readonly number[]): number[] => [
  ...v.slice(2, HAND_DOF.length),
  ...FIT0.map((_, i) => v[HAND_DOF.length + i] ?? 0),
];
