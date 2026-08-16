import type { Expr, ProgramBlueprint, Value } from "../ir/blueprint.js";
import type { ProgramLibrary } from "../program-library.js";
import type { CapabilityRegistry } from "./capabilities.js";
import { assertValueMatchesType, validateProgram } from "../ir/validate.js";

export function evalExpr(expr: Expr, inputs: Value[], caps: CapabilityRegistry, programs?: ProgramLibrary, callStack: string[] = []): Value {
  switch (expr.kind) {
    case "const": return expr.value;
    case "input": return inputs[expr.index]!;
    case "call": {
      const cap = caps.get(expr.capabilityId);
      return cap.reference(...expr.args.map(arg => evalExpr(arg, inputs, caps, programs, callStack)));
    }
    case "program_call": {
      if (!programs) throw new Error(`Program call ${expr.programId} requires a ProgramLibrary`);
      if (callStack.includes(expr.programId)) throw new Error(`Recursive program cycle: ${[...callStack,expr.programId].join(" -> ")}`);
      const target = programs.get(expr.programId);
      if (!target) throw new Error(`Unknown learned program: ${expr.programId}`);
      const args = expr.args.map(arg => evalExpr(arg, inputs, caps, programs, callStack));
      return runProgram(target,args,caps,programs,[...callStack,expr.programId]);
    }
  }
}

export function runProgram(program: ProgramBlueprint, inputs: Value[], caps: CapabilityRegistry, programs?: ProgramLibrary, callStack: string[] = []): Value {
  if (inputs.length !== program.inputs.length) throw new Error("Input arity mismatch");
  inputs.forEach((value, i) => assertValueMatchesType(value, program.inputs[i]!, `Input ${i}`));
  validateProgram(program, caps, programs);
  const output = evalExpr(program.body, inputs, caps, programs, callStack);
  assertValueMatchesType(output, program.output, `Program ${program.id} output`);
  return output;
}
