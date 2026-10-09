# Character studio

Vite + React + Tailwind v4 + shadcn. `pnpm dev` ở gốc repo. File này là tham
chiếu để **soi** studio; công thức rig thì ở `docs/`, bất biến ở
[docs/00](../../docs/00-bat-bien.md).

## Chụp lại để nhìn

Typecheck đúng không có nghĩa là hình đúng. Chạy `pnpm dev` rồi:

```bash
chromium --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1400,900 --virtual-time-budget=8000 \
  --screenshot=/tmp/rig.png \
  "http://localhost:5173/?character=ink.json&pose=shrug"
```

Dùng `--virtual-time-budget`, không dùng `--timeout` — `--timeout` chụp trước
khi ảnh mảnh kịp về. **Sửa giao diện xong phải chụp lại cả `390x844` lẫn
`1400x900`.** `pnpm dev` mở sẵn cổng ra LAN để xem bằng điện thoại (dòng
`Network:` trong log).

Vite quét `publicDir` lúc khởi động: thêm file vào `public/` thì phải khởi động
lại dev server.

## Tham số URL

`pose`, `travel`, `flip`, `blend`, `mouth`, `brow`, `eyes`, `scrub`, `propX`,
`propBack`, `propSit`, `compare`, `animalX`, `animalBack` (checkbox nhận `1`/`0`),
`view` (`front` / `quarter` / `side` / `rear` / `back` — góc nhìn của thân, mặc định `quarter`) và `headView` (thêm `auto`
là theo thân; tổ hợp không vẽ được thì kẹp theo `clampViews`), `turn` / `nod` (lắc / gật
xem thử, độ, cộng lên kênh `head` của tư thế đang chạy) và `sway=1` (đầu tự lắc gật qua lại),
`equip=handNear:axe,crown:hat` (`-` là để trống socket), `yaw` / `pitch` (hướng mặt và góc cúi
ống kính của người 3D, độ), `spin=1` (người 3D tự quay), `under=sit-3d.json` (track dưới của
người 3D), `tab` (`character` /
`action` / `prop` / `animal`), và `character=<file>`, `action=<file>`,
`prop=<file>`, `animal=<file>`, `animalAction=<file>` nạp từ workspace đang mở —
headless thì đó là bộ mẫu trong `public/`.

## Bố cục và hành vi

Mở lên là **không có hành động**: nhân vật đứng ở tư thế nền, có `action` mới
chạy. Điều khiển phát (tư thế nền, lật, góc nhìn, trôi ngang, hoà) là thanh dưới
sân khấu, không ra JSON nào — góc nhìn là hai nhóm nút **Thân** và **Đầu**, đầu
để **Theo thân** thì đi theo thân, nút nào ra tổ hợp không vẽ được thì tắt; thân `rear`
của nhân vật không mặc thân áo dựng khối vẽ như `back`. Mảnh
có hình riêng ở góc đang xem thì thanh trượt, kéo trên sân khấu và nút đặt lại sửa
**bộ chỉnh của góc ấy** (`views.side` / `views.rear` / `views.back`; mảnh treo trên thân ở
thân `rear` sửa `views.back`), không đụng căn chỉnh chính diện. Cột trái là **hình dáng** — Người, Động vật hay Đạo cụ (thanh
chọn trên đầu cột) — và **tab trái quyết định ai đứng trên sân khấu**; cột phải là
**Hành động** + xem thử, của chính người đang đứng đó: tab Động vật thì cột Hành
động, lưới chọn, dải thời gian và Xem mốc đều là hành động của động vật. Chỉ bốn
thứ đó xuất ra JSON, phần xem thử thì không.

Đạo cụ không có hành động, nên tab Đạo cụ vẫn dựng người trên sân khấu và cột
phải vẫn là hành động của người: xe nạp lên đứng cạnh người theo `propX` (đúng
nghĩa `props[].x` khi `follow`), lật và trôi ngang theo người nên bánh lăn; đó là
cách soi `push.json` gặp càng xe mà không cần dựng scene. Tick **Người ngồi trong**
(`?propSit=1`) thì ngược lại: xe đứng giữa, người treo hông vào chỗ ngồi của nó ở
tư thế `sit`, xe vẽ kẹp quanh người đúng như `cast[].sit` trong scene — chỗ căn
`seat` ở mục Chỗ ngồi.

Tab Động vật thì con vật đứng một mình giữa sân khấu, đồng hồ riêng vì nhịp dáng
đi khác nhịp của người; bật Di chuyển ngang thì nó đi ngang qua khung và quay đầu
ở mép như người. Hành động trên không (`animal-fly`) treo con vật ở hông, không
bóng, không trôi. Cột Hành động soạn được hành động mốc của động vật như của
người — kênh theo `ANIMAL_CHANNELS`, mỏ và mắt qua ô chọn nét mặt (không lông mày);
`mouth` / `eyes` xem thử ở mục Xem thử dùng chung tham số URL với người. Tick **Dựng người bên cạnh để so tỉ lệ** ở mục Xem thử thì nhân
vật đứng ở tư thế nền cách con vật `animalX`, **cùng đường đất** — đấy là chỗ duy
nhất so được tỉ lệ con voi với người. Cưỡi và xách con vật là việc của scene
([docs/03](../../docs/03-scene.md#động-vật)), studio không có giao diện cho nó — soi bằng
dải ảnh như mọi scene.

Nạp hành động là một lưới đứng ở mốc đầu, **rê vào ô nào thì ô đó chạy**
(`ActionPicker`), và nút **Xem mốc** dưới dải thời gian mở cả chuỗi mốc thành
hình (`KeyStrip`); hai chỗ ấy vẽ bằng `ActionFrame` của `Preview.tsx` — cùng
khung nhìn với sân khấu, đừng dựng khung riêng. Chỉ ô đang rê mới chạy; modal mở
thì sân khấu ngừng vẽ (`Stage` nhận `paused`); `phaseAt` bậc thang pha để
`ActionFrame` đã memo không vẽ lại khi hình chưa đổi.

Bố cục co theo bề ngang: dưới `1024px` chỉ còn sân khấu + **một** cột chỉnh, chọn
bằng thanh Người / Động vật / Đạo cụ / Hành động; dưới `768px` thì xếp dọc.

Ô **Tóc** chọn được **tóc dựng khối** song song với các kiểu tóc: mỗi mẫu `SCULPT_PRESETS`
(tóc nam ngắn, rối gai, mái lệch, xõa ngang vai) là một ô có thumb ở đầu lưới, bấm là đặt
`src: "sculpt"` và thay cả bộ số; ô sáng là mẫu mà bộ số đang đúng bằng, chỉnh tay rồi thì
không ô nào sáng và thẻ ghi "chỉnh tay". Các ô ấy chỉ hiện khi socket tóc đang là mảnh nền,
vì vật không mang được tóc dựng khối. Khi ấy thẻ Tóc chỉ còn màu tóc, một thanh cho mỗi số
của `SculptSchema` (ghi vào
`pieces.hair.sculpt`; thanh riêng của kiểu chỉ hiện với kiểu ấy: bốn thanh vành tóc `crown*` với kiểu hói, Chỗ buộc `tie` với đuôi ngựa và búi, Dài đuôi `tail` với đuôi ngựa) và mục **Xem thử đầu quay** — `turn` / `nod` / `sway` ở trên; dx … xoay,
cắt bao, bộ chỉnh theo góc và ô tóc ảnh sau đầu bị ẩn, trên sân khấu tóc chọn được nhưng không
có tay nắm để kéo, nút đặt lại đưa bộ số về mặc định.

Ô **Thân áo** mở đầu lưới bằng một ô cho mỗi kiểu thân áo dựng khối (`GARMENT_STYLES`),
bấm là đặt `src: "sculpt"` và `garment: { style }`; cắm được cả vào vật. Thẻ Thân áo khi ấy
chỉ còn màu áo và một thanh cho mỗi số của `GarmentSchema` — thanh chưa kéo hiện số của
kiểu — cùng quy ước với tóc dựng khối: không dx … xoay, không tay nắm trên sân khấu.

Ô **Tà áo** mở đầu lưới bằng ô **Váy dựng khối**: bấm là đặt `src: "sculpt"`, bộ số
mặc định của `SkirtSchema` và `layer: "under"`; cắm được cả vào vật. Thẻ khi ấy chỉ còn màu
váy, một thanh cho mỗi số và ô Vẽ dưới thân áo — cùng quy ước với thân áo dựng khối.

Tầm của mọi thanh kéo là tầm dùng thường ngày, không phải giới hạn: ô số bên
phải gõ được số ngoài tầm (Enter hoặc rời ô để ghi, Esc để bỏ), thanh tự dãn
theo giá trị đang có nên file vượt tầm vẫn kéo tiếp được. Kéo hộp mảnh trên sân
khấu cũng nới theo cùng luật. Chỉ mốc dưới không âm là sàn cứng.

## Người 3D

Hành động `authoredAt: "side"` (ô **Soạn ở góc nghiêng cho người 3D** ở cột Hành động) đổi sân
khấu sang **người 3D giữa sân khấu trống**, đúng đường của `stickman-render --yaw` và
`render_action` với `yaw`: `soloStage` / `<SoloWorld>` của `@stickman3d/fx`, nên cờ nâng, đích tay,
khoá góc chính diện và ghế khối của người ngồi (hai đùi gập quá `SOLO_SIT_THIGH`) giống hệt. Người
ngồi được nâng cả cụm cho bàn chân thấp nhất chạm đường đất; vòng trên sàn quanh chỗ đứng có vạch
chỉ hướng `+x` (yaw `0`). Hành động không khai `authoredAt` vẫn vẽ 2D như cũ.

- **Hướng và góc cúi**: thanh **Hướng** (yaw, độ: `0` là `+x`, `90` là `−z` về ống kính) và **Cúi**
  (`0`–`80`) dưới sân khấu, hoặc kéo trên sân khấu — ngang là hướng, dọc là góc cúi; Shift + kéo dời
  khung khi đang phóng to. **Quay vòng** tự quay `60°` mỗi giây; kéo hay chạm đích tay là dừng quay
  ở hướng đang thấy. Tư thế nền, Lật, góc nhìn, trôi ngang và hoà không áp cho người 3D, thanh dưới
  sân khấu ẩn chúng.
- **Track dưới**: ô chọn liệt kê hành động `authoredAt: "side"` của workspace; chọn `sit-3d` để soạn
  `type-3d` trên người đang ngồi, như hai track chồng nhau của scene. Dải mốc (Xem mốc) cũng chồng
  track dưới; lưới chọn hành động thì không.
- **Thanh trượt từng bậc**: mốc đang chọn có thanh cho mọi góc nó ghi như hành động 2D; mỗi tay trong
  mặt nạ thêm một khung **Đích cổ tay** — ba số `reach.at` hệ thân (tiến, xuống, ra ngoài) và, khi
  tick **Hướng khuỷu riêng**, ba số `elbow`; bỏ tick là `REACH_ELBOW` của rig. **Theo đích cổ tay**
  đổi một tay đang theo góc sang theo đích ở đúng chỗ cổ tay đang đứng; **Bỏ đích, về góc** ghi lại
  góc dự phòng của chính đích ấy (`reachAngles`). Tay theo đích không giữ góc ở mốc ấy — một nguồn.
- **Kéo đích tay trên sân khấu**: mỗi tay trong mặt nạ có một chấm ở cổ tay (cam tay gần, xanh tay
  xa; viền đứt là tay đang theo góc). Kéo chấm là ghim pha ở mốc đang chọn rồi dời đích trên mặt
  phẳng qua đích hiện tại, vuông góc tia nhìn tới nó, ở bất kỳ hướng và góc cúi nào; điểm thế giới
  quy về hệ thân bằng `worldToReach`, hướng khuỷu đã ghi giữ nguyên.

Ô của lưới chọn hành động và dải mốc vẽ hành động 3D ở cùng hướng và góc cúi với sân khấu.

## Liệt kê mảnh và nhân vật

Bộ mẫu trong `public/` chỉ đọc nên studio liệt kê nhân vật / hành động / đạo cụ /
động vật bằng `index.json` của từng thư mục. Danh sách hành động tách làm hai theo
`actionKind`: tab Người thì cột Hành động chỉ thấy hành động của người, tab Động
vật chỉ thấy của động vật — nạp nhầm thì chẳng có gì báo, hình chỉ đứng im. Mảnh ảnh thì **mọi
workspace** đều đi qua `pieces/catalog.json` — xem [docs/02 § Danh mục mảnh
ảnh](../../docs/02-trang-phuc.md#danh-mục-mảnh-ảnh) cho hình dạng mục.

Chọn kiểu trong modal là `applyPieceConfig` ghi ngay config ấy vào socket. Modal
hiện `name`, icon (i) hover ra `description`; mảnh nạp từ máy chưa có trong danh
mục vẫn hiện, ở đầu lưới.

Chưa có: xem trước rồi mới apply (hiện bấm là cắm ngay).

## Soi scene

Scene không có giao diện nào để chụp — soi bằng dải ảnh, mỗi ô một mốc:

```bash
node packages/render/cli.mjs --scene canh.json --out /tmp/strip.png \
  --actions apps/studio/public/actions --characters apps/studio/public/characters \
  --pieces apps/studio/public/pieces --cols 12 --scale 0.55
```
