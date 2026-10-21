#!/bin/bash
# kiem.sh <gốc cây rig> <ra.txt> — trong khoá: trỏ rig sang cây, `stickman check` các cảnh có chỗ cầm `cylinder`, trả link
V=/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam
L=/home/trungvq/Work/Dev/stickman-studio-3d/.claude/worktrees/agent-ab32233b982fcca9e/tmp/nhom-cam/g4k3/link.mjs
RE='^(boi-canh-hanare|t02-s022-cup|t02-s033-ruou-tang|t02-s02[01]-goi|t02-s01[78]-goi|t02-s052-o|thu-bon-o-|t02-s060-mot-dem|thu-do-dt-ban-kaedeya|thu-do-nho-|thu-grip-|thu-hd-|thu-ruou|thu-sanh-do|thu-may-anh)'
flock /tmp/jp-sukatto-nhom-cam.lock bash -c '
  LK=$4
  trap "node \"$LK\" goc >/dev/null" EXIT
  node "$4" "$1" >/dev/null
  cd "$2"
  node "$1/packages/cli/cli.mjs" check --scene "$5" > "$3" 2>&1
  true
' _ "$1" "$V" "$2" "$L" "$RE"
tail -1 "$2"
ls -la $V/node_modules/@stickman3d/ | grep -c stickman-studio-3d-nhom-cam
