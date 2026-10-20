#!/bin/bash
# run.sh file.json [step] [t0] [t1]
st=${2:-0.05}; a=${3:-0}; b=${4:-4.5}
node /tmp/g321d/probe.mjs $1 $(python3 -c "import numpy" 2>/dev/null; python3 -c "
a,b,s=$a,$b,$st; n=int(round((b-a)/s)); print(','.join(str(round(a+i*s,3)) for i in range(n+1)))")
