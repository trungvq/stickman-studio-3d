# 05 — Dựng một repo video

Mỗi tập phim là một repo riêng: nhân vật, hành động, cảnh, mảnh ảnh và app
Remotion của nó. Rig vào bằng đường dependency, không phải nhánh trong repo
studio. `@stickman3d/cli` (bin `stickman`) dựng cái repo ấy và soi nó; MCP gọi vào
cùng hàm qua tool `init` / `check`.

Các bước từ máy trắng tới repo chạy được — cài pnpm, khai registry, `init`, cài
công cụ render — nằm ở `QUICKSTART.md` của repo studio. File này nói về repo
video sau khi nó đã đứng: nó gồm những gì, soi bằng gì, nâng version thế nào.

## `init` sinh ra gì

Chép một lần làm mẫu, từ đó là của repo video: `scenes/`, `props/`,
`episodes/`. **Mảnh ảnh, hành động, động vật và nhân vật thì không chép** — chúng
là lớp chung nằm trong package, xem [Hai lớp](#hai-lớp); `pieces/` chỉ có một
`catalog.json` trống, `actions/`, `animals/` và `characters/` trống.


Sinh mới: `stickman.md` — cách dùng rig cho agent, `AGENTS.md` trỏ vào đó và để
trống chỗ ghi luật riêng của tập, `CLAUDE.md` một dòng trỏ vào `AGENTS.md`, `README.md`,
`.gitignore`, `.npmrc` trỏ scope `@stickman3d` sang registry GitLab, `.mcp.json`
khai sẵn server, và `package.json` pin **đúng số version**, không `^`.

Cùng với đó là **app Remotion**: `src/` (`index.ts`, `Root.tsx`, `Scene.tsx`,
`data.ts`, `images.ts`, tầng tập `episode.ts` / `shots.ts` / `Episode.tsx`, và
`Thumbnail.tsx`; cảnh 3D ở `khoi3d/` — `Scene3D.tsx` sân khấu three, `Overlay3D.tsx` lớp chữ 2D đè
lên, `set.ts` kiểu bối cảnh và phòng trơn `plainRoom`; cùng bốn file của repo `lop.tsx`, `parts.tsx`,
`scene-wrap.tsx`, `khoi3d/canh.ts`), `tools/` (`still.mjs`, `thumbnails.mjs`, `srt.mjs`, `tts.py`,
`tts-blocks.py` cùng `len-giong.py`, `lipsync.mjs` cùng `words.py`, `sfx.py`, `sfx-el.py`,
`sfx-loop.py`, `cut-torso.py`, `webpack.mjs` — [07](07-lam-tap.md#công-cụ-trong-tools)),
`remotion.config.ts`, `tsconfig.json`, `pnpm-workspace.yaml`, và `package.json` có sẵn
`pnpm remotion` / `render` / `still` / `frames` / `thumbnails` / `srt` / `tts` /
`tts-blocks` / `lipsync` / `sfx` / `sfx-el` / `sfx-loop` / `cut-torso` (`pnpm studio` là
character studio). Bảng riêng của tập cho các tool ấy — `sfx/*.json`, bản lời có tag —
không có mẫu nào: tool đọc thấy thiếu thì báo cú pháp. `package.json` pin cả `three`; `scenes/vi-du-3d.json`
là cảnh 3D mẫu, `khoi3d/canh.ts` nối tên nó với `plainRoom` — `Scene.tsx` gặp cảnh có trong `CANH_3D` thì vẽ
người 3D thay người que 2D (`REMOTION_FLAT=1` vẽ bản 2D để so); `THU_3D` cùng file là composition thử bối cảnh
(người, ống kính, khung cắt mượn của một cảnh), nằm trong thư mục `khoi3d` của Studio. Cảnh 3D nặng thì `pnpm studio-prod`
chạy Studio bằng React production, mất fast refresh. Render cảnh 3D cần GPU qua Vulkan:
`remotion.config.ts`, `tools/still.mjs` và `tools/thumbnails.mjs` đặt sẵn `gl: "vulkan"`. Mỗi file trong `scenes/` là một composition, mỗi file trong
`episodes/` cũng vậy; chi tiết và các bẫy ở [03](03-scene.md#remotion) và
[07](07-lam-tap.md#bảng-thời-gian-của-cả-tập).

File đã có thì `init` bỏ qua, `--force` mới đè.

## Spec rig không có bản chép

**`docs/` không nằm trong repo video.** Bộ spec này đi theo `@stickman3d/cli` đã
pin, nên version docs khớp version code theo cấu trúc — không có bước cập nhật,
không có gì để lệch, và không có file nào để `upgrade` phải hỏi đè hay bỏ qua.

Hai cửa đọc, cùng một nguồn:

```bash
pnpm exec stickman docs                 # mục lục
pnpm exec stickman docs 02              # một file; nhận cả `02-trang-phuc.md`
```

Agent thì gọi MCP tool `docs`: trống là mục lục, `{ file: "02" }` là nội dung.

## Công cụ ngoài

`init` và `pnpm install` chỉ cần Node, pnpm và token. Trước khi render, cài thêm
`rsvg-convert`, `ffmpeg`, `ffprobe` và ImageMagick 7 (`magick`) bằng package
manager của hệ điều hành. Ví dụ:

```bash
# Arch / Omarchy
sudo pacman -S --needed librsvg ffmpeg imagemagick

# macOS có Homebrew
brew install librsvg ffmpeg imagemagick
```

Debian/Ubuntu dùng các package tương ứng (`librsvg2-bin`, `ffmpeg`, ImageMagick
7). `stickman check` báo rõ lệnh nào chưa có trên `PATH`; thiếu chúng không cản
studio mở lên nhưng sẽ cản một số bước render, âm thanh hoặc cắt mảnh. Python cho
tiếng là `.venv` riêng của repo, chỉ cần dựng khi bắt đầu làm tiếng:

```bash
python3 -m venv .venv
.venv/bin/pip install numpy faster-whisper     # pnpm sfx, pnpm lipsync
.venv/bin/pip install vieneu soundfile         # pnpm tts, nếu gen lời dẫn local
```

`tts-blocks`, `sfx-el`, `sfx-loop` và `cut-torso` chạy bằng `python3` của hệ thống, chỉ
thư viện chuẩn.

## Soi workspace

```bash
pnpm exec stickman check
```

`check` bắt: version pin lệch rig đang cài, JSON hỏng theo zod của rig, tham chiếu chéo
hỏng (cảnh trỏ vào nhân vật / hành động / đạo cụ / động vật / nền không có, `fx` trỏ vào
mảnh không có; shot trỏ vào cảnh hay cue trỏ vào file tiếng không có), file trong
`actions/` / `animals/` / `characters/` **giống hệt** bản chung của studio — thừa, xoá được —
và **công cụ ngoài thiếu trên `PATH`**: `rsvg-convert`, `ffmpeg`, `ffprobe`,
`magick`. Không cái nào là dependency npm; `check` là cửa kiểm tra chúng.

### Soi một cảnh

Soi cả workspace phải dựng runtime và đo người 3D với đồ khối cho mọi cảnh, nên repo nhiều
tập mất cả phút. Sửa xong một cảnh thì chỉ soi cảnh ấy:

```bash
pnpm exec stickman check --scene t03-s01-cd-haru   # regex trên id cảnh: ^t03-s01 lấy cả nhóm
```

MCP: `check({ scene })`. Cảnh khớp được soi đủ như lượt toàn bộ (tham chiếu, trượt chân, khoá
góc, hành động 2D trên người 3D, người lồng vào đồ, vẽ sai thứ tự, giật trên hình…); cảnh không khớp chỉ được parse cho tham chiếu chéo.
In cảnh báo của cảnh khớp và **mọi lỗi** ở bất kỳ đâu; tập, tiếng, `retime`, file chưa commit, công cụ ngoài thì bỏ qua — chúng chỉ có ở lượt toàn bộ, chạy trước khi
commit hay sau khi nâng rig. Regex không khớp cảnh nào là lỗi.

### Những thứ `check` soi mà không lệnh nào khác soi

Các kiểm tra sau bắt lỗi hợp lệ theo schema nhưng làm thiếu hình hoặc tiếng:

| | Bắt bằng gì |
|---|---|
| **Tiếng dài hơn chỗ nó nằm** | Đo file bằng `ffprobe` rồi so với độ dài shot (`warpTable` của rig, cùng hàm mà `layoutShots` dùng, nên hai bên không lệch). Quá `0,05 s` mới kêu. Không có `ffprobe` thì bỏ qua, không kêu oan |
| **File có trên đĩa mà chưa commit** | `git ls-files`; file không được theo dõi sẽ thiếu sau khi clone. File `.gitignore` loại (audio gen ra, render) là cố ý để ngoài git, không kêu |
| **Công tắc `equip` một chiều** | `equipSwitchProblems` của rig: socket bật tắt mà trạng thái không đổi frame nào — [03](03-scene.md#bốn-bẫy-của-equip) |
| **Hai track cùng ghi một socket** | `sceneEquipProblems` của rig: track sau đè track trước, nên cái gỡ mũ ở track trước bị track sau cầm đồ đè lại |
| **Khuỷu gập ngược khi giơ tay** | `armFoldProblems` của rig: mốc có `\|vai\| > 120` mà khuỷu ngược dấu vai — cẳng tay bung ra ngoài thay vì cuộn về đầu — [00](00-bat-bien.md#dấu-góc-và-hình-học) |
| **Mốc ghi kênh ngoài `mask`** | `maskProblems` của rig: giá trị bị bỏ im lặng — nụ cười khai ở `face` mà `mask` thiếu `face` thì không bao giờ hiện |
| **Người 3D trượt, không tới mốc dừng** | `sceneSlideProblems` đo trên mặt sàn thế giới cho người có `world`: bàn chân chịu lực dịch quá nửa quãng hông đi trong `0,4 s`, mốc dừng của `path` mà hông cách quá `20` đơn vị rig, clip có sải chân chạy khi `path` đã đứng yên — [03](03-scene.md#check-cho-người-3d) |
| **Khoá góc chính diện đẩy thân** | `sceneFacingProblems` của rig: người 3D khai hướng gần ống kính hơn `FRONT_MIN`, mỗi quãng một dòng kèm hướng khai và hướng sau khi đẩy — [03](03-scene.md#check-cho-người-3d) |
| **Người 3D lồng vào đồ** | `sceneClashProblems` của cli (`solidClashes` của fx): phần người lấn vào khối đồ của lớp vẽ code hay vào người khác quá `2` đơn vị thế giới (`stickman.clash.tol`), mỗi cặp một dòng kèm giây sâu nhất và các quãng giây; món khai `touch` thì bỏ phần người ấy — [10](10-lop-ve-code.md#người-lồng-vào-đồ) |
| **Tay xuyên thân** | `sceneClashProblems` của cli (`armPierce` của lõi, tay và thân đúng như three vẽ): cánh tay, cẳng tay (bỏ quãng sát vai và sát cổ tay) lấn vào thân áo của chính người ấy quá `4` (`stickman.clash.self`, `false` là tắt) — [10](10-lop-ve-code.md#tay-xuyên-thân) |
| **Đồ lồng vào đồ** | `sceneItemClashProblems` của cli (`solidItemClashes` của fx): hai món của lớp vẽ code lấn nhau quá `stickman.clash.tol` **và** phần thể tích món nhỏ nằm trong món kia quá `0,1` (`stickman.clash.items`, `false` là tắt), mỗi cặp một dòng; món khai tên món kia trong `touch` thì bỏ — [10](10-lop-ve-code.md#đồ-lồng-vào-đồ) |
| **Vẽ sai thứ tự** | `sceneOverdrawProblems` của cli (`solidOverdraws` của fx): mảnh đồ khối vẽ đè lên phần người dù nằm sau nó, hay phần người vẽ đè lên mảnh đồ đứng trước, quá `stickman.clash.tol`, mỗi cặp một dòng; lỗi của rig — [10](10-lop-ve-code.md#vẽ-sai-thứ-tự) |
| **Người 3D diễn hành động 2D** | `sceneSideProblems` của rig, **mức lỗi**: người có `world` mà clip ghi kênh tay chân của hành động không soạn ở `side` — sân khấu three vẽ kênh ấy ở dáng nghỉ, hoà với hành động `side` là giật một khung. Mỗi người, mỗi clip một dòng kèm bản `-3d` có sẵn — [03](03-scene.md#hành-động-cho-người-3d) |
| **Tay chân giật trên hình** | `sceneSnapProblems` của rig: lấy mẫu theo fps bản chốt, khớp đúng như hình vẽ ra (`actJoints` cho người 3D, `joints2` cho người 2D) qua khung cắt camera, khung nào một khớp nhảy vượt nền chuyển động quanh nó quá ngưỡng (`stickman.snap`) thì kêu, kèm lý do đọc từ timeline; chỗ khai `snap` thì bỏ — [03](03-scene.md#giật-trên-hình) |
| **Hành động tự giật** | `actionSnapProblems` của rig: `wrap` mà mốc cuối ở `t: 1` lệch mốc đầu, hay hai mốc sát nhau đổi góc lớn hơn hẳn hai đoạn kề; file khai `snap` thì bỏ — [01](01-rig.md#hành-động-giật-có-chủ-ý) |
| **Mốc khai mà không ai neo** | Chỉ khi khai `stickman.marks.unused: "warn"`: mốc trong `marks` không chỗ nào trong JSON viết `"@tên"`. Mặc định tắt, vì lớp vẽ code đọc mốc qua `ctx.marks` mà `check` không thấy — [03](03-scene.md#mốc-có-tên) |

### Tập đã đóng

Repo chứa nhiều tập thì tập đã đăng không sửa nữa, và lỗi của nó chỉ làm loãng lỗi của tập
đang làm. Khai `stickman.frozen` trong `package.json`: một regex trên id cảnh, id tập và tên
lớp vẽ code.

```json
"stickman": { "frozen": "^t0[12]-" }
```

Cảnh, tập, lớp khớp regex vẫn được nạp, nên tập đang làm trỏ vào chúng vẫn kiểm được; chỉ
lỗi và cảnh báo **của chính chúng** bị bỏ, `check` in số đã bỏ ở dòng cuối. `retime` không
ghi vào tập khớp regex, và shot của tập đang làm neo mốc vào cảnh khớp regex thì là lỗi —
chép cảnh ra tên mới rồi neo vào bản chép. Nhân vật, hành động, đạo cụ, mảnh là đồ chung
nên không đóng băng được.

## Hai lớp

`pieces/`, `actions/`, `animals/` và `characters/` của repo video là **lớp
trên**; **lớp dưới** là bộ chung đi theo studio — mọi sheet đã cắt, `catalog.json`
của chúng, các hành động mẫu (`walk`, `idle`, `wave`, …), bảy con vật mẫu
([08](08-dong-vat.md#bộ-mẫu)) và các nhân vật mẫu, trong đó có nhân vật tác giả
`author.json` dùng ở mọi tập.
Lớp dưới **không nằm trong repo video**: nó là

`template/` trong package `@stickman3d/cli` (chạy từ cây nguồn thì là
`apps/studio/public`), hằng `COMMON` trong `lib.mjs`. Đọc thì tìm lớp trên
trước, không có mới xuống lớp dưới; file **trùng đường dẫn** thì lớp trên đè.
Danh mục cũng gộp như thế (`mergePieceCatalogs` trong rig, đè theo `file`).
Ghi thì luôn vào lớp trên.

Nhờ vậy:

- studio gen sheet mới → publish `cli` → repo video `pnpm add` là có, không có
  bước chép, không có câu hỏi đè / bỏ qua;
- repo video chỉ commit mảnh, hành động, con vật và nhân vật **của tập ấy**;
- muốn sửa một mảnh, hành động, con vật hay nhân vật chung thì chép sang lớp trên
  **cùng tên** — MCP `patch` một file chung làm đúng việc ấy, studio lưu một nhân
  vật hay con vật chung cũng vậy — hoặc đặt tên khác nếu muốn giữ cả hai. Không có
  ghi ngược xuống lớp dưới.


Bốn đường đọc đều đi hai lớp — studio (`layeredWorkspace` khi mở thư mục,
`serve.mjs` khi chạy `stickman studio`), `stickman-render` / `stickman-video` và
MCP (`layers` + `findIn`), và app Remotion (`remotion.config.ts` trỏ alias
`@stickman-common` vào `COMMON`, `data.ts` `require.context` cả hai, `tools/srt.mjs`
đọc cùng hai thư mục). Thêm đường đọc mới thì cũng phải đi hai lớp. Cảnh, đạo
cụ và tập **không** có lớp dưới — bộ mẫu của chúng chép một lần lúc `init` rồi
thành của repo video.


## Nâng lên bộ rig mới

```bash
pnpm add @stickman3d/rig@… @stickman3d/sketch@… @stickman3d/fx@… @stickman3d/render@… @stickman3d/mcp@… @stickman3d/cli@…
pnpm exec stickman upgrade --dry-run    # xem sẽ đè cái gì
pnpm exec stickman upgrade
```

`upgrade` chép lại **phần studio phát**: app Remotion trong `src/` cùng
`remotion.config.ts` / `tsconfig.json` và `tools/`, `stickman.md` / `.npmrc` /
`.mcp.json` / `pnpm-workspace.yaml`, rồi trộn số version của bộ `@stickman3d` vào
`package.json` (giữ nguyên dependency khác; gói `@stickman3d/*` mà `package.json` chưa có
thì thêm vào, vì app Remotion vừa chép lại đã import nó; `three` và `@types/three` cũng vậy). Script cũng vậy: script đã có
giữ nguyên, script của tool mới chép vào thì thêm.

**`characters/`, `actions/`, `scenes/`, `episodes/`, `props/`, `animals/`, `pieces/`, `sfx/` không bao giờ bị đụng** — đó
là nội dung của tập phim. Mảnh, hành động, con vật và nhân vật chung mới thì tự có
theo package (xem [Hai lớp](#hai-lớp)), không cần chép; spec rig cũng vậy.
`AGENTS.md` / `README.md` / `CLAUDE.md` / `.gitignore` và `src/lop.tsx` / `src/parts.tsx` /
`src/scene-wrap.tsx` / `src/khoi3d/canh.ts` cũng không: `init` phát chúng một lần làm nền, từ đó là
của repo video (`SEED_ONLY` trong `lib.mjs`), `stickman.json` không giữ băm của chúng. Thiếu thì
`upgrade` dựng lại bản mẫu — app Remotion `import` cả bốn.

**Đừng sửa file app Remotion và tool do studio phát.** Sửa rồi thì mỗi lần mẫu đổi là một lần
trộn tay. Thứ của repo có chỗ riêng: lớp vẽ code ở `src/lop.tsx`, bộ phận vẽ bằng code ở
`src/parts.tsx`, context cho lớp vẽ code cần dữ liệu của app Remotion ở `src/scene-wrap.tsx`
(`<SceneWrap rt t>` bọc `<SceneWorld>` trong `Scene.tsx`), phòng 3D và cảnh 3D ở `src/khoi3d/canh.ts`
(phòng riêng là hàm trả `Set3D`, để ở file mới cạnh nó), tool riêng ở file mới trong
`tools/`. Máy có `/tmp` là tmpfs thì khai `"stickman": { "tmpdir": "~/.cache/remotion-tmp" }`
trong `package.json`: `tools/webpack.mjs` đưa thư mục tạm của mọi lượt bundle ra đó. Sửa
được việc chung (lỗi, tuỳ chọn mới của tool) thì đưa về `packages/cli/scaffold` của studio.
Rig mới đổi độ dài chân thì `upgrade` chỉ nhắc, cảnh dời bằng một lệnh riêng —
[Đổi độ dài chân](#đổi-độ-dài-chân).

**Hướng dẫn dùng rig ở `stickman.md`, luật riêng của tập ở `AGENTS.md`.** Hai
chủ khác nhau: `upgrade` sinh lại file trước theo version đang cài, file sau thì
không bao giờ đụng — nên mọi quy ước của tập viết vào `AGENTS.md` mới còn. Repo
dựng từ bản cũ có `AGENTS.md` do studio phát: lượt `upgrade` đầu thay nó bằng
bản seed nếu chưa ai sửa, sửa rồi thì giữ nguyên và nhắc xoá phần trùng.

Nó phân biệt được **file cũ** với **file mình sửa tay**: `init` và mỗi lần
`upgrade` ghi băm của từng file đã phát vào `stickman.json` (`files`). Băm trên
đĩa còn khớp thì file chưa ai đụng, đè im lặng; lệch thì hỏi:

| | |
|---|---|
| `đ` | đè bản mới lên |
| `b` | bỏ qua, giữ nguyên bản sửa tay |
| `q` | dừng — **chưa file nào bị ghi**, vì kế hoạch lập xong mới ghi |

Không có bàn phím (agent, CI) thì phải khai sẵn: `--yes` đè hết,
`--skip-modified` giữ hết, `--dry-run` chỉ in. MCP có tool `upgrade` với
`modified: "bỏ qua" | "đè" | "dừng"`.

File mình chọn bỏ qua thì `stickman.json` ghi băm của **bản mẫu vừa chào**, không
phải băm bản đang sửa — ghi băm bản đang sửa là lần `upgrade` sau tưởng nó
nguyên vẹn và đè mất. Nhờ vậy mỗi bản mẫu chỉ hỏi **một lần**: mẫu chưa đổi thì
lần sau bỏ qua im lặng, mẫu đổi thật mới hỏi lại.

## Đổi độ dài chân

Người 2D treo ở bàn chân thấp nhất: `y` là đường đất, hông cao hơn nó đúng chiều cao chân
của tư thế. Rig đổi `thigh` / `shin` thì người đứng vẫn trên đất mà cao lên, còn người ngồi
ghế vẽ tay thì hông nhô khỏi mặt ghế. `stickman.json` ghi chân mà cảnh của repo dựng cho
(`legs`; trống là đùi `82` / cẳng `78`). Lệch với rig đang cài thì `upgrade` nhắc,
và một lệnh đặt lại:

```bash
pnpm exec stickman reseat --dry-run     # ai dời, bao nhiêu, clip đi nào giãn nhịp
pnpm exec stickman reseat
```

`reseat` lấy mẫu từng người 2D ở mọi cảnh không khớp `stickman.frozen`, mỗi `1/60` giây
cộng mốc có tên và hai đầu từng đoạn hoà:

| Khung | Giữ |
|---|---|
| Ngồi: kênh chân đến từ hành động tên `sit` hay `sit-…`, hay từ `base: "sit"` | Tâm hông ở đúng chỗ của chân cũ |
| Người xoay (`rotate`): nằm, ngả | Tâm hông — dời cả `x` |
| Còn lại | Bàn chân trên đất, không dời |

**Tên là thứ duy nhất tách ngồi ghế khỏi ngồi xổm hay quỳ** — hình chân của chúng giống nhau,
mà một bên giữ hông, một bên giữ chân. Hành động ngồi ghế đặt tên `sit` hay `sit-…`.

Độ dời một khung là bàn chân thấp nhất của tư thế đang có trên chân mới trừ của tư thế đời
trước trên chân cũ, nhân `scale`, quay theo `rotate` (`feet` và `hipHoldShift` của rig). Tư
thế đời trước dựng lại từ chính cảnh với bảng hành động đời trước: hành động chung chỉnh lại
cùng đợt đổi chân (`sit`, `sit-rear` — bảng `LEG_ERAS` trong `lib.mjs`, mỗi đời chân một dòng)
lấy lại kênh chân cũ;
hành động của repo lấy bản trên đĩa, hay bản ở commit `--before <ref>` khi repo đã chỉnh hành
động ngồi của mình cho chân mới trước khi chạy. `actions/` có file sửa mà chưa commit thì
`reseat` nhắc đúng chuyện ấy. Không cần cài rig cũ: chỉ cần hai bộ độ dài chân.

Ghi gì:

- **Độ dời không đổi suốt cảnh** — người ngồi cả cảnh, người nằm: sửa `y` (và `x`), mốc
  `path` có ghi `y` / `x`, và đạo cụ `follow` người ấy để nó giữ chỗ trên sân khấu. Thành
  viên nhóm thì quy về đơn vị của nhóm.
- **Vừa đứng vừa ngồi**, hay đổi hành động ngồi giữa cảnh: `y` không đổi theo thời gian được,
  nên ghi một `path` lấy mẫu chính chỗ đứng — cả trôi ngang tự suy, vì có `path` là tắt nó —
  cộng độ dời từng khung, nội suy thẳng lệch không quá `0,25` px. Lúc hoà giữa ngồi và đứng,
  độ dời đi một mạch từ độ dời của khung ngồi gần nhất về `0`. Người đi tới rồi ngồi thì
  `path` dài, mỗi chỗ trôi ngang cong một mốc.
- **Đã có `path` mà vừa đứng vừa ngồi**: không viết lại `path` soạn tay. Ngồi từ nửa cảnh trở lên
  thì dời theo khung ngồi (khung đứng chân lún dưới đất), không thì giữ chân (khung ngồi
  hông lệch) — và liệt kê ở dòng `soi tay`.
- **Chân co nhiều mà không phải hành động ngồi** (quỳ, ngồi xổm, `base` tự khai): giữ chân,
  liệt kê ở `soi tay`. Là ngồi ghế thì đặt lại `y` bằng tay.
- **Người đi trôi ngang tự suy** (không `path`, clip có sải chân, khai `cycle` hay để mặc định):
  sải chân đổi theo chân mới, nên `cycle` của clip giãn đúng tỉ lệ sải mới / sải cũ — người đi
  bao xa trong bao lâu vẫn như đời trước. Hết mỗi lượt về đúng chỗ; giữa một bước lệch tới ~8%
  sải chân vì nhịp chân trụ đổi dáng. Clip khai `speed` không đụng: rig tự suy nhịp từ sải mới.
  Tư thế đời trước dựng trên cảnh đã giãn nhịp, nên người đi tới rồi ngồi hoà đúng pha.

Không đụng: cảnh khớp `stickman.frozen`, người 3D (`world`), người `mount` hay `sit` (hông
đặt vào yên, vào chỗ ngồi của đạo cụ). Sửa đúng các con số trong JSON thô, cách trình bày
của file giữ nguyên. Ghi xong thì `stickman.json` nhận `legs` mới, nên chạy lại không dời
thêm; có cảnh không nạp được thì không ghi gì cả. `init` ghi sẵn `legs` của rig đang cài.

## Studio đọc repo video

`@stickman3d/cli` gói cả app studio đã build, nên repo video mở studio tại chỗ:

```bash
pnpm exec stickman studio               # = pnpm studio, --port đổi cổng
```

Đó là một static server: phục vụ app, và đè `characters/` `actions/` `props/`
`animals/` `pieces/` của workspace lên đường dẫn bộ mẫu (`index.json` sinh lúc chạy,
`/workspace.json` cho nhãn; `characters/`, `actions/`, `animals/` và `pieces/` gộp với lớp chung,

`catalog.json` gộp) — mở lên là thấy nhân vật của repo này, **chỉ đọc**. Ghi vẫn
đi qua **Mở thư mục** (File System Access API, chỉ có ở `localhost`) trỏ vào
chính thư mục ấy: studio ghi JSON thẳng vào `characters/` và `actions/`, bản cũ
giữ ở `<file>.json.bak`. Không có endpoint ghi nào phía server, đúng bất biến
của studio. Studio đi cùng cli nên nó luôn khớp bản rig đã pin.

Muốn đổi hành vi rig thì đổi ở repo studio rồi publish và `upgrade` bên này,
đừng vá `node_modules/@stickman3d/`.

## Phạm vi tài liệu

| | Ở đâu |
|---|---|
| Kịch bản, bảng shot, nhân vật, cảnh, số đo của **tập này** | Repo video, và ở lại đó |
| Bẫy kỹ thuật, quy ước, con số đo được đúng cho **mọi tập** | Repo studio — `docs/01..07`, đọc bằng `stickman docs` |

Không ghi lịch sử sản xuất hoặc nội dung riêng của tập vào bộ spec chung.

## Quy trình dựng một tập

Ở [07 — Làm một tập](07-lam-tap.md): thứ tự các bước và cổng của từng bước, luật
**bước 1 không được quyền sửa rig**, bốn tầng xem, bảng thời gian cả tập, lời dẫn,
phụ đề, tiếng động, và cấu hình render bản upload.
