// Mép tầm với của bàn tay đang kéo (Dáng tay, lúc dời tay nắm), chỉ để xem: mặt cầu mờ quanh vai và đường viền quay về
// camera, bán kính ước từ soft IK của rig (`ARM_SOFT`) cộng cổ tay → tâm nắm. Tay nắm ra ngoài mép thì viền hổ phách, chấm
// là chỗ bàn tay sẽ dừng (mép theo hướng vai → tay nắm); chỗ dừng thật dò lúc thả (`reachEdge` của `drag.ts`).
import * as rig from "@stickman3d/rig";
import type { HandReport } from "@stickman3d/rig";
import * as THREE from "three";

const IN = 0x7fb8ff;
const OUT = 0xffb300;

const basic = (color: number, opacity: number) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
const three = (v: readonly number[]) =>
  new THREE.Vector3(v[0] * rig.U, -v[1] * rig.U, -v[2] * rig.U);

export class ReachShell {
  readonly group = new THREE.Group();
  /** Tay nắm ra ngoài mép: chỗ bàn tay sẽ dừng (thế giới three) và khoảng tới mép (đơn vị rig) */
  over: { at: THREE.Vector3; px: number } | null = null;
  private shell = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), basic(IN, 0.05));
  private rim: THREE.LineLoop;
  private dot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), basic(OUT, 0.95));
  private centre = new THREE.Vector3();
  private r = 0;

  constructor() {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    this.rim = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: IN, transparent: true, opacity: 0.7, depthTest: false }),
    );
    this.group.add(this.shell, this.rim, this.dot);
    for (const o of this.group.children) o.renderOrder = 11;
    this.group.visible = false;
  }

  /** Hiện quanh vai của tay trong `rep` (thế giới rig); `null` là ẩn */
  show(rep: HandReport | null) {
    this.over = null;
    this.group.visible = !!rep;
    if (!rep) return;
    const { shoulder: S, elbow: E, wrist: W } = rep.joints;
    const d = (a: readonly number[], b: readonly number[]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    this.r = (1 - rig.ARM_SOFT) * (d(S, E) + d(E, W)) + d(W, rep.grip);
    this.centre = three(S);
    this.shell.position.copy(this.centre);
    this.shell.scale.setScalar(this.r * rig.U);
    this.rim.position.copy(this.centre);
    this.rim.scale.setScalar(this.r * rig.U);
    this.dot.scale.setScalar(this.r * rig.U * 0.04);
  }

  /** Theo tay nắm `at` (thế giới three) và camera: viền quay về camera, đổi màu và đặt chấm khi ra ngoài mép */
  update(at: THREE.Vector3, camera: THREE.Camera) {
    if (!this.group.visible) return;
    this.rim.quaternion.copy(camera.quaternion);
    const v = at.clone().sub(this.centre);
    const px = v.length() / rig.U - this.r;
    this.over = px > 0 ? { at: this.centre.clone().add(v.setLength(this.r * rig.U)), px } : null;
    const color = this.over ? OUT : IN;
    (this.rim.material as THREE.LineBasicMaterial).color.setHex(color);
    const m = this.shell.material as THREE.MeshBasicMaterial;
    m.color.setHex(color);
    m.opacity = this.over ? 0.08 : 0.05;
    this.dot.visible = !!this.over;
    if (this.over) this.dot.position.copy(this.over.at);
  }
}
