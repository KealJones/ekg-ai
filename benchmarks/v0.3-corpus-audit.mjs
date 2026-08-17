import fs from "node:fs"; import {parseNl2BashPairs,discoverPrimitiveCandidates,auditCandidateSupply} from "../dist/index.js";
const [nlPath,cmPath]=process.argv.slice(2); if(!nlPath||!cmPath){console.error("usage: npm run benchmark:v0.3-corpus-audit -- <all.nl> <all.cm>");process.exit(2);}
const records=parseNl2BashPairs(fs.readFileSync(nlPath,"utf8"),fs.readFileSync(cmPath,"utf8")); const hits=discoverPrimitiveCandidates(records); const audit=auditCandidateSupply(hits);
console.log(JSON.stringify({status:"CANDIDATE_DISCOVERY_ONLY_NOT_SCORED_EVIDENCE",records:records.length,audit,sampleRecordIds:Object.fromEntries(Object.keys(audit).map(id=>[id,hits.filter(x=>x.primitiveId===id).slice(0,5).map(x=>`NL2Bash:all:${x.line}`)]))},null,2));
if(Object.values(audit).some(x=>!x.passesSupplyGate)) process.exitCode=1;
