import { createRequire } from 'node:module';
import type { Entity, EntityKind, GraphStore, Relation } from './graph.js';

export interface LadybugQueryResultLike {
  getAllSync(): Record<string, unknown>[];
  close?(): void;
}

export interface LadybugConnectionLike {
  querySync(cypher: string): LadybugQueryResultLike | LadybugQueryResultLike[];
  close?(): void;
}

export interface LadybugDatabaseLike { close?(): void; }

export interface LadybugModuleLike {
  Database: new (path?: string) => LadybugDatabaseLike;
  Connection: new (database: LadybugDatabaseLike) => LadybugConnectionLike;
}

export interface LadybugOpenOptions {
  /** Omit for an in-memory database; provide a path for durable on-disk cognition. */
  path?: string;
  /** Injection seam used by tests and alternate host adapters. */
  module?: LadybugModuleLike;
  initializeSchema?: boolean;
}

const require = createRequire(import.meta.url);

function loadLadybugModule(): LadybugModuleLike {
  try {
    return require('@ladybugdb/core') as LadybugModuleLike;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `LadybugDB native module is not installed. Run \"npm install @ladybugdb/core\" in this environment. (${detail})`,
    );
  }
}

function asRows(result: LadybugQueryResultLike | LadybugQueryResultLike[]): Record<string, unknown>[] {
  const results = Array.isArray(result) ? result : [result];
  const rows: Record<string, unknown>[] = [];
  for (const item of results) {
    rows.push(...item.getAllSync());
    item.close?.();
  }
  return rows;
}

/**
 * Convert JS values to Cypher literals. This is also the fallback parameter
 * binder for the synchronous Node API, whose documented public surface is
 * querySync()/getAllSync(). Keeping binding here makes GraphStore independent
 * from whichever prepared-statement API a future Ladybug release exposes.
 */
export function ladybugCypherLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Cannot bind non-finite number to Cypher: ${value}`);
    return String(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(ladybugCypherLiteral).join(',')}]`;
  throw new Error(`Unsupported Ladybug Cypher parameter type: ${typeof value}`);
}

/** Replace $name parameters only outside quoted strings/backtick identifiers. */
export function bindLadybugCypher(cypher: string, params: Record<string, unknown> = {}): string {
  let out = '';
  let i = 0;
  let quote: 'single' | 'double' | 'backtick' | undefined;
  while (i < cypher.length) {
    const ch = cypher[i]!;
    if (quote) {
      out += ch;
      if ((quote === 'single' && ch === "'") || (quote === 'double' && ch === '"') || (quote === 'backtick' && ch === '`')) {
        quote = undefined;
      } else if (ch === '\\' && quote !== 'backtick' && i + 1 < cypher.length) {
        out += cypher[++i]!;
      }
      i++;
      continue;
    }
    if (ch === "'") { quote = 'single'; out += ch; i++; continue; }
    if (ch === '"') { quote = 'double'; out += ch; i++; continue; }
    if (ch === '`') { quote = 'backtick'; out += ch; i++; continue; }
    if (ch === '$' && /[A-Za-z_]/.test(cypher[i + 1] ?? '')) {
      let j = i + 2;
      while (j < cypher.length && /[A-Za-z0-9_]/.test(cypher[j]!)) j++;
      const name = cypher.slice(i + 1, j);
      if (!(name in params)) throw new Error(`Missing Cypher parameter $${name}`);
      out += ladybugCypherLiteral(params[name]);
      i = j;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

const encode = (x: unknown) => JSON.stringify(x ?? null);
const parseJson = <T>(x: unknown, fallback: T): T => {
  try { return typeof x === 'string' ? JSON.parse(x) as T : fallback; } catch { return fallback; }
};

function toEntity(row: Record<string, unknown>): Entity | undefined {
  const id = row.id;
  const kind = row.kind;
  if (typeof id !== 'string' || typeof kind !== 'string') return undefined;
  return {
    id,
    kind: kind as EntityKind,
    labels: parseJson(row.labelsJson, [] as string[]),
    attrs: parseJson(row.attrsJson, {} as Record<string, unknown>),
  };
}

function toRelation(row: Record<string, unknown>): Relation | undefined {
  const { id, kind, from, to, confidence } = row;
  if (![id, kind, from, to].every(x => typeof x === 'string')) return undefined;
  return {
    id: id as string,
    kind: kind as string,
    from: from as string,
    to: to as string,
    confidence: typeof confidence === 'number' ? confidence : undefined,
  };
}

/**
 * Preferred grown-up EKG brain: embedded, durable, synchronous property graph.
 * EKG semantics remain GraphStore semantics; Ladybug is a host realization.
 */
export class LadybugGraphStore implements GraphStore {
  readonly database: LadybugDatabaseLike;
  readonly connection: LadybugConnectionLike;

  static open(options: LadybugOpenOptions = {}): LadybugGraphStore {
    const module = options.module ?? loadLadybugModule();
    const database = options.path === undefined ? new module.Database() : new module.Database(options.path);
    const connection = new module.Connection(database);
    return new LadybugGraphStore(database, connection, options.initializeSchema !== false);
  }

  constructor(database: LadybugDatabaseLike, connection: LadybugConnectionLike, initializeSchema = true) {
    this.database = database;
    this.connection = connection;
    if (initializeSchema) this.ensureSchema();
  }

  private query(cypher: string, params: Record<string, unknown> = {}): Record<string, unknown>[] {
    return asRows(this.connection.querySync(bindLadybugCypher(cypher, params)));
  }

  ensureSchema(): void {
    this.query('CREATE NODE TABLE IF NOT EXISTS EKGEntity(id STRING PRIMARY KEY, kind STRING, labelsJson STRING, attrsJson STRING, subjectId STRING, status STRING)');
    this.query('CREATE REL TABLE IF NOT EXISTS EKG_RELATION(FROM EKGEntity TO EKGEntity, id STRING, kind STRING, confidence DOUBLE)');
  }

  putEntity(entity: Entity): void {
    this.query(
      'MERGE (e:EKGEntity {id:$id}) ON CREATE SET e.kind=$kind, e.labelsJson=$labelsJson, e.attrsJson=$attrsJson, e.subjectId=$subjectId, e.status=$status ON MATCH SET e.kind=$kind, e.labelsJson=$labelsJson, e.attrsJson=$attrsJson, e.subjectId=$subjectId, e.status=$status',
      {
        id: entity.id,
        kind: entity.kind,
        labelsJson: encode(entity.labels ?? []),
        attrsJson: encode(entity.attrs ?? {}),
        subjectId: typeof entity.attrs?.subjectId === 'string' ? entity.attrs.subjectId : null,
        status: typeof entity.attrs?.status === 'string' ? entity.attrs.status : null,
      },
    );
  }

  putRelation(relation: Relation): void {
    if (!this.getEntity(relation.from) || !this.getEntity(relation.to)) {
      throw new Error(`Dangling relation ${relation.id}: endpoints must exist`);
    }
    if (relation.confidence !== undefined && (relation.confidence < 0 || relation.confidence > 1)) {
      throw new Error(`Invalid confidence for relation ${relation.id}`);
    }
    this.query(
      'MATCH (a:EKGEntity),(b:EKGEntity) WHERE a.id=$from AND b.id=$to MERGE (a)-[r:EKG_RELATION {id:$id}]->(b) ON CREATE SET r.kind=$kind, r.confidence=$confidence ON MATCH SET r.kind=$kind, r.confidence=$confidence',
      { id: relation.id, kind: relation.kind, from: relation.from, to: relation.to, confidence: relation.confidence ?? null },
    );
  }

  getEntity(id: string): Entity | undefined {
    return this.query(
      'MATCH (e:EKGEntity) WHERE e.id=$id RETURN e.id AS id,e.kind AS kind,e.labelsJson AS labelsJson,e.attrsJson AS attrsJson LIMIT 1',
      { id },
    ).map(toEntity).find((x): x is Entity => !!x);
  }

  outgoing(id: string, kind?: string): Relation[] {
    const where = kind === undefined ? 'a.id=$id' : 'a.id=$id AND r.kind=$kind';
    return this.query(
      `MATCH (a:EKGEntity)-[r:EKG_RELATION]->(b:EKGEntity) WHERE ${where} RETURN r.id AS id,r.kind AS kind,a.id AS from,b.id AS to,r.confidence AS confidence`,
      { id, kind },
    ).map(toRelation).filter((x): x is Relation => !!x);
  }

  incoming(id: string, kind?: string): Relation[] {
    const where = kind === undefined ? 'b.id=$id' : 'b.id=$id AND r.kind=$kind';
    return this.query(
      `MATCH (a:EKGEntity)-[r:EKG_RELATION]->(b:EKGEntity) WHERE ${where} RETURN r.id AS id,r.kind AS kind,a.id AS from,b.id AS to,r.confidence AS confidence`,
      { id, kind },
    ).map(toRelation).filter((x): x is Relation => !!x);
  }

  relationsByKind(kind: string): Relation[] {
    return this.query(
      'MATCH (a:EKGEntity)-[r:EKG_RELATION]->(b:EKGEntity) WHERE r.kind=$kind RETURN r.id AS id,r.kind AS kind,a.id AS from,b.id AS to,r.confidence AS confidence',
      { kind },
    ).map(toRelation).filter((x): x is Relation => !!x);
  }

  entitiesByKind(kind: EntityKind): Entity[] {
    return this.query(
      'MATCH (e:EKGEntity) WHERE e.kind=$kind RETURN e.id AS id,e.kind AS kind,e.labelsJson AS labelsJson,e.attrsJson AS attrsJson',
      { kind },
    ).map(toEntity).filter((x): x is Entity => !!x);
  }

  allEntities(): Entity[] {
    return this.query('MATCH (e:EKGEntity) RETURN e.id AS id,e.kind AS kind,e.labelsJson AS labelsJson,e.attrsJson AS attrsJson')
      .map(toEntity).filter((x): x is Entity => !!x);
  }

  allRelations(): Relation[] {
    return this.query('MATCH (a:EKGEntity)-[r:EKG_RELATION]->(b:EKGEntity) RETURN r.id AS id,r.kind AS kind,a.id AS from,b.id AS to,r.confidence AS confidence')
      .map(toRelation).filter((x): x is Relation => !!x);
  }

  cypher(command: string, params: Record<string, unknown> = {}): Record<string, unknown>[] {
    return this.query(command, params);
  }

  clear(): void { this.query('MATCH (n:EKGEntity) DETACH DELETE n'); }

  close(): void {
    this.connection.close?.();
    this.database.close?.();
  }
}

/** Search-v2 priors mined with graph-native Cypher from durable execution experience. */
export function ladybugOperationWeights(store: LadybugGraphStore, operationIds: string[]): Record<string, number> {
  const wanted = new Set(operationIds);
  const stats = new Map<string, { success: number; failure: number }>();
  const rows = store.cypher(
    'MATCH (e:EKGEntity) WHERE e.kind="episode" AND e.subjectId IS NOT NULL RETURN e.subjectId AS subjectId,e.status AS status',
  );
  for (const row of rows) {
    const id = row.subjectId;
    const status = row.status;
    if (typeof id !== 'string' || !wanted.has(id)) continue;
    const item = stats.get(id) ?? { success: 0, failure: 0 };
    if (status === 'success') item.success++;
    else if (status === 'failure') item.failure++;
    stats.set(id, item);
  }
  return Object.fromEntries(operationIds.map(id => {
    const x = stats.get(id);
    if (!x) return [id, 1];
    return [id, Math.max(0.5, Math.min(1.75, (x.failure + 2) / (x.success + 2)))];
  }));
}
