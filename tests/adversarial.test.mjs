import test from 'node:test';
import assert from 'node:assert/strict';
import {
  T, defaultCapabilities, runProgram, synthesize, evaluateTask,
  MemoryGraphStore, MemoryProgramLibrary, MemoryEpisodeStore,
  LearnerController, mineRepeatedSubexpressions, synthesizeDetailed
} from '../dist/index.js';

const caps = defaultCapabilities();

// IR / execution layer -------------------------------------------------------
test('runtime rejects wrong input arity', () => {
  const p={id:'p.id',inputs:[T.int],output:T.int,body:{kind:'input',index:0,type:T.int}};
  assert.throws(()=>runProgram(p,[],caps),/Input arity mismatch/);
  assert.throws(()=>runProgram(p,[1,2],caps),/Input arity mismatch/);
});

test('runtime rejects wrong input value type instead of coercing it', () => {
  const p={id:'p.double',inputs:[T.int],output:T.int,body:{kind:'call',capabilityId:'core.add_int',type:T.int,args:[{kind:'input',index:0,type:T.int},{kind:'input',index:0,type:T.int}]}};
  assert.throws(()=>runProgram(p,['4'],caps),/Input 0 type mismatch/);
});

test('runtime rejects malformed capability arity and declared types', () => {
  const wrongArity={id:'p.bad-arity',inputs:[T.int],output:T.int,body:{kind:'call',capabilityId:'core.add_int',type:T.int,args:[{kind:'input',index:0,type:T.int}]}};
  assert.throws(()=>runProgram(wrongArity,[1],caps),/arity mismatch/);
  const wrongType={id:'p.bad-type',inputs:[T.int],output:T.string,body:{kind:'call',capabilityId:'core.add_int',type:T.string,args:[{kind:'input',index:0,type:T.int},{kind:'input',index:0,type:T.int}]}};
  assert.throws(()=>runProgram(wrongType,[1],caps),/declared output type mismatch/);
});

test('runtime rejects unknown capability and unknown learned program', () => {
  const unknownCap={id:'p.unknown-cap',inputs:[T.int],output:T.int,body:{kind:'call',capabilityId:'nope',type:T.int,args:[]}};
  assert.throws(()=>runProgram(unknownCap,[1],caps),/Unknown capability/);
  const unknownProgram={id:'p.unknown-program',inputs:[T.int],output:T.int,body:{kind:'program_call',programId:'missing',type:T.int,args:[{kind:'input',index:0,type:T.int}]}};
  assert.throws(()=>runProgram(unknownProgram,[1],caps,new MemoryProgramLibrary()),/Unknown learned program/);
});

// Task / synthesis layer -----------------------------------------------------
test('wrong program is explicitly evaluated as wrong', () => {
  const bad={id:'p.plus-one',inputs:[T.int],output:T.int,body:{kind:'call',capabilityId:'core.add_int',type:T.int,args:[{kind:'input',index:0,type:T.int},{kind:'const',value:1,type:T.int}]}};
  const task={id:'double',inputs:[T.int],output:T.int,examples:[{inputs:[2],output:4},{inputs:[5],output:10},{inputs:[9],output:18}]};
  const result=evaluateTask(bad,task,caps);
  assert.equal(result.passed,false);
  assert.ok(result.examplePasses < result.exampleCount);
});

test('synthesis does not invent a pattern when no program in the search language fits', () => {
  const task={id:'non-pattern',inputs:[T.int],output:T.int,examples:[{inputs:[1],output:7},{inputs:[2],output:-3},{inputs:[3],output:42},{inputs:[4],output:5}]};
  const p=synthesize(task,caps,2);
  assert.equal(p,undefined);
});

test('synthesis cannot satisfy contradictory examples', () => {
  const task={id:'contradiction',inputs:[T.int],output:T.int,examples:[{inputs:[2],output:4},{inputs:[2],output:5}]};
  assert.equal(synthesize(task,caps,3),undefined);
});

// Controller layer ----------------------------------------------------------
test('near-match known program must not RUN if it fails the grounded task', () => {
  const lib=new MemoryProgramLibrary();
  lib.put({id:'known.double',inputs:[T.int],output:T.int,body:{kind:'call',capabilityId:'core.mul_int',type:T.int,args:[{kind:'input',index:0,type:T.int},{kind:'const',value:2,type:T.int}]}});
  const controller=new LearnerController(caps,lib,new MemoryEpisodeStore());
  const r=controller.solve({id:'triple',inputs:[T.int],output:T.int,examples:[{inputs:[2],output:6},{inputs:[7],output:21}]},2);
  assert.notEqual(r.decision,'RUN');
  assert.equal(r.success,true);
});

test('unsupported goal stays TEACH instead of returning a type-compatible wrong program', () => {
  const lib=new MemoryProgramLibrary();
  lib.put({id:'known.identity-string',inputs:[T.string],output:T.string,body:{kind:'input',index:0,type:T.string}});
  const controller=new LearnerController(caps,lib,new MemoryEpisodeStore());
  const r=controller.solve({id:'reverse',inputs:[T.string],output:T.string,examples:[{inputs:['abc'],output:'cba'},{inputs:['rust'],output:'tsur'}]},2);
  assert.equal(r.decision,'TEACH');
  assert.equal(r.success,false);
});

// Graph layer ---------------------------------------------------------------
test('graph rejects dangling relations and invalid confidence', () => {
  const g=new MemoryGraphStore();
  g.putEntity({id:'a',kind:'concept'});
  assert.throws(()=>g.putRelation({id:'dangling',kind:'related',from:'a',to:'missing'}),/Dangling relation/);
  g.putEntity({id:'b',kind:'concept'});
  assert.throws(()=>g.putRelation({id:'bad-confidence',kind:'related',from:'a',to:'b',confidence:1.1}),/Invalid confidence/);
  assert.equal(g.outgoing('a').length,0);
});

test('graph kind filter does not leak unrelated edge kinds', () => {
  const g=new MemoryGraphStore();
  g.putEntity({id:'a',kind:'concept'}); g.putEntity({id:'b',kind:'concept'}); g.putEntity({id:'c',kind:'concept'});
  g.putRelation({id:'r1',kind:'similar_to',from:'a',to:'b'});
  g.putRelation({id:'r2',kind:'implemented_by',from:'a',to:'c'});
  assert.deepEqual(g.outgoing('a','similar_to').map(x=>x.id),['r1']);
});

// Abstraction layer ---------------------------------------------------------
test('abstraction miner does not hallucinate a repeated pattern across unrelated programs', () => {
  const programs=[
    {id:'p.add',inputs:[T.int,T.int],output:T.int,body:{kind:'call',capabilityId:'core.add_int',type:T.int,args:[{kind:'input',index:0,type:T.int},{kind:'input',index:1,type:T.int}]}},
    {id:'p.mul',inputs:[T.int,T.int],output:T.int,body:{kind:'call',capabilityId:'core.mul_int',type:T.int,args:[{kind:'input',index:0,type:T.int},{kind:'input',index:1,type:T.int}]}},
  ];
  assert.deepEqual(mineRepeatedSubexpressions(programs,2),[]);
});

test('abstraction miner requires recurrence across distinct programs, not repeated use inside one program', () => {
  const d={kind:'call',capabilityId:'core.add_int',type:T.int,args:[{kind:'input',index:0,type:T.int},{kind:'input',index:0,type:T.int}]};
  const one=[{id:'p.only',inputs:[T.int],output:T.int,body:{kind:'call',capabilityId:'core.mul_int',type:T.int,args:[structuredClone(d),structuredClone(d)]}}];
  assert.deepEqual(mineRepeatedSubexpressions(one,2),[]);
});


test("search must not blindly prioritize an irrelevant learned library", () => {
  const caps=defaultCapabilities();
  const x={kind:"input",index:0,type:T.int};
  const irrelevant={
    id:"irrelevant.selfmax",inputs:[T.int],output:T.int,
    body:{kind:"call",capabilityId:"core.max_int",type:T.int,args:[structuredClone(x),structuredClone(x)]}
  };
  const lib=new MemoryProgramLibrary(); lib.put(irrelevant);
  const task={id:"quad",inputs:[T.int],output:T.int,examples:[{inputs:[2],output:8},{inputs:[3],output:12}]};
  const normal=synthesizeDetailed(task,caps,{maxDepth:3,programs:lib,callablePrograms:[irrelevant],programCallPriority:"after-capabilities"});
  const blind=synthesizeDetailed(task,caps,{maxDepth:3,programs:lib,callablePrograms:[irrelevant],programCallPriority:"before-capabilities"});
  assert.ok(normal.program);
  assert.ok(blind.program);
  assert.ok(blind.candidatesExplored>normal.candidatesExplored);
});
