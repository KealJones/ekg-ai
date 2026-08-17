import test from "node:test";
import assert from "node:assert/strict";
import { auditExternalProvenance,deriveReferenceGold,freezeExternalBenchmark,verifyFrozenExternalBenchmark } from "../dist/benchmarks/external-items.js";

const items=[{
  id:"external.001", primitiveId:"semantic.at_least_n", familyId:"family.external.count", utterance:"Are at least this many entries present?",
  source:{corpus:"independent-fixture-corpus",recordId:"r-001"}, provenance:["external:independent-fixture-corpus:r-001"], expectedAction:"ANSWER",
  fixtures:[{id:"a",input:[1,["a"]]},{id:"b",input:[2,["a","b"]]},{id:"c",input:[3,["a"]]}]
}];
const reference={id:"reference.at-least-n",version:"1",provenance:["reference:test-code-not-learner"],execute(_item,fixture){const [n,xs]=fixture.input; return xs.length>=n;}};

test("external holdout gold is derived by executable reference semantics over >=3 fixtures",()=>{
  const gold=deriveReferenceGold(items,reference);
  assert.deepEqual(gold[0].fixtures.map(x=>x.expected),[true,true,false]);
  assert.equal(gold[0].referenceImplementationId,"reference.at-least-n");
});

test("frozen external benchmark is tamper evident",()=>{
  const frozen=freezeExternalBenchmark(items,reference,"2026-08-16T00:00:00Z");
  assert.equal(verifyFrozenExternalBenchmark(frozen),true);
  frozen.items[0].utterance="changed after freeze";
  assert.equal(verifyFrozenExternalBenchmark(frozen),false);
});

test("external item validation rejects underspecified fixture sets",()=>{
  const bad=structuredClone(items); bad[0].fixtures=bad[0].fixtures.slice(0,2);
  assert.throws(()=>deriveReferenceGold(bad,reference),/at least 3 fixtures/);
});

test("independence audit rejects EKG/Teacher-authored provenance",()=>{
  assert.equal(auditExternalProvenance(items).ok,true);
  const contaminated=structuredClone(items); contaminated[0].provenance=["Teacher authored this item"];
  const audit=auditExternalProvenance(contaminated);
  assert.equal(audit.ok,false); assert.match(audit.violations[0],/not independent/);
});
