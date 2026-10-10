import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { act, type Acting } from './act';
import type { Vec3 } from './khoi';
import { put, stickman, type Figure, type StickmanOptions } from './stickman';

/** Vỏ nét cùng bề dày và màu gộp được dù là hai vật liệu khác nhau */
function materialKey(m: THREE.Material) {
  const u = (m as THREE.ShaderMaterial).uniforms;
  return m.side === THREE.BackSide && u?.uW ? `hull ${u.uW.value} ${u.uColor.value.getHex()}` : m.uuid;
}

/**
 * Đóng băng người nền ở tư thế hiện tại thành vài mesh tĩnh, một mesh mỗi vật liệu cho cả đám: cả hàng người ngồi
 * bàn chỉ còn chục lượt vẽ. Toạ độ thế giới — thêm nhóm trả về vào cùng chỗ với `root` của người (thường là `scene`)
 * và đừng thêm các `root` ấy nữa. Đồ đang cầm, đang đội gộp luôn; nét mặt và chớp mắt đứng yên. Lưới gộp không còn là
 * người (`userData.body`): `collide` đo nó như vật cản.
 */
export function freeze(figures: Figure | readonly Figure[]): THREE.Group {
  const list: readonly Figure[] = 'root' in figures ? [figures] : figures;
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; shadow: boolean; noShadow: boolean; noCrease: boolean; noCollide: boolean; order: number }>();
  for (const f of list) {
    f.root.updateWorldMatrix(true, true);
    f.root.traverseVisible((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      m.userData.bend?.();
      const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', src.attributes.position.clone());
      if (!src.attributes.normal) src.computeVertexNormals();
      g.setAttribute('normal', src.attributes.normal.clone());
      if (src.attributes.uv && m.material.type === 'MeshBasicMaterial') g.setAttribute('uv', src.attributes.uv.clone());
      g.applyMatrix4(m.matrixWorld);
      const key = materialKey(m.material);
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { mat: m.material, geos: [], shadow: false, noShadow: true, noCrease: true, noCollide: true, order: m.renderOrder }));
      b.geos.push(g);
      b.shadow ||= m.castShadow;
      b.noShadow &&= !!m.userData.noShadow;
      b.noCrease &&= !!m.userData.noCrease;
      b.noCollide &&= !!m.userData.noCollide;
    });
  }
  const out = new THREE.Group();
  for (const b of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(b.geos), b.mat);
    mesh.castShadow = b.shadow;
    mesh.renderOrder = b.order;
    if (b.noShadow) mesh.userData.noShadow = true;
    if (b.noCrease) mesh.userData.noCrease = true;
    if (b.noCollide) mesh.userData.noCollide = true;
    out.add(mesh);
  }
  return out;
}

/** Một chỗ ngồi của người nền */
export interface Seat {
  /** Điểm mặt ngồi dưới khớp hông (rig), như `put(…, sit)` */
  at: Vec3;
  /** Hướng người, độ, như `put` (0 mặt về +x, 90 về −z) */
  yaw: number;
  /** Đè lên người mẫu cho riêng chỗ này: màu áo, tóc, kiểu áo */
  opts?: Partial<StickmanOptions>;
  /** Dáng đã lấy mẫu (`sceneAt` ở một `t`, như `act`) thay cho dáng ngồi dựng sẵn */
  acting?: Acting;
  /** Dáng tay dựng sẵn: `desk` hai tay đặt lên mặt bàn trước người, `lap` đặt trên đùi. Mặc định `desk`. */
  hands?: 'desk' | 'lap';
}

const wobble = (i: number, k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1 - 0.5;

/**
 * Người nền ngồi kín các chỗ `seats`: mỗi chỗ một người `lod: 'low'` từ `base` (object hay hàm theo chỗ), đặt ngồi, tay
 * lên bàn hay lên đùi, đầu lệch nhẹ theo thứ tự chỗ (tất định), rồi `freeze` cả đám. Thêm nhóm trả về vào scene.
 */
export function seatCrowd(seats: readonly Seat[], base: StickmanOptions | ((i: number, seat: Seat) => StickmanOptions)): THREE.Group {
  const figs = seats.map((seat, i) => {
    const o = typeof base === 'function' ? base(i, seat) : base;
    const fig = stickman({ seed: i, ...o, ...seat.opts, lod: 'low', seated: true });
    put(fig, seat.at, seat.yaw, true);
    if (seat.acting) act(fig, seat.acting, 0);
    else {
      const desk = (seat.hands ?? 'desk') === 'desk';
      for (const sd of [-1, 1] as const) {
        fig.arms[sd].shoulder.rotation.set(desk ? -0.9 : -0.35, 0, sd * 0.1);
        fig.arms[sd].elbow.rotation.set(desk ? -0.7 : -1.0, 0, 0);
      }
      fig.neck.rotation.set(0.12 + wobble(i, 1) * 0.12, wobble(i, 2) * 0.5, wobble(i, 3) * 0.08, 'YXZ');
    }
    return fig;
  });
  const g = freeze(figs);
  g.traverse((m) => (m.userData.static = true));
  return g;
}
