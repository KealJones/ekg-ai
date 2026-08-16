import type { Type } from "../ir/types.js";
import type { Value } from "../ir/blueprint.js";

export interface IntentSignal {
  id: string;
  concept: "Number" | "String" | "Collection" | string;
  type: Type;
  binding?: "input";
  inputIndex?: number;
  value?: Value;
  provenance: string[];
}

export interface IntentGoal {
  concept: string;
  type: Type;
}

export interface IntentConstraint {
  relation: string;
  args: string[];
  provenance: string[];
}

export interface Intent {
  id: string;
  rawUtterance: string;
  signals: IntentSignal[];
  goal: IntentGoal;
  constraints: IntentConstraint[];
  confidence: number;
  provenance: string[];
}

export type IntentInterpretation =
  | {status:"resolved"; intent:Intent; alternatives:Intent[]}
  | {status:"clarify"; alternatives:Intent[]; question:string}
  | {status:"teacher"; reason:string; rawUtterance:string};
