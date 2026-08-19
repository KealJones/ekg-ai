import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryGraphStore,MemoryProgramLibrary,ekgCapabilities,seedPortableSubstrateKnowledge,
  storeLexicalSense,contextualLexicalSensesForText,interpretIntent,TeacherSchool,LanguageController
} from '../dist/index.js';

function ambiguousBoost(graph){
  storeLexicalSense(graph,{form:'boost',senseId:'boost-add',relation:'Add',definition:'increase by an amount',confidence:.78,provenance:['teacher:test']});
  storeLexicalSense(graph,{form:'boost',senseId:'boost-mul',relation:'Multiply',definition:'scale by a factor',confidence:.78,provenance:['teacher:test']});
}

test('same lexical form can retain multiple senses until context is learned',()=>{
  const graph=new MemoryGraphStore(); ambiguousBoost(graph);
  assert.equal(interpretIntent('boost this number by six',graph).status,'clarify');
  const senses=contextualLexicalSensesForText(graph,'boost this number by six');
  assert.equal(senses.filter(x=>x.form==='boost').length,2);
});

test('Teacher can add durable context evidence without deleting either sense',()=>{
  const graph=new MemoryGraphStore(), caps=ekgCapabilities(), programs=new MemoryProgramLibrary();
  seedPortableSubstrateKnowledge(graph,caps); ambiguousBoost(graph);
  const school=new TeacherSchool(graph,caps,programs);
  assert.equal(school.teachContext('boost','Add',['amount'],['teacher:context-lesson'],'ScalarAddition').accepted,true);
  assert.equal(school.teachContext('boost','Multiply',['factor'],['teacher:context-lesson'],'Scaling').accepted,true);
  assert.equal(graph.entitiesByKind('sense').filter(x=>x.labels?.includes('word-sense')).length,2);
  assert.equal(graph.entitiesByKind('frame').length,2);
  assert.equal(graph.entitiesByKind('utility_evidence').length,2);
});

test('context changes the chosen meaning of the same word and execution follows the chosen sense',()=>{
  const graph=new MemoryGraphStore(), caps=ekgCapabilities(), programs=new MemoryProgramLibrary();
  seedPortableSubstrateKnowledge(graph,caps); ambiguousBoost(graph);
  const school=new TeacherSchool(graph,caps,programs);
  school.teachContext('boost','Add',['amount'],['teacher:test'],'ScalarAddition');
  school.teachContext('boost','Multiply',['factor'],['teacher:test'],'Scaling');
  const add=interpretIntent('boost this number by an amount of six',graph);
  const mul=interpretIntent('boost this number by a factor of six',graph);
  assert.equal(add.status,'resolved'); assert.equal(add.intent.constraints[0].relation,'Add');
  assert.equal(mul.status,'resolved'); assert.equal(mul.intent.constraints[0].relation,'Multiply');
  const controller=new LanguageController(graph,caps,programs);
  assert.equal(controller.handle('boost this number by an amount of six',[10]).output,16);
  assert.equal(controller.handle('boost this number by a factor of six',[10]).output,60);
});
