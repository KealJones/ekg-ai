import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseCliUtterance,parseTypedCliValue,T,EkgCli } from '../dist/index.js';

const cli=path.join(process.cwd(),'dist/cli/main.js');
function run(args,{input}={}){
  return spawnSync(process.execPath,[cli,...args],{cwd:process.cwd(),encoding:'utf8',input});
}

test('CLI input parser accepts explicit JSON runtime inputs and rejects malformed plausible input',()=>{
  assert.deepEqual(parseCliUtterance('deduct six from this number :: [20]'),{utterance:'deduct six from this number',inputs:[20]});
  assert.deepEqual(parseCliUtterance('sum list :: [[1,2,3]]'),{utterance:'sum list',inputs:[[1,2,3]]});
  assert.throws(()=>parseCliUtterance('deduct six :: 20'),/JSON array/i);
  assert.throws(()=>parseCliUtterance('deduct six :: [20'),/valid JSON/i);
  assert.equal(parseTypedCliValue('20',T.int),20);
  assert.throws(()=>parseTypedCliValue('"20"',T.int),/int/i);
});

test('npm-style EKG CLI executes natural language against a persisted brain file',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ekg-cli-'));
  const brain=path.join(dir,'brain.json');
  const r=run(['--brain',brain,'--backend','memory','--teacher','off','--no-banner','--once','deduct six from this number','--inputs','[20]']);
  assert.equal(r.status,0,`STDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`);
  assert.equal(r.stdout.trim(),'14');
  assert.ok(fs.existsSync(brain));
  const saved=JSON.parse(fs.readFileSync(brain,'utf8'));
  assert.equal(saved.format,'ekg-brain');
  assert.ok(saved.graph.entities.some(e=>e.id==='state:bootstrap:ekg-core-v1'));
  fs.rmSync(dir,{recursive:true,force:true});
});

test('CLI manual synonym lesson survives a complete process restart',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ekg-cli-learn-'));
  const brain=path.join(dir,'brain.json');
  const teach=run(['--brain',brain,'--backend','memory','--teacher','off','--no-banner'],{input:'/teach synonym dock = subtract\n/exit\n'});
  assert.equal(teach.status,0,`STDOUT:\n${teach.stdout}\nSTDERR:\n${teach.stderr}`);
  assert.match(teach.stdout,/Learned: dock -> Subtract/);
  const use=run(['--brain',brain,'--backend','memory','--teacher','off','--no-banner','--once','dock six from this number','--inputs','[20]']);
  assert.equal(use.status,0,`STDOUT:\n${use.stdout}\nSTDERR:\n${use.stderr}`);
  assert.equal(use.stdout.trim(),'14');
  fs.rmSync(dir,{recursive:true,force:true});
});


test('interactive EKG CLI prompts for missing typed runtime input',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ekg-cli-prompt-'));
  const brain=path.join(dir,'brain.json');
  const lines=[],errors=[],answers=['20'];
  const io={
    line:text=>lines.push(text),
    error:text=>errors.push(text),
    question:async prompt=>{lines.push(prompt);return answers.shift()??'';}
  };
  const shell=new EkgCli(io,{brainPath:brain,banner:false,teacherEnabled:false});
  await shell.handleLine('deduct six from this number');
  assert.deepEqual(errors,[]);
  assert.ok(lines.some(x=>x.includes('input[0] (int)>')));
  assert.equal(lines.at(-1),'14');
  fs.rmSync(dir,{recursive:true,force:true});
});
