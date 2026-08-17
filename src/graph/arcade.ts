import type { Entity, EntityKind, GraphStore, Relation } from './graph.js';
import { MemoryGraphStore } from './graph.js';

export interface ArcadeTransport {
  query(command:string, params?:Record<string,unknown>, write?:boolean):Promise<unknown[]>;
  health?():Promise<boolean>;
}

export interface ArcadeHttpOptions {
  baseUrl?:string;
  database:string;
  username?:string;
  password:string;
  fetchFn?:typeof fetch;
}

/** Dependency-free ArcadeDB OpenCypher transport over the official HTTP/JSON API. */
export class ArcadeHttpTransport implements ArcadeTransport {
  private readonly baseUrl:string;
  private readonly username:string;
  private readonly fetchFn:typeof fetch;
  constructor(private readonly options:ArcadeHttpOptions){
    this.baseUrl=(options.baseUrl??'http://127.0.0.1:2480').replace(/\/$/,'');
    this.username=options.username??'root';
    this.fetchFn=options.fetchFn??fetch;
  }
  private headers(){
    const encoded=Buffer.from(`${this.username}:${this.options.password}`,'utf8').toString('base64');
    return {'content-type':'application/json','authorization':`Basic ${encoded}`};
  }
  async health():Promise<boolean>{
    try{const r=await this.fetchFn(`${this.baseUrl}/api/v1/health`,{headers:this.headers()});return r.ok;}catch{return false;}
  }
  async query(command:string,params:Record<string,unknown>={},write=false):Promise<unknown[]>{
    const endpoint=write?'command':'query';
    const url=`${this.baseUrl}/api/v1/${endpoint}/${encodeURIComponent(this.options.database)}`;
    const r=await this.fetchFn(url,{method:'POST',headers:this.headers(),body:JSON.stringify({language:'opencypher',command,params,serializer:'record'})});
    if(!r.ok) throw new Error(`ArcadeDB ${r.status}: ${await r.text()}`);
    const body=await r.json() as {result?:unknown[]};
    return body.result??[];
  }
}

const encode=(x:unknown)=>JSON.stringify(x??null);
const parseJson=<T>(x:unknown,fallback:T):T=>{try{return typeof x==='string'?JSON.parse(x) as T:fallback}catch{return fallback}};
function rowValue(row:any,key:string):any{return row?.[key] ?? row?.[`\`${key}\``] ?? row?.[`$${key}`];}
function toEntity(row:any):Entity|undefined{
  const id=rowValue(row,'id'); const kind=rowValue(row,'kind');
  if(typeof id!=='string'||typeof kind!=='string') return undefined;
  return {id,kind:kind as EntityKind,labels:parseJson(rowValue(row,'labelsJson'),[] as string[]),attrs:parseJson(rowValue(row,'attrsJson'),{} as Record<string,unknown>)};
}
function toRelation(row:any):Relation|undefined{
  const id=rowValue(row,'id'),kind=rowValue(row,'kind'),from=rowValue(row,'from'),to=rowValue(row,'to');
  if(![id,kind,from,to].every(x=>typeof x==='string'))return undefined;
  const confidence=rowValue(row,'confidence');
  return {id,kind,from,to,confidence:typeof confidence==='number'?confidence:undefined};
}

/** Durable property-graph backend. EKG semantics depend on GraphStore, not ArcadeDB. */
export class ArcadeGraphStore {
  constructor(public readonly transport:ArcadeTransport){}
  async putEntity(e:Entity):Promise<void>{
    await this.transport.query(
      'MERGE (e:EKGEntity {id:$id}) SET e.kind=$kind, e.labelsJson=$labelsJson, e.attrsJson=$attrsJson',
      {id:e.id,kind:e.kind,labelsJson:encode(e.labels??[]),attrsJson:encode(e.attrs??{})},true);
  }
  async putRelation(r:Relation):Promise<void>{
    await this.transport.query(
      'MATCH (a:EKGEntity {id:$from}),(b:EKGEntity {id:$to}) MERGE (a)-[r:EKG_RELATION {id:$id}]->(b) SET r.kind=$kind, r.confidence=$confidence',
      {id:r.id,kind:r.kind,from:r.from,to:r.to,confidence:r.confidence??null},true);
  }
  async getEntity(id:string):Promise<Entity|undefined>{
    const xs=await this.transport.query('MATCH (e:EKGEntity {id:$id}) RETURN e.id AS id,e.kind AS kind,e.labelsJson AS labelsJson,e.attrsJson AS attrsJson',{id});
    return xs.map(toEntity).find(Boolean);
  }
  async entitiesByKind(kind:EntityKind):Promise<Entity[]>{
    const xs=await this.transport.query('MATCH (e:EKGEntity {kind:$kind}) RETURN e.id AS id,e.kind AS kind,e.labelsJson AS labelsJson,e.attrsJson AS attrsJson',{kind});
    return xs.map(toEntity).filter((x):x is Entity=>!!x);
  }
  async outgoing(id:string,kind?:string):Promise<Relation[]>{return this.relations('out',id,kind)}
  async incoming(id:string,kind?:string):Promise<Relation[]>{return this.relations('in',id,kind)}
  private async relations(direction:'in'|'out',id:string,kind?:string):Promise<Relation[]>{
    const pattern=direction==='out'?'(a:EKGEntity {id:$id})-[r:EKG_RELATION]->(b:EKGEntity)':'(a:EKGEntity)-[r:EKG_RELATION]->(b:EKGEntity {id:$id})';
    const where=kind?' WHERE r.kind=$kind':'';
    const xs=await this.transport.query(`MATCH ${pattern}${where} RETURN r.id AS id,r.kind AS kind,a.id AS from,b.id AS to,r.confidence AS confidence`,{id,kind});
    return xs.map(toRelation).filter((x):x is Relation=>!!x);
  }
  async relationsByKind(kind:string):Promise<Relation[]>{
    const xs=await this.transport.query('MATCH (a:EKGEntity)-[r:EKG_RELATION]->(b:EKGEntity) WHERE r.kind=$kind RETURN r.id AS id,r.kind AS kind,a.id AS from,b.id AS to,r.confidence AS confidence',{kind});
    return xs.map(toRelation).filter((x):x is Relation=>!!x);
  }
  async allEntities():Promise<Entity[]>{
    const xs=await this.transport.query('MATCH (e:EKGEntity) RETURN e.id AS id,e.kind AS kind,e.labelsJson AS labelsJson,e.attrsJson AS attrsJson');
    return xs.map(toEntity).filter((x):x is Entity=>!!x);
  }
  async allRelations():Promise<Relation[]>{
    const xs=await this.transport.query('MATCH (a:EKGEntity)-[r:EKG_RELATION]->(b:EKGEntity) RETURN r.id AS id,r.kind AS kind,a.id AS from,b.id AS to,r.confidence AS confidence');
    return xs.map(toRelation).filter((x):x is Relation=>!!x);
  }
  cypher(command:string,params:Record<string,unknown>={},write=false){return this.transport.query(command,params,write)}
  async clear():Promise<void>{await this.transport.query('MATCH (n:EKGEntity) DETACH DELETE n',{},true)}
}

/**
 * Hot synchronous cognition + durable ArcadeDB memory. Writes are mirrored and
 * can be awaited with flush(); hydrate() reconstructs hot state after restart.
 */
export class HybridGraphStore implements GraphStore {
  readonly memory:MemoryGraphStore;
  private pending:Promise<void>[]=[];
  constructor(public readonly durable:ArcadeGraphStore,memory=new MemoryGraphStore()){this.memory=memory}
  putEntity(e:Entity):void{this.memory.putEntity(e);this.pending.push(this.durable.putEntity(e));}
  putRelation(r:Relation):void{this.memory.putRelation(r);this.pending.push(this.durable.putRelation(r));}
  getEntity(id:string){return this.memory.getEntity(id)}
  outgoing(id:string,kind?:string){return this.memory.outgoing(id,kind)}
  incoming(id:string,kind?:string){return this.memory.incoming(id,kind)}
  relationsByKind(kind:string){return this.memory.relationsByKind(kind)}
  entitiesByKind(kind:EntityKind){return this.memory.entitiesByKind(kind)}
  async flush():Promise<void>{const xs=this.pending.splice(0);await Promise.all(xs)}
  async hydrate():Promise<void>{
    await this.flush();
    const entities=await this.durable.allEntities(); for(const e of entities)this.memory.putEntity(e);
    const relations=await this.durable.allRelations(); for(const r of relations)this.memory.putRelation(r);
  }
  cypher(command:string,params:Record<string,unknown>={},write=false){return this.durable.cypher(command,params,write)}
}

/** Cypher-derived priors for Search v2; lower weights are explored earlier. */
export async function arcadeOperationWeights(store:ArcadeGraphStore,operationIds:string[]):Promise<Record<string,number>>{
  const rows=await store.cypher(
    'MATCH (e:EKGEntity) WHERE e.kind = "episode" RETURN e.attrsJson AS attrsJson',{}
  );
  const stats=new Map<string,{success:number;failure:number}>();
  for(const row of rows as any[]){
    const attrs=parseJson<Record<string,any>>(rowValue(row,'attrsJson'),{});
    const id=attrs.subjectId; if(typeof id!=='string'||!operationIds.includes(id))continue;
    const x=stats.get(id)??{success:0,failure:0}; if(attrs.status==='success')x.success++;else if(attrs.status==='failure')x.failure++;stats.set(id,x);
  }
  return Object.fromEntries(operationIds.map(id=>{const x=stats.get(id);if(!x)return[id,1];return[id,Math.max(.5,Math.min(1.75,(x.failure+2)/(x.success+2)))];}));
}
