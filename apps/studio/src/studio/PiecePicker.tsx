import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  BEARD_PRESETS,
  beardPaths,
  defaultCharacter,
  Eyes,
  GARMENT_STYLE_NAMES,
  GARMENT_STYLES,
  GLASSES_PRESETS,
  glassesPaths,
  Head,
  INK,
  Moustache,
  Mouth,
  PAPER,
  Part,
  PARTS,
  partBox,
  RIG,
  SCULPT_PRESETS,
  SculptBeard,
  SculptGlasses,
  SculptHair,
  SculptSkirt,
  SculptTorso,
  sculptPaths,
  computeFigure,
  POSES,
  skirtPaths,
  restYaw,
  torsoPaths,
  type BeardPreset,
  type GarmentStyle,
  type GlassesPreset,
  type PieceCatalogEntry,
  type PieceDir,
  type Sculpt,
  type SculptPreset,
} from "@stickman3d/sketch";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export const PAGE_SIZE = 50;

interface PiecePickerProps {
  /** Thư mục trong `pieces/` — `hand` cho hai tay, `prop` cho thân đạo cụ */
  socket: PieceDir;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mục của socket này trong `pieces/catalog.json` */
  entries: PieceCatalogEntry[];
  parts: string[];
  /**
   * Giá trị đang chọn: tên file, `part:<tên>`, hoặc `SCULPT` / `GLASSES` / `BEARD` / `TORSO` + tên
   * mẫu tóc / kính / râu / kiểu thân áo dựng khối (mẫu rỗng nếu đã chỉnh tay)
   */
  value: string;
  /** URL của mảnh đang cắm, để mảnh nạp từ máy vẫn có thumb */
  currentUrl?: string;
  pieceUrl: (file: string) => Promise<string>;
  /** Chuỗi là tên bộ phận code, object là mục danh mục */
  onPick: (value: string | PieceCatalogEntry) => void;
  /** Có thì lưới mở đầu bằng một ô cho mỗi mẫu tóc dựng khối `SCULPT_PRESETS` */
  onSculpt?: (preset: SculptPreset) => void;
  /** Có thì lưới mở đầu bằng một ô cho mỗi mẫu kính dựng khối `GLASSES_PRESETS` */
  onGlasses?: (preset: GlassesPreset) => void;
  /** Có thì lưới mở đầu bằng một ô cho mỗi mẫu râu dựng khối `BEARD_PRESETS` */
  onBeard?: (preset: BeardPreset) => void;
  /** Có thì lưới mở đầu bằng một ô cho mỗi kiểu thân áo dựng khối `GARMENT_STYLES` */
  onTorso?: (style: GarmentStyle) => void;
  /** Có thì lưới mở đầu bằng một ô váy dựng khối */
  onSkirt?: () => void;
}

/** Tiền tố `value` khi socket đang là tóc dựng khối */
export const SCULPT = "sculpt:";
/** Tiền tố `value` khi socket đang là kính dựng khối */
export const GLASSES = "glasses:";
/** Tiền tố `value` khi socket đang là râu dựng khối */
export const BEARD = "beard:";
/** Tiền tố `value` khi socket đang là thân áo dựng khối */
export const TORSO = "torso:";
/** `value` khi socket đang là váy dựng khối */
export const SKIRT = "skirt:";

const fileName = (f: string) => f.slice(f.lastIndexOf("/") + 1);

const CARD = "flex flex-col gap-1 rounded border p-1 text-left hover:bg-accent";
const THUMB = "flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-sm";
/** Nền ô xem trước là giấy của sân khấu: mảnh ruột trắng mới đọc được hình */
const THUMB_BG = { background: PAPER };

/** Nét ô xem trước mảnh hơn nét thật: ô nhỏ, nét đủ dày là hình bít lại */
const THUMB_STROKE = RIG.stroke * 0.55;

/**
 * Ô xem trước bộ phận code: vẽ ruột trắng vào **đúng hộp nó sẽ chiếm lúc cắm** (`partBox`)
 * rồi cắt khung theo `getBBox` của hình, vì mái vẽ trên khung đầu 320×320 chỉ phủ nửa trên.
 * Chừa mỗi mép một nét vì nét tràn ra ngoài hình.
 */
function PartThumb({ name }: { name: string }) {
  const { w, h } = useMemo(() => partBox(name), [name]);
  const ref = useRef<SVGGElement>(null);
  const [fit, setFit] = useState({ x: 0, y: 0, w, h });
  useLayoutEffect(() => {
    const b = ref.current?.getBBox();
    setFit(
      b && b.width > 0 && b.height > 0
        ? { x: b.x, y: b.y, w: b.width, h: b.height }
        : { x: 0, y: 0, w, h },
    );
  }, [name, w, h]);
  const pad = THUMB_STROKE;
  return (
    <svg
      viewBox={`${fit.x - pad} ${fit.y - pad} ${fit.w + pad * 2} ${fit.h + pad * 2}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <g ref={ref}>
        <Part name={name} w={w} h={h} color="#ffffff" line={INK} stroke={THUMB_STROKE} />
      </g>
    </svg>
  );
}

/** Ô xem trước tóc dựng khối: một mẫu trên đầu tròn, lắc nhẹ cho thấy khối; tóc rủ thì khung cao thêm */
function SculptThumb({ preset }: { preset: SculptPreset }) {
  const r = RIG.headH / 2;
  const s: Partial<Sculpt> = SCULPT_PRESETS[preset].sculpt;
  const paths = useMemo(() => sculptPaths(s, { yaw: 30, pitch: 0 }, "round", 0, 0, r, r), [s, r]);
  // Khung đo đúng mọi lớp tóc: vỏ, gai, mặt rủ, đuôi ngựa và búi
  const pad = r * 0.3;
  const pts = [
    ...(paths.cap + paths.back + paths.under + paths.knot).matchAll(/(-?[\d.]+) (-?[\d.]+)/g),
  ];
  const ys = pts.map((m) => Number(m[2]));
  const half = Math.max(r + pad, pad * 0.5 + Math.max(...pts.map((m) => Math.abs(Number(m[1])))));
  const top = Math.max(r * 1.2, pad * 0.5 - Math.min(...ys));
  const low = Math.max(r * 1.2, pad * 0.5 + Math.max(...ys));
  return (
    <svg
      viewBox={`${-half} ${-top} ${2 * half} ${top + low}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={paths.under}
        fill="#3b2a22"
        stroke={INK}
        strokeWidth={THUMB_STROKE * 2}
        strokeLinejoin="round"
      />
      <path d={paths.under} fill="#3b2a22" />
      <Head
        shape="round"
        cx={0}
        cy={0}
        rx={r}
        ry={r}
        fill="#ffffff"
        stroke={INK}
        strokeWidth={THUMB_STROKE}
      />
      <SculptHair paths={paths} color="#3b2a22" line={INK} stroke={THUMB_STROKE} />
    </svg>
  );
}

const THUMB_TURN = { yaw: 30, pitch: 0 };
/** Kinh độ mắt của nhân vật mặc định, độ */
const EYE_LON = (Math.asin(defaultCharacter().face.eyeGap / RIG.headH) * 180) / Math.PI;

/** Ô xem trước kính dựng khối: nửa trên mặt tròn lắc nhẹ, đủ thấy mắt kính xa bóp lại và càng */
function GlassesThumb({ preset }: { preset: GlassesPreset }) {
  const r = RIG.headH / 2;
  const paths = useMemo(
    () =>
      glassesPaths(GLASSES_PRESETS[preset].glasses, THUMB_TURN, [EYE_LON, 0], "round", 0, 0, r, r),
    [preset, r],
  );
  const [near, far] = paths.eyes;
  // Khung ôm phần kính trước mặt; mặt chỉ tô ruột, viền đầu to lấn cả ô
  const pts = [...(paths.rim + paths.arms).matchAll(/(-?[\d.]+) (-?[\d.]+)/g)];
  const xs = pts.map((m) => Number(m[1]));
  const ys = pts.map((m) => Number(m[2]));
  const pad = r * 0.15;
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  return (
    <svg
      viewBox={`${x0} ${y0} ${Math.max(...xs) + pad - x0} ${Math.max(...ys) + pad - y0}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <Head
        shape="round"
        cx={0}
        cy={0}
        rx={r}
        ry={r}
        fill="#ffffff"
        stroke="none"
        strokeWidth={0}
      />
      <Eyes
        kind="open"
        cx={(near[0] + far[0]) / 2}
        cy={near[1]}
        gap={far[0] - near[0]}
        squash={Math.cos(THUMB_TURN.yaw * (Math.PI / 180))}
      />
      <SculptGlasses paths={paths} color="#2d2d2d" line={INK} stroke={RIG.stroke} />
    </svg>
  );
}

const FACE = defaultCharacter().face;
/** Vĩ độ mồm của nhân vật mặc định, độ */
const MOUTH_LAT = (-Math.asin((FACE.offsetY + FACE.mouthGap) / (RIG.headH / 2)) * 180) / Math.PI;
const BEARD_COLOR = "#3b2a22";

/** Ô xem trước râu dựng khối: mặt tròn lắc nhẹ cùng ria đi kèm mẫu; râu rủ thì khung cao thêm */
function BeardThumb({ preset }: { preset: BeardPreset }) {
  const r = RIG.headH / 2;
  const { beard, moustache } = BEARD_PRESETS[preset];
  const paths = useMemo(
    () => beardPaths(beard, THUMB_TURN, MOUTH_LAT, "round", 0, 0, r, r),
    [beard, r],
  );
  const rad = Math.PI / 180;
  const yaw = THUMB_TURN.yaw * rad;
  const eye = EYE_LON * rad;
  const mx = r * Math.cos(MOUTH_LAT * rad) * Math.sin(yaw);
  const my = -r * Math.sin(MOUTH_LAT * rad);
  const near = r * Math.sin(yaw - eye);
  const far = r * Math.sin(yaw + eye);
  const ys = [...(paths.front + paths.back).matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) =>
    Number(m[2]),
  );
  const pad = r * 0.15;
  const top = -r * 0.35;
  const low = Math.max(r, ...ys) + pad;
  const half = r + pad;
  return (
    <svg
      viewBox={`${-half} ${top} ${2 * half} ${low - top}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <Head
        shape="round"
        cx={0}
        cy={0}
        rx={r}
        ry={r}
        fill="#ffffff"
        stroke={INK}
        strokeWidth={THUMB_STROKE}
      />
      <SculptBeard paths={paths} color={BEARD_COLOR} line={INK} stroke={THUMB_STROKE} />
      <Eyes kind="open" cx={(near + far) / 2} cy={0} gap={far - near} squash={Math.cos(yaw)} />
      <Moustache
        moustache={{ ...FACE.moustache, kind: moustache, color: BEARD_COLOR }}
        mouth="closed"
        cx={mx}
        cy={my}
        r={r}
      />
      <Mouth kind="closed" cx={mx} cy={my} />
    </svg>
  );
}

/** Ô xem trước thân áo dựng khối: nhân vật mặc định nhìn thẳng */
function TorsoThumb({ style }: { style: GarmentStyle }) {
  const paths = useMemo(() => {
    const c = defaultCharacter();
    c.pieces.torso = { ...c.pieces.torso, src: "sculpt", garment: { style } };
    return torsoPaths(c, restYaw(c), RIG.stroke);
  }, [style]);
  const b = paths.box;
  return (
    <svg
      viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SculptTorso
        paths={paths}
        color={style === "bare" ? "#f0d9b8" : "#ffffff"}
        line={INK}
        stroke={RIG.stroke}
      />
    </svg>
  );
}

/** Ô xem trước váy dựng khối: nhân vật mặc định đứng nhìn thẳng */
function SkirtThumb() {
  const paths = useMemo(() => {
    const c = defaultCharacter();
    c.pieces.hem = { ...c.pieces.hem, src: "sculpt" };
    return skirtPaths(c, computeFigure(c, POSES.idle, "front"), 0, 0, RIG.stroke);
  }, []);
  const b = paths.box;
  return (
    <svg
      viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <SculptSkirt paths={paths} color="#ffffff" line={INK} stroke={RIG.stroke} />
    </svg>
  );
}

/** Lưới chọn mảnh có thumb, mỗi trang `PAGE_SIZE` ảnh; bấm là cắm ngay, không cần xác nhận. */
export function PiecePicker(p: PiecePickerProps) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent>
        <Grid {...p} />
      </DialogContent>
    </Dialog>
  );
}

// Tách ra để mỗi lần mở modal là state trang/thumb dựng lại từ đầu
function Grid({
  socket,
  title,
  entries: repo,
  parts,
  value,
  currentUrl,
  pieceUrl,
  onPick,
  onSculpt,
  onGlasses,
  onBeard,
  onTorso,
  onSkirt,
  onOpenChange,
}: PiecePickerProps) {
  const current =
    value.startsWith("part:") ||
    value.startsWith(SCULPT) ||
    value.startsWith(GLASSES) ||
    value.startsWith(BEARD) ||
    value.startsWith(TORSO) ||
    value === SKIRT
      ? ""
      : value;
  // Mảnh đang cắm mà không có trong danh mục (nạp từ máy) thì vẫn hiện, ở đầu
  const entries = useMemo<PieceCatalogEntry[]>(
    () =>
      current && !repo.some((e) => e.file === current)
        ? [
            {
              file: current,
              socket,
              name: fileName(current),
              description: "",
              config: {},
            },
            ...repo,
          ]
        : repo,
    [current, repo, socket],
  );
  const [page, setPage] = useState(() =>
    Math.floor(
      Math.max(
        0,
        entries.findIndex((e) => e.file === current),
      ) / PAGE_SIZE,
    ),
  );
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  // Tự quản hover thay vì `group-hover`: Tailwind bọc hover trong `@media (hover)`, chạm trên điện thoại không hiện
  const [info, setInfo] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const shown = useMemo(
    () => entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [entries, page],
  );

  useEffect(() => {
    let alive = true;
    for (const { file: f } of shown) {
      const src = f === current && currentUrl ? Promise.resolve(currentUrl) : pieceUrl(f);
      src.then((u) => alive && setThumbs((t) => (t[f] ? t : { ...t, [f]: u }))).catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [shown, current, currentUrl, pieceUrl]);

  const pick = (v: string | PieceCatalogEntry) => {
    onPick(v);
    onOpenChange(false);
  };

  return (
    <>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>
        {entries.length} kiểu trong <code className="font-mono">pieces/catalog.json</code>
        {parts.length > 0 && ` · ${parts.length} bộ phận vẽ code`}
      </DialogDescription>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {(parts.length > 0 || onSculpt || onGlasses || onBeard || onTorso || onSkirt) &&
          page === 0 && (
            <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
              {onSkirt && (
                <button
                  type="button"
                  title="src: sculpt"
                  onClick={() => {
                    onSkirt();
                    onOpenChange(false);
                  }}
                  className={cn(CARD, value === SKIRT && "border-primary ring-2 ring-primary/40")}
                >
                  <div className={THUMB} style={THUMB_BG}>
                    <SkirtThumb />
                  </div>
                  <span className="truncate text-[12px] leading-tight">Váy dựng khối</span>
                </button>
              )}
              {onTorso &&
                GARMENT_STYLE_NAMES.map((k) => (
                  <button
                    key={k}
                    type="button"
                    title={`src: sculpt · ${k}`}
                    onClick={() => {
                      onTorso(k);
                      onOpenChange(false);
                    }}
                    className={cn(
                      CARD,
                      value === TORSO + k && "border-primary ring-2 ring-primary/40",
                    )}
                  >
                    <div className={THUMB} style={THUMB_BG}>
                      <TorsoThumb style={k} />
                    </div>
                    <span className="truncate text-[12px] leading-tight">
                      {GARMENT_STYLES[k].label}
                    </span>
                  </button>
                ))}
              {onSculpt &&
                (Object.keys(SCULPT_PRESETS) as SculptPreset[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    title={`src: sculpt · ${k}`}
                    onClick={() => {
                      onSculpt(k);
                      onOpenChange(false);
                    }}
                    className={cn(
                      CARD,
                      value === SCULPT + k && "border-primary ring-2 ring-primary/40",
                    )}
                  >
                    <div className={THUMB} style={THUMB_BG}>
                      <SculptThumb preset={k} />
                    </div>
                    <span className="truncate text-[12px] leading-tight">
                      {SCULPT_PRESETS[k].label}
                    </span>
                  </button>
                ))}
              {onGlasses &&
                (Object.keys(GLASSES_PRESETS) as GlassesPreset[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    title={`src: sculpt · ${k}`}
                    onClick={() => {
                      onGlasses(k);
                      onOpenChange(false);
                    }}
                    className={cn(
                      CARD,
                      value === GLASSES + k && "border-primary ring-2 ring-primary/40",
                    )}
                  >
                    <div className={THUMB} style={THUMB_BG}>
                      <GlassesThumb preset={k} />
                    </div>
                    <span className="truncate text-[12px] leading-tight">
                      {GLASSES_PRESETS[k].label}
                    </span>
                  </button>
                ))}
              {onBeard &&
                (Object.keys(BEARD_PRESETS) as BeardPreset[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    title={`src: sculpt · ${k}`}
                    onClick={() => {
                      onBeard(k);
                      onOpenChange(false);
                    }}
                    className={cn(
                      CARD,
                      value === BEARD + k && "border-primary ring-2 ring-primary/40",
                    )}
                  >
                    <div className={THUMB} style={THUMB_BG}>
                      <BeardThumb preset={k} />
                    </div>
                    <span className="truncate text-[12px] leading-tight">
                      {BEARD_PRESETS[k].label}
                    </span>
                  </button>
                ))}
              {parts.map((n) => (
                <button
                  key={n}
                  type="button"
                  title={`part:${n}`}
                  onClick={() => pick(n)}
                  className={cn(
                    CARD,
                    value === `part:${n}` && "border-primary ring-2 ring-primary/40",
                  )}
                >
                  <div className={THUMB} style={THUMB_BG}>
                    <PartThumb name={n} />
                  </div>
                  <span className="truncate text-[12px] leading-tight">{PARTS[n].label}</span>
                </button>
              ))}
            </div>
          )}
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Danh mục chưa có kiểu nào cho socket {socket}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
            {shown.map((e) => (
              <button
                key={e.file}
                type="button"
                title={e.file}
                onClick={() => pick(e)}
                className={cn(CARD, e.file === current && "border-primary ring-2 ring-primary/40")}
              >
                <div className={THUMB} style={THUMB_BG}>
                  {thumbs[e.file] && (
                    <img
                      src={thumbs[e.file]}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                </div>
                <span className="flex items-center gap-1 text-[12px] leading-tight">
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  {e.description && (
                    <span
                      className="relative shrink-0 text-muted-foreground"
                      onMouseEnter={() => setInfo(e.file)}
                      onMouseLeave={() => setInfo(null)}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setInfo(info === e.file ? null : e.file);
                      }}
                    >
                      <Info className="size-3.5" />
                      {info === e.file && (
                        <span className="pointer-events-none absolute right-0 bottom-full z-10 mb-1 w-44 rounded border bg-popover p-2 text-[11px] font-normal whitespace-normal text-popover-foreground shadow-md">
                          {e.description}
                          <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                            {fileName(e.file)}
                          </span>
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          Trang {page + 1}/{pages}
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={page >= pages - 1}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </>
  );
}
