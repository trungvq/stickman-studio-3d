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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CheckRow, ColorRow, Hint, Section, SliderRow } from "@/components/controls";
import {
  BASE_ITEM,
  type Beard,
  BEARD_PRESETS,
  BEARD_TIPS,
  beardPresetOf,
  BeardSchema,
  type BeardTip,
  equipPieces,
  HEAD_KEYS,
  HEAD_SHAPES,
  MOUSTACHE_KINDS,
  mix,
  torsoPaths,
  PARTS,
  pieceDir,
  pieceFile,
  piecePart,
  viewTuned,
  wornPiece,
  wornTune,
  type CharacterData,
  type EquipMap,
  type SocketPiece,
  type HeadShape,
  type MoustacheKind,
  type PieceCatalogEntry,
  type PieceKey,
  type PieceUrls,
  type Glasses,
  GLASSES_PRESETS,
  GLASSES_SHAPES,
  glassesPresetOf,
  GlassesSchema,
  type GlassesShape,
  type Garment,
  garmentOf,
  GARMENT_STYLES,
  type Sculpt,
  type Skirt,
  skirtOf,
  SCULPT_PRESETS,
  SCULPT_STYLES,
  sculptPresetOf,
  SculptSchema,
  type WrinkleKind,
  WRINKLE_KINDS,
  limbWidths,
} from "@stickman3d/sketch";
import { BookmarkCheck, FolderOpen, Images, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { viewsOf, type ViewState } from "./view";
import { download } from "./bundle";
import { PIECE_LABELS, PIECE_NOTES, PIECE_SCALE, PIECE_SHIFT, PIECE_WIDTH } from "./pieces";
import { FacePicker } from "./FacePicker";

const HEAD_LABELS: Record<HeadShape, string> = {
  round: "tròn",
  square: "vuông",
  trapezoid: "hình thang",
};

const MOUSTACHE_LABELS: Record<MoustacheKind, string> = {
  none: "không",
  short: "ria ngắn",
  long: "ria dài rủ",
  pencil: "ria mảnh",
  chevron: "ria chữ V",
  handlebar: "ria cong vểnh",
  walrus: "ria hải mã",
  horseshoe: "ria móng ngựa",
};

/** Tầm kéo thường ngày của từng số trong `SculptSchema`; số đo theo bán kính sọ hiện theo phần trăm */
type SculptNum = { [K in keyof Sculpt]: Sculpt[K] extends number ? K : never }[keyof Sculpt];
const SCULPT_ROWS: { key: SculptNum; label: string; min: number; max: number; pct?: true }[] = [
  { key: "front", label: "Trán", min: 0, max: 75 },
  { key: "ear", label: "Trên tai", min: -20, max: 50 },
  { key: "nape", label: "Gáy", min: -80, max: 20 },
  { key: "sideburn", label: "Tóc mai", min: -40, max: 30 },
  { key: "part", label: "Ngôi", min: -90, max: 90 },
  { key: "fringe", label: "Mái rủ", min: 0, max: 40 },
  { key: "volume", label: "Phồng", min: 0, max: 30, pct: true },
  { key: "bang", label: "Mái lệch", min: 0, max: 45 },
  { key: "bangTo", label: "Hất về", min: -90, max: 90 },
  { key: "bangThick", label: "Dày mái", min: 0, max: 30, pct: true },
  { key: "length", label: "Dài", min: 0, max: 300, pct: true },
  { key: "spike", label: "Gai", min: 0, max: 200, pct: true },
];

/** Số của vành tóc, chỉ hiện với kiểu hói */
const CROWN_ROWS: typeof SCULPT_ROWS = [
  { key: "crownSide", label: "Vành bên", min: -10, max: 80 },
  { key: "crownBack", label: "Vành gáy", min: -10, max: 85 },
  { key: "crownFrom", label: "Mũi vành", min: 0, max: 150 },
  { key: "crownEase", label: "Thon mũi", min: 1, max: 60 },
];

/** Thanh riêng của kiểu tóc: vành hói, chỗ buộc đuôi ngựa và búi */
const styleRows = (style: Sculpt["style"]): typeof SCULPT_ROWS => {
  const def = SCULPT_STYLES[style];
  return [
    ...(def.crown ? CROWN_ROWS : []),
    ...(def.pony || def.bun ? [{ key: "tie" as const, label: "Chỗ buộc", min: -40, max: 90 }] : []),
    ...(def.pony
      ? [{ key: "tail" as const, label: "Dài đuôi", min: 30, max: 300, pct: true as const }]
      : []),
  ];
};

/** Tầm kéo của từng số trong `GlassesSchema`, theo phần trăm bán kính sọ; `thick` theo phần trăm nét viền */
type GlassesNum = { [K in keyof Glasses]: Glasses[K] extends number ? K : never }[keyof Glasses];
const GLASSES_ROWS: { key: GlassesNum; label: string; min: number; max: number }[] = [
  { key: "size", label: "Cỡ", min: 8, max: 40 },
  { key: "spread", label: "Giãn", min: -10, max: 20 },
  { key: "rise", label: "Cao", min: -20, max: 20 },
  { key: "stand", label: "Cách mắt", min: 0, max: 30 },
  { key: "thick", label: "Gọng", min: 15, max: 120 },
];

/** Tầm kéo của từng số trong `BeardSchema`: góc theo độ, số đo theo bán kính sọ hiện theo phần trăm */
type BeardNum = { [K in keyof Beard]: Beard[K] extends number ? K : never }[keyof Beard];
const BEARD_ROWS: { key: BeardNum; label: string; min: number; max: number; pct?: true }[] = [
  { key: "reach", label: "Mép sau", min: 10, max: 120 },
  { key: "burn", label: "Tóc mai", min: -30, max: 40 },
  { key: "cheek", label: "Mép má", min: -40, max: 30 },
  { key: "gap", label: "Chừa mồm", min: -20, max: 40 },
  { key: "notch", label: "Rộng khấc", min: 0, max: 50 },
  { key: "soft", label: "Thành khấc", min: 0, max: 30 },
  { key: "lip", label: "Dải ria", min: 0, max: 20 },
  { key: "lipWidth", label: "Rộng ria", min: 0, max: 60 },
  { key: "lipRise", label: "Ria cao", min: -10, max: 20 },
  { key: "round", label: "Bo hai đầu", min: 0, max: 40 },
  { key: "shave", label: "Cạo cằm", min: 0, max: 90, pct: true },
  { key: "bulk", label: "Dày", min: 0, max: 25, pct: true },
  { key: "length", label: "Dài rủ", min: 0, max: 150, pct: true },
];

const BEARD_TIP_LABELS: Record<BeardTip, string> = {
  round: "tròn",
  point: "nhọn",
  square: "vuông",
  fork: "chẻ đôi",
};

/** Tầm kéo của từng số thân áo dựng khối, px; `fit` theo phần trăm. Vát vai là `cladSlope` khi bật `palette.clad` */
type GarmentNum = Exclude<keyof Garment, "style" | "wrap" | "prints" | "badge">;
const GARMENT_ROWS: { key: GarmentNum; label: string; min: number; max: number; pct?: true }[] = [
  { key: "ease", label: "Rộng thêm", min: -5, max: 20 },
  { key: "fit", label: "Suông", min: 0, max: 150, pct: true },
  { key: "waist", label: "Eo", min: 0, max: 12 },
  { key: "hem", label: "Gấu", min: -40, max: 60 },
  { key: "rise", label: "Mép trên", min: -15, max: 15 },
  { key: "neck", label: "Cổ rộng", min: 6, max: 30 },
  { key: "neckFront", label: "Cổ trước", min: -10, max: 90 },
  { key: "neckBack", label: "Cổ sau", min: -10, max: 30 },
  { key: "slope", label: "Vát vai", min: 30, max: 150, pct: true },
  { key: "cladSlope", label: "Vát vai", min: 30, max: 150, pct: true },
  { key: "round", label: "Bo vai", min: 0, max: 30 },
  { key: "hemRound", label: "Bo gấu", min: 0, max: 20 },
];

const SKIRT_ROWS: {
  key: Exclude<keyof Skirt, "style" | "wrap" | "apron">;
  label: string;
  min: number;
  max: number;
}[] = [
  { key: "rise", label: "Cạp cao", min: 0, max: 60 },
  { key: "waist", label: "Cạp rộng", min: 20, max: 60 },
  { key: "length", label: "Dài", min: 20, max: 220 },
  { key: "flare", label: "Xoè", min: -20, max: 60 },
  { key: "pleats", label: "Nếp", min: 0, max: 16 },
];

const GLASSES_SHAPE_LABELS: Record<GlassesShape, string> = {
  round: "tròn",
  rect: "chữ nhật",
};

const WRINKLE_LABELS: Record<WrinkleKind, string> = {
  none: "không",
  light: "nhẹ — chân chim, một nếp trán",
  deep: "sâu — thêm túi mắt và pháp lệnh",
};

export type Mutate = (fn: (c: CharacterData) => void) => void;

interface PanelProps {
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
  character: CharacterData;
  mutate: Mutate;
  urls: PieceUrls;
  /** Danh mục `pieces/catalog.json`, mọi socket */
  catalog: PieceCatalogEntry[];
  pieceUrl: (file: string) => Promise<string>;
  repoCharacters: string[];
  characterFile: string;
  /** Tên thư mục đang mở, hoặc bộ mẫu đi kèm studio */
  workspace: string;
  writable: boolean;
  canOpenDirectory: boolean;
  /** Mảnh đang chọn trên sân khấu */
  selected: PieceKey | null;
  onSelect: (k: PieceKey | null) => void;
  /** Mở modal chọn mảnh cho một socket; modal do App dựng */
  onPick: (k: PieceKey) => void;
  onPieceFile: (k: PieceKey, file: File) => void;
  onPieceRepo: (k: PieceKey, entry: PieceCatalogEntry) => void;
  onClearPiece: (k: PieceKey) => void;
  onPiecePart: (k: PieceKey, name: string) => void;
  /** Ghi căn hiện tại của mảnh làm mặc định lúc cắm vào `pieces/catalog.json`; trả câu báo */
  onSavePieceConfig: (k: PieceKey) => Promise<string>;
  onLoadRepo: (file: string) => Promise<string | null>;
  onOpenDirectory: () => Promise<string | null>;
  onCloseDirectory: () => void;
  onSave: () => Promise<string>;
  onImport: (text: string) => string | null;
  exportJson: () => string;
  onExportBundle: () => Promise<void>;
  onImportBundle: (file: File) => Promise<string | null>;
}

export function Panel(p: PanelProps) {
  const { character: c, mutate } = p;
  const { rig, palette, face } = c;
  // Cột này chỉnh thứ đang mặc: mảnh của vật nếu socket đang đeo vật, không thì mảnh nền
  const pieces = equipPieces(c, p.view.equip);
  const at = (d: CharacterData, k: PieceKey) => wornPiece(d, p.view.equip, k) as SocketPiece;
  const views = viewsOf(p.view);
  const tune = (d: CharacterData, k: PieceKey) => wornTune(d, p.view.equip, k, views, true);
  const [out, setOut] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<{ k: PieceKey; msg: string; bad?: boolean } | null>(null);
  const [newItem, setNewItem] = useState("");
  const [newOutfit, setNewOutfit] = useState("");
  const items = Object.entries(c.items);
  // Chọn mảnh trên sân khấu thì mở đúng tab của nó, tới khi người dùng tự đổi tab
  const sel = p.selected;
  const [tabAt, setTab] = useState<{ tab: string; from: PieceKey | null }>({
    tab: "body",
    from: null,
  });
  const faceTab = (k: PieceKey) => k === "chin" || k === "faceAcc";
  const tab = sel && sel !== tabAt.from ? (faceTab(sel) ? "face" : "pieces") : tabAt.tab;

  useEffect(() => {
    if (!sel) return;
    const raf = requestAnimationFrame(() =>
      document.getElementById(`piece-${sel}`)?.scrollIntoView({ block: "nearest" }),
    );
    return () => cancelAnimationFrame(raf);
  }, [sel]);

  const sculpted = pieces.hair.src === "sculpt";
  const sculpt = SculptSchema.parse(pieces.hair.sculpt ?? {});
  const glassy = pieces.faceAcc.src === "sculpt";
  const glasses = GlassesSchema.parse(pieces.faceAcc.glasses ?? {});
  const bearded = pieces.chin.src === "sculpt";
  const beard = BeardSchema.parse(pieces.chin.beard ?? {});
  const solidTorso = pieces.torso.src === "sculpt";
  const garment = garmentOf(pieces.torso.garment);
  const solidHem = pieces.hem.src === "sculpt";
  const skirt = skirtOf(pieces.hem.skirt);
  // Kiểu có mảng tô màu nhấn thì thẻ Thân áo mới có ô màu phụ
  const torsoAccent =
    solidTorso && torsoPaths(c, 0, c.rig.stroke).lines.some((l) => l.fill === "accent");
  const setGlasses = (fn: (g: Glasses) => void) =>
    mutate((d) => {
      const pc = at(d, "faceAcc");
      fn((pc.glasses = GlassesSchema.parse(pc.glasses ?? {})));
    });

  const setBeard = (fn: (b: Beard) => void) =>
    mutate((d) => {
      const pc = at(d, "chin");
      fn((pc.beard = BeardSchema.parse(pc.beard ?? {})));
    });

  const turnPreview = (
    <>
      <div className="mt-3 mb-2 text-xs font-medium text-muted-foreground">Xem thử đầu quay</div>
      <SliderRow
        label="Lắc"
        value={p.view.turn}
        min={-90}
        max={90}
        onChange={(v) => p.setView({ turn: v })}
      />
      <SliderRow
        label="Gật"
        value={p.view.nod}
        min={-45}
        max={45}
        onChange={(v) => p.setView({ nod: v })}
      />
      <CheckRow
        label="Tự lắc gật qua lại"
        checked={p.view.sway}
        onChange={(v) => p.setView({ sway: v })}
      />
      <Hint>
        Chỉ để xem, không lưu: cộng lên lắc gật của hành động đang chạy. Góc nhìn Thân / Đầu ở thanh
        dưới sân khấu.
      </Hint>
    </>
  );

  const piece = (k: PieceKey, extra?: React.ReactNode) => {
    const pc = pieces[k];
    // Tóc, kính, râu dựng khối không có hộp: dx … xoay và bộ chỉnh theo góc không có tác dụng
    const solid =
      (k === "hair" && sculpted) ||
      (k === "faceAcc" && glassy) ||
      (k === "chin" && bearded) ||
      (k === "torso" && solidTorso) ||
      (k === "hem" && solidHem);
    const tn = wornTune(c, p.view.equip, k, views);
    const kv = HEAD_KEYS.includes(k) ? views.head : views.body;
    const own = viewTuned(pieces, k, kv) ? kv : null;
    const file = pieceFile(pc);
    const part = piecePart(pc);
    const entries = p.catalog.filter((e) => e.socket === pieceDir(k));
    const savable = !!part || entries.some((e) => e.file === file);
    const preset = solid && k === "hair" && sculptPresetOf(pieces.hair.sculpt);
    const lens = solid && k === "faceAcc" && glassesPresetOf(pieces.faceAcc.glasses);
    const whisker = solid && k === "chin" && beardPresetOf(pieces.chin.beard);
    const label = solid
      ? k === "torso"
        ? GARMENT_STYLES[garment.style].label
        : k === "hem"
          ? "Váy dựng khối"
          : preset
            ? SCULPT_PRESETS[preset].label
            : lens
              ? GLASSES_PRESETS[lens].label
              : whisker
                ? BEARD_PRESETS[whisker].label
                : k === "hair"
                  ? "Tóc dựng khối — chỉnh tay"
                  : k === "chin"
                    ? "Râu dựng khối — chỉnh tay"
                    : "Kính dựng khối — chỉnh tay"
      : part
        ? (PARTS[part]?.label ?? `${part} — không có`)
        : file
          ? (entries.find((e) => e.file === file)?.name ?? file.slice(file.lastIndexOf("/") + 1))
          : "";
    return (
      <div
        key={k}
        id={`piece-${k}`}
        onPointerDown={() => p.onSelect(k)}
        className={cn(
          "mb-2.5 rounded border bg-muted/40 p-2.5",
          p.selected === k && "ring-2 ring-sky-500",
        )}
      >
        <div className="mb-2 text-sm font-semibold">
          {PIECE_LABELS[k]}
          {PIECE_NOTES[k] && (
            <span className="ml-1 font-normal text-muted-foreground">({PIECE_NOTES[k]})</span>
          )}
          {worn(k) && (
            <span className="ml-1 rounded bg-sky-900 px-1.5 py-0.5 font-normal text-sky-200">
              vật {worn(k)}
            </span>
          )}
        </div>
        <div className="mb-2 flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 justify-start font-mono text-xs"
            title={file}
            onClick={() => p.onPick(k)}
          >
            <Images className="text-muted-foreground" />
            <span className={cn("truncate", !label && "font-sans text-muted-foreground")}>
              {label || "Chưa có"}
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
          {savable && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-sky-300"
              title={
                p.writable
                  ? "Lưu căn này làm mặc định của kiểu — lần sau cắm kiểu này là nhận luôn"
                  : "Mở thư mục workspace mới lưu được mặc định"
              }
              disabled={!p.writable}
              onClick={() =>
                p.onSavePieceConfig(k).then(
                  (msg) => setSavedAt({ k, msg }),
                  (e: unknown) => setSavedAt({ k, msg: String(e), bad: true }),
                )
              }
            >
              <BookmarkCheck />
            </Button>
          )}
          {(file || part || solid) && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              title="Bỏ mảnh"
              onClick={() => p.onClearPiece(k)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
        {solid && (
          <div className={cn("mb-2", k === "torso" && torsoAccent && "grid grid-cols-2 gap-2")}>
            <ColorRow
              label={
                k === "hair"
                  ? "Màu tóc"
                  : k === "torso"
                    ? "Màu áo"
                    : k === "hem"
                      ? "Màu váy"
                      : k === "chin"
                        ? "Màu râu"
                        : glasses.tint
                          ? "Màu mắt kính"
                          : "Màu gọng"
              }
              value={pc.color ?? (k === "chin" ? face.moustache.color : palette.garment)}
              onChange={(v) => mutate((d) => (at(d, k).color = v))}
            />
            {k === "torso" && torsoAccent && (
              <ColorRow
                label="Màu phụ"
                value={pc.accent ?? mix(pc.color ?? palette.garment, "#000000", 0.3)}
                onChange={(v) => mutate((d) => (at(d, k).accent = v))}
              />
            )}
          </div>
        )}
        {part && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            <ColorRow
              label="Màu"
              value={pc.color ?? palette.garment}
              onChange={(v) => mutate((d) => (at(d, k).color = v))}
            />
            <ColorRow
              label="Màu phụ"
              value={pc.accent ?? mix(pc.color ?? palette.garment, "#000000", 0.3)}
              onChange={(v) => mutate((d) => (at(d, k).accent = v))}
            />
          </div>
        )}
        {file && !part && (
          <div className="mb-2">
            <CheckRow
              label="Tô màu"
              checked={pc.color !== undefined}
              onChange={(v) =>
                mutate((d) => (at(d, k).color = v ? (pc.color ?? "#2a1c15") : undefined))
              }
            />
            {pc.color !== undefined && (
              <ColorRow
                label="Màu"
                value={pc.color}
                onChange={(v) => mutate((d) => (at(d, k).color = v))}
              />
            )}
          </div>
        )}
        {savedAt?.k === k && (
          <div className={cn("mb-2 text-xs", savedAt.bad ? "text-destructive" : "text-sky-300")}>
            {savedAt.msg}
          </div>
        )}
        {own && !solid && (
          <Hint>Hình riêng của góc {own}: bộ chỉnh dưới đây chỉ áp cho góc này.</Hint>
        )}
        {!solid && (
          <>
            <SliderRow
              label="dx"
              value={tn.dx}
              min={-PIECE_SHIFT}
              max={PIECE_SHIFT}
              onChange={(v) => mutate((d) => (tune(d, k).dx = v))}
            />
            <SliderRow
              label="dy"
              value={tn.dy}
              min={-PIECE_SHIFT}
              max={PIECE_SHIFT}
              onChange={(v) => mutate((d) => (tune(d, k).dy = v))}
            />
            <SliderRow
              label="scale"
              value={Math.round(tn.scale * 100)}
              min={PIECE_SCALE.min * 100}
              max={PIECE_SCALE.max * 100}
              onChange={(v) => mutate((d) => (tune(d, k).scale = v / 100))}
            />
            <SliderRow
              label="bề ngang"
              value={Math.round(tn.widthScale * 100)}
              min={PIECE_WIDTH.min * 100}
              max={PIECE_WIDTH.max * 100}
              onChange={(v) => mutate((d) => (tune(d, k).widthScale = v / 100))}
            />
            <SliderRow
              label="xoay"
              value={tn.rotate}
              min={-180}
              max={180}
              onChange={(v) => mutate((d) => (tune(d, k).rotate = v))}
            />
          </>
        )}
        {extra}
      </div>
    );
  };

  /** Tên vật đang chiếm socket, nếu có — mọi chỉnh tay ở ô mảnh sẽ ghi vào vật ấy */
  function worn(k: PieceKey) {
    const name = p.view.equip[k];
    return name && name !== BASE_ITEM ? name : null;
  }

  const wear = (k: PieceKey, name: string | null | undefined) => {
    const equip: EquipMap = { ...p.view.equip };
    if (name === undefined) delete equip[k];
    else equip[k] = name;
    p.setView({ equip });
  };

  /** Chuyển mảnh đang cắm ở socket thành một vật gọi tên được, rồi mặc luôn nó */
  const detach = (k: PieceKey, name: string) => {
    mutate((d) => {
      const src = structuredClone(wornPiece(d, p.view.equip, k)) as SocketPiece;
      d.items[name] = { ...d.items[name], [k]: src };
      // Mảnh nền trả về trống: từ giờ socket này do `equip` gọi vật ra
      const base = d.pieces[k];
      base.src = "none";
      delete base.file;
      delete base.part;
    });
    wear(k, name);
  };

  const renameItem = (from: string, to: string) => {
    if (!to || to === from || c.items[to]) return;
    mutate((d) => {
      d.items = Object.fromEntries(
        Object.entries(d.items).map(([n, it]) => [n === from ? to : n, it]),
      );
      for (const o of Object.values(d.outfits))
        for (const k of Object.keys(o) as PieceKey[]) if (o[k] === from) o[k] = to;
    });
    p.setView({
      equip: Object.fromEntries(
        Object.entries(p.view.equip).map(([k, v]) => [k, v === from ? to : v]),
      ),
    });
  };

  return (
    <div className="p-4 pb-16">
      <h1 className="mb-3 text-sm font-semibold tracking-[.14em] text-sky-300 uppercase">
        Character Studio
      </h1>

      <Section title="Nhân vật">
        <Label className="text-sm">Tên</Label>
        <Input
          value={c.name}
          onChange={(e) => mutate((d) => (d.name = e.target.value))}
          className="mt-1"
        />
      </Section>

      <Tabs value={tab} onValueChange={(v) => setTab({ tab: v, from: sel })}>
        <TabsList className="w-full">
          <TabsTrigger value="body">Thân</TabsTrigger>
          <TabsTrigger value="pieces">Mảnh ảnh</TabsTrigger>
          <TabsTrigger value="items">Đồ</TabsTrigger>
          <TabsTrigger value="face">Mặt</TabsTrigger>
          <TabsTrigger value="color">Màu</TabsTrigger>
        </TabsList>
        <TabsContent value="body">
          <Section title="Đầu">
            <Select
              value={c.head.shape}
              onValueChange={(v) => mutate((d) => (d.head.shape = v as HeadShape))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEAD_SHAPES.map((h) => (
                  <SelectItem key={h} value={h}>
                    {HEAD_LABELS[h]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-2">
              <SliderRow
                label="Rộng"
                value={Math.round(c.head.scaleX * 100)}
                min={50}
                max={160}
                onChange={(v) => mutate((d) => (d.head.scaleX = v / 100))}
              />
              <SliderRow
                label="Cao"
                value={Math.round(c.head.scaleY * 100)}
                min={50}
                max={160}
                onChange={(v) => mutate((d) => (d.head.scaleY = v / 100))}
              />
              <SliderRow
                label="dx"
                value={c.head.dx}
                min={-40}
                max={40}
                onChange={(v) => mutate((d) => (d.head.dx = v))}
              />
              <SliderRow
                label="dy"
                value={c.head.dy}
                min={-40}
                max={40}
                onChange={(v) => mutate((d) => (d.head.dy = v))}
              />
            </div>
          </Section>
          <Section title="Tỉ lệ">
            <SliderRow
              label="Chiều cao"
              value={Math.round(rig.height * 100)}
              min={50}
              max={160}
              onChange={(v) => mutate((d) => (d.rig.height = v / 100))}
            />
            <Hint>Kéo dài cả thân, tay và chân. Đầu giữ nguyên, chỉnh riêng ở Đầu.</Hint>
            <SliderRow
              label="Rộng vai"
              value={rig.shoulderHalf}
              min={0}
              max={100}
              onChange={(v) => mutate((d) => (d.rig.shoulderHalf = v))}
            />
            <SliderRow
              label="Vai tụt"
              value={rig.shoulderDrop}
              min={-20}
              max={60}
              onChange={(v) => mutate((d) => (d.rig.shoulderDrop = v))}
            />
            <Hint>Nửa khoảng cách hai khớp vai, và khớp vai nằm dưới đỉnh thân bao nhiêu.</Hint>
            <SliderRow
              label="Rộng hông"
              value={rig.hipHalf}
              min={0}
              max={80}
              onChange={(v) => mutate((d) => (d.rig.hipHalf = v))}
            />
          </Section>
        </TabsContent>
        <TabsContent value="pieces">
          <Section title="Mảnh ảnh">
            <Hint>
              Tô màu chỉ dùng được với ảnh mực — ruột trắng, nét đen; ảnh nhiều màu thì tắt. Xoay
              quanh tâm hộp, riêng đồ cầm tay quanh bàn tay.
            </Hint>
            {piece("crown")}
            {piece("headAcc")}
            <Hint>
              Sừng, tai, vòng hoa — vẽ trên cả mũ và bám sọ, không trôi theo mặt khi lắc. Kính, sẹo
              thì cắm ở tab Mặt.
            </Hint>
            {piece(
              "hair",
              sculpted ? (
                <>
                  {[...SCULPT_ROWS, ...styleRows(sculpt.style)].map(
                    ({ key, label, min, max, pct }) => (
                      <SliderRow
                        key={key}
                        label={label}
                        value={pct ? Math.round(sculpt[key] * 100) : sculpt[key]}
                        min={min}
                        max={max}
                        onChange={(v) =>
                          mutate((d) => {
                            const s = (d.pieces.hair.sculpt = SculptSchema.parse(
                              d.pieces.hair.sculpt ?? {},
                            ));
                            s[key] = pct ? v / 100 : v;
                          })
                        }
                      />
                    ),
                  )}
                  <Hint>
                    Trán, trên tai, gáy, tóc mai là vĩ độ chân tóc trên sọ, độ — lớn hơn là chân tóc
                    lùi lên. Ngôi là kinh độ đường ngôi, dương về +x; mái rủ xuống phía bên kia
                    ngôi. Mái lệch chéo từ ngôi xuống kinh độ Hất về, sâu bấy nhiêu độ dưới chân
                    tóc. Phồng, dày mái, dài, gai là phần trăm bán kính sọ; dài là đuôi tóc dưới tâm
                    đầu, 0 là tóc ngắn, 150 là ngang vai. Gai là nón nhọn dựng khỏi vỏ, rải đều nửa
                    trên sọ, có gai thì không vẽ ngôi. Mẫu chọn ở ô Tóc; chỉnh tay thì thẻ ghi chỉnh
                    tay.
                  </Hint>
                  {SCULPT_STYLES[sculpt.style].crown && (
                    <Hint>
                      Kiểu hói chỉ còn vành tóc. Vành bên, vành gáy là vĩ độ mép trên vành — lớn hơn
                      là chỗ hói nhỏ lại. Mũi vành là kinh độ vành bắt đầu, tính từ giữa mặt: nhỏ
                      hơn là tóc vòng ra trước, còn hói trán. Thon mũi là mũi vành dài hay cụt.
                    </Hint>
                  )}
                  {(SCULPT_STYLES[sculpt.style].pony || SCULPT_STYLES[sculpt.style].bun) && (
                    <Hint>
                      Chỗ buộc là vĩ độ sau gáy, độ: 60 trở lên là buộc cao, quanh 0 là buộc thấp ở
                      gáy. Dài đuôi là phần trăm bán kính sọ tính từ chỗ buộc xuống, đuôi luôn rủ
                      theo trọng lực.
                    </Hint>
                  )}
                  {turnPreview}
                </>
              ) : (
                <>
                  <CheckRow
                    label="Cắt theo bao đầu"
                    checked={pieces.hair.clip}
                    onChange={(v) => mutate((d) => (at(d, "hair").clip = v))}
                  />
                  {pieces.hair.clip && (
                    <SliderRow
                      label="bao nở"
                      value={Math.round(pieces.hair.clipGrow * 100)}
                      min={100}
                      max={160}
                      onChange={(v) => mutate((d) => (at(d, "hair").clipGrow = v / 100))}
                    />
                  )}
                </>
              ),
            )}
            {sculpted ? (
              <Hint>
                Tóc dựng khối quay theo đầu ở mọi góc, một bộ số cho cả chính diện, nghiêng, 3/4 sau
                và sau lưng; nét mặt chính diện khi ấy lắc gật theo góc thật.
              </Hint>
            ) : (
              <>
                <Hint>
                  Bao đầu chặn hai bên và đỉnh, mở thẳng xuống dưới tâm đầu. Kéo bao nở lên cho tóc
                  phồng; 100 là đúng viền đầu.
                </Hint>
                <Hint>
                  Kiểu tóc vẽ đủ mọi góc; chính diện có thêm lớp sau thân, dùng chung bộ chỉnh với
                  lớp trên.
                </Hint>
              </>
            )}
            {pieces.hair.src !== "part" && !sculpted && (
              <>
                {piece("hairBack")}
                <Hint>
                  Mảng tóc ảnh vẽ sau cả thân và chân, chỉ thấy phần thò ra ngoài viền thân. Trôi
                  theo lắc bao nhiêu thì chỉnh ở tab Mặt.
                </Hint>
              </>
            )}
            {piece("neck")}
            <Hint>
              Khăn quàng, cà vạt, yếm — treo ở khớp cổ, nghiêng theo thân chứ không theo đầu.
            </Hint>
            {piece(
              "torso",
              solidTorso ? (
                <>
                  {GARMENT_ROWS.filter(
                    ({ key }) => key !== (palette.clad ? "slope" : "cladSlope"),
                  ).map(({ key, label, min, max, pct }) => (
                    <SliderRow
                      key={key}
                      label={label}
                      value={pct ? Math.round(garment[key] * 100) : garment[key]}
                      min={min}
                      max={max}
                      onChange={(v) =>
                        mutate((d) => {
                          const pc = at(d, "torso");
                          pc.garment = {
                            ...pc.garment,
                            style: garment.style,
                            [key]: pct ? v / 100 : v,
                          };
                        })
                      }
                    />
                  ))}
                  <Hint>
                    Thân áo dựng khối chiếu theo góc nhìn: một bộ số cho cả thẳng, nghiêng và sau.
                    Số đo bằng px; ô nào chưa kéo thì lấy số của kiểu. Kiểu chọn ở ô Thân áo.
                  </Hint>
                </>
              ) : (
                <Hint>Đi ngang: bóp bề ngang xuống ~70.</Hint>
              ),
            )}
            {piece(
              "hem",
              <>
                {solidHem ? (
                  SKIRT_ROWS.map(({ key, label, min, max }) => (
                    <SliderRow
                      key={key}
                      label={label}
                      value={skirt[key]}
                      min={min}
                      max={max}
                      onChange={(v) =>
                        mutate((d) => {
                          const pc = at(d, "hem");
                          pc.skirt = { ...skirtOf(pc.skirt), [key]: v };
                        })
                      }
                    />
                  ))
                ) : (
                  <CheckRow
                    label="Ẩn chân khi có tà áo"
                    checked={pieces.hem.hideLegs}
                    onChange={(v) => mutate((d) => (at(d, "hem").hideLegs = v))}
                  />
                )}
                <CheckRow
                  label="Vẽ dưới thân áo"
                  checked={pieces.hem.layer === "under"}
                  onChange={(v) => mutate((d) => (at(d, "hem").layer = v ? "under" : "front"))}
                />
              </>,
            )}
            <Hint>
              Bật “dưới thân áo” khi gấu áo phải trùm ra ngoài tà; tắt thì tà áo vẽ đè lên thân áo.
            </Hint>
            {solidHem && (
              <Hint>
                Váy dựng khối chiếu theo góc của thân như thân áo dựng khối, gấu rủ theo đùi và phủ
                đùi lúc sải, lúc ngồi. Số đo bằng px; chọn ở ô Tà áo.
              </Hint>
            )}
            {(["handNear", "handFar"] as const).map((k) =>
              piece(
                k,
                <CheckRow
                  label="Vẽ sau cả người"
                  checked={pieces[k].layer === "under"}
                  onChange={(v) => mutate((d) => (at(d, k).layer = v ? "under" : "front"))}
                />,
              ),
            )}
            <Hint>
              Đồ cầm tay: hộp cao bằng cả cánh tay, tâm đặt ở bàn tay và xoay theo cẳng tay; dx/dy
              dời điểm cầm, xoay quanh bàn tay.
            </Hint>
            <Hint>
              Ô chọn liệt kê bộ phận vẽ bằng code rồi tới các kiểu trong{" "}
              <code>pieces/catalog.json</code>; chọn kiểu là nhận luôn dx/dy/scale của kiểu đó. Nút
              dấu trang ghi căn đang chỉnh (góc chính diện) thành mặc định ấy, vào danh mục của thư
              mục đang mở. Nút tải lên nạp PNG từ máy. Chỉ nạp PNG đã có alpha.
            </Hint>
          </Section>
        </TabsContent>
        <TabsContent value="items">
          <Section title="Vật">
            {!items.length && (
              <div className="mb-2 text-sm text-muted-foreground">
                Chưa có vật nào. Cắm mảnh vào một socket ở tab Mảnh ảnh rồi tách nó ra dưới đây.
              </div>
            )}
            {items.map(([name, it]) => (
              <div key={name} className="mb-2.5 rounded border bg-muted/40 p-2.5">
                <div className="mb-2 flex items-center gap-1.5">
                  <Input
                    defaultValue={name}
                    key={name}
                    className="h-8"
                    onBlur={(e) => renameItem(name, e.target.value.trim())}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    title="Xoá vật"
                    onClick={() => {
                      mutate((d) => delete d.items[name]);
                      for (const k of Object.keys(p.view.equip) as PieceKey[])
                        if (p.view.equip[k] === name) wear(k, undefined);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(it) as PieceKey[]).map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant={p.view.equip[k] === name ? "default" : "secondary"}
                      onClick={() => wear(k, p.view.equip[k] === name ? undefined : name)}
                    >
                      {PIECE_LABELS[k]}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            <div className="mb-2 flex items-center gap-1.5">
              <Input
                value={newItem}
                placeholder={
                  sel ? `Tách ${PIECE_LABELS[sel]} thành vật tên…` : "Chọn một mảnh trước"
                }
                className="h-8"
                disabled={!sel}
                onChange={(e) => setNewItem(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!sel || !newItem.trim()}
                onClick={() => {
                  detach(sel!, newItem.trim());
                  setNewItem("");
                }}
              >
                Tách
              </Button>
            </div>
            <Hint>
              Vật là mảnh gọi tên được: scene và hành động cắm nó vào socket bằng <code>equip</code>
              , nên một nhân vật đủ dùng cho cả tập thay vì mỗi thứ cầm tay một file. Tách xong
              socket nền để trống, bấm nút socket để mặc hoặc cởi khi xem thử.
            </Hint>
          </Section>

          <Section title="Bộ đồ">
            {Object.keys(c.outfits).map((n) => (
              <div key={n} className="mb-1.5 flex items-center gap-1.5">
                <span className="flex-1 truncate text-sm">{n}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => p.setView({ equip: { ...p.view.equip, ...c.outfits[n] } })}
                >
                  Mặc
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  title="Xoá bộ đồ"
                  onClick={() => mutate((d) => delete d.outfits[n])}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <div className="mt-2 mb-2 flex items-center gap-1.5">
              <Input
                value={newOutfit}
                placeholder="Lưu bộ đang mặc thành tên…"
                className="h-8"
                onChange={(e) => setNewOutfit(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!newOutfit.trim() || !Object.keys(p.view.equip).length}
                onClick={() => {
                  const name = newOutfit.trim();
                  mutate((d) => (d.outfits[name] = { ...p.view.equip }));
                  setNewOutfit("");
                }}
              >
                Lưu
              </Button>
            </div>
            <Hint>
              Bộ đồ chỉ là cách viết gọn: mặc bộ nào là đặt luôn từng socket của bộ ấy, thay cả
              người trong một mốc.
            </Hint>
          </Section>
        </TabsContent>
        <TabsContent value="color">
          <Section title="Màu">
            <div className="grid grid-cols-2 gap-2">
              <ColorRow
                label="Nét"
                value={palette.line}
                onChange={(v) => mutate((d) => (d.palette.line = v))}
              />
              <ColorRow
                label="Da / giấy"
                value={palette.skin}
                onChange={(v) => mutate((d) => (d.palette.skin = v))}
              />
              <ColorRow
                label="Tay"
                value={palette.sleeve}
                onChange={(v) => mutate((d) => (d.palette.sleeve = v))}
              />
              <ColorRow
                label="Chân"
                value={palette.trouser}
                onChange={(v) => mutate((d) => (d.palette.trouser = v))}
              />
              <ColorRow
                label="Thân áo"
                value={palette.garment}
                onChange={(v) => mutate((d) => (d.palette.garment = v))}
              />
            </div>
            <div className="mt-2">
              <SliderRow
                label="Dày nét"
                value={rig.stroke}
                min={2}
                max={20}
                onChange={(v) => mutate((d) => (d.rig.stroke = v))}
              />
              <SliderRow
                label="Dày tay"
                value={limbWidths(palette).sleeve}
                min={4}
                max={40}
                onChange={(v) => mutate((d) => (d.palette.sleeveWidth = v))}
              />
              <SliderRow
                label="Dày chân"
                value={limbWidths(palette).trouser}
                min={4}
                max={40}
                onChange={(v) => mutate((d) => (d.palette.trouserWidth = v))}
              />
              <SliderRow
                label="Cong chi"
                value={palette.limbCurve}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => mutate((d) => (d.palette.limbCurve = v))}
              />
              <SliderRow
                label="Bóng khối"
                value={palette.shade}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => mutate((d) => (d.palette.shade = v))}
              />
              <CheckRow
                label="Tay áo / ống quần (thêm viền nét)"
                checked={palette.clad}
                onChange={(v) => mutate((d) => (d.palette.clad = v))}
              />
            </div>
          </Section>
        </TabsContent>
        <TabsContent value="face">
          <Section title="Mặt">
            <div>
              <SliderRow
                label="Mặt y"
                value={face.offsetY}
                min={-60}
                max={60}
                onChange={(v) => mutate((d) => (d.face.offsetY = v))}
              />
              <SliderRow
                label="Cách mắt"
                value={face.eyeGap}
                min={10}
                max={60}
                onChange={(v) => mutate((d) => (d.face.eyeGap = v))}
              />
              <SliderRow
                label="Hướng mặt"
                value={face.turn}
                min={-30}
                max={30}
                onChange={(v) => mutate((d) => (d.face.turn = v))}
              />
              <SliderRow
                label="Mắt → mồm"
                value={face.mouthGap}
                min={0}
                max={90}
                onChange={(v) => mutate((d) => (d.face.mouthGap = v))}
              />
              <SliderRow
                label="Má ửng (3D)"
                value={face.blush}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => mutate((d) => (d.face.blush = v))}
              />
              <SliderRow
                label="Tóc trôi"
                value={Math.round(c.head.follow * 100)}
                min={-50}
                max={100}
                onChange={(v) => mutate((d) => (d.head.follow = v / 100))}
              />
              <SliderRow
                label="Tóc sau trôi"
                value={Math.round(c.head.followBack * 100)}
                min={-50}
                max={100}
                onChange={(v) => mutate((d) => (d.head.followBack = v / 100))}
              />
            </div>
            <Hint>
              Lắc đầu thì tóc, mũ trôi theo mặt bấy nhiêu phần; 0 là bám sọ, đứng yên. Mảng tóc sau
              nằm sau trục lắc nên kéo âm mới đúng chiều — mặc định 10 và −20.
            </Hint>
          </Section>

          <Section title="Nét mặt xem thử">
            <FacePicker
              value={{
                mouth: p.view.mouth,
                brow: p.view.brow,
                eyes: p.view.eyes === "auto" ? undefined : p.view.eyes,
              }}
              blank={{ eyes: "tự chớp" }}
              onChange={(f, k) => p.setView({ [f]: k ?? "auto" })}
            />
            <Hint>
              Chỉ để xem, không lưu vào nhân vật. Hành động ghi nét mặt thì nét đó thắng; chớp mắt
              là nhịp ngẫu nhiên của bên phát.
            </Hint>
          </Section>

          <Section title="Phụ kiện mặt">
            {piece(
              "faceAcc",
              glassy && (
                <>
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <Select
                      value={glasses.shape}
                      onValueChange={(v) => setGlasses((g) => (g.shape = v as GlassesShape))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GLASSES_SHAPES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {GLASSES_SHAPE_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <CheckRow
                      label="Kính râm"
                      checked={glasses.tint}
                      onChange={(v) => setGlasses((g) => (g.tint = v))}
                    />
                  </div>
                  {GLASSES_ROWS.map(({ key, label, min, max }) => (
                    <SliderRow
                      key={key}
                      label={label}
                      value={Math.round(glasses[key] * 100)}
                      min={min}
                      max={max}
                      onChange={(v) => setGlasses((g) => (g[key] = v / 100))}
                    />
                  ))}
                  <Hint>
                    Cỡ là nửa chiều cao mắt kính; giãn, cao, cách mắt là độ lệch tâm mắt kính khỏi
                    tâm mắt — mọi số là phần trăm bán kính sọ. Gọng là phần trăm nét viền. Kính dựng
                    khối quay theo đầu ở mọi góc, càng ôm sọ về tai. Mẫu chọn ở ô Phụ kiện mặt.
                  </Hint>
                  {turnPreview}
                </>
              ),
            )}
            <Hint>
              Kính, sẹo, mặt nạ — vẽ trên mắt, mày, miệng và trôi đúng bằng nét mặt, dưới tóc và mũ.
            </Hint>
          </Section>

          <Section title="Râu">
            {piece(
              "chin",
              bearded ? (
                <>
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <Select
                      value={beard.tip}
                      onValueChange={(v) => setBeard((b) => (b.tip = v as BeardTip))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BEARD_TIPS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {BEARD_TIP_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <CheckRow
                      label="Lún phún"
                      checked={beard.stubble}
                      onChange={(v) => setBeard((b) => (b.stubble = v))}
                    />
                    <CheckRow
                      label="Kín mồm"
                      checked={beard.cover}
                      onChange={(v) => setBeard((b) => (b.cover = v))}
                    />
                  </div>
                  {BEARD_ROWS.filter(
                    ({ key }) =>
                      (!beard.stubble || (key !== "bulk" && key !== "length")) &&
                      (!beard.cover || (key !== "gap" && key !== "notch" && key !== "soft")),
                  ).map(({ key, label, min, max, pct }) => (
                    <SliderRow
                      key={key}
                      label={label}
                      value={Math.round(pct ? beard[key] * 100 : beard[key])}
                      min={min}
                      max={max}
                      onChange={(v) => setBeard((b) => (b[key] = pct ? v / 100 : v))}
                    />
                  ))}
                  <Hint>
                    Mép sau là kinh độ, quá 90 thì tóc mai lên tới tai; tóc mai là vĩ độ đỉnh của
                    nó. Mép má và chừa mồm là độ cao hơn, thấp hơn mồm; rộng khấc, bo hai đầu theo
                    độ kinh; thành khấc nhỏ là hai bên mồm dựng đứng thành dải mảnh; kín mồm là bỏ
                    khấc, mồm vẽ đè lên râu. Dải ria là ria liền khối với râu, dày theo độ vĩ, rộng
                    theo độ kinh, ria cao là mép dưới trên mồm bấy nhiêu độ. Cạo cằm, dày, dài rủ là
                    phần trăm bán kính sọ; dáng đuôi chỉ thấy khi có dài rủ. Lún phún là lớp màu mờ,
                    không dày không rủ. Mẫu chọn ở ô Râu, kèm luôn kiểu ria; màu bỏ trống thì theo
                    màu ria.
                  </Hint>
                  {turnPreview}
                </>
              ) : (
                <CheckRow
                  label="Vẽ dưới nét mặt"
                  checked={pieces.chin.layer === "under"}
                  onChange={(v) => mutate((d) => (at(d, "chin").layer = v ? "under" : "front"))}
                />
              ),
            )}
            {bearded ? (
              <Hint>
                Râu dựng khối quay theo đầu ở mọi góc, luôn vẽ dưới nét mặt: miệng, ria và mắt đè
                lên râu.
              </Hint>
            ) : (
              <Hint>
                Mảnh ảnh nên râu đứng yên khi há mồm — chọn kiểu không chạm môi. Bật “dưới nét mặt”
                thì miệng, ria và mắt vẽ đè lên râu: râu quai nón khỏi phải khoét chừa mồm. Ria mép
                thì vẫn vẽ bằng code ở dưới, nó bám khẩu hình.
              </Hint>
            )}
          </Section>

          <Section title="Ria mép (vẽ bằng code)">
            <Select
              value={face.moustache.kind}
              onValueChange={(v) => mutate((d) => (d.face.moustache.kind = v as MoustacheKind))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOUSTACHE_KINDS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MOUSTACHE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {face.moustache.kind !== "none" && (
              <div className="mt-2">
                <CheckRow
                  label="Bám theo mồm"
                  checked={face.moustache.follow}
                  onChange={(v) => mutate((d) => (d.face.moustache.follow = v))}
                />
                <SliderRow
                  label="dx"
                  value={face.moustache.dx}
                  min={-40}
                  max={40}
                  onChange={(v) => mutate((d) => (d.face.moustache.dx = v))}
                />
                <SliderRow
                  label="dy"
                  value={face.moustache.dy}
                  min={-40}
                  max={40}
                  onChange={(v) => mutate((d) => (d.face.moustache.dy = v))}
                />
                <SliderRow
                  label="Rộng"
                  value={Math.round(face.moustache.width * 100)}
                  min={50}
                  max={160}
                  onChange={(v) => mutate((d) => (d.face.moustache.width = v / 100))}
                />
                <ColorRow
                  label="Màu"
                  value={face.moustache.color}
                  onChange={(v) => mutate((d) => (d.face.moustache.color = v))}
                />
              </div>
            )}
          </Section>

          <Section title="Nếp nhăn (vẽ bằng code)">
            <Select
              value={face.wrinkle.kind}
              onValueChange={(v) => mutate((d) => (d.face.wrinkle.kind = v as WrinkleKind))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WRINKLE_KINDS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {WRINKLE_LABELS[w]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {face.wrinkle.kind !== "none" && (
              <div className="mt-2">
                <SliderRow
                  label="dy"
                  value={face.wrinkle.dy}
                  min={-30}
                  max={30}
                  onChange={(v) => mutate((d) => (d.face.wrinkle.dy = v))}
                />
                <SliderRow
                  label="Rộng"
                  value={Math.round(face.wrinkle.width * 100)}
                  min={50}
                  max={140}
                  onChange={(v) => mutate((d) => (d.face.wrinkle.width = v / 100))}
                />
                <ColorRow
                  label="Màu"
                  value={face.wrinkle.color}
                  onChange={(v) => mutate((d) => (d.face.wrinkle.color = v))}
                />
                <Hint>Dấu hiệu tuổi tác; nếp trán nằm dưới mảnh tóc và mũ nên bị chúng che.</Hint>
              </div>
            )}
          </Section>
        </TabsContent>
      </Tabs>

      <Section title="Thư mục làm việc">
        <div className="mb-2 flex items-center gap-1.5">
          <div className="min-w-0 flex-1 truncate rounded border bg-muted/60 px-2 py-1.5 font-mono text-xs">
            {p.workspace}
          </div>
          {p.canOpenDirectory && (
            <Button
              variant="secondary"
              size="sm"
              className="px-2.5"
              title="Mở thư mục assets/ của repo video"
              onClick={() => void p.onOpenDirectory().then(setErr)}
            >
              <FolderOpen />
            </Button>
          )}
          {p.writable && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              title="Đóng thư mục, quay lại bộ mẫu"
              onClick={p.onCloseDirectory}
            >
              <X />
            </Button>
          )}
        </div>
        <Hint>
          {p.canOpenDirectory
            ? "Chọn thư mục có characters/, actions/, pieces/ (và props/) — studio đọc và ghi thẳng vào đó."
            : "Trình duyệt này không mở được thư mục; dùng gói .zip để mang nhân vật qua lại."}
        </Hint>
      </Section>

      <Section title="JSON nhân vật">
        <Select value={p.characterFile} onValueChange={(v) => void p.onLoadRepo(v).then(setErr)}>
          <SelectTrigger className="mb-2 w-full font-mono text-xs">
            <SelectValue placeholder="Nạp từ characters/" />
          </SelectTrigger>
          <SelectContent>
            {p.repoCharacters.map((f) => (
              <SelectItem key={f} value={f} className="font-mono text-xs">
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                `${c.name || "character"}.json`,
              )
            }
          >
            Tải về
          </Button>
          <Button size="sm" variant="secondary" className="flex-1" asChild>
            <label>
              Nạp
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
        {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
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

      <Section title="Gói .zip">
        <div className="mb-2 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => void p.onExportBundle()}>
            Tải gói
          </Button>
          <Button size="sm" variant="secondary" className="flex-1" asChild>
            <label>
              Nạp gói
              <input
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setErr(await p.onImportBundle(f));
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
        <Hint>
          Gồm <code>character.json</code>, <code>action.json</code> và mảnh ảnh đang cắm. Mở lại
          được ở máy khác, không cần repo.
        </Hint>
      </Section>

      <p className="text-xs text-muted-foreground">
        Tên file trong JSON trỏ vào <code>pieces/</code> của thư mục đang mở. Mảnh nạp từ máy nhưng
        chưa nằm trong đó thì chỉ theo được gói .zip.
      </p>
    </div>
  );
}
