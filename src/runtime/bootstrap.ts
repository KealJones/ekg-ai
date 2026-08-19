import type { GraphStore } from "../graph/graph.js";
import type { CapabilityRegistry } from "./capabilities.js";
import { seedPortableSubstrateKnowledge } from "./portable-knowledge.js";
import { teachStarterEnglishLexicon } from "../intent/lexicon.js";

export const EKG_BOOTSTRAP_MARKER = "state:bootstrap:ekg-core-v1";

export interface EkgBootstrapResult {
  initialized:boolean;
  starterEnglishLessons:number;
}

/**
 * Install the boring portable substrate and starter English curriculum once.
 * The marker itself lives in the graph, so a persisted brain does not relearn
 * or rewrite bootstrap knowledge on every process start.
 */
export function ensureEkgBootstrap(graph:GraphStore,caps:CapabilityRegistry):EkgBootstrapResult{
  if(graph.getEntity(EKG_BOOTSTRAP_MARKER)) return {initialized:false,starterEnglishLessons:0};
  seedPortableSubstrateKnowledge(graph,caps);
  const starterEnglishLessons=teachStarterEnglishLexicon(graph);
  graph.putEntity({
    id:EKG_BOOTSTRAP_MARKER,
    kind:"state_model",
    labels:["ekg-bootstrap","portable-substrate","starter-english"],
    attrs:{version:1,starterEnglishLessons,initializedAt:new Date().toISOString()}
  });
  return {initialized:true,starterEnglishLessons};
}
