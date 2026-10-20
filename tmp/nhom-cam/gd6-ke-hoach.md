# Giai đoạn 6: chuyển cảnh t02 sang nhóm cầm, xoá đường v1

Nguồn: `docs/11-nhom-cam.md` mục 8 (bước 1–4, "Thứ gãy khi xoá v1"), Phụ lục A; `tien-do.md` dòng G5-1, G6-1, T0b.
Đã có trước: `held-v2/` (35 món, `held-moc` kiểm), `stickman migrate-held` (chạy khô 142 dòng, 117 chuyển, 4 chờ nhóm — nay đủ
nhóm), ảnh "trước" `truoc/can-tay/` + `truoc/chup.py`.

| Job | Việc | Repo / file | Đầu ra kiểm được | M |
|---|---|---|---|---|
| G6-2 | Chạy `migrate-held` thật trên `^t02-` (đọc v1 `held/`, nhãn `held-v2/`), ghi cảnh; sửa tay các lần cầm tool không diễn được (`phieu-lien#cam` `roll`) | video `scenes/t02-*.json` | 0 lần cầm v1 còn trong t02; bảng lệch `g6/migrate.md`; `check --only ref` t02 0 lỗi | O |
| G6-3 | Thay `held/` bằng `held-v2/` (giữ `thu-*`), bí danh `luoi-mon.ts`, `held-moc` bỏ kiểm v1 | video `held/`, `tools/held-moc.mjs`, `src/objects/luoi-mon.ts` | `pnpm test` xanh; `check --only ref,held,clash` t02 → bảng so baseline g315 theo cảnh·người·tay (luật v2 khác v1: liệt kê, không đòi 0 mới) | S |
| G6-4 | `pnpm cam-do`, ảnh "sau" bằng `truoc/chup.py` (`OUT` → `sau/can-tay`), `shot-doi-hinh.md`: cảnh · người · tay · cũ → mới · lệch, dải ảnh trước/sau cho mọi dòng lệch > 5° / 1 | studio `tmp/nhom-cam/sau/`, `shot-doi-hinh.md`, `duyet/g6-*` | mọi lần cầm lệch có ảnh trước/sau; agent chính mở ảnh | S |
| G6-5 | Xoá đường v1 ở rig: `grips`, `gripFrame`, `món#kiểu`, `HeldItemSchema` v1, `holdKind` v1, `bang-cam` chế độ kiểu cầm, luật `check` v1; nâng `SCENE_VERSION` (+ `migrate` cảnh cũ báo dùng `migrate-held`); xoá Phụ lục A và "Thứ gãy khi xoá v1" ở docs; fixture/test v1 | studio `packages/rig/src/core/*`, `src/attach.ts`, `held.ts`, cli, mcp, studio app, docs | cổng kiểm xanh; video `pnpm test` xanh; `check` t02 = kết quả G6-3 (không đổi); commit `feat(rig)!:` | O |
| G6-6 | Baseline mới `baseline/check-held-clash-g6.json`; `thu-nhom-cam` ≤ 1 lỗi; tóm tắt giai đoạn 6 | studio `tmp/nhom-cam/` | — | S |

Không nâng version gói (`8.0.0`) và không `pnpm release` — thuộc phát hành, chủ dự án làm.
