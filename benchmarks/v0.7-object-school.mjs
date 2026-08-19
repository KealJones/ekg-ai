import {MemoryGraphStore,MemoryProgramLibrary,ekgCapabilities,TeacherSchool,twoLevelDotPathLesson,runObjectProgramMilestones} from '../dist/index.js';
const caps=ekgCapabilities(), graph=new MemoryGraphStore(), programs=new MemoryProgramLibrary();
const before=runObjectProgramMilestones(caps,programs);
const education=new TeacherSchool(graph,caps,programs).teachProgram(twoLevelDotPathLesson());
const after=runObjectProgramMilestones(caps,programs);
console.log(JSON.stringify({before:before.map(x=>({id:x.id,passed:x.passed,source:x.source})),education,after:after.map(x=>({id:x.id,passed:x.passed,source:x.source,programId:x.program?.id})),durableAbilities:graph.entitiesByKind('capability').filter(x=>x.attrs?.learned)},null,2));
