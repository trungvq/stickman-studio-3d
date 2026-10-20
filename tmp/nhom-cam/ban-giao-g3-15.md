# Bàn giao G3-15 (dừng ở bước check t02)

## Đã xong
- `packages/rig/src/held.ts`: kiểu cầm cứng (có `shape`) đo lún, khe theo ngón/nhóm bằng `skinDepth(h.geo.attributes.position.array, skinPieces(h.skin), IF, shape)`; `gaps` nhóm = cực tiểu các ngón trong nhóm; `pierce.core` vẫn đo trên trục nang (`capsuleClearance` trên `handCaps`), `pierce.depth` là lún da của đốt ấy. Đường không có `shape` (lưới món) giữ `capsuleDepth`.
- `HeldHand.grasp?: GraspReport` (`core/heldAudit.ts`, chỉ thêm trường + import type), điền từ `fig.aim[..].hold.grasp`.
- Test mới `packages/rig/src/heldSkin.test.ts` (`held.test.ts` không sửa, xanh).
- Studio: typecheck, lint, format:check, test (245), build đều xanh — log `tmp/nhom-cam/g315-*.log`.

## Số trước/sau (bang-gia@sheet, pinch, giây 0,5)
| | nang (cũ) | da (mới) |
|---|---|---|
| lún lớn nhất | 3,27 (lòng tay) | 0,50 (ngón út) |
| thumb / index / fingers / palm (khe, âm = lún) | 1,81 / -1,20 / -1,58 / -3,27 | 3,07 / -0,13 / -0,50 / -0,42 |

## Tắc: check t02 ra 9 cảnh báo mới (`loose`, 0 lỗi, 0 nặng hơn)
`g315-check-t02.txt`. Cùng một kiểu cầm `tom-hum#nhac` (đường cũ, tay `yoshie`/`yoshie-di`, "không ngón nào, lòng tay cũng không chạm"):
| cảnh | tay | món | khe nhỏ nhất mới |
|---|---|---|---|
| t02-s038-tom, s039-dat-lai-1, s040-dat-lai-2, s041-nguoi, s043-bep-2, s044-cham (yoshie), s044-cham (yoshie-di), s045-cui | tay cầm | tom-hum#nhac | 1,5–2,0 |
| t02-s042-lam-lai (giây 1,9–3,6) | tay cầm | tom-hum#nhac | 8,0 |

Nhóm khe tom-hum#nhac (cùng khung): cũ thumb -1,99, index -0,22, palm 0,26, fingers 6,21; mới thumb 0,16, index 0,11, palm 1,69, fingers 6,85. Nang cũ phình quanh da nên "chạm" ngón cái 2,0 trong khi da cách 0,16.

## Đề xuất
Không nới ngưỡng. Hai hướng: (a) `loose` (`heldAudit.ts`, G3-16) đọc ngưỡng theo thước da; (b) sửa kiểu cầm `held/tom-hum.json#nhac` cho ngón/lòng tay khép tới món (lòng tay đang cách 1,7–5, s042 cách 8). Cần chủ dự án chọn rồi mới nhận baseline mới.
Ghi chú: `bang-gia@sheet` thumb: front khe 3,07 (ngón cái không chạm mặt trước ở dáng pinch) — việc của G3-16/ngón, không đụng ở đây.
