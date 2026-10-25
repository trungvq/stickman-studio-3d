# Studio 3D

Trang xem cảnh three của một repo video: cùng `worldOf` / `buildWorld` mà Remotion vẽ (`Scene3D` của repo), tua giây,
camera cảnh hay camera tự do, soi bàn tay và số đo cầm đồ, soạn kiểu cầm bằng mắt, chỉnh dáng ngón của tay không cầm đồ
thành dáng có tên dùng lại được, sửa mốc tay và mốc món trên thanh tua ([Dáng tay](#dáng-tay)). Studio 2D (`apps/studio`: nhân vật,
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
  thể cắt mất trường mới như `authored`); dáng tay `hands/` của repo cũng thế, đè lên thư viện hai lớp của `worldData`.
- **Rig của trang.** `stickman studio` lấy `@stickman3d/rig`, `sketch`, `fx` mà repo video nạp: gói `link:` tới một cây
  nguồn thì trang lấy `src/` (sửa rig là trang nạp lại), cài từ registry thì `dist`. Chạy trong repo này thì luôn là `src/`
  của repo này. `three`, `react`, `zod` lấy bản của repo video (thiếu thì bản của app): trang và file của repo video chung
  một bản mỗi gói. `remotion` nhận bản rỗng (`src/hollow.ts`). Bản dựng của ba gói chỉ cho phía Node (`worldData`).
- **Ghi.** Ba đường, cả ba kiểm hash, vá JSON thô và giữ `<file>.json.bak`:
  - `POST /api/scene?name=<cảnh>` `{ hash, scene }`: `scene` là JSON thô của cảnh đã sửa; server lấy `cast[*].world.hands`,
    `cast[*].tracks` và `items` của nó vá vào file trên đĩa; `scene` thiếu khoá nào thì khoá ấy trên đĩa giữ nguyên, xoá hết là gửi mảng
    rỗng (`items: []`, `hands: []` ghi thành mảng rỗng), `items: null` bỏ cả khoá `items` (trang gửi khi bản đang sửa không còn
    khoá ấy mà bản đã lưu có). `schemaVersion` số lớn hơn đĩa thì lên theo: trang nạp cảnh đời trước mà `migrateScene` chỉ đổi số ấy thì nâng ngay trong bản sửa (`sceneVersionUp`), nên `elbow` hệ thân trang ghi lên mốc không có `at` đọc đúng nghĩa ở lần nạp sau. Phần khác của `scene` khác đĩa thì 400. Trả `{ file, raw, hash }`.
  - `POST /api/held?name=<món>` `{ hash, group, variant, authored }`: **Lưu** của khung soạn kiểu cầm ghi `authored` của
    món × nhóm × biến thể (`authored: null` là xoá). Món còn kiểu cầm có tên (`base` / `note`) mà `schemaVersion` cũ hơn
    `HELD_VERSION` của rig thì ghi lên `HELD_VERSION`. `STUDIO3D_HELD_OUT=<thư mục>` đổi hướng ghi sang thư mục ấy và đọc nó
    phủ lên `held/` — thử mà không đụng repo video.
  - `POST /api/hands?name=<dáng>` `{ hash, shape }`: khung chỉnh dáng tay ghi `hands/<dáng>.json` của repo. `hash: null` là
    tạo mới — file đã có thì 409; tên sai (`handShapeNameProblem`: chữ thường, số, gạch nối, không trùng `HAND_POSES`) hay
    `shape` không qua `parseHandShape` thì 400. Trả `{ file, shape, hash }`.
- **Ảnh.** `POST /api/snap?name=<cảnh>` `{ png, t }`: `png` là PNG base64 của **Chép view**, ghi vào
  `tmp/studio3d/<cảnh>-<giây>s.png` của repo, trả `{ file }`. Cảnh không có thì 404, không phải PNG thì 400.
- **Hash.** `GET /api/scene` trả `hash` của file cảnh, `heldHash` của từng món và `handsHash` của từng dáng trong `hands/`, là sha256 của byte trên đĩa lúc nạp. Lưu
  gửi kèm hash ấy; file đã đổi từ lúc nạp thì server trả 409 (`{ error, conflict: true, hash }`) và không ghi. Lượt ghi
  của một file xếp hàng; ngay trước khi ghi server đọc lại file và so hash lần nữa, `.bak` lấy từ đúng byte vừa đọc lại —
  hai lần lưu cùng hash thì lần sau 409, ai ghi file trong lúc server đang vá cũng làm lần lưu ấy 409.
- **Vá JSON thô.** Server không ghi lại object đã parse (zod bỏ trường schema không biết, như `hand` trong mốc tay của vài
  cảnh): nó viết lại đúng những giá trị đổi trên chữ của file (`rawjson.mjs`), giữ mọi trường khác và thứ tự khoá. File đúng
  lối `JSON.stringify(…, null, 2)` giữ lối ấy, file đúng lối prettier (cấu hình của repo video) thì chạy prettier sau khi vá,
  file khác chỉ đổi chỗ vá (đoạn chèn theo kiểu xuống dòng và bậc thụt của file). Kết quả phải qua `parseScene` /
  `parseHeldItem` / `parseHandShape` của rig trang dùng; hỏng thì 400, không ghi.

## Phím

| Phím | Việc |
|---|---|
| Space | Phát / dừng |
| ← → | Lùi / tới một khung (1/30 s); giữ Shift: 10 khung |
| C | Đổi camera cảnh ↔ camera tự do |
| R | Nạp lại cảnh từ đĩa, giữ giây đang xem (có thay đổi chưa lưu thì hỏi trước); chỉ đổi mốc tay, mốc món thì làm mới tại chỗ, không dựng lại lưới (`world.refresh`) |
| Shift+R | Dựng lại cả cảnh, giữ bản đang sửa: đồ riêng của repo đọc `world.hands` lúc dựng |
| Ctrl+Z · Ctrl+Shift+Z, Ctrl+Y | Hoàn tác · làm lại (lịch sử chung của cảnh) |
| Ctrl+S | Lưu mốc tay, mốc món, track vào `scenes/` |
| Del, Backspace | Xoá mốc đang mở thẻ (Dáng tay) |
| T · Y | Tay nắm của bàn tay đang chọn: dời · xoay (Dáng tay) |
| H | Bật / tắt **Chỉ người này** (panel Bàn tay) |
| W S · A D · Q E | Camera tự do: tiến / lùi, sang trái / phải, xuống / lên (theo hướng camera); giữ Shift: nhanh gấp 3 |
| Esc | Đóng thẻ clip, thẻ lần cầm, thẻ mốc; không có thẻ thì bỏ chọn bàn tay |

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
lùi`, `dời`; nhớ trong `localStorage`. URL giữ view đang xem ([Chép view](#chép-view)).

## Chép view

Nút **Chép view** trên thanh trên dừng phát, vẽ lại và đo bàn tay ở giây đang xem, rồi:

- lưu ảnh khung vẽ đúng như trên màn hình (three, lớp phủ bàn tay, tay nắm, vệt) vào `tmp/studio3d/<cảnh>-<giây>s.png`
  của repo video, ghi đè ảnh cùng tên;
- chép vào clipboard một đoạn chữ cho agent: repo, file cảnh, giây, mốc gần, đường ảnh, link mở lại đúng view, camera,
  bàn tay đang chọn kèm nguồn dáng và số đo của nó, các tay đang cầm / treo đồ kèm luật phạm, cảnh báo khi có thay đổi
  chưa lưu (link và lệnh mở bản trên đĩa).

Camera ghi ở hệ của JSON cảnh, agent không phải quy đổi: camera cảnh là ống kính đang vẽ (`scene.lens`, hay ống kính
`worldOf` đặt theo giây) cùng khung cắt `cameraAt` ở giây ấy, kèm lệnh `stickman-render --three` vẽ lại khung không cần
trình duyệt; camera tự do quy sẵn ra một `"lens"` dán thẳng vào cảnh — với khung cắt `camera[]` ở x 0, y 0, zoom 1 thì
camera cảnh thấy đúng ảnh. Link mở lại giữ camera tự do ở hệ three (`pos`, `at`, `fov` dưới đây).

Trang không ở `localhost` / https (`--host` mở từ điện thoại qua `http://`) thì không có clipboard: đoạn chữ hiện trong
hộp, nút **Chép** trong hộp chép nó.

URL luôn giữ view đang xem, mở link là về đúng view ấy:

| Tham số | Nghĩa |
|---|---|
| `scene`, `t` | Cảnh, giây |
| `cam` | `scene` hay `free` |
| `pos`, `at`, `fov` | Camera tự do: chỗ đứng, tâm xoay (hệ three, `x,y,z`), fov dọc (độ); thiếu thì bắt đầu ở chỗ camera cảnh |
| `hand` | Bàn tay đang chọn, `<người>:right` / `<người>:left` |
| `solo=1` | Chỉ người này |
| `ed=hands` | Chế độ Dáng tay |

## Cảnh

Panel bên trái (nút ⇆ gập / mở, nhớ trong `localStorage`) liệt kê mọi cảnh ở `scenes/`, nhóm theo tập (`t01`, `t02`…;
cảnh không theo tập vào nhóm `khác`), cảnh đang mở viền cam. Ô lọc nhận nhiều từ (mọi từ phải có trong tên), Enter mở cảnh
đầu, Esc xoá lọc. Nhấp một cảnh là mở nó (có thay đổi chưa lưu thì hỏi trước). Màn hẹp (≤ 760 px, hay điện thoại ngang) panel
thành ngăn kéo mở bằng nút ☰ đầu thanh trên, chọn cảnh xong tự đóng; ô cảnh trên thanh trên vẫn gõ được.

## Bàn tay

Panel bên phải (nút ⇆ gập / mở) liệt kê mọi bàn tay của người mặc đồ đang hiện ở giây đang xem: người, tay, món đang cầm
`món@nhóm/biến thể` (đường cũ ghi dáng, món treo ghi `@carry`); `!` / `!!` là tay đang phạm luật `held` (cảnh báo / lỗi). Bấm
dòng hay nhấp lên bàn tay / món trên hình (cả camera cảnh) để chọn tay:

- camera tự do bay tới cận bàn tay (tâm xoay ở tâm nắm, khung vừa bàn tay + món); nút **Trước**, **Chéo**, **Ngang** như
  `can-tay` của repo video (ngang: ra ngoài phía tay ấy, theo hai vai), **Sau lưng** khi tay ở sau thân. Đường từ bàn tay tới
  camera vướng một lưới của cảnh (đầu, thân người khác, tường) thì hướng xoay quanh trục đứng tới ±50°, rồi camera kéo vào
  trước chỗ vướng. **Camera bám theo tay khi tua** dời camera theo tâm nắm khi đổi giây.
- **Chỉ người này** (phím H): khung vẽ chỉ còn người có bàn tay đang chọn và món người ấy đang cầm, treo; bối cảnh, người
  khác, đồ riêng của cảnh ẩn khi vẽ — vẽ nhanh hơn, bóng của tường và đồ đạc mất theo. Chỉ là ẩn trên hình: cảnh, bản đang
  sửa và lịch sử không đổi, số đo cầm đồ vẫn đo trên cảnh đủ người. Thứ đã ẩn không chặn nhấp chọn tay, nhấp đúp đặt tâm
  xoay hay đường camera của các góc cận tay. Chọn tay người khác thì hình theo người ấy; chưa chọn tay thì hiện cả cảnh.
  Công tắc giữ khi đổi cảnh, không nhớ qua lần mở trang. Khung soạn kiểu cầm không theo công tắc này.
- **Nguồn dáng** (chỉ đọc): cái gì đang điều khiển tay ấy ở giây đang xem, tính bằng `handSources` của rig (cùng phép tính
  với `sceneAt`) — tay gần hay xa ống kính và vì sao (`kênh xa → tay phải vì đang lật`), clip và track ghi góc **cánh tay**
  (không clip nào là `base`), clip và track ghi **bàn tay** kèm mốc bàn tay của hành động (`open 0.75 · palm down · fingers
  forward`), **mốc tay** `world.hands` đang áp (chỉ số, loại, giây, mốc sau, phần đích `w`, món). Dòng bàn tay tô vàng khi
  hành động khai ý định hướng tay (`palm` / `fingers`) mà tay không có mốc `world.hands` đang áp: clip soạn cho tay khác rơi
  vào tay này hay gặp nhất ở đây.
- **Về tư thế buông** (tay không cầm, không treo món): bỏ bàn tay của hành động ở tay ấy để tay rơi về dáng của track ghi
  góc cánh tay, không ghim chỗ. Mỗi track có clip đang chạy ghi bàn tay của tay ấy (`clipSides`): clip chỉ chạm tay ấy thì
  xoá (track hết clip thì bỏ track, như **Xoá clip** ở [Dáng tay](#dáng-tay)); clip chạm cả tay kia thì thêm mốc
  `{ "rest": true }` cho tay ấy ở giây đang xem (docs/03-scene.md#đích-bàn-tay-thế-giới) và mở thẻ của nó. Một bước lịch sử
  chung; lưu bằng **Lưu**. Nút tắt kèm lý do khi không clip nào ghi bàn tay ấy, tay đã buông hay cảnh đang dựng lại. Mốc
  `rest` buông cả quãng trước nó khi tay ấy chưa có mốc nào trước (trước mốc đầu tay giữ mốc đầu, như mọi mốc tay). Nguồn
  dáng ghi phần buông của mốc `rest` ở dòng bàn tay.
- số đo cầm đồ ở giây đang xem bằng chính phép đo của `check` nhóm `held` (`heldHands`, `heldHits`, `heldSummary` của rig,
  ngưỡng `stickman.held` của `package.json` repo): lựa chọn cầm của bộ giải kèm nguồn (`·rig` rig giải, `·mđ` mặc định nhóm),
  luật phạm (`!! pierce`, `sink`, `loose`, `role`, `oppose`, `grip`, `wrist`, `reach`, `elbow`, `arm`, `size`, `up`/`face` — món
  quay sai ý định), khe da từng ngón và lòng tay theo vai trò, dòng tóm tắt như `check`. Luật đo trên cả lần cầm (`drift`,
  `jump`) và cửa sổ hoà `HOLD_BLEND` không xét ở đây. Đang phát thì không đo; dừng là đo.
- trên hình: vòng cam ở tâm nắm; đốt lún quá `sink` tô đỏ, ngón vai trò (`press`/`wrap`/`tip`) còn hở quá `wrap` tô vàng.
- **Kiểu cầm** của lần cầm ở giây đang xem (`holdRuns`): **rig chọn** (cảnh không khai `variant` thì kèm biến thể gốc rig
  đang ra; cảnh khai thì nhấp là bỏ `variant`), các biến thể gốc của nhóm (`đã soạn` khi món có bản soạn), rồi kiểu cầm có
  tên của món kèm `base` và `note`; viền cam là kiểu cảnh đang khai. Lần cầm không có kiểu để chọn — món treo `carry`, bàn
  tay không giải chỗ cầm nhóm ở giây ấy, nhóm một biến thể mà món chưa có kiểu có tên — thì một dòng nêu lý do. Nhấp một
  kiểu là đổi `variant` ở mọi mốc `hold` của lần cầm ấy, một bước của lịch sử chung, giữ dạng mốc: chuỗi tắt `món@nhóm`
  thành `món@nhóm/tên`, object thêm / đổi `variant`, trường lạ giữ; tay phụ của `both` đổi `variant` của `both` ở mốc tay
  dẫn. `ease` của mốc không đổi. `variant` nằm trong khoá lần cầm: lần cầm kề trước / sau (cùng món × nhóm, mốc `hold` liền
  trước / liền sau) thành cùng khoá thì mốc mở lần cầm sau nhận `regrip: true`, hai lần cầm không nhập làm một. Kiểu không
  áp được (lựa chọn của cảnh ngoài miền của biến thể…) thì không áp, thanh trạng thái báo lý do.

## Soạn kiểu cầm

Từ bàn tay đang chọn (chỗ cầm nhóm `món@nhóm` của món có `shape`): **Chỉnh kiểu cầm này**. Khung soạn chỉ có chính bàn tay
ấy — đúng bên tay, cỡ tay của người ấy (`k`, `long` như rig) — và bản sao lưới món của cảnh, bàn tay đứng yên. Bắt đầu từ khung cầm cảnh đang dùng
(bản soạn nếu món đã có, không thì bộ giải); **Điểm đầu** chọn lại `Rig đoán` hay một dáng `HAND_POSES` (chỉ ngón).

- **Vẽ như cảnh.** Khung soạn là một sân khấu riêng của rig (`createStage`, cùng pipeline): món giữ nguyên vật liệu của cảnh
  (NPR, decal chữ, màn hình, vỏ viền mực), bàn tay dùng da và vỏ nét của bàn tay trong cảnh, đèn theo giờ và đèn trần của cảnh
  ở giây ấy (bỏ đèn đặt chỗ: khung soạn không có phòng). Món trông khác cảnh là món trong cảnh đã khác — nhìn bằng **Khung cảnh**.
- **Hướng như cảnh.** Bàn tay xoay đúng như trong cảnh, mở ra ở góc **Như trong cảnh**: nhìn bàn tay từ đúng hướng camera đang
  xem (camera cảnh hay camera tự do). Bóng mờ **cẳng tay** đi từ cổ tay tới khuỷu của cảnh ở giây ấy. Tay trái soạn bằng
  chính tay trái, món nằm trong tay đúng như cảnh. Nút **Như trong cảnh**, **Trước**, **Chéo**, **Ngang** (như
  `can-tay`), **Lòng tay**, **Mu tay** (phím 1–6) bay mượt tới góc ấy.
- **Ngón.** Nhấp lên một ngón trên hình để chọn (cam sáng); thẻ cạnh khung hiện đúng các thanh của ngón ấy, kể cả độ gập
  thêm từng đốt (`HAND_FIT`). Giữa, áp út, út chung góc gập (`fingers`): thanh "chung" gập cả ba, thanh "riêng" là `HAND_FIT`
  của ngón đang chọn. Rê lên ngón khác: ngón ấy sáng nhạt; rê lên một thanh (thẻ hay panel): đốt nó đổi sáng xanh trên hình.
  Panel bên giữ đủ mọi thanh, nhóm theo ngón, và tầm ngón tự ôm thêm (`heldFit`, `curl`; `0` giữ đúng dáng soạn).
- **Món.** Gizmo nhỏ nằm lệch khỏi tâm nắm (đường cam nối về tâm nắm), không đè ngón: kéo nó là dời / xoay món **quanh tâm
  nắm**. T / Y dời / xoay, X đổi trục (món → bàn tay → thế giới), G ẩn / hiện; **bước nhỏ**: 0,1 đơn vị rig, 1°.
- **Hoàn tác / Làm lại** (Ctrl+Z / Ctrl+Shift+Z, Ctrl+Y) cho mọi thao tác soạn: ngón, món, điểm đầu, `curl`.
- Mỗi lần đổi, rig dựng lại khung cầm từ bản soạn đúng như cảnh sẽ dựng (`authoredFromSide` → `graspFrame`), ngón ôm, đo lún / hở
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
camera ngầm phía sau; thả một thanh kéo (hay nhấp vào khung) là thanh ấy thôi nhận phím mũi tên. Hộp thoại đang mở (Lưu thành
kiểu mới, Chép sang món) thì không phím nào của trang tới cảnh.
- **Khung cảnh (áp tạm)** dựng lại cảnh ở giây ấy với bản soạn chưa lưu để xem cổ tay, khuỷu; **Khung soạn** quay lại.
- Khung soạn mở đúng khoá `authored.<nhóm>.<khoá>` cảnh đang dùng: biến thể gốc hay kiểu cầm có tên (đầu panel ghi `base` và
  `note`). **Lưu** ghi đè đúng khoá ấy (kiểu có tên giữ `base`, `note`); **Xoá bản soạn** bỏ nó; **Thoát** bỏ phần áp tạm
  chưa lưu. Bản soạn luôn ghi tay phải: soạn ở tay trái thì lưu bản tay phải mà gương của rig dựng lại đúng tay trái đang
  thấy (`authoredFromSide`), mở rồi lưu không đổi gì thì bản soạn không đổi; tay bên kia lấy gương tự động. Rig dùng bản soạn
  cho mọi cảnh cầm món × nhóm × khoá ấy (docs/11-nhom-cam.md § Kiểu
  cầm soạn tay).
- **Lưu thành kiểu mới…**: hộp gồm tên (`[a-z0-9-]+`, không trùng biến thể gốc của nhóm hay khoá của món — sai thì nút lưu
  tắt, hộp nêu lý do), mô tả (`note`) và **Dùng cho lần cầm này** (bật sẵn khi thấy lần cầm của bàn tay ở giây mở khung soạn).
  Ghi bản đang thấy vào khoá mới của món, `base` là biến thể gốc của khoá đang mở, rồi khung soạn mở khoá mới. Chọn "dùng"
  thì sau khi món đã lưu, `variant` của lần cầm đổi như nhấp kiểu ở panel bàn tay (một bước lịch sử chung, chưa ghi cảnh:
  **Lưu** / Ctrl+S trên thanh trên). Món lưu được mà cảnh không áp được thì khung soạn báo đỏ cả hai phần.
- **Chép sang món…**: bản đang thấy chép sang món khác cùng nhóm, bàn tay dựng lại từ chỗ tiếp xúc của bộ giải trên món đích
  ở cùng lựa chọn lúc soạn (`slideHand` từ chỗ tiếp xúc trên món này sang món kia, tay phải cỡ 1); phần `part`,
  `featureIndex` không có trên món đích thì để bộ giải chọn khối hình. Món không có hình va chạm, không có khối hình cho nhóm,
  hay không dựng được lựa chọn ấy thì tắt kèm lý do. Tên mặc định là khoá đang mở: tên biến thể gốc ghi bản soạn mặc định
  của món đích, tên khác là kiểu cầm có tên (`base` như khoá đang mở); món đích đã có khoá ấy thì không chép. Ghi
  `held/<món đích>.json` (`POST /api/held`, hash lúc nạp).
- **Xoá bản soạn** của kiểu cầm có tên mà cảnh đang mở còn gọi kiểu ấy: hỏi lại, nêu người, tay và mốc gọi.
- Màn hẹp: thanh góc nhìn xuống dòng trong bề ngang khung, nút hoàn tác chỉ còn mũi tên; thẻ ngón và dòng nhắc chuột ẩn
  (panel bên dưới có đủ mọi thanh).

Rê chuột lên đồng hồ góc phải: ms tính tư thế (`stage.pose`) và ms vẽ của khung vừa vẽ.

## Chỉnh dáng tay không cầm đồ

Từ bàn tay đang chọn mà không cầm, không treo món: **Chỉnh dáng tay này** (chỗ nút **Chỉnh kiểu cầm này** của tay cầm
đồ). Khung chỉnh giống khung soạn kiểu cầm mà không có món: chỉ có bàn tay ấy — đúng bên, cỡ tay của người ấy, đứng yên
đúng hướng như trong cảnh ở giây đang xem — kèm bóng cẳng tay mờ; cùng sáu góc nhìn (1–6), cùng cách chọn ngón (nhấp lên
ngón), kéo lên / xuống trên ngón đang chọn để gập (Shift chỉ đốt ngọn, Ctrl riêng ngón ấy qua `HAND_FIT`, Alt + lăn như
kéo), cùng thẻ ngón và panel đủ mọi thanh, lịch sử riêng (Ctrl+Z / Ctrl+Shift+Z). Dáng ghi ra là file dáng tay có tên
`hands/<tên>.json` (docs/01-rig.md § Dáng tay có tên): mười góc ngón và `fit`, không phân bên.

- **Điểm đầu**: mốc tay của tay ấy đúng giây đang xem có `pose` thì mở dáng ấy, không thì dáng đang vẽ ở giây ấy. Ô
  **Điểm đầu** nạp lại dáng đang vẽ, một dáng của thư viện (`hands/` của repo và dáng chung đi theo package) hay một dáng có
  sẵn của rig; chọn dáng của thư viện là **mở** nó. Dòng dưới tiêu đề ghi dáng đang mở, nguồn của nó (`hands/` của repo,
  dáng chung, dáng có sẵn) và "đã chỉnh, chưa lưu".
- **Lưu dáng <tên>** (chỉ khi đang mở một dáng của thư viện và đã chỉnh): ghi đè `hands/<tên>.json` của repo
  (`POST /api/hands`, kiểm hash lúc nạp như cảnh, `.bak`); dáng chung chưa có trong repo thì ghi bản của repo, đè dáng chung
  cùng tên. **Mọi mốc gọi dáng ấy, ở mọi cảnh, đổi theo** — dòng cảnh báo dưới nút kể các mốc của cảnh đang mở gọi nó.
- **Lưu thành dáng mới…**: tên (chữ thường, số, gạch nối; không trùng dáng có sẵn hay dáng đã có), mô tả, ô **Dùng cho mốc
  này** (bật sẵn). Server từ chối tên đã có (409). Lưu xong khung mở dáng mới.
- **Dùng <tên> cho mốc này** (khi dáng đang mở không có chỉnh chưa lưu): ghi `pose: "<tên>"` (bỏ `w`) vào mốc tay của tay ấy
  ở giây đang xem; không có mốc thì thêm mốc chỉ có `pose` — mốc chỉ đổi ngón, đích và khuỷu bỏ qua nó. Một bước của lịch sử
  chung; lưu cảnh bằng **Lưu** (Ctrl+S) như mọi mốc. Mốc có `hold` hay mốc `null` thì không nhận, thanh trạng thái báo.
- Lưu dáng xong trang dựng lại cảnh với thư viện mới. Lưu cảnh mà tên dáng chưa có trên đĩa thì `resolveScene` báo lỗi.

## Dáng tay

Công tắc **Xem / Dáng tay** trên thanh trên (nhớ trong `localStorage`). Ở Dáng tay, bấm một bàn tay (trên hình hay trong
panel) là chọn người × tay: thanh tua thêm một hàng cho mỗi tay của người ấy và một hàng **Món** cho các mốc `items[]` của
món tay đang chọn cầm (mọi lần cầm của tay ấy), rồi mỗi track của người ấy một hàng. Nhấp nhãn hàng tay là chọn tay ấy.

- **Ký hiệu.** Mốc tay tròn, mốc chỉ có `hold` vòng rỗng, mốc chỉ có `pose` vuông rỗng, mốc `null` chấm xám, mốc `rest` (tay
  buông) tam giác chúc xuống, mốc món thoi; viền tím là mốc khoá khuỷu
  (`elbowLock`), viền cam là mốc đang mở thẻ. Rê lên mốc: trường `t` như JSON (`@tra+0.6 = 4.000 s`), loại mốc, `ease`.
- **Dải dưới hàng tay là lần cầm** (`holdRuns`), nhãn `món@nhóm/biến thể` (tay phụ của `both` ghi `(phụ)`): xanh lá tay theo
  đồ (theo mốc, hai tay), xanh dương đồ theo tay, xám tay tự do; sọc là `HOLD_BLEND` ở đầu lần cầm (trừ lần cầm từ giây 0)
  và lúc nhả món đặt trước, nhãn nằm trên nền màu dải, không bị sọc che.
- **Nhấp dải lần cầm**: mở thẻ lần cầm ([Đổi chế độ lần cầm](#đổi-chế-độ-lần-cầm)); dải đang mở thẻ có viền sáng.
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
    nắm hay cổ tay; điểm khác thì tâm nắm, `point: "grip"`), lần cầm đi tiếp. Tay tự do chép `palm`, `fingers`, `bend`,
    `pose`, `w` của mốc trước (mốc sau khai dáng khác thì thẻ nhắc ngón quanh mốc mới đổi); `elbow` theo mốc kề, quy ra thế giới ở giây mới (mốc kề không có `at` khai hệ thân; hai mốc kề khác nhau thì nội suy thẳng), khuỷu đang khoá hẳn thì khoá vào hướng khuỷu
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
- **Hàng track** (`track <tên>`, theo thứ tự `cast[].tracks`): mỗi clip một dải mang tên hành động, từ `start` tới clip sau
  (hay hết cảnh), sọc là `blend` (τ rig đã suy). Dải sáng là clip chạm tay đang chọn ở giây đang xem — ghi góc cánh tay
  hay bàn tay của tay ấy theo `mask` của clip và hành động, `sides: "anatomical"`, lật (`clipSides` của rig) —, mờ là
  không chạm. **Nhấp dải** mở thẻ clip: hành động, `start` (mốc tên kèm giây), `blend` (khai hay tự suy), `mask` (của clip
  hay của hành động), tay clip chạm, `note` của hành động; **Đổi hành động** với danh sách hành động cùng mask (clip khai
  `mask` thì hành động ghi đủ các kênh ấy, không thì ghi đúng các kênh hành động đang có); **Xoá clip** — clip cuối của
  track thì bỏ cả track. Mỗi thao tác là một bước lịch sử chung, sửa JSON thô, rồi dựng lại cả cảnh; lưu bằng **Lưu**.
- **Tay nắm, vòng khuỷu, nón cổ tay** của bàn tay đang chọn (ẩn khi phát, khi khung soạn kiểu cầm mở). Thả chuột mới áp: trang
  dựng lại cảnh, đo, rồi làm mới tại chỗ (vài trăm ms); đang áp thì lần kéo mới không nhận. **Có mốc ở giây đang xem thì kéo
  sửa mốc ấy; không có thì lần kéo đầu chèn mốc mới ở giây ấy như ＋ rồi sửa nó**, thanh trạng thái báo "đã thêm mốc 1.23 s".
  Mốc vừa sửa mở thẻ; một lần kéo là một bước lịch sử.
  - **Tay nắm** (TransformControls ở tâm nắm; HUD góc trên khung, **T** dời theo trục thế giới, **Y** xoay theo trục của
    bàn tay hay món). Đồ theo tay, tay tự do sửa mốc tay: dời ghi `at` (mốc theo mốc thân `to` thì `offset`), bù tới khi tâm
    nắm ở đúng chỗ thả; xoay quanh tâm nắm ghi ý định món `hold.face`, `hold.roll` (trục khung món `[0, 0, 1]`, `[0, 1, 0]` về
    vectơ hệ thân, ngang ra ngoài phía tay ấy, như ＋) cho đồ theo tay, `palm` + `fingers` (vectơ hệ thân, bỏ `bend`) cho tay
    tự do. Tay theo đồ (theo mốc, hai tay) sửa mốc món `items[]` ở giây ấy: dời, xoay **món** quanh tâm nắm, hướng ghi `face`,
    `roll` trục khung món về vectơ hệ thân người cầm (ngang phải, bỏ `up`), chỗ ghi `at` hay `offset` bù tới khi tâm món ở
    chỗ mới; bàn tay theo món. Tay phụ của `both` không có tay nắm: kéo ở tay dẫn. Tay đang hoà (`HOLD_BLEND`) mà đích ở
    giây ấy chưa đổi được hình thì không sửa, thanh trạng thái báo. Bàn tay xoay chưa tới (khung bàn tay sau khi áp lệch
    khung muốn quá 2° và quá một phần mười góc xoay — cổ tay kẹp, món xoay quá kẹp) thì vẫn áp, thanh trạng thái báo "bàn
    tay chỉ xoay được ~…° / …°" kèm khớp kẹp.
  - **Vòng khuỷu**: đường tròn khuỷu quanh trục vai → cổ tay (đường xám) đi qua khuỷu đang vẽ (`handReport.ring`), tô theo
    `E(φ)` của `handReport.cost` (`evalPhi`): xanh ở chỗ rẻ nhất, đỏ từ rẻ nhất + 3 trở lên; tay tự do không có giá, vòng xám.
    Chấm trắng là khuỷu đang vẽ, tím khi khoá; nhãn cạnh khuỷu ghi `φ`, `E`. **Kéo** chấm hay bất kỳ chỗ nào trên vòng (bóng
    cam theo con trỏ): thả là ghi `elbow` (theo hệ của đích: mốc có `at` hướng thế giới rig, mốc khác hệ thân) và `elbowLock: true` vào mốc tay ở giây ấy. Cổ tay dời theo khuỷu
    (tâm nắm giữ chỗ) nên vòng của cảnh mới cũng dời: trang dò hướng `elbow` tới khi `handReport.phi` lệch góc thả dưới 0,25°.
    Tay không theo món đặt trước mà mốc chưa có `at` / `to` thì ghi thêm `at` ở tâm nắm đang vẽ — khoá chỉ có tác dụng ở mốc có
    đích; lần cầm theo mốc khoá ở mốc tay `hold` của lần cầm. Khoá vẫn không có tác dụng ở giây ấy (`handReport.elbowLock`
    sai) thì không áp, thanh trạng thái báo. **Nhấp đúp** lên vòng: bỏ `elbowLock` và `elbow` của mốc ở giây ấy, về khuỷu tự
    nhiên. Tay nắm dưới con trỏ thắng vòng khi bấm kéo.
  - **Nón cổ tay**, chỉ để xem: chóp ở cổ tay trong khung cẳng tay; cạnh chóp là miền `AIM_BEND` −60..70 × `AIM_DEV` −30..20 ở
    xoay cẳng tay đang vẽ, vòng cung dưới chân là xoay cẳng tay ±90 (vạch là hướng lòng tay, đỏ khi xoay bị kẹp). Chấm là
    hướng bàn tay đang vẽ: trắng trong miền, hổ phách khi cách kẹp dưới `stickman.held.wrist` (mặc định `HELD_WRIST` 5°, nhãn
    "sát giới hạn") và đỏ khi gập hay lệch bị kẹp hay vượt kẹp — cùng biên với luật `wrist` của `held`: món đặt trước đo trên
    nghiệm của bộ giải (`heldWristMargin`), nên panel báo `!` thì nón hổ phách, `!!` thì đỏ. Món đặt trước vượt kẹp thì thêm
    chấm đỏ ở hướng nghiệm, nhãn ghi số độ vượt; tay dẫn giải trong miền nên chỉ có khớp kẹp và độ lệch trục món
    (`wrist.err`). Cổ tay chỉnh qua hướng món và khuỷu, không có trường góc cổ tay. Nhãn `φ`/`E` và nhãn nón ẩn khi điểm của
    nó ra ngoài khung nhìn.
- **Vệt** của bàn tay đang chọn (ẩn khi phát, khi khung soạn kiểu cầm mở; ô **Vệt** và cửa sổ **±… s** ở góc dưới khung,
  nhớ trong `localStorage`): cổ tay (chấm đặc màu bên tay: phải hồng, trái xanh), khuỷu (chấm rỗng) và tâm hộp bao của
  món tay ấy đang cầm (cam; theo mốc món hay theo bàn tay như vẽ, món treo `carry` không có) trong `±2` s quanh giây đang
  xem. Mỗi chấm là một khung 1/30 s, khoảng cách giữa hai chấm là tốc độ; chấm to ở giây của mốc tay (cổ tay, khuỷu) và
  mốc món (tâm món), kể cả mốc lệch khung; chấm quanh giây đang xem (±1,5 khung) bỏ đi để không che tay, trừ chấm đỏ.
  - Cổ tay, khuỷu là `actJoints` của nhân vật cảnh (`castCharacter`; người không khai `character` là `defaultCharacter()`
    như `check`), đúng khớp `check` đo giật. **Vạch tím** ngang qua chấm
    cổ tay: cổ tay kẹp ở khung ấy (`clamped` như `handReport`).
  - **Chấm đỏ** viền đen là khung giật của `check` nhóm `move` cho người ấy, cùng phép đo và ngưỡng (`stickman.snap` của
    `package.json`, mặc định `SNAP_PX` / `SNAP_K` / `SNAP_FPS`), đo cả cảnh: `sceneSnaps` nhắc cổ tay hay bàn tay bên ấy đỏ ở
    vệt cổ tay, nhắc khuỷu đỏ ở vệt khuỷu — khung vệt chứa cú nhảy (`Snap.t` là khung sau cú nhảy ở nhịp đo); quãng khuỷu
    khoá xoay quá nhanh (`elbowLockSnaps`) bên ấy đỏ mọi khung trong quãng ở vệt khuỷu. Giật ở khớp khác trong cửa sổ ghi ở
    dòng "giật khác". Như `check`, chỉ đo trong quãng các shot của `episodes/` đưa cảnh lên hình (server gửi kèm
    `snapSpans`, tính trên bản đĩa); cảnh không shot nào dùng thì đo cả cảnh.
  - Tính trong một luồng riêng (`trailWorker.ts`), không khoá trang: sau mỗi thao tác (đổi bản sửa, tay, giây, cửa sổ) chậm lại
    150 ms rồi dựng runtime của bản sửa, lấy mẫu theo giây tăng (đồ theo tay nhớ chuỗi cổ tay từ mốc gần nhất), nhường mỗi
    20 ms để lượt mới thay lượt cũ; vệt cũ mờ đi tới khi có vệt mới. Đổi bản sửa hay tay thì lượt đang chạy bỏ ngay: kết
    quả của nó không vẽ lên tay mới. Mẫu và giật nhớ theo bản sửa: tua chỉ lấy thêm khung
    mới. Dòng trạng thái ghi số mẫu, giây tính vệt và giây đo giật (một vệt ±2 s chừng 1–2 s, đo giật cả cảnh chừng 1–1,5 s
    với cảnh t02).
- **Thẻ mốc**: `ease` (ô 4 số khi `bezier`, mặc định `BEZIER_DEFAULT`); `hold` (không khai / buông `null` / cầm: món,
  nhóm, biến thể — kiểu có tên hiện kèm `note`; mốc `rest` chỉ có `ease` và nút xoá; `hold` dạng chuỗi ghi lại chuỗi, dạng object đổi `item`, `group`,
  `variant`, đổi món hay nhóm thì bỏ trường chỗ cầm cũ `part`, `edge`, `along`…, giữ ý định và trường lạ; đổi món thì
  trang thử nhóm đang chọn rồi lần lượt các nhóm khác, áp nhóm đầu tiên mà cảnh giải được tay ở mốc, không nhóm nào được
  thì không áp và báo lỗi); **dáng ngón** `pose` (theo hành động / dáng của thư viện / dáng có sẵn) kèm ô `w` (bỏ trống là
  `1`) — mốc có `hold` hay mốc `null` thì tắt, bỏ dáng của mốc chỉ có `pose` là xoá mốc; `elbowLock` (mốc chưa có `elbow` thì lấy hướng khuỷu đang vẽ ở mốc; khoá không có tác dụng ở mốc thì thẻ
  báo); "ảnh hưởng tới …s" — ước: tới mốc kế của cùng tay, cùng món (chuỗi `auto` thêm một mốc), đồ theo tay còn kéo dài vài
  khung do giới hạn tốc độ; mốc món của lần cầm tay theo đồ và mốc tay của lần cầm đồ theo tay có ô số **chỗ** `x`, `y`, `z` (tâm hộp bao của món, thế giới
  rig, như vẽ ở giây của mốc) và **hướng** `quay`, `chúc`, `nghiêng` (độ, quanh trục đứng, ngang, tiến của người cầm; `0` là
  trục x, y, z của món theo tiến, xuống, ngang trái) — sửa một ô (Enter, rời ô, mũi tên) là áp như thả tay nắm, xoay quanh
  tâm món. Mốc món: chỗ ghi `at` hay `offset` bù tới khi tâm món ở đúng số, góc ghi `face` / `roll`. Mốc tay đồ theo tay:
  quy ra dời tâm nắm, xoay bàn tay, ghi như tay nắm (`at` / `offset`, ý định `hold.face` / `hold.roll`); cổ tay kẹp thì món
  xoay chưa tới, thanh trạng thái báo như tay nắm. Chỉ dời thì giữ hướng mốc
  đang khai (hướng nhắm một đích như `holderFace` thì góc đổi theo chỗ); mốc `as`, `rest` chưa khai chỗ thành mốc khai chỗ và
  hướng đang vẽ. Món không ở tay theo đồ ở giây ấy thì ô chỉ để xem; JSON thô của mốc kèm nút chép (mở hay đóng giữ qua các lần vẽ lại thẻ); **Xoá mốc** (Del). Mốc tay cuối cùng của một người không xoá
  được (`world.hands` không rỗng).
- **Mốc studio thêm hay sửa** (dời, đổi `hold`, `elbowLock`) mà chưa khai `ease` thì ghi `ease: "auto"`; mốc đã khai `ease`
  giữ nguyên. Đổi `ease` chỉ qua thẻ mốc.
- **Sửa trên JSON thô.** Mọi thao tác sửa bản JSON thô của cảnh trong trang (giữ trường lạ như `hand` của vài mốc, giữ mốc
  tên), rồi parse và làm mới tại chỗ (`world.refresh`); không làm mới được thì dựng lại cả cảnh. Bản sửa hỏng schema hay
  `resolveScene` ném thì không áp, thanh trạng thái báo lý do; dựng lại cả cảnh hỏng thì về bản trước, lời báo lỗi còn lại.
- **Lịch sử chung** cho cảnh, mỗi bước là ảnh chụp JSON thô; thao tác không đổi gì không thành bước: ↶ ↷ trên thanh trên, Ctrl+Z / Ctrl+Shift+Z. Khung soạn kiểu cầm
  hay khung chỉnh dáng tay đang mở thì giữ lịch sử riêng, lịch sử cảnh tạm khoá. Hoàn tác / làm lại mở lại thẻ của mốc đang mở khi rời bản ấy.
- **Lưu** (Ctrl+S): chấm cam là có thay đổi chưa lưu. Ghi `POST /api/scene` kèm hash lúc nạp; lưu xong lịch sử còn nguyên.
  **Bỏ thay đổi** về bản đã lưu (là một bước, hoàn tác được). File cảnh đổi trên đĩa từ lúc nạp thì server trả 409, không có cách ghi đè: hộp
  báo cho **Tải bản đĩa về** — bản đĩa vào thành một bước mới của lịch sử (hash mới, là bản đã lưu), Ctrl+Z quay lại bản
  của mình để so; lưu lại bản ấy thì server chỉ nhận khi phần ngoài mốc tay, mốc món, track khớp đĩa —, **Chép mốc của mình**
  (`hands`, `tracks` từng người và `items`, JSON) hay **Giữ bản mình**. Đổi cảnh, R, đóng trang đều hỏi trước khi bỏ thay đổi chưa lưu.
- **File repo video đổi trên đĩa** (cảnh, món mà `src/` của repo nhập — kể cả lúc Lưu): trang nhận module cảnh three mới
  tại chỗ, không nạp lại trang; lần dựng cảnh sau (Shift+R) dùng bản mới.
- **Màn hẹp** (≤ 760 px): camera, AA, Lăn gập sau nút ⋯; khung vẽ cao vừa khung 16:9 theo bề ngang, panel bàn tay lấy phần
  dưới còn lại. Ở Xem thanh tua vừa bề ngang, mốc tên chỉ còn vạch (chạm để tới mốc), nhóm Lưu / hoàn tác ẩn trừ khi có
  thay đổi chưa lưu; ở Dáng tay thanh tua rộng 720 px, cuộn ngang, luôn tự cuộn theo giây đang xem (cả khi chưa chọn tay);
  nhãn dải lần cầm bám mép trái khung cuộn. HUD tay nắm bỏ dòng nhắc.
- **Điện thoại ngang** (cao ≤ 500 px, màn cảm ứng): thanh trên một dòng, panel bàn tay giữ cột phải rộng 300 px. Gập / mở
  panel bàn tay ở màn hẹp và điện thoại ngang nhớ riêng với màn rộng (`studio3d.sideNarrow`). Màn cảm ứng: nút, thanh tua
  to hơn cho ngón tay; camera tự do một ngón xoay, hai ngón chụm tiến lùi và dời (OrbitControls).

### Đổi chế độ lần cầm

Thẻ lần cầm (nhấp dải dưới hàng tay) ghi món, người, tay, quãng và chế độ, cùng công tắc **Tay theo đồ** ↔ **Đồ theo tay**
(nút sáng là chế độ đang có). Phép đổi viết lại JSON của lần cầm bằng `holdToItemLed` / `holdToHandLed` của rig
(docs/11-nhom-cam.md § Đổi chế độ lần cầm), như tool `hold_mode` của MCP:

- **Phạm vi**: **cả lần cầm**, hay **chỉ từ đây** khi giây đang xem nằm giữa lần cầm (sau mốc mở): rig chèn mốc `regrip` ở
  giây ấy (giây trùng mốc tên thì ghi `@tên`), chỉ đổi phần sau. Tua sang giây khác thì bảng của "chỉ từ đây" bỏ, tính lại.
- **Bấm công tắc**: trang dựng lại cảnh vài lần để đo ("đang tính…", vài trăm ms tới vài giây), rồi hiện bảng độ lệch từng
  mốc của quãng đổi và giữa hai mốc kề: món dời, món quay, tâm nắm từng tay dời, `φ` khuỷu tay dẫn trước → sau, khớp cổ tay
  ở giới hạn trước → sau (`x` xoay, `g` gập, `l` lệch), `khoá` (bản vá khoá khuỷu ở mốc), `hoà` (đang trong `HOLD_BLEND`,
  không tính vào lệch lớn nhất). Dời hiện cm (đơn vị rig chia `RIG_PER_METRE` = 250 ra mét), quay hiện độ; ô dời quá
  `HOLD_MODE_POS` (0,5 đơn vị rig = 0,2 cm), quay quá `HOLD_MODE_ANGLE` (1°) tô đỏ, hàng có ô ấy nền đỏ. Trên bảng: lệch
  lớn nhất ở mốc, giữa mốc (hàng giữa hai mốc kề, trừ hàng đang hoà), ngoài quãng đổi, lúc hoà; dưới bảng: `notes` của phép
  đổi và bản vá JSON Patch. Trang đang dựng lại cảnh (sau một lần áp không làm mới tại chỗ được) thì thẻ chờ, không tính
  trên runtime cũ.
- **Áp**: bản vá vào cảnh đang sửa, một bước của lịch sử chung (chưa ghi đĩa: **Lưu**); Ctrl+Z về đúng chữ JSON trước khi áp.
  Dải lần cầm đổi màu; thẻ ở lại trên lần cầm (đổi giữa chừng: phần sau). **Thôi** bỏ bảng, cảnh không đổi. Bản đang sửa
  đổi trong lúc bảng đang hiện thì bảng bỏ.
- Không đổi được (món treo, lần cầm có mốc món nằm `rest`, hai tay cầm cùng món không lồng nhau…): thẻ nêu lý do của rig.
  Tay phụ của `both` đổi lần cầm của tay dẫn.

## Lưu ý khi xem bằng camera tự do

Vài thứ của rig dựng theo ống kính của cảnh, không theo camera đang xem: lớp miệng lật về phía ống kính khi mặt gần
nghiêng, tay "gần" / "xa" gán theo phía ống kính, vỏ phòng ẩn tường theo camera đang xem (`room.cull`). Nhìn từ góc khác
thì chúng có thể lạ; đó không phải lỗi của cảnh.
