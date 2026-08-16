
import fs from "node:fs";
import {
  parseTeacherOutput, MemoryGraphStore, ingestTeachingTrace,
  synthesizeDetailed, MemoryProgramLibrary, defaultCapabilities, T
} from "../dist/index.js";

const raw=JSON.parse(fs.readFileSync("real-teacher-run/02-teacher-response.json","utf8"));
const trace=parseTeacherOutput(raw); // app schema validation
const graph=new MemoryGraphStore();
ingestTeachingTrace(graph,trace);    // proposals become provenance-bearing graph nodes

const caps=defaultCapabilities();
const x={kind:"input",index:0,type:T.int};
const double={
  id:"abstract.double",inputs:[T.int],output:T.int,
  body:{kind:"call",capabilityId:"core.add_int",type:T.int,args:[structuredClone(x),structuredClone(x)]},
  properties:["scaling"],provenance:["family:multiply-family"]
};
const makeTask=(id,m)=>({
  id,family:"multiply-family",labels:["scaling"],inputs:[T.int],output:T.int,
  examples:[{inputs:[2],output:2*m},{inputs:[3],output:3*m},{inputs:[7],output:7*m}]
});
const cases=[
  {name:"easy-triple",task:makeTask("probe.easy.triple",3),fullDepth:2},
  {name:"hard-sextuple",task:makeTask("probe.hard.sextuple",6),fullDepth:4},
];

const run=(task,maxDepth,learned)=>{
  const lib=new MemoryProgramLibrary();
  if(learned) lib.put(double);
  const callable=learned?[double]:[];
  return synthesizeDetailed(task,caps,{
    maxDepth,programs:lib,callablePrograms:callable,
    programCallPriority:learned?"before-capabilities":"after-capabilities"
  });
};

const results=[];
for(const c of cases){
  const probes=[];
  for(const depth of [1,2]){
    const primitive=run(c.task,depth,false);
    const learned=run(c.task,depth,true);
    probes.push({
      depth,
      primitive:{solved:!!primitive.program,candidates:primitive.candidatesExplored,depthReached:primitive.maxDepthReached},
      learned:{solved:!!learned.program,candidates:learned.candidatesExplored,depthReached:learned.maxDepthReached}
    });
  }
  const primitiveFull=run(c.task,c.fullDepth,false);
  const learnedFull=run(c.task,c.fullDepth,true);
  const eventualBetter =
    !!primitiveFull.program && !learnedFull.program ? "primitive" :
    !!learnedFull.program && !primitiveFull.program ? "learned" :
    primitiveFull.candidatesExplored<=learnedFull.candidatesExplored ? "primitive" : "learned";
  results.push({
    case:c.name,
    probes,
    full:{
      primitive:{solved:!!primitiveFull.program,candidates:primitiveFull.candidatesExplored},
      learned:{solved:!!learnedFull.program,candidates:learnedFull.candidatesExplored},
      eventualBetter
    }
  });
}

// Conservative app-side validation of the proposed criterion.
// Accept only if a shallow probe supplies a deterministic discriminator that
// agrees with the eventual cheaper successful arm in BOTH contrasting cases.
function shallowChoice(p){
  if(p.primitive.solved && !p.learned.solved) return "primitive";
  if(p.learned.solved && !p.primitive.solved) return "learned";
  if(p.primitive.solved && p.learned.solved)
    return p.primitive.candidates<=p.learned.candidates?"primitive":"learned";
  return undefined;
}
const validation=results.map(r=>{
  const firstDecisive=r.probes.map(p=>({depth:p.depth,choice:shallowChoice(p)})).find(x=>x.choice);
  return {
    case:r.case,
    firstDecisive,
    eventualBetter:r.full.eventualBetter,
    predictedCorrectly:!!firstDecisive && firstDecisive.choice===r.full.eventualBetter
  };
});
const criterionAccepted=validation.every(x=>x.predictedCorrectly);

const outcome={
  teacherTraceValidated:true,
  graphCounts:{
    teachingTraces:graph.entitiesByKind("teaching_trace").length,
    hypotheses:graph.entitiesByKind("hypothesis").length,
    experiments:graph.entitiesByKind("experiment").length,
    questionStrategies:graph.entitiesByKind("question_strategy").length
  },
  experimentResults:results,
  validation,
  proposedCriterion:{
    id:"activation.unknown-prior-probe",
    accepted:criterionAccepted,
    reason:criterionAccepted
      ?"Shallow bounded probe predicted the eventual cheaper successful arm in all contrasting validation cases."
      :"The proposed bounded probe did not reliably predict the eventual better arm across contrasting validation cases; do not promote it yet."
  }
};

fs.writeFileSync("real-teacher-run/03-app-validation-result.json",JSON.stringify(outcome,null,2));
console.log(JSON.stringify(outcome,null,2));
