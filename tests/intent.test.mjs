import test from "node:test";
import assert from "node:assert/strict";
import {
  T, MemoryGraphStore, defaultCapabilities, interpretIntent, storePhraseGrounding,
  retrieveProgramsForIntent, planIntent, runProgram
} from "../dist/index.js";

test("raw language grounds into Viv-style signals goal and constraint without TaskSpec labels", () => {
  const result=interpretIntent("multiply this number by six");
  assert.equal(result.status,"resolved");
  assert.equal(result.intent.goal.concept,"Number");
  assert.equal(result.intent.constraints[0].relation,"Multiply");
  assert.deepEqual(result.intent.signals.map(x=>x.value).filter(x=>x!==undefined),[6]);
  assert.equal(result.intent.signals.filter(x=>x.binding==="input").length,1);
});

test("grounded intent compiles to portable executable plan", () => {
  const result=interpretIntent("multiply this number by six");
  assert.equal(result.status,"resolved");
  const plan=planIntent(result.intent,defaultCapabilities());
  assert.equal(plan.status,"planned");
  assert.equal(runProgram(plan.program,[7],defaultCapabilities()),42);
  assert.equal(plan.program.body.kind,"call");
  assert.equal(plan.program.body.capabilityId,"core.mul_int");
});

test("intent-native retrieval finds learned Double from semantic grounding, not hand-authored TaskSpec family labels", () => {
  const result=interpretIntent("multiply this number by six");
  assert.equal(result.status,"resolved");
  const x={kind:"input",index:0,type:T.int};
  const double={
    id:"abstract.double",inputs:[T.int],output:T.int,
    body:{kind:"call",capabilityId:"core.add_int",type:T.int,args:[structuredClone(x),structuredClone(x)]},
    properties:["semantic:scale","factor:2"]
  };
  const identity={id:"identity",inputs:[T.int],output:T.int,body:x,properties:["semantic:identity"]};
  const retrieved=retrieveProgramsForIntent(result.intent,[identity,double],1);
  assert.equal(retrieved[0].program.id,"abstract.double");
  assert.ok(retrieved[0].reasons.includes("semantic:scale"));
});

test("unknown action phrase falls back to Teacher instead of inventing intent", () => {
  const result=interpretIntent("florp this number by six");
  assert.equal(result.status,"teacher");
  assert.match(result.reason,/no grounded action phrase/);
});

test("ambiguous comparative language requests clarification instead of guessing", () => {
  const result=interpretIntent("make this number bigger");
  assert.equal(result.status,"clarify");
  assert.match(result.question,/add.*multiply/i);
  assert.ok(result.alternatives.length>=2);
});

test("known action missing required factor asks clarification", () => {
  const result=interpretIntent("multiply this number");
  assert.equal(result.status,"clarify");
  assert.match(result.question,/factor/i);
});

test("validated graph-learned phrase grounding can remove a later Teacher dependency", () => {
  const graph=new MemoryGraphStore();
  assert.equal(interpretIntent("twice this number",graph).status,"teacher");
  storePhraseGrounding(graph,{phrase:"twice",relation:"Multiply",confidence:.96,provenance:["teacher:validated-episode"]});
  const learned=interpretIntent("twice this number",graph);
  assert.equal(learned.status,"resolved");
  assert.equal(learned.intent.constraints[0].relation,"Multiply");
  assert.deepEqual(learned.intent.signals.map(x=>x.value).filter(x=>x!==undefined),[2]);
  const plan=planIntent(learned.intent,defaultCapabilities());
  assert.equal(runProgram(plan.program,[11],defaultCapabilities()),22);
});

test("intent retrieval hard-rejects type-incompatible popular-looking program", () => {
  const result=interpretIntent("multiply this number by six");
  assert.equal(result.status,"resolved");
  const wrong={id:"string.scale",inputs:[T.string],output:T.string,body:{kind:"input",index:0,type:T.string},properties:["semantic:scale"]};
  assert.equal(retrieveProgramsForIntent(result.intent,[wrong]).length,0);
});

test("learned phrase grounding rejects malformed confidence and provenance", () => {
  const graph=new MemoryGraphStore();
  assert.throws(()=>storePhraseGrounding(graph,{phrase:"twice",relation:"Multiply",confidence:2,provenance:["x"]}),/0..1/);
  assert.throws(()=>storePhraseGrounding(graph,{phrase:"twice",relation:"Multiply",confidence:.8,provenance:[]}),/provenance/);
});


import { validateAndLearnIntentGrounding } from "../dist/index.js";

test("teacher-proposed intent grounding is validated before entering durable graph", () => {
  const graph=new MemoryGraphStore();
  const proposal={
    id:"lesson.twice.001",phrase:"twice",relation:"Multiply",confidence:.96,
    validationExamples:[
      {utterance:"twice this number",relation:"Multiply",constants:[2]},
      {utterance:"make this number twice",relation:"Multiply",constants:[2]}
    ],
    provenance:["teacher:gpt-5.6-sol"]
  };
  const result=validateAndLearnIntentGrounding(graph,proposal);
  assert.equal(result.accepted,true);
  assert.equal(interpretIntent("twice this number",graph).status,"resolved");
});

test("wrong teacher intent grounding is rejected and does not poison durable interpretation", () => {
  const graph=new MemoryGraphStore();
  const bad={
    id:"lesson.twice.bad",phrase:"twice",relation:"Add",confidence:.99,
    validationExamples:[
      {utterance:"twice this number",relation:"Multiply",constants:[2]}
    ],
    provenance:["teacher:test"]
  };
  const result=validateAndLearnIntentGrounding(graph,bad);
  assert.equal(result.accepted,false);
  assert.equal(interpretIntent("twice this number",graph).status,"teacher");
});


test("phrase grounding uses boundaries and does not interpret substring accidents", () => {
  const result=interpretIntent("address this number by six");
  assert.equal(result.status,"teacher");
});

test("multiple conflicting grounded actions trigger clarification instead of arbitrary selection", () => {
  const result=interpretIntent("add three then multiply by six");
  assert.equal(result.status,"clarify");
  assert.match(result.question,/multiple requested actions/i);
});
