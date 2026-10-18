import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { defaultTokens, bundleScope } from "./scope.mjs";

// Phân giải từ `cwd`, không phải từ `import.meta.url`: `remotion.config.ts` bị esbuild gói
// thành cjs, ở đó `import.meta.url` rỗng và `createRequire` nổ trước cả khi bundle.
const require = createRequire(join(process.cwd(), "noop.js"));

// `stickman.tmpdir`: thư mục tạm cho `bundle()` (vài trăm MB mỗi lượt) khi `/tmp` là tmpfs
const tmpdir = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).stickman
  ?.tmpdir;
if (tmpdir) {
  process.env.TMPDIR = tmpdir.replace(/^~(?=\/|$)/, homedir());
  mkdirSync(process.env.TMPDIR, { recursive: true });
}

/** Thư mục tạm riêng khai ở `stickman.tmpdir`; `null` khi không khai hay khai trỏ vào thư mục tạm chung của hệ */
export const ownTmpdir =
  tmpdir && !["/tmp", "/var/tmp", "/dev/shm"].includes(realpathSync(process.env.TMPDIR))
    ? process.env.TMPDIR
    : null;

/** Bộ chung của studio (mảnh, hành động và động vật mẫu) trong @stickman3d/cli: `template/` khi cài từ

 *  registry, `apps/studio/public` khi `link:` sang cây nguồn. `src/data.ts` nạp qua alias này. */
export function commonDir() {
  const cli = dirname(require.resolve("@stickman3d/cli"));
  const dir = [resolve(cli, "template"), resolve(cli, "../../apps/studio/public")].find(existsSync);
  if (!dir) throw new Error("không thấy bộ chung của studio trong @stickman3d/cli");
  return dir;
}

/**
 * RegExp của một context đã thu hẹp theo phạm vi: webpack chỉ gọi `test` với từng khoá `./…`. Nguồn mang khoá phạm vi
 * (khớp y như regex gốc) để id module, và cache webpack theo nó, khác nhau giữa hai phạm vi.
 */
class Narrow extends RegExp {
  static get [Symbol.species]() {
    return RegExp;
  }
  constructor(base, key, pick) {
    super(`(?:${base.source})(?:|stickman-scope-${key})`, base.flags);
    this.pick = pick;
  }
  test(s) {
    return super.test(s) && this.pick(s);
  }
}

/**
 * `exclude` của context: webpack hỏi nó với đường dẫn tuyệt đối của từng mục **trước khi** `stat` hay đi vào thư mục con,
 * nên thư mục ngoài phạm vi không bị duyệt — thời gian bundle theo phạm vi chứ không theo số file của repo.
 */
class Skip extends RegExp {
  static get [Symbol.species]() {
    return RegExp;
  }
  constructor(dir, key, visit) {
    super(`stickman-scope-skip-${key}`);
    this.dir = dir;
    this.visit = visit;
  }
  test(abs) {
    return !this.visit(relative(this.dir, abs).split(sep).join("/"));
  }
}

/** Plugin lọc `require.context` của `src/data.ts` trên `scenes/`, `episodes/`, `assets/audio/` theo `scope` (`scope.mjs`) */
const scopePlugin = (scope) => {
  const root = process.cwd();
  const real = (d) => (existsSync(d) ? realpathSync(d) : d);
  const json = (inScope) => ({
    pick: (k) => inScope(k.slice(2).replace(/\.json$/, "")),
    visit: (rel) => rel.endsWith(".json") && inScope(rel.slice(0, -5)),
  });
  const contexts = {
    [real(join(root, "scenes"))]: json(scope.scene),
    [real(join(root, "episodes"))]: json(scope.episode),
    [real(join(root, "assets/audio"))]: {
      pick: (k) => scope.audio(k.slice(2)),
      visit: scope.audioVisit,
    },
  };
  return {
    apply(compiler) {
      compiler.hooks.contextModuleFactory.tap("stickman-scope", (cmf) =>
        cmf.hooks.afterResolve.tap("stickman-scope", (r) => {
          const c = r && typeof r.resource === "string" && contexts[r.resource];
          if (!c || !r.regExp || r.regExp instanceof Narrow) return r;
          r.regExp = new Narrow(r.regExp, scope.key, c.pick);
          if (!r.exclude) r.exclude = new Skip(r.resource, scope.key, c.visit);
          return r;
        }),
      );
    },
  };
};

/**
 * Dùng chung cho `remotion.config.ts`, `tools/bundle.mjs` — mọi đường bundle phải cùng alias. `scope` (`bundleScope` của
 * `scope.mjs`) chọn cảnh, tập, tiếng nào vào bundle; bỏ trống là `defaultTokens`, có tiếng cue.
 */
export const webpackOverride = (
  c,
  scope = bundleScope(process.cwd(), defaultTokens(process.cwd())),
) => ({
  ...c,
  plugins: [...(c.plugins ?? []), scopePlugin(scope)],
  resolve: {
    ...c.resolve,
    alias: {
      ...c.resolve?.alias,
      "@stickman-common": commonDir(),
      // `@stickman3d/rig` đi `link:` thì symlink làm webpack tìm three ở repo kia: hai bản three là vật liệu hỏng mà không báo.
      // Alias từng lối vào, không alias cả thư mục: alias thư mục bỏ qua `exports` của three nên `three/addons/*` không phân giải.
      three$: join(process.cwd(), "node_modules/three/build/three.module.js"),
      "three/addons": join(process.cwd(), "node_modules/three/examples/jsm"),
    },
  },
});
