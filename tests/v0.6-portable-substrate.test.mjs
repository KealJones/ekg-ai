import test from "node:test";
import assert from "node:assert/strict";
import {
  T, babyCapabilities, portableCoreCapabilities, portableHostCapabilities,
  synthesize, runProgram
} from "../dist/index.js";

const fakeHost={
  cwd:()=>"/work", envGet:n=>n==="HOME"?"/home/baby":"", args:()=>["one","two"],
  pathBasename:p=>p.split("/").filter(Boolean).at(-1)??"", pathDirname:p=>p.includes("/")?p.slice(0,p.lastIndexOf("/"))||"/":".",
  pathExt:p=>{const b=p.split("/").at(-1)??"";const i=b.lastIndexOf(".");return i>0?b.slice(i):"";},
  pathJoin:(a,b)=>`${a.replace(/\/$/,"")}/${b.replace(/^\//,"")}`, pathNormalize:p=>p.replace(/\/+/g,"/"),
  fsExists:p=>p==="/work/a.txt", fsIsFile:p=>p.endsWith(".txt"), fsIsDir:p=>p==="/work",
  fsList:p=>p==="/work"?["a.txt","b.md"]:[], fsReadText:p=>p==="/work/a.txt"?"hello":"",
  fsWriteText:p=>p, fsAppendText:p=>p, fsMkdir:p=>p, fsRemoveFile:p=>p.endsWith(".tmp"), fsRename:(_a,b)=>b,
  fsSize:p=>p.endsWith("a.txt")?5:0, fsMtimeSeconds:()=>1234, unixTimeSeconds:()=>5678
};

function cap(reg,id,...args){return reg.get(id).reference(...args)}

test("portable core exposes a broad universal toolbox",()=>{
  const r=portableCoreCapabilities();
  assert.ok(r.all().length>=35);
  assert.equal(cap(r,"core.sub_int",10,3),7);
  assert.equal(cap(r,"core.mod_trunc_int",-7,3),-1);
  assert.equal(cap(r,"core.and_bool",true,false),false);
  assert.equal(cap(r,"core.contains_string","hello world","world"),true);
  assert.deepEqual(cap(r,"core.list_reverse_int",[1,2,3]),[3,2,1]);
  assert.equal(cap(r,"core.list_sum_int",[1,2,3,4]),10);
});

test("portable host surface is available through a swappable host adapter",()=>{
  const r=portableHostCapabilities(fakeHost);
  assert.equal(cap(r,"host.cwd"),"/work");
  assert.equal(cap(r,"host.env_get","HOME"),"/home/baby");
  assert.deepEqual(cap(r,"host.fs_list","/work"),["a.txt","b.md"]);
  assert.equal(cap(r,"host.fs_size","/work/a.txt"),5);
});

test("babyCapabilities includes old and new substrate",()=>{
  const r=babyCapabilities(fakeHost);
  for(const id of ["core.add_int","core.sub_int","core.not_bool","core.contains_string","core.list_sum_int","host.fs_read_text","host.unix_time_seconds"])
    assert.ok(r.all().some(c=>c.id===id),id);
  assert.equal(cap(r,"core.string_len","💩a"),2); // portable code-point semantics, not JS UTF-16 units
});

test("baby can synthesize with newly supplied boring primitives",()=>{
  const r=babyCapabilities(fakeHost);
  const program=synthesize({
    id:"portable-subtract",inputs:[T.int,T.int],output:T.int,
    examples:[{inputs:[9,4],output:5},{inputs:[3,8],output:-5},{inputs:[11,11],output:0}]
  },r,{maxDepth:1});
  assert.ok(program);
  assert.equal(runProgram(program,[20,6],r),14);
});

test("portable substrate is graph-native knowledge, not just hidden registry machinery", async()=>{
  const {MemoryGraphStore,seedPortableSubstrateKnowledge}=await import("../dist/index.js");
  const caps=babyCapabilities(fakeHost); const graph=new MemoryGraphStore();
  seedPortableSubstrateKnowledge(graph,caps);
  assert.equal(graph.entitiesByKind("capability").length,caps.all().length);
  assert.ok(graph.getEntity("capability:core.sub_int"));
  assert.ok(graph.outgoing("capability:host.fs_read_text","member_of_semantic_family").length===1);
});
