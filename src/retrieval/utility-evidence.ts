import type { GraphStore } from "../graph/graph.js";

export interface UtilityObservation {
  id: string;
  taskFamily: string;
  programId: string;
  primitiveSolved: boolean;
  learnedSolved: boolean;
  primitiveCandidates: number;
  learnedCandidates: number;
  provenance: string[];
}

export interface UtilityPrior {
  taskFamily: string;
  programId: string;
  observations: number;
  meanSavings: number;
  learnedWins: number;
  primitiveWins: number;
  solveRegressions: number;
}

function evidenceId(o:UtilityObservation){ return `utility:${o.id}`; }
function programEntityId(programId:string){ return `program-ref:${programId}`; }
function familyEntityId(family:string){ return `task-family:${family}`; }

export function recordUtilityObservation(store:GraphStore,o:UtilityObservation):void{
  if(!o.id.trim()||!o.taskFamily.trim()||!o.programId.trim()) throw new Error("utility observation identifiers are required");
  if(o.primitiveCandidates<0||o.learnedCandidates<0) throw new Error("candidate counts must be non-negative");
  if(o.provenance.length===0) throw new Error("utility provenance is required");

  const pid=programEntityId(o.programId);
  const fid=familyEntityId(o.taskFamily);
  if(!store.getEntity(pid)) store.putEntity({id:pid,kind:"program",labels:[o.programId],attrs:{externalProgramId:o.programId}});
  if(!store.getEntity(fid)) store.putEntity({id:fid,kind:"concept",labels:["task-family",o.taskFamily],attrs:{family:o.taskFamily}});

  const eid=evidenceId(o);
  store.putEntity({id:eid,kind:"utility_evidence",labels:["activation-utility"],attrs:{
    taskFamily:o.taskFamily,programId:o.programId,
    primitiveSolved:o.primitiveSolved,learnedSolved:o.learnedSolved,
    primitiveCandidates:o.primitiveCandidates,learnedCandidates:o.learnedCandidates,
    candidateSavings:o.primitiveCandidates-o.learnedCandidates,
    provenance:o.provenance
  }});
  store.putRelation({id:`${eid}:program`,kind:"measures_program",from:eid,to:pid,confidence:1});
  store.putRelation({id:`${eid}:family`,kind:"observed_in_family",from:eid,to:fid,confidence:1});
}

export function deriveUtilityPrior(store:GraphStore,taskFamily:string,programId:string):UtilityPrior{
  const rows=store.entitiesByKind("utility_evidence").filter(e=>
    e.attrs?.taskFamily===taskFamily && e.attrs?.programId===programId
  );
  let savings=0, learnedWins=0, primitiveWins=0, solveRegressions=0;
  for(const e of rows){
    const a=e.attrs??{};
    const primitiveSolved=!!a.primitiveSolved, learnedSolved=!!a.learnedSolved;
    const s=Number(a.candidateSavings??0); savings+=s;
    if(learnedSolved&&!primitiveSolved) learnedWins++;
    else if(primitiveSolved&&!learnedSolved){ primitiveWins++; solveRegressions++; }
    else if(learnedSolved&&primitiveSolved){
      if(s>0) learnedWins++; else if(s<0) primitiveWins++;
    }
  }
  return {
    taskFamily,programId,observations:rows.length,
    meanSavings:rows.length?savings/rows.length:0,
    learnedWins,primitiveWins,solveRegressions
  };
}
