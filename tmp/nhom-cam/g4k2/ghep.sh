#!/bin/bash
# Ghép khung trước/sau thành mp4 cạnh nhau: ghep.sh <thư mục trước> <thư mục sau> <ra.mp4>
set -e
F=/usr/share/fonts/noto/NotoSans-Regular.ttf
LBL="fontfile=$F:x=16:y=12:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8"
TIME="fontfile=$F:text='%{eif\:n/30\:d},%{eif\:mod(n\,30)*100/30\:d\:2} s':x=(w-tw)/2:y=h-th-16:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8"
ffmpeg -y -loglevel error -framerate 30 -i "$1/f%04d.png" -framerate 30 -i "$2/f%04d.png" \
  -filter_complex "[0:v]drawtext=$LBL:text='trước sửa'[a];[1:v]drawtext=$LBL:text='sau sửa'[b];[a][b]hstack=inputs=2,drawtext=$TIME[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart "$3"
