# Lô 4 — soát dáng cầm tập 02

| cảnh | người | tay | món@nhóm | giây | kết luận | đã đổi | nhận xét |
|---|---|---|---|---|---|---|---|
| t02-s041-nguoi | yoshie | hai tay | tom-hum@sheet | 0, 0.15, 0.3 | đúng sẵn | — | Hai ngón cái trên vành, bốn ngón dưới đĩa khi đặt đĩa xuống bàn, đúng kiểu bưng đĩa. Ngón giữa còn hở món 3,4 (dáng rim của rig) nhưng nhìn không lộ. |
| t02-s041-nguoi | erika | phải | dien-thoai@palmBox | 0.3, 1.38, 1.65, 2.75 | còn sai — cần rig | tilt 20.6 → 5 | Máy giờ nằm trong lòng tay, ngón ôm cạnh, không còn kê trên nắm đấm; nhưng ba ngón press vẫn hở lưng máy 5–6 — dáng span của palmBox chưa khép tới, việc của rig. |
| t02-s041-nguoi | erika | phải | dua@chopsticks | 3.6, 4.45, 4.65, 5.58 | đúng sẵn | — | Đầu vuông sau bàn tay, đầu nhọn ra trước chúc xuống đĩa, đúng chiều. Bàn tay ôm hai que từ trên, đọc được là cầm đũa; góc trước bị đầu che. |
| t02-s042-lam-lai | yoshie | hai tay | tom-hum@sheet | 2.15, 2.55, 2.77, 3.1 | đúng sẵn | — | Nhấc đĩa lên ngang ngực, ngón cái trên vành, ngón dưới đáy. Lúc kẹp (1,85 s) đĩa xoay 38° một khung: chỗ đĩa nằm trên bàn do `src/khoi3d/t02.ts` (CHO_DIA) đặt, ngoài phạm vi cảnh. |
| t02-s043-bep-2 | yoshie | hai tay | tom-hum@sheet | 0, 0.28, 0.55 | đúng sẵn | — | Bưng đĩa hai vành đặt lên quầy, dáng đúng. |
| t02-s044-cham | yoshie-di | hai tay | tom-hum@sheet | 0.3, 2.69 | đúng sẵn | — | Bưng đĩa trước bụng khi đi, ngón cái trên vành, ngón dưới đáy. |
| t02-s044-cham | yoshie | hai tay | tom-hum@sheet | 0.3, 2.69 | đúng sẵn | — | Như trên, đĩa có khe với áo. |
| t02-s045-cui | yoshie | hai tay | tom-hum@sheet | 0, 0.24, 0.47 | đúng sẵn | — | Hạ đĩa xuống đầu bàn, hai tay giữ vành đúng. |
| t02-s048-vo-tom | erika | phải | dua@chopsticks | 0.3, 1.23, 1.36, 2.21 | đúng sẵn | — | Đũa đúng chiều (đầu vuông sau tay, đầu nhọn gõ vỏ tôm), tay kẹp hai que. |
| t02-s049-da-trong | erika | phải | dua@chopsticks | 0.3, 2.38, 4.37, 4.77 | đúng sẵn | — | Cầm đũa trước ngực đúng chiều; 4,77 s là lúc buông đặt đũa xuống. |
| t02-s050-them-bo | takumi | phải | dua@chopsticks | 0.3, 1.16, 1.31, 3.92 | đúng sẵn | — | Đũa đúng chiều, gõ đầu đũa lên đá trống; dáng kẹp nhất quán với các cảnh khác. |
| t02-s050-them-bo | yoshie | trái | phieu@platform | 1.1, 1.65, 4.32 | đúng sẵn | — | Tay trái đỡ tập phiếu (dày, cứng) để ghi — kiểu đỡ lòng tay hợp với tập phiếu đang viết; tay khuất dưới phiếu ở góc trước. |
| t02-s050-them-bo | yoshie | phải | but@pen | 1.3, 4.93, 5.15, 7.69 | đúng sẵn | — | Ngòi chạm phiếu, trục bút nghiêng ~60° so với mặt phiếu, đuôi về phía tay. Bàn tay lơ trên giấy chứ không tì mé tay như ảnh mẫu. |
| t02-s051-bep-3 | yoshie | hai tay | bo-da@sheet | 0, 0.28, 0.55 | còn sai — cần rig | đã thử variant rim → flat: lỗi choice (mép dày 6,5 > 3,5); trả về rim | Hai bàn tay xoè mở chữ C ở mép khay geta, ngón cái không đè mặt trên, ngón không khép dưới đáy. Mép dày 6,5 (ván + chân) vượt miền khép của rim, flat không cho — cần rig. |
| t02-s051-bep-3 | yoshie | phải | phieu-lien@sheet | 1.6, 1.73, 1.8, 2.15 | đã sửa | variant flat → pinch | Trước: tờ phiếu mỏng nằm ngửa trên lòng tay (loại theo chốt). Sau: úp tay kẹp mép giữa ngón cái và ngón trỏ như ảnh `giay-dua`, đặt xuống quầy. |
| t02-s052-o1-sofa | erika | phải | ong-nghe@cylinder | 0.3, 1.27 | đã sửa | thêm roll {axis top, toward [-0.4,-0.92,0]} | Trước: ống nghe nằm ngang dọc thái dương. Sau: loa ở tai, đầu dưới chếch xuống hàm, thân trong lòng tay, ngón ôm ngang thân. |
| t02-s052-o2-giuong | erika | trái | ong-nghe@cylinder | 0.3, 2 | đã sửa | thêm roll {axis top, toward [-0.4,-0.92,0]} | Như ô 1, tay trái: ống nghe theo đường tai – hàm, kẹp trong lòng tay. |
| t02-s052-o3-chi-be | takumi | phải | ong-nghe@cylinder | 0.3, 2.05 | đã sửa | thêm roll {axis top, toward [-0.4,-0.92,0]} | Ống nghe gần đứng áp má, loa ở tai; đầu dưới còn hơi xa miệng nhưng hết nằm ngang. |
| t02-s052-o4-ben-kinh | erika | trái | ong-nghe@cylinder | 0.3, 1.75 | đã sửa | thêm roll {axis top, toward [-0.4,-0.92,0]} | Như ô 2: loa ở tai, thân chếch xuống hàm, kẹp trong lòng tay. |
| t02-s053-hanh-lang | yota | hai tay | khay@platform | 0.3, 3.49 | đúng sẵn | — | Hai lòng tay ngửa đỡ dưới hai đầu khay, khay ngang trước bụng; ngón cái không móc vành như ảnh mẫu nhưng đúng kiểu đỡ. |
| t02-s053-hanh-lang | erika | trái | dien-thoai@palmBox | 0.3, 3.49 | đúng sẵn | — | Giơ máy đứng quay phim, camera sau về 陽太, ngón cái dọc cạnh, ngón sau lưng máy. |

## Cần sửa rig

- **sheet `rim`** — `bo-da` (t02-s051-bep-3): mép khay geta dày 6,5 (ván 3,9 + chân 2,6) nên `thickAt` ra quá `0,2·A`, dáng mở hẳn: hai tay xoè chữ C, ngón cái không đè mặt trên. `flat` bị `choice` chặn (≤ 3,5). Thử: rim (gốc), flat (lỗi). Cần dáng rim khép quanh mép dày tới ~7. Ảnh: `truoc/t02-s051-bep-3/0.28-yoshie-tay-trái-cheo.png`. Cũng ở rim: ngón giữa hở 3,4 với `tom-hum` (mọi cảnh bưng đĩa) — nhìn không lộ.
- **palmBox** — `dien-thoai` (t02-s041-nguoi, erika quay đĩa tôm): trỏ/giữa/áp út hở lưng máy 5–6 ở cả `tilt` 20,6 và 5 (dáng `span` không khép). Sau sửa ảnh đỡ hơn (máy trong lòng tay) nhưng check vẫn báo.

## Ngoài phạm vi cảnh

- t02-s042-lam-lai: đĩa tôm xoay 38° lúc tay kẹp (1,85 s) vì chỗ đĩa nằm trên bàn đặt ở `src/khoi3d/t02.ts` (`CHO_DIA`) — cần chủ dự án/agent sửa src nếu muốn hết.

## Check (mọi luật, trước → sau)

| cảnh | trước | sau | ghi chú |
|---|---|---|---|
| t02-s041-nguoi | 0 lỗi, 14 cảnh báo | 0 lỗi, 14 cảnh báo | cùng bộ cảnh báo, số đo đổi nhẹ |
| t02-s042-lam-lai | 0 / 12 | — | không sửa |
| t02-s043-bep-2 | 0 / 13 | — | không sửa |
| t02-s044-cham | 0 / 7 | — | không sửa (lượt đầu bị s001 hỏng JSON, đã chạy lại) |
| t02-s045-cui | 0 / 16 | — | không sửa |
| t02-s048-vo-tom | 0 / 0 | — | không sửa |
| t02-s049-da-trong | 0 / 8 | — | không sửa |
| t02-s050-them-bo | 0 / 3 | — | không sửa |
| t02-s051-bep-3 | 0 / 9 | 0 / 8 | hết `món không chạm bàn tay` của phieu-lien |
| t02-s052-o1-sofa | 0 / 1 | 0 / 1 | không đổi |
| t02-s052-o2-giuong | 0 / 1 | 0 / 1 | không đổi |
| t02-s052-o3-chi-be | 0 / 0 | 0 / 0 | |
| t02-s052-o4-ben-kinh | 0 / 0 | 0 / 0 | |
| t02-s053-hanh-lang | 0 / 0 | — | không sửa |
