import type { GraphStore } from "../graph/graph.js";
import type { CapabilityRegistry } from "./capabilities.js";
import type { Type } from "../ir/types.js";
import { seedSemanticCapabilityGraph } from "../intent/semantic-catalog.js";

const familyFor=(id:string)=>{
  if(id.startsWith("host.process_")||id==="host.bash") return "process";
  if(id.startsWith("host.path_")) return "path";
  if(id.startsWith("host.fs_")) return "filesystem";
  if(id.startsWith("host.env_")||id==="host.args"||id==="host.cwd") return "environment";
  if(id.startsWith("host.unix_time")) return "time";
  if(id.includes("json")) return "object";
  if(id.includes("list_")) return "list";
  if(id.includes("string")) return "string";
  if(id.includes("bool")) return "boolean";
  return "integer";
};
const typeName=(t:Type):string=>t.kind==="list"?`List<${typeName(t.item)}>`:t.kind;

/** Put the boring portable substrate into the semantic graph as known capabilities. */
export function seedPortableSubstrateKnowledge(store:GraphStore,caps:CapabilityRegistry):void {
  const families=["integer","boolean","string","list","object","environment","path","filesystem","process","time"];
  for(const family of families) store.putEntity({
    id:`concept:portable:${family}`,kind:"concept",labels:["portable-substrate",family],
    attrs:{description:`Portable ${family} semantics available without Teacher discovery.`}
  });
  for(const cap of caps.all()){
    const family=familyFor(cap.id);
    const id=`capability:${cap.id}`;
    store.putEntity({id,kind:"capability",labels:["portable-substrate",family,cap.id],attrs:{
      capabilityId:cap.id,inputs:cap.inputs.map(typeName),output:typeName(cap.output),pure:cap.pure,deterministic:cap.deterministic
    }});
    store.putRelation({id:`rel:${id}:family`,kind:"member_of_semantic_family",from:id,to:`concept:portable:${family}`,confidence:1});
  }
  seedSemanticCapabilityGraph(store,caps);
}
