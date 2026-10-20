# G6-2c — chuyển 33 cảnh ngoài t02 sang `hold` v2

Video `jp-sukatto-nhom-cam` (nhánh `auto/nhom-cam`, HEAD `1f33d1a`), rig worktree `stickman-studio-3d-nhom-cam`. Không sửa rig/cli.

## Kết quả

- 33 cảnh, 107 lần cầm (+ 24 dòng tay phụ của `both`): 107 chuyển được, 0 chờ nhóm, 0 lỗi; 56 lần lệch quá 5° hay 1 đơn vị (**!**, shot đổi hình, chủ dự án duyệt). Món: 0 ghi (mọi món `khớp`).
- `stickman check --only ref` toàn repo (418 cảnh): **0 lỗi, 0 cảnh báo**.
- `stickman check --scene <33 cảnh> --only held,clash`: **0 lỗi, 125 cảnh báo** (bảng dưới).
- Không còn `hold` có `#` hay `{ item, grip }` ở bất kỳ `scenes/*.json`. `pnpm test` video xanh (`held: 53/53 món đạt`).

## Cách chạy

`held/` của video nay là v2, tool đọc v1 ở `<dir>/held/`. Dựng gốc tạm `tmp/mig-ngoai/` trong video: `held/` = `git show HEAD~1:held/*` (v1, trùng `66fcb61`), `held-v2/` = bản sao `held/` hiện tại, `characters` symlink, `scenes/` chỉ gồm symlink tới 33 cảnh (ghi đi xuyên symlink vào `scenes/` thật; cảnh t02 không nằm trong gốc tạm).

```
pnpm exec stickman migrate-held tmp/mig-ngoai --held-dir held-v2 --map tools/migrate-map.json [--dry-run] --out …
```

Bảng ánh xạ riêng của repo video: `tools/migrate-map.json` (36 dòng; 17 kiểu còn lại lấy `HOLD_MAP` của package). Bảng đầy đủ của tool: `ngoai-migrate.md` / `.json` cạnh file này.

## Ánh xạ kiểu riêng (`tools/migrate-map.json`) — vì sao

| Kiểu cũ | Nhóm | Lý do (dáng v1 → cách người cầm) |
|---|---|---|
| `dien-thoai#tai`, `#om`, `#ngang` | `palmBox` | dáng `span` lòng áp lưng máy như `#khoe`; `#om` có `both` → tay phụ `platform` (support của nhóm); áp tai: ý định màn → đầu, `touch self.head` xuống cảnh |
| `dien-thoai#quay` | `sheet` `rim`, `both` | quay ngang hai tay, lòng áp hai mép ngắn, ngón cái mặt màn; `pinch` lệch 90° |
| `kep-ho-so#om`, `phieu#om`, `khay#om` | `sheet` `rim`, `both` | v1 lòng áp mép, ngón dọc mặt (ôm ngực; `hug` để sau). `rim` kẹp `slant` ±45 nên còn 45°; `flat` quá dày (bìa 5,2) hay lệch 90°, `platform` 120°, `cylinder` vành khay 90° |
| `kep-ho-so#mo` | `sheet` `rim`, `both` | tay dẫn kẹp mép phải; tay phụ v1 là lòng áp gáy sau (`platform`) nhưng rig chỉ cho tay phụ cùng nhóm hay `support` của nhóm (`supportGroup`), nên tay phụ `sheet flat` gần nhất, lệch 11 |
| `khay-tra#bung`, `tom-hum#bung`, `chong-khan#om`, `so-tay#do` | `platform` | lòng ngửa đỡ đáy (dáng `flat`, lòng vào `bottom`/`back`) |
| `hoa-don#doc`, `bien-lai#doc`, `phieu#cam`, `phieu#kep` | `sheet` `flat` | dáng `edge`, lòng áp mặt sau, ngón cái vắt mép |
| `bang-gia#khoe` | `sheet` `pinch` | dáng `sheet` của v1 = fixture `pinch` |
| `bao#ha`, `bao#gon` | `sheet` `rim` | như `bao#doc` một tay, lòng áp mép phải |
| `the#cam`, `the#quet`, `giay-to#cam`, `giay-to#tra` | `card` | dáng `pinch` đầu ngón; `sheet` lệch nhiều hơn (5,3 / 42°) |
| `chia#cam` | `sheet` `rim` | nắm vòng chìa; `card` lệch 98°, `sheet pinch` 50°, `rim` 45° (`round` để sau) |
| `vali#keo`, `vali#dung` | `cylinder` `part: can` | nắm thanh ngang cần kéo (dáng `grip`) |
| `binh#co`, `binh#rot`, `binh#rot-hai` | `cylinder` | nắm vai bình; `rot-hai` có `both` → tay phụ `platform` đáy (support của nhóm). `rot` lệch 26°: v1 ngón chéo 30° với trục, `cylinder` không có trường xoay ngón |
| `chai-dia#rot-than` | `cylinder` `part: than` | nắm bụng chai |
| `ly-bia#quai` | `cylinder` `part: quai` | nắm quai đứng (`handle` chưa nhận quai cong) |
| `tui-hieu#vai` | `carry` (`on: shoulder`) | kiểu treo; `seats.shoulder = quai` có sẵn |
| `bo-dam#noi`, `bo-dam#cam` | `cylinder` `part: than` | nắm thân bộ đàm; `palmBox` chỉ đạt ở tay cỡ 2 |
| `khan#lau` | `platform` | lau bàn, lòng úp lên khăn (`soft` để sau). `sheet flat` lệch 0° nhưng khăn dày 4,5 > 0,24·W (lỗi `choice`); `pinch` 50°/9,4, `rim` 90°/14, `palmBox` 166°. `platform` đặt lòng ở mặt `bottom` (rig chọn mặt gần `−top`, cảnh không chọn được mặt) với ý định `bottom → down`: lòng vẫn úp xuống khăn, khăn lật 180° trong tay (hộp gần đối xứng, lớp `gom` mỏng ở mặt `top` quay ra ngoài) |

## Theo kiểu cũ

| Kiểu cũ | Bảng | Lần | Chỗ cầm v2 (tool ghi; nhiều dạng thì cách nhau `/`) | Góc max | Khoảng max | Tay phụ max |
|---|---|---|---|---|---|---|
| `chen#kep` | HOLD_MAP | 12 | bowl · part body · along 0.125 · around 180 / bowl · part body · along 0.144 · around 180 / bowl · part body · along 0.1 · around 180 | 4,0 | 1,79 **!** |  |
| `dien-thoai#khoe` | HOLD_MAP | 4 | palmBox · part body · along 0.344 · thumb right · tilt 0 · face: screen → camera · roll: top → up / palmBox · part body · along 0.344 · thumb left · tilt 0 · face: screen → camera · roll: top → up | 0,1 | 2,39 **!** |  |
| `dien-thoai#quay` | map | 4 | sheet · part body · edge top · along 0.5 · thumb front · variant rim · slant 0 · both · face: screen → back 15° · roll: edgeL → up | 0,0 | 3,00 **!** | 0,0 / 3,00 **!** |
| `dien-thoai#tai` | map | 4 | palmBox · part body · along 0.45 · thumb right · tilt 0 · face: screen → {"mark":"head"} · roll: top → [-0.6, -0.8, 0] · touch self.head | 0,1 | 1,64 **!** |  |
| `kep-ho-so#om` | map | 4 | sheet · part body · edge left · along 0.5 · thumb front · variant rim · slant -45 · both {part body, edge right, along 0.5, thumb back, variant rim, slant 45} · face: cover → forward · touch self.torso, self.upperArm / sheet · part body · edge left · along 0.5 · thumb back · variant rim · slant 45 · both {part body, edge right, along 0.5, thumb back, variant rim, slant 45} · face: cover → forward · touch self.torso, self.upperArm | 45,0 **!** | 2,12 **!** | 45,0 / 2,12 **!** |
| `vali#keo` | map | 4 | cylinder · part can · along 0.5 · thumb up · variant wrap · around 0 · face: [0, 1, 0] → [0.545, -0.839, 0] | 0,0 | 0,84 |  |
| `binh#co` | map | 3 | cylinder · part than · along 0.844 · thumb up · variant wrap · around 180 | 0,4 | 0,72 |  |
| `but#viet` | HOLD_MAP | 3 | pen · part than · along 0.301 · face: tip → [0.5, 0.866, 0] / pen · part than · along 0.3 · face: tip → [0.5, 0.866, 0] / pen · part than · along 0.299 · face: tip → [0.5, 0.866, 0] | 0,0 | 0,23 |  |
| `chia#cam` | map | 3 | sheet · part vong · edge top · along 0.1 · thumb back · variant rim · slant 45 · up: [0, 1, 0] / sheet · part vong · edge top · along 0.113 · thumb back · variant rim · slant 45 · up: [0, 1, 0] | 45,0 **!** | 3,41 **!** |  |
| `dien-thoai#bam` | HOLD_MAP | 3 | palmBox · part body · along 0.394 · thumb right · tilt 20.6 | 0,2 | 0,01 |  |
| `hoa-don#doc` | map | 3 | sheet · part body · edge bottom · along 0.225 · thumb front · variant flat · slant 12.2 · face: front → holderFace -20° / sheet · part body · edge bottom · along 0.225 · thumb front · variant flat · slant 12.2 · face: front → {"cast":"takumi"} | 0,3 | 0,11 |  |
| `kep-ho-so#mo` | map | 3 | sheet · part body · edge right · along 0.5 · thumb front · variant rim · slant 0 · both {part body, edge left, along 0.456, thumb front, variant flat, slant 90} · roll: top → forward | 0,0 | 2,06 **!** | 0,0 / 11,45 **!** |
| `ly-bia#quai` | map | 3 | cylinder · part quai · along 0.656 · thumb up · variant wrap · around 90 / cylinder · part quai · along 0.613 · thumb up · variant wrap · around 90 | 0,0 | 1,93 **!** |  |
| `tui-hieu#vai` | map | 3 | carry · on shoulder · touch {"part":"upperArm","max":5}, {"part":"torso","max":5} | 0,0 | 0,00 |  |
| `binh#rot` | map | 2 | cylinder · part than · along 0.838 · thumb up · variant wrap · around 183.8 · face: mouth → [0.58, 0, -1] -25° | 25,6 **!** | 0,91 |  |
| `binh#rot-hai` | map | 2 | cylinder · part than · along 0.844 · thumb up · variant wrap · around 182.8 · both · face: mouth → [1, 0, 0.58] -25° / cylinder · part than · along 0.838 · thumb up · variant wrap · around 183.8 · both · face: mouth → [1, 0, 0.58] -25° | 26,1 **!** | 0,91 | 0,0 / 0,50 |
| `dien-thoai#doc` | HOLD_MAP | 2 | palmBox · part body · along 0.419 · thumb right · tilt 20.6 / palmBox · part body · along 0.419 · thumb left · tilt 20.6 | 0,2 | 0,06 |  |
| `dien-thoai#ngang` | map | 2 | palmBox · part body · along 0.344 · thumb right · tilt 0 · face: screen → {"mark":"chest"} · touch self.torso | 0,1 | 2,39 **!** |  |
| `dien-thoai#om` | map | 2 | palmBox · part body · along 0.394 · thumb right · tilt 0 · both {group platform, part body, edge top, along 0.1, psi -48.7, inset 10.9} · face: screen → {"mark":"chest"} · roll: top → up · touch self.torso / palmBox · part body · along 0.394 · thumb right · tilt 0 · both {group platform, part body, edge top, along 0.1, psi -48.7, inset 11} · face: screen → {"mark":"chest"} · roll: top → up · touch self.torso | 0,1 | 2,39 **!** | 0,3 / 1,75 **!** |
| `khan#lau` | map | 2 | platform · part body · edge front · along 0.5 · psi 0 · inset 11.5 · face: bottom → down / platform · part body · edge right · along 0.5 · psi -85.3 · inset 15 · face: bottom → down | 180,0 **!** | 5,21 **!** |  |
| `khay#om` | map | 2 | sheet · part day · edge right · along 0.5 · thumb top · variant rim · slant -45 · both {part day, edge left, along 0.5, thumb top, variant rim, slant -45} · face: top → forward · roll: far → down · touch self.torso, self.upperArm | 45,0 **!** | 2,00 **!** | 45,0 / 2,00 **!** |
| `ong-nghe#tai` | HOLD_MAP | 2 | cylinder · part tay · along 0.425 · thumb up · variant flat · around 150 · face: front → {"mark":"head"} · touch self.head | 0,0 | 0,26 |  |
| `phieu#cam` | map | 2 | sheet · part body · edge left · along 0.5 · thumb front · variant flat · slant 0 | 0,0 | 0,05 |  |
| `the#cam` | map | 2 | card · part body · edge top · along 0.5 · thumb front · slant 0 · face: front → camera | 0,0 | 0,80 |  |
| `the#quet` | map | 2 | card · part body · edge top · along 0.5 · thumb front · slant 0 · face: front → in | 0,0 | 0,90 |  |
| `tui-hieu#khuyu` | HOLD_MAP | 2 | carry · on elbow | 0,0 | 0,00 |  |
| `bang-gia#khoe` | map | 1 | sheet · part body · edge left · along 0.294 · thumb front · variant pinch · slant 60 · face: front → {"cast":"takumi"} | 0,3 | 0,05 |  |
| `bao#doc` | HOLD_MAP | 1 | sheet · part body · edge right · along 0.831 · thumb front · variant rim · slant 36.6 · both {part body, edge left, along 0.169, thumb front, variant rim, slant 36.6} · face: front → back 10° | 0,3 | 0,67 | 0,3 / 0,67 |
| `bao#gon` | map | 1 | sheet · part body · edge right · along 0.75 · thumb front · variant rim · slant 0 · roll: top → forward · touch self.thigh | 0,0 | 0,57 |  |
| `bao#ha` | map | 1 | sheet · part body · edge right · along 0.75 · thumb front · variant rim · slant 0 · roll: top → forward · touch self.thigh | 0,0 | 0,62 |  |
| `bien-lai#doc` | map | 1 | sheet · part body · edge bottom · along 0.3 · thumb front · variant flat · slant 5.6 · face: front → holderFace -20° | 0,3 | 0,00 |  |
| `bo-da#bung` | HOLD_MAP | 1 | sheet · part dia · edge left · along 0.5 · thumb top · variant rim · slant 21.6 · both {part dia, edge right, along 0.5, thumb top, variant rim, slant 21.6} · up: top · roll: front → forward | 0,2 | 0,05 | 0,2 / 0,05 |
| `bo-dam#cam` | map | 1 | cylinder · part than · along 0.269 · thumb up · variant wrap · around 150 | 5,7 **!** | 3,92 **!** |  |
| `bo-dam#noi` | map | 1 | cylinder · part than · along 0.269 · thumb up · variant wrap · around 150 · face: front → {"mark":"head"} -25° · roll: top → up · touch self.head | 5,7 **!** | 3,92 **!** |  |
| `chai-dia#rot-than` | map | 1 | cylinder · part than · along 0.319 · thumb up · variant wrap · around 180 · face: mouth → [1, 0, 0.58] 30° | 0,0 | 0,84 |  |
| `chai-dia#xem` | HOLD_MAP | 1 | cylinder · part vai · along 0.825 · thumb up · variant wrap · around 90 · face: nhan → out · roll: mouth → up | 0,9 | 0,74 |  |
| `chong-khan#om` | map | 1 | platform · part vanh · edge right · along 0.6 · psi 90 · inset 13.5 · both {part day, edge left, along 0.6, psi 90, inset 13.2} · roll: far → forward · touch self.torso | 0,0 | 1,74 **!** | 0,0 / 1,74 **!** |
| `dien-thoai#cam` | HOLD_MAP | 1 | palmBox · part body · along 0.344 · thumb right · tilt 0 · keep | 0,1 | 2,39 **!** |  |
| `dua#cam` | HOLD_MAP | 1 | chopsticks · part que · along 0.245 · face: tip → forward -30° | 1,9 | 0,04 |  |
| `giay-to#cam` | map | 1 | card · part body · edge top · along 0.675 · thumb front · slant -17.8 | 0,2 | 2,82 **!** |  |
| `giay-to#tra` | map | 1 | card · part body · edge bottom · along 0.45 · thumb front · slant 0 · face: front → forward | 0,0 | 3,82 **!** |  |
| `khay-suat#bung` | HOLD_MAP | 1 | platform · part day · edge right · along 0.5 · psi 90 · inset 6 · both {part day, edge left, along 0.5, psi 90, inset 6} · roll: [0, 0, -1] → forward | 0,0 | 1,66 **!** | 0,0 / 1,66 **!** |
| `khay-tra#bung` | map | 1 | platform · part day · edge right · along 0.5 · psi 90 · inset 6 · both {part day, edge left, along 0.5, psi 90, inset 6} · roll: [0, 0, -1] → forward | 0,0 | 1,74 **!** | 0,0 / 1,74 **!** |
| `khay#bung` | HOLD_MAP | 1 | platform · part day · edge right · along 0.5 · psi 90 · inset 6 · both {part day, edge left, along 0.5, psi 90, inset 6} · roll: far → forward | 0,0 | 1,59 **!** | 0,0 / 1,59 **!** |
| `phieu-lien#cam` | HOLD_MAP | 1 | sheet · part body · edge left · along 0.5 · thumb front · variant flat · slant 0 · face: front → {"cast":"takumi"} | 0,0 | 0,05 |  |
| `phieu#do` | HOLD_MAP | 1 | platform · part body · edge right · along 0.5 · psi 90 · inset 20 | 0,0 | 0,34 |  |
| `phieu#kep` | map | 1 | sheet · part body · edge left · along 0.5 · thumb front · variant flat · slant 0 · up: front | 0,0 | 0,05 |  |
| `phieu#om` | map | 1 | sheet · part body · edge left · along 0.5 · thumb front · variant rim · slant -45 · both {part body, edge right, along 0.5, thumb front, variant rim, slant -45} · face: front → forward · touch self.torso, self.upperArm | 45,0 **!** | 0,68 | 45,0 / 0,68 **!** |
| `so-tay#do` | map | 1 | platform · part body · edge bottom · along 0.731 · psi 0 · inset 11.9 | 0,0 | 0,36 |  |
| `thuc-don#khoe` | HOLD_MAP | 1 | sheet · part body · edge right · along 0.694 · thumb front · variant flat · slant -70.3 · face: front → {"cast":"takumi-c"} | 0,2 | 0,09 |  |
| `tom-hum#bung` | map | 1 | platform · part dia · edge left · along 0.5 · psi -90 · inset 8.7 · both {part dia, edge right, along 0.5, psi -90, inset 8.7} · roll: duoi → forward | 4,6 | 0,17 | 4,6 / 0,17 |
| `tui#xach` | HOLD_MAP | 1 | handle · part quai · along 0.5 | 0,0 | 0,00 |  |
| `vali#dung` | map | 1 | cylinder · part can · along 0.5 · thumb up · variant wrap · around 0 | 0,0 | 0,83 |  |

## Kiểu khó (lệch lớn, chủ dự án duyệt)

- `kep-ho-so#om` (4), `phieu#om` (1), `khay#om` (2): 45° + 0,7–2,1 — ôm ngực chưa có nhóm (`hug`), `rim` kẹp `slant` 45°.
- `kep-ho-so#mo` (3): tay dẫn 0° / 2,06, tay phụ lệch 11,2–11,5 (lòng áp gáy sau không diễn được bằng tay phụ `sheet`).
- `chia#cam` (3): 45° / 3,3–3,4.
- `khan#lau` (2): 180° / 5,1–5,2 (khăn lật trong tay, lòng vẫn úp).
- `binh#rot`, `binh#rot-hai` (4): 25,6–26,1°.
- `bo-dam#noi`, `bo-dam#cam` (2): 5,7° / 3,9.
- `dien-thoai#quay` (4): 0° / 3,0 cả hai tay. `giay-to#cam`/`#tra`: 2,8 / 3,8. `dien-thoai#khoe`/`#ngang`/`#om`/`#cam` 2,39, `#tai` 1,64, `chen#kep` 1,4–1,8, `ly-bia#quai` 1,5–1,9, khay/đĩa `platform` 1,6–1,7 (cùng mức t02).

## Cảnh báo `check --only held,clash` (0 lỗi, 125 cảnh báo)

| Loại | Số |
|---|---|
| người lồng vào đồ | 54 |
| tay xuyên thân | 24 |
| da lún vào món | 20 |
| ngón không chạm món | 17 |
| món không chạm bàn tay | 3 |
| món nhảy lúc đổi kiểu cầm | 2 |
| món nhảy lúc thả | 1 |
| món nhảy lúc gắn vào tay | 1 |
| món nghiêng | 1 |
| món không nằm trong tay | 1 |
| mặt món quay sai | 1 |

Theo cảnh: 
thu-hd-keo-vali 13 · thu-grip-dt 8 · thu-do-giay-kep 8 · thu-khach-sakura 7 · thu-khach-kacho 7 · thu-do-nho-quay 7 · thu-hd-tay-nam 6 · thu-grip-cs 6 · thu-hd-nang-ly 5 · thu-hd-ho-so 5 · thu-do-dt-tay-ngoi 5 · thu-hd-rot-ruou 4 · thu-hd-quay-dt 4 · thu-hd-lau-ban 4 · thu-grip-nho 4 · thu-do-giay-hoa-don 4 · thu-ruou 3 · thu-grip-khay 3 · thu-grip-giay 3 · thu-grip 3 · thu-do-nho-bia 3 · thu-do-giay-quay 3 · thu-do-dt-tay-gio 3 · thu-hd-ap-tai 2 · thu-grip-uong 2 · thu-grip-mon 2 · thu-grip-tui 1 · 

Cảnh báo về cầm (không tính lồng người–đồ, tay xuyên thân), rút gọn:

- `thu-do-dt-tay-gio`: ngón không chạm món: `tanabe` tay trái cầm dien-thoai: ngón cái (`press`) cách món 2.9, ngón giữa (`press`) cách món 4.8 (chỗ cầm `dien-thoai@sheet` (variant rim, part body, edge top, thumb front)); dáng ngó…
- `thu-do-dt-tay-gio`: ngón không chạm món: `tanabe` tay phải cầm dien-thoai: ngón cái (`press`) cách món 2.9, ngón giữa (`press`) cách món 4.5 (chỗ cầm `dien-thoai@sheet` (part body, edge top, along 0.5, thumb front, variant rim,…
- `thu-do-dt-tay-ngoi`: món nhảy lúc gắn vào tay: `khach` tay phải cầm dien-thoai: qua mốc giây 2.40 món dời 203.0, xoay 86° (chỗ cầm `dien-thoai@palmBox` (part body, along 0.39, thumb right, variant default (mặc định), tilt 20.6)…
- `thu-do-giay-hoa-don`: món nhảy lúc thả: `saito` tay phải cầm hoa-don: qua mốc giây 3.60 món dời 57.3, xoay 67° (chỗ cầm `hoa-don@sheet` (part body, edge bottom, along 0.23, thumb front, variant flat, slant 12.2)) ở giây 3.60 · …
- `thu-do-giay-kep`: da lún vào món: `kacho` tay trái cầm kep-ho-so: lún 2.6 (quá 0.7) (chỗ cầm `kep-ho-so@sheet` (variant rim, part body, edge right, thumb front)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là vi…
- `thu-do-giay-kep`: ngón không chạm món: `kacho` tay trái cầm kep-ho-so: ngón cái (`press`) cách món 2.4, ngón giữa (`press`) cách món 4.3 (chỗ cầm `kep-ho-so@sheet` (variant rim, part body, edge left, thumb front)); dáng ngón củ…
- `thu-do-nho-quay`: ngón không chạm món: `chiaki` tay phải cầm chia: ngón cái (`press`) cách món 2.1 (chỗ cầm `chia@sheet` (part vong, edge top, along 0.1, thumb back, variant rim, slant 45)); dáng ngón của nhóm chưa khép tới món…
- `thu-do-nho-quay`: món nhảy lúc đổi kiểu cầm: `saito` tay phải cầm the: qua mốc giây 4.40 món dời 8.4, xoay 19° (chỗ cầm `the@card` (part body, edge top, along 0.5, thumb front, variant pad (mặc định), slant 0)) ở giây 4.40 · gi…
- `thu-grip-cs`: món không chạm bàn tay: `bucho` tay trái cầm so-tay: không ngón, lòng tay nào của vai trò `press` / `wrap` / `tip` chạm món (khe nhỏ nhất 1.8) (chỗ cầm `so-tay@platform` (part body, edge bottom, along 0.73, varian…
- `thu-grip-dt`: da lún vào món: `om` tay trái cầm dien-thoai: lún 1.0 (quá 0.7) (chỗ cầm `dien-thoai@palmBox` (part body, thumb right)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việc của dáng nhóm ở rig ở giâ…
- `thu-grip-dt`: da lún vào món: `bam` tay phải cầm dien-thoai: lún 0.8 (quá 0.7) (chỗ cầm `dien-thoai@palmBox` (part body, along 0.39, thumb right, variant default (mặc định), tilt 20.6)); ngón ôm không gỡ được — đổi `variant` / …
- `thu-grip-dt`: ngón không chạm món: `quay` tay trái cầm dien-thoai: ngón cái (`press`) cách món 2.7, ngón giữa (`press`) cách món 6.9 (chỗ cầm `dien-thoai@sheet` (variant rim, part body, edge top, thumb front)); dáng ngón của nh…
- `thu-grip-dt`: ngón không chạm món: `quay` tay phải cầm dien-thoai: ngón cái (`press`) cách món 2.8, ngón giữa (`press`) cách món 5.4 (chỗ cầm `dien-thoai@sheet` (part body, edge top, along 0.5, thumb front, variant rim, slant 0…
- `thu-grip-giay`: ngón không chạm món: `kep-om` tay trái cầm kep-ho-so: ngón cái (`press`) cách món 2.9 (chỗ cầm `kep-ho-so@sheet` (variant rim, part body, edge left, thumb front)); dáng ngón của nhóm chưa khép tới món — đổi `var…
- `thu-grip-giay`: ngón không chạm món: `phieu-om` tay trái cầm phieu: ngón cái (`press`) cách món 2.8 (chỗ cầm `phieu@sheet` (variant rim, part body, edge left, thumb front)); dáng ngón của nhóm chưa khép tới món — đổi `variant` …
- `thu-grip-giay`: ngón không chạm món: `phieu-om` tay phải cầm phieu: ngón cái (`press`) cách món 2.8 (chỗ cầm `phieu@sheet` (part body, edge left, along 0.5, thumb front, variant rim, slant -45)); dáng ngón của nhóm chưa khép tớ…
- `thu-grip-khay`: da lún vào món: `khay-suat` tay trái cầm khay-suat: lún 1.1 (quá 0.7) (chỗ cầm `khay-suat@platform` (part day, edge right)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việc của dáng nhóm ở rig…
- `thu-grip-khay`: da lún vào món: `vali` tay phải cầm vali: lún 0.9 (quá 0.7) (chỗ cầm `vali@cylinder` (part can, along 0.5, thumb up, variant wrap, around 0)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việc c…
- `thu-grip-khay`: da lún vào món: `khay-tra` tay trái cầm khay-tra: lún 0.7 (quá 0.7) (chỗ cầm `khay-tra@platform` (part day, edge right)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việc của dáng nhóm ở rig ở …
- `thu-grip-mon`: da lún vào món: `tom` tay trái cầm tom-hum: lún 0.9 (quá 0.7) (chỗ cầm `tom-hum@platform` (part dia, edge left)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việc của dáng nhóm ở rig ở giây 1.00…
- `thu-grip-mon`: da lún vào món: `tom` tay phải cầm tom-hum: lún 0.9 (quá 0.7) (chỗ cầm `tom-hum@platform` (part dia, edge left, along 0.5, variant palm (mặc định), psi -90)); ngón ôm không gỡ được — đổi `variant` / `slant`, khôn…
- `thu-grip-nho`: da lún vào món: `khan` tay phải cầm khan: lún 0.7 (quá 0.7) (chỗ cầm `khan@platform` (part body, edge front, along 0.5, variant palm (mặc định), psi 0)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì…
- `thu-grip-nho`: ngón không chạm món: `chia` tay phải cầm chia: ngón cái (`press`) cách món 1.9 (chỗ cầm `chia@sheet` (part vong, edge top, along 0.11, thumb back, variant rim, slant 45)); dáng ngón của nhóm chưa khép tới món — đ…
- `thu-grip-uong`: da lún vào món: `rot` tay trái cầm binh: lún 1.6 (quá 0.7) (chỗ cầm `binh@cylinder` (variant wrap, part than, thumb up)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việc của dáng nhóm ở rig ở …
- `thu-grip`: da lún vào món: `doc` tay trái cầm dien-thoai: lún 0.8 (quá 0.7) (chỗ cầm `dien-thoai@palmBox` (part body, along 0.42, thumb left, variant default (mặc định), tilt 20.6)); ngón ôm không gỡ được — đổi `variant` / `sla…
- `thu-hd-ho-so`: da lún vào món: `kacho` tay trái cầm kep-ho-so: lún 2.6 (quá 0.7) (chỗ cầm `kep-ho-so@sheet` (variant rim, part body, edge right, thumb front)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việc …
- `thu-hd-ho-so`: ngón không chạm món: `kacho` tay trái cầm kep-ho-so: ngón cái (`press`) cách món 3.0, ngón giữa (`press`) cách món 4.4 (chỗ cầm `kep-ho-so@sheet` (variant rim, part body, edge left, thumb front)); dáng ngón của n…
- `thu-hd-keo-vali`: da lún vào món: `yota` tay phải cầm vali: lún 2.5 (quá 0.7) (chỗ cầm `vali@cylinder` (part can, along 0.5, thumb up, variant wrap, around 0)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việc…
- `thu-hd-keo-vali`: da lún vào món: `yota2` tay phải cầm vali: lún 2.5 (quá 0.7) (chỗ cầm `vali@cylinder` (part can, along 0.5, thumb up, variant wrap, around 0)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việ…
- `thu-hd-keo-vali`: da lún vào món: `yota2` tay trái cầm vali:2: lún 0.9 (quá 0.7) (chỗ cầm `vali:2@cylinder` (part can, along 0.5, thumb up, variant wrap, around 0)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là…
- `thu-hd-lau-ban`: da lún vào món: `yota` tay phải cầm khan: lún 1.2 (quá 0.7) (chỗ cầm `khan@platform` (part body, edge right, along 0.5, variant palm (mặc định), psi -85.3)); ngón ôm không gỡ được — đổi `variant` / `slant`, khô…
- `thu-hd-nang-ly`: món nghiêng: `tanabe` tay phải cầm chen: trục ý định còn lệch 51° khỏi `up` (chỗ cầm `chen@bowl` (part body, along 0.13, variant side (mặc định), around 180)); đổi `face` / `up` của mốc tay, `elbow`, hay `edge`…
- `thu-hd-quay-dt`: ngón không chạm món: `tanabe-ngoi` tay trái cầm dien-thoai: ngón cái (`press`) cách món 2.9, ngón giữa (`press`) cách món 6.5 (chỗ cầm `dien-thoai@sheet` (variant rim, part body, edge top, thumb front)); dáng n…
- `thu-hd-quay-dt`: ngón không chạm món: `tanabe` tay trái cầm dien-thoai: ngón cái (`press`) cách món 2.9, ngón giữa (`press`) cách món 6.5 (chỗ cầm `dien-thoai@sheet` (variant rim, part body, edge top, thumb front)); dáng ngón c…
- `thu-hd-quay-dt`: ngón không chạm món: `tanabe-ngoi` tay phải cầm dien-thoai: ngón cái (`press`) cách món 2.9, ngón giữa (`press`) cách món 4.5 (chỗ cầm `dien-thoai@sheet` (part body, edge top, along 0.5, thumb front, variant ri…
- `thu-hd-quay-dt`: ngón không chạm món: `tanabe` tay phải cầm dien-thoai: ngón cái (`press`) cách món 2.9, ngón giữa (`press`) cách món 4.5 (chỗ cầm `dien-thoai@sheet` (part body, edge top, along 0.5, thumb front, variant rim, sl…
- `thu-hd-rot-ruou`: da lún vào món: `yoshie` tay trái cầm binh: lún 0.9 (quá 0.7) (chỗ cầm `binh@cylinder` (variant wrap, part than, thumb up)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việc của dáng nhóm ở r…
- `thu-hd-tay-nam`: da lún vào món: `saito` tay trái cầm vali: lún 1.6 (quá 0.7) (chỗ cầm `vali@cylinder` (part can, along 0.5, thumb up, variant wrap, around 0)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việc…
- `thu-khach-kacho`: da lún vào món: `kacho` tay trái cầm kep-ho-so: lún 2.6 (quá 0.7) (chỗ cầm `kep-ho-so@sheet` (variant rim, part body, edge right, thumb front)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là vi…
- `thu-khach-kacho`: món không nằm trong tay: `kacho` tay trái cầm kep-ho-so: tâm nắm của dáng `edge` cách hình món 18.4 (chỗ cầm `kep-ho-so@sheet` (variant rim, part body, edge left, thumb back)) ở giây 1.50 · giây 1.40–1.70. Lúc…
- `thu-khach-kacho`: món không chạm bàn tay: `kacho` tay trái cầm kep-ho-so: không ngón, lòng tay nào của vai trò `press` / `wrap` / `tip` chạm món (khe nhỏ nhất 12.1) (chỗ cầm `kep-ho-so@sheet` (variant rim, part body, edge left,…
- `thu-khach-kacho`: ngón không chạm món: `kacho` tay trái cầm kep-ho-so: ngón giữa (`press`) cách món 4.5 (chỗ cầm `kep-ho-so@sheet` (variant rim, part body, edge left, thumb back)); dáng ngón của nhóm chưa khép tới món — đổi `va…
- `thu-khach-kacho`: ngón không chạm món: `kacho` tay phải cầm kep-ho-so: ngón cái (`press`) cách món 1.6, ngón giữa (`press`) cách món 4.5 (chỗ cầm `kep-ho-so@sheet` (part body, edge left, along 0.5, thumb back, variant rim, slan…
- `thu-khach-sakura`: da lún vào món: `sakura` tay phải cầm dien-thoai: lún 0.8 (quá 0.7) (chỗ cầm `dien-thoai@palmBox` (part body, along 0.39, thumb right, variant default (mặc định), tilt 20.6)); ngón ôm không gỡ được — đổi `var…
- `thu-khach-sakura`: món không chạm bàn tay: `sakura` tay trái cầm dien-thoai: không ngón, lòng tay nào của vai trò `press` / `wrap` / `tip` chạm món (khe nhỏ nhất 2.1) (chỗ cầm `dien-thoai@palmBox` (part body, thumb right)) ở gi…
- `thu-khach-sakura`: mặt món quay sai: `sakura` tay phải cầm dien-thoai: trục ý định còn lệch 132° khỏi `camera` (chỗ cầm `dien-thoai@palmBox` (part body, along 0.34, thumb right, variant default (mặc định), tilt 0)); đổi `face` …
- `thu-khach-sakura`: món nhảy lúc đổi kiểu cầm: `sakura` tay phải cầm dien-thoai: qua mốc giây 4.50 món dời 11.7, xoay 24° (chỗ cầm `dien-thoai@palmBox` (part body, along 0.39, thumb right, variant default (mặc định), tilt 0)) ở …

Log đầy đủ: `ngoai-check-held.log`, `ngoai-check-ref.log`, `ngoai-video-test.log`.
