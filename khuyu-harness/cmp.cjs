const fs=require("fs");
const rd=f=>fs.readFileSync(f,"utf8").trim().split("\n").slice(1).map(l=>l.split("\t"));
const [a,b]=[rd(process.argv[2]),rd(process.argv[3])];
let maxd=0,at=0, n=0, revA=0, revB=0, absA=0, absB=0;
for(let i=0;i<Math.min(a.length,b.length);i++){ const d=Math.abs(+a[i][2]-+b[i][2]); const dd=Math.min(d,360-d); if(dd>maxd){maxd=dd;at=a[i][0];} if(dd>1)n++;
 if(i>0){ const [p,q]=[+a[i-1][1],+a[i][1]]; if(Math.abs(p)>0.05&&Math.abs(q)>0.05&&Math.sign(p)!==Math.sign(q)) revA++; absA+=Math.abs(q);
  const [p2,q2]=[+b[i-1][1],+b[i][1]]; if(Math.abs(p2)>0.05&&Math.abs(q2)>0.05&&Math.sign(p2)!==Math.sign(q2)) revB++; absB+=Math.abs(q2);} }
console.log(process.argv[2].replace(/^dump-/,""), "maxΔφ",maxd.toFixed(1),"at",at,"frames>1°",n, "rev locked/unlocked",revA,revB, "Σ|sw|",absA.toFixed(0),absB.toFixed(0));
