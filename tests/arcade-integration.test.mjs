import test from 'node:test'; import assert from 'node:assert/strict'; import {ArcadeHttpTransport,ArcadeGraphStore,HybridGraphStore} from '../dist/index.js';
const url=process.env.ARCADEDB_URL, password=process.env.ARCADEDB_PASSWORD, database=process.env.ARCADEDB_DATABASE??'ekg_test';
test('real ArcadeDB round-trip', {skip:!url||!password}, async()=>{
  const t=new ArcadeHttpTransport({baseUrl:url,database,password}); assert.equal(await t.health(),true);
  const d=new ArcadeGraphStore(t); await d.clear(); const g=new HybridGraphStore(d);
  g.putEntity({id:'lexeme:boost',kind:'lexeme',labels:['boost'],attrs:{form:'boost'}});g.putEntity({id:'sense:boost:add',kind:'sense'});g.putRelation({id:'r:boost:add',kind:'has_sense',from:'lexeme:boost',to:'sense:boost:add'});await g.flush();
  const rows=await g.cypher('MATCH (l:EKGEntity {id:$id})-[r:EKG_RELATION]->(s:EKGEntity) RETURN l.id AS lexeme,r.kind AS relation,s.id AS sense',{id:'lexeme:boost'});
  assert.equal(rows.length,1); assert.equal(rows[0].sense,'sense:boost:add');
  const restarted=new HybridGraphStore(d);await restarted.hydrate();assert.equal(restarted.outgoing('lexeme:boost','has_sense').length,1);
});
