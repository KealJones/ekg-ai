import type { GraphStore } from "../graph/graph.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import type { ProgramLibrary } from "../program-library.js";
import type { ProgramBlueprint, Value } from "../ir/blueprint.js";
import type { JsonValue } from "../ir/blueprint.js";
import { lexicalSensesForText } from "./lexicon.js";
import { bestFuzzyMatch } from "./fuzzy.js";
import { descriptorForRelation } from "./semantic-catalog.js";
import { resolveCapabilityForRelation } from "./semantic-catalog.js";
import { planIntent } from "./planner.js";
import { runProgram } from "../runtime/interpreter.js";
import { assertWorldFact, retractWorldFact, queryLatestWorldFact, queryWorldFactTruth, queryWorldFactCount, queryWorldFactSet, queryClassProperty, deriveWorldFacts } from "../language/world-language.js";
import { matchConstructions } from "./construction-chart.js";
import { classifyTokens, numberWords } from "./token-classifier.js";
import { T } from "../ir/types.js";

import { createRequire } from "node:module";
let nlp: any;
try { const req = createRequire(import.meta.url); nlp = req("compromise"); } catch {}

export type SmartResult =
  | {status: "executed"; value: Value; program?: ProgramBlueprint}
  | {status: "fact-recorded"; message: string}
  | {status: "answer"; value: JsonValue}
  | {status: "conversational"; response: string}
  | {status: "unresolved"; reason: string};

const GREETINGS = new Set(["hi", "hello", "hey", "howdy", "greetings", "yo", "sup"]);
const FAREWELLS = new Set(["bye", "goodbye", "later", "cya"]);
const THANKS = new Set(["thanks", "thank", "thx", "ty"]);

const norm = (s: string) => s.trim().toLowerCase().replace(/[?.!,]+$/, "");

function extractNumbers(text: string): number[] {
  const nums: number[] = [];
  for (const word of norm(text).split(/\s+/)) {
    if (/^[-+]?\d+(\.\d+)?$/.test(word)) nums.push(Number(word));
    else if (numberWords[word] !== undefined) nums.push(numberWords[word]!);
  }
  return nums;
}

function fuzzyLookup(word: string, store: GraphStore): string | undefined {
  const lexemes = store.entitiesByKind("lexeme").map(e => typeof e.attrs?.form === "string" ? String(e.attrs.form) : "").filter(Boolean);
  const all = [...new Set([...lexemes, ...Object.keys(numberWords)])];
  const match = bestFuzzyMatch(word, all);
  return match && match.distance > 0 ? match.candidate : undefined;
}

function getVerb(text: string): string | undefined {
  if (!nlp) return undefined;
  const doc = nlp(text);
  const verbs = doc.verbs().toInfinitive().out("array") as string[];
  return verbs.find((v: string) => v !== "be" && v !== "is" && v !== "are" && v !== "do" && v !== "have");
}

function getNouns(text: string): string[] {
  if (!nlp) return [];
  const doc = nlp(text);
  return (doc.nouns().toSingular().out("array") as string[]).map(norm).filter((n: string) => n && n !== "thing" && n !== "many");
}

function isQuestion(text: string): boolean {
  if (text.trim().endsWith("?")) return true;
  if (nlp) return nlp(text).questions().length > 0;
  const lower = norm(text);
  return /^(what|where|who|when|how|is |are |does |did |can |will )/.test(lower);
}

function findActionRelation(word: string, store: GraphStore): {relation: string; capabilityId?: string} | undefined {
  const senses = lexicalSensesForText(store, word);
  for (const s of senses) {
    if (s.relation.startsWith("wordnet.") || s.relation === "structural" || s.relation === "negation" || s.relation === "conjunction" || s.relation === "sequence") continue;
    if (s.relation.startsWith("query.")) continue;
    if (descriptorForRelation(s.relation)) return {relation: s.relation, capabilityId: descriptorForRelation(s.relation)!.capabilityId};
    const rid = `relation:${s.relation.toLowerCase()}`;
    for (const rc of store.outgoing(rid, "denotes_concept")) {
      for (const impl of store.outgoing(rc.to, "implemented_by")) {
        const e = store.getEntity(impl.to);
        const capId = typeof e?.attrs?.capabilityId === "string" ? String(e.attrs.capabilityId) : typeof e?.attrs?.programId === "string" ? String(e.attrs.programId) : undefined;
        if (capId) return {relation: s.relation, capabilityId: capId};
      }
    }
  }
  return undefined;
}

function findWorldPredicate(word: string, store: GraphStore): string | undefined {
  const senses = lexicalSensesForText(store, word);
  for (const s of senses) {
    if (s.relation === "located_in" || s.relation === "possesses" || s.relation === "is_a" || s.relation === "has_property") return s.relation;
    const pid = `predicate:${s.relation.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}`;
    if (store.getEntity(pid)) return s.relation;
  }
  return undefined;
}

function findQuestionPredicate(text: string): string | undefined {
  const lower = norm(text);
  if (/^where\b/.test(lower)) return "located_in";
  if (/^who\b/.test(lower)) return "agent";
  if (/^how many\b/.test(lower)) return "count";
  if (/^what .* carrying/.test(lower)) return "possesses";
  if (/\bcapital\b/.test(lower)) return "capital";
  if (/\bcontinent\b/.test(lower)) return "continent";
  if (/\bcolor\b/.test(lower)) return "has_property";
  if (/\bsides?\b/.test(lower)) return "has_sides";
  if (/\binvent/.test(lower)) return "invented_by";
  if (/\bdiscove/.test(lower)) return "discovered_by";
  if (/\bwrote\b|\bwrite\b|\bwritten\b/.test(lower)) return "written_by";
  return undefined;
}

export function smartParse(
  utterance: string,
  store: GraphStore,
  caps: CapabilityRegistry,
  programs?: ProgramLibrary,
  providedInputs?: Value[]
): SmartResult {
  const lower = norm(utterance);
  const words = lower.split(/\s+/).filter(Boolean);

  // Fix typos first
  let corrected = utterance;
  for (const word of words) {
    const fix = fuzzyLookup(word, store);
    if (fix) corrected = corrected.replace(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), fix);
  }
  const correctedLower = norm(corrected);

  // 1. Conversational
  if (words.length <= 3) {
    if (words.some(w => GREETINGS.has(w))) return {status: "conversational", response: "Hey! I'm EKG. I can do math, track facts about the world, and answer questions. Type /help for commands."};
    if (words.some(w => FAREWELLS.has(w))) return {status: "conversational", response: "See you!"};
    if (words.some(w => THANKS.has(w))) return {status: "conversational", response: "No problem."};
  }

  // 2. Try construction grammar first
  const tokens = classifyTokens(store, corrected);
  const cMatches = matchConstructions(store, tokens);
  if (cMatches.length > 0) {
    const m = cMatches[0]!;
    const meaning = m.construction.meaning;
    const get = (name: string) => m.captures.get(name)?.text ?? "";
    const getRelation = (name: string) => {
      const cap = m.captures.get(name);
      return cap?.tokens[0]?.senses[0]?.relation ?? "";
    };

    if (meaning.kind === "fact-assert") {
      const predicate = meaning.predicate.startsWith("@") ? getRelation(meaning.predicate.slice(1)) : meaning.predicate;
      if (predicate) {
        if (meaning.negated) { retractWorldFact(store, get(meaning.subject), predicate, get(meaning.object)); return {status: "fact-recorded", message: `Retracted: ${get(meaning.subject)} ${predicate} ${get(meaning.object)}`}; }
        const fid = assertWorldFact(store, {subject: get(meaning.subject), predicate, object: get(meaning.object), provenance: ["smart-parser"]}); deriveWorldFacts(store);
        return {status: "fact-recorded", message: `Recorded: ${get(meaning.subject)} ${predicate} ${get(meaning.object)}`};
      }
    }
    if (meaning.kind === "fact-query") {
      deriveWorldFacts(store);
      const predicate = meaning.predicate.startsWith("@") ? getRelation(meaning.predicate.slice(1)) : meaning.predicate;
      if (predicate) {
        let val: JsonValue | undefined;
        if (meaning.queryType === "object") val = queryLatestWorldFact(store, get(meaning.subject), predicate);
        else if (meaning.queryType === "truth") val = meaning.object ? queryWorldFactTruth(store, get(meaning.subject), predicate, get(meaning.object)) : undefined;
        else if (meaning.queryType === "count") val = queryWorldFactCount(store, get(meaning.subject), predicate);
        else if (meaning.queryType === "set") val = queryWorldFactSet(store, get(meaning.subject), predicate);
        if (val !== undefined) return {status: "answer", value: val};
      }
    }
    if (meaning.kind === "capability-command") {
      const relation = meaning.relation.startsWith("@") ? getRelation(meaning.relation.slice(1)) : meaning.relation;
      if (relation) {
        const nums = meaning.args.filter(a => a.from === "slot").map(a => {
          const c = m.captures.get(a.slot); return c?.tokens[0]?.numericValue;
        }).filter((n): n is number => n !== undefined);
        if (nums.length === meaning.args.filter(a => a.from === "slot").length) {
          try {
            const signals = nums.map((v, i) => ({id: `s${i}`, concept: "Number", type: T.int, value: v, provenance: ["smart-parser"]}));
            const intent = {id: `cg:${relation}`, rawUtterance: corrected, signals, constraints: [{relation, args: signals.map(s => s.id), provenance: ["smart-parser"]}], goal: {concept: "Number", type: T.int}, confidence: 0.9, provenance: ["smart-parser"]};
            const plan = planIntent(intent, caps, store, programs);
            if (plan.status === "planned" && plan.program) {
              const output = runProgram(plan.program, [], caps, programs);
              return {status: "executed", value: output, program: plan.program};
            }
          } catch {}
        }
      }
    }
    if (meaning.kind === "conversational") {
      const responses: Record<string, string> = {greeting: "Hey! I'm EKG.", farewell: "See you!", gratitude: "No problem."};
      return {status: "conversational", response: responses[meaning.intent] ?? "OK."};
    }
  }

  // 3. Question handling - use compromise + graph
  if (isQuestion(corrected)) {
    deriveWorldFacts(store);
    const nouns = getNouns(corrected);
    const predicate = findQuestionPredicate(corrected);

    if (predicate && nouns.length >= 1) {
      const subject = nouns[nouns.length - 1]!;
      if (predicate === "count") {
        const val = queryWorldFactCount(store, subject, "possesses");
        return {status: "answer", value: val};
      }
      let val = queryLatestWorldFact(store, subject, predicate);
      if (val === undefined) val = queryClassProperty(store, subject, predicate);
      if (val !== undefined) return {status: "answer", value: val};

      // "what is X" - try is_a
      if (/^what (is|are)\b/.test(correctedLower) && nouns.length >= 1) {
        val = queryLatestWorldFact(store, subject, "is_a");
        if (val !== undefined) return {status: "answer", value: val};
      }
    }

    // Question with math: "what is 5 + 3"
    const nums = extractNumbers(corrected);
    const verb = getVerb(corrected);
    if (nums.length >= 2 && verb) {
      const action = findActionRelation(verb, store);
      if (action) {
        try {
          const signals = nums.map((v, i) => ({id: `s${i}`, concept: "Number", type: T.int, value: v, provenance: ["smart-parser"]}));
          const intent = {id: `sp:${action.relation}`, rawUtterance: corrected, signals, constraints: [{relation: action.relation, args: signals.map(s => s.id), provenance: ["smart-parser"]}], goal: {concept: "Number", type: T.int}, confidence: 0.9, provenance: ["smart-parser"]};
          const plan = planIntent(intent, caps, store, programs);
          if (plan.status === "planned" && plan.program) {
            const output = runProgram(plan.program, [], caps, programs);
            return {status: "executed", value: output, program: plan.program};
          }
        } catch {}
      }
    }

    // Math operators in questions
    const mathMatch = correctedLower.match(/(\d+)\s*([+\-*/])\s*(\d+)/);
    if (mathMatch) {
      const ops: Record<string, string> = {"+": "Add", "-": "Subtract", "*": "Multiply", "/": "Divide"};
      const rel = ops[mathMatch[2]!];
      if (rel) {
        try {
          const signals = [{id: "s0", concept: "Number", type: T.int, value: Number(mathMatch[1]), provenance: ["smart-parser"]}, {id: "s1", concept: "Number", type: T.int, value: Number(mathMatch[3]), provenance: ["smart-parser"]}];
          const intent = {id: `sp:${rel}`, rawUtterance: corrected, signals, constraints: [{relation: rel, args: ["s0", "s1"], provenance: ["smart-parser"]}], goal: {concept: "Number", type: T.int}, confidence: 0.9, provenance: ["smart-parser"]};
          const plan = planIntent(intent, caps, store, programs);
          if (plan.status === "planned" && plan.program) return {status: "executed", value: runProgram(plan.program, [], caps, programs), program: plan.program};
        } catch {}
      }
    }
  }

  // 4. Statement handling - fact assertions
  if (!isQuestion(corrected)) {
    const verb = getVerb(corrected);
    const nouns = getNouns(corrected);
    const hasNot = /\bnot\b/.test(correctedLower);

    if (verb && nouns.length >= 2) {
      const predicate = findWorldPredicate(verb, store);
      if (predicate) {
        const subject = nouns[0]!, object = nouns[nouns.length - 1]!;
        if (hasNot) { retractWorldFact(store, subject, predicate, object); return {status: "fact-recorded", message: `Retracted: ${subject} ${predicate} ${object}`}; }
        assertWorldFact(store, {subject, predicate, object, provenance: ["smart-parser"]}); deriveWorldFacts(store);
        return {status: "fact-recorded", message: `Recorded: ${subject} ${predicate} ${object}`};
      }
    }

    // Math without question: "5 + 3", "multiply 7 by 3"
    const nums = extractNumbers(corrected);
    if (verb) {
      const action = findActionRelation(verb, store);
      if (action && nums.length >= 2) {
        try {
          const signals = nums.map((v, i) => ({id: `s${i}`, concept: "Number", type: T.int, value: v, provenance: ["smart-parser"]}));
          const intent = {id: `sp:${action.relation}`, rawUtterance: corrected, signals, constraints: [{relation: action.relation, args: signals.map(s => s.id), provenance: ["smart-parser"]}], goal: {concept: "Number", type: T.int}, confidence: 0.9, provenance: ["smart-parser"]};
          const plan = planIntent(intent, caps, store, programs);
          if (plan.status === "planned" && plan.program) return {status: "executed", value: runProgram(plan.program, [], caps, programs), program: plan.program};
        } catch {}
      }
    }

    const mathMatch = correctedLower.match(/(\d+)\s*([+\-*/])\s*(\d+)/);
    if (mathMatch) {
      const ops: Record<string, string> = {"+": "Add", "-": "Subtract", "*": "Multiply", "/": "Divide"};
      const rel = ops[mathMatch[2]!];
      if (rel) {
        try {
          const signals = [{id: "s0", concept: "Number", type: T.int, value: Number(mathMatch[1]), provenance: ["smart-parser"]}, {id: "s1", concept: "Number", type: T.int, value: Number(mathMatch[3]), provenance: ["smart-parser"]}];
          const intent = {id: `sp:${rel}`, rawUtterance: corrected, signals, constraints: [{relation: rel, args: ["s0", "s1"], provenance: ["smart-parser"]}], goal: {concept: "Number", type: T.int}, confidence: 0.9, provenance: ["smart-parser"]};
          const plan = planIntent(intent, caps, store, programs);
          if (plan.status === "planned" && plan.program) return {status: "executed", value: runProgram(plan.program, [], caps, programs), program: plan.program};
        } catch {}
      }
    }
  }

  // 5. Try running any learned zero-arg program whose phrases match
  if (programs) {
    for (const prog of programs.all()) {
      if (prog.inputs.length > 0) continue;
      const progEntity = store.getEntity(`program:${prog.id}`);
      const desc = typeof progEntity?.attrs?.description === "string" ? String(progEntity.attrs.description).toLowerCase() : "";
      if (desc && correctedLower.includes(desc.replace(/^learned from: /, "").slice(0, 20))) {
        try { return {status: "executed", value: runProgram(prog, [], caps, programs), program: prog}; } catch {}
      }
    }
  }

  return {status: "unresolved", reason: `could not understand: ${corrected}`};
}
