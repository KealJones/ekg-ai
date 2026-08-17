import type { Expr, ProgramBlueprint, Value } from "../ir/blueprint.js";
import type { ProgramLibrary } from "../program-library.js";
import { typeEquals } from "../ir/types.js";
import type { Type } from "../ir/types.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import type { TaskSpec, AssertionExpr } from "../task.js";
import { evaluateTask } from "../task-evaluator.js";

function key(expr: Expr): string { return JSON.stringify(expr); }
function valueKey(value: unknown): string { return JSON.stringify(value); }
function typeKey(type: Type): string { return JSON.stringify(type); }
function deepEqual(a: unknown,b: unknown): boolean { return valueKey(a)===valueKey(b); }

export interface SearchBudget {
  /** Candidate programs of the requested output type that may be scored. */
  maxCandidates?: number;
  /** Total syntactic expressions generated, including partial/wrong-output expressions. */
  maxGeneratedExpressions?: number;
  /** Wall-clock budget. Checked cooperatively while generating/evaluating. */
  maxWallMs?: number;
}

export interface SynthesisOptions {
  maxDepth?: number;
  seedExprs?: Expr[];
  programs?: ProgramLibrary;
  /** Learned programs available as atomic callable units during composition. */
  callablePrograms?: ProgramBlueprint[];
  /** Historical reproduction switch. New work should use v2. */
  strategy?: "legacy" | "v2";
  /**
   * Only use "before-capabilities" for a small relevance-filtered/retrieved set.
   * Trying an entire learned library first can make search strictly worse.
   */
  programCallPriority?: "before-capabilities" | "after-capabilities";
  /** Explicit operation cost multipliers. Lower = try earlier. */
  operationWeights?: Record<string,number>;
  /** Real operational budget. Depth is structural complexity, not a resource budget. */
  budget?: SearchBudget;
}

export interface SynthesisResult {
  program?: ProgramBlueprint;
  candidatesExplored: number;
  maxDepthReached: number;
  usedSeed: boolean;
  usedProgramCalls: string[];
  strategy?: "legacy" | "v2";
  generatedExpressions?: number;
  behavioralPrunes?: number;
  syntaxPrunes?: number;
  memoHits?: number;
  memoMisses?: number;
  elapsedMs?: number;
  stoppedByBudget?: boolean;
  stopReason?: "max-candidates"|"max-generated-expressions"|"max-wall-ms";
}

export function collectSubexpressions(expr: Expr): Expr[] {
  const result: Expr[]=[expr];
  if (expr.kind==="call" || expr.kind==="program_call") for (const arg of expr.args) result.push(...collectSubexpressions(arg));
  return result;
}

function* permutationsForTypes(pool: Expr[], inputs: ProgramBlueprint["inputs"], index=0, args:Expr[]=[]):Generator<Expr[]> {
  if(index===inputs.length){ yield args; return; }
  for(const e of pool) if(typeEquals(e.type,inputs[index]!)) yield* permutationsForTypes(pool,inputs,index+1,[...args,e]);
}

function finishResult(e:Expr,task:TaskSpec,depth:number,candidatesExplored:number,seedKeys:Set<string>,extra:Partial<SynthesisResult>={}):SynthesisResult {
  return {
    program:{id:`learned.${task.id}`,name:`Synthesized ${task.id}`,inputs:task.inputs,output:task.output,body:e,provenance:[`synthesis:${task.id}`]},
    candidatesExplored,maxDepthReached:depth,
    usedSeed:collectSubexpressions(e).some(s=>seedKeys.has(key(s))),
    usedProgramCalls:[...new Set(collectSubexpressions(e).filter((x):x is Extract<Expr,{kind:"program_call"}>=>x.kind==="program_call").map(x=>x.programId))],
    ...extra,
  };
}

function synthesizeLegacy(task: TaskSpec, caps: CapabilityRegistry, options:SynthesisOptions): SynthesisResult {
  const maxDepth=options.maxDepth??3;
  const byDepth:Expr[][]=[];
  const inputs:Expr[]=task.inputs.map((t,index)=>({kind:"input",index,type:t}));
  const seeds=(options.seedExprs??[]).map(e=>structuredClone(e));
  const seedKeys=new Set(seeds.map(key));
  const leaves:Expr[]=[...inputs,...seeds];
  byDepth[0]=leaves;
  const seen=new Set(leaves.map(key));
  let candidatesExplored=0;
  let generatedExpressions=leaves.length;
  const started=Date.now();

  const passes=(expr:Expr):boolean=>{
    candidatesExplored++;
    const p:ProgramBlueprint={id:"candidate",inputs:task.inputs,output:task.output,body:expr};
    return evaluateTask(p,task,caps,options.programs).passed;
  };
  const done=(e:Expr,depth:number)=>finishResult(e,task,depth,candidatesExplored,seedKeys,{strategy:"legacy",generatedExpressions,elapsedMs:Date.now()-started});
  for(const e of leaves) if(typeEquals(e.type,task.output)&&passes(e)) return done(e,0);

  for(let depth=1;depth<=maxDepth;depth++){
    const current:Expr[]=[];
    const pool=byDepth.flat();
    const addProgramCalls=()=>{
      for(const program of options.callablePrograms??[]){
        for(const args of permutationsForTypes(pool,program.inputs)){
          const e:Expr={kind:"program_call",programId:program.id,args,type:program.output};
          const k=key(e); if(!seen.has(k)){seen.add(k);current.push(e);generatedExpressions++;}
        }
      }
    };
    const addCapabilities=()=>{
      for(const cap of caps.all()){
        for(const args of permutationsForTypes(pool,cap.inputs)){
          const e:Expr={kind:"call",capabilityId:cap.id,args,type:cap.output};
          const k=key(e); if(!seen.has(k)){seen.add(k);current.push(e);generatedExpressions++;}
        }
      }
    };
    if(options.programCallPriority==="before-capabilities"){ addProgramCalls(); addCapabilities(); }
    else { addCapabilities(); addProgramCalls(); }
    byDepth[depth]=current;
    for(const e of current) if(typeEquals(e.type,task.output)&&passes(e)) return done(e,depth);
  }
  return {program:undefined,candidatesExplored,maxDepthReached:maxDepth,usedSeed:false,usedProgramCalls:[],strategy:"legacy",generatedExpressions,elapsedMs:Date.now()-started};
}

function observationInputs(task:TaskSpec):Value[][] {
  const rows:Value[][]=[]; const seen=new Set<string>();
  const add=(xs:Value[])=>{const k=valueKey(xs);if(!seen.has(k)){seen.add(k);rows.push(structuredClone(xs));}};
  for(const ex of task.examples) add(ex.inputs);
  for(const property of task.properties??[]) for(const xs of property.cases) add(xs);
  return rows;
}

function evalAssertion(expr:AssertionExpr,inputs:Value[],output:Value,caps:CapabilityRegistry):Value {
  switch(expr.kind){
    case "output": return output;
    case "input": return inputs[expr.index]!;
    case "const": return expr.value;
    case "call": return caps.get(expr.capabilityId).reference(...expr.args.map(a=>evalAssertion(a,inputs,output,caps)));
  }
}

function historicalWeight(id:string,programs?:ProgramLibrary):number {
  const xs=programs?.experiencesFor?.(id)??[];
  if(xs.length===0) return 1;
  const successes=xs.filter(x=>x.status==="success").length;
  const failures=xs.length-successes;
  // Gentle prior only. History guides search; it does not ban unfamiliar operations.
  return Math.max(0.55,Math.min(1.75,(failures+2)/(successes+2)));
}

function programIsPure(program:ProgramBlueprint,caps:CapabilityRegistry,programs:ProgramLibrary|undefined,visiting=new Set<string>()):boolean {
  if(visiting.has(program.id)) return false;
  visiting.add(program.id);
  const walk=(expr:Expr):boolean=>{
    if(expr.kind==="input"||expr.kind==="const") return true;
    if(expr.kind==="call"){
      let cap; try{cap=caps.get(expr.capabilityId);}catch{return false;}
      return (cap.searchSafe ?? (cap.pure && cap.deterministic)) && expr.args.every(walk);
    }
    const target=programs?.get(expr.programId); if(!target) return false;
    return expr.args.every(walk) && programIsPure(target,caps,programs,new Set(visiting));
  };
  return walk(program.body);
}

interface RankedExpr { expr:Expr; cost:number; signature:string; }

function synthesizeV2(task:TaskSpec,caps:CapabilityRegistry,options:SynthesisOptions):SynthesisResult {
  const maxDepth=options.maxDepth??3;
  const budget={maxCandidates:options.budget?.maxCandidates??50_000,maxGeneratedExpressions:options.budget?.maxGeneratedExpressions??150_000,maxWallMs:options.budget?.maxWallMs??5_000};
  const started=Date.now();
  const observations=observationInputs(task);
  const inputs:Expr[]=task.inputs.map((t,index)=>({kind:"input",index,type:t}));
  const seeds=(options.seedExprs??[]).map(e=>structuredClone(e));
  const seedKeys=new Set(seeds.map(key));
  const syntaxSeen=new Set<string>();
  const behaviorSeen=new Map<string,RankedExpr>();
  const memo=new Map<string,Value[]>();
  let candidatesExplored=0,generatedExpressions=0,behavioralPrunes=0,syntaxPrunes=0,memoHits=0,memoMisses=0;
  let maxDepthReached=0;
  let stopReason:SynthesisResult["stopReason"];

  const elapsed=()=>Date.now()-started;
  const budgetExceeded=()=>{
    if(candidatesExplored>=budget.maxCandidates){stopReason="max-candidates";return true;}
    if(generatedExpressions>=budget.maxGeneratedExpressions){stopReason="max-generated-expressions";return true;}
    if(elapsed()>=budget.maxWallMs){stopReason="max-wall-ms";return true;}
    return false;
  };

  const evalOne=(expr:Expr,row:Value[],callStack:string[]=[]):Value=>{
    const ek=key(expr); const mk=`${ek}|${valueKey(row)}`;
    const existing=memo.get(mk); if(existing){memoHits++;return structuredClone(existing[0]!);}
    memoMisses++;
    let out:Value;
    switch(expr.kind){
      case "input": out=row[expr.index]!; break;
      case "const": out=expr.value; break;
      case "call": {
        const cap=caps.get(expr.capabilityId);
        out=cap.reference(...expr.args.map(a=>evalOne(a,row,callStack)));
        break;
      }
      case "program_call": {
        const target=options.programs?.get(expr.programId) ?? options.callablePrograms?.find(p=>p.id===expr.programId);
        if(!target) throw new Error(`Unknown learned program during synthesis: ${expr.programId}`);
        if(callStack.includes(target.id)) throw new Error(`Recursive program cycle during synthesis: ${[...callStack,target.id].join(" -> ")}`);
        const args=expr.args.map(a=>evalOne(a,row,callStack));
        out=evalOne(target.body,args,[...callStack,target.id]);
        break;
      }
    }
    memo.set(mk,[structuredClone(out)]); return structuredClone(out);
  };

  const outputsFor=(expr:Expr):Value[]|undefined=>{
    const ek=key(expr); const whole=memo.get(`whole:${ek}`); if(whole){memoHits++;return structuredClone(whole);}
    try{
      const outs=observations.map(row=>evalOne(expr,row));
      memo.set(`whole:${ek}`,structuredClone(outs)); return outs;
    }catch{return undefined;}
  };

  const behaviorSignature=(expr:Expr,outs:Value[])=>`${typeKey(expr.type)}|${outs.map(valueKey).join("|")}`;
  const exprCost=(kind:"cap"|"program",id:string,args:RankedExpr[])=>{
    const explicit=options.operationWeights?.[id]??1;
    const base=kind==="program"?0.8:1;
    return base*explicit*historicalWeight(id,options.programs)+args.reduce((s,x)=>s+x.cost,0);
  };

  const taskPasses=(expr:Expr,outs:Value[]):boolean=>{
    if(!typeEquals(expr.type,task.output)) return false;
    candidatesExplored++;
    const byInput=new Map(observations.map((row,i)=>[valueKey(row),outs[i]!]));
    for(const ex of task.examples) if(!deepEqual(byInput.get(valueKey(ex.inputs)),ex.output)) return false;
    for(const property of task.properties??[]) for(const row of property.cases){
      const output=byInput.get(valueKey(row)); if(output===undefined) return false;
      if(evalAssertion(property.assertion,row,output,caps)!==true) return false;
    }
    return true;
  };

  const makeFinish=(ranked:RankedExpr,depth:number)=>finishResult(ranked.expr,task,depth,candidatesExplored,seedKeys,{strategy:"v2",generatedExpressions,behavioralPrunes,syntaxPrunes,memoHits,memoMisses,elapsedMs:elapsed(),stoppedByBudget:false});
  const byDepth:RankedExpr[][]=[];

  const admit=(expr:Expr,cost:number):RankedExpr|undefined=>{
    if(budgetExceeded()) return undefined;
    generatedExpressions++;
    const sk=key(expr); if(syntaxSeen.has(sk)){syntaxPrunes++;return undefined;} syntaxSeen.add(sk);
    const outs=outputsFor(expr); if(!outs) return undefined; // values that error on known cases cannot solve this task.
    const signature=behaviorSignature(expr,outs);
    const previous=behaviorSeen.get(signature);
    if(previous){
      behavioralPrunes++;
      // Keep the cheaper representative for future composition.
      if(cost>=previous.cost) return undefined;
    }
    const ranked={expr,cost,signature}; behaviorSeen.set(signature,ranked); return ranked;
  };

  const leaves:RankedExpr[]=[];
  for(const e of [...inputs,...seeds]){const r=admit(e,0);if(r)leaves.push(r);}
  leaves.sort((a,b)=>a.cost-b.cost);
  byDepth[0]=leaves;
  for(const r of leaves){const outs=outputsFor(r.expr)!;if(taskPasses(r.expr,outs))return makeFinish(r,0);if(budgetExceeded())break;}
  if(budgetExceeded()) return {program:undefined,candidatesExplored,maxDepthReached:0,usedSeed:false,usedProgramCalls:[],strategy:"v2",generatedExpressions,behavioralPrunes,syntaxPrunes,memoHits,memoMisses,elapsedMs:elapsed(),stoppedByBudget:true,stopReason};

  const pureCaps=caps.all().filter(c=>c.searchSafe ?? (c.pure&&c.deterministic));
  const purePrograms=(options.callablePrograms??[]).filter(p=>programIsPure(p,caps,options.programs));

  for(let depth=1;depth<=maxDepth;depth++){
    maxDepthReached=depth;
    const pool=byDepth.flat();
    const poolExpr=pool.map(x=>x.expr);
    const bySyntax=new Map(pool.map(x=>[key(x.expr),x]));
    const current:RankedExpr[]=[];
    const addPrograms=()=>{
      for(const program of purePrograms){
        for(const args of permutationsForTypes(poolExpr,program.inputs)){
          if(budgetExceeded())return;
          const rankedArgs=args.map(a=>bySyntax.get(key(a))!).filter(Boolean);
          const e:Expr={kind:"program_call",programId:program.id,args,type:program.output};
          const r=admit(e,exprCost("program",program.id,rankedArgs)); if(r)current.push(r);
        }
      }
    };
    const addCaps=()=>{
      for(const cap of pureCaps){
        for(const args of permutationsForTypes(poolExpr,cap.inputs)){
          if(budgetExceeded())return;
          const rankedArgs=args.map(a=>bySyntax.get(key(a))!).filter(Boolean);
          const e:Expr={kind:"call",capabilityId:cap.id,args,type:cap.output};
          const r=admit(e,exprCost("cap",cap.id,rankedArgs)); if(r)current.push(r);
        }
      }
    };
    if(options.programCallPriority==="before-capabilities"){addPrograms();addCaps();}else{addCaps();addPrograms();}
    current.sort((a,b)=>a.cost-b.cost || key(a.expr).localeCompare(key(b.expr)));
    byDepth[depth]=current;
    for(const r of current){
      if(budgetExceeded())break;
      const outs=outputsFor(r.expr)!;
      if(taskPasses(r.expr,outs)) return makeFinish(r,depth);
    }
    if(budgetExceeded())break;
  }
  return {program:undefined,candidatesExplored,maxDepthReached,usedSeed:false,usedProgramCalls:[],strategy:"v2",generatedExpressions,behavioralPrunes,syntaxPrunes,memoHits,memoMisses,elapsedMs:elapsed(),stoppedByBudget:!!stopReason,stopReason};
}

export function synthesizeDetailed(task: TaskSpec, caps: CapabilityRegistry, maxDepthOrOptions: number | SynthesisOptions = 3): SynthesisResult {
  const options:SynthesisOptions=typeof maxDepthOrOptions==="number"?{maxDepth:maxDepthOrOptions}:maxDepthOrOptions;
  return (options.strategy??"v2")==="legacy" ? synthesizeLegacy(task,caps,options) : synthesizeV2(task,caps,options);
}

export function synthesize(task: TaskSpec, caps: CapabilityRegistry, maxDepthOrOptions: number | SynthesisOptions = 3): ProgramBlueprint | undefined {
  return synthesizeDetailed(task,caps,maxDepthOrOptions).program;
}
