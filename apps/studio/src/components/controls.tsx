import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2.5 border-b pb-1 text-xs font-semibold tracking-[.12em] text-foreground/75 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * `min`/`max` là tầm kéo thường ngày, không phải giới hạn: ô số bên phải gõ được số ngoài
 * tầm và thanh tự dãn theo giá trị đang có, nên file vượt tầm vẫn kéo được. `min` không âm
 * là sàn cứng — nét dày `0`, scale `0` không có nghĩa.
 */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setText(String(value));
  }
  const commit = (t: string) => {
    const n = Number(t.trim().replace(",", "."));
    if (!Number.isFinite(n) || t.trim() === "") return setText(String(value));
    const decimals = (String(step).split(".")[1] ?? "").length;
    const v = Number((Math.round(n / step) * step).toFixed(decimals));
    onChange(min >= 0 ? Math.max(min, v) : v);
  };
  return (
    <div className="mb-2.5 grid touch-pan-y grid-cols-[72px_1fr_40px] items-center gap-2 select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] sm:grid-cols-[92px_1fr_48px] sm:gap-3">
      <Label className="text-sm">{label}</Label>
      <Slider
        value={[value]}
        min={Math.min(min, value)}
        max={Math.max(max, value)}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
      <input
        value={text}
        inputMode="decimal"
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(text);
          if (e.key === "Escape") setText(String(value));
        }}
        className="h-6 w-full min-w-0 rounded border border-transparent bg-transparent px-0.5 text-right font-mono text-xs tabular-nums outline-none hover:border-input focus:border-ring"
      />
    </div>
  );
}

export function CheckRow({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="mb-2 flex items-center gap-2.5">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
    </div>
  );
}

export function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // Bộ chọn màu bắn hàng chục sự kiện mỗi frame khi kéo; gom lại một lần mỗi frame
  const [shown, setShown] = useState(value);
  const pending = useRef<string | null>(null);
  const raf = useRef(0);
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (pending.current === null) setShown(value);
  }, [value]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const change = (v: string) => {
    setShown(v);
    pending.current = v;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const next = pending.current;
      pending.current = null;
      if (next !== null) latest.current(next);
    });
  };
  const [text, setText] = useState(shown);
  const [synced, setSynced] = useState(shown);
  if (synced !== shown) {
    setSynced(shown);
    setText(shown);
  }
  const commitText = (t: string) => {
    const m = t.trim().replace(/^#?/, "#").toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(m)) change(m);
    else if (/^#[0-9a-f]{3}$/.test(m)) change("#" + [...m.slice(1)].map((c) => c + c).join(""));
    else setText(shown);
  };
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <div className="mt-1 flex gap-1.5">
        <input
          type="color"
          value={shown}
          onChange={(e) => change(e.target.value)}
          className="h-8 w-10 shrink-0 rounded border bg-transparent p-0"
        />
        <Input
          value={text}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commitText(text)}
          className="h-8 font-mono text-xs"
        />
      </div>
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs leading-snug text-muted-foreground">{children}</p>;
}
