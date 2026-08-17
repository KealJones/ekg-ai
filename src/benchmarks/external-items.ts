import type { Value } from "../ir/blueprint.js";

export type ExternalItemAction = "ANSWER" | "ESCALATE" | "CLARIFY" | "REFUSE";

export interface ExternalFixtureSpec {
  id: string;
  input: Value;
  /** Optional source/world data consumed only by the independent reference runner. */
  world?: unknown;
}

export interface ExternalItemSource {
  corpus: string;
  recordId: string;
  license?: string;
  url?: string;
}

/**
 * Unscored item supplied by an independent producer. Gold denotations are
 * intentionally absent: EKG must never be the author of the answers it later
 * receives credit for matching.
 */
export interface ExternalHoldoutItem {
  id: string;
  primitiveId: string;
  familyId: string;
  utterance: string;
  source: ExternalItemSource;
  fixtures: ExternalFixtureSpec[];
  expectedAction: ExternalItemAction;
  provenance: string[];
}

export interface FrozenGoldFixture {
  fixtureId: string;
  expected: Value;
}

export interface FrozenGoldItem {
  itemId: string;
  primitiveId: string;
  familyId: string;
  expectedAction: ExternalItemAction;
  fixtures: FrozenGoldFixture[];
  referenceImplementationId: string;
  referenceImplementationVersion: string;
  referenceProvenance: string[];
}

export interface FrozenExternalBenchmark {
  schemaVersion: "0.3";
  createdAt: string;
  items: ExternalHoldoutItem[];
  gold: FrozenGoldItem[];
  manifestHash: string;
}

export interface ReferenceSemantics {
  id: string;
  version: string;
  provenance: string[];
  execute(item: ExternalHoldoutItem, fixture: ExternalFixtureSpec): Value;
}

function assertNonEmpty(value:string,label:string):void {
  if(!value.trim()) throw new Error(`${label} must be non-empty`);
}

export function validateExternalHoldoutItem(item:ExternalHoldoutItem):void {
  assertNonEmpty(item.id,"item id");
  assertNonEmpty(item.primitiveId,"primitive id");
  assertNonEmpty(item.familyId,"family id");
  assertNonEmpty(item.utterance,"utterance");
  assertNonEmpty(item.source.corpus,"source corpus");
  assertNonEmpty(item.source.recordId,"source record id");
  if(item.provenance.length===0) throw new Error(`item ${item.id} requires provenance`);
  if(item.fixtures.length<3) throw new Error(`item ${item.id} requires at least 3 fixtures`);
  const fixtureIds=new Set<string>();
  for(const fixture of item.fixtures){
    assertNonEmpty(fixture.id,"fixture id");
    if(fixtureIds.has(fixture.id)) throw new Error(`duplicate fixture id ${fixture.id} in ${item.id}`);
    fixtureIds.add(fixture.id);
  }
}

function stable(value:unknown):string {
  if(value===null || typeof value!=="object") return JSON.stringify(value);
  if(Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj=value as Record<string,unknown>;
  return `{${Object.keys(obj).sort().map(k=>`${JSON.stringify(k)}:${stable(obj[k])}`).join(",")}}`;
}

function fnv1a64(text:string):string {
  let hash=0xcbf29ce484222325n;
  const prime=0x100000001b3n;
  for(const byte of new TextEncoder().encode(text)){ hash^=BigInt(byte); hash=BigInt.asUintN(64,hash*prime); }
  return hash.toString(16).padStart(16,"0");
}

export function benchmarkManifestHash(items:ExternalHoldoutItem[],gold:FrozenGoldItem[]):string {
  // Integrity fingerprint only; not a cryptographic commitment. Keeps the core dependency-free.
  return `fnv1a64:${fnv1a64(stable({items,gold}))}`;
}

/**
 * Runs independent executable reference semantics to derive immutable gold.
 * The reference implementation is injected and provenance-tagged; it is not a
 * learner plan, Blueprint, Teacher response, or EKG semantic frame.
 */
export function deriveReferenceGold(items:ExternalHoldoutItem[],reference:ReferenceSemantics):FrozenGoldItem[]{
  if(!reference.id.trim() || !reference.version.trim() || reference.provenance.length===0) throw new Error("reference semantics require id, version, and provenance");
  const ids=new Set<string>();
  return items.map(item=>{
    validateExternalHoldoutItem(item);
    if(ids.has(item.id)) throw new Error(`duplicate item id: ${item.id}`);
    ids.add(item.id);
    return {
      itemId:item.id,
      primitiveId:item.primitiveId,
      familyId:item.familyId,
      expectedAction:item.expectedAction,
      fixtures:item.fixtures.map(fixture=>({fixtureId:fixture.id,expected:reference.execute(structuredClone(item),structuredClone(fixture))})),
      referenceImplementationId:reference.id,
      referenceImplementationVersion:reference.version,
      referenceProvenance:[...reference.provenance]
    };
  });
}

/** Freeze once, before scored evaluation. Hash covers both external language and derived gold. */
export function freezeExternalBenchmark(items:ExternalHoldoutItem[],reference:ReferenceSemantics,createdAt:string):FrozenExternalBenchmark{
  const cloned=structuredClone(items);
  const gold=deriveReferenceGold(cloned,reference);
  return {schemaVersion:"0.3",createdAt,items:cloned,gold,manifestHash:benchmarkManifestHash(cloned,gold)};
}

export function verifyFrozenExternalBenchmark(benchmark:FrozenExternalBenchmark):boolean {
  if(benchmark.schemaVersion!=="0.3") return false;
  try { for(const item of benchmark.items) validateExternalHoldoutItem(item); }
  catch { return false; }
  const itemIds=new Set(benchmark.items.map(x=>x.id));
  if(itemIds.size!==benchmark.items.length || benchmark.gold.length!==benchmark.items.length) return false;
  if(benchmark.gold.some(g=>!itemIds.has(g.itemId) || g.fixtures.length<3)) return false;
  return benchmark.manifestHash===benchmarkManifestHash(benchmark.items,benchmark.gold);
}

/**
 * Guardrail for independence: scored imports must carry external provenance and
 * may not claim EKG/Teacher/self authorship. This is intentionally conservative.
 */
export function auditExternalProvenance(items:ExternalHoldoutItem[]):{ok:boolean;violations:string[]}{
  const violations:string[]=[];
  const forbidden=/\b(ekg|teacher|self[- ]?authored|implementing agent|sol)\b/i;
  for(const item of items){
    const evidence=[item.source.corpus,item.source.recordId,...item.provenance].join(" ");
    if(forbidden.test(evidence)) violations.push(`${item.id}: provenance is not independent`);
    if(!item.source.corpus.trim() || !item.source.recordId.trim()) violations.push(`${item.id}: missing external source identity`);
  }
  return {ok:violations.length===0,violations};
}
