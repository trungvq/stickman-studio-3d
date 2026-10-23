// Bàn tay của cast ở giây đang xem: danh sách (người, tay, món đang cầm), bấm chọn trên hình hay trong danh sách, số đo
// cầm đồ của tay đã chọn — cùng phép đo với nhóm `held` của `check` (`heldHands`, `heldHits`, `heldSummary` của rig) —,
// đốt ngón lún / hở tô trên hình, và camera tự do bay tới cận bàn tay ấy (ba góc như `can-tay` của repo video).
import * as rig from "@stickman3d/rig";
import type {
  Figure,
  GraspReport,
  HeldHand,
  HeldOptions,
  HeldRule,
  Holding,
  Side,
} from "@stickman3d/rig";
import * as THREE from "three";

/** Một bàn tay của cast ở giây đang xem */
export interface HandRow {
  id: string;
  side: Side;
  fig: Figure;
  hold?: Holding;
  carry?: NonNullable<Figure["carrying"]>[Side];
  report?: GraspReport;
  /** Số đo của `heldHands` (chỉ khi tay đang cầm một món hiện trên hình) */
  sample?: HeldHand;
  hits?: { rule: HeldRule; worst: number; error?: true }[];
}

export type Angle = "truoc" | "cheo" | "ngang" | "sau";
export const ANGLES: Record<Angle, string> = {
  truoc: "Trước",
  cheo: "Chéo",
  ngang: "Ngang",
  sau: "Sau lưng",
};

/** Luật `held` theo chữ cho người đọc (docs/11-nhom-cam.md mục 7) */
export const RULE_LABELS: Partial<Record<HeldRule, string>> = {
  pierce: "xương ngón vào trong món",
  sink: "da lún",
  loose: "không ngón nào chạm",
  role: "ngón vai trò còn hở",
  oppose: "không gì kẹp đối ngón cái",
  grip: "tâm nắm xa món",
  rest: "da dưới mặt đỡ",
  reach: "ngoài tầm với",
  wrist: "cổ tay vượt / sát giới hạn",
  arm: "tay lấn thân / đầu",
  elbow: "khuỷu gập ngược",
  size: "món to so với tay",
  up: "món nghiêng (ý định trục lên)",
  face: "mặt món quay sai ý định",
  pose: "dáng tay khác dáng khai",
};

const r1 = (x: number) => (Math.abs(x) < 0.05 ? "0" : x.toFixed(1));
export const sideName = (s: Side) => (s < 0 ? "phải" : "trái");

/** Món (cả nhóm, biến thể) tay đang cầm, một dòng ngắn */
export function heldLabel(r: HandRow): string {
  if (r.carry) return `${r.carry.item}@carry (${r.carry.carry.on})`;
  if (!r.hold) return "—";
  const g = r.report;
  const item = r.hold.item ?? r.hold.object.name ?? "món";
  if (!g) return r.hold.grip ? `${item}${r.hold.grip}` : `${item} (đường cũ, ${r.hold.pose})`;
  return `${item}@${g.group}${g.choice.variant ? `/${g.choice.variant}` : ""}`;
}

/** Lựa chọn cầm của bộ giải (`GraspReport.choice`), mỗi trường kèm nguồn: cảnh khai, rig giải, mặc định nhóm */
export function choiceLabel(g: GraspReport): string {
  const by = { scene: "", rig: "·rig", default: "·mđ" } as const;
  return Object.entries(g.choice)
    .filter(([k, v]) => v !== undefined && k !== "feature" && k !== "featureIndex")
    .map(([k, v]) => {
      const x = typeof v === "number" ? Math.round(v * 100) / 100 : v;
      return `${k} ${x}${by[g.by[k as keyof typeof g.by] ?? "scene"]}`;
    })
    .join(", ");
}

/** Mọi bàn tay của người `clad` đang hiện, kèm số đo của tay đang cầm (`measure`: đo `heldHands` — tốn vài ms mỗi tay) */
export function handRows(
  posed: Record<string, Figure>,
  o: { U: number; eye?: THREE.Vector3; held: Omit<HeldOptions, "frame">; measure: boolean },
): HandRow[] {
  const out: HandRow[] = [];
  for (const [id, fig] of Object.entries(posed)) {
    if (!fig?.hands || !shown(fig.root)) continue;
    const samples = o.measure ? rig.heldHands(fig, id, { U: o.U, eye: o.eye }) : [];
    for (const side of [-1, 1] as Side[]) {
      const hold = fig.holding?.[side];
      const carry = fig.carrying?.[side];
      const report = hold ? fig.aim?.[side < 0 ? "R" : "L"]?.hold?.grasp : undefined;
      const sample = samples.find((s) => s.hand === (side < 0 ? "R" : "L"));
      out.push({
        id,
        side,
        fig,
        ...(hold && shown(hold.object) && { hold }),
        ...(carry && { carry }),
        ...(report && { report }),
        ...(sample && { sample, hits: rig.heldHits(sample, o.held) }),
      });
    }
  }
  return out;
}

/** Vật và mọi cha của nó đang hiện */
export const shown = (o: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

const _v = new THREE.Vector3();

/** Tâm nắm của bàn tay (thế giới three): theo góc ngón đang vẽ (`handGripOf`) trong khung cổ tay */
export function gripWorld(fig: Figure, side: Side, out = new THREE.Vector3()) {
  const h = fig.hands![side];
  const g = rig.handGripOf([0, 0, ...h.shown], side, h.scale, h.long);
  fig.arms[side].wrist.updateWorldMatrix(true, false);
  return out.set(g[0], g[1], g[2]).applyMatrix4(fig.arms[side].wrist.matrixWorld);
}

/** Bán kính khung cận tay: bàn tay cộng món đang cầm, thế giới three */
export function handRadius(r: HandRow, center: THREE.Vector3): number {
  const k = r.fig.root.getWorldScale(_v).x;
  let rad = 0.13 * Math.max(r.fig.hands![r.side].scale, r.fig.hands![r.side].long) * k;
  const obj = r.hold?.object;
  if (obj) {
    const box = new THREE.Box3().setFromObject(obj, true);
    if (!box.isEmpty()) {
      const s = box.getBoundingSphere(new THREE.Sphere());
      rad = Math.max(rad, Math.min(s.center.distanceTo(center) + s.radius, 4 * rad));
    }
  }
  return rad;
}

/** Khoảng trống từ `c` theo `dir` tới lưới đầu tiên đang hiện của `world` (bỏ phần trong `near`); không chạm là `far` */
function clearance(
  world: THREE.Object3D,
  c: THREE.Vector3,
  dir: THREE.Vector3,
  near: number,
  far: number,
) {
  const ray = new THREE.Raycaster(c, dir, near, far);
  for (const h of ray.intersectObject(world, true))
    if ((h.object as THREE.Mesh).isMesh && !h.object.userData.noCollide && shown(h.object))
      return h.distance;
  return far;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Chỗ đặt camera cận tay theo góc: hướng từ bàn tay ra mắt như `can-tay` (`F` mặt người hướng tới, `S` ngang ra ngoài phía
 * tay ấy, từ vai bên kia sang vai bên này), ngẩng lên một chút. Có `world`: đường từ bàn tay tới camera vướng lưới (đầu, thân
 * người khác, tường) thì xoay hướng quanh trục đứng tới ±50°, rồi kéo camera vào trước chỗ vướng — camera không nằm trong vật
 */
export function anglePose(r: HandRow, angle: Angle, fov: number, world?: THREE.Object3D) {
  const c = gripWorld(r.fig, r.side);
  const m = r.fig.root.matrixWorld;
  const F = new THREE.Vector3().setFromMatrixColumn(m, 2).setY(0).normalize();
  const S = r.fig.arms[r.side].shoulder
    .getWorldPosition(new THREE.Vector3())
    .sub(r.fig.arms[-r.side as Side].shoulder.getWorldPosition(_v))
    .setY(0)
    .normalize();
  const dir =
    angle === "truoc"
      ? F.clone()
      : angle === "cheo"
        ? F.clone().add(S).normalize()
        : angle === "ngang"
          ? S.clone()
          : F.clone().negate();
  dir.addScaledVector(UP, 0.35).normalize();
  const rad = handRadius(r, c);
  const dist = (rad / Math.sin(((fov / 2) * Math.PI) / 180)) * 1.15;
  if (!world) return { target: c, position: c.clone().addScaledVector(dir, dist) };
  let best = { dir, free: -1 };
  for (const deg of [0, 25, -25, 50, -50]) {
    const d = dir.clone().applyAxisAngle(UP, (deg * Math.PI) / 180);
    const free = Math.min(dist, clearance(world, c, d, rad, dist));
    if (free > best.free + 1e-6) best = { dir: d, free };
    if (free >= dist) break;
  }
  const at = best.free >= dist ? dist : Math.max(rad * 1.2, best.free * 0.9);
  return { target: c, position: c.clone().addScaledVector(best.dir, at) };
}

/** Bàn tay ở sau thân người (góc "sau lưng" mới có ích) */
export function behind(r: HandRow): boolean {
  const c = gripWorld(r.fig, r.side);
  const m = r.fig.root.matrixWorld;
  const F = new THREE.Vector3().setFromMatrixColumn(m, 2).setY(0).normalize();
  const hip = r.fig.hips.getWorldPosition(new THREE.Vector3());
  return c.sub(hip).dot(F) < -0.1 * r.fig.root.getWorldScale(_v).x;
}

/**
 * Bàn tay được bấm: tia từ camera qua điểm bấm trúng lưới bàn tay hay món đang cầm; không trúng thì bàn tay có tâm nắm
 * chiếu gần điểm bấm nhất trong `near` px
 */
export function pickHand(
  rows: readonly HandRow[],
  root: THREE.Object3D,
  camera: THREE.Camera,
  ndc: THREE.Vector2,
  px: { w: number; h: number },
  near = 36,
): HandRow | undefined {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  for (const hit of ray.intersectObject(root, true)) {
    if (!shown(hit.object)) continue;
    for (const r of rows) {
      const h = r.fig.hands![r.side];
      if ((hit.object as THREE.Mesh).geometry === h.geo) return r;
      const obj = r.hold?.object ?? r.carry?.object;
      for (let p: THREE.Object3D | null = hit.object; obj && p; p = p.parent)
        if (p === obj) return r;
    }
    // trúng thứ khác (tường, người) trước: còn tìm theo tâm nắm
    break;
  }
  let best: HandRow | undefined;
  let bd = near;
  for (const r of rows) {
    if (!shown(r.fig.root)) continue;
    const p = gripWorld(r.fig, r.side).project(camera);
    if (p.z > 1) continue;
    const d = Math.hypot(((p.x - ndc.x) * px.w) / 2, ((p.y - ndc.y) * px.h) / 2);
    if (d < bd) [best, bd] = [r, d];
  }
  return best;
}

const PIECE_FINGER = (p: string) =>
  p === "palm" || p === "thenar" ? "palm" : (p.slice(0, -1) as "thumb" | "index" | "middle");

/** Vai trò phải chạm (`loose`, `role` của `check`) */
const MUST = new Set(["press", "wrap", "tip"]);

/**
 * Lớp phủ của bàn tay đã chọn, vẽ đè sau cảnh: vòng tâm nắm, và các đốt lún quá `sink` (đỏ) hay ngón vai trò còn hở quá
 * `wrap` (vàng) — đo trên da như `check`
 */
export class HandOverlay {
  readonly scene = new THREE.Scene();
  private group = new THREE.Group();
  private mats = {
    sink: new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.55,
      depthTest: false,
    }),
    open: new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    }),
    ring: new THREE.MeshBasicMaterial({
      color: 0xe0a458,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    }),
  };
  /** Có gì để vẽ */
  get active() {
    return this.group.children.length > 0;
  }
  constructor() {
    this.group.matrixAutoUpdate = false;
    this.scene.add(this.group);
  }
  clear() {
    for (const c of [...this.group.children]) {
      c.removeFromParent();
      (c as THREE.Mesh).geometry?.dispose();
    }
  }
  /** Dựng lại cho bàn tay `r` ở khung vừa đặt; `o` là ngưỡng `held` */
  update(r: HandRow | undefined, o: { sink: number; wrap: number }) {
    this.clear();
    if (!r) return;
    const h = r.fig.hands![r.side];
    const wrist = r.fig.arms[r.side].wrist;
    wrist.updateWorldMatrix(true, false);
    this.group.matrix.copy(wrist.matrixWorld);
    const v = [0, 0, ...h.shown];
    const g = rig.handGripOf(v, r.side, h.scale, h.long);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.012 * h.scale, 0.0015 * h.scale, 6, 24),
      this.mats.ring,
    );
    ring.position.set(g[0], g[1], g[2]);
    ring.rotation.y = Math.PI / 2;
    this.group.add(ring);
    const s = r.sample;
    if (!s?.fingers) return;
    const gapOf = (f: string) => (f === "palm" ? s.gaps.palm : s.fingers![f as "thumb"]);
    rig.handCapsules(v, r.side, h.scale, h.long).forEach(([a, b, rad], i) => {
      const f = PIECE_FINGER(rig.HAND_CAPSULE_PIECES[i]);
      const gap = gapOf(f);
      const kind =
        -gap > o.sink ? "sink" : MUST.has(s.roles?.[f] ?? "") && gap > o.wrap ? "open" : undefined;
      if (!kind) return;
      const A = new THREE.Vector3(...a);
      const B = new THREE.Vector3(...b);
      const len = A.distanceTo(B);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(rad * 1.08, len, 4, 10), this.mats[kind]);
      m.position.copy(A).add(B).multiplyScalar(0.5);
      if (len > 1e-6)
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
      this.group.add(m);
    });
  }
}

const esc = (s: string) =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** Các luật phạm ở giây này, mỗi luật một dòng `!!` như `cam-do` */
export function hitsHtml(hits: readonly { rule: HeldRule; worst: number; error?: true }[]): string {
  return hits.length
    ? hits
        .map(
          (h) =>
            `<div class="hit${h.error ? " err" : ""}">!! ${h.rule} ${r1(h.worst)} — ${RULE_LABELS[h.rule] ?? h.rule}</div>`,
        )
        .join("")
    : `<div class="ok">không luật nào phạm ở giây này</div>`;
}

/** Khe da từng ngón và lòng tay (âm là lún), vai trò; dòng lún quá `sink` đỏ, ngón vai trò hở quá `wrap` vàng */
export function fingerTable(
  s: Pick<HeldHand, "fingers" | "gaps" | "roles">,
  o: Omit<HeldOptions, "frame">,
): string {
  if (!s.fingers) return "";
  const roles = s.roles ?? {};
  const sink = o.sink ?? rig.HELD_SINK;
  const wrap = o.wrap ?? rig.HELD_WRAP;
  const row = (f: string, label: string, gap: number) => {
    const bad =
      -gap > sink ? "sink" : MUST.has(roles[f as "thumb"] ?? "") && gap > wrap ? "open" : "";
    return `<tr class="${bad}"><td>${label}</td><td>${roles[f as "thumb"] ?? "—"}</td><td>${gap < 0 ? `lún ${r1(-gap)}` : `hở ${r1(gap)}`}</td></tr>`;
  };
  return `<table class="fingers"><tr><th>ngón</th><th>vai trò</th><th>khe da</th></tr>${[
    ["thumb", "cái"],
    ["index", "trỏ"],
    ["middle", "giữa"],
    ["ring", "áp út"],
    ["pinky", "út"],
  ]
    .map(([f, l]) => row(f, l, s.fingers![f as "thumb"]))
    .join("")}${row("palm", "lòng", s.gaps.palm)}</table>`;
}

/** Số đo của bàn tay đã chọn cho panel: tóm tắt, các luật phạm (dòng `!!`), khe từng ngón */
export function measureHtml(r: HandRow, o: Omit<HeldOptions, "frame">): string {
  const lines: string[] = [];
  const g = r.report;
  if (g)
    lines.push(
      `<div class="kv"><b>${esc(heldLabel(r))}</b> · ${g.mode === "item" ? `món đặt trước${g.keyed ? " (theo mốc)" : ""}` : "tay dẫn"} · từ ${g.t0.toFixed(2)} s</div>`,
      `<div class="kv dim">${esc(choiceLabel(g))}</div>`,
    );
  else lines.push(`<div class="kv"><b>${esc(heldLabel(r))}</b></div>`);
  const s = r.sample;
  if (!s) {
    lines.push(
      `<div class="dim">${r.carry ? "món treo trên cánh tay — đo ở `check`" : r.hold ? "món không hiện / không đo được" : "tay không cầm gì"}</div>`,
    );
    return lines.join("");
  }
  lines.push(hitsHtml(r.hits ?? []), fingerTable(s, o));
  lines.push(`<div class="summary">${esc(rig.heldSummary(s, o.touch))}</div>`);
  return lines.join("");
}
