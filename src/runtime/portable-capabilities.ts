import { CapabilityRegistry } from "./capabilities.js";
import { T } from "../ir/types.js";
import type { Value } from "../ir/blueprint.js";

const n=(v:Value)=>Number(v);
const s=(v:Value)=>String(v);
const b=(v:Value)=>Boolean(v);
const xs=(v:Value)=>v as Value[];
const si=(v:Value)=>xs(v).map(Number);
const ss=(v:Value)=>xs(v).map(String);
const truncDiv=(a:number,b:number)=>b===0?0:Math.trunc(a/b);
const truncMod=(a:number,b:number)=>b===0?0:a-truncDiv(a,b)*b;
const asciiLower=(x:string)=>x.replace(/[A-Z]/g,c=>String.fromCharCode(c.charCodeAt(0)+32));
const asciiUpper=(x:string)=>x.replace(/[a-z]/g,c=>String.fromCharCode(c.charCodeAt(0)-32));
const charLen=(x:string)=>Array.from(x).length;

export function portableCoreCapabilities(): CapabilityRegistry {
  const r=new CapabilityRegistry();
  const reg=(id:string,inputs:any[],output:any,reference:(...args:Value[])=>Value,tsEmit:(a:string[])=>string,rustEmit:(a:string[])=>string)=>
    r.register({id,inputs,output,pure:true,deterministic:true,reference,tsEmit,rustEmit});

  // Integer arithmetic: deliberately boring, ubiquitous building blocks.
  reg("core.sub_int",[T.int,T.int],T.int,(a,c)=>n(a)-n(c),a=>`(${a[0]} - ${a[1]})`,a=>`(${a[0]} - ${a[1]})`);
  reg("core.div_trunc_int",[T.int,T.int],T.int,(a,c)=>truncDiv(n(a),n(c)),a=>`(${a[1]}===0?0:Math.trunc(${a[0]}/${a[1]}))`,a=>`(if ${a[1]} == 0 { 0 } else { ${a[0]} / ${a[1]} })`);
  reg("core.mod_trunc_int",[T.int,T.int],T.int,(a,c)=>truncMod(n(a),n(c)),a=>`(${a[1]}===0?0:(${a[0]}-Math.trunc(${a[0]}/${a[1]})*${a[1]}))`,a=>`(if ${a[1]} == 0 { 0 } else { ${a[0]} % ${a[1]} })`);
  reg("core.neg_int",[T.int],T.int,a=>-n(a),a=>`(-${a[0]})`,a=>`(-${a[0]})`);
  reg("core.abs_int",[T.int],T.int,a=>Math.abs(n(a)),a=>`Math.abs(${a[0]})`,a=>`${a[0]}.abs()`);
  reg("core.min_int",[T.int,T.int],T.int,(a,c)=>Math.min(n(a),n(c)),a=>`Math.min(${a[0]},${a[1]})`,a=>`std::cmp::min(${a[0]},${a[1]})`);

  // Integer comparisons.
  reg("core.ne_int",[T.int,T.int],T.bool,(a,c)=>n(a)!==n(c),a=>`(${a[0]}!==${a[1]})`,a=>`(${a[0]} != ${a[1]})`);
  reg("core.lt_int",[T.int,T.int],T.bool,(a,c)=>n(a)<n(c),a=>`(${a[0]}<${a[1]})`,a=>`(${a[0]} < ${a[1]})`);
  reg("core.lte_int",[T.int,T.int],T.bool,(a,c)=>n(a)<=n(c),a=>`(${a[0]}<=${a[1]})`,a=>`(${a[0]} <= ${a[1]})`);
  reg("core.gt_int",[T.int,T.int],T.bool,(a,c)=>n(a)>n(c),a=>`(${a[0]}>${a[1]})`,a=>`(${a[0]} > ${a[1]})`);

  // Boolean algebra.
  reg("core.not_bool",[T.bool],T.bool,a=>!b(a),a=>`(!${a[0]})`,a=>`(!${a[0]})`);
  reg("core.and_bool",[T.bool,T.bool],T.bool,(a,c)=>b(a)&&b(c),a=>`(${a[0]}&&${a[1]})`,a=>`(${a[0]} && ${a[1]})`);
  reg("core.or_bool",[T.bool,T.bool],T.bool,(a,c)=>b(a)||b(c),a=>`(${a[0]}||${a[1]})`,a=>`(${a[0]} || ${a[1]})`);
  reg("core.eq_bool",[T.bool,T.bool],T.bool,(a,c)=>b(a)===b(c),a=>`(${a[0]}===${a[1]})`,a=>`(${a[0]} == ${a[1]})`);

  // Portable conditionals without adding a polymorphic IR node.
  reg("core.select_int",[T.bool,T.int,T.int],T.int,(c,y,z)=>b(c)?n(y):n(z),a=>`(${a[0]}?${a[1]}:${a[2]})`,a=>`(if ${a[0]} { ${a[1]} } else { ${a[2]} })`);
  reg("core.select_bool",[T.bool,T.bool,T.bool],T.bool,(c,y,z)=>b(c)?b(y):b(z),a=>`(${a[0]}?${a[1]}:${a[2]})`,a=>`(if ${a[0]} { ${a[1]} } else { ${a[2]} })`);
  reg("core.select_string",[T.bool,T.string,T.string],T.string,(c,y,z)=>b(c)?s(y):s(z),a=>`(${a[0]}?${a[1]}:${a[2]})`,a=>`(if ${a[0]} { ${a[1]} } else { ${a[2]} })`);
  reg("core.select_list_string",[T.bool,T.list(T.string),T.list(T.string)],T.list(T.string),(c,y,z)=>b(c)?ss(y):ss(z),a=>`(${a[0]}?${a[1]}:${a[2]})`,a=>`(if ${a[0]} { ${a[1]} } else { ${a[2]} })`);
  reg("core.select_list_int",[T.bool,T.list(T.int),T.list(T.int)],T.list(T.int),(c,y,z)=>b(c)?si(y):si(z),a=>`(${a[0]}?${a[1]}:${a[2]})`,a=>`(if ${a[0]} { ${a[1]} } else { ${a[2]} })`);

  // Strings. Semantics are intentionally explicit: Unicode code-point count, ASCII case transforms.
  reg("core.eq_string",[T.string,T.string],T.bool,(a,c)=>s(a)===s(c),a=>`(${a[0]}===${a[1]})`,a=>`(${a[0]} == ${a[1]})`);
  reg("core.concat_string",[T.string,T.string],T.string,(a,c)=>s(a)+s(c),a=>`(${a[0]}+${a[1]})`,a=>`format!(\"{}{}\", ${a[0]}, ${a[1]})`);
  reg("core.contains_string",[T.string,T.string],T.bool,(a,c)=>s(a).includes(s(c)),a=>`${a[0]}.includes(${a[1]})`,a=>`${a[0]}.contains(&${a[1]})`);
  reg("core.starts_with_string",[T.string,T.string],T.bool,(a,c)=>s(a).startsWith(s(c)),a=>`${a[0]}.startsWith(${a[1]})`,a=>`${a[0]}.starts_with(&${a[1]})`);
  reg("core.ends_with_string",[T.string,T.string],T.bool,(a,c)=>s(a).endsWith(s(c)),a=>`${a[0]}.endsWith(${a[1]})`,a=>`${a[0]}.ends_with(&${a[1]})`);
  reg("core.ascii_lower_string",[T.string],T.string,a=>asciiLower(s(a)),a=>`${a[0]}.replace(/[A-Z]/g,(c:string)=>String.fromCharCode(c.charCodeAt(0)+32))`,a=>`${a[0]}.to_ascii_lowercase()`);
  reg("core.ascii_upper_string",[T.string],T.string,a=>asciiUpper(s(a)),a=>`${a[0]}.replace(/[a-z]/g,(c:string)=>String.fromCharCode(c.charCodeAt(0)-32))`,a=>`${a[0]}.to_ascii_uppercase()`);
  reg("core.trim_ascii_string",[T.string],T.string,a=>s(a).replace(/^[ \t\r\n]+|[ \t\r\n]+$/g,""),a=>`${a[0]}.replace(/^[ \\t\\r\\n]+|[ \\t\\r\\n]+$/g,\"\")`,a=>`${a[0]}.trim_matches(&[' ', '\\t', '\\r', '\\n'][..]).to_string()`);
  reg("core.replace_all_string",[T.string,T.string,T.string],T.string,(a,c,d)=>s(c)===""?s(a):s(a).split(s(c)).join(s(d)),a=>`(${a[1]}===\"\"?${a[0]}:${a[0]}.split(${a[1]}).join(${a[2]}))`,a=>`(if ${a[1]}.is_empty() { ${a[0]} } else { ${a[0]}.replace(&${a[1]}, &${a[2]}) })`);
  reg("core.int_to_string",[T.int],T.string,a=>String(n(a)),a=>`String(${a[0]})`,a=>`${a[0]}.to_string()`);

  // Lists: no lambdas required, no hidden task logic.
  reg("core.list_len_int",[T.list(T.int)],T.int,a=>si(a).length,a=>`${a[0]}.length`,a=>`${a[0]}.len() as i64`);
  reg("core.list_concat_string",[T.list(T.string),T.list(T.string)],T.list(T.string),(a,c)=>[...ss(a),...ss(c)],a=>`[...${a[0]},...${a[1]}]`,a=>`[${a[0]}, ${a[1]}].concat()`);
  reg("core.list_concat_int",[T.list(T.int),T.list(T.int)],T.list(T.int),(a,c)=>[...si(a),...si(c)],a=>`[...${a[0]},...${a[1]}]`,a=>`[${a[0]}, ${a[1]}].concat()`);
  reg("core.list_reverse_string",[T.list(T.string)],T.list(T.string),a=>ss(a).reverse(),a=>`[...${a[0]}].reverse()`,a=>`{ let mut x=${a[0]}; x.reverse(); x }`);
  reg("core.list_reverse_int",[T.list(T.int)],T.list(T.int),a=>si(a).reverse(),a=>`[...${a[0]}].reverse()`,a=>`{ let mut x=${a[0]}; x.reverse(); x }`);
  reg("core.list_contains_string",[T.list(T.string),T.string],T.bool,(a,c)=>ss(a).includes(s(c)),a=>`${a[0]}.includes(${a[1]})`,a=>`${a[0]}.contains(&${a[1]})`);
  reg("core.list_contains_int",[T.list(T.int),T.int],T.bool,(a,c)=>si(a).includes(n(c)),a=>`${a[0]}.includes(${a[1]})`,a=>`${a[0]}.contains(&${a[1]})`);
  reg("core.list_sum_int",[T.list(T.int)],T.int,a=>si(a).reduce((q,v)=>q+v,0),a=>`${a[0]}.reduce((s:number,x:number)=>s+x,0)`,a=>`${a[0]}.iter().sum::<i64>()`);
  reg("core.list_min_int",[T.list(T.int)],T.int,a=>si(a).length?Math.min(...si(a)):0,a=>`(${a[0]}.length?Math.min(...${a[0]}):0)`,a=>`${a[0]}.iter().copied().min().unwrap_or(0)`);
  reg("core.list_max_int",[T.list(T.int)],T.int,a=>si(a).length?Math.max(...si(a)):0,a=>`(${a[0]}.length?Math.max(...${a[0]}):0)`,a=>`${a[0]}.iter().copied().max().unwrap_or(0)`);


  // Structured JSON/object values. These are EKG-level portable semantics; backends may use native maps/JSON libraries.
  reg("core.string_split",[T.string,T.string],T.list(T.string),(a,c)=>s(c)===""?Array.from(s(a)):s(a).split(s(c)),a=>`(${a[1]}===""?Array.from(${a[0]}):${a[0]}.split(${a[1]}))`,a=>`(if ${a[1]}.is_empty() { ${a[0]}.chars().map(|c| c.to_string()).collect::<Vec<_>>() } else { ${a[0]}.split(&${a[1]}).map(|x| x.to_string()).collect::<Vec<_>>() })`);
  reg("core.list_get_string",[T.list(T.string),T.int],T.string,(a,c)=>ss(a)[n(c)]??"",a=>`(${a[0]}[${a[1]}]??"")`,a=>`${a[0]}.get(${a[1]} as usize).cloned().unwrap_or_default()`);
  reg("core.list_head_string",[T.list(T.string)],T.string,a=>ss(a)[0]??"",a=>`(${a[0]}[0]??"")`,a=>`${a[0]}.first().cloned().unwrap_or_default()`);
  reg("core.list_tail_string",[T.list(T.string)],T.list(T.string),a=>ss(a).slice(1),a=>`${a[0]}.slice(1)`,a=>`${a[0]}.iter().skip(1).cloned().collect::<Vec<_>>()`);
  reg("core.list_get_int",[T.list(T.int),T.int],T.int,(a,c)=>si(a)[n(c)]??0,a=>`(${a[0]}[${a[1]}]??0)`,a=>`${a[0]}.get(${a[1]} as usize).copied().unwrap_or(0)`);
  reg("core.list_head_int",[T.list(T.int)],T.int,a=>si(a)[0]??0,a=>`(${a[0]}[0]??0)`,a=>`${a[0]}.first().copied().unwrap_or(0)`);
  reg("core.list_tail_int",[T.list(T.int)],T.list(T.int),a=>si(a).slice(1),a=>`${a[0]}.slice(1)`,a=>`${a[0]}.iter().skip(1).copied().collect::<Vec<_>>()`);
  reg("core.parse_json",[T.string],T.json,a=>{try{return JSON.parse(s(a)) as Value}catch{return null}},a=>`(()=>{try{return JSON.parse(${a[0]})}catch{return null}})()`,a=>`serde_json::from_str::<serde_json::Value>(&${a[0]}).unwrap_or(serde_json::Value::Null)`);
  reg("core.stringify_json",[T.json],T.string,a=>JSON.stringify(a),a=>`JSON.stringify(${a[0]})`,a=>`serde_json::to_string(&${a[0]}).unwrap_or_default()`);
  reg("core.json_get",[T.json,T.string],T.json,(a,c)=>{if(a&&typeof a==="object"&&!Array.isArray(a))return (a as Record<string,Value>)[s(c)]??null;return null},a=>`((${a[0]}&&typeof ${a[0]}==="object"&&!Array.isArray(${a[0]}))?(${a[0]}[${a[1]}]??null):null)`,a=>`${a[0]}.get(&${a[1]}).cloned().unwrap_or(serde_json::Value::Null)`);
  reg("core.json_has",[T.json,T.string],T.bool,(a,c)=>!!a&&typeof a==="object"&&!Array.isArray(a)&&Object.prototype.hasOwnProperty.call(a,s(c)),a=>`(!!${a[0]}&&typeof ${a[0]}==="object"&&!Array.isArray(${a[0]})&&Object.prototype.hasOwnProperty.call(${a[0]},${a[1]}))`,a=>`${a[0]}.as_object().map(|o| o.contains_key(&${a[1]})).unwrap_or(false)`);
  reg("core.json_keys",[T.json],T.list(T.string),a=>a&&typeof a==="object"&&!Array.isArray(a)?Object.keys(a).sort():[],a=>`((${a[0]}&&typeof ${a[0]}==="object"&&!Array.isArray(${a[0]}))?Object.keys(${a[0]}).sort():[])`,a=>`${a[0]}.as_object().map(|o| { let mut k=o.keys().cloned().collect::<Vec<_>>(); k.sort(); k }).unwrap_or_default()`);
  reg("core.json_values",[T.json],T.list(T.json),a=>a&&typeof a==="object"&&!Array.isArray(a)?Object.keys(a).sort().map(k=>(a as Record<string,Value>)[k]??null):[],a=>`((${a[0]}&&typeof ${a[0]}==="object"&&!Array.isArray(${a[0]}))?Object.keys(${a[0]}).sort().map(k=>${a[0]}[k]):[])`,a=>`${a[0]}.as_object().map(|o| { let mut k=o.keys().cloned().collect::<Vec<_>>(); k.sort(); k.into_iter().filter_map(|k| o.get(&k).cloned()).collect::<Vec<_>>() }).unwrap_or_default()`);
  reg("core.json_type",[T.json],T.string,a=>a===null?"null":Array.isArray(a)?"array":typeof a==="object"?"object":typeof a,a=>`(${a[0]}===null?"null":Array.isArray(${a[0]})?"array":typeof ${a[0]}==="object"?"object":typeof ${a[0]})`,a=>`match &${a[0]} { serde_json::Value::Null=>"null", serde_json::Value::Array(_)=>"array", serde_json::Value::Object(_)=>"object", serde_json::Value::String(_)=>"string", serde_json::Value::Bool(_)=>"boolean", serde_json::Value::Number(_)=>"number" }.to_string()`);
  reg("core.json_eq",[T.json,T.json],T.bool,(a,c)=>JSON.stringify(a)===JSON.stringify(c),a=>`(JSON.stringify(${a[0]})===JSON.stringify(${a[1]}))`,a=>`(${a[0]} == ${a[1]})`);
  reg("core.json_is_null",[T.json],T.bool,a=>a===null,a=>`(${a[0]}===null)`,a=>`${a[0]}.is_null()`);

  return r;
}

/** Fix the legacy string-length capability to match the portable code-point semantics. */
export function portableStringLengthCapability() {
  return {
    id:"core.string_len", inputs:[T.string], output:T.int, pure:true, deterministic:true,
    reference:(a:Value)=>charLen(s(a)),
    tsEmit:(a:string[])=>`Array.from(${a[0]}).length`,
    rustEmit:(a:string[])=>`${a[0]}.chars().count() as i64`
  };
}
