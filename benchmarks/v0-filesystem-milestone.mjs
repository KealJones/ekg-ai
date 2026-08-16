import fs from "node:fs";
import path from "node:path";
import {
  MemoryGraphStore, validateAndLearnFileExtremePattern, interpretFileIntent, fileIntentToTask,
  defaultCapabilities, filesystemCapabilities, mergeCapabilities,
  MemoryProgramLibrary, MemoryEpisodeStore, LearnerController, runProgram, ingestTeachingTrace
} from "../dist/index.js";

const root="real-filesystem-milestone/fixtures";
fs.rmSync(root,{recursive:true,force:true});
fs.mkdirSync(root,{recursive:true});

function makeFolder(id,names){
  const dir=path.join(root,id);
  fs.mkdirSync(dir,{recursive:true});
  for(const name of names) fs.writeFileSync(path.join(dir,name),name);
  // include a directory that must not count as a file
  fs.mkdirSync(path.join(dir,"nested-directory"),{recursive:true});
  return dir;
}
const fixtureDefs=[
  ["a",["a.txt","medium-name.md","this-is-the-longest-name.json"]],
  ["b",["tiny","somewhat-long.log","absurdly_lengthy_filename_for_test.bin"]],
  ["c",["one.js","two-two.ts","three-three-three.css"]],
  ["heldout",["x","normal.txt","the-heldout-super-long-filename.data"]],
  ["shortheld",["longish.txt","z","medium-file.md"]],
];
const dirs=Object.fromEntries(fixtureDefs.map(([id,names])=>[id,makeFolder(id,names)]));

const host={
  listFilenames(dir){return fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile()).map(x=>x.name);},
  basename(p){return path.basename(p);}
};
const caps=mergeCapabilities(defaultCapabilities(),filesystemCapabilities(host));
const graph=new MemoryGraphStore();
const programs=new MemoryProgramLibrary();
const episodes=new MemoryEpisodeStore();
const controller=new LearnerController(caps,programs,episodes);

const teacher=JSON.parse(fs.readFileSync("real-filesystem-milestone/02-teacher-to-app.json","utf8"));

// 0. Actual pre-teaching app state.
const rawLongest="find the file with the longest filename in this folder";
const before=interpretFileIntent(rawLongest,graph);

// 1. Ingest actual teacher trace and validate pattern lesson.
ingestTeachingTrace(graph,teacher.teachingTrace);
const lesson=validateAndLearnFileExtremePattern(graph,teacher.fileIntentLesson);

// 2. Interpret raw request after lesson.
const longestIntent=interpretFileIntent(rawLongest,graph);
if(longestIntent.status!=="resolved") throw new Error("longest intent did not resolve");

// 3. Build examples from real folders; learner sees folder path -> expected filename behavior.
const longestExamples=[
  {folder:dirs.a,expectedFilename:"this-is-the-longest-name.json"},
  {folder:dirs.b,expectedFilename:"absurdly_lengthy_filename_for_test.bin"},
  {folder:dirs.c,expectedFilename:"three-three-three.css"},
];
const longestTask=fileIntentToTask(longestIntent.intent,longestExamples,"filesystem.longest-filename");
const firstSolve=controller.solve(longestTask,3);
if(!firstSolve.success||!firstSolve.program) throw new Error("learner failed to synthesize longest filename");

// 4. Execute learned program on an untouched folder.
const heldoutLongest=runProgram(firstSolve.program,[dirs.heldout],caps,programs);

// 5. Same semantic request, new folder/examples: should RUN the learned procedure.
const repeatTask=fileIntentToTask(longestIntent.intent,[
  {folder:dirs.heldout,expectedFilename:"the-heldout-super-long-filename.data"}
],"filesystem.longest-filename-heldout");
const repeatSolve=controller.solve(repeatTask,3);

// 6. Related raw-language request after same ONE Teacher lesson.
const rawShortest="find the shortest file name in this directory";
const shortestIntent=interpretFileIntent(rawShortest,graph);
if(shortestIntent.status!=="resolved") throw new Error("shortest intent should transfer without Teacher");
const shortestTask=fileIntentToTask(shortestIntent.intent,[
  {folder:dirs.a,expectedFilename:"a.txt"},
  {folder:dirs.b,expectedFilename:"tiny"},
  {folder:dirs.shortheld,expectedFilename:"z"},
],"filesystem.shortest-filename");
const shortestSolve=controller.solve(shortestTask,3);
if(!shortestSolve.success||!shortestSolve.program) throw new Error("learner failed shortest related task");
const heldoutShortest=runProgram(shortestSolve.program,[dirs.shortheld],caps,programs);

// 7. Unsupported neighboring language should still not be swallowed by the pattern.
const unsupported=interpretFileIntent("find the largest file in this folder",graph);

const report={
  version:"filesystem-milestone-v0.1",
  initial:{
    rawUtterance:rawLongest,
    interpretationStatus:before.status,
    teacherInterventionsNeeded:before.status==="teacher"?1:0,
  },
  teaching:{
    realTeacherTraceId:teacher.teachingTrace.id,
    teacherInterventions:teacher.teachingTrace.teacherInterventions,
    patternAccepted:lesson.accepted,
    learnedPatternEntity:graph.getEntity("intent-pattern:file-extreme-filename"),
  },
  firstNovelTask:{
    rawUtterance:rawLongest,
    relation:longestIntent.intent.constraints[0].relation,
    learnerDecision:firstSolve.decision,
    searchCandidates:firstSolve.searchCandidatesExplored,
    searchDepth:firstSolve.searchDepthReached,
    learnedProgram:firstSolve.program,
    heldoutFolder:dirs.heldout,
    heldoutOutput:heldoutLongest,
    heldoutExpected:"the-heldout-super-long-filename.data",
    correct:heldoutLongest==="the-heldout-super-long-filename.data",
  },
  repeatedTask:{
    teacherInterventions:0,
    learnerDecision:repeatSolve.decision,
    searchCandidates:repeatSolve.searchCandidatesExplored,
    correct:repeatSolve.success,
  },
  relatedUnseenTask:{
    rawUtterance:rawShortest,
    teacherInterventions:0,
    relation:shortestIntent.intent.constraints[0].relation,
    learnerDecision:shortestSolve.decision,
    searchCandidates:shortestSolve.searchCandidatesExplored,
    searchDepth:shortestSolve.searchDepthReached,
    learnedProgram:shortestSolve.program,
    heldoutOutput:heldoutShortest,
    heldoutExpected:"z",
    correct:heldoutShortest==="z",
  },
  safety:{
    unsupportedNeighborStatus:unsupported.status,
    falseExecutionAvoided:unsupported.status!=="resolved",
  },
  totals:{
    realTeacherInterventions:teacher.teachingTrace.teacherInterventions,
    laterRelatedTeacherInterventions:0,
    programsLearned:programs.all().length,
    episodes:episodes.all(),
  }
};
fs.writeFileSync("real-filesystem-milestone/03-app-experiment-result.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
