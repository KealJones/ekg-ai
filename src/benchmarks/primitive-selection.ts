import type { CapabilityRegistry } from "../runtime/capabilities.js";
import type { ProgramLibrary } from "../program-library.js";
import { auditCapabilityAbsent } from "./primitive-holdout.js";

export interface ExternalCorpusMappingRule {
  corpus: string;
  corpusUrl: string;
  license: string;
  /** Human-readable selection rule; not a held-out utterance or gold answer. */
  selector: string;
  /** Expected semantic signal used only to find candidate records for independent review. */
  semanticCue: string;
}

export interface PrimitiveCandidate {
  id: string;
  description: string;
  inputShape: string;
  outputShape: string;
  requiredNovelCompositions: number;
  forbiddenCapabilityAliases: string[];
  forbiddenProgramAliases: string[];
  corpusMappings: ExternalCorpusMappingRule[];
  rationale: string[];
}

export interface PrimitiveSelectionAudit {
  primitiveId: string;
  capabilityMatches: string[];
  programMatches: string[];
  corpusMappings: number;
  requiredNovelCompositions: number;
  passed: boolean;
  violations: string[];
}

export interface FrozenPrimitiveSelection {
  schemaVersion: "0.3";
  status: "FROZEN_BEFORE_SCORED_ITEMS";
  primitives: PrimitiveCandidate[];
  audits: PrimitiveSelectionAudit[];
  selectionHash: string;
}

function normalize(value:string):string { return value.toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
function mentions(id:string,aliases:string[]):boolean {
  const n=normalize(id);
  return aliases.map(normalize).filter(Boolean).some(a=>n===a || n.includes(a) || a.includes(n));
}
function stable(value:unknown):string {
  if(value===null || typeof value!=="object") return JSON.stringify(value);
  if(Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj=value as Record<string,unknown>;
  return `{${Object.keys(obj).sort().map(k=>`${JSON.stringify(k)}:${stable(obj[k])}`).join(",")}}`;
}
function fnv1a64(text:string):string {
  let hash=0xcbf29ce484222325n; const prime=0x100000001b3n;
  for(const byte of new TextEncoder().encode(text)){ hash^=BigInt(byte); hash=BigInt.asUintN(64,hash*prime); }
  return hash.toString(16).padStart(16,"0");
}

export function auditPrimitiveCandidate(candidate:PrimitiveCandidate,caps:CapabilityRegistry,programs:ProgramLibrary):PrimitiveSelectionAudit {
  const violations:string[]=[];
  if(!candidate.id.trim()) violations.push("missing primitive id");
  if(candidate.requiredNovelCompositions<40) violations.push("requires fewer than 40 novel compositions");
  if(candidate.corpusMappings.length===0) violations.push("no external corpus mapping");
  for(const mapping of candidate.corpusMappings){
    if(!mapping.corpus.trim() || !mapping.corpusUrl.trim() || !mapping.selector.trim()) violations.push("incomplete corpus mapping");
  }

  const aliasNeedles=[candidate.id,...candidate.forbiddenCapabilityAliases];
  const direct=auditCapabilityAbsent(caps,candidate.id).matches;
  const capabilityMatches=[...new Set([...direct,...caps.all().map(x=>x.id).filter(id=>mentions(id,aliasNeedles))])];
  if(capabilityMatches.length) violations.push(`checkpoint-0 capability match: ${capabilityMatches.join(", ")}`);

  const programAliases=[candidate.id,...candidate.forbiddenProgramAliases];
  const programMatches=programs.all().map(x=>x.id).filter(id=>mentions(id,programAliases));
  if(programMatches.length) violations.push(`checkpoint-0 durable program match: ${programMatches.join(", ")}`);

  return {
    primitiveId:candidate.id,
    capabilityMatches,
    programMatches,
    corpusMappings:candidate.corpusMappings.length,
    requiredNovelCompositions:candidate.requiredNovelCompositions,
    passed:violations.length===0,
    violations
  };
}

export function freezePrimitiveSelection(candidates:PrimitiveCandidate[],caps:CapabilityRegistry,programs:ProgramLibrary):FrozenPrimitiveSelection {
  if(candidates.length!==3) throw new Error(`v0.3 requires exactly 3 primitive candidates, got ${candidates.length}`);
  if(new Set(candidates.map(x=>x.id)).size!==3) throw new Error("primitive candidate ids must be unique");
  const audits=candidates.map(x=>auditPrimitiveCandidate(x,caps,programs));
  const failed=audits.filter(x=>!x.passed);
  if(failed.length) throw new Error(`primitive selection audit failed: ${failed.map(x=>`${x.primitiveId}(${x.violations.join("; ")})`).join(", ")}`);
  const primitives=structuredClone(candidates);
  return {
    schemaVersion:"0.3",
    status:"FROZEN_BEFORE_SCORED_ITEMS",
    primitives,
    audits,
    selectionHash:`fnv1a64:${fnv1a64(stable({schemaVersion:"0.3",primitives,audits}))}`
  };
}

/**
 * v0.3.3 selection. These are semantic operators, not convenience host APIs.
 * Their language mappings are discovery filters only; no scored utterance is
 * copied into the repository at selection time.
 */
export const V03_PRIMITIVE_CANDIDATES:PrimitiveCandidate[]=[
  {
    id:"predicate.within_closed_int_window",
    description:"Decide whether an integer-valued measurement lies inside an inclusive lower/upper window.",
    inputShape:"(Int value, Int lower, Int upper)", outputShape:"Bool",
    requiredNovelCompositions:40,
    forbiddenCapabilityAliases:["within","between","range"],
    forbiddenProgramAliases:["within","between","range"],
    corpusMappings:[{
      corpus:"NL2Bash",
      corpusUrl:"https://github.com/TellinaTool/nl2bash",
      license:"MIT (data/bash)",
      selector:"Find externally authored records whose Bash command constrains one measurement with both a lower and an upper bound (for example paired find time bounds).",
      semanticCue:"bounded interval / between / within a range"
    }],
    rationale:["Absent from checkpoint-0 capability inventory.","Requires a reusable relation among three values rather than memorizing a task-family string.","NL2Bash contains file/time range language suitable for independently sourced compositions."]
  },
  {
    id:"predicate.string_contains",
    description:"Decide whether one string contains another string as a substring.",
    inputShape:"(String haystack, String needle)", outputShape:"Bool",
    requiredNovelCompositions:40,
    forbiddenCapabilityAliases:["contains","substring","match"],
    forbiddenProgramAliases:["contains","substring","match"],
    corpusMappings:[{
      corpus:"NL2Bash",
      corpusUrl:"https://github.com/TellinaTool/nl2bash",
      license:"MIT (data/bash)",
      selector:"Find externally authored records whose command filters names/text by contained substring or regex-equivalent literal containment; exclude exact-name-only records.",
      semanticCue:"contains substring / containing text"
    }],
    rationale:["Absent from checkpoint-0 capability inventory.","Can recur inside selection, filtering, and conditional compositions.","External Bash-language corpora contain containment requests without requiring EKG-authored paraphrases."]
  },
  {
    id:"logic.negate_predicate",
    description:"Invert a previously computed boolean predicate without changing the predicate's internal semantics.",
    inputShape:"(Bool predicate)", outputShape:"Bool",
    requiredNovelCompositions:40,
    forbiddenCapabilityAliases:["not_bool","negate","logical_not"],
    forbiddenProgramAliases:["negate","logical not","not bool"],
    corpusMappings:[{
      corpus:"NL2Bash",
      corpusUrl:"https://github.com/TellinaTool/nl2bash",
      license:"MIT (data/bash)",
      selector:"Find externally authored records using Bash/find negation (! or -not) around an otherwise positive predicate; retain the underlying predicate separately for composition analysis.",
      semanticCue:"not / excluding / without"
    }],
    rationale:["Absent from checkpoint-0 capability inventory.","Tests scope-sensitive composition because the learned operation must apply to another predicate.","Negated file predicates are represented directly in external Bash corpora."]
  }
];
