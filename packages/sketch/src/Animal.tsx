import { useId, type ReactNode } from "react";
import {
  ANIMAL_PIECE_KEYS,
  type AnimalData,
  type AnimalFace,
  type AnimalFigure,
  type AnimalLeg,
  animalLegs,
  animalPieceFile,
  type AnimalPieceKey,
  type AnimalPose,
  computeAnimalFigure,
  DEFAULT_ANIMAL_FACE,
  type EyeKind,
  isFar,
  type MouthKind,
  partColor,
  pathOf,
  type PieceUrls,
  type Pt,
  rgb01,
  type Root,
  SHADOW,
  WING_ELBOW,
} from "@stickman3d/rig/core";
import { rootDrop } from "./anchor";

export interface AnimalProps {
  animal: AnimalData;
  pose: AnimalPose;
  /** Mỏ, chỉ đầu `beak` vẽ; tên như miệng người, mỗi tên là một độ há */
  mouth?: MouthKind;
  eyes?: EyeKind;
  /** Ảnh đã nạp, khoá theo tên file trong `pieces/` */
  urls?: PieceUrls;
  x?: number;
  /** Đường đất; bàn chân thấp hơn luôn chạm đường này (gốc `feet`), hay chính khớp hông (gốc `hip`) */
  groundY?: number;
  /** `hip` là con vật bị xách, bị ôm: treo ở khớp hông, không bàn chân nào chạm đất, không bóng */
  root?: Root;
  /** Xoay cả con quanh gốc, độ theo chiều rig — con gà bị xách ngược */
  rotate?: number;
  /**
   * Chân gần nằm dưới hay trên thùng thân. Con hai chân đứng thì `under` — gốc chân chìm
   * trong bụng; đang bay thì `over`, không thì cặp chân xếp nằm gọn trong bóng thân và
   * con vật đọc ra là không có chân. `animalAt` trả sẵn.
   */
  legLayer?: "under" | "over";
  /**
   * Phần nào của con vật. `back` là tất cả trừ cánh gần, `front` là đúng cánh gần: người
   * cưỡi chen vào giữa hai phần ấy nên cánh gần quạt **trước** mặt người. `castSlots` dựng
   * sẵn cả hai cho `<Character>`.
   */
  part?: "all" | "back" | "front";
  scale?: number;
  flip?: boolean;
  /** Đậm của bóng tiếp đất; 0 = tắt */
  shadow?: number;
  opacity?: number;
}

const CAP = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Nhóm treo tại một điểm, trục `+y` chạy dọc đoạn ở góc rig `deg` — SVG xoay ngược dấu. */
const at = (p: Pt, deg: number) => `translate(${p[0]} ${p[1]}) rotate(${-deg})`;

/** Hộp của một socket trong hệ của nhóm treo nó; `+y` chạy dọc đoạn, gốc ở góc trên trái */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Hộp lấy nguyên từ bộ xương — dài theo đoạn, rộng theo bề dày đã khai. docs/08-dong-vat.md */
const bodyBox = (b: AnimalData): Box => ({
  x: -b.body.depth * (1 - b.body.back),
  y: -b.body.rear,
  w: b.body.depth,
  h: b.body.rear + b.rig.body + b.body.front,
});

const neckBox = (b: AnimalData): Box => {
  const w = Math.max(b.neck.base, b.neck.tip);
  return { x: -w / 2, y: 0, w, h: b.neck.len };
};

const headBox = (b: AnimalData): Box => ({
  x: -b.head.depth / 2,
  y: 0,
  w: b.head.depth,
  h: b.head.len,
});

const earBox = (b: AnimalData): Box => ({
  x: -b.parts.ear.width / 2,
  y: 0,
  w: b.parts.ear.width,
  h: b.parts.ear.len,
});

const wingBox = (b: AnimalData): Box => ({
  x: -b.parts.wing.width / 2,
  y: 0,
  w: b.parts.wing.width,
  h: b.parts.wing.len,
});

const tailBox = (b: AnimalData): Box => ({
  x: -b.parts.tail.width / 2,
  y: 0,
  w: b.parts.tail.width,
  h: b.parts.tail.len,
});

/** Dán một socket vào hộp của nó; `null` là socket không có ảnh, chỗ gọi vẽ hình code. */
type DrawPiece = (k: AnimalPieceKey, box: Box) => ReactNode;

/**
 * Động vật bốn chân hoặc hai chân, nhìn ngang. Chi là **nét que** như chi người. Thân, cổ,
 * đầu, tai, cánh và đuôi mỗi thứ có một hộp bám bộ xương: có ảnh thì dán ảnh vào hộp ấy,
 * không thì vẽ hình code. Gốc toạ độ của bộ xương là **khớp hông**; `groundY` là chỗ
 * bàn chân thấp nhất chạm. docs/08-dong-vat.md
 */
export function Animal({
  animal: b,
  pose,
  mouth = DEFAULT_ANIMAL_FACE.mouth,
  eyes = DEFAULT_ANIMAL_FACE.eyes,
  urls = {},
  x = 0,
  groundY = 0,
  root = "feet",
  rotate = 0,
  legLayer = "under",
  part = "all",
  scale = 1,
  flip = false,
  shadow = SHADOW,
  opacity = 1,
}: AnimalProps) {
  const uid = useId().replace(/:/g, "");
  const shadowId = `animalshadow${uid}`;
  const F = computeAnimalFigure(b, pose);
  const { line, coat } = b.palette;
  const belly = b.palette.belly ?? coat;
  const w = b.rig.stroke;
  const skin = { fill: coat, stroke: line, strokeWidth: w, strokeLinejoin: "round" } as const;
  const headSkin = { ...skin, fill: b.palette.head ?? coat } as const;
  const tintId = (k: AnimalPieceKey) => `animaltint${k}${uid}`;

  const urlOf = (k: AnimalPieceKey) => {
    const f = animalPieceFile(b.pieces[k]);
    return f ? urls[f] : undefined;
  };

  /**
   * Dán ảnh của socket vào hộp bộ xương của nó; không có ảnh thì trả `null` để chỗ gọi
   * vẽ hình code. `box` là `[x, y, w, h]` trong hệ của nhóm đang đứng.
   */
  const piece = (k: AnimalPieceKey, box: Box): ReactNode => {
    const url = urlOf(k);
    if (!url) return null;
    const p = b.pieces[k];
    const cx = box.x + box.w / 2 + p.dx;
    const cy = box.y + box.h / 2 + p.dy;
    const bw = box.w * p.scale * p.widthScale;
    const bh = box.h * p.scale;
    const tint = p.color ? `url(#${tintId(k)})` : undefined;
    const img = (
      <image
        href={url}
        x={cx - bw / 2}
        y={cy - bh / 2}
        width={bw}
        height={bh}
        preserveAspectRatio="none"
        filter={tint}
      />
    );
    // Góc rig ngược dấu với rotate() của SVG; xoay quanh tâm hộp như mọi socket
    return p.rotate ? <g transform={`rotate(${-p.rotate} ${cx} ${cy})`}>{img}</g> : img;
  };

  const leg = (k: AnimalLeg) => {
    const c = F.legs[k];
    if (!c) return null;
    return (
      <path
        key={k}
        d={pathOf(c)}
        stroke={b.palette.leg}
        strokeWidth={b.palette.legWidth}
        {...CAP}
      />
    );
  };

  // Chân gần của con bốn chân luôn nổi trên thân; con hai chân chỉ nổi lên khi đang bay
  const nearOver = b.legs === 4 || legLayer === "over";

  const legsOf = (side: "near" | "far") =>
    animalLegs(b)
      .filter((k) => isFar(k) === (side === "far"))
      .map(leg);

  return (
    <g
      transform={`translate(${x} ${groundY})${rotate ? ` rotate(${-rotate})` : ""} scale(${scale}) translate(0 ${-rootDrop(F.lowest, root)})`}
      opacity={opacity === 1 ? undefined : opacity}
    >
      <defs>
        {/* Ảnh mực — ruột trắng, nét đen — nhân với `color`; ảnh nhiều màu thì để trống */}
        {ANIMAL_PIECE_KEYS.filter((k) => urlOf(k) && b.pieces[k].color).map((k) => {
          const [r, g, bl] = rgb01(b.pieces[k].color as string);
          return (
            <filter key={k} id={tintId(k)} colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values={`${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${bl} 0 0  0 0 0 1 0`}
              />
            </filter>
          );
        })}
        {shadow > 0 && (
          <radialGradient id={shadowId}>
            <stop offset="0.45" stopColor={line} stopOpacity={shadow} />
            <stop offset="1" stopColor={line} stopOpacity={0} />
          </radialGradient>
        )}
      </defs>
      {shadow > 0 && root === "feet" && part !== "front" && (
        <Shadow fig={F} fill={`url(#${shadowId})`} depth={b.body.depth} />
      )}
      <g transform={`scale(${flip ? -1 : 1} 1)`}>
        {part === "front" ? (
          <Wing animal={b} fig={F} piece={piece} />
        ) : (
          <>
            {legsOf("far")}
            {!nearOver && legsOf("near")}
            <Tail animal={b} fig={F} piece={piece} />
            <Wing animal={b} fig={F} far piece={piece} />
            {/* Chân cổ chìm dưới thùng thân, còn khối đầu thì nổi lên trên: voi cổ ngắn có đầu
            nằm ngay trước ngực, vẽ thân sau đầu là mất luôn cái đầu */}
            <g transform={at(F.shoulder, F.neckDeg)}>
              {piece("neck", neckBox(b)) ?? (
                <g>
                  <path d={neckPath(b)} {...headSkin} />
                  <Stripes animal={b} box={neckBox(b)} shape={<path d={neckPath(b)} />} count={3} />
                </g>
              )}
            </g>
            <g transform={at(F.hip, F.spineDeg)}>
              {piece("body", bodyBox(b)) ?? (
                <g>
                  <path d={bodyPath(b)} {...skin} />
                  {b.palette.belly && <path d={bellyPath(b)} fill={belly} stroke="none" />}
                  <Stripes animal={b} box={bodyBox(b)} shape={<path d={bodyPath(b)} />} count={8} />
                  <path
                    d={bodyPath(b)}
                    fill="none"
                    stroke={line}
                    strokeWidth={w}
                    strokeLinejoin="round"
                  />
                </g>
              )}
            </g>
            <g transform={at(F.shoulder, F.neckDeg)}>
              <Mane animal={b} />
            </g>
            {/* Chân gần nổi trên thùng thân nhưng chìm dưới khối đầu và cánh gần: tai voi rủ
            xuống đè lên chân trước, cánh gà phủ lên đùi */}
            {nearOver && legsOf("near")}
            <g transform={at(F.poll, F.headDeg)}>
              <HeadMane animal={b} />
              <Ear animal={b} far piece={piece} />
              {piece("head", headBox(b)) ?? <Head animal={b} face={{ mouth, eyes }} />}
              <Ear animal={b} piece={piece} />
            </g>
            {part === "all" && <Wing animal={b} fig={F} piece={piece} />}
          </>
        )}
      </g>
    </g>
  );
}

function Stripes({
  animal: b,
  box,
  shape,
  count,
}: {
  animal: AnimalData;
  box: Box;
  shape: ReactNode;
  count: number;
}) {
  const id = `stripes${useId().replace(/:/g, "")}`;
  if (b.markings.kind !== "stripes") return null;
  const { x, y, w, h } = box;
  return (
    <g>
      <defs>
        <clipPath id={id}>{shape}</clipPath>
      </defs>
      <g clipPath={`url(#${id})`} fill={b.markings.color}>
        {Array.from({ length: count }, (_, i) => {
          const py = y + ((i + 0.45) * h) / count;
          const width = (h / count) * 0.36;
          const end = x + w * (i % 2 ? 0.26 : 0.43);
          return (
            <path
              key={i}
              d={`M ${x + w * 1.2} ${py - width} Q ${x + w * 0.65} ${py - width} ${end} ${py + width * 0.9} Q ${x + w * 0.73} ${py + width * 0.25} ${x + w * 1.2} ${py + width} Z`}
            />
          );
        })}
      </g>
    </g>
  );
}

/** Bóng loe theo khoảng cách hai bàn chân xa nhau nhất, như bóng của người */
function Shadow({ fig, fill, depth }: { fig: AnimalFigure; fill: string; depth: number }) {
  const xs = fig.feet.map((f) => f[0]);
  const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + depth * 0.34;
  return (
    <ellipse
      cx={(Math.max(...xs) + Math.min(...xs)) / 2}
      cy={fig.lowest}
      rx={rx}
      ry={depth * 0.13}
      fill={fill}
    />
  );
}

/** Nửa bề dày thân ở hai đầu; `back` chia bề dày thành lưng và bụng */
const girth = (b: AnimalData) => {
  const top = b.body.depth * b.body.back;
  const bot = b.body.depth * (1 - b.body.back);
  return {
    topR: top * b.body.rump,
    topF: top * b.body.chest,
    botR: bot * b.body.rump,
    botF: bot * b.body.chest,
  };
};

/**
 * Thùng thân trong hệ của trục sống: `+y` chạy từ hông ra vai, `+x` là phía lưng. Hai
 * đầu bo tròn, lưng hơi vồng và bụng hơi sệ — sáu số ở `body` đủ tách con ngựa thon khỏi
 * con voi tròn.
 */
function bodyPath(b: AnimalData): string {
  const { topR, topF, botR, botF } = girth(b);
  const { rear, front } = b.body;
  const L = b.rig.body;
  const y0 = -rear;
  const y1 = L + front;
  const k = 0.55;
  return [
    `M 0 ${y0}`,
    `C ${topR * k} ${y0} ${topR} ${y0 + rear * k} ${topR} 0`,
    `C ${topR * 1.05} ${L * 0.4} ${topF * 1.05} ${L * 0.6} ${topF} ${L}`,
    `C ${topF} ${L + front * k} ${topF * k} ${y1} 0 ${y1}`,
    `C ${-botF * k} ${y1} ${-botF} ${L + front * k} ${-botF} ${L}`,
    `C ${-botF * 1.08} ${L * 0.62} ${-botR * 1.08} ${L * 0.38} ${-botR} 0`,
    `C ${-botR} ${y0 + rear * k} ${-botR * k} ${y0} 0 ${y0}`,
    "Z",
  ].join(" ");
}

/** Mảng bụng sáng màu: nửa dưới của chính thùng thân, cắt ngang ở trục sống */
function bellyPath(b: AnimalData): string {
  const { botR, botF } = girth(b);
  const { rear, front } = b.body;
  const L = b.rig.body;
  const k = 0.55;
  return [
    `M 0 ${-rear}`,
    `C ${-botR * 0.14} ${L * 0.3} ${-botF * 0.14} ${L * 0.72} 0 ${L + front}`,
    `C ${-botF * k} ${L + front} ${-botF} ${L + front * k} ${-botF} ${L}`,
    `C ${-botF * 1.08} ${L * 0.62} ${-botR * 1.08} ${L * 0.38} ${-botR} 0`,
    `C ${-botR} ${-rear * k} ${-botR * k} ${-rear} 0 ${-rear}`,
    "Z",
  ].join(" ");
}

/** Cổ thon: rộng `base` ở vai, `tip` ở gáy, hai mép hơi cong */
function neckPath(b: AnimalData): string {
  const half0 = b.neck.base / 2;
  const half1 = b.neck.tip / 2;
  const L = b.neck.len;
  // Kéo dài xuống dưới vai để chân cổ chìm trong thùng thân, không hở đường ghép
  const y0 = -b.neck.base * 0.5;
  return [
    `M ${half0} ${y0}`,
    `C ${half0 * 1.06} ${L * 0.4} ${half1 * 1.1} ${L * 0.7} ${half1} ${L}`,
    `L ${-half1} ${L}`,
    `C ${-half1 * 1.1} ${L * 0.66} ${-half0 * 0.98} ${L * 0.36} ${-half0} ${y0}`,
    "Z",
  ].join(" ");
}

/** Bờm: một dải cong ôm mép lưng của cổ, dày nhất ở giữa, cao `len` */
function Mane({ animal: b }: { animal: AnimalData }) {
  const m = b.parts.mane;
  if (m.len <= 0 || m.kind !== "ridge") return null;
  const L = b.neck.len;
  const half0 = b.neck.base / 2;
  const half1 = b.neck.tip / 2;
  return (
    <path
      d={[
        `M ${half0 * 0.96} 0`,
        `C ${half0 + m.len} ${L * 0.28} ${half1 + m.len * 1.1} ${L * 0.66} ${half1 + m.len * 0.35} ${L * 1.02}`,
        `L ${half1 * 0.9} ${L}`,
        `C ${half1 * 1.04} ${L * 0.66} ${half0 * 0.98} ${L * 0.34} ${half0 * 0.96} 0`,
        "Z",
      ].join(" ")}
      fill={partColor(b, "mane")}
      stroke={b.palette.line}
      strokeWidth={b.rig.stroke}
      strokeLinejoin="round"
    />
  );
}

function HeadMane({ animal: b }: { animal: AnimalData }) {
  const m = b.parts.mane;
  if (m.len <= 0 || m.kind !== "ruff") return null;
  const rx = b.head.depth / 2 + m.len;
  const ry = b.head.len * 0.66 + m.width;
  const points: Pt[] = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI) / 12;
    const k = i % 2 ? 0.92 : 1;
    return [rx * Math.cos(a) * k, b.head.len * 0.16 + ry * Math.sin(a) * k];
  });
  return (
    <path
      d={smoothClosed(points)}
      fill={partColor(b, "mane")}
      stroke={b.palette.line}
      strokeWidth={b.rig.stroke}
      strokeLinejoin="round"
    />
  );
}

/** Đuôi bám hai đoạn xương; ảnh treo ở gốc và không gập ở khớp giữa. */
function Tail({
  animal: b,
  fig: F,
  piece,
}: {
  animal: AnimalData;
  fig: AnimalFigure;
  piece: DrawPiece;
}) {
  const t = b.parts.tail;
  if (t.kind === "none" || t.len <= 0) return null;
  const dockDeg =
    Math.atan2(F.tail[1][0] - F.tail[0][0], F.tail[1][1] - F.tail[0][1]) * (180 / Math.PI);
  const img = piece("tail", tailBox(b));
  if (img) return <g transform={at(F.tail[0], dockDeg)}>{img}</g>;

  const hair = partColor(b, "tail");
  const L = t.len;
  if (t.kind === "smooth") {
    const [root, mid, tip] = F.tail;
    const nx = (tip[1] - root[1]) * 0.24;
    const ny = (root[0] - tip[0]) * 0.24;
    const curve = `M ${root[0]} ${root[1]} C ${mid[0]} ${mid[1]} ${tip[0] + nx} ${tip[1] + ny} ${tip[0]} ${tip[1]}`;
    return (
      <g>
        <path d={curve} stroke={b.palette.line} strokeWidth={t.width + b.rig.stroke * 2} {...CAP} />
        <path d={curve} stroke={hair} strokeWidth={t.width} {...CAP} />
        {b.markings.kind === "stripes" && (
          <path
            d={curve}
            pathLength={100}
            stroke={b.markings.color}
            strokeWidth={t.width}
            strokeDasharray="5 12"
            {...CAP}
            strokeLinecap="butt"
          />
        )}
      </g>
    );
  }
  if (t.kind === "ribbon") {
    const mid = F.tail[1];
    const tip = F.tail[2];
    const tipDeg = Math.atan2(tip[0] - mid[0], tip[1] - mid[1]);
    const bend = tipDeg - (dockDeg * Math.PI) / 180;
    const tx = (L / 2) * Math.sin(bend);
    const ty = (L / 2) * (1 + Math.cos(bend));
    return (
      <g transform={at(F.tail[0], dockDeg)}>
        {[-2, -1, 0, 1, 2].map((i) => {
          const length = ty * (1 - Math.abs(i) * 0.08);
          const outline = (scale: number) => {
            const left: Pt[] = [];
            const right: Pt[] = [];
            for (let j = 0; j <= 28; j++) {
              const u = j / 28;
              const x =
                tx * u + i * t.width * 0.48 * u * u + t.width * 0.35 * Math.sin(2 * Math.PI * u);
              const y = length * u;
              const dx =
                tx + i * t.width * 0.96 * u + t.width * 0.7 * Math.PI * Math.cos(2 * Math.PI * u);
              const norm = Math.hypot(dx, length);
              const width = t.width * 0.14 * Math.sin(Math.PI * u) ** 0.7 * scale;
              left.push([x - (length / norm) * width, y + (dx / norm) * width]);
              right.push([x + (length / norm) * width, y - (dx / norm) * width]);
            }
            return smoothClosed([...left, ...right.reverse()]);
          };
          return (
            <g key={i}>
              <path
                d={outline(1)}
                fill={hair}
                stroke={b.palette.line}
                strokeWidth={b.rig.stroke}
                strokeLinejoin="round"
              />
              {t.accent && <path d={outline(0.35)} fill={t.accent} />}
            </g>
          );
        })}
      </g>
    );
  }
  if (t.kind === "fan")
    return (
      <g transform={at(F.tail[0], dockDeg)}>
        <FeatherFan w={t.width} h={L} animal={b} fill={hair} />
      </g>
    );
  const dock = pathOf(F.tail);
  const mid = F.tail[1];
  const deg = Math.atan2(F.tail[2][0] - mid[0], F.tail[2][1] - mid[1]) * (180 / Math.PI);
  const stalk = t.kind === "rope" ? t.width * 0.24 : t.width * 0.34;
  const H = L * 0.62;
  const W = t.width;
  const ink = {
    fill: hair,
    stroke: b.palette.line,
    strokeWidth: b.rig.stroke,
    strokeLinejoin: "round",
  } as const;
  if (t.kind === "tuft") {
    const bend = ((deg - dockDeg) * Math.PI) / 180;
    const tx = (L / 2) * Math.sin(bend);
    const ty = (L / 2) * (1 + Math.cos(bend));
    return (
      <g transform={at(F.tail[0], dockDeg)}>
        <path
          d={[
            `M ${-W * 0.12} 0`,
            `C ${-W * 0.5} ${L * 0.28} ${tx - W * 0.6} ${ty * 0.78} ${tx} ${ty}`,
            `C ${tx + W * 0.54} ${ty * 0.84} ${W * 0.5} ${L * 0.32} ${W * 0.12} 0`,
            "Z",
          ].join(" ")}
          {...ink}
        />
      </g>
    );
  }
  return (
    <g>
      <path d={dock} stroke={b.palette.line} strokeWidth={stalk + b.rig.stroke} {...CAP} />
      <path d={dock} stroke={b.palette.coat} strokeWidth={stalk} {...CAP} />
      <g transform={at(mid, deg)}>
        {t.kind === "rope" && (
          <path
            d={`M 0 ${H * 0.62} C ${-W * 0.4} ${H * 0.75} ${-W * 0.36} ${H * 0.92} ${-W * 0.5} ${H} C ${W * 0.16} ${H * 0.9} ${W * 0.32} ${H * 0.72} 0 ${H * 0.62} Z`}
            {...ink}
          />
        )}
      </g>
    </g>
  );
}

/** Đường kín mượt qua các điểm: Catmull-Rom đổi sang bezier bậc ba */
function smoothClosed(p: Pt[]): string {
  const n = p.length;
  const r = (v: number) => Math.round(v * 10) / 10;
  const seg = (i: number) => {
    const [a, b, c, d] = [p[(i - 1 + n) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]];
    return `C ${r(b[0] + (c[0] - a[0]) / 6)} ${r(b[1] + (c[1] - a[1]) / 6)} ${r(c[0] - (d[0] - b[0]) / 6)} ${r(c[1] - (d[1] - b[1]) / 6)} ${r(c[0])} ${r(c[1])}`;
  };
  return `M ${r(p[0][0])} ${r(p[0][1])} ${p.map((_, i) => seg(i)).join(" ")} Z`;
}

/**
 * Một lông liềm: gốc ở `0`, mọc dọc `+y`, đường tâm là cung tròn dài `len` gập tổng cộng
 * `bend` độ về phía `+x`; phình ở giữa rồi thon về chóp.
 */
function sickle(len: number, half: number, bend: number): string {
  const N = 10;
  const th = (bend * Math.PI) / 180;
  const R = len / th;
  const side = (sign: number, ts: number[]): Pt[] =>
    ts.map((t) => {
      const a = th * t;
      const wd = half * (0.6 + 1.8 * t) * Math.pow(1 - t, 0.7);
      // pháp tuyến của cung: hướng ra khỏi tâm cong (R, 0)
      return [
        R * (1 - Math.cos(a)) - sign * wd * Math.cos(a),
        R * Math.sin(a) + sign * wd * Math.sin(a),
      ];
    });
  const ts = Array.from({ length: N }, (_, i) => i / N);
  return smoothClosed([
    ...side(1, ts),
    [R * (1 - Math.cos(th)), R * Math.sin(th)],
    ...side(-1, [...ts].reverse()),
  ]);
}

/** Đuôi lông vũ: năm lông liềm chung một gốc, dài nhất ở giữa, cong về cùng một phía */
const TAIL_BLADES: [number, number][] = [
  [34, 1],
  [19, 0.94],
  [5, 0.84],
  [-8, 0.72],
  [-20, 0.6],
];

function FeatherFan({
  w,
  h,
  bend = 100,
  blades = TAIL_BLADES,
  animal: b,
  fill,
}: {
  w: number;
  h: number;
  bend?: number;
  /** [góc lệch trục, độ dài so với `h`] */
  blades?: [number, number][];
  animal: AnimalData;
  fill: string;
}) {
  const half = w * 0.2;
  return (
    <g fill={fill} stroke={b.palette.line} strokeWidth={b.rig.stroke} strokeLinejoin="round">
      {blades.map(([a, k]) => (
        <path key={a} transform={`rotate(${a})`} d={sickle(h * k, half, bend)} />
      ))}
    </g>
  );
}

/** Khối đầu trong hệ của chính nó: `+y` từ gáy ra mõm, `+x` là phía đỉnh đầu */
function Head({ animal: b, face }: { animal: AnimalData; face: AnimalFace }) {
  const { kind, len: L, depth: d, eye } = b.head;
  const { line, coat } = b.palette;
  const w = b.rig.stroke;
  const skin = {
    fill: b.palette.head ?? coat,
    stroke: line,
    strokeWidth: w,
    strokeLinejoin: "round",
  } as const;
  const bone = (k: "tusk" | "horn") =>
    ({ fill: partColor(b, k), stroke: line, strokeWidth: w, strokeLinejoin: "round" }) as const;
  const t = b.parts;
  const tusk = (far: boolean) =>
    t.tusk.len > 0 && (
      <g transform={`translate(${d * 0.24} ${L * 0.9})`} {...bone("tusk")}>
        <path
          transform={
            far ? `translate(${t.tusk.width * 0.9} ${-t.tusk.width * 0.35}) scale(0.85)` : undefined
          }
          d={`M 0 ${-t.tusk.width * 0.5} C ${t.tusk.len * 0.25} ${t.tusk.width * 0.2} ${t.tusk.len * 0.66} ${t.tusk.width * 0.92} ${t.tusk.len} ${t.tusk.width} Q ${t.tusk.len * 1.1} ${t.tusk.width * 1.24} ${t.tusk.len * 0.93} ${t.tusk.width * 1.3} C ${t.tusk.len * 0.58} ${t.tusk.width * 1.52} ${t.tusk.len * 0.13} ${t.tusk.width * 0.88} ${-t.tusk.width * 0.25} ${t.tusk.width * 0.16} Q ${-t.tusk.width * 0.32} ${-t.tusk.width * 0.18} 0 ${-t.tusk.width * 0.5} Z`}
        />
      </g>
    );

  const taperedPath = [
    `M ${-d * 0.44} ${-L * 0.12}`,
    `C ${-d * 0.52} ${-L * 0.34} ${d * 0.36} ${-L * 0.34} ${d * 0.48} ${-L * 0.08}`,
    `Q ${d * 0.55} ${L * 0.23} ${d * 0.18} ${L * 0.48}`,
    `L ${d * 0.05} ${L * 0.98}`,
    `Q ${-d * 0.04} ${L * 1.08} ${-d * 0.2} ${L}`,
    `L ${-d * 0.42} ${L * 0.47}`,
    `Q ${-d * 0.54} ${L * 0.16} ${-d * 0.44} ${-L * 0.12} Z`,
  ].join(" ");

  const shape =
    kind === "blunt" ? (
      <path
        d={[
          `M ${-d * 0.46} ${L * 0.04}`,
          `C ${-d * 0.3} ${-L * 0.1} ${-d * 0.06} ${-L * 0.13} ${d * 0.04} ${-L * 0.08}`,
          `C ${d * 0.24} ${-L * 0.15} ${d * 0.4} ${-L * 0.05} ${d * 0.46} ${L * 0.16}`,
          `C ${d * 0.58} ${L * 0.46} ${d * 0.6} ${L * 0.77} ${d * 0.55} ${L}`,
          `C ${d * 0.43} ${L * 1.02} ${d * 0.25} ${L * 0.94} ${d * 0.2} ${L * 0.88}`,
          `C ${d * 0.1} ${L * 1.07} ${-d * 0.03} ${L * 1.01} ${-d * 0.14} ${L * 0.95}`,
          `C ${-d * 0.22} ${L * 1.02} ${-d * 0.24} ${L * 0.84} ${-d * 0.25} ${L * 0.65}`,
          `C ${-d * 0.5} ${L * 0.45} ${-d * 0.62} ${L * 0.22} ${-d * 0.46} ${L * 0.04} Z`,
        ].join(" ")}
        {...skin}
      />
    ) : kind === "tapered" ? (
      <path d={taperedPath} {...skin} />
    ) : kind === "round" ? (
      <ellipse cx={0} cy={L * 0.32} rx={d * 0.5} ry={L * 0.66} {...skin} />
    ) : kind === "beak" ? (
      <circle cx={SKULL(b).cx} cy={SKULL(b).cy} r={SKULL(b).r} {...skin} />
    ) : (
      <path
        d={[
          `M ${d * 0.5} ${-d * 0.18}`,
          `C ${d * 0.52} ${L * 0.4} ${d * 0.4} ${L * 0.8} ${d * 0.33} ${L}`,
          `C ${d * 0.2} ${L + d * 0.16} ${-d * 0.2} ${L + d * 0.16} ${-d * 0.3} ${L}`,
          `C ${-d * 0.42} ${L * 0.66} ${-d * 0.66} ${L * 0.3} ${-d * 0.6} ${-d * 0.1}`,
          `C ${-d * 0.4} ${-d * 0.42} ${d * 0.3} ${-d * 0.44} ${d * 0.5} ${-d * 0.18}`,
          "Z",
        ].join(" ")}
        {...skin}
      />
    );

  const eyeAt: Pt =
    kind === "beak"
      ? onSkull(b, 62, 0.5)
      : kind === "blunt"
        ? [d * 0.32, L * 0.53]
        : kind === "round"
          ? [d * 0.13, L * 0.51]
          : kind === "tapered"
            ? [d * 0.16, L * 0.4]
            : [-d * 0.12, L * 0.3];
  return (
    <g>
      {t.horn.len > 0 && (
        <path
          d={`M ${-t.horn.width / 2} 0 C ${-t.horn.width * 0.5} ${-t.horn.len * 0.6} ${t.horn.width * 0.3} ${-t.horn.len * 0.9} ${t.horn.width * 0.2} ${-t.horn.len} L ${t.horn.width / 2} ${-t.horn.len * 0.1} Z`}
          transform={`translate(${d * 0.34} ${L * 0.1}) rotate(-18)`}
          {...bone("horn")}
        />
      )}
      {t.crest.len > 0 && <Crest w={t.crest.width} h={t.crest.len} animal={b} />}
      {tusk(true)}
      {t.trunk.len > 0 && <Trunk len={t.trunk.len} width={t.trunk.width} L={L} animal={b} />}
      {shape}
      <Stripes animal={b} box={headBox(b)} shape={shape} count={3} />
      {kind === "tapered" && (
        <g>
          <path
            d={`M ${d * 0.18} ${L * 0.48} L ${d * 0.05} ${L * 0.98} Q ${-d * 0.04} ${L * 1.08} ${-d * 0.2} ${L} L ${-d * 0.37} ${L * 0.59} Q ${-d * 0.1} ${L * 0.38} ${d * 0.18} ${L * 0.48} Z`}
            fill={b.palette.belly ?? b.palette.coat}
          />
          <path d={taperedPath} fill="none" stroke={line} strokeWidth={w} strokeLinejoin="round" />
          <ellipse cx={d * 0.015} cy={L * 0.98} rx={d * 0.12} ry={L * 0.085} fill={line} />
          <path
            d={`M ${-d * 0.13} ${L * 0.95} Q ${-d * 0.25} ${L * 0.83} ${-d * 0.23} ${L * 0.68}`}
            stroke={line}
            strokeWidth={w * 0.65}
            {...CAP}
          />
        </g>
      )}
      {kind === "round" && (
        <g>
          <ellipse
            cx={-d * 0.2}
            cy={L * 0.77}
            rx={d * 0.3}
            ry={L * 0.36}
            fill={b.palette.belly ?? b.palette.coat}
            stroke={line}
            strokeWidth={w}
          />
          <path
            d={`M ${d * 0.03} ${L * 0.99} Q ${-d * 0.02} ${L * 1.2} ${-d * 0.13} ${L * 1.06} L ${-d * 0.07} ${L * 0.95} Z`}
            fill={line}
          />
          <path
            d={`M ${-d * 0.12} ${L * 1.05} Q ${-d * 0.25} ${L * 1.01} ${-d * 0.27} ${L * 0.84}`}
            stroke={line}
            strokeWidth={w * 0.65}
            {...CAP}
          />
        </g>
      )}
      {kind === "beak" && <Beak d={d} L={L} animal={b} mouth={face.mouth} />}
      {tusk(false)}
      {eye > 0 && kind === "round" && (
        <ellipse
          cx={eyeAt[0]}
          cy={eyeAt[1]}
          rx={eye * 1.8}
          ry={eye * 1.5}
          fill={b.palette.belly ?? b.palette.coat}
        />
      )}
      {eye > 0 && <Eye at={eyeAt} r={eye} kind={face.eyes} line={line} />}
      {eye > 0 && kind === "blunt" && face.eyes === "open" && (
        <circle cx={eyeAt[0] + eye * 0.25} cy={eyeAt[1] - eye * 0.3} r={eye * 0.22} fill="white" />
      )}
    </g>
  );
}

/**
 * Con mắt trong hệ đầu: `+x` là đỉnh đầu nên mí khép là vạch dọc `y`, mắt cười vồng về `+x`,
 * mắt nheo chỉ còn nửa phía cằm (`−x`). Cùng bộ tên với mắt người, cỡ theo `head.eye`.
 */
function Eye({ at: [x, y], r, kind, line }: { at: Pt; r: number; kind: EyeKind; line: string }) {
  const stroke = {
    fill: "none",
    stroke: line,
    strokeWidth: r * 0.55,
    strokeLinecap: "round",
  } as const;
  switch (kind) {
    case "wink":
      return (
        <path d={`M ${x} ${y - r * 1.2} Q ${x + r * 0.6} ${y} ${x} ${y + r * 1.2}`} {...stroke} />
      );
    case "squeezed":
      return (
        <path
          d={`M ${x + r} ${y - r} L ${x} ${y + r * 0.8} L ${x - r} ${y - r}`}
          {...stroke}
          strokeLinejoin="round"
        />
      );
    case "droopy":
      return (
        <path
          d={`M ${x + r * 0.5} ${y - r} Q ${x} ${y} ${x - r * 0.5} ${y + r} Q ${x - r * 1.6} ${y} ${x + r * 0.5} ${y - r} Z`}
          fill={line}
        />
      );
    case "shut":
      return <line x1={x} y1={y - r * 1.2} x2={x} y2={y + r * 1.2} {...stroke} />;
    case "wide":
      return (
        <g>
          <circle cx={x} cy={y} r={r * 1.9} fill="white" stroke={line} strokeWidth={r * 0.3} />
          <circle cx={x} cy={y} r={r * 0.9} fill={line} />
        </g>
      );
    case "squint":
      return <path d={`M ${x} ${y - r} A ${r} ${r} 0 0 0 ${x} ${y + r} Z`} fill={line} />;
    case "happy":
      return (
        <path
          d={`M ${x - r * 0.4} ${y - r * 1.3} Q ${x + r * 1.4} ${y} ${x - r * 0.4} ${y + r * 1.3}`}
          {...stroke}
        />
      );
    default:
      return <circle cx={x} cy={y} r={r} fill={line} />;
  }
}

/** Vòi treo ở mép trước mõm; chóp cuộn về phía gáy trong hệ đầu. */
function Trunk({
  len,
  width,
  L,
  animal: b,
}: {
  len: number;
  width: number;
  L: number;
  animal: AnimalData;
}) {
  const y0 = L * 0.86;
  const d = [
    `M ${-width * 0.55} ${y0}`,
    `C ${-width * 0.26} ${y0 + len * 0.3} ${-width * 0.37} ${y0 + len * 0.62} ${-width * 0.95} ${y0 + len * 0.79}`,
    `C ${-width * 1.24} ${y0 + len * 0.87} ${-width * 1.7} ${y0 + len * 0.77} ${-width * 1.65} ${y0 + len * 0.87}`,
    `Q ${-width * 1.88} ${y0 + len * 0.97} ${-width * 1.55} ${y0 + len * 0.99}`,
    `C ${-width * 0.76} ${y0 + len * 1.09} ${-width * 0.32} ${y0 + len * 0.91} ${width * 0.04} ${y0 + len * 0.65}`,
    `C ${width * 0.39} ${y0 + len * 0.4} ${width * 0.56} ${y0 + len * 0.1} ${width * 0.48} ${y0}`,
    "Z",
  ].join(" ");
  return (
    <g transform={`translate(${b.head.depth * 0.4} 0)`}>
      <path
        d={d}
        fill={partColor(b, "trunk")}
        stroke={b.palette.line}
        strokeWidth={b.rig.stroke}
        strokeLinejoin="round"
      />
      {[
        [-0.4, 0.24],
        [-0.44, 0.4],
        [-0.56, 0.56],
        [-0.76, 0.7],
      ].map(([x, y]) => (
        <path
          key={y}
          d={`M ${x * width} ${y0 + y * len} l ${width * 0.22} ${width * 0.08} l ${-width * 0.26} ${width * 0.04} Z`}
          fill={b.palette.line}
        />
      ))}
    </g>
  );
}

/** Mỏ và yếm của chim */
/**
 * Sọ `beak` là vòng tròn bán kính `d/2`, tâm trên trục đầu lùi về gáy vừa đủ để phủ trọn
 * đĩa gáy bán kính `neck.tip/2` — nhờ vậy góc cổ không ló ra dù đầu hếch bao nhiêu. Mỏ,
 * yếm, mào bám vòng ấy theo góc: `0°` là đỉnh sọ (`+x`), `90°` là phía trước (`+y`), `180°`
 * là cằm.
 */
const SKULL = (b: AnimalData) => {
  const r = b.head.depth / 2;
  return { cx: 0, cy: Math.max(0, r - b.neck.tip / 2), r };
};
const onSkull = (b: AnimalData, deg: number, k: number): Pt => {
  const { cx, cy, r } = SKULL(b);
  const a = (deg * Math.PI) / 180;
  return [cx + r * k * Math.cos(a), cy + r * k * Math.sin(a)];
};

/** Độ há của mỏ theo tên miệng người, độ; mỏ dưới xoay quanh khớp mỏ về phía cằm */
const BEAK_GAP: Record<MouthKind, number> = {
  closed: 0,
  parted: 3,
  talkTeeth: 4,
  talkA: 10,
  talkB: 24,
  talkO: 16,
  talkSadA: 10,
  talkSadB: 24,
  talkAngryA: 10,
  talkAngryB: 24,
  smile: 3,
  grin: 14,
  frown: 3,
  pain: 18,
  o: 14,
  wide: 34,
  grit: 6,
  wry: 3,
  wryOpen: 14,
};

/**
 * Mỏ: hai mũi nhọn màu sừng chung khớp ở mép trước sọ, mỏ dưới há theo `mouth`. Yếm — giọt
 * màu mào rủ dưới cằm — đi cùng mào: chim không mào thì không yếm.
 */
function Beak({
  d,
  L,
  animal: b,
  mouth,
}: {
  d: number;
  L: number;
  animal: AnimalData;
  mouth: MouthKind;
}) {
  const ink = {
    stroke: b.palette.line,
    strokeWidth: b.rig.stroke,
    strokeLinejoin: "round",
  } as const;
  const [ux, uy] = onSkull(b, 66, 0.9);
  const [lx, ly] = onSkull(b, 112, 0.9);
  const [hx, hy] = onSkull(b, 89, 0.8);
  const tipX = d * 0.04;
  const wattle = smoothClosed([
    onSkull(b, 118, 0.85),
    onSkull(b, 122, 1.12),
    onSkull(b, 132, 1.42),
    onSkull(b, 150, 1.28),
    onSkull(b, 158, 0.85),
  ]);
  return (
    <g>
      {b.parts.crest.len > 0 && b.parts.crest.kind === "comb" && (
        <path d={wattle} fill={partColor(b, "crest")} {...ink} />
      )}
      <path
        d={`M ${hx} ${hy} L ${tipX} ${L} L ${lx} ${ly} Z`}
        transform={`rotate(${BEAK_GAP[mouth]} ${hx} ${hy})`}
        fill={b.palette.horn}
        {...ink}
      />
      <path d={`M ${ux} ${uy} L ${tipX} ${L} L ${hx} ${hy} Z`} fill={b.palette.horn} {...ink} />
    </g>
  );
}

/** Mào: ba múi tròn bám vòm sọ, trải góc tương ứng cung dài `w`, nhô cao `h` trên sọ */
function Crest({ w, h, animal: b }: { w: number; h: number; animal: AnimalData }) {
  if (b.parts.crest.kind === "plume") {
    const root = onSkull(b, -20, 0.8);
    return (
      <g transform={`translate(${root[0]} ${root[1]})`}>
        {[0.7, 0.86, 1].map((length, i) => (
          <path
            key={i}
            d={`M 0 0 C ${h * 0.15} ${-h * 0.3} ${h * (0.7 - i * 0.24)} ${-h * 0.45} ${h * (0.85 - i * 0.25)} ${-h * length} Q ${h * (0.95 - i * 0.25)} ${-h * 0.38} ${w * (0.4 - i * 0.2)} ${-h * 0.12} L ${-w * 0.12} 0 Z`}
            fill={partColor(b, "crest")}
            stroke={b.palette.line}
            strokeWidth={b.rig.stroke}
            strokeLinejoin="round"
          />
        ))}
      </g>
    );
  }
  const d = b.head.depth;
  const r = d / 2;
  const span = ((w / r) * 180) / Math.PI;
  const from = -12 - span / 2;
  const pts: Pt[] = [onSkull(b, from - 6, 0.8)];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * 3;
    const f = u - Math.min(2, Math.floor(u));
    const bump = 0.3 + 0.7 * Math.sin(Math.PI * f);
    pts.push(onSkull(b, from + (i / N) * span, 1 + (h / r) * bump));
  }
  pts.push(onSkull(b, from + span + 6, 0.8));
  return (
    <path
      d={smoothClosed(pts)}
      fill={partColor(b, "crest")}
      stroke={b.palette.line}
      strokeWidth={b.rig.stroke}
      strokeLinejoin="round"
    />
  );
}

/** Viền cánh nối qua khớp; ảnh socket bám đoạn gốc. */
function Wing({
  animal: b,
  fig: F,
  far = false,
  piece,
}: {
  animal: AnimalData;
  fig: AnimalFigure;
  far?: boolean;
  piece: DrawPiece;
}): ReactNode {
  const uid = useId().replace(/:/g, "");
  const wg = b.parts.wing;
  if (wg.len <= 0) return null;
  const w = wg.width;
  const inner = wg.len * WING_ELBOW;
  const outer = wg.len - inner;
  const fill = partColor(b, "wing");
  const fold = F.wingDeg - F.wingTipDeg;
  const hinge = `translate(0 ${inner}) rotate(${fold})`;
  const upperEdge = [
    `M ${-w * 0.18} 0`,
    `C ${-w * 0.42} ${inner * 0.3} ${-w * 0.38} ${inner * 0.75} ${-w * 0.28} ${inner}`,
    `Q ${-w * 0.28} ${inner + w * 0.28} 0 ${inner + w * 0.28}`,
    `Q ${w * 0.28} ${inner + w * 0.28} ${w * 0.28} ${inner}`,
    `C ${w * 0.5} ${inner * 0.6} ${w * 0.38} ${inner * 0.15} ${w * 0.18} 0`,
    `Q 0 ${-w * 0.2} ${-w * 0.18} 0 Z`,
  ].join(" ");
  const lowerEdge = [
    `M ${-w * 0.28} 0 Q ${-w * 0.4} ${outer * 0.5} 0 ${outer}`,
    ...[0, 1, 2, 3].map((i) => {
      const y = outer * (0.86 - i * 0.18);
      const x = w * (0.24 + i * 0.12);
      return `Q ${x} ${y + outer * 0.16} ${x} ${y} L ${x * 0.7} ${y - outer * 0.08}`;
    }),
    `Q ${w * 0.72} ${outer * 0.04} ${w * 0.28} 0 Q 0 ${-w * 0.45} ${-w * 0.28} 0 Z`,
  ].join(" ");
  const shapes = (
    <>
      <path d={upperEdge} />
      <path d={lowerEdge} transform={hinge} />
    </>
  );
  return (
    <g transform={at(F.wing[0], F.wingDeg - (far ? 14 : 0))}>
      {piece("wing", wingBox(b)) ?? (
        <g>
          {/* Tô cả hai đoạn sau khi viền để phần chồng khớp không lộ nét bên trong. */}
          <g
            fill={fill}
            stroke={b.palette.line}
            strokeWidth={b.rig.stroke * 2}
            strokeLinejoin="round"
          >
            {shapes}
          </g>
          <g fill={fill}>{shapes}</g>
          <path
            d={`M ${w * 0.12} ${inner * 0.22} Q ${w * 0.3} ${inner * 0.5} ${w * 0.16} ${inner * 0.78}`}
            stroke={b.palette.line}
            strokeWidth={b.rig.stroke * 0.55}
            {...CAP}
          />
          <g transform={hinge}>
            <path d={lowerEdge} fill={fill} />
            {wg.accent && (
              <>
                <defs>
                  <clipPath id={`wingtip${uid}`}>
                    <path d={lowerEdge} />
                  </clipPath>
                </defs>
                <path
                  d={`M 0 ${-w * 0.1} Q ${-w * 0.15} ${outer * 0.4} 0 ${outer * 0.86} Q ${w * 0.48} ${outer * 0.42} 0 ${-w * 0.1} Z`}
                  fill={wg.accent}
                  clipPath={`url(#wingtip${uid})`}
                />
              </>
            )}
          </g>
        </g>
      )}
    </g>
  );
}

/**
 * Tai: mọc ở `at` dọc trục đầu rồi chìa ra theo `pitch` của chính nó, vẽ dọc `+y` từ gốc
 * ra chóp. Tai xa vẽ trước khối đầu, lệch thêm ít độ cho khỏi trùng khít.
 */
function Ear({
  animal: b,
  far = false,
  piece,
}: {
  animal: AnimalData;
  far?: boolean;
  piece: DrawPiece;
}): ReactNode {
  const e = b.parts.ear;
  if (e.kind === "none" || e.len <= 0) return null;
  const L = e.len;
  const w = e.width;
  const skin = {
    fill: partColor(b, "ear"),
    stroke: b.palette.line,
    strokeWidth: b.rig.stroke,
    strokeLinejoin: "round",
  } as const;
  const shape =
    e.kind === "round"
      ? `M ${-w / 2} 0 C ${-w * 0.8} ${L * 1.3} ${w * 0.8} ${L * 1.3} ${w / 2} 0 Z`
      : e.kind === "perk"
        ? `M ${-w / 2} 0 Q ${-w * 0.2} ${L * 0.72} 0 ${L} Q ${w * 0.45} ${L * 0.5} ${w / 2} 0 Z`
        : e.kind === "fan"
          ? [
              `M ${w * 0.45} 0`,
              `C ${w * 0.05} ${-L * 0.1} ${-w * 0.18} ${-L * 0.1} ${-w * 0.32} ${L * 0.02}`,
              `C ${-w * 0.7} ${L * 0.18} ${-w * 0.9} ${L * 0.4} ${-w * 0.95} ${L * 0.48}`,
              `C ${-w * 1.02} ${L * 0.61} ${-w * 0.35} ${L * 0.64} ${-w * 0.2} ${L * 0.73}`,
              `C ${-w * 0.1} ${L * 0.8} ${-w * 0.2} ${L * 0.92} ${w * 0.03} ${L * 0.99}`,
              `C ${w * 0.28} ${L * 1.14} ${w * 0.6} ${L * 0.94} ${w * 0.56} ${L * 0.77}`,
              `C ${w * 0.65} ${L * 0.58} ${w * 0.72} ${L * 0.18} ${w * 0.45} 0 Z`,
            ].join(" ")
          : `M ${-w / 2} 0 C ${-w * 0.72} ${L * 0.5} ${-w * 0.4} ${L} ${w * 0.1} ${L * 0.94} C ${w * 0.56} ${L * 0.5} ${w * 0.56} ${L * 0.14} ${w / 2} 0 Z`;
  return (
    <g
      transform={`translate(${b.head.depth * e.dx} ${b.head.len * e.at}) rotate(${-(e.pitch + (far ? 16 : -4))})`}
    >
      {piece("ear", earBox(b)) ?? (
        <g>
          <path d={shape} {...skin} />
          {e.kind === "round" && (
            <ellipse
              cx={0}
              cy={L * 0.42}
              rx={w * 0.22}
              ry={L * 0.29}
              fill={b.palette.belly ?? b.palette.line}
            />
          )}
          {e.kind === "fan" && !far && (
            <path
              d={`M ${-w * 0.43} ${L * 0.35} Q ${w * 0.04} ${L * 0.23} ${w * 0.18} ${L * 0.28} Q ${-w * 0.12} ${L * 0.27} ${-w * 0.43} ${L * 0.35} Z`}
              fill={b.palette.line}
            />
          )}
        </g>
      )}
    </g>
  );
}
