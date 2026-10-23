// Runtime của cảnh (`resolveScene`) trên dữ liệu `worldData` của server, không `three`: trang dựng cảnh, đo mốc mới và luồng
// vệt (`trailWorker.ts`) dùng chung một cách dựng.
import {
  body3,
  castCharacter,
  defaultCharacter,
  resolveScene,
  type Body3,
  type CharacterData,
  type SceneData,
} from "@stickman3d/rig/core";

export type Data = {
  characters: Record<string, CharacterData>;
  actions: Record<string, unknown>;
  animals: Record<string, unknown>;
  props: Record<string, unknown>;
  held: Record<string, unknown>;
};

/**
 * `heights`, `bodies` của `cast` có file nhân vật — như `threeData` của render; `chars` như `check`: người không khai
 * `character` là `defaultCharacter()`
 */
export function castData(scene: SceneData, characters: Record<string, CharacterData>) {
  const heights: Record<string, number> = {};
  const bodies: Record<string, Body3> = {};
  const chars: Record<string, ReturnType<typeof castCharacter>> = {};
  for (const m of scene.cast) {
    const c = m.character ? characters[m.character] : defaultCharacter();
    if (!c) continue;
    chars[m.id] = castCharacter(m, c);
    if (!m.character) continue;
    heights[m.id] = c.rig.height;
    bodies[m.id] = body3(c);
  }
  return { heights, bodies, chars };
}

/** Runtime của cảnh (`resolveScene`), không dựng lưới */
export function runtimeOf(scene: SceneData, data: Data) {
  const { heights, bodies, chars } = castData(scene, data.characters);
  const runtime = resolveScene(
    scene,
    data.actions as never,
    data.animals as never,
    data.props as never,
    heights,
    bodies,
    data.held as never,
  );
  // mốc món `rest` tra tay người thả ở `rt.chars`, như `loadScene` của render
  runtime.chars = { ...chars, ...runtime.chars };
  return { runtime, heights, bodies };
}
