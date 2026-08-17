import type { Expr, ProgramBlueprint, Value } from "../ir/blueprint.js";
import type { ProgramLibrary } from "../program-library.js";
import type { CapabilityRegistry } from "./capabilities.js";
import { assertValueMatchesType, validateProgram } from "../ir/validate.js";

const clone=<T>(x:T):T=>structuredClone(x);
function record(programs:ProgramLibrary|undefined, event:any):void { programs?.recordExperience?.(event); }

export function evalExpr(expr: Expr, inputs: Value[], caps: CapabilityRegistry, programs?: ProgramLibrary, callStack: string[] = [], currentProgram?:ProgramBlueprint): Value {
  switch (expr.kind) {
    case "const": return expr.value;
    case "input": return inputs[expr.index]!;
    case "call": {
      const args=expr.args.map(arg => evalExpr(arg, inputs, caps, programs, callStack,currentProgram));
      const base={subjectKind:"host-capability" as const,subjectId:expr.capabilityId,inputs:clone(args),inputTypes:expr.args.map(x=>clone(x.type)),outputType:clone(expr.type),callerProgramId:currentProgram?.id,callerBlueprintSnapshot:currentProgram?clone(currentProgram):undefined,callSite:clone(expr),callStack:[...callStack],timestamp:new Date().toISOString()};
      try{
        const cap = caps.get(expr.capabilityId);
        const output=cap.reference(...args);
        record(programs,{...base,status:"success",output:clone(output)});
        return output;
      }catch(e){record(programs,{...base,status:"failure",error:String(e)});throw e;}
    }
    case "program_call": {
      if (!programs) throw new Error(`Program call ${expr.programId} requires a ProgramLibrary`);
      if (callStack.includes(expr.programId)) throw new Error(`Recursive program cycle: ${[...callStack,expr.programId].join(" -> ")}`);
      const args=expr.args.map(arg => evalExpr(arg, inputs, caps, programs, callStack,currentProgram));
      const base={subjectKind:"learned-program" as const,subjectId:expr.programId,inputs:clone(args),inputTypes:expr.args.map(x=>clone(x.type)),outputType:clone(expr.type),callerProgramId:currentProgram?.id,callerBlueprintSnapshot:currentProgram?clone(currentProgram):undefined,callSite:clone(expr),callStack:[...callStack],timestamp:new Date().toISOString()};
      try{
        const target = programs.get(expr.programId);
        if (!target) throw new Error(`Unknown learned program: ${expr.programId}`);
        const output=runProgram(target,args,caps,programs,[...callStack,expr.programId],true);
        record(programs,{...base,status:"success",output:clone(output)});
        return output;
      }catch(e){record(programs,{...base,status:"failure",error:String(e)});throw e;}
    }
  }
}

export function runProgram(program: ProgramBlueprint, inputs: Value[], caps: CapabilityRegistry, programs?: ProgramLibrary, callStack: string[] = [], nested=false): Value {
  const topBase={subjectKind:"learned-program" as const,subjectId:program.id,inputs:clone(inputs),inputTypes:clone(program.inputs),outputType:clone(program.output),callerProgramId:undefined,callerBlueprintSnapshot:clone(program),callStack:[...callStack],timestamp:new Date().toISOString()};
  try{
    if (inputs.length !== program.inputs.length) throw new Error("Input arity mismatch");
    inputs.forEach((value, i) => assertValueMatchesType(value, program.inputs[i]!, `Input ${i}`));
    validateProgram(program, caps, programs);
    const output = evalExpr(program.body, inputs, caps, programs, callStack,program);
    assertValueMatchesType(output, program.output, `Program ${program.id} output`);
    // Top-level calls are also lived experience. Nested calls are recorded at
    // their exact program_call site to preserve surrounding caller context.
    if(!nested) record(programs,{...topBase,status:"success",output:clone(output)});
    return output;
  }catch(e){if(!nested) record(programs,{...topBase,status:"failure",error:String(e)});throw e;}
}
