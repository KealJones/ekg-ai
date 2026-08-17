import type { ProgramBlueprint } from "../ir/blueprint.js";
import type { TaskSpec } from "../task.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import { MemoryProgramLibrary } from "../program-library.js";
import { synthesizeDetailed } from "../search/synthesizer.js";
import type { AbstractionCandidate } from "./abstraction-miner.js";
import {
  candidateToProgram,
  decideAbstractionPromotion,
  type AbstractionPromotionDecision,
} from "./abstraction-promotion.js";

export interface PromotionExperimentSide {
  solved: number;
  candidates: number;
  generatedExpressions: number;
  searchWork: number;
  perTask: Array<{
    taskId: string;
    solved: boolean;
    candidates: number;
    generatedExpressions: number;
    searchWork: number;
    depth: number;
    usedProgramCalls: string[];
  }>;
}

export interface PromotionExperimentResult {
  candidateProgram?: ProgramBlueprint;
  baseline: PromotionExperimentSide;
  promoted: PromotionExperimentSide;
  decision: AbstractionPromotionDecision;
}

function makeLibrary(programs: ProgramBlueprint[]): MemoryProgramLibrary {
  const lib=new MemoryProgramLibrary();
  for(const p of programs) lib.put(p);
  return lib;
}

export function measureProgramUtility(
  tasks: TaskSpec[],
  caps: CapabilityRegistry,
  basePrograms: ProgramBlueprint[],
  candidateProgram: ProgramBlueprint | undefined,
  maxDepth: number,
): PromotionExperimentSide {
  const callable=[...basePrograms,...(candidateProgram?[candidateProgram]:[])];
  const lib=makeLibrary(callable);
  const perTask=tasks.map(task=>{
    const result=synthesizeDetailed(task,caps,{
      maxDepth,
      programs:lib,
      callablePrograms:callable,
      // This experiment is specifically measuring a candidate that has already
      // been selected for evaluation/relevance, not blindly prioritizing a full library.
      programCallPriority:candidateProgram?"before-capabilities":"after-capabilities",
    });
    return {
      taskId:task.id,
      solved:!!result.program,
      candidates:result.candidatesExplored,
      generatedExpressions:result.generatedExpressions??result.candidatesExplored,
      searchWork:(result.generatedExpressions??0)+result.candidatesExplored,
      depth:result.maxDepthReached,
      usedProgramCalls:result.usedProgramCalls,
    };
  });
  return {
    solved:perTask.filter(x=>x.solved).length,
    candidates:perTask.reduce((n,x)=>n+x.candidates,0),
    generatedExpressions:perTask.reduce((n,x)=>n+x.generatedExpressions,0),
    searchWork:perTask.reduce((n,x)=>n+x.searchWork,0),
    perTask,
  };
}

/**
 * Runs the exact same held-out TaskSpecs with and without a candidate abstraction.
 * Discovery/source programs are deliberately NOT included unless explicitly supplied
 * in basePrograms; this prevents the candidate's own discovery corpus from leaking
 * into the held-out utility measurement.
 */
export function runAbstractionPromotionExperiment(args:{
  candidate: AbstractionCandidate;
  sourceProgram: ProgramBlueprint;
  candidateProgramId: string;
  heldoutTasks: TaskSpec[];
  caps: CapabilityRegistry;
  basePrograms?: ProgramBlueprint[];
  maxDepth?: number;
}): PromotionExperimentResult {
  const basePrograms=args.basePrograms??[];
  const maxDepth=args.maxDepth??3;
  const candidateProgram=candidateToProgram(args.candidate,args.sourceProgram,args.candidateProgramId);

  const baseline=measureProgramUtility(args.heldoutTasks,args.caps,basePrograms,undefined,maxDepth);
  const promoted=measureProgramUtility(args.heldoutTasks,args.caps,basePrograms,candidateProgram,maxDepth);

  const decision=decideAbstractionPromotion(args.candidate,{
    baselineCandidates:baseline.candidates,
    promotedCandidates:promoted.candidates,
    baselineSolved:baseline.solved,
    promotedSolved:promoted.solved,
    baselineWork:baseline.searchWork,
    promotedWork:promoted.searchWork,
  });

  return {candidateProgram,baseline,promoted,decision};
}
