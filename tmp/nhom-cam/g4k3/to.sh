#!/bin/bash
# Tờ khung trích: [T0=<giây khung 0>] to.sh <ra.jpg> <góc> <chỉ số khung…> — mỗi hàng một khung, trái trước / phải sau (/tmp/g4k3r)
set -e
OUT=$1; A=$2; shift 2
F=/usr/share/fonts/noto/NotoSans-Regular.ttf
rows=()
for i in "$@"; do
  n=$(printf "%04d" "$i")
  sec=$(awk -v i="$i" -v t0="${T0:-0}" 'BEGIN { printf "%.2f s", t0 + i / 30 }')
  r=/tmp/g4k3r/row-$A-$i.png
  ffmpeg -y -loglevel error -i /tmp/g4k3r/truoc-$A/f$n.png -i /tmp/g4k3r/sau-$A/f$n.png \
    -filter_complex "[0][1]hstack=2,scale=900:-1,drawtext=fontfile=$F:text='$sec (trái trước · phải sau)':x=8:y=8:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.6" "$r"
  rows+=(-i "$r")
done
ffmpeg -y -loglevel error "${rows[@]}" -filter_complex "vstack=inputs=$#" -q:v 3 "$OUT"
