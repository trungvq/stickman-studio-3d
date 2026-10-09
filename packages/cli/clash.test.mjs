import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import * as rig from "@stickman3d/sketch";
import { checkWorkspace } from "./lib.mjs";

const TOP = -150;
const SEAT = -94.5;
const X = -230;
const LENS = { eye: [-500, -300, -700], yaw: 21, pitch: 12, f: 800, cx: 0, cy: 0 };
const SIT = {
  name: "ngoi-3d",
  duration: 2,
  authoredAt: "side",
  mask: ["armFar", "armNear", "legFar", "legNear", "torso"],
  keys: [
    {
      t: 0,
      pose: {
        armFar: [11, 42, 0],
        armNear: [11, 42, 0],
        legFar: [90, -90],
        legNear: [90, -90],
        torso: 3,
      },
    },
  ],
};
// Bàn mặt trên y −150, ghế mặt ngồi y −94,5 dưới hông; `touch` của cốc cho phép đầu kề miệng cốc
const LOP = `
import { bar, box } from "@stickman3d/fx";
const TONE = { top: "#a00", lit: "#0a0", side: "#00a" };
const ban = {
  name: "ban",
  at: { at: [0, 0, 0] },
  parts: [
    { v: box(-150, 150, ${TOP}, ${TOP + 6}, -80, 80), tone: TONE },
    { v: bar([-140, 0, -70], [-140, ${TOP + 6}, -70], 4), tone: TONE },
  ],
};
const ghe = {
  name: "ghe",
  at: { at: [${X}, 0, 0] },
  parts: [{ v: box(-30, 30, ${SEAT}, ${SEAT + 6}, -30, 30), tone: TONE }],
};
export const CODE_LAYERS = [
  { name: "phong", scenes: ["lan", "dung", "old-lan"], solids: () => [ban, ghe] },
];
`;

function scene(name, hands) {
  return {
    name,
    duration: 1,
    lens: LENS,
    cast: [
      {
        id: "a",
        base: "sit",
        world: { at: [X, SEAT, 0], yaw: 0, sit: true, hands: [{ t: 0, ...hands }] },
        tracks: [{ clips: [{ action: "ngoi-3d", start: 0 }] }],
      },
    ],
  };
}

/** Đích hai tay trên mặt bàn bằng `handsOn`; `dy` hạ cổ tay xuống dưới mặt */
function hands(dy = 0) {
  const bare = scene("x", {});
  bare.cast[0].world = { at: [X, SEAT, 0], yaw: 0, sit: true };
  const r = rig.parseScene(bare);
  const rt = rig.resolveScene(r.data, { "ngoi-3d": rig.parseAction(SIT).data });
  const c = rig.defaultCharacter();
  const sp = rig.sceneAt(rt, "a", 0, c.rig.height, rig.body3(c));
  const on = rig.handsOn(c, sp.pose, sp.world, {
    y: TOP,
    poly: [
      [-150, -80],
      [150, -80],
      [150, 80],
      [-150, 80],
    ],
  });
  const at = (h) => ({ at: [h.at[0], h.at[1] + dy, h.at[2]] });
  return { right: at(on.right), left: at(on.left) };
}

function workspace(stickman = {}) {
  const dir = mkdtempSync(join(tmpdir(), "stickman-clash-"));
  for (const d of ["scenes", "actions", "characters", "pieces", "src"])
    mkdirSync(join(dir, d), { recursive: true });
  const json = (rel, v) => writeFileSync(join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
  json("package.json", {
    name: "thu",
    stickman: { layers: "src/lop.ts", frozen: "^old-", ...stickman },
  });
  writeFileSync(join(dir, "src/lop.ts"), LOP);
  json("actions/ngoi-3d.json", SIT);
  json("scenes/lan.json", scene("lan", hands(30)));
  json("scenes/old-lan.json", scene("old-lan", hands(30)));
  json("scenes/dung.json", scene("dung", hands()));
  return dir;
}

const clashes = (r) => r.problems.filter((p) => p.msg.includes("người lồng vào đồ"));
const overdraws = (r) => r.problems.filter((p) => p.msg.includes("vẽ sai thứ tự"));

describe("check: người 3D lồng vào đồ", () => {
  it("báo cẳng tay xuyên mặt bàn; tay đặt bằng `handsOn` và cảnh đóng băng thì im", async () => {
    const r = await checkWorkspace({ dir: workspace() });
    const got = clashes(r);
    assert.ok(got.length > 0, JSON.stringify(r.problems, null, 2));
    for (const p of got) {
      assert.equal(p.level, "cảnh báo");
      assert.match(
        p.msg,
        /^scenes\/lan\.json: người lồng vào đồ — a\.forearm(Near|Far) ↔ ban \(mảnh 0\) lấn \d+\.\d ở giây \d\.\d\d · giây 0\.00–1\.00$/,
      );
    }
  });

  it("`stickman.clash.tol` nâng ngưỡng", async () => {
    assert.deepEqual(clashes(await checkWorkspace({ dir: workspace({ clash: { tol: 50 } }) })), []);
  });

  it("người ngồi bàn, ghế xếp đúng độ sâu: không báo vẽ sai thứ tự, kể cả cảnh tay xuyên bàn", async () => {
    const r = await checkWorkspace({ dir: workspace() });
    assert.deepEqual(overdraws(r), [], JSON.stringify(r.problems, null, 2));
    assert.ok(!r.problems.some((p) => p.msg.includes("không đo được")));
  });

  it("`scene` chỉ soi cảnh khớp; không khớp cảnh nào là lỗi", async () => {
    const dir = workspace();
    const lan = await checkWorkspace({ dir, scene: "^lan$" });
    assert.deepEqual(lan.scenes, ["lan"]);
    assert.ok(clashes(lan).length > 0);
    assert.ok(
      lan.problems.every((p) => p.msg.startsWith("scenes/lan.json")),
      lan.problems,
    );
    assert.deepEqual((await checkWorkspace({ dir, scene: "^dung$" })).problems, []);
    const none = await checkWorkspace({ dir, scene: "^khong$" });
    assert.deepEqual(
      none.problems.map((p) => p.level),
      ["lỗi"],
    );
  });
});
