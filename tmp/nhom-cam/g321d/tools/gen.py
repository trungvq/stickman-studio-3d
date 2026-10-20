import json,math,copy,sys
base=json.load(open('/tmp/thu-orig.json'))
def tw(a): r=math.radians(a); return [round(-math.cos(r),4),0,round(-math.sin(r),4)]
def it(t,off,a=None,cam=False):
    m={"t":t,"cast":"takumi","item":"thu-bang-gia","to":"chest","offset":off}
    if a is None and not cam: m["face"]={"axis":"front","toward":"holderFace"}
    else: m["face"]={"axis":"front","toward":"camera" if cam else tw(a)}; m["roll"]={"axis":"top","toward":"up"}
    return m
G=dict(item="thu-bang-gia",group="sheet")
def H(**k): return {"hold":dict(G,**k)}
def build(items,hands):
    s=copy.deepcopy(base); s['items']=items
    old=s['cast'][0]['world']['hands']
    s['cast'][0]['world']['hands']=hands+[h for h in old if h['t']>=4.5]
    return s
