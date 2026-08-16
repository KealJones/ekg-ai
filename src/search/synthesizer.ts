import type { Expr, ProgramBlueprint } from "../ir/blueprint.js";
import type { ProgramLibrary } from "../program-library.js";
import { typeEquals } from "../ir/types.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import type { TaskSpec } from "../task.js";
import { evaluateTask } from "../task-evaluator.js";

function key(expr: Expr): string { return JSON.stringify(expr); }

export interface SynthesisOptions {
  maxDepth?: number;
  seedExprs?: Expr[];
  programs?: ProgramLibrary;
  /** Learned programs available as atomic callable units during composition. */
  callablePrograms?: ProgramBlueprint[];
  /**
   * Only use "before-capabilities" for a small relevance-filtered/retrieved set.
   * Trying an entire learned library first can make search strictly worse.
   */
  programCallPriority?: "before-capabilities" | "after-capabilities";
}

export interface SynthesisResult {
  program?: ProgramBlueprint;
  candidatesExplored: number;
  maxDepthReached: number;
  usedSeed: boolean;
  usedProgramCalls: string[];
}

export function collectSubexpressions(expr: Expr): Expr[] {
  const result: Expr[]=[expr];
  if (expr.kind==="call" || expr.kind==="program_call") for (const arg of expr.args) result.push(...collectSubexpressions(arg));
  return result;
}

function permutationsForTypes(pool: Expr[], inputs: ProgramBlueprint["inputs"]): Expr[][] {
  const out: Expr[][]=[];
  const walk=(index:number,args:Expr[])=>{
    if(index===inputs.length){out.push(args);return;}
    for(const e of pool) if(typeEquals(e.type,inputs[index]!)) walk(index+1,[...args,e]);
  };
  walk(0,[]);
  return out;
}

export function synthesizeDetailed(task: TaskSpec, caps: CapabilityRegistry, maxDepthOrOptions: number | SynthesisOptions = 3): SynthesisResult {
  const options:SynthesisOptions=typeof maxDepthOrOptions==="number"?{maxDepth:maxDepthOrOptions}:maxDepthOrOptions;
  const maxDepth=options.maxDepth??3;
  const byDepth:Expr[][]=[];
  const inputs:Expr[]=task.inputs.map((t,index)=>({kind:"input",index,type:t}));
  const seeds=(options.seedExprs??[]).map(e=>structuredClone(e));
  const seedKeys=new Set(seeds.map(key));
  const leaves:Expr[]=[...inputs,...seeds];
  byDepth[0]=leaves;
  const seen=new Set(leaves.map(key));
  let candidatesExplored=0;

  const passes=(expr:Expr):boolean=>{
    candidatesExplored++;
    const p:ProgramBlueprint={id:"candidate",inputs:task.inputs,output:task.output,body:expr};
    return evaluateTask(p,task,caps,options.programs).passed;
  };
  const finish=(e:Expr,depth:number):SynthesisResult=>({
    program:{id:`learned.${task.id}`,name:`Synthesized ${task.id}`,inputs:task.inputs,output:task.output,body:e,provenance:[`synthesis:${task.id}`]},
    candidatesExplored,maxDepthReached:depth,
    usedSeed:collectSubexpressions(e).some(s=>seedKeys.has(key(s))),
    usedProgramCalls:[...new Set(collectSubexpressions(e).filter((x):x is Extract<Expr,{kind:"program_call"}>=>x.kind==="program_call").map(x=>x.programId))],
  });

  for(const e of leaves) if(typeEquals(e.type,task.output)&&passes(e)) return finish(e,0);

  for(let depth=1;depth<=maxDepth;depth++){
    const current:Expr[]=[];
    const pool=byDepth.flat();
    const addProgramCalls=()=>{
      for(const program of options.callablePrograms??[]){
        for(const args of permutationsForTypes(pool,program.inputs)){
          const e:Expr={kind:"program_call",programId:program.id,args,type:program.output};
          const k=key(e); if(!seen.has(k)){seen.add(k);current.push(e);}
        }
      }
    };
    const addCapabilities=()=>{
      for(const cap of caps.all()){
        for(const args of permutationsForTypes(pool,cap.inputs)){
          const e:Expr={kind:"call",capabilityId:cap.id,args,type:cap.output};
          const k=key(e); if(!seen.has(k)){seen.add(k);current.push(e);}
        }
      }
    };
    // Default remains conservative until graph/context retrieval can provide a
    // small relevant learned set. A validated/retrieved abstraction may opt in
    // to learned-first priority.
    if(options.programCallPriority==="before-capabilities"){
      addProgramCalls(); addCapabilities();
    }else{
      addCapabilities(); addProgramCalls();
    }
    byDepth[depth]=current;
    for(const e of current) if(typeEquals(e.type,task.output)&&passes(e)) return finish(e,depth);
  }
  return {program:undefined,candidatesExplored,maxDepthReached:maxDepth,usedSeed:false,usedProgramCalls:[]};
}

export function synthesize(task: TaskSpec, caps: CapabilityRegistry, maxDepthOrOptions: number | SynthesisOptions = 3): ProgramBlueprint | undefined {
  return synthesizeDetailed(task,caps,maxDepthOrOptions).program;
}
