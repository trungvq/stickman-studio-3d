#!/bin/bash
# chup.sh — các lượt chụp cho tờ duyệt (mỗi lượt giữ khoá riêng)
SAU=/home/trungvq/Work/Dev/stickman-studio-3d/.claude/worktrees/agent-aa363cea37e2be98f
T="node tmp/chop-tools/bang-cam.mjs --at -95,0,300 --nhom chopsticks --mon thu-dua"
/tmp/chop/run.sh /tmp/chop-truoc "DUA_DAT=/tmp/chop/dat-cu.json KHUNG=45 GOC=truoc,ngang,trong $T --out /tmp/chop/truoc-z >/tmp/chop/l1.log 2>&1"
echo truoc-z $?
/tmp/chop/run.sh $SAU "DUA_DAT=/tmp/chop/dat-moi.json $T --out /tmp/chop/sau >/tmp/chop/l2.log 2>&1"
echo sau $?
/tmp/chop/run.sh $SAU "DUA_DAT=/tmp/chop/dat-moi.json KHUNG=45 GOC=truoc,ngang,trong $T --out /tmp/chop/sau-z >/tmp/chop/l3.log 2>&1"
echo sau-z $?
/tmp/chop/run.sh $SAU "node $SAU/packages/cli/cli.mjs check --scene '^(t02-s03[24]|t02-s04[189]|t02-s050|thu-do-nen-bep|thu-hd-lat-ca|thu-hd-rot-ruou|thu-grip-nho)' > /tmp/chop/check-sau.txt 2>&1"
echo check $?
echo XONG
