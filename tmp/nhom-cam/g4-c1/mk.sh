#!/bin/bash
M=/home/trungvq/Work/Dev/stickman-studio-3d/.claude/worktrees/agent-ab32233b982fcca9e/tmp/nhom-cam/mau
D=/home/trungvq/Work/Dev/stickman-studio-3d/.claude/worktrees/agent-ab32233b982fcca9e/tmp/nhom-cam/duyet
H=/tmp/cyl/hien/o
S=/tmp/cyl/sau/o
O=thu-ong-nghe-ban/bang-cam-thu-ong-nghe-ban-cylinder
bash /tmp/cyl/to.sh $D/g4-cylinder-ong-nghe-chieu-truoc-sau.jpg $M/ong-nghe-cam.jpg "Ống nghe trước ngực, rig tự chọn — mẫu ong-nghe-cam (ngón cái về loa)" \
  "thu-ong-nghe-ban mặc định · sakura|$H/$O-mac-dinh-P-t01-sakura|$S/$O-mac-dinh-P-t01-sakura" \
  "thu-ong-nghe-ban mặc định · kuroiwa|$H/$O-mac-dinh-P-kuroiwa|$S/$O-mac-dinh-P-kuroiwa"
bash /tmp/cyl/to.sh $D/g4-cylinder-ap-tai-truoc-sau.jpg $M/ong-nghe-tai.jpg "Ống nghe áp tai (around 180, flat) — mẫu ong-nghe-tai (cầm như điện thoại)" \
  "áp tai, tay trái · sakura|$H/$O-ap-tai-T-t01-sakura|$S/$O-ap-tai-T-t01-sakura" \
  "áp tai, tay trái · kuroiwa|$H/$O-ap-tai-T-kuroiwa|$S/$O-ap-tai-T-kuroiwa"
C=thu-chai-dia/bang-cam-thu-chai-dia-cylinder
T=thu-chai-dac-tuyen/bang-cam-thu-chai-dac-tuyen-cylinder
bash /tmp/cyl/to.sh $D/g4-cylinder-wrap-cai-truoc-sau.jpg $M/chai-than.jpg "Chai cầm thân (rig tự chọn, wrap) — mẫu chai-than (ngón cái ôm thân phía đối các ngón)" \
  "thu-chai-dia mặc định · sakura|$H/$C-mac-dinh-P-t01-sakura|$S/$C-mac-dinh-P-t01-sakura" \
  "thu-chai-dia mặc định · kuroiwa|$H/$C-mac-dinh-P-kuroiwa|$S/$C-mac-dinh-P-kuroiwa" \
  "thu-chai-dac-tuyen mặc định · kuroiwa|$H/$T-mac-dinh-P-kuroiwa|$S/$T-mac-dinh-P-kuroiwa"
