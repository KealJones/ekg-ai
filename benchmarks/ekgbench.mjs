import fs from 'node:fs';
import {
  ekgCapabilities,ekgBenchBabi20,runObjectProgramMilestones,
  evaluateDevelopmentalProbes,WorldLanguageEngine,
  MemoryGraphStore,MemoryProgramLibrary,TeacherSchool,
  ensureEkgBootstrap
} from '../dist/index.js';

const green = s => `\x1b[32m${s}\x1b[0m`;
const red = s => `\x1b[31m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const dim = s => `\x1b[2m${s}\x1b[0m`;
const bold = s => `\x1b[1m${s}\x1b[0m`;
const cyan = s => `\x1b[36m${s}\x1b[0m`;

const caps = ekgCapabilities();

// bAbI agent: fresh graph per probe to prevent story bleed
const baseGraph = new MemoryGraphStore();
ensureEkgBootstrap(baseGraph, caps);
const baseSnapshot = baseGraph.snapshot();

function createBabiAgent() {
  return async (probe) => {
    const graph = new MemoryGraphStore(baseSnapshot);
    const engine = new WorldLanguageEngine(graph);
    const r = engine.runStory(probe.story, probe.question);
    return { answer: r.answer, abstained: r.abstained, evidence: r.understood?.filter(x => x.understood).map(x => x.ruleId) };
  };
}

const babiAgent = createBabiAgent();
const babiResults = await evaluateDevelopmentalProbes(babiAgent, ekgBenchBabi20);
const objectMilestones = runObjectProgramMilestones(caps);

const report = {
  benchmark: 'EKGBench', version: '0.2',
  babi20: {
    count: ekgBenchBabi20.length,
    passed: babiResults.filter(r => r.passed).length,
    abstained: babiResults.filter(r => r.abstained).length,
    probes: babiResults.map(r => ({
      id: r.id, family: r.family, passed: r.passed, abstained: r.abstained,
      answer: r.answer, expected: r.expected
    }))
  },
  objectMilestones: objectMilestones.map(x => ({
    id: x.id, passed: x.passed, candidatesExplored: x.candidatesExplored,
    maxDepthReached: x.maxDepthReached, program: x.program?.body
  }))
};
fs.writeFileSync(new URL('./latest-ekgbench-report.json', import.meta.url), JSON.stringify(report, null, 2));

// Pretty output
console.log();
console.log(bold('  EKGBench') + dim(' v0.2'));
console.log(dim('  Developmental probes are allowed to fail. Red is information, not failure.'));
console.log();

// bAbI 20
const babiPassed = babiResults.filter(r => r.passed).length;
const babiAbstained = babiResults.filter(r => r.abstained).length;
const babiFailed = babiResults.length - babiPassed - babiAbstained;
console.log(bold('  bAbI Prerequisite Families') + dim(` (${babiPassed}/${ekgBenchBabi20.length} passing)`));
console.log();
for (const r of babiResults) {
  const icon = r.passed ? '  ✅' : r.abstained ? '  \u{1F6A7}' : '  ❌';
  const status = r.passed ? green('PASS') : r.abstained ? yellow('SKIP') : red('FAIL');
  const detail = r.passed
    ? dim(`answer: ${JSON.stringify(r.answer)}`)
    : r.abstained
      ? dim('no grammar/knowledge')
      : dim(`got: ${JSON.stringify(r.answer)}, expected: ${JSON.stringify(r.expected)}`);
  console.log(`${icon} ${status} ${r.id.padEnd(9)} ${r.family.padEnd(28)} ${detail}`);
}
console.log();

// Object milestones
const passCount = objectMilestones.filter(m => m.passed).length;
const totalObj = objectMilestones.length;
console.log(bold('  Object Program Milestones') + dim(` (${passCount}/${totalObj})`));
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
const summaryBabi = babiPassed === 20 ? green : babiPassed > 0 ? yellow : red;
const summaryObj = passCount === totalObj ? green : passCount > 0 ? yellow : red;
console.log(bold('  Summary'));
console.log(`  bAbI families:     ${summaryBabi(`${babiPassed}/${ekgBenchBabi20.length}`)} ${dim(`(${babiAbstained} abstained, ${babiFailed} wrong)`)}`);
console.log(`  Object milestones: ${summaryObj(`${passCount}/${totalObj}`)}`);
console.log();
