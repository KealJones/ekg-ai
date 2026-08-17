import test from "node:test";
import assert from "node:assert/strict";
import { T, defaultCapabilities, CapabilityRegistry, MemoryProgramLibrary, synthesizeDetailed } from "../dist/index.js";

const scalar=(id,m)=>({id,inputs:[T.int],output:T.int,examples:[-5,-2,-1,0,1,2,3,7].map(x=>({inputs:[x],output:m*x}))});

test("Search v2 behaviorally collapses the old depth-3 explosion",()=>{
  const r=synthesizeDetailed(scalar("searchv2.16x",16),defaultCapabilities(),{maxDepth:3});
  assert.equal(r.strategy,"v2");
  assert.equal(r.program,undefined);
  assert.equal(r.stoppedByBudget,false);
  assert.ok(r.behavioralPrunes>500,`expected lots of value pruning, got ${r.behavioralPrunes}`);
  assert.ok(r.generatedExpressions<2000,`expected compact search, got ${r.generatedExpressions}`);
  assert.ok(r.candidatesExplored<500,`expected few scored candidates, got ${r.candidatesExplored}`);
});

test("Search v2 has real operational budgets instead of RAM as a stopping condition",()=>{
  const task={id:"searchv2.impossible",inputs:[T.int],output:T.int,examples:[{inputs:[1],output:999},{inputs:[2],output:998}]};
  const r=synthesizeDetailed(task,defaultCapabilities(),{maxDepth:5,budget:{maxGeneratedExpressions:40,maxCandidates:1000,maxWallMs:5000}});
  assert.equal(r.program,undefined);
  assert.equal(r.stoppedByBudget,true);
  assert.equal(r.stopReason,"max-generated-expressions");
  assert.ok(r.generatedExpressions<=40);
});

test("speculative search never executes effectful non-search-safe capabilities",()=>{
  const caps=defaultCapabilities(); let sideEffects=0;
  caps.register({id:"danger.do_thing",inputs:[T.int],output:T.int,pure:false,deterministic:false,searchSafe:false,reference:a=>{sideEffects++;return Number(a)+123},tsEmit:a=>a[0],rustEmit:a=>a[0]});
  const task={id:"searchv2.no-side-effects",inputs:[T.int],output:T.int,examples:[{inputs:[1],output:77},{inputs:[2],output:88}]};
  synthesizeDetailed(task,caps,{maxDepth:2});
  assert.equal(sideEffects,0);
});

function capsWithAddAlias(){
  const caps=defaultCapabilities();
  caps.register({id:"core.add_alias",inputs:[T.int,T.int],output:T.int,pure:true,deterministic:true,reference:(a,b)=>Number(a)+Number(b),tsEmit:a=>`(${a[0]} + ${a[1]})`,rustEmit:a=>`(${a[0]} + ${a[1]})`});
  return caps;
}

test("lived success history can guide which equivalent operation Search v2 keeps",()=>{
  const lib=new MemoryProgramLibrary();
  for(let i=0;i<12;i++) lib.recordExperience({subjectKind:"host-capability",subjectId:"core.add_alias",status:"success",inputs:[2,2],output:4,inputTypes:[T.int,T.int],outputType:T.int,callStack:[],timestamp:new Date(1000+i).toISOString()});
  const r=synthesizeDetailed(scalar("searchv2.history.double",2),capsWithAddAlias(),{maxDepth:1,programs:lib});
  assert.ok(r.program);
  assert.equal(r.program.body.kind,"call");
  assert.equal(r.program.body.capabilityId,"core.add_alias");
});

test("explicit semantic/retrieval weights can guide search without changing capability semantics",()=>{
  const r=synthesizeDetailed(scalar("searchv2.weight.double",2),capsWithAddAlias(),{maxDepth:1,operationWeights:{"core.add_alias":0.25,"core.add_int":1}});
  assert.ok(r.program);
  assert.equal(r.program.body.kind,"call");
  assert.equal(r.program.body.capabilityId,"core.add_alias");
});
