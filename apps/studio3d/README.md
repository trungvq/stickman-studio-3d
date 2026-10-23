# Studio 3D

Trang xem cảnh three của một repo video: cùng `worldOf` / `buildWorld` mà Remotion vẽ (`Scene3D` của repo), tua giây,
camera cảnh hay camera tự do, soi bàn tay và số đo cầm đồ, soạn kiểu cầm bằng mắt, sửa mốc tay và mốc món trên thanh tua
([Dáng tay](#dáng-tay)). Studio 2D (`apps/studio`: nhân vật,
hành động, mảnh) chạy bằng `stickman studio2d`.

## Chạy

Trong repo video (lệnh `stickman studio` của `@stickman3d/cli`, cùng Vite đi theo CLI):

```bash
pnpm studio                       # http://localhost:5180/?scene=t02-s036-lay-het
pnpm studio --port 5190           # cổng khác
pnpm studio --host 0.0.0.0        # nghe cả mạng: cùng hai đường ghi dưới đây, chỉ dùng trên mạng tin được
```

Trong repo này, xem một repo video bằng mã nguồn rig của chính repo này:

```bash
pnpm --filter @stickman3d/rig build && pnpm --filter @stickman3d/sketch build && pnpm --filter @stickman3d/fx build
STICKMAN_ROOT=~/Work/Dev/youtube-video/jp-sukatto-nhom-cam pnpm --filter studio3d dev
```

Cả hai dùng chung cấu hình `studio3dConfig` (`packages/cli/studio3d.mjs`); `vite.config.ts` ở đây chỉ gọi nó.

- **Gốc là repo video** (thư mục đang đứng; `STICKMAN_ROOT` khi chạy trong repo này, bỏ trống là
  `../youtube-video/jp-sukatto-nhom-cam` cạnh repo này). Trang đọc cảnh ở `scenes/`, dữ liệu qua `worldData` của CLI (đọc
  lại mỗi lần nạp cảnh), cảnh three qua `stickman.world` của `package.json` repo. Cảnh không có trong `worldOf` thì dựng
  `plainRoom()`. Món `held/` đọc thêm bản JSON thô, parse bằng rig của trang (`worldData` dùng rig bản dựng của CLI, có
  thể cắt mất trường mới như `authored`).
- **Rig của trang.** `stickman studio` lấy `@stickman3d/rig`, `sketch`, `fx` mà repo video nạp: gói `link:` tới một cây
  nguồn thì trang lấy `src/` (sửa rig là trang nạp lại), cài từ registry thì `dist`. Chạy trong repo này thì luôn là `src/`
  của repo này. `three`, `react`, `zod` lấy bản của repo video (thiếu thì bản của app): trang và file của repo video chung
  một bản mỗi gói. `remotion` nhận bản rỗng (`src/hollow.ts`). Bản dựng của ba gói chỉ cho phía Node (`worldData`).
- **Ghi.** Hai đường, cả hai kiểm hash, vá JSON thô và giữ `<file>.json.bak`:
  - `POST /api/scene?name=<cảnh>` `{ hash, scene }`: `scene` là JSON thô của cảnh đã sửa; server lấy `cast[*].world.hands`
    và `items` của nó vá vào file trên đĩa; `scene` thiếu khoá nào thì khoá ấy trên đĩa giữ nguyên, xoá hết là gửi mảng
    rỗng (`items: []`, `hands: []` ghi thành mảng rỗng). Phần khác của `scene` khác đĩa thì 400. Trả `{ file, raw, hash }`.
  - `POST /api/held?name=<món>` `{ hash, group, variant, authored }`: **Lưu** của khung soạn kiểu cầm ghi `authored` của
    món × nhóm × biến thể (`authored: null` là xoá). `STUDIO3D_HELD_OUT=<thư mục>` đổi hướng ghi sang thư mục ấy và đọc nó
    phủ lên `held/` — thử mà không đụng repo video.
- **Hash.** `GET /api/scene` trả `hash` của file cảnh và `heldHash` của từng món, là sha256 của byte trên đĩa lúc nạp. Lưu
  gửi kèm hash ấy; file đã đổi từ lúc nạp thì server trả 409 (`{ error, conflict: true, hash }`) và không ghi. Lượt ghi
  của một file xếp hàng; ngay trước khi ghi server đọc lại file và so hash lần nữa, `.bak` lấy từ đúng byte vừa đọc lại —
  hai lần lưu cùng hash thì lần sau 409, ai ghi file trong lúc server đang vá cũng làm lần lưu ấy 409.
- **Vá JSON thô.** Server không ghi lại object đã parse (zod bỏ trường schema không biết, như `hand` trong mốc tay của vài
  cảnh): nó viết lại đúng những giá trị đổi trên chữ của file (`rawjson.mjs`), giữ mọi trường khác và thứ tự khoá. File đúng
  lối `JSON.stringify(…, null, 2)` giữ lối ấy, file đúng lối prettier (cấu hình của repo video) thì chạy prettier sau khi vá,
  file khác chỉ đổi chỗ vá (đoạn chèn theo kiểu xuống dòng và bậc thụt của file). Kết quả phải qua `parseScene` /
  `parseHeldItem` của rig trang dùng; hỏng thì 400, không ghi.

## Phím

| Phím | Việc |
|---|---|
| Space | Phát / dừng |
| ← → | Lùi / tới một khung (1/30 s); giữ Shift: 10 khung |
| C | Đổi camera cảnh ↔ camera tự do |
| R | Nạp lại cảnh từ đĩa, giữ giây đang xem (có thay đổi chưa lưu thì hỏi trước); chỉ đổi mốc tay, mốc món thì làm mới tại chỗ, không dựng lại lưới (`world.refresh`) |
| Shift+R | Dựng lại cả cảnh, giữ bản đang sửa: đồ riêng của repo đọc `world.hands` lúc dựng |
| Ctrl+Z · Ctrl+Shift+Z, Ctrl+Y | Hoàn tác · làm lại (lịch sử chung của cảnh) |
| Ctrl+S | Lưu mốc tay, mốc món vào `scenes/` |
| Del, Backspace | Xoá mốc đang mở thẻ (Dáng tay) |
| W S · A D · Q E | Camera tự do: tiến / lùi, sang trái / phải, xuống / lên (theo hướng camera); giữ Shift: nhanh gấp 3 |
| Esc | Đóng thẻ mốc; không có thẻ thì bỏ chọn bàn tay |

Khung soạn kiểu cầm có phím, chuột riêng ([bên dưới](#soạn-kiểu-cầm)).

Camera tự do bắt đầu ở chỗ camera cảnh đang đứng.

| Chuột / touchpad | Việc |
|---|---|
| Kéo chuột trái | Xoay quanh tâm xoay |
| Kéo chuột phải, chuột giữa, Shift + chuột trái | Dời (pan) |
| Lăn bánh xe chuột | Tiến lùi theo con trỏ |
| Hai ngón kéo trên touchpad | Dời |
| Ctrl + lăn, chụm / mở hai ngón | Tiến lùi |
| Nhấp đúp | Đặt tâm xoay vào chỗ nhấp |
| Nhấp (không kéo) lên bàn tay hay món đang cầm | Chọn bàn tay ấy, camera tự do bay tới cận tay |

Ô **Lăn** trên thanh trên: `tự nhận` (lần lăn có `deltaX`, số lẻ hay nhỏ là touchpad → dời; bánh xe chuột → tiến lùi), `tiến
lùi`, `dời`; nhớ trong `localStorage`. URL giữ cảnh, giây và kiểu camera (`?scene=…&t=…&cam=free`).

## Bàn tay

Panel bên phải (nút ⇆ gập / mở) liệt kê mọi bàn tay của người mặc đồ đang hiện ở giây đang xem: người, tay, món đang cầm
`món@nhóm/biến thể` (đường cũ ghi dáng, món treo ghi `@carry`); `!` / `!!` là tay đang phạm luật `held` (cảnh báo / lỗi). Bấm
dòng hay nhấp lên bàn tay / món trên hình (cả camera cảnh) để chọn tay:

- camera tự do bay tới cận bàn tay (tâm xoay ở tâm nắm, khung vừa bàn tay + món); nút **Trước**, **Chéo**, **Ngang** như
  `can-tay` của repo video, **Sau lưng** khi tay ở sau thân. **Camera bám theo tay khi tua** dời camera theo tâm nắm khi đổi giây.
- số đo cầm đồ ở giây đang xem bằng chính phép đo của `check` nhóm `held` (`heldHands`, `heldHits`, `heldSummary` của rig,
  ngưỡng `stickman.held` của `package.json` repo): lựa chọn cầm của bộ giải kèm nguồn (`·rig` rig giải, `·mđ` mặc định nhóm),
  luật phạm (`!! pierce`, `sink`, `loose`, `role`, `oppose`, `grip`, `wrist`, `reach`, `elbow`, `arm`, `size`, `up`/`face` — món
  quay sai ý định), khe da từng ngón và lòng tay theo vai trò, dòng tóm tắt như `check`. Luật đo trên cả lần cầm (`drift`,
  `jump`) và cửa sổ hoà `HOLD_BLEND` không xét ở đây. Đang phát thì không đo; dừng là đo.
- trên hình: vòng cam ở tâm nắm; đốt lún quá `sink` tô đỏ, ngón vai trò (`press`/`wrap`/`tip`) còn hở quá `wrap` tô vàng.

## Soạn kiểu cầm

Từ bàn tay đang chọn (chỗ cầm nhóm `món@nhóm` của món có `shape`): **Chỉnh kiểu cầm này**. Khung soạn chỉ có bàn tay **phải**
cỡ tay của người ấy (`k`, `long` như rig) và bản sao lưới món của cảnh, bàn tay đứng yên. Bắt đầu từ khung cầm cảnh đang dùng
(bản soạn nếu món đã có, không thì bộ giải); **Điểm đầu** chọn lại `Rig đoán` hay một dáng `HAND_POSES` (chỉ ngón).

- **Vẽ như cảnh.** Khung soạn là một sân khấu riêng của rig (`createStage`, cùng pipeline): món giữ nguyên vật liệu của cảnh
  (NPR, decal chữ, màn hình, vỏ viền mực), bàn tay dùng da và vỏ nét của bàn tay trong cảnh, đèn theo giờ và đèn trần của cảnh
  ở giây ấy (bỏ đèn đặt chỗ: khung soạn không có phòng). Món trông khác cảnh là món trong cảnh đã khác — nhìn bằng **Khung cảnh**.
- **Hướng như cảnh.** Bàn tay xoay đúng như trong cảnh, mở ra ở góc **Như trong cảnh**: nhìn bàn tay từ đúng hướng camera đang
  xem (camera cảnh hay camera tự do). Bóng mờ **cẳng tay** đi từ cổ tay tới khuỷu của cảnh ở giây ấy. Tay trái soạn bằng tay
  phải trong gương: cả bàn tay, cẳng tay và hướng nhìn soi gương. Nút **Như trong cảnh**, **Trước**, **Chéo**, **Ngang** (như
  `can-tay`), **Lòng tay**, **Mu tay** (phím 1–6) bay mượt tới góc ấy.
- **Ngón.** Nhấp lên một ngón trên hình để chọn (cam sáng); thẻ cạnh khung hiện đúng các thanh của ngón ấy, kể cả độ gập
  thêm từng đốt (`HAND_FIT`). Giữa, áp út, út chung góc gập (`fingers`): thanh "chung" gập cả ba, thanh "riêng" là `HAND_FIT`
  của ngón đang chọn. Rê lên ngón khác: ngón ấy sáng nhạt; rê lên một thanh (thẻ hay panel): đốt nó đổi sáng xanh trên hình.
  Panel bên giữ đủ mọi thanh, nhóm theo ngón, và tầm ngón tự ôm thêm (`heldFit`, `curl`; `0` giữ đúng dáng soạn).
- **Món.** Gizmo nhỏ nằm lệch khỏi tâm nắm (đường cam nối về tâm nắm), không đè ngón: kéo nó là dời / xoay món **quanh tâm
  nắm**. T / Y dời / xoay, X đổi trục (món → bàn tay → thế giới), G ẩn / hiện; **bước nhỏ**: 0,1 đơn vị rig, 1°.
- **Hoàn tác / Làm lại** (Ctrl+Z / Ctrl+Shift+Z, Ctrl+Y) cho mọi thao tác soạn: ngón, món, điểm đầu, `curl`.
- Mỗi lần đổi, rig dựng lại khung cầm từ bản soạn đúng như cảnh sẽ dựng (`authoredFrom` → `graspFrame`), ngón ôm, đo lún / hở
  / xương ngón / tâm nắm / lực đối (`heldHits`). Ngón lún quá `sink` tô đỏ, ngón vai trò còn hở quá `wrap` tô vàng — tô mỏng
  trên chính da, có che khuất. **hình va chạm**: khung dây `shape` của món. **tay nhỏ / lớn nhất**: bàn tay nhỏ nhất và lớn nhất
  của dàn nhân vật cầm cùng bản soạn, hai bên.

| Chuột / phím trong khung soạn | Việc |
|---|---|
| Kéo chuột trái (chỗ trống, món, ngón chưa chọn) | Xoay quanh tâm xoay |
| Kéo chuột phải, chuột giữa, Shift + chuột trái; hai ngón trên touchpad | Dời |
| Lăn bánh xe chuột; Ctrl + lăn, chụm / mở hai ngón | Tiến lùi theo con trỏ |
| Nhấp đúp | Đặt tâm xoay vào chỗ nhấp trên bàn tay / món |
| Nhấp lên ngón · nhấp chỗ khác · Esc | Chọn ngón · bỏ chọn |
| Kéo lên / xuống trên ngón **đang chọn** | Gập / duỗi cả ngón (gốc + ngọn); giữ Shift: chỉ đốt ngọn; giữ Ctrl: riêng ngón ấy (`HAND_FIT`) |
| Alt + lăn | Như kéo trên ngón đang chọn (Shift, Ctrl như trên) |
| 1 – 6 | Như trong cảnh, Trước, Chéo, Ngang, Lòng tay, Mu tay |
| T · Y · X · G | Món dời / xoay · đổi trục gizmo · ẩn / hiện gizmo |
| Ctrl+Z · Ctrl+Shift+Z | Hoàn tác · làm lại |

Lăn theo ô **Lăn** của thanh trên như camera tự do. Khi khung soạn đang hiện, Space, ← →, C, R, WASD/QE không tới cảnh và
camera ngầm phía sau; thả một thanh kéo (hay nhấp vào khung) là thanh ấy thôi nhận phím mũi tên.
- **Khung cảnh (áp tạm)** dựng lại cảnh ở giây ấy với bản soạn chưa lưu để xem cổ tay, khuỷu; **Khung soạn** quay lại.
- **Lưu** ghi bản soạn (xem trên); **Xoá bản soạn** bỏ nó; **Thoát** bỏ phần áp tạm chưa lưu. Tay trái lấy gương tự động; rig
  dùng bản soạn cho mọi cảnh cầm món × nhóm × biến thể ấy (docs/11-nhom-cam.md § Kiểu cầm soạn tay).

Rê chuột lên đồng hồ góc phải: ms tính tư thế (`stage.pose`) và ms vẽ của khung vừa vẽ.

## Dáng tay

Công tắc **Xem / Dáng tay** trên thanh trên (nhớ trong `localStorage`). Ở Dáng tay, bấm một bàn tay (trên hình hay trong
panel) là chọn người × tay: thanh tua thêm một hàng cho mỗi tay của người ấy và một hàng **Món** cho các mốc `items[]` của
món tay đang chọn cầm (mọi lần cầm của tay ấy). Nhấp nhãn hàng tay là chọn tay ấy.

- **Ký hiệu.** Mốc tay tròn, mốc chỉ có `hold` vòng rỗng, mốc `null` chấm xám, mốc món thoi; viền tím là mốc khoá khuỷu
  (`elbowLock`), viền cam là mốc đang mở thẻ. Rê lên mốc: trường `t` như JSON (`@tra+0.6 = 4.000 s`), loại mốc, `ease`.
- **Dải dưới hàng tay là lần cầm** (`holdRuns`), nhãn `món@nhóm/biến thể` (tay phụ của `both` ghi `(phụ)`): xanh lá tay theo
  đồ (theo mốc, hai tay), xanh dương đồ theo tay, xám tay tự do; sọc là `HOLD_BLEND` ở đầu lần cầm (trừ lần cầm từ giây 0)
  và lúc nhả món đặt trước, nhãn nằm trên nền màu dải, không bị sọc che.
- **Nhấp mốc**: tua tới mốc, mở thẻ mốc ở đầu panel. Vùng chạm của mốc rộng ít nhất 16 px; hai mốc gần nhau thì mốc có
  tâm gần con trỏ nhất nhận. **Kéo mốc**: dời `t`, bám lưới khung (1/30 s) tính từ mốc tên của
  mốc; mốc tên giữ dạng `@tên±Δ` (`@tra` kéo 0,2 s là `@tra+0.2`), mốc số giữ số. Giữ **Alt** khi thả: bắt vào mốc tên gần
  nhất (`@tên`). Dòng mốc tay nhắc cả hai tay thì tay được kéo tách ra dòng mới; giây mới trùng một dòng mốc khác của người
  ấy thì gộp vào dòng ấy (`t` của dòng mốc tay, của mốc cùng món phải tăng hẳn). Tay đã có mốc ở giây ấy thì báo lỗi.
- **＋** ở cuối hàng: thêm mốc ở giây đang xem, `ease: "auto"`, hình ở giây ấy giữ nguyên. Giá trị đầu lấy thứ đang vẽ, rồi
  trang dựng lại cảnh với mốc mới, đo tâm nắm và cổ tay (mốc món: tâm món) ở giây ấy và bù `at` cho tới khi lệch không quá
  0,5 px (`plus.ts`); không được thì **không thêm**, thanh trạng thái nêu lý do, độ lệch và giây gần nhất thêm được (tìm
  trong ±1 s). Thanh trạng thái báo độ lệch còn lại của mốc vừa thêm.
  - tay theo đồ (theo mốc, hai tay): mốc chỉ có `hold` — chép `hold` có hiệu lực (bỏ `regrip`), trường số của chỗ cầm trượt
    (`along`, `slant`…) lấy lựa chọn đang vẽ —, nên lần cầm không bị cắt và mốc không khai đích;
  - đồ theo tay, tay tự do: phần đích đang là `0` thì `null`; không thì `at` là điểm bàn tay theo `point` của mốc kề (tâm
    nắm hay cổ tay; điểm khác thì tâm nắm, `point: "grip"`), lần cầm đi tiếp. Tay tự do chép `palm`, `fingers`, `bend` của
    mốc trước; `elbow` theo mốc kề (hai mốc kề khác nhau thì nội suy thẳng), khuỷu đang khoá hẳn thì khoá vào hướng khuỷu
    đang vẽ. Đồ theo tay ghi thêm `hold` cùng chỗ cầm với ý định là hướng món đang vẽ — `face`, `roll` trục khung món
    `[0, 0, 1]`, `[0, 1, 0]` về vectơ hệ thân, ngang ra ngoài phía tay ấy, như `holdToHandLed` — và mốc kề không khai
    `elbow` thì `elbow` là khuỷu đang vẽ, để bàn tay không xoay khác; bản ấy lệch hơn bản giữ ý định của `hold` trước thì
    dùng bản sau. Mốc kề đặt theo mốc thân (`to`) thì mốc mới vẫn ghi `at` thế giới: người đi giữa hai mốc thì đoạn kề lệch;
  - trong `HOLD_BLEND` (vừa buông, vừa đổi lần cầm) bàn tay đang hoà từ nghiệm cũ: `at` ghi đúng điểm đang vẽ thì phần hoà
    kéo bàn tay đi chỗ khác, nên `at` được bù — dời khỏi điểm đang vẽ để sau phần hoà ra đúng chỗ ấy; hết quãng hoà bàn tay
    tới đúng `at` đã bù. Thẻ mốc nêu khoảng dời;
  - hàng Món (chỉ lần cầm tay theo đồ): tâm hộp bao của món đang vẽ ở `at`, hướng bằng `face` / `roll` trục khung món
    `[0, 0, 1]`, `[0, 1, 0]` về vectơ hệ thân người cầm, như `holdToItemLed`.

  Hình chỉ giữ ở đúng giây của mốc: quanh mốc, đường tay đổi theo mốc mới — mốc sau không phải `auto` thì đoạn từ mốc mới
  tới nó bắt đầu từ vận tốc `0` (bàn tay dừng ở mốc mới).
- **Thẻ mốc**: `ease` (ô 4 số khi `bezier`, mặc định `BEZIER_DEFAULT`); `hold` (không khai / buông `null` / cầm: món,
  nhóm, biến thể — kiểu có tên hiện kèm `note`; `hold` dạng chuỗi ghi lại chuỗi, dạng object đổi `item`, `group`,
  `variant`, đổi món hay nhóm thì bỏ trường chỗ cầm cũ `part`, `edge`, `along`…, giữ ý định và trường lạ; đổi món thì
  trang thử nhóm đang chọn rồi lần lượt các nhóm khác, áp nhóm đầu tiên mà cảnh giải được tay ở mốc, không nhóm nào được
  thì không áp và báo lỗi); `elbowLock` (mốc chưa có `elbow` thì lấy hướng khuỷu đang vẽ ở mốc; khoá không có tác dụng ở mốc thì thẻ
  báo); "ảnh hưởng tới …s" — ước: tới mốc kế của cùng tay, cùng món (chuỗi `auto` thêm một mốc), đồ theo tay còn kéo dài vài
  khung do giới hạn tốc độ; JSON thô của mốc kèm nút chép (mở hay đóng giữ qua các lần vẽ lại thẻ); **Xoá mốc** (Del). Mốc tay cuối cùng của một người không xoá
  được (`world.hands` không rỗng).
- **Mốc studio thêm hay sửa** (dời, đổi `hold`, `elbowLock`) mà chưa khai `ease` thì ghi `ease: "auto"`; mốc đã khai `ease`
  giữ nguyên. Đổi `ease` chỉ qua thẻ mốc.
- **Sửa trên JSON thô.** Mọi thao tác sửa bản JSON thô của cảnh trong trang (giữ trường lạ như `hand` của vài mốc, giữ mốc
  tên), rồi parse và làm mới tại chỗ (`world.refresh`); không làm mới được thì dựng lại cả cảnh. Bản sửa hỏng schema hay
  `resolveScene` ném thì không áp, thanh trạng thái báo lý do; dựng lại cả cảnh hỏng thì về bản trước, lời báo lỗi còn lại.
- **Lịch sử chung** cho cảnh, mỗi bước là ảnh chụp JSON thô; thao tác không đổi gì không thành bước: ↶ ↷ trên thanh trên, Ctrl+Z / Ctrl+Shift+Z. Khung soạn kiểu cầm
  đang mở thì giữ lịch sử riêng, lịch sử cảnh tạm khoá.
- **Lưu** (Ctrl+S): chấm cam là có thay đổi chưa lưu. Ghi `POST /api/scene` kèm hash lúc nạp; lưu xong lịch sử còn nguyên.
  **Bỏ thay đổi** về bản đã lưu (là một bước, hoàn tác được). File cảnh đổi trên đĩa từ lúc nạp thì server trả 409, không có cách ghi đè: hộp
  báo cho **Tải bản đĩa về** — bản đĩa vào thành một bước mới của lịch sử (hash mới, là bản đã lưu), Ctrl+Z quay lại bản
  của mình để so; lưu lại bản ấy thì server chỉ nhận khi phần ngoài mốc tay, mốc món khớp đĩa —, **Chép mốc của mình**
  (`hands` từng người và `items`, JSON) hay **Giữ bản mình**. Đổi cảnh, R, đóng trang đều hỏi trước khi bỏ thay đổi chưa lưu.
- **File repo video đổi trên đĩa** (cảnh, món mà `src/` của repo nhập — kể cả lúc Lưu): trang nhận module cảnh three mới
  tại chỗ, không nạp lại trang; lần dựng cảnh sau (Shift+R) dùng bản mới.
- **Màn hẹp** (≤ 760 px): camera, AA, Lăn gập sau nút ⋯; panel bàn tay xuống dưới khung vẽ. Ở Xem thanh tua vừa bề ngang;
  ở Dáng tay thanh tua rộng 720 px, cuộn ngang, luôn tự cuộn theo giây đang xem (cả khi chưa chọn tay).

## Lưu ý khi xem bằng camera tự do

Vài thứ của rig dựng theo ống kính của cảnh, không theo camera đang xem: lớp miệng lật về phía ống kính khi mặt gần
nghiêng, tay "gần" / "xa" gán theo phía ống kính, vỏ phòng ẩn tường theo camera đang xem (`room.cull`). Nhìn từ góc khác
thì chúng có thể lạ; đó không phải lỗi của cảnh.
