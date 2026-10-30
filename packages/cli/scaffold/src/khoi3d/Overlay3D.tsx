import {
  type CodeLayer,
  FX_LAYERS,
  fxFiles,
  fxZ,
  layerCovers,
  SceneAnchor,
  sceneAnchor,
  SceneFx,
  sceneFx,
} from "@stickman3d/fx";
import { type CameraShot, SCENE_Z, type SceneRuntime } from "@stickman3d/rig";
import { Fragment, type ReactNode } from "react";
import { CHARACTERS } from "../data";

/**
 * Lớp SVG đè lên canvas của cảnh 3D, vẽ trong cùng `viewBox` của `cameraAt`: `back`/`front` của các lớp code phủ cảnh và
 * `scene.fx` (bong bóng, thẻ giờ, chữ dán khung). Không vẽ người, đồ khối hay nền (`bg`) — phần ấy là của sân khấu three.
 * Lớp code trùng tên cảnh (phòng vẽ SVG của chính cảnh) bỏ hẳn. Mốc bám người (`ctx.anchor`) là `anchorAt` của người 3D.
 */
export function Overlay3D({
  rt,
  t,
  cam,
  url,
  codeLayers,
}: {
  rt: SceneRuntime;
  t: number;
  cam: CameraShot;
  url: (file: string) => string | undefined;
  codeLayers: readonly CodeLayer[];
}) {
  const anchor = sceneAnchor(rt, (m) =>
    m.character && CHARACTERS[m.character] ? CHARACTERS[m.character] : undefined,
  );
  const on = codeLayers.filter((l) => l.name !== rt.name && layerCovers(l, rt.name));
  const ctx = { name: rt.name, t, cam, marks: rt.marks, url, lens: rt.lens, anchor };
  const fx = sceneFx(rt);
  const urls = Object.fromEntries(fxFiles(fx).map((f) => [f, url(f)]));
  const items: { z: number; tie: number; node: ReactNode }[] = [];
  on.forEach((l, i) => {
    if (l.back)
      items.push({
        z: l.z?.back ?? SCENE_Z.fxBack,
        tie: i,
        node: <Fragment key={`back-${l.name}`}>{l.back(ctx)}</Fragment>,
      });
    if (l.front)
      items.push({
        z: l.z?.front ?? SCENE_Z.fxFront,
        tie: i,
        node: <Fragment key={`front-${l.name}`}>{l.front(ctx)}</Fragment>,
      });
  });
  for (const layer of FX_LAYERS)
    for (const z of [...new Set(fx.filter((f) => f.layer === layer).map(fxZ))])
      items.push({
        z,
        tie: 1e6 + FX_LAYERS.indexOf(layer),
        node: (
          <SceneFx
            key={`fx-${layer}-${z}`}
            fx={fx}
            t={t}
            layer={layer}
            z={z}
            urls={urls}
            anchor={anchor}
            zoom={cam.zoom}
            cam={cam}
            id={rt.name}
          />
        ),
      });
  items.sort((a, b) => a.z - b.z || a.tie - b.tie);
  return <SceneAnchor.Provider value={anchor}>{items.map((i) => i.node)}</SceneAnchor.Provider>;
}
