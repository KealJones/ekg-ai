import { canonicalBlueprintSemantics, type ProgramBlueprint } from "./ir/blueprint.js";
import type { Type } from "./ir/types.js";
import type { ExecutionExperience, ExecutionExperienceSink } from "./runtime/execution-experience.js";
import { typeEquals } from "./ir/types.js";

export interface ProgramLibrary {
  put(program: ProgramBlueprint): ProgramBlueprint;
  findEquivalent(program: ProgramBlueprint): ProgramBlueprint | undefined;
  get(id: string): ProgramBlueprint | undefined;
  all(): ProgramBlueprint[];
  remove?(id: string): boolean;
  compatible(inputs: Type[], output: Type): ProgramBlueprint[];
  /** Optional durable execution-history interface used by resilient runtimes. */
  recordExperience?(experience: ExecutionExperience): void;
  experiencesFor?(subjectId: string): ExecutionExperience[];
}

export interface MemoryProgramLibraryState {
  programs: ProgramBlueprint[];
  experiences: ExecutionExperience[];
}

export class MemoryProgramLibrary implements ProgramLibrary {
  private readonly programs = new Map<string, ProgramBlueprint>();
  private readonly experience = new Map<string, ExecutionExperience[]>();
  constructor(initial?: MemoryProgramLibraryState, private readonly onChange?: () => void) {
    for (const p of initial?.programs ?? []) this.programs.set(p.id, structuredClone(p));
    for (const e of initial?.experiences ?? []) {
      const xs=this.experience.get(e.subjectId)??[];
      xs.push(structuredClone(e));
      this.experience.set(e.subjectId,xs);
    }
  }

  put(program: ProgramBlueprint): ProgramBlueprint {
    const existingById = this.programs.get(program.id);
    if (existingById) {
      this.programs.set(program.id, structuredClone(program));
      this.onChange?.();
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
    this.onChange?.();
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

  remove(id: string): boolean { const removed=this.programs.delete(id); if(removed) this.onChange?.(); return removed; }

  all(): ProgramBlueprint[] {
    return [...this.programs.values()].map(p => structuredClone(p));
  }

  recordExperience(experience: ExecutionExperience): void {
    const xs=this.experience.get(experience.subjectId)??[];
    xs.push(structuredClone(experience));
    this.experience.set(experience.subjectId,xs);
    this.onChange?.();
  }

  experiencesFor(subjectId: string): ExecutionExperience[] {
    return (this.experience.get(subjectId)??[]).map(x=>structuredClone(x));
  }

  snapshot(): MemoryProgramLibraryState {
    return {
      programs:this.all(),
      experiences:[...this.experience.values()].flat().map(e=>structuredClone(e))
    };
  }

  compatible(inputs: Type[], output: Type): ProgramBlueprint[] {
    return this.all().filter(p =>
      p.inputs.length === inputs.length &&
      p.inputs.every((t, i) => typeEquals(t, inputs[i]!)) &&
      typeEquals(p.output, output)
    );
  }
}
