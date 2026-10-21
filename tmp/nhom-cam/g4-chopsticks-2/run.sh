#!/bin/bash
# run.sh <gốc rig> <lệnh…> — trỏ rig, chạy lệnh trong repo video, trả link (giữ flock suốt lượt)
RIG=$1; shift
V=/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam
L=/home/trungvq/Work/Dev/stickman-studio-3d/.claude/worktrees/agent-aa363cea37e2be98f/tmp/nhom-cam/g4k3/link.mjs
CMD="$*"
export RIG V L CMD
exec flock /tmp/jp-sukatto-nhom-cam.lock bash -c '
  trap "node \"$L\" goc >/dev/null" EXIT
  node "$L" "$RIG" >/dev/null
  cd "$V"
  eval "$CMD"
'
