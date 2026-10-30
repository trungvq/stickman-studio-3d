import {
  buildStage,
  resolveScene,
  type SceneData,
  type SceneRuntime,
  type Stage,
  type World3D,
  type WorldSpec,
} from "@stickman3d/rig";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender, useVideoConfig } from "remotion";
import { ACTIONS, CHARACTERS, castBodies, castHeights, HANDS, HELD } from "../data";

/**
 * Cảnh 3D: cảnh three `buildWorld` của @stickman3d/rig (bối cảnh `set`, người diễn mặc đồ theo `equip`, người nền, đồ
 * riêng `extra`) trên sân khấu `buildStage`, mỗi khung vẽ đồng bộ ở giây cảnh `t` trước khi Remotion chụp — camera theo
 * `scene.lens` (hay `lens(t)`) và khung cắt `cameraAt` của scene. `stickman check` dựng cùng cảnh ấy (`world.ts`).
 */
export type Scene3DProps = WorldSpec & {
  scene: SceneData;
  /** `resolveScene` của chính `scene` mà nơi gọi đã có (`Scene`); bỏ trống thì tự tính */
  rt?: SceneRuntime;
  t: number;
};

export const Scene3D = ({
  scene,
  rt: given,
  t,
  set,
  still,
  extra,
  wear,
  lens,
  grade,
}: Scene3DProps) => {
  const { width, height } = useVideoConfig();
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<{ stage: Stage; world: World3D } | null>(null);
  const [wait] = useState(() => delayRender("cảnh 3D"));
  const released = useRef(false);
  const rt = useMemo(
    () => given ?? resolveScene(scene, ACTIONS, castHeights(scene), castBodies(scene), HELD, HANDS),
    [scene, given],
  );

  const draw = (t: number) => world.current?.stage.draw(t, world.current.world.view(t));

  useLayoutEffect(() => {
    let dead = false;
    // phông của decal và đồ riêng nạp xong mới dựng sân khấu, vẽ khung hiện tại rồi mới nhả Remotion
    buildStage(
      scene,
      rt,
      { set, still, extra, wear, lens, grade },
      { characters: CHARACTERS, heights: castHeights(scene), bodies: castBodies(scene) },
      { size: { w: width, h: height } },
    ).then((w) => {
      if (dead) return w.stage.dispose();
      host.current!.prepend(w.stage.canvas);
      world.current = w;
      draw(t);
      // StrictMode chạy effect hai lần: chỉ nhả lần đầu
      if (!released.current) {
        continueRender(wait);
        released.current = true;
      }
    }, cancelRender);
    return () => {
      dead = true;
      world.current?.stage.dispose();
      world.current?.stage.canvas.remove();
      world.current = null;
    };
  }, [rt, set, still, extra, wear, lens, grade, width, height]);

  useLayoutEffect(() => void draw(t), [t]);

  // `<div>` trần, không `<AbsoluteFill>`: trong Studio nó nhận `children = ""` khi đọc xong mã nguồn và React xoá canvas gắn tay
  return <div ref={host} style={{ position: "absolute", inset: 0 }} />;
};
