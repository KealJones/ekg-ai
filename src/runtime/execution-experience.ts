import type { Expr, ProgramBlueprint, Value } from "../ir/blueprint.js";
import type { Type } from "../ir/types.js";

export type ExecutionSubjectKind = "learned-program" | "host-capability";
export type ExecutionExperienceStatus = "success" | "failure";

/**
 * Durable evidence from actually using a piece of the system. These traces are
 * part of lived experience: they are retained whether the call succeeded or
 * failed and may later be used for diagnosis/reconstruction.
 */
export interface ExecutionExperience {
  id?: string;
  subjectKind: ExecutionSubjectKind;
  subjectId: string;
  status: ExecutionExperienceStatus;
  inputs: Value[];
  output?: Value;
  error?: string;
  inputTypes: Type[];
  outputType: Type;
  callerProgramId?: string;
  callerBlueprintSnapshot?: ProgramBlueprint;
  callSite?: Expr;
  callStack: string[];
  timestamp: string;
}

export interface ExecutionExperienceSink {
  recordExperience(experience: ExecutionExperience): void;
  experiencesFor(subjectId: string): ExecutionExperience[];
}
