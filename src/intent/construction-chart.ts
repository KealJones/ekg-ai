import type { GraphStore } from "../graph/graph.js";
import type { ClassifiedToken } from "./token-classifier.js";
import { activeConstructions, type Construction, type ConstructionElement, type SlotType } from "./construction.js";

export interface SlotCapture {
  name: string;
  tokens: ClassifiedToken[];
  text: string;
}

export interface ConstructionMatch {
  construction: Construction;
  captures: Map<string, SlotCapture>;
  coverage: number;
  confidence: number;
}

function tokenMatchesSlotType(token: ClassifiedToken, slotType: SlotType): boolean {
  if (slotType === "any") return true;
  if (slotType === "modifier") return token.role === "entity" || token.role === "value" || token.role === "structural" || token.role === "unknown";
  if (slotType === "question") return token.role === "question" || (token.role === "action" && token.senses.some(s => s.questionFor));
  if (slotType === "entity") return token.role === "entity" || token.role === "unknown";
  return token.role === slotType;
}

function tokenMatchesLiteral(token: ClassifiedToken, forms: string[]): boolean {
  return forms.some(f => token.normalized === f || token.text.toLowerCase() === f);
}

function tryMatch(
  pattern: ConstructionElement[],
  tokens: ClassifiedToken[],
  patIdx: number,
  tokIdx: number,
  captures: Map<string, SlotCapture>,
): Map<string, SlotCapture> | undefined {
  // Consumed all pattern elements - success if we consumed all tokens too
  if (patIdx >= pattern.length) {
    return tokIdx >= tokens.length ? new Map(captures) : undefined;
  }

  const element = pattern[patIdx]!;
  const remaining = pattern.length - patIdx;

  if (element.kind === "literal") {
    if (tokIdx >= tokens.length) return undefined;
    if (!tokenMatchesLiteral(tokens[tokIdx]!, element.forms)) return undefined;
    return tryMatch(pattern, tokens, patIdx + 1, tokIdx + 1, captures);
  }

  const slot = element.slot;

  if (slot.optional) {
    // Try without this slot first (skip the pattern element)
    const withoutResult = tryMatch(pattern, tokens, patIdx + 1, tokIdx, captures);
    if (withoutResult) return withoutResult;
  }

  if (tokIdx >= tokens.length) {
    return slot.optional ? tryMatch(pattern, tokens, patIdx + 1, tokIdx, captures) : undefined;
  }

  if (slot.span === "one") {
    if (!tokenMatchesSlotType(tokens[tokIdx]!, slot.type)) {
      return slot.optional ? tryMatch(pattern, tokens, patIdx + 1, tokIdx, captures) : undefined;
    }
    const newCaptures = new Map(captures);
    newCaptures.set(slot.name, {name: slot.name, tokens: [tokens[tokIdx]!], text: tokens[tokIdx]!.normalized});
    return tryMatch(pattern, tokens, patIdx + 1, tokIdx + 1, newCaptures);
  }

  // span:"many" - greedy with backtrack. Try longest span first.
  const maxSpan = tokens.length - tokIdx - (remaining - 1); // leave room for remaining pattern elements
  for (let len = Math.max(maxSpan, 1); len >= 1; len--) {
    const spanTokens = tokens.slice(tokIdx, tokIdx + len);
    const allMatch = spanTokens.every(t => tokenMatchesSlotType(t, slot.type));
    if (!allMatch) continue;
    const newCaptures = new Map(captures);
    newCaptures.set(slot.name, {name: slot.name, tokens: spanTokens, text: spanTokens.map(t => t.normalized).join(" ")});
    const result = tryMatch(pattern, tokens, patIdx + 1, tokIdx + len, newCaptures);
    if (result) return result;
  }

  return slot.optional ? tryMatch(pattern, tokens, patIdx + 1, tokIdx, captures) : undefined;
}

export function matchConstructions(store: GraphStore, tokens: ClassifiedToken[]): ConstructionMatch[] {
  if (tokens.length === 0) return [];
  const constructions = activeConstructions(store);
  const matches: ConstructionMatch[] = [];

  for (const construction of constructions) {
    const captures = tryMatch(construction.pattern, tokens, 0, 0, new Map());
    if (!captures) continue;
    matches.push({
      construction,
      captures,
      coverage: 1,
      confidence: construction.confidence * tokens.reduce((c, t) => t.fuzzy ? c * (1 - t.fuzzy.distance * 0.12) : c, 1),
    });
  }

  // Sort by confidence descending, then by specificity (more literals = more specific)
  matches.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const aLiterals = a.construction.pattern.filter(e => e.kind === "literal").length;
    const bLiterals = b.construction.pattern.filter(e => e.kind === "literal").length;
    return bLiterals - aLiterals;
  });

  return matches.slice(0, 8);
}
