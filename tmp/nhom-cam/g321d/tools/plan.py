import re,heapq,itertools
ok={}
for l in open('sw1.txt'):
    p=l.split()
    if len(p)<5: continue
    side,edge,thumb,var=p[:4]; m=re.match(r'off\[(\d+),(-?\d+)\]',p[4]); f,la=int(m[1]),int(m[2])
    ok[(side,edge,thumb,var,f,la)]=set(int(x) for x in p[5:])
F=[30,42,55]; L=[-35,-20,0,20,35]
grips=sorted(set(k[1:4] for k in ok))
def good(side,g,a,f,la):
    if g is None: return True
    a=((a+180)%360)-180
    return a in ok.get((side,)+g+(f,la),())
start=(0,0,2,('right','front','pinch'),None)
def goal(s):
    a,fi,li,R,Lg=s
    return a%360==180 and R and Lg
dist={start:0}; prev={}; cnt=itertools.count(); pq=[(0,0,start)]
while pq:
    d,_,s=heapq.heappop(pq)
    if d>dist[s]: continue
    if goal(s): break
    a,fi,li,R,Lg=s; f,la=F[fi],L[li]
    nb=[]
    for da,dfi,dli in [(15,0,0),(-15,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]:
        nfi,nli=fi+dfi,li+dli
        if not(0<=nfi<3 and 0<=nli<5): continue
        na=(a+da)%360
        if good('right',R,na,F[nfi],L[nli]) and good('left',Lg,na,F[nfi],L[nli]):
            nb.append(((na,nfi,nli,R,Lg),1))
    if R and Lg: nb+= [((a,fi,li,None,Lg),2),((a,fi,li,R,None),2)]
    for g in grips:
        if R is None and (Lg is None or g[0]!=Lg[0]) and good('right',g,a,f,la): nb.append(((a,fi,li,g,Lg),3))
        if Lg is None and (R is None or g[0]!=R[0]) and good('left',g,a,f,la): nb.append(((a,fi,li,R,g),3))
    for n,c in nb:
        if d+c<dist.get(n,1e9): dist[n]=d+c; prev[n]=s; heapq.heappush(pq,(d+c,next(cnt),n))
path=[s]
while path[-1] in prev: path.append(prev[path[-1]])
for a,fi,li,R,Lg in reversed(path): print(((a+180)%360)-180,F[fi],L[li],'R=',R,'L=',Lg)
