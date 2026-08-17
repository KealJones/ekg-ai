import type { Value } from "../ir/blueprint.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import type { ProgramLibrary } from "../program-library.js";
import { canonicalBlueprintSemantics } from "../ir/blueprint.js";

export interface PrimitiveLesson {
  id: string;
  capabilityId: string;
  teacherInterventions: 1;
  teacherTokens: number;
  provenance: string[];
  /** Stable serialization of the semantic lesson, retained for audit. */
  payload: unknown;
}

export class PrimitiveLessonLedger {
  private readonly lessons = new Map<string, PrimitiveLesson>();
  teach(lesson: PrimitiveLesson): void {
    if (lesson.teacherInterventions !== 1) throw new Error("v0.3 primitive lessons require exactly one Teacher intervention");
    if (!Number.isInteger(lesson.teacherTokens) || lesson.teacherTokens < 0) throw new Error("teacherTokens must be a non-negative integer");
    if (this.lessons.has(lesson.capabilityId)) throw new Error(`capability already taught: ${lesson.capabilityId}`);
    this.lessons.set(lesson.capabilityId, structuredClone(lesson));
  }
  get(capabilityId: string): PrimitiveLesson | undefined {
    const value=this.lessons.get(capabilityId); return value?structuredClone(value):undefined;
  }
  all(): PrimitiveLesson[] { return [...this.lessons.values()].map(x=>structuredClone(x)); }
  teacherTokens(): number { return this.all().reduce((n,x)=>n+x.teacherTokens,0); }
}

export interface DenotationFixture {
  id: string;
  expected: Value;
  run: () => Value;
}

export interface MultiFixtureGrade {
  correct: boolean;
  fixtureCount: number;
  passed: number;
  failures: { fixtureId:string; expected:Value; actual:Value }[];
}

/** v0.3 answer credit is all-or-nothing across at least three deterministic fixtures. */
export function gradeDenotations(fixtures: DenotationFixture[]): MultiFixtureGrade {
  if (fixtures.length < 3) throw new Error("v0.3 scored items require at least 3 fixtures");
  const failures:MultiFixtureGrade["failures"]=[];
  for(const fixture of fixtures){
    const actual=fixture.run();
    if(JSON.stringify(actual)!==JSON.stringify(fixture.expected)) failures.push({fixtureId:fixture.id,expected:fixture.expected,actual});
  }
  return {correct:failures.length===0,fixtureCount:fixtures.length,passed:fixtures.length-failures.length,failures};
}

export interface DurableStateMeasurement {
  programs: number;
  canonicalProgramBytes: number;
  canonicalProgramNodes: number;
  uniqueCanonicalPrograms: number;
}

function nodeCount(value:unknown):number{
  if(value===null || typeof value!=="object") return 1;
  if(Array.isArray(value)) return 1+value.reduce((n,x)=>n+nodeCount(x),0);
  return 1+Object.values(value as Record<string,unknown>).reduce<number>((n,x)=>n+nodeCount(x),0);
}

/** Fixed-unit durable executable-state measurement for growth curves. */
export function measureDurablePrograms(library:ProgramLibrary):DurableStateMeasurement{
  const programs=library.all();
  const canonical=programs.map(canonicalBlueprintSemantics);
  return {
    programs:programs.length,
    canonicalProgramBytes:canonical.reduce((n,x)=>n+new TextEncoder().encode(x).length,0),
    canonicalProgramNodes:programs.reduce((n,p)=>n+nodeCount(JSON.parse(canonicalBlueprintSemantics(p))),0),
    uniqueCanonicalPrograms:new Set(canonical).size,
  };
}

export interface CapabilityAbsenceAudit { capabilityId:string; absent:boolean; matches:string[]; }

/** Mechanical checkpoint-0 guard: selected held-out capability must not already exist by id/sub-id. */
export function auditCapabilityAbsent(registry:CapabilityRegistry, capabilityId:string):CapabilityAbsenceAudit{
  const needle=capabilityId.toLowerCase();
  const matches=registry.all().map(c=>c.id).filter(id=>id.toLowerCase()===needle || id.toLowerCase().includes(needle) || needle.includes(id.toLowerCase()));
  return {capabilityId,absent:matches.length===0,matches};
}

export interface TeacherOffGuard { teacherCalls:number; assertOff():void; recordCall():never; }
export function teacherOffGuard():TeacherOffGuard{
  let calls=0;
  return {
    get teacherCalls(){return calls;},
    assertOff(){if(calls!==0) throw new Error(`Teacher-OFF violation: ${calls} call(s)`);},
    recordCall(){calls++; throw new Error("Teacher endpoint is disabled during scored v0.3 evaluation");}
  };
}
