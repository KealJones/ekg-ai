import type { GraphStore } from "../graph/graph.js";
import type { JsonValue } from "../ir/blueprint.js";

function hasCypher(g: GraphStore): g is GraphStore & {cypher(q:string,p?:Record<string,unknown>):Record<string,unknown>[]} {
  return typeof (g as any).cypher === "function";
}

const norm=(x:string)=>x.trim().toLowerCase().replace(/[?.!,]+$/g,"").replace(/\s+/g," ");
const safe=(x:string)=>norm(x).replace(/[^a-z0-9._-]+/g,"-").replace(/^-|-$/g,"");

export type GrammarSemantics =
  | {kind:"assert-binary";predicate:string;subjectCapture:string;objectCapture:string}
  | {kind:"assert-binary-negation";predicate:string;subjectCapture:string;objectCapture:string}
  | {kind:"assert-binary-conjunction";predicate:string;subjectsCapture:string;objectCapture:string}
  | {kind:"assert-universal";classCapture:string;propertyPredicate:string;propertyValueCapture:string}
  | {kind:"query-binary-object";predicate:string;subjectCapture:string}
  | {kind:"query-binary-truth";predicate:string;subjectCapture:string;objectCapture:string}
  | {kind:"query-binary-predicate";predicateFamily:string;subjectCapture:string;objectCapture:string}
  | {kind:"query-count";predicate:string;subjectCapture:string}
  | {kind:"query-set";predicate:string;subjectCapture:string}
  | {kind:"query-class-property";classCapture:string;propertyPredicate:string}
  | {kind:"assert-event";frameId:string;roles:Record<string,string>}
  | {kind:"query-event-role";frameId:string;targetRole:string;constraints:Record<string,string>};
export interface GrammarRule {id:string;pattern:string;semantics:GrammarSemantics;provenance:string[];confidence?:number}

interface StoredRule extends GrammarRule {tokens:string[]}

function tokenizePattern(pattern:string):string[]{return norm(pattern).split(" ").filter(Boolean)}
function captureName(token:string):string|undefined{const m=/^\{([a-z][a-z0-9_-]*)\}$/.exec(token);return m?.[1]}
function match(rule:StoredRule,text:string):Record<string,string>|undefined{
  const input=norm(text).split(" ").filter(Boolean), pattern=rule.tokens;
  if(input.length!==pattern.length) return undefined;
  const captures:Record<string,string>={};
  for(let i=0;i<pattern.length;i++){
    const cap=captureName(pattern[i]!);
    if(cap) captures[cap]=input[i]!;
    else if(pattern[i]!==input[i]) return undefined;
  }
  return captures;
}

export function storeGrammarRule(graph:GraphStore,rule:GrammarRule):void{
  if(!rule.provenance.length) throw new Error("grammar rule provenance is required");
  const tokens=tokenizePattern(rule.pattern);
  const captures=new Set(tokens.map(captureName).filter(Boolean));
  const s=rule.semantics;
  const required = s.kind==="assert-binary" ? [s.subjectCapture,s.objectCapture]
    : s.kind==="assert-binary-negation" ? [s.subjectCapture,s.objectCapture]
    : s.kind==="assert-binary-conjunction" ? [s.subjectsCapture,s.objectCapture]
    : s.kind==="assert-universal" ? [s.classCapture,s.propertyValueCapture]
    : s.kind==="query-binary-object" ? [s.subjectCapture]
    : s.kind==="query-binary-truth" ? [s.subjectCapture,s.objectCapture]
    : s.kind==="query-binary-predicate" ? [s.subjectCapture,s.objectCapture]
    : s.kind==="query-count" ? [s.subjectCapture]
    : s.kind==="query-set" ? [s.subjectCapture]
    : s.kind==="query-class-property" ? [s.classCapture]
    : s.kind==="assert-event" ? Object.values(s.roles)
    : s.kind==="query-event-role" ? Object.values(s.constraints)
    : [];
  if(required.some(x=>!captures.has(x))) throw new Error("grammar semantics references an absent capture");
  graph.putEntity({id:`grammar:${safe(rule.id)}`,kind:"grammar_rule",labels:["learned-grammar",rule.semantics.kind],attrs:{...rule,tokens,confidence:rule.confidence??.9,durable:true,status:"active"}});
}

function rules(graph:GraphStore):StoredRule[]{
  return graph.entitiesByKind("grammar_rule").filter(e=>e.attrs?.status!=="deprecated").map(e=>e.attrs as unknown as StoredRule);
}

function ensureConcept(graph:GraphStore,id:string,label:string,role:string):string{
  const eid=`world:${role}:${safe(id)}`;
  if(!graph.getEntity(eid)) graph.putEntity({id:eid,kind:"concept",labels:["world-entity",role,norm(label)],attrs:{name:norm(label),role}});
  return eid;
}

export function assertWorldFact(graph:GraphStore,args:{subject:string;predicate:string;object:string;provenance:string[]}):string{
  if(!args.provenance.length) throw new Error("world fact provenance is required");
  const subjectName=norm(args.subject), objectName=norm(args.object);
  const predicateDef=graph.getEntity(`predicate:${safe(args.predicate)}`);
  if(predicateDef?.attrs?.functionalObject===true){
    for(const old of graph.entitiesByKind("fact").filter(f=>f.attrs?.active!==false&&f.attrs?.subject===subjectName&&f.attrs?.predicate===args.predicate))
      graph.putEntity({...old,attrs:{...(old.attrs??{}),active:false,superseded:true}});
  }
  const subject=ensureConcept(graph,subjectName,subjectName,"entity"), object=ensureConcept(graph,objectName,objectName,"value");
  const sequence=graph.entitiesByKind("fact").length;
  const fact=`fact:${sequence}:${safe(subjectName)}:${safe(args.predicate)}:${safe(objectName)}`;
  graph.putEntity({id:fact,kind:"fact",labels:["world-fact",args.predicate],attrs:{subject:subjectName,predicate:args.predicate,object:objectName,sequence,provenance:args.provenance,active:true}});
  graph.putRelation({id:`${fact}:subject:${subject}`,kind:"fact_subject",from:fact,to:subject,confidence:1});
  graph.putRelation({id:`${fact}:object:${object}`,kind:"fact_object",from:fact,to:object,confidence:1});
  return fact;
}

export function queryLatestWorldFact(graph:GraphStore,subject:string,predicate:string):JsonValue|undefined{
  const candidates=graph.entitiesByKind("fact")
    .filter(f=>f.attrs?.subject===norm(subject)&&f.attrs?.predicate===predicate&&f.attrs?.active!==false)
    .sort((a,b)=>Number(b.attrs?.sequence??0)-Number(a.attrs?.sequence??0));
  return candidates.length?String(candidates[0]!.attrs!.object):undefined;
}

export interface EventFrameDefinition {id:string;eventType:string;roles:string[];description?:string;provenance:string[]}

export function storeEventFrameDefinition(graph:GraphStore,def:EventFrameDefinition):void{
  if(!def.provenance.length) throw new Error("event frame provenance is required");
  if(!def.roles.length) throw new Error("event frame requires roles");
  graph.putEntity({id:`frame:${safe(def.id)}`,kind:"frame",labels:["semantic-frame",def.id,def.eventType],attrs:{frameId:def.id,eventType:def.eventType,roles:[...new Set(def.roles)],description:def.description,provenance:def.provenance,durable:true,status:"active"}});
}

export function assertWorldEvent(graph:GraphStore,args:{frameId:string;roles:Record<string,string>;provenance:string[]}):string{
  if(!args.provenance.length) throw new Error("world event provenance is required");
  const frame=graph.getEntity(`frame:${safe(args.frameId)}`);
  if(!frame) throw new Error(`unknown semantic frame ${args.frameId}`);
  const allowed=new Set(Array.isArray(frame.attrs?.roles)?frame.attrs!.roles as string[]:[]);
  for(const role of Object.keys(args.roles)) if(!allowed.has(role)) throw new Error(`unknown role ${role} for frame ${args.frameId}`);
  const sequence=graph.entitiesByKind("event").length;
  const normalized=Object.fromEntries(Object.entries(args.roles).map(([k,v])=>[k,norm(v)]));
  const id=`event:${sequence}:${safe(args.frameId)}`;
  graph.putEntity({id,kind:"event",labels:["world-event",String(frame.attrs?.eventType??args.frameId),args.frameId],attrs:{frameId:args.frameId,eventType:frame.attrs?.eventType,roles:normalized,sequence,provenance:args.provenance,active:true}});
  for(const [role,value] of Object.entries(normalized)){
    const target=ensureConcept(graph,value,value,"entity");
    graph.putRelation({id:`${id}:role:${safe(role)}:${target}`,kind:`event_role:${role}`,from:id,to:target,confidence:1});
  }
  return id;
}

export function queryLatestWorldEventRole(graph:GraphStore,frameId:string,targetRole:string,constraints:Record<string,string>):JsonValue|undefined{
  const wanted=Object.fromEntries(Object.entries(constraints).map(([k,v])=>[k,norm(v)]));
  const events=graph.entitiesByKind("event").filter(e=>e.attrs?.active!==false&&e.attrs?.frameId===frameId).sort((a,b)=>Number(b.attrs?.sequence??0)-Number(a.attrs?.sequence??0));
  for(const event of events){
    const roles=(event.attrs?.roles??{}) as Record<string,string>;
    if(Object.entries(wanted).every(([k,v])=>roles[k]===v) && roles[targetRole]!==undefined) return roles[targetRole]!;
  }
  return undefined;
}

export function queryWorldRelation(graph:GraphStore,subject:string,object:string,predicateFamily:string):JsonValue|undefined{
  const s=norm(subject),o=norm(object);
  const candidates=graph.entitiesByKind("fact").filter(f=>f.attrs?.active!==false&&f.attrs?.subject===s&&f.attrs?.object===o).sort((a,b)=>Number(b.attrs?.sequence??0)-Number(a.attrs?.sequence??0));
  for(const fact of candidates){
    const def=graph.getEntity(`predicate:${safe(String(fact.attrs?.predicate??""))}`);
    if(def?.attrs?.family!==predicateFamily) continue;
    return String(def.attrs?.answerLabel??def.attrs?.predicate??fact.attrs?.predicate);
  }
  return undefined;
}

export function queryWorldFactTruth(graph:GraphStore,subject:string,predicate:string,object:string):JsonValue{
  const s=norm(subject),o=norm(object);
  const exists=graph.entitiesByKind("fact").some(f=>f.attrs?.active!==false&&f.attrs?.subject===s&&f.attrs?.predicate===predicate&&f.attrs?.object===o);
  return exists?"yes":"no";
}

export function queryWorldFactCount(graph:GraphStore,subject:string,predicate:string):JsonValue{
  const s=norm(subject);
  return graph.entitiesByKind("fact").filter(f=>f.attrs?.active!==false&&f.attrs?.subject===s&&f.attrs?.predicate===predicate).length;
}

export function queryWorldFactSet(graph:GraphStore,subject:string,predicate:string):JsonValue{
  const s=norm(subject);
  return graph.entitiesByKind("fact").filter(f=>f.attrs?.active!==false&&f.attrs?.subject===s&&f.attrs?.predicate===predicate).sort((a,b)=>Number(a.attrs?.sequence??0)-Number(b.attrs?.sequence??0)).map(f=>String(f.attrs!.object));
}

export function retractWorldFact(graph:GraphStore,subject:string,predicate:string,object:string):void{
  const s=norm(subject),o=norm(object);
  for(const f of graph.entitiesByKind("fact").filter(f=>f.attrs?.active!==false&&f.attrs?.subject===s&&f.attrs?.predicate===predicate&&f.attrs?.object===o))
    graph.putEntity({...f,attrs:{...(f.attrs??{}),active:false,retracted:true}});
}

export function assertUniversalRule(graph:GraphStore,className:string,propertyPredicate:string,propertyValue:string,provenance:string[]):string{
  const id=`universal:${safe(className)}:${safe(propertyPredicate)}:${safe(propertyValue)}`;
  graph.putEntity({id,kind:"inference_rule",labels:["universal-rule","learned-inference"],attrs:{
    id,kind:"universal",className:norm(className),propertyPredicate,propertyValue:norm(propertyValue),provenance,confidence:.9,durable:true,status:"active"
  }});
  return id;
}

export function queryClassProperty(graph:GraphStore,instanceName:string,propertyPredicate:string):JsonValue|undefined{
  const inst=norm(instanceName);
  const directFact=graph.entitiesByKind("fact").find(f=>f.attrs?.active!==false&&f.attrs?.subject===inst&&f.attrs?.predicate===propertyPredicate);
  if(directFact) return String(directFact.attrs!.object);
  const classFacts=graph.entitiesByKind("fact").filter(f=>f.attrs?.active!==false&&f.attrs?.subject===inst&&f.attrs?.predicate==="is_a");
  for(const cf of classFacts){
    const className=norm(String(cf.attrs!.object));
    const plurals=[className, className+"s", className+"es"];
    const rules=graph.entitiesByKind("inference_rule").filter(r=>r.attrs?.kind==="universal"&&plurals.includes(norm(String(r.attrs?.className??"")))&&r.attrs?.propertyPredicate===propertyPredicate&&r.attrs?.status!=="deprecated");
    if(rules.length) return String(rules[0]!.attrs!.propertyValue);
  }
  return undefined;
}

export class WorldLanguageEngine {
  constructor(private readonly graph:GraphStore){}
  ingest(line:string):{understood:boolean;ruleId?:string;factId?:string;eventId?:string}{
    for(const rule of rules(this.graph)){
      const c=match(rule,line); if(!c) continue;
      const prov=[...rule.provenance,`grammar:${rule.id}`,`utterance:${line}`];
      if(rule.semantics.kind==="assert-binary"){
        const factId=assertWorldFact(this.graph,{subject:c[rule.semantics.subjectCapture]!,predicate:rule.semantics.predicate,object:c[rule.semantics.objectCapture]!,provenance:prov});
        return {understood:true,ruleId:rule.id,factId};
      }
      if(rule.semantics.kind==="assert-binary-negation"){
        retractWorldFact(this.graph,c[rule.semantics.subjectCapture]!,rule.semantics.predicate,c[rule.semantics.objectCapture]!);
        return {understood:true,ruleId:rule.id};
      }
      if(rule.semantics.kind==="assert-binary-conjunction"){
        const sem=rule.semantics;
        const allCaptures=Object.entries(c).filter(([k])=>k!==sem.objectCapture).map(([,v])=>v);
        const object=c[sem.objectCapture]!;
        let lastFactId:string|undefined;
        for(const subject of allCaptures){
          lastFactId=assertWorldFact(this.graph,{subject,predicate:rule.semantics.predicate,object,provenance:prov});
        }
        return {understood:true,ruleId:rule.id,factId:lastFactId};
      }
      if(rule.semantics.kind==="assert-universal"){
        const className=c[rule.semantics.classCapture]!;
        const propertyValue=c[rule.semantics.propertyValueCapture]!;
        assertUniversalRule(this.graph,className,rule.semantics.propertyPredicate,propertyValue,prov);
        return {understood:true,ruleId:rule.id};
      }
      if(rule.semantics.kind==="assert-event"){
        const roles=Object.fromEntries(Object.entries(rule.semantics.roles).map(([role,capture])=>[role,c[capture]!]));
        const eventId=assertWorldEvent(this.graph,{frameId:rule.semantics.frameId,roles,provenance:prov});
        return {understood:true,ruleId:rule.id,eventId};
      }
    }
    return {understood:false};
  }
  answer(question:string):{answer?:JsonValue;abstained:boolean;ruleId?:string}{
    deriveWorldFacts(this.graph);
    for(const rule of rules(this.graph)){
      const c=match(rule,question); if(!c) continue;
      if(rule.semantics.kind==="query-binary-object"){
        const answer=queryLatestWorldFact(this.graph,c[rule.semantics.subjectCapture]!,rule.semantics.predicate);
        return answer===undefined?{abstained:true,ruleId:rule.id}:{answer,abstained:false,ruleId:rule.id};
      }
      if(rule.semantics.kind==="query-binary-truth"){
        const answer=queryWorldFactTruth(this.graph,c[rule.semantics.subjectCapture]!,rule.semantics.predicate,c[rule.semantics.objectCapture]!);
        return {answer,abstained:false,ruleId:rule.id};
      }
      if(rule.semantics.kind==="query-binary-predicate"){
        const answer=queryWorldRelation(this.graph,c[rule.semantics.subjectCapture]!,c[rule.semantics.objectCapture]!,rule.semantics.predicateFamily);
        return answer===undefined?{abstained:true,ruleId:rule.id}:{answer,abstained:false,ruleId:rule.id};
      }
      if(rule.semantics.kind==="query-count"){
        const answer=queryWorldFactCount(this.graph,c[rule.semantics.subjectCapture]!,rule.semantics.predicate);
        return {answer,abstained:false,ruleId:rule.id};
      }
      if(rule.semantics.kind==="query-set"){
        const answer=queryWorldFactSet(this.graph,c[rule.semantics.subjectCapture]!,rule.semantics.predicate);
        return {answer,abstained:false,ruleId:rule.id};
      }
      if(rule.semantics.kind==="query-class-property"){
        const answer=queryClassProperty(this.graph,c[rule.semantics.classCapture]!,rule.semantics.propertyPredicate);
        return answer===undefined?{abstained:true,ruleId:rule.id}:{answer,abstained:false,ruleId:rule.id};
      }
      if(rule.semantics.kind==="query-event-role"){
        const constraints=Object.fromEntries(Object.entries(rule.semantics.constraints).map(([role,capture])=>[role,c[capture]!]));
        const answer=queryLatestWorldEventRole(this.graph,rule.semantics.frameId,rule.semantics.targetRole,constraints);
        return answer===undefined?{abstained:true,ruleId:rule.id}:{answer,abstained:false,ruleId:rule.id};
      }
    }
    return {abstained:true};
  }
  runStory(story:string[],question:string){
    const understood=story.map(line=>this.ingest(line));
    return {...this.answer(question),understood};
  }
}

export function starterLocationGrammar():GrammarRule[]{return [
  {id:"english.location.went-to",pattern:"{subject} went to the {place}",semantics:{kind:"assert-binary",predicate:"located_in",subjectCapture:"subject",objectCapture:"place"},provenance:["teacher:gpt-5.6-sol","curriculum:babi-location"]},
  {id:"english.location.is-in",pattern:"{subject} is in the {place}",semantics:{kind:"assert-binary",predicate:"located_in",subjectCapture:"subject",objectCapture:"place"},provenance:["teacher:curriculum","curriculum:babi-location"]},
  {id:"english.location.where-is",pattern:"where is {subject}",semantics:{kind:"query-binary-object",predicate:"located_in",subjectCapture:"subject"},provenance:["teacher:gpt-5.6-sol","curriculum:babi-location"]},
  {id:"english.location.where-is-the",pattern:"where is the {subject}",semantics:{kind:"query-binary-object",predicate:"located_in",subjectCapture:"subject"},provenance:["teacher:gpt-5.6-sol","curriculum:babi-location"]},
]}

export interface PredicateDefinition {id:string;functionalObject?:boolean;family?:string;answerLabel?:string;inverseOf?:string;description?:string;provenance:string[]}
export interface RuleAtom {subject:string;predicate:string;object:string}
export interface InferenceRule {id:string;premises:RuleAtom[];conclusion:RuleAtom;provenance:string[];confidence?:number}

export function storePredicateDefinition(graph:GraphStore,def:PredicateDefinition):void{
  if(!def.provenance.length) throw new Error("predicate definition provenance is required");
  const id=`predicate:${safe(def.id)}`;
  graph.putEntity({id,kind:"concept",labels:["predicate",def.id],attrs:{predicate:def.id,functionalObject:!!def.functionalObject,family:def.family,answerLabel:def.answerLabel,inverseOf:def.inverseOf,description:def.description,provenance:def.provenance}});
}

export function storeInferenceRule(graph:GraphStore,rule:InferenceRule):void{
  if(!rule.provenance.length) throw new Error("inference rule provenance is required");
  if(!rule.premises.length) throw new Error("inference rule requires premises");
  graph.putEntity({id:`inference:${safe(rule.id)}`,kind:"inference_rule",labels:["learned-inference"],attrs:{...rule,confidence:rule.confidence??.95,durable:true,status:"active"}});
}

interface Triple {subject:string;predicate:string;object:string;factId:string;sequence:number}
function activeTriples(graph:GraphStore):Triple[]{
  if(hasCypher(graph)){
    const rows=graph.cypher("MATCH (f:EKGEntity) WHERE f.kind='fact' RETURN f.id AS id, f.attrsJson AS attrsJson");
    const triples:Triple[]=[];
    for(const row of rows){
      const id=String(row.id);
      const attrsJson=row.attrsJson;
      if(typeof attrsJson!=="string") continue;
      let attrs:Record<string,unknown>;
      try{attrs=JSON.parse(attrsJson)}catch{continue}
      if(attrs.active===false) continue;
      triples.push({subject:String(attrs.subject),predicate:String(attrs.predicate),object:String(attrs.object),factId:id,sequence:Number(attrs.sequence??0)});
    }
    return triples;
  }
  return graph.entitiesByKind("fact").filter(f=>f.attrs?.active!==false).map(f=>({subject:String(f.attrs!.subject),predicate:String(f.attrs!.predicate),object:String(f.attrs!.object),factId:f.id,sequence:Number(f.attrs!.sequence??0)}));
}
const variable=(x:string)=>x.startsWith("?");
function unifyTerm(pattern:string,value:string,b:Record<string,string>):Record<string,string>|undefined{
  if(!variable(pattern)) return pattern===value?b:undefined;
  const old=b[pattern]; if(old!==undefined&&old!==value) return undefined;
  return {...b,[pattern]:value};
}
function unifyAtom(atom:RuleAtom,fact:Triple,b:Record<string,string>):Record<string,string>|undefined{
  if(atom.predicate!==fact.predicate) return undefined;
  let x=unifyTerm(atom.subject,fact.subject,b); if(!x)return undefined;
  x=unifyTerm(atom.object,fact.object,x); return x;
}
function subst(x:string,b:Record<string,string>):string|undefined{return variable(x)?b[x]:x}

/** Generic forward-chaining over graph-stored Horn-style binary rules. */
export function deriveWorldFacts(graph:GraphStore,maxRounds=6):string[]{
  const created:string[]=[];
  // Relation properties are durable learned semantics. Materialize inverse relations generically.
  let triples=activeTriples(graph);
  for(const fact of triples){
    const def=graph.getEntity(`predicate:${safe(fact.predicate)}`);
    const inverse=typeof def?.attrs?.inverseOf==="string"?String(def.attrs.inverseOf):undefined;
    if(!inverse) continue;
    if(triples.some(f=>f.subject===fact.object&&f.predicate===inverse&&f.object===fact.subject)) continue;
    const factId=assertWorldFact(graph,{subject:fact.object,predicate:inverse,object:fact.subject,provenance:[...(Array.isArray(def?.attrs?.provenance)?def!.attrs!.provenance as string[]:[]),`inverse-of:${fact.predicate}`,`derived-from:${fact.factId}`]});
    created.push(factId);
    triples=[...triples,{subject:fact.object,predicate:inverse,object:fact.subject,factId,sequence:triples.length}];
  }
  const ruleEntities=graph.entitiesByKind("inference_rule").filter(r=>r.attrs?.status!=="deprecated"&&r.attrs?.kind!=="universal"&&Array.isArray(r.attrs?.premises));
  for(let round=0;round<maxRounds;round++){
    let changed=false;
    triples=activeTriples(graph);
    for(const entity of ruleEntities){
      const rule=entity.attrs as unknown as InferenceRule;
      let bindings:Record<string,string>[]=[{}];
      for(const premise of rule.premises){
        const facts=triples; const next:Record<string,string>[]=[];
        for(const b of bindings) for(const f of facts){const u=unifyAtom(premise,f,b);if(u)next.push(u)}
        bindings=next; if(!bindings.length)break;
      }
      for(const b of bindings){
        const subject=subst(rule.conclusion.subject,b), object=subst(rule.conclusion.object,b);
        if(!subject||!object) continue;
        if(triples.some(f=>f.subject===subject&&f.predicate===rule.conclusion.predicate&&f.object===object)) continue;
        const factId=assertWorldFact(graph,{subject,predicate:rule.conclusion.predicate,object,provenance:[...rule.provenance,`derived-by:${rule.id}`]});
        created.push(factId); changed=true;
        triples=[...triples,{subject,predicate:rule.conclusion.predicate,object,factId,sequence:triples.length}];
      }
    }
    if(!changed)break;
  }
  return created;
}

export function starterPossessionGrammar():GrammarRule[]{return [
  {id:"english.possession.picked-up",pattern:"{subject} picked up the {object}",semantics:{kind:"assert-binary",predicate:"possesses",subjectCapture:"subject",objectCapture:"object"},provenance:["teacher:gpt-5.6-sol","curriculum:babi-possession"]},
  {id:"english.possession.is-carrying",pattern:"{subject} is carrying a {object}",semantics:{kind:"assert-binary",predicate:"possesses",subjectCapture:"subject",objectCapture:"object"},provenance:["teacher:curriculum","curriculum:babi-possession"]},
]}
export function possessionLocationInference():InferenceRule{return {
  id:"possessed-object-follows-holder-location",
  premises:[
    {subject:"?holder",predicate:"possesses",object:"?item"},
    {subject:"?holder",predicate:"located_in",object:"?place"},
  ],
  conclusion:{subject:"?item",predicate:"located_in",object:"?place"},
  provenance:["teacher:gpt-5.6-sol","curriculum:babi-possession","rule:general-world-model"]
}}

export function starterSpatialPredicates():PredicateDefinition[]{return [
  {id:"north_of",family:"direction",answerLabel:"north",inverseOf:"south_of",description:"subject is north of object",provenance:["teacher:gpt-5.6-sol","curriculum:babi-spatial"]},
  {id:"south_of",family:"direction",answerLabel:"south",inverseOf:"north_of",description:"subject is south of object",provenance:["teacher:gpt-5.6-sol","curriculum:babi-spatial"]},
  {id:"east_of",family:"direction",answerLabel:"east",inverseOf:"west_of",description:"subject is east of object",provenance:["teacher:gpt-5.6-sol","curriculum:babi-spatial"]},
  {id:"west_of",family:"direction",answerLabel:"west",inverseOf:"east_of",description:"subject is west of object",provenance:["teacher:gpt-5.6-sol","curriculum:babi-spatial"]},
]}
export function starterSpatialGrammar():GrammarRule[]{return [
  {id:"english.spatial.north-of",pattern:"the {subject} is north of the {object}",semantics:{kind:"assert-binary",predicate:"north_of",subjectCapture:"subject",objectCapture:"object"},provenance:["teacher:gpt-5.6-sol","curriculum:babi-spatial"]},
  {id:"english.spatial.south-of",pattern:"the {subject} is south of the {object}",semantics:{kind:"assert-binary",predicate:"south_of",subjectCapture:"subject",objectCapture:"object"},provenance:["teacher:gpt-5.6-sol","curriculum:babi-spatial"]},
  {id:"english.spatial.east-of",pattern:"the {subject} is east of the {object}",semantics:{kind:"assert-binary",predicate:"east_of",subjectCapture:"subject",objectCapture:"object"},provenance:["teacher:gpt-5.6-sol","curriculum:babi-spatial"]},
  {id:"english.spatial.west-of",pattern:"the {subject} is west of the {object}",semantics:{kind:"assert-binary",predicate:"west_of",subjectCapture:"subject",objectCapture:"object"},provenance:["teacher:gpt-5.6-sol","curriculum:babi-spatial"]},
  {id:"english.spatial.direction-from",pattern:"what direction is the {subject} from the {object}",semantics:{kind:"query-binary-predicate",predicateFamily:"direction",subjectCapture:"subject",objectCapture:"object"},provenance:["teacher:gpt-5.6-sol","curriculum:babi-spatial"]},
]}
export function starterGivingFrame():EventFrameDefinition{return {id:"Giving",eventType:"give",roles:["agent","theme","recipient"],description:"transfer event with giver, transferred item, and recipient",provenance:["teacher:gpt-5.6-sol","curriculum:babi-semantic-roles"]}}
export function starterGivingGrammar():GrammarRule[]{return [
  {id:"english.giving.gave-to",pattern:"{giver} gave the {theme} to {recipient}",semantics:{kind:"assert-event",frameId:"Giving",roles:{agent:"giver",theme:"theme",recipient:"recipient"}},provenance:["teacher:gpt-5.6-sol","curriculum:babi-semantic-roles"]},
  {id:"english.giving.who-recipient",pattern:"who did {giver} give the {theme} to",semantics:{kind:"query-event-role",frameId:"Giving",targetRole:"recipient",constraints:{agent:"giver",theme:"theme"}},provenance:["teacher:gpt-5.6-sol","curriculum:babi-semantic-roles"]},
]}

// bAbI-06: yes/no questions
export function starterTruthGrammar():GrammarRule[]{return [
  {id:"english.truth.is-in-the",pattern:"is {subject} in the {place}",semantics:{kind:"query-binary-truth",predicate:"located_in",subjectCapture:"subject",objectCapture:"place"},provenance:["teacher:curriculum","curriculum:babi-yes-no"]},
  {id:"english.truth.is-carrying",pattern:"is {subject} carrying a {item}",semantics:{kind:"query-binary-truth",predicate:"possesses",subjectCapture:"subject",objectCapture:"item"},provenance:["teacher:curriculum","curriculum:babi-yes-no"]},
]}

// bAbI-07/08: counting and set queries
export function starterCountSetGrammar():GrammarRule[]{return [
  {id:"english.count.carrying",pattern:"how many things is {subject} carrying",semantics:{kind:"query-count",predicate:"possesses",subjectCapture:"subject"},provenance:["teacher:curriculum","curriculum:babi-counting"]},
  {id:"english.set.carrying",pattern:"what is {subject} carrying",semantics:{kind:"query-set",predicate:"possesses",subjectCapture:"subject"},provenance:["teacher:curriculum","curriculum:babi-sets"]},
]}

// bAbI-09: negation
export function starterNegationGrammar():GrammarRule[]{return [
  {id:"english.negation.not-in",pattern:"{subject} is not in the {place}",semantics:{kind:"assert-binary-negation",predicate:"located_in",subjectCapture:"subject",objectCapture:"place"},provenance:["teacher:curriculum","curriculum:babi-negation"]},
]}

// bAbI-12: conjunction
export function starterConjunctionGrammar():GrammarRule[]{return [
  {id:"english.conjunction.and-went-to",pattern:"{subject1} and {subject2} went to the {place}",semantics:{kind:"assert-binary-conjunction",predicate:"located_in",subjectsCapture:"subject1",objectCapture:"place"},provenance:["teacher:curriculum","curriculum:babi-conjunction"]},
]}

// bAbI-15: basic deduction
export function starterDeductionGrammar():GrammarRule[]{return [
  {id:"english.class.is-a",pattern:"{instance} is a {class}",semantics:{kind:"assert-binary",predicate:"is_a",subjectCapture:"instance",objectCapture:"class"},provenance:["teacher:curriculum","curriculum:babi-deduction"]},
  {id:"english.class.is-a-and-property",pattern:"{instance} is a {class} and {instance2} is {value}",semantics:{kind:"assert-binary",predicate:"is_a",subjectCapture:"instance",objectCapture:"class"},provenance:["teacher:curriculum","curriculum:babi-deduction"]},
  {id:"english.universal.all-are",pattern:"all {class} are {value}",semantics:{kind:"assert-universal",classCapture:"class",propertyPredicate:"has_property",propertyValueCapture:"value"},provenance:["teacher:curriculum","curriculum:babi-deduction"]},
  {id:"english.query.what-property",pattern:"what color is {instance}",semantics:{kind:"query-class-property",classCapture:"instance",propertyPredicate:"has_property"},provenance:["teacher:curriculum","curriculum:babi-deduction"]},
]}

// bAbI-17: positional transitivity (spatial relations compose through shared intermediate)
export function spatialTransitivityInference():InferenceRule{return {
  id:"spatial-transitivity-left",
  premises:[
    {subject:"?a",predicate:"left_of",object:"?b"},
    {subject:"?b",predicate:"left_of",object:"?c"},
  ],
  conclusion:{subject:"?a",predicate:"left_of",object:"?c"},
  provenance:["teacher:curriculum","curriculum:babi-positional","rule:transitivity"]
}}

export function starterPositionalPredicates():PredicateDefinition[]{return [
  {id:"left_of",family:"position",answerLabel:"left",inverseOf:"right_of",description:"subject is left of object",provenance:["teacher:curriculum","curriculum:babi-positional"]},
  {id:"right_of",family:"position",answerLabel:"right",inverseOf:"left_of",description:"subject is right of object",provenance:["teacher:curriculum","curriculum:babi-positional"]},
]}

export function starterPositionalGrammar():GrammarRule[]{return [
  {id:"english.position.left-of",pattern:"the {subject} is left of the {object}",semantics:{kind:"assert-binary",predicate:"left_of",subjectCapture:"subject",objectCapture:"object"},provenance:["teacher:curriculum","curriculum:babi-positional"]},
  {id:"english.position.right-of",pattern:"the {subject} is right of the {object}",semantics:{kind:"assert-binary",predicate:"right_of",subjectCapture:"subject",objectCapture:"object"},provenance:["teacher:curriculum","curriculum:babi-positional"]},
  {id:"english.position.where-relative",pattern:"where is the {subject} relative to the {object}",semantics:{kind:"query-binary-predicate",predicateFamily:"position",subjectCapture:"subject",objectCapture:"object"},provenance:["teacher:curriculum","curriculum:babi-positional"]},
]}

// bAbI-18: size transitivity
export function starterSizePredicates():PredicateDefinition[]{return [
  {id:"bigger_than",family:"size",answerLabel:"bigger",inverseOf:"smaller_than",description:"subject is bigger than object",provenance:["teacher:curriculum","curriculum:babi-size"]},
  {id:"smaller_than",family:"size",answerLabel:"smaller",inverseOf:"bigger_than",description:"subject is smaller than object",provenance:["teacher:curriculum","curriculum:babi-size"]},
]}

export function starterSizeGrammar():GrammarRule[]{return [
  {id:"english.size.bigger-than",pattern:"the {subject} is bigger than the {object}",semantics:{kind:"assert-binary",predicate:"bigger_than",subjectCapture:"subject",objectCapture:"object"},provenance:["teacher:curriculum","curriculum:babi-size"]},
  {id:"english.size.how-sized",pattern:"how is the {subject} sized relative to the {object}",semantics:{kind:"query-binary-predicate",predicateFamily:"size",subjectCapture:"subject",objectCapture:"object"},provenance:["teacher:curriculum","curriculum:babi-size"]},
]}

export function sizeTransitivityInference():InferenceRule{return {
  id:"size-transitivity-bigger",
  premises:[
    {subject:"?a",predicate:"bigger_than",object:"?b"},
    {subject:"?b",predicate:"bigger_than",object:"?c"},
  ],
  conclusion:{subject:"?a",predicate:"bigger_than",object:"?c"},
  provenance:["teacher:curriculum","curriculum:babi-size","rule:transitivity"]
}}
