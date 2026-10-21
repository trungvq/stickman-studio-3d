#!/bin/bash
# check s012 với một cây rig: kiem.sh <gốc cây rig> <cảnh s012.json> <ra.txt>. Trỏ node_modules/@stickman3d của repo video
# sang cây ấy (check nạp rig từ repo video), chép cảnh vào scenes/, chạy, rồi trả link về như cũ và cảnh về bản mới (`.moi`)
set -e
G=$(cd "$(dirname "$0")" && pwd)
V=/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam
node "$G/link.mjs" "$1" > /dev/null
cp "$2" "$V/scenes/t02-s012-chia-khoa.json"
(cd "$V" && node "$1/packages/cli/cli.mjs" check --scene '^t02-s012' > "$3" 2>&1) || true
node "$G/link.mjs" goc > /dev/null
cp "$G/t02-s012-chia-khoa.moi.json" "$V/scenes/t02-s012-chia-khoa.json"
tail -1 "$3"
