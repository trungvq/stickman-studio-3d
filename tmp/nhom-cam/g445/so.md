# G4-45 `cylinder`: biên phần `grip: false`

Nguồn: `bang-cam --nhom cylinder` (giây 0,5, hàng mặc định, tay phải, rig giải chỗ cầm). Trước = `../g444/do.json`, sau =
`do.json` ở đây. Số đơn vị rig; "xuyên" dương là trục nang vào trong hình (ngưỡng 0,5); lún ngưỡng `HELD_SINK` 0,65.
Ảnh ghép hàng mặc định ống nghe sakura: `../duyet/g4-cylinder-ong-nghe-truoc-sau.jpg`.

## Bảng (trước G4-44 / sau G4-45)

| Món · người | | Chỗ cầm rig chọn | Lún | Xuyên | Nắm | Lòng | Cổ tay vượt | Luật |
|---|---|---|---|---|---|---|---|---|
| chai-dia · sakura | trước | than 0,25 / 300 / up | 0,14 | −1,73 | −1,98 | 0,61 | 0 | — |
| | sau | như trước | 0,14 | −1,73 | −1,98 | 0,61 | 0 | — |
| chai-dia · kuroiwa | trước | than 0,25 / 330 / up | 0,20 | −1,98 | −1,03 | 0,53 | 0 | — |
| | sau | như trước | 0,20 | −1,98 | −1,03 | 0,53 | 0 | — |
| ong-nghe-ban · sakura | trước | tay 0,5 / 0 / up | 3,36 | **1,52** | 0,48 | 0,83 | 0 | `pierce`, `sink` |
| | sau | tay 0,75 / 150 / down | **0,66** | −0,95 | 1,37 | 0,95 | **20,0°** | `wrist` (lỗi), `sink` |
| ong-nghe-ban · kuroiwa | trước | tay 0,5 / 0 / up | 3,90 | **1,53** | 1,49 | 0,91 | 0 | `pierce`, `sink` |
| | sau | tay 0,75 / 150 / down | **0,58** | −1,69 | 1,98 | 1,03 | **19,5°** | `wrist` (lỗi) |
| chai-dac-tuyen · sakura | trước | than 0,25 / 300 / up | 0,07 | −1,72 | −2,29 | 0,64 | 0 | `size` |
| | sau | như trước | 0,07 | −1,72 | −2,29 | 0,64 | 0 | `size` |
| chai-dac-tuyen · kuroiwa | trước | than 0,25 / 330 / up | 0,10 | −2,00 | −2,63 | 0,60 | 0 | — |
| | sau | như trước | 0,10 | −2,00 | −2,63 | 0,60 | 0 | — |

(chỗ cầm: `part along / around / thumb`; `around 150` của thanh hộp áp đúng mặt lưng như 180.)

Chai: không đổi một chữ số (cùng lựa chọn, cùng số). Fixture `chai-dia#co` giữ (test `graspSolve.test.ts` xanh).

Ống nghe: hết xuyên loa/mic (xuyên 1,5 → −0,9/−1,7), lún 3,4/3,9 → 0,66/0,58. **Chưa đạt trọn**: sakura lún 0,66 (quá 0,01)
và cả hai cỡ cổ tay vượt 20° (lỗi `wrist`, xoay 111°/±90). Lún 0,66 là do vượt cổ tay: khung cầm lún 0,22 (đo ở lõi), bàn tay vẽ
kẹp ở 90° nên lệch chỗ cầm 2,0 và đè vào cạnh thanh (ngón giữa). Gốc: hàng mẫu đặt ống nghe đứng, mặt loa quay ra ngoài; lòng
tay áp mặt lưng (phía người cầm) thì cẳng tay phải xoay quá giới hạn. Mặt trước (loa, mic nhô 6) bị loại; mặt bên (90/270) giá
cổ tay 4–200, lún 1,0–1,7. Ở tư thế này không còn ứng viên nào vừa không lấn `grip: false` vừa trong giới hạn cổ tay.

### Đã thử: chỉ giá lún, không loại `around`

| Người | Chỗ cầm | Lún | Xuyên | Luật |
|---|---|---|---|---|
| sakura | tay 0,75 / 0 / up | 0,04 | −2,2 | `role` (tay bị loa đẩy khỏi mặt, ngón không chạm) |
| kuroiwa | tay 0,25 / 0 / up | 0,70 | −1,23 | `sink`, `grip` (út lún vào mic) |

Lưới đủ ở mặt trước (`do/luoi-ong-nghe-truoc-loai.txt`, tay lên): lún 2,2–3,9 ở `along` 0,2–0,7; chỉ sát 0,8 lún 0,15–0,25
vì `skinTouch` đẩy cả bàn tay ra khỏi mặt bằng khối loa (tay lơ lửng). Giá lún không biết tay bị nhấc nên chọn đúng chỗ ấy →
thêm luật loại `around` (dưới). Hai cách cùng giữ: giá lún cho chỗ lấn không thấy bằng hình học, luật loại cho khối nhô.

## Đã đổi (lõi)

| Hằng / hàm | Giá trị | Chỗ |
|---|---|---|
| `GRIP_CLEAR` | 0,3 (lần `W`) | `graspGroups.ts`; `GroupSpec.clear` của `cylinder` |
| `BULGE` | 0,1 (lần `W`) | `graspSolve.ts`: phần `grip: false` nhô khỏi mặt quá ngần này về phía lòng tay thì `around` ấy bị loại |
| `SINK_GROUPS` | + `cylinder` | giá `(lún / HELD_SINK)²` đo trên da như G4-12 |

- `heldGeom.ts`: `GripSegment.cut` (phần `grip: false` cắt đầu thấp/cao; hộp chạm sát đầu đoạn cũng tính — miệng chai);
  `alongRoom(seg, clear)`; `axialAt(…, { clear })` kẹp `along` và trả `along` đã kẹp; `faceRho` (mặt thanh hộp lòng tay áp,
  tách từ `wrap`); `bulgeToward(geom, f, around, margin)` đo bằng điểm xa nhất của từng khối (`blockReach`), không bằng hộp
  bao (hộp bao trụ miệng chai nhô chéo 1,4 lần); `ItemGeom.blocked[].shape`.
- `graspGroups.ts`: `needs` của `cylinder` thêm "chứa tâm nắm cách phần `grip: false` ≥ 0,3·W" (`roomy`); `choiceWarnings`
  (cảnh báo, không chặn): `along` cảnh khai sát phần `grip: false` → dòng nêu phần, khoảng cách, `along` rig kẹp về.
- `graspSolve.ts`: `wrap` kẹp `along` (`clear`); `chooseMissing` lọc `around` theo `bulgeToward` ở cả bậc rời (giá trị đầu
  của lưới) và lưới liên tục; mọi `around` đều nhô thì không lọc.
- `scene.ts`: `sceneHoldProblems` thêm dòng `choiceWarnings` (cỡ tay người mẫu cao như người cầm) → `check` nhóm `ref`
  cảnh báo, MCP cùng hàm. Ví dụ: `nguoi: \`world.hands\` right t=0 (cảnh báo \`choice\`): \`ong-nghe@cylinder\`: \`along: 1\`
  sát phần \`grip: false\` \`loa\` — tâm nắm cách nó 0,0 dọc trục, dưới 0,3·W (…); rig kẹp về \`along\` 0,8…, khai \`along\` ≤ …`.

Ghi chú: với đoạn bị cắt cả hai đầu, `len ≥ 0,6·W` đã kéo theo có chỗ cho tâm nắm cách hai đầu 0,3·W, nên điều kiện mới của
`needs` không loại thêm món nào hiện có; nó ghi rõ luật và dùng chung `alongRoom` với chỗ kẹp.

## Thời gian `chooseMissing` (`cylinder`, cache nguội, lõi, người mẫu fixture; `do/time-*.txt`)

| Món | Ứng viên trước → sau | ms trước | ms sau |
|---|---|---|---|
| chai-dia | 42 → 42 | 107–115 | 117–133 |
| ong-nghe-ban | 38 → 29 | 89–102 | 81–93 |
| chai-dac-tuyen | 42 → 42 | 96 | 125–139 |

Giá lún thêm 10–40 ms mỗi tay trên trụ tiện (máy tải, nhiễu ±15 ms); ống nghe nhanh hơn vì bớt 9 ứng viên.

## Test

- `heldGeom.test.ts`: `cut` của ống nghe (`mic`, `loa`) và chai (`mieng`), `alongRoom`, `axialAt` `clear`, `faceRho`,
  `bulgeToward` (mặt trước 0/30/330 nhô; 60/90/180/270 không).
- `graspGroups.test.ts`: `needs` trên thanh có hai nút `grip: false` (0,6·W ± 0,1, một đầu), câu `checkGroup`;
  `choiceWarnings` ống nghe `along` 0,95/0 (phần, khoảng 1,1, kẹp 0,82/0,18), 0,5 và `high` im, `checkChoice` không lỗi;
  chai `along` 0,98 một dòng `mieng`.
- `graspAt.test.ts`: ống nghe hai tay rig không chọn mặt nhô, `along` trong miền, lún khung ≤ `HELD_SINK`; khai `around 0` lún
  quá ngưỡng; khai `along` 1 / 0,95 kẹp về `1 − 0,3·W/22`; số ứng viên ống nghe `2 + 3 × 9`.
- `holdPlaced.test.ts`: `along: 1` trên cảnh → `graspAtTime` kẹp 0,75–0,85, `sceneHoldProblems` một dòng cảnh báo; 0,5 im.

## Ảnh (đã mở)

- Chai đĩa, chai đặc tuyển: y hệt G4-44.
- Ống nghe sau: góc trước thấy tay ở sau thân giữa loa và mic, ba ngón quấn ra mép phải, không ngón nào cắt vào loa/mic (trước:
  ngón cái chìm vào khối loa, rõ ở góc chéo). Góc chéo, ngang: cẳng tay che gần hết bàn tay, không thấy gì sai nhưng cũng
  không thấy cách cầm. Cổ tay vượt 20° không lộ thành gãy ở ba góc này. Hàng này là ống nghe đứng mặt loa ra ngoài — không
  phải cách cầm ống nghe thật; hàng áp tai (`around` lưng) thuộc G4-47.

## Docs cần (G4-48)

- Mục 2 "Khối hình rig suy ra": đoạn bám mang phần `grip: false` cắt mỗi đầu; hộp chạm sát đầu đoạn tính là cắt.
- Mục 3 nhóm 5 "Cần": giữ câu tâm nắm ≥ 0,3·W; thêm `along` kẹp vào miền ấy (`alongRoom`), cảnh khai sát quá thì `check`
  cảnh báo (`ref`, "cảnh báo `choice`").
- Mục 5 "Lựa chọn cảnh không khai": `cylinder` cộng giá lún như `palmBox`; `around` mà phần `grip: false` kề đoạn bám nhô
  khỏi mặt quá `0,1·W` về phía lòng tay bị bỏ khỏi lưới (thanh hộp: mặt lòng tay áp là mặt gần `ρ` nhất), trừ khi mọi
  `around` đều thế; cập nhật "Giải 3–42 ứng viên mất 3–17 ms" (cylinder 29–42 ứng viên, 80–140 ms mỗi tay có đo lún).
- Mục 7 bảng luật: dòng cảnh báo `choice` (`along` sát `grip: false`) bên cạnh lỗi `choice`.

## Kiểm

- Studio `typecheck`, `lint`, `format:check`, `test`, `build`: xanh (`studio.log`).
- Video `pnpm test`: xanh (`video-test.log`).
- `check --scene '^t02-' --only ref,held,clash --baseline …g315.json`: 0 mới, 0 nặng hơn, 0 đã hết (`check-t02.log`).
- `check --scene '^thu-nhom-cam'`: 1 lỗi (`wrist` tay phải `thu-bang-gia` 0,00–2,30 s, đã biết) + 1 cảnh báo `clash`
  takumi.torso ↔ bang-gia 2,09–2,16 s (đã có từ G4-43) (`check-thu-nhom-cam.log`).
