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
`episodes/`. **Mảnh ảnh, hành động, động vật, món cầm tay, dáng tay và nhân vật thì không chép** — chúng
là lớp chung nằm trong package, xem [Hai lớp](#hai-lớp); `pieces/` chỉ có một
`catalog.json` trống, `actions/`, `animals/`, `held/`, `hands/` và `characters/` trống.


Sinh mới: `stickman.md` — cách dùng rig cho agent, `AGENTS.md` trỏ vào đó và để
trống chỗ ghi luật riêng của tập, `CLAUDE.md` một dòng trỏ vào `AGENTS.md`, `README.md`,
`.gitignore`, `.npmrc` trỏ scope `@stickman3d` sang registry GitLab, `.mcp.json`
khai sẵn server, và `package.json` pin **đúng số version**, không `^`.

Cùng với đó là **app Remotion**: `src/` (`index.ts`, `Root.tsx`, `Scene.tsx`,
`data.ts`, `images.ts`, tầng tập `episode.ts` / `shots.ts` / `Episode.tsx`, và
`Thumbnail.tsx`; cảnh 3D ở `khoi3d/` — `Scene3D.tsx` sân khấu three (`buildStage` của rig, người diễn mặc đồ theo
`equip` — [03](03-scene.md#cảnh-3d)), `world.ts` cùng cảnh three ấy cho `check` ([Cảnh three cho
`check`](#cảnh-three-cho-check)), `Overlay3D.tsx` lớp chữ 2D đè lên, `set.ts` đường import kiểu bối cảnh `Set3D` và
phòng trơn `plainRoom` của rig, `ChanDung.tsx` chân dung người 3D cho lớp 2D; cùng bốn file của repo `lop.tsx`,
`parts.tsx`, `scene-wrap.tsx`, `khoi3d/canh.ts`), `tools/` (`still.mjs`, `can-tay.mjs` và `bang-cam.mjs` cùng `soi.mjs`, `soi.tsx`, `thumbnails.mjs`, `srt.mjs`, `tts.py`,
`tts-blocks.py` cùng `len-giong.py`, `lipsync.mjs` cùng `words.py`, `sfx.py`, `sfx-el.py`,
`sfx-loop.py`, `cut-torso.py`, `webpack.mjs` cùng `scope.mjs` — [07](07-lam-tap.md#công-cụ-trong-tools)),
`remotion.config.ts`, `tsconfig.json`, `pnpm-workspace.yaml`, và `package.json` có sẵn
`pnpm remotion` / `render` / `still` / `frames` / `can-tay` / `bang-cam` / `thumbnails` / `srt` / `tts` /
`tts-blocks` / `lipsync` / `sfx` / `sfx-el` / `sfx-loop` / `cut-torso` (`pnpm studio` là
Studio 3D, `pnpm studio2d` là character studio 2D) và `stickman.world` trỏ `src/khoi3d/world.ts`. Bảng riêng của tập cho các tool ấy — `sfx/*.json`, bản lời có tag —
không có mẫu nào: tool đọc thấy thiếu thì báo cú pháp. `package.json` pin cả `three`; `scenes/vi-du-3d.json`
là cảnh 3D mẫu, `khoi3d/canh.ts` nối tên nó với `plainRoom` (`CANH_3D`: tên cảnh → `WorldSpec`) — `Scene.tsx` gặp
cảnh có trong `CANH_3D` thì vẽ người 3D thay người que 2D (`REMOTION_FLAT=1` vẽ bản 2D để so); `THU_3D` cùng file là composition thử bối cảnh
(người, ống kính, khung cắt mượn của một cảnh), nằm trong thư mục `khoi3d` của Studio. Cảnh 3D nặng thì `pnpm remotion-prod`
chạy Studio bằng React production, mất fast refresh. Render cảnh 3D cần GPU qua Vulkan:
`remotion.config.ts`, `tools/soi.mjs` và `tools/thumbnails.mjs` đặt sẵn `gl: "vulkan"`. Mỗi file trong `scenes/` là một composition, mỗi file trong
`episodes/` cũng vậy, nhưng mỗi bundle chỉ mang phạm vi của lượt chạy — id gõ trên dòng lệnh, hay
`stickman.scope` cho Studio ([03](03-scene.md#phạm-vi-bundle)); chi tiết và các bẫy ở [03](03-scene.md#remotion) và
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

Lệnh nào của `stickman` cũng nhận `--help` / `-h`: in cách dùng và cờ của lệnh ấy rồi thoát, không chạy gì. Cờ lệnh không
nhận hay cờ thiếu giá trị thì báo lỗi kèm danh sách cờ của lệnh, thoát mã `1`, cũng không chạy.

### Soi một cảnh

Soi cả workspace phải dựng runtime và đo người 3D với đồ khối cho mọi cảnh, nên repo nhiều
tập mất cả phút. Sửa xong một cảnh thì chỉ soi cảnh ấy:

```bash
pnpm exec stickman check --scene t03-s01-cd-haru   # regex trên id cảnh: ^t03-s01 lấy cả nhóm
pnpm exec stickman check --uses ngoi-nga-3d        # mọi cảnh dùng hành động ấy
```

MCP: `check({ scene, uses })`. Cảnh khớp được soi đủ như lượt toàn bộ (tham chiếu, trượt chân, thân
quay gắt, hành động 2D trên người 3D, người lồng vào đồ, giật trên hình…); cảnh không khớp chỉ được parse cho tham chiếu chéo.
In cảnh báo của cảnh khớp và **mọi lỗi** ở bất kỳ đâu; tập, tiếng, `retime`, file chưa commit, công cụ ngoài thì bỏ qua — chúng chỉ có ở lượt toàn bộ, chạy ở cuối
tập hay sau khi nâng rig. Regex không khớp cảnh nào là lỗi.

`--uses <tên,…>` chọn cảnh mà JSON dùng một trong các tên: hành động (`clips[].action` của người và động vật), nhân vật
(`cast[].character`), đạo cụ (`props[].prop`), động vật (`animals[].animal`); tên viết có hay không đuôi `.json` đều được.
Đi chung `--scene` thì lấy cảnh khớp cả hai. Tên không có trong `actions/`, `characters/`, `props/`, `animals/` (kể cả bộ
chung) là lỗi, không cảnh nào dùng cũng là lỗi. Cảnh báo của chính file hành động có tên trong `--uses` (công tắc `equip`,
khuỷu gập ngược, mốc ngoài `mask`…) cũng in. Bối cảnh, đồ khối và đồ cầm repo dựng bằng code trong `src/` không nằm trong
JSON cảnh nên `--uses` không tra được: cảnh dùng chúng thì chọn bằng `--scene`.

Nhiều cảnh (regex khớp cả nhóm, hay lượt toàn bộ) thì phần đo sâu từng cảnh — người lồng vào đồ, tay,
lòng tay, giật trên hình — chia cho nhiều luồng: mặc định nửa số nhân, không quá số GB RAM còn trống;
`--jobs <số>` đặt tay. Một cảnh thì chạy một luồng.

### Nhóm luật

Luật của `check` chia sáu nhóm theo thứ chúng cần dựng. `--only <nhóm,…>` chỉ chạy các nhóm ấy, `--skip <nhóm,…>` bỏ
chúng; không cờ nào là đủ sáu nhóm. Tên sai là lỗi kèm danh sách nhóm. `--held` là tên tắt của `--only held`. MCP:
`check({ only, skip })`. Nhóm không chạy thì thứ chỉ nó cần không dựng — không gói module cảnh three, không dựng cảnh
three của từng cảnh, không lấy mẫu khối người, không mở luồng phụ — nên lượt hẹp nhanh thật chứ không chỉ in ít dòng hơn.

| Nhóm | Luật | Cần dựng |
|---|---|---|
| `ref` | tham chiếu chéo (nhân vật, hành động, đạo cụ, động vật, nền, `fx`, `equip`), version pin, file giống bộ chung, bộ đồ của nhân vật; công tắc `equip` một chiều, hai track cùng ghi một socket, khuỷu gập ngược khi giơ tay, mốc ngoài `mask`, hành động tự giật, mốc khai không ai neo, người 3D diễn hành động 2D; tay cầm hai tay (`both`) trong khi tay kia cầm món khác; lớp vẽ code bật cho cảnh không có, thư mục sidebar | JSON, runtime, gói lớp vẽ code |
| `move` | người 3D trượt, không tới mốc dừng, thân quay gắt; tay chân giật trên hình | runtime, khớp người theo thời gian |
| `held` | đồ cầm tay sai: ngón xuyên, món hở, tâm nắm xa, ý định không đạt, tay phụ hay `item:` không tới, món nhảy qua mốc `hold`, cầm món không ai `provide`; chỗ cầm nhóm (`món@nhóm`) thêm da lún, ngón vai trò hở, cổ tay vượt kẹp hay sát kẹp, tay lấn thân, món to so với tay; đường cũ thêm dáng khác dáng khai, món trôi | runtime, cảnh three |
| `legacy` | đồ cầm còn đi đường cũ (`hold` gọi tay không có chỗ cầm nhóm), một dòng mỗi cảnh | runtime, cảnh three |
| `clash` | người lồng vào đồ, vào người khác, tay xuyên thân, đồ lồng vào đồ, `touch` lạ | runtime, cảnh three, lớp vẽ code, mẫu khối người mỗi `0,25 s` |
| `episode` | tham chiếu của tập, tiếng dài hơn chỗ nó nằm, bè lặp kêu khi sân khấu đứng yên, số cũ phải `retime`, file chưa commit, công cụ ngoài, `sfx/` đọc không được | tập, tiếng (`ffprobe`), git — chỉ ở lượt toàn bộ, không có khi `--scene` hay `--uses` |

Nhóm nào cũng báo JSON hỏng theo zod, lỗi của `resolveScene` (mốc không có, ai cưỡi, ai xách) và ngưỡng hỏng trong
`package.json` của nhóm đang chạy: không parse được thì không đo được gì. Runtime (`resolveScene`) dựng cho mọi nhóm vì
chính nó là phép kiểm tham chiếu chéo của `ref`, và nó rẻ so với các phép đo. **Tay xuyên thân nằm ở `clash`** dù là
luật của tay: nó đo chung một lượt với người lồng vào đồ (`sceneClashes` trên khối người, giây lấy mẫu chia nhỏ theo vật
của cảnh three dời), ngưỡng ở `stickman.clash.self`. Dáng bàn tay (khuỷu, lòng tay, hướng ngón) `check` không đo — soi và sửa ở Studio 3D. Cảnh three dựng một lần cho mọi nhóm cần nó; dựng hỏng thì dòng báo mang nhóm đầu tiên trong
`clash`, `held`, `legacy` đang chạy. `held/<món>.json` và `hands/<tên>.json` hỏng là lỗi zod như mọi JSON; tên
dáng tay ngoài `[a-z0-9-]` hay trùng dáng có sẵn của rig cũng là lỗi, và dáng ấy không vào thư viện. Món, mốc, dáng tay
mà scene trỏ tới không có, chỗ cầm không hợp lệ là lỗi `resolveScene`. `legacy` chạy cùng `held` thì đọc chung các tư thế đã đặt, chạy riêng thì
chỉ đặt cảnh mỗi `0,1 s` mà không đo.

Sửa gì chạy nhóm nào:

| Sửa | Chạy |
|---|---|
| Chỗ đứng, đường đi (`world.at`, `path`) | `move,clash` |
| Tay (`world.hands`, `reach`, dáng tay, `hands/<tên>.json`) | `move,clash` (+`held` nếu tay đang cầm) |
| Đồ cầm trong cảnh (`world.hands[].hold`, ý định, `point: item:`), `cast.provide` | `held,clash` |
| Món cầm tay: mốc, hình va chạm, phần (`held/<món>.json`) | `ref,held,clash` trên mọi cảnh có món ấy (`--scene`); repo tự kiểm hình khớp lưới |
| Thời gian, retime, audio | `move` + lượt toàn bộ cho `episode` |
| Bối cảnh, đồ khối | `clash` |
| Hành động chung | `--uses <tên> --only ref,move,held` |
| Cuối lô | đủ nhóm trên các cảnh của lô, `--baseline` |
| Cuối tập, nâng rig | đủ, toàn workspace (`--baseline` nếu có) |

Sửa một cảnh thì chỉ chạy nhóm theo bảng; cả workspace chậm, chỉ chạy ở cuối tập hay sau khi nâng rig. Cảnh còn đi
đường cũ thì thêm `--skip legacy`.

```bash
pnpm exec stickman check --scene '^t01-s04[0-5]' --only move,clash
pnpm exec stickman check --uses ngoi-nga-3d --only ref,move,held
```

`--time` in thời gian từng nhóm và từng phần dựng chung — nạp workspace, dựng runtime, gói lớp vẽ code, gói module
cảnh three, nạp luồng phụ, dựng cảnh three — cộng dồn trên mọi cảnh và mọi luồng (nên tổng lớn hơn thời gian đồng hồ
khi chạy nhiều luồng), kèm thời gian đồng hồ của cả lượt. MCP luôn trả `time` (ms từng phần) và `wall`.

### Baseline

`--save-baseline <file>` ghi cảnh báo của lượt này ra JSON. `--baseline <file>` so lượt này với file ấy và chỉ in cảnh
báo **mới** hay **nặng hơn**, cùng mọi lỗi; mục **đã hết** in thành dòng `đã hết:`, dòng cuối thêm
`N mới, M nặng hơn, K đã hết`. Hai cờ đi chung được: so với bản cũ rồi ghi bản mới. Chưa có file thì mọi cảnh báo là
mới. Đường dẫn tính từ thư mục workspace. MCP: `check({ baseline, saveBaseline })`, cảnh báo mang `delta` (`"mới"`,
`"nặng hơn"` kèm `was` / `now`).

So theo khoá ổn định, không theo giây: cảnh, luật, rồi người, tay, món hay cặp va chạm — người lồng vào đồ khoá theo cặp
phần người ↔ vật, tay và lòng tay theo luật, người, tay, vật dưới tay hay mốc, đồ cầm theo luật, người, tay, món, giật
trên hình theo người và khớp. Luật chỉ có dòng chữ (trượt, thân quay, tham chiếu, tiếng) khoá bằng chính dòng ấy, bỏ
phần clip đang chạy, số đứng riêng thay bằng `#`. Nhiều dòng cùng khoá gộp một mục: `count` dòng, `measure` là số đo
lớn nhất.

**Nặng hơn** khi thêm dòng cùng khoá, hay số đo chính (độ lấn, góc, khe, px nhảy, độ lún, quãng trượt, độ cụt) gấp từ
`1,25` lần bản cũ **và** hơn từ `1` đơn vị của số đo ấy — dưới ngưỡng ấy là dao động do sửa cảnh khác, không phải lỗi
mới. **Đã hết** chỉ tính trong phạm vi lượt chạy: mục của cảnh đã soi và nhóm đã chạy; mục không gắn cảnh (file hành
động, lớp vẽ code, tập, git) chỉ ở lượt toàn bộ. Lỗi không vào baseline: lỗi là thứ chặn, không phải nợ để dành.

Ghi thì gộp: mục trong phạm vi lượt chạy thay bằng mục của lượt này, mục ngoài phạm vi (cảnh không soi, nhóm không chạy)
giữ nguyên — soi từng phần vẫn giữ baseline đủ. Xếp theo cảnh (mục không gắn cảnh trước), nhóm, khoá; chạy lại mà không
gì đổi thì file không đổi:

```json
{
  "stickman": "check-baseline",
  "rig": "7.7.3",
  "warnings": [
    {
      "scene": "t01-s009-saito",
      "group": "held",
      "key": "scenes/t01-s009-saito.json|held:pierce|doan-02|R|dien-thoai-tay",
      "count": 1,
      "measure": 1.53,
      "msg": "scenes/t01-s009-saito.json: ngón xuyên đồ — `doan-02` tay phải cầm dien-thoai-tay: trục đầu ngón cái vào trong món 1.5 (da lún 4.8); …"
    }
  ]
}
```

### Những thứ `check` soi mà không lệnh nào khác soi

Các kiểm tra sau bắt lỗi hợp lệ theo schema nhưng làm thiếu hình hoặc tiếng:

| | Nhóm | Bắt bằng gì |
|---|---|---|
| **Tiếng dài hơn chỗ nó nằm** | `episode` | Đo file bằng `ffprobe` rồi so với độ dài shot (`warpTable` của rig, cùng hàm mà `layoutShots` dùng, nên hai bên không lệch). Quá `0,05 s` mới kêu. Không có `ffprobe` thì bỏ qua, không kêu oan |
| **File có trên đĩa mà chưa commit** | `episode` | `git ls-files`; file không được theo dõi sẽ thiếu sau khi clone. File `.gitignore` loại (audio gen ra, render) là cố ý để ngoài git, không kêu |
| **Công tắc `equip` một chiều** | `ref` | `equipSwitchProblems` của rig: socket bật tắt mà trạng thái không đổi frame nào — [03](03-scene.md#bốn-bẫy-của-equip) |
| **Hai track cùng ghi một socket** | `ref` | `sceneEquipProblems` của rig: track sau đè track trước, nên cái gỡ mũ ở track trước bị track sau cầm đồ đè lại |
| **Khuỷu gập ngược khi giơ tay** | `ref` | `armFoldProblems` của rig: mốc có `\|vai\| > 120` mà khuỷu ngược dấu vai — cẳng tay bung ra ngoài thay vì cuộn về đầu — [00](00-bat-bien.md#dấu-góc-và-hình-học) |
| **Mốc ghi kênh ngoài `mask`** | `ref` | `maskProblems` của rig: giá trị bị bỏ im lặng — nụ cười khai ở `face` mà `mask` thiếu `face` thì không bao giờ hiện |
| **Người 3D trượt, không tới mốc dừng** | `move` | `sceneSlideProblems` đo trên mặt sàn thế giới cho người có `world`: bàn chân chịu lực dịch quá nửa quãng hông đi trong `0,4 s`, mốc dừng của `path` mà hông cách quá `20` đơn vị rig, clip có sải chân chạy khi `path` đã đứng yên — [03](03-scene.md#check-cho-người-3d) |
| **Người 3D lồng vào đồ** | `clash` | `sceneClashProblems` của cli: phần người lấn quá `2` đơn vị thế giới (`stickman.clash.tol`) vào khối đồ của lớp vẽ code (`solidClashes` của fx) hay vào người khác. Repo khai [`stickman.world`](#cảnh-three-cho-check) thì phần người đo với mọi vật của chính cảnh three ấy bằng `collide` của rig, thay cho khối đồ của lớp vẽ code. Mỗi cặp một dòng kèm giây sâu nhất và các quãng giây; món hay vật khai `touch` thì bỏ phần người ấy — [10](10-lop-ve-code.md#người-lồng-vào-đồ) |
| **Tay xuyên thân** | `clash` | `sceneClashProblems` của cli (`armPierce` của lõi, tay và thân đúng như three vẽ): cánh tay, cẳng tay (bỏ quãng sát vai và sát cổ tay) lấn vào thân áo của chính người ấy quá `4` (`stickman.clash.self`, `false` là tắt) — [10](10-lop-ve-code.md#tay-xuyên-thân) |
| **Đồ lồng vào đồ** | `clash` | `sceneItemClashProblems` của cli (`solidItemClashes` của fx): hai món của lớp vẽ code lấn nhau quá `stickman.clash.tol` **và** phần thể tích món nhỏ nằm trong món kia quá `0,1` (`stickman.clash.items`, `false` là tắt), mỗi cặp một dòng; món khai tên món kia trong `touch` thì bỏ — [10](10-lop-ve-code.md#đồ-lồng-vào-đồ) |
| **Người 3D diễn hành động 2D** | `ref` | `sceneSideProblems` của rig, **mức lỗi**: người có `world` mà clip ghi kênh tay chân của hành động không soạn ở `side` — sân khấu three vẽ kênh ấy ở dáng nghỉ, hoà với hành động `side` là giật một khung. Mỗi người, mỗi clip một dòng kèm bản `-3d` có sẵn — [03](03-scene.md#hành-động-cho-người-3d) |
| **Đồ cầm tay sai** | `held` | `sceneHeld` của rig trên cảnh three [`stickman.world`](#cảnh-three-cho-check) (`heldFrame`, `heldItemsFrame` của cli, `heldHands` của người 3D): trục ngón vào trong món quá `1,25`, món không chạm tay, tâm nắm ngoài món quá `3`, ý định không đạt (tay dẫn: `AimReport.hold` kèm khớp kẹp; đường cũ: `userData.hold`), tay phụ hay `item:` không tới, món nhảy qua mốc gắn / thả / đổi tay, món khai `hold` mà cảnh không `provide`; chỗ cầm nhóm đi bộ luật riêng ([11](11-nhom-cam.md#7-luật-check-nhóm-held)): `sink` (da lún), `rest` (da dưới mặt đỡ ở mốc món nằm), `role`, `oppose` (không có lực đối), `grip` theo nhóm, và với món đặt trước `reach` (ngoài tầm — lỗi), `wrist` (vượt kẹp — lỗi, sát kẹp — cảnh báo), `arm`, `size`, cả hai đường `elbow` (khuỷu gập ngược vào trong hay chĩa lên — lỗi) và tay lấn đầu (lỗi); món treo (`món@carry`, `heldCarries`) quai rời chỗ treo hay khuỷu không gập giữ quai, thân món lồng vào người; đường cũ thêm dáng `hold` khác dáng khai, món trôi trong khung bàn tay; kéo dài từ `0,3 s` (`stickman.held`: `pierce`, `touch`, `wrap`, `grip`, `up`, `face`, `drift`, `turn`, `reach`, `sink`, `wrist`, `arm`, `elbow`, `oppose`, `rest`, `seat`, `body`, `hold` — số dương, thiếu thì lấy mặc định của rig; `grip` khai thì thắng ngưỡng theo nhóm; `false` là tắt) — [03](03-scene.md#đồ-cầm-tay) |
| **Đồ cầm còn đi đường cũ** | `legacy` | `legacyHolds` của người 3D: lần cầm qua `hold` gọi tay không có chỗ cầm nhóm, một dòng mỗi cảnh — [01](01-rig.md#món-cầm-tay) |
| **Tay chân giật trên hình** | `move` | `sceneSnapProblems` của rig: lấy mẫu theo fps bản chốt, khớp đúng như hình vẽ ra (`actJoints` cho người 3D, `joints2` cho người 2D) qua khung cắt camera, khung nào một khớp nhảy vượt nền chuyển động quanh nó quá ngưỡng (`stickman.snap`) thì kêu, kèm lý do đọc từ timeline; chỗ khai `snap` thì bỏ — [03](03-scene.md#giật-trên-hình) |
| **Hành động tự giật** | `ref` | `actionSnapProblems` của rig: `wrap` mà mốc cuối ở `t: 1` lệch mốc đầu, hay hai mốc sát nhau đổi góc lớn hơn hẳn hai đoạn kề; file khai `snap` thì bỏ — [01](01-rig.md#hành-động-giật-có-chủ-ý) |
| **Mốc khai mà không ai neo** | `ref` | Chỉ khi khai `stickman.marks.unused: "warn"`: mốc trong `marks` không chỗ nào trong JSON viết `"@tên"`. Mặc định tắt, vì lớp vẽ code đọc mốc qua `ctx.marks` mà `check` không thấy — [03](03-scene.md#mốc-có-tên) |

### Cảnh three cho `check`

Đồ repo dựng thẳng bằng three (đồ cầm tay, đồ bám cổ tay, đồ chạy theo `t`) không nằm trong
`solids(ctx)` của lớp vẽ code, nên `check` chỉ đo được người lồng vào chúng khi repo đưa cảnh three
cho nó. Khai module dựng cảnh trong `package.json`:

```json
"stickman": { "layers": "src/lop.tsx", "parts": "src/parts.tsx", "world": "src/khoi3d/world.ts" }
```

Module xuất `worldOf(sceneName, ctx)`: cảnh có bối cảnh three thì trả `{ root, pose(t) }`, cảnh khác
trả `null` và đi đường khối lớp vẽ code. `init` khai sẵn `stickman.world` và phát `src/khoi3d/world.ts`: nó tra
`CANH_3D` rồi trả `buildWorld` của rig ([03](03-scene.md#cảnh-3d)) — đúng cảnh three mà `Scene3D` vẽ, vì `World3D` có
sẵn `root` và `pose(t)`.

```ts
import { buildWorld, type WorldCtx } from "@stickman3d/rig";
import { CANH_3D } from "./canh";

export function worldOf(sceneName: string, ctx: WorldCtx) {
  const spec = CANH_3D[sceneName];
  return spec ? buildWorld(ctx.scene, ctx.runtime, spec, ctx) : null;
}
```

`worldOf` chạy trong Node, không trình duyệt, không webpack: code dựng bối cảnh và đồ riêng của repo không được đụng
`document` (canvas đi qua `newCanvas` / `canvasTexture` của rig). Hợp đồng đủ — trường của `ctx`, cách gói, vật nào tự
bỏ khi đo, `noCollide`, `touch` trên vật three — ở [10](10-lop-ve-code.md#đo-trên-cảnh-three).

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

`pieces/`, `actions/`, `animals/`, `held/`, `hands/` và `characters/` của repo video là **lớp
trên**; **lớp dưới** là bộ chung đi theo studio — mọi sheet đã cắt, `catalog.json`
của chúng, các hành động mẫu (`walk`, `idle`, `wave`, …), bảy con vật mẫu
([08](08-dong-vat.md#bộ-mẫu)), món cầm tay mẫu `coc`, `tui` ([01](01-rig.md#món-cầm-tay)), dáng tay mẫu `peace` (chữ V,
[01](01-rig.md#dáng-tay-có-tên)) và các nhân vật mẫu, trong đó có nhân vật tác giả
`author.json` dùng ở mọi tập.
Lớp dưới **không nằm trong repo video**: nó là

`template/` trong package `@stickman3d/cli` (chạy từ cây nguồn thì là
`apps/studio/public`), hằng `COMMON` trong `lib.mjs`. Đọc thì tìm lớp trên
trước, không có mới xuống lớp dưới; file **trùng đường dẫn** thì lớp trên đè. Món của `held/` ở cả hai lớp là món nhóm cầm
(`schemaVersion: 3`, [11](11-nhom-cam.md)).
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
`serve.mjs` khi chạy `stickman studio2d`), `stickman-render` / `stickman-video` và
MCP (`layers` + `findIn`), và app Remotion (`remotion.config.ts` trỏ alias
`@stickman-common` vào `COMMON`, `data.ts` `require.context` cả hai, `tools/srt.mjs`
đọc cùng hai thư mục). Thêm đường đọc mới thì cũng phải đi hai lớp. Món cầm tay đến `resolveScene` ở **tham số thứ
bảy** (`held`, bảng món theo tên không đuôi): `data.ts` xuất `HELD`, `Scene.tsx`, `Episode.tsx`, `Scene3D.tsx` truyền nó;
file `src/` sửa tay mà gọi `resolveScene` thì cũng phải truyền `HELD`, thiếu là cảnh có `hold` ném lỗi "không có món".
Dáng tay có tên (`hands/<tên>.json`, khoá là tên file không đuôi) đến `resolveScene` ở **tham số thứ tám** (`hands`):
`data.ts` xuất `HANDS`, `Scene.tsx`, `Episode.tsx`, `Scene3D.tsx` truyền nó; file `src/` sửa tay mà gọi `resolveScene` thì
cũng phải truyền `HANDS`, thiếu là cảnh có `world.hands[].pose` gọi dáng của thư viện ném lỗi "không có dáng tay". Cảnh, đạo
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

**`characters/`, `actions/`, `scenes/`, `episodes/`, `props/`, `animals/`, `held/`, `hands/`, `pieces/`, `sfx/` không bao giờ bị đụng** — đó
là nội dung của tập phim. Mảnh, hành động, con vật và nhân vật chung mới thì tự có
theo package (xem [Hai lớp](#hai-lớp)), không cần chép; spec rig cũng vậy.
`AGENTS.md` / `README.md` / `CLAUDE.md` / `.gitignore` và `src/lop.tsx` / `src/parts.tsx` /
`src/scene-wrap.tsx` / `src/khoi3d/canh.ts` cũng không: `init` phát chúng một lần làm nền, từ đó là
của repo video (`SEED_ONLY` trong `lib.mjs`), `stickman.json` không giữ băm của chúng. Thiếu thì
`upgrade` dựng lại bản mẫu — app Remotion `import` cả bốn. Thư mục app Remotion `require.context` vào (`held/`, `hands/`,
…) thiếu thì `upgrade` dựng rỗng kèm `.gitkeep`.

**Đừng sửa file app Remotion và tool do studio phát.** Sửa rồi thì mỗi lần mẫu đổi là một lần
trộn tay. Thứ của repo có chỗ riêng: lớp vẽ code ở `src/lop.tsx`, bộ phận vẽ bằng code ở
`src/parts.tsx`, context cho lớp vẽ code cần dữ liệu của app Remotion ở `src/scene-wrap.tsx`
(`<SceneWrap rt t>` bọc `<SceneWorld>` trong `Scene.tsx`), cảnh 3D ở `src/khoi3d/canh.ts` (`CANH_3D`: bối
cảnh, người nền, đồ riêng của cảnh, đồ gắn lên người, ống kính và hậu kỳ theo giây — `WorldSpec`; phòng riêng là hàm
trả `Set3D`, để ở file mới cạnh nó), tool riêng ở file mới trong `tools/`. Việc chung của cảnh 3D — dựng người, đổi
đồ theo `equip`, người nền, đèn, nạp phông, sân khấu — nằm ở `buildWorld` / `buildStage` của rig nên theo version
rig mà đến; thiếu tuỳ chọn thì thêm ở studio, đừng sửa `Scene3D.tsx` hay `world.ts`. Thư mục tạm của tool Remotion:
[Thư mục tạm](#thư-mục-tạm). Sửa
được việc chung (lỗi, tuỳ chọn mới của tool) thì đưa về `packages/cli/scaffold` của studio.
Rig mới đổi độ dài chân thì `upgrade` chỉ nhắc, cảnh dời bằng một lệnh riêng —
[Đổi độ dài chân](#đổi-độ-dài-chân). Cảnh còn `elbow` thế giới trên mốc không có `at` (schema cảnh trước 34) cũng vậy: `upgrade`
nhắc số cảnh, chuyển bằng [`migrate-elbow`](#chuyển-elbow-sang-hệ-thân).
Repo có `held/` và đã lưu bảng chuẩn nhóm cầm thì nâng xong chạy `pnpm bang-cam --so`: nó so từng ô cận bàn tay (nhóm ×
món × chỗ cầm mẫu × hai cỡ tay) với bảng đã duyệt và chỉ in ô đổi ([03](03-scene.md#bảng-duyệt-nhóm-cầm),
[11](11-nhom-cam.md#bang-cam-theo-nhóm)).

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

## Thư mục tạm

Máy có `/tmp` là tmpfs thì khai `"stickman": { "tmpdir": "~/.cache/remotion-tmp" }` trong `package.json`:
`tools/webpack.mjs` đưa thư mục tạm của mọi lượt bundle, render ra đó. Bundle của `pnpm frames`, `can-tay`, `thumbnails`
(`tools/bundle.mjs`) ghi pid chủ vào `.stickman-pid` và xoá khi tool thoát. Mỗi lượt bundle của các tool ấy và mỗi lần
`remotion render`, `remotion still`, `remotion studio` nạp `remotion.config.ts` đều dọn `TMPDIR` trước
(`tools/sweep.mjs`):

- bundle có `.stickman-pid` (của tool bị giết cứng) mà tiến trình chủ đã chết; chủ còn chạy thì giữ dù cũ mấy;
- thứ Remotion đặt tên — `remotion-webpack-bundle-*` không có `.stickman-pid`, `remotion-v*-assets*`,
  `react-motion-render*`, `remotion-filelist*`, `remotion-large-audio-mixing*` — khi chính nó và mọi mục ngay trong nó
  cũ hơn 12 giờ (`MAX_AGE`) và không tiến trình nào mở file trong đó hay đứng trong đó (đọc `/proc`, chỉ Linux);
- cùng luật tuổi ấy, file, thư mục tạm của Chrome (`.com.google.Chrome.*`, `.org.chromium.Chromium.*`,
  `puppeteer_dev_chrome_profile-*`) — chỉ khi `stickman.tmpdir` khai một thư mục riêng; `TMPDIR` là `/tmp`,
  `/var/tmp`, `/dev/shm` thì chỉ dọn thứ Remotion đặt tên.

Thư mục khai ở `stickman.tmpdir` coi như của riêng tool Remotion: nhiều repo video khai chung một thư mục thì repo nào
chạy tool cũng dọn hộ rác của repo kia. Lượt render chạy quá 12 giờ thì đi bundle riêng ngoài `TMPDIR`
(`remotion bundle --out-dir`), không thì bundle không dấu của nó có thể bị dọn giữa chừng.

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

## Chuyển món cầm bản 1 sang nhóm cầm

Rig chỉ nạp món nhóm cầm; món bản 1 (kiểu cầm khai theo món) và `hold` của cảnh trỏ kiểu cầm ấy làm zod báo lỗi kèm lệnh
`stickman migrate-held`. Tool chuyển chúng sang món nhóm cầm và `{ item, group, … }` ở **tay dẫn**: dựng liên kết bản 1 bằng
bàn tay thật của nhân vật rồi ghi chỗ cầm nhóm gần nó nhất, đủ mọi
trường. Chạy khô trước, rồi ghi:

```bash
pnpm exec stickman migrate-held --held-dir held-v2 --dry-run --out tmp/migrate.md
pnpm exec stickman migrate-held --held-dir held-v2
```

| Cờ | Làm gì |
|---|---|
| `--scene <regex>` | Chỉ cảnh có id khớp |
| `--held-dir <thư mục>` | Món nhóm cầm có nhãn phần (mặc định `held`); món bản 1 đọc ở `held/` |
| `--map <file>` | JSON `{ group, part?, variant? }` theo khoá kiểu cầm, đè hay thêm bảng `HOLD_MAP` (kiểu cầm → nhóm) của tool |
| `--out <file.md>` | Ghi bảng lệch từng lần cầm và kết quả JSON cùng tên |
| `--dry-run` | Chỉ in; không ghi cảnh hay món |

Chỉ ghi vào `scenes/` và `--held-dir`; cảnh còn lần cầm chưa chuyển được thì không ghi. Thứ tự các bước, cách đọc bảng và
ngưỡng lệch: [11](11-nhom-cam.md#8-chuyển-đổi).

## Chuyển `elbow` sang hệ thân

Từ schema cảnh 34, `elbow` của mốc `world.hands` không có `at` (mốc `to`, mốc chỉ có `hold`) là hệ thân `[tiến, y, ra ngoài]`
của tay ấy, quay theo người ([03](03-scene.md#đích-bàn-tay-thế-giới)). Cảnh ghi `schemaVersion` dưới 34 còn `elbow` như thế
là hướng thế giới: zod từ chối cả cảnh kèm tên lệnh. Lệnh quay từng hướng về hệ thân bằng hướng thân người ấy ở giây của mốc
(dựng runtime trên chính repo: nhân vật, hành động, đạo cụ qua hai lớp), nên dáng ở mốc không đổi; giữa các mốc và khi người
quay thì khuỷu theo thân. Chạy khô trước, rồi ghi:

```bash
pnpm exec stickman migrate-elbow --dry-run
pnpm exec stickman migrate-elbow
```

| Cờ | Làm gì |
|---|---|
| `--scene <regex>` | Chỉ cảnh có id khớp |
| `--dry-run` | Chỉ in từng hướng cũ (thế giới) → mới (hệ thân); không ghi |

Mỗi cảnh đổi được vá đúng các `elbow` và `schemaVersion` (lên 34), phần còn lại của file giữ từng byte; cảnh đời quá cũ còn phép
nâng schema khác thì viết lại cả file đã nâng. Cảnh khớp `stickman.frozen` cũng chuyển — không chuyển thì không nạp được. Cảnh
không có `elbow` nào như thế không bị đụng. Rig đọc JSON không ghi `schemaVersion` theo nghĩa mới (cảnh dựng trong code), còn
lệnh coi file `scenes/` không ghi số là soạn trước bản này và chuyển như đời cũ — bảng của lệnh đánh dấu chúng; file soạn
sau bản này mà không ghi số thì ghi `"schemaVersion": 34` trước khi chạy.

## Studio đọc repo video

`@stickman3d/cli` mang hai studio, cả hai mở tại chỗ trong repo video:

```bash
pnpm studio      # = pnpm exec stickman studio: Studio 3D, http://localhost:5180
pnpm studio2d    # = pnpm exec stickman studio2d: character studio 2D, http://localhost:5173
```

`--port` đổi cổng của cả hai.

### Studio 3D

Dev server Vite (Vite đi theo `@stickman3d/cli`) chạy app `apps/studio3d` với gốc là thư mục đang đứng: xem cảnh three
của `scenes/` (cùng `stickman.world` mà Remotion vẽ), soạn kiểu cầm, chỉnh dáng ngón của tay không cầm đồ thành dáng có
tên của `hands/` ([01](01-rig.md#dáng-tay-có-tên)), sửa mốc tay và mốc món trên thanh tua (chế độ
**Dáng tay**: thêm, dời giữ mốc tên `@tên±Δ`, xoá, `ease`, `hold`, `pose`, `elbowLock`, xoá clip và đổi hành động của track, **Về tư thế buông** (mốc `rest`), một lịch sử hoàn tác chung, **Lưu**). Phím,
panel, cách soạn ở README của `apps/studio3d` trong repo rig.

- **Rig của trang là rig repo video đang nạp.** `@stickman3d/rig`, `sketch`, `fx` trỏ `link:` tới một cây nguồn thì trang
  lấy `src/` của cây ấy (sửa rig là trang nạp lại); cài từ registry thì lấy `dist`. `three`, `react`, `zod` lấy bản của
  repo video, nên trang và cảnh của repo chung một bản mỗi gói.
- **Ghi thẳng repo.** **Lưu** ghi `scenes/<cảnh>.json` (`POST /api/scene`), `held/<món>.json` (`POST /api/held`;
  `STUDIO3D_HELD_OUT=<thư mục>` đổi hướng ghi món sang thư mục ấy và đọc nó phủ lên `held/`) và `hands/<dáng>.json`
  (`POST /api/hands`; dáng chung lưu lại thì thành bản của repo, đè dáng chung cùng tên). Cảnh chỉ nhận
  `cast[*].world.hands`, `cast[*].tracks` và `items` của bản studio; bản gửi lên đổi phần khác thì bị từ chối, thiếu khoá nào thì khoá ấy
  trên đĩa giữ nguyên (xoá hết là gửi mảng rỗng).
- **Kiểm hash.** Mỗi lần nạp, trang nhận hash của file trên đĩa; lưu gửi kèm hash ấy. File đã đổi từ lúc nạp (agent,
  `retime`, sửa tay) thì server trả 409 và không ghi: tải bản đĩa về (thành một bước mới của lịch sử, hoàn tác về bản
  của mình để so) rồi sửa lại. Server so hash cả ngay trước lệnh ghi, lượt
  ghi của một file xếp hàng: hai lần lưu cùng một bản nạp thì lần sau 409.
- **Vá JSON thô.** Server viết lại đúng những giá trị đổi trên chữ của file, giữ mọi trường khác, kể cả trường schema
  không biết (zod bỏ chúng khi parse), và thứ tự khoá. File đúng lối `JSON.stringify(…, null, 2)` giữ lối ấy; file đúng
  lối prettier (cấu hình của repo, thiếu thì mặc định) thì chạy prettier sau khi vá; file khác chỉ đổi chỗ vá (đoạn chèn
  theo kiểu xuống dòng và bậc thụt của file). Kết quả qua `parseScene` / `parseHeldItem` của rig trang dùng, hỏng thì
  không ghi. Bản cũ ở `<file>.json.bak` (`.gitignore` mẫu đã bỏ qua); git là lưới an toàn.
- **Chỉ nghe `localhost`.** `--host <địa chỉ>` mở trang ra mạng ấy, cùng hai đường ghi; chỉ dùng trên mạng tin được.

### Studio 2D

Static server: phục vụ app studio 2D đã build, và đè `characters/` `actions/` `props/`
`animals/` `pieces/` của workspace lên đường dẫn bộ mẫu (`index.json` sinh lúc chạy,
`/workspace.json` cho nhãn; `characters/`, `actions/`, `animals/` và `pieces/` gộp với lớp chung,
`catalog.json` gộp) — mở lên là thấy nhân vật của repo này, **chỉ đọc**. Ghi đi qua **Mở thư
mục** (File System Access API, chỉ có ở `localhost`) trỏ vào chính thư mục ấy: studio ghi JSON
thẳng vào `characters/` và `actions/`, bản cũ giữ ở `<file>.json.bak`. Studio 2D không có endpoint
ghi nào phía server. Hai studio đi cùng cli nên luôn khớp bản rig đã pin.

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
