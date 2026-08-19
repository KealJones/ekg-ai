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
  {relation:"Add",concept:"math.add",capabilityId:"core.add_int",gloss:"add two integers",phrases:["add","plus","sum","increase by","add to","combine numbers","total of"]},
  {relation:"Subtract",concept:"math.subtract",capabilityId:"core.sub_int",gloss:"subtract the second integer from the first",phrases:["subtract","minus","take away","deduct","subtract from","take from","decrease by"],antonymOf:"Add"},
  {relation:"Multiply",concept:"math.multiply",capabilityId:"core.mul_int",gloss:"multiply two integers",phrases:["multiply","times","product","multiply by","multiplied by"]},
  {relation:"Divide",concept:"math.divide",capabilityId:"core.div_trunc_int",gloss:"integer division truncated toward zero",phrases:["divide","quotient","divide by","divided by","split into"]},
  {relation:"Modulo",concept:"math.modulo",capabilityId:"core.mod_trunc_int",gloss:"integer remainder with truncation toward zero",phrases:["modulo","mod","remainder","remainder of","leftover after dividing"]},
  {relation:"Negate",concept:"math.negate",capabilityId:"core.neg_int",gloss:"arithmetic negation",phrases:["negate","negative of","flip the sign","opposite of"]},
  {relation:"Absolute",concept:"math.absolute",capabilityId:"core.abs_int",gloss:"absolute value",phrases:["absolute value","magnitude","distance from zero"]},
  {relation:"Minimum",concept:"order.minimum",capabilityId:"core.min_int",gloss:"smaller of two integers",phrases:["minimum","min","smaller","smallest","lowest","the lesser of","pick the smaller"],antonymOf:"Maximum"},
  {relation:"Maximum",concept:"order.maximum",capabilityId:"core.max_int",gloss:"larger of two integers",phrases:["maximum","max","larger","largest","highest","the greater of","pick the bigger"],antonymOf:"Minimum"},
  {relation:"EqualInt",concept:"comparison.equal.integer",capabilityId:"core.eq_int",gloss:"integer equality",phrases:["equals","equal to","same as","is equal to","is the same as","matches"]},
  {relation:"NotEqualInt",concept:"comparison.not-equal.integer",capabilityId:"core.ne_int",gloss:"integer inequality",phrases:["not equal","different from","is not equal to","is different from","doesn't match"]},
  {relation:"LessThan",concept:"comparison.less-than",capabilityId:"core.lt_int",gloss:"strict integer less-than",phrases:["less than","smaller than","is less than","is smaller than","is lower than","below"]},
  {relation:"LessOrEqual",concept:"comparison.less-or-equal",capabilityId:"core.lte_int",gloss:"integer less-than or equal",phrases:["at most","less than or equal","is at most","no more than","is less than or equal to"]},
  {relation:"GreaterThan",concept:"comparison.greater-than",capabilityId:"core.gt_int",gloss:"strict integer greater-than",phrases:["greater than","more than","is greater than","is more than","is bigger than","above"]},
  {relation:"GreaterOrEqual",concept:"comparison.greater-or-equal",capabilityId:"core.gte_int",gloss:"integer greater-than or equal",phrases:["at least","greater than or equal","is at least","no less than","is greater than or equal to"]},

  {relation:"BooleanNot",concept:"logic.not",capabilityId:"core.not_bool",gloss:"logical negation",phrases:["not","negate boolean","invert","flip the boolean","opposite of true or false"]},
  {relation:"BooleanAnd",concept:"logic.and",capabilityId:"core.and_bool",gloss:"logical conjunction",phrases:["and","both","both are true","as well as"]},
  {relation:"BooleanOr",concept:"logic.or",capabilityId:"core.or_bool",gloss:"logical disjunction",phrases:["or","either","either one is true","at least one of"]},

  {relation:"StringLength",concept:"string.length",capabilityId:"core.string_len",gloss:"Unicode code-point length of a string",phrases:["string length","length of text","how long","length of","how many characters","character count"]},
  {relation:"StringConcat",concept:"string.concat",capabilityId:"core.concat_string",gloss:"concatenate strings",phrases:["concatenate","join text","append text","combine","combine text","stick together","glue together"]},
  {relation:"StringContains",concept:"string.contains",capabilityId:"core.contains_string",gloss:"test whether a string contains another string",phrases:["contains","includes","has substring","does it contain","found inside"]},
  {relation:"StringStartsWith",concept:"string.starts-with",capabilityId:"core.starts_with_string",gloss:"test string prefix",phrases:["starts with","begins with","opens with"]},
  {relation:"StringEndsWith",concept:"string.ends-with",capabilityId:"core.ends_with_string",gloss:"test string suffix",phrases:["ends with","finishes with","closes with"]},
  {relation:"StringLower",concept:"string.lowercase",capabilityId:"core.ascii_lower_string",gloss:"ASCII lowercase transform",phrases:["lowercase","lower case","make lowercase","to lower case"]},
  {relation:"StringUpper",concept:"string.uppercase",capabilityId:"core.ascii_upper_string",gloss:"ASCII uppercase transform",phrases:["uppercase","upper case","make uppercase","to upper case"]},
  {relation:"StringTrim",concept:"string.trim",capabilityId:"core.trim_ascii_string",gloss:"trim ASCII whitespace",phrases:["trim","strip whitespace","remove leading and trailing spaces","clean up whitespace"]},
  {relation:"StringSplit",concept:"string.split",capabilityId:"core.string_split",gloss:"split string by delimiter",phrases:["split","separate by","split by","break apart by","divide text by"]},
  {relation:"StringReplace",concept:"string.replace-all",capabilityId:"core.replace_all_string",gloss:"replace every substring occurrence",phrases:["replace","replace all","swap out","substitute"]},

  {relation:"ListLengthString",concept:"list.length.string",capabilityId:"core.list_len_string",gloss:"number of strings in a list",phrases:["count strings","number of strings","how many strings","how many items"]},
  {relation:"ListLengthInt",concept:"list.length.integer",capabilityId:"core.list_len_int",gloss:"number of integers in a list",phrases:["count numbers","number of numbers","how many numbers"]},
  {relation:"ListHeadString",concept:"list.head.string",capabilityId:"core.list_head_string",gloss:"first string in a list",phrases:["first string","head string","first item in the list","first one"]},
  {relation:"ListTailString",concept:"list.tail.string",capabilityId:"core.list_tail_string",gloss:"all strings except the first",phrases:["rest of strings","tail strings","everything but the first","the rest of the list"]},
  {relation:"ListGetString",concept:"list.index.string",capabilityId:"core.list_get_string",gloss:"string at an integer index",phrases:["string at index","get string index","item at position","the string at"]},
  {relation:"ListGetInt",concept:"list.index.integer",capabilityId:"core.list_get_int",gloss:"integer at an integer index",phrases:["number at index","get number index","the number at position"]},
  {relation:"ListSumInt",concept:"list.sum.integer",capabilityId:"core.list_sum_int",gloss:"sum integer list",phrases:["sum list","total numbers","add up the list","total of the numbers"]},
  {relation:"ListReverseString",concept:"list.reverse.string",capabilityId:"core.list_reverse_string",gloss:"reverse string list order",phrases:["reverse strings","reverse list","flip the order","backwards list"]},

  {relation:"JsonParse",concept:"json.parse",capabilityId:"core.parse_json",gloss:"parse JSON text into a recursive JSON value",phrases:["parse json","decode json","read json","turn text into json"]},
  {relation:"JsonStringify",concept:"json.stringify",capabilityId:"core.stringify_json",gloss:"serialize JSON value to text",phrases:["stringify json","encode json","turn json into text","write out json"]},
  {relation:"ObjectGet",concept:"object.get",capabilityId:"core.json_get",gloss:"retrieve one property from an object by key",phrases:["get property","get key","lookup key","property value","get the value of","read the field"]},
  {relation:"ObjectHas",concept:"object.has-key",capabilityId:"core.json_has",gloss:"test whether an object has a key",phrases:["has key","contains key","property exists","does it have a field"]},
  {relation:"ObjectKeys",concept:"object.keys",capabilityId:"core.json_keys",gloss:"sorted keys of an object",phrases:["object keys","list keys","what fields are there"]},
  {relation:"ObjectValues",concept:"object.values",capabilityId:"core.json_values",gloss:"values of an object in sorted-key order",phrases:["object values","list values","all the values"]},
  {relation:"JsonType",concept:"json.type",capabilityId:"core.json_type",gloss:"JSON value type name",phrases:["json type","type of value","what type is this"]},

  {relation:"ListDirectory",concept:"filesystem.list-directory",capabilityId:"host.fs_list",gloss:"list entries in a directory",phrases:["list directory","list files","list folder contents","what's in this folder","show files in","directory listing"]},
  {relation:"ReadFile",concept:"filesystem.read-file",capabilityId:"host.fs_read_text",gloss:"read a file's text contents",phrases:["read file","read the contents of","open file","load file contents","get file text"]},
  {relation:"WriteFile",concept:"filesystem.write-file",capabilityId:"host.fs_write_text",gloss:"write text to a file",phrases:["write file","save to file","write text to","save file contents","write to disk"]},
  {relation:"FileExists",concept:"filesystem.exists",capabilityId:"host.fs_exists",gloss:"test whether a path exists",phrases:["file exists","does it exist","check if the file exists","path exists"]},
  {relation:"IsFile",concept:"filesystem.is-file",capabilityId:"host.fs_is_file",gloss:"test whether a path is a regular file",phrases:["is a file","is it a file","check if it's a file"]},
  {relation:"IsDirectory",concept:"filesystem.is-directory",capabilityId:"host.fs_is_dir",gloss:"test whether a path is a directory",phrases:["is a directory","is it a folder","check if it's a directory","is a folder"]},
  {relation:"PathBasename",concept:"filesystem.path-basename",capabilityId:"host.path_basename",gloss:"final component of a path",phrases:["basename","file name from path","just the file name","strip the directory"]},
  {relation:"PathDirname",concept:"filesystem.path-dirname",capabilityId:"host.path_dirname",gloss:"parent directory of a path",phrases:["dirname","parent directory","containing folder","directory of a path"]},
  {relation:"PathExtension",concept:"filesystem.path-extension",capabilityId:"host.path_ext",gloss:"file extension of a path",phrases:["file extension","extension of","what type of file is it"]},
  {relation:"PathJoin",concept:"filesystem.path-join",capabilityId:"host.path_join",gloss:"join two path segments",phrases:["join paths","combine paths","path join","build a path from"]},
  {relation:"CurrentDirectory",concept:"filesystem.cwd",capabilityId:"host.cwd",gloss:"current working directory",phrases:["current directory","working directory","where am i","current folder"]},
  {relation:"GetEnvVar",concept:"filesystem.env-var",capabilityId:"host.env_get",gloss:"read an environment variable",phrases:["environment variable","get env var","read environment variable","env value"]},
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
