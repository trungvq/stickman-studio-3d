import { readFileSync, readdirSync } from "node:fs";
import {
  D,
  actJoints,
  actionStride,
  body3,
  defaultCharacter,
  facing,
  dirOf,
  parseAction,
  parseCharacter,
  parseHeldItem,
  parseScene,
  project,
  resolveScene,
  sceneAt,
  type ActionData,
  type V3,
  PARTNER_AT,
  PREVIEW_ANGLES,
  PREVIEW_SEAT,
  previewItems,
  previewLens,
  previewScene,
  previewStage,
} from "@stickman3d/rig/core";
import { describe, expect, it } from "vitest";

const dir = new URL("../../../common/actions/", import.meta.url);
const actions: Record<string, ActionData> = {};
for (const f of readdirSync(dir).filter((f) => f !== "index.json")) {
  const r = parseAction(JSON.parse(readFileSync(new URL(f, dir), "utf8")));
  if (!r.success) throw new Error(`${f}: ${r.error.message}`);
  actions[f.replace(/\.json$/, "")] = r.data;
}
// Hành động chỉ đầu không khai `preview`: nền suy theo mặc định
actions.nod = parseAction({ ...actions["nod-3d"], name: "nod", preview: undefined }).data!;
const c = defaultCharacter();
const h = c.rig.height;
const dims = body3(c);
const has = (n: string) => n in actions;
const heldDir = new URL("../../../common/held/", import.meta.url);
const held = Object.fromEntries(
  readdirSync(heldDir).map((f) => [
    f.replace(/\.json$/, ""),
    parseHeldItem(JSON.parse(readFileSync(new URL(f, heldDir), "utf8"))).data!,
  ]),
);

const run = (scene: unknown, acts = actions) => {
  const p = parseScene(scene);
  if (!p.success) throw new Error(p.error.message);
  const ids = p.data.cast.map((m) => m.id);
  return resolveScene(
    p.data,
    acts,
    Object.fromEntries(ids.map((i) => [i, h])),
    Object.fromEntries(ids.map((i) => [i, dims])),
    held,
  );
};
const at = (rt: ReturnType<typeof run>, t: number) => sceneAt(rt, "a", t, h, dims);
const staged = (name: string, stage: string) =>
  parseAction({ ...actions[name], preview: { stage } }).data!;

describe("previewScene", () => {
  it("mọi hành động của lớp chung qua parseScene → resolveScene → sceneAt không ném", () => {
    const people = Object.entries(actions);
    expect(people.length).toBeGreaterThan(50);
    for (const [name, a] of people)
      for (const angle of ["near", "back"] as const) {
        const s = previewScene(name, a, undefined, { angle, height: h, has });
        const rt = run(s);
        for (const t of [0, s.duration / 2, s.duration]) expect(at(rt, t).world).toBeDefined();
      }
  });

  it("`wrap` lặp đủ lượt, `hold` phát một lượt rồi giữ 1 s", () => {
    const nod = actions.nod;
    const s = previewScene("nod", nod, "x.json", { has });
    expect(s.cast[0].character).toBe("x.json");
    if (nod.end === "wrap")
      expect(s.duration / nod.duration).toBeCloseTo(Math.round(s.duration / nod.duration), 9);
    const held = parseAction({ ...nod, end: "hold" }).data!;
    expect(previewScene("nod", held, undefined, { has }).duration).toBeCloseTo(
      held.duration + 1,
      9,
    );
  });

  it("nền theo `stage`, `preview.base` đè, nền thiếu thì bỏ track nền", () => {
    const base = (s: ReturnType<typeof previewScene>) =>
      s.cast[0].tracks.find((t) => t.name === "base")?.clips.map((c) => c.action);
    expect(base(previewScene("nod", actions.nod, undefined, { has }))).toEqual(["stand-3d"]);
    expect(base(previewScene("nod", staged("nod", "chair"), undefined, { has }))).toEqual([
      "sit-3d",
    ]);
    expect(
      base(previewScene("nod", staged("nod", "floor"), undefined, { has: () => false })),
    ).toBeUndefined();
    expect(base(previewScene("nod", staged("nod", "floor"), undefined))).toEqual(["seiza-3d"]);
    const own = parseAction({ ...actions.nod, preview: { base: "sit-3d-staggered" } }).data!;
    expect(base(previewScene("nod", own, undefined, { has }))).toEqual(["sit-3d-staggered"]);
    expect(base(previewScene("stand-3d", actions["stand-3d"], undefined, { has }))).toBeUndefined();
    expect(previewStage("talk-beat-seated-3d", actions["talk-beat-seated-3d"])).toBe("chair");
    expect(previewStage("sit-3d", actions["sit-3d"])).toBe("chair");
    expect(previewStage("nod", actions.nod)).toBe("stand");
  });

  it("ghế: hông trên mặt ghế, bàn chân `sit-3d` chạm sàn; sàn: hông thấp hơn", () => {
    const chair = at(
      run(previewScene("nod", staged("nod", "chair"), undefined, { height: h, has })),
      0.5,
    );
    expect(chair.world!.hip[1]).toBeCloseTo(-PREVIEW_SEAT.chair * h - dims.legHalf, 6);
    const floor = at(
      run(previewScene("nod", staged("nod", "floor"), undefined, { height: h, has })),
      0.5,
    );
    expect(floor.world!.hip[1]).toBeCloseTo(-PREVIEW_SEAT.floor * h - dims.legHalf, 6);
  });

  it("`sit-down` đi từ chỗ đứng trước ghế tới mặt ghế, `stand-up` ngược lại", () => {
    const a = staged("nod", "sit-down");
    const s = previewScene("nod", a, undefined, { height: h, has });
    expect(s.cast[0].tracks[0].clips.map((c) => c.action)).toEqual(["stand-3d", "sit-3d"]);
    const rt = run(s);
    const end = at(rt, s.duration).world!.hip;
    expect(end[1]).toBeCloseTo(-PREVIEW_SEAT.chair * h - dims.legHalf, 6);
    expect(Math.hypot(end[0], end[2])).toBeLessThan(1e-6);
    const start = at(rt, 0).world!.hip;
    expect(start[2]).toBeLessThan(-50);
    const up = previewScene("nod", staged("nod", "stand-up"), undefined, { height: h, has });
    expect(up.cast[0].tracks[0].clips.map((c) => c.action)).toEqual(["sit-3d", "stand-3d"]);
    const rt2 = run(up);
    expect(at(rt2, 0).world!.seated).toBe(true);
    expect(at(rt2, up.duration).world!.seated).toBeFalsy();
  });

  it("ghế bành, bàn: người ngồi yên trên mặt ghế như `chair`, nền `sit-3d`", () => {
    for (const stage of ["armchair", "desk"]) {
      const s = previewScene("nod", staged("nod", stage), undefined, { height: h, has });
      expect(s.cast[0].tracks[0].clips[0].action).toBe("sit-3d");
      expect(at(run(s), 0.5).world!.hip[1]).toBeCloseTo(-PREVIEW_SEAT.chair * h - dims.legHalf, 6);
    }
  });

  it("`preview.path` thành `world.path` quanh gốc theo hướng mặt, máy theo chỗ hông cao nhất", () => {
    const path = [
      { t: 0, at: [0, 20], sit: true },
      { t: 1, at: [70, 100], sit: true, ease: true },
    ];
    const a = parseAction({ ...actions.nod, preview: { stage: "floor", path } }).data!;
    const s = previewScene("nod", a, undefined, { height: h, yaw: 90, has });
    const w = s.cast[0].world as { path: { t: number; at: V3; sit?: boolean; ease?: boolean }[] };
    expect(w.path).toHaveLength(2);
    expect(w.path[1].at[0]).toBeCloseTo(0, 6);
    expect(w.path[1].at[1]).toBeCloseTo(-100 * h, 6);
    expect(w.path[1].at[2]).toBeCloseTo(-70 * h, 6);
    expect(w.path[1]).toMatchObject({ t: 1, sit: true, ease: true });
    const low = previewScene("nod", staged("nod", "floor"), undefined, { height: h, has });
    expect(s.lens.eye[1]).toBeLessThan(low.lens.eye[1]);
    expect(parseAction({ ...actions.nod, preview: { path: [path[1], path[0]] } }).success).toBe(
      false,
    );
  });

  it("góc máy: `near` 3/4 phía tay phải, `far` 3/4 phía tay trái, `front` nhìn thẳng, `back` sau lưng, `side` nghiêng", () => {
    const theta = (angle: (typeof PREVIEW_ANGLES)[number], yaw = 90) => {
      const s = previewScene("nod", actions.nod, undefined, { angle, yaw, has });
      const L = previewLens(s, 0);
      return facing({ ...L, yaw: L.yaw * D, pitch: L.pitch * D }, [0, 0, 0], yaw * D);
    };
    for (const yaw of [0, 90, 200]) {
      expect(theta("front", yaw).theta).toBeCloseTo(0, 4);
      expect(theta("back", yaw).theta).toBeCloseTo(180, 4);
      expect(theta("side", yaw).theta).toBeCloseTo(90, 4);
      expect(theta("near", yaw)).toMatchObject({ flip: false, theta: expect.closeTo(45, 4) });
      expect(theta("far", yaw)).toMatchObject({ flip: true, theta: expect.closeTo(45, 4) });
    }
  });

  it("hành động `gen` có sải chân đi thẳng ở tốc độ tự nhiên, máy bám hông", () => {
    for (const name of ["walk", "walk-short", "run-3d"]) {
      const a = actions[name];
      const s = previewScene(name, a, undefined, { height: h, has, yaw: 30 });
      const path = (s.cast[0].world as { path: { t: number; at: number[] }[] }).path;
      const last = path[path.length - 1];
      const speed = Math.hypot(last.at[0], last.at[2]) / last.t;
      expect(speed).toBeCloseTo((Math.abs(actionStride(a)) * h) / a.duration, 6);
      const rt = run(s);
      const t = s.duration * 0.75;
      const hip = at(rt, t).world!.hip;
      const L0 = previewLens(s, 0);
      const L = previewLens(s, t);
      // hông so với mắt gần như lúc đầu
      expect(
        Math.hypot(hip[0] - L.eye[0] - (0 - L0.eye[0]), hip[2] - L.eye[2] - (0 - L0.eye[2])),
      ).toBeLessThan(40);
    }
    const nod = previewScene("nod", actions.nod, undefined, { has });
    expect(nod.cast[0].world).toMatchObject({ at: [0, 0, 0] });
  });

  it("bước theo `preview.path` đứng: hoà vào clip, thả về nền khi hết lượt, hông tới đúng mốc cuối", () => {
    for (const name of ["steps-3d", "steps-back-3d"]) {
      const a = actions[name];
      const s = previewScene(name, a, undefined, { height: h, has, yaw: 90 });
      const track = s.cast[0].tracks.find((t) => t.name === "action")!;
      expect(track.clips).toEqual([
        { action: name, start: 0, blend: 0.1 },
        { start: a.duration, blend: 0.1 },
      ]);
      const rt = run(s);
      const go = -actionStride(a) * h;
      for (const t of [a.duration, s.duration]) {
        const hip = at(rt, t).world!.hip;
        expect(Math.abs(hip[0])).toBeLessThan(1);
        expect(Math.abs(hip[2] - go)).toBeLessThan(6);
      }
    }
    const squat = previewScene("squat-3d", actions["squat-3d"], undefined, { height: h, has });
    expect(squat.cast[0].tracks.find((t) => t.name === "action")!.clips).toHaveLength(1);
  });
});

describe("previewScene: món cầm và người thứ hai", () => {
  const withPreview = (preview: unknown, name = "nod") =>
    parseAction({ ...actions[name], preview }).data!;
  const runAll = (scene: unknown) => {
    const p = parseScene(scene);
    if (!p.success) throw new Error(p.error.message);
    const ids = p.data.cast.map((m) => m.id);
    return resolveScene(
      p.data,
      actions,
      Object.fromEntries(ids.map((i) => [i, h])),
      Object.fromEntries(ids.map((i) => [i, dims])),
      held,
    );
  };

  it("`preview.hold` thành mốc `world.hands` giây 0 của người diễn, ở mọi `stage`", () => {
    const hold = { right: "coc@cylinder", left: { item: "tui", group: "carry", on: "elbow" } };
    for (const stage of ["stand", "chair", "floor", "sit-down", "stand-up", "counter"]) {
      const s = previewScene("nod", withPreview({ stage, hold }), undefined, { height: h, has });
      expect(s.cast[0].world.hands).toEqual([
        { t: 0, right: { hold: "coc@cylinder" }, left: { hold: hold.left } },
      ]);
      const rt = runAll(s);
      for (const t of [0, s.duration]) expect(at(rt, t).world).toBeDefined();
    }
    const one = previewScene("nod", withPreview({ hold: { left: "coc@cylinder" } }), undefined);
    expect(one.cast[0].world.hands).toEqual([{ t: 0, left: { hold: "coc@cylinder" } }]);
    expect(previewScene("nod", actions.nod, undefined).cast[0].world.hands).toBeUndefined();
  });

  it("`previewItems` kể món theo tên thể hiện, file `held/` là tên trần", () => {
    const s = previewScene(
      "nod",
      withPreview({ hold: { right: "coc:2@cylinder", left: { item: "tui", group: "carry" } } }),
      undefined,
    );
    expect(previewItems(s)).toEqual([
      { item: "coc:2", file: "coc" },
      { item: "tui", file: "tui" },
    ]);
    expect(previewItems(previewScene("nod", actions.nod, undefined))).toEqual([]);
  });

  it("`partner.hold` thành mốc `world.hands` giây 0 của người kia, `previewItems` kể cả món ấy", () => {
    const s = previewScene(
      "nod",
      withPreview({ partner: { hold: { right: "coc@cylinder" } } }),
      undefined,
      { height: h, has },
    );
    expect(s.cast[1].world.hands).toEqual([{ t: 0, right: { hold: "coc@cylinder" } }]);
    expect(s.cast[0].world.hands).toBeUndefined();
    expect(previewItems(s)).toEqual([{ item: "coc", file: "coc" }]);
    for (const t of [0, s.duration])
      expect(sceneAt(runAll(s), "b", t, h, dims).world).toBeDefined();
  });

  it("món không có trong `held/` thì `resolveScene` báo lỗi", () => {
    const s = previewScene("nod", withPreview({ hold: { right: "khong-co@handle" } }), undefined);
    expect(() => runAll(s)).toThrow(/khong-co/);
  });

  for (const yaw of [0, 90, 200])
    it(`người thứ hai đứng ở \`at\` theo hướng mặt và nhìn vào người diễn (yaw ${yaw})`, () => {
      const fwd = dirOf(yaw * D);
      const right = dirOf((yaw + 90) * D);
      for (const [p, ahead, side] of [
        [{}, PARTNER_AT[0], PARTNER_AT[1]],
        [{ at: [120, 90] }, 120, 90],
        [{ at: [0, -130], action: "nod" }, 0, -130],
      ] as const) {
        const s = previewScene("nod", withPreview({ partner: p }), "x.json", {
          height: h,
          yaw,
          has,
          partner: "y.json",
        });
        expect(s.cast.map((m) => [m.id, m.character])).toEqual([
          ["a", "x.json"],
          ["b", "y.json"],
        ]);
        const b = s.cast[1];
        const want = [0, 2].map((i) => (fwd[i] * ahead + right[i] * side) * h);
        const w = b.world as { at: number[]; yaw: number };
        expect(w.at[0]).toBeCloseTo(want[0], 6);
        expect(w.at[2]).toBeCloseTo(want[1], 6);
        const look = dirOf(w.yaw * D);
        const n = Math.hypot(w.at[0], w.at[2]);
        expect((-w.at[0] * look[0] - w.at[2] * look[2]) / n).toBeCloseTo(1, 6);
        expect(b.tracks.map((t) => t.clips[0].action)).toEqual(
          "action" in p ? ["stand-3d", "nod"] : ["stand-3d"],
        );
        const rt = runAll(s);
        const hip = sceneAt(rt, "b", 0.5, h, dims).world!.hip;
        expect(Math.hypot(hip[0] - w.at[0], hip[2] - w.at[2])).toBeLessThan(20);
        // máy nhìn vào giữa hai người ở mọi góc
        for (const angle of PREVIEW_ANGLES) {
          const L = previewLens(
            previewScene("nod", withPreview({ partner: p }), "x.json", {
              angle,
              height: h,
              yaw,
              has,
            }),
            0,
          );
          const [x] = project({ ...L, yaw: L.yaw * D, pitch: L.pitch * D }, [
            w.at[0] / 2,
            L.eye[1],
            w.at[2] / 2,
          ]);
          expect(Math.abs(x)).toBeLessThan(1e-6);
        }
      }
      const turned = previewScene("nod", withPreview({ partner: { yaw: 20 } }), undefined, { yaw });
      const base = previewScene("nod", withPreview({ partner: {} }), undefined, { yaw });
      expect((turned.cast[1].world as { yaw: number }).yaw).toBeCloseTo(
        (base.cast[1].world as { yaw: number }).yaw + 20,
        9,
      );
    });

  it("người thứ hai đứng giữa máy và người diễn thì ẩn (`fade`), góc khác thì hiện", () => {
    const hidden = (partner: unknown, angle: (typeof PREVIEW_ANGLES)[number], yaw = 90) =>
      !!previewScene("nod", withPreview({ partner }), undefined, { angle, yaw, has }).cast[1].fade;
    for (const yaw of [0, 90, 200]) {
      expect(hidden({}, "front", yaw)).toBe(true);
      expect(PREVIEW_ANGLES.filter((g) => g !== "front").map((g) => hidden({}, g, yaw))).toEqual([
        false,
        false,
        false,
        false,
      ]);
      expect(hidden({ at: [0, 100] }, "side", yaw)).toBe(true);
      expect(hidden({ at: [0, -100] }, "side", yaw)).toBe(false);
      expect(hidden({ at: [0, -100] }, "front", yaw)).toBe(false);
    }
    const s = previewScene("nod", withPreview({ partner: {} }), "x.json", {
      angle: "front",
      has,
      partner: "y.json",
    });
    expect(sceneAt(runAll(s), "b", 0.5, h, dims).opacity).toBe(0);
  });

  it("không `partner` thì chỉ có người diễn; `partner.action` thiếu thì chỉ đứng nền", () => {
    expect(previewScene("nod", actions.nod, undefined).cast).toHaveLength(1);
    const s = previewScene("nod", withPreview({ partner: { action: "khong-co" } }), undefined, {
      has,
    });
    expect(s.cast[1].tracks.map((t) => t.clips[0].action)).toEqual(["stand-3d"]);
  });

  it("góc Trước có người kia đứng bên: người diễn không lật, máy vẫn nhìn vào giữa hai người", () => {
    for (const side of [180, -180]) {
      const s = previewScene("nod", withPreview({ partner: { at: [0, side] } }), undefined, {
        angle: "front",
      });
      const at = s.cast[1].world.at as [number, number, number];
      expect(facing(s.lens, [0, 0, 0], 90 * D).flip).toBe(false);
      const [dx, dz] = [at[0] / 2 - s.lens.eye[0], at[2] / 2 - s.lens.eye[2]];
      expect(Math.atan2(dx, dz) / D).toBeCloseTo(s.lens.yaw);
    }
  });

  it("`partnerHeight` thu phóng người kia cho cao bằng người diễn", () => {
    const scene = (o: { height?: number; partnerHeight?: number }) =>
      previewScene("nod", withPreview({ partner: {} }), "x.json", { partner: "y.json", ...o });
    expect(scene({ height: 0.95, partnerHeight: 1.06 }).cast[1].world.s).toBeCloseTo(0.95 / 1.06);
    expect(scene({ height: 1.06, partnerHeight: 1.06 }).cast[1].world.s).toBeUndefined();
    expect(scene({ height: 0.95 }).cast[1].world.s).toBeUndefined();
  });
});

describe("hành động dời hông của lớp chung trên cảnh xem thử", () => {
  // mốc ngồi đặt hông trên mặt ngồi nửa bề dày đùi: số của `tools/actions/seat.mjs` tính cho người mẫu chung
  const man = parseCharacter(
    JSON.parse(
      readFileSync(new URL("../../../common/characters/sample-man.json", import.meta.url), "utf8"),
    ),
  ).data!;
  const mh = man.rig.height;
  const mdims = body3(man);
  /** Khớp `joint` thế giới ở các giây của một lượt (cả lúc giữ sau đó) */
  const track = (name: string, joint: string, from = 0, to = 1) => {
    const s = previewScene(name, actions[name], undefined, { height: mh, has });
    const p = parseScene(s);
    if (!p.success) throw new Error(p.error.message);
    const rt = resolveScene(p.data, actions, { a: mh }, { a: mdims });
    const d = actions[name].duration;
    const out: V3[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = d * (from + ((to - from) * i) / 40);
      out.push(actJoints(man, sceneAt(rt, "a", t, mh, mdims))![joint as "footR"] as V3);
    }
    return out;
  };
  const spread = (ps: V3[], axes = [0, 1, 2]) =>
    Math.max(
      ...axes.map((k) => Math.max(...ps.map((p) => p[k])) - Math.min(...ps.map((p) => p[k]))),
    );

  it("ngồi xuống, đứng dậy ghế bành: bàn chân đứng yên trên sàn, không nhảy lúc đổi đứng ↔ ngồi", () => {
    for (const name of ["sit-down-3d", "stand-up-3d"])
      for (const foot of ["footR", "footL"]) {
        const ps = track(name, foot);
        expect(spread(ps, [0, 2])).toBeLessThan(1.5);
        ps.slice(1).forEach((p, i) => expect(Math.abs(p[1] - ps[i][1])).toBeLessThan(1));
      }
  });

  it("nhổm khỏi seiza, hạ về: gối và cổ chân nằm yên trên đệm", () => {
    for (const name of ["kneel-up-3d", "kneel-up-out-3d"])
      for (const j of ["kneeR", "footR", "kneeL", "footL"])
        expect(spread(track(name, j))).toBeLessThan(3);
  });

  it("đứng dậy từ seiza: gối xa nằm yên tới lúc rời đệm, bàn chân gần đứng yên sau khi bước", () => {
    expect(spread(track("seiza-stand-3d", "kneeL", 0, 0.6))).toBeLessThan(3);
    expect(spread(track("seiza-stand-3d", "footR", 0.6, 1))).toBeLessThan(3);
  });

  it("ngồi xổm, quỳ một gối: bàn chân trụ đứng yên", () => {
    for (const foot of ["footR", "footL"])
      expect(spread(track("squat-3d", foot), [0, 2])).toBeLessThan(1.5);
    expect(spread(track("kneel-3d", "footL"), [0, 2])).toBeLessThan(1.5);
  });
});
