import {
  type AnimalAnchorName,
  animalAnchorOf,
  animalAt,
  beardPaths,
  type BeardPaths,
  body3,
  BROW_ABOVE,
  castCharacter,
  type CharacterData,
  clampViews,
  computeAnimalFigure,
  computeFigure,
  D,
  defaultCharacter,
  type Equip,
  equipCharacter,
  FACE_EYE_MIN,
  FACE_GAP_MIN,
  FACE_PITCH,
  FACE_REAL_FROM,
  FACE_REAL_SPAN,
  FACE_YAW,
  facePoint,
  faceYaw,
  type Figure,
  type Figure3,
  figure3d,
  figureOf3,
  flatPose,
  HAIR_BACK_H,
  hairstyleArt,
  headHalfWidth,
  headTurn,
  type HeadTurn,
  isFrontal,
  isProfile,
  isViewSocket,
  latOf,
  lonOf,
  type MouthKind,
  NECK_BOX,
  nodImage,
  onSkull,
  PIECE_KEYS,
  type PieceKey,
  piecePart,
  type Pose,
  POSES,
  PROP_BODY,
  type Pt,
  QUARTER,
  REAR_EYE,
  REAR_MOUTH_INSET,
  restYaw,
  RIG,
  type Root,
  sceneAt,
  type SceneRuntime,
  SIDE_CHIN_INSET,
  SIDE_EYE,
  SIDE_EYE_OVAL,
  SIDE_MOUTH_INSET,
  SIDE_TORSO,
  skirtPaths,
  type SkirtPaths,
  torsoPaths,
  torsoYaw,
  turnPoint,
  type View,
  VIEW_FRAME,
  viewArt,
  type Views,
  type ViewTune,
  type World,
  wornPiece,
} from "@stickman3d/rig/core";
import { PARTS } from "./Parts";
import { EYE_R } from "./Eyes";
import { mouthExtent } from "./Mouth";

/** Một nhóm treo: `translate(x, y) rotate(deg)`, `deg` là **độ SVG** (ngược dấu góc rig). */
export interface Frame {
  x: number;
  y: number;
  deg: number;
}

/** Hộp mảnh trong hệ của nhóm treo nó; gốc ở góc trên trái, như `data-box` trên DOM. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Chỗ treo một mảnh: hộp trong hệ của `frame`, cộng góc xoay quanh **tâm hộp** (độ SVG). */
export interface Slot {
  frame: Frame;
  box: Box;
  spin: number;
}

const ID: Frame = { x: 0, y: 0, deg: 0 };

const NEUTRAL: ViewTune = { dx: 0, dy: 0, scale: 1, widthScale: 1, rotate: 0 };

/** Hình riêng mà socket `k` vẽ ở góc `view`: `ViewArt`, hoặc `true` cho `drawSide` vẽ trong hộp `preset` */
function ownArt(pieces: CharacterData["pieces"], k: PieceKey, view: View) {
  const part = piecePart(pieces[k]);
  if (k === "faceAcc" && !viewArt(part, view))
    return isProfile(view) && !!PARTS[part ?? ""]?.drawSide;
  if (!isViewSocket(k)) return undefined;
  return (k === "hair" && hairstyleArt(part, view)) || viewArt(part, view);
}

/** Socket `k` ở góc `view` có đọc bộ chỉnh `pieces[k].views[view]` thay cho `dx` … `rotate` của mảnh không */
export const viewTuned = (pieces: CharacterData["pieces"], k: PieceKey, view: View): boolean =>
  !isFrontal(view) && !!ownArt(pieces, k, view);

/** Góc mà mảnh treo trên thân lấy hình và bộ chỉnh: thân `rear` chưa có hình riêng, mượn của `back` */
export const bodyArtView = (v: View): View => (v === "rear" ? "back" : v);

/** Socket treo trên khung đầu: góc nhìn của chúng là `views.head`, còn lại theo `views.body` */
export const HEAD_KEYS: readonly PieceKey[] = [
  "hair",
  "hairBack",
  "crown",
  "headAcc",
  "faceAcc",
  "chin",
];

/** Bộ chỉnh đang có hiệu lực của socket `k` ở góc `view`. docs/01-rig.md#bộ-chỉnh-theo-góc */
export const tuneOf = (pieces: CharacterData["pieces"], k: PieceKey, view: View): ViewTune =>
  viewTuned(pieces, k, view)
    ? (pieces[k].views?.[view as Exclude<View, "front" | "quarter">] ?? NEUTRAL)
    : pieces[k];

/** Môi dưới hạ, môi trên nhấc bao nhiêu so với mồm đóng, cho râu dựng khối mở khấc theo */
function mouthOpen(kind: MouthKind) {
  const [o, c] = [mouthExtent(kind), mouthExtent("closed")];
  return { down: Math.max(0, o.bottom - c.bottom), up: Math.max(0, c.top - o.top) };
}

const rotPt = (deg: number, x: number, y: number): Pt => {
  const a = deg * D;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
};

/** `inner` đặt bên trong `outer` — đúng nghĩa hai `<g transform>` lồng nhau. */
export function frameCompose(outer: Frame, inner: Frame): Frame {
  const [dx, dy] = rotPt(outer.deg, inner.x, inner.y);
  return { x: outer.x + dx, y: outer.y + dy, deg: outer.deg + inner.deg };
}

/** `inner` nhìn từ trong `outer`: chỗ vẽ lồng nhóm cần bản này, không phải bản tuyệt đối. */
export function frameLocal(inner: Frame, outer: Frame): Frame {
  const [dx, dy] = rotPt(-outer.deg, inner.x - outer.x, inner.y - outer.y);
  return { x: dx, y: dy, deg: inner.deg - outer.deg };
}

export const frameTransform = (f: Frame): string =>
  `${f.x || f.y ? `translate(${f.x} ${f.y})` : ""}${f.deg ? ` rotate(${f.deg})` : ""}`.trim();

/**
 * Khớp và mốc trên người, kèm khối đầu; mảnh ảnh thì hỏi bằng tên socket. `root` là điểm
 * chạm đất, `collar` là khớp cổ (chỗ treo khăn quàng), `wrist*` là cổ tay — rig không vẽ
 * bàn tay. Không tên nào được trùng `PIECE_KEYS`: socket luôn thắng.
 */
export const JOINT_NAMES = [
  "root",
  "hip",
  "hipNear",
  "hipFar",
  "kneeNear",
  "kneeFar",
  "footNear",
  "footFar",
  "shoulderNear",
  "shoulderFar",
  "elbowNear",
  "elbowFar",
  "wristNear",
  "wristFar",
  "collar",
  "head",
  "face",
  "eyeNear",
  "eyeFar",
  "mouth",
] as const;

export type JointName = (typeof JOINT_NAMES)[number];
export type AnchorName = JointName | PieceKey;
export const ANCHOR_NAMES = [...JOINT_NAMES, ...PIECE_KEYS] as const;

export const isPieceAnchor = (n: AnchorName): n is PieceKey =>
  (PIECE_KEYS as readonly string[]).includes(n);

/**
 * Một mốc đã quy về hệ toạ độ đang hỏi: tâm ở `x`/`y`, hộp `w`×`h` xoay `deg` độ SVG
 * quanh chính tâm ấy. Vẽ đè lên đúng chỗ đó là
 * `<g transform="translate(x y) rotate(deg)"><rect x={-w/2} y={-h/2} …/></g>`.
 */
export interface Anchor {
  x: number;
  y: number;
  deg: number;
  w: number;
  h: number;
  /** Hình đã lật ngang: hộp không đổi, nhưng nội dung soi gương */
  flip: boolean;
}

/** Số đo khối đầu và nét mặt trong hệ nhóm đầu; nét mặt chính diện chiếu từ sọ đơn vị theo `turn`. */
export interface FaceGeom {
  headCx: number;
  headCy: number;
  headRx: number;
  headRy: number;
  /** Tâm cụm mắt–mày, đã trôi theo lắc gật */
  cx: number;
  cy: number;
  eyeGap: number;
  mouthCy: number;
  /** Tâm mắt mà `<Brow>` nhận: mày chiếu từ sọ nên khoảng mắt–mày co lại khi gật */
  browCy: number;
  /** Hệ số bóp ngang khi lắc, cho nếp nhăn */
  squeeze: number;
  /** Hệ số bóp ngang của hình mắt, mày, mồm ở đầu `front` */
  squash: number;
  /** Mắt xa đã quay ra sau viền đầu */
  farHidden: boolean;
  /** Hướng khối đầu mà nét mặt chính diện và tóc dựng khối cùng chiếu theo */
  turn: HeadTurn;
  /** Tâm mồm; chỉ rời `cx` ở đầu `side`, nơi mồm ra sát viền đầu và bị cắt theo viền */
  mouthCx: number;
  /**
   * Người 3D có tóc dựng khối: nét mặt quay liên tục theo `theta`, không theo nấc. Bóp ngang của
   * mắt (kèm mày) mỗi bên và của mồm; mắt `0` là đã tắt
   */
  free?: {
    near: number;
    far: number;
    mouth: number;
    /** Góc quay mà nét mặt chiếu theo; kính dựng khối đặt mắt kính theo nó */
    yaw: number;
    /** Giữa hai mắt trên sọ, chưa trôi quá mép: chỗ khớp của kính dựng khối */
    eyeCx: number;
  };
}

/**
 * Khung trong nhóm đầu đưa nét mặt đặt như lúc không gật tới chỗ mà điểm `(x, y)` của nó đi tới khi
 * khối sọ gật `t.pitch`, xoay theo góc mà trục ngang của ảnh quay tới. Nhìn nghiêng trục gật chĩa
 * vào ống kính nên đây đúng là phép xoay quanh tâm đầu.
 */
function nodFrame(
  t: HeadTurn,
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): Frame {
  const [u1, v1] = nodImage(t, (x - cx) / rx, (y - cy) / ry);
  const [ax, ay] = turnPoint(t, [Math.cos(t.yaw * D), 0, Math.sin(t.yaw * D)]);
  const deg = Math.atan2(-ay * ry, ax * rx) / D;
  const [dx, dy] = rotPt(deg, x, y);
  return { x: cx + u1 * rx - dx, y: cy + v1 * ry - dy, deg };
}

/** Toàn bộ chỗ treo của một tư thế, gốc ở hông, chưa nhân `scale` và chưa lật. */
export interface FigureAnchors {
  fig: Figure;
  /** Người 3D: khớp thế giới và khối từng phần người */
  fig3?: Figure3;
  /** Góc quay của khối thân, độ: theo nấc, hay `theta` thật của người 3D */
  bodyYaw: number;
  /** Góc nhìn đã kẹp: thân `back` không đi với đầu `front`, thân chưa `back` không đi với đầu `back` */
  views: Views;
  /**
   * Nhóm xoay theo `torso`, nhóm đầu (đã gồm cả `torso`), và nhóm nét mặt trong nhóm đầu: đầu
   * `side` / `rear` có tóc dựng khối thì nó mang cái gật, còn lại trùng nhóm đầu
   */
  frames: { torso: Frame; head: Frame; face: Frame };
  face: FaceGeom;
  /** Râu dựng khối trong hệ của `frames.face`; hộp của nó là hộp mảnh `chin` */
  beard?: BeardPaths;
  /** Váy dựng khối trong hệ của `frames.torso`; hộp của nó là hộp mảnh `hem` */
  skirt?: SkirtPaths;
  slots: Record<PieceKey, Slot>;
  joints: Record<JointName, { frame: Frame; w: number; h: number }>;
}

/**
 * Bộ chỉnh sửa được tại chỗ của mảnh đang hiện ở socket `k`, ở góc đang xem. Studio kéo mảnh
 * và thanh trượt ghi vào đây; `create` dựng `views[view]` khi nó chưa có, chỉ dùng trong lượt ghi.
 */
export function wornTune(
  c: CharacterData,
  e: Equip | undefined,
  k: PieceKey,
  asked: Views,
  create = false,
): ViewTune {
  const worn = equipCharacter(c, e);
  const views = clampViews(asked, worn.pieces.torso.src === "sculpt");
  const view = HEAD_KEYS.includes(k) ? views.head : bodyArtView(views.body);
  const pc = wornPiece(c, e, k);
  if (isFrontal(view) || !viewTuned(worn.pieces, k, view)) return pc;
  if (!create) return pc.views?.[view] ?? NEUTRAL;
  return ((pc.views ??= {})[view] ??= { ...NEUTRAL });
}

/**
 * Chuỗi biến hình của `<Character>`, tính một lần và trả ra số. Đây là **chỗ duy nhất**
 * biết hộp mảnh treo ở đâu: `<Character>` vẽ bằng chính bảng này, `anchorAt` đọc lại nó.
 * Thêm socket hay đổi mốc treo thì sửa ở đây, chỗ vẽ đi theo.
 */
export function figureAnchors(
  c: CharacterData,
  raw: Pose,
  asked: Views = QUARTER,
  mouth: MouthKind = "closed",
  world?: World,
): FigureAnchors {
  const views = clampViews(asked, c.pieces.torso.src === "sculpt");
  const bodyArt = bodyArtView(views.body);
  // Người 3D: chuỗi chi chiếu từ khớp thế giới, rồi quy về tư thế 2D vẽ ra đúng chúng
  const f3 = world && figure3d(c, raw, world);
  const pose = f3 ? flatPose(c, raw, f3) : raw;
  const F = f3
    ? figureOf3(computeFigure(c, pose, views.body), f3, world.theta)
    : computeFigure(c, pose, views.body);
  const bodyYaw = world ? world.theta : torsoYaw(views.body, restYaw(c));
  const { rig, face, pieces, head: ph } = c;
  const aspectOf = (k: PieceKey) => {
    const n = piecePart(pieces[k]);
    return n && PARTS[n] ? PARTS[n].aspect : pieces[k].aspect;
  };

  const torso: Frame = { x: 0, y: 0, deg: pose.torso || 0 };
  const [tilt, turn, nod] = pose.head;
  const headRx = (RIG.headH / 2) * ph.scaleX;
  const headRy = (RIG.headH / 2) * ph.scaleY;
  const hh = headRy * 2;
  const headCx = ph.dx;
  const headCy = -headRy + ph.dy;
  const shrink = (a: number) => Math.max(FACE_GAP_MIN, Math.cos(a * D));
  const hv = views.head;
  // Tóc dựng khối quay theo đầu, nên nét mặt chính diện chiếu từ cùng khối sọ; tóc phẳng thì
  // nét mặt chỉ trôi theo `FACE_YAW` / `FACE_PITCH`
  const solid = pieces.hair.src === "sculpt";
  // Người 3D có tóc dựng khối: đầu quay liên tục theo `theta`, xem docs/01-rig.md#mặt-người-3d
  const free = !!world && solid;
  const T: HeadTurn = free
    ? { yaw: world.theta + turn, pitch: nod, look: f3?.look }
    : { ...headTurn(hv, face.turn, headRx, turn, nod), look: f3?.look };
  const projected = free || (solid && isFrontal(hv));
  // Đầu `side` / `rear` có tóc dựng khối: nét mặt đặt như lúc không gật, `frames.face` mang cái gật
  const spun = !free && solid && isProfile(hv);
  const eyeLat = latOf(face.offsetY, headRy);
  const eyeLon = lonOf(face.eyeGap / 2, headRx);
  const smooth = (k: number) => {
    const u = Math.max(0, Math.min(1, k));
    return u * u * (3 - 2 * u);
  };
  const real = smooth((T.yaw - FACE_REAL_FROM) / FACE_REAL_SPAN);
  const lerp = (a: number, b: number) => a + (b - a) * real;
  // Nét mặt quay theo `faceYaw` (chậm hơn đầu ở góc lớn), rồi trượt dần về góc thật
  const TF: HeadTurn = free ? { ...T, yaw: lerp(faceYaw(T.yaw, eyeLon, eyeLat), T.yaw) } : T;
  const facePt = free
    ? facePoint
    : (t: HeadTurn, lon: number, lat: number) => turnPoint(t, onSkull(lon, lat));
  const near = facePt(TF, -eyeLon, eyeLat);
  const far = facePt(TF, eyeLon, eyeLat);
  const faceDy = solid
    ? -headRy * (near[1] - Math.sin(eyeLat * D))
    : Math.sin(nod * D) * headRy * FACE_PITCH;
  // `side` / `rear` ghim mắt gần mép trước, lắc không còn nghĩa; `back` không có mặt nên không trôi gì
  const faceDx = free
    ? (headRx * (near[0] + far[0])) / 2
    : hv === "side"
      ? headRx * SIDE_EYE
      : hv === "rear"
        ? headRx * REAR_EYE
        : hv === "back"
          ? 0
          : projected
            ? (headRx * (near[0] + far[0])) / 2
            : (hv === "quarter" ? face.turn : 0) + Math.sin(turn * D) * headRx * FACE_YAW;
  const faceCx = headCx + faceDx;
  const faceDrift = spun ? 0 : faceDy;
  const faceCy = headCy + face.offsetY + faceDrift;
  const crownDx = faceDx * ph.follow;
  const crownDy = faceDy * ph.follow;
  const eyeGap = free
    ? headRx * (far[0] - near[0])
    : isProfile(hv)
      ? 0
      : projected
        ? headRx * (far[0] - near[0])
        : face.eyeGap * shrink(turn);
  // Bề ngang một nét nhỏ trên sọ co theo pháp tuyến của nó: z trên bán kính vòng vĩ tuyến
  const fore = ([, y, z]: number[]) => Math.max(0, z) / Math.sqrt(Math.max(1e-6, 1 - y * y));
  const browAt = facePt(TF, 0, latOf(face.offsetY - BROW_ABOVE, headRy));
  const browCy = projected ? headCy - headRy * browAt[1] + BROW_ABOVE : faceCy;
  const mouthLat = latOf(face.offsetY + face.mouthGap, headRy);
  const mouthAt = facePt(TF, 0, mouthLat);
  const mouthCy = projected
    ? headCy - headRy * mouthAt[1]
    : faceCy + face.mouthGap * (spun ? 1 : shrink(nod));
  // Tâm mồm nằm gần viền đầu, đo ở đúng độ cao mồm; nửa trước bị cắt theo viền
  const mouthEdge = headCx + headHalfWidth(ph.shape, headRx, headRy, mouthCy - headCy);
  const mouthCx = free
    ? headCx + headRx * mouthAt[0]
    : hv === "side"
      ? mouthEdge - headRx * SIDE_MOUTH_INSET
      : hv === "rear"
        ? mouthEdge - headRx * REAR_MOUTH_INSET
        : projected
          ? headCx + headRx * mouthAt[0]
          : faceCx;
  // Râu `side` / `rear` có hình riêng thì bám sọ; không có thì trục giữa ra mép trước mặt, `<Character>` cắt nửa xa
  const chinCx =
    isProfile(hv) && viewArt(piecePart(pieces.chin), hv)
      ? headCx
      : isProfile(hv)
        ? mouthEdge - headRx * SIDE_CHIN_INSET
        : faceCx;
  // Nét mặt gật trong `frames.face` thì râu dựng ở gật 0; khấc khớp vào mồm, `rear` quanh mồm quay như `side`
  const beard =
    pieces.chin.src === "sculpt"
      ? beardPaths(
          pieces.chin.beard,
          spun ? { yaw: T.yaw, pitch: 0 } : T,
          mouthLat,
          ph.shape,
          headCx,
          headCy,
          headRx,
          headRy,
          // Đầu quay liên tục: khấc theo góc nét mặt, khớp vào mồm trên sọ chứ không vào mồm đã trôi quá mép
          free
            ? {
                x: headCx + headRx * turnPoint(TF, onSkull(0, mouthLat))[0],
                y: mouthCy,
                yaw: TF.yaw,
                open: mouthOpen(mouth),
              }
            : {
                x: mouthCx,
                y: mouthCy,
                yaw: isProfile(hv) ? 90 : undefined,
                open: mouthOpen(mouth),
              },
        )
      : undefined;
  // Người 3D: cổ và tâm đầu ở chỗ chiếu thật, thân co theo góc cúi
  const neckY = f3 ? f3.neckY : -(F.len.torso + F.len.neck);
  const squash = f3 ? neckY / -(F.len.torso + F.len.neck) : 1;
  const neckDrop = Math.sin(nod * D) * F.len.neck * squash;
  const head = frameCompose(torso, {
    x: 0,
    y: (f3 ? f3.headY + headRy : neckY) + neckDrop,
    deg: tilt,
  });
  // Nét mặt `side` / `rear` ghim lệch chỗ thật trên sọ: nhìn từ trên xuống không dời nó theo `look`
  const faceFrame = spun
    ? frameCompose(
        head,
        nodFrame({ ...T, look: 0 }, faceCx, faceCy, headCx, headCy, headRx, headRy),
      )
    : head;

  /** Hộp của hình theo góc: khung `VIEW_FRAME` đặt theo xương, rồi áp bộ chỉnh của riêng góc ấy */
  const viewBox = (k: PieceKey, view: View, dx: number, dy: number): Box | undefined => {
    const art = ownArt(pieces, k, view);
    if (!art || art === true || !isViewSocket(k)) return undefined;
    const t = tuneOf(pieces, k, view);
    if (k === "sleeveNear" || k === "sleeveFar") return undefined;
    if (k === "hem") {
      const f = VIEW_FRAME.hem;
      const w = f.w * t.scale * t.widthScale;
      return {
        x: -w / 2 + t.dx,
        y: -f.hipY * rig.height * t.scale + t.dy,
        w,
        h: f.h * rig.height * t.scale,
      };
    }
    if (k === "torso" || k === "neck") {
      const f = VIEW_FRAME.torso;
      const w = f.w * t.scale * t.widthScale;
      return {
        x: -w / 2 + t.dx,
        y: -F.len.torso - f.neckY * rig.height * t.scale + t.dy,
        w,
        h: f.h * rig.height * t.scale,
      };
    }
    return skullBox(VIEW_FRAME[art.frame === "hairBack" ? "hairBack" : k], t, dx, dy);
  };

  // Phóng quanh tâm đầu, không quanh mép trên: `scale` lớn thì tóc nở đều quanh sọ
  const skullBox = (
    f: { w: number; h: number; cy: number; r: number },
    t: ViewTune,
    dx: number,
    dy: number,
  ): Box => {
    const u = (RIG.headH / 2 / f.r) * t.scale;
    const w = f.w * u * t.widthScale;
    return { x: -w / 2 + t.dx + dx, y: -hh + RIG.headH / 2 - f.cy * u + t.dy + dy, w, h: f.h * u };
  };

  // Hộp ảnh: cao theo đoạn đã nhân chiều cao, rộng theo đoạn gốc — chiều cao chỉ kéo dọc
  const hang = (
    frame: Frame,
    k: PieceKey,
    boxH: number,
    anchorY: number,
    boxW = boxH,
    dx = 0,
    dy = 0,
  ): Slot => {
    const view = frame === head ? hv : bodyArt;
    // Hình theo góc bám sọ: độ trôi ngang theo mặt là chuyện của hình chính diện
    const art = viewBox(k, view, isFrontal(view) ? dx : 0, dy);
    if (art) return { frame, box: art, spin: -tuneOf(pieces, k, view).rotate };
    // `drawSide` vẽ trong hộp `preset` của bộ phận, bộ chỉnh `side` đo từ đó
    const pre = viewTuned(pieces, k, view) && PARTS[piecePart(pieces[k]) ?? ""]?.preset;
    const t = tuneOf(pieces, k, view);
    const pc = pre
      ? {
          dx: (pre.dx ?? 0) + t.dx,
          dy: (pre.dy ?? 0) + t.dy,
          scale: (pre.scale ?? 1) * t.scale,
          widthScale: (pre.widthScale ?? 1) * t.widthScale,
          rotate: t.rotate,
        }
      : pieces[k];
    const h = boxH * pc.scale;
    // Thân áo chưa có hình `side` thì bóp `SIDE_TORSO`
    const narrow = k === "torso" && views.body === "side" ? SIDE_TORSO : 1;
    const w = boxW * pc.scale * aspectOf(k) * pc.widthScale * narrow;
    return {
      frame,
      box: { x: -w / 2 + pc.dx + dx, y: anchorY + pc.dy + dy, w, h },
      spin: -pc.rotate,
    };
  };

  // Vai áo xoay quanh chính khớp vai, không quanh tâm hộp — lệch khỏi khớp là hở đường ghép
  const sleeve = (far: boolean): Slot => {
    const k: PieceKey = far ? "sleeveFar" : "sleeveNear";
    const own = tuneOf(pieces, k, bodyArt);
    // sync bật thì tay xa mượn thông số tay gần; ảnh và aspect vẫn của riêng nó
    const pc =
      far && c.sleeveFit.syncFar
        ? { ...tuneOf(pieces, "sleeveNear", bodyArt), aspect: aspectOf(k) }
        : { ...own, aspect: aspectOf(k) };
    // Kéo dọc theo `stretch` cánh tay trên của tay ấy để mảnh vẫn phủ hết khúc ấy khi tay vươn
    const h = (F.len.upperArm * F.stretch[far ? 0 : 2] + F.cap) * pc.scale;
    const w = Math.max(
      (RIG.upperArm + F.cap) * pc.scale * pc.aspect * pc.widthScale,
      F.armOuter + rig.stroke,
    );
    const [sx, sy] = far ? F.shF : F.shN;
    const deg = (far ? pose.af : pose.an)[0];
    return {
      frame: frameCompose(torso, { x: sx, y: sy, deg: -(deg + pc.rotate) }),
      box: { x: -w / 2 + pc.dx, y: -F.cap + pc.dy, w, h },
      spin: 0,
    };
  };

  // Đồ cầm tay: hộp cao bằng cả cánh tay, tâm ở bàn tay, không kéo theo chiều cao
  const held = (far: boolean): Slot => {
    const k: PieceKey = far ? "handFar" : "handNear";
    const pc = pieces[k];
    const [sh, el, wr] = far ? pose.af : pose.an;
    const [wx, wy] = (far ? F.armF : F.armN)[2];
    const h = (RIG.upperArm + RIG.foreArm) * pc.scale;
    const w = h * aspectOf(k) * pc.widthScale;
    return {
      frame: frameCompose(torso, { x: wx, y: wy, deg: -(sh + el + wr + pc.rotate) }),
      box: { x: -w / 2 + pc.dx, y: -h / 2 + pc.dy, w, h },
      spin: 0,
    };
  };

  // Mảnh ảnh của thân không quay được: người 3D chỉ co dọc theo trục thân đã chiếu
  const squashed = (sl: Slot): Slot =>
    squash === 1 ? sl : { ...sl, box: { ...sl.box, y: sl.box.y * squash, h: sl.box.h * squash } };

  const skirt =
    pieces.hem.src === "sculpt"
      ? skirtPaths(c, F, pose.torso || 0, bodyYaw, rig.stroke, f3)
      : undefined;

  const slots: Record<PieceKey, Slot> = {
    // Thân áo dựng khối: hộp là hộp bao của chính hình chiếu, không đọc `dx` … `rotate`
    torso:
      pieces.torso.src === "sculpt"
        ? {
            frame: torso,
            box: torsoPaths(c, bodyYaw, rig.stroke, f3?.torsoLens).box,
            spin: 0,
          }
        : squashed(hang(torso, "torso", F.len.torso * 1.1, -F.len.torso, RIG.torso * 1.1)),
    sleeveNear: sleeve(false),
    sleeveFar: sleeve(true),
    neck: squashed(
      hang(torso, "neck", F.len.torso * NECK_BOX, neckY / squash, RIG.torso * NECK_BOX),
    ),
    hairBack: hairstyleArt(piecePart(pieces.hair), "under")
      ? {
          frame: head,
          box: skullBox(VIEW_FRAME.hairBack, pieces.hair, faceDx * ph.followBack, crownDy),
          spin: -pieces.hair.rotate,
        }
      : hang(
          head,
          "hairBack",
          RIG.headH * HAIR_BACK_H,
          -hh,
          RIG.headH * HAIR_BACK_H,
          faceDx * ph.followBack,
          crownDy,
        ),
    hair: hang(head, "hair", RIG.headH, -hh, RIG.headH, crownDx, crownDy),
    crown: hang(head, "crown", RIG.headH, -hh, RIG.headH, crownDx, crownDy),
    headAcc: hang(head, "headAcc", RIG.headH, -hh),
    // Kính dựng khối ở lại nhóm đầu: đuôi càng bám sọ ở góc gật thật, `glassesPaths` tự đưa mắt kính theo mặt
    faceAcc: {
      ...hang(head, "faceAcc", RIG.headH, -hh, RIG.headH, faceDx, faceDrift),
      frame: pieces.faceAcc.src === "sculpt" ? head : faceFrame,
      ...(pieces.faceAcc.src === "sculpt" && { spin: 0 }),
    },
    // Râu dựng khối tự khớp vào mồm, không xoay theo `rotate`
    chin: {
      ...hang(head, "chin", RIG.headH, -hh * 0.1, RIG.headH, chinCx - headCx, faceDrift),
      frame: faceFrame,
      ...(beard && { box: beard.box, spin: 0 }),
    },
    hem: skirt
      ? { frame: torso, box: skirt.box, spin: 0 }
      : hang(torso, "hem", F.len.thigh + F.len.shin, 0, RIG.thigh + RIG.shin),
    handNear: held(false),
    handFar: held(true),
  };

  // Đoạn xương rời khớp chỉ theo +y của khung, đúng như hộp mảnh — nên `deg` là góc rig đổi dấu
  const at = (base: Frame, p: Pt, rigDeg: number) =>
    ({ frame: frameCompose(base, { x: p[0], y: p[1], deg: -rigDeg }), w: 0, h: 0 }) as const;
  const inFrame = (f: Frame, x: number, y: number, w = 0, h = 0) => ({
    frame: frameCompose(f, { x, y, deg: 0 }),
    w,
    h,
  });
  const [af, an] = [pose.af, pose.an];

  const joints: FigureAnchors["joints"] = {
    root: { frame: { x: 0, y: F.lowest, deg: 0 }, w: 0, h: 0 },
    hip: { frame: torso, w: 0, h: 0 },
    hipNear: at(ID, F.legN[0], pose.ln[0]),
    hipFar: at(ID, F.legF[0], pose.lf[0]),
    kneeNear: at(ID, F.legN[1], pose.ln[0] + pose.ln[1]),
    kneeFar: at(ID, F.legF[1], pose.lf[0] + pose.lf[1]),
    footNear: at(ID, F.legN[2], pose.ln[0] + pose.ln[1]),
    footFar: at(ID, F.legF[2], pose.lf[0] + pose.lf[1]),
    shoulderNear: at(torso, F.shN, an[0]),
    shoulderFar: at(torso, F.shF, af[0]),
    elbowNear: at(torso, F.armN[1], an[0] + an[1]),
    elbowFar: at(torso, F.armF[1], af[0] + af[1]),
    wristNear: at(torso, F.armN[2], an[0] + an[1] + an[2]),
    wristFar: at(torso, F.armF[2], af[0] + af[1] + af[2]),
    collar: at(torso, [0, neckY], 0),
    head: inFrame(head, headCx, headCy, headRx * 2, headRy * 2),
    face: inFrame(faceFrame, faceCx, faceCy),
    eyeNear: inFrame(faceFrame, faceCx - eyeGap / 2, faceCy),
    eyeFar: inFrame(faceFrame, faceCx + eyeGap / 2, faceCy),
    mouth: inFrame(faceFrame, mouthCx, mouthCy),
  };

  // Mắt gần giữ oval như đầu `side` tới `FACE_REAL_FROM`; mắt xa mỏng dần theo góc thật của đầu
  const nearK = lerp(Math.max(SIDE_EYE_OVAL, fore(near)), fore(near));
  const farK = free ? fore(turnPoint(T, onSkull(eyeLon, eyeLat))) : 0;
  const innerEdge =
    headCx +
    headHalfWidth(ph.shape, headRx - rig.stroke / 2, headRy - rig.stroke / 2, faceCy - headCy);
  // Phần bề ngang mắt còn lộ trong lòng viền đầu
  const seen = (x: number, k: number) =>
    Math.max(0, Math.min(x + EYE_R * k, innerEdge) - (x - EYE_R * k)) / (2 * EYE_R);
  const shown = (x: number, k: number) => (seen(x, k) >= FACE_EYE_MIN ? k : 0);

  return {
    fig: F,
    fig3: f3 || undefined,
    bodyYaw,
    views,
    frames: { torso, head, face: faceFrame },
    face: {
      headCx,
      headCy,
      headRx,
      headRy,
      cx: faceCx,
      cy: faceCy,
      eyeGap,
      mouthCy,
      browCy,
      squeeze: projected
        ? Math.max(FACE_GAP_MIN, Math.cos(T.yaw * D))
        : isFrontal(hv)
          ? shrink(turn)
          : 1,
      squash: projected ? Math.max(SIDE_EYE_OVAL, Math.cos(T.yaw * D)) : 1,
      farHidden: projected && far[2] < 0.1,
      turn: T,
      mouthCx,
      free: free
        ? {
            near: shown(faceCx - eyeGap / 2, nearK),
            far: shown(faceCx + eyeGap / 2, farK),
            mouth: lerp(Math.max(SIDE_EYE_OVAL, fore(mouthAt)), fore(mouthAt)),
            yaw: TF.yaw,
            eyeCx:
              headCx +
              (headRx *
                (turnPoint(TF, onSkull(-eyeLon, eyeLat))[0] +
                  turnPoint(TF, onSkull(eyeLon, eyeLat))[0])) /
                2,
          }
        : undefined,
    },
    beard,
    skirt,
    slots,
    joints,
  };
}

/**
 * Hộp mà bộ phận chiếm ngay sau khi cắm, đã áp `preset`, ở socket đầu trong `sockets` của
 * nó và trên nhân vật (hay đạo cụ) mặc định. Ô xem trước vẽ vào đúng hộp này thì nét dày
 * mỏng bằng lúc mặc thật — vẽ vào hộp tự chọn là nét sai tỉ lệ.
 */
export function partBox(name: string): { w: number; h: number } {
  const def = PARTS[name];
  const { scale = 1, dy = 0, widthScale = 1 } = def.preset ?? {};
  const socket = def.sockets[0];
  if (socket === "prop") {
    const h = PROP_BODY * scale;
    return { w: h * def.aspect * widthScale, h };
  }
  const c = defaultCharacter();
  Object.assign(c.pieces[socket], { src: "part", part: name, scale, dy, widthScale });
  const { w, h } = figureAnchors(c, POSES.idle).slots[socket].box;
  return { w, h };
}

/** Tâm hộp và góc của một mốc, trong hệ hông (chưa nhân `scale`, chưa lật). */
export function anchorOf(fa: FigureAnchors, name: AnchorName): Omit<Anchor, "flip"> {
  if (isPieceAnchor(name)) {
    const s = fa.slots[name];
    const f = frameCompose(s.frame, {
      x: s.box.x + s.box.w / 2,
      y: s.box.y + s.box.h / 2,
      deg: s.spin,
    });
    return { x: f.x, y: f.y, deg: f.deg, w: s.box.w, h: s.box.h };
  }
  const j = fa.joints[name];
  return { x: j.frame.x, y: j.frame.y, deg: j.frame.deg, w: j.w, h: j.h };
}

/**
 * Mốc trên người trong **hệ toạ độ chỗ vẽ** của scene: cùng hệ mà `<Character>` nhận
 * `x` / `groundY` / `scale`, nên số trả ra cắm thẳng vào một `<g>` anh em của nó.
 * Đây là đường duy nhất để hiệu ứng bám vào người — đừng chép chuỗi biến hình ra ngoài rig.
 */
export function anchorAt(
  rt: SceneRuntime,
  id: string,
  name: AnchorName,
  time: number,
  cast: CharacterData = defaultCharacter(),
): Anchor {
  const m = rt.cast.find((q) => q.id === id);
  const character = m ? castCharacter(m, cast) : cast;
  const at = sceneAt(rt, id, time, character.rig.height, body3(character));
  const views = { body: at.view, head: at.headView };
  return placeAnchor(character, at.pose, name, { ...at, views }, at.equip);
}

/** Phần không cần scene: đặt một mốc của `pose` vào chỗ đứng đã biết. */
export function placeAnchor(
  character: CharacterData,
  pose: Pose,
  name: AnchorName,
  spot: Spot,
  equip?: Equip,
): Anchor {
  return anchorIn(
    figureAnchors(equipCharacter(character, equip), pose, spot.views, "closed", spot.world),
    name,
    spot,
  );
}

/** Chỗ đứng mà `<Character>` nhận; `sceneAt` trả sẵn cả bốn trường. */
export type Spot = {
  x: number;
  groundY: number;
  scale: number;
  flip: boolean;
  root?: Root;
  views?: Views;
  /** Người 3D — `sceneAt` trả sẵn */
  world?: World;
  /** Xoay cả người quanh gốc, độ theo chiều rig, lật theo `flip`; như `<Character rotate>` */
  rotate?: number;
};

/** Bước cuối trong transform của `<Character>`: `feet` trừ bàn chân thấp nhất, `hip` không trừ gì. */
export const rootDrop = (lowest: number, root: Root = "feet") => (root === "hip" ? 0 : lowest);

/** Điểm và góc trong hệ hông ra hệ chỗ vẽ, đúng thứ tự transform của `<Character>`: lật, hạ gốc, xoay quanh gốc, phóng, dời. */
function onStage(p: { x: number; y: number; deg: number }, spot: Spot, lowest: number) {
  const sx = spot.flip ? -1 : 1;
  const r = sx * -(spot.rotate ?? 0);
  const lx = sx * p.x;
  const ly = p.y - rootDrop(lowest, spot.root);
  const cos = Math.cos(r * D);
  const sin = Math.sin(r * D);
  return {
    x: spot.x + spot.scale * (lx * cos - ly * sin),
    y: spot.groundY + spot.scale * (lx * sin + ly * cos),
    deg: sx * p.deg + r,
  };
}

/** Dời gốc `feet` bao nhiêu, hệ chỗ vẽ, để hông đứng yên khi bàn chân thấp nhất xuống thêm `dLowest` — nghịch của `onStage`. */
export function hipHoldShift(spot: Pick<Spot, "scale" | "flip" | "rotate">, dLowest: number) {
  const r = (spot.flip ? -1 : 1) * -(spot.rotate ?? 0) * D;
  return { x: -spot.scale * dLowest * Math.sin(r), y: spot.scale * dLowest * Math.cos(r) };
}

/** Hỏi nhiều mốc của cùng một tư thế thì dựng bảng một lần rồi gọi bản này. */
export function anchorIn(fa: FigureAnchors, name: AnchorName, spot: Spot): Anchor {
  const a = anchorOf(fa, name);
  return {
    ...onStage(a, spot, fa.fig.lowest),
    w: a.w * spot.scale,
    h: a.h * spot.scale,
    flip: spot.flip,
  };
}

/**
 * Mốc trên một con vật trong **hệ toạ độ chỗ vẽ**, như `anchorAt` với người: `saddle` để
 * căn người cưỡi, `muzzle` để buộc cương, bàn chân để đặt hiệu ứng. Con đang bị xách nằm
 * trong tay người, nên cần JSON của người ấy để đi qua khung cổ tay — bỏ trống là người mẫu.
 */
export function animalAnchorAt(
  rt: SceneRuntime,
  id: string,
  name: AnimalAnchorName,
  time: number,
  carrierData: CharacterData = defaultCharacter(),
): Anchor {
  const a = rt.animals.find((m) => m.id === id);
  if (!a) throw new Error(`scene: không có \`${id}\` trong \`animals\``);
  const at = animalAt(rt, id, time);
  const F = computeAnimalFigure(a.spec, at.pose);
  const p = animalAnchorOf(a.spec, F, name);
  const drop = rootDrop(F.lowest, at.root);
  if (a.host?.kind !== "carry") {
    const sx = at.flip ? -1 : 1;
    return {
      x: at.x + at.scale * sx * p.x,
      y: at.groundY + at.scale * (p.y - drop),
      deg: sx * -p.deg,
      w: p.w * at.scale,
      h: p.h * at.scale,
      flip: at.flip,
    };
  }
  // Trong tay: hệ con vật → khung cổ tay (translate · rotate · scale · lật) → thân → chỗ đứng của người
  const host = rt.cast.find((q) => q.id === a.host!.id);
  const carrier = host ? castCharacter(host, carrierData) : carrierData;
  const cs = sceneAt(rt, a.host.id, time, carrier.rig.height);
  const c = cs.carried.find((k) => k.id === id);
  if (!c) throw new Error(`scene: \`${a.host.id}\` không cầm \`${id}\``);
  const fa = figureAnchors(equipCharacter(carrier, cs.equip), cs.pose, {
    body: cs.view,
    head: cs.headView,
  });
  const wrist = fa.joints[c.socket === "handNear" ? "wristNear" : "wristFar"].frame;
  const fx = c.flip ? -1 : 1;
  const inHand = frameCompose(
    { x: c.x, y: c.groundY, deg: -c.rotate },
    { x: fx * c.scale * p.x, y: c.scale * p.y, deg: fx * -p.deg },
  );
  const local = frameCompose(wrist, inHand);
  return {
    ...onStage(local, cs, fa.fig.lowest),
    w: p.w * cs.scale * c.scale,
    h: p.h * cs.scale * c.scale,
    flip: cs.flip !== c.flip,
  };
}
