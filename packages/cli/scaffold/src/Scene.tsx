import {
  PAPER,
  RigQualityContext,
  applyAspects,
  cameraAt,
  pieceFile,
  resolveScene,
  sceneTime,
  warpTable,
  type SceneData,
} from "@stickman3d/sketch";
import { SceneWorld, type CodeLayer } from "@stickman3d/fx";
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  ACTIONS,
  ALL_IMAGES,
  ANIMALS,
  BACKGROUNDS,
  CHARACTERS,
  PROPS,
  animalUrls,
  castBodies,
  castHeights,
  pieceUrl,
  pieceUrls,
  propUrl,
} from "./data";
import { useImagesReady } from "./images";
import { CANH_3D } from "./khoi3d/canh";
import { Overlay3D } from "./khoi3d/Overlay3D";
import { Scene3D } from "./khoi3d/Scene3D";
import { CODE_LAYERS } from "./lop";
import { SceneWrap } from "./scene-wrap";

const NO_WARP = warpTable([]);

// Remotion đưa biến `REMOTION_*` vào `process.env` của trang lúc render
declare const process: { env: Record<string, string | undefined> };

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
  // Tỉ lệ khung đo từ chính ảnh, không tin số khai trong JSON — render và studio cũng làm vậy.
  // Nền cũng thế: hộp vẽ tính ở chỗ vẽ vì `parallax` làm nó đổi theo mốc camera
  const world = useMemo(() => {
    if (!aspects) return null;
    const chars = structuredClone(CHARACTERS);
    for (const c of Object.values(chars)) applyAspects(c, aspects);
    const props = structuredClone(PROPS);
    for (const p of Object.values(props)) {
      const f = pieceFile(p.body);
      if (f && aspects[f] !== undefined) p.body.aspect = aspects[f];
    }
    const measured = {
      ...scene,
      bg: scene.bg.map((b) => ({ ...b, aspect: aspects[b.file] ?? b.aspect })),
    };
    const rt = resolveScene(
      measured,
      ACTIONS,
      ANIMALS,
      props,
      castHeights(scene),
      castBodies(scene),
    );
    const urls = Object.fromEntries(Object.entries(chars).map(([k, c]) => [k, pieceUrls(c)]));
    return { rt, chars, props, urls };
  }, [scene, aspects]);

  // Chưa đo xong thì chưa vẽ; `delayRender` đang gác nên không lượt render nào thấy khung này.
  // Ô chờ là `<div>` trần, KHÔNG phải `<AbsoluteFill>`: trong Studio (remotion 4.0.518)
  // AbsoluteFill bọc thêm lớp "interactivity schema" chụp lại props lúc mount đầu tiên, kể
  // cả `children`. Mount lúc chưa có gì thì nó giữ `children = ""` mãi, lượt render có svg
  // sau đó bị nuốt — cảnh mở đầu tiên trong Studio đứng trắng cho tới khi đổi composition.
  // Render thật không bị.
  if (!world) return <div style={{ position: "absolute", inset: 0, background: PAPER }} />;
  const { rt, chars, props, urls } = world;
  // Khung là của camera trong scene — ba đường render gọi chung `cameraAt`, đừng gõ viewBox
  const cam = cameraAt(rt, t);
  // Chỉ `pnpm render:final` chiếu tóc dựng khối đúng góc từng khung; còn lại dùng bản cache — docs/02
  const quality = process.env.REMOTION_QUALITY === "final" ? "final" : "draft";
  // Cảnh dựng bằng @stickman3d/rig (`khoi3d/canh.ts`): sân khấu three ở dưới, chữ 2D của lớp code đè lên.
  // `REMOTION_FLAT=1` vẽ bản người que 2D để so
  const c3 = process.env.REMOTION_FLAT ? undefined : CANH_3D[scene.name];
  if (c3)
    return (
      <AbsoluteFill style={{ background: PAPER }}>
        <Scene3D scene={scene} t={t} {...c3} />
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
        <RigQualityContext.Provider value={quality}>
          <SceneWrap rt={rt} t={t}>
            <SceneWorld
              rt={rt}
              t={t}
              cam={cam}
              characterOf={(m) => {
                const c = m.character ? chars[m.character] : undefined;
                return c ? { character: c, urls: urls[m.character!] } : undefined;
              }}
              propOf={(file) => {
                const p = props[file];
                return p ? { prop: p, url: propUrl(p) } : undefined;
              }}
              animalUrls={(a) => animalUrls(a.spec)}
              url={pieceUrl}
              bgUrls={BACKGROUNDS}
              codeLayers={codeLayers}
            />
          </SceneWrap>
        </RigQualityContext.Provider>
      </svg>
    </AbsoluteFill>
  );
};
