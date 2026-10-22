import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as prettier from "prettier";
import { formatLike, jsonTree, patchJsonText } from "./rawjson.mjs";

const fmt = (s) => prettier.format(s, { parser: "json" });
const s2 = (v) => `${JSON.stringify(v, null, 2)}\n`;
/** Dòng của `b` không có trong `a` và ngược lại */
const lineDiff = (a, b) => {
  const A = a.split("\n");
  const B = b.split("\n");
  return { gone: A.filter((l) => !B.includes(l)), added: B.filter((l) => !A.includes(l)) };
};

describe("jsonTree", () => {
  it("đọc vị trí của khoá, phần tử, chuỗi có thoát", () => {
    const text = '{ "a\\"b": [1, -2.5e3, "x\\\\"], "c": { "d": null } }';
    const t = jsonTree(text);
    assert.deepEqual(
      t.props.map((p) => p.key),
      ['a"b', "c"],
    );
    assert.equal(
      text.slice(t.props[0].value.items[2].start, t.props[0].value.items[2].end),
      '"x\\\\"',
    );
    assert.equal(text.slice(t.props[1].value.start, t.props[1].value.end), '{ "d": null }');
  });
  it("báo JSON hỏng", () => assert.throws(() => jsonTree('{"a": 1,}'), SyntaxError));
});

describe("patchJsonText", () => {
  // lối lộn xộn, không prettier cũng không stringify: chỗ không đổi phải giữ nguyên chữ
  const text = `{
  "z": 1.50,
  "list": [ {"t": 0, "v": "\\u00e9"},
    {"t": 1, "v": 2} ],
  "keep": [1,2,3]
}
`;
  const old = JSON.parse(text);
  const check = (next) => {
    const out = patchJsonText(text, next);
    assert.deepEqual(JSON.parse(out), next);
    return out;
  };

  it("đổi một số: chỉ số ấy đổi, `1.50` và `\\u00e9` còn nguyên", () => {
    const out = check({ ...old, list: [old.list[0], { t: 1.25, v: 2 }] });
    assert.equal(out, text.replace('"t": 1,', '"t": 1.25,'));
  });
  it("thêm, bỏ phần tử và khoá", () => {
    const n = { ...old, list: [old.list[0], { t: 0.5 }, old.list[1]], extra: { a: [1] } };
    const out = check(n);
    assert.ok(out.includes('"z": 1.50'));
    check({ ...old, list: [old.list[1]] });
    check({ ...old, list: [old.list[0]] });
    check({ ...old, list: [] });
    check({ list: old.list, keep: old.keep });
    check({ z: old.z, list: old.list, more: 2 });
    check({ list: old.list });
    check([1, 2]);
  });
  it("mảng một dòng thêm phần tử vẫn một dòng", () => {
    const out = check({ ...old, keep: [1, 2, 3, 4] });
    assert.ok(out.includes('"keep": [1,2,3, 4]'));
  });
});

describe("formatLike", () => {
  const scene = {
    name: "x",
    cast: [
      {
        id: "a",
        world: { at: [1, 0, 2], hands: [{ t: 0, right: { to: "belly", hand: { palm: "in" } } }] },
      },
      { id: "b", world: { at: [3, 0, 4] } },
    ],
  };
  const edited = structuredClone(scene);
  edited.cast[0].world.hands.push({ t: "@tra+0.6", right: { at: [1, 2, 3] } });

  it("file lối stringify: viết lại đúng lối ấy, chỉ thêm dòng của mốc mới", async () => {
    const out = await formatLike(s2(scene), edited, fmt);
    assert.equal(out, s2(edited));
    const d = lineDiff(s2(scene), out);
    assert.deepEqual(d.gone, []);
  });
  it("file lối prettier: ra đúng prettier, phần không đổi giữ nguyên", async () => {
    const text = await fmt(s2(scene));
    const out = await formatLike(text, edited, fmt);
    assert.equal(out, await fmt(out));
    assert.ok(out.includes('"at": [1, 0, 2]'));
    assert.deepEqual(JSON.parse(out), edited);
  });
  it("file lối khác: không chạy prettier, chỉ vá", async () => {
    const text = `{"name":"x","cast":[{"id":"a","world":{"at":[1,0,2],"hands":[{"t":0,"right":{"to":"belly","hand":{"palm":"in"}}}]}},{"id":"b","world":{"at":[3,0,4]}}]}\n`;
    const out = await formatLike(text, edited, fmt);
    assert.ok(
      out.startsWith('{"name":"x","cast":[{"id":"a","world":{"at":[1,0,2],"hands":[{"t":0,'),
    );
    assert.deepEqual(JSON.parse(out), edited);
  });
});
