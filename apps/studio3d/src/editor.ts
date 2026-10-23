// Soạn kiểu cầm bằng mắt: khung riêng chỉ có bàn tay đang chọn (đúng bên, cỡ tay của người ấy) và món (bản sao lưới món
// của cảnh, giữ vật liệu NPR), bàn tay đứng yên, xoay như trong cảnh, kèm bóng cẳng tay. Khung vẽ bằng sân khấu, pipeline
// riêng của rig (đèn, nét mực, bóng như cảnh). Món dời / xoay bằng TransformControls; ngón chọn bằng cách nhấp lên hình,
// kéo để gập, hay theo thanh kéo; rig dựng lại khung cầm từ bản soạn (`authoredFromSide` → `graspFrame`, như cảnh sẽ dựng)
// rồi ngón ôm (`heldFit`) và đo lún / hở như `check`. Lưu là `authored` của `held/<món>.json` (`POST /api/held`), luôn
// ghi tay phải: soạn ở tay trái thì đổi về tay phải bằng nghịch của gương mà rig dựng tay trái.
// docs/11-nhom-cam.md § Kiểu cầm soạn tay
import * as rig from "@stickman3d/rig";
import type {
  AaMode,
  AuthoredGrasp,
  GraspChoice,
  GraspFrame,
  GripFrame,
  GroupId,
  HandPiece,
  HandPose,
  HeldHand,
  HeldItemSpec,
  HeldOptions,
  HeldFinger,
  ItemGeom,
  LightRig,
  PaletteName,
  RenderOptions,
  Stage,
  V3,
} from "@stickman3d/rig";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { wheelPans, type WheelMode } from "./freecam";
import { hitsHtml, fingerTable, type HandRow } from "./hands";
import { copyAuthored, nameProblem } from "./named";
import { copyDialog, saveAsDialog } from "./namedUi";

/** Góc nhìn của khung soạn: như camera đang xem cảnh, ba góc `can-tay`, lòng tay, mu tay */
export type EditView = "canh" | "truoc" | "cheo" | "ngang" | "long" | "mu";
const VIEWS: Record<EditView, string> = {
  canh: "Như trong cảnh",
  truoc: "Trước",
  cheo: "Chéo",
  ngang: "Ngang",
  long: "Lòng tay",
  mu: "Mu tay",
};

/** Bàn tay ấy trong cảnh: khung soạn đặt đúng bàn tay ấy (cả bên tay), không soi gương */
export interface EditScene {
  /** Hướng khung bàn tay trong thế giới (khung soạn đặt bàn tay đúng hướng này) */
  q: THREE.Quaternion;
  /** Khuỷu trong khung bàn tay (cỡ người 1): cẳng tay đi từ cổ tay (gốc) tới đây */
  elbow: THREE.Vector3;
  /** Hướng từ tâm nắm ra camera đang xem cảnh, và ra camera ba góc cận tay (thế giới, đơn vị) */
  views: Record<"canh" | "truoc" | "cheo" | "ngang", THREE.Vector3>;
  /** Vật liệu da, vỏ nét của bàn tay trong cảnh */
  skin?: THREE.Material;
  hull?: THREE.Material;
  background: THREE.Color;
  render: RenderOptions;
  /** Giờ trong ngày và bộ đèn (bỏ đèn đặt chỗ: khung soạn không có phòng) */
  palette: PaletteName;
  lights: LightRig;
  /** Giây cảnh (nhiễu nét, chấm theo giờ) */
  t: number;
}

/** Một lần soạn: món × nhóm × biến thể của bàn tay đã chọn */
export interface EditTarget {
  row: HandRow;
  /** Tên file `held/` của món */
  base: string;
  spec: HeldItemSpec;
  group: GroupId;
  variant: string;
  /** Lựa chọn cầm của cảnh ở giây ấy (`GraspReport.choice`) */
  choice: GraspChoice;
  /** Đầu cao của cạnh mà cảnh dùng (khung món) */
  high?: V3;
  /** Cỡ bàn tay, cỡ dọc của người đang chọn; `s` cỡ món trong khung bàn tay (người cỡ `s`) */
  k: number;
  long: number;
  s: number;
  object: THREE.Object3D;
  /** Tay nhỏ nhất, lớn nhất của dàn nhân vật */
  sizes: { name: string; k: number; long: number }[];
  scene: EditScene;
}

/** Kết quả "Lưu thành kiểu mới": món đã lưu (parse), lời báo; `error` khi món đã lưu mà cảnh không đổi được */
export interface SavedAs {
  spec: HeldItemSpec;
  message: string;
  error?: boolean;
}

/**
 * Việc trang làm cho khung soạn: áp tạm bản soạn vào cảnh, lưu (khoá đang mở, kiểu mới, chép sang món khác), thoát; lần
 * cầm của bàn tay đang soạn; các món của cảnh; kiểu lăn và khử răng cưa đang chọn
 */
export interface EditHost {
  preview(t: EditTarget, au: AuthoredGrasp | null): Promise<void>;
  save(t: EditTarget, au: AuthoredGrasp | null): Promise<string>;
  /** Ghi `au` vào khoá `name` của món; `use` thì ghi `variant` vào lần cầm đang soạn (sau khi món đã lưu) */
  saveAs(t: EditTarget, au: AuthoredGrasp, name: string, use: boolean): Promise<SavedAs>;
  /** Ghi `au` vào khoá `name` của món `dst` (cùng nhóm), trả file */
  copyTo(t: EditTarget, dst: string, name: string, au: AuthoredGrasp): Promise<string>;
  run(t: EditTarget): { label: string; keys: number } | undefined;
  /** Mốc của cảnh đang mở còn gọi kiểu có tên đang soạn (để cảnh báo trước khi xoá bản soạn); biến thể gốc thì rỗng */
  uses(t: EditTarget): string[];
  held(): Record<string, HeldItemSpec>;
  close(): void;
  wheel(): WheelMode;
  aa(): AaMode;
}

type Finger = HeldFinger;
const FINGER_NAMES: Record<Finger, string> = {
  thumb: "Ngón cái",
  index: "Ngón trỏ",
  middle: "Ngón giữa",
  ring: "Ngón áp út",
  pinky: "Ngón út",
};

/** Một thanh kéo: góc ngón (`f`, chỉ số trong mười góc ngón — `HAND_DOF` bỏ `turn`, `bend`) hay `HAND_FIT` (`fit`) */
interface Knob {
  k: "f" | "fit";
  i: number;
  label: string;
  /** Đốt đổi theo thanh: tô trên hình khi rê chuột lên thanh */
  pieces: HandPiece[];
}
const f = (i: number, label: string, pieces: HandPiece[]): Knob => ({ k: "f", i, label, pieces });
const fit = (i: number, label: string, pieces: HandPiece[]): Knob => ({
  k: "fit",
  i,
  label,
  pieces,
});
const THUMB: HandPiece[] = ["thumb0", "thumb1"];
const INDEX: HandPiece[] = ["index0", "index1"];
const TRIO: HandPiece[] = ["middle0", "middle1", "ring0", "ring1", "pinky0", "pinky1"];
const TIPS: HandPiece[] = ["middle1", "ring1", "pinky1"];
const SPREAD: HandPiece[] = ["index0", "index1", "ring0", "ring1", "pinky0", "pinky1"];
const SPREAD_KNOB = f(8, "xoè — các ngón toả ra (chung)", SPREAD);
const TRIO_KNOBS = [
  f(6, "gập gốc — chung giữa · áp út · út", TRIO),
  f(7, "gập ngọn — chung giữa · áp út · út", TIPS),
];
const own = (n: "middle" | "ring" | "pinky", j: number): Knob[] => [
  fit(j, "gập thêm đốt gốc — riêng ngón này", [`${n}0`, `${n}1`]),
  fit(j + 1, "gập thêm đốt ngọn — riêng ngón này", [`${n}1`]),
];
/** Thanh của từng ngón, theo thứ tự hiện khi chọn ngón ấy */
const KNOBS: Record<Finger, Knob[]> = {
  thumb: [
    f(0, "dạng — tách khỏi ngón trỏ", THUMB),
    f(1, "đối — vắt về phía lòng tay", THUMB),
    f(2, "gập gốc", THUMB),
    f(3, "gập ngọn", ["thumb1"]),
    f(9, "xoay đệm ngón (sấp + / ngửa −)", THUMB),
    fit(0, "gập thêm đốt gốc", THUMB),
    fit(1, "gập thêm đốt ngọn", ["thumb1"]),
  ],
  index: [
    f(4, "gập gốc", INDEX),
    f(5, "gập ngọn", ["index1"]),
    SPREAD_KNOB,
    fit(2, "gập thêm đốt gốc", INDEX),
    fit(3, "gập thêm đốt ngọn", ["index1"]),
  ],
  middle: [...TRIO_KNOBS, ...own("middle", 4)],
  ring: [...TRIO_KNOBS, ...own("ring", 6), SPREAD_KNOB],
  pinky: [...TRIO_KNOBS, ...own("pinky", 8), SPREAD_KNOB],
};
/** Panel bên: đủ mọi thanh, nhóm theo ngón */
const GROUPS: { title: string; knobs: Knob[] }[] = [
  { title: "Ngón cái", knobs: KNOBS.thumb },
  { title: "Ngón trỏ", knobs: KNOBS.index.filter((k) => k !== SPREAD_KNOB) },
  { title: "Giữa · áp út · út (chung)", knobs: [...TRIO_KNOBS, SPREAD_KNOB] },
  {
    title: "Riêng từng ngón (gập thêm từng đốt)",
    knobs: (["middle", "ring", "pinky"] as const).flatMap((n, j) =>
      own(n, 4 + 2 * j).map((k) => ({
        ...k,
        label: `${FINGER_NAMES[n].slice(5)} · ${k.label.includes("gốc") ? "đốt gốc" : "đốt ngọn"}`,
      })),
    ),
  },
];
const FINGER_RANGE: [number, number][] = [
  [-30, 110],
  [-30, 120],
  [-40, 90],
  [-40, 100],
  [-30, 110],
  [-30, 120],
  [-30, 110],
  [-30, 120],
  [-10, 30],
  [rig.THUMB_ROLL[0], rig.THUMB_ROLL[1]],
];
const FIT_RANGE: [number, number] = [-40, 60];
/** Kéo trên ngón: góc gốc, ngọn (trong mười góc ngón) và hai đốt `HAND_FIT` riêng của từng ngón */
const CURL: Record<Finger, [number, number]> = {
  thumb: [2, 3],
  index: [4, 5],
  middle: [6, 7],
  ring: [6, 7],
  pinky: [6, 7],
};
const OWN: Record<Finger, [number, number]> = {
  thumb: [0, 1],
  index: [2, 3],
  middle: [4, 5],
  ring: [6, 7],
  pinky: [8, 9],
};
const N = rig.HAND_DOF.length;
/** Độ mỗi điểm ảnh khi kéo trên ngón; độ mỗi đơn vị `deltaY` khi Alt + lăn */
const DRAG_DEG = 0.4;
const WHEEL_DEG = 0.03;
/** Thời gian bay giữa hai góc nhìn, giây */
const FLY = 0.45;

/** `GripFrame` → ma trận three của món trong khung bàn tay */
function gripMatrix(G: GripFrame, out = new THREE.Matrix4()) {
  const R = G.R;
  const k = G.u / 0.01;
  return out.set(
    R[0] * k,
    R[1] * k,
    R[2] * k,
    G.p[0],
    R[3] * k,
    R[4] * k,
    R[5] * k,
    G.p[1],
    R[6] * k,
    R[7] * k,
    R[8] * k,
    G.p[2],
    0,
    0,
    0,
    1,
  );
}

/** Ma trận three của món trong khung bàn tay → `GripFrame` */
function matrixGrip(m: THREE.Matrix4): GripFrame {
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  m.decompose(p, q, s);
  const e = new THREE.Matrix4().makeRotationFromQuaternion(q).elements;
  // three cột trước → `M3` hàng trước
  return {
    R: [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]],
    p: [p.x, p.y, p.z],
    u: 0.01 * s.x,
  };
}

/**
 * Bản sao lưới món của cảnh ở gốc khung món: giữ nguyên vật liệu (NPR, decal chữ, vỏ viền mực) nên khung soạn vẽ món y như
 * cảnh — khung soạn cũng đi pipeline của rig
 */
function sceneClone(o: THREE.Object3D): THREE.Object3D {
  const c = o.clone(true);
  c.position.set(0, 0, 0);
  c.quaternion.identity();
  c.scale.set(1, 1, 1);
  c.matrixAutoUpdate = true;
  c.visible = true;
  return c;
}

/** Hình va chạm của món (`shape`), khung món three (đơn vị rig × 0,01), dạng khung dây */
function shapeWire(spec: HeldItemSpec): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0x2f8fd8,
    wireframe: true,
    transparent: true,
    opacity: 0.6,
  });
  for (const b of spec.shape ?? []) {
    let m: THREE.Mesh;
    if ("box" in b) {
      m = new THREE.Mesh(new THREE.BoxGeometry(...(b.box.map((v) => v * 0.01) as V3)), mat);
      m.position.set(...((b.at ?? [0, 0, 0]).map((v) => v * 0.01) as V3));
    } else if ("ball" in b) {
      m = new THREE.Mesh(new THREE.SphereGeometry(b.ball * 0.01, 12, 8), mat);
      m.position.set(...((b.at ?? [0, 0, 0]).map((v) => v * 0.01) as V3));
    } else {
      const a = new THREE.Vector3(...b.from).multiplyScalar(0.01);
      const z = new THREE.Vector3(...b.to).multiplyScalar(0.01);
      const len = a.distanceTo(z);
      m = new THREE.Mesh(
        new THREE.CylinderGeometry((b.r2 ?? b.cyl) * 0.01, b.cyl * 0.01, len, 16, 1, true),
        mat,
      );
      m.position.copy(a).add(z).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), z.clone().sub(a).normalize());
    }
    g.add(m);
  }
  return g;
}

/** Lưới bàn tay bên `side` cỡ `k`, `long` (`handSkin` của lõi), da dời trên CPU như bàn tay của người; vỏ nét như cảnh */
class HandMesh {
  readonly skin: ReturnType<typeof rig.handSkin>;
  readonly mesh: THREE.Mesh;
  readonly group = new THREE.Group();
  constructor(side: number, k: number, long: number, mat: THREE.Material, hull?: THREE.Material) {
    this.skin = rig.handSkin(side, k, long);
    const n = this.skin.pos.length / 3;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(this.skin.index, 1));
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    if (hull) {
      const h = new THREE.Mesh(geo, hull);
      h.userData.noShadow = true;
      h.frustumCulled = false;
      this.group.add(h);
    }
  }
  pose(v: readonly number[]) {
    const g = this.mesh.geometry;
    const P = g.attributes.position.array as Float32Array;
    rig.skinHand(this.skin, v, P);
    rig.smoothNormals(P, this.skin.index, g.attributes.normal.array as Float32Array);
    g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = true;
    // tia chọn ngón cần cầu bao theo dáng mới
    g.computeBoundingSphere();
    return P;
  }
}

/** Đốt chiếm trọng số da lớn nhất của từng đỉnh (`HAND_PIECES`) */
function vertexPieces(skin: ReturnType<typeof rig.handSkin>): Uint8Array {
  const NB = rig.HAND_PIECES.length;
  const n = skin.pos.length / 3;
  const out = new Uint8Array(n);
  for (let v = 0; v < n; v++) {
    let best = 0;
    for (let b = 1; b < NB; b++)
      if (skin.weights[v * NB + b] > skin.weights[v * NB + best]) best = b;
    out[v] = best;
  }
  return out;
}
const fingerOf = (piece: HandPiece): Finger | "palm" =>
  piece === "palm" ? "palm" : (piece.slice(0, -1) as Finger);

/**
 * Lớp tô trên da bàn tay: tam giác của các đốt đã chọn, chung đỉnh với lưới bàn tay, vẽ sau lượt độ sâu của cảnh nên chỉ
 * phần da nhìn thấy được tô (không che bàn tay thành khối)
 */
class Tint {
  readonly mesh: THREE.Mesh;
  private index: THREE.BufferAttribute;
  constructor(
    private hand: HandMesh,
    private pieces: Uint8Array,
    color: number,
    opacity: number,
  ) {
    const src = hand.mesh.geometry;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", src.attributes.position);
    this.index = new THREE.BufferAttribute(new Uint32Array(src.index!.count), 1);
    this.index.setUsage(THREE.DynamicDrawUsage);
    geo.setIndex(this.index);
    geo.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthFunc: THREE.LessEqualDepth,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      }),
    );
    this.mesh.frustumCulled = false;
  }
  /** Tô các đốt `set` (chỉ số `HAND_PIECES`): tam giác có từ hai đỉnh thuộc chúng */
  set(set: ReadonlySet<number>) {
    const src = this.hand.mesh.geometry.index!.array;
    const out = this.index.array as Uint32Array;
    let n = 0;
    if (set.size)
      for (let i = 0; i < src.length; i += 3) {
        const a = set.has(this.pieces[src[i]]) ? 1 : 0;
        const b = set.has(this.pieces[src[i + 1]]) ? 1 : 0;
        const c = set.has(this.pieces[src[i + 2]]) ? 1 : 0;
        if (a + b + c < 2) continue;
        out[n++] = src[i];
        out[n++] = src[i + 1];
        out[n++] = src[i + 2];
      }
    this.index.needsUpdate = true;
    this.index.clearUpdateRanges();
    this.index.addUpdateRange(0, n);
    this.mesh.geometry.setDrawRange(0, n);
  }
}

const pieceSet = (pieces: readonly HandPiece[]) =>
  new Set(pieces.map((p) => rig.HAND_PIECES.indexOf(p)));
const fingerPieces = (fi: Finger | "palm") =>
  fi === "palm" ? (["palm"] as HandPiece[]) : ([`${fi}0`, `${fi}1`] as HandPiece[]);

/** Kết quả một lần dựng: khung cầm của rig từ bản soạn, dáng đã ôm, số đo */
interface Built {
  au: AuthoredGrasp;
  fr: GraspFrame;
  v: number[];
  sample: Pick<
    HeldHand,
    "hold" | "pierce" | "gaps" | "fingers" | "roles" | "grip" | "oppose" | "pose"
  >;
  hits: ReturnType<typeof rig.heldHits>;
}

/**
 * Bàn tay cỡ `k`, `long` cầm món theo bản soạn (món `spec` kèm bản soạn tạm): khung cầm như cảnh sẽ dựng, ngón ôm theo vai
 * trò tới `curl` của bản soạn, số đo da (đơn vị rig thế giới của người cỡ `s`) như `heldHands`
 */
function buildHand(
  t: EditTarget,
  spec: HeldItemSpec,
  geom: ItemGeom,
  k: number,
  long: number,
  held: Omit<HeldOptions, "frame">,
  skin: ReturnType<typeof rig.handSkin>,
): Omit<Built, "au"> {
  const side = t.row.side;
  const fr = rig.graspFrame(
    spec,
    geom,
    { ...t.choice, group: t.group, variant: t.variant },
    side,
    rig.handDims(k, long),
    k,
    long,
    t.s,
    t.high,
  );
  const shape = spec.shape!;
  const fitted = rig.heldFit({
    v: fr.pose,
    side,
    k,
    long,
    shape,
    G: fr.G,
    roles: fr.roles,
    bulge: rig.skinBulge(skin, fr.pose),
    ...(fr.curl !== undefined && { curl: fr.curl }),
  });
  const v = [...fr.pose.slice(0, N), ...fitted];
  const pos = new Float32Array(skin.pos.length);
  rig.skinHand(skin, v, pos);
  const sc = fr.G.u / 0.01;
  const d = rig.skinDepth(pos, rig.skinPieces(skin), fr.G, shape);
  const fingers = Object.fromEntries(rig.HELD_FINGERS.map((h) => [h, d.gaps[h] * sc])) as Record<
    HeldFinger,
    number
  >;
  const gaps = {
    thumb: fingers.thumb,
    index: fingers.index,
    fingers: Math.min(fingers.middle, fingers.ring, fingers.pinky),
    palm: d.gaps.palm * sc,
  };
  let pierce = { depth: -Infinity, core: -Infinity, piece: "palm" };
  rig.handCapsules(v, side, k, long).forEach(([a, b, r], i) => {
    const c = rig.capsuleClearance(shape, fr.G, a, b, r);
    if (c.core * sc > pierce.core)
      pierce = { depth: -c.gap * sc, core: c.core * sc, piece: rig.HAND_CAPSULE_PIECES[i] };
  });
  const g0 = rig.handGripOf(v, side, k, long);
  const grip = rig.heldDistance(shape, rig.toItem(fr.G, g0 as V3)) * sc;
  const oppose = rig.heldOppose(shape, d.near, { ...fingers, palm: gaps.palm } as never, fr.roles);
  const sample = {
    hold: `${t.base}@${t.group}/${t.variant}`,
    pose: fr.hand.pose,
    pierce,
    gaps,
    fingers,
    roles: fr.roles,
    grip,
    ...(oppose && { oppose }),
  };
  return { fr, v, sample, hits: rig.heldHits(sample as HeldHand, held) };
}

/**
 * Đầu cao của cạnh (`edgeHigh`) mà cảnh đã dùng cho chỗ cầm: báo cáo của bộ giải không mang nó, nên thử không khai và sáu
 * hướng trục món (chỉ dấu so với cạnh là có nghĩa), lấy hướng mà khung cầm dựng lại trùng bàn tay đang vẽ (`hand` của lần
 * cầm, khung món). Dò không ra thì `undefined`
 */
export function sceneHigh(
  spec: HeldItemSpec,
  geom: ItemGeom,
  choice: GraspChoice & { group: GroupId },
  side: number,
  k: number,
  long: number,
  s: number,
  hand: { at: V3; palm: V3 } | undefined,
): V3 | undefined {
  if (!hand) return undefined;
  const cands: (V3 | undefined)[] = [
    undefined,
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  let best: { h: V3 | undefined; d: number } = { h: undefined, d: Infinity };
  for (const h of cands) {
    try {
      const fr = rig.graspFrame(spec, geom, choice, side, rig.handDims(k, long), k, long, s, h);
      const d =
        Math.hypot(...fr.hand.at.map((x, i) => x - hand.at[i])) +
        10 * Math.hypot(...fr.hand.palm.map((x, i) => x - hand.palm[i]));
      if (d < best.d - 1e-6) best = { h, d };
    } catch {
      // lựa chọn không dựng được với hướng này
    }
  }
  return best.h;
}

/** Một trạng thái soạn cho hoàn tác: góc ngón, `HAND_FIT`, `curl`, món trong khung bàn tay */
interface Snap {
  f: number[];
  fit: number[];
  curl: number;
  G: GripFrame;
}
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const snapKey = (s: Snap) =>
  JSON.stringify([s.f, s.fit, s.curl, s.G.R.map(r6), s.G.p.map(r6), r6(s.G.u)]);

/** Trục gizmo: theo món, theo bàn tay, theo thế giới */
type Axes = "item" | "hand" | "world";
const AXES: Record<Axes, string> = { item: "món", hand: "bàn tay", world: "thế giới" };

/** Bản soạn không `base`, `note` */
function plain(au: AuthoredGrasp): AuthoredGrasp {
  const o = { ...au };
  delete o.base;
  delete o.note;
  return o;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export class GraspEditor {
  readonly canvas: HTMLCanvasElement;
  private stage: Stage;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.005, 20);
  private orbit: OrbitControls;
  private gizmo: TransformControls;
  private gizmoOn = true;
  private axes: Axes = "item";
  /** Khung bàn tay trong khung soạn: xoay như bàn tay trong cảnh; mọi thứ của bàn tay, món nằm trong nó */
  private root = new THREE.Group();
  /** Món trong khung bàn tay; nằm trong `pivot` — điểm TransformControls kéo, xoay quanh */
  private item = new THREE.Group();
  private clone: THREE.Object3D;
  /** Tâm xoay của món: tâm nắm dáng neo, đặt lại sau mỗi lần kéo */
  private pivot = new THREE.Group();
  /** Tay nắm của gizmo, lệch khỏi tâm nắm (`placeHandle`); `grab` là chỗ tay nắm, tâm xoay lúc bắt đầu kéo */
  private handle = new THREE.Object3D();
  private grab: {
    h: THREE.Vector3;
    hq: THREE.Quaternion;
    p: THREE.Vector3;
    pq: THREE.Quaternion;
  } | null = null;
  private link = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({
      color: 0xe0a458,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    }),
  );
  private hand: HandMesh;
  private pieces: Uint8Array;
  private others: {
    group: THREE.Group;
    hand: HandMesh;
    item: THREE.Object3D;
    label: string;
    k: number;
    long: number;
  }[] = [];
  /** Lớp vẽ sau pipeline (có độ sâu của cảnh): bóng cẳng tay, tô ngón, khung dây va chạm, gizmo */
  private over = new THREE.Scene();
  private handOver = new THREE.Group();
  private wireOver: THREE.Group;
  private tints: Record<"sink" | "open" | "sel" | "hover" | "knob", Tint>;
  private depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  private geom: ItemGeom;
  private fingers: number[];
  private fit: number[];
  private curl = rig.AUTHORED_CURL;
  private built: Built | null = null;
  private dirty = true;
  private stale = true;
  private raf = 0;
  private showOthers = false;
  private ui: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private hud: HTMLElement;
  /** Thanh kéo đang hiện (panel bên và thẻ ngón) để đồng bộ khi số đổi từ chỗ khác */
  private inputs: { knob: Knob; inp: HTMLInputElement; out: HTMLOutputElement }[] = [];
  private sel: Finger | null = null;
  private hoverFinger: Finger | "palm" | null = null;
  private past: Snap[] = [];
  private future: Snap[] = [];
  private last: Snap;
  private press: { x: number; y: number; finger: Finger | "palm" | null } | null = null;
  private curling: { y: number } | null = null;
  private wheelCommit = 0;
  private pans = wheelPans();
  private fly: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    t0: THREE.Vector3;
    t1: THREE.Vector3;
    d0: number;
    d1: number;
    at: number;
  } | null = null;
  private ray = new THREE.Raycaster();

  constructor(
    readonly t: EditTarget,
    private host: EditHost,
    private held: Omit<HeldOptions, "frame">,
    panel: HTMLElement,
    frame: HTMLElement,
  ) {
    this.geom = rig.itemGeom(t.spec);
    const sc = t.scene;
    // sân khấu riêng: pipeline của rig với đèn, nét, bóng như cảnh (không có phòng: bỏ đèn đặt chỗ)
    this.stage = rig.createStage({
      size: { w: 16, h: 9 },
      aa: host.aa(),
      scene: this.scene,
      camera: this.camera,
      light: () => {
        rig.setPalette(sc.palette);
        rig.setLights(sc.lights);
      },
    });
    this.canvas = this.stage.canvas;
    this.canvas.className = "editor";
    this.canvas.style.width = this.canvas.style.height = "";
    frame.append(this.canvas);
    this.scene.background = sc.background.clone();
    this.root.quaternion.copy(sc.q);
    this.scene.add(this.root);
    const skin = sc.skin ?? rig.npr({ color: "#f2c9a4" });
    this.hand = new HandMesh(t.row.side, t.k, t.long, skin, sc.hull);
    this.root.add(this.hand.group);
    this.pieces = vertexPieces(this.hand.skin);
    this.clone = sceneClone(t.object);
    this.item.add(this.clone);
    this.pivot.add(this.item);
    this.root.add(this.pivot);
    // tay nhỏ nhất, lớn nhất của dàn nhân vật, đặt hai bên (theo phía ngón cái), cách nhau hơn bề ngang món
    const size = new THREE.Box3()
      .setFromObject(this.clone, true)
      .getSize(new THREE.Vector3())
      .multiplyScalar(t.s);
    const gap = Math.max(0.3, 1.15 * Math.max(size.x, size.y, size.z));
    t.sizes.forEach((z, i) => {
      const group = new THREE.Group();
      group.position.set(0, 0, (i ? -1 : 1) * gap);
      const hand = new HandMesh(t.row.side, z.k, z.long, skin, sc.hull);
      const item = sceneClone(t.object);
      item.matrixAutoUpdate = false;
      group.add(hand.group, item);
      group.visible = false;
      this.root.add(group);
      this.others.push({ group, hand, item, label: z.name, k: z.k, long: z.long });
    });
    // lớp vẽ sau: theo khung bàn tay, và khung dây theo món
    this.handOver.matrixAutoUpdate = false;
    this.over.add(this.handOver);
    this.over.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2.2));
    this.forearm();
    this.tints = {
      sink: new Tint(this.hand, this.pieces, 0xff3b30, 0.5),
      open: new Tint(this.hand, this.pieces, 0xffcc00, 0.45),
      sel: new Tint(this.hand, this.pieces, 0xff9a3c, 0.45),
      hover: new Tint(this.hand, this.pieces, 0xffffff, 0.22),
      knob: new Tint(this.hand, this.pieces, 0x3cc8ff, 0.6),
    };
    for (const x of Object.values(this.tints)) this.handOver.add(x.mesh);
    this.wireOver = shapeWire(t.spec);
    this.wireOver.matrixAutoUpdate = false;
    this.wireOver.visible = false;
    this.over.add(this.wireOver);
    // bắt đầu từ khung cầm cảnh đang dùng (bản soạn nếu món đã có, không thì bộ giải)
    const fr0 = this.frameOf(false);
    this.fingers = [...fr0.pose.slice(2, N)];
    this.fit = Array.from({ length: rig.HAND_FIT.length }, (_, i) => fr0.pose[N + i] ?? 0);
    if (fr0.authored) this.curl = fr0.curl ?? rig.AUTHORED_CURL;
    this.setItem(fr0.G);
    this.last = this.snap();
    // chuột trên khung: bắt trước OrbitControls, TransformControls (đăng ký trước chúng, pha capture)
    this.canvas.addEventListener("pointerdown", this.onDown, true);
    this.canvas.addEventListener("pointermove", this.onMove, true);
    this.canvas.addEventListener("pointerup", this.onUp, true);
    this.canvas.addEventListener("pointercancel", this.onUp, true);
    this.canvas.addEventListener("wheel", this.onWheel, { capture: true, passive: false });
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.canvas.addEventListener("dblclick", this.onDbl);
    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.orbit.zoomToCursor = true;
    this.orbit.screenSpacePanning = true;
    this.orbit.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.orbit.addEventListener("change", () => (this.dirty = true));
    // gizmo nhỏ, gắn vào tay nắm đặt lệch khỏi tâm nắm (không đè lên ngón, không chiếm chỗ kéo xoay ở giữa khung): kéo nó
    // là dời / xoay món quanh tâm nắm
    this.root.add(this.handle);
    this.gizmo = new TransformControls(this.camera, this.canvas);
    this.gizmo.attach(this.handle);
    this.gizmo.setSize(0.55);
    this.gizmo.setSpace("local");
    this.gizmo.addEventListener("dragging-changed", (e) => {
      this.orbit.enabled = !e.value;
      if (e.value)
        this.grab = {
          h: this.handle.position.clone(),
          hq: this.handle.quaternion.clone(),
          p: this.pivot.position.clone(),
          pq: this.pivot.quaternion.clone(),
        };
      else {
        this.grab = null;
        this.repivot();
        this.commit();
      }
    });
    this.gizmo.addEventListener("objectChange", () => this.dragHandle());
    this.gizmo.addEventListener("change", () => (this.dirty = true));
    this.over.add(this.gizmo.getHelper());
    this.link.frustumCulled = false;
    this.handOver.add(this.link);
    this.ui = panel;
    this.hud = document.createElement("div");
    this.hud.className = "edhud";
    frame.append(this.hud);
    this.panel();
    this.hudInit();
    this.rebuild();
    this.view("canh", false);
    addEventListener("keydown", this.onKey, true);
    this.loop();
  }

  /** Bóng cẳng tay (cổ tay → khuỷu của cảnh) và vòng cổ tay, mờ, sau bàn tay */
  private forearm() {
    const e = this.t.scene.elbow;
    const len = e.length();
    if (len < 1e-4) return;
    const k = this.t.k;
    const mat = new THREE.MeshLambertMaterial({
      color: 0x9aa6bd,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03 * k, 0.026 * k, len, 20, 1, true),
      mat,
    );
    arm.position.copy(e).multiplyScalar(0.5);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), e.clone().normalize());
    const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.026 * k, 16, 10), mat);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.03 * k, 0.0025 * k, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0x5d6b85, transparent: true, opacity: 0.7 }),
    );
    ring.quaternion
      .copy(arm.quaternion)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), e]),
      new THREE.LineBasicMaterial({ color: 0x5d6b85, transparent: true, opacity: 0.8 }),
    );
    for (const m of [arm, wrist, ring, line]) m.renderOrder = -1;
    this.handOver.add(arm, wrist, ring, line);
  }

  /** Khung cầm của món cảnh (`raw`: bỏ bản soạn — rig đoán) cho bàn tay đang soạn */
  private frameOf(raw: boolean) {
    const t = this.t;
    return rig.graspFrame(
      t.spec,
      this.geom,
      { ...t.choice, group: t.group, variant: t.variant },
      t.row.side,
      rig.handDims(t.k, t.long),
      t.k,
      t.long,
      t.s,
      t.high,
      raw,
    );
  }

  /** Tay nắm đã dời / xoay bao nhiêu từ lúc bắt đầu kéo: món dời bấy nhiêu, xoay bấy nhiêu quanh tâm nắm */
  private dragHandle() {
    const g = this.grab;
    if (!g) return;
    this.pivot.position.copy(g.p).add(this.handle.position).sub(g.h);
    const d = this.handle.quaternion.clone().multiply(g.hq.clone().invert());
    this.pivot.quaternion.copy(d).multiply(g.pq);
    this.edited();
  }

  /**
   * Đặt tay nắm gizmo lệch khỏi tâm nắm theo màn hình (lên trên, sang phải chừng một phần tư khung) và hướng theo trục đang
   * chọn; nối với tâm nắm bằng một đường mảnh
   */
  private placeHandle() {
    if (this.grab) return;
    const inv = this.root.quaternion.clone().invert();
    const dist = this.camera.position.distanceTo(this.orbit.target);
    const h = dist * Math.tan(((this.camera.fov / 2) * Math.PI) / 180);
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const off = right
      .multiplyScalar(0.55 * h)
      .addScaledVector(up, 0.35 * h)
      .applyQuaternion(inv);
    this.handle.position.copy(this.pivot.position).add(off);
    this.handle.quaternion.copy(this.pivot.quaternion);
    const P = this.link.geometry.attributes.position as THREE.BufferAttribute;
    P.setXYZ(0, ...this.pivot.position.toArray());
    P.setXYZ(1, ...this.handle.position.toArray());
    P.needsUpdate = true;
  }

  /** Món trong khung bàn tay (`pivot` rồi `item`, trong `root`) */
  private gripNow(): GripFrame {
    this.pivot.updateMatrix();
    this.item.updateMatrix();
    return matrixGrip(new THREE.Matrix4().multiplyMatrices(this.pivot.matrix, this.item.matrix));
  }

  private setItem(G: GripFrame) {
    this.pivot.position.set(0, 0, 0);
    this.pivot.quaternion.identity();
    gripMatrix(G).decompose(this.item.position, this.item.quaternion, this.item.scale);
    this.repivot();
    this.edited();
  }

  /**
   * Đặt lại tâm xoay vào tâm nắm của dáng neo (khung bàn tay), hướng theo trục gizmo đang chọn (món, bàn tay; thế giới thì
   * gizmo tự theo thế giới), giữ nguyên chỗ món
   */
  private repivot() {
    const M = gripMatrix(this.gripNow());
    const c = rig.gripCenter(this.anchor(), this.t.row.side, this.t.k, this.t.long);
    this.pivot.position.set(...c);
    if (this.axes === "item")
      M.decompose(new THREE.Vector3(), this.pivot.quaternion, new THREE.Vector3());
    else this.pivot.quaternion.identity();
    this.pivot.updateMatrix();
    new THREE.Matrix4()
      .copy(this.pivot.matrix)
      .invert()
      .multiply(M)
      .decompose(this.item.position, this.item.quaternion, this.item.scale);
    this.dirty = true;
  }

  /** Dáng neo của bản soạn: của bản đã có, không thì dáng đóng của biến thể (như bộ giải) */
  private anchor(): HandPose {
    const t = this.t;
    return (rig.authoredOf(t.spec, t.group, t.variant)?.anchor ??
      rig.variantOf(t.spec, t.group, t.variant)!.spec.pose!.closed.pose) as HandPose;
  }

  /** Bản soạn (tay phải) từ món, ngón đang thấy; kiểu cầm có tên giữ `base`, `note` của bản đã có */
  authored(): AuthoredGrasp {
    const t = this.t;
    const was = rig.authoredOf(t.spec, t.group, t.variant);
    const au = rig.authoredFromSide(
      t.spec,
      this.geom,
      { ...t.choice, group: t.group, variant: t.variant },
      t.row.side,
      this.gripNow(),
      this.anchor(),
      t.k,
      t.long,
      [0, 0, ...this.fingers, ...this.fit],
      t.high,
      this.curl,
    );
    return { ...(was?.base && { base: was.base }), ...(was?.note && { note: was.note }), ...au };
  }

  /** Món kèm bản soạn tạm (chưa lưu) */
  private specWith(au: AuthoredGrasp): HeldItemSpec {
    const t = this.t;
    const a = { ...t.spec.authored, [t.group]: { ...t.spec.authored?.[t.group], [t.variant]: au } };
    return { ...t.spec, authored: a };
  }

  private edited() {
    this.dirty = true;
    this.stale = true;
  }

  // --- hoàn tác ---

  private snap(): Snap {
    return { f: [...this.fingers], fit: [...this.fit], curl: this.curl, G: this.gripNow() };
  }

  /** Chốt một thao tác vừa xong vào lịch sử (không đổi gì thì thôi) */
  private commit() {
    const s = this.snap();
    if (snapKey(s) === snapKey(this.last)) return;
    this.past.push(this.last);
    this.future = [];
    this.last = s;
    this.syncUndo();
  }

  private undo() {
    this.commit();
    const s = this.past.pop();
    if (!s) return;
    this.future.push(this.last);
    this.restore(s);
  }

  private redo() {
    const s = this.future.pop();
    if (!s) return;
    this.past.push(this.last);
    this.restore(s);
  }

  private restore(s: Snap) {
    this.last = s;
    this.fingers.splice(0, this.fingers.length, ...s.f);
    this.fit.splice(0, this.fit.length, ...s.fit);
    this.curl = s.curl;
    this.setItem(s.G);
    this.sync();
    this.syncUndo();
  }

  private syncUndo() {
    for (const el of this.hud.querySelectorAll<HTMLButtonElement>("[data-undo]"))
      el.disabled = !(el.dataset.undo === "undo" ? this.past.length : this.future.length);
  }

  /** Dựng lại từ bản soạn: bàn tay đúng như rig sẽ dựng, số đo, tay so sánh */
  private rebuild() {
    this.stale = false;
    const t = this.t;
    const au = this.authored();
    const spec = this.specWith(au);
    const b = buildHand(t, spec, this.geom, t.k, t.long, this.held, this.hand.skin);
    this.built = { au, ...b };
    this.hand.pose(b.v);
    this.faults(b);
    if (this.showOthers)
      for (const o of this.others) {
        const x = buildHand(t, spec, this.geom, o.k, o.long, this.held, o.hand.skin);
        o.hand.pose(x.v);
        gripMatrix(x.fr.G, o.item.matrix);
      }
    this.measure();
  }

  /** Ngón lún quá `sink` (đỏ) / ngón vai trò còn hở quá `wrap` (vàng) như lớp phủ của cảnh, tô trên da */
  private faults(b: Omit<Built, "au">) {
    const sink = this.held.sink ?? rig.HELD_SINK;
    const wrap = this.held.wrap ?? rig.HELD_WRAP;
    const must = new Set(["press", "wrap", "tip"]);
    const bad = { sink: [] as HandPiece[], open: [] as HandPiece[] };
    for (const fi of ["palm", ...rig.HELD_FINGERS] as const) {
      const gap = fi === "palm" ? b.sample.gaps.palm : b.sample.fingers![fi];
      const kind =
        -gap > sink
          ? "sink"
          : fi !== "palm" && must.has(b.sample.roles?.[fi] ?? "") && gap > wrap
            ? "open"
            : null;
      if (kind) bad[kind].push(...fingerPieces(fi));
    }
    this.tints.sink.set(pieceSet(bad.sink));
    this.tints.open.set(pieceSet(bad.open));
  }

  private measure() {
    const b = this.built;
    if (!b) return;
    this.els.measure.innerHTML = `${hitsHtml(b.hits)}${fingerTable(b.sample, this.held)}<div class="dim">tâm nắm ${b.sample.grip < 0 ? `trong món ${(-b.sample.grip).toFixed(1)}` : `cách món ${b.sample.grip.toFixed(1)}`} · xương sâu nhất ${b.sample.pierce.core > 0 ? `${b.sample.pierce.core.toFixed(1)} (${b.sample.pierce.piece})` : "không"}</div>`;
  }

  // --- góc nhìn ---

  /** Tâm nắm đang thấy (thế giới khung soạn) */
  private center() {
    const v = this.built?.v ?? [0, 0, ...this.fingers];
    return new THREE.Vector3(
      ...rig.handGripOf(v, this.t.row.side, this.t.k, this.t.long),
    ).applyQuaternion(this.root.quaternion);
  }

  /** Hướng từ tâm nắm ra camera của góc `v` (thế giới khung soạn) */
  private viewDir(v: EditView): THREE.Vector3 {
    const q = this.root.quaternion;
    let d: THREE.Vector3;
    // lòng tay quay về `-side · x` của khung bàn tay (`handAxes`); nghiêng nhẹ về phía cổ tay cho khỏi nhìn dọc trục đứng
    if (v === "long" || v === "mu")
      d = new THREE.Vector3((v === "long" ? 1 : -1) * -this.t.row.side, 0.25, 0.15).applyQuaternion(
        q,
      );
    else d = this.t.scene.views[v].clone();
    d.normalize();
    if (Math.abs(d.y) > 0.985) d.add(new THREE.Vector3(0, 0, 0.2).applyQuaternion(q)).normalize();
    return d;
  }

  /** Bán kính khung vừa bàn tay + món (thế giới khung soạn) */
  private radius(c: THREE.Vector3) {
    this.scene.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(this.clone, true);
    const hand = new THREE.Box3().setFromObject(this.hand.mesh, true);
    let r = hand.getBoundingSphere(new THREE.Sphere()).radius;
    if (!box.isEmpty()) {
      const s = box.getBoundingSphere(new THREE.Sphere());
      r = Math.max(r, Math.min(s.center.distanceTo(c) + s.radius, 3 * r));
    }
    return r;
  }

  /** Bay (mượt, `smooth`) tới góc `v`: tâm xoay ở tâm nắm, khung vừa bàn tay + món */
  private view(v: EditView, smooth = true) {
    const c = this.center();
    const dist = (this.radius(c) / Math.sin(((this.camera.fov / 2) * Math.PI) / 180)) * 1.1;
    const to = this.viewDir(v);
    for (const b of this.hud.querySelectorAll<HTMLButtonElement>("[data-view]"))
      b.classList.toggle("on", b.dataset.view === v);
    if (!smooth) {
      this.orbit.target.copy(c);
      this.camera.position.copy(c).addScaledVector(to, dist);
      this.camera.lookAt(c);
      this.orbit.update();
      this.dirty = true;
      return;
    }
    const off = this.camera.position.clone().sub(this.orbit.target);
    this.fly = {
      from: off.clone().normalize(),
      to,
      t0: this.orbit.target.clone(),
      t1: c,
      d0: off.length(),
      d1: dist,
      at: performance.now(),
    };
  }

  private flyStep(now: number) {
    const fl = this.fly;
    if (!fl) return;
    const k = Math.min(1, (now - fl.at) / 1000 / FLY);
    const e = k * k * (3 - 2 * k);
    const q = new THREE.Quaternion().setFromUnitVectors(fl.from, fl.to);
    const dir = fl.from.clone().applyQuaternion(new THREE.Quaternion().slerp(q, e));
    this.orbit.target.lerpVectors(fl.t0, fl.t1, e);
    this.camera.position.copy(this.orbit.target).addScaledVector(dir, fl.d0 + (fl.d1 - fl.d0) * e);
    this.camera.lookAt(this.orbit.target);
    this.dirty = true;
    if (k >= 1) this.fly = null;
  }

  // --- ngón ---

  /** Ngón dưới con trỏ (lòng tay: `palm`); món che trước thì không */
  private pick(e: MouseEvent): Finger | "palm" | null {
    const r = this.canvas.getBoundingClientRect();
    const p = new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(p, this.camera);
    const hit = this.ray.intersectObjects([this.hand.mesh, this.clone], true)[0];
    if (!hit || hit.object !== this.hand.mesh || !hit.face) return null;
    const { a, b, c } = hit.face;
    const ps = [this.pieces[a], this.pieces[b], this.pieces[c]];
    const p0 = ps[1] === ps[2] ? ps[1] : ps[0];
    return fingerOf(rig.HAND_PIECES[p0]);
  }

  /** Chọn ngón: tô sáng, thẻ thanh kéo của ngón cạnh khung */
  private select(fi: Finger | null) {
    this.sel = fi;
    this.tints.sel.set(pieceSet(fi ? fingerPieces(fi) : []));
    for (const g of this.ui.querySelectorAll<HTMLElement>("[data-finger]"))
      g.classList.toggle("on", !!fi && g.dataset.finger!.split(" ").includes(fi));
    this.card();
    this.dirty = true;
  }

  /**
   * Gập / duỗi ngón đang chọn `d` độ: cả ngón (gốc + ngọn), `tip` chỉ đốt ngọn; `alone` riêng ngón ấy qua `HAND_FIT` (giữa,
   * áp út, út chung góc gập — không `alone` thì cả ba cùng gập)
   */
  private curlBy(d: number, tip: boolean, alone: boolean) {
    const fi = this.sel;
    if (!fi) return;
    const [arr, idx, range] = alone
      ? [this.fit, OWN[fi], () => FIT_RANGE]
      : [this.fingers, CURL[fi], (i: number) => FINGER_RANGE[i]];
    for (const i of tip ? [idx[1]] : idx) {
      const [lo, hi] = range(i);
      arr[i] = Math.round(Math.min(hi, Math.max(lo, arr[i] + d)) * 10) / 10;
    }
    this.sync();
    this.edited();
  }

  private onDown = (e: PointerEvent) => {
    // nhấp vào khung: bỏ focus thanh kéo, phím mũi tên không còn đổi nó
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.press = null;
    if (e.button !== 0) return;
    const fi = this.pick(e);
    if (fi && fi !== "palm" && fi === this.sel) {
      // kéo trên ngón đang chọn: gập / duỗi, không xoay khung; thắng cả gizmo nằm đè lên ngón
      e.stopImmediatePropagation();
      e.preventDefault();
      this.canvas.setPointerCapture(e.pointerId);
      this.curling = { y: e.clientY };
      return;
    }
    if (this.gizmoOn && this.gizmo.axis !== null) return;
    if (!e.shiftKey) this.press = { x: e.clientX, y: e.clientY, finger: fi };
  };

  private onMove = (e: PointerEvent) => {
    if (this.curling) {
      e.stopImmediatePropagation();
      const dy = this.curling.y - e.clientY;
      this.curling.y = e.clientY;
      if (dy) this.curlBy(dy * DRAG_DEG, e.shiftKey, e.ctrlKey || e.metaKey);
      return;
    }
    if (e.buttons) return;
    const fi = this.pick(e);
    this.canvas.style.cursor =
      fi && fi !== "palm" ? (fi === this.sel ? "ns-resize" : "pointer") : "";
    if (fi !== this.hoverFinger) {
      this.hoverFinger = fi;
      this.tints.hover.set(pieceSet(fi && fi !== this.sel ? fingerPieces(fi) : []));
      this.els.hover.textContent = fi && fi !== "palm" ? `${FINGER_NAMES[fi]} · ` : "";
      this.dirty = true;
    }
  };

  private onUp = (e: PointerEvent) => {
    if (this.curling) {
      e.stopImmediatePropagation();
      this.curling = null;
      if (this.canvas.hasPointerCapture(e.pointerId))
        this.canvas.releasePointerCapture(e.pointerId);
      this.commit();
      return;
    }
    const p = this.press;
    this.press = null;
    if (!p || e.type !== "pointerup" || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) return;
    // nhấp (không kéo): chọn ngón dưới con trỏ, nhấp chỗ khác bỏ chọn
    this.select(p.finger && p.finger !== "palm" ? p.finger : null);
  };

  private onLeave = () => {
    if (this.hoverFinger === null) return;
    this.hoverFinger = null;
    this.tints.hover.set(new Set());
    this.dirty = true;
  };

  private onDbl = (e: MouseEvent) => {
    // nhấp đúp: tâm xoay vào chỗ nhấp trên bàn tay / món
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = this.ray.intersectObjects([this.hand.mesh, this.clone], true)[0];
    if (hit) {
      this.orbit.target.copy(hit.point);
      this.dirty = true;
    }
  };

  /**
   * Lăn trên khung soạn: Alt + lăn gập / duỗi ngón đang chọn; lần lăn kiểu touchpad (hai ngón) dời như camera tự do; còn lại
   * (bánh xe chuột, Ctrl + lăn, chụm) để OrbitControls tiến lùi
   */
  private onWheel = (e: WheelEvent) => {
    if (e.altKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!this.sel) return;
      const d = Math.max(-4, Math.min(4, -(e.deltaY || e.deltaX) * WHEEL_DEG));
      this.curlBy(d, e.shiftKey, e.ctrlKey || e.metaKey);
      clearTimeout(this.wheelCommit);
      this.wheelCommit = window.setTimeout(() => this.commit(), 400);
      return;
    }
    // không chặn lan truyền ở đây: pha capture trên chính canvas mà chặn thì bộ nghe (pha bubble) của OrbitControls cũng mất;
    // bộ lăn của camera tự do ngầm (capture trên khung cha) tự bỏ qua khi khung soạn hiện
    if (!this.pans(e, this.host.wheel())) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.orbit.pan(-e.deltaX, -e.deltaY);
    this.fly = null;
    this.dirty = true;
  };

  // --- panel, thẻ ngón ---

  /** Một thanh kéo của `knob`; đổi là đổi số soạn, thả là chốt hoàn tác; rê lên thì tô đốt tương ứng trên hình */
  private slider(knob: Knob): HTMLLabelElement {
    const vals = knob.k === "f" ? this.fingers : this.fit;
    const [lo, hi] = knob.k === "f" ? FINGER_RANGE[knob.i] : FIT_RANGE;
    const lab = document.createElement("label");
    lab.className = "slider";
    lab.innerHTML = `<span>${esc(knob.label)}</span><input type="range" min="${lo}" max="${hi}" step="0.5" /><output></output>`;
    const inp = lab.querySelector("input")!;
    const out = lab.querySelector("output")!;
    inp.value = String(vals[knob.i]);
    out.textContent = vals[knob.i].toFixed(1);
    inp.oninput = () => {
      vals[knob.i] = Number(inp.value);
      this.sync();
      this.edited();
    };
    inp.onchange = () => {
      this.commit();
      // thả thanh: bỏ focus, phím mũi tên không đổi nó ngầm về sau
      inp.blur();
    };
    lab.onpointerenter = () => this.hoverKnobSet(knob);
    lab.onpointerleave = () => this.hoverKnobSet(null);
    this.inputs.push({ knob, inp, out });
    return lab;
  }

  private hoverKnobSet(k: Knob | null) {
    this.tints.knob.set(pieceSet(k?.pieces ?? []));
    this.dirty = true;
  }

  /** Mọi thanh đang hiện theo số soạn */
  private sync() {
    this.inputs = this.inputs.filter((x) => x.inp.isConnected);
    for (const { knob, inp, out } of this.inputs) {
      const v = (knob.k === "f" ? this.fingers : this.fit)[knob.i];
      if (document.activeElement !== inp) inp.value = String(v);
      out.textContent = v.toFixed(1);
    }
    const curl = this.els.curl as HTMLInputElement | undefined;
    if (curl) {
      curl.value = String(this.curl);
      curl.nextElementSibling!.textContent = `${this.curl}°`;
    }
  }

  /** Thanh công cụ trên khung (góc nhìn, hoàn tác), thẻ ngón, dòng nhắc chuột */
  private hudInit() {
    this.hud.innerHTML = `
      <div class="edbar">
        <div class="seg">${(Object.entries(VIEWS) as [EditView, string][]).map(([v, l], i) => `<button data-view="${v}" title="${l} (${i + 1})">${l}</button>`).join("")}</div>
        <button data-undo="undo" title="Hoàn tác (Ctrl+Z)">↶<span class="lbl"> Hoàn tác</span></button>
        <button data-undo="redo" title="Làm lại (Ctrl+Shift+Z)">↷<span class="lbl"> Làm lại</span></button>
        <label title="Hiện / ẩn gizmo dời, xoay món (G)"><input type="checkbox" data-hud="gizmo" checked /> gizmo</label>
      </div>
      <div class="edcard"></div>
      <div class="edhint"><span data-hud="hover"></span>Kéo trái: xoay · kéo phải / giữa / Shift: dời · lăn: tiến lùi · hai ngón: dời · Ctrl + lăn / chụm: tiến lùi · nhấp ngón: chọn</div>`;
    this.els.hover = this.hud.querySelector("[data-hud=hover]")!;
    for (const b of this.hud.querySelectorAll<HTMLButtonElement>("[data-view]"))
      b.onclick = () => this.view(b.dataset.view as EditView);
    for (const b of this.hud.querySelectorAll<HTMLButtonElement>("[data-undo]"))
      b.onclick = () => (b.dataset.undo === "undo" ? this.undo() : this.redo());
    const g = this.hud.querySelector<HTMLInputElement>("[data-hud=gizmo]")!;
    g.onchange = () => this.setGizmo(g.checked);
    this.card();
    this.syncUndo();
  }

  /** Thẻ của ngón đang chọn: tên, các thanh của ngón (cả `HAND_FIT` của hai đốt), cách kéo trên hình */
  private card() {
    const box = this.hud.querySelector<HTMLElement>(".edcard")!;
    box.replaceChildren();
    const fi = this.sel;
    if (!fi) {
      box.innerHTML = `<div class="dim">Nhấp lên một ngón trên hình để chỉnh ngón ấy</div>`;
      this.sync();
      return;
    }
    const head = document.createElement("div");
    head.className = "edcardhead";
    head.innerHTML = `<b>${FINGER_NAMES[fi]}</b>${fi === "middle" || fi === "ring" || fi === "pinky" ? ` <span class="dim">· gập chung với hai ngón kia, "riêng" là của ngón này</span>` : ""}`;
    const x = document.createElement("button");
    x.textContent = "×";
    x.title = "Bỏ chọn (Esc)";
    x.onclick = () => this.select(null);
    head.append(x);
    box.append(head, ...KNOBS[fi].map((k) => this.slider(k)));
    const hint = document.createElement("div");
    hint.className = "dim";
    hint.textContent =
      "Kéo lên / xuống trên ngón: gập / duỗi · Shift: chỉ đốt ngọn · Ctrl: riêng ngón này · Alt + lăn: như kéo";
    box.append(hint);
    this.sync();
  }

  /** Panel soạn: điểm đầu, kiểu kéo, ngón theo nhóm, `curl`, số đo, lưu */
  private panel() {
    const t = this.t;
    const was = rig.authoredOf(t.spec, t.group, t.variant);
    const has = !!was;
    const named = was?.base ? ` · kiểu có tên, gốc <code>${esc(was.base)}</code>` : "";
    this.ui.innerHTML = `
      <div class="edhead"><b>${t.base}@${t.group}/${esc(t.variant)}</b>${named} · soạn tay ${t.row.side < 0 ? "phải" : "trái (lưu thành bản tay phải)"} · cỡ tay ${t.k.toFixed(2)} / ${t.long.toFixed(2)}${has ? " · <span class='tag'>đã có bản soạn</span>" : ""}${was?.note ? `<div class="dim">${esc(was.note)}</div>` : ""}</div>
      <div class="seg" data-k="view"><button data-v="edit" class="on">Khung soạn</button><button data-v="scene">Khung cảnh (áp tạm)</button></div>
      <label>Điểm đầu <select data-k="start"><option value="">—</option><option value="rig">Rig đoán (bộ giải)</option>${rig.HAND_POSE_KINDS.map((p) => `<option value="${p}">dáng ${p} (${rig.HAND_POSE_LABELS[p]})</option>`).join("")}</select></label>
      <div class="row"><div class="seg" data-k="mode"><button data-v="translate" class="on">Dời (T)</button><button data-v="rotate">Xoay (Y)</button></div>
      <button data-k="axes" title="Trục gizmo (X)">trục: ${AXES[this.axes]}</button>
      <label><input type="checkbox" data-k="fine" /> bước nhỏ</label>
      <label><input type="checkbox" data-k="wire" /> hình va chạm</label>
      <label><input type="checkbox" data-k="others" /> tay nhỏ / lớn nhất</label></div>
      <div class="dim">Ngón: nhấp lên ngón trên hình để chọn, hay chỉnh số ở đây (rê chuột lên thanh: đốt ấy sáng xanh trên hình)</div>
      <div data-k="groups"></div>
      <label class="slider"><span>ngón tự ôm thêm (heldFit) ≤</span><input type="range" min="0" max="45" step="1" data-k="curl" /><output></output></label>
      <div data-k="measure"></div>
      <div class="row"><button data-k="save" class="primary" title="Ghi đè khoá đang mở: authored.${t.group}.${esc(t.variant)}">Lưu ${esc(t.variant)} vào held/${t.base}.json</button><button data-k="saveAs">Lưu thành kiểu mới…</button><button data-k="copy">Chép sang món…</button>${has ? `<button data-k="drop">Xoá bản soạn</button>` : ""}<button data-k="close">Thoát</button></div>
      <div data-k="status" class="dim"></div>`;
    for (const el of this.ui.querySelectorAll<HTMLElement>("[data-k]"))
      this.els[el.dataset.k!] = el;
    const fingersOf = (g: { knobs: Knob[] }) =>
      [
        ...new Set(
          g.knobs.flatMap((k) => k.pieces.map((p) => fingerOf(p))).filter((x) => x !== "palm"),
        ),
      ].join(" ");
    for (const g of GROUPS) {
      const box = document.createElement("div");
      box.className = "fgroup";
      box.dataset.finger = fingersOf(g);
      const h = document.createElement("div");
      h.className = "fhead";
      h.textContent = g.title;
      box.append(h, ...g.knobs.map((k) => this.slider(k)));
      this.els.groups.append(box);
    }
    const curl = this.els.curl as HTMLInputElement;
    curl.oninput = () => {
      this.curl = Number(curl.value);
      this.sync();
      this.edited();
    };
    curl.onchange = () => {
      this.commit();
      curl.blur();
    };
    this.els.mode.onclick = (e) =>
      this.setMode((e.target as HTMLElement).dataset.v as "translate" | "rotate");
    this.els.axes.onclick = () => this.cycleAxes();
    (this.els.fine as HTMLInputElement).onchange = () =>
      this.setFine((this.els.fine as HTMLInputElement).checked);
    (this.els.wire as HTMLInputElement).onchange = () => {
      this.wireOver.visible = (this.els.wire as HTMLInputElement).checked;
      this.dirty = true;
    };
    (this.els.others as HTMLInputElement).onchange = () => {
      this.showOthers = (this.els.others as HTMLInputElement).checked;
      for (const o of this.others) o.group.visible = this.showOthers;
      this.edited();
    };
    (this.els.start as HTMLSelectElement).onchange = () => {
      const v = (this.els.start as HTMLSelectElement).value;
      (this.els.start as HTMLSelectElement).value = "";
      (this.els.start as HTMLSelectElement).blur();
      if (v === "rig") {
        const fr = this.frameOf(true);
        this.fingers.splice(0, 10, ...fr.pose.slice(2, N));
        this.fit.fill(0);
        this.curl = rig.AUTHORED_CURL;
        this.setItem(fr.G);
      } else if (v) {
        this.fingers.splice(0, 10, ...rig.handVec(v as HandPose).slice(2));
        this.fit.fill(0);
      }
      this.sync();
      this.edited();
      this.commit();
    };
    this.els.view.onclick = async (e) => {
      const v = (e.target as HTMLElement).dataset.v;
      if (!v) return;
      for (const b of this.els.view.querySelectorAll("button"))
        b.classList.toggle("on", b.dataset.v === v);
      if (v === "scene") {
        this.say("đang dựng lại cảnh với bản soạn…");
        await this.host.preview(this.t, this.authored());
        this.show(false);
        this.say("khung cảnh: bản soạn đã áp tạm (chưa lưu)");
      } else {
        this.show(true);
        this.say("");
      }
    };
    this.els.save.onclick = async () => {
      try {
        const file = await this.host.save(this.t, this.authored());
        this.say(`đã lưu ${file}`);
      } catch (e) {
        this.say(`không lưu được: ${(e as Error).message}`, true);
      }
    };
    if (this.els.drop)
      this.els.drop.onclick = async () => {
        const uses = this.host.uses(this.t);
        if (
          uses.length &&
          !confirm(
            `Cảnh đang mở còn gọi kiểu ${this.t.variant} ở ${uses.join(", ")}: xoá bản soạn thì cảnh không dựng được các mốc ấy cho tới khi đổi kiểu. Vẫn xoá?`,
          )
        )
          return;
        try {
          const file = await this.host.save(this.t, null);
          this.say(`đã xoá bản soạn khỏi ${file}`);
        } catch (e) {
          this.say(`không xoá được: ${(e as Error).message}`, true);
        }
      };
    this.els.saveAs.onclick = () => void this.saveAs();
    this.els.copy.onclick = () => void this.copy();
    this.els.close.onclick = () => this.host.close();
    this.sync();
    this.measure();
  }

  /** "Lưu thành kiểu mới…": khoá mới của món (`base` là biến thể gốc của khoá đang mở); khung soạn mở khoá mới */
  private async saveAs() {
    const t = this.t;
    const base = rig.baseVariant(t.spec, t.group, t.variant);
    const r = await saveAsDialog({
      key: `${t.base}@${t.group}/${t.variant}`,
      base,
      problem: (n) => nameProblem(n, t.group, t.spec),
      run: this.host.run(t),
    });
    if (!r) return;
    const au = { base, ...(r.note && { note: r.note }), ...plain(this.authored()) };
    this.say(`đang lưu kiểu ${r.name}…`);
    try {
      const res = await this.host.saveAs(t, au, r.name, r.use);
      t.variant = r.name;
      t.spec = res.spec;
      this.panel();
      this.show(true);
      this.select(this.sel);
      this.edited();
      this.say(res.message, res.error);
    } catch (e) {
      this.say(`không lưu được: ${(e as Error).message}`, true);
    }
  }

  /** "Chép sang món…": bản đang thấy dựng lại trên món khác cùng nhóm, ở cùng lựa chọn */
  private async copy() {
    const t = this.t;
    const base = rig.baseVariant(t.spec, t.group, t.variant);
    const au = this.authored();
    const held = this.host.held();
    const dims = rig.handDims(t.k, t.long);
    const targets = Object.keys(held)
      .filter((n) => n !== t.base)
      .sort()
      .map((name) => {
        const s = held[name];
        if (!s.shape) return { name, why: "không có hình va chạm" };
        if (!rig.groupFits(rig.itemGeom(s), t.group, dims).length)
          return { name, why: `không cầm được nhóm ${t.group}` };
        try {
          copyAuthored(t.spec, au, t.group, base, s);
          return { name };
        } catch (e) {
          return { name, why: (e as Error).message.slice(0, 90) };
        }
      });
    const r = await copyDialog({
      key: `${t.base}@${t.group}/${t.variant}`,
      name: t.variant,
      note: au.note,
      targets,
      problem: (dst, n) =>
        n === base
          ? rig.authoredOf(held[dst], t.group, base)
            ? `món đích đã có bản soạn ${base}`
            : undefined
          : nameProblem(n, t.group, held[dst]),
    });
    if (!r) return;
    try {
      const out = {
        ...(r.name !== base && { base }),
        ...(r.note && { note: r.note }),
        ...plain(copyAuthored(t.spec, au, t.group, base, held[r.dst])),
      };
      this.say(`đang chép sang ${r.dst}…`);
      const file = await this.host.copyTo(t, r.dst, r.name, out);
      this.say(`đã chép thành ${r.dst}@${t.group}/${r.name} vào ${file}`);
    } catch (e) {
      this.say(`không chép được: ${(e as Error).message}`, true);
    }
  }

  /** Khung soạn đang hiện (không thì khung cảnh đang hiện bản áp tạm) */
  get shown() {
    return this.canvas.style.display !== "none";
  }
  private show(on: boolean) {
    this.canvas.style.display = on ? "" : "none";
    this.hud.hidden = !on;
    this.dirty = true;
  }

  private say(s: string, err = false) {
    this.els.status.textContent = s;
    this.els.status.classList.toggle("error", err);
  }

  private setMode(m: "translate" | "rotate") {
    if (m !== "translate" && m !== "rotate") return;
    this.gizmo.setMode(m);
    for (const b of this.els.mode.querySelectorAll("button"))
      b.classList.toggle("on", b.dataset.v === m);
    this.dirty = true;
  }

  private cycleAxes() {
    const order: Axes[] = ["item", "hand", "world"];
    this.axes = order[(order.indexOf(this.axes) + 1) % order.length];
    this.gizmo.setSpace(this.axes === "world" ? "world" : "local");
    this.repivot();
    this.els.axes.textContent = `trục: ${AXES[this.axes]}`;
  }

  private setGizmo(on: boolean) {
    this.gizmoOn = on;
    this.gizmo.enabled = on;
    this.gizmo.getHelper().visible = on;
    this.link.visible = on;
    const g = this.hud.querySelector<HTMLInputElement>("[data-hud=gizmo]");
    if (g) g.checked = on;
    this.dirty = true;
  }

  private setFine(on: boolean) {
    // bước nhỏ: 0,1 đơn vị rig, 1°
    this.gizmo.setTranslationSnap(on ? 0.001 : null);
    this.gizmo.setRotationSnap(on ? THREE.MathUtils.degToRad(1) : null);
  }

  /**
   * Phím khi khung soạn đang hiện: bắt ở pha capture của `window` trước phím của trang, nên Space, ← →, C, R, WASD… không
   * đụng cảnh / camera ngầm phía sau
   */
  private onKey = (e: KeyboardEvent) => {
    if (!this.shown || document.querySelector("dialog[open]")) return;
    if (e.target instanceof HTMLInputElement && e.target.type === "text") return;
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && k === "z") {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && k === "y") {
      e.preventDefault();
      this.redo();
    } else if (mod || e.altKey || e.target instanceof HTMLSelectElement) return;
    else if (k === "t") this.setMode("translate");
    else if (k === "y") this.setMode("rotate");
    else if (k === "x") this.cycleAxes();
    else if (k === "g") this.setGizmo(!this.gizmoOn);
    else if (k === "escape") this.select(null);
    else if (/^[1-6]$/.test(k)) this.view(Object.keys(VIEWS)[Number(k) - 1] as EditView);
    else if (e.key.startsWith("Arrow") || [" ", "c", "r", "w", "a", "s", "d", "q", "e"].includes(k))
      // để phím mặc định (thanh kéo đang focus) chạy, nhưng không tới trang
      return void e.stopPropagation();
    else return;
    e.stopPropagation();
  };

  /** Cỡ khung vẽ: điểm ảnh thật theo phần tử (tối đa 2 lần) */
  private resize(w: number, h: number) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.stage.setSize(Math.round(w * dpr), Math.round(h * dpr), { aa: this.host.aa() });
    // `setSize` đặt cỡ CSS bằng điểm ảnh thật: để CSS của khung quyết định
    this.canvas.style.width = this.canvas.style.height = "";
    this.dirty = true;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.shown) return;
    this.flyStep(performance.now());
    if (this.orbit.update()) this.dirty = true;
    if (this.stale) this.rebuild();
    if (!this.dirty) return;
    this.dirty = false;
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (r.width && this.canvas.width !== Math.round(r.width * dpr)) this.resize(r.width, r.height);
    this.draw();
  };

  /** Một khung: pipeline của rig, rồi lượt độ sâu của cảnh và lớp vẽ sau (cẳng tay, tô ngón, gizmo) có che khuất */
  private draw() {
    const sc = this.t.scene;
    this.placeHandle();
    this.stage.draw(sc.t, { render: { ...sc.render, grade: undefined } });
    this.handOver.matrix.copy(this.root.matrixWorld);
    this.item.updateWorldMatrix(true, false);
    this.wireOver.matrix.copy(this.item.matrixWorld);
    const r = this.stage.renderer;
    r.setRenderTarget(null);
    r.autoClear = false;
    r.clearDepth();
    const bg = this.scene.background;
    this.scene.background = null;
    this.scene.overrideMaterial = this.depthMat;
    r.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    this.scene.background = bg;
    r.render(this.over, this.camera);
    r.autoClear = true;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.wheelCommit);
    removeEventListener("keydown", this.onKey, true);
    this.gizmo.detach();
    this.gizmo.dispose();
    this.orbit.dispose();
    this.stage.dispose();
    this.canvas.remove();
    this.hud.remove();
    this.ui.innerHTML = "";
  }
}
