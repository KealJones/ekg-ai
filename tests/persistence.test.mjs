import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const moduleUrl=pathToFileURL(path.join(process.cwd(),'dist/index.js')).href;

function runChild(source){
  const r=spawnSync(process.execPath,['--input-type=module','-e',source],{cwd:process.cwd(),encoding:'utf8'});
  assert.equal(r.status,0,`child failed\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`);
  return r;
}

test('learned procedure and lived experience survive a full process restart',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ekg-brain-'));
  const brainPath=path.join(dir,'brain.json');

  runChild(`
    import assert from 'node:assert/strict';
    const ekg=await import(${JSON.stringify(moduleUrl)});
    const {FileBrain,T,ekgCapabilities,TeacherSchool}=ekg;
    const brain=new FileBrain(${JSON.stringify(brainPath)});
    const caps=ekgCapabilities();
    const input=(index,type)=>({kind:'input',index,type});
    const call=(capabilityId,args,type)=>({kind:'call',capabilityId,args,type});
    const program={
      id:'learned.restart.abs-difference',name:'Absolute difference across restart',inputs:[T.int,T.int],output:T.int,
      body:call('core.max_int',[
        call('core.sub_int',[input(0,T.int),input(1,T.int)],T.int),
        call('core.sub_int',[input(1,T.int),input(0,T.int)],T.int)
      ],T.int),provenance:['teacher:restart-test']
    };
    const validationTask={id:'restart.absdiff.validation',inputs:[T.int,T.int],output:T.int,examples:[
      {inputs:[9,4],output:5},{inputs:[4,9],output:5},{inputs:[7,7],output:0}
    ]};
    const school=new TeacherSchool(brain.graph,caps,brain.programs);
    const taught=school.teachProgram({
      id:'lesson.restart.absdiff',conceptId:'math.restart-absolute-difference',description:'absolute difference that must survive restart',
      program,validationTask,phrases:['restart absolute difference'],provenance:['teacher:restart-test']
    });
    assert.equal(taught.accepted,true);
    brain.programs.recordExperience({
      subjectKind:'learned-program',subjectId:program.id,status:'success',inputs:[9,4],output:5,
      inputTypes:[T.int,T.int],outputType:T.int,callStack:[program.id],timestamp:new Date().toISOString()
    });
    brain.episodes.append({
      id:'episode.7',taskId:'restart-task',decision:'TEACH',retrievedProgramIds:[],selectedProgramId:program.id,
      success:true,timestamp:new Date().toISOString()
    });
    assert.ok(fs.existsSync(${JSON.stringify(brainPath)}));
  `);

  const raw=JSON.parse(fs.readFileSync(brainPath,'utf8'));
  assert.equal(raw.format,'ekg-brain');
  assert.ok(raw.programs.programs.some(p=>p.id==='learned.restart.abs-difference'));

  runChild(`
    import assert from 'node:assert/strict';
    const ekg=await import(${JSON.stringify(moduleUrl)});
    const {FileBrain,ekgCapabilities,runProgram,LearnerController,T}=ekg;
    const brain=new FileBrain(${JSON.stringify(brainPath)});
    const caps=ekgCapabilities();
    const learned=brain.programs.get('learned.restart.abs-difference');
    assert.ok(learned,'learned program missing after restart');
    assert.equal(runProgram(learned,[20,7],caps,brain.programs),13);
    const ability=brain.graph.getEntity('capability:learned:learned.restart.abs-difference');
    assert.ok(ability,'learned capability graph identity missing after restart');
    assert.equal(ability.attrs.status,'active');
    const experiences=brain.programs.experiencesFor('learned.restart.abs-difference');
    assert.ok(experiences.length>=1);
    assert.ok(experiences.some(e=>JSON.stringify(e.inputs)===JSON.stringify([9,4])&&e.status==='success'));
    assert.equal(brain.episodes.byTask('restart-task').length,1);
    const controller=new LearnerController(caps,brain.programs,brain.episodes);
    const solved=controller.solve({id:'restart-followup',inputs:[T.int,T.int],output:T.int,examples:[
      {inputs:[20,7],output:13},{inputs:[2,9],output:7}
    ]},2);
    assert.equal(solved.success,true);
    assert.ok(brain.episodes.all().some(e=>e.id==='episode.8'),'episode counter did not continue after restart');
  `);

  fs.rmSync(dir,{recursive:true,force:true});
});
