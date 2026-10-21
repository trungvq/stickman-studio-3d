# G4-A3 — `bowl` `pinch` (kẹp chén nhỏ) và luật `oppose`

- Biến thể `pinch`, dáng `cupPinch`, mặc định khi `rMax ≤ 0,7·W` (`BOWL_PINCH_MAX`); số đo ở `bang-cam-so.txt` (bảng `bang-cam --nhom bowl --mon thu-chen`), vùng chạm dọc thành ở `span.ts`.
- Ảnh: `duyet/g4-bowl-kep.jpg` (hàng mẫu trống: `mau/chen-ruou-2.jpg` chưa có; `chen-ruou.png` bị loại), `duyet/g4-bowl-kep-s033.jpg`.
- `check` t02 `ref,held,clash` so `baseline/check-held-clash-g6.json`: `check-final.log` / `.json` (0 lỗi; 19 mới, 4 nặng hơn, 5 hết).
  - Của việc này: 11 `oppose` mới — `ong-nghe-ban@cylinder` `flat` s017, s018, s020, s021, s022 (yota tay trái, 0°), `ong-nghe@cylinder` `flat` s052-o1, o3, o4 (3–8°), `thuc-don@sheet` `flat` s034, s035, s036 (takumi tay phải, 24–28°); s033 `takumi.upperArmR ↔ ghe-cap-0` 6,21 → 8,97.
  - Của việc `card` đang làm dở (không phải việc này): `the-phong` s012, s013, s028 (món nghiêng, món nhảy, lồng quầy) và 5 dòng hết.
- Cảnh video sửa (không commit): `scenes/t02-s033-ruou-tang.json` — bỏ `along: 0.138` (của `side`, đếm từ đáy) ở 4 mốc cầm chén, nâng đích tay 5,5 (`offset` miệng 12 → 6,5; `at` y −200 → −205,5, −151 → −156,5 ở 0,85 / 1,15 / 1,3 s) vì tâm nắm `pinch` là trục chén ngang tầm ngón (2,25 dưới miệng) thay vì 1,24 trên đáy.
- Cổng: `g-type.log`, `g-lint.log`, `g-fmt.log`, `g-test.log` (rig 1113, sketch 245, fx 44, cli 71), `g-build.log`; video `video-test.log`.
