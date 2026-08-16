import type { GraphStore } from "../graph/graph.js";

export interface QuestionStrategyMatch {
  strategyId: string;
  score: number;
  question: string;
  reasons: string[];
}

export interface ImpasseContext {
  id: string;
  description: string;
  tags: string[];
  contrastingOutcomes?: boolean;
  uncertainty?: boolean;
  failedHypotheses?: number;
}

/**
 * v0 transparent selector over graph-native teacher strategies.
 * Later this can become statistical/neural, but the interface and benchmark remain.
 */
export function selectQuestionStrategy(store:GraphStore,ctx:ImpasseContext):QuestionStrategyMatch|undefined{
  const strategies=store.entitiesByKind("question_strategy");
  const matches:QuestionStrategyMatch[]=[];
  for(const s of strategies){
    const d=String(s.attrs?.description??"");
    const labels=s.labels??[];
    let score=0; const reasons:string[]=[];
    if(ctx.contrastingOutcomes && (d.toLowerCase().includes("contrast")||d.toLowerCase().includes("regime"))){
      score+=50; reasons.push("contrasting-outcomes");
    }
    if(ctx.uncertainty && (d.toLowerCase().includes("uncertain")||d.toLowerCase().includes("missing"))){
      score+=30; reasons.push("uncertainty");
    }
    const overlap=ctx.tags.filter(t=>labels.includes(t));
    if(overlap.length){score+=overlap.length*10; reasons.push(`tag-overlap:${overlap.join(",")}`);}
    if(score>0){
      const question=ctx.contrastingOutcomes
        ? "What differs between the cases where this strategy succeeds and where it fails?"
        : ctx.uncertainty
          ? "What missing information would most change the current conclusion?"
          : `Which stored teaching strategy best addresses: ${ctx.description}`;
      matches.push({strategyId:s.id,score,question,reasons});
    }
  }
  return matches.sort((a,b)=>b.score-a.score||a.strategyId.localeCompare(b.strategyId))[0];
}
