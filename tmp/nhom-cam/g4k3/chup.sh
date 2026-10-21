#!/bin/bash
# Dựng khung bốn video của G4-K3 cho cây rig đang trỏ ở node_modules/@stickman3d (link.mjs): chup.sh <truoc|sau> <cảnh s012>
# Chạy được từ bất kỳ đâu; cảnh thử đổi đường và s012 vẽ dạng dựng tạm. Khung ra /tmp/g4k3r/<nhãn>-<góc>/
set -e
G=$(cd "$(dirname "$0")/.." && pwd)
V=/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam
cd "$V"
R=/tmp/g4k3r/$1
TARGET=-28,-300,175 KHUNG=250 DIR="-0.7071,-0.35,-0.7071" node "$G/g4k3/vid.mjs" "$R-doi" "$G/g4k2/thu-nhom-cam-doi-duong.json" 0 3.6 30 720
TARGET=-28,-300,175 KHUNG=250 DIR="-0.7071,-0.35,-0.7071" node "$G/g4k3/vid.mjs" "$R-thap" "$G/g4k3/thu-nhom-cam-doi-duong-moc-thap.json" 0 3.6 30 720
TARGET=256,-208,644 KHUNG=90 DIR="1,-0.7,-0.2" node "$G/g4k3/vid.mjs" "$R-can" "$2" 5.2 7.5 30 720
TARGET=262,-250,650 KHUNG=300 DIR="1,-0.5,-0.45" node "$G/g4k3/vid.mjs" "$R-quay" "$2" 5.2 7.5 30 720
