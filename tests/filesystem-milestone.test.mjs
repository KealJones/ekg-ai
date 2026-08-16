import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryGraphStore, interpretFileIntent, validateAndLearnFileExtremePattern,
  fileIntentToTask, defaultCapabilities, filesystemCapabilities, mergeCapabilities,
  MemoryProgramLibrary, MemoryEpisodeStore, LearnerController, runProgram
} from "../dist/index.js";

const lesson={
  id:"file-extreme.001",patternId:"file-extreme-filename",provenance:["teacher:test"],
  validationExamples:[
    {utterance:"find the file with the longest filename in this folder",expectedRelation:"LongestFilename"},
    {utterance:"find the shortest file name in this directory",expectedRelation:"ShortestFilename"}
  ]
};

test("file intent is Teacher-required before the domain pattern is learned",()=>{
  const graph=new MemoryGraphStore();
  assert.equal(interpretFileIntent("find the file with the longest filename in this folder",graph).status,"teacher");
});

test("validated Teacher pattern grounds both longest and shortest variants",()=>{
  const graph=new MemoryGraphStore();
  assert.equal(validateAndLearnFileExtremePattern(graph,lesson).accepted,true);
  const longest=interpretFileIntent("find the file with the longest filename in this folder",graph);
  const shortest=interpretFileIntent("find the shortest file name in this directory",graph);
  assert.equal(longest.status,"resolved");
  assert.equal(shortest.status,"resolved");
  assert.equal(longest.intent.constraints[0].relation,"LongestFilename");
  assert.equal(shortest.intent.constraints[0].relation,"ShortestFilename");
});

test("file pattern does not overgeneralize to unsupported property request",()=>{
  const graph=new MemoryGraphStore();
  validateAndLearnFileExtremePattern(graph,lesson);
  const result=interpretFileIntent("find the largest file in this folder",graph);
  assert.equal(result.status,"teacher");
});

test("bad file intent lesson is rejected before graph mutation",()=>{
  const graph=new MemoryGraphStore();
  const bad={...lesson,validationExamples:[
    {utterance:"find the longest filename",expectedRelation:"LongestFilename"},
    {utterance:"find the shortest file name",expectedRelation:"ShortestFilename"}
  ]};
  const result=validateAndLearnFileExtremePattern(graph,bad);
  assert.equal(result.accepted,false);
  assert.equal(graph.entitiesByKind("concept").some(x=>x.labels?.includes("intent-pattern")),false);
});


test("end-to-end file milestone learns longest, RUNs it later, and ADAPTs to shortest without more teaching",()=>{
  const graph=new MemoryGraphStore();
  validateAndLearnFileExtremePattern(graph,lesson);
  const folders={
    a:["a.txt","medium.md","longest-filename-here.json"],
    b:["tiny","middle-name.log","another-very-long-filename.bin"],
    held:["x","normal.txt","heldout-long-filename.data"]
  };
  const host={
    listFilenames(dir){return folders[dir]??[];},
    basename(p){return String(p).split("/").at(-1)??"";}
  };
  const caps=mergeCapabilities(defaultCapabilities(),filesystemCapabilities(host));
  const programs=new MemoryProgramLibrary();
  const episodes=new MemoryEpisodeStore();
  const controller=new LearnerController(caps,programs,episodes);

  const li=interpretFileIntent("find the longest filename in this folder",graph);
  assert.equal(li.status,"resolved");
  const first=controller.solve(fileIntentToTask(li.intent,[
    {folder:"a",expectedFilename:"longest-filename-here.json"},
    {folder:"b",expectedFilename:"another-very-long-filename.bin"}
  ],"test.longest"),3);
  assert.equal(first.decision,"BUILD");
  assert.equal(runProgram(first.program,["held"],caps,programs),"heldout-long-filename.data");

  const repeat=controller.solve(fileIntentToTask(li.intent,[
    {folder:"held",expectedFilename:"heldout-long-filename.data"}
  ],"test.longest.held"),3);
  assert.equal(repeat.decision,"RUN");
  assert.equal(repeat.searchCandidatesExplored,0);

  const si=interpretFileIntent("find the shortest filename in this folder",graph);
  assert.equal(si.status,"resolved");
  const shortest=controller.solve(fileIntentToTask(si.intent,[
    {folder:"a",expectedFilename:"a.txt"},
    {folder:"b",expectedFilename:"tiny"},
    {folder:"held",expectedFilename:"x"}
  ],"test.shortest"),3);
  assert.equal(shortest.decision,"ADAPT");
  assert.match(shortest.program.provenance.join(" "),/adapted-from:learned\.test\.longest/);
});

test("filesystem learner does not RUN longest program for shortest examples",()=>{
  const graph=new MemoryGraphStore(); validateAndLearnFileExtremePattern(graph,lesson);
  const folders={a:["a","very-long-name"]};
  const caps=mergeCapabilities(defaultCapabilities(),filesystemCapabilities({
    listFilenames(dir){return folders[dir]??[];},basename(p){return String(p);}
  }));
  const programs=new MemoryProgramLibrary(); const episodes=new MemoryEpisodeStore();
  const controller=new LearnerController(caps,programs,episodes);
  const li=interpretFileIntent("find the longest filename in this folder",graph);
  controller.solve(fileIntentToTask(li.intent,[{folder:"a",expectedFilename:"very-long-name"}],"wrongness.long"),3);
  const si=interpretFileIntent("find the shortest filename in this folder",graph);
  const result=controller.solve(fileIntentToTask(si.intent,[{folder:"a",expectedFilename:"a"}],"wrongness.short"),3);
  assert.notEqual(result.decision,"RUN");
});
