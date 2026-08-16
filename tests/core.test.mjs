import test from "node:test";
import assert from "node:assert/strict";
import { T, defaultCapabilities, runProgram, executeGeneratedTypeScript, emitRust, MemoryGraphStore, synthesize, synthesizeDetailed } from "../dist/index.js";

const caps = defaultCapabilities();

test("portable blueprint has reference/TS semantic equivalence", () => {
  const p = {
    id:"demo.double_plus_one", inputs:[T.int], output:T.int,
    body:{ kind:"call", capabilityId:"core.add_int", type:T.int, args:[
      {kind:"call", capabilityId:"core.mul_int", type:T.int, args:[{kind:"input",index:0,type:T.int},{kind:"const",value:2,type:T.int}]},
      {kind:"const",value:1,type:T.int}
    ]}
  };
  for (const x of [-10,-1,0,1,7,999]) {
    const reference = runProgram(p,[x],caps);
    const generated = executeGeneratedTypeScript(p,[x],caps);
    assert.equal(generated, reference);
  }
  const rust = emitRust(p,caps);
  assert.match(rust,/pub fn run/);
  assert.match(rust,/\*/);
  assert.match(rust,/\+/);
});

test("typed enumerative synthesis learns x*2 from examples", () => {
  const program = synthesize({
    id:"double", inputs:[T.int], output:T.int,
    examples:[{inputs:[1],output:2},{inputs:[3],output:6},{inputs:[8],output:16}]
  }, caps, 2);
  assert.ok(program);
  assert.equal(runProgram(program,[11],caps),22);
});

test("graph storage is independent from program semantics", () => {
  const g = new MemoryGraphStore();
  g.putEntity({id:"concept.maximum",kind:"concept",labels:["maximum"]});
  g.putEntity({id:"core.max_int",kind:"capability",labels:["max int"]});
  g.putRelation({id:"r1",kind:"implemented_by",from:"concept.maximum",to:"core.max_int",confidence:1});
  assert.equal(g.outgoing("concept.maximum","implemented_by")[0]?.to,"core.max_int");
});

import { MemoryProgramLibrary, MemoryEpisodeStore, LearnerController } from "../dist/index.js";

function controllerWith(programs = []) {
  const lib = new MemoryProgramLibrary();
  for (const p of programs) lib.put(p);
  const episodes = new MemoryEpisodeStore();
  return { lib, episodes, controller: new LearnerController(caps, lib, episodes) };
}

test("controller RUNs an already-known compatible program", () => {
  const known = {
    id:"known.double", inputs:[T.int], output:T.int,
    body:{kind:"call",capabilityId:"core.mul_int",type:T.int,args:[
      {kind:"input",index:0,type:T.int},{kind:"const",value:2,type:T.int}
    ]}
  };
  const {controller, episodes} = controllerWith([known]);
  const result = controller.solve({id:"double-again",inputs:[T.int],output:T.int,examples:[{inputs:[2],output:4},{inputs:[9],output:18}]},2);
  assert.equal(result.decision,"RUN");
  assert.equal(result.program?.id,"known.double");
  assert.equal(episodes.all()[0]?.decision,"RUN");
});

test("controller ADAPTs from a near-match known program", () => {
  const known = {
    id:"known.double-plus-one", inputs:[T.int], output:T.int,
    body:{kind:"call",capabilityId:"core.add_int",type:T.int,args:[
      {kind:"call",capabilityId:"core.mul_int",type:T.int,args:[
        {kind:"input",index:0,type:T.int},{kind:"const",value:2,type:T.int}
      ]},
      {kind:"const",value:1,type:T.int}
    ]}
  };
  const {controller, episodes} = controllerWith([known]);
  const result = controller.solve({id:"double",inputs:[T.int],output:T.int,examples:[{inputs:[2],output:4},{inputs:[9],output:18}]},1);
  assert.equal(result.decision,"ADAPT");
  assert.equal(runProgram(result.program,[11],caps),22);
  assert.deepEqual(episodes.all()[0]?.reusedSeedProgramIds,["known.double-plus-one"]);
});

test("controller BUILDs when no compatible program exists", () => {
  const {controller, lib, episodes} = controllerWith();
  const result = controller.solve({id:"triple",inputs:[T.int],output:T.int,examples:[{inputs:[2],output:6},{inputs:[4],output:12}]},2);
  assert.equal(result.decision,"BUILD");
  assert.equal(runProgram(result.program,[7],caps),21);
  assert.ok(lib.get("learned.triple"));
  assert.equal(episodes.all()[0]?.decision,"BUILD");
});

test("controller falls through to TEACH on an unsolved capability gap", () => {
  const {controller, episodes} = controllerWith();
  const result = controller.solve({id:"reverse-string",inputs:[T.string],output:T.string,examples:[{inputs:["abc"],output:"cba"}]},2);
  assert.equal(result.decision,"TEACH");
  assert.equal(result.success,false);
  assert.equal(episodes.all()[0]?.decision,"TEACH");
});

import { evaluateTask } from "../dist/index.js";

test("TaskSpec properties reject an example-fitting shortcut", () => {
  const bad = {
    id:"bad.constant-six", inputs:[T.int], output:T.int,
    body:{kind:"const",value:6,type:T.int}
  };
  const task = {
    id:"identity-six-trap", inputs:[T.int], output:T.int,
    examples:[{inputs:[6],output:6}],
    properties:[{
      id:"output-equals-input",
      cases:[[-5],[0],[1],[9],[42]],
      assertion:{kind:"call",capabilityId:"core.eq_int",args:[{kind:"output"},{kind:"input",index:0}]}
    }]
  };
  const result = evaluateTask(bad,task,caps);
  assert.equal(result.passed,false);
  assert.deepEqual(result.failedPropertyIds,["output-equals-input"]);
});

test("synthesis honors declarative properties in addition to examples", () => {
  const task = {
    id:"identity-property", inputs:[T.int], output:T.int,
    examples:[{inputs:[6],output:6}],
    properties:[{
      id:"output-equals-input",
      cases:[[-3],[0],[2],[10]],
      assertion:{kind:"call",capabilityId:"core.eq_int",args:[{kind:"output"},{kind:"input",index:0}]}
    }]
  };
  const program = synthesize(task,caps,1);
  assert.ok(program);
  assert.equal(runProgram(program,[123],caps),123);
});

import { MemorizeBaseline, frozenV0Suite, stableTaskFingerprint } from "../dist/index.js";

test("memorize baseline only recalls the exact grounded task", () => {
  const memory = new MemorizeBaseline();
  const train = frozenV0Suite.train.find(t=>t.id==="train.double");
  const heldout = frozenV0Suite.test.find(t=>t.id==="test.triple");
  const program = synthesize(train,caps,2);
  assert.ok(program);
  memory.remember(train,program);
  assert.ok(memory.recall(train));
  assert.equal(memory.recall(heldout),undefined);
  assert.notEqual(stableTaskFingerprint(train),stableTaskFingerprint(heldout));
});

test("learned programs are first-class callable nodes in later blueprints", () => {
  const lib = new MemoryProgramLibrary();
  const double = {
    id:"learned.double-callable",inputs:[T.int],output:T.int,
    body:{kind:"call",capabilityId:"core.add_int",type:T.int,args:[{kind:"input",index:0,type:T.int},{kind:"input",index:0,type:T.int}]}
  };
  lib.put(double);
  const quadruple = {
    id:"learned.quadruple-via-double",inputs:[T.int],output:T.int,
    body:{kind:"program_call",programId:"learned.double-callable",type:T.int,args:[
      {kind:"program_call",programId:"learned.double-callable",type:T.int,args:[{kind:"input",index:0,type:T.int}]}
    ]}
  };
  assert.equal(runProgram(quadruple,[7],caps,lib),28);
  assert.equal(executeGeneratedTypeScript(quadruple,[7],caps,lib),28);
  assert.match(emitRust(quadruple,caps,lib),/\+/);
});

import { mineRepeatedSubexpressions, summarizeProgramUsage } from "../dist/index.js";

test("abstraction miner finds repeated learned executable structure", () => {
  const doubleExpr={kind:"call",capabilityId:"core.add_int",type:T.int,args:[{kind:"input",index:0,type:T.int},{kind:"input",index:0,type:T.int}]};
  const programs=[
    {id:"p.triple",inputs:[T.int],output:T.int,body:{kind:"call",capabilityId:"core.add_int",type:T.int,args:[structuredClone(doubleExpr),{kind:"input",index:0,type:T.int}]}},
    {id:"p.double-square",inputs:[T.int],output:T.int,body:{kind:"call",capabilityId:"core.mul_int",type:T.int,args:[structuredClone(doubleExpr),structuredClone(doubleExpr)]}},
  ];
  const candidates=mineRepeatedSubexpressions(programs,2);
  assert.ok(candidates.length>0);
  assert.equal(candidates[0].expression.kind,"call");
  assert.deepEqual(new Set(candidates[0].programIds),new Set(["p.triple","p.double-square"]));
  assert.ok(candidates[0].occurrences>=3);
});

test("usage telemetry distinguishes direct use from structural centrality", () => {
  const child={id:"p.child",inputs:[T.int],output:T.int,body:{kind:"input",index:0,type:T.int}};
  const parent={id:"p.parent",inputs:[T.int],output:T.int,body:{kind:"program_call",programId:"p.child",type:T.int,args:[{kind:"input",index:0,type:T.int}]}};
  const usage=summarizeProgramUsage([child,parent],[{id:"e1",taskId:"t",decision:"RUN",retrievedProgramIds:["p.parent"],selectedProgramId:"p.parent",success:true,searchCandidatesExplored:0,searchDepthReached:0,timestamp:new Date().toISOString()}]);
  const childStats=usage.find(x=>x.programId==="p.child");
  const parentStats=usage.find(x=>x.programId==="p.parent");
  assert.equal(childStats.calledByBlueprints,1);
  assert.equal(childStats.selectedUses,0);
  assert.equal(parentStats.selectedUses,1);
  assert.equal(parentStats.zeroSearchRuns,1);
});


import { decideAbstractionPromotion, estimateCompressionGain, candidateToProgram } from "../dist/index.js";

test("abstraction promotion requires independent recurrence, compression, and held-out search savings", () => {
  const expr={kind:"call",capabilityId:"core.add_int",type:T.int,args:[{kind:"input",index:0,type:T.int},{kind:"input",index:0,type:T.int}]};
  const candidate={key:"double",expression:expr,occurrences:5,programIds:["p1","p2","p3"],nodeCount:3,recurrenceScore:9};
  assert.ok(estimateCompressionGain(candidate)>0);
  const decision=decideAbstractionPromotion(candidate,{baselineCandidates:100,promotedCandidates:40});
  assert.equal(decision.promoted,true);
  assert.equal(decision.reason,"promoted");
  assert.equal(decision.heldoutSearchSavings,60);
});

test("frequent abstraction with no held-out search benefit MUST NOT promote", () => {
  const expr={kind:"call",capabilityId:"core.add_int",type:T.int,args:[{kind:"input",index:0,type:T.int},{kind:"input",index:0,type:T.int}]};
  const candidate={key:"popular-but-useless",expression:expr,occurrences:100,programIds:["p1","p2","p3","p4"],nodeCount:3,recurrenceScore:12};
  const decision=decideAbstractionPromotion(candidate,{baselineCandidates:20,promotedCandidates:20});
  assert.equal(decision.promoted,false);
  assert.equal(decision.reason,"no-heldout-utility");
});

test("one-program repetition MUST NOT promote even when locally frequent", () => {
  const expr={kind:"call",capabilityId:"core.add_int",type:T.int,args:[{kind:"input",index:0,type:T.int},{kind:"input",index:0,type:T.int}]};
  const candidate={key:"one-program-loop",expression:expr,occurrences:20,programIds:["p1"],nodeCount:3,recurrenceScore:3};
  const decision=decideAbstractionPromotion(candidate,{baselineCandidates:100,promotedCandidates:1});
  assert.equal(decision.promoted,false);
  assert.equal(decision.reason,"insufficient-independent-programs");
});

test("candidate abstraction can become a portable callable program without host-language semantics", () => {
  const expr={kind:"call",capabilityId:"core.add_int",type:T.int,args:[{kind:"input",index:0,type:T.int},{kind:"input",index:0,type:T.int}]};
  const candidate={key:"double",expression:expr,occurrences:4,programIds:["p1","p2"],nodeCount:3,recurrenceScore:6};
  const source={id:"p1",inputs:[T.int],output:T.int,body:expr};
  const promoted=candidateToProgram(candidate,source,"learned.abstract.double");
  assert.ok(promoted);
  assert.equal(runProgram(promoted,[9],caps),18);
});


import { runAbstractionPromotionExperiment, measureProgramUtility } from "../dist/index.js";

test("automatic promotion experiment rejects an abstraction that expands held-out search", () => {
  const x={kind:"input",index:0,type:T.int};
  const irrelevantExpr={kind:"call",capabilityId:"core.max_int",type:T.int,args:[structuredClone(x),structuredClone(x)]};
  const candidate={key:"self-max",expression:irrelevantExpr,occurrences:5,programIds:["p1","p2"],nodeCount:3,recurrenceScore:6};
  const source={id:"p1",inputs:[T.int],output:T.int,body:irrelevantExpr};
  const task={
    id:"heldout.quadruple",inputs:[T.int],output:T.int,
    examples:[{inputs:[2],output:8},{inputs:[3],output:12},{inputs:[7],output:28}]
  };
  const result=runAbstractionPromotionExperiment({
    candidate,sourceProgram:source,candidateProgramId:"abstract.selfmax",
    heldoutTasks:[task],caps,maxDepth:3
  });
  assert.equal(result.baseline.solved,1);
  assert.equal(result.promoted.solved,1);
  assert.ok(result.promoted.candidates>result.baseline.candidates);
  assert.equal(result.decision.promoted,false);
  assert.equal(result.decision.reason,"no-heldout-utility");
});

test("automatic promotion experiment promotes an abstraction only when it measurably helps held-out search", () => {
  const x={kind:"input",index:0,type:T.int};
  const doubleExpr={kind:"call",capabilityId:"core.add_int",type:T.int,args:[structuredClone(x),structuredClone(x)]};
  const tripleExpr={kind:"call",capabilityId:"core.add_int",type:T.int,args:[structuredClone(doubleExpr),structuredClone(x)]};
  const candidate={key:"triple",expression:tripleExpr,occurrences:3,programIds:["discover.a","discover.b"],nodeCount:5,recurrenceScore:10};
  const source={id:"discover.a",inputs:[T.int],output:T.int,body:{
    kind:"call",capabilityId:"core.add_int",type:T.int,args:[structuredClone(tripleExpr),structuredClone(x)]
  }};
  const task={
    id:"heldout.triple",inputs:[T.int],output:T.int,
    examples:[{inputs:[2],output:6},{inputs:[5],output:15},{inputs:[9],output:27}]
  };
  const result=runAbstractionPromotionExperiment({
    candidate,sourceProgram:source,candidateProgramId:"abstract.triple",
    heldoutTasks:[task],caps,maxDepth:3
  });
  assert.equal(result.baseline.solved,1);
  assert.equal(result.promoted.solved,1);
  assert.ok(result.promoted.candidates<result.baseline.candidates,
    `expected abstraction to reduce search: baseline=${result.baseline.candidates}, promoted=${result.promoted.candidates}`);
  assert.equal(result.decision.promoted,true);
  assert.equal(result.decision.reason,"promoted");
  assert.ok(result.decision.heldoutSearchSavings>0);
});


test("independent learned programs can yield a mined abstraction that validates and transfers to untouched tasks", () => {
  const makeTask=(id,m)=>({
    id,inputs:[T.int],output:T.int,
    examples:[{inputs:[2],output:2*m},{inputs:[3],output:3*m},{inputs:[7],output:7*m}]
  });
  const discovered=[];
  for(const task of [makeTask("independent.triple",3),makeTask("independent.quad",4)]){
    const lib=new MemoryProgramLibrary();
    const result=synthesizeDetailed(task,caps,{maxDepth:3,programs:lib,callablePrograms:[]});
    assert.ok(result.program);
    discovered.push(result.program);
  }

  const candidates=mineRepeatedSubexpressions(discovered,2);
  assert.ok(candidates.length>0);
  const candidate=candidates[0];
  const source=discovered.find(p=>candidate.programIds.includes(p.id));
  assert.ok(source);

  const validation=runAbstractionPromotionExperiment({
    candidate,sourceProgram:source,candidateProgramId:"abstract.auto.double",
    heldoutTasks:[makeTask("validation.six",6)],caps,maxDepth:4
  });
  assert.equal(validation.decision.promoted,true);
  assert.ok(validation.candidateProgram);
  assert.ok(validation.promoted.candidates<validation.baseline.candidates);

  const finalBaseline=measureProgramUtility([makeTask("final.eight",8)],caps,[],undefined,4);
  const finalPromoted=measureProgramUtility([makeTask("final.eight",8)],caps,[],validation.candidateProgram,4);
  assert.equal(finalBaseline.solved,1);
  assert.equal(finalPromoted.solved,1);
  assert.ok(finalPromoted.candidates<finalBaseline.candidates,
    `expected untouched transfer savings: baseline=${finalBaseline.candidates}, promoted=${finalPromoted.candidates}`);
});


import { retrievePrograms } from "../dist/index.js";

test("retrieval hard-filters wrong program types before ranking", () => {
  const intIdentity={id:"int.identity",inputs:[T.int],output:T.int,body:{kind:"input",index:0,type:T.int},properties:["identity"]};
  const stringIdentity={id:"string.identity",inputs:[T.string],output:T.string,body:{kind:"input",index:0,type:T.string},properties:["identity","wanted"]};
  const task={id:"retrieve.int",inputs:[T.int],output:T.int,examples:[{inputs:[2],output:2}],labels:["wanted"]};
  const results=retrievePrograms(task,[stringIdentity,intIdentity],{limit:5});
  assert.deepEqual(results.map(x=>x.program.id),["int.identity"]);
});

test("retrieval uses task labels to rank compatible learned procedures", () => {
  const x={kind:"input",index:0,type:T.int};
  const double={id:"learned.double",inputs:[T.int],output:T.int,body:{kind:"call",capabilityId:"core.add_int",type:T.int,args:[structuredClone(x),structuredClone(x)]},properties:["scaling","doubling"]};
  const identity={id:"learned.identity",inputs:[T.int],output:T.int,body:x,properties:["identity"]};
  const task={id:"retrieve.scale",inputs:[T.int],output:T.int,examples:[{inputs:[3],output:6}],labels:["scaling"]};
  const results=retrievePrograms(task,[identity,double],{limit:1});
  assert.equal(results[0].program.id,"learned.double");
  assert.ok(results[0].reasons.some(x=>x.startsWith("labels:")));
});

test("retrieval does not hallucinate relevance from usage when type contract is wrong", () => {
  const wrong={id:"popular.string",inputs:[T.string],output:T.string,body:{kind:"input",index:0,type:T.string}};
  const right={id:"quiet.int",inputs:[T.int],output:T.int,body:{kind:"input",index:0,type:T.int}};
  const usage=[{programId:"popular.string",selectedUses:100000,calledByBlueprints:100000,parentProgramIds:[],taskUses:100000,successes:100000,zeroSearchRuns:100000}];
  const task={id:"retrieve.int.usage",inputs:[T.int],output:T.int,examples:[{inputs:[1],output:1}]};
  const results=retrievePrograms(task,[wrong,right],{usage,limit:5});
  assert.deepEqual(results.map(x=>x.program.id),["quiet.int"]);
});


import { labelActivationOutcome, chooseActivation } from "../dist/index.js";

test("activation oracle abstains when retrieved knowledge costs more than primitives", () => {
  const decision=labelActivationOutcome({primitive:{solved:true,candidates:5},learned:{solved:true,candidates:10}});
  assert.equal(decision.mode,"primitive-only");
  assert.equal(decision.reason,"abstain-no-benefit");
  assert.equal(decision.candidateSavings,-5);
});

test("activation oracle selects learned search when it preserves solve rate and reduces cost", () => {
  const decision=labelActivationOutcome({primitive:{solved:true,candidates:434},learned:{solved:true,candidates:82}});
  assert.equal(decision.mode,"learned-first");
  assert.equal(decision.reason,"learned-reduces-search");
  assert.equal(decision.candidateSavings,352);
});

test("activation oracle never trades away a primitive solution for a cheaper learned failure", () => {
  const decision=labelActivationOutcome({primitive:{solved:true,candidates:100},learned:{solved:false,candidates:1}});
  assert.equal(decision.mode,"primitive-only");
  assert.equal(decision.reason,"abstain-regression");
});

test("online activation policy uses repeated measured benefit but abstains on repeated harm", () => {
  assert.equal(chooseActivation({primitiveDepthHint:2,retrievedScore:150,librarySize:100,retrievedCount:1,priorMeanSavings:40,priorObservations:3}).mode,"learned-first");
  assert.equal(chooseActivation({primitiveDepthHint:4,retrievedScore:180,librarySize:100,retrievedCount:1,priorMeanSavings:-3,priorObservations:4}).mode,"primitive-only");
});

test("online activation policy is conservative without evidence on trivial searches", () => {
  const d=chooseActivation({primitiveDepthHint:2,retrievedScore:150,librarySize:13,retrievedCount:1});
  assert.equal(d.mode,"primitive-only");
});


import { validateTeachingTrace } from "../dist/index.js";

test("teaching trace captures reasoning that can later become reusable teacher knowledge", () => {
  const trace={
    id:"teach.activation.001",
    taskId:"retrieval.heldout.triple",
    observation:"Relevant learned procedure increased search cost.",
    impasse:"Relevance alone does not determine whether learned knowledge should be used.",
    teacherQuestion:"What distinguishes cases where retrieved knowledge helps from cases where it hurts?",
    hypotheses:[
      {statement:"Always use relevant learned knowledge",status:"rejected",reason:"5 primitive candidates vs 10 learned"},
      {statement:"Activate only when expected utility exceeds overhead",status:"supported"}
    ],
    experiments:[{question:"Compare primitive-only and learned-first search on easy and hard tasks.",result:"easy: 5 vs 10; hard: 434 vs 82"}],
    conclusion:"Retrieval and activation are separate decisions.",
    extractedKnowledge:[{kind:"criterion",id:"activation.expected-utility",description:"Use retrieved knowledge only when expected benefit exceeds activation/search overhead."}],
    nextQuestion:"How can expected search utility be predicted before running both arms?",
    teacherInterventions:2,
    provenance:["conversation:teacher","benchmark:retrieval-v0.1","benchmark:activation-v0.1"]
  };
  assert.doesNotThrow(()=>validateTeachingTrace(trace));
});

test("teaching trace rejects empty provenance and zero teacher interventions", () => {
  const bad={id:"bad",observation:"x",teacherQuestion:"why?",hypotheses:[],experiments:[],teacherInterventions:0,provenance:[]};
  assert.throws(()=>validateTeachingTrace(bad),/teacherInterventions/);
  assert.throws(()=>validateTeachingTrace({...bad,teacherInterventions:1}),/provenance/);
});


import { ingestTeachingTrace, teachingTraceKnowledge } from "../dist/index.js";

test("teaching traces become graph-native linked knowledge", () => {
  const graph=new MemoryGraphStore();
  const trace={
    id:"graph-teach-1",observation:"A helped here and hurt there.",impasse:"Need to distinguish regimes.",
    teacherQuestion:"What differs between the regimes?",
    hypotheses:[{statement:"Difficulty matters",status:"supported"}],
    experiments:[{question:"Compare easy vs hard",result:"different utility"}],
    conclusion:"Activation depends on expected utility.",
    extractedKnowledge:[
      {kind:"criterion",id:"activation.utility",description:"Activate when expected benefit exceeds cost."},
      {kind:"question-strategy",id:"teacher.compare-regimes",description:"Contrast success and failure cases."}
    ],
    nextQuestion:"How can utility be predicted?",teacherInterventions:2,provenance:["test"]
  };
  ingestTeachingTrace(graph,trace);
  assert.equal(graph.entitiesByKind("teaching_trace").length,1);
  assert.equal(graph.entitiesByKind("impasse").length,1);
  assert.equal(graph.entitiesByKind("question_strategy").length,1);
  assert.equal(teachingTraceKnowledge(graph,"graph-teach-1").length,2);
  assert.equal(graph.outgoing("teaching:graph-teach-1","extracted_knowledge").length,2);
});

test("graph-native teaching ingestion rejects invalid traces before mutating graph", () => {
  const graph=new MemoryGraphStore();
  assert.throws(()=>ingestTeachingTrace(graph,{
    id:"bad",observation:"",teacherQuestion:"?",hypotheses:[],experiments:[],
    teacherInterventions:1,provenance:["test"]
  }),/observation/);
  assert.equal(graph.entitiesByKind("teaching_trace").length,0);
});


import { recordUtilityObservation, deriveUtilityPrior } from "../dist/index.js";

test("activation utility prior is derived from graph-stored experience", () => {
  const graph=new MemoryGraphStore();
  recordUtilityObservation(graph,{id:"u1",taskFamily:"hard-scale",programId:"abstract.double",primitiveSolved:true,learnedSolved:true,primitiveCandidates:434,learnedCandidates:82,provenance:["bench"]});
  recordUtilityObservation(graph,{id:"u2",taskFamily:"hard-scale",programId:"abstract.double",primitiveSolved:true,learnedSolved:true,primitiveCandidates:300,learnedCandidates:100,provenance:["bench"]});
  const prior=deriveUtilityPrior(graph,"hard-scale","abstract.double");
  assert.equal(prior.observations,2);
  assert.equal(prior.meanSavings,276);
  assert.equal(prior.learnedWins,2);
  const decision=chooseActivation({primitiveDepthHint:0,retrievedScore:0,librarySize:50,retrievedCount:1,priorMeanSavings:prior.meanSavings,priorObservations:prior.observations});
  assert.equal(decision.mode,"learned-first");
});

test("graph-derived activation history learns to abstain after repeated overhead", () => {
  const graph=new MemoryGraphStore();
  for(let i=0;i<3;i++) recordUtilityObservation(graph,{id:`easy-${i}`,taskFamily:"easy-scale",programId:"abstract.double",primitiveSolved:true,learnedSolved:true,primitiveCandidates:5,learnedCandidates:10,provenance:["bench"]});
  const prior=deriveUtilityPrior(graph,"easy-scale","abstract.double");
  assert.equal(prior.meanSavings,-5);
  assert.equal(chooseActivation({primitiveDepthHint:10,retrievedScore:999,librarySize:50,retrievedCount:1,priorMeanSavings:prior.meanSavings,priorObservations:prior.observations}).mode,"primitive-only");
});

test("utility evidence rejects malformed observations", () => {
  const graph=new MemoryGraphStore();
  assert.throws(()=>recordUtilityObservation(graph,{id:"bad",taskFamily:"x",programId:"p",primitiveSolved:true,learnedSolved:true,primitiveCandidates:-1,learnedCandidates:0,provenance:["x"]}),/non-negative/);
  assert.equal(graph.entitiesByKind("utility_evidence").length,0);
});


import { selectQuestionStrategy } from "../dist/index.js";

test("learner can select stored compare-regimes teacher strategy for a new contrasting impasse", () => {
  const graph=new MemoryGraphStore();
  ingestTeachingTrace(graph,{
    id:"seed-teacher-strategy",observation:"A worked in one case and failed in another.",impasse:"Need discriminating feature.",
    teacherQuestion:"What differs?",hypotheses:[],experiments:[],
    extractedKnowledge:[{kind:"question-strategy",id:"teacher.compare-regimes",description:"Contrast success and failure regimes and ask what feature distinguishes them."}],
    teacherInterventions:1,provenance:["seed"]
  });
  const selected=selectQuestionStrategy(graph,{id:"new-impasse",description:"Caching helps large tasks but hurts small tasks.",tags:["performance"],contrastingOutcomes:true});
  assert.ok(selected);
  assert.match(selected.strategyId,/teacher.compare-regimes/);
  assert.match(selected.question,/differs/i);
});

test("question selector abstains when no stored strategy matches the impasse", () => {
  const graph=new MemoryGraphStore();
  ingestTeachingTrace(graph,{
    id:"unrelated",observation:"Missing source caused uncertainty.",teacherQuestion:"What source is missing?",
    hypotheses:[],experiments:[],
    extractedKnowledge:[{kind:"question-strategy",id:"teacher.find-source",description:"Resolve missing external evidence before concluding."}],
    teacherInterventions:1,provenance:["seed"]
  });
  assert.equal(selectQuestionStrategy(graph,{id:"x",description:"Two algorithms have opposite scaling behavior.",tags:["performance"],contrastingOutcomes:true}),undefined);
});


import { TeacherAdapter, parseTeacherOutput, teacherSystemPrompt } from "../dist/index.js";

test("teacher adapter enforces structured teach-to-replace-yourself output", async () => {
  let received;
  const transport={invoke:async req=>{
    received=req;
    return {
      id:"teacher.mock.1",taskId:"t1",observation:"A works only in one regime.",impasse:"Unknown discriminator.",
      teacherQuestion:"What differs between success and failure cases?",
      hypotheses:[{statement:"Problem scale determines utility.",status:"supported"}],
      experiments:[{question:"Compare small and large cases.",result:"utility flips with scale"}],
      conclusion:"Use contextual utility rather than relevance alone.",
      extractedKnowledge:[{kind:"question-strategy",id:"teacher.compare-regimes",description:"Contrast success/failure regimes and find their discriminator."}],
      nextQuestion:"Can prior episodes predict the regime?",teacherInterventions:1,provenance:["mock-teacher"]
    };
  }};
  const adapter=new TeacherAdapter(transport);
  const result=await adapter.teach({taskId:"t1",observation:"A works only in one regime.",impasse:"Unknown discriminator."});
  assert.equal(result.interventions,1);
  assert.equal(result.trace.extractedKnowledge[0].kind,"question-strategy");
  assert.match(received.system,/make your own future intervention unnecessary/i);
  assert.ok(received.tools.some(x=>x.name==="search_graph"));
});

test("teacher adapter rejects prose or malformed structured output", async () => {
  assert.throws(()=>parseTeacherOutput("Here is what I think..."),/object/);
  const adapter=new TeacherAdapter({invoke:async()=>({id:"x",observation:"x",teacherQuestion:"?",hypotheses:[],experiments:[],teacherInterventions:1,provenance:[]})});
  await assert.rejects(()=>adapter.teach({observation:"x"}),/provenance/);
});


test("stored teacher question strategy displaces teacher on later structurally similar impasses", async () => {
  const graph=new MemoryGraphStore();
  let calls=0;
  const adapter=new TeacherAdapter({invoke:async req=>{
    calls++;
    return {
      id:"displace.seed",taskId:req.context.taskId,observation:req.context.observation,impasse:req.context.impasse,
      teacherQuestion:"What differs between success and failure regimes?",hypotheses:[],experiments:[],
      extractedKnowledge:[{kind:"question-strategy",id:"teacher.compare-regimes",description:"Contrast success and failure regimes and ask what feature distinguishes them."}],
      teacherInterventions:1,provenance:["test-teacher"]
    };
  }});

  const first={id:"first",description:"Optimization helps big jobs and hurts small jobs.",tags:["performance"],contrastingOutcomes:true};
  assert.equal(selectQuestionStrategy(graph,first),undefined);
  const taught=await adapter.teach({taskId:first.id,observation:first.description,impasse:"No matching question strategy."});
  ingestTeachingTrace(graph,taught.trace);
  assert.equal(calls,1);

  for(const next of [
    {id:"second",description:"Cache helps repetition and hurts one-shot use.",tags:["performance"],contrastingOutcomes:true},
    {id:"third",description:"Batching helps large sets and hurts tiny sets.",tags:["performance"],contrastingOutcomes:true},
  ]){
    const selected=selectQuestionStrategy(graph,next);
    assert.ok(selected);
    assert.match(selected.strategyId,/teacher.compare-regimes/);
  }
  assert.equal(calls,1,"teacher should not be called again for the learned question-selection faculty");
});

test("durable program library deduplicates exact canonical Blueprint semantics", () => {
  const lib = new MemoryProgramLibrary();
  const first = {
    id:"learned.double.a", name:"first name", inputs:[T.int], output:T.int,
    body:{kind:"call",capabilityId:"core.mul_int",type:T.int,args:[{kind:"input",index:0,type:T.int},{kind:"const",value:2,type:T.int}]},
    provenance:["teacher:a"]
  };
  const duplicate = {
    ...structuredClone(first), id:"learned.double.b", name:"different name", provenance:["teacher:b"]
  };
  const storedA = lib.put(first);
  const storedB = lib.put(duplicate);
  assert.equal(storedA.id,"learned.double.a");
  assert.equal(storedB.id,"learned.double.a");
  assert.equal(lib.all().length,1);
  assert.equal(lib.get("learned.double.b"),undefined);
  assert.equal(lib.findEquivalent(duplicate)?.id,"learned.double.a");
});

test("Blueprint dedupe does not collapse structurally different plans that happen to be behaviorally equivalent", () => {
  const lib = new MemoryProgramLibrary();
  const multiply = {
    id:"double.mul",inputs:[T.int],output:T.int,
    body:{kind:"call",capabilityId:"core.mul_int",type:T.int,args:[{kind:"input",index:0,type:T.int},{kind:"const",value:2,type:T.int}]}
  };
  const add = {
    id:"double.add",inputs:[T.int],output:T.int,
    body:{kind:"call",capabilityId:"core.add_int",type:T.int,args:[{kind:"input",index:0,type:T.int},{kind:"input",index:0,type:T.int}]}
  };
  lib.put(multiply);
  const stored = lib.put(add);
  assert.equal(stored.id,"double.add");
  assert.equal(lib.all().length,2);
  for (const x of [-3,0,4,11]) {
    assert.equal(runProgram(multiply,[x],caps,lib),runProgram(add,[x],caps,lib));
  }
});
