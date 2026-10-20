# Chụp lại ảnh "trước" (T0b)

Rig: commit `c925657` (worktree `~/Work/Dev/stickman-studio-3d-truoc`, `pnpm install && pnpm build`).
Video: worktree `~/Work/Dev/youtube-video/jp-sukatto-truoc`, detached ở `a7db3b5` (tổ tiên của `auto/nhom-cam`), `pnpm rig local ../../stickman-studio-3d-truoc`; `pnpm rig` báo link về `stickman-studio-3d-truoc`.
Lý do không dùng đầu `auto/nhom-cam` (`66fcb61`): từ `ea27a14` repo video thêm `held/thu-*.json` (món v2, schema 1) mà rig `c925657` từ chối nên `can-tay` (bundle Remotion nạp cả `held/`) đổ. `a7db3b5..HEAD` chỉ THÊM `held-v2/`, `held/thu-*`, `scenes/thu-nhom-cam.json`, `luoi-mon.ts`, `thu-grip.ts` và sửa `tools/bang-cam.mjs`, `tools/held-moc.mjs` — dữ liệu t02 và `can-tay.mjs`/`cam-do.mjs` giống hệt.

## cam-do (chứng minh rig đúng bản)
Đối số: mọi (cảnh, giây) của `lan-cam.json` (61 cảnh, 160 cặp), mỗi cảnh một cặp `<cảnh> <giây,giây…>`:

    cd ~/Work/Dev/youtube-video/jp-sukatto-truoc
    pnpm -s cam-do t02-s001-tham-thi 0.3,4.71 t02-s002-day 0.3,1.2 … > cam-do-moi.txt

Kết quả: 301 dòng, `diff` với `truoc/cam-do.txt` = GIỐNG TỪNG BYTE (14 `!!`, thoát mã 1 vì có `!!`).

## can-tay
Chạy `truoc/chup.py` (cùng thư mục này), `python3 chup.py` — mỗi cảnh một lệnh:

    pnpm -s can-tay <cảnh> <giây∪ các lần cầm của cảnh> --ai <người cầm của cảnh> --out ~/Work/Dev/stickman-studio-3d-nhom-cam/tmp/nhom-cam/truoc/can-tay --tab 2

Góc mặc định `truoc,cheo,ngang`. Chạy tuần tự, `nice -n 19`, ~16 phút cho 61 cảnh. Mỗi cảnh ra `can-tay/<cảnh>.jpg` (bảng) và `can-tay/<cảnh>/<giây>-<người>-<tay>-<góc>.png`.
Giai đoạn 6 chụp "sau": cùng `chup.py`, đổi `OUT` sang thư mục `sau/can-tay` và worktree video trỏ rig mới.

## Số
- 61 bảng jpg, 1535 png (511 ô mỗi góc truoc/cheo/ngang + 2 ô `sau`), 1,3 GB.
- Ô đen (màu phẳng, max < 0,15): 70 — `truoc` 69/511, `ngang` 1/511, `cheo` 0/511. T0 báo `truoc` 50/407 (12,3%); nay 13,5%. Mọi cặp (cảnh, giây, người) có ít nhất góc `cheo` dùng được.
- Nhiều hơn T0 (673 MB, 407 ô `truoc`) vì `--ai`/giây là hợp của cả cảnh nên có thêm ô của người không cầm ở giây ấy (vd s038 yoshie 1,3). Phủ đủ 160 cặp.

## Soi mắt
- `s013-khoe/1.4-takumi-tay-phải-cheo`: takumi tay phải cầm điện thoại, ngón ôm cạnh máy — đúng.
- `s012-chia-khoa/5.75-yota-tay-trái-cheo`: yota đặt thẻ phòng bằng ngón trỏ lên mặt quầy — đúng.
- `s020-goi/3.46-yota-tay-trái-cheo`: tay trái cầm ống nghe bàn áp tai, lòng tay phẳng đỡ thân ống — đúng.
- `s038-tom/1-yoshie-tay-trái-cheo`: tay trái yoshie đỡ mép đĩa tôm hùm — đúng. (`1.3-yoshie-tay-phải-cheo` bị thân erika che kín: ô thừa, người này không cầm lúc 1,3.)
