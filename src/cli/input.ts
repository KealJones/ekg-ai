import type { Type } from "../ir/types.js";
import type { Value } from "../ir/blueprint.js";
import { assertValueMatchesType } from "../ir/validate.js";

export interface ParsedCliUtterance {
  utterance:string;
  inputs?:Value[];
}

/**
 * CLI convenience syntax:
 *   deduct six from this number :: [20]
 * The right side is always a JSON array of runtime inputs. A single list input
 * therefore uses a nested array, e.g. `sum list :: [[1,2,3]]`.
 */
export function parseCliUtterance(line:string):ParsedCliUtterance{
  const marker=line.lastIndexOf("::");
  if(marker<0) return {utterance:line.trim()};
  const utterance=line.slice(0,marker).trim();
  const rawInputs=line.slice(marker+2).trim();
  if(!utterance) throw new Error("utterance is required before ::");
  if(!rawInputs) throw new Error("runtime inputs are required after ::");
  let parsed:unknown;
  try{ parsed=JSON.parse(rawInputs); }
  catch(e){ throw new Error(`inputs after :: must be valid JSON: ${String(e)}`); }
  if(!Array.isArray(parsed)) throw new Error("inputs after :: must be a JSON array; use [value] for one input");
  return {utterance,inputs:parsed as Value[]};
}

export function parseTypedCliValue(raw:string,type:Type):Value{
  const text=raw.trim();
  let value:unknown;
  if(type.kind==="string"){
    if(text.startsWith('"')){
      try{value=JSON.parse(text)}catch(e){throw new Error(`invalid JSON string: ${String(e)}`)}
    }else value=text;
  }else{
    try{value=JSON.parse(text)}catch(e){throw new Error(`input must be valid JSON for ${renderType(type)}: ${String(e)}`)}
  }
  assertValueMatchesType(value as Value,type,"CLI input");
  return value as Value;
}

export function validateCliInputs(inputs:Value[],types:Type[]):void{
  if(inputs.length!==types.length) throw new Error(`expected ${types.length} runtime input(s), got ${inputs.length}`);
  inputs.forEach((v,i)=>assertValueMatchesType(v,types[i]!,`CLI input ${i}`));
}

export function renderType(type:Type):string{
  return type.kind==="list"?`list<${renderType(type.item)}>`:type.kind;
}

export function formatCliValue(value:Value):string{
  if(typeof value==="string") return value;
  if(value && typeof value==="object" && !Array.isArray(value) && "stdout" in value && typeof (value as any).stdout==="string"){
    const stdout=String((value as any).stdout).trim();
    if(stdout) return stdout;
  }
  return JSON.stringify(value,null,2);
}
