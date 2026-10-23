import type * as THREE from "three";

/**
 * Ẩn khi vẽ mọi nhánh của `root` trừ các vật `keep` (cả cây con của chúng) và đường từ `root` xuống chúng. Chỉ trả lại
 * `visible` của những gì chính nó đã ẩn
 */
export class Solo {
  private hid: THREE.Object3D[] = [];

  hide(root: THREE.Object3D, keep: readonly THREE.Object3D[]) {
    this.show();
    const kept = new Set(keep);
    const path = new Set<THREE.Object3D>();
    for (const k of keep) for (let p = k.parent; p && p !== root; p = p.parent) path.add(p);
    const walk = (node: THREE.Object3D) => {
      for (const c of node.children) {
        if (kept.has(c)) continue;
        if (path.has(c)) walk(c);
        else if (c.visible) {
          c.visible = false;
          this.hid.push(c);
        }
      }
    };
    walk(root);
  }

  show() {
    for (const o of this.hid) o.visible = true;
    this.hid = [];
  }
}
