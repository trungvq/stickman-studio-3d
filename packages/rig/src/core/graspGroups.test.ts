import { describe, expect, it } from "vitest";
import {
  FLAT_MAX,
  GRIP_GROUPS,
  SIZE_WARN,
  GRIP_CLEAR,
  checkChoice,
  checkGroup,
  choiceWarnings,
  groupFits,
  groupIntent,
  groupNeeds,
  holdDefaults,
  type GroupSpec,
} from "./graspGroups";
import { HAND_POSES } from "./hand";
import { handDims, itemGeom } from "./heldGeom";
import { GROUP_IDS, HeldItemSchema, parseHeldItem, type HeldItemSpec } from "./heldItem";
import type { V3 } from "./lens";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import khay from "./__fixtures__/held-v2/khay.json";
import bienLai from "./__fixtures__/held-v2/bien-lai.json";
import chaiDia from "./__fixtures__/held-v2/chai-dia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";
import dua from "./__fixtures__/held-v2/dua.json";
import ongNgheBan from "./__fixtures__/held-v2/ong-nghe-ban.json";
import tomHum from "./__fixtures__/held-v2/tom-hum.json";
import tuiHieu from "./__fixtures__/held-v2/tui-hieu.json";

const item = (json: unknown): HeldItemSpec => {
  const r = parseHeldItem(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const dims = handDims(1.61);
const geomOf = (json: unknown) => itemGeom(item(json));
const ids = (json: unknown) =>
  GROUP_IDS.filter((g) => groupNeeds(geomOf(json), g, dims).length > 0);

describe("bảng GRIP_GROUPS", () => {
  it("đủ 14 khoá, mỗi nhóm có nhãn tiếng Việt và biến thể", () => {
    expect(Object.keys(GRIP_GROUPS)).toEqual([...GROUP_IDS]);
    for (const id of GROUP_IDS) {
      const g = GRIP_GROUPS[id];
      expect(g.id).toBe(id);
      expect(g.label.length).toBeGreaterThan(2);
      expect(Object.keys(g.variants).length).toBeGreaterThan(0);
    }
  });

  it("chỉ `sheet`, `cylinder`, `palmBox`, `platform` và `carry` không `later`", () => {
    expect(GROUP_IDS.filter((g) => !GRIP_GROUPS[g].later)).toEqual([
      "sheet",
      "cylinder",
      "palmBox",
      "platform",
      "carry",
    ]);
  });

  it("mặc định nằm trong miền", () => {
    for (const id of GROUP_IDS) {
      const g = GRIP_GROUPS[id];
      for (const [key, c] of Object.entries(g.choices)) {
        if (c.default === undefined) continue;
        if (c.kind === "names") {
          if (c.values) expect(c.values, `${id}.${key}`).toContain(c.default);
        } else {
          expect(c.default, `${id}.${key}`).toBeGreaterThanOrEqual(c.min);
          expect(c.default, `${id}.${key}`).toBeLessThanOrEqual(c.max);
          for (const [lo, hi] of Object.values(c.byVariant ?? {})) {
            expect(c.default).toBeGreaterThanOrEqual(lo);
            expect(c.default).toBeLessThanOrEqual(hi);
          }
        }
      }
      const v = g.choices.variant;
      if (v?.kind === "names") {
        expect(Object.keys(g.variants).sort()).toEqual([...v.values!].sort());
        expect(v.default).toBeDefined();
      }
    }
  });

  it("nhóm đã làm chỉ dùng dáng có sẵn của `HAND_POSES`; dáng chưa soạn thì nhóm `later`", () => {
    for (const id of GROUP_IDS) {
      const g = GRIP_GROUPS[id];
      for (const v of Object.values(g.variants))
        for (const p of [v.pose?.open, v.pose?.closed])
          if (p && !(p.pose in HAND_POSES)) expect(g.later, `${id}:${p.pose}`).toBe(true);
    }
    expect(GRIP_GROUPS.pen.later).toBe(true);
    expect(GRIP_GROUPS.chopsticks.later).toBe(true);
  });

  it("tay phụ trỏ tới nhóm có thật", () => {
    for (const id of GROUP_IDS) {
      const s = GRIP_GROUPS[id].support;
      if (s) expect(GROUP_IDS).toContain(s.group);
    }
  });
});

describe("groupNeeds trên tám món", () => {
  // `platform`: mặt hộp bao chứa được 0,4·W × 0,6·L (đũa: hộp bao hai que), đáy chai
  it("bảng giá ra `sheet`, `platform`", () => {
    expect(ids(bangGia)).toEqual(["sheet", "platform"]);
  });

  it("điện thoại ra `sheet`, `palmBox` và `platform`", () => {
    expect(ids(dienThoai)).toEqual(["sheet", "palmBox", "platform"]);
  });

  it("biên lai ra `sheet`, `platform`, không ra `palmBox`", () => {
    expect(ids(bienLai)).toEqual(["sheet", "platform"]);
  });

  it("đũa, chai, quai túi ra `cylinder` (đũa không ra `sheet`); túi hiệu có `seats` mới ra `carry`", () => {
    expect(ids(dua)).toEqual(["cylinder", "platform"]);
    expect(ids(chaiDia)).toEqual(["cylinder", "platform"]);
    expect(ids(tuiHieu)).toEqual(["cylinder", "platform", "carry"]);
    expect(ids({ ...tuiHieu, seats: undefined })).toEqual(["cylinder", "platform"]);
  });

  it("đĩa tôm hùm ra `sheet` bằng cả tấm lẫn đĩa", () => {
    const f = groupNeeds(geomOf(tomHum), "sheet", dims);
    expect(f.map((x) => x.kind).sort()).toEqual(["disc", "slab"]);
  });

  it("ngưỡng theo cỡ tay: tay nhỏ thì điện thoại quá bề ngang `palmBox`", () => {
    const g = geomOf(dienThoai);
    expect(groupNeeds(g, "palmBox", handDims(2.16))).toHaveLength(1);
    expect(groupNeeds(g, "palmBox", handDims(1))).toHaveLength(0);
  });

  it("nhóm `later` không có khối hình nào dù món hợp", () => {
    expect(groupNeeds(geomOf(dua), "chopsticks", dims)).toEqual([]);
  });

  it("`cylinder`: tay cầm ống nghe ra một thanh, chai ra ba trụ tiện (thân, vai, cổ)", () => {
    expect(groupNeeds(geomOf(ongNgheBan), "cylinder", dims).map((f) => [f.kind, f.part])).toEqual([
      ["rod", "tay"],
    ]);
    expect(groupNeeds(geomOf(chaiDia), "cylinder", dims).map((f) => [f.kind, f.part])).toEqual([
      ["lathe", "than"],
      ["lathe", "vai"],
      ["lathe", "co"],
    ]);
  });

  it("nhóm chưa `later` thì đũa ra hai thanh cho `chopsticks`, trừ khi thiếu mốc `tip` có `dir`", () => {
    const open: GroupSpec = { ...GRIP_GROUPS.chopsticks, later: undefined };
    delete open.later;
    const g = geomOf(dua);
    expect(groupNeeds(g, open, dims)).toHaveLength(2);
    expect(groupNeeds(g, open, dims, item(dua).anchors)).toHaveLength(2);
    expect(groupNeeds(g, open, dims, {})).toEqual([]);
  });
});

describe("size theo 0,8 · W và 0,95 · W", () => {
  const bottle = (r: number) =>
    item({
      schemaVersion: 2,
      size: [2 * r, 40, 2 * r],
      anchors: {},
      shape: [{ cyl: r, from: [0, -20, 0], to: [0, 20, 0] }],
    });
  const open: GroupSpec = { ...GRIP_GROUPS.cylinder };
  delete open.later;

  it("dưới 0,8 · W im, từ 0,8 cảnh báo, quá 0,95 bị loại và lỗi `group`", () => {
    const fit = (r: number) => groupFits(itemGeom(bottle(r)), open, dims);
    expect(fit(0.5 * dims.W)[0].warn).toBe(false);
    expect(fit(SIZE_WARN * dims.W + 0.1)[0].warn).toBe(true);
    expect(fit(0.95 * dims.W - 0.1)[0].ratio).toBeCloseTo(0.95, 1);
    expect(fit(0.96 * dims.W)).toEqual([]);
    const err = checkGroup(itemGeom(bottle(0.96 * dims.W)), open, dims, { item: "chai" });
    expect(err[0]).toMatch(/quá tầm nắm của tay \(0,9 · W = /);
    expect(err[0]).toMatch(/cho nhóm `cylinder`/);
  });
});

describe("holdDefaults", () => {
  it("`sheet`: biến thể `pinch`, `along` 0,5, `slant` 0; `thumb` theo mặt quay về người cầm", () => {
    const g = geomOf(bangGia);
    expect(holdDefaults("sheet", g)).toMatchObject({
      variant: "pinch",
      along: 0.5,
      slant: 0,
      thumb: "front",
    });
    const back = [-g.F[0], -g.F[1], -g.F[2]] as V3;
    expect(holdDefaults("sheet", g, { toHolder: back }).thumb).toBe("back");
  });

  it("`sheet` nằm: `thumb` là `top`", () => {
    expect(holdDefaults("sheet", geomOf(tomHum)).thumb).toBe("top");
  });

  it("`palmBox`: `thumb` cùng bên với tay, `along` 0,4, `tilt` 20", () => {
    const g = geomOf(dienThoai);
    expect(holdDefaults("palmBox", g)).toEqual({ thumb: "right", along: 0.4, tilt: 20 });
    expect(holdDefaults("palmBox", g, { side: 1 }).thumb).toBe("left");
  });

  it("không khai mặc định cho `edge` (rig giải)", () => {
    expect(holdDefaults("sheet", geomOf(bangGia))).not.toHaveProperty("edge");
  });
});

describe("groupIntent", () => {
  const g = geomOf(dienThoai);

  it("`sheet`: mặt trước về người cầm, đầu trên lên", () => {
    const r = groupIntent("sheet", "dien-thoai@sheet", g);
    expect(r.face).toEqual({ axis: [...g.F], toward: "holderFace" });
    expect(r.roll).toEqual({ axis: [...g.U], toward: "up" });
  });

  it("`palmBox`: chỉ trục chính", () => {
    const r = groupIntent("palmBox", "dien-thoai@palmBox", g);
    expect(r.face?.toward).toBe("holderFace");
    expect(r.roll).toBeUndefined();
  });

  it("`up`, `face`, `roll` của chỗ cầm đè mặc định; `keep` bỏ hết", () => {
    const base = { item: "dien-thoai", group: "sheet" as const };
    expect(groupIntent("sheet", { ...base, up: "top" }, g).face).toEqual({
      axis: "top",
      toward: "up",
    });
    expect(groupIntent("sheet", { ...base, face: "camera" }, g).face).toEqual({
      axis: [...g.F],
      toward: "camera",
    });
    const axis = { axis: "speaker", toward: "camera" as const };
    expect(groupIntent("sheet", { ...base, face: axis }, g).face).toEqual(axis);
    expect(
      groupIntent("sheet", { ...base, roll: { axis: [1, 0, 0], toward: "up" } }, g).roll,
    ).toEqual({ axis: [1, 0, 0], toward: "up" });
    expect(groupIntent("sheet", { ...base, keep: true }, g)).toEqual({});
  });

  it("`platform`: trục ngược pháp tuyến mặt đỡ lên — khay `top`, phiếu đỡ mặt sau `front`", () => {
    const tray = geomOf(khay);
    expect(groupIntent("platform", "khay@platform", tray).face).toEqual({
      axis: [0, 1, 0],
      toward: "up",
    });
    const slip = geomOf({
      schemaVersion: 2,
      size: [40, 1.1, 68],
      front: [0, 1, 0],
      top: [0, 0, -1],
      anchors: {},
      shape: [{ box: [40, 1.1, 68], at: [0, 0.65, 0] }],
    });
    const f = groupIntent("platform", "phieu@platform", slip).face!;
    expect(f.toward).toBe("up");
    expect((f.axis as number[]).map((x) => x + 0)).toEqual([0, 1, 0]);
  });

  it("nhóm không có trục mặc định mà `face` khai đích trần thì ném lỗi", () => {
    expect(() => groupIntent("pen", { item: "but", group: "pen", face: "camera" }, g)).toThrow(
      /không có trục ý định mặc định/,
    );
  });
});

describe("checkChoice", () => {
  const phone = geomOf(dienThoai);
  const sheet = geomOf(bangGia);
  const hold = (h: object, group = "sheet") => ({ item: "mon", group, ...h }) as never;
  const check = (g: typeof sheet, group: keyof typeof GRIP_GROUPS, h: object) =>
    checkChoice(group, g, hold(h, group), dims);

  it("chỗ cầm hợp lệ và chuỗi viết tắt: không lỗi", () => {
    expect(check(sheet, "sheet", { edge: "right", thumb: "front", along: 0.3, slant: 20 })).toEqual(
      [],
    );
    expect(checkChoice("sheet", sheet, "bang-gia@sheet", dims)).toEqual([]);
    expect(check(phone, "palmBox", { thumb: "left", tilt: 10 })).toEqual([]);
  });

  it("`edge` lạ", () => {
    expect(check(sheet, "sheet", { edge: "front" })[0]).toMatch(
      /`edge: front` không có trên khối hình/,
    );
    expect(check(sheet, "sheet", { edge: 30 })[0]).toMatch(/`edge: 30`/);
    expect(check(geomOf(tomHum), "sheet", { edge: 30 })).toEqual([]);
    expect(check(geomOf(tomHum), "sheet", { edge: "right" })).toEqual([]);
  });

  it("`thumb` không có trên khối hình hay ngoài miền", () => {
    expect(check(sheet, "sheet", { thumb: "top" })[0]).toMatch(/`thumb: top`/);
    expect(check(phone, "palmBox", { thumb: "up" })[0]).toMatch(/ngoài miền \(left, right\)/);
  });

  it("`on` ngoài `carry`", () => {
    expect(check(sheet, "sheet", { on: "elbow" })[0]).toMatch(/`on` chỉ có ở nhóm `carry`/);
    expect(check(sheet, "sheet", { yaw: 10 })[0]).toMatch(/`yaw` chỉ có ở nhóm `carry`/);
  });

  it("`both` với nhóm một tay không có tay phụ", () => {
    const one = { ...GRIP_GROUPS.palmBox, support: undefined };
    const h = hold({ both: true }, "palmBox");
    expect(checkChoice(one, phone, h, dims)[0]).toMatch(/một tay, không có `both`/);
    expect(checkChoice("palmBox", phone, h, dims).join()).not.toMatch(/`both`/);
    expect(check(sheet, "sheet", { both: true })).toEqual([]);
  });

  it("nhóm `later`", () => {
    expect(check(sheet, "pen", {})[0]).toMatch(/nhóm `pen` \(Bút\) chưa làm/);
  });

  it("`carry`: thiếu `on`, món không có `seats[on]`, món không có chỗ treo", () => {
    const tui = geomOf(tuiHieu);
    expect(check(tui, "carry", { on: "elbow" })).toEqual([]);
    expect(check(tui, "carry", { on: "shoulder", yaw: 30 })).toEqual([]);
    expect(check(tui, "carry", {})).toEqual([
      "`mon@carry`: thiếu `on`: chỗ treo trên cánh tay (elbow, shoulder)",
    ]);
    const elbow = geomOf({ ...tuiHieu, seats: { elbow: "treoKhuyu" } });
    expect(check(elbow, "carry", { on: "shoulder" })).toEqual([
      "`mon@carry`: món không có chỗ treo `seats.shoulder` (có: elbow)",
    ]);
    const bare = check(sheet, "carry", { on: "elbow" });
    expect(bare).toHaveLength(1);
    expect(bare[0]).toMatch(/không có khối hình nào cho nhóm `carry` \(Treo\).*chỗ treo `seats`/);
    expect(check(tui, "carry", { on: "elbow", both: true })[0]).toMatch(/một tay/);
  });

  it("`flat` trên tấm dày quá `FLAT_MAX · W` ở mép (đo trên hình): báo, gợi biến thể khác", () => {
    const slab = (shape: object[], t: number) =>
      item({
        schemaVersion: 2,
        size: [60, t, 40],
        front: [0, 1, 0],
        top: [0, 0, -1],
        anchors: {},
        shape,
      });
    const t = FLAT_MAX * dims.W + 0.5;
    const thick = slab([{ box: [60, t, 40], at: [0, t / 2, 0] }], t);
    // tấm có chân: hộp bao dày, mép chỉ có lớp mặt dày 1
    const plate = slab(
      [
        { box: [60, 1, 40], at: [0, t - 0.5, 0] },
        { box: [40, t - 1, 30], at: [0, (t - 1) / 2, 0] },
      ],
      t,
    );
    const run = (s: HeldItemSpec, h: object) =>
      checkChoice("sheet", itemGeom(s), hold(h), dims, undefined, s.shape);
    const out = run(thick, { variant: "flat" });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(
      /biến thể `flat` cần bề dày ở mép ≤ 0,24·W \(\d+,\d\), mép dày \d+,\d: ngón cái không vắt qua mép — dùng `pinch` hay `rim`/,
    );
    expect(run(thick, { variant: "pinch" })).toEqual([]);
    expect(run(thick, {})).toEqual([]);
    expect(run(plate, { variant: "flat", edge: "right" })).toEqual([]);
    expect(run(item(bangGia), { variant: "flat" })).toEqual([]);
  });

  it("`along` ngoài 0–1, tên lạ", () => {
    expect(check(sheet, "sheet", { along: 1.2 })[0]).toMatch(/`along: 1.2` ngoài miền \[0, 1\]/);
    expect(check(sheet, "sheet", { along: -0.1 })).toHaveLength(1);
    expect(check(sheet, "sheet", { along: "mid" })).toEqual([]);
    expect(check(sheet, "sheet", { along: "top" })[0]).toMatch(/không phải tên gọi/);
  });

  it("`tilt` ngoài miền `palmBox`, `slant` theo biến thể", () => {
    expect(check(phone, "palmBox", { tilt: 40 })[0]).toMatch(/`tilt: 40` ngoài miền \[0, 25\]/);
    expect(check(phone, "palmBox", { tilt: -1 })).toHaveLength(1);
    expect(check(sheet, "sheet", { slant: 80 })[0]).toMatch(/\[-60, 60\]/);
    expect(check(sheet, "sheet", { variant: "flat", slant: 80 })).toEqual([]);
    expect(check(sheet, "sheet", { variant: "rim", slant: 60 })[0]).toMatch(/\[-45, 45\]/);
  });

  it("trường không thuộc nhóm, biến thể lạ", () => {
    expect(check(sheet, "sheet", { tilt: 10 })[0]).toMatch(/`tilt` không thuộc nhóm `sheet`/);
    expect(check(phone, "palmBox", { edge: "top" })[0]).toMatch(
      /`edge` không thuộc nhóm `palmBox`/,
    );
    expect(check(sheet, "sheet", { variant: "grab" })[0]).toMatch(/biến thể `grab`/);
  });

  it("`part` không có hay `grip: false`", () => {
    expect(check(sheet, "sheet", { part: "nhan" })[0]).toMatch(/không có phần `nhan`/);
    expect(check(geomOf(dua), "sheet", { part: "nut" })[0]).toMatch(/`grip: false`/);
  });

  it("món không có khối hình cho nhóm: lỗi `group` nêu khối hình món có", () => {
    const err = check(geomOf(dua), "sheet", {});
    expect(err).toHaveLength(1);
    expect(err[0]).toMatch(/không có khối hình nào cho nhóm `sheet`/);
    expect(err[0]).toMatch(/thanh `que`/);
    expect(check(geomOf(bienLai), "palmBox", {})[0]).toMatch(/không có khối hình nào/);
  });

  it("`part` chọn phần hỏng thì gợi phần khác còn vừa", () => {
    const g = geomOf({
      schemaVersion: 2,
      size: [60, 3, 60],
      anchors: {},
      shape: [
        { box: [1, 1, 1], at: [0, 0, 0], part: "nho" },
        { box: [50, 1, 50], at: [0, 0, 5], part: "khay" },
      ],
    });
    const err = check(g, "sheet", { part: "nho" });
    expect(err[0]).toMatch(/phần `nho` không có khối hình/);
    expect(err[0]).toMatch(/phần khác còn vừa: `khay`/);
    expect(check(g, "sheet", { part: "khay" })).toEqual([]);
  });
});

describe("`cylinder`: biên phần `grip: false`", () => {
  const W = dims.W;
  /** Thanh tròn r 3 dọc y, đoạn bám giữa dài `len`; `caps` đầu bị phần `grip: false` riêng (dài 10) chặn */
  const rod = (len: number, caps: ("lo" | "hi")[]) =>
    itemGeom(
      item({
        schemaVersion: 2,
        size: [6, len + 20, 6],
        anchors: {},
        parts: { lo: { grip: false }, hi: { grip: false } },
        shape: [
          { cyl: 3, from: [0, 0, 0], to: [0, len, 0], part: "than" },
          ...caps.map((c) => ({
            cyl: 3,
            from: [0, c === "lo" ? -10 : len, 0],
            to: [0, c === "lo" ? 0 : len + 10, 0],
            part: c,
          })),
        ],
      }),
    );
  const fits = (g: ReturnType<typeof rod>) => groupNeeds(g, "cylinder", dims).length > 0;

  it("`needs`: đoạn bám liền ≥ 0,6·W chứa tâm nắm cách phần `grip: false` ≥ 0,3·W", () => {
    expect(GRIP_CLEAR).toBe(0.3);
    expect(fits(rod(0.6 * W + 0.1, ["lo", "hi"]))).toBe(true);
    expect(fits(rod(0.6 * W - 0.1, ["lo", "hi"]))).toBe(false);
    expect(fits(rod(0.6 * W + 0.1, ["hi"]))).toBe(true);
    expect(checkGroup(rod(0.6 * W - 0.1, ["lo", "hi"]), "cylinder", dims)[0]).toMatch(
      /tâm nắm cách phần `grip: false` ≥ 0,3·W/,
    );
  });

  it("`choiceWarnings`: `along` sát loa, mic báo phần nào, khoảng cách và `along` rig kẹp về; `checkChoice` không lỗi", () => {
    const g = geomOf(ongNgheBan);
    const warn = (along: number | string) =>
      choiceWarnings("cylinder", g, { item: "ong-nghe", group: "cylinder", along } as never, dims);
    const hi = warn(0.95);
    expect(hi).toHaveLength(1);
    expect(hi[0]).toMatch(/`along: 0.95` sát phần `grip: false` `loa`/);
    // W 13,5: 0,3·W = 4,1 trên đoạn 22
    expect(hi[0]).toMatch(/cách nó 1,1 dọc trục, dưới 0,3·W \(4,1\)/);
    expect(hi[0]).toMatch(/kẹp về `along` 0,82, khai `along` ≤ 0,82/);
    expect(warn(0)[0]).toMatch(/`mic`.*khai `along` ≥ 0,18/);
    expect(warn(0.5)).toEqual([]);
    expect(warn("high")).toEqual([]);
    expect(
      checkChoice(
        "cylinder",
        g,
        { item: "ong-nghe", group: "cylinder", along: 0.95 } as never,
        dims,
      ),
    ).toEqual([]);
    // cổ chai nối miệng: thân, vai, cổ cùng một đoạn bám, báo một dòng
    const chai = choiceWarnings(
      "cylinder",
      geomOf(chaiDia),
      { item: "chai", group: "cylinder", along: 0.98 } as never,
      dims,
    );
    expect(chai).toHaveLength(1);
    expect(chai[0]).toMatch(/`mieng`/);
  });

  it("`cylinder` `flat` chỉ áp trên thanh: ống nghe hợp lệ, chai báo lỗi", () => {
    const flat = (spec: unknown, item: string) =>
      checkChoice(
        "cylinder",
        geomOf(spec),
        { item, group: "cylinder", variant: "flat" } as never,
        dims,
      );
    expect(flat(ongNgheBan, "ong-nghe")).toEqual([]);
    expect(flat(chaiDia, "chai")).toEqual([
      expect.stringMatching(/biến thể `flat` chỉ áp trên `rod`/),
    ]);
  });
});

describe("`checkV2` nối `topProblems`", () => {
  it("món có miệng mà `top` lệch quá 10° bị báo ở đường `top`", () => {
    const cup = (top: V3) => ({
      schemaVersion: 2,
      size: [10, 12, 10],
      anchors: {},
      top,
      shape: [
        { cyl: 5, from: [0, 0, 0], to: [0, 1, 0] },
        { cyl: 5, from: [0, 1, 0], to: [0, 12, 0], wall: 0.5 },
      ],
    });
    expect(HeldItemSchema.safeParse(cup([0, 1, 0])).success).toBe(true);
    const r = HeldItemSchema.safeParse(cup([0, 0, 1]));
    expect(r.success).toBe(false);
    expect(
      r.error?.issues.some((i) => i.path[0] === "top" && /lệch hướng miệng/.test(i.message)),
    ).toBe(true);
  });
});
