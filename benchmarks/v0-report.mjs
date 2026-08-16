import {
  defaultCapabilities, MemoryProgramLibrary, MemoryEpisodeStore, LearnerController,
  MemorizeBaseline, frozenV0Suite, evaluateTask, summarizeProgramUsage, mineRepeatedSubexpressions
} from "../dist/index.js";

const caps=defaultCapabilities();
const lib=new MemoryProgramLibrary();
const episodes=new MemoryEpisodeStore();
const learner=new LearnerController(caps,lib,episodes);
const memorize=new MemorizeBaseline();

const rows=[];
for(const task of frozenV0Suite.train){
  const result=learner.solve(task,3);
  if(result.program&&result.success) memorize.remember(task,result.program);
  rows.push({split:"train",task:task.id,decision:result.decision,success:result.success,candidates:result.searchCandidatesExplored});
}
let memorizeSolved=0;
for(const task of frozenV0Suite.test){
  const recalled=memorize.recall(task);
  if(recalled&&evaluateTask(recalled,task,caps,lib).passed) memorizeSolved++;
  const result=learner.solve(task,3);
  rows.push({split:"test",task:task.id,decision:result.decision,success:result.success,candidates:result.searchCandidatesExplored});
}

const programs=lib.all();
const report={
  suite:frozenV0Suite.version,
  generatedAt:new Date().toISOString(),
  rows,
  summary:{
    testSolved:rows.filter(r=>r.split==="test"&&r.success).length,
    testTotal:frozenV0Suite.test.length,
    memorizeSolved,
    testCandidates:rows.filter(r=>r.split==="test").reduce((n,r)=>n+r.candidates,0),
    programCount:programs.length,
    episodeCount:episodes.all().length,
  },
  usage:summarizeProgramUsage(programs,episodes.all()),
  abstractionCandidates:mineRepeatedSubexpressions(programs,2).slice(0,10).map(x=>({occurrences:x.occurrences,programIds:x.programIds,nodeCount:x.nodeCount,recurrenceScore:x.recurrenceScore,expression:x.expression})),
};
console.log(JSON.stringify(report,null,2));
