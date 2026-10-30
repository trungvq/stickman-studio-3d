import { createContext } from "react";
import {
  ANCHOR_NAMES,
  anchorAt,
  defaultCharacter,
  sceneAt,
  type Anchor,
  type AnchorName,
  type CastMember,
  type CharacterData,
  type SceneRuntime,
} from "@stickman3d/rig/core";

/**
 * Mốc trên một người 3D tại giây `t`, trong hệ toạ độ chỗ vẽ, kèm `scale` của người ấy để hiệu
 * ứng khai bằng đơn vị nhân vật nhân ra. Trả `null` nếu `cast` không có `id` ấy.
 */
export type FxAnchor = (
  cast: string,
  name: AnchorName,
  t: number,
) => (Anchor & { scale: number }) | null;

/** `ctx.anchor` của cảnh đang vẽ cho component lớp vẽ code; `<SceneWorld>` cấp, ngoài nó là `() => null` */
export const SceneAnchor = createContext<FxAnchor>(() => null);

/**
 * `FxAnchor` dựng từ `anchorAt` của rig — đường duy nhất để hiệu ứng bám vào người.
 * `characterOf` trả JSON nhân vật của một `cast` (chiều cao và đồ đang mặc đổi chỗ mốc); không
 * có thì lấy nhân vật mặc định. Tên mốc sai là lỗi.
 */
export const sceneAnchor =
  (rt: SceneRuntime, characterOf: (m: CastMember) => CharacterData | undefined): FxAnchor =>
  (cast, name, t) => {
    const m = rt.cast.find((c) => c.id === cast);
    if (!m) return null;
    if (!(ANCHOR_NAMES as readonly string[]).includes(name))
      throw new Error(`fx: \`${name}\` không phải mốc trên người (\`${cast}\`)`);
    const c = characterOf(m) ?? defaultCharacter();
    const a = anchorAt(rt, cast, name, t, c);
    return { ...a, scale: sceneAt(rt, cast, t, c.rig.height).scale };
  };
