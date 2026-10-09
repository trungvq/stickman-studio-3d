// Nội dung các file `stickman init` sinh mới. Docs không nằm ở đây: chúng đi theo package.

export const stickmanMd = ({ rigVersion }) => `# stickman.md

Cách dùng bộ rig ở repo này. File này do \`stickman upgrade\` sinh lại theo
version đang cài — **đừng sửa tay**, luật riêng của tập viết ở \`AGENTS.md\`.

Repo một tập phim người que: nhân vật, hành động, cảnh và mảnh ảnh của **tập
này**. Rig là \`@stickman3d/rig@${rigVersion}\` đã pin — đừng sửa gì trong
\`node_modules/@stickman3d/\`.

## Bố cục

| | |
|---|---|
| \`characters/\` | JSON nhân vật của tập này: hình dáng, bảng màu, mảnh cắm vào socket, và \`items\` — đồ thay được theo cảnh. Nhân vật chung (tác giả \`author\` và bộ mẫu) đi theo studio như hành động chung, \`patch\` thì bản đè nằm ở đây. |
| \`actions/\` | JSON hành động của tập này. Hành động chung (\`walk\`, \`idle\`, \`wave\`…) đi theo studio, không nằm ở đây; \`list\` gắn \`layer\` cho biết. Muốn sửa một cái chung thì \`patch\` nó — bản đè sẽ nằm ở đây. |
| \`scenes/\` | JSON cảnh: ghép hành động theo timeline, nhiều người, đạo cụ và động vật (kể cả người cưỡi, người xách); kèm nền và camera của cảnh. |
| \`props/\` | JSON đạo cụ có bánh (\`docs 06\`); scene trỏ bằng tên file. |
| \`animals/\` | JSON động vật của tập này (\`docs 08\`); scene trỏ bằng tên file. Bảy con mẫu (\`dog\`, \`chicken\`, \`bird\`, \`tiger\`, \`horse\`, \`lion\`, \`elephant\`) đi theo studio như hành động chung, \`patch\` thì bản đè nằm ở đây. |
| \`episodes/\` | JSON tập: xếp các cảnh thành shot, cộng tiếng và lời, thumbnail và các biến thể của nó. Xem \`docs 07\` § Bảng thời gian của cả tập. |
| \`sfx/\` | Bảng tiếng động của tập: \`recipes.json\` cho \`pnpm sfx\`, \`elevenlabs.json\` cho \`pnpm sfx-el\`, \`loops.json\` cho \`pnpm sfx-loop\`. Thư viện chung nằm trong \`tools/\`. Xem \`docs 07\` § Tiếng động. |
| \`pieces/\` | Mảnh ảnh PNG của tập này, xếp theo socket, kèm \`catalog.json\`. Sheet chung của studio là lớp dưới, không chép vào đây; trùng đường dẫn thì bản ở đây đè. |
| \`src/\` | App Remotion: một composition cho mỗi file trong \`scenes/\` và \`episodes/\`. Xem \`docs 03\` § Remotion. |
| \`assets/bg/\` | Ảnh nền; \`scene.bg[].file\` trỏ bằng tên file ở đây. \`assets/audio/\` là tiếng, \`shots[].audio[].file\` trỏ vào đó kèm thư mục: \`t<nn>/\` là tiếng của tập, \`sfx/\` là tiếng động dùng chung. |
| \`assets/sheets/\` | Sheet gốc model gen ra, giữ để cắt lại và làm ảnh tham chiếu lượt sau. |
| \`stickman.json\` | Version bộ \`@stickman3d\` đã pin; \`stickman check\` so lại với cái đang cài. |

## Spec rig ở đâu

**Không nằm trong repo này.** Nó đi theo \`@stickman3d/rig@${rigVersion}\` đã pin,
nên không có bản chép nào để cũ đi. Đọc bằng MCP tool \`docs\`: gọi trống để lấy
mục lục, \`docs({ file: "02" })\` để lấy một file. Không có MCP thì
\`pnpm exec stickman docs 02\`.

\`docs 00\` **bất biến — bẫy theo vùng, làm sai thì không gì báo** · \`01\` rig và
tư thế · \`02\` trang phục và mảnh ảnh · \`03\` scene · \`04\` MCP · \`05\` repo video ·
\`06\` đạo cụ · \`07\` làm một tập · \`08\` động vật.

**Đọc file liên quan trước khi viết JSON.** Đó là nguồn sự thật cho mọi hành vi,
và nó khớp đúng version đang cài.

## Trước khi viết dòng JSON đầu tiên

Gọi MCP \`describe_rig\` — hằng số, thư viện tư thế, bộ sinh, bộ phận vẽ code và
các quy ước dấu góc đều ở đó. Đừng nhớ số từ lần trước. \`schema(kind)\` trả JSON
Schema kèm object mặc định, \`validate\` kiểm mà không ghi, \`write\` / \`patch\` mới
chạm đĩa.

## Vòng lặp

Nhân vật → hành động → cảnh. Mỗi bước render rồi **mở ảnh ra nhìn**: \`render_*\`
trả đường dẫn file chứ không nhét ảnh vào ngữ cảnh, không mở là không biết mình
vừa làm gì.

- Nhân vật phụ dựng bằng cách ghép: bảng màu + bộ phận vẽ code (\`src: "part"\`),
  không cần ảnh nào.
- Chỉ nhân vật chính cần trang phục riêng mới đi đường gen ảnh, xem mục dưới.
- Một nhân vật cầm hay mặc nhiều thứ trong tập thì vẫn là **một file**: mỗi thứ
  một mục trong \`items\`, cảnh nào cần thì \`equip\` cảnh ấy
  (\`docs 01\` § Đồ thay được). Nhân bản file nhân vật,
  hay cắm sẵn đồ vào \`pieces\` rồi cảnh nào cũng gỡ ra, đều là đi sai đường.
- Kiểm bằng \`shrug\`, đừng kiểm bằng \`walk\`: sai dấu góc không lộ ra ở góc nhỏ.
- Cảnh thì \`render_scene\` để xem và \`scene_probe\` để **đo** toạ độ bàn tay,
  đừng suy điểm gặp bằng mắt. Soi bố cục và khung thì \`render_scene\` với
  \`stage: true\` — mỗi ô là cả khung, có nền, đã đi qua camera.
- Sửa xong một cảnh thì \`check\` đúng cảnh ấy: MCP \`check({ scene: "<ten>" })\` hay
  \`pnpm exec stickman check --scene <ten>\` (regex trên id cảnh) — vài giây, bắt người
  lồng vào đồ, vẽ sai thứ tự, chân trượt. \`check\` cả workspace chậm, để dành trước khi
  commit hay sau khi nâng rig.
- Muốn nhìn chuyển động chứ không phải ảnh tĩnh: \`pnpm video --scene
  scenes/<ten>.json --out tmp/<ten>.mp4\`. Bản thật thì \`pnpm render <ten>\`.

## Gen mảnh trang phục

Đọc \`docs 02\` trước khi gen. Đường đi:

1. \`piece_prompt\` sinh prompt tiếng Anh cho socket cần gen — tỉ lệ khung tính
   sẵn từ hằng số rig, kèm các ràng buộc bắt buộc của socket đó.
2. \`render_character\` với \`boxes: true\` để **tự nhìn** cái hộp mảnh phải lấp.
   Đừng đính ảnh này vào lượt gen sheet: lưới nhiều ô mà kèm ảnh tham chiếu là về
   mất alpha, nền ô cờ bị vẽ thành pixel thật.
3. **Gen bằng codex**: skill \`imagegen\` nếu bạn là codex, không thì
   \`codex exec -m gpt-5.6-sol ... < /dev/null\` (thiếu \`< /dev/null\` là nó treo
   chờ stdin; \`-m gpt-5.6-sol\` là model gen ảnh).
   Gen xong kiểm ngay
   \`magick identify -format '%[channels]' <file>\` phải ra \`srgba\`, không thì
   gen lại chứ đừng nhận.
4. Sheet gốc lưu vào \`assets/sheets/\`, cắt và tẩy mực bằng \`magick\`; số đo và
   ngưỡng ở \`docs 02\`.
5. \`add_piece\` đưa PNG vào \`pieces/<socket>/\` và ghi mục danh mục. Thiếu mục
   danh mục là studio không thấy mảnh.
6. \`patch\` cắm vào nhân vật, render soi, chỉnh \`dx/dy/scale\`.

Mảnh là **ảnh mực hai màu**: nét đen, ruột trắng, màu thật nằm ở
\`pieces[k].color\`. Gen ra ảnh màu là khoá cứng mảnh vào đúng màu ấy.

## Quy ước

- Tài liệu và chữ trên giao diện tiếng Việt; định danh trong code tiếng Anh.
- Commit message tiếng Anh, conventional commit, một dòng, không body.
- Muốn đổi hành vi rig thì đổi ở repo studio rồi \`pnpm exec stickman upgrade\` bên này,
  đừng vá \`node_modules\`.
- Nâng lên bộ rig mới: cài version mới rồi \`stickman upgrade\` (\`--dry-run\` xem trước).
  Nó chép lại app Remotion và file agent — docs không nằm trong đó vì không có bản chép.
  \`characters/\`, \`actions/\`, \`scenes/\`, \`episodes/\`, \`props/\`, \`animals/\`, \`pieces/\`, \`sfx/\` không bị đụng.
  File mình sửa tay thì nó hỏi trước khi đè.
- **Đừng sửa file \`src/\` và \`tools/\` do studio phát** — mẫu đổi là phải trộn tay. Lớp vẽ code ở
  \`src/lop.tsx\`, bộ phận code ở \`src/parts.tsx\`, context cho lớp vẽ cần dữ liệu app Remotion ở
  \`src/scene-wrap.tsx\` (ba file này của repo, \`upgrade\` không đụng), tool riêng ở file mới trong
  \`tools/\`. Sửa chung (lỗi, tuỳ chọn mới) thì làm ở repo studio.
- Rig đổi độ dài chân thì \`upgrade\` và \`check\` nhắc: chạy \`stickman reseat --dry-run\` rồi
  \`stickman reseat\` — nó dời \`y\` người ngồi 2D cho hông về chỗ cũ (\`pnpm exec stickman docs 05\`).
  Hành động ngồi ghế đặt tên \`sit\` hay \`sit-…\`: \`reseat\` nhận ra người ngồi bằng tên ấy.
`;

/**
 * Seed một lần, từ đó là của repo video: `upgrade` không đụng. Hướng dẫn dùng rig không nằm
 * đây mà ở `stickman.md` — chỗ ấy mới được sinh lại theo version.
 */
export const agents = () => `# AGENTS.md

Repo một tập phim người que. **Đọc \`stickman.md\` trước khi viết dòng JSON đầu
tiên** — cách dùng rig, vòng lặp dựng cảnh và đường gen mảnh trang phục đều ở
đó, và nó đi theo version \`@stickman3d\` đang cài.

@stickman.md

## Luật của tập này

Chưa có gì. Viết vào đây khi tập mọc ra quy ước riêng: cách đặt tên cảnh và
shot, giọng từng nhân vật, mảnh nào dùng cho ai, việc đang dở. \`stickman
upgrade\` không đụng file này, nên nó là chỗ duy nhất an toàn để ghi những thứ
ấy.
`;

export const claude = () => "@AGENTS.md\n";

export const readme = ({ name, rigVersion }) => `# ${name}

Repo một tập phim người que. Nhân vật, hành động, cảnh và mảnh ảnh nằm ở đây;
rig và studio nằm ở bộ \`@stickman3d\` (pin \`${rigVersion}\`).

## Cài

Cần Node.js \`22.13+\` (khuyến nghị bản LTS), Git và pnpm 11. Máy chỉ có Node thì
cài pnpm bằng bộ cài chính thức, sau đó mở terminal mới hoặc nạp lại file shell
mà bộ cài báo:

\`\`\`bash
npx get-pnpm 11
pnpm --version
\`\`\`

Sáu \`@stickman3d/*\` nằm ở package registry GitLab, không phải npmjs; \`.npmrc\`
của repo đã trỏ sẵn. Xin maintainer token \`stickman-team-read\`, rồi khai một
lần ở cấp user:

\`\`\`bash
pnpm config set "${REGISTRY.replace(/^https:/, "")}:_authToken" <deploy token>
pnpm install
\`\`\`

Với pnpm 11, token nằm ở \`~/.config/pnpm/auth.ini\`. Không ghi token vào
\`.npmrc\` của repo và không commit nó.

## Chỉnh bằng studio

\`\`\`bash
pnpm studio                              # http://localhost:5173, đọc sẵn repo này
\`\`\`

Mở lên là thấy nhân vật của repo này (chỉ đọc). Muốn **ghi** thì bấm **Mở thư
mục** và trỏ vào chính thư mục này — studio ghi JSON thẳng vào \`characters/\` và
\`actions/\` qua File System Access API (bản cũ giữ ở \`<file>.json.bak\`), không
có endpoint ghi nào phía server. Nút ấy chỉ có ở \`localhost\`, mở từ điện thoại
thì xem thôi.

## Chỉnh bằng agent

MCP server đã khai ở \`.mcp.json\`. Agent gọi \`describe_rig\` để biết có gì, viết
JSON, render ra PNG rồi mở ảnh xem. Xem [AGENTS.md](AGENTS.md).

## Dựng phim

App Remotion có sẵn ở \`src/\`: một composition cho mỗi file trong \`scenes/\` (một
cảnh) và mỗi file trong \`episodes/\` (cả tập):

\`\`\`bash
pnpm remotion                            # Remotion Studio, tua được
pnpm render <ten-canh|ten-tap> out/<ten>.mp4
pnpm render:final <ten-tap> out/<ten>.mp4 # bản đăng: frame PNG, tóc dựng khối đúng góc từng khung
pnpm still <ten-canh> out/<ten>.png --frame=105
pnpm frames <ten-canh> 316,317,349-351   # nhiều khung, một lượt bundle
pnpm thumbnails <ten-tap>                # mọi thumbnail của tập, khai ở episodes/<ten-tap>.json
\`\`\`

Hậu kỳ (docs/07): \`pnpm tts\` gen lời dẫn local từ \`text\` trong \`episodes/\`,
\`pnpm tts-blocks\` gen lời dẫn ElevenLabs theo khối rồi cắt cue, \`pnpm sfx\` dựng tiếng
động từ mẫu CC0, \`pnpm sfx-el\` gen tiếng động ElevenLabs, \`pnpm sfx-loop\` dựng bè lặp
cho cue có \`loop\`, \`pnpm lipsync\` sinh khẩu hình từ file lời, \`pnpm srt\` sinh phụ đề
đo bằng \`silencedetect\`. Bảng tiếng động của tập nằm ở \`sfx/\`. \`tts\`, \`sfx\` và
\`lipsync\` cần \`.venv\` — dựng khi bắt đầu làm tiếng; key ElevenLabs để ở \`.env\`. Cue
\`len:\` của \`tts-blocks\` cần \`uv\` (chạy \`tools/len-giong.py\`).

## Kiểm

\`\`\`bash
pnpm check                              # cả workspace
pnpm exec stickman check --scene <ten>  # chỉ một cảnh vừa sửa (regex trên id cảnh)
\`\`\`

Thay một file tiếng thì \`pnpm retime\`: nó đo lại file rồi ghi số vào cue khai
\`after\` và mốc khai ở \`shot.marks\` — mọi thứ neo \`@mốc\` trong cảnh đi theo,
không phải sửa từng số. \`check\` kêu khi số đang ghi đã cũ so với tiếng.

\`check\` cũng báo nếu máy thiếu công cụ ngoài. Trước khi render đủ quy trình, cài
\`rsvg-convert\`, \`ffmpeg\` / \`ffprobe\` và ImageMagick 7 (\`magick\`) bằng
package manager của hệ điều hành. Soi một cảnh thành dải ảnh tĩnh hoặc mp4:

\`\`\`bash
pnpm strip scenes/<ten>.json --out tmp/strip.png --cols 12
pnpm strip scenes/<ten>.json --stage --out tmp/khung.png   # cả khung: nền + camera
pnpm video --scene scenes/<ten>.json --out tmp/<ten>.mp4
\`\`\`
`;

/** Registry của sáu @stickman3d/* — repo video cài từ đây chứ không phải npmjs */
export const REGISTRY = "https://gitlab.com/api/v4/projects/87383859/packages/npm/";

/** Chỉ dòng registry: pnpm 11 bỏ qua credential đặt trong .npmrc của repo */
export const npmrc = () => `@stickman3d:registry=${REGISTRY}
`;

export const gitignore = () => `node_modules
.venv
.env
tmp
out
*.json.bak
*.local
`;

export const mcpJson = () =>
  JSON.stringify(
    {
      mcpServers: {
        stickman: {
          command: "pnpm",
          args: ["exec", "stickman-mcp", "--workspace", "."],
        },
      },
    },
    null,
    2,
  ) + "\n";

/** Bản Remotion mà bộ scaffold đã kiểm; đổi số thì render lại một cảnh rồi hãy chốt */
export const REMOTION = "4.0.518";
/** Remotion pin zod đúng một số; lệch là mỗi lượt render in một khối "Version mismatch" */
export const ZOD = "4.4.3";

/** Version pin đúng số, không `^`: repo video sống ngắn và docs đã chép theo version này */
export const packageJson = ({ name, versions }) =>
  JSON.stringify(
    {
      name,
      private: true,
      type: "module",
      // Mã vẽ của repo: `stickman-render`, MCP và app Remotion cùng nạp từ đây — docs/10, docs/02
      stickman: { layers: "src/lop.tsx", parts: "src/parts.tsx" },
      scripts: {
        studio: "stickman studio",
        remotion: "remotion studio",
        render: "remotion render",
        // Bản upload phải là frame PNG: frame JPEG để x264 tiêu bit bám gợn quanh nét mực — docs/07.
        // `REMOTION_QUALITY=final` chiếu tóc dựng khối đúng góc từng khung — docs/02
        "render:final": "REMOTION_QUALITY=final remotion render --image-format=png --crf=18",
        still: "remotion still",
        frames: "node tools/still.mjs",
        // `--experimental-strip-types` để Node 22 nạp thẳng `src/shots.ts`; Node 23.6+ bỏ qua cờ
        srt: "node --experimental-strip-types tools/srt.mjs",
        tts: ".venv/bin/python tools/tts.py",
        // Hai cửa ElevenLabs và bè lặp chỉ cần ffmpeg và stdlib — không đi qua `.venv`
        "tts-blocks": "python3 tools/tts-blocks.py",
        sfx: ".venv/bin/python tools/sfx.py",
        "sfx-el": "python3 tools/sfx-el.py",
        "sfx-loop": "python3 tools/sfx-loop.py",
        // Mốc chữ chạy `tools/words.py` bằng `.venv` (faster-whisper), phần còn lại là rig — docs/07
        lipsync: "node tools/lipsync.mjs",
        thumbnails: "node tools/thumbnails.mjs",
        "cut-torso": "python3 tools/cut-torso.py",
        video: "stickman-video",
        strip: "stickman-render --scene",
        check: "stickman check",
        // Đo lại tiếng rồi ghi số vào cue `after` và mốc `shot.marks` — docs/07
        retime: "stickman retime",
        typecheck: "tsc --noEmit",
      },
      dependencies: {
        "@remotion/bundler": REMOTION,
        "@remotion/cli": REMOTION,
        "@remotion/renderer": REMOTION,
        "@stickman3d/cli": versions.cli,
        "@stickman3d/fx": versions.fx,
        "@stickman3d/mcp": versions.mcp,
        "@stickman3d/render": versions.render,
        "@stickman3d/rig": versions.rig,
        "@stickman3d/sketch": versions.sketch,
        react: "^19.2.0",
        "react-dom": "^19.2.0",
        remotion: REMOTION,
        zod: ZOD,
      },
      devDependencies: {
        "@types/react": "^19.2.7",
        "@types/react-dom": "^19.2.0",
        typescript: "^5.9.3",
      },
    },
    null,
    2,
  ) + "\n";

/** pnpm 11 không tự build esbuild mà Remotion cần */
export const pnpmWorkspace = () => `allowBuilds:
  esbuild: true
`;

/** `pieces/catalog.json` trống: mảnh của repo video ghi vào đây, bộ chung của studio nằm ở lớp dưới */
export const emptyCatalog = () => JSON.stringify({ schemaVersion: 1, pieces: [] }, null, 2) + "\n";

/** `files` là băm của những file studio phát, để `upgrade` biết file nào bị sửa tay */
export const stickmanJson = ({ versions, at, files = {}, legs }) =>
  JSON.stringify({ schemaVersion: 3, versions, legs, initializedAt: at, files }, null, 2) + "\n";
