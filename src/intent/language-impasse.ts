import type { IntentInterpretation } from "./intent.js";
import type { TeacherRequest } from "../teaching/teacher-adapter.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";

export function buildIntentTeacherContext(
  rawUtterance:string,
  interpretation:IntentInterpretation,
  caps?:CapabilityRegistry,
):TeacherRequest["context"]|undefined{
  const availableCapabilities=caps?.all().map(c=>({id:c.id,inputs:c.inputs.map(t=>t.kind),output:c.output.kind,pure:c.pure,deterministic:c.deterministic}));
  if(interpretation.status==="resolved") return undefined;
  if(interpretation.status==="teacher"){
    return {
      rawGoal:rawUtterance,
      taskId:`intent:${rawUtterance.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,40)}`,
      observation:`Intent interpreter could not ground the utterance: "${rawUtterance}".`,
      impasse:interpretation.reason,
      failedAttempts:["Seed/learned phrase grounding did not produce a resolvable Intent."],
      availableCapabilities
    };
  }
  return {
    rawGoal:rawUtterance,
    taskId:`intent:${rawUtterance.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,40)}`,
    observation:`Intent interpreter produced ${interpretation.alternatives.length} plausible alternatives but cannot safely choose.`,
    impasse:`Clarification required: ${interpretation.question}`,
    failedAttempts:["Automatic interpretation remained ambiguous; guessing is forbidden."],
    availableCapabilities
  };
}
