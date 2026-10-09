import { registerRoot } from "remotion";
import { registerParts } from "@stickman3d/sketch";
import { CODE_PARTS } from "./parts";
import { Root } from "./Root";

registerParts(CODE_PARTS);
registerRoot(Root);
