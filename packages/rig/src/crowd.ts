import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Figure } from './stickman';

/** Vỏ nét cùng bề dày và màu gộp được dù là hai vật liệu khác nhau */
function materialKey(m: THREE.Material) {
  const u = (m as THREE.ShaderMaterial).uniforms;
  return m.side === THREE.BackSide && u?.uW ? `hull ${u.uW.value} ${u.uColor.value.getHex()}` : m.uuid;
}

/**
 * Đóng băng người nền ở tư thế hiện tại thành vài mesh tĩnh, một mesh mỗi vật liệu cho cả đám: cả hàng người ngồi
 * bàn chỉ còn chục lượt vẽ. Toạ độ thế giới — thêm nhóm trả về vào cùng chỗ với `root` của người (thường là `scene`)
 * và đừng thêm các `root` ấy nữa. Đồ đang cầm, đang đội gộp luôn; nét mặt và chớp mắt đứng yên.
 */
export function freeze(figures: Figure | readonly Figure[]): THREE.Group {
  const list: readonly Figure[] = 'root' in figures ? [figures] : figures;
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; shadow: boolean; noShadow: boolean; order: number }>();
  for (const f of list) {
    f.root.updateWorldMatrix(true, true);
    f.root.traverseVisible((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', src.attributes.position.clone());
      if (!src.attributes.normal) src.computeVertexNormals();
      g.setAttribute('normal', src.attributes.normal.clone());
      if (src.attributes.uv && m.material.type === 'MeshBasicMaterial') g.setAttribute('uv', src.attributes.uv.clone());
      g.applyMatrix4(m.matrixWorld);
      const key = materialKey(m.material);
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { mat: m.material, geos: [], shadow: false, noShadow: true, order: m.renderOrder }));
      b.geos.push(g);
      b.shadow ||= m.castShadow;
      b.noShadow &&= !!m.userData.noShadow;
    });
  }
  const out = new THREE.Group();
  for (const b of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(b.geos), b.mat);
    mesh.castShadow = b.shadow;
    mesh.renderOrder = b.order;
    if (b.noShadow) mesh.userData.noShadow = true;
    out.add(mesh);
  }
  return out;
}
