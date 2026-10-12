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
  actionDelta,
  actionMask,
  armFoldProblems,
  defaultAction,
  ARM_CHANNELS,
  ARM_LAYER_LABELS,
  ARM_LAYERS,
  CHANNEL_LABELS,
  equipSwitchProblems,
  CHANNELS,
  JOINT_CHANNELS,
  GENERATORS,
  genDefaults,
  BASE_ITEM,
  keyDelta,
  keyLayer,
  maskProblems,
  PIECE_KEYS,
  poseDelta,
  stretchJson,
  stretchSegs,
  torsoBend,
  POSES,
  keyFace,
  REACH_ELBOW,
  type ActionData,
  type ActionKey,
  type ArmLayer,
  type CharacterData,
  type Channel,
  type JointChannel,
  type EquipMap,
  type FaceState,
  type PieceKey,
  type PoseDelta,
} from "@stickman3d/sketch";
import { LayoutGrid } from "lucide-react";
import { Fragment, useState } from "react";
import { download } from "./bundle";
import { FacePicker } from "./FacePicker";
import { HIDDEN_PIECES, PIECE_LABELS } from "./pieces";
import {
  clearKeyReach,
  keyWrist,
  REACH_ARMS,
  setKeyReach,
  soloStack,
  spreadKeyPose,
  type ReachArm,
} from "./solo";
import type { ViewState } from "./view";

export type MutateAction = (fn: (a: ActionData) => void) => void;

interface ActionPanelProps {
  action: ActionData | null;
  mutate: MutateAction;
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
  sel: number;
  setSel: (i: number) => void;
  repoActions: string[];
  actionFile: string;
  /** Vật của nhân vật đang mở; hành động không biết ai diễn nên đây chỉ là gợi ý tên */
  items: { name: string; sockets: PieceKey[] }[];
  outfits: Record<string, EquipMap>;
  /** Nhân vật đang mở và track dưới: đổi tay theo góc sang theo đích cần cổ tay của chính người ấy */
  character: CharacterData;
  under: ActionData | null;
  writable: boolean;
  onSave: () => Promise<string>;
  /** Mở lưới hành động có thumbnail động */
  onPick: () => void;
  onImport: (text: string) => string | null;
  onNew: (a: ActionData) => void;
  onClose: () => void;
  exportJson: () => string;
}

/** Tên từng số của một kênh; `stretch` là hệ số dài chi */
const JOINTS: Record<JointChannel, string[]> = {
  armFar: ["vai", "khuỷu", "cổ tay", "dang"],
  armNear: ["vai", "khuỷu", "cổ tay", "dang"],
  legFar: ["hông", "gối", "dang"],
  legNear: ["hông", "gối", "dang"],
  torso: ["cúi", "nghiêng"],
  head: ["nghiêng", "lắc", "gật"],
  stretch: [
    "tay xa trên",
    "tay xa dưới",
    "tay gần trên",
    "tay gần dưới",
    "đùi xa",
    "cẳng chân xa",
    "đùi gần",
    "cẳng chân gần",
  ],
};

/** Ba số của đích cổ tay và của hướng khuỷu, hệ thân; tầm kéo thường ngày, ô số gõ được ngoài tầm */
const REACH_AXES: { label: string; min: number; max: number }[] = [
  { label: "tiến", min: -130, max: 160 },
  { label: "xuống", min: -200, max: 120 },
  { label: "ra ngoài", min: -60, max: 140 },
];
const ELBOW_AXES = ["khuỷu tiến", "khuỷu xuống", "khuỷu ra"];

/** Số chỉ người 3D đọc (dang tay chân, nghiêng thân): chỉ hiện ở hành động `authoredAt: "side"` */
const SOLID_ONLY: Partial<Record<JointChannel, number>> = {
  armFar: 3,
  armNear: 3,
  legFar: 2,
  legNear: 2,
  torso: 1,
};

/** Quá `90°` thì mặt đã ra khỏi khối đầu; vai tới `±270°` để chọn được chiều quét qua đầu */
function range(c: JointChannel, j: number | null): [number, number] {
  if (c === "head") return [-90, 90];
  if (c === "stretch") return [0.5, 2.5];
  if ((c === "armFar" || c === "armNear") && j === 0) return [-270, 270];
  return [-180, 180];
}

/** Ô chọn giá trị không nội suy của một mốc; `keep` là giữ nguyên theo mốc trước */
function KeepSelect({
  label,
  keepLabel = "theo mốc trước",
  value,
  options,
  onChange,
}: {
  label: string;
  keepLabel?: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-2.5">
      <Label className="text-sm">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="keep">{keepLabel}</SelectItem>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ActionPanel(p: ActionPanelProps) {
  const { action: a, mutate, view, setView, sel, setSel } = p;
  const [out, setOut] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const newKeysAction = () => {
    p.onNew({
      ...defaultAction(),
      name: "hanh-dong-moi",
      duration: 1,
      gen: undefined,
      params: undefined,
      keys: [{ t: 0, pose: view.pose, ease: "linear" }],
    });
    setView({ scrub: 0 });
  };
  const newGenAction = () => {
    p.onNew(defaultAction());
    setView({ scrub: null });
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
        <Button size="sm" variant="secondary" className="flex-1" onClick={newGenAction}>
          Chu kỳ đi
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

  if (!a)
    return (
      <div className="p-4 pb-16">
        <h1 className="mb-3 text-sm font-semibold tracking-[.14em] text-amber-300 uppercase">
          Hành động
        </h1>
        {load}
        <Hint>
          Chưa có hành động — nhân vật đứng ở tư thế nền chọn dưới sân khấu. Nạp hoặc tạo mới thì
          chạy ngay.
        </Hint>
      </div>
    );

  const gen = a.gen ? GENERATORS[a.gen] : null;
  const live = mutate;
  const problems = [...equipSwitchProblems(a), ...armFoldProblems(a), ...maskProblems(a)];

  const key = a.keys?.[sel];
  const delta = key ? keyDelta(key) : {};
  // Mốc ghi khớp nào thì chỉnh khớp đó; mặt nạ của hành động cắt bớt lần nữa
  const mask = actionMask(a);
  const solid = a.authoredAt === "side";
  const rows: [JointChannel, number | null][] = key
    ? JOINT_CHANNELS.filter((c) => mask.includes(c) && delta[c] !== undefined).flatMap<
        [JointChannel, number | null]
      >((c) =>
        c === "torso" && !solid
          ? [[c, null]]
          : JOINTS[c]
              .map((_, j): [JointChannel, number] => [c, j])
              .filter(([, j]) => solid || j !== SOLID_ONLY[c]),
      )
    : [];

  const angle = (c: JointChannel, j: number | null) =>
    c === "torso"
      ? j === 1
        ? typeof delta.torso === "object"
          ? delta.torso[1]
          : 0
        : torsoBend(delta.torso ?? 0)
      : c === "stretch"
        ? delta.stretch
          ? stretchSegs(delta.stretch)[j ?? 0]
          : 1
        : (delta[c]?.[j ?? 0] ?? 0);

  const toggleMask = (c: Channel, on: boolean) =>
    live((d) => {
      const cur = new Set(mask);
      if (on) cur.add(c);
      else cur.delete(c);
      d.mask = CHANNELS.filter((x) => cur.has(x));
      // Bật thêm khớp thì mốc nào chưa ghi khớp đó lấy tạm tư thế đứng; `face` không có góc
      if (on && c !== "face")
        for (const k of d.keys ?? [])
          if (typeof k.pose !== "string" && (k.pose as PoseDelta)[c] === undefined)
            Object.assign(k.pose, { [c]: poseDelta(POSES.idle)[c] });
    });

  // Nướng bộ sinh thành mốc: đường ra cho hành động "gần như gen nhưng lệch một tí"
  const bakeGen = () => {
    const n = 8;
    const round = (v: number | null) => (v === null ? v : +v.toFixed(2));
    const keys = Array.from({ length: n }, (_, i) => {
      const d = actionDelta(a, i / n);
      const pose = Object.fromEntries(
        Object.entries(d).map(([c, v]) => [c, typeof v === "number" ? round(v) : v.map(round)]),
      );
      return { t: +(i / n).toFixed(3), pose, ease: "linear" as const };
    });
    mutate((d) => {
      d.keys = keys;
      d.gen = undefined;
      d.params = undefined;
    });
    setSel(0);
  };

  const setLayer = (c: (typeof ARM_CHANNELS)[number], v: ArmLayer | undefined) =>
    live((d) => {
      const k = d.keys![sel];
      const l = { ...k.layer, [c]: v };
      if (!v) delete l[c];
      k.layer = Object.keys(l).length ? l : undefined;
    });

  const setFace = <K extends keyof FaceState>(f: K, v: FaceState[K] | undefined) =>
    live((d) => {
      const k = d.keys![sel];
      const face = { ...k.face, [f]: v };
      if (v === undefined) delete face[f];
      k.face = Object.keys(face).length ? face : undefined;
    });

  /**
   * Studio chỉ soạn dạng map socket → vật; bộ đồ thì trải ra thành map ngay, để một file
   * hành động không bao giờ có hai hình dạng cho cùng một chuyện.
   */
  const keyEquipMap = (k: ActionKey): EquipMap =>
    k.equip && typeof k.equip === "object" && !Array.isArray(k.equip) ? k.equip : {};

  const setEquip = (k: PieceKey, v: string | null | undefined) =>
    live((d) => {
      const key = d.keys![sel];
      const equip = { ...keyEquipMap(key), [k]: v };
      if (v === undefined) delete equip[k];
      key.equip = Object.keys(equip).length ? equip : undefined;
    });

  const wearOutfit = (name: string) =>
    live((d) => {
      const key = d.keys![sel];
      key.equip = { ...keyEquipMap(key), ...(p.outfits[name] ?? {}) };
    });

  // Chỉ liệt kê socket đã có mốc nào nhắc tới; còn lại thêm bằng ô dưới
  const touched = PIECE_KEYS.filter((k) => a.keys?.some((x) => keyEquipMap(x)[k] !== undefined));

  const setAngle = (c: JointChannel, j: number | null, v: number) =>
    live((d) => {
      const pose = spreadKeyPose(d, d.keys![sel]);
      if (c === "torso") {
        const cur = pose.torso ?? 0;
        const [bend, lean] =
          j === 1 ? [torsoBend(cur), v] : [v, typeof cur === "object" ? cur[1] : 0];
        pose.torso = lean ? [bend, lean] : bend;
      } else if (c === "stretch") {
        const cur = stretchSegs(pose.stretch ?? poseDelta(POSES.idle).stretch);
        cur[j ?? 0] = v;
        pose.stretch = stretchJson(cur);
      } else {
        const cur = [...(pose[c] ?? poseDelta(POSES.idle)[c])];
        cur[j ?? 0] = v;
        // Dang `0` thì bỏ số ấy, file giữ dạng ngắn
        if (j === SOLID_ONLY[c] && !v) cur.length = j;
        Object.assign(pose, { [c]: cur });
      }
    });

  // Góc đầu `null` không ghi: nghiêng đầu khi nói mà giữ cái lắc của track khác
  const setHeadFree = (j: number, free: boolean) =>
    live((d) => {
      const pose = spreadKeyPose(d, d.keys![sel]);
      const cur = [...(pose.head ?? poseDelta(POSES.idle).head)] as NonNullable<PoseDelta["head"]>;
      cur[j] = free ? null : 0;
      pose.head = cur;
    });

  const reachArms = solid && key ? REACH_ARMS.filter((c) => mask.includes(c)) : [];
  const setReachAxis = (ch: ReachArm, i: number, v: number) =>
    live((d) => {
      const r = d.keys![sel].reach![ch]!;
      r.at = r.at.map((x, j) => (j === i ? v : x)) as typeof r.at;
    });
  const setElbow = (ch: ReachArm, i: number | null, v: number) =>
    live((d) => {
      const r = d.keys![sel].reach![ch]!;
      if (i === null) {
        if (v) r.elbow = [...REACH_ELBOW];
        else delete r.elbow;
      } else r.elbow = (r.elbow ?? REACH_ELBOW).map((x, j) => (j === i ? v : x)) as typeof r.at;
    });
  const toReach = (ch: ReachArm) => {
    const at = keyWrist(p.character, soloStack(a, p.under), a, key!, ch, view.equip);
    live((d) => setKeyReach(d, d.keys![sel], ch, at));
  };

  const reachEl = reachArms.map((ch) => {
    const r = key!.reach?.[ch];
    return (
      <div key={ch} className="mb-2.5 rounded border p-2 pb-0">
        <Label className="mb-2 block text-sm">Đích cổ tay {CHANNEL_LABELS[ch]}</Label>
        {r ? (
          <>
            {REACH_AXES.map((x, i) => (
              <SliderRow
                key={x.label}
                label={x.label}
                value={r.at[i]}
                min={x.min}
                max={x.max}
                step={0.5}
                onChange={(v) => setReachAxis(ch, i, v)}
              />
            ))}
            <CheckRow
              label="Hướng khuỷu riêng"
              checked={!!r.elbow}
              onChange={(v) => setElbow(ch, null, v ? 1 : 0)}
            />
            {r.elbow?.map((v, i) => (
              <SliderRow
                key={ELBOW_AXES[i]}
                label={ELBOW_AXES[i]}
                value={v}
                min={-1}
                max={1}
                step={0.05}
                onChange={(x) => setElbow(ch, i, x)}
              />
            ))}
            <Button
              size="sm"
              variant="outline"
              className="mb-2 w-full"
              onClick={() => live((d) => clearKeyReach(d, d.keys![sel], ch))}
            >
              Bỏ đích, về góc
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" className="mb-2 w-full" onClick={() => toReach(ch)}>
            Theo đích cổ tay
          </Button>
        )}
      </div>
    );
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
        <Hint>Dùng chung cho mọi nhân vật; scene ghép tên nhân vật với tên hành động.</Hint>
        <div className="mt-2 flex gap-2">
          {gen && (
            <Button size="sm" variant="secondary" className="flex-1" onClick={bakeGen}>
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
              value={a.params?.[g.key] ?? g.def}
              min={g.min}
              max={g.max}
              step={g.step ?? 1}
              onChange={(v) =>
                live((d) => {
                  d.params = { ...genDefaults(a.gen!), ...d.params, [g.key]: v };
                })
              }
            />
          ))}
        </Section>
      )}

      {key && (
        <Section title={`Mốc ${sel + 1}/${a.keys!.length} — t = ${key.t.toFixed(2)}`}>
          {rows.length === 0 && !Object.keys(keyFace(key)).length && (
            <p className="text-sm text-muted-foreground">
              Mốc này không ghi khớp nào trong mặt nạ.
            </p>
          )}
          <Select
            value={key.ease}
            onValueChange={(v) => live((d) => (d.keys![sel].ease = v as ActionKey["ease"]))}
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
          {reachEl}
          {reachEl.length > 0 && (
            <Hint>
              Đích hệ thân: gốc tâm hông, đơn vị rig ở chiều cao 1; tiến theo hướng mặt, xuống là
              dương, ra ngoài về phía chính tay ấy. Kéo chấm tròn trên sân khấu cũng ghi vào đây;
              hướng khuỷu bỏ trống là mặc định của rig. Tay theo đích không còn góc ở mốc này —
              người 2D vẽ góc suy từ đích.
            </Hint>
          )}
          {rows.map(([c, j]) => {
            const label = `${CHANNEL_LABELS[c]}${j === null ? "" : " " + JOINTS[c][j]}`;
            const free = c === "head" && delta.head?.[j ?? 0] === null;
            return (
              <Fragment key={`${c}${j}`}>
                {!free && (
                  <SliderRow
                    label={label}
                    value={angle(c, j)}
                    min={range(c, j)[0]}
                    max={range(c, j)[1]}
                    step={c === "stretch" ? 0.05 : 1}
                    onChange={(v) => setAngle(c, j, v)}
                  />
                )}
                {c === "head" && (
                  <CheckRow
                    label={`${label}: để track dưới giữ`}
                    checked={free}
                    onChange={(v) => setHeadFree(j ?? 0, v)}
                  />
                )}
              </Fragment>
            );
          })}
          {ARM_CHANNELS.filter((c) => mask.includes(c)).map((c) => (
            <KeepSelect
              key={c}
              label={`Lớp cẳng ${CHANNEL_LABELS[c]}`}
              keepLabel="theo pose / mốc trước"
              value={keyLayer(key)[c] ?? "keep"}
              options={ARM_LAYERS.map((l) => [l, ARM_LAYER_LABELS[l]])}
              onChange={(v) => setLayer(c, v === "keep" ? undefined : (v as ArmLayer))}
            />
          ))}
          {mask.includes("face") && (
            <div className="mb-2.5">
              <Label className="text-sm">Nét mặt</Label>
              <FacePicker
                className="mt-1"
                value={keyFace(key)}
                blank={{ mouth: "theo mốc trước", brow: "theo mốc trước", eyes: "theo mốc trước" }}
                onChange={(f, k) => setFace(f, k)}
              />
              <div className="mt-2">
                <CheckRow
                  label="Má ửng: ghi ở mốc này"
                  checked={keyFace(key).blush !== undefined}
                  onChange={(v) => setFace("blush", v ? 0 : undefined)}
                />
                {keyFace(key).blush !== undefined && (
                  <SliderRow
                    label="Má ửng thêm"
                    value={keyFace(key).blush ?? 0}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => setFace("blush", v)}
                  />
                )}
              </div>
            </div>
          )}
          {touched.map((k) => (
            <KeepSelect
              key={k}
              label={`Socket ${PIECE_LABELS[k]}`}
              value={keyEquipMap(key)[k] === undefined ? "keep" : (keyEquipMap(key)[k] ?? "-")}
              options={[
                ["-", "để trống"],
                [BASE_ITEM, "mảnh nền"],
                ...p.items
                  .filter((n) => n.sockets.includes(k))
                  .map((n): [string, string] => [n.name, n.name]),
              ]}
              onChange={(v) => setEquip(k, v === "keep" ? undefined : v === "-" ? null : v)}
            />
          ))}
          <Select value="" onValueChange={(v) => setEquip(v as PieceKey, null)}>
            <SelectTrigger className="mb-2.5 w-full">
              <SelectValue placeholder="Đổi đồ ở thêm một socket…" />
            </SelectTrigger>
            <SelectContent>
              {PIECE_KEYS.filter((k) => !touched.includes(k) && !HIDDEN_PIECES.includes(k)).map(
                (k) => (
                  <SelectItem key={k} value={k}>
                    {PIECE_LABELS[k]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <Hint>
            Kéo chấm trên dải mốc dưới sân khấu để chọn mốc khác, hoặc bấm Xem mốc để thấy cả dải
            thành hình. Lớp và nét mặt không nội suy — đổi là đổi ngay từ mốc này; cánh tay trên giữ
            nguyên lớp.
          </Hint>
          {!!Object.keys(p.outfits).length && (
            <Select value="" onValueChange={wearOutfit}>
              <SelectTrigger className="mb-2.5 w-full">
                <SelectValue placeholder="Mặc cả bộ đồ…" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(p.outfits).map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Hint>
            Đổi đồ là công tắc: mốc nào đổi thì giữ nguyên tới khi có mốc khác nói khác, kể cả sang
            clip sau ở scene. Mũ đội lên đầu là để trống socket tay, cắm vật ấy vào socket mũ. Tên
            vật là tên trong JSON nhân vật, danh sách đây lấy của nhân vật đang mở.
          </Hint>
        </Section>
      )}

      <Section title="Người 3D">
        <CheckRow
          label="Soạn ở góc nghiêng cho người 3D"
          checked={solid}
          onChange={(v) =>
            live((d) => {
              d.authoredAt = v ? "side" : undefined;
            })
          }
        />
        <Hint>
          {solid
            ? "Người 3D đọc góc tay chân như soạn ở góc nghiêng — tiến theo hướng mặt, lên theo trục đứng — rồi chiếu thật. Sân khấu là người 3D: kéo để xoay hướng và góc cúi, Shift + kéo để dời khung; chấm tròn ở cổ tay kéo đích tay của mốc đang chọn. Người 2D vẫn vẽ góc như cũ."
            : "Tắt thì hành động giữ 2D: người 3D vẽ góc trên mặt khung, đúng như người 2D."}
        </Hint>
      </Section>

      <Section title="Khớp hành động ghi">
        {CHANNELS.map((c) => (
          <CheckRow
            key={c}
            label={CHANNEL_LABELS[c]}
            checked={mask.includes(c)}
            onChange={(v) => toggleMask(c, v)}
          />
        ))}
        <Hint>Khớp không tick thì hành động khác chồng lên được, chỗ đó nó không ghi.</Hint>
      </Section>

      <Section title="Nhịp">
        <SliderRow
          label="Thời lượng"
          value={a.duration}
          min={0.2}
          max={3}
          step={0.02}
          onChange={(v) => live((d) => (d.duration = +v.toFixed(2)))}
        />
        <CheckRow
          label="Nối vòng ở cuối chu kỳ"
          checked={a.end === "wrap"}
          onChange={(v) => mutate((d) => (d.end = v ? "wrap" : "hold"))}
        />
        <Hint>
          Một lượt hết {a.duration}s — chỉ là nhịp mặc định, scene đè được. Tắt nối vòng thì giữ
          nguyên mốc cuối cho tới hết lượt.
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
                `${a.name || "action"}.json`,
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
          Nút trên cùng mở lưới <code>actions/</code> của thư mục đang mở, rê vào một ô là nhân vật
          đang mở diễn thử ô đó; nút Nạp file lấy file từ máy.
        </Hint>
      </Section>
    </div>
  );
}
