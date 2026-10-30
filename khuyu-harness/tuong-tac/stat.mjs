import fs from 'fs'; import path from 'path';
const dir='/home/trungvq/Work/Dev/youtube-video/jp-sukatto/scenes';
const files=fs.readdirSync(dir).filter(f=>/^t0[12]-/.test(f));
const keyCount={}, holdCount={}, actCount={}, toCount={}, sceneHands=[], lockScenes=[], pointCount={}, palmCount={}, holdScenes={}, actScenes={};
let totalHands=0;
for(const f of files){
  const s=JSON.parse(fs.readFileSync(path.join(dir,f)));
  for(const c of s.cast||[]){
    for(const tr of c.tracks||[]) for(const cl of tr.clips||[]){ if(!cl.action) continue; actCount[cl.action]=(actCount[cl.action]||0)+1; (actScenes[cl.action] ||= new Set()).add(s.name);}
    const hs=c.world?.hands||[]; let n=0, locks=0;
    for(const h of hs){ for(const side of ['left','right','near','far']){ const v=h[side]; if(v===undefined) continue; n++; if(!v) continue;
      for(const k of Object.keys(v)) keyCount[k]=(keyCount[k]||0)+1;
      if(v.elbowLock!==undefined) locks++;
      if(v.hold){ const id=typeof v.hold==='string'?v.hold:(v.hold.item+'#'+(v.hold.grip||v.hold.group||'?')); holdCount[id]=(holdCount[id]||0)+1; (holdScenes[id] ||= new Set()).add(s.name);}
      if(v.to){ const id=typeof v.to==='string'?v.to:JSON.stringify(v.to).slice(0,40); toCount[id]=(toCount[id]||0)+1;}
      if(v.point){ pointCount[v.point]=(pointCount[v.point]||0)+1;}
      if(v.palm){ const id=typeof v.palm==='string'?v.palm:JSON.stringify(v.palm).slice(0,40); palmCount[id]=(palmCount[id]||0)+1;}
    } 
      for(const k of Object.keys(h)) if(!['t','left','right','near','far'].includes(k)) keyCount['__'+k]=(keyCount['__'+k]||0)+1;
    }
    totalHands+=n;
    if(n) sceneHands.push([s.name,c.id,n,locks]);
    if(locks) lockScenes.push([s.name,c.id,locks]);
  }
}
const top=(o,k=60)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,k);
console.log('files',files.length,'hand keyframes',totalHands);
console.log('KEYS',top(keyCount));
console.log('HOLD',top(holdCount,80).map(([k,v])=>`${k}:${v} [${[...holdScenes[k]].length} sc]`).join('\n'));
console.log('TO',top(toCount,40));
console.log('POINT',top(pointCount,40));
console.log('PALM',top(palmCount,40));
console.log('SCENEHANDS top', sceneHands.sort((a,b)=>b[2]-a[2]).slice(0,30).map(x=>x.join(' ')).join('\n'));
console.log('scenes with hands',sceneHands.length, 'lock', lockScenes.length, lockScenes.map(x=>x.join(':')).join(', '));
console.log('ACTIONS', top(actCount,200).filter(([k])=>!/^thoai-|^lip-|^face-|^stand-3d|^t0[12]-face/.test(k)).map(([k,v])=>`${k}:${v}/${actScenes[k].size}`).join(' '));
