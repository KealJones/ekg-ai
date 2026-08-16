import type { GraphStore } from "../graph/graph.js";
import { storePhraseGrounding } from "./phrase-grounding.js";

export interface NumericBehaviorExample { input:number; output:number; }
export interface BehavioralGroundingCandidate { relation:"Add"|"Multiply"; impliedValue:number; }

export function inferNumericGroundingFromExamples(
  examples:NumericBehaviorExample[],
  range=20,
): BehavioralGroundingCandidate[] {
  if(examples.length<2) return [];
  const candidates:BehavioralGroundingCandidate[]=[];
  for(let n=-range;n<=range;n++){
    if(examples.every(e=>e.input+n===e.output)) candidates.push({relation:"Add",impliedValue:n});
    if(examples.every(e=>e.input*n===e.output)) candidates.push({relation:"Multiply",impliedValue:n});
  }
  return candidates;
}

export function learnNumericPhraseFromBehavior(
  store:GraphStore,
  args:{phrase:string;examples:NumericBehaviorExample[];provenance:string[];range?:number},
): {accepted:boolean;candidate?:BehavioralGroundingCandidate;reason:string} {
  if(args.provenance.length===0) throw new Error("behavioral grounding provenance is required");
  const candidates=inferNumericGroundingFromExamples(args.examples,args.range??20);
  if(candidates.length!==1)
    return {accepted:false,reason:candidates.length===0?"no consistent grounding":"ambiguous behavioral grounding"};
  const c=candidates[0]!;
  storePhraseGrounding(store,{
    phrase:args.phrase,relation:c.relation,impliedValue:c.impliedValue,confidence:.85,
    provenance:[...args.provenance,"learned-from:behavioral-examples"]
  });
  return {accepted:true,candidate:c,reason:"unique behavioral grounding"};
}
