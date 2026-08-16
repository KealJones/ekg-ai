import type { Expr, ProgramBlueprint } from "../ir/blueprint.js";
import type { ProgramLibrary } from "../program-library.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";

function emitExpr(expr: Expr, caps: CapabilityRegistry, programs?: ProgramLibrary, bindings?: string[], stack: string[] = []): string {
  switch (expr.kind) {
    case "const": return JSON.stringify(expr.value);
    case "input": return bindings?.[expr.index] ?? `i${expr.index}`;
    case "call": return caps.get(expr.capabilityId).tsEmit(expr.args.map(x => emitExpr(x,caps,programs,bindings,stack)));
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

export function emitTypeScript(program: ProgramBlueprint, caps: CapabilityRegistry, programs?: ProgramLibrary): string {
  const args = program.inputs.map((_,i)=>`i${i}`).join(", ");
  return `export function run(${args}) { return ${emitExpr(program.body,caps,programs)}; }`;
}

export function executeGeneratedTypeScript(program: ProgramBlueprint, inputs: unknown[], caps: CapabilityRegistry, programs?: ProgramLibrary): unknown {
  const args = program.inputs.map((_,i)=>`i${i}`).join(", ");
  const body = `return (${emitExpr(program.body,caps,programs)});`;
  const fn = new Function(args, body);
  return fn(...inputs);
}
