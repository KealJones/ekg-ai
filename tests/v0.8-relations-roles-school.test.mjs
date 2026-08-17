import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryGraphStore,MemoryProgramLibrary,babyCapabilities,TeacherSchool,WorldLanguageEngine,
  starterSpatialPredicates,starterSpatialGrammar,starterGivingFrame,starterGivingGrammar,
  babyBenchBabi20,evaluateDevelopmentalProbes
} from '../dist/index.js';

const agent=graph=>async p=>{const r=new WorldLanguageEngine(graph).runStory(p.story,p.question);return {answer:r.answer,abstained:r.abstained}};
function school(graph){return new TeacherSchool(graph,babyCapabilities(),new MemoryProgramLibrary())}
function teachSpatial(s){for(const p of starterSpatialPredicates()) s.teachPredicate(p); for(const g of starterSpatialGrammar()) s.teachGrammar(g)}
function teachGiving(s){s.teachFrame(starterGivingFrame()); for(const g of starterGivingGrammar()) s.teachGrammar(g)}

test('bAbI #4/#5 are red before relation-role education',async()=>{
  const graph=new MemoryGraphStore();
  const r=await evaluateDevelopmentalProbes(agent(graph),babyBenchBabi20.slice(3,5));
  assert.deepEqual(r.map(x=>x.passed),[false,false]);
});

test('learned inverse relation semantics turn bAbI #4 green without hard-coding its answer',async()=>{
  const graph=new MemoryGraphStore(),s=school(graph); teachSpatial(s);
  const r=await evaluateDevelopmentalProbes(agent(graph),babyBenchBabi20.slice(3,5));
  assert.deepEqual(r.map(x=>x.passed),[true,false]);
  assert.equal(r[0].answer,'south');
  assert.equal(graph.getEntity('predicate:north_of').attrs.inverseOf,'south_of');
  assert.ok(graph.entitiesByKind('fact').some(f=>f.attrs?.predicate==='south_of'&&String(f.attrs?.provenance).includes('inverse-of:north_of')));
});

test('FrameNet-style learned event roles turn bAbI #5 green',async()=>{
  const graph=new MemoryGraphStore(),s=school(graph); teachGiving(s);
  const [r]=await evaluateDevelopmentalProbes(agent(graph),[babyBenchBabi20[4]]);
  assert.equal(r.passed,true); assert.equal(r.answer,'maya');
  const event=graph.entitiesByKind('event')[0];
  assert.equal(event.attrs.frameId,'Giving'); assert.deepEqual(event.attrs.roles,{agent:'liam',theme:'book',recipient:'maya'});
  assert.equal(graph.getEntity('frame:giving').attrs.eventType,'give');
});
