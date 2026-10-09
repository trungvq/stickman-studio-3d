import type { ReactNode } from "react";
import { Animal, type AnimalProps } from "./Animal";
import type { Slots } from "./Character";
import { animalAt, type AnimalMember, type SceneRuntime, type ScenePose } from "./scene";
import type { PieceUrls } from "./schema";

/**
 * Dựng khe vẽ của `<Character>` từ một `sceneAt`: con vật đang cưỡi vào `mount` và
 * `mountFront` (cánh gần, vẽ trước cả người cưỡi), con đang cầm vào `handNear` / `handFar`.
 * Ba đường render gọi chung, chỉ khác nhau ở `urlsOf` — ảnh của con vật nạp ở đâu.
 * `extra` là `shadow` cho mọi con.
 */
export function castSlots(
  rt: SceneRuntime,
  sp: ScenePose,
  time: number,
  urlsOf: (a: AnimalMember) => PieceUrls = () => ({}),
  extra: Pick<AnimalProps, "shadow"> = {},
): Slots | undefined {
  const beast = (id: string, props: Omit<AnimalProps, "animal" | "pose">): ReactNode => {
    const a = rt.animals.find((m) => m.id === id);
    if (!a) return null;
    const { pose, mouth, eyes } = animalAt(rt, id, time);
    return (
      <Animal
        animal={a.spec}
        urls={urlsOf(a)}
        pose={pose}
        mouth={mouth}
        eyes={eyes}
        {...extra}
        {...props}
      />
    );
  };
  const out: Slots = {};
  if (sp.mounted) {
    const { id, ...at } = sp.mounted;
    out.mount = beast(id, { ...at, part: "back" });
    out.mountFront = beast(id, { ...at, part: "front" });
  }
  for (const c of sp.carried) {
    const { id, socket, ...at } = c;
    out[socket] = beast(id, at);
  }
  return out.mount || out.handNear || out.handFar ? out : undefined;
}
