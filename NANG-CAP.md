# Nâng cấp studio — rút từ tập 01

Nguồn: rà **65 session** dựng tập `01-son-tinh-thuy-tinh` (04/09 → 08/09/2026), cộng một
lượt đối chiếu mã repo tập với `packages/` và `packages/cli/scaffold/`.
Báo cáo gốc: `01-son-tinh-thuy-tinh/nhin-lai-tap-01.md`.

File này **chỉ đúng ở repo studio** nên không nằm trong `docs/` (xem AGENTS.md § Biên giới
với repo video). Nó là backlog có checkbox, không phải spec — cái gì làm xong thì spec đi
vào `docs/`, mục ở đây tích rồi để lại làm vết.

Ký hiệu công: **XS** vài phút · **S** một buổi · **M** một ngày · **L** nhiều ngày.

---

## Vì sao — số liệu nền

| | |
|---|---|
| Lượt người dùng | 369 |
| Tool call | ~3.758 (**~10 / một lượt người nói**) |
| Bash | 2.389 (64%), trong đó `python3` heredoc **299**, `magick` 39, `ffmpeg` 10 |
| MCP stickman | ~520 (**14%**) |
| Ba session dựng cảnh gần nhất | **301 tool call, đúng 2 lần gọi MCP** |
| Session dựng hình | 34–50 phút, 60–225 tool call |
| Session không đụng hình (TTS, fact-check) | 9–27 phút, gần như không vòng lặp |

Bộ công cụ chính thức chiếm 14% công việc. Studio không thua vì thiếu tính năng lẻ — nó thua
vì **vòng lặp cốt lõi "sửa → soi → sửa" đã chạy ra ngoài nó**.

---

## Phát hiện quyết định

`sceneWorld` (`packages/render/lib.mjs:548`) **đã dựng SVG bằng `renderToStaticMarkup`** —
nó render React component được, và đang làm đúng thế với `SceneFx` (dòng 565–580).

Tám file lớp vẽ code của repo tập — `TranLu`, `HieuUng`, `DongNuoc`, `DuongVeNui`,
`TranLuNui`, `TrongCung`, `May`, `BinhMinh`, tổng **3.813 dòng** — **không import `remotion`
dòng nào**. Chỉ `@stickman3d/sketch`, module nội bộ, và một hàm phân giải URL ảnh. Chỉ các file
*bọc* (`Scene`, `Episode`, `Root`, `ManChieu`, `TheChu`, `TamCredit`) mới dùng Remotion.

⇒ Lớp code **đã sẵn sàng chạy trong `sceneWorld`**. Hợp đồng "thuần theo `t`" mà `lop.tsx`
tự đặt ra chính là hợp đồng của `SceneFx`. Nỗi đau ngốn giờ nhất không phải bài toán kiến
trúc — **nó là một cái loader còn thiếu**.

---

## P0 — làm ngay

- [x] **Phát hành 6 commit đang treo** (XS). Repo tập cài từ registry nên tập 02 sẽ dẫm lại
      cả 5 bug nếu quên. `pnpm release`. Ra trong bộ rig 0.17.0 / fx 0.4.0 / render 0.17.0 /
      mcp 0.21.0 / cli 0.22.0.
  - [x] `6dba822` mất ảnh ở cú cắt (`images.ts`: cổng giải mã 6, hạn 10 s, giữ ảnh khỏi bị
        Chrome dọn) — bug này sống từ repo 00, ăn 2 lượt render đầy đủ (~27 phút) mới bắt được
  - [x] `2c8f0bc` cảnh đầu đứng trắng trong Studio (ô chờ phải là `<div>` trần)
  - [x] `e601428` check đọc `dur` của cue
- [x] **Vá bug thẳng đang mở: `cue.dur` bị zod gạt** (S). `packages/cli/lib.mjs:667` đọc
      `c.dur`, nhưng `packages/cli/scaffold/src/episode.ts:16-22` `CueSchema` chỉ có
      `file, at, text, volume`. Đây là nguồn của **14/17 cảnh báo giả** ở tập 01. Xem P1 §A.

---

## P1 — ba nỗi đau lớn nhất

### A. Cue tiếng: `dur` / `loop` / `fade`  · công S

Không có `dur` thì cue nào đã kêu là **sống tới hết shot**. Shot `d5` khai 100 cue trong 11
giây → **107 thẻ `<audio>` cùng lúc → preview 3-4 fps**. Giá biên đo được ~2,5–3 ms/thẻ/khung;
bấm Mute không đổi gì. Sau khi làm bè lặp: đỉnh thẻ cả tập **111 → 6**, `d5` lên 37 fps.

Lối thoát là **người dùng nghĩ ra**, không phải agent: *"Sao không gộp vào lặp theo tuần suất
nhỉ… mỗi take có vó ngựa thì cần 1 audio thôi?"*

- [x] `dur` (giây cue chiếm trên trục shot) vào `CueSchema`, và `Episode.tsx` lấy nó làm
      `durationInFrames` của `<Sequence>` nên hết `dur` là thẻ `<audio>` bị **tháo**
- [x] Thêm nốt vào `CueSchema` (`packages/cli/scaffold/src/episode.ts`):
      `loop` (độ dài một vòng — một cue thay cả chuỗi cue rời),
      `fade { in, out }` (`out` đo ngược từ hết `dur`)
- [x] Mang `src/audio.ts` (`useAudioDurations`) của repo tập lên scaffold, cùng phần
      `Cues`/`CueAudio` ở `Episode.tsx` (Remotion `<Loop layout="none">`, `volume` là hàm của
      frame nên bè lặp lịm đúng ở cuối `dur` chứ không lịm mỗi vòng)
- [x] **Khoá cache độ dài audio theo URL, không theo tên file** — bundler băm nội dung vào
      URL; khoá theo tên thì tab Studio đang mở vẫn cắt cue theo độ dài cũ, gen lại một cue
      dài hơn là cụt đuôi câu (bắt được 09-08 khi gen lại `m2`, commit `fe11ef8` bên repo tập)
- [x] Mang `tools/sfx-loop.py` lên scaffold — bè lặp liền mối. Không có nó thì `loop` nghe rõ
      chỗ nối. Ba bẫy phải ghi vào `docs/07`: **`.wav` không `.mp3`** (mp3 có đệm bộ mã hoá,
      lặp là hụt nhịp), độ dài vòng tròn frame ở 30 fps, đuôi cộng ngược về đầu vòng
- [x] `check` báo lỗi cue có `loop` mà thiếu `dur` — `Episode.tsx` ném ngay lúc dựng cây
- [x] `check`: bè phủ lên đoạn `idle` của cast → cảnh báo (ca thật: *"cảnh 06 chợ: người dừng
      rồi mà vẫn thấy tiếng"* — bè `dur: 8.0` liền trong khi cast `idle` 2,2→6,0 s)

### B. Lớp vẽ code: cho `sceneWorld` nạp lớp của repo  · công M

`render_scene stage: true`, `stickman-render --scene --stage`, `stickman-video` và `Scene.tsx`
của scaffold cùng vẽ lớp vẽ code của repo qua `<SceneWorld>`, nên nước, núi và bão ra ảnh ở
cả ba đường. Cái giá của lúc chưa có, đo được:
`4b79af13` mất 3 vòng mới tìm ra đường đúng (`render_scene` trống → `pnpm video` **1m20s vô
ích** → `pnpm frames`); mọi lần soi là `pnpm frames` (timeout 590–1200 s) + `magick montage`
+ `Read`, một session tới **8 lượt montage**; `render_scene stage: true` — thứ có sẵn bố cục,
camera, nền — vô dụng đúng ở cảnh khó nhất.

Đây cũng là 6.9 trong danh sách bug: vòng lặp mà AGENTS.md **bắt buộc** ("render rồi mở ảnh
ra nhìn") gãy đúng ở những cảnh khó nhất.

Năm chỗ móc, spec ở [docs/10](docs/10-lop-ve-code.md):

| móc | nghĩa |
|---|---|
| `bg(c)` | tự vẽ CẢ bối cảnh, thay `scene.bg` |
| `back(c)` / `front(c)` | vẽ trước / sau dàn diễn |
| `shake(c)` | trả `{dx,dy}` bọc **cả khung** — rung máy, cộng dồn nhiều lớp |
| `place(c, id, spot)` | **đẩy chỗ đứng** người/đạo cụ |

`shake` và `place` là thứ `SceneFx` về bản chất không làm được: fx chỉ vẽ, không được sờ vào
`sceneAt` / `propAt`, và không được bọc `<svg>`.

- [x] Repo video khai entry lớp trong `package.json`: `"stickman": { "layers": "src/lop.tsx" }`
- [x] `packages/render` bundle entry ấy bằng esbuild rồi gọi bốn chỗ móc đúng chỗ `sceneWorld`
      đang chèn `SceneFx`; `packages/mcp` đi theo. **Chèn đủ cả ba lớp** như `docs/09` § Ba
      lớp, ba chỗ chèn đã bắt buộc — thiếu một lớp là hiệu ứng im lặng biến mất.
      Spec ở [docs/10](docs/10-lop-ve-code.md); tên trong hợp đồng viết tiếng Anh theo
      `AGENTS.md`: `CODE_LAYERS`, `bg` / `back` / `front` / `shake` / `place`, `Offset`
      `{dx, dy, spin, ring}`
- [x] Hợp đồng `Ctx` cấp `url(file)` để lớp thôi `import { ANH } from "./data"`
      (`require.context` là thứ chỉ webpack hiểu). `Ctx` là `{ name, t, cam, url }`
- [x] Kiểu của hợp đồng (`CodeLayer` / `LayerCtx` / `Offset`) và năm chỗ móc ở `@stickman3d/fx`:
      `<SceneWorld>` vẽ cả cảnh, `sceneWorld` của render và `Scene.tsx` của scaffold đều gọi
      nó, `init` trỏ sẵn `stickman.layers` tới `src/lop.tsx` — ba đường render đi chung một
      chỗ móc
- [x] `stickman check` kiểm entry lớp: gói thử bằng chính `loadLayers`, đối chiếu `scenes` của
      từng lớp với `scene.name` có thật, kêu lớp không `name` / không chỗ móc
- [x] **Lớp vẽ code khai `z: { back, front }`** và **`fx[].z`**: `sceneOrder` gắn `z` sân
      khấu lên từng lớp, `<SceneWorld>` trộn ba thứ theo số, hoà thì lớp code → fx → dàn
      diễn — không ai khai là đúng thứ tự cũ. SCENE_VERSION 12
- [x] Ba thiếu sót của `fxProps`: `<SceneFx>` nhận `cam`, mọi mục `fx` khai được
      `frame: "camera"` (gốc ở tâm khung, lia theo máy); `kind: "clip"` là hình cắt dùng chung,
      mục khác trỏ `clip: name`; xếp z quanh cùng một người bằng `fx[].z`
- [x] `render_scene` nhận `times: [t1, t2, …]` và tự ghép lưới (`stickman-render --times`)
- [x] `render_scene` nhận `around: { cast, anchor: "handNear", pad: 200 }` — ô cắt quanh mốc
      `anchorAt`, đơn vị sân khấu (`stickman-render --around <cast> --anchor --pad`)
- [x] Bundle lớp nằm trong bộ nhớ MCP server, gói lại chỉ khi file nguồn đổi; `render_scene`
      với `times` thay `pnpm frames` nên không còn lượt bundle Remotion nào trong vòng soi

### C. Mốc thời gian: neo có tên + `retime`  · công M

Nỗi đau **đắt nhất** trong cả lịch sử. Mọi mốc hình là **giây tuyệt đối ghim theo mp3 cũ**.

- `fd5163ac`: *"Thay thoại là dựng lại cả 81 giây chứ không vá được."*
- `19c1acfc`: thay đúng **một khối `k2`** → 5 cue lệch −0,94…+0,09 s, mọi SFX bước chân mất chỗ.
- `4f6b8bb4`, brief của chính người dùng: *"Bốn file ghim chung một bộ mốc, phải đi cùng lượt"*
  — scene JSON + `LU[]` + `HIEU_UNG[]` + `episodes/tap.json`.
- `1526bc2b`: "nâng núi từ frame 90" kéo theo 3 lớp phụ thuộc rời rạc; agent làm 2, **sót lớp
  thứ 3** → người dùng phải quay lại.
- `72276201`: fact-check tìm ra 3 lỗi nội dung thật (sính lễ thiếu *"một trăm ván cơm nếp…"*)
  và **bỏ cả ba**: *"sửa b7 là phải gen lại m1 và căn lại toàn khối A–B. Tôi không khuyên đổi
  thoại vì cái giá đó."*

Ràng buộc không tránh được từ nhà cung cấp: ElevenLabs v3 **không tất định**, không có request
stitching ⇒ sửa một chữ là gen lại cả khối. Nên cái phải rẻ đi là **dựng lại hình**, không
phải gen lại tiếng.

- [x] **Mốc có tên**: `scene.marks`, mọi trường thời gian (clip, camera, path/flip/fade, fx)
      nhận `"@nui-dang+0.4"`; JSON giữ tham chiếu, `unmarkScene` ra số trong `resolveScene`;
      lớp vẽ code đọc `ctx.marks`; `check` kêu mốc không ai neo; `scene_probe` / `render_scene`
      nhận `"@mốc"`. SCENE_VERSION 13
- [x] **Cue neo cue, mốc neo cue**: cue khai `after: { cue, offset }`, shot khai
      `marks: { ten: { cue, edge, offset } }`; cue `at` cũng nhận `"@mốc"` của cảnh (giải lúc
      chạy qua bảng slow-mo). Luật ở tập, số ở chỗ vẽ
- [x] **`stickman retime`** (`pnpm retime`, tool MCP `retime`) — đo file bằng `ffprobe` rồi ghi
      số vào `at` của cue `after` và `marks` của cảnh; `--mark <cảnh>:<tên>=<giây>` đặt tay;
      `--dry-run`. Sửa JSON thô nên giữ thứ tự khoá và tham chiếu
- [x] `check`: tính lại từ luật `after` / `shot.marks` và cảnh báo số đang ghi đã cũ; kêu cue
      trùng tên bị neo, `@mốc` không có, mốc khai không ai neo. Lớp code neo qua `ctx.marks`
      nên không còn số riêng để lệch

---

## P2 — lint hình học: rẻ nhất trên mỗi đồng bỏ ra

Toàn phép tính offline, không đổi kiến trúc gì. Mỗi luật bắt một ca đã thật sự lọt tới bản
dựng ở tập 01 — `validate` và `check` đều im lặng.

- [x] `|shoulder| > 120` mà **dấu khuỷu ngược dấu vai** → cảnh báo.
      Ca: *"giơ tay lên thì cánh tay đang gập ngược"*; lọt tới lúc lên phim, dính 2 hành động,
      7 mốc đỉnh, cả hai tay
- [x] So vận tốc `footNear`/`footFar` với vận tốc `root` → bắt **moonwalk**.
      Ca: *"Đoàn Thuỷ Tinh đi giật lùi vào à"* — chân trụ trượt 107 đơn vị/0,4 s trong khi
      thân đi 51. Kèm: **bỏ ngữ nghĩa ngầm "mảng một mốc = giá trị ngược trước mốc"** của
      `flip`, chính nó gây ra ca này
- [x] Keys đặt cho bộ phận **không có trong `mask`** → cảnh báo (giá trị đang bị vứt im lặng).
      Ca: `actions/cuoi.json` thiếu `"face"` ⇒ **nụ cười chưa bao giờ hiện** ở 4 cảnh, sống
      nhiều tuần, phát hiện tình cờ
- [ ] Tính hộp nhìn từng mốc camera × `bg.scale` → cảnh báo hở nền. Lớp khai `repeat` khác
      `none` thì bỏ qua bề ngang, chỉ còn kiểm trên dưới — lát đã lo hai mép.
      Hai ca: camera `x 300 zoom 1.7` quét tới x≈676,5 mà nền chỉ tới 640 (**dư 36 đơn vị
      ≈ 5% khung**); `bg.scale 1` + `zoom 0,85` → viền kem hai mép và đáy
- [ ] Tỉ lệ kéo giãn của `speed` so với `strideNatural` > ~30% → cảnh báo.
      Ca: `run` @ `speed 356`, scale 0,62 → chu kỳ 0,45 → 0,8 s, chân xoạc 84° treo lâu.
      Người dùng chỉ mô tả được cảm giác (*"sản chân nhìn hơi buồn cười"*), agent mất ~15 tool
      call + 2 lượt render mới định lượng
- [ ] `check` liệt kê **mọi** tham chiếu thiếu (action, piece, bg, audio) thành một
      bảng, không dừng ở lỗi đầu
- [ ] `scene_probe` / một tool `measure` trả **chiều cao trên màn hình** theo tỉ lệ với một
      nhân vật tham chiếu. Ca: voi thử **4 giá trị scale** (0,62 → 1,2 → 0,95 → 0,8), mỗi
      vòng render + đặt lại toàn bộ cue tiếng bước vì đổi scale làm đổi chu kỳ chân
- [ ] `scene_probe` trả cờ khi cast đứng trong **vùng dốc** của mặt nước (ca vòng chân lơ lửng)
- [ ] Cảnh báo `idle` trên vật thể đang chuyển động. Ca agent tự nhận sau khi so với bản codex:
      *"Bản của tôi cho cả năm người `idle` … đứng yên trên một con sóng đang lao — **sai về
      nội dung, không chỉ xấu**"*

---

## P2 — cấu hình lớp code ra JSON  · công M

Các trường `troi`, `lat`, `da`, `daXep`, `toi`, `bao`, `mep`, `bien`, 17 mốc `chop`… sống
trong literal TS. Không validate được, không `patch` được, không ai kiểm ngoài `tsc`.
Đếm heredoc trong một session: **22**, **23**, 11.

Hỏng im lặng: *"Bản vá python hụt một mẫu (sai thụt đầu dòng) nên chưa ghi gì, khung vừa
render vẫn là code cũ"* — đã đọc ảnh sai một vòng mà không biết.

- [ ] `scene.lop: { … }` dạng tự do (zod passthrough), lớp code đọc thay vì đọc literal
      `LU[tên]` / `HIEU_UNG[tên]`. Được ba thứ: `patch` sửa được, `validate` kiểm được, hết heredoc
- [ ] **PRNG nhận seed băm từ tên cảnh + tên lớp**, không đếm lượt gọi ở tầm module.
      Ca thật: chen thêm lứa hạt mưa vào `rnd()` chung làm *"gió, đá và bọt của khối A xê dịch
      theo"* — mà khối A đã chốt. Chỉ lộ khi so pixel-by-pixel
- [ ] `pnpm frames --baseline` (render + `magick compare -metric AE` với HEAD) thành lệnh
      chính thức — thay cái nghi lễ `git worktree` + compare thủ công mỗi lần sửa lớp dùng chung
- [ ] Xuất `@stickman3d/fx/util`: `mulberry32(seed)` + `once()`, `clamp01/smooth/easeIn/easeOut/
      range/f1/TAU`, `hash(n)` — đang bị **chép ở 6 file**
- [ ] Một hằng **`OVERSCAN` tính từ zoom lớn nhất của `scene.camera`** thay vì mỗi lớp tự đoán
      (hiện: 200 / 140 / 820 / 400 — mỗi file một số)

---

## P2 — cue bám sự kiện  · công M

Rig **đã có sẵn** `events:[{name}]` trên action (`packages/rig/src/action.ts:533`) và
`sceneEvents()` (`packages/rig/src/scene.ts:1045`) đổi ra giây cảnh. Đang dùng: **8 event**,
trong khi **126/283 cue của tập là tiếng bước chân gõ tay**.

Shot `b8` là ví dụ: 10 cue ở 2.329 / 2.379 / 2.783 / 2.833 / 3.237 / … — sải 0,454 s, lệch
L/R cố định 0,05 s, `volume` xen kẽ 0,26 / 0,16, gõ bằng tay.

- [ ] Cue khai `on: "step:ln1"` thay `at: 2.329`. Đổi scale voi 0,95 → 0,8 (chu kỳ chân
      0,674 → 0,728 s) sẽ không phải đặt lại 79 cue nữa
- [ ] Lệnh/hàm sinh cue bước chân: duyệt shot → gom `step` event của mọi clip (đã dịch theo
      `start`/`phase`/`speed`/`slow`) → sinh cue kèm mặt nền và gain theo khoảng cách.
      Tiền lệ đã có: `tools/srt.mjs` sinh phụ đề đúng lối này
- [ ] Cue `scatter`: `{ file: […], every, jitter, volume: [lo, hi], dur }` — 30 cue `sfx-sam-*`
      rải tay ở 1.15, 2.9, 6.6, 10.3… gộp còn ~3
- [ ] Cue `at` trong shot có `slow` phải tự quy đổi giây cảnh ↔ giây màn hình (hiện phải chạy
      tay `node -e "warpTable/screenTime"`)
- [ ] `check`: RMS 150 ms cuối cue < ngưỡng → cảnh báo **cue cụt sẵn**.
      Ca: 5 cue mất chữ cuối ("đấy ạ", "Thuỷ Tinh", "nhau", "xông vào") vì timestamp ký tự
      ElevenLabs lệch sớm 0,6–2,6 s ở khối dài có tag. Agent kết luận: *"`check` không kêu vì
      nó chỉ so độ dài file với shot, còn file thì đã cụt sẵn"*
- [ ] `check`: file tiếng đổi mà mức RMS lệch quá ngưỡng so với bản trước → cảnh báo
      (sai là phải sửa tay 79 số `volume`)

---

## P2 — `check` lấy lại giá trị làm cổng chặn

14/17 cảnh báo là giả ⇒ mọi session đều `pnpm check 2>&1 | grep -v "quá chỗ"`, và người dùng
phải **dặn miệng trong brief mỗi session**. Quen tay thì cảnh báo thật cũng bị nuốt — đã xảy ra.

- [x] Phát hành bản vá `dur` (P0)
- [x] `check` in **cảnh báo trước, lỗi sau cùng**, rồi một dòng đếm theo mức — không phải cờ
      `--summary` mà là mặc định, vì đường xem hay gặp nhất là `tail`.
      Ca: `scenes/turn-around.json` thiếu `crown: hat` in **trước** phần cảnh báo → lượt xem bằng
      `tail` không thấy, mà nó làm `check` thoát mã 1 suốt
- [ ] File baseline cho cảnh báo đã chấp nhận
- [ ] `stickman init` **đừng để lại cảnh mẫu trỏ vào nhân vật/đồ không tồn tại**
      (`turn-around.json` chính là cảnh mẫu scaffold chưa ai xoá)
- [x] Pin `zod` ở template — Remotion in *"Version mismatch: zod 4.5.4 vs 4.4.3"* mỗi lượt,
      agent phải `grep -iv` **8 từ khoá** để lọc. `upgrade` đồng bộ luôn `zod` và `remotion`
      của repo đã dựng, nếu không thì bản pin chỉ tới được repo `init` mới
- [ ] `check` phân biệt override hợp lệ (có diff với bản chung) và file rác
      (ca: `animals/ngua.json` chưa track, không rõ nguồn — check chỉ báo "chưa commit")

---

## P2 — nguyên thuỷ còn thiếu ở rig

Mỗi cái đang đẻ ra một workaround không ai đọc lại được.

- [ ] **`shot.freeze`**. Hiện `shot.hold` chỉ kéo dài shot, `Scene` vẫn chạy giây cảnh tới ⇒
      phải tách `e8a`/`e8b` và **bóp 0,02 giây cảnh trải ra 1,5 s**, kiểm bằng `magick compare`
      (0,42% pixel đổi trong 1,5 s so với 4,3% trong 0,53 s)
- [ ] **`walkCycle` nhận `params.hold`** — khoá một tay ở một tư thế + gán layer cố định.
      Xoá `di-cam-giao.json` (16 key nướng tay bằng cách grep hằng số trong `rig/dist/index.js`:
      hip 16, knee 28, phase 2.5, arm 9, lean 1) và xoá luôn nhu cầu làm lại nó cho **mọi tập
      sau có lính cầm giáo/đuốc/cờ đi bộ**
- [ ] **Clip đè được `end`** (`{"action":"oh-no","end":"hold"}`) thay vì phải nhân bản file
      hành động. Ca: `oh-no` khai `end:"wrap"` 0,9 s gây giật tay ⇒ đẻ `oh-no-giu` và sửa
      **9 clip ở 3 cảnh**
- [ ] **Shot không có `scene` render ra trống** ⇒ thẻ chữ / màn chiếu / credit phải viết
      component riêng. Xem § `card` dưới
- [ ] **Mép shot chặt cụt tiếng và hiệu ứng.** Shot có `overlap` cho *hình*; không có gì tương
      đương cho tiếng và lớp hiệu ứng (2 commit bên repo tập đều là "cho tiếng/mưa chạy qua cú cắt")
- [ ] **`fx` nhận mốc theo giây *shot*, không chỉ giây cảnh** — hiện `e8` không tách khỏi `e5`
      được vì lý do này. Kèm: `buttons`/`cursor` có hằng số đóng cứng bên trong
      (`arrive = t − 0.12`, `linger = 0.45`), agent phải grep `fx/dist/index.js` để moi ra
- [ ] **`fx` khai được `theo: { cast, anchor }` và `tu/den: { clip }`.** Ca: đá bay tính theo
      "giơ tay từ 4.9 s" trong khi cảnh thật dùng `gong-suc` 8.8–12.4 s; cột nước ở `x 260` đè
      chân lính vì lính đã dời `x 85 → 300`

---

## Trường JSON mới — suy từ mẫu lặp trong repo tập

- [x] **Một trục `z` cho mọi thứ đặt trên sân khấu** (M). `cast[]` và `props[]` khai
      `z`; `sceneOrder` sắp theo nó ở **ba tầng lồng nhau** — sân khấu,
      cụm quanh một chủ, người ngồi trong một đạo cụ — nên đạo cụ `follow` vẫn kẹp quanh chủ
      nó và người `sit` vẫn nằm giữa hai nửa `part`. Bỏ trống `z` là bảng `SCENE_Z`, dựng lại
      đúng thứ tự cứng cũ: không file nào phải sửa. `layer` còn lại làm đường tắt, ánh xạ
      sang băng toàn cục khi đứng rời và sang `∓1` cục bộ khi `follow`. Trục dừng ở tầng sân
      khấu: chỗ cắt hai nửa `part` không nhận `z`. **Nền và `fx` chưa vào trục**, hai băng
      của chúng trong `SCENE_Z` là chỗ giữ sẵn; `fx` vào được thì `@stickman3d/fx` phải nhả bảng `kind` → lớp mặc định ra
      cho rig, còn ba đường render phải thôi vẽ fx thành ba cục `<SceneFx layer>`
- [x] **`bg` thành mảng lớp, mỗi lớp có `z`** (M). `scene.bg[]` là chồng lớp nền; thứ tự vẽ
      lấy ở `bgOrder`, `z` tăng dần và bỏ trống là `SCENE_Z.bg` cộng thứ tự mảng (`-1000`,
      `-999`, …) — cùng một số cho mọi lớp là tự vô hiệu. Thứ phải nằm **giữa** hai tấm nền
      (mặt trời giữa hai nửa `binh-minh.svg`) khai thẳng ở JSON, không cần một lớp vẽ code.
      **Đừng bảo repo biến quả đồi thành đạo cụ**: đạo cụ neo ở đáy với thân cao `PROP_BODY`
      còn nền neo ở tâm ảnh với `scale` theo bề ngang khung, nên mỗi lần sửa nền là một phép
      quy đổi; và đạo cụ kéo theo bánh xe, `seat`, `follow`, `sit` — vô nghĩa với bối cảnh, lại
      làm lint hình học không phân biệt nổi vật diễn với bối cảnh.
      **Nền chưa vào trục chung của `sceneOrder`**: cả chồng vẫn là bước trước đạo cụ, người
      và `fx`, nên `z` chỉ sắp các lớp nền với nhau và lớp nền không ra trước người được —
      khai ra khỏi băng nền thì `sceneZProblems` kêu. Cho nền vào trục là kéo theo `fx` và
      **năm chỗ móc của lớp vẽ code**, không thì `fx layer="back"` và `back` của lớp code
      chìm xuống dưới nền: ba thứ ấy phải vào cùng một lượt hoặc không thứ nào vào.
      - [ ] **`group`: cắt nhóm, đừng cắt file.** Nhiều lớp mà mỗi lớp một file rời thì bản gốc và
        các mảnh cắt trôi khỏi nhau ngay lần sửa thứ hai, và **vẽ nền không preview được cả
        hình**. Cho lớp khai `{ file, group }` — một bản gốc, các lớp trỏ vào `id` nhóm trong
        nó. Hiện thực bằng **bước cắt trong `stickman check`** rồi cache; `<use>` trỏ ra file
        ngoài bị Chrome chặn, fragment `#id` trong `<image>` không chạy đủ ba đường render.
        Chưa làm bước cắt thì tối thiểu `check` cảnh báo khi bản gốc mới hơn mảnh
      - [x] **`parallax` theo lớp**: `bg[].parallax` là hệ số trôi theo camera — `1` (mặc định)
        dán vào sân khấu, `0` dán vào khung máy quay, giữa hai số là ở xa nên trôi chậm hơn,
        lớn hơn `1` là ở gần. `bgRect(lớp, cam)` nhận thẳng mốc camera nên ba đường render ra
        cùng một hộp. Chỉ trôi, không đổi `zoom`; `x`/`y` trong JSON là chỗ lớp nằm khi camera
        ở nhà
      - [ ] **`path` theo lớp** (S): mốc `{ t, x, y, scale }` như `cast[].path`. `BgLayerSchema`
        không có `path` lẫn `fade`, tức lớp nền chỉ trôi theo camera chứ không tự đi theo `t`
        — mặt trời mọc ở § lớp hiệu ứng cần đúng cái này, không chỉ cần `z` và `parallax`
- [x] **`bg.repeat: "none" | "tile" | "mirror"` (+ `tiles`)** (S). Khai ở từng lớp của `bg[]`;
      `none` là mặc định nên không file nào phải sửa. `bgTiles(lớp, cam)` trả danh sách ô và
      **ba đường render chỉ vẽ danh sách ấy** — số ô suy từ hộp camera, `tiles` (mặc định `32`)
      chỉ là chặn trên. Ô lát chờm nhau `2·BG_TILE_BLEED`: chạm mép đúng thì chỗ vẽ khử răng
      cưa vẫn để lọt giấy thành vạch dọc một pixel. Lát chỉ ngang. SCENE_VERSION 11
- [ ] **`cast[].rank = { n, dx, dScale, phaseSpread }`** (M). **40/98 mục `cast` của repo là
      lính**; các mục `ln1…ln4` chỉ khác `x` bước đều +50, `scale` 0.2→0.215, `phase` desync,
      và hai track `than`/`tay` giống nhau **từng byte**. Gộp ~40 mục thành 6 dòng.
      Riêng `phase` xuất hiện **389 lần** — mặc định băm từ `id` là xoá gần hết
- [ ] **`camera[].move: "punch"`** `{ t, at:[x,y,zoom], in, hold, out }` (S). **40/63 mốc**
      camera là thành ngữ 4-mốc `ease → cut → ease → cut`, giá trị rộng gõ lại nguyên văn mỗi vòng
- [ ] **`card`** (M) — thẻ vẽ code ở tầng tập, discriminated union:
      `kind: "the"` (thẻ chữ trên giấy, shot không có `scene`, cần `duration`),
      `kind: "man"` (màn chiếu đuôi tập: `tu`/`den` là mốc khung của chính tập này `{shot, at}`,
      `tua {at, dur}`, `crawl`, `enter`, `under`). Kèm cờ `nenTrong` cho `Scene` (không tự sơn
      nền `PAPER`) để thẻ `under` nằm dưới cảnh được
- [ ] **`caption` đếm số** (`lines[].step`) (XS). 12/15 caption của repo là 12 object gần y
      hệt, chỉ text chạy "1","2","3" và `at`/`until` bước đúng 0,23 s. Đừng đẻ `kind` mới,
      cùng lý do với `caption.bubble` dưới
- [ ] **`caption.bubble`: vỏ bong bóng thoại khai được** (M). Chữ và mốc đã ở `scene.fx`;
      `SpeechBubbles.tsx` (64 dòng) chỉ đọc lại chính caption của cảnh, tra một bảng **3 câu
      theo nguyên văn dòng chữ**, rồi vẽ nét bo góc kèm đuôi. Hậu quả: **dải ảnh và mp4 thử của
      `stickman-render` chỉ thấy chữ trần**, vỏ chỉ có ở Remotion. Gộp vào chính `caption`, đừng
      đẻ `kind` mới — cảnh không khai `bubble` vẫn là caption trần:
      - Vỏ: `shape` nhận `round` `rect` `oval` `thought` `burst`; `pad`, `radius`, `fill`,
        `stroke`, `strokeWidth`
      - Đuôi: `tail { lean, width, len }`, bỏ hẳn khi là lời kể. Khai `theo { cast, anchor:
        "mouth" }` rồi tự tính góc thay cho `lean` gõ tay — rig có sẵn mốc `mouth`, `tears` đã
        bám người đúng kiểu ấy, người nói dời chỗ hay cảnh bị retime thì đuôi vẫn chỉ đúng.
        **Điều kiện: mục `fx` khai được `theo: { cast, anchor }`** ở § nguyên thuỷ còn thiếu —
        caption là một `kind` của `fx` nên mục ấy bao luôn đuôi bong bóng, đừng làm hai lần
      - Chữ: caption đã có `font` `size` `fill` `stroke` `align`; thêm `weight`, `italic`,
        `lineHeight`
      - **Mọi số đo của vỏ chia cho `zoom`** như `Caption` đang làm với chữ, không thì phóng
        máy quay là bong bóng phình ra
- [ ] **Bảng bề rộng ký tự trong `@stickman3d/fx`, để vỏ tự fit theo `maxWidth`** (M).
      Điều kiện của mục trên: **hai trong ba đường render — dải khung `--stage` và
      `stickman-video` — dựng SVG bằng `renderToStaticMarkup` rồi đưa cho `rsvg-convert`:
      không DOM, không JS, không đo được chữ**; chỉ Remotion là Chrome, và studio không đọc
      `scenes/` nên không có đường thứ tư đo hộ. Bề rộng vỏ tính lúc vẽ là dải ảnh kiểm cảnh
      và bản mp4 cuối ra hai cái bong bóng khác nhau. Chữ lệch font thì đã chấp nhận, hình
      học lệch thì không.
      ⇒ Gói bảng advance width của đúng font caption, sinh từ TTF, dải Latin + tiếng Việt, vài
      trăm mục; `measureText(text, size)` thành **hàm thuần**, ba đường render ra cùng một số.
      Có nó thì tự fit `pad`, tự xuống dòng theo `maxWidth`, **khỏi phải thêm `width` gõ tay**
      — `CaptionSchema` hôm nay không có `width`, cả hai đường đều là trường mới. Bỏ kerning
      nên sai số ~1–2%, đệm thêm là xong.
      - **Bảng phải ghim đúng một họ font.** `CaptionSchema` mặc định là ngăn xếp bốn tên
        (`Noto Sans Black` → `Noto Sans` → `Liberation Sans` → `sans-serif`), mà bảng chỉ đúng
        cho một họ. Kèm: **`check` kiểm đúng họ ấy có thật trong fontconfig** — rsvg rơi về
        font thay thế thì chữ tràn ra ngoài khung vừa tính
      - Dự phòng nếu chưa làm bảng: thêm `width` khai tay và cho `stickman fit` **đo rồi ghi
        số vào JSON**, đúng nếp `bg.aspect`. `foreignObject` không dùng được, librsvg không
        dựng nó
- [ ] **`cast[].equip[]` nhận danh sách mốc** (S). Hiện 17 lần `equip` phải **bịa một clip**
      (`{start, phase: 0, equip: {...}}` trên track rỗng) để làm timeline đạo cụ
- [ ] **`clip.pose` nhận thẳng tên tư thế** từ `POSES` (S). 12 hành động của repo chỉ là một
      tư thế tĩnh (`end: "hold"`), phải bọc thành file action chỉ vì scene không dùng `POSES`
      trực tiếp được
- [ ] **Cờ `arm: "near" | "far"`** (hoặc `mirrorArm`) ở clip (S). Ba cặp đối xứng dấu ở repo
      (`gio-giay` ↔ `gio-giay-xa`, `gio-bien-gan` ↔ `gio-bien-xa`, `noi-tay` ↔ `noi-tay-xa`) —
      `gio-bien-xa.json` tự ghi trong `note`: *"Bản tay xa của gio-bien-gan, đối xứng dấu."*
      Gộp 6 file thành 3 và bỏ đúng cái bẫy dấu góc mà `docs/00` cảnh báo
- [ ] **`write`/`patch` của MCP bỏ giá trị bằng default khi ghi** (S). Nhiễu đo được:
      `outfits: {}` rỗng ở **13/13** file nhân vật; `pieces` liệt đủ 13 socket kể cả `src: "none"` (~11 dòng chết × 13 file)
- [ ] **`patch` giữ nguyên thứ tự khoá** (XS) — hiện ghi lại file làm đổi thứ tự
      (file nhân vật lệch với bản chung chỉ vì `widthScale` bị dời chỗ) →
      `stickman upgrade` tưởng người dùng sửa tay

---

## Lớp hiệu ứng nên lên studio

Sau khi có bộ móc (P1 §B). Cột "mức" là mức sẵn sàng của mã hiện có ở repo tập.

- [ ] **`HieuUng.tsx`** (1312 dòng) → 6 `kind` mới: `rocks` (đá rơi xếp tháp), `shake` (rung
      khung), `rain` (gọi mưa: gió + mây + mưa + vũng + màn tối), `lightning`, `anger` (dấu giận
      anime), `nightfall`. **Mức: sẵn sàng** — file đã tự tham số hoá hết (mọi số ở
      `HIEU_UNG[tên cảnh]`, mỗi hiệu ứng một `*Cfg` đúng hình dạng zod, PRNG có seed, thuần
      theo `t`). **Công chuyển đổi thấp nhất trong cả nhóm**
- [ ] **`DongNuoc.tsx`** (293) → `kind: "flood"` + móc `dat`; `VongChan` tách riêng thành
      primitive. **Mức: sẵn sàng** (đã tách `DongCfg` theo tên cảnh đúng vì lý do này)
- [ ] **`May.tsx`** (53) → primitive "dải ảnh lặp ngang phủ `tu → den`". **Mức: sẵn sàng**
- [ ] **`DuongVeNui.tsx`** (252) → phần lặp nền thành **trường JSON `bg.repeat`** (đã có);
      `NhuomToi` + `MuaLa` thành `kind` mới. **Mức: hỗn hợp**
- [ ] **Bộ đuôi tập**: `TamCredit.tsx` (241) + `credits.ts` (102) + `ManChieu.tsx` (180) +
      `TheChu.tsx` (63) + `NenGiay.tsx` (60). **Mức: sẵn sàng về ý tưởng** — `TamCredit` comment
      ghi rõ *"chép từ `../00-ba-luoi-riu`"* tức **đã copy qua 2 tập**; `ManChieu` cần đưa
      `MAN = {x:-296,y:-258,w:768,h:432}` vào `card.man` của JSON. Đuôi tập đã bị **dựng lại
      3 lần** ở tập 01
- [ ] **`TranLuNui.tsx`** (354) → bộ sinh "vách đá bậc thang". **Mức: cần tham số hoá**
      (`TANG`, `MAU`, `BOT`, `R_DU` là hằng module)
- [ ] **`TrongCung.tsx`** (153) → `kind: "butterflies"` + `kind: "sparkle-field"`.
      **Mức: cần tham số hoá** — `TAM = {x:0,y:50}` khoá cứng vào chỗ đứng một nhân vật; phải
      bám người bằng `sceneAnchor` như `tears` đang làm. (Bướm **không có** trong `@stickman3d/fx`;
      `glow` kiểu `sparkle` thử lên nền kem *"gần như không thấy"*)
- [ ] **`TranLu.tsx`** (1237, to nhất) — **Mức: khoá cứng**, đừng bê nguyên (liệt tên
      `thuy-tinh`, `ln1..ln4`; `LOE` khai giây tuyệt đối của một câu thoại). Chỉ bóc ba
      primitive: mặt nước có sóng + `dat`, cú **loé trắng cả khung** (rất chung), và mẫu
      "PNG cắt theo mặt nước rồi lắc"
- [ ] `BinhMinh.tsx` (19) → **xoá hẳn, không cần `kind` mới**: mặt trời là một lớp `bg[]` có
      `path`, quả đồi là lớp `bg[]` `z` cao hơn, cả hai cắt theo `group` từ `binh-minh.svg`.
      **Mức: chờ `bg[]` có `z`, `group` và `path`** — xem § Trường JSON mới
- [ ] **`SpeechBubbles.tsx`** (64) → trường `caption.bubble` + bảng đo chữ, xem § Trường JSON
      mới. **Mức: sẵn sàng** — chữ và mốc đã ở `scene.fx`, file chỉ thêm hình vỏ
- [ ] Ghi vào `docs/03` một mục **"neo theo khung / theo camera / theo thế giới"** kèm cảnh báo
      phải trải rộng hơn khung ở mọi thời điểm. Ca: mưa/mây neo theo **khung** ⇒ camera lia là
      nửa phải khung cuối trắng bệch; khối nước dừng ở `x 470` ⇒ lia tới là mất nước
- [ ] Một **khuôn mẫu "lớp vẽ code"** kèm ví dụ (nhận `cameraX`/`t`, đăng ký vào `LOP`) để bản
      viết ngoài (codex, prototype) đúng chuẩn từ đầu — hiện port một bản ngoài mất cả session

---

## Bộ mẫu chung: hành động, nhân vật
- [x] Bộ mẫu chạy lại qua `parse*` nên mọi file đã ở đúng version schema của rig
- [ ] **Một nhân vật mẫu "quần chúng"** nhận `palette` + một socket tóc ghi đè, thay cho sáu
      file. `linh-nui` / `linh-nuoc` / `linh-trieu` khác nhau gần như **chỉ ở `palette` + một
      mảnh tóc**, và **40/98 mục `cast` của repo là `linh-*`**; cộng `dan-cho-nam/nu/gia`.
      Bộ chung chỉ có bốn người 3D mẫu `sample-*`

---

## Script và lệnh tiện ích

Scaffold chở 5 công cụ; repo tập **bỏ hẳn** script `srt`/`tts`/`sfx` khỏi `package.json` và
tự viết thêm 7 file — dấu hiệu rõ là đường chính thức không dùng được.

- [ ] **`tools/tts-khoi.py`** (239 dòng) — đường TTS **thật sự đang dùng**: gen lời dẫn theo
      KHỐI rồi cắt cue bằng `/with-timestamps`. `tools/tts.py` (VieNeu local) đã bị bỏ khỏi
      `package.json`. Lý do phải gen theo khối, đo được: khối 184–858 ký tự chênh **3,0 dB LUFS
      và 19% tốc độ**; chia lại 1.200–1.600 ký tự còn **0,8 dB**
- [ ] **`tools/tts-el.py`** (297) — chọn giọng: `info`/`voices`/`kho`/`them`/`thu`/`sample`,
      đo số dư trước-sau nên chi phí là số thật
- [ ] **`tools/sfx-el.py`** (190) — gen SFX ElevenLabs, bổ sung cho `sfx.py` (mẫu CC0 thu thật)
- [x] **`tools/sfx-loop.py`** (77) — xem P1 §A
- [ ] **`tools/steps.py`** (111) — bước chân hai mặt nền, kèm số đo phổ
- [ ] **`tools/beds.py`** (77) — bất biến *"thay file tiếng thì giữ nguyên RMS"* để các số
      `volume` đã chỉnh tay vẫn đúng
- [ ] **Port ngược `tools/sfx.py`**: repo tập đã lệch **+395 dòng** so với scaffold — thêm
      `LOCAL` (pack tải tay, ví dụ Freesound đòi đăng nhập) và 7 hàm `trim`, `fade`, `ramp`,
      `weight`, `peak`, `tile`, `retime`
- [ ] `sfx.py` chạy không cờ thì **chỉ sinh cue mà `episodes/` có trỏ tới** — hiện chạy trống
      là sinh 24 file cho recipe của tập khác
- [ ] Thêm script `sfx` vào template `package.json` (hiện thiếu, phải gọi
      `python tools/sfx.py --only=…`)
- [ ] **`stickman mcp <tool> <json>`** — cầu MCP → dòng lệnh (repo tập tự chế `tmp/rig-tool.mjs`,
      9 dòng). Agent không có MCP, hoặc chạy trong script/CI, đều cần
- [ ] **`stickman shots <tập>`** in bảng thời gian shot → frame. Repo tập phải viết
      `tools/_lay.mjs`/`tmp/shots.mjs` rồi `rm` đi
- [ ] Xuất **`loadWorkspace()`** từ `packages/render/lib.mjs` — 10 dòng boilerplate
      `load(dirs, parse)` + `commonDir()` đang bị chép 2 lần ở repo tập
- [ ] **`stickman eval <script.mjs>`** chạy trong ngữ cảnh repo — hiện script đặt ngoài repo là
      `ERR_MODULE_NOT_FOUND: Cannot find package '@stickman3d/sketch'`, phải `cp` vào `tmp/` rồi xoá
- [ ] **`pnpm preview [720|1080]`** gói sẵn cờ đúng. `--height=720` **giữ nguyên chiều rộng**
      → ra 1920×720 bẹp hình (~7 phút vứt đi); `--scale=0.6666667` làm tròn vỡ render.
      Cách đúng: render 1080p rồi hạ bằng `ffmpeg scale=…:flags=lanczos` (~1 phút)
- [ ] **`pnpm render --shot=<id>`** — hiện muốn nghe một shot phải tự tính khoảng frame bằng
      python mô phỏng `layoutShots`
- [ ] **`pnpm render` tự dọn bundle `/tmp` cũ.** Ca: hàng chục `remotion-webpack-bundle-*` mỗi
      cái 70 MB làm `/tmp` 5,6G/7,8G → `Page crashed!` / `ERR_INSUFFICIENT_RESOURCES`;
      dọn xong còn 801 MB. Ghi `--concurrency` mặc định hợp máy 16 GB vào `docs/05`
- [ ] **Render có checkpoint / nối lại** — một lượt chết giữa chừng (`exit 143`) là chạy lại từ
      đầu. Số đo: 1080p = **12–15 phút cho 11.888 khung**, cả phiên ~40 phút
- [ ] **`pnpm check-render`** quét YAVG sau render để bắt khung mất ảnh
      (`ffprobe -f lavfi -i "movie=x.mp4,scale=160:90,signalstats"` → khung hỏng sáng ~235)
- [ ] **`stickman audit-audio`** liệt kê file tiếng thật sự đi vào bản render — hiện phải render
      cả tập (5426 khung) rồi dò tương quan chuẩn hoá chỉ để trả lời một câu hỏi có/không
- [ ] **`stickman preview-shot <id> --audio-only`** + lệnh A/B đổi một file tiếng — hiện phải
      tự dựng 4-5 file A/B bằng python + numpy + ffmpeg mỗi lần duyệt tiếng

---

## Lỗi vặt của công cụ — mỗi cái mất 1–5 tool call, lặp mọi session

- [x] `validate` **nhận file có sẵn**. Hai chữ ký đã thử, cả hai đều lỗi:
      `{kind:"scenes", data:{__file__:…}}` → *"cast: Invalid input: expected array"*;
      `{kind:"scenes", file:…}` → `MCP error -32602`. Sau lượt này agent **bỏ hẳn MCP**
- [x] `validate` tự nhận `kind` theo nội dung file; báo lỗi kèm **tên file và trường thật**
      (hiện validate action lại báo về `cast` của scene)
- [ ] `parseAction` tự bọc `migrateAction` cho file schema cũ — hiện ném
      `TypeError: a.keys is not iterable`, không nói gì về nguyên nhân
- [x] `warpTable(undefined)` nhận rỗng như mảng rỗng (hiện ném `TypeError: slows is not
      iterable`); hoặc export sẵn `episodeTimeline(tap)`
- [ ] In **lỗi zod đã format** (hiện `SymbolicateableError: x.json: [` bị cắt cụt, phải chạy
      lại 2 lần mới moi ra được `path` và `message` thật)
- [ ] Cho phép **track rỗng** (hoặc tự lọc) thay vì chặn bằng *"Too small: expected array to
      have >=1 items"*
- [x] `--frames=A-B` **tự clamp** thay vì ném off-by-one (`durationInFrames 3219` mà xin
      `2490-3219` là hỏng cả lượt)
- [ ] `pnpm frames` in **danh sách đường dẫn dán được thẳng vào lệnh tiếp** — tên file bị đoán
      sai 2 lần (`-000108` vs `-00108`, `tap-7056` vs `tap-07056`), mỗi lần một lượt montage gãy
- [ ] `render_*` nhận cả `name` lẫn `character`; `list` nhận cả `action` lẫn `actions`
      (lỗi tham số MCP lặp ~3–4 lần mỗi session)
- [ ] Loader hiểu **loại `card` mới của repo tập** mà không phải chép loader
      (`pnpm frames` chết với *"No matching discriminator … options: ['the','man']"*)
- [ ] `describe_rig` công bố **hằng số chu kỳ của bộ sinh** (hip, knee, phase, arm, lean;
      `gait`, `RUN_OFFSET`) thay vì bắt đọc `dist/index.js`
- [ ] `describe_rig` / `docs` công bố **`groundY` theo tầng** — ca: `cast[].y` của người đứng
      trên nước là **đỉnh xúc tu**, không phải mực nước; lượt đầu trả sai làm nhân vật lơ lửng

---

## Cần vào `docs/` — quy ước đã chốt ở tập 01 nhưng chưa có chỗ

Tất cả đang sống trong memory cá nhân (`~/.claude`, **không đi theo repo**) hoặc trong
`kich-ban-tho.md` của tập. Mỗi tập mới sẽ dò lại từ đầu.

**`docs/03` — scene**
- [ ] Neo theo khung / theo camera / theo thế giới (xem § lớp hiệu ứng)
- [ ] `bg.scale ≥ 1,2` khi camera zoom 0,85
- [ ] PRNG của lớp code là **state ngầm** — mọi sửa phải kèm ảnh tham chiếu +
      `magick compare -metric AE`

**`docs/07` — làm một tập, phần lời dẫn và tiếng**
- [ ] Khối lời dẫn **1.200–1.600 ký tự**, sàn cứng 900
- [ ] `[pause]` mở đầu cue thứ 2 trở đi trong một khối — vừa cho nhịp video, vừa để
      `silencedetect` dò biên khi lượt gen web **không trả alignment**
- [ ] Cắt cue bằng `silencedetect -40dB:d=0.2..0.35`, padding 0,05 s trước / 0,15 s sau,
      `t_start` lùi thêm 0,30 s giữ hơi lấy đà
- [ ] **Đừng tin alignment ở khối dài có tag** — lệch sớm 0,6–2,6 s; kiểm RMS đuôi
- [ ] `afade` ở mép khối phải `areverse, afade, areverse`
- [ ] Chia một cue làm đôi khi tách shot: cắt tại khoảng lặng bằng `ffmpeg -c copy` —
      **không gen lại**, không tốn credit, không lệch alignment
- [ ] Đổi bè lát → mẫu thu thật phải tính lại `volume` (crest ~12 dB vs ~22 dB)
- [ ] **RMS cửa sổ 150 ms**, không phải RMS cả file, khi so hai tiếng lệch độ dài 7 lần
- [ ] Phân biệt hai mặt nền bằng **năng lượng < 300 Hz** (4,4% vs 48,5% — chênh 10 lần),
      không bằng độ sáng
- [ ] Chọn take bằng **mật độ ngắt > 0,25 s**, không bằng cao độ (f0 chênh < 3%, vô dụng)
- [ ] Bè nền đặt ở **tầng tập**, không tầng shot, khi nhiều shot cắt trên cùng một cảnh
- [ ] ElevenLabs, đã trả giá để biết: đọc header `character-cost` (số dư
      `/v1/user/subscription` luôn ra 0 vì cập nhật trễ) · `loop=True` **luôn dôi 0,4–0,5 s** ·
      **không gen được tiếng gót sáng**, **không gen được tiếng sét có cú nổ ở đầu** (2 lượt,
      đỉnh rơi vào giây 0,46 và 0,83 — cuối cùng phải cắt từ bản thu thật) · lịch sử **không ghi
      `voice_id`**, phân biệt giọng bằng trọng tâm phổ · v3 bỏ qua Similarity, Speed và Speaker
      Boost · ID chỉ sống 2 giờ · v3 **5.000 ký tự/lượt** · **tính theo ký tự nên đọc nhanh hơn
      = tốn tiền hơn** · Free không có API, không có commercial license
- [ ] Mẫu tiếng tải về là **nguồn** → vào `LOCAL` pack + sha256 + công thức `sfx.py`, không thả
      thẳng vào `assets/audio/`. Nghĩa vụ **CC-BY** ghi ở sidecar; nên có `assets/audio/CREDITS.md`
- [ ] Tốc độ đọc lời dẫn **~14 ký tự/giây** để ước thời lượng shot

**`docs/05` — repo video, phần render**
- [x] Sửa file tiếng xong **phải restart Remotion Studio** trước khi nghe (cache độ dài audio)
      — vào `docs/07` § Bè lặp, cùng chỗ nói bảng đo khoá theo URL
- [ ] `ffmpeg -vsync` đã bỏ → `-fps_mode passthrough` (vấp 2 lần ở 2 session khác nhau)
- [ ] Không render preview bằng `--height`/`--scale` lẻ
- [ ] **Dời mốc camera** chứ không dời ranh giới shot thì cue tiếng đứng yên (79 cue giữ nguyên)
- [ ] Khử nháy cú cắt bằng cách ghép shot sang cảnh trước, để cú cắt rơi đúng chỗ máy zoom
- [ ] Đừng xem `check` bằng `tail`

---

## Đề nghị cho `AGENTS.md` của repo video (sinh lúc `init`)

Nhóm sai lầm lặp lại của agent — **rẻ nhất trong tất cả**, và đang tốn nhiều vòng nhất.

- [ ] § Vòng lặp: mở đầu mỗi session dựng cảnh là `git pull` → `git status` → đọc § khối tương
      ứng trong kịch bản → **báo bảng thiếu, chờ duyệt** rồi mới làm.
      (Người dùng đã phải tự yêu cầu điều này ở ≥3 session)
- [ ] Yêu cầu nêu đúng **một tầng** (hiệu ứng / hành động / cảnh) thì chỉ chạm tầng ấy; cần
      cảnh tạm để soi thì nói trước rồi xoá.
      Ca: dựng xong hẳn một action + một cảnh rồi mới bị chặn — *"Không cần hành động và cảnh.
      Chỉ cần làm hiệu ứng thôi"*
- [ ] **Không thêm hiệu ứng nào không được gọi tên.**
      Ca: tự thêm cú lật mượt 0,7 s → *"2D mà xoay làm sao được. Xoay phát là xoay luôn thôi."*
- [ ] **Câu mô tả trạng thái là yêu cầu, không phải báo lỗi** — hỏi lại một dòng trước khi sửa.
      Ca: *"mưa gió không biến mất, 2 lính vẫn giữ nguyên biểu cảm sợ hãi"* → agent cho mưa tan
      sớm → ***"ý là tôi muốn như vậy mà? sao bạn lại làm ngược lại?"***
- [ ] Việc chạm code lớp vẽ: **trình bảng số + phương án trước khi sửa file**, không sửa rồi
      mới trình (một refactor bị bác nguyên khối, phải viết lại code + viết đè cả kịch bản)
- [ ] **`scene_probe` trước khi ghi toạ độ**, không phải sau khi render thấy sai.
      Ca: 5 vòng render-nhìn-đoán để nâng kiệu lên vai, chỉ **đến cuối** mới đo
- [ ] **Đừng kết luận về màu/nét từ contact sheet thu nhỏ.**
      Ca: phán *"nét vẽ lệch hẳn… phải vẽ lại toàn bộ nền và nước"*, người dùng phản bác, agent
      tự rút lại — thực tế khác **đúng một dòng**
- [ ] Với yêu cầu về **chuyển động**, hỏi lại phạm vi ("cả cảnh hay chỉ đoạn đó?")
- [ ] **Quyết định nội dung tập → file trong repo**; memory chỉ giữ mẹo kỹ thuật lặp giữa các
      tập. Ca: ***"Sao lại lưu memory, phải lưu vào thư mục dự án chứ."***
- [ ] Việc dở thì **commit WIP hoặc tách nhánh, đừng `rm`** (mất tờ thể lệ, 7 giờ sau phải gen
      và cắt lại từ đầu, rồi nó thành đạo cụ chính của một shot)
- [ ] **Mỗi agent một worktree**; đừng `git stash` khi có phiên song song
      (va chạm working tree ở ≥4 session: `src/tmp-water-march/` xuất hiện giữa chừng làm
      typecheck vỡ; `git pull --rebase` gãy vì unstaged)
- [ ] Dùng **Edit tool cho `.tsx`**, không `python3 replace`; nếu vẫn script thì bắt buộc
      `assert count == 1` và `pnpm typecheck` ngay sau mỗi lượt vá
- [ ] Luôn mở đầu Bash bằng `cd <abs> &&` (cwd reset ≥3 lần/session ở 5 session)
- [ ] Nhắc quy ước **ngôn ngữ** ngay đầu file kèm ví dụ (3/7 session một nhóm mở đầu bằng
      tiếng Anh)

---

## Ngoài công cụ

- [ ] **Skill dựng kịch bản riêng cho repo video.** Người dùng tự nêu đây là chỗ tốn nhất:
      *"bước nghĩ rồi sửa rồi chốt kịch bản (cả setup các scene) tốn khá nhiều thời gian"*.
      Skill công khai không dùng được — *"không biết `shots[]`, không biết cue phải là file
      riêng… nó thêm việc chứ không bớt"*. Ghép `docs/07` (ràng buộc kỹ thuật) với phần kể
      chuyện, và có bước **"chốt bố cục trước khi chạm file"**
- [ ] **`stickman status` / `TRANG-THAI.md` sinh tự động** (cảnh nào xong, shot nào có tiếng,
      đang nợ gì). Hiện mỗi session mất **15–25 tool call** chỉ để dựng lại ngữ cảnh, và bàn
      giao giữa phiên phải **chép tay thành prompt 15 dòng**
- [ ] **Mẫu bản duyệt thoại cố định**: mỗi shot một khối "mô tả hình + thoại trong ngoặc kép +
      số giây ước", đánh số, **không dùng bảng** (*"Đừng output dạng bảng, khó đọc lắm"*).
      Một lượt chốt thoại tốn **109 phút hội thoại thuần**
- [ ] **Kênh góp ý gắn với khung/thời điểm.** 4/7 session một nhóm có message **chỉ gồm ảnh
      chụp, không kèm chữ** — dấu hiệu thiếu chỗ để chỉ vào đúng khung mà nói
- [ ] Quy ước: **chốt chữ + fact-check cả khối trước khi thu bất kỳ cue nào của khối đó**
- [ ] Không chạy render và build web song song (máy 16 GB chạm trần, task nền bị kill)
