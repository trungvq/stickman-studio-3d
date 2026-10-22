import assert from "node:assert/strict";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as rig from "@stickman3d/sketch";
import { loadScene, renderFrames } from "./lib.mjs";
import {
  BONE_SEGS,
  jointSampler,
  motionData,
  motionOverlay,
  motionText,
  TRAIL_EVENT,
  trailEvents,
  trailJoints,
} from "./trails.mjs";
import {
  floorGrid,
  GRID_STEP,
  skeletonData,
  skeletonOverlay,
  solidBoxes,
  topView,
} from "./skeleton.mjs";

const ACTIONS = resolve(import.meta.dirname, "../../apps/studio/public/actions");
const SCENE = rig.parseScene({
  name: "vet",
  lens: { eye: [0, -423, -1057], yaw: 0, pitch: 16, f: 800, cx: 0, cy: 120 },
  cast: [
    {
      id: "a",
      world: { at: [0, 0, 0], yaw: 40 },
      tracks: [
        {
          clips: [
            { action: "stand-3d", start: 0 },
            { action: "step-side-3d", start: 0.5, blend: 0.2 },
            { action: "talk-forward-3d", start: 1.5, blend: 0.3 },
          ],
        },
      ],
    },
    { id: "phang", tracks: [{ clips: [{ action: "stand-3d", start: 0 }] }] },
  ],
}).data;
const { rt } = loadScene(SCENE, [ACTIONS], []);
const character = rig.defaultCharacter();
const sampler = () => jointSampler(rt, () => character);
const markup = (el) => (el ? renderToStaticMarkup(el) : "");
const count = (s, attr) => s.split(attr).length - 1;

describe("vệt khớp", () => {
  it("lấy đủ số khung trong t ± span theo fps", () => {
    const [p] = motionData(rt, { t: 1, sampler: sampler(), trails: "hands", span: 0.5, fps: 10 });
    assert.deepEqual(
      p.lines.map((l) => l.joint),
      ["wristR", "wristL"],
    );
    for (const l of p.lines) {
      assert.equal(l.pts.length, 11);
      assert.deepEqual(
        l.pts.map((q) => q.t),
        [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => i / 10),
      );
    }
  });

  it("kẹp cửa sổ vào đầu và cuối cảnh", () => {
    const [p] = motionData(rt, { t: 0.2, sampler: sampler(), trails: "head", span: 1, fps: 10 });
    assert.equal(p.lines[0].pts[0].t, 0);
    assert.equal(p.lines[0].pts.length, 13);
  });

  it("toạ độ trùng phép chiếu khớp của đo giật", () => {
    const [p] = motionData(rt, { t: 1, sampler: sampler(), trails: "all,hip", span: 0.2, fps: 10 });
    const c = rig.castCharacter(rt.cast[0], character);
    for (const l of p.lines)
      for (const q of l.pts) {
        const sp = rig.sceneAt(rt, "a", q.t, c.rig.height, rig.body3(c));
        const J = rig.actJoints(c, sp);
        const [x, y] = rig.project(sp.world.lens, J[l.joint]);
        assert.ok(Math.abs(q.x - x) < 1e-9 && Math.abs(q.y - y) < 1e-9, `${l.joint} @ ${q.t}`);
        assert.deepEqual(rig.stageJoints(c, sp).pts[l.joint], [x, y]);
      }
    assert.equal(p.lines.length, rig.SNAP_JOINTS_3D.length + 1);
  });

  it("relative trừ phần dời của hông so với khung hiện tại", () => {
    const [p] = motionData(rt, {
      t: 1,
      sampler: sampler(),
      trails: "hip",
      span: 0.5,
      fps: 10,
      relative: true,
    });
    for (const q of p.lines[0].pts) {
      assert.ok(Math.abs(q.x - p.lines[0].now.x) < 1e-9);
      assert.ok(Math.abs(q.y - p.lines[0].now.y) < 1e-9);
    }
  });

  it("từ khoá ra khớp người 3D, tên lạ hay tên khớp 2D thì báo", () => {
    assert.deepEqual(trailJoints("feet,head"), ["footR", "footL", "head"]);
    assert.deepEqual(trailJoints("hands,hip"), ["wristR", "wristL", "hip"]);
    assert.throws(() => trailJoints("elbow"), /khớp lạ/);
    assert.throws(() => trailJoints("footN"), /khớp lạ/);
  });

  it("người không có world thì bỏ, kèm cảnh báo", () => {
    const s = sampler();
    assert.deepEqual(s.ids, ["a"]);
    assert.equal(s.warnings.length, 1);
    assert.match(s.warnings[0], /`phang`.*thiếu `world`/);
    const d = motionData(rt, { t: 1, sampler: s, trails: "feet" });
    assert.deepEqual(
      d.map((p) => p.id),
      ["a"],
    );
  });

  it("không bật gì thì không có lớp phủ", () => {
    const d = motionData(rt, { t: 1, sampler: sampler() });
    assert.equal(motionOverlay(d, 1, 4), null);
  });

  it("ghosts sinh n nhóm nét mỗi phía, trước nét đứt, sau nét liền", () => {
    const d = motionData(rt, { t: 1, sampler: sampler(), ghosts: 3, ghostStep: 0.1 });
    const s = markup(motionOverlay(d, 1, 4));
    assert.equal(count(s, "data-ghost="), 6);
    assert.equal(count(s, "stroke-dasharray="), 3);
    assert.equal(count(s, "<line"), 6 * 14);
    assert.equal(count(s, "data-trail="), 0);
  });

  it("vệt mỗi khớp một nhóm, mỗi khung một chấm, vòng ở khung của ô", () => {
    const d = motionData(rt, { t: 1, sampler: sampler(), trails: "feet", span: 0.5, fps: 10 });
    const s = markup(motionOverlay(d, 1, 4, { fps: 10 }));
    assert.equal(count(s, "data-trail="), 2);
    // khớp gần đứng yên chỉ còn vòng khung của ô
    const moving = d[0].lines.filter((l) => l.run * 10 >= TRAIL_EVENT.still).length;
    assert.ok(moving >= 1);
    assert.equal(count(s, "data-frame="), moving * 11);
    assert.equal(count(s, "data-now="), 2);
    const now = d[0].lines[0].now;
    assert.ok(s.includes(`data-now="" cx="${+now.x.toFixed(2)}" cy="${+now.y.toFixed(2)}"`));
    // đuôi mảnh, đầu mập: chấm sau to hơn chấm trước
    const r = [...s.matchAll(/data-frame="[\d.]+" cx="[-\d.]+" cy="[-\d.]+" r="([\d.]+)"/g)].map(
      (m) => +m[1],
    );
    assert.ok(r[10] > r[0]);
  });
});

describe("que xương", () => {
  it("mỗi người đủ đoạn xương, toạ độ trùng stageJoints ở cùng t", () => {
    const c = rig.castCharacter(rt.cast[0], character);
    for (const t of [0, 0.8, 1.7]) {
      const [p] = skeletonData(rt, { t, sampler: sampler() });
      assert.equal(p.segs.length, 14);
      assert.equal(BONE_SEGS.length, 14);
      const J = rig.stageJoints(c, rig.sceneAt(rt, "a", t, c.rig.height, rig.body3(c)));
      for (const g of p.segs) {
        assert.deepEqual([g.x1, g.y1], J.pts[g.ja]);
        assert.deepEqual([g.x2, g.y2], J.pts[g.jb]);
        assert.ok(Math.abs(g.depth - (J.depth[g.ja] + J.depth[g.jb]) / 2) < 1e-9);
        assert.ok(g.rel >= -1 && g.rel <= 1);
      }
      for (let i = 1; i < p.segs.length; i++) assert.ok(p.segs[i - 1].depth >= p.segs[i].depth);
    }
  });

  it("hai bên giải phẫu hai màu, đoạn gần ống kính nét to hơn", () => {
    const d = skeletonData(rt, { t: 1, sampler: sampler() });
    const s = markup(skeletonOverlay(d, 4));
    assert.equal(count(s, "data-bone="), 14);
    const width = (g) =>
      Number(new RegExp(`data-bone="${g.ja}-${g.jb}"[^>]*stroke-width="([\\d.]+)"`).exec(s)[1]);
    const byRel = d[0].segs.toSorted((a, b) => a.rel - b.rel);
    const [far, near] = [byRel[0], byRel.at(-1)];
    assert.ok(near.rel > far.rel);
    assert.ok(width(near) > width(far));
    const colors = new Set(d[0].segs.filter((g) => g.side !== "C").map((g) => g.side));
    assert.deepEqual([...colors].sort(), ["L", "R"]);
    assert.ok(s.includes('stroke="#c2185b"') && s.includes('stroke="#00838f"'));
  });

  it("lưới sàn nằm trên sàn của cảnh và chiếu đúng qua lens", () => {
    const grid = floorGrid(rt);
    assert.ok(grid.length > 10);
    for (const g of grid) {
      assert.equal(g.a[1], 0);
      assert.equal(g.b[1], 0);
      assert.ok(g.a[0] % GRID_STEP === 0 || g.a[2] % GRID_STEP === 0);
      // đoạn còn trọn trước ống kính thì hai đầu là phép chiếu của chính hai điểm sàn
      if (rig.depthAt(rt.lens, g.a) > 5 && rig.depthAt(rt.lens, g.b) > 5)
        assert.deepEqual(g.p, [...rig.project(rt.lens, g.a), ...rig.project(rt.lens, g.b)]);
      // điểm khung nào trên đoạn cũng ngược về đúng đường sàn ấy
      for (const q of [
        [g.p[0], g.p[1]],
        [(g.p[0] + g.p[2]) / 2, (g.p[1] + g.p[3]) / 2],
      ]) {
        const e = rt.lens.eye;
        const ray = rig.unproject(rt.lens, q, 1000);
        const k = (0 - e[1]) / (ray[1] - e[1]);
        const hit = [e[0] + (ray[0] - e[0]) * k, e[2] + (ray[2] - e[2]) * k];
        const off = g.a[0] === g.b[0] ? hit[0] - g.a[0] : hit[1] - g.a[2];
        assert.ok(Math.abs(off) < 1e-6, `${off}`);
      }
    }
    assert.ok(grid.some((g) => g.axis === "x") && grid.some((g) => g.axis === "z"));
  });

  it("hộp đồ khối của lớp vẽ code ra mười hai cạnh trong thế giới", () => {
    const v = [
      [-40, 0, -20],
      [40, 0, -20],
      [40, 0, 20],
      [-40, 0, 20],
      [-40, -80, -20],
      [40, -80, -20],
      [40, -80, 20],
      [-40, -80, 20],
    ];
    const layer = {
      name: "ban",
      scenes: ["vet"],
      solids: () => [
        { name: "ban", at: { at: [100, 0, 50], yaw: Math.PI / 2 }, parts: [{ v, tone: {} }] },
      ],
    };
    const [b] = solidBoxes(rt, 1, { codeLayers: [layer] });
    assert.equal(b.edges.length, 12);
    assert.deepEqual(b.edges[0][0], rig.place3({ at: [100, 0, 50], yaw: Math.PI / 2 }, v[0]));
    assert.deepEqual(solidBoxes(rt, 1, { codeLayers: [{ ...layer, scenes: ["khac"] }] }), []);
  });

  it("ô nhìn từ trên vẽ que xương trên mặt x–z", () => {
    const s = markup(
      topView({
        rt,
        t: 1,
        sampler: sampler(),
        box: { x: -800, y: -450, w: 1600, h: 900 },
        fps: 10,
      }),
    );
    assert.ok(s.includes("data-top"));
    assert.equal(count(s, 'stroke="#c2185b"') > 0, true);
    assert.equal(count(s, "<polyline"), 3);
  });
});

/** Vệt tổng hợp: khớp đi theo `x(t)` trên trục ngang, mỗi khung `1/fps`, `v` px mỗi khung như `motionData` */
const synth = (x, { fps = 30, dur = 2 } = {}) => {
  const pts = [];
  for (let i = 0; i <= Math.round(dur * fps); i++) {
    const t = i / fps;
    const p = { t, x: x(t), y: 0.3 * x(t), k: 1 };
    const q = pts[i - 1];
    p.v = q ? Math.hypot(p.x - q.x, p.y - q.y) : NaN;
    pts.push(p);
  }
  return pts;
};
const ease = (a, b, s) => {
  const u = Math.min(1, Math.max(0, s));
  return a + (b - a) * u * u * (3 - 2 * u);
};
const kinds = (r) => r.events.map((e) => e.kind);

describe("sự kiện trên vệt", () => {
  it("chuyển động trơn không báo gì", () => {
    // một quãng dài êm, rồi về êm: vận tốc liền, hai đầu từ nghỉ
    const smooth = synth((t) =>
      t < 1.2 ? ease(0, 600, t / 1.2) : ease(600, 200, (t - 1.2) / 0.8),
    );
    assert.deepEqual(kinds(trailEvents(smooth, { fps: 30, joint: "wristR" })), []);
  });

  it("bắt đúng một khựng giữa đoạn đang đi tiếp", () => {
    // đi 0 → 300 trong 0.6 s, gần đứng 0.25 s, đi tiếp 305 → 600 cùng chiều
    const x = (t) =>
      t < 0.6
        ? ease(0, 300, t / 0.6)
        : t < 0.85
          ? ease(300, 305, (t - 0.6) / 0.25)
          : ease(305, 600, (t - 0.85) / 0.6);
    const r = trailEvents(synth(x, { dur: 1.8 }), { fps: 30, joint: "wristR" });
    assert.deepEqual(kinds(r), ["hitch"]);
    const [h] = r.events;
    assert.ok(h.t >= 0.5 && h.t <= 0.65 && h.end >= 0.8 && h.end <= 0.95, `${h.t}→${h.end}`);
  });

  it("dừng rồi quay lại không phải khựng; nội suy linear là vào gắt, dừng gắt", () => {
    const back = synth((t) => (t < 0.8 ? ease(0, 400, t / 0.8) : ease(400, 0, (t - 1) / 0.8)));
    assert.deepEqual(kinds(trailEvents(back, { fps: 30, joint: "wristR" })), []);
    const lin = synth((t) => 500 * Math.min(1, Math.max(0, (t - 0.3) / 0.9)));
    assert.deepEqual(kinds(trailEvents(lin, { fps: 30, joint: "wristR" })), ["start", "stop"]);
  });

  it("giật lấy từ sceneSnaps của khớp ấy; quanh nó không báo quay gắt hay gắt", () => {
    const base = (t) => ease(0, 500, t / 2);
    const spiked = synth((t) => base(t) + (Math.abs(t - 1) < 1e-6 ? 150 : 0));
    const snaps = [{ t: 1 + 1 / 30, joint: "wristR", also: [], px: 150, base: 8 }];
    const r = trailEvents(spiked, { fps: 30, joint: "wristR", snaps });
    assert.deepEqual(kinds(r), ["jerk"]);
    assert.ok(r.events[0].px > 100);
    // giật của khớp khác không tính cho vệt này
    assert.deepEqual(
      kinds(trailEvents(spiked, { fps: 30, joint: "wristL", snaps })).includes("jerk"),
      false,
    );
    assert.ok(r.run < 30, "bước giật không thành tốc độ chạy");
  });

  it("khớp gần đứng yên chỉ xét giật", () => {
    const slow = synth((t) => ease(0, (TRAIL_EVENT.still / 30) * 5, t / 2));
    assert.deepEqual(kinds(trailEvents(slow, { fps: 30, joint: "wristR" })), []);
  });
});

describe("đọc vệt trên cảnh thật", () => {
  const dir = mkdtempSync(join(tmpdir(), "vet-"));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const D = 3.4;
  const key = (s, arm) => ({ t: +(s / D).toFixed(5), pose: { armNear: arm }, ease: "auto" });
  const keys = [
    key(0, [-6, 24, 0, 0, 0]),
    key(0.35, [-3, 40, 0, 38, 45]),
    key(0.95, [0, 60, 0, 80, 90]),
    key(1.25, [0, 40, 0, 80, 90]),
    key(1.55, [0, 75, 0, 80, 90]),
    key(1.85, [0, 40, 0, 80, 90]),
    key(2.45, [0, 60, 0, 80, 90]),
    key(3.4, [-6, 24, 0, 0, 0]),
  ];
  const action = (name, list) => ({
    schemaVersion: rig.ACTION_VERSION,
    name,
    duration: D,
    end: "hold",
    authoredAt: "side",
    mask: ["armNear"],
    keys: list,
    events: [],
  });
  const smooth = rig.parseAction(action("tron", keys)).data;
  const at = (s) => rig.actionPose(smooth, s / D).an;
  const spike = at(2.8 + 1 / 30);
  spike[3] += 35;
  // khựng: hai mốc gần trùng tư thế cách 0.25 s giữa đường giơ tay; giật: một mốc lệch chỉ một khung
  const bad = [
    ...keys.slice(0, 2),
    key(0.6, [-3, 41, 0, 40, 46]),
    ...keys.slice(2, 7),
    key(2.8, at(2.8)),
    key(2.8 + 1 / 30, spike),
    key(2.8 + 2 / 30, at(2.8 + 2 / 30)),
    keys[7],
  ];
  writeFileSync(join(dir, "tron.json"), JSON.stringify(action("tron", keys)));
  writeFileSync(join(dir, "loi.json"), JSON.stringify(action("loi", bad)));
  const scene = (name) =>
    rig.parseScene({
      name,
      lens: { eye: [0, -330, -700], yaw: 0, pitch: 4, f: 1250, cx: 0, cy: 0 },
      cast: [
        {
          id: "a",
          world: { at: [0, 0, 0], yaw: 75 },
          tracks: [
            { clips: [{ action: "stand-3d", start: 0 }] },
            { clips: [{ action: name, start: 0.5, blend: 0.2 }] },
          ],
        },
      ],
    }).data;
  const events = (name) => {
    const { rt: r } = loadScene(scene(name), [dir, ACTIONS], []);
    const s = jointSampler(r, () => character);
    const seen = new Map();
    for (const t of [0.5, 1.5, 2.5, 3.5]) {
      const [P] = motionData(r, { t, sampler: s, trails: "wristR", span: 1, fps: 30 });
      for (const e of P.lines[0].events) seen.set(`${e.kind}@${e.t.toFixed(3)}`, e);
    }
    return [...seen.values()].sort((a, b) => a.t - b.t);
  };

  it("bắt đúng một khựng và một giật cài sẵn, bản trơn không báo gì", () => {
    assert.deepEqual(events("tron"), []);
    const got = events("loi");
    assert.deepEqual(
      got.map((e) => e.kind),
      ["hitch", "jerk"],
    );
    const [h, j] = got;
    assert.ok(h.t > 0.7 && h.end < 1.25 && h.dur >= 0.15 && h.dur <= 0.4, `${h.t}→${h.end}`);
    assert.ok(Math.abs(j.t - (0.5 + 2.8 + 1 / 30)) < 0.05, `${j.t}`);
  });

  it("tất định: cùng tham số cùng số đo và cùng lớp phủ", () => {
    const one = () => {
      const { rt: r } = loadScene(scene("loi"), [dir, ACTIONS], []);
      const d = motionData(r, { t: 1, sampler: jointSampler(r, () => character), trails: "hands" });
      return [markup(motionOverlay(d, 1, 4)), motionText([{ t: 1, data: d }], { video: 1920 })];
    };
    assert.deepEqual(one(), one());
  });

  it("ảnh có vệt kèm hướng dẫn đọc và bảng số đo; không lớp phủ thì không có", () => {
    const { rt: r } = loadScene(scene("loi"), [dir, ACTIONS], []);
    const base = {
      rt: r,
      times: [1, 3],
      loadCharacter: () => ({ character, urls: {} }),
      fallback: "x.json",
      scale: 0.1,
    };
    const with_ = renderFrames({
      ...base,
      out: join(dir, "vet.png"),
      motion: { trails: "wristR", span: 1, fps: 30 },
    });
    const g = with_.guide;
    for (const part of [
      "Chấm = chỗ khớp ở một khung (1/30 s)",
      "vòng đen = khớp ở giây của ô",
      "`t` = giây hành động / `duration`",
      "| ô (cửa sổ) | khớp | min | trung vị | max | sự kiện |",
      "| 1s (0–2) | a.wristR |",
      "#1 khựng",
      "#2 giật",
    ])
      assert.ok(g.includes(part), part);
    assert.equal(renderFrames({ ...base, out: join(dir, "tron.png") }).guide, undefined);
    const ghosts = renderFrames({
      ...base,
      out: join(dir, "bong.png"),
      motion: { ghosts: 2, span: 1, fps: 30 },
    }).guide;
    assert.ok(ghosts.includes("Bóng que xương") && !ghosts.includes("| ô |"));
  });
});

describe("bảng sự kiện", () => {
  const dir = mkdtempSync(join(tmpdir(), "su-kien-"));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const D = 3.4;
  const key = (s, arm, ease = "auto") => ({ t: +(s / D).toFixed(5), pose: { armNear: arm }, ease });
  const action = (name, list, duration = D) => ({
    schemaVersion: rig.ACTION_VERSION,
    name,
    duration,
    end: "hold",
    authoredAt: "side",
    mask: ["armNear"],
    keys: list,
    events: [],
  });
  const keys = [
    key(0, [-6, 24, 0, 0, 0]),
    key(0.35, [-3, 40, 0, 38, 45]),
    key(0.6, [-3, 41, 0, 40, 46]),
    key(0.95, [0, 60, 0, 80, 90]),
    key(2.45, [0, 60, 0, 80, 90]),
    key(3.4, [-6, 24, 0, 0, 0]),
  ];
  writeFileSync(join(dir, "gio.json"), JSON.stringify(action("gio", keys)));
  writeFileSync(join(dir, "ha.json"), JSON.stringify(action("ha", [keys[0]], 1)));
  const load = (clips) =>
    loadScene(
      rig.parseScene({
        name: "su-kien",
        lens: { eye: [0, -330, -700], yaw: 0, pitch: 4, f: 1250, cx: 0, cy: 0 },
        cast: [
          {
            id: "a",
            world: { at: [0, 0, 0], yaw: 75 },
            tracks: [{ clips: [{ action: "stand-3d", start: 0 }] }, { clips }],
          },
        ],
      }).data,
      [dir, ACTIONS],
      [],
    ).rt;
  const render = (r, name, times) =>
    renderFrames({
      rt: r,
      times,
      loadCharacter: () => ({ character, urls: {} }),
      fallback: "x.json",
      scale: 0.1,
      out: join(dir, `${name}.png`),
      motion: { trails: "wristR,elbowR", span: 1, fps: 30 },
    });
  const badges = (name) =>
    [...readFileSync(join(dir, `${name}.svg`), "utf8").matchAll(/data-badge="([\d,]+)"/g)].flatMap(
      (m) => m[1].split(",").map(Number),
    );

  it("số trên ảnh khớp số trong bảng, cùng sự kiện ở nhiều ô cùng số", () => {
    const r = render(load([{ action: "gio", start: 0.5, blend: 0.2 }]), "gio", [0.9, 1.1]);
    const head = r.guide.split("\n").filter((l) => /^#\d+ /.test(l));
    assert.equal(head.length, 1);
    assert.match(head[0], /^#1 khựng — `a`: wristR [\d.]+ s, elbowR [\d.]+ s; .*; ô 0\.9s, 1\.1s$/);
    const seen = badges("gio");
    assert.ok(seen.length >= 2, `${seen}`);
    assert.deepEqual([...new Set(seen)], [1]);
    assert.equal(count(r.guide, "| #1 |"), 4);
  });

  it("bảng có clip, giây bắt đầu, t, mốc kẹp, tên số và gợi ý mốc thừa", () => {
    const g = render(load([{ action: "gio", start: 0.5, blend: 0.2 }]), "gio2", [1]).guide;
    for (const part of [
      "track 1 `gio` bắt đầu 0.5 s, blend 0.2 s",
      "/ duration 3.4 s = t 0.",
      "mốc kẹp: keys[0] t 0 (0 s, auto) · keys[1] t 0.10294 (0.35 s, auto) · keys[2] t 0.17647 (0.6 s, auto)",
      "`armNear[3]` dang: keys[0] 0 · keys[1] 38 · keys[2] 40",
      "gợi ý: keys[1] (t 0.10294, 0.35 s) và keys[2] (t 0.17647, 0.6 s) của `gio` gần trùng tư thế",
      "track 0 `stand-3d` bắt đầu 0 s",
    ])
      assert.ok(g.includes(part), part);
  });

  it("giật ở chỗ nối hai clip không hoà là của đoạn hoà, không phải của mốc", () => {
    const r = load([
      { action: "gio", start: 0.5, blend: 0.2 },
      { action: "ha", start: 2, blend: 0 },
    ]);
    const g = render(r, "noi", [2]).guide;
    const rows = g.split("\n");
    const at = rows.findIndex((l) => /^#\d+ giật/.test(l));
    assert.ok(at >= 0, g);
    const block = rows.slice(
      at,
      rows.findIndex((l, i) => i > at && /^(#\d|$)/.test(l)),
    );
    assert.ok(block.some((l) => l.includes("`ha` bắt đầu 2 s, blend 0 s — sự kiện ở chỗ nối")));
    assert.ok(
      block.some(
        (l) => l.includes("`gio` bắt đầu 0.5 s") && l.includes("clip sau `ha` tiếp quản ở giây 2"),
      ),
    );
    assert.match(
      block.at(-1),
      /gợi ý: giật ở chỗ nối clip: `ha` \(track 1\) vào ở giây 2 với blend 0 s/,
    );
  });

  it("tất định: bảng và ảnh trùng nhau giữa hai lần", () => {
    const one = () => {
      const r = render(load([{ action: "gio", start: 0.5, blend: 0.2 }]), "gio3", [0.9, 1.1]);
      return [r.guide, readFileSync(join(dir, "gio3.svg"), "utf8")];
    };
    assert.deepEqual(one(), one());
  });
});
