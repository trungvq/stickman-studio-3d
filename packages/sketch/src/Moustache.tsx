import { mix } from "./geometry";
import { mouthExtent } from "./Mouth";
import type { CharacterData } from "./schema";
import type { MoustacheKind, MouthKind } from "./types";

type Face = CharacterData["face"];

const SHAPES: Record<Exclude<MoustacheKind, "none">, { outline: string; strands: string }> = {
  short: {
    outline: "M 0 -2 C 6 -8 15 -7 20 -2 L 24 3 Q 20 3 17 2 L 18 5 L 13 4 L 12 6 Q 5 5 0 1 Z",
    strands: "M 4 -2 Q 10 -4 18 0 M 5 1 Q 10 0 14 3",
  },
  long: {
    outline:
      "M 0 -2 C 8 -9 18 -7 22 3 C 25 10 25 19 29 27 L 25 24 L 25 28 C 20 23 18 16 17 10 Q 13 1 0 2 Z",
    strands: "M 5 -2 Q 16 -4 20 9 Q 21 17 25 23 M 9 0 Q 16 2 17 8",
  },
  pencil: {
    outline: "M 1 -2 Q 12 -5 23 1 L 27 4 Q 14 1 2 2 Z",
    strands: "M 5 -1 Q 15 -1 21 1",
  },
  chevron: {
    outline: "M 0 -4 Q 9 -8 16 -3 L 28 9 L 22 8 L 22 10 L 17 8 L 16 10 L 11 7 L 10 8 L 0 2 Z",
    strands: "M 4 -3 L 12 4 M 10 -3 L 19 6 M 16 0 L 23 6",
  },
  handlebar: {
    outline:
      "M 0 -2 C 8 -9 15 -5 20 -1 C 27 5 34 0 33 -6 Q 32 -10 29 -7 C 29 -14 38 -12 37 -5 C 37 8 25 13 15 8 Q 6 7 0 1 Z",
    strands: "M 4 -2 C 13 -4 18 6 27 5 Q 32 4 34 0 M 5 1 Q 11 4 15 5",
  },
  walrus: {
    outline:
      "M 0 -4 C 10 -9 22 -5 26 4 L 29 16 L 25 14 L 24 18 L 20 15 L 18 19 L 14 16 L 12 19 L 8 15 L 5 17 L 0 11 Z",
    strands: "M 4 -2 L 6 11 M 9 -3 L 12 13 M 15 -2 L 18 12 M 21 2 L 24 11",
  },
  horseshoe: {
    outline: "M 0 -3 C 9 -8 22 -6 25 3 L 26 28 L 22 27 L 19 29 L 17 25 L 17 9 Q 16 1 0 2 Z",
    strands: "M 5 -2 Q 21 -4 21 9 L 22 23 M 10 0 Q 18 0 18 5",
  },
};

export function Moustache({
  moustache,
  mouth,
  cx,
  cy,
  r,
}: {
  moustache: Face["moustache"];
  mouth: MouthKind;
  cx: number;
  cy: number;
  r: number;
}) {
  if (moustache.kind === "none") return null;
  const k = r / 65;
  const { color, width, dx, dy } = moustache;
  const mx = cx + dx;
  const my = cy + dy + (moustache.follow ? mouthExtent(mouth) : mouthExtent("closed")).top - 5 * k;
  const shape = SHAPES[moustache.kind];

  return (
    <g transform={`translate(${mx} ${my}) scale(${k * width} ${k})`}>
      {[-1, 1].map((side) => (
        <g key={side} transform={`scale(${side} 1)`}>
          <path
            d={shape.outline}
            fill={color}
            stroke={mix(color, "#000000", 0.35)}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <path
            d={shape.strands}
            fill="none"
            stroke={mix(color, "#ffffff", 0.25)}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  );
}

export const MOUSTACHE_KINDS: MoustacheKind[] = [
  "none",
  "short",
  "long",
  "pencil",
  "chevron",
  "handlebar",
  "walrus",
  "horseshoe",
];
