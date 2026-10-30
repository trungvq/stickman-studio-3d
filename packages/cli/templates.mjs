// Nội dung các file `stickman init` sinh mới. Docs không nằm ở đây: chúng đi theo package.

export const stickmanMd = ({ rigVersion }) => `# stickman.md

Cách dùng bộ rig ở repo này. File này do \`stickman upgrade\` sinh lại theo
version đang cài — **đừng sửa tay**, luật riêng của tập viết ở \`AGENTS.md\`.

Repo một tập phim người que: nhân vật, hành động, cảnh, nền và tiếng của **tập
này**. Rig là \`@stickman3d/rig@${rigVersion}\` đã pin — đừng sửa gì trong
\`node_modules/@stickman3d/\`.

## Bố cục

| | |
|---|---|
| \`characters/\` | JSON nhân vật của tập này: hình dáng, bảng màu, trang phục dựng khối ở từng socket, và \`items\` — đồ thay được theo cảnh. Nhân vật chung (bốn người mẫu \`sample-*\`) đi theo studio như hành động chung, \`patch\` thì bản đè nằm ở đây. |
| \`actions/\` | JSON hành động của tập này. Hành động chung (\`walk\`, \`idle\`, bộ \`-3d\` cho người 3D — mục [Hành động chung](#hành-động-chung)) đi theo studio, không nằm ở đây; \`list\` gắn \`layer\` cho biết. Muốn sửa một cái chung thì \`patch\` nó — bản đè sẽ nằm ở đây. |
| \`scenes/\` | JSON cảnh: ghép hành động theo timeline, nhiều người; kèm ống kính, nền và camera của cảnh. |
| \`held/\` | JSON món cầm tay (\`docs 11\`): khung, mốc, hình va chạm và nhãn phần của từng món — điện thoại, chén, khay. Scene cầm bằng \`world.hands[].hold: "món@nhóm"\`. Món mẫu (\`coc\`, \`dien-thoai\`, \`khay\`, \`vali\`… — \`list({ kind: "held" })\`) đi theo studio, trùng tên thì bản ở đây đè. |
| \`episodes/\` | JSON tập: xếp các cảnh thành shot, cộng tiếng và lời, thumbnail và các biến thể của nó. Xem \`docs 07\` § Bảng thời gian của cả tập. |
| \`sfx/\` | Bảng tiếng động của tập: \`recipes.json\` cho \`pnpm sfx\`, \`elevenlabs.json\` cho \`pnpm sfx-el\`, \`loops.json\` cho \`pnpm sfx-loop\`. Thư viện chung nằm trong \`tools/\`. Xem \`docs 07\` § Tiếng động. |
| \`pieces/\` | Ảnh PNG mà hiệu ứng vẽ vật rời tay (\`fx[]\`) trỏ bằng tên file — \`docs 09\`. |
| \`src/\` | App Remotion: một composition cho mỗi file trong \`scenes/\` và \`episodes/\`. Xem \`docs 03\` § Remotion. |
| \`assets/bg/\` | Ảnh nền; \`scene.bg[].file\` trỏ bằng tên file ở đây. \`assets/audio/\` là tiếng, \`shots[].audio[].file\` trỏ vào đó kèm thư mục: \`t<nn>/\` là tiếng của tập, \`sfx/\` là tiếng động dùng chung. |
| \`stickman.json\` | Version bộ \`@stickman3d\` đã pin; \`stickman check\` so lại với cái đang cài. |

## Spec rig ở đâu

**Không nằm trong repo này.** Nó đi theo \`@stickman3d/rig@${rigVersion}\` đã pin,
nên không có bản chép nào để cũ đi. Đọc bằng MCP tool \`docs\`: gọi trống để lấy
mục lục, \`docs({ file: "03" })\` để lấy một file. Không có MCP thì
\`pnpm exec stickman docs 03\`.

\`docs 00\` **bất biến — bẫy theo vùng, làm sai thì không gì báo** · \`01\` rig và
tư thế · \`03\` scene · \`04\` MCP · \`05\` repo video · \`07\` làm một tập ·
\`09\` hiệu ứng · \`10\` lớp vẽ code · \`11\` nhóm cầm · \`12\` trang phục 3D.

**Đọc file liên quan trước khi viết JSON.** Đó là nguồn sự thật cho mọi hành vi,
và nó khớp đúng version đang cài.

## Trước khi viết dòng JSON đầu tiên

Gọi MCP \`describe_rig\` — hằng số, thư viện tư thế, bộ sinh, bảng kiểu trang phục và
các quy ước dấu góc đều ở đó. Đừng nhớ số từ lần trước. \`schema(kind)\` trả JSON
Schema kèm object mặc định, \`validate\` kiểm mà không ghi, \`write\` / \`patch\` mới
chạm đĩa.

## Hành động chung

Người 3D có sẵn một bộ hành động chung đi theo package: nền đứng, ngồi, quỳ và chuyển thế; đi, bước; tay để yên; thân
ngả, sụp; cúi chào; đầu gật, lắc, quay, liếc; điệu bộ lúc nói và bộ dáng thoại \`talk-pose-*\`; chào, mời, gọi; cảm
xúc, cử chỉ; cầm đồ (điện thoại, khay, ly, vali, túi); hai người (thì thầm, vỗ vai, bắt tay, đưa, nhận). Bảng theo nhóm
và từng file ở \`docs 01\` § Bộ hành động 3D. **Dùng bộ chung trước khi soạn hành động mới.**

- **Chọn**: \`list({ kind: "actions", match: "bow-*-3d,nod-*" })\` trả \`note\` của từng hành động khớp — làm gì,
  ghi kênh nào, cần nền gì, chồng với gì — cùng \`mask\` và \`preview\`. Không \`match\` thì chỉ có tên.
- **Xem**: \`pnpm studio\` → công tắc **Cảnh / Thư viện** đầu thanh trên: một người mẫu (hay nhân vật của repo)
  diễn hành động trên nền, ghế, quầy, món của nó; 1–5 đổi góc máy, V đổi biến thể cùng gốc. Mở thẳng:
  \`http://localhost:5180/?library=1&action=bow-30-3d&who=sample-woman&angle=near\`. Soi cả lô trên bốn người mẫu:
  \`pnpm bang-hanh-dong --hanh-dong 'bow-*-3d'\` (\`docs 07\` § Bảng duyệt hành động).
- **Đọc tên**: \`<gốc>[-<mức>][-<biến>][-<phía>][-<pha>]-3d\`. Mức là số độ (\`bow-30-3d\`) hay \`-soft\` / \`-big\`;
  phía \`-near\` / \`-far\` theo ống kính (chọn theo bố cục khung), \`-left\` / \`-right\` theo tay của người; pha:
  không hậu tố là vào dáng rồi giữ (hay đi rồi về một lần, hay lặp), \`-hold\` ở dáng cuối từ giây 0, \`-out\` buông
  về nền. \`walk\` là bộ sinh nên không đuôi.
- **Ghép**: track dưới là nền (\`stand-3d\`, \`sit-3d\` với \`world.sit\`, \`seiza-3d\`), track trên là hành động
  chỉ ghi vài kênh (thân, đầu, một tay) — \`note\` ghi cái gì chồng được lên cái gì. Hành động cầm đồ chỉ đặt tay; món
  khai ở \`world.hands[].hold\` của cảnh.
- **Hành động theo chỗ đồ trong cảnh**: rót vào cốc không ở đúng chỗ mẫu (cao, thấp, xa, lệch) thì không sửa tay
  \`pour-*-3d\` — chạy \`pnpm exec stickman gen pour --scene <cảnh> --cast <người rót> --at <giây> --cup <người cầm cốc | x,y,z>\`
  (MCP \`gen\`): lệnh đo cốc trong cảnh, sinh \`actions/pour-…-3d.json\`, tự kiểm trên chính cảnh (miệng bình trên miệng
  cốc, cổ tay, khuỷu, \`check\`) và chỉ ghi khi đạt; ngoài tầm thì báo kèm gợi ý dời người hay cốc — \`docs 05\` § Sinh hành
  động theo cảnh. Người ngồi ghế không cao bằng gối (\`sit-3d\` cho bàn chân lơ lửng hay lún sàn), ngồi ghế bar, tựa lưng
  ghế, tay trên bàn hay tay vịn: \`pnpm exec stickman gen sit --scene <cảnh> --cast <người> [--at <giây>] --legs … --back …
  --hands …\` đặt đế giày lên \`world.floor\` theo đúng mặt ngồi và cỡ người, đo bàn, tay vịn, lưng ghế theo tên vật của
  cảnh three, in clip thay clip nền.
- **Hành động riêng của tập** đặt theo cùng quy ước tên (Thư viện gom biến thể theo gốc tên) và khai \`preview\` để
  xem được trong Thư viện — \`docs 01\` § Tên và hậu tố, § Mẫu \`note\`. Trùng tên một file chung là đè nó.

## Vòng lặp

Nhân vật → hành động → cảnh. Mỗi bước render rồi **mở ảnh ra nhìn**: \`render_*\`
trả đường dẫn file chứ không nhét ảnh vào ngữ cảnh, không mở là không biết mình
vừa làm gì.

- Nhân vật dựng bằng bảng màu và trang phục dựng khối (\`src: "sculpt"\`: tóc, áo, váy, mũ, kính, râu, khăn —
  \`docs 12\`), không cần ảnh nào.
- Một nhân vật cầm hay mặc nhiều thứ trong tập thì vẫn là **một file**: mỗi thứ
  một mục trong \`items\`, cảnh nào cần thì \`equip\` cảnh ấy
  (\`docs 01\` § Đồ thay được). Nhân bản file nhân vật,
  hay cắm sẵn đồ vào \`pieces\` rồi cảnh nào cũng gỡ ra, đều là đi sai đường.
- Kiểm bằng \`shrug\`, đừng kiểm bằng \`walk\`: sai dấu góc không lộ ra ở góc nhỏ.
- Cảnh thì \`render_scene\` để xem và \`scene_probe\` để **đo** toạ độ bàn tay,
  đừng suy điểm gặp bằng mắt. Cảnh có \`scene.lens\` thì mỗi ô của \`render_scene\` là ảnh three
  thật như video, cả khung đã đi qua camera — \`docs 04\` § Ảnh three thật.
- Tay chạm người (che miệng, áp tai, vỗ tay, chắp tay sau, tay lên đùi) thì khai mốc thân
  \`reach: { "to": "mouth" }\`, đừng đoán toạ độ — nó đúng với mọi cỡ người, cúi hay ngồi; lòng tay
  thì khai \`hand: { "palm": "down" }\` (hay \`{ "toward": "mouth" }\`), đừng đoán \`turn\` —
  \`docs 01\` § Đích theo mốc, § Hướng lòng tay theo ý. Dáng cầm vật nhỏ, móc quai, kẹp cạnh,
  đặt phẳng có sẵn: \`pinch\`, \`hook\`, \`edge\`, \`flat\`, \`cup\`, \`clasp\`.
- Người cầm đồ: món khai một lần ở \`held/<món>.json\` (hình va chạm, mặt trước, đầu trên, nhãn phần), cảnh khai
  chỗ cầm \`world.hands[].hold: "món@nhóm"\` hay \`{ "item", "group", … }\` (bậc thang tới \`hold: null\`) cùng ý định —
  món quay về đâu (\`face: "camera"\`, \`{ "cast": "b" }\`, \`up: "rim"\`) —, đừng khai \`palm\` / \`fingers\` cho tay đang
  cầm; cảnh three đăng ký vật bằng \`cast.provide("món", vật)\` trong \`extra\`, rig gắn món vào tay suốt quãng cầm —
  \`docs 11\`, \`docs 03\` § Đồ cầm tay. Ngón có ôm món không thì soi \`pnpm can-tay\`. Thêm hay sửa món thì soi bảng
  \`pnpm bang-cam\` (nhóm × món × chỗ cầm mẫu × tay nhỏ nhất, lớn nhất × ba góc, kèm số đo \`held\`); nâng rig xong thì
  \`pnpm bang-cam --so\` so từng ô với bảng chuẩn đã duyệt — \`docs 03\` § Bảng duyệt nhóm cầm. Món treo trên cánh tay
  (túi khoác khuỷu, đeo vai) là \`món@carry\` với \`"on": "elbow" | "shoulder"\`, món khai \`seats\`, \`shape\` thân món và quai cứng là phần \`strap\`,
  bàn tay ấy để tự do; khuỷu phải gập, tay phải dang ngoài túi — \`docs 01\` § Món treo.
- Đặt tay lên một mặt (quầy, sách, bàn phím, bàn) hay đổi \`turn\` / \`elbow\` xong thì
  đọc \`world.palms\` của \`scene_probe\` (lòng tay \`úp\`, \`down\` dưới 45; \`aim\` là khe tới
  mốc và độ lệch còn lại so với \`palm\` đã khai), đừng phán hướng lòng tay bằng mắt —
  \`docs 01\` § Hướng lòng bàn tay. Muốn nhìn tận mắt dáng bàn tay người 3D thì
  \`pnpm can-tay <ten> <giây,…>\`: bảng ảnh cận từng bàn tay từ trước, chéo, ngang, kèm hướng lòng tay đo
  được — đừng phán dáng tay trên khung toàn cảnh, ở đó bàn tay chỉ 30–60 px.
- Sửa xong một cảnh thì \`check\` đúng cảnh ấy: MCP \`check({ scene: "<ten>" })\` hay
  \`pnpm exec stickman check --scene <ten>\` (regex trên id cảnh) — cỡ chục giây, lâu hơn khi cảnh dài và
  đông người; sửa nhiều cảnh thì gom chung một regex (\`'^t01-s0(16|21|35)'\`), các cảnh đo song song. Nó bắt chân
  trượt, hành động không soạn ở \`side\` trên người 3D, tay chân giật trên hình, đồ cầm sai; người lồng vào đồ và tay xuyên thân chỉ đo
  khi gọi \`--only clash\`. Dáng bàn tay soi và sửa ở Studio 3D. Sửa gì thì chỉ chạy nhóm luật của thứ ấy, nhóm không
  chạy thì không dựng: \`--only move\` (chỗ đứng, \`path\`, tay), \`--only held\` (đồ cầm, chỗ cầm; thêm \`ref\` khi sửa \`held/\`), \`--uses <hành động> --only
  ref,move,held\` (hành động chung) — bảng đủ ở \`docs 05\` § Nhóm luật. Cuối lô: đủ nhóm trên các cảnh của lô với
  \`--baseline <file>\` để chỉ thấy cảnh báo mới. \`check\` cả workspace chậm: chỉ chạy ở cuối tập hay sau khi nâng rig.
  Nhóm \`legacy\` kể đồ cầm còn đi đường cũ (\`hold\` không có chỗ cầm nhóm); cảnh cũ chưa chuyển thì \`--skip legacy\`.
- Người 3D (\`cast[].world\`) chỉ diễn hành động soạn ở \`side\` ở kênh tay chân
  (\`stand-3d\`, \`sit-3d\`, bản \`-3d\` của repo), cả ở track thân từ giây 0 thay cho clip
  rỗng. Chỗ cố ý giật (giật mình, đập bàn) khai \`"snap": true\` ở hành động, ở clip hay ở
  mốc \`world.hands\` — \`docs 03\` § Giật trên hình.
- Khung thật của app Remotion (cả lớp chữ của repo): \`pnpm frames <ten> 10,60,150-152 [<ten2> 30,90 …]\` —
  một lượt bundle cho mọi cảnh, gom hết khung cần soi của cả lô vào một lần gọi.
- Muốn nhìn chuyển động chứ không phải ảnh tĩnh: \`pnpm render <ten> tmp/<ten>.mp4\`.

## Quy ước

- Tài liệu và chữ trên giao diện tiếng Việt; định danh trong code tiếng Anh.
- Commit message tiếng Anh, conventional commit, một dòng, không body.
- Muốn đổi hành vi rig thì đổi ở repo studio rồi \`pnpm exec stickman upgrade\` bên này,
  đừng vá \`node_modules\`.
- Nâng lên bộ rig mới: cài version mới rồi \`stickman upgrade\` (\`--dry-run\` xem trước).
  Nó chép lại app Remotion và file agent — docs không nằm trong đó vì không có bản chép.
  \`characters/\`, \`actions/\`, \`scenes/\`, \`episodes/\`, \`held/\`, \`pieces/\`, \`sfx/\` không bị đụng.
  File mình sửa tay thì nó hỏi trước khi đè.
- **Đừng sửa file \`src/\` và \`tools/\` do studio phát** — mẫu đổi là phải trộn tay. Lớp vẽ code ở
  \`src/lop.tsx\`, context cho lớp vẽ cần dữ liệu app Remotion ở
  \`src/scene-wrap.tsx\` (hai file này của repo, \`upgrade\` không đụng), tool riêng ở file mới trong
  \`tools/\`. Sửa chung (lỗi, tuỳ chọn mới) thì làm ở repo studio.
`;

/**
 * Seed một lần, từ đó là của repo video: `upgrade` không đụng. Hướng dẫn dùng rig không nằm
 * đây mà ở `stickman.md` — chỗ ấy mới được sinh lại theo version.
 */
export const agents = () => `# AGENTS.md

Repo một tập phim người que. **Đọc \`stickman.md\` trước khi viết dòng JSON đầu
tiên** — cách dùng rig, bộ hành động chung và vòng lặp dựng cảnh đều ở
đó, và nó đi theo version \`@stickman3d\` đang cài.

@stickman.md

## Luật của tập này

Chưa có gì. Viết vào đây khi tập mọc ra quy ước riêng: cách đặt tên cảnh và
shot, giọng từng nhân vật, trang phục nào cho ai, việc đang dở. \`stickman
upgrade\` không đụng file này, nên nó là chỗ duy nhất an toàn để ghi những thứ
ấy.
`;

export const claude = () => "@AGENTS.md\n";

export const readme = ({ name, rigVersion }) => `# ${name}

Repo một tập phim người que. Nhân vật, hành động, cảnh, nền và tiếng nằm ở đây;
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
pnpm studio                              # Studio 3D, http://localhost:5180
\`\`\`

**Studio 3D** xem cảnh three của \`scenes/\` và soạn kiểu cầm; **Lưu** ghi thẳng
\`scenes/\` và \`held/\` của repo này. File đã đổi trên đĩa từ lúc nạp (agent,
\`retime\`, sửa tay) thì studio từ chối ghi, nạp lại rồi sửa lại. Bản cũ giữ ở
\`<file>.json.bak\`. Chỉ trả lời localhost và tailnet Tailscale (\`--host <địa chỉ>\` nghe đúng địa chỉ ấy, bỏ chặn, cùng đường ghi).

## Chỉnh bằng agent

MCP server đã khai ở \`.mcp.json\`. Agent gọi \`describe_rig\` để biết có gì, viết
JSON, render ra PNG rồi mở ảnh xem. Xem [AGENTS.md](AGENTS.md).

## Dựng phim

App Remotion có sẵn ở \`src/\`: một composition cho mỗi file trong \`scenes/\` (một
cảnh) và mỗi file trong \`episodes/\` (cả tập). Mỗi bundle chỉ mang phạm vi của lượt chạy:
\`render\` / \`still\` lấy id gõ vào, Studio lấy \`stickman.scope\` của \`package.json\` hay
\`STICKMAN_SCOPE=t02 pnpm remotion\` (docs/03 § Phạm vi bundle):

\`\`\`bash
pnpm remotion                            # Remotion Studio, tua được
pnpm render <ten-canh|ten-tap> out/<ten>.mp4
pnpm render:final <ten-tap> out/<ten>.mp4 # bản đăng: frame PNG, tóc dựng khối đúng góc từng khung
pnpm still <ten-canh> out/<ten>.png --frame=105
pnpm frames <ten-canh> 316,317,349-351 [<ten-canh-2> 30,90 …]  # nhiều khung, nhiều cảnh, một lượt bundle
pnpm can-tay <ten-canh> 1.8,2.7          # bảng ảnh cận bàn tay người 3D, kèm hướng lòng tay đo được
pnpm bang-cam [--so]                     # bảng duyệt nhóm cầm trên món của held/; --so so với bảng chuẩn
pnpm bang-hanh-dong [--so]               # bảng duyệt hành động × người mẫu × góc × khung, kèm check; --so so với chuẩn
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
pnpm exec stickman check --scene <ten> --only move  # chỉ nhóm luật của thứ vừa sửa
\`\`\`

Thay một file tiếng thì \`pnpm retime\`: nó đo lại file rồi ghi số vào cue khai
\`after\` và mốc khai ở \`shot.marks\` — mọi thứ neo \`@mốc\` trong cảnh đi theo,
không phải sửa từng số. \`check\` kêu khi số đang ghi đã cũ so với tiếng.

\`check\` cũng báo nếu máy thiếu công cụ ngoài. Trước khi render đủ quy trình, cài
\`rsvg-convert\`, \`ffmpeg\` / \`ffprobe\` và ImageMagick 7 (\`magick\`) bằng
package manager của hệ điều hành. Soi một cảnh thành dải ảnh tĩnh:

\`\`\`bash
pnpm strip scenes/<ten>.json --out tmp/strip.png --cols 12   # cảnh có lens: khung three thật, cần Chromium
pnpm strip scenes/<ten>.json --skeleton --out tmp/xuong.png  # que xương người 3D trên lưới sàn
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

/** `three` của người 3D (`src/khoi3d/`); `@stickman3d/rig` để nó làm peer, cả app phải chung một bản */
export const THREE = "0.186.0";

/** Version pin đúng số, không `^`: repo video sống ngắn và docs đã chép theo version này */
export const packageJson = ({ name, versions }) =>
  JSON.stringify(
    {
      name,
      private: true,
      type: "module",
      // Mã vẽ của repo: `stickman-render`, MCP và app Remotion cùng nạp từ đây — docs/10; `world` là cảnh three
      // cho `check` — docs/10
      stickman: { layers: "src/lop.tsx", world: "src/khoi3d/world.ts" },
      scripts: {
        studio: "stickman studio",
        remotion: "remotion studio",
        // React production: cảnh 3D nặng nhanh hơn, mất fast refresh — `remotion.config.ts`
        "remotion-prod": "STUDIO_FAST=1 remotion studio",
        render: "remotion render",
        // Bản upload phải là frame PNG: frame JPEG để x264 tiêu bit bám gợn quanh nét mực — docs/07
        "render:final": "remotion render --image-format=png --crf=18",
        still: "remotion still",
        frames: "node tools/still.mjs",
        // Bảng ảnh cận bàn tay người 3D — docs/03 § Lòng bàn tay
        "can-tay": "node tools/can-tay.mjs",
        // Bảng duyệt nhóm cầm: nhóm × món × chỗ cầm mẫu × hai cỡ tay × ba góc, so hồi quy sau khi nâng rig — docs/03 § Bảng duyệt nhóm cầm
        "bang-cam": "node tools/bang-cam.mjs",
        // Bảng duyệt hành động: hành động × người mẫu × ba góc × bốn khung, kèm `check --only move,clash`, so hồi quy — docs/07 § Bảng duyệt hành động
        "bang-hanh-dong": "node tools/bang-hanh-dong.mjs",
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
        react: "^19.2.0",
        "react-dom": "^19.2.0",
        remotion: REMOTION,
        three: THREE,
        zod: ZOD,
      },
      devDependencies: {
        "@types/react": "^19.2.7",
        "@types/react-dom": "^19.2.0",
        "@types/three": `^${THREE}`,
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

/** `files` là băm của những file studio phát, để `upgrade` biết file nào bị sửa tay */
export const stickmanJson = ({ versions, at, files = {} }) =>
  JSON.stringify({ schemaVersion: 3, versions, initializedAt: at, files }, null, 2) + "\n";

/**
 * Cảnh 3D mẫu của `init`: hai người đứng nói trong phòng trơn — `src/khoi3d/canh.ts` nối tên cảnh với
 * `plainRoom`. Không đi theo `upgrade`: cảnh là của repo.
 */
export const scene3d = (schemaVersion) =>
  JSON.stringify(
    {
      schemaVersion,
      name: "vi-du-3d",
      frame: "wide",
      duration: 4,
      camera: [{ t: 0, x: 0, y: 0, zoom: 1 }],
      cast: [
        {
          id: "lan",
          character: "sample-woman.json",
          tracks: [
            { name: "than", clips: [{ action: "stand-3d", start: 0 }] },
            { name: "mat", clips: [{ action: "face-kind", start: 0 }] },
            { name: "moi", clips: [{ action: "talk-lips", start: 0.3 }] },
          ],
          world: { at: [-150, 0, 300], yaw: 50 },
        },
        {
          id: "mai",
          character: "sample-kimono.json",
          tracks: [
            { name: "than", clips: [{ action: "stand-3d", start: 0 }] },
            { name: "mat", clips: [{ action: "face-calm", start: 0 }] },
          ],
          world: { at: [150, 0, 300], yaw: 130 },
        },
      ],
      lens: { eye: [0, -330, -700], yaw: 0, pitch: 8, f: 1100, cx: 0, cy: 0 },
    },
    null,
    2,
  ) + "\n";
