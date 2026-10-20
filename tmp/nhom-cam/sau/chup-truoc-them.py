import json,subprocess,sys,os
R=os.path.expanduser('~/Work/Dev/stickman-studio-3d-nhom-cam/tmp/nhom-cam')
OUT=R+'/truoc/can-tay-them'
ex=json.load(open(R+'/sau/extra.json'))
os.makedirs(OUT,exist_ok=True)
for c in sorted(ex):
    e=ex[c]
    cmd=['nice','-n','19','pnpm','-s','can-tay',c,','.join(str(g) for g in e['g']),'--ai',','.join(e['ai']),'--out',OUT,'--tab','2']
    print('RUN',' '.join(cmd),flush=True)
    for k in range(3):
        r=subprocess.run(cmd,cwd=os.path.expanduser('~/Work/Dev/youtube-video/jp-sukatto-truoc'),capture_output=True,text=True,timeout=1500)
        if r.returncode==0 or os.path.exists(f'{OUT}/{c}.jpg'): break
        print('RETRY',c,r.stderr[-300:],flush=True)
    print('OK',c,r.returncode,flush=True)
print('DONE')
