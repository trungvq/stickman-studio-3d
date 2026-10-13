import {
  act,
  cameraAt,
  castCharacter,
  createStage,
  fromCharacter,
  loadFonts,
  PAPER,
  resolveScene,
  sceneAt,
  setLights,
  setPalette,
  type CastMember,
  type CharacterJson,
  type Equip,
  type SceneData,
  type Stage,
  equipCharacter,
  wardrobe,
} from "@stickman3d/rig";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { continueRender, delayRender, useVideoConfig } from "remotion";
import { ACTIONS, ANIMALS, CHARACTERS, castBodies, castHeights, PROPS } from "../data";
import type { Canh3D } from "./canh";
import { crowd, type Set3D } from "./set";

/**
 * Cảnh 3D: bối cảnh `set` dựng một lần trên sân khấu của @stickman3d/rig, camera theo `scene.lens` và khung cắt
 * `cameraAt` của scene, mỗi khung vẽ đồng bộ ở giây cảnh `t` trước khi Remotion chụp. Người diễn đặt dáng theo `sceneAt`
 * mỗi khung; người nền (`still`, mặc định là người ngồi) đóng băng ở dáng giây 0 thành một nhóm. Người mặc đồ theo
 * `cast[].equip` và `keys[].equip` (`wardrobe`): mỗi bộ mảnh dựng khối và mỗi dáng đứng / ngồi một bản, dựng lần đầu cần tới.
 */
export type Scene3DProps = Canh3D & { scene: SceneData; t: number };

const character = (c: CastMember, equip?: Equip) =>
  equipCharacter(castCharacter(c, CHARACTERS[c.character!]), equip) as unknown as CharacterJson;

export const Scene3D = ({ scene, set, t, still, extra }: Scene3DProps) => {
  const { width, height } = useVideoConfig();
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<{ stage: Stage; set: Set3D } | null>(null);
  const [wait] = useState(() => delayRender("cảnh 3D"));
  const released = useRef(false);
  const rt = useMemo(
    () => resolveScene(scene, ACTIONS, ANIMALS, PROPS, castHeights(scene), castBodies(scene)),
    [scene],
  );

  const draw = (t: number) => world.current?.stage.draw(t, { crop: cameraAt(rt, t) });

  useLayoutEffect(() => {
    let dead = false;
    const s = set();
    // phông của decal nạp xong mới dựng sân khấu, vẽ khung hiện tại rồi mới nhả Remotion
    loadFonts(s.fonts?.specs ?? [], s.fonts?.text).then((missing) => {
      if (dead) return;
      if (missing.length) throw new Error(`thiếu phông: ${missing}`);
      const heights = castHeights(scene);
      const bodies = castBodies(scene);
      const acting = (id: string, t: number) => sceneAt(rt, id, t, heights[id], bodies[id]);
      const cast = rt.cast.filter((c) => c.world && c.character && CHARACTERS[c.character]);
      const frozen = (c: CastMember) => (still ? still.includes(c.id) : !!c.world?.sit);
      s.group.add(
        crowd(
          cast.filter(frozen).map((c) => {
            const w = c.world!;
            const ac = acting(c.id, 0);
            return {
              at: w.at as [number, number, number],
              yaw: w.yaw ?? 0,
              character: character(c, ac.equip),
              acting: ac,
            };
          }),
        ),
      );
      // váy dựng theo dáng lúc tạo hình (ngồi thì vạt phủ đùi), thân áo theo đồ đang mặc: mỗi người một tủ đồ, mỗi khung
      // hiện bản đúng dáng và đúng bộ; bản mở màn dựng sẵn, bản khác dựng lần đầu cần tới
      const actors = cast
        .filter((c) => !frozen(c))
        .map((c, i) => {
          const w = wardrobe(castCharacter(c, CHARACTERS[c.character!]), (worn, seated) =>
            fromCharacter(worn as unknown as CharacterJson, { seated, seed: i + 1 }),
          );
          const ac = acting(c.id, 0);
          w.get(ac.equip, !!ac.world?.seated);
          return { id: c.id, w };
        });
      const figs = actors.flatMap((a) => [...a.w.figures.values()]);
      const x = extra?.();
      if (x) s.group.add(x.group);
      const stage = createStage({
        size: { w: width, h: height },
        aa: "ss2",
        lens: scene.lens,
        light: () => setPalette(s.palette),
        update: (t, st) => {
          for (const a of actors) {
            const ac = acting(a.id, t);
            const { fig, fresh } = a.w.get(ac.equip, !!ac.world?.seated);
            if (fresh) st.scene.add(fig.root);
            for (const f of a.w.figures.values()) f.root.visible = f === fig;
            act(fig, ac, t);
          }
          s.room.cull(st.camera);
          s.update?.(t);
          x?.update?.(t);
          setLights(s.lights(t));
        },
      });
      if (/SwiftShader/.test(stage.gpu)) throw new Error(`không có GPU: ${stage.gpu}`);
      // ngoài vỏ phòng (camera trên đỉnh tường) là nền giấy như cảnh 2D
      stage.scene.background = new THREE.Color(PAPER);
      stage.scene.add(s.group, ...figs.map((f) => f.root));
      host.current!.prepend(stage.canvas);
      world.current = { stage, set: s };
      draw(t);
      // StrictMode chạy effect hai lần: chỉ nhả lần đầu
      if (!released.current) {
        continueRender(wait);
        released.current = true;
      }
    });
    return () => {
      dead = true;
      world.current?.stage.dispose();
      world.current?.stage.canvas.remove();
      world.current = null;
    };
  }, [rt, set, still, extra, width, height]);

  useLayoutEffect(() => void draw(t), [t]);

  // `<div>` trần, không `<AbsoluteFill>`: trong Studio nó nhận `children = ""` khi đọc xong mã nguồn và React xoá canvas gắn tay
  return <div ref={host} style={{ position: "absolute", inset: 0 }} />;
};
