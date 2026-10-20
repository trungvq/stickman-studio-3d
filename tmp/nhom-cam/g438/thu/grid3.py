import json,sys
v=sys.argv[1]; ts=sys.argv[2].split(',')
for t in ts:
    d=json.load(open(f'/tmp/g438/grid-{v}-{t}.json'))
    d.sort(key=lambda r:max(max(x[0] for x in r['res']), max(x[1] for x in r['res'])))
    print('== t',t)
    for r in d[:4]: print(' ',r['th'],' '.join(f"{g:.2f}/{s:.2f}" for g,s in r['res']))
