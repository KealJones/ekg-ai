import fs from 'node:fs';
import {T,defaultCapabilities,synthesizeDetailed} from '../dist/index.js';
const task={id:'search-v2.depth4-guard',inputs:[T.int],output:T.int,examples:[-5,-2,-1,0,1,2,3,7].map(x=>({inputs:[x],output:16*x}))};
const caps=defaultCapabilities();
function run(strategy){const t=performance.now();const r=synthesizeDetailed(task,caps,{maxDepth:3,callablePrograms:[],strategy,budget:strategy==='v2'?{maxCandidates:100000,maxGeneratedExpressions:100000,maxWallMs:30000}:undefined});return{strategy,wallMs:+(performance.now()-t).toFixed(2),solved:!!r.program,candidatesExplored:r.candidatesExplored,generatedExpressions:r.generatedExpressions,behavioralPrunes:r.behavioralPrunes??0,memoHits:r.memoHits??0,memoMisses:r.memoMisses??0,stopReason:r.stopReason};}
const report={version:'0.9.1',task:'prove depth-4 16x is not reachable with depth<=3',legacy:run('legacy'),v2:run('v2')};
report.speedup=+(report.legacy.wallMs/report.v2.wallMs).toFixed(2);
fs.writeFileSync(new URL('./v0.9-search-v2-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
