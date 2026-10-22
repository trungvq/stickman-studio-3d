# SUA-V1 — đĩa tôm hùm chìm khăn ở đầu bàn (s041, s042, s045)

## Gốc lỗi

Hai nguyên nhân chồng nhau:

1. **Khăn trải bàn dày 1,2** (`banAn` … `khan`, `src/objects/ban-an.ts`) mà chỗ đĩa nằm (`CHO_DIA`, `DIA_GIUA`) và chỗ đĩa hạ về
   (`haXuong(… Y_BAN)`) đặt đáy ngay mặt gỗ: đáy chìm 1,2 vào khăn.
2. **Đĩa nghiêng 18–29° lúc cầm sát bàn** (lỗi chính trên ảnh): khi tay hạ thấp, cổ tay chạm kẹp `dev` +20 nên bộ giải không giữ
   được đĩa phẳng (`up` lệch 18° ở s041 0,15 s, 23° ở 0,25 s, 29° ở s042 2,2 s); đầu đĩa phía xa người (đầu tôm) cắm xuống dưới khăn.
   `slant` 45 (biên của `rim`) cho cổ tay về trong tầm, đĩa phẳng (`up` 0–4°).

## Bảng

| cảnh | người | tay | món | lỗi người soi | đã đổi gì | tự soi | còn lỗi |
|---|---|---|---|---|---|---|---|
| s041-nguoi | yoshie | hai tay | tom-hum | 0,15/0,3 s đĩa và đuôi tôm chìm khăn | `slant` 21.6 → 45 ở mốc 0 và 0.25 (cả `both`); mốc rút tay 0.55 → `[-262,-230,512]`/`[-340,-233,520]` (tay rút về không quệt râu tôm) | 1 vai/khuỷu tự nhiên: upper.ra 15–17°, forearm_ngoai −11…−19°, khuỷu 111–126°; 2 đĩa phẳng nằm trên khăn, không chìm; hết va tay ↔ tôm lúc rút tay; 3 ngón cái trên vành, bốn ngón dưới đĩa; 4 hạ đĩa đặt bàn đúng việc; 5 khớp s040/s042 | còn cảnh báo tay ↔ `ban-cap`/khay 3–9 lúc thả (0,28–0,34 s, có từ trước: ngón dưới vành chạm mặt bàn) |
| s042-lam-lai | yoshie | hai tay | tom-hum | 2,15 s đĩa chìm khăn khi nhấc; 1,85 s đĩa xoay 38° | `slant` 45 (1.85, 2.2) → 36 (2.5) → 21.6 (3.05, bưng trước bụng như s043/s044); y `item:bottom` 1.85 −143 → −143.2 (đúng mặt khăn), 2.2 −143 → −144.5 | 1 upper.ra 12–19° lúc nhấc, 34° lúc bưng 3,1 s; forearm_ngoai −12…−32°; 2 đĩa nằm và lên khỏi khăn phẳng, không chìm; 3 vành đúng; 4 nhấc đĩa mang đi; 5 liền s041 | **cần rig**: nhảy lúc kẹp còn 28° (trước 38°) — xem dưới |
| s045-cui | yoshie | hai tay | tom-hum | 0,47 s mép đĩa chìm khăn khi đặt | đứng z 452 → 472 cả cảnh (ở 452 tay không với tới chỗ đặt: hụt 7–8, đĩa thả cao); mốc 0 z 545 → 565; thêm mốc 0.2 `[-300,-175,575]` slant 36; mốc đặt 0.42 slant 45; mốc rút tay 0.7 → `[-262,-230,512]`; tay cúi chào `offset` [12,18,0] → [12,30,0] | 1 upper.ra 17–32°, forearm_ngoai −11…−30°, khuỷu 87–126°; 2 đĩa phẳng trên khăn; lúc cúi (1,25 s) tay trước bụng, râu tôm vòng trước cẳng tay nhưng không xuyên (check sạch đoạn cúi); 3 vành đúng; 4 bước tới đặt đĩa rồi cúi; 5 cuối s044 đứng 452, cảnh này 472 (lệch 20 qua một nhát cắt đổi góc máy) | cảnh báo mới giải thích được: tay phải ↔ `kaiseki-khay-b` 3,6 lúc thả (cùng chỗ thả như s041), tay phải ↔ tôm 2,1 ở 0,50 s (ngón rời vành), cẳng tay xa ↔ thân 4,1 lúc quay đi 2,22–2,25 s (cùng loại cẳng tay gần có từ trước) |

## Thay đổi `src/khoi3d/t02.ts`

- `Y_KHAN = Y_BAN - 1.2` (mặt khăn). `CHO_DIA`, `DIA_GIUA` đặt y ở `Y_KHAN`; `tomTrenBan` mặc định hạ về `Y_KHAN`; `boTrongBan`
  đặt ở `CHO_DIA.at`. Không đổi: chai tặng s033 ở `DAU_BAN` (cảnh của SUA-C1) vẫn đặt ở mặt gỗ, nên chìm 1,2 vào khăn — để cho người làm s033.
- Cảnh dùng các chỗ này: s038–s050. `check --only ref,held,clash` cho s038–s050: 0 lỗi; khác bản đầu chỉ ở s041, s042, s045
  (đã liệt kê ở bảng). `pnpm typecheck` xanh, `pnpm test` xanh (held 53/53).

## Nhảy 28° ở s042 1,85 s — không cùng gốc với khăn

Lần cầm tay dẫn bắt đầu thì rig hoà góc cổ tay từ tay tự do sang nghiệm trong `HOLD_BLEND` 0,3 s (`ReachHold.enter`,
docs/11 §Đổi lần cầm), mà món theo bàn tay đã vẽ: đĩa đang nằm phẳng bị bẻ theo cổ tay chưa xoay xong (`up` 18° ở 1,86 s, 10° ở
2,0 s, 0° ở 2,2 s; `intent.got` đã phẳng). Thử đổi `palm` mốc 1.75, thêm mốc trùng, dời mốc 2.2: không đổi. `slant` 45 giảm từ
38° xuống 28° (phần nghiêng do kẹp `dev`). Phần còn lại cần rig: lần cầm tay dẫn nhặt món đang nằm thì món đứng yên tới khi hoà xong
(hay cho cảnh nhặt theo món đặt trước).

## Ảnh và check

- Ảnh sau: `S/lo4/sau/<cảnh>/` (bản gốc ở `S/sua/v1-anh/`); s041 bảng riêng `S/sua/v1-anh/t02-s041-nguoi.jpg`.
- Check: `S/sua/v1-check/<cảnh>-sau.txt`, `S/sua/v1-check/sau.txt` (s038–s050, ref/held/clash).
