import {
  T, defaultCapabilities, synthesizeDetailed, mineRepeatedSubexpressions,
  runAbstractionPromotionExperiment, measureProgramUtility, MemoryProgramLibrary
} from "../dist/index.js";

const caps=defaultCapabilities();
const task=(id,multiplier,split)=>({
  id, family:"auto-abstraction-multiply", split,
  inputs:[T.int], output:T.int,
  examples:[
    {inputs:[2],output:2*multiplier},
    {inputs:[3],output:3*multiplier},
    {inputs:[7],output:7*multiplier},
  ]
});

const discoveryTasks=[
  task("discovery.triple",3,"train"),
  task("discovery.quadruple",4,"train"),
];
const validationTasks=[task("validation.sextuple",6,"validation")];
const finalTasks=[task("final.octuple",8,"test")];

// Intentionally independent discovery runs: neither learner sees the other's
// learned program library, so repeated structure is independently rediscovered.
const discoveryPrograms=[];
const discovery=[];
for(const t of discoveryTasks){
  const lib=new MemoryProgramLibrary();
  const result=synthesizeDetailed(t,caps,{maxDepth:3,programs:lib,callablePrograms:[]});
  if(!result.program) throw new Error(`discovery failed for ${t.id}`);
  discoveryPrograms.push(result.program);
  discovery.push({task:t.id,candidates:result.candidatesExplored,programId:result.program.id,body:result.program.body});
}

const candidates=mineRepeatedSubexpressions(discoveryPrograms,2);
if(candidates.length===0) throw new Error("no repeated abstraction candidate mined");
const candidate=candidates[0];
const sourceProgram=discoveryPrograms.find(p=>candidate.programIds.includes(p.id));
if(!sourceProgram) throw new Error("candidate has no source program");

const validation=runAbstractionPromotionExperiment({
  candidate,
  sourceProgram,
  candidateProgramId:"abstract.auto.double",
  heldoutTasks:validationTasks,
  caps,
  maxDepth:4,
});

if(!validation.decision.promoted || !validation.candidateProgram){
  throw new Error(`candidate failed validation: ${validation.decision.reason}`);
}

// Final test is never consulted by the promotion decision.
const finalBaseline=measureProgramUtility(finalTasks,caps,[],undefined,4);
const finalPromoted=measureProgramUtility(finalTasks,caps,[],validation.candidateProgram,4);

const report={
  version:"auto-abstraction-v0.1",
  generatedAt:new Date().toISOString(),
  discovery,
  minedCandidate:{
    occurrences:candidate.occurrences,
    independentPrograms:candidate.programIds,
    nodeCount:candidate.nodeCount,
    compressionGainNodes:validation.decision.compressionGainNodes,
    expression:candidate.expression,
  },
  validation:{
    baselineCandidates:validation.baseline.candidates,
    promotedCandidates:validation.promoted.candidates,
    searchSavings:validation.decision.heldoutSearchSavings,
    decision:validation.decision.reason,
  },
  finalUntouched:{
    baselineSolved:finalBaseline.solved,
    promotedSolved:finalPromoted.solved,
    baselineCandidates:finalBaseline.candidates,
    promotedCandidates:finalPromoted.candidates,
    searchSavings:finalBaseline.candidates-finalPromoted.candidates,
    candidateProgramId:validation.candidateProgram.id,
  }
};

console.log(JSON.stringify(report,null,2));
