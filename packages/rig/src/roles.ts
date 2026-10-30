import * as THREE from 'three';
import type { M3, Place3, V3 } from './core/lens';
import {
  composePlace, parseRoles, placeOfLinear, placeProblem, placeRoles, rectCorners, resolveRoles, roleIssueLines,
  type PlacedRole, type Role, type RoleInput,
} from './core/roles';
import { faded, type Touch } from './collide';
import { addItem, bar, Batch, U, type Item, type ItemRoles, type Part, type Tone } from './khoi';
import type { RoomOptions } from './room';
import { plainRoom, type Set3D, type WorldSpec } from './world';

// Vai trò của đồ của cảnh trên cảnh three (docs/13-vai-tro-do.md mục 5.2, 9.2): đọc ra thế giới rig (`rolesOf`), khai trên
// nút three (`withRoles`), dựng đồ thử chỉ từ mục vai trò (`propOf`, `propWorld`).

/** Vai trò của một vật trên cảnh three ở giây đang dựng */
export interface PropRoles {
  /** Nút mang vai trò: nhóm `Batch` của `Item`, hay nút của `withRoles` */
  node: THREE.Object3D;
  /** Số thứ tự `Item` trong `Batch` của `node`; nút `withRoles` không có */
  owner?: number;
  /** `Item.name`, không thì `name` của nút gần nhất có tên */
  name: string;
  /** Khung vật → thế giới rig; không có khi phép đặt ngoài giới hạn */
  place?: Place3;
  /** Mục đã qua zod, khung vật; rỗng khi có lỗi */
  local: Role[];
  /** Mục trong thế giới rig, mặc định đã điền, cùng thứ tự `local` */
  roles: PlacedRole[];
  /** Dòng lỗi zod (`roles[i]…: …`) hay phép đặt ngoài giới hạn */
  errors: string[];
}

/** Hệ rig ↔ three: đảo y, z, chia 100 (`toThree`) */
const FLIP = [1, -1, -1];

/** Phép biến đổi thế giới của nút, viết trong hệ rig: khung local rig của nút → thế giới rig */
function nodePlace(o: THREE.Object3D): { place: Place3 } | { error: string } {
  const e = o.matrixWorld.elements;
  const L = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => e[j * 4 + i] * FLIP[i] * FLIP[j])) as M3;
  const t: V3 = [e[12] / U, -e[13] / U, -e[14] / U];
  return placeOfLinear(L, t);
}

/** Tên của vật: tên nút gần nhất từ `o` lên gốc */
function nameUp(o: THREE.Object3D | null) {
  for (; o; o = o.parent) if (o.name) return o.name;
  return 'vat';
}

function read(node: THREE.Object3D, base: { place: Place3 } | { error: string }, inner: Place3 | undefined, raw: unknown, name: string, owner?: number): PropRoles {
  const out: PropRoles = { node, ...(owner !== undefined && { owner }), name, local: [], roles: [], errors: [] };
  const parsed = parseRoles(raw);
  if (!parsed.success) {
    out.errors = roleIssueLines(parsed.error);
    return out;
  }
  if ('error' in base) {
    out.errors = [base.error];
    return out;
  }
  const place = inner ? composePlace(base.place, inner) : base.place;
  const bad = placeProblem(place);
  if (bad) {
    out.errors = [bad];
    return out;
  }
  out.place = place;
  out.local = parsed.data;
  out.roles = placeRoles(resolveRoles(parsed.data), place);
  return out;
}

/**
 * Vai trò của mọi vật dưới `root` ở giây đang dựng (đã `pose(t)`), thế giới rig: mỗi `Item` có `roles` của nhóm `Batch`
 * (`userData.itemRoles`) và mỗi nút `withRoles` (`userData.roles`) là một bản ghi có chủ. Đi cây như `colliders`: bỏ nhánh
 * ẩn (xét cả cha) và nhóm đã mờ. Phép đặt nghiêng, cỡ không đều, lật là lỗi của vật ấy, không đọc vai trò của nó
 */
export function rolesOf(root: THREE.Object3D): PropRoles[] {
  root.updateWorldMatrix(true, true);
  for (let o = root.parent; o; o = o.parent) if (!o.visible) return [];
  const out: PropRoles[] = [];
  const walk = (o: THREE.Object3D) => {
    if (!o.visible) return;
    const items = o.userData.itemRoles as ItemRoles[] | undefined;
    const raw = o.userData.roles as unknown;
    if ((items?.length || raw !== undefined) && !faded(o)) {
      const base = nodePlace(o);
      for (const r of items ?? []) out.push(read(o, base, r.place, r.roles, r.name ?? nameUp(o), r.owner));
      if (raw !== undefined) out.push(read(o, base, undefined, raw, nameUp(o)));
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  return out;
}

/** Khai vai trò cho nút three không qua `addItem` (lưới dựng tay, mô hình nạp vào): `roles` trong khung local của nút */
export function withRoles<T extends THREE.Object3D>(obj: T, roles: RoleInput[]): T {
  obj.userData.roles = structuredClone(roles);
  return obj;
}

// ——— đồ thử dựng từ mục vai trò (docs/13 mục 9.2)

/** Tông đồ thử như ghế chuẩn của `solo3d` (`soloChair` của fx), bàn gỗ, chén sứ */
const CHAIR: Tone = { top: '#d6cdbb', lit: '#e4dccc', side: '#b9ae99' };
const DESK: Tone = { top: '#b89a7a', lit: '#c6a988', side: '#9c8064' };
const CUP: Tone = { top: '#8a6f5c', lit: '#efe8dc', side: '#cfc6b6' };

/** Hình phụ của đồ thử, rig ở `h = 1`: dày tấm, nửa cạnh trụ, trụ lùi vào trong mép */
const PROP = { slab: 6, foot: 4, post: 2.5, leg: 3, inset: 4, legInset: 6, bar: 40, cup: 1.2 } as const;

type P2 = [number, number];
const v3 = (p: P2, y: number): V3 => [p[0], y, p[1]];
const unit2 = (a: P2): P2 => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };

/** Tấm ngang theo vòng bốn đỉnh `[x, z]`: mặt trên `y`, dày `t` xuống dưới (y xuống) */
const plate = (q: P2[], y: number, t: number, tone: Tone): Part => ({ v: [...q.map((p) => v3(p, y)), ...q.map((p) => v3(p, y + t))], tone });

/** Tấm ngang của đa giác lồi: một khối bốn đỉnh, hay quạt các khối bốn đỉnh (đỉnh cuối lặp thành tam giác) */
function polyPlates(poly: P2[], y: number, t: number, tone: Tone): Part[] {
  if (poly.length <= 4) return [plate(poly.length === 4 ? poly : [...poly, poly[2]], y, t, tone)];
  const out: Part[] = [];
  for (let i = 1; i + 1 < poly.length; i += 2) out.push(plate([poly[0], poly[i], poly[i + 1], poly[Math.min(i + 2, poly.length - 1)]], y, t, tone));
  return out;
}

/** Đỉnh `i` của đa giác lùi vào trong `d` theo hai cạnh kề */
function insetAt(poly: P2[], i: number, d: number): P2 {
  const n = poly.length, p = poly[i], a = poly[(i + n - 1) % n], b = poly[(i + 1) % n];
  const e1 = unit2([a[0] - p[0], a[1] - p[1]]), e2 = unit2([b[0] - p[0], b[1] - p[1]]);
  return [p[0] + (e1[0] + e2[0]) * d, p[1] + (e1[1] + e2[1]) * d];
}

const post = (p: P2, y0: number, y1: number, half: number, tone: Tone): Part => ({ v: bar(v3(p, y1), v3(p, y0), half), tone });

const SIT: Touch[] = ['thigh', 'torso'];
/** Bàn tay, cẳng tay tì lên mặt bàn, tay vịn: lún nhỏ không thấy trên hình thì được */
const REST: Touch[] = [{ part: 'hand', max: 4 }, { part: 'foreArm', max: 7 }];

/**
 * Đồ thử `name` ở chỗ `place` dựng chỉ từ mục vai trò `roles` (khung `Item`: y xuống, +x hướng mặt): hình chính theo vai
 * trò, hình phụ là hằng `PROP` nhân `h` (`rig.height`); chân, trụ xuống sàn `floor` (y thế giới rig). Mục hỏng zod thì ném
 * lỗi. docs/13-vai-tro-do.md mục 9.2
 */
export function propOf(name: string, place: Place3, roles: RoleInput[], { floor = 0, h = 1 }: { floor?: number; h?: number } = {}): Item {
  const parsed = parseRoles(roles);
  if (!parsed.success) throw new Error(`đồ thử \`${name}\`: ${roleIssueLines(parsed.error).join('; ')}`);
  const bad = placeProblem(place);
  if (bad) throw new Error(`đồ thử \`${name}\`: ${bad}`);
  const ground = (floor - place.at[1]) / (place.s ?? 1);
  const all = resolveRoles(parsed.data);
  const seat = all.find((r): r is Extract<PlacedRole, { role: 'seat' | 'footrest' }> => r.role === 'seat');
  const parts: Part[] = [];
  const lathes: NonNullable<Item['lathes']> = [];
  const touch = new Set<Touch>();
  for (const r of all) {
    switch (r.role) {
      case 'seat': {
        const q = rectCorners(r), t = PROP.slab * h, y = r.at[1];
        parts.push(plate(q, y, t, CHAIR));
        for (let i = 0; i < 4; i++) parts.push(post(insetAt(q, i, PROP.inset * h), y + t, ground, PROP.post * h, CHAIR));
        SIT.forEach((x) => touch.add(x));
        break;
      }
      case 'backrest': {
        const F: P2 = [r.front[0], r.front[2]], S: P2 = [F[1], -F[0]], w = r.width / 2, t = PROP.slab * h;
        const at = (p: V3, s: number, back: number): V3 => [p[0] + S[0] * s - F[0] * back, p[1], p[2] + S[1] * s - F[1] * back];
        const face = (back: number) => [at(r.from, w, back), at(r.to, w, back), at(r.to, -w, back), at(r.from, -w, back)];
        parts.push({ v: [...face(0), ...face(t)], tone: CHAIR });
        const low = r.from[1] > r.to[1] ? r.from : r.to;
        const foot = seat ? seat.at[1] + PROP.slab * h : ground;
        for (const s of [1, -1]) {
          const p = at(low, s * (w - PROP.inset * h), t / 2);
          parts.push(post([p[0], p[2]], low[1], foot, PROP.post * h, CHAIR));
        }
        SIT.forEach((x) => touch.add(x));
        break;
      }
      case 'armrest': {
        const D = unit2([r.to[0] - r.from[0], r.to[2] - r.from[2]]), S: P2 = [D[1], -D[0]], w = r.width / 2, t = PROP.slab * h;
        const q = (p: V3, s: number): V3 => [p[0] + S[0] * s, p[1], p[2] + S[1] * s];
        const top = [q(r.from, w), q(r.to, w), q(r.to, -w), q(r.from, -w)];
        parts.push({ v: [...top, ...top.map((p): V3 => [p[0], p[1] + t, p[2]])], tone: CHAIR });
        parts.push(post([r.to[0] - D[0] * w, r.to[2] - D[1] * w], r.to[1], ground, PROP.post * h, CHAIR));
        [...SIT, ...REST].forEach((x) => touch.add(x));
        break;
      }
      case 'tabletop': {
        parts.push(...polyPlates(r.poly, r.y, r.thick, DESK));
        const n = r.poly.length, picks = n <= 4 ? [...Array(n).keys()] : [0, 1, 2, 3].map((k) => Math.round((k * n) / 4) % n);
        for (const i of picks) parts.push(post(insetAt(r.poly, i, PROP.legInset * h), r.y + r.thick, ground, PROP.leg * h, DESK));
        REST.forEach((x) => touch.add(x));
        break;
      }
      case 'footrest': {
        const q = rectCorners(r), t = PROP.foot * h, y = r.at[1];
        parts.push(plate(q, y, t, CHAIR));
        if (r.size[0] < PROP.bar * h) {
          const S: P2 = [r.front[2], -r.front[0]], w = r.size[1] / 2 - PROP.inset * h;
          for (const s of [1, -1]) parts.push(post([r.at[0] + S[0] * s * w, r.at[2] + S[1] * s * w], y + t, ground, PROP.post * h, CHAIR));
        }
        touch.add('foot');
        break;
      }
      case 'vessel': {
        // trục lathe (lên, −y) nghiêng `tilt` quanh z rồi quay `yaw` thành `dir`: (sin t · cos φ, −cos t, −sin t · sin φ)
        const { at, r: rad, dir: d } = r.mouth;
        const tilt = Math.acos(Math.max(-1, Math.min(1, -d[1]))), yaw = Math.hypot(d[0], d[2]) > 1e-9 ? Math.atan2(-d[2], d[0]) : 0;
        lathes.push({ spec: { rings: [[PROP.cup * rad, rad], [0, rad]], tone: CUP, tilt }, at: composePlace(place, { at: [...at], yaw }) });
        break;
      }
    }
  }
  return {
    name, at: { ...place, at: [...place.at] as V3 },
    ...(parts.length && { parts }), ...(lathes.length && { lathes }),
    ...(touch.size && { touch: [...touch] }),
    roles: structuredClone(roles),
  };
}

/** Một đồ thử của sân khấu: tên, chỗ đặt, mục vai trò (docs/13 mục 9.1) */
export interface Prop { name: string; place: Place3; roles: RoleInput[] }

/** Phòng đủ rộng cho mắt xem thử (cách người ~1000) đứng trong phòng ở mọi góc máy, cửa sổ giữa tường sau */
export const PROP_ROOM: Partial<RoomOptions> = {
  x: [-1300, 1300],
  z: [-1300, 1300],
  windows: [{ wall: 'back', u: 1300, width: 640, height: 300, sill: 260, sun: true }],
};

/** Bối cảnh `plainRoom` rộng (`PROP_ROOM`) cộng một nhóm `Batch` của các `Item` */
export function propSet(items: readonly Item[]): Set3D {
  const set = plainRoom({ shell: PROP_ROOM });
  if (items.length) {
    const batch = new Batch();
    for (const it of items) addItem(batch, it);
    set.group.add(batch.build());
  }
  return set;
}

/** `WorldSpec` của sân khấu thử: `propSet` của `propOf` từng đồ; người không đóng băng (`still: []`) */
export function propWorld(props: readonly Prop[], opts: { floor?: number; h?: number } = {}): WorldSpec {
  return { set: () => propSet(props.map((p) => propOf(p.name, p.place, p.roles, opts))), still: [] };
}
