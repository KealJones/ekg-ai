import fs from "node:fs";
import {
  MemoryGraphStore, defaultCapabilities, LanguageController,
  learnNumericPhraseFromBehavior, interpretComposedIntent
} from "../dist/index.js";

const suite=JSON.parse(fs.readFileSync("benchmarks/language-curriculum-v0.1.json","utf8"));
const graph=new MemoryGraphStore();
const controller=new LanguageController(graph,defaultCapabilities());

function runPhase(phase){
  return suite.cases.map(c=>{
    const result=controller.handle(c.utterance,[c.input]);
    const expectedStatus=phase==="before"?c.expectedStatus:(c.afterStatus??c.expectedStatus);
    return {
      id:c.id,utterance:c.utterance,
      status:result.status,expectedStatus,
      statusCorrect:result.status===expectedStatus,
      output:result.status==="executed"?result.output:undefined,
      expectedOutput:c.expectedOutput,
      outputCorrect:result.status==="executed"&&c.expectedOutput!==undefined?result.output===c.expectedOutput:undefined,
      teacherRequired:result.status==="teacher",
    };
  });
}
function summarize(rows){
  const executable=rows.filter(r=>r.expectedOutput!==undefined && r.expectedStatus==="executed");
  return {
    total:rows.length,
    statusCorrect:rows.filter(r=>r.statusCorrect).length,
    teacherRequired:rows.filter(r=>r.teacherRequired).length,
    teacherFreeRate:(rows.length-rows.filter(r=>r.teacherRequired).length)/rows.length,
    executableCorrect:executable.filter(r=>r.outputCorrect).length,
    executableTotal:executable.length,
    falseExecutions:rows.filter(r=>r.status==="executed" && r.expectedStatus!=="executed").length
  };
}

const before=runPhase("before");

const lessons=[];
for(const c of suite.cases.filter(x=>x.behavior)){
  const learned=learnNumericPhraseFromBehavior(graph,{
    phrase:c.phrase,examples:c.behavior,provenance:[`benchmark:${suite.version}`,`case:${c.id}`]
  });
  lessons.push({case:c.id,...learned});
}

const after=runPhase("after");
const learnedEntities=graph.entitiesByKind("concept").filter(e=>e.labels?.includes("phrase"));
const learnedProvenance=learnedEntities.map(e=>({
  id:e.id,relation:e.attrs?.relation,impliedValue:e.attrs?.impliedValue,confidence:e.attrs?.confidence,
  provenance:e.attrs?.provenance
}));

// Separate planner-feedback sanity: a high-confidence unsupported candidate must lose
// to a lower-confidence executable candidate. Covered in test suite; report tracks it.
const report={
  suite:suite.version,
  before:{summary:summarize(before),rows:before},
  autonomousBehavioralLessons:lessons,
  after:{summary:summarize(after),rows:after},
  learnedPhraseKnowledge:learnedProvenance,
  displacement:{
    teacherRequiredBefore:summarize(before).teacherRequired,
    teacherRequiredAfter:summarize(after).teacherRequired,
    reduction:summarize(before).teacherRequired-summarize(after).teacherRequired
  }
};
fs.writeFileSync("benchmarks/latest-language-curriculum-report.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
