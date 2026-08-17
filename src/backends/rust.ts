import type { Expr, ProgramBlueprint } from "../ir/blueprint.js";
import type { Type } from "../ir/types.js";
import type { ProgramLibrary } from "../program-library.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";

function rustType(t: Type): string {
  switch (t.kind) {
    case "null": return "()";
    case "int": return "i64";
    case "bool": return "bool";
    case "string": return "String";
    case "json": return "serde_json::Value";
    case "list": return `Vec<${rustType(t.item)}>`;
  }
}
function emitExpr(expr: Expr, caps: CapabilityRegistry, programs?: ProgramLibrary, bindings?: string[], stack: string[] = []): string {
  switch (expr.kind) {
    case "const":
      if (typeof expr.value === "string") return `String::from(${JSON.stringify(expr.value)})`;
      return JSON.stringify(expr.value);
    case "input": return bindings?.[expr.index] ?? `i${expr.index}`;
    case "call": return caps.get(expr.capabilityId).rustEmit(expr.args.map(x => emitExpr(x,caps,programs,bindings,stack)));
    case "program_call": {
      if (!programs) throw new Error(`Program call ${expr.programId} requires a ProgramLibrary`);
      if (stack.includes(expr.programId)) throw new Error(`Recursive program cycle: ${[...stack,expr.programId].join(" -> ")}`);
      const target=programs.get(expr.programId);
      if (!target) throw new Error(`Unknown learned program: ${expr.programId}`);
      const args=expr.args.map(x=>emitExpr(x,caps,programs,bindings,stack));
      return `(${emitExpr(target.body,caps,programs,args,[...stack,expr.programId])})`;
    }
  }
}
export function emitRust(program: ProgramBlueprint, caps: CapabilityRegistry, programs?: ProgramLibrary): string {
  const args = program.inputs.map((t,i)=>`i${i}: ${rustType(t)}`).join(", ");
  return `pub fn run(${args}) -> ${rustType(program.output)} {\n    ${emitExpr(program.body,caps,programs)}\n}\n`;
}
