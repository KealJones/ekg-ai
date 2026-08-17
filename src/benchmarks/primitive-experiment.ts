import type { Value } from "../ir/blueprint.js";
import type { FrozenExternalBenchmark, FrozenGoldItem } from "./external-items.js";
import { auditExternalProvenance, verifyFrozenExternalBenchmark } from "./external-items.js";
import type { FrozenPrimitiveSelection } from "./primitive-selection.js";
import type { DurableStateMeasurement, TeacherOffGuard } from "./primitive-holdout.js";
import { teacherOffGuard } from "./primitive-holdout.js";
import { confusionMatrix, gradeOutcome, riskCoverageCurve, aurc, type BenchmarkAction, type GradedOutcome, type RiskCoveragePoint } from "./selective-evaluation.js";

export type PrimaryConditionName = "ekg_post_lesson" | "lesson_withheld" | "checkpoint0_synthesis" | "selective_knn";

export interface PrimitiveExperimentProtocol {
  schemaVersion: "0.3";
  status: "FROZEN_BEFORE_SCORED_EVALUATION";
  selectionHash: string;
  requiredConditions: PrimaryConditionName[];
  teacherOffAtTest: true;
  requiredFixturesPerItem: 3;
  requiredItemsPerPrimitive: 40;
  minimumFamiliesPerPrimitive: 4;
  coverageOperatingPoints: number[];
  maxSearchNodesPerItem: number;
  clarificationTurnsMax: number;
  protocolHash: string;
}

export interface BoundExperimentManifest {
  protocolHash: string;
  selectionHash: string;
  benchmarkManifestHash: string;
  mode: "smoke" | "production";
  primitiveCounts: Record<string,number>;
  familyCounts: Record<string,number>;
  bindingHash: string;
}

export interface ConditionEvaluation {
  action: BenchmarkAction;
  /** One output per frozen fixture, in fixture order. Required for ANSWER. */
  denotations?: Value[];
  /** Confidence of the answer candidate, used for threshold-independent risk/coverage analysis. */
  confidence?: number;
  searchNodes: number;
  effectful?: boolean;
}

export interface ExperimentCondition {
  name: PrimaryConditionName;
  evaluate(itemId:string,utterance:string,guard:TeacherOffGuard):ConditionEvaluation;
  measureDurableState():DurableStateMeasurement;
}

export interface ConditionRow {
  itemId:string;
  primitiveId:string;
  familyId:string;
  action:BenchmarkAction;
  correct:boolean;
  denotationCorrect:boolean;
  searchNodes:number;
  confidence?:number;
  effectful:boolean;
  outcome:GradedOutcome;
}

export interface ConditionMetrics {
  n:number;
  correct:number;
  accuracy:number;
  answered:number;
  coverage:number;
  wrongAnswered:number;
  risk:number;
  fcer:number;
  searchNodesTotal:number;
  searchNodesPerSolved:number|null;
  teacherCalls:number;
  confusion:ReturnType<typeof confusionMatrix>;
  riskCoverage?:RiskCoveragePoint[];
  aurc?:number;
  durableBefore:DurableStateMeasurement;
  durableAfter:DurableStateMeasurement;
  durableDelta:{programs:number;canonicalProgramBytes:number;canonicalProgramNodes:number;uniqueCanonicalPrograms:number};
}

export interface PrimitiveExperimentReport {
  status:"MEASUREMENT_ONLY";
  manifest:BoundExperimentManifest;
  conditions:Record<PrimaryConditionName,ConditionMetrics>;
  byPrimitive:Record<string,Partial<Record<PrimaryConditionName,{n:number;correct:number;accuracy:number}>>>;
  rows:Partial<Record<PrimaryConditionName,ConditionRow[]>>;
}

function stable(value:unknown):string {
  if(value===null || typeof value!=="object") return JSON.stringify(value);
  if(Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj=value as Record<string,unknown>;
  return `{${Object.keys(obj).sort().map(k=>`${JSON.stringify(k)}:${stable(obj[k])}`).join(",")}}`;
}
function fnv1a64(text:string):string {
  let hash=0xcbf29ce484222325n; const prime=0x100000001b3n;
  for(const byte of new TextEncoder().encode(text)){hash^=BigInt(byte);hash=BigInt.asUintN(64,hash*prime);}
  return hash.toString(16).padStart(16,"0");
}
function hash(value:unknown):string { return `fnv1a64:${fnv1a64(stable(value))}`; }
function eq(a:unknown,b:unknown):boolean { return stable(a)===stable(b); }

export function freezePrimitiveExperimentProtocol(selection:FrozenPrimitiveSelection,overrides:Partial<Omit<PrimitiveExperimentProtocol,"schemaVersion"|"status"|"selectionHash"|"protocolHash">>={}):PrimitiveExperimentProtocol {
  if(selection.status!=="FROZEN_BEFORE_SCORED_ITEMS" || selection.primitives.length!==3) throw new Error("primitive selection must be frozen before protocol freeze");
  const body:Omit<PrimitiveExperimentProtocol,"protocolHash">={
    schemaVersion:"0.3",
    status:"FROZEN_BEFORE_SCORED_EVALUATION",
    selectionHash:selection.selectionHash,
    requiredConditions:["ekg_post_lesson","lesson_withheld","checkpoint0_synthesis","selective_knn"],
    teacherOffAtTest:true,
    requiredFixturesPerItem:3,
    requiredItemsPerPrimitive:40,
    minimumFamiliesPerPrimitive:4,
    coverageOperatingPoints:[0.5,0.7,0.9],
    maxSearchNodesPerItem:10000,
    clarificationTurnsMax:2,
    ...overrides
  };
  if(body.requiredConditions.length!==4 || new Set(body.requiredConditions).size!==4) throw new Error("all four primary conditions are required");
  if(body.teacherOffAtTest!==true) throw new Error("Teacher must be hard OFF during primary scored conditions");
  if(body.requiredFixturesPerItem<3) throw new Error("at least three fixtures are required");
  if(body.requiredItemsPerPrimitive<40) throw new Error("production protocol requires at least 40 items per primitive");
  if(body.minimumFamiliesPerPrimitive<2) throw new Error("multiple semantic families per primitive are required");
  if(body.maxSearchNodesPerItem<=0) throw new Error("search budget must be positive");
  const protocolHash=hash(body);
  return {...body,protocolHash};
}

export function verifyPrimitiveExperimentProtocol(protocol:PrimitiveExperimentProtocol):boolean {
  const {protocolHash,...body}=protocol;
  return protocol.schemaVersion==="0.3" && protocol.status==="FROZEN_BEFORE_SCORED_EVALUATION" && protocolHash===hash(body);
}

export function bindProtocolToBenchmark(protocol:PrimitiveExperimentProtocol,selection:FrozenPrimitiveSelection,benchmark:FrozenExternalBenchmark,mode:"smoke"|"production"="production"):BoundExperimentManifest {
  if(!verifyPrimitiveExperimentProtocol(protocol)) throw new Error("experiment protocol hash mismatch");
  if(protocol.selectionHash!==selection.selectionHash) throw new Error("protocol/primitive selection mismatch");
  if(!verifyFrozenExternalBenchmark(benchmark)) throw new Error("external benchmark failed integrity verification");
  const provenance=auditExternalProvenance(benchmark.items); if(!provenance.ok) throw new Error(`external provenance audit failed: ${provenance.violations.join("; ")}`);
  const selected=new Set(selection.primitives.map(x=>x.id));
  const primitiveCounts:Record<string,number>=Object.fromEntries([...selected].map(id=>[id,0]));
  const families=new Map<string,Set<string>>([...selected].map(id=>[id,new Set<string>()]));
  for(const item of benchmark.items){
    if(!selected.has(item.primitiveId)) throw new Error(`benchmark item ${item.id} uses unselected primitive ${item.primitiveId}`);
    if(item.fixtures.length<protocol.requiredFixturesPerItem) throw new Error(`benchmark item ${item.id} has too few fixtures`);
    primitiveCounts[item.primitiveId]=(primitiveCounts[item.primitiveId]??0)+1;
    families.get(item.primitiveId)!.add(item.familyId);
  }
  const familyCounts:Record<string,number>=Object.fromEntries([...families].map(([id,set])=>[id,set.size]));
  if(mode==="production"){
    for(const id of selected){
      if((primitiveCounts[id]??0)<protocol.requiredItemsPerPrimitive) throw new Error(`${id} has fewer than ${protocol.requiredItemsPerPrimitive} scored items`);
      if((familyCounts[id]??0)<protocol.minimumFamiliesPerPrimitive) throw new Error(`${id} has fewer than ${protocol.minimumFamiliesPerPrimitive} semantic families`);
    }
  }
  const base={protocolHash:protocol.protocolHash,selectionHash:selection.selectionHash,benchmarkManifestHash:benchmark.manifestHash,mode,primitiveCounts,familyCounts};
  return {...base,bindingHash:hash(base)};
}

function goldById(benchmark:FrozenExternalBenchmark):Map<string,FrozenGoldItem>{ return new Map(benchmark.gold.map(x=>[x.itemId,x])); }
function durableDelta(a:DurableStateMeasurement,b:DurableStateMeasurement){return {
  programs:b.programs-a.programs,
  canonicalProgramBytes:b.canonicalProgramBytes-a.canonicalProgramBytes,
  canonicalProgramNodes:b.canonicalProgramNodes-a.canonicalProgramNodes,
  uniqueCanonicalPrograms:b.uniqueCanonicalPrograms-a.uniqueCanonicalPrograms
};}

export function runPrimitiveHoldoutExperiment(protocol:PrimitiveExperimentProtocol,manifest:BoundExperimentManifest,benchmark:FrozenExternalBenchmark,conditions:ExperimentCondition[]):PrimitiveExperimentReport {
  if(!verifyPrimitiveExperimentProtocol(protocol)) throw new Error("experiment protocol hash mismatch");
  if(manifest.protocolHash!==protocol.protocolHash || manifest.benchmarkManifestHash!==benchmark.manifestHash) throw new Error("bound manifest does not match protocol/benchmark");
  const required=new Set(protocol.requiredConditions);
  if(conditions.length!==required.size || conditions.some(c=>!required.has(c.name)) || new Set(conditions.map(c=>c.name)).size!==required.size) throw new Error("exactly the four frozen primary conditions are required");
  const gold=goldById(benchmark);
  const conditionMetrics={} as Record<PrimaryConditionName,ConditionMetrics>;
  const rows:PrimitiveExperimentReport["rows"]={};
  const byPrimitive:PrimitiveExperimentReport["byPrimitive"]={};

  for(const condition of conditions){
    const guard=teacherOffGuard();
    const before=condition.measureDurableState();
    const conditionRows:ConditionRow[]=[];
    for(const item of benchmark.items){
      const g=gold.get(item.id); if(!g) throw new Error(`missing gold for ${item.id}`);
      const result=condition.evaluate(item.id,item.utterance,guard);
      if(!Number.isInteger(result.searchNodes) || result.searchNodes<0 || result.searchNodes>protocol.maxSearchNodesPerItem) throw new Error(`${condition.name}/${item.id} violated search budget`);
      if(result.confidence!==undefined && (result.confidence<0 || result.confidence>1 || !Number.isFinite(result.confidence))) throw new Error(`${condition.name}/${item.id} confidence must be within [0,1]`);
      const expected=g.fixtures.map(x=>x.expected);
      const denotationCorrect=result.action==="ANSWER" && !!result.denotations && result.denotations.length===expected.length && result.denotations.every((x,i)=>eq(x,expected[i]));
      const goldAction=item.expectedAction==="ANSWER"?"ANSWER":item.expectedAction==="CLARIFY"?"CLARIFY":"ESCALATE";
      const outcome=gradeOutcome({goldAction,actualAction:result.action,denotationCorrect,effectful:result.effectful});
      conditionRows.push({itemId:item.id,primitiveId:item.primitiveId,familyId:item.familyId,action:result.action,correct:outcome.correct,denotationCorrect,searchNodes:result.searchNodes,confidence:result.confidence,effectful:!!result.effectful,outcome});
    }
    guard.assertOff();
    const after=condition.measureDurableState();
    const outcomes=conditionRows.map(x=>x.outcome);
    const answered=conditionRows.filter(x=>x.outcome.answered).length;
    const wrongAnswered=conditionRows.filter(x=>x.outcome.answered&&!x.correct).length;
    const correct=conditionRows.filter(x=>x.correct).length;
    const effectfulWrong=conditionRows.filter(x=>x.outcome.kind==="wrong_answer_effectful").length;
    const effectfulAnswered=conditionRows.filter(x=>x.effectful && x.action==="ANSWER").length;
    const solved=Math.max(1,correct);
    const confident=conditionRows.filter(x=>x.confidence!==undefined);
    const curve=confident.length===conditionRows.length?riskCoverageCurve(confident.map(x=>({item:x.itemId,confidence:x.confidence!,correct:x.denotationCorrect}))):undefined;
    conditionMetrics[condition.name]={
      n:conditionRows.length,correct,accuracy:conditionRows.length?correct/conditionRows.length:0,
      answered,coverage:conditionRows.length?answered/conditionRows.length:0,
      wrongAnswered,risk:answered?wrongAnswered/answered:0,
      fcer:effectfulAnswered?effectfulWrong/effectfulAnswered:0,
      searchNodesTotal:conditionRows.reduce((n,x)=>n+x.searchNodes,0),
      searchNodesPerSolved:correct?conditionRows.reduce((n,x)=>n+x.searchNodes,0)/solved:null,
      teacherCalls:guard.teacherCalls,confusion:confusionMatrix(outcomes),
      riskCoverage:curve,aurc:curve?aurc(curve):undefined,
      durableBefore:before,durableAfter:after,durableDelta:durableDelta(before,after)
    };
    rows[condition.name]=conditionRows;
    for(const primitiveId of new Set(conditionRows.map(x=>x.primitiveId))){
      const subset=conditionRows.filter(x=>x.primitiveId===primitiveId); const pc=subset.filter(x=>x.correct).length;
      byPrimitive[primitiveId]??={}; byPrimitive[primitiveId]![condition.name]={n:subset.length,correct:pc,accuracy:subset.length?pc/subset.length:0};
    }
  }
  return {status:"MEASUREMENT_ONLY",manifest,conditions:conditionMetrics,byPrimitive,rows};
}
