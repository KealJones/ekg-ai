import {
  MemoryGraphStore,MemoryProgramLibrary,ekgCapabilities,TeacherSchool,WorldLanguageEngine,
  starterLocationGrammar,starterPossessionGrammar,possessionLocationInference,ekgBenchBabi20,evaluateDevelopmentalProbes
} from '../dist/index.js';
const makeSchool=graph=>new TeacherSchool(graph,ekgCapabilities(),new MemoryProgramLibrary());
const teachLocation=(school)=>{school.teachPredicate({id:'located_in',functionalObject:true,description:'current location',provenance:['teacher:gpt-5.6-sol']});for(const r of starterLocationGrammar())school.teachGrammar(r)};
const teachPossession=(school)=>{school.teachPredicate({id:'possesses',functionalObject:false,description:'possession relation',provenance:['teacher:gpt-5.6-sol']});for(const r of starterPossessionGrammar())school.teachGrammar(r);school.teachInference(possessionLocationInference())};
const run=async taught=>{const results=[];for(const probe of ekgBenchBabi20.slice(0,3)){const g=new MemoryGraphStore(),s=makeSchool(g);teachLocation(s);if(taught)teachPossession(s);const r=new WorldLanguageEngine(g).runStory(probe.story,probe.question);results.push({id:probe.id,passed:JSON.stringify(r.answer)===JSON.stringify(probe.expected),answer:r.answer??null,expected:probe.expected})}return results};
console.log(JSON.stringify({afterLocationSchool:await run(false),afterPossessionSchool:await run(true)},null,2));
