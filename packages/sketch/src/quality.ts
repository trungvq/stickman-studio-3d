import { createContext } from "react";
import type { RigQuality } from "@stickman3d/rig/core";

export const RigQualityContext = createContext<RigQuality>("draft");
