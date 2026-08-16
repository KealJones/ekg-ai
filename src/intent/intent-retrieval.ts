import type { Intent } from "./intent.js";
import type { ProgramBlueprint } from "../ir/blueprint.js";
import { typeEquals } from "../ir/types.js";

export interface IntentProgramCandidate {
  program:ProgramBlueprint;
  score:number;
  reasons:string[];
}

function semanticProperties(p:ProgramBlueprint){return new Set(p.properties??[]);}

/**
 * Intent-native retrieval: no TaskSpec family/labels required.
 * Hard types gate eligibility; grounded constraints rank semantically adjacent programs.
 */
export function retrieveProgramsForIntent(intent:Intent,programs:ProgramBlueprint[],limit=4):IntentProgramCandidate[]{
  const inputSignals=intent.signals.filter(s=>s.binding==="input");
  const relation=intent.constraints[0]?.relation;
  return programs
    .filter(p=>
      p.inputs.length===inputSignals.length &&
      p.inputs.every((t,i)=>typeEquals(t,inputSignals[i]!.type)) &&
      typeEquals(p.output,intent.goal.type)
    )
    .map(program=>{
      let score=100; const reasons=["type-compatible"];
      const props=semanticProperties(program);
      if(relation==="Multiply"){
        if(props.has("semantic:multiply")){score+=50;reasons.push("semantic:multiply");}
        else if(props.has("semantic:scale")){score+=35;reasons.push("semantic:scale");}
      }
      if(relation==="Add" && props.has("semantic:add")){score+=50;reasons.push("semantic:add");}
      if(relation==="ArgMax" && props.has("semantic:argmax")){score+=50;reasons.push("semantic:argmax");}
      return {program,score,reasons};
    })
    .sort((a,b)=>b.score-a.score||a.program.id.localeCompare(b.program.id))
    .slice(0,limit);
}
