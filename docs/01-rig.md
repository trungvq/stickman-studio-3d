# 01 — Rig nhân vật

Đầu, mặt và các đoạn chi vẽ bằng code; tóc, râu, trang phục và vật cầm tay là
mảnh cắm vào socket — mảnh ảnh, bộ phận vẽ code, hay bản dựng khối chiếu theo góc.

## Hệ toạ độ và tỉ lệ

Gốc toạ độ đặt ở **chậu hông** (pelvis). Trục y hướng xuống, theo quy ước SVG.

| Kích thước | px | Ghi chú |
|---|---:|---|
| Tổng chiều cao | 428 | Đỉnh đầu tới gót |
| Đầu (cao) | 130 | ~29% chiều cao — cố tình to, kiểu hoạt hình |
| Cổ | 8 | |
| Thân (hông → vai) | 120 | |
| Đùi | 78 | Giữa tỉ lệ người Nhật (`72`) và bảng nhân trắc phương Tây (`85`), quy về thân hông → vai `100` |
| Cẳng chân | 92 | Gối → gót, gồm bàn chân; cũng lấy giữa (`84` / `99`). Người ngồi ghế cao bằng gối thì chân chạm sàn |
| Cánh tay trên | 62 | |
| Cẳng tay | 58 | |
| Nửa rộng vai | 40 | `rig.shoulderHalf`, xem ghi chú dưới bảng |
| Vai tụt | 20 | `rig.shoulderDrop`, khớp vai nằm dưới đỉnh thân bấy nhiêu |
| Nửa rộng hông | 22 | `rig.hipHalf` |
| Độ dày nét | 6 | Viền đầu, viền chi khi bật `clad` |
| Độ dày chi | 10 | Mặc định đen, nét trần (`clad` tắt) |

**`Chiều cao` nhân vào các đoạn dọc, không nhân vào bề ngang.** Sáu đoạn `cổ`,
`thân`, `cánh tay trên`, `cẳng tay`, `đùi`, `cẳng chân` nhân với `rig.height`
(mặc định `1`); `nửa rộng vai`, `nửa rộng hông`, các độ dày nét và **đầu** thì
không. Đầu chỉnh riêng bằng `Rộng`/`Cao` ở mục Đầu — kéo `Chiều cao` xuống là ra
người lùn đầu to, đúng kiểu hoạt hình, muốn khác thì bóp đầu lại. Bảng trên là
số ở `height = 1`; mọi mốc `y` trong trang này cũng vậy.

Hộp ảnh mảnh cũng chỉ **kéo dọc**: `boxH` lấy đoạn đã nhân chiều cao, `boxW` lấy
đoạn gốc. Đổi `Chiều cao` xong không phải căn lại bề ngang thân áo hay tay áo.

**Thân không vẽ.** Bộ xương có hai vai và hai hông; mọi nhân vật phải có mảnh
`torso` — ảnh, bộ phận `PARTS`, hay [thân áo dựng khối](02-trang-phuc.md#thân-áo-dựng-khối). `rig.shoulderHalf`, `rig.shoulderDrop` và `rig.hipHalf` đặt trực tiếp
bốn khớp gốc. Giá trị `0` đưa vai hoặc hông về trục giữa. Thân áo dựng khối thì vai nằm trên
tâm nét viền áo, không ở `shoulderHalf` ([02](02-trang-phuc.md#thân-áo-dựng-khối)).

Mốc quan trọng, tính từ gốc:

```
đỉnh đầu   y = -258
cổ         y = -128
vai        y = -100   x = ±40   ← −120 + shoulderDrop
hông       y =    0   x = ±22
gót        y = +170
```

Đặt nhân vật lên nền: `root.y = groundY - 170`.

### Bóng tiếp đất

Một ellipse ở đúng `groundY`, tâm trên trục hông. Bề ngang **suy ra từ hai bàn
chân** — `rx = |chân gần.x − chân xa.x| / 2 + nửa rộng vai` — nên bước càng
rộng bóng càng loe, không có tham số nào phải chỉnh. Tô bằng màu nét **trong
suốt** (`SHADOW` là alpha ở tâm) với radial gradient mờ dần ra mép, nên đè lên
nền ảnh hay nền màu nào cũng ăn — tô màu đặc tính từ `paper` thì chỉ khớp khi
nền đúng là `PAPER`, ghép vào cảnh có nền riêng là lộ một vũng kem. `shadow={0}`
để tắt. Người xoay cả thân (`rotate` khác `0`, [03](03-scene.md#nằm-và-xoay-cả-người))
không có bóng này — chân không còn đứng trên đất.

### Bóng khối

Mảng tối bên trong hình, để khối đầu và thân áo không đọc ra thành mảng phẳng.
Màu nét (`palette.line`) phủ lên phần mảnh **nằm ngoài vùng sáng**, alpha là
`palette.shade` (mặc định `SHADE = 0.3` — mảnh tối còn 70 %). Mép cứng, không
gradient, không blur: một lưỡi liềm ôm viền.

Vùng sáng là **chính hình bao của mảnh**, lấy từ kênh alpha nên ảnh PNG, bộ phận
vẽ code và đầu đi chung một đường. Nó bóp ngang quanh tâm hộp còn
`1 − SHADE_RIM` rồi dịch ngang `SHADE_GAIN · faceDx`, với `faceDx` là độ trôi
nét mặt so với tâm đầu (`A.face.cx − A.face.headCx`, `+x` là phía nhân vật
nhìn). `SHADE_RIM = 0.06`, `SHADE_GAIN = 1`; `litTransform` và `shadeBands` ở
`shade.ts`.

Bóng nằm phía **gáy** (`−x`), dày lên theo `face.turn` và `head[lắc]`. Nhìn
thẳng (`faceDx = 0`) hai bên đều một viền mỏng `0.06 × nửa rộng`, đỉnh và đáy
không có bóng. Lắc âm thì viền gáy mỏng dần, cân hai bên rồi chuyển sang phía
mặt — **liên tục, không có bước nhảy phía** khi liếc. Bề dày ở đầu nửa rộng
`65`, `face.turn` mặc định `12`:

| `lắc` | phía gáy | phía mặt |
|---:|---:|---:|
| −45 | 0 | 9.4 |
| −20 | 7.5 | 0.3 |
| 0 | 15.9 | 0 |
| 20 | 24.3 | 0 |
| 45 | 33.4 | 0 |

Ở `lắc = 0` viền gáy chiếm khoảng `12 %` đường kính đầu, lắc mạnh lên tới `26 %`.
Đầu [`side`](#góc-nhìn) ghim nét mặt ở `SIDE_EYE` nên bóng dày hẳn về phía gáy mà
không cần chỉnh gì; đầu `back` không có nét mặt nên `faceDx = 0`, hai bên cân.

Nhận bóng: **đầu, `torso` và `hem`** (tập `SHADED` trong `Character.tsx`). Tóc,
râu, tay chân, đồ cầm tay, vai áo và khăn cổ thì không. Ở đầu thứ tự vẽ là
**ruột → bóng → nét viền**, nên bóng nằm dưới nét như ở mọi mảnh. `flip` lật cả
nhóm gốc nên bóng lật theo người.

`shade: 0` để tắt. Đây **không phải ánh sáng theo cảnh**: một hướng duy nhất cho
cả đầu lẫn thân, không có nguồn sáng, không đổi theo nền hay theo scene.

## Quy ước góc

Góc tính bằng độ, trong hệ toạ độ **cục bộ của nhân vật**.

- `0°` = đoạn chỉ **thẳng xuống**
- Dương = xoay về phía `+x` (phía trước, khi chưa lật)
- Khớp con (khuỷu, gối) đo **tương đối** so với khớp cha
- Chân là hai số `[hông, gối]`; **tay là ba số `[vai, khuỷu, cổ tay]`**

**Cổ tay chỉ xoay đồ cầm tay.** Rig không vẽ bàn tay, nên với nhân vật tay không
nó là số chết; nó tồn tại vì đồ cầm phải xoay được so với cẳng tay — xem
[Đồ cầm tay](#đồ-cầm-tay). Chân không có số thứ ba vì rig cũng không vẽ bàn chân.

**`torso` và `head[nghiêng]` đi theo chiều `rotate()` của SVG, ngược với mọi góc
khác.** **Tay** nằm *trong* nhóm xoay theo `torso`, nên góc thấy trên màn hình
của một đoạn tay là `vai + khuỷu − torso`. Gằn người tới trước `30°` mà quên trừ
là cả cánh tay lệch `30°` so với chỗ định đặt.

**Chân thì không.** Hai chân treo ở hông tại gốc toạ độ và vẽ ở nhánh riêng
*ngoài* nhóm xoay thân (`Character.tsx`, `computeFigure` trong `geometry.ts`),
nên góc trên màn hình của một đoạn chân đúng bằng `hông + gối`, không trừ
`torso`. Trừ đi là ra người đứng khom mà chân duỗi thẳng chứ không quỳ: tư thế
quỳ cần gối gập hẳn (`−72`/`−82`) bất kể `torso` bao nhiêu. Nó phải như vậy —
`F.lowest` suy chỗ chạm đất từ hai bàn chân, gằn người tới trước mà chân đi theo
thì nhân vật lún xuống đất.

Lật nhân vật (`flip`) là `scaleX(-1)` trên nhóm gốc — mọi góc giữ nguyên. Nhờ
vậy một thư viện tư thế dùng được cho cả hai hướng.

Hướng vector của một đoạn dài `L` ở góc `θ`:

```
(x, y) → (x + L·sin θ, y + L·cos θ)
```

**Quy ước này ngược dấu với `rotate()` của SVG/CSS.** `rotate(φ)` đưa trục `+y`
về `(−sin φ, cos φ)`, nên mảnh nằm dọc đoạn ở góc `θ` phải dùng
**`rotate(−θ)`**. Kiểm dấu bằng pose góc lớn như `shrug`.

### Vươn chi

`stretch` là kênh dài chi của pose, số dương, mặc định `1`. JSON nhận hai dạng:

- **Bốn số** `[tay xa, tay gần, chân xa, chân gần]`: mỗi số nhân vào **cả hai đoạn**
  của chi ấy — cánh tay trên lẫn cẳng tay, đùi lẫn cẳng chân — nên tỉ lệ bên trong
  chi giữ nguyên, chỉ tổng chiều dài đổi.
- **Tám số** từng đoạn, hai số một chi theo cùng thứ tự, đoạn gốc trước: `[tay xa
  trên, tay xa dưới, tay gần trên, tay gần dưới, đùi xa, cẳng chân xa, đùi gần, cẳng
  chân gần]`.

Bên trong rig luôn là tám số (`Stretch`): `stretchSegs` trải bốn số ra tám,
`stretchJson` gọn lại bốn số khi chi nào cũng có hai đoạn bằng nhau — `poseDelta` và
file xuất từ studio đi qua nó. Mốc bốn số và mốc tám số trong cùng một hành động nội
suy chung được.

Vị trí bàn tay trong hệ thân, `sU` và `sL` là hệ số cánh tay trên và cẳng tay của
chính tay ấy (dạng bốn số thì `sU = sL = s`):

```
x = vai.x + sU·sin(vai)·62 + sL·sin(vai + khuỷu)·58
y = vai.y + sU·cos(vai)·62 + sL·cos(vai + khuỷu)·58
```

Tầm với chuẩn là `62 + 58 = 120`, vai gần ở `(−40, −100)`; bảng tính ở dạng bốn số:

| Đích | Cách vai | Cần `stretch` |
|---|---:|---:|
| giữa đầu | 101 | 1 |
| sau gáy | 116 | 1 |
| đỉnh đầu | 163 | ≥ 1.36 |
| mũi chân gần | 261 | ≥ 2.17 |
| chạm đất trước mặt | 279 | ≥ 2.32 |

Cột cuối là mức tối thiểu để **đường thẳng** vai→đích đủ dài. Khối đầu nằm chắn
giữa: muốn khuỷu vòng ra **ngoài** khối đầu (bán kính `65`, tâm `(0, −193)`) chứ
không cắt qua nó, tay lên đỉnh đầu cần khoảng `1.6`.

Hộp mảnh: vai áo kéo **dọc** theo hệ số cánh tay trên của tay ấy
(`upperArm · sU + cap`) để `sleeveFit.hideUpperArm` không hở khúc giữa vai áo và
cẳng tay. Đồ cầm tay giữ nguyên cỡ hộp, chỉ đi theo cổ tay đã vươn; hộp `hem` không
theo chân. Bảng trôi ngang (`feet`) và gốc `feet` (`F.lowest`, hông tính từ bàn chân
chạm đất) đo đúng độ dài từng đoạn.

**Ghép theo chi.** Hệ số của một chi chỉ có hiệu lực khi hành động — hay clip, sau khi
scene cắt `mask` — cũng ghi chính chi ấy; hành động chỉ ghi `stretch`, không ghi chi
nào, thì phủ cả bốn chi (`stretchOwns`). `composePose` và `blendPose` đè `stretch` theo
từng chi (`stretchOver`), nên hành động ngồi vươn cẳng chân và track gõ phím vươn tay
đặt sau nó chồng lên nhau được, không cái nào xoá hệ số của cái kia. `mask` khai tường
minh thì phải liệt kê cả `stretch`.

**Vươn thì đừng tắt `limbCurve`.** Kéo dài một đoạn **thẳng** là lộ sai tỉ lệ
ngay; kéo một đường **cong** thì mắt đọc ra "tay vươn" — xem [Vẽ
chi](#vẽ-chi). Nhân vật hạ `palette.limbCurve` về `0` thì đừng cho vươn quá
khoảng `1.2`.

Tay đặt lên đỉnh đầu:

```json
{ "pose": { "armNear": [-157, -73, 0], "stretch": [1, 1.65, 1, 1] },
  "layer": { "armNear": "front" } }
```

Vai âm quét cánh tay lên phía ngoài đầu, khuỷu cùng dấu âm cuộn cẳng tay về đỉnh
đầu: khuỷu ra ngoài khối đầu ở khoảng `(−80, −194)`, bàn tay ở `(−7, −256)`.

Ngồi nhìn từ sau — hành động chung `sit-rear`: đùi chạy sâu vào khung nên ngắn lại,
cẳng chân đứng thẳng từ mép ghế xuống sàn nên dài ra:

```json
{ "pose": { "legFar": [82, -82], "legNear": [82, -82],
            "stretch": [1, 1, 1, 1, 0.75, 1.19, 0.75, 1.19] } }
```

Hông cách sàn `78 · 0.75 · cos 82° + 92 · 1.19 ≈ 118`, bằng mặt ghế văn phòng; tay đặt
trên đùi như hành động `sit`, `mask` gồm bốn chi, `torso` và `stretch`. Hành động `sit`
(chân `[70, −70]`, `78 · cos 70° + 92 ≈ 119`) cho đùi dốc xuống `20°` dưới phương ngang: hợp nhìn
nghiêng, nhìn từ sau thì đùi đâm xuyên đệm ghế. Dùng `sit-rear` với [thân `rear`](#thân-rear) và một track tay gõ phím đặt sau
nó; cảnh có lớp ghế thì ghép `cast[].zParts` cho chân nằm sau đệm
([03](03-scene.md#tách-người-theo-z)).

## Các bộ phận

Đầu **không nhận ảnh**. Mặt sẽ chuyển động (quay, gật, nhép) nên đầu phải là
hình code để biến đổi được cùng mặt. Tóc và râu thì ngược lại, là mảnh cắm vào
socket trên đầu, kể cả [tóc](02-trang-phuc.md#tóc-dựng-khối) và
[râu dựng khối](02-trang-phuc.md#râu-dựng-khối); riêng ria mép và nếp nhăn vẫn vẽ code
vì chúng bám khẩu hình và tâm mặt. Ba dạng: `round` (ellipse), `square` (chữ nhật bo `0.35 × cạnh
ngắn`), `trapezoid` (trán rộng, cằm `0.72` trán). `scaleX`/`scaleY` nhân lên
`headH/2`, không có `scale` chung — muốn to đều thì kéo cả hai.

| Bộ phận | Cấu tạo | Điều khiển bằng |
|---|---|---|
| `root` | Nhóm gốc chứa toàn bộ nhân vật | `x, y, scale, flip` |
| `head` | **Vẽ bằng code**: ellipse / vuông bo / hình thang, `scaleX`, `scaleY`; nhận [bóng khối](#bóng-khối). Nét mặt vẽ hay không là do `headView` | `head.shape, scaleX, scaleY, dx, dy, follow, followBack`, `palette.shade`, `headView` |
| `hair` | [Kiểu tóc](02-trang-phuc.md#kiểu-tóc) cắm ở `hair`, có hình riêng cho cả bốn góc; tóc ảnh thì mái ở `hair`, mảng sau gáy ở `hairBack` | `pieces.hair.*`, `pieces.hairBack.*` (chỉ tóc ảnh), `headView` |
| `face` | SVG chồng lên đầu: mắt, lông mày, miệng | kênh `face` + `keys[].face` của hành động |
| `wrinkle` | SVG dưới nét mặt: nếp trán, chân chim, túi mắt, pháp lệnh | `face.wrinkle.*` (hằng số của nhân vật) |
| `torso` | Không vẽ; chỉ là đoạn hông→vai để cắm mảnh thân áo, mảnh ấy nhận [bóng khối](#bóng-khối) và có hình `side` / `back` riêng | `rotate`, `palette.shade`, `view` |
| `arm.near/far` | Hai đoạn: cánh tay trên + cẳng tay | `shoulder°, elbow°`, `stretch` |
| `leg.near/far` | Hai đoạn: đùi + cẳng chân | `hip°, knee°`, `stretch` |

**near / far** thay cho trái / phải, vì nó vừa xác định được thứ tự lớp vừa đúng
ở mọi [góc nhìn](#góc-nhìn): `near` là chi bên `−x`, `far` là chi bên `+x` (phía
nhân vật nhìn khi thân `front` hay `side`). Trái/phải trên màn hình là `flip` ở
scene, không phải đổi tên chi.

## Socket

Điểm cắm phụ kiện. Một nhân vật phụ = base + bảng màu + vài chuỗi tên mảnh.

**Bảng này là *điểm neo*, không phải danh sách khoá cắm được.** Khoá thật nằm ở
`PIECE_KEYS` của rig (`describe_rig` trả sẵn); dòng nào ghi *chưa dựng* là spec
chưa có khoá, cắm vào là zod báo lỗi. Dựng một socket mới chỉ vì một cảnh cần nó
thì đọc mục [bước 1 không được sửa rig](07-lam-tap.md#bước-1-không-được-quyền-sửa-rig)
trước.

| Socket | Vị trí | Cắm được gì |
|---|---|---|
| `crown` | Đỉnh đầu | Khăn vấn, búi tóc, mũ — có `nonla` / `cap` / `khan` vẽ code |
| `hairline` | Trán | Tóc |
| `headAcc` | Đỉnh đầu, trên mũ | Phụ kiện đầu: sừng, tai, vòng hoa — `pieces.headAcc`, bám sọ, **không** trôi theo mặt |
| `faceAcc` | Ngang mắt | Phụ kiện mặt: kính, sẹo, mặt nạ — `pieces.faceAcc`, trôi **đúng bằng** nét mặt |
| `chin` | Cằm | Râu — `pieces.chin`: ảnh, bộ phận trong `PARTS`, hay [râu dựng khối](02-trang-phuc.md#râu-dựng-khối); `layer` chọn trên hay dưới nét mặt, râu dựng khối luôn dưới |
| `neck` | Khớp cổ | Khăn quàng, cà vạt, yếm — có `khanco` vẽ code |
| `torso` | Thân | Thân áo; có các mẫu áo trong `PARTS` |
| `pelvis` | Hông | Tà áo, váy — `pieces.hem`, có `skirt` / `ta` vẽ code, hay [váy dựng khối](02-trang-phuc.md#váy-dựng-khối); `layer` chọn trên hay dưới thân áo |
| `handNear/handFar` | Bàn tay | Đồ cầm tay: công cụ, gậy, bó đồ — `pieces.handNear/handFar` |
| `back` | Giữa lưng | Đồ vác vai — **chưa dựng**, không có trong `PIECE_KEYS` |
| `saddle` | *(nằm trên ngựa)* | Người cưỡi cắm vào đây — **chưa dựng**, xem dưới |

### Mốc đặt mảnh

Số dưới đây là hằng số trong `packages/rig/src/core`; bên tiêu thụ đọc từ đó chứ không
chép lại. Bảng này để đối chiếu khi sửa hằng số. Công thức thật nằm ở
`figureAnchors` (`anchor.ts`) — **một bảng duy nhất**, `<Character>` vẽ bằng nó và
`anchorAt` đọc lại nó, xem [03 — Hỏi mốc trên người](03-scene.md#hỏi-mốc-trên-người).
Muốn biết một mảnh đang ở đâu trên khung thì hỏi `anchorAt`, đừng chép bảng này ra
tính tay.

Mọi mảnh dùng chung một công thức: hộp ảnh cao `boxH × scale`, rộng
`boxW × scale × aspect × widthScale`, mép trên đặt ở `anchorY + dy`, tâm ngang ở `dx`, rồi
xoay `rotate` độ quanh **tâm hộp**. `boxW` là `boxH` ở `height = 1` — tức bề
ngang không đổi khi kéo `Chiều cao`. Chỉ khác nhau `boxH` và `anchorY`, và hai
socket treo vào khớp thì `rotate` xoay quanh chính cái khớp ấy chứ không quanh
tâm hộp. Socket có hình theo [góc nhìn](#góc-nhìn) đi đường khác khi đang vẽ
`side`, `rear` hay `back` — kiểu tóc thì ở mọi góc, kể cả chính diện: hộp suy từ
khung `VIEW_FRAME` đặt theo xương, không từ `boxH`/`anchorY` dưới đây.

| Socket | `boxH` | `anchorY` | Hệ toạ độ |
|---|---|---|---|
| `hairline` | `headH` | `−headH × scaleY(đầu)` — đỉnh đầu | trong nhóm đầu |
| `crown` | `headH` | như `hairline`, vẽ sau nó | trong nhóm đầu |
| `headAcc` | `headH` | như `hairline`, vẽ sau `crown` | trong nhóm đầu, **không** trôi theo mặt |
| `faceAcc` | `headH` | như `hairline`, vẽ trước `hair` | trong nhóm đầu, trôi đúng bằng mặt |
| `chin` | `headH` | `−headH × scaleY(đầu) × 0.10` — cằm | trong nhóm đầu |
| `neck` | `torso × 0.6` | `−(torso + neck)` — khớp cổ | trong nhóm thân |
| `pelvis` | `thigh + shin` | `0` — chậu hông | trong nhóm thân |
| `sleeve.near/far` | `upperArm × stretch cánh tay trên + nét tay/2` — [vươn chi](#vươn-chi) | `−nét tay/2` | trong nhóm xoay theo `góc vai + rotate` |
| `handNear/handFar` | `upperArm + foreArm` — **không** nhân `height`, **không** theo `stretch` | `−boxH/2` — hộp đặt **tâm** ở bàn tay | trong nhóm xoay theo `vai + khuỷu + cổ tay + rotate` |

`pelvis` lấy `boxH = thigh + shin = 170` là cố ý: `scale = 1` thì gấu tà áo
chạm đúng ground line, không phải căn tay. Tà áo **không ăn theo góc chân**, chỉ
nghiêng theo thân — và khi có tà áo thì ẩn chân, theo
[02 — Trang phục](02-trang-phuc.md). `pieces.hem.layer` = `under` thì tà
vẽ trước thân áo, tức thân áo đè lên gấu tà.

### Đồ cầm tay

Đồ cầm tay lấy hộp vuông cạnh `120`, tâm ở bàn tay; hộp không kéo theo `Chiều
cao` và không theo `stretch`, chỉ đi theo cổ tay. Điểm cầm nằm giữa ảnh, cán dọc
trục ảnh, đầu xa ở mép dưới; `dx/dy` dời điểm cầm.

**Hai góc, hai chủ sở hữu.** `pieces.hand*.rotate` là cách nắm cố định trong JSON
nhân vật; số thứ ba của `armNear`/`armFar` là cổ tay thay đổi theo hành động. Vật
cầm vẽ cùng lớp với cẳng tay, nên tay
cầm rìu vung qua đầu phải khai `layer: front` như mọi tay đưa lên mặt.
`pieces.hand*.layer: "under"` là ngoại lệ duy nhất: vật vẫn treo ở bàn tay nhưng
vẽ sau cả chân lẫn thân — bó củi vác sau lưng, cái nón cầm buông thõng — và đó là
hằng số của nhân vật hay của vật trong `items`, không phải của hành động. Đồ vật
là **mảnh của nhân vật, không phải của hành động**: `chop.json` chỉ có góc
khớp, cùng một file dùng cho rìu, cuốc hay búa — scene chọn nhân vật đã cắm
đồ gì, hoặc đổi vật ở `handNear` giữa hai clip — xem
[Đồ thay được](#đồ-thay-được-items-và-equip).

`crown` dùng chung hộp với `hairline` — khăn và tóc là hai mảnh chồng nhau trên
cùng một cái đầu, khác nhau ở `scale` và `dy`. Đầu rig là hình tròn nên vùng từ
đỉnh đầu tới trên lông mày chỉ cao bằng **một phần ba** bề ngang đầu: mảnh khăn
hay mái tóc phải là cung nông, rộng gấp ba lần cao.

Tóc và râu vẽ **đè lên đầu**, sau mặt, theo đúng thứ tự lớp đã khoá. Hệ quả là
mảnh tóc phải có lỗ khoét chỗ mặt và mảnh râu phải bắt đầu từ dưới miệng, không
thì che mất khẩu hình — ràng buộc này thuộc về **prompt gen ảnh**.

### Đồ thay được: `items` và `equip`

`pieces` là mảnh nền của nhân vật. `items` là danh mục vật có thể trang bị;
scene và hành động gọi chúng theo tên:

```json
"pieces": { "torso": { "src": "part", "part": "tunic-02" }, "hair": { … } },
"items": {
  "axe":  { "handNear": { "src": "part", "part": "axe", "scale": 2.4, "rotate": -90 } },
  "hat":  { "crown":    { "src": "part", "part": "crown-03", "dy": -85, "scale": 1.1 },
            "handFar":  { "src": "part", "part": "crown-03", "scale": 0.7 } },
  "armor": { "torso":   { "src": "image", "file": "torso/armor.png", "dy": -16, "scale": 1.36 } }
},
"outfits": { "woods": { "handNear": "axe", "crown": "hat" } }
```

Một vật khai **nhiều socket là để nó đổi chỗ** — cái nón cầm ở tay rồi đội lên
đầu vẫn là một vật, mỗi lúc chỉ một socket giữ nó. Đó cũng là chỗ khai **cách
nắm**: `rotate`, `dx/dy`, `scale` của từng socket là hằng số của nhân vật, không
phải của cảnh; xem [Đồ cầm tay](#đồ-cầm-tay).

`equip` chọn vật cho socket, và nó là **công tắc**: socket không nhắc tới thì
giữ nguyên thứ đang có.

| Giá trị | Nghĩa |
|---|---|
| `"axe"` | vật ấy chiếm socket, đè cả mảnh nền — **thay áo** cũng chỉ là `{ "torso": "armor" }` |
| `null` | socket trống — cởi kính, bỏ mũ |
| `"base"` | về lại mảnh nền trong `pieces` |
| không có khoá | giữ nguyên thứ đang mặc |

Giá trị của chính `equip` cũng nhận **tên một bộ đồ** trong `outfits`, hoặc một
mảng nhiều bước (`["linh-gac", { "faceAcc": "kinh" }]`). `outfits` chỉ là cách
viết gọn: mặc một bộ là đặt luôn từng socket của bộ ấy, không có khái niệm nào
mới. Tên vật lạ hoặc vật không khai socket ấy thì **giữ mảnh nền** — giữa phim
không cởi đồ người ta ra vì một lỗi chính tả; `stickman check` và MCP là chỗ báo.

Ba chỗ ghi `equip`, đọc theo thứ tự: `cast[].equip` lúc mở màn (xem
[03 — Đổi đồ](03-scene.md#đổi-đồ)), rồi `keys[].equip` của từng hành động (xem
[Đổi đồ giữa chừng](#đổi-đồ-giữa-chừng)). Hành động **không biết ai diễn**, nên
tên vật trong nó là một giao kèo: mọi nhân vật đóng vai ấy phải có vật cùng tên.

## Thư viện tư thế

Pose là bộ góc khớp. Dấu tay đọc theo vị trí vai: vai gần ở `−x`, vai xa ở
`+x`; hai tay xoè đối xứng dùng gần âm, xa dương.

| Pose | far.vai | far.khuỷu | near.vai | near.khuỷu | thân | Dùng khi |
|---|---:|---:|---:|---:|---:|---|
| `idle` | 8 | −6 | −8 | 6 | 0 | Đứng nghe |
| `talk` | 10 | −8 | −18 | −64 | 2 | Nói, tay mở |
| `point` | 10 | −6 | 78 | 6 | 3 | Chỉ vào vật |
| `raise` | 10 | −6 | −140 | −8 | −2 | Giơ tay |
| `shrug` | 30 | 75 | −30 | −75 | 0 | Bó tay |
| `shock` | 45 | 80 | −45 | −80 | −6 | Hoảng |
| `think` | 10 | −6 | 60 | 135 | 4 | Chống cằm |
| `hold` | 22 | −124 | −22 | 124 | 0 | Cầm đồ trước ngực |
| `ride` | 34 | 48 | 40 | 44 | 4 | Ngồi trên lưng thú; chân `[76, −104]` / `[84, −98]`, mặc định khi `cast[].mount` |
| `sit` | 26 | 38 | 30 | 42 | 2 | Ngồi ghế, tay đặt trên đùi; chân `[88, −92]` / `[92, −88]`, mặc định khi `cast[].sit` |
| `lie` | 8 | −6 | −8 | 6 | 12 | Nằm ngửa gối đầu, dùng cùng `cast[].rotate: 90`; chân `[−10, 0]` / `[−11, 0]`, đầu cúi `18` — [03](03-scene.md#nằm-và-xoay-cả-người) |

`POSES` chỉ chứa góc tay chân và thân; `head` và cổ tay mặc định bằng `0`.
`POSE_LAYERS` chứa lớp đi kèm pose; `keys[].layer` đè lên nó.

Ràng buộc hình học:

- Tay xa có góc vai âm sẽ chui dưới thân; chỉ cẳng tay đổi lớp được.
- Tay giơ cao phải mở ra ngoài. Tay gần có góc vai `117°`–`204°` dùng
  `layer.armNear: "front"`; tay xa quá `155°` không còn thấy khúc trên.
- Tay chạm mặt hoặc đi qua đầu dùng lớp `front`.
- Chống cằm cần khuỷu lớn hơn `130°`.
- Ở `stretch = 1` tay với tới vùng từ thái dương tới quai hàm; đỉnh đầu cần
  `stretch ≥ 1.36` — xem [Vươn chi](#vươn-chi).
- Tay đưa lên đầu dùng góc vai âm. Gãi đầu dùng `[−132, −96]` rồi
  `[−110, −120]`.
- Hai tay gặp nhau trước ngực phải giữ khuỷu rộng như `hold`.
- Pose đứng dùng gối `0`, hông xa `+2°`, hông gần `−2°`; `shock` dùng `±6°`.
  Đổi `hipHalf` thì căn lại các góc này.

## Hành động

Chuyển động **không nằm trong JSON nhân vật** mà trong JSON hành động
(`actions/*.json`, `ActionSchema`): cùng một nhân vật đi ở scene này
và lê chân ở scene khác là hai hành động trên một nhân vật, và `walk.json` dùng
chung cho mọi người. Hành động là của chung, không phải của nhân vật — đừng
tạo `characters/but/actions/`. Thứ vẫn thuộc nhân vật là giới hạn khớp (tay
áo thụng không vung quá xa); không sửa file hành động theo từng nhân vật.

Một file là một hành động, và trong file chỉ có **một** nguồn số: `gen` (bộ
sinh dựng sẵn trong rig, config bằng `params`) hoặc `keys` (chuỗi mốc). Có cả
hai, hoặc không có cái nào, là lỗi schema.

```json
{ "schemaVersion": 13, "name": "wave", "duration": 0.63, "end": "hold",
  "mask": ["armNear"],
  "keys": [ { "t": 0, "pose": { "armNear": [-120, -30, 0] } },
            { "t": 0.2857, "pose": { "armNear": [-120, -70, 0] } },
            { "t": 0.5714, "pose": { "armNear": [-120, -30, 0] } },
            { "t": 1, "pose": "idle" } ] }
```

| Trường | Nghĩa |
|---|---|
| `duration` | Giây cho một lượt `t: 0 → 1`. **Chỉ là nhịp mặc định** — scene được đè, và scene mới là chỗ quyết định lặp mấy lần |
| `end` | Lấy mẫu qua mốc cuối: `wrap` nội suy vòng về mốc đầu, `hold` giữ nguyên mốc cuối. Đây là ngữ nghĩa **lấy mẫu**, không phải chuyện phát lại — sampler bắt buộc phải biết |
| `mask` | Kênh mà hành động này ghi: bảy khớp `armFar / armNear / legFar / legNear / torso / head / stretch` và `face` (nét mặt, không có góc). Bỏ trống thì suy ra từ các mốc |
| `keys[].t` | **Tỉ lệ chu kỳ, không phải giây.** Tăng dần trong `[0, 1]` |
| `keys[].pose` | Tên một pose trong thư viện, hoặc object chỉ đè vài khớp. Tay ba số `[vai, khuỷu, cổ tay]`, chân hai số `[hông, gối]`, `head` ba số (số nào `null` là không ghi góc ấy — [Đầu và nét mặt](#đầu-và-nét-mặt)), `torso` một số, `stretch` bốn hoặc tám số — [Vươn chi](#vươn-chi) |
| `keys[].reach` | Đích cổ tay hệ thân cho `armNear` / `armFar`: `{ "at": [tiến, y, ra ngoài], "elbow"?: [...] }`. Người 3D giải IK hai đoạn; người 2D vẽ góc dự phòng — [Đích bàn tay](#đích-bàn-tay) |
| `keys[].ease` | Áp cho đoạn **từ mốc này tới mốc sau**: `linear` đều, `smooth` chậm vào chậm ra (`smoothstep`, cùng đường với đoạn hoà, không vọt qua mốc sau), `spring` vọt qua rồi nảy về |
| `keys[].face` | Nét mặt kể từ mốc này: `{ "mouth": …, "brow": …, "eyes": … }`, khai trường nào thì ghi trường đó. **Không nội suy**, và chỉ ăn khi `face` nằm trong `mask` — xem [Đầu và nét mặt](#đầu-và-nét-mặt) |
| `keys[].equip` | Đổi đồ kể từ mốc này: `{ "crown": "hat", "handFar": null }`. **Công tắc**, không nội suy, không hoà và **không đi qua `mask`** — xem [Đổi đồ giữa chừng](#đổi-đồ-giữa-chừng) |
| `events[]` | Mốc `{ name, t }` đặt tên cho một pha va chạm; không ghi khớp nào — xem [Mốc sự kiện](#mốc-sự-kiện) |
| `keys[].layer` | Lớp vẽ cẳng tay kể từ mốc này, đè lên lớp thừa hưởng từ pose được gọi tên: `{ "armFar": "back" \| "mid" \| "front", "armNear": ... }`. **Không nội suy**; mốc sau không khai thì giữ nguyên. Chỉ ăn ở kênh nằm trong `mask`. [02 — Trang phục](02-trang-phuc.md#cẳng-tay-đổi-lớp-được-cánh-tay-trên-xa-thì-không) |
| `note` | Ghi chú cách dùng cho người soạn cảnh, tiếng Việt. Rig không đọc; studio giữ nguyên khi xuất |

**Ghép nhiều hành động là việc của scene, không phải của file.** `actionPose()`
chỉ trả các khớp hành động ghi; `composePose(nền, ...)` đè theo `mask`, không
cộng góc, riêng `stretch` đè theo từng chi ([Vươn chi](#vươn-chi)). Vẫy tay trong lúc đi là hai file, file vẫy chỉ ghi `armNear`.

**`mask` quyết định, kể cả khi mốc gọi tên pose.** Pose trong thư viện là đủ mọi
kênh — `wave` mà không có `mask: ["armNear"]` thì nó ghi cả hai chân, chồng lên
`walk` là chân đứng im.

**Nội suy theo từng kênh**, giữa hai mốc gần nhất *có nhắc tới kênh đó*, không
phải hai mốc kề nhau; ba góc của `head` nội suy riêng từng góc, mốc ghi `null` ở góc nào
thì không tính cho góc ấy. Nhờ vậy một hành động có được hai nhịp khác nhau cho hai kênh:
thân đổi chiều ở giữa, góc gật chỉ có mốc đầu và mốc cuối.

**Xuất từ studio là đóng băng số.** Tên pose chỉ là tiện nghi lúc soạn: bảng
`POSES` còn được tinh chỉnh, mà file hành động thì nằm ở repo video — trỏ theo
tên là mỗi lần rig chỉnh `idle`, mọi hành động cũ đổi hình mà không qua
`ACTION_VERSION` nào.

### Đầu và nét mặt

Kênh `head` là `[nghiêng, lắc, gật]`:

| Góc | Vẽ ra thành |
|---|---|
| `nghiêng` | `rotate()` quanh cổ; dương đưa đỉnh đầu về `+x` |
| `lắc` | Dịch nét mặt ngang `sin(lắc) · nửa rộng đầu · 0.38`; khoảng mắt co theo `cos` |
| `gật` | Dịch nét mặt dọc `sin(gật) · nửa cao đầu · 0.5`; khoảng mắt–mồm co theo `cos` |

Chỉ `nghiêng` xoay khối đầu. `lắc` và `gật` biến đổi nét mặt, không xoay viền đầu.
`faceAcc` đi đúng bằng nét mặt — [kính dựng khối](02-trang-phuc.md#kính-dựng-khối) thì
quay theo đầu rồi khớp vào mắt; `headAcc` bám sọ. `hair` và `crown`
theo `head.follow` (mặc định `0.1`), `hairBack` và lớp `under` của kiểu tóc theo
`head.followBack` (mặc định `−0.2`), `chin` theo nét mặt — [râu dựng khối](02-trang-phuc.md#râu-dựng-khối)
thì quay theo đầu rồi khớp khấc vào mồm.

**Tóc [dựng khối](02-trang-phuc.md#tóc-dựng-khối) đổi cả hai dòng dưới bảng thành
góc thật.** Tóc ấy quay theo đầu, nên nét mặt đầu `front` / `quarter` chiếu từ cùng khối sọ đơn
vị với tóc, qua `headTurn` / `turnPoint` ở `sphere.ts`: `lắc` là góc quay quanh trục
dọc, `gật` quanh trục ngang, `face.turn` đổi ra góc tĩnh `asin(turn / nửa rộng)`
rồi cộng `lắc`. Mắt ở vĩ độ của `face.offsetY` và kinh độ `± asin(eyeGap / 2 /
nửa rộng)`, mày cao hơn mắt `BROW_ABOVE`, mồm ở vĩ độ của `mouthGap`; cả ba chiếu
tâm, hình vẽ giữ nguyên, chỉ bóp ngang theo `cos(lắc)` và không mỏng hơn
`SIDE_EYE_OVAL`. Mắt xa quay ra sau viền thì không vẽ; mắt, mày, mồm cắt theo lòng
viền đầu. Tóc phẳng (kiểu tóc, tóc ảnh) không quay, nên giữ đúng bảng trên — đổi
công thức ấy là mắt chui dưới mái vẽ phẳng khi ngước.

Đầu `side` / `rear` dưới tóc dựng khối thì nét mặt **gật như một khối cứng**: đặt như lúc
không gật (ghim mép trước như mục [Đầu `side`](#đầu-side)), rồi cả cụm mắt, mày, mồm, ria,
nếp nhăn, `chin` và `faceAcc` ảnh đi trong `frames.face` — nhóm con của nhóm đầu, đưa tâm
mặt tới chỗ nó đi tới trên sọ đơn vị (`nodImage` ở `sphere.ts`) và xoay theo góc mà trục
ngang của ảnh quay tới. Nhìn nghiêng trục gật chĩa vào ống kính nên đó đúng là phép xoay
quanh tâm đầu, khớp tuyệt đối với tóc; ở `rear` góc xoay nhỏ hơn góc gật. Viền đầu và các
clip theo viền đứng yên trong nhóm đầu. `joints.face` / `eyeNear` / `eyeFar` / `mouth` treo
trong `frames.face`; `A.face.cx` / `cy` / `mouthCy` là chỗ đặt trước khi gật. Kính dựng khối ở
lại nhóm đầu: mắt kính dựng ở gật 0 rồi đi theo `frames.face`, càng chuyển dần về góc gật thật
của sọ tới tai. Râu dựng khối dựng ở gật 0 rồi đi theo `frames.face`. Tóc phẳng và đầu
`front` / `quarter` thì `frames.face` chính là `frames.head`.

`face.turn` là độ lệch tĩnh tính bằng px; `lắc` của hành động cộng thêm lên nó
và không đổi `flip`. Góc lắc được kẹp trong `±90°`. `face.turn` chỉ ăn ở đầu `quarter`,
đầu `front` coi nó là `0`; `lắc` ăn ở cả hai:
đầu `side` ghim nét mặt ở mép trước, đầu `back` không có nét mặt nào để dịch —
xem [Góc nhìn](#góc-nhìn).

`keys[].face` lấy mẫu bậc thang trên kênh `face` — kênh riêng trong `mask`, không
phải góc đầu. Hành động chỉ đổi mặt tự thêm `face` vào `mask` và không đụng
`head`, nên nhép miệng chồng lên một hành động đang gật đầu là giữ nguyên cái
gật. `composeFace` đè theo từng trường; không khai thì dùng `DEFAULT_FACE`. Trong
đoạn hoà, `blendFace` đổi ở giữa đoạn.

`mask: ["head"]` chiếm góc đầu mà không đụng nét mặt; `mask: ["face"]` thì ngược
lại; `clips[].mask` ở scene thu hẹp được từng kênh một. Nhả track mặt sau khi clip
thay thế đã hoà xong.

Bộ mẫu có sẵn một thang nét mặt chỉ ghi `face`: `face-calm`, `face-kind`,
`face-curious`, `face-ponder`, `face-focus`, `face-displeased`, `face-angry`,
`face-surprised`, `face-shocked`, `face-delighted`, `face-relieved`, `face-shy`,
`face-smug`, `face-greedy`, `face-worried`, `face-sad`, `face-pain`, `face-wince`,
cộng hai hành động có nhịp `face-effort` và `face-tired`. Cảnh xếp chúng thành một
track cảm xúc riêng, nằm dưới track nhép (`talk-lips`, `talk-angry-lips`) và trên track
thân; `look-camera` chỉ ghi góc lắc để quay mặt ra ống kính mà giữ nguyên cảm xúc.

**Góc đầu `null` là không ghi.** `head` của một mốc là `[nghiêng, lắc, gật]`, số nào
`null` thì hành động không ghi góc ấy: `composePose` và `blendPose` đè `head` theo từng góc
(`headOver`), góc để trống lấy của track dưới. `look-camera` ghi `[null, −29, null]`,
`talk-tilt` ghi `[10, null, null]`, `talk-nod` chỉ ghi gật — chồng ba track ấy theo thứ tự
nào cũng ra đầu nghiêng, gật mà vẫn nhìn ống kính. Hành động ghi đủ ba số thì đè cả ba,
kể cả lắc `0`: hành động đầu đi kèm lời nói để `null` ở góc lắc, không thì xoá hướng nhìn
của track khác. `actionDelta` trả nguyên `null`; trong `Pose` một phần, góc để trống là
`NaN` cho tới khi ghép.

### Đổi đồ giữa chừng

`keys[].equip` đổi vật tại một pha của hành động. Đổi socket giữ một vật phải
ghi cả hai phía trong cùng mốc:

```json
{ "t": 0,   "equip": { "handFar": "hat", "crown": null } }
{ "t": 0.6, "equip": { "handFar": null, "crown": "hat" } }
```

Mốc bật ở `t: 0` là bắt buộc: `end` giữ trạng thái mốc cuối sang lượt sau, nên
chỉ có mốc tắt là mảnh không hiện ở frame nào — xem
[03 — Bốn bẫy của `equip`](03-scene.md#bốn-bẫy-của-equip).

`equip` lấy mẫu bậc thang, không đi qua `mask` và không hoà. Socket không được
nhắc giữ nguyên trạng thái. Trạng thái tiếp tục qua clip sau cho tới khi một
mốc khác đổi nó. `cast[].equip` đặt trạng thái mở màn; chi tiết ghép scene nằm
ở [03 — Đổi đồ](03-scene.md#đổi-đồ).

### Mốc sự kiện

`events[]` đặt tên cho một **pha** trong chu kỳ: lưỡi rìu chạm gỗ, bàn chân chạm
đất. Nó không ghi khớp nào, không đi qua `mask`, không hoà và không đổi hình gì
cả — chỉ là một con số **có tên**.

```json
{ "name": "chop", "duration": 1.4, "events": [{ "name": "hit", "t": 0.445 }], "keys": [ … ] }
```

Đo bằng chính rig: pha `hit` của `chop` là lúc **bàn tay gần
xuống thấp nhất** (`computeFigure(c, actionPose(a, u))`, tìm `max y`), pha `step`
của `walk` là lúc **một bàn chân mới nhận lực** — đúng luật `onGround` mà
`bakeTravel` dùng, nên nó không lệch với trôi ngang được.

Scene đổi chúng ra giây bằng [`sceneEvents`](03-scene.md#hỏi-sự-kiện): clip lặp
thì sự kiện lặp theo, `phase` và `cycle` của clip tính sẵn trong đó.

### Chuyển giữa hai hành động

**Mốc `t: 0` là hình đầu tiên của hành động, không phải tư thế đứng trước nó.**
`sampleChannel` gán mốc này trực tiếp; `ease` chỉ áp dụng giữa hai mốc. Đoạn đưa
tay vào hình đầu tiên thuộc chỗ nối trong scene.

**Nhịp và trạng thái.** Suy ra từ file, không phải trường mới: `end: "hold"` mà
mốc cuối khác mốc đầu là **trạng thái** — nó đi tới một tư thế rồi giữ, scene
phải có clip khác kéo ra (`point`, `think`, `facepalm`, `hold`, `hips`). Mốc cuối
quay về `idle` là **nhịp**, tự dọn (`wave`, `shrug`).

Mốc cuối được giữ theo `end`; tay hạ xuống sau khi vẫy phải nằm trong chính hành
động nếu đó là một phần của chuyển động.

**Hoà là đường thẳng trong không gian góc, không phải trong không gian hình.**
Đường ngắn nhất về góc có thể quét bàn tay ngang qua mặt hoặc kéo khuỷu vào
trong thân áo giữa chừng. Cặp nào bị thì scene chèn một clip trung gian, thường
là `idle` ngắn — ngoại lệ vài cặp, không phải mặc định.

Thuật toán hoà nhiều track, clip rỗng và chỗ nối chồng nhau nằm ở
[03 — Chỗ nối](03-scene.md#chỗ-nối).

### Điệu bộ khi nói

Hành động khi nói của bộ chung đều **giơ một lần rồi giữ**: `end: "hold"`, mốc `t: 0` gần tư
thế nghỉ, mốc cuối là đích, đoạn giữa `ease: "smooth"` — đơn điệu, chậm vào chậm ra, không vọt.
Không cái nào lặp (`wrap`) hay nảy (`spring`): tay nhấp lên xuống theo nhịp đều nhìn giật. Mỗi
cú là một trạng thái; scene vào bằng blend ~`0,3`, buông bằng clip rỗng blend ~`0,4` hoặc thay
bằng cú khác.

| Hành động | `mask` | Đích ở `t: 1` | Dùng khi |
|---|---|---|---|
| `talk` | `armNear` | tay gần `[42, 84]` ra trước thân ngang ngực dưới | nói thường |
| `talk-hand` | `armNear`, `torso` | tay gần `[−24, −78]` chìa ra `−x`, thân `−4` | đưa ý, trình bày |
| `talk-hand-far` | `armFar`, `torso` | tay xa `[26, 80]` lớp `front`, thân `+4` | đưa ý về phía người nghe |
| `talk-hands` | `armNear`, `armFar`, `torso` | `[−24, −80]` / `[26, 80]`, thân `+2` | câu nhấn |
| `talk-shrug` | `armNear`, `armFar`, `torso` | `[−34, −100]` / `[34, 100]`, thân `−3` | câu hỏi, "ai mà biết" |
| `talk-chest` | `armNear`, `torso` | tay gần `[14, 128]` lên ngực, thân `−3` | nói về mình |
| `talk-point-far` | `armFar`, `torso` | tay xa `[80, −6]`, thân `+4` | chỉ người nghe |
| `hips-far` | `armFar` | tay xa `[36, −96]` chống hông | tay nền suốt đoạn nói |
| `talk-beat`, `talk-beat-back` | `torso`, `head` | thân `±4`, gật `2` | cú nhịp khi tay giữ nguyên, người đứng |
| `talk-beat-seated` | `torso`, `head` | thân `8`, nghiêng `−7`, gật `1` | cú nhịp người ngồi 2D, đầu bù gần thẳng đứng |
| `talk-beat-seated-3d` | `torso`, `head` | thân `8`, gật `−6` | cú nhịp người 3D ngồi, đầu ngửa bù gần thẳng đứng |
| `talk-sway` | `torso`, `head` | thân `+5` ở `t: 0,4` rồi `−4`, gật `2` | lắc qua rồi lắc lại, không về giữa |
| `talk-tilt`, `talk-tilt-back` | `head` | nghiêng `±10` | câu hỏi, phản bác |
| `talk-nod` | `head` | gật `5` ở `t: 0,4` rồi `2` | nói thẳng vào ống kính |

`duration` là `0,5 s` (`0,45` cho nhún vai, tay lên ngực, cú nhịp; `0,4` cho chỉ; `0,6`–`0,7`
cho gật và lắc qua lại): 15 → 85% quãng mất ~`0,24 s`. Scene đè bằng `cycle`.

- **Thân ngả về phía bàn tay vừa đưa ra**; tay và thân khởi cùng lúc, tới cùng lúc. Người đứng
  thì đầu đi cứng theo thân, nên hành động tay không ghi `head`.
- **Ba track:** tay (`talk*`, `hips-far` ở track dưới nó), nhịp thân (`talk-beat*`, `talk-sway`),
  đầu (`talk-tilt*`, `talk-nod`, `look-camera`). Mỗi hành động chỉ ghi góc đầu của nó, góc còn lại
  `null` ([Đầu và nét mặt](#đầu-và-nét-mặt)). Ba hành động đầu ghi ba góc khác nhau nên chồng
  theo thứ tự nào cũng được; cú nhịp cũng ghi gật (`talk-beat-seated` ghi cả nghiêng), nên khi
  trùng góc thì track trên thắng — đặt track đầu trên track nhịp để `talk-tilt`, `talk-nod` giữ
  góc của chúng. Track tay và track nhịp cùng ghi `torso`, track trên thắng: cú tay mới bắt đầu
  thì clip nhịp đã nhả, và ngược lại.
- **Người ngồi** dùng `talk-beat-seated` thay `talk-beat`. Thân ngả quanh hông, chân ở nhánh
  riêng nên bàn chân đứng yên. **Người 3D:** `torso` là góc cúi trong mặt phẳng dọc, nên thân
  `−4` của `talk-hand` là ngả lùi; các hành động này không khai `authoredAt`, tay vẽ trên mặt
  khung như người 2D. Nghiêng đầu của người 3D vẫn xoay trên mặt khung, nên không bù được cái
  cúi — nhìn chính diện nó thành ngoẹo cổ. Người 3D ngồi dùng `talk-beat-seated-3d`: bù bằng
  gật, cùng trục với cái cúi, đúng ở mọi góc quay khi tóc dựng khối; tóc ảnh hay kiểu tóc phẳng
  thì gật chỉ dời nét mặt, đầu đi theo thân như `talk-beat`.

### Chu kỳ đi

Bộ sinh `walkCycle`. Góc lấy từ clip đi `Walking` trên bộ xương Mixamo, khớp Fourier (`GAIT` trong
`walk.ts`): đùi, gối, vai, khuỷu và thân theo pha của một chân, `φ = 0` là lúc đùi ra trước nhất. `t`
chạy từ `0` tới `1` mỗi chu kỳ, `t = 0` là giữa pha vung của chân gần. Mỗi chân chạm đất một phần `β`
của chu kỳ (`stance`), vung phần còn lại; chân gần chạm gót ở `t = 0,5 − β/2`, chân xa nửa chu kỳ
sau. `u` là pha của chân tính từ lúc nó chạm gót, `φ₀` là pha clip lúc bàn chân ra trước nhất (chạm
gót), clip chạm đất `0,6` chu kỳ:

```
φ(u)          = φ₀ + u · 0,6/β                     khi u < β     ← pha trụ của clip giãn cho khớp β
              = φ₀ + 0,6 + (u − β) · 0,4/(1 − β)   khi u ≥ β
đùi           = hip · đùi_clip(φ) / nửa tầm đùi_clip       ← giữ lệch ra trước của clip
gối           = knee · gối_clip(φ) / gối_clip lớn nhất
chân trụ      x bàn chân lùi đều từ x(φ₀) tới x(φ₀ + 0,6), y theo clip, giải IK hai đoạn
khom          cả đường bàn chân nhân y với cos(crouch), giải IK
vai           = arm · (2 · vai_clip(φ) chuẩn hoá − 1)
khuỷu         = elbow · khuỷu_clip(φ) / khuỷu_clip lớn nhất
thân          = lean + dip · (2 · thân_clip(φ_gần) chuẩn hoá − 1)
```

Tay và khuỷu là của chính bên ấy, theo pha chân cùng bên: ngược pha với chân là có sẵn trong clip.

**Chân trụ quét về sau đều tốc nên người tiến đều.** Trôi ngang suy từ bàn chân chịu lực (dưới),
nên tốc độ người chính là tốc độ bàn chân trụ. Góc clip đổ thẳng vào rig que (đùi, cẳng khác tỉ lệ
người thật, không cổ chân) thì bàn chân trụ lùi không đều, người phóng rồi khựng; vì vậy pha trụ chỉ
giữ y của clip, x kéo thẳng rồi giải IK. Hông nhún là hệ quả của y ấy: lên giữa pha trụ, xuống lúc
hai chân cùng trụ.

**Chân sau lùi xa hơn chân trước với tới.** Bàn chân lúc nhấc ở sau hông xa hơn lúc chạm gót ở
trước hông, như clip — chân sau đã ra sau hông khi gối bắt đầu gập. Đừng làm hai đầu đối xứng: chân
sau tới chỗ nhấc sớm hơn rồi phải gập gối trong khi đùi còn chĩa trước, trông như khuỵu.

**Khuỷu tay luôn dương và gập nhiều nhất khi cánh tay đang vung ra trước.** Đây là chỗ dễ sai nhất:
nếu để khuỷu âm, cẳng tay gập ngược ra sau và cả người trông như đang đi lùi trong khi chân vẫn bước
tới. Khuỷu thấp nhất của clip là một phần ba đỉnh, nên `elbow ≥ 0` là đủ.

| Tham số | Mặc định | Ý nghĩa |
|---|---:|---|
| `hip` | 28° | Nửa tầm vung đùi; đùi lệch ra trước như clip (từ `−0,58 hip` tới `1,42 hip`) |
| `knee` | 68° | Gập gối đỉnh của chân vung |
| `stance` (`β`) | 0,6 | Phần chu kỳ mỗi chân chạm đất; trên `0,5` có lúc hai chân cùng trụ, `0,5` cho chạy |
| `arm` | 25° | Nửa tầm vung vai |
| `elbow` | 24° | Gập khuỷu đỉnh |
| `lean` | 2° | Ngả thân về trước |
| `crouch` | 0° | Khom người, cho dáng rón rén |
| `clear` | 8 | Khoảng hở tối thiểu (đơn vị rig) của bàn chân đang vung so với chân trụ |
| `dip` | 1° | Nửa tầm thân cúi theo bước; trung bình vẫn là `lean` |

`crouch` không dùng quá `45°` vì rig không có cổ chân.

**Thân cúi theo nhịp bước, hai lần mỗi chu kỳ**, theo clip. Đầu và tay đi theo thân, không bù: ở
dưới `2°` không cần, và bù đầu thì người 2D (nghiêng) với người 3D (gật) phải tách hai đường như
`talk-beat-seated`. Quá `2°` ở `walk` là gật gù. Lắc sang hai bên theo chân trụ không có: `torso` chỉ
một góc, ở người 3D là góc cúi.

**Gót nhấc trước khi chân rời đất.** `0,08` chu kỳ cuối pha trụ bàn chân sau được nâng dần tới `5`
đơn vị trên chân kia — hơn dải chạm đất (`4`) — nên đúng lúc nhấc nó đã thôi là chân chịu lực. Nâng
dần từ `0`: vào lúc ấy chân sau có khi còn là chân thấp nhất, nâng ngay là hông nhảy.

**Chân vung nhấc dốc, không thấp hơn chân trụ trừ `clear · bump`.** Thấp hơn thì bàn chân bị nâng
lên đúng mức ấy rồi giải lại IK, nối mềm bằng softplus nên gối không gãy góc. `bump` đỉnh sớm (~35%
pha vung), dốc lúc nhấc, thoải lúc đáp: bàn chân vung phải rời dải chạm đất ngay khi nhấc, kẻo luật
chân chịu lực còn tính nó và kéo tốc độ người xuống. Đừng gập thêm gối để tránh đất: đùi đã ra trước
mà gập gối thì bàn chân thấp xuống trước khi cao lên.

Đổi `hip`, `knee` hay `stance` là đổi quãng một chu kỳ: `walk`, `walk-fast`, `run`, `sneak` chung
đi `278`, `337`, `438`, `144` đơn vị rig mỗi chu kỳ (`actionStride`), cảnh có `path` phải viết theo
quãng ấy kẻo trượt chân. Mốc `step` của `walk` / `walk-fast` đo bằng luật chân chịu lực (dưới),
không phải `t` chạm gót trên giấy: bàn chân đang đáp lọt vào dải chạm đất trễ hơn vài phần trăm chu
kỳ.

**Trôi ngang cũng là hệ quả, suy từ chính bàn chân đó.** Chân đang chạm ground
line không được trượt: nó dịch bao nhiêu so với hông thì `root` dịch ngược lại
bấy nhiêu. `bakeTravel` trong `travel.ts`
tích phân một lần lúc nạp thành bảng theo bước `1/120 s` (`resolveScene` cho
scene, studio cho một lượt hành động); lúc vẽ chỉ tra bảng, nên hàm vẫn thuần
theo `t` và Remotion seek đâu cũng ra cùng một số. Tích luỹ trong rAF là sai.

Rig không có cổ chân, nên lúc hai chân mở ra, chân đang đáp xuống thấp ngang
chân đang đẩy — về hình học nó giống hệt dang chân đứng tại chỗ. Ba luật để
phân biệt, đều nằm trong `bakeTravel`:

- Chân đang chịu lực **giữ quyền** tới khi rời dải chạm đất (`4` đơn vị trên
  chân thấp nhất, chìm dưới nửa nét).
- Chân mới chỉ được nhận là chịu lực khi nó **ngừng tiến** — chạm gót. Trước đó
  nó là chân đang đáp, dù có thấp hơn.
- Hai chân cùng chịu lực thì lấy trung bình: `idle → shock` dang chân ra hai bên
  cho `0`, không đẩy người sang một bên.
- Không chân nào chịu lực (chân đẩy đã nhấc mà chân kia còn đang tiến, `run`
  có vài frame như vậy) thì `root` giữ đà bước trước.

### Đứng thở

Bộ sinh `idleSway`, một nhịp thở mỗi lượt `t: 0 → 1`, mặc định `3.2s`:

```
thân      = lean + A_breath · sin a
vai.near  = −8 − A_arm · sin a
vai.far   =   8 + A_arm · sin a
```

| Tham số | Mặc định | Ý nghĩa |
|---|---:|---|
| `A_breath` | 2° | Nhịp thở, thân đảo trước sau |
| `A_arm` | 3° | Tay nhích ra vào theo nhịp |
| `lean` | 0° | Ngả thân về trước |

Chân đứng yên ở `idle`; nhịp thở không có bob riêng.

Muốn một tư thế `hold` tiếp tục thở, clip sau phải giữ cùng `mask`, pose, layer
và mặt; chỉ thay các kênh tạo nhịp thở.

## Khẩu hình và mắt

Không cần viseme thật. Cảm xúc chọn một **bộ** khẩu hình, mỗi bộ có đủ năm vai: nghỉ, răng
cắn, há vừa, há to, tròn. Khi nói, miệng xoay chủ yếu giữa răng cắn và há vừa, há to ở tiếng
nhấn, tròn ở nguyên âm tròn môi, khép khi nghỉ từ 0,2 s.

| Hình miệng | SVG | Kích hoạt |
|---|---|---|
| `closed` | Đoạn thẳng ngắn | Im lặng |
| `parted` | Khe nhỏ khép nhọn hai đầu, không răng | Khựng, chưa biết đáp; đi với mắt `open`, mày `lifted` |
| `talkTeeth` | Chữ D (mép trên gần phẳng, đáy tròn) tô trắng, vạch mực cong chia hai hàm, không khoang | Nói: răng cắn — tiếng nhỏ, phụ âm, nguyên âm `i`, nghỉ ngắn |
| `talkA` | Chữ D, dải răng trên, khoang đỏ nâu bên dưới | Nói: há vừa — nguyên âm `a`, `e`, tiếng thường |
| `talkB` | Chữ D sâu hơn `talkA` (cao ≥ 1,25 lần), dải răng trên, lưỡi ở đáy | Nói: há to — tiếng nhấn, to nhất đoạn |
| `talkO` | Bầu dục đứng có viền, dải răng trên, lưỡi ở đáy | Nói: nguyên âm `o` kéo dài (おう, おお, オー) |
| `talkSadA` / `talkSadB` | Miệng hé ngang, vòm trên nhẹ, đáy phẳng, khoé bo; A tô trắng, B mở sâu với dải răng trên | Nói buồn nhẹ, ngập ngừng, thắc mắc |
| `talkAngryA` / `talkAngryB` | Khoang miệng căng bè, dải răng trên, há nhỏ / lớn | Vừa giận vừa nói |
| `smile` | Cung cong lên | Vui |
| `frown` | Cung cong xuống | Buồn, thất vọng |
| `pain` | Nét run dạng sóng | Đau, nhăn nhó |
| `o` | Tròn nhỏ có viền, dải răng trên | Ngạc nhiên; nói: nguyên âm tròn môi |
| `wide` | Ellipse gần tròn, to, có viền, dải răng trên, lưỡi ở đáy | La hét |
| `grit` | Hình thang bo góc (trên rộng hơn dưới), dải răng trắng liền chia đôi ngang | Nghiến răng, gồng, tức; răng cắn của bộ giận |
| `grin` | Cung cong xuống tô khoang miệng, dải răng trắng bám mép trên | Cười toe, hớn hở; há to của bộ vui |
| `wry` | Nét lượn sóng hai khoé hếch lên, lệch nhẹ (波線の口) | Cười gượng mím môi, ngượng, 「うん…」 |
| `wryOpen` | Miệng há lệch: khoé trái cao, khoé phải thấp, đáy sâu về phải, dải răng trên bám mép, lưỡi hồng ở đáy | Cười gượng há miệng 「えへへ…」, (^^;) — đi với mắt `happy`, mày `sad` |

Bộ khẩu hình theo cảm xúc (`--mood` của `lipsync`):

| Bộ | Nghỉ | Răng cắn | Há vừa | Há to | Tròn |
|---|---|---|---|---|---|
| `neutral` | `closed` | `talkTeeth` | `talkA` | `talkB` | `o`, `talkO` |
| `happy` | `smile` | `talkTeeth` | `talkA` | `grin` | `o`, `talkO` |
| `sad` | `frown` | `talkSadA` | `talkSadB` | `talkSadB` | `o`, `talkO` |
| `bored` | `closed` | `talkSadA` | `talkSadB` | `talkSadB` | `o`, `talkO` |
| `angry` | `frown` | `grit` | `talkAngryA` | `talkAngryB` | `o`, `talkO` |

Nghỉ của bộ giận là cung trễ `frown`, không phải `grit`: nghiến răng là một nhịp trong lời. Hành
động nhép chỉ ghi `mouth` để giữ mắt và mày của lớp cảm xúc; chọn mày `sad` hoặc `angry` ở lớp
ấy. Các bộ miệng không tự đổi theo mày hay audio.

**Cách `lipsync` chọn hình** (`tools/lipsync.mjs` của repo video, [07](07-lam-tap.md#khẩu-hình-theo-lời)):

- Một hình mỗi **mora** với chữ có kana (ゃゅょ ghép vào mora trước; `っ`, `ん`, `ー` là mora
  riêng), một hình mỗi tiếng với chữ Latin. Kanji không đọc được âm: số mora ước theo độ dài chữ
  chia `--step` (mặc định 0,13 s). Mora chia đều độ dài chữ; mora ngắn hơn 0,07 s gộp vào mora kề.
- Âm → vai: `a`, `e` há vừa; `i`, `っ`, `ん` răng cắn; `o` tròn; `u` tròn khi chữ chưa có mora
  `o` nào, không thì răng cắn; `ん` cuối đoạn là nghỉ. Kéo dài (`ー`, う sau `o` / `u`, い sau
  `e`, nguyên âm sau mora cùng âm như おお, ええ, いい) gộp vào mora trước, một hình không mấp máy;
  `o` kéo dài là `talkO`. Chữ Latin: có `o` / `ô` / `u` (trừ âm cuối của ao, au, âu, eo và u của
  qu) là tròn, chỉ có `i` / `y` / `ư` là răng cắn, còn lại há vừa. Mora không đọc được âm xoay
  răng cắn ↔ há vừa.
- Hai mora liền nhau ra cùng một hình thì mora sau đổi răng cắn ↔ há vừa, cho miệng vẫn mấp máy;
  hai mora tròn liền nhau (ここ, どこ) giữ tròn.
- **Há to**: đọc được độ to từ file tiếng thì mỗi 1,5 s của một đoạn lấy mora to nhất (không
  phải mora tròn); tiếng lặng hay không đọc được thì mora đầu mỗi đoạn.
- Âm môi (ま・ば・ぱ, chữ Latin mở đầu m / b / p) dài từ 0,14 s thì khép 0,07 s ở đầu mora; chữ
  Latin xét độ dài cả tiếng.
- **Nghỉ giữa hai chữ**: dưới 0,07 s giữ hình đang có; 0,07–0,2 s răng cắn; từ 0,2 s khép về
  hình nghỉ của bộ. Đoạn lời là chuỗi chữ giữa hai lần khép.
- Hình giữ chưa tới 0,07 s nhường cho hình trước; hình mở đầu lời ngắn thế thì về hình nghỉ.
- Hình đặt đúng mốc đầu mora, không đi trước hay sau tiếng. Ra khoảng 8 lần đổi hình mỗi giây,
  mỗi hình 0,1–0,15 s, mỗi câu 4–5 hình khác nhau.

Răng luôn là **một dải trắng liền**, không kẻ từng chiếc — kẻ ô ở cỡ này thành hàm răng nhe.

`mouthExtent(kind)` trả mép trên / dưới của mỗi khẩu hình so với tâm miệng —
đây là số mà ria mép bám vào.

Mắt là hai chấm, đổi kiểu chứ không có tham số:

| Kiểu mắt | SVG | Kích hoạt |
|---|---|---|
| `open` | Chấm tròn `r6` | Mặc định |
| `shut` | Đoạn thẳng ngắn | Chớp, nhắm tịt, nhăn mặt |
| `wide` | Lòng trắng `r12` viền đậm + con ngươi `r5` | Trợn, sốc, hoảng |
| `squint` | Nửa dưới con ngươi, mi trên sụp | Nheo, nghi ngờ, mệt |
| `happy` | Cung cong lên | Cười tít |
| `squeezed` | Hai nét gấp `> <` | Nhắm chặt, đau, gồng |
| `droopy` | Mi xiên xuống phía ngoài, mảng mắt rũ | Mệt, buồn nhẹ |
| `wink` | Mắt gần nhắm cong nhẹ, mắt xa mở | Nháy mắt, ra hiệu |

`wide` là kiểu duy nhất có lòng trắng và dùng với mày `raised`.

Mày `lifted` nhấc nhẹ, gần ngang; dùng cho phản ứng thoáng qua. Mày `raised`
nhấc cao và cong rõ, dùng cho ngạc nhiên mạnh hơn.

**Cả ba — khẩu hình, lông mày, kiểu mắt — vào được file hành động** qua
`keys[].face`; xem [Đầu và nét mặt](#đầu-và-nét-mặt). Chớp mắt vu vơ thì không:
đó là nhịp ngẫu nhiên của bên phát (studio và scene tự chớp), hành động
chỉ ghi cái nhắm mắt *có nghĩa*.

Tâm miệng nằm dưới tâm mắt đúng `face.mouthGap` (mặc định `34`). Mỗi ảnh đầu
một tỉ lệ mặt khác nhau nên kéo slider **Mắt → mồm** trong studio cho khớp; ria
mép neo theo tâm miệng nên đi theo luôn.

### Ria mép vẽ bằng code

Râu là mảnh cắm ở socket `chin`: ảnh, bộ phận SVG ([02](02-trang-phuc.md)), hoặc
[râu dựng khối](02-trang-phuc.md#râu-dựng-khối) quay theo đầu và khớp khấc vào mồm. Ria mép
vẽ bằng code để co theo khẩu hình, kể cả khi râu dựng khối.

`pieces.chin.layer` chọn chỗ vẽ mảnh râu trong khối đầu: `front` (mặc định) là
trên cùng, `under` là trên khối đầu và nếp nhăn nhưng **dưới mắt, mày, ria và
miệng**. `under` dành cho râu quai nón — mảnh cứ tô kín cả vùng mồm, miệng vẽ đè
lên nên không phải khoét alpha chừa chỗ; đổi lại râu không che được nét mặt nào.

`moustache = { kind, color, width, dx, dy, follow }`, vẽ **trước** miệng, cùng
hệ toạ độ với miệng (`dx, dy` là độ lệch so với tâm miệng), tỉ lệ theo `scale`
đầu:

| `moustache.kind` | Hình |
|---|---|
| `none` | Không vẽ ria |
| `short` | Hai múi ngắn, đầu thuôn, mép dưới tỉa nhọn và nét sợi xuôi sang hai bên |
| `long` | Hai dải ria thuôn rủ xuống, tách ngọn và nét sợi cong theo dải |
| `pencil` | Ria mảnh ôm môi, rẽ giữa, đuôi nhọn |
| `chevron` | Ria chữ V dày, xoè chéo xuống hai bên, mép tỉa thành tép |
| `handlebar` | Hai múi ria với đuôi cong vểnh cuộn lên |
| `walrus` | Ria hải mã rậm, bản rộng rủ thấp, nhiều tép dọc |
| `horseshoe` | Ria móng ngựa, hai nhánh dày thẳng xuống cạnh miệng |

Số đo lấy theo mặt trong ảnh đầu (bán kính ~50, cằm ở `miệng + 22`), không
theo `headH/2`; đầu khác cỡ thì chỉnh `width`, `dx`, `dy`.

`follow`: mép sát môi bám khẩu hình, ria đặt ở `mép trên miệng − 5`. Tắt thì
lấy mép của `closed`.

Ràng buộc ảnh râu nằm ở [02 — Gen mảnh ảnh](02-trang-phuc.md#gen-mảnh-ảnh).

### Nếp nhăn vẽ bằng code

Dấu hiệu tuổi tác. `wrinkle = { kind, color, width, dy }`, vẽ **ngay trên khối
đầu**, dưới mắt / mày / mồm, cùng hệ toạ độ với mắt (`dy` dịch cả cụm; mỗi ảnh
đầu một tỉ lệ trán khác nhau), tỉ lệ theo `scale` đầu như ria mép:

| `wrinkle.kind` | Hình |
|---|---|
| `light` | Một nếp trán + chân chim hai bên |
| `deep` | Hai nếp trán + chân chim dày hơn + túi dưới mắt + pháp lệnh xuống quá mép mồm |

Ràng buộc hình:

- **Chân chim để nằm ngang thì thành ria mèo.** Nan quạt phải xoè xuống
  (`light` `12°`/`38°`, `deep` `−6°`/`18°`/`42°`) và ngắn — dài quá là râu mèo,
  không phải nếp nhăn.
- **Nếp trán thò ra ngoài viền đầu khi quay mặt**: mặt dịch theo `face.turn` và
  lắc, nên nếp trán cắt theo đường bao đầu (`0.97` bán kính) và mọi bề ngang
  nhân thêm đúng hệ số hẹp `shrink(lắc)` mà khoảng mắt dùng.
- Pháp lệnh phải **xoè ra ngoài rồi mới xuống**, không thì thành hai dấu ngoặc
  ôm sát mồm.

Nếp trán nằm **dưới** mảnh `hair` và `crown` — có mái hay có mũ là bị che, đó là
chủ ý. Nhân vật già thì dùng nó cùng tóc râu bạc (`pieces.*.color`), đừng gen
nếp nhăn vào mảnh ảnh: mảnh ảnh không co theo khẩu hình và không đi theo lắc
gật.

### Tóc

Tóc là một [kiểu tóc](02-trang-phuc.md#kiểu-tóc) cắm ở `hair` (`src: "part"`):
lớp `over` trên mặt, lớp `under` sau thân và chân, cùng màu và bộ chỉnh
`pieces.hair`; `pieces.hairBack` khi ấy bị bỏ qua. Mọi góc đặt theo hộp sọ —
khung `VIEW_FRAME` tâm sọ `(160, 160)` bán kính 100, `scale` / `widthScale` phóng
quanh tâm sọ — nên bộ chỉnh mặc định là trung tính. Tóc ảnh thì mái ở `hair`,
mảng rủ sau gáy ở `hairBack` (cao `HAIR_BACK_H` lần `headH`), hộp treo từ đỉnh
đầu. Tóc trôi theo `head.follow` và `head.followBack`.

[Tóc dựng khối](02-trang-phuc.md#tóc-dựng-khối) (`src: "sculpt"`) không có hộp: vỏ
ôm sọ đơn vị quay theo đầu, tóc rủ buông theo trọng lực, phần sau tâm đầu vẽ ở vị trí
`hairBack`.

| Hằng số | Giá trị | Nghĩa |
|---|---:|---|
| `SCULPT_HANG_FROM` | 75 | Kinh độ mặc định của mép trước mảng rủ hai bên, độ; kiểu có `hangFrom` thì dùng số của kiểu |
| `SCULPT_FLARE` | 0.08 | Đuôi tóc rủ xoè ra khỏi trục dọc qua tâm đầu, lần bán kính sọ |
| `SCULPT_DEPTH` | 0.4 | Tóc rủ: vỏ sau gáy phồng, và mặt rủ xoè, uốn, sóng theo chiều trước–sau bằng bấy nhiêu phần chiều ngang |
| `SCULPT_TUCK` | 0.7 | Tóc rủ: tới đuôi, phần mặt rủ trước mặt phẳng qua hai tai co về mặt phẳng ấy bấy nhiêu phần |
| `SCULPT_TEMPLE` | 0.45 | Tóc rủ: vỏ ở chỗ rời sọ co về mặt phẳng qua hai tai bấy nhiêu phần, hết co ở vĩ độ 40° |
| `SCULPT_BANG_TIP` | 22 | Quá `bangTo` bấy nhiêu độ thì bề dày mép mái lệch mỏng hết |

`headPoint(shape, cx, cy, rx, ry, deg)` trả điểm trên đường bao đầu theo hướng
`deg` (`0` = thẳng lên, dương về `+x`, bỏ qua bo góc) — dành cho bộ phận nào
cần neo vào viền đầu.

Mắt và lông mày cũng vẽ bằng code — hai chấm và hai nét cong. Vì thế **mặt
trong ảnh PNG phải để trống hoàn toàn**.

Lông mày là prop của `<Character>` ngang hàng với `mouth`, không nằm trong JSON
nhân vật: nó là biểu cảm, tức chuyển động, không phải hình dáng. Mỗi nét đi từ
đầu **ngoài** tới đầu **trong**; `tilt` nhấc đầu trong lên, `arch` uốn cung.

| Mày | tilt | Đọc ra |
|---|---:|---|
| `neutral` | +2 | Mặc định, gần như ngang |
| `flat` | 0 | Lì, vô cảm |
| `furrowed` | −4 | Đầu trong hơi chúi xuống — cau mày, không vừa ý |
| `angry` | −7 | Đầu trong chúi xuống giữa — tức, gồng |
| `sad` | +7 | Đầu trong vống lên — lo, thương hại |
| `raised` | +2 | Cả hai nhấc cao, cong lên — ngạc nhiên |
| `worried` | +3 / +2 | Đầu trong nhấc nhẹ, hai bên hơi lệch — lo nhẹ, ngập ngừng |
| `skeptical` | +1 / −2 | Bên gần nhướng cong, bên xa hạ thấp — hoài nghi, thắc mắc |

Nghiêng lông mày là kênh biểu cảm chính ở cỡ nhỏ. Mày `worried` phối
`talkSadA/B` cho lời nói lo nhẹ; `skeptical` phối `open` và `talkSadA` cho
thắc mắc. Kiểu bất đối xứng theo bên gần / xa của rig và lật cùng nhân vật.

## Vẽ chi

Mặc định chi là một nét đặc dày `10`; viền mảnh và đầu dày `6`. Căn
`rig.stroke`, `palette.sleeveWidth` và `palette.trouserWidth` theo nét của mảnh
ảnh bằng studio.

Cờ `clad` (mặc định **tắt**) thì chi vẽ hai lượt — viền màu nét dày `w + nét`,
rồi ruột dày `w` — để thành tay áo hoặc ống quần. Mặc định chi là nét trần đen
`#1a1a1a` dày `10`, màu da chỉ hiện ở mặt.

`palette.limbCurve` (`0..1`, mặc định `1`) uốn chi thành nét kiểu rubber hose.
`0` là hai đoạn thẳng gãy ở khuỷu / gối, cho nhân vật muốn nét gãy góc. Đường cong là Catmull-Rom đều qua ba
khớp `[gốc, khớp giữa, ngọn]`, tách ở khớp giữa thành **hai cubic Bézier**
(`limbCurves`, `limbPath` trong `geometry.ts`).

**Chỉ khuỷu và gối được làm tròn.** Điểm hai đầu và tiếp tuyến ở hai đầu y hệt
đoạn thẳng: nét ra khỏi vai theo hướng cánh tay trên, vào cổ tay theo hướng cẳng
tay. Vì thế mảnh vai áo (hộp cứng xoay quanh khớp vai) và đồ cầm tay (treo ở cổ
tay) không phải biết gì tới độ cong. Ở `limbCurve` `1`, chỗ phình lớn nhất so
với nét thẳng là `3,8px` trên tay (`hold`) và `6,1px` trên chân (`sit`, `ride`),
trên nét dày `~26px` — nằm trong dấu chân của nét thẳng, vai áo không phải căn
lại. Độ phình tỉ lệ thẳng với `limbCurve`.

Tay vẽ làm **hai nửa** — cánh tay trên đi cùng vai áo, cẳng tay đổi lớp — nên
`limbPath` nhận cả ba khớp kèm `seg` `0`/`1`; chân là một đường ba khớp liền. Độ
cong áp cho cả bốn chi. Studio có slider **Cong chi** cạnh `Dày tay` / `Dày
chân`; kiểm bằng mắt ở `shrug`, `shock`, `hold`, `think`.

## Góc nhìn

Năm nấc rời rạc cho thân (`view`) và cho đầu (`headView`, bỏ trống là theo
thân): `front` (chính diện thật), `quarter` (chính diện 3/4, **mặc định**), `side`,
`rear` (3/4 sau), `back`. **Không có tham số xoay liên tục** — thân áo và tóc là hình
vẽ riêng cho từng nấc ([02](02-trang-phuc.md#góc-nhìn)), xoay liên tục chỉ bóp méo hình
chính diện. Tóc, kính, râu, thân áo và váy dựng khối chiếu từ khối theo góc của nấc: đầu `front` /
`quarter` / `side` / `rear` / `back` là lắc `0` / góc nghỉ / `90` / `REAR_YAW` / `180`
(cộng `lắc` của hành động ở hai nấc đầu), thân áo và váy dựng khối quay đúng các góc ấy nhưng
**không** cộng `lắc`. Đổi góc gọn trong một frame; hướng trái/phải vẫn là `flip`. Người 3D có
tóc dựng khối thì nét mặt quay liên tục theo `theta`, không theo nấc ([Mặt người 3D](#mặt-người-3d)).

`front` và `quarter` khác nhau ở góc nghỉ: `quarter` đổi `face.turn` ra góc
`asin(turn / nửa rộng đầu)` (`restYaw`), mặt lệch sang `+x` như mọi mảnh chính diện vẽ
tay; `front` coi `face.turn` là `0`, mặt nhìn thẳng ống kính. Mảnh vẽ tay (ảnh, bộ phận
`PARTS`, kiểu tóc, râu, phụ kiện) ở cả hai nấc đều vẽ hình chính diện và đọc cùng bộ chỉnh
`dx` … `rotate` — hình ấy vốn vẽ lệch tâm, nên ở `front` nó vẫn lệch, không có gì báo.

Scene đè `face.turn` cho riêng một người bằng `cast[].turn` (cùng đơn vị px, chỉ có nghĩa
ở `quarter`): `turn: 52` trên đầu nửa rộng `65` là ≈53°, 3/4 xoay gần ngang mà vẫn thấy
chút mặt trước áo — người ngồi nghiêng bên bàn. `castCharacter(member, c)` trả nhân vật đã
đè; `<SceneWorld>`, `anchorAt` và dải ảnh của render đều đi qua nó
([03](03-scene.md#xoay-quarter-trong-một-cảnh)).

Thân `rear` là nấc riêng chỉ khi thân áo dựng khối (`pieces.torso.src: "sculpt"`, theo
nhân vật đã `equip`); thân ảnh hay bộ phận `PARTS` không có hình `rear`, nên
`clampViews(v, solid)` đổi thân `rear` thành `back`. Rồi kẹp tổ hợp không vẽ được: thân
quay lưng (`rear`, `back`) với đầu `front` / `quarter` thành đầu cùng nấc thân — thân `rear`
ra đầu `rear`, thân `back` ra đầu `back` — và đầu `back` hay `rear` trên thân không quay lưng
thành đầu `side`. Chưa biết nhân vật thì `clampViews(v)` giữ thân `rear` (`sceneAt` và
studio kẹp như thế); `figureAnchors` kẹp lần cuối theo thân áo của nhân vật, và mọi chỗ vẽ
đi qua nó. Mười lăm tổ hợp dùng được: ba thân `front` / `quarter` / `side` với ba đầu ấy,
và hai thân `rear` / `back` với đầu `side` / `rear` / `back`. `front` và `quarter` thay
nhau được ở mọi chỗ bảng dưới ghi `quarter`:

| thân | đầu | Đọc ra |
|---|---|---|
| `quarter` | `quarter` | Đứng, mặt hơi lệch sang hướng nhìn — mặc định |
| `front` | `front` | Đứng nhìn thẳng người xem |
| `quarter` | `side` | Liếc sang bên, thân vẫn hướng ra trước |
| `side` | `side` | Đi ngang, nhìn theo hướng đi |
| `side` | `quarter` | Đi ngang mà quay mặt ra ống kính |
| `rear` | `rear` | 3/4 sau: thấy lưng, vai xoay, một mắt nhỏ — người ngồi bàn nhìn từ sau chếch |
| `rear` | `side` | 3/4 sau, ngoái đầu |
| `rear` | `back` | 3/4 sau, đầu quay hẳn vào trong |
| `back` | `side` | Quay lưng, ngoái đầu |
| `back` | `rear` | Quay lưng, còn thấy một mắt và khoé mồm |
| `back` | `back` | Quay lưng hẳn |

Ba dòng thân `rear` cần thân áo dựng khối; thân khác vẽ ra đúng dòng thân `back` cùng đầu.

### Thân `side`

Nghiêng kiểu ăn gian, không phải phối cảnh thật: vai chập về trục giữa còn
`SIDE_SHOULDER`, hông còn `SIDE_HIP` — hông giữ rộng hơn để đứng yên vẫn thấy hai
chân. Thân áo dựng khối thì khác: vai và hông là hai điểm trên vành vai, vành hông của
khối, quay `90` nên chập hẳn về trục giữa, hai chân đứng yên trùng nhau
([02](02-trang-phuc.md#thân-áo-dựng-khối)). Lớp tay dưới đây khớp dấu `z` của gốc chi
ấy: gốc xa quay ra sau khối. **Cả cẳng tay xa khoá dưới thân**, bất kể `layer` của hành động, và mảnh vai
áo xa không vẽ nữa vì nó không còn chỗ lộ ra. Thân áo lấy hình `side` của mảnh ấy;
chưa có hình thì bóp ngang hình chính diện còn `SIDE_TORSO`.

### Thân `rear`

Chỉ có ở thân áo dựng khối; thân khác vẽ như [`back`](#back). Khối thân quay `REAR_YAW`
như đầu `rear` (`torsoYaw`) và nhìn từ hơi cao như mọi nấc (`TORSO_TILT`). Vai và hông là
hai điểm kinh độ `±90` trên vành vai, vành hông của khối đã xoay (`limbSpread`): nửa
khoảng cách bằng nửa rộng · `|cos 120°|`, tức một nửa. Gốc chi nằm đúng độ cao khớp, không
hạ theo `TORSO_TILT`. Quay quá `90` thì gốc quay ra người xem (`z > 0`) nằm phía `+x` — phía
mặt hướng tới — nên **chi gần (`armNear`, `legNear`) sang `+x`**, chi xa sang `−x`
(`Figure.nearSide = +1`). "Gần" luôn là gần ống kính; tên kênh trong JSON giữ nguyên nghĩa
ấy.

Lớp tay chân theo dấu `z` của gốc chi, như thân `side`: **cả cẳng tay xa khoá dưới thân**
bất kể `layer`, vai áo xa không vẽ; chân gần vẽ sau chân xa; cánh tay trên gần nằm trên
thân. Tóc `overHead` đè cánh tay trên gần chỉ ở thân `side`. Mảnh treo trên thân (tay áo,
`neck`, `hem`) chưa có hình `rear` riêng: chúng lấy hình và bộ chỉnh của `back`
(`bodyArtView`); váy dựng khối thì chiếu ở `REAR_YAW` như thân. Người ngồi bàn nhìn từ sau: thân `rear`, đầu `rear`, hành động
[`sit-rear`](#vươn-chi).

### Đầu `side`

Một mắt và một lông mày — **nét của bên gần** (`-1`), nên đầu trong của mắt và mày
hướng về phía mũi ở `+x`, `wink` ra con mắt nháy và mày hai kiểu (`worried`,
`skeptical`) lấy nét gần; lông mày lùi vào vừa đủ để nằm trọn trong viền đầu. Mắt ghim ở `SIDE_EYE` lần nửa trục ngang tính từ
tâm đầu; hình tròn của mắt bóp ngang còn `SIDE_EYE_OVAL` thành oval đứng, các kiểu mắt
vẽ bằng nét thì giữ nguyên. Nét mặt đã ghim nên kênh `lắc` **hết tác dụng**; `gật` vẫn chạy — tóc
dựng khối thì cả cụm nét mặt xoay quanh tâm đầu, xem [Đầu và nét mặt](#đầu-và-nét-mặt). Mồm và
ria giữ nguyên bề ngang, tâm ra sát viền đầu — đo ở đúng độ cao mồm — cách viền một
khoảng `SIDE_MOUTH_INSET`, rồi **cắt theo lòng viền đầu**: chỉ nửa sau của khẩu hình
lộ ra, mồm há thành một khoang mở ở mép mặt. Râu ở `chin` lấy hình `side` trong
`chinViews.ts`: chỉ bên gần, tóc mai lên tới tai, mồm nằm trong khấc ở mép mặt. Râu
không có hình `side` (mảnh PNG) thì vẽ **nửa gần** của hình chính diện, trục giữa
lùi vào trong viền đầu `SIDE_CHIN_INSET`, vết cắt khép bằng một dải màu nét. Râu dựng
khối không cắt nửa: nó chiếu ở lắc 90 và khớp khấc vào mồm ở mép mặt. Bộ phận
`faceAcc` có `drawSide` thì vẽ nó trong chính hộp chính diện — kính còn một mắt
kính ở tâm hộp, càng dài `SIDE_GLASSES_ARM` chạy về tai, cầu kính vẽ dư về trước. Cả
`faceAcc` cắt theo viền đầu để không chìa ra ngoài má; hình `drawSide` cắt ở **lòng**
viền nên cầu kính luôn dừng đúng mép trong của nét viền. [Bóng
khối](#bóng-khối) đi theo độ trôi nét mặt nên tự dày hẳn về phía gáy, không phải
chỉnh gì thêm. Kiểu tóc lấy hình `side`: một khối kín ôm sọ, vẽ trên đầu, dưới mũ;
`overHead` đặt cánh tay trên gần đang thõng xuống dưới khối ấy. Tóc ảnh vẫn vẽ hình
chính diện, `hairBack` ảnh dưới cả người.

### Đầu `rear`

Nét mặt như đầu `side` — một mắt, một lông mày, nét bên gần, `lắc` hết tác dụng —
nhưng mắt ghim sát mép hơn, ở `REAR_EYE`, và mắt cùng lông mày thu nhỏ còn
`REAR_FACE_SIZE` quanh chính chúng. Tâm mồm ở `REAR_MOUTH_INSET` tính từ viền đầu,
cắt theo lòng viền nên chỉ khoé mồm lọt vào. Râu, kính và `faceAcc` đi đúng đường
của đầu `side`. Đầu `rear` đi với [thân `rear`](#thân-rear) (thân áo dựng khối) hay thân
`back`; lớp tay theo luật của thân ấy.

Kiểu tóc lấy hình `rear`: một khối kín phủ gần hết đầu, chừa má và thái dương bên
gần. Tóc ảnh thì rig dựng như ở `back` — hình bao của mái cộng chỏm sọ tới
đường gáy — rồi khoét má: chân tóc ở `REAR_HAIRLINE` lần nửa trục dọc trên tâm đầu,
mép tóc mai ở `REAR_TEMPLE` lần nửa trục ngang, mép khoét có nét viền tới đường gáy;
phía mặt, tóc không chìa quá bao tóc `clipGrow`. `hairBack` ảnh phủ lưng áo, dưới
khối đầu.

### `back`

Không mắt, mày, mồm, ria, nếp nhăn, `faceAcc` và `chin`. Thân áo lấy hình `back`;
chưa có thì chỉ vẽ **hình bao** (`shapes[0]`, tức `outline` của mảnh) — lưng trơn
còn hơn hàng khuy quay ra sau. Cả hai cánh tay trên cùng vai áo nằm dưới thân áo.
Lớp cẳng tay đảo: `front` và `mid` thành `back`, `back` thành `mid` — trên lưng
áo, dưới đầu. Kiểu tóc lấy hình `back`, một khối kín trên đầu. Tóc ảnh thì rig
dựng — hình bao của mái chính diện, cộng một chỏm sọ phủ từ đỉnh xuống đường gáy ở
`BACK_NAPE` lần nửa trục dọc dưới tâm đầu, cộng một nét gáy; `hairBack` ảnh vẽ
**trên** đầu và trên lưng áo thay vì dưới cả người, và có nó thì nét gáy thôi vẽ.

### Hằng số góc nhìn

| Hằng số | Giá trị | Nghĩa |
|---|---:|---|
| `SIDE_SHOULDER` | 0.2 | Nửa rộng vai còn bấy nhiêu ở thân `side`; thân áo dựng khối không dùng |
| `SIDE_HIP` | 0.4 | Nửa rộng hông còn bấy nhiêu ở thân `side`; thân áo dựng khối không dùng |
| `SIDE_TORSO` | 0.78 | Thân áo chưa có hình `side` thì bóp ngang còn bấy nhiêu |
| `TORSO_DEPTH` | 0.78 | Thân áo dựng khối: bề dày trước–sau của khối bằng bấy nhiêu lần bề ngang ở cùng độ cao |
| `TORSO_TILT` | 0.25 | Thân áo dựng khối của người 2D nhìn từ hơi cao: điểm quay ra người xem `z` px thì thấp xuống bấy nhiêu lần `z`. Người 3D chiếu thật ([Người 3D](#người-3d)) |
| `SIDE_EYE` | 0.74 | Mắt cách tâm đầu bấy nhiêu lần nửa trục ngang, về `+x` |
| `SIDE_EYE_OVAL` | 0.7 | Hình tròn của mắt (con ngươi, lòng trắng `wide`, `squint`) bóp ngang còn bấy nhiêu |
| `SIDE_MOUTH_INSET` | 0.08 | Tâm mồm cách viền đầu, tính bằng nửa trục ngang; nửa trước cắt theo viền |
| `SIDE_CHIN_INSET` | 0.08 | Râu `chin` không có hình `side`: trục giữa cách viền đầu, tính bằng nửa trục ngang; nửa xa bị cắt |
| `SIDE_GLASSES_ARM` | 0.61 | Càng kính `side` dài bấy nhiêu lần bề ngang hộp, từ tâm mắt kính tới tai |
| `REAR_EYE` | 0.86 | Đầu `rear`: mắt cách tâm đầu bấy nhiêu lần nửa trục ngang, về `+x` |
| `REAR_YAW` | 120 | Nấc `rear`: góc quay mà tóc, thân áo và váy dựng khối chiếu theo; `side` là 90, `back` là 180 |
| `REAR_FACE_SIZE` | 0.8 | Đầu `rear`: mắt và lông mày thu nhỏ còn bấy nhiêu |
| `REAR_MOUTH_INSET` | -0.02 | Đầu `rear`: tâm mồm cách viền đầu, tính bằng nửa trục ngang; âm là ra ngoài viền |
| `REAR_HAIRLINE` | 0.52 | Đầu `rear` dựng tóc ảnh từ chỏm: chân tóc trên tâm đầu bấy nhiêu lần nửa trục dọc |
| `REAR_TEMPLE` | 0.5 | Đầu `rear` dựng tóc ảnh từ chỏm: mép tóc mai cách tâm đầu bấy nhiêu lần nửa trục ngang |
| `FACE_TRUE` | 40 | [Mặt người 3D](#mặt-người-3d): nét mặt chiếu thật tới góc quay này, quá nữa thì chạy chậm hơn đầu |
| `FACE_REAL_FROM` | 95 | Mặt người 3D: từ góc quay này nét mặt trượt dần về chỗ chiếu thật |
| `FACE_REAL_SPAN` | 25 | Mặt người 3D: đoạn trượt về chiếu thật dài bấy nhiêu độ |
| `FACE_EYE_MIN` | 0.15 | Mặt người 3D: mắt lộ dưới phần này bề ngang mắt chính diện thì tắt cả mắt lẫn mày bên ấy |
| `BACK_NAPE` | 0.62 | Đường gáy của tóc ảnh dựng từ chỏm, dưới tâm đầu bấy nhiêu lần nửa trục dọc |

### Mốc ở góc nhìn khác

Vẫn một bảng duy nhất: `figureAnchors(c, pose, views, mouth)`. `anchorAt` và `placeAnchor`
(qua `Spot.views`) trả mốc của đúng góc đang vẽ; ở đầu `side` và `rear` thì `eyeNear` và
`eyeFar` trùng nhau, còn `mouth` là tâm mồm ở sát viền đầu.

### Bộ chỉnh theo góc

Hình `side` / `rear` / `back` là **một hình vẽ khác**, không phải hình chính diện xoay đi,
nên `dx`, `dy`, `scale`, `widthScale`, `rotate` của mảnh **không áp cho nó**. Mỗi
góc có bộ chỉnh riêng ở `pieces.<socket>.views.side` / `.views.rear` / `.views.back` (và cùng chỗ
ấy trong `items`), năm trường cùng tên, thiếu là trung tính `0, 0, 1, 1, 0`:

```json
"hair": { "src": "part", "part": "hair-long-blunt", "dy": 4,
          "views": { "side": { "dx": -3, "scale": 1.06 } } }
```

Tay áo dùng hộp treo vai, xoay quanh vai và kéo theo `stretch` cánh tay trên; tay xa
đồng bộ bộ chỉnh của tay gần khi bật `sleeveFit.syncFar`. Tà/váy phóng quanh hông,
đồ đeo cổ quanh chân cổ. Mảnh treo trên thân (tay áo, `neck`, `hem`) ở thân `rear` đọc
hình và bộ chỉnh của `back`, nên `views.rear` của chúng không ai đọc. Váy dựng khối không
có bộ chỉnh nào.

Trung tính là hình nằm đúng chỗ nó vẽ trong `VIEW_FRAME`, đặt theo xương; bộ chỉnh
đo từ đó, **không** đo từ `preset` của mảnh chính diện. `scale` phóng quanh tâm
đầu (thân áo: quanh khớp cổ). `dx` ở `side` là trước–sau, `+x` về phía mặt. Hình
theo góc bám sọ: `head.follow` / `followBack` chỉ đẩy ngang hình chính diện, độ
trôi dọc theo `gật` thì góc nào cũng nhận.

`tuneOf(pieces, k, view)` trả bộ chỉnh đang có hiệu lực, `viewTuned` cho biết
socket ấy ở góc ấy có đọc `views` không. Đọc `views` khi và chỉ khi socket **vẽ
hình riêng của góc ấy**: các socket có `ViewArt` và kính ở `faceAcc` có `drawSide` — cái sau vẽ trong hộp `preset` của bộ phận,
bộ chỉnh `side` cộng / nhân lên `preset`. Mảnh lùi về hình chính diện (PNG, bộ
phận chưa khai trong `*_OF`, thân áo bóp `SIDE_TORSO`, râu cắt nửa) vẫn đọc bộ
chỉnh chính diện, vì thứ vẽ ra vẫn là hình chính diện. Studio ghi qua
`wornTune(c, equip, k, views, true)` — thanh trượt, kéo trên sân khấu và nút đặt
lại đều sửa bộ chỉnh của góc đang xem.

Thứ tự lớp không đổi theo góc nhìn trừ các chỗ nói trên — cẳng tay, cánh tay trên gần ở `back` và dưới tóc `overHead`, và `hairBack` ảnh.
Bảng lớp đầy đủ ở [02 — Thứ tự lớp](02-trang-phuc.md#thứ-tự-lớp).

Các đường xem và render nằm ở [04 — MCP server](04-mcp.md) và
[07 — Làm một tập](07-lam-tap.md#bốn-tầng-xem-chia-theo-ai-đang-nhìn).

## Người 3D

Người khai `cast[].world` trong cảnh có `scene.lens` ([03](03-scene.md#người-3d)) có **khớp 3D**:
`figure3d(c, pose, world)` dựng hông, gối, bàn chân, vai, khuỷu, cổ tay, cổ, đầu trong thế giới,
gốc là tâm hông, hệ thân là hướng mặt `F`, trục đứng và bên phải `R` của người. `figureAnchors`
nhận thêm `world`: chiếu các khớp ấy qua `Lens` rồi quy về một tư thế 2D vẽ ra đúng chúng
(`flatPose`: góc mỗi đoạn theo hướng đã chiếu, `stretch` theo độ dài đã chiếu — đoạn chĩa về ống
kính co lại thật), nên mảnh vai áo, đồ cầm tay và mọi mốc `anchorAt` bám đúng nét. `fig3` của bảng
mang khớp thế giới và khối từng phần người (`solids`) cho chỗ xếp lớp với đồ khối. `feet3(pose,
world, height, hipHalf)` trả riêng hai bàn chân thế giới — cùng hình học chân của `figure3d` —,
trôi ngang của người đi theo `path` tích phân trên nó ([03](03-scene.md#đi-theo-path)).

- **Kênh nâng và kênh giữ 2D.** Kênh tay chân mà hành động `authoredAt: "side"` ghi mang cờ
  `pose.lift`: góc đọc như soạn ở `side` — tiến theo hướng mặt, lên theo trục đứng, cùng phía
  với gốc chi. Chi gần là chi phải khi mặt hướng sang phải khung (không lật), chi trái khi lật.
  Kênh không có cờ vẽ đúng như rig 2D (góc trên mặt khung, từ gốc chi đã chiếu); khối của nó cho
  việc xếp lớp nằm trên mặt phẳng song song khung qua gốc chi. Hành động cũ không khai gì: người 2D
  và kênh 2D của người 3D ra đúng hình cũ. `torso` của người 3D luôn là góc cúi trong mặt phẳng
  dọc của thân.
- **Thân áo, váy dựng khối chiếu thật.** `fig3.torsoLens` là ống kính đặt trong hệ thân (x ngang,
  y dọc trục thân xuống, z hướng mặt; gốc ở hông, đơn vị rig), đã tính góc cúi `torso`, soi gương khi
  người lật và xoay theo khung thân (trục hông → cổ đã chiếu). `torsoPaths` / `skirtPaths` nhận nó
  thì chiếu từng điểm của khối qua phối cảnh thật thay cho phép xiên `TORSO_TILT`: mỗi tiết diện nhìn
  theo đúng tia tới nó, nên ống kính cúi thì thân co dọc, thấy mặt vai và vành gấu, ống kính gần thì
  vai rộng ra theo phối cảnh. Không lấy một góc cúi chung cho cả thân: người ngồi gần ống kính có
  tia tới hông và tia tới cổ chênh nhau tới ~15°. Mảnh vẽ theo nấc lấy nấc gần nhất (`viewOfTheta`:
  `quarter` dưới 50°, `side` dưới 105°, `rear` dưới 150°, còn lại `back`); thân ảnh không quay, hộp
  `torso` và `neck` chỉ co dọc theo trục thân đã chiếu.
- **Cổ và đầu ở chỗ chiếu thật.** Mốc `collar` là cổ thật đã chiếu, tâm đầu là tâm đầu thật đã chiếu
  (ống kính cúi thì đầu hạ xuống vai). Khối sọ nhận góc ống kính nhìn xuống đầu bằng trục riêng
  `look` của `HeadTurn` — quay quanh trục ngang của ảnh sau cái lắc, không cộng vào `gật`: nhìn nghiêng
  thì gật là xoay trong mặt phẳng khung còn ống kính cúi là lộ đỉnh đầu. Sọ chỉ nhận `HEAD_LOOK`
  (`0,5`) phần góc ấy, đo trong hệ thân: nhận đủ thì ở ống kính cao mặt dồn xuống cằm như đang cúi
  gằm. `look` đi vào tóc, kính, râu dựng khối và nét mặt của tóc dựng khối; đầu tóc ảnh vẽ như 2D.
- **Gốc chi trên khung là khớp thật đã chiếu.** Gốc chân là gốc hông thật (hông `± R · hipHalf`) đã
  chiếu: trục hông dốc theo góc cúi và phối cảnh, nên hai chân tách ra hai bên đáy thân, không chụm
  về giữa. Gốc vai là vai thật (`± R ·` nửa rộng vai, ở thân áo dựng khối là tâm nét viền vai) đã
  chiếu, nằm trên vành vai của thân áo chiếu thật. Ở mọi góc cúi tới 60° hai gốc vai và hai gốc chân
  nằm trong viền thân áo dựng khối. Gốc sát mặt phẳng ống kính (độ sâu không quá nửa độ sâu tâm)
  chiếu ra vô cực, nên lấy nửa trục nằm ngang `∓ nửa rộng · cos theta`.
- **Không có góc chính diện tuyệt đối.** `theta` không bao giờ dưới `FRONT_MIN` (20°): khai hướng
  gần hơn thì `facing` đẩy thân ra đúng ngưỡng, về phía đang lệch (thẳng 0° thì sang phải khung).
  Dưới ngưỡng ấy đùi người ngồi chĩa thẳng vào ống kính, chiếu ra chỉ còn hai cái gối nhú; rig
  không ăn gian gì cho chi chĩa vào ống kính. Quay lưng thẳng (`theta` 180) không khoá: đùi chĩa
  ra xa nằm sau thân. `facing` trả cả `raw` (góc trước khoá); `sceneFacingProblems` dùng nó để
  `check` kêu khi khoá đang đẩy ([03](03-scene.md#check-cho-người-3d)).
- **Ngồi đúng.** Người ngồi có hông cao hơn mặt ngồi đúng nửa bề dày đùi (`limbHalf(c).leg`): mông
  và mặt dưới đùi nằm trên mặt ngồi, không xuyên ghế. Khối thân đáy nằm ngang ở mặt ngồi dù thân
  cúi, chỉ vành vai nghiêng theo.
- **Đầu chi vẽ đúng chỗ thật.** Chuỗi chi đã nâng (và tay có đích) vẽ từ gốc vẽ tới đúng chỗ chiếu
  thật của bàn chân, cổ tay. Gốc vẽ trùng gốc thật nên cả chuỗi là hình chiếu thật; gốc dự phòng sát
  mặt phẳng ống kính thì khớp giữa theo phép đồng dạng đưa gốc chiếu thật về gốc vẽ. Bàn chân đứng
  trên sàn, cổ tay nằm trên mặt bàn dù ống kính cúi cao.

### Mặt người 3D

Người 3D có tóc dựng khối (`hair.src: "sculpt"`) quay đầu liên tục: khối sọ, tóc, kính và râu dựng
khối quay đúng `theta` cộng `lắc`, nét mặt chạy theo một đường cong ăn gian để luôn đọc ra mặt.
`views.head` vẫn là nấc gần nhất (`viewOfTheta`) cho mảnh vẽ theo nấc; nét mặt không đọc nó mà đọc
`A.face.free`.

| `theta` | Nét mặt |
|---|---|
| tới `FACE_TRUE` (40°) | Chiếu thật trên sọ, hai mắt |
| 40°–95° | Chạy chậm hơn đầu (`faceYaw`): mắt gần tới đúng chỗ ghim của đầu `side` ở 90°, giữ oval `SIDE_EYE_OVAL`; mồm ra sát mép, cắt theo viền |
| `FACE_REAL_FROM` (95°) → +`FACE_REAL_SPAN` (120°) | Trượt dần về chỗ chiếu thật, tức là trôi ra mép đầu |
| trên 120° | Chiếu thật; nét đã quá mép thì khuất hẳn |

- **Mắt xa mỏng theo góc thật của đầu**, không theo đường cong: nó co và bị viền che dần như trên
  sọ thật.
- **Mắt tắt theo phần còn lộ.** Bề ngang mắt còn lộ trong lòng viền đầu, đo bằng phần của mắt chính
  diện mở thường, dưới `FACE_EYE_MIN` (15%) thì tắt cả mắt lẫn mày bên ấy: mắt xa tắt quanh 70°, mắt
  gần quanh 108°. Mồm không tắt, nó trôi ra ngoài viền và bị cắt.
- **Nét đã quay quá mép trôi tiếp ra ngoài viền** (`facePoint`) thay vì vòng ra sau, nên mắt và mồm
  đi một chiều suốt vòng quay, không giật ngược.
- **Kính và râu dựng khối** đặt phần trước theo góc của nét mặt (`free.yaw`), hai bên chuyển dần về
  góc sọ, và khớp vào mắt, mồm trên sọ chứ không vào chỗ đã trôi quá mép: quay lưng thì chúng vòng ra
  sau đầu như khối thật. Kính ảnh và `faceAcc` khác cắt theo viền đầu.

Đầu tóc ảnh hay kiểu tóc phẳng của người 3D vẫn theo nấc như người 2D.

### Đích bàn tay

Tay của người 3D đặt được bằng **đích cổ tay** thay cho góc: rig giải IK hai đoạn (`solveTwoBone`)
từ vai thật, cánh tay `upperArm` và cẳng tay `foreArm` của nhân vật nhân `stretch`, khuỷu nằm trong
mặt phẳng qua trục vai → đích và **hướng khuỷu**, về phía hướng ấy. Đích xa quá tầm thì tay duỗi
thẳng về phía nó, không kéo dài. Hai nguồn đích, nguồn sau đè nguồn trước:

- **Hành động** — `keys[].reach.armNear` / `armFar`, hệ thân: gốc tâm hông, `at` `[tiến, y, ra
  ngoài]` đơn vị rig ở `height = 1` (rig nhân `height`), `y` xuống là dương, **`ra ngoài` dương về
  phía chính tay ấy** — một bộ số cho hai tay đối xứng, đổi tay gần ↔ xa khi lật không đổi nghĩa.
  Hệ thân không nghiêng theo `torso`: cúi thân không dời tay khỏi bàn. `elbow` cùng hệ, bỏ trống là
  `REACH_ELBOW` `[-0,4, 1, 0,5]` (xuống, lùi, ra ngoài).
- **Scene** — `cast[].world.hands`, toạ độ thế giới, theo tay phải / trái
  ([03](03-scene.md#đích-bàn-tay-thế-giới)).

`reachToWorld(world, kênh, at, height)` đổi đích hệ thân của một tay ra điểm thế giới — cùng công
thức IK đọc —, `worldToReach` là chiều ngược; studio kéo đích trên sân khấu bằng cặp này.

Đích nội suy theo kênh như góc: mốc nhắc kênh tay mà không có đích là phần đích `0`. **Hoà trên vị
trí, không trên góc**: rig lấy cổ tay của chuỗi góc, kéo về đích theo phần `w` (và hướng khuỷu theo
cùng phần), rồi giải IK tới điểm ấy — cổ tay đi đường thẳng, hai đoạn giữ nguyên độ dài suốt đoạn
hoà, `w` `0` ra đúng chuỗi góc. Hoà trên góc thì cổ tay đi vòng, chạm mặt bàn giữa đường.

Người 2D không đọc đích. Mốc có đích mà không ghi góc kênh ấy thì kênh nhận **góc dự phòng**
(`reachAngles`): IK trong mặt phẳng dọc với số đo mặc định, bỏ thành phần ngang, đo trong khung thân
của `torso` tại pha của mốc ấy (mốc không ghi `torso` thì lấy mẫu từ các mốc khác) — studio và dải ảnh 2D vẫn thấy tay về phía đích.

### Bộ hành động 3D

Bộ chung soạn ở `side` (`authoredAt: "side"`) cho người 3D:

| File | |
|---|---|
| `stand-3d` | Đứng thở: tay buông dọc thân, thân nhích theo nhịp thở |
| `walk` | Chu kỳ đi, `walkCycle` đọc ở `side` |
| `sit-3d` | Ngồi: đùi ngang, ống chân thõng, tay buông; ghép với người ngồi (`world.sit`) |
| `arms-on-table-3d` | Đặt tay lên bàn: đích cổ tay hệ thân `[100, −56, 22]`, thân cúi `5`. Bàn khác cao thì scene đặt `world.hands` |
| `type-3d` | Gõ phím, chồng lên `sit-3d`: cổ tay trên bàn phím `[95, −60…−65, ~12]`, hai tay so le, thân cúi `8` |
| `bow-3d` | お辞儀: thân cúi `38°` trong mặt phẳng dọc, tay dọc thân, giữ rồi đứng lên; một lượt `2,6 s`, lặp được |

Studio soạn hành động `authoredAt: "side"` trên người 3D quay được, kéo đích cổ tay ngay trên sân
khấu.

Đích hệ thân giả định bàn cao hơn hông ngồi ~`51` (mặt ngồi `87,5` cao bằng gối); dàn cảnh khác
cao thì đặt bàn phím, mặt bàn theo đích, hay đặt `world.hands`. Hai hành động tay trên bàn khai
`elbow` `[-0,3, 0,3, 1]` (khuỷu ra ngoài nhiều hơn xuống): với hướng mặc định, đích gần vai kéo
khuỷu xuống dưới mặt bàn và cẳng tay lẹm mép. Test giữ khuỷu, cổ tay trên mặt bàn chuẩn suốt chu kỳ.
