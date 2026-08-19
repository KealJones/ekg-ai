import type { GraphStore } from "../graph/graph.js";
import type { CapabilityRegistry } from "./capabilities.js";
import { seedPortableSubstrateKnowledge } from "./portable-knowledge.js";
import { teachStarterEnglishLexicon, teachStarterWorldLexicon } from "../intent/lexicon.js";
import { importWordNetEntries, type WordNetExport } from "../intent/wordnet-import.js";
import fs from "node:fs";
import path from "node:path";
import { storeGrammarRule, storePredicateDefinition, storeInferenceRule, storeEventFrameDefinition, starterLocationGrammar, starterPossessionGrammar, possessionLocationInference, starterSpatialPredicates, starterSpatialGrammar, starterGivingFrame, starterGivingGrammar, starterTruthGrammar, starterCountSetGrammar, starterNegationGrammar, starterConjunctionGrammar, starterDeductionGrammar, spatialTransitivityInference, starterPositionalPredicates, starterPositionalGrammar, starterSizePredicates, starterSizeGrammar, sizeTransitivityInference } from "../language/world-language.js";
import { installSeedConstructions } from "../intent/construction-catalog.js";

export const EKG_BOOTSTRAP_MARKER = "state:bootstrap:ekg-core-v1";

export interface EkgBootstrapResult {
  initialized:boolean;
  starterEnglishLessons:number;
  starterWorldLessons:number;
}

/**
 * Install the boring portable substrate and starter English curriculum once.
 * The marker itself lives in the graph, so a persisted brain does not relearn
 * or rewrite bootstrap knowledge on every process start.
 */
export function ensureEkgBootstrap(graph:GraphStore,caps:CapabilityRegistry):EkgBootstrapResult{
  if(graph.getEntity(EKG_BOOTSTRAP_MARKER)) return {initialized:false,starterEnglishLessons:0,starterWorldLessons:0};
  seedPortableSubstrateKnowledge(graph,caps);
  const starterEnglishLessons=teachStarterEnglishLexicon(graph);
  const starterWorldLessons=teachStarterWorldLexicon(graph);
  const wordnetLessons=installWordNetVocabulary(graph);
  installWorldLanguageGrammar(graph);
  const constructionCount=installSeedConstructions(graph);
  graph.putEntity({
    id:EKG_BOOTSTRAP_MARKER,
    kind:"state_model",
    labels:["ekg-bootstrap","portable-substrate","starter-english","world-language-grammar"],
    attrs:{version:3,starterEnglishLessons,starterWorldLessons,wordnetLessons,initializedAt:new Date().toISOString()}
  });
  return {initialized:true,starterEnglishLessons,starterWorldLessons};
}

function installWorldLanguageGrammar(graph:GraphStore):void{
  for(const rule of starterLocationGrammar()) storeGrammarRule(graph,rule);
  for(const rule of starterPossessionGrammar()) storeGrammarRule(graph,rule);
  storeInferenceRule(graph,possessionLocationInference());
  for(const def of starterSpatialPredicates()) storePredicateDefinition(graph,def);
  for(const rule of starterSpatialGrammar()) storeGrammarRule(graph,rule);
  storeEventFrameDefinition(graph,starterGivingFrame());
  for(const rule of starterGivingGrammar()) storeGrammarRule(graph,rule);
  for(const rule of starterTruthGrammar()) storeGrammarRule(graph,rule);
  for(const rule of starterCountSetGrammar()) storeGrammarRule(graph,rule);
  for(const rule of starterNegationGrammar()) storeGrammarRule(graph,rule);
  for(const rule of starterConjunctionGrammar()) storeGrammarRule(graph,rule);
  for(const rule of starterDeductionGrammar()) storeGrammarRule(graph,rule);
  for(const def of starterPositionalPredicates()) storePredicateDefinition(graph,def);
  for(const rule of starterPositionalGrammar()) storeGrammarRule(graph,rule);
  storeInferenceRule(graph,spatialTransitivityInference());
  for(const def of starterSizePredicates()) storePredicateDefinition(graph,def);
  for(const rule of starterSizeGrammar()) storeGrammarRule(graph,rule);
  storeInferenceRule(graph,sizeTransitivityInference());
}

function installWordNetVocabulary(graph:GraphStore):number{
  const candidates=[
    path.join(process.cwd(),"ekg-data","wordnet-curated.json"),
    path.join(path.dirname(new URL(import.meta.url).pathname),"..","..","ekg-data","wordnet-curated.json"),
  ];
  for(const p of candidates){
    try{
      if(!fs.existsSync(p)) continue;
      const data=JSON.parse(fs.readFileSync(p,"utf8")) as WordNetExport;
      return importWordNetEntries(graph,data);
    }catch{}
  }
  return 0;
}
