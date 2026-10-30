// Bối cảnh của cảnh xem thử (Thư viện Studio 3D, `bang-hanh-dong`): `plainRoom` cộng khối đơn giản theo `stage` của
// hành động — ghế, bàn, đệm seiza, quầy — đặt quanh người ở gốc của `previewScene`. Ghế, bàn dựng từ mục vai trò
// (`chairRoles`, `deskRoles`) bằng `propOf`, mang `roles` như đồ thật. Đồ khối của rig, không vật liệu riêng.
import * as THREE from 'three';
import { D, dirOf, type HeldItemSpec, type V3 } from './core';
import { chairRoles, deskRoles, PREVIEW_COUNTER, PREVIEW_LOUNGE, PREVIEW_SEAT, previewItems, previewLens, type PreviewScene, type PreviewStage } from './core/preview';
import { Batch, box, U, type Item, type Tone } from './khoi';
import { propOf, propSet } from './roles';
import type { Set3D, WorldSpec } from './world';

export interface PreviewSetOptions {
  /** `world.yaw` của người, độ; mặc định `90` như `previewScene` */
  yaw?: number;
  /** `rig.height` của nhân vật: khối theo cỡ người */
  height?: number;
  /** Mặt ngồi của ghế, rig ở `height = 1`; mặc định `PREVIEW_SEAT.chair` — khớp `seat` của `previewScene` */
  seat?: number;
  /** Hông ngồi ngả của `armchair` trượt ra trước ngần này, rig ở `height = 1`; mặc định `PREVIEW_LOUNGE` */
  lounge?: number;
}

const CUSHION: Tone = { top: '#9c5a4f', lit: '#ad6a5e', side: '#874c43' };
const COUNTER_TOP: Tone = { top: '#cbbfa8', lit: '#d9cfbd', side: '#b0a48d' };
const COUNTER_BODY: Tone = { top: '#b9ad97', lit: '#c9bfab', side: '#a4987f' };

/** Đệm ngồi seiza trên sàn: gối ở trước hông một đùi, mu bàn chân sau hông */
function cushion(yaw: number, h: number): Item {
  return {
    name: 'cushion',
    touch: ['shin', 'foot', 'thigh'],
    at: { at: [0, 0, 0], yaw: yaw * D },
    parts: [{ v: box(-50 * h, 105 * h, -6 * h, 0, -65 * h, 65 * h), tone: CUSHION }],
  };
}

/** Quầy trước mặt người đứng ở gốc: mặt quầy `PREVIEW_COUNTER`, mép gần cách hông `near` */
function counter(yaw: number, h: number): Item {
  const top = -PREVIEW_COUNTER * h;
  // bụng người béo nhô trước hông tới ~70
  const near = 78 * h;
  const deep = 132 * h;
  const half = 150 * h;
  const t = 8 * h;
  const lip = 5 * h;
  return {
    name: 'counter',
    touch: [
      { part: 'hand', max: 4 },
      { part: 'foreArm', max: 4 },
    ],
    at: { at: [0, 0, 0], yaw: yaw * D },
    parts: [
      { v: box(near, near + deep, top, top + t, -half, half), tone: COUNTER_TOP },
      {
        v: box(near + lip, near + deep - lip, top + t, 0, -half + lip, half - lip),
        tone: COUNTER_BODY,
      },
    ],
  };
}

/** Khối của `stage` quanh người ở gốc nhìn theo `yaw`, đúng chỗ `previewScene` đặt người */
export function previewProps(stage: PreviewStage, opts: PreviewSetOptions = {}): Item[] {
  const h = opts.height ?? 1;
  const yaw = opts.yaw ?? 90;
  switch (stage) {
    case 'chair':
    case 'desk':
    case 'armchair':
    case 'sit-down':
    case 'stand-up': {
      const s = (opts.seat ?? PREVIEW_SEAT.chair) * h;
      // ngồi ngả: hông trượt ra trước trên mặt ngồi, ghế lùi sau
      const back = stage === 'armchair' ? dirOf(yaw * D).map((v) => -v * (opts.lounge ?? PREVIEW_LOUNGE) * h) : [0, 0, 0];
      const arms = stage !== 'chair' && stage !== 'desk';
      const seat = propOf('chair', { at: [back[0], -s, back[2]], yaw: yaw * D }, chairRoles(h, arms), { h });
      return stage === 'desk' ? [seat, propOf('desk', { at: [0, 0, 0], yaw: yaw * D }, deskRoles(s, h), { h })] : [seat];
    }
    case 'floor':
      return [cushion(yaw, h)];
    case 'counter':
      return [counter(yaw, h)];
    default:
      return [];
  }
}

/** `WorldSpec.set` của cảnh xem thử: `plainRoom` rộng (`PROP_ROOM`) cộng `previewProps` */
export function previewSet(stage: PreviewStage, opts: PreviewSetOptions = {}): Set3D {
  return propSet(previewProps(stage, opts));
}

/** Màu khối món cầm theo thứ tự phần (`part`): thân, rồi các phần khác */
const HELD_TONES = ['#6f8ea6', '#d8cfbf', '#a7674f', '#5f7a5a'];
const Y = new THREE.Vector3(0, 1, 0);

/** Trụ (côn) bán kính `r0` ở `from` tới `r1` ở `to`, khung món */
function rod(from: THREE.Vector3, to: THREE.Vector3, r0: number, r1 = r0) {
  const axis = to.clone().sub(from);
  return new THREE.CylinderGeometry(r1, r0, axis.length(), 24)
    .translate(0, axis.length() / 2, 0)
    .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, axis.normalize()))
    .translate(from.x, from.y, from.z);
}

/**
 * Lưới khối của món cầm dựng thẳng từ hình va chạm `shape` (hộp, trụ, ống, cầu) ở gốc khung món — y lên, +z mặt trước,
 * đơn vị rig × `U`; món không có `shape` là một hộp `size` đứng trên gốc. Món treo (`seats`) mà hình không có quai thì
 * thêm hai sợi quai mảnh từ đỉnh thân lên mốc treo. Chỉ để xem thử
 */
export function previewHeld(spec: HeldItemSpec): THREE.Group {
  const shapes = spec.shape ?? [{ box: spec.size, at: [0, spec.size[1] / 2, 0] as V3 }];
  const parts: string[] = [];
  const tone = (part?: string) => {
    const k = part ?? '';
    if (!parts.includes(k)) parts.push(k);
    return HELD_TONES[parts.indexOf(k) % HELD_TONES.length];
  };
  const batch = new Batch();
  const body = new THREE.Box3();
  for (const b of shapes) {
    let geo: THREE.BufferGeometry;
    if ('box' in b) {
      geo = new THREE.BoxGeometry(...b.box).translate(...((b.at ?? [0, 0, 0]) as V3));
    } else if ('ball' in b) {
      geo = new THREE.SphereGeometry(b.ball, 16, 12).translate(...((b.at ?? [0, 0, 0]) as V3));
    } else {
      const from = new THREE.Vector3(...b.from);
      const to = new THREE.Vector3(...b.to);
      const len = from.distanceTo(to);
      const r0 = b.cyl;
      const r1 = b.r2 ?? b.cyl;
      geo = b.wall
        ? new THREE.LatheGeometry(
            [
              new THREE.Vector2(r0, 0),
              new THREE.Vector2(r1, len),
              new THREE.Vector2(Math.max(0.1, r1 - b.wall), len),
              new THREE.Vector2(Math.max(0.1, r0 - b.wall), 0),
              new THREE.Vector2(r0, 0),
            ],
            24,
          )
            .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, to.clone().sub(from).normalize()))
            .translate(from.x, from.y, from.z)
        : rod(from, to, r0, r1);
    }
    geo.computeBoundingBox();
    if (!b.part || !spec.parts?.[b.part]?.strap) body.union(geo.boundingBox!);
    batch.geometry(tone(b.part), geo.scale(U, U, U));
  }
  const strap = shapes.some((b) => b.part && spec.parts?.[b.part]?.strap);
  const seats = new Set(Object.values(spec.seats ?? {}));
  if (!strap && !body.isEmpty())
    for (const name of seats) {
      const top = new THREE.Vector3(...spec.anchors[name].at);
      if (top.y <= body.max.y + 1) continue;
      const c = body.getCenter(new THREE.Vector3());
      const w = (body.max.x - body.min.x) * 0.3;
      for (const x of [c.x - w, c.x + w])
        batch.geometry(tone('strap'), rod(new THREE.Vector3(x, body.max.y, c.z), top, 0.8).scale(U, U, U));
    }
  return batch.build();
}

/**
 * `WorldSpec.extra` của cảnh xem thử: đăng ký khối của mỗi món `preview.hold` cầm (`previewItems`) với `cast.provide`,
 * món chung; món không có trong `held` thì bỏ
 */
export function previewExtra(scene: PreviewScene, held: Record<string, HeldItemSpec>): WorldSpec['extra'] {
  const items = previewItems(scene).filter((i) => held[i.file]);
  if (!items.length) return undefined;
  return (_marks, cast) => {
    const group = new THREE.Group();
    for (const { item, file } of items) {
      const o = previewHeld(held[file]);
      o.name = item;
      group.add(o);
      cast.provide(item, o);
    }
    return { group };
  };
}

/**
 * `WorldSpec` của cảnh xem thử `scene` (`previewScene`) có `stage`: bối cảnh `previewSet`, món của `preview.hold`, máy
 * `previewLens`. `still: []` để người ngồi vẫn diễn; `yaw`, `height` phải trùng `opts` đã đưa cho `previewScene`
 */
export function previewWorld(
  scene: PreviewScene,
  stage: PreviewStage,
  held: Record<string, HeldItemSpec>,
  opts: PreviewSetOptions = {},
): WorldSpec {
  return {
    set: () => previewSet(stage, opts),
    still: [],
    extra: previewExtra(scene, held),
    lens: (t) => previewLens(scene, t),
  };
}
