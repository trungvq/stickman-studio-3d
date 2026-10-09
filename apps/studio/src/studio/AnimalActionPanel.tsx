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
import { CheckRow, Hint, Section, SliderRow } from "@/components/controls";
import {
  ANIMAL_CHANNELS,
  ANIMAL_CHANNEL_LABELS,
  ANIMAL_GENERATORS,
  ANIMAL_JOINT_CHANNELS,
  actionAirborne,
  animalActionDelta,
  animalActionMask,
  animalPoseDelta,
  animalStand,
  defaultAnimalAction,
  defaultAnimalKeysAction,
  genDefaults,
  keyAnimalDelta,
  keyFace,
  maskProblems,
  maxStride,
  type ActionData,
  type ActionKey,
  type AnimalChannel,
  type AnimalData,
  type AnimalFace,
  type AnimalJointChannel,
  type AnimalPoseDelta,
} from "@stickman3d/sketch";
import { LayoutGrid } from "lucide-react";
import { useState } from "react";
import type { MutateAction } from "./ActionPanel";
import { download } from "./bundle";
import { FacePicker } from "./FacePicker";
import type { ViewState } from "./view";

interface AnimalActionPanelProps {
  action: ActionData | null;
  /** Con vật đang mở: báo sải chân bị kẹp theo chân nó, và mốc mới lấy góc chân đứng của nó */
  animal: AnimalData | null;
  mutate: MutateAction;
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
  sel: number;
  setSel: (i: number) => void;
  /** Chỉ những file trong `actions/` mà `actionKind` là `animal` */
  repoActions: string[];
  actionFile: string;
  writable: boolean;
  onSave: () => Promise<string>;
  /** Mở lưới hành động có thumbnail động */
  onPick: () => void;
  onImport: (text: string) => string | null;
  onNew: (a: ActionData) => void;
  onClose: () => void;
  exportJson: () => string;
}

/** Tên từng góc của một kênh hai số; kênh một số không cần tên */
const JOINTS: Record<AnimalJointChannel, string[]> = {
  spine: [],
  neck: [],
  head: [],
  tail: ["gốc", "ngọn"],
  wing: ["gốc", "chóp"],
  legFrontNear: ["trên", "dưới"],
  legFrontFar: ["trên", "dưới"],
  legHindNear: ["trên", "dưới"],
  legHindFar: ["trên", "dưới"],
};

/** Cánh mọc ngược trục thân nên đưa ra trước mặt là dốc thêm gần 200° — gốc cánh tới ±270 */
function range(c: AnimalJointChannel, j: number | null): [number, number] {
  if (c === "wing" && j === 0) return [-270, 270];
  if (c === "spine") return [-60, 60];
  if (c === "neck" || c === "head") return [-90, 90];
  return [-180, 180];
}

const GEN_BUTTONS: [string, string][] = [
  ["animalWalk", "Đi"],
  ["animalRun", "Chạy"],
  ["animalFly", "Bay"],
  ["animalIdle", "Thở"],
];

/** Cột Hành động khi tab trái là Động vật: bộ sinh hay mốc, cùng bố cục với cột của người. */
export function AnimalActionPanel(p: AnimalActionPanelProps) {
  const { action: a, mutate, view, setView, sel, setSel } = p;
  const [out, setOut] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const newKeysAction = () => {
    p.onNew(defaultAnimalKeysAction());
    setView({ scrub: 0 });
  };

  const load = (
    <Section title="Nạp hành động">
      <Button size="sm" variant="secondary" className="mb-2 w-full" onClick={p.onPick}>
        <LayoutGrid />
        <span className="truncate font-mono text-xs">
          {p.actionFile || `Chọn trong ${p.repoActions.length} hành động…`}
        </span>
      </Button>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={newKeysAction}>
          Mốc mới
        </Button>
        {GEN_BUTTONS.map(([gen, label]) => (
          <Button
            key={gen}
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() => {
              p.onNew(defaultAnimalAction(gen));
              setView({ scrub: null });
            }}
          >
            {label}
          </Button>
        ))}
        <Button size="sm" variant="secondary" className="flex-1" asChild>
          <label>
            File
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

  if (!a)
    return (
      <div className="p-4 pb-16">
        <h1 className="mb-3 text-sm font-semibold tracking-[.14em] text-amber-300 uppercase">
          Hành động
        </h1>
        {load}
        <Hint>
          Chưa có hành động — con vật đứng yên. Nạp hoặc tạo mới thì chạy ngay. Hành động của động
          vật nằm cùng <code>actions/</code> với của người: bộ sinh phân biệt bằng tên, hành động
          mốc bằng <code>actor: "animal"</code>.
        </Hint>
      </div>
    );

  const gen = a.gen ? ANIMAL_GENERATORS[a.gen] : null;
  const params = a.params ?? {};
  const cap = p.animal ? maxStride(p.animal) : null;
  const problems = maskProblems(a);
  const mask = animalActionMask(a);
  const key = a.keys?.[sel];
  const delta = key ? keyAnimalDelta(key) : {};
  const rows: [AnimalJointChannel, number | null][] = key
    ? ANIMAL_JOINT_CHANNELS.filter((c) => mask.includes(c) && delta[c] !== undefined).flatMap<
        [AnimalJointChannel, number | null]
      >((c) =>
        JOINTS[c].length
          ? JOINTS[c].map((_, j): [AnimalJointChannel, number] => [c, j])
          : [[c, null]],
      )
    : [];
  const angle = (c: AnimalJointChannel, j: number | null) => {
    const v = delta[c];
    return v === undefined ? 0 : typeof v === "number" ? v : v[j ?? 0];
  };

  /** Góc điền vào khi bật thêm kênh: chân lấy tư thế đứng của con vật đang mở, còn lại là 0 */
  const restOf = (c: AnimalJointChannel) =>
    p.animal ? animalPoseDelta(animalStand(p.animal))[c] : JOINTS[c].length ? [0, 0] : 0;

  const toggleMask = (c: AnimalChannel, on: boolean) =>
    mutate((d) => {
      const cur = new Set(mask);
      if (on) cur.add(c);
      else cur.delete(c);
      d.mask = ANIMAL_CHANNELS.filter((x) => cur.has(x));
      if (on && c !== "face")
        for (const k of d.keys ?? [])
          if (typeof k.pose !== "string" && (k.pose as AnimalPoseDelta)[c] === undefined)
            Object.assign(k.pose, { [c]: restOf(c) });
    });

  // Nướng bộ sinh thành mốc trên chính con vật đang mở: sải chân đã kẹp theo chân nó
  const bakeGen = () => {
    if (!p.animal) return;
    const b = p.animal;
    const n = 8;
    const round = (v: number) => +v.toFixed(2);
    const keys = Array.from({ length: n }, (_, i) => {
      const d = animalActionDelta(a, i / n, b);
      const pose = Object.fromEntries(
        Object.entries(d).map(([c, v]) => [c, typeof v === "number" ? round(v) : v.map(round)]),
      );
      return { t: +(i / n).toFixed(3), pose, ease: "linear" as const };
    });
    mutate((d) => {
      d.keys = keys;
      d.gen = undefined;
      d.params = undefined;
      d.actor = "animal";
      if (actionAirborne(a)) d.airborne = true;
    });
    setSel(0);
  };

  const setFace = <K extends keyof AnimalFace>(f: K, v: AnimalFace[K] | undefined) =>
    mutate((d) => {
      const k = d.keys![sel];
      const face = { ...k.face, [f]: v };
      if (v === undefined) delete face[f];
      k.face = Object.keys(face).length ? face : undefined;
    });

  const setAngle = (c: AnimalJointChannel, j: number | null, v: number) =>
    mutate((d) => {
      const pose = d.keys![sel].pose as AnimalPoseDelta;
      if (j === null) Object.assign(pose, { [c]: v });
      else {
        const cur = [...((pose[c] as [number, number] | undefined) ?? [0, 0])];
        cur[j] = v;
        Object.assign(pose, { [c]: cur });
      }
    });

  return (
    <div className="p-4 pb-16">
      <h1 className="mb-3 text-sm font-semibold tracking-[.14em] text-amber-300 uppercase">
        Hành động
      </h1>

      {load}

      {problems.length > 0 && (
        <div className="mb-4 rounded border border-destructive/50 bg-destructive/10 p-2 text-xs leading-snug text-destructive">
          {problems.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      )}

      <Section title="Hành động">
        <Label className="text-sm">Tên</Label>
        <Input
          value={a.name}
          onChange={(e) => mutate((d) => (d.name = e.target.value))}
          className="mt-1"
        />
        <Hint>Dùng chung cho mọi con vật; scene ghép tên con vật với tên hành động.</Hint>
        <div className="mt-2 flex gap-2">
          {gen && (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              disabled={!p.animal}
              onClick={bakeGen}
            >
              Nướng thành mốc
            </Button>
          )}
          <Button size="sm" variant="outline" className="flex-1" onClick={p.onClose}>
            Gỡ hành động
          </Button>
        </div>
      </Section>

      {gen && (
        <Section title={gen.label}>
          {gen.params.map((g) => (
            <SliderRow
              key={g.key}
              label={g.label}
              value={params[g.key] ?? g.def}
              min={g.min}
              max={g.max}
              step={g.step ?? 1}
              onChange={(v) =>
                mutate((d) => {
                  d.params = { ...genDefaults(a.gen!), ...d.params, [g.key]: v };
                })
              }
            />
          ))}
          {cap !== null && (params.stride ?? 0) > cap && (
            <p className="text-xs text-amber-500">
              Sải chân bị kẹp xuống {cap.toFixed(2)} — chân con này với tới thế thôi.
            </p>
          )}
          <Hint>
            {gen.airborne
              ? "Bay là trên không: sân khấu treo con vật ở hông, không bàn chân nào chạm đất; trong scene nó đi theo `path`."
              : "Sải chân và nhấc chân đo theo chiều cao hông, nên một file dùng chung cho mọi con; con nào chân ngắn thì tự bước ngắn hơn."}
          </Hint>
        </Section>
      )}

      {key && (
        <Section title={`Mốc ${sel + 1}/${a.keys!.length} — t = ${key.t.toFixed(2)}`}>
          {rows.length === 0 && !Object.keys(keyFace(key)).length && (
            <p className="text-sm text-muted-foreground">
              Mốc này không ghi kênh nào trong mặt nạ — tick kênh ở mục dưới.
            </p>
          )}
          <Select
            value={key.ease}
            onValueChange={(v) => mutate((d) => (d.keys![sel].ease = v as ActionKey["ease"]))}
          >
            <SelectTrigger className="mb-2.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">linear — đều tới mốc sau</SelectItem>
              <SelectItem value="smooth">smooth — chậm vào, chậm ra</SelectItem>
              <SelectItem value="spring">spring — nảy tới mốc sau</SelectItem>
            </SelectContent>
          </Select>
          {rows.map(([c, j]) => (
            <SliderRow
              key={`${c}${j}`}
              label={`${ANIMAL_CHANNEL_LABELS[c]}${j === null ? "" : " " + JOINTS[c][j]}`}
              value={angle(c, j)}
              min={range(c, j)[0]}
              max={range(c, j)[1]}
              onChange={(v) => setAngle(c, j, v)}
            />
          ))}
          {mask.includes("face") && (
            <div className="mb-2.5">
              <Label className="text-sm">Mỏ và mắt</Label>
              <FacePicker
                className="mt-1"
                fields={["mouth", "eyes"]}
                value={keyFace(key)}
                blank={{ mouth: "theo mốc trước", eyes: "theo mốc trước" }}
                shown={{ mouth: view.mouth, eyes: view.eyes === "auto" ? "open" : view.eyes }}
                onChange={(f, k) => {
                  if (f === "mouth") setFace("mouth", k as AnimalFace["mouth"] | undefined);
                  else if (f === "eyes") setFace("eyes", k as AnimalFace["eyes"] | undefined);
                }}
              />
            </div>
          )}
          <Hint>
            Thân, cổ, đầu, đuôi, cánh là dốc cộng thêm vào dáng nghỉ của con vật; chân là góc tuyệt
            đối như chân người. Kéo chấm trên dải mốc dưới sân khấu để chọn mốc khác. Mỏ và mắt
            không nội suy — đổi là đổi ngay từ mốc này.
          </Hint>
        </Section>
      )}

      {a.keys && (
        <Section title="Kênh hành động ghi">
          {ANIMAL_CHANNELS.map((c) => (
            <CheckRow
              key={c}
              label={ANIMAL_CHANNEL_LABELS[c]}
              checked={mask.includes(c)}
              onChange={(v) => toggleMask(c, v)}
            />
          ))}
          <Hint>
            Kênh không tick thì track khác trong scene chồng lên được, chỗ đó nó không ghi. Mỏ nhấp
            khi đang bay là hai clip: bay ở track dưới, nói (chỉ `head` và `face`) ở track trên.
          </Hint>
        </Section>
      )}

      <Section title="Nhịp">
        <SliderRow
          label="Thời lượng"
          value={a.duration}
          min={0.2}
          max={3}
          step={0.02}
          onChange={(v) => mutate((d) => (d.duration = +v.toFixed(2)))}
        />
        <CheckRow
          label="Nối vòng ở cuối chu kỳ"
          checked={a.end === "wrap"}
          onChange={(v) => mutate((d) => (d.end = v ? "wrap" : "hold"))}
        />
        <CheckRow
          label="Trên không — không bàn chân nào chạm đất"
          checked={actionAirborne(a)}
          onChange={(v) =>
            mutate((d) => {
              const own = d.gen ? (ANIMAL_GENERATORS[d.gen]?.airborne ?? false) : false;
              d.airborne = v === own ? undefined : v;
            })
          }
        />
        <Hint>
          Một lượt hết {a.duration}s — chỉ là nhịp mặc định, scene đè được. Trên không thì sân khấu
          treo con vật ở hông và không trôi ngang; scene đưa nó đi bằng <code>path</code>.
        </Hint>
      </Section>

      <Section title="JSON hành động">
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
                `${a.name || "animal-action"}.json`,
              )
            }
          >
            Tải về
          </Button>
        </div>
        <Textarea
          value={out}
          onChange={(e) => setOut(e.target.value)}
          placeholder="Xuất, hoặc dán JSON vào đây rồi bấm Áp dụng"
          className="h-32 font-mono text-[16px] md:text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onClick={() => setErr(p.onImport(out))}
        >
          Áp dụng JSON trong ô
        </Button>
        <Hint>
          Nút trên cùng mở lưới <code>actions/</code> của thư mục đang mở, chỉ những hành động của
          động vật; rê vào một ô là con vật đang mở diễn thử ô đó.
        </Hint>
      </Section>
    </div>
  );
}
