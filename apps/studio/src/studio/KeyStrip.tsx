import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ActionData } from "@stickman3d/sketch";
import { ActionFrame, type Subject } from "./Preview";
import type { ViewState } from "./view";

/** Số pha lấy mẫu cho hành động bộ sinh — nó không có mốc nào để liệt kê */
const SAMPLES = 8;

interface KeyStripProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ActionData;
  /** Track dưới của người 3D (`view.under`) */
  under: ActionData | null;
  subject: Subject;
  view: ViewState;
  /** Mốc đang chọn ở cột Hành động */
  sel: number;
  /** Bấm một ô: ghim pha đó, và chọn mốc nếu ô là một mốc thật */
  onPick: (t: number, i: number | null) => void;
}

/** Toàn bộ mốc của hành động trên một hàng, sáu ô vừa bề ngang rồi cuộn ngang tiếp. */
export function KeyStrip(p: KeyStripProps) {
  const keys = p.action.keys;
  const cells = keys
    ? keys.map((k, i) => ({ t: k.t, i }))
    : Array.from({ length: SAMPLES }, (_, i) => ({ t: i / SAMPLES, i: null }));

  const pick = (t: number, i: number | null) => {
    p.onPick(t, i);
    p.onOpenChange(false);
  };

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogTitle>
          {p.action.name} — {cells.length} {keys ? "mốc" : "pha"}
        </DialogTitle>
        <DialogDescription>
          {keys
            ? "Bấm một mốc để ghim pha đó và chọn nó ở cột Hành động."
            : "Hành động bộ sinh không có mốc; đây là tám pha đều nhau."}
        </DialogDescription>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {cells.map(({ t, i }, n) => (
            <button
              key={n}
              type="button"
              onClick={() => pick(t, i)}
              className={cn(
                "flex w-[calc((100%-2.5rem)/6)] min-w-[7rem] shrink-0 flex-col gap-1 rounded border p-1 hover:bg-accent",
                i !== null && i === p.sel && "border-primary ring-2 ring-primary/40",
              )}
            >
              <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-sm bg-[#f4f1e8]">
                <ActionFrame
                  subject={p.subject}
                  action={p.action}
                  under={p.under}
                  t={t}
                  view={p.view}
                  className="h-full w-full"
                />
              </div>
              <span className="text-center text-[12px] leading-tight font-medium">{n + 1}</span>
              <span className="text-center font-mono text-[10px] leading-tight text-muted-foreground tabular-nums">
                t = {t.toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
