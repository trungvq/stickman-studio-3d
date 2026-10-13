import { buildWorld, type WorldCtx } from "@stickman3d/rig";
import { CANH_3D } from "./canh";

// Lối vào `stickman.world` của `package.json`: `stickman check` và `scene_probe` dựng cảnh three của cảnh 3D trong Node
// (không WebGL, không webpack) để đo người lồng vào mọi vật lên hình — cùng `buildWorld` mà `Scene3D` vẽ. Cảnh không khai
// trong `CANH_3D` đi đường khối của lớp vẽ code (`pnpm exec stickman docs 10`, mục "Đo trên cảnh three").
export function worldOf(sceneName: string, ctx: WorldCtx) {
  const spec = CANH_3D[sceneName];
  return spec ? buildWorld(ctx.scene, ctx.runtime, spec, ctx) : null;
}
