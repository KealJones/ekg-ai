import type { Expr, ProgramBlueprint } from "../ir/blueprint.js";
import { canonicalBlueprintSemantics } from "../ir/blueprint.js";
import { T } from "../ir/types.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import type { ProgramLibrary } from "../program-library.js";
import type { EpisodeStore } from "../episode.js";
import { LearnerController } from "../controller.js";
import { synthesizeDetailed } from "../search/synthesizer.js";
import { measureDurablePrograms, teacherOffGuard } from "./primitive-holdout.js";

export function expressionDepth(expr: Expr): number {
  if (expr.kind === "call" || expr.kind === "program_call") {
    return 1 + Math.max(0, ...expr.args.map(expressionDepth));
  }
  return 0;
}

export interface ProgramCallEdge { parentProgramId:string; childProgramId:string; }
function calledPrograms(expr:Expr):string[]{
  if(expr.kind === "program_call") return [expr.programId,...expr.args.flatMap(calledPrograms)];
  if(expr.kind === "call") return expr.args.flatMap(calledPrograms);
  return [];
}

export function programCallGraph(library:ProgramLibrary):ProgramCallEdge[]{
  const out:ProgramCallEdge[]=[];
  for(const p of library.all()) for(const child of new Set(calledPrograms(p.body))) out.push({parentProgramId:p.id,childProgramId:child});
  return out.sort((a,b)=>`${a.parentProgramId}:${a.childProgramId}`.localeCompare(`${b.parentProgramId}:${b.childProgramId}`));
}

export interface Phase0LibrarySnapshot {
  programIds:string[];
  canonicalPrograms:string[];
  durableReturn: ReturnType<typeof measureDurablePrograms>;
  callGraph:ProgramCallEdge[];
  provenance:Record<string,string[]>;
}
export function snapshotLibrary(library:ProgramLibrary):Phase0LibrarySnapshot{
  const programs=library.all().sort((a,b)=>a.id.localeCompare(b.id));
  return {
    programIds:programs.map(p=>p.id),
    canonicalPrograms:programs.map(canonicalBlueprintSemantics),
    durableReturn:measureDurablePrograms(library),
    callGraph:programCallGraph(library),
    provenance:Object.fromEntries(programs.map(p=>[p.id,[...(p.provenance??[])]])),
  };
}

export interface CalibrationRow {
  target:string;
  expectedMinDepth:number;
  searchLimit:number;
  solvedRuns:number;
  runs:number;
  foundDepths:number[];
  candidates:number[];
  wallMs:number[];
}
export interface Phase0Calibration {
  normalMaxDepth:number;
  measuredDMax:number;
  depth4GuardSolved:boolean;
  rows:CalibrationRow[];
  automaticIntegerConstants:boolean;
  constantProbeCandidates:number;
}

function scalarTask(id:string,multiplier:number){
  const xs=[-5,-2,-1,0,1,2,3,7];
  return {id,inputs:[T.int],output:T.int,examples:xs.map(x=>({inputs:[x],output:multiplier*x}))};
}

/**
 * Empirically characterize the exact current synthesizer.  The 2x/4x/8x/16x
 * ladder is intentionally constant-free so it measures the engine as shipped,
 * not Claude's stronger constant-pool reachability model.
 */
export function calibrateDMax(caps:CapabilityRegistry, normalMaxDepth=3, runs=5):Phase0Calibration{
  const specs=[
    {target:"2x",multiplier:2,min:1},
    {target:"4x",multiplier:4,min:2},
    {target:"8x",multiplier:8,min:3},
    {target:"16x",multiplier:16,min:4},
  ];
  const rows:CalibrationRow[]=[];
  for(const spec of specs){
    const foundDepths:number[]=[]; const candidates:number[]=[]; const wallMs:number[]=[]; let solved=0;
    for(let i=0;i<runs;i++){
      const start=performance.now();
      const result=synthesizeDetailed(scalarTask(`phase0.${spec.target}.${i}`,spec.multiplier),caps,{maxDepth:normalMaxDepth,callablePrograms:[],strategy:"legacy"});
      wallMs.push(performance.now()-start); candidates.push(result.candidatesExplored);
      if(result.program){ solved++; foundDepths.push(expressionDepth(result.program.body)); }
    }
    rows.push({target:spec.target,expectedMinDepth:spec.min,searchLimit:normalMaxDepth,solvedRuns:solved,runs,foundDepths,candidates,wallMs});
  }
  const measuredDMax=Math.max(0,...rows.filter(r=>r.solvedRuns===runs).flatMap(r=>r.foundDepths));

  // Claude's reference reachability model assumes a fixed integer constant pool.
  // The actual v0.3.7 BUILD enumerator does not add constants to its leaf pool.
  const constantProbe={id:"phase0.constant.x-plus-one",inputs:[T.int],output:T.int,examples:[-5,-1,0,2,9].map(x=>({inputs:[x],output:x+1}))};
  const cp=synthesizeDetailed(constantProbe,caps,{maxDepth:normalMaxDepth,callablePrograms:[],strategy:"legacy"});
  return {
    normalMaxDepth, measuredDMax,
    depth4GuardSolved:(rows.find(r=>r.target==="16x")?.solvedRuns??0)>0,
    rows,
    automaticIntegerConstants:!!cp.program,
    constantProbeCandidates:cp.candidatesExplored,
  };
}

export interface InstrumentedSolve {
  taskId:string;
  decision:string;
  success:boolean;
  searchCandidatesExplored:number;
  searchDepthReached:number;
  wallMs:number;
  teacherCalls:number;
  libraryBefore:Phase0LibrarySnapshot;
  libraryAfter:Phase0LibrarySnapshot;
  addedProgramIds:string[];
  selectedProgramId?:string;
}

/** Phase-0 instrumentation wrapper; scored runners can reuse this unchanged. */
export function solveInstrumented(args:{controller:LearnerController;library:ProgramLibrary;episodes:EpisodeStore;task:any;maxDepth?:number}):InstrumentedSolve{
  const guard=teacherOffGuard();
  const before=snapshotLibrary(args.library);
  const start=performance.now();
  const result=args.controller.solve(args.task,args.maxDepth??3);
  const wallMs=performance.now()-start;
  guard.assertOff();
  const after=snapshotLibrary(args.library);
  const beforeIds=new Set(before.programIds);
  const episode=args.episodes.byTask(args.task.id).at(-1);
  return {
    taskId:args.task.id,decision:result.decision,success:result.success,
    searchCandidatesExplored:result.searchCandidatesExplored,
    searchDepthReached:result.searchDepthReached,wallMs,teacherCalls:guard.teacherCalls,
    libraryBefore:before,libraryAfter:after,
    addedProgramIds:after.programIds.filter(id=>!beforeIds.has(id)),
    selectedProgramId:episode?.selectedProgramId,
  };
}
