import type { GraphStore } from "../graph/graph.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import type { ProgramLibrary } from "../program-library.js";
import type { ProgramBlueprint, Value } from "../ir/blueprint.js";
import type { JsonValue } from "../ir/blueprint.js";
import type { IntentInterpretation } from "./intent.js";
import { T } from "../ir/types.js";
import { parseUtterance, type ParsedUtterance, type ParsedArg } from "./semantic-parser.js";
import { assertWorldFact, retractWorldFact, queryLatestWorldFact, queryWorldFactTruth, queryWorldFactCount, queryWorldFactSet, queryClassProperty, deriveWorldFacts } from "../language/world-language.js";
import { planIntent } from "./planner.js";
import { runProgram } from "../runtime/interpreter.js";
import { interpretComposedIntent } from "./composition.js";

export type DispatchResult =
  | {status:"fact-recorded"; factId?:string; message:string}
  | {status:"answer"; value:JsonValue}
  | {status:"executed"; value:Value; program:ProgramBlueprint; inputs:Value[]}
  | {status:"intent"; interpretation:IntentInterpretation}
  | {status:"conversational"; response:string}
  | {status:"unresolved"; reason:string};

const CONVERSATIONAL_RESPONSES: Record<string,string> = {
  "greeting": "Hey! I'm EKG. I can do math, track facts about the world, and answer questions. Type /help for commands.",
  "farewell": "See you! Your brain state has been saved.",
  "gratitude": "No problem.",
  "affirmative": "Got it.",
  "help-request": "I can do math, track facts about the world, and answer questions. Type /help for the full command list.",
};

function buildIntentFromCapabilityCommand(
  parsed: Extract<ParsedUtterance, {kind:"capability-command"}>,
  store: GraphStore | undefined,
  caps: CapabilityRegistry,
  programs: ProgramLibrary | undefined,
  providedInputs?: Value[]
): {program: ProgramBlueprint; inputs: Value[]} | {error: string} {
  const signals: any[] = [];
  const constraintArgs: string[] = [];
  const runtimeInputs: Value[] = [];
  let inputIdx = 0;

  for (let i = 0; i < parsed.args.length; i++) {
    const arg = parsed.args[i]!;
    if (arg.kind === "value") {
      const id = `signal.const.${i}`;
      signals.push({id, type: T.int, binding: "constant", value: arg.value});
      constraintArgs.push(id);
    } else {
      const id = `signal.input${inputIdx}`;
      const inputValue = providedInputs?.[arg.index];
      if (inputValue !== undefined) {
        signals.push({id, type: T.int, binding: "input", inputIndex: inputIdx});
        runtimeInputs.push(inputValue);
      } else {
        signals.push({id, type: T.int, binding: "input", inputIndex: inputIdx});
      }
      constraintArgs.push(id);
      inputIdx++;
    }
  }

  const intent = {
    id: `semantic:${parsed.relation.toLowerCase()}-${constraintArgs.length}`,
    rawUtterance: "",
    signals,
    constraints: [{relation: parsed.relation, args: constraintArgs, provenance: parsed.provenance}],
    goal: {concept: "Number", type: T.int},
    confidence: parsed.confidence,
    provenance: parsed.provenance,
  };

  const plan = planIntent(intent, caps, store, programs);
  if (plan.status !== "planned" || !plan.program) {
    return {error: plan.reason ?? "could not plan"};
  }

  return {program: plan.program, inputs: runtimeInputs};
}

export function dispatchUtterance(
  store: GraphStore,
  caps: CapabilityRegistry,
  programs: ProgramLibrary | undefined,
  utterance: string,
  providedInputs?: Value[]
): DispatchResult {
  const parsed = parseUtterance(store, utterance);

  if (parsed.kind === "fact-assert") {
    if (parsed.negated) {
      retractWorldFact(store, parsed.subject, parsed.predicate, parsed.object);
      return {status: "fact-recorded", message: `Retracted: ${parsed.subject} ${parsed.predicate} ${parsed.object}`};
    }
    const factId = assertWorldFact(store, {
      subject: parsed.subject, predicate: parsed.predicate, object: parsed.object,
      provenance: [...parsed.provenance, `cli:semantic-dispatch`]
    });
    deriveWorldFacts(store);
    return {status: "fact-recorded", factId, message: `Recorded: ${parsed.subject} ${parsed.predicate} ${parsed.object}`};
  }

  if (parsed.kind === "fact-query") {
    deriveWorldFacts(store);
    let value: JsonValue | undefined;
    switch (parsed.queryType) {
      case "object": value = queryLatestWorldFact(store, parsed.subject, parsed.predicate); break;
      case "truth": value = parsed.object ? queryWorldFactTruth(store, parsed.subject, parsed.predicate, parsed.object) : undefined; break;
      case "count": value = queryWorldFactCount(store, parsed.subject, parsed.predicate); break;
      case "set": value = queryWorldFactSet(store, parsed.subject, parsed.predicate); break;
      case "predicate-family": value = undefined; break;
    }
    if (value === undefined) return {status: "unresolved", reason: "no matching fact found"};
    return {status: "answer", value};
  }

  if (parsed.kind === "conversational") {
    return {status: "conversational", response: CONVERSATIONAL_RESPONSES[parsed.intent]};
  }

  if (parsed.kind === "capability-command") {
    const allValues = parsed.args.every(a => a.kind === "value");
    if (allValues) {
      const result = buildIntentFromCapabilityCommand(parsed, store, caps, programs);
      if ("error" in result) return {status: "unresolved", reason: result.error};
      const output = runProgram(result.program, result.inputs, caps, programs);
      return {status: "executed", value: output, program: result.program, inputs: result.inputs};
    }
    // Has input placeholders - fall through to legacy intent system which handles prompting
  }

  if (parsed.kind === "composed") {
    // Execute parts sequentially
    for (const part of parsed.parts) {
      const result = dispatchUtterance(store, caps, programs, "", providedInputs);
      if (result.status === "unresolved") return result;
    }
  }

  // Fallback to legacy intent system
  const legacy = interpretComposedIntent(utterance, store);
  return {status: "intent", interpretation: legacy};
}
