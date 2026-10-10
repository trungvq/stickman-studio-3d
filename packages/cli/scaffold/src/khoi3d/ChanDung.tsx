import { portrait, type CharacterJson, type PortraitOptions } from "@stickman3d/rig";
import { useEffect, useId, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { CHARACTERS } from "../data";

/**
 * Chân dung người 3D (`portrait` của rig) cho lớp vẽ 2D: đầu trong bong bóng, icon trên slide giải thích. Chụp lúc
 * chạy từ `characters/`, nên sửa nhân vật thì icon đi theo. Mỗi (nhân vật, tham số) chụp một lần mỗi tab.
 */

const urls = new Map<string, string>();

/** Data URL chân dung của nhân vật `character` (tên file trong `characters/`); `null` tới lúc chụp xong, Remotion chờ. */
export function useChanDung(character: string, o: PortraitOptions = {}): string | null {
  const key = JSON.stringify([character, o]);
  const [got, setGot] = useState<{ key: string; url: string; wait?: number } | null>(null);
  const url = urls.get(key) ?? (got?.key === key ? got.url : null);
  useEffect(() => {
    if (urls.has(key)) return;
    const [name, opts] = JSON.parse(key) as [string, PortraitOptions];
    const c = CHARACTERS[name];
    if (!c) throw new Error(`không có nhân vật ${name}`);
    const wait = delayRender(`chân dung ${name}`);
    let dead = false;
    portrait(c as unknown as CharacterJson, opts).then(
      (cv) => {
        urls.set(key, cv.toDataURL());
        if (dead) continueRender(wait);
        else setGot({ key, url: urls.get(key)!, wait });
      },
      (e) => cancelRender(e),
    );
    return () => {
      dead = true;
    };
  }, [key]);
  // nhả Remotion sau lượt vẽ có ảnh, không phải lúc vừa chụp xong
  useEffect(() => {
    if (got?.wait !== undefined) continueRender(got.wait);
  }, [got]);
  return url;
}

export type ChanDungProps = {
  /** Tên file trong `characters/` */
  character: string;
  /** Tâm khung, đơn vị SVG */
  x: number;
  y: number;
  /** Nửa cạnh khung vuông */
  r: number;
  /** Cắt tròn bán kính `r` */
  round?: boolean;
  /** Tham số chụp; `w`, `h` là cỡ ảnh px, không phải cỡ trên khung */
  shot?: PortraitOptions;
};

/** Chân dung vuông cạnh `2r` quanh (`x`, `y`) trong SVG của lớp vẽ code; `round` cắt tròn. Nền trong suốt. */
export function ChanDung({ character, x, y, r, round, shot = {} }: ChanDungProps) {
  const id = useId();
  const url = useChanDung(character, {
    frame: "head",
    ...shot,
    w: shot.w ?? 512,
    h: shot.h ?? shot.w ?? 512,
  });
  if (!url) return null;
  return (
    <>
      {round && (
        <clipPath id={id}>
          <circle cx={x} cy={y} r={r} />
        </clipPath>
      )}
      <image
        href={url}
        x={x - r}
        y={y - r}
        width={2 * r}
        height={2 * r}
        preserveAspectRatio="xMidYMid meet"
        clipPath={round ? `url(#${id})` : undefined}
      />
    </>
  );
}
