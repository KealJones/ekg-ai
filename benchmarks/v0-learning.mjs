import {
  defaultCapabilities, MemoryProgramLibrary, MemoryEpisodeStore, LearnerController,
  MemorizeBaseline, frozenV0Suite, evaluateTask
} from "../dist/index.js";

const caps = defaultCapabilities();
const lib = new MemoryProgramLibrary();
const episodes = new MemoryEpisodeStore();
const learner = new LearnerController(caps,lib,episodes);
const memorize = new MemorizeBaseline();

const trainRows=[];
for (const task of frozenV0Suite.train) {
  const r=learner.solve(task,3);
  if (r.program && r.success) memorize.remember(task,r.program);
  trainRows.push({task:task.id,decision:r.decision,success:r.success,candidates:r.searchCandidatesExplored,depth:r.searchDepthReached});
}

const testRows=[];
let learnerSolved=0, memorizeSolved=0, totalCandidates=0;
for (const task of frozenV0Suite.test) {
  const memorized=memorize.recall(task);
  const memorySuccess=memorized ? evaluateTask(memorized,task,caps).passed : false;
  if (memorySuccess) memorizeSolved++;

  const r=learner.solve(task,3);
  if (r.success) learnerSolved++;
  totalCandidates += r.searchCandidatesExplored;
  testRows.push({
    task:task.id,
    learner:r.decision,
    learnerSuccess:r.success,
    memorizeSuccess:memorySuccess,
    candidates:r.searchCandidatesExplored,
    depth:r.searchDepthReached,
    program:r.program?.id,
  });
}

console.log(JSON.stringify({suite:frozenV0Suite.version,train:trainRows,test:testRows,summary:{learnerSolved,total:frozenV0Suite.test.length,memorizeSolved,totalCandidates,programs:lib.all().length,episodes:episodes.all().length}},null,2));
