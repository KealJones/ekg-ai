
import fs from "node:fs";
import {
  parseTeacherOutput, MemoryGraphStore, ingestTeachingTrace,
  defaultCapabilities, T, synthesizeDetailed, MemoryProgramLibrary,
  recordUtilityObservation, deriveUtilityPrior, chooseActivation
} from "../dist/index.js";

const trace=parseTeacherOutput(JSON.parse(fs.readFileSync("real-teacher-run/04-teacher-response-after-rejection.json","utf8")));
const graph=new MemoryGraphStore();
ingestTeachingTrace(graph,trace);

const caps=defaultCapabilities();
const x={kind:"input",index:0,type:T.int};
const double={
  id:"abstract.double",inputs:[T.int],output:T.int,
  body:{kind:"call",capabilityId:"core.add_int",type:T.int,args:[structuredClone(x),structuredClone(x)]},
  properties:["scaling"],provenance:["family:multiply-family"]
};
const task=(id,m,examples)=>({
  id,inputs:[T.int],output:T.int,family:"multiply-family",labels:["scaling"],
  examples:examples.map(v=>({inputs:[v],output:v*m}))
});
const contexts=[
  {
    key:"easy-scale",
    multiplier:3,
    depth:2,
    tasks:[
      task("explore.easy.1",3,[2,3,7]),
      task("explore.easy.2",3,[4,5,8]),
      task("exploit.easy.3",3,[6,9,11])
    ]
  },
  {
    key:"hard-scale",
    multiplier:6,
    depth:4,
    tasks:[
      task("explore.hard.1",6,[2,3,7]),
      task("explore.hard.2",6,[4,5,8]),
      task("exploit.hard.3",6,[6,9,11])
    ]
  }
];

const run=(t,maxDepth,learned)=>{
  const lib=new MemoryProgramLibrary();
  if(learned) lib.put(double);
  return synthesizeDetailed(t,caps,{
    maxDepth,programs:lib,callablePrograms:learned?[double]:[],
    programCallPriority:learned?"before-capabilities":"after-capabilities"
  });
};

const rows=[];
let dualArmMeasurements=0;
for(const ctx of contexts){
  // Teacher proposed exactly two bounded exploration episodes.
  for(let i=0;i<2;i++){
    const t=ctx.tasks[i];
    const primitive=run(t,ctx.depth,false);
    const learned=run(t,ctx.depth,true);
    dualArmMeasurements++;
    recordUtilityObservation(graph,{
      id:`${ctx.key}.${i+1}`,taskFamily:ctx.key,programId:double.id,
      primitiveSolved:!!primitive.program,learnedSolved:!!learned.program,
      primitiveCandidates:primitive.candidatesExplored,learnedCandidates:learned.candidatesExplored,
      provenance:["real-teacher-experiment:explore-then-exploit"]
    });
    rows.push({
      context:ctx.key,phase:"explore",task:t.id,
      primitive:{solved:!!primitive.program,candidates:primitive.candidatesExplored},
      learned:{solved:!!learned.program,candidates:learned.candidatesExplored}
    });
  }

  // Third task: derive prior from graph, choose ONE arm, and do not measure the other.
  const prior=deriveUtilityPrior(graph,ctx.key,double.id);
  const decision=chooseActivation({
    primitiveDepthHint:0,retrievedScore:150,librarySize:1,retrievedCount:1,
    priorMeanSavings:prior.meanSavings,priorObservations:prior.observations
  });
  const chosenLearned=decision.mode==="learned-first";
  const t=ctx.tasks[2];
  const chosen=run(t,ctx.depth,chosenLearned);
  rows.push({
    context:ctx.key,phase:"exploit",task:t.id,prior,decision,
    measuredArm:chosenLearned?"learned":"primitive",
    measured:{solved:!!chosen.program,candidates:chosen.candidatesExplored}
  });
}

const easyExploit=rows.find(r=>r.context==="easy-scale"&&r.phase==="exploit");
const hardExploit=rows.find(r=>r.context==="hard-scale"&&r.phase==="exploit");
const accepted=
  easyExploit?.decision?.mode==="primitive-only" &&
  hardExploit?.decision?.mode==="learned-first" &&
  easyExploit?.measured?.solved &&
  hardExploit?.measured?.solved &&
  dualArmMeasurements===4;

const outcome={
  teacherTraceValidated:true,
  experiment:"activation.explore-then-exploit",
  rows,
  dualArmMeasurements,
  exploitDecisions:2,
  proposedCriterion:{
    id:"activation.explore-then-exploit",
    accepted,
    reason:accepted
      ?"After two exploration observations per context, graph-derived priors chose primitive-only for the harmful easy context and learned-first for the beneficial hard context; exploit episodes measured only the chosen arm and both solved."
      :"The strategy did not produce the correct context-specific exploit decisions; do not promote."
  },
  teacherInterventionsForThisProposal:trace.teacherInterventions
};

fs.writeFileSync("real-teacher-run/05-app-second-validation-result.json",JSON.stringify(outcome,null,2));
console.log(JSON.stringify(outcome,null,2));
