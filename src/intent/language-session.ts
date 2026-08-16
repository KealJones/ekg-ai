import type { GraphStore } from "../graph/graph.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import type { Value } from "../ir/blueprint.js";
import type { IntentInterpretation } from "./intent.js";
import { interpretComposedIntent } from "./composition.js";
import { applyClarification } from "./clarification.js";
import { planIntent } from "./planner.js";
import { runProgram } from "../runtime/interpreter.js";
import { buildIntentTeacherContext } from "./language-impasse.js";

export type SessionResult =
  | {status:"executed";output:Value}
  | {status:"clarify";question:string}
  | {status:"teacher";context:NonNullable<ReturnType<typeof buildIntentTeacherContext>>}
  | {status:"unsupported";reason:string};

export class LanguageSession {
  private pending?:Extract<IntentInterpretation,{status:"clarify"}>;
  private originalUtterance?:string;
  constructor(private readonly graph:GraphStore,private readonly caps:CapabilityRegistry){}

  start(rawUtterance:string,inputs:Value[]):SessionResult{
    this.pending=undefined; this.originalUtterance=rawUtterance;
    return this.resolve(interpretComposedIntent(rawUtterance,this.graph),inputs);
  }

  answer(answer:string,inputs:Value[]):SessionResult{
    if(!this.pending) throw new Error("no clarification is pending");
    const next=applyClarification(this.pending,answer);
    return this.resolve(next,inputs);
  }

  private resolve(interpreted:IntentInterpretation,inputs:Value[]):SessionResult{
    if(interpreted.status==="clarify"){
      this.pending=interpreted;
      return {status:"clarify",question:interpreted.question};
    }
    this.pending=undefined;
    if(interpreted.status==="teacher")
      return {status:"teacher",context:buildIntentTeacherContext(this.originalUtterance??interpreted.rawUtterance,interpreted)!};
    const plan=planIntent(interpreted.intent,this.caps);
    if(plan.status!=="planned") return {status:"unsupported",reason:plan.reason??"unplanned"};
    return {status:"executed",output:runProgram(plan.program!,inputs,this.caps)};
  }
}
