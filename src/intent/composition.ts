import type { GraphStore } from "../graph/graph.js";
import type { IntentInterpretation, Intent } from "./intent.js";
import { interpretIntent } from "./interpreter.js";

export function interpretComposedIntent(rawUtterance:string,store?:GraphStore):IntentInterpretation{
  const parts=rawUtterance.split(/\bthen\b/i).map(x=>x.trim()).filter(Boolean);
  if(parts.length<=1) return interpretIntent(rawUtterance,store);

  const resolved:Intent[]=[];
  for(const part of parts){
    const r=interpretIntent(part,store);
    if(r.status!=="resolved") return r;
    resolved.push(r.intent);
  }
  const base=structuredClone(resolved[0]!) as Intent;
  base.id=`intent:composed:${rawUtterance.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,40)}`;
  base.rawUtterance=rawUtterance;
  base.provenance=["intent-composition:v0.1",...resolved.flatMap(x=>x.provenance)];
  base.confidence=Math.min(...resolved.map(x=>x.confidence));
  for(let i=1;i<resolved.length;i++){
    const next=resolved[i]!;
    // bring constants across; the second operation consumes prior result.
    const idMap=new Map<string,string>();
    for(const s of next.signals.filter(s=>s.value!==undefined)){
      const id=`signal.composed.${i}.${s.id}`;
      idMap.set(s.id,id);
      base.signals.push({...structuredClone(s),id});
    }
    for(const c of next.constraints){
      const args=c.args.map((id,index)=>{
        if(index===0) return `result.${base.constraints.length-1}`;
        return idMap.get(id)??id;
      });
      base.constraints.push({...structuredClone(c),args,provenance:[...c.provenance,"composition:then"]});
    }
  }
  return {status:"resolved",intent:base,alternatives:[]};
}
