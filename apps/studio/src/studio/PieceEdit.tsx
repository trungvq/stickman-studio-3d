import { Button } from "@/components/ui/button";
import {
  wornPiece,
  wornTune,
  type CharacterData,
  type Equip,
  type PieceKey,
  type ViewTune,
  type Views,
} from "@stickman3d/sketch";
import { Images, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { Mutate } from "./Panel";
import { HIDDEN_PIECES, PIECE_LABELS, PIECE_SCALE, PIECE_SHIFT, PIECE_WIDTH } from "./pieces";
/** Bấm lại trong bấy nhiêu px và ms thì lật xuống mảnh nằm dưới */
const AGAIN = { px: 8, ms: 900 };

type PieceData = CharacterData["pieces"][PieceKey];
type Pt = [number, number];
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Tag {
  k: PieceKey;
  el: SVGGraphicsElement;
  box: Box;
  /** Góc SVG đã xoay quanh tâm hộp *bên trong* nhóm; hộp trong `box` chưa xoay */
  spin: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const norm = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

const readTag = (el: SVGGraphicsElement): Tag | null => {
  const k = el.dataset.piece as PieceKey | undefined;
  const nums = (el.dataset.box ?? "").split(" ").map(Number);
  if (!k || nums.length !== 4 || nums.some(Number.isNaN)) return null;
  const [x, y, w, h] = nums as [number, number, number, number];
  return { k, el, box: { x, y, w, h }, spin: Number(el.dataset.spin ?? 0) };
};

/** Nhóm mang hộp chỉnh của socket `k`: kiểu tóc gắn cả lớp `under` vào `hair`, lớp trên vẽ sau cùng */
const tagged = (root: ParentNode, k: string) =>
  [...root.querySelectorAll<SVGGraphicsElement>(`[data-piece="${k}"]`)].at(-1) ?? null;

/** Mọi mảnh nằm dưới một điểm màn hình, trên xuống dưới */
const stackAt = (x: number, y: number, root: SVGSVGElement) => {
  const out: SVGGraphicsElement[] = [];
  for (const hit of document.elementsFromPoint(x, y)) {
    const own = hit.closest("[data-piece]") as SVGGraphicsElement | null;
    const g = own && tagged(root, own.dataset.piece ?? "");
    if (!g || !root.contains(g) || out.includes(g)) continue;
    if (!HIDDEN_PIECES.includes(g.dataset.piece as PieceKey)) out.push(g);
  }
  return out;
};

const center = (b: Box): Pt => [b.x + b.w / 2, b.y + b.h / 2];

/** Bốn góc hộp sau khi xoay `spin` quanh tâm, trong hệ của nhóm mảnh */
const quadOf = (b: Box, spin: number): Pt[] => {
  const [cx, cy] = center(b);
  const a = (spin * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const raw: Pt[] = [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x + b.w, b.y + b.h],
    [b.x, b.y + b.h],
  ];
  return raw.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  });
};

/** Đưa một điểm về hộp chưa xoay, để tính co kéo bằng số axis-aligned */
const unspin = (p: DOMPoint, b: Box, spin: number): Pt => {
  const [cx, cy] = center(b);
  const a = (-spin * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
};

type Kind = "move" | "corner" | "side" | "rotate";
interface Drag {
  kind: Kind;
  /** Socket ghi vào — tay xa dùng chung thì ghi vào tay gần */
  k: PieceKey;
  /** Màn hình → hệ của nhóm mảnh, chốt lúc bắt đầu kéo */
  inv: DOMMatrix;
  box: Box;
  spin: number;
  start: ViewTune;
  p0: DOMPoint;
  /** Điểm bấm trên màn hình, để phân biệt bấm chọn với kéo thật */
  c0: Pt;
  moved: boolean;
  /** Góc 0–3 theo chiều kim đồng hồ từ trên trái, hoặc −1/+1 cho cạnh trái/phải */
  at: number;
}

/** Khung chọn tính lại mỗi frame: mảnh vẫn động khi hành động đang chạy */
interface Quad {
  k: PieceKey;
  pts: Pt[];
  /** Tay nắm xoay, đã đẩy ra ngoài cạnh trên */
  grip: Pt;
  /** Bề ngang sân khấu, để thanh nút không tràn ra ngoài mép */
  hostW: number;
  /** Mảnh không có hộp để kéo — tóc dựng khối chỉnh bằng thanh trượt */
  fixed: boolean;
}

const same = (a: Quad | null, b: Quad | null) => {
  if (!a || !b) return a === b;
  if (a.k !== b.k || a.fixed !== b.fixed) return false;
  return a.pts.every((p, i) => Math.abs(p[0] - b.pts[i][0]) + Math.abs(p[1] - b.pts[i][1]) < 0.25);
};

interface Opts {
  svg: RefObject<SVGSVGElement | null>;
  host: RefObject<HTMLDivElement | null>;
  character: CharacterData;
  /** Đang mặc gì: kéo mảnh trên sân khấu phải ghi vào đúng vật đang hiện, không phải mảnh nền */
  equip: Equip;
  /** Góc đang xem: hình riêng của góc ấy có bộ chỉnh riêng, kéo phải ghi vào đó */
  views: Views;
  mutate: Mutate;
  selected: PieceKey | null;
  onSelect: (k: PieceKey | null) => void;
  onPick: (k: PieceKey) => void;
  onClear: (k: PieceKey) => void;
  onReset: (k: PieceKey) => void;
  /** Ghim frame lại trước khi kéo, không thì mảnh trôi dưới tay */
  onGesture: () => void;
}

/**
 * Chỉnh mảnh thẳng trên sân khấu. Hộp và hệ toạ độ đọc từ `data-box` /
 * `data-spin` mà rig gắn lên DOM, nên không có công thức hình học nào ở đây.
 */
export function usePieceEdit(o: Opts) {
  const [quad, setQuad] = useState<Quad | null>(null);
  const [undos, setUndos] = useState(0);
  const drag = useRef<Drag | null>(null);
  const tap = useRef<{ x: number; y: number; t: number } | null>(null);
  const past = useRef<{ k: PieceKey; before: PieceData }[]>([]);
  const live = useRef(o);
  useEffect(() => {
    live.current = o;
  });

  const write = useCallback(
    (k: PieceKey, fn: (pc: ViewTune) => void) =>
      live.current.mutate((d) => fn(wornTune(d, live.current.equip, k, live.current.views, true))),
    [],
  );

  /** Mảnh đang hiện ở socket, đọc từ nhân vật mới nhất */
  const read = (k: PieceKey) => wornPiece(live.current.character, live.current.equip, k);
  /** Tóc dựng khối không có hộp để kéo: chỉnh bằng thanh trượt ở cột Người */
  const fixed = useCallback(
    (k: PieceKey) => wornPiece(live.current.character, live.current.equip, k).src === "sculpt",
    [],
  );

  /** Tay xa dùng chung thông số với tay gần: hộp vẽ theo tay gần nên ghi cũng vào đó */
  const targetOf = useCallback(
    (k: PieceKey) =>
      k === "sleeveFar" && live.current.character.sleeveFit.syncFar ? "sleeveNear" : k,
    [],
  );

  const remember = useCallback((k: PieceKey) => {
    past.current.push({ k, before: structuredClone(read(k)) });
    if (past.current.length > 40) past.current.shift();
    setUndos(past.current.length);
  }, []);

  const undo = useCallback(() => {
    const last = past.current.pop();
    setUndos(past.current.length);
    if (last)
      live.current.mutate((d) => {
        const pc = wornPiece(d, live.current.equip, last.k);
        delete pc.views;
        Object.assign(pc, last.before);
      });
  }, []);

  const begin = useCallback(
    (kind: Kind, t: Tag, e: { clientX: number; clientY: number }, at = 0) => {
      const m = t.el.getScreenCTM();
      const k = targetOf(t.k);
      if (!m || fixed(k)) return;
      const inv = m.inverse();
      drag.current = {
        kind,
        k,
        inv,
        box: t.box,
        spin: t.spin,
        start: structuredClone(
          wornTune(live.current.character, live.current.equip, k, live.current.views),
        ),
        p0: new DOMPoint(e.clientX, e.clientY).matrixTransform(inv),
        c0: [e.clientX, e.clientY],
        moved: false,
        at,
      };
    },
    [targetOf, fixed],
  );

  /** Bấm xuống sân khấu: trúng mảnh thì chọn và kéo luôn, trả `true` để khỏi pan */
  const pick = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return false;
      // Nút zoom và thanh nút của mảnh nằm chồng lên sân khấu, bấm vào đó không phải là chọn mảnh
      if ((e.target as Element).closest("button, [data-nopick]")) return false;
      const root = live.current.svg.current;
      if (!root) return false;
      const stack = stackAt(e.clientX, e.clientY, root);
      if (!stack.length) {
        live.current.onSelect(null);
        return false;
      }
      // Mảnh đang chọn còn nằm dưới con trỏ thì kéo chính nó, không nhảy lên mảnh trên cùng
      const cur = stack.findIndex((el) => el.dataset.piece === live.current.selected);
      const t = readTag(stack[e.altKey ? (cur + 1) % stack.length : Math.max(cur, 0)]);
      if (!t) return false;
      live.current.onSelect(t.k);
      begin("move", t, e);
      return true;
    },
    [begin],
  );

  const onHandle = useCallback(
    (kind: Kind, at: number) => (e: ReactPointerEvent) => {
      e.stopPropagation();
      const root = live.current.svg.current;
      const k = live.current.selected;
      if (!root || !k) return;
      const el = tagged(root, k);
      const t = el && readTag(el);
      if (t) begin(kind, t, e, at);
    },
    [begin],
  );

  // Kéo bám cả khi con trỏ ra ngoài sân khấu
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.c0[0], e.clientY - d.c0[1]) < 3) return;
        d.moved = true;
        live.current.onGesture();
        remember(d.k);
      }
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(d.inv);
      const s = d.start;
      // Tầm kéo nới theo giá trị đang có, cùng luật với ô số của SliderRow
      const shift = Math.max(PIECE_SHIFT, Math.abs(s.dx), Math.abs(s.dy));
      if (d.kind === "move") {
        write(d.k, (pc) => {
          pc.dx = r1(clamp(s.dx + p.x - d.p0.x, -shift, shift));
          pc.dy = r1(clamp(s.dy + p.y - d.p0.y, -shift, shift));
        });
        return;
      }
      if (d.kind === "rotate") {
        const [cx, cy] = center(d.box);
        const turn =
          (Math.atan2(p.y - cy, p.x - cx) - Math.atan2(d.p0.y - cy, d.p0.x - cx)) * (180 / Math.PI);
        // Góc rig ngược dấu với rotate() của SVG
        const deg = s.rotate - turn;
        write(d.k, (pc) => (pc.rotate = r1(norm(e.shiftKey ? Math.round(deg / 15) * 15 : deg))));
        return;
      }
      const b = d.box;
      const [qx, qy] = unspin(p, b, d.spin);
      const baseCx = b.x + b.w / 2 - s.dx;
      const baseTop = b.y - s.dy;
      if (d.kind === "side") {
        const fx = d.at < 0 ? b.x + b.w : b.x;
        const ws = clamp(
          (s.widthScale * Math.abs(qx - fx)) / b.w,
          PIECE_WIDTH.min,
          Math.max(PIECE_WIDTH.max, s.widthScale),
        );
        const w = (b.w * ws) / s.widthScale;
        const left = d.at < 0 ? fx - w : fx;
        write(d.k, (pc) => {
          pc.widthScale = r1(ws);
          pc.dx = r1(clamp(left + w / 2 - baseCx, -shift, shift));
        });
        return;
      }
      // Góc: giữ nguyên góc đối diện, tỉ lệ đo bằng hình chiếu lên đường chéo
      const pts = quadOf(b, 0);
      const f = pts[(d.at + 2) % 4];
      const dxD = pts[d.at][0] - f[0];
      const dyD = pts[d.at][1] - f[1];
      const proj = ((qx - f[0]) * dxD + (qy - f[1]) * dyD) / (dxD * dxD + dyD * dyD);
      const scale = clamp(
        s.scale * Math.max(0.05, proj),
        PIECE_SCALE.min,
        Math.max(PIECE_SCALE.max, s.scale),
      );
      const w = (b.w * scale) / s.scale;
      const h = (b.h * scale) / s.scale;
      const left = d.at === 0 || d.at === 3 ? f[0] - w : f[0];
      const top = d.at === 0 || d.at === 1 ? f[1] - h : f[1];
      write(d.k, (pc) => {
        pc.scale = r1(scale * 100) / 100;
        pc.dx = r1(clamp(left + w / 2 - baseCx, -shift, shift));
        pc.dy = r1(clamp(top - baseTop, -shift, shift));
      });
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.moved) return;
      const now = Date.now();
      const last = tap.current;
      tap.current = { x: e.clientX, y: e.clientY, t: now };
      const root = live.current.svg.current;
      if (!root || !last) return;
      if (now - last.t > AGAIN.ms || Math.hypot(e.clientX - last.x, e.clientY - last.y) > AGAIN.px)
        return;
      // Bấm lại đúng chỗ cũ: lật xuống mảnh nằm dưới
      const stack = stackAt(e.clientX, e.clientY, root);
      const i = stack.findIndex((el) => el.dataset.piece === live.current.selected);
      const next = stack.length > 1 && readTag(stack[(i + 1) % stack.length]);
      if (next) live.current.onSelect(next.k);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [write, remember]);

  // Khung chọn đọc lại từ DOM mỗi frame; mảnh đang ẩn thì không có nhóm nào để đo
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const { svg, host: box, selected } = live.current;
      const root = svg.current;
      const host = box.current;
      if (!selected) return setQuad(null);
      const el = root && tagged(root, selected);
      const t = el && readTag(el);
      const m = t && t.el.getScreenCTM();
      if (!t || !m || !host) return setQuad(null);
      const r = host.getBoundingClientRect();
      const at = ([x, y]: Pt): Pt => {
        const p = new DOMPoint(x, y).matrixTransform(m);
        return [p.x - r.left, p.y - r.top];
      };
      const pts = quadOf(t.box, t.spin).map(at);
      const mid: Pt = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
      const cen: Pt = [(pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2];
      const len = Math.hypot(mid[0] - cen[0], mid[1] - cen[1]) || 1;
      const grip: Pt = [
        mid[0] + ((mid[0] - cen[0]) / len) * 24,
        mid[1] + ((mid[1] - cen[1]) / len) * 24,
      ];
      const next: Quad = {
        k: t.k,
        pts,
        grip,
        hostW: r.width,
        fixed: fixed(t.k),
      };
      setQuad((prev) => (same(prev, next) ? prev : next));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetOf, fixed]);

  // Phím tắt: chỉ khi đang chọn một mảnh và không đứng trong ô nhập hay thanh trượt
  useEffect(() => {
    const k = o.selected;
    if (!k) return;
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el?.closest(
          "input, textarea, select, [contenteditable=true], [role=slider], [role=combobox]",
        )
      )
        return;
      const t = targetOf(k);
      if (e.key === "Escape") return live.current.onSelect(null);
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        return live.current.onClear(k);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        return undo();
      }
      const step = e.shiftKey ? 10 : 1;
      const nudge: Record<string, Pt> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const n = nudge[e.key];
      if (!n || fixed(t)) return;
      e.preventDefault();
      remember(t);
      write(t, (pc) => {
        pc.dx = r1(pc.dx + n[0]);
        pc.dy = r1(pc.dy + n[1]);
      });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [o.selected, targetOf, fixed, remember, undo, write]);

  const handle = (p: Pt, kind: Kind, at: number, cursor: string) => (
    <circle
      key={`${kind}${at}`}
      cx={p[0]}
      cy={p[1]}
      r={7}
      className="pointer-events-auto fill-background stroke-sky-500"
      strokeWidth={2}
      style={{ cursor }}
      data-handle={kind}
      onPointerDown={onHandle(kind, at)}
    />
  );

  const draw = (q: Quad) => {
    const side = (i: number, j: number): Pt => [
      (q.pts[i][0] + q.pts[j][0]) / 2,
      (q.pts[i][1] + q.pts[j][1]) / 2,
    ];
    return (
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <polygon
          points={q.pts.map((p) => p.join(",")).join(" ")}
          className="fill-sky-400/10 stroke-sky-500"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        {!q.fixed && (
          <>
            <line
              x1={side(0, 1)[0]}
              y1={side(0, 1)[1]}
              x2={q.grip[0]}
              y2={q.grip[1]}
              className="stroke-sky-500"
              strokeWidth={1.5}
            />
            {handle(q.grip, "rotate", 0, "grab")}
            {q.pts.map((p, i) => handle(p, "corner", i, i % 2 ? "nesw-resize" : "nwse-resize"))}
            {handle(side(3, 0), "side", -1, "ew-resize")}
            {handle(side(1, 2), "side", 1, "ew-resize")}
          </>
        )}
      </svg>
    );
  };

  const overlay = quad && (
    <>
      {draw(quad)}
      <PieceBar
        k={quad.k}
        at={quad.pts}
        hostW={quad.hostW}
        undos={undos}
        fixed={quad.fixed}
        onPick={o.onPick}
        onReset={o.onReset}
        onClear={o.onClear}
        onSelect={o.onSelect}
        onUndo={undo}
      />
    </>
  );

  return { pick, overlay };
}

function PieceBar({
  k,
  at,
  hostW,
  undos,
  fixed,
  onPick,
  onReset,
  onClear,
  onSelect,
  onUndo,
}: {
  k: PieceKey;
  at: Pt[];
  hostW: number;
  undos: number;
  fixed: boolean;
  onPick: (k: PieceKey) => void;
  onReset: (k: PieceKey) => void;
  onClear: (k: PieceKey) => void;
  onSelect: (k: PieceKey | null) => void;
  onUndo: () => void;
}) {
  const left = Math.max(2, Math.min(...at.map((p) => p[0])));
  // Tay nắm xoay nhô 24px trên cạnh trên, thanh nút phải đứng trên nó
  const above = Math.min(...at.map((p) => p[1])) - 66;
  const top = above < 2 ? Math.max(...at.map((p) => p[1])) + 10 : above;
  return (
    <div
      data-nopick
      className="absolute z-10 flex items-center gap-0.5 rounded border bg-card/95 p-1 shadow-md"
      // `100%` trong translate là bề ngang của chính thanh nút, khỏi phải đo
      style={{ left, top, translate: `min(0px, calc(${hostW - left - 4}px - 100%)) 0` }}
    >
      <span className="px-1 text-xs font-medium whitespace-nowrap">{PIECE_LABELS[k]}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        title="Đổi mảnh"
        onClick={() => onPick(k)}
      >
        <Images />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        title="Hoàn tác (Ctrl+Z)"
        disabled={!undos}
        onClick={onUndo}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        title={fixed ? "Về bộ số mặc định của tóc dựng khối" : "Về căn mặc định của kiểu này"}
        onClick={() => onReset(k)}
      >
        <RotateCcw />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        title="Bỏ mảnh (Delete)"
        onClick={() => onClear(k)}
      >
        <Trash2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        title="Bỏ chọn (Esc)"
        onClick={() => onSelect(null)}
      >
        <X />
      </Button>
    </div>
  );
}
