import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  BROW_KINDS,
  Brow,
  DEFAULT_FACE,
  EYE_KINDS,
  Eyes,
  Head,
  MOUTH_KINDS,
  Mouth,
  type BrowKind,
  type EyeKind,
  type FaceState,
  type MouthKind,
} from "@stickman3d/sketch";
import { Smile } from "lucide-react";
import { useState } from "react";

export type FaceValue = Partial<FaceState>;
type FaceField = keyof FaceValue;

export const MOUTH_LABELS: Record<MouthKind, string> = {
  closed: "ngậm",
  parted: "hé nhỏ",
  talkTeeth: "nói · răng cắn",
  talkA: "nói · há vừa",
  talkB: "nói · há to",
  talkO: "nói · tròn dọc",
  talkSadA: "nói buồn · há nhỏ",
  talkSadB: "nói buồn · há lớn",
  talkAngryA: "nói giận · há nhỏ",
  talkAngryB: "nói giận · há lớn",
  smile: "cười mím",
  grin: "cười toe",
  wry: "cười gượng · mím",
  wryOpen: "cười gượng · há",
  frown: "mếu",
  pain: "đau",
  grit: "nghiến răng",
  o: "ngạc nhiên",
  wide: "la hét",
};
export const BROW_LABELS: Record<BrowKind, string> = {
  neutral: "thường",
  flat: "ngang",
  lifted: "nhấc nhẹ",
  furrowed: "cau",
  angry: "cáu",
  sad: "buồn",
  raised: "nhướn",
  worried: "lo nhẹ",
  skeptical: "nhướng một bên",
};
export const EYE_LABELS: Record<EyeKind, string> = {
  open: "mở",
  shut: "nhắm",
  wide: "trợn",
  squint: "nheo",
  happy: "cười tít",
  squeezed: "nhắm chặt",
  droopy: "rũ",
  wink: "nháy một bên",
};

const FIELD_LABELS: Record<FaceField, string> = { mouth: "Miệng", brow: "Lông mày", eyes: "Mắt" };

/** Một mặt trần, đúng thành phần rig vẽ, để xem thử tổ hợp nét */
export function FacePreview({
  face,
  className,
}: {
  face: Required<FaceValue>;
  className?: string;
}) {
  return (
    <svg viewBox="-44 -46 88 92" className={className}>
      <Head
        shape="round"
        cx={0}
        cy={0}
        rx={40}
        ry={42}
        fill="#f3dcc0"
        stroke="#22201d"
        strokeWidth={3}
      />
      <Eyes kind={face.eyes} cx={0} cy={-8} gap={26} />
      <Brow kind={face.brow} cx={0} cy={-8} gap={26} />
      <Mouth kind={face.mouth} cx={0} cy={22} />
    </svg>
  );
}

interface FacePickerProps {
  value: FaceValue;
  /** Kênh nào hiện ra; động vật không có lông mày */
  fields?: FaceField[];
  /** Nhãn cho lựa chọn "không ghi" của từng kênh; kênh không có nhãn thì bắt buộc chọn */
  blank?: Partial<Record<FaceField, string>>;
  /** Nét đang hiện trên sân khấu, làm nền cho ô xem thử khi kênh đó để trống */
  shown?: Partial<Required<FaceValue>>;
  onChange: <K extends FaceField>(field: K, kind: FaceValue[K] | undefined) => void;
  className?: string;
}

/** Nút mở modal chọn nét mặt; ba lưới miệng / mày / mắt, mỗi ô là mặt xem thử, bấm là áp ngay. */
export function FacePicker({
  value,
  fields = ["mouth", "brow", "eyes"],
  blank,
  shown,
  onChange,
  className,
}: FacePickerProps) {
  const [open, setOpen] = useState(false);
  const base: Required<FaceValue> = {
    mouth: value.mouth ?? shown?.mouth ?? DEFAULT_FACE.mouth,
    brow: value.brow ?? shown?.brow ?? DEFAULT_FACE.brow,
    eyes: value.eyes ?? shown?.eyes ?? DEFAULT_FACE.eyes,
  };
  const summary = [
    fields.includes("mouth") && (value.mouth ? MOUTH_LABELS[value.mouth] : blank?.mouth),
    fields.includes("brow") && (value.brow ? `mày ${BROW_LABELS[value.brow]}` : blank?.brow),
    fields.includes("eyes") && (value.eyes ? `mắt ${EYE_LABELS[value.eyes]}` : blank?.eyes),
  ]
    .filter(Boolean)
    .join(" · ");

  const group = <K extends FaceField>(field: K, kinds: readonly Required<FaceValue>[K][]) => (
    <div key={field}>
      <div className="mb-1.5 text-sm font-semibold">{FIELD_LABELS[field]}</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
        {blank?.[field] && (
          <button
            type="button"
            onClick={() => onChange(field, undefined)}
            className={cn(
              "flex flex-col items-center gap-1 rounded border p-1 hover:bg-accent",
              value[field] === undefined && "border-primary ring-2 ring-primary/40",
            )}
          >
            <FacePreview face={base} className="w-full opacity-40" />
            <span className="text-[12px] leading-tight text-muted-foreground">{blank[field]}</span>
          </button>
        )}
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(field, k)}
            className={cn(
              "flex flex-col items-center gap-1 rounded border p-1 hover:bg-accent",
              value[field] === k && "border-primary ring-2 ring-primary/40",
            )}
          >
            <FacePreview face={{ ...base, [field]: k }} className="w-full" />
            <span className="text-[12px] leading-tight">
              {field === "mouth"
                ? MOUTH_LABELS[k as MouthKind]
                : field === "brow"
                  ? BROW_LABELS[k as BrowKind]
                  : EYE_LABELS[k as EyeKind]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn("w-full min-w-0 justify-start", className)}
        onClick={() => setOpen(true)}
      >
        <FacePreview face={base} className="size-5 shrink-0" />
        <span className="truncate text-xs">{summary}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="flex items-center gap-2">
            <Smile className="size-4" /> Nét mặt
          </DialogTitle>
          <DialogDescription>Bấm là áp ngay lên sân khấu; đóng khi ưng.</DialogDescription>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            {fields.includes("mouth") && group("mouth", MOUTH_KINDS)}
            {fields.includes("brow") && group("brow", BROW_KINDS)}
            {fields.includes("eyes") && group("eyes", EYE_KINDS)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
