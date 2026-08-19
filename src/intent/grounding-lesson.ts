import type { GraphStore } from "../graph/graph.js";
import { MemoryGraphStore } from "../graph/graph.js";
import { interpretIntent } from "./interpreter.js";
import { storePhraseGrounding } from "./phrase-grounding.js";

export interface IntentGroundingExpectation {
  utterance:string;
  relation:string;
  constants?:number[];
}

export interface IntentGroundingLesson {
  id:string;
  phrase:string;
  relation:string;
  impliedValue?:number;
  confidence:number;
  validationExamples:IntentGroundingExpectation[];
  provenance:string[];
}

export interface IntentGroundingLessonResult {
  accepted:boolean;
  failures:string[];
}

export function validateAndLearnIntentGrounding(store:GraphStore,lesson:IntentGroundingLesson):IntentGroundingLessonResult{
  if(lesson.validationExamples.length===0) throw new Error("intent grounding lesson requires validation examples");
  // Validate in a temporary graph so a bad proposal never mutates durable knowledge.
  const temp = store.sandbox ? store.sandbox() : new MemoryGraphStore(store.snapshot());
  storePhraseGrounding(temp,{phrase:lesson.phrase,relation:lesson.relation,impliedValue:lesson.impliedValue,confidence:lesson.confidence,provenance:lesson.provenance});
  const failures:string[]=[];
  for(const ex of lesson.validationExamples){
    const result=interpretIntent(ex.utterance,temp);
    if(result.status!=="resolved"){failures.push(`${ex.utterance}: status=${result.status}`);continue;}
    const relation=result.intent.constraints[0]?.relation;
    if(relation!==ex.relation){failures.push(`${ex.utterance}: relation=${relation}`);continue;}
    if(ex.constants){
      const got=result.intent.signals.map(s=>s.value).filter((x):x is number=>typeof x==="number");
      if(JSON.stringify(got)!==JSON.stringify(ex.constants))
        failures.push(`${ex.utterance}: constants=${JSON.stringify(got)}`);
    }
  }
  if(failures.length) return {accepted:false,failures};
  storePhraseGrounding(store,{phrase:lesson.phrase,relation:lesson.relation,impliedValue:lesson.impliedValue,confidence:lesson.confidence,provenance:[...lesson.provenance,`lesson:${lesson.id}`]});
  return {accepted:true,failures:[]};
}
