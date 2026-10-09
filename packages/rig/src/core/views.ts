import { ACCESSORY_SIDE, ACCESSORY_SIDE_OF } from "./accessoryViews";
import { CHIN_SIDE, CHIN_SIDE_OF } from "./chinViews";
import type { GarmentShape } from "./garments";
import { GARMENT_BACK, GARMENT_BACK_OF, GARMENT_SIDE, GARMENT_SIDE_OF } from "./garmentViews";
import { HAIRSTYLES } from "./hairstyles";
import { isFrontal, type View } from "./types";

/** Hình của một mảnh ở góc nhìn `side` / `rear` / `back`, dùng chung cho nhiều mảnh chính diện */
export interface ViewArt {
  label: string;
  shapes: readonly GarmentShape[];
  /** Chỉ cho kiểu tóc nghiêng: khối rủ xuống vai, cánh tay trên gần đang thõng nằm dưới nó */
  overHead?: boolean;
  frame?: ViewSocket;
}

/**
 * Khung toạ độ mà `d` của `ViewArt` viết trong đó, theo socket. Đầu: tâm `(cx, cy)`, bán kính
 * `r`, mặt nhìn về `+x`. Thân: tâm hông `(cx, hipY)`, khớp cổ ở `neckY`, mặt nhìn về `+x`.
 * docs/02-trang-phuc.md#góc-nhìn
 */
export const VIEW_FRAME = {
  hair: { w: 320, h: 320, cx: 160, cy: 160, r: 100 },
  hairBack: { w: 320, h: 520, cx: 160, cy: 160, r: 100 },
  chin: { w: 320, h: 520, cx: 160, cy: 160, r: 100 },
  crown: { w: 320, h: 320, cx: 160, cy: 160, r: 100 },
  faceAcc: { w: 320, h: 320, cx: 160, cy: 160, r: 100 },
  headAcc: { w: 320, h: 320, cx: 160, cy: 160, r: 100 },
  neck: { w: 150, h: 190, cx: 75, hipY: 140, neckY: 20 },
  hem: { w: 150, h: 300, cx: 75, hipY: 100 },
  sleeveNear: { w: 60, h: 100 },
  sleeveFar: { w: 60, h: 100 },
  torso: { w: 150, h: 190, cx: 75, hipY: 140, neckY: 20 },
} as const;

export type ViewSocket = keyof typeof VIEW_FRAME;

export const isViewSocket = (k: string): k is ViewSocket => k in VIEW_FRAME;

const TABLES: Record<
  Exclude<View, "front" | "quarter">,
  [Record<string, string>, Record<string, ViewArt>][]
> = {
  side: [
    [GARMENT_SIDE_OF, GARMENT_SIDE],
    [CHIN_SIDE_OF, CHIN_SIDE],
    [ACCESSORY_SIDE_OF, ACCESSORY_SIDE],
  ],
  rear: [],
  back: [[GARMENT_BACK_OF, GARMENT_BACK]],
};

const styleArts = new Map<string, ViewArt>();

/**
 * Hình của kiểu tóc ở góc `view`, mọi góc đều trong khung tâm sọ: chính diện là lớp `over`,
 * góc khác là một khối kín. `under` là lớp chính diện sau thân. docs/02-trang-phuc.md#kiểu-tóc
 */
export function hairstyleArt(part: string | undefined, view: View | "under"): ViewArt | undefined {
  const s = HAIRSTYLES[part ?? ""];
  if (!s) return undefined;
  const shapes = view === "under" ? s.under : isFrontal(view) ? s.over : s[view];
  if (!shapes?.length) return undefined;
  const key = `${part}/${view}`;
  let art = styleArts.get(key);
  if (!art) {
    art = {
      label: s.label,
      shapes,
      frame: view !== "under" && isFrontal(view) ? "hair" : "hairBack",
      overHead: view === "side" && s.overHead,
    };
    styleArts.set(key, art);
  }
  return art;
}

/** Hình vẽ riêng cho góc `view` (không phải chính diện); không có thì chỗ vẽ tự lùi về hình chính diện */
export function viewArt(part: string | undefined, view: View): ViewArt | undefined {
  if (!part || isFrontal(view)) return undefined;
  if (HAIRSTYLES[part]) return hairstyleArt(part, view);
  for (const [of, art] of TABLES[view]) {
    const key = of[part];
    if (key && art[key]) return art[key];
  }
  return undefined;
}
