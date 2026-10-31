import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import * as rig from "@stickman3d/rig/core";
import { GEN_KINDS, GenConflict, GenError, footSink, genWalk, stageRun } from "./gen.mjs";
import { parsePoints, planWalk } from "./gen-walk.mjs";
import * as R3 from "@stickman3d/rig";
import { castRuntime, soleOnFloor, worldData } from "./lib.mjs";

const page = GEN_KINDS.walk.page;
const data = worldData("/khong-co");
const runtime = (json) =>
  castRuntime(rig.parseScene(json).data, data.actions, data.characters, data.held, data.hands);

/** Repo video tối giản, không `stickman.world`; `scenes` ghi sẵn */
function workspace(scenes = {}) {
  const dir = mkdtempSync(join(tmpdir(), "gen-walk-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }));
  mkdirSync(join(dir, "scenes"));
  for (const [id, json] of Object.entries(scenes))
    writeFileSync(join(dir, "scenes", `${id}.json`), `${JSON.stringify(json, null, 2)}\n`);
  return dir;
}

/** Sân khấu thử của trang `walk` (người mặc định, `height` 1), chạy khô như trang soi */
async function fromPage(p) {
  const st = page.stage(p, {});
  return genWalk({ ...page.call(p, st), dir: workspace(), stage: stageRun(st) });
}

/** Mốc `path` tính từ chỗ đứng đầu: sân khấu thử dời đường đi vào giữa phòng thử */
const rel = (path) => {
  const d = (v, v0) => Math.round((v - v0) * 10) / 10 + 0;
  return path.map((k) => ({
    ...k,
    at: [d(k.at[0], path[0].at[0]), k.at[1], d(k.at[2], path[0].at[2])],
  }));
};

const walk = (start, blend = 0.3) => ({ action: "walk", start, cycle: 1.11, blend });
const stand = (start, blend = 0.3) => ({ action: "stand-3d", start, blend });

/** Bàn chân nhấc cao nhất trong `[from; to]` theo bên giải phẫu (`gaitTrace`): `right` | `left` */
function lifted(json, from, to) {
  const rt = runtime(json);
  const tr = rig.gaitTrace(rt, "a", 1, rt.bodies.a, from, to);
  const top = [0, 1].map((f) =>
    Math.min(...tr.samples.filter((x) => x.t >= from && x.t <= to).map((x) => x.feet[f][1])),
  );
  return top[0] < top[1] ? "right" : "left";
}

/** Năm kịch bản của docs/14-di-muot.md mục 2, tham số trang soi và timeline đúng của spec */
const K = [
  {
    name: "K1 đi thẳng",
    p: { shape: "straight", walkSpeed: 250, lead: 750 },
    path: [
      { t: 0, at: [0, 0, 0], yaw: 0 },
      { t: 3, at: [750, 0, 0], yaw: 0 },
    ],
    clips: [walk(0, 0), stand(2.722)],
  },
  {
    name: "K2 rẽ nhẹ 25°",
    p: { shape: "bend", walkSpeed: 250 },
    path: [
      { t: 0, at: [0, 0, 0], yaw: 0 },
      { t: 2, at: [500, 0, 0], yaw: 12.5 },
      { t: 4, at: [953.2, 0, -211.3], yaw: 25 },
    ],
    clips: [walk(0, 0), stand(3.722)],
  },
  {
    name: "K3 rẽ 90° khi đang đi",
    p: { shape: "corner", walkSpeed: 250 },
    path: [
      { t: 0, at: [0, 0, 0], yaw: 0 },
      { t: 2, at: [500, 0, 0], yaw: 45 },
      { t: 4, at: [500, 0, -500], yaw: 90 },
    ],
    clips: [walk(0, 0), stand(3.722)],
  },
  {
    name: "K4 dừng, quay trái 180°, đi về",
    p: { shape: "back", walkSpeed: 250, turnSide: "left" },
    path: [
      { t: 0, at: [0, 0, 0], yaw: 0 },
      { t: 2, at: [500, 0, 0], yaw: 0 },
      { t: 2.3, at: [500, 0, 0], yaw: 0 },
      { t: 3.9, at: [500, 0, 0], yaw: -180, steps: 2 },
      { t: 5.9, at: [0, 0, 0], yaw: -180 },
    ],
    clips: [walk(0, 0), stand(1.722), walk(3.5), stand(5.622)],
  },
  {
    name: "K4 dừng, quay phải 180°, đi về",
    p: { shape: "back", walkSpeed: 250, turnSide: "right" },
    path: [
      { t: 0, at: [0, 0, 0], yaw: 0 },
      { t: 2, at: [500, 0, 0], yaw: 0 },
      { t: 2.3, at: [500, 0, 0], yaw: 0 },
      { t: 3.9, at: [500, 0, 0], yaw: 180, steps: 2 },
      { t: 5.9, at: [0, 0, 0], yaw: 180 },
    ],
    clips: [walk(0, 0), stand(1.722), walk(3.5), stand(5.622)],
  },
  {
    name: "K5 vòng chữ U r 125",
    p: { shape: "uturn", walkSpeed: 250, lead: 400, after: 400, radius: 125 },
    path: [
      { t: 0, at: [0, 0, 0], yaw: 0 },
      { t: 1.6, at: [400, 0, 0], yaw: 0 },
      { t: 1.859, at: [462.5, 0, -16.7], yaw: 30 },
      { t: 2.118, at: [508.3, 0, -62.5], yaw: 60 },
      { t: 2.377, at: [525, 0, -125], yaw: 90 },
      { t: 2.635, at: [508.3, 0, -187.5], yaw: 120 },
      { t: 2.894, at: [462.5, 0, -233.3], yaw: 150 },
      { t: 3.153, at: [400, 0, -250], yaw: 180 },
      { t: 4.753, at: [0, 0, -250], yaw: 180 },
    ],
    clips: [walk(0, 0), stand(4.475)],
  },
];

describe("stickman gen walk: năm kịch bản", () => {
  for (const k of K)
    it(`${k.name}: timeline đúng spec, tự kiểm đạt, hai luật đi của check sạch`, async () => {
      const r = await fromPage(k.p);
      assert.equal(r.ok, true, r.text);
      assert.equal(r.wrote, null);
      assert.deepEqual(rel(r.path), k.path);
      assert.deepEqual(r.clips, k.clips);
      assert.deepEqual(r.scene.cast[0].world.path, r.path);
      assert.deepEqual(r.scene.cast[0].tracks, [{ name: "chan", clips: k.clips }]);
      const rt = runtime(r.scene);
      assert.deepEqual(rig.sceneWalkInProblems(rt), []);
      assert.deepEqual(rig.sceneWalkYawProblems(rt), []);
      assert.ok(r.metrics.some((m) => m.key === "dip"));
      assert.match(r.text, /chạy lại: pnpm exec stickman gen walk --scene xem-thu --cast a --at 0/);
      assert.match(r.text, /stickman-render --scene scenes\/xem-thu\.json --from/);
    });
  for (const side of ["right", "left"])
    it(`K4 quay ${side === "right" ? "phải" : "trái"}: nhịp đầu chân kia bước, nhịp cuối (nối đi) chân phía quay`, async () => {
      const r = await fromPage({ shape: "back", walkSpeed: 250, turnSide: side });
      const other = side === "right" ? "left" : "right";
      assert.equal(lifted(r.scene, 2.3, 3.1), other);
      assert.equal(lifted(r.scene, 3.1, 3.5), side);
    });
  it("đứng rồi đi ở đầu cảnh: `stand-3d` ở 0 không hoà, `path` đứng yên 0,3 s rồi clip đi hoà từ nó; có cú quay thì quay rồi đi", async () => {
    const straight = await fromPage({ shape: "straight", walkSpeed: 250, start: "rest" });
    assert.equal(straight.ok, true, straight.text);
    assert.deepEqual(rel(straight.path), [
      { t: 0, at: [0, 0, 0], yaw: 0 },
      { t: 0.3, at: [0, 0, 0], yaw: 0 },
      { t: 2.3, at: [500, 0, 0], yaw: 0 },
    ]);
    assert.deepEqual(straight.clips, [stand(0, 0), walk(0.3), stand(2.022)]);
    assert.deepEqual(rig.sceneWalkInProblems(runtime(straight.scene)), []);
    // quãng đầu về −z: cú quay 90° phải bắt đầu ở 0, clip đi giữa nhịp cuối
    const st = page.stage({ shape: "straight" }, {});
    const [x0, , z0] = st.scene.cast[0].world.at;
    const r = await genWalk({
      ...page.call({ shape: "straight", start: "rest" }, st),
      to: `${x0},${z0 - 500}`,
      speed: 250,
      dir: workspace(),
      stage: stageRun(st),
    });
    assert.equal(r.ok, true, r.text);
    assert.deepEqual(rel(r.path), [
      { t: 0, at: [0, 0, 0], yaw: 0 },
      { t: 0.8, at: [0, 0, 0], yaw: 90, steps: 1 },
      { t: 2.8, at: [0, 0, -500], yaw: 90 },
    ]);
    assert.deepEqual(r.clips, [stand(0, 0), walk(0.4), stand(2.522)]);
    const back = await fromPage({
      shape: "back",
      walkSpeed: 250,
      start: "rest",
      turnSide: "right",
    });
    assert.equal(back.ok, true, back.text);
  });
  it("đứng rồi đi sau một đoạn đứng: clip đi hoà từ `stand-3d` đang chạy, có và không cú quay", async () => {
    const st = page.stage({ shape: "straight" }, {});
    const [x0, , z0] = st.scene.cast[0].world.at;
    for (const [to, path, clips] of [
      [
        `${x0 + 500},${z0}`,
        [
          { t: 0, at: [0, 0, 0], yaw: 0 },
          { t: 1, at: [0, 0, 0], yaw: 0 },
          { t: 3, at: [500, 0, 0], yaw: 0 },
        ],
        [walk(1), stand(2.722)],
      ],
      [
        `${x0},${z0 - 500}`,
        [
          { t: 0, at: [0, 0, 0], yaw: 0 },
          { t: 1, at: [0, 0, 0], yaw: 0 },
          { t: 1.8, at: [0, 0, 0], yaw: 90, steps: 1 },
          { t: 3.8, at: [0, 0, -500], yaw: 90 },
        ],
        [walk(1.4), stand(3.522)],
      ],
    ]) {
      const r = await genWalk({
        ...page.call({ shape: "straight", start: "rest" }, st),
        at: 1,
        to,
        speed: 250,
        dir: workspace(),
        stage: stageRun(st),
      });
      assert.equal(r.ok, true, r.text);
      assert.deepEqual(rel(r.scene.cast[0].world.path), path);
      assert.deepEqual(r.clips, clips);
      assert.deepEqual(r.scene.cast[0].tracks[0].clips[0], { action: "stand-3d", start: 0 });
      assert.deepEqual(rig.sceneWalkInProblems(runtime(r.scene)), []);
    }
  });
});

describe("stickman gen walk: vá cảnh", () => {
  const base = () => {
    const st = page.stage({ shape: "corner" }, {});
    const sc = { ...st.scene, schemaVersion: rig.SCENE_VERSION };
    sc.cast[0].world = { at: [0, 0, 0], yaw: 0 };
    return sc;
  };
  const cmd = (dir, o) => ({ dir, scene: "canh", cast: "a", speed: 250, ...o });

  it("ghi path và clip, giữ .bak; chạy lại cùng lệnh không đổi byte; nối một đoạn sau mốc cuối; chạy lại đoạn nối cũng vậy", async () => {
    const dir = workspace({ canh: base() });
    const file = join(dir, "scenes/canh.json");
    const before = readFileSync(file, "utf8");
    const a = await genWalk(cmd(dir, { at: 0, start: "moving", to: "500,0 500,-500" }));
    assert.equal(a.ok, true, a.text);
    assert.ok(a.wrote && !a.wrote.same);
    assert.equal(readFileSync(`${file}.bak`, "utf8"), before);
    const once = readFileSync(file, "utf8");
    const json = JSON.parse(once);
    assert.equal(json.cast[0].world.at, undefined);
    assert.equal(json.cast[0].world.yaw, undefined);
    assert.deepEqual(json.cast[0].tracks, [{ name: "chan", clips: K[2].clips }]);
    // lối viết của file giữ nguyên (JSON.stringify hai dấu cách)
    assert.equal(once, `${JSON.stringify(json, null, 2)}\n`);

    const again = await genWalk(cmd(dir, { at: 0, start: "moving", to: "500,0 500,-500" }));
    assert.equal(again.wrote.same, true);
    assert.equal(readFileSync(file, "utf8"), once);
    assert.equal(again.hash, a.wrote.hash);

    // đoạn nối từ chỗ dừng: tiền tố giữ, mốc mới từ 4.6, clip đi sau `stand-3d` đang chạy
    const b = await genWalk(cmd(dir, { at: 4.6, to: "0,-500" }));
    assert.equal(b.ok, true, b.text);
    const two = JSON.parse(readFileSync(file, "utf8"));
    assert.deepEqual(two.cast[0].world.path.slice(0, 3), K[2].path);
    assert.deepEqual(two.cast[0].world.path.slice(3), [
      { t: 4.6, at: [500, 0, -500], yaw: 90 },
      { t: 5.4, at: [500, 0, -500], yaw: 180, steps: 1 },
      { t: 7.4, at: [0, 0, -500], yaw: 180 },
    ]);
    assert.deepEqual(two.cast[0].tracks[0].clips, [...K[2].clips, walk(5), stand(7.122)]);
    const twice = readFileSync(file, "utf8");
    const c = await genWalk(cmd(dir, { at: 4.6, to: "0,-500" }));
    assert.equal(c.wrote.same, true);
    assert.equal(readFileSync(file, "utf8"), twice);
  });

  it("hash khác bytes trên đĩa là xung đột (409), không ghi", async () => {
    const dir = workspace({ canh: base() });
    const file = join(dir, "scenes/canh.json");
    const text = readFileSync(file, "utf8");
    await assert.rejects(
      genWalk(cmd(dir, { at: 0, start: "moving", to: "500,0", hash: "khac" })),
      (e) => e instanceof GenConflict && e.conflict && /đã đổi trên đĩa/.test(e.message),
    );
    assert.equal(readFileSync(file, "utf8"), text);
    assert.ok(!existsSync(`${file}.bak`));
  });

  it("chạy khô trên file: không đổi byte, không .bak, vẫn trả hash lúc nạp", async () => {
    const dir = workspace({ canh: base() });
    const file = join(dir, "scenes/canh.json");
    const text = readFileSync(file, "utf8");
    const r = await genWalk(cmd(dir, { at: 0, start: "moving", to: "500,0", dryRun: true }));
    assert.equal(r.ok, true, r.text);
    assert.equal(r.wrote, null);
    assert.ok(r.hash);
    assert.equal(readFileSync(file, "utf8"), text);
    assert.ok(!existsSync(`${file}.bak`));
  });

  it("file đổi trong lúc sinh một bản không đổi: xung đột, không trả `same`, không đụng .bak", async () => {
    const dir = workspace({ canh: base() });
    const file = join(dir, "scenes/canh.json");
    const o = cmd(dir, { at: 0, start: "moving", to: "500,0" });
    await genWalk(o);
    const bak = readFileSync(`${file}.bak`, "utf8");
    const run = genWalk(o);
    const other = `${readFileSync(file, "utf8").trimEnd()}\n\n`;
    writeFileSync(file, other);
    await assert.rejects(run, (e) => e instanceof GenConflict && /trong lúc sinh/.test(e.message));
    assert.equal(readFileSync(file, "utf8"), other);
    assert.equal(readFileSync(`${file}.bak`, "utf8"), bak);
  });

  it("lỗi cấu trúc: đang đi lúc --at, vào cảnh đang đi khi đã có path trước, track khác ghi chân trong quãng", async () => {
    const dir = workspace({ canh: base() });
    await genWalk(cmd(dir, { at: 0, start: "moving", to: "500,0 500,-500" }));
    await assert.rejects(genWalk(cmd(dir, { at: 1, to: "0,0" })), /đang đi lúc giây 1/);
    await assert.rejects(
      genWalk(cmd(dir, { at: 4.6, start: "moving", to: "0,-500" })),
      /đã có mốc `path` trước giây 4.6/,
    );
    await assert.rejects(genWalk(cmd(dir, { to: "0,-500" })), /--at bắt buộc/);
    const sc = base();
    sc.cast[0].tracks.push({ name: "khac", clips: [{ action: "stand-3d", start: 1 }] });
    await assert.rejects(
      genWalk(cmd(workspace({ canh: sc }), { at: 0, start: "moving", to: "500,0", track: "chan" })),
      (e) =>
        e instanceof GenError && /track khác ghi chân/.test(e.message) && /`khac`/.test(e.message),
    );
  });

  it("K4 từ trang soi và từ lệnh trên cùng cảnh ra cùng timeline", async () => {
    const p = { shape: "back", walkSpeed: 250, turnSide: "left" };
    const st = page.stage(p, {});
    const fromUi = await genWalk({ ...page.call(p, st), dir: workspace(), stage: stageRun(st) });
    const dir = workspace({ "xem-thu": { ...st.scene, schemaVersion: rig.SCENE_VERSION } });
    const fromCli = await genWalk({
      dir,
      scene: "xem-thu",
      cast: "a",
      at: "0",
      start: "moving",
      to: st.to,
      speed: "250",
      turnSide: "left",
      dryRun: true,
    });
    assert.deepEqual(fromCli.path, fromUi.path);
    assert.deepEqual(fromCli.clips, fromUi.clips);
    assert.deepEqual(rel(fromCli.path), K[3].path);
  });
});

describe("gen walk: bàn chân lún đồ", () => {
  const row = (part, extra) => ({
    group: "clash",
    key: `người|${part}|vat`,
    measure: 3,
    msg: `người lồng vào đồ — ${part} ↔ vat lấn 3.0`,
    ...extra,
  });
  it("chỉ miễn bàn chân của người đi lún mặt sàn tới 4 · s; lấn tường, ghế, người khác, quá sâu vẫn chặn", () => {
    const ok = footSink("a", 1);
    assert.equal(ok(row("a.footL", { floor: true })), true);
    assert.equal(ok(row("a.footR", { floor: true })), true);
    assert.equal(ok(row("a.footL")), false);
    assert.equal(ok(row("a.footL", { floor: true, measure: 5 })), false);
    assert.equal(footSink("a", 1.5)(row("a.footL", { floor: true, measure: 5 })), true);
    assert.equal(ok(row("a.shinL", { floor: true })), false);
    assert.equal(ok(row("b.footL", { floor: true })), false);
    // id có ký tự của regex
    assert.equal(footSink("a.b", 1)(row("a.b.footL", { floor: true })), true);
    assert.equal(footSink("a.b", 1)(row("axb.footL", { floor: true })), false);
  });
  it("`soleOnFloor`: lún qua mặt trên phẳng ở cao độ sàn là mặt sàn; mặt bên tường, mặt ghế cao thì không", () => {
    const U = 0.01;
    const box = (name, lo, hi) =>
      R3.colliders(
        {
          points: [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
            [0, 1, 2].map((k) => (i & (1 << k) ? hi : lo)[k]),
          ),
        },
        name,
      );
    const cols = [
      ...box("tham", [-1, -0.1, -1], [1, 0, 1]),
      ...box("tuong", [0.5, 0, -1], [0.6, 2, 1]),
      ...box("ghe", [-0.3, 0, -0.3], [0.3, 0.45, 0.3]),
    ];
    // `at` là điểm trên trục viên nang bàn chân, cao hơn mặt lấn
    const at = (name, x, y, z) => ({ collider: name, at: { x, y, z }, depth: 3 * U });
    assert.equal(soleOnFloor(cols, at("tham", 0.2, 0.02, 0.2), 0, 4 * U), true);
    assert.equal(soleOnFloor(cols, at("tham", 0.2, 0.02, 0.2), -0.1, 4 * U), false);
    assert.equal(soleOnFloor(cols, at("tuong", 0.48, 0.03, 0), 0, 4 * U), false);
    assert.equal(soleOnFloor(cols, at("ghe", 0.32, 0.03, 0), 0, 4 * U), false);
  });
});

describe("gen walk: điểm và luật", () => {
  const fail = (m) => {
    throw new Error(m);
  };
  it("cú pháp điểm", () => {
    assert.deepEqual(parsePoints("500,0 500,-500! 0,0!90", fail), [
      { at: [500, 0], stop: false },
      { at: [500, -500], stop: true },
      { at: [0, 0], stop: true, yaw: 90 },
    ]);
    assert.throws(() => parsePoints("500,0!90 0,0", fail), /chỉ ở điểm cuối/);
    assert.throws(() => parsePoints("500;0", fail), /không phải `x,z`/);
    assert.throws(() => parsePoints("500,0!x", fail), /không phải số/);
  });
  const plan = (to, extra = {}) =>
    planWalk({
      at: 0,
      start: "moving",
      P0: [0, 0, 0],
      yaw0: 0,
      pts: parsePoints(to, fail),
      v: 250,
      c: 1.11,
      b: 0.3,
      s: 1,
      radius: 0,
      turnTime: 0.8,
      turnSide: "auto",
      action: "walk",
      after: "stand-3d",
      fail,
      ...extra,
    });
  it("góc quá 100° tự bo cung, quá 135° là lỗi; bán kính dưới v / ω_c là lỗi; dừng rồi quay ở điểm cuối", () => {
    const wide = plan("500,0 300,-346.4");
    assert.ok(wide.events.some((e) => e.kind === "arc"));
    assert.match(wide.notes[0], /bo cung bán kính 125/);
    assert.throws(() => plan("500,0 0,-100"), /quá 135°/);
    assert.throws(() => plan("525,0 525,-250 0,-250", { radius: 100 }), /dưới 119.4/);
    const look = plan("500,0!90");
    assert.deepEqual(look.keys.slice(1), [
      { t: 2, at: [500, 0, 0], yaw: 0 },
      { t: 2.8, at: [500, 0, 0], yaw: 90, steps: 1 },
    ]);
    assert.deepEqual(look.clips, [walk(0, 0), stand(1.722)]);
  });
  it("quay 180° auto: về phía ống kính, máy thẳng trục thì trái", () => {
    const side = (eye) => plan("500,0! 0,0", { eye }).events.find((e) => e.kind === "turn").side;
    assert.equal(side([500, -800]), "right");
    assert.equal(side([500, 800]), "left");
    assert.equal(side([1500, 0]), "left");
  });
});

describe("check: hai luật đi của người 3D", () => {
  const scene = (path, clips) => ({
    schemaVersion: rig.SCENE_VERSION,
    lens: { eye: [250, -300, 1500], yaw: 180, pitch: 6, f: 1100, cx: 0, cy: 0 },
    cast: [{ id: "a", tracks: [{ name: "chan", clips }], world: { path } }],
  });
  it("clip đi hoà vào khi `path` đã chạy: báo ở vào cảnh, không báo khởi hành từ đứng", () => {
    const bad = runtime(scene(K[0].path, [walk(0, 0.3), stand(2.722)]));
    const lines = rig.sceneWalkInProblems(bad);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /`a` giây 0.00: clip đi `walk` hoà vào 0.3 s/);
    assert.match(lines[0], /`blend: 0`/);
    const rest = runtime(
      scene(
        [
          { t: 0, at: [0, 0, 0], yaw: 0 },
          { t: 1, at: [0, 0, 0], yaw: 0 },
          { t: 4, at: [750, 0, 0], yaw: 0 },
        ],
        [stand(0), walk(1), stand(3.722)],
      ),
    );
    assert.deepEqual(rig.sceneWalkInProblems(rest), []);
  });
  it("chỉ xét clip đi đang lái chân lúc hoà vào: che hoàn toàn không báo, che một phần báo từ lúc lộ ra, mask khỏi chân không báo", () => {
    const two = (top) => {
      const sc = scene(K[0].path, [walk(0, 0.3), stand(2.722)]);
      sc.cast[0].tracks.push({ name: "tren", clips: top });
      return runtime(sc);
    };
    assert.deepEqual(rig.sceneWalkInProblems(two([{ action: "stand-3d", start: 0 }])), []);
    const arms = ["armLeft", "armRight"];
    const part = rig.sceneWalkInProblems(
      two([
        { action: "stand-3d", start: 0 },
        { action: "stand-3d", start: 0.1, blend: 0, mask: arms },
      ]),
    );
    assert.equal(part.length, 1);
    assert.match(part[0], /`a` giây 0.10: clip đi `walk` hoà vào 0.3 s/);
    const masked = scene(K[0].path, [{ ...walk(0, 0.3), mask: arms }, stand(2.722)]);
    assert.deepEqual(rig.sceneWalkInProblems(runtime(masked)), []);
  });
  it("mốc giữa đường lệch hướng `path` quá 45°: báo kèm `yaw` nên đặt", () => {
    const yaw0 = K[2].path.map((k) => ({ ...k, yaw: 0 }));
    const lines = rig.sceneWalkYawProblems(runtime(scene(yaw0, K[2].clips)));
    assert.ok(
      lines.some((l) => /giây 4: `yaw` 0 lệch hướng đi 90°.*đặt `yaw` 90/.test(l)),
      lines.join("\n"),
    );
    const mid = K[2].path.map((k) => (k.t === 2 ? { ...k, yaw: 100 } : k));
    const one = rig.sceneWalkYawProblems(runtime(scene(mid, K[2].clips)));
    assert.equal(one.length, 1);
    assert.match(one[0], /giây 2: `yaw` 100 lệch hướng đi 55° \(phân giác hai quãng kề: 45\)/);
  });
});
