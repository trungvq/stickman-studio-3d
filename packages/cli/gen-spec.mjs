// Thông số đo của `stickman gen` (docs/05-repo-video.md#thông-số-đo): đồ theo vai trò mà cảnh three trả ra ghi thành file,
// `--spec` đọc lại thay cho cảnh three. Cùng file thông số, cùng cờ, cùng cảnh và nhân vật thì ra cùng hành động.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CLASH_EVERY } from "./lib.mjs";

export const SPEC_VERSION = 1;

const sha = (s) => createHash("sha256").update(s).digest("hex");
const tKey = (t) => (+t).toFixed(4);

/** Thư mục và tên file thông số mặc định của một lần sinh */
export const specFile = (kind, scene, cast, at) => `gen/${kind}-${scene}-${cast}-${+at}.json`;

/**
 * Khoá của cảnh cho thông số: JSON cảnh bỏ chỗ đứng, `path`, `floor`, `sit` và track của người được sinh (bộ sinh đọc
 * thẳng chúng từ cảnh, `gen walk` / `gen board` ghi đè chúng), cộng món `held/` mà cảnh three dựng đồ từ đó
 */
export function sceneKey(raw, id, held) {
  const s = structuredClone(raw);
  const m = s.cast?.find((x) => x.id === id);
  if (m) {
    delete m.tracks;
    if (m.world) for (const k of ["path", "at", "yaw", "sit", "floor"]) delete m.world[k];
  }
  const items = Object.keys(held ?? {})
    .sort()
    .map((k) => [k, held[k]]);
  return sha(JSON.stringify([s, items])).slice(0, 24);
}

/** Dấu của code `stickman.world`: băm nội dung mọi file nguồn mà gói cảnh three đọc (`inputs` của esbuild) */
export function worldStamp(root, files) {
  const h = createHash("sha256");
  for (const f of [...files].sort()) {
    const p = resolve(root, f);
    h.update(`${f}\0`);
    h.update(existsSync(p) ? readFileSync(p) : "");
    h.update("\0");
  }
  return h.digest("hex").slice(0, 24);
}

/**
 * Cảnh three ghi lại: chuyển mọi `propsAt(t)` sang `three`, nhớ kết quả từng giây để `specOf` ghi ra. Nút three của vật
 * thành số thứ tự theo lần gặp đầu (`sameOwner` so nút bằng `===`, chuỗi vẫn so được)
 */
export function recordThree(three) {
  const frames = new Map();
  const ids = new Map();
  const idOf = (node) => {
    if (!ids.has(node)) ids.set(node, `n${ids.size}`);
    return ids.get(node);
  };
  const plain = (props) =>
    props.map((p) => ({
      node: idOf(p.node),
      ...(p.owner !== undefined && { owner: p.owner }),
      name: p.name,
      ...(p.place && { place: p.place }),
      local: p.local,
      roles: p.roles,
      errors: p.errors,
    }));
  return {
    ...three,
    propsAt(t) {
      const props = three.propsAt(t);
      const k = tKey(t);
      if (!frames.has(k)) frames.set(k, JSON.parse(JSON.stringify(plain(props))));
      return props;
    },
    frames,
  };
}

/**
 * Thông số của lần sinh `kind` cho `cast` của cảnh `scene` từ giây `at`: đo thêm mỗi `CLASH_EVERY` giây trong `[at, at +
 * span]` (không quá `duration`), vật không dời trong quãng ấy thì chỉ giữ một bản `props`, có vật dời thì giữ đủ `frames`
 */
export function specOf(rec, { kind, scene, cast, at, span, duration, key, world }) {
  const to = Math.min(duration, at + span);
  for (let t = at; t <= to + 1e-9; t += CLASH_EVERY) rec.propsAt(+t.toFixed(4));
  rec.propsAt(to);
  const frames = [...rec.frames.entries()]
    .map(([t, props]) => ({ t: +t, props }))
    .sort((a, b) => a.t - b.t);
  const first = JSON.stringify(frames[0].props);
  const still = frames.every((f) => JSON.stringify(f.props) === first);
  return {
    specVersion: SPEC_VERSION,
    kind,
    scene,
    cast,
    at,
    span: [at, to],
    sceneKey: key,
    world,
    ...(still ? { props: frames[0].props } : { frames }),
  };
}

/** `propsAt` từ thông số: vật đứng yên thì một bản cho mọi giây; có vật dời thì giây đã đo, không thì giây đo gần nhất */
export function replayThree(spec, rigMod) {
  const frames = spec.frames ?? [{ t: spec.at, props: spec.props }];
  const byT = new Map(frames.map((f) => [tKey(f.t), f.props]));
  const missed = new Set();
  return {
    rig: rigMod,
    fromSpec: true,
    missed,
    propsAt(t) {
      if (frames.length === 1) return frames[0].props;
      const hit = byT.get(tKey(t));
      if (hit) return hit;
      missed.add(+t);
      let best = frames[0];
      for (const f of frames) if (Math.abs(f.t - t) < Math.abs(best.t - t)) best = f;
      return best.props;
    },
  };
}

/** Đọc file thông số `file` (tương đối với `root`); lỗi cú pháp, sai bản hay sai kiểu thì `fail` */
export function readSpec(root, file, kind, fail) {
  const p = resolve(root, file);
  if (!existsSync(p)) fail(`không có file thông số ${file}`);
  let spec;
  try {
    spec = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail(`${file} hỏng: ${e.message}`);
  }
  if (spec.specVersion !== SPEC_VERSION)
    fail(
      `${file}: bản thông số ${spec.specVersion ?? "?"}, bộ sinh đọc bản ${SPEC_VERSION} — đo lại bằng --measure`,
    );
  if (spec.kind !== kind)
    fail(`${file} là thông số của \`gen ${spec.kind}\`, không phải \`gen ${kind}\``);
  if (!(spec.props || spec.frames?.length)) fail(`${file}: không có \`props\` hay \`frames\``);
  return spec;
}
