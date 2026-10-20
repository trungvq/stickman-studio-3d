# So `check` t02 (G6-2+3) với baseline g315

Lệnh: `stickman check --scene '^t02-' --only ref,held,clash --baseline baseline/check-held-clash-g315.json` (log `g6/check-t02.log`); baseline ứng viên `baseline/check-held-clash-g6.json` (226 cảnh báo, `--save-baseline`).

**0 lỗi.** Cảnh báo: g315 202 → g6 226; so baseline: 34 mới, 2 nặng hơn (ngưỡng của `check`), 10 đã hết; 24 cảnh báo tăng nhẹ dưới ngưỡng `check` (không kể).

Luật v2 khác v1 nên không đòi 0 mới. Phân loại: **thật** — lồng/xuyên (`clash`), lún > 0,65 (`sink`), cổ tay vượt (`wrist`), `reach`; **v2** — luật nhóm mới báo (`role`: ngón theo vai trò chưa chạm, thay `wrap`/`loose` của v1); **hở** — `loose` (món không chạm bàn tay).

Cột "Tay" của `clash` là bên của phần người lồng (`—` cho thân, đầu, `armNear/Far`); nhóm theo kiểu cũ của chính tay ấy, tay không cầm thì theo kiểu cũ của món bị chạm trong cảnh.

| | thật | v2 | hở |
|---|---|---|---|
| mới | 9 | 24 | 1 |
| nặng hơn | 2 | 0 | 0 |

## `tom-hum#nhac`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s038-tom | yoshie | L | `role` | tom-hum | — → 3,43 | mới | v2 |
| t02-s038-tom | yoshie | L | `loose` | tom-hum | 1,63 → — | hết | hết |
| t02-s038-tom | yoshie | R | `role` | tom-hum | — → 3,42 | mới | v2 |
| t02-s039-dat-lai-1 | yoshie | L | `role` | tom-hum | — → 3,43 | mới | v2 |
| t02-s039-dat-lai-1 | yoshie | L | `loose` | tom-hum | 1,60 → — | hết | hết |
| t02-s039-dat-lai-1 | yoshie | R | `role` | tom-hum | — → 3,42 | mới | v2 |
| t02-s040-dat-lai-2 | yoshie | L | `role` | tom-hum | — → 3,43 | mới | v2 |
| t02-s040-dat-lai-2 | yoshie | L | `loose` | tom-hum | 1,63 → — | hết | hết |
| t02-s040-dat-lai-2 | yoshie | R | `role` | tom-hum | — → 3,42 | mới | v2 |
| t02-s041-nguoi | yoshie | L | `role` | tom-hum | — → 3,43 | mới | v2 |
| t02-s041-nguoi | yoshie | L | `loose` | tom-hum | 1,60 → — | hết | hết |
| t02-s041-nguoi | yoshie | R | `role` | tom-hum | — → 3,42 | mới | v2 |
| t02-s042-lam-lai | yoshie | L | `role` | tom-hum | — → 3,43 | mới | v2 |
| t02-s042-lam-lai | yoshie | L | `loose` | tom-hum | 7,97 → — | hết | hết |
| t02-s042-lam-lai | yoshie | R | `role` | tom-hum | — → 3,42 | mới | v2 |
| t02-s043-bep-2 | yoshie | L | `role` | tom-hum | — → 3,42 | mới | v2 |
| t02-s043-bep-2 | yoshie | L | `loose` | tom-hum | 1,58 → — | hết | hết |
| t02-s043-bep-2 | yoshie | R | `role` | tom-hum | — → 3,42 | mới | v2 |
| t02-s044-cham | yoshie | L | `role` | tom-hum | — → 3,42 | mới | v2 |
| t02-s044-cham | yoshie | L | `loose` | tom-hum | 1,59 → — | hết | hết |
| t02-s044-cham | yoshie | R | `role` | tom-hum | — → 3,42 | mới | v2 |
| t02-s044-cham | yoshie-di | L | `role` | tom-hum | — → 3,40 | mới | v2 |
| t02-s044-cham | yoshie-di | L | `loose` | tom-hum | 1,51 → — | hết | hết |
| t02-s044-cham | yoshie-di | R | `role` | tom-hum | — → 3,42 | mới | v2 |
| t02-s045-cui | yoshie | L | `role` | tom-hum | — → 3,43 | mới | v2 |
| t02-s045-cui | yoshie | L | `loose` | tom-hum | 2,02 → — | hết | hết |
| t02-s045-cui | yoshie | R | `role` | tom-hum | — → 3,42 | mới | v2 |

## `dien-thoai#cam`, `dien-thoai#doc`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s060-mot-dem | erika | R | `clash` | foreArmR ↔ dien-thoai-tay | — → 12,47 | mới | thật |
| t02-s060-mot-dem | erika | R | `clash` | handR ↔ dien-thoai-tay | — → 6,63 | mới | thật |

## `dien-thoai#doc`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s041-nguoi | erika | R | `role` | dien-thoai | — → 6,34 | mới | v2 |
| t02-s041-nguoi | erika | R | `wrap` | dien-thoai | 6,34 → — | hết | hết |

## `dua#cam`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s034-goi-them | takumi | R | `role` | dua | — → 1,86 | mới | v2 |
| t02-s050-them-bo | takumi | R | `role` | dua | — → 1,86 | mới | v2 |

## `khay#bung`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s053-hanh-lang | yota | L | `sink` | khay | — → 0,70 | mới | thật |
| t02-s055-nhan-viec | yota | L | `sink` | khay | — → 0,70 | mới | thật |

## `the-phong#cam`, `the-phong#kep`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s028-doi-chia | takumi | R | `role` | the-phong | — → 1,51 | mới | v2 |
| t02-s028-doi-chia | takumi | R | `clash` | handR ↔ quay | 3,83 → 7,43 | nặng hơn | thật |

## `but#viet`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s028-doi-chia | yota | L | `clash` | handL ↔ but-bi | — → 6,64 | mới | thật |

## `chai-dac-tuyen#xem`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s060-mot-dem | takumi | R | `clash` | foreArmR ↔ chai-dac-tuyen-chiaki-nhan | 6,29 → 8,79 | nặng hơn | thật |

## `dien-thoai#bam`, `dien-thoai#doc`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s026-tra-ten | takumi | L | `clash` | handL ↔ dien-thoai-tay | — → 3,33 | mới | thật |

## `khay-suat#bung`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s030-khai-vi | yoshie-di | L | `sink` | khay-suat | — → 1,83 | mới | thật |

## `phieu#do`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s050-them-bo | yoshie | L | `clash` | handL ↔ but-bi | — → 3,53 | mới | thật |

## `phieu-lien#cam`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s051-bep-3 | yoshie | R | `loose` | phieu-lien | — → 1,01 | mới | hở |

## `the-phong#cam`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s029-mong-cho | takumi | R | `role` | the-phong | — → 1,51 | mới | v2 |

## `the-phong#kep`

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s012-chia-khoa | takumi | R | `role` | the-phong | — → 1,51 | mới | v2 |

## — (không cầm)

| Cảnh | Người | Tay | Luật | Chỗ | Cũ → mới | Trạng thái | Loại |
|---|---|---|---|---|---|---|---|
| t02-s028-doi-chia | yota | L | `clash` | handL ↔ ban-phim | — → 2,16 | mới | thật |

## Ghi chú "thật" (không sửa ở job này: 0 lỗi, chỉ cảnh báo; để G6-4 soi ảnh)

- `t02-s060-mot-dem` erika tay phải (cẳng 12,5, bàn 6,6 ở 0,97–1,13 s) lồng vào điện thoại tay trái đang cầm `dien-thoai#cam` → `palmBox` `tilt 0`, `keep`, `regrip` (lệch 2,39, có trong `lech.json`).
- `t02-s060-mot-dem` takumi cẳng tay phải ↔ chai của chiaki-nhan 6,29 → 8,79 (1,06–1,13 s); tay ấy cầm `chai-dac-tuyen#xem` (lệch 0,7° / 0,54).
- `t02-s028-doi-chia` takumi bàn tay phải ↔ quầy 3,83 → 7,43 ở 3,78–3,88 s (`the-phong#cam` → `#kep`, đổi lần cầm); yota tay trái ↔ bút 6,6 (5,66–5,75 s) và ↔ bàn phím 2,2 (5,59 s), bút ở tay phải `but#viet` → `pen` (dời 0,23).
- `t02-s050-them-bo` yoshie tay trái (cầm `phieu#do`) ↔ bút ở tay phải 3,5 (1,00–1,19 s).
- `t02-s026-tra-ten` takumi tay trái (`dien-thoai#bam`) ↔ máy 3,3 (3,53–3,59 s).
- Lún: `t02-s030-khai-vi` yoshie-di tay phụ trái `khay-suat` 1,83 (0–0,9 s, `platform` `both`, lệch 1,74 đã biết); `t02-s053`, `t02-s055` yota tay phụ trái `khay` 0,70 (sát ngưỡng 0,65).
- Hở: `t02-s051-bep-3` `phieu-lien` khe 1,0 (1,6–2,1 s), lần cầm sửa tay `roll` (xem `migrate.md` cuối, `lech.json` `manual`); không khai `roll` cũng báo `loose`.
- `role` (24): luật v2 thay `loose`/`wrap` v1 — `tom-hum` `rim` ngón giữa 3,4 (thay 10 `loose` v1 đã hết), `the-phong` `card` ngón cái 1,5, `dua` `chopsticks` trỏ 1,9, `dien-thoai` `palmBox` s041 (cùng chỗ hở với `wrap` v1 đã hết).
