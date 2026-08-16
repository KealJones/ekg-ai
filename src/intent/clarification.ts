import type { IntentInterpretation, Intent } from "./intent.js";

const words:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};

function extractNumber(answer:string):number|undefined{
  const token=answer.toLowerCase().match(/[-+]?\d+|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/)?.[0];
  if(!token) return undefined;
  return /^[-+]?\d+$/.test(token)?Number(token):words[token];
}

export function applyClarification(
  interpretation: Extract<IntentInterpretation,{status:"clarify"}>,
  answer:string,
): IntentInterpretation {
  const lower=answer.trim().toLowerCase();
  const relation =
    /\b(multiply|times|factor|scale)\b/.test(lower) ? "Multiply" :
    /\b(add|plus|amount)\b/.test(lower) ? "Add" : undefined;

  const n=extractNumber(lower);
  if(!relation && n===undefined)
    return {status:"teacher",reason:"clarification answer did not provide a recognized relation or numeric argument",rawUtterance:answer};

  let candidates=interpretation.alternatives;
  if(relation) candidates=candidates.filter(x=>x.constraints.some(c=>c.relation===relation));
  if(candidates.length===0) return {status:"teacher",reason:"clarification answer did not match any candidate",rawUtterance:answer};

  const candidate=structuredClone(candidates[0]!) as Intent;
  const c=candidate.constraints[0]!;
  if(n!==undefined && c.args.length===1){
    const id=`signal.const${candidate.signals.filter(s=>s.value!==undefined).length}`;
    candidate.signals.push({id,concept:"Number",type:{kind:"int"},value:n,provenance:["clarification:number"]});
    c.args.push(id);
    candidate.provenance.push("clarification");
    candidate.confidence=Math.min(1,candidate.confidence+.2);
  }

  if(c.args.length<2 && (c.relation==="Multiply"||c.relation==="Add"))
    return {status:"clarify",alternatives:[candidate],question:`What ${c.relation==="Multiply"?"factor":"amount"} should be used?`};

  return {status:"resolved",intent:candidate,alternatives:candidates.slice(1)};
}
