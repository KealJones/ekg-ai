import fs from 'node:fs';
import {ekgCapabilities,ekgBenchBabi20,runObjectProgramMilestones} from '../dist/index.js';

const green = s => `\x1b[32m${s}\x1b[0m`;
const red = s => `\x1b[31m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const dim = s => `\x1b[2m${s}\x1b[0m`;
const bold = s => `\x1b[1m${s}\x1b[0m`;
const cyan = s => `\x1b[36m${s}\x1b[0m`;

const objectMilestones = runObjectProgramMilestones(ekgCapabilities());

const report = {
  benchmark: 'EKGBench', version: '0.1',
  philosophy: 'Developmental probes are allowed to fail. A newly passing locked probe is a capability event, not a reason to rewrite history.',
  babi20: {count: ekgBenchBabi20.length, currentlyConnectedToQaAgent: false, probes: ekgBenchBabi20.map(x => ({id: x.id, family: x.family, skill: x.skill, status: 'ASPIRATIONAL_NOT_YET_CONNECTED'}))},
  objectMilestones: objectMilestones.map(x => ({id: x.id, passed: x.passed, candidatesExplored: x.candidatesExplored, maxDepthReached: x.maxDepthReached, program: x.program?.body}))
};
fs.writeFileSync(new URL('./latest-ekgbench-report.json', import.meta.url), JSON.stringify(report, null, 2));

// Pretty output
console.log();
console.log(bold('  EKGBench') + dim(' v0.1'));
console.log(dim('  Developmental probes are allowed to fail. Red is information, not failure.'));
console.log();

// bAbI 20
console.log(bold('  bAbI Prerequisite Families') + dim(` (${ekgBenchBabi20.length} probes)`));
console.log();
for (const probe of ekgBenchBabi20) {
  const icon = '  \u{1F6A7}';
  console.log(`${icon} ${dim(probe.id.padEnd(9))} ${probe.family.padEnd(28)} ${dim(probe.skill)}`);
}
console.log();
console.log(dim(`  Status: not yet connected to QA agent. These are curriculum targets.`));
console.log();

// Object milestones
console.log(bold('  Object Program Milestones'));
console.log();
for (const m of objectMilestones) {
  const icon = m.passed ? '  ✅' : '  ❌';
  const status = m.passed ? green('PASS') : red('RED');
  const search = m.passed
    ? dim(`${m.candidatesExplored} candidates, depth ${m.maxDepthReached}`)
    : dim(`${m.candidatesExplored} candidates explored`);
  const source = m.source === 'learned-program' ? cyan(' [learned]') : m.source === 'synthesized' ? dim(' [synthesized]') : '';
  console.log(`${icon} ${status} ${m.id.padEnd(35)} ${search}${source}`);
}
console.log();

// Summary
const passCount = objectMilestones.filter(m => m.passed).length;
const totalObj = objectMilestones.length;
const summaryColor = passCount === totalObj ? green : passCount > 0 ? yellow : red;
console.log(bold('  Summary'));
console.log(`  Object milestones: ${summaryColor(`${passCount}/${totalObj}`)}`);
console.log(`  bAbI families:     ${yellow(`0/${ekgBenchBabi20.length}`)} ${dim('(awaiting QA agent connection)')}`);
console.log();
