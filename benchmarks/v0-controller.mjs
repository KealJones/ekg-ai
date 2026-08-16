import { T, defaultCapabilities, MemoryProgramLibrary, MemoryEpisodeStore, LearnerController } from "../dist/index.js";

const caps = defaultCapabilities();
const lib = new MemoryProgramLibrary();
const episodes = new MemoryEpisodeStore();
const controller = new LearnerController(caps, lib, episodes);

const tasks = [
  {id:"double",inputs:[T.int],output:T.int,examples:[{inputs:[2],output:4},{inputs:[7],output:14}]},
  {id:"double-repeat",inputs:[T.int],output:T.int,examples:[{inputs:[5],output:10},{inputs:[11],output:22}]},
  {id:"triple",inputs:[T.int],output:T.int,examples:[{inputs:[2],output:6},{inputs:[5],output:15}]},
  {id:"reverse-string",inputs:[T.string],output:T.string,examples:[{inputs:["abc"],output:"cba"}]},
];

for (const task of tasks) {
  const result = controller.solve(task, 2);
  console.log(JSON.stringify({
    task: task.id,
    decision: result.decision,
    success: result.success,
    program: result.program?.id,
    candidates: result.searchCandidatesExplored,
    depth: result.searchDepthReached,
  }));
}

console.log(JSON.stringify({episodes: episodes.all().length, programs: lib.all().map(p=>p.id)}));
