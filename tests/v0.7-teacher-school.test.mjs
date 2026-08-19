import test from 'node:test';
import assert from 'node:assert/strict';
import {
  T,MemoryGraphStore,MemoryProgramLibrary,MemoryEpisodeStore,CapabilityRegistry,ekgCapabilities,
  seedPortableSubstrateKnowledge,TeacherSchool,callableAbilityCatalog,LearnerController,LanguageController
} from '../dist/index.js';

const call=(id,args,type)=>({kind:'call',capabilityId:id,args,type});
const input=(index,type)=>({kind:'input',index,type});
const absDiffProgram={
  id:'learned.abs-difference',name:'Absolute integer difference',inputs:[T.int,T.int],output:T.int,
  body:call('core.max_int',[
    call('core.sub_int',[input(0,T.int),input(1,T.int)],T.int),
    call('core.sub_int',[input(1,T.int),input(0,T.int)],T.int)
  ],T.int),provenance:['teacher:lesson-source']
};
const absDiffTask={id:'validate.abs-difference',inputs:[T.int,T.int],output:T.int,examples:[
  {inputs:[9,4],output:5},{inputs:[4,9],output:5},{inputs:[7,7],output:0},{inputs:[-3,5],output:8}
]};

test('validated Teacher program becomes durable capability identity, not a one-off answer',()=>{
  const graph=new MemoryGraphStore(), programs=new MemoryProgramLibrary(), caps=ekgCapabilities();
  seedPortableSubstrateKnowledge(graph,caps);
  const school=new TeacherSchool(graph,caps,programs);
  const r=school.teachProgram({id:'lesson.absdiff.001',conceptId:'math.absolute-difference',description:'distance between two integers regardless of order',program:absDiffProgram,validationTask:absDiffTask,phrases:['absolute difference'],provenance:['teacher:gpt-5.6-sol','curriculum:arithmetic']});
  assert.equal(r.accepted,true);
  assert.ok(programs.get('learned.abs-difference'));
  const ability=graph.getEntity('capability:learned:learned.abs-difference');
  assert.equal(ability.kind,'capability');
  assert.equal(ability.attrs.durable,true);
  assert.equal(ability.attrs.status,'active');
  assert.equal(graph.outgoing('program:learned.abs-difference','acquired_as_capability')[0].to,'capability:learned:learned.abs-difference');
  assert.ok(callableAbilityCatalog(caps,programs).some(a=>a.id==='learned.abs-difference'&&a.source==='learned-program'&&a.durable));
});

test('future synthesis can call an acquired learned capability as part of a new program',()=>{
  const full=ekgCapabilities(), caps=new CapabilityRegistry();
  for(const id of ['core.add_int','core.mul_int','core.max_int','core.sub_int','core.abs_int']) caps.register(full.get(id));
  const graph=new MemoryGraphStore(), programs=new MemoryProgramLibrary();
  const school=new TeacherSchool(graph,caps,programs);
  assert.equal(school.teachProgram({id:'lesson.absdiff.002',conceptId:'math.absolute-difference',description:'absolute difference',program:absDiffProgram,validationTask:absDiffTask,provenance:['teacher:test']}).accepted,true);
  const task={id:'compound.scale-absdiff',inputs:[T.int,T.int,T.int],output:T.int,examples:[
    {inputs:[9,4,3],output:15},{inputs:[4,9,2],output:10},{inputs:[8,8,7],output:0},{inputs:[12,2,4],output:40}
  ]};
  const learner=new LearnerController(caps,programs,new MemoryEpisodeStore());
  const r=learner.solve(task,2);
  assert.equal(r.success,true);
  assert.ok(r.program.provenance.some(x=>x==='calls:learned.abs-difference'));
});

test('Teacher program that fails its lesson fixtures is rejected and never becomes competence',()=>{
  const graph=new MemoryGraphStore(), programs=new MemoryProgramLibrary(), caps=ekgCapabilities();
  const bad={...absDiffProgram,id:'bad.absdiff',body:call('core.add_int',[input(0,T.int),input(1,T.int)],T.int)};
  const r=new TeacherSchool(graph,caps,programs).teachProgram({id:'lesson.bad',conceptId:'math.absolute-difference',description:'wrong proposal',program:bad,validationTask:absDiffTask,provenance:['teacher:test']});
  assert.equal(r.accepted,false);
  assert.equal(programs.get('bad.absdiff'),undefined);
  assert.equal(graph.getEntity('capability:learned:bad.absdiff'),undefined);
  assert.equal(graph.getEntity('education:lesson.bad').attrs.success,false);
});

test('Teacher impasse now includes actual capability catalog instead of inviting invented tools',()=>{
  const graph=new MemoryGraphStore(), caps=ekgCapabilities();
  const r=new LanguageController(graph,caps).handle('florp this number by six',[3]);
  assert.equal(r.status,'teacher');
  assert.ok(r.context.availableCapabilities.length>60);
  assert.ok(r.context.availableCapabilities.some(c=>c.id==='core.json_get'));
  assert.ok(r.context.availableCapabilities.some(c=>c.id==='host.bash'));
});

test('learned language can invoke an acquired one-input procedure through a program_call',()=>{
  const graph=new MemoryGraphStore(), programs=new MemoryProgramLibrary(), caps=ekgCapabilities();
  seedPortableSubstrateKnowledge(graph,caps);
  const input0=input(0,T.int);
  const squareProgram={
    id:'learned.square-int',name:'Square an integer',inputs:[T.int],output:T.int,
    body:call('core.mul_int',[input0,input0],T.int),provenance:['teacher:test']
  };
  const validationTask={id:'validate.square-int',inputs:[T.int],output:T.int,examples:[
    {inputs:[2],output:4},{inputs:[-3],output:9},{inputs:[0],output:0}
  ]};
  const before=new LanguageController(graph,caps,programs).handle('squareify this number',[5]);
  assert.equal(before.status,'teacher');
  const taught=new TeacherSchool(graph,caps,programs).teachProgram({
    id:'lesson.square-int',conceptId:'math.square-int',description:'multiply an integer by itself',
    program:squareProgram,validationTask,phrases:['squareify'],provenance:['teacher:test']
  });
  assert.equal(taught.accepted,true);
  const after=new LanguageController(graph,caps,programs).handle('squareify this number',[5]);
  assert.equal(after.status,'executed');
  assert.equal(after.output,25);
  assert.throws(()=>new LanguageController(graph,caps,programs).handle('squareify this number',['5']),/Expected int|must be int|type/i);
});
