export type EntityKind = "concept" | "lexeme" | "sense" | "frame" | "grammar_rule" | "inference_rule" | "fact" | "event" | "program" | "capability" | "type" | "goal" | "episode" | "test" | "state_model" | "teaching_trace" | "impasse" | "question" | "hypothesis" | "experiment" | "conclusion" | "question_strategy" | "utility_evidence";
export interface Entity { id: string; kind: EntityKind; labels?: string[]; attrs?: Record<string, unknown>; }
export interface Relation { id: string; kind: string; from: string; to: string; confidence?: number; }

export interface GraphStore {
  putEntity(entity: Entity): void;
  putRelation(relation: Relation): void;
  getEntity(id: string): Entity | undefined;
  outgoing(id: string, kind?: string): Relation[];
  incoming(id: string, kind?: string): Relation[];
  relationsByKind(kind: string): Relation[];
  entitiesByKind(kind: EntityKind): Entity[];
  snapshot(): MemoryGraphState;
  sandbox?(): GraphStore;
}

export interface MemoryGraphState { entities: Entity[]; relations: Relation[]; }

export class MemoryGraphStore implements GraphStore {
  private readonly entities = new Map<string, Entity>();
  private readonly relations = new Map<string, Relation>();
  constructor(initial?: MemoryGraphState, private readonly onChange?: () => void) {
    for (const e of initial?.entities ?? []) this.entities.set(e.id, structuredClone(e));
    for (const r of initial?.relations ?? []) this.relations.set(r.id, structuredClone(r));
  }
  putEntity(e: Entity): void { this.entities.set(e.id, structuredClone(e)); this.onChange?.(); }
  putRelation(r: Relation): void {
    if (!this.entities.has(r.from) || !this.entities.has(r.to)) throw new Error(`Dangling relation ${r.id}: endpoints must exist`);
    if (r.confidence !== undefined && (r.confidence < 0 || r.confidence > 1)) throw new Error(`Invalid confidence for relation ${r.id}`);
    this.relations.set(r.id, structuredClone(r));
    this.onChange?.();
  }
  getEntity(id: string): Entity | undefined { const x=this.entities.get(id); return x && structuredClone(x); }
  outgoing(id: string, kind?: string): Relation[] {
    return [...this.relations.values()].filter(r=>r.from===id && (!kind || r.kind===kind)).map(r => structuredClone(r));
  }
  incoming(id: string, kind?: string): Relation[] {
    return [...this.relations.values()].filter(r=>r.to===id && (!kind || r.kind===kind)).map(r => structuredClone(r));
  }
  relationsByKind(kind: string): Relation[] {
    return [...this.relations.values()].filter(r=>r.kind===kind).map(r => structuredClone(r));
  }
  entitiesByKind(kind: EntityKind): Entity[] { return [...this.entities.values()].filter(e=>e.kind===kind).map(e => structuredClone(e)); }
  snapshot(): MemoryGraphState {
    return {
      entities:[...this.entities.values()].map(e=>structuredClone(e)),
      relations:[...this.relations.values()].map(r=>structuredClone(r))
    };
  }
  sandbox(): GraphStore { return new MemoryGraphStore(this.snapshot()); }
}
