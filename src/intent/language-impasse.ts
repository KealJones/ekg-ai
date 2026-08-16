import type { IntentInterpretation } from "./intent.js";
import type { TeacherRequest } from "../teaching/teacher-adapter.js";

export function buildIntentTeacherContext(
  rawUtterance:string,
  interpretation:IntentInterpretation,
):TeacherRequest["context"]|undefined{
  if(interpretation.status==="resolved") return undefined;
  if(interpretation.status==="teacher"){
    return {
      rawGoal:rawUtterance,
      taskId:`intent:${rawUtterance.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,40)}`,
      observation:`Intent interpreter could not ground the utterance: "${rawUtterance}".`,
      impasse:interpretation.reason,
      failedAttempts:["Seed/learned phrase grounding did not produce a resolvable Intent."]
    };
  }
  return {
    rawGoal:rawUtterance,
    taskId:`intent:${rawUtterance.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,40)}`,
    observation:`Intent interpreter produced ${interpretation.alternatives.length} plausible alternatives but cannot safely choose.`,
    impasse:`Clarification required: ${interpretation.question}`,
    failedAttempts:["Automatic interpretation remained ambiguous; guessing is forbidden."]
  };
}
