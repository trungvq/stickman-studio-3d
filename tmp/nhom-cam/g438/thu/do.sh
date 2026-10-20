#!/bin/bash
# đo nhanh: $1 = tên thư mục ra
cd ~/Work/Dev/youtube-video/jp-sukatto-nhom-cam
timeout 900 node tmp/g438/bang-cam-do.mjs --at -95,0,300 --nhom sheet --mon thu-bang-gia,thu-thuc-don,thu-tom-hum,thu-bao,thu-bo-da,thu-dien-thoai --out tmp/g438/$1 > tmp/g438/$1.log 2>&1
tail -1 tmp/g438/$1.log
