# Bàn giao T02-0

- Check đầy đủ mọi luật (`check-dau.txt` gốc) chạy quá 20 phút (timeout 124), hai lần: một lần mặc định, một lần `--jobs 12`.
  Nhóm `hands` tốn ~80 giây CPU mỗi cảnh (74 cảnh) nên không xong trong 20 phút.
- `check-dau.txt` hiện là lượt `--only ref,held,legacy,clash` (74 cảnh, đủ). Nhóm `move`, `hands` CHƯA có kết quả cho t02.
- Muốn có `hands`: chạy theo cụm cảnh nhỏ (`--scene '^t02-s0[0-2]'` …, mỗi cụm 10–15 cảnh) hoặc theo từng lô.
- `check-dau-baseline.txt`: `--only ref,held,clash --baseline check-held-clash-g6.json`: 1 lỗi, 25 cảnh báo; 20 mới, 5 nặng hơn, 23 đã hết.
