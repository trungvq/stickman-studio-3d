import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { checkWorkspace, snapOptions } from "./lib.mjs";

const LENS = { eye: [0, -300, -1500], yaw: 0, pitch: 6, f: 800, cx: 0, cy: 0 };
const STAND = {
  name: "dung-3d",
  authoredAt: "side",
  end: "hold",
  mask: ["armFar", "armNear", "legFar", "legNear", "torso"],
  keys: [
    {
      t: 0,
      pose: { armFar: [0, 0, 0], armNear: [0, 0, 0], legFar: [0, 0], legNear: [0, 0], torso: 0 },
    },
  ],
};
const coverKeys = [
  { t: 0, pose: { armNear: [-20, -30, 0], armFar: [20, 30, 0] }, ease: "smooth" },
  { t: 1, pose: { armNear: [-150, -100, 0], armFar: [150, 100, 0] } },
];
const COVER = { name: "che", end: "hold", duration: 0.6, keys: coverKeys };
const COVER3D = { ...COVER, name: "che-3d", authoredAt: "side" };
const RAISE = {
  name: "gio",
  end: "hold",
  mask: ["armNear"],
  keys: [{ t: 0, pose: { armNear: [-170, 0, 0] } }],
};

/** Người 3D đứng, track `tay` vào `arms` ở giây 1 */
const person3d = (name, arms, clip = {}) => ({
  name,
  duration: 2,
  lens: LENS,
  cast: [
    {
      id: "a",
      world: { at: [0, 0, 0], yaw: 155 },
      tracks: [
        { name: "than", clips: [{ action: "dung-3d", start: 0 }] },
        { name: "tay", clips: [{ action: arms, start: 1, blend: 0.35, ...clip }] },
      ],
    },
  ],
});
/** Người 2D cắt cứng sang `gio` ở giây 1 */
const cut2d = (name, clip = {}) => ({
  name,
  duration: 2,
  cast: [
    {
      id: "b",
      tracks: [
        {
          clips: [
            { action: "dung-3d", start: 0 },
            { action: "gio", start: 1, blend: 0, ...clip },
          ],
        },
      ],
    },
  ],
});

function workspace(stickman = {}, episode = null) {
  const dir = mkdtempSync(join(tmpdir(), "stickman-snap-"));
  for (const d of ["scenes", "actions", "characters", "pieces"])
    mkdirSync(join(dir, d), { recursive: true });
  const json = (rel, v) => writeFileSync(join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
  json("package.json", { name: "thu", stickman: { frozen: "^old-", ...stickman } });
  for (const a of [STAND, COVER, COVER3D, RAISE]) json(`actions/${a.name}.json`, a);
  json("actions/vong.json", { name: "vong", end: "wrap", keys: coverKeys });
  json("scenes/loi.json", person3d("loi", "che"));
  json("scenes/old-loi.json", person3d("old-loi", "che"));
  json("scenes/sua.json", person3d("sua", "che-3d"));
  json("scenes/cat.json", cut2d("cat"));
  json("scenes/cat-co-y.json", cut2d("cat-co-y", { snap: true }));
  if (episode) {
    mkdirSync(join(dir, "episodes"));
    json("episodes/tap.json", episode);
  }
  return dir;
}

const of = (r, scene) => r.problems.filter((p) => p.msg.startsWith(`scenes/${scene}.json`));
const snaps = (r, scene) => of(r, scene).filter((p) => p.msg.includes("trong một khung"));

describe("check: hành động 2D trên người 3D và giật trên hình", () => {
  it("người 3D hoà `side` → hành động 2D: lỗi tĩnh kèm bản `-3d`, và cú giật kèm lý do", async () => {
    const r = await checkWorkspace({ dir: workspace() });
    const side = of(r, "loi").filter((p) => p.level === "lỗi");
    assert.equal(side.length, 1, JSON.stringify(r.problems, null, 2));
    assert.match(side[0].msg, /`a` clip `che` \(track `tay`, giây 1\.00\).*có sẵn `che-3d`/);
    const jolt = snaps(r, "loi");
    assert.equal(jolt.length, 1, JSON.stringify(r.problems, null, 2));
    assert.equal(jolt[0].level, "cảnh báo");
    assert.match(
      jolt[0].msg,
      /^scenes\/loi\.json: `a` giây 1\.\d\d: (bàn tay|cổ tay|khuỷu) (phải|trái) nhảy \d+ px/,
    );
    assert.match(
      jolt[0].msg,
      /cờ `lift` của tay gần, tay xa lật giữa đoạn hoà track trống → `che`/,
    );
  });

  it("bản soạn ở `side` sạch; cảnh khớp `stickman.frozen` im", async () => {
    const r = await checkWorkspace({ dir: workspace() });
    assert.deepEqual(of(r, "sua"), []);
    assert.deepEqual(of(r, "old-loi"), []);
    assert.ok(r.frozen > 0);
  });

  it("người 2D cắt cứng bị bắt; clip khai `snap` thì im", async () => {
    const r = await checkWorkspace({ dir: workspace() });
    assert.equal(snaps(r, "cat").length, 1, JSON.stringify(r.problems, null, 2));
    assert.match(snaps(r, "cat")[0].msg, /`gio` \(track `#0`\) vào không hoà \(`blend` 0\)/);
    assert.deepEqual(of(r, "cat-co-y"), []);
  });

  it("hành động `wrap` nhảy ở đường nối vòng: cảnh báo ở file hành động", async () => {
    const r = await checkWorkspace({ dir: workspace() });
    const got = r.problems.filter((p) => p.msg.startsWith("actions/vong.json"));
    assert.ok(got.length > 0);
    assert.match(got[0].msg, /`end: "wrap"` mà `arm(Near|Far)` ở mốc cuối/);
  });

  it("`--scene` chỉ đo cảnh khớp", async () => {
    const r = await checkWorkspace({ dir: workspace(), scene: "^cat$" });
    assert.ok(
      r.problems.every((p) => !p.msg.startsWith("scenes/") || p.msg.startsWith("scenes/cat.json")),
    );
    assert.equal(snaps(r, "cat").length, 1);
  });

  it("chỉ đo quãng shot đưa lên hình; hai shot nối tiếp cùng cảnh không có chỗ cắt", async () => {
    const shot = (id, from, to) => ({ id, scene: "cat", from, to });
    const later = await checkWorkspace({
      dir: workspace({}, { shots: [shot("a", 1.2, 2)] }),
      scene: "^cat$",
    });
    assert.deepEqual(snaps(later, "cat"), []);
    const split = await checkWorkspace({
      dir: workspace({}, { shots: [shot("a", 0, 1), shot("b", 1, 2)] }),
      scene: "^cat$",
    });
    assert.equal(snaps(split, "cat").length, 1, JSON.stringify(split.problems, null, 2));
    const cut = await checkWorkspace({
      dir: workspace({}, { shots: [shot("a", 0, 1), { id: "x", duration: 1 }, shot("b", 1, 2)] }),
      scene: "^cat$",
    });
    assert.deepEqual(snaps(cut, "cat"), []);
  });

  it("`stickman.snap` nâng ngưỡng hay tắt; sai kiểu là lỗi", async () => {
    assert.deepEqual(
      snaps(await checkWorkspace({ dir: workspace({ snap: { px: 900 } }) }), "cat"),
      [],
    );
    assert.deepEqual(snaps(await checkWorkspace({ dir: workspace({ snap: false }) }), "loi"), []);
    const bad = await checkWorkspace({ dir: workspace({ snap: { px: -1 } }) });
    assert.ok(
      bad.problems.some(
        (p) => p.level === "lỗi" && p.msg.startsWith("package.json: stickman.snap"),
      ),
    );
    assert.deepEqual(snapOptions(workspace({ snap: { k: 3 } })), { px: 12, k: 3, fps: 60 });
  });
});
