import test from "node:test";
import assert from "node:assert/strict";
import {
  T, defaultCapabilities, rankIntentCandidates, resolveRankedIntent,
  applyClarification, interpretIntent, interpretComposedIntent, planIntent, runProgram,
  MemoryGraphStore, storePhraseGrounding, recordPhraseGroundingOutcome, learnFromIntentCorrection,
  inferNumericGroundingFromExamples, learnNumericPhraseFromBehavior, buildIntentTeacherContext,
  LanguageController, LanguageSession
} from "../dist/index.js";

const numericIntent=(id,relation,confidence=.8,withConst=true)=>({
  id,rawUtterance:id,
  signals:[
    {id:"in",concept:"Number",type:T.int,binding:"input",inputIndex:0,provenance:["test"]},
    ...(withConst?[{id:"n",concept:"Number",type:T.int,value:2,provenance:["test"]}]:[])
  ],
  goal:{concept:"Number",type:T.int},
  constraints:[{relation,args:withConst?["in","n"]:["in"],provenance:["test"]}],
  confidence,provenance:["test"]
});

test("planner feasibility can outrank a lexically plausible but unsupported interpretation",()=>{
  const candidates=[numericIntent("unsupported","ImaginaryRelation",.99),numericIntent("multiply","Multiply",.7)];
  const ranked=rankIntentCandidates(candidates,defaultCapabilities());
  assert.equal(ranked[0].intent.id,"multiply");
  assert.equal(ranked[0].plannerFeasible,true);
});

test("ranked intent resolution asks clarification when multiple executable meanings remain close",()=>{
  const ranked=rankIntentCandidates([numericIntent("add","Add",.8),numericIntent("multiply","Multiply",.8)],defaultCapabilities());
  const result=resolveRankedIntent(ranked);
  assert.equal(result.status,"clarify");
});

test("clarification answer can select a relation and supply a missing numeric argument",()=>{
  const initial=interpretIntent("make this number bigger");
  assert.equal(initial.status,"clarify");
  const resolved=applyClarification(initial,"multiply by six");
  assert.equal(resolved.status,"resolved");
  assert.equal(resolved.intent.constraints[0].relation,"Multiply");
  assert.deepEqual(resolved.intent.signals.map(x=>x.value).filter(x=>x!==undefined),[6]);
});

test("clarification does not invent a candidate when answer matches none",()=>{
  const initial=interpretIntent("make this number bigger");
  assert.equal(initial.status,"clarify");
  const result=applyClarification(initial,"reverse it");
  assert.equal(result.status,"teacher");
});


test("explicit THEN language composes multiple grounded actions into one executable Intent",()=>{
  const r=interpretComposedIntent("add three then multiply by six");
  assert.equal(r.status,"resolved");
  assert.deepEqual(r.intent.constraints.map(c=>c.relation),["Add","Multiply"]);
  const plan=planIntent(r.intent,defaultCapabilities());
  assert.equal(plan.status,"planned");
  assert.equal(runProgram(plan.program,[2],defaultCapabilities()),30);
});

test("composed intent refuses to skip over an unknown middle action",()=>{
  const r=interpretComposedIntent("add three then florp by six");
  assert.equal(r.status,"teacher");
});


test("learned phrase can carry an implied numeric value, not only a relation",()=>{
  const graph=new MemoryGraphStore();
  storePhraseGrounding(graph,{phrase:"sixfold",relation:"Multiply",impliedValue:6,confidence:.95,provenance:["test"]});
  const r=interpretIntent("make this number sixfold",graph);
  assert.equal(r.status,"resolved");
  assert.deepEqual(r.intent.signals.map(x=>x.value).filter(x=>x!==undefined),[6]);
  const plan=planIntent(r.intent,defaultCapabilities());
  assert.equal(runProgram(plan.program,[7],defaultCapabilities()),42);
});

test("phrase semantic grounding is graph-native via expresses relation",()=>{
  const graph=new MemoryGraphStore();
  storePhraseGrounding(graph,{phrase:"sixfold",relation:"Multiply",impliedValue:6,confidence:.9,provenance:["test"]});
  assert.equal(graph.outgoing("phrase:sixfold","expresses")[0].to,"relation:multiply");
});

test("validated user correction can teach a previously unknown phrase without Teacher",()=>{
  const graph=new MemoryGraphStore();
  assert.equal(interpretIntent("make it sixfold",graph).status,"teacher");
  const learned=learnFromIntentCorrection(graph,{
    id:"corr.sixfold",phrase:"sixfold",correctedRelation:"Multiply",impliedValue:6,
    utterance:"make it sixfold",expectedConstants:[6],provenance:["user-correction:test"]
  });
  assert.equal(learned.accepted,true);
  assert.equal(interpretIntent("make it sixfold",graph).status,"resolved");
});

test("execution evidence updates phrase grounding confidence rather than remaining static",()=>{
  const graph=new MemoryGraphStore();
  storePhraseGrounding(graph,{phrase:"sixfold",relation:"Multiply",impliedValue:6,confidence:.6,provenance:["test"]});
  const before=graph.getEntity("phrase:sixfold").attrs.confidence;
  recordPhraseGroundingOutcome(graph,"sixfold",true);
  recordPhraseGroundingOutcome(graph,"sixfold",true);
  const after=graph.getEntity("phrase:sixfold").attrs.confidence;
  assert.ok(after>before);
  recordPhraseGroundingOutcome(graph,"sixfold",false);
  assert.equal(graph.getEntity("phrase:sixfold").attrs.failures,1);
});

test("correction learning rejects unprovenanced mutation",()=>{
  const graph=new MemoryGraphStore();
  assert.throws(()=>learnFromIntentCorrection(graph,{
    id:"bad",phrase:"sixfold",correctedRelation:"Multiply",impliedValue:6,
    utterance:"make it sixfold",expectedConstants:[6],provenance:[]
  }),/provenance/);
});


test("behavioral examples can uniquely infer Multiply-by-six without Teacher semantics",()=>{
  const found=inferNumericGroundingFromExamples([{input:2,output:12},{input:3,output:18},{input:7,output:42}]);
  assert.deepEqual(found,[{relation:"Multiply",impliedValue:6}]);
});

test("behavioral grounding refuses ambiguous or patternless evidence",()=>{
  assert.equal(inferNumericGroundingFromExamples([{input:0,output:0},{input:1,output:1}]).length>1,true);
  assert.deepEqual(inferNumericGroundingFromExamples([{input:2,output:5},{input:3,output:9},{input:4,output:8}]),[]);
});

test("unknown phrase can become teacher-free from validated behavioral evidence",()=>{
  const graph=new MemoryGraphStore();
  assert.equal(interpretIntent("sixfold this number",graph).status,"teacher");
  const learned=learnNumericPhraseFromBehavior(graph,{
    phrase:"sixfold",examples:[{input:2,output:12},{input:3,output:18},{input:7,output:42}],provenance:["execution-suite:test"]
  });
  assert.equal(learned.accepted,true);
  const r=interpretIntent("sixfold this number",graph);
  assert.equal(r.status,"resolved");
  const plan=planIntent(r.intent,defaultCapabilities());
  assert.equal(runProgram(plan.program,[8],defaultCapabilities()),48);
});

test("behavioral phrase learner does not commit when evidence is ambiguous",()=>{
  const graph=new MemoryGraphStore();
  const result=learnNumericPhraseFromBehavior(graph,{
    phrase:"sameish",examples:[{input:0,output:0},{input:1,output:1}],provenance:["test"]
  });
  assert.equal(result.accepted,false);
  assert.equal(graph.getEntity("phrase:sameish"),undefined);
});

test("language impasse generator packages unknown grounding for Teacher automatically",()=>{
  const result=interpretIntent("florp this number by six");
  assert.equal(result.status,"teacher");
  const ctx=buildIntentTeacherContext("florp this number by six",result);
  assert.ok(ctx);
  assert.match(ctx.impasse,/no grounded action phrase/);
  assert.equal(ctx.rawGoal,"florp this number by six");
});

test("language controller executes known raw language and packages unknown language without manual task metadata",()=>{
  const graph=new MemoryGraphStore();
  const controller=new LanguageController(graph,defaultCapabilities());
  const known=controller.handle("multiply this number by six",[7]);
  assert.equal(known.status,"executed");
  assert.equal(known.output,42);
  const unknown=controller.handle("florp this number by six",[7]);
  assert.equal(unknown.status,"teacher");
  assert.equal(unknown.teacherInterventions,1);
});


test("repeated execution failures can suppress a learned phrase grounding",()=>{
  const graph=new MemoryGraphStore();
  storePhraseGrounding(graph,{phrase:"sixfold",relation:"Multiply",impliedValue:6,confidence:.5,provenance:["test"]});
  for(let i=0;i<5;i++) recordPhraseGroundingOutcome(graph,"sixfold",false);
  assert.ok(graph.getEntity("phrase:sixfold").attrs.confidence<.35);
  assert.equal(interpretIntent("sixfold this number",graph).status,"teacher");
});

test("conflicting semantic mapping cannot silently overwrite learned phrase knowledge",()=>{
  const graph=new MemoryGraphStore();
  storePhraseGrounding(graph,{phrase:"boost",relation:"Add",impliedValue:2,confidence:.8,provenance:["a"]});
  assert.throws(()=>storePhraseGrounding(graph,{phrase:"boost",relation:"Multiply",impliedValue:2,confidence:.9,provenance:["b"]}),/conflicting phrase grounding/);
  assert.equal(graph.getEntity("phrase:boost").attrs.relation,"Add");
});


test("stateful language session continues clarification into execution",()=>{
  const session=new LanguageSession(new MemoryGraphStore(),defaultCapabilities());
  const first=session.start("make this number bigger",[4]);
  assert.equal(first.status,"clarify");
  const second=session.answer("multiply by six",[4]);
  assert.equal(second.status,"executed");
  assert.equal(second.output,24);
});

test("stateful clarification can ask a second question when only relation was supplied",()=>{
  const session=new LanguageSession(new MemoryGraphStore(),defaultCapabilities());
  assert.equal(session.start("make this number bigger",[4]).status,"clarify");
  const second=session.answer("multiply",[4]);
  assert.equal(second.status,"clarify");
  assert.match(second.question,/factor/i);
  const third=session.answer("six",[4]);
  assert.equal(third.status,"executed");
  assert.equal(third.output,24);
});

test("irrelevant clarification answer escalates to Teacher rather than looping forever",()=>{
  const session=new LanguageSession(new MemoryGraphStore(),defaultCapabilities());
  assert.equal(session.start("make this number bigger",[4]).status,"clarify");
  const next=session.answer("reverse it",[4]);
  assert.equal(next.status,"teacher");
});
