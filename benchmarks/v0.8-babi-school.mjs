import {MemoryGraphStore,MemoryProgramLibrary,ekgCapabilities,TeacherSchool,WorldLanguageEngine,starterLocationGrammar,ekgBenchBabi20,evaluateDevelopmentalProbes} from '../dist/index.js';
const graph=new MemoryGraphStore();
const agent=async p=>{const r=new WorldLanguageEngine(graph).runStory(p.story,p.question);return {answer:r.answer,abstained:r.abstained}};
console.log('BEFORE',JSON.stringify(await evaluateDevelopmentalProbes(agent,ekgBenchBabi20.slice(0,3)),null,2));
const school=new TeacherSchool(graph,ekgCapabilities(),new MemoryProgramLibrary());
for(const rule of starterLocationGrammar()) school.teachGrammar(rule);
console.log('AFTER',JSON.stringify(await evaluateDevelopmentalProbes(agent,ekgBenchBabi20.slice(0,3)),null,2));
console.log('GRAMMAR',JSON.stringify(graph.entitiesByKind('grammar_rule'),null,2));
console.log('FACTS',JSON.stringify(graph.entitiesByKind('fact'),null,2));
