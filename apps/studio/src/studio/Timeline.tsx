import {
  actionDelta,
  actionKind,
  animalActionDelta,
  type ActionData,
  type AnimalData,
} from "@stickman3d/sketch";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Play, Plus, Trash2 } from "lucide-react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { MutateAction } from "./ActionPanel";
import { reachAt } from "./solo";
import type { ViewState } from "./view";

/** Khoảng cách tối thiểu giữa hai mốc; schema bắt `t` tăng dần */
const GAP = 0.02;
/** Lề hai đầu dải, đủ chỗ cho nửa chấm mốc; mọi công thức vị trí phải dùng chung */
const PAD = 12;
const TICKS = [0, 0.25, 0.5, 0.75, 1];
const round = (t: number) => +t.toFixed(3);
const at = (t: number) => `calc(${PAD}px + ${t} * (100% - ${2 * PAD}px))`;

interface TimelineProps {
  action: ActionData;
  /** Con vật đang diễn, để mốc mới của hành động động vật lấy đúng tư thế đang hiện */
  animal?: AnimalData | null;
  mutate: MutateAction;
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
  sel: number;
  setSel: (i: number) => void;
  /** Mở modal xem cả dải mốc thành hình */
  onShowKeys: () => void;
}

export function Timeline({
  action,
  animal = null,
  mutate,
  view,
  setView,
  sel,
  setSel,
  onShowKeys,
}: TimelineProps) {
  const keys = action.keys;
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  const rect = () => track.current!.getBoundingClientRect();
  const posAt = (clientX: number) => {
    const r = rect();
    return Math.min(1, Math.max(0, (clientX - r.left - PAD) / (r.width - 2 * PAD)));
  };

  const moveKey = (i: number, t: number) => {
    const lo = i > 0 ? keys![i - 1].t + GAP : 0;
    const hi = i < keys!.length - 1 ? keys![i + 1].t - GAP : 1;
    const to = round(Math.min(hi, Math.max(lo, t)));
    mutate((d) => (d.keys![i].t = to));
    setView({ scrub: to });
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = posAt(e.clientX);
    const w = rect().width;
    let hit = -1;
    keys?.forEach((k, i) => {
      if (Math.abs(k.t - t) * w < 12 && (hit < 0 || Math.abs(k.t - t) < Math.abs(keys[hit].t - t)))
        hit = i;
    });
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = hit < 0 ? null : hit;
    if (hit < 0) setView({ scrub: round(t) });
    else {
      setSel(hit);
      setView({ scrub: keys![hit].t });
    }
  };

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    const t = posAt(e.clientX);
    if (dragging.current !== null) moveKey(dragging.current, t);
    else setView({ scrub: round(t) });
  };

  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Mốc mới lấy đúng tư thế đang hiện ở chỗ đó, thêm vào không đổi chuyển động
  const addKey = () => {
    const t = round(view.scrub ?? 0.5);
    if (!keys || keys.some((k) => Math.abs(k.t - t) < GAP)) return;
    const human = actionKind(action) !== "animal";
    const delta = human ? actionDelta(action, t) : undefined;
    const pose = delta ?? (animal ? animalActionDelta(action, t, animal) : {});
    const reach = delta && reachAt(action, t, delta);
    const i = keys.filter((k) => k.t < t).length;
    mutate((d) => d.keys!.splice(i, 0, { t, pose, ...(reach && { reach }), ease: "linear" }));
    setSel(i);
  };

  const dropKey = () => {
    if (!keys || keys.length < 2) return;
    mutate((d) => d.keys!.splice(sel, 1));
    setSel(Math.max(0, sel - 1));
  };

  const running = view.scrub === null;

  return (
    <div className="mt-2 w-full max-w-[560px] shrink-0 sm:mt-3">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium">Dải thời gian — một chu kỳ {action.duration}s</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {running ? "đang chạy" : `t = ${view.scrub!.toFixed(2)}`}
        </span>
      </div>

      <div
        ref={track}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        className="relative h-12 cursor-ew-resize touch-none rounded-md border bg-muted/40 select-none"
      >
        {TICKS.map((t) => (
          <div key={t} className="absolute" style={{ left: at(t) }}>
            <div className="h-2.5 w-px -translate-x-1/2 bg-border" />
            <span className="absolute top-[34px] -translate-x-1/2 font-mono text-[10px] text-muted-foreground tabular-nums">
              {t}
            </span>
          </div>
        ))}

        <div className="absolute inset-x-3 top-5 h-px bg-border" />

        {!running && (
          <div
            className="absolute top-0 bottom-5 w-0.5 -translate-x-1/2 bg-amber-300"
            style={{ left: at(view.scrub!) }}
          >
            <div className="absolute -top-px left-1/2 size-2 -translate-x-1/2 rotate-45 bg-amber-300" />
          </div>
        )}

        {keys?.map((k, i) => (
          <div
            key={i}
            className={
              "absolute top-5 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 " +
              (i === sel
                ? "border-amber-100 bg-amber-300 ring-2 ring-amber-300/40"
                : "border-foreground/70 bg-background hover:border-foreground")
            }
            style={{ left: at(k.t) }}
          />
        ))}

        {!keys && (
          <span className="absolute inset-x-0 top-3.5 text-center text-xs text-muted-foreground">
            hành động bộ sinh — không có mốc để kéo
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={running}
          title="Bỏ ghim, cho chạy tiếp"
          onClick={() => setView({ scrub: null })}
        >
          <Play /> Chạy tiếp
        </Button>
        <Button size="sm" variant="outline" title="Xem cả dải mốc thành hình" onClick={onShowKeys}>
          <LayoutGrid /> Xem mốc
        </Button>
        {keys && (
          <>
            <Button size="sm" variant="outline" title="Thêm mốc ở vạch vàng" onClick={addKey}>
              <Plus /> Thêm mốc
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Xoá mốc đang chọn"
              disabled={keys.length < 2}
              onClick={dropKey}
            >
              <Trash2 /> Xoá mốc
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              mốc {sel + 1}/{keys.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
