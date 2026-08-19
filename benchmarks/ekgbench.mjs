import fs from 'node:fs';
import {ekgCapabilities,ekgBenchBabi20,runObjectProgramMilestones} from '../dist/index.js';
const objectMilestones=runObjectProgramMilestones(ekgCapabilities());
const report={
  benchmark:'EKGBench',version:'0.1',
  philosophy:'Developmental probes are allowed to fail. A newly passing locked probe is a capability event, not a reason to rewrite history.',
  babi20:{count:ekgBenchBabi20.length,currentlyConnectedToQaAgent:false,probes:ekgBenchBabi20.map(x=>({id:x.id,family:x.family,skill:x.skill,status:'ASPIRATIONAL_NOT_YET_CONNECTED'}))},
  objectMilestones:objectMilestones.map(x=>({id:x.id,passed:x.passed,candidatesExplored:x.candidatesExplored,maxDepthReached:x.maxDepthReached,program:x.program?.body}))
};
fs.writeFileSync(new URL('./latest-ekgbench-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
