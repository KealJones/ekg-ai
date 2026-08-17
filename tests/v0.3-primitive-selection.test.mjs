import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryProgramLibrary, defaultCapabilities,
  V03_PRIMITIVE_CANDIDATES, auditPrimitiveCandidate, freezePrimitiveSelection
} from "../dist/index.js";

const caps=defaultCapabilities();

test("v0.3.3 freezes exactly three externally mappable absent primitives",()=>{
  const frozen=freezePrimitiveSelection(V03_PRIMITIVE_CANDIDATES,caps,new MemoryProgramLibrary());
  assert.equal(frozen.primitives.length,3);
  assert.ok(frozen.audits.every(x=>x.passed));
  assert.match(frozen.selectionHash,/^fnv1a64:/);
  assert.ok(frozen.primitives.every(x=>x.requiredNovelCompositions>=40));
});

test("primitive selection rejects an already-present capability",()=>{
  const candidate={...V03_PRIMITIVE_CANDIDATES[0],id:"core.gte_int",forbiddenCapabilityAliases:[]};
  const audit=auditPrimitiveCandidate(candidate,caps,new MemoryProgramLibrary());
  assert.equal(audit.passed,false);
  assert.ok(audit.capabilityMatches.includes("core.gte_int"));
});

test("primitive selection rejects task-family knowledge already durable",()=>{
  const library=new MemoryProgramLibrary();
  library.put({id:"learned.string-contains",inputs:[{kind:"string"},{kind:"string"}],output:{kind:"bool"},body:{kind:"const",value:false,type:{kind:"bool"}}});
  const audit=auditPrimitiveCandidate(V03_PRIMITIVE_CANDIDATES[1],caps,library);
  assert.equal(audit.passed,false);
  assert.ok(audit.programMatches.length>0);
});

test("primitive selection refuses fewer than three primitives",()=>{
  assert.throws(()=>freezePrimitiveSelection(V03_PRIMITIVE_CANDIDATES.slice(0,2),caps,new MemoryProgramLibrary()),/exactly 3/);
});

test("primitive selection refuses insufficient external-composition budget",()=>{
  const weak={...V03_PRIMITIVE_CANDIDATES[0],requiredNovelCompositions:12};
  assert.throws(()=>freezePrimitiveSelection([weak,...V03_PRIMITIVE_CANDIDATES.slice(1)],caps,new MemoryProgramLibrary()),/fewer than 40/);
});
