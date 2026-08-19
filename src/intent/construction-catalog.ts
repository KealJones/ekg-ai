import type { GraphStore } from "../graph/graph.js";
import { parseConstructionPattern, storeConstruction, type Construction } from "./construction.js";

const PROV = ["teacher:starter-construction-v1"];

function c(id: string, dsl: string, meaning: Construction["meaning"], examples?: string[]): Construction {
  return {id: `construction:${id}`, pattern: parseConstructionPattern(dsl), meaning, confidence: 0.9, provenance: [...PROV, `seed:${id}`], examples};
}

export function starterCapabilityConstructions(): Construction[] {
  return [
    c("cap.what-is-v-a-v", "what is|are {value1:value} {action:action} {value2:value}",
      {kind: "capability-command", relation: "@action", args: [{from: "slot", slot: "value1"}, {from: "slot", slot: "value2"}]},
      ["what is 5 plus 3", "what is 7 times 2"]),
    c("cap.what-is-v-a-v-q", "what is|are {value1:value} {action:action} by {value2:value}",
      {kind: "capability-command", relation: "@action", args: [{from: "slot", slot: "value1"}, {from: "slot", slot: "value2"}]},
      ["what is 10 divided by 2"]),
    c("cap.a-v-and-v", "{action:action} {value1:value} and {value2:value}",
      {kind: "capability-command", relation: "@action", args: [{from: "slot", slot: "value1"}, {from: "slot", slot: "value2"}]},
      ["add 5 and 3", "multiply 7 and 2"]),
    c("cap.a-v-by-v", "{action:action} {value1:value} by {value2:value}",
      {kind: "capability-command", relation: "@action", args: [{from: "slot", slot: "value1"}, {from: "slot", slot: "value2"}]},
      ["multiply 5 by 3", "divide 10 by 2"]),
    c("cap.v-a-v", "{value1:value} {action:action} {value2:value}",
      {kind: "capability-command", relation: "@action", args: [{from: "slot", slot: "value1"}, {from: "slot", slot: "value2"}]},
      ["5 plus 3", "10 minus 7"]),
    c("cap.a-this-by-v", "{action:action} this number by {value:value}",
      {kind: "capability-command", relation: "@action", args: [{from: "slot", slot: "value"}]},
      ["multiply this number by 3"]),
    c("cap.a-this", "{action:action} this number",
      {kind: "capability-command", relation: "@action", args: []},
      ["double this number", "negate this number"]),
    c("cap.what-time", "what time is it",
      {kind: "capability-command", relation: "CurrentTime", args: []},
      ["what time is it"]),
    c("cap.what-time-mod", "what time is it {modifier*}",
      {kind: "capability-command", relation: "CurrentTime", args: []},
      ["what time is it in 12 hour format"]),
    c("cap.what-date", "what date is it",
      {kind: "capability-command", relation: "CurrentDate", args: []},
      ["what date is it"]),
  ];
}

export function starterFactConstructions(): Construction[] {
  return [
    // Location
    c("fact.s-went-to-o", "{subject:entity} went to the {place:entity}",
      {kind: "fact-assert", predicate: "located_in", subject: "subject", object: "place"},
      ["Ava went to the kitchen"]),
    c("fact.s-is-in-o", "{subject:entity} is in the {place:entity}",
      {kind: "fact-assert", predicate: "located_in", subject: "subject", object: "place"},
      ["Ava is in the kitchen"]),
    // Possession
    c("fact.s-picked-up-o", "{subject:entity} picked up the {object:entity}",
      {kind: "fact-assert", predicate: "possesses", subject: "subject", object: "object"},
      ["Ava picked up the apple"]),
    c("fact.s-carrying-o", "{subject:entity} is carrying a {object:entity}",
      {kind: "fact-assert", predicate: "possesses", subject: "subject", object: "object"},
      ["Ava is carrying a coin"]),
    // Negation
    c("fact.s-not-in-o", "{subject:entity} is not in the {place:entity}",
      {kind: "fact-assert", predicate: "located_in", subject: "subject", object: "place", negated: true},
      ["Ava is not in the kitchen"]),
    // Conjunction
    c("fact.s-and-s-went-to", "{subject1:entity} and {subject2:entity} went to the {place:entity}",
      {kind: "fact-assert", predicate: "located_in", subject: "subject1", object: "place"},
      ["Ava and Liam went to the kitchen"]),
    // Is-a
    c("fact.s-is-a-o", "{instance:entity} is a {class:entity}",
      {kind: "fact-assert", predicate: "is_a", subject: "instance", object: "class"},
      ["Pip is a swan"]),
    // Spatial
    c("fact.s-dir-of-o", "the {subject:entity} is {action:action} of the {object:entity}",
      {kind: "fact-assert", predicate: "@action", subject: "subject", object: "object"},
      ["the triangle is left of the square"]),
    // Size
    c("fact.s-bigger-o", "the {subject:entity} is bigger than the {object:entity}",
      {kind: "fact-assert", predicate: "bigger_than", subject: "subject", object: "object"},
      ["the chest is bigger than the box"]),
    // Giving
    c("fact.giving", "{giver:entity} gave the {theme:entity} to {recipient:entity}",
      {kind: "fact-assert", predicate: "gave_to", subject: "giver", object: "recipient"},
      ["Liam gave the book to Maya"]),
    // Universal
    c("fact.all-are", "all {class:entity} are {value:entity}",
      {kind: "fact-assert", predicate: "has_property_universal", subject: "class", object: "value"},
      ["all swans are white"]),
  ];
}

export function starterQueryConstructions(): Construction[] {
  return [
    c("query.where-is", "where is {subject:entity}",
      {kind: "fact-query", queryType: "object", predicate: "located_in", subject: "subject"},
      ["where is Ava"]),
    c("query.where-is-the", "where is the {subject:entity}",
      {kind: "fact-query", queryType: "object", predicate: "located_in", subject: "subject"},
      ["where is the apple"]),
    c("query.is-in", "is {subject:entity} in the {place:entity}",
      {kind: "fact-query", queryType: "truth", predicate: "located_in", subject: "subject", object: "place"},
      ["is Ava in the kitchen"]),
    c("query.carrying-truth", "is {subject:entity} carrying a {item:entity}",
      {kind: "fact-query", queryType: "truth", predicate: "possesses", subject: "subject", object: "item"},
      ["is Ava carrying a coin"]),
    c("query.how-many", "how many things is {subject:entity} carrying",
      {kind: "fact-query", queryType: "count", predicate: "possesses", subject: "subject"},
      ["how many things is Ava carrying"]),
    c("query.what-carrying", "what is {subject:entity} carrying",
      {kind: "fact-query", queryType: "set", predicate: "possesses", subject: "subject"},
      ["what is Ava carrying"]),
    c("query.what-color", "what color is {instance:entity}",
      {kind: "fact-query", queryType: "object", predicate: "has_property", subject: "instance"},
      ["what color is Pip"]),
    c("query.direction", "what direction is the {subject:entity} from the {object:entity}",
      {kind: "fact-query", queryType: "object", predicate: "direction_from", subject: "subject", object: "object"}),
    c("query.relative-position", "where is the {subject:entity} relative to the {object:entity}",
      {kind: "fact-query", queryType: "object", predicate: "position_of", subject: "subject", object: "object"}),
    c("query.size-relative", "how is the {subject:entity} sized relative to the {object:entity}",
      {kind: "fact-query", queryType: "object", predicate: "size_of", subject: "subject", object: "object"}),
    c("query.who-gave", "who did {giver:entity} give the {theme:entity} to",
      {kind: "fact-query", queryType: "object", predicate: "gave_to_recipient", subject: "giver", object: "theme"}),
  ];
}

export function starterConversationalConstructions(): Construction[] {
  return [
    c("conv.greeting", "{greeting:conversational}",
      {kind: "conversational", intent: "greeting"}),
    c("conv.farewell", "{farewell:conversational}",
      {kind: "conversational", intent: "farewell"}),
    c("conv.thanks", "{thanks:conversational}",
      {kind: "conversational", intent: "gratitude"}),
  ];
}

export function installSeedConstructions(store: GraphStore): number {
  let count = 0;
  for (const c of [...starterCapabilityConstructions(), ...starterFactConstructions(), ...starterQueryConstructions(), ...starterConversationalConstructions()]) {
    try { storeConstruction(store, c); count++; } catch {}
  }
  return count;
}
