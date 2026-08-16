import type { ProgramBlueprint, Value } from "./ir/blueprint.js";
import type { ProgramLibrary } from "./program-library.js";
import type { CapabilityRegistry } from "./runtime/capabilities.js";
import { runProgram } from "./runtime/interpreter.js";
import type { AssertionExpr, TaskSpec } from "./task.js";

export interface TaskEvaluation {
  passed: boolean;
  examplePasses: number;
  exampleCount: number;
  propertyCasePasses: number;
  propertyCaseCount: number;
  failedPropertyIds: string[];
}

function evalAssertion(expr: AssertionExpr, inputs: Value[], output: Value, caps: CapabilityRegistry): Value {
  switch (expr.kind) {
    case "output": return output;
    case "input": return inputs[expr.index]!;
    case "const": return expr.value;
    case "call": {
      const cap = caps.get(expr.capabilityId);
      return cap.reference(...expr.args.map(a => evalAssertion(a,inputs,output,caps)));
    }
  }
}

export function evaluateTask(program: ProgramBlueprint, task: TaskSpec, caps: CapabilityRegistry, programs?: ProgramLibrary): TaskEvaluation {
  let examplePasses = 0;
  for (const ex of task.examples) {
    if (Object.is(runProgram(program,ex.inputs,caps,programs),ex.output)) examplePasses++;
  }

  let propertyCasePasses=0, propertyCaseCount=0;
  const failedPropertyIds=new Set<string>();
  for (const property of task.properties ?? []) {
    for (const inputs of property.cases) {
      propertyCaseCount++;
      const output=runProgram(program,inputs,caps,programs);
      const result=evalAssertion(property.assertion,inputs,output,caps);
      if (result===true) propertyCasePasses++;
      else failedPropertyIds.add(property.id);
    }
  }

  return {passed:examplePasses===task.examples.length && propertyCasePasses===propertyCaseCount,examplePasses,exampleCount:task.examples.length,propertyCasePasses,propertyCaseCount,failedPropertyIds:[...failedPropertyIds]};
}
