// Nón cổ tay của bàn tay đang chọn (Dáng tay), chỉ để xem: chóp ở cổ tay trong khung cẳng tay; cạnh chóp là miền
// `AIM_BEND × AIM_DEV` ở xoay cẳng tay đang vẽ, vòng cung dưới chân là xoay cẳng tay ±`TURN_MAX` (vạch là hướng lòng tay
// đang vẽ). Chấm là hướng bàn tay: trắng trong miền, hổ phách khi sát kẹp (như cảnh báo `wrist` của luật `held`), đỏ khi khớp
// bị kẹp hay vượt kẹp; món đặt trước vượt kẹp thì thêm chấm hướng nghiệm và số độ vượt.
import * as rig from "@stickman3d/rig";
import type { HandReport, Side } from "@stickman3d/rig";
import * as THREE from "three";
import { coneRim, wristDir } from "./grab";

const OK = 0xffffff;
const BAD = 0xff3b30;
const NEAR = 0xffb300;
const CONE = 0x7fb8ff;

const basic = (color: number, opacity = 1) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    side: THREE.DoubleSide,
  });
const lineOf = (pts: THREE.Vector3[], color: number, opacity = 0.9, loop = false) => {
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });
  return loop ? new THREE.LineLoop(g, m) : new THREE.Line(g, m);
};
const vec = (v: readonly number[]) => new THREE.Vector3(v[0], v[1], v[2]);
const rotation = (o: THREE.Object3D) => {
  o.updateWorldMatrix(true, false);
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().extractRotation(o.matrixWorld),
  );
};

export class WristCone {
  readonly group = new THREE.Group();
  /** Chỗ đặt nhãn (thế giới three) và chữ: số độ vượt, khớp kẹp */
  label: { at: THREE.Vector3; text: string; tone: "ok" | "near" | "bad" } | null = null;

  /**
   * Dựng lại ở cổ tay của `fig` bên `side` theo báo tay `rep`; khung cẳng tay là hướng khớp khuỷu three (`Re`, bàn tay
   * `Re · wristTurn`). `warn`: cách kẹp dưới ngần này độ là sát kẹp (`stickman.held.wrist` của luật `held`)
   */
  update(rep: HandReport | null, fig: rig.Figure | null, side: Side, warn = rig.HELD_WRIST) {
    this.clear();
    this.label = null;
    if (!rep || !fig) return;
    const arm = fig.arms[side];
    const W = arm.wrist.getWorldPosition(new THREE.Vector3());
    const E = arm.elbow.getWorldPosition(new THREE.Vector3());
    const L = Math.max(0.02, W.distanceTo(E) * 0.4);
    this.group.position.copy(W);
    this.group.quaternion.copy(rotation(arm.elbow));
    const s = side;
    const { drawn, raw, over, clamped } = rep.wrist;
    const rim = coneRim(drawn.turn, s, 10).map((d) => vec(d).multiplyScalar(L));
    // mặt chóp: quạt từ đỉnh
    const pos: number[] = [];
    rim.forEach((p, i) => {
      const q = rim[(i + 1) % rim.length];
      pos.push(0, 0, 0, p.x, p.y, p.z, q.x, q.y, q.z);
    });
    const face = new THREE.BufferGeometry();
    face.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const corners = [0, 10, 20, 30].map((i) => rim[i]);
    this.group.add(
      new THREE.Mesh(face, basic(CONE, 0.08)),
      lineOf(rim, CONE, 0.8, true),
      ...corners.map((c) => lineOf([new THREE.Vector3(), c], CONE, 0.5)),
      lineOf([new THREE.Vector3(), new THREE.Vector3(0, -L * 1.15, 0)], 0xb8c0d0, 0.5),
    );
    // vòng cung xoay cẳng tay: hướng lòng tay khi không gập, không lệch, quanh trục cẳng tay
    const base = new THREE.Vector3(0, -L * 0.85, 0);
    const r = L * 0.45;
    const palmAt = (turn: number) =>
      vec(rig.matVec(rig.wristTurn(turn, 0, 0, s), [-s, 0, 0])).multiplyScalar(r);
    const arc: THREE.Vector3[] = [];
    for (let a = -rig.TURN_MAX; a <= rig.TURN_MAX + 1e-9; a += 6)
      arc.push(base.clone().add(palmAt(a)));
    const turnBad = clamped.includes("turn");
    this.group.add(
      lineOf(arc, 0x9aa6bd, 0.85),
      lineOf([base, base.clone().add(palmAt(drawn.turn))], turnBad ? BAD : OK, 0.95),
    );
    // cách kẹp như luật `held`: món đặt trước đo trên nghiệm của bộ giải (`heldWristMargin`), còn lại trên góc vẽ
    const placed = (rep.mode === "keyed" || rep.mode === "both") && !rep.run?.lead && rep.grasp;
    const margin = placed
      ? rig.heldWristMargin(placed.arm.wrist)
      : Math.max(
          Math.abs(drawn.turn) - rig.TURN_MAX,
          ...(
            [
              [drawn.bend, rig.AIM_BEND],
              [drawn.dev, rig.AIM_DEV],
            ] as const
          ).map(([v, [lo, hi]]) => Math.max(lo - v, v - hi)),
        );
    const bad = clamped.includes("bend") || clamped.includes("dev") || margin > 0;
    const near = !bad && margin > -warn;
    const tone = bad ? BAD : near ? NEAR : OK;
    const dot = (d: THREE.Vector3, color: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(L * 0.06, 14, 10), basic(color));
      m.position.copy(d);
      return m;
    };
    const tip = vec(wristDir(drawn.turn, drawn.bend, drawn.dev, s)).multiplyScalar(L);
    this.group.add(lineOf([new THREE.Vector3(), tip], tone, 0.9), dot(tip, tone));
    const sum = over.turn + over.bend + over.dev;
    const parts: string[] = [];
    if (raw && sum > 0.05) {
      const want = vec(wristDir(raw.turn, raw.bend, raw.dev, s)).multiplyScalar(L);
      this.group.add(lineOf([tip, want], BAD, 0.9), dot(want, BAD));
      const each = (["turn", "bend", "dev"] as const)
        .filter((k) => over[k] > 0.05)
        .map((k) => `${NAMES[k]} ${over[k].toFixed(0)}°`);
      parts.push(`vượt ${each.join(", ")}`);
    } else if (clamped.length) parts.push(`kẹp ${clamped.map((k) => NAMES[k]).join(", ")}`);
    else if (margin > 0) parts.push(`vượt kẹp ${margin.toFixed(0)}°`);
    else if (near) parts.push(`sát giới hạn — còn ${(-margin).toFixed(0)}° tới kẹp`);
    if (rep.wrist.err !== undefined && rep.wrist.err > 0.5)
      parts.push(`trục món lệch ${rep.wrist.err.toFixed(0)}°`);
    for (const o of this.group.children) o.renderOrder = 11;
    this.group.updateMatrixWorld(true);
    this.label = {
      at: tip.clone().applyMatrix4(this.group.matrixWorld),
      text: parts.length ? parts.join(" · ") : "cổ tay trong miền",
      tone: clamped.length > 0 || sum > 0.05 || bad ? "bad" : near ? "near" : "ok",
    };
  }

  clear() {
    for (const c of [...this.group.children]) {
      c.removeFromParent();
      const m = c as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    }
  }
}

const NAMES = { turn: "xoay", bend: "gập", dev: "lệch" } as const;
