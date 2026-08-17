import test from 'node:test';
import assert from 'node:assert/strict';
import {
  T, defaultCapabilities, MemoryGraphStore, MemoryProgramLibrary,
  SelfHealingProgramLibrary, TeacherSchool, runProgramResilient, runProgram,
  CapabilityRegistry
} from '../dist/index.js';

const I=(index,type=T.int)=>({kind:'input',index,type});
const C=(id,args,type=T.int)=>({kind:'call',capabilityId:id,args,type});
const P=(id,args,type=T.int)=>({kind:'program_call',programId:id,args,type});

function lessonForAbsDiff(){
  const program={
    id:'learned.abs-diff', inputs:[T.int,T.int], output:T.int,
    body:C('core.max_int',[
      C('core.sub_int',[I(0),I(1)]),
      C('core.sub_int',[I(1),I(0)])
    ])
  };
  return {
    id:'lesson.abs-diff', conceptId:'abs-diff', description:'absolute integer difference', program,
    validationTask:{id:'validate.abs-diff',inputs:[T.int,T.int],output:T.int,examples:[{inputs:[9,4],output:5},{inputs:[4,9],output:5},{inputs:[7,7],output:0}]},
    provenance:['teacher:test']
  };
}

function capsWithSub(){
  const caps=defaultCapabilities();
  caps.register({id:'core.sub_int',inputs:[T.int,T.int],output:T.int,pure:true,deterministic:true,reference:(a,b)=>Number(a)-Number(b),tsEmit:a=>`(${a[0]}-${a[1]})`,rustEmit:a=>`(${a[0]}-${a[1]})`});
  return caps;
}

test('missing acquired capability is restored from durable graph snapshot before run',()=>{
  const graph=new MemoryGraphStore(); const backing=new MemoryProgramLibrary(); const caps=capsWithSub();
  const programs=new SelfHealingProgramLibrary(backing,graph,caps);
  const school=new TeacherSchool(graph,caps,programs);
  const taught=school.teachProgram(lessonForAbsDiff()); assert.equal(taught.accepted,true);

  const outer={id:'learned.outer',inputs:[T.int,T.int,T.int],output:T.int,body:C('core.add_int',[P('learned.abs-diff',[I(0),I(1)]),I(2)])};
  backing.put(outer);
  assert.equal(backing.remove('learned.abs-diff'),true);
  assert.equal(backing.get('learned.abs-diff'),undefined);

  const result=runProgramResilient(outer,[17,5,3],caps,programs);
  assert.equal(result.value,15);
  assert.ok(programs.get('learned.abs-diff'));
  assert.ok(graph.entitiesByKind('episode').some(e=>e.labels?.includes('self-repair')&&e.labels?.includes('restored')&&e.attrs?.programId==='learned.abs-diff'));
});

test('dependency disappearing during the same run heals transparently at lookup',()=>{
  const graph=new MemoryGraphStore(); const backing=new MemoryProgramLibrary(); const caps=capsWithSub();
  const programs=new SelfHealingProgramLibrary(backing,graph,caps);
  new TeacherSchool(graph,caps,programs).teachProgram(lessonForAbsDiff());

  // sabotage runs as the left add argument, after resilient preflight but before program_call evaluation.
  caps.register({id:'test.delete-inner',inputs:[T.int],output:T.int,pure:false,deterministic:false,
    reference:(x)=>{backing.remove('learned.abs-diff');return x;},tsEmit:a=>a[0],rustEmit:a=>a[0]});
  const outer={id:'learned.outer.midrun',inputs:[T.int,T.int,T.int],output:T.int,
    body:C('core.add_int',[C('test.delete-inner',[I(2)]),P('learned.abs-diff',[I(0),I(1)])])};
  backing.put(outer);

  const result=runProgramResilient(outer,[17,5,3],caps,programs);
  assert.equal(result.value,15);
  assert.ok(graph.entitiesByKind('episode').some(e=>e.labels?.includes('self-repair')&&e.attrs?.programId==='learned.abs-diff'));
});

test('unrecoverable missing dependency fails with diagnosis instead of silent corruption',()=>{
  const graph=new MemoryGraphStore(); const backing=new MemoryProgramLibrary(); const caps=capsWithSub();
  const programs=new SelfHealingProgramLibrary(backing,graph,caps);
  const broken={id:'learned.broken',inputs:[T.int],output:T.int,body:P('does.not.exist',[I(0)])};
  assert.throws(()=>runProgramResilient(broken,[3],caps,programs),/Unrepairable program dependency chain/);
  assert.ok(graph.entitiesByKind('episode').some(e=>e.labels?.includes('self-repair')&&e.labels?.includes('failed')));
});

test('all learned-program usages retain durable lived context including failures and caller blueprints',()=>{
  const graph=new MemoryGraphStore(); const backing=new MemoryProgramLibrary(); const caps=capsWithSub();
  const programs=new SelfHealingProgramLibrary(backing,graph,caps);
  new TeacherSchool(graph,caps,programs).teachProgram(lessonForAbsDiff());
  const outer={id:'learned.context.outer',inputs:[T.int,T.int,T.int],output:T.int,body:C('core.add_int',[P('learned.abs-diff',[I(0),I(1)]),I(2)])};
  backing.put(outer);
  assert.equal(runProgram(outer,[9,4,1],caps,programs),6);
  assert.equal(runProgram(outer,[4,9,2],caps,programs),7);
  // Force a genuinely broken learned usage and retain the failed context too.
  caps.register({id:'test.boom',inputs:[T.int],output:T.int,pure:false,deterministic:false,reference:()=>{throw new Error('boom')},tsEmit:a=>a[0],rustEmit:a=>a[0]});
  const flaky={id:'learned.flaky',inputs:[T.int],output:T.int,body:C('test.boom',[I(0)])};
  const flakyOuter={id:'learned.flaky.outer',inputs:[T.int],output:T.int,body:P('learned.flaky',[I(0)])};
  backing.put(flaky); backing.put(flakyOuter);
  assert.throws(()=>runProgram(flakyOuter,[3],caps,programs),/boom/);
  const xs=programs.experiencesFor('learned.abs-diff');
  assert.ok(xs.length>=2);
  assert.ok(xs.some(x=>x.status==='success'&&x.callerProgramId==='learned.context.outer'&&x.callerBlueprintSnapshot?.id==='learned.context.outer'));
  const broken=programs.experiencesFor('learned.flaky');
  assert.ok(broken.some(x=>x.status==='failure'&&x.callerProgramId==='learned.flaky.outer'&&x.callerBlueprintSnapshot?.id==='learned.flaky.outer'&&String(x.error).includes('boom')));
});

test('missing blueprint can be reconstructed from lived successful usages',()=>{
  const graph=new MemoryGraphStore(); const backing=new MemoryProgramLibrary(); const caps=capsWithSub();
  const programs=new SelfHealingProgramLibrary(backing,graph,caps);
  new TeacherSchool(graph,caps,programs).teachProgram(lessonForAbsDiff());
  const outer={id:'learned.rebuild.outer',inputs:[T.int,T.int],output:T.int,body:P('learned.abs-diff',[I(0),I(1)])};
  backing.put(outer);
  for(const xs of [[9,4],[4,9],[12,2],[7,7]]) assert.equal(runProgram(outer,xs,caps,programs),Math.abs(xs[0]-xs[1]));
  // Destroy both live implementation and canonical executable snapshots.
  backing.remove('learned.abs-diff');
  for(const id of ['program:learned.abs-diff','capability:learned:learned.abs-diff']){
    const e=graph.getEntity(id); assert.ok(e); const attrs={...(e.attrs??{})}; delete attrs.blueprintSnapshot; attrs.snapshotStatus='missing'; graph.putEntity({...e,attrs});
  }
  const result=runProgramResilient(outer,[17,5],caps,programs);
  assert.equal(result.value,12);
  const restored=backing.get('learned.abs-diff'); assert.ok(restored);
  assert.ok(restored.provenance?.some(x=>x.startsWith('reconstructed-from-lived-experience:')));
  assert.ok(graph.entitiesByKind('episode').some(e=>e.labels?.includes('self-repair')&&e.labels?.includes('restored')&&e.attrs?.source==='lived-experience'));
  assert.equal(graph.getEntity('program:learned.abs-diff')?.attrs?.snapshotStatus,'reconstructed-validated');
});
