import type { ProgramBlueprint } from "../ir/blueprint.js";
import type { TaskSpec } from "../task.js";
import type { ProgramUsageStats } from "../telemetry/program-usage.js";
import { typeEquals } from "../ir/types.js";

export interface RetrievalCandidate {
  program: ProgramBlueprint;
  score: number;
  reasons: string[];
}

export interface RetrievalOptions {
  limit?: number;
  usage?: ProgramUsageStats[];
}

/**
 * Non-neural v0 retrieval. Hard type compatibility is mandatory; labels/family
 * and local structural-usage telemetry only rank the compatible set.
 */
export function retrievePrograms(
  task: TaskSpec,
  programs: ProgramBlueprint[],
  options: RetrievalOptions = {},
): RetrievalCandidate[] {
  const limit=options.limit??4;
  const usage=new Map((options.usage??[]).map(x=>[x.programId,x]));
  const taskLabels=new Set(task.labels??[]);
  return programs
    .filter(p=>
      p.inputs.length===task.inputs.length &&
      p.inputs.every((t,i)=>typeEquals(t,task.inputs[i]!)) &&
      typeEquals(p.output,task.output)
    )
    .map(program=>{
      let score=100; // type contract is a hard gate, then rank context.
      const reasons=["type-compatible"];
      const labels=new Set(program.properties??[]);
      const overlap=[...taskLabels].filter(x=>labels.has(x));
      if(overlap.length){ score+=overlap.length*20; reasons.push(`labels:${overlap.join(",")}`); }
      if(task.family && program.provenance?.includes(`family:${task.family}`)){
        score+=30; reasons.push(`family:${task.family}`);
      }
      const stat=usage.get(program.id);
      if(stat){
        const structural=Math.min(20,stat.calledByBlueprints*4);
        const direct=Math.min(10,stat.selectedUses);
        const success=Math.min(10,stat.successes);
        score+=structural+direct+success;
        if(structural) reasons.push(`structural-centrality:${stat.calledByBlueprints}`);
        if(direct) reasons.push(`selected-uses:${stat.selectedUses}`);
      }
      return {program,score,reasons};
    })
    .sort((a,b)=>b.score-a.score || a.program.id.localeCompare(b.program.id))
    .slice(0,limit);
}
