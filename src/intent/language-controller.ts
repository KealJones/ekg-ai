import type { GraphStore } from "../graph/graph.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import type { Value } from "../ir/blueprint.js";
import { interpretComposedIntent } from "./composition.js";
import { planIntent } from "./planner.js";
import { runProgram } from "../runtime/interpreter.js";
import { buildIntentTeacherContext } from "./language-impasse.js";

export type LanguageResult =
  | {status:"executed";output:Value;intentId:string;teacherInterventions:0}
  | {status:"clarify";question:string;teacherInterventions:0}
  | {status:"teacher";context:NonNullable<ReturnType<typeof buildIntentTeacherContext>>;teacherInterventions:1}
  | {status:"unsupported";reason:string;teacherInterventions:0};

export class LanguageController {
  constructor(private readonly graph:GraphStore,private readonly caps:CapabilityRegistry){}
  handle(rawUtterance:string,inputs:Value[]):LanguageResult{
    const interpreted=interpretComposedIntent(rawUtterance,this.graph);
    if(interpreted.status==="clarify") return {status:"clarify",question:interpreted.question,teacherInterventions:0};
    if(interpreted.status==="teacher") return {status:"teacher",context:buildIntentTeacherContext(rawUtterance,interpreted)!,teacherInterventions:1};
    const plan=planIntent(interpreted.intent,this.caps);
    if(plan.status!=="planned") return {status:"unsupported",reason:plan.reason??"unplanned",teacherInterventions:0};
    return {status:"executed",output:runProgram(plan.program!,inputs,this.caps),intentId:interpreted.intent.id,teacherInterventions:0};
  }
}
