import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ActionData } from "@stickman3d/sketch";
import { memo, useCallback, useEffect, useState } from "react";
import { ActionFrame, phaseAt, useClock, type Subject } from "./Preview";
import type { ViewState } from "./view";

interface ActionPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tên file trong `actions/` của workspace đang mở */
  files: string[];
  /** File đang nạp, để đánh dấu ô đang chọn */
  value: string;
  /** Ai diễn thử trong ô: nhân vật hay con vật đang mở */
  subject: Subject;
  view: ViewState;
  /** Đọc và parse một file, `null` là file hỏng — ô đó hiện xám */
  readAction: (file: string) => Promise<ActionData | null>;
  /** Nạp file; trả lời lỗi thì modal ở lại để còn đọc được */
  onPick: (file: string) => Promise<string | null>;
}

/**
 * Lưới hành động, mỗi ô là chính nhân vật (hay con vật) đang mở ở mốc đầu; rê vào thì ô
 * đó chạy, bấm là nạp ngay. Chỉ một ô chạy một lúc — hai chục `<Character>` cùng động
 * thì bản dev tụt xuống 46fps, xem `phaseAt`.
 */
export function ActionPicker(p: ActionPickerProps) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent>
        <Grid {...p} />
      </DialogContent>
    </Dialog>
  );
}

// Tách ra để mỗi lần mở modal là bảng hành động đọc lại từ workspace đang mở
function Grid(p: ActionPickerProps) {
  const { files, readAction } = p;
  const [loaded, setLoaded] = useState<Record<string, ActionData | null>>({});
  /** Ô đang rê chuột / đang focus bằng bàn phím; chỉ nó chạy */
  const [playing, setPlaying] = useState<string | null>(null);
  const clock = useClock(playing !== null);

  useEffect(() => {
    let alive = true;
    for (const f of files)
      void readAction(f).then(
        (a) => alive && setLoaded((m) => (f in m ? m : { ...m, [f]: a })),
        () => alive && setLoaded((m) => (f in m ? m : { ...m, [f]: null })),
      );
    return () => {
      alive = false;
    };
  }, [files, readAction]);

  const [err, setErr] = useState<string | null>(null);
  const { onPick, onOpenChange } = p;
  // Hai callback ổn định để `Cell` memo được: ô không chạy thì không dựng lại
  const play = useCallback((f: string | null) => setPlaying(f), []);
  const pick = useCallback(
    (f: string) =>
      void onPick(f).then((e) => {
        setErr(e);
        if (!e) onOpenChange(false);
      }),
    [onPick, onOpenChange],
  );

  return (
    <>
      <DialogTitle>Nạp hành động</DialogTitle>
      <DialogDescription>
        {p.files.length} file trong <code className="font-mono">actions/</code> — rê vào một ô để{" "}
        {p.subject.kind === "animal" ? "con vật" : "nhân vật"} đang mở diễn thử.
      </DialogDescription>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {p.files.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Thư mục đang mở chưa có <code className="font-mono">actions/</code>
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
            {p.files.map((f) => (
              <Cell
                key={f}
                file={f}
                action={loaded[f]}
                t={loaded[f] && f === playing ? phaseAt(loaded[f], clock) : 0}
                selected={f === p.value}
                subject={p.subject}
                view={p.view}
                onPick={pick}
                onPlay={play}
              />
            ))}
          </div>
        )}
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </>
  );
}

const Cell = memo(function Cell({
  file,
  action,
  t,
  selected,
  subject,
  view,
  onPick,
  onPlay,
}: {
  file: string;
  /** Chưa đọc xong là `undefined`, file hỏng là `null` */
  action: ActionData | null | undefined;
  t: number;
  selected: boolean;
  subject: Subject;
  view: ViewState;
  onPick: (file: string) => void;
  /** Vào ô thì báo tên, ra thì báo `null` */
  onPlay: (file: string | null) => void;
}) {
  return (
    <button
      type="button"
      title={file}
      onClick={() => onPick(file)}
      onPointerEnter={() => onPlay(file)}
      onPointerLeave={() => onPlay(null)}
      onFocus={() => onPlay(file)}
      onBlur={() => onPlay(null)}
      className={cn(
        "flex flex-col gap-1 rounded border p-1 text-left hover:bg-accent",
        selected && "border-primary ring-2 ring-primary/40",
      )}
    >
      <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-sm bg-[#f4f1e8]">
        {action && (
          <ActionFrame
            subject={subject}
            action={action}
            t={t}
            view={view}
            className="h-full w-full"
          />
        )}
      </div>
      <span className="truncate text-[12px] leading-tight">{action?.name ?? file}</span>
      <span className="truncate font-mono text-[10px] leading-tight text-muted-foreground tabular-nums">
        {action === null
          ? "hỏng"
          : action
            ? `${action.keys ? `${action.keys.length} mốc` : "bộ sinh"} · ${action.duration}s`
            : "…"}
      </span>
    </button>
  );
});
