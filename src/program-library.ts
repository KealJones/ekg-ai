import { canonicalBlueprintSemantics, type ProgramBlueprint } from "./ir/blueprint.js";
import type { Type } from "./ir/types.js";
import { typeEquals } from "./ir/types.js";

export interface ProgramLibrary {
  put(program: ProgramBlueprint): ProgramBlueprint;
  findEquivalent(program: ProgramBlueprint): ProgramBlueprint | undefined;
  get(id: string): ProgramBlueprint | undefined;
  all(): ProgramBlueprint[];
  compatible(inputs: Type[], output: Type): ProgramBlueprint[];
}

export class MemoryProgramLibrary implements ProgramLibrary {
  private readonly programs = new Map<string, ProgramBlueprint>();

  put(program: ProgramBlueprint): ProgramBlueprint {
    const existingById = this.programs.get(program.id);
    if (existingById) {
      this.programs.set(program.id, structuredClone(program));
      return structuredClone(program);
    }

    const equivalent = this.findEquivalent(program);
    if (equivalent) {
      // Invariant: never persist a second canonical-semantic duplicate. A caller
      // that synthesized this should record it as a retrieval/planning miss and
      // reuse the existing durable Blueprint instead.
      return equivalent;
    }

    this.programs.set(program.id, structuredClone(program));
    return structuredClone(program);
  }

  findEquivalent(program: ProgramBlueprint): ProgramBlueprint | undefined {
    const identity = canonicalBlueprintSemantics(program);
    for (const candidate of this.programs.values()) {
      if (canonicalBlueprintSemantics(candidate) === identity) return structuredClone(candidate);
    }
    return undefined;
  }

  get(id: string): ProgramBlueprint | undefined {
    const p = this.programs.get(id);
    return p ? structuredClone(p) : undefined;
  }

  all(): ProgramBlueprint[] {
    return [...this.programs.values()].map(p => structuredClone(p));
  }

  compatible(inputs: Type[], output: Type): ProgramBlueprint[] {
    return this.all().filter(p =>
      p.inputs.length === inputs.length &&
      p.inputs.every((t, i) => typeEquals(t, inputs[i]!)) &&
      typeEquals(p.output, output)
    );
  }
}
