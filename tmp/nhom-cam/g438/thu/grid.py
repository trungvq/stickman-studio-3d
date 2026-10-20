import json,sys
v=sys.argv[1]; ts=sys.argv[2].split(',')
data={t:{tuple(r['th']):r['res'] for r in json.load(open(f'/tmp/g438/grid-{v}-{t}.json'))} for t in ts}
for t in ts:
    rows=sorted(data[t].items(), key=lambda kv: max(abs(x[0]-0.3) for x in kv[1]) )
    print('== t',t)
    for th,res in rows[:8]:
        print(' ',th,' '.join(f"{g:.2f}/{s:.2f}" for g,s in res))
# combos good for all t: score max over t of worst |gap|
keys=set.intersection(*[set(d) for d in data.values()])
sc=[]
for k in keys:
    w=max(max(x[0] for x in data[t][k]) for t in ts); lo=min(min(x[0] for x in data[t][k]) for t in ts)
    sc.append((w,lo,k))
sc.sort()
print('== chung'); 
for w,lo,k in sc[:10]: print(k, f"max {w:.2f} min {lo:.2f}")
