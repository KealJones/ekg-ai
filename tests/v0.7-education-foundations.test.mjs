import test from 'node:test'; import assert from 'node:assert/strict';
import {babyCapabilities,babyBenchBabi20,runObjectProgramMilestones,runProgram,T} from '../dist/index.js';

test('BabyBench contains the twenty bAbI prerequisite skill families as developmental probes',()=>{
  assert.equal(babyBenchBabi20.length,20);
  assert.equal(new Set(babyBenchBabi20.map(x=>x.family)).size,20);
  assert.ok(babyBenchBabi20.every(x=>x.aspirational));
});

test('recursive JSON object values are first-class EKG values and single-property access is synthesizeable',()=>{
  const caps=babyCapabilities();
  const result=runObjectProgramMilestones(caps).find(x=>x.id==='OBJECT-001-single-property');
  assert.equal(result?.passed,true);
  assert.deepEqual(runProgram(result.program,[{foo:{bar:'baz'}},'foo'],caps),{bar:'baz'});
});

test('nested dot-path milestones stay red rather than being cheated with a task-specific host capability',()=>{
  const caps=babyCapabilities();
  assert.throws(()=>caps.get('core.get_nested_path'));
  const results=runObjectProgramMilestones(caps);
  assert.equal(results.find(x=>x.id==='OBJECT-PATH-001-dot-nested')?.passed,false);
  assert.equal(results.find(x=>x.id==='OBJECT-PATH-002-variable-depth')?.passed,false);
});

test('process and bash are legitimate bounded effectful host capabilities',()=>{
  const caps=babyCapabilities();
  const exec=caps.get('host.process_exec');
  const bash=caps.get('host.bash');
  assert.equal(exec.pure,false); assert.equal(bash.pure,false);
  const out=exec.reference('printf',['hello']);
  assert.equal(out.exitCode,0); assert.equal(out.stdout,'hello');
  const shell=bash.reference('printf shell-ok');
  assert.equal(shell.exitCode,0); assert.equal(shell.stdout,'shell-ok');
});

test('malformed object access returns null instead of fabricating a value',()=>{
  const cap=babyCapabilities().get('core.json_get');
  assert.equal(cap.reference({foo:'bar'},'missing'),null);
  assert.equal(cap.reference('not-an-object','foo'),null);
});
