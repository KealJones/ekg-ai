import fs from 'node:fs';
import {phase0V05} from '../dist/index.js';
const bench=JSON.parse(fs.readFileSync(new URL('../bench-v1/bench_v05.json',import.meta.url),'utf8'));
const report=phase0V05(bench);
fs.writeFileSync(new URL('./v0.5-phase0-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.status!=='READY_TO_FREEZE') process.exitCode=2;
