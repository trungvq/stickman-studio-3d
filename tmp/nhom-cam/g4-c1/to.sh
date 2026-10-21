#!/bin/bash
# to.sh <ra.jpg> <ảnh mẫu> <tiêu đề> <nhãn|ô trước (tiền tố)|ô sau (tiền tố)>… — tờ duyệt: ảnh mẫu trên cùng, rồi mỗi việc
# hai hàng (TRƯỚC, SAU), mỗi hàng ba góc trước / chéo / ngang, ô 400
set -e
OUT=$1; MAU=$2; TITLE=$3; shift 3
F=/usr/share/fonts/noto/NotoSans-Regular.ttf
T=$(mktemp -d)
W=1200
magick -size ${W}x56 xc:'#f3efe6' -font $F -pointsize 22 -fill black -gravity center -annotate +0+0 "$TITLE" $T/00.png
magick "$MAU" -resize ${W}x $T/01.png
i=2
for row in "$@"; do
  IFS='|' read -r LBL A B <<< "$row"
  for k in A B; do
    p=${!k}
    tag=$([ $k = A ] && echo "TRƯỚC" || echo "SAU")
    magick -size ${W}x40 xc:'#f3efe6' -font $F -pointsize 22 -fill black -gravity west -annotate +12+0 "$tag · $LBL" $T/$(printf %02d $i).png
    i=$((i + 1))
    magick "$p-truoc.png" "$p-cheo.png" "$p-ngang.png" -resize 400x400 +append $T/$(printf %02d $i).png
    i=$((i + 1))
  done
done
magick $T/*.png -append -quality 88 "$OUT"
rm -rf $T
