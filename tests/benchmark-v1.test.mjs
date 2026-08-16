import test from "node:test";
import assert from "node:assert/strict";
import {canonicalizeSF,sfHash} from "../dist/index.js";

test("semantic-frame canonicalization ignores arbitrary node ids",()=>{
  const a={nodes:[
    {id:"x",op:"input",args:{index:0},type:"Int"},
    {id:"c",op:"literal",args:{value:2},type:"Int"},
    {id:"r",op:"mul",args:{left:"x",right:"c"},type:"Int"}
  ],root:"r",result_type:"Int",effect:"pure"};
  const b={nodes:[
    {id:"foo",op:"input",args:{index:0},type:"Int"},
    {id:"bar",op:"literal",args:{value:2},type:"Int"},
    {id:"baz",op:"mul",args:{right:"bar",left:"foo"},type:"Int"}
  ],root:"baz",result_type:"Int",effect:"pure"};
  assert.equal(sfHash(a),sfHash(b));
});

test("semantic-frame hash distinguishes different wiring/meaning",()=>{
  const mul={nodes:[
    {id:"x",op:"input",args:{index:0},type:"Int"},
    {id:"c",op:"literal",args:{value:2},type:"Int"},
    {id:"r",op:"mul",args:{left:"x",right:"c"},type:"Int"}
  ],root:"r",result_type:"Int",effect:"pure"};
  const add=structuredClone(mul); add.nodes[2].op="add";
  assert.notEqual(sfHash(mul),sfHash(add));
});
