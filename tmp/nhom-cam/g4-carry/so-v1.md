# `carry` v2 so với kiểu treo v1 (`tui-hieu#khuyu`, `#vai`)

Nguồn: `pnpm bang-cam --nhom carry --mon thu-tui-hieu` ở video (`auto/nhom-cam`), giây 0.5, `--at -95,0,300`, người `t01-sakura` (tay 1,61) và `kuroiwa` (tay 2,16). Món v2 `thu-tui-hieu` là bản v2 của `tui-hieu` (cùng `shape`, `seats.elbow = treoKhuyu`, `seats.shoulder = quai`). Hàng: `treo khuỷu` (`on: elbow`), `treo vai` (`on: shoulder`, cảnh khai `touch` bắp tay và thân max 5 như `#vai` v1).

## So với bảng chuẩn v1 (`g4-chuan-v1/`)

Bảng chuẩn v1 dựng tay theo cảnh `thu-grip-tui` (dáng tay lấy từ cảnh); hàng mẫu v2 đặt tay theo dáng mặc định của `bang-cam` (khuỷu gập chữ V / tay dang ngoài túi). Hai dáng tay khác nhau nên khuỷu, bắp tay lệch; để so sạch, chạy thêm chế độ v1 với đúng dáng mặc định (`do-v1-mac-dinh.json`).

### So đúng dáng tay (v1 `tui-hieu#…` dáng mặc định ↔ v2 `thu-tui-hieu@carry`)

| Chỗ treo | Người | quai (seat) | khuỷu bend/rise | thân (body) gap · part (allow) | đẩy (swing) | Ảnh 3 góc |
|---|---|---|---|---|---|---|
| khuỷu v1 = v2 | t01-sakura | 0 = 0 | 42,7° / 30,6° = 42,7° / 30,6° | 0,0 thighR = 0,0 thighR | 11,3° = 11,3° | trùng từng pixel |
| khuỷu v1 = v2 | kuroiwa | 0 = 0 | 35,4° / 36,0° = 35,4° / 36,0° | 0,0 torso = 0,0 torso | 6,3° = 6,3° | trùng từng pixel |
| vai v1 = v2 | t01-sakura | 0 = 0 | — | -5,22 upperArmR (5) = -5,22 upperArmR (5) | 0,0° = 0,0° | trùng từng pixel |
| vai v1 = v2 | kuroiwa | 0 = 0 | — | -5,66 upperArmR (5) = -5,66 upperArmR (5) | 2,5° = 2,5° | trùng từng pixel |

`seat` và `body` không đổi (khác 0 trong sai số số thực): 12 ô PNG (4 hàng × 3 góc) trùng byte. Không luật `held` nào báo ở cả 4 hàng.

### So bảng chuẩn v1 theo cảnh (`g4-chuan-v1/do.json`)

| Chỗ treo | Người | quai | khuỷu bend/rise (v1 chuẩn → v2 mẫu) | thân gap · part (v1 chuẩn → v2 mẫu) | đẩy (v1 chuẩn → v2 mẫu) |
|---|---|---|---|---|---|
| khuỷu | t01-sakura | 0 → 0 | 41°/53° → 43°/31° | 0 thighR → 0 thighR | 10° → 11° |
| khuỷu | kuroiwa | 0 → 0 | 34°/57° → 35°/36° | 0 torso → 0 torso | 19° → 6° |
| vai | t01-sakura | 0 → 0 | — | -4,1 upperArmR → -5,2 upperArmR | 9° → 0° |
| vai | kuroiwa | 0 → 0 | — | -1,3 upperArmR → -5,7 upperArmR | 10° → 2° |

`seat` 0 mọi ô; phần thân gần nhất không đổi. Chênh khuỷu, `body` của vai và `swing` là do dáng tay (cảnh vs dáng mặc định), không do rig. `body` của vai có phần `touch` 5 cho lấn: -5,2 / -5,7 trừ 5 còn lấn 0,2 / 0,7, dưới `CARRY.body`.

## Nhận xét ảnh (`thu-tui-hieu.jpg`)

- Treo khuỷu: quai vắt đúng mặt trong khuỷu gập, túi thõng xuống cạnh đùi (t01-sakura) hay hông (kuroiwa), không lồng vào người; hai cỡ tay đều đọc rõ.
- Treo vai: nhìn từ trước quai ló ở đầu vai, thân túi nằm áp trước bụng và che gần hết cẳng tay; góc ngang cho thấy bắp tay đâm xuyên một phần thân túi (lấn 5 là phần `touch` cho phép) — đúng như `#vai` v1, không phải lỗi mới. Dáng mặc định tay dang chưa đẹp bằng dáng của cảnh, vì túi nằm sát thân hơn là thõng bên hông.
- Hàng mẫu `carry` không đặt món trước ngực, không có `items`; nhãn in `treo … · quai · khuỷu · thân · đẩy`, `do.json` giữ `on`, `seat`, `bend`, `rise`, `body`, `swing`.
