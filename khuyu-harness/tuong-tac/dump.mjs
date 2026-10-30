import fs from 'fs';
const [,,name,id,max]=process.argv; const s=JSON.parse(fs.readFileSync(`/home/trungvq/Work/Dev/youtube-video/jp-sukatto/scenes/${name}.json`));
const c=s.cast.find(c=>c.id===id); console.log('tracks:',c.tracks.map(t=>t.name+'['+t.clips.map(k=>k.action).join(',')+']').join(' '));
let n=0; for(const h of c.world.hands){ for(const side of ['left','right']){ const v=h[side]; if(v===undefined) continue; if(n++>(+max||40)) break;
 const d=v===null?'null':Object.entries(v).map(([k,x])=>k+'='+(typeof x==='object'?JSON.stringify(x):x)).join(' ');
 console.log(String(h.t).padEnd(8),side.padEnd(5),d.slice(0,200)); } }
console.log('items:', (s.items||[]).filter(m=>m.cast===id).length);
