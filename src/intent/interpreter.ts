import { T } from "../ir/types.js";
import type { GraphStore } from "../graph/graph.js";
import type { Intent, IntentInterpretation } from "./intent.js";
import { learnedPhraseGroundings, type PhraseGrounding } from "./phrase-grounding.js";
import { contextualLexicalSensesForText } from "./lexicon.js";

const numberWords:Record<string,number>={
  zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
  twice:2,double:2,triple:3
};

const seedGroundings:PhraseGrounding[]=[
  {phrase:"multiply",relation:"Multiply",confidence:.98,provenance:["seed:english"]},
  {phrase:"times",relation:"Multiply",confidence:.95,provenance:["seed:english"]},
  {phrase:"double",relation:"Multiply",impliedValue:2,confidence:.98,provenance:["seed:english"]},
  {phrase:"add",relation:"Add",confidence:.98,provenance:["seed:english"]},
  {phrase:"plus",relation:"Add",confidence:.95,provenance:["seed:english"]},
  {phrase:"largest",relation:"ArgMax",confidence:.9,provenance:["seed:english"]},
];

function words(s:string){return s.toLowerCase().replace(/[^\w.-]+/g," ").trim().split(/\s+/).filter(Boolean);}
function numericValues(tokens:string[]):Array<{token:string,value:number}>{
  const out:Array<{token:string,value:number}>=[];
  for(const t of tokens){
    if(/^[-+]?\d+$/.test(t)) out.push({token:t,value:Number(t)});
    else if(t in numberWords) out.push({token:t,value:numberWords[t]!});
  }
  return out;
}

export function interpretIntent(rawUtterance:string,store?:GraphStore):IntentInterpretation{
  const raw=rawUtterance.trim();
  if(!raw) return {status:"teacher",reason:"empty utterance",rawUtterance};
  const lower=raw.toLowerCase();
  const tokens=words(raw);
  const lexical:PhraseGrounding[]=store?contextualLexicalSensesForText(store,raw).filter(x=>x.confidence>=.35).map(x=>({phrase:x.form,relation:x.relation,impliedValue:x.impliedValue,confidence:x.confidence,provenance:x.provenance})):[];
  const groundings=[...lexical,...(store?learnedPhraseGroundings(store):[]),...seedGroundings]
    .filter((g,i,a)=>a.findIndex(x=>x.phrase===g.phrase&&x.relation===g.relation)===i);
  const phraseMatches=(phrase:string)=>{
    const escaped=phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`,"i").test(lower);
  };
  const matched=groundings.filter(g=>phraseMatches(g.phrase)).sort((a,b)=>b.confidence-a.confidence);
  const distinctRelations=[...new Set(matched.map(g=>g.relation))];

  // Known ambiguity: comparative language with no explicit operation or target.
  if(/\b(bigger|larger|more)\b/.test(lower) && matched.length===0){
    const alternatives=["Add","Multiply"].map((relation,i)=>makeNumericIntent(raw,relation,[],.35-i*.05,[`ambiguity:${relation}`]));
    return {status:"clarify",alternatives,question:"Do you mean add a fixed amount, multiply by a factor, or something else?"};
  }
  if(matched.length===0) return {status:"teacher",reason:"no grounded action phrase",rawUtterance};
  if(distinctRelations.length>1){
    const alternatives=distinctRelations.map((relation,i)=>makeNumericIntent(raw,relation,[],Math.max(.2,matched.find(x=>x.relation===relation)?.confidence??.2)-i*.02,[`ambiguity:${relation}`]));
    return {status:"clarify",alternatives,question:`I found multiple requested actions (${distinctRelations.join(", ")}). Which action should I perform first?`};
  }

  const relation=matched[0]!.relation;
  const nums=numericValues(tokens);
  // Words like "double"/"twice"/"triple" are both action/factor expressions.
  const lexicalFactor = matched[0]?.impliedValue ?? (tokens.includes("double")||tokens.includes("twice")?2:tokens.includes("triple")?3:undefined);
  let constants=nums
    .filter(n=>!["double","twice","triple"].includes(n.token))
    .map(n=>n.value);
  if(lexicalFactor!==undefined) constants=[lexicalFactor,...constants];

  const binaryWithAmount=new Set(["Multiply","Add","Subtract","Divide","Modulo","Minimum","Maximum","EqualInt","NotEqualInt","LessThan","LessOrEqual","GreaterThan","GreaterOrEqual"]);
  if(binaryWithAmount.has(relation) && constants.length===0){
    return {status:"clarify",alternatives:[makeNumericIntent(raw,relation,[],matched[0]!.confidence,[...matched[0]!.provenance])],
      question:relation==="Multiply"?"What factor should be used?":`What second number should be used for ${relation}?`};
  }
  return {status:"resolved",intent:makeNumericIntent(raw,relation,constants,matched[0]!.confidence,[...matched[0]!.provenance]),alternatives:[]};
}

function makeNumericIntent(raw:string,relation:string,constants:number[],confidence:number,provenance:string[]):Intent{
  const inputId="signal.input0";
  const boolRelations=new Set(["EqualInt","NotEqualInt","LessThan","LessOrEqual","GreaterThan","GreaterOrEqual"]);
  const signals=[
    {id:inputId,concept:"Number",type:T.int,binding:"input" as const,inputIndex:0,provenance:["utterance:implicit-number-input"]},
    ...constants.map((n,i)=>({id:`signal.const${i}`,concept:"Number",type:T.int,value:n,provenance:["utterance:number"]}))
  ];
  return {
    id:`intent:${raw.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)}`,
    rawUtterance:raw,
    signals,
    goal:{concept:boolRelations.has(relation)?"Boolean":"Number",type:boolRelations.has(relation)?T.bool:T.int},
    constraints:[{relation,args:[inputId,...constants.map((_,i)=>`signal.const${i}`)],provenance}],
    confidence,
    provenance:["intent-interpreter:v0.1",...provenance]
  };
}
