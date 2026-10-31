# 05 — Dựng một repo video

Mỗi tập phim là một repo riêng: nhân vật, hành động, cảnh, món cầm tay, dáng tay và app
Remotion của nó. Rig vào bằng đường dependency, không phải nhánh trong repo
studio. `@stickman3d/cli` (bin `stickman`) dựng cái repo ấy và soi nó; MCP gọi vào
cùng hàm qua tool `init` / `check`.

Các bước từ máy trắng tới repo chạy được — cài pnpm, khai registry, `init`, cài
công cụ render — nằm ở `QUICKSTART.md` của repo studio. File này nói về repo
video sau khi nó đã đứng: nó gồm những gì, soi bằng gì, nâng version thế nào.

## `init` sinh ra gì

Chép một lần làm mẫu, từ đó là của repo video: cảnh 3D mẫu `scenes/vi-du-3d.json`;
`episodes/` trống. **Hành động, món cầm tay, dáng tay và nhân vật thì không chép** — chúng
là lớp chung nằm trong package, xem [Hai lớp](#hai-lớp); `actions/`, `held/`, `hands/`, `characters/`
và `pieces/` (ảnh PNG của hiệu ứng) trống.

Sinh mới: `stickman.md` — cách dùng rig cho agent, `AGENTS.md` trỏ vào đó và để
trống chỗ ghi luật riêng của tập, `CLAUDE.md` một dòng trỏ vào `AGENTS.md`, `README.md`,
`.gitignore`, `.npmrc` trỏ scope `@stickman3d` sang registry GitLab, `.mcp.json`
khai sẵn server, và `package.json` pin **đúng số version**, không `^`.

Cùng với đó là **app Remotion**: `src/` (`index.ts`, `Root.tsx`, `Scene.tsx`,
`data.ts`, `images.ts`, tầng tập `episode.ts` / `shots.ts` / `Episode.tsx`, và
`Thumbnail.tsx`; cảnh 3D ở `khoi3d/` — `Scene3D.tsx` sân khấu three (`buildStage` của rig, người diễn mặc đồ theo
`equip` — [03](03-scene.md#cảnh-3d)), `world.ts` cùng cảnh three ấy cho `check` ([Cảnh three cho
`check`](#cảnh-three-cho-check)), `Overlay3D.tsx` lớp chữ SVG đè lên, `set.ts` đường import kiểu bối cảnh `Set3D` và
phòng trơn `plainRoom` của rig, `ChanDung.tsx` chân dung người 3D cho lớp vẽ code; cùng ba file của repo `lop.tsx`,
`scene-wrap.tsx`, `khoi3d/canh.ts`), `tools/` (`still.mjs`, `can-tay.mjs`, `bang-cam.mjs` và `bang-hanh-dong.mjs` cùng `soi.mjs`, `soi.tsx`, `thumbnails.mjs`, `srt.mjs`, `tts.py`,
`tts-blocks.py` cùng `len-giong.py`, `lipsync.mjs` cùng `words.py`, `sfx.py`, `sfx-el.py`,
`sfx-loop.py`, `webpack.mjs` cùng `scope.mjs` — [07](07-lam-tap.md#công-cụ-trong-tools)),
`remotion.config.ts`, `tsconfig.json`, `pnpm-workspace.yaml`, và `package.json` có sẵn
`pnpm remotion` / `render` / `still` / `frames` / `can-tay` / `bang-cam` / `bang-hanh-dong` / `thumbnails` / `srt` / `tts` /
`tts-blocks` / `lipsync` / `sfx` / `sfx-el` / `sfx-loop` (`pnpm studio` là
Studio 3D) và `stickman.world` trỏ `src/khoi3d/world.ts`. Bảng riêng của tập cho các tool ấy — `sfx/*.json`, bản lời có tag —
không có mẫu nào: tool đọc thấy thiếu thì báo cú pháp. `package.json` pin cả `three`; `scenes/vi-du-3d.json`
là cảnh 3D mẫu, `khoi3d/canh.ts` nối tên nó với `plainRoom` (`CANH_3D`: tên cảnh → `WorldSpec`) — `Scene.tsx` gặp
cảnh có trong `CANH_3D` thì vẽ sân khấu three, cảnh khác chỉ có nền, lớp vẽ code và `fx`; `THU_3D` cùng file là composition thử bối cảnh
(người, ống kính, khung cắt mượn của một cảnh), nằm trong thư mục `khoi3d` của Studio. Cảnh 3D nặng thì `pnpm remotion-prod`
chạy Studio bằng React production, mất fast refresh. Render cảnh 3D cần GPU qua Vulkan:
`remotion.config.ts`, `tools/soi.mjs` và `tools/thumbnails.mjs` đặt sẵn `gl: "vulkan"`, riêng macOS (không có Vulkan) là
`"angle"` (ANGLE trên Metal). Mỗi file trong `scenes/` là một composition, mỗi file trong
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
pnpm exec stickman docs 03              # một file; nhận cả `03-scene.md`
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
studio mở lên nhưng sẽ cản một số bước render, âm thanh hoặc ghép ảnh. Python cho
tiếng là `.venv` riêng của repo, chỉ cần dựng khi bắt đầu làm tiếng:

```bash
python3 -m venv .venv
.venv/bin/pip install numpy faster-whisper     # pnpm sfx, pnpm lipsync
.venv/bin/pip install vieneu soundfile         # pnpm tts, nếu gen lời dẫn local
```

`tts-blocks`, `sfx-el` và `sfx-loop` chạy bằng `python3` của hệ thống, chỉ
thư viện chuẩn.

## Soi workspace

```bash
pnpm exec stickman check
```

`check` bắt: version pin lệch rig đang cài, JSON hỏng theo zod của rig, tham chiếu chéo
hỏng (cảnh trỏ vào nhân vật / hành động / nền không có, `fx` trỏ vào
ảnh trong `pieces/` không có; shot trỏ vào cảnh hay cue trỏ vào file tiếng không có), file trong
`actions/` / `characters/` **giống hệt** bản trong bộ chung — thừa, xoá được —
và **công cụ ngoài thiếu trên `PATH`**: `rsvg-convert`, `ffmpeg`, `ffprobe`,
`magick`. Không cái nào là dependency npm; `check` là cửa kiểm tra chúng.

Lệnh nào của `stickman` cũng nhận `--help` / `-h`: in cách dùng và cờ của lệnh ấy rồi thoát, không chạy gì. Cờ lệnh không
nhận hay cờ thiếu giá trị thì báo lỗi kèm danh sách cờ của lệnh, thoát mã `1`, cũng không chạy.

### Soi một cảnh

Soi cả workspace phải dựng runtime và đo người 3D cho mọi cảnh, nên repo nhiều
tập mất cả phút. Sửa xong một cảnh thì chỉ soi cảnh ấy:

```bash
pnpm exec stickman check --scene t03-s01-cd-haru   # regex trên id cảnh: ^t03-s01 lấy cả nhóm
pnpm exec stickman check --uses ngoi-nga-3d        # mọi cảnh dùng hành động ấy
```

MCP: `check({ scene, uses })`. Cảnh khớp được soi đủ như lượt toàn bộ (tham chiếu, trượt chân, thân
quay gắt, hành động không soạn ở `side` trên người 3D, giật trên hình…); cảnh không khớp chỉ được parse cho tham chiếu chéo.
In cảnh báo của cảnh khớp và **mọi lỗi** ở bất kỳ đâu; tập, tiếng, `retime`, file chưa commit, công cụ ngoài thì bỏ qua — chúng chỉ có ở lượt toàn bộ, chạy ở cuối
tập hay sau khi nâng rig. Regex không khớp cảnh nào là lỗi.

`--uses <tên,…>` chọn cảnh mà JSON dùng một trong các tên: hành động (`clips[].action`), nhân vật
(`cast[].character`); tên viết có hay không đuôi `.json` đều được.
Đi chung `--scene` thì lấy cảnh khớp cả hai. Tên không có trong `actions/`, `characters/` (kể cả bộ
chung) là lỗi, không cảnh nào dùng cũng là lỗi. Cảnh báo của chính file hành động có tên trong `--uses` (công tắc `equip`,
khuỷu gập ngược, mốc ngoài `mask`…) cũng in. Bối cảnh, đồ khối và đồ cầm repo dựng bằng code trong `src/` không nằm trong
JSON cảnh nên `--uses` không tra được: cảnh dùng chúng thì chọn bằng `--scene`.

Nhiều cảnh (regex khớp cả nhóm, hay lượt toàn bộ) thì phần đo sâu từng cảnh — người lồng vào đồ, tay,
lòng tay, giật trên hình — chia cho nhiều luồng: mặc định nửa số nhân, không quá số GB RAM còn trống;
`--jobs <số>` đặt tay. Một cảnh thì chạy một luồng.

### Nhóm luật

Luật của `check` chia bảy nhóm theo thứ chúng cần dựng. `--only <nhóm,…>` chỉ chạy các nhóm ấy, `--skip <nhóm,…>` bỏ
chúng; không cờ nào là mọi nhóm trừ `clash`. **`clash` chỉ chạy khi gọi tên trong `--only`**: nó tốn gần hết thời gian
của `check` mà đo người trên ống chi trần (không theo quần áo vẽ ra) và không đo đồ với đồ của cảnh three. Tên sai là lỗi kèm danh sách nhóm. `--held` là tên tắt của `--only held`. MCP:
`check({ only, skip })`. Nhóm không chạy thì thứ chỉ nó cần không dựng — không gói module cảnh three, không dựng cảnh
three của từng cảnh, không lấy mẫu khối người, không mở luồng phụ — nên lượt hẹp nhanh thật chứ không chỉ in ít dòng hơn.

| Nhóm | Luật | Cần dựng |
|---|---|---|
| `ref` | tham chiếu chéo (nhân vật, hành động, nền, `fx`, `equip`), version pin, file giống bộ chung, bộ đồ của nhân vật; công tắc `equip` một chiều, hai track cùng ghi một socket, khuỷu gập ngược khi giơ tay, mốc ngoài `mask`, hành động tự giật, mốc khai không ai neo, người 3D diễn hành động không soạn ở `side`; tay cầm hai tay (`both`) trong khi tay kia cầm món khác; lớp vẽ code bật cho cảnh không có, thư mục sidebar | JSON, runtime, gói lớp vẽ code |
| `move` | người 3D trượt, không tới mốc dừng, khởi hành và dừng giật, thân quay gắt, clip đi hoà vào khi `path` đã chạy, `yaw` mốc lệch hướng đi; tay chân giật trên hình; khuỷu rung, lật, gập ngược, bàn tay lật, tay duỗi hết tầm hay co sát thân | runtime, khớp người theo thời gian |
| `held` | đồ cầm tay sai: ngón xuyên, món hở, tâm nắm xa, ý định không đạt, tay phụ hay `item:` không tới, món nhảy qua mốc `hold`, cầm món không ai `provide`; chỗ cầm nhóm (`món@nhóm`) thêm da lún, ngón vai trò hở, cổ tay vượt kẹp hay sát kẹp, tay lấn thân, món to so với tay; đường cũ thêm dáng khác dáng khai, món trôi | runtime, cảnh three |
| `legacy` | đồ cầm còn đi đường cũ (`hold` gọi tay không có chỗ cầm nhóm), một dòng mỗi cảnh | runtime, cảnh three |
| `roles` | vai trò của đồ của cảnh ([13](13-vai-tro-do.md#7-check-mcp-hai-lớp)): `roles` hỏng zod hay vật có vai trò mà phép đặt nghiêng, cỡ không đều, lật (lỗi, dòng mang entry `stickman.world` và tên vật); mặt ngồi, tay vịn, để chân, mặt trên bàn không nằm trên mặt trên của khối cùng vật (dò dọc xuống, khe quá `2`), mặt trước lưng ghế cách mặt khối cùng vật quá `2` (cảnh báo); người ngồi có điểm ngồi chiếu vào trong một mặt ngồi (nới `2 · s`) mà lệch độ cao quá `1 · s` (cảnh báo). Ngưỡng của đồ là đơn vị rig thế giới. Người ngồi trên đồ không khai `seat` không ra dòng nào | runtime, cảnh three (mỗi `0,25 s` cho người ngồi, mỗi `1 s` cho zod và lệch hình) |
| `clash` (chỉ khi gọi tên) | người lồng vào đồ, vào người khác, tay xuyên thân, đồ lồng vào đồ, `touch` lạ | runtime, cảnh three, lớp vẽ code, mẫu khối người mỗi `0,25 s` |
| `episode` | tham chiếu của tập, tiếng dài hơn chỗ nó nằm, bè lặp kêu khi sân khấu đứng yên, số cũ phải `retime`, file chưa commit, công cụ ngoài, `sfx/` đọc không được | tập, tiếng (`ffprobe`), git — chỉ ở lượt toàn bộ, không có khi `--scene` hay `--uses` |

Nhóm nào cũng báo JSON hỏng theo zod, lỗi của `resolveScene` (mốc không có, nhóm) và ngưỡng hỏng trong
`package.json` của nhóm đang chạy: không parse được thì không đo được gì. Runtime (`resolveScene`) dựng cho mọi nhóm vì
chính nó là phép kiểm tham chiếu chéo của `ref`, và nó rẻ so với các phép đo. **Tay xuyên thân nằm ở `clash`** dù là
luật của tay: nó đo chung một lượt với người lồng vào đồ (`sceneClashes` trên khối người, giây lấy mẫu chia nhỏ theo vật
của cảnh three dời), ngưỡng ở `stickman.clash.self`. Lòng tay và hướng ngón `check` không đo — soi và sửa ở Studio 3D; khuỷu và cổ tay trên hình đo ở `move`
([03](03-scene.md#khuỷu-và-cổ-tay-trên-hình)). Cảnh three dựng một lần cho mọi nhóm cần nó (cùng `worldOf`, cùng `pose(t)`); dựng hỏng thì dòng báo mang nhóm đầu tiên
trong `clash`, `held`, `legacy`, `roles` đang chạy. `held/<món>.json` và `hands/<tên>.json` hỏng là lỗi zod như mọi JSON; tên
dáng tay ngoài `[a-z0-9-]` hay trùng dáng có sẵn của rig cũng là lỗi, và dáng ấy không vào thư viện; hành động có
`keys[].hand` gọi dáng không có sẵn mà cũng không có trong `hands/` của hai lớp là lỗi ở file hành động. Món, mốc, dáng tay
mà scene trỏ tới không có, chỗ cầm không hợp lệ là lỗi `resolveScene`. `legacy` chạy cùng `held` thì đọc chung các tư thế đã đặt, chạy riêng thì
chỉ đặt cảnh mỗi `0,1 s` mà không đo.

Sửa gì chạy nhóm nào:

| Sửa | Chạy |
|---|---|
| Chỗ đứng, đường đi (`world.at`, `path`) | `move` |
| Tay (`world.hands`, `reach`, dáng tay, `hands/<tên>.json`) | `move` (+`held` nếu tay đang cầm) |
| Đồ cầm trong cảnh (`world.hands[].hold`, ý định, `point: item:`), `cast.provide` | `held` |
| Món cầm tay: mốc, hình va chạm, phần (`held/<món>.json`) | `ref,held` trên mọi cảnh có món ấy (`--scene`); repo tự kiểm hình khớp lưới |
| Thời gian, retime, audio | `move` + lượt toàn bộ cho `episode` |
| Bối cảnh, đồ khối | `clash` (+`roles` khi đồ khai `Item.roles` / `withRoles`) |
| Hành động chung | `--uses <tên> --only ref,move,held` |
| Cuối lô | đủ nhóm trên các cảnh của lô, `--baseline` |
| Cuối tập, nâng rig | đủ, toàn workspace (`--baseline` nếu có) |

Sửa một cảnh thì chỉ chạy nhóm theo bảng; cả workspace chậm, chỉ chạy ở cuối tập hay sau khi nâng rig. Cảnh còn đi
đường cũ thì thêm `--skip legacy`.

```bash
pnpm exec stickman check --scene '^t01-s04[0-5]' --only move
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
| **Người 3D quay rồi khởi hành giật** | `move` | `sceneLaunchProblems` đo hông vẽ ra từng khung `1/60 s` cho người có `world.path`: hông rời chỗ đứng sát mốc cuối của một cú quay tại chỗ rồi trong `0,6 s` tăng tốc quá `5000` đơn vị rig/s², hay nhanh hơn tốc độ hành trình của `path` quá `25%` — chân tụt sau `path` rồi đuổi theo; sửa bằng cho clip đi bắt đầu trong nhịp cuối của cú quay, clip đi trước hết trước mốc đầu của cú quay; kèm cú quay đã ghép mà `yaw` mốc cuối còn lệch hướng quãng đi quá `10°` (hông rời `path`), lời báo cho `yaw` nên đặt — [03](03-scene.md#quay-tại-chỗ) |
| **Người 3D dừng giật** | `move` | `sceneStopProblems` đo hông vẽ ra từng khung `1/60 s` quanh mỗi mốc dừng của `world.path`: hông nhanh hơn tốc độ hành trình của quãng tới quá `25%`, hay vượt mốc dọc hướng đi quá `8` đơn vị rig — rig không tự dừng ở mốc; sửa bằng cho clip sau clip đi bắt đầu trong nửa `cycle` trước mốc dừng (muộn nhất một phần tư `cycle` sau mốc), cú quay tại chỗ ngay ở mốc quá gấp thì giãn nó hay chèn mốc đứng trước nó — [03](03-scene.md#dừng-ở-mốc) |
| **Người 3D đứng sững rồi lao theo `path`** | `move` | `sceneWalkInProblems`: clip đi hoà vào (`blend` quá `0,05 s`) từ tư thế không đi trong khi `path` đã chạy — vào cảnh đang đi thì `blend: 0` — [03](03-scene.md#check-cho-người-3d) |
| **`yaw` mốc `path` lệch hướng đi** | `move` | `sceneWalkYawProblems`: mốc giữa đường lệch phân giác hai quãng, mốc đầu, mốc dừng lệch quãng kề quá `45°` — thân lái nửa vời, hông bỏ `path`; lời báo cho `yaw` nên đặt — [03](03-scene.md#check-cho-người-3d) |
| **Người 3D lồng vào đồ** | `clash` | `sceneClashProblems` của cli: phần người lấn quá `2` đơn vị thế giới (`stickman.clash.tol`) vào khối đồ của lớp vẽ code (`solidClashes` của fx) hay vào người khác. Repo khai [`stickman.world`](#cảnh-three-cho-check) thì phần người đo với mọi vật của chính cảnh three ấy bằng `collide` của rig, thay cho khối đồ của lớp vẽ code. Mỗi cặp một dòng kèm giây sâu nhất và các quãng giây; món hay vật khai `touch` thì bỏ phần người ấy — [10](10-lop-ve-code.md#người-lồng-vào-đồ) |
| **Tay xuyên thân** | `clash` | `sceneClashProblems` của cli (`armPierce` của lõi, tay và thân đúng như three vẽ): cánh tay, cẳng tay (bỏ quãng sát vai và sát cổ tay) lấn vào thân áo của chính người ấy quá `4` (`stickman.clash.self`, `false` là tắt) — [10](10-lop-ve-code.md#tay-xuyên-thân) |
| **Đồ lồng vào đồ** | `clash` | `sceneItemClashProblems` của cli (`solidItemClashes` của fx): hai món của lớp vẽ code lấn nhau quá `stickman.clash.tol` **và** phần thể tích món nhỏ nằm trong món kia quá `0,1` (`stickman.clash.items`, `false` là tắt), mỗi cặp một dòng; món khai tên món kia trong `touch` thì bỏ — [10](10-lop-ve-code.md#đồ-lồng-vào-đồ) |
| **Người 3D diễn hành động không soạn ở `side`** | `ref` | `sceneSideProblems` của rig, **mức lỗi**: người có `world` mà clip ghi kênh tay chân của hành động không soạn ở `side` — sân khấu three vẽ kênh ấy ở dáng nghỉ, hoà với hành động `side` là giật một khung. Mỗi người, mỗi clip một dòng kèm bản `-3d` có sẵn — [03](03-scene.md#hành-động-cho-người-3d) |
| **Đồ cầm tay sai** | `held` | `sceneHeld` của rig trên cảnh three [`stickman.world`](#cảnh-three-cho-check) (`heldFrame`, `heldItemsFrame` của cli, `heldHands` của người 3D): trục ngón vào trong món quá `1,25`, món không chạm tay, tâm nắm ngoài món quá `3`, ý định không đạt (tay dẫn: `AimReport.hold` kèm khớp kẹp; đường cũ: `userData.hold`), tay phụ hay `item:` không tới, món nhảy qua mốc gắn / thả / đổi tay, món khai `hold` mà cảnh không `provide`; chỗ cầm nhóm đi bộ luật riêng ([11](11-nhom-cam.md#7-luật-check-nhóm-held)): `sink` (da lún), `rest` (da dưới mặt đỡ ở mốc món nằm), `role`, `oppose` (không có lực đối), `grip` theo nhóm, và với món đặt trước `reach` (ngoài tầm — lỗi), `wrist` (vượt kẹp — lỗi, sát kẹp — cảnh báo), `arm`, `size`, cả hai đường `elbow` (khuỷu gập ngược vào trong hay chĩa lên — lỗi) và tay lấn đầu (lỗi); món treo (`món@carry`, `heldCarries`) quai rời chỗ treo hay khuỷu không gập giữ quai, thân món lồng vào người; đường cũ thêm dáng `hold` khác dáng khai, món trôi trong khung bàn tay; kéo dài từ `0,3 s` (`stickman.held`: `pierce`, `touch`, `wrap`, `grip`, `up`, `face`, `drift`, `turn`, `reach`, `sink`, `wrist`, `arm`, `elbow`, `oppose`, `rest`, `seat`, `body`, `hold` — số dương, thiếu thì lấy mặc định của rig; `grip` khai thì thắng ngưỡng theo nhóm; `false` là tắt) — [03](03-scene.md#đồ-cầm-tay) |
| **Đồ cầm còn đi đường cũ** | `legacy` | `legacyHolds` của người 3D: lần cầm qua `hold` gọi tay không có chỗ cầm nhóm, một dòng mỗi cảnh — [01](01-rig.md#món-cầm-tay) |
| **Tay chân giật trên hình** | `move` | `sceneSnapProblems` của rig: lấy mẫu theo fps bản chốt, khớp đúng như hình vẽ ra (`actJoints` của người 3D) qua khung cắt camera, khung nào một khớp nhảy vượt nền chuyển động quanh nó quá ngưỡng (`stickman.snap`) thì kêu, kèm lý do đọc từ timeline; chỗ khai `snap` thì bỏ — [03](03-scene.md#giật-trên-hình) |
| **Hành động tự giật** | `ref` | `actionSnapProblems` của rig: `wrap` mà mốc cuối ở `t: 1` lệch mốc đầu, hay hai mốc sát nhau đổi góc lớn hơn hẳn hai đoạn kề; file khai `snap` thì bỏ — [01](01-rig.md#hành-động-giật-có-chủ-ý) |
| **Mốc khai mà không ai neo** | `ref` | Chỉ khi khai `stickman.marks.unused: "warn"`: mốc trong `marks` không chỗ nào trong JSON viết `"@tên"`. Mặc định tắt, vì lớp vẽ code đọc mốc qua `ctx.marks` mà `check` không thấy — [03](03-scene.md#mốc-có-tên) |

### Cảnh three cho `check`

Đồ repo dựng thẳng bằng three (đồ cầm tay, đồ bám cổ tay, đồ chạy theo `t`) không nằm trong
`solids(ctx)` của lớp vẽ code, nên `check` chỉ đo được người lồng vào chúng khi repo đưa cảnh three
cho nó. Khai module dựng cảnh trong `package.json`:

```json
"stickman": { "layers": "src/lop.tsx", "world": "src/khoi3d/world.ts" }
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
chép cảnh ra tên mới rồi neo vào bản chép. Nhân vật, hành động, món cầm tay, dáng tay là đồ chung
nên không đóng băng được.

## Hai lớp

`actions/`, `held/`, `hands/` và `characters/` của repo video là **lớp
trên**; **lớp dưới** là bộ chung đi theo studio — các hành động mẫu (bộ hành động 3D — [01](01-rig.md#bộ-hành-động-3d), nét mặt `face-*`, nhép miệng, vài cú đầu và nhịp nói), món cầm tay mẫu (`coc`, `tui`, `tui-du-lich`, `tui-deo`, `dien-thoai`, `khay`, `ly`, `chen`, `binh`, `kep-ho-so`, `but`, `vali`, [01](01-rig.md#món-cầm-tay)), dáng tay chung `peace`, `count-3`, `tap`, `scratch`
([01](01-rig.md#dáng-tay-có-tên)) và bốn nhân vật mẫu: người 3D để xem thử hành động (`sample-man`, `sample-woman`,
`sample-heavy` bụng phệ, `sample-kimono` mặc kimono).
Lớp dưới **không nằm trong repo video**: nó là

`template/` trong package `@stickman3d/cli` (chạy từ cây nguồn thì là
`common/` ở gốc repo rig), hằng `COMMON` trong `lib.mjs`. Đọc thì tìm lớp trên
trước, không có mới xuống lớp dưới; file **trùng đường dẫn** thì lớp trên đè. Món của `held/` ở cả hai lớp là món nhóm cầm
(`schemaVersion: 4`, bản `3` không có `roles` nạp như bản `4` — [11](11-nhom-cam.md#2-schema-món-heldmónjson-held_version-4)).
Vai trò của món (`roles`, [13](13-vai-tro-do.md)) nằm trong chính `held/<món>.json` nên đi hai lớp cùng món: bộ chung khai
`pourer` cho `binh`, `vessel` cho `coc`, `ly` (`chen` suy được từ hình); repo đè món cùng tên là đè cả `roles`.
Ghi thì luôn vào lớp trên.

Nhờ vậy:

- studio thêm hành động, món cầm tay hay nhân vật mẫu → publish `cli` → repo video `pnpm add` là có, không có
  bước chép, không có câu hỏi đè / bỏ qua;
- repo video chỉ commit hành động, món cầm tay, dáng tay và nhân vật **của tập ấy**;
- muốn sửa một hành động, món cầm tay, dáng tay hay nhân vật chung thì chép sang lớp trên
  **cùng tên** — MCP `patch` một file chung làm đúng việc ấy, Studio 3D lưu một dáng tay
  chung cũng vậy — hoặc đặt tên khác nếu muốn giữ cả hai. Không có
  ghi ngược xuống lớp dưới.


Mọi đường đọc đều đi hai lớp — Studio 3D và `check` (`worldData`, `libraryOf` của `lib.mjs`), `stickman-render` và
MCP (`layers` + `findIn`), và app Remotion (`remotion.config.ts` trỏ alias
`@stickman-common` vào `COMMON`, `data.ts` `require.context` cả hai, `tools/srt.mjs`
đọc cùng hai thư mục). Thêm đường đọc mới thì cũng phải đi hai lớp. Món cầm tay đến `resolveScene` ở **tham số thứ
năm** (`held`, bảng món theo tên không đuôi): `data.ts` xuất `HELD`, `Scene.tsx`, `Episode.tsx`, `Scene3D.tsx` truyền nó;
file `src/` sửa tay mà gọi `resolveScene` thì cũng phải truyền `HELD`, thiếu là cảnh có `hold` ném lỗi "không có món".
Dáng tay có tên (`hands/<tên>.json`, khoá là tên file không đuôi) đến `resolveScene` ở **tham số thứ sáu** (`hands`):
`data.ts` xuất `HANDS`, `Scene.tsx`, `Episode.tsx`, `Scene3D.tsx` truyền nó; file `src/` sửa tay mà gọi `resolveScene` thì
cũng phải truyền `HANDS`, thiếu là cảnh có `world.hands[].pose` gọi dáng của thư viện ném lỗi "không có dáng tay", còn
hành động có `keys[].hand` gọi dáng của thư viện thì bàn tay ra dáng nghỉ. Cảnh, tập và
`pieces/` **không** có lớp dưới: cảnh mẫu chép một lần lúc `init` rồi
thành của repo video.


## Nâng lên bộ rig mới

```bash
pnpm add @stickman3d/rig@… @stickman3d/fx@… @stickman3d/render@… @stickman3d/mcp@… @stickman3d/cli@…
pnpm exec stickman upgrade --dry-run    # xem sẽ đè cái gì
pnpm exec stickman upgrade
```

`upgrade` chép lại **phần studio phát**: app Remotion trong `src/` cùng
`remotion.config.ts` / `tsconfig.json` và `tools/`, `stickman.md` / `.npmrc` /
`.mcp.json` / `pnpm-workspace.yaml`, rồi trộn số version của bộ `@stickman3d` vào
`package.json` (giữ nguyên dependency khác; gói `@stickman3d/*` mà `package.json` chưa có
thì thêm vào, vì app Remotion vừa chép lại đã import nó; `three` và `@types/three` cũng vậy). Script cũng vậy: script đã có
giữ nguyên, script của tool mới chép vào thì thêm, script trong `GONE_SCRIPTS` của `lib.mjs` (`studio2d`) mà còn đúng
bản mẫu thì gỡ.

**`characters/`, `actions/`, `scenes/`, `episodes/`, `held/`, `hands/`, `pieces/`, `sfx/` không bao giờ bị đụng** — đó
là nội dung của tập phim. Hành động, món cầm tay, dáng tay và nhân vật chung mới thì tự có
theo package (xem [Hai lớp](#hai-lớp)), không cần chép; spec rig cũng vậy.
`AGENTS.md` / `README.md` / `CLAUDE.md` / `.gitignore` và `src/lop.tsx` /
`src/scene-wrap.tsx` / `src/khoi3d/canh.ts` cũng không: `init` phát chúng một lần làm nền, từ đó là
của repo video (`SEED_ONLY` trong `lib.mjs`), `stickman.json` không giữ băm của chúng. Thiếu thì
`upgrade` dựng lại bản mẫu — app Remotion `import` cả ba. Thư mục app Remotion `require.context` vào (`held/`, `hands/`,
…) thiếu thì `upgrade` dựng rỗng kèm `.gitkeep`.

**Đừng sửa file app Remotion và tool do studio phát.** Sửa rồi thì mỗi lần mẫu đổi là một lần
trộn tay. Thứ của repo có chỗ riêng: lớp vẽ code ở `src/lop.tsx`, context cho lớp vẽ code cần dữ liệu của app Remotion ở `src/scene-wrap.tsx`
(`<SceneWrap rt t>` bọc `<SceneWorld>` trong `Scene.tsx`), cảnh 3D ở `src/khoi3d/canh.ts` (`CANH_3D`: bối
cảnh, người nền, đồ riêng của cảnh, đồ gắn lên người, ống kính và hậu kỳ theo giây — `WorldSpec`; phòng riêng là hàm
trả `Set3D`, để ở file mới cạnh nó), tool riêng ở file mới trong `tools/`. Việc chung của cảnh 3D — dựng người, đổi
đồ theo `equip`, người nền, đèn, nạp phông, sân khấu — nằm ở `buildWorld` / `buildStage` của rig nên theo version
rig mà đến; thiếu tuỳ chọn thì thêm ở studio, đừng sửa `Scene3D.tsx` hay `world.ts`. Thư mục tạm của tool Remotion:
[Thư mục tạm](#thư-mục-tạm). Sửa
được việc chung (lỗi, tuỳ chọn mới của tool) thì đưa về `packages/cli/scaffold` của studio.
Cảnh còn `elbow` thế giới trên mốc không có `at` (schema cảnh trước 34) thì `upgrade` không đụng, chỉ
nhắc số cảnh, chuyển bằng [`migrate-elbow`](#chuyển-elbow-sang-hệ-thân).
Repo có `held/` và đã lưu bảng chuẩn nhóm cầm thì nâng xong chạy `pnpm bang-cam --so`: nó so từng ô cận bàn tay (nhóm ×
món × chỗ cầm mẫu × hai cỡ tay) với bảng đã duyệt và chỉ in ô đổi ([03](03-scene.md#bảng-duyệt-nhóm-cầm),
[11](11-nhom-cam.md#bang-cam-theo-nhóm)). Đã lưu bảng chuẩn hành động thì chạy cả `pnpm bang-hanh-dong --so`: nó
so từng ô hành động × người mẫu × góc × khung và dòng `check` với bảng đã duyệt ([07](07-lam-tap.md#bảng-duyệt-hành-động)).

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
(dựng runtime trên chính repo: nhân vật, hành động, món cầm tay qua hai lớp), nên dáng ở mốc không đổi; giữa các mốc và khi người
quay thì khuỷu theo thân. Chạy khô trước, rồi ghi:

```bash
pnpm exec stickman migrate-elbow --dry-run
pnpm exec stickman migrate-elbow
```

| Cờ | Làm gì |
|---|---|
| `--scene <regex>` | Chỉ cảnh có id khớp |
| `--dry-run` | Chỉ in từng hướng cũ (thế giới) → mới (hệ thân); không ghi |

Mỗi cảnh đổi được vá đúng các `elbow` và `schemaVersion` (lên bản hiện hành), phần còn lại của file giữ từng byte; cảnh đời quá cũ còn phép
nâng schema khác thì viết lại cả file đã nâng. Cảnh khớp `stickman.frozen` cũng chuyển — không chuyển thì không nạp được. Cảnh
không có `elbow` nào như thế không bị đụng. Rig đọc JSON không ghi `schemaVersion` theo nghĩa mới (cảnh dựng trong code), còn
lệnh coi file `scenes/` không ghi số là soạn trước bản này và chuyển như đời cũ — bảng của lệnh đánh dấu chúng; file soạn
sau bản này mà không ghi số thì ghi `"schemaVersion"` hiện hành (`35`) trước khi chạy.

## Sinh hành động theo cảnh

Hành động mà số đúng phụ thuộc chỗ người và đồ trong cảnh — rót vào một cốc cao hơn, xa hơn, lệch hơn chỗ mẫu của bộ
chung — không sửa tay 24 mốc: `stickman gen <kiểu>` tính từ cảnh, chạy thử trong chính cảnh ấy, đo, rồi mới ghi
`actions/` (lớp trên, [Hai lớp](#hai-lớp)). MCP: tool `gen` cùng tham số ([04](04-mcp.md#tool)). Kiểu hiện có: `pour` (rót),
`sit` ([Ngồi theo ghế của cảnh](#ngồi-theo-ghế-của-cảnh)), `walk` ([Đi theo các điểm sàn](#đi-theo-các-điểm-sàn) — ghi
vào cảnh, không ghi `actions/`) — [01](01-rig.md#bộ-sinh-chung).

**Đồ tìm theo vai trò** ([13](13-vai-tro-do.md)). Mỗi kiểu khai các slot — chỗ trong phép tính cần một vật mang vai trò
(bình `pourer`, vật đựng `vessel`, mặt ngồi `seat`, lưng ghế `backrest`, tay vịn `armrest`, để chân `footrest`, mặt bàn
`tabletop`), bắt buộc khi nào, tìm thế nào khi không có cờ, cờ nào chỉ đích danh; `stickman gen <kiểu> --help` in bảng slot.
Cờ của slot nhận tên vật (`ghe-banh`), tên vật kèm tên mục (`ban-an#tren`), số (đồ ảo: một mục vai trò dựng trong bộ nhớ qua
đúng `RoleSchema`, đi chung đường với vật thật) hay `none` (bỏ slot dùng-nếu-có; không tắt va chạm của vật). Tên vật không
mang vai trò của slot là lỗi kèm danh sách vật mang vai trò ấy:

```text
lỗi: --table ban-tra: vật không khai vai trò `tabletop`; vật có: ban-an, quay
```

Món cầm tay khai vai trò trong `held/<món>.json` (`roles`, [11](11-nhom-cam.md#2-schema-món-heldmónjson-held_version-4)); đồ
của cảnh khai cạnh hình trong `stickman.world` — `Item.roles` của món khối (khung `Item`: `+x` hướng mặt, y xuống), hay
`withRoles(nút, roles)` của rig cho nút three không qua `addItem` (khung local của nút). Vật không khai vai trò thì bộ sinh
không thấy: khối của đồ cảnh là vật cản cho `check`, không mang nghĩa.

```ts
// src/khoi3d/phong.ts — ghế bành: mặt ngồi ở y 0 của khung Item, bên phải người ngồi là −z
const gheBanh: Item = {
  name: "ghe-banh",
  at: { at: [-240, -87.5, 0], yaw: 0 },
  touch: ["thigh", "torso"],
  parts: [/* mặt ngồi, lưng, tay vịn, chân */],
  roles: [
    { role: "seat", at: [3.5, 0, 0], size: [117, 96] },
    { role: "backrest", from: [-55, -24, 0], to: [-60, -80, 0], width: 96 },
    { role: "armrest", name: "phai", from: [-61, -62, -63], to: [62, -62, -63], width: 10 },
    { role: "armrest", name: "trai", from: [-61, -62, 63], to: [62, -62, 63], width: 10 },
  ],
};
const shelf = withRoles(mesh, [{ role: "tabletop", y: -80, poly: [[0, -40], [60, -40], [60, 40], [0, 40]], thick: 4 }]);
```

`scene_probe` trả vai trò của cảnh three ở giây hỏi (vật, chủ, mục, toạ độ thế giới); `check` nhóm `roles` báo vai trò hỏng
zod, lệch hình khối cùng vật ([Nhóm luật](#nhóm-luật)).

```bash
pnpm exec stickman gen pour --scene t02-s04 --cast chu-quan --at 3.2 --cup khach --style serve   # mời khách đang chìa chén
pnpm exec stickman gen pour --scene t02-s04 --cast chu-quan --at 3.2 --cup 8,-254,-76              # cốc trên bàn, một tay
```

| Cờ | Làm gì |
|---|---|
| `--scene <id>`, `--cast <id>`, `--at <giây>` | Cảnh, người rót, giây cảnh clip bắt đầu (bình đưa tới từ 0,6 s, sự kiện `pour` ở 1,26 s sau đó; clip dài 3 s rồi giữ) |
| `--cup <…>` | Đích rót (slot `cup`, chỉ theo cờ): vật mang `vessel` — `<người>` cầm món mang `vessel` (hai tay đều mang thì tay phải, kèm dòng in), `<người>:<món>`, `<món>` của `items[]`, `<vật>` của cảnh three (đọc ở từng giây mẫu) —, đích là tâm miệng `mouth.at`; hay `x,y,z` thế giới rig (đích dạng điểm, không có luật miệng). Món, vật không mang `vessel` là lỗi kèm danh sách món, vật mang `vessel` trong cảnh. Lệnh tự đo điểm ấy trong quãng rót so với mốc `chest` của người rót |
| `--style single \| serve` | Một tay (mặc định; vòi vào giữa thân) hay mời khách hai tay (tay trái đỡ đáy); số mặc định là bảng `SINGLE` / `SERVE` của bộ chung |
| `--tilt <độ>` | Góc nghiêng hết: bình đầy `60–70`, gần hết `100–120`; mặc định `100` / `88` |
| `--pour-dir <độ>` | Hướng rót — mặt phẳng đứng chứa bình và cốc —, độ từ ra ngoài về trước (`180` vào giữa thân, `30` trước-phải); mặc định theo kiểu. Hướng đã chọn không đạt bộ lõi (cổ tay, tầm với, khuỷu, tiếp xúc) thì lệnh thử `±10`, `±20`, `±30`, `±45` và **báo** hướng gần nhất làm được, không đổi lặng; dòng `check` (`clash`…) không dự vào việc chọn hướng — tay lấn thân thì tự chọn `--pour-dir` theo gợi ý |
| `--name <tên>` | Tên file, mặc định `pour[-serve]-<cảnh>-<người>-3d`; file có sẵn chỉ đè khi chính `gen` sinh nó |
| `--item <món>` | Bình (slot `bottle`) khi tay phải giải phẫu của người rót chưa cầm gì ở giây ấy (mặc định `binh`) |
| `--force`, `--dry-run` | Ghi dù tự kiểm không đạt (kèm cảnh báo) hay đè file soạn tay; chỉ tính và in |

**Bình** là món mang vai trò `pourer` ([13](13-vai-tro-do.md#31-pourer--vật-rót)): điểm rót `lip`, hướng rót `spout` (suy từ
`lip` lệch trục). Thiếu thì lỗi "món `am-tra` không khai vai trò `pourer` — thêm `roles: [{ role: "pourer", lip: … }]` vào
held/am-tra.json". Bộ rót giải phần cầm (`world.hands[].hold.part`, không thì đoạn bám dài nhất ngoài khối chứa `lip` đạt
nhóm `cylinder` với cỡ tay người rót; hai đoạn dài ngang nhau là lỗi), trục bình (trục khối trụ tiện ấy, hướng về `top`),
`along` (`POUR_ALONG` `0,3`) và `around` (của kiểu cộng góc từ `ρ(0)` tới `spout`: ấm vòi `+x` cầm đúng như chai vòi `+z`).
**Chỗ cầm bình** đọc ở `world.hands[].hold` tay phải của người rót tại giây ấy (`item`, `part`, `along`, `around`, `both`…),
phải có `keep` (bình theo cổ tay của hành động); nhờ vậy chỗ cầm lúc tính và lúc diễn là một. Cảnh chưa khai thì lệnh dùng
chỗ cầm mặc định (phần cầm, `along`, `around` đã giải), kiểm với nó từ giây `0` và in đúng mốc `hands` ấy (`t: 0`) để dán;
dời `t` thì chạy lại. Số đo bình không ghi cứng: vòng một ước lượng liên kết tay–bình từ vai trò (bán kính thân ở `along`,
`lip` so với điểm cầm), vòng hai đo lại trên chính người rót trong cảnh (bình nào khai `pourer` cũng được: chai bia, ấm,
bình sake).

**Tự kiểm** (`gen-check.mjs`, dùng chung cho mọi kiểu; mỗi kiểu khai điểm tiếp xúc phải giữ và quãng khuỷu phải đi một
chiều). Chạy hành động vừa sinh trong chính cảnh ở đúng giây, đo bằng phép đo của `check`, in bảng ngắn:

| Luật | Đo | Ngưỡng |
|---|---|---|
| cổ tay | `handReport`: xoay, gập, lệch cổ tay vẽ ra so với kẹp (`TURN_MAX`, `AIM_BEND`, `AIM_DEV`) | vượt kẹp là lỗi; còn cách dưới `HELD_WRIST` `5°` là cảnh báo |
| tầm với | khe từ bàn tay tới đích (`AimReport.reach.gap`) | quá `AIM_GAP` `6` nhân `world.s` là ngoài tầm |
| khuỷu một chiều | `φ` của khuỷu quanh trục vai → cổ tay trong pha nâng đuôi và pha dựng lại | lùi quá `ELBOW_BACK` `2°` là lỗi |
| điểm tiếp xúc | điểm rót `lip` của bình (`actHeld`) so với đích rót, mỗi khung `1/30 s` suốt quãng rót | lệch quá `HELD_TOUCH` `1` là lỗi (thường `≤ 0,4`: điểm rót lắc nhẹ giữa hai mốc) |
| điểm rót trong miệng | đích là vật đựng: hình chiếu của `lip` lên mặt miệng so với tâm miệng suốt quãng tiếp xúc (đo một điểm, không đo cỡ vòi) | ra ngoài `mouth.r` là cảnh báo |
| `check` move/clash/held/roles | `checkScenes` trên cảnh có và không có hành động, chỉ giữ dòng mới hay nặng hơn (`compareBaseline`); cần `stickman.world` cho `clash`, `held`, `roles` | dòng mới chặn ghi, trừ dòng chỉ báo: luật `held` về độ ôm của chỗ cầm (`oppose`, `sink`, `grip`…, thuộc nhóm cầm), bình lấn bàn tay đang cầm cốc và bàn tay cầm bình lấn cốc khi mọi quãng lấn nằm trong lúc bình ở trên cốc (chỗ tiếp xúc của chính động tác), bình chưa `provide` khi cảnh chưa khai `hold`. Bình lấn cẳng tay, thân người cầm cốc hay lấn ngoài quãng ấy (lúc tay vung bình lên) thì chặn |

Không đạt thì thoát mã `1`, không ghi, in lý do và gợi ý: ngoài tầm kèm cốc cách vai bao nhiêu theo ba hướng ("cốc cao hơn
vai 12: hạ cốc hay cho người rót ngồi thấp", "cốc ở trước vai 70: dời người rót lại gần ~18"); tay lấn thân hay đồ thì thử
`--pour-dir` khác hay `--tilt` nhỏ hơn. Đạt thì in file đã ghi, clip để dán vào track của người rót (`{ "action", "start" }`)
và, khi cảnh chưa khai, mốc `hands`. Cốc dời quá `1` trong quãng rót (người nhận còn đưa tay) thì cảnh báo: rót theo chỗ trung
bình — đặt `--at` sau khi tay người nhận đã yên.

Lệnh dựng runtime với hành động chưa ghi đĩa (`checkScenes({ actions })`), nên không để lại gì khi không đạt. `note` của file
sinh ghi cảnh, người, giây, chỗ cốc, hướng và chỗ cầm; cốc hay người rót đổi chỗ thì sinh lại, không sửa tay.

### Ngồi theo ghế của cảnh

`sit-3d` giả định mặt ngồi cao bằng gối (`87,5` ở `height` 1) và đùi người mẫu: ghế thấp hơn thì bàn chân lún sàn, cao hơn
thì lơ lửng, người đùi dày thì lệch thêm. `stickman gen sit` sinh dáng ngồi nền lặp thở (`end: "wrap"`, `3,4 s`, thân `+1`
ở nửa nhịp như `sit-3d`) cho đúng một người ở đúng ghế của cảnh:

```bash
pnpm exec stickman gen sit --scene t02-s04 --cast khach                                   # vuông góc, lưng thẳng, tay trên đùi
pnpm exec stickman gen sit --scene t02-s04 --cast khach --legs staggered --back recline   # tựa vào lưng ghế của chính ghế
pnpm exec stickman gen sit --scene t02-s04 --cast chu-quan --at 6.6 --hands table --table ban-tra
pnpm exec stickman gen sit --scene t03-s01 --cast khach --legs bent                       # ghế bar: thanh để chân của ghế
pnpm exec stickman gen sit --scene t03-s01 --cast khach --footrest none                   # ghế bar, bàn chân xuống sàn
pnpm exec stickman gen sit --scene t02-s04 --cast khach --hands armrest --elbow 8         # khuỷu trên tay vịn, dời ra trước 8
pnpm exec stickman gen sit --scene t02-s04 --cast khach --hands fold --top far            # bàn tay chồng trước bụng
```

| Cờ | Làm gì |
|---|---|
| `--scene <id>`, `--cast <id>`, `--at <giây>` | Cảnh, người ngồi, giây clip bắt đầu (mặc định `0`). Người phải đang ngồi ở giây ấy (`world.sit` hay mốc `sit` của `path`) suốt một nhịp; điểm ngồi (`at` của chỗ ngồi: điểm trên mặt ngồi dưới khớp hông), hướng, `world.s`, `height` và `body3()` của nhân vật lấy từ cảnh |
| `--legs <kiểu>` | `square` (mặc định) vuông góc, ống chân đứng; `bent` co, bàn chân lùi dưới mép ghế, ống chân ngả sau `34°`, gót nhấc; `straight` duỗi, cẳng chân đưa ra trước `42°`, gót trên sàn; `staggered` so le — một chân co, một chân duỗi |
| `--tuck near \| far` | Chân co của `staggered`, theo ống kính: mặc định `far` (chân xa co dưới ghế, chân gần duỗi ra trước — nhìn ngang và 3/4 thấy cả hai chân). Đi với kiểu chân khác là lỗi |
| `--feet free \| floor` | `free` (mặc định): đế giày chạm sàn hay để chân nếu với tới, không thì chân `square` thõng (kiểu khác là lỗi); `floor`: bắt buộc chạm, không được là lỗi nói vì sao (đùi lún mép trước mặt ngồi, hay ngoài tầm kiểu chân) kèm gợi ý. Hông không bao giờ dời |
| `--back <kiểu>` | `upright` (mặc định) thân `3°`; `recline` tựa ra sau — có lưng ghế (của chính ghế hay `--backrest`) thì ngả tới khi lưng cách mặt trước lưng ghế `0,5` (mặt nghiêng chứa `from → to`, trong `−24…−4°`), không thì `−12°` kèm cảnh báo (không gì đỡ lưng); `forward` nghiêng về trước `16°`. Ngả, nghiêng thì đầu gật bù phần góc thân (mắt vẫn nhìn ra trước) và hành động ghi thêm `head` |
| `--hands <kiểu>` | `thighs` (mặc định) lòng tay úp trên đùi (mốc `thigh`, dời về phía gối theo kiểu lưng và hạ theo mặt đùi dốc; lòng tay áp mặt trên đùi từng bên — chân so le hai đùi khác góc —, ra ngoài đỉnh đùi thì nghiêng theo mặt cong; tay không với tới thì lùi về phía hông; cẳng tay lấn bụng quá nửa `PIERCE_TOL` thì lòng tay dời ra ngoài đùi tới `16`, chỉ tới chỗ hai tay còn với tới); `table` hai tay úp trên mặt bàn (bàn trước mặt hay `--table`) — giữa lòng tay ghim trước vai (khép vào `0,8` bề rộng vai, cánh tay lấn ngực thì dang ra), vào trong mép gần `14` rồi xa thêm tới khi khuỷu cao hơn cổ tay, đứng yên trên mặt suốt nhịp thở; khuỷu gập dưới `ELBOW_BEND` `40°` (tay duỗi chống bàn) thì lùi về sát mép tới `6`, vẫn dưới là lỗi kèm khoảng dời bàn hay ghế cho khuỷu gập đủ; `armrest` khuỷu và cẳng tay trên tay vịn (hai tay vịn của chính ghế hay `--armrest`, [13](13-vai-tro-do.md#34-armrest--tay-vịn)) — khuỷu cách vai đúng cánh tay trên, ở chỗ tự nhiên trước vai, cẳng tay nằm dọc tay vịn (khuỷu gần đầu trước thì cẳng tay xoay vào trong), bàn tay thả úp, ra khỏi tay vịn thì buông xuống; `fold` hai bàn tay chồng trước bụng dưới: tay dưới `flat` hờ, ngón vào đường giữa, tay trên áp lòng lên `otherBack` của tay dưới; khuỷu mở, được lệch qua mép ngoài tới `0,5` bán kính khuỷu. Không tìm được tiếp xúc tay trong `2 · s`, khe khuỷu với chỗ tì quá `2 · s` hay lấn thân quá `2 · s` thì lỗi |
| `--elbow <số>` | `armrest`, `fold`: dời khuỷu dọc tay vịn khỏi chỗ tự nhiên, rig ở `height` 1 (dương ra trước). Bù bằng chỗ khuỷu trên bề ngang tay vịn rồi góc thân trong tầm của kiểu lưng (`upright` `−3…9°`, `forward` `10…24°`, `recline` không lưng ghế `−20…−6°`; tựa lưng ghế thì thân cố định). Không đặt được là lỗi nêu tầm dời được ("Dời được trong −5,2…14,2") |
| `--top near \| far` | `fold`: bàn tay gần hay xa ống kính nằm trên (mặc định `near`) |
| `--table <vật \| vật#mục \| y \| y,mép gần \| none>` | Bàn (slot `table`, vai trò `tabletop`): tên vật, hay đồ ảo — `y` thế giới của mặt bàn kèm mép gần trước hông (mặc định `80`, bàn sâu `90`, rộng `220`, dày `6`, nhân `height`·`s`); `none` không kiểm bàn. Không cờ thì bàn trước mặt trong tầm (mép gần trước hông dưới `150`, mặt trên cao hơn mặt ngồi `20…90`, nhân `height`·`s`; hai bàn gần ngang nhau là lỗi): `--hands table` đặt tay lên nó, kiểu tay khác vẫn kiểm gối, đùi dưới mặt bàn |
| `--armrest <vật \| x,y,z>` | Tay vịn (slot `armrest`, mỗi bên người đúng một mục; tay đặt lên nó khi `--hands armrest` hay `fold`, tay khác thì cờ vẫn được giải — tên vật, số sai là lỗi — và ghi vào kết quả): tên vật (không nhận `#mục`; thiếu một bên là lỗi "`ghe-don` chỉ có tay vịn bên phải"), hay đồ ảo — điểm thế giới giữa mặt trên đầu trước một tay vịn, tay kia đối xứng qua hông, dài `110`, rộng `12 · s`. Không cờ thì hai tay vịn của chính ghế |
| `--backrest <vật \| vật#mục \| khoảng \| none>` | Lưng ghế (slot `backrest`): tên vật, hay đồ ảo — khoảng từ hông lùi tới mặt trước lưng ghế đứng (dải cao `24…80` trên mặt ngồi); `none` không tựa. Không cờ thì lưng ghế của chính ghế, sau hông |
| `--footrest <vật \| vật#mục \| y \| none>` | Mặt đỡ bàn chân thay `world.floor` (slot `footrest`): tên vật, hay đồ ảo — bệ ở `y` thế giới dưới hông, `400 × 400`; `none` đặt bàn chân xuống sàn. Không cờ thì để chân của chính ghế (thấp hơn mặt ngồi). `sâu` dưới `40 · s` là thanh (ghế bar: bàn chân đặt sao cho thanh nằm dưới đế giày, giữa gót và mũi), rộng hơn là bệ |
| `--name`, `--force`, `--dry-run` | Như `pour`; tên mặc định `sit-<cảnh>-<người>-3d` |

**Đồ của ghế** tìm theo vai trò ở giây `--at`, trong hệ người ngồi (tiến, lên, sang phải). Mặt ngồi (`seat`) là mặt chứa hình
chiếu của điểm ngồi (nới `2 · s` quanh mép) mà độ cao lệch điểm ngồi dưới `3 · s`; hai mặt cùng đạt là lỗi ("mặt ngồi chồng
nhau"), có mặt chứa hình chiếu mà lệch từ `3 · s` là lỗi kèm độ cao cần đặt (`world.at[1]`). Lưng ghế, tay vịn, để chân lấy
của **cùng chủ** với mặt ngồi (so chủ, không so tên vật): ghế đẩu đặt sát tường không mượn tường làm lưng ghế. Không có mặt
ngồi khai vai trò thì mặt ngồi là mặt ngang qua điểm ngồi, không kiểm mép, kèm dòng in; slot dùng-nếu-có không tìm thấy
thì đi nhánh không có kèm một dòng in (lưng không tựa, bàn chân trên `world.floor`). Mỗi mục được chọn giữ danh tính (chủ
cộng mục): tự kiểm đọc lại hình của chính mục ấy ở từng giây mẫu, mục dời quá `1` trong nhịp thở thì cảnh báo. Phép đo của
bộ sinh đọc mục vai trò, không đọc khối: khe gối dưới bàn đo trên `tabletop`. Repo không khai `stickman.world` thì chỉ có đồ
ảo của cờ số. Có mặt ngồi thì dòng in thêm chỗ ngồi: "ngồi trên `ghe-dai`, hông cách mép trước 38, cách mép sau 61, cách mép
trái 40".

**Chân**: hông ngồi cao hơn mặt ngồi `body3(c).legHalf`, không bao giờ dời; góc đùi giải sao cho đế giày (viên nang giày
của người 3D mặc đồ ở cổ chân, bàn chân tự nằm ngang tới khi ống chân lệch quá `28,6°`, quá thì nghiêng theo phần dư) chạm
mặt đỡ. Lệnh thử góc ống chân "nhiều" — trong tầm của kiểu, từ góc ưng ý ra hai đầu — rồi "ít" — chân co, chân duỗi dựng
ống chân dần về phương đứng ngoài tầm, tới biên tầm chân vuông `±10°` (dòng in ghi "ống chân co dựng tới -13,5° (ngoài
tầm kiểu)") —, nhận góc đầu tiên có góc đùi trong tầm: cận trên `112°` (`90` đùi nằm ngang, quá `90` là gối cao hơn hông),
cận dưới là góc đùi chúi tới khi mặt dưới đùi lún mép trước mặt ngồi `4 · s` — hông càng gần mép trước, đùi càng chúi được
([13](13-vai-tro-do.md#33-seat--mặt-ngồi); không có `seat` thì `60°`). Chân co, chân duỗi không chạm được thì lỗi, kể cả
`--feet free`. Chân so le: mỗi chân thử kiểu của nó; một chân không chạm được thì về vuông (dòng in ghi "chân xa về vuông:
kiểu `bent` không chạm …"), cả hai không được thì lỗi. Chỉ chân vuông **thõng**: `--feet free` mà mặt ngồi cao quá thì đùi
nằm trên mặt ngồi (vừa chạm mép trước), ống chân đứng mà không cắt mép trước, bàn chân hở trên mặt đỡ (dòng in ghi khe).
Khe dưới `DANGLE_MIN` `6 · s` trông như hụt chân: lệnh thử các góc ống chân trong tầm cho hở thêm; vẫn không được thì giữ
khe kèm cảnh báo. `--feet free` cho chân vuông thõng khi thanh để chân hẹp không nằm dưới bàn chân; khe đo tới
`world.floor`. Không có góc ống chân qua mép thì lỗi, không dời hông. Chân không chạm được (trừ chân vuông thõng) hay ghế
thấp quá thì lỗi, không ghi:

```text
lỗi: chân kiểu `square` chạm sàn y 0 thì đùi phải chúi 9.6° dưới phương ngang, mà mép trước `ghe-thu` cách khớp hông 65.7 chỉ cho chúi tới 7.4° (mặt dưới đùi lún mép quá 4) — ở đó đế giày còn hở 3.1 (ống chân 0°). Gợi ý: --feet free (chân thõng); hạ mặt ngồi hay --footrest <vật | y>; đặt điểm ngồi gần mép trước hơn (đùi chúi được nhiều hơn). Không ghi file.
lỗi: chân kiểu `bent` chạm sàn y 0 thì đùi phải chúi 49.9° dưới phương ngang, mà mép trước `ghe-thu` cách khớp hông 65.7 chỉ cho chúi tới 7.4° (mặt dưới đùi lún mép quá 4) — ở đó đế giày còn hở 43.8 (ống chân -10°). Gợi ý: --legs square (chân thõng); hạ mặt ngồi hay --footrest <vật | y>; đặt điểm ngồi gần mép trước hơn (đùi chúi được nhiều hơn). Không ghi file.
lỗi: mặt ngồi thấp hơn tầm chân kiểu `square` 7.4 (hông cao 61.9 trên sàn y 0, gối gập tới 69.3). Gợi ý: dùng --legs bent hay straight; nâng mặt ngồi. Không ghi file.
```

Ghế bar mặt ngồi `150` không với tới sàn ở kiểu nào: chân vuông thõng, hay khai thanh để chân (`--footrest`). Thiếu `world.floor` (và không có
`--footrest`) là lỗi kèm gợi ý.

**Tự kiểm** thêm hai luật dùng chung của `gen-check.mjs` vào cổ tay, tầm với (hai tay) và `check` (cả nhóm `roles`); có
mặt ngồi thì thêm luật mặt ngồi và đùi lún mép trước; chân thõng thì luật chân thõng; `table` thêm luật khuỷu gập:

| Luật | Đo | Ngưỡng |
|---|---|---|
| mặt ngồi | mỗi `0,25 s` trên hình của chính mục mặt ngồi ở giây ấy, giữ giây tệ nhất: điểm ngồi so với mặt ngồi; đuôi mông (khối thân `markShape` ở tầm hông cộng phần nhô sau của áo `backExtra`) so với mép sau, hông `± (hipHalf + nửa đùi)` so với hai mép bên; hông tới mép trước | lệch độ cao quá `1 · s` là cảnh báo, quá `3 · s` là lỗi; mặt ngồi không còn trong cảnh ở giây nào là lỗi; ra ngoài mép sau mà không chạm lưng ghế, ra ngoài mép bên là lỗi; hông tới mép trước dưới `⅓` đùi là cảnh báo (ngồi nông) |
| đặt trên mặt | đế giày (viên nang giày theo góc ống chân vẽ ra) so với mặt đỡ, mỗi khung `1/30 s` một nhịp; trên để chân thì đế giày phải nằm trên mặt hữu hạn của nó ở từng giây — bệ: gót và mũi chiếu xuống trong mặt; thanh: thanh dưới đế giữa gót và mũi, cổ chân trong bề ngang thanh; `table` thì điểm thấp nhất của bàn tay vẽ ra (`actPalms`) so với mặt bàn; tâm lòng tay phải nằm trong đa giác mặt bàn | đế giày lún quá `0,5` hay hở quá `HELD_TOUCH` `1`, ra ngoài để chân, bàn tay ngoài `−2…4`, cổ chân hay lòng tay trôi quá `1` là lỗi |
| đùi lún mép trước | mỗi `0,25 s`: mép trước mặt ngồi (từ từng khớp hông theo hướng mặt) so với mặt dưới đùi vẽ ra | lún quá `4 · s` là lỗi |
| chân thõng | đế giày so với mặt đỡ, mỗi khung | lún là lỗi; hở dưới `6 · s` là cảnh báo |
| lòng tay trên đùi | `thighs`: giữa lòng tay (`actPalms`) tới mặt đùi cùng bên (ống thon `CLAD_TAPER.leg`); hướng lòng tay so với pháp tuyến mặt đùi ở đó | khe ngoài `−3…3` hay lệch quá `30°` là lỗi |
| cẳng tay trên tay vịn | `armrest`, `fold`: mặt dưới cẳng tay (ống thon `CLAD_TAPER.arm`) phần nằm trên đoạn tới mặt tay vịn (qua mép trong thì tới mép); khuỷu trong đoạn, cách đường giữa không quá `width / 2 + 0,7` bán kính cẳng tay; `fold` đo khuỷu tại chỗ tì và lòng tay trên tới mu bàn tay dưới (khe `0…2 · s`) | khe ngoài `−4…2` (nhân `s`) hay khuỷu ra ngoài là lỗi |
| khuỷu gập | góc giữa cánh tay và cẳng tay (`actJoints`, `0°` là tay thẳng) của hai tay, nhỏ nhất trong nhịp thở | dưới `40°` là lỗi |
| không lấn | gối, đùi (cộng nửa bề dày ống quần) dưới mặt dưới bàn (`y + thick` của `tabletop`) trong đa giác mặt bàn; mặt lưng (khối thân `markShape`, cộng đai và nút obi của áo `wrap`) với mặt trước lưng ghế trong dải cao `from`–`to` và bề rộng của nó | khe dưới `0`: lỗi khi phép tính dùng vật ấy (lưng ghế khi `recline`, bàn khi `--hands table`) hay vật chỉ bằng cờ; cảnh báo khi vật chỉ tự tìm để kiểm (lưng ghế khi `upright`, `forward`; bàn khi tay không đặt lên bàn) |

Cẳng tay xuyên bụng, ống chân lấn mép ghế, chân ghế, chân bàn là dòng `clash` của `check` (cần `stickman.world`); chỗ lưng
dựa lưng ghế, tay đặt trên bàn thì vật khai `touch` (`{ part: "torso", max: 3 }`, `{ part: "hand", max: 4 }`) chứ không tắt
luật. Không đạt thì gợi ý theo nguyên nhân: tay lấn thân mình khác người lấn ghế, bàn; bàn tay hụt tầm hay tay duỗi
chống bàn, trôi, ra ngoài mép khác bàn tay không chạm mặt đo được (vật sai). Đạt thì in file và clip để thay clip nền ở giây `--at` của track đầu
(`{ "action", "start" }`, giữ `blend` của clip bị thay); cảnh chưa có clip ở giây ấy thì dán vào track đầu. Ghế, sàn hay người đổi thì sinh lại, không sửa tay.

### Tờ thử

`stickman gen sit --sheet` soi bộ sinh không cần cảnh: chạy khô mọi tổ hợp chân × lưng × tay trên **sân khấu thử** của trang
soi `sit` ([13](13-vai-tro-do.md#9-trang-soi-bộ-sinh)) — ghế, bàn, tay vịn chỉ là mục vai trò (`chairRoles`, `deskRoles`) dựng
hình bằng `propOf`, đi qua `run` với `o.stage` như Studio 3D —, mỗi ô tự kiểm như lệnh thường (kể cả `clash` trên hình đồ
thử) rồi vẽ ảnh three cùng đồ thử ấy, ghép một tờ — cột là kiểu chân, mỗi ô ghi tổ hợp và `đạt` (xanh) hay lý do không đạt
(đỏ); ô không sinh được chỉ có chữ. Tham số của ô là mặc định của trang (lưng ghế bật), bàn khi tay trên bàn, tay vịn khi
tay trên tay vịn. Không ghi `actions/`, không đọc `stickman.world` của repo.

```bash
pnpm exec stickman gen sit --sheet                                     # 36 tổ hợp, ghế 87,5, sample-man → tmp/gen/sit-sheet.png
pnpm exec stickman gen sit --sheet --hands table --seat 70,87.5,105    # tay trên bàn ở ba độ cao ghế
pnpm exec stickman gen sit --sheet --character sample-heavy --back recline --angle side
pnpm exec stickman gen sit --sheet --hands armrest --depth 50,85 --elbow -5,0,10      # khuỷu trên tay vịn: ngồi sâu, ra mép, dời khuỷu
pnpm exec stickman gen sit --sheet --hands fold --arm-out 50 --angle front
```

| Cờ | Làm gì |
|---|---|
| `--legs`, `--back`, `--hands` | Danh sách `a,b` của kiểu (bỏ trống là mọi kiểu) |
| `--depth <số,…>`, `--elbow <số,…>` | Danh sách chỗ ngồi (hông tới mép sau, mặc định của trang) và số dời khuỷu (mặc định `0`), rig ở `height` 1: mỗi số một hàng ô |
| `--feet`, `--top`, `--arm-top`, `--arm-out`, `--arm-front` | Một giá trị cho mọi ô: bàn chân, bàn tay nằm trên của `fold`, số đo tay vịn của trang |
| `--seat <độ cao,…>` | Mặt ngồi, rig ở `height` 1 (mặc định `87,5` — ghế của `sit-3d`); bàn cao hơn mặt ngồi `55`, mép gần trước hông `80` (`PREVIEW_DESK`), tay vịn `PREVIEW_ARMREST`, hông cách mép sau (mặt trước lưng ghế) `CHAIR_BACK` `55`, nhân `height` — mặc định trong `params` của trang |
| `--character <tên>` | Nhân vật hai lớp (mặc định `sample-man`) |
| `--angle front \| near \| far \| side \| back` | Góc máy quanh người (mặc định `near`, 3/4 phía tay phải) |
| `--at <giây>` | Giây vẽ trong nhịp thở (mặc định `0`) |
| `--out`, `--size`, `--cols`, `--software` | Tờ (mặc định `tmp/gen/sit-sheet.png`), cỡ một ô (`960`), số cột, vẽ phần mềm |

stdout in mỗi tổ hợp một dòng kèm lý do. Đổi số của bộ sinh (`gen-sit.mjs`, `gen.mjs`) thì chạy tờ trước và sau, so bằng mắt.
Phép giải theo vai trò trên tờ trùng phép giải với đồ thật khai cùng vai trò; `clash` đo trên hình thật của từng vật nên đồ
thật khác hình thử có thể thêm dòng `clash`.

### Đi theo các điểm sàn

`stickman gen walk` ([14](14-di-muot.md#5-gen-walk)) không sinh hành động: nó viết **mốc `world.path`** và **clip đi / đứng**
của một track vào `scenes/<id>.json`, từ danh sách điểm sàn và tốc độ. Chuyển động — hông, chân, thân lái theo `path`, bo
góc, bước dừng, quay tại chỗ — do `sceneAt` của rig; bộ sinh lo hình học và giây sao cho rig đi đúng nhánh mượt của nó.

```bash
pnpm exec stickman gen walk --scene t04-s14 --cast haru --at 0 --start moving --to "500,0 500,-500"   # vào cảnh đang đi, rẽ 90° khi đang đi
pnpm exec stickman gen walk --scene t04-s14 --cast haru --at @di --to "500,0! 0,0"                   # đứng rồi đi, dừng, quay 180°, đi về
pnpm exec stickman gen walk --scene t04-s14 --cast haru --at 0 --to "525,0 525,-250 0,-250" --radius 125   # vòng chữ U không dừng
pnpm exec stickman gen walk --scene t04-s14 --cast haru --at 6.2 --to "-200,300!180"                  # nối đoạn sau mốc dừng, nhìn lại ở cuối
```

| Cờ | Làm gì |
|---|---|
| `--scene`, `--cast` | Cảnh, người 3D đi |
| `--to "<điểm> …"` | Điểm sàn `x,z` thế giới rig cách nhau dấu cách: `x,z` mốc giữa đường (rẽ khi đang đi: đích mềm tới `100°`, tới `135°` tự bo cung `max(125 · s, v / 120°/s)`, quá nữa là lỗi), `x,z!` dừng, quay tại chỗ tới hướng quãng sau rồi đi, `x,z!yaw` (chỉ ở điểm cuối) dừng rồi quay tới `yaw`. Điểm cuối luôn là mốc dừng |
| `--at <giây \| @mốc±s>` | Chỗ bắt đầu; bắt buộc khi người đã có `path`, đứng ở `world.at` thì mặc định `0` |
| `--start rest \| moving` | `rest` (mặc định): đứng yên ở `--at` rồi khởi hành — quãng đầu lệch hướng đứng từ `15°` thì quay rồi đi; `moving`: vào cảnh đang đi, `path` đủ tốc từ `--at`, clip đi `blend 0` (người chưa có `path` trước `--at`) |
| `--speed <v>` | Đơn vị thế giới mỗi giây dọc đường; mặc định tốc tự nhiên `actionStride · height · s / duration` của `--action`. Clip đi khai `cycle` khớp sải |
| `--action`, `--after` | Hành động đi tới (mặc định `walk`; phải có sải dương, ghi cả hai chân) và hành động sau mỗi mốc dừng (mặc định `stand-3d`; không sải), hai lớp |
| `--radius <r>` | Bo mọi góc rẽ khi đang đi bằng cung bán kính `r` (mỗi `30°` một mốc, `yaw` tiếp tuyến); dưới `v / 120°/s` là lỗi |
| `--turn-time`, `--turn-side` | Giây mỗi `90°` quay tại chỗ (`0,5…2`, mặc định `0,8`); chiều cú quay đúng `180°`: `auto` (giữa cú quay mặt về phía ống kính; máy thẳng trục thì trái), `right`, `left` — một cú `steps: 2`, nhịp cuối nối đi là chân phía quay |
| `--hold <giây>` | Đứng yên ở điểm cuối (mặc định `0,6`); cảnh phải dài tới mốc cuối cộng ngần ấy |
| `--track`, `--blend` | Track ghi clip (mặc định track đang lái chân lúc `--at`, không có thì `chan` mới ở đầu); `blend` của clip đi, clip sau (mặc định `0,3`) |
| `--dry-run`, `--force` | Chỉ tính và in (kèm `path`, clip dạng JSON); ghi dù tự kiểm không đạt |

- **Chỗ thay ở `--at`.** Mốc `path` từ `--at` trở đi và clip của track ấy từ `--at` trở đi bị thay; phần trước giữ nguyên,
  clip đang chạy lúc `--at` hết ở clip sinh đầu tiên. Người đứng ở `world.at` thì đổi sang `path`. Chạy lại cùng lệnh trên
  file đã vá không đổi byte nào; nối thêm một đoạn là lệnh mới với `--at` sau đoạn trước. Lỗi không `--force` nào bỏ qua:
  người đang đi, đang quay, đang ngồi lúc `--at`; mốc bị thay có `sit`; clip bị thay có `equip`; track khác ghi chân trong
  quãng sinh (đè clip đi).
- **Tự kiểm** trên cảnh đã vá trong bộ nhớ, quãng `[--at − 0,5; mốc cuối + --hold]`: số đo đi của `gaitTrace` (tốc hông, quay
  thân, chân trụ, nhịp chân, bám đường; chẩn đoán hướng thân, hai chân, bước dừng — [14](14-di-muot.md#32-bảng-số-đo)), mỗi số
  đo một dòng, quá ngưỡng `stickman.gait` là cảnh báo; và `check` `move`, `clash` (cần `stickman.world`), `held` (khi người
  cầm đồ) so với cảnh trước khi vá — dòng mới chặn ghi, trừ bàn chân người đi lún mặt sàn tới `4 · s` (đế giày của
  bước đi chạm sàn, dòng chỉ báo); lấn tường, cạnh đồ vẫn chặn.
- **Ghi** như Studio 3D lưu cảnh ([Studio 3D đọc repo video](#studio-3d-đọc-repo-video)): vá JSON thô (chỉ `world.path`,
  bỏ `world.at` / `world.yaw` khi đổi sang `path`, và `tracks` của người ấy), qua `parseScene`, đọc lại bytes so với hash lúc
  nạp — khác là lỗi "đổi trên đĩa trong lúc sinh", không ghi —, bản cũ ở `.bak`.
- **Đầu ra** in sự kiện (góc mềm, cung, dừng, quay tại chỗ) kèm giây, số mốc và clip, bảng tự kiểm, hai lệnh
  `stickman-render` cho mỗi sự kiện — dải khung dày `0,05 s` và ô nhìn từ trên có vệt hông, bàn chân
  ([14](14-di-muot.md#4-dải-khung-dày-quanh-chỗ-rẽ)) —, và lệnh chạy lại với `--at` đã giải.

## Studio 3D đọc repo video

`@stickman3d/cli` mang Studio 3D, mở tại chỗ trong repo video:

```bash
pnpm studio      # = pnpm exec stickman studio: Studio 3D, http://localhost:5180
```

`--port` đổi cổng.

Dev server Vite (Vite đi theo `@stickman3d/cli`) chạy app `apps/studio3d` với gốc là thư mục đang đứng: xem cảnh three
của `scenes/` (cùng `stickman.world` mà Remotion vẽ), soạn kiểu cầm, chỉnh dáng ngón của tay không cầm đồ thành dáng có
tên của `hands/` ([01](01-rig.md#dáng-tay-có-tên)), sửa mốc tay và mốc món trên thanh tua (chế độ
**Dáng tay**: thêm, dời giữ mốc tên `@tên±Δ`, xoá, `ease`, `hold`, `pose`, `elbowLock`, xoá clip và đổi hành động của track, **Về tư thế buông** (mốc `rest`), một lịch sử hoàn tác chung, **Lưu**). Phím,
panel, cách soạn ở README của `apps/studio3d` trong repo rig.

- **Rig của trang là rig repo video đang nạp.** `@stickman3d/rig`, `fx` trỏ `link:` tới một cây nguồn thì trang
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
- **Chỉ trả lời localhost và tailnet.** Studio nghe mọi giao diện nhưng trả 403 cho máy ngoài `127.0.0.0/8`, `::1` và dải
  Tailscale (`100.64.0.0/10`, `fd7a:115c:a1e0::/48`); mở bằng IP tailnet hay tên `*.ts.net`. `--host <địa chỉ>` nghe đúng
  địa chỉ ấy và bỏ chặn, mở trang ra mạng ấy cùng các đường ghi; chỉ dùng trên mạng tin được.

Studio đi cùng cli nên luôn khớp bản rig đã pin.

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
