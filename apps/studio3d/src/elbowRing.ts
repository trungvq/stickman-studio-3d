// Vòng khuỷu của bàn tay đang chọn (Dáng tay): đường tròn khuỷu quanh trục vai → cổ tay đi qua khuỷu đang vẽ
// (`handReport.ring`), tô theo `E(φ)` (xanh rẻ → đỏ đắt), chấm khuỷu đang vẽ (tím khi khoá), bóng khuỷu khi kéo. Chỉ vẽ và
// đọc chỗ con trỏ trên vòng; sửa JSON ở `drag.ts`.
import type { HandReport } from "@stickman3d/rig";
import * as THREE from "three";
import { costAt, costRamp, ringPhi, ringPoint } from "./grab";

const N = 144;
const LOCK = 0xc58af9;
const GHOST = 0xff9a3c;

/** Điểm rig → three */
const v3 = (p: readonly number[], U: number) => new THREE.Vector3(p[0] * U, -p[1] * U, -p[2] * U);

const basic = (color: number, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false });

export class ElbowRing {
  readonly group = new THREE.Group();
  private rep: HandReport | null = null;
  private U = 0.01;
  private ghost = new THREE.Group();
  private ghostLine = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: GHOST, depthTest: false, transparent: true }),
  );
  private ghostDot = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), basic(GHOST));

  constructor() {
    this.ghost.add(this.ghostLine, this.ghostDot);
    this.ghost.visible = false;
  }

  /** Dựng lại cho báo tay `rep` (thế giới rig, `U` rig → three); `null` là ẩn */
  update(rep: HandReport | null, U: number) {
    this.clear();
    this.rep = rep;
    this.U = U;
    if (!rep || rep.ring.radius < 1e-6) return;
    const r = rep.ring.radius * U;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) pts.push(v3(ringPoint(rep.ring, -180 + (360 * i) / N), U));
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const thick = Math.max(0.0025, r * 0.035);
    const tube = new THREE.TubeGeometry(curve, N, thick, 6, true);
    // màu theo `E(φ)`: hàng vòng ống thứ `i` là `φ` của mẫu thứ `i`
    const cost = rep.cost;
    const lo = cost ? Math.min(...cost.E) : 0;
    const col = new THREE.Color();
    const colors: number[] = [];
    for (let i = 0; i <= N; i++) {
      const phi = -180 + (360 * (i % N)) / N;
      if (cost) {
        const k = costRamp([lo, costAt(cost, phi)])[1];
        col.setHSL((1 - k) * 0.36, 0.85, 0.5);
      } else col.set(0x8a94a8);
      for (let j = 0; j <= 6; j++) colors.push(col.r, col.g, col.b);
    }
    tube.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const ring = new THREE.Mesh(
      tube,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      }),
    );
    const S = v3(rep.joints.shoulder, U);
    const E = v3(rep.joints.elbow, U);
    const W = v3(rep.joints.wrist, U);
    const C = v3(rep.ring.center, U);
    const line = (a: THREE.Vector3[], color: number, opacity: number) =>
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(a),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }),
      );
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(thick * 2.6, 16, 10),
      basic(rep.elbowLock ? LOCK : 0xffffff),
    );
    dot.position.copy(E);
    this.group.add(
      ring,
      line([S, W], 0xb8c0d0, 0.55),
      line([C, E], rep.elbowLock ? LOCK : 0xffffff, 0.7),
      dot,
      this.ghost,
    );
    this.ghostDot.scale.setScalar(thick * 2.6);
    for (const o of this.group.children) o.renderOrder = 10;
  }

  /** Bóng khuỷu khi kéo ở góc `phi` (vai → khuỷu → cổ tay); `null` là ẩn */
  drag(phi: number | null) {
    const rep = this.rep;
    this.ghost.visible = phi !== null && !!rep;
    if (phi === null || !rep) return;
    const U = this.U;
    const E = v3(ringPoint(rep.ring, phi), U);
    this.ghostDot.position.copy(E);
    this.ghostLine.geometry.dispose();
    this.ghostLine.geometry = new THREE.BufferGeometry().setFromPoints([
      v3(rep.joints.shoulder, U),
      E,
      v3(rep.joints.wrist, U),
    ]);
  }

  /** `E(φ)` ở góc `phi` theo báo tay; tay tự do `undefined` */
  cost(phi: number): number | undefined {
    return this.rep?.cost ? costAt(this.rep.cost, phi) : undefined;
  }

  /** Góc `φ` của chỗ trên vòng gần con trỏ (`px` toạ độ khung, `w`×`h`) trong `near` px; không gần thì `undefined` */
  near(camera: THREE.Camera, px: THREE.Vector2, w: number, h: number, near = 12) {
    const rep = this.rep;
    if (!rep || rep.ring.radius < 1e-6) return undefined;
    let best: { phi: number; d: number } | undefined;
    const scr = (phi: number) => {
      const p = v3(ringPoint(rep.ring, phi), this.U).project(camera);
      return p.z > 1 ? undefined : new THREE.Vector2(((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h);
    };
    let prev = scr(-180);
    for (let i = 1; i <= N; i++) {
      const phi = -180 + (360 * i) / N;
      const cur = scr(phi);
      if (prev && cur) {
        const ab = cur.clone().sub(prev);
        const k = Math.max(0, Math.min(1, px.clone().sub(prev).dot(ab) / (ab.lengthSq() || 1)));
        const d = prev.clone().addScaledVector(ab, k).distanceTo(px);
        if (!best || d < best.d) best = { phi: phi - (360 / N) * (1 - k), d };
      }
      prev = cur;
    }
    return best && best.d <= near ? best.phi : undefined;
  }

  /** Góc `φ` của tia `ray` cắt mặt phẳng vòng; tia gần song song mặt phẳng thì `undefined` */
  phiOn(ray: THREE.Ray): number | undefined {
    const rep = this.rep;
    if (!rep) return undefined;
    const n = v3(rep.axis, 1);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, v3(rep.ring.center, this.U));
    if (Math.abs(ray.direction.dot(n)) < 0.05) return undefined;
    const hit = ray.intersectPlane(plane, new THREE.Vector3());
    return hit ? ringPhi(rep.ring, [hit.x / this.U, -hit.y / this.U, -hit.z / this.U]) : undefined;
  }

  clear() {
    for (const c of [...this.group.children]) {
      c.removeFromParent();
      if (c === this.ghost) continue;
      const m = c as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    }
    this.ghost.visible = false;
  }
}
