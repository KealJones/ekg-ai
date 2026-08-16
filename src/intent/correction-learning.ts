import type { GraphStore } from "../graph/graph.js";
import { validateAndLearnIntentGrounding, type IntentGroundingLessonResult } from "./grounding-lesson.js";

export interface IntentCorrection {
  id:string;
  phrase:string;
  correctedRelation:string;
  impliedValue?:number;
  utterance:string;
  expectedConstants?:number[];
  provenance:string[];
}

export function learnFromIntentCorrection(store:GraphStore,c:IntentCorrection):IntentGroundingLessonResult{
  if(c.provenance.length===0) throw new Error("correction provenance is required");
  return validateAndLearnIntentGrounding(store,{
    id:c.id,phrase:c.phrase,relation:c.correctedRelation,impliedValue:c.impliedValue,
    confidence:.9,
    validationExamples:[{utterance:c.utterance,relation:c.correctedRelation,constants:c.expectedConstants}],
    provenance:[...c.provenance,"source:user-or-execution-correction"]
  });
}
