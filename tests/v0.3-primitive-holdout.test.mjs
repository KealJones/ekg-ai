import test from "node:test";
import assert from "node:assert/strict";
import { defaultCapabilities } from "../dist/runtime/capabilities.js";
import { MemoryProgramLibrary } from "../dist/program-library.js";
import { T } from "../dist/ir/types.js";
import { PrimitiveLessonLedger,auditCapabilityAbsent,gradeDenotations,measureDurablePrograms,teacherOffGuard } from "../dist/benchmarks/primitive-holdout.js";

test("v0.3 lesson ledger enforces one-shot teaching",()=>{
  const ledger=new PrimitiveLessonLedger();
  ledger.teach({id:"l1",capabilityId:"semantic.at_least_n",teacherInterventions:1,teacherTokens:42,provenance:["teacher:test"],payload:{relation:"at_least_n"}});
  assert.equal(ledger.teacherTokens(),42);
  assert.throws(()=>ledger.teach({id:"l2",capabilityId:"semantic.at_least_n",teacherInterventions:1,teacherTokens:2,provenance:[],payload:{}}),/already taught/);
  assert.throws(()=>ledger.teach({id:"bad",capabilityId:"x",teacherInterventions:2,teacherTokens:1,provenance:[],payload:{}}),/exactly one/);
});

test("v0.3 multi-fixture grading requires all three counterfactual fixtures",()=>{
  const ok=gradeDenotations([1,2,3].map(n=>({id:`f${n}`,expected:n*2,run:()=>n*2})));
  assert.equal(ok.correct,true);
  const wrong=gradeDenotations([{id:"a",expected:2,run:()=>2},{id:"b",expected:4,run:()=>999},{id:"c",expected:6,run:()=>6}]);
  assert.equal(wrong.correct,false); assert.equal(wrong.passed,2);
  assert.throws(()=>gradeDenotations([{id:"a",expected:1,run:()=>1}]),/at least 3/);
});

test("checkpoint-0 capability absence audit catches present and absent semantics",()=>{
  const caps=defaultCapabilities();
  assert.equal(auditCapabilityAbsent(caps,"semantic.at_least_n").absent,true);
  const present=auditCapabilityAbsent(caps,"core.mul_int");
  assert.equal(present.absent,false); assert.deepEqual(present.matches,["core.mul_int"]);
});

test("durable growth measurement detects canonical uniqueness and real growth",()=>{
  const lib=new MemoryProgramLibrary();
  const p={id:"p1",inputs:[T.int],output:T.int,body:{kind:"input",index:0,type:T.int}};
  lib.put(p); lib.put({...p,id:"duplicate"});
  const one=measureDurablePrograms(lib); assert.equal(one.programs,1); assert.equal(one.uniqueCanonicalPrograms,1);
  lib.put({id:"p2",inputs:[T.int],output:T.int,body:{kind:"call",capabilityId:"core.add_int",args:[{kind:"input",index:0,type:T.int},{kind:"const",value:1,type:T.int}],type:T.int}});
  const two=measureDurablePrograms(lib); assert.equal(two.programs,2); assert.ok(two.canonicalProgramBytes>one.canonicalProgramBytes); assert.ok(two.canonicalProgramNodes>one.canonicalProgramNodes);
});

test("Teacher-OFF guard fails closed on any attempted Teacher call",()=>{
  const guard=teacherOffGuard(); guard.assertOff(); assert.equal(guard.teacherCalls,0);
  assert.throws(()=>guard.recordCall(),/disabled/); assert.equal(guard.teacherCalls,1); assert.throws(()=>guard.assertOff(),/violation/);
});
