import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { LadybugGraphStore, ladybugOperationWeights } from '../dist/index.js';

const require=createRequire(import.meta.url);
let installed=true;
try { require.resolve('@ladybugdb/core'); } catch { installed=false; }

const required=process.env.EKG_REQUIRE_LADYBUG==='1';
const explicit=process.env.EKG_LADYBUG_PATH;
const tmp=explicit ? path.dirname(explicit) : fs.mkdtempSync(path.join(os.tmpdir(),'ekg-ladybug-'));
const dbPath=explicit ?? path.join(tmp,'brain.lbdb');

test('real embedded LadybugDB round-trip + restart durability + Cypher', {skip:!installed && !required}, ()=>{
  assert.equal(installed,true,'EKG_REQUIRE_LADYBUG=1 but @ladybugdb/core is unavailable');
  let g=LadybugGraphStore.open({path:dbPath});
  g.clear();
  g.putEntity({id:'lexeme:boost',kind:'lexeme',labels:['boost'],attrs:{form:'boost'}});
  g.putEntity({id:'sense:boost:add',kind:'sense',attrs:{meaning:'increase additively'}});
  g.putRelation({id:'r:boost:add',kind:'has_sense',from:'lexeme:boost',to:'sense:boost:add',confidence:.97});
  for(let i=0;i<5;i++) g.putEntity({id:`episode:mul:${i}`,kind:'episode',attrs:{subjectId:'core.mul_int',status:'success'}});

  const rows=g.cypher('MATCH (l:EKGEntity)-[r:EKG_RELATION]->(s:EKGEntity) WHERE l.id=$id RETURN l.id AS lexeme,r.kind AS relation,s.id AS sense',{id:'lexeme:boost'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].lexeme,'lexeme:boost');
  assert.equal(rows[0].relation,'has_sense');
  assert.equal(rows[0].sense,'sense:boost:add');
  assert.equal(g.outgoing('lexeme:boost','has_sense').length,1);
  assert.ok(ladybugOperationWeights(g,['core.mul_int','core.add_int'])['core.mul_int']<1);
  g.close();

  g=LadybugGraphStore.open({path:dbPath});
  assert.equal(g.getEntity('lexeme:boost')?.attrs?.form,'boost');
  assert.equal(g.incoming('sense:boost:add','has_sense').length,1);
  assert.equal(g.entitiesByKind('episode').length,5);
  g.close();

  if(!explicit) fs.rmSync(tmp,{recursive:true,force:true});
});
