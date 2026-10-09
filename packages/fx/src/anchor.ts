import { createContext } from "react";
import {
  ANCHOR_NAMES,
  ANIMAL_ANCHOR_NAMES,
  anchorAt,
  animalAnchorAt,
  animalAt,
  defaultCharacter,
  sceneAt,
  type Anchor,
  type AnchorName,
  type AnimalAnchorName,
  type CastMember,
  type CharacterData,
  type SceneRuntime,
} from "@stickman3d/sketch";

/**
 * Mốc trên một người (hay một con vật) tại giây `t`, trong hệ toạ độ chỗ vẽ, kèm `scale` của
 * nó để hiệu ứng khai bằng đơn vị nhân vật nhân ra. Trả `null` nếu không có `id` ấy.
 */
export type FxAnchor = (
  cast: string,
  name: AnchorName | AnimalAnchorName,
  t: number,
) => (Anchor & { scale: number }) | null;

/** `ctx.anchor` của cảnh đang vẽ cho component lớp vẽ code; `<SceneWorld>` cấp, ngoài nó là `() => null` */
export const SceneAnchor = createContext<FxAnchor>(() => null);

/**
 * `FxAnchor` dựng từ `anchorAt` / `animalAnchorAt` của rig — đường duy nhất để hiệu ứng bám
 * vào người hay thú. `characterOf` trả JSON nhân vật của một `cast` (chiều cao và mảnh đang
 * mặc đổi chỗ mốc); không có thì lấy nhân vật mặc định. Tên mốc sai loại là lỗi.
 */
export const sceneAnchor =
  (rt: SceneRuntime, characterOf: (m: CastMember) => CharacterData | undefined): FxAnchor =>
  (cast, name, t) => {
    const m = rt.cast.find((c) => c.id === cast);
    if (m) {
      if (!(ANCHOR_NAMES as readonly string[]).includes(name))
        throw new Error(`fx: \`${name}\` không phải mốc trên người (\`${cast}\`)`);
      const c = characterOf(m) ?? defaultCharacter();
      return {
        ...anchorAt(rt, cast, name as AnchorName, t, c),
        scale: sceneAt(rt, cast, t, c.rig.height).scale,
      };
    }
    const a = rt.animals.find((b) => b.id === cast);
    if (!a) return null;
    if (!(ANIMAL_ANCHOR_NAMES as readonly string[]).includes(name))
      throw new Error(`fx: \`${name}\` không phải mốc trên con vật (\`${cast}\`)`);
    const host = a.host?.kind === "carry" ? rt.cast.find((c) => c.id === a.host!.id) : undefined;
    const carrier = (host && characterOf(host)) ?? defaultCharacter();
    return {
      ...animalAnchorAt(rt, cast, name as AnimalAnchorName, t, carrier),
      scale: animalAt(rt, cast, t).scale,
    };
  };
