// `@stickman3d/cli` là JS thuần: chỉ khai phần vite.config.ts dùng
declare module "@stickman3d/cli/studio3d" {
  /** Cấu hình Vite của Studio 3D cho repo video `dir`; `tree` là monorepo rig trang lấy mã nguồn */
  export function studio3dConfig(o: {
    dir?: string;
    tree?: string;
    heldOut?: string;
    app?: string;
  }): import("vite").InlineConfig;
}

declare module "@stickman3d/cli/gen-pages" {
  /** Một tham số của form trang soi (docs/13-vai-tro-do.md mục 9.1) */
  export interface GenParam {
    key: string;
    label: string;
    type: "number" | "enum" | "bool" | "point";
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    values?: readonly string[];
    /** Tên tiếng Việt của từng giá trị `enum` */
    names?: Record<string, string>;
    default: number | string | boolean;
    /** Hiện khi tham số khác bằng giá trị (danh sách: một trong số ấy) */
    when?: Record<string, number | string | boolean | readonly (number | string | boolean)[]>;
  }
  /** Sân khấu thử: cảnh, đồ thử chỉ bằng mục vai trò, món cầm tay thử (đã `parseHeldItem`) */
  export interface GenStage {
    scene: import("@stickman3d/rig/core").PreviewScene;
    props: import("@stickman3d/rig").Prop[];
    held: Record<string, import("@stickman3d/rig").HeldItemSpec>;
    h: number;
    /** `pour`: điểm thế giới của chỗ chén */
    cup?: [number, number, number];
    /** `walk`: điểm `--to` và bán kính bo của kịch bản */
    to?: string;
    radius?: number;
  }
  export interface GenPage {
    label: string;
    params: GenParam[];
    stage(
      p: Record<string, unknown>,
      who: {
        name?: string;
        character?: import("@stickman3d/rig/core").CharacterData;
        /** Hành động hai lớp (đã `parseAction`) */
        actions?: Record<string, unknown>;
      },
    ): GenStage;
    call(p: Record<string, unknown>, stage: GenStage): Record<string, unknown>;
    /** Số mà tham số đang `"auto"` giải ra */
    auto?(
      p: Record<string, unknown>,
      who?: Record<string, unknown>,
    ): Record<string, number | string>;
  }
  export const GEN_PAGES: Record<string, GenPage>;
  export function paramProblems(params: readonly GenParam[], p: unknown): string[];
  export function paramValue(
    params: readonly GenParam[],
    p: Record<string, unknown>,
    key: string,
  ): number | string | boolean;
}
