import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryGraphStore,MemoryProgramLibrary,babyCapabilities,TeacherSchool,WorldLanguageEngine,
  starterLocationGrammar,starterPossessionGrammar,possessionLocationInference,babyBenchBabi20,evaluateDevelopmentalProbes
} from '../dist/index.js';

function teachLocation(school){
  school.teachPredicate({id:'located_in',functionalObject:true,description:'current location of an entity',provenance:['teacher:test']});
  for(const r of starterLocationGrammar()) school.teachGrammar(r);
}
function teachPossession(school){
  school.teachPredicate({id:'possesses',functionalObject:false,description:'holder possesses item',provenance:['teacher:test']});
  for(const r of starterPossessionGrammar()) school.teachGrammar(r);
  school.teachInference(possessionLocationInference());
}
const agent=graph=>async p=>{const r=new WorldLanguageEngine(graph).runStory(p.story,p.question);return {answer:r.answer,abstained:r.abstained}};

test('possession and location are taught as separate durable concepts/rules',()=>{
  const graph=new MemoryGraphStore(),school=new TeacherSchool(graph,babyCapabilities(),new MemoryProgramLibrary());
  teachLocation(school);teachPossession(school);
  assert.equal(graph.getEntity('predicate:located_in').attrs.functionalObject,true);
  assert.equal(graph.getEntity('predicate:possesses').attrs.functionalObject,false);
  assert.equal(graph.entitiesByKind('inference_rule').length,1);
});

test('general learned possession-location inference unlocks bAbI #2 and #3',async()=>{
  const graph=new MemoryGraphStore(),school=new TeacherSchool(graph,babyCapabilities(),new MemoryProgramLibrary());
  teachLocation(school);
  let r=await evaluateDevelopmentalProbes(agent(graph),babyBenchBabi20.slice(0,3));
  assert.deepEqual(r.map(x=>x.passed),[true,false,false]);
  teachPossession(school);
  // fresh graph with same taught long-term rules avoids story-to-story working-memory leakage
  const learned=graph.entitiesByKind('grammar_rule');
  const inference=graph.entitiesByKind('inference_rule');
  const predicates=graph.entitiesByKind('concept').filter(x=>x.labels?.includes('predicate'));
  const results=[];
  for(const probe of babyBenchBabi20.slice(0,3)){
    const g=new MemoryGraphStore();
    for(const p of predicates) g.putEntity(p);
    for(const gr of learned) g.putEntity(gr);
    for(const ir of inference) g.putEntity(ir);
    results.push((await evaluateDevelopmentalProbes(agent(g),[probe]))[0]);
  }
  assert.deepEqual(results.map(x=>x.passed),[true,true,true]);
});
