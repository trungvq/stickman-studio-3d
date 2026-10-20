# 06 — Đạo cụ có bánh

Xe kéo tay, xe bò, xe đẩy bốn bánh, xe ngựa, kiệu — và cả khúc gỗ, hòn đá không
bánh: một **thân** thay được và **bánh** vẽ bằng code, có hay không. Đạo cụ không
phải nhân vật — không có xương, không có tư thế, không có hành động. Chuyển động
duy nhất của nó là chỗ đứng trên sân khấu, và bánh quay là hệ quả của chỗ đứng ấy.
Người ngồi được vào trong nếu nó có **chỗ ngồi** — xem [dưới](#chỗ-ngồi-và-hai-lớp).

File nằm ở `props/` của workspace, đi qua `PropSchema` / `parseProp` như mọi JSON
khác. Đặt lên sân khấu ở `scene.props[]` — xem [03](03-scene.md#đạo-cụ).

Món người cầm trong tay (điện thoại, chén, khay) không phải đạo cụ: nó là `held/<món>.json` — khung, mốc, hình —,
lưới do cảnh three của repo dựng, scene cầm bằng `world.hands[].hold` theo nhóm cầm ([01](01-rig.md#món-cầm-tay),
[03](03-scene.md#đồ-cầm-tay), [11](11-nhom-cam.md)).

## Hình dạng JSON

```json
{
  "schemaVersion": 2,
  "name": "oxcart",
  "line": "#1a1a1a",
  "body": { "src": "part", "part": "thung", "color": "#c9a86a", "dx": -80 },
  "wheel": { "fill": "#ffffff", "spokes": 8, "stroke": 12 },
  "rear": { "r": 44 },
  "front": { "x": 130, "r": 36 }
}
```

| Trường | Nghĩa |
|---|---|
| `line` | Màu nét của bánh và của thân vẽ code |
| `body` | Thân xe. Cùng hình dạng với một socket mảnh (`src` `none`/`image`/`part`, `file`, `part`, `color`, `dx`, `dy`, `scale`, `widthScale`, `rotate`). Ảnh để ở `pieces/prop/`, vào danh mục với `socket: "prop"`; bộ phận code là mục trong `PARTS` có `sockets: ["prop"]` |
| `wheel` | Kiểu bánh chung: màu ruột, số nan hoa, độ dày nét. `fill: "none"` là ruột trong suốt, thấy thân xe qua nan hoa; `spokes: 0` là đĩa đặc — quay cũng không thấy quay |
| `rear` | Bánh sau, chỉ có `r`. **Bỏ trống là đạo cụ không bánh**: khúc gỗ, hòn đá — đáy thân đặt lên đất, bóng đổ dưới thân. Đừng khai bánh vô hình |
| `front` | Bánh trước, bỏ trống là xe hai bánh; cần có `rear`. `x` là điểm chạm đất so với bánh sau |
| `seat` | Chỗ ngồi `{ x, y }`: hông người ngồi, đơn vị rig, so với điểm bánh sau chạm đất, `y` âm là trên đất. Bỏ trống là lấy của bộ phận thân; thân ảnh không khai là không ngồi được |

## Hệ toạ độ: gốc ở chỗ bánh sau chạm đất

Gốc `(0, 0)` là điểm bánh sau chạm đất; trục bánh sau ở `(0, −r)`. Hộp thân cao
`PROP_BODY` (`200`, đơn vị rig, bằng nửa người), rộng
`PROP_BODY × body.scale × aspect × widthScale`, **đáy đặt lên trục bánh sau** rồi
dịch `dx`/`dy`; `rotate` xoay quanh chính trục ấy (chiều rig, ngược dấu
`rotate()` của SVG như mọi mảnh).

`aspect` **đo từ chính file ảnh**, không đọc số khai trong JSON — cả `mountProp`
của render, studio lẫn `Scene.tsx` của scaffold đều đo lúc nạp. Số trong JSON chỉ
là cái đệm lại của lần đo trước; sửa tay nó không đổi được gì. Thêm đường đọc mới
mà quên đo là khúc gỗ dài gấp `3.4` lần bề dày vẽ ra vuông.

Vì thân treo vào trục bánh sau nên **to bánh lên là xe tự nâng**, điểm chạm đất
không đổi và không phải căn lại gì. Không có bánh thì trục ấy nằm ngay mặt đất
(`r = 0`): đáy hộp thân chạm đất, `dy` nâng lên nếu vật phải kê cao. Bánh trước to nhỏ khác bánh sau thì thân
không nghiêng theo — muốn nghiêng thì đó là `body.rotate`, một quyết định tạo
hình chứ không phải phép suy.

Bánh vẽ **trên** thân — nhìn ngang, bánh bên này che thùng. Không có bánh xa: hai
bánh sau của xe bò nhìn ngang trùng nhau, vẽ thêm bánh mờ phía sau chỉ thêm một
đường ghép phải căn.

## Chỗ ngồi và hai lớp

`propSeat(prop)` là chỗ duy nhất trả lời "ngồi ở đâu": `seat` trong JSON nếu có,
không thì `PARTS[part].seat` của bộ phận thân — khai theo **tỉ lệ hộp** (`0..1`)
nên đổi `scale`/`dx`/`dy` vẫn đúng chỗ — đổi ra hệ đạo cụ bằng chính hộp mà
`<Prop>` vẽ (`propBox`). Không xoay theo `body.rotate`. `cast[].sit` của scene
đặt hông người vào đó ([03](03-scene.md#ngồi-trong-đạo-cụ)); studio có ô **Người
ngồi trong** ở tab Đạo cụ để căn.

Người ngồi phải lộ ra qua cửa sổ, nên thân có người ngồi là **hai lớp**: bộ phận
thân có `drawBehind` (ruột xe, vách xa, đòn xa — vẽ **trước** người) và `draw`
(vách gần, mái, gầm, đòn gần — vẽ **sau** người), vách gần **khoét lỗ** bằng
`fill-rule="evenodd"` chứ không vẽ cửa sổ tối lên trên. `<Prop part="back">` vẽ
bóng và `drawBehind`, `part="front"` vẽ `draw` và bánh; không có `part` là vẽ cả.
Thân ảnh chỉ có một lớp: người ngồi trong thân ảnh là bị che hẳn.

Hai bộ phận mẫu: `xengua` (thùng xe ngựa, khung `1.5 : 1`, hai cửa sổ, cửa, càng
chìa sang **phải** tới ngựa; trụ gầm ở `0.15` và `0.483` bề ngang hộp nên bánh
trước `x` = `0.333 ×` bề ngang) và `kieu` (kiệu, khung `1.9 : 1`, đáy hộp là mặt
dưới đòn gần; không bánh, `props[].y` âm nâng cả kiệu lên vai người khiêng, tay
người khiêng là hành động `carry.json`). Cả hai vượt mức 3–5 hình cơ bản một
chút vì cửa sổ và đòn là thứ nhận diện — chi tiết hơn nữa thì gen ảnh, đừng nối
thêm path.

## Bánh quay là hệ quả, không phải tham số

`<Prop roll>` là quãng xe đã đi trên màn hình (đơn vị scene, dương là sang
phải); `propAt` trả `roll` bằng chính `x`. Mỗi bánh quay `roll / (r · scale)` rad
— bánh to bánh nhỏ tự lệch nhau, lăn lùi tự quay ngược, xe theo người thì lăn
theo trôi ngang của người ấy. Không có slider tốc độ quay và không tích luỹ
trong rAF: Remotion seek tới frame nào cũng ra đúng góc ấy.

Hằng số cộng vào góc không có nghĩa với bánh tròn đều, nên `roll` lấy thẳng `x`
tuyệt đối thay vì "quãng từ lúc mở màn".

## Thân vẽ code hay ảnh

Thân là chỗ duy nhất của đạo cụ hay đổi. Cùng luật với trang phục ở [02](02-trang-phuc.md):
ảnh là PNG hai màu nhân `body.color` bằng `feColorMatrix`, còn bộ phận code chỉ cho
thứ thật sự là 3–5 hình cơ bản. `thung` (thùng xe kéo tay) là một hình thang, một
cái càng và hai chân đỡ — có nó để cắm thử mà chưa cần gen ảnh. Tạo hình thật
cho một tập phim thì gen ảnh thân xe theo đúng đường của [04](04-mcp.md), khung
gợi ý `2.2 : 1`, càng chìa về phía **trái** (người đẩy đứng sau xe, nhân vật
nhìn về `+x`).

**Chép hình dáng từ chính tấm nền.** Nếu bối cảnh đã vẽ sẵn cái vật ấy — khúc gỗ
nằm bên bờ, cái xe dựng ở góc sân — thì đạo cụ rời phải cùng góc nhìn, cùng độ
dày nét, cùng cách bo. Cùng một vật vẽ hai kiểu là hai thế giới đặt cạnh nhau, và
nó lộ ngay ở khung đầu tiên có cả hai.

Cái càng nằm ở đâu trong hộp quyết định tay người đặt ở đâu — tay không tự tìm
càng. Tư thế tay là của hành động (`push.json` trong bộ mẫu: hai tay đưa trước,
`armFar [48, 12, 0]`, `armNear [52, 8, 0]`), còn `props[].x` đẩy xe tới chỗ càng
gặp tay. Soi bằng `scene_probe`: nó trả `handNear`/`handFar` của người và
`rearAxle` của xe cùng một hệ toạ độ.

## Cây và đồ vật SVG

Bộ chung có 13 món trong `PARTS`: `gold-bar`, `silver-bar`, `gold-nugget`,
`silver-nugget`, `gold-coins`, `diamond`, `ruby`, `emerald`, `sapphire`,
`treasure-crown`, `pearl-necklace`, `treasure-pile`, `basket`. Chúng giữ nguyên
màu từ SVG nguồn và khung cắt sát phần có hình; `body.color`, `body.accent`, `line` và độ dày nét
không đổi bảng màu hay nét của các món này. Chọn ở mục Thân của đạo cụ.

Sáu cây dùng `body.color` cho lá, `body.accent` cho thân và `line` cho nét.
Độ dày nét lấy từ `wheel.stroke` dù cây không có bánh. Không khai `rear` hay
`front`. `body.scale` là chiều cao hộp chia cho `200`.

| Bộ phận | Dáng cây | `scale` gợi ý |
|---|---|---|
| `tree-1` | Tán tròn, thân chạc | 2,4 |
| `tree-2` | Tán xoè ngang | 2,6 |
| `tree-3` | Tán cao thuôn | 2,8 |
| `tree-pine` | Thông nhiều tầng | 2,8 |
| `tree-small` | Cây non thấp | 1 |
| `tree-ancient` | Cổ thụ, gốc bè và rễ buông | 3,2 |

```json
"body": {
  "src": "part", "part": "tree-ancient", "scale": 3.2,
  "color": "#527b51", "accent": "#8c694e"
}
```

Các cây là SVG thuần trong rig, không cần file ảnh ở workspace. Mẫu `props/`
đi theo scaffold lúc `init`; kiểu cây và đồ vật đi theo package rig.
