# 01 — Rig nhân vật

Người que 3D: khung xương, đầu và nét mặt dựng bằng code; tóc, mũ, kính và trang phục là
đồ dựng khối cắm vào socket; đồ cầm tay là món của `held/`.

## Hệ toạ độ và tỉ lệ

Gốc toạ độ đặt ở **chậu hông** (pelvis). Trục y hướng xuống, theo quy ước SVG.

| Kích thước | px | Ghi chú |
|---|---:|---|
| Tổng chiều cao | 428 | Đỉnh đầu tới gót, ≈ 1,71 m |
| Một mét | 250 | `RIG_PER_METRE`: quy đổi đơn vị rig ra mét, chung cho mọi repo |
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
| Độ dày nét | 6 | `rig.stroke`: viền chi khi bật `clad` (`cladArm`, `cladThigh`) |
| Độ dày chi | 10 | Mặc định đen, nét trần (`clad` tắt); bật `clad` thì tay `15`, chân `17` (`LIMB_WIDTH`), người 3D xem [Người 3D mặc đồ](#người-3d-mặc-đồ) |

**`Chiều cao` nhân vào các đoạn dọc, không nhân vào bề ngang.** Sáu đoạn `cổ`,
`thân`, `cánh tay trên`, `cẳng tay`, `đùi`, `cẳng chân` nhân với `rig.height`
(mặc định `1`); `nửa rộng vai`, `nửa rộng hông`, các độ dày nét và **đầu** thì
không. Đầu chỉnh riêng bằng `head.scaleX` / `scaleY` — kéo `Chiều cao` xuống là ra
người lùn đầu to, đúng kiểu hoạt hình, muốn khác thì bóp đầu lại. Bảng trên là
số ở `height = 1`; mọi mốc `y` trong trang này cũng vậy.

Bộ xương có hai vai và hai hông; thân là [thân áo dựng khối](12-trang-phuc-3d.md#thân-áo-dựng-khối)
dựng quanh chúng. `rig.shoulderHalf`, `rig.shoulderDrop` và `rig.hipHalf` đặt trực tiếp
bốn khớp gốc. Giá trị `0` đưa vai hoặc hông về trục giữa. Gốc vai của người 3D nằm trên
tâm nét viền thân áo (`roots3`, `garmentShoulder`), không ở `shoulderHalf`
([12](12-trang-phuc-3d.md#thân-áo-dựng-khối)).

Mốc quan trọng, tính từ gốc:

```
đỉnh đầu   y = -258
cổ         y = -128
vai        y = -100   x = ±40   ← −120 + shoulderDrop
hông       y =    0   x = ±22
gót        y = +170
```

## Quy ước góc

Góc tính bằng độ, trong hệ toạ độ **cục bộ của nhân vật**.

- `0°` = đoạn chỉ **thẳng xuống**
- Dương = xoay về phía `+x` (phía trước, khi chưa lật)
- Khớp con (khuỷu, gối) đo **tương đối** so với khớp cha
- Chân là hai số `[hông, gối]`; **tay là ba số `[vai, khuỷu, cổ tay]`**
- Chân có thể thêm số thứ ba, tay số thứ tư: **góc dang** sang ngang, chỉ người 3D đọc —
  [Dang và nghiêng ngang](#dang-và-nghiêng-ngang); tay thêm số thứ năm: **xoắn vai**, cũng chỉ người
  3D đọc — [Xoắn tay](#xoắn-tay)

**Cổ tay lệch bàn tay.** Người 3D đọc số thứ ba của tay là lệch bàn tay trong mặt phẳng khuỷu,
đồ cầm quay theo ([Xoắn tay](#xoắn-tay)). Chân không có số cổ chân.

**`torso` và `head[nghiêng]` đi theo chiều `rotate()` của SVG, ngược với mọi góc
khác.** **Tay** nằm *trong* khung xoay theo `torso`, nên góc của một đoạn tay so với
phương thẳng đứng là `vai + khuỷu − torso`. Gằn người tới trước `30°` mà quên trừ
là cả cánh tay lệch `30°` so với chỗ định đặt.

**Chân thì không.** Hai chân treo ở hông tại gốc toạ độ, *ngoài* khung xoay thân
(`feet`, `computeFigure` trong `geometry.ts`), nên góc của một đoạn chân đúng bằng
`hông + gối`, không trừ `torso`. Trừ đi là ra người đứng khom mà chân duỗi thẳng chứ không quỳ: tư thế
quỳ cần gối gập hẳn (`−72`/`−82`) bất kể `torso` bao nhiêu. Nó phải như vậy —
`F.lowest` suy chỗ chạm đất từ hai bàn chân, gằn người tới trước mà chân đi theo
thì nhân vật lún xuống đất.

Người quay mặt sang trái khung (`flip`) giữ nguyên mọi góc. Nhờ vậy một thư viện tư thế dùng
được cho cả hai hướng.

Hướng vector của một đoạn dài `L` ở góc `θ`:

```
(x, y) → (x + L·sin θ, y + L·cos θ)
```

**Quy ước này ngược dấu với `rotate()` của SVG/CSS.** `rotate(φ)` đưa trục `+y`
về `(−sin φ, cos φ)`, nên hình vẽ đè nằm dọc đoạn ở góc `θ` phải dùng
**`rotate(−θ)`** — `deg` của `anchorAt` đã là độ SVG. Kiểm dấu bằng pose góc lớn như `shrug`.

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
file hành động ghi ra đi qua nó. Mốc bốn số và mốc tám số trong cùng một hành động nội
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

Bảng sải chân (`bakeTravel`) và chỗ chạm đất `F.lowest` đo đúng độ dài từng đoạn.

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
{ "pose": { "armNear": [-157, -73, 0], "stretch": [1, 1.65, 1, 1] } }
```

Vai âm quét cánh tay lên phía ngoài đầu, khuỷu cùng dấu âm cuộn cẳng tay về đỉnh
đầu: khuỷu ra ngoài khối đầu ở khoảng `(−80, −194)`, bàn tay ở `(−7, −256)`.

## Các bộ phận

Đầu dựng bằng code: khối sọ dáng `head.form` (`sphere` hay `human` — [Người 3D mặc
đồ](#người-3d-mặc-đồ)), nét mặt vẽ lên canvas dán trên sọ nên quay, gật, nhép cùng đầu. Tóc,
mũ, kính là đồ dựng khối cắm vào socket trên đầu ([tóc](12-trang-phuc-3d.md#tóc-dựng-khối),
[mũ](12-trang-phuc-3d.md#mũ-dựng-khối)); nếp nhăn vẽ cùng nét mặt vì nó bám tâm mặt.
`scaleX`/`scaleY` nhân lên `headH/2`, không có `scale` chung — muốn to đều thì kéo cả hai.

| Bộ phận | Cấu tạo | Điều khiển bằng |
|---|---|---|
| `head` | Khối sọ dựng code | `head.form, scaleX, scaleY` |
| `hair` | [Tóc dựng khối](12-trang-phuc-3d.md#tóc-dựng-khối) | `pieces.hair.sculpt` |
| `face` | Mắt, lông mày, miệng trên canvas nét mặt | kênh `face` + `keys[].face` của hành động |
| `wrinkle` | Dưới nét mặt: nếp trán, chân chim, túi mắt, pháp lệnh | `face.wrinkle.*` (hằng số của nhân vật) |
| `torso` | [Thân áo dựng khối](12-trang-phuc-3d.md#thân-áo-dựng-khối) quanh đoạn hông → cổ | `pieces.torso.garment`, góc `torso` |
| `arm.near/far` | Hai đoạn: cánh tay trên + cẳng tay | `shoulder°, elbow°`, `stretch` |
| `leg.near/far` | Hai đoạn: đùi + cẳng chân | `hip°, knee°`, `stretch` |

**near / far** thay cho trái / phải: `near` là chi gần ống kính — chi phải khi mặt hướng sang
phải khung (không lật), chi trái khi lật ([Người 3D](#người-3d)). Trái/phải trên màn hình là
`flip`, không phải đổi tên chi; hành động giữ tay phải / trái giải phẫu thì khai
`sides: "anatomical"`.

## Socket

Điểm cắm đồ. Một nhân vật phụ = base + bảng màu + vài socket dựng khối.

**Bảng này là *điểm neo*, không phải danh sách khoá cắm được.** Khoá thật nằm ở
`PIECE_KEYS` của rig (`describe_rig` trả sẵn); dòng nào ghi *chưa dựng* là spec
chưa có khoá, cắm vào là zod báo lỗi. Dựng một socket mới chỉ vì một cảnh cần nó
thì đọc mục [bước 1 không được sửa rig](07-lam-tap.md#bước-1-không-được-quyền-sửa-rig)
trước.

Socket nhận `src: "none"` (trống) hay `"sculpt"` (dựng khối, số đo ở trường riêng của socket);
người 3D dựng bảy socket `BUILT_SOCKETS` (`torso`, `hem`, `hair`, `crown`, `headAcc`, `faceAcc`, `neck`).

| Socket | Vị trí | Cắm được gì |
|---|---|---|
| `crown` | Đỉnh đầu | [Mũ dựng khối](12-trang-phuc-3d.md#mũ-dựng-khối) (`hat`) |
| `hair` | Sọ | [Tóc dựng khối](12-trang-phuc-3d.md#tóc-dựng-khối) (`sculpt`) |
| `headAcc` | Sọ | [Trâm cài búi](12-trang-phuc-3d.md#trâm-cài-búi) (`pin`) và [bông tai](12-trang-phuc-3d.md#bông-tai) (`earrings`), bám sọ |
| `faceAcc` | Ngang mắt | [Kính dựng khối](12-trang-phuc-3d.md#kính-dựng-khối) (`glasses`) |
| `neck` | Khớp cổ | [Khăn vắt vai và kính gài nẹp](12-trang-phuc-3d.md#khăn-vắt-vai-và-kính-gài-nẹp) (`drape`, `shades`), [dây chuyền](12-trang-phuc-3d.md#dây-chuyền) (`necklace`) |
| `torso` | Thân | [Thân áo dựng khối](12-trang-phuc-3d.md#thân-áo-dựng-khối) (`garment`) |
| `hem` | Hông | [Váy dựng khối](12-trang-phuc-3d.md#váy-dựng-khối) (`skirt`) |
| `handNear/handFar` | Bàn tay gần, xa | Chỉ `src: "none"`: khoá có trong `PIECE_KEYS` để `equip` gọi tên, không dựng gì. Đồ cầm tay là [món cầm tay](#món-cầm-tay) hay vật three gắn bằng `dress` |
| `back` | Giữa lưng | Đồ vác vai — **chưa dựng**, không có trong `PIECE_KEYS` |

### Đồ thay được: `items` và `equip`

`pieces` là đồ nền của nhân vật. `items` là danh mục vật có thể trang bị;
scene và hành động gọi chúng theo tên:

```json
"pieces": { "torso": { "src": "sculpt", "garment": { "style": "polo" } }, "hair": { … } },
"items": {
  "yukata": { "torso":   { "src": "sculpt", "garment": { "style": "wrap" },
                           "palette": { "sleeveFlare": 6 } } },
  "kinh":   { "faceAcc": { "src": "sculpt", "glasses": { "shape": "round" } },
              "neck":    { "src": "sculpt", "shades": {} } },
  "mu":     { "crown":   { "src": "sculpt", "hat": { "shape": "peaked" } } }
},
"outfits": { "le-hoi": { "torso": "yukata", "crown": "mu" } }
```

Một vật khai **nhiều socket là để nó đổi chỗ** — cái kính đeo trên mặt rồi gài lên nẹp áo
vẫn là một vật, mỗi lúc chỉ một socket giữ nó. Số đo của từng socket là hằng số của nhân vật,
không phải của cảnh.

`equip` chọn vật cho socket, và nó là **công tắc**: socket không nhắc tới thì
giữ nguyên thứ đang có.

| Giá trị | Nghĩa |
|---|---|
| `"kinh"` | vật ấy chiếm socket, đè cả đồ nền — **thay áo** cũng chỉ là `{ "torso": "yukata" }` |
| `null` | socket trống — cởi kính, bỏ mũ |
| `"base"` | về lại đồ nền trong `pieces` |
| không có khoá | giữ nguyên thứ đang mặc |

Giá trị của chính `equip` cũng nhận **tên một bộ đồ** trong `outfits`, hoặc một
mảng nhiều bước (`["linh-gac", { "faceAcc": "kinh" }]`). `outfits` chỉ là cách
viết gọn: mặc một bộ là đặt luôn từng socket của bộ ấy, không có khái niệm nào
mới. Tên vật lạ hoặc vật không khai socket ấy thì **giữ đồ nền** — giữa phim
không cởi đồ người ta ra vì một lỗi chính tả; `stickman check` và MCP là chỗ báo.

Ba chỗ ghi `equip`, đọc theo thứ tự: `cast[].equip` lúc mở màn (xem
[03 — Đổi đồ](03-scene.md#đổi-đồ)), rồi `keys[].equip` của từng hành động (xem
[Đổi đồ giữa chừng](#đổi-đồ-giữa-chừng)). Hành động **không biết ai diễn**, nên
tên vật trong nó là một giao kèo: mọi nhân vật đóng vai ấy phải có vật cùng tên.

**Người 3D mặc đồ bằng `wardrobe`.** Người three dựng hình từ `pieces` một lần, nên đổi đồ là dựng người khác:
`wardrobe(nhânVật, make)` giữ một bản cho mỗi bộ mảnh ở các socket người 3D dựng hình (`BUILT_SOCKETS`: `torso`,
`hem`, `hair`, `crown`, `headAcc`, `faceAcc`, `neck`) và mỗi dáng đứng / ngồi; `get(sceneAt(...).equip, ngồi)` mặc
`equip` vào JSON (`equipCharacter`), trả bản đúng bộ và báo `fresh` khi vừa dựng để chỗ gọi thêm vào cảnh. Cảnh three
`buildWorld` ([03](03-scene.md#cảnh-3d)) dựng bản mở màn trước, bản khác lần đầu cần tới, mỗi khung chỉ hiện một bản: `cast[].equip` (yukata đứng hay
ngồi, có hay không lọn tóc) và `keys[].equip` giữa cảnh (thay áo, tháo kính gài nẹp) đều đổi được ở 3D. Bản mới dựng
diễn tiếp từ cùng `sceneAt`, không mang trạng thái của bản cũ. Đổi vật ở `handNear` / `handFar` không dựng lại người:
đồ cầm của người 3D là vật three gắn bằng `dress` (`items` hàm dựng), không phải mảnh. Thân áo 3D lấy màu `pieces.torso.color` (bỏ trống là
`palette.garment`) nên vật thay áo đổi được màu thân. Tay áo, quần, giày (`sleeve`, `sleeveLength`, `sleeveFlare`, `trouser`,
`trouserLength`, `shoe`) là `palette`, trừ khi thân áo đang mặc khai `pieces.torso.palette` (hay vật thay `torso` khai
`palette`): các trường ấy đè `palette` khi áo ấy đang mặc (`wornPalette`) — polo tay ngắn thay sang yukata tay dài loe,
ống chân cùng màu vải. Bề dày tay chân (`sleeveWidth`, `trouserWidth`) không đổi theo vật.

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
| `sit` | 26 | 38 | 30 | 42 | 2 | Ngồi ghế, tay đặt trên đùi; chân `[88, −92]` / `[92, −88]` |

`POSES` chỉ chứa góc tay chân và thân; `head` và cổ tay mặc định bằng `0`.

Ràng buộc hình học:

- Chống cằm cần khuỷu lớn hơn `130°`.
- Ở `stretch = 1` tay với tới vùng từ thái dương tới quai hàm; đỉnh đầu cần
  `stretch ≥ 1.36` — xem [Vươn chi](#vươn-chi).
- Tay đưa lên đầu dùng góc vai âm. Gãi đầu dùng `[−132, −96]` rồi
  `[−110, −120]`.
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
{ "schemaVersion": 20, "name": "wave-3d", "duration": 0.5, "end": "wrap",
  "mask": ["armNear", "hand"], "authoredAt": "side",
  "keys": [
    { "t": 0, "pose": {}, "reach": { "armNear": { "at": [22, -185, 100], "elbow": [0, 1, 0.6] } },
      "ease": "smooth", "hand": { "armNear": { "pose": "open", "palm": "forward", "fingers": "up" } } },
    { "t": 0.5, "pose": {}, "reach": { "armNear": { "at": [22, -178, 120], "elbow": [0, 1, 0.6] } },
      "ease": "smooth", "hand": { "armNear": { "pose": "open", "palm": "forward", "fingers": "up" } } },
    { "t": 1, "pose": {}, "reach": { "armNear": { "at": [22, -185, 100], "elbow": [0, 1, 0.6] } },
      "ease": "smooth", "hand": { "armNear": { "pose": "open", "palm": "forward", "fingers": "up" } } }
  ] }
```

| Trường | Nghĩa |
|---|---|
| `duration` | Giây cho một lượt `t: 0 → 1`. **Chỉ là nhịp mặc định** — scene được đè, và scene mới là chỗ quyết định lặp mấy lần |
| `end` | Lấy mẫu qua mốc cuối: `wrap` nội suy vòng về mốc đầu, `hold` giữ nguyên mốc cuối. Đây là ngữ nghĩa **lấy mẫu**, không phải chuyện phát lại — sampler bắt buộc phải biết |
| `mask` | Kênh mà hành động này ghi: bảy khớp `armFar / armNear / legFar / legNear / torso / head / stretch`, `face` (nét mặt, không có góc) và `hand` (bàn tay người 3D) — [Bàn tay](#bàn-tay). Bỏ trống thì suy ra từ các mốc |
| `keys[].t` | **Tỉ lệ chu kỳ, không phải giây.** Tăng dần trong `[0, 1]` |
| `keys[].pose` | Tên một pose trong thư viện, hoặc object chỉ đè vài khớp. Tay ba số `[vai, khuỷu, cổ tay]`, chân hai số `[hông, gối]`, `head` ba số (số nào `null` là không ghi góc ấy — [Đầu và nét mặt](#đầu-và-nét-mặt)), `torso` một số, `stretch` bốn hoặc tám số — [Vươn chi](#vươn-chi). Tay thêm được số dang thứ tư, chân số dang thứ ba, `torso` thành `[cúi, nghiêng]` — [Dang và nghiêng ngang](#dang-và-nghiêng-ngang); tay thêm số xoắn vai thứ năm — [Xoắn tay](#xoắn-tay) |
| `keys[].reach` | Đích cổ tay hệ thân cho `armNear` / `armFar`: `{ "at": [tiến, y, ra ngoài], "elbow"?: [...] }`. Người 3D giải IK hai đoạn; mốc không ghi góc kênh ấy thì kênh nhận góc suy từ đích — [Đích bàn tay](#đích-bàn-tay) |
| `keys[].ease` | Áp cho đoạn **từ mốc này tới mốc sau**, mặc định `linear`: `linear` đều; `smooth` chậm vào chậm ra (`smoothstep`, cùng đường với đoạn hoà) — vận tốc về `0` ở mọi mốc nên mốc giữa nhìn khựng; `auto` bậc ba đơn điệu, liền vận tốc qua mốc giữa của chuỗi mốc `auto`, không vọt; `bezier` theo `keys[].bezier`; `spring` vọt qua rồi nảy về. Xem [Đường giữa hai mốc](#đường-giữa-hai-mốc) |
| `keys[].bezier` | `[x1, y1, x2, y2]` của `cubic-bezier` CSS, bốn số trong `[0, 1]` nên không vọt; chỉ ăn khi `ease: "bezier"`, bỏ trống là `[0.42, 0, 0.58, 1]` |
| `keys[].face` | Nét mặt kể từ mốc này: `{ "mouth": …, "brow": …, "eyes": …, "blush": … }`, khai trường nào thì ghi trường đó. Ba kiểu nét **không nội suy**, `blush` (`0..1`) nội suy như góc — [Má ửng](#má-ửng); chỉ ăn khi `face` nằm trong `mask` — xem [Đầu và nét mặt](#đầu-và-nét-mặt) |
| `keys[].hand` | Bàn tay người 3D kể từ mốc này theo kênh tay: `{ "armNear": "point", "armFar": { "pose": "fist", "w": 0.5, "turn": 80, "bend": -10 } }` — một dáng có sẵn hay của thư viện `hands/` (bỏ trống `pose` là dáng nghỉ, [Dáng tay có tên](#dáng-tay-có-tên)), xoay cẳng tay, gập cổ tay, **nội suy** như góc; chỉ ăn khi `hand` nằm trong `mask` — [Bàn tay](#bàn-tay) |
| `keys[].equip` | Đổi đồ kể từ mốc này: `{ "crown": "hat", "handFar": null }`. **Công tắc**, không nội suy, không hoà và **không đi qua `mask`** — xem [Đổi đồ giữa chừng](#đổi-đồ-giữa-chừng) |
| `events[]` | Mốc `{ name, t }` đặt tên cho một pha va chạm; không ghi khớp nào — xem [Mốc sự kiện](#mốc-sự-kiện) |
| `note` | Ghi chú cách dùng cho người soạn cảnh, tiếng Việt. Rig không đọc |
| `preview` | Cách Thư viện Studio 3D và `pnpm bang-hanh-dong` xem thử (cảnh dựng bằng `previewScene` của lõi, `previewWorld` của rig): `{ "base": "stand-3d", "stage": "stand" }` — `base` là hành động nền chồng dưới, bỏ trống thì suy theo `stage`; `stage` là `stand` \| `chair` \| `floor` \| `sit-down` \| `stand-up` \| `counter` \| `armchair` (ghế có tay vịn `PREVIEW_ARMREST`; `sit-down`, `stand-up` cũng dựng ghế này) \| `desk` (ghế và bàn `PREVIEW_DESK` trước mặt). `path` là chỗ người diễn theo giây của clip cho hành động dời hông (nhổm, đứng dậy từ sàn, ngồi xổm): `[{ "t": 0, "at": [0, 14], "sit": true }, …]`, `at` là `[trước, cao]` so với chỗ đứng ban đầu theo hướng mặt, đơn vị rig ở `height = 1`, `sit` thì `cao` là mặt ngồi dưới khớp hông như `world.path[].sit`, `t` tăng dần; scene dùng hành động ấy dựng `world.path` cùng dạng; `path` không có mốc ngồi mà hành động có sải chân (bước tiến, lùi) thì hết lượt hành động thả về nền, như cảnh thật nối clip rỗng. `hold` là món mẫu cầm từ giây 0, `{ "right": "coc@cylinder", "left": … }` theo tay giải phẫu, cùng dạng `world.hands[].hold` ([03](03-scene.md#đồ-cầm-tay)): chỗ tay theo hành động, hành động không biết món. `partner` là người thứ hai đứng ở chỗ hành động vươn tới, `{ "at": [220, 0], "yaw": 0, "action": "receive-3d" }`: `at` là `[trước, phải]` so với hông người diễn theo hướng mặt, đơn vị rig ở `height = 1` (mặc định `[220, 0]`), người ấy nhìn vào người diễn, `yaw` lệch thêm (độ), `action` diễn trên nền `stand-3d`, `hold` là món người ấy cầm từ giây 0 cùng dạng `preview.hold`; người ấy thu phóng (`world.s`) cho cao bằng người diễn, nên chỗ hai tay gặp nhau đúng với hai người cùng cao. `sceneAt` không đọc |
| `authoredAt` | `"side"`: góc tay chân soạn ở nhìn nghiêng, người 3D đọc như trong mặt phẳng dọc của thân — [Người 3D](#người-3d) |
| `sides` | `"anatomical"`: kênh gần là tay chân phải, kênh xa là trái, ở mọi góc máy (người 3D) — [03](03-scene.md#hành-động-theo-tay-phải-trái) |
| `snap` | `true`: chuyển động cố ý giật (giật mình, đập bàn) — `check` không đo giật ở kênh hành động ghi lúc nó chạy — [Hành động giật có chủ ý](#hành-động-giật-có-chủ-ý) |

**Ghép nhiều hành động là việc của scene, không phải của file.** `actionPose()`
chỉ trả các khớp hành động ghi; `composePose(nền, ...)` đè theo `mask`, không
cộng góc, riêng `stretch` đè theo từng chi ([Vươn chi](#vươn-chi)). Vẫy tay trong lúc đi là hai file, `wave-3d` chỉ ghi `armNear` và `hand`.

**`mask` quyết định, kể cả khi mốc gọi tên pose.** Pose trong thư viện là đủ mọi
kênh — hành động vẫy có mốc gọi tên pose mà không có `mask: ["armNear"]` thì nó ghi cả hai chân, chồng lên
`walk` là chân đứng im.

**Nội suy theo từng kênh**, giữa hai mốc gần nhất *có nhắc tới kênh đó*, không
phải hai mốc kề nhau; ba góc của `head` nội suy riêng từng góc, mốc ghi `null` ở góc nào
thì không tính cho góc ấy. Nhờ vậy một hành động có được hai nhịp khác nhau cho hai kênh:
thân đổi chiều ở giữa, góc gật chỉ có mốc đầu và mốc cuối.

**File hành động ghi số, không ghi tên pose.** Tên pose chỉ là tiện nghi lúc soạn: bảng
`POSES` còn được tinh chỉnh, mà file hành động thì nằm ở repo video — trỏ theo
tên là mỗi lần rig chỉnh `idle`, mọi hành động cũ đổi hình mà không qua
`ACTION_VERSION` nào.

### Đường giữa hai mốc

`ease` của một mốc quyết định đoạn từ nó tới mốc sau (trong các mốc có nhắc kênh). `linear`,
`smooth`, `spring`, `bezier` chỉ nhìn đoạn của mình. `auto` nhìn thêm hai mốc ngoài:

- **Bậc ba Hermite đơn điệu (PCHIP), từng thành phần số.** Tiếp tuyến ở mốc giữa là trung bình
  điều hoà của hai độ dốc kề, trọng số `2h₊ + h₋` và `h₊ + 2h₋` theo độ dài hai đoạn; hai độ dốc
  trái dấu hay một bên bằng `0` thì tiếp tuyến `0` — mốc đổi chiều dừng hẳn. Giá trị không ra khỏi
  khoảng của hai mốc kẹp. Thành phần thiếu (dang, nghiêng ngang) là `0` như khi nội suy thẳng.
- **Chuỗi `auto`.** Hai mốc liền nhau cùng `auto` nối liền vận tốc. Đầu và cuối chuỗi — mốc đầu,
  mốc cuối của `hold`, hay mốc kề có `ease` khác — tiếp tuyến `0`, chậm vào chậm ra từ nghỉ. Hai mốc
  đơn lẻ là đúng `smoothstep`. `end: "wrap"` nối chuỗi qua đường vòng (đoạn cuối → đầu dài
  `t đầu + 1 − t cuối`); mốc `t: 1` trùng pha mốc `t: 0` tính là một.
- **Góc đầu từng góc một.** Chuỗi của mỗi góc `head` chỉ gồm các mốc ghi số ở góc ấy; mốc `null` không
  thuộc chuỗi.
- **Kiểu không phải số lùi về `smoothstep`**: đích cổ tay (`keys[].reach`, cả hoà số hạng) và lòng tay
  theo ý định (`palm` / `fingers`). Góc (kể cả góc suy từ đích), `stretch`, `blush`,
  và số bàn tay (`keys[].hand`) đi đường bậc ba.

`auto` chậm lại trước mốc cuối chuỗi: đoạn lao vào mốc va chạm (rìu chạm gỗ, tay đập bàn) dùng
`linear` hoặc `bezier` tăng tốc (`y` dưới đường chéo, như `[0.5, 0, 1, 1]`). Cú nảy giữ `spring`.

### Đầu và nét mặt

Kênh `head` là `[nghiêng, lắc, gật]`:

| Góc | Quay |
|---|---|
| `nghiêng` | Đầu quanh trục tiến; dương đưa đỉnh đầu về phía `lắc` dương |
| `lắc` | Đầu quanh trục dọc; dương là quay mặt về bên trái người khi không lật |
| `gật` | Đầu quanh trục ngang; dương là cúi |

Cổ quay theo thứ tự `lắc` · `gật` · `nghiêng` (Euler `YXZ` ở `act`), lật thì `lắc` và `nghiêng` đổi dấu
theo `flip`. Khối sọ, tóc, mũ, kính và đồ `headAcc` quay cùng đầu; nét mặt vẽ trên canvas dán trên sọ
nên đi theo như một mặt thật. Mốc mặt của `anchorAt` thì đi đường riêng — [Mặt người 3D](#mặt-người-3d).

`keys[].face` lấy mẫu bậc thang trên kênh `face` — kênh riêng trong `mask`, không
phải góc đầu. Hành động chỉ đổi mặt tự thêm `face` vào `mask` và không đụng
`head`, nên nhép miệng chồng lên một hành động đang gật đầu là giữ nguyên cái
gật. `composeFace` đè theo từng trường; không khai thì dùng `DEFAULT_FACE`. Trong
đoạn hoà, `blendFace` đổi kiểu nét ở giữa đoạn. Riêng `blush` là số: nội suy giữa
hai mốc gần nhất có ghi nó (theo `ease` như góc), hoà thẳng suốt đoạn hoà (bên không
ghi là `0`), và track không ghi `blush` thì không xoá má của track dưới.

`mask: ["head"]` chiếm góc đầu mà không đụng nét mặt; `mask: ["face"]` thì ngược
lại; `clips[].mask` ở scene thu hẹp được từng kênh một. Nhả track mặt sau khi clip
thay thế đã hoà xong.

Bộ mẫu có sẵn một thang nét mặt chỉ ghi `face`: `face-calm`, `face-kind`,
`face-curious`, `face-ponder`, `face-focus`, `face-displeased`, `face-angry`,
`face-surprised`, `face-shocked`, `face-delighted`, `face-relieved`, `face-shy`,
`face-smug`, `face-greedy`, `face-worried`, `face-sad`, `face-pain`, `face-wince`,
`face-downcast`, `face-eyes-closed`, `face-bow` (nhắm mắt mỉm cười khi cúi chào),
`face-bored`, `face-bitter`, `face-anguish`, `face-fret`, `face-menace`,
`face-forced-smile`, `face-smirk`, `face-fake-tears`,
cộng hai hành động có nhịp `face-effort` và `face-tired`. Cảnh xếp chúng thành một
track cảm xúc riêng, nằm dưới track nhép (`talk-lips`, `talk-angry-lips`) và trên track
thân; `turn-head-*` chỉ ghi `head` nên quay mặt mà giữ nguyên cảm xúc.

**Góc đầu `null` là không ghi.** `head` của một mốc là `[nghiêng, lắc, gật]`, số nào
`null` thì hành động không ghi góc ấy: `composePose` và `blendPose` đè `head` theo từng góc
(`headOver`), góc để trống lấy của track dưới. `shake-head-3d` chỉ ghi lắc,
`tilt-head-near-3d` ghi `[10, null, null]`, `nod-once-3d` chỉ ghi gật — chồng ba track ấy theo
thứ tự nào cũng ra đủ ba góc. Hành động ghi đủ ba số thì đè cả ba,
kể cả lắc `0`: hành động đầu đi kèm lời nói để `null` ở góc lắc, không thì xoá hướng nhìn
của track khác. `actionDelta` trả nguyên `null`; trong `Pose` một phần, góc để trống là
`NaN` cho tới khi ghép.

### Đổi đồ giữa chừng

`keys[].equip` đổi vật tại một pha của hành động. Đổi socket giữ một vật phải
ghi cả hai phía trong cùng mốc:

```json
{ "t": 0,   "equip": { "faceAcc": "kinh", "neck": null } }
{ "t": 0.6, "equip": { "faceAcc": null, "neck": "kinh" } }
```

Mốc bật ở `t: 0` là bắt buộc: `end` giữ trạng thái mốc cuối sang lượt sau, nên
chỉ có mốc tắt là vật không hiện ở frame nào — xem
[03 — Bốn bẫy của `equip`](03-scene.md#bốn-bẫy-của-equip).

`equip` lấy mẫu bậc thang, không đi qua `mask` và không hoà. Socket không được
nhắc giữ nguyên trạng thái. Trạng thái tiếp tục qua clip sau cho tới khi một
mốc khác đổi nó. `cast[].equip` đặt trạng thái mở màn; chi tiết ghép scene nằm
ở [03 — Đổi đồ](03-scene.md#đổi-đồ).

### Mốc sự kiện

`events[]` đặt tên cho một **pha** trong chu kỳ: hai lòng bàn tay chạm nhau, bàn chân chạm
đất. Nó không ghi khớp nào, không đi qua `mask`, không hoà và không đổi hình gì
cả — chỉ là một con số **có tên**.

```json
{ "name": "clap-3d", "duration": 0.42, "end": "wrap", "events": [{ "name": "clap", "t": 0.5 }], "keys": [ … ] }
```

Pha lấy từ chính hình của hành động: `clap` của `clap-3d` nằm giữa quãng **hai lòng bàn tay
áp vào nhau** (hai mốc khép `0.45` và `0.55`), pha `step`
của `walk` là lúc **một bàn chân mới nhận lực** — đúng luật `onGround` mà
`bakeTravel` dùng, nên nó không lệch với sải chân được.

Scene đổi chúng ra giây bằng [`sceneEvents`](03-scene.md#hỏi-sự-kiện): clip lặp
thì sự kiện lặp theo, `phase` và `cycle` của clip tính sẵn trong đó.

### Chuyển giữa hai hành động

**Mốc `t: 0` là hình đầu tiên của hành động, không phải tư thế đứng trước nó.**
`sampleChannel` gán mốc này trực tiếp; `ease` chỉ áp dụng giữa hai mốc. Đoạn đưa
tay vào hình đầu tiên thuộc chỗ nối trong scene.

**Nhịp và trạng thái.** Suy ra từ file, không phải trường mới: `end: "hold"` mà
mốc cuối khác mốc đầu là **trạng thái** — nó đi tới một tư thế rồi giữ, scene
phải có clip khác kéo ra (`look-down-12-3d`, `tilt-head-near-3d`). Mốc cuối
quay về tư thế nghỉ là **nhịp**, tự dọn (`nod-3d`).

Mốc cuối được giữ theo `end`; tay hạ xuống sau khi vẫy phải nằm trong chính hành
động nếu đó là một phần của chuyển động.

**Hoà là đường thẳng trong không gian góc, không phải trong không gian hình.**
Đường ngắn nhất về góc có thể quét bàn tay ngang qua mặt hoặc kéo khuỷu vào
trong thân áo giữa chừng. Cặp nào bị thì scene chèn một clip trung gian, thường
là `stand-3d` ngắn — ngoại lệ vài cặp, không phải mặc định.

Thuật toán hoà nhiều track, clip rỗng và chỗ nối chồng nhau nằm ở
[03 — Chỗ nối](03-scene.md#chỗ-nối).

### Hành động giật có chủ ý

Chuyển động trên hình phải liền: `check` đo từng khớp mỗi khung và kêu chỗ nhảy vọt
([03](03-scene.md#giật-trên-hình)). Chỗ **cố ý** giật — giật mình, đập bàn, khựng lại — khai
`"snap": true` ở file hành động: mọi clip của nó được miễn đo ở kênh nó ghi, suốt lúc chạy, kể cả
đoạn hoà vào và ra. Chỉ một lần đặt cố ý thì khai `snap` ở clip ([03](03-scene.md#hình-dạng-json)).

`check` soi luôn chính file hành động (cảnh báo, `actionSnapProblems`; file khai `snap` thì thôi):

- **`end: "wrap"` mà mốc cuối ở `t: 1` lệch mốc đầu** từ `20°`: mỗi lượt lặp nhảy về mốc đầu trong
  một khung. Trạng thái giữ thì `end: "hold"`; nhịp lặp thì mốc cuối bằng mốc đầu.
- **Hai mốc liền nhau cách dưới `0,04 s`** (ở `duration` của file) mà góc đổi từ `20°` và nhanh hơn
  hẳn (gấp bốn) hai đoạn kề: cắt cứng giấu trong file. Chuỗi mốc dày cùng nhanh — cú vung soạn
  bằng nhiều mốc — không kêu.

### Điệu bộ khi nói

Cú nhịp và cú đầu khi nói của bộ chung đều **đi một lần rồi giữ**: `end: "hold"`, mốc `t: 0` gần tư
thế nghỉ, mốc cuối là đích, đoạn giữa `ease: "smooth"` — đơn điệu, chậm vào chậm ra, không vọt.
Không cái nào lặp (`wrap`) hay nảy (`spring`): nhấp lên xuống theo nhịp đều nhìn giật. Mỗi
cú là một trạng thái; scene vào bằng blend ~`0,3`, buông bằng clip rỗng blend ~`0,4` hoặc thay
bằng cú khác. Dáng tay khi nói là bộ `talk-pose-*` của [bộ hành động 3D](#bộ-hành-động-3d).

| Hành động | `mask` | Đích ở `t: 1` | Dùng khi |
|---|---|---|---|
| `talk-beat-3d` | `torso`, `head` | thân `5`, gật `−3` | cú nhịp khi tay giữ nguyên, người đứng |
| `talk-beat-seated-3d` | `torso`, `head` | thân `8`, gật `−6` | cú nhịp người ngồi, đầu ngửa bù gần thẳng đứng |
| `tilt-head-near-3d`, `-far-3d` | `head` | nghiêng `10` | câu hỏi, phản bác |
| `nod-once-3d` | `head` | gật `9` ở `t: 0,4` rồi `2` | nhấn một ý |

`duration` là `0,45 s` cho cú nhịp đứng và nghiêng, `0,5 s` cho cú nhịp ngồi, `0,6 s` cho gật:
15 → 85% quãng mất ~`0,24 s`. Scene đè bằng `cycle`.

- **Hai track:** nhịp thân (`talk-beat-*`), đầu (`tilt-head-*`, `nod-once-3d`, `turn-head-*`). Mỗi
  hành động chỉ ghi góc đầu của nó, góc còn lại `null` ([Đầu và nét mặt](#đầu-và-nét-mặt)); cú nhịp
  cũng ghi gật, nên khi trùng góc thì track trên thắng — đặt track đầu trên track nhịp để
  `nod-once-3d` giữ góc của nó.
- **Bù cái cúi bằng gật:** nghiêng đầu quay quanh trục tiến, nên không bù được cái cúi —
  nhìn chính diện nó thành ngoẹo cổ. `talk-beat-*` bù bằng gật, cùng trục với cái cúi, đúng ở mọi
  góc quay.

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
dưới `2°` không cần, và bù đầu thì ghi gật như `talk-beat-seated-3d`. Quá `2°` ở `walk` là gật gù.
Lắc sang hai bên theo chân trụ không có: `walk` chỉ ghi góc cúi của `torso`.

**Gót nhấc trước khi chân rời đất.** `0,08` chu kỳ cuối pha trụ bàn chân sau được nâng dần tới `5`
đơn vị trên chân kia — hơn dải chạm đất (`4`) — nên đúng lúc nhấc nó đã thôi là chân chịu lực. Nâng
dần từ `0`: vào lúc ấy chân sau có khi còn là chân thấp nhất, nâng ngay là hông nhảy.

**Chân vung nhấc dốc, không thấp hơn chân trụ trừ `clear · bump`.** Thấp hơn thì bàn chân bị nâng
lên đúng mức ấy rồi giải lại IK, nối mềm bằng softplus nên gối không gãy góc. `bump` đỉnh sớm (~35%
pha vung), dốc lúc nhấc, thoải lúc đáp: bàn chân vung phải rời dải chạm đất ngay khi nhấc, kẻo luật
chân chịu lực còn tính nó và kéo tốc độ người xuống. Đừng gập thêm gối để tránh đất: đùi đã ra trước
mà gập gối thì bàn chân thấp xuống trước khi cao lên.

Đổi `hip`, `knee` hay `stance` là đổi quãng một chu kỳ: `walk`, `walk-short`, `run-3d` chung
đi `278`, `140`, `277` đơn vị rig mỗi chu kỳ (`actionStride`), cảnh có `path` phải viết theo
quãng ấy kẻo trượt chân. Mốc `step` của `walk` đo bằng luật chân chịu lực (dưới),
không phải `t` chạm gót trên giấy: bàn chân đang đáp lọt vào dải chạm đất trễ hơn vài phần trăm chu
kỳ.

**Sải chân cũng là hệ quả, suy từ chính bàn chân đó.** Chân đang chạm sàn không được
trượt: nó dịch bao nhiêu so với hông thì người đi bấy nhiêu. `bakeTravel` trong `travel.ts`
tích phân thành bảng theo bước `1/120 s`; `actionStride` (quãng một lượt, nhịp của
`clips[].speed`) đọc mốc cuối của bảng.

Rig không có cổ chân, nên lúc hai chân mở ra, chân đang đáp xuống thấp ngang
chân đang đẩy — về hình học nó giống hệt dang chân đứng tại chỗ. Ba luật để
phân biệt, đều nằm trong `bakeTravel`:

- Chân đang chịu lực **giữ quyền** tới khi rời dải chạm đất (`4` đơn vị trên
  chân thấp nhất, chìm dưới nửa nét).
- Chân mới chỉ được nhận là chịu lực khi nó **ngừng tiến** — chạm gót. Trước đó
  nó là chân đang đáp, dù có thấp hơn.
- Hai chân cùng chịu lực thì lấy trung bình: `idle → shock` dang chân ra hai bên
  cho `0`, không đẩy người sang một bên.
- Không chân nào chịu lực (chân đẩy đã nhấc mà chân kia còn đang tiến — pha bay
  khi chạy) thì người giữ đà bước trước.

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

Muốn một tư thế `hold` tiếp tục thở, clip sau phải giữ cùng `mask`, pose
và mặt; chỉ thay các kênh tạo nhịp thở.

## Khẩu hình và mắt

Hình của khẩu hình, mắt, mày và nếp nhăn nằm ở một bảng của lõi, `core/face.ts`: mỗi kiểu là một
danh sách nét theo nghĩa SVG (`path`, `line`, `ellipse`, `rect`, nhóm, vùng cắt `clip`), người 3D vẽ
chúng lên canvas dán trên sọ. Thêm một
kiểu là thêm một dòng vào `MOUTHS` / `EYES` / `BROWS`; tên kiểu và `MOUTH_KINDS` / `EYE_KINDS` /
`BROW_KINDS` lấy từ khoá của bảng.

Không cần viseme thật. Cảm xúc chọn một **bộ** khẩu hình, mỗi bộ có đủ năm vai: nghỉ, răng
cắn, há vừa, há to, tròn. Khi nói, miệng xoay chủ yếu giữa răng cắn và há vừa, há to ở tiếng
nhấn, tròn ở nguyên âm tròn môi, khép khi nghỉ từ 0,2 s.

Khẩu hình theo lối sticker chibi: miệng mở là **chữ D** đối xứng — mép trên gần phẳng, đáy tròn —,
khoang đỏ nâu `#7a2b22`, dải răng trên `#f7f2e6` bám mép trên, lưỡi `#d0675a` nhô lên từ đáy ở miệng há
to (`talkB`, `talkO`, `wryOpen`, `wide`, `shout`). Viền khoang mực nâu `2,4` px đầu, khẩu hình khép là một
nét `3` px — mảnh hơn nét mày (`4`) cho miệng chibi nhỏ khỏi nặng. Các vai của một bộ dùng chung dáng, chỉ
khác độ há, nên nhép nhanh không giật hình. `wry`, `wryOpen`, `pursed`, `meh`, `smirk`, `fang` lệch về
khoé phải — nhếch là cố ý; còn lại đối xứng qua trục giữa mặt.

Người 3D dán khẩu hình lên một lớp riêng trên sọ và chỉnh lớp ấy ngay trước mỗi lần vẽ, theo góc
camera quanh trục đứng của đầu (`packages/rig/src/face.ts`), chỉ khẩu hình đổi, mắt và mày giữ nguyên:

- Camera lệch sang bên phải người quá `TURN` (≈ 9°) thì lật gương khẩu hình: khoé cao của khẩu hình
  lệch đổi bên, khẩu hình đối xứng giữ nguyên hình.
- Mồm lệch khỏi camera quá `CHEEK` (≈ 66°) thì trượt theo sọ về phía camera, giữ mồm nhỏ sát mép mặt
  thay vì cuộn mất sau mép đầu (cheeky mouth của anime); dừng khi mép mồm nửa rộng `21` px chạm vòng sọ ở
  cao độ mồm. Không giãn ngang: mồm nghiêng nhỏ hơn mồm chính diện. `shout` rộng hơn mức ấy nên lúc trượt hết
  mép xa của nó tràn ra mép đầu.

Lớp mồm phủ mép trên / dưới (`extent`) của mọi khẩu hình; thêm khẩu hình cao hơn thì nới `MOUTH_BOX`
(`face.test.ts` giữ hai bên khớp).

Cả hai chỉ đọc camera và đầu ở khung đang vẽ, không nhớ khung trước: cùng `t` cùng góc máy là cùng ảnh.
Người nền (`lod: "low"`) không lật, không trượt.

| Hình miệng | SVG | Kích hoạt |
|---|---|---|
| `closed` | Đoạn thẳng ngắn | Im lặng |
| `parted` | Khe nhỏ khép nhọn hai đầu, không răng | Khựng, chưa biết đáp; đi với mắt `open`, mày `lifted` |
| `talkTeeth` | Chữ D tô trắng, vạch mực cong chia hai hàm, không khoang | Nói: răng cắn — tiếng nhỏ, phụ âm, nguyên âm `i`, nghỉ ngắn |
| `talkA` | Chữ D, dải răng trên, khoang bên dưới | Nói: há vừa — nguyên âm `a`, `e`, tiếng thường |
| `talkB` | Chữ D sâu hơn `talkA` (cao ≥ 1,25 lần), dải răng trên, lưỡi ở đáy | Nói: há to — tiếng nhấn, to nhất đoạn |
| `talkO` | Bầu dục đứng, dải răng trên, lưỡi ở đáy | Nói: nguyên âm `o` kéo dài (おう, おお, オー) |
| `talkSadA` / `talkSadB` | Miệng hé ngang, vòm trên nhẹ, đáy phẳng, khoé bo; A tô trắng, B mở sâu với dải răng trên | Nói buồn nhẹ, ngập ngừng, thắc mắc |
| `talkAngryA` / `talkAngryB` | Hình thang bè dưới, mép trên vồng, dải răng trên; há nhỏ / lớn | Vừa giận vừa nói |
| `smile` | Cung cong lên | Vui |
| `frown` | Cung cong xuống | Buồn, thất vọng |
| `pain` | Nét run dạng sóng | Đau, nhăn nhó |
| `o` | Tròn nhỏ, dải răng trên | Ngạc nhiên; nói: nguyên âm tròn môi |
| `wide` | Bầu dục gần tròn, to, dải răng trên, lưỡi ở đáy | La hét |
| `grit` | Hình thang bo góc (trên rộng hơn dưới) tô trắng, một vạch giữa chia hai hàm | Nghiến răng, gồng, tức; răng cắn của bộ giận |
| `grin` | Cung cong xuống tô khoang, dải răng trắng bám mép trên | Cười toe, hớn hở; há to của bộ vui — vui hay không là ở mắt |
| `wry` | Nét lượn sóng, khoé phải nhếch (波線の口) | Cười gượng mím môi, ngượng, 「うん…」 |
| `wryOpen` | Miệng há lệch: khoé trái cao hẳn khoé phải, đáy sâu về phải, dải răng trên, lưỡi ở đáy | Cười gượng há miệng 「えへへ…」, (^^;) — đi với mắt `happy`, mày `sad` |
| `pursed` | Nét mím, ngoặc `)` ôm khoé phải (má phồng một bên) | Mím môi phân vân, ngượng, nén khó chịu |
| `puffed` | Nét ngắn giữa hai ngoặc `( )` (phồng hai má) | Nín thở, nín cười, phụng phịu |
| `meh` | Nét phẳng, khoé phải nhếch một vạch | Chán, nghi ngờ, không tin |
| `smirk` | Nét ngắn gần phẳng, khoé phải vểnh lên (ニヤリ) | Nhếch mép đắc ý, phản diện; đi với mắt `squint` / `sly`, mày `flat` |
| `fang` | Miệng hé lệch, khoé phải cao, một răng nanh trắng to từ mép trên gần khoé ấy (八重歯) | Cười tinh quái, láu cá, phản diện nhỏ |
| `shout` | Hình thang bè dưới rộng gần nửa mặt (`0,37` bề ngang đầu sau khi phóng), mép trên vồng cao, đáy tròn xuống gần cằm, dải răng trên theo vồng, lưỡi to | Quát, mắng (怒鳴る); đi với mày `angry`, mắt `open` / `squeezed` |

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

Răng luôn là **một dải trắng liền**, không kẻ từng chiếc — kẻ ô ở cỡ này thành hàm răng nhe; `talkTeeth`,
`grit` chỉ có một vạch giữa hai hàm, `fang` một chiếc nanh.

`mouthExtent(kind)` trả mép trên / dưới của mỗi khẩu hình so với tâm miệng (`extent` của nó trong
`MOUTHS`) — đây là số mà lớp mồm `MOUTH_BOX` phải phủ.

Mắt là hai chấm, đổi kiểu theo nét mặt; cỡ, mi và đốm sáng nghỉ là của nhân vật ([Nét mặt riêng](#nét-mặt-riêng)):

| Kiểu mắt | SVG | Kích hoạt |
|---|---|---|
| `open` | Chấm tròn `r6` | Mặc định |
| `shut` | Đoạn thẳng ngắn | Chớp, nhắm tịt, nhăn mặt |
| `wide` | Bầu dục đặc `1,35` lần mắt mở, lòng trắng giữa, con ngươi co còn chấm | Ngạc nhiên, sốc, hoảng |
| `bulge` | Lòng trắng to `r9` viền mảnh + con ngươi `r4` (mắt trố) | Sốc tột độ, hiếm dùng |
| `squint` | Nửa dưới con ngươi, mi trên sụp | Nheo, nghi ngờ, mệt |
| `happy` | Cung cong lên | Cười tít |
| `squeezed` | Hai nét gấp `> <` | Nhắm chặt, đau, gồng |
| `droopy` | Mi xiên xuống phía ngoài, mảng mắt rũ | Mệt, buồn nhẹ |
| `wink` | Mắt gần nhắm cong nhẹ, mắt xa mở | Nháy mắt, ra hiệu |
| `sly` | Trăng lưỡi liềm: mi dưới cong lên khoét lõm vào bầu dục, hai khoé nhọn, không đốm sáng (ニタァ) | Cười nham hiểm, đắc ý; đi với `smirk` / `fang` |

`wide` và `bulge` có lòng trắng, dùng với mày `raised`; `wide` cùng họ chấm đặc với `open` nên là mắt
ngạc nhiên thường ngày, `bulge` lệch hẳn khỏi nét chung, để dành cho cú sốc lớn. Mắt lim dim nghi ngờ (ジト目) là `squint`;
mắt lười hay khó tính thường ngày là `face.lid` của nhân vật ([Nét mặt riêng](#nét-mặt-riêng)), không phải
một kiểu mắt.

Mày `lifted` nhấc nhẹ, gần ngang; dùng cho phản ứng thoáng qua. Mày `raised`
nhấc cao và cong rõ, dùng cho ngạc nhiên mạnh hơn.

**Cả ba — khẩu hình, lông mày, kiểu mắt — vào được file hành động** qua
`keys[].face`; xem [Đầu và nét mặt](#đầu-và-nét-mặt). Chớp mắt vu vơ thì không:
đó là nhịp ngẫu nhiên của bên phát (scene tự chớp), hành động
chỉ ghi cái nhắm mắt *có nghĩa*.

Tâm miệng nằm dưới tâm mắt đúng `face.mouthGap` (mặc định `34`).

### Nếp nhăn vẽ bằng code

Dấu hiệu tuổi tác. `wrinkle = { kind, color, width, dy }` (`wrinkleMarks`), vẽ trên canvas nét
mặt **ngay trên da đầu**, dưới mắt / mày / mồm, cùng hệ toạ độ với mắt (`dy` dịch cả cụm):

| `wrinkle.kind` | Hình |
|---|---|
| `light` | Một nếp trán + chân chim hai bên |
| `deep` | Hai nếp trán + chân chim dày hơn + túi dưới mắt + pháp lệnh xuống quá mép mồm |

Ràng buộc hình:

- **Chân chim để nằm ngang thì thành ria mèo.** Nan quạt phải xoè xuống
  (`light` `12°`/`38°`, `deep` `−6°`/`18°`/`42°`) và ngắn — dài quá là râu mèo,
  không phải nếp nhăn.
- Pháp lệnh phải **xoè ra ngoài rồi mới xuống**, không thì thành hai dấu ngoặc
  ôm sát mồm.

Nếp trán nằm **dưới** tóc và mũ — có mái hay có mũ là bị che, đó là
chủ ý. Nhân vật già thì dùng nó cùng tóc bạc (`pieces.hair.color`).

### Má ửng

Hai vệt bầu dục dưới hai mắt, chếch ra ngoài (`blushMarks`), vẽ trên canvas nét mặt của người 3D ở
mọi dáng đầu. Mức ửng là `face.blush` của nhân vật (`0..1`, mặc định `0` — tắt) cộng
`blush` của nét mặt lúc ấy (`keys[].face.blush` qua `sceneAt`), kẹp ở `1`:

| Trường | Mặc định | Nghĩa |
|---|---|---|
| `face.blush` | `0` | Má ửng nền của nhân vật; người không ửng sẵn để `0` |
| `keys[].face.blush` | không ghi | Má ửng thêm của hành động, nội suy giữa các mốc: ngượng đỏ mặt dần là hai mốc `0` → `0,6` |

- **Màu suy từ da** (`blushColor`): `palette.skin` ngả `BLUSH.mix` (`0,6`) về đỏ ấm `BLUSH.flush`, độ
  đục `BLUSH.alpha · mức` (`0,55` ở mức `1`). Da sáng sẫm xuống thành hồng cam, da sẫm sáng lên thành
  đỏ gạch — cùng một độ ửng đọc ra trên mọi màu da, không thành vết bẩn hồng. Đừng đặt màu má riêng.
- **Vẽ lại theo nấc.** `blushLevel` làm tròn mức về `1 / BLUSH.steps` (`1/32`); `FaceRig.set` chỉ vẽ lại
  canvas khi kiểu nét hay nấc ửng đổi, nên má ửng dần không vẽ lại mỗi khung. Người nền (`lod: "low"`)
  dùng chung texture theo dáng mặt, nét, nấc ửng và màu da.

`face-shy` của bộ mẫu ửng từ `0` lên `0,6` trong `0,6` s.

### Nét mặt riêng

Mọi nhân vật dùng chung bộ khẩu hình, mắt, mày; mỗi người khác nhau ở nét mặt **nghỉ** — sáu số trong `face`
của JSON nhân vật, mặc định và khoảng ở `FACE_REST` (`core/face.ts`). Mặc định cho đúng nét chung, nên nhân
vật không khai vẽ đúng nét chung từng nét. Chọn 2–3 số cho mỗi người, đừng chỉnh cả sáu.

| Trường | Mặc định | Khoảng | Nghĩa | Ai đọc |
|---|---|---|---|---|
| `eyeScale` | `1` | `0,7..1,3` | Nhân cỡ mắt chibi (`CHIBI.eye`) | Đầu `human` |
| `eyeWidth` | `1` | `0,7..1,3` | Nhân độ bóp ngang (`CHIBI.squash`): dưới `1` mắt hẹp, trên `1` mắt tròn | Đầu `human` |
| `lid` | `0` | `0..0,6` | Mi trên nghỉ sụp, phần chiều cao con ngươi tính từ đỉnh, cắt ngang | Mọi nét mặt |
| `shine` | `1` | `0..1,5` | Nhân đốm sáng; `0` là mắt không đốm | Đầu `human` |
| `browWidth` | `1` | `0,5..1,8` | Nhân bề dày nét mày | Mọi nét mặt |
| `browTilt` | `0` | `−8..8` | Cộng vào độ nghiêng của mọi kiểu mày, cùng đơn vị `tilt` của `BROWS`: dương nhấc đầu trong (hiền, rụt rè), âm hạ đầu trong (nghiêm, khó tính) | Mọi nét mặt |

- **`lid` ăn ở mắt có con ngươi mở**: `open`, mắt mở của `wink`, `wide` và `bulge` (cắt cả lòng trắng, chỉ
  nửa số — trợn là mở to hơn mắt nghỉ); `squint` lấy số lớn hơn giữa `0,5` và `lid`; mắt nhắm, `droopy`, `sly` bỏ qua.
  Đốm sáng hạ xuống dưới mép mi và cắt theo hình mắt.
- **`browTilt` cộng lên cả biểu cảm**: người rụt rè giận thì mày `angry` bớt dữ, người khó tính cười thì mày
  vẫn hơi chau. Đó là chủ ý — nét nghỉ đi theo người qua mọi nét mặt.
- **Đầu cầu** (`head.form: "sphere"`) đọc `lid`, `browWidth`, `browTilt`; `eyeScale`, `eyeWidth`, `shine`
  thuộc nét chibi nên chỉ đầu `human` đọc.

Công thức mẫu cho một dàn văn phòng:

| Vai | Nét nghỉ |
|---|---|
| Đàn em vui tính | `eyeScale 1,15`, `shine 1,3`, `browTilt 1` |
| Sếp nghiêm | `eyeScale 0,85`, `eyeWidth 0,85`, `shine 0,6`, `browWidth 1,4`, `browTilt −3` |
| Đồng nghiệp lười | `lid 0,4`, `shine 0`, `browTilt 1` |
| Chị お局 khó tính | `eyeWidth 0,85`, `lid 0,15`, `browWidth 0,8`, `browTilt −4` |
| Đối thủ nham hiểm | `lid 0,25`, `shine 0,5`, `browTilt −1,5`; hành động để miệng nghỉ `smirk` |
| Lính mới rụt rè | `eyeScale 1,15`, `shine 1,2`, `browTilt 4`, `browWidth 0,8` |

Phản diện vẫn cùng rig: dữ là ở vài nét — mi sụp không đốm sáng, miệng `smirk` / `fang`, mắt `sly`, mày
`flat` hay `angry`; cảnh mắng là miệng `shout`.

### Tóc

Tóc là [tóc dựng khối](12-trang-phuc-3d.md#tóc-dựng-khối) cắm ở `hair` (`src: "sculpt"`): vỏ
ôm sọ đơn vị quay theo đầu, tóc rủ buông theo trọng lực.

| Hằng số | Giá trị | Nghĩa |
|---|---:|---|
| `SCULPT_HANG_FROM` | 75 | Kinh độ mặc định của mép trước mảng rủ hai bên, độ; kiểu có `hangFrom` thì dùng số của kiểu |
| `SCULPT_FLARE` | 0.08 | Đuôi tóc rủ xoè ra khỏi trục dọc qua tâm đầu, lần bán kính sọ |
| `SCULPT_DEPTH` | 0.4 | Tóc rủ: vỏ sau gáy phồng, và mặt rủ xoè, uốn, sóng theo chiều trước–sau bằng bấy nhiêu phần chiều ngang |
| `SCULPT_TUCK` | 0.7 | Tóc rủ: tới đuôi, phần mặt rủ trước mặt phẳng qua hai tai co về mặt phẳng ấy bấy nhiêu phần |
| `SCULPT_TEMPLE` | 0.45 | Tóc rủ: vỏ ở chỗ rời sọ co về mặt phẳng qua hai tai bấy nhiêu phần, hết co ở vĩ độ 40° |
| `SCULPT_BANG_TIP` | 22 | Quá `bangTo` bấy nhiêu độ thì bề dày mép mái lệch mỏng hết |

### Lông mày

Lông mày là kênh biểu cảm (`keys[].face.brow`) ngang hàng với `mouth`, không nằm trong JSON
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

Mặc định (`palette.clad` tắt) chi là ống đặc màu nét `#1a1a1a` dày `10` (`LIMB_WIDTH.stick`), màu da
chỉ hiện ở mặt. Bật `clad` thì tay chân là ống màu tay áo, ống quần có vỏ viền theo `rig.stroke`
([Người 3D mặc đồ](#người-3d-mặc-đồ)). `sleeveWidth`, `trouserWidth` bỏ trống thì `limbWidths` lấy
theo cờ: `10` khi tắt, tay `15` chân `17` khi bật.

`palette.limbCurve` (`0..1`, mặc định `1`) uốn chi thành nét kiểu rubber hose.
`0` là hai đoạn thẳng gãy ở khuỷu / gối, cho nhân vật muốn nét gãy góc. Mỗi chi là **hai cubic
Bézier** qua `[gốc, khớp giữa, ngọn]`, tiếp tuyến ở khớp giữa song song gốc → ngọn (`limbCurves`
của lõi, `bendLimb` của `stickman.ts`).

**Chỉ khuỷu và gối được làm tròn.** Điểm hai đầu và tiếp tuyến ở hai đầu y hệt
đoạn thẳng: chi ra khỏi vai theo hướng cánh tay trên, vào cổ tay theo hướng cẳng
tay. Vì thế đồ cầm tay (treo ở cổ tay) không phải biết gì tới độ cong. Độ phình tỉ lệ
thẳng với `limbCurve`; độ cong áp cho cả bốn chi.

## Người 3D

Người khai `cast[].world` trong cảnh có `scene.lens` ([03](03-scene.md#người-3d)) có **khớp 3D**:
`figure3d(c, pose, world)` dựng hông, gối, bàn chân, vai, khuỷu, cổ tay, cổ, đầu trong thế giới,
gốc là tâm hông, hệ thân là hướng mặt `F`, trục đứng và bên phải `R` của người. `anchorAt` chiếu
các khớp ấy qua `Lens` rồi quy về một tư thế phẳng đúng với chúng (`flatPose`: góc mỗi đoạn theo
hướng đã chiếu, `stretch` theo độ dài đã chiếu — đoạn chĩa về ống kính co lại thật), nên mọi mốc
bám đúng hình. `solids` của nó là khối từng phần người trong thế giới cho `check` đo lấn với đồ
khối. `feet3(pose, world, height, hipHalf)` trả riêng hai bàn chân thế giới — cùng hình học chân
của `figure3d` —, bước chân của người đi theo `path` tích phân trên nó ([03](03-scene.md#đi-theo-path)).

- **Kênh nâng và kênh không nâng.** Kênh tay chân mà hành động `authoredAt: "side"` ghi mang cờ
  `pose.lift`: góc đọc như soạn ở `side` — tiến theo hướng mặt, lên theo trục đứng, cùng phía
  với gốc chi. Chi gần là chi phải khi mặt hướng sang phải khung (không lật), chi trái khi lật.
  Kênh không có cờ: `figure3d` giữ góc trên mặt khung, từ gốc chi đã chiếu, còn sân khấu three
  (`act`) vẽ ở dáng nghỉ ([Khớp người 3D vẽ ra](#khớp-người-3d-vẽ-ra)). Hai đường khác
  nhau ở đây, nên người 3D diễn hành động không soạn ở `side` ở kênh tay chân là lỗi của `check`
  ([03](03-scene.md#hành-động-cho-người-3d)). `torso` của người 3D luôn là góc cúi trong mặt phẳng
  dọc của thân; nghiêng sang ngang là số thứ hai của nó ([Dang và nghiêng ngang](#dang-và-nghiêng-ngang)).
- **Cổ và đầu ở chỗ chiếu thật.** Mốc `collar` là cổ thật đã chiếu, `head` là tâm đầu thật đã chiếu
  (ống kính cúi thì đầu hạ xuống vai). Mốc mặt nhận góc ống kính nhìn xuống đầu bằng trục riêng
  `look` của `HeadTurn` — quay quanh trục ngang của ảnh sau cái lắc, không cộng vào `gật`. Nó chỉ
  nhận `HEAD_LOOK` (`0,5`) phần góc ấy, đo trong hệ thân: nhận đủ thì ở ống kính cao mặt dồn xuống
  cằm như đang cúi gằm.
- **Gốc chi trên khung là khớp thật đã chiếu.** Gốc chân là gốc hông thật (hông `± R · hipHalf`) đã
  chiếu: trục hông dốc theo góc cúi và phối cảnh, nên hai chân tách ra hai bên đáy thân, không chụm
  về giữa. Gốc vai là vai thật (`± R ·` nửa rộng vai, ở thân áo dựng khối là tâm nét viền vai) đã
  chiếu. Gốc sát mặt phẳng ống kính (độ sâu không quá nửa độ sâu tâm)
  chiếu ra vô cực, nên lấy nửa trục nằm ngang `∓ nửa rộng · cos theta`.
- **Quay được mọi góc.** `facing` chỉ đo: `theta`, mặt sang trái hay phải khung (`flip`), `yaw`
  giữ nguyên — `yaw` khai là hướng vẽ, kể cả nhìn thẳng ống kính (`theta` 0) hay quay lưng thẳng
  (`theta` 180).
- **Ngồi đúng.** Người ngồi có hông cao hơn mặt ngồi đúng nửa bề dày đùi (`body3(c).legHalf`:
  `limbHalf(c).leg`, người mặc đồ là gốc đùi `cladThigh`): mông và mặt dưới đùi nằm trên mặt ngồi,
  không xuyên ghế.
- **Đầu chi đúng chỗ thật.** Chuỗi chi đã nâng (và tay có đích) đi từ gốc tới đúng chỗ chiếu
  thật của bàn chân, cổ tay. Gốc trùng gốc thật nên cả chuỗi là hình chiếu thật; gốc dự phòng sát
  mặt phẳng ống kính thì khớp giữa theo phép đồng dạng đưa gốc chiếu thật về gốc ấy. Bàn chân đứng
  trên sàn, cổ tay nằm trên mặt bàn dù ống kính cúi cao.

### Dang và nghiêng ngang

Ba góc chỉ người 3D đọc, cho chuyển động ra ngoài mặt phẳng dọc của thân — giơ tay sang ngang, bước
ngang, nghiêng người:

| Ghi ở | Góc | Quay |
|---|---|---|
| Tay `[vai, khuỷu, cổ tay, dang]` | `dang` | Cả tay quanh trục tiến qua vai; dương ra ngoài phía chính tay ấy, `90` là tay ngang vai, `180` là thẳng lên |
| Chân `[hông, gối, dang]` | `dang` | Cả chân quanh trục tiến qua gốc chân; dương ra ngoài |
| `torso: [cúi, nghiêng]` | `nghiêng` | Thân (cùng cổ, đầu, hai tay) quanh trục tiến qua hông, trước cái cúi; dương về phía tay xa — cùng chiều với `head[nghiêng]` dương |

- **Số dang tuỳ chọn, thiếu là `0`.** Tay ba, bốn và năm số, chân hai số và ba số, `torso` một số và
  hai số nội suy chung được (`mixAngles`). Lớp trên ghi `torso` một số là thân thẳng ngang, không
  giữ nghiêng của lớp dưới (`composePose`); nghiêng đi trong `Pose.lean`.
- **Dang chỉ đọc ở kênh nâng** (`actAngles`), như góc tay chân: soạn trong hành động
  `authoredAt: "side"`. Nghiêng thân không cần cờ, như `torso`.
- **Dang quay sau cái gập.** Ở `act` vai và hông là Euler `ZXY` (dang · gập; vai thêm xoắn), nên tay đã
  gập `90` ra trước thì dang chỉ xoay nó quanh chính nó; khuỷu, gối gập trong mặt phẳng đã dang. Cẳng tay
  dựng lên khi tay dang dùng [xoắn vai](#xoắn-tay); tay vừa ra trước vừa sang ngang dùng
  [đích bàn tay](#đích-bàn-tay).
- **Chân dang thì bàn chân lên.** Chiều cao bàn chân của chân nâng nhân `cos(dang)`; hông người 3D
  đặt theo bàn chân thấp nhất có tính dang (`feet(…, spread)`), nên dang cả hai chân là hông hạ
  xuống. Dang một chân mà muốn nó vẫn chạm sàn thì vươn chân ấy `1 / cos(dang)`. Mẫu `step-side-3d`
  bước ngang tại chỗ theo cách ấy. Quãng trôi của hành động `side` (`actionStride`) cũng đo bàn chân có tính dang: chân
  đang bước dang ra cao lên nên không bị nhận là chân trụ.
- `figure3d` dựng cùng ba góc.

### Xoắn tay

Ba góc quay tay của người 3D quanh chính nó, cho vẫy tay, ngửa tay, úp tay:

| Ghi ở | Góc | Quay |
|---|---|---|
| Tay `[vai, khuỷu, cổ tay, dang, xoắn vai]` | `xoắn vai` | Cánh tay trên quanh chính nó, sau dang và gập: mặt phẳng gập khuỷu xoay theo. Dương là **xoay ngoài**: khuỷu gập ra trước thì cẳng tay quay ra phía chính tay ấy |
| Tay, số thứ ba | `cổ tay` | Lệch bàn tay trong mặt phẳng khuỷu, dương ra phía ngón cái — cùng chiều với khuỷu |
| `keys[].hand`: `turn` | xoay cẳng tay | Bàn tay quanh trục cẳng tay, `−90..90`; `0` lòng tay quay vào thân, dương là **sấp** (cẳng tay chĩa ra trước thì lòng tay úp), âm là ngửa |
| `keys[].hand`: `bend` | gập cổ tay | Bàn tay về phía lòng tay khi dương, mu bàn tay khi âm, `−90..90` |

- **Xoắn vai và lệch cổ tay đọc như số dang**: kênh nâng (`authoredAt: "side"`, `actTwist`); kênh không nâng
  về `0`. Xoay và gập cổ tay ở kênh `hand` không cần cờ.
- **Tay áo tròn nên xoay cẳng tay chỉ xoay bàn tay**: khớp `wrist` của `act` quay theo cả ba góc cổ tay (Euler
  `YZX`, `wristTurn` của lõi) — bàn tay, khung `hand` và đồ cầm đi theo. Người que không có bàn tay: đồ cầm vẫn
  quay.
- **Vẫy tay** là dang `90`, khuỷu `90`, xoay ngoài `90` — `[0, 90, 0, 90, 90]`: cẳng tay dựng đứng, lòng tay ra
  trước. Xoay ngoài `90` đặt mặt phẳng gập khuỷu vào mặt phẳng trán, nên **lắc khuỷu** là vẫy qua lại: khuỷu dưới
  `90` ngả cẳng tay ra ngoài đầu, trên `90` ngả vào đầu. Lắc xoắn vai thì cẳng tay lắc ra trước, ra sau. Đầu chibi to
  nên tay vẫy đọc rõ khi khuỷu dưới `90`. Cánh tay trên nâng quá ngang thì cẳng tay "dựng" theo nó nghiêng vào đầu
  đúng bấy nhiêu, kể cả phần tay choãi (`roots3`): mẫu `wave-3d` của app xem thử dang `80` và lắc khuỷu `40..75`. Nhún vai ngửa tay là
  cẳng tay ra trước với `turn` `−90`.
- **`turn` đo từ chính khung cẳng tay**, mà tay theo đích thì khung ấy quay theo hướng khuỷu: cẳng tay đặt trên bàn
  với hướng khuỷu ra ngoài đã úp quá nửa lòng tay ở `turn` `0`, `arms-on-table-3d` chỉ cần `20`. Một `turn` đúng với
  hướng khuỷu này là sai với hướng khuỷu khác, nên đừng đoán `turn`: khai `palm` để rig tự giải
  ([Hướng lòng tay theo ý](#hướng-lòng-tay-theo-ý)), còn `turn` thô thì đổi xong đọc hướng lòng tay bằng số —
  [Hướng lòng bàn tay](#hướng-lòng-bàn-tay).
- `figure3d` dựng xoắn vai.

### Bàn tay

Người 3D mặc đồ (`palette.clad`) có bàn tay năm ngón tròn mập kiểu hoạt hình: lòng bàn tay, ngón cái, trỏ, giữa, áp
út, út, mỗi ngón hai đốt. Khung xương (`HAND_BONES`, `HAND_FINGERS`, `handFrames`), dáng có tên (`HAND_POSES`), dáng nghỉ
(`HAND_RELAXED`) và tâm nắm (`handGrip`) ở `core/hand.ts`; mặt da bàn tay và nang va chạm (`handCapsules`,
`fitCapsules`) ở `core/handMesh.ts`. Hành động chỉ chọn dáng cơ bản, không soạn từng ngón:

| Dáng | Ngón |
|---|---|
| `open` | Xoè phẳng |
| `grip` | Cầm: ôm quanh cán tròn (cốc, quai); dáng của tay đang cầm đồ |
| `point` | Chỉ tay: trỏ duỗi, còn lại nắm |
| `fist` | Nắm đấm, ngón cái vắt ngang trước các ngón |
| `cup` | Khum: ngón gần thẳng, khép, chỉ cong nhẹ ở đầu, ngón cái sát cạnh — che miệng, che tai, áp điện thoại vào tai |
| `pinch` | Kẹp vật nhỏ bằng đầu ngón cái và ngón trỏ, ba ngón còn lại cuộn đỡ dưới — chén sake, viên kẹo |
| `clasp` | Nắm quanh vật to cỡ cổ tay: cổ tay, cẳng tay tay kia (chắp tay sau lưng) |
| `flat` | Duỗi thẳng, ngón khép, hơi ưỡn: đặt phẳng chịu lực lên tay vịn, mặt bàn, đùi |
| `hook` | Móc: gốc ngón gần thẳng, đốt ngọn gập hẳn — quai túi, cán vali |
| `edge` | Kẹp cạnh vật dẹt: ngón cái mặt trước, các ngón duỗi đỡ mặt sau — điện thoại ngang hai tay |
| `span` | Xoè ôm hai cạnh vật dẹt: lòng tay và các ngón gần thẳng áp mặt sau, đầu ngón tì cạnh này, ngón cái dựng dọc cạnh kia — một tay giơ điện thoại khoe màn |
| `sheet` | Kẹp vật mỏng ở mép (tờ giấy, thẻ, bảng giá, thực đơn): bốn ngón khép, gập chừng 40° ở gốc, đệm ngón đỡ mặt sau; ngón cái khép, gần duỗi, gần song song ngón trỏ (chếch vào trong chừng 15°), đệm ngón cái áp mặt trước — với fixture `bang-gia#doc` ngón cái và các ngón cùng đè từ mép vào sâu chừng 3 đơn vị rig ở bàn tay cỡ `1`, 5,75 ở cỡ `1,61`, 6,25 ở cỡ `2,16`. Mặt tờ nghiêng chừng 40° so với lòng tay, nên nhóm `sheet` `pinch` đặt lòng tay ≈ 0,76 × pháp tuyến mặt trước + 0,64 × hướng ngón trên mặt tờ; mép tờ chạy dọc hàng khớp gốc ngón, lòng tay ở ngoài tờ |
| `thumbsUp` | Giơ ngón cái: ngón cái dạng hẳn, dựng lên, bốn ngón nắm — khen, đồng ý; tâm nắm như `fist` |
| `tripod` | Cầm bút ba điểm theo khung `but#viet`: ngón cái (dạng 28°, đối 45°, gốc và ngọn thẳng) khép sát ngón trỏ, thân bút tựa khe ngón cái – ngón trỏ, kẹp giữa đệm ngón cái, đệm ngón trỏ (gập 40° ở gốc và 40° ở đốt ngọn) và cạnh đốt ngọn ngón giữa; giữa, áp út, út cuộn chung 48° và 76°, xoè 0. Khe giữa nang ngón cái và nang ngón trỏ ≤ 1,5 đơn vị rig, ngón cái không lún vào ngón nào; thân bút bán kính 1,3 tựa vào khe ấy ở bàn tay cỡ `1,61` và `2,16`. Cổ tay hơi duỗi là `bend` âm của mốc, không nằm trong dáng |
| `chopsticks` | Cầm đũa (ảnh mẫu `dua-an-can`): ngón cái dạng 41°, đối 30°, gốc duỗi ngược 10°, ngọn gập 5°, xoay sấp 15° — đệm ngón cái ép que trên vào đệm trỏ; trỏ gập 30° ở gốc và 46° ở đốt ngọn; giữa, áp út, út cuộn chung 35° và 55°, xoè 0 — đốt ngọn ngón giữa dưới que trên, sườn đốt ngọn áp út đỡ que dưới, đuôi que dưới tựa kẽ cái – trỏ. Hai que chạy ngang mặt lòng các ngón, ngọn ra ngoài phía áp út – út; tâm nắm (`HAND_GRIPS.chopsticks`) giữa hai que ở tầm đệm ngón |
| `cupPinch` | Kẹp chén nhỏ (nhóm `bowl` `pinch`): ngón cái dạng 60°, đối 103°, gốc duỗi ngược 8°, ngọn duỗi ngược 15°, xoay sấp 45° — nằm ngang trước lòng tay, đệm quay vào thành chén phía cổ tay; trỏ gập 32° ở gốc và 25° ở đốt ngọn, giữa, áp út, út 45° và 12°, xoè 0 — trỏ, giữa ôm thành phía xa. Chén nằm trong vòng cái – trỏ – giữa, lòng tay cách chén; tâm nắm (`HAND_GRIPS.cupPinch`) ở trục chén ngang tầm chỗ chạm |
| `card` | Kẹp thẻ bên (nhóm `card` `lateral`): ngón cái dạng 48°, đối 75°, gốc duỗi ngược 20°, ngọn thẳng, xoay sấp 45° — khép dọc sườn ngón trỏ, đệm đốt ngọn quay về phía các ngón và nằm phẳng trên một mặt thẻ; trỏ gập 28° ở gốc và 110° ở đốt ngọn, mặt kia của thẻ tựa sườn đốt ngọn; giữa, áp út, út 90° và 40°, xoè 0 — co lỏng dưới thẻ. Tâm nắm (`HAND_GRIPS.card`) ở giữa bề dày thẻ ngay dưới đệm ngón cái; thẻ chạy ra khỏi chỗ kẹp theo `CARD_OUT` của nhóm |
| `edgePinch` | Kẹp hai mép bằng đầu ngón (nhóm `card` `edges`, nhặt thẻ nằm trên bàn): ngón cái dạng 55°, đối 55°, gập gốc 5°, ngọn 15°, xoay sấp 35°; trỏ, giữa, áp út, út gập 50° ở gốc và 40° ở đốt ngọn, xoè 0 — đầu ngón chúc xuống, đệm cái và đệm trỏ quay vào nhau. Nhóm hoà nó sang dáng mở theo bề rộng thẻ; tâm nắm (`HAND_GRIPS.edgePinch`) giữa đầu ngón cái và đầu trỏ |

**Dáng nghỉ không nằm trong bảng**: ngón cong nhẹ, ngón cái khép sát cạnh ngón trỏ, đầu ngón cái tới gần giữa đốt gốc ngón trỏ — bàn tay không ai đặt dáng, và
gốc mà `w` hoà từ đó; mốc chọn nó bằng cách bỏ trống `pose` (`{}`). Thêm một dáng là thêm một dòng vào
`HAND_POSES`; `HandPose` và `HAND_POSE_KINDS` lấy từ khoá của bảng.

- **Số của một bàn tay** (`HAND_DOF`, `HandVec`, bên trong rig): xoay cẳng tay, gập cổ tay, rồi mười góc ngón — ngón cái
  `[dạng, đối, gập gốc, gập ngọn]`, trỏ `[gập gốc, gập ngọn]`, ba ngón còn lại chung `[gập gốc, gập ngọn]`, độ xoè, rồi
  xoay ngón cái (`thumbRoll`, trường `Fingers.thumbRoll`, bỏ trống là `0`).
  Giữa, áp út, út lấy góc chung cộng độ lệch cố định của từng ngón (`HAND_FINGERS`: gốc, độ dài, xoè theo độ xoè,
  gập thêm về phía ngón út): xoè thì toả nhẹ, nắm thì ngón út cuộn sâu nhất. Mọi
  ngón gập về phía lòng tay; ngón cái dạng ra phía trước bàn tay rồi đối về lòng tay, nên đối nhiều thì gập
  là vắt ngang lòng tay.
- **Xoay ngón cái quanh trục của chính nó** (`thumbRoll`, kẹp trong `THUMB_ROLL` = [−15°, 45°]): phần xoay trục của động
  tác đối ở khớp thang – bàn ngón cái. Thứ tự quay của đốt gốc: đối (quanh trục dọc bàn tay), dạng, gập gốc, rồi xoay quanh
  trục đốt — đốt gốc không đổi chỗ, chỉ mặt đệm (phía gập) và mặt gập của đốt ngọn quay theo. Dương là sấp: đệm quay về
  phía đầu các ngón (gặp đệm trỏ – giữa khi đối); âm là ngửa. `0` ra đúng khung không có bậc này. Tầm theo giải phẫu: khớp
  thang – bàn xoay trục chừng 17° khi đo X quang (Cooney và cộng sự, *J Bone Joint Surg Am* 1981;63:1371); đo CT 3D trên 30
  người khoẻ, đốt bàn ngón cái sấp chừng 42° khi dạng quay ra, 91° khi dạng gan tay, 99° khi đối (IFSSH 2019, đo theo
  Cheema) — cung chừng 57°. `đối` của rig đã mang một phần độ sấp ấy, nên phần thêm lấy sấp tới 45°, ngửa tới 15°.
  `handPoseOff` cộng lệch xoay vào tổng bình phương mà vẫn chia chín, nên dáng không khai xoay đo y như trước.
- **Ngón cái dài như tay người.** Gốc ngón cái (`HAND_BONES.thumb.at`) ở chừng một phần ba lòng bàn tay tính từ cổ tay,
  chỗ khớp gốc ngón cái của tay người, lệch về phía ngón cái; hai đốt `0,048` và `0,040` (ngón trỏ `0,04`, `0,037`):
  khép sát (dáng nghỉ, `cup`, `flat`, `hook`) thì đầu ngón cái vượt khớp gốc ngón trỏ, tới gần giữa đốt gốc (0,4–0,45 đốt), da ngón cái không lún vào nó (dáng nghỉ hở chừng 0,1 đơn vị ở cỡ `1`). Dáng áp
  món lên lòng tay (`span`, `edge`) giữ đốt gốc ngón cái ngoài vùng lòng tay áp món (từ nửa lòng bàn tay tới hàng khớp
  gốc ngón); tâm nắm (`HAND_GRIPS`) không đổi.
- **Mốc** (`keys[].hand.armNear` / `armFar`) là tên dáng (có sẵn hay của [thư viện](#dáng-tay-có-tên)), hay
  `{ pose, w, turn, bend, palm, fingers }`: dáng hoà từ dáng nghỉ theo `w` (`0..1`, mặc định `1`); `turn`, `bend` là hai góc thô của cổ tay ([Xoắn tay](#xoắn-tay)); `palm`, `fingers`
  là hướng theo ý định, rig giải ra góc ([Hướng lòng tay theo ý](#hướng-lòng-tay-theo-ý)). `handVec` đổi một mốc ra số.
- **Hoà là hoà góc khớp.** Giữa hai mốc số nội suy theo `ease` như góc tay; giữa hai clip `blendPose` hoà
  trên chính các số ấy suốt đoạn hoà — dáng tay đổi dần, không nhảy, không dựng lại hình học. Track ghi bàn
  tay một bên không xoá bàn tay bên kia của track dưới (`composePose`); bên không ai ghi là `HAND_REST` (dáng
  nghỉ, cổ tay thẳng). Kênh `hand` tách khỏi kênh tay: một track chỉ ghi `hand` ngửa hay úp bàn tay trên
  một track tay khác.
- **Cầm đồ.** `hold` (và `dress` vào `handNear` / `handFar`) đặt `held` của bàn tay, đè góc ngón của hành động, giữ xoay
  và gập cổ tay. Cầm cứng (`HoldOptions.grip`, `world.hands[].hold`) lấy dáng, chỗ và hướng món từ chỗ cầm nhóm trên
  `held/<món>.json` — [Món cầm tay](#món-cầm-tay). Đường cũ (`hold` không `grip`, `@deprecated`) đặt dáng `grip`, hay
  `HoldOptions.pose` (một dáng của bảng, kể cả `pinch`, `edge`, `span`, `hook`), và
  đồ ngồi ở **tâm nắm của dáng đang giữ** (`HAND_GRIPS`): chỗ treo vẫn là tâm nắm của `grip` (`handGrip`), dáng khác dời đồ
  đi `gripShift` trong khung bàn tay — chén ngồi trên vòng ngón cái, ngón trỏ của `pinch`, điện thoại ngang ngồi giữa ngón cái
  và các ngón của `edge`, điện thoại dọc ngồi trước lòng tay, bề ngang giữa ngón cái và đầu các ngón của `span`. Đồ căn cho `grip` không đổi chỗ. Đồ bật ở một khung (`equip` là công tắc), nên muốn tay khép dần
  thì cho hành động đưa bàn tay về dáng cầm trước mốc `equip`.
- **Món trong tay ghi trên người.** `hold` ghi `Figure.holding[side]` (`Holding`: `object`, `item`, `grip`, `pose`,
  `follow`, `both`, `offset`, `rotate`; `item`, `grip` chỉ có ở lần cầm cứng), `release` xoá — `check` đọc nó để đo đồ
  cầm ([03](03-scene.md#đồ-cầm-tay)). Cầm cứng đo ý định qua `AimReport.hold` của bộ giải. Đường cũ khai ý định ở
  `object.userData.hold` (`HeldIntent`, trục trong khung món, three): `up` trục phải gần hướng lên (chén, ly, bình đứng),
  `face` mặt phải quay về `faceToward` — `"holderFace"` mặt người cầm, `"camera"` ống kính; món nghiêng cố ý (rót) thì không
  khai `up`. `grip` gọi riêng (không qua `hold`) không ghi gì. `act` giữ độ lệch còn lại của từng tay ở
  `Figure.aim` (`AimReport` của `actAim`) cho `check` đọc lý do.
- **Tâm nắm theo góc ngón** (`handGripOf`): hoà `HAND_GRIPS` theo độ gần của mười góc ngón với từng dáng, nên đúng bảng khi
  đúng dáng và đổi liền khi dáng hoà — `point: "grip"` của đích bàn tay đọc nó ([Đích theo mốc](#đích-theo-mốc)).
- **Một mặt da liền.** `handSkin` dựng một lưới kín từ hợp trơn (smooth-min) các khối của khung xương ở dáng gốc
  `HAND_BIND` (ngón duỗi, ngón cái dạng, các ngón xoè rộng cho khỏi dính nhau), đa giác hoá bằng surface nets, kéo về
  mặt và làm trơn — lòng bàn tay chảy liền vào năm ngón, các ngón mọc ra từ cùng mặt, không có vỏ riêng nên không
  có nếp hay nét viền bên trong bàn tay. Dựng một lần mỗi cỡ (`k`, `long`, `low`) lúc dựng người rồi giữ, tay trái là
  tay phải soi gương. Mỗi đỉnh buộc vào lòng bàn tay và hai đốt ngón gần nhất, trọng số chuyển mềm qua mỗi khớp
  trong khoảng hơn một bán kính ngón, nên ngón cong chứ không gãy góc (trọng số dưới `1e-4` bỏ đi rồi chuẩn hoá lại cho tổng `1`); `skinHand` (linear blend skinning) và
  `smoothNormals` dời da khi số bàn tay đổi (`poseHand`), cỡ `0,2` ms một bàn tay, không đổi thì không làm gì.
- **Một lượt vẽ, vỏ viền lùi.** Vỏ viền dùng chung đỉnh đã dời và lùi ra xa máy dọc tia nhìn `HAND_INK_PUSH` (nhân
  cỡ bàn tay; `hullMaterial(…, push)`): chỗ trên hình giữ nguyên nên mép ngoài vẫn đậm, nhưng ở chỗ lõm — kẽ ngón
  khép, ngón cái vắt trước nắm tay — vỏ nằm sau mặt da nên không lòi thành vạch mực bên trong bàn tay. Nét bóng dáng
  hậu kỳ (`LIMB_SIL`) chỉ vẽ ở chỗ đổi vật nên không vẽ trong lòng bàn tay. Da tay chân vẽ cả mặt sau: ngón cái lấn
  vào ngón khác lúc cầm thì nhìn qua chỗ lấn thấy da, không thấy vỏ viền đen phía trong. Người nền `lod: "low"` dùng lưới thưa
  của cùng mặt ấy, `freeze` đóng băng dáng lúc ấy. Người que không vẽ ngón; xoay, gập, lệch cổ tay vẫn quay đồ
  cầm của người que 3D.
- **Nắm lại tròn đầy.** Khi ngón giữa gập ở gốc, cả bàn tay phồng bề dày (x, `HAND_FIST` `1,25` lần lúc nắm hẳn) quanh
  trục giữa lòng bàn tay, bề ngang giữ nguyên: nắm đấm tròn, nhìn từ trước hay từ mu tay đều phủ kín miệng tay áo, không
  lộ vành cổ tay áo quanh nó. Gốc ngón cái và ngón trỏ nằm trong bề ngang lòng bàn tay, lòng bàn tay thu ít về cổ tay: mép trên nắm đấm
  liền một đường, không gồ ở gốc ngón cái. Gốc bốn ngón so le theo độ dài (giữa xa nhất, út gần nhất) nên hàng đốt
  là vòng cung bốn gồ nhỏ; khớp ngọn chuyển trọng số qua gần hai bán kính ngón nên đốt ngọn cuộn tròn.

#### Dáng tay có tên

Dáng ngón soạn riêng, dùng lại được, là **dữ liệu**: `hands/<tên>.json` của repo video, qua `HandShapeSchema` /
`parseHandShape` (`core/handLibrary.ts`, `schemaVersion` là `HAND_SHAPE_VERSION` `1`):

```jsonc
{
  "schemaVersion": 1,
  "note": "giơ hai ngón trỏ và giữa thành chữ V",
  "fingers": [37, 78, 29, 31, 0, 0, 90, 100, 8, 0],  // mười góc ngón của HAND_DOF, bỏ turn, bend
  "fit": [0, 0, 0, 0, -90, -100, 0, 0, 0, 0]         // độ gập thêm từng đốt (HAND_FIT), bỏ trống là 0
}
```

- **Cùng nghĩa với kiểu cầm soạn tay** ([11](11-nhom-cam.md)): `fingers` mười góc ngón, `fit` gập thêm hai đốt mỗi ngón
  (cái, trỏ, giữa, áp út, út) — chỗ duy nhất tách được giữa, áp út, út khỏi góc chung, như chữ V ở trên.
- **Không phân bên.** Tay trái dùng cùng góc; bàn tay trái là gương của tay phải nên dáng ra đúng gương.
- **Tên file là tên dáng**: chữ thường, số, gạch nối (`HAND_SHAPE_NAME`), không trùng khoá `HAND_POSES` —
  `handShapeNameProblem` kiểm. Thư viện đi hai lớp như `held/`, repo trùng tên thì đè ([05](05-repo-video.md#hai-lớp)).
- **Dáng của lớp chung**: `peace` (chữ V, cũng là đếm hai), `count-3` (giơ trỏ, giữa, áp út), `tap` (ngón trỏ hơi cong
  gõ hay chạm màn hình), `scratch` (bốn ngón cong như vuốt để gãi). Cử chỉ có dáng có sẵn thì gọi thẳng dáng ấy, lớp
  chung không giữ bản trùng: giơ ngón cái `thumbsUp`, đếm một `point`, chỉ xuống là `point` với `fingers: "down"`, kẹp
  đầu ngón `pinch`, kẹp chén `cupPinch`. Hướng chỉ là việc của cổ tay ở mốc (`palm`, `fingers`, `turn`, `bend`), không
  phải dáng mới.
- **Lõi không đọc đĩa.** Chỗ nạp đưa thư viện vào `resolveScene` ở tham số thứ bảy (`HandShapes`, theo tên không đuôi),
  runtime giữ ở `rt.hands`. `shapeFingers(tên, thư viện, w)` ra hai mươi số ngón (mười góc rồi mười `fit`) của một dáng có
  sẵn hay của thư viện, hoà từ dáng nghỉ theo `w`.
- **Mốc tay của cảnh gọi dáng bằng `pose`** (`world.hands[].right|left.pose`, kèm `w`) — [03](03-scene.md#đích-bàn-tay-thế-giới).
- **Mốc bàn tay của hành động gọi dáng bằng tên** (`keys[].hand.armNear` / `armFar`, tên hay `pose`, kèm `w`, `turn`,
  `bend`) như dáng có sẵn: dáng của thư viện ra cả mười độ gập thêm, hoà sang mốc khác như góc (số gập thêm thiếu là
  `0`). `actionHandShapes` liệt kê tên của thư viện mà một hành động gọi. Tên không có trong thư viện thì `check` báo lỗi
  ở file hành động; `resolveScene` không ném mà cho dáng nghỉ — người que không vẽ ngón, chỗ nạp không có
  thư viện vẫn chạy được.
- **Studio 3D soạn dáng bằng mắt**: Dáng tay → chọn bàn tay không cầm đồ → **Chỉnh dáng tay này** (README của
  `apps/studio3d`).

### Món cầm tay

Món cầm tay là **dữ liệu**, không phải code three: `held/<món>.json` của repo video, qua `HeldItemSchema` /
`parseHeldItem` (`core/heldItem.ts`, `schemaVersion` là `HELD_VERSION` `4`, bản `2`, `3` không có `roles` nạp như bản `4`). Lớp chung có món mẫu `coc` (cốc quai), `tui`
(túi xách, [món treo](#món-treo)), `tui-du-lich` (túi có quai xách), `tui-deo` (túi quai cứng đeo vai, khoác khuỷu), `dien-thoai`, `khay`, `ly` (ly quai), `chen`, `binh` (bình rượu cổ thắt), `kep-ho-so` (kẹp hồ sơ, [kiểu cầm có tên](11-nhom-cam.md#kiểu-cầm-có-tên) `sheet/ap-bia`), `but`, `vali`, repo trùng tên thì đè ([05](05-repo-video.md#hai-lớp)). Bộ giải tay, `check`,
`scene_probe` và MCP cùng đọc file ấy, và bộ giải chạy trước code dựng cảnh của repo; code dựng lưới món đọc mốc từ chính
file ấy, nên mốc và lưới có một nguồn số.

**Món khai hình, không khai cách cầm**: hình va chạm `shape` (bắt buộc), mốc, mặt trước `front`, đầu trên `top`, phần có tên,
chỗ treo `seats`, vai trò `roles` cho bộ sinh (`binh` khai `pourer`, `coc`, `ly` khai `vessel`, `chen` suy `vessel` từ
hình — [13](13-vai-tro-do.md)) — schema đủ ở [11](11-nhom-cam.md#2-schema-món-heldmónjson-held_version-4). Cảnh khai chỗ cầm theo **nhóm
hình dáng** (`món@nhóm`, [03](03-scene.md#đồ-cầm-tay)); rig suy khối hình từ `shape`, tự dựng chỗ tiếp xúc, cổ tay, khuỷu
và ngón — [11](11-nhom-cam.md). Phần lõi: `core/heldGeom.ts` (khối hình), `graspGroups.ts` (bảng nhóm), `graspSolve.ts`
(chỗ tiếp xúc, giải lựa chọn), `graspArm.ts` (khuỷu tự nhiên `E(φ)`, [11](11-nhom-cam.md#khuỷu-tự-nhiên)), `holdLink.ts`
(liên kết tay ↔ món cho `act3.ts` và `attach.ts`), `arm3.ts` (khung xương và luật đọc góc mà các file trên cùng đọc).
`AIM_GAP` (`6`, `core/constants.ts`) là ngưỡng không tới của cả đích theo mốc, tay phụ và chỗ cầm nhóm.

```jsonc
// held/dien-thoai.json — khung món: y lên, +z mặt trước, đơn vị rig (×0,01 ra three của người cao 4,3)
{
  "schemaVersion": 4,
  "size": [18, 36, 3.5],
  "front": "screen",
  "top": "top",
  "anchors": {
    "screen":  { "at": [0, 0, 1.75], "dir": [0, 0, 1] },
    "back":    { "at": [0, 0, -1.75], "dir": [0, 0, -1] },
    "top":     { "at": [0, 18, 0], "dir": [0, 1, 0] },
    "speaker": { "at": [0, 15, 1.75], "dir": [0, 0, 1] }
  },
  "shape": [{ "box": [18, 36, 3.5], "round": 1.5 }]
}
```

| Trường | Nghĩa |
|---|---|
| `size` | Hộp bao của món |
| `anchors` | Mốc có tên: điểm `at`, pháp tuyến ra ngoài `dir` (cần cho `front`, `top`, trục ý định) |
| `hang` | Tên các nhóm con của lưới món quay theo phương đứng mỗi khung: chùm chìa thõng, dòng rượu rót |
| `shape` | Hình va chạm của món: hợp các khối (dưới). Ngón ôm theo nó và luật `held` đo trên nó |

**Chỗ cầm là liên kết cứng tay ↔ món.** `graspFrame` (`core/graspSolve.ts`) dựng chỗ tiếp xúc của nhóm trên hình món ra
bàn tay cầm trong khung món (dáng, điểm nắm, lòng tay, ngón); `graspLink` (`core/heldItem.ts`) tìm phép quay đưa lòng tay,
hướng ngón ấy về lòng tay, ngón của bàn tay rồi dời cho điểm nắm trùng tâm nắm của dáng: ra một ma trận cố định món trong
khung bàn tay (`GripFrame`), không có `offset` / `rotate` Euler. Đúng với mọi cỡ tay (`HAND_GRIPS` nhân `k`, `long` của
từng người). Tay trái không soi gương món: lòng tay ở phía kia, nên ngón cái tự sang cạnh kia và chữ trên màn không ngược.

**Ý định** của tay dẫn (`face`, `up`, `roll` của chỗ cầm, hay hướng mặc định của nhóm — [11](11-nhom-cam.md#4-schema-cảnh))
nói món quay về đâu; trục là tên mốc (lấy `dir`) hay vectơ khung món:

- `face: { axis, toward, tilt? }`, trục chính. `toward`: `camera` (mắt ống kính), `holderFace` (mặt người cầm), `up`,
  `down` hay tên hệ thân khác của `PALM_DIRS`, vectơ hệ thân, `{ cast: "<id>", mark? }` (mặt người 3D khác, hay `mouth`,
  `chest`, `belly` của người ấy — ước từ chỗ đặt và góc cúi thân, không đọc đầu quay), `{ mark }` (mốc thân của chính người
  cầm). `tilt` (độ) quay hướng đích lên trong mặt phẳng đứng chứa nó, âm là xuống.
- `up: "<mốc>"`, viết tắt `face: { axis, toward: "up" }`: chén, ly đứng.
- `roll`, trục phụ chốt độ lăn (đầu máy lên trên). Không có thì giữ độ lăn gần bàn tay đang có.

Rig giải ý định trên cổ tay (`aimWrist`): trục chính trọng số `1`, `roll` `0,3`; khuỷu giải bằng `E(φ)` quanh hướng ưu tiên
hay `elbow` đã khai ([11](11-nhom-cam.md#khuỷu-tự-nhiên)). Giới hạn cổ tay giữ nguyên — xoay `±90`, gập `AIM_BEND` (ngửa
`60`, gập `70`), lệch `AIM_DEV` (về ngón út `30`, về ngón cái `20`), kẹp liền trên vòng, kênh tay không nâng thì lệch cổ tay
giữ `0` —: không đạt thì món lệch thật, `AimReport.hold` ghi trục, hướng muốn, hướng đạt, góc
còn lệch và khớp kẹp, `check` báo ([03](03-scene.md#đồ-cầm-tay)). Vị trí tay (`at`, `to`, `point`) luôn thắng ý định. Cổ tay
và khuỷu của tay mang món, tay phụ đi từ nghiệm của mẫu trước với tốc độ có hạn (`HOLD_SLEW`, `HOLD_SWIVEL_SLEW`; khuỷu khoá
`elbowLock` không dò, không giới hạn): ý định
vượt tầm thì cổ tay sang nghiệm mới trong vài khung chứ không lật trong một khung ([03](03-scene.md#đồ-cầm-tay)). Món đặt
trước (lần cầm có mốc món ở `items`) không giải ý định: hướng món do cảnh khai, bàn tay theo món
([11](11-nhom-cam.md#5-giải-tay-theo-món)).

**Hai tay.** Chỗ cầm khai `both`: món cứng theo tay dẫn, tay kia là tay phụ đặt ở chỗ cầm mặc định của nhóm trên món
([11](11-nhom-cam.md#tay-phụ-both)). Tay phụ không với tới thì món không trôi theo nó, `check` báo. Hai tay cùng khai một
món không `both` là đổi tay: tay khai trước mang món, tay kia với tới chỗ cầm của chính nó trên món; tay cũ `hold: null` thì
món sang tay mới.

**Gắn món** (three, `attach.ts`): `hold(fig, vật, { hand, grip: { item, spec, grip, hold } })` treo món vào chỗ treo bàn
tay bằng liên kết của lần cầm `hold` (`holdLinkFrame`), đặt dáng của chỗ cầm (tay phụ giữ dáng của nó), ghi
`Figure.holding` có `item`, `grip`; `follow`, `offset`, `rotate`, `pose` đi cùng `grip` là lỗi. Cảnh không gọi `hold` tay mà
khai `world.hands[].hold` và đăng ký món bằng `cast.provide`, rig gắn và gỡ ([03](03-scene.md#đồ-cầm-tay)).

#### Hình va chạm của món

`shape` là hợp các khối đơn giản, khung món, đơn vị rig — đủ sát lưới hiện hình ở vùng bàn tay với tới:

| Khối | Trường |
|---|---|
| Hộp | `{ "box": [rộng, cao, sâu], "at"?: tâm, "round"?: bo cạnh (không quá nửa cạnh ngắn) }`, thẳng trục khung món |
| Trụ, trụ côn | `{ "cyl": bán kính ở from, "from": điểm, "to": điểm, "r2"?: bán kính ở to }` — vai bình, thân chén, que nghiêng |
| Ống rỗng | trụ kèm `"wall": dày` (nhỏ hơn bán kính): hở hai đầu — miệng chén, vòng chìa |
| Cầu | `{ "ball": bán kính, "at"?: tâm }` |

```jsonc
"shape": [
  { "cyl": 13, "from": [0, -32, 0], "to": [0, -14, 0] },              // thân bình
  { "cyl": 13, "from": [0, -14, 0], "to": [0, -2, 0], "r2": 8 },      // vai
  { "cyl": 4, "from": [0, 8, 0], "to": [0, 14, 0] }                   // cổ
]
```

`heldDistance(shape, p)` (`core/heldFit.ts`) là khoảng cách có dấu tới hợp ấy (dương ở ngoài). Repo video tự kiểm hình
khớp lưới: đỉnh lưới quanh chỗ nắm không lồi ra ngoài hình, mặt hình không thừa ra ngoài lưới quá một hai đơn vị —
hình nhỏ hơn lưới là ngón lún vào lưới mà `check` không thấy, hình to hơn là ngón dừng lơ lửng.

#### Ngón ôm theo đồ

Dáng của chỗ cầm chỉ là điểm xuất phát. Mỗi khung, `heldFit` đo chỗ món trong khung bàn tay rồi chỉnh từng ngón độc lập,
hai đốt mỗi ngón (`HAND_FIT`: độ gập thêm cộng vào góc ở gốc đốt; ngón cái cũng thế, dạng và đối của nó giữ nguyên), theo
vai trò ngón của nhóm ([11](11-nhom-cam.md#6-ngón)):

1. Ngón `wrap`, `press` mà còn hở: cuộn hai đốt cùng lúc tới khi một đốt chạm (khe da `HELD_FIT.touch`, ép nhẹ); ngón `wrap`
   rồi cuộn riêng đốt ngọn tới khi nó chạm. Không chạm trong tầm cuộn của vai trò thì giữ dáng.
2. Mọi ngón: đốt gốc lún quá `HELD_FIT.sink` thì mở ra hay gập vào, phía nào tới chỗ vừa chạm gần hơn; rồi đốt ngọn.
   Gốc đốt đã ở trong món (khớp ngón, lòng tay lún) thì đốt chỉ cần không lún hơn gốc.

Số gập thêm ở trong `HandVec` sau `HAND_DOF` (mười số theo `HAND_FIT`); `handFrames`, da và nang bàn tay đọc chúng,
`handGripOf` không (tâm nắm vẫn theo dáng). Tính theo cỡ tay từng người (`k`, `long`), chỉ từ khung đang vẽ: Remotion vẽ
khung nhảy cóc vẫn ra cùng hình. Tay phụ của `both` và tay đổi tay cũng ôm (chỗ món trong khung bàn tay đo từ ma trận
thế giới).

Ngón chỉ cuộn quanh khớp của nó, không dời được bàn tay: lòng tay hay khớp ngón nằm trong món thì `check` báo
`held:pierce`, `held:sink` ([11](11-nhom-cam.md#7-luật-check-nhóm-held)).

**Đường cũ.** `hold` không `grip` — `follow` (`wrist`, `level`, `tilt`), `offset`, `rotate`, `pose`, ý định repo khai ở
`userData.hold` — đánh dấu `@deprecated` và vẽ đúng như các bản trước, để cảnh đã duyệt không đổi hình; `check` kể chúng
ở nhóm `legacy` ([05](05-repo-video.md#nhóm-luật)).

#### Món treo

Món treo trên cánh tay chứ không nằm trong bàn tay — túi khoác khuỷu, túi đeo vai — là chỗ cầm nhóm `carry`
([11](11-nhom-cam.md#13-carry--treo-bản-đầu)): cảnh khai `{ "item": "tui", "group": "carry", "on": "elbow" }`, món khai
đỉnh quai của từng cách treo ở `seats`:

```jsonc
// held/tui.json (món mẫu của lớp chung): thân túi 30 × 26 × 10 ở y 0–26, hai quai, mép dưới thanh ngang của quai ở y 74
{
  "schemaVersion": 4,
  "size": [30, 74, 10],
  "front": "mat",
  "top": "quai",
  "anchors": { "quai": { "at": [0, 74, 0], "dir": [0, 1, 0] }, "mat": { "at": [0, 13, 5], "dir": [0, 0, 1] } },
  "seats": { "elbow": "quai", "shoulder": "quai" },
  "shape": [{ "box": [30, 26, 10], "at": [0, 13, 0], "round": 2, "part": "than" }]
}
```

| Trường | Nghĩa |
|---|---|
| `on` (cảnh) | `elbow`: quai vắt ở mặt trong chỗ gập khuỷu, thanh quai vắt qua là cẳng tay. `shoulder`: quai trên đầu vai, ngoài khớp vai `0,75` bán kính cánh tay (`SHOULDER_OUT`, chỗ vai mỏng nhất theo chiều trước – sau), cánh tay luồn qua quai — dang tay thì món thõng giữa cánh tay và thân |
| `seats[on]` (món) | Mốc của món đặt đúng vào chỗ treo: đỉnh quai, mặt trong (mặt áp lên tay, lên vai) |
| `parts.<phần>.strap` (món) | `true`: các khối `shape` của phần ấy là **quai** — không tính vào thân món, không vào khối hình của nhóm cầm (`itemGeom`); rig dời món tới khi quai tựa lên người |
| `yaw` (cảnh) | Quay thân món quanh phương đứng (độ, dương là ngược chiều kim đồng hồ nhìn từ trên xuống) |
| `touch` (món, cảnh) | Phần người được lấn vào thân món; `{ part, max }` cho lấn tới `max` (đeo vai: `{ "part": "upperArm", "max": 2 }`) |

Món treo không có lòng tay, ngón, ý định (`face`, `up`, `roll`, `both` là lỗi), và món phải có `shape`. Thân món là
các khối không thuộc phần `strap`. Quai cứng (túi hiệu: dải da cong) khai thành phần `strap` — chuỗi trụ `cyl` dọc dải
quai — để rig đặt quai **trên** tay, trên vai; món không khai quai thì đỉnh quai nằm đúng chỗ treo, quai vẽ ra có thể
lún vào người.

**Treo mỗi khung** (`carry` của `attach.ts`, `carryFrame` của `core/heldCarry.ts`):

1. Chỗ treo `carrySeat` trên người đã đặt dáng. Khuỷu: `elbowSeat` dời khớp khuỷu theo phân giác hai đoạn tay một bán kính
   cẳng tay (tay gần thẳng thì về phía trên cẳng tay), kèm góc khuỷu `bend` (`180` thẳng) và độ ngóc cẳng tay `rise`. Vai:
   điểm cố định trong hệ thân, tính một lần từ tia dọi xuống mặt thân áo.
2. Món thõng: đỉnh quai (`seats[on]`) trùng chỗ treo, trục y của món lên thẳng, mặt trước (+z) theo hướng nằm ngang của thanh quai — cẳng tay
   ở khuỷu (túi chĩa mặt theo cẳng tay), trục vai ra ngoài ở vai (túi áp mặt vào sườn) —, quay thêm `yaw`. Vai: điểm
   ngoài khớp vai `SHOULDER_OUT` bán kính cánh tay, trên mặt thân áo hay mặt cầu khớp vai, lấy chỗ cao hơn.
3. Món có quai (`strap`): quai thành chuỗi viên (`strapBalls`), món dời theo từng luật tựa tới khi không viên nào trong
   người (`carryFrame`, `rest`); thân món vẫn đứng thẳng. Khuỷu: nâng thẳng đứng khỏi cẳng tay, trượt ngang dọc cẳng tay
   ra khỏi cánh tay trên. Vai: nâng thẳng đứng khỏi vỏ thân áo (lưới cột dọc trong hệ thân, tính một lần mỗi người) và
   cánh tay trên. Đoạn dời ghi ở `Carrying.fit.shift`; `check` đo `seat` tới chỗ treo đã dời.

**Thân món không đẩy khỏi người.** Món luôn thõng đứng dưới chỗ treo; thân món lồng vào thân áo, hông, váy, đùi hay cánh
tay thì `check` báo `body` và cảnh sửa dáng tay (khuỷu, cổ tay ra ngoài — [03](03-scene.md#đồ-cầm-tay)). Khe chỉ đo ở
`heldCarries` (`check`, `scene_probe`): đám điểm trên mặt lưới thân áo, khối hông, váy và nang các chi (`carryBody`), đo một
lần ở dáng của khung, lần đặt món mỗi khung không đo.

Mọi bước chỉ đọc tư thế của khung đang vẽ: Remotion vẽ khung nhảy cóc vẫn ra cùng hình. Món không đung đưa theo quán tính.
Nhóm mang món chỉ giải lại khi người khác lần giải trước (`poseKey`: ma trận thế giới mọi nút của người, độ dài đoạn chi):
vẽ lại cùng khung (camera quay, các lượt bóng) không giải; dáng đổi ở cùng giây (cảnh sửa tại chỗ)
thì giải lại, không có nhớ nào phải xoá tay. Lúc `act` đang đặt dáng (`Figure.posing`) thì không giải.

**Bàn tay tự do.** Bàn tay của tay treo món theo hành động (hay `world.hands`): không dáng nắm, không ý định, không vai trò
với bộ giải (`holdRoles` bỏ qua lần treo), `Figure.holding` không ghi gì; món treo ghi ở `Figure.carrying[side]`. Tay kia
cầm món khác, kể cả kiểu hai tay (`both`): lần treo không chiếm bàn tay. Nhóm mang món treo khai `userData.touch` cánh tay
trên và cẳng tay của tay ấy (quai vắt qua) và thân (luật `body` đo thân món trên mặt thân áo, sát hơn nang thân của `clash`), cộng `touch` của món và của chỗ
cầm. Cảnh khai ở `world.hands[].hold` ([03](03-scene.md#đồ-cầm-tay)); gọi tay thì `carry(fig, vật, { hand, grip })`, `hold`
nhận `món@carry` thì chuyển sang `carry`.

### Hướng lòng bàn tay

`actPalms(nhân vật, scenePose)` (`core/act3.ts`) trả hai bàn tay (`R` phải, `L` trái người) đúng như
three vẽ, trong toạ độ thế giới rig: cùng khung `Rw = Re · wristTurn` của `actJoints`, `act3.test.ts` giữ
trùng với khớp cổ tay three. Trong khung bàn tay của `handFrames`, ngón mọc theo −y và gập về phía
`−side · x` — đó là pháp tuyến lòng tay. Chỉ người mặc đồ có bàn tay; người que thì không có gì.

| Trường | Nghĩa |
|---|---|
| `palm` | Pháp tuyến lòng tay, vectơ đơn vị: hướng lòng tay quay về |
| `finger` | Hướng dọc bàn tay, từ cổ tay ra đầu ngón |
| `at` | Tâm lòng bàn tay |
| `skin` | Tám điểm ngoài cùng của bàn tay theo dáng đang vẽ: giữa lòng tay, giữa mu tay, hai mép lòng bàn tay, đầu ngón cái, trỏ, giữa, út (trên trục đốt) |
| `forward`, `out` | Hướng mặt người nằm ngang, hướng ngang từ thân ra phía tay ấy |

`palmFace` (`core/palm.ts`) đọc ra lòng tay quay về đâu — trục trội trong `PALM_FACES`: `úp` / `ngửa` theo
hướng xuống của thế giới, `ra trước` / `ra sau` theo hướng mặt nằm ngang, `vào thân` / `ra ngoài` theo phía
tay ấy — và góc lệch khỏi úp (`down`, độ).

- **Đừng phán hướng lòng tay bằng mắt.** Bàn tay vài chục pixel, mu và lòng tay cùng màu da. Đặt tay lên
  một mặt (quầy, sách, bàn phím, bàn) hay đổi `turn`, `elbow` xong thì đọc `world.palms` của `scene_probe`
  ([04](04-mcp.md#người-3d)): tay đặt trên mặt ngang phải `úp` (`down` dưới `45`), `on` và `gap` cho biết
  vật dưới bàn tay và khe từ điểm thấp nhất của bàn tay tới nó; tay buông thì lòng tay quay vào đùi —
  đứng thẳng là `vào thân`, cúi chào với bàn tay trước đùi là `ra sau`.
- **Sửa bằng `palm`, không bằng `turn`.** Khai `palm: "down"` ở `keys[].hand` (hay ở `world.hands`) là lòng tay úp ở mọi
  hướng khuỷu ([Hướng lòng tay theo ý](#hướng-lòng-tay-theo-ý)). Còn giữ `turn` thô thì sửa hướng khuỷu trước: khai `elbow`
  ra ngoài như `arms-on-table-3d` (`[-0.3, 0.3, 1]`) rồi chỉnh `turn` (dương là sấp, lòng tay úp thêm khi cẳng tay chĩa ra trước).
- `check` không đo lòng tay và ngón: soi và sửa ở Studio 3D — [03](03-scene.md#lòng-bàn-tay). Khuỷu rung, lật, gập ngược
  và bàn tay lật thì đo — [03](03-scene.md#khuỷu-và-cổ-tay-trên-hình).

### Khớp người 3D vẽ ra

Sân khấu three đặt người que bằng `act` (`packages/rig/src/act.ts`); `actJoints(nhân vật, scenePose)`
của lõi (`core/act3.ts`) trả đúng các khớp ấy trong toạ độ thế giới rig, không cần `three` — `check`
đo giật tay chân trên chúng ([03](03-scene.md#giật-trên-hình)). Hai bên dùng chung (khung xương, luật đọc góc và `twoBone3`
ở `core/arm3.ts`; `core/act3.ts` xuất lại chúng và giữ `actReach`, `actJoints`):

- **Khung xương** `bones3(rig.height)` (đơn vị three, tức rig chia 100), gốc vai và gốc chân
  `roots3(áo, rig, { clad, sleeve, trouser, bicep, skirt })` cùng góc tay choãi của nó, tâm đầu `head3(khung, human)` — `stickman.ts` dựng người que từ
  chúng, `Figure.bones` giữ khung của người ấy. `BONES3` là khung ở `height = 1`.
- **Luật đọc góc** `actAngles`: kênh nâng đọc góc soạn ở `side` và số dang, kênh không có cờ về dáng
  nghỉ (tay buông `[0, 0]`, chân thẳng, ngồi thì đùi `[90, −90]`, không dang). `actTwist` đọc xoắn vai và
  lệch cổ tay theo cùng cờ; `actHand` đọc bàn tay (`pose.hand`, không cần cờ).
- **IK** `actReach`: đích hệ thân rồi đích thế giới, hoà trên vị trí cổ tay, hướng khuỷu kéo theo
  phần đích, giải hai đoạn bằng `twoBone3`; `armFrame` dựng hướng cánh tay trên từ trục bản lề của IK
  và góc gập khuỷu — [Đích bàn tay](#đích-bàn-tay).

| Đoạn | three | Nhân `rig.height` |
|---|---:|---|
| `torso` (hông → khớp cổ) | `1,2` | có |
| `neck` | `0,08` | có |
| `upperArm` / `foreArm` | `0,62` / `0,58` | có |
| `thigh` / `shin` | `0,78` / `0,92` | có |
| `head` (bán kính sọ) | `0,64` | không |
| `limb` (nửa bề dày nét người que) | `0,042` | không |
| Khớp cổ → tâm đầu `head3` | `neck + 0,09 + head · 1,04`, đầu `human` thêm `HUMAN_NECK` `0,1` | chỉ phần `neck` |

**Sáu đoạn là `lengths(height)` của lõi chia 100.** Hông người 3D lấy thẳng `world.hip`, mà `sceneAt`
đặt hông cho bàn chân thấp nhất chạm sàn bằng `feet(pose, height)` — chân 3D phải dài đúng chừng ấy,
lệch là chân lún, lơ lửng hay trượt khi đi theo `path`. Gốc vai người que ở `torso · height −
shoulderDrop`, thân áo dựng khối (`profile`), váy và đích tay hệ thân (`actReach` như `reachToWorld`)
cũng đọc `height`; đầu, khoảng đáy sọ → đỉnh cổ và bề dày chi giữ nguyên.

Phần còn lại — chuỗi biến hình gốc → hông → thân → vai → khuỷu → cổ tay → bàn tay, thứ tự góc Euler của
từng khớp (vai `ZXY`: dang · gập · xoắn; khuỷu chỉ gập; cổ tay `YZX`: xoay cẳng tay · gập · lệch) —
`actJoints` tính lại bằng ma trận. `hand` của nó là chỗ treo đồ cầm: tâm nắm `handGrip` của người mặc đồ, mút
nét tay của người que; `act3.test.ts` dựng người que three thật và giữ hai bên
trùng nhau tới `1e-6` ở mọi kiểu tư thế (kênh nâng lẫn không, dang, xoắn vai, lệch, xoay và gập cổ tay, nghiêng
thân, đích hệ thân, đích thế giới, ngồi, lật, `height` khác `1`).
Đổi khớp hay thứ tự quay ở `act`/`stickman.ts` thì đổi cùng `actJoints`, test đỏ là lệch. `actPalms` đọc
cùng phép tính ấy cho hướng lòng bàn tay ([Hướng lòng bàn tay](#hướng-lòng-bàn-tay)).

`armPierce(nhân vật, scenePose)` (`core/pierce.ts`) đo tay xuyên thân áo trên các khớp ấy: thân là
khối tròn xoay dẹt của `torsoMesh` dựng lại không cần `three` — nửa rộng theo `profile` của áo, tiết
diện ngang hai nửa ellipse của `torsoSection` (nửa trước ngực, bụng phệ, nửa sau lưng; người mặc đồ: sườn áo lùi
cho tay và dày `CLAD_DEPTH`, `cladProfile` trên chỗ trống `roots3`), gắn ở hông theo trục hông → cổ, cả người nhân `world.s`
([10](10-lop-ve-code.md#tay-xuyên-thân)). Đổi cách `torsoMesh` dựng thân thì đổi cùng `armPierce`.

`figure3d` là hình học cho mốc `anchorAt` và khối đo của `check`, không phải của three: hai đường trùng
nhau ở kênh nâng (trừ tay choãi và độ nhấc hông nửa bề dày chi), khác nhau ở kênh không có cờ.

### Mặt người 3D

Nét mặt của người 3D vẽ trên canvas dán trên sọ nên quay đúng theo đầu. Mốc mặt của `anchorAt`
(`face`, `eyeNear`, `eyeFar`, `mouth`) thì chạy theo một đường cong ăn gian để hiệu ứng bám vào
mặt luôn đọc ra mặt, theo góc quay của đầu so với ống kính (`theta` cộng `lắc`):

| Góc quay | Mốc mặt |
|---|---|
| tới `FACE_TRUE` (40°) | Chiếu thật trên sọ, hai mắt |
| 40°–95° | Chạy chậm hơn đầu (`faceYaw`): mắt gần tới chỗ ghim `SIDE_EYE` ở 90°, `REAR_EYE` ở `REAR_YAW` |
| `FACE_REAL_FROM` (95°) → +`FACE_REAL_SPAN` (120°) | Trượt dần về chỗ chiếu thật, tức là trôi ra mép đầu |
| trên 120° | Chiếu thật |

Nét đã quay quá mép trôi tiếp ra ngoài viền (`facePoint`) thay vì vòng ra sau, nên mốc đi một
chiều suốt vòng quay, không giật ngược.

| Hằng số | Giá trị | Nghĩa |
|---|---:|---|
| `FACE_TRUE` | 40 | Mốc mặt chiếu thật tới góc quay này, quá nữa thì chạy chậm hơn đầu |
| `FACE_REAL_FROM` | 95 | Từ góc quay này mốc mặt trượt dần về chỗ chiếu thật |
| `FACE_REAL_SPAN` | 25 | Đoạn trượt về chiếu thật dài bấy nhiêu độ |
| `SIDE_EYE` | 0.74 | Chỗ ghim ở 90°: mắt cách tâm đầu bấy nhiêu lần nửa trục ngang, về `+x` |
| `REAR_EYE` | 0.86 | Chỗ ghim ở `REAR_YAW`: mắt cách tâm đầu bấy nhiêu lần nửa trục ngang, về `+x` |
| `REAR_YAW` | 120 | Góc quay của chỗ ghim `REAR_EYE` |
| `SIDE_EYE_OVAL` | 0.7 | `eyeMarks` vẽ một mắt (`only`) mà không truyền `squash` thì hình tròn của mắt bóp ngang còn bấy nhiêu |
| `BROW_ABOVE` | 18 | Lông mày cao hơn mắt bấy nhiêu px |

### Chân dung

`portrait(character, o)` của `@stickman3d/rig` chụp người 3D ra canvas cho lớp vẽ code: đầu trong bong bóng,
icon trên slide giải thích, mặt dán lên đồ (`canvasTexture` / `decal`). Nó dựng một người riêng từ JSON đã
qua `parseCharacter` trên sân khấu trống, không cần cảnh hay ống kính của cảnh.

- **Khung tự ôm.** `frame: "head"` ôm mọi đỉnh lưới của nhóm đầu (sọ, tóc, kính, đồ đội) cộng lề `pad`
  (mặc định `0,08` phần cao). `"bust"` thêm thân áo từ cổ xuống `BUST_CUT` (`0,55`) chiều cao thân tính
  từ hông; mép dưới nằm đúng ở mặt cắt, không lề, phần nới cho đủ tỉ lệ `w`×`h` dồn xuống dưới.
- **Góc.** `yaw` độ, `0` nhìn thẳng ống kính, dương là mặt nhìn sang phải khung; `pitch` nâng ống kính.
  Ống kính đặt xa (15 đơn vị three, góc nhìn hẹp) nên gần như không méo phối cảnh.
- **Nét mặt và dáng.** `face` đặt khẩu hình, mắt, mày, má ửng thêm; `acting` là một khung của `sceneAt`, mang cả dáng
  đầu, thân và nét mặt (khi ấy `face` bị bỏ qua). Không chớp mắt.
- **Nền trong suốt** (`background: null`, mặc định): chụp hai lần trên nền đen và nền trắng với
  `render({ paper: false })` — tắt hạt giấy và tối góc để màu mỗi điểm ảnh chỉ trộn tuyến tính với nền —
  rồi lấy alpha từ hiệu hai lần: mép nét mực mềm theo alpha, đặt lên nền màu nào cũng sạch.
  `background: "#…"` là chụp một lần trên nền màu ấy.
- **Cache.** Cùng nhân vật và tham số thì trả cùng một canvas, nên chỉ đọc hay chép nó, không vẽ đè lên.
  Mỗi ảnh mở rồi đóng một context WebGL; chụp nhiều thì truyền `renderer` dùng chung.

App Remotion của repo video có sẵn `useChanDung` / `<ChanDung>` ở `src/khoi3d/ChanDung.tsx`
([05](05-repo-video.md#init-sinh-ra-gì)) bọc hàm này kèm `delayRender`.

### Người 3D mặc đồ

Hai cờ độc lập của JSON nhân vật đổi người que three thành người hoạt hình đầu to đọc ra người thật:
`head.form: "human"` cho dáng đầu, `palette.clad: true` cho tay chân có màu, bàn tay, giày và khối
hông. Không khai thì người 3D là người que, từng điểm ảnh.

```json
"head": { "form": "human" },
"palette": { "clad": true, "sleeve": "#3aa89c", "trouser": "#3b4252" }
```

| Trường | Mặc định | Người 3D |
|---|---|---|
| `head.form` | `"sphere"` | `"human"`: đầu chibi — má phính, cằm chữ U, cổ, tai, mắt to có đốm sáng, má hồng |
| `palette.clad` | `false` | Tay chân là ống màu có vỏ viền, bàn tay, giày, khối hông có mông |
| `palette.sleeve` | `#1a1a1a` | Màu tay áo |
| `palette.sleeveLength` | `1` | Phần tay phủ màu tay áo tính từ vai, `0..1`; phần còn lại màu da. `1` có cổ tay áo, quanh `0,25` là áo ngắn tay |
| `palette.trouser` | `#1a1a1a` | Màu quần, dưới váy là màu tất |
| `palette.trouserLength` | `1` | Phần chân phủ màu quần tính từ hông; `0` là chân trần dưới váy |
| `palette.shoe` | `#2b2623` | Màu giày |
| `palette.bicep` | `0` | Gốc cánh tay to thêm bấy nhiêu phần: vai, bắp tay lồi khỏi sườn áo; nam quanh `0,35`, `0,7` là vạm vỡ |
| `palette.sleeveWidth` / `trouserWidth` | `15` / `17` | Bán kính chi `(w + rig.stroke) / 2` px — đúng `limbHalf` của lõi; bỏ trống lấy `LIMB_WIDTH.clad` (`limbWidths`), vạm vỡ quanh `19` / `22` |
| `palette.sleeveFlare` | `0` | Tay áo loe: miệng tay áo rộng hơn cổ tay bấy nhiêu px (bán kính); bàn tay giữ cỡ theo `sleeveWidth` |

- **Đầu `human` là đầu chibi nặn từ mặt cầu.** `humanSkull` (`core/humanHead.ts`) nhận một điểm
  của sọ đơn vị (y lên, z ra trước mặt) và trả điểm trên đầu: nửa trên giữ nguyên, nửa dưới nở
  ngang về phía đáy (`jaw`) thành má phính và quai hàm tròn, kéo dài (`drop`), vạt đáy thành cằm chữ U
  rộng (`flat`), hơi dời ra trước (`chin`) và thu gáy (`nape`); không có mũi. Mọi số nhân bình phương
  độ sâu dưới xích đạo nên viền đầu không gãy ở chỗ nối. Đầu ngồi cao hơn đầu cầu `HUMAN_NECK`
  (`head3`, `actJoints` cùng đọc): một đoạn cổ da lộ ra giữa cằm và cổ áo. Vỏ viền dưới cằm chìm sau
  cổ và cổ áo nên sọ có thêm nét bóng dáng dò ở hậu kỳ (`npr({ ink })`).
- **Nét mặt chibi nằm trên mặt nặn.** Lưới nét mặt đi qua cùng `humanSkull` nên mồm, nếp nhăn theo
  má ở mọi góc quay. `CHIBI` (`core/face.ts`) cộng vào `face` của JSON nhân vật: mắt hạ `10`, hai mắt
  giãn thêm `18`, mồm gần mắt `10` px (`chibiShape`) — kính và `headFit` đọc chỗ mắt đã dời. Mỗi mắt
  phóng `1,45` lần quanh tâm của nó, bóp ngang `0,75` thành bầu dục đứng, con ngươi đang mở có đốm
  sáng (`eyeShine`) — `wide` không có, lòng trắng giữa đã là chỗ sáng; con ngươi `bulge` và chấm con ngươi
  `wide` to hơn của người que (`pupil` `0,85` thay `0,7` lần `EYE_R`);
  mồm thu `0,8`, mày nhấc `3` px. Cỡ mắt, độ bóp và đốm sáng nhân theo [nét mặt riêng](#nét-mặt-riêng) của
  nhân vật. Má ửng theo `face.blush` của nhân vật,
  không theo dáng đầu — [Má ửng](#má-ửng).
- **Tóc dựng khối dời theo sọ.** Mỗi đỉnh tóc dời đúng bằng điểm sọ bên dưới nó (`humanHair`): tóc
  giữ bề dày, gáy thu thì tóc gáy thu theo, tóc rủ không xuyên quai hàm. Kính và `headFit` đọc nửa
  trên nên như đầu cầu. Tai ẩn khi tóc phủ chỗ tai (tia từ ngoài vào tâm tai chạm vỏ tóc hay tóc rủ).
  [Mũ dựng khối](12-trang-phuc-3d.md#mũ-dựng-khối), [trâm cài búi](12-trang-phuc-3d.md#trâm-cài-búi) và
  [bông tai](12-trang-phuc-3d.md#bông-tai) chỉ có ở người 3D; bông tai bám dái tai, tóc phủ tai thì che nó.
- **Vai liền tay.** Khớp vai của người mặc đồ ở `garmentSocket` (`core/torso.ts`): tâm vòng tròn bán
  kính gốc ống cánh tay (`cladArm`) nội tiếp góc giữa vát vai và sườn áo của mặt khối; vát vai là
  `cladSlope` của kiểu áo, thoải hơn `slope` của người que ([12](12-trang-phuc-3d.md#thân-áo-dựng-khối)). Nắp ống tay
  tiếp xúc cả hai, viền vai đi liền xuống mép ngoài cánh tay, không khấc. Khớp cao hơn và lùi vào so
  với người que (`shoulderDrop` không dùng) — `act` và `actJoints` cùng đọc `roots3` nên vẫn trùng.
  `bicep` nhân gốc ống tay `1 + bicep` và nở vòng ấy từ đúng điểm tiếp xúc vát vai: vai và bắp tay lồi
  ra ngoài sườn áo mà viền vẫn liền, khớp vai thấp xuống theo.
- **Thân áo nhường chỗ cho tay.** Bề ngang vai của người mặc đồ là thân cộng hai cánh tay, như khớp vai
  người thật nằm ngoài lồng ngực: dưới tâm gốc vai, sườn áo lùi tới cách mép trong khuỷu tay buông một
  `CLAD_GAP` (`2` px), chuyển êm trong bán kính nắp vai (`cladProfile`); dưới khuỷu sườn áo được nở theo
  mép trong cẳng tay (`armSide`, `armInner`), nên áo suông hay hông rộng thành dáng quả lê mà không lấn
  vào tay. `roots3` trả chỗ ấy ở `room`; thân áo, nét, khuy, khối hông và va chạm dựng theo mặt cắt đã lùi.
  Góc vai giữ nguyên nên nắp tay vẫn ôm góc vai. Nửa bề sâu từng hàng là `CLAD_DEPTH` (`0,95`) lần nửa
  rộng — dày hơn `TORSO_DEPTH` của người que — nhưng không quá `CLAD_DEPTH · armSide`, nên dưới vai ngực và lưng
  phẳng một mạch; trên ngang ngực bề sâu theo `chestDepth` như người que ([12](12-trang-phuc-3d.md#ngực-và-lưng-nhìn-nghiêng)). Từ khớp hông (gấu cao hơn thì từ gấu) xuống gấu, sườn áo
  không hẹp hơn mép ngoài gốc đùi ở độ cao ấy cộng `THIGH_CLEAR` (`1` px), kể cả ở góc bo gấu, nở dần trong `THIGH_RAMP`
  (`12` px) phía trên: tay buông sát hông đặt sườn áo đúng mép đùi, mặt đùi trùng mặt thân thì lòi qua góc gấu thành chấm
  mực; tay buông vẫn cách sườn áo ít nhất `CLAD_GAP − THIGH_CLEAR`. Áo hẹp hơn mép ấy quá `THIGH_REACH` (`3` px)
  giữ dáng áo: đùi lòi rõ ra dưới gấu như quần rộng hơn áo.
- **Cởi áo không đổi dáng người.** Thân trần (`bare`) là dáng thân chung, áo phông là nó nở thêm `CLOTH` (`2` px) mỗi bên
  ([12](12-trang-phuc-3d.md#thân-áo-dựng-khối)): gốc vai, sườn, cổ lộ ra gần như trùng nhau, đổi áo giữa cảnh tay chỉ dời chừng
  `2` px. Thân màu da (`pieces.torso.color` trùng `palette.skin`) và mảng da trên thân áo dùng chính vật liệu da tay trần:
  vai trần liền tay không nét.
- **Tay buông thẳng.** Tay buông choãi khỏi thân `SPLAY3` (`0,08` rad) quanh trục tiến, người mặc đồ cũng
  thế: thân nhường chỗ chứ tay không xoè. Ngang hông, mép trong cẳng tay phải cách mép ngoài gốc đùi
  `hipHalf + cladThigh` một `CLAD_GAP`; hông hay đùi to hơn mức ấy thì tay choãi thêm (`roots3`). Thân bụng phệ
  ([12](12-trang-phuc-3d.md#bụng-phệ)) thì tay choãi thêm tới khi mép trong cách sườn áo không bụng đã lùi theo tay, cộng
  phần bụng nở hai bên (`bellySide`), một `CLAD_GAP` ở mọi độ cao dưới nắp vai. Mặc
  [váy dựng khối](12-trang-phuc-3d.md#váy-dựng-khối) thì từ ngang khuỷu tới đầu bàn tay xoè (`cladHand`; người
  que tới đầu nét tay), mép trong tay cũng cách hình bao váy đứng thẳng nhìn chính diện (`skirtSide`) một
  `CLAD_GAP`: váy xoè hơn thì tay choãi hơn — người mặc đồ với `flare` `12` choãi chừng `12°`, `30` thì
  `19..21°`; người que `6°` và `14°`. Cạp liền thân áo đã lùi theo tay nên độ choãi gần như chỉ theo độ
  dốc `flare / length` của vạt.
- **Chi thon và phủ màu.** Ống chi thon theo bán kính (`CLAD_TAPER`): vai `1,12` → khuỷu `0,88` → cổ
  tay `0,53` — bắp tay to hơn cẳng tay; cổ tay ngang chừng `0,75` lòng bàn tay, dày hơn lòng tay chừng `1,2`
  lần —, hông `1,35` → gối `0,9` → cổ chân `0,74`. Phủ hết thì ống tô màu áo, quần; phủ một phần thì ống da và một ống phủ to hơn `1,1` lần từ
  gốc chi, mép nở `1,12` lần. Gốc đùi là bán kính ống quần nhân `1,35` (`cladThigh`), tâm ở `±hipHalf`:
  `hipHalf` lớn hơn gốc đùi thì hai chân tách nhau, nhỏ hơn thì hai đùi lấn vào nhau. Ống phủ hết tay có
  cổ tay áo ở `0,84..1` cẳng tay. Độ cong chi vẫn là
  `palette.limbCurve`.
- **Tay áo loe** (`sleeveFlare` > 0; kimono, yukata). Tay là ống da, áo là ống phủ ngoài từ vai tới `sleeveLength`:
  bán kính `SLEEVE_EASE` (`1,1`) lần ống tay cộng phần loe tăng đều theo chiều dài tay từ `0` ở vai tới `sleeveFlare` ở
  miệng (`sleeveGrow`). Miệng hở: ống vẽ cả mặt trong, đĩa lót tối hơn màu tay áo (`0,45` lần) lùi trong miệng chừng
  2 px, cổ tay và bàn tay chui ra từ giữa; không có cổ tay áo. Bàn tay theo `sleeveWidth`, không theo bề ngang tay áo.
  `roots3` đặt tay bằng bán kính ống tay áo ở khuỷu, miệng tay: tay áo rộng thì sườn áo lùi và tay choãi theo, như tay
  to. Va chạm (`collide`) vẫn là ống tay, không đo tay áo; không có vạt tay rủ (袂).
- **Bàn tay có khớp.** Một mặt da liền năm ngón trên khung xương lòng bàn tay và năm ngón; dáng tay là góc khớp —
  [Bàn tay](#bàn-tay). Lòng bàn tay quay về phía thân, ngón cái ra trước, cỡ
  theo `sleeveWidth` (`handScale` của `0,8` nửa bề dày tay), không theo ống cổ tay `CLAD_TAPER`. Bàn tay xoè dài không
  quá `0,55` cẳng tay (`openLength`): chi to mà ngắn thì bàn tay ngắn lại thay vì thõng tới gối, bề ngang vẫn theo
  `sleeveWidth`; ba hàm ở lõi, `cladHand` gộp chúng cho `stickman.ts` và `roots3`. `hold` giữ dáng `grip` ở ngón tới lúc `release()` (`grip` của
  attach.ts), và khung `hand` của đồ cầm ở **tâm nắm** (`handGrip`), không ở mút nét: đồ căn cho người que
  lùi vào lòng bàn tay vài px.
- **Giày ở cổ chân, hông không đổi.** `Leg.ankle` treo ở mút ống chân; đế giày nằm đúng mặt sàn ở
  chỗ mút nét người que chạm sàn, độ cao hông vẫn `thigh + shin + limb` của khung xương. Cổ chân tự xoay mỗi
  lần three tính ma trận: bàn chân nằm ngang trong hệ người khi ống chân lệch khỏi phương đứng dưới
  `0,5` rad, quá thì nghiêng theo phần dư (quỳ, đá chân). Phần ống chân và ống quần dưới cổ chân ép dẹt theo phương
  đứng của bàn chân, sâu nhất `0,6` độ sâu đế (`TUCK` của `stickman.ts`): mút tròn to hơn đế không lòi dưới giày khi nhấc chân.
  Nửa dưới giày có mặt cắt siêu elip, gần đủ rộng tới sát đế, gót lùi đủ xa (`SHOE` của `human.ts`): mút ống
  chân ép dẹt cùng vỏ viền nằm gọn trong giày, không lòi sau gót hay hai bên.
- **Khối hông** là bao lồi của vành thân áo thu vào, hai khối cầu cỡ gốc đùi quanh khớp hông và hai khối
  cầu mông lùi sau, thấp hơn khớp hông (`BUTT`), trong nhóm thân, màu quần — màu váy khi có váy, trừ tạp dề. Tới nửa
  bán kính đùi dưới gấu, khối hông lùi hẳn vào trong thân áo: mông chỉ phồng ra dưới gấu, không lồi qua
  lưng áo. Váy dựng khối trùm đùi bằng ống thon như đùi, gốc `cladThigh`, gối `cladThigh · 0,9 / 1,35`; cạp
  liền mặt thân áo ở độ cao cạp, cả bề ngang lẫn bề sâu, thay `skirt.waist`: thân đi xuống váy không gờ — người que
  cũng thế ([12](12-trang-phuc-3d.md#váy-dựng-khối)). Khối thân áo
  dừng `1` px dưới cạp, trong váy: phần áo thừa nằm sát mặt váy là vệt áo lòi qua váy. Vạt dài
  quấn và tạp dề ([12](12-trang-phuc-3d.md#vạt-dài-quấn)) treo ở nhóm hông, trùm cả khối hông khi thân cúi.
- **Nét tay chân trên thân.** Tay buông cách sườn áo `CLAD_GAP`, cẳng tay vắt trước bụng: vỏ viền chìm sau
  thân áo. Thân áo, khối hông, ống tay chân, bàn tay và giày có thêm nét bóng dáng dò ở hậu kỳ (`LIMB_SIL`,
  `npr({ ink })`). Thân áo và tay áo là cùng vật liệu nên nét chỉ hiện ở chỗ tay nằm hẳn trước thân, vai liền không
  có đường may: cùng màu thì chung vật liệu `npr`, khác màu thì chung vật liệu vải tô màu từng đỉnh (`clothMaterial`,
  `npr({ tint })`) — trừ thân trần. Tay áo loe vẽ hai mặt: nét bóng dáng coi vật liệu chỉ khác `doubleSided` là một
  (`inkKey`), vai tay áo loe cũng liền thân áo; các đoạn của một chi chung một mã vật (`userData.inkChain`), khuỷu và gối
  không có nét. Da chân trần là vật liệu riêng (`npr({ group })`), khác da tay: bàn tay đặt lên đùi trần vẫn có nét. Người mặc đồ chiếm chừng hai chục mã vật, `MAX_INK` (`128`) của pipeline đủ cho năm, sáu
  người; quá thì người sau chỉ còn vỏ viền.
- **Va chạm** có thêm `hand` và `foot` (`handR`, `footL`… trong `touch`): nang bàn tay (`handCapsules`:
  năm dải dọc lòng bàn tay bán kính bằng nửa dày, một nang gò ngón cái, một nang mỗi đốt ngón) dựng từ chính các khối và
  phép biến đốt của da, phồng theo nắm đấm; `collide` nới chúng bằng `fitCapsules` cho ôm trọn lưới da đang vẽ — da uốn
  mềm qua khớp lệch khỏi khối chừng một hai px, không nới thì ngón lún vào vật mà không bị báo; nang giày đáy đúng mặt đế; nang đầu `human` kéo xuống ôm má. Đồ cầm khai `touch` cả cẳng
  tay lẫn bàn tay cầm.
- **Chi to** (vạm vỡ `sleeveWidth` `19`, `trouserWidth` `22`) đi cùng vai rộng: nới `shoulderHalf` (vạm vỡ
  `46`) hay `ease` của áo. Tay càng to thì gốc vai càng lùi vào góc vai áo, còn mép ngoài gốc đùi
  (`hipHalf + cladThigh`) giữ sườn áo: hông rộng so với vai thì tay choãi thêm, hẹp thì thân thành cột
  dưới vai. Dáng quả lê là đùi đầy (`trouserWidth` lớn, mẫu nữ `21`) chứ không nới `hipHalf`: nới hông là
  hai chân dạng xa nhau. Muốn chibi thì hạ `rig.height`: đầu không co
  nên `0,85` là đầu ~`1/3` chiều cao, `0,65` là ~`1/2,5`; thân áo, váy ngắn lại theo `height`. Đích tay hệ thân nhân `height`
  mà đầu thì không, nên hành động chạm người (che miệng, chống cằm, áp tai) đặt tay bằng mốc thân, không bằng toạ độ
  ([Đích theo mốc](#đích-theo-mốc)); ghế cao bằng gối là
  `87,5 · height`.
- **Giá.** Người mặc đồ đầy đủ khoảng `53` lưới, người que `23`; người nền nên `lod: "low"` và
  `freeze`.

### Đích bàn tay

Tay của người 3D đặt được bằng **đích cổ tay** thay cho góc: rig giải IK hai đoạn (`solveTwoBone`)
từ vai thật, cánh tay `upperArm` và cẳng tay `foreArm` của nhân vật nhân `stretch`, khuỷu nằm trong
mặt phẳng qua trục vai → đích và **hướng khuỷu**, về phía hướng ấy. Đích sát hay quá tầm thì tay duỗi
gần thẳng về phía nó theo soft IK ([Khuỷu ưu tiên](#khuỷu-ưu-tiên)), không kéo dài. Hai nguồn đích, nguồn sau đè nguồn trước:

- **Hành động** — `keys[].reach.armNear` / `armFar`, hệ thân: gốc tâm hông, `at` `[tiến, y, ra
  ngoài]` đơn vị rig ở `height = 1` (rig nhân `height`), `y` xuống là dương, **`ra ngoài` dương về
  phía chính tay ấy** — một bộ số cho hai tay đối xứng, đổi tay gần ↔ xa khi lật không đổi nghĩa. Chạm
  người thì khai mốc thân `to` thay cho `at` ([Đích theo mốc](#đích-theo-mốc)).
  Hệ thân không nghiêng theo `torso`: cúi thân không dời tay khỏi bàn. `elbow` cùng hệ, bỏ trống là
  hướng khuỷu ưu tiên của cổ tay ([Khuỷu ưu tiên](#khuỷu-ưu-tiên)); hai mốc kẹp đoạn mà một mốc không khai thì đoạn dùng
  `elbow` của mốc kia, nhạt dần về khuỷu ưu tiên phía mốc không khai theo cùng phần với đích (`elbowW`): khuỷu tới mốc ấy
  đúng khuỷu ưu tiên, không nhảy ở mốc.
- **Scene** — `cast[].world.hands`, toạ độ thế giới (hay mốc thân), theo tay phải / trái
  ([03](03-scene.md#đích-bàn-tay-thế-giới)). `elbow` theo hệ của đích: mốc có `at` là thế giới rig, mốc khác là hệ thân
  `[tiến, y, ra ngoài]` như `elbow` của hành động, quay theo hướng thân ở từng khung.

`reachToWorld(world, kênh, at, height)` đổi đích hệ thân của một tay ra điểm thế giới — cùng công
thức IK đọc —, `worldToReach` là chiều ngược.

**Khuỷu là bản lề, cả khi giải IK.** `twoBone3` trả thêm trục bản lề — pháp tuyến mặt phẳng qua vai,
đích và hướng khuỷu — và `armFrame` dựng hướng cánh tay trên từ trục ấy, khuỷu chỉ gập quanh nó: hướng
cẳng tay, bàn tay và đồ cầm đi liền theo hướng khuỷu, không theo phép quay ngắn nhất (lật nửa vòng khi
cánh tay qua đỉnh đầu). Khuỷu IK chỉ gập ra trước. Chuỗi góc duỗi thẳng thì phía khuỷu suy từ trục bản lề
của chính chuỗi góc ấy, nên lúc đích bắt đầu kéo bàn tay không xoay quanh cẳng tay. Tay theo đích không
đọc xoắn vai (hướng khuỷu đã quyết mặt phẳng gập); lệch, xoay và gập cổ tay vẫn áp lên trên.

Đích nội suy theo kênh như góc: mốc nhắc kênh tay mà không có đích là phần đích `0`. **Hoà trên vị
trí, không trên góc**: rig lấy cổ tay của chuỗi góc, kéo về đích theo phần `w` (và hướng khuỷu theo
cùng phần), rồi giải IK tới điểm ấy — cổ tay đi đường thẳng, hai đoạn giữ nguyên độ dài suốt đoạn
hoà, `w` `0` ra đúng chuỗi góc. Hoà trên góc thì cổ tay đi vòng, chạm mặt bàn giữa đường. Hai nguồn cùng kéo một tay
(đích hành động và `world.hands` đang mờ dần) thì bộ giải khuỷu nhắm cổ tay đã hoà hai nguồn, hướng khai là hai hướng khai
hoà theo phần, khuỷu đã giải đặt vào cả hai: nguồn này nhường nguồn kia mà khuỷu không đổi đường giải
([11](11-nhom-cam.md#khuỷu-tự-nhiên)). Hướng khuỷu hoà trên mặt vuông góc trục vai → cổ tay (`poleMix`): đi đều trên vòng khi hai
hướng chênh tới `120°`, gần đối nhau thì khuỷu đi qua phía ngoài của khuỷu ưu tiên, không lật theo dấu của một độ lệch nhỏ.

### Khuỷu ưu tiên

Tay theo đích không khai `elbow` thì khuỷu về **hướng ưu tiên**, một hàm trơn của chỗ cổ tay so với vai (`elbowPref`,
`core/elbow.ts`): cổ tay dời một chút thì khuỷu dời một chút, không nhảy nhánh.

- **Đầu vào**: cổ tay so với vai trong hệ thân của tay ấy `[tiến, xuống, ra ngoài]` (hệ hông như `elbow`), chia tầm với
  `l₁ + l₂`. Ra: hướng khuỷu đơn vị cùng hệ, vuông góc hướng vai → cổ tay.
- **Mẫu**: `ELBOW_POSES`, các cặp cổ tay → hướng khuỷu của tư thế hay gặp — buông, xách túi, tay trước bụng, lên ngực, ôm
  sát ngực, bưng khay, đọc và bấm điện thoại, áp điện thoại vào tai, chén kề môi, chống cằm, chỉ trước, chỉ ngang, giơ tay,
  vẫy, che mắt, gãi sau đầu, chống nạnh, chắp sau lưng, với chéo, đưa món qua quầy, viết, bấm máy tính tiền, khoác túi, kéo
  cửa lùa, với kệ cao. Mẫu soạn cho người số đo thường; người bụng to, đầu to thì số hạng lấn của `E(φ)` đẩy khuỷu ra khỏi thân
  ([11](11-nhom-cam.md#khuỷu-tự-nhiên)).
- **Nội suy**: góc khuỷu quanh hướng cổ tay đo trong **khung chở** — khung của tay chỉ thẳng trước (khuỷu thõng) quay theo
  cung ngắn nhất sang hướng cổ tay, trơn ở mọi hướng trừ thẳng sau lưng ngang vai (ngoài tầm). Nội suy Gauss trên `(cos, sin)`
  của góc ấy, cổ tay xa mọi mẫu thì về trung bình các mẫu.
- Hướng ưu tiên là gốc `φ = 0` của `E(φ)`: mọi đường giải khuỷu — đích không ý định, bàn tay theo ý định, tay mang món, món
  đặt trước — đi từ nó. `elbow` khai ở đích đè nó. Soi các mẫu trên người nhỏ nhất và lớn nhất: `pnpm shots --only khuyu-01-truoc,…` (mười nhóm × `truoc`, `cheo`, `ngang`)
  (cảnh `demo=elbows` của app xem thử, nhãn số mẫu trên từng người).

**Soft IK.** Còn `ARM_SOFT · (l₁ + l₂)` tới duỗi hết thì cổ tay hụt dần khỏi đích (`softReach`, `twoBone3(…, soft)`): ở đúng
tầm với khuỷu còn gập chừng 20°, cổ tay hụt chừng 1,5% tầm với; đích xa hơn thì tay càng gần thẳng mà không bao giờ bật
thẳng — khuỷu không giật khi đích qua mép tầm với và hướng khuỷu luôn có nghĩa. `reach.gap` đo khe ấy. Khoảng soft IK
nhân phần đích đã hoà: đích mờ về `w` `0` thì tay về đúng chuỗi góc, không bật ra khi đích tắt.

**Cổ tay liền trên vòng.** Xoay, gập, lệch tách từ một khung bàn tay qua `gimbalBlend` — gập quá `70°` thì dồn dần lệch vào
xoay theo đúng `xoay − dấu(gập) · lệch` (ở gập `90°` hai góc riêng lẻ nhảy nửa vòng) — rồi `wristClamp`: xoay và lệch kẹp
liền trên vòng (`ringClamp`): ra ngoài tầm thì lùi dần về giữa tầm, tới hướng đối diện giữa tầm thì ở giữa tầm, hai phía gặp
nhau nên bàn tay không lật từ mép này sang mép kia. Xoay `±90` với `WRIST_RAMP` `90`: xoay đòi `120°` vẽ `60°`, đòi
`180°` vẽ `0`. Gập kẹp thường trong `AIM_BEND`.

| Hằng số | Giá trị | Nghĩa |
|---|---|---|
| `ELBOW_POSES` | 28 mẫu, thêm mẫu `29` chỉ để soi | Cổ tay `[tiến, xuống, ra ngoài]` chia tầm với và hướng khuỷu `[tiến, xuống, ra ngoài]`, hệ thân của tay |
| `ELBOW_SIGMA` | 0.4 | Bề rộng nhân Gauss của nội suy, phần tầm với |
| `ELBOW_SMOOTH` | 0.1 | Cộng vào đường chéo: mẫu lệch nhau thì lấy trung bình, không bám từng mẫu |
| `ARM_SOFT` | 0.04 | Khoảng soft IK, phần tầm với |
| `WRIST_RAMP` | 90 | Cung cuối (độ) trước điểm đối diện giữa tầm mà xoay, lệch cổ tay về dần giữa tầm |

Mốc có đích mà không ghi góc kênh ấy thì kênh nhận **góc suy từ đích**
(`reachAngles`): IK trong mặt phẳng dọc với số đo mặc định, bỏ thành phần ngang, đo trong khung thân
của `torso` tại pha của mốc ấy (mốc không ghi `torso` thì lấy mẫu từ các mốc khác) — tư thế góc của
`sceneAt` vẫn có tay về phía đích, và đoạn hoà sang mốc ghi góc đi từ chuỗi góc ấy.

### Đích theo mốc

Đích toạ độ chỉ đúng với người đã đo nó: `[52, −148, 44]` tới mồm người cao `0,95` thì rơi vào cằm người chibi, má người
đầu to. Chỗ chạm người khai bằng **mốc thân** — rig tính mốc mỗi khung trên chính khung xương, đầu, thân áo, bụng,
chiều cao và `world.s` của nhân vật, ở tư thế lúc ấy (cúi, ngồi, quỳ, lắc đầu):

```jsonc
"reach": {
  "armNear": { "to": "mouth", "offset": [3, 0, 0] },                       // lòng tay áp mồm, nhích ra trước 3
  "armFar":  { "to": "otherWrist", "point": "grip", "elbow": [-0.6, 0.6, 1] } // tâm nắm ôm cổ tay tay kia
}
```

| Trường | Nghĩa |
|---|---|
| `to` | Mốc thân (`BODY_MARKS`), thay cho `at`; đúng một trong hai |
| `side` | `"same"` (mặc định) bên cùng phía tay đang với, `"other"` bên kia — mốc có hai bên: `cheek`, `eye`, `ear`, `shoulder`, `hip`, `thigh`, `knee` |
| `offset` | Dời khỏi mốc `[tiến, y, ra ngoài]`, đơn vị rig nhân `world.s`, **không** nhân `height`; theo khung phần người mang mốc, `ra ngoài` dương về phía chính tay ấy |
| `point` | Điểm bàn tay đặt vào đích: `wrist`, `palm` (giữa mặt lòng tay), `back` (giữa mu tay), `grip` (tâm nắm của dáng đang vẽ, `handGripOf`), `tip` (đầu ngón giữa); ở `world.hands` của tay đang cầm món còn có `item:<mốc>`, mốc của món ([Món cầm tay](#món-cầm-tay)). Thiếu là `wrist` với `at`, `palm` với `to`. Đi được cả với `at` |
| `elbow` | Hướng khuỷu hệ thân như đích toạ độ |

| Mốc | Chỗ | Khung của `offset` |
|---|---|---|
| `mouth`, `eye`, `cheek`, `forehead` | Trên mặt nặn của đầu (`faceSurface`, `chibiShape` của đầu `human`, `face` của nhân vật) | Đầu |
| `chin`, `crown`, `backHead` | Dưới cằm, đỉnh sọ, sau gáy đầu (`humanSkull`; chưa tính bề dày tóc) | Đầu |
| `head` | Tâm sọ, trong đầu. Đích hướng của món cầm (`face: { axis, toward: { mark: "head" } }`): loa áp tai, miệng chén kề môi — hướng từ món tới tâm đầu không lật khi món đã sát mặt. Không dùng làm chỗ đặt tay | Đầu |
| `ear` | Mặt ngoài tai (`humanEar`); tóc phủ tai thì cộng `offset` ra ngoài | Đầu |
| `nape`, `shoulder` | Gáy cổ; đỉnh nắp vai (`roots3`) | Thân |
| `chest`, `belly`, `back`, `hip` | Mặt áo giữa ngực (ngang `CHEST.at`), đỉnh bụng (gồm bụng phệ), giữa lưng ngang thắt lưng, sườn ngang hông — mặt thân 3D của `torsoSection` | Thân (đã cúi, nghiêng) |
| `thigh`, `knee` | Giữa mặt đùi, mặt gối, phía trên-trước của đùi theo dáng chân | Hướng mặt nằm ngang |
| `otherWrist`, `otherPalm`, `otherBack`, `otherGrip` | Cổ tay, giữa lòng tay, giữa mu tay, tâm nắm của **tay kia** đúng như nó vẽ | Hướng mặt nằm ngang |

- **Giải mỗi khung, trên người ấy** (`resolveActing`, `core/act3.ts`): mốc tính trên thân, cổ, đầu đã đặt rồi mới tới tay;
  điểm bàn tay phụ thuộc hướng bàn tay mà hướng bàn tay phụ thuộc cổ tay, nên rig lặp tới khi cổ tay đứng yên (dời dưới
  `AIM_STILL` `0,01` đơn vị rig, tối đa `AIM_ITER` `8` vòng): bước của cổ tay đổi chiều thì giảm một nửa, nên vòng không dao động
  giữa hai trạng thái; lòng tay, ngón hướng về một mốc thì đo từ chỗ điểm bàn tay sẽ nằm (đã trên đích), không từ chỗ đang thử —
  điểm bàn tay sát mốc thì hướng ấy không lắc theo từng vòng; đích đang hoà nhiều số hạng hay hai nguồn thì chỗ ấy hoà theo
  phần của từng số hạng. Số vòng không đổi kết quả. Kết quả
  là đích cổ tay số (hệ thân, thế giới) và `turn` / `bend` số — `act` của three, `actJoints`, `actPalms`, `figure3d` cùng đọc
  một phép giải, `act3.test.ts` giữ chúng trùng. Người que three dựng từ `stickman(o)` mang số đo ấy ở `Figure.body`.
- **Tay bám vào tay kia giải sau tay kia**, dù đó là tay gần hay xa. Hai tay cùng bám nhau thì tay gần giải trước trên chỗ chưa
  giải của tay xa — `scene_probe` báo `cycle`. Vỗ tay: một tay tới mốc thân, tay kia `to: "otherPalm"`, cả hai `palm: "in"` —
  lòng áp lòng, không xuyên.
- **Hoà mốc với toạ độ, mốc với mốc là hoà trên vị trí đã giải**: đích lấy mẫu mang các số hạng (`Reach.terms`), giữa hai mốc
  cổ tay là tổng có trọng số của từng số hạng đã giải, nên đi liền từ toạ độ thô sang mốc, từ mốc này sang mốc kia, kể cả lúc
  `blendPose` hoà hai clip. `Reach.at` khi ấy là chỗ ước lượng trên người mẫu (`reachEstimate`) cho góc suy từ đích.
- **Với không tới thì nói ra.** Tay duỗi về phía mốc như đích toạ độ; `scene_probe` trả khe tới mốc ở `world.palms.*.aim`. Ở `stretch` 1 trán, đỉnh đầu, má bên
  kia của người chibi và đùi lúc đứng thẳng ngoài tầm.
- `bodyMarkAt(nhân vật, scenePose, { to, side, offset }, "R" | "L")` trả chỗ của một mốc (thế giới rig) — cùng điểm đích nhắm tới.
- **Đồ cầm chưa là mốc.** Rig không biết hình của đồ repo video dựng; tay thứ hai đặt lên đồ tay kia đang cầm thì nhắm
  `otherGrip` cộng `offset` theo cỡ đồ.

### Hướng lòng tay theo ý

`turn` là góc thô trong khung cẳng tay, đổi nghĩa theo hướng khuỷu. Khai **ý định** thay cho nó:

```jsonc
"hand": {
  "armNear": { "pose": "cup", "palm": { "toward": "mouth" }, "fingers": [0, -0.6, -1] },
  "armFar":  { "pose": "flat", "palm": "down", "bend": 10 }
}
```

| Trường | Nhận |
|---|---|
| `palm` | Lòng tay quay về: tên hệ thân (`PALM_DIRS`: `down`, `up`, `forward`, `back`, `in` — về đường giữa thân —, `out` — ra phía chính tay ấy), vectơ hệ thân `[tiến, y, ra ngoài]`, hay `{ toward, side?, offset? }` — quay về một mốc thân |
| `fingers` | Ngón chĩa về, cùng ba dạng; phụ cho `palm` |
| `bend` | Khai kèm thì giữ cố định, rig chỉ giải phần còn lại |

- **Rig giải mỗi khung** (`aimWrist`): lòng tay chỉ phụ thuộc xoay và gập cổ tay (lệch cổ tay không đổi pháp tuyến lòng tay)
  nên hai góc ấy giải đúng; ngón lấy thêm lệch cổ tay (số thứ ba của tay, kênh nâng, `AIM_DEV` `−30..20`, dương về phía ngón
  cái). Chỉ khai ngón thì lòng tay là hướng gần lòng tay trung tính nhất vuông góc với ngón. Lòng tay gần dọc cẳng tay (gập quá
  `70°`) thì phương vị của nó không xác định, xoay kéo dần về xoay của bàn tay đang có. Góc ra kẹp liền trên vòng
  (`wristClamp`, [Khuỷu ưu tiên](#khuỷu-ưu-tiên)) trong `turn` `−90..90`, `bend` `AIM_BEND` `−60..70` (âm là ngửa) — hẹp hơn
  tầm khớp người thật chút ít, quá đó cổ tay khối của người que trông gãy —; trong tầm mà lòng tay, ngón không khớp nhau
  (gập khai sẵn, lệch giữ `0` ở kênh không nâng) thì tối đa `AIM_REFINE` (24) bước Newton trong hộp giới hạn, dừng khi bước
  dưới `0,001°`. Khi tay theo đích, khuỷu giải bằng
  cùng `E(φ)` với món đặt trước ([11](11-nhom-cam.md#khuỷu-tự-nhiên)): giá cổ tay là bàn tay đã kẹp ở cẳng tay thử cộng lệch
  còn lại của ý định — cẳng tay gánh hướng bàn tay trước, khuỷu chỉ rời hướng ưu tiên khi đáng; mốc `world.hands` khoá khuỷu
  (`elbowLock`, [03](03-scene.md#đích-bàn-tay-thế-giới)) thì kéo phần khoá về đúng hướng khai.
- **`palm` / `fingers` thắng `turn`.** Mốc khai cả hai thì `turn` bị bỏ qua — `validate` và `check` kêu (`aimProblems`).
- **Hoà là hoà góc đã giải.** Mốc thô sang mốc ý định: từng số hạng giải riêng rồi cộng góc theo phần, nên cổ tay xoay dần,
  không lật nửa vòng (góc nằm trong `±90`, nội suy thẳng). `world.hands` nhận cùng `palm`, `fingers`, `bend`, đè bàn tay của
  hành động theo phần đích; mốc `world.hands` không khai thì giữ bàn tay của hành động.
- **Không đạt thì nói ra**: `scene_probe` trả độ lệch còn lại của lòng tay và ngón (`palmOff`, `fingersOff`).

### Bộ hành động 3D

Bộ chung soạn ở `side` (`authoredAt: "side"`) cho người 3D, đi theo package như mọi hành động chung
([05](05-repo-video.md#hai-lớp)). Theo nhóm:

- **Nền đứng, ngồi và chuyển thế**: `stand-3d`, `stand-relaxed-3d`, `stand-belly-3d`, `stand-attention-3d`, `sit-3d`,
  `sit-3d-staggered`, `sit-lounge-3d`, `seiza-3d`, `seiza-hands-thighs-3d`; `sit-down-3d`, `stand-up-3d`, `kneel-*`,
  `squat-3d`, `seiza-stand-3d`.
- **Đi, bước**: `walk`, `walk-short`, `run-3d`, `steps-3d`, `steps-back-3d`, `step-side-3d`.
- **Tay để yên**: `hands-front-*`, `hands-hips-*`, `hands-behind-3d`, `arms-on-table-3d`, `elbows-on-counter-3d`.
- **Thân**: `weight-shift-*`, `lean-in-*`, `lean-back-*`, `slump-*`, `bend-place-*`, `reach-over-*`, `lean-type-3d`,
  `sigh-*`.
- **Cúi chào**: `bow-*`, `bow-hands-front-*`, `eshaku-3d`.
- **Đầu**: `nod-*`, `shake-head-*`, `turn-head-*`, `look-around-*`, `head-lead-*`, `look-down-*`, `look-up-*`,
  `glance-*`, `tilt-head-*`, `chin-up-*`, `look-up-down-3d`, `chew-3d`. Nét mặt là `face-*`
  ([Đầu và nét mặt](#đầu-và-nét-mặt)).
- **Lúc nói**: `talk-forward-3d`, `talk-chest-*`, `talk-hands-3d`, `talk-point-3d`, `lecture-3d`, `count-3d`,
  `wave-off-*`, `chop-air-3d`, `talk-beat-*`, bộ dáng thoại `talk-pose-*`.
- **Chào, mời, gọi**: `invite-*`, `thank-clasp-3d`, `wave-*`, `call-out-*`, `raise-hand-3d`.
- **Cảm xúc, cử chỉ**: `cower-3d`, `flinch-*`, `startle-*`, `head-in-hands-3d`, `facepalm-3d`, `cover-mouth-*`,
  `cheer-*`, `clap-*`, `shrug-3d`, `spread-arms-3d`, `rub-hands-3d`, `thumbs-up-3d`, `scratch-head-3d`, `think-3d`,
  `cry-3d`, `despair-3d`, `wipe-sweat-3d`, `adjust-glasses-3d`.
- **Cầm đồ**: `phone-*`, `tray-*`, `folder-*`, `toast-3d`, `drink-3d`, `offer-cup-3d`, `pour-*`, `suitcase-*`, `bag-*`,
  `write-3d`, `type-3d`.
- **Hai người**: `whisper-*`, `pat-shoulder-*`, `handshake-3d`, `give-3d`, `receive-3d`.

Xem, chọn và đọc tên: [Xem và chọn](#xem-và-chọn), [Tên và hậu tố](#tên-và-hậu-tố). Từng file:

| File | |
|---|---|
| `stand-3d` | Đứng thở: tay buông dọc thân, vai thả, cánh tay hơi ra sau (`−6°`) và khuỷu gập `24–27°` (góc khuỷu `153–156°`) — tay khỏi thẳng như que mà cổ tay vẫn ở chỗ cũ, không lấn vào quầy trước mặt; lòng tay quay vào đùi; thân nhích theo nhịp thở |
| `stand-relaxed-3d` | Đứng thở vai thả: cánh tay hơi ra trước (`6–8°`), khuỷu `30–35°`, tay xa xoắn trong `20°` nên cẳng tay chéo vào thân |
| `stand-belly-3d` | Đứng thở cho người bụng phệ: cánh tay hơi ra trước (`5–6°`), khuỷu `16–19°`, xoắn trong `6°` — cẳng tay ôm theo bụng |
| `stand-attention-3d` | Đứng nghiêm: chân khép, tay duỗi dọc thân (khuỷu `6–7°`, dang `3°`), bàn tay `flat` áp đùi; thân thở `0,8°` |
| `hands-front-3d` | Hai bàn tay chồng trước bụng dưới: tay gần lòng tay áp mốc `belly` (`[5, 28, −2]`), tay xa áp lên mu tay gần (`otherBack`), `flat` hờ, ngón vào đường giữa. Chỉ ghi hai tay. Người bụng phệ thì cánh tay lấn vào bụng — dùng `stand-belly-3d` |
| `hands-front-robe-3d` | Như `hands-front-3d`, bàn tay cao hơn, ra trước hơn (`[20, 20, −2]`), nằm trên vạt áo ngay dưới đai, khuỷu mở hơn — kimono, tạp dề |
| `hands-hips-right-3d`, `hands-hips-left-3d`, `hands-hips-both-3d` | Chống nạnh: lòng tay áp mốc `hip` (`[−1,6, −24, 5,3]`), khuỷu ra ngoài, ngón rủ ra sau-xuống. Một tay thì `sides: "anatomical"` |
| `weight-shift-3d`, `weight-shift-soft-3d` | Nhún thân một nhịp của người đứng chờ: thân cúi `4°` / `2°` lúc `0,8 s`, đầu ngửa bù, về `0` lúc `2 s` rồi giữ. Chỉ ghi `torso`, `head` |
| `lean-in-soft-3d`, `lean-in-3d`, `lean-in-firm-3d` | Ngả tới `7 / 11 / 16°` trong `0,5 / 0,4 / 0,3 s` rồi giữ, đầu ngửa bù `−5 / −7 / −10°` để mắt giữ hướng; `-firm` khai `snap` |
| `lean-back-3d`, `lean-back-seated-3d` | Ưỡn ngực ngả sau `−7°`, đầu ngửa `−7°` (ngồi tựa: `−6°`, `−6°`) cho cằm hất, `0,5 s` rồi giữ |
| `slump-3d`, `slump-big-3d` | Vai sụp: thân `7°`, đầu cúi `12°` trong `0,8 s`; cúi gằm: thân `6°`, đầu `32°` trong `1 s`; giữ. `-hold` là dáng cuối từ giây 0 |
| `bend-place-3d`, `bend-place-hold-3d` | Cúi đặt đồ lên bàn trước mặt: thân `26°`, đầu gật thêm `10°`, xuống `0,6 s` rồi giữ; `-hold` từ giây 0 |
| `reach-over-20-3d`, `reach-over-30-3d`, `reach-over-34-3d` | Cúi người với qua quầy `20 / 30 / 34°` trong `0,45 / 0,6 / 0,35 s` rồi giữ, đầu ngửa bù `−13 / −19 / −21°` |
| `lean-type-3d` | Nghiêng tới gõ phím trên quầy: thân `5°`, đầu gật `8°` trong `0,35 s` rồi giữ |
| `walk` | Chu kỳ đi, `walkCycle` đọc ở `side` |
| `walk-short`, `run-3d` | Chu kỳ đi `walkCycle` đọc ở `side`, chỉ khác `params`, sinh bởi `tools/actions/walk.mjs`: `walk-short` sải ngắn cho vạt dài quấn, váy dài ôm (đùi `14°`, chu kỳ `1 s`, `140` đơn vị rig mỗi chu kỳ — [12](12-trang-phuc-3d.md#vạt-dài-quấn)); `run-3d` chạy (đùi `26°`, gối `90°`, khuỷu gập `110°` đánh sát sườn, thân ngả `16°`, chu kỳ `0,38 s`, `277` đơn vị rig) — đùi vung quá `26°` hay `stance` dưới `0,55` (có pha bay) thì mũi giày người 3D lún sàn lúc chạm đất, nên chạy nhanh bằng nhịp ngắn và luôn có chân trụ. |
| `steps-3d`, `steps-back-3d` | Tiến / lùi hai bước ngắn rồi khép chân, mặt giữ hướng, `1,1 s` rồi giữ, quãng `80` đơn vị rig ở `height` 1; người đi `world.path` đúng quãng ấy, vào clip và thả về nền (clip rỗng ngay khi `path` dừng) đều blend `~0,1`. Chỉ ghi chân, thân; sinh bởi `tools/actions/steps.mjs` |
| `sit-3d` | Ngồi: đùi ngang, ống chân thõng, tay buông; ghép với người ngồi (`world.sit`) trên mặt ngồi cao bằng gối; ghế khác cao, người khác cỡ, tựa lưng ghế, tay trên bàn hay tay vịn thì `stickman gen sit` ([Bộ sinh chung](#bộ-sinh-chung)) |
| `arms-on-table-3d` | Đặt tay lên bàn: đích cổ tay hệ thân `[100, −56, 22]`, thân cúi `5`, bàn tay dáng nghỉ úp (`turn` `20`, `bend` `−5`) nằm trên mặt bàn. Bàn khác cao thì scene đặt `world.hands` |
| `type-3d` | Gõ phím, chồng lên `sit-3d` (`stage: desk`): cổ tay trên bàn phím `[105, −60…−65, ~32]`, hai tay so le, bàn tay úp ngón cong nhẹ (`turn` `70`, `bend` `−20`), thân cúi `8` |
| `bow-3d` | お辞儀: thân cúi `38°` trong mặt phẳng dọc, tay dọc thân, giữ rồi đứng lên; một lượt `2,6 s`, lặp được |
| `bow-15-3d`, `bow-30-3d`, `bow-45-3d` | Cúi chào một lần chỉ bằng thân, đầu: thân cúi `15 / 30 / 45°`, đầu gật thêm `6 / 5 / 3°`, xuống `0,3 / 0,4 / 0,55 s`, giữ `0,4 / 0,5 / 1,2 s`, đứng lên rồi giữ. Chỉ ghi `torso`, `head`, nên chồng được lên tay đang bưng khay, cầm món: đích tay hệ thân đứng yên khi thân cúi, nên `15°` chồng được lên tay sát eo, `30°` cần cổ tay ra trước `~65`, `45°` đổ lên cẳng tay |
| `bow-15-quick-3d`, `bow-30-quick-3d` | Cúi vội: xuống `0,15 / 0,2 s`, giữ ngắn, đầu gật thêm `10 / 9°` |
| `bow-30-snap-3d`, `bow-45-snap-3d` | Gập ngay xin lỗi: quá đà `+5°` lúc `0,14 s`, nảy về đáy lúc `0,3 s` rồi giữ ở đáy; khai `snap` |
| `bow-15-hold-3d`, `bow-30-hold-3d`, `bow-45-hold-3d` | Đáy của `bow-15/30/45-3d` từ giây 0 |
| `bow-hands-front-<15/30/45>[-robe][-hold]-3d` | Cúi chào trọn người như `bow-<15/30/45>-3d`, hai tay chồng trước bụng như `hands-front-3d` (`-robe`: như `hands-front-robe-3d`); mốc `belly` theo thân nên tay đi theo cái cúi. Ghi hai tay, `hand`, `torso`, `head`; `-hold` là đáy từ giây 0 |
| `step-side-3d` | Bước ngang tại chỗ: chân gần nhấc, dang `16°` chạm sàn (vươn `1 / cos 16°`) rồi thu về, tới chân xa; thân nghiêng `4°` về chân trụ lúc nhấc; một lượt `1,8 s`, lặp được. Chỉ ghi chân, thân, vươn |
| `sit-3d-staggered` | Như `sit-3d` nhưng hai chân so le: chân gần đưa bàn chân ra trước, chân xa gập cẳng ra sau dưới ghế — nhìn ngang và 3/4 vẫn thấy hai chân |
| `eshaku-3d` | 会釈: thân cúi `16°`, đầu gật thêm `8°`, tay dọc thân nhích ra trước, giữ rồi đứng thẳng; chồng lên `stand-3d` |
| `talk-forward-3d` | Tay gần đưa ra trước về phía người đối thoại, bàn tay mở dần và ngửa (`turn` `0 → −55`); giơ một lần rồi giữ, scene buông bằng clip rỗng |
| `talk-chest-3d`, `talk-chest-pat-3d` | Đặt lòng tay gần lên ngực mình (mốc `chest`, lòng tay ra sau), thân ngả lùi `3°`, giữ; `-pat` vỗ hai nhịp (`snap`) rồi hạ về tay buông |
| `talk-hands-3d` | Xoè hai tay ngửa hai bên ngang bụng (đích `[62, −50, 80]`, `turn` `−80`), thân ngả `2°`; giữ |
| `talk-point-3d` | Tay gần duỗi chỉ vào người nghe trước mặt (`point`, đích `[122, −116, 28]`), thân ngả `4°`; giữ |
| `lecture-3d` | Ngón trỏ dựng trước-ngoài vai, lòng tay ra trước, lắc vào-ra ba nhịp rồi giữ |
| `count-3d` | Đếm ba vế: tay gần chấm ba nhịp, ngón đổi `point` → `peace` → `count-3` (dáng của lớp chung), lòng tay ra trước; giữ ba ngón |
| `wave-off-near-3d`, `wave-off-far-3d` | Phẩy tay gạt đi: nhấc lên trước ngực, hất mu bàn tay ra ngoài-trước, khựng rồi giữ. Chỉ ghi một tay, `hand`; sinh bằng `tools/actions/wave-off.mjs` |
| `chop-air-3d` | Vung mạnh tay gần quét ngang ra ngoài trong `0,1 s` (`snap`) tới tay duỗi chéo trước ngang vai, bàn tay xoè úp, thân nghiêng theo |
| `talk-beat-3d`, `talk-beat-seated-3d` | Cú nhịp thân ở chữ nhấn: thân cúi `5°` / `8°` (ngồi), đầu ngửa bù `3°` / `6°`; giữ. Chỉ ghi `torso`, gật của `head`; sinh bằng `tools/actions/talk-beat.mjs` |
| `talk-pose-<bộ>-<tính>-<n>[-soft\|-big][-nod]-3d`, `talk-pose-<bộ>-<tính>-chin-<n>-3d` | Bộ dáng thoại: mỗi cụm từ khi nói một dáng thân, đầu, cú gật `-nod` (đầu gật thêm `5°`, bộ `bossy` `7°`, `bent` `3°`) đặt `~0,1 s` ở chữ nhấn. Bộ theo dáng nền: `upright` đứng thẳng, `lean` ngả tới `~14°`, `reach` vói qua quầy `~20°`, `bent` cúi nhìn mặt bàn `~26°`; tính `polite` biên độ nhỏ, cằm ngang, `bossy` biên độ lớn, hất cằm — có `upright-polite`, `upright-bossy`, `lean-bossy`, `reach-bossy`, `bent-polite`. Sáu dáng mỗi bộ; `-soft` độ lệch khỏi dáng nền `×0,6` cho cận mặt, `-big` `×1,7` có trần cho đầu nhỏ trên hình; `chin` (bộ `lean`, `reach`, `bent`) thân giữ dáng nền, chỉ đổi cằm, cho máy cao nhìn xuống. Lặp `3,2 s` theo nhịp thở của `stand-3d`. Chỉ ghi `torso`, nghiêng và gật của `head`. Sinh bằng `tools/actions/talk-pose.mjs` |
| `invite-near-3d`, `invite-far-3d` | Mời "xin mời lối này": từ hai bàn tay chồng trước bụng, một tay mở chéo sang ngang trên hông (`[55, −40, 95]`), bàn tay `open` ngửa; tay kia áp bụng; thân cúi `8°`, nghiêng `4°` về phía tay mời; `0,5 s` rồi giữ |
| `thank-clasp-3d` | Chắp hai lòng tay trước ngực (mốc `chest`, tay kia `otherPalm`), cúi `18°`, đầu gật `8°`, đứng lên lại, tay vẫn chắp; giữ |
| `wave-soft-3d`, `wave-3d`, `wave-big-3d` | Vẫy chào tay gần, lặp: bàn tay ngang vai / ngang tai, cẳng tay dựng / cả cánh tay quá đầu; lòng tay ra trước. Chỉ ghi tay gần, `hand` |
| `call-out-3d`, `call-out-out-3d` | Giơ tay gần chếch ra ngoài ngang đỉnh đầu gọi người, lắc một nhịp, giữ; `-out` hạ về tay buông của `stand-3d`. Mốc giữa có khuỷu xuống-sau nên khuỷu không lật lúc hoà giữa góc và đích |
| `raise-hand-3d` | Giơ tay xin phát biểu: tay gần gần thẳng đứng, bàn tay cạnh đỉnh đầu, lòng ra trước; giữ. Hạ bằng `call-out-out-3d` |
| `cower-3d` | Co rúm: hai tay gập lên trước ngực, bàn tay xoè úp ra ngoài (`turn` `50`, `bend` `−25`). Chỉ ghi hai tay |
| `flinch-3d`, `flinch-soft-3d` | Rụt người sợ: trong `0,16 / 0,2 s` thân cúi `14 / 5°`, đầu gục `24 / 11°`, hai tay khép trước bụng nắm hờ (mốc `belly`), rồi lùi về và giữ; khai `snap`. Ghi hai tay, `hand`, `torso`, gật của `head`. Sinh bởi `tools/actions/flinch.mjs` |
| `startle-3d`, `startle-step-back-3d` | Giật mình: trong `0,12 s` thân bật ra sau `9°`, đầu ngửa `14°`, hai tay vụt lên trước vai, lòng tay ra trước, rồi hạ một chút và giữ; khai `snap`. `-step-back` thêm chân gần rụt ra sau `42`, hông đứng yên. Sinh bởi `tools/actions/startle.mjs` |
| `head-in-hands-3d` | Hai tay ôm đầu: lòng tay áp hai bên đầu ngang thái dương (mốc `ear`, offset `[15, −3, 3]`), ngón chĩa lên đỉnh sọ, thân gập `14°` → `18°`, đầu gật `16°` → `22°` lún dần tới `1,2 s`, giữ `17°` / `20°`. Ghi hai tay, `hand`, `torso`, gật của `head` |
| `facepalm-3d` | Úp tay lên mặt: tay gần áp lòng tay lên trán và mắt (mốc `eye`, offset về phía giữa trán, `point: "palm"`), dáng `open`, ngón nằm ngang, đầu gục `14°` vào lòng tay, thân `4°`. Ghi tay gần, `hand`, `torso`, gật của `head` |
| `cover-mouth-3d` | Che miệng: tay gần từ tay buông qua dưới cằm lên áp lòng tay lên mồm (mốc `mouth`), `flat` hờ, ngón chéo lên về phía má kia; lòng tay quay sẵn từ dưới cằm nên khuỷu không lật; giữ. Chỉ ghi tay gần, chồng lên đứng, ngồi, quỳ |
| `cover-mouth-gasp-3d`, `cover-mouth-whisper-3d` | `-gasp`: tay gần che miệng như `cover-mouth-3d`, tay xa áp lòng lên mu tay gần (`otherBack`), thân ngả sau `4°`, đầu ngửa `6°`. `-whisper`: tay gần `cup` dựng cạnh khoé miệng phía tay ấy, lòng tay quay vào; chỉ ghi tay gần |
| `sigh-3d` | Thở dài: hít vào (thân `−5°`, đầu `−10°`) tới `0,5 s`, thở ra tới `1,3 s` (thân `8°`, đầu `16°`), giữ. Chỉ ghi `torso`, gật của `head` |
| `sigh-counter-3d`, `sigh-counter-out-3d` | Thở dài chống hai tay úp trên mép quầy (đích hệ thân `[86, −33, 36]`, `point: "palm"`, quầy `200`, mép cách hông `~78`), thân cúi `16°`, đầu gục `22°`; `-out` nhấc tay khỏi quầy về tay buông của `stand-3d` |
| `phone-ear-3d`, `phone-ear-out-3d` | Áp điện thoại vào tai: tay phải vòng ra ngoài rồi áp tâm nắm (`point: "grip"`) sát mặt ngoài tai (mốc `ear`), lòng tay `in`, ngón dựng lên, dáng `cup`; giữ. `-out` đưa ra ngoài rồi hạ máy về trước bụng |
| `phone-use-3d`, `phone-use-left-3d`, `phone-use-high-3d`, `phone-use-high-left-3d` | Cầm điện thoại xem trước ngực (`-high`: ngang ngực trên), ngón trỏ tay kia gõ màn theo mốc `otherGrip` (`point: "tip"`), ba cú mỗi lượt `1,4 s`, lặp. Sinh bởi `tools/actions/phone-use.mjs` |
| `phone-show-3d` | Giơ màn điện thoại ra trước ngang ngực về người đối diện, dí thêm một nhịp, giữ |
| `phone-film-3d` | Giơ điện thoại dọc lên ngang cằm quay phim, tay trái kẹp cạnh kia của máy (mốc `otherGrip`) |
| `tray-hold-3d`, `tray-hold-carry-3d` | Ôm khay dựng đứng trước bụng, hai tay kẹp hai mép (mốc `belly`, tay trái `otherGrip` cách `88`); `-carry` bưng khay ngang eo, hai lòng tay ngửa đỡ dưới hai mép (cách `78`). Giữ từ giây `0` |
| `folder-hold-3d`, `folder-hold-rim-3d`, `folder-hold-read-3d` | Ôm kẹp hồ sơ dựng trước ngực, hai tay kẹp hai mép (mốc `chest`, tay trái `otherGrip` cách `52`): bốn ngón gập ở gốc nằm áp phẳng mặt bìa, ngón cái mặt sau (kiểu cầm có tên `kep-ho-so@sheet/ap-bia`); `-rim` bốn ngón cuộn vòng qua mép (`rim`); `-read` cầm ra trước, đầu cúi `20°` đọc |
| `toast-3d`, `drink-3d`, `offer-cup-3d` | Nâng ly chếch ra ngoài ngang miệng; đưa ly lên miệng (mốc `mouth`), đầu ngửa `14 → 18°`, hạ; chìa chén ra trước-ngoài nhận rót |
| `pour-3d` | Rót một tay (nước, bia, rượu): tay phải nắm thân bình (mốc `chest`), ướm vòi vào miệng cốc giữa thân rồi nâng đuôi bình — bình xoay quanh chính miệng bình, cẳng tay sấp dần, khuỷu nhấc dần ra ngoài —, sự kiện `pour`, dựng lại; tay trái của nền. Bình theo cổ tay (`keep`, `slant: 0`, `along: 0.3`, `around` cho hướng vòi). Sinh bởi `tools/actions/pour.mjs`; cốc ở chỗ khác thì `stickman gen pour` ([Bộ sinh chung](#bộ-sinh-chung)) |
| `pour-serve-3d`, `pour-serve-kneel-3d` | Rót mời khách hai tay: tay phải nắm thân bình (mốc `chest`), ướm vòi vào chén người nhận ở trước-phải rồi nâng đuôi bình quanh miệng bình, cẳng tay ngửa dần, khuỷu khép dần, thân cúi `3 → 5°`, sự kiện `pour`, dựng lại; tay trái đỡ đáy bằng `both: { group: "platform", psi: -90 }` của món. `-kneel` khi quỳ seiza. Sinh bởi `tools/actions/pour.mjs` |
| `suitcase-pull-3d`, `suitcase-pull-both-3d` | Kéo vali: cổ tay sau hông, ra ngoài `[−40, 10, 66]`, nắm; `-both` hai tay hai vali. Giữ từ giây `0` |
| `bag-carry-3d`, `bag-elbow-right-3d`, `bag-elbow-left-3d`, `bag-shoulder-3d` | Xách túi bên hông (khuỷu chùng `22°`, dang `12°`); khoác túi ở khuỷu (cổ tay trước vai, mốc `shoulder`, cẳng tay gập chữ V); đeo túi trên vai (cánh tay dang `18°`). `bag-elbow-*` sinh bởi `tools/actions/bag-elbow.mjs` |
| `write-3d` | Đứng sau quầy viết vào sổ: tay phải cầm bút viết qua lại ba lượt, tay trái úp giữ trang, thân cúi `6°`, đầu gật `14°` |
| `adjust-glasses-3d` | Đẩy gọng kính: ngón trỏ tay gần lên sống mũi giữa hai mắt (mốc `eye` dời về đường giữa, `point: "tip"`), đẩy lên `4`, hạ về tay buông |
| `clap-soft-3d`, `clap-3d`, `clap-big-3d` | Vỗ tay lặp: tay gần trước ngực (mốc `chest`), tay xa áp `otherPalm`, hai lòng tay `in` đối nhau, dáng `flat`; sự kiện `clap` lúc chạm, `snap`. Hai tay cách nhau lúc mở `10 / 24 / 60`, lượt `0,55 / 0,42 / 0,36 s`; bản khẽ tay thấp hơn, bản to cao hơn |
| `cheer-3d`, `cheer-both-3d` | Hò reo: nắm đấm giơ chếch ngoài đầu thành chữ V (dang `122°`) ↔ nắm đấm ngang đỉnh đầu, gối nhún `20°`, lượt `0,5 s` lặp. Một tay (tay gần) hay hai tay; ghi tay, chân, thân, đầu |
| `shrug-3d` | Nhún vai bó tay một lần: khuỷu `~100°` sát sườn, cẳng tay xoè ra ngoài, bàn tay ngửa (`turn` `−90`), giữ rồi buông về dáng tay của `stand-3d` lúc `1,4 s` |
| `spread-arms-3d` | Dang hai tay khoe chếch ra trước (dang `38°`), lòng tay ngửa, nảy một nhịp rồi giữ; thân ưỡn `−5°` |
| `rub-hands-3d` | Xoa hai bàn tay trước ngực dưới, ngón chĩa ra trước: tay gần ở mốc `chest`, tay xa trượt tới-lui trên `otherPalm`, lượt `0,5 s` lặp. Chỉ ghi hai tay |
| `thumbs-up-3d` | Giơ ngón cái: tay gần ra trước ngang ngực, dáng `thumbsUp`, nảy một nhịp rồi giữ. Chỉ ghi tay gần |
| `scratch-head-3d` | Gãi đầu ngượng: lòng tay sau-trên tai (mốc `ear`), dáng `scratch`, gãi hai nhịp mỗi `1 s` lặp, đầu cúi, nghiêng về phía tay |
| `think-3d` | Chống cằm: tâm nắm `fist` hờ dưới cằm (mốc `chin`, `point: "grip"`), giữ, đầu nghiêng nhẹ |
| `cry-3d` | Khóc: hai nắm tay dụi mắt (mốc `eye`), thân, đầu nấc theo nhịp `0,6 s` lặp |
| `despair-3d` | Tuyệt vọng: thân gục `15°`, đầu cúi `18°` và lắc chậm `±14°` hai nhịp, tay buông thõng; lượt `3,2 s` lặp |
| `wipe-sweat-3d` | Lau mồ hôi trán một lần: lòng tay quệt từ mép trán bên tay ra thái dương (mốc `forehead`), cẳng tay dựng cạnh mặt, tay gần vươn `1,3` để người đầu to với tới, đầu cúi `12°`, buông xuống cạnh thân về dáng tay của `stand-3d` lúc `1,4 s` |
| `hands-behind-3d` | Chắp tay sau lưng: tay gần mu tay áp lưng, tay xa `clasp` nắm cổ tay tay gần (`otherWrist`, `point: "grip"`) |
| `whisper-near-3d`, `whisper-far-3d` | Ghé tai người đứng ngang hàng phía tay ấy thì thầm: thân cúi `6°`, nghiêng `12°`, đầu nghiêng `12°`, quay `28°` về phía ấy, tay ấy `cup` cạnh khoé miệng (mốc `mouth`) như `cover-mouth-whisper-3d`; `0,5 s` rồi giữ. Người nghe cách hông `~195`. Sinh bởi `tools/actions/whisper.mjs` |
| `pat-shoulder-near-3d`, `pat-shoulder-far-3d` | Vỗ vai người đứng cạnh hai nhịp rồi buông: lòng tay áp mặt ngoài vai ngay dưới nắp vai (đầu chibi che nắp vai), nhấc ra về phía mình giữa hai nhịp; người kia trước `30`, ngang `165`. Sinh bởi `tools/actions/pat-shoulder.mjs` |
| `handshake-3d` | Bắt tay phải (`sides: "anatomical"`): lòng tay `in` tới `[100, −74, 10]`, `grip` hờ, lắc hai nhịp rồi giữ. Hai người cùng diễn, hai hông cách `200`, lệch phải `27` thì hai lòng tay áp nhau |
| `give-3d`, `receive-3d` | Đưa, nhận món bằng tay phải (`sides: "anatomical"`): người đưa chìa món từ trước bụng tới `[98, −74, 12]` (`point: "grip"`), sự kiện `handoff`; người nhận ngửa lòng tay đỡ dưới đáy món, sự kiện `take`, kéo về cạnh bụng. Hai hông cách `200`, lệch phải `30`; chuyển món ở `world.hands[].hold` lúc `take` |
| `look-around-near-3d`, `-far-3d` | Ngó sang một bên `28°` rồi về, lượt `2,4 s`. Ghi lắc, gật của `head` |
| `nod-soft-3d`, `nod-3d`, `nod-big-3d` | Gật hai nhịp `9 / 14 / 22°` rồi về; `nod-once-3d` một cú `9°` khi nói, giữ `2°`. Chỉ ghi gật |
| `shake-head-soft-3d`, `shake-head-3d`, `shake-head-big-3d` | Lắc đầu "không" `±12 / 20 / 30°`, về thẳng. Chỉ ghi lắc |
| `turn-head-<35·70·100>-<near·far>-3d` | Quay đầu rồi giữ; `100` là ngoảnh qua vai. Bản `-snap` (`70`, `100`) tới góc trong `0,1 s`, vượt `6°`, khai `snap`. Ghi nghiêng, lắc |
| `head-lead-near-3d`, `-far-3d` | Đầu dẫn trước khi thân quay: lắc `35°` ở `0,35`, giữ, về thẳng ở `1`; lượt `0,9 s`. Ghi nghiêng, lắc |
| `look-down-<12·20>-3d` | Cúi nhìn vật trong tay: gật `12°` / `20°` trong `0,5 s` rồi giữ; bản `-hold` cúi sẵn từ giây `0`. Chỉ ghi gật |
| `look-up-near-3d`, `-far-3d` | Ngẩng nhìn người đứng cao: lắc `40°`, ngửa `14°`, giữ. Ghi lắc, gật |
| `glance-near-3d`, `-far-3d` | Liếc xuống một bên rồi về: lắc `30°`, gật `14°`, lượt `1,4 s`. Ghi lắc, gật. `glance-up-<near·far>-3d` liếc lên rồi giữ (lắc `30°`, ngửa `6°`, nghiêng `8°`), ghi đủ ba góc |
| `tilt-head-near-3d`, `-far-3d` | Nghiêng đầu `10°` rồi giữ. Chỉ ghi nghiêng |
| `chin-up-3d` | Hất hàm hỏi: ngửa `12°` rồi lùi về `5°`, giữ. Chỉ ghi gật. `chin-up-side-<near·far>-3d` hất về một phía, lắc `15 → 10°`, ghi lắc, gật |
| `look-up-down-3d` | Nhìn người đối diện từ đầu tới chân: ngửa `10°`, hạ xuống gật `22°`, giữ `6°`; lượt `1,8 s`. Chỉ ghi gật |
| `chew-3d` | Nhai: gật `4°` ba nhịp mỗi lượt `0,9 s`, lặp. Chỉ ghi gật |
| `sit-lounge-3d` | Ngồi ngả trên ghế bành: hông trượt ra trước `34`, lưng `−22°`, chân duỗi, cẳng tay nằm dọc tay vịn; lặp |
| `seiza-3d`, `seiza-hands-thighs-3d` | Ngồi quỳ trên mặt ngồi `world.sit` cao hơn sàn `14` (ống chân, gối nằm trên đệm dày `6`): đùi dốc `10°`, cẳng chân nằm ngang ra sau; bản sau úp hai bàn tay trên đùi (mốc `thigh`) |
| `elbows-on-counter-3d` | Chống hai khuỷu lên quầy cao `200`, thân cúi `40°`, nắm tay chụm, đầu ngửa |
| `sit-down-3d`, `stand-up-3d`, `kneel-up-3d`, `kneel-up-out-3d`, `seiza-stand-3d`, `squat-3d`, `kneel-3d` | Dời hông giữa đứng, ngồi ghế bành, seiza, quỳ, ngồi xổm, sinh bởi `tools/actions/seat.mjs`: góc chân giải IK theo đúng đường hông rig nội suy giữa các mốc `path` (`preview.path`, hay hai mốc của `previewScene` cho `sit-down` / `stand-up`), nên bàn chân, gối đứng yên |

Hành động cầm đồ (`phone-*`, `tray-*`, `folder-*`, `toast-3d`, `drink-3d`, `offer-cup-3d`, `pour-*`, `suitcase-*`, `bag-*`,
`write-3d`) chỉ đặt tay; món và chỗ cầm khai ở `world.hands[].hold` của cảnh ([11](11-nhom-cam.md#4-schema-cảnh)), xem thử
ở `preview.hold`. Món một tay cầm thì `sides: "anatomical"` và món ở tay phải, bản `-left` ở tay trái. Hai tay cầm một món
(`both`) thì tay trái đặt theo mốc `otherGrip` cách đúng bề ngang món, vì tay phụ chỉ bám món khi bàn tay đã tới gần chỗ của nó.

Đích hệ thân giả định bàn cao hơn hông ngồi ~`51` (mặt ngồi `87,5` cao bằng gối); dàn cảnh khác
cao thì đặt bàn phím, mặt bàn theo đích, hay đặt `world.hands`. Hai hành động tay trên bàn khai
`elbow` `[-0,3, 0,3, 1]` (khuỷu ra ngoài nhiều hơn xuống): với hướng mặc định, đích gần vai kéo
khuỷu xuống dưới mặt bàn và cẳng tay lẹm mép. Test giữ khuỷu, cổ tay trên mặt bàn chuẩn suốt chu kỳ.

#### Tên và hậu tố

Tên tiếng Anh, chữ thường nối gạch, đuôi `-3d` cho hành động soạn ở `side`. Hành động `gen` (bộ sinh, như `walk`)
và hành động chỉ ghi nét mặt (`face-*`, `talk-lips`) không có đuôi. Tên, `note` và mọi trường khác không mang tên nhân vật, tập
hay phòng nào. Hậu tố đứng theo thứ tự cố định, ô nào không dùng thì bỏ:

```
<gốc>[-<mức>][-<biến>][-<phía>][-<pha>]-3d
```

| Ô | Giá trị | Nghĩa |
|---|---|---|
| gốc | `bow`, `turn-head`, `hands-front` | Động tác, một hay vài từ |
| mức | số độ (`15`, `30`, `45`) hay `soft` / `big` | Biên độ so với bản không hậu tố mức. Một họ chọn một trục: số độ (góc chính của động tác — thân cúi, đầu quay) hay `soft` / `big`, không trộn |
| biến | `robe`, `seated`, `quick`, `snap`, `gasp`, `both`… | Kiểu khác của cùng động tác: khuỷu mở cho áo thụng, ngồi, nhịp nhanh, gập ngay rồi nảy, hai tay |
| phía | `near` / `far`, `left` / `right` | Phía làm động tác — [Gần, xa và phải, trái](#gần-xa-và-phải-trái) |
| pha | `hold`, `out` | Không hậu tố: vào dáng rồi giữ (`end: "hold"`), đi rồi về một lần như cúi chào (cũng `hold`), hay lặp (`end: "wrap"`). `hold`: dáng cuối — động tác đi rồi về như cúi chào thì dáng đỉnh — ngay từ `t: 0`, cho người nền và cảnh cắt vào giữa động tác. `out`: từ dáng cuối của bản không hậu tố về dáng nền (`stand-3d`, `sit-3d`), nối ngay sau nó |

Ví dụ: `bow-30-3d`, `bow-hands-front-45-robe-hold-3d`, `turn-head-70-snap-near-3d`, `hands-hips-right-3d`,
`cover-mouth-gasp-3d`, `call-out-out-3d`. Hai file trong bảng trên lệch quy ước — `eshaku-3d` tên Nhật,
`sit-3d-staggered` hậu tố sau `-3d` — và giữ tên vì cảnh đang gọi; hành động mới không lấy chúng làm mẫu.

#### Gần, xa và phải, trái

Kênh tay chân gọi theo gần / xa ống kính ([03](03-scene.md#hành-động-theo-tay-phải-trái)). Chọn theo việc động tác gắn
với cái gì:

- **Gắn với khung hình — `-near` / `-far`.** Động tác về một phía mà cảnh chọn theo bố cục: quay đầu, ngó, mời tay, phẩy
  tay. `-near` làm về phía ống kính (tay gần, mặt quay ra máy), `-far` về phía kia. Hai bản cùng có, cùng số, chỉ đổi kênh
  gần ↔ xa (đầu thì đổi chiều lắc, nghiêng). Không khai `sides`. Người lật qua chính diện thì chi gần thành chi kia như
  mọi hành động gần / xa.
- **Gắn với một tay của người — `-left` / `-right`, `sides: "anatomical"`.** Dáng giữ qua nhiều cảnh, nhiều góc máy mà
  tay phải liền mạch qua các cú cắt: chống nạnh một bên, khoác túi ở khuỷu, cầm món ở một tay nhất định. Kênh `armNear` là
  tay phải nên `-right` ghi kênh gần, `-left` ghi kênh xa; `mask` cũng đọc theo tên ấy.
- **Đối xứng hay hai tay như nhau** (vỗ tay, cúi chào, chắp tay sau lưng): không hậu tố phía, không `sides`.

#### Kênh và nền

Một hành động chỉ ghi kênh của chính động tác, khai `mask` rõ ràng, để scene chồng nhiều track. Nhóm chỉ đầu ghi
`head`; nhóm thân ghi `torso` và gật của `head` (đầu bù cho mắt giữ hướng; nghiêng, lắc để trống cho `turn-head-*`
chồng lên), tay để cảnh; cúi chào ghi `torso`, `head` nên chồng được lên tay đang cầm khay, đang chắp. Tay chân ghi ở `side` (`authoredAt: "side"`). Hành động nằm trên một nền — `stand-3d`, `sit-3d`
với `world.sit`, `seiza-3d` — và khai nền ấy ở `preview` ([Hành động](#hành-động)), khớp với `note`.

#### Mẫu `note`

Tiếng Việt, một tới bốn câu, theo thứ tự:

1. **Làm gì**: động tác, số chính (góc, nhịp, `duration`), pha — một lần rồi giữ, lặp, hay buông về nền.
2. **Ghi kênh nào**: "Chỉ ghi …", khớp `mask`.
3. **Cần nền gì**: track dưới, ghế hay bàn cao bao nhiêu, món ở `world.hands[].hold`, người kia đứng đâu.
4. **Chồng với gì**: track nào chồng lên được, cách buông (bản `-out`, clip rỗng `blend` ~`0,4`), bản `-near` / `-far`
   hay `-left` / `-right` cùng họ.

```json
"note": "Cúi chào 30° một lần: thân cúi 30°, đầu gật thêm 5°, xuống trong 0,4 s, giữ 0,5 s, đứng thẳng lên lúc 1,4 s rồi giữ đứng. Chỉ ghi `torso`, `head`. Nền `stand-3d`. Chồng lên tay bưng khay thì đích cổ tay ra trước ~65 trở lên; tay chắp trước bụng theo thân cúi thì dùng `bow-hands-front-*`."
```

`note` tả trạng thái của file: không "bản cũ", "đã chỉnh"; không nhắc nhân vật hay cảnh dùng nó.

#### Biến thể sinh từ bảng

Biến thể chỉ khác số của cùng một khuôn mốc — góc, nhịp, `duration`, bản `-far` của bản `-near` — sinh bằng script
`tools/actions/<họ>.mjs`, mỗi họ một file, chạy `node tools/actions/<họ>.mjs`:

- Script giữ bảng số, khuôn mốc và khuôn `note`; mỗi dòng bảng ra một file trong `common/actions/`, kèm
  dòng `index.json`.
- Mỗi file đi qua `parseAction` trước khi ghi, ghi `schemaVersion` bằng `ACTION_VERSION` và qua prettier, nên
  `pnpm format:check` sạch. Tất định: chạy lại ra đúng từng byte.
- File sinh là thứ cảnh gọi tới, nằm trong git cạnh file soạn tay. Đổi số thì sửa bảng rồi chạy lại; **không sửa tay
  file sinh** — lần chạy sau ghi đè. `note` của file sinh nói nó sinh từ script nào.
- Biến thể khác khuôn — thêm mốc, kênh khác, dáng tay khác — là file soạn tay.
- `tools/actions/emit.mjs` là phần ghi chung (`parseAction`, prettier, `index.json`; `footfalls` đo pha `step` theo luật
  chân chịu lực, [Mốc sự kiện](#mốc-sự-kiện)); nó đọc `dist` của rig, nên chạy `pnpm --filter @stickman3d/rig build` trước.

#### Bộ sinh chung

Họ hành động mà số đúng phụ thuộc **chỗ người và đồ trong cảnh** — rót vào một cốc ở đâu đó, ngồi trên một ghế cao thấp
bất kỳ — có phép tính ở một module của `@stickman3d/cli` (`gen-<họ>.mjs`). Lệnh `stickman gen <kiểu>` của repo video sinh
bản cho đúng một cảnh rồi tự kiểm trên chính cảnh ấy ([05](05-repo-video.md#sinh-hành-động-theo-cảnh)); họ có bản chung thì
script `tools/actions/<họ>.mjs` gọi cùng phép tính với số mẫu. Sửa phép tính thì cả hai cùng đổi; bản chung chạy lại phải
ra đúng từng byte.

- **Rót** (`pour`): bộ chung `pour-3d`, `pour-serve-3d`, `pour-serve-kneel-3d` với miệng cốc ở điểm mẫu (`lip` của bảng
  `SINGLE` / `SERVE`, hệ thân so với mốc `chest`) và bình trong tay đo trên bốn người mẫu (`BINH`: `gripR`, `mouth`);
  `stickman gen pour` đọc bình và đích rót theo vai trò ([13](13-vai-tro-do.md#64-gen-pour): `pourer` của bình, `vessel` hay
  điểm của đích), đo đích của cảnh và liên kết tay–bình trên chính người rót (`actHeld`, tâm nắm vẽ ra), dời `lip` tới khi
  điểm rót trùng đích, nên bình nào khai `pourer` và cỡ tay nào cũng dùng được.
- **Ngồi** (`sit`, `gen-sit.mjs`): chỉ có lệnh `stickman gen sit`, không có bản chung — bộ chung giữ `sit-3d`,
  `sit-3d-staggered` cho ghế cao bằng gối. Bảng kiểu chân (`LEG_STYLES`: góc ống chân và tầm nới; `shinTries` thử trong
  tầm rồi dựng ống chân co, duỗi về phương đứng tới biên tầm chân vuông), góc đùi (`THIGH_RANGE`
  cận trên, cận dưới theo mép trước mặt ngồi: `thighLow`, `THIGH_SINK`, sàn `THIGH_FLOOR`), chân thõng (`dangleLeg`,
  `DANGLE_MIN`), kiểu lưng (`BACK_STYLES` kèm tầm `band`, `RECLINE`), chỗ tay (`THIGH_REACH`, `THIGH_OUT`, `thighPalm`;
  khuỷu trên tay vịn `ARMREST`, `FOREARM_REST`, `HAND_DROOP`; bàn tay chồng `FOLD`); góc chân giải từ độ cao hông trên mặt
  đỡ, đùi, ống chân của `bones3(height)` và viên nang giày (`shoeAt`, khớp `SHOE` của người 3D mặc đồ). Hông không bao giờ
  dời: đế giày chạm được thì chạm, không thì chân vuông thõng, chân co, duỗi là lỗi, chân so le đổi chân không chạm sang
  vuông (`--feet floor` thì lỗi). Khuỷu trên tay vịn giải từ vai, cánh
  tay trên của `bones3` và mặt tay vịn. Mặt ngồi, lưng ghế, tay vịn, để chân, mặt bàn đọc từ vai trò của đồ
  ([13](13-vai-tro-do.md#65-gen-sit)).
- **Đi** (`walk`, `gen-walk.mjs`): không sinh hành động — `stickman gen walk` ghi mốc `world.path` và clip đi / đứng vào
  cảnh ([14](14-di-muot.md#5-gen-walk)); chuyển động do `sceneAt`. `parsePoints` đọc điểm, `planWalk` ra mốc và clip theo luật
  thời gian (giây theo dây cung, `yaw` phân giác, cung bo `ARC_STEP`, bán kính nhỏ nhất `v / WALK_TURN_RATE`, cú quay tại
  chỗ, quay rồi đi); không cần vai trò của đồ.
- **Trang soi** (`gen-pages.mjs`, module thuần): `GEN_PAGES[kiểu]` mô tả form tham số, sân khấu thử (đồ thử chỉ bằng mục
  vai trò, món cầm tay thử) và tham số gọi bộ sinh; tờ thử `gen sit --sheet` dựng ô bằng chính bản mô tả ấy
  ([13](13-vai-tro-do.md#9-trang-soi-bộ-sinh)).

#### Xem và chọn

- **Đọc `note`**: MCP `list({ kind: "actions", match: "bow-*-3d,nod-*" })` trả mỗi hành động khớp kèm `mask`, `note`
  ([Mẫu `note`](#mẫu-note): làm gì, ghi kênh nào, cần nền gì, chồng với gì) và `preview` ([04](04-mcp.md#tool)). Không
  có `match` thì chỉ có tên và `mask` — cả bộ có vài trăm file. Lọc theo gốc của nhóm ở trên.
- **Xem diễn**: Studio 3D (`pnpm studio`, `http://localhost:5180`) → công tắc **Cảnh / Thư viện** đầu thanh trên. Danh
  sách gom biến thể theo gốc tên (nhóm gập, bấm dòng gốc để mở), ẩn hành động chỉ nhép miệng (công tắc **Hiện khẩu
  hình**), bản của repo mang nhãn `repo`. Một trong bốn người mẫu (`sample-man`, `sample-woman`,
  `sample-heavy`, `sample-kimono`) hay nhân vật của repo diễn trên nền, khối và món của `preview`. Panel phải có
  `note`, kênh, nền; phím 1–5 đổi góc máy, V đổi biến thể cùng gốc. Mở thẳng một hành động:
  `http://localhost:5180/?library=1&action=bow-30-3d&who=sample-woman&angle=near`.
- **Soi cả lô**: `pnpm bang-hanh-dong --hanh-dong 'bow-*-3d'` vẽ mỗi hành động trên bốn người, ba góc máy, kèm dòng
  `check` ([07](07-lam-tap.md#bảng-duyệt-hành-động)).
- **Ghép trong cảnh**: track dưới là nền (`stand-3d`, `sit-3d` với `world.sit`, `seiza-3d`); track trên là hành động
  kênh hẹp — thân, đầu, một tay — như phần "chồng với gì" của `note` ghi. Bản `-near` / `-far` chọn theo bố cục khung,
  `-left` / `-right` theo tay của người ([Gần, xa và phải, trái](#gần-xa-và-phải-trái)).
- **Hành động của repo** cùng tên với một file chung thì đè file ấy. Hành động mới của repo đặt theo
  [Tên và hậu tố](#tên-và-hậu-tố) để Thư viện gom đúng biến thể, và khai `preview` để xem được trong Thư viện.
