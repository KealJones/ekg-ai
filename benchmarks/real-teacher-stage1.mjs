
import {
  MemoryGraphStore, retrievePrograms, chooseActivation, T
} from "../dist/index.js";
import fs from "node:fs";

const graph=new MemoryGraphStore();
const x={kind:"input",index:0,type:T.int};
const double={
  id:"abstract.double",inputs:[T.int],output:T.int,
  body:{kind:"call",capabilityId:"core.add_int",type:T.int,args:[structuredClone(x),structuredClone(x)]},
  properties:["scaling"],provenance:["family:multiply-family"]
};

const task={
  id:"real-teacher.activation.unknown-cost",
  family:"multiply-family",
  labels:["scaling"],
  inputs:[T.int],output:T.int,
  examples:[{inputs:[2],output:12},{inputs:[3],output:18},{inputs:[7],output:42}]
};

const retrieved=retrievePrograms(task,[double],{limit:1});
const activation=chooseActivation({
  primitiveDepthHint:0, // unknown at decision time in this fixture
  retrievedScore:retrieved[0]?.score??0,
  librarySize:1,
  retrievedCount:retrieved.length,
});

const request={
  system_contract:"Use the repository TeacherAdapter system contract.",
  context:{
    rawGoal:"Decide whether to activate the retrieved abstract.double procedure before paying for both search arms.",
    taskId:task.id,
    observation:`The learner retrieved ${retrieved[0]?.program.id} with score ${retrieved[0]?.score}, but has no historical utility observations and no reliable primitive search-depth estimate. The current online activation policy abstains because it lacks evidence.`,
    impasse:"How can the learner decide whether to activate relevant learned knowledge when historical utility is absent and primitive search difficulty is not yet known, without simply running both complete search arms every time?",
    failedAttempts:[
      "Always activate relevant learned knowledge: previously increased search cost on easy tasks.",
      "Always use primitive search when history is absent: can miss large savings on harder tasks.",
      "Use primitiveDepthHint: currently supplied externally and unavailable before search in this fixture."
    ],
    knownStrategyIds:graph.entitiesByKind("question_strategy").map(x=>x.id)
  }
};

fs.mkdirSync("real-teacher-run",{recursive:true});
fs.writeFileSync("real-teacher-run/01-app-teacher-request.json",JSON.stringify(request,null,2));
console.log(JSON.stringify({retrieved:retrieved.map(x=>({id:x.program.id,score:x.score,reasons:x.reasons})),activation,request},null,2));
