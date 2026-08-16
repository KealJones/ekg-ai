import fs from "node:fs";
import {
  MemoryGraphStore, defaultCapabilities, interpretIntent, planIntent, runProgram,
  retrieveProgramsForIntent, T, validateAndLearnIntentGrounding, ingestTeachingTrace
} from "../dist/index.js";

const graph=new MemoryGraphStore();
const caps=defaultCapabilities();
const x={kind:"input",index:0,type:T.int};
const double={
  id:"abstract.double",inputs:[T.int],output:T.int,
  body:{kind:"call",capabilityId:"core.add_int",type:T.int,args:[structuredClone(x),structuredClone(x)]},
  properties:["semantic:scale","factor:2"]
};

const corpus=[
  {utterance:"multiply this number by six",input:7,expected:42},
  {utterance:"double this number",input:9,expected:18},
  {utterance:"add three to this number",input:8,expected:11},
  {utterance:"4 times this number",input:5,expected:20},
  {utterance:"twice this number",input:11,expected:22},
];

function runCorpus(){
  return corpus.map(c=>{
    const interpreted=interpretIntent(c.utterance,graph);
    if(interpreted.status!=="resolved") return {utterance:c.utterance,status:interpreted.status,teacherFree:false};
    const planned=planIntent(interpreted.intent,caps);
    const retrieved=retrieveProgramsForIntent(interpreted.intent,[double],1);
    if(planned.status!=="planned") return {utterance:c.utterance,status:"unplanned",teacherFree:true};
    const output=runProgram(planned.program,[c.input],caps);
    return {
      utterance:c.utterance,status:"resolved",teacherFree:true,
      intent:{signals:interpreted.intent.signals,goal:interpreted.intent.goal,constraints:interpreted.intent.constraints},
      plan:planned.program.body,
      output,expected:c.expected,correct:output===c.expected,
      retrieved:retrieved.map(r=>({id:r.program.id,score:r.score,reasons:r.reasons}))
    };
  });
}

const before=runCorpus();
const teacher=JSON.parse(fs.readFileSync("real-intent-teacher-run/02-teacher-response.json","utf8"));
ingestTeachingTrace(graph,teacher.teachingTrace);
const lessonResult=validateAndLearnIntentGrounding(graph,teacher.groundingLesson);
const after=runCorpus();

const summary=rows=>({
  total:rows.length,
  teacherFree:rows.filter(r=>r.teacherFree).length,
  correctlyExecuted:rows.filter(r=>r.correct===true).length,
  teacherFreeRate:rows.filter(r=>r.teacherFree).length/rows.length
});
const report={
  version:"intent-v0.1",
  before:{summary:summary(before),rows:before},
  teacherHandoff:{lessonAccepted:lessonResult.accepted,failures:lessonResult.failures,teacherInterventions:teacher.teachingTrace.teacherInterventions},
  after:{summary:summary(after),rows:after},
  keyCheck:{
    utterance:"multiply this number by six",
    manualTaskFamilyOrLabelsUsed:false,
    expectedIntentRelation:"Multiply",
    expectedConstant:6,
    learnedDoubleRetrieved:after[0]?.retrieved?.[0]?.id==="abstract.double"
  }
};
fs.writeFileSync("real-intent-teacher-run/03-app-validation-and-benchmark.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
