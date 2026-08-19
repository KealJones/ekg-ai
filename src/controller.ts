import type { TaskSpec } from "./task.js";
import type { ProgramBlueprint } from "./ir/blueprint.js";
import type { CapabilityRegistry } from "./runtime/capabilities.js";
import type { ProgramLibrary } from "./program-library.js";
import type { EpisodeStore, DecisionKind } from "./episode.js";
import { collectSubexpressions, synthesizeDetailed } from "./search/synthesizer.js";
import { evaluateTask } from "./task-evaluator.js";

export interface SolveResult {
  decision: DecisionKind;
  program?: ProgramBlueprint;
  success: boolean;
  retrievedProgramIds: string[];
  searchCandidatesExplored: number;
  searchDepthReached: number;
}

export class LearnerController {
  private episodeCounter: number;
  constructor(private readonly caps: CapabilityRegistry, private readonly programs: ProgramLibrary, private readonly episodes: EpisodeStore) {
    this.episodeCounter=this.episodes.all().reduce((max,e)=>{
      const m=/^episode\.(\d+)$/.exec(e.id);
      return m ? Math.max(max,Number(m[1])) : max;
    },0);
  }

  solve(task: TaskSpec, maxDepth = 3): SolveResult {
    const compatible=this.programs.compatible(task.inputs,task.output);
    const retrievedProgramIds=compatible.map(p=>p.id);

    for(const program of compatible){
      if(evaluateTask(program,task,this.caps,this.programs).passed){
        this.record(task.id,"RUN",retrievedProgramIds,true,program.id,false,[],0,0);
        return {decision:"RUN",program,success:true,retrievedProgramIds,searchCandidatesExplored:0,searchDepthReached:0};
      }
    }

    const callable=this.programs.all();
    if(compatible.length>0){
      const seedExprs=compatible.flatMap(p=>collectSubexpressions(p.body));
      const adapted=synthesizeDetailed(task,this.caps,{maxDepth,seedExprs,programs:this.programs,callablePrograms:callable});
      if(adapted.program){
        adapted.program.id=`learned.${task.id}`;
        adapted.program.provenance=[...(adapted.program.provenance??[]),...compatible.map(p=>`adapted-from:${p.id}`),...adapted.usedProgramCalls.map(id=>`calls:${id}`)];
        this.programs.put(adapted.program);
        this.record(task.id,"ADAPT",retrievedProgramIds,true,adapted.program.id,true,compatible.map(p=>p.id),adapted.candidatesExplored,adapted.maxDepthReached);
        return {decision:"ADAPT",program:adapted.program,success:true,retrievedProgramIds,searchCandidatesExplored:adapted.candidatesExplored,searchDepthReached:adapted.maxDepthReached};
      }
    }

    const built=synthesizeDetailed(task,this.caps,{maxDepth,programs:this.programs,callablePrograms:callable});
    if(built.program){
      built.program.provenance=[...(built.program.provenance??[]),...built.usedProgramCalls.map(id=>`calls:${id}`)];
      this.programs.put(built.program);
      this.record(task.id,"BUILD",retrievedProgramIds,true,built.program.id,true,built.usedProgramCalls,built.candidatesExplored,built.maxDepthReached);
      return {decision:"BUILD",program:built.program,success:true,retrievedProgramIds,searchCandidatesExplored:built.candidatesExplored,searchDepthReached:built.maxDepthReached};
    }

    this.record(task.id,"TEACH",retrievedProgramIds,false,undefined,false,[],built.candidatesExplored,built.maxDepthReached);
    return {decision:"TEACH",success:false,retrievedProgramIds,searchCandidatesExplored:built.candidatesExplored,searchDepthReached:built.maxDepthReached};
  }

  private record(taskId:string,decision:DecisionKind,retrievedProgramIds:string[],success:boolean,selectedProgramId?:string,synthesized?:boolean,reusedSeedProgramIds?:string[],searchCandidatesExplored?:number,searchDepthReached?:number):void {
    this.episodes.append({id:`episode.${++this.episodeCounter}`,taskId,decision,retrievedProgramIds,selectedProgramId,success,synthesized,reusedSeedProgramIds,searchCandidatesExplored,searchDepthReached,timestamp:new Date().toISOString()});
  }
}
