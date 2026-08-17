import test from 'node:test'; import assert from 'node:assert/strict';
import {ArcadeGraphStore,HybridGraphStore,arcadeOperationWeights} from '../dist/index.js';
class FakeTransport{
  entities=new Map(); relations=new Map();
  async query(q,p={},write=false){
    if(q.startsWith('MERGE (e:EKGEntity')){this.entities.set(p.id,{id:p.id,kind:p.kind,labelsJson:p.labelsJson,attrsJson:p.attrsJson});return[]}
    if(q.startsWith('MATCH (a:EKGEntity')&&q.includes('MERGE (a)-[r:')){if(!this.entities.has(p.from)||!this.entities.has(p.to))throw Error('dangling');this.relations.set(p.id,{id:p.id,kind:p.kind,from:p.from,to:p.to,confidence:p.confidence});return[]}
    if(q.includes('MATCH (e:EKGEntity {id:$id})'))return [...this.entities.values()].filter(e=>e.id===p.id);
    if(q.includes('MATCH (e:EKGEntity {kind:$kind})'))return [...this.entities.values()].filter(e=>e.kind===p.kind);
    if(q.startsWith('MATCH (e:EKGEntity) RETURN'))return [...this.entities.values()];
    if(q.startsWith('MATCH (a:EKGEntity)-[r:EKG_RELATION]->(b:EKGEntity) RETURN'))return [...this.relations.values()];
    if(q.includes('WHERE r.kind=$kind'))return [...this.relations.values()].filter(r=>r.kind===p.kind);
    if(q.includes('{id:$id})-[r:'))return [...this.relations.values()].filter(r=>r.from===p.id&&(!p.kind||r.kind===p.kind));
    if(q.includes('(b:EKGEntity {id:$id})'))return [...this.relations.values()].filter(r=>r.to===p.id&&(!p.kind||r.kind===p.kind));
    if(q.includes('WHERE e.kind = "episode"'))return [...this.entities.values()].filter(e=>e.kind==='episode').map(e=>({attrsJson:e.attrsJson}));
    if(q.startsWith('MATCH (n:EKGEntity) DETACH DELETE')){this.entities.clear();this.relations.clear();return[]}
    return[];
  }
}
test('hybrid graph mirrors, flushes, and hydrates durable cognition',async()=>{
  const t=new FakeTransport(); const durable=new ArcadeGraphStore(t); const g=new HybridGraphStore(durable);
  g.putEntity({id:'concept:a',kind:'concept',labels:['a'],attrs:{x:1}});g.putEntity({id:'concept:b',kind:'concept'});g.putRelation({id:'r1',kind:'related_to',from:'concept:a',to:'concept:b',confidence:.9});
  await g.flush(); assert.equal(t.entities.size,2); assert.equal(t.relations.size,1);
  const restarted=new HybridGraphStore(durable); await restarted.hydrate(); assert.equal(restarted.getEntity('concept:a').attrs.x,1);assert.equal(restarted.outgoing('concept:a')[0].to,'concept:b');
});
test('Arcade lived-experience rows become Search v2 operation priors',async()=>{
  const t=new FakeTransport(); const d=new ArcadeGraphStore(t);
  for(let i=0;i<6;i++)await d.putEntity({id:`e${i}`,kind:'episode',labels:['execution-experience'],attrs:{subjectId:'core.mul_int',status:'success'}});
  await d.putEntity({id:'f',kind:'episode',attrs:{subjectId:'core.add_int',status:'failure'}});
  const w=await arcadeOperationWeights(d,['core.mul_int','core.add_int','core.sub_int']);
  assert.ok(w['core.mul_int']<w['core.add_int']); assert.equal(w['core.sub_int'],1);
});
