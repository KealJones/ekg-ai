import { CapabilityRegistry } from "./capabilities.js";
import { T } from "../ir/types.js";
import type { Value } from "../ir/blueprint.js";

export interface FilesystemHost {
  listFilenames(dir:string): string[];
  basename(path:string): string;
}

export function filesystemCapabilities(host:FilesystemHost): CapabilityRegistry {
  const r=new CapabilityRegistry();
  r.register({
    id:"fs.list_filenames",
    inputs:[T.string],output:T.list(T.string),pure:false,deterministic:false,searchSafe:true,
    reference:(dir:Value)=>host.listFilenames(String(dir)),
    tsEmit:a=>`host.listFilenames(${a[0]})`,
    rustEmit:a=>`host.list_filenames(${a[0]})`
  });
  r.register({
    id:"fs.basename",
    inputs:[T.string],output:T.string,pure:true,deterministic:true,
    reference:(p:Value)=>host.basename(String(p)),
    tsEmit:a=>`host.basename(${a[0]})`,
    rustEmit:a=>`host.basename(${a[0]})`
  });
  return r;
}

export function mergeCapabilities(...registries:CapabilityRegistry[]):CapabilityRegistry{
  const out=new CapabilityRegistry();
  for(const r of registries) for(const c of r.all()) out.register(c);
  return out;
}
