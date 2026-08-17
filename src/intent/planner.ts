import type { Intent } from "./intent.js";
import type { ProgramBlueprint, Expr } from "../ir/blueprint.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import { typeEquals } from "../ir/types.js";
import type { GraphStore } from "../graph/graph.js";
import { resolveCapabilityForRelation } from "./semantic-catalog.js";

export interface IntentPlanResult {
  status:"planned"|"unsupported";
  program?:ProgramBlueprint;
  reason?:string;
}

/** Typed symbolic planner for a sequential Intent constraint chain. */
export function planIntent(intent:Intent,caps:CapabilityRegistry,store?:GraphStore):IntentPlanResult{
  if(intent.constraints.length===0) return {status:"unsupported",reason:"intent has no constraints"};
  const relationToCapability:Record<string,string>={
    Multiply:"core.mul_int",
    Add:"core.add_int"
  };
  const byId=new Map(intent.signals.map(s=>[s.id,s]));
  const results:Expr[]=[];

  for(let ci=0;ci<intent.constraints.length;ci++){
    const c=intent.constraints[ci]!;
    const args:Expr[]=[];
    for(const argId of c.args){
      const resultMatch=/^result\.(\d+)$/.exec(argId);
      if(resultMatch){
        const expr=results[Number(resultMatch[1])];
        if(!expr) return {status:"unsupported",reason:`constraint references unavailable ${argId}`};
        args.push(structuredClone(expr));
        continue;
      }
      const s=byId.get(argId);
      if(!s) return {status:"unsupported",reason:`constraint references unknown signal ${argId}`};
      if(s.binding==="input"){
        if(s.inputIndex===undefined) return {status:"unsupported",reason:"input signal missing index"};
        args.push({kind:"input",index:s.inputIndex,type:s.type});
      }else if(s.value!==undefined){
        args.push({kind:"const",value:s.value,type:s.type});
      }else return {status:"unsupported",reason:`signal ${argId} has no binding or value`};
    }
    let cap=resolveCapabilityForRelation(store,c.relation,caps,args.map(a=>a.type),ci===intent.constraints.length-1?intent.goal.type:undefined);
    if(!cap){
      const capId=relationToCapability[c.relation];
      if(capId){ try{cap=caps.get(capId);}catch{} }
    }
    if(!cap) return {status:"unsupported",reason:`no typed capability grounding for relation ${c.relation}`};
    if(args.length!==cap.inputs.length || args.some((a,i)=>!typeEquals(a.type,cap.inputs[i]!)))
      return {status:"unsupported",reason:"grounded signal types do not satisfy capability contract"};
    results.push({kind:"call",capabilityId:cap.id,args,type:cap.output});
  }

  const body=results.at(-1)!;
  if(!typeEquals(body.type,intent.goal.type))
    return {status:"unsupported",reason:"final plan output does not satisfy intent goal"};

  return {
    status:"planned",
    program:{
      id:`planned.${intent.id}`,
      name:`Intent plan: ${intent.rawUtterance}`,
      inputs:intent.signals.filter(s=>s.binding==="input").sort((a,b)=>(a.inputIndex??0)-(b.inputIndex??0)).map(s=>s.type),
      output:intent.goal.type,
      body,
      properties:intent.constraints.map(c=>`semantic:${c.relation.toLowerCase()}`),
      provenance:[`intent:${intent.id}`,...intent.provenance]
    }
  };
}
