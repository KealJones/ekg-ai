import type { Type } from "./ir/types.js";
import type { Value } from "./ir/blueprint.js";

export interface Example {
  inputs: Value[];
  output: Value;
}

export type AssertionExpr =
  | { kind: "output" }
  | { kind: "input"; index: number }
  | { kind: "const"; value: Value }
  | { kind: "call"; capabilityId: string; args: AssertionExpr[] };

export interface PropertySpec {
  id: string;
  /** Concrete generated/curated cases used to exercise the invariant. */
  cases: Value[][];
  /** Must evaluate to boolean true for every case. */
  assertion: AssertionExpr;
}

export interface TaskSpec {
  id: string;
  inputs: Type[];
  output: Type;
  examples: Example[];
  properties?: PropertySpec[];
  labels?: string[];
  family?: string;
  split?: "train" | "validation" | "test";
}
