import type { Type } from "../ir/types.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import { typeEquals } from "../ir/types.js";
import type { GraphStore } from "../graph/graph.js";

export interface SemanticCapabilityDescriptor {
  relation:string;
  concept:string;
  capabilityId:string;
  gloss:string;
  phrases:string[];
  antonymOf?:string;
}

/**
 * Human-facing semantic names for the portable substrate. This is curriculum,
 * not hidden execution logic: every relation still resolves to an explicit
 * capability entity in the graph and is type checked before execution.
 */
export const PORTABLE_SEMANTIC_CATALOG:SemanticCapabilityDescriptor[]=[
  {relation:"Add",concept:"math.add",capabilityId:"core.add_int",gloss:"add two integers",phrases:["add","plus","sum","increase by"]},
  {relation:"Subtract",concept:"math.subtract",capabilityId:"core.sub_int",gloss:"subtract the second integer from the first",phrases:["subtract","minus","take away","deduct"],antonymOf:"Add"},
  {relation:"Multiply",concept:"math.multiply",capabilityId:"core.mul_int",gloss:"multiply two integers",phrases:["multiply","times","product"]},
  {relation:"Divide",concept:"math.divide",capabilityId:"core.div_trunc_int",gloss:"integer division truncated toward zero",phrases:["divide","quotient"]},
  {relation:"Modulo",concept:"math.modulo",capabilityId:"core.mod_trunc_int",gloss:"integer remainder with truncation toward zero",phrases:["modulo","mod","remainder"]},
  {relation:"Negate",concept:"math.negate",capabilityId:"core.neg_int",gloss:"arithmetic negation",phrases:["negate","negative of"]},
  {relation:"Absolute",concept:"math.absolute",capabilityId:"core.abs_int",gloss:"absolute value",phrases:["absolute value","magnitude"]},
  {relation:"Minimum",concept:"order.minimum",capabilityId:"core.min_int",gloss:"smaller of two integers",phrases:["minimum","min","smaller","smallest"],antonymOf:"Maximum"},
  {relation:"Maximum",concept:"order.maximum",capabilityId:"core.max_int",gloss:"larger of two integers",phrases:["maximum","max","larger","largest"],antonymOf:"Minimum"},
  {relation:"EqualInt",concept:"comparison.equal.integer",capabilityId:"core.eq_int",gloss:"integer equality",phrases:["equals","equal to","same as"]},
  {relation:"NotEqualInt",concept:"comparison.not-equal.integer",capabilityId:"core.ne_int",gloss:"integer inequality",phrases:["not equal","different from"]},
  {relation:"LessThan",concept:"comparison.less-than",capabilityId:"core.lt_int",gloss:"strict integer less-than",phrases:["less than","smaller than"]},
  {relation:"LessOrEqual",concept:"comparison.less-or-equal",capabilityId:"core.lte_int",gloss:"integer less-than or equal",phrases:["at most","less than or equal"]},
  {relation:"GreaterThan",concept:"comparison.greater-than",capabilityId:"core.gt_int",gloss:"strict integer greater-than",phrases:["greater than","more than"]},
  {relation:"GreaterOrEqual",concept:"comparison.greater-or-equal",capabilityId:"core.gte_int",gloss:"integer greater-than or equal",phrases:["at least","greater than or equal"]},

  {relation:"BooleanNot",concept:"logic.not",capabilityId:"core.not_bool",gloss:"logical negation",phrases:["not","negate boolean"]},
  {relation:"BooleanAnd",concept:"logic.and",capabilityId:"core.and_bool",gloss:"logical conjunction",phrases:["and","both"]},
  {relation:"BooleanOr",concept:"logic.or",capabilityId:"core.or_bool",gloss:"logical disjunction",phrases:["or","either"]},

  {relation:"StringLength",concept:"string.length",capabilityId:"core.string_len",gloss:"Unicode code-point length of a string",phrases:["string length","length of text","how long"]},
  {relation:"StringConcat",concept:"string.concat",capabilityId:"core.concat_string",gloss:"concatenate strings",phrases:["concatenate","join text","append text"]},
  {relation:"StringContains",concept:"string.contains",capabilityId:"core.contains_string",gloss:"test whether a string contains another string",phrases:["contains","includes","has substring"]},
  {relation:"StringStartsWith",concept:"string.starts-with",capabilityId:"core.starts_with_string",gloss:"test string prefix",phrases:["starts with","begins with"]},
  {relation:"StringEndsWith",concept:"string.ends-with",capabilityId:"core.ends_with_string",gloss:"test string suffix",phrases:["ends with","finishes with"]},
  {relation:"StringLower",concept:"string.lowercase",capabilityId:"core.ascii_lower_string",gloss:"ASCII lowercase transform",phrases:["lowercase","lower case"]},
  {relation:"StringUpper",concept:"string.uppercase",capabilityId:"core.ascii_upper_string",gloss:"ASCII uppercase transform",phrases:["uppercase","upper case"]},
  {relation:"StringTrim",concept:"string.trim",capabilityId:"core.trim_ascii_string",gloss:"trim ASCII whitespace",phrases:["trim","strip whitespace"]},
  {relation:"StringSplit",concept:"string.split",capabilityId:"core.string_split",gloss:"split string by delimiter",phrases:["split","separate by"]},
  {relation:"StringReplace",concept:"string.replace-all",capabilityId:"core.replace_all_string",gloss:"replace every substring occurrence",phrases:["replace","replace all"]},

  {relation:"ListLengthString",concept:"list.length.string",capabilityId:"core.list_len_string",gloss:"number of strings in a list",phrases:["count strings","number of strings"]},
  {relation:"ListLengthInt",concept:"list.length.integer",capabilityId:"core.list_len_int",gloss:"number of integers in a list",phrases:["count numbers","number of numbers"]},
  {relation:"ListHeadString",concept:"list.head.string",capabilityId:"core.list_head_string",gloss:"first string in a list",phrases:["first string","head string"]},
  {relation:"ListTailString",concept:"list.tail.string",capabilityId:"core.list_tail_string",gloss:"all strings except the first",phrases:["rest of strings","tail strings"]},
  {relation:"ListGetString",concept:"list.index.string",capabilityId:"core.list_get_string",gloss:"string at an integer index",phrases:["string at index","get string index"]},
  {relation:"ListGetInt",concept:"list.index.integer",capabilityId:"core.list_get_int",gloss:"integer at an integer index",phrases:["number at index","get number index"]},
  {relation:"ListSumInt",concept:"list.sum.integer",capabilityId:"core.list_sum_int",gloss:"sum integer list",phrases:["sum list","total numbers"]},
  {relation:"ListReverseString",concept:"list.reverse.string",capabilityId:"core.list_reverse_string",gloss:"reverse string list order",phrases:["reverse strings","reverse list"]},

  {relation:"JsonParse",concept:"json.parse",capabilityId:"core.parse_json",gloss:"parse JSON text into a recursive JSON value",phrases:["parse json","decode json"]},
  {relation:"JsonStringify",concept:"json.stringify",capabilityId:"core.stringify_json",gloss:"serialize JSON value to text",phrases:["stringify json","encode json"]},
  {relation:"ObjectGet",concept:"object.get",capabilityId:"core.json_get",gloss:"retrieve one property from an object by key",phrases:["get property","get key","lookup key","property value"]},
  {relation:"ObjectHas",concept:"object.has-key",capabilityId:"core.json_has",gloss:"test whether an object has a key",phrases:["has key","contains key","property exists"]},
  {relation:"ObjectKeys",concept:"object.keys",capabilityId:"core.json_keys",gloss:"sorted keys of an object",phrases:["object keys","list keys"]},
  {relation:"ObjectValues",concept:"object.values",capabilityId:"core.json_values",gloss:"values of an object in sorted-key order",phrases:["object values","list values"]},
  {relation:"JsonType",concept:"json.type",capabilityId:"core.json_type",gloss:"JSON value type name",phrases:["json type","type of value"]},
];

export function descriptorForRelation(relation:string):SemanticCapabilityDescriptor|undefined{
  return PORTABLE_SEMANTIC_CATALOG.find(x=>x.relation.toLowerCase()===relation.toLowerCase());
}

export function seedSemanticCapabilityGraph(store:GraphStore,caps:CapabilityRegistry):void{
  for(const d of PORTABLE_SEMANTIC_CATALOG){
    let cap; try{cap=caps.get(d.capabilityId)}catch{continue;}
    const relationId=`relation:${d.relation.toLowerCase()}`;
    const conceptId=`concept:semantic:${d.concept}`;
    const capabilityId=`capability:${cap.id}`;
    if(!store.getEntity(relationId)) store.putEntity({id:relationId,kind:"concept",labels:["semantic-relation",d.relation],attrs:{relation:d.relation,concept:d.concept,gloss:d.gloss}});
    if(!store.getEntity(conceptId)) store.putEntity({id:conceptId,kind:"concept",labels:["semantic-concept",d.concept],attrs:{concept:d.concept,gloss:d.gloss}});
    if(!store.getEntity(capabilityId)) store.putEntity({id:capabilityId,kind:"capability",labels:[cap.id],attrs:{capabilityId:cap.id}});
    if(!store.outgoing(relationId,"denotes_concept").some(r=>r.to===conceptId)) store.putRelation({id:`${relationId}:denotes:${conceptId}`,kind:"denotes_concept",from:relationId,to:conceptId,confidence:1});
    if(!store.outgoing(conceptId,"implemented_by").some(r=>r.to===capabilityId)) store.putRelation({id:`${conceptId}:implemented:${capabilityId}`,kind:"implemented_by",from:conceptId,to:capabilityId,confidence:1});
  }
  for(const d of PORTABLE_SEMANTIC_CATALOG.filter(x=>x.antonymOf)){
    const a=`relation:${d.relation.toLowerCase()}`, b=`relation:${d.antonymOf!.toLowerCase()}`;
    if(store.getEntity(a)&&store.getEntity(b)&&!store.outgoing(a,"antonym_of").some(r=>r.to===b))
      store.putRelation({id:`${a}:antonym:${b}`,kind:"antonym_of",from:a,to:b,confidence:1});
  }
}

export function resolveCapabilityForRelation(store:GraphStore|undefined,relation:string,caps:CapabilityRegistry,argTypes:Type[],output?:Type){
  const ids:string[]=[];
  if(store){
    const rid=`relation:${relation.toLowerCase()}`;
    for(const rc of store.outgoing(rid,"denotes_concept")) for(const edge of store.outgoing(rc.to,"implemented_by")){
      const e=store.getEntity(edge.to); const capId=typeof e?.attrs?.capabilityId==="string"?String(e.attrs.capabilityId):edge.to.replace(/^capability:/,"");
      ids.push(capId);
    }
  }
  const fallback=descriptorForRelation(relation)?.capabilityId;
  if(fallback) ids.push(fallback);
  for(const id of [...new Set(ids)]){
    try{
      const cap=caps.get(id);
      if(cap.inputs.length!==argTypes.length) continue;
      if(cap.inputs.some((t,i)=>!typeEquals(t,argTypes[i]!))) continue;
      if(output&&!typeEquals(cap.output,output)) continue;
      return cap;
    }catch{}
  }
  return undefined;
}
