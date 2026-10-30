import fs from 'fs'; import path from 'path';
const dir='/home/trungvq/Work/Dev/youtube-video/jp-sukatto/scenes';
const files=fs.readdirSync(dir).filter(f=>/^t0[12]-/.test(f));
const toHold={}, toHoldSc={}, itemsStat={}, itemsSc={}, handover=[], restMarks={}, segs={}, segSc={};
let itemScenes=0;
for(const f of files){
  const s=JSON.parse(fs.readFileSync(path.join(dir,f)));
  if(s.items?.length){ itemScenes++;
    const byItem={};
    for(const m of s.items){ const k=m.item; (byItem[k] ||= []).push(m); const tag=(m.rest?'rest':'')+(m.to?'to:'+m.to:m.at?'at':m.as?'as:'+m.as:''); itemsStat[m.item.replace(/:\d+$/,'')+' '+tag]=(itemsStat[m.item.replace(/:\d+$/,'')+' '+tag]||0)+1;}
    for(const [k,ms] of Object.entries(byItem)){ const casts=new Set(ms.map(m=>m.cast)); if(casts.size>1) handover.push(s.name+':'+k+':'+[...casts].join('>'));}
  }
  for(const c of s.cast||[]){
    const seated = !!c.world?.sit || (c.tracks||[]).some(t=>t.clips?.some(cl=>/sit|seiza/.test(cl.action||'')));
    const hs=(c.world?.hands||[]).slice().sort((a,b)=>(+a.t||0)-(+b.t||0));
    for(const side of ['left','right']){
      let cur=null, n=0;
      const flush=()=>{ if(cur){ const k=cur+(seated?' [ngồi]':' [đứng]'); segs[k]=(segs[k]||0)+1; (segSc[k] ||= []).push(s.name+'('+c.id+','+n+')'); } cur=null; n=0; };
      for(const h of hs){ const v=h[side]; if(v===undefined) continue; 
        if(v && v.hold!==undefined){ if(v.hold===null){ flush(); } else { const id=typeof v.hold==='string'?v.hold.replace('#','@'):(v.hold.item+'@'+(v.hold.group||v.hold.grip)+(v.hold.on?'/'+v.hold.on:'')); const idn=id.replace(/:\d+/,''); if(cur!==idn){ flush(); cur=idn; } } }
        if(cur) n++;
        if(v && v.to){ const k=v.to+(v.hold?'+hold':(cur?'+holding':'')); toHold[k]=(toHold[k]||0)+1; (toHoldSc[k] ||= new Set()).add(s.name);}
        if(v && v.rest) restMarks[s.name]=(restMarks[s.name]||0)+1;
      }
      flush();
    }
  }
}
const top=(o,k=60)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,k);
console.log('scenes with items',itemScenes);
console.log('ITEMS',top(itemsStat,50));
console.log('HANDOVER',handover.length,handover.join(' '));
console.log('TO x hold',top(toHold,40).map(([k,v])=>k+':'+v+'/'+toHoldSc[k].size+' e.g. '+[...toHoldSc[k]].slice(0,3).join(',')).join('\n'));
console.log('SEGS');
for(const [k,v] of top(segs,60)) console.log(v, k, segSc[k].sort((a,b)=>(+b.match(/,(\d+)\)/)[1])-(+a.match(/,(\d+)\)/)[1])).slice(0,3).join(' '));
