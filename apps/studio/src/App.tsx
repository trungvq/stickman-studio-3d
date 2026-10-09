import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  actionKind,
  animalPieceDir,
  defaultCharacter,
  freezeAction,
  parseAction,
  parseAnimal,
  parseCharacter,
  parseProp,
  PARTS,
  applyAspects,
  BASE_ITEM,
  applyPieceConfig,
  pieceDir,
  piecePart,
  pieceFile,
  partConfig,
  partsFor,
  pieceConfigOf,
  BEARD_PRESETS,
  beardPresetOf,
  BeardSchema,
  GLASSES_PRESETS,
  glassesPresetOf,
  GlassesSchema,
  SCULPT_PRESETS,
  sculptPresetOf,
  SculptSchema,
  SkirtSchema,
  wornPiece,
  wornTune,
  type ActionData,
  type AnimalData,
  type AnimalPieceKey,
  type CharacterData,
  type PieceCatalog,
  type PieceCatalogEntry,
  type PieceKey,
  type PieceUrls,
  type PropData,
  type BeardPreset,
  type GarmentStyle,
  type GlassesPreset,
  type SculptPreset,
  type SocketPiece,
} from "@stickman3d/sketch";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionPanel, type MutateAction } from "./studio/ActionPanel";
import { AnimalActionPanel } from "./studio/AnimalActionPanel";
import { AnimalPanel, type MutateAnimal } from "./studio/AnimalPanel";
import { ActionPicker } from "./studio/ActionPicker";
import { KeyStrip } from "./studio/KeyStrip";
import { download, exportBundle, importBundle } from "./studio/bundle";
import { Panel, type Mutate } from "./studio/Panel";
import { BEARD, GLASSES, PiecePicker, SCULPT, SKIRT, TORSO } from "./studio/PiecePicker";
import type { Subject } from "./studio/Preview";
import {
  PIECE_LABELS,
  loadAnimalPieces,
  loadImage,
  loadPieces,
  measureAspects,
} from "./studio/pieces";
import { PropPanel, type MutateProp } from "./studio/PropPanel";
import { Stage } from "./studio/Stage";
import { StageBar } from "./studio/StageBar";
import { Timeline } from "./studio/Timeline";
import { defaultView, viewFromUrl, viewsOf, type ViewState } from "./studio/view";
import {
  canOpenDirectory,
  directoryWorkspace,
  fixtureWorkspace,
  layeredWorkspace,
  servedLabel,
  forgetDirectory,
  pickDirectory,
  recallDirectory,
  rememberDirectory,
  type TextDir,
  type Workspace,
} from "./studio/workspace";

type Apply = (text: string, file: string) => string | null;

/**
 * Cột trái là **hình dáng** — người, con vật hay đạo cụ — và quyết định ai đứng trên sân khấu;
 * cột phải là hành động của chính người ấy — tab trái là Động vật thì cột Hành động là hành
 * động của động vật. Đạo cụ không có hành động: tab ấy vẫn dựng người để xe đứng cạnh.
 */
const LEFT_TABS = ["character", "animal", "prop"] as const;
type LeftTab = (typeof LEFT_TABS)[number];
type Tab = LeftTab | "action";

const TAB_LABELS: Record<Tab, string> = {
  character: "Người",
  animal: "Động vật",
  action: "Hành động",
  prop: "Đạo cụ",
};

const isLeft = (t: Tab): t is LeftTab => (LEFT_TABS as readonly string[]).includes(t);

/** `?tab=` lúc mở trang */
const urlTab = (): Tab | null => {
  const t = new URLSearchParams(location.search).get("tab");
  return t && t in TAB_LABELS ? (t as Tab) : null;
};

/** Thư mục thật đè lên bộ mẫu: mảnh và hành động thiếu ở đó thì lấy của studio */
const openDirectory = (h: FileSystemDirectoryHandle) =>
  layeredWorkspace(directoryWorkspace(h), fixtureWorkspace());

/** Kiểu thân áo dựng khối đang cắm, rỗng khi đã đè số của kiểu */
const torsoStyleOf = (pc: SocketPiece) => {
  const g = pc.garment;
  if (!g) return "tshirt";
  return Object.entries(g).every(([k, v]) => k === "style" || v === undefined) ? g.style : "";
};

export function App() {
  const [character, setCharacter] = useState<CharacterData>(defaultCharacter);
  const [urls, setUrls] = useState<PieceUrls>({});
  const [action, setAction] = useState<ActionData | null>(null);
  const [view, setViewState] = useState<ViewState>(() => viewFromUrl(defaultView()));
  const [left, setLeft] = useState<LeftTab>(() => {
    const t = urlTab();
    return t && isLeft(t) ? t : "character";
  });
  /** Dưới `1024px` chỉ còn một cột; cột nào đang hiện */
  const [side, setSide] = useState<"left" | "right">(() => {
    const t = urlTab();
    return t && !isLeft(t) ? "right" : "left";
  });
  const setTab = useCallback((t: Tab) => {
    if (isLeft(t)) setLeft(t);
    setSide(isLeft(t) ? "left" : "right");
  }, []);
  const active = (t: Tab) => (isLeft(t) ? side === "left" && left === t : side === "right");
  const [sel, setSel] = useState(0);
  /** Mảnh đang chọn trên sân khấu; cột Người bám theo */
  const [selPiece, setSelPiece] = useState<PieceKey | null>(null);
  /** Socket đang mở modal chọn mảnh — mở được từ cả sân khấu lẫn cột Người */
  const [picking, setPicking] = useState<PieceKey | null>(null);
  const [pickingAction, setPickingAction] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  // Ra file thì mốc gọi tên pose thành số: `POSES` còn tinh chỉnh, file thì ở repo video
  const frozen = action && freezeAction(action);
  const [repo, setRepo] = useState<Record<TextDir, string[]>>({
    characters: [],
    actions: [],
    props: [],
    animals: [],
  });
  /** Hành động nào của người, cái nào của động vật — nạp nhầm chỗ thì không ghi khớp nào cả */
  const [animalActions, setAnimalActions] = useState<string[]>([]);
  /** Hành động soạn cho người 3D (`authoredAt: "side"`), để chọn track dưới trên sân khấu */
  const [sideActions, setSideActions] = useState<string[]>([]);
  const [loadedUnder, setLoadedUnder] = useState<{
    file: string;
    from: unknown;
    a: ActionData | null;
  }>();
  const [catalog, setCatalog] = useState<PieceCatalog>({ schemaVersion: 1, pieces: [], parts: {} });
  const [charFile, setCharFile] = useState("");
  const [actFile, setActFile] = useState("");
  const [prop, setProp] = useState<PropData | null>(null);
  const [propUrl, setPropUrl] = useState<string | undefined>();
  const [propFile, setPropFile] = useState("");
  const [animal, setAnimal] = useState<AnimalData | null>(null);
  const [animalUrls, setAnimalUrls] = useState<PieceUrls>({});
  const [animalFile, setAnimalFile] = useState("");
  const [animalAction, setAnimalAction] = useState<ActionData | null>(null);
  const [animalActFile, setAnimalActFile] = useState("");
  const [ws, setWs] = useState<Workspace>(fixtureWorkspace);

  const mutate = useCallback<Mutate>((fn) => {
    setCharacter((c) => {
      const d = structuredClone(c);
      fn(d);
      return d;
    });
  }, []);
  const mutateAction = useCallback<MutateAction>((fn) => {
    setAction((a) => {
      if (!a) return a;
      const d = structuredClone(a);
      fn(d);
      return d;
    });
  }, []);
  const mutateAnimal = useCallback<MutateAnimal>((fn) => {
    setAnimal((a) => {
      if (!a) return a;
      const d = structuredClone(a);
      fn(d);
      return d;
    });
  }, []);
  const mutateAnimalAction = useCallback<MutateAction>((fn) => {
    setAnimalAction((a) => {
      if (!a) return a;
      const d = structuredClone(a);
      fn(d);
      return d;
    });
  }, []);
  const mutateProp = useCallback<MutateProp>((fn) => {
    setProp((a) => {
      if (!a) return a;
      const d = structuredClone(a);
      fn(d);
      return d;
    });
  }, []);
  const setView = useCallback((v: Partial<ViewState>) => setViewState((s) => ({ ...s, ...v })), []);
  /** Mảnh đang chiếm socket; sửa mảnh phải ghi vào đây, vì mảnh đang mặc nằm trong `items` */
  const worn = useCallback(
    (d: CharacterData, k: PieceKey) => wornPiece(d, view.equip, k),
    [view.equip],
  );

  /** `given` là mảnh đã có sẵn URL (nạp từ gói zip); không có thì lấy từ workspace. */
  const applyCharacter = useCallback(
    async (c: CharacterData, given?: PieceUrls) => {
      setCharacter(c);
      // Nhân vật mới không có vật ấy thì cởi ra; `?equip=` lúc mở trang vẫn giữ được
      setViewState((v) => ({
        ...v,
        equip: Object.fromEntries(
          Object.entries(v.equip).filter(([, n]) => !n || n === BASE_ITEM || !!c.items[n]),
        ),
      }));
      const { urls, aspects } = given
        ? { urls: given, aspects: await measureAspects(given) }
        : await loadPieces(ws, c);
      setUrls(urls);
      setCharacter((cur) => {
        const d = structuredClone(cur);
        applyAspects(d, aspects);
        return d;
      });
    },
    [ws],
  );

  const listAll = useCallback((w: Workspace) => {
    const dirs: TextDir[] = ["characters", "actions", "props", "animals"];
    void Promise.all(dirs.map((d) => w.list(d).catch(() => [] as string[]))).then(
      async ([characters, actions, props, animals]) => {
        setRepo({ characters, actions, props, animals });
        // Đọc từng file để biết ai diễn được: `gen` là nguồn duy nhất, không đoán theo tên
        const kinds = await Promise.all(
          actions.map(async (f) => {
            try {
              const r = parseAction(JSON.parse(await w.readText("actions", f)));
              if (!r.success) return null;
              return actionKind(r.data) === "animal" ? "animal" : r.data.authoredAt;
            } catch {
              return null;
            }
          }),
        );
        setAnimalActions(actions.filter((_, i) => kinds[i] === "animal"));
        setSideActions(actions.filter((_, i) => kinds[i] === "side"));
      },
    );
    w.pieces()
      .then(setCatalog)
      .catch((e: unknown) => {
        console.warn(e);
        setCatalog({ schemaVersion: 1, pieces: [], parts: {} });
      });
  }, []);

  useEffect(() => listAll(ws), [ws, listAll]);

  // Thư mục của phiên trước, chỉ khi trình duyệt còn giữ quyền
  useEffect(() => {
    void recallDirectory().then((h) => h && setWs(openDirectory(h)));
    void servedLabel().then((l) => l && setWs((old) => (old.writable ? old : fixtureWorkspace(l))));
  }, []);

  const openWorkspaceAt = useCallback((h: FileSystemDirectoryHandle) => {
    setWs((old) => {
      old.release();
      return openDirectory(h);
    });
  }, []);

  const onOpenDirectory = useCallback(async () => {
    try {
      const h = await pickDirectory();
      await rememberDirectory(h);
      openWorkspaceAt(h);
      return null;
    } catch (e) {
      // người dùng bấm Huỷ trong hộp chọn thư mục
      if (e instanceof DOMException && e.name === "AbortError") return null;
      return e instanceof Error ? e.message : "Không mở được thư mục";
    }
  }, [openWorkspaceAt]);

  const onCloseDirectory = useCallback(() => {
    void forgetDirectory();
    setWs((old) => {
      old.release();
      return fixtureWorkspace();
    });
  }, []);

  const setPiece = useCallback(
    async (k: PieceKey, name: string, url: string) => {
      const img = await loadImage(url);
      setUrls((u) => ({ ...u, [name]: img.src }));
      mutate((d) => {
        const pc = worn(d, k);
        pc.src = "image";
        pc.file = name;
        pc.aspect = +(img.naturalWidth / img.naturalHeight).toFixed(4);
      });
    },
    [mutate, worn],
  );

  const onPieceFile = useCallback(
    (k: PieceKey, file: File) => setPiece(k, `${k}/${file.name}`, URL.createObjectURL(file)),
    [setPiece],
  );

  const pieceUrl = useCallback((file: string) => ws.pieceUrl(file), [ws]);

  const onPieceRepo = useCallback(
    async (k: PieceKey, entry: PieceCatalogEntry) => {
      await setPiece(k, entry.file, await ws.pieceUrl(entry.file));
      mutate((d) => applyPieceConfig(worn(d, k), entry.config));
    },
    [setPiece, ws, mutate, worn],
  );

  const onPiecePart = useCallback(
    (k: PieceKey, name: string) => {
      mutate((d) => {
        const pc = worn(d, k);
        pc.src = "part";
        pc.part = name;
        applyPieceConfig(pc, partConfig(name, catalog));
      });
    },
    [mutate, worn, catalog],
  );

  /**
   * Tóc dựng khối chỉ có ở mảnh nền `pieces.hair`, vật không mang được. Ghi đủ bộ số mặc định
   * để JSON đọc ra được ngay và thanh trượt có chỗ ghi.
   */
  const onPieceSculpt = useCallback(
    (preset: SculptPreset) =>
      mutate((d) => {
        const pc = d.pieces.hair;
        pc.src = "sculpt";
        pc.sculpt = SculptSchema.parse(SCULPT_PRESETS[preset].sculpt);
      }),
    [mutate],
  );

  /** Kính dựng khối cắm được cả vào vật: kính hay là đồ đeo vào tháo ra giữa cảnh */
  const onPieceGlasses = useCallback(
    (preset: GlassesPreset) =>
      mutate((d) => {
        const pc = worn(d, "faceAcc") as SocketPiece;
        pc.src = "sculpt";
        pc.glasses = GlassesSchema.parse(GLASSES_PRESETS[preset].glasses);
        pc.color ??= "#2d2d2d";
      }),
    [mutate, worn],
  );

  /** Mẫu râu thay cả `beard` và đặt luôn kiểu ria đi kèm của mẫu */
  const onPieceBeard = useCallback(
    (preset: BeardPreset) =>
      mutate((d) => {
        const pc = worn(d, "chin") as SocketPiece;
        pc.src = "sculpt";
        pc.beard = BeardSchema.parse(BEARD_PRESETS[preset].beard);
        d.face.moustache.kind = BEARD_PRESETS[preset].moustache;
      }),
    [mutate, worn],
  );

  /** Thân áo dựng khối cắm được cả vào vật; chọn kiểu là thay cả `garment`, số của kiểu lấy mặc định */
  const onPieceTorso = useCallback(
    (style: GarmentStyle) =>
      mutate((d) => {
        const pc = worn(d, "torso") as SocketPiece;
        pc.src = "sculpt";
        pc.garment = { style };
        if (style === "bare") pc.color ??= d.palette.skin;
      }),
    [mutate, worn],
  );

  /** Váy dựng khối cắm được cả vào vật; cạp nằm dưới gấu áo */
  const onPieceSkirt = useCallback(
    () =>
      mutate((d) => {
        const pc = worn(d, "hem") as SocketPiece;
        pc.src = "sculpt";
        pc.skirt = SkirtSchema.parse(pc.skirt ?? {});
        pc.layer = "under";
        pc.hideLegs = false;
      }),
    [mutate, worn],
  );

  const onClearPiece = useCallback(
    (k: PieceKey) => {
      mutate((d) => {
        const pc = worn(d, k);
        pc.src = "none";
        delete pc.file;
      });
    },
    [mutate, worn],
  );

  /** Về đúng căn mặc định của kiểu đang cắm; mảnh ngoài danh mục thì về số không. */
  const onResetPiece = useCallback(
    (k: PieceKey) => {
      const now = wornPiece(character, view.equip, k);
      if (now.src === "sculpt")
        return mutate((d) => {
          const pc = worn(d, k) as SocketPiece;
          if (k === "hair") d.pieces.hair.sculpt = SculptSchema.parse({});
          else if (k === "torso")
            pc.garment = { style: (now as SocketPiece).garment?.style ?? "tshirt" };
          else if (k === "chin") pc.beard = BeardSchema.parse({});
          else if (k === "hem") pc.skirt = SkirtSchema.parse({});
          else pc.glasses = GlassesSchema.parse({});
        });
      const part = piecePart(now);
      const file = pieceFile(now);
      const config = part
        ? partConfig(part, catalog)
        : catalog.pieces.find((e) => e.file === file)?.config;
      mutate((d) => {
        const tn = wornTune(d, view.equip, k, viewsOf(view), true);
        const pc = worn(d, k);
        // Đang xem hình riêng của một góc thì chỉ đưa bộ chỉnh của góc ấy về trung tính
        if (tn !== pc) {
          Object.assign(tn, { dx: 0, dy: 0, scale: 1, widthScale: 1, rotate: 0 });
          return;
        }
        pc.dx = 0;
        pc.dy = 0;
        pc.scale = 1;
        pc.rotate = 0;
        pc.widthScale = 1;
        if (config) applyPieceConfig(pc, config);
      });
    },
    [character, view, catalog, mutate, worn],
  );

  /** Căn hiện tại của mảnh thành mặc định lúc cắm, ghi vào danh mục của workspace. */
  const onSavePieceConfig = useCallback(
    async (k: PieceKey) => {
      const pc = wornPiece(character, view.equip, k);
      const part = piecePart(pc);
      const file = pieceFile(pc);
      const entry = catalog.pieces.find((e) => e.file === file);
      const target = part ? { part } : entry ? { entry } : null;
      if (!target) throw new Error("Mảnh nạp từ máy chưa có trong danh mục, không có chỗ lưu");
      await ws.savePieceConfig(target, pieceConfigOf(pc));
      setCatalog(await ws.pieces());
      return `Đã lưu vào pieces/catalog.json của ${ws.label}`;
    },
    [character, view.equip, catalog.pieces, ws],
  );

  const onSelectPiece = useCallback(
    (k: PieceKey | null) => {
      setSelPiece(k);
      if (k) setTab("character");
    },
    [setTab],
  );

  /** Thân đạo cụ là một socket lẻ: ảnh thì đo aspect từ chính ảnh như mảnh nhân vật. */
  const applyProp = useCallback(
    async (d: PropData) => {
      setProp(d);
      setPropUrl(undefined);
      const file = d.body.src === "image" ? d.body.file : undefined;
      if (!file) return;
      try {
        const img = await loadImage(await ws.pieceUrl(file));
        setPropUrl(img.src);
        mutateProp((x) => (x.body.aspect = +(img.naturalWidth / img.naturalHeight).toFixed(4)));
      } catch {
        console.warn(`Không nạp được thân đạo cụ: ${file}`);
      }
    },
    [ws, mutateProp],
  );

  const setBody = useCallback(
    async (name: string, url: string) => {
      const img = await loadImage(url);
      setPropUrl(img.src);
      mutateProp((x) => {
        x.body.src = "image";
        x.body.file = name;
        x.body.aspect = +(img.naturalWidth / img.naturalHeight).toFixed(4);
      });
    },
    [mutateProp],
  );

  const onBodyFile = useCallback(
    (file: File) => setBody(`prop/${file.name}`, URL.createObjectURL(file)),
    [setBody],
  );

  const onBodyRepo = useCallback(
    async (entry: PieceCatalogEntry) => {
      await setBody(entry.file, await ws.pieceUrl(entry.file));
      mutateProp((x) => applyPieceConfig(x.body, entry.config));
    },
    [setBody, ws, mutateProp],
  );

  const onBodyPart = useCallback(
    (name: string) => {
      setPropUrl(undefined);
      mutateProp((x) => {
        x.body.src = "part";
        x.body.part = name;
        const preset = PARTS[name]?.preset;
        if (preset?.scale !== undefined) x.body.scale = preset.scale;
        if (preset?.dy !== undefined) x.body.dy = preset.dy;
        if (preset?.widthScale !== undefined) x.body.widthScale = preset.widthScale;
      });
    },
    [mutateProp],
  );

  const onClearBody = useCallback(() => {
    setPropUrl(undefined);
    mutateProp((x) => {
      x.body.src = "none";
      delete x.body.file;
    });
  }, [mutateProp]);

  const onImportProp = useCallback(
    (text: string, file = "") => {
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return "JSON không hợp lệ";
      }
      const r = parseProp(json);
      if (!r.success)
        return r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      void applyProp(r.data);
      setPropFile(file);
      return null;
    },
    [applyProp],
  );

  const applyAnimal = useCallback(
    async (d: AnimalData) => {
      setAnimal(d);
      setAnimalUrls(await loadAnimalPieces(ws, d));
    },
    [ws],
  );

  const onImportAnimal = useCallback(
    (text: string, file = "") => {
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return "JSON không hợp lệ";
      }
      const r = parseAnimal(json);
      if (!r.success)
        return r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      void applyAnimal(r.data);
      setAnimalFile(file);
      return null;
    },
    [applyAnimal],
  );

  /** Hành động cho động vật: cùng `actions/` với người, khác nhau ở bộ sinh mà `gen` gọi tên */
  const onImportAnimalAction = useCallback((text: string, file = "") => {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return "JSON không hợp lệ";
    }
    const r = parseAction(json);
    if (!r.success)
      return r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    if (actionKind(r.data) !== "animal")
      return `\`${file}\` là hành động của người, không phải của động vật`;
    setAnimalAction(r.data);
    setAnimalActFile(file);
    return null;
  }, []);

  const onImport = useCallback(
    (text: string, file = "") => {
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return "JSON không hợp lệ";
      }
      const r = parseCharacter(json);
      if (!r.success)
        return r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      void applyCharacter(r.data);
      setCharFile(file);
      return null;
    },
    [applyCharacter],
  );

  const onImportAction = useCallback((text: string, file = "") => {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return "JSON không hợp lệ";
    }
    const r = parseAction(json);
    if (!r.success)
      return r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    setAction(r.data);
    setSel(0);
    setActFile(file);
    return null;
  }, []);

  /** Nạp file trong workspace rồi đẩy qua đúng đường import (có validate) như khi dán tay. */
  const loadRepo = useCallback(
    async (dir: TextDir, file: string, apply: Apply) => {
      try {
        return apply(await ws.readText(dir, file), file);
      } catch {
        return `Không đọc được ${file}`;
      }
    },
    [ws],
  );

  /** Đọc một hành động để xem thử, không nạp lên sân khấu; file hỏng trả `null`. */
  const readAction = useCallback(
    async (file: string) => {
      try {
        const r = parseAction(JSON.parse(await ws.readText("actions", file)));
        return r.success ? r.data : null;
      } catch {
        return null;
      }
    },
    [ws],
  );

  // Track dưới của người 3D: nạp lại khi đổi tên hay khi workspace đổi; lượt nạp cũ về muộn thì bỏ
  useEffect(() => {
    const file = view.under;
    if (!file) return;
    let live = true;
    void readAction(file).then((a) => live && setLoadedUnder({ file, from: readAction, a }));
    return () => {
      live = false;
    };
  }, [view.under, readAction]);
  const under =
    (view.under &&
      loadedUnder?.file === view.under &&
      loadedUnder.from === readAction &&
      loadedUnder.a) ||
    null;

  const loadRepoCharacter = useCallback(
    (file: string) => loadRepo("characters", file, onImport),
    [loadRepo, onImport],
  );

  const loadRepoAction = useCallback(
    (file: string) => loadRepo("actions", file, onImportAction),
    [loadRepo, onImportAction],
  );

  const loadRepoProp = useCallback(
    (file: string) => loadRepo("props", file, onImportProp),
    [loadRepo, onImportProp],
  );

  const loadRepoAnimal = useCallback(
    (file: string) => loadRepo("animals", file, onImportAnimal),
    [loadRepo, onImportAnimal],
  );

  const loadRepoAnimalAction = useCallback(
    (file: string) => loadRepo("actions", file, onImportAnimalAction),
    [loadRepo, onImportAnimalAction],
  );

  /** Ghi thẳng vào thư mục đang mở; tên file lấy theo tên trong JSON. */
  const save = useCallback(
    async (dir: TextDir, name: string, text: string) => {
      const file = `${name}.json`;
      try {
        await ws.writeText(dir, file, text + "\n");
        listAll(ws);
        return `Đã ghi ${dir}/${file}`;
      } catch (e) {
        return e instanceof Error ? e.message : `Không ghi được ${file}`;
      }
    },
    [ws, listAll],
  );

  const onSaveCharacter = useCallback(() => {
    const name = character.name || "character";
    return save("characters", name, JSON.stringify(character, null, 2)).then((m) => {
      setCharFile(`${name}.json`);
      return m;
    });
  }, [character, save]);

  const onNewAction = useCallback((a: ActionData) => {
    setAction(a);
    setSel(0);
    setActFile("");
  }, []);

  const onCloseAction = useCallback(() => {
    setAction(null);
    setActFile("");
  }, []);

  const onSaveAction = useCallback(() => {
    if (!frozen) return Promise.resolve("Chưa có hành động");
    const name = frozen.name || "action";
    return save("actions", name, JSON.stringify(frozen, null, 2)).then((m) => {
      setActFile(`${name}.json`);
      return m;
    });
  }, [frozen, save]);

  const onNewProp = useCallback(
    (d: PropData) => {
      void applyProp(d);
      setPropFile("");
    },
    [applyProp],
  );

  const onCloseProp = useCallback(() => {
    setProp(null);
    setPropUrl(undefined);
    setPropFile("");
  }, []);

  const onNewAnimal = useCallback(
    (d: AnimalData) => {
      void applyAnimal(d);
      setAnimalFile("");
    },
    [applyAnimal],
  );

  const onCloseAnimal = useCallback(() => {
    setAnimal(null);
    setAnimalUrls({});
    setAnimalFile("");
  }, []);

  const onNewAnimalAction = useCallback((a: ActionData) => {
    setAnimalAction(a);
    setAnimalActFile("");
  }, []);

  const onCloseAnimalAction = useCallback(() => {
    setAnimalAction(null);
    setAnimalActFile("");
  }, []);

  /** Cắm một ảnh vào socket động vật; hộp lấy từ bộ xương nên không phải đo `aspect` */
  const setAnimalPiece = useCallback(
    async (k: AnimalPieceKey, name: string, url: string) => {
      const img = await loadImage(url);
      setAnimalUrls((u) => ({ ...u, [name]: img.src }));
      mutateAnimal((d) => {
        d.pieces[k].src = "image";
        d.pieces[k].file = name;
      });
    },
    [mutateAnimal],
  );

  const onAnimalPieceFile = useCallback(
    (k: AnimalPieceKey, file: File) =>
      void setAnimalPiece(k, `${animalPieceDir(k)}/${file.name}`, URL.createObjectURL(file)),
    [setAnimalPiece],
  );

  const onAnimalPieceRepo = useCallback(
    async (k: AnimalPieceKey, entry: PieceCatalogEntry) => {
      await setAnimalPiece(k, entry.file, await ws.pieceUrl(entry.file));
    },
    [setAnimalPiece, ws],
  );

  const onClearAnimalPiece = useCallback(
    (k: AnimalPieceKey) => {
      mutateAnimal((d) => {
        d.pieces[k].src = "none";
        delete d.pieces[k].file;
      });
    },
    [mutateAnimal],
  );

  const onSaveAnimal = useCallback(() => {
    if (!animal) return Promise.resolve("Chưa có động vật");
    const name = animal.name || "animal";
    return save("animals", name, JSON.stringify(animal, null, 2)).then((m) => {
      setAnimalFile(`${name}.json`);
      return m;
    });
  }, [animal, save]);

  const onSaveAnimalAction = useCallback(() => {
    if (!animalAction) return Promise.resolve("Chưa có dáng đi");
    const name = animalAction.name || "animal-walk";
    return save("actions", name, JSON.stringify(animalAction, null, 2)).then((m) => {
      setAnimalActFile(`${name}.json`);
      return m;
    });
  }, [animalAction, save]);

  const onSaveProp = useCallback(() => {
    if (!prop) return Promise.resolve("Chưa có đạo cụ");
    const name = prop.name || "prop";
    return save("props", name, JSON.stringify(prop, null, 2)).then((m) => {
      setPropFile(`${name}.json`);
      return m;
    });
  }, [prop, save]);

  // ?character= ?action= ?prop= ?animal= ?animalAction= là tên file trong workspace
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const name = q.get("character");
    if (name) void loadRepoCharacter(name);
    const act = q.get("action");
    if (act) void loadRepoAction(act);
    const pr = q.get("prop");
    if (pr) void loadRepoProp(pr);
    const be = q.get("animal");
    if (be) void loadRepoAnimal(be);
    const ba = q.get("animalAction");
    if (ba) void loadRepoAnimalAction(ba);
  }, [loadRepoCharacter, loadRepoAction, loadRepoProp, loadRepoAnimal, loadRepoAnimalAction]);

  const onExportBundle = useCallback(async () => {
    const name = character.name || "character";
    download(await exportBundle(character, frozen, urls), `${name}.zip`);
  }, [character, frozen, urls]);

  const onImportBundle = useCallback(
    async (file: File) => {
      try {
        const b = await importBundle(file);
        await applyCharacter(b.character, b.urls);
        setAction(b.action);
        setCharFile("");
        setActFile("");
        return b.warn;
      } catch (e) {
        return e instanceof Error ? e.message : "Không đọc được zip";
      }
    },
    [applyCharacter],
  );

  const exportJson = useCallback(() => JSON.stringify(character, null, 2), [character]);
  const exportAction = useCallback(() => (frozen ? JSON.stringify(frozen, null, 2) : ""), [frozen]);
  const exportProp = useCallback(() => (prop ? JSON.stringify(prop, null, 2) : ""), [prop]);
  const exportAnimal = useCallback(() => (animal ? JSON.stringify(animal, null, 2) : ""), [animal]);
  // Cột Hành động và ô chọn hành động chỉ liệt kê hành động của người: hành động của động vật
  // không ghi khớp người nào, nạp nhầm thì nhân vật đứng im mà chẳng có gì báo
  const humanActions = repo.actions.filter((f) => !animalActions.includes(f));
  const propCatalog = catalog.pieces.filter((e) => e.socket === "prop");
  const exportAnimalAction = useCallback(
    () => (animalAction ? JSON.stringify(animalAction, null, 2) : ""),
    [animalAction],
  );

  const beast = left === "animal";
  /** Ai diễn trong ô xem thử của lưới hành động và dải mốc — cùng người đang đứng trên sân khấu */
  const subject = useMemo<Subject>(
    () =>
      beast && animal
        ? { kind: "animal", animal, urls: animalUrls }
        : { kind: "character", character, urls },
    [beast, animal, animalUrls, character, urls],
  );
  const stageAction = beast ? animalAction : action;
  const keySel = Math.min(sel, (stageAction?.keys?.length ?? 1) - 1);

  return (
    <div className="grid h-[100dvh] grid-cols-1 grid-rows-[46dvh_auto_minmax(0,1fr)] overflow-hidden md:grid-cols-[minmax(0,1fr)_340px] md:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[400px_minmax(0,1fr)_400px] lg:grid-rows-[minmax(0,1fr)]">
      <div className="flex min-h-0 min-w-0 flex-col items-center justify-center p-1 md:p-2 md:row-span-2 md:col-start-1 md:row-start-1 lg:row-span-1 lg:col-start-2 lg:p-4">
        <Stage
          subject={beast ? "animal" : "character"}
          character={character}
          action={action}
          under={under}
          urls={urls}
          view={view}
          setView={setView}
          sel={keySel}
          mutateAction={mutateAction}
          prop={prop}
          propUrl={propUrl}
          animal={animal}
          animalAction={animalAction}
          animalUrls={animalUrls}
          mutate={mutate}
          selected={selPiece}
          onSelect={onSelectPiece}
          onPickPiece={setPicking}
          onClearPiece={onClearPiece}
          onResetPiece={onResetPiece}
          paused={!!picking || pickingAction || showKeys}
        />
        <StageBar
          view={view}
          setView={setView}
          hasAction={!!stageAction}
          subject={beast ? "animal" : "character"}
          solid={!beast && action?.authoredAt === "side"}
          sideActions={sideActions.filter((f) => f !== actFile)}
        />
        {stageAction && (
          <Timeline
            action={stageAction}
            animal={beast ? animal : null}
            mutate={beast ? mutateAnimalAction : mutateAction}
            view={view}
            setView={setView}
            sel={keySel}
            setSel={setSel}
            onShowKeys={() => setShowKeys(true)}
          />
        )}
      </div>
      <div className="flex gap-1 border-y bg-card p-1 md:col-start-2 md:row-start-1 md:border-t-0 md:border-l lg:hidden">
        {([...LEFT_TABS, "action"] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={active(t) ? "secondary" : "ghost"}
            className="flex-1"
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </Button>
        ))}
      </div>
      <ScrollArea
        className={cn(
          "min-h-0 bg-card md:col-start-2 md:row-start-2 md:border-l lg:col-start-1 lg:row-start-1 lg:block lg:border-r lg:border-l-0",
          side !== "left" && "hidden",
        )}
      >
        <div className="hidden gap-1 border-b p-1 lg:flex">
          {LEFT_TABS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={left === t ? "secondary" : "ghost"}
              className="flex-1"
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </Button>
          ))}
        </div>
        {left === "prop" ? (
          <PropPanel
            prop={prop}
            mutate={mutateProp}
            view={view}
            setView={setView}
            url={propUrl}
            catalog={propCatalog}
            pieceUrl={pieceUrl}
            repoProps={repo.props}
            propFile={propFile}
            writable={ws.writable}
            onSave={onSaveProp}
            onLoadRepo={loadRepoProp}
            onImport={onImportProp}
            onNew={onNewProp}
            onClose={onCloseProp}
            onBodyFile={onBodyFile}
            onBodyRepo={onBodyRepo}
            onBodyPart={onBodyPart}
            onClearBody={onClearBody}
            exportJson={exportProp}
          />
        ) : left === "animal" ? (
          <AnimalPanel
            animal={animal}
            urls={animalUrls}
            mutate={mutateAnimal}
            view={view}
            setView={setView}
            catalog={catalog.pieces}
            pieceUrl={pieceUrl}
            repoAnimals={repo.animals}
            animalFile={animalFile}
            writable={ws.writable}
            onSave={onSaveAnimal}
            onLoadRepo={loadRepoAnimal}
            onImport={onImportAnimal}
            onNew={onNewAnimal}
            onClose={onCloseAnimal}
            onPieceFile={onAnimalPieceFile}
            onPieceRepo={onAnimalPieceRepo}
            onClearPiece={onClearAnimalPiece}
            exportJson={exportAnimal}
          />
        ) : (
          <Panel
            character={character}
            mutate={mutate}
            view={view}
            setView={setView}
            urls={urls}
            catalog={catalog.pieces}
            pieceUrl={pieceUrl}
            repoCharacters={repo.characters}
            characterFile={charFile}
            workspace={ws.label}
            writable={ws.writable}
            canOpenDirectory={canOpenDirectory()}
            onOpenDirectory={onOpenDirectory}
            onCloseDirectory={onCloseDirectory}
            onSave={onSaveCharacter}
            onPieceFile={onPieceFile}
            onPieceRepo={onPieceRepo}
            onLoadRepo={loadRepoCharacter}
            onClearPiece={onClearPiece}
            onPiecePart={onPiecePart}
            onSavePieceConfig={onSavePieceConfig}
            selected={selPiece}
            onSelect={onSelectPiece}
            onPick={setPicking}
            onImport={onImport}
            exportJson={exportJson}
            onExportBundle={onExportBundle}
            onImportBundle={onImportBundle}
          />
        )}
      </ScrollArea>
      <ScrollArea
        className={cn(
          "min-h-0 border-l bg-card md:col-start-2 md:row-start-2 lg:col-start-3 lg:row-start-1 lg:block",
          side !== "right" && "hidden",
        )}
      >
        <div className="hidden border-b p-1 lg:flex">
          <Button size="sm" variant="secondary" className="flex-1 pointer-events-none">
            {TAB_LABELS.action}
          </Button>
        </div>
        {beast ? (
          <AnimalActionPanel
            action={animalAction}
            animal={animal}
            mutate={mutateAnimalAction}
            view={view}
            setView={setView}
            sel={keySel}
            setSel={setSel}
            repoActions={animalActions}
            actionFile={animalActFile}
            writable={ws.writable}
            onSave={onSaveAnimalAction}
            onPick={() => setPickingAction(true)}
            onImport={onImportAnimalAction}
            onNew={onNewAnimalAction}
            onClose={onCloseAnimalAction}
            exportJson={exportAnimalAction}
          />
        ) : (
          <ActionPanel
            action={action}
            mutate={mutateAction}
            view={view}
            setView={setView}
            sel={Math.min(sel, (action?.keys?.length ?? 1) - 1)}
            setSel={setSel}
            items={Object.entries(character.items).map(([name, it]) => ({
              name,
              sockets: Object.keys(it) as PieceKey[],
            }))}
            outfits={character.outfits}
            character={character}
            under={under}
            repoActions={humanActions}
            actionFile={actFile}
            writable={ws.writable}
            onSave={onSaveAction}
            onPick={() => setPickingAction(true)}
            onImport={onImportAction}
            onNew={onNewAction}
            onClose={onCloseAction}
            exportJson={exportAction}
          />
        )}
      </ScrollArea>
      <ActionPicker
        open={pickingAction}
        onOpenChange={setPickingAction}
        files={beast ? animalActions : humanActions}
        value={beast ? animalActFile : actFile}
        subject={subject}
        view={view}
        readAction={readAction}
        onPick={beast ? loadRepoAnimalAction : loadRepoAction}
      />
      {stageAction && showKeys && (
        <KeyStrip
          open
          onOpenChange={(o) => !o && setShowKeys(false)}
          action={stageAction}
          under={beast ? null : under}
          subject={subject}
          view={view}
          sel={keySel}
          onPick={(t, i) => {
            setView({ scrub: t });
            if (i !== null) setSel(i);
          }}
        />
      )}
      {picking && (
        <PiecePicker
          socket={pieceDir(picking)}
          title={PIECE_LABELS[picking]}
          open
          onOpenChange={(o) => !o && setPicking(null)}
          entries={catalog.pieces.filter((e) => e.socket === pieceDir(picking))}
          parts={partsFor(picking)}
          value={
            wornPiece(character, view.equip, picking).src === "sculpt"
              ? picking === "hair"
                ? SCULPT + (sculptPresetOf(character.pieces.hair.sculpt) ?? "")
                : picking === "torso"
                  ? TORSO + torsoStyleOf(wornPiece(character, view.equip, picking) as SocketPiece)
                  : picking === "hem"
                    ? SKIRT
                    : picking === "chin"
                      ? BEARD +
                        (beardPresetOf(
                          (wornPiece(character, view.equip, picking) as SocketPiece).beard,
                        ) ?? "")
                      : GLASSES +
                        (glassesPresetOf(
                          (wornPiece(character, view.equip, picking) as SocketPiece).glasses,
                        ) ?? "")
              : piecePart(wornPiece(character, view.equip, picking))
                ? `part:${piecePart(wornPiece(character, view.equip, picking))}`
                : (pieceFile(wornPiece(character, view.equip, picking)) ?? "")
          }
          currentUrl={urls[pieceFile(wornPiece(character, view.equip, picking)) ?? ""]}
          pieceUrl={pieceUrl}
          onPick={(v) =>
            typeof v === "string" ? onPiecePart(picking, v) : void onPieceRepo(picking, v)
          }
          onSculpt={
            picking === "hair" && wornPiece(character, view.equip, "hair") === character.pieces.hair
              ? onPieceSculpt
              : undefined
          }
          onGlasses={picking === "faceAcc" ? onPieceGlasses : undefined}
          onBeard={picking === "chin" ? onPieceBeard : undefined}
          onTorso={picking === "torso" ? onPieceTorso : undefined}
          onSkirt={picking === "hem" ? onPieceSkirt : undefined}
        />
      )}
    </div>
  );
}
