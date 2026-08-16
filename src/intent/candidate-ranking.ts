import type { Intent } from "./intent.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import type { ProgramBlueprint } from "../ir/blueprint.js";
import { planIntent } from "./planner.js";
import { retrieveProgramsForIntent } from "./intent-retrieval.js";

export interface RankedIntentCandidate {
  intent: Intent;
  score: number;
  plannerFeasible: boolean;
  relatedPrograms: string[];
  reasons: string[];
}

export function rankIntentCandidates(
  candidates: Intent[],
  caps: CapabilityRegistry,
  programs: ProgramBlueprint[] = [],
): RankedIntentCandidate[] {
  return candidates.map(intent=>{
    let score=intent.confidence*100;
    const reasons=[`language-confidence:${intent.confidence.toFixed(2)}`];
    const plan=planIntent(intent,caps);
    const plannerFeasible=plan.status==="planned";
    if(plannerFeasible){score+=50;reasons.push("planner-feasible");}
    else {score-=25;reasons.push(`planner-unavailable:${plan.reason}`);}
    const related=retrieveProgramsForIntent(intent,programs,3);
    if(related.length){
      score+=Math.min(30,related[0]!.score-100);
      reasons.push(`related-program:${related[0]!.program.id}`);
    }
    return {intent,score,plannerFeasible,relatedPrograms:related.map(x=>x.program.id),reasons};
  }).sort((a,b)=>b.score-a.score||a.intent.id.localeCompare(b.intent.id));
}

export function resolveRankedIntent(
  ranked: RankedIntentCandidate[],
  margin=20,
): {status:"resolved";candidate:RankedIntentCandidate}|{status:"clarify";question:string;candidates:RankedIntentCandidate[]}|{status:"teacher";reason:string} {
  const feasible=ranked.filter(x=>x.plannerFeasible);
  if(feasible.length===0) return {status:"teacher",reason:"no candidate interpretation is planner-feasible"};
  if(feasible.length===1) return {status:"resolved",candidate:feasible[0]!};
  const [first,second]=feasible;
  if(first!.score-second!.score>=margin) return {status:"resolved",candidate:first!};
  return {
    status:"clarify",
    question:`I have multiple executable interpretations (${feasible.slice(0,3).map(x=>x.intent.constraints.map(c=>c.relation).join(" then ")).join(" vs ")}). Which did you mean?`,
    candidates:feasible
  };
}
