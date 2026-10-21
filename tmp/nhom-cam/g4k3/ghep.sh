#!/bin/bash
# Ghép khung trước/sau thành mp4 cạnh nhau: ghep.sh <khung trước> <khung sau> <ra.mp4> <nhãn trái> <nhãn phải> [khung đầu]
# `khung đầu`: số khung 30 fps của giây đầu (5,2 s → 156) cho nhãn giây
set -e
F=/usr/share/fonts/noto/NotoSans-Regular.ttf
N=${6:-0}
LBL="fontfile=$F:x=16:y=12:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8"
TIME="fontfile=$F:text='%{eif\:(n+$N)/30\:d},%{eif\:mod(n+$N\,30)*100/30\:d\:2} s':x=(w-tw)/2:y=h-th-16:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8"
ffmpeg -y -loglevel error -framerate 30 -i "$1/f%04d.png" -framerate 30 -i "$2/f%04d.png" \
  -filter_complex "[0:v]drawtext=$LBL:text='$4'[a];[1:v]drawtext=$LBL:text='$5'[b];[a][b]hstack=inputs=2,drawtext=$TIME[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart "$3"
