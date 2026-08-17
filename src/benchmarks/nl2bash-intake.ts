export interface Nl2BashRecord { line:number; utterance:string; command:string; }
export type FrozenPrimitiveId = "predicate.within_closed_int_window"|"predicate.string_contains"|"logic.negate_predicate";
export interface CandidateHit extends Nl2BashRecord { primitiveId:FrozenPrimitiveId; evidence:string[]; }

export function parseNl2BashPairs(nl:string,cm:string):Nl2BashRecord[]{
  const ns=nl.replace(/\r/g,"").split("\n"); const cs=cm.replace(/\r/g,"").split("\n");
  while(ns.length&&ns.at(-1)==="") ns.pop(); while(cs.length&&cs.at(-1)==="") cs.pop();
  if(ns.length!==cs.length) throw new Error(`NL2Bash alignment mismatch: ${ns.length} NL vs ${cs.length} commands`);
  return ns.map((utterance,i)=>({line:i+1,utterance,command:cs[i]!}));
}

function literalContainment(c:string):boolean {
  return /\bgrep\b/.test(c) || /-name\s+["']?\*[^*\s]+\*/.test(c) || /-iname\s+["']?\*[^*\s]+\*/.test(c) || /\[\[.*\*.*\*.*\]\]/.test(c);
}
function negatedPredicate(c:string):boolean {
  return /(?:^|\s)(?:!|-not)\s+(?:\(|-\w|\[|grep\b)/.test(c) || /\bgrep\s+-v\b/.test(c) || /\bgrep\s+--invert-match\b/.test(c);
}
function closedWindow(c:string):boolean {
  const findPair=/(?:^|\s)(?:-newermt|-newerXY|-mtime|-mmin|-ctime|-cmin|-atime|-amin)\b[^|;&]*(?:!\s*)?(?:^|\s)(?:-newermt|-newerXY|-mtime|-mmin|-ctime|-cmin|-atime|-amin)\b/.test(c);
  return findPair;
}

export function discoverPrimitiveCandidates(records:Nl2BashRecord[]):CandidateHit[]{
  const out:CandidateHit[]=[];
  for(const r of records){
    if(closedWindow(r.command)) out.push({...r,primitiveId:"predicate.within_closed_int_window",evidence:["command contains paired lower/upper-bound structure"]});
    if(literalContainment(r.command)) out.push({...r,primitiveId:"predicate.string_contains",evidence:["command contains containment-like filter"]});
    if(negatedPredicate(r.command)) out.push({...r,primitiveId:"logic.negate_predicate",evidence:["command contains explicit predicate negation"]});
  }
  return out;
}

export function auditCandidateSupply(hits:CandidateHit[],required=40){
  const ids:FrozenPrimitiveId[]=["predicate.within_closed_int_window","predicate.string_contains","logic.negate_predicate"];
  return Object.fromEntries(ids.map(id=>{const rows=hits.filter(x=>x.primitiveId===id);return [id,{candidates:rows.length,required,passesSupplyGate:rows.length>=required,uniqueCommands:new Set(rows.map(x=>x.command)).size}];}));
}
