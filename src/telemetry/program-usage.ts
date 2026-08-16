import type { Episode } from "../episode.js";
import type { ProgramBlueprint, Expr } from "../ir/blueprint.js";

export interface ProgramUsageStats {
  programId: string;
  selectedUses: number;
  calledByBlueprints: number;
  parentProgramIds: string[];
  taskUses: number;
  successes: number;
  zeroSearchRuns: number;
}

function calls(expr: Expr): string[] {
  if (expr.kind === "program_call") return [expr.programId,...expr.args.flatMap(calls)];
  if (expr.kind === "call") return expr.args.flatMap(calls);
  return [];
}

/** Local v0 precursor to contextual/global centrality telemetry. */
export function summarizeProgramUsage(programs: ProgramBlueprint[], episodes: Episode[]): ProgramUsageStats[] {
  const ids=new Set(programs.map(p=>p.id));
  const parents=new Map<string,Set<string>>();
  for(const p of programs) for(const child of new Set(calls(p.body))) {
    const set=parents.get(child)??new Set<string>(); set.add(p.id); parents.set(child,set);
  }
  const results:ProgramUsageStats[]=[];
  for(const id of ids){
    const selected=episodes.filter(e=>e.selectedProgramId===id);
    const ps=[...(parents.get(id)??new Set<string>())];
    results.push({
      programId:id,
      selectedUses:selected.length,
      calledByBlueprints:ps.length,
      parentProgramIds:ps,
      taskUses:selected.length,
      successes:selected.filter(e=>e.success).length,
      zeroSearchRuns:selected.filter(e=>e.decision==="RUN" && (e.searchCandidatesExplored??0)===0).length,
    });
  }
  return results.sort((a,b)=>(b.selectedUses+b.calledByBlueprints)-(a.selectedUses+a.calledByBlueprints));
}
