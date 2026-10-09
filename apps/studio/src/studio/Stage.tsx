import {
  actionAirborne,
  actionFace,
  actionMask,
  actionLayers,
  animalActionFace,
  actionEquip,
  actionPose,
  blendDuration,
  blendFace,
  blendLayers,
  blendPose,
  Character,
  composeEquip,
  composeLayers,
  composePose,
  bakeTravel,
  bakeFeetTravel,
  animalFeet,
  Animal,
  loopTravel,
  POSE_LAYERS,
  POSES,
  Prop,
  propBox,
  propSeat,
  project,
  type ActionData,
  type AnimalData,
  type CharacterData,
  type EyeKind,
  type PieceKey,
  type PieceUrls,
  type PropData,
  type V3,
} from "@stickman3d/sketch";
import { SoloWorld, soloToStage, stageToSolo, type Solo } from "@stickman3d/fx";
import { Button } from "@/components/ui/button";
import { Maximize, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { usePieceEdit } from "./PieceEdit";
import {
  CENTER,
  GROUND,
  SPAN,
  animalExtent,
  animalHeight,
  animalPoseAt,
  animalSpot,
  characterHeight,
  figureViewBox,
} from "./Preview";
import { useZoom } from "./useZoom";
import type { MutateAction } from "./ActionPanel";
import type { Mutate } from "./Panel";
import {
  dragPlane,
  isSolid,
  PITCH,
  keyTarget,
  REACH_ARMS,
  setKeyReach,
  soloGround,
  soloStack,
  toReach,
  useSolo,
  wrapYaw,
  type ReachArm,
} from "./solo";
import { viewsOf, type ViewState } from "./view";

/** Lề để nhân vật quay đầu trước khi chạm mép khi trôi ngang */
const TRAVEL_EDGE = 120;

/** Đầu tự lắc gật: biên độ, độ, và chu kỳ, giây; hai chu kỳ lệch nhau để quét hết các tổ hợp */
const SWAY = { turn: 75, nod: 25, turnPeriod: 4, nodPeriod: 2.7 };

/** Người 3D tự quay, độ mỗi giây; kéo xoay, độ mỗi điểm ảnh màn hình */
const SPIN = 60;
const ORBIT = { yaw: 0.5, pitch: 0.3 };

/** Bề ngang đạo cụ tính từ nhân vật ra, để khung nhìn không cắt mất xe */
const propReach = (p: PropData, propX: number) => {
  const { x, w } = propBox(p);
  const wheels = Math.max(p.rear?.r ?? 0, p.front ? p.front.x + p.front.r : 0);
  return Math.abs(propX) + Math.max(-x, x + w, wheels);
};

interface Frame {
  t: number;
  /** Pha của hành động của động vật, đồng hồ riêng vì nhịp của nó khác nhịp người */
  animalT: number;
  animalX: number;
  /** Giây kể từ lúc hành động vào; đoạn hoà đo bằng giây, không phải pha */
  since: number;
  travelX: number;
  blink: boolean;
  /** Người 3D đã tự quay thêm bao nhiêu độ */
  spin: number;
}

type Drag3 =
  | { kind: "orbit"; x: number; y: number; yaw: number; pitch: number }
  | { kind: "reach"; ch: ReachArm; T: V3; solo: Solo; gy: number };

export function Stage({
  subject,
  character,
  action,
  under,
  urls,
  view,
  setView,
  sel,
  mutateAction,
  prop,
  propUrl,
  animal,
  animalAction,
  animalUrls,
  mutate,
  selected,
  onSelect,
  onPickPiece,
  onClearPiece,
  onResetPiece,
  paused,
}: {
  /** Ai đứng giữa sân khấu — theo tab trái. Động vật thì người chỉ dựng cạnh khi `view.compare` */
  subject: "character" | "animal";
  character: CharacterData;
  action: ActionData | null;
  /** Hành động 3D chồng dưới `action` (`view.under` đã nạp) */
  under: ActionData | null;
  urls: PieceUrls;
  view: ViewState;
  setView: (v: Partial<ViewState>) => void;
  /** Mốc đang chọn; người 3D kéo đích cổ tay của mốc ấy */
  sel: number;
  mutateAction: MutateAction;
  prop: PropData | null;
  propUrl?: string;
  animal: AnimalData | null;
  animalAction: ActionData | null;
  animalUrls: PieceUrls;
  mutate: Mutate;
  selected: PieceKey | null;
  onSelect: (k: PieceKey | null) => void;
  onPickPiece: (k: PieceKey) => void;
  onClearPiece: (k: PieceKey) => void;
  onResetPiece: (k: PieceKey) => void;
  /** Có modal che sân khấu; đồng hồ vẫn chạy nhưng khỏi vẽ lại thứ không ai thấy */
  paused: boolean;
}) {
  const [frame, setFrame] = useState<Frame>({
    t: 0,
    animalT: 0,
    animalX: 0,
    since: 0,
    travelX: 0,
    blink: false,
    spin: 0,
  });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { box, zoom, zoomBy, reset, handlers } = useZoom();
  const svg = useRef<SVGSVGElement>(null);
  const [replay, setReplay] = useState(0);
  const restart = useRef(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [box]);

  const sign = view.flip ? -1 : 1;
  const human = subject === "character";
  // Hành động soạn cho người 3D: người 3D giữa sân khấu trống như `stickman-render --yaw`
  const solid = human && isSolid(action);
  const beast = human ? null : animal;
  const ext = beast ? animalExtent(beast) : { half: 0, shift: 0 };
  // Người đứng cạnh con vật để so tỉ lệ: lệch `animalX` về phía đuôi, tính từ khớp hông
  const compare = !!beast && view.compare;
  // Ngồi trong xe: xe đứng giữa thay cho người, người treo hông vào chỗ ngồi của nó
  const seat = human && prop && view.propSit ? propSeat(prop) : undefined;
  const height = beast
    ? Math.max(animalHeight(beast), compare ? characterHeight(character) : 0)
    : Math.max(characterHeight(character), prop ? -propBox(prop).y : 0);
  const reach = beast
    ? Math.max(ext.half, compare ? Math.abs(ext.shift + view.animalX) + SPAN / 2 : 0)
    : prop
      ? propReach(prop, view.propX)
      : 0;
  const vb = figureViewBox(height, size.w, size.h, reach, SPAN);
  // Trôi ngang quay đầu ở mép khung nhìn, nên rAF phải đọc được biên hiện tại
  const travelMax = Math.max(160, vb.w / 2 - (beast ? ext.half : TRAVEL_EDGE));
  const base = POSES[view.pose];
  // Trôi ngang của động vật nướng từ chính bốn bàn chân của nó, cùng một hàm với người; bay thì không trôi
  const animalTravel = useMemo(
    () =>
      beast &&
      animalAction &&
      !actionAirborne(animalAction) &&
      bakeFeetTravel(
        (s) => animalFeet(beast, animalPoseAt(beast, animalAction, s / animalAction.duration)),
        animalAction.duration,
      ),
    [beast, animalAction],
  );

  // Bảng nướng cho một lượt hành động trần; vài frame hoà đầu lượt chân trượt nhẹ, chấp nhận ở bản xem thử
  const travel = useMemo(
    () =>
      action &&
      bakeTravel(
        (s) => composePose(base, actionPose(action, s / action.duration)),
        action.duration,
      ),
    [action, base],
  );

  // Kéo slider không được cắt ngang đoạn hoà; chỉ đổi file, bật/tắt hoà hoặc bấm chạy lại mới tính lượt mới
  useEffect(() => {
    restart.current = true;
  }, [action?.name, animalAction?.name, view.blend, replay]);

  // Đồng hồ vẫn chạy lúc ghim, nên nhả ghim phải nối lại từ chỗ vạch vàng chứ không từ giờ đã trôi
  const resume = useRef<number | null>(null);
  const pinned = useRef(view.scrub);
  useEffect(() => {
    if (view.scrub === null && pinned.current !== null) resume.current = pinned.current;
    pinned.current = view.scrub;
  }, [view.scrub]);

  const latest = useRef({
    action,
    view,
    character,
    travelMax,
    travel,
    paused,
    animalAction,
    animalTravel,
  });
  useEffect(() => {
    latest.current = {
      action,
      view,
      character,
      travelMax,
      travel,
      paused,
      animalAction,
      animalTravel,
    };
  }, [action, view, character, travelMax, travel, paused, animalAction, animalTravel]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let tCycle = 0;
    let animalCycle = 0;
    let since = 0;
    let blinkAt = 2;
    let blinking = 0;
    let spin = 0;
    const wrap = (x: number, lim: number) =>
      ((((x + lim) % (2 * lim)) + 2 * lim) % (2 * lim)) - lim;
    const loop = (now: number) => {
      const {
        action: a,
        view: v,
        character: ch,
        travelMax: lim,
        travel: tb,
        animalAction: ba,
        animalTravel: bt,
      } = latest.current;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dur = a?.duration ?? 1;
      const bdur = ba?.duration ?? 1;
      if (restart.current) {
        restart.current = false;
        tCycle = 0;
        animalCycle = 0;
        since = 0;
      }
      if (resume.current !== null) {
        // `hold` chỉ chạy một lượt: nhả ghim ở cuối lượt mà nối tiếp là đứng im, phải chạy lại từ đầu
        const at = resume.current;
        resume.current = null;
        tCycle = a?.end === "hold" && at >= 1 ? 0 : at;
        since = tCycle * dur;
        animalCycle = at;
      }
      tCycle += dt / dur;
      animalCycle += dt / bdur;
      since += dt;
      blinkAt -= dt;
      if (blinkAt <= 0) {
        blinking = 0.12;
        blinkAt = 3 + Math.random() * 2.5;
      }
      if (blinking > 0) blinking -= dt;
      spin = v.spin ? (spin + dt * SPIN) % 360 : 0;
      let travelX = 0;
      if (a && tb && v.travel) {
        const s = v.scrub === null ? since : v.scrub * dur;
        // Quay đầu ở mép khung nhìn, đi tiếp từ mép kia
        travelX = wrap(loopTravel(tb, dur, a.end, s) * ch.rig.height * (v.flip ? -1 : 1), lim);
      }
      let animalX = 0;
      if (ba && bt && v.travel) {
        const s = (v.scrub === null ? animalCycle : v.scrub) * bdur;
        animalX = wrap(loopTravel(bt, bdur, ba.end, s) * (v.flip ? -1 : 1), lim);
      }
      if (!latest.current.paused)
        setFrame({
          t: v.scrub ?? tCycle,
          animalT: v.scrub ?? animalCycle,
          animalX,
          since,
          travelX,
          blink: blinking > 0,
          spin,
        });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const baseLayers = POSE_LAYERS[view.pose] ?? {};
  // Clip trước ở đây là chính tư thế nền, nên bên `from` bỏ trống: kênh nào hành động ghi thì hoà từ nền ra
  const tau = action && view.blend && !solid ? blendDuration(base, {}, actionPose(action, 0)) : 0;
  const f = view.scrub !== null || tau <= 0 ? 1 : frame.since / tau;
  // Người đứng cạnh con vật thì chỉ đứng ở tư thế nền; hành động của người là chuyện của tab Người
  const acting = human ? action : null;
  const played = acting
    ? composePose(base, blendPose(base, {}, actionPose(acting, frame.t), f))
    : base;
  // Lắc gật xem thử ở cột Người cộng lên kênh `head`, như một lớp đè không ra JSON nào
  const wave = (a: number, period: number) =>
    view.sway ? a * Math.sin((2 * Math.PI * frame.since) / period) : 0;
  const headTurn = view.turn + wave(SWAY.turn, SWAY.turnPeriod);
  const headNod = view.nod + wave(SWAY.nod, SWAY.nodPeriod);
  const look = (p: typeof played) => ({
    ...p,
    head: [p.head[0], p.head[1] + headTurn, p.head[2] + headNod] as typeof p.head,
  });
  const pose = look(played);
  const layers = acting
    ? composeLayers(baseLayers, blendLayers({}, actionLayers(acting, frame.t), f))
    : composeLayers(baseLayers);
  // Hành động ghi nét mặt nào thì nét đó thắng; còn lại là nét mặt xem thử ở cột Người
  const acted = acting ? blendFace({}, actionFace(acting, frame.t), f) : {};
  // Đổi đồ là công tắc, không hoà: mốc nào ghi thì ăn ngay từ mốc ấy, đè lên đồ chọn ở cột Người
  const equip = composeEquip(view.equip, acting ? actionEquip(acting, frame.t) : undefined);
  const mouth = acted.mouth ?? view.mouth;
  const blinking: EyeKind = frame.blink ? "shut" : "open";
  const eyes = acted.eyes ?? (view.eyes === "auto" ? blinking : view.eyes);
  const anchorX = beast ? CENTER - sign * (ext.shift + view.animalX) : CENTER + frame.travelX;
  // Đạo cụ đi theo nhân vật như `follow` trong scene: lệch `propX` trong hệ của người, `roll` là x trên màn hình
  const propAtX = seat ? anchorX : anchorX + sign * view.propX;
  const personX = seat ? propAtX + sign * seat.x : anchorX;
  const propEl = (part?: "back" | "front") =>
    human &&
    prop && (
      <Prop
        prop={prop}
        url={propUrl}
        x={propAtX}
        groundY={GROUND}
        flip={view.flip}
        roll={propAtX}
        part={part}
      />
    );
  // Mỏ và mắt: hành động ghi thì thắng, không thì nét xem thử ở cột Người dùng chung
  const beastFace = beast && animalAction ? animalActionFace(animalAction, frame.animalT) : {};
  const animalEl = beast && (
    <Animal
      animal={beast}
      urls={animalUrls}
      pose={animalPoseAt(beast, animalAction, frame.animalT)}
      mouth={beastFace.mouth ?? view.mouth}
      eyes={beastFace.eyes ?? (view.eyes === "auto" ? blinking : view.eyes)}
      x={CENTER - sign * ext.shift + frame.animalX}
      {...animalSpot(beast, animalAction, GROUND)}
      flip={view.flip}
    />
  );
  const views = viewsOf(view);
  const personEl = (human || compare) && (
    <Character
      character={character}
      urls={urls}
      pose={pose}
      layers={layers}
      equip={equip}
      x={personX}
      groundY={seat ? GROUND + seat.y : GROUND}
      root={seat ? "hip" : "feet"}
      flip={view.flip}
      view={views.body}
      headView={views.head}
      mouth={mouth}
      brow={acted.brow ?? view.brow}
      eyes={eyes}
    />
  );

  const stack = useMemo(
    () => (solid && action ? soloStack(action, under) : null),
    [solid, action, under],
  );
  const soloAt = useSolo(character, stack, view.pitch);
  const yawNow = view.yaw + (view.spin ? frame.spin : 0);
  const solo = soloAt && action ? soloAt(yawNow, frame.t * action.duration) : null;
  const gy = solo ? soloGround(character, view.equip, solo, CENTER, GROUND) : GROUND;
  const onStage = (p: V3) => solo && soloToStage(solo, CENTER, gy, project(solo.world.lens, p));
  const solidEl = solo && (
    <SoloWorld
      solo={solo}
      body={{
        character,
        urls,
        pose: look(solo.pose),
        layers: solo.layers,
        equip: composeEquip(view.equip, solo.equip),
        flip: solo.flip,
        view: solo.view,
        headView: solo.headView,
        mouth,
        brow: acted.brow ?? view.brow,
        eyes,
      }}
      x={CENTER}
      groundY={gy}
    />
  );
  // Vòng trên sàn quanh chỗ đứng, vạch về `+x` là hướng yaw 0: mốc để đọc người đang quay về đâu
  const floorEl =
    solo &&
    (() => {
      const [hx, , hz] = solo.world.hip;
      const fl = solo.world.floor ?? 0;
      const r = 90 * solo.world.s;
      const ring = Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * 2 * Math.PI;
        const [x, y] = onStage([hx + r * Math.cos(a), fl, hz + r * Math.sin(a)])!;
        return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join("");
      const [ax, ay] = onStage([hx + r, fl, hz])!;
      const [bx, by] = onStage([hx + r * 1.3, fl, hz])!;
      return (
        <g fill="none" stroke="#cfc7b4" strokeWidth={3}>
          <path d={`${ring}Z`} />
          <path d={`M${ax} ${ay}L${bx} ${by}`} />
        </g>
      );
    })();
  const key3 = solo && action?.keys?.[sel];
  const reachArms = key3 && action ? REACH_ARMS.filter((c) => actionMask(action).includes(c)) : [];
  const handleEls =
    key3 &&
    reachArms.map((ch) => {
      const [x, y] = onStage(keyTarget(character, view.equip, solo, key3, ch))!;
      const set = !!key3.reach?.[ch];
      return (
        <circle
          key={ch}
          data-reach={ch}
          cx={x}
          cy={y}
          r={11}
          fill={ch === "armNear" ? "#f59e0b" : "#38bdf8"}
          fillOpacity={set ? 0.85 : 0.25}
          stroke={ch === "armNear" ? "#b45309" : "#0369a1"}
          strokeWidth={2.5}
          strokeDasharray={set ? undefined : "4 3"}
          className="cursor-grab"
        >
          <title>{`Đích cổ tay ${ch === "armNear" ? "tay gần" : "tay xa"}${set ? "" : " — đang theo góc, kéo là đổi sang đích"}`}</title>
        </circle>
      );
    });

  const drag3 = useRef<Drag3 | null>(null);
  const down3 = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!soloAt || !action || (e.target as HTMLElement).closest("button")) return false;
    const ch = (e.target as Element).closest("[data-reach]")?.getAttribute("data-reach");
    const k = action.keys?.[sel];
    if (ch && k) {
      const s = soloAt(yawNow, k.t * action.duration);
      const arm = ch as ReachArm;
      drag3.current = {
        kind: "reach",
        ch: arm,
        T: keyTarget(character, view.equip, s, k, arm),
        solo: s,
        gy: soloGround(character, view.equip, s, CENTER, GROUND),
      };
      setView({ scrub: k.t, spin: false, yaw: wrapYaw(yawNow) });
    } else if (!e.shiftKey && e.button === 0 && e.isPrimary) {
      drag3.current = { kind: "orbit", x: e.clientX, y: e.clientY, yaw: yawNow, pitch: view.pitch };
      if (view.spin) setView({ spin: false, yaw: wrapYaw(yawNow) });
    } else return false;
    e.currentTarget.setPointerCapture(e.pointerId);
    return true;
  };
  const move3 = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag3.current;
    if (!d) return false;
    if (d.kind === "orbit") {
      const pitch = Math.round(d.pitch + (e.clientY - d.y) * ORBIT.pitch);
      setView({
        yaw: wrapYaw(d.yaw - (e.clientX - d.x) * ORBIT.yaw),
        pitch: Math.min(PITCH.max, Math.max(PITCH.min, pitch)),
      });
      return true;
    }
    const m = svg.current?.getScreenCTM();
    if (!m) return true;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const uv = stageToSolo(d.solo, CENTER, d.gy, [p.x, p.y]);
    const at = toReach(character, d.solo, d.ch, dragPlane(d.solo.world.lens, d.T, uv));
    mutateAction((a) => setKeyReach(a, a.keys![sel], d.ch, at));
    return true;
  };

  const { pick, overlay } = usePieceEdit({
    svg,
    host: box,
    character,
    equip,
    views,
    mutate,
    selected,
    onSelect,
    onPick: onPickPiece,
    onClear: onClearPiece,
    onReset: onResetPiece,
    // Mảnh trôi dưới tay thì không căn được: kéo là ghim ngay frame đang xem
    onGesture: () => {
      if (acting && view.scrub === null) setView({ scrub: frame.t });
    },
  });

  return (
    <div
      ref={box}
      className="relative flex h-full w-full touch-none items-center justify-center overflow-hidden"
      {...handlers}
      onPointerDown={(e) => {
        if (solid ? !down3(e) : !pick(e)) handlers.onPointerDown(e);
      }}
      onPointerMove={(e) => {
        if (!move3(e)) handlers.onPointerMove(e);
      }}
      onPointerUp={(e) => {
        drag3.current = null;
        handlers.onPointerUp(e);
      }}
      onPointerCancel={(e) => {
        drag3.current = null;
        handlers.onPointerUp(e);
      }}
    >
      <svg
        ref={svg}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full rounded bg-[#f4f1e8]"
        style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})` }}
        onDoubleClick={reset}
      >
        {solid ? (
          <>
            {floorEl}
            {solidEl}
            {handleEls}
          </>
        ) : (
          <>
            <line x1={-9000} y1={GROUND} x2={9000} y2={GROUND} stroke="#cfc7b4" strokeWidth={3} />
            {view.animalBack && animalEl}
            {seat ? propEl("back") : view.propBack && propEl()}
            {personEl}
            {seat ? propEl("front") : !view.propBack && propEl()}
            {!view.animalBack && animalEl}
          </>
        )}
      </svg>
      {!solid && overlay}
      <div className="absolute right-1 bottom-1 flex gap-1">
        <Button
          variant="secondary"
          size="icon"
          className="size-8"
          title="Chạy lại từ đầu lượt"
          onClick={() => setReplay((n) => n + 1)}
        >
          <RotateCcw />
        </Button>
        <Button variant="secondary" size="icon" className="size-8" onClick={() => zoomBy(1 / 1.5)}>
          <ZoomOut />
        </Button>
        <Button variant="secondary" size="icon" className="size-8" onClick={() => zoomBy(1.5)}>
          <ZoomIn />
        </Button>
        {zoom.z !== 1 && (
          <Button variant="secondary" size="icon" className="size-8" onClick={reset}>
            <Maximize />
          </Button>
        )}
      </div>
    </div>
  );
}
