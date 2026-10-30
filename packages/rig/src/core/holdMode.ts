import { actArm, actHeld, bodyMarkAt } from "./act3";
import type { ActCharacter, ActInput } from "./arm3";
import { isOtherHand, type BodyMark } from "./bodyMark";
import { D } from "./constants";
import { BODY3 } from "./figure3d";
import { elbowRig, phiOf, rigElbowBody } from "./graspArm";
import type { GraspBy, GraspChoice } from "./graspSolve";
import { itemGeom } from "./heldGeom";
import {
  GROUP_VARIANTS,
  HOLD_BLEND,
  groupHold,
  heldBase,
  heldPoint,
  type GroupId,
  type HeldItemSpec,
  type SceneHold,
  type SceneHoldGroup,
} from "./heldItem";
import { supportGroup } from "./holdLink";
import { add3, dot3, matVec, scale3, sub3, type M3, type V3 } from "./lens";
import { equipCharacter, type Equip } from "./schema";
import {
  holdBlending,
  holderTrunk,
  holdRuns,
  itemAt,
  itemCentre,
  itemMarkPoint,
  markTime,
  parseMarkRef,
  sceneAt,
  sceneVersionUp,
  SCENE_VERSION,
  type HandSide,
  type HoldRunInfo,
  type SceneRuntime,
} from "./scene";

// Đổi chế độ một lần cầm giữa đồ theo tay và tay theo đồ, ra bản vá JSON thô. docs/11-nhom-cam.md § Đổi chế độ lần cầm

/** Một thao tác JSON Patch (RFC 6902) trên JSON thô của cảnh; `path` là JSON Pointer */
export type JsonPatchOp =
  | { op: "add"; path: string; value: unknown }
  | { op: "replace"; path: string; value: unknown }
  | { op: "remove"; path: string };

type Obj = Record<string, unknown>;
type Key = string | number;

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const pointer = (path: readonly Key[]) =>
  path.map((k) => `/${String(k).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");
const unpointer = (p: string): string[] =>
  p === ""
    ? []
    : p
        .slice(1)
        .split("/")
        .map((s) => s.replaceAll("~1", "/").replaceAll("~0", "~"));

/**
 * Áp bản vá (`add`, `replace`, `remove` của RFC 6902) lên bản chép của `doc`, đúng thứ tự: chỉ số mảng của một thao tác
 * trỏ vào mảng sau các thao tác trước nó. `doc` không đổi
 */
export function applyJsonPatch<T>(doc: T, ops: readonly JsonPatchOp[]): T {
  const root: Obj = { v: structuredClone(doc) };
  for (const o of ops) {
    let parent: unknown = root;
    let last = "v";
    for (const k of unpointer(o.path)) {
      const cur = (parent as Obj)[last];
      if (cur === null || typeof cur !== "object")
        throw new Error(`bản vá: \`${o.path}\` đi qua chỗ không phải object hay mảng`);
      parent = cur;
      last = k;
    }
    if (Array.isArray(parent)) {
      const i = last === "-" ? parent.length : Number(last);
      if (!Number.isInteger(i) || i < 0 || i > parent.length - (o.op === "add" ? 0 : 1))
        throw new Error(`bản vá: chỉ số \`${last}\` ngoài mảng ở \`${o.path}\``);
      if (o.op === "add") parent.splice(i, 0, structuredClone(o.value));
      else if (o.op === "replace") parent[i] = structuredClone(o.value);
      else parent.splice(i, 1);
      continue;
    }
    const p = parent as Obj;
    if (o.op !== "add" && !(last in p))
      throw new Error(`bản vá: không có \`${o.path}\` để ${o.op === "remove" ? "xoá" : "thay"}`);
    if (o.op === "remove") delete p[last];
    else p[last] = structuredClone(o.value);
  }
  return root.v as T;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Thao tác đưa `a` thành `b` ở `path`: object đi từng khoá, giá trị khác (cả mảng) thay nguyên */
function diffOps(path: Key[], a: unknown, b: unknown, out: JsonPatchOp[]) {
  if (same(a, b)) return;
  if (isObj(a) && isObj(b)) {
    for (const k of Object.keys(a))
      if (!(k in b)) out.push({ op: "remove", path: pointer([...path, k]) });
    for (const k of Object.keys(b))
      if (!(k in a)) out.push({ op: "add", path: pointer([...path, k]), value: b[k] });
      else diffOps([...path, k], a[k], b[k], out);
    return;
  }
  out.push({ op: "replace", path: pointer(path), value: b });
}

/** Phần tử của mảng mới: `from` là chỉ số trong mảng cũ (giữ, có thể sửa); không có là phần tử chèn */
type Slot = { from?: number; value: Obj };

/** Mảng `old` ở `path` thành `next`: sửa tại chỗ theo chỉ số cũ, xoá từ cuối lên, rồi chèn theo chỗ mới tăng dần */
function arrayOps(path: Key[], old: readonly unknown[], next: readonly Slot[], out: JsonPatchOp[]) {
  for (const s of next)
    if (s.from !== undefined) diffOps([...path, s.from], old[s.from], s.value, out);
  const kept = new Set(next.flatMap((s) => (s.from === undefined ? [] : [s.from])));
  for (let i = old.length - 1; i >= 0; i--)
    if (!kept.has(i)) out.push({ op: "remove", path: pointer([...path, i]) });
  next.forEach((s, i) => {
    if (s.from === undefined) out.push({ op: "add", path: pointer([...path, i]), value: s.value });
  });
}

type Clamp = ("turn" | "bend" | "dev")[];

/** Độ lệch của phép đổi ở một giây: trước và sau bản vá, như người 3D vẽ */
export interface HoldModeRow {
  /** Giây đã giải */
  t: number;
  /** `t` như JSON viết (giây hay `@mốc±Δ`); hàng giữa hai mốc thì không có */
  ref?: number | string;
  /** `key`: mốc của quãng đổi; `mid`: giữa hai mốc kề */
  kind: "key" | "mid";
  /** Tâm hộp bao của món dời (đơn vị rig) và món quay (độ); món không vẽ ở một bên thì `null` */
  item: { pos: number; angle: number } | null;
  /** Tâm nắm từng tay cầm món dời (đơn vị rig) */
  hand: Partial<Record<HandSide, number>>;
  /** Khớp cổ tay ở giới hạn trước và sau phép đổi: cổ tay kẹp thì bàn tay không tới hướng cần, món theo bàn tay lệch theo */
  clamped: { before: Partial<Record<HandSide, Clamp>>; after: Partial<Record<HandSide, Clamp>> };
  /** `φ` khuỷu tay dẫn trước và sau, độ: hai chế độ chọn khuỷu khác nhau thì cổ tay có thể kẹp */
  phi?: { before: number; after: number };
  /** Bản vá khoá khuỷu tay dẫn ở mốc này (`elbow` hướng khuỷu đang vẽ, `elbowLock`) */
  elbowLock?: true;
  /** Trước hay sau phép đổi, một tay đang hoà giữa hai lần cầm (`HOLD_BLEND`): hai chế độ hoà khác nhau, lệch là bình thường */
  blending?: true;
}

/** Lệch lớn nhất: món dời, món quay, tâm nắm dời */
export interface HoldModeMax {
  item: { pos: number; angle: number };
  hand: number;
  /** Giây của lệch lớn nhất (`outside`) */
  t?: number;
}

/** Kết quả `holdToItemLed` / `holdToHandLed` */
export interface HoldModeResult {
  /** Bản vá JSON thô của cảnh, áp theo thứ tự (`applyJsonPatch`) */
  ops: JsonPatchOp[];
  /** Lần cầm đã đổi: tay dẫn, tay kia cầm cùng món, quãng đổi `[from, until)`, chế độ trước và sau */
  scope: {
    item: string;
    group: string;
    lead: HandSide;
    partner?: HandSide;
    from: number;
    until: number;
    mode: { before: HoldRunInfo["mode"]; after: HoldRunInfo["mode"] | "free" };
  };
  rows: HoldModeRow[];
  /** Lệch lớn nhất ở các mốc của quãng đổi, trừ mốc đang hoà */
  max: HoldModeMax;
  /** Lệch lớn nhất ngoài quãng đổi, mẫu mỗi `HOLD_MODE_STEP` giây trên cả cảnh, trừ mẫu đang hoà */
  outside: HoldModeMax;
  /** Lệch lớn nhất ở các mốc và mẫu đang hoà (`HOLD_BLEND`) */
  blend: HoldModeMax;
  notes: string[];
}

export interface HoldModeOptions {
  /** Người cầm (`cast[].id`) */
  id: string;
  /** Tay chọn lần cầm; tay phụ của `both` hay tay cầm cùng món trong lần cầm của tay kia thì lần cầm là của tay dẫn */
  side: HandSide;
  /** Một giây trong lần cầm (số hay `@mốc±Δ`) */
  at: number | string;
  /** Đổi từ giây này tới hết lần cầm; giữa lần cầm thì chèn mốc `regrip` ở đó. Bỏ trống là cả lần cầm */
  from?: number | string;
  /** Runtime của JSON thô đã vá, `chars` có người cầm như `rt`: để đo độ lệch */
  rebuild: (raw: unknown) => SceneRuntime;
}

/** Bước lấy mẫu độ lệch ngoài quãng đổi, giây */
export const HOLD_MODE_STEP = 0.1;
/** Số lượt chỉnh đích tay dẫn theo chỗ món đo được (đồ theo tay), số lượt thêm mốc khoá khuỷu */
const HOLD_MODE_FIX = 2;
/** Ngưỡng món ở mốc giữ chỗ qua phép đổi: dời (đơn vị rig), quay (độ) */
export const HOLD_MODE_POS = 0.5;
export const HOLD_MODE_ANGLE = 1;
/** Khuỷu tay dẫn sau phép đổi lệch quá chừng này (độ, `φ`) so với khuỷu đang vẽ thì thử khoá khuỷu ở mốc ấy */
const HOLD_MODE_PHI = 0.5;

const EPS = 1e-6;
const sideSign = (s: HandSide) => (s === "right" ? -1 : 1);
const otherSide = (s: HandSide): HandSide => (s === "right" ? "left" : "right");
const near = (a: number, b: number) => Math.abs(a - b) < EPS;
const fail = (m: string): never => {
  throw new Error(`hold_mode: ${m}`);
};
const r2 = (x: number) => Math.round(x * 100) / 100 + 0;
const r3 = (x: number) => Math.round(x * 1000) / 1000 + 0;
/** Tên tay trong câu báo */
const viSide = (s: HandSide) => (s === "right" ? "phải" : "trái");
const r4 = (x: number) => Math.round(x * 1e4) / 1e4 + 0;
const round = (v: readonly number[], f = r2) => v.map((x) => f(x)) as V3;
const toThree = (p: readonly number[]): V3 => [p[0] / 100, -p[1] / 100, -p[2] / 100];
const fromThree = (p: readonly number[]): V3 => [p[0] * 100, -p[1] * 100, -p[2] * 100];
/** Khung món → thế giới rig và → thế giới three: đảo hàng y, z */
const flipRows = (R: M3): M3 => [R[0], R[1], R[2], -R[3], -R[4], -R[5], -R[6], -R[7], -R[8]];
const trVec = (R: M3, v: V3): V3 => [
  R[0] * v[0] + R[3] * v[1] + R[6] * v[2],
  R[1] * v[0] + R[4] * v[1] + R[7] * v[2],
  R[2] * v[0] + R[5] * v[1] + R[8] * v[2],
];
const dist = (a: V3, b: V3) => Math.hypot(...sub3(a, b));
const unit3 = (v: V3): V3 => scale3(v, 1 / (Math.hypot(...v) || 1));
const wrapDeg = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** Góc quay giữa hai khung, độ */
function angleBetween(A: M3, B: M3): number {
  let tr = 0;
  for (let i = 0; i < 9; i++) tr += A[i] * B[i];
  return Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) / D;
}

/** Nghiệm `x` của `[c0 c1 c2] · x = b` */
function solve3(c: [V3, V3, V3], b: V3): V3 {
  const det = (a: V3, e: V3, f: V3) =>
    a[0] * (e[1] * f[2] - e[2] * f[1]) -
    e[0] * (a[1] * f[2] - a[2] * f[1]) +
    f[0] * (a[1] * e[2] - a[2] * e[1]);
  const d = det(c[0], c[1], c[2]);
  if (Math.abs(d) < 1e-12) fail("mốc thân suy biến, không giải được `offset`");
  return [det(b, c[1], c[2]) / d, det(c[0], b, c[2]) / d, det(c[0], c[1], b) / d];
}

/** `offset` để hàm affine `f(offset)` ra `want`: dò ba trục rồi giải */
function offsetFor(f: (o: V3) => V3, want: V3): V3 {
  const p0 = f([0, 0, 0]);
  const col = (i: number) => sub3(f([0, 1, 2].map((j) => (j === i ? 1 : 0)) as V3), p0);
  return solve3([col(0), col(1), col(2)], sub3(want, p0));
}

/** Món và tay của người cầm ở một giây, như người 3D vẽ */
interface Seen {
  /** Khung món → thế giới rig, gốc khung món, cỡ */
  item?: { R: M3; P: V3; s: number };
  grip: Partial<Record<HandSide, V3>>;
  grasp: Partial<Record<HandSide, { choice: GraspChoice; by: GraspBy }>>;
  clamped: Partial<Record<HandSide, Clamp>>;
  /** Hướng khuỷu đang vẽ (thế giới rig, đơn vị): từ trục vai → cổ tay ra khuỷu; ghi vào mốc qua `elbowFor` */
  elbow: Partial<Record<HandSide, V3>>;
  /** `φ` của khuỷu đang vẽ, độ (`phiOf`) */
  phi: Partial<Record<HandSide, number>>;
  /** Một tay của người ấy đang trong `HOLD_BLEND` (`holdBlending`) */
  blend: boolean;
  /** Thân người cầm (three) như mốc món đọc */
  Rr: M3;
  c: ActCharacter;
  sp: ActInput;
}

const holdsAt = (r: HoldRunInfo, t: number, end: number) =>
  r.since <= t + EPS && (t < r.until - EPS || (r.until >= end - EPS && t <= r.until + EPS));

/**
 * Món `item` và hai tay của `id` ở `t`: lần cầm hai tay trên mốc món vẽ món ở `itemAt`, còn lại món theo bàn tay
 * (`actHeld`); nhân vật mặc theo `equip` lúc ấy
 */
function seen(rt: SceneRuntime, id: string, item: string, t: number): Seen {
  const sp = sceneAt(rt, id, t, rt.heights[id] ?? 1, rt.bodies[id] ?? BODY3) as ActInput & {
    equip?: Equip;
  };
  const base = rt.chars?.[id] ?? fail(`thiếu nhân vật của \`${id}\` (\`rt.chars\`)`);
  const c = equipCharacter(base, sp.equip);
  const out: Seen = {
    grip: {},
    grasp: {},
    clamped: {},
    elbow: {},
    phi: {},
    blend: holdBlending(rt, id, "R", t) || holdBlending(rt, id, "L", t),
    Rr: holderTrunk(rt, id, t, { chars: { [id]: c } }).Rr,
    c,
    sp,
  };
  for (const s of ["right", "left"] as const) {
    const a = actArm(c, sp, sideSign(s));
    if (!a) continue;
    out.grip[s] = fromThree(a.grip);
    out.phi[s] = phiOf(a.inp, a.W, a.E);
    const n = unit3(sub3(a.W, a.S));
    const e = sub3(a.E, add3(a.S, scale3(n, dot3(sub3(a.E, a.S), n))));
    if (Math.hypot(...e) > 1e-6)
      out.elbow[s] = round(
        fromThree(unit3(e)).map((x) => x / 100),
        r4,
      );
    const h = a.report.hold;
    if (h?.grasp) out.grasp[s] = { choice: h.grasp.choice, by: h.grasp.by };
    out.clamped[s] = h?.clamped ?? [];
  }
  const runs = holdRuns(rt, id);
  const both = [...runs.right, ...runs.left].some(
    (r) => r.item === item && r.mode === "both" && holdsAt(r, t, rt.duration),
  );
  if (both) {
    const p = itemAt(rt, item, t, { chars: { [id]: c } });
    if (p) out.item = { R: p.R, P: p.P, s: p.s };
  } else {
    const h = Object.values(actHeld(c, sp)).find((x) => x?.item === item);
    if (h) out.item = { R: flipRows(h.R), P: [...h.at] as V3, s: h.s };
  }
  return out;
}

/** Điểm `q` của món (khung món, đơn vị rig) như đang vẽ, thế giới rig */
const itemPoint = (x: NonNullable<Seen["item"]>, q: readonly number[]): V3 =>
  add3(x.P, matVec(x.R, [q[0] * x.s, q[1] * x.s, q[2] * x.s]));

/**
 * Hướng món như đang vẽ: trục `+z` (`face`) và `+y` (`roll`) của khung món ra vectơ hệ thân `[tiến, y xuống, ngang]`;
 * `out` là dấu của trục ngang ở thế giới three (`-1`: ngang phải như mốc món; tay dẫn: ra ngoài phía tay ấy, `sideSign`)
 */
function itemAxes(v: Seen, out: number) {
  const R3 = flipRows(v.item!.R);
  const body = (d: V3) => {
    const l = trVec(v.Rr, d);
    return round([l[2], -l[1], out * l[0]], r4);
  };
  return {
    face: { axis: [0, 0, 1], toward: body(matVec(R3, [0, 0, 1])) },
    roll: { axis: [0, 1, 0], toward: body(matVec(R3, [0, 1, 0])) },
  };
}

const TARGET = ["at", "to", "side", "offset", "point", "palm", "fingers", "bend"] as const;
const INTENT = ["face", "up", "roll", "keep"] as const;
/** Trường chỗ cầm ghi vào `hold` từ lựa chọn rig đã dùng khi cảnh không khai */
const PIN = [
  "part",
  "edge",
  "along",
  "thumb",
  "variant",
  "slant",
  "around",
  "tilt",
  "psi",
  "inset",
] as const;
const BOTH_PIN = ["part", "edge", "along", "thumb", "slant", "variant", "psi", "inset"] as const;
const pinValue = (k: string, v: unknown) =>
  typeof v !== "number" ? v : k === "along" ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10;

type Grasp = Seen["grasp"][HandSide];
/**
 * Trường chỗ cầm ghi thêm: `all` mọi trường, `discrete` chỉ trường rời (trường số rig dùng có thể ngoài miền khai của
 * biến thể), `none` không ghi
 */
export type HoldPin = "all" | "discrete" | "none";
const DISCRETE = new Set(["part", "edge", "thumb", "variant"]);
/**
 * Đo chỗ cầm từ đầu kia của cạnh — đầu cao của cạnh (`high`) không khai được trong cảnh, hai chế độ có thể lấy hai đầu khác
 * nhau: `along` chỉ đổi `along`; `mirror` đổi cả các trường theo chiều cạnh (`mirrorEdge`)
 */
type Flip = "along" | "mirror";
/** Cách ghi chỗ cầm của một lượt dựng bản vá: `pin`; `flip` của tay dẫn, tay kia */
type Way = { pin: HoldPin; flip: Partial<Record<"lead" | "partner", Flip>> };
const FLIP_ALONG: Record<string, string> = { low: "high", high: "low", mid: "mid" };
const FLIP_SLANT: Record<string, string> = { low: "high", high: "low", in: "in" };
const FLIP_THUMB: Record<string, string> = { left: "right", right: "left" };

/**
 * Chỗ cầm đo từ đầu kia của cạnh: `along` → `1 − along`; `mirror` thêm `slant` (quay về đầu cao) đổi dấu và `thumb` của
 * `palmBox` (bên ngón cái dựng từ chiều cạnh) đổi bên — độ ngón chúc dọc hộp `BOX_RISE` vẫn theo chiều cạnh, không bù được
 */
function mirrorEdge(o: Obj, flip: Flip) {
  if (o.along !== undefined)
    o.along =
      typeof o.along === "number" ? r4(1 - o.along) : (FLIP_ALONG[o.along as string] ?? o.along);
  if (flip === "along") return;
  if (o.slant !== undefined)
    o.slant =
      typeof o.slant === "number" ? -o.slant + 0 : (FLIP_SLANT[o.slant as string] ?? o.slant);
  if (o.group === "palmBox" && typeof o.thumb === "string")
    o.thumb = FLIP_THUMB[o.thumb] ?? o.thumb;
}

/**
 * `hold` dạng object, bỏ ý định, ghi các trường lựa chọn rig đã dùng mà cảnh chưa khai (theo `pin`); bỏ qua `variant` của
 * nhóm một biến thể và `part` của món một phần cầm được
 */
function pinnedHold(
  h: SceneHold,
  g: Grasp,
  pin: HoldPin,
  flip: Flip | undefined,
  spec: HeldItemSpec,
): Obj {
  const o: Obj = { ...groupHold(h) };
  for (const k of INTENT) delete o[k];
  if (g && pin !== "none") pinChoice(o, g, pin, spec);
  if (flip) mirrorEdge(o, flip);
  return o;
}

function pinChoice(o: Obj, g: NonNullable<Grasp>, pin: HoldPin, spec: HeldItemSpec) {
  const group = o.group as GroupId;
  const parts = itemGeom(spec).parts.filter((p) => p.grip).length;
  for (const k of PIN) {
    const v = g.choice[k];
    if (o[k] !== undefined || v === undefined || g.by[k] === "scene") continue;
    if (pin === "discrete" && !DISCRETE.has(k)) continue;
    if (k === "variant" && GROUP_VARIANTS[group].length < 2) continue;
    if (k === "part" && parts < 2) continue;
    o[k] = pinValue(k, v);
  }
}

/** `both` của tay dẫn từ chỗ cầm tay kia: nhóm khi khác nhóm tay phụ mặc định, các trường chỗ cầm đã dùng */
function bothOf(lead: SceneHoldGroup, h: SceneHold, g: Grasp, way: Way, spec: HeldItemSpec): Obj {
  const p = pinnedHold(h, g, way.pin, way.flip.partner, spec);
  const o: Obj = {};
  if (p.group !== supportGroup(lead)) o.group = p.group;
  for (const k of BOTH_PIN) if (p[k] !== undefined) o[k] = p[k];
  return o;
}

/** Mốc JSON thô kèm chỉ số và giây đã giải */
type RawKey = { j: number; t: number; k: Obj };

interface Plan {
  lead: HandSide;
  partner?: HandSide;
  run: HoldRunInfo;
  partners: HoldRunInfo[];
}

/**
 * Lần cầm chứa giây `t` của tay `side`, quy về tay dẫn. Tay kia cầm cùng món (không phải tay phụ của `both`) thì các lần
 * cầm ấy phải nằm trong lần cầm của tay dẫn; tay dẫn là tay có lần cầm bao lần cầm kia
 */
function planOf(rt: SceneRuntime, id: string, side: HandSide, t: number): Plan {
  const runs = holdRuns(rt, id);
  const end = rt.duration;
  let lead = side;
  let run =
    runs[side].find((r) => holdsAt(r, t, end)) ?? fail(`tay ${viSide(side)} không cầm gì ở ${t}s`);
  if (run.lead) {
    lead = run.lead;
    run =
      runs[lead].find((r) => !r.lead && holdsAt(r, t, end)) ??
      fail(`không thấy lần cầm của tay dẫn ở ${t}s`);
  }
  if (run.group === "carry") fail(`\`${run.item}@carry\` treo trên tay, không có hai chế độ`);
  const overlap = (a: HoldRunInfo) => (r: HoldRunInfo) =>
    !r.lead && r.item === a.item && r.since < a.until - EPS && r.until > a.since + EPS;
  const within = (a: HoldRunInfo) => (r: HoldRunInfo) =>
    r.since >= a.since - EPS && r.until <= a.until + EPS;
  let partners = runs[otherSide(lead)].filter(overlap(run));
  if (partners.length && !partners.every(within(run))) {
    const outer = partners.length === 1 ? partners[0] : undefined;
    const back = outer ? runs[lead].filter(overlap(outer)) : [];
    if (!outer || !back.every(within(outer)))
      fail(`hai tay cầm \`${run.item}\` mà hai lần cầm không lồng nhau — đổi từng lần cầm một`);
    lead = otherSide(lead);
    run = outer!;
    partners = back;
  }
  return { lead, run, partners, ...(partners.length && { partner: otherSide(lead) }) };
}

/** Mốc giờ `ref` dời `dt` giây, giữ dạng `@tên±Δ`; `ref` không phải mốc tên thì là số `t` */
function shiftRef(ref: unknown, dt: number, t: number): number | string {
  const m = typeof ref === "string" && parseMarkRef(ref);
  if (!m) return r3(t);
  const d = r3(m.offset + dt);
  return d ? `@${m.name}${d > 0 ? "+" : "-"}${Math.abs(d)}` : `@${m.name}`;
}

/** `hold` có hiệu lực của tay `side` ở `t` theo mốc thô; `null` là không cầm */
function holdIn(keys: RawKey[], side: HandSide, t: number): SceneHold | null {
  let h: SceneHold | null = null;
  for (const k of keys) {
    if (k.t > t + EPS) break;
    const x = k.k[side];
    if (isObj(x) && x.hold !== undefined) h = x.hold as SceneHold | null;
  }
  return h;
}

type Mode = "item" | "hand";

/**
 * Một lượt dựng bản vá; `shift` dời đích tay dẫn ở từng giây (lượt chỉnh theo chỗ món đo được), `lock` khoá khuỷu tay dẫn
 * ở các giây ấy vào hướng khuỷu đang vẽ
 */
type Compose = (shift: Map<number, V3>, way: Way, lock: ReadonlySet<number>) => JsonPatchOp[];

interface Ctx {
  to: Mode;
  item: string;
  spec: HeldItemSpec;
  lead: HandSide;
  partner?: HandSide;
  run: HoldRunInfo;
  cut: number;
  times: number[];
  refOf: Map<number, unknown>;
  before: Map<number, Seen>;
  /**
   * Đồ theo tay: điểm đích tay dẫn nhắm ở từng giây (thế giới rig), `pt` là mốc món đặt vào đích; `q` là điểm món (khung
   * món) phải giữ chỗ `at` — lượt chỉnh dời đích theo nó
   */
  aims: Map<number, { want: V3; pt?: string; q: V3; at: V3 }>;
  notes: string[];
}

function plan(rt: SceneRuntime, raw: unknown, o: HoldModeOptions, to: Mode) {
  if (!isObj(raw) || !Array.isArray(raw.cast)) fail("`raw` không phải JSON cảnh");
  const scene = raw as Obj & { cast: Obj[]; items?: unknown; marks?: Record<string, number> };
  const marks = scene.marks ?? {};
  const tOf = (ref: unknown) => markTime(ref as number | string, marks);
  const ci = scene.cast.findIndex((m) => m.id === o.id);
  if (ci < 0) fail(`không có \`${o.id}\` trong \`cast\``);
  const world = scene.cast[ci].world;
  const rawHands = (isObj(world) && Array.isArray(world.hands) ? world.hands : []) as Obj[];
  const keys: RawKey[] = rawHands.map((k, j) => ({ j, t: tOf(k.t), k }));
  const rawItems = (Array.isArray(scene.items) ? scene.items : []) as Obj[];

  const { lead, partner, run, partners } = planOf(rt, o.id, o.side, tOf(o.at));
  if (to === "item" && run.mode !== "hand")
    fail(`lần cầm \`${run.item}\` của tay ${viSide(lead)} đã là tay theo đồ (\`${run.mode}\`)`);
  if (to === "hand" && run.mode === "hand")
    fail(`lần cầm \`${run.item}\` của tay ${viSide(lead)} đã là đồ theo tay`);
  const item = run.item;
  const spec: HeldItemSpec =
    rt.held[item] ?? rt.held[heldBase(item)] ?? fail(`không có món \`${item}\``);
  const cut = o.from === undefined ? run.since : tOf(o.from);
  if (cut < run.since - EPS || cut >= run.until - EPS)
    fail(`\`from\` ${cut}s ngoài lần cầm [${run.since}, ${run.until})`);
  const mid = cut > run.since + EPS;
  const atCut = (t: number) => mid && near(t, cut);
  const inW = (t: number) => t >= cut - EPS && t < run.until - EPS;
  const partnerHolds = (t: number) => partners.some((r) => r.since <= t + EPS && t < r.until - EPS);
  const partnerSpans = partners.some((r) => r.since < cut - EPS && r.until > cut + EPS);
  const marksW = rawItems
    .map((k, j) => ({ j, t: tOf(k.t), k }))
    .filter((m) => m.k.item === item && m.k.cast === o.id && inW(m.t));
  if (marksW.some((m) => m.k.rest))
    fail("lần cầm có mốc món nằm (`rest`): tay dẫn không tả được món nằm chờ tay");

  const leadKeys = keys.filter((k) => inW(k.t) && k.k[lead] !== undefined);
  const partKeys = partner ? keys.filter((k) => inW(k.t) && k.k[partner] !== undefined) : [];
  const refOf = new Map<number, unknown>();
  const put = (t: number, ref: unknown) => {
    if (![...refOf.keys()].some((x) => near(x, t))) refOf.set(t, ref);
  };
  put(cut, o.from ?? keys.find((k) => near(k.t, cut))?.k.t ?? cut);
  for (const k of [...leadKeys, ...partKeys]) put(k.t, k.k.t);
  if (to === "hand") for (const m of marksW) put(m.t, m.k.t);
  const times = [...refOf.keys()].sort((a, b) => a - b);
  // `before`: như đang vẽ (đo độ lệch); `src`: món và tay để viết mốc
  const before = new Map<number, Seen>();
  const src = new Map<number, Seen>();
  for (const t of times) {
    const v0 = seen(rt, o.id, item, t);
    before.set(t, v0);
    let v = v0;
    // mốc mở lần cầm theo món: bàn tay còn hoà từ tay tự do, lấy món ở mốc và tâm nắm trong món của lúc đã hoà xong
    if (to === "hand" && v.blend && near(t, run.since)) {
      const ip = itemAt(rt, item, t, { chars: { [o.id]: v.c } });
      const ts = Math.min(run.since + HOLD_BLEND + 0.01, (run.since + run.until) / 2);
      const s = seen(rt, o.id, item, ts);
      const g = s.grip[lead];
      if (ip && s.item && g) {
        const x = s.item;
        const d = sub3(g, x.P);
        const q = trVec(x.R, d).map((u) => u / x.s);
        const settled = { R: ip.R, P: ip.P, s: ip.s };
        v = {
          ...v,
          item: settled,
          grip: { ...v.grip, [lead]: itemPoint(settled, q) },
          elbow: s.elbow,
        };
      }
    }
    if (!v.item) fail(`không thấy \`${item}\` đang vẽ ở ${t}s`);
    src.set(t, v);
  }

  /** Mốc gần nhất ưu tiên trước `t` */
  const nearest = <X extends { t: number }>(xs: X[], t: number) =>
    xs.filter((x) => x.t <= t + EPS).at(-1) ?? xs.find((x) => x.t > t);
  const handTargets = leadKeys.filter((k) => {
    const x = k.k[lead];
    return isObj(x) && (x.at !== undefined || x.to !== undefined);
  });
  /** Mốc tham chiếu cho chỗ đích ở `t`: `to` (mốc thân) hay `at`, và mốc món `point` */
  const refAt = (t: number): { to?: BodyMark; pt?: string } => {
    if (to === "item") {
      const x = nearest(handTargets, t)?.k[lead] as Obj | undefined;
      const p =
        typeof x?.point === "string" && x.point.startsWith("item:") ? x.point.slice(5) : undefined;
      return { to: x?.to as BodyMark | undefined, pt: p };
    }
    const m = (marksW.find((m) => near(m.t, t)) ?? nearest(marksW, t))?.k;
    return {
      to: m?.to as BodyMark | undefined,
      pt: typeof m?.point === "string" ? m.point : undefined,
    };
  };
  const aims: Ctx["aims"] = new Map();
  if (to === "hand")
    for (const t of times) {
      const v = src.get(t)!;
      const { pt } = refAt(t);
      const q = pt ? heldPoint(spec, pt) : itemCentre(spec);
      const at = itemPoint(v.item!, q);
      aims.set(t, { want: pt ? at : v.grip[lead]!, pt, q, at });
    }

  /** Hướng khuỷu thế giới rig `e` ở `t` ra `elbow` của mốc `x` theo hệ của đích: mốc có `at` thế giới, mốc khác hệ thân */
  const elbowFor = (x: Obj, e: readonly number[], t: number, side: HandSide): V3 =>
    x.at !== undefined ? round(e, r4) : round(rigElbowBody(src.get(t)!.Rr, sideSign(side), e), r4);
  /** `elbow` đã khai của mốc `x` ở `t`, quy ra thế giới rig (trước khi đích của mốc đổi) */
  const elbowOf = (x: Obj, t: number, side: HandSide): V3 | undefined =>
    Array.isArray(x.elbow)
      ? elbowRig(src.get(t)!.Rr, sideSign(side), {
          v: x.elbow as number[],
          ...(x.at === undefined && { body: true }),
        })
      : undefined;

  /** Mốc tay dẫn ở giây khoá: `elbow` là hướng khuỷu đang vẽ, `elbowLock` */
  const lockKey = (x: Obj, t: number, lock: ReadonlySet<number>) => {
    const e = src.get(t)!.elbow[lead];
    if (!lock.has(t) || !e) return;
    x.elbow = elbowFor(x, e, t, lead);
    x.elbowLock = true;
  };

  const compose: Compose = (shift, way, lock) => {
    const hands: Slot[] = rawHands.map((k, j) => ({ from: j, value: structuredClone(k) }));
    const keyAt = (t: number, ref = refOf.get(times.find((x) => near(x, t))!)): Obj => {
      const i = hands.findIndex((s) => near(tOf(s.value.t), t));
      if (i >= 0) return hands[i].value;
      const k: Obj = { t: ref };
      const at = hands.findIndex((s) => tOf(s.value.t) > t);
      hands.splice(at < 0 ? hands.length : at, 0, { value: k });
      return k;
    };
    const items: Slot[] = rawItems.map((k, j) => ({ from: j, value: structuredClone(k) }));
    const strip = (k: Obj, side: HandSide, hold: Obj, t: number) => {
      const x: Obj = isObj(k[side]) ? { ...(k[side] as Obj) } : {};
      const [e, hadAt] = [elbowOf(x, t, side), x.at !== undefined];
      for (const f of TARGET) delete x[f];
      if (e && hadAt) x.elbow = elbowFor(x, e, t, side);
      x.hold = hold;
      k[side] = x;
    };

    if (to === "item") {
      for (const t of times) {
        const v = src.get(t)!;
        const ref = refAt(t);
        const want = itemPoint(v.item!, ref.pt ? heldPoint(spec, ref.pt) : itemCentre(spec));
        let spot: Obj = { at: round(want) };
        if (ref.to && !isOtherHand(ref.to)) {
          const T = holderTrunk(rt, o.id, t, { chars: { [o.id]: v.c } });
          spot = {
            to: ref.to,
            offset: round(offsetFor((x) => itemMarkPoint(T, ref.to!, x), toThree(want))),
          };
        }
        const mark: Obj = {
          t: refOf.get(t),
          cast: o.id,
          item,
          ...spot,
          ...(ref.pt && { point: ref.pt }),
          ...itemAxes(v, -1),
          ease: "auto",
        };
        const at = items.findIndex((s) => tOf(s.value.t) > t + EPS);
        items.splice(at < 0 ? items.length : at, 0, { value: mark });
        // tay dẫn chỉ còn chỗ cầm; mỗi mốc của quãng đổi mang `hold` để giữ `elbow`, `ease` và trường lạ
        const has = leadKeys.some((k) => near(k.t, t));
        if (!has && !atCut(t) && !lock.has(t)) continue;
        const k = keyAt(t);
        if (k[lead] === null) continue;
        const h = pinnedHold(
          holdIn(keys, lead, t) ?? fail(`tay ${viSide(lead)} không cầm ở ${t}s`),
          v.grasp[lead],
          way.pin,
          way.flip.lead,
          spec,
        );
        if (atCut(t)) h.regrip = true;
        strip(k, lead, h, t);
        lockKey(k[lead] as Obj, t, lock);
      }
      if (partner)
        for (const t of times) {
          if (!partnerHolds(t)) continue;
          const has = partKeys.some((k) => near(k.t, t) && isObj(k.k[partner]));
          const split = atCut(t) && partnerSpans;
          if (!has && !split) continue;
          const h = holdIn(keys, partner, t);
          if (!h) continue;
          const ph = pinnedHold(h, src.get(t)!.grasp[partner], way.pin, way.flip.partner, spec);
          if (split) ph.regrip = true;
          strip(keyAt(t), partner, ph, t);
        }
      // mốc chỉ còn đúng `hold` của mốc trước và mốc sau trong quãng đổi: thừa
      for (const side of partner ? [lead, partner] : [lead]) {
        const xs = hands.filter((s) => inW(tOf(s.value.t)) && isObj(s.value[side]));
        for (let i = 1; i < xs.length; i++) {
          const x = xs[i].value[side] as Obj;
          const prev = xs[i - 1].value[side] as Obj | undefined;
          const next = xs[i + 1]?.value[side] as Obj | undefined;
          if (Object.keys(x).length !== 1 || !prev || !same(x.hold, prev.hold)) continue;
          if (next && !same(next.hold, x.hold)) continue;
          delete xs[i].value[side];
          xs.splice(i--, 1);
        }
      }
    } else {
      for (const t of times) {
        const v = src.get(t)!;
        const ref = refAt(t);
        const aim = aims.get(t)!;
        const want = add3(aim.want, shift.get(t) ?? [0, 0, 0]);
        const h = holdIn(keys, lead, t) ?? fail(`tay ${viSide(lead)} không cầm ở ${t}s`);
        const lh: Obj = {
          ...pinnedHold(h, v.grasp[lead], way.pin, way.flip.lead, spec),
          ...itemAxes(v, sideSign(lead)),
        };
        if (partner) {
          delete lh.both;
          const ph = partnerHolds(t) ? holdIn(keys, partner, t) : null;
          if (ph && groupHold(ph).item === item)
            lh.both = bothOf(groupHold(h), ph, v.grasp[partner], way, spec);
        }
        if (atCut(t)) lh.regrip = true;
        let spot: Obj = { at: round(want) };
        if (ref.to) {
          const f = (x: V3) =>
            bodyMarkAt(v.c, v.sp, { to: ref.to!, offset: x }, lead === "right" ? "R" : "L") ??
            fail("không đặt được đích theo mốc thân");
          spot = { to: ref.to, offset: round(offsetFor(f, want)) };
        }
        const k = keyAt(t);
        const fresh = !isObj(k[lead]);
        const x: Obj = fresh ? {} : { ...(k[lead] as Obj) };
        const [e0, hadAt] = [elbowOf(x, t, lead), x.at !== undefined];
        for (const f of TARGET) delete x[f];
        Object.assign(x, spot, { point: aim.pt ? `item:${aim.pt}` : "grip", hold: lh });
        // khuỷu đang vẽ làm cực khởi đầu của bộ giải ý định; mốc đã khai `elbow` thì giữ hướng ấy (đổi hệ khi đích đổi)
        if (!e0 && v.elbow[lead]) x.elbow = elbowFor(x, v.elbow[lead]!, t, lead);
        else if (e0 && hadAt !== (x.at !== undefined)) x.elbow = elbowFor(x, e0, t, lead);
        lockKey(x, t, lock);
        if (fresh) x.ease = "auto";
        k[lead] = x;
      }
      if (partner) {
        for (const pk of partKeys) {
          const k = hands.find((s) => s.from === pk.j)!.value;
          const x = k[partner];
          if (!isObj(x) || !x.hold) continue;
          const rest = { ...x };
          delete rest.hold;
          if (rest.at !== undefined || rest.to !== undefined) k[partner] = rest;
          else delete k[partner];
        }
        // tay kia đang cầm qua chỗ đổi: buông ở đó, từ đó là tay phụ của `both`
        if (partnerSpans) {
          const k = keyAt(cut);
          k[partner] = { ...(isObj(k[partner]) ? (k[partner] as Obj) : {}), hold: null };
        }
      }
      for (const m of marksW)
        items.splice(
          items.findIndex((s) => s.from === m.j),
          1,
        );
      // tay dẫn chưa có mốc nào trước lần cầm: đích đầu tiên giữ từ giây 0, nên thả tay về hành động trước `HOLD_BLEND`
      if (
        !mid &&
        run.since > EPS &&
        !keys.some((k) => k.t < run.since - EPS && k.k[lead] !== undefined)
      ) {
        const t0 = Math.max(0, run.since - HOLD_BLEND);
        const k = keyAt(t0, shiftRef(refOf.get(times[0]), t0 - run.since, t0));
        if (k[lead] === undefined) k[lead] = null;
      }
    }
    for (let i = hands.length - 1; i >= 0; i--)
      if (Object.keys(hands[i].value).every((f) => f === "t" || f === "snap")) hands.splice(i, 1);

    const ops: JsonPatchOp[] = [];
    arrayOps(["cast", ci, "world", "hands"], rawHands, hands, ops);
    if (!Array.isArray(scene.items)) {
      if (items.length) ops.push({ op: "add", path: "/items", value: items.map((s) => s.value) });
    } else if (!items.length && rawItems.length) ops.push({ op: "remove", path: "/items" });
    else arrayOps(["items"], rawItems, items, ops);
    // cảnh đời trước: `elbow` vừa ghi theo nghĩa mới (hệ thân trên mốc không có `at`)
    if (sceneVersionUp(scene) !== scene)
      ops.push({ op: "replace", path: "/schemaVersion", value: SCENE_VERSION });
    return ops;
  };

  const ctx: Ctx = {
    to,
    item,
    spec,
    lead,
    partner,
    run,
    cut,
    times,
    refOf,
    before,
    aims,
    notes: [],
  };
  return { ctx, compose };
}

/** Lệch giữa hai lần vẽ ở một giây: món (tâm hộp bao, góc), tâm nắm của các tay `sides` */
function diff(a: Seen, b: Seen, spec: HeldItemSpec, sides: HandSide[]) {
  const c = itemCentre(spec);
  const item =
    a.item && b.item
      ? {
          pos: dist(itemPoint(a.item, c), itemPoint(b.item, c)),
          angle: angleBetween(a.item.R, b.item.R),
        }
      : null;
  const hand: Partial<Record<HandSide, number>> = {};
  for (const s of sides) {
    const p = a.grip[s];
    const q = b.grip[s];
    if (p && q) hand[s] = dist(p, q);
  }
  return { item, hand };
}

const maxOf = (rows: { item: HoldModeRow["item"]; hand: HoldModeRow["hand"]; t: number }[]) => {
  const m: HoldModeMax = { item: { pos: 0, angle: 0 }, hand: 0 };
  let worst = -1;
  for (const r of rows) {
    m.item.pos = Math.max(m.item.pos, r.item?.pos ?? 0);
    m.item.angle = Math.max(m.item.angle, r.item?.angle ?? 0);
    const h = Math.max(0, ...Object.values(r.hand));
    m.hand = Math.max(m.hand, h);
    const w = (r.item?.pos ?? 0) + (r.item?.angle ?? 0) + h;
    if (w > worst) [worst, m.t] = [w, r.t];
  }
  return m;
};

/** Dựng runtime của bản vá; lỗi dựng trả lời báo */
function apply(raw: unknown, ops: JsonPatchOp[], o: HoldModeOptions): SceneRuntime | string {
  try {
    return o.rebuild(applyJsonPatch(raw, ops));
  } catch (e) {
    return (e as Error).message;
  }
}

const PINS: HoldPin[] = ["all", "discrete", "none"];

function convert(rt: SceneRuntime, raw: unknown, o: HoldModeOptions, to: Mode): HoldModeResult {
  const { ctx, compose } = plan(rt, raw, o, to);
  const { item, spec, lead, partner, run, cut, times, before } = ctx;
  const sides: HandSide[] = [lead, otherSide(lead)];
  // tay kia chỉ tính khi nó cầm món ở một bên
  const holding = (r: SceneRuntime, s: HandSide, t: number) =>
    holdRuns(r, o.id)[s].some((x) => x.item === item && holdsAt(x, t, r.duration));
  const compare = (rt2: SceneRuntime, t: number, a = seen(rt, o.id, item, t)) => {
    const b = seen(rt2, o.id, item, t);
    const use = sides.filter((s) => s === lead || holding(rt, s, t) || holding(rt2, s, t));
    return { t, a, b, ...diff(a, b, spec, use), use, blend: a.blend || b.blend };
  };
  const measureKeys = (rt2: SceneRuntime) => times.map((t) => compare(rt2, t, before.get(t)!));
  /** Đo các mốc trên runtime sau phép đổi; bộ giải ném (chỗ cầm cảnh khai không giải được ở chế độ mới) thì lời báo */
  const tryMeasure = (rt2: SceneRuntime) => {
    try {
      return measureKeys(rt2);
    } catch (e) {
      return (e as Error).message;
    }
  };

  // lựa chọn rig dùng có thể không khai được (trường số ngoài miền của biến thể, phần không cầm được): lùi dần cách ghi
  // chỗ cầm tới khi cảnh dựng được
  let shift = new Map<number, V3>();
  let lock: ReadonlySet<number> = new Set();
  let way: Way = { pin: "all", flip: {} };
  let ops: JsonPatchOp[] = [];
  let built: SceneRuntime | string = "";
  for (const pin of PINS) {
    way = { pin, flip: {} };
    ops = compose(shift, way, lock);
    built = apply(raw, ops, o);
    if (typeof built !== "string") break;
  }
  if (typeof built === "string") return fail(`cảnh sau phép đổi không dựng được: ${built}`);
  if (way.pin !== "all")
    ctx.notes.push(
      way.pin === "discrete"
        ? "chỗ cầm chỉ ghi thêm trường rời: trường số rig đang dùng không khai được"
        : "chỗ cầm không ghi thêm trường nào: lựa chọn rig đang dùng không khai được",
    );
  let rt2: SceneRuntime = built;
  const first = tryMeasure(rt2);
  if (typeof first === "string") return fail(`cảnh sau phép đổi không giải được: ${first}`);
  let keyed = first;
  const score = (rows: typeof keyed) =>
    Math.max(
      0,
      ...rows
        .filter((r) => !r.blend)
        .map((r) => (r.item?.pos ?? 0) + Math.max(0, ...Object.values(r.hand))),
    );
  type Rows = typeof keyed;
  /** Thử một lượt dựng khác, giữ nếu lệch ở mốc nhỏ hơn: theo `by`, hay `better(mới, cũ)` */
  const attempt = (
    sh: Map<number, V3>,
    w: Way,
    by: (rows: Rows) => number = score,
    lk = lock,
    better = (a: Rows, b: Rows) => by(a) < by(b) - 1e-6,
  ) => {
    const ops2 = compose(sh, w, lk);
    const rt3 = apply(raw, ops2, o);
    if (typeof rt3 === "string") return false;
    const k2 = tryMeasure(rt3);
    if (typeof k2 === "string" || !better(k2, keyed)) return false;
    [shift, way, lock, ops, rt2, keyed] = [sh, w, lk, ops2, rt3, k2];
    return true;
  };
  // món ở mốc so bằng lệch dời và quay theo ngưỡng của phép đổi (`HOLD_MODE_POS`, `HOLD_MODE_ANGLE`)
  const itemDrift = (r: Rows[number]) =>
    (r.item?.pos ?? 0) / HOLD_MODE_POS + (r.item?.angle ?? 0) / HOLD_MODE_ANGLE;
  const still = (x: Rows) => x.filter((r) => !r.blend);
  const itemMax = (x: Rows) => Math.max(0, ...still(x).map(itemDrift));
  const itemSum = (x: Rows) => still(x).reduce((n, r) => n + itemDrift(r), 0);
  /** Tâm nắm tay dẫn dời: bàn tay đứng chỗ khác trên món */
  const handMax = (x: Rows) => Math.max(0, ...still(x).map((r) => r.hand[lead] ?? 0));
  /** Khuỷu tay dẫn lệch khuỷu đang vẽ, độ (`φ`) */
  const phiGap = (x: Rows) =>
    Math.max(
      0,
      ...still(x).map((r) => {
        const [p, q] = [r.a.phi[lead], r.b.phi[lead]];
        return p === undefined || q === undefined ? 0 : Math.abs(wrapDeg(q - p));
      }),
    );
  /**
   * `a` hơn `b`: món lệch ít hơn (lớn nhất rồi tổng); món ngang nhau thì tâm nắm tay dẫn dời ít hơn; cả hai ngang nhau thì,
   * khi `phi`, khuỷu gần khuỷu đang vẽ hơn
   */
  const ranks =
    (phi: boolean) =>
    (a: Rows, b: Rows): boolean => {
      for (const [f, tol] of [
        [itemMax, 0.02],
        [itemSum, 0.02],
        [handMax, 0.05],
      ] as const) {
        const d = f(a) - f(b);
        if (d < -tol) return true;
        if (d > tol) return false;
      }
      return phi && phiGap(a) < phiGap(b) - HOLD_MODE_PHI;
    };
  const itemBetter = ranks(false);
  const lockBetter = ranks(true);
  /** `along` đo từ đầu kia của cạnh ở tay dẫn, tay kia hay cả hai: thử lần lượt, giữ cách lệch ít hơn */
  const FLIPS = [undefined, "along", "mirror"] as const;
  const flips: Way["flip"][] = FLIPS.flatMap((l) =>
    (partner ? FLIPS : [undefined]).map((p) => ({
      ...(l && { lead: l }),
      ...(p && { partner: p }),
    })),
  ).filter((f) => f.lead || f.partner);
  const tryFlips = (lk: ReadonlySet<number>, better?: (a: Rows, b: Rows) => boolean) => {
    const base = keyed;
    const w0 = way;
    for (const flip of [{}, ...flips]) {
      if (lk === lock && same(flip, way.flip)) continue;
      if (better || keyed === base || score(keyed) > 1)
        attempt(shift, { ...w0, flip }, score, lk, better);
    }
  };
  /**
   * Mốc mà chế độ mới chọn khuỷu khác khuỷu đang vẽ: khoá khuỷu tay dẫn vào hướng đang vẽ ở đó và ở mốc ngay sau (không thì
   * khoá kéo dài qua mốc sau), giữ khi lệch món giảm; mốc khoá đổi khung cầm nên thử lại cả `along` hai đầu. Tay phụ của món
   * đặt trước không khoá
   */
  const relock = () => {
    for (let pass = 0; pass < HOLD_MODE_FIX; pass++) {
      const add = keyed.flatMap((r, i) => {
        const [a, b] = [r.a.phi[lead], r.b.phi[lead]];
        const off =
          !r.blend &&
          !lock.has(r.t) &&
          a !== undefined &&
          b !== undefined &&
          Math.abs(wrapDeg(b - a)) > HOLD_MODE_PHI;
        const next = keyed[i + 1];
        return off ? [r.t, ...(next && !next.blend ? [next.t] : [])] : [];
      });
      if (!add.length) return;
      const base = keyed;
      tryFlips(new Set([...lock, ...add]), lockBetter);
      if (keyed === base) return;
    }
  };
  const flip0 = way.flip;
  if (score(keyed) > 1) tryFlips(lock);
  relock();
  if (to === "hand")
    for (let pass = 0; pass < HOLD_MODE_FIX; pass++) {
      const next = new Map(shift);
      for (const r of keyed) {
        const aim = ctx.aims.get(r.t)!;
        // món giữ chỗ, bàn tay đổi theo: khung cầm của hai chế độ có thể khác nhau
        const got = r.b.item && itemPoint(r.b.item, aim.q);
        if (!got || r.blend) continue;
        const d = sub3(aim.at, got);
        if (Math.hypot(...d) >= 0.05) next.set(r.t, add3(shift.get(r.t) ?? [0, 0, 0], d));
      }
      if (next.size === shift.size && [...next].every(([t, v]) => shift.get(t) === v)) break;
      if (!attempt(next, way, score, lock, itemBetter)) break;
    }
  if (!same(way.flip, flip0))
    ctx.notes.push(
      `chỗ cầm ${(["lead", "partner"] as const)
        .filter((k) => way.flip[k])
        .map(
          (k) =>
            `tay ${viSide(k === "lead" ? lead : partner!)} đo từ đầu kia của cạnh (${way.flip[k] === "along" ? "`along`" : `\`along\`, \`slant\`${run.group === "palmBox" ? ", `thumb`" : ""}`})`,
        )
        .join(
          ", ",
        )}: hai chế độ lấy đầu cao của cạnh khác nhau (docs/11-nhom-cam.md § Đổi chế độ lần cầm)`,
    );

  const row = (r: ReturnType<typeof compare>, kind: HoldModeRow["kind"]): HoldModeRow => ({
    t: r.t,
    ...(kind === "key" && { ref: ctx.refOf.get(r.t) as number | string }),
    kind,
    item: r.item,
    hand: r.hand,
    clamped: { before: pick(r.a.clamped, r.use), after: pick(r.b.clamped, r.use) },
    ...(r.a.phi[lead] !== undefined &&
      r.b.phi[lead] !== undefined && { phi: { before: r.a.phi[lead]!, after: r.b.phi[lead]! } }),
    ...(kind === "key" && lock.has(r.t) && { elbowLock: true as const }),
    ...(r.blend && { blending: true as const }),
  });
  const rows: HoldModeRow[] = [];
  keyed.forEach((r, i) => {
    if (i > 0) rows.push(row(compare(rt2, (keyed[i - 1].t + r.t) / 2), "mid"));
    rows.push(row(r, "key"));
  });

  const out: ReturnType<typeof compare>[] = [];
  const end = run.until >= rt.duration - EPS ? Infinity : run.until;
  for (let i = 0; i * HOLD_MODE_STEP <= rt.duration + EPS; i++) {
    const t = Math.round(i * HOLD_MODE_STEP * 1e6) / 1e6;
    if (t >= cut - EPS && t < end - EPS) continue;
    out.push(compare(rt2, t));
  }

  if (lock.size)
    ctx.notes.push(
      `khuỷu tay ${viSide(lead)} khoá (\`elbowLock\`) vào hướng đang vẽ ở ${[...lock]
        .sort((a, b) => a - b)
        .map((t) => `${r3(t)}s`)
        .join(", ")}: chế độ mới tự chọn khuỷu khác khuỷu đang vẽ`,
    );
  const now = holdRuns(rt2, o.id)[lead].find((r) => !r.lead && holdsAt(r, cut, rt2.duration));
  if (!now) ctx.notes.push(`sau phép đổi tay ${viSide(lead)} không cầm \`${item}\` ở ${cut}s`);
  else if (Math.abs(now.since - cut) > EPS || Math.abs(now.until - run.until) > EPS)
    ctx.notes.push(
      `lần cầm sau phép đổi là [${now.since}, ${now.until}), khác quãng đổi [${cut}, ${run.until})`,
    );
  if (partner && to === "hand")
    for (const t of times)
      if (holding(rt, partner, t) && !holding(rt2, partner, t))
        ctx.notes.push(
          `tay ${viSide(partner)} không cầm \`${item}\` ở ${t}s sau phép đổi: \`both\` không có tay phụ`,
        );
  if (run.since > EPS && near(cut, run.since))
    ctx.notes.push(
      to === "item"
        ? `lần cầm mở ở ${run.since}s: tay theo đồ hoà từ tay tự do trong \`HOLD_BLEND\` sau mốc, trước mốc tay tự do theo đích của mốc trước; đồ theo tay tới đích đúng ở mốc`
        : `lần cầm mở ở ${run.since}s: mốc tay ở đó lấy món ở mốc món (lúc đã hoà xong), không lấy bàn tay đang hoà từ tay tự do`,
    );
  const changed = still(out).filter(
    (r) =>
      (r.item?.pos ?? 0) > 0.5 ||
      (r.item?.angle ?? 0) > 1 ||
      Math.max(0, ...Object.values(r.hand)) > 0.5,
  );
  if (changed.length)
    ctx.notes.push(
      `ngoài quãng đổi hình đổi ở ${changed[0].t}–${changed.at(-1)!.t}s: phần lần cầm trước giây đổi không còn đi về đích hay mốc món sau nó, hay tay tự do đi tới món theo chế độ mới (xem \`outside\`)`,
    );
  const moving = [...keyed, ...out].filter((r) => r.blend);
  if (moving.length)
    ctx.notes.push(
      `${moving.length} mẫu trong \`HOLD_BLEND\` (tay đang hoà giữa hai lần cầm) không tính vào \`max\`, \`outside\`: xem \`blend\``,
    );

  return {
    ops,
    scope: {
      item,
      group: run.group,
      lead,
      ...(partner && { partner }),
      from: cut,
      until: run.until,
      mode: { before: run.mode, after: now?.mode ?? "free" },
    },
    rows,
    max: maxOf(still(keyed)),
    outside: maxOf(still(out)),
    blend: maxOf(moving),
    notes: ctx.notes,
  };
}

const pick = <T>(m: Partial<Record<HandSide, T>>, sides: HandSide[]) =>
  Object.fromEntries(sides.filter((s) => m[s] !== undefined).map((s) => [s, m[s]])) as Partial<
    Record<HandSide, T>
  >;

/**
 * Đồ theo tay → tay theo đồ: mỗi mốc tay của lần cầm (từ `o.from`) sinh một mốc món ở cùng `t` từ món đang vẽ — `to` +
 * `offset` khi mốc tay dùng `to`, không thì `at`; hướng bằng `face` (`+z` khung món) và `roll` (`+y`) vectơ hệ thân;
 * `ease: "auto"` — rồi bỏ đích, ý định ở mốc tay, ghi các trường chỗ cầm rig đã dùng mà cảnh chưa khai. `raw` là JSON thô
 * của cảnh mà `rt` dựng từ; trả bản vá và độ lệch trước/sau. docs/11-nhom-cam.md § Đổi chế độ lần cầm
 */
export const holdToItemLed = (rt: SceneRuntime, raw: unknown, o: HoldModeOptions) =>
  convert(rt, raw, o, "item");

/**
 * Tay theo đồ → đồ theo tay: mỗi mốc tay và mốc món của lần cầm (từ `o.from`) thành mốc tay có đích ở tâm nắm đang vẽ
 * (`point: "grip"`; mốc món có `point` thì `item:<mốc>`), `to` + `offset` khi mốc món dùng `to`; `hold` nhận ý định
 * `face` + `roll` vectơ hệ thân từ món đang vẽ; mốc món của quãng đổi bị xoá. Tay kia cầm cùng món thành `both` của tay
 * dẫn. Đích chỉnh lại để món giữ chỗ (`HOLD_MODE_FIX` lượt). docs/11-nhom-cam.md § Đổi chế độ lần cầm
 */
export const holdToHandLed = (rt: SceneRuntime, raw: unknown, o: HoldModeOptions) =>
  convert(rt, raw, o, "hand");
