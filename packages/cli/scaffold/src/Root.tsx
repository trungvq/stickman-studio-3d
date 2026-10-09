import { FRAMES, SceneSchema, parseScene, resolveScene, type SceneData } from "@stickman3d/sketch";
import type { ReactElement } from "react";
import { Composition, Folder } from "remotion";
import { z } from "zod";
import pkg from "../package.json";
import { ACTIONS, ANIMALS, EPISODES, PROPS, SCENES } from "./data";
import { Episode, episodeVideo, sceneFrame, sceneSeconds } from "./Episode";
import { EpisodeSchema, episodeThumbnails, parseEpisode } from "./episode";
import { Scene } from "./Scene";
import { episodeFrames, layoutShots } from "./shots";
import { Thumbnail } from "./Thumbnail";

const FPS = 60;

/** Cỡ pixel viết sẵn cho `<Composition>` và cho `calculateMetadata` */
const wh = (v: { w: number; h: number }) => ({ width: v.w, height: v.h });

/** Cỡ pixel của một cảnh, theo `scene.frame`: `wide` ra 1920×1080, `tall` ra 1080×1920 */
const size = (scene: SceneData) => wh(FRAMES[scene.frame].video);

const frames = (scene: Parameters<typeof resolveScene>[0]) =>
  Math.ceil(resolveScene(scene, ACTIONS, ANIMALS, PROPS).duration * FPS);

const FOLDERS = (pkg as { stickman?: { folders?: string } }).stickman?.folders;

/** Thư mục sidebar của một id: đoạn khớp đầu của regex `stickman.folders`; `null` là nằm ở gốc */
const folderOf = (id: string) => (FOLDERS ? (new RegExp(FOLDERS).exec(id)?.[0] ?? null) : null);

/** Gom composition vào `<Folder>` theo `folderOf(id)`, giữ thứ tự xuất hiện */
const inFolders = (comps: ReactElement<{ id: string }>[]) => {
  const groups = new Map<string | null, ReactElement[]>();
  for (const c of comps) {
    const f = folderOf(c.props.id);
    groups.set(f, [...(groups.get(f) ?? []), c]);
  }
  return [...groups].map(([f, cs]) =>
    f === null ? cs : <Folder key={f} name={f} children={cs} />,
  );
};

/**
 * Một composition cho mỗi file trong `scenes/`, và một cho mỗi file trong `episodes/` —
 * thêm file là có thêm composition. Cảnh là đơn vị dựng, tập là đơn vị xem. Tập có
 * `thumbnail` thì thêm `<tập>-thumb` một khung, hay `<tập>-thumb-<khoá>` cho mỗi biến thể:
 * `pnpm thumbnails` chụp hết trong một lượt bundle. Sidebar Studio gom theo
 * `stickman.folders` của `package.json` — docs/03-scene.md#remotion.
 */
export const Root = () => (
  <>
    {inFolders([
      ...Object.entries(SCENES).map(([id, scene]) => (
        <Composition
          key={id}
          id={id}
          component={Scene}
          fps={FPS}
          {...size(scene)}
          durationInFrames={frames(scene)}
          schema={z.object({ scene: SceneSchema })}
          defaultProps={{ scene }}
          calculateMetadata={({ props }) => {
            const s = parseScene(props.scene);
            if (!s.success) throw new Error(s.error.message);
            return { props: { scene: s.data }, durationInFrames: frames(s.data), ...size(s.data) };
          }}
        />
      )),
      ...Object.entries(EPISODES).map(([id, episode]) => (
        <Composition
          key={id}
          id={id}
          component={Episode}
          fps={FPS}
          {...wh(episodeVideo(episode, id))}
          durationInFrames={episodeFrames(layoutShots(episode, FPS, sceneSeconds))}
          schema={z.object({ episode: EpisodeSchema, lang: z.string().optional() })}
          defaultProps={{ episode, fps: FPS }}
          calculateMetadata={({ props }) => {
            const e = parseEpisode(props.episode);
            if (!e.success) throw new Error(e.error.message);
            return {
              props: { episode: e.data, fps: FPS, lang: props.lang },
              durationInFrames: episodeFrames(layoutShots(e.data, FPS, sceneSeconds)),
              ...wh(episodeVideo(e.data, id)),
            };
          }}
        />
      )),
      ...Object.entries(EPISODES).flatMap(([id, episode]) =>
        Object.entries(episodeThumbnails(id, episode)).map(([thumbId, thumb]) => (
          <Composition
            key={thumbId}
            id={thumbId}
            component={Thumbnail}
            fps={FPS}
            {...wh(FRAMES[sceneFrame(thumb.scene)].video)}
            durationInFrames={1}
            defaultProps={{ thumb }}
          />
        )),
      ),
    ])}
  </>
);
