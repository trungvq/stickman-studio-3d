# Tiến độ nhóm cầm

Worktree studio: `~/Work/Dev/stickman-studio-3d-nhom-cam` (nhánh `feat/nhom-cam`)
Worktree video: `~/Work/Dev/youtube-video/jp-sukatto-nhom-cam` (nhánh `auto/nhom-cam`, từ `origin/auto/t02-build`)

## Đang làm
Giai đoạn 3 — lõi. Kế hoạch job: `tmp/nhom-cam/gd3-ke-hoach.md` (đang lập).

## Tóm tắt bước 0 (xong)
- Prototype `b0/grasp.mts`: graspFrame `sheet` pinch/flat/rim (khớp fixture ≤ 0,27°), `cylinder` wrap trên rod; bàn tay từ món; khuỷu E(φ); giải lựa chọn thiếu.
- Render đi đường act3 thật (`b0/hinh/ve.mjs`), hai vòng; ảnh duyệt `duyet/b0-vong2-{1,2,3}.jpg`.
- Chốt `w_down 0,3`, `w_body 10`, `w_cont 2`; thụt pinch 2,5 / flat 5 / rim 1; chi phí φ 0,38 ms/mẫu.
- Rig tự chọn `thumb: back` khi khoe (mặt ra khách), `rim` cho đỡ cạnh dưới.
- Còn cho giai đoạn 4: ngón `rim` hở 5,8–10,9; `fist` lún 1,47 trên cán r 2,5 (fixture cổ chai 0,39).
- Review Fable một vòng → `review-b0.md`; spec đã sửa đủ 14 + 6 điểm.

## Dựng worktree (xong 2026-10-20 02:10)
- Studio: `pnpm install`, `pnpm build` xanh.
- Video: `pnpm install`, `pnpm rig local ../../stickman-studio-3d-nhom-cam` → `pnpm rig` báo link; `pnpm check --scene '^t02-s023'` chạy được (0 lỗi, 1 cảnh báo `takumi.handL ↔ quay lấn 5.1`).
- File bị gitignore: symlink TỪNG FILE từ checkout chính (`assets/audio/**`, `.env`, `research/data/**`; 3578 symlink). Không symlink thư mục vì mẫu ignore có `/` nên git thấy symlink thư mục là untracked. Không có `.venv` ở checkout chính.
- 3 file cấm commit ở video: `package.json`, `pnpm-lock.yaml`, `remotion.config.ts`.
- `pnpm check --help` KHÔNG in help mà chạy check cả workspace — đọc usage ở `packages/cli/cli.mjs:27`.

## Job
| Job | Trạng thái | Đầu ra |
|---|---|---|
| B0a prototype graspFrame + khuỷu E(φ), bảng số 5 ca | vòng 1 xong (fixture `bang-gia#doc` lệch 0,27°/0,07; φ một mẫu 0,38 ms; giải lựa chọn 8 ứng viên 3 ms). Vòng 2 đang chạy: rig giải trường không khai, soát khung ca 4 (`dev −134` nghi lỗi) | `tmp/nhom-cam/b0/grasp.mts`, `ca.json` |
| B0b render vòng 1 | xong: `b0/hinh/vong1/to-{1,2,3}.jpg`. Đã xem: c1–c3 ổn; c4 gãy cổ tay (chỉ có `pinch`); c5 cán chọc đầu, tay trái ép ngực, khuỷu nhảy 50°/mẫu. Lún 0,89 (bảng), 1,47 (cán r 2,5) |
| B0a vòng 3 + B0b render vòng 2 | xong — chốt trọng số, kết quả ở `b0/ket-qua.md`, ảnh `b0/hinh/vong2/` |
| Review Fable spec mục 4–5 + ảnh bước 0 (T3 task `nhom-cam-b0-review-1`) | xong: 14 lỗ hổng + 6 câu chữ, nhận hết | `review-b0.md` |
| B0c sửa spec theo review | xong | `docs/11-nhom-cam.md` |
| T0 ảnh "trước" mọi lần cầm t02 (`cam-do`, `can-tay`) | xong: 142 lần cầm / 61 cảnh, 160 cặp (cảnh, giây); góc `cheo` dùng được, `truoc` 50/407 ô đen; `cam-do` 14 `!!` đều `but-bi#cup` (cờ cũ) | `tmp/nhom-cam/truoc/` |
| Baseline `check --scene ^t02- --only held,clash` | xong: 0 lỗi, 193 cảnh báo, 2m16 | `tmp/nhom-cam/baseline/check-held-clash.{json,txt}` |

## Đã tự quyết
- Xoay cẳng tay vượt ±90 (ca đỡ đáy tấm cần −103): GIỮ kẹp hiện có của rig (±90, ±`AIM_BEND`, ±`AIM_DEV`); nghiệm vượt vẽ theo kẹp, khuỷu giữ φ, `check` báo `wrist`.
- Bước 0 dừng ở vòng 2 (không cần vòng 3): khuỷu, cổ tay ổn ở ca 1, 2, 3, 5; ca 4 còn vượt xoay cẳng tay (thành cảnh báo `wrist` theo spec) và ngón hở — việc của dáng ngón giai đoạn 4. Chốt `w_down 0,3`, `w_body 10`, `w_cont 2`.
- Bước 0 vòng 2: `w_cont` 0,2 → 2 (khuỷu nhảy 50°/mẫu ở ca 5). Ca 5 đặt cán chéo trước người kiểu cầm chổi thay vì đứng sát vai (ví dụ cuốc của spec chọc vào đầu chibi). Ca 1 nâng bảng lên giữa ngực, ca 2 đẩy bảng xa mặt ≥ 8 — chỗ đặt món là việc của cảnh, không đổi bộ giải.
- Ca 1 bước 0: `holderFace` từ ngực+30 lên mắt ngẩng 84° (đầu chibi to) → bảng gần ngửa, trục suy biến. Khai thẳng hướng hệ thân `[−1,−1,0]` (lùi, lên 45°). Ghi vào review spec: `holderFace` cần định nghĩa lại hay giới hạn góc ngẩng.
- `d` của `sheet` viết `c·W`, `c = 0,1553` (khớp `bang-gia#doc` ở cỡ takumi, W 16,1).
- Giới hạn xoay cẳng tay 90° lấy theo kẹp trong `aimWrist` (lõi chưa export hằng số).
- Ảnh "trước" (673 MB, `tmp/nhom-cam/truoc/can-tay/`) không commit; chỉ commit `lan-cam.{json,md}`, `cam-do.txt`. Phiên khác mất ảnh thì chụp lại từ commit `c925657` của rig.

## Cần chủ dự án
- Có nới kẹp xoay cẳng tay quá ±90 không? Ca "khoe, một tay đỡ cạnh dưới" (bước 0 ca 4, `rim`) cần −103; hiện thành cảnh báo `wrist` và bàn tay lệch chỗ cầm chút ít. Ảnh: `tmp/nhom-cam/b0/hinh/vong2/to-2.jpg`.

## Bước kế
