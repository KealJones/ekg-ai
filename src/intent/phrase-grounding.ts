import type { GraphStore } from "../graph/graph.js";

export interface PhraseGrounding {
  phrase: string;
  relation: string;
  impliedValue?: number;
  confidence: number;
  provenance: string[];
}

function relationId(relation:string){return `relation:${relation.toLowerCase()}`;}
function phraseId(phrase:string){return `phrase:${phrase.trim().toLowerCase()}`;}

export function storePhraseGrounding(store:GraphStore,g:PhraseGrounding):void{
  if(!g.phrase.trim()||!g.relation.trim()) throw new Error("phrase and relation are required");
  if(g.confidence<0||g.confidence>1) throw new Error("phrase grounding confidence must be 0..1");
  if(g.provenance.length===0) throw new Error("phrase grounding provenance is required");
  const id=phraseId(g.phrase);
  const existing=store.getEntity(id);
  const attrs=existing?.attrs??{};
  if(existing && typeof attrs.relation==="string" && attrs.relation!==g.relation)
    throw new Error(`conflicting phrase grounding for ${g.phrase}: ${attrs.relation} vs ${g.relation}`);
  store.putEntity({id,kind:"concept",labels:["phrase",g.phrase.trim().toLowerCase()],attrs:{
    ...attrs,phrase:g.phrase.trim().toLowerCase(),relation:g.relation,impliedValue:g.impliedValue,
    confidence:g.confidence,provenance:g.provenance,
    successes:Number(attrs.successes??0),failures:Number(attrs.failures??0)
  }});
  const rid=relationId(g.relation);
  if(!store.getEntity(rid)) store.putEntity({id:rid,kind:"concept",labels:["semantic-relation",g.relation],attrs:{relation:g.relation}});
  const edge=`${id}:expresses:${rid}`;
  if(!store.outgoing(id,"expresses").some(x=>x.to===rid))
    store.putRelation({id:edge,kind:"expresses",from:id,to:rid,confidence:g.confidence});
}

export function learnedPhraseGroundings(store:GraphStore):PhraseGrounding[]{
  return store.entitiesByKind("concept")
    .filter(e=>e.labels?.includes("phrase") && typeof e.attrs?.phrase==="string" && typeof e.attrs?.relation==="string")
    .filter(e=>Number(e.attrs!.confidence??.5)>=.35)
    .map(e=>({
      phrase:String(e.attrs!.phrase),
      relation:String(e.attrs!.relation),
      impliedValue:typeof e.attrs!.impliedValue==="number"?Number(e.attrs!.impliedValue):undefined,
      confidence:Number(e.attrs!.confidence??.5),
      provenance:Array.isArray(e.attrs!.provenance)?e.attrs!.provenance as string[]:["graph"]
    }));
}

export function recordPhraseGroundingOutcome(store:GraphStore,phrase:string,success:boolean):void{
  const id=phraseId(phrase);
  const entity=store.getEntity(id);
  if(!entity) throw new Error(`unknown phrase grounding: ${phrase}`);
  const attrs=entity.attrs??{};
  const successes=Number(attrs.successes??0)+(success?1:0);
  const failures=Number(attrs.failures??0)+(success?0:1);
  const observations=successes+failures;
  // Smoothed empirical confidence; prior weight 2 centered on original confidence.
  const prior=Number(attrs.confidence??.5);
  const confidence=Math.max(0,Math.min(1,(prior*2+successes)/(2+observations)));
  store.putEntity({...entity,attrs:{...attrs,successes,failures,confidence}});
}
