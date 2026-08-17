import fs from "node:fs";
import crypto from "node:crypto";
import {
  defaultCapabilities, calibrateDMax, T, MemoryProgramLibrary, MemoryEpisodeStore,
  LearnerController, solveInstrumented
} from "../dist/index.js";

const caps=defaultCapabilities();
const calibration=calibrateDMax(caps,3,5);
const constantPoolAssumption={
  claudeAssumedConstants:[-2,-1,0,1,2,3],
  currentBuildAutomaticallyEnumeratesConstants:calibration.automaticIntegerConstants,
  compatible:calibration.automaticIntegerConstants,
  consequence:calibration.automaticIntegerConstants
    ? "Claude reachability model matches BUILD constant availability."
    : "BLOCK: Claude's reachability proof and generated constant-bearing items model a stronger search language than current BUILD. Do not run treatment until protocol is revised or substrate change is explicitly preregistered."
};

const lib=new MemoryProgramLibrary();
const episodes=new MemoryEpisodeStore();
const controller=new LearnerController(caps,lib,episodes);
const instrumentationProbe=solveInstrumented({
  controller,library:lib,episodes,
  task:{id:"phase0.instrumentation.double",inputs:[T.int],output:T.int,examples:[{inputs:[2],output:4},{inputs:[7],output:14}]},
  maxDepth:3,
});

const draftPath=new URL("../research/v0.4-independent-review/bench_v04_draft.json",import.meta.url);
const draft=JSON.parse(fs.readFileSync(draftPath,"utf8"));
const draftItems=Object.values(draft.items).flat();
const draftBenchmarkAudit={
  items:draftItems.length,
  itemsWithLiteralConstants:draftItems.filter(x=>(x.constants??[]).length>0).length,
  itemsRequiringUnmodeledStringSplit:draftItems.filter(x=>x.primitive==="span_string_len" && x.inputTypes?.length===1 && x.inputTypes[0]==="String").map(x=>x.itemId),
};
draftBenchmarkAudit.compatibleWithCurrentBuild = draftBenchmarkAudit.itemsWithLiteralConstants===0 && draftBenchmarkAudit.itemsRequiringUnmodeledStringSplit.length===0;

const capabilityList=caps.all().map(c=>({id:c.id,inputs:c.inputs,output:c.output,pure:c.pure,deterministic:c.deterministic}));
const freezePayload={
  phase:"v0.4-phase0",
  normalSearchMaxDepth:3,
  capabilityList,
  calibration,
  constantPoolAssumption,
  draftBenchmarkAudit,
};
const sha256=crypto.createHash("sha256").update(JSON.stringify(freezePayload)).digest("hex");
const status = calibration.measuredDMax>=4 || calibration.depth4GuardSolved
  ? "STOP_DMAX_INVALIDATES_DEPTH4_PRIMITIVES"
  : !constantPoolAssumption.compatible
    ? "BLOCKED_SPEC_ENGINE_CONSTANT_POOL_MISMATCH"
    : !draftBenchmarkAudit.compatibleWithCurrentBuild
      ? "BLOCKED_DRAFT_BENCHMARK_SUBSTRATE_MISMATCH"
      : "PHASE0_DEPTH_AND_SEARCH_LANGUAGE_GATES_PASS";
const report={status,freezeSha256:sha256,...freezePayload,instrumentationProbe};
const out=new URL("./v0.4-phase0-report.json",import.meta.url);
fs.writeFileSync(out,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
