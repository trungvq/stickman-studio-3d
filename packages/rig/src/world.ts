import * as THREE from 'three';
import { act } from './act';
import { PAPER } from './core/constants';
import type { Body3 } from './core/figure3d';
import { cameraAt, castCharacter, sceneAt, type CastMember, type SceneData, type SceneRuntime } from './core/scene';
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
import { characterOptions, fromCharacter, wardrobe, type CharacterJson, type Figure } from './stickman';

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
const fromThree = (p: THREE.Vector3): Vec3 => [p.x / U, -p.y / U, -p.z / U];

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
  };
  const x = extra?.(rt.marks, cast3);
  if (x) s.group.add(x.group);
  return {
    root, set: s, extra: x, cast: cast3,
    ready: Promise.resolve(x?.ready),
    pose(t) {
      for (const a of actors) {
        const ac = acting(a.id, t);
        const { fig, fresh } = a.w.get(ac.equip, !!ac.world?.seated);
        if (fresh) root.add(fig.root);
        for (const f of a.w.figures.values()) f.root.visible = f === fig && ac.opacity > 0.5;
        act(fig, ac, t);
        current.set(a.id, fig);
      }
      s.update?.(t);
      x?.update?.(t);
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
