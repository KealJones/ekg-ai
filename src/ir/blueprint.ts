import type { Type } from "./types.js";

export type Value = boolean | number | string | Value[];

export type Expr =
  | { kind: "const"; value: Value; type: Type }
  | { kind: "input"; index: number; type: Type }
  | { kind: "call"; capabilityId: string; args: Expr[]; type: Type }
  | { kind: "program_call"; programId: string; args: Expr[]; type: Type };

export interface ProgramBlueprint {
  id: string;
  name?: string;
  inputs: Type[];
  output: Type;
  body: Expr;
  properties?: string[];
  provenance?: string[];
}

export function stableBlueprintJson(program: ProgramBlueprint): string {
  return JSON.stringify(program);
}

/**
 * Canonical identity for executable semantics. Human-facing identity, provenance,
 * and names are intentionally excluded: two independently-created Blueprints
 * with the same typed executable meaning are the same durable program.
 */
export function canonicalBlueprintSemantics(program: ProgramBlueprint): string {
  return JSON.stringify({
    inputs: program.inputs,
    output: program.output,
    body: program.body,
    properties: [...(program.properties ?? [])].sort()
  });
}
