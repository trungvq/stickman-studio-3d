import {
  PAPER,
  cameraAt,
  resolveScene,
  sceneTime,
  warpTable,
  type SceneData,
  type SceneRuntime,
} from "@stickman3d/rig/core";
import { SceneWorld, type CodeLayer } from "@stickman3d/fx";
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  ACTIONS,
  ALL_IMAGES,
  BACKGROUNDS,
  CHARACTERS,
  HANDS,
  HELD,
  castBodies,
  castHeights,
  pieceUrl,
} from "./data";
import { useImagesReady } from "./images";
import { CANH_3D } from "./khoi3d/canh";
import { Overlay3D } from "./khoi3d/Overlay3D";
import { Scene3D } from "./khoi3d/Scene3D";
import { CODE_LAYERS } from "./lop";
import { SceneWrap } from "./scene-wrap";

const NO_WARP = warpTable([]);

/** `resolveScene` một lần cho mỗi object cảnh, dùng lại qua mọi shot và lượt mount của tab */
const RUNTIMES = new WeakMap<SceneData, SceneRuntime>();

type SceneProps = {
  scene: SceneData;
  /** Giây cảnh lúc cú cắt rơi xuống — shot cắt vào giữa một cảnh dài thì khác 0 */
  at?: number;
  /** Giây màn hình cảnh đã chạy sẵn trước cú cắt (`overlap` của shot) */
  preroll?: number;
  /** Bảng slow-mo của shot; giây màn hình đổi ra giây cảnh qua nó */
  table?: ReturnType<typeof warpTable>;
  /** Lớp vẽ code; thumbnail truyền bản đã lọc theo `keep` */
  codeLayers?: readonly CodeLayer[];
};

export const Scene = ({
  scene,
  at = 0,
  preroll = 0,
  table = NO_WARP,
  codeLayers = CODE_LAYERS,
}: SceneProps) => {
  const { fps, width, height } = useVideoConfig();
  // Hai đồng hồ: frame đếm giây màn hình, `sceneAt` ăn giây cảnh. `preroll` là đoạn chạy
  // sau lưng shot trước, nên giây cảnh ở đó âm so với `at`.
  const t = at + sceneTime(useCurrentFrame() / fps - preroll, table);
  const aspects = useImagesReady(ALL_IMAGES);
  // Tỉ lệ khung nền đo từ chính ảnh, không tin số khai trong JSON: hộp vẽ tính ở chỗ vẽ vì
  // `parallax` làm nó đổi theo mốc camera
  const rt = useMemo(() => {
    if (!aspects) return null;
    let rt = RUNTIMES.get(scene);
    if (!rt) {
      const measured = {
        ...scene,
        bg: scene.bg.map((b) => ({ ...b, aspect: aspects[b.file] ?? b.aspect })),
      };
      rt = resolveScene(measured, ACTIONS, castHeights(scene), castBodies(scene), HELD, HANDS);
      RUNTIMES.set(scene, rt);
    }
    return rt;
  }, [scene, aspects]);

  // Chưa đo xong thì chưa vẽ; `delayRender` đang gác nên không lượt render nào thấy khung này.
  // Ô chờ là `<div>` trần, KHÔNG phải `<AbsoluteFill>`: trong Studio (remotion 4.0.518)
  // AbsoluteFill bọc thêm lớp "interactivity schema" chụp lại props lúc mount đầu tiên, kể
  // cả `children`. Mount lúc chưa có gì thì nó giữ `children = ""` mãi, lượt render có svg
  // sau đó bị nuốt — cảnh mở đầu tiên trong Studio đứng trắng cho tới khi đổi composition.
  // Render thật không bị.
  if (!rt) return <div style={{ position: "absolute", inset: 0, background: PAPER }} />;
  // Khung là của camera trong scene — ba đường render gọi chung `cameraAt`, đừng gõ viewBox
  const cam = cameraAt(rt, t);
  // Cảnh dựng bằng @stickman3d/rig (`khoi3d/canh.ts`): sân khấu three ở dưới, chữ 2D của lớp code đè lên.
  // Cảnh không có trong `CANH_3D` chỉ có nền, lớp vẽ code và `fx` — không vẽ người
  const c3 = CANH_3D[scene.name];
  if (c3)
    return (
      <AbsoluteFill style={{ background: PAPER }}>
        <Scene3D scene={scene} rt={rt} t={t} {...c3} />
        <svg
          width={width}
          height={height}
          viewBox={cam.viewBox}
          style={{ position: "absolute", inset: 0 }}
        >
          <SceneWrap rt={rt} t={t}>
            <Overlay3D rt={rt} t={t} cam={cam} url={pieceUrl} codeLayers={codeLayers} />
          </SceneWrap>
        </svg>
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <svg width={width} height={height} viewBox={cam.viewBox}>
        <SceneWrap rt={rt} t={t}>
          <SceneWorld
            rt={rt}
            t={t}
            cam={cam}
            characterOf={(m) => {
              const c = m.character ? CHARACTERS[m.character] : undefined;
              return c && { character: c };
            }}
            url={pieceUrl}
            bgUrls={BACKGROUNDS}
            codeLayers={codeLayers}
          />
        </SceneWrap>
      </svg>
    </AbsoluteFill>
  );
};
