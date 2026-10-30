import { Piece } from "./Piece";
import type { ReactNode } from "react";
import type { FxAnchor } from "./anchor";
import { clamp01, easeInOut, hash, pop, type Pt } from "./math";
import { BUBBLE, type BubbleData, type BubbleItemData, type GrawlixData } from "./schema";

/** Quãng một món bật ra */
const POP_S = 0.28;

/** Cỡ của một món bật ra ở `at`: `0` trước đó, `pop` trong 0,28 s, rồi `1` */
export const popScale = (t: number, at: number, dur = POP_S): number =>
  t < at ? 0 : pop(clamp01((t - at) / dur));

/** Cỡ của cả bong bóng: bật ra trong `grow` giây từ `open`, co lại `fade` giây cuối trước `shut` */
export function bubbleScale(t: number, open: number, shut: number, grow = 0.3, fade = 0.25) {
  if (t < open || t > shut) return 0;
  return pop(clamp01((t - open) / grow)) * (1 - easeInOut(clamp01((t - (shut - fade)) / fade)));
}

/** Một món trong bong bóng: đặt ở `(x, y)`, bật ra ở `at`, thôi vẽ từ `until` */
export function Pop({
  t,
  at,
  until = Infinity,
  x = 0,
  y = 0,
  scale = 1,
  children,
}: {
  t: number;
  at: number;
  until?: number;
  x?: number;
  y?: number;
  scale?: number;
  children: ReactNode;
}) {
  const s = popScale(t, at);
  if (s <= 0 || t >= until) return null;
  return <g transform={`translate(${x} ${y}) scale(${s * scale})`}>{children}</g>;
}

type Box = { dx: number; dy: number; w: number; h: number };

/** Chân đuôi trên cạnh hộp gần mũi nhất (gốc ở mũi); `null` nếu mũi nằm trong hộp */
function tailBase(box: Box, r: number, half: number) {
  const hw = box.w / 2;
  const hh = box.h / 2;
  const px = -box.dx;
  const py = -box.dy;
  if (Math.abs(px) <= hw && Math.abs(py) <= hh) return null;
  const slide = (p: number, h: number) => {
    const room = h - r - half;
    return room > 0 ? Math.max(-room, Math.min(room, p)) : 0;
  };
  if (Math.abs(py) / hh >= Math.abs(px) / hw) {
    const side = Math.sign(py);
    return { vertical: false, side, along: slide(px, hw), edge: box.dy + side * hh };
  }
  const side = Math.sign(px);
  return { vertical: true, side, along: slide(py, hh), edge: box.dx + side * hw };
}

/** Điểm trên cạnh `edge` lệch `along` khỏi tâm cạnh */
function onEdge(base: NonNullable<ReturnType<typeof tailBase>>, box: Box, along: number) {
  return base.vertical ? { x: base.edge, y: box.dy + along } : { x: box.dx + along, y: base.edge };
}

type Shape = NonNullable<BubbleData["shape"]>;

/** Chân đuôi lùi vào trong thân — ruột đuôi và thân hoà làm một nên chỉ cần nằm lọt, không cần khớp cạnh */
function tailRoot(box: Box, shape: Shape, r: number, half: number) {
  const base = tailBase(box, shape === "round" ? r : 0, half);
  if (!base) return null;
  const p = onEdge(base, box, base.along);
  if (shape === "round") {
    const d = Math.min(half, (base.vertical ? box.w : box.h) / 4);
    return base.vertical ? { x: p.x - base.side * d, y: p.y } : { x: p.x, y: p.y - base.side * d };
  }
  const ex = (p.x - box.dx) / (box.w / 2);
  const ey = (p.y - box.dy) / (box.h / 2);
  const f = (shape === "cloud" ? 0.65 : 0.8) / Math.hypot(ex, ey);
  return { x: box.dx + (p.x - box.dx) * f, y: box.dy + (p.y - box.dy) * f };
}

/** Đuôi cong như sừng từ `root` tới mũi ở gốc: hai cạnh cùng cong một phía, cạnh ngoài cong hơn nên đuôi thuôn */
function tailPath(root: Pt, half: number, curl: number, box: Box) {
  const len = Math.hypot(root.x, root.y);
  const nx = root.y / len;
  const ny = -root.x / len;
  // Bụng đuôi quay về phía tâm hộp
  const s = Math.sign(nx * (box.dx - root.x) + ny * (box.dy - root.y)) || 1;
  const a = { x: root.x + nx * half, y: root.y + ny * half };
  const b = { x: root.x - nx * half, y: root.y - ny * half };
  const ctl = (p: Pt, k: number) => {
    const o = s * curl * len * k;
    return `${(p.x / 2 + nx * o).toFixed(1)} ${(p.y / 2 + ny * o).toFixed(1)}`;
  };
  const f = (v: number) => v.toFixed(1);
  return `M${f(a.x)} ${f(a.y)} Q${ctl(a, s > 0 ? 0.5 : 0.3)} 0 0 Q${ctl(b, s > 0 ? 0.3 : 0.5)} ${f(b.x)} ${f(b.y)}Z`;
}

/** Vòm mây cao nhất, tính cả vòm to do trọng số so le */
const cloudBulge = (box: Box) => Math.min(box.w, box.h) * 0.42 * 0.32 * 1.3;

/** Chân đuôi không rộng quá phần này của cạnh ngắn hộp — hộp nhỏ thì đuôi thon theo */
const TAIL_MAX = 0.5;

/** Thân `oval` phình ra khỏi `box` chừng này để góc chữ trong hộp vẫn lọt */
const OVAL = 1.2;

/** Khung ngoài của thân: `box` là chỗ của ruột, `oval` và `cloud` phình ra ngoài nó */
function hull(box: Box, shape: Shape): Box {
  if (shape === "oval") return { ...box, w: box.w * OVAL, h: box.h * OVAL };
  if (shape === "cloud") {
    const g = 2 * cloudBulge(box);
    return { ...box, w: box.w + g, h: box.h + g };
  }
  return box;
}

/** Mây: vòm cung nối các điểm trên một siêu elip qua bốn cạnh hộp, vòm to nhỏ đối xứng trái phải */
function cloudPath(box: Box) {
  const chord = Math.min(box.w, box.h) * 0.42;
  const a = box.w / 2;
  const b = box.h / 2;
  const pw = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / 4);
  const M = 240;
  const pts: Pt[] = [];
  const acc = [0];
  for (let i = 0; i <= M; i++) {
    const th = (i / M) * 2 * Math.PI + Math.PI / 2;
    pts.push({ x: box.dx + a * pw(Math.cos(th)), y: box.dy + b * pw(Math.sin(th)) });
    if (i) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const n = Math.max(6, Math.round(acc[M] / chord));
  // Đi từ đáy giữa theo chiều kim đồng hồ: vòm `i` và `n − 1 − i` là cặp đối xứng
  const wt = Array.from(
    { length: n },
    (_, i) => 1 + 0.3 * Math.sin(Math.min(i, n - 1 - i) * 2.7 + 1),
  );
  const sum = wt.reduce((x, y) => x + y, 0);
  const at = (d: number) => {
    let j = acc.findIndex((v) => v >= d);
    if (j <= 0) j = 1;
    const u = (d - acc[j - 1]) / (acc[j] - acc[j - 1] || 1);
    return {
      x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * u,
      y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * u,
    };
  };
  const f = (v: number) => v.toFixed(1);
  let d = 0;
  let prev = at(0);
  let path = `M${f(prev.x)} ${f(prev.y)}`;
  for (let i = 0; i < n; i++) {
    d += (wt[i] / sum) * acc[M];
    const p = i === n - 1 ? at(0) : at(d);
    const r = Math.hypot(p.x - prev.x, p.y - prev.y) * 0.55;
    path += ` A${f(r)} ${f(r)} 0 0 1 ${f(p.x)} ${f(p.y)}`;
    prev = p;
  }
  return path + "Z";
}

/** Viền răng cưa một đường kín quanh tâm hộp; răng gần mũi nhất kéo dài tới mũi làm đuôi */
function shoutPath(box: Box, spikes: number) {
  const n = spikes * 2;
  const rx = box.w / 2;
  const ry = box.h / 2;
  const outside = (box.dx / rx) ** 2 + (box.dy / ry) ** 2 > 1;
  const aim = Math.atan2(-box.dy / ry, -box.dx / rx);
  const tip = outside ? ((Math.round((aim / (2 * Math.PI)) * n) % n) + n) % n : -1;
  const p: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const k = i % 2 ? 0.74 + 0.05 * Math.sin(i * 2.3) : 1 + 0.06 * Math.sin(i * 1.7);
    const x = i === tip ? 0 : box.dx + rx * k * Math.cos(a);
    const y = i === tip ? 0 : box.dy + ry * k * Math.sin(a);
    p.push(`${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return p.join(" ") + "Z";
}

/** Ký tự chửi: ô `i` lượt `b`, băm để hai lượt liền nhau và hai ô cạnh nhau đều khác mặt */
function Grawlix({
  g,
  t,
  open,
  fill,
  font,
}: {
  g: GrawlixData;
  t: number;
  open: number;
  fill: string;
  font: string;
}) {
  const chars = Array.from(g.chars);
  const b = Math.floor(Math.max(0, t - open) / g.every);
  const raw = (i: number, k: number) =>
    Math.floor(hash(i * 17 + k * 131 + 0.5, 39.346) * chars.length);
  const faces: number[] = [];
  for (let i = 0; i < g.count; i++) {
    let c = raw(i, b);
    if (c === raw(i, b - 1)) c = (c + 1) % chars.length;
    if (c === faces[i - 1]) c = (c + 1) % chars.length;
    faces.push(c);
  }
  return (
    <g fontFamily={font} fontWeight={900} fontSize={g.size} textAnchor="middle" fill={fill}>
      {faces.map((c, i) => {
        const x = (i - (g.count - 1) / 2) * g.gap;
        const dy = (hash(i * 7 + b * 13, 51.77) - 0.5) * 0.25 * g.size;
        const deg = (hash(i * 11 + b * 5, 63.19) - 0.5) * 18;
        return (
          <g
            key={i}
            transform={`translate(${x.toFixed(1)} ${(g.size * 0.35 + dy).toFixed(1)}) rotate(${deg.toFixed(1)})`}
          >
            <text>{chars[c]}</text>
          </g>
        );
      })}
    </g>
  );
}

export interface BubbleProps {
  /** Giây scene */
  t: number;
  open: number;
  shut: number;
  /** Mũi đuôi, toạ độ scene: bong bóng bật ra, co lại và chia zoom quanh điểm này */
  tip: Pt;
  /** Tâm hộp tính từ mũi và cỡ hộp, đơn vị scene ở zoom 1 */
  box: Box;
  style?: BubbleData["style"];
  shape?: BubbleData["shape"];
  grow?: number;
  fade?: number;
  r?: number;
  tail?: number;
  curl?: number;
  dots?: number;
  spikes?: number;
  grawlix?: GrawlixData;
  font?: string;
  fill?: string;
  line?: string;
  width?: number;
  /** `cam.zoom`; cả bong bóng chia cho nó */
  zoom?: number;
  /** Ruột, gốc ở tâm hộp — thường là các `<Pop>` */
  children?: ReactNode;
}

/**
 * Khung bong bóng thoại: thân, đuôi, mở và tan. Lớp vẽ code nhét icon vẽ code vào
 * `children`; mục `bubble` của `scene.fx` vẽ bằng chính component này. docs/09-hieu-ung.md
 */
export function Bubble({
  t,
  open,
  shut,
  tip,
  box,
  style = "speech",
  shape = style === "thought" ? "cloud" : "round",
  grow = style === "shout" ? 0.22 : 0.3,
  fade = style === "shout" ? 0.2 : 0.25,
  r = BUBBLE.r,
  tail = BUBBLE.tail,
  curl = BUBBLE.curl,
  dots = BUBBLE.dots,
  spikes = BUBBLE.spikes,
  grawlix,
  font = BUBBLE.font,
  fill = BUBBLE.fill,
  line = BUBBLE.line,
  width = BUBBLE.width,
  zoom = 1,
  children,
}: BubbleProps) {
  const shout = style === "shout";
  // Phập phồng quanh mũi đuôi nên mũi không rời khỏi người nói
  const s = bubbleScale(t, open, shut, grow, fade) * (shout ? 1 + 0.035 * Math.sin(t * 23) : 1);
  if (s <= 0) return null;
  const jx = shout ? (2.6 * Math.sin(t * 41)) / zoom : 0;
  const jy = shout ? (2.2 * Math.cos(t * 33)) / zoom : 0;
  const rr = Math.min(r, box.w / 2, box.h / 2);
  let body: ReactNode;
  if (shout) body = <path d={shoutPath(box, spikes)} />;
  else if (shape === "oval")
    body = <ellipse cx={box.dx} cy={box.dy} rx={(box.w / 2) * OVAL} ry={(box.h / 2) * OVAL} />;
  else if (shape === "cloud") body = <path d={cloudPath(box)} />;
  else
    body = (
      <rect x={box.dx - box.w / 2} y={box.dy - box.h / 2} width={box.w} height={box.h} rx={rr} />
    );
  const out = hull(box, shape);
  const half = Math.min(tail, TAIL_MAX * Math.min(box.w, box.h)) / 2;
  const root = shout ? null : tailRoot(out, shape, rr, half);
  let limb: ReactNode = null;
  if (root && style === "thought") {
    const vx = Math.abs(root.x - out.dx) / (out.w / 2);
    const vy = Math.abs(root.y - out.dy) / (out.h / 2);
    const e = 1 / Math.max(vx, vy);
    const end = { x: out.dx + (root.x - out.dx) * e, y: out.dy + (root.y - out.dy) * e };
    const len = Math.hypot(end.x, end.y);
    const ux = end.x / len;
    const uy = end.y / len;
    const big = Math.min(box.w, box.h) * 0.1;
    // Bọt dẹt nằm ngang; `reach` là nửa bề dài của bọt đo dọc tia từ thân tới mũi, cộng nét
    const reach = (ry: number) => Math.hypot(1.6 * ry * ux, ry * uy) + width;
    let ry = Array.from({ length: dots }, (_, i) => big * 0.62 ** i);
    const span = (rs: number[]) => rs.reduce((x, r0) => x + 2 * reach(r0), 0);
    // Chật thì bớt bọt nhỏ nhất, không bóp cả chuỗi; còn một bọt vẫn chật mới thu nó lại
    while (ry.length > 1 && len - span(ry) < ry.length * big * 0.6) ry = ry.slice(0, -1);
    if (ry.length && len - span(ry) < big * 0.6) ry = [(ry[0] * (len - big * 0.6)) / span(ry)];
    const gap = Math.min(big * 1.1, (len - span(ry)) / Math.max(1, ry.length));
    let d = len;
    limb = ry.map((r0, i) => {
      d -= gap + reach(r0);
      const c = <ellipse key={i} cx={ux * d} cy={uy * d} rx={1.6 * r0} ry={r0} />;
      d -= reach(r0);
      return c;
    });
  } else if (root && tail > 0) limb = <path d={tailPath(root, half, curl, box)} />;
  // Thân và đuôi vẽ hai lượt: nét dày gấp đôi, ruột phủ lên — viền đi quanh hợp của chúng, không vạch ở chân đuôi
  const frame = (
    <>
      {body}
      {limb}
    </>
  );
  return (
    <g transform={`translate(${tip.x + jx} ${tip.y + jy}) scale(${s / zoom})`}>
      {width > 0 && (
        <g fill={line} stroke={line} strokeWidth={width * 2} strokeLinejoin="round">
          {frame}
        </g>
      )}
      <g fill={fill}>{frame}</g>
      <g transform={`translate(${box.dx} ${box.dy})`}>
        {grawlix && <Grawlix g={grawlix} t={t} open={open} fill={line} font={font} />}
        {children}
      </g>
    </g>
  );
}

function Item({
  m,
  t,
  open,
  url,
  fx,
}: {
  m: BubbleItemData;
  t: number;
  open: number;
  url?: string;
  fx: BubbleData;
}) {
  let body: ReactNode = null;
  if (m.piece) {
    if (!url || !m.w || !m.h) return null;
    body = (
      <g transform={m.deg ? `rotate(${m.deg})` : undefined}>
        <Piece url={url} w={m.w} h={m.h} />
      </g>
    );
  } else if (m.text) {
    const lines = m.text.split("\n");
    const gap = m.size * 1.15;
    body = (
      <g
        fontFamily={fx.font}
        fontWeight={900}
        fontSize={m.size}
        textAnchor="middle"
        fill={m.fill ?? fx.line}
        transform={m.deg ? `rotate(${m.deg})` : undefined}
      >
        {lines.map((l, i) => (
          <text key={i} y={(i - (lines.length - 1) / 2) * gap + m.size * 0.36}>
            {l}
          </text>
        ))}
      </g>
    );
  }
  return (
    <Pop t={t} at={m.at ?? open} until={m.until} x={m.x} y={m.y}>
      {body}
    </Pop>
  );
}

/** Mục `bubble` của `scene.fx`: mũi đuôi toạ độ cứng hay bám mốc qua `anchor`, ruột là ảnh và chữ */
export function BubbleFx({
  fx,
  t,
  zoom = 1,
  urls = {},
  anchor,
}: {
  fx: BubbleData;
  t: number;
  zoom?: number;
  urls?: Record<string, string | undefined>;
  anchor?: FxAnchor;
}) {
  if (t < fx.open || t > fx.shut) return null;
  let tip: Pt | undefined = fx.tip;
  if (fx.cast) {
    const a = anchor?.(fx.cast, fx.anchor, fx.follow ? t : fx.open);
    if (!a) return null;
    tip = { x: a.x + a.scale * fx.dx, y: a.y + a.scale * fx.dy };
  }
  if (!tip) return null;
  return (
    <Bubble {...fx} t={t} tip={tip} zoom={zoom}>
      {fx.items.map((m, i) => (
        <Item
          key={i}
          m={m}
          t={t}
          open={fx.open}
          url={m.piece ? urls[m.piece] : undefined}
          fx={fx}
        />
      ))}
    </Bubble>
  );
}
