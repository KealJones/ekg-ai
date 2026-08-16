import type { Expr, ProgramBlueprint } from "../ir/blueprint.js";
import { collectSubexpressions } from "../search/synthesizer.js";

export interface AbstractionCandidate {
  key: string;
  expression: Expr;
  occurrences: number;
  programIds: string[];
  nodeCount: number;
  /** Rough signal only; v0 promotion must still be benchmarked. */
  recurrenceScore: number;
}

export function expressionNodeCount(expr: Expr): number {
  if (expr.kind === "const" || expr.kind === "input") return 1;
  return 1 + expr.args.reduce((n,a)=>n+expressionNodeCount(a),0);
}

function structuralKey(expr: Expr): string { return JSON.stringify(expr); }

/**
 * v0 miner: exact canonical repeated executable subexpressions.
 * This intentionally does NOT pretend to solve parameterized anti-unification yet.
 */
export function mineRepeatedSubexpressions(programs: ProgramBlueprint[], minPrograms = 2): AbstractionCandidate[] {
  const index = new Map<string,{expr:Expr; programs:Set<string>; occurrences:number}>();
  for (const program of programs) {
    for (const expr of collectSubexpressions(program.body)) {
      if (expr.kind === "input" || expr.kind === "const") continue;
      const key=structuralKey(expr);
      const entry=index.get(key) ?? {expr:structuredClone(expr),programs:new Set<string>(),occurrences:0};
      entry.programs.add(program.id);
      entry.occurrences++;
      index.set(key,entry);
    }
  }
  return [...index.entries()]
    .filter(([,x])=>x.programs.size>=minPrograms)
    .map(([key,x])=>{
      const nodeCount=expressionNodeCount(x.expr);
      return {key,expression:x.expr,occurrences:x.occurrences,programIds:[...x.programs],nodeCount,recurrenceScore:x.programs.size*nodeCount};
    })
    .sort((a,b)=>b.recurrenceScore-a.recurrenceScore || b.occurrences-a.occurrences);
}
