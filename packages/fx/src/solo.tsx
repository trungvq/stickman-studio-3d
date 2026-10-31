import {
  body3,
  D,
  feet,
  parseScene,
  project,
  resolveScene,
  RIG,
  SCENE_VERSION,
  sceneAt,
  type ActionData,
  type CharacterData,
  type EquipStep,
  type FaceState,
  type Pose,
  type SceneRuntime,
  type V3,
  type World,
} from "@stickman3d/rig/core";
import { bar, box, type SolidItem } from "./solid";

/** Ống kính của `solo3d`: tiêu cự và tầm mắt như cảnh thử 3D, nhìn vào hông từ trước mặt */
export const SOLO_LENS = { f: 800, dist: 1100, target: [0, -110, 0] as V3 };
/** Đùi gập quá bấy nhiêu độ ở cả hai chân thì `solo3d` coi người đang ngồi */
export const SOLO_SIT_THIGH = 50;
const CHAIR_TONE = { top: "#d6cdbb", lit: "#e4dccc", side: "#b9ae99" };

/**
 * Ghế chuẩn dưới người ngồi của `solo3d`, toạ độ vật: gốc là điểm trên mặt ngồi dưới khớp hông, `+x`
 * hướng mặt. Mặt ngồi từ sau hông tới gần gối, tựa lưng sau hông, bốn chân xuống sàn (`y = drop`).
 */
export function soloChair(at: V3, yawDeg: number, drop: number, h: number): SolidItem {
  const back = -28 * h;
  const front = (RIG.thigh - 16) * h;
  const half = 26 * h;
  const t = 6 * h;
  const leg = 2.5 * h;
  const post = (x: number, z: number) => ({
    v: bar([x, drop, z], [x, t, z], leg),
    tone: CHAIR_TONE,
  });
  const ix = 4 * h;
  return {
    at: { at, yaw: yawDeg * D },
    parts: [
      { v: box(back, front, 0, t, -half, half), tone: CHAIR_TONE },
      { v: box(back - t, back, -80 * h, 0, -half, half), tone: CHAIR_TONE },
      post(back + ix, -half + ix),
      post(back + ix, half - ix),
      post(front - ix, -half + ix),
      post(front - ix, half - ix),
    ],
  };
}

/** Một khung của người 3D đứng một mình: tư thế như `sceneAt` trả, kèm chỗ đặt trên khung ống kính */
export interface Solo {
  pose: Pose;
  face: Pick<FaceState, "mouth" | "brow" | "eyes">;
  equip: EquipStep[];
  flip: boolean;
  world: World;
  /** Chỗ đặt người trên khung ống kính, như `sceneAt` trả */
  spot: { x: number; groundY: number; scale: number };
  /** Điểm sàn dưới hông trên khung ống kính */
  floor: [number, number];
  /** Ghế chuẩn khi người đang ngồi */
  furniture?: SolidItem[];
  /** `cast[].world` của cảnh tối thiểu dựng khung này (ngồi thì `sit` trên mặt ghế) */
  place: { at: V3; yaw: number; sit?: boolean; floor?: number };
}

export interface SoloSpec {
  character: CharacterData;
  /** Hướng mặt, độ quanh trục đứng: 0 = `+x` phải khung, 90 = `−z` về ống kính */
  yaw: number;
  /** Góc cúi ống kính, độ */
  pitch?: number;
  /** Mảng thì mỗi hành động một track, chồng lên nhau theo thứ tự như trong cảnh */
  action?: ActionData | ActionData[];
}

/** Giữ không quá bấy nhiêu cảnh ngồi đã giải: hành động gập chân dần thì mỗi khung một độ cao ghế */
const SEATS = 32;

/**
 * Người 3D một mình giữa sân khấu trống, dựng sẵn một lần cho mọi `time`: một cảnh tối thiểu
 * (`scene.lens` cúi `pitch` độ, `cast[].world` ở gốc quay `yaw`) rồi hỏi `sceneAt`, nên cờ nâng và
 * đích tay đi đúng đường của scene. Hai đùi gập quá `SOLO_SIT_THIGH` thì người ngồi
 * (`world.sit`) trên `soloChair` cao vừa để bàn chân chạm sàn. docs/04-mcp.md#người-3d
 */
export function soloStage({ character, yaw, pitch = 16, action }: SoloSpec) {
  const p = pitch * D;
  const { f, dist, target } = SOLO_LENS;
  const eye: V3 = [target[0], target[1] - dist * Math.sin(p), target[2] - dist * Math.cos(p)];
  const h = character.rig.height;
  const body = body3(character);
  const acts = action ? [action].flat() : [];
  const runtimes = new Map<string, SceneRuntime>();
  const runtime = (world: { at: V3; yaw: number; sit?: boolean; floor?: number }) => {
    const key = JSON.stringify(world);
    const hit = runtimes.get(key);
    if (hit) return hit;
    const scene = parseScene({
      schemaVersion: SCENE_VERSION,
      name: "solo3d",
      lens: { eye, yaw: 0, pitch, f },
      cast: [
        {
          id: "a",
          world,
          tracks: acts.map((a, i) => ({
            clips: [{ action: `a${i}`, start: 0, cycle: a.duration }],
          })),
        },
      ],
    });
    if (!scene.success) throw new Error(`solo3d: ${scene.error.message}`);
    const rt = resolveScene(
      scene.data,
      Object.fromEntries(acts.map((a, i) => [`a${i}`, a])),
      { a: h },
      { a: body },
    );
    if (runtimes.size > SEATS) runtimes.clear();
    runtimes.set(key, rt);
    return rt;
  };
  return (time: number): Solo => {
    let place: Solo["place"] = { at: [0, 0, 0], yaw };
    let s = sceneAt(runtime(place), "a", time, h, body);
    let furniture: SolidItem[] | undefined;
    if (acts.length && Math.min(s.pose.ll[0], s.pose.lr[0]) > SOLO_SIT_THIGH) {
      // Hông trên mặt ngồi cách đúng nửa nét chân; bàn chân thấp hơn chạm sàn
      const drop = Math.max(...feet(s.pose, h).map((q) => q[1]));
      const top: V3 = [0, body.legHalf - drop, 0];
      place = { at: top, yaw, sit: true, floor: 0 };
      s = sceneAt(runtime(place), "a", time, h, body);
      furniture = [soloChair(top, yaw, -top[1], h)];
    }
    const world = s.world;
    return {
      pose: s.pose,
      face: { mouth: s.mouth, brow: s.brow, eyes: s.eyes },
      equip: s.equip,
      flip: s.flip,
      world,
      spot: { x: s.x, groundY: s.groundY, scale: s.scale },
      floor: project(world.lens, [world.hip[0], 0, world.hip[2]]),
      ...(furniture && { furniture }),
      place,
    };
  };
}

/** Một khung của `soloStage`; `pose` có thì thay tư thế (không cờ nâng), hông, sàn và ghế vẫn theo hành động */
export function solo3d({ time = 0, pose, ...spec }: SoloSpec & { time?: number; pose?: Pose }) {
  const s = soloStage(spec)(time);
  return pose ? { ...s, pose } : s;
}
