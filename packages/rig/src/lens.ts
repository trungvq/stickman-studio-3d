import * as THREE from 'three';
import { toThree, type Vec3 } from './khoi';

const deg = Math.PI / 180;

/**
 * Ống kính của scene rig (`scene.lens`): mắt ở toạ độ thế giới rig, `yaw`/`pitch` độ, tiêu cự `f` px trên khung sân khấu,
 * `cx`/`cy` điểm khung của trục nhìn (bỏ trống là giữa khung).
 */
export interface Lens { eye: Vec3; yaw: number; pitch: number; f: number; cx?: number; cy?: number }
/** Khung sân khấu (`rt.frame` của rig, `FRAMES.wide` là 1280×720): đơn vị toạ độ scene, không phải pixel. */
export interface StageFrame { w: number; h: number }
/**
 * Khung cắt 2D của scene: tâm `x`, `y` (toạ độ sân khấu, gốc ở giữa) và `zoom`. Kết quả `cameraAt(rt, t)` của rig
 * khớp đúng hình này, kèm `frame` là khung sân khấu của cảnh.
 */
export interface Crop { x: number; y: number; zoom: number; frame?: StageFrame }
export const STAGE: StageFrame = { w: 1280, h: 720 };
export const HOME: Crop = { x: 0, y: 0, zoom: 1 };

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
export function viewRect(aspect: number, crop: Crop = HOME, stage = STAGE) {
  let w = stage.w / crop.zoom, h = stage.h / crop.zoom;
  if (aspect > w / h) w = h * aspect;
  else h = w / aspect;
  return { full: [stage.w, stage.h] as [number, number], x: stage.w / 2 + crop.x - w / 2, y: stage.h / 2 + crop.y - h / 2, w, h };
}

/**
 * Đặt `camera` theo ống kính và khung cắt của một khung hình tỉ lệ `aspect`: mắt, hướng, fov và view offset.
 * Khung sân khấu lấy từ `crop.frame` (kết quả `cameraAt`), không có thì `STAGE`. Trả hộp cắt trên sân khấu.
 */
export function aimCamera(camera: THREE.PerspectiveCamera, lens: Lens, crop: Crop = HOME, aspect = camera.aspect, stage = crop.frame ?? STAGE) {
  const l = lensCamera(lens, stage);
  camera.position.copy(l.eye);
  camera.up.set(0, 1, 0);
  camera.lookAt(l.eye.add(l.fwd));
  camera.fov = l.fov;
  camera.aspect = stage.w / stage.h;
  // trục nhìn rơi vào (cx, cy) của sân khấu: dời khung cắt ngược lại trên ảnh có trục ở giữa
  const v = viewRect(aspect, { x: crop.x - (lens.cx ?? 0), y: crop.y - (lens.cy ?? 0), zoom: crop.zoom }, stage);
  camera.setViewOffset(...v.full, v.x, v.y, v.w, v.h);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return { ...v, x: v.x + (lens.cx ?? 0), y: v.y + (lens.cy ?? 0) };
}
