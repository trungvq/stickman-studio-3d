# G4-47 hàng mẫu `cylinder`

Rig 7.15.0 (HEAD 757881b), `pnpm bang-cam --nhom cylinder`, hai người: t01-sakura (tay 1,61), kuroiwa (tay 2,16). Số lún: da lún sâu nhất vào món. Luật = luật `held` của `check` ở giây 0,5.

Hàng mẫu mới: `along thấp` (`low`), `along cao` (`high`), `ngón cái xuống` (`thumb: down`), `nắm phần <p>` (`part` + `along` giữa phần trong đoạn bám liền, tính từ hình; bỏ phần chứa giữa đoạn vì trùng mặc định), `áp tai` (tay trái dẫn, `to: ear`, `point: item:speaker`, `around 180`, `roll top → up`, `face front → head`, `touch self.head`).

## Bỏ

### Không đạt needs
- (không có)

### Hàng không áp được
- (không có)

### Trùng hàng trước
- `thu-chai-dia@cylinder along thấp` t01-sakura: giống `bang-cam-thu-chai-dia-cylinder-mac-dinh-P-t01-sakura`
- `thu-chai-dia@cylinder along thấp` kuroiwa: giống `bang-cam-thu-chai-dia-cylinder-mac-dinh-P-kuroiwa`
- `thu-ong-nghe-ban@cylinder along cao` t01-sakura: giống `bang-cam-thu-ong-nghe-ban-cylinder-mac-dinh-P-t01-sakura`
- `thu-ong-nghe-ban@cylinder ngón cái xuống` t01-sakura: giống `bang-cam-thu-ong-nghe-ban-cylinder-mac-dinh-P-t01-sakura`
- `thu-ong-nghe-ban@cylinder along cao` kuroiwa: giống `bang-cam-thu-ong-nghe-ban-cylinder-mac-dinh-P-kuroiwa`
- `thu-ong-nghe-ban@cylinder ngón cái xuống` kuroiwa: giống `bang-cam-thu-ong-nghe-ban-cylinder-mac-dinh-P-kuroiwa`
- `thu-chai-dac-tuyen@cylinder along thấp` t01-sakura: giống `bang-cam-thu-chai-dac-tuyen-cylinder-mac-dinh-P-t01-sakura`
- `thu-chai-dac-tuyen@cylinder along thấp` kuroiwa: giống `bang-cam-thu-chai-dac-tuyen-cylinder-mac-dinh-P-kuroiwa`

Ghi chú: `nắm phần vai/cổ` trên `thu-ong-nghe-ban` không phát sinh vì món chỉ có phần `tay` bám được (không có hàng để lọc); `along cao` và `ngón cái xuống` của ống nghe trùng mặc định (rig chọn `along` 0,75, `thumb down`), nên bị bỏ.

## Hàng và số chính


### thu-chai-dia

| Hàng | Người | Tay | `along`/`part`/`thumb`/`around` rig dùng | lún | cổ tay vượt | luật `held` |
|---|---|---|---|---|---|---|
| mặc định (wrap) | t01-sakura | R | part than along 0.25 thumb up around 300 | 0.1 | — | — |
| along cao | t01-sakura | R | part than along 0.75 thumb up around 330 | 0.1 | — | — |
| ngón cái xuống | t01-sakura | R | part than along 0.75 thumb down around 180 | 0.3 | — | — |
| nắm phần vai | t01-sakura | R | part vai along 0.74 thumb up around 330 | 0.1 | — | — |
| nắm phần co | t01-sakura | R | part co along 0.91 thumb up around 330 | 0.3 | — | — |
| mặc định (wrap) | kuroiwa | R | part than along 0.25 thumb up around 330 | 0.2 | — | — |
| along cao | kuroiwa | R | part than along 0.75 thumb up around 0 | 0.1 | — | — |
| ngón cái xuống | kuroiwa | R | part than along 0.75 thumb down around 180 | 0.2 | — | — |
| nắm phần vai | kuroiwa | R | part vai along 0.74 thumb up around 0 | 0.1 | — | — |
| nắm phần co | kuroiwa | R | part co along 0.91 thumb up around 0 | 0.4 | — | — |

### thu-ong-nghe-ban

| Hàng | Người | Tay | `along`/`part`/`thumb`/`around` rig dùng | lún | cổ tay vượt | luật `held` |
|---|---|---|---|---|---|---|
| mặc định (wrap) | t01-sakura | R | part tay along 0.75 thumb down around 150 | 0.7 | 20° | wrist, sink |
| along thấp | t01-sakura | R | part tay along 0.25 thumb down around 150 | 0.5 | 28.6° | wrist |
| áp tai | t01-sakura | L | part tay along 0.5 thumb up around 180 | 0.3 | — | — |
| mặc định (wrap) | kuroiwa | R | part tay along 0.75 thumb down around 150 | 0.6 | 19.5° | wrist |
| along thấp | kuroiwa | R | part tay along 0.25 thumb down around 150 | 0.2 | 26.9° | wrist |
| áp tai | kuroiwa | L | part tay along 0.5 thumb up around 180 | 0.7 | — | sink |

### thu-chai-dac-tuyen

| Hàng | Người | Tay | `along`/`part`/`thumb`/`around` rig dùng | lún | cổ tay vượt | luật `held` |
|---|---|---|---|---|---|---|
| mặc định (wrap) | t01-sakura | R | part than along 0.25 thumb up around 300 | 0.1 | — | size |
| along cao | t01-sakura | R | part than along 0.75 thumb up around 330 | 0.1 | — | size |
| ngón cái xuống | t01-sakura | R | part than along 0.75 thumb down around 180 | 0.1 | — | size |
| nắm phần vai | t01-sakura | R | part vai along 0.79 thumb up around 330 | 0.5 | — | role, size |
| nắm phần co | t01-sakura | R | part co along 0.93 thumb up around 330 | 0.5 | 0.5° | wrist |
| mặc định (wrap) | kuroiwa | R | part than along 0.25 thumb up around 330 | 0.1 | — | — |
| along cao | kuroiwa | R | part than along 0.75 thumb up around 330 | 0 | — | — |
| ngón cái xuống | kuroiwa | R | part than along 0.75 thumb down around 180 | 0.1 | — | — |
| nắm phần vai | kuroiwa | R | part vai along 0.79 thumb up around 0 | 0.5 | — | — |
| nắm phần co | kuroiwa | R | part co along 0.92 thumb up around 0 | 0.3 | — | — |
