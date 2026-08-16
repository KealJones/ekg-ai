import type { TaskSpec } from "../task.js";

/** Stable identity for the actual grounded task, intentionally excluding id/labels/split. */
export function stableTaskFingerprint(task: TaskSpec): string {
  return JSON.stringify({
    inputs: task.inputs,
    output: task.output,
    examples: task.examples,
    properties: task.properties ?? [],
  });
}
