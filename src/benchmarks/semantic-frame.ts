export interface SFNode {
  id:string;
  op:string;
  args:Record<string,unknown>;
  type:string;
}
export interface SemanticFrame {
  nodes:SFNode[];
  root:string;
  result_type:string;
  effect:"pure"|"effectful";
}
export function canonicalizeSF(sf:SemanticFrame):SemanticFrame{
  const nodes=structuredClone(sf.nodes);
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const seen=new Set<string>(); const order:string[]=[];
  const visitValue=(v:unknown)=>{
    if(typeof v==="string"&&byId.has(v)) visit(v);
    else if(Array.isArray(v)) for(const x of v) visitValue(x);
    else if(v&&typeof v==="object") for(const k of Object.keys(v as object).sort()) visitValue((v as Record<string,unknown>)[k]);
  };
  const visit=(id:string)=>{
    if(seen.has(id)) return; seen.add(id);
    const n=byId.get(id); if(!n) return;
    for(const k of Object.keys(n.args).sort()) visitValue(n.args[k]);
    order.push(id);
  };
  visit(sf.root);
  const remap=new Map(order.map((id,i)=>[id,`n${i}`]));
  const mapValue=(v:unknown):unknown=>{
    if(typeof v==="string"&&remap.has(v)) return remap.get(v);
    if(Array.isArray(v)) return v.map(mapValue);
    if(v&&typeof v==="object"){
      const out:Record<string,unknown>={};
      for(const k of Object.keys(v as object).sort()) out[k]=mapValue((v as Record<string,unknown>)[k]);
      return out;
    }
    return v;
  };
  return {
    nodes:order.map(id=>{
      const n=byId.get(id)!;
      return {id:remap.get(id)!,op:n.op,args:mapValue(n.args) as Record<string,unknown>,type:n.type};
    }),
    root:remap.get(sf.root)!,
    result_type:sf.result_type,
    effect:sf.effect
  };
}
export function sfHash(sf:SemanticFrame):string{return JSON.stringify(canonicalizeSF(sf));}
