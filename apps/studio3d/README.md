# Studio 3D

Trang xem cảnh three của một repo video: cùng `worldOf` / `buildWorld` mà Remotion vẽ (`Scene3D` của repo), tua giây,
camera cảnh hay camera tự do, soi bàn tay và số đo cầm đồ, soạn kiểu cầm bằng mắt. Studio 2D (`apps/studio`: nhân vật,
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
    và `items` của nó vá vào file trên đĩa. Phần khác của `scene` khác đĩa thì 400. Trả `{ file, raw, hash }`.
  - `POST /api/held?name=<món>` `{ hash, group, variant, authored }`: **Lưu** của khung soạn kiểu cầm ghi `authored` của
    món × nhóm × biến thể (`authored: null` là xoá). `STUDIO3D_HELD_OUT=<thư mục>` đổi hướng ghi sang thư mục ấy và đọc nó
    phủ lên `held/` — thử mà không đụng repo video.
- **Hash.** `GET /api/scene` trả `hash` của file cảnh và `heldHash` của từng món, là sha256 của byte trên đĩa lúc nạp. Lưu
  gửi kèm hash ấy; file đã đổi từ lúc nạp thì server trả 409 (`{ error, conflict: true, hash }`) và không ghi.
- **Vá JSON thô.** Server không ghi lại object đã parse (zod bỏ trường schema không biết, như `hand` trong mốc tay của vài
  cảnh): nó viết lại đúng những giá trị đổi trên chữ của file (`rawjson.mjs`), giữ mọi trường khác và thứ tự khoá. File đúng
  lối `JSON.stringify(…, null, 2)` giữ lối ấy, file đúng lối prettier (cấu hình của repo video) thì chạy prettier sau khi vá,
  file khác chỉ đổi chỗ vá. Kết quả phải qua `parseScene` / `parseHeldItem` của rig trang dùng; hỏng thì 400, không ghi.

## Phím

| Phím | Việc |
|---|---|
| Space | Phát / dừng |
| ← → | Lùi / tới một khung (1/30 s); giữ Shift: 10 khung |
| C | Đổi camera cảnh ↔ camera tự do |
| R | Nạp lại cảnh từ đĩa, giữ giây đang xem |
| W S · A D · Q E | Camera tự do: tiến / lùi, sang trái / phải, xuống / lên (theo hướng camera); giữ Shift: nhanh gấp 3 |
| Esc | Bỏ chọn bàn tay |

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

## Lưu ý khi xem bằng camera tự do

Vài thứ của rig dựng theo ống kính của cảnh, không theo camera đang xem: lớp miệng lật về phía ống kính khi mặt gần
nghiêng, tay "gần" / "xa" gán theo phía ống kính, vỏ phòng ẩn tường theo camera đang xem (`room.cull`). Nhìn từ góc khác
thì chúng có thể lạ; đó không phải lỗi của cảnh.
