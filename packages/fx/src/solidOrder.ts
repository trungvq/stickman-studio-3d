import {
  add3,
  BODY_PARTS,
  depthAt,
  dot3,
  project,
  scale3,
  sub3,
  type BodyPart,
  type Lens,
  type V3,
} from "@stickman3d/sketch";
import {
  convexOf,
  cut,
  hull,
  itemSolids,
  lensKey,
  meets,
  occlude,
  overlap,
  penetration,
  solid,
  straddle,
  type Convex,
  type Part,
  type Solid,
  type SolidItem,
} from "./solid";

/** Một người 3D: khối từng phần người trong thế giới (`figureAnchors(...).fig3.solids`) */
export interface SolidPerson {
  id: string;
  solids: { part: BodyPart; v: V3[] }[];
  /** Đoạn tay giữ góc 2D (`fig3.flat`), và lượt vẽ từng phần trong `drawSteps` (thân: lượt thân áo) */
  flat?: BodyPart[];
  step?: Partial<Record<BodyPart, number>>;
  /** Váy trên đùi (`fig3.lap`): khối để xếp lớp, và các đỉnh của vùng nó vẽ */
  lap?: { v: V3[]; cover: V3[] };
}

/** Một mục của thứ tự vẽ: một mảnh đồ khối, hay một phần của một người */
export type SolidNode = { kind: "solid"; s: Solid } | { kind: "part"; id: string; part: BodyPart };

const TONE = { top: "#000", lit: "#000", side: "#000" };
/** Mảnh đồ bị chặt tối đa bấy nhiêu lần: đủ cho vài đoạn chi xuyên qua một món */
const CUTS_MAX = 6;

/** Khối đã `bury` của một món dưới một ống kính; `key` là ống kính và `at` theo giá trị */
interface Baked {
  key: string;
  parts: Part[];
  sw?: number;
  ink?: string;
  ss: Solid[];
  box: Solid["box"];
}
const baked = new WeakMap<SolidItem, Baked>();
/** Cạnh đồ–đồ của hai món: bộ ba (khối của món trước, khối của món sau, `occlude`) */
const pairs = new WeakMap<Baked, WeakMap<Baked, number[]>>();
const hulls = new WeakMap<Solid, number[][]>();
/** Khối lồi để đo lấn và hộp bao thế giới của mảnh đồ đã `bake`: mảnh sống qua nhiều khung */
const convexes = new WeakMap<Solid, Convex>();
const aabbs = new WeakMap<Solid, number[]>();
/** Hộp bao thế giới `[x0, y0, z0, x1, y1, z1]` */
function aabb(v: V3[]) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of v)
    for (let k = 0; k < 3; k++) {
      if (p[k] < b[k]) b[k] = p[k];
      if (p[k] > b[k + 3]) b[k + 3] = p[k];
    }
  return b;
}
/** Quãng đẩy ngắn nhất theo một trục thế giới cho hai hộp bao rời nhau: độ lấn không vượt quá nó */
const boxOverlap = (a: number[], b: number[]) =>
  Math.min(a[3] - b[0], b[3] - a[0], a[4] - b[1], b[4] - a[1], a[5] - b[2], b[5] - a[2]);

const hullOf = (x: Solid, lens: Lens) => {
  let v = hulls.get(x);
  if (!v) hulls.set(x, (v = hull(x.v, lens)));
  return v;
};
/** Hai bóng lồi chồng nhau trên khung */
const touches = (A: Solid, B: Solid, lens: Lens) =>
  overlap(A.box, B.box) && meets(hullOf(A, lens), hullOf(B, lens));
/**
 * Hai khối chồng nhau trên khung mà không mặt nào của khối này để cả khối kia ở ngoài: `solidOrder`
 * chặt mảnh đồ qua phần người ở đúng những cặp này, `solidClashes` đo lấn ở đúng những cặp này
 */
const inseparable = (A: Solid, B: Solid, lens: Lens) =>
  touches(A, B, lens) && occlude(A, B, lens.eye) === 0;

/** `root`, `tip`: tâm hai mặt đầu của khối đoạn chi (`rod` bốn đỉnh gốc rồi bốn đỉnh ngọn) — vai, khuỷu, cổ tay */
type Seg = { id: string; part: BodyPart; s: Solid; root: V3; tip: V3 };
const segOf = (id: string, part: BodyPart, v: V3[], lens: Lens): Seg => {
  const at = (q: V3[]) => [0, 1, 2].map((k) => q.reduce((a, p) => a + p[k], 0) / 4) as V3;
  return {
    id,
    part,
    s: solid({ v, tone: TONE }, { at: [0, 0, 0] }, lens, 0),
    root: at(v.slice(0, 4)),
    tip: at(v.slice(4)),
  };
};
/** Số quãng chia trục đoạn chi khi đo nó trước hay sau thân */
const AXIS_STEPS = 12;
/** Một phía của đoạn tay trong bóng thân phải dài hơn phía kia ngần này lần mới quyết thay lớp tay */
const ARM_SIDE = 2;
/**
 * Điểm `p` trước (1) hay sau (−1) khối thân dọc tia nhìn, 0 khi tia trượt khối: trước chỗ tia vào là
 * trước, sau chỗ tia ra là sau. Lọt trong khối (tay xuyên thân — hộp nhô ra ngoài thân vẽ ra ở bốn góc,
 * tay ấy thường nằm sát mặt ngoài) thì trước khi mặt khối gần nhất quay ra mắt hay điểm nằm nửa gần của
 * dây cung tia cắt khối — `inside` tắt thì điểm lọt trong khối là 0
 */
function sideOf(T: Solid, p: V3, eye: V3, inside = true): -1 | 0 | 1 {
  const d = sub3(p, eye);
  let [s0, s1] = [-Infinity, Infinity];
  for (const f of T.f) {
    const nd = dot3(f.n, d);
    const h = dot3(f.n, sub3(f.c, eye));
    if (Math.abs(nd) < 1e-9) {
      if (h < 0) return 0;
    } else if (nd < 0) s0 = Math.max(s0, h / nd);
    else s1 = Math.min(s1, h / nd);
  }
  if (!(s0 < s1 && s1 > 0)) return 0;
  if (s0 > 1) return 1;
  if (s1 < 1) return -1;
  if (!inside) return 0;
  const f = T.f.reduce((m, f) => (dot3(f.n, sub3(p, f.c)) > dot3(m.n, sub3(p, m.c)) ? f : m));
  return dot3(f.n, sub3(eye, f.c)) > 0 || s0 + s1 > 2 ? 1 : -1;
}
/** Độ dài trên khung của phần trục đoạn chi nằm trong bóng khối thân, chia hai phía theo `sideOf` */
function ahead(T: Solid, L: Seg, lens: Lens) {
  const out = { front: 0, back: 0 };
  const at = (k: number) => add3(L.root, scale3(sub3(L.tip, L.root), k / AXIS_STEPS));
  for (let i = 0; i < AXIS_STEPS; i++) {
    const side = sideOf(T, at(i + 0.5), lens.eye);
    if (!side) continue;
    const [a, b] = [project(lens, at(i)), project(lens, at(i + 1))];
    out[side > 0 ? "front" : "back"] += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return out;
}
const segsOf = (people: SolidPerson[], lens: Lens): Seg[] =>
  people.flatMap((p) => p.solids.map((x) => segOf(p.id, x.part, x.v, lens)));
/** Độ lớn cạnh của luật quy ước (lượt vẽ 2D, độ sâu tâm) trong `rel`: dưới 1, còn cạnh hình học là ±1 */
const SOFT = 0.5;
const ARM_SEGS: ReadonlySet<BodyPart> = new Set(["armFar", "forearmFar", "armNear", "forearmNear"]);

const pad = (b: Solid["box"]): Solid["box"] => [b[0] - 1e-6, b[1] - 1e-6, b[2] + 1e-6, b[3] + 1e-6];
function bake(it: SolidItem, lens: Lens, lk: string): Baked {
  const key = `${lk}|${it.at.at}|${it.at.yaw}|${it.at.s}`;
  const b = baked.get(it);
  if (b && b.key === key && b.parts === it.parts && b.sw === it.sw && b.ink === it.ink) return b;
  const ss = itemSolids(it, lens);
  const box: Solid["box"] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of ss)
    for (let k = 0; k < 4; k++) box[k] = (k < 2 ? Math.min : Math.max)(box[k], s.box[k]);
  const out = { key, parts: it.parts, sw: it.sw, ink: it.ink, ss, box };
  baked.set(it, out);
  return out;
}
function pairEdges(A: Baked, B: Baked, eye: V3): number[] {
  let m = pairs.get(A);
  if (!m) pairs.set(A, (m = new WeakMap()));
  let e = m.get(B);
  if (e) return e;
  e = [];
  if (overlap(A.box, B.box))
    for (let i = 0; i < A.ss.length; i++)
      for (let j = A === B ? i + 1 : 0; j < B.ss.length; j++) {
        const [a, b] = [A.ss[i], B.ss[j]];
        const o = overlap(a.box, b.box) ? occlude(a, b, eye) : 0;
        if (o) e.push(i, j, o);
      }
  m.set(B, e);
  return e;
}

/**
 * Thứ tự vẽ của đồ khối và từng phần người cho một khung, suy từ hình học. Hai khối lồi rời nhau
 * thì một mặt của khối này để cả khối kia ở phía ngoài; mắt cùng phía ấy thì khối kia gần hơn. Mảnh
 * đồ không tách được với một đoạn người thì chặt theo mặt phẳng đứng qua tâm đoạn. Hai phần cùng
 * người xuyên nhau ở khớp: đầu và các đoạn tay góc 2D theo thứ tự vẽ 2D, đầu trên mọi phần khác trừ
 * cẳng tay 3D thật, đoạn tay 3D theo phía của quãng nằm trong bóng thân, còn lại thân với chi theo
 * thứ tự vẽ 2D, ngoài ra theo độ sâu tâm. Vòng (khối đan nhau) phá trong một vòng nguồn: bỏ cạnh luật
 * quy ước trước, rồi mới theo khoảng cách tới mắt. docs/10-lop-ve-code.md#đồ-khối
 */
export function solidOrder(lens: Lens, items: SolidItem[], people: SolidPerson[]): SolidNode[] {
  const eye = lens.eye;
  const segs = segsOf(people, lens);
  const person = new Map(people.map((p) => [p.id, p]));
  const touch = (A: Solid, B: Solid) => touches(A, B, lens);
  // mặt phẳng đứng qua tâm đoạn, vuông góc với tia nhìn ngang tới nó
  const sight = (g: Seg): V3 => {
    const d: V3 = [g.s.c[0] - eye[0], 0, g.s.c[2] - eye[2]];
    const l = Math.hypot(d[0], d[2]) || 1;
    return [d[0] / l, 0, d[2] / l];
  };
  const lk = lensKey(lens);
  const seen = new Set<SolidItem>();
  // món lặp lại trong `items` không dùng chung cạnh đã nhớ: cặp khối của hai lần lặp không có trong đó
  const bakes = items.map((it) => (seen.has(it) ? undefined : (seen.add(it), bake(it, lens, lk))));
  const furn: Solid[] = [];
  /** Nút của khối thứ j của món thứ k, khi khối ấy không bị chặt */
  const slot = bakes.map((b) => (b ? b.ss.map(() => -1) : []));
  const fixed: boolean[] = [];
  items.forEach((it, k) => {
    const b = bakes[k];
    const queue = (b?.ss ?? itemSolids(it, lens)).map((s, j) => ({ s, n: 0, j: b ? j : -1 }));
    // mảnh chặt nằm trong khối nên bóng nằm trong khung của món: đoạn ngoài khung không chạm mảnh nào
    const near = b ? segs.filter((g) => overlap(pad(b.box), g.s.box)) : segs;
    while (queue.length) {
      const { s, n, j } = queue.pop()!;
      const g =
        n < CUTS_MAX &&
        near.find(
          (g) => inseparable(s, g.s, lens) && straddle(s, sight(g), dot3(sight(g), g.s.c)) > 1e-3,
        );
      if (!g) {
        if (j >= 0) slot[k][j] = furn.length;
        fixed.push(j >= 0);
        furn.push(s);
        continue;
      }
      const h = sight(g);
      const d = dot3(h, g.s.c);
      for (const x of [cut(s, { n: [-h[0], 0, -h[2]], d: -d }, lens), cut(s, { n: h, d }, lens)])
        if (x) queue.push({ s: x, n: n + 1, j: -1 });
    }
  });

  type Node = { s: Solid; seg?: Seg };
  // váy trên đùi không chặt đồ: nó chỉ phủ lên đùi, đùi đã chặt
  const laps = people.flatMap((p) => (p.lap ? [segOf(p.id, "lap", p.lap.v, lens)] : []));
  const nodes: Node[] = [
    ...furn.map((s) => ({ s })),
    ...[...segs, ...laps].map((g) => ({ s: g.s, seg: g })),
  ];
  const torsoOf = new Map(
    nodes.flatMap((x) => (x.seg?.part === "torso" ? [[x.seg.id, x] as const] : [])),
  );
  // đầu luôn sau thân của chính người ấy: lượt thân mang cả mảng tóc sau, cổ áo chồm lên dưới cằm
  const headOver = (A: Node, B: Node) =>
    A.seg && B.seg && A.seg.id === B.seg.id && (A.seg.part === "head") !== (B.seg.part === "head")
      ? A.seg.part === "head" && B.seg.part === "torso"
        ? -1
        : B.seg.part === "head" && A.seg.part === "torso"
          ? 1
          : 0
      : 0;
  // đoạn tay 3D trước (1) hay sau (−1) thân chính người ấy: cẳng tay có cổ tay hẳn trước hay sau khối
  // thân theo phía cổ tay (bàn tay và đồ cầm phải đúng chỗ), còn lại phía chiếm quá `ARM_SIDE` lần phía kia của
  // phần nằm trong bóng thân; không phía nào trội thì không có mục, theo lớp tay
  const armSide = new Map<Seg, 1 | -1>(
    segs.flatMap((g): [Seg, 1 | -1][] => {
      const T = torsoOf.get(g.id)?.seg;
      if (!T || !ARM_SEGS.has(g.part) || person.get(g.id)?.flat?.includes(g.part)) return [];
      const wrist =
        g.part === "forearmFar" || g.part === "forearmNear" ? sideOf(T.s, g.tip, eye, false) : 0;
      if (wrist) return [[g, wrist]];
      const { front, back } = ahead(T.s, g, lens);
      if (front > ARM_SIDE * back) return [[g, 1]];
      if (back > ARM_SIDE * front) return [[g, -1]];
      return [];
    }),
  );
  const depth = (x: Solid) => depthAt(lens, x.c);
  const rank = (p: BodyPart) => (BODY_PARTS as readonly BodyPart[]).indexOf(p);
  /** 1: a vẽ trước b; −1 sau; 0 không ràng buộc; `±SOFT` là luật quy ước, vòng thì bỏ nó trước */
  const rel = (A: Node, B: Node): number => {
    if (!A.seg && !B.seg) return overlap(A.s.box, B.s.box) ? occlude(A.s, B.s, eye) : 0;
    const own = !!A.seg && !!B.seg && A.seg.id === B.seg.id;
    // Váy trên đùi với phần cùng người: với thân theo lớp `hem` (lượt vẽ 2D), với phần khác y như
    // thân — không phần nào chen giữa hai lượt váy
    if (own && (A.seg!.part === "lap" || B.seg!.part === "lap")) {
      const p = person.get(A.seg!.id);
      const lapFirst = A.seg!.part === "lap";
      if (A.seg!.part === "torso" || B.seg!.part === "torso")
        return (p?.step?.lap ?? 0) < (p?.step?.torso ?? 0) === lapFirst ? SOFT : -SOFT;
      const T = torsoOf.get(A.seg!.id);
      if (!T) return 0;
      return lapFirst ? headOver(T, B) || rel(T, B) : headOver(A, T) || rel(A, T);
    }
    const [a, b] = [A.seg?.part, B.seg?.part];
    // tóc, tà áo vẽ ra rộng hơn khối đầu, khối thân: trong một người, cặp có thân hay đầu luôn có thứ tự
    // — chỉ theo luật quy ước: hai khối không chồng nhau thì phép che không nói gì
    const wide = (x?: BodyPart) => x === "torso" || x === "head";
    const met = touch(A.s, B.s);
    if (!met && !(own && (wide(a) || wide(b)))) return 0;
    const p = own ? person.get(A.seg!.id) : undefined;
    const flat = (x: BodyPart) => x === "head" || !!p?.flat?.includes(x);
    // Đoạn tay góc 2D nằm phẳng ở độ sâu vai, khối của nó không nói gì về che: với đầu và với nhau
    // theo thứ tự vẽ 2D (lớp tay), trước cả phép che hình học
    if (own && p?.step && flat(a!) && flat(b!))
      return (p.step[a!] ?? 0) < (p.step[b!] ?? 0) ? SOFT : -SOFT;
    const limb = a === "torso" ? b! : a!;
    const arm = own && (a === "torso" || b === "torso") && ARM_SEGS.has(limb) && !flat(limb);
    // tay với thân: tách được hay không đổi theo từng độ nghiêng (cánh tay mọc từ vai trong khối thân),
    // không hỏi phép che
    const o = met && !arm ? occlude(A.s, B.s, eye) : 0;
    // đoạn tay sau thân với đồ là luật mềm: vòng gốc tay sau thân, thân sau bàn, khuỷu trên bàn bỏ nó trước
    if (o && (!A.seg || !B.seg) && armSide.get((A.seg ?? B.seg)!) === -1) return o * SOFT;
    if (o) return o;
    if (A.seg && B.seg) {
      if (!own) return depth(A.s) > depth(B.s) ? SOFT : -SOFT;
      const [a, b] = [A.seg.part, B.seg.part];
      // xuyên nhau ở khớp: đầu đè mọi phần trừ cẳng tay 3D thật, thân đè chân (đùi cắm vào khối thân
      // như rig 2D)
      const fore = (x: BodyPart) => x === "forearmNear" || x === "forearmFar";
      if ((a === "head" && !fore(b)) || (b === "head" && !fore(a)))
        return a === "head" ? -SOFT : SOFT;
      // Đoạn tay 3D có phía trội trong bóng thân (`armSide`) thì theo phía ấy; không thì theo lớp
      if (arm) {
        const L = a === "torso" ? B.seg : A.seg;
        const side = armSide.get(L);
        if (side) return side > 0 === (a === "torso") ? 1 : -1;
      }
      // còn lại thân với chi theo lượt vẽ 2D; cánh tay trên lấy lượt sau hơn của nó và cẳng tay, tay
      // `front` đưa ra trước ngực thì cả cánh tay trên thân
      const st = p?.step;
      const at = (x: BodyPart) => {
        const f = x === "armFar" ? "forearmFar" : x === "armNear" ? "forearmNear" : undefined;
        return f && st?.[f] !== undefined && st[x] !== undefined ? Math.max(st[x], st[f]) : st?.[x];
      };
      const [sa, sb] = [at(a), at(b)];
      if ((a === "torso" || b === "torso") && sa !== undefined && sb !== undefined && sa !== sb)
        return sa < sb ? SOFT : -SOFT;
      if (a === "torso" && rank(b) < rank("torso")) return -SOFT;
      if (b === "torso" && rank(a) < rank("torso")) return SOFT;
      return depth(A.s) > depth(B.s) ? SOFT : -SOFT;
    }
    // đồ với đoạn người không tách được: mảnh đã chặt nằm hẳn phía xa của mặt phẳng qua tâm đoạn thì vẽ trước
    const [f, g, sg] = A.seg ? [B.s, A.seg, -1] : [A.s, B.seg!, 1];
    const h = sight(g);
    return (Math.min(...f.v.map((p) => dot3(h, p))) >= dot3(h, g.s.c) - 1e-3 ? 1 : -1) * sg;
  };
  const n = nodes.length;
  const after: number[][] = nodes.map(() => []);
  /** Cạnh luật quy ước song song `after` */
  const soft: boolean[][] = nodes.map(() => []);
  const link = (a: number, b: number, o: number) => {
    if (!o) return;
    const [x, y] = o > 0 ? [a, b] : [b, a];
    after[x].push(y);
    soft[x].push(Math.abs(o) < 1);
  };
  // hai khối đồ không bị chặt: cạnh đã nhớ theo cặp món (`rel` đổi dấu khi đổi chỗ hai khối)
  for (let p = 0; p < items.length; p++)
    for (let q = p; q < items.length; q++) {
      const [A, B] = [bakes[p], bakes[q]];
      if (!A || !B) continue;
      const e = pairEdges(A, B, eye);
      for (let i = 0; i < e.length; i += 3) {
        const [a, b] = [slot[p][e[i]], slot[q][e[i + 1]]];
        if (a >= 0 && b >= 0) link(a, b, e[i + 2]);
      }
    }
  // còn lại: cặp có mảnh bị chặt hay đoạn người; khối đồ không chồng khung thì `rel` là 0
  for (let a = 0; a < n; a++) {
    if (fixed[a]) continue;
    for (let b = 0; b < n; b++)
      if (fixed[b] ? overlap(nodes[a].s.box, nodes[b].s.box) : b > a) {
        const [x, y] = a < b ? [a, b] : [b, a];
        link(x, y, headOver(nodes[x], nodes[y]) || rel(nodes[x], nodes[y]));
      }
  }
  // đống các nút đã hết ràng buộc, xa nhất ở đỉnh, hoà thì nút đứng trước
  const first = (i: number, j: number) =>
    nodes[i].s.far > nodes[j].s.far || (nodes[i].s.far === nodes[j].s.far && i < j);
  /** Sắp tô-pô các nút `use`; nút váy trên đùi đứng cuối `nodes` nên bỏ chúng là đúng thứ tự khi không có chúng */
  const sort = (use: (i: number) => boolean): number[] => {
    const deg = nodes.map(() => 0);
    /** Số cạnh vào còn lại không phải luật quy ước */
    const hard = nodes.map(() => 0);
    after.forEach((a, x) => {
      if (use(x))
        a.forEach((y, k) => {
          if (!use(y)) return;
          deg[y]++;
          if (!soft[x][k]) hard[y]++;
        });
    });
    const done = nodes.map((_, i) => !use(i));
    const total = done.filter((d) => !d).length;
    const seq: number[] = [];
    const heap: number[] = [];
    const push = (i: number) => {
      for (let k = heap.push(i) - 1, p; k > 0 && first(heap[k], heap[(p = (k - 1) >> 1)]); k = p)
        [heap[k], heap[p]] = [heap[p], heap[k]];
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) heap[0] = last;
      for (let k = 0; ;) {
        let m = k;
        for (const c of [2 * k + 1, 2 * k + 2])
          if (c < heap.length && first(heap[c], heap[m])) m = c;
        if (m === k) break;
        [heap[k], heap[m]] = [heap[m], heap[k]];
        k = m;
      }
      return top;
    };
    /**
     * Một thành phần liên thông mạnh nguồn của phần còn lại (Tarjan): vòng không chờ nút nào ngoài nó.
     * Tarjan khép thành phần theo thứ tự tô-pô ngược, nên thành phần khép sau cùng là nguồn
     */
    const source = (): number[] => {
      const idx = nodes.map(() => -1);
      const low = nodes.map(() => 0);
      const on = nodes.map(() => false);
      const st: number[] = [];
      let count = 0;
      let last: number[] = [];
      for (let r = 0; r < n; r++) {
        if (done[r] || idx[r] >= 0) continue;
        const call: [number, number][] = [];
        const open = (v: number) => {
          idx[v] = low[v] = count++;
          st.push(v);
          on[v] = true;
          call.push([v, 0]);
        };
        open(r);
        while (call.length) {
          const top = call[call.length - 1];
          const v = top[0];
          if (top[1] < after[v].length) {
            const w = after[v][top[1]++];
            if (done[w]) continue;
            if (idx[w] < 0) open(w);
            else if (on[w]) low[v] = Math.min(low[v], idx[w]);
            continue;
          }
          call.pop();
          if (call.length) {
            const u = call[call.length - 1][0];
            low[u] = Math.min(low[u], low[v]);
          }
          if (low[v] !== idx[v]) continue;
          last = [];
          for (let w = -1; w !== v;) {
            w = st.pop()!;
            on[w] = false;
            last.push(w);
          }
        }
      }
      return last;
    };
    for (let i = 0; i < n; i++) if (!done[i] && !deg[i]) push(i);
    while (seq.length < total) {
      let pick = heap.length ? pop() : -1;
      // vòng: phá trong một vòng nguồn, bỏ cạnh luật quy ước trước — nút xa nhất chỉ còn chờ cạnh như
      // thế; không có thì nút xa nhất của vòng
      if (pick < 0) {
        const ring = source();
        const far = (ok: (i: number) => boolean) => {
          for (const i of ring)
            if (ok(i) && (pick < 0 || nodes[i].s.far > nodes[pick].s.far)) pick = i;
        };
        far((i) => !hard[i]);
        if (pick < 0) far(() => true);
      }
      done[pick] = true;
      after[pick].forEach((j, k) => {
        if (!soft[pick][k]) hard[j]--;
        if (--deg[j] === 0 && !done[j]) push(j);
      });
      seq.push(pick);
    }
    return seq;
  };
  const isLap = (i: number) => nodes[i].seg?.part === "lap";
  const part = (k: number): SolidNode => {
    const g = nodes[k].seg;
    return g ? { kind: "part", id: g.id, part: g.part } : { kind: "solid", s: nodes[k].s };
  };
  // Thứ tự không có váy trên đùi, rồi chèn từng váy vào chỗ hợp mọi cạnh của nó, gần thân nhất: phần
  // khác giữ nguyên thứ tự. Váy chỉ tách khỏi lượt thân khi có thứ chồng lên vùng nó vẽ xen giữa nó với
  // thân; không thì thân vẽ cả váy, hình y như người không tách
  const base = sort((i) => !isLap(i));
  if (!laps.length) return base.map(part);
  const lapOf = nodes.flatMap((_, L) => (isLap(L) ? [L] : []));
  const info = lapOf.map((L) => {
    const p = person.get(nodes[L].seg!.id)!;
    const q = p.lap!.cover.map((v) => project(lens, v));
    const box: Solid["box"] = [
      Math.min(...q.map((v) => v[0])),
      Math.min(...q.map((v) => v[1])),
      Math.max(...q.map((v) => v[0])),
      Math.max(...q.map((v) => v[1])),
    ];
    const T = nodes.indexOf(torsoOf.get(p.id)!);
    return { L, T, box, under: (p.step?.lap ?? 0) < (p.step?.torso ?? 0) };
  });
  /** Có thứ chồng lên vùng váy nằm giữa váy và thân trong `seq` ở hai chỗ `i < j` */
  const apart = (seq: number[], i: number, j: number, box: Solid["box"]) =>
    seq.slice(i, j).some((k) => !isLap(k) && overlap(nodes[k].s.box, box));
  const pos = new Map(base.map((k, i) => [k, i]));
  const at = new Map<number, number[]>();
  const placed = info.every(({ L, T, box, under }) => {
    const t = pos.get(T)!;
    const range = (all: boolean) => {
      let [lo, hi] = [0, base.length];
      after.forEach((a, y) => {
        if (!isLap(y))
          a.forEach((z, k) => {
            if (z === L && (all || !soft[y][k])) lo = Math.max(lo, pos.get(y)! + 1);
          });
      });
      after[L].forEach((z, k) => {
        if (!isLap(z) && (all || !soft[L][k])) hi = Math.min(hi, pos.get(z)!);
      });
      return [lo, hi];
    };
    let [lo, hi] = range(true);
    if (lo > hi) [lo, hi] = range(false);
    if (lo > hi) return false;
    const k = Math.min(hi, Math.max(lo, under ? t : t + 1));
    if (k <= t ? apart(base, k, t, box) : apart(base, t + 1, k, box))
      at.set(k, [...(at.get(k) ?? []), L]);
    return true;
  });
  if (placed)
    return [...base, -1].flatMap((k, i) => [
      ...(at.get(i) ?? []).map(part),
      ...(k < 0 ? [] : [part(k)]),
    ]);
  // không chèn được (cạnh của váy ngược thứ tự đã sắp): sắp lại cả váy
  const seq = sort(() => true);
  const keep = new Set(
    info.flatMap(({ L, T, box }) => {
      const [i, j] = [seq.indexOf(L), seq.indexOf(T)].sort((a, b) => a - b);
      return apart(seq, i + 1, j, box) ? [L] : [];
    }),
  );
  if (!keep.size) return base.map(part);
  return seq.flatMap((k) => (isLap(k) && !keep.has(k) ? [] : [part(k)]));
}

/** Một chỗ người lồng vào đồ (hay vào người khác) ở một khung */
export interface SolidClash {
  id: string;
  part: BodyPart;
  /** Món thứ mấy trong `items`, và khối thứ mấy trong `parts` của món ấy */
  item?: number;
  piece?: number;
  /** Phần người của người khác */
  other?: { id: string; part: BodyPart };
  /** Quãng ngắn nhất phải đẩy phần người ra cho hai khối rời nhau, đơn vị thế giới */
  depth: number;
}

/** Ngưỡng lấn của từng phần người vào món: `tol`, nâng lên `max` của mục `touch` khớp phần ấy */
function touchLimits(it: SolidItem, tol: number) {
  const max = new Map<string, number>();
  for (const t of it.touch ?? []) {
    const [k, m] = typeof t === "string" ? [t, Infinity] : [t.part, t.max];
    max.set(k, Math.max(max.get(k) ?? tol, m));
  }
  return (g: Seg) => Math.max(tol, max.get(g.part) ?? tol, max.get(`${g.id}.${g.part}`) ?? tol);
}

/**
 * Phần người lồng vào khối đồ hay vào phần người của người khác, lấn sâu hơn `tol`: chỉ đo những cặp
 * mà `solidOrder` không tách được (chỗ nó chặt mảnh đồ qua người rồi vẽ đè lên). Phần người khai trong
 * `touch` của món thì ngưỡng là `max` của mục ấy (chuỗi: không báo), và bỏ phần người có bóng ngoài
 * `view` (khung camera) khi đưa `view`. Không gọi lúc vẽ: chỉ để kiểm.
 * docs/10-lop-ve-code.md#người-lồng-vào-đồ
 */
export function solidClashes(
  lens: Lens,
  items: SolidItem[],
  people: SolidPerson[],
  { tol = 0, view }: { tol?: number; view?: { x: number; y: number; w: number; h: number } } = {},
): SolidClash[] {
  const frame: Solid["box"] | undefined = view && [
    view.x,
    view.y,
    view.x + view.w,
    view.y + view.h,
  ];
  const segs = segsOf(people, lens).filter((g) => !frame || overlap(g.s.box, frame));
  const boxes = new Map(segs.map((g) => [g, aabb(g.s.v)]));
  const shapes = new Map<Seg, Convex>();
  const shape = (g: Seg) => {
    let c = shapes.get(g);
    if (!c) shapes.set(g, (c = convexOf(g.s)));
    return c;
  };
  const out: SolidClash[] = [];
  const lk = lensKey(lens);
  const seen = new Set<SolidItem>();
  items.forEach((it, k) => {
    if (seen.has(it)) return;
    seen.add(it);
    const b = bake(it, lens, lk);
    const lim = touchLimits(it, tol);
    const near = segs
      .map((g) => ({ g, max: lim(g) }))
      .filter(({ g, max }) => max < Infinity && overlap(pad(b.box), g.s.box));
    for (const s of b.ss) {
      let box = aabbs.get(s);
      if (!box) aabbs.set(s, (box = aabb(s.v)));
      for (const { g, max } of near) {
        if (boxOverlap(box, boxes.get(g)!) <= max || !inseparable(s, g.s, lens)) continue;
        let c = convexes.get(s);
        if (!c) convexes.set(s, (c = convexOf(s)));
        const depth = penetration(c, shape(g));
        if (depth > max)
          out.push({ id: g.id, part: g.part, item: k, piece: it.parts.indexOf(s.part), depth });
      }
    }
  });
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const [a, b] = [segs[i], segs[j]];
      if (a.id === b.id || boxOverlap(boxes.get(a)!, boxes.get(b)!) <= tol) continue;
      if (!inseparable(a.s, b.s, lens)) continue;
      const depth = penetration(shape(a), shape(b));
      if (depth > tol)
        out.push({ id: a.id, part: a.part, other: { id: b.id, part: b.part }, depth });
    }
  return out.sort((a, b) => b.depth - a.depth);
}

/** Một chỗ món đồ lồng vào món khác ở một khung */
export interface ItemClash {
  /** Hai món (chỉ số trong `items`) và khối lấn sâu nhất của mỗi món */
  item: number;
  piece: number;
  other: number;
  otherPiece: number;
  /** Quãng ngắn nhất phải đẩy cho hai khối sâu nhất rời nhau, đơn vị thế giới */
  depth: number;
  /** Phần thể tích của món nhỏ hơn (`small`: `item` hay `other`) nằm trong món kia, 0–1 */
  ratio: number;
  small: "item" | "other";
}
/** Số điểm lấy mẫu mỗi chiều trong hộp bao của một khối khi ước thể tích lồng nhau */
const VOL_STEPS = 6;
/** Khoảng chiếu của khối lồi lên từng pháp tuyến mặt: điểm trong khối khi nằm trong mọi khoảng */
const slabs = new WeakMap<Convex, number[]>();
function inside(c: Convex, p: V3) {
  let r = slabs.get(c);
  if (!r) {
    r = c.n.flatMap((n) => {
      const d = c.v.map((q) => dot3(n, q));
      return [Math.min(...d), Math.max(...d)];
    });
    slabs.set(c, r);
  }
  for (let i = 0; i < c.n.length; i++) {
    const d = dot3(c.n[i], p);
    if (d < r[2 * i] - 1e-6 || d > r[2 * i + 1] + 1e-6) return false;
  }
  return true;
}
const convexOfS = (s: Solid) => {
  let c = convexes.get(s);
  if (!c) convexes.set(s, (c = convexOf(s)));
  return c;
};
const aabbOfS = (s: Solid) => {
  let b = aabbs.get(s);
  if (!b) aabbs.set(s, (b = aabb(s.v)));
  return b;
};
/** Thể tích (ước bằng lưới điểm) của món `A`, và phần thể tích ấy nằm trong món `B` */
function volumeIn(A: Solid[], B: Solid[]) {
  let [all, inB] = [0, 0];
  const bs = B.map((s) => ({ b: aabbOfS(s), c: convexOfS(s) }));
  for (const s of A) {
    const b = aabbOfS(s);
    const c = convexOfS(s);
    const step = [0, 1, 2].map((k) => (b[k + 3] - b[k]) / VOL_STEPS);
    const cell = step[0] * step[1] * step[2];
    if (!(cell > 0)) continue;
    for (let i = 0; i < VOL_STEPS; i++)
      for (let j = 0; j < VOL_STEPS; j++)
        for (let k = 0; k < VOL_STEPS; k++) {
          const p: V3 = [
            b[0] + (i + 0.5) * step[0],
            b[1] + (j + 0.5) * step[1],
            b[2] + (k + 0.5) * step[2],
          ];
          if (!inside(c, p)) continue;
          all += cell;
          if (
            bs.some(
              ({ b: q, c: d }) => p.every((x, m) => x >= q[m] && x <= q[m + 3]) && inside(d, p),
            )
          )
            inB += cell;
        }
  }
  return { all, inB };
}
/** Hai món là một vật dựng thành nhiều món (thân cốc và quai): cùng chỗ đặt, cùng hướng, cùng cỡ */
const samePlace = (a: SolidItem, b: SolidItem) =>
  a.at.at.every((x, k) => Math.abs(x - b.at.at[k]) < 1e-6) &&
  (a.at.yaw ?? 0) === (b.at.yaw ?? 0) &&
  (a.at.s ?? 1) === (b.at.s ?? 1);
/** Món này khai cho món kia lồng vào (`touch` có tên món kia) */
const nests = (a: SolidItem, b: SolidItem) =>
  !!b.name && (a.touch ?? []).some((t) => (typeof t === "string" ? t : t.part) === b.name);
/** Kết quả đo của một cặp món đã `bake`: món đứng yên qua nhiều khung thì chỉ đo một lần */
const itemPairs = new WeakMap<
  Baked,
  WeakMap<Baked, { key: string; hit?: Omit<ItemClash, "item" | "other"> }>
>();

/**
 * Món đồ lồng vào món khác: báo khi khối lấn sâu nhất sâu hơn `tol` **và** phần thể tích của món nhỏ hơn
 * nằm trong món kia vượt `ratio` (cốc lún nửa thân vào khay máy pha; đồ đặt lên mặt bàn, tờ giấy mỏng
 * nằm trên bàn thì không). Bỏ hai món cùng chỗ đặt (một vật dựng thành nhiều món), cặp mà một món khai
 * tên món kia trong `touch` (bút trong ống bút), và cặp có cả hai bóng ngoài `view`. Không gọi lúc vẽ:
 * chỉ để kiểm. docs/10-lop-ve-code.md#đồ-lồng-vào-đồ
 */
export function solidItemClashes(
  lens: Lens,
  items: SolidItem[],
  {
    tol = 0,
    ratio = 0.1,
    view,
  }: { tol?: number; ratio?: number; view?: { x: number; y: number; w: number; h: number } } = {},
): ItemClash[] {
  const frame: Solid["box"] | undefined = view && [
    view.x,
    view.y,
    view.x + view.w,
    view.y + view.h,
  ];
  const lk = lensKey(lens);
  const list = [...new Set(items)].map((it) => {
    const b = bake(it, lens, lk);
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const s of b.ss) {
      const q = aabbOfS(s);
      for (let k = 0; k < 3; k++) {
        box[k] = Math.min(box[k], q[k]);
        box[k + 3] = Math.max(box[k + 3], q[k + 3]);
      }
    }
    return { it, k: items.indexOf(it), b, box };
  });
  const out: ItemClash[] = [];
  const key = `${tol}|${ratio}`;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const [A, B] = [list[i], list[j]];
      if (boxOverlap(A.box, B.box) <= tol) continue;
      if (samePlace(A.it, B.it) || nests(A.it, B.it) || nests(B.it, A.it)) continue;
      if (frame && !overlap(A.b.box, frame) && !overlap(B.b.box, frame)) continue;
      let m = itemPairs.get(A.b);
      if (!m) itemPairs.set(A.b, (m = new WeakMap()));
      let r = m.get(B.b);
      if (!r || r.key !== key) {
        r = { key };
        let best = { depth: tol, piece: -1, otherPiece: -1 };
        for (const a of A.b.ss)
          for (const b of B.b.ss) {
            if (boxOverlap(aabbOfS(a), aabbOfS(b)) <= best.depth) continue;
            const d = penetration(convexOfS(a), convexOfS(b));
            if (d > best.depth)
              best = {
                depth: d,
                piece: A.it.parts.indexOf(a.part),
                otherPiece: B.it.parts.indexOf(b.part),
              };
          }
        if (best.piece >= 0) {
          const [va, vb] = [volumeIn(A.b.ss, B.b.ss), volumeIn(B.b.ss, A.b.ss)];
          const small = va.all <= vb.all ? "item" : "other";
          const v = small === "item" ? va : vb;
          const part = v.all > 0 ? v.inB / v.all : 0;
          if (part > ratio) r.hit = { ...best, ratio: part, small };
        }
        m.set(B.b, r);
      }
      if (r.hit) out.push({ ...r.hit, item: A.k, other: B.k });
    }
  return out.sort((a, b) => b.depth - a.depth);
}

/** Một chỗ thứ tự vẽ ngược độ sâu ở một khung: mảnh đồ và phần người chồng nhau trên khung mà cái vẽ sau ở xa ống kính hơn */
export interface SolidOverdraw {
  id: string;
  part: BodyPart;
  /** Món thứ mấy trong `items`, và khối thứ mấy trong `parts` của món ấy */
  item: number;
  piece: number;
  /** Mảnh đồ vẽ đè lên phần người (`true`), hay phần người vẽ đè lên mảnh đồ */
  over: boolean;
  /** Cái vẽ sau nằm sau cái vẽ trước bấy nhiêu dọc tia nhìn, đơn vị thế giới */
  depth: number;
}

/** Điểm khung trong đa giác khung */
function within([x, y]: number[], poly: number[][]) {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [a, b] = [poly[i], poly[j]];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) r = !r;
  }
  return r;
}

/**
 * Chỗ `solidOrder` xếp ngược độ sâu, sâu hơn `tol`: lấy điểm trong lõi từng phần người, điểm nào nằm
 * trong một mặt nhìn thấy của mảnh đồ trên khung thì so độ sâu của mặt ấy với điểm dọc tia nhìn —
 * mảnh vẽ sau mà xa hơn, hay mảnh vẽ trước mà gần hơn, là vẽ sai. Bỏ cặp lồng nhau sâu hơn `tol`
 * (`solidClashes` báo chúng), phần người có tên trong `touch` của món, và điểm ngoài `view`.
 * `order` mặc định là `solidOrder` của chính khung ấy. Không gọi lúc vẽ: chỉ để kiểm.
 * docs/10-lop-ve-code.md#vẽ-sai-thứ-tự
 */
export function solidOverdraws(
  lens: Lens,
  items: SolidItem[],
  people: SolidPerson[],
  {
    tol = 0,
    view,
    order = solidOrder(lens, items, people),
  }: {
    tol?: number;
    view?: { x: number; y: number; w: number; h: number };
    order?: SolidNode[];
  } = {},
): SolidOverdraw[] {
  const eye = lens.eye;
  const inView = ([x, y]: number[]) =>
    !view || (x >= view.x && x <= view.x + view.w && y >= view.y && y <= view.y + view.h);
  const segs = new Map(segsOf(people, lens).map((g) => [`${g.id}.${g.part}`, g]));
  const slot = new Map<string, number>();
  order.forEach((n, i) => n.kind === "part" && slot.set(`${n.id}.${n.part}`, i));
  const pieceOf = new Map<Part, [number, number]>();
  items.forEach((it, k) => it.parts.forEach((p, j) => pieceOf.set(p, [k, j])));
  // lõi phần người: tâm và các đỉnh co về tâm, khỏi trúng mép khối
  const core = new Map<Seg, { p: V3; q: number[] }[]>();
  const coreOf = (g: Seg) => {
    let c = core.get(g);
    if (!c) {
      const m = g.s.c;
      const ps = [
        m,
        ...g.s.v.map((v): V3 => [0, 1, 2].map((k) => m[k] + 0.8 * (v[k] - m[k])) as V3),
      ];
      core.set(g, (c = ps.map((p) => ({ p, q: project(lens, p) }))));
    }
    return c;
  };
  const worst = new Map<string, SolidOverdraw>();
  order.forEach((n, i) => {
    if (n.kind !== "solid") return;
    const ref = pieceOf.get(n.s.part);
    if (!ref) return;
    const ok = new Set(items[ref[0]].touch ?? []);
    const faces = n.s.f
      .filter((f) => !f.cap && !f.hid && dot3(sub3(eye, f.c), f.n) > 0)
      .map((f) => ({ f, poly: f.p.map((p) => project(lens, p)) }));
    if (!faces.length) return;
    for (const [key, g] of segs) {
      if (ok.has(g.part) || ok.has(key) || !overlap(n.s.box, g.s.box)) continue;
      const over = i > slot.get(key)!;
      let depth = 0;
      for (const { p, q } of coreOf(g)) {
        if (!inView(q)) continue;
        const d = sub3(p, eye);
        const r = Math.hypot(...d);
        for (const { f, poly } of faces) {
          if (!within(q, poly)) continue;
          // mặt cắt tia nhìn ở eye + k·d: k > 1 là mặt nằm sau điểm
          const dn = dot3(d, f.n);
          if (Math.abs(dn) < 1e-9) continue;
          const k = dot3(sub3(f.c, eye), f.n) / dn;
          depth = Math.max(depth, (over ? k - 1 : 1 - k) * r);
        }
      }
      if (depth <= tol || penetration(n.s, g.s) > tol) continue;
      const w = `${key}|${ref[0]}|${ref[1]}`;
      const prev = worst.get(w);
      if (!prev || depth > prev.depth)
        worst.set(w, { id: g.id, part: g.part, item: ref[0], piece: ref[1], over, depth });
    }
  });
  return [...worst.values()].sort((a, b) => b.depth - a.depth);
}
