import * as THREE from 'three';
import { toThree, type Vec3 } from './khoi';

const deg = Math.PI / 180;

/** Ống kính của scene rig (`scene.lens`): mắt ở toạ độ thế giới rig, `yaw`/`pitch` độ, tiêu cự `f` px trên khung sân khấu. */
export interface Lens { eye: Vec3; yaw: number; pitch: number; f: number }
/** Khung cắt 2D của scene (`camera[i]` của rig): tâm dời `x`, `y` px khỏi giữa sân khấu, `zoom`. */
export interface Crop { x: number; y: number; zoom: number }
export const STAGE = { w: 1280, h: 720 };

/** Ống kính rig → mắt, hướng nhìn và fov dọc của PerspectiveCamera. */
export function lensCamera(lens: Lens, stage = STAGE) {
  const y = lens.yaw * deg, p = lens.pitch * deg;
  const fwd = new THREE.Vector3(Math.sin(y) * Math.cos(p), -Math.sin(p), -Math.cos(y) * Math.cos(p));
  return { eye: toThree(lens.eye), fwd, fov: (2 * Math.atan(stage.h / 2 / lens.f)) / deg };
}

/**
 * Khung cắt 2D (`cameraAt`: khung w/zoom × h/zoom quanh tâm) thành tham số `setViewOffset` trên sân khấu.
 * Khung hiển thị khác tỉ lệ sân khấu thì nới khung cắt quanh cùng tâm cho khỏi méo.
 */
export function viewRect(aspect: number, crop: Crop = { x: 0, y: 0, zoom: 1 }, stage = STAGE) {
  let w = stage.w / crop.zoom, h = stage.h / crop.zoom;
  if (aspect > w / h) w = h * aspect;
  else h = w / aspect;
  return { full: [stage.w, stage.h] as [number, number], x: stage.w / 2 + crop.x - w / 2, y: stage.h / 2 + crop.y - h / 2, w, h };
}
