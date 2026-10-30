import { Fragment, type ReactNode } from "react";
import type { CameraShot } from "@stickman3d/rig/core";
import type { FxAnchor } from "./anchor";
import { BubbleFx } from "./Bubble";
import { Buttons } from "./Buttons";
import { Caption } from "./Caption";
import { DayNight } from "./DayNight";
import { Fizz } from "./Fizz";
import { Fly } from "./Fly";
import { Glow } from "./Glow";
import { Gust } from "./Gust";
import { Iris } from "./Iris";
import { PausedThrow } from "./PausedThrow";
import { fxZ, type FxData, type FxLayer } from "./schema";
import { Tears } from "./Tears";
import { Throw } from "./Throw";
import { Typewriter } from "./Typewriter";

export interface SceneFxProps {
  /** Đã qua `sceneFx()` / `parseFx()` */
  fx: FxData[];
  /** Giây scene */
  t: number;
  /** Chỉ vẽ mục ở lớp này */
  layer: FxLayer;
  /** Chỉ vẽ mục ở đúng nấc `z` này (`fxZ`); bỏ trống là cả lớp. `<SceneWorld>` gọi mỗi nấc một lượt */
  z?: number;
  /** Ảnh mảnh khoá theo tên file, cho `throw` / `fly` / `pausedThrow` / món của `bubble` — xem `fxFiles` */
  urls?: Record<string, string | undefined>;
  /** Mốc trên người cho `tears` và `bubble` bám `cast`; thiếu thì chúng không vẽ */
  anchor?: FxAnchor;
  /** `cameraAt(rt, t).zoom` — chữ chia cho nó để giữ cỡ trên màn hình */
  zoom?: number;
  /** `cameraAt(rt, t)` — mục `frame: "camera"` dịch theo tâm khung này; thiếu thì chúng đứng ở sân khấu */
  cam?: CameraShot;
  /** Tiền tố id cho gradient / filter / clip; mọi lớp của một cảnh dùng cùng một tiền tố, hai cảnh trong một trang thì hai tiền tố */
  id?: string;
}

/**
 * Mọi hiệu ứng của một scene ở một lớp, tại giây `t`. Thuần theo `t`: không có trạng thái
 * sống qua frame, seek tới đâu ra đúng hình ở đó. docs/09-hieu-ung.md
 */
export function SceneFx({
  fx,
  t,
  layer,
  z,
  urls = {},
  anchor,
  zoom = 1,
  cam,
  id = "fx",
}: SceneFxProps) {
  const out: ReactNode[] = [];
  const clipId = (name: string) => `${id}-clip-${name}`;
  // Gốc ở tâm khung máy quay: mục lia theo máy — mưa, bụi, chữ dán lên kính
  const shift = (f: FxData) =>
    f.frame === "camera" && cam ? `translate(${cam.x} ${cam.y})` : undefined;
  fx.forEach((f, i) => {
    if (f.layer !== layer || (z !== undefined && fxZ(f) !== z)) return;
    const key = `${f.kind}-${i}`;
    const uid = `${id}-${layer}-${i}`;
    if (f.kind === "clip") {
      out.push(
        <clipPath key={key} id={clipId(f.name)} transform={shift(f)}>
          {f.path ? (
            <path d={f.path} />
          ) : f.rect ? (
            <rect x={f.rect.x} y={f.rect.y} width={f.rect.w} height={f.rect.h} />
          ) : null}
        </clipPath>,
      );
      return;
    }
    let node: ReactNode = null;
    switch (f.kind) {
      case "glow":
        node = <Glow fx={f} t={t} id={uid} />;
        break;
      case "tears":
        if (anchor) node = <Tears fx={f} t={t} anchor={anchor} />;
        break;
      case "fizz":
        node = <Fizz fx={f} t={t} />;
        break;
      case "throw":
        node = <Throw fx={f} t={t} url={f.piece ? urls[f.piece] : undefined} />;
        break;
      case "fly":
        node = <Fly fx={f} t={t} url={f.piece ? urls[f.piece] : undefined} id={uid} />;
        break;
      case "pausedThrow":
        node = <PausedThrow fx={f} t={t} url={f.piece ? urls[f.piece] : undefined} />;
        break;
      case "gust":
        node = <Gust fx={f} t={t} />;
        break;
      case "caption":
        node = <Caption fx={f} t={t} zoom={zoom} />;
        break;
      case "buttons":
        node = <Buttons fx={f} t={t} />;
        break;
      case "iris":
        node = <Iris fx={f} t={t} frame={cam?.frame} />;
        break;
      case "bubble":
        node = <BubbleFx fx={f} t={t} zoom={zoom} urls={urls} anchor={anchor} />;
        break;
      case "typewriter":
        node = <Typewriter fx={f} t={t} zoom={zoom} />;
        break;
      case "dayNight":
        node = <DayNight fx={f} t={t} />;
        break;
    }
    if (node === null) return;
    // Cắt rồi mới dịch: hình cắt khai ở hệ sân khấu, không được trôi theo mục lia máy
    const moved = shift(f) ? <g transform={shift(f)}>{node}</g> : node;
    out.push(
      <Fragment key={key}>
        {f.clip ? <g clipPath={`url(#${clipId(f.clip)})`}>{moved}</g> : moved}
      </Fragment>,
    );
  });
  return out.length ? <g data-fx={layer}>{out}</g> : null;
}
