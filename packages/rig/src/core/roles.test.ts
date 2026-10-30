import { describe, expect, it } from "vitest";
import binh from "../../../../common/held/binh.json";
import but from "../../../../common/held/but.json";
import chen from "../../../../common/held/chen.json";
import coc from "../../../../common/held/coc.json";
import dien_thoai from "../../../../common/held/dien-thoai.json";
import khay from "../../../../common/held/khay.json";
import ly from "../../../../common/held/ly.json";
import tui from "../../../../common/held/tui.json";
import vali from "../../../../common/held/vali.json";
import { HELD_VERSION, heldMinVersion, migrateHeldItem, parseHeldItem } from "./heldItem";
import { heldRoles, LATHE_TOL, pourAxis, pourSpans } from "./heldRoles";
import { place3, type M3, type V3 } from "./lens";
import { chairRoles, deskRoles } from "./preview";
import {
  composePlace,
  heldToItem,
  itemToHeld,
  parseRoles,
  PLACE_TOL,
  placeOfLinear,
  placeRoles,
  rectCorners,
  resolveRoles,
  ROLE_IDS,
  ROLES,
  RoleSchema,
  roleField,
  roleIssueLines,
} from "./roles";

const COMMON: Record<string, unknown> = {
  binh: binh,
  but: but,
  chen: chen,
  coc: coc,
  "dien-thoai": dien_thoai,
  khay: khay,
  ly: ly,
  tui: tui,
  vali: vali,
};
const common = (name: string) => structuredClone(COMMON[name]) as Record<string, unknown>;
const held = (name: string) => {
  const r = parseHeldItem(common(name));
  if (!r.success) throw new Error(r.error.issues.map((i) => i.message).join("; "));
  return r.data;
};
/** Dòng báo của mục vai trò đồ cảnh hỏng */
const sceneErr = (roles: unknown) => {
  const r = parseRoles(roles);
  expect(r.success).toBe(false);
  return roleIssueLines(r.error!).join("\n");
};
/** Lỗi zod của món cầm tay hỏng, dạng `đường.dẫn: lời` */
const heldErr = (json: unknown) => {
  const r = parseHeldItem(json);
  expect(r.success).toBe(false);
  return r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
};
const withRoles = (name: string, roles: unknown[], more: Record<string, unknown> = {}) => ({
  ...common(name),
  schemaVersion: HELD_VERSION,
  roles,
  ...more,
});
const close = (a: readonly number[], b: readonly number[], d = 6) =>
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i], d));

const seat = { role: "seat", at: [0, 0, 0], size: [100, 90] };

describe("`ROLES`", () => {
  it("bảy vai trò, mỗi trường có `describe`; vật mang", () => {
    expect(ROLE_IDS).toEqual([
      "pourer",
      "vessel",
      "seat",
      "armrest",
      "backrest",
      "footrest",
      "tabletop",
    ]);
    for (const id of ROLE_IDS)
      for (const f of Object.values(ROLES[id].fields)) expect(f.describe.length).toBeGreaterThan(3);
    expect(ROLES.pourer.carriers).toEqual(["held"]);
    expect(ROLES.vessel.carriers).toEqual(["held", "scene"]);
    expect(roleField("vessel", "mouth.r")?.describe).toBe("bán kính trong của miệng");
  });
});

describe("luật zod chung", () => {
  it("trường bắt buộc thiếu: dòng báo dừng ở mục, nêu vai trò và nghĩa của trường", () => {
    expect(sceneErr([{ role: "vessel", mouth: { at: [0, 0, 0] } }])).toBe(
      "roles[0]: vai trò `vessel` cần `mouth.r` (bán kính trong của miệng)",
    );
    expect(sceneErr([seat, { role: "armrest", from: [0, 0, 0], to: [1, 0, 0] }])).toBe(
      "roles[1]: vai trò `armrest` cần `width` (bề rộng mặt trên tay vịn)",
    );
    const r = parseHeldItem(withRoles("binh", [{ role: "pourer" }]));
    expect(roleIssueLines(r.error!)).toEqual([
      "roles[0]: vai trò `pourer` cần `lip` (điểm rót: mốc hay điểm khung món)",
    ]);
  });
  it("trường sai giá trị: đường dẫn tới trường", () => {
    expect(sceneErr([{ role: "armrest", from: [0, 0, 0], to: [1, 0, 0], width: -2 }])).toMatch(
      /^roles\[0\]\.width: `armrest`: `width` \(bề rộng mặt trên tay vịn\) cần số > 0/,
    );
  });
  it("vai trò lạ, thiếu `role`", () => {
    expect(sceneErr([{ role: "cup" }])).toBe(
      "roles[0]: vai trò lạ `cup`; có: pourer, vessel, seat, armrest, backrest, footrest, tabletop",
    );
    expect(sceneErr([{ at: [0, 0, 0] }])).toMatch(/^roles\[0\]: mục vai trò cần `role`/);
  });
  it("trường lạ là lỗi (`strictObject`)", () => {
    expect(sceneErr([{ ...seat, wdth: 3 }])).toBe(
      "roles[0]: `seat`: trường lạ `wdth` (có: name, at, size, front)",
    );
    expect(sceneErr([{ role: "vessel", mouth: { at: [0, 0, 0], r: 3, rr: 1 } }])).toMatch(
      /trường lạ `mouth.rr`/,
    );
  });
  it("`name` chỉ gồm a–z, 0–9, `-`", () => {
    expect(sceneErr([{ ...seat, name: "Ghe_A" }])).toMatch(/roles\[0\]\.name: `name` chỉ gồm/);
  });
  it("`armrest`: `from` trùng `to`; dốc quá 10°", () => {
    expect(sceneErr([{ role: "armrest", from: [1, -62, 3], to: [1, -62, 3], width: 10 }])).toBe(
      "roles[0]: `armrest` có `from` trùng `to`",
    );
    expect(sceneErr([{ role: "armrest", from: [0, -62, 0], to: [50, -82, 0], width: 10 }])).toMatch(
      /`armrest` dốc 21,8° \(quá 10°\)/,
    );
    expect(
      parseRoles([{ role: "armrest", from: [0, -62, 0], to: [100, -70, 0], width: 10 }]).success,
    ).toBe(true);
  });
  it("`tabletop`: ít nhất ba đỉnh, lồi, không trùng đỉnh", () => {
    const top = (poly: number[][]) => [{ role: "tabletop", y: -140, poly, thick: 6 }];
    expect(
      sceneErr(
        top([
          [0, 0],
          [10, 0],
        ]),
      ),
    ).toMatch(/cần ít nhất ba đỉnh/);
    expect(
      sceneErr(
        top([
          [0, 0],
          [10, 0],
          [10, 10],
          [5, 2],
        ]),
      ),
    ).toMatch(/không lồi/);
    expect(
      sceneErr(
        top([
          [0, 0],
          [10, 0],
          [10, 0],
          [0, 10],
        ]),
      ),
    ).toMatch(/đỉnh 1 trùng đỉnh 2/);
    expect(
      parseRoles(
        top([
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ]),
      ).success,
    ).toBe(true);
    // vòng sao tự cắt: ba đỉnh liên tiếp cùng chiều mà không lồi
    expect(
      sceneErr(
        top([
          [0, 3],
          [2, -3],
          [-3, 1],
          [3, 1],
          [-2, -3],
        ]),
      ),
    ).toMatch(/không lồi/);
    // đỉnh nằm trên cạnh được; quay ngược trên cạnh thì không
    const onEdge = [
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(parseRoles(top(onEdge)).success).toBe(true);
    expect(
      sceneErr(
        top([
          [0, 0],
          [10, 0],
          [5, 0],
          [10, 10],
          [0, 10],
        ]),
      ),
    ).toMatch(/không lồi/);
    // bàn tròn: đa giác nội tiếp, xếp vòng ngược chiều cũng được
    const round = Array.from({ length: 8 }, (_, i) => [
      40 * Math.cos((-i * Math.PI) / 4),
      40 * Math.sin((-i * Math.PI) / 4),
    ]);
    expect(parseRoles(top(round)).success).toBe(true);
  });
  it("`front` của mặt ngồi, lưng ghế phải nằm ngang, khác không", () => {
    expect(sceneErr([{ ...seat, front: [1, 1, 0] }])).toBe(
      "roles[0].front: `seat`: `front` phải nằm ngang (y = 0)",
    );
    expect(sceneErr([{ ...seat, front: [0, 0, 0] }])).toMatch(/vectơ không/);
  });
  it("đồ của cảnh: vai trò chỉ của món cầm tay, mốc thay điểm", () => {
    expect(sceneErr([{ role: "pourer", lip: [0, 0, 0] }])).toBe(
      "roles[0]: vai trò `pourer` chỉ khai ở món cầm tay",
    );
    expect(sceneErr([{ role: "vessel", mouth: { at: "rim", r: 3 } }])).toMatch(
      /roles\[0\]\.mouth\.at: `vessel`: đồ của cảnh không có mốc/,
    );
  });
  it("đồ của cảnh: hai mục cùng vai trò cần `name` khác nhau; `name` trùng", () => {
    const rest = (z: number, name?: string) => ({
      role: "armrest",
      ...(name && { name }),
      from: [-60, -62, z],
      to: [60, -62, z],
      width: 10,
    });
    expect(sceneErr([seat, rest(-63), rest(63)])).toMatch(
      /vai trò `armrest` có nhiều mục trên một vật: mỗi mục cần `name` khác nhau/,
    );
    expect(sceneErr([seat, rest(-63, "phai"), rest(63, "phai")])).toMatch(
      /roles\[2\]\.name: `name` `phai` trùng mục roles\[1\]/,
    );
    expect(parseRoles([seat, rest(-63, "phai"), rest(63, "trai")]).success).toBe(true);
  });
  it("`RoleSchema` là `discriminatedUnion` theo `role`", () => {
    expect(RoleSchema.safeParse(seat).success).toBe(true);
    expect(RoleSchema.safeParse({ ...seat, role: "footrest" }).success).toBe(true);
  });
});

describe("món cầm tay: `roles`, `HELD_VERSION` 4", () => {
  it("bộ chung: `binh` vật rót, `coc`, `ly` vật đựng khai, `chen` suy", () => {
    expect(heldRoles(held("binh")).roles).toEqual([
      {
        role: "pourer",
        index: 0,
        source: "declared",
        lip: [0, 17, 6],
        spout: [0, 0, 1],
        spoutSource: "inferred",
        axis: { at: [0, -38, 0], dir: [0, 1, 0], part: "than" },
      },
    ]);
    const coc = heldRoles(held("coc")).roles;
    expect(coc).toEqual([
      {
        role: "vessel",
        index: 0,
        source: "declared",
        mouth: { at: [0, 20, 0], r: 7.5, dir: [0, 1, 0] },
      },
    ]);
    expect(heldRoles(held("ly")).roles[0]).toMatchObject({
      source: "declared",
      mouth: { at: [-22.36, 17.25, 0], r: 10.8 },
    });
    const chen = heldRoles(held("chen"));
    expect(chen.warnings).toEqual([]);
    expect(chen.roles).toHaveLength(1);
    expect(chen.roles[0]).toMatchObject({ role: "vessel", source: "inferred", part: "body" });
    const m = (chen.roles[0] as { mouth: { at: V3; r: number; dir: V3 } }).mouth;
    close(m.at, [0, 4.5, 0]);
    expect(m.r).toBeCloseTo(7, 6);
    close(m.dir, [0, 1, 0]);
    // mọi món khác của bộ chung không có vai trò nào
    for (const n of ["but", "dien-thoai", "khay", "tui", "vali"])
      expect(heldRoles(held(n)).roles, n).toEqual([]);
  });
  it("món có `roles` mà `schemaVersion` 2, 3: giữ số, zod báo cần bản 4", () => {
    const v3 = { ...withRoles("coc", common("coc").roles as unknown[]), schemaVersion: 3 };
    expect((migrateHeldItem(v3) as { schemaVersion: number }).schemaVersion).toBe(3);
    expect(heldErr(v3)).toBe("schemaVersion: `roles` cần `schemaVersion` 4");
    expect(heldErr({ ...v3, schemaVersion: 2 })).toMatch(/`roles` cần `schemaVersion` 4/);
    // bản 3 không có `roles` nạp như bản 4
    const plain = { ...common("chen") };
    expect(parseHeldItem(plain).data!.schemaVersion).toBe(4);
  });
  it("`heldMinVersion`: `roles` 4, kiểu cầm có tên 3, còn lại 2", () => {
    expect(heldMinVersion(common("binh"))).toBe(4);
    expect(heldMinVersion(common("chen"))).toBe(2);
    expect(heldMinVersion({ authored: { sheet: { kep: { base: "flat" } } } })).toBe(3);
    expect(heldMinVersion({ authored: { sheet: { flat: { anchor: "pinch" } } } })).toBe(2);
  });
  it("vai trò của đồ cảnh trên món cầm tay; hai mục cùng vai trò", () => {
    expect(heldErr(withRoles("coc", [seat]))).toBe(
      "roles.0: vai trò `seat` chỉ khai ở đồ của cảnh",
    );
    const v = { role: "vessel", mouth: { at: "rim", r: 7.5 } };
    expect(heldErr(withRoles("coc", [v, v]))).toBe(
      "roles.1: món cầm tay khai một mục `vessel`; roles[0] đã khai",
    );
  });
  it("`Point` là tên mốc thì mốc phải có; `Dir` là tên mốc thì mốc phải có `dir`", () => {
    expect(heldErr(withRoles("binh", [{ role: "pourer", lip: "nope" }]))).toBe(
      "roles.0.lip: không có mốc `nope`",
    );
    expect(
      heldErr(withRoles("binh", [{ role: "pourer", lip: { anchor: "nope", offset: [1, 0, 0] } }])),
    ).toBe("roles.0.lip: không có mốc `nope`");
    expect(heldErr(withRoles("binh", [{ role: "pourer", lip: "mouth", spout: "neck" }]))).toBe(
      "roles.0.spout: mốc `neck` không có `dir`",
    );
    expect(
      parseHeldItem(
        withRoles("binh", [{ role: "pourer", lip: { anchor: "neck", offset: [0, 4, 6] } }]),
      ).success,
    ).toBe(true);
  });
  it("`pourer`: `lip` trên trục cần `spout`; `spout` lệch trục dưới 45° là lỗi", () => {
    expect(heldErr(withRoles("binh", [{ role: "pourer", lip: [0, 17, 0] }]))).toBe(
      "roles.0: `pourer`: `lip` nằm trên trục món, khai `spout` (hướng rót)",
    );
    const lipOn = (spout: number[]) =>
      withRoles("binh", [{ role: "pourer", lip: [0, 17, 0], spout }]);
    expect(parseHeldItem(lipOn([1, 0, 0])).success).toBe(true);
    expect(parseHeldItem(lipOn([1, 1, 0])).success).toBe(true);
    expect(heldErr(lipOn([1, 2, 0]))).toBe(
      "roles.0.spout: `pourer`: `spout` lệch trục món 26,6° (dưới 45°)",
    );
    expect(heldErr(lipOn([0.2, -1, 0]))).toMatch(/lệch trục món 11,3°/);
    expect(heldErr(lipOn([0, 0, 0]))).toMatch(/`spout` là vectơ không/);
  });
  it("`Dir` là tên mốc có `dir` vectơ không: lỗi ở trường vai trò", () => {
    const zero = { ...(common("binh").anchors as object), zero: { at: [0, 0, 0], dir: [0, 0, 0] } };
    expect(
      heldErr(
        withRoles("binh", [{ role: "pourer", lip: "mouth", spout: "zero" }], { anchors: zero }),
      ),
    ).toBe("roles.0.spout: `pourer`: `spout` là vectơ không (mốc `zero`)");
    const cup = { ...(common("coc").anchors as object), zero: { at: [0, 0, 0], dir: [0, 0, 0] } };
    expect(
      heldErr(
        withRoles("coc", [{ role: "vessel", mouth: { at: "rim", r: 7.5, dir: "zero" } }], {
          anchors: cup,
        }),
      ),
    ).toBe("roles.0.mouth.dir: `vessel`: `mouth.dir` là vectơ không (mốc `zero`)");
  });
  it("`pourer`: trục món là trục của `lathe` mang đoạn bám dài nhất, không chứa `lip`", () => {
    // vòi là phần riêng dài hơn thân; `lip` ở đầu vòi
    const teapot = {
      schemaVersion: HELD_VERSION,
      size: [50, 30, 10],
      anchors: {},
      shape: [
        { cyl: 5, from: [0, 0, 0], to: [0, 20, 0], part: "than" },
        { cyl: 2, from: [0, 20, 0], to: [40, 20, 0], part: "voi" },
      ],
      roles: [{ role: "pourer", lip: [40, 20, 0] }],
    };
    const p = parseHeldItem(teapot);
    expect(p.success).toBe(true);
    const [pour] = heldRoles(p.data!).roles;
    expect(pour).toMatchObject({ spoutSource: "inferred", axis: { part: "than" } });
    close((pour as { spout: V3 }).spout, [1, 0, 0]);
    close((pour as { axis: { dir: V3 } }).axis.dir, [0, 1, 0]);
    // chỉ phần cầm: khối chứa `lip` không bao giờ là phần cầm
    const lip: V3 = [40, 20, 0];
    expect(pourSpans(p.data!, lip, { part: "voi" })).toEqual([]);
    expect(pourSpans(p.data!, lip, { part: "than" }).map((x) => x.part)).toEqual(["than"]);
    // `lip` ở miệng thân: vòi thành phần cầm, trục ngang
    expect(pourAxis(p.data!, [0, 20, 3])?.part).toBe("voi");
    // bình: đoạn bám than–vai–cổ (miệng `grip: false` cắt), trục của khối ở đầu dưới
    const spans = pourSpans(held("binh"), [0, 17, 6]);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ part: "than", seg: { parts: ["than", "vai", "co"] } });
  });
  it("`pourer`: `lip` trên trục chỉ khi cách trục tới sai số số học `LATHE_TOL`", () => {
    const tol = LATHE_TOL * Math.max(1, pourAxis(held("binh"), [0, 17, 0])!.len);
    const lip = (z: number) => withRoles("binh", [{ role: "pourer", lip: [0, 17, z] }]);
    expect(heldErr(lip(tol / 2))).toMatch(/`lip` nằm trên trục món/);
    const off = parseHeldItem(lip(2 * tol));
    expect(off.success).toBe(true);
    close((heldRoles(off.data!).roles[0] as { spout: V3 }).spout, [0, 0, 1]);
    const near = parseHeldItem(lip(0.25));
    expect(near.success).toBe(true);
    close((heldRoles(near.data!).roles[0] as { spout: V3 }).spout, [0, 0, 1]);
  });
  it("`pourer`: `spout` khai chiếu lên mặt vuông góc trục; lệch hướng suy quá 30° là cảnh báo", () => {
    const at = (spout: number[]) =>
      heldRoles(parseHeldItem(withRoles("binh", [{ role: "pourer", lip: "mouth", spout }])).data!);
    const near = at([0.3, 0.6, 1]);
    expect(near.warnings).toEqual([]);
    close((near.roles[0] as { spout: V3 }).spout, [
      0.3 / Math.hypot(0.3, 1),
      0,
      1 / Math.hypot(0.3, 1),
    ]);
    expect((near.roles[0] as { spoutSource: string }).spoutSource).toBe("declared");
    const far = at([1, 0, 0]);
    expect(far.warnings).toEqual([
      "`pourer`: `spout` khai lệch hướng suy từ `lip` 90° (quá 30°): vòi cong có thể rót lệch",
    ]);
    close((far.roles[0] as { spout: V3 }).spout, [1, 0, 0]);
  });
  it("`vessel` khai trên món có miệng suy được phải trùng miệng suy", () => {
    const v = (mouth: object) => withRoles("chen", [{ role: "vessel", mouth }]);
    expect(parseHeldItem(v({ at: "mouth", r: 7 })).success).toBe(true);
    // tâm lệch tới 0,1 · r, bán kính tới 10 %, hướng tới 10°
    expect(parseHeldItem(v({ at: [0.6, 4.5, 0], r: 7.6, dir: [0.15, 1, 0] })).success).toBe(true);
    expect(heldErr(v({ at: [1, 4.5, 0], r: 7 }))).toMatch(
      /^roles\.0\.mouth: `vessel` khai lệch miệng suy từ hình \(tâm lệch 1 \(quá 0,7\); miệng suy \[0, 4,5, 0\], `r` 7\)/,
    );
    expect(heldErr(v({ at: "mouth", r: 8 }))).toMatch(/bán kính 8, miệng suy 7/);
    expect(heldErr(v({ at: "mouth", r: 7, dir: [0.3, 1, 0] }))).toMatch(/hướng lệch 16,7°/);
    // khai thì không thêm mục suy
    expect(heldRoles(parseHeldItem(v({ at: "mouth", r: 7 })).data!).roles).toEqual([
      {
        role: "vessel",
        index: 0,
        source: "declared",
        mouth: { at: [0, 4.5, 0], r: 7, dir: [0, 1, 0] },
      },
    ]);
  });
  it("món có hai miệng suy được: lỗi trừ khi khai `vessel` cho miệng dùng", () => {
    const two = {
      ...common("chen"),
      schemaVersion: HELD_VERSION,
      shape: [
        { cyl: 6, from: [0, 0, 0], to: [0, 9, 0], wall: 1, part: "a" },
        { cyl: 4, from: [30, 0, 0], to: [30, 6, 0], r2: 5, part: "b" },
        { cyl: 5, from: [30, 6, 0], to: [30, 9, 0], wall: 0.5, part: "b" },
      ],
    };
    // ống `a` hở hai đầu: không phải miệng; thêm đáy thì thành miệng thứ hai
    expect(parseHeldItem(two).success).toBe(true);
    const cup = {
      ...two,
      shape: [{ cyl: 6, from: [0, -1, 0], to: [0, 0, 0], part: "a" }, ...two.shape],
    };
    expect(heldErr(cup)).toBe(
      "shape: món có 2 miệng suy được (phần `a`, `b`): khai `vessel` cho miệng dùng",
    );
    const chosen = parseHeldItem({
      ...cup,
      roles: [{ role: "vessel", mouth: { at: [30, 9, 0], r: 4.5 } }],
    });
    expect(chosen.success).toBe(true);
    expect(heldRoles(chosen.data!).roles).toHaveLength(1);
  });
});

describe("khung", () => {
  it("khung món ↔ khung `Item`: y đổi dấu, mặt trước món +z là hướng mặt +x, một phép quay", () => {
    expect(heldToItem([0, 4.5, 0])).toEqual([0, -4.5, 0]);
    expect(heldToItem([0, 0, 1])).toEqual([1, -0, 0]);
    expect(itemToHeld(heldToItem([1, 2, 3]))).toEqual([1, 2, 3]);
  });
  it("`composePlace` nối hai phép đặt", () => {
    const a = { at: [10, -5, 3] as V3, yaw: 0.7, s: 1.2 };
    const b = { at: [-4, 2, 9] as V3, yaw: -1.9, s: 0.8 };
    const p: V3 = [3, -7, 11];
    close(place3(composePlace(a, b), p), place3(a, place3(b, p)));
  });
  it("`placeOfLinear`: quay quanh trục đứng, cỡ đồng đều dương; nghiêng, cỡ không đều, lật là lỗi", () => {
    const yaw = 0.6;
    const [c, n] = [Math.cos(yaw), Math.sin(yaw)];
    const R: M3 = [c, 0, n, 0, 1, 0, -n, 0, c];
    const ok = placeOfLinear(R.map((x) => x * 2) as M3, [1, 2, 3]);
    expect("place" in ok && ok.place.s).toBeCloseTo(2, 9);
    expect("place" in ok && ok.place.yaw).toBeCloseTo(yaw, 9);
    // khớp `place3`: cùng điểm
    if ("place" in ok)
      close(place3(ok.place, [5, 6, 7]), [
        1 + 2 * (5 * c + 7 * n),
        2 + 12,
        3 + 2 * (-5 * n + 7 * c),
      ]);
    const err = (L: number[]) => {
      const r = placeOfLinear(L as M3, [0, 0, 0]);
      return "error" in r ? r.error : "";
    };
    expect(err([1, 0, 0, 0, 1, 0, 0, 0, -1])).toMatch(/lật/);
    expect(err([2, 0, 0, 0, 1, 0, 0, 0, 1])).toMatch(/cỡ không đều/);
    const t = 0.3;
    expect(err([1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)])).toMatch(
      /nghiêng 17,2°/,
    );
    // nghiêng nhỏ: so đủ ma trận, không chỉ phần tử giữa
    const tiny = (a: number) => [
      1,
      0,
      0,
      0,
      Math.cos(a),
      -Math.sin(a),
      0,
      Math.sin(a),
      Math.cos(a),
    ];
    expect(err(tiny(0.01))).toMatch(/nghiêng 0,6°/);
    expect(err(tiny(10 * PLACE_TOL))).toMatch(/xiên hay nghiêng dưới 0,1°/);
    expect(err(tiny(PLACE_TOL / 10))).toBe("");
    // xiên trong mặt ngang: cột đơn vị, không trực giao
    const a = 0.05;
    expect(err([1, 0, Math.sin(a), 0, 1, 0, 0, 0, Math.cos(a)])).not.toBe("");
    expect(err([1, 0, 0, 0, 1, 0, 0, 0, 1 + 10 * PLACE_TOL])).toMatch(/cỡ không đều/);
  });
  it("`resolveRoles` điền mặc định trong khung vật; `placeRoles` đổi ra thế giới", () => {
    const local = resolveRoles(
      parseRoles([
        { ...seat, front: [0, 0, -2] },
        { role: "backrest", from: [-50, -24, 0], to: [-55, -80, 0], width: 90 },
        { role: "vessel", mouth: { at: [5, -10, 0], r: 4 } },
        { role: "footrest", at: [40, 60, 0], size: [10, 80] },
      ]).data!,
    );
    expect(local[0]).toMatchObject({ front: [0, 0, -1] });
    // lưng ghế không khai `front`: lấy của mặt ngồi cùng vật
    expect(local[1]).toMatchObject({ front: [0, 0, -1] });
    expect(local[2]).toMatchObject({ mouth: { dir: [0, -1, 0] } });
    expect(local[3]).toMatchObject({ front: [1, 0, 0] });
    const place = { at: [100, -50, 20] as V3, yaw: Math.PI / 2, s: 2 };
    const world = placeRoles(local, place);
    const s0 = world[0] as { at: V3; size: number[]; front: V3 };
    close(s0.at, [100, -50, 20]);
    expect(s0.size).toEqual([200, 180]);
    // `front` [0, 0, −1] quay 90°: −x
    close(s0.front, [-1, 0, 0]);
    const v = world[2] as { mouth: { at: V3; r: number; dir: V3 } };
    close(v.mouth.at, place3(place, [5, -10, 0]));
    expect(v.mouth.r).toBe(8);
    close(v.mouth.dir, [0, -1, 0]);
    const top = placeRoles(resolveRoles(parseRoles(deskRoles(87.5, 1)).data!), place)[0] as {
      y: number;
      poly: number[][];
      thick: number;
    };
    expect(top.y).toBeCloseTo(-50 + 2 * (-87.5 - 55), 9);
    expect(top.thick).toBe(12);
    close(top.poly[0], [100 + 2 * -110, 20 - 2 * 80]);
  });
  it("`rectCorners`: bốn góc theo `front`, bên phải người nhìn +x là −z", () => {
    expect(
      rectCorners({ at: [0, 0, 0], size: [20, 10], front: [1, 0, 0] }).map((p) =>
        p.map((x) => x + 0),
      ),
    ).toEqual([
      [10, -5],
      [-10, -5],
      [-10, 5],
      [10, 5],
    ]);
  });
});

describe("ghế, bàn xem thử khai vai trò", () => {
  it("`chairRoles`, `deskRoles` qua zod; mặt ngồi ở gốc, lưng ghế sau hông 55, tay vịn hai bên", () => {
    const chair = parseRoles(chairRoles(1, true));
    expect(chair.success).toBe(true);
    const [s, b, r, l] = resolveRoles(chair.data!);
    expect(s).toMatchObject({ role: "seat", at: [3.5, 0, 0], size: [117, 96] });
    expect(b).toMatchObject({
      role: "backrest",
      from: [-55, -24, 0],
      to: [-55, -80, 0],
      width: 96,
    });
    expect(r).toMatchObject({
      role: "armrest",
      name: "phai",
      from: [-61, -62, -63],
      to: [62, -62, -63],
      width: 10,
    });
    expect(l).toMatchObject({ name: "trai", from: [-61, -62, 63] });
    expect(parseRoles(deskRoles(87.5, 1)).success).toBe(true);
  });
});
