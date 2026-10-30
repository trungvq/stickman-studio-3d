import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as rig from "@stickman3d/rig/core";
import { checkWorkspace, COMMON, heldFrame, heldOptions, heldRows, loadHands } from "./lib.mjs";

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../rig/src/core/__fixtures__/held-v2/bang-gia.json",
);
const BANG = rig.parseHeldItem(JSON.parse(readFileSync(FIXTURE, "utf8"))).data;

const pkg = (held) => {
  const dir = mkdtempSync(join(tmpdir(), "held-"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "x", ...(held !== undefined && { stickman: { held } }) }),
  );
  return dir;
};

const fingers = (v = -0.1) => ({ thumb: v, index: v, middle: v, ring: v, pinky: v });
const grasp = (arm = {}) => ({
  item: "bang-gia",
  group: "sheet",
  mode: "item",
  t0: 0,
  choice: { edge: "right", along: 0.33, thumb: "front", variant: "pinch", featureIndex: 0 },
  by: { edge: "scene", along: "scene", thumb: "scene", variant: "rig" },
  arm: {
    phi: 20,
    wrist: { turn: 10, bend: 10, dev: 5, over: 0, off: 0 },
    body: 0,
    bodyRatio: 0,
    gap: 0,
    ...arm,
  },
});
const base = {
  id: "a",
  hand: "R",
  item: "bang-gia",
  pose: "sheet",
  follow: "wrist",
  acted: rig.handVec({}),
  pierce: { depth: 0.1, core: -2, piece: "index1" },
  gaps: { thumb: -0.1, index: -0.1, fingers: -0.1, palm: 3 },
  grip: -0.5,
  palm: { gap: 3, angle: 20 },
  rel: { p: [0, -8, 0], q: [0, 0, 0, 1] },
  at: [0, -150, 0],
  obj: 7,
  s: 1,
};
/** Chỗ cầm nhóm: món đặt trước, ngón chạm, lòng tay tự do */
const v2 = (o = {}) => ({
  ...base,
  key: "7|@sheet/pinch//right/front",
  hold: "bang-gia@sheet/pinch//right/front",
  fingers: fingers(),
  roles: {
    thumb: "press",
    index: "press",
    middle: "press",
    ring: "press",
    pinky: "press",
    palm: "free",
  },
  grasp: grasp(),
  ...o,
});
/** Đồ cầm đường cũ: không có chỗ cầm nhóm, không `grasp` */
const old = { ...base, key: "7|wrist" };

const scene = () => {
  const r = rig.parseScene({
    duration: 2,
    lens: { eye: [0, -300, -900], yaw: 0, pitch: 10, f: 800, cx: 0, cy: 0 },
    cast: [{ id: "a", world: { at: [0, 0, 0] }, tracks: [] }],
  });
  return rig.resolveScene(r.data, {}, {}, {}, { "bang-gia": BANG });
};
/** Cảnh three giả: mọi giây `a` hiện và `heldHands` trả `hands` */
const world = (hands, spy) => ({
  scene: {
    root: { updateMatrixWorld() {} },
    pose: () => ({ a: { root: { visible: true } } }),
  },
  U: 1,
  heldHands: (f, id, o) => {
    spy?.(o);
    return hands;
  },
});

describe("check: đồ cầm tay chỗ cầm nhóm", () => {
  it("`heldFrame`: đường cũ trả cùng `HeldHand`, chỗ cầm nhóm mang `grasp.choice`", () => {
    const rt = scene();
    const one = heldFrame(rt, world([old]))(0.5);
    assert.deepEqual(one, [old]);
    assert.equal(one[0].grasp, undefined);
    const two = heldFrame(rt, world([v2()]))(0.5);
    assert.equal(two[0].grasp.choice.variant, "pinch");
    assert.equal(two[0].grasp.choice.edge, "right");
  });

  it("`heldOptions`: `sink`, `wrist`, `arm`, `elbow`, `oppose` lấy hằng của rig, `package.json` đè; `grip` khai thì đánh dấu", () => {
    const d = heldOptions(pkg());
    assert.equal(d.sink, rig.HELD_SINK);
    assert.equal(d.oppose, rig.HELD_OPPOSE);
    assert.equal(d.wrist, rig.HELD_WRIST);
    assert.equal(d.arm, rig.HELD_ARM);
    assert.equal(d.elbow, rig.HELD_ELBOW);
    assert.equal(d.gripDeclared, undefined);
    const o = heldOptions(pkg({ sink: 2, wrist: 9, arm: 0.5, grip: 8 }));
    assert.deepEqual([o.sink, o.wrist, o.arm, o.grip, o.gripDeclared], [2, 9, 0.5, 8, true]);
    assert.match(heldOptions(pkg({ sink: -1 })).error, /stickman\.held phải là false hay \{.*sink/);
  });

  const run = (hands, held = heldOptions(pkg())) => {
    const rows = [];
    heldRows(
      { held, worldRel: "world.ts" },
      scene(),
      world(hands),
      (msg, extra) => rows.push({ msg, ...extra }),
      false,
    );
    return rows;
  };

  it("đường cũ không thành lỗi; món đặt trước ngoài tầm với (`reach`) thành lỗi", () => {
    assert.deepEqual(run([old]), []);
    assert.deepEqual(run([v2()]), []);
    const rows = run([v2({ grasp: grasp({ gap: rig.AIM_GAP + 2 }) })]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].error, true);
    assert.match(rows[0].key, /^held:reach\|a\|R\|bang-gia$/);
  });

  it("`wrist` vượt kẹp là lỗi, `arm` chỉ là cảnh báo", () => {
    const over = grasp({ wrist: { turn: 100, bend: 0, dev: 0, over: 10, off: 2.5 } });
    const rows = run([v2({ grasp: over })]);
    assert.deepEqual(
      rows.map((r) => [r.key.split("|")[0], r.error]),
      [["held:wrist", true]],
    );
    const arm = run([v2({ grasp: grasp({ body: 4, bodyRatio: rig.HELD_ARM + 0.2 }) })]);
    assert.deepEqual(
      arm.map((r) => [r.key.split("|")[0], r.error]),
      [["held:arm", undefined]],
    );
  });

  it("ngưỡng `sink` từ cấu hình: lún 1,2 báo ở mặc định, im khi `sink` khai 2", () => {
    const deep = v2({ fingers: { ...fingers(), index: -1.2 } });
    assert.deepEqual(
      run([deep]).map((r) => r.key.split("|")[0]),
      ["held:sink"],
    );
    assert.deepEqual(run([deep], heldOptions(pkg({ sink: 2 }))), []);
  });

  it("`grip` khai ở `package.json` thắng ngưỡng theo nhóm", () => {
    const far = v2({ grip: 6 });
    assert.deepEqual(
      run([far]).map((r) => r.key.split("|")[0]),
      ["held:grip"],
    );
    assert.deepEqual(run([far], heldOptions(pkg({ grip: 8 }))), []);
    assert.deepEqual(
      run([v2({ grip: 2 })], heldOptions(pkg({ grip: 1 }))).map((r) => r.key.split("|")[0]),
      ["held:grip"],
    );
  });
});

describe("loadHands", () => {
  it("hai lớp theo tên không đuôi, bản của repo đè bản chung; file hỏng hay tên sai thì bỏ", () => {
    const dir = mkdtempSync(join(tmpdir(), "hands-"));
    mkdirSync(join(dir, "hands"));
    const own = { fingers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
    const put = (f, o) => writeFileSync(join(dir, "hands", f), JSON.stringify(o));
    put("peace.json", own);
    put("vay.json", { ...own, note: "vẫy" });
    put("hong.json", { fingers: [1, 2] });
    put("Hoa.json", own);
    put("fist.json", own);
    const common = loadHands([COMMON.hands]);
    assert.ok(common.peace.note);
    const lib = loadHands([join(dir, "hands"), COMMON.hands]);
    assert.equal(lib.vay.note, "vẫy");
    for (const n of ["hong", "Hoa", "fist"]) assert.equal(lib[n], undefined, n);
    assert.deepEqual(lib.peace.fingers, own.fingers);
    assert.equal(lib.peace.schemaVersion, rig.HAND_SHAPE_VERSION);
  });
});

describe("dáng tay của lớp chung", () => {
  it("mọi `hands/*.json` của lớp chung đều nạp được", () => {
    const files = readdirSync(COMMON.hands)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -5));
    assert.deepEqual(Object.keys(loadHands([COMMON.hands])).sort(), files.sort());
  });
});

describe("hành động của lớp chung", () => {
  it("dáng tay của `keys[].hand` đều có sẵn hay ở `hands/` của lớp chung", () => {
    const lib = loadHands([COMMON.hands]);
    const bad = readdirSync(COMMON.actions)
      .filter((f) => f.endsWith(".json") && f !== "index.json")
      .flatMap((f) => {
        const a = rig.parseAction(JSON.parse(readFileSync(join(COMMON.actions, f), "utf8")));
        return a.success ? rig.actionHandShapeProblems(a.data, lib).map((p) => `${f}: ${p}`) : [];
      });
    assert.deepEqual(bad, []);
  });
});

describe("check: dáng tay của thư viện ở `keys[].hand`", () => {
  it("dáng của hai lớp qua; tên không có ở đâu là lỗi ở file hành động", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hands-check-"));
    for (const d of ["actions", "hands", "scenes", "characters", "pieces"]) mkdirSync(join(dir, d));
    const json = (rel, v) => writeFileSync(join(dir, rel), JSON.stringify(v));
    json("package.json", { name: "x" });
    json("hands/chu-v.json", { fingers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
    const act = (name, armNear) => ({
      name,
      end: "hold",
      mask: ["hand"],
      keys: [{ t: 0, pose: {}, hand: { armNear, armFar: "fist" } }],
    });
    json("actions/vay.json", act("vay", "peace"));
    json("actions/chu.json", act("chu", { pose: "chu-v", w: 0.5 }));
    json("actions/la.json", act("la", "khong-co"));
    const r = await checkWorkspace({ dir, only: "ref" });
    const errs = r.problems.filter((p) => p.level === "lỗi").map((p) => p.msg);
    assert.deepEqual(
      errs.filter((m) => m.startsWith("actions/")),
      [
        "actions/la.json: `keys[].hand` gọi dáng tay `khong-co` — không phải dáng có sẵn của rig (`HAND_POSES`), không có `hands/khong-co.json` (docs/01-rig.md#dáng-tay-có-tên)",
      ],
    );
  });
});
