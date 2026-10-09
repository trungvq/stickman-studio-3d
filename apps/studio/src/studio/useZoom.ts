import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const MIN = 1;
const MAX = 8;

export interface ZoomState {
  z: number;
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Phóng to / kéo sân khấu: cuộn chuột, chụm hai ngón, kéo một ngón */
export function useZoom() {
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomState>({ z: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ gap: number; x: number; y: number } | null>(null);

  const local = useCallback((e: { clientX: number; clientY: number }) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  }, []);

  const settle = useCallback((v: ZoomState): ZoomState => {
    const r = box.current?.getBoundingClientRect();
    const mx = r ? (r.width * (v.z - 1)) / 2 : 0;
    const my = r ? (r.height * (v.z - 1)) / 2 : 0;
    return { z: v.z, x: clamp(v.x, -mx, mx), y: clamp(v.y, -my, my) };
  }, []);

  /** Nhân tỉ lệ quanh điểm `(fx, fy)` so với tâm khung, kèm một bước dịch */
  const scaleAt = useCallback(
    (factor: number, fx: number, fy: number, dx = 0, dy = 0) =>
      setZoom((v) => {
        const z = clamp(v.z * factor, MIN, MAX);
        const k = z / v.z;
        return settle({ z, x: fx - (fx - v.x) * k + dx, y: fy - (fy - v.y) * k + dy });
      }),
    [settle],
  );

  const zoomBy = useCallback((factor: number) => scaleAt(factor, 0, 0), [scaleAt]);
  const reset = useCallback(() => setZoom({ z: 1, x: 0, y: 0 }), []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      scaleAt(Math.exp(-e.deltaY / 400), p.x, p.y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [local, scaleAt]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, local(e));
    pinch.current = null;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const prev = pts.current.get(e.pointerId);
    if (!prev) return;
    const cur = local(e);
    pts.current.set(e.pointerId, cur);
    const [a, b] = [...pts.current.values()];
    if (b) {
      const now = { gap: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const was = pinch.current;
      if (was && was.gap > 0)
        scaleAt(now.gap / was.gap, now.x, now.y, now.x - was.x, now.y - was.y);
      pinch.current = now;
    } else {
      setZoom((v) => settle({ ...v, x: v.x + cur.x - prev.x, y: v.y + cur.y - prev.y }));
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pts.current.delete(e.pointerId);
    pinch.current = null;
  };

  return {
    box,
    zoom,
    zoomBy,
    reset,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
