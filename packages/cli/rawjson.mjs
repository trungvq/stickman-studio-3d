// Vá JSON thô theo chỗ: chỉ những giá trị đổi được viết lại, phần còn lại của file giữ từng byte — `git diff` chỉ
// thấy chỗ sửa. Studio 3D ghi cảnh và món bằng đường này (`studio3d.mjs`).
import { isDeepStrictEqual } from "node:util";

const NUM = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;
const isWs = (c) => c === " " || c === "\n" || c === "\r" || c === "\t";

/** Cây vị trí của một văn bản JSON: nút `{ start, end }`, object có `props` (`{ key, start, end, value }`), mảng có `items` */
export function jsonTree(text) {
  let i = 0;
  const fail = (m) => {
    throw new SyntaxError(`JSON hỏng ở ký tự ${i}: ${m}`);
  };
  const ws = () => {
    while (isWs(text[i])) i++;
  };
  const str = () => {
    const start = i++;
    while (text[i] !== '"') {
      if (i >= text.length) fail("chuỗi chưa đóng");
      i += text[i] === "\\" ? 2 : 1;
    }
    return { type: "string", start, end: ++i };
  };
  const list = (close, one) => {
    const out = [];
    i++;
    ws();
    if (text[i] === close) return (i++, out);
    for (;;) {
      out.push(one());
      ws();
      if (text[i] === ",") i++;
      else if (text[i] === close) return (i++, out);
      else fail(`cần , hay ${close}`);
    }
  };
  const value = () => {
    ws();
    const start = i;
    if (text[i] === "{") {
      const props = list("}", () => {
        ws();
        if (text[i] !== '"') fail("cần khoá");
        const k = str();
        ws();
        if (text[i++] !== ":") fail("cần :");
        const v = value();
        return {
          key: JSON.parse(text.slice(k.start, k.end)),
          start: k.start,
          end: v.end,
          value: v,
        };
      });
      return { type: "object", start, end: i, props };
    }
    if (text[i] === "[") {
      const items = list("]", value);
      return { type: "array", start, end: i, items };
    }
    if (text[i] === '"') return str();
    NUM.lastIndex = i;
    const m = NUM.exec(text);
    if (!m) fail("giá trị lạ");
    i += m[0].length;
    return { type: "scalar", start, end: i };
  };
  const root = value();
  ws();
  if (i !== text.length) fail("thừa sau giá trị");
  return root;
}

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * `next` viết lên `text` (JSON của một giá trị khác): khoá, phần tử nào giữ nguyên thì giữ nguyên chữ; khoá thêm vào cuối
 * object, phần tử thêm vào chỗ của nó trong mảng; giá trị mới viết theo lối `JSON.stringify` với xuống dòng (LF/CRLF) và
 * bậc thụt (tab hay số dấu cách của dòng thụt đầu tiên) của `text`, thụt theo chỗ đặt
 */
export function patchJsonText(text, next) {
  const edits = [];
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const step = /\n([ \t]+)\S/.exec(text)?.[1] ?? "  ";
  const unit = step[0] === "\t" ? "\t" : step;
  const lineIndent = (pos) => /^[ \t]*/.exec(text.slice(text.lastIndexOf("\n", pos - 1) + 1))[0];
  const frag = (v, ind) => JSON.stringify(v, null, unit).replaceAll("\n", `${eol}${ind}`);
  const put = (start, end, s) => edits.push({ start, end, text: s });
  const replace = (node, v) => put(node.start, node.end, frag(v, lineIndent(node.start)));
  /** Lối của các con: một dòng mỗi con (`sep`, `ind`) hay cùng dòng */
  const layout = (node, kids) => {
    const first = kids[0];
    const multi = text.slice(node.start, first.start).includes("\n");
    const ind = multi ? lineIndent(first.start) : "";
    return {
      ind,
      sep: multi ? `,${eol}${ind}` : ", ",
      write: (v) => (multi ? frag(v, ind) : JSON.stringify(v)),
    };
  };
  /** Bỏ các con có `gone[j]`: mỗi dải liền bỏ kèm dấu phẩy với con giữ lại kế bên */
  const drop = (kids, gone) => {
    for (let a = 0; a < kids.length; a++) {
      if (!gone[a]) continue;
      let b = a;
      while (gone[b + 1]) b++;
      if (b < kids.length - 1) put(kids[a].start, kids[b + 1].start, "");
      else put(kids[a - 1].end, kids[b].end, "");
      a = b;
    }
  };

  const walk = (node, a, b) => {
    if (isDeepStrictEqual(a, b)) return;
    if (isObj(a) && isObj(b) && node.type === "object" && node.props.length) {
      const props = node.props;
      const gone = props.map((p) => !(p.key in b));
      const added = Object.keys(b).filter((k) => !(k in a));
      if (gone.every(Boolean)) return replace(node, b);
      drop(props, gone);
      for (const p of props) if (p.key in b) walk(p.value, a[p.key], b[p.key]);
      if (added.length) {
        const l = layout(node, props);
        const s = added.map((k) => `${JSON.stringify(k)}: ${l.write(b[k])}`).join(l.sep);
        put(props.at(-1).end, props.at(-1).end, `${l.sep}${s}`);
      }
      return;
    }
    if (
      Array.isArray(a) &&
      Array.isArray(b) &&
      node.type === "array" &&
      node.items.length &&
      b.length
    ) {
      const items = node.items;
      let p = 0;
      while (p < a.length && p < b.length && isDeepStrictEqual(a[p], b[p])) p++;
      let s = 0;
      while (
        s < a.length - p &&
        s < b.length - p &&
        isDeepStrictEqual(a[a.length - 1 - s], b[b.length - 1 - s])
      )
        s++;
      const oldN = a.length - p - s;
      const fresh = b.slice(p, b.length - s);
      if (oldN === fresh.length) {
        for (let j = p; j < p + oldN; j++) walk(items[j], a[j], b[j]);
        return;
      }
      const l = layout(node, items);
      const s2 = fresh.map(l.write).join(l.sep);
      if (!oldN) {
        if (p) put(items[p - 1].end, items[p - 1].end, `${l.sep}${s2}`);
        else put(items[0].start, items[0].start, `${s2}${l.sep}`);
      } else if (!fresh.length)
        drop(
          items,
          items.map((_, j) => j >= p && j < p + oldN),
        );
      else put(items[p].start, items[p + oldN - 1].end, s2);
      return;
    }
    replace(node, b);
  };
  walk(jsonTree(text), JSON.parse(text), next);
  edits.sort((x, y) => y.start - x.start || y.end - x.end);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/**
 * Văn bản của `next` định dạng như file cũ `text`: file đúng lối `JSON.stringify(…, null, 2)` thì viết lại đúng lối ấy;
 * file đúng lối prettier (`format`, cấu hình của repo) thì vá rồi chạy prettier; file khác thì chỉ vá chỗ đổi
 */
export async function formatLike(text, next, format) {
  const old = JSON.parse(text);
  let out;
  if (text === `${JSON.stringify(old, null, 2)}\n`) out = `${JSON.stringify(next, null, 2)}\n`;
  else {
    out = patchJsonText(text, next);
    if (format && (await format(text)) === text) out = await format(out);
  }
  if (!isDeepStrictEqual(JSON.parse(out), next))
    throw new Error("vá JSON thô ra giá trị khác bản cần ghi");
  return out;
}
