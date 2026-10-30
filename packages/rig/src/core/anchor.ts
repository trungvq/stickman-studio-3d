import { D, FACE_REAL_FROM, FACE_REAL_SPAN, RIG } from "./constants";
import { body3, figure3d, figureOf3, flatPose, type World } from "./figure3d";
import { computeFigure } from "./geometry";
import { facePoint, faceYaw, latOf, lonOf, type HeadTurn } from "./sphere";
import { sceneAt, type SceneRuntime } from "./scene";
import { defaultCharacter, type CharacterData, equipCharacter } from "./schema";
import type { Pose, Pt } from "./types";

/** Một nhóm treo: `translate(x, y) rotate(deg)`, `deg` là **độ SVG** (ngược dấu góc rig). */
export interface Frame {
  x: number;
  y: number;
  deg: number;
}

const rotPt = (deg: number, x: number, y: number): Pt => {
  const a = deg * D;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
};

/** `inner` đặt bên trong `outer` — đúng nghĩa hai `<g transform>` lồng nhau. */
export function frameCompose(outer: Frame, inner: Frame): Frame {
  const [dx, dy] = rotPt(outer.deg, inner.x, inner.y);
  return { x: outer.x + dx, y: outer.y + dy, deg: outer.deg + inner.deg };
}

/**
 * Khớp và mốc trên người 3D chiếu qua `scene.lens`: `root` là điểm chạm đất, `collar` là khớp
 * cổ, `wrist*` là cổ tay, `head` là khối sọ, `face` / `eye*` / `mouth` là nét mặt trên sọ.
 */
export const ANCHOR_NAMES = [
  "root",
  "hip",
  "hipNear",
  "hipFar",
  "kneeNear",
  "kneeFar",
  "footNear",
  "footFar",
  "shoulderNear",
  "shoulderFar",
  "elbowNear",
  "elbowFar",
  "wristNear",
  "wristFar",
  "collar",
  "head",
  "face",
  "eyeNear",
  "eyeFar",
  "mouth",
] as const;

export type AnchorName = (typeof ANCHOR_NAMES)[number];

/**
 * Một mốc trong hệ toạ độ chỗ vẽ của scene: tâm ở `x`/`y`, hộp `w`×`h` xoay `deg` độ SVG
 * quanh chính tâm ấy. Vẽ đè lên đúng chỗ đó là
 * `<g transform="translate(x y) rotate(deg)"><rect x={-w/2} y={-h/2} …/></g>`.
 */
export interface Anchor {
  x: number;
  y: number;
  deg: number;
  w: number;
  h: number;
  /** Người đã lật ngang: hộp không đổi, nhưng nội dung soi gương */
  flip: boolean;
}

type Joint = { frame: Frame; w: number; h: number };

/** Mọi mốc của một tư thế người 3D, gốc ở hông, chưa nhân `scale` và chưa lật */
function jointsOf(c: CharacterData, raw: Pose, world: World): Record<AnchorName, Joint> {
  const f3 = figure3d(c, raw, world);
  const pose = flatPose(c, raw, f3);
  const F = figureOf3(computeFigure(c, pose), f3, world.theta);
  const { face, head: ph } = c;
  const torso: Frame = { x: 0, y: 0, deg: pose.torso || 0 };
  const [tilt, turn, nod] = pose.head;
  const headRx = (RIG.headH / 2) * ph.scaleX;
  const headRy = (RIG.headH / 2) * ph.scaleY;
  const headCy = -headRy;
  // Đầu quay liên tục theo `theta`, xem docs/01-rig.md#mặt-người-3d
  const T: HeadTurn = { yaw: world.theta + turn, pitch: nod, look: f3.look };
  const eyeLat = latOf(face.offsetY, headRy);
  const eyeLon = lonOf(face.eyeGap / 2, headRx);
  const u = Math.max(0, Math.min(1, (T.yaw - FACE_REAL_FROM) / FACE_REAL_SPAN));
  const real = u * u * (3 - 2 * u);
  const fy = faceYaw(T.yaw, eyeLon, eyeLat);
  // Nét mặt quay theo `faceYaw` (chậm hơn đầu ở góc lớn), rồi trượt dần về góc thật
  const TF: HeadTurn = { ...T, yaw: fy + (T.yaw - fy) * real };
  const near = facePoint(TF, -eyeLon, eyeLat);
  const far = facePoint(TF, eyeLon, eyeLat);
  const faceCx = (headRx * (near[0] + far[0])) / 2;
  const faceCy = headCy + face.offsetY - headRy * (near[1] - Math.sin(eyeLat * D));
  const eyeGap = headRx * (far[0] - near[0]);
  const mouthAt = facePoint(TF, 0, latOf(face.offsetY + face.mouthGap, headRy));
  const mouthCx = headRx * mouthAt[0];
  const mouthCy = headCy - headRy * mouthAt[1];
  // Cổ và tâm đầu ở chỗ chiếu thật, thân co theo góc cúi
  const squash = f3.neckY / -(F.len.torso + F.len.neck);
  const neckDrop = Math.sin(nod * D) * F.len.neck * squash;
  const head = frameCompose(torso, { x: 0, y: f3.headY + headRy + neckDrop, deg: tilt });

  // Đoạn xương rời khớp chỉ theo +y của khung — nên `deg` là góc rig đổi dấu
  const at = (base: Frame, p: Pt, rigDeg: number): Joint => ({
    frame: frameCompose(base, { x: p[0], y: p[1], deg: -rigDeg }),
    w: 0,
    h: 0,
  });
  const inFrame = (f: Frame, x: number, y: number, w = 0, h = 0): Joint => ({
    frame: frameCompose(f, { x, y, deg: 0 }),
    w,
    h,
  });
  const ID: Frame = { x: 0, y: 0, deg: 0 };
  const [af, an] = [pose.af, pose.an];
  return {
    root: { frame: { x: 0, y: F.lowest, deg: 0 }, w: 0, h: 0 },
    hip: { frame: torso, w: 0, h: 0 },
    hipNear: at(ID, F.legN[0], pose.ln[0]),
    hipFar: at(ID, F.legF[0], pose.lf[0]),
    kneeNear: at(ID, F.legN[1], pose.ln[0] + pose.ln[1]),
    kneeFar: at(ID, F.legF[1], pose.lf[0] + pose.lf[1]),
    footNear: at(ID, F.legN[2], pose.ln[0] + pose.ln[1]),
    footFar: at(ID, F.legF[2], pose.lf[0] + pose.lf[1]),
    shoulderNear: at(torso, F.shN, an[0]),
    shoulderFar: at(torso, F.shF, af[0]),
    elbowNear: at(torso, F.armN[1], an[0] + an[1]),
    elbowFar: at(torso, F.armF[1], af[0] + af[1]),
    wristNear: at(torso, F.armN[2], an[0] + an[1] + an[2]),
    wristFar: at(torso, F.armF[2], af[0] + af[1] + af[2]),
    collar: at(torso, [0, f3.neckY], 0),
    head: inFrame(head, 0, headCy, headRx * 2, headRy * 2),
    face: inFrame(head, faceCx, faceCy),
    eyeNear: inFrame(head, faceCx - eyeGap / 2, faceCy),
    eyeFar: inFrame(head, faceCx + eyeGap / 2, faceCy),
    mouth: inFrame(head, mouthCx, mouthCy),
  };
}

/**
 * Mốc trên người 3D (`cast[].world`) trong **hệ toạ độ chỗ vẽ** của scene — cùng `viewBox` của
 * `cameraAt`, nên số trả ra cắm thẳng vào lớp SVG đè lên sân khấu three. Đây là đường duy nhất để
 * hiệu ứng bám vào người.
 */
export function anchorAt(
  rt: SceneRuntime,
  id: string,
  name: AnchorName,
  time: number,
  character: CharacterData = defaultCharacter(),
): Anchor {
  const at = sceneAt(rt, id, time, character.rig.height, body3(character));
  const j = jointsOf(equipCharacter(character, at.equip), at.pose, at.world)[name];
  const sx = at.flip ? -1 : 1;
  return {
    x: at.x + at.scale * sx * j.frame.x,
    y: at.groundY + at.scale * j.frame.y,
    deg: sx * j.frame.deg,
    w: j.w * at.scale,
    h: j.h * at.scale,
    flip: at.flip,
  };
}
