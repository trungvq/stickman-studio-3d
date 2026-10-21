# Tự chấm các tờ duyệt nhóm cầm (2026-10-21)

Tiêu chí: **đối** (ngón cái ép đối ngón khác / đỡ dưới trọng tâm), **chiều** (món đúng chiều, đồ ăn không đổ), **tay** (cổ tay, cánh tay tự nhiên, không `!!`), **xuyên**, **dáng** (đúng loại cầm: kẹp đầu ngón hay nắm). So v1: tốt hơn / bằng / tệ hơn.

| Tờ | Kết luận | Lỗi | So v1 |
|---|---|---|---|
| `g4-handle` | Đạt | Móc quai đúng | bằng |
| `g4-sheet-pinch-truoc-sau`, `g4-sheet-mac-dinh` (hàng sau) | Đạt | Ngón cái mặt trước, ngón sau, kẹp mép bảng | tốt hơn (flat cũ úp lòng tay lên mặt bảng) |
| `g4-platform-tong` hàng chai hai tay | Đạt | Một tay ôm thân, tay kia đỡ đáy | — |
| `g4-carry` treo khuỷu | Tạm | Túi sát thân (khe 0) | bằng |
| `g4-cylinder-wrap` (chai) | Tạm | Nắm thân chai, ngón cái không thấy ôm sang phía đối | khác chỗ (v1 nắm vai chai) |
| `g4-palmBox` mặc định, áp tai | Tạm | Cầm điện thoại được | bằng |
| `g4-card-lateral` khoe (tay dẫn, rig chọn), đưa qua quầy, cầm xem sakura | Đạt (chờ chủ dự án) | Thẻ dựng trên nắm tay / chìa ra trước nắm tay, cái đối sườn trỏ qua thẻ (180°), nắm tay chỉ chạm góc gần mép | tốt hơn |
| `g4-card-lateral` cầm xem kuroiwa, cầm xem tay trái, khoe tay trái, mặc định ngang ngực | Tạm | Kuroiwa: rig kẹp mép bên, thẻ nằm cạnh nắm tay (cổ tay rẻ hơn); khoe tay trái thẻ nghiêng chừng 25° (cổ tay kẹp `dev`); thẻ ngang ngực nhìn nghiêng mỏng | tốt hơn |
| `g4-card-lateral-t02` | Tạm | Thẻ thấy rõ ở mọi ô; s012 thẻ bật xoay lúc 拓海 nhặt (6,70), nắm tay lún vào quầy lúc đặt thẻ (s012 6,0, s028 4,3) | tốt hơn |
| `g4-bowl` | Hỏng (chủ dự án) | Không **đối**: lòng, ngón, ngón cái cùng một phía | tệ hơn |
| `g4-chopsticks` | Hỏng (chủ dự án) | **Chiều** ngược đầu; **dáng** đầu ngón thay vì kẹp; **tay** cổ tay vượt 31°, vắt ra sau cổ; ngón hở 2–4 | tệ hơn |
| `g4-card-pad` | Hỏng (chủ dự án) | Đã thay bằng `lateral` (`g4-card-lateral`) | — |
| `g4-carry` treo vai | Hỏng (chủ dự án) | **Xuyên** quai vào vai/thân 5,2–5,7 | bằng |
| `g4-pen` | Hỏng | **Dáng**: bút nằm trong nắm tay như cầm dao, không phải ba ngón (cái + trỏ kẹp, tựa ngón giữa) | bằng (v1 cũng sai) |
| `g4-cylinder-ong-nghe-truoc-sau` | Hỏng | Trước: xuyên 1,5, lún 3,4; sau: nắm mặt lưng, cổ tay vượt 20° (`!!`) | — |
| `g4-cylinder-ap-tai` | Hỏng | Không **đối**: lòng tay áp phẳng, ngón duỗi thẳng, không gì giữ ống nghe | bằng (v1 cũng vậy) |
| `g4-cylinder-cai-truoc-sau` | Cần sửa | Ngón cái dựng thẳng dọc chai như "like", không ôm | khác |
| `g4-platform-palm` | Hỏng | Không **đối**: một tay đỡ ở mép khay/phiếu, món chìa xa, không dưới trọng tâm | bằng |
| `g4-palmBox` đọc ngang mặt, khoe một tay | Hỏng | **Tay**: cổ tay vượt 10–32° (`!!`), ngón hở | — |
| `g4-sheet-rim`, `g4-sheet-dia`, `g4-sheet-be-day-mep` (đĩa tôm hùm, đĩa bò) | Hỏng | **Chiều**: đĩa đồ ăn dựng gần đứng trước ngực (hướng mặc định của giấy) — đồ ăn đổ; một tay kẹp mép đĩa nặng; ô `flat` sau trống | bằng |
| `g4-sheet-rim` báo | Tạm | Kẹp mép báo được | bằng |

## Lỗi chung (sửa ở gốc, không sửa từng tờ)

1. **Không kiểm lực đối** — bowl, áp tai, platform một tay. Luật `check` mới: ngón cái đối ngón khác; `platform` một tay phải đỡ dưới trọng tâm.
2. **Dáng sai loại** — bút, đũa, chén nhỏ cần kẹp đầu ngón (precision), rig dùng nắm (power).
3. **Hướng món mặc định theo nhóm, không theo món** — đĩa đồ ăn mượn hướng của giấy nên dựng đứng; đũa ngược đầu. Cần hướng mặc định theo loại món (đĩa giữ ngang) và kiểm chiều `tip`.
4. **Hàng mẫu đặt món ở chỗ cổ tay không tới** — rig vặn tay thay vì báo; tờ còn `!!` vẫn đưa duyệt.
5. **Xuyên thân** — túi đeo vai.
