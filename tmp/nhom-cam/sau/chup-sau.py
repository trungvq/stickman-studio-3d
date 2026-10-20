import json,subprocess,sys,os
R=os.path.expanduser('~/Work/Dev/stickman-studio-3d-nhom-cam/tmp/nhom-cam')
OUT=R+'/sau/can-tay'
d=json.load(open(R+'/truoc/lan-cam.json'))['lanCam']
ex=json.load(open(R+'/sau/extra.json'))
m={}
for r in d:
    e=m.setdefault(r['canh'],{'g':set(),'ai':set()})
    e['g'].update(r['giay']); e['ai'].add(r['cast'])
for c,v in ex.items():
    m[c]['g'].update(v['g']); m[c]['ai'].update(v['ai'])
only=sys.argv[1:]
os.makedirs(OUT,exist_ok=True)
for c in sorted(m):
    if only and c not in only: continue
    e=m[c]
    cmd=['flock','/tmp/nhom-cam-dist.lock','nice','-n','19','pnpm','-s','can-tay',c,','.join(str(g) for g in sorted(e['g'])),'--ai',','.join(sorted(e['ai'])),'--out',OUT,'--tab','2']
    print('RUN',' '.join(cmd),flush=True)
    for k in range(3):
        r=subprocess.run(cmd,cwd=os.path.expanduser('~/Work/Dev/youtube-video/jp-sukatto-nhom-cam'),capture_output=True,text=True,timeout=1500)
        if r.returncode==0 or os.path.exists(f'{OUT}/{c}.jpg'): break
        print('RETRY',c,r.stderr[-300:],flush=True)
    print('OK',c,r.returncode,flush=True)
print('DONE')
