/**
 * Khung tĩnh của một hành động, dùng cho thumbnail chọn hành động và dải mốc.
 * Khung nhìn và điểm chạm đất chia chung với sân khấu — hình trong modal và hình
 * trên sân khấu phải là cùng một phép chiếu.
 */
import {
  actionEquip,
  actionFace,
  actionLayers,
  actionPose,
  actionAirborne,
  Animal,
  animalActionFace,
  animalActionPose,
  animalStand,
  Character,
  composeAnimalPose,
  composeEquip,
  composeLayers,
  composePose,
  lengths,
  POSE_LAYERS,
  POSES,
  RIG,
  type ActionData,
  type AnimalData,
  type AnimalPose,
  type CharacterData,
  type EyeKind,
  type PieceUrls,
} from "@stickman3d/sketch";
import { SoloWorld } from "@stickman3d/fx";
import { memo, useEffect, useMemo, useState } from "react";
import { isSolid, soloGround, soloStack, useSolo } from "./solo";
import { viewsOf, type ViewState } from "./view";

export const GROUND = 780;
export const CENTER = 450;
/** Bề ngang phải luôn thấy: hai tay xoè hết cỡ, chưa kể trôi ngang */
export const SPAN = 520;
/** Chừa trên đầu cho tóc, mũ và tay giơ lên */
const HEADROOM = 110;
const FOOTROOM = 40;

/** Bề ngang tối thiểu cho ô xem thử: hai tay xoè hết cỡ, không cần chừa chỗ trôi ngang */
const PREVIEW_SPAN = 420;

/** Ai đang đứng trên sân khấu và trong ô xem thử: chọn theo tab trái của studio */
export type Subject =
  | { kind: "character"; character: CharacterData; urls: PieceUrls }
  | { kind: "animal"; animal: AnimalData; urls: PieceUrls };

/** Đỉnh đầu nhân vật tính từ mặt đất khi đứng thẳng */
export const characterHeight = (c: CharacterData) => {
  const l = lengths(c.rig.height);
  return l.thigh + l.shin + l.torso + l.neck + RIG.headH * c.head.scaleY + c.head.dy;
};

/** Đỉnh con vật tính từ mặt đất: lưng cộng cổ và nửa đầu, đủ cho cả voi lẫn gà ngẩng */
export const animalHeight = (b: AnimalData) =>
  b.rig.hipY + b.body.depth * b.body.back + b.neck.len + b.head.len * 0.5;

/**
 * Nửa bề ngang con vật, và khớp hông lệch bao nhiêu so với giữa hình theo hướng nhìn `+x`
 * — gốc toạ độ của nó nằm ở đuôi chứ không ở giữa, đặt hông vào tâm là cụt mất cái đầu.
 */
export function animalExtent(b: AnimalData) {
  const front = Math.max(
    b.rig.body + b.body.front + b.neck.len + b.head.len,
    b.rig.body * b.parts.wing.at + b.parts.wing.len + b.parts.wing.width,
  );
  const rear = b.body.rear + b.parts.tail.len;
  return { half: (front + rear) / 2, shift: (front - rear) / 2 };
}

/** Tư thế động vật lúc pha `t`: hành động ghép lên tư thế đứng; hành động không phải của động vật thì nó cứ đứng yên */
export const animalPoseAt = (b: AnimalData, a: ActionData | null, t: number): AnimalPose =>
  composeAnimalPose(animalStand(b), (a && animalActionPose(a, t, b)) ?? {});

/** Đang bay thì treo ở hông, hạ đúng `hipY` để hông cao ngang lúc đứng — như `animalAt` của scene */
export const animalSpot = (b: AnimalData, a: ActionData | null, groundY: number) =>
  a && actionAirborne(a)
    ? { groundY: groundY - b.rig.hipY, root: "hip" as const, legLayer: "over" as const }
    : { groundY, root: "feet" as const, legLayer: "under" as const };

export const subjectHeight = (s: Subject) =>
  s.kind === "animal" ? animalHeight(s.animal) : characterHeight(s.character);

/** Khung nhìn bó sát hình theo chiều dọc, nới ngang theo khung chứa; `height` là đỉnh tính từ đất. */
export function figureViewBox(height: number, w: number, h: number, reach = 0, min = SPAN) {
  const top = GROUND - height - HEADROOM;
  const bottom = GROUND + FOOTROOM;
  const ratio = w > 0 && h > 0 ? w / h : 1;
  const span = Math.max(min, 2 * reach + 80);
  const vh = Math.max(bottom - top, span / ratio);
  const vw = vh * ratio;
  return { x: CENTER - vw / 2, y: (top + bottom - vh) / 2, w: vw, h: vh };
}

/** Nhịp nghỉ giữa hai lượt của hành động `hold`, để thumbnail không đứng im mãi */
const PAUSE = 0.5;
/** Số hình một chu kỳ, và trần số lần đổi hình mỗi giây */
const STEPS = 12;
const MAX_RATE = 20;

/**
 * Pha của một hành động ở giây `clock`, đã bậc thang: nhảy `STEPS` lần một chu kỳ và
 * nhiều nhất `MAX_RATE` lần một giây, nên pha chưa đổi thì `ActionFrame` (memo) không
 * vẽ lại. Một `<Character>` tốn cỡ `1ms` ở bản dev, đừng gọi nó mỗi frame.
 */
export function phaseAt(a: ActionData, clock: number) {
  // Một mốc là một tư thế đứng yên — vẽ một lần rồi thôi
  if (!a.gen && a.keys?.length === 1) return 0;
  const d = a.duration;
  const step = Math.max(d / STEPS, 1 / MAX_RATE);
  const t = Math.floor(clock / step) * step;
  return a.end === "hold" ? Math.min(1, (t % (d + PAUSE)) / d) : (t % d) / d;
}

/** Đồng hồ cho ô đang xem thử; `active` tắt là dừng hẳn rAF, không phải chỉ ẩn đi. */
export function useClock(active: boolean, fps = 30) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = -1;
    const start = performance.now();
    const loop = (now: number) => {
      const s = (now - start) / 1000;
      if (s - last >= 1 / fps) {
        last = s;
        setT(s);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, fps]);
  return t;
}

/** Tỉ lệ khung của mỗi ô xem thử */
const RATIO = 3 / 4;

/** Ô của hành động soạn cho người 3D: người 3D qua `soloStage` ở đúng hướng và góc cúi của sân khấu */
function SoloFrame({
  character,
  urls,
  action,
  under,
  t,
  view,
  className,
}: {
  character: CharacterData;
  urls: PieceUrls;
  action: ActionData;
  under?: ActionData | null;
  t: number;
  view: ViewState;
  className?: string;
}) {
  const stack = useMemo(() => soloStack(action, under ?? null), [action, under]);
  const solo = useSolo(character, stack, view.pitch)!(view.yaw, t * action.duration);
  const face = actionFace(action, t);
  const vb = figureViewBox(characterHeight(character), RATIO, 1, 0, PREVIEW_SPAN);
  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <SoloWorld
        solo={solo}
        body={{
          character,
          urls,
          pose: solo.pose,
          layers: solo.layers,
          equip: composeEquip(view.equip, solo.equip),
          flip: solo.flip,
          view: solo.view,
          headView: solo.headView,
          mouth: face.mouth ?? view.mouth,
          brow: face.brow ?? view.brow,
          eyes: face.eyes ?? (view.eyes === "auto" ? "open" : view.eyes),
        }}
        x={CENTER}
        groundY={soloGround(character, view.equip, solo, CENTER, GROUND)}
      />
    </svg>
  );
}

export const ActionFrame = memo(function ActionFrame({
  subject,
  action,
  under,
  t,
  view,
  className,
}: {
  subject: Subject;
  action: ActionData | null;
  /** Track dưới của người 3D, chỉ dải mốc của hành động đang soạn mới có */
  under?: ActionData | null;
  t: number;
  view: ViewState;
  className?: string;
}) {
  if (subject.kind === "animal") {
    const b = subject.animal;
    const { half, shift } = animalExtent(b);
    const vb = figureViewBox(animalHeight(b), RATIO, 1, half, PREVIEW_SPAN);
    return (
      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        className={className}
      >
        <line x1={vb.x} y1={GROUND} x2={vb.x + vb.w} y2={GROUND} stroke="#cfc7b4" strokeWidth={3} />
        <Animal
          animal={b}
          urls={subject.urls}
          pose={animalPoseAt(b, action, t)}
          {...(action ? animalActionFace(action, t) : {})}
          x={CENTER - (view.flip ? -1 : 1) * shift}
          {...animalSpot(b, action, GROUND)}
          flip={view.flip}
        />
      </svg>
    );
  }
  const { character, urls } = subject;
  if (action && isSolid(action))
    return (
      <SoloFrame
        character={character}
        urls={urls}
        action={action}
        under={under}
        t={t}
        view={view}
        className={className}
      />
    );
  const base = POSES[view.pose];
  const pose = action ? composePose(base, actionPose(action, t)) : base;
  const baseLayers = POSE_LAYERS[view.pose] ?? {};
  const layers = action
    ? composeLayers(baseLayers, actionLayers(action, t))
    : composeLayers(baseLayers);
  const face = action ? actionFace(action, t) : {};
  const equip = composeEquip(view.equip, action ? actionEquip(action, t) : undefined);
  const eyes: EyeKind = face.eyes ?? (view.eyes === "auto" ? "open" : view.eyes);
  const views = viewsOf(view);
  const vb = figureViewBox(characterHeight(character), RATIO, 1, 0, PREVIEW_SPAN);
  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <line x1={vb.x} y1={GROUND} x2={vb.x + vb.w} y2={GROUND} stroke="#cfc7b4" strokeWidth={3} />
      <Character
        character={character}
        urls={urls}
        pose={pose}
        layers={layers}
        equip={equip}
        x={CENTER}
        groundY={GROUND}
        flip={view.flip}
        view={views.body}
        headView={views.head}
        mouth={face.mouth ?? view.mouth}
        brow={face.brow ?? view.brow}
        eyes={eyes}
      />
    </svg>
  );
});
