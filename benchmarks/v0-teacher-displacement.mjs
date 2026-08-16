import {
  MemoryGraphStore, TeacherAdapter, ingestTeachingTrace, selectQuestionStrategy
} from "../dist/index.js";

const graph=new MemoryGraphStore();
let teacherCalls=0;

const teacher=new TeacherAdapter({
  invoke:async req=>{
    teacherCalls++;
    return {
      id:`teacher.displacement.${teacherCalls}`,
      taskId:req.context.taskId,
      observation:req.context.observation,
      impasse:req.context.impasse,
      teacherQuestion:"What differs between the cases where this strategy helps and where it hurts?",
      hypotheses:[
        {statement:"A contextual variable distinguishes the regimes.",status:"supported",reason:"Construct contrasting cases and compare outcomes."}
      ],
      experiments:[
        {question:"Construct one success case and one failure case; identify the smallest differing feature.",expectedDiscrimination:"Find a feature correlated with the utility flip.",result:"The regimes differ in a decision-relevant context feature."}
      ],
      conclusion:"When outcomes conflict across regimes, compare contrasting cases before proposing a general rule.",
      extractedKnowledge:[
        {kind:"question-strategy",id:"teacher.compare-regimes",description:"Contrast success and failure regimes and ask what feature distinguishes them."}
      ],
      nextQuestion:"Does the discriminator predict a third held-out case?",
      teacherInterventions:1,
      provenance:["scripted-teacher:displacement-v0.1"]
    };
  }
});

const impasses=[
  {id:"cold.activation",description:"Learned search helps hard tasks but hurts easy tasks.",tags:["performance"],contrastingOutcomes:true},
  {id:"warm.cache",description:"Caching speeds repeated reads but slows one-shot requests.",tags:["performance"],contrastingOutcomes:true},
  {id:"warm.batch",description:"Batching helps large workloads but hurts tiny workloads.",tags:["performance"],contrastingOutcomes:true},
  {id:"warm.index",description:"An index helps selective queries but hurts tiny tables.",tags:["performance"],contrastingOutcomes:true},
];

const rows=[];
for(const [i,ctx] of impasses.entries()){
  const selected=selectQuestionStrategy(graph,ctx);
  if(selected){
    rows.push({index:i,impasse:ctx.id,source:"learner",teacherInterventions:0,strategy:selected.strategyId,question:selected.question});
    continue;
  }
  const result=await teacher.teach({
    taskId:ctx.id,observation:ctx.description,impasse:"Existing strategy has contrasting outcomes and no stored question strategy resolves it.",
    knownStrategyIds:graph.entitiesByKind("question_strategy").map(x=>x.id)
  });
  ingestTeachingTrace(graph,result.trace);
  rows.push({index:i,impasse:ctx.id,source:"teacher",teacherInterventions:result.interventions,strategy:result.trace.extractedKnowledge?.find(x=>x.kind==="question-strategy")?.id});
}

const cold=rows.slice(0,1);
const warm=rows.slice(1);
const report={
  version:"teacher-displacement-v0.1",
  faculty:"question-selection",
  caveat:"Teacher is scripted/mock in this benchmark; this measures architecture-level displacement, not frontier-LLM quality.",
  rows,
  summary:{
    coldTeacherInterventions:cold.reduce((n,x)=>n+x.teacherInterventions,0),
    coldTasks:cold.length,
    warmTeacherInterventions:warm.reduce((n,x)=>n+x.teacherInterventions,0),
    warmTasks:warm.length,
    totalTeacherCalls:teacherCalls,
    warmIndependentRate:warm.filter(x=>x.source==="learner").length/warm.length,
  }
};
console.log(JSON.stringify(report,null,2));
