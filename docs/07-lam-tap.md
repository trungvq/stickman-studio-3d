# 07 — Làm một tập

Rig dừng ở một cảnh. Nền và camera đã vào `SceneSchema` — chúng nằm gọn trong một
cảnh, xem [03](03-scene.md#camera) — nhưng cái timeline nối **thoại ↔ cảnh ↔ tiếng ↔
phụ đề** thì nối *nhiều* cảnh, và chỗ của nó là đây.

Tầng tập gồm `episodes/*.json`, `src/episode.ts`, `src/shots.ts` và
`src/Episode.tsx` trong scaffold Remotion; bảng slow-mo (`warpTable`) nằm trong rig. Nội dung riêng
của tập nằm trong repo video; file này chỉ quy định quy trình và định dạng chung.

## Thứ tự các bước và cổng kiểm tra

Mỗi bước kết thúc bằng một cổng kiểm tra:

1. **Kịch bản và chia cảnh.** Cổng: bảng shot đọc hết một lượt.
2. **Tạo hình.** Cổng không chỉ là `render_character` với `shrug` — nó là một
   **key art**: `pnpm still` một khung khó nhất, **có cả nền**, chốt art direction
   trước khi xây cảnh lên trên.
3. **Lời dẫn.** Cổng: nghe hết một lượt, rồi đóng băng.
4. **Dựng cảnh.** Cổng: dải ảnh, rồi khung thật.
5. **Hậu kỳ** — tiếng, phụ đề, thumbnail. Cổng: xem cả tập.

### Bước 1 không được quyền sửa rig

- Bước 1 chỉ ghi nhu cầu rig; không sửa code.
- Chốt danh sách cảnh trước khi tạo hình.
- Chỉ thêm năng lực rig có thể dùng lại ở nhiều tập; nhu cầu của một shot phải
  giải quyết trong repo video.
- Không chặn tiến độ tập để chờ năng lực rig mới.

## Bốn tầng xem, chia theo *ai* đang nhìn

| | Thấy gì | Của ai |
|---|---|---|
| `render_scene` / `render_action` | Dải ảnh tĩnh, mỗi ô một mốc; `stage: true` là cả khung, có nền, camera và hiệu ứng; `three` là khung three thật của cảnh 3D | **Agent** — nó không tua được, chỉ đọc được ảnh |
| `stickman-video` | mp4 nháp nửa cỡ bản chốt (`960×540`, khung dọc `540×960`), có nền, camera và hiệu ứng, không tiếng | Agent, để kiểm chuyển động |
| `remotion studio` | Cả cảnh, có nền có tiếng, tua được | **Người** |
| `remotion render` | mp4 chốt | Cuối |

**Remotion Studio là preview server, không phải editor.** Props chỉ mang id, dữ liệu
tra ở `data.ts`, nên nó **không ghi ngược props vào file**
và không kéo thả clip được; vòng lặp là sửa JSON → hot-reload → nhìn. Cẩn thận
một chỗ: kéo/zoom khung preview trong Studio **ghi CSS thẳng vào source**
(`translate`, `scale` trên `AbsoluteFill`) — thấy cảnh lệch hẳn đi thì xem
`git diff` trước khi đi tìm lỗi ở scene.

`pnpm still <id> --frame=N` chụp một khung cho agent; `pnpm frames <id> a,b,c-d [<id2> e,f …]`
chụp nhiều khung của nhiều cảnh trong một lượt bundle — [03](03-scene.md#remotion).
Studio chỉ thấy [phạm vi bundle](03-scene.md#phạm-vi-bundle): `stickman.scope` của
`package.json`, hay `STICKMAN_SCOPE=t03 pnpm remotion` cho một tập khác.

## Công cụ trong `tools/`

Đi theo scaffold, `stickman upgrade` chép lại. Bảng riêng của tập không nằm trong
`tools/` mà ở `episodes/*.json`, `sfx/*.json` và bản lời có tag — những chỗ `upgrade`
không đụng.

| Lệnh | Việc | Nguồn của tập |
|---|---|---|
| `pnpm frames` | nhiều khung, nhiều cảnh trong một lượt bundle — [03](03-scene.md#remotion) | — |
| `pnpm can-tay` | bảng ảnh cận bàn tay người 3D — [03](03-scene.md#lòng-bàn-tay) | — |
| `pnpm bang-cam` | bảng duyệt mọi kiểu cầm (món × kiểu × hai cỡ tay × ba góc), `--so` so hồi quy với bảng chuẩn — [03](03-scene.md#bảng-duyệt-kiểu-cầm) | `held/`, `CANH_3D["bang-cam"]` |
| `pnpm thumbnails [tập]` | chụp mọi thumbnail và biến thể — [Thumbnail](#thumbnail) | `episodes/*.json` › `thumbnail` |
| `pnpm tts` | lời dẫn VieNeu local — [Lời dẫn](#lời-dẫn) | `episodes/*.json` › `text` |
| `pnpm tts-blocks` | lời dẫn ElevenLabs theo khối, cắt cue theo timestamp ký tự — [Lời dẫn ElevenLabs](#lời-dẫn-elevenlabs) | `loi-dan-tag.md` (`--src`) |
| `uv run tools/len-giong.py <wav>` | nâng giọng cuối câu hỏi; `tts-blocks` tự gọi cho cue khai `len:` | file wav |
| `pnpm lipsync <tiếng> <tên>` | khẩu hình sinh từ lời — [Khẩu hình theo lời](#khẩu-hình-theo-lời) | file tiếng |
| `pnpm srt [tập]` | phụ đề — [Phụ đề](#phụ-đề-và-chữ-trên-hình) | `episodes/*.json` › `text` |
| `pnpm sfx` | tiếng động từ mẫu CC0 và tổng hợp — [Tiếng động](#tiếng-động) | `sfx/recipes.json` |
| `pnpm sfx-el` | tiếng động gen bằng ElevenLabs | `sfx/elevenlabs.json` |
| `pnpm sfx-loop` | bè lặp — [Bè lặp](#bè-lặp-một-thẻ-audio-cho-cả-chuỗi) | `sfx/loops.json` |
| `pnpm cut-torso` | cắt mảnh thân áo từ sheet về khung `torso` — [02](02-trang-phuc.md#cắt-thân-áo-từ-sheet) | sheet trong `assets/sheets/` |

Mọi lệnh Python nhận `--help`. `tts`, `sfx` và mốc chữ của `lipsync` chạy bằng
`.venv/bin/python` (VieNeu, numpy, faster-whisper); `tts-blocks`, `sfx-el`, `sfx-loop`
và `cut-torso` chỉ cần thư viện chuẩn cùng `ffmpeg` / `magick`. `len-giong` chạy bằng
[`uv`](https://docs.astral.sh/uv/), phụ thuộc (numpy, praat-parselmouth) khai ngay trong
file nên không cần `.venv`; thiếu `uv` thì `tts-blocks` dừng ở cue có `len:`. Key
ElevenLabs (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`) nằm ở `.env`, đã gitignore.

`assets/audio/` chia thư mục. `t<nn>/` là tiếng của tập `<nn>`: `tts-blocks` ghi cue vào
đó và khối gốc vào `t<nn>/khoi/` khi bản lời nằm ở `videos/<nn>-<slug>/`, bản lời ở chỗ
khác thì ghi thẳng vào `assets/audio/`. `sfx/` là tiếng động dùng chung giữa các tập —
`sfx`, `sfx-el`, `sfx-loop` đọc ghi ở đó. `giong.json` nằm ở gốc, chung cả kênh. `file`
của cue trong `episodes/*.json` tính từ `assets/audio/` nên ghi kèm thư mục:
`t03/n-0a-03.mp3`, `sfx/sfx-rung.mp3`.

`pnpm cut-torso assets/sheets/<sheet>.png <ten>-01 <ten>-02` tách sheet theo số tên,
căn từng ô vào khung `300×360` bằng đỉnh ngực, gấu và tâm ngực của mảnh tham chiếu
`tunic-02` của `GARMENTS`, ghi ra `tmp/cut/` để soi trước khi `add_piece`.
`--knee` đổi mốc trên sang chân dốc vai cho áo bụng phệ.

## Bảng thời gian của cả tập

`episodes/tap.json`, một composition Remotion cho mỗi file — như `scenes/`. Cảnh là
đơn vị **dựng**, tập là đơn vị **xem**.

**Khung của tập là khung của các cảnh nó chiếu**, không khai ở đây: mọi shot phải cùng
`scene.frame`, và cỡ composition suy ra từ đó — một tập toàn cảnh `tall` là một short
`1080×1920`. Trộn hai khung thì `stickman check` kêu và `Root.tsx` ném.
Xem [03 — Khung hình](03-scene.md#khung-hình).

```json
{
  "schemaVersion": 1,
  "name": "tap-01",
  "shots": [
    { "id": "mo", "scene": "canh-01", "to": 3.5,
      "audio": [{ "file": "cue-01.mp3", "at": 0.4, "text": "Ngày xưa có một người tiều phu" }] },
    { "id": "bo-cui", "scene": "canh-02", "from": 1, "overlap": 0.8,
      "slow": [{ "from": 1.5, "to": 2.2, "rate": 0.4 }] },
    { "id": "hao-quang", "duration": 1.2 }
  ]
}
```

| Trường của shot | Nghĩa |
|---|---|
| `scene` | Tên file trong `scenes/`, không đuôi. Bỏ trống là shot hiệu ứng và bắt buộc có `duration` |
| `from` `to` | Giây **cảnh**: cắt vào giữa một cảnh dài, hay dừng trước khi cảnh hết. `to` bỏ trống là hết cảnh |
| `duration` | Giây màn hình; bắt buộc khi không có `scene`, và đè mọi cách suy khác |
| `hold` | Giây đệm ở cuối, khi hình cần dài hơn tiếng |
| `slow[]` | `{ from, to, rate }` — giây cảnh **kể từ đầu shot**, `rate < 1` là chậm lại |
| `overlap` | Giây shot này chạy sẵn **sau lưng** shot trước: cú cắt rơi vào giữa một chuyển động đang đà, không phải vào frame đầu của nó. Không kéo dài tập, chỉ mount sớm |
| `audio[]` | `{ file, id, at, after, dur, loop, fade, text, volume }`, `file` tính từ `assets/audio/`, kèm thư mục con (`t03/n-01.mp3`, `sfx/sfx-rung.mp3`), `at` là giây màn hình tính từ đầu shot **hay `"@mốc+0.4"`** của cảnh shot đang chiếu. `id` để cue khác và `marks` neo vào (bỏ trống là tên file không đuôi, không thư mục); `after: { cue, offset }` là luật "vào `offset` giây sau khi cue kia dứt" — xem [Mốc có tên và retime](#mốc-có-tên-và-retime). `dur` là giây cue chiếm trên trục shot — hết `dur` là thẻ `<audio>` bị **tháo**; bỏ trống thì đo từ chính file. `loop` là độ dài một vòng của bè lặp, `fade` là `{ in, out }` giây — xem [Tiếng động](#tiếng-động) |
| `marks` | Luật đặt mốc có tên của cảnh theo tiếng: `{ "nui-dang": { cue, edge, offset } }` — xem [Mốc có tên và retime](#mốc-có-tên-và-retime) |
| `thumbnail` | Của cả tập, không phải của shot: `{ scene, at, zoom, origin, shift, lines[], font, size, tilt, ink, paper, shadow, accent, keep, variants }` — xem [Thumbnail](#thumbnail) |

**Camera không ở đây**, nó ở trong scene ([03](03-scene.md#camera)) — nếu để ở lớp
này thì dải ảnh và `stickman-video` không soi được cảnh nào dùng tới nó, mà đó là hai
tầng xem duy nhất agent dùng được.

`text` nằm **cùng chỗ** với `file`, để câu thoại chỉ tồn tại một bản: phụ đề suy ra từ
nó chứ không gõ lại.

**Xếp shot tách khỏi composition.** `shots.ts` là hàm thuần `layoutShots(ep, fps,
sceneDuration)`, `Episode.tsx` chỉ vẽ — vì **hai** thứ cần bảng xếp: composition trong
bundler, và công cụ sinh `.srt` chạy thẳng bằng node, không qua bundler.

**Mọi mốc khai bằng giây, không bằng frame.** Nhờ vậy đổi fps là sửa hằng `FPS` ở
`Root.tsx` và số khai lại trong `tools/srt.mjs`; kiểm bằng cách sinh lại `.srt` và so
từng byte. Riêng
chỗ cộng dồn độ dài các shot thì `layoutShots` cộng bằng **frame**, không bằng giây —
cộng giây rồi mới đổi là trôi frame.

**Shot xếp ngược trong DOM.** Shot sau nằm *dưới* shot trước, nên `overlap` cho nó
chạy sau lưng mà không đè lên hình đang chiếu; shot trước hết thì nó lộ ra, đang giữa
đà. Xếp xuôi rồi mount sớm là shot sau che mất shot trước đúng `overlap` giây.

**Studio chỉ dựng shot và cue quanh đầu đọc** (`NEAR` giây hai bên). `<Sequence>` ngoài
tầm không vẽ con, nhưng vẫn render lại **mỗi khung** vì nó đọc frame qua context, và ở
React dev của Studio mỗi lượt kèm `console.createTask`: tập 137 shot xem chỉ ~8 khung/giây
dù cảnh đang chiếu vẽ một mình được 40. Đổi lại timeline Studio chỉ liệt kê shot gần đầu
đọc; tua bằng thước thời gian vẫn tới mọi khung. Lúc render thì dựng đủ cả cây, để mốc
tiếng không phụ thuộc chỗ tab render bắt đầu.

**Slow-mo là hai đồng hồ, và chúng phải đọc chung một bảng.** `warpTable(slow)` dựng
bảng một lần rồi cả hai chiều tra nó: `sceneTime` (giây màn hình → giây cảnh) cho lúc
vẽ, `screenTime` (giây cảnh → giây màn hình) cho lúc đo độ dài shot. Bảng ấy nằm
trong **rig** (`timewarp.ts`) vì
`stickman check` cũng phải đo được độ dài một shot để so với tiếng.

**Bảng này cung cấp số cho người viết `clips[].start`; nó không patch ngược vào
scene.** File vừa gen máy vừa sửa tay là file không ai tin được nữa.

`stickman check` soi tham chiếu chéo của nó: shot trỏ vào `scenes/` có thật, cue trỏ
vào `assets/audio/` có thật, shot không có `scene` thì phải có `duration`.

Và nó **đo file tiếng thật**: cue nào dài hơn chỗ nó nằm thì bị cắt ngang, cũng không
lỗi nào nổ — chỉ mất nửa câu thoại. `check` lấy độ dài bằng `ffprobe`, độ dài shot bằng
chính `warpTable` ở trên, quá `0,05 s` mới kêu. Cue có `dur` thì đo theo `dur`: khai
`dur` là cắt **có chủ ý**, nên bè nền 24 s đặt trong shot 2,5 s không phải cue tràn.
Không có `ffprobe` trên `PATH` thì nó im, nên đừng đọc "không kêu" thành "đã đo".
Bè lặp còn bị soi thêm một nước — xem [Bè lặp](#bè-lặp-một-thẻ-audio-cho-cả-chuỗi).

## Mốc có tên và retime

Tiếng là thứ đổi nhiều nhất và đổi *cả khối*: thay một chữ là gen lại cả đoạn, độ dài
đổi, mọi mốc hình ghim theo bản mp3 cũ lệch theo. Cái phải rẻ đi là **dựng lại hình**,
và cách làm là **không ghim số, ghim luật**:

- Trong cảnh, thời điểm mà tiếng, hình và lớp vẽ code cùng phải khớp là **một mốc có
  tên** ở `scene.marks`; clip, camera, `fx` và lớp vẽ code neo `"@nui-dang+0.4"` vào nó
  ([03](03-scene.md#mốc-có-tên)).
- Trong tập, `shot.marks` nói mốc ấy **rơi vào đâu so với tiếng**:

```json
{ "id": "nui", "scene": "canh-05",
  "audio": [
    { "file": "dan-05a.mp3", "id": "dan-05a", "at": 0.3, "text": "Sơn Tinh vẫy tay…" },
    { "file": "sfx/sfx-rung.mp3", "after": { "cue": "dan-05a", "offset": -0.4 } },
    { "file": "dan-05b.mp3", "id": "dan-05b", "after": { "cue": "dan-05a", "offset": 0.6 }, "text": "…núi dâng lên" }
  ],
  "marks": { "nui-dang": { "cue": "dan-05b", "edge": "start", "offset": 0.2 } } }
```

`after` là luật cho `at` của một cue: vào `offset` giây sau khi cue `cue` (đứng trước
nó trong cùng shot) **dứt** — độ dài đo từ file, hay `dur` nếu có. `shot.marks` là luật
cho một mốc của cảnh: `edge` là lấy lúc cue vào hay dứt, `offset` cộng thêm; giây màn
hình đổi ra giây cảnh qua chính bảng slow-mo của shot.

**Luật ở tập, số ở chỗ vẽ.** `stickman retime` (`pnpm retime`) đo tiếng bằng `ffprobe`
rồi **ghi số** vào `at` của cue có `after` và vào `marks` của cảnh; chỗ vẽ — Remotion,
dải ảnh, MCP, `.srt` — chỉ đọc số, không đo gì, nên ba đường render và phụ đề không lệch
nhau và cảnh vẫn tự đứng được. `stickman check` tính lại từ luật và **cảnh báo khi số
đang ghi đã cũ**, nên quên `retime` không im lặng. `retime --dry-run` chỉ liệt kê;
`retime --mark canh-05:nui-dang=2.6` đặt tay một mốc. Nó sửa JSON thô, giữ thứ tự khoá
và mọi tham chiếu `@mốc`.

Cue `at: "@mốc"` thì ngược chiều: mốc của cảnh quyết định lúc tiếng vào, tiện cho tiếng
động bám hình (đá chạm đất). Nó giải lúc chạy từ `marks`, không cần `retime`.

Hai cue cùng file trong một shot phải có `id` riêng nếu luật nào neo vào — `check` kêu.
Cue ở tầng tập (`episodes/*.json` › `audio[]`) không có cảnh nào để tra `@mốc`.

## Lời dẫn

Mỗi lượt thoại là một file audio riêng trên timeline. Khoảng nghỉ phục vụ diễn
xuất nằm giữa các cue trong timeline tập, không phụ thuộc khoảng nghỉ do TTS tạo:
file cue cắt sát chữ, chỉ giữ đệm vài phần trăm giây ở hai đầu.

Quy tắc viết:

- Dùng dấu câu cho nhịp nói; dùng khoảng trống giữa cue cho hành động.
- Không dùng dấu chấm than, `?,` hoặc dấu ba chấm giữa câu.
- Đặt người nói trước lời, sau dấu hai chấm; không dùng ngoặc kép.
- Mỗi cue tối đa một từ chỉ cảm xúc.
- Không đọc lại điều hình ảnh đang thể hiện.
- Giữ lời trực tiếp và tính từ cần thiết.

`tools/tts.py` (`pnpm tts`) gen từng cue còn thiếu từ `text` của `episodes/*.json`
bằng VieNeu-TTS chạy local trong `.venv`, ghi `assets/audio/<file>` kèm
`<file>.json` (câu chữ, giọng, độ dài). Giọng, `atempo` và nhiệt độ là hằng số ở
đầu file — **một giọng cho cả kênh**. `pnpm tts voices` liệt giọng, `pnpm tts thu
"câu"` nghe thử ra `tmp/`.

Chọn giọng bằng cách nghe và đo tốc độ nói. Sau khi chốt giọng và audio, không
gen lại file đã căn timeline. Nếu cần đổi tốc độ mà giữ cao độ, dùng `atempo`
của ffmpeg (`--atempo` của `pnpm tts`).

VieNeu không trả timestamp. Mốc chữ thì đo:

```bash
ffmpeg -i cue.mp3 -af silencedetect=noise=-35dB:d=0.25 -f null - 2>&1 | grep silence_
.venv/bin/python tools/words.py assets/audio/cue.mp3      # mốc từng chữ, faster-whisper
```

Mọi mốc khẩu hình, camera hoặc hiệu ứng bám lời phải được đo lại khi file audio
thay đổi.

### Lời dẫn ElevenLabs

`tools/tts-blocks.py` (`pnpm tts-blocks`) có **ba chế độ**, khai ở từng khối.

**`mode: block`** (mặc định, cho Eleven v3). v3 lệch giọng nhiều nhất ở câu ngắn và không
có request stitching, nên các cue cùng một cung cảm xúc — hay cùng một nhân vật — đi chung
**một request**, rồi cắt thành file cue theo mốc từng ký tự của endpoint
`/with-timestamps`. Ranh giới khối đặt ở chỗ hình đã đổi cảnh **và** tông đã đổi, để nếu
âm sắc nhảy nhẹ thì nghe như chủ ý.

**`mode: stitch`** (cho model *có* stitching, `eleven_multilingual_v2`). Mỗi cue một
request, nối ngữ điệu bằng `previous_request_ids` (3 request gần nhất). Không phải cắt file
⇒ biên cue chính xác tuyệt đối, cue hỏng gen lại một mình nó (`--cue=<mã> --force`). Đây là
chế độ cho **lời dẫn dài, một giọng, đọc bình tĩnh**; v3 và `mode: block` để dành cho thoại
nhân vật.

**`mode: dialogue`** (nhiều nhân vật đáp lời nhau). Cả khối một request
`/v1/text-to-dialogue/with-timestamps`, mỗi cue một giọng, cùng một lượt lấy mẫu nên lượt
đáp nghe như đáp thật. Biên cue lấy từ `voice_segments` của API. Model là `model:` của
khối, mặc định `eleven_v3`.

Mọi chế độ ghi kèm mỗi cue `<mã cue>.json` có `alignment` từng ký tự, mốc tính từ đầu file
cue — dùng thay faster-whisper cho phụ đề và khẩu hình.

Bản lời có tag là file riêng ở gốc repo (`loi-dan-tag.md`, đổi bằng `--src`), không phải
`text` của `episodes/*.json`: tag như `[pause]` không được lọt vào phụ đề. Định dạng là
định dạng tool đọc:

````markdown
## k1 — Mở màn (voice: nare, mode: stitch)

**dan-01**
```
Ngày xưa có một người tiều phu. [pause] Nhà anh ở ven rừng.
```
````

Dòng `## ` mở một khối — luật và ghi chú trong file dùng `###` hay chữ thường. Dòng mở
bằng `**<mã cue>**` (ghi chú sau đó tuỳ ý) rồi khung code đầu tiên sau nó là một cue, ra
`assets/audio/t<nn>/<mã cue>.mp3` khi bản lời nằm ở `videos/<nn>-<slug>/`, không thì
`assets/audio/<mã cue>.mp3`; mã cue chỉ gồm chữ, số, `.`, `_`, `-`.

- Ngoặc cuối tên khối là tuỳ chọn của khối: `mode:`, `voice:`, `model:`, `bu:`, `sat:`,
  `noi:`. `voice:` tra `assets/audio/giong.json` — `{ "<khoá>": { "voice_id", "model",
  "voice_settings" } }`; đó là chỗ khoá giọng cho cả kênh. Không khai `voice:` thì dùng
  `ELEVENLABS_VOICE_ID`.
- Ngoặc cuối dòng mã cue là tuỳ chọn của cue: `**d-03** (voice: aya)` là giọng của lượt ấy
  ở `mode: dialogue`; `**n-0a-03** (len: 9)` nâng giọng cuối cue thêm 9 bán cung bằng
  `tools/len-giong.py` sau khi cắt. Engine hay đọc 「？」 như câu kể, hạ giọng ở mora
  cuối, và tag hay cách viết khác không cứu được — câu hỏi nào nghe như câu kể thì khai
  `len:`.
- `bu: <LUFS>` (vd. `bu: -19`) bù âm lượng từng cue lúc cắt, không tốn ký tự. v2 đọc khối
  dài thì mở to rồi nhỏ dần, sang khối mới lại bật về mức đầu, nên ranh giới khối thành cú
  nhảy khi không có thoại chen vào che. Tool làm trơn mức đo trong ±3 cue rồi kéo về đích,
  trần ±8 dB và không đẩy đỉnh quá −1 dBFS; chênh tự nhiên giữa hai câu liền nhau vẫn giữ.
  Bản nghe đã bù ghép từ cue ra `tmp/tts-cues-full.mp3`.
- `sat: 1` cắt cue **sát tiếng**: mặc định biên cue nằm giữa quãng lặng nên mỗi file mang
  nửa khoảng nghỉ ở hai đầu; tập tự đặt khoảng nghỉ giữa cue bằng `after` thì cần file sát
  tiếng.
- `noi: <khối>` (chỉ `mode: block`) gửi kèm `request_id` của khối ấy để model nối tiếp
  giọng thay vì khởi động nguội — không nối thì ranh giới khối nhảy 2–4 dB. Khối được nối
  phải gen trước, và request id chỉ sống 2 giờ. Nối từng khối thì ít mắt xích; nối từng câu
  như `mode: stitch` thì hàng trăm mắt và sai số âm lượng cộng dồn.
- Mã cue mở bằng `_` là **câu mồi**: vẫn gửi lên trong khối nhưng không ghi thành file.
  Dùng để kéo khối `mode: block` lên trên sàn khi lời thật quá ngắn (vài câu thoại của một
  nhân vật), đặt trước và sau phần thật.

- `mode: block`: mỗi khối **1200 đến 1600 ký tự, sàn cứng 900**. Dưới sàn v3 đổi chế độ đọc: khối ngắn
  nhanh hơn và to hơn khối dài, chênh tới 3 dB LUFS và gần 20% tốc độ. Trần một request
  là 5000. `pnpm tts-blocks --list` in số ký tự và kêu khối dưới sàn.
- Khối hỏng thì gen lại **đổi seed** (`--only=k3 --seed=7 --force`): cùng seed cùng tham
  số ra gần y bản hỏng. **Nhịp đọc sai thì đổi seed**, đừng sửa chữ và đừng kéo `atempo`
  — cùng một khối, khác lượt lấy mẫu, đã dài ngắn chênh nhau tới 16%.
- Khối đã gen nằm ở `khoi/<khối>.mp3` cạnh thư mục cue, kèm `.json` (chữ, giọng, seed,
  `request_id`, `alignment` cả khối, mốc cắt, LUFS). Lệnh không `--force` không gen lại
  khối đã có; `--cut-only` chỉ cắt lại, `--cut-only --only=<khối>` cắt lại một khối. Chữ
  trong bản lời khác bản đã gen thì tool kêu và vẫn cắt theo bản đã gen.
- Sửa tay `khoi/<khối>.json` rồi `--cut-only` cho hai việc mà không gen lại khối. Cue
  `"bo": true` là câu đã bỏ khỏi kịch bản: vẫn làm biên cho cue kề và vẫn vào phép đo
  `bu:`, chỉ không ghi file. Cue có `"rieng": { "seed", "request_id", "alignment",
  "nguon"?, "bu_db"? }` cùng `duration` là bản gen riêng — câu trong khối đọc hỏng, gen lại
  một mình (kể cả trên web): mp3 đặt tay ở `<mã cue>.mp3`, tool ghi sidecar từ `rieng` và
  không cắt đè. Cue `rieng` không có `t_start` là câu chèn thêm, không chiếm chỗ trong
  audio khối.
- Mốc của ElevenLabs là mốc **chữ**, không phải mốc tiếng: tool kéo biên giữa hai cue về
  quãng lặng gần nhất trong 0,35 s. Cắt xong nó đo RMS 0,15 s cuối mỗi cue: còn to hơn
  −35 dB là alignment sớm hơn tiếng thật — v3 trôi dần ở khối dài có tag — và cue mất chữ
  cuối. Đo lại biên cue ấy bằng `silencedetect`.
- Tool kêu **RỤNG CHỮ** khi alignment ghi đủ chữ mà audio chỗ ấy lặng tuyệt đối từ 0,25 s
  trở lên: v3, nhất là qua `/text-to-dialogue`, thỉnh thoảng nuốt cả cụm mang nghĩa mà mốc
  không lệch, tai nghe như một khoảng nghỉ. Gen lại khối ấy với seed khác.
- Bản nghe duyệt cả bài ra `tmp/tts-blocks-full.mp3`, các khối cách nhau 0,7 s lặng, kèm
  dải LUFS của các khối. Bản này là tiếng khối **chưa bù**; khối có `bu:` thì nghe
  `tmp/tts-cues-full.mp3`.

Tag v3 dùng được: `[laughs]` `[chuckles]` `[sighs]` `[exhales]` `[excited]` `[curious]`
`[angry]` `[whispers]` `[sarcastic]` `[mischievously]` `[slowly]` `[pause]`. Tag diễn cảm
ăn hay không tuỳ giọng — nghe từng chỗ, đừng tin tag.

### Khẩu hình theo lời

```bash
pnpm lipsync assets/audio/dan-01.mp3 tac-gia-dan-01          # ra actions/tac-gia-dan-01.json
pnpm lipsync assets/audio/dan-01.mp3 tac-gia-dan-01 --faster 1.2 --mood sad
```

`tools/lipsync.mjs` lấy mốc từng chữ bằng `tools/words.py` (faster-whisper, model `small`,
`--lang` mặc định `vi`, tiếng Nhật `--lang ja`; lưu ở `tmp/words/<băm file>.json`, `--force` đo
lại, `--words` dùng mốc có sẵn), đo `duration` bằng `ffprobe`, độ to bằng `ffmpeg`, rồi sinh hành
động chỉ ghi `face` (`mask: ["face"]`, `end: "hold"`), đi qua `ActionSchema` của rig trước khi ghi:

- một khẩu hình mỗi mora (chữ có kana) hay mỗi tiếng (chữ Latin), đặt đúng mốc đầu mora; âm chọn
  vai răng cắn / há vừa / tròn, mora to nhất mỗi 1,5 s của đoạn là há to, nghỉ 0,07–0,2 s là răng
  cắn, nghỉ từ 0,2 s khép — luật đầy đủ ở [01](01-rig.md#khẩu-hình-và-mắt);
- `--mood` chọn bộ: `neutral` (mặc định), `happy`, `sad`, `bored`, `angry`;
- `--step` là độ dài một mora ước cho kanji và nhịp chẻ tiếng Latin dài (mặc định 0,13 s),
  `--faster 1.2` chọn `step` cho số lần mấp máy gấp 1,2 lần bản mặc định.

Hành động chỉ ghi `mouth`, nên mắt và mày vẫn của lớp cảm xúc bên dưới. Trong cảnh, đặt
nó ở mốc cue với `cycle` bằng `duration` và `blend: 0`, rồi một clip trống ở
`"@mốc+duration"` để trả mặt về lớp dưới — tool in sẵn hai clip ấy. Thay file tiếng thì
chạy lại.

### Điệu bộ khi nói

Người nói diễn bằng một chuỗi tư thế giữ, không bằng vòng lặp: mỗi cú là một clip hành động
giơ một lần rồi giữ tới cú sau — bộ chung và cách xếp ba track (tay, nhịp thân, đầu) ở
[01](01-rig.md#điệu-bộ-khi-nói).

- **Mật độ:** `0,5`–`0,9` cú mỗi giây, giữa hai cú đứng yên ít nhất `0,5 s`. Không đặt hai cú
  cùng dạng liền nhau; liệt kê thì mỗi mục một tư thế mới (đổi tay, đổi bên ngả).
- **Chỗ đặt:** cú khởi ở đầu từ nhấn hay đầu cụm, không ở cuối từ. Nói về mình → `talk-chest`.
  Câu hỏi, phản bác → `talk-shrug` hoặc `talk-hands`, kèm `talk-tilt` ở track đầu. Chỉ người
  nghe → `talk-point-far`. Tay giữ mà câu cần một cú → `talk-beat` / `talk-beat-back` (ngồi:
  `talk-beat-seated`, người 3D ngồi `talk-beat-seated-3d`), hay `talk-sway`.
- **Vào và buông:** clip vào blend ~`0,3`; dấu chấm, chỗ ngắt dài thì clip rỗng blend ~`0,4`
  để tay về track dưới. Nhìn ống kính là `look-camera` ở track đầu, chồng được với `talk-tilt`
  và `talk-nod`.

## Phụ đề và chữ trên hình

Phụ đề phát hành bằng `.srt`, không burn vào video. `tools/srt.mjs` (`pnpm srt
[tập]`) sinh `out/<tập>.srt`: nội dung lấy từ `shots[].audio[].text`, frame shot lấy
từ chính `layoutShots` của `src/shots.ts` (một bảng xếp cho cả composition lẫn phụ
đề), mốc trong cue **đo** bằng `silencedetect` rồi khớp mảnh chữ vào đoạn tiếng
bằng quy hoạch động. Không duy trì bản chép câu chữ hoặc timestamp riêng.

Chữ có vai trò tạo hình mới được vẽ vào khung. Dùng chữ trắng, viền đen với
`paint-order: stroke`, không nền. Nếu chữ nằm trong `viewBox`, chia kích thước
và độ dày nét cho `camera.zoom` để giữ cỡ màn hình.

## Tiếng động

Dùng mẫu có giấy phép phù hợp, ưu tiên CC0. Kiểm giấy phép và `sha256` của từng
file; lưu nguồn và giấy phép trong JSON đi kèm. Tiếng phức hợp được ghép từ
nhiều lớp mẫu. Nhạc nền là asset riêng và phải được kiểm tra quyền sử dụng.

**Công thức ở hai lớp, như mảnh ảnh.** Thư viện nằm trong tool, `upgrade` chép lại: gói
CC0 (`PACKS`), các mã dùng lại được ở mọi tập (`LIBRARY` — nhát rìu, cú tõm, bước chân cỏ
và đá lát, phím cơ, bấm máy tính, bíp, pop, rè, gió, chuông), các hàm tổng hợp (`SYNTH`)
và hậu xử lý (`POST`). Công thức của tập nằm ở `sfx/`, `upgrade` không đụng; trùng mã thì
bản của tập đè. Mã thư viện chỉ được gen khi `episodes/*.json` hay `sfx/*.json` nhắc tới
nó, nên repo không ôm cả thư viện vào `assets/audio/sfx/`. Cú pháp từng file ở `--help` của
tool.

`pnpm sfx` đọc `sfx/recipes.json`: `packs` (gói tải được, kiểm `sha256`), `local` (mẫu tải
tay vào `tmp/sfx-src/<gói>/`, có thể CC-BY — `<mã>.json` là chỗ nhớ nghĩa vụ ghi công) và
`sfx` (mã → `layers` cắt, hệ số, trễ; hay `synth` gọi một hàm tổng hợp; cộng chuỗi `post`
như `weight` → `band` → `peak` → `fade`). Chọn mẫu bằng số đo phổ trước khi nghe; va chạm
thì chồng lớp mẫu thật, chỉ nhiễu (rè, gió), chuông nhỏ và tiếng máy mới tổng hợp. `start`
của mỗi lớp cắt sạch khoảng lặng đầu file. Chuỗi `post` nào cộng thêm năng lượng
(`weight`) phải kết bằng `peak`, không thì bị kẹp đỉnh lúc ghi.

`pnpm sfx-el` đọc `sfx/elevenlabs.json`: mỗi cue một prompt, `dur` xin, `loop`,
`influence`. `gen` ghi file thô vào `tmp/sfx-el/` kèm chi phí đọc từ header
`character-cost`; `ingest` cắt lặng đầu (bè lặp giữ nguyên mép), chuẩn đỉnh −1 dBFS như
`sfx.py`, ghi `assets/audio/sfx/sfx-<id>.mp3` kèm `.json`. Prompt tốt cho một cú: tả **một**
sự kiện, nói thẳng "starts instantly … one hit then silence", đuôi khô "no music, no
reverb" (`{instant}`, `{dry}` trong prompt), `influence` 0.6–0.7, và xin ngắn hơn đích
chừng 0,3 s vì API trả dài hơn xin. Model không giữ được nhịp đều: tiếng lặp theo nhịp thì
xin từng cú rời rồi lát bằng `sfx-loop`. Mẫu ElevenLabs thường thu xa — sáng, mỏng —
nên dùng làm lớp trong `sfx.py` thì `weight` rồi `band` mới ra khối lượng.

Mốc tiếng động lấy từ `events[]` của hành động qua `sceneEvents()`. Không lọc
clip theo tên hành động và không chép pha va chạm thành hằng số trong repo video.

### Bè lặp: một thẻ `<audio>` cho cả chuỗi

Cue nào cũng là một `<Sequence>` **có độ dài**, nên hết tiếng là thẻ `<audio>` bị tháo
khỏi cây: `dur` khai tay, bỏ trống thì `useAudioDurations` đo từ chính file. Đây là thứ
giữ preview chạy được — mỗi thẻ cùng lúc tốn cỡ 2,5–3 ms mỗi khung, một shot khai trăm
cue tiếng bước chân là preview tụt xuống 3-4 fps, và bấm Mute không đổi gì.

Chuỗi tiếng đều nhịp thì **đừng khai từng cue**. Khai một cue có `loop` (độ dài một
vòng) cùng `dur` (bè kêu tới bao giờ): `<Loop>` của Remotion chỉ giữ một vòng trên cây
tại mỗi khung. `loop` mà thiếu `dur` là lặp tới vô tận — `check` báo lỗi, `Episode.tsx`
ném ngay lúc dựng cây.

`fade` là `{ in, out }` giây trên trục của chính cue, `out` đo ngược từ hết `dur`. Âm
lượng tính theo frame của cả cue, nên bè lịm ở hai đầu `dur` chứ không lịm mỗi vòng —
trong lòng `<Loop>` thì frame đếm lại từ 0 mỗi vòng.

`tools/sfx-loop.py` (`pnpm sfx-loop`) dựng bè theo `sfx/loops.json` cộng vài bè bước chân
thư viện vào `assets/audio/sfx/`, hai cách: **lát** các tiếng rời đang có trong
`assets/audio/sfx/` (`hits`: tiếng nào, cách nhau bao lâu, mấy lần) hay **cắt** thẳng một
đoạn dài từ bản ghi thật (`cut`: nhịp lệch nhau tự nhiên, hai đầu vòng đặt ở chỗ lặng
giữa hai nhịp, nối bằng crossfade 30 ms rồi chuẩn về `lufs`).
Ba chỗ phải đúng, sai thì nghe rõ chỗ nối:

- **Ghi `.wav`, không `.mp3`.** mp3 có khoảng đệm của bộ mã hoá ở hai đầu, lặp lại là
  hụt một nhịp.
- **Độ dài vòng phải tròn frame** ở fps đang dùng (60 fps: 0,9 · 1,2 · 1,5 s), và `loop`
  bên `episodes/*.json` khai đúng số ấy. Lệch một phần khung là mỗi vòng trôi một tí.
- **Đuôi tràn qua mốc cuối vòng phải cộng ngược về đầu vòng** — dựng dài `2L` rồi gập
  nửa sau lên nửa đầu. Không gập thì tiếng cuối bị cắt cụt ở chỗ nối.

`check` dò quãng **cả sân khấu đứng yên** của cảnh trong shot — không ai trôi ngang và
không clip nào đang là hành động có sải chân (`stillSpans` của rig; người giậm chân tại chỗ
vẫn là đang bước) — rồi kêu khi một cue có `loop` phủ lên quãng ấy quá một giây. Đấy là
tiếng vó, tiếng bước còn chạy sau khi người đã dừng; chữa bằng cắt `dur` hay dời `at`. Cue
thường thì không hỏi: thoại nói trên nền người đứng yên là chuyện thường.

Đo đỉnh của bè ở float trước khi ghi `s16`: tổng nhiều tiếng chồng nhau vượt 1.0 là bị
kẹp, mà đo trên bản đã kẹp thì luôn ra -0,0 dB.

**Thay file tiếng thì phải restart Remotion Studio** trước khi nghe: độ dài đo được
sống theo vòng đời tab. Bảng đo khoá theo **URL** chứ không theo tên file, vì bundler
băm nội dung vào URL — khoá theo tên thì tab đang mở vẫn cắt cue theo độ dài cũ và bản
gen dài hơn bị cụt đuôi câu.

## Thumbnail

`episodes/<tập>.json` có `thumbnail` là Remotion có thêm composition `<tập>-thumb`
một khung. Khung là **một khung phim thật** — `<Scene at>` chạy đúng giây `at` của
`scene` — phóng `zoom` quanh `origin` và đẩy ngang `shift` cho mặt nhân vật chiếm một
góc, `lines[]` ăn góc kia. Chữ là SVG với `paint-order: stroke`, viền giấy bọc nét mực.
Font riêng để ở `public/fonts/<file>` và khai ở `font.file`; component chờ
`document.fonts` trước khi chụp. Không dựng thumbnail bằng ImageMagick từ một still rồi
ghép chữ.

**Nhiều phương án thì khai `variants`.** Khi ấy `thumbnail` chỉ là phần chung (font, màu,
cảnh), mỗi biến thể trộn lên nó thành một composition `<tập>-thumb-<khoá>`; `font` và
`keep` trộn theo từng trường:

```json
"thumbnail": {
  "scene": "canh-05", "font": { "family": "Baloo 2", "file": "Baloo2.ttf" },
  "variants": {
    "a": { "at": 16.3, "zoom": 4, "origin": [0.35, 0.65], "lines": ["MỘT MÌNH", "MỘT RÌU"],
           "keep": { "cast": ["tieu-phu"], "animals": [], "props": [], "bg": false, "hooks": ["front"] } },
    "b": { "at": 5.3, "zoom": 2.8, "lines": ["AI THẮNG", "ĐÂY???"], "accent": { "char": "???", "color": "#c94726" } }
  }
}
```

`keep` lọc khung ấy mà không sửa cảnh phim; trường bỏ trống là giữ nguyên. `cast` /
`animals` / `props` là `id` được ở lại (`[]` bỏ hết — bỏ ai thì bỏ luôn thứ bám vào người
đó, người cưỡi hay đồ xách), `bg: false` bỏ `scene.bg[]`, `fx: false` bỏ `scene.fx[]`,
`layers` là tên lớp vẽ code được ở lại, `hooks` là móc của chúng được chạy
([10](10-lop-ve-code.md)) — `["front"]` giữ bong bóng thoại mà bỏ bối cảnh vẽ code.

```bash
pnpm thumbnails <tập>                    # mọi thumbnail của tập, một lượt bundle → out/thumbnails/
pnpm still <tập>-thumb-a out/thumb.png   # một cái
```

`stickman check` soi `scene` và `font.file` của từng biến thể.

## Render bản chốt

```bash
pnpm render:final tap out/tap.mp4
```

Bundle của lệnh này chỉ mang tập `tap`, cảnh của nó và file tiếng cue của nó
([03](03-scene.md#phạm-vi-bundle)). Render từ bundle dựng sẵn (`remotion bundle --out-dir`,
rồi render từng đoạn) thì bundle với `STICKMAN_SCOPE=tap`.

Bản upload dùng frame PNG; preview có thể dùng JPEG để render nhanh. `render:final` còn
đặt `REMOTION_QUALITY=final` để tóc dựng khối chiếu đúng góc từng khung, không làm tròn
theo cache — chỉ lệnh này, `pnpm render` / `still` / `frames` / `thumbnails` và Remotion
Studio vẫn dùng bản cache ([02](02-trang-phuc.md#tóc-dựng-khối)). Chuẩn hoá
từng file audio trước khi trộn, sau đó đo peak của bản mix để tránh clipping.

Công cụ hệ thống cần thiết được liệt kê tại
[05 — Công cụ ngoài](05-repo-video.md#công-cụ-ngoài).
