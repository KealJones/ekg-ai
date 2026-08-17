import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryProgramLibrary, defaultCapabilities, freezeExternalBenchmark,
  V03_PRIMITIVE_CANDIDATES, freezePrimitiveSelection,
  freezePrimitiveExperimentProtocol, verifyPrimitiveExperimentProtocol,
  bindProtocolToBenchmark, runPrimitiveHoldoutExperiment, measureDurablePrograms
} from "../dist/index.js";

const selection=freezePrimitiveSelection(V03_PRIMITIVE_CANDIDATES,defaultCapabilities(),new MemoryProgramLibrary());
const protocol=freezePrimitiveExperimentProtocol(selection);

function item(id,primitiveId,familyId,n){return {
  id,primitiveId,familyId,utterance:`external smoke utterance ${n}`,
  source:{corpus:"independent-smoke-fixture",recordId:`r${n}`},provenance:[`external:smoke:r${n}`],expectedAction:"ANSWER",
  fixtures:[{id:"a",input:n},{id:"b",input:n+1},{id:"c",input:n+2}]
};}
const items=[
  item("i1",selection.primitives[0].id,"f1",1),
  item("i2",selection.primitives[1].id,"f2",10),
  item("i3",selection.primitives[2].id,"f3",20)
];
const reference={id:"independent-smoke-reference",version:"1",provenance:["independent:test-reference"],execute(_item,fixture){return fixture.input;}};
const benchmark=freezeExternalBenchmark(items,reference,"2026-08-16T00:00:00Z");
const manifest=bindProtocolToBenchmark(protocol,selection,benchmark,"smoke");

function condition(name,{wrong=false,teacher=false,confidence}={}){
  const library=new MemoryProgramLibrary();
  return {name,measureDurableState:()=>measureDurablePrograms(library),evaluate(itemId,_utterance,guard){
    if(teacher) guard.recordCall();
    const g=benchmark.gold.find(x=>x.itemId===itemId);
    return {action:"ANSWER",denotations:g.fixtures.map((x,i)=>wrong&&i===2?"WRONG":x.expected),searchNodes:2,confidence};
  }};
}

test("v0.3.4 protocol freeze is deterministic and Teacher-OFF",()=>{
  assert.equal(verifyPrimitiveExperimentProtocol(protocol),true);
  assert.equal(protocol.teacherOffAtTest,true);
  assert.deepEqual(protocol.requiredConditions,["ekg_post_lesson","lesson_withheld","checkpoint0_synthesis","selective_knn"]);
  assert.equal(protocol.requiredItemsPerPrimitive,40);
});

test("production binding refuses an underpowered benchmark",()=>{
  assert.throws(()=>bindProtocolToBenchmark(protocol,selection,benchmark,"production"),/fewer than 40/);
});

test("binding refuses a primitive that was not frozen in v0.3.3",()=>{
  const bad=structuredClone(items); bad[0].primitiveId="surprise.primitive";
  const b=freezeExternalBenchmark(bad,reference,"2026-08-16T00:00:00Z");
  assert.throws(()=>bindProtocolToBenchmark(protocol,selection,b,"smoke"),/unselected primitive/);
});

test("runner executes all frozen conditions and reports mutually interpretable metrics",()=>{
  const report=runPrimitiveHoldoutExperiment(protocol,manifest,benchmark,[
    condition("ekg_post_lesson",{confidence:.9}),
    condition("lesson_withheld",{wrong:true,confidence:.2}),
    condition("checkpoint0_synthesis",{wrong:true}),
    condition("selective_knn",{wrong:true,confidence:.4})
  ]);
  assert.equal(report.conditions.ekg_post_lesson.accuracy,1);
  assert.equal(report.conditions.lesson_withheld.accuracy,0);
  assert.equal(report.conditions.ekg_post_lesson.teacherCalls,0);
  assert.equal(report.conditions.ekg_post_lesson.confusion.correct_answer,3);
  assert.equal(report.conditions.lesson_withheld.confusion.wrong_answer_readonly,3);
  assert.ok(report.conditions.selective_knn.riskCoverage.length>=2);
  assert.equal(report.conditions.ekg_post_lesson.durableDelta.programs,0);
});

test("runner fails closed if any scored condition touches Teacher",()=>{
  assert.throws(()=>runPrimitiveHoldoutExperiment(protocol,manifest,benchmark,[
    condition("ekg_post_lesson",{teacher:true}),condition("lesson_withheld"),condition("checkpoint0_synthesis"),condition("selective_knn")
  ]),/Teacher endpoint is disabled/);
});

test("runner refuses missing/duplicated primary conditions",()=>{
  assert.throws(()=>runPrimitiveHoldoutExperiment(protocol,manifest,benchmark,[
    condition("ekg_post_lesson"),condition("lesson_withheld"),condition("checkpoint0_synthesis"),condition("checkpoint0_synthesis")
  ]),/exactly the four/);
});


test("FCER denominator includes only effectful answered items",()=>{
  const make=(name)=>{
    const library=new MemoryProgramLibrary();
    let index=0;
    return {name,measureDurableState:()=>measureDurablePrograms(library),evaluate(itemId){
      const g=benchmark.gold.find(x=>x.itemId===itemId); const effectful=index++===0;
      return {action:"ANSWER",denotations:g.fixtures.map((x,i)=>effectful&&i===0?"WRONG":x.expected),searchNodes:1,effectful};
    }};
  };
  const report=runPrimitiveHoldoutExperiment(protocol,manifest,benchmark,[make("ekg_post_lesson"),make("lesson_withheld"),make("checkpoint0_synthesis"),make("selective_knn")]);
  assert.equal(report.conditions.ekg_post_lesson.fcer,1);
  assert.equal(report.conditions.ekg_post_lesson.confusion.wrong_answer_effectful,1);
});
