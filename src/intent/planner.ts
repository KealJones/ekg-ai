import type { Intent } from "./intent.js";
import type { ProgramBlueprint, Expr } from "../ir/blueprint.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import { typeEquals } from "../ir/types.js";
import type { GraphStore } from "../graph/graph.js";
import type { ProgramLibrary } from "../program-library.js";
import { resolveCapabilityForRelation } from "./semantic-catalog.js";

export interface IntentPlanResult {
  status:"planned"|"unsupported";
  program?:ProgramBlueprint;
  reason?:string;
}

function resolveLearnedProgramForRelation(
  store:GraphStore|undefined,
  relation:string,
  programs:ProgramLibrary|undefined,
  argTypes:ProgramBlueprint["inputs"],
  output:ProgramBlueprint["output"]|undefined,
):ProgramBlueprint|undefined {
  if(!store || !programs) return undefined;
  const rid=`relation:${relation.toLowerCase()}`;
  for(const relationConcept of store.outgoing(rid,"denotes_concept")){
    for(const implementation of store.outgoing(relationConcept.to,"implemented_by")){
      const entity=store.getEntity(implementation.to);
      const programId=typeof entity?.attrs?.programId==="string"
        ? String(entity.attrs.programId)
        : implementation.to.startsWith("capability:learned:")
          ? implementation.to.slice("capability:learned:".length)
          : undefined;
      if(!programId) continue;
      const program=programs.get(programId);
      if(!program) continue;
      if(program.inputs.length!==argTypes.length) continue;
      if(program.inputs.some((t,i)=>!typeEquals(t,argTypes[i]!))) continue;
      if(output && !typeEquals(program.output,output)) continue;
      return program;
    }
  }
  return undefined;
}

/** Typed symbolic planner for a sequential Intent constraint chain. */
export function planIntent(intent:Intent,caps:CapabilityRegistry,store?:GraphStore,programs?:ProgramLibrary):IntentPlanResult{
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
    const desiredOutput=ci===intent.constraints.length-1?intent.goal.type:undefined;
    let cap=resolveCapabilityForRelation(store,c.relation,caps,args.map(a=>a.type),desiredOutput);
    if(!cap){
      const capId=relationToCapability[c.relation];
      if(capId){ try{cap=caps.get(capId);}catch{} }
    }
    if(cap){
      if(args.length!==cap.inputs.length || args.some((a,i)=>!typeEquals(a.type,cap.inputs[i]!)))
        return {status:"unsupported",reason:"grounded signal types do not satisfy capability contract"};
      results.push({kind:"call",capabilityId:cap.id,args,type:cap.output});
      continue;
    }

    const learned=resolveLearnedProgramForRelation(store,c.relation,programs,args.map(a=>a.type),desiredOutput);
    if(learned){
      results.push({kind:"program_call",programId:learned.id,args,type:learned.output});
      continue;
    }
    return {status:"unsupported",reason:`no typed capability or learned-program grounding for relation ${c.relation}`};
  }

  const body=results.at(-1)!;
  if(!typeEquals(body.type,intent.goal.type))
    return {status:"unsupported",reason:"final plan output does not satisfy intent goal"};

  return {
    status:"planned",
    program:{
      id:`intent-plan:${intent.id}`,
      name:`Intent plan: ${intent.rawUtterance}`,
      inputs:intent.signals.filter(s=>s.binding==="input").sort((a,b)=>(a.inputIndex??0)-(b.inputIndex??0)).map(s=>s.type),
      output:intent.goal.type,
      body,
      provenance:["intent-planner:v0.2",...intent.provenance]
    }
  };
}
