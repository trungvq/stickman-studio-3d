# Mảnh vẽ lại bằng SVG

SVG nguồn thay cho từng PNG trong bộ mẫu `apps/studio/public/pieces/`, để nét
viền của mọi mảnh cùng một độ dày và đi theo `rig.stroke` thay vì nướng sẵn
trong pixel. Đích cuối của mỗi file ở đây là **một mục `GARMENTS` trong
`packages/rig/src/garments.ts`, `HAIRSTYLES` trong `packages/rig/src/hairstyles.ts`, `HEADWEAR`
trong `packages/rig/src/headwear.ts`, `HANDHELD` trong `packages/rig/src/handheld.tsx`, `ACCESSORIES`
trong `packages/rig/src/accessories.ts`**, `PARTS` bọc lại thành bộ phận `src: "part"`;
PNG tương ứng bỏ đi khi mục ấy xong. File ở đây là bản gốc để sửa hình và để
`compare.py` đo — sửa hình ở đây trước rồi chép `d` sang bảng tương ứng trong rig.

## Quy ước

- Đường dẫn trùng PNG nó thay: `torso/torso-02.svg` ↔ `pieces/torso/torso-02.png`.
- `viewBox` và `width`/`height` bằng **đúng kích thước pixel của PNG**, vẽ trong cùng
  hệ toạ độ. Nhờ vậy chồng lên nhau so được, và `dx / dy / scale / aspect` của
  nhân vật đang dùng PNG ấy không phải căn lại.
- Nét viền dày bằng nét đo trên PNG, khai **một lần** ở `stroke-width` của `<g>`
  ngoài cùng; chi tiết mảnh hơn (vòng cúc, gọng) nhân theo nó. Khi chuyển sang
  `PARTS`, số này thành `stroke`, còn `fill` trắng thành `color`.
- Thứ tự phần tử là thứ tự lớp: nẹp và cúc trước, vạt cổ sau, để vạt phủ lên nẹp.
- Áo có đai đen bệt (`robe-*`, `mandarin-*`) **kết thúc ở đai**: thân cắt ở giữa đai
  để đai đè lên mép cắt, tà dưới đai bỏ; túi tiền, tua và chìa khoá treo vào đai giữ
  lại. Đo bằng PNG che phần dưới đai.
- Áo dùng 3–7 hình cơ bản. Đầu và râu theo [docs/02](../../docs/02-trang-phuc.md).

## So sánh với PNG

```bash
python3 assets/pieces/compare.py torso/torso-02
```

Cần `python3` + `numpy`, `rsvg-convert`, `magick`. Script render SVG đúng cỡ
PNG, tách nét đen của hai bên, in IoU bóng / IoU nét và **phân vị khoảng cách
từ nét bên này tới nét bên kia** theo hai chiều, rồi ghi
`tmp/compare/<tên>-summary.png` bốn ô: PNG, SVG, chồng (PNG đỏ, SVG xanh, trùng
đen), bản đồ nhiệt (xanh lá 1–2 px, vàng 3–4, cam 5–8, đỏ trên 8).

**Ngưỡng: p95 ≤ 3 px và max ≤ 8 px** ở khung PNG, cả hai chiều; script thoát
`1` khi vượt. Chỉ số để nhìn là phân vị khoảng cách, không phải IoU nét — nét
dày 9 px lệch 2 px đã mất một phần ba diện tích trùng. Lệch còn lại sau khi đạt
ngưỡng là nét run của ảnh gen, đừng thêm điểm điều khiển để bám nó.

Chỉnh hình có chủ ý so với PNG thì được vượt ngưỡng, ghi vào bảng dưới.

Mảnh đã vào `PARTS` thì PNG không còn trong bộ mẫu nữa, nên dạng gọi một tham số
ở trên hết đo được; muốn đo lại thì lấy PNG ra từ lịch sử git rồi gọi dạng hai
đường dẫn:

```bash
git show HEAD~1:apps/studio/public/pieces/torso/torso-08.png > tmp/ref.png
python3 assets/pieces/compare.py tmp/ref.png assets/pieces/torso/torso-08.svg
```

## Danh mục

| SVG | Bộ phận | Ghi chú |
|---|---|---|
| `torso/torso-01.svg` | `PARTS.tshirt` | Áo phông, khung 300×360; hai chiều p95 1 / max 5 px; đạt ngưỡng |
| `torso/torso-02.svg` | `PARTS.polo` | Một chấm cúc tô màu nét, đường xẻ chữ L mảnh dưới cổ, cổ nét mỏng; giản lược chi tiết có chủ ý so với PNG |
| `torso/torso-03.svg` | `PARTS.shirt` | Ba chấm cúc tô màu nét, một nét dọc mảnh từ cổ đến gấu; giản lược chi tiết có chủ ý so với PNG |
| `torso/torso-04.svg` | `PARTS.sweater` | Áo len bo gân cổ và gấu, khung 300×360; SVG→PNG p95 1 / max 4 px, PNG→SVG p95 1 / max 8 px; đạt ngưỡng |
| `torso/torso-05.svg` | `PARTS.hoodie` | Hoodie, khung 300×360; SVG→PNG p95 2 / max 6 px, PNG→SVG p95 1 / max 4 px; đạt ngưỡng |
| `torso/torso-06.svg` | `PARTS.zipjacket` | Khoác kéo khoá, khung 300×360; SVG→PNG p95 1 / max 6 px, PNG→SVG p95 1 / max 5 px; đạt ngưỡng |
| `torso/torso-07.svg` | `PARTS.suit` | Cà vạt một mảng đen, hai ve trơn nét mỏng không khuyết, nét mở vạt mảnh, hai chấm cúc tô màu nét, bỏ túi; giản lược chi tiết có chủ ý so với PNG |
| `torso/torso-08.svg` | `PARTS.denim` | Khoác bò, khung 300×360; SVG→PNG p95 1 / max 6 px, PNG→SVG p95 1 / max 7 px; đạt ngưỡng |
| `torso/torso-09.svg` | `PARTS.sweatshirt` | Áo nỉ, khung 300×360; hai chiều p95 1 / max 5 px; đạt ngưỡng |
| `torso/tunic-01.svg` | `PARTS["tunic-01"]` | Áo cánh nẹp dải; SVG→PNG p95 1 / max 2 px, PNG→SVG p95 1 / max 2 px; đạt ngưỡng |
| `torso/tunic-02.svg` | `PARTS["tunic-02"]` | Áo cánh vạt chéo thắt lưng; SVG→PNG p95 1 / max 3 px, PNG→SVG p95 1 / max 4 px; đạt ngưỡng |
| `torso/tunic-03.svg` | `PARTS["tunic-03"]` | Áo cánh khuy tết, hai túi; SVG→PNG p95 1 / max 2 px, PNG→SVG p95 1 / max 4 px; đạt ngưỡng |
| `torso/tunic-04.svg` | `PARTS["tunic-04"]` | Áo cánh vá, vạt chéo; SVG→PNG p95 1 / max 3 px, PNG→SVG p95 1 / max 5 px; đạt ngưỡng |
| `torso/tunic-05.svg` | `PARTS["tunic-05"]` | Áo cánh cổ đứng, dải buộc; SVG→PNG p95 1 / max 3 px, PNG→SVG p95 1 / max 3 px; đạt ngưỡng |
| `torso/tunic-06.svg` | `PARTS["tunic-06"]` | Áo cánh vá, khoác hở; SVG→PNG p95 1 / max 4 px, PNG→SVG p95 1 / max 5 px; đạt ngưỡng |
| `torso/robe-01.svg` | `PARTS["robe-01"]` | Thân kéo dọc 130% từ hàng 20, ngang 95% quanh tâm; kết thúc ở đai, giữ phụ kiện treo; chỉnh tỉ lệ có chủ ý so với PNG |
| `torso/robe-02.svg` | `PARTS["robe-02"]` | Thân kéo dọc 130% từ hàng 20, ngang 95% quanh tâm; kết thúc ở đai, giữ phụ kiện treo; chỉnh tỉ lệ có chủ ý so với PNG |
| `torso/robe-03.svg` | `PARTS["robe-03"]` | Thân kéo dọc 130% từ hàng 20, ngang 95% quanh tâm; kết thúc ở đai, giữ phụ kiện treo; chỉnh tỉ lệ có chủ ý so với PNG |
| `torso/robe-belly-01.svg` | `PARTS["robe-belly-01"]` | Thân kéo dọc 114,4% từ hàng 20, ngang 95% quanh tâm; kết thúc ở đai, giữ phụ kiện treo; chỉnh tỉ lệ có chủ ý so với PNG |
| `torso/robe-belly-02.svg` | `PARTS["robe-belly-02"]` | Thân kéo dọc 114,4% từ hàng 20, ngang 95% quanh tâm; kết thúc ở đai, giữ phụ kiện treo; chỉnh tỉ lệ có chủ ý so với PNG |
| `torso/robe-belly-03.svg` | `PARTS["robe-belly-03"]` | Thân kéo dọc 114,4% từ hàng 20, ngang 95% quanh tâm; kết thúc ở đai, giữ phụ kiện treo; chỉnh tỉ lệ có chủ ý so với PNG |
| `torso/mandarin-01.svg` | `PARTS["mandarin-01"]` | Thân kéo dọc 130% từ hàng 20, ngang 95% quanh tâm; kết thúc ở đai, giữ phụ kiện treo; chỉnh tỉ lệ có chủ ý so với PNG |
| `torso/mandarin-02.svg` | `PARTS["mandarin-02"]` | Thân kéo dọc 130% từ hàng 20, ngang 95% quanh tâm; kết thúc ở đai, giữ phụ kiện treo; chỉnh tỉ lệ có chủ ý so với PNG |
| `torso/mandarin-03.svg` | `PARTS["mandarin-03"]` | Thân kéo dọc 130% từ hàng 20, ngang 95% quanh tâm; kết thúc ở đai, giữ phụ kiện treo; chỉnh tỉ lệ có chủ ý so với PNG |
| `torso/sage-robe.svg` | `PARTS["sage-robe"]` | Thân áo rút dọc còn 85%, giữ bề ngang; chỉnh tỉ lệ có chủ ý so với PNG |
| `torso/bare.svg` | `PARTS.bare` | Ngực trần, khung 540×720; SVG→PNG p95 3 / max 8 px, PNG→SVG p95 1 / max 4 px; đạt ngưỡng |

## Kiểu tóc

`hairstyles/<id>.<lớp>.svg`, mỗi file là một trường của mục `<id>` trong
`HAIRSTYLES` ([docs/02](../../docs/02-trang-phuc.md#kiểu-tóc)). Không thay PNG nào,
nên đối chiếu bằng `render_character` với `view` / `headView`, không bằng
`compare.py`.

| Lớp | `viewBox` | Hình |
|---|---|---|
| `over` | `0 0 320 320` | Chính diện, trên mặt |
| `under` | `0 0 320 520` | Chính diện sau thân; chỉ kiểu tóc rủ sau lưng mới có |
| `side`, `rear`, `back` | `0 0 320 520` | Một khối kín ôm sọ; `side` / `rear` mặt nhìn về `+x`, `back` đối xứng |

Mọi khung chung vòng sọ `cx 160, cy 160, r 100`, vẽ sẵn trong `<g id="guide">`.
Hình tô trắng trong một `<g>` có `stroke-width="9"`, đường hở khai `fill="none"`;
chỉ lệnh tuyệt đối `M L C Q Z` đi theo cặp `x y`. Chép `d` sang mục trong
`HAIRSTYLES` theo đúng thứ tự phần tử: hình trắng thành `{ d }`, đường hở thành
`{ d, fill: "none" }`. `over` theo [quy tắc cheated front](../../docs/02-trang-phuc.md#góc-vẽ-chính-diện-lệch-tâm-không-phải-34):
dịch chi tiết giữa sang phải, giữ bề ngang khối tóc; không xoay hay bóp phối cảnh.

## Mũ và râu

21 SVG ở `crown/` và `chin/` tương ứng 21 mục trong `HEADWEAR`. Mũ đo từ
PNG mẫu bằng `trace.py` và `compare.py`. Râu giữ hình bao của mảnh mẫu, tô
mảng phẳng không có nét sợi; `goatee` dùng hình bao có viền theo rig.
`chin-rounded` là mảng quai nón tròn theo ảnh tham chiếu, không có ria.
Râu giản lược có chủ ý nên không áp ngưỡng so nét bên trong với PNG:

```bash
python3 assets/pieces/trace.py crown/crown-01 --title "Mũ lưỡi trai"
python3 assets/pieces/trace.py tmp/ref.png --out assets/pieces/chin/goatee.svg --ink flat
```

Cần thêm `potrace`. `stroke-width` của `<g>` là nét viền ngoài đo trên PNG.
`--ink` chọn cách ghi phần mực:

| `--ink` | Hình ra | Dùng khi |
|---|---|---|
| `fill` | Hình bao tô `color`, viền đi tâm nét ngoài; mực còn lại (sợi râu, đường may, dải băng) là hình tô màu nét, phủ chồng lên viền | Mặc định. Chi tiết giữ đúng độ thuôn của PNG, chỗ giao nhau không cần nối |
| `flat` | Bóng tô màu nét, lòng trắng tô `color`, không nét | Mảnh kiểu con dấu mực, viền dày mỏng có chủ ý |

Chép sang `HEADWEAR`: hình `stroke="none"` thành `k: 0`, hình tô `#000000`
thành `fill: "line", k: 0`. `k` của hình bao đặt sao cho nét rig mặc định (`6`)
ở `scale` của `preset` dày bằng 1,65 lần nét PNG, làm tròn 0,05, từ 0,9 trở lên
thì lấy `1`.

| SVG | Bộ phận | `--ink` | SVG→PNG p95 / max | PNG→SVG p95 / max |
|---|---|---|---|---|
| `crown/crown-01.svg` | `PARTS["crown-01"]` Mũ lưỡi trai | `fill` | 0 / 2 px | 0 / 2 px |
| `crown/crown-02.svg` | `PARTS["crown-02"]` Mũ vành rộng | `fill` | 0 / 1 px | 0 / 2 px |
| `crown/crown-03.svg` | `PARTS["crown-03"]` Nón lá | `fill` | 0 / 1 px | 0 / 3 px |
| `crown/crown-04.svg` | `PARTS["crown-04"]` Mũ cối | `fill` | 0 / 2 px | 0 / 3 px |
| `crown/crown-05.svg` | `PARTS["crown-05"]` Mũ cảnh sát | `fill` | 0 / 2 px | 0 / 1 px |
| `crown/crown-06.svg` | `PARTS["crown-06"]` Mũ bác sĩ | `fill` | 0 / 2 px | 0 / 2 px |
| `crown/crown-07.svg` | `PARTS["crown-07"]` Mũ quân đội | `fill` | 0 / 1 px | 0 / 3 px |
| `crown/crown-08.svg` | `PARTS["crown-08"]` Khăn quấn đầu | `fill` | 0 / 1 px | 0 / 3 px |
| `crown/headband.svg` | `PARTS["headband"]` Băng trán | `fill` | 0 / 2 px | 0 / 2 px |
| `crown/helmet.svg` | `PARTS["helmet"]` Mũ bảo hộ | `fill` | 0 / 1 px | 1 / 3 px |

## Đồ cầm tay

16 SVG ở `hand/` tương ứng 16 mục `HANDHELD`, dùng cho cả hai tay. Khung,
điểm nắm, bảng màu và số căn giữ theo mảnh mẫu. Bảy món khung 600×600 dùng
SVG nguồn màu; `rake` và `firewood` là các mảng màu đo từ PNG. Các món mực
dùng `trace.py`; `fan` dùng `--ink flat` để giữ độ thuôn của nan quạt.

Trong rig, SVG lồng dùng `preserveAspectRatio="none"` để khớp hộp của
`figureAnchors` khi chỉnh bề ngang. Viền stroke của đồ mực theo `rig.stroke`,
chuẩn hoá theo độ dày PNG ở `preset.scale` và nét rig `6`; hình mực đặc
và đồ màu co giãn theo hộp. Sửa SVG nguồn rồi đồng bộ các phần tử sang
`handheld.tsx`, giữ màu trắng thành `color`, đen thành `line` cho đồ mực.

| SVG | SVG→PNG p95 / max | PNG→SVG p95 / max |
|---|---|---|
| `hand/axe.svg` | 0 / 1 px | 0 / 1 px |
| `hand/axe-double.svg` | 0 / 1 px | 0 / 2 px |
| `hand/glove.svg` | 0 / 3 px | 0 / 4 px |
| `hand/spear.svg` | 1 / 2 px | 0 / 1 px |
| `hand/spear-short.svg` | 3 / 7 px | 0 / 4 px |
| `hand/fan.svg` | 0 / 2 px | 0 / 1 px |
| `hand/remote.svg` | 0 / 1 px | 0 / 2 px |
| `hand/rake.svg` | 1 / 8 px | 0 / 1 px |
| `hand/firewood.svg` | 0 / 5 px | 0 / 1 px |
| `hand/hoe.svg`, `hand/stick.svg`, `hand/dipper.svg`, `hand/sign.svg` | 0 / 0 px | 0 / 0 px |
| `hand/calculator.svg`, `hand/calculator-oblique.svg`, `hand/calculator-facing.svg` | 0 / 0 px | 0 / 0 px |

## Tà, đồ đeo cổ và nốt ruồi

6 SVG ở `hem/`, `neck/` và `faceAcc/` tương ứng 6 mục `ACCESSORIES`. Mảnh nào
là hình học thì dựng bằng hình cơ bản đo từ PNG — đường tròn, elip, chữ nhật
bo góc, đoạn thẳng, cung bậc hai — không lấy đường `potrace`, để mép không mang
nét run của ảnh gen. Thân khố và tà áo thụng lấy hình bao từ `trace.py` rồi fit lại
bằng `smooth_d` của `smooth.py` (`--tol 1.5`, `--blur 6`); nếp tà `--tol 1`,
`--blur 1.2`. Dây chuỗi hạt cũng đi đường này.

Chuỗi hạt vẽ theo tầng chồng: hạt cùng tầng chung vách nên mọi vòng viền
(`fill="none"`) của tầng vẽ trước, rồi mới phủ lòng hạt (hình tô trắng không
viền); hạt đè lên hạt khác nằm tầng trên. `k` của hình bao theo quy tắc ở mục
Mũ và râu.

| SVG | Bộ phận | `k` | SVG→PNG p95 / max | PNG→SVG p95 / max | Ghi chú |
|---|---|---|---|---|---|
| `hem/loincloth.svg` | `PARTS["loincloth"]` Khố | 0,65 | 0 / 3 px | 1 / 4 px | Dải hoa văn là băng mực, vòng tròn trắng có chấm |
| `hem/sage-hem.svg` | `PARTS["sage-hem"]` Tà áo thụng ông tiên | 0,5 | 0 / 2 px | 1 / 3 px | |
| `hem/apron.svg` | `PARTS["apron"]` Tạp dề yếm | 0,7 | 0 / 3 px | 1 / 4 px | |
| `neck/beads.svg` | `PARTS["beads"]` Chuỗi hạt | 0,35 | 0 / 11 px | 0 / 7 px | Hạt tròn đều; hạt PNG méo hình trứng nên vượt max ở chiều SVG→PNG |
| `neck/plate.svg` | `PARTS["plate"]` Phiến hộ tâm | 0,35 | 0 / 8 px | 0 / 8 px | |
| `faceAcc/mole.svg` | `PARTS["mole"]` Nốt ruồi | — | 0 / 0 px | 0 / 1 px | Chấm tô màu nét |

## Hình theo góc nhìn

`views/<socket>/` là hình các mảnh trên người ở góc nhìn `side`, `rear` và
`back` ([docs/02](../../docs/02-trang-phuc.md#góc-nhìn)). Khác mọi thư mục trên:
**chúng không thay PNG nào**, nên `compare.py` không có gì để đo — đối chiếu bằng
`render_character` với `view` / `headView`, hay `stickman-render --view`.

Đích của mỗi file là một mục trong `packages/rig/src/garmentViews.ts` (`GARMENT_SIDE`,
`GARMENT_BACK`), `chinViews.ts` (`CHIN_SIDE`) hoặc `accessoryViews.ts`
(`ACCESSORY_SIDE`); **tên file chính là khoá** trong bảng ấy. Một hình dùng cho nhiều
mảnh chính diện, nên còn phải khai từng mảnh vào bảng `*_OF` cùng file — không
khai thì mảnh ấy lặng lẽ vẽ hình chính diện.

Râu nghiêng ở `views/chin/` đồng bộ với `CHIN_SIDE` trong `chinViews.ts`;
`CHIN_SIDE_OF` ánh xạ mọi mẫu râu, khung 320×520, sọ tâm `(160, 160)`, bán kính
100. Một mảng kín cho mỗi kiểu, chừa vùng miệng; không vẽ nét sợi.

Khung là `VIEW_FRAME` của `views.ts`, và mỗi file mang một `<g id="guide">` vẽ sẵn
mốc:

| Thư mục | `viewBox` | `<g id="guide">` |
|---|---|---|
| `views/crown/`, `views/headAcc/`, `views/faceAcc/` | `0 0 320 320` | Vòng sọ `cx 160, cy 160, r 100` |
| `views/neck/` | `0 0 150 190` | Trục thân như áo |
| `views/hem/` | `0 0 150 300` | Hông `(75, 100)`, chân ở khoảng `y = 260` |
| `views/sleeveNear/` | `0 0 60 100` | Vai `(30, 12)`; dùng chung hai tay |
| `views/torso/` | `0 0 150 190` | Trục giữa `x = 75` từ hông `y = 140` lên chân cổ `y = 20` và khớp cổ `y = 12`, cộng hai mốc bề ngang vai ở `y = 40` |

Quy ước vẽ: mặt nhìn về `+x` ở hình `side` và `rear`, đối xứng quanh trục giữa ở hình
`back`; chỉ lệnh tuyệt đối `M L C Q Z` đi theo cặp `x y`; hình bao đứng **đầu**
danh sách vì `back` thiếu hình riêng thì chỉ vẽ phần tử đầu. `stroke-width` là
`9` ở khung đầu và `6` ở khung thân — hai số ấy quy về đúng `rig.stroke` mặc định
sau khi co vào hộp thật.

## Đạo cụ và cây

13 đồ vật màu có nguồn ở `assets/props/`, đồng bộ thành JSX trong
`packages/rig/src/prop-art.tsx`, vào `PARTS` với socket `prop`. Giữ nguyên
đường nét và bảng màu; `viewBox` cắt sát phần có hình ở bản render rộng 480 px (đống châu báu 960 px),
`aspect` theo khung cắt. Bỏ id nhóm khi đưa vào rig. Clip của rổ
phải có id riêng theo từng instance để nhiều rổ cùng trang không đụng nhau.

Sáu kiểu cây nằm ở `packages/rig/src/trees.tsx`; lá lấy `color`, thân lấy
`accent`, nét lấy `line` và `stroke`. Khung cao `400`, bề ngang theo từng
kiểu. Mẫu JSON trong `apps/studio/public/props/` khai màu và cỡ gợi ý;
[danh sách cây](../../docs/06-dao-cu.md#cây-và-đồ-vật-svg).
