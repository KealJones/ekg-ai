import type { Intent } from "./intent.js";
import type { TaskSpec } from "../task.js";
import type { Value } from "../ir/blueprint.js";

/**
 * Build a grounded TaskSpec only when concrete examples are supplied by the environment.
 * Intent semantics are not converted back into magic family/labels.
 */
export function taskFromIntentExamples(intent:Intent,examples:Array<{inputs:Value[];output:Value}>,id?:string):TaskSpec{
  const inputs=intent.signals.filter(s=>s.binding==="input").map(s=>s.type);
  return {id:id??`${intent.id}:task`,inputs,output:intent.goal.type,examples};
}
