import { useId } from "react";
import type { MouthKind } from "./types";

const INK = "#3a2620";
const CAVITY = "#7a2b22";
const TOOTH = "#f7f2e6";
const TONGUE = "#d0675a";

/** Nửa bề ngang và nửa chiều cao của khẩu hình nghiến răng */
const GRIT = { w: 15, h: 7 };

/**
 * Bộ nói neutral dáng chữ D: mép trên gần phẳng, đáy tròn. `w` nửa bề ngang, `top` / `bottom`
 * mép trên / dưới so với tâm, `teeth` bề dày dải răng trên, `tongue` bề cao lưỡi ở đáy.
 * docs/01-rig.md#khẩu-hình-và-mắt
 */
const TALK = {
  talkTeeth: { w: 13, top: -4, bottom: 5.5, teeth: 0, tongue: 0 },
  talkA: { w: 13, top: -4.5, bottom: 7, teeth: 4.5, tongue: 0 },
  talkB: { w: 14, top: -6, bottom: 13, teeth: 4.5, tongue: 5 },
} as const;
/** Miệng bầu dục: nửa bề ngang, nửa bề cao, tâm lệch xuống, dải răng trên, lưỡi ở đáy */
const OVAL = {
  talkO: { rx: 5.5, ry: 9, dy: 2, teeth: 4.5, tongue: 4 },
  o: { rx: 5, ry: 6, dy: 0, teeth: 4, tongue: 0 },
  wide: { rx: 13, ry: 15, dy: 0, teeth: 6.5, tongue: 6 },
} as const;

/** Viền, nửa bề ngang, mép trên / dưới, dải răng trên và lưỡi của khẩu hình há có răng */
function openMouth(kind: "talkA" | "talkB" | keyof typeof OVAL, cx: number, cy: number) {
  if (kind === "talkA" || kind === "talkB") {
    const { w, top, bottom, teeth, tongue } = TALK[kind];
    return { d: dPath(cx, cy, w, top, bottom), w, y0: cy + top, y1: cy + bottom, teeth, tongue };
  }
  const { rx, ry, dy, teeth, tongue } = OVAL[kind];
  const [y0, y1] = [cy + dy - ry, cy + dy + ry];
  const d = `M ${cx} ${y0} A ${rx} ${ry} 0 1 1 ${cx} ${y1} A ${rx} ${ry} 0 1 1 ${cx} ${y0} Z`;
  return { d, w: rx, y0, y1, teeth, tongue };
}

/** Viền chữ D: góc trên nhọn, mép trên vồng `0,5`, đáy tròn */
function dPath(cx: number, cy: number, w: number, top: number, bottom: number) {
  const y0 = cy + top;
  const y1 = cy + bottom;
  const k = y0 + 0.55 * (y1 - y0);
  return (
    `M ${cx - w} ${y0} Q ${cx} ${y0 - 1} ${cx + w} ${y0}` +
    ` C ${cx + w} ${k} ${cx + 0.55 * w} ${y1} ${cx} ${y1}` +
    ` C ${cx - 0.55 * w} ${y1} ${cx - w} ${k} ${cx - w} ${y0} Z`
  );
}

export function Mouth({ kind, cx, cy }: { kind: MouthKind; cx: number; cy: number }) {
  const uid = useId();
  const clipId = `mouth${uid.replace(/:/g, "")}`;
  const stroke = { fill: "none", stroke: INK, strokeWidth: 4, strokeLinecap: "round" } as const;
  switch (kind) {
    case "closed":
      return <line x1={cx - 11} y1={cy} x2={cx + 11} y2={cy} {...stroke} />;
    case "parted":
      return (
        <path
          d={`M ${cx - 5} ${cy} Q ${cx} ${cy - 3} ${cx + 5} ${cy} Q ${cx} ${cy + 4} ${cx - 5} ${cy} Z`}
          {...stroke}
          fill={INK}
          strokeWidth={2}
        />
      );
    case "talkTeeth": {
      const { w, top, bottom } = TALK.talkTeeth;
      const d = dPath(cx, cy, w, top, bottom);
      const mid = cy + (top + bottom) / 2 - 0.75;
      return (
        <g>
          <defs>
            <clipPath id={clipId}>
              <path d={d} />
            </clipPath>
          </defs>
          <path d={d} fill={TOOTH} />
          <path
            d={`M ${cx - w} ${mid} Q ${cx} ${mid + 1.5} ${cx + w} ${mid}`}
            fill="none"
            stroke={INK}
            strokeWidth={2}
            clipPath={`url(#${clipId})`}
          />
          <path d={d} fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        </g>
      );
    }
    case "talkA":
    case "talkB":
    case "talkO":
    case "o":
    case "wide": {
      const { d, w, y0, y1, teeth, tongue } = openMouth(kind, cx, cy);
      return (
        <g>
          <defs>
            <clipPath id={clipId}>
              <path d={d} />
            </clipPath>
          </defs>
          <path d={d} fill={CAVITY} />
          <g clipPath={`url(#${clipId})`}>
            {tongue > 0 && <ellipse cx={cx} cy={y1} rx={w * 0.62} ry={tongue} fill={TONGUE} />}
            <path
              d={`M ${cx - w - 2} ${y0 - 3} H ${cx + w + 2} V ${y0 + teeth} Q ${cx} ${y0 + teeth + 2} ${cx - w - 2} ${y0 + teeth} Z`}
              fill={TOOTH}
            />
          </g>
          <path d={d} fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        </g>
      );
    }
    case "talkSadA":
    case "talkSadB": {
      const large = kind === "talkSadB";
      const bottom = large ? 10 : 4;
      const d = `M ${cx - 13} ${cy + 1} C ${cx - 10} ${cy - 7} ${cx + 10} ${cy - 7} ${cx + 13} ${cy + 1} Q ${cx + 15} ${cy + bottom} ${cx + 11} ${cy + bottom} H ${cx - 11} Q ${cx - 15} ${cy + bottom} ${cx - 13} ${cy + 1} Z`;
      return (
        <g>
          <path d={d} fill={large ? CAVITY : TOOTH} />
          {large && (
            <>
              <defs>
                <clipPath id={clipId}>
                  <path d={d} />
                </clipPath>
              </defs>
              <rect
                x={cx - 16}
                y={cy - 8}
                width={32}
                height={9}
                fill={TOOTH}
                clipPath={`url(#${clipId})`}
              />
            </>
          )}
          <path d={d} fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        </g>
      );
    }
    case "talkAngryA":
    case "talkAngryB": {
      const bottom = kind === "talkAngryB" ? 12 : 5;
      const d = `M ${cx - 11} ${cy - 6} Q ${cx} ${cy - 10} ${cx + 11} ${cy - 6} L ${cx + 15} ${cy + bottom} Q ${cx} ${cy + bottom - 4} ${cx - 15} ${cy + bottom} Z`;
      return (
        <g>
          <defs>
            <clipPath id={clipId}>
              <path d={d} />
            </clipPath>
          </defs>
          <path d={d} fill={CAVITY} />
          <path
            d={`M ${cx - 16} ${cy - 12} H ${cx + 16} V ${cy - 1} Q ${cx} ${cy - 5} ${cx - 16} ${cy - 1} Z`}
            fill={TOOTH}
            clipPath={`url(#${clipId})`}
          />
          <path d={d} fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        </g>
      );
    }
    case "smile":
      return (
        <path d={`M ${cx - 13} ${cy - 3} Q ${cx} ${cy + 11} ${cx + 13} ${cy - 3}`} {...stroke} />
      );
    case "frown":
      return (
        <path d={`M ${cx - 13} ${cy + 5} Q ${cx} ${cy - 9} ${cx + 13} ${cy + 5}`} {...stroke} />
      );
    case "pain":
      return (
        <path
          d={`M ${cx - 14} ${cy + 2} C ${cx - 11} ${cy - 4} ${cx - 7} ${cy - 4} ${cx - 4} ${cy + 2} C ${cx - 1} ${cy + 8} ${cx + 3} ${cy + 8} ${cx + 6} ${cy + 2} C ${cx + 9} ${cy - 4} ${cx + 12} ${cy - 4} ${cx + 14} ${cy + 2}`}
          {...stroke}
        />
      );
    case "grit": {
      const { w, h } = GRIT;
      const r = 3;
      const wb = w - 3;
      const box =
        `M ${cx - w + r} ${cy - h} H ${cx + w - r} Q ${cx + w} ${cy - h} ${cx + w - 1} ${cy - h + r}` +
        ` L ${cx + wb + 1} ${cy + h - r} Q ${cx + wb} ${cy + h} ${cx + wb - r} ${cy + h}` +
        ` H ${cx - wb + r} Q ${cx - wb} ${cy + h} ${cx - wb - 1} ${cy + h - r}` +
        ` L ${cx - w + 1} ${cy - h + r} Q ${cx - w} ${cy - h} ${cx - w + r} ${cy - h} Z`;
      return (
        <g>
          <path d={box} fill={TOOTH} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <line x1={cx - w + 2} y1={cy} x2={cx + w - 2} y2={cy} stroke={INK} strokeWidth={2} />
        </g>
      );
    }
    case "wry":
      return (
        <path
          d={`M ${cx - 15} ${cy - 2} C ${cx - 11} ${cy + 6} ${cx - 5} ${cy + 6} ${cx - 1} ${cy + 1} C ${cx + 3} ${cy - 4} ${cx + 9} ${cy + 5} ${cx + 15} ${cy - 3}`}
          {...stroke}
        />
      );
    case "wryOpen": {
      // Lệch: khoé trái cao hơn khoé phải, đáy sâu về phía phải — đối xứng thì đọc thành cười vui
      const d = `M ${cx - 16} ${cy - 6} Q ${cx} ${cy - 3} ${cx + 15} ${cy - 1} Q ${cx + 14} ${cy + 16} ${cx + 2} ${cy + 16} Q ${cx - 13} ${cy + 15} ${cx - 16} ${cy - 6} Z`;
      return (
        <g>
          <defs>
            <clipPath id={clipId}>
              <path d={d} />
            </clipPath>
          </defs>
          <path d={d} fill={CAVITY} />
          <g clipPath={`url(#${clipId})`}>
            <ellipse cx={cx + 3} cy={cy + 14} rx={10} ry={6} fill={TONGUE} />
            <path
              d={`M ${cx - 18} ${cy - 12} H ${cx + 18} V ${cy + 3} Q ${cx} ${cy + 1} ${cx - 18} ${cy - 2} Z`}
              fill={TOOTH}
            />
          </g>
          <path d={d} fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        </g>
      );
    }
    case "grin": {
      const w = 15;
      const d = `M ${cx - w} ${cy - 4} Q ${cx} ${cy + 20} ${cx + w} ${cy - 4} Z`;
      return (
        <g>
          <defs>
            <clipPath id={clipId}>
              <path d={d} />
            </clipPath>
          </defs>
          <path d={d} fill={CAVITY} />
          <rect
            x={cx - w}
            y={cy - 6}
            width={w * 2}
            height={8}
            fill={TOOTH}
            clipPath={`url(#${clipId})`}
          />
          <path d={d} fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        </g>
      );
    }
  }
}

/** Mép trên / dưới của khẩu hình so với tâm miệng, cho râu bám theo */
export function mouthExtent(kind: MouthKind): { top: number; bottom: number } {
  switch (kind) {
    case "closed":
      return { top: -2, bottom: 2 };
    case "parted":
      return { top: -2.5, bottom: 3 };
    case "talkTeeth":
    case "talkA":
    case "talkB":
      return { top: TALK[kind].top - 0.5, bottom: TALK[kind].bottom };
    case "talkO":
    case "o":
    case "wide":
      return { top: OVAL[kind].dy - OVAL[kind].ry, bottom: OVAL[kind].dy + OVAL[kind].ry };
    case "talkSadA":
      return { top: -7, bottom: 6 };
    case "talkSadB":
      return { top: -7, bottom: 12 };
    case "talkAngryA":
      return { top: -10, bottom: 7 };
    case "talkAngryB":
      return { top: -10, bottom: 14 };
    case "smile":
      return { top: -3, bottom: 5 };
    case "frown":
      return { top: -3, bottom: 5 };
    case "pain":
      return { top: -4, bottom: 6 };
    case "grit":
      return { top: -GRIT.h, bottom: GRIT.h };
    case "grin":
      return { top: -4, bottom: 12 };
    case "wry":
      return { top: -3, bottom: 5 };
    case "wryOpen":
      return { top: -6, bottom: 16 };
  }
}
