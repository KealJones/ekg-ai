import type { GraphStore } from "../graph/graph.js";
import { assertWorldFact, assertUniversalRule } from "../language/world-language.js";
import { storeConstruction, parseConstructionPattern, type Construction } from "../intent/construction.js";
import fs from "node:fs";
import path from "node:path";

interface CurriculumFact { subject: string; predicate: string; object: string; }
interface CurriculumUniversal { className: string; propertyPredicate: string; propertyValue: string; }
interface CurriculumConstruction { id: string; pattern: string; meaning: any; }
interface CurriculumData {
  facts: CurriculumFact[];
  universalRules?: CurriculumUniversal[];
  queryConstructions?: CurriculumConstruction[];
}

const PROV = ["teacher:curriculum-k8"];

export function importCurriculum(graph: GraphStore, data: CurriculumData): {facts: number; rules: number; constructions: number} {
  let facts = 0, rules = 0, constructions = 0;

  for (const f of data.facts) {
    try {
      assertWorldFact(graph, {subject: f.subject, predicate: f.predicate, object: f.object, provenance: PROV});

      if (f.predicate === "invented" || f.predicate === "discovered" || f.predicate === "wrote") {
        assertWorldFact(graph, {subject: f.object, predicate: `${f.predicate}_by`, object: f.subject, provenance: [...PROV, `inverse-of:${f.predicate}`]});
      }
      facts++;
    } catch {}
  }

  for (const r of data.universalRules ?? []) {
    try {
      assertUniversalRule(graph, r.className, r.propertyPredicate, r.propertyValue, PROV);
      rules++;
    } catch {}
  }

  for (const c of data.queryConstructions ?? []) {
    try {
      const construction: Construction = {
        id: `construction:curriculum.${c.id}`,
        pattern: parseConstructionPattern(c.pattern),
        meaning: c.meaning,
        confidence: 0.85,
        provenance: [...PROV, `curriculum:${c.id}`],
      };
      storeConstruction(graph, construction);
      constructions++;
    } catch {}
  }

  return {facts, rules, constructions};
}

export function loadAndImportCurriculum(graph: GraphStore): {facts: number; rules: number; constructions: number} {
  const candidates = [
    path.join(process.cwd(), "ekg-data", "curriculum-k8.json"),
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "ekg-data", "curriculum-k8.json"),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const data = JSON.parse(fs.readFileSync(p, "utf8")) as CurriculumData;
      return importCurriculum(graph, data);
    } catch {}
  }
  return {facts: 0, rules: 0, constructions: 0};
}
