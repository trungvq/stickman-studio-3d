#!/usr/bin/env bash
# Tờ s033: mỗi giây hai hàng — trước (g4-bowl-kep, kẹp chưa xoay ngón cái) và sau (g4-bowl-roll) — tay phải takumi
set -e
D=$(dirname "$0"); OUT=${1:?ra}
A=${A:-$D/../g4-bowl-kep/can-tay/t02-s033-ruou-tang}; B=${B:-$D/can-tay/t02-s033-ruou-tang}; LA=${LA:-ngón cái chưa xoay trục}; LB=${LB:-ngón cái xoay trục 45°, tầm cầm along 0,4–0,5}
F=/usr/share/fonts/Adwaita/AdwaitaSans-Italic.ttf; [ -f "$F" ] || F=/usr/share/fonts/Adwaita/AdwaitaSans-Regular.ttf
T=$(mktemp -d); i=0
row() { local lab=$1 dir=$2 t=$3
  magick \( -size 1500x40 xc:white -font "$F" -pointsize 22 -fill black -annotate +8+28 "$lab" \) \
    \( "$dir/$t-takumi-tay-phải-truoc.png" "$dir/$t-takumi-tay-phải-cheo.png" "$dir/$t-takumi-tay-phải-ngang.png" -resize 500x500 +append \) -append "$T/$(printf %02d $i).png"
  i=$((i+1)); }
for t in 0 0.3 0.65 1.2; do
  row "giây $t — trước (bowl pinch, $LA)" "$A" "$t"
  row "giây $t — sau (bowl pinch, $LB)" "$B" "$t"
done
magick "$T"/*.png -append -quality 85 "$OUT"; rm -rf "$T"; echo "$OUT"
