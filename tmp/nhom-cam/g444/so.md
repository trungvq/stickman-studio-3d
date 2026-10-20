# G4-44 `cylinder` `wrap`: dáng theo bán kính, ngón cái

Nguồn: `bang-cam --nhom cylinder` (giây 0,5, hàng mặc định, tay phải, rig giải chỗ cầm), trước = `g443/do.json`, sau =
`do.json` ở đây. v1 xem `g443/so-v1.md` (v1 nắm ở vai/cổ, v2 hàng mặc định ở thân `along 0,25` — không cùng chỗ).
Số đơn vị rig; khe âm là lún; "xuyên" là trục nang vào trong hình (dương là xuyên, ngưỡng `HELD_PIERCE_FIT` 0,5).
Ảnh ghép hàng mặc định sakura: `../duyet/g4-cylinder-cai-truoc-sau.jpg`.

## Bảng (trước G4-43 / sau G4-44)

**thu-chai-dia (thân r 10,2) · sakura** — v1 `#co`: lún 0,0, cái −0,8

| | Lún | Xuyên | Cái | Trỏ | Giữa | Áp út | Út | Lòng (vai trò) | Lòng khe/góc | Luật |
|---|---|---|---|---|---|---|---|---|---|---|
| trước | 2,45 | −0,62 | −2,45 | −0,65 | −0,94 | −1,20 | −0,90 | 0,87 | 2,19/37° | `sink` |
| sau | **0,14** | −1,73 | −0,14 | −0,03 | 0,02 | 0,00 | −0,06 | 0,61 | 1,84/46° | — |

**thu-chai-dia · kuroiwa** — v1 `#co`: lún 0,0, cái −0,4

| | Lún | Xuyên | Cái | Trỏ | Giữa | Áp út | Út | Lòng (vai trò) | Lòng khe/góc | Luật |
|---|---|---|---|---|---|---|---|---|---|---|
| trước | 2,20 | −1,03 | −2,20 | −0,28 | −0,61 | −1,22 | −1,09 | 0,98 | 2,83/40° | `sink` |
| sau | **0,20** | −1,98 | −0,20 | −0,03 | 0,04 | −0,02 | −0,07 | 0,53 | 2,40/50° | — |

**thu-chai-dac-tuyen (thân r 13,2) · sakura** — v1 `#xem`: lún 0,6

| | Lún | Xuyên | Cái | Trỏ | Giữa | Áp út | Út | Lòng (vai trò) | Lòng khe/góc | Luật |
|---|---|---|---|---|---|---|---|---|---|---|
| trước | 4,53 | 1,91 | −4,53 | −1,10 | −0,91 | −1,09 | −1,25 | 0,77 | 1,70/21° | `pierce`, `sink`, `size` |
| sau | **0,07** | −1,72 | −0,07 | 0,04 | 0,06 | 0,03 | 0,05 | 0,64 | 1,43/21° | `size` |

**thu-chai-dac-tuyen · kuroiwa** — v1 `#xem`: lún 0,7

| | Lún | Xuyên | Cái | Trỏ | Giữa | Áp út | Út | Lòng (vai trò) | Lòng khe/góc | Luật |
|---|---|---|---|---|---|---|---|---|---|---|
| trước | 5,36 | 2,36 | −5,36 | −0,29 | −0,75 | −1,22 | −1,55 | 0,87 | 2,25/21° | `pierce`, `sink` |
| sau | **0,10** | −2,00 | −0,10 | 0,00 | 0,06 | 0,03 | 0,03 | 0,60 | 1,86/25° | — |

**thu-ong-nghe-ban (tay, `around 0`) · sakura / kuroiwa** — v1 `#tai`: lún −0,2 / −0,4

| | Lún | Xuyên | Cái | Trỏ | Giữa | Áp út | Út | Lòng (vai trò) | Lòng khe/góc | Luật |
|---|---|---|---|---|---|---|---|---|---|---|
| trước sakura | 2,94 | 1,63 | −2,94 | −2,06 | −1,70 | −0,48 | 0,17 | 0,44 | 2,74/0° | `pierce`, `sink` |
| sau sakura | **3,36** | 1,52 | −3,36 | −0,16 | 0,25 | −0,26 | 0,04 | 0,83 | 2,83/0° | `pierce`, `sink` |
| trước kuroiwa | 3,74 | 1,51 | −3,74 | 0,29 | 0,24 | −0,40 | −0,81 | 0,23 | 1,82/0° | `pierce`, `sink` |
| sau kuroiwa | **3,90** | 1,53 | −3,90 | −0,12 | 0,03 | −0,26 | −0,72 | 0,91 | 2,98/0° | `pierce`, `sink` |

Ống nghe chưa đạt: ngón cái lún vào khối `loa` (`grip: false`, nhô 8 ở mặt trước). Rig chọn `around 0` = mặt trước, đúng
mặt có `loa`/`mic` nhô ra. Đo ở lõi: bỏ hai khối `loa`/`mic` thì lún 0,53 / 0,07; `around 180` (mặt lưng) lún 0,53 / 0,07,
không xuyên. Bốn ngón đã hết lún (trỏ −2,06 → −0,16). Việc của G4-45 (biên `grip: false`) và G4-47 (áp tai, `around` lưng).

## Đo ở lõi (không qua `bang-cam`)

Thanh tròn `r = x·W`, `along 0,5`, `around 0`, `thumb up`, hai cỡ tay (k 1,75 / 2, long 1,68), lưới `x` 0,06–0,95 bước 0,01
(`do/sweep-thanh.txt`): lún ≤ 0,52, không xuyên, khe vai trò lớn nhất (ngón chạm xa nhất) ≤ 1,37, lòng tay ≤ 0,6 trừ dải
đổi họ ngón cái 0,37–0,39·W (lòng 1,3–1,74).

| Thanh | Lún sakura / kuroiwa | Ngón cái so với trục `a` (cos) |
|---|---|---|
| r 2,5 | 0,30 / 0,41 | −0,91 (dọc trục về phía út) |
| r 5 | 0,45 / 0,31 | −0,96 |
| r 10 | 0,16 / 0,17 | +0,79 (dọc thân lên, chéo ~38°) |
| r 13 | 0,19 / 0,13 | +0,79 |

`chai-dia` vai (`along` 0,6–1, `around 180`): lún ≤ 0,69 (kuroiwa `along 0,90`; còn lại ≤ 0,68), không xuyên, lòng ≤ 1,22
trừ một điểm `along 0,66` kuroiwa (2,21, dải đổi họ). Trước G4-44 cùng lưới lún 0,6–1,9.

Fixture `chai-dia#co` (≤ 5° / 1): sakura 1,7° / 0,64, kuroiwa 3,2° / 0,63, hai tay như nhau (G4-43: 0,72 / 0,89).

## Đã đổi

- `graspSolve.ts`: `wrap` trả `radius` = `r(s)` ở chỗ cầm (trụ tiện) và `thumbRadius` = min(`r(s)`, `r` ở `0,5·W` về phía
  ngón cái — `WRAP_THUMB_AHEAD`). `basePose` hoà dáng theo `radius` thay `rMax`, tra ngón cái theo `thumbRadius`;
  `palmSkin` nhận cùng số đo nên da lòng tay đặt theo đúng dáng. Thanh (`rod`) vẫn theo `R` (spec: thanh dẹt theo cạnh dài).
- `graspGroups.ts`: `PoseSpec.thumb` (bảng số đo → góc ngón cái, nội suy tuyến tính, ngoài bảng lấy đầu gần);
  `ThumbAngles`. `cylinder.wrap`:

| Hằng | Giá trị | Nghĩa |
|---|---|---|
| `WRAP_OPEN` | knuckle −20, tip −80 trên `grip` (trỏ 25/0, ba ngón 30/0) | dáng mở ở 0,95·W |
| `WRAP_CLOSED` | knuckle −35, tip −85 trên `fist` (55/0) | dáng đóng ở 0,06·W |
| `WRAP_THUMB` | 0,17 `[60,60,45,60]` · 0,30–0,36 `[60,90,45,10]` · 0,38 `[80,90,0,0]` · 0,40 `[90,40,−10,0]` · ≥0,42 `[50,20,0,10]` | ngón cái theo `W` |
| `WRAP_THUMB_AHEAD` | 0,5 | lần `W` dọc trục về phía ngón cái để tra bảng (vai thắt) |

- Test `graspSolve.test.ts` "`cylinder` `wrap` trên da": thanh r 2,5/5/10/13 × hai cỡ × hai tay (lún ≤ `HELD_SINK`, xuyên ≤
  `HELD_PIERCE_FIT`, mọi ngón và lòng ≤ `HELD_WRAP`), hướng ngón cái mảnh/to, `chai-dia` thân và chỗ fixture, dáng theo `r(s)`.

## Ghi chú, lệch kế hoạch

- **Bốn ngón**: dáng `grip`/`fist` (G4-43) đóng quá — đốt gốc gập 60–90° nên đốt ngọn lún 0,4–1,6 và `heldFit` mở hết −80°
  vẫn không thoát. Dáng gốc mở (gốc 30–55°, ngọn 0) rồi `heldFit` cuộn tới chạm: hết lún ở mọi bán kính.
- **Rủi ro 8 (thanh mảnh `fist` + `knuckle`) không theo**: đo cho thấy `fist` đã lún 0,7–0,9 trên r 2,5; gập thêm gốc lún
  hơn. Thanh mảnh dùng cùng đường (dáng mở + `heldFit`) — lún 0,30/0,41. Ảnh phác (`do/lib.ts` `sketch`) cho thấy trên r 2,5
  ngón không vòng qua đỉnh thanh: thanh nằm sát khớp gốc ngón (tâm nắm `fist` cách gốc ngón 2,2), muốn quấn kín phải dời
  thanh về phía cổ tay ~3 đơn vị — là chỗ tiếp xúc (G4-43), lệch fixture `#co`, không làm ở đây.
- **Ngón cái hai họ**: đối giữa chừng (dạng 60, đối 40–70) cắt vào trụ lún 1–3 ở 0,35–0,45·W; đổi họ qua dạng 80–90 thì
  không lún, đổi trong 0,36–0,42·W. Trên vai chai `along` đi qua dải này thì ngón cái lật họ (không lún, lòng hở tới 2,2).
- **Họ to `[50,20,0,10]` thay `[70,10,−20,25]`** (thẳng dọc trục hơn, cos 0,94): bản 70 làm gò cái nhô về phía `loa` khi
  trượt dọc ống nghe tới `along 0,75` — tâm nắm nhảy 3,3 ở 0,69→0,70, test trượt của G4-46 (`holdPlaced.test.ts`) đỏ
  (`phi` 5°, cổ tay 8,2). Bản 50 giữ test ấy xanh.

## Ảnh (đã mở)

- Chai đĩa, chai đặc tuyển: ngón cái nằm trên mặt chai, dựng chéo lên dọc thân (~38° lệch trục), thấy rõ ở góc trước/chéo,
  không còn cắt vào thân (G4-43 ngón cái ẩn trong thân chai). Bốn ngón ôm vòng phía xa. Nhưng góc trước trông như "giơ ngón
  cái" bên chai hơn là quấn: ngón cái áp mặt nhưng không ôm ngang quanh thân. Chai đặc tuyển trông tự nhiên hơn chai đĩa.
- Ống nghe: tay ở mặt trước, ngón cái khuất sau món, lún vào `loa` — chưa đạt, như trên.
- Trụ mảnh không có hàng ở `bang-cam` (G4-47); chỉ đo ở lõi và ảnh phác.

## Docs cần (G4-48)

- `docs/11` nhóm 5 "Dáng": hoà theo `r(s)` ở chỗ cầm (trụ tiện), thanh theo `R`; dáng gốc mở hơn chỗ chạm (`WRAP_OPEN`,
  `WRAP_CLOSED`) cho `heldFit` cuộn tới; bỏ câu "`rod` có `r < 0,2·W` cần dáng khép hơn `fist`".
- Mục 6 "Ngón" bước 1: `PoseSpec.thumb` — ngón cái tra bảng theo số đo, đè ngón cái của dáng hoà; với `cylinder` số đo là
  bán kính nhỏ hơn của chỗ cầm và chỗ `0,5·W` về phía ngón cái; hai họ ngón cái (mảnh: dọc trục về phía út; to: dọc thân lên).

## Kiểm

- Studio `typecheck`, `lint`, `format:check`, `test`, `build`: xanh (`studio.log`).
- Video `pnpm test`: xanh (`video-test.log`).
- `check --scene '^t02-' --only ref,held,clash --baseline …g315.json`: 0 mới, 0 nặng hơn (`check-t02.log`).
- `check --scene '^thu-nhom-cam'`: 1 lỗi (`wrist` tay phải `thu-bang-gia`, đã biết) + 1 cảnh báo `clash` takumi.torso ↔
  bang-gia 2,09–2,16 s (đã có ở G4-43) (`check-thu-nhom-cam.log`).
