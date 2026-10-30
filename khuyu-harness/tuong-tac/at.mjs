import fs from 'fs'; import path from 'path';
const dir='/home/trungvq/Work/Dev/youtube-video/jp-sukatto/scenes';
const st={}, sc={}; let elbowAt=0, elbowTo=0, elbowHold=0;
for(const f of fs.readdirSync(dir).filter(f=>/^t0[12]-/.test(f))){ const s=JSON.parse(fs.readFileSync(path.join(dir,f)));
 for(const c of s.cast||[]){ const seated=!!c.world?.sit||(c.tracks||[]).some(t=>t.clips?.some(cl=>/sit|seiza/.test(cl.action||'')));
 for(const h of c.world?.hands||[]) for(const side of ['left','right']){ const v=h[side]; if(!v) continue;
  if(v.elbow){ if(v.at) elbowAt++; else if(v.to) elbowTo++; else if(v.hold) elbowHold++; }
  if(!v.at) continue;
  const p=typeof v.palm==='string'?v.palm:(v.palm?'vec':'-');
  const hold=v.hold?(typeof v.hold==='string'?v.hold.split(/[@#]/)[1]:v.hold.group):'';
  const k=`${seated?'ngồi':'đứng'} pt=${v.point||'wrist'} palm=${p} ${hold?'hold:'+hold:''} ${v.pose?'pose='+v.pose:''}`;
  st[k]=(st[k]||0)+1; (sc[k] ||= new Set()).add(s.name+'/'+c.id);}}}
console.log({elbowAt,elbowTo,elbowHold});
for(const [k,v] of Object.entries(st).sort((a,b)=>b[1]-a[1]).slice(0,30)) console.log(v,k,[...sc[k]].length,[...sc[k]].slice(0,3).join(' '));
