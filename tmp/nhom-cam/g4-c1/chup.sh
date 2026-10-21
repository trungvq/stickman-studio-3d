#!/bin/bash
# chup.sh <gốc cây rig> <out> [bang-cam args…] — trong khoá: trỏ rig sang cây, chạy bang-cam, trả link
set -e
TREE=$1; OUT=$2; shift 2
V=/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam
L=/home/trungvq/Work/Dev/stickman-studio-3d/.claude/worktrees/agent-ab32233b982fcca9e/tmp/nhom-cam/g4k3/link.mjs
flock /tmp/jp-sukatto-nhom-cam.lock bash -c '
  set -e
  LK=$4
  trap "node \"$LK\" goc >/dev/null" EXIT
  node "$4" "$1" >/dev/null
  cd "$2"
  shift 4
  node tools/bang-cam.mjs "$@"
' _ "$TREE" "$V" "$OUT" "$L" --out "$OUT" "$@"
ls -la $V/node_modules/@stickman3d/ | tail -6
