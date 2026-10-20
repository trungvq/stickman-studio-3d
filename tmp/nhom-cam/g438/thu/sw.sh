#!/bin/bash
cd ~/Work/Dev/stickman-studio-3d-nhom-cam/packages/rig && timeout 600 npx vitest run src/core/g438sweep.test.ts --silent=false --reporter=verbose 2>&1 | grep -E "^t |Error|error" 
