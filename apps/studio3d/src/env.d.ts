// Module cảnh three của repo video (`stickman.world`), Vite trỏ tới qua alias — vite.config.ts
declare module "virtual:stickman-world" {
  import type { World3D, WorldCtx } from "@stickman3d/rig";
  export const worldOf: ((name: string, ctx: WorldCtx) => World3D | null) | undefined;
}
