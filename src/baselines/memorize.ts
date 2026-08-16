import type { ProgramBlueprint } from "../ir/blueprint.js";
import type { TaskSpec } from "../task.js";
import { stableTaskFingerprint } from "../benchmarks/fingerprint.js";

/**
 * Deliberately dumb control: stores a complete solution against the exact
 * machine-grounded task specification. It does not adapt or compose.
 */
export class MemorizeBaseline {
  private readonly solutions = new Map<string, ProgramBlueprint>();

  remember(task: TaskSpec, program: ProgramBlueprint): void {
    this.solutions.set(stableTaskFingerprint(task), structuredClone(program));
  }

  recall(task: TaskSpec): ProgramBlueprint | undefined {
    const value = this.solutions.get(stableTaskFingerprint(task));
    return value ? structuredClone(value) : undefined;
  }

  get size(): number { return this.solutions.size; }
}
