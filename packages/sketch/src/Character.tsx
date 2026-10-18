import { useContext, useId, type ReactNode } from "react";
import {
  type ArmLayer,
  type ArmLayers,
  BACK_NAPE,
  type BodyPart,
  type BrowKind,
  type CharacterData,
  DEFAULT_LAYERS,
  DEFAULT_VIEW,
  type Equip,
  equipCharacter,
  type EyeKind,
  glassesPaths,
  hairstyleArt,
  headHalfWidth,
  headPath,
  hull,
  isFrontal,
  isProfile,
  latOf,
  limbPath,
  litTransform,
  lonOf,
  type MouthKind,
  PIECE_KEYS,
  pieceFile,
  type PieceKey,
  piecePart,
  type PieceUrls,
  type Pose,
  type Pt,
  REAR_FACE_SIZE,
  REAR_HAIRLINE,
  REAR_TEMPLE,
  rgb01,
  RIG,
  type Root,
  sculptPaths,
  SHADOW,
  torsoPaths,
  type View,
  viewArt,
  type World,
  limbWidths,
} from "@stickman3d/rig/core";
import {
  HEAD_KEYS,
  bodyArtView,
  figureAnchors,
  frameCompose,
  frameLocal,
  frameTransform,
  rootDrop,
  type Box,
  type FigureAnchors,
  type Frame,
} from "./anchor";
import { Moustache } from "./Moustache";
import { Wrinkle } from "./Wrinkle";
import { Brow } from "./Brow";
import { Eyes } from "./Eyes";
import { Head } from "./Head";
import { Mouth } from "./Mouth";
import { RigQualityContext } from "./quality";
import { SculptHair } from "./sculpt";
import { SculptGlasses } from "./glasses";
import { SculptBeard } from "./beard";
import { SculptTorso } from "./torso";
import { SculptSkirt } from "./skirt";
import { Part, PARTS } from "./Parts";

export interface CharacterProps {
  /** Hình dáng nền; `equip` quyết định socket nào lấy mảnh của vật nào */
  character: CharacterData;
  pose: Pose;
  /** Lớp vẽ của hai cẳng tay; cánh tay trên và vai áo không theo */
  layers?: ArmLayers;
  /** Ảnh đã nạp, khoá theo tên file trong `pieces/` */
  urls?: PieceUrls;
  /** Đang mặc gì; tên vật trong `character.items`. Scene ghi, xem docs/03-scene.md */
  equip?: Equip;
  x?: number;
  /** Đường đất; chân thấp hơn luôn chạm đường này (gốc `feet`), hay chính tâm hông (gốc `hip`) */
  groundY?: number;
  /**
   * `hip` là người ngồi trên lưng thú: treo ở hông thay cho bàn chân, không bóng tiếp đất.
   * `sceneAt` trả sẵn theo `cast[].mount`. docs/03-scene.md
   */
  root?: Root;
  /**
   * Thứ vẽ **giữa các lớp của người**: `mount` là con vật đang cưỡi — sau chân xa và cánh
   * tay xa, trước chân gần và thân áo; `mountFront` là cánh gần của nó, vẽ sau cùng;
   * `handNear` / `handFar` là thứ đang cầm — trong khung cổ tay ấy, cùng lớp với cẳng tay
   * ấy. `castSlots` dựng sẵn từ scene. docs/03-scene.md
   */
  slots?: Slots;
  /** Phóng quanh điểm chạm đất; không đổi độ dày nét tương đối */
  scale?: number;
  flip?: boolean;
  /**
   * Xoay cả người quanh gốc (`x`, `groundY`), độ theo chiều rig — dương là chân quét về phía mặt
   * nhìn, nên `90` là nằm ngửa — và lật theo `flip`. Khác `0` thì không có bóng tiếp đất.
   * `sceneAt` trả sẵn, tra `cast[].rotate`. docs/03-scene.md#nằm-và-xoay-cả-người
   */
  rotate?: number;
  /** Góc nhìn của thân; `sceneAt` trả sẵn, tra `cast[].view`. docs/01-rig.md#góc-nhìn */
  view?: View;
  /** Góc nhìn của đầu; bỏ trống là theo thân */
  headView?: View;
  mouth?: MouthKind;
  brow?: BrowKind;
  eyes?: EyeKind;
  /** Đậm của bóng tiếp đất; 0 = tắt */
  shadow?: number;
  /** Độ đục cả người; `sceneAt` trả sẵn, tra `cast[].fade` */
  opacity?: number;
  /**
   * Chỉ vẽ những khối này, vẫn theo thứ tự lớp của rig; bỏ trống là vẽ cả người. `sceneOrder`
   * trả sẵn cho người khai `cast[].zParts`. docs/03-scene.md#tách-người-theo-z
   */
  parts?: readonly BodyPart[];
  /**
   * Người 3D: chỗ đặt trong thế giới và ống kính; tay chân, thân áo dựng khối chiếu thật.
   * `sceneAt` trả sẵn cho người khai `cast[].world`. docs/01-rig.md#người-3d
   */
  world?: World;
}

export interface Slots {
  mount?: ReactNode;
  /** Cánh gần của con đang cưỡi: vẽ sau cả người, nên người ngồi **trong** cánh */
  mountFront?: ReactNode;
  handNear?: ReactNode;
  handFar?: ReactNode;
}

const CAP = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
/** Điểm điều khiển của đường gáy; clip của mảng tóc phải cong theo đúng nó */
const NAPE_SAG = 0.12;
/** Mảnh treo trong nhóm đầu: đi theo góc nhìn của đầu, không phải của thân */
/** Lông mày `side`: độ cao trên mắt dùng để đo viền đầu, và nửa dài nét cộng viền; khớp `Brow.tsx` */
const BROW_RISE = 24;
const BROW_REACH = 15;
/** Dải khép vết cắt râu `side`, theo bề dày nét viền; khớp `k` nét viền của râu trong `headwear.ts` */
const CHIN_EDGE = 0.55;
/** Mảnh nhận bóng khối; đầu nhận riêng vì nó vẽ bằng code */
const SHADED: ReadonlySet<PieceKey> = new Set<PieceKey>(["torso", "hem"]);

/** Vùng váy trên đùi lấn sang vùng thân bấy nhiêu: lượt vẽ trước phủ kín mép răng cưa của lượt sau */
const LAP_SEAM = 0.75;

/**
 * Mặt nạ của váy khi tách `lap`: lượt `lap` lấy vùng `clip` nở thêm `LAP_SEAM`, lượt thân lấy phần
 * còn lại của hộp `box` (hộp váy cùng `clip`). Mặt nạ chứ không cắt: cắt phủ mép răng cưa lên từng nét
 * con, lớp bóng khối đè hai lần thành một vệt sẫm dọc mép
 */
function lapMask(clip: Pt[], lap: boolean, skirt: Box) {
  const n = (v: number) => +v.toFixed(2);
  const poly = (pts: Pt[]) => `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}Z`;
  const xs = [skirt.x, skirt.x + skirt.w, ...clip.map((p) => p[0])];
  const ys = [skirt.y, skirt.y + skirt.h, ...clip.map((p) => p[1])];
  const box = {
    x: n(Math.min(...xs) - 2),
    y: n(Math.min(...ys) - 2),
    w: n(Math.max(...xs) - Math.min(...xs) + 4),
    h: n(Math.max(...ys) - Math.min(...ys) + 4),
  };
  const grown = hull(
    clip.flatMap(([x, y]) =>
      Array.from({ length: 8 }, (_, i): Pt => {
        const a = (i * Math.PI) / 4;
        return [x + LAP_SEAM * Math.cos(a), y + LAP_SEAM * Math.sin(a)];
      }),
    ),
  );
  const d = lap ? poly(grown) : `M${box.x} ${box.y}h${box.w}v${box.h}h${-box.w}Z${poly(clip)}`;
  return { d, box };
}

const partOfPiece = (c: CharacterData, k: PieceKey) => {
  const n = piecePart(c.pieces[k]);
  return n && PARTS[n] ? n : undefined;
};

/** Lớp của từng khúc tay và mảng tóc sau; `<Character>` và `drawSteps` cùng đọc */
function armLayout(c: CharacterData, A: FigureAnchors, layers: ArmLayers) {
  const V = A.views;
  // Thân `side` và `rear`: gốc chi xa quay ra sau khối thân (`limbSpread`)
  const sideways = V.body === "side" || V.body === "rear";
  // `side` / `rear` khoá cẳng tay xa dưới thân; `back` thì thứ ở trước ngực mới là thứ bị thân che
  const layerOf = (far: boolean): ArmLayer => {
    const l = layers[far ? "armFar" : "armNear"];
    if (sideways && far) return "back";
    if (V.body === "back") return l === "back" ? "mid" : "back";
    return l;
  };
  const sculpted = c.pieces.hair.src === "sculpt";
  const hairArt = viewArt(partOfPiece(c, "hair"), V.head);
  const hairOverShoulder =
    hairArt?.overHead === true || (sculpted && (c.pieces.hair.sculpt?.length ?? 0) > 0);
  const armN = A.fig.armN;
  return {
    sideways,
    sculpted,
    hairArt,
    foreFar: layerOf(true),
    foreNear: layerOf(false),
    // Đầu rộng hơn vai: tóc buông bên gần nằm gần ống kính hơn cánh tay trên đang thõng
    upperNear: (V.body === "side" && hairOverShoulder && armN[1][1] > armN[0][1]
      ? "mid"
      : layerOf(false)) as ArmLayer,
    // Mảng sau bằng ảnh nhìn từ sau nằm trên khối đầu; mặt rủ của tóc dựng khối tự tách trước sau
    hairBackOver: V.head === "back" && !sculpted,
  };
}

/**
 * Thứ tự `<Character>` vẽ các khối, mỗi bước là những khối một nét vẽ cần cùng lượt — đùi với
 * ống chân một nét liền, mảng tóc sau phủ đầu cần cả thân lẫn đầu. Một khối có thể ở nhiều bước;
 * bước có thể không vẽ gì (mảnh trống), nên đây là cận trên. Phải khớp JSX của `<Character>`.
 */
export function drawSteps(
  c: CharacterData,
  A: FigureAnchors,
  o: { layers?: ArmLayers; shadow?: number; root?: Root; rotate?: number } = {},
): BodyPart[][] {
  const L = armLayout(c, A, o.layers ?? DEFAULT_LAYERS);
  const back = A.views.body === "back";
  const s: BodyPart[][] = [];
  const add = (...p: BodyPart[]) => s.push(p);
  if ((o.shadow ?? SHADOW) > 0 && (o.root ?? "feet") === "feet" && !o.rotate) add("torso");
  if ((!back || L.sculpted) && !L.hairBackOver) add("torso");
  if (c.pieces.handFar.layer === "under" || c.pieces.handNear.layer === "under") add("torso");
  add("legFar", "shinFar");
  add("armFar");
  if (L.foreFar === "back") add("forearmFar");
  add("legNear", "shinNear");
  if (back) add("armNear");
  if (L.foreNear === "back") add("forearmNear");
  const lap = !!A.fig3?.lap && !!A.skirt;
  if (lap && c.pieces.hem.layer === "under") add("lap");
  add("torso");
  if (lap && c.pieces.hem.layer === "front") add("lap");
  if (L.foreFar === "mid") add("forearmFar");
  if (!back && L.upperNear !== "front") add("armNear");
  if (L.foreNear === "mid") add("forearmNear");
  if (back && !L.hairBackOver && !L.sculpted) add("torso");
  add("head");
  if (L.hairBackOver) add("torso", "head");
  if (L.foreFar === "front") add("forearmFar");
  if (!back && L.upperNear === "front") add("armNear");
  if (L.foreNear === "front") add("forearmNear");
  return s;
}

/**
 * Chia `order` (đã sắp) thành nhóm: mục liền nhau cùng một người gộp một nhóm khi một lượt
 * `<Character parts>` vẽ chúng y như từng lượt riêng theo đúng thứ tự ấy — mọi bước của khối
 * trước nằm trước mọi bước của khối sau trong `steps`, và không bước nào cần hai khối của nhóm.
 * `steps` trả `undefined` thì người ấy không gộp. Mục không phải khối người đứng riêng một nhóm.
 */
export function partGroups<T>(
  order: readonly T[],
  ref: (x: T) => { id: string; part: BodyPart } | undefined,
  steps: (id: string) => readonly (readonly BodyPart[])[] | undefined,
): T[][] {
  const out: T[][] = [];
  let last: { id: string; parts: BodyPart[]; s: readonly (readonly BodyPart[])[] } | undefined;
  const fits = (s: readonly (readonly BodyPart[])[], a: BodyPart, b: BodyPart) => {
    let seenB = false;
    for (const step of s) {
      const hasA = step.includes(a);
      const hasB = step.includes(b);
      if (hasA && hasB) return false;
      if (hasB) seenB = true;
      else if (hasA && seenB) return false;
    }
    return true;
  };
  for (const x of order) {
    const r = ref(x);
    if (r && last && last.id === r.id && last.parts.every((p) => fits(last!.s, p, r.part))) {
      last.parts.push(r.part);
      out[out.length - 1].push(x);
      continue;
    }
    const s = r && steps(r.id);
    last = r && s ? { id: r.id, parts: [r.part], s } : undefined;
    out.push([x]);
  }
  return out;
}

export function Character({
  character: raw,
  pose,
  layers = DEFAULT_LAYERS,
  urls = {},
  equip,
  x = 0,
  groundY = 0,
  root = "feet",
  slots = {},
  scale = 1,
  flip = false,
  rotate = 0,
  view = DEFAULT_VIEW,
  headView,
  mouth = "closed",
  brow = "neutral",
  eyes = "open",
  shadow = SHADOW,
  opacity = 1,
  parts,
  world,
}: CharacterProps) {
  const on = (p: BodyPart) => !parts || parts.includes(p);
  const uid = useId();
  const quality = useContext(RigQualityContext);
  const hairClipId = `hairclip${uid.replace(/:/g, "")}`;
  const shadowId = `shadow${uid.replace(/:/g, "")}`;
  const wrinkleClipId = `wrinkleclip${uid.replace(/:/g, "")}`;
  const mouthClipId = `mouthclip${uid.replace(/:/g, "")}`;
  const faceClipId = `faceclip${uid.replace(/:/g, "")}`;
  const napeClipId = `napeclip${uid.replace(/:/g, "")}`;
  const chinClipId = `chinclip${uid.replace(/:/g, "")}`;
  const chinEdgeId = `chinedge${uid.replace(/:/g, "")}`;
  const templeMaskId = `templemask${uid.replace(/:/g, "")}`;
  const chinInkId = `chinink${uid.replace(/:/g, "")}`;
  const lapMaskId = `lapmask${uid.replace(/:/g, "")}`;
  const tintId = (k: PieceKey) => `tint${k}${uid.replace(/:/g, "")}`;
  const flatId = (c: "white" | "black") => `flat${c}${uid.replace(/:/g, "")}`;
  const shadeId = (k: string) => `shade${k}${uid.replace(/:/g, "")}`;
  // Mặc trước rồi mới đo: `hideLegs` của tà áo và bao tóc đều đổi theo mảnh đang mặc
  const c = equipCharacter(raw, equip);
  // Hộp mảnh, nhóm treo và số đo nét mặt: một bảng duy nhất, `anchorAt` đọc lại chính nó
  const A = figureAnchors(c, pose, { body: view, head: headView ?? view }, mouth, world);
  const F = A.fig;
  const V = A.views;
  const viewOf = (k: PieceKey) => (HEAD_KEYS.includes(k) ? V.head : bodyArtView(V.body));
  const lay = armLayout(c, A, layers);
  const { sideways, hairArt, hairBackOver } = lay;
  const { rig, palette, face, pieces } = c;
  const wLine = rig.stroke;
  const faceDx = A.face.cx - A.face.headCx;

  // Socket có ảnh thì vẽ ảnh; có bộ phận code thì vẽ nó vào đúng hộp ấy; cả hai đều qua đây
  const partOf = (k: PieceKey) => partOfPiece(c, k);
  const urlOf = (k: PieceKey) => {
    const f = pieceFile(pieces[k]);
    return f ? urls[f] : undefined;
  };
  // Kiểu tóc: `hair` vẽ lớp trên ở mọi góc, `hairBack` là lớp `under` của nó ở chính diện
  const styleUnder = hairstyleArt(partOf("hair"), "under");
  // Tóc dựng khối chiếu từ vỏ ôm sọ ở mọi góc; `hairBack` khi ấy bị bỏ qua
  const sculpted = pieces.hair.src === "sculpt";
  // Trọng lực đo trong nhóm đầu: nhóm ấy xoay theo thân rồi nghiêng cổ; `rotate` cả người không tính — người nằm thì tóc nằm trên nệm
  const sculpt =
    sculpted &&
    sculptPaths(
      pieces.hair.sculpt,
      A.face.turn,
      c.head.shape,
      A.face.headCx,
      A.face.headCy,
      A.face.headRx,
      A.face.headRy,
      A.frames.head.deg,
      quality,
    );
  // Nét mặt `side` / `rear` dưới tóc dựng khối gật trong `frames.face`; không thì đó chính là nhóm đầu
  const faceIn = frameLocal(A.frames.face, A.frames.head);
  const faceT = frameTransform(faceIn) || undefined;
  const nodPlace =
    A.frames.face === A.frames.head
      ? undefined
      : ([x, y]: Pt): Pt => {
          const p = frameCompose(faceIn, { x, y, deg: 0 });
          return [p.x, p.y];
        };
  // Kính dựng khối chiếu theo đầu rồi khớp vào đúng chỗ nét mặt vẽ mắt; mặt `side` / `rear` vẽ ở lắc 90
  const glasses =
    pieces.faceAcc.src === "sculpt" &&
    glassesPaths(
      pieces.faceAcc.glasses,
      A.face.turn,
      [lonOf(face.eyeGap / 2, A.face.headRx), latOf(face.offsetY, A.face.headRy)],
      c.head.shape,
      A.face.headCx,
      A.face.headCy,
      A.face.headRx,
      A.face.headRy,
      A.face.free
        ? { x: A.face.free.eyeCx, y: A.face.cy, profile: false, yaw: A.face.free.yaw }
        : {
            x: A.face.cx,
            y: A.face.cy,
            profile: isProfile(V.head),
            yaw: isProfile(V.head) ? 90 : undefined,
            place: nodPlace,
          },
    );
  const beard = A.beard;
  // Thân áo dựng khối chiếu theo góc của thân; hộp của nó ở `A.slots.torso` tính từ cùng kết quả
  const bodyYaw = A.bodyYaw;
  const torsoSolid =
    pieces.torso.src === "sculpt" && torsoPaths(c, bodyYaw, wLine, A.fig3?.torsoLens);
  // Tóc dựng khối: `hairBack` là phần mặt rủ sau tâm đầu, vẽ sau thân như lớp `under` của kiểu tóc
  const tailOf = (k: PieceKey) => k === "hairBack" && (!!styleUnder || !!sculpt);
  const has = (k: PieceKey) =>
    (k === "faceAcc" && !!glasses) ||
    (k === "chin" && !!beard) ||
    (k === "torso" && !!torsoSolid) ||
    (k === "hem" && !!A.skirt) ||
    (sculpt && (k === "hair" || k === "hairBack")
      ? k === "hair" || !!sculpt.under
      : k === "hairBack" && hairstyleArt(partOf("hair"), "front")
        ? !!styleUnder && isFrontal(V.head)
        : !!urlOf(k) || !!partOf(k));
  const drawIn = (k: PieceKey, box: Box & { filter?: string; outline?: boolean }) => {
    if (k === "faceAcc" && glasses)
      return (
        <SculptGlasses
          paths={glasses}
          color={pieces.faceAcc.color ?? palette.garment}
          line={palette.line}
          stroke={wLine}
        />
      );
    if (k === "chin" && beard)
      return (
        <SculptBeard
          paths={beard}
          color={pieces.chin.color ?? face.moustache.color}
          line={palette.line}
          stroke={wLine}
          skull={frameTransform(frameLocal(A.frames.head, A.frames.face)) || undefined}
        />
      );
    if (k === "torso" && torsoSolid)
      return (
        <SculptTorso
          paths={torsoSolid}
          color={pieces.torso.color ?? palette.garment}
          accent={pieces.torso.accent}
          line={palette.line}
          stroke={wLine}
        />
      );
    if (k === "hem" && A.skirt)
      return (
        <SculptSkirt
          paths={A.skirt}
          color={pieces.hem.color ?? palette.garment}
          line={palette.line}
          stroke={wLine}
        />
      );
    if (sculpt && (k === "hair" || k === "hairBack")) {
      return (
        <SculptHair
          paths={
            k === "hair"
              ? sculpt
              : {
                  ...sculpt,
                  cap: sculpt.under,
                  capEdge: sculpt.underEdge,
                  back: "",
                  backEdge: "",
                  lines: [],
                  knot: "",
                  knotEdge: "",
                }
          }
          color={pieces.hair.color ?? palette.garment}
          line={palette.line}
          stroke={wLine}
        />
      );
    }
    const url = k === "hairBack" && styleUnder ? undefined : urlOf(k);
    if (url) {
      const tint = pieces[k].color ? `url(#${tintId(k)})` : undefined;
      const img = (
        <image
          href={url}
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          preserveAspectRatio="none"
          filter={tint ?? box.filter}
        />
      );
      // Hai filter không chồng lên một thẻ được: tô màu ở ảnh, pha nền ở nhóm bọc
      return tint && box.filter ? <g filter={box.filter}>{img}</g> : img;
    }
    const under = k === "hairBack" && !!styleUnder;
    const n = partOf(under ? "hair" : k);
    if (!n) return null;
    const pc = pieces[under ? "hair" : k];
    return (
      <g transform={`translate(${box.x} ${box.y})`} filter={box.filter}>
        <Part
          name={n}
          view={viewOf(k)}
          yaw={HEAD_KEYS.includes(k) ? undefined : bodyYaw}
          art={under ? styleUnder : k === "hair" ? hairstyleArt(n, V.head) : undefined}
          outline={box.outline}
          w={box.w}
          h={box.h}
          color={pc.color ?? palette.garment}
          accent={pc.accent}
          line={palette.line}
          stroke={wLine}
        />
      </g>
    );
  };

  /**
   * Bóng khối: màu nét phủ lên phần mảnh nằm ngoài vùng sáng, vùng sáng là chính hình ấy bóp
   * ngang quanh `cx` rồi dịch theo mặt. Mặt nạ lấy alpha của mảnh nên áo PNG, bộ phận code và
   * đầu đi chung một đường. docs/01-rig.md#bóng-khối
   */
  const shaded = (id: string, drawn: ReactNode, box: Box, cx: number) => {
    if (!(palette.shade > 0) || !drawn) return drawn;
    const m = shadeId(id);
    return (
      <>
        {drawn}
        <mask id={m} maskUnits="userSpaceOnUse" x={box.x} y={box.y} width={box.w} height={box.h}>
          <g filter={`url(#${flatId("white")})`}>{drawn}</g>
          <g filter={`url(#${flatId("black")})`} transform={litTransform(cx, faceDx)}>
            {drawn}
          </g>
        </mask>
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          fill={palette.line}
          fillOpacity={palette.shade}
          mask={`url(#${m})`}
        />
      </>
    );
  };

  /**
   * Vẽ một socket vào đúng hộp của nó. `frame` là nhóm mà chỗ gọi đang đứng trong —
   * chỗ treo tuyệt đối nằm ở `A.slots[k].frame`, đây chỉ lấy phần chênh. Nhóm mang
   * `data-piece` / `data-box` / `data-spin` là thứ studio bấm trúng và dựng khung chỉnh.
   */
  const piece = (
    k: PieceKey,
    opt: { frame?: Frame; filter?: string; clip?: string | 0; outline?: boolean } = {},
  ): ReactNode => {
    if (!has(k)) return null;
    const s = A.slots[k];
    const b = s.box;
    const whole = drawIn(k, { ...b, filter: opt.filter, outline: opt.outline });
    // Râu `side`: chỉ nửa gần, vết cắt ở mép mặt khép bằng một dải màu nét
    const raw =
      k === "chin" && chinHalf ? (
        <>
          <g clipPath={`url(#${chinClipId})`}>{whole}</g>
          <g clipPath={`url(#${chinEdgeId})`} filter={`url(#${chinInkId})`}>
            {whole}
          </g>
        </>
      ) : (
        whole
      );
    const drawn = SHADED.has(k) ? shaded(k, raw, b, b.x + b.w / 2) : raw;
    const el = s.spin ? (
      <g transform={`rotate(${s.spin} ${b.x + b.w / 2} ${b.y + b.h / 2})`}>{drawn}</g>
    ) : (
      drawn
    );
    const tagged = (
      <g
        data-piece={tailOf(k) ? "hair" : k}
        data-box={`${b.x} ${b.y} ${b.w} ${b.h}`}
        data-spin={s.spin}
      >
        {el}
      </g>
    );
    const local = frameTransform(frameLocal(s.frame, opt.frame ?? A.frames.torso));
    const placed = local ? <g transform={local}>{tagged}</g> : tagged;
    // Clip theo hệ của `opt.frame`: viền đầu đứng yên khi nét mặt gật trong `frames.face`
    return opt.clip ? <g clipPath={`url(#${opt.clip})`}>{placed}</g> : placed;
  };

  // `pts` luôn là cả chi ba khớp: nửa nào vẽ thì `seg` nói, đường cong cần cả ba mới liền tiếp tuyến
  const limb = ({ pts, color, w, seg }: { pts: Pt[]; color: string; w: number; seg?: 0 | 1 }) => {
    const d = limbPath(pts, palette.limbCurve, seg);
    return (
      <g>
        {palette.clad && <path d={d} stroke={palette.line} strokeWidth={w + wLine} {...CAP} />}
        <path d={d} stroke={color} strokeWidth={w} {...CAP} />
      </g>
    );
  };
  // Đùi và ống chân cùng lượt thì vẫn một nét liền như chưa tách; khác lượt thì mỗi lượt một nửa
  const leg = (far: boolean) => {
    const [up, low] = [on(far ? "legFar" : "legNear"), on(far ? "shinFar" : "shinNear")];
    if (!up && !low) return null;
    const ink = {
      pts: far ? F.legF : F.legN,
      color: palette.trouser,
      w: limbWidths(palette).trouser,
    };
    return limb(up && low ? ink : { ...ink, seg: up ? 0 : 1 });
  };
  const hideUpper = c.sleeveFit.hideUpperArm;
  // Tách ở khuỷu: khúc trên đi cùng vai áo, cẳng tay mới là khúc đổi lớp
  const arm = (far: boolean, fore: boolean) => {
    const k: PieceKey = far ? "sleeveFar" : "sleeveNear";
    const pts = far ? F.armF : F.armN;
    const ink = { color: palette.sleeve, w: limbWidths(palette).sleeve };
    if (fore) {
      const hand: PieceKey = far ? "handFar" : "handNear";
      const held = slots[hand];
      const wrist = A.joints[far ? "wristFar" : "wristNear"].frame;
      return (
        <g>
          {limb({ pts, seg: 1, ...ink })}
          {pieces[hand].layer !== "under" && piece(hand)}
          {held && (
            <g transform={frameTransform(frameLocal(wrist, A.frames.torso)) || undefined}>{held}</g>
          )}
        </g>
      );
    }
    // Thân `side` / `rear`: vai xa khuất hẳn sau thân, mảnh vai áo của nó không còn chỗ lộ
    const sleeve = !(far && sideways) && piece(k);
    return (
      <g>
        {!(hideUpper && has(k)) && limb({ pts, seg: 0, ...ink })}
        {sleeve}
      </g>
    );
  };
  const foreAt = (far: boolean, l: ArmLayer) =>
    on(far ? "forearmFar" : "forearmNear") &&
    (far ? lay.foreFar : lay.foreNear) === l &&
    arm(far, true);
  // Đồ cầm tay `under`: vẫn treo ở bàn tay, nhưng vẽ sau cả chân lẫn thân — đồ vác sau lưng
  const handUnder = (far: boolean) => {
    const k: PieceKey = far ? "handFar" : "handNear";
    return pieces[k].layer === "under" ? piece(k) : null;
  };
  const legsHidden = has("hem") && pieces.hem.hideLegs && !A.skirt;

  const ph = c.head;
  const { headCx, headCy, headRx, headRy, cx: faceCx, cy: faceCy, eyeGap, mouthCy } = A.face;
  const { mouthCx } = A.face;
  const free = A.face.free;
  const mouthSquash = free ? free.mouth : A.face.squash;
  const faced = !!free || V.head !== "back";
  const only = !free && isProfile(V.head) ? -1 : undefined;
  // Đầu `rear`: mắt và mày thu nhỏ quanh chính chúng
  const small = (cx: number) =>
    !free && V.head === "rear"
      ? `translate(${cx} ${faceCy}) scale(${REAR_FACE_SIZE}) translate(${-cx} ${-faceCy})`
      : undefined;
  // Đầu `side` / `rear`: viền đầu ở độ cao lông mày hẹp hơn ở mắt, nên mày lùi vào cho trọn trong viền
  const browCx = only
    ? Math.min(
        faceCx,
        headCx + headHalfWidth(ph.shape, headRx, headRy, faceCy - BROW_RISE - headCy) - BROW_REACH,
      )
    : faceCx;
  // Nhìn từ sau mà không có hình riêng: dáng mái chính diện làm viền ngoài, chỏm sọ lấp phần trong
  const capped = (V.head === "back" || V.head === "rear") && has("hair") && !hairArt && !sculpted;
  const napeY = headCy + headRy * BACK_NAPE;
  const napeHalf = headHalfWidth(ph.shape, headRx, headRy, napeY - headCy) - wLine / 2;
  // `rear` dựng từ chỏm: khoét má và thái dương bên gần, mép khoét là chân tóc; phía mặt không chìa quá bao tóc
  const temple = capped && V.head === "rear";
  const hairY = headCy - headRy * REAR_HAIRLINE;
  const templeX = headCx + headRx * REAR_TEMPLE;
  const bend = headRx * 0.14;
  const templeCut = `H ${templeX + bend} Q ${templeX} ${hairY} ${templeX} ${hairY + bend} C ${templeX - headRx * 0.04} ${headCy + headRy * 0.1} ${templeX - headRx * 0.1} ${headCy + headRy * 0.45} ${templeX - headRx * 0.3} ${napeY + headRy * 0.1} L ${templeX - headRx * 0.5} ${headCy + headRy * 2}`;
  // Bao tóc: viền đầu nở ra, mở thẳng xuống dưới tâm đầu để mảng rủ quá cằm không bị cắt
  const hairGrow = pieces.hair.clipGrow;
  const hairClip = pieces.hair.clip && !hairArt && !capped && !sculpted ? hairClipId : undefined;
  // Cầu kính `drawSide` vẽ dư về trước rồi cắt ở lòng viền đầu: dời kính đi đâu cũng chạm viền, không đè nét
  const faceAccSide =
    !!viewArt(partOf("faceAcc"), V.head) || !!PARTS[partOf("faceAcc") ?? ""]?.drawSide;
  const chinBox = A.slots.chin.box;
  const chinHalf = isProfile(V.head) && has("chin") && !beard && !viewArt(partOf("chin"), V.head);
  const headT = frameTransform(frameLocal(A.frames.head, A.frames.torso));
  const inHead = { frame: A.frames.head };
  // `under` cho râu quai nón: trên khối đầu, dưới miệng và ria — mảnh khỏi phải khoét chỗ mồm
  const chinPiece = (at: "front" | "under") =>
    (beard ? "under" : pieces.chin.layer) === at ? piece("chin", inHead) : null;
  // Váy trên đùi của người 3D ngồi (`lap`) vẽ riêng khi `parts` tách nó khỏi thân: mỗi lượt một vùng
  const lap = A.skirt && A.fig3?.lap && on("torso") !== on("lap") ? A.fig3.lap.clip : undefined;
  // `under` cho tà áo luồn trong áo: thân áo vẽ đè lên gấu
  const lapAt = lap && lapMask(lap, on("lap"), A.skirt!.box);
  const hemPiece = (at: "front" | "under") =>
    pieces.hem.layer !== at ? null : lap ? (
      <g mask={`url(#${lapMaskId})`}>{piece("hem")}</g>
    ) : on("torso") ? (
      piece("hem")
    ) : null;
  // Chiều rig ngược `rotate()` của SVG, và lật theo `flip` như mọi góc khớp
  const spin = rotate ? ` rotate(${flip ? rotate : -rotate})` : "";
  return (
    <g
      transform={`translate(${x} ${groundY}) scale(${scale})${spin} translate(0 ${-rootDrop(F.lowest, root)})`}
      opacity={opacity === 1 ? undefined : opacity}
    >
      <defs>
        {/* Ảnh mực — ruột trắng, nét đen — nhân với `color`; ảnh nhiều màu thì để trống `color` */}
        {PIECE_KEYS.filter((k) => urlOf(k) && pieces[k].color).map((k) => {
          const [r, g, b] = rgb01(pieces[k].color as string);
          return (
            <filter key={k} id={tintId(k)} colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values={`${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`}
              />
            </filter>
          );
        })}
        {palette.shade > 0 &&
          (["white", "black"] as const).map((c) => (
            <filter key={c} id={flatId(c)} colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values={`0 0 0 0 ${+(c === "white")}  0 0 0 0 ${+(c === "white")}  0 0 0 0 ${+(c === "white")}  0 0 0 1 0`}
              />
            </filter>
          ))}
        {chinHalf && (
          <>
            <clipPath id={chinClipId} clipPathUnits="userSpaceOnUse">
              <rect x={chinBox.x} y={chinBox.y} width={chinBox.w / 2} height={chinBox.h} />
            </clipPath>
            <clipPath id={chinEdgeId} clipPathUnits="userSpaceOnUse">
              <rect
                x={chinBox.x + chinBox.w / 2 - wLine * CHIN_EDGE}
                y={chinBox.y}
                width={wLine * CHIN_EDGE}
                height={chinBox.h}
              />
            </clipPath>
            <filter id={chinInkId} colorInterpolationFilters="sRGB">
              <feFlood floodColor={palette.line} result="ink" />
              <feComposite in="ink" in2="SourceAlpha" operator="in" />
            </filter>
          </>
        )}
        {lapAt && (
          <mask
            id={lapMaskId}
            maskUnits="userSpaceOnUse"
            x={lapAt.box.x}
            y={lapAt.box.y}
            width={lapAt.box.w}
            height={lapAt.box.h}
          >
            <path d={lapAt.d} fill="#fff" fillRule="evenodd" />
          </mask>
        )}
        {hairClip && (
          <clipPath id={hairClipId} clipPathUnits="userSpaceOnUse">
            <path d={headPath(ph.shape, headCx, headCy, headRx * hairGrow, headRy * hairGrow)} />
            <rect
              x={headCx - headRx * hairGrow}
              y={headCy}
              width={headRx * hairGrow * 2}
              height={RIG.headH * 2}
            />
          </clipPath>
        )}
        {(only || free) && (
          <clipPath id={faceClipId} clipPathUnits="userSpaceOnUse">
            <path d={headPath(ph.shape, headCx, headCy, headRx, headRy)} />
          </clipPath>
        )}
        {(only || free || isFrontal(V.head)) && (
          <clipPath id={mouthClipId} clipPathUnits="userSpaceOnUse">
            <path d={headPath(ph.shape, headCx, headCy, headRx - wLine / 2, headRy - wLine / 2)} />
          </clipPath>
        )}
        {capped && (
          <clipPath id={napeClipId} clipPathUnits="userSpaceOnUse">
            <path
              d={`M ${headCx - headRx * 2} ${headCy - headRy * 2} H ${headCx + headRx * 2} V ${napeY} H ${headCx + napeHalf} Q ${headCx} ${napeY + headRy * NAPE_SAG} ${headCx - napeHalf} ${napeY} H ${headCx - headRx * 2} Z`}
            />
          </clipPath>
        )}
        {temple && (
          <mask
            id={templeMaskId}
            maskUnits="userSpaceOnUse"
            x={headCx - headRx * 3}
            y={headCy - headRy * 3}
            width={headRx * 6}
            height={headRy * 6 + RIG.headH * 2}
          >
            <rect
              x={headCx - headRx * 3}
              y={headCy - headRy * 3}
              width={headRx * 6}
              height={headRy * 6 + RIG.headH * 2}
              fill="#fff"
            />
            <rect
              x={templeX}
              y={headCy - headRy * 0.6}
              width={headRx * 3}
              height={headRy * 4 + RIG.headH * 2}
              fill="#000"
            />
            <path
              d={headPath(ph.shape, headCx, headCy, headRx * hairGrow, headRy * hairGrow)}
              fill="#fff"
            />
            <path
              d={`M ${headCx + headRx * 3} ${hairY} ${templeCut} H ${headCx + headRx * 3} Z`}
              fill="#000"
            />
          </mask>
        )}
        {face.wrinkle.kind !== "none" && (
          <clipPath id={wrinkleClipId} clipPathUnits="userSpaceOnUse">
            <path d={headPath(ph.shape, headCx, headCy, headRx * 0.97, headRy * 0.97)} />
          </clipPath>
        )}
        {shadow > 0 && (
          <radialGradient id={shadowId}>
            <stop offset="0.45" stopColor={palette.line} stopOpacity={shadow} />
            <stop offset="1" stopColor={palette.line} stopOpacity={0} />
          </radialGradient>
        )}
      </defs>
      {shadow > 0 && root === "feet" && !rotate && on("torso") && (
        <ellipse
          cx={0}
          cy={F.lowest}
          rx={Math.abs(F.legN[2][0] - F.legF[2][0]) / 2 + F.shoulderSpan}
          ry={F.shoulderSpan * 0.32}
          fill={`url(#${shadowId})`}
        />
      )}
      <g transform={`scale(${flip ? -1 : 1} 1)`}>
        {/* Sau cả chân lẫn thân; nhóm treo là nhóm đầu, nên mang cả xoay thân lẫn nghiêng cổ */}
        {on("torso") && (V.body !== "back" || sculpt) && !hairBackOver && (
          <g transform={frameTransform(A.frames.head) || undefined}>{piece("hairBack", inHead)}</g>
        )}
        {on("torso") && (
          <g transform={frameTransform(A.frames.torso) || undefined}>
            {handUnder(true)}
            {handUnder(false)}
          </g>
        )}
        {!legsHidden && leg(true)}
        {/* Thứ tự lớp: docs/02-trang-phuc.md. Chi xa hết trước khi tới con vật đang cưỡi,
            rồi chân gần đè lên hông nó — chỗ duy nhất chen được vào giữa hai chân */}
        <g transform={frameTransform(A.frames.torso) || undefined}>
          {on("armFar") && arm(true, false)}
          {foreAt(true, "back")}
        </g>
        {slots.mount}
        {!legsHidden && leg(false)}
        <g transform={frameTransform(A.frames.torso) || undefined}>
          {/* Quay lưng: hai vai đều nằm hai bên lưng, thân che cả hai cánh tay trên */}
          {on("armNear") && V.body === "back" && arm(false, false)}
          {foreAt(false, "back")}
          {hemPiece("under")}
          {on("torso") && piece("torso", { outline: V.body === "back" })}
          {/* Treo ở khớp cổ, ngoài nhóm đầu: khăn quàng theo thân chứ không nghiêng theo đầu */}
          {on("torso") && piece("neck")}
          {hemPiece("front")}
          {foreAt(true, "mid")}
          {on("armNear") && V.body !== "back" && lay.upperNear !== "front" && arm(false, false)}
          {foreAt(false, "mid")}
          {/* Thân quay lưng mà đầu ngoái nghiêng: mảng tóc rủ phủ lưng áo nhưng vẫn sau khối đầu */}
          {on("torso") && V.body === "back" && !hairBackOver && !sculpt && (
            <g transform={headT || undefined}>{piece("hairBack", inHead)}</g>
          )}
          {on("head") && (
            <g transform={headT || undefined}>
              {/* Ruột, bóng khối, rồi mới nét viền: bóng nằm dưới nét như mọi mảnh */}
              {shaded(
                "head",
                <Head
                  shape={ph.shape}
                  cx={headCx}
                  cy={headCy}
                  rx={headRx}
                  ry={headRy}
                  fill={palette.skin}
                  stroke="none"
                  strokeWidth={0}
                />,
                { x: headCx - headRx, y: headCy - headRy, w: headRx * 2, h: headRy * 2 },
                headCx,
              )}
              <Head
                shape={ph.shape}
                cx={headCx}
                cy={headCy}
                rx={headRx}
                ry={headRy}
                fill="none"
                stroke={palette.line}
                strokeWidth={wLine}
              />
              {faced && (
                <>
                  <g clipPath={face.wrinkle.kind === "none" ? undefined : `url(#${wrinkleClipId})`}>
                    <g transform={faceT}>
                      <Wrinkle
                        wrinkle={face.wrinkle}
                        cx={faceCx}
                        cy={faceCy}
                        gap={face.eyeGap}
                        squeeze={A.face.squeeze}
                        mouthCy={mouthCy}
                        r={headRy}
                      />
                    </g>
                  </g>
                  {chinPiece("under")}
                  {/* Quay mạnh thì mắt, mày xa ra sát viền đầu: cắt theo lòng viền */}
                  <g clipPath={only ? undefined : `url(#${mouthClipId})`} transform={faceT}>
                    {free ? (
                      ([-1, 1] as const).map((s) => {
                        const k = s < 0 ? free.near : free.far;
                        return k > 0.02 ? (
                          <g key={s}>
                            <Eyes
                              kind={eyes}
                              cx={faceCx}
                              cy={faceCy}
                              gap={eyeGap}
                              only={s}
                              squash={k}
                              lid={face.lid}
                            />
                            <Brow
                              kind={brow}
                              cx={faceCx}
                              cy={A.face.browCy}
                              gap={eyeGap}
                              only={s}
                              squash={k}
                              width={face.browWidth}
                              tilt={face.browTilt}
                            />
                          </g>
                        ) : null;
                      })
                    ) : (
                      <>
                        <g transform={small(faceCx)}>
                          <Eyes
                            kind={eyes}
                            cx={faceCx}
                            cy={faceCy}
                            gap={eyeGap}
                            only={only ?? (A.face.farHidden ? -1 : undefined)}
                            squash={only ? undefined : A.face.squash}
                            lid={face.lid}
                          />
                        </g>
                        <g transform={small(browCx)}>
                          <Brow
                            kind={brow}
                            cx={browCx}
                            cy={A.face.browCy}
                            gap={eyeGap}
                            only={only ?? (A.face.farHidden ? -1 : undefined)}
                            squash={A.face.squash}
                            width={face.browWidth}
                            tilt={face.browTilt}
                          />
                        </g>
                      </>
                    )}
                  </g>
                  <g clipPath={`url(#${mouthClipId})`}>
                    <g transform={faceT}>
                      <Moustache
                        moustache={face.moustache}
                        mouth={mouth}
                        cx={mouthCx}
                        cy={mouthCy}
                        r={headRy}
                      />
                      <g
                        transform={
                          mouthSquash < 1
                            ? `translate(${mouthCx} 0) scale(${mouthSquash} 1) translate(${-mouthCx} 0)`
                            : undefined
                        }
                      >
                        <Mouth kind={mouth} cx={mouthCx} cy={mouthCy} />
                      </g>
                    </g>
                  </g>
                  {/* Kính, sẹo, mặt nạ: trôi đúng bằng nét mặt, dưới tóc và mũ */}
                  {piece("faceAcc", {
                    ...inHead,
                    clip: glasses
                      ? undefined
                      : (only || free) && (faceAccSide ? mouthClipId : faceClipId),
                  })}
                </>
              )}
              {/* Mảng sau bằng ảnh nhìn từ sau phủ đầu, dưới mái và mũ. */}
              {on("torso") && hairBackOver && piece("hairBack", inHead)}
              <g mask={temple ? `url(#${templeMaskId})` : undefined}>
                {piece("hair", { ...inHead, clip: hairClip, outline: capped })}
              </g>
              {capped && (
                <g mask={temple ? `url(#${templeMaskId})` : undefined}>
                  <path
                    d={headPath(ph.shape, headCx, headCy, headRx - wLine / 2, headRy - wLine / 2)}
                    fill={pieces.hair.color ?? palette.garment}
                    clipPath={`url(#${napeClipId})`}
                  />
                  {!has("hairBack") && (
                    <path
                      d={`M ${headCx - napeHalf} ${napeY} Q ${headCx} ${napeY + headRy * NAPE_SAG} ${headCx + napeHalf} ${napeY}`}
                      stroke={palette.line}
                      strokeWidth={wLine}
                      {...CAP}
                    />
                  )}
                </g>
              )}
              {temple && (
                <g clipPath={`url(#${mouthClipId})`}>
                  <path
                    d={`M ${headCx + headRx * 3} ${hairY} ${templeCut}`}
                    stroke={palette.line}
                    strokeWidth={wLine}
                    clipPath={`url(#${napeClipId})`}
                    {...CAP}
                  />
                </g>
              )}
              {piece("crown", inHead)}
              {/* Sừng, tai, vòng hoa: bám sọ, không trôi theo mặt; vẽ trên cả mũ */}
              {piece("headAcc", inHead)}
              {faced && chinPiece("front")}
            </g>
          )}
          {foreAt(true, "front")}
          {/* Đầu rộng hơn vai nên tay gần giơ cao là khuỷu nằm trong khối đầu; `front` nâng cả khúc trên */}
          {on("armNear") && lay.upperNear === "front" && arm(false, false)}
          {foreAt(false, "front")}
        </g>
        {/* Cánh gần của con đang cưỡi quạt trước mặt người ngồi trên lưng nó */}
        {slots.mountFront}
      </g>
    </g>
  );
}
