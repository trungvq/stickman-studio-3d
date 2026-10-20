from gen import *
import subprocess,itertools
def mk(sl1=30,LAT=35,LAT2=None,a1=75,a2=105,LG2=dict(edge="top",thumb="back",variant="rim"),RG=dict(edge="right",thumb="back",variant="rim"),LG1=dict(edge="top",thumb="front",variant="pinch"),F=30,LATend=None,Fend=None,T=(2.3,2.45,2.7,2.85,3.2)):
    LATend=LAT if LATend is None else LATend; Fend=F if Fend is None else Fend; LAT2=LAT if LAT2 is None else LAT2
    t1,t2,t3,t4,t5=T
    items=[it(0,[30,-3,0]),it(2,[30,-3,0]),
     it(t1,[F,-2,LAT],a1), it(t2,[F,-2,LAT],a1), it(t3,[F,-2,LAT2],a2), it(t4,[F,-2,LAT2],a2),
     it(t5,[Fend,0,LATend],cam=True), it(4.4,[Fend,0,LATend],cam=True)]
    H1=H(edge="right",along=0.33,thumb="front",variant="pinch",slant=sl1)
    hands=[{"t":0,"right":H1},{"t":t1,"left":H(**LG1)},{"t":t2,"right":{"hold":None}},
     {"t":t3,"right":H(**RG)},{"t":t4,"left":{"hold":None}},{"t":t5,"left":H(**LG2)}]
    return build(items,hands)
def ev(s,name='x'):
    json.dump(s,open(f'/tmp/g321d/{name}.json','w'),indent=1)
    o=subprocess.run(['./run.sh',f'{name}.json','0.05','0','4.45'],capture_output=True,text=True).stdout
    worst={}
    for l in o.splitlines():
        if l.startswith('ERR'): return l[:200]
        t=float(l.split()[0])
        for part in l.split('|'):
            for tok in part.split():
                if tok[:3] in ('r:o','l:o'):
                    side=tok[0]; ov=float(tok[3:])
                    b=float(part.split()[part.split().index(tok)+1][1:])
                    w=worst.setdefault(side,[0,0,0,0]); 
                    if ov>w[0]: w[0]=ov; w[1]=t
                    if b>w[2]: w[2]=b; w[3]=t
    return ' '.join(f"{k}: over {v[0]}@{v[1]} body {v[2]}@{v[3]}" for k,v in worst.items())
if __name__=='__main__':
    import sys
    for sl in [30,15]:
        print('sl1',sl,ev(mk(sl1=sl)))
    for lg in [dict(edge="top",thumb="back",variant="pinch"),dict(edge="top",thumb="back",variant="flat"),dict(edge="top",thumb="back",variant="rim",slant=0),dict(edge="top",thumb="back",variant="rim",along=0.5),dict(edge="left",thumb="back",variant="pinch"),dict(edge="left",thumb="back",variant="rim"),dict(edge="bottom",thumb="back",variant="rim")]:
        print(lg,ev(mk(LG2=lg)))
def evf(s,name='x',a=0,b=4.45,st=0.01):
    json.dump(s,open(f'/tmp/g321d/{name}.json','w'),indent=1)
    o=subprocess.run(['./run.sh',f'{name}.json',str(st),str(a),str(b)],capture_output=True,text=True).stdout
    import re
    w={'r':[0,0,0,0],'l':[0,0,0,0]}
    for l in o.splitlines():
        if l.startswith('ERR'): return l[:200]
        t=float(l.split()[0])
        for m in re.finditer(r'([rl]):o([\d.]+) b([\d.]+)',l):
            x=w[m[1]]; o_=float(m[2]); b_=float(m[3])
            if o_>x[0]: x[0]=o_; x[1]=t
            if b_>x[2]: x[2]=b_; x[3]=t
    return ' '.join(f"{k}: over {v[0]}@{v[1]} body {v[2]}@{v[3]}" for k,v in w.items())
LGF=dict(edge='top',thumb='back',variant='rim',slant=0)
