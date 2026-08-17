import type { GraphStore } from "../graph/graph.js";
import type { ProgramBlueprint, Expr, Value } from "../ir/blueprint.js";
import { CapabilityRegistry } from "./capabilities.js";
import type { ProgramLibrary } from "../program-library.js";
import { validateProgram } from "../ir/validate.js";
import { runProgram } from "./interpreter.js";
import type { ExecutionExperience } from "./execution-experience.js";
import { synthesizeDetailed } from "../search/synthesizer.js";
import type { TaskSpec } from "../task.js";

export interface RepairEvent {
  id:string;
  programId:string;
  status:"restored"|"failed";
  source:"graph-snapshot"|"lived-experience";
  reason?:string;
  timestamp:string;
}

export interface HealthIssue {
  kind:"missing-program"|"invalid-program"|"missing-capability"|"cycle";
  id:string;
  path:string[];
  repaired:boolean;
  detail?:string;
}

export interface HealthReport {
  healthy:boolean;
  repairedProgramIds:string[];
  issues:HealthIssue[];
}

export interface MutableProgramLibrary extends ProgramLibrary {
  remove?(id:string):boolean;
}

const clone=<T>(x:T):T=>structuredClone(x);
const safe=(s:string)=>s.replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-|-$/g,"").slice(0,120)||"repair";

function blueprintSnapshot(graph:GraphStore,programId:string):ProgramBlueprint|undefined{
  const direct=graph.getEntity(`program:${programId}`);
  const snapshot=direct?.attrs?.blueprintSnapshot;
  if(snapshot && typeof snapshot==="object") return clone(snapshot as ProgramBlueprint);
  const ability=graph.getEntity(`capability:learned:${programId}`);
  const a=ability?.attrs?.blueprintSnapshot;
  return a && typeof a==="object" ? clone(a as ProgramBlueprint) : undefined;
}

function recordRepair(graph:GraphStore,event:RepairEvent):void{
  graph.putEntity({id:event.id,kind:"episode",labels:["self-repair",event.status],attrs:{...event,durable:true}});
}


function experienceEntities(graph:GraphStore,subjectId:string):ExecutionExperience[]{
  return graph.entitiesByKind("episode")
    .filter(e=>e.labels?.includes("execution-experience") && e.attrs?.subjectId===subjectId)
    .map(e=>clone(e.attrs as unknown as ExecutionExperience))
    .sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}

function persistRecoveredSnapshot(graph:GraphStore,program:ProgramBlueprint):void{
  const pid=`program:${program.id}`; const existing=graph.getEntity(pid);
  graph.putEntity({id:pid,kind:"program",labels:[...new Set([...(existing?.labels??[]),"learned-program","reconstructed-from-experience"])],attrs:{...(existing?.attrs??{}),programId:program.id,blueprintSnapshot:clone(program),snapshotStatus:"reconstructed-validated",reconstructedAt:new Date().toISOString()}});
  const aid=`capability:learned:${program.id}`; const ability=graph.getEntity(aid);
  if(ability) graph.putEntity({...ability,attrs:{...(ability.attrs??{}),blueprintSnapshot:clone(program),snapshotStatus:"reconstructed-validated",reconstructedAt:new Date().toISOString()}});
}

function thisGraphExperiences(graph:GraphStore):ExecutionExperience[]{
  return graph.entitiesByKind("episode")
    .filter(e=>e.labels?.includes("execution-experience"))
    .map(e=>clone(e.attrs as unknown as ExecutionExperience));
}

function reconstructFromExperience(graph:GraphStore,id:string,caps:CapabilityRegistry,programs:ProgramLibrary):{program?:ProgramBlueprint;evidence:ExecutionExperience[];reason?:string}{
  const evidence=experienceEntities(graph,id);
  const successes=evidence.filter(e=>e.status==="success" && e.output!==undefined);
  if(successes.length<2) return {evidence,reason:`Need at least 2 successful historical usages; found ${successes.length}`};
  const sig=successes[0]!;
  const compatible=successes.filter(e=>JSON.stringify(e.inputTypes)===JSON.stringify(sig.inputTypes)&&JSON.stringify(e.outputType)===JSON.stringify(sig.outputType));
  if(compatible.length<2) return {evidence,reason:"Historical usages disagree on signature or are insufficient"};
  const seen=new Set<string>();
  const examples=compatible.filter(e=>{const k=JSON.stringify(e.inputs);if(seen.has(k))return false;seen.add(k);return true;}).map(e=>({inputs:clone(e.inputs),output:clone(e.output!)}));
  if(examples.length<2) return {evidence,reason:"Historical usages do not contain two distinct successful input examples"};
  const task:TaskSpec={id:`repair.${safe(id)}`,inputs:clone(sig.inputTypes),output:clone(sig.outputType),examples,labels:["self-repair","reconstruction-from-lived-experience"]};

  // The most valuable part of the usage history is the execution neighborhood:
  // which host capabilities and learned dependencies this ability actually used.
  // Search that small neighborhood first instead of exploding across the world.
  const allExperience=thisGraphExperiences(graph);
  const neighborCapIds=[...new Set(allExperience.filter(e=>e.subjectKind==="host-capability"&&e.callerProgramId===id).map(e=>e.subjectId))];
  const neighborProgramIds=[...new Set(allExperience.filter(e=>e.subjectKind==="learned-program"&&e.callerProgramId===id&&e.subjectId!==id).map(e=>e.subjectId))];
  const localCaps=new CapabilityRegistry();
  for(const capId of neighborCapIds){try{localCaps.register(caps.get(capId))}catch{}}
  const localCallable=neighborProgramIds.map(pid=>programs.get(pid)).filter((p):p is ProgramBlueprint=>!!p);
  const searchCaps=localCaps.all().length?localCaps:caps;
  const callable=localCaps.all().length?localCallable:programs.all().filter(p=>p.id!==id);
  const maxDepth=localCaps.all().length?4:2; // broad fallback is intentionally conservative
  const result=synthesizeDetailed(task,searchCaps,{maxDepth,programs,callablePrograms:callable,programCallPriority:"after-capabilities"});
  if(!result.program) return {evidence,reason:`Could not synthesize a replacement from ${examples.length} historical examples; neighborhood caps=${neighborCapIds.join(",")||"none"}, programs=${neighborProgramIds.join(",")||"none"}`};
  const candidate={...result.program,id,name:`Reconstructed ${id}`,provenance:[...(result.program.provenance??[]),`reconstructed-from-lived-experience:${examples.length}`]};
  try{
    validateProgram(candidate,caps,programs);
    for(const e of compatible){
      const got=runProgram(candidate,e.inputs,caps,programs);
      if(JSON.stringify(got)!==JSON.stringify(e.output)) return {evidence,reason:"Reconstructed candidate failed a historical successful usage"};
    }
    return {program:candidate,evidence};
  }catch(e){return {evidence,reason:`Reconstructed candidate failed validation: ${String(e)}`};}
}

/**
 * A ProgramLibrary wrapper whose missing learned programs can be reconstructed
 * from validated executable snapshots in durable graph memory. This makes
 * recovery available to ordinary validation and execution, not only a special
 * benchmark/runtime mode.
 */
export class SelfHealingProgramLibrary implements ProgramLibrary {
  private repairCounter=0;
  private experienceCounter=0;
  constructor(
    private readonly backing:MutableProgramLibrary,
    private readonly graph:GraphStore,
    private readonly caps:CapabilityRegistry,
  ){}

  put(program:ProgramBlueprint):ProgramBlueprint{return this.backing.put(program)}
  findEquivalent(program:ProgramBlueprint):ProgramBlueprint|undefined{return this.backing.findEquivalent(program)}
  all():ProgramBlueprint[]{return this.backing.all()}
  compatible(inputs:any[],output:any):ProgramBlueprint[]{return this.backing.compatible(inputs,output)}
  remove(id:string):boolean{return this.backing.remove?.(id)??false}

  recordExperience(experience:ExecutionExperience):void{
    const id=experience.id??`experience:${safe(experience.subjectId)}:${++this.experienceCounter}`;
    this.graph.putEntity({id,kind:"episode",labels:["execution-experience",experience.subjectKind,experience.status],attrs:{...clone(experience),id,durable:true}});
  }
  experiencesFor(subjectId:string):ExecutionExperience[]{return experienceEntities(this.graph,subjectId)}

  get(id:string):ProgramBlueprint|undefined{
    const live=this.backing.get(id); if(live) return live;
    return this.restore(id);
  }

  restore(id:string):ProgramBlueprint|undefined{
    const timestamp=new Date().toISOString();
    const eid=`repair:${safe(id)}:${++this.repairCounter}`;
    const snapshot=blueprintSnapshot(this.graph,id);
    if(snapshot){
      try{
        if(snapshot.id!==id) throw new Error(`Snapshot id mismatch: expected ${id}, got ${snapshot.id}`);
        validateProgram(snapshot,this.caps,this);
        const stored=this.backing.put(snapshot);
        recordRepair(this.graph,{id:eid,programId:id,status:"restored",source:"graph-snapshot",timestamp});
        return stored;
      }catch(e){
        recordRepair(this.graph,{id:eid,programId:id,status:"failed",source:"graph-snapshot",reason:String(e),timestamp});
      }
    }

    // A missing/corrupt Blueprint is not amnesia. Reconstruct from the system's
    // accumulated lived usages before escalating to Teacher.
    const rebuilt=reconstructFromExperience(this.graph,id,this.caps,this);
    if(rebuilt.program){
      const stored=this.backing.put(rebuilt.program);
      persistRecoveredSnapshot(this.graph,stored);
      recordRepair(this.graph,{id:`${eid}:experience`,programId:id,status:"restored",source:"lived-experience",reason:`Reconstructed from ${rebuilt.evidence.length} historical usage traces`,timestamp});
      return stored;
    }
    recordRepair(this.graph,{id:`${eid}:experience`,programId:id,status:"failed",source:"lived-experience",reason:rebuilt.reason??"No usable historical evidence",timestamp});
    return undefined;
  }
}

function walkExpr(expr:Expr,root:ProgramBlueprint,caps:CapabilityRegistry,programs:ProgramLibrary,issues:HealthIssue[],repaired:Set<string>,path:string[],seen:Set<string>):void{
  if(expr.kind==="call"){
    try{caps.get(expr.capabilityId)}catch(e){issues.push({kind:"missing-capability",id:expr.capabilityId,path,repaired:false,detail:String(e)})}
    expr.args.forEach((x,i)=>walkExpr(x,root,caps,programs,issues,repaired,[...path,`cap:${expr.capabilityId}[${i}]`],seen));
    return;
  }
  if(expr.kind==="program_call"){
    if(seen.has(expr.programId)){issues.push({kind:"cycle",id:expr.programId,path,repaired:false,detail:"recursive dependency cycle"});return}
    const before=(programs as any).backing?.get?.(expr.programId) ?? undefined;
    const target=programs.get(expr.programId);
    if(!target){issues.push({kind:"missing-program",id:expr.programId,path,repaired:false});return}
    if(!before && programs instanceof SelfHealingProgramLibrary) repaired.add(expr.programId);
    try{validateProgram(target,caps,programs)}catch(e){issues.push({kind:"invalid-program",id:expr.programId,path,repaired:false,detail:String(e)});return}
    const nextSeen=new Set(seen);nextSeen.add(expr.programId);
    walkExpr(target.body,target,caps,programs,issues,repaired,[...path,`program:${expr.programId}`],nextSeen);
    expr.args.forEach((x,i)=>walkExpr(x,root,caps,programs,issues,repaired,[...path,`arg:${expr.programId}[${i}]`],seen));
  }
}

/** Scan and opportunistically heal the entire learned dependency chain before execution. */
export function scanProgramHealth(program:ProgramBlueprint,caps:CapabilityRegistry,programs:ProgramLibrary):HealthReport{
  const issues:HealthIssue[]=[]; const repaired=new Set<string>();
  try{validateProgram(program,caps,programs)}catch(e){
    // Continue with structural walk for a useful diagnosis instead of returning the first thrown error.
    issues.push({kind:"invalid-program",id:program.id,path:[program.id],repaired:false,detail:String(e)});
  }
  walkExpr(program.body,program,caps,programs,issues,repaired,[program.id],new Set([program.id]));
  // Validation may have healed a missing dependency before the structural walk. Derive repaired ids from repair episodes when available.
  const graph=(programs as any).graph as GraphStore|undefined;
  if(graph) for(const e of graph.entitiesByKind("episode")) if(e.labels?.includes("self-repair")&&e.labels?.includes("restored")&&typeof e.attrs?.programId==="string") repaired.add(String(e.attrs.programId));
  const unresolved=issues.filter(i=>!i.repaired);
  // If the only top-level validation error was an unknown program that is now present, discard it.
  const filtered=unresolved.filter(i=>!(i.kind==="invalid-program" && i.detail?.includes("Unknown learned program") && [...repaired].length));
  return {healthy:filtered.length===0,repairedProgramIds:[...repaired],issues:filtered};
}

export interface ResilientRunResult {value:Value;health:HealthReport;retries:number}

/**
 * Default high-level learned-program execution: preflight the dependency chain,
 * repair what durable memory can repair, execute, and make one recovery pass if
 * something changed between preflight and execution.
 */
export function runProgramResilient(program:ProgramBlueprint,inputs:Value[],caps:CapabilityRegistry,programs:ProgramLibrary):ResilientRunResult{
  let health=scanProgramHealth(program,caps,programs);
  if(!health.healthy) throw new Error(`Unrepairable program dependency chain: ${health.issues.map(i=>`${i.kind}:${i.id}`).join(", ")}`);
  try{return {value:runProgram(program,inputs,caps,programs),health,retries:0}}
  catch(first){
    const second=scanProgramHealth(program,caps,programs);
    if(!second.healthy) throw new Error(`Execution failed and repair could not restore health: ${String(first)}; ${second.issues.map(i=>`${i.kind}:${i.id}`).join(", ")}`);
    try{return {value:runProgram(program,inputs,caps,programs),health:{healthy:true,repairedProgramIds:[...new Set([...health.repairedProgramIds,...second.repairedProgramIds])],issues:[]},retries:1}}
    catch(secondError){throw new Error(`Execution remained broken after self-repair retry: ${String(secondError)}`)}
  }
}
