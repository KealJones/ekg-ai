import fs from "node:fs";
import {
  MemoryGraphStore, validateAndLearnFileExtremePattern, interpretFileIntent, fileIntentToTask,
  defaultCapabilities, filesystemCapabilities, mergeCapabilities, MemoryProgramLibrary,
  MemoryEpisodeStore, LearnerController, runProgram, interpretComposedIntent, planIntent,
  canonicalizeSF, sfHash
} from "../dist/index.js";

const pilot=JSON.parse(fs.readFileSync("bench-v1/items/pilot-20.json","utf8"));

const worlds={
  f1:["a.txt","medium-name.md","this-is-the-longest-name.json"],
  f2:["tiny","somewhat-long.log","absurdly_lengthy_filename_for_test.bin"],
  f3:["one.js","two-two.ts","three-three-three.css"],
};
const numericInputs=[2,5,11];

const host={
  listFilenames(dir){return worlds[dir]??[];},
  basename(p){return String(p).split("/").at(-1)??"";}
};
const caps=mergeCapabilities(defaultCapabilities(),filesystemCapabilities(host));

function fileGold(kind,dir){
  const xs=worlds[dir];
  if(kind==="file-longest") return xs.reduce((b,x)=>x.length>b.length?x:b,xs[0]);
  return xs.reduce((b,x)=>x.length<b.length?x:b,xs[0]);
}
function numericGold(sf,x){
  const nodes=new Map(sf.nodes.map(n=>[n.id,n]));
  const evalNode=id=>{
    const n=nodes.get(id);
    if(n.op==="input") return x;
    if(n.op==="literal") return n.args.value;
    if(n.op==="add") return evalNode(n.args.left)+evalNode(n.args.right);
    if(n.op==="mul") return evalNode(n.args.left)*evalNode(n.args.right);
    throw new Error(`unsupported gold op ${n.op}`);
  };
  return evalNode(sf.root);
}
function sfDenotations(item){
  if(item.kind==="numeric") return numericInputs.map(x=>numericGold(item.sf,x));
  if(item.kind==="file-longest"||item.kind==="file-shortest") return Object.keys(worlds).map(d=>fileGold(item.kind,d));
  return [];
}

function tokenize(s){return new Set(s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(Boolean));}
function jaccard(a,b){
  const A=tokenize(a),B=tokenize(b); let inter=0;
  for(const x of A) if(B.has(x)) inter++;
  const union=new Set([...A,...B]).size;
  return union?inter/union:0;
}
function nearest(train,surface){
  return train.map(x=>({x,score:jaccard(x.surface,surface)})).sort((a,b)=>b.score-a.score)[0];
}

// Independent SF evaluator for cache/kNN baselines.
function evalSF(sf,item){
  if(!sf) return [];
  if(item.kind==="numeric") return numericInputs.map(x=>numericGold(sf,x));
  // Only file DAGs in this pilot.
  const root=sf.nodes.find(n=>n.id===sf.root);
  if(!root||!["argmax","argmin"].includes(root.op)) return [];
  return Object.keys(worlds).map(d=>{
    const xs=worlds[d];
    return root.op==="argmax"
      ? xs.reduce((b,x)=>x.length>b.length?x:b,xs[0])
      : xs.reduce((b,x)=>x.length<b.length?x:b,xs[0]);
  });
}

// Teacher/Curriculum phase.
const checkpoint0Graph=new MemoryGraphStore();
const checkpoint0Programs=[];
const graph=new MemoryGraphStore();
const lesson={
  id:"pilot.file-extreme.001",patternId:"file-extreme-filename",
  provenance:["teacher:gpt-5.6-sol:pilot"],
  validationExamples:[
    {utterance:"find the file with the longest filename in this folder",expectedRelation:"LongestFilename"},
    {utterance:"find the shortest file name in this directory",expectedRelation:"ShortestFilename"}
  ]
};
const lessonResult=validateAndLearnFileExtremePattern(graph,lesson);
if(!lessonResult.accepted) throw new Error("pilot pattern failed");

const programs=new MemoryProgramLibrary();
const episodes=new MemoryEpisodeStore();
const learner=new LearnerController(caps,programs,episodes);

for(const kind of ["file-longest","file-shortest"]){
  const trainItem=pilot.curriculum.find(x=>x.kind===kind);
  const interp=interpretFileIntent(trainItem.surface,graph);
  if(interp.status!=="resolved") throw new Error("training file intent unresolved");
  const examples=Object.keys(worlds).map(folder=>({folder,expectedFilename:fileGold(kind,folder)}));
  const task=fileIntentToTask(interp.intent,examples,`pilot.${kind}`);
  const solved=learner.solve(task,3);
  if(!solved.success) throw new Error(`failed training ${kind}`);
}

// freeze-ish snapshot: no Teacher and no LearnerController.solve in test.
const learnedPrograms=programs.all();
function systemEvaluate(item,graphOverride=graph,programOverride=learnedPrograms){
  if(item.kind==="ambiguous"){
    const r=interpretComposedIntent(item.surface,graphOverride);
    return {action:r.status==="clarify"?"CLARIFY":r.status==="teacher"?"ESCALATE":"ANSWER",denotations:[]};
  }
  if(item.kind==="unsupported"||item.kind==="unsupported-file"){
    const r=item.kind==="unsupported-file"?interpretFileIntent(item.surface,graphOverride):interpretComposedIntent(item.surface,graphOverride);
    return {action:r.status==="teacher"?"ESCALATE":r.status==="clarify"?"CLARIFY":"ANSWER",denotations:[]};
  }
  if(item.kind==="numeric"){
    const r=interpretComposedIntent(item.surface,graphOverride);
    if(r.status==="teacher") return {action:"ESCALATE",denotations:[]};
    if(r.status==="clarify") return {action:"CLARIFY",denotations:[]};
    const plan=planIntent(r.intent,caps);
    if(plan.status!=="planned") return {action:"ESCALATE",denotations:[]};
    return {action:"ANSWER",denotations:numericInputs.map(x=>runProgram(plan.program,[x],caps))};
  }
  const r=interpretFileIntent(item.surface,graphOverride);
  if(r.status!=="resolved") return {action:r.status==="teacher"?"ESCALATE":"CLARIFY",denotations:[]};
  const want=r.intent.constraints[0].relation==="LongestFilename"?"learned.pilot.file-longest":"learned.pilot.file-shortest";
  const p=programOverride.find(x=>x.id===want);
  if(!p) return {action:"ESCALATE",denotations:[]};
  return {action:"ANSWER",denotations:Object.keys(worlds).map(d=>runProgram(p,[d],caps,programs))};
}

function baselineEvaluate(item,mode){
  let match;
  if(mode==="exact") match=pilot.curriculum.find(x=>x.surface.toLowerCase()===item.surface.toLowerCase());
  else match=nearest(pilot.curriculum,item.surface)?.x;
  if(!match) return {action:"ESCALATE",denotations:[]};
  if(match.gold_action!=="ANSWER") return {action:match.gold_action,denotations:[]};
  return {action:"ANSWER",denotations:evalSF(match.sf,item)};
}

const costs={correct:0,clarifyCorrect:0,escalate:0.5,wrongAnswer:3,wrongAction:1};
function grade(item,result){
  const gold=item.gold_action;
  if(result.action===gold){
    if(gold!=="ANSWER") return {correct:true,cost:0};
    const expected=sfDenotations(item);
    const correct=JSON.stringify(expected)===JSON.stringify(result.denotations);
    return {correct,cost:correct?0:costs.wrongAnswer,expected,got:result.denotations};
  }
  if(result.action==="ESCALATE") return {correct:false,cost:costs.escalate};
  if(result.action==="ANSWER") return {correct:false,cost:costs.wrongAnswer};
  return {correct:false,cost:costs.wrongAction};
}
function runSystem(name,evaluator){
  const rows=pilot.test.map(item=>{
    const result=evaluator(item);
    return {id:item.id,surface:item.surface,goldAction:item.gold_action,result,...grade(item,result)};
  });
  const correct=rows.filter(x=>x.correct).length;
  return {
    name,rows,
    summary:{
      n:rows.length,correct,accuracy:correct/rows.length,
      meanCost:rows.reduce((s,x)=>s+x.cost,0)/rows.length,
      wrongAnswers:rows.filter(x=>x.result.action==="ANSWER"&&!x.correct).length,
      escalations:rows.filter(x=>x.result.action==="ESCALATE").length,
    }
  };
}

const checkpoint0=runSystem("ekg-checkpoint0-teacher-off",x=>systemEvaluate(x,checkpoint0Graph,checkpoint0Programs));
const full=runSystem("ekg-teacher-off",systemEvaluate);
const exact=runSystem("exact-cache",x=>baselineEvaluate(x,"exact"));
const knn=runSystem("token-jaccard-knn-cache",x=>baselineEvaluate(x,"knn"));

// Knockouts.
const emptyGraph=new MemoryGraphStore();
const noIntent=runSystem("knockout:file-intent-pattern",x=>systemEvaluate(x,emptyGraph,learnedPrograms));
const noPrograms=runSystem("knockout:learned-file-programs",x=>systemEvaluate(x,graph,[]));

const fileTests=pilot.test.filter(x=>x.kind==="file-longest"||x.kind==="file-shortest").map(x=>x.id);
const fullById=new Map(full.rows.map(x=>[x.id,x]));
function dependent(knockout){
  const k=new Map(knockout.rows.map(x=>[x.id,x]));
  return pilot.test.filter(x=>fullById.get(x.id)?.correct&&!k.get(x.id)?.correct).map(x=>x.id);
}
const intentDeps=dependent(noIntent), programDeps=dependent(noPrograms);

const learnedArtifactCount=1+learnedPrograms.length; // 1 pattern + learned procedures
const successfulAnswerTests=full.rows.filter(x=>x.correct&&x.goldAction==="ANSWER").length;
const structuralIds=new Set(["te.mul4add3.comp","te.add2double.comp"]);
const nearIds=new Set(pilot.test.filter(x=>(x.id.includes(".near"))).map(x=>x.id));
function accuracyFor(run,ids){
  const rows=run.rows.filter(x=>ids.has(x.id));
  return {n:rows.length,correct:rows.filter(x=>x.correct).length,accuracy:rows.length?rows.filter(x=>x.correct).length/rows.length:0};
}
const predictedFileSet=new Set(fileTests);
const observedIntentSet=new Set(intentDeps);
const tp=[...observedIntentSet].filter(x=>predictedFileSet.has(x)).length;
const precision=observedIntentSet.size?tp/observedIntentSet.size:0;
const recall=predictedFileSet.size?tp/predictedFileSet.size:0;

const report={
  version:"falsification-pilot-v0.2",
  note:"Pilot only; not publication-scale and gold was authored in this session, not independent-human adjudicated.",
  curriculum:{n:pilot.curriculum.length,teacherInterventions:1,learnedArtifacts:learnedArtifactCount,programs:learnedPrograms.map(x=>x.id)},
  systems:{checkpoint0:checkpoint0.summary,full:full.summary,exact:exact.summary,knn:knn.summary},
  learningCurve:{
    checkpoint0Accuracy:checkpoint0.summary.accuracy,
    checkpointAfterCurriculumAccuracy:full.summary.accuracy,
    delta:full.summary.accuracy-checkpoint0.summary.accuracy,
    teacherInterventionsDuringCurriculum:1,
    testTimeTeacherInterventions:0
  },
  stratified:{
    structuralComposition:{
      ekg:accuracyFor(full,structuralIds),
      knn:accuracyFor(knn,structuralIds)
    },
    lexicalNear:{
      ekg:accuracyFor(full,nearIds),
      knn:accuracyFor(knn,nearIds)
    }
  },
  compression:{
    successfulHeldoutAnswers:successfulAnswerTests,
    learnedArtifacts:learnedArtifactCount,
    successesPerLearnedArtifact:successfulAnswerTests/learnedArtifactCount,
  },
  knockout:{
    fileIntentPattern:{summary:noIntent.summary,dependentItems:intentDeps},
    learnedFilePrograms:{summary:noPrograms.summary,dependentItems:programDeps},
    attributionRate:intentDeps.length/pilot.test.length,
    fileAttributionRate:intentDeps.filter(x=>fileTests.includes(x)).length/fileTests.length,
    dependencySpecificity:{precision,recall},
    reuseDepth:{
      "intent-pattern:file-extreme-filename":intentDeps.length,
      "learned.pilot.file-longest":programDeps.filter(x=>x.includes("longest")).length,
      "learned.pilot.file-shortest":programDeps.filter(x=>x.includes("shortest")).length
    }
  },
  integrity:{
    teacherOff:true,
    testTimeTeacherCalls:0,
    testTimeLearningDisabled:true,
    multiFixtureDenotation:true,
    fixtureCountPerAnswer:3,
  },
  rows:{full:full.rows,knn:knn.rows}
};
fs.writeFileSync("bench-v1/results/falsification-pilot-v0.1.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
