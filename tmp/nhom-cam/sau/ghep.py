import json,os,subprocess,collections,sys
R=os.path.expanduser('~/Work/Dev/stickman-studio-3d-nhom-cam/tmp/nhom-cam')
F='/usr/share/fonts/Adwaita/AdwaitaSans-Regular.ttf'
GOC={}
rows=json.load(open(R+'/sau/rows.json'))
REP={('t02-s030-khai-vi','yoshie-di'):0.3,('t02-s060-mot-dem','takumi'):1.16,('t02-s028-doi-chia','takumi'):3.9,('t02-s028-doi-chia','yota'):5.66}
def tay(s): return 'phải' if s=='right' else 'trái'
def fs(x): return '%g'%x
def find(kind,scene,sec,cast,side,goc='cheo'):
    ns=[f'{fs(sec)}-{cast}-tay-{tay(side)}-{goc}.png',f'{fs(sec)}-{cast}-hai-tay-{goc}.png']
    ds=[f'{R}/truoc/can-tay/{scene}',f'{R}/truoc/can-tay-them/{scene}'] if kind=='truoc' else [f'{R}/sau/can-tay/{scene}']
    ps=[f'{d}/{n}' for n in ns for d in ds]
    for p in ps:
        if os.path.exists(p): return p
    return None
def m(*a):
    subprocess.run(['nice','-n','19','magick']+list(a),check=True)
def pair(r,sec,tile,out):
    a=b=None
    for goc in ('cheo','truoc','ngang'):
        a=find('truoc',r['scene'],sec,r['cast'],r['side'],goc); b=find('sau',r['scene'],sec,r['cast'],r['side'],goc)
        if a and b and all(float(subprocess.run(['magick',p,'-format','%[fx:mean] %[fx:standard_deviation]','info:'],capture_output=True,text=True).stdout.split()[1])>=0.05 and float(subprocess.run(['magick',p,'-format','%[fx:mean]','info:'],capture_output=True,text=True).stdout)>=0.2 for p in (a,b)): break
    else: a=b=None
    if not a or not b: print('THIEU',r['scene'],r['cast'],r['side'],sec,bool(a),bool(b)); return False
    m('(',a,'-resize',f'{tile}x{tile}',')','(',b,'-resize',f'{tile}x{tile}',')','+append','(','-size',f'{2*tile}x34','xc:white','-font',F,'-pointsize','20','-fill','black','-annotate','+6+24',f'{sec} s   trước | sau   ({goc})',')','-append',out)
    GOC[(r['i'],sec)]=goc
    return True
os.makedirs(R+'/duyet',exist_ok=True); os.makedirs('/tmp/g64',exist_ok=True)
by=collections.OrderedDict()
for i,r in enumerate(rows): r['i']=i
for r in sorted(rows,key=lambda r:(r['scene'],r['cast'],r['side'])): by.setdefault(r['scene'],[]).append(r)
tong=[]
for sc,rs in by.items():
    blocks=[]
    for r in rs:
        pp=[]
        for k,sec in enumerate(r['pick']):
            if r['scene']=='t02-s030-khai-vi' and sec in (3.76,7.42): continue
            o=f"/tmp/g64/{r['i']}-{k}.png"
            if pair(r,sec,480,o): pp.append(o)
        if not pp: continue
        lines=[pp[j:j+2] for j in range(0,len(pp),2)]
        ls=[]
        for j,l in enumerate(lines):
            o=f"/tmp/g64/{r['i']}-l{j}.png"
            m(*l,'(','-size','960x514','xc:white',')','+append',o) if len(l)==1 else m(*l,'+append',o)
            ls.append(o)
        head=f"{r['scene']} · {r['cast']} · tay {tay(r['side'])} · {r['role']} · {r['old']} → {r['hold'].get('item') or r['old'].split('#')[0]}@{r['hold'].get('group') or 'platform (tay phụ)'} · lệch {r['angle']}° / {r['shift']}"
        o=f"/tmp/g64/{r['i']}-blk.jpg"
        m(*ls,'-append','(','-size','1920x40','xc:#dde','-font',F,'-pointsize','24','-fill','black','-annotate','+8+29',head,')','+swap','-append','-quality','90',o)
        blocks.append(o)
        rep=REP.get((r['scene'],r['cast']),r['pick'][len(r['pick'])//2])
        o2=f"/tmp/g64/{r['i']}-t.png"
        if pair(r,rep,300,o2):
            lab=f"{r['scene'][4:]} {r['cast']} {tay(r['side'])[0]}.{r['old'].split('#')[0]} {r['angle']}°/{r['shift']}"
            m(o2,'(','-size','600x26','xc:#dde','-font',F,'-pointsize','17','-fill','black','-annotate','+4+19',lab,')','-append',o2.replace('-t.png','-tt.png'))
            tong.append(o2.replace('-t.png','-tt.png'))
    out=f'{R}/duyet/g6-doi-hinh-{sc.replace("t02-","")}.jpg'
    m(*blocks,'-append','-quality','85',out); print(out,os.path.getsize(out)//1024,'KB',flush=True)
cols=4
cells=[tong[i:i+cols] for i in range(0,len(tong),cols)]
rl=[]
for j,c in enumerate(cells):
    o=f'/tmp/g64/tong-{j}.png'; m(*c,'+append','-background','white','-extent',f'{600*cols}x',o); rl.append(o)
out=f'{R}/duyet/g6-doi-hinh-tong.jpg'; m(*rl,'-append','-quality','85',out); print(out,os.path.getsize(out)//1024,'KB')

json.dump({f'{k[0]}|{k[1]}':v for k,v in GOC.items()},open(R+'/sau/goc.json','w'))
