import type { GraphStore } from "../graph/graph.js";
import { classifyTokens, type ClassifiedToken } from "./token-classifier.js";
import { descriptorForRelation } from "./semantic-catalog.js";

export type ConversationalIntent = "greeting" | "farewell" | "gratitude" | "affirmative" | "help-request";

export type ParsedUtterance =
  | {kind:"fact-assert"; subject:string; predicate:string; object:string; negated:boolean; confidence:number; provenance:string[]}
  | {kind:"fact-query"; queryType:"object"|"truth"|"count"|"set"|"predicate-family"; subject:string; predicate:string; object?:string; predicateFamily?:string; confidence:number; provenance:string[]}
  | {kind:"capability-command"; relation:string; args:ParsedArg[]; confidence:number; provenance:string[]}
  | {kind:"conversational"; intent:ConversationalIntent; confidence:number; provenance:string[]}
  | {kind:"composed"; parts:ParsedUtterance[]}
  | {kind:"unresolved"; reason:string; tokens:ClassifiedToken[]};

export type ParsedArg = {kind:"value"; value:number} | {kind:"input"; index:number};

const safe = (s: string) => s.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "");

function isWorldPredicate(relation: string, store?: GraphStore): boolean {
  if (!store) return false;
  const pid = `predicate:${safe(relation)}`;
  if (store.getEntity(pid)) return true;
  const knownPredicates = ["located_in", "possesses", "is_a", "has_property", "gave_to",
    "north_of", "south_of", "east_of", "west_of", "left_of", "right_of", "bigger_than", "smaller_than"];
  return knownPredicates.includes(relation.toLowerCase());
}

function isCapabilityRelation(relation: string, store?: GraphStore): boolean {
  if (descriptorForRelation(relation)) return true;
  if (!store) return false;
  const rid = `relation:${relation.toLowerCase()}`;
  for (const rc of store.outgoing(rid, "denotes_concept")) {
    if (store.outgoing(rc.to, "implemented_by").length > 0) return true;
  }
  return false;
}

export function parseUtterance(store: GraphStore | undefined, utterance: string): ParsedUtterance {
  const normalized = utterance.trim().toLowerCase();

  const sequenceParts = normalized.split(/\bthen\b/i).map(s => s.trim()).filter(Boolean);
  if (sequenceParts.length > 1) {
    const parts = sequenceParts.map(part => parseUtterance(store, part));
    if (parts.some(p => p.kind === "unresolved")) {
      return parts.find(p => p.kind === "unresolved")!;
    }
    return {kind: "composed", parts};
  }

  const tokens = classifyTokens(store ?? undefined, utterance);
  if (tokens.length === 0) return {kind: "unresolved", reason: "empty utterance", tokens};

  const actions = tokens.filter(t => t.role === "action");
  const entities = tokens.filter(t => t.role === "entity");
  const values = tokens.filter(t => t.role === "value");
  const questions = tokens.filter(t => t.role === "question");
  const conversational = tokens.filter(t => t.role === "conversational");
  const hasNegation = tokens.some(t => t.role === "negation");
  const hasQuestionMark = utterance.trim().endsWith("?");
  const isQuestion = questions.length > 0 || hasQuestionMark;

  const provenance = ["semantic-parser:v0.1", ...tokens.filter(t => t.fuzzy).map(t => `fuzzy:${t.fuzzy!.original}->${t.fuzzy!.correctedTo}`)];
  const confidence = tokens.reduce((c, t) => t.fuzzy ? c * (1 - t.fuzzy.distance * 0.15) : c, 0.9);

  if (actions.length === 0 && questions.length === 0 && conversational.length > 0) {
    const intent = conversational[0]!.senses[0]?.relation as ConversationalIntent;
    return {kind: "conversational", intent, confidence, provenance};
  }

  if (actions.length === 0 && questions.length === 0) {
    return {kind: "unresolved", reason: "no recognized action or question word", tokens};
  }

  if (isQuestion) {
    const questionToken = questions[0];
    const questionFor = questionToken?.senses[0]?.questionFor;

    if (questionFor && entities.length >= 1) {
      const subject = entities[0]!.normalized;
      const questionRelation = questionToken?.senses[0]?.relation ?? "";

      if (questionRelation === "query.count") {
        const action = actions[0];
        const predicate = action?.senses[0]?.relation ?? questionFor;
        return {kind: "fact-query", queryType: "count", subject, predicate, confidence, provenance};
      }
      if (questionRelation === "query.set" || questionRelation === "query.generic") {
        const action = actions[0];
        const predicate = action?.senses[0]?.relation ?? questionFor;
        return {kind: "fact-query", queryType: "set", subject, predicate, confidence, provenance};
      }
      return {kind: "fact-query", queryType: "object", subject, predicate: questionFor, confidence, provenance};
    }

    if (hasQuestionMark && actions.length > 0) {
      const action = actions[0]!;
      const relation = action.senses[0]?.relation ?? "";
      if (isWorldPredicate(relation, store) && entities.length >= 2) {
        return {kind: "fact-query", queryType: "truth", subject: entities[0]!.normalized, predicate: relation, object: entities[1]!.normalized, confidence, provenance};
      }
    }

    if (entities.length >= 2 && actions.length > 0) {
      const action = actions[0]!;
      const relation = action.senses[0]?.relation ?? "";
      if (isWorldPredicate(relation, store)) {
        return {kind: "fact-query", queryType: "truth", subject: entities[0]!.normalized, predicate: relation, object: entities[1]!.normalized, confidence, provenance};
      }
    }

    // "what is 5 divided by 2?" - question with a capability action + values
    if (actions.length > 0 && values.length > 0) {
      const action = actions[0]!;
      const relation = action.senses[0]?.relation ?? "";
      if (isCapabilityRelation(relation, store)) {
        const args: ParsedArg[] = values.map(v => ({kind: "value" as const, value: v.numericValue!}));
        const impliedValue = action.impliedValue ?? action.senses[0]?.impliedValue;
        if (impliedValue !== undefined) args.push({kind: "value", value: impliedValue});
        return {kind: "capability-command", relation, args, confidence, provenance};
      }
    }

    return {kind: "unresolved", reason: "question recognized but cannot resolve query", tokens};
  }

  if (actions.length > 0) {
    const action = actions[0]!;
    const relation = action.senses[0]?.relation ?? "";

    if (isWorldPredicate(relation, store)) {
      if (entities.length >= 2) {
        return {kind: "fact-assert", subject: entities[0]!.normalized, predicate: relation, object: entities[1]!.normalized, negated: hasNegation, confidence, provenance};
      }
      if (entities.length === 1 && values.length >= 1) {
        return {kind: "fact-assert", subject: entities[0]!.normalized, predicate: relation, object: String(values[0]!.numericValue), negated: hasNegation, confidence, provenance};
      }
      return {kind: "unresolved", reason: `world predicate '${relation}' needs subject and object`, tokens};
    }

    if (isCapabilityRelation(relation, store)) {
      const args: ParsedArg[] = [];
      let inputIndex = 0;

      const impliedValue = action.impliedValue ?? action.senses[0]?.impliedValue;

      if (values.length > 0) {
        for (const v of values) args.push({kind: "value", value: v.numericValue!});
      } else if (entities.some(e => e.normalized === "this" || e.normalized === "number")) {
        args.push({kind: "input", index: inputIndex++});
      } else {
        args.push({kind: "input", index: inputIndex++});
      }

      if (impliedValue !== undefined) {
        args.push({kind: "value", value: impliedValue});
      } else if (args.length < 2 && values.length === 0) {
        // Binary op with no second arg - need input
      }

      return {kind: "capability-command", relation, args, confidence, provenance};
    }

    return {kind: "unresolved", reason: `action '${relation}' is neither a world predicate nor a capability`, tokens};
  }

  return {kind: "unresolved", reason: "could not determine sentence structure", tokens};
}
