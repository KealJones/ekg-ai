import type { GraphStore } from "../graph/graph.js";
import { contextualLexicalSensesForText, lexicalSensesForText, type LexicalSense } from "./lexicon.js";
import { descriptorForRelation } from "./semantic-catalog.js";
import { bestFuzzyMatch } from "./fuzzy.js";

export type TokenRole = "action" | "entity" | "value" | "question" | "negation" | "conjunction" | "structural" | "unknown";

export interface ClassifiedToken {
  text: string;
  normalized: string;
  role: TokenRole;
  senses: LexicalSense[];
  numericValue?: number;
  fuzzy?: {original: string; correctedTo: string; distance: number};
  impliedValue?: number;
}

const norm = (x: string) => x.trim().toLowerCase().replace(/[?.!,;:]+$/g, "").replace(/\s+/g, " ");

export const numberWords: Record<string, number> = {
  zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
  eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19, twenty:20,
  hundred:100, thousand:1000,
  twice:2, double:2, triple:3, quadruple:4, half:0.5,
};

const NON_ACTION_RELATIONS = new Set(["structural", "negation", "conjunction", "sequence"]);

export function tokenize(utterance: string): string[] {
  return norm(utterance).split(/\s+/).filter(Boolean);
}

function isNumericToken(token: string): number | undefined {
  if (/^[-+]?\d+(\.\d+)?$/.test(token)) return Number(token);
  return numberWords[token];
}

function roleFromRelation(relation: string, store?: GraphStore): TokenRole {
  if (relation.startsWith("query.")) return "question";
  if (relation === "negation") return "negation";
  if (relation === "conjunction" || relation === "sequence") return "conjunction";
  if (relation === "structural") return "structural";
  if (descriptorForRelation(relation)) return "action";
  if (store) {
    const rid = `relation:${relation.toLowerCase()}`;
    if (store.getEntity(rid)) return "action";
    const pid = `predicate:${relation.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}`;
    if (store.getEntity(pid)) return "action";
  }
  return "action";
}

export function classifyTokens(store: GraphStore | undefined, utterance: string): ClassifiedToken[] {
  const tokens = tokenize(utterance);
  const out: ClassifiedToken[] = [];

  for (const token of tokens) {
    const numericValue = isNumericToken(token);
    if (numericValue !== undefined) {
      const senses = store ? lexicalSensesForText(store, token) : [];
      const actionSenses = senses.filter(s => !NON_ACTION_RELATIONS.has(s.relation) && !s.relation.startsWith("query."));
      out.push({
        text: token, normalized: norm(token), role: actionSenses.length > 0 && actionSenses[0]!.impliedValue !== undefined ? "action" : "value",
        senses: actionSenses.length > 0 ? actionSenses : senses, numericValue,
        impliedValue: actionSenses[0]?.impliedValue,
      });
      continue;
    }

    if (store) {
      const senses = contextualLexicalSensesForText(store, token).filter(s => s.confidence >= 0.3);
      if (senses.length > 0) {
        const best = senses[0]!;
        const role = best.questionFor ? "question" as const : roleFromRelation(best.relation, store);
        out.push({text: token, normalized: norm(token), role, senses, impliedValue: best.impliedValue});
        continue;
      }

      const allLexemes = store.entitiesByKind("lexeme").map(e => typeof e.attrs?.form === "string" ? String(e.attrs.form) : "").filter(Boolean);
      const allCandidates = [...new Set([...allLexemes, ...Object.keys(numberWords)])];
      const fuzzy = bestFuzzyMatch(token, allCandidates);
      if (fuzzy && fuzzy.distance > 0) {
        const correctedNumeric = isNumericToken(fuzzy.candidate);
        if (correctedNumeric !== undefined) {
          out.push({
            text: token, normalized: norm(fuzzy.candidate), role: "value", senses: [], numericValue: correctedNumeric,
            fuzzy: {original: token, correctedTo: fuzzy.candidate, distance: fuzzy.distance},
          });
          continue;
        }
        const correctedSenses = contextualLexicalSensesForText(store, fuzzy.candidate).filter(s => s.confidence >= 0.3);
        if (correctedSenses.length > 0) {
          const best = correctedSenses[0]!;
          const penalizedSenses = correctedSenses.map(s => ({...s, confidence: s.confidence * (1 - fuzzy.distance * 0.15)}));
          const role = best.questionFor ? "question" as const : roleFromRelation(best.relation, store);
          out.push({
            text: token, normalized: norm(fuzzy.candidate), role,
            senses: penalizedSenses,
            fuzzy: {original: token, correctedTo: fuzzy.candidate, distance: fuzzy.distance},
            impliedValue: best.impliedValue,
          });
          continue;
        }
      }
    }

    out.push({text: token, normalized: norm(token), role: "entity", senses: []});
  }

  return out;
}
