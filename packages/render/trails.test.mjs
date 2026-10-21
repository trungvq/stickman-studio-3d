import assert from "node:assert/strict";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as rig from "@stickman3d/sketch";
import { loadScene } from "./lib.mjs";
import { BONE_SEGS, jointSampler, motionData, motionOverlay, trailJoints } from "./trails.mjs";
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

  it("ghosts sinh n nhóm nét mỗi phía", () => {
    const d = motionData(rt, { t: 1, sampler: sampler(), ghosts: 3, ghostStep: 0.1 });
    const s = markup(motionOverlay(d, 1, 4));
    assert.equal(count(s, "data-ghost="), 6);
    assert.equal(count(s, `stroke="#2a6fdb"`), 3);
    assert.equal(count(s, `stroke="#d9462b"`), 3);
    assert.equal(count(s, "<line"), 6 * 14);
    assert.equal(count(s, "data-trail="), 0);
  });

  it("vệt mỗi khớp một nhóm, mỗi khung một chấm", () => {
    const d = motionData(rt, { t: 1, sampler: sampler(), trails: "hands", span: 0.5, fps: 10 });
    const s = markup(motionOverlay(d, 1, 4));
    assert.equal(count(s, "data-trail="), 2);
    // 11 chấm + vòng khung hiện tại mỗi vệt
    assert.equal(count(s, "<circle"), 2 * 12);
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
