import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bindLadybugCypher,
  ladybugCypherLiteral,
  ladybugOperationWeights,
  LadybugGraphStore,
} from '../dist/index.js';

class Result { constructor(rows=[]){this.rows=rows} getAllSync(){return this.rows} close(){} }
class FakeConnection {
  queries=[];
  querySync(q){ this.queries.push(q); return new Result([]); }
}

test('Ladybug Cypher binder binds only outside quoted text',()=>{
  const q=bindLadybugCypher(
    'RETURN $x AS x, "$x" AS literal, \'$x\' AS literal2, `$x` AS ident, $s AS s',
    {x:42,s:'a"b\\c'}
  );
  assert.match(q,/RETURN 42 AS x/);
  assert.match(q,/"\$x" AS literal/);
  assert.match(q,/\'\$x\' AS literal2/);
  assert.match(q,/`\$x` AS ident/);
  assert.match(q,/"a\\\"b\\\\c" AS s/);
  assert.equal(ladybugCypherLiteral([1,'x',true,null]),'[1,"x",TRUE,NULL]');
});

test('Ladybug GraphStore emits embedded Cypher schema and writes',()=>{
  const c=new FakeConnection();
  const g=new LadybugGraphStore({},c,true);
  g.putEntity({id:'concept:a',kind:'concept',labels:['a'],attrs:{x:1}});
  assert.ok(c.queries.some(q=>q.startsWith('CREATE NODE TABLE IF NOT EXISTS EKGEntity')));
  assert.ok(c.queries.some(q=>q.startsWith('CREATE REL TABLE IF NOT EXISTS EKG_RELATION')));
  assert.ok(c.queries.some(q=>q.includes('MERGE (e:EKGEntity') && q.includes('concept:a')));
});

test('Ladybug lived-experience priors are queried through Cypher for Search v2 weighting',()=>{
  let query;
  const fake={
    cypher(q){
      query=q;
      return [
        ...Array.from({length:6},()=>({subjectId:'core.mul_int',status:'success'})),
        {subjectId:'core.add_int',status:'failure'},
      ];
    }
  };
  const w=ladybugOperationWeights(fake,['core.mul_int','core.add_int','core.sub_int']);
  assert.match(query,/MATCH \(e:EKGEntity\).*subjectId/);
  assert.ok(w['core.mul_int']<w['core.add_int']);
  assert.equal(w['core.sub_int'],1);
});
