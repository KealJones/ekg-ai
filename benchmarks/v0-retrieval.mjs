import {
  T, defaultCapabilities, synthesizeDetailed, MemoryProgramLibrary, retrievePrograms
} from "../dist/index.js";

const caps=defaultCapabilities();
const x={kind:"input",index:0,type:T.int};
const clone=v=>structuredClone(v);
const doubleExpr={kind:"call",capabilityId:"core.add_int",type:T.int,args:[clone(x),clone(x)]};
const double={
  id:"abstract.double",inputs:[T.int],output:T.int,body:doubleExpr,
  properties:["scaling","multiply-family"],provenance:["family:multiply-family"]
};

const distractors=[];
for(let i=0;i<12;i++){
  // Distinct IDs and metadata; semantically harmless/noisy compatible programs.
  const cap="core.max_int";
  distractors.push({
    id:`distractor.${String(i).padStart(3,"0")}`,
    inputs:[T.int],output:T.int,
    body:{kind:"call",capabilityId:cap,type:T.int,args:[clone(x),clone(x)]},
    properties:[`noise-${i}`],
    provenance:["family:noise"]
  });
}
const library=[...distractors,double];
const task={
  id:"retrieval.heldout.triple",family:"multiply-family",labels:["scaling"],
  inputs:[T.int],output:T.int,
  examples:[{inputs:[2],output:6},{inputs:[3],output:9},{inputs:[7],output:21}]
};

const makeLib=programs=>{const lib=new MemoryProgramLibrary(); for(const p of programs) lib.put(p); return lib;};
const run=(programs,priority)=>{
  const lib=makeLib(programs);
  return synthesizeDetailed(task,caps,{maxDepth:2,programs:lib,callablePrograms:programs,programCallPriority:priority});
};

const primitive=run([],"after-capabilities");
const wholeLibrary=run(library,"before-capabilities");
const retrieved=retrievePrograms(task,library,{limit:1});
const retrievedPrograms=retrieved.map(x=>x.program);
const filtered=run(retrievedPrograms,"before-capabilities");

const report={
  version:"retrieval-v0.1",
  librarySize:library.length,
  retrieved:retrieved.map(x=>({id:x.program.id,score:x.score,reasons:x.reasons})),
  primitiveOnly:{solved:!!primitive.program,candidates:primitive.candidatesExplored},
  blindWholeLibrary:{solved:!!wholeLibrary.program,candidates:wholeLibrary.candidatesExplored},
  retrievedLearnedFirst:{solved:!!filtered.program,candidates:filtered.candidatesExplored},
};
console.log(JSON.stringify(report,null,2));
