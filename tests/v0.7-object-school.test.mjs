import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryGraphStore,MemoryProgramLibrary,ekgCapabilities,TeacherSchool,twoLevelDotPathLesson,
  runObjectProgramMilestones,runProgram
} from '../dist/index.js';

test('OBJECT-PATH-001 is red before education and green after one validated reusable procedure lesson',()=>{
  const caps=ekgCapabilities(), graph=new MemoryGraphStore(), programs=new MemoryProgramLibrary();
  const before=runObjectProgramMilestones(caps,programs);
  assert.equal(before.find(x=>x.id==='OBJECT-PATH-001-dot-nested').passed,false);
  const learned=new TeacherSchool(graph,caps,programs).teachProgram(twoLevelDotPathLesson());
  assert.equal(learned.accepted,true);
  const after=runObjectProgramMilestones(caps,programs);
  const milestone=after.find(x=>x.id==='OBJECT-PATH-001-dot-nested');
  assert.equal(milestone.passed,true);
  assert.equal(milestone.source,'learned-program');
  assert.equal(runProgram(milestone.program,[{foo:{bar:'baz'}},'foo.bar'],caps,programs),'baz');
  assert.equal(graph.getEntity('capability:learned:learned.object.dot-path.two-level').attrs.durable,true);
});

test('education does not fake arbitrary-depth understanding: variable-depth milestone remains red',()=>{
  const caps=ekgCapabilities(), graph=new MemoryGraphStore(), programs=new MemoryProgramLibrary();
  new TeacherSchool(graph,caps,programs).teachProgram(twoLevelDotPathLesson());
  const after=runObjectProgramMilestones(caps,programs);
  assert.equal(after.find(x=>x.id==='OBJECT-PATH-002-variable-depth').passed,false);
});
