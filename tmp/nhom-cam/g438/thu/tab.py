import json,sys
d=json.load(open(sys.argv[1]))
items=sys.argv[2].split(',') if len(sys.argv)>2 else None
for c in d['cells']:
    if items and c['item'] not in items: continue
    for h in c['hands']:
        r=h.get('raw') or {}
        g=r.get('gaps',{}); gr=r.get('grasp',{}) or {}; ch=gr.get('choice',{})
        f=r.get('fingers',{})
        fs=' '.join(f"{k[:2]}{v:.1f}" for k,v in (f or {}).items()) if isinstance(f,dict) else ''
        print(f"{c['item'][4:]:10} {c['ma']:18} {c['person'][:5]} {h['hand']} {ch.get('variant','?'):5} {ch.get('edge','')}/{ch.get('thumb','')}/{ch.get('slant','')} sink {r.get('sink',0):.2f} thumb {g.get('thumb',float('nan')):.2f} | {fs} | {','.join(c.get('rules',[]))}")
