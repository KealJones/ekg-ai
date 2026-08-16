import type { Expr, ProgramBlueprint } from "../ir/blueprint.js";
import type { Type } from "../ir/types.js";
import type { AbstractionCandidate } from "./abstraction-miner.js";
import { expressionNodeCount } from "./abstraction-miner.js";
import { typeEquals } from "../ir/types.js";

export interface AbstractionPromotionDecision {
  candidateKey: string;
  promoted: boolean;
  reason: "promoted" | "insufficient-independent-programs" | "no-compression-gain" | "heldout-regression" | "no-heldout-utility";
  independentPrograms: number;
  compressionGainNodes: number;
  heldoutSearchSavings: number;
  baselineSolved: number;
  promotedSolved: number;
}

export interface PromotionEvidence {
  /** Search candidates explored on the exact same held-out tasks without the abstraction. */
  baselineCandidates: number;
  /** Search candidates explored on the exact same held-out tasks with the abstraction available. */
  promotedCandidates: number;
  /** Number of held-out tasks solved without the abstraction. */
  baselineSolved?: number;
  /** Number of held-out tasks solved with the abstraction. */
  promotedSolved?: number;
}

function abstractionDefinitionCost(candidate: AbstractionCandidate): number {
  // One node for the named program plus the canonical body. This is deliberately
  // conservative and easy to reason about; later MDL work can replace it.
  return 1 + expressionNodeCount(candidate.expression);
}

export function estimateCompressionGain(candidate: AbstractionCandidate): number {
  const bodyNodes = expressionNodeCount(candidate.expression);
  const rawCost = candidate.occurrences * bodyNodes;
  // Each rewritten occurrence becomes one program_call node.
  const rewrittenCost = candidate.occurrences;
  return rawCost - (abstractionDefinitionCost(candidate) + rewrittenCost);
}

export function decideAbstractionPromotion(
  candidate: AbstractionCandidate,
  evidence: PromotionEvidence,
  minIndependentPrograms = 2,
): AbstractionPromotionDecision {
  const independentPrograms = new Set(candidate.programIds).size;
  const compressionGainNodes = estimateCompressionGain(candidate);
  const heldoutSearchSavings = evidence.baselineCandidates - evidence.promotedCandidates;
  const baselineSolved = evidence.baselineSolved ?? 0;
  const promotedSolved = evidence.promotedSolved ?? baselineSolved;

  const result=(promoted:boolean,reason:AbstractionPromotionDecision["reason"]):AbstractionPromotionDecision=>({
    candidateKey:candidate.key,promoted,reason,independentPrograms,compressionGainNodes,heldoutSearchSavings,baselineSolved,promotedSolved
  });

  if (independentPrograms < minIndependentPrograms) return result(false,"insufficient-independent-programs");
  if (compressionGainNodes <= 0) return result(false,"no-compression-gain");
  if (promotedSolved < baselineSolved) return result(false,"heldout-regression");
  // Improvement can be either strictly more solved tasks OR equal solves with lower search cost.
  if (promotedSolved === baselineSolved && heldoutSearchSavings <= 0) return result(false,"no-heldout-utility");
  return result(true,"promoted");
}

function inputIndices(expr: Expr, out = new Set<number>()): Set<number> {
  if (expr.kind === "input") out.add(expr.index);
  if (expr.kind === "call" || expr.kind === "program_call") {
    for (const arg of expr.args) inputIndices(arg,out);
  }
  return out;
}

/**
 * v0 promotion only supports exact subexpressions whose referenced inputs form
 * a dense 0..N-1 prefix. Parameterized anti-unification is intentionally later.
 */
export function candidateToProgram(
  candidate: AbstractionCandidate,
  sourceProgram: ProgramBlueprint,
  id: string,
): ProgramBlueprint | undefined {
  const indices=[...inputIndices(candidate.expression)].sort((a,b)=>a-b);
  if (indices.some((x,i)=>x!==i)) return undefined;
  const inputs:Type[]=indices.map(i=>sourceProgram.inputs[i]!).filter(Boolean);
  if (inputs.length!==indices.length) return undefined;
  // Basic sanity: the candidate's input node declarations must agree with source types.
  const check=(expr:Expr):boolean=>{
    if(expr.kind==="input") return !!inputs[expr.index] && typeEquals(expr.type,inputs[expr.index]!);
    if(expr.kind==="call" || expr.kind==="program_call") return expr.args.every(check);
    return true;
  };
  if(!check(candidate.expression)) return undefined;
  return {
    id,
    name:`Promoted abstraction ${id}`,
    inputs,
    output:candidate.expression.type,
    body:structuredClone(candidate.expression),
    provenance:[
      `abstraction:${candidate.key}`,
      ...candidate.programIds.map(pid=>`observed-in:${pid}`),
    ],
  };
}
