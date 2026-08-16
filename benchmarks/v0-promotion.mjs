import {
  T, defaultCapabilities, runAbstractionPromotionExperiment
} from "../dist/index.js";

const caps=defaultCapabilities();
const x={kind:"input",index:0,type:T.int};
const clone=v=>structuredClone(v);

const doubleExpr={kind:"call",capabilityId:"core.add_int",type:T.int,args:[clone(x),clone(x)]};
const tripleExpr={kind:"call",capabilityId:"core.add_int",type:T.int,args:[clone(doubleExpr),clone(x)]};
const selfMaxExpr={kind:"call",capabilityId:"core.max_int",type:T.int,args:[clone(x),clone(x)]};

const heldoutTriple={
  id:"promotion.heldout.triple",family:"promotion-int",split:"test",
  inputs:[T.int],output:T.int,
  examples:[{inputs:[2],output:6},{inputs:[5],output:15},{inputs:[9],output:27}]
};
const heldoutQuadruple={
  id:"promotion.heldout.quadruple",family:"promotion-int",split:"test",
  inputs:[T.int],output:T.int,
  examples:[{inputs:[2],output:8},{inputs:[3],output:12},{inputs:[7],output:28}]
};

// Discovery evidence is intentionally separate from held-out utility tasks.
// These source programs establish that the subgraph recurred independently;
// they are NOT supplied to either held-out search side.
const helpfulCandidate={
  key:"triple",
  expression:tripleExpr,
  occurrences:3,
  programIds:["discover.triple-context-a","discover.triple-context-b"],
  nodeCount:5,
  recurrenceScore:10
};
const helpfulSource={
  id:"discover.triple-context-a",inputs:[T.int],output:T.int,
  body:{kind:"call",capabilityId:"core.add_int",type:T.int,args:[clone(tripleExpr),clone(x)]}
};

const harmfulCandidate={
  key:"self-max",
  expression:selfMaxExpr,
  occurrences:5,
  programIds:["discover.selfmax-a","discover.selfmax-b"],
  nodeCount:3,
  recurrenceScore:6
};
const harmfulSource={
  id:"discover.selfmax-a",inputs:[T.int],output:T.int,body:selfMaxExpr
};

const helpful=runAbstractionPromotionExperiment({
  candidate:helpfulCandidate,
  sourceProgram:helpfulSource,
  candidateProgramId:"abstract.triple",
  heldoutTasks:[heldoutTriple],
  caps,
  maxDepth:3
});

const harmful=runAbstractionPromotionExperiment({
  candidate:harmfulCandidate,
  sourceProgram:harmfulSource,
  candidateProgramId:"abstract.selfmax",
  heldoutTasks:[heldoutQuadruple],
  caps,
  maxDepth:3
});

const report={
  version:"promotion-v0.1",
  generatedAt:new Date().toISOString(),
  helpful:{
    baselineCandidates:helpful.baseline.candidates,
    promotedCandidates:helpful.promoted.candidates,
    baselineSolved:helpful.baseline.solved,
    promotedSolved:helpful.promoted.solved,
    decision:helpful.decision,
  },
  harmful:{
    baselineCandidates:harmful.baseline.candidates,
    promotedCandidates:harmful.promoted.candidates,
    baselineSolved:harmful.baseline.solved,
    promotedSolved:harmful.promoted.solved,
    decision:harmful.decision,
  }
};
console.log(JSON.stringify(report,null,2));
