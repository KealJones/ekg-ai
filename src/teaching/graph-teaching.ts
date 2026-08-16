import type { GraphStore, EntityKind } from "../graph/graph.js";
import type { TeachingTrace } from "./teaching-trace.js";
import { validateTeachingTrace } from "./teaching-trace.js";

const safe=(s:string)=>s.replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-|-$/g,"").slice(0,80) || "item";

function put(store:GraphStore,id:string,kind:EntityKind,labels:string[],attrs:Record<string,unknown>={}):void{
  store.putEntity({id,kind,labels,attrs});
}
function rel(store:GraphStore,id:string,kind:string,from:string,to:string):void{
  store.putRelation({id,kind,from,to,confidence:1});
}

/** Materialize a structured teaching trace into queryable graph-native knowledge. */
export function ingestTeachingTrace(store: GraphStore, trace: TeachingTrace): void {
  validateTeachingTrace(trace);
  const root=`teaching:${trace.id}`;
  put(store,root,"teaching_trace",[trace.id],{
    taskId:trace.taskId,teacherInterventions:trace.teacherInterventions,provenance:trace.provenance
  });

  const obs=`${root}:observation`;
  put(store,obs,"concept",["teaching-observation"],{text:trace.observation});
  rel(store,`${root}:r:observed`,"observed",root,obs);

  let impasseId:string|undefined;
  if(trace.impasse){
    impasseId=`${root}:impasse`;
    put(store,impasseId,"impasse",["impasse"],{text:trace.impasse});
    rel(store,`${root}:r:impasse`,"encountered_impasse",root,impasseId);
  }

  const questionId=`${root}:question`;
  put(store,questionId,"question",["teacher-question"],{text:trace.teacherQuestion});
  rel(store,`${root}:r:question`,"asked_question",root,questionId);
  if(impasseId) rel(store,`${root}:r:question-addresses`,"addresses",questionId,impasseId);

  trace.hypotheses.forEach((h,i)=>{
    const id=`${root}:hypothesis:${i}`;
    put(store,id,"hypothesis",["hypothesis",h.status],{statement:h.statement,status:h.status,reason:h.reason});
    rel(store,`${root}:r:hypothesis:${i}`,"considered_hypothesis",root,id);
    rel(store,`${root}:r:question-hypothesis:${i}`,"elicits",questionId,id);
  });

  trace.experiments.forEach((e,i)=>{
    const id=`${root}:experiment:${i}`;
    put(store,id,"experiment",["teaching-experiment"],{
      question:e.question,expectedDiscrimination:e.expectedDiscrimination,result:e.result
    });
    rel(store,`${root}:r:experiment:${i}`,"ran_experiment",root,id);
  });

  let conclusionId:string|undefined;
  if(trace.conclusion){
    conclusionId=`${root}:conclusion`;
    put(store,conclusionId,"conclusion",["conclusion"],{text:trace.conclusion});
    rel(store,`${root}:r:conclusion`,"reached_conclusion",root,conclusionId);
  }

  (trace.extractedKnowledge??[]).forEach((k,i)=>{
    const logicalId=k.id ? `knowledge:${safe(k.id)}` : `${root}:knowledge:${i}`;
    const kind:EntityKind=k.kind==="question-strategy"?"question_strategy":k.kind==="procedure"?"program":"concept";
    put(store,logicalId,kind,[k.kind,k.id??`extracted-${i}`],{description:k.description,knowledgeKind:k.kind});
    rel(store,`${root}:r:knowledge:${i}`,"extracted_knowledge",root,logicalId);
    if(conclusionId) rel(store,`${root}:r:conclusion-knowledge:${i}`,"supports",conclusionId,logicalId);
  });

  if(trace.nextQuestion){
    const id=`${root}:next-question`;
    put(store,id,"question",["next-question"],{text:trace.nextQuestion});
    rel(store,`${root}:r:next-question`,"suggested_next_question",root,id);
  }
}

export function teachingTraceKnowledge(store:GraphStore, traceId:string){
  const root=`teaching:${traceId}`;
  return store.outgoing(root,"extracted_knowledge")
    .map(r=>store.getEntity(r.to))
    .filter((x):x is NonNullable<typeof x>=>!!x);
}
