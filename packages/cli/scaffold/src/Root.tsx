import { FRAMES, type SceneData } from "@stickman3d/rig/core";
import type { ComponentProps, ReactElement } from "react";
import { Composition, Folder, useCurrentFrame, useVideoConfig } from "remotion";
import pkg from "../package.json";
import { EPISODES, SCENES } from "./data";
import { Episode, episodeVideo, sceneDuration, sceneFrame, sceneSeconds } from "./Episode.tsx";
import { episodeThumbnails, type ThumbnailData } from "./episode";
import { THU_3D } from "./khoi3d/canh";
import { Scene3D } from "./khoi3d/Scene3D";
import { Scene } from "./Scene";
import { episodeFrames, layoutShots } from "./shots";
import { Thumbnail } from "./Thumbnail";

const FPS = 60;

/** Cỡ pixel cho `calculateMetadata` */
const wh = (v: { w: number; h: number }) => ({ width: v.w, height: v.h });

/** Cỡ pixel của một cảnh, theo `scene.frame`: `wide` ra 1920×1080, `tall` ra 1080×1920 */
const size = (scene: SceneData) => wh(FRAMES[scene.frame].video);

const frames = (scene: SceneData) => Math.ceil(sceneDuration(scene) * FPS);

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

/** Cảnh `scenes/<id>.json`: props chỉ mang id, dữ liệu tra ở `SCENES` */
const SceneById = ({ id }: { id: string }) => <Scene scene={SCENES[id]} />;

/** Tập `episodes/<id>.json`; props khác của `Episode` (`lang`…) đi thẳng qua `--props` */
type EpisodeProps = { id: string } & Omit<ComponentProps<typeof Episode>, "episode" | "fps">;
const EpisodeById = ({ id, ...rest }: EpisodeProps) => (
  <Episode episode={EPISODES[id]} fps={FPS} {...rest} />
);

/** Id composition → thumbnail, của mọi tập trong bundle */
const THUMBS: Record<string, ThumbnailData> = Object.fromEntries(
  Object.entries(EPISODES).flatMap(([id, ep]) => Object.entries(episodeThumbnails(id, ep))),
);
const ThumbnailById = ({ id }: { id: string }) => <Thumbnail thumb={THUMBS[id]} />;

/** Composition thử bối cảnh `THU_3D[id]`; `--props='{"frames":1200}'` kéo dài để đo thời gian render */
const Thu3D = ({ id }: { id: string; frames?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scene, ...c } = THU_3D[id];
  return <Scene3D scene={SCENES[scene]} {...c} t={frame / fps} />;
};

/**
 * Một composition cho mỗi cảnh và mỗi tập **trong bundle** — `src/data.ts` nạp `scenes/`, `episodes/` theo phạm vi bundle
 * (`tools/scope.mjs`, docs/03-scene.md#phạm-vi-bundle). Props chỉ mang id: dữ liệu tra trong component, độ dài và cỡ
 * khung tính ở `calculateMetadata`, chỉ cho composition được chọn — danh sách composition nhỏ và Root dựng nhanh dù
 * bundle mang bao nhiêu cảnh. Tập có `thumbnail` thì thêm `<tập>-thumb` một khung, hay `<tập>-thumb-<khoá>` cho mỗi biến
 * thể: `pnpm thumbnails` chụp hết trong một lượt bundle. Sidebar Studio gom theo `stickman.folders` của `package.json`.
 * Bối cảnh thử `THU_3D` (`khoi3d/canh.ts`) nằm riêng trong thư mục `khoi3d`, chỉ khi cảnh của nó có trong bundle.
 */
export const Root = () => (
  <>
    {inFolders([
      ...Object.keys(SCENES).map((id) => (
        <Composition
          key={id}
          id={id}
          component={SceneById}
          fps={FPS}
          defaultProps={{ id }}
          calculateMetadata={({ props }) => {
            const s = SCENES[props.id];
            return { durationInFrames: frames(s), ...size(s) };
          }}
        />
      )),
      ...Object.keys(EPISODES).map((id) => (
        <Composition
          key={id}
          id={id}
          component={EpisodeById}
          fps={FPS}
          defaultProps={{ id }}
          calculateMetadata={({ props }) => {
            const e = EPISODES[props.id];
            return {
              durationInFrames: episodeFrames(layoutShots(e, FPS, sceneSeconds)),
              ...wh(episodeVideo(e, props.id)),
            };
          }}
        />
      )),
      ...Object.entries(THUMBS).map(([id, thumb]) => (
        <Composition
          key={id}
          id={id}
          component={ThumbnailById}
          fps={FPS}
          durationInFrames={1}
          defaultProps={{ id }}
          calculateMetadata={() => wh(FRAMES[sceneFrame(thumb.scene)].video)}
        />
      )),
    ])}
    {Object.values(THU_3D).some((t) => SCENES[t.scene]) && (
      <Folder name="khoi3d">
        {Object.entries(THU_3D)
          .filter(([, t]) => SCENES[t.scene])
          .map(([id, { scene }]) => (
            <Composition
              key={id}
              id={id}
              component={Thu3D}
              fps={FPS}
              defaultProps={{ id }}
              calculateMetadata={({ props }) => ({
                durationInFrames: props.frames ?? frames(SCENES[scene]),
                ...size(SCENES[scene]),
              })}
            />
          ))}
      </Folder>
    )}
  </>
);
