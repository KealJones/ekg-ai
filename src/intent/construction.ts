import type { GraphStore, EntityKind } from "../graph/graph.js";

export type SlotType = "entity" | "action" | "value" | "modifier" | "question" | "clause" | "any";

export interface ConstructionSlot {
  name: string;
  type: SlotType;
  span: "one" | "many";
  optional?: boolean;
}

export type ConstructionElement =
  | {kind: "literal"; forms: string[]}
  | {kind: "slot"; slot: ConstructionSlot};

export type ConstructionMeaning =
  | {kind: "fact-assert"; predicate: string; subject: string; object: string; negated?: boolean}
  | {kind: "fact-query"; queryType: "object" | "truth" | "count" | "set"; predicate: string; subject: string; object?: string}
  | {kind: "capability-command"; relation: string; args: Array<{from: "slot"; slot: string} | {from: "implied"; value: number}>}
  | {kind: "conversational"; intent: string};

export interface Construction {
  id: string;
  pattern: ConstructionElement[];
  meaning: ConstructionMeaning;
  confidence: number;
  provenance: string[];
  examples?: string[];
}

const norm = (x: string) => x.trim().toLowerCase();
const safe = (x: string) => norm(x).replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

export function parseConstructionPattern(dsl: string): ConstructionElement[] {
  const elements: ConstructionElement[] = [];
  const parts = norm(dsl).split(/\s+/).filter(Boolean);
  for (const part of parts) {
    const slotMatch = /^\{([a-z][a-z0-9_]*)([:][a-z]+)?([*+?])?\}$/.exec(part);
    if (slotMatch) {
      const name = slotMatch[1]!;
      const typeStr = slotMatch[2]?.slice(1) ?? guessSlotType(name);
      const quantifier = slotMatch[3];
      elements.push({kind: "slot", slot: {
        name,
        type: typeStr as SlotType,
        span: quantifier === "*" || quantifier === "+" ? "many" : "one",
        optional: quantifier === "?" || quantifier === "*",
      }});
    } else if (part.includes("|")) {
      elements.push({kind: "literal", forms: part.split("|").map(norm)});
    } else {
      elements.push({kind: "literal", forms: [norm(part)]});
    }
  }
  return elements;
}

function guessSlotType(name: string): SlotType {
  if (name.startsWith("subject") || name.startsWith("entity") || name.startsWith("place") || name.startsWith("object") || name.startsWith("item") || name.startsWith("instance") || name.startsWith("class") || name.startsWith("giver") || name.startsWith("theme") || name.startsWith("recipient")) return "entity";
  if (name.startsWith("action") || name.startsWith("verb")) return "action";
  if (name.startsWith("value") || name.startsWith("number") || name.startsWith("amount")) return "value";
  if (name.startsWith("question") || name === "q") return "question";
  if (name.startsWith("modifier") || name.startsWith("mod")) return "modifier";
  return "any";
}

export function storeConstruction(store: GraphStore, construction: Construction): void {
  if (!construction.provenance.length) throw new Error("construction provenance is required");
  const slots = construction.pattern.filter((e): e is Extract<ConstructionElement, {kind: "slot"}> => e.kind === "slot");
  const slotNames = new Set(slots.map(s => s.slot.name));
  const m = construction.meaning;
  if (m.kind === "fact-assert") {
    if (!slotNames.has(m.subject)) throw new Error(`fact-assert subject '${m.subject}' not in pattern slots`);
    if (!slotNames.has(m.object)) throw new Error(`fact-assert object '${m.object}' not in pattern slots`);
  }
  if (m.kind === "fact-query" && !slotNames.has(m.subject)) throw new Error(`fact-query subject '${m.subject}' not in pattern slots`);
  store.putEntity({
    id: construction.id,
    kind: "construction" as EntityKind,
    labels: ["construction", m.kind],
    attrs: {...construction, status: "active", durable: true},
  });
}

export function activeConstructions(store: GraphStore): Construction[] {
  return store.entitiesByKind("construction" as EntityKind)
    .filter(e => e.attrs?.status !== "deprecated")
    .map(e => e.attrs as unknown as Construction)
    .filter(c => c && Array.isArray(c.pattern) && c.meaning);
}
