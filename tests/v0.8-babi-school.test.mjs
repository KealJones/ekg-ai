import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryGraphStore,MemoryProgramLibrary,babyCapabilities,TeacherSchool,WorldLanguageEngine,
  starterLocationGrammar,babyBenchBabi20,evaluateDevelopmentalProbes
} from '../dist/index.js';

const agentFor=graph=>async probe=>{
  const engine=new WorldLanguageEngine(graph);
  const r=engine.runStory(probe.story,probe.question);
  return {answer:r.answer,abstained:r.abstained,evidence:r.understood.filter(x=>x.understood).map(x=>x.ruleId)};
};

test('bAbI single-fact location is red before language education',async()=>{
  const graph=new MemoryGraphStore();
  const [r]=await evaluateDevelopmentalProbes(agentFor(graph),[babyBenchBabi20[0]]);
  assert.equal(r.passed,false); assert.equal(r.abstained,true);
});

test('Teacher grammar becomes durable graph knowledge and turns bAbI #1 green',async()=>{
  const graph=new MemoryGraphStore(), school=new TeacherSchool(graph,babyCapabilities(),new MemoryProgramLibrary());
  for(const rule of starterLocationGrammar()) assert.equal(school.teachGrammar(rule).accepted,true);
  assert.equal(graph.entitiesByKind('grammar_rule').length,3);
  const [r]=await evaluateDevelopmentalProbes(agentFor(graph),[babyBenchBabi20[0]]);
  assert.equal(r.passed,true); assert.equal(r.answer,'kitchen');
});

test('learning location grammar does not pretend possession-chain reasoning was learned',async()=>{
  const graph=new MemoryGraphStore(), school=new TeacherSchool(graph,babyCapabilities(),new MemoryProgramLibrary());
  for(const rule of starterLocationGrammar()) school.teachGrammar(rule);
  const results=await evaluateDevelopmentalProbes(agentFor(graph),babyBenchBabi20.slice(0,3));
  assert.equal(results[0].passed,true);
  assert.equal(results[1].passed,false);
  assert.equal(results[2].passed,false);
});
