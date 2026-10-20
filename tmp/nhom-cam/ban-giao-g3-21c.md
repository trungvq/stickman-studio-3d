# Bàn giao G3-21c — `thu-nhom-cam` (chưa xong, dừng theo luật tắc)

Trạng thái: `scenes/thu-nhom-cam.json` ở video **đã khôi phục về bản gốc** (không sửa gì). Check hiện vẫn 1 lỗi, 4 cảnh báo
(`g321c-check-thu.txt`). Không commit; `tools/bang-cam.mjs` đang sửa là của G3-19, không phải của job này.

## Phát hiện (đo bằng cảnh tĩnh: một hướng bảng cố định cả cảnh, đọc số cổ tay tệ nhất)
- `toward: "camera"` thực ra là a ≈ ±150..180° so với `holderFace` (a = 0): lật bảng 180° quanh trục đứng, không phải 90°.
  Mốc trung gian 2,25 của cảnh (`toward [0,-0.3,1]`, a ≈ -90°) nằm ngay giữa vùng chết của cả hai chỗ cầm.
- Quy ước a: `toward = [-cos a, 0, -sin a]`, offset `[45,-2,0]`/`[40,-2,0]`.
- Chỗ cầm đầu H1 = `edge right, thumb front, along 0.33, slant 0` (pinch): đạt a ∈ [-30°, 60°]; a=90 vượt 4,9°; a=100 vượt 16°;
  a=130 vượt 7°; a=-60 vượt 29°; a=-90 vượt 99° (lệch 119°).
- Chỗ cầm sau H2 = `edge left, thumb back, along 0.5, pinch`: đạt a ≤ -150° và a ≥ 130° (130: còn 1°; 160: ổn); a=100 vượt 39°;
  a=-90 vượt 19,5°; a=0..90 vượt 67–100°.
- Vùng a ∈ [~65°, ~125°] (và [-120°, -35°] phía kia) không chỗ cầm một tay nào đạt (đã thử pinch/flat/rim, slant -30/0/30,
  along 0,2/0,5, edge/thumb đủ bốn tổ hợp ở "camera"). Đổi chỗ cầm giữa chừng vẫn dính vì hướng trung gian nằm trong vùng chết.
- `slant: 0` ở chỗ cầm đầu làm hết cảnh báo gần kẹp 0–2 s (xoay -87 → ổn); cái còn lại là hướng bảng quanh 2,2 s.
- Lấn thân↔bảng 5,6: do bảng tâm 30 quay tại chỗ (nửa rộng 22). Đẩy tâm ra ≥ 45 ở mốc 2,25 hết lấn thân, nhưng cổ tay xấu hơn.
- `check` chạy theo tên cảnh: đổi tên file/`name` sang `zz-*` thì check báo "Không thấy vấn đề gì" (bỏ qua luật held) — sweep phải
  sửa thẳng `scenes/thu-nhom-cam.json` rồi khôi phục (`sweep.py`).

## Đã thử (đều không đạt 0 lỗi)
| Thử | Kết quả tệ nhất |
|---|---|
| Đổi chỗ cầm phải sang 2,0 / 2,15 / 2,2 | vượt 97° / 44° / 43° |
| Bỏ mốc 2,25, giữ cầm H2 | 0 lỗi cổ tay nhưng tay xuyên thân 29, khuỷu nhảy 53 px, bảng lấn thân 9 |
| Giữ H1 suốt (không đổi chỗ cầm) | vượt 102° (bảng ngoài tầm tay) |
| Đổi `slant`/`along` chỗ cầm đầu | slant 0 hết lỗi 0–2 s, lỗi 2,2 s còn 27–63° |
| Dời mốc 2,25 offset [32..50, -2, 0..30] | vượt 38–93° |
| Cầm cạnh `bottom` hai tay | vượt 8–108°, tay xuyên thân |
| Quay trực tiếp tới a=60..75 (ảnh `can-tay-thu-flat-a70.jpg`), bàn tay phải `flat along 0.2 slant 0` | tay phải 0 lỗi (còn gần kẹp 3,1°), nhưng bảng chỉ xoay 70°, tay trái không có chỗ cầm đạt (vượt 36–106°); tư thế `flat` lúc đọc nhìn gượng (lòng bàn tay phẳng, ngón xoè) |
| Đổi chỗ cầm ở S = ±100/±115/110/125 giữa chừng | vượt 28–114° ở 2,1–2,2 s |

## Đề xuất bước kế (chọn một)
1. Đổi ý cảnh cho vừa giải phẫu: tay phải đọc rồi để bảng hạ xuống ngang bụng, tay trái đưa sang đỡ, rồi **tay trái lật** (tay trái chưa dùng
   khi đọc); hoặc lật bảng bằng cách buông tay phải (hold null) ở 2,1–2,3 trong lúc bảng nằm ở tay trái (cần mốc món + chỗ cầm tay trái
   `edge left` cùng lúc), tay phải bắt lại ở 2,5 với H2 (a=180 đạt).
2. Nếu chấp nhận bảng quay 60–70° thay vì mặt thẳng camera: dùng `flat along 0.2 slant 0` tay phải + tìm chỗ cầm tay trái (chưa có).
3. Xin rig (giai đoạn 4): chỗ cầm xoay mềm (đổi `thumb` giữa chừng) hay kẹp cổ tay rộng hơn ở `sheet`; vùng chết 65–125° là giới hạn khớp.
4. Hướng dễ nhất để thử trước: cầm hai tay ngay từ 2,0 (tay trái bắt cạnh đối diện khi bảng còn a=0), rồi quay cả hai tay cùng lúc.
   Chưa thử.

Tệp số liệu: `g321c/sweep.py`, `s5.py`, `s7.py`, `s8.py` (khung quét, cần `/tmp/thu-orig.json` = bản gốc), ảnh cận tay: `g321c/can-tay-goc.jpg`
(bản gốc ở 1, 2,1, 2,4, 3,5 s), `g321c/can-tay-thu-flat-a70.jpg` (thử flat, 1 và 3,5 s).
