import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CapabilityRegistry } from "./capabilities.js";
import { T } from "../ir/types.js";
import type { JsonValue, Value } from "../ir/blueprint.js";

export interface ProcessResultValue {
  [key:string]:JsonValue;
  exitCode:number;
  stdout:string;
  stderr:string;
  signal:string;
  error:string;
}

export interface PortableHost {
  cwd():string;
  envGet(name:string):string;
  args():string[];
  pathBasename(p:string):string;
  pathDirname(p:string):string;
  pathExt(p:string):string;
  pathJoin(a:string,b:string):string;
  pathNormalize(p:string):string;
  fsExists(p:string):boolean;
  fsIsFile(p:string):boolean;
  fsIsDir(p:string):boolean;
  fsList(p:string):string[];
  fsReadText(p:string):string;
  fsWriteText(p:string,contents:string):string;
  fsAppendText(p:string,contents:string):string;
  fsMkdir(p:string):string;
  fsRemoveFile(p:string):boolean;
  fsRename(from:string,to:string):string;
  fsSize(p:string):number;
  fsMtimeSeconds(p:string):number;
  unixTimeSeconds():number;
  processExec(program:string,args:string[]):JsonValue;
  bash(script:string):JsonValue;
}

export interface NodePortableHostOptions {
  /** Bounded non-interactive process execution. This is a resource guard, NOT a security sandbox. */
  allowProcessExecution?:boolean;
  processCwd?:string;
  timeoutMs?:number;
  maxBufferBytes?:number;
}

function processResult(result:any):ProcessResultValue{
  return {
    exitCode:typeof result.status==="number"?result.status:-1,
    stdout:String(result.stdout??""),
    stderr:String(result.stderr??""),
    signal:String(result.signal??""),
    error:result.error?String(result.error.message??result.error):"",
  };
}

export function nodePortableHost(options:NodePortableHostOptions={}):PortableHost {
  const allow=options.allowProcessExecution??true;
  const timeout=options.timeoutMs??5_000;
  const maxBuffer=options.maxBufferBytes??1_048_576;
  const cwd=options.processCwd;
  const exec=(program:string,args:string[])=>{
    if(!allow) return {exitCode:-1,stdout:"",stderr:"",signal:"",error:"process execution disabled by host policy"};
    const result=spawnSync(program,args,{cwd,encoding:"utf8",timeout,maxBuffer,shell:false});
    return processResult(result);
  };
  return {
    cwd:()=>process.cwd(),
    envGet:n=>process.env[n]??"",
    args:()=>process.argv.slice(2),
    pathBasename:path.basename,
    pathDirname:path.dirname,
    pathExt:p=>path.extname(p),
    pathJoin:(a,b)=>path.join(a,b),
    pathNormalize:path.normalize,
    fsExists:p=>fs.existsSync(p),
    fsIsFile:p=>{try{return fs.statSync(p).isFile();}catch{return false;}},
    fsIsDir:p=>{try{return fs.statSync(p).isDirectory();}catch{return false;}},
    fsList:p=>fs.readdirSync(p).sort(),
    fsReadText:p=>fs.readFileSync(p,"utf8"),
    fsWriteText:(p,c)=>{fs.writeFileSync(p,c,"utf8");return p;},
    fsAppendText:(p,c)=>{fs.appendFileSync(p,c,"utf8");return p;},
    fsMkdir:p=>{fs.mkdirSync(p,{recursive:true});return p;},
    fsRemoveFile:p=>{try{fs.unlinkSync(p);return true;}catch{return false;}},
    fsRename:(a,b)=>{fs.renameSync(a,b);return b;},
    fsSize:p=>{try{return fs.statSync(p).size;}catch{return 0;}},
    fsMtimeSeconds:p=>{try{return Math.floor(fs.statSync(p).mtimeMs/1000);}catch{return 0;}},
    unixTimeSeconds:()=>Math.floor(Date.now()/1000),
    processExec:exec,
    bash:script=>exec("bash",["-lc",script]),
  };
}

export function portableHostCapabilities(host:PortableHost):CapabilityRegistry {
  const r=new CapabilityRegistry();
  const reg=(id:string,inputs:any[],output:any,pure:boolean,deterministic:boolean,reference:(...args:Value[])=>Value,tsEmit:(a:string[])=>string,rustEmit:(a:string[])=>string,searchSafe?:boolean)=>
    r.register({id,inputs,output,pure,deterministic,reference,tsEmit,rustEmit,searchSafe});
  reg("host.cwd",[],T.string,false,false,()=>host.cwd(),()=>`host.cwd()`,()=>`host.cwd()`,true);
  reg("host.env_get",[T.string],T.string,false,false,a=>host.envGet(String(a)),a=>`host.envGet(${a[0]})`,a=>`host.env_get(${a[0]})`,true);
  reg("host.args",[],T.list(T.string),false,false,()=>host.args(),()=>`host.args()`,()=>`host.args()`,true);
  reg("host.path_basename",[T.string],T.string,true,true,a=>host.pathBasename(String(a)),a=>`host.pathBasename(${a[0]})`,a=>`host.path_basename(${a[0]})`);
  reg("host.path_dirname",[T.string],T.string,true,true,a=>host.pathDirname(String(a)),a=>`host.pathDirname(${a[0]})`,a=>`host.path_dirname(${a[0]})`);
  reg("host.path_ext",[T.string],T.string,true,true,a=>host.pathExt(String(a)),a=>`host.pathExt(${a[0]})`,a=>`host.path_ext(${a[0]})`);
  reg("host.path_join",[T.string,T.string],T.string,true,true,(a,b)=>host.pathJoin(String(a),String(b)),a=>`host.pathJoin(${a[0]},${a[1]})`,a=>`host.path_join(${a[0]},${a[1]})`);
  reg("host.path_normalize",[T.string],T.string,true,true,a=>host.pathNormalize(String(a)),a=>`host.pathNormalize(${a[0]})`,a=>`host.path_normalize(${a[0]})`);
  reg("host.fs_exists",[T.string],T.bool,false,false,a=>host.fsExists(String(a)),a=>`host.fsExists(${a[0]})`,a=>`host.fs_exists(${a[0]})`,true);
  reg("host.fs_is_file",[T.string],T.bool,false,false,a=>host.fsIsFile(String(a)),a=>`host.fsIsFile(${a[0]})`,a=>`host.fs_is_file(${a[0]})`,true);
  reg("host.fs_is_dir",[T.string],T.bool,false,false,a=>host.fsIsDir(String(a)),a=>`host.fsIsDir(${a[0]})`,a=>`host.fs_is_dir(${a[0]})`,true);
  reg("host.fs_list",[T.string],T.list(T.string),false,false,a=>host.fsList(String(a)),a=>`host.fsList(${a[0]})`,a=>`host.fs_list(${a[0]})`,true);
  reg("host.fs_read_text",[T.string],T.string,false,false,a=>host.fsReadText(String(a)),a=>`host.fsReadText(${a[0]})`,a=>`host.fs_read_text(${a[0]})`,true);
  reg("host.fs_write_text",[T.string,T.string],T.string,false,false,(a,b)=>host.fsWriteText(String(a),String(b)),a=>`host.fsWriteText(${a[0]},${a[1]})`,a=>`host.fs_write_text(${a[0]},${a[1]})`);
  reg("host.fs_append_text",[T.string,T.string],T.string,false,false,(a,b)=>host.fsAppendText(String(a),String(b)),a=>`host.fsAppendText(${a[0]},${a[1]})`,a=>`host.fs_append_text(${a[0]},${a[1]})`);
  reg("host.fs_mkdir",[T.string],T.string,false,false,a=>host.fsMkdir(String(a)),a=>`host.fsMkdir(${a[0]})`,a=>`host.fs_mkdir(${a[0]})`);
  reg("host.fs_remove_file",[T.string],T.bool,false,false,a=>host.fsRemoveFile(String(a)),a=>`host.fsRemoveFile(${a[0]})`,a=>`host.fs_remove_file(${a[0]})`);
  reg("host.fs_rename",[T.string,T.string],T.string,false,false,(a,b)=>host.fsRename(String(a),String(b)),a=>`host.fsRename(${a[0]},${a[1]})`,a=>`host.fs_rename(${a[0]},${a[1]})`);
  reg("host.fs_size",[T.string],T.int,false,false,a=>host.fsSize(String(a)),a=>`host.fsSize(${a[0]})`,a=>`host.fs_size(${a[0]})`,true);
  reg("host.fs_mtime_seconds",[T.string],T.int,false,false,a=>host.fsMtimeSeconds(String(a)),a=>`host.fsMtimeSeconds(${a[0]})`,a=>`host.fs_mtime_seconds(${a[0]})`,true);
  reg("host.unix_time_seconds",[],T.int,false,false,()=>host.unixTimeSeconds(),()=>`host.unixTimeSeconds()`,()=>`host.unix_time_seconds()`,true);
  reg("host.process_exec",[T.string,T.list(T.string)],T.json,false,false,(a,b)=>host.processExec(String(a),(b as Value[]).map(String)),a=>`host.processExec(${a[0]},${a[1]})`,a=>`host.process_exec(${a[0]},${a[1]})`);
  reg("host.bash",[T.string],T.json,false,false,a=>host.bash(String(a)),a=>`host.bash(${a[0]})`,a=>`host.bash(${a[0]})`);
  return r;
}
