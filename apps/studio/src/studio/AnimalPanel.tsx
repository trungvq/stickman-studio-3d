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
  ANIMAL_PIECE_KEYS,
  ANIMAL_PIECE_LABELS,
  animalPieceDir,
  animalPieceFile,
  animalProblems,
  defaultAnimal,
  legStretch,
  maxStride,
  partColor,
  type AnimalData,
  type AnimalPieceKey,
  type EyeKind,
  type MouthKind,
  type PieceCatalogEntry,
  type PieceUrls,
} from "@stickman3d/sketch";
import { cn } from "@/lib/utils";
import { Images, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { download } from "./bundle";
import { FacePicker } from "./FacePicker";
import { PiecePicker } from "./PiecePicker";
import type { ViewState } from "./view";

export type MutateAnimal = (fn: (b: AnimalData) => void) => void;

const HEAD_KINDS = {
  muzzle: "mõm dài — ngựa, trâu",
  blunt: "đầu tròn — voi, gấu",
  beak: "có mỏ — gà, chim",
  round: "mõm ngắn — mèo, hổ",
  tapered: "mõm thuôn nhọn — chó, cáo",
} as const;

const EAR_KINDS = {
  none: "không có",
  perk: "vểnh nhọn",
  fan: "quạt to bản",
  floppy: "cụp",
  round: "tròn",
} as const;

const TAIL_KINDS = {
  ribbon: "Dải lông dài",
  none: "không có",
  tuft: "chùm lông — ngựa",
  rope: "dây, chóp có túm — voi",
  fan: "nan lông vũ — gà",
  smooth: "dài, trơn — mèo, hổ",
} as const;

const KNEE_KINDS = { forward: "ra trước", back: "ra sau" } as const;

interface AnimalPanelProps {
  animal: AnimalData | null;
  /** Ảnh đã nạp, khoá theo tên file như của nhân vật */
  urls: PieceUrls;
  catalog: PieceCatalogEntry[];
  pieceUrl: (file: string) => Promise<string>;
  onPieceFile: (k: AnimalPieceKey, file: File) => void;
  onPieceRepo: (k: AnimalPieceKey, entry: PieceCatalogEntry) => void;
  onClearPiece: (k: AnimalPieceKey) => void;
  mutate: MutateAnimal;
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
  repoAnimals: string[];
  animalFile: string;
  writable: boolean;
  onSave: () => Promise<string>;
  onLoadRepo: (file: string) => Promise<string | null>;
  onImport: (text: string) => string | null;
  onNew: (b: AnimalData) => void;
  onClose: () => void;
  exportJson: () => string;
}

/** Bộ số của một con vật hai chân, để "Động vật mới" ra ngay hình đứng được */
const BIPED = (): AnimalData => {
  const d = defaultAnimal();
  d.legs = 2;
  d.rig = { ...d.rig, body: 96, pitch: 26, hipY: 170, hindAt: 0.4 };
  d.body = { ...d.body, depth: 150, rear: 92, front: 24 };
  d.legHind = { ...d.legHind, upper: 70, lower: 130, knee: "back" };
  d.palette = { ...d.palette, legWidth: 9 };
  d.neck = { ...d.neck, len: 86, pitch: 56, base: 70, tip: 48 };
  d.head = { ...d.head, kind: "beak", len: 90, depth: 66, pitch: -6 };
  return d;
};

export function AnimalPanel(p: AnimalPanelProps) {
  const { animal: d, mutate } = p;
  const [out, setOut] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [picking, setPicking] = useState<AnimalPieceKey | null>(null);

  const load = (
    <Section title="Nạp động vật">
      <Select value={p.animalFile} onValueChange={(v) => void p.onLoadRepo(v).then(setErr)}>
        <SelectTrigger className="mb-2 w-full font-mono text-xs">
          <SelectValue placeholder="Nạp từ animals/" />
        </SelectTrigger>
        <SelectContent>
          {p.repoAnimals.map((f) => (
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
          onClick={() => p.onNew({ ...defaultAnimal(), name: "thu-bon-chan" })}
        >
          Bốn chân
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          onClick={() => p.onNew({ ...BIPED(), name: "thu-hai-chan" })}
        >
          Hai chân
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
        <h1 className="mb-3 text-sm font-semibold tracking-[.14em] text-amber-300 uppercase">
          Động vật
        </h1>
        {load}
        <Hint>
          Chưa có con nào. Nạp hoặc tạo mới thì nó lên sân khấu; hành động của nó ở cột Hành động
          bên phải.
        </Hint>
      </div>
    );

  const quad = d.legs === 4;
  const problems = animalProblems(d);

  const legRows = (which: "legFront" | "legHind") => {
    const l = d[which];
    const front = which === "legFront";
    return (
      <>
        <SliderRow
          label="Đoạn trên"
          value={l.upper}
          min={30}
          max={220}
          onChange={(v) => mutate((x) => (x[which].upper = v))}
        />
        <SliderRow
          label="Đoạn dưới"
          value={l.lower}
          min={30}
          max={220}
          onChange={(v) => mutate((x) => (x[which].lower = v))}
        />
        <div className="mb-2.5 grid grid-cols-[72px_1fr] items-center gap-2 sm:grid-cols-[92px_1fr] sm:gap-3">
          <Label className="text-sm">Gập gối</Label>
          <Select
            value={l.knee}
            onValueChange={(v) => mutate((x) => (x[which].knee = v as "forward" | "back"))}
          >
            <SelectTrigger className="w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(KNEE_KINDS).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Đứng yên đã duỗi {Math.round(legStretch(d, front) * 100)}%. Để quanh 93%, voi chân cột
          96%; dưới 85% là ngồi xổm. Khớp giữa là khớp lộ dưới bụng: móng guốc chân trước gập trước,
          chân sau gập sau; voi gập trước cả bốn.
        </p>
      </>
    );
  };

  return (
    <div className="p-4 pb-16">
      <h1 className="mb-3 text-sm font-semibold tracking-[.14em] text-amber-300 uppercase">
        Động vật
      </h1>

      {problems.length > 0 && (
        <div className="mb-4 rounded border border-destructive/50 bg-destructive/10 p-2 text-xs leading-snug text-destructive">
          {problems.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      )}

      <Section title="Chung">
        <Label className="text-sm">Tên</Label>
        <Input
          value={d.name}
          onChange={(e) => mutate((x) => (x.name = e.target.value))}
          className="mt-1 mb-2"
        />
        <CheckRow
          label="Bốn chân"
          checked={quad}
          onChange={(v) => mutate((x) => (x.legs = v ? 4 : 2))}
        />
        <SliderRow
          label="Cao hông"
          value={d.rig.hipY}
          min={60}
          max={520}
          onChange={(v) => mutate((x) => (x.rig.hipY = v))}
        />
        <SliderRow
          label="Dài thân"
          value={d.rig.body}
          min={40}
          max={480}
          onChange={(v) => mutate((x) => (x.rig.body = v))}
        />
        <SliderRow
          label="Dốc thân"
          value={d.rig.pitch}
          min={-30}
          max={45}
          onChange={(v) => mutate((x) => (x.rig.pitch = v))}
        />
        <SliderRow
          label="Chân xa lệch"
          value={d.rig.spread}
          min={0}
          max={60}
          onChange={(v) => mutate((x) => (x.rig.spread = v))}
        />
        <SliderRow
          label="Chân sau ở"
          value={d.rig.hindAt}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => mutate((x) => (x.rig.hindAt = v))}
        />
        <SliderRow
          label="Dày nét"
          value={d.rig.stroke}
          min={2}
          max={20}
          onChange={(v) => mutate((x) => (x.rig.stroke = v))}
        />
        <Hint>
          Gốc toạ độ là khớp hông; <code>Cao hông</code> là chiều cao đứng và cũng là đơn vị của sải
          chân. <code>Chân sau ở</code> treo chân sau dọc thân, 0 là hông, 1 là vai — thú bốn chân
          để 0, con hai chân quanh 0.4 cho chân đứng dưới giữa thân. Sải lớn nhất mà chân với tới:{" "}
          {maxStride(d).toFixed(2)}.
        </Hint>
      </Section>

      <Section title="Thùng thân">
        <SliderRow
          label="Bề dày"
          value={d.body.depth}
          min={30}
          max={420}
          onChange={(v) => mutate((x) => (x.body.depth = v))}
        />
        <SliderRow
          label="Phần lưng"
          value={Math.round(d.body.back * 100)}
          min={10}
          max={90}
          onChange={(v) => mutate((x) => (x.body.back = v / 100))}
        />
        <SliderRow
          label="Mông"
          value={Math.round(d.body.rump * 100)}
          min={30}
          max={140}
          onChange={(v) => mutate((x) => (x.body.rump = v / 100))}
        />
        <SliderRow
          label="Ngực"
          value={Math.round(d.body.chest * 100)}
          min={30}
          max={140}
          onChange={(v) => mutate((x) => (x.body.chest = v / 100))}
        />
        <SliderRow
          label="Thò sau"
          value={d.body.rear}
          min={0}
          max={220}
          onChange={(v) => mutate((x) => (x.body.rear = v))}
        />
        <SliderRow
          label="Thò trước"
          value={d.body.front}
          min={0}
          max={220}
          onChange={(v) => mutate((x) => (x.body.front = v))}
        />
        <Hint>
          Chân cổ chìm dưới thùng thân — kéo <code>Thò trước</code> cho tới khi không còn thấy góc
          cổ nhô ra khỏi lưng.
        </Hint>
      </Section>

      <Section title="Cổ và đầu">
        <SliderRow
          label="Dài cổ"
          value={d.neck.len}
          min={0}
          max={320}
          onChange={(v) => mutate((x) => (x.neck.len = v))}
        />
        <SliderRow
          label="Dốc cổ"
          value={d.neck.pitch}
          min={-40}
          max={100}
          onChange={(v) => mutate((x) => (x.neck.pitch = v))}
        />
        <SliderRow
          label="Gốc cổ"
          value={d.neck.base}
          min={10}
          max={260}
          onChange={(v) => mutate((x) => (x.neck.base = v))}
        />
        <SliderRow
          label="Ngọn cổ"
          value={d.neck.tip}
          min={10}
          max={260}
          onChange={(v) => mutate((x) => (x.neck.tip = v))}
        />
        <div className="mb-2.5 grid grid-cols-[72px_1fr] items-center gap-2 sm:grid-cols-[92px_1fr] sm:gap-3">
          <Label className="text-sm">Kiểu đầu</Label>
          <Select
            value={d.head.kind}
            onValueChange={(v) => mutate((x) => (x.head.kind = v as AnimalData["head"]["kind"]))}
          >
            <SelectTrigger className="w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(HEAD_KINDS).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SliderRow
          label="Dài đầu"
          value={d.head.len}
          min={20}
          max={300}
          onChange={(v) => mutate((x) => (x.head.len = v))}
        />
        <SliderRow
          label="Dày đầu"
          value={d.head.depth}
          min={20}
          max={300}
          onChange={(v) => mutate((x) => (x.head.depth = v))}
        />
        <SliderRow
          label="Dốc đầu"
          value={d.head.pitch}
          min={-180}
          max={60}
          onChange={(v) => mutate((x) => (x.head.pitch = v))}
        />
        <SliderRow
          label="Mắt"
          value={d.head.eye}
          min={0}
          max={24}
          onChange={(v) => mutate((x) => (x.head.eye = v))}
        />
        <Hint>
          Dốc đo so với đoạn cha — cổ so với thân, đầu so với cổ — dương là ngẩng lên. Đầu ngựa chúi
          xuống nên số âm.
        </Hint>
      </Section>

      <Section title="Chân sau">{legRows("legHind")}</Section>
      {quad && <Section title="Chân trước">{legRows("legFront")}</Section>}

      <Section title="Tai, sừng, vòi">
        <div className="mb-2.5 grid grid-cols-[72px_1fr] items-center gap-2 sm:grid-cols-[92px_1fr] sm:gap-3">
          <Label className="text-sm">Tai</Label>
          <Select
            value={d.parts.ear.kind}
            onValueChange={(v) =>
              mutate((x) => (x.parts.ear.kind = v as AnimalData["parts"]["ear"]["kind"]))
            }
          >
            <SelectTrigger className="w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EAR_KINDS).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {d.parts.ear.kind !== "none" && (
          <>
            <SliderRow
              label="Dài tai"
              value={d.parts.ear.len}
              min={0}
              max={260}
              onChange={(v) => mutate((x) => (x.parts.ear.len = v))}
            />
            <SliderRow
              label="Rộng tai"
              value={d.parts.ear.width}
              min={0}
              max={220}
              onChange={(v) => mutate((x) => (x.parts.ear.width = v))}
            />
            <SliderRow
              label="Chỗ mọc"
              value={Math.round(d.parts.ear.at * 100)}
              min={0}
              max={100}
              onChange={(v) => mutate((x) => (x.parts.ear.at = v / 100))}
            />
            <SliderRow
              label="Lệch trục"
              value={Math.round(d.parts.ear.dx * 100)}
              min={-60}
              max={60}
              onChange={(v) => mutate((x) => (x.parts.ear.dx = v / 100))}
            />
            <SliderRow
              label="Dốc tai"
              value={d.parts.ear.pitch}
              min={-180}
              max={180}
              onChange={(v) => mutate((x) => (x.parts.ear.pitch = v))}
            />
          </>
        )}
        {(["horn", "tusk", "trunk", "crest", "mane"] as const).map((k) => (
          <div key={k} className="mt-3">
            {k === "crest" && (
              <div className="mb-2.5 grid grid-cols-[72px_1fr] items-center gap-2 sm:grid-cols-[92px_1fr] sm:gap-3">
                <Label className="text-sm">Kiểu mào</Label>
                <Select
                  value={d.parts.crest.kind}
                  onValueChange={(v) =>
                    mutate((x) => (x.parts.crest.kind = v as AnimalData["parts"]["crest"]["kind"]))
                  }
                >
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comb">Mào múi tròn</SelectItem>
                    <SelectItem value="plume">Lông vuốt dài</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {k === "mane" && (
              <div className="mb-2.5 grid grid-cols-[72px_1fr] items-center gap-2 sm:grid-cols-[92px_1fr] sm:gap-3">
                <Label className="text-sm">Kiểu bờm</Label>
                <Select
                  value={d.parts.mane.kind}
                  onValueChange={(v) =>
                    mutate((x) => (x.parts.mane.kind = v as AnimalData["parts"]["mane"]["kind"]))
                  }
                >
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ridge" className="text-xs">
                      Dọc cổ — ngựa
                    </SelectItem>
                    <SelectItem value="ruff" className="text-xs">
                      Quanh đầu — sư tử
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <SliderRow
              label={{ horn: "Sừng", tusk: "Ngà", trunk: "Vòi", crest: "Mào", mane: "Bờm" }[k]}
              value={d.parts[k].len}
              min={0}
              max={320}
              onChange={(v) => mutate((x) => (x.parts[k].len = v))}
            />
            {d.parts[k].len > 0 && (
              <SliderRow
                label="Bề ngang"
                value={d.parts[k].width}
                min={0}
                max={160}
                onChange={(v) => mutate((x) => (x.parts[k].width = v))}
              />
            )}
          </div>
        ))}
        <Hint>Đặt độ dài về 0 là bỏ bộ phận ấy đi.</Hint>
      </Section>

      <Section title="Cánh">
        <SliderRow
          label="Dài"
          value={d.parts.wing.len}
          min={0}
          max={400}
          onChange={(v) => mutate((x) => (x.parts.wing.len = v))}
        />
        {d.parts.wing.len > 0 && (
          <>
            <SliderRow
              label="Bề ngang"
              value={d.parts.wing.width}
              min={0}
              max={200}
              onChange={(v) => mutate((x) => (x.parts.wing.width = v))}
            />
            <SliderRow
              label="Chỗ mọc %"
              value={Math.round(d.parts.wing.at * 100)}
              min={0}
              max={100}
              onChange={(v) => mutate((x) => (x.parts.wing.at = v / 100))}
            />
            <SliderRow
              label="Lệch lưng %"
              value={Math.round(d.parts.wing.dx * 100)}
              min={-50}
              max={50}
              onChange={(v) => mutate((x) => (x.parts.wing.dx = v / 100))}
            />
            <SliderRow
              label="Dốc"
              value={d.parts.wing.pitch}
              min={-90}
              max={180}
              onChange={(v) => mutate((x) => (x.parts.wing.pitch = v))}
            />
            <SliderRow
              label="Gập chóp"
              value={d.parts.wing.fold}
              min={-90}
              max={90}
              onChange={(v) => mutate((x) => (x.parts.wing.fold = v))}
            />
          </>
        )}
        <Hint>
          Cánh hai đoạn mọc trên lưng, xoè về phía mông; dốc dương là dựng lên, gập dương là chóp
          cong về phía lưng. Đây là dáng nghỉ — hành động cộng thêm vào. Dài 0 là không có cánh.
        </Hint>
      </Section>

      <Section title="Đuôi">
        <div className="mb-2.5 grid grid-cols-[72px_1fr] items-center gap-2 sm:grid-cols-[92px_1fr] sm:gap-3">
          <Label className="text-sm">Kiểu</Label>
          <Select
            value={d.parts.tail.kind}
            onValueChange={(v) =>
              mutate((x) => (x.parts.tail.kind = v as AnimalData["parts"]["tail"]["kind"]))
            }
          >
            <SelectTrigger className="w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TAIL_KINDS).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {d.parts.tail.kind !== "none" && (
          <>
            <SliderRow
              label="Dài"
              value={d.parts.tail.len}
              min={0}
              max={400}
              onChange={(v) => mutate((x) => (x.parts.tail.len = v))}
            />
            <SliderRow
              label="Bề ngang"
              value={d.parts.tail.width}
              min={0}
              max={200}
              onChange={(v) => mutate((x) => (x.parts.tail.width = v))}
            />
            <SliderRow
              label="Dốc"
              value={d.parts.tail.pitch}
              min={-90}
              max={90}
              onChange={(v) => mutate((x) => (x.parts.tail.pitch = v))}
            />
          </>
        )}
        <Hint>Đuôi mọc ở mút sau thùng thân, dốc dương là vểnh lên.</Hint>
      </Section>

      <Section title="Màu">
        <CheckRow
          label="Vằn trên lông"
          checked={d.markings.kind === "stripes"}
          onChange={(v) => mutate((x) => (x.markings.kind = v ? "stripes" : "none"))}
        />
        {d.markings.kind === "stripes" && (
          <ColorRow
            label="Vằn"
            value={d.markings.color}
            onChange={(v) => mutate((x) => (x.markings.color = v))}
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          <ColorRow
            label="Nét"
            value={d.palette.line}
            onChange={(v) => mutate((x) => (x.palette.line = v))}
          />
          <ColorRow
            label="Lông"
            value={d.palette.coat}
            onChange={(v) => mutate((x) => (x.palette.coat = v))}
          />
          <ColorRow
            label="Nét chân"
            value={d.palette.leg}
            onChange={(v) => mutate((x) => (x.palette.leg = v))}
          />
          <ColorRow
            label="Sừng, ngà"
            value={d.palette.horn}
            onChange={(v) => mutate((x) => (x.palette.horn = v))}
          />
          <ColorRow
            label="Bờm, đuôi"
            value={d.palette.hair}
            onChange={(v) => mutate((x) => (x.palette.hair = v))}
          />
        </div>
        <SliderRow
          label="Dày nét chân"
          value={d.palette.legWidth}
          min={2}
          max={60}
          onChange={(v) => mutate((x) => (x.palette.legWidth = v))}
        />
        <div className="mt-2">
          <CheckRow
            label="Bụng khác màu"
            checked={d.palette.belly !== undefined}
            onChange={(v) =>
              mutate((x) => (x.palette.belly = v ? (d.palette.belly ?? d.palette.coat) : undefined))
            }
          />
          {d.palette.belly !== undefined && (
            <ColorRow
              label="Bụng"
              value={d.palette.belly}
              onChange={(v) => mutate((x) => (x.palette.belly = v))}
            />
          )}
          <CheckRow
            label="Đầu và cổ khác màu"
            checked={d.palette.head !== undefined}
            onChange={(v) =>
              mutate((x) => (x.palette.head = v ? (d.palette.head ?? d.palette.coat) : undefined))
            }
          />
          {d.palette.head !== undefined && (
            <ColorRow
              label="Đầu và cổ"
              value={d.palette.head}
              onChange={(v) => mutate((x) => (x.palette.head = v))}
            />
          )}
        </div>
      </Section>

      <Section title="Màu bộ phận">
        {(["crest", "wing", "tail"] as const).map((k) => (
          <div key={k} className="mb-3">
            <ColorRow
              label={{ crest: "Mào", wing: "Cánh", tail: "Đuôi" }[k]}
              value={partColor(d, k)}
              onChange={(v) => mutate((x) => (x.parts[k].color = v))}
            />
            {k !== "crest" && (
              <>
                <CheckRow
                  label="Có màu phụ"
                  checked={d.parts[k].accent !== undefined}
                  onChange={(v) =>
                    mutate((x) => (x.parts[k].accent = v ? d.palette.horn : undefined))
                  }
                />
                {d.parts[k].accent !== undefined && (
                  <ColorRow
                    label="Màu phụ"
                    value={d.parts[k].accent!}
                    onChange={(v) => mutate((x) => (x.parts[k].accent = v))}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </Section>

      <Section title="Mảnh ảnh">
        {ANIMAL_PIECE_KEYS.map((k) => {
          const pc = d.pieces[k];
          const file = animalPieceFile(pc);
          const label = file
            ? (p.catalog.find((e) => e.file === file)?.name ??
              file.slice(file.lastIndexOf("/") + 1))
            : "";
          return (
            <div key={k} className="mb-3">
              <Label className="text-sm">{ANIMAL_PIECE_LABELS[k]}</Label>
              <div className="mt-1 mb-2 flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-0 flex-1 justify-start font-mono text-xs"
                  title={file}
                  onClick={() => setPicking(k)}
                >
                  <Images className="text-muted-foreground" />
                  <span className={cn("truncate", !label && "font-sans text-muted-foreground")}>
                    {label || "hình code"}
                  </span>
                </Button>
                <Button variant="secondary" size="sm" className="px-2.5" asChild>
                  <label title="Nạp ảnh từ máy">
                    <Upload />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) p.onPieceFile(k, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
                {file && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    title="Về lại hình code"
                    onClick={() => p.onClearPiece(k)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              {file && (
                <>
                  <SliderRow
                    label="dx"
                    value={pc.dx}
                    min={-200}
                    max={200}
                    onChange={(v) => mutate((x) => (x.pieces[k].dx = v))}
                  />
                  <SliderRow
                    label="dy"
                    value={pc.dy}
                    min={-200}
                    max={200}
                    onChange={(v) => mutate((x) => (x.pieces[k].dy = v))}
                  />
                  <SliderRow
                    label="scale"
                    value={Math.round(pc.scale * 100)}
                    min={20}
                    max={260}
                    onChange={(v) => mutate((x) => (x.pieces[k].scale = v / 100))}
                  />
                  <SliderRow
                    label="bề ngang"
                    value={Math.round(pc.widthScale * 100)}
                    min={20}
                    max={260}
                    onChange={(v) => mutate((x) => (x.pieces[k].widthScale = v / 100))}
                  />
                  <SliderRow
                    label="xoay"
                    value={pc.rotate}
                    min={-90}
                    max={90}
                    onChange={(v) => mutate((x) => (x.pieces[k].rotate = v))}
                  />
                  <CheckRow
                    label="Tô màu ảnh mực"
                    checked={pc.color !== undefined}
                    onChange={(v) =>
                      mutate(
                        (x) => (x.pieces[k].color = v ? (pc.color ?? d.palette.coat) : undefined),
                      )
                    }
                  />
                  {pc.color !== undefined && (
                    <ColorRow
                      label="Màu"
                      value={pc.color}
                      onChange={(v) => mutate((x) => (x.pieces[k].color = v))}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
        <Hint>
          Socket nào có ảnh thì hình code của đúng bộ phận ấy không vẽ nữa. Hộp lấy nguyên từ bộ
          xương — dài theo đoạn, rộng theo bề dày đã khai — nên chỉnh khung là chỉnh
          <code>Bề dày</code>, <code>Dài thân</code>… chứ không phải tỉ lệ tấm ảnh.
        </Hint>
      </Section>

      <Section title="Xem thử">
        <CheckRow
          label="Dựng người bên cạnh để so tỉ lệ"
          checked={p.view.compare}
          onChange={(v) => p.setView({ compare: v })}
        />
        {p.view.compare && (
          <>
            <SliderRow
              label="Cách người"
              value={p.view.animalX}
              min={-900}
              max={900}
              step={5}
              onChange={(v) => p.setView({ animalX: v })}
            />
            <CheckRow
              label="Vẽ sau nhân vật"
              checked={p.view.animalBack}
              onChange={(v) => p.setView({ animalBack: v })}
            />
          </>
        )}
        <div className="mb-2.5">
          <Label className="text-sm">Mỏ và mắt</Label>
          <FacePicker
            className="mt-1"
            fields={["mouth", "eyes"]}
            value={{ mouth: p.view.mouth, eyes: p.view.eyes === "auto" ? undefined : p.view.eyes }}
            blank={{ eyes: "tự chớp" }}
            onChange={(f, k) => {
              if (f === "eyes") p.setView({ eyes: (k as EyeKind | undefined) ?? "auto" });
              else if (f === "mouth" && k) p.setView({ mouth: k as MouthKind });
            }}
          />
        </div>
        <Hint>
          Người đứng cùng đường đất với con vật, ở tư thế nền, không lưu vào JSON. Bật{" "}
          <b>Di chuyển ngang</b> ở thanh dưới sân khấu để xem trôi ngang suy từ bàn chân. Mỏ chỉ đầu
          có mỏ vẽ; hành động ghi nét nào thì nét đó thắng.
        </Hint>
      </Section>

      {picking && (
        <PiecePicker
          socket={animalPieceDir(picking)}
          title={ANIMAL_PIECE_LABELS[picking]}
          open
          onOpenChange={(o) => !o && setPicking(null)}
          entries={p.catalog.filter((e) => e.socket === animalPieceDir(picking))}
          parts={[]}
          value={animalPieceFile(d.pieces[picking]) ?? ""}
          currentUrl={p.urls[animalPieceFile(d.pieces[picking]) ?? ""]}
          pieceUrl={p.pieceUrl}
          onPick={(v) => typeof v !== "string" && p.onPieceRepo(picking, v)}
        />
      )}

      {load}

      <Section title="JSON động vật">
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
                `${d.name || "animal"}.json`,
              )
            }
          >
            Tải về
          </Button>
          <Button size="sm" variant="ghost" className="flex-1" onClick={p.onClose}>
            Bỏ động vật
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
