#!/bin/bash
# to.sh <ra.jpg> — tờ duyệt g4-chopsticks trước | sau
set -e
OUT=$1
F=/usr/share/fonts/noto/NotoSans-Regular.ttf
W=2400
TMP=/tmp/chop/to; rm -rf $TMP; mkdir -p $TMP
bar() { # bar <file> <chữ> [màu]
  printf '%s' "$2" > "$1.txt"
  ffmpeg -y -loglevel error -f lavfi -i "color=c=${3:-0x2b2b2b}:s=${W}x56:d=1" \
    -vf "drawtext=fontfile=$F:textfile=$1.txt:x=16:y=12:fontsize=28:fontcolor=white" -frames:v 1 "$1"
}
cell() { # cell <dir> <hàng> <người> <góc> -> path
  ls "$1"/o/thu-dua/*-chopsticks-"$2"-[PT]-"$3"-"$4".png 2>/dev/null | head -1
}
parts=()
ffmpeg -y -loglevel error -i /home/trungvq/Work/Dev/stickman-studio-3d-nhom-cam/tmp/nhom-cam/mau/dua-an-can.jpg \
  -vf "scale=-1:520,pad=$W:540:(ow-iw)/2:10:color=0xF0ECE2" -frames:v 1 $TMP/mau.png
bar $TMP/h0.png "g4-chopsticks — ảnh mẫu dua-an-can (tay trái/gương: chỉ lấy ngón nào chạm chỗ nào). Mỗi hàng: TRƯỚC (rig 9a8eb67, 3 ô trái) | SAU (3 ô phải)" 0x6b3a1f
parts+=($TMP/h0.png $TMP/mau.png)
n=0
for P in t01-sakura kuroiwa; do
  for spec in "mac-dinh:món đặt trước ngực (trước: hướng cũ của bang-cam; sau: ngọn ra trước chúc 30°, hai que ngang)" "tay-dan:tay dẫn phải (ngọn ra trước chúc 30°)" "tay-dan-trai:tay dẫn trái"; do
    m=${spec%%:*}; t=${spec#*:}
    for z in "" "-z"; do
      if [ -z "$z" ]; then G="truoc cheo ngang"; lab="góc trước · chéo · ngang"; else G="truoc ngang trong"; lab="CẬN: trước · ngang · phía trong"; fi
      n=$((n+1))
      bar $TMP/b$n.png "$P · $t · $lab"
      ins=();
      for d in /tmp/chop/truoc$z /tmp/chop/sau$z; do for g in $G; do ins+=(-i "$(cell $d $m $P $g)"); done; done
      ffmpeg -y -loglevel error "${ins[@]}" -filter_complex \
        "[0][1][2]hstack=3,scale=1190:-1,pad=1200:ih:0:0:color=0xF0ECE2[a];[3][4][5]hstack=3,scale=1190:-1,pad=1200:ih:10:0:color=0xc0392b[b];[a][b]hstack=2" \
        -frames:v 1 $TMP/r$n.png
      parts+=($TMP/b$n.png $TMP/r$n.png)
    done
  done
done
args=(); for p in "${parts[@]}"; do args+=(-i "$p"); done
ffmpeg -y -loglevel error "${args[@]}" -filter_complex "vstack=inputs=${#parts[@]}" -frames:v 1 -q:v 4 "$OUT"
