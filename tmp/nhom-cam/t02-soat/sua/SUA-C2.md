# SUA-C2 — túi Erika, báo ông khách, hoá đơn Takumi (s061–s066)

Ảnh sau: `lo5/sau/<cảnh>/`. Check sau: `lo5/check/<cảnh>-sau.txt`. Góc đo bằng `tools/goc-tay.cjs`.

| Cảnh | Người | Tay | Món | Lỗi người soi | Đã đổi gì | Tự soi (5 câu, góc đo) | Còn lỗi |
|---|---|---|---|---|---|---|---|
| s061, s062, s063, s064, s065, s066 | erika | trái | tui-hieu | Hiện hành: cẳng tay chĩa chéo ra ngoài thân. Cũ: quai ở cổ tay, túi lấn bụng | Trả về dáng cũ như s001–s013 (chủ dự án duyệt): offset [48,34,50] → [38,18,34], elbow [0,1,1.5] → [-0.5,1,1] | 1 cánh tay: cẳng tay dựng, khuỷu gập 48°, `forearm_ngoai` −5..2°, `forearm_len` 80–82°, `upper.ra` 29–31° (trùng s001: −7°, 82°, 31°). 2 va chạm: túi treo trước hông, góc trên (s064) cho thấy túi ra ngoài váy; cẳng tay Takumi ở s064 cách tay Erika (góc ngang 2s); check không báo. 3 món: quai vắt qua cẳng tay. 4 ngữ cảnh: đứng ở quầy như s001. 5 liền mạch: cùng dáng s001–s013, sáu cảnh giống nhau | Góc trước cả sáu cảnh bị quầy che; dáng đánh giá ở góc chéo, ngang, trên. Quai nằm phía trên cẳng tay gần cổ tay, như s001 đã duyệt |
| s061, s062, s063, s066 | ong-khach | hai tay | bao | Nắm đấm siết mép báo, ngón cái dựng | `rim` slant 36.6 → `pinch` slant 45 (hai tay), thumb front; tay phải at [-1582,-220,-337] → [-1600,-200,-320], elbow [0,1,-0.8] → [0,1,-1]. Pinch giữ nguyên chỗ cũ thì tay trái không với tới mép (khuỷu 180°, hở 32): phải dời tay phải | 1 cánh tay: khuỷu P 97°, T 123°; `upper` P ra 86/trước 77 (tay giơ ra trước, không phải dạng vai), T ra 61/trước 37. 2 va chạm: góc dưới tờ báo sát trên đùi, không cắm vào; check không báo va chạm. 3 món: ngón cái mặt trong (phía người đọc), bốn ngón vắt qua mặt ngoài ở hai góc dưới. 4 ngữ cảnh: ngồi đọc báo, tờ báo trước ngực/mặt. 5 liền mạch: bốn cảnh cùng khoá, ảnh giống nhau | Check cảnh báo mới: lòng tay trái lệch 30° so với ý (cổ tay ở giới hạn). Tay trái là tay `both`, cảnh không khai được `elbow` riêng cho nó; đã thử slant 30/45/60, năm chỗ tay phải: 27–33°. Ảnh vẫn kẹp đúng mép (hở ≤ 2). Nhìn từ trước, bốn ngón khép trông hơi như nắm. Cần rig nếu muốn hết: cho tay `both` nhận `elbow` |
| s064 | takumi | hai tay | hoa-don | Mép giấy nằm trên lòng tay ngửa, cổ tay bẻ ngửa; góc trước đen | `flat` hai tay cùng cạnh bottom → `pinch` cạnh right/left along 0.6, thumb front, slant 0; tay phải offset [50,-22,22] → [50,-12,22] (hạ 10: offset 22 làm cẳng tay trái lấn đầu Erika 8.3 ở 1.25–2.25s; thử ra ngoài 34 thì tờ xoay nghiêng) | 1 cánh tay: khuỷu P 54–62°, T 82–99°; `forearm_ngoai` P −64..−69°, T −44..−55° (cẳng tay hướng vào giữa để cầm trước bụng); `upper.ra` P 55–60, T 40–55. 2 va chạm: tay trái gần tay Erika nhưng góc ngang cho thấy cách xa; check sạch. 3 món: góc trên thấy ngón cái trên mặt chữ, bốn ngón dưới, tờ ngửa về mặt. 4 ngữ cảnh: đứng đọc hoá đơn. 5 liền mạch: chỉ một cảnh | Góc trước vẫn đen (máy kẹt sau quầy) — đã chụp thêm góc trên ở 0.3, 1.22, 2s thay cho nó |

## Check trước → sau

| Cảnh | Trước | Sau |
|---|---|---|
| s061 | 0 | 1 cảnh báo mới: lòng tay trái ông khách lệch 30° |
| s062 | 1 cảnh báo (yota lơ lửng trên máy in) | giữ cảnh báo đó + lòng tay trái ông khách lệch 30° |
| s063 | 0 | lòng tay trái ông khách lệch 30° |
| s064 | 0 | 0 |
| s065 | 0 | 0 |
| s066 | 1 cảnh báo (cẳng tay Takumi lấn quầy) | giữ cảnh báo đó + lòng tay trái ông khách lệch 30° |

## Đã thử, bỏ

- Báo `flat`: tờ báo lật ngược, nghiêng sang bên — bỏ.
- Báo `pinch` ở chỗ cũ, slant −60..60, bốn hướng khuỷu: cổ tay phải kẹt giới hạn, tay trái hở 24–66 — phải dời tay phải.
