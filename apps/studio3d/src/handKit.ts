// Phần chung của hai khung soạn bàn tay (kiểu cầm `editor.ts`, dáng tay `poseEditor.ts`): lưới bàn tay da dời trên CPU,
// lớp tô đốt, thanh kéo từng ngón (mười góc ngón và `HAND_FIT`), góc nhìn, bóng cẳng tay.
import * as rig from "@stickman3d/rig";
import type { HandPiece, HeldFinger } from "@stickman3d/rig";
import * as THREE from "three";

/** Góc nhìn của khung soạn: như camera đang xem cảnh, ba góc `can-tay`, lòng tay, mu tay */
export type EditView = "canh" | "truoc" | "cheo" | "ngang" | "long" | "mu";
export const VIEWS: Record<EditView, string> = {
  canh: "Như trong cảnh",
  truoc: "Trước",
  cheo: "Chéo",
  ngang: "Ngang",
  long: "Lòng tay",
  mu: "Mu tay",
};

export type Finger = HeldFinger;
export const FINGER_NAMES: Record<Finger, string> = {
  thumb: "Ngón cái",
  index: "Ngón trỏ",
  middle: "Ngón giữa",
  ring: "Ngón áp út",
  pinky: "Ngón út",
};

/** Một thanh kéo: góc ngón (`f`, chỉ số trong mười góc ngón — `HAND_DOF` bỏ `turn`, `bend`) hay `HAND_FIT` (`fit`) */
export interface Knob {
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
export const KNOBS: Record<Finger, Knob[]> = {
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
export const GROUPS: { title: string; knobs: Knob[] }[] = [
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
export const FINGER_RANGE: [number, number][] = [
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
export const FIT_RANGE: [number, number] = [-40, 60];
/** Kéo trên ngón: góc gốc, ngọn (trong mười góc ngón) và hai đốt `HAND_FIT` riêng của từng ngón */
export const CURL: Record<Finger, [number, number]> = {
  thumb: [2, 3],
  index: [4, 5],
  middle: [6, 7],
  ring: [6, 7],
  pinky: [6, 7],
};
export const OWN: Record<Finger, [number, number]> = {
  thumb: [0, 1],
  index: [2, 3],
  middle: [4, 5],
  ring: [6, 7],
  pinky: [8, 9],
};
export const N = rig.HAND_DOF.length;
/** Độ mỗi điểm ảnh khi kéo trên ngón; độ mỗi đơn vị `deltaY` khi Alt + lăn */
export const DRAG_DEG = 0.4;
export const WHEEL_DEG = 0.03;
/** Thời gian bay giữa hai góc nhìn, giây */
export const FLY = 0.45;

/** Lưới bàn tay bên `side` cỡ `k`, `long` (`handSkin` của lõi), da dời trên CPU như bàn tay của người; vỏ nét như cảnh */
export class HandMesh {
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
export function vertexPieces(skin: ReturnType<typeof rig.handSkin>): Uint8Array {
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
export const fingerOf = (piece: HandPiece): Finger | "palm" =>
  piece === "palm" ? "palm" : (piece.slice(0, -1) as Finger);

/**
 * Lớp tô trên da bàn tay: tam giác của các đốt đã chọn, chung đỉnh với lưới bàn tay, vẽ sau lượt độ sâu của cảnh nên chỉ
 * phần da nhìn thấy được tô (không che bàn tay thành khối)
 */
export class Tint {
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

export const pieceSet = (pieces: readonly HandPiece[]) =>
  new Set(pieces.map((p) => rig.HAND_PIECES.indexOf(p)));
export const fingerPieces = (fi: Finger | "palm") =>
  fi === "palm" ? (["palm"] as HandPiece[]) : ([`${fi}0`, `${fi}1`] as HandPiece[]);

export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Bóng cẳng tay (cổ tay → khuỷu `elbow`, khung bàn tay) và vòng cổ tay cỡ tay `k`, mờ, vẽ sau bàn tay */
export function forearmMeshes(elbow: THREE.Vector3, k: number): THREE.Object3D[] {
  const len = elbow.length();
  if (len < 1e-4) return [];
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
  arm.position.copy(elbow).multiplyScalar(0.5);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), elbow.clone().normalize());
  const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.026 * k, 16, 10), mat);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.03 * k, 0.0025 * k, 6, 32),
    new THREE.MeshBasicMaterial({ color: 0x5d6b85, transparent: true, opacity: 0.7 }),
  );
  ring.quaternion
    .copy(arm.quaternion)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), elbow]),
    new THREE.LineBasicMaterial({ color: 0x5d6b85, transparent: true, opacity: 0.8 }),
  );
  for (const m of [arm, wrist, ring, line]) m.renderOrder = -1;
  return [arm, wrist, ring, line];
}
