import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import * as rig from "@stickman3d/sketch";
import { COMMON, checkWorkspace, planReseat, reseatWorkspace } from "./lib.mjs";

const D = Math.PI / 180;
const { thigh: THIGH, shin: SHIN } = rig.RIG;
/** Hông cách sàn của `sit` chung: chân mới `[70, −70]`, đời trước `[60, −60]` trên `82 / 78` */
const SIT_NOW = THIGH * Math.cos(70 * D) + SHIN;
const SIT_BEFORE = 82 * Math.cos(60 * D) + 78;
/** `lie` chân `[−10, 0]` / `[−11, 0]` */
const LIE_NOW = (THIGH + SHIN) * Math.cos(10 * D);
const LIE_BEFORE = 160 * Math.cos(10 * D);

/** `path` của người vừa đứng vừa ngồi nội suy thẳng giữa các mốc: lệch tối đa ngần này px */
const PATH_TOL = 0.3;
const sitClip = { clips: [{ action: "sit", start: 0 }] };
const SCENES = {
  // Trình bày gọn tay: `reseat` chỉ được đổi đúng con số
  "ngoi.json": `{
  "duration": 4,
  "ground": 280,
  "cast": [
    { "id": "a", "x": -200, "y": 280, "scale": 0.8, "tracks": [{ "clips": [{ "action": "sit", "start": 0 }] }] },
    { "id": "b", "x": 200, "tracks": [{ "clips": [{ "action": "wave", "start": 0 }] }] },
    { "id": "c", "x": 0, "scale": 1.5, "base": "sit" }
  ]
}
`,
  "old-ngoi.json": { duration: 2, cast: [{ id: "a", y: 280, tracks: [sitClip] }] },
  "vua.json": {
    duration: 6,
    cast: [
      { id: "a", x: 0, y: 300, tracks: [{ clips: [...sitClip.clips, { start: 3, blend: 0.5 }] }] },
    ],
  },
  "nam.json": { duration: 2, cast: [{ id: "a", x: 92, y: 70.7, rotate: 84, base: "lie" }] },
  "nhom.json": {
    duration: 2,
    groups: [{ id: "g", x: 100, y: 300, scale: 0.5, flip: true }],
    cast: [{ id: "a", group: "g", x: 10, tracks: [sitClip] }],
  },
  "ba-chieu.json": {
    duration: 2,
    lens: { eye: [0, -400, -800], yaw: 0, pitch: 10, f: 800 },
    cast: [{ id: "a", base: "sit", world: { at: [0, -94.5, 0], yaw: 30, sit: true } }],
  },
  "theo.json": {
    duration: 2,
    cast: [{ id: "a", x: 0, y: 280, tracks: [sitClip] }],
    props: [{ id: "p", prop: "ly.json", follow: "a", x: 30, y: -60 }],
  },
};
const ACTIONS = {
  "wave.json": {
    name: "wave",
    duration: 1,
    keys: [{ t: 0, pose: { armNear: [-140, -8, 0] } }],
  },
};

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), "stickman-reseat-"));
  for (const d of ["scenes", "actions", "characters", "pieces", "props"])
    mkdirSync(join(dir, d), { recursive: true });
  const json = (rel, v) =>
    writeFileSync(join(dir, rel), typeof v === "string" ? v : `${JSON.stringify(v, null, 2)}\n`);
  json("package.json", { name: "thu", stickman: { frozen: "^old-" } });
  json("stickman.json", {
    schemaVersion: 3,
    versions: { rig: "0.51.0" },
    initializedAt: "2026-09-01",
    files: {},
  });
  json("props/ly.json", rig.defaultProp());
  for (const [f, v] of Object.entries(SCENES)) json(`scenes/${f}`, v);
  for (const [f, v] of Object.entries(ACTIONS)) json(`actions/${f}`, v);
  return dir;
}

const read = (dir, rel) => JSON.parse(readFileSync(join(dir, rel), "utf8"));
const common = (name) =>
  rig.parseAction(JSON.parse(readFileSync(join(COMMON.actions, `${name}.json`), "utf8"))).data;
const commonSit = () => common("sit");

/** Hông của `id` ở `t` theo rig đang cài, sau khi `reseat` ghi xong */
function hip(dir, scene, id, t = 1) {
  const s = rig.parseScene(read(dir, `scenes/${scene}`));
  if (!s.success) throw new Error(s.error.message);
  const wave = rig.parseAction(ACTIONS["wave.json"]).data;
  const rt = rig.resolveScene(
    s.data,
    { sit: commonSit(), walk: common("walk"), wave },
    {},
    { "ly.json": rig.defaultProp() },
  );
  return rig.anchorAt(rt, id, "hip", t);
}

describe("stickman reseat", () => {
  it("người ngồi `sit` chung: hông về đúng chỗ của chân `82 / 78`", async () => {
    const dir = workspace();
    const r = await reseatWorkspace({ dir });
    assert.deepEqual(r.problems, []);
    const a = read(dir, "scenes/ngoi.json").cast[0];
    assert.equal(a.y, Math.round((280 + 0.8 * (SIT_NOW - SIT_BEFORE)) * 100) / 100);
    assert.ok(Math.abs(hip(dir, "ngoi.json", "a").y - (280 - 0.8 * SIT_BEFORE)) < 0.01);
  });

  it("người đứng giữ chân trên đất, cảnh đóng băng và người 3D không đụng", async () => {
    const dir = workspace();
    const before = Object.fromEntries(
      ["old-ngoi.json", "ba-chieu.json"].map((f) => [
        f,
        readFileSync(join(dir, "scenes", f), "utf8"),
      ]),
    );
    const r = await reseatWorkspace({ dir });
    assert.equal(read(dir, "scenes/ngoi.json").cast[1].y, undefined);
    for (const [f, body] of Object.entries(before))
      assert.equal(readFileSync(join(dir, "scenes", f), "utf8"), body);
    assert.equal(r.frozen, 1);
    assert.ok(!r.changes.some((c) => c.file === "scenes/ba-chieu.json"));
  });

  it('`base: "sit"` không khai `y`: chèn `y` từ `ground`, giữ cách trình bày của file', async () => {
    const dir = workspace();
    await reseatWorkspace({ dir });
    const P = rig.POSES.sit;
    const low = (legs) => Math.max(...rig.feet(P, 1, legs).map((f) => f[1]));
    const want = Math.round((280 + 1.5 * (low() - low({ thigh: 82, shin: 78 }))) * 100) / 100;
    const text = readFileSync(join(dir, "scenes/ngoi.json"), "utf8");
    assert.equal(
      text,
      SCENES["ngoi.json"]
        .replace(
          '"y": 280, "scale": 0.8',
          `"y": ${read(dir, "scenes/ngoi.json").cast[0].y}, "scale": 0.8`,
        )
        .replace('"x": 0, "scale": 1.5', `"x": 0, "y": ${want}, "scale": 1.5`),
    );
  });

  it("vừa ngồi vừa đứng một chỗ: `path` mốc `y`, hông đúng lúc ngồi, chân trên đất lúc đứng", async () => {
    const dir = workspace();
    await reseatWorkspace({ dir });
    const a = read(dir, "scenes/vua.json").cast[0];
    assert.ok(a.path.length >= 3);
    assert.equal(a.path[0].y, Math.round((300 + SIT_NOW - SIT_BEFORE) * 100) / 100);
    assert.equal(a.path.at(-1).y, 300);
    assert.ok(Math.abs(hip(dir, "vua.json", "a", 1).y - (300 - SIT_BEFORE)) < 0.01);
    const s = rig.parseScene(read(dir, "scenes/vua.json")).data;
    const rt = rig.resolveScene(s, { sit: commonSit() });
    const foot = (t) =>
      Math.max(rig.anchorAt(rt, "a", "footNear", t).y, rig.anchorAt(rt, "a", "footFar", t).y);
    assert.ok(Math.abs(foot(5) - 300) < 0.01);
    // `path` tắt trôi ngang tự suy: x của nó phải là chính trôi ngang lúc đứng dậy
    const orig = rig.parseScene(SCENES["vua.json"]).data;
    const was = rig.resolveScene(orig, { sit: commonSit() });
    for (const t of [3.1, 3.25, 3.4, 5])
      assert.ok(Math.abs(rig.sceneAt(rt, "a", t).x - rig.sceneAt(was, "a", t).x) <= PATH_TOL);
  });

  it("đi tới rồi ngồi: `path` mang cả `x` của bước đi", async () => {
    const dir = workspace();
    const walk = { action: "walk", start: 0 };
    writeFileSync(
      join(dir, "scenes/di.json"),
      JSON.stringify({
        duration: 5,
        cast: [
          { id: "a", x: -300, y: 280, tracks: [{ clips: [walk, { action: "sit", start: 2.5 }] }] },
        ],
      }),
    );
    await reseatWorkspace({ dir });
    const a = read(dir, "scenes/di.json").cast[0];
    assert.ok(a.path.every((k) => typeof k.x === "number"));
    const load = (json) =>
      rig.resolveScene(rig.parseScene(json).data, { sit: commonSit(), walk: common("walk") });
    const before = load({ duration: 5, cast: [{ ...a, path: undefined, y: 280 }] });
    const after = load(read(dir, "scenes/di.json"));
    for (const t of [0.5, 1.3, 2.2, 2.6, 4])
      assert.ok(Math.abs(rig.sceneAt(after, "a", t).x - rig.sceneAt(before, "a", t).x) <= PATH_TOL);
    assert.ok(Math.abs(hip(dir, "di.json", "a", 4).y - (280 - SIT_BEFORE)) < 0.01);
  });

  it("người đi 2D không `path`: giãn `cycle` để đi đúng quãng của đời chân trước", async () => {
    const dir = workspace();
    const scene = {
      duration: 4,
      cast: [
        { id: "a", x: -300, y: 280, tracks: [{ clips: [{ action: "walk", start: 0 }] }] },
        {
          id: "b",
          x: -300,
          y: 400,
          tracks: [{ clips: [{ action: "walk", start: 0, speed: 90 }] }],
        },
      ],
    };
    writeFileSync(join(dir, "scenes/di-bo.json"), JSON.stringify(scene));
    const walk = common("walk");
    // Đời trước: chân `82 / 78`
    const legs = { ...rig.RIG };
    Object.assign(rig.RIG, { thigh: 82, shin: 78 });
    const was = rig.resolveScene(rig.parseScene(scene).data, { walk });
    const xs = [0.7, 1.9, 3.3].map((t) => rig.sceneAt(was, "a", t).x);
    Object.assign(rig.RIG, legs);
    await reseatWorkspace({ dir });
    const s = read(dir, "scenes/di-bo.json");
    assert.notEqual(s.cast[0].tracks[0].clips[0].cycle, undefined);
    assert.equal(s.cast[1].tracks[0].clips[0].cycle, undefined);
    const now = rig.resolveScene(rig.parseScene(s).data, { walk });
    // Hết mỗi lượt về đúng chỗ; giữa một bước lệch tới ~8% sải chân vì nhịp chân trụ đổi dáng
    const stride = rig.actionStride(walk);
    [0.7, 1.9, 3.3].forEach((t, i) =>
      assert.ok(Math.abs(rig.sceneAt(now, "a", t).x - xs[i]) < 0.08 * stride, `${t}s`),
    );
  });

  it("người nằm xoay: dời cả `x` lẫn `y` để hông đứng yên", async () => {
    const dir = workspace();
    await reseatWorkspace({ dir });
    const a = read(dir, "scenes/nam.json").cast[0];
    const r = -84 * D;
    const d = LIE_NOW - LIE_BEFORE;
    assert.equal(a.x, Math.round((92 - d * Math.sin(r)) * 100) / 100);
    assert.equal(a.y, Math.round((70.7 + d * Math.cos(r)) * 100) / 100);
  });

  it("thành viên nhóm: độ dời quy về đơn vị của nhóm", async () => {
    const dir = workspace();
    await reseatWorkspace({ dir });
    const a = read(dir, "scenes/nhom.json").cast[0];
    assert.equal(a.y, Math.round((SIT_NOW - SIT_BEFORE) * 100) / 100);
    assert.ok(Math.abs(hip(dir, "nhom.json", "a").y - (300 - 0.5 * SIT_BEFORE)) < 0.01);
  });

  it("đạo cụ theo người ngồi giữ chỗ trên sân khấu", async () => {
    const dir = workspace();
    await reseatWorkspace({ dir });
    const s = read(dir, "scenes/theo.json");
    assert.equal(s.props[0].y, Math.round((-60 - (SIT_NOW - SIT_BEFORE)) * 100) / 100);
    assert.equal(s.props[0].x, 30);
  });

  it("chạy lại không dời thêm; `--dry-run` không ghi gì; `check` nhắc khi chân lệch", async () => {
    const dir = workspace();
    assert.ok((await checkWorkspace({ dir })).problems.some((p) => /reseat/.test(p.msg)));
    const dry = await reseatWorkspace({ dir, dryRun: true });
    assert.ok(dry.changes.length > 0);
    assert.equal(read(dir, "scenes/ngoi.json").cast[0].y, 280);
    assert.equal(read(dir, "stickman.json").legs, undefined);
    await reseatWorkspace({ dir });
    const once = readFileSync(join(dir, "scenes/ngoi.json"), "utf8");
    assert.deepEqual(read(dir, "stickman.json").legs, { thigh: THIGH, shin: SHIN });
    const again = await reseatWorkspace({ dir });
    assert.equal(again.changes.length, 0);
    assert.equal(readFileSync(join(dir, "scenes/ngoi.json"), "utf8"), once);
    assert.ok(!(await checkWorkspace({ dir })).problems.some((p) => /reseat/.test(p.msg)));
  });

  it("`--before`: hành động ngồi riêng vừa chỉnh lấy đời trước ở commit ấy", async () => {
    const dir = workspace();
    const sitSide = (legs) => ({
      name: "sit-side",
      duration: 1,
      keys: [{ t: 0, pose: { legFar: legs, legNear: legs } }],
    });
    const file = join(dir, "actions/sit-side.json");
    writeFileSync(file, JSON.stringify(sitSide([60, -60])));
    writeFileSync(
      join(dir, "scenes/rieng.json"),
      JSON.stringify({
        duration: 2,
        cast: [{ id: "a", y: 280, tracks: [{ clips: [{ action: "sit-side", start: 0 }] }] }],
      }),
    );
    const git = (...a) =>
      execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: dir });
    git("init", "-q");
    git("add", ".");
    git("commit", "-qm", "goc");
    writeFileSync(file, JSON.stringify(sitSide([70, -70])));
    const blind = await planReseat({ dir });
    assert.ok(blind.manual.some((m) => m.file === "actions/sit-side.json"));
    const r = await reseatWorkspace({ dir, before: "HEAD" });
    assert.deepEqual(r.problems, []);
    const y = read(dir, "scenes/rieng.json").cast[0].y;
    assert.equal(y, Math.round((280 + SIT_NOW - SIT_BEFORE) * 100) / 100);
  });
});
