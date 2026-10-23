// Entry Remotion của `tools/still.mjs` và `tools/can-tay.mjs`. Bundle này có thêm composition `soi`: khung thứ `i` là việc
// `soi[i]` của `inputProps` — một khung của một cảnh, hay một ống kính đè nhìn vào một giây của cảnh 3D. Một tab Remotion
// giữ cảnh đang dựng qua các khung liền nhau cùng cảnh, nên mỗi khung chỉ tốn phần vẽ và chụp. Không có `soi` trong
// `inputProps` thì là đúng `Root` của app — khung của tập, thumbnail. Bundle chỉ mang cảnh, tập được soi (`openSoi` của
// `soi.mjs`, phạm vi `scope.mjs`). Xem docs/03 § Remotion.
import {
  FRAMES,
  buildStage,
  parseScene,
  resolveScene,
  type SceneData,
  type Stage,
  type World3D,
} from "@stickman3d/rig";
import { registerParts } from "@stickman3d/sketch";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Composition,
  Freeze,
  cancelRender,
  continueRender,
  delayRender,
  getInputProps,
  registerRoot,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  ACTIONS,
  ANIMALS,
  CHARACTERS,
  HANDS,
  HELD,
  PROPS,
  SCENES,
  castBodies,
  castHeights,
} from "../src/data";
import { CANH_3D } from "../src/khoi3d/canh";
import { CODE_PARTS } from "../src/parts";
import { Root } from "../src/Root";
import { Scene } from "../src/Scene";

type Lens = NonNullable<SceneData["lens"]>;

/** Khung `frame` của composition cảnh `scene`; hay giây cảnh `t` nhìn qua ống kính `lens` (chỉ sân khấu 3D, không lớp 2D) */
export type SoiJob = { scene: string; frame: number } | { scene: string; t: number; lens: Lens };

/**
 * `frames`: số khung của từng cảnh có trong `soi`, như composition của cảnh ấy — `calculateMetadata` điền, `0` là không có
 * cảnh. `scenes`: cảnh dựng tạm không nằm trong `scenes/` (JSON thô, theo id việc dùng ở `soi[].scene`), như bảng nhóm cầm
 * của `tools/bang-cam.mjs`; cảnh three của nó tra `CANH_3D` theo `name` trong JSON, không theo id
 */
export type SoiProps = {
  soi: SoiJob[];
  w: number;
  h: number;
  frames?: Record<string, number>;
  scenes?: Record<string, unknown>;
};

/** Cảnh của việc: file trong `scenes/`, không thì cảnh dựng tạm của `inputProps.scenes` (parse một lần mỗi id) */
const inline = new Map<string, SceneData | null>();
const sceneOf = (id: string, raw?: Record<string, unknown>): SceneData | undefined => {
  if (SCENES[id]) return SCENES[id];
  if (!raw?.[id]) return undefined;
  if (!inline.has(id)) {
    const r = parseScene(raw[id]);
    inline.set(id, r.success ? r.data : null);
  }
  return inline.get(id) ?? undefined;
};

// Khớp `FPS` và độ dài cảnh của `src/Root.tsx`: khung `frame` của cảnh phải ra đúng giây cảnh ấy
const FPS = 60;

/** Sân khấu 3D của cảnh nhìn qua `lens`: khung cắt bỏ camera của cảnh, khung ra thấy trọn chiều cao sân khấu quanh trục nhìn */
const LensStill = ({ scene, t, lens }: { scene: SceneData; t: number; lens: Lens }) => {
  const { width, height } = useVideoConfig();
  const host = useRef<HTMLDivElement>(null);
  const built = useRef<{ stage: Stage; world: World3D } | null>(null);
  const [wait] = useState(() => delayRender(`soi 3D ${scene.name}`));
  const spec = CANH_3D[scene.name];
  if (!spec)
    throw new Error(
      `cảnh ${scene.name} không có trong CANH_3D (khoi3d/canh.ts) — không phải cảnh 3D`,
    );
  const rt = useMemo(
    () =>
      resolveScene(
        scene,
        ACTIONS,
        ANIMALS,
        PROPS,
        castHeights(scene),
        castBodies(scene),
        HELD,
        HANDS,
      ),
    [scene],
  );
  const fr = FRAMES[scene.frame];
  const crop = {
    x: 0,
    y: 0,
    zoom: Math.max(1, fr.w / fr.h / (width / height)),
    frame: { w: fr.w, h: fr.h },
  };
  // lượt dựng xong muộn hơn lượt render: vẽ theo giây và ống kính mới nhất
  const now = useRef({ t, lens, crop });
  const draw = () => {
    const b = built.current;
    const v = now.current;
    if (b) b.stage.draw(v.t, { ...b.world.view(v.t), lens: v.lens, crop: v.crop });
  };

  useLayoutEffect(() => {
    let dead = false;
    buildStage(
      scene,
      rt,
      spec,
      { characters: CHARACTERS, heights: castHeights(scene), bodies: castBodies(scene) },
      { size: { w: width, h: height } },
    ).then((b) => {
      if (dead) return b.stage.dispose();
      host.current!.prepend(b.stage.canvas);
      built.current = b;
      draw();
      continueRender(wait);
    }, cancelRender);
    return () => {
      dead = true;
      built.current?.stage.dispose();
      built.current?.stage.canvas.remove();
      built.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, spec, width, height]);

  // ống kính đổi mà giây không đổi vẫn phải vẽ lại: vẽ mỗi lượt render
  useLayoutEffect(() => {
    now.current = { t, lens, crop };
    draw();
  });

  return <div ref={host} style={{ position: "absolute", inset: 0 }} />;
};

const Soi = ({ soi, scenes }: SoiProps) => {
  const job = soi[useCurrentFrame()];
  const scene = sceneOf(job.scene, scenes);
  if (!scene) throw new Error(`không có scenes/${job.scene}.json (hay cảnh dựng tạm hỏng)`);
  // `key` theo cảnh: cùng cảnh thì giữ sân khấu đã dựng, sang cảnh khác thì dựng lại và Remotion chờ lại
  return "lens" in job ? (
    <LensStill key={job.scene} scene={scene} t={job.t} lens={job.lens} />
  ) : (
    <Freeze key={job.scene} frame={job.frame}>
      <Scene scene={scene} />
    </Freeze>
  );
};

/** Khung việc là `0..n-1`, nhưng `<Freeze>` kẹp khung về độ dài của composition này: dài tới khung lớn nhất được xin */
const length = (soi: SoiJob[]) =>
  Math.max(1, soi.length, ...soi.map((j) => ("frame" in j ? j.frame + 1 : 0)));

const SoiRoot = () => {
  const p = getInputProps() as Partial<SoiProps>;
  if (!p.soi) return <Root />;
  return (
    <Composition
      id="soi"
      component={Soi}
      fps={FPS}
      width={p.w ?? 1920}
      height={p.h ?? 1080}
      durationInFrames={length(p.soi)}
      defaultProps={{ soi: p.soi, w: p.w ?? 1920, h: p.h ?? 1080, scenes: p.scenes }}
      calculateMetadata={({ props }) => ({
        props: {
          ...props,
          frames: Object.fromEntries(
            [...new Set(props.soi.map((j) => j.scene))].map((s) => {
              const d = sceneOf(s, props.scenes);
              return [
                s,
                d
                  ? Math.ceil(
                      resolveScene(d, ACTIONS, ANIMALS, PROPS, {}, {}, HELD, HANDS).duration * FPS,
                    )
                  : 0,
              ];
            }),
          ),
        },
      })}
    />
  );
};

registerParts(CODE_PARTS);
registerRoot(SoiRoot);
