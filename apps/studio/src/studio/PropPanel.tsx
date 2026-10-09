import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckRow, ColorRow, Hint, Section, SliderRow } from "@/components/controls";
import {
  defaultProp,
  mix,
  PARTS,
  partsFor,
  pieceFile,
  piecePart,
  propSeat,
  type PieceCatalogEntry,
  type PropData,
} from "@stickman3d/sketch";
import { Images, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { download } from "./bundle";
import { PiecePicker } from "./PiecePicker";
import type { ViewState } from "./view";

export type MutateProp = (fn: (p: PropData) => void) => void;

/** Thân treo vào trục bánh sau; xe kéo tay cần kéo tới cả một thân xe */
const BODY_SHIFT = 200;

interface PropPanelProps {
  prop: PropData | null;
  mutate: MutateProp;
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
  /** URL ảnh thân, nếu `body.src` là `image` */
  url?: string;
  /** Mục `socket: "prop"` trong `pieces/catalog.json` */
  catalog: PieceCatalogEntry[];
  pieceUrl: (file: string) => Promise<string>;
  repoProps: string[];
  propFile: string;
  writable: boolean;
  onSave: () => Promise<string>;
  onLoadRepo: (file: string) => Promise<string | null>;
  onImport: (text: string) => string | null;
  onNew: (p: PropData) => void;
  onClose: () => void;
  onBodyFile: (file: File) => void;
  onBodyRepo: (entry: PieceCatalogEntry) => void;
  onBodyPart: (name: string) => void;
  onClearBody: () => void;
  exportJson: () => string;
}

export function PropPanel(p: PropPanelProps) {
  const { prop: d, mutate } = p;
  const [out, setOut] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const load = (
    <Section title="Nạp đạo cụ">
      <Select value={p.propFile} onValueChange={(v) => void p.onLoadRepo(v).then(setErr)}>
        <SelectTrigger className="mb-2 w-full font-mono text-xs">
          <SelectValue placeholder="Nạp từ props/" />
        </SelectTrigger>
        <SelectContent>
          {p.repoProps.map((f) => (
            <SelectItem key={f} value={f} className="font-mono text-xs">
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          onClick={() =>
            p.onNew({
              ...defaultProp(),
              name: "dao-cu-moi",
              body: { ...defaultProp().body, src: "part", part: "thung", dx: -80 },
            })
          }
        >
          Xe mới
        </Button>
        <Button size="sm" variant="secondary" className="flex-1" asChild>
          <label>
            Nạp file
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setErr(p.onImport(await f.text()));
                e.target.value = "";
              }}
            />
          </label>
        </Button>
      </div>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </Section>
  );

  if (!d)
    return (
      <div className="p-4 pb-16">
        <h1 className="mb-3 text-sm font-semibold tracking-[.14em] text-emerald-300 uppercase">
          Đạo cụ
        </h1>
        {load}
        <Hint>
          Chưa có đạo cụ. Nạp hoặc tạo mới thì nó đứng cạnh nhân vật trên sân khấu, bánh lăn theo
          trôi ngang.
        </Hint>
      </div>
    );

  const b = d.body;
  const file = pieceFile(b);
  const part = piecePart(b);
  const parts = partsFor("prop");
  const value = part ? `part:${part}` : (file ?? "");
  const seat = propSeat(d);
  const label = part
    ? (PARTS[part]?.label ?? `${part} — không có`)
    : file
      ? (p.catalog.find((e) => e.file === file)?.name ?? file.slice(file.lastIndexOf("/") + 1))
      : "";

  return (
    <div className="p-4 pb-16">
      <h1 className="mb-3 text-sm font-semibold tracking-[.14em] text-emerald-300 uppercase">
        Đạo cụ
      </h1>

      <Section title="Chung">
        <Label className="text-sm">Tên</Label>
        <Input
          value={d.name}
          onChange={(e) => mutate((x) => (x.name = e.target.value))}
          className="mt-1"
        />
        <div className="mt-2">
          <ColorRow label="Nét" value={d.line} onChange={(v) => mutate((x) => (x.line = v))} />
        </div>
      </Section>

      <Section title="Thân">
        <div className="mb-2 flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 justify-start font-mono text-xs"
            title={file}
            onClick={() => setPicking(true)}
          >
            <Images className="text-muted-foreground" />
            <span className={cn("truncate", !label && "font-sans text-muted-foreground")}>
              {label || "Chưa có"}
            </span>
          </Button>
          <PiecePicker
            socket="prop"
            title="Thân đạo cụ"
            open={picking}
            onOpenChange={setPicking}
            entries={p.catalog}
            parts={parts}
            value={value}
            currentUrl={p.url}
            pieceUrl={p.pieceUrl}
            onPick={(v) => (typeof v === "string" ? p.onBodyPart(v) : p.onBodyRepo(v))}
          />
          <Button variant="secondary" size="sm" className="px-2.5" asChild>
            <label title="Nạp ảnh từ máy">
              <Upload />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) p.onBodyFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          {(file || part) && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              title="Bỏ thân"
              onClick={p.onClearBody}
            >
              <Trash2 />
            </Button>
          )}
        </div>
        {part && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            <ColorRow
              label="Màu"
              value={b.color ?? "#ffffff"}
              onChange={(v) => mutate((x) => (x.body.color = v))}
            />
            <ColorRow
              label="Màu phụ"
              value={b.accent ?? mix(b.color ?? "#ffffff", "#000000", 0.3)}
              onChange={(v) => mutate((x) => (x.body.accent = v))}
            />
          </div>
        )}
        {file && !part && (
          <div className="mb-2">
            <CheckRow
              label="Tô màu"
              checked={b.color !== undefined}
              onChange={(v) =>
                mutate((x) => (x.body.color = v ? (b.color ?? "#c9a86a") : undefined))
              }
            />
            {b.color !== undefined && (
              <ColorRow
                label="Màu"
                value={b.color}
                onChange={(v) => mutate((x) => (x.body.color = v))}
              />
            )}
          </div>
        )}
        <SliderRow
          label="dx"
          value={b.dx}
          min={-BODY_SHIFT}
          max={BODY_SHIFT}
          onChange={(v) => mutate((x) => (x.body.dx = v))}
        />
        <SliderRow
          label="dy"
          value={b.dy}
          min={-BODY_SHIFT}
          max={BODY_SHIFT}
          onChange={(v) => mutate((x) => (x.body.dy = v))}
        />
        <SliderRow
          label="scale"
          value={Math.round(b.scale * 100)}
          min={40}
          max={220}
          onChange={(v) => mutate((x) => (x.body.scale = v / 100))}
        />
        <SliderRow
          label="bề ngang"
          value={Math.round(b.widthScale * 100)}
          min={50}
          max={220}
          onChange={(v) => mutate((x) => (x.body.widthScale = v / 100))}
        />
        <SliderRow
          label="xoay"
          value={b.rotate}
          min={-90}
          max={90}
          onChange={(v) => mutate((x) => (x.body.rotate = v))}
        />
        <Hint>
          Hộp cao bằng nửa người, đáy đặt lên trục bánh sau rồi dịch dx/dy; xoay quanh trục ấy. Ảnh
          thân để ở <code>pieces/prop/</code>, càng chìa sang trái.
        </Hint>
      </Section>

      <Section title="Bánh">
        <CheckRow
          label="Có bánh sau"
          checked={!!d.rear}
          onChange={(v) =>
            mutate((x) => {
              if (v) x.rear = { r: 44 };
              else {
                // Bánh trước treo vào bánh sau: bỏ bánh sau là bỏ cả hai
                delete x.rear;
                delete x.front;
              }
            })
          }
        />
        {d.rear && (
          <SliderRow
            label="Bánh sau r"
            value={d.rear.r}
            min={10}
            max={120}
            onChange={(v) => mutate((x) => (x.rear!.r = v))}
          />
        )}
        {d.rear && (
          <CheckRow
            label="Có bánh trước"
            checked={!!d.front}
            onChange={(v) =>
              mutate((x) => {
                if (v) x.front = { x: 130, r: x.rear?.r ?? 44 };
                else delete x.front;
              })
            }
          />
        )}
        {d.front && (
          <>
            <SliderRow
              label="Bánh trước x"
              value={d.front.x}
              min={20}
              max={400}
              onChange={(v) => mutate((x) => (x.front!.x = v))}
            />
            <SliderRow
              label="Bánh trước r"
              value={d.front.r}
              min={10}
              max={120}
              onChange={(v) => mutate((x) => (x.front!.r = v))}
            />
          </>
        )}
        <SliderRow
          label="Nan hoa"
          value={d.wheel.spokes}
          min={0}
          max={16}
          onChange={(v) => mutate((x) => (x.wheel.spokes = v))}
        />
        <SliderRow
          label="Dày nét"
          value={d.wheel.stroke}
          min={2}
          max={24}
          onChange={(v) => mutate((x) => (x.wheel.stroke = v))}
        />
        <CheckRow
          label="Ruột bánh trong suốt"
          checked={d.wheel.fill === "none"}
          onChange={(v) => mutate((x) => (x.wheel.fill = v ? "none" : "#ffffff"))}
        />
        {d.wheel.fill !== "none" && (
          <ColorRow
            label="Ruột bánh"
            value={d.wheel.fill}
            onChange={(v) => mutate((x) => (x.wheel.fill = v))}
          />
        )}
        <Hint>
          Gốc là điểm bánh sau chạm đất; to bánh là xe tự nâng. Bánh quay theo quãng đã lăn, không
          có tốc độ riêng — bật Di chuyển ngang để thấy.
        </Hint>
      </Section>

      <Section title="Chỗ ngồi">
        <CheckRow
          label="Chỗ ngồi riêng"
          checked={!!d.seat}
          onChange={(v) =>
            mutate((x) => {
              if (v) x.seat = propSeat(x) ?? { x: 0, y: -120 };
              else delete x.seat;
            })
          }
        />
        {d.seat && (
          <>
            <SliderRow
              label="x"
              value={d.seat.x}
              min={-400}
              max={400}
              onChange={(v) => mutate((x) => (x.seat!.x = v))}
            />
            <SliderRow
              label="y"
              value={d.seat.y}
              min={-600}
              max={0}
              onChange={(v) => mutate((x) => (x.seat!.y = v))}
            />
          </>
        )}
        <Hint>
          {seat
            ? "Hông người ngồi, so với điểm bánh sau chạm đất, y âm là lên trên. Bỏ tick là lấy chỗ ngồi của bộ phận thân. Trong scene là "
            : "Thân này không có chỗ ngồi sẵn; tick để khai. Trong scene là "}
          <code>cast[].sit</code>: xe vẽ lớp sau, rồi người, rồi lớp trước.
        </Hint>
      </Section>

      <Section title="Xem thử">
        <SliderRow
          label="Cách người"
          value={p.view.propX}
          min={-600}
          max={600}
          step={5}
          onChange={(v) => p.setView({ propX: v })}
        />
        <CheckRow
          label="Vẽ sau nhân vật"
          checked={p.view.propBack}
          onChange={(v) => p.setView({ propBack: v })}
        />
        <CheckRow
          label="Người ngồi trong"
          checked={!!seat && p.view.propSit}
          disabled={!seat}
          onChange={(v) => p.setView({ propSit: v, pose: v ? "sit" : "idle" })}
        />
        <Hint>
          Độ lệch so với nhân vật, đúng nghĩa <code>props[].x</code> khi <code>follow</code> trong
          scene; không lưu vào đạo cụ. Nạp <code>push.json</code> ở cột Hành động rồi kéo cho càng
          gặp tay. Người ngồi trong thì xe đứng giữa và người treo hông vào chỗ ngồi.
        </Hint>
      </Section>

      {load}

      <Section title="JSON đạo cụ">
        {p.writable && (
          <Button size="sm" className="mb-2 w-full" onClick={() => void p.onSave().then(setErr)}>
            Lưu vào thư mục
          </Button>
        )}
        <div className="mb-2 flex gap-2">
          <Button
            size="sm"
            variant={p.writable ? "secondary" : "default"}
            className="flex-1"
            onClick={() => setOut(p.exportJson())}
          >
            Xuất
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() =>
              download(
                new Blob([p.exportJson()], { type: "application/json" }),
                `${d.name || "prop"}.json`,
              )
            }
          >
            Tải về
          </Button>
          <Button size="sm" variant="ghost" className="flex-1" onClick={p.onClose}>
            Bỏ đạo cụ
          </Button>
        </div>
        <Textarea
          value={out}
          onChange={(e) => setOut(e.target.value)}
          placeholder="Xuất, hoặc dán JSON vào đây rồi bấm Áp dụng"
          className="h-40 font-mono text-[16px] md:text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onClick={() => setErr(p.onImport(out))}
        >
          Áp dụng JSON trong ô
        </Button>
      </Section>
    </div>
  );
}
