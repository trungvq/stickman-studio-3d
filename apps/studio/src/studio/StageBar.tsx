import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  clampViews,
  POSE_LABELS,
  POSES,
  VIEWS,
  type PoseName,
  type View,
} from "@stickman3d/sketch";
import { useId } from "react";
import { PITCH, wrapYaw } from "./solo";
import { viewsOf, type ViewState } from "./view";

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-1.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
    </div>
  );
}

const VIEW_LABELS: Record<View, string> = {
  front: "Chính diện",
  quarter: "3/4",
  side: "Nghiêng",
  rear: "3/4 sau",
  back: "Sau lưng",
};

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-0.5 rounded-md border p-0.5">
        {options.map((o) => (
          <Button
            key={o.value}
            size="sm"
            variant={value === o.value ? "secondary" : "ghost"}
            disabled={o.disabled}
            className="h-6 px-1.5 text-xs font-normal"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function AngleSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex w-[172px] items-center gap-1.5">
      <span className="w-9 text-xs text-muted-foreground">{label}</span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
        className="flex-1"
      />
      <span className="w-9 text-right font-mono text-xs tabular-nums">{value}°</span>
    </div>
  );
}

const NO_UNDER = "-";

/** Người 3D: hướng mặt, góc cúi ống kính, tự quay, và track dưới */
function SolidBar({
  view,
  setView,
  sideActions,
}: {
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
  sideActions: string[];
}) {
  return (
    <>
      <AngleSlider
        label="Hướng"
        value={wrapYaw(view.yaw)}
        min={-180}
        max={180}
        onChange={(v) => setView({ yaw: v })}
      />
      <AngleSlider
        label="Cúi"
        value={view.pitch}
        min={PITCH.min}
        max={PITCH.max}
        onChange={(v) => setView({ pitch: v })}
      />
      <Toggle label="Quay vòng" checked={view.spin} onChange={(v) => setView({ spin: v })} />
      <Select
        value={view.under || NO_UNDER}
        onValueChange={(v) => setView({ under: v === NO_UNDER ? "" : v })}
      >
        <SelectTrigger
          size="sm"
          className="w-[190px]"
          title="Hành động 3D chồng dưới, như track dưới của scene"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_UNDER}>Không có track dưới</SelectItem>
          {sideActions.map((f) => (
            <SelectItem key={f} value={f}>
              Dưới: {f.replace(/\.json$/, "")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

/** Hai nhóm nút góc nhìn; nút đầu nào ra tổ hợp không vẽ được thì tắt, đúng theo `clampViews`. */
function ViewPicker({
  view,
  setView,
}: {
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
}) {
  const views = viewsOf(view);
  return (
    <>
      <Segmented
        label="Thân"
        value={views.body}
        options={VIEWS.map((v) => ({ value: v, label: VIEW_LABELS[v] }))}
        onChange={(v) => setView({ bodyView: v })}
      />
      <Segmented
        label="Đầu"
        value={view.headView === "auto" ? "auto" : views.head}
        options={[
          { value: "auto" as const, label: "Theo thân" },
          ...VIEWS.map((h) => ({
            value: h,
            label: VIEW_LABELS[h],
            disabled: clampViews({ body: views.body, head: h }).head !== h,
          })),
        ]}
        onChange={(v) => setView({ headView: v })}
      />
    </>
  );
}

/** Điều khiển phát của sân khấu; không ra JSON nào. Động vật không có tư thế nền, không hoà. */
export function StageBar({
  view,
  setView,
  hasAction,
  subject,
  solid,
  sideActions,
}: {
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
  hasAction: boolean;
  subject: "character" | "animal";
  /** Hành động đang soạn cho người 3D: hướng và ống kính thay cho tư thế nền, lật, góc nhìn */
  solid: boolean;
  sideActions: string[];
}) {
  const human = subject === "character";
  if (solid)
    return (
      <div className="mt-2 flex w-full max-w-[560px] shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5">
        <SolidBar view={view} setView={setView} sideActions={sideActions} />
      </div>
    );
  return (
    <div className="mt-2 flex w-full max-w-[560px] shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5">
      {human && (
        <Select value={view.pose} onValueChange={(v) => setView({ pose: v as PoseName })}>
          <SelectTrigger size="sm" className="w-[190px]" title="Tư thế nền">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(POSES) as PoseName[]).map((k) => (
              <SelectItem key={k} value={k}>
                {POSE_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Toggle label="Lật" checked={view.flip} onChange={(v) => setView({ flip: v })} />
      {human && <ViewPicker view={view} setView={setView} />}
      {hasAction && (
        <Toggle
          label="Di chuyển ngang"
          checked={view.travel}
          onChange={(v) => setView({ travel: v })}
        />
      )}
      {hasAction && human && (
        <Toggle
          label="Hoà từ tư thế nền"
          checked={view.blend}
          onChange={(v) => setView({ blend: v })}
        />
      )}
    </div>
  );
}
