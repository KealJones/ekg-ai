import test from "node:test";
import assert from "node:assert/strict";
import {
  T,defaultCapabilities,calibrateDMax,expressionDepth,MemoryProgramLibrary,MemoryEpisodeStore,LearnerController,solveInstrumented
} from "../dist/index.js";

test("v0.4 Phase 0 empirically reaches depth 3 but not depth 4 under the normal budget",()=>{
  const r=calibrateDMax(defaultCapabilities(),3,2);
  assert.equal(r.measuredDMax,3);
  assert.equal(r.depth4GuardSolved,false);
  assert.deepEqual(r.rows.slice(0,3).map(x=>x.solvedRuns),[2,2,2]);
  assert.equal(r.rows[3].solvedRuns,0);
});

test("v0.4 Phase 0 records the actual constant-pool mismatch instead of changing BUILD",()=>{
  const r=calibrateDMax(defaultCapabilities(),3,1);
  assert.equal(r.automaticIntegerConstants,false);
});

test("expression depth matches synthesizer call nesting",()=>{
  const e={kind:"call",capabilityId:"core.add_int",type:T.int,args:[
    {kind:"input",index:0,type:T.int},
    {kind:"call",capabilityId:"core.add_int",type:T.int,args:[{kind:"input",index:0,type:T.int},{kind:"input",index:0,type:T.int}]}
  ]};
  assert.equal(expressionDepth(e),2);
});

test("Phase 0 instrumentation captures controller action, library delta, call graph surface, search and zero Teacher calls",()=>{
  const caps=defaultCapabilities(),lib=new MemoryProgramLibrary(),episodes=new MemoryEpisodeStore();
  const controller=new LearnerController(caps,lib,episodes);
  const r=solveInstrumented({controller,library:lib,episodes,task:{id:"phase0.test.double",inputs:[T.int],output:T.int,examples:[{inputs:[2],output:4},{inputs:[5],output:10}]},maxDepth:3});
  assert.equal(r.decision,"BUILD");
  assert.equal(r.success,true);
  assert.equal(r.teacherCalls,0);
  assert.equal(r.libraryBefore.programIds.length,0);
  assert.equal(r.libraryAfter.programIds.length,1);
  assert.deepEqual(r.addedProgramIds,["learned.phase0.test.double"]);
  assert.ok(r.searchCandidatesExplored>0);
});
