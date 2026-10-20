import json,subprocess,sys,os
OUT=os.path.expanduser('~/Work/Dev/stickman-studio-3d-nhom-cam/tmp/nhom-cam/truoc/can-tay')
d=json.load(open(os.path.expanduser('~/Work/Dev/stickman-studio-3d-nhom-cam/tmp/nhom-cam/truoc/lan-cam.json')))['lanCam']
m={}
for r in d:
    e=m.setdefault(r['canh'],{'g':set(),'ai':set()})
    e['g'].update(r['giay']); e['ai'].add(r['cast'])
os.makedirs(OUT,exist_ok=True)
for c in sorted(m):
    e=m[c]
    cmd=['nice','-n','19','pnpm','-s','can-tay',c,','.join(str(g) for g in sorted(e['g'])),'--ai',','.join(sorted(e['ai'])),'--out',OUT,'--tab','2']
    print('RUN',' '.join(cmd),flush=True)
    for k in range(3):
        r=subprocess.run(cmd,cwd=os.path.expanduser('~/Work/Dev/youtube-video/jp-sukatto-truoc'),capture_output=True,text=True,timeout=900)
        if r.returncode==0 or os.path.exists(f'{OUT}/{c}.jpg'): break
        print('RETRY',c,r.stderr[-300:],flush=True)
    print('OK',c,r.returncode,flush=True)
print('DONE')
