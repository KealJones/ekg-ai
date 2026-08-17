import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import {phase0V05,v05Witnesses,expressionDepth} from '../dist/index.js';
const bench=JSON.parse(fs.readFileSync(new URL('../bench-v1/bench_v05.json',import.meta.url),'utf8'));
test('v0.5 taught witnesses are depth 4 and engine-expressible',()=>{for(const [id,p] of Object.entries(v05Witnesses())) if(id!=='interleave_cost') assert.equal(expressionDepth(p.body),4,id)});
test('v0.5 preflight fails closed before teaching when real depth-3 search is not operationally bounded',()=>{const r=phase0V05(bench);assert.equal(r.status,'BLOCKED_ENGINE_DEPTH3_SEARCH_NOT_OPERATIONALLY_BOUNDED');assert.equal(r.itemCount,184);assert.equal(r.gates.P0_7_zero_literal_constants,true);assert.equal(r.gates.P0_9_witnesses_base_only,true);assert.equal(r.gates.P0_10_witness_60_probe_execution,true);assert.equal(r.gates.P0_11_taught_unreachable_d3,false);assert.equal(r.gates.P0_13_all_items_unreachable_d3,false);});
