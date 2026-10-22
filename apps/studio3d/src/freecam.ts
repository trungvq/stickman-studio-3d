// Điều khiển camera tự do quanh OrbitControls: dời (pan) bằng chuột phải, chuột giữa, Shift + chuột trái; lăn hai ngón trên
// touchpad cũng dời, Ctrl + lăn hay chụm hai ngón thì tiến lùi; phím WASD/QE đi theo hướng camera. README.md#phím
import * as THREE from "three";
import { MOUSE } from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** Cách hiểu một lần lăn không giữ Ctrl: tự nhận (touchpad thì dời, bánh xe chuột thì tiến lùi), luôn tiến lùi, luôn dời */
export type WheelMode = "auto" | "zoom" | "pan";

/** Phím đi của camera tự do: [trục camera, dấu] — x ngang, y lên (thế giới), z tiến */
const MOVE: Record<string, [0 | 1 | 2, number]> = {
  KeyW: [2, 1],
  KeyS: [2, -1],
  KeyA: [0, -1],
  KeyD: [0, 1],
  KeyE: [1, 1],
  KeyQ: [1, -1],
};
/** Tốc độ đi: lần khoảng camera → tâm xoay mỗi giây; giữ Shift nhanh gấp `FAST` */
const SPEED = 0.6;
const FAST = 3;
/** Một lần lăn bánh xe chuột thường ra `deltaY` nguyên, từ ngần này trở lên; touchpad ra số lẻ, nhỏ, hay có `deltaX` */
const NOTCH = 50;
/** Đã thấy một lần lăn kiểu touchpad thì trong ngần này ms các lần lăn nhỏ sau vẫn là touchpad (cử chỉ đang chạy) */
const STICKY = 400;

/**
 * Bộ nhận lăn của một khung: lần lăn không giữ Ctrl này là dời (touchpad hai ngón) hay tiến lùi, theo kiểu `mode`. Nhớ lần
 * lăn kiểu touchpad gần nhất, nên các lần lăn nhỏ ngay sau (cử chỉ đang chạy) vẫn là touchpad
 */
export function wheelPans(): (e: WheelEvent, mode: WheelMode) => boolean {
  let lastPad = -Infinity;
  return (e, mode) => {
    if (e.ctrlKey) return false;
    const now = performance.now();
    const sure = e.deltaMode === 0 && (e.deltaX !== 0 || !Number.isInteger(e.deltaY));
    if (sure) lastPad = now;
    const pad =
      sure || (e.deltaMode === 0 && (Math.abs(e.deltaY) < NOTCH || now - lastPad < STICKY));
    return mode === "pan" || (mode === "auto" && pad);
  };
}

export interface FreeCam {
  /** Gắn vào OrbitControls mới (mỗi lần nạp cảnh dựng lại canvas) */
  attach(orbit: OrbitControls): void;
  /** Mỗi khung: đi theo phím đang giữ; `true` khi camera đã dời */
  step(dt: number): boolean;
  wheel: WheelMode;
}

/** `el` là khung cha của canvas (canvas đổi mỗi lần nạp cảnh, khung thì không); `active` khi đang ở camera tự do */
export function freeCam(
  camera: THREE.PerspectiveCamera,
  el: HTMLElement,
  active: () => boolean,
): FreeCam {
  const held = new Set<string>();
  let orbit: OrbitControls | null = null;
  const pans = wheelPans();
  const cam: FreeCam = {
    wheel: (localStorage.getItem("studio3d.wheel") as WheelMode) || "auto",
    attach(o) {
      orbit = o;
      // Shift + chuột trái cũng dời: OrbitControls đổi xoay → dời khi giữ Ctrl/Meta/Shift
      o.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN };
      o.screenSpacePanning = true;
    },
    step(dt) {
      if (!orbit || !active() || !held.size) return false;
      const d = camera.position.distanceTo(orbit.target);
      const v = new THREE.Vector3();
      const ax = [
        new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).negate(),
      ];
      let fast = false;
      for (const k of held) {
        if (k === "Shift") fast = true;
        const m = MOVE[k];
        if (m) v.addScaledVector(ax[m[0]], m[1]);
      }
      if (v.lengthSq() < 1e-12) return false;
      v.normalize().multiplyScalar(
        Math.max(d, 0.2) * SPEED * (fast ? FAST : 1) * Math.min(dt, 0.1),
      );
      camera.position.add(v);
      orbit.target.add(v);
      return true;
    },
  };
  function onWheel(e: WheelEvent) {
    if (!orbit || !active() || !pans(e, cam.wheel)) return;
    e.preventDefault();
    e.stopPropagation();
    // hai ngón kéo: cảnh đi theo ngón như kéo bằng chuột phải
    orbit.pan(-e.deltaX, -e.deltaY);
  }
  // lăn: bắt ở pha capture trên khung cha, trước bộ nghe `wheel` của OrbitControls trên canvas
  el.addEventListener("wheel", onWheel, { capture: true, passive: false });
  const typing = (e: KeyboardEvent) =>
    (e.target instanceof HTMLInputElement && e.target.type !== "range") ||
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLSelectElement;
  addEventListener("keydown", (e) => {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code in MOVE && active()) {
      held.add(e.code);
      e.preventDefault();
    }
    if (e.key === "Shift") held.add("Shift");
  });
  addEventListener("keyup", (e) => {
    held.delete(e.code);
    if (e.key === "Shift") held.delete("Shift");
  });
  addEventListener("blur", () => held.clear());
  return cam;
}
