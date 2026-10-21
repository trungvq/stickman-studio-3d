import * as THREE from 'three';
import { act } from './act';
import { carry as carryOn, fitHolding, grip as gripPose, hold, type Held, type Holding } from './attach';
import { holdRoles, leadGrip } from './core/act3';
import type { GraspHand, GripFrame, HeldItemSpec, HoldAim, ReachHold } from './core/heldItem';
import type { GraspFrame } from './core/graspSolve';
import type { FingerRoles } from './core/heldFit';
import { handDims } from './core/heldGeom';
import { carrySpecOf } from './core/heldCarry';
import { isCarryHold } from './core/holdLink';
import type { HandPose } from './core/hand';
import type { HeldIntent } from './core/heldAudit';
import { PAPER } from './core/constants';
import type { Body3 } from './core/figure3d';
import { cameraAt, castCharacter, itemAt, itemReleased, sceneAt, type CastMember, type SceneData, type ScenePose, type SceneRuntime } from './core/scene';
import { equipCharacter, type CharacterData } from './core/schema';
import { seatCrowd } from './crowd';
import { loadFonts } from './decal';
import { U, type Vec3 } from './khoi';
import type { Lens } from './lens';
import { setLights, setPalette } from './lighting';
import type { Lamp, LightRig, PaletteName } from './npr';
import type { AaMode, Grade } from './pipeline';
import { room, type Room, type RoomOptions } from './room';
import { landmark, type Landmark } from './screen';
import { createStage, type FrameView, type Stage } from './stage';
import { characterOptions, fromCharacter, wardrobe, type CharacterJson, type Figure, type Side } from './stickman';

// Cảnh three của một scene 3D — docs/03-scene.md#cảnh-3d. Sân khấu Remotion (`buildStage`) và `worldOf` của `stickman check`
// (Node, không WebGL) dựng cùng một bản bằng `buildWorld`.

/** Đèn riêng của một cảnh thêm vào bộ đèn của bối cảnh: đèn cục bộ nối thêm, độ sáng đèn trần 0–1, `sun: false` tắt nắng qua cửa */
export interface LightAdd { lamps?: Lamp[]; ceiling?: number; sun?: boolean }

/** Bối cảnh 3D: vỏ phòng, đồ đạc, bộ đèn và giờ trong ngày */
export interface Set3D {
  /** Vỏ phòng, đồ đạc; người nền và đồ riêng của cảnh thêm vào đây */
  group: THREE.Group;
  /** Vỏ phòng: `cull(camera)` giấu tường camera đứng ngoài, mỗi khung */
  room: Room;
  palette: PaletteName;
  /** Bộ đèn ở giây `t`; `add` là đèn riêng của cảnh (`Extra3D.light`) */
  lights(t: number, add?: LightAdd): LightRig;
  /** Đặt các món chạy theo `t` (cửa, kim đồng hồ, texture chữ) */
  update?(t: number): void;
  /** Phông chữ decal nạp xong trước khung đầu: `specs` như `ctx.font`, `text` mọi chữ sẽ vẽ */
  fonts?: { specs: string[]; text: string };
  /** Màu ngoài vỏ phòng (camera trên đỉnh tường); mặc định `PAPER` */
  background?: string;
}

/** Đồ riêng của một cảnh: dựng một lần, `update(t)` đặt lại mỗi khung sau khi người đã đặt dáng */
export interface Extra3D {
  group: THREE.Object3D;
  update?(t: number): void;
  /** Sân khấu chờ xong mới vẽ khung đầu */
  ready?: Promise<unknown>;
  light?(t: number): LightAdd | undefined;
}

/** Người diễn ở khung đang vẽ, cho đồ riêng của cảnh bám theo. Toạ độ rig (y âm là lên). */
export interface Cast3D {
  scene: SceneData;
  /** Bản người đang hiện của `id` (đúng dáng đứng / ngồi, đúng bộ đồ) */
  fig(id: string): Figure | undefined;
  /** Mốc trên người `id`: cổ tay thật sau IK, không phải đích tay của scene */
  at(id: string, name: Landmark): Vec3 | null;
  /** Khớp tay bên `side` (`-1` phải người, `1` trái) của `id` */
  arm(id: string, side: -1 | 1, joint: 'shoulder' | 'elbow' | 'wrist'): Vec3 | null;
  /**
   * Đăng ký món cầm tay `item` (tên trong `held/`) với `object` dựng ở gốc khung món; `owner` là người mà món ấy là của
   * (hai người cùng có một loại món). Tới quãng `world.hands[].hold` của ai đó cầm món, rig gắn món vào tay người ấy; hết
   * quãng thì trả về chỗ cũ (cha và vị trí lúc đăng ký). Gọi trong `extra`. Món đang trong tay thì `extra` đừng đặt nó
   */
  provide(item: string, object: THREE.Object3D, owner?: string): void;
  /** Ai đang mang món `item` (của `owner`) ở giây `t`: người, tay mang món; không ai thì `undefined` */
  holder(item: string, t: number, owner?: string): { id: string; side: Side } | undefined;
  /**
   * Lần thả gần nhất (không sau `t`) của món `item` (của `owner`): người, tay, giây thả, và chỗ món lúc thả — ma trận thế
   * giới three (đã nhân cỡ người) — để `extra` đặt món đúng chỗ ấy sau khi thả. Chưa thả lần nào thì `undefined`
   */
  released(item: string, t: number, owner?: string): Released | undefined;
  /** Các món đã đăng ký qua `provide`: `check` đo món nhảy và cảnh khai `hold` món không ai đăng ký */
  provided(): readonly { item: string; object: THREE.Object3D; owner?: string }[];
}

/** Lần thả một món: ai, tay nào, giây nào, món ở đâu (ma trận thế giới three) */
export interface Released {
  id: string;
  side: Side;
  t: number;
  matrix: THREE.Matrix4;
}

/** Cách dựng một cảnh 3D mà repo video khai theo tên cảnh */
export interface WorldSpec {
  /** Dựng bối cảnh; gọi một lần mỗi lần dựng cảnh */
  set: () => Set3D;
  /** Người đóng băng ở dáng giây 0 thành người nền; bỏ trống là mọi người ngồi (`world.sit`) */
  still?: readonly string[];
  /** Đồ riêng của cảnh: nhận mốc của scene và người diễn */
  extra?: (marks: Record<string, number>, cast: Cast3D) => Extra3D;
  /** Đồ three gắn lên người diễn: gọi một lần cho mỗi bản người vừa dựng (mỗi dáng, mỗi bộ đồ) */
  wear?: (id: string, fig: Figure) => void;
  /** Ống kính ở giây `t`, đè `scene.lens` */
  lens?: (t: number) => Lens | undefined;
  /** Hậu kỳ toàn khung ở giây `t` */
  grade?: (t: number) => Grade | undefined;
}

/** Dữ liệu đã nạp: JSON nhân vật theo tên file (giữ đuôi `.json`), `rig.height` và `body3` theo `id` của `cast` */
export interface WorldData {
  characters: Record<string, CharacterData>;
  heights: Record<string, number>;
  bodies: Record<string, Body3>;
}

/** `ctx` mà `stickman check` đưa cho `worldOf` — docs/10-lop-ve-code.md#đo-trên-cảnh-three */
export interface WorldCtx extends WorldData { id: string; scene: SceneData; runtime: SceneRuntime }

export interface World3D {
  /** Bối cảnh và người diễn; bản người dựng giữa chừng tự thêm vào đây */
  root: THREE.Group;
  set: Set3D;
  extra?: Extra3D;
  cast: Cast3D;
  /** Đồ riêng đã sẵn (`Extra3D.ready`) */
  ready: Promise<unknown>;
  /** Đặt cả cảnh ở giây `t`; trả người đang hiện theo `id` của `cast` */
  pose(t: number): Record<string, Figure>;
  lights(t: number): LightRig;
  /** Khung cắt, ống kính và hậu kỳ cho `stage.draw(t, view)` */
  view(t: number): FrameView;
}

const v3 = new THREE.Vector3();

/** Món đã đăng ký: chỗ cũ (cha và vị trí lúc đăng ký) và lần gắn đang giữ */
interface Provided {
  item: string;
  object: THREE.Object3D;
  owner?: string;
  home: { parent?: THREE.Object3D | null; position: THREE.Vector3; quaternion: THREE.Quaternion };
  on?: { fig: Figure; side: Side; grip: string; carry?: string; held: Held; support?: { side: Side; entry?: Holding } };
}

/** Món một người phải mang ở khung này: tay mang, chỗ cầm, tay phụ, các số hạng ý định của lần cầm */
interface Want {
  id: string;
  fig: Figure;
  side: Side;
  item: string;
  grip: string;
  spec: HeldItemSpec;
  hold: ReachHold;
  hand?: GraspHand;
  /** Tay kia trên cùng món: tay phụ, hay tay thứ hai của món đặt trước; `v`, `roles` của chỗ cầm nhóm */
  support?: { side: Side; pose: HandPose; grip: string; hand: GraspHand; v?: readonly number[]; roles?: FingerRoles; curl?: number };
  aim: { k: number; hold?: HoldAim }[];
  /** Treo: món treo trên cánh tay `side`, không trong bàn tay — khoá chỗ treo (`on`, `at`, `yaw`, `touch` của `carrySpecOf`) */
  carry?: string;
}

/** Ý định đang nhắm ra `userData.hold` cho `check`: trục lên, hay mặt về ống kính / mặt người cầm */
function heldIntentOf(a: HoldAim): HeldIntent | undefined {
  const f = a.face;
  if (!f) return undefined;
  const t = f.target;
  if ('name' in t) return { face: [...f.axis] as [number, number, number], faceToward: t.name };
  if ('v' in t && t.v[0] === 0 && t.v[1] === -1 && t.v[2] === 0 && !f.tilt) return { up: [...f.axis] as [number, number, number] };
  return undefined;
}
const fromThree = (p: THREE.Vector3): Vec3 => [p.x / U, -p.y / U, -p.z / U];
/** Liên kết của lần cầm ra ma trận three */
const m4 = (G: GripFrame) => new THREE.Matrix4().set(G.R[0], G.R[1], G.R[2], G.p[0], G.R[3], G.R[4], G.R[5], G.p[1], G.R[6], G.R[7], G.R[8], G.p[2], 0, 0, 0, 1);

/**
 * Cảnh three của `scene`: người diễn đặt dáng theo `sceneAt` mỗi `pose(t)`, mặc đồ theo `equip` qua `wardrobe`, `cast[].fade`
 * mờ quá nửa là tắt; người nền đóng băng ở dáng giây 0 thành một nhóm. `s` là bối cảnh đã dựng (nạp phông giữa `set()` và đồ
 * riêng); bỏ trống thì dựng ở đây.
 */
export function buildWorld(scene: SceneData, rt: SceneRuntime, spec: WorldSpec, data: WorldData, s: Set3D = spec.set()): World3D {
  const { still, extra, wear } = spec, { characters, heights, bodies } = data;
  const acting = (id: string, t: number) => sceneAt(rt, id, t, heights[id], bodies[id]);
  const base = (c: CastMember) => castCharacter(c, characters[c.character!]);
  const cast = rt.cast.filter((c) => c.world && c.character && characters[c.character]);
  // mốc món `rest` không khai chỗ dựng bàn tay người thả từ nhân vật thật của người ấy
  rt.chars = { ...Object.fromEntries(cast.map((c) => [c.id, base(c)])), ...rt.chars };
  const frozen = (c: CastMember) => (still ? still.includes(c.id) : !!c.world?.sit);
  const seats = cast.filter(frozen).map((c) => ({ c, ac: acting(c.id, 0) }));
  s.group.add(seatCrowd(
    seats.map(({ c, ac }) => ({ at: c.world!.at as Vec3, yaw: c.world!.yaw ?? 0, acting: ac })),
    (i) => characterOptions(equipCharacter(base(seats[i].c), seats[i].ac.equip) as unknown as CharacterJson),
  ));
  const root = new THREE.Group();
  root.add(s.group);
  // váy dựng theo dáng lúc tạo hình (ngồi thì vạt phủ đùi): dựng sẵn bản mở màn cho mỗi dáng có trong `path`
  const actors = cast.filter((c) => !frozen(c)).map((c, i) => {
    const w = wardrobe(base(c), (worn, seated) => {
      const f = fromCharacter(worn as unknown as CharacterJson, { seated, seed: i + 1 });
      wear?.(c.id, f);
      return f;
    });
    const keys = c.world!.path ?? [], equip = acting(c.id, 0).equip;
    if (!c.world!.sit && (!c.world!.path || keys.some((k) => !k.sit))) root.add(w.get(equip, false).fig.root);
    if (c.world!.sit || keys.some((k) => k.sit)) root.add(w.get(equip, true).fig.root);
    return { id: c.id, w };
  });
  const current = new Map<string, Figure>();
  const posed = (id: string) => {
    const f = current.get(id);
    f?.root.updateMatrixWorld(true);
    return f;
  };
  const cast3: Cast3D = {
    scene,
    fig: (id) => current.get(id),
    at: (id, name) => { const f = posed(id); return f ? fromThree(landmark(f, name, undefined, v3)) : null; },
    arm: (id, side, joint) => { const f = posed(id); return f ? fromThree(f.arms[side][joint].getWorldPosition(v3)) : null; },
    provide: () => undefined,
    holder: () => undefined,
    released: () => undefined,
    provided: () => [],
  };
  // món cầm tay đăng ký qua `provide`: rig gắn theo `world.hands[].hold` sau khi người và đồ riêng đã đặt
  const provided: Provided[] = [];
  const entry = (item: string, owner?: string) => provided.find((p) => p.item === item && p.owner === owner);
  const pick = (item: string, who: string) => entry(item, who) ?? entry(item);
  const seeing = (ac: ScenePose, t: number): ScenePose => {
    const L = spec.lens?.(t);
    return L && ac.world ? { ...ac, world: { ...ac.world, eye: [...L.eye] as [number, number, number] } } : ac;
  };
  /** Lần treo (`món@carry`) của tay `side` ở dáng `ac` */
  const hung = (ac: ScenePose, side: Side) => {
    const W = ac.world;
    const h = W && (side === (W.flip ? 1 : -1) ? W.hands?.near : W.hands?.far)?.hold;
    return h && isCarryHold(h) ? h : undefined;
  };
  /** Người, tay mang món `p` ở giây `t` (thuần: chỉ đọc scene); cầm trong bàn tay trước, treo trên cánh tay sau */
  const carrying = (p: Provided | undefined, t: number) => {
    if (!p) return undefined;
    const acts = cast.map((c) => ({ c, ac: acting(c.id, t) }));
    for (const { c, ac } of acts) {
      const roles = ac.world?.hands ? holdRoles(ac.world.hands, ac.world.flip ? 1 : -1) : {};
      for (const side of [-1, 1] as Side[]) {
        const r = roles[side];
        if (r?.role === 'lead' && pick(r.hold.item, c.id) === p) return { id: c.id, side, ac, carry: false };
      }
    }
    for (const { c, ac } of acts)
      for (const side of [-1, 1] as Side[]) {
        const h = hung(ac, side);
        if (h && pick(h.item, c.id) === p) return { id: c.id, side, ac, carry: true };
      }
    return undefined;
  };
  cast3.provide = (item, object, owner) => {
    if (entry(item, owner)) throw new Error(`\`provide\`: món \`${item}\`${owner ? ` của \`${owner}\`` : ''} đã đăng ký`);
    provided.push({ item, object, owner, home: { position: object.position.clone(), quaternion: object.quaternion.clone(), ...(object.parent && { parent: object.parent }) } });
  };
  cast3.provided = () => provided.map((p) => ({ item: p.item, object: p.object, ...(p.owner !== undefined && { owner: p.owner }) }));
  cast3.holder = (item, t, owner) => {
    const h = carrying(entry(item, owner), t);
    return h && { id: h.id, side: h.side };
  };
  // lần thả và chỗ món lúc ấy: cùng nguồn với mốc món `rest` không khai chỗ (`itemReleased` của lõi)
  cast3.released = (item, t, owner) => {
    const p = entry(item, owner);
    if (!p) return undefined;
    const r = itemReleased(rt, item, t, { who: (id) => pick(item, id) === p, pose: (id, at) => seeing(acting(id, at), at) });
    if (!r) return undefined;
    const R = r.pose.R;
    const m = new THREE.Matrix4().set(R[0], R[1], R[2], 0, -R[3], -R[4], -R[5], 0, -R[6], -R[7], -R[8], 0, 0, 0, 0, 1);
    m.scale(new THREE.Vector3().copy(p.object.scale).multiplyScalar(r.pose.s));
    m.setPosition(r.pose.P[0] * U, -r.pose.P[1] * U, -r.pose.P[2] * U);
    return { id: r.id, side: r.side === 'right' ? -1 : 1, t: r.t, matrix: m };
  };
  /**
   * Món đặt trước: lần cầm mang khung cầm đã giải trên người `fig` (`ReachHold.solve`), như bàn tay `act` đặt; lần cầm cũ
   * theo món còn hoà (`from`) mang khung của nghiệm cũ (`was`)
   */
  const placed = (fig: Figure, h: ReachHold | undefined) => {
    if (!h) return h;
    const fg = h.from?.grasp;
    if (h.was && fg?.mode === 'item' && !fg.frame) {
      const old = h.was.solve(fig.body);
      if (old && 'G' in old.frame) h = { ...h, from: { ...h.from!, grasp: { ...fg, frame: old.frame as GraspFrame } } };
    }
    if (h.grasp?.mode !== 'item' || h.grasp.frame || !h.solve) return h;
    const sol = h.solve(fig.body);
    return sol ? { ...h, grasp: { ...h.grasp, frame: sol.frame } } : h;
  };
  /** Gắn, gỡ món theo lần cầm của mọi người diễn ở khung đang đặt; món trong tay ngồi đúng gốc khung món */
  const carry = (acts: Map<string, ScenePose>, t: number) => {
    const want = new Map<Provided, Want>();
    for (const [id, ac] of acts) {
      const fig = current.get(id);
      const raw = ac.world?.hands;
      if (!fig || !raw) continue;
      const near: Side = ac.world!.flip ? 1 : -1;
      const hands = { ...raw };
      for (const k of ['near', 'far'] as const) if (raw[k]?.hold) hands[k] = { ...raw[k]!, hold: placed(fig, raw[k]!.hold) };
      const H = fig.hands?.[-1];
      const roles = holdRoles(hands, near, handDims(H?.scale ?? 1, H?.long ?? H?.scale ?? 1));
      for (const side of [-1, 1] as Side[]) {
        const r = roles[side];
        const p = r?.role === 'lead' ? pick(r.hold.item, id) : undefined;
        // món đặt trước trong hai tay: tay phải mang, tay trái là tay thứ hai trên món
        if (!r || !p || want.get(p)?.fig === fig) continue;
        const sup = roles[-side as Side];
        const two = sup && (sup.role === 'support' || (sup.hold.grasp?.mode === 'item' && r.hold.grasp?.mode === 'item' && sup.hold.item === r.hold.item)) ? sup : undefined;
        want.set(p, {
          id, fig, side, item: r.hold.item, grip: r.hold.grip, spec: r.hold.spec, hold: r.hold, hand: r.hand,
          ...(two && { support: { side: -side as Side, pose: two.hand.pose, grip: two.hold.grip, hand: two.hand, ...(two.hold.grasp && { v: two.pose, roles: two.roles, ...(two.curl !== undefined && { curl: two.curl }) }) } }),
          aim: (side === near ? hands.near : hands.far)?.aim?.terms.filter((a) => a.hold?.item === r.hold.item && (a.hold.grip === r.hold.grip || a.hold.grip === r.hold.from?.grip)) ?? [],
        });
      }
      // món treo: món chưa ai cầm trong bàn tay thì treo trên cánh tay khai nó
      for (const side of [-1, 1] as Side[]) {
        const h = hung(ac, side);
        const p = h && pick(h.item, id);
        if (!h || !p || want.has(p)) continue;
        want.set(p, { id, fig, side, item: h.item, grip: h.grip, spec: h.spec, hold: h, aim: [], carry: JSON.stringify(carrySpecOf(h.spec, h)) });
      }
    }
    for (const p of provided) {
      if (p.home.parent === undefined && !p.on) p.home.parent = p.object.parent;
      const w = want.get(p), on = p.on;
      if (on && !(w && on.fig === w.fig && on.side === w.side && on.grip === w.grip && on.carry === w.carry && on.support?.side === w.support?.side)) letGo(p);
      if (w && !p.on) take(p, w);
      if (!p.on || !w) continue;
      if (w.carry) {
        delete p.object.userData.hold;
        continue;
      }
      regrip(p, w, t);
      p.on.held.retouch?.(w.hold);
      const main = w.aim.reduce<{ k: number; hold?: HoldAim } | undefined>((a, t) => (!a || t.k > a.k ? t : a), undefined)?.hold;
      const intent = main && heldIntentOf(main);
      if (intent) p.object.userData.hold = intent;
      else delete p.object.userData.hold;
    }
  };
  /**
   * Món trong khung mang dựng lúc gắn (`Held.link`): liên kết của khung này lệch khỏi nó (đang hoà từ kiểu cũ `hold.from`,
   * trường số của chỗ cầm nhóm trượt) thì đặt lệch đúng phần ấy. Món đặt trước ngồi ở `itemAt` của cảnh, không theo bàn tay;
   * lần cầm theo mốc (`grasp.keyed`) thì món theo bàn tay đã vẽ, như tay dẫn — trừ lúc tay tới hay rời món nằm ở mốc `rest`
   * (`grasp.rest`): món đứng ở mốc ấy
   */
  const regrip = (p: Provided, w: Want, t: number) => {
    const o = p.object;
    o.position.set(0, 0, 0);
    o.quaternion.identity();
    if (w.hold.grasp?.mode === 'item' && (!w.hold.grasp.keyed || w.hold.grasp.rest)) return putItem(p, w, t);
    const link = p.on?.held.link;
    if (!link || !w.hand || (!w.hold.from && !w.hold.grasp)) return;
    const h = w.fig.hands?.[w.side];
    const [k, long] = [h?.scale ?? 1, h?.long ?? h?.scale ?? 1];
    const own = (G: GripFrame, c: readonly number[]): GripFrame => (h ? G : { ...G, p: [G.p[0] - c[0], G.p[1] - c[1], G.p[2] - c[2]] });
    // khung đã giải của món đặt trước theo cỡ người `s` (như `act`): đưa về cỡ 1, cỡ người đã ở `fig.root`
    const s = w.fig.root.scale.x;
    const b = leadGrip(w.hold, w.side, k * s, long * s, s);
    const G1: GripFrame = { R: b.G.R, p: [b.G.p[0] / s, b.G.p[1] / s, b.G.p[2] / s], u: b.G.u / s };
    const c1 = [b.center[0] / s, b.center[1] / s, b.center[2] / s];
    m4(own(link.G, link.center)).invert().multiply(m4(own(G1, c1))).decompose(o.position, o.quaternion, v3);
  };
  const _M = new THREE.Matrix4(), _R = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _P = new THREE.Vector3(), _S = new THREE.Vector3();
  /** Món đặt trước ở `itemAt` của cảnh (thế giới rig → `root`), cỡ theo người cầm; món nằm chờ tay ở mốc `rest` của nghiệm */
  const putItem = (p: Provided, w: Want, t: number) => {
    const ip = w.hold.grasp?.rest ? w.hold.solve?.(w.fig.body)?.still : itemAt(rt, w.hold.item, t, { chars: { [w.id]: w.fig.body } });
    const parent = p.object.parent;
    if (!ip || !parent) return;
    const R = ip.R;
    _R.set(R[0], R[1], R[2], 0, -R[3], -R[4], -R[5], 0, -R[6], -R[7], -R[8], 0, 0, 0, 0, 1);
    _M.compose(_P.set(ip.P[0] * U, -ip.P[1] * U, -ip.P[2] * U), _Q.setFromRotationMatrix(_R), _S.copy(p.object.scale).multiplyScalar(ip.s));
    parent.updateWorldMatrix(true, false);
    _R.copy(parent.matrixWorld).invert().multiply(root.matrixWorld).multiply(_M).decompose(p.object.position, p.object.quaternion, v3);
  };
  const take = (p: Provided, w: Want) => {
    p.object.position.set(0, 0, 0);
    p.object.quaternion.identity();
    const g = { item: w.item, spec: w.spec, grip: w.grip, hold: w.hold };
    const held = w.carry ? carryOn(w.fig, p.object, { hand: w.side, grip: g }) : hold(w.fig, p.object, { hand: w.side, grip: g });
    let entry: Holding | undefined;
    // đổi tay, món đặt trước trong hai tay: tay kia giữ dáng của nó trên món (cầm hai tay thì `hold` đã lo)
    const sup = w.support;
    if (sup && w.fig.holding?.[sup.side]?.object !== p.object) {
      gripPose(w.fig, sup.side, sup.pose, sup.v);
      entry = { object: p.object, item: w.item, grip: sup.grip, spec: w.spec, hand: sup.hand, pose: sup.pose, follow: 'wrist', both: true, ...(sup.roles && { roles: sup.roles }), ...(sup.curl !== undefined && { curl: sup.curl }) };
      (w.fig.holding ??= {})[sup.side] = entry;
    }
    p.on = { fig: w.fig, side: w.side, grip: w.grip, ...(w.carry && { carry: w.carry }), held, ...(w.support && { support: { side: w.support.side, entry } }) };
  };
  const letGo = (p: Provided) => {
    const on = p.on!;
    on.held.release();
    const sup = on.support;
    if (sup?.entry) {
      gripPose(on.fig, sup.side, undefined);
      if (on.fig.holding?.[sup.side] === sup.entry) delete on.fig.holding[sup.side];
    }
    p.on = undefined;
    const { parent, position, quaternion } = p.home;
    p.object.removeFromParent();
    p.object.position.copy(position);
    p.object.quaternion.copy(quaternion);
    parent?.add(p.object);
  };
  const x = extra?.(rt.marks, cast3);
  if (x) s.group.add(x.group);
  return {
    root, set: s, extra: x, cast: cast3,
    ready: Promise.resolve(x?.ready),
    pose(t) {
      const acts = new Map<string, ScenePose>();
      for (const a of actors) {
        const ac = seeing(acting(a.id, t), t);
        acts.set(a.id, ac);
        const { fig, fresh } = a.w.get(ac.equip, !!ac.world?.seated);
        if (fresh) root.add(fig.root);
        for (const f of a.w.figures.values()) f.root.visible = f === fig && ac.opacity > 0.5;
        act(fig, ac, t);
        current.set(a.id, fig);
      }
      s.update?.(t);
      x?.update?.(t);
      if (provided.length) {
        carry(acts, t);
        for (const f of current.values()) fitHolding(f);
      }
      return Object.fromEntries(current);
    },
    lights: (t) => s.lights(t, x?.light?.(t)),
    view: (t) => ({ crop: cameraAt(rt, t), lens: spec.lens?.(t) ?? scene.lens, ...(spec.grade && { render: { t, grade: spec.grade(t) } }) }),
  };
}

/**
 * Sân khấu WebGL của `scene` (`buildWorld` cộng `createStage`): trả khi phông decal và đồ riêng đã sẵn, chưa vẽ khung nào.
 * Mỗi khung `stage.draw(t, world.view(t))`. Chromium vẽ phần mềm (SwiftShader) thì ném, trừ khi `software`.
 */
export async function buildStage(
  scene: SceneData, rt: SceneRuntime, spec: WorldSpec, data: WorldData,
  o: { size: { w: number; h: number }; aa?: AaMode; software?: boolean },
): Promise<{ stage: Stage; world: World3D }> {
  const s = spec.set();
  const missing = await loadFonts(s.fonts?.specs ?? [], s.fonts?.text);
  if (missing.length) throw new Error(`thiếu phông: ${missing}`);
  const world = buildWorld(scene, rt, spec, data, s);
  await world.ready;
  const stage = createStage({
    size: o.size, aa: o.aa ?? 'ss2', lens: scene.lens,
    light: () => setPalette(s.palette),
    update: (t, st) => {
      world.pose(t);
      s.room.cull(st.camera);
      setLights(world.lights(t));
    },
  });
  if (!o.software && /SwiftShader/.test(stage.gpu)) {
    stage.dispose();
    throw new Error(`không có GPU: ${stage.gpu}`);
  }
  stage.scene.background = new THREE.Color(s.background ?? PAPER);
  stage.scene.add(world.root);
  return { stage, world };
}

/** Gộp đồ riêng: một nhóm, mỗi khung đặt lại từng món; chờ mọi `ready`; đèn cục bộ nối nhau, đèn trần nhân nhau */
export function combineExtras(...xs: Extra3D[]): Extra3D {
  const group = new THREE.Group();
  for (const x of xs) group.add(x.group);
  const wait = xs.filter((x) => x.ready), lit = xs.filter((x) => x.light);
  const merge = (a?: LightAdd, b?: LightAdd): LightAdd | undefined => !a ? b : !b ? a : {
    lamps: [...(a.lamps ?? []), ...(b.lamps ?? [])],
    ceiling: (a.ceiling ?? 1) * (b.ceiling ?? 1),
    sun: a.sun === false || b.sun === false ? false : undefined,
  };
  return {
    group,
    update: (t) => xs.forEach((x) => x.update?.(t)),
    ...(wait.length && { ready: Promise.all(wait.map((x) => x.ready)) }),
    ...(lit.length && { light: (t: number) => lit.reduce<LightAdd | undefined>((a, x) => merge(a, x.light!(t)), undefined) }),
  };
}

/** `LightAdd` thành tham số của `room().lights` */
export const roomLights = (add?: LightAdd): Parameters<Room['lights']>[0] =>
  add ? { lamps: add.lamps, ...(add.ceiling !== undefined && { ceiling: { intensity: add.ceiling } }), sun: add.sun } : {};

/**
 * Phòng trơn: sàn y 0, tường sau ở `z` xa, một dải cửa sổ đón nắng trên tường sau, đèn tấm trên trần. Mọi tham số của
 * `room()` đè qua `shell`; đồ đạc thì thêm vào `group` của kết quả.
 */
export function plainRoom({ time = 'day', shell = {} }: { time?: PaletteName; shell?: Partial<RoomOptions> } = {}): Set3D {
  const r = room({
    x: [-700, 700], z: [-300, 900], height: 780,
    windows: [{ wall: 'back', u: 700, width: 640, height: 300, sill: 260, sun: true }],
    panels: { grid: [3, 2] },
    ...shell,
  });
  const group = new THREE.Group();
  group.add(r.group);
  return { group, room: r, palette: time, lights: (_t, add) => r.lights(roomLights(add)) };
}
