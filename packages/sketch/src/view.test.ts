import { describe, expect, it } from "vitest";

import { anchorAt, bodyArtView, figureAnchors, frameLocal } from "./anchor";
import {
  castCharacter,
  CharacterSchema,
  clampViews,
  computeFigure,
  defaultCharacter,
  FRONT,
  hairstyleArt,
  HAIRSTYLES,
  HEAD_SHAPES,
  headHalfWidth,
  isAway,
  migrateCharacter,
  parseScene,
  type Pose,
  POSES,
  QUARTER,
  REAR_EYE,
  REAR_MOUTH_INSET,
  resolveScene,
  restYaw,
  SCENE_VERSION,
  sceneAt,
  type SceneData,
  type SceneRuntime,
  SIDE_EYE,
  SIDE_HIP,
  SIDE_MOUTH_INSET,
  SIDE_SHOULDER,
  SIDE_TORSO,
  type View,
  viewArt,
  VIEWS,
  type Views,
} from "@stickman3d/rig/core";
import { PARTS } from "./Parts";

const C = defaultCharacter();
const poses = Object.entries(POSES) as [string, Pose][];
const v = (body: View, head: View = body): Views => ({ body, head });
/** Mọi tổ hợp thân × đầu, kể cả hai cái không vẽ được */
const PAIRS = VIEWS.flatMap((body) => VIEWS.map((head) => v(body, head)));
/** Nửa bề ngang khẩu hình rộng nhất, đúng bằng bề ngang `Mouth` vẽ ra */

/** Cảnh thô qua zod; JSON sai là hỏng ngay trong test chứ không lặng lẽ lấy mặc định */
function parsed(json: unknown): SceneData {
  const r = parseScene(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}

const run = (json: object): SceneRuntime =>
  resolveScene(parsed({ schemaVersion: SCENE_VERSION, ...json }), {}, {}, {});

const viewsAt = (rt: SceneRuntime, id: string, t: number): Views => {
  const at = sceneAt(rt, id, t);
  return { body: at.view, head: at.headView };
};

describe("clampViews", () => {
  it("thân `back` với đầu `front` thì đầu quay ra sau", () => {
    expect(clampViews(v("back", "front"))).toStrictEqual(v("back", "back"));
  });

  it("đầu `back` hay `rear` trên thân chưa `back` thì đầu về `side`", () => {
    expect(clampViews(v("front", "back"))).toStrictEqual(v("front", "side"));
    expect(clampViews(v("side", "back"))).toStrictEqual(v("side", "side"));
    expect(clampViews(v("front", "rear"))).toStrictEqual(v("front", "side"));
    expect(clampViews(v("side", "rear"))).toStrictEqual(v("side", "side"));
  });

  it("thân `rear` giữ nguyên khi thân áo dựng khối, không thì là thân `back`", () => {
    expect(clampViews(v("rear"))).toStrictEqual(v("rear", "rear"));
    expect(clampViews(v("rear", "side"))).toStrictEqual(v("rear", "side"));
    expect(clampViews(v("rear", "back"))).toStrictEqual(v("rear", "back"));
    expect(clampViews(v("rear", "front"))).toStrictEqual(v("rear", "rear"));
    expect(clampViews(v("rear"), false)).toStrictEqual(v("back", "rear"));
    expect(clampViews(v("rear", "side"), false)).toStrictEqual(v("back", "side"));
    expect(clampViews(v("rear", "front"), false)).toStrictEqual(v("back", "back"));
  });

  it("thân quay lưng với đầu `front` / `quarter` thì đầu theo nấc thân", () => {
    expect(VIEWS.filter(isAway)).toStrictEqual(["rear", "back"]);
    expect(clampViews(v("rear", "quarter"))).toStrictEqual(v("rear", "rear"));
    expect(clampViews(v("back", "quarter"), false)).toStrictEqual(v("back", "back"));
    expect(clampViews(v("rear", "quarter"), false)).toStrictEqual(v("back", "back"));
  });

  it("thân `back` với đầu `quarter` cũng quay ra sau", () => {
    expect(clampViews(v("back", "quarter"))).toStrictEqual(v("back", "back"));
    expect(clampViews(v("quarter", "rear"))).toStrictEqual(v("quarter", "side"));
  });

  it("mười lăm tổ hợp còn lại giữ nguyên", () => {
    const away = (x: View) => x === "back" || x === "rear";
    const keep = PAIRS.filter((p) =>
      away(p.body) ? p.head !== "front" && p.head !== "quarter" : !away(p.head),
    );
    expect(keep).toHaveLength(15);
    for (const p of keep) expect(clampViews(p)).toStrictEqual(p);
  });

  it("kẹp lần nữa không đổi gì", () => {
    for (const p of PAIRS) expect(clampViews(clampViews(p))).toStrictEqual(clampViews(p));
  });
});

describe("computeFigure theo góc nhìn", () => {
  it.each(poses)("%s: `side` chập vai và hông về trục giữa", (_ten, P) => {
    const f = computeFigure(C, P, "side");
    expect(f.shoulderSpan).toBeCloseTo(C.rig.shoulderHalf * SIDE_SHOULDER, 12);
    expect(f.hipSpan).toBeCloseTo(C.rig.hipHalf * SIDE_HIP, 12);
    expect(f.shN[0]).toBeCloseTo(-f.shoulderSpan, 12);
    expect(f.shF[0]).toBeCloseTo(f.shoulderSpan, 12);
    expect(f.legN[0][0]).toBeCloseTo(-f.hipSpan, 12);
    expect(f.legF[0][0]).toBeCloseTo(f.hipSpan, 12);
  });

  it.each(poses)("%s: `front` mặc định, `back` không đổi bề ngang", (_ten, P) => {
    const front = computeFigure(C, P, "front");
    expect(computeFigure(C, P)).toStrictEqual(front);
    expect(computeFigure(C, P, "back")).toStrictEqual(front);
    expect(front.shoulderSpan).toBe(C.rig.shoulderHalf);
    expect(front.hipSpan).toBe(C.rig.hipHalf);
  });
});

describe("computeFigure: thân `rear` không dựng khối", () => {
  it.each(poses)("%s: như `back`, chi gần vẫn phía `−x`", (_ten, P) => {
    const f = computeFigure(C, P, "rear");
    expect(f).toStrictEqual(computeFigure(C, P, "back"));
    expect(f.nearSide).toBe(-1);
    expect(f.shoulderSpan).toBe(C.rig.shoulderHalf);
  });
});

describe("figureAnchors: `quarter` là mặc định", () => {
  it.each(poses)("%s: bỏ trống `views` bằng đúng truyền `QUARTER`", (_ten, P) => {
    expect(figureAnchors(C, P)).toStrictEqual(figureAnchors(C, P, QUARTER));
  });

  it("`views` trả về đã kẹp", () => {
    expect(figureAnchors(C, POSES.idle).views).toStrictEqual(QUARTER);
    expect(figureAnchors(C, POSES.idle, v("front", "back")).views).toStrictEqual(
      v("front", "side"),
    );
    expect(figureAnchors(C, POSES.idle, v("back", "front")).views).toStrictEqual(v("back", "back"));
  });
});

describe("figureAnchors: đầu `side`", () => {
  const P: Pose = { ...POSES.idle, head: [0, 0, 0] };
  const fa = figureAnchors(C, P, v("side"));

  it("hai mắt chập làm một, ghim về mép trước", () => {
    expect(fa.face.eyeGap).toBe(0);
    expect(fa.face.cx).toBeCloseTo(fa.face.headCx + fa.face.headRx * SIDE_EYE, 12);
    expect(fa.joints.eyeNear.frame).toStrictEqual(fa.joints.eyeFar.frame);
    expect(fa.joints.eyeNear.frame).toStrictEqual(fa.joints.face.frame);
  });

  it("lắc đầu không dời nét mặt nữa", () => {
    const quay = figureAnchors(C, { ...P, head: [0, 40, 0] }, v("side"));
    expect(quay.face.cx).toBeCloseTo(fa.face.cx, 12);
    expect(quay.face.eyeGap).toBe(0);
  });

  it("`front` thì hai mắt vẫn cách nhau đúng `face.eyeGap`", () => {
    expect(figureAnchors(C, P).face.eyeGap).toBeCloseTo(C.face.eyeGap, 12);
  });

  it.each(HEAD_SHAPES)("%s: tâm mồm nằm sát viền đầu, cách `SIDE_MOUTH_INSET`", (shape) => {
    const c = { ...C, head: { ...C.head, shape } };
    const { face } = figureAnchors(c, P, v("side"));
    const { headCx, headCy, headRx, headRy, mouthCx, mouthCy } = face;
    const bien = headCx + headHalfWidth(shape, headRx, headRy, mouthCy - headCy);
    expect(mouthCx).toBeCloseTo(bien - headRx * SIDE_MOUTH_INSET, 12);
  });

  it("`front` thì mồm ngay dưới cụm mắt", () => {
    const { face } = figureAnchors(C, P);
    expect(face.mouthCx).toBe(face.cx);
  });
});

describe("figureAnchors: đầu `rear`", () => {
  const P: Pose = { ...POSES.idle, head: [0, 40, 0] };
  const fa = figureAnchors(C, P, v("rear"));

  it("thân vẽ như `back`", () => {
    expect(fa.views).toStrictEqual(v("back", "rear"));
  });

  it("một mắt ghim sát mép hơn `side`, lắc không dời nó", () => {
    expect(fa.face.eyeGap).toBe(0);
    expect(fa.face.cx).toBeCloseTo(fa.face.headCx + fa.face.headRx * REAR_EYE, 12);
    expect(REAR_EYE).toBeGreaterThan(SIDE_EYE);
  });

  it.each(HEAD_SHAPES)("%s: tâm mồm cách viền đầu `REAR_MOUTH_INSET`", (shape) => {
    const c = { ...C, head: { ...C.head, shape } };
    const { face } = figureAnchors(c, P, v("rear"));
    const { headCx, headCy, headRx, headRy, mouthCx, mouthCy } = face;
    const bien = headCx + headHalfWidth(shape, headRx, headRy, mouthCy - headCy);
    expect(mouthCx).toBeCloseTo(bien - headRx * REAR_MOUTH_INSET, 12);
  });

  it("kiểu tóc nào cũng có đủ hình nghiêng, 3/4 sau và sau", () => {
    for (const n of Object.keys(HAIRSTYLES))
      for (const view of ["side", "rear", "back"] as const)
        expect(viewArt(n, view), `${n} ${view}`).toBeDefined();
  });
});

describe("figureAnchors: gật ở đầu nghiêng có tóc dựng khối", () => {
  const S = CharacterSchema.parse({ pieces: { hair: { src: "sculpt" } } });
  const at = (c: typeof S, view: View, nod: number) =>
    figureAnchors(c, { ...POSES.idle, head: [0, 0, nod] }, v(view));
  /** Mốc trong hệ nhóm đầu: cổ hạ theo gật nên so tuyệt đối là lệch */
  const local = (fa: ReturnType<typeof at>, name: "eyeNear" | "mouth") =>
    frameLocal(fa.joints[name].frame, fa.frames.head);

  it("`side`: nét mặt xoay quanh tâm đầu đúng bằng góc gật", () => {
    const [a, b] = [at(S, "side", 0), at(S, "side", 25)];
    expect(b.face.cx).toBeCloseTo(a.face.cx, 12);
    expect(b.face.cy).toBeCloseTo(a.face.cy, 12);
    expect(b.frames.face.deg - b.frames.head.deg).toBeCloseTo(25, 9);
    for (const name of ["eyeNear", "mouth"] as const) {
      const p = local(a, name);
      const q = local(b, name);
      const [cx, cy] = [a.face.headCx, a.face.headCy];
      const r = (25 * Math.PI) / 180;
      expect(q.x).toBeCloseTo(cx + (p.x - cx) * Math.cos(r) - (p.y - cy) * Math.sin(r), 9);
      expect(q.y).toBeCloseTo(cy + (p.x - cx) * Math.sin(r) + (p.y - cy) * Math.cos(r), 9);
    }
  });

  it("`rear`: cúi thì mặt xuống và nghiêng ít hơn góc gật", () => {
    const [a, b] = [at(S, "rear", 0), at(S, "rear", 25)];
    expect(local(b, "eyeNear").y).toBeGreaterThan(local(a, "eyeNear").y);
    const deg = b.frames.face.deg - b.frames.head.deg;
    expect(deg).toBeGreaterThan(0);
    expect(deg).toBeLessThan(25);
  });

  it("tóc phẳng hay đầu chính diện: nhóm nét mặt là chính nhóm đầu", () => {
    for (const fa of [
      at(C, "side", 25),
      at(C, "rear", 25),
      at(S, "front", 25),
      at(S, "quarter", 25),
    ])
      expect(fa.frames.face).toBe(fa.frames.head);
  });
});

describe("figureAnchors: thân `rear`", () => {
  const solid = CharacterSchema.parse({ pieces: { torso: { src: "sculpt" } } });

  it("thân áo ảnh hay mảnh ra `back`, thân áo dựng khối giữ `rear`", () => {
    expect(C.pieces.torso.src).not.toBe("sculpt");
    expect(figureAnchors(C, POSES.idle, v("rear", "side")).views).toStrictEqual(v("back", "side"));
    expect(figureAnchors(solid, POSES.idle, v("rear", "side")).views).toStrictEqual(
      v("rear", "side"),
    );
  });

  it("mảnh treo trên thân mượn hình và bộ chỉnh của `back`", () => {
    for (const x of VIEWS) expect(bodyArtView(x)).toBe(x === "rear" ? "back" : x);
    const rear = figureAnchors(solid, POSES.idle, v("rear", "back")).slots;
    const back = figureAnchors(solid, POSES.idle, v("back")).slots;
    for (const k of ["sleeveNear", "sleeveFar", "neck", "hem", "handNear", "handFar"] as const)
      expect(rear[k].box, k).toStrictEqual(back[k].box);
  });
});

describe("figureAnchors: đầu `back`", () => {
  it("nét mặt không trôi ngang theo lắc", () => {
    const P: Pose = { ...POSES.idle, head: [0, 40, 0] };
    const sau = figureAnchors(C, P, v("back"));
    expect(sau.face.cx).toBeCloseTo(sau.face.headCx, 12);
    const truoc = figureAnchors(C, P);
    expect(truoc.face.cx).not.toBeCloseTo(truoc.face.headCx, 6);
  });
});

describe("figureAnchors: thân `side`", () => {
  const P = POSES.idle;

  it("thân áo chưa có hình `side` thì bóp ngang `SIDE_TORSO`", () => {
    const truoc = figureAnchors(C, P).slots.torso.box;
    const ben = figureAnchors(C, P, v("side")).slots.torso.box;
    expect(ben.w).toBeCloseTo(truoc.w * SIDE_TORSO, 12);
    expect(ben.h).toBeCloseTo(truoc.h, 12);
  });

  it("chỉ thân áo bóp, khăn cổ và tà áo giữ nguyên hộp", () => {
    const truoc = figureAnchors(C, P).slots;
    const ben = figureAnchors(C, P, v("side")).slots;
    expect(ben.neck.box).toStrictEqual(truoc.neck.box);
    expect(ben.hem.box).toStrictEqual(truoc.hem.box);
  });
});

describe("scene: `cast[].view`", () => {
  it("chuỗi thì cả cảnh một góc, `headView` bỏ trống đi theo thân", () => {
    const rt = run({ cast: [{ id: "a", view: "side" }, { id: "b" }] });
    expect(viewsAt(rt, "a", 0)).toStrictEqual(v("side"));
    expect(viewsAt(rt, "b", 0)).toStrictEqual(QUARTER);
  });

  it("chuỗi mốc là bậc thang, trước mốc đầu là `quarter`", () => {
    const rt = run({ duration: 4, cast: [{ id: "a", view: [{ t: 1.5, v: "side" }] }] });
    expect(viewsAt(rt, "a", 0).body).toBe("quarter");
    expect(viewsAt(rt, "a", 1.49).body).toBe("quarter");
    expect(viewsAt(rt, "a", 1.5).body).toBe("side");
    expect(viewsAt(rt, "a", 4).body).toBe("side");
  });

  it("nhiều mốc đổi qua lại", () => {
    const rt = run({
      duration: 6,
      cast: [
        {
          id: "a",
          view: [
            { t: 0, v: "side" },
            { t: 2, v: "back" },
            { t: 4, v: "front" },
          ],
        },
      ],
    });
    expect(viewsAt(rt, "a", 0)).toStrictEqual(v("side"));
    expect(viewsAt(rt, "a", 2)).toStrictEqual(v("back"));
    expect(viewsAt(rt, "a", 5)).toStrictEqual(FRONT);
  });

  it("mốc viết bằng `@mốc`", () => {
    const rt = run({
      duration: 4,
      marks: { quay: 2.5 },
      cast: [
        {
          id: "a",
          view: [
            { t: "@quay", v: "side" },
            { t: "@quay+1", v: "back" },
          ],
        },
      ],
    });
    expect(viewsAt(rt, "a", 2.4).body).toBe("quarter");
    expect(viewsAt(rt, "a", 2.5).body).toBe("side");
    expect(viewsAt(rt, "a", 3.5).body).toBe("back");
  });

  it("`headView` chạy riêng chuỗi mốc của nó", () => {
    const rt = run({
      duration: 4,
      cast: [{ id: "a", view: "side", headView: [{ t: 2, v: "back" }] }],
    });
    expect(viewsAt(rt, "a", 0)).toStrictEqual(v("side", "quarter"));
    expect(viewsAt(rt, "a", 2)).toStrictEqual(v("side", "side"));
  });

  it("tổ hợp không vẽ được thì `sceneAt` kẹp", () => {
    const rt = run({
      cast: [
        { id: "a", view: "back", headView: "front" },
        { id: "b", view: "front", headView: "back" },
        { id: "c", view: "side", headView: "back" },
      ],
    });
    expect(viewsAt(rt, "a", 0)).toStrictEqual(v("back"));
    expect(viewsAt(rt, "b", 0)).toStrictEqual(v("front", "side"));
    expect(viewsAt(rt, "c", 0)).toStrictEqual(v("side"));
  });

  it("mốc không tăng dần là lỗi", () => {
    const keys = [
      { t: 2, v: "side" },
      { t: 1, v: "back" },
    ];
    expect(() => run({ duration: 4, cast: [{ id: "a", view: keys }] })).toThrow(
      "`view[].t` phải tăng dần",
    );
    expect(() => run({ duration: 4, cast: [{ id: "a", headView: keys }] })).toThrow(
      "`headView[].t` phải tăng dần",
    );
  });

  it("góc lạ thì zod chặn ngay lúc nạp", () => {
    expect(parseScene({ cast: [{ id: "a", view: "trên" }] }).success).toBe(false);
  });

  it("JSON đời 17 lên mới, thiếu `view` là `quarter`", () => {
    const data = parsed({ schemaVersion: 17, cast: [{ id: "a" }] });
    expect(data.schemaVersion).toBe(SCENE_VERSION);
    expect(SCENE_VERSION).toBe(34);
    expect(viewsAt(resolveScene(data, {}, {}, {}), "a", 0)).toStrictEqual(QUARTER);
  });

  it("JSON đời 18 lên 19: `front` ghi rõ thành `quarter`, cả trong chuỗi mốc", () => {
    const data = parsed({
      schemaVersion: 18,
      duration: 4,
      cast: [
        { id: "a", view: "front", headView: "side" },
        {
          id: "b",
          view: [
            { t: 0, v: "side" },
            { t: 2, v: "front" },
          ],
          headView: [{ t: 1, v: "front" }],
        },
      ],
    });
    const rt = resolveScene(data, {}, {}, {});
    expect(viewsAt(rt, "a", 0)).toStrictEqual(v("quarter", "side"));
    expect(viewsAt(rt, "b", 3)).toStrictEqual(QUARTER);
    expect(data.cast[1].view).toStrictEqual([
      { t: 0, v: "side" },
      { t: 2, v: "quarter" },
    ]);
    expect(parsed({ schemaVersion: 19, cast: [{ id: "c", view: "front" }] }).cast[0].view).toBe(
      "front",
    );
  });
});

describe("anchorAt đi theo góc nhìn của người", () => {
  const rt = run({
    cast: [
      { id: "truoc" },
      { id: "ben", view: "side" },
      { id: "dau", view: "front", headView: "side" },
    ],
  });

  it("vai chập vào trục giữa khi thân `side`", () => {
    const a = anchorAt(rt, "truoc", "shoulderNear", 0);
    const b = anchorAt(rt, "ben", "shoulderNear", 0);
    expect(b.x).toBeCloseTo(a.x * SIDE_SHOULDER, 12);
    expect(b.y).toBeCloseTo(a.y, 12);
  });

  it("hai mắt chập làm một khi đầu `side`", () => {
    const near = anchorAt(rt, "dau", "eyeNear", 0);
    const far = anchorAt(rt, "dau", "eyeFar", 0);
    expect(near.x).toBeCloseTo(far.x, 12);
    expect(anchorAt(rt, "truoc", "eyeNear", 0).x).not.toBeCloseTo(
      anchorAt(rt, "truoc", "eyeFar", 0).x,
      6,
    );
  });

  it("hộp thân áo hẹp lại khi thân `side`", () => {
    expect(anchorAt(rt, "ben", "torso", 0).w).toBeCloseTo(
      anchorAt(rt, "truoc", "torso", 0).w * SIDE_TORSO,
      12,
    );
  });
});

describe("kiểu tóc", () => {
  const styled = (part: string) => {
    const c = defaultCharacter();
    c.pieces.hair = { ...c.pieces.hair, src: "part", part };
    return c;
  };

  it("hộp chính diện và hộp lớp `under` cùng tâm sọ, cùng phóng theo bộ chỉnh của `hair`", () => {
    const c = styled("hair-long-blunt");
    c.pieces.hair.scale = 1.3;
    c.pieces.hair.dy = 7;
    const { slots } = figureAnchors(c, POSES.idle, v("front"));
    const over = slots.hair.box;
    const under = slots.hairBack.box;
    expect(under.w).toBeCloseTo(over.w);
    expect(under.h / over.h).toBeCloseTo(520 / 320);
    expect(under.y).toBeCloseTo(over.y);
  });

  it("góc khác chính diện chỉ vẽ một khối, khung 320 × 520", () => {
    const c = styled("hair-long-blunt");
    for (const head of ["side", "rear", "back"] as const) {
      expect(hairstyleArt("hair-long-blunt", head)?.frame).toBe("hairBack");
      const box = figureAnchors(c, POSES.idle, v(head === "back" ? "back" : "side", head)).slots
        .hair.box;
      expect(box.h / box.w).toBeCloseTo(520 / 320);
    }
  });

  it("kiểu tóc bỏ qua `hairBack` bằng bộ phận", () => {
    const c = styled("hair-bob-chin");
    expect(hairstyleArt("hair-bob-chin", "under")).toBeUndefined();
    expect(figureAnchors(c, POSES.idle, v("front")).slots.hairBack.box.h).toBeCloseTo(
      130 * 1.8 * c.pieces.hairBack.scale,
    );
  });

  it("migrate v4: cặp mái + mảng sau thành một kiểu, số căn gốc thành bộ chỉnh trung tính", () => {
    const out = migrateCharacter({
      schemaVersion: 4,
      pieces: {
        hair: { src: "part", part: "hair-f-10", dx: 0, dy: -38, scale: 0.9, widthScale: 1 },
        hairBack: { src: "part", part: "hairback-f-06" },
      },
    }) as { pieces: Record<string, Record<string, unknown>> };
    expect(out.pieces.hair).toMatchObject({ part: "hair-shoulder-blunt", scale: 1, widthScale: 1 });
    expect(out.pieces.hair.dx).toBeCloseTo(0);
    expect(out.pieces.hair.dy).toBeCloseTo(0);
    expect(out.pieces.hairBack).toMatchObject({ src: "none" });
    expect(out.pieces.hairBack.part).toBeUndefined();
  });

  it("migrate v4: nhóm mái chọn kiểu theo độ dài mảng sau", () => {
    const style = (front: string, back?: string) =>
      (
        migrateCharacter({
          schemaVersion: 4,
          pieces: {
            hair: { src: "part", part: front },
            ...(back && { hairBack: { src: "part", part: back } }),
          },
        }) as { pieces: { hair: { part: string } } }
      ).pieces.hair.part;
    expect(style("hair-f-13", "hairback-f-06")).toBe("hair-shoulder-swept");
    expect(style("hair-f-01", "hairback-f-01")).toBe("hair-long-blunt");
    expect(style("hair-f-02", "hairback-f-05")).toBe("hair-long-center");
    expect(style("hair-f-03", "hairback-f-03")).toBe("hair-low-tail");
    expect(style("hair-f-01")).toBe("hair-bob-chin");
    expect(style("hair-m-07")).toBe("hair-slick-back");
  });
});

describe("hình nghiêng của các mảnh trên người", () => {
  it("mọi bộ phận trên người đều có hình nghiêng riêng", () => {
    for (const [name, part] of Object.entries(PARTS)) {
      if (part.sockets.some((k) => k === "prop" || k === "handNear" || k === "handFar")) continue;
      expect(!!viewArt(name, "side") || !!part.drawSide, name).toBe(true);
    }
  });

  it("mũ theo góc đầu, đồ đeo cổ theo góc thân, căn chính diện không làm lệch hình nghiêng", () => {
    const c = defaultCharacter();
    Object.assign(c.pieces.crown, { src: "part", part: "crown-01" });
    Object.assign(c.pieces.neck, { src: "part", part: "khanco" });
    const before = figureAnchors(c, POSES.idle, v("side", "front"));
    c.pieces.neck.dx = 300;
    expect(figureAnchors(c, POSES.idle, v("side", "front")).slots.neck).toEqual(before.slots.neck);
    c.pieces.crown.dx = 30;
    expect(figureAnchors(c, POSES.idle, v("side", "front")).slots.crown.box.x).toBe(
      before.slots.crown.box.x + 30,
    );
    c.pieces.neck.views = { side: { dx: 7, dy: 0, scale: 1, widthScale: 1, rotate: 0 } };
    expect(figureAnchors(c, POSES.idle, v("side", "front")).slots.neck.box.x).toBe(
      before.slots.neck.box.x + 7,
    );
  });

  it("tay áo nghiêng xoay quanh vai và kéo dài theo tay vươn", () => {
    const c = defaultCharacter();
    Object.assign(c.pieces.sleeveNear, { src: "part", part: "puff", rotate: 95, scale: 3 });
    const p = structuredClone(POSES.shrug);
    const a = figureAnchors(c, p, v("side"));
    expect(a.slots.sleeveNear.frame.deg).toBe(a.frames.torso.deg - p.an[0]);
    c.pieces.sleeveNear.views = { side: { dx: 0, dy: 0, scale: 1.5, widthScale: 1, rotate: 12 } };
    const b = figureAnchors(c, p, v("side"));
    expect(b.slots.sleeveNear.frame.deg).toBe(a.slots.sleeveNear.frame.deg - 12);
    expect(b.slots.sleeveNear.box.h).toBeCloseTo(a.slots.sleeveNear.box.h * 1.5);
    p.stretch = [1, 1, 2, 2, 1, 1, 1, 1];
    expect(figureAnchors(c, p, v("side")).slots.sleeveNear.box.h).toBeGreaterThan(
      b.slots.sleeveNear.box.h,
    );
  });
});

describe("vai áo kéo theo stretch cánh tay trên", () => {
  it("chỉ đoạn gốc của đúng tay ấy đổi chiều cao hộp", () => {
    const h = (stretch: Pose["stretch"]) => {
      const { slots } = figureAnchors(C, { ...POSES.idle, stretch });
      return [slots.sleeveFar.box.h, slots.sleeveNear.box.h];
    };
    const [far, near] = h([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(h([2, 1, 1, 1, 1, 1, 1, 1])).toStrictEqual([far + C.rig.height * 62, near]);
    expect(h([1, 2, 1, 1, 1, 1, 1, 1])).toStrictEqual([far, near]);
    expect(h([1, 1, 2, 1, 1, 1, 1, 1])).toStrictEqual([far, near + C.rig.height * 62]);
    expect(h([1, 1, 1, 2, 2, 2, 2, 2])).toStrictEqual([far, near]);
  });
});

describe("`cast[].turn`", () => {
  const sculpted = CharacterSchema.parse({ pieces: { torso: { src: "sculpt" } } });

  it("đè `face.turn`, giữ nguyên object khi không khai hay trùng số", () => {
    expect(castCharacter({}, C)).toBe(C);
    expect(castCharacter({ turn: C.face.turn }, C)).toBe(C);
    const t = castCharacter({ turn: 52 }, C);
    expect(t.face.turn).toBe(52);
    expect(t.face.eyeGap).toBe(C.face.eyeGap);
    expect(castCharacter({ turn: 52 }, C)).toBe(t);
  });

  it("`turn: 52` trên đầu nửa rộng 65 là góc nghỉ ≈53°", () => {
    expect(C.head.scaleX).toBe(1);
    expect(restYaw(castCharacter({ turn: 52 }, C))).toBeCloseTo(53.13, 1);
  });

  it("`anchorAt` đo đúng nhân vật đã đè, và `front` không đổi theo `turn`", () => {
    const rt = run({
      duration: 1,
      cast: [
        { id: "a", view: "quarter" },
        { id: "b", view: "quarter", turn: 52 },
        { id: "c", view: "front" },
        { id: "d", view: "front", turn: 52 },
      ],
    });
    const at = (id: string, name: "shoulderNear" | "eyeNear" | "hip") =>
      anchorAt(rt, id, name, 0, sculpted);
    const want = figureAnchors(castCharacter({ turn: 52 }, sculpted), POSES.idle, QUARTER);
    expect(at("b", "shoulderNear").x).not.toBeCloseTo(at("a", "shoulderNear").x, 1);
    expect(at("b", "eyeNear").x).not.toBeCloseTo(at("a", "eyeNear").x, 1);
    expect(Math.abs(at("b", "shoulderNear").x - at("b", "hip").x)).toBeCloseTo(
      Math.abs(want.joints.shoulderNear.frame.x - want.joints.hip.frame.x),
      6,
    );
    expect(at("d", "shoulderNear")).toStrictEqual(at("c", "shoulderNear"));
    expect(at("d", "eyeNear")).toStrictEqual(at("c", "eyeNear"));
  });

  it("JSON đời 19 lên mới, thiếu `turn` là theo nhân vật", () => {
    const data = parsed({ schemaVersion: 19, cast: [{ id: "a" }] });
    expect(data.schemaVersion).toBe(SCENE_VERSION);
    expect(data.cast[0].turn).toBeUndefined();
  });
});
