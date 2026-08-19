import type { GraphStore } from "../graph/graph.js";
import { storeLexicalSense } from "./lexicon.js";

export interface WordNetEntry {
  word: string;
  pos: string;
  synsetOffset: number;
  gloss: string;
  synonyms: string[];
  relations: Array<{kind: string; target: string}>;
}

export interface WordNetExport {
  source: string;
  entries: WordNetEntry[];
}

const safe = (x: string) => x.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
const PROVENANCE_BASE = ["teacher:wordnet-3.1", "license:princeton-wordnet"];

export function importWordNetEntries(store: GraphStore, data: WordNetExport): number {
  let count = 0;
  const taught = new Set<string>();

  for (const entry of data.entries) {
    const senseId = `wordnet:${safe(entry.word)}:${entry.pos}:${entry.synsetOffset}`;
    if (taught.has(senseId)) continue;
    taught.add(senseId);

    const relation = `wordnet.${entry.pos}`;

    storeLexicalSense(store, {
      form: entry.word,
      senseId,
      relation,
      definition: entry.gloss,
      confidence: 0.85,
      provenance: [...PROVENANCE_BASE, `synset:${entry.synsetOffset}`],
    });
    count++;

    for (const synonym of entry.synonyms) {
      const synSenseId = `wordnet:${safe(synonym)}:${entry.pos}:${entry.synsetOffset}`;
      if (taught.has(synSenseId)) continue;
      taught.add(synSenseId);

      storeLexicalSense(store, {
        form: synonym,
        senseId: synSenseId,
        relation,
        definition: `${entry.gloss} (synonym of ${entry.word})`,
        confidence: 0.8,
        provenance: [...PROVENANCE_BASE, `synset:${entry.synsetOffset}`, `synonym-of:${entry.word}`],
      });
      count++;
    }

    for (const rel of entry.relations) {
      const fromId = `concept:wordnet:${entry.synsetOffset}`;
      const toId = `concept:wordnet:${safe(rel.target)}`;
      if (!store.getEntity(fromId)) {
        store.putEntity({id: fromId, kind: "concept", labels: ["wordnet-synset", entry.pos], attrs: {word: entry.word, pos: entry.pos, gloss: entry.gloss, synsetOffset: entry.synsetOffset}});
      }
      if (!store.getEntity(toId)) {
        store.putEntity({id: toId, kind: "concept", labels: ["wordnet-concept"], attrs: {word: rel.target}});
      }
      const relId = `${fromId}:${rel.kind}:${toId}`;
      if (!store.outgoing(fromId, rel.kind).some(r => r.to === toId)) {
        store.putRelation({id: relId, kind: rel.kind, from: fromId, to: toId, confidence: 0.9});
      }
    }
  }

  return count;
}
