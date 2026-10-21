#!/usr/bin/env bash
# Ghép tờ duyệt kẹp chén: hàng ảnh mẫu (chen-ruou-2 cắt ba khung), v1, rồi các hàng v2 từ bang-cam
# to.sh <thư mục bang-cam o/thu-chen> <ảnh ra>
set -e
O=${1:?o/thu-chen}; OUT=${2:?ra}
M=$(dirname "$0")/../g4-bowl-kep/mau
F=/usr/share/fonts/Adwaita/AdwaitaSans-Italic.ttf
[ -f "$F" ] || F=/usr/share/fonts/Adwaita/AdwaitaSans-Regular.ttf
T=$(mktemp -d)
row() { # nhãn, ba ảnh
  local lab=$1; shift
  magick "$1" -resize 500x500 -background white -gravity center -extent 500x500 "$T/a.png"
  magick "$2" -resize 500x500 -background white -gravity center -extent 500x500 "$T/b.png"
  magick "$3" -resize 500x500 -background white -gravity center -extent 500x500 "$T/c.png"
  magick -size 1500x40 xc:white -font "$F" -pointsize 22 -fill black -annotate +8+28 "$lab" \
    \( "$T/a.png" "$T/b.png" "$T/c.png" +append \) -append "$T/r$(ls $T | grep -c '^r')x.png"
}
row "Ảnh mẫu chen-ruou-2.png (chủ dự án duyệt): trỏ–giữa ôm thành, ngón cái khuất sau chén, lòng tay không áp" $M/m2-truoc.png $M/m2-cheo.png $M/m2-ngang.png
row "v1 chen#kep (sakura, tay phải)" $M/v1-truoc.png $M/v1-cheo.png $M/v1-ngang.png
r() { row "$1" "$O/$2-truoc.png" "$O/$2-cheo.png" "$O/$2-ngang.png"; }
r "v2 thu-chen@bowl pinch (mặc định chén nhỏ), tay dẫn (sakura, tay phải)" bang-cam-thu-chen-bowl-tay-dan-P-t01-sakura
r "v2 hai tay: tay phải pinch, tay trái đỡ đáy (tay dẫn, sakura)" bang-cam-thu-chen-bowl-tay-dan-hai-H-t01-sakura
r "v2 pinch, tay dẫn (kuroiwa, tay phải)" bang-cam-thu-chen-bowl-tay-dan-P-kuroiwa
r "v2 pinch, tay dẫn (sakura, tay trái)" bang-cam-thu-chen-bowl-tay-dan-trai-T-t01-sakura
[ -n "$EXTRA" ] && for x in $EXTRA; do r "v2 pinch, món đặt trước: ${x#bang-cam-thu-chen-bowl-}" "$x"; done
magick $(ls $T/r*x.png | sort -V) -append -quality 85 "$OUT"
rm -rf "$T"
echo "$OUT"
