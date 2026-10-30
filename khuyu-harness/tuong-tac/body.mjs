import fs from 'fs'; import path from 'path';
const dir='/home/trungvq/Work/Dev/youtube-video/jp-sukatto/scenes';
const files=fs.readdirSync(dir).filter(f=>/^t0[12]-/.test(f));
const st={}, sc={};
for(const f of files){ const s=JSON.parse(fs.readFileSync(path.join(dir,f)));
 for(const c of s.cast||[]) for(const h of c.world?.hands||[]) for(const side of ['left','right']){ const v=h[side]; if(!v||!v.to||v.hold) continue;
  const p=typeof v.palm==='string'?v.palm:(v.palm?.toward?'→'+v.palm.toward:(v.palm?'vec':'-'));
  const k=`${f.slice(0,3)} ${v.to} pt=${v.point||'-'} palm=${p} fing=${typeof v.fingers==='string'?v.fingers:(v.fingers?'vec':'-')} ${v.pose?'pose='+v.pose:''}`;
  st[k]=(st[k]||0)+1; (sc[k] ||= new Set()).add(s.name+'/'+c.id);}}
for(const [k,v] of Object.entries(st).sort((a,b)=>b[1]-a[1]).slice(0,40)) console.log(v,k,[...sc[k]].length,[...sc[k]].slice(0,3).join(' '));
