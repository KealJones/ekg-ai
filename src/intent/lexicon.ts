import type { GraphStore } from "../graph/graph.js";
import { PORTABLE_SEMANTIC_CATALOG } from "./semantic-catalog.js";

const norm=(x:string)=>x.trim().toLowerCase().replace(/\s+/g," ");
const safe=(x:string)=>norm(x).replace(/[^a-z0-9._-]+/g,"-").replace(/^-|-$/g,"");
export interface LexicalSense {
  form:string;
  senseId:string;
  relation:string;
  definition?:string;
  impliedValue?:number;
  contextCues?:string[];
  frameId?:string;
  confidence:number;
  provenance:string[];
}

export function storeLexicalSense(store:GraphStore,s:LexicalSense):void{
  if(!norm(s.form)||!s.relation.trim()) throw new Error("lexical form and relation are required");
  if(s.confidence<0||s.confidence>1) throw new Error("lexical confidence must be 0..1");
  if(s.provenance.length===0) throw new Error("lexical provenance is required");
  const form=norm(s.form), lex=`lexeme:en:${safe(form)}`, sense=`sense:${safe(s.senseId)}`, rel=`relation:${s.relation.toLowerCase()}`;
  if(!store.getEntity(lex)) store.putEntity({id:lex,kind:"lexeme",labels:["lexeme","en",form],attrs:{form,language:"en"}});
  const existing=store.getEntity(sense);
  if(existing && typeof existing.attrs?.relation==="string" && existing.attrs.relation!==s.relation) throw new Error(`conflicting lexical sense ${s.senseId}`);
  store.putEntity({id:sense,kind:"sense",labels:["word-sense",s.relation],attrs:{...(existing?.attrs??{}),senseId:s.senseId,relation:s.relation,definition:s.definition,impliedValue:s.impliedValue,contextCues:[...new Set([...(Array.isArray(existing?.attrs?.contextCues)?existing!.attrs!.contextCues as string[]:[]),...(s.contextCues??[]).map(norm)])],frameId:s.frameId??existing?.attrs?.frameId,confidence:s.confidence,provenance:s.provenance}});
  if(!store.getEntity(rel)) store.putEntity({id:rel,kind:"concept",labels:["semantic-relation",s.relation],attrs:{relation:s.relation}});
  if(!store.outgoing(lex,"has_sense").some(r=>r.to===sense)) store.putRelation({id:`${lex}:sense:${sense}`,kind:"has_sense",from:lex,to:sense,confidence:s.confidence});
  if(!store.outgoing(sense,"expresses").some(r=>r.to===rel)) store.putRelation({id:`${sense}:expresses:${rel}`,kind:"expresses",from:sense,to:rel,confidence:s.confidence});
  if(s.frameId){
    const frame=`frame:${safe(s.frameId)}`;
    if(!store.getEntity(frame)) store.putEntity({id:frame,kind:"frame",labels:["semantic-frame",s.frameId],attrs:{frameId:s.frameId}});
    if(!store.outgoing(sense,"evokes_frame").some(r=>r.to===frame)) store.putRelation({id:`${sense}:frame:${frame}`,kind:"evokes_frame",from:sense,to:frame,confidence:s.confidence});
  }
}

export function lexicalSensesForText(store:GraphStore,text:string):LexicalSense[]{
  const lower=` ${norm(text)} `;
  const out:LexicalSense[]=[];
  for(const lex of store.entitiesByKind("lexeme")){
    const form=typeof lex.attrs?.form==="string"?String(lex.attrs.form):"";
    if(!form) continue;
    const escaped=form.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    if(!new RegExp(`(?:^|[^a-z0-9_])${escaped}(?:$|[^a-z0-9_])`,"i").test(lower)) continue;
    for(const edge of store.outgoing(lex.id,"has_sense")){
      const sense=store.getEntity(edge.to); if(!sense) continue;
      const relation=typeof sense.attrs?.relation==="string"?String(sense.attrs.relation):store.outgoing(sense.id,"expresses").map(r=>store.getEntity(r.to)?.attrs?.relation).find(x=>typeof x==="string") as string|undefined;
      if(!relation) continue;
      out.push({form,senseId:String(sense.attrs?.senseId??sense.id),relation,definition:typeof sense.attrs?.definition==="string"?String(sense.attrs.definition):undefined,impliedValue:typeof sense.attrs?.impliedValue==="number"?Number(sense.attrs.impliedValue):undefined,contextCues:Array.isArray(sense.attrs?.contextCues)?sense.attrs!.contextCues as string[]:[],frameId:typeof sense.attrs?.frameId==="string"?String(sense.attrs.frameId):undefined,confidence:Number(sense.attrs?.confidence??edge.confidence??.5),provenance:Array.isArray(sense.attrs?.provenance)?sense.attrs!.provenance as string[]:["graph:lexicon"]});
    }
  }
  return out.sort((a,b)=>b.confidence-a.confidence||b.form.length-a.form.length);
}

/** Initial English lessons supplied by Teacher. This is intentionally education, not magic bootstrap knowledge. */
export function teachStarterEnglishLexicon(store:GraphStore):number{
  let n=0;
  for(const d of PORTABLE_SEMANTIC_CATALOG){
    d.phrases.forEach((form,i)=>{
      storeLexicalSense(store,{form,senseId:`${d.concept}:${safe(form)}`,relation:d.relation,definition:d.gloss,confidence:i===0?.98:.9,provenance:["teacher:starter-english-v1",`semantic:${d.concept}`]}); n++;
    });
  }
  return n;
}

export function teachSynonym(store:GraphStore,args:{form:string;knownForm:string;provenance:string[];confidence?:number}):LexicalSense{
  const known=lexicalSensesForText(store,args.knownForm).find(s=>norm(s.form)===norm(args.knownForm));
  if(!known) throw new Error(`cannot teach synonym from unknown form: ${args.knownForm}`);
  const learned={form:args.form,senseId:`${known.senseId}:syn:${safe(args.form)}`,relation:known.relation,definition:`Synonym of ${args.knownForm}: ${known.definition??known.relation}`,impliedValue:known.impliedValue,confidence:args.confidence??.9,provenance:[...args.provenance,`synonym-of:${args.knownForm}`]};
  const existing=lexicalSensesForText(store,args.form).find(s=>norm(s.form)===norm(args.form)&&s.relation!==known.relation);
  if(existing) throw new Error(`form '${args.form}' already has grounded sense '${existing.relation}'; teaching it as '${known.relation}' would create ambiguity`);
  storeLexicalSense(store,learned);
  const a=`lexeme:en:${safe(args.form)}`, b=`lexeme:en:${safe(args.knownForm)}`;
  if(store.getEntity(a)&&store.getEntity(b)&&!store.outgoing(a,"synonym_of").some(r=>r.to===b)) store.putRelation({id:`${a}:synonym:${b}`,kind:"synonym_of",from:a,to:b,confidence:learned.confidence});
  return learned;
}


export interface ContextualLexicalSense extends LexicalSense {
  contextualScore:number;
  matchedCues:string[];
  coherenceEvidence:string[];
}

/**
 * Small, inspectable WSD layer inspired by WordNet-style explicit senses,
 * FrameNet-style contextual frames, and graph-coherence approaches such as Babelfy.
 * It never invents a sense: it only reranks senses already present in the graph.
 */
export function contextualLexicalSensesForText(store:GraphStore,text:string,margin=.08):ContextualLexicalSense[]{
  const senses=lexicalSensesForText(store,text);
  const lower=` ${norm(text)} `;
  const scored=senses.map(s=>{
    const matched=(s.contextCues??[]).filter(c=>{
      const esc=norm(c).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      return new RegExp(`(?:^|[^a-z0-9_])${esc}(?:$|[^a-z0-9_])`,`i`).test(lower);
    });
    const relationId=`relation:${s.relation.toLowerCase()}`;
    const coherence:string[]=[];
    // Nearby lexical senses can support related semantic relations in the graph.
    for(const other of senses){
      if(other===s) continue;
      const otherId=`relation:${other.relation.toLowerCase()}`;
      if(store.outgoing(relationId,"related_to").some(r=>r.to===otherId)||store.incoming(relationId,"related_to").some(r=>r.from===otherId)) coherence.push(`related:${other.relation}`);
    }
    const contextualScore=Math.min(1,s.confidence+matched.length*.12+coherence.length*.04);
    return {...s,contextualScore,matchedCues:matched,coherenceEvidence:coherence};
  });
  const byForm=new Map<string,ContextualLexicalSense[]>();
  for(const s of scored){const a=byForm.get(s.form)??[];a.push(s);byForm.set(s.form,a)}
  const out:ContextualLexicalSense[]=[];
  for(const group of byForm.values()){
    group.sort((a,b)=>b.contextualScore-a.contextualScore||a.senseId.localeCompare(b.senseId));
    const [first,second]=group;
    if(first && first.matchedCues.length>0 && (!second || first.contextualScore-second.contextualScore>=margin)) out.push(first);
    else out.push(...group);
  }
  return out.sort((a,b)=>b.contextualScore-a.contextualScore||b.form.length-a.form.length);
}

export function teachContextualSenseCues(store:GraphStore,args:{form:string;relation:string;cues:string[];frameId?:string;provenance:string[]}):LexicalSense{
  if(args.provenance.length===0) throw new Error("contextual sense teaching provenance is required");
  const candidates=lexicalSensesForText(store,args.form).filter(s=>norm(s.form)===norm(args.form)&&s.relation===args.relation);
  if(candidates.length!==1) throw new Error(`expected exactly one ${args.form}/${args.relation} sense, found ${candidates.length}`);
  const known=candidates[0]!;
  const updated={...known,contextCues:[...new Set([...(known.contextCues??[]),...args.cues.map(norm)])],frameId:args.frameId??known.frameId,provenance:[...known.provenance,...args.provenance,"learned-context-cues"]};
  storeLexicalSense(store,updated);
  const evidenceId=`evidence:context:${safe(args.form)}:${safe(args.relation)}:${store.entitiesByKind("utility_evidence").length}`;
  store.putEntity({id:evidenceId,kind:"utility_evidence",labels:["language-context","sense-disambiguation"],attrs:{form:norm(args.form),relation:args.relation,cues:args.cues.map(norm),frameId:args.frameId,provenance:args.provenance}});
  const senseId=`sense:${safe(known.senseId)}`;
  store.putRelation({id:`${evidenceId}:supports:${senseId}`,kind:"supports_sense",from:evidenceId,to:senseId,confidence:.9});
  return updated;
}
