import fs from "node:fs";
import {sfHash} from "../dist/index.js";

const p=JSON.parse(fs.readFileSync("bench-v1/items/pilot-20.json","utf8"));
const toks=s=>s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(Boolean);
const ngrams=(s,n)=>{
  const ts=toks(s), out=new Set();
  for(let i=0;i+n<=ts.length;i++) out.add(ts.slice(i,i+n).join(" "));
  return out;
};

const cross=[];
for(const a of p.curriculum) for(const b of p.test){
  const A=ngrams(a.surface,4),B=ngrams(b.surface,4);
  const overlap=[...A].filter(x=>B.has(x));
  if(overlap.length) cross.push({train:a.id,test:b.id,overlap});
}

const trainHashes=new Set(p.curriculum.filter(x=>x.sf).map(x=>sfHash(x.sf)));
const exactSfOverlap=p.test.filter(x=>x.sf&&trainHashes.has(sfHash(x.sf))).map(x=>x.id);
const compIds=p.test.filter(x=>x.id.includes(".comp")).map(x=>x.id);
const compExactOverlap=compIds.filter(id=>exactSfOverlap.includes(id));

const nodeCount=x=>x.sf?.nodes?.length??0;
const pairs=[...p.curriculum,...p.test].filter(x=>x.sf).map(x=>[toks(x.surface).length,nodeCount(x)]);
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const xs=pairs.map(x=>x[0]),ys=pairs.map(x=>x[1]),mx=mean(xs),my=mean(ys);
const cov=mean(pairs.map(([x,y])=>(x-mx)*(y-my)));
const sx=Math.sqrt(mean(xs.map(x=>(x-mx)**2))),sy=Math.sqrt(mean(ys.map(y=>(y-my)**2)));
const r=sx&&sy?cov/(sx*sy):0;

const report={
  version:"pilot-audit-v0.1",
  warning:"Pilot is deliberately too small for publication-grade leakage gates.",
  counts:{train:p.curriculum.length,test:p.test.length},
  crossSplitFourGramPairs:cross.length,
  exactSfOverlapTestItems:exactSfOverlap,
  structuralCompositionExactSfOverlap:compExactOverlap,
  lengthDepthCorrelation:r,
  gates:{
    structuralCompSfDisjoint:compExactOverlap.length===0,
    lengthDepthAbsBelow03:Math.abs(r)<.3,
    fourGramStrictGate:cross.length===0
  }
};
fs.writeFileSync("bench-v1/results/pilot-audit-v0.1.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
